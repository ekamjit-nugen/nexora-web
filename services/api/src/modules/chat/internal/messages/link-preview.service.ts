import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as dns from 'dns';
import { IMessage, ILinkPreview } from './schemas/message.schema';

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;
const MAX_PREVIEWS = 3;
const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 256 * 1024; // 256 KB — only need the <head>
const MAX_REDIRECTS = 3;

/** CIDR-style ranges that must never be fetched (SSRF protection). */
const PRIVATE_IP_RANGES = [
  // IPv4
  { prefix: '127.', bits: 8 },        // 127.0.0.0/8 loopback
  { prefix: '10.', bits: 8 },         // 10.0.0.0/8 private
  { prefix: '192.168.', bits: 16 },   // 192.168.0.0/16 private
  { prefix: '169.254.', bits: 16 },   // 169.254.0.0/16 link-local / AWS metadata
  { prefix: '0.', bits: 8 },          // 0.0.0.0/8
];

/** 172.16.0.0/12 needs a numeric check (172.16.x – 172.31.x). */
function isPrivate172(ip: string): boolean {
  const parts = ip.split('.');
  if (parts[0] !== '172') return false;
  const second = parseInt(parts[1], 10);
  return second >= 16 && second <= 31;
}

/** Check whether an IPv4 address string falls in any blocked range. */
function isBlockedIPv4(ip: string): boolean {
  if (ip === '0.0.0.0') return true;
  for (const range of PRIVATE_IP_RANGES) {
    if (ip.startsWith(range.prefix)) return true;
  }
  return isPrivate172(ip);
}

/** Decode hex-encoded (0x7f000001) or decimal-encoded (2130706433) IPs to dotted-quad. */
function normalizeIpRepresentation(hostname: string): string | null {
  // Hex-encoded IPv4: 0x7f000001
  if (/^0x[0-9a-fA-F]+$/.test(hostname)) {
    const num = parseInt(hostname, 16);
    if (num >= 0 && num <= 0xffffffff) {
      return `${(num >>> 24) & 0xff}.${(num >>> 16) & 0xff}.${(num >>> 8) & 0xff}.${num & 0xff}`;
    }
  }
  // Decimal-encoded IPv4: 2130706433
  if (/^\d+$/.test(hostname) && hostname.length > 3) {
    const num = parseInt(hostname, 10);
    if (num >= 0 && num <= 0xffffffff) {
      return `${(num >>> 24) & 0xff}.${(num >>> 16) & 0xff}.${(num >>> 8) & 0xff}.${num & 0xff}`;
    }
  }
  return null;
}

/** Check if an IPv6 address is private/reserved. */
function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  // IPv4-mapped IPv6 — ::ffff:a.b.c.d
  const v4Mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isBlockedIPv4(v4Mapped[1]);
  // fc00::/7 (unique local) — starts with fc or fd
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // fe80::/10 (link-local)
  if (lower.startsWith('fe80')) return true;
  return false;
}

/** Strip HTML tags from a string. */
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);

  constructor(
    @InjectModel('Message', 'nexora_chat') private messageModel: Model<IMessage>,
  ) {}

  /**
   * Extract URLs from message content, fetch OG metadata for each (max 3),
   * and update the message document with the results.
   * Designed to be called fire-and-forget so it never blocks message delivery.
   */
  async fetchAndAttachPreviews(messageId: string, content: string): Promise<void> {
    try {
      const previews = await this.fetchLinkPreviews(content);
      if (previews.length === 0) return;

      await this.messageModel.findByIdAndUpdate(messageId, {
        $set: { linkPreviews: previews },
      });
    } catch (err) {
      this.logger.error(`Failed to attach link previews for message ${messageId}: ${err.message}`);
    }
  }

  /**
   * Extract URLs and return Open Graph metadata for up to MAX_PREVIEWS links.
   */
  async fetchLinkPreviews(content: string): Promise<ILinkPreview[]> {
    if (!content) return [];

    const urls = this.extractUrls(content);
    if (urls.length === 0) return [];

    const results = await Promise.allSettled(
      urls.map((url) => this.fetchOgMetadata(url)),
    );

    const previews: ILinkPreview[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        previews.push(result.value);
      }
    }

    return previews;
  }

  /**
   * Extract unique URLs from text content, limited to MAX_PREVIEWS.
   */
  private extractUrls(content: string): string[] {
    // Strip HTML tags first so we match raw URLs, not href attributes
    const plainText = content.replace(/<[^>]*>/g, ' ');
    const matches = plainText.match(URL_REGEX);
    if (!matches) return [];

    const unique = [...new Set(matches)];
    return unique.slice(0, MAX_PREVIEWS);
  }

  // ─── SSRF-001: Private IP validation ─────────────────────────────────

  /**
   * Validate that a URL targets a public host, not a private/reserved IP.
   * Returns true if the URL is safe to fetch, false otherwise.
   */
  async validateUrl(url: string): Promise<boolean> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }

    // Only allow http and https schemes
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname;

    // Check hex-encoded or decimal-encoded IP representations
    const decodedIp = normalizeIpRepresentation(hostname);
    if (decodedIp && isBlockedIPv4(decodedIp)) {
      return false;
    }

    // If hostname is already an IPv4 literal, check directly
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return !isBlockedIPv4(hostname);
    }

    // If hostname is an IPv6 literal (bracket-stripped by URL parser)
    if (hostname.includes(':')) {
      return !isBlockedIPv6(hostname);
    }

    // Resolve hostname via DNS and check all returned IPs
    try {
      const addresses = await dns.promises.resolve4(hostname);
      for (const addr of addresses) {
        if (isBlockedIPv4(addr)) {
          return false;
        }
      }
    } catch {
      // DNS resolution failed — block the request
      return false;
    }

    // Also check IPv6 records
    try {
      const addresses = await dns.promises.resolve6(hostname);
      for (const addr of addresses) {
        if (isBlockedIPv6(addr)) {
          return false;
        }
      }
    } catch {
      // No AAAA records is fine — only fail if v4 also failed (handled above)
    }

    return true;
  }

  // ─── Core fetch with SSRF-002: manual redirect handling ──────────────

  /**
   * Fetch a page and parse Open Graph tags from its HTML <head>.
   */
  private async fetchOgMetadata(url: string): Promise<ILinkPreview | null> {
    try {
      // SSRF-001: validate URL before fetching
      const isSafe = await this.validateUrl(url);
      if (!isSafe) {
        this.logger.warn(`Blocked SSRF attempt or private IP for URL: ${url}`);
        return null;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let response: Response;
      let currentUrl = url;
      let redirectsFollowed = 0;

      try {
        // SSRF-002: manual redirect handling with validation
        while (true) {
          response = await fetch(currentUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'NexoraBot/1.0 (+https://nexora.app)',
              Accept: 'text/html, application/xhtml+xml',
            },
            redirect: 'manual',
          });

          // Handle redirects manually
          if ([301, 302, 307, 308].includes(response.status)) {
            if (redirectsFollowed >= MAX_REDIRECTS) {
              this.logger.warn(`Too many redirects for URL: ${url}`);
              return null;
            }

            const location = response.headers.get('location');
            if (!location) return null;

            // Resolve relative redirects against the current URL
            const redirectUrl = new URL(location, currentUrl).toString();

            // SSRF-001: validate redirect target
            const redirectSafe = await this.validateUrl(redirectUrl);
            if (!redirectSafe) {
              this.logger.warn(`Blocked SSRF redirect to private IP: ${redirectUrl} (from ${url})`);
              return null;
            }

            currentUrl = redirectUrl;
            redirectsFollowed++;
            continue;
          }

          break;
        }
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) return null;

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        return null;
      }

      // RESOURCE-001: always use streaming path regardless of Content-Length header
      const html = await this.readLimitedBody(response, MAX_HTML_BYTES);
      if (!html) return null;

      return this.parseOgTags(currentUrl, html);
    } catch (err) {
      // Network errors, timeouts, aborts — all swallowed intentionally
      this.logger.debug(`OG fetch failed for ${url}: ${err.message}`);
      return null;
    }
  }

  /**
   * Read at most `maxBytes` from a response body using streaming.
   * RESOURCE-001: always streams to prevent memory exhaustion from spoofed Content-Length.
   */
  private async readLimitedBody(response: Response, maxBytes: number): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) return '';

    const decoder = new TextDecoder();
    let result = '';
    let bytesRead = 0;

    try {
      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.length;
        result += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.cancel().catch(() => {});
    }

    return result;
  }

  /**
   * Parse Open Graph meta tags from HTML. Falls back to <title> if no OG title found.
   * XSS-001 / XSS-002: sanitizes all extracted values.
   */
  private parseOgTags(url: string, html: string): ILinkPreview | null {
    const ogTitle = this.getMetaContent(html, 'og:title');
    const ogDescription = this.getMetaContent(html, 'og:description');
    const ogImage = this.getMetaContent(html, 'og:image');
    const ogSiteName = this.getMetaContent(html, 'og:site_name');

    // Fallback to <title> tag
    const rawTitle = ogTitle || this.getTitleTag(html);

    // Fallback description from meta description
    const rawDescription = ogDescription || this.getMetaContent(html, 'description');

    if (!rawTitle && !rawDescription) return null;

    // XSS-001: strip HTML tags from all metadata values
    const title = rawTitle ? stripHtmlTags(rawTitle) : undefined;
    const description = rawDescription ? stripHtmlTags(rawDescription) : undefined;
    const siteName = ogSiteName ? stripHtmlTags(ogSiteName) : undefined;

    // XSS-001: validate imageUrl starts with https://
    let imageUrl: string | undefined;
    if (ogImage) {
      const sanitizedImage = stripHtmlTags(ogImage).trim();
      imageUrl = sanitizedImage.startsWith('https://') ? sanitizedImage : undefined;
    }

    return {
      url,
      // XSS-002: cap title to 200 chars and siteName to 100 chars
      title: title ? title.slice(0, 200) : undefined,
      description: description ? description.slice(0, 300) : undefined,
      imageUrl,
      siteName: siteName ? siteName.slice(0, 100) : undefined,
      fetchedAt: new Date(),
    };
  }

  /**
   * Extract content from a <meta> tag by property or name attribute.
   */
  private getMetaContent(html: string, property: string): string | null {
    // Match both property="..." and name="..." patterns
    const regex = new RegExp(
      `<meta[^>]*(?:property|name)=["']${this.escapeRegex(property)}["'][^>]*content=["']([^"']*)["']` +
      `|<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${this.escapeRegex(property)}["']`,
      'i',
    );
    const match = html.match(regex);
    if (!match) return null;
    const value = (match[1] || match[2] || '').trim();
    return value || null;
  }

  /**
   * Extract content of the <title> tag.
   */
  private getTitleTag(html: string): string | null {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match ? match[1].trim() || null : null;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
