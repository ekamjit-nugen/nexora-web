import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { LinkPreviewService } from './link-preview.service';
import * as dns from 'dns';

// Mock dns module
jest.mock('dns', () => ({
  promises: {
    resolve4: jest.fn(),
    resolve6: jest.fn(),
  },
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

function mockModel() {
  const model: any = jest.fn();
  model.findByIdAndUpdate = jest.fn().mockResolvedValue(undefined);
  return model;
}

describe('LinkPreviewService', () => {
  let service: LinkPreviewService;
  let messageModel: any;

  beforeEach(async () => {
    messageModel = mockModel();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkPreviewService,
        { provide: getModelToken('Message'), useValue: messageModel },
      ],
    }).compile();

    service = module.get<LinkPreviewService>(LinkPreviewService);
  });

  // ── extractUrls (accessed via fetchLinkPreviews) ───────────────────────

  describe('extractUrls (via fetchLinkPreviews)', () => {
    // extractUrls is private, so we test it indirectly through fetchLinkPreviews
    // by mocking fetch to fail and checking which URLs are attempted

    beforeEach(() => {
      // Make validateUrl pass for all public URLs
      (dns.promises.resolve4 as jest.Mock).mockResolvedValue(['1.2.3.4']);
      (dns.promises.resolve6 as jest.Mock).mockRejectedValue(new Error('no AAAA'));
    });

    it('should extract HTTP/HTTPS URLs from content', async () => {
      mockFetch.mockRejectedValue(new Error('network'));

      await service.fetchLinkPreviews('Check https://example.com and http://test.org');

      // Both URLs should have been attempted
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should limit to maximum 3 URLs', async () => {
      mockFetch.mockRejectedValue(new Error('network'));

      await service.fetchLinkPreviews(
        'https://a.com https://b.com https://c.com https://d.com https://e.com',
      );

      // Only 3 should be attempted
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should return empty array for content with no URLs', async () => {
      const result = await service.fetchLinkPreviews('No links here!');
      expect(result).toEqual([]);
    });

    it('should return empty array for empty content', async () => {
      const result = await service.fetchLinkPreviews('');
      expect(result).toEqual([]);
    });
  });

  // ── validateUrl ────────────────────────────────────────────────────────

  describe('validateUrl', () => {
    it('should allow public URLs', async () => {
      (dns.promises.resolve4 as jest.Mock).mockResolvedValue(['93.184.216.34']);
      (dns.promises.resolve6 as jest.Mock).mockRejectedValue(new Error('no AAAA'));

      const result = await service.validateUrl('https://example.com');
      expect(result).toBe(true);
    });

    it('should block 127.0.0.1 (loopback)', async () => {
      const result = await service.validateUrl('http://127.0.0.1:8080/admin');
      expect(result).toBe(false);
    });

    it('should block 10.x.x.x (private)', async () => {
      const result = await service.validateUrl('http://10.0.0.1/internal');
      expect(result).toBe(false);
    });

    it('should block 192.168.x.x (private)', async () => {
      const result = await service.validateUrl('http://192.168.1.1/router');
      expect(result).toBe(false);
    });

    it('should block 169.254.x.x (link-local / AWS metadata)', async () => {
      const result = await service.validateUrl('http://169.254.169.254/latest/meta-data/');
      expect(result).toBe(false);
    });

    it('should block 172.16-31.x.x (private)', async () => {
      const result = await service.validateUrl('http://172.16.0.1/internal');
      expect(result).toBe(false);
    });

    it('should allow 172.32.x.x (public range)', async () => {
      // IP literal — no DNS lookup needed, goes through direct IPv4 check
      const result = await service.validateUrl('http://172.32.0.1/ok');
      expect(result).toBe(true);
    });

    it('should block hostnames that resolve to private IPs', async () => {
      (dns.promises.resolve4 as jest.Mock).mockResolvedValue(['10.0.0.5']);
      (dns.promises.resolve6 as jest.Mock).mockRejectedValue(new Error('no AAAA'));

      const result = await service.validateUrl('https://evil.attacker.com');
      expect(result).toBe(false);
    });

    it('should block when DNS resolution fails', async () => {
      (dns.promises.resolve4 as jest.Mock).mockRejectedValue(new Error('NXDOMAIN'));

      const result = await service.validateUrl('https://nonexistent.example.invalid');
      expect(result).toBe(false);
    });

    it('should reject non-http schemes (ftp)', async () => {
      const result = await service.validateUrl('ftp://files.example.com/data');
      expect(result).toBe(false);
    });

    it('should reject invalid URLs', async () => {
      const result = await service.validateUrl('not-a-url');
      expect(result).toBe(false);
    });

    it('should block IPv6 loopback ::1', async () => {
      const result = await service.validateUrl('http://[::1]:3000/');
      expect(result).toBe(false);
    });

    it('should block hex-encoded IPs (0x7f000001 = 127.0.0.1)', async () => {
      // hostname will be the hex literal; resolve fails but the hex decoder catches it
      const result = await service.validateUrl('http://0x7f000001/');
      expect(result).toBe(false);
    });
  });

  // ── fetchLinkPreviews (OG parsing) ─────────────────────────────────────

  describe('fetchLinkPreviews', () => {
    beforeEach(() => {
      (dns.promises.resolve4 as jest.Mock).mockResolvedValue(['93.184.216.34']);
      (dns.promises.resolve6 as jest.Mock).mockRejectedValue(new Error('no AAAA'));
    });

    it('should parse OG metadata from HTML response', async () => {
      const html = `
        <html><head>
          <meta property="og:title" content="Test Page">
          <meta property="og:description" content="A test description">
          <meta property="og:image" content="https://example.com/img.jpg">
          <meta property="og:site_name" content="Example">
        </head></html>
      `;

      const mockBody = {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({ done: false, value: Buffer.from(html) })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          cancel: jest.fn().mockResolvedValue(undefined),
        }),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/html']]),
        body: mockBody,
      });
      // Patch headers.get for Map-based mock
      const resp = await mockFetch.mock.results?.[0]?.value;

      // Re-mock with proper headers.get
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (key: string) => key === 'content-type' ? 'text/html' : null },
        body: mockBody,
      });

      const results = await service.fetchLinkPreviews('Visit https://example.com');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Test Page');
      expect(results[0].description).toBe('A test description');
      expect(results[0].imageUrl).toBe('https://example.com/img.jpg');
      expect(results[0].siteName).toBe('Example');
    });

    it('should return null for non-HTML content types', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (key: string) => key === 'content-type' ? 'application/json' : null },
        body: null,
      });

      const results = await service.fetchLinkPreviews('Visit https://api.example.com/data.json');
      expect(results).toHaveLength(0);
    });

    it('should handle fetch timeout gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('AbortError'));

      const results = await service.fetchLinkPreviews('Visit https://slow.example.com');
      expect(results).toHaveLength(0);
    });

    it('should strip HTML from OG metadata (XSS sanitization)', async () => {
      const html = `
        <html><head>
          <meta property="og:title" content="<script>alert(1)</script>Safe Title">
          <meta property="og:description" content="<img onerror=hack>Description">
        </head></html>
      `;

      const mockBody = {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({ done: false, value: Buffer.from(html) })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          cancel: jest.fn().mockResolvedValue(undefined),
        }),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (key: string) => key === 'content-type' ? 'text/html' : null },
        body: mockBody,
      });

      const results = await service.fetchLinkPreviews('Visit https://example.com');

      expect(results).toHaveLength(1);
      expect(results[0].title).not.toContain('<script>');
      expect(results[0].description).not.toContain('<img');
    });

    it('should reject non-https image URLs', async () => {
      const html = `
        <html><head>
          <meta property="og:title" content="Page">
          <meta property="og:image" content="http://insecure.com/img.jpg">
        </head></html>
      `;

      const mockBody = {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({ done: false, value: Buffer.from(html) })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          cancel: jest.fn().mockResolvedValue(undefined),
        }),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (key: string) => key === 'content-type' ? 'text/html' : null },
        body: mockBody,
      });

      const results = await service.fetchLinkPreviews('Visit https://example.com');

      expect(results).toHaveLength(1);
      expect(results[0].imageUrl).toBeUndefined();
    });
  });

  // ── fetchAndAttachPreviews ─────────────────────────────────────────────

  describe('fetchAndAttachPreviews', () => {
    it('should update message with link previews', async () => {
      (dns.promises.resolve4 as jest.Mock).mockResolvedValue(['93.184.216.34']);
      (dns.promises.resolve6 as jest.Mock).mockRejectedValue(new Error('no AAAA'));

      const html = `<html><head><title>Test</title></head></html>`;
      const mockBody = {
        getReader: () => ({
          read: jest.fn()
            .mockResolvedValueOnce({ done: false, value: Buffer.from(html) })
            .mockResolvedValueOnce({ done: true, value: undefined }),
          cancel: jest.fn().mockResolvedValue(undefined),
        }),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: (key: string) => key === 'content-type' ? 'text/html' : null },
        body: mockBody,
      });

      await service.fetchAndAttachPreviews('msg-1', 'Check https://example.com');

      expect(messageModel.findByIdAndUpdate).toHaveBeenCalledWith('msg-1', {
        $set: { linkPreviews: expect.arrayContaining([expect.objectContaining({ url: expect.any(String) })]) },
      });
    });

    it('should not update message when no previews are found', async () => {
      await service.fetchAndAttachPreviews('msg-1', 'No links here');

      expect(messageModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});
