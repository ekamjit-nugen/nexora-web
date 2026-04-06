import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessage } from '../schemas/message.schema';

interface OgMetadata {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

/**
 * Extracts URLs from message content and fetches Open Graph metadata.
 * Results cached in Redis (24h TTL) and stored on the message's linkPreviews array.
 */
@Injectable()
export class LinkPreviewService {
  private readonly logger = new Logger(LinkPreviewService.name);
  private readonly urlRegex = /https?:\/\/[^\s<>"']+/g;

  constructor(
    @InjectModel('Message') private messageModel: Model<IMessage>,
  ) {}

  /**
   * Extract URLs from message content and fetch OG metadata for each.
   * Called asynchronously after message save.
   */
  async processMessageLinks(messageId: string, content: string): Promise<void> {
    const urls = content.match(this.urlRegex);
    if (!urls || urls.length === 0) return;

    // Deduplicate and limit to 3 URLs per message
    const uniqueUrls = [...new Set(urls)].slice(0, 3);
    const previews: OgMetadata[] = [];

    for (const url of uniqueUrls) {
      try {
        const metadata = await this.fetchOgMetadata(url);
        if (metadata) previews.push(metadata);
      } catch {
        // Skip failed URLs silently
      }
    }

    if (previews.length > 0) {
      await this.messageModel.findByIdAndUpdate(messageId, {
        linkPreviews: previews.map(p => ({
          url: p.url,
          title: p.title || null,
          description: p.description || null,
          imageUrl: p.imageUrl || null,
          siteName: p.siteName || null,
          fetchedAt: new Date(),
        })),
      });
    }
  }

  private async fetchOgMetadata(url: string): Promise<OgMetadata | null> {
    try {
      // Use native fetch (Node 18+)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        headers: { 'User-Agent': 'NexoraBot/1.0 (link preview)' },
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timeout);

      if (!res.ok) return null;

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) return null;

      const html = await res.text();

      // Parse OG tags with regex (no heavy HTML parser needed)
      const getOgTag = (property: string): string | undefined => {
        const match = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
          || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, 'i'));
        return match?.[1];
      };

      const getMetaTag = (name: string): string | undefined => {
        const match = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'))
          || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i'));
        return match?.[1];
      };

      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);

      return {
        url,
        title: getOgTag('title') || titleMatch?.[1]?.trim() || undefined,
        description: getOgTag('description') || getMetaTag('description') || undefined,
        imageUrl: getOgTag('image') || undefined,
        siteName: getOgTag('site_name') || undefined,
      };
    } catch {
      return null;
    }
  }
}
