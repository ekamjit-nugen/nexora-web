import { Injectable, Logger, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import * as dns from 'dns';
import * as net from 'net';
import { promisify } from 'util';
import { IWebhookEndpoint } from './schemas/webhook-endpoint.schema';

const dnsLookup = promisify(dns.lookup);

@Injectable()
export class WebhookEndpointService {
  private readonly logger = new Logger(WebhookEndpointService.name);

  constructor(
    @InjectModel('WebhookEndpoint', 'nexora_auth') private webhookEndpointModel: Model<IWebhookEndpoint>,
  ) {}

  /**
   * SSRF guard. Blocks webhook URLs that resolve to:
   *   - loopback (127.0.0.0/8, ::1)
   *   - RFC1918 private ranges (10/8, 172.16/12, 192.168/16)
   *   - link-local (169.254/16, fe80::/10) — includes AWS IMDS 169.254.169.254
   *   - carrier-grade NAT (100.64/10)
   *   - multicast/reserved
   *   - any hostname matching internal service naming (*.local, .internal, .svc)
   *
   * Note: this validates at creation time. A TOCTOU attacker could point DNS
   * at a public IP during creation and switch it to a private IP afterwards.
   * Full protection also requires a dial-time guard in sendWebhook — which
   * is covered by resolving and re-checking at delivery time.
   */
  private async assertSafeWebhookUrl(rawUrl: string): Promise<void> {
    let u: URL;
    try {
      u = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Invalid webhook URL');
    }
    if (!['http:', 'https:'].includes(u.protocol)) {
      throw new BadRequestException('Webhook URL must use http or https');
    }
    if (process.env.NODE_ENV === 'production' && u.protocol !== 'https:') {
      throw new BadRequestException('Webhook URL must use https in production');
    }
    const hostname = u.hostname.toLowerCase();
    if (!hostname) {
      throw new BadRequestException('Webhook URL must have a hostname');
    }
    // Reject internal naming conventions outright.
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.svc') ||
      hostname.endsWith('.svc.cluster.local') ||
      hostname.endsWith('.cluster.local') ||
      // AWS/GCP metadata hostnames
      hostname === 'metadata.google.internal' ||
      hostname === 'metadata.goog'
    ) {
      throw new BadRequestException('Webhook URL points to an internal host');
    }

    // Resolve and validate every A/AAAA record — a hostname with multiple
    // records should fail if ANY of them are private.
    let addresses: dns.LookupAddress[];
    try {
      addresses = await dnsLookup(hostname, { all: true });
    } catch {
      throw new BadRequestException('Webhook URL hostname could not be resolved');
    }
    for (const { address } of addresses) {
      if (this.isPrivateOrReservedAddress(address)) {
        throw new BadRequestException(
          `Webhook URL resolves to a non-public address (${address})`,
        );
      }
    }
  }

  private isPrivateOrReservedAddress(address: string): boolean {
    if (net.isIPv4(address)) {
      const parts = address.split('.').map(Number);
      const [a, b] = parts;
      if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
      if (a === 0) return true;                          // 0.0.0.0/8
      if (a === 10) return true;                         // RFC1918
      if (a === 127) return true;                        // loopback
      if (a === 169 && b === 254) return true;           // link-local (incl. IMDS)
      if (a === 172 && b >= 16 && b <= 31) return true;  // RFC1918
      if (a === 192 && b === 168) return true;           // RFC1918
      if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
      if (a >= 224) return true;                         // multicast + reserved
      return false;
    }
    if (net.isIPv6(address)) {
      const normalized = address.toLowerCase();
      if (normalized === '::' || normalized === '::1') return true;
      if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // link-local + ULA
      if (normalized.startsWith('ff')) return true;       // multicast
      // IPv4-mapped IPv6 (::ffff:10.0.0.1)
      const mapped = normalized.match(/^::ffff:([0-9.]+)$/);
      if (mapped) return this.isPrivateOrReservedAddress(mapped[1]);
      return false;
    }
    return true; // unknown format — fail closed
  }

  async createEndpoint(dto: { name: string; url: string; events: string[] }, userId: string, orgId: string): Promise<IWebhookEndpoint> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    await this.assertSafeWebhookUrl(dto.url);

    const secret = crypto.randomBytes(32).toString('hex');
    const endpoint = new this.webhookEndpointModel({
      organizationId: orgId,
      name: dto.name,
      url: dto.url,
      events: dto.events || [],
      secret,
      isActive: true,
      createdBy: userId,
    });
    await endpoint.save();
    return endpoint;
  }

  async listEndpoints(orgId: string): Promise<IWebhookEndpoint[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    return this.webhookEndpointModel.find({ organizationId: orgId, isDeleted: false }).sort({ createdAt: -1 });
  }

  async deleteEndpoint(id: string, orgId: string): Promise<void> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    await this.webhookEndpointModel.updateOne({ _id: id, organizationId: orgId }, { $set: { isDeleted: true, isActive: false } });
  }

  /**
   * Deliver an event to all subscribed endpoints.
   * Called from other services when events occur.
   */
  async deliverEvent(event: string, payload: any, orgId: string): Promise<void> {
    const endpoints = await this.webhookEndpointModel.find({
      organizationId: orgId,
      events: event,
      isActive: true,
      isDeleted: false,
    });

    for (const endpoint of endpoints) {
      this.sendWebhook(endpoint, event, payload).catch(err => {
        this.logger.warn(`Webhook delivery failed to ${endpoint.url}: ${err.message}`);
      });
    }
  }

  private async sendWebhook(endpoint: IWebhookEndpoint, event: string, payload: any): Promise<void> {
    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    const signature = crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex');

    try {
      // Re-validate at dial time to close the TOCTOU window where DNS could
      // be repointed at an internal address after the endpoint was accepted.
      await this.assertSafeWebhookUrl(endpoint.url);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nexora-Event': event,
          'X-Nexora-Signature': signature,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      endpoint.lastTriggeredAt = new Date();
      endpoint.lastStatus = res.status;
      if (res.ok) {
        endpoint.successCount = (endpoint.successCount || 0) + 1;
        endpoint.lastError = undefined;
      } else {
        endpoint.failureCount = (endpoint.failureCount || 0) + 1;
        endpoint.lastError = `HTTP ${res.status}`;
      }
      await endpoint.save();
    } catch (err: any) {
      endpoint.lastTriggeredAt = new Date();
      endpoint.failureCount = (endpoint.failureCount || 0) + 1;
      endpoint.lastError = err.message;
      await endpoint.save();
    }
  }
}
