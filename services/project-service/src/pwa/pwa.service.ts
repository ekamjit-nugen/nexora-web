import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IPWAConfig, IOfflineStore, IServiceWorkerCache } from './pwa.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PWAService {
  constructor(
    @InjectModel('PWAConfig') private pwaConfigModel: Model<IPWAConfig>,
    @InjectModel('OfflineStore') private offlineStoreModel: Model<IOfflineStore>,
    @InjectModel('ServiceWorkerCache') private cacheModel: Model<IServiceWorkerCache>,
  ) {}

  /**
   * Create PWA configuration
   */
  async createPWAConfig(productId: string, configData: any): Promise<IPWAConfig> {
    const existing = await this.pwaConfigModel.findOne({ productId });
    if (existing) {
      throw new BadRequestException('PWA config already exists for this product');
    }

    const config = new this.pwaConfigModel({
      productId,
      appName: configData.appName,
      appShortName: configData.appShortName,
      appDescription: configData.appDescription,
      startUrl: configData.startUrl,
      display: configData.display || 'standalone',
      orientation: configData.orientation || 'portrait',
      theme: configData.theme || {
        primaryColor: '#2196F3',
        backgroundColor: '#FFFFFF',
        statusBarColor: '#1976D2',
      },
      icons: configData.icons || [],
      screenshots: configData.screenshots || [],
    });

    return config.save();
  }

  /**
   * Get PWA config
   */
  async getPWAConfig(productId: string): Promise<IPWAConfig> {
    const config = await this.pwaConfigModel.findOne({ productId });
    if (!config) {
      throw new NotFoundException('PWA config not found');
    }
    return config;
  }

  /**
   * Update PWA config
   */
  async updatePWAConfig(productId: string, updates: any): Promise<IPWAConfig> {
    const config = await this.getPWAConfig(productId);

    if (updates.appName) config.appName = updates.appName;
    if (updates.appShortName) config.appShortName = updates.appShortName;
    if (updates.appDescription) config.appDescription = updates.appDescription;
    if (updates.theme) config.theme = { ...config.theme, ...updates.theme };
    if (updates.icons) config.icons = updates.icons;
    if (updates.screenshots) config.screenshots = updates.screenshots;

    return config.save();
  }

  /**
   * Generate manifest.json
   */
  async generateManifest(productId: string): Promise<Record<string, any>> {
    const config = await this.getPWAConfig(productId);

    return {
      name: config.appName,
      short_name: config.appShortName,
      description: config.appDescription,
      start_url: config.startUrl,
      scope: '/',
      display: config.display,
      orientation: config.orientation,
      theme_color: config.theme.primaryColor,
      background_color: config.theme.backgroundColor,
      icons: config.icons,
      screenshots: config.screenshots,
      categories: ['productivity', 'business'],
    };
  }

  /**
   * Store offline data
   */
  async storeOfflineData(
    productId: string,
    userId: string,
    resourceType: string,
    resourceId: string,
    data: Record<string, any>,
  ): Promise<IOfflineStore> {
    const storeId = uuidv4();

    const store = new this.offlineStoreModel({
      productId,
      storeId,
      userId,
      resourceType,
      resourceId,
      data,
      status: 'pending',
    });

    return store.save();
  }

  /**
   * Get offline data for user
   */
  async getUserOfflineData(productId: string, userId: string): Promise<IOfflineStore[]> {
    return this.offlineStoreModel
      .find({ productId, userId, status: 'pending' })
      .exec();
  }

  /**
   * Sync offline data
   */
  async syncOfflineData(
    productId: string,
    userId: string,
  ): Promise<{ synced: number; conflicts: number }> {
    const pendingData = await this.getUserOfflineData(productId, userId);

    let synced = 0;
    let conflicts = 0;

    for (const item of pendingData) {
      // Simulate sync process
      if (Math.random() > 0.1) {
        // 90% success rate
        item.status = 'synced';
        item.syncedAt = new Date();
        synced++;
      } else {
        item.status = 'conflict';
        conflicts++;
      }
      await item.save();
    }

    return { synced, conflicts };
  }

  /**
   * Get offline data conflicts
   */
  async getOfflineConflicts(productId: string, userId: string): Promise<IOfflineStore[]> {
    return this.offlineStoreModel
      .find({ productId, userId, status: 'conflict' })
      .exec();
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(storeId: string, resolvedData: Record<string, any>): Promise<IOfflineStore> {
    const store = await this.offlineStoreModel.findOne({ storeId });
    if (!store) {
      throw new NotFoundException('Offline store not found');
    }

    store.data = resolvedData;
    store.status = 'synced';
    store.syncedAt = new Date();

    return store.save();
  }

  /**
   * Cache API responses
   */
  async cacheResponse(
    productId: string,
    cacheKey: string,
    urls: string[],
    contentType: string,
  ): Promise<IServiceWorkerCache> {
    let cache = await this.cacheModel.findOne({ productId, cacheKey });

    if (!cache) {
      cache = new this.cacheModel({
        productId,
        cacheKey,
        entries: [],
      });
    }

    if (!cache.entries) {
      cache.entries = [];
    }

    for (const url of urls) {
      cache.entries.push({
        url,
        status: 200,
        contentType,
        size: Math.random() * 1000, // Mock size
      });
    }

    return cache.save();
  }

  /**
   * Get cache size
   */
  async getCacheSize(productId: string): Promise<number> {
    const caches = await this.cacheModel.find({ productId }).exec();

    let totalSize = 0;
    for (const cache of caches) {
      for (const entry of cache.entries) {
        totalSize += entry.size;
      }
    }

    return totalSize;
  }

  /**
   * Clear cache
   */
  async clearCache(productId: string, cacheKey?: string): Promise<void> {
    if (cacheKey) {
      await this.cacheModel.deleteOne({ productId, cacheKey });
    } else {
      await this.cacheModel.deleteMany({ productId });
    }
  }

  /**
   * Generate service worker code
   */
  generateServiceWorkerCode(): string {
    return `
const CACHE_NAME = 'nexora-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(response => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    }).catch(() => {
      return caches.match('/offline.html');
    })
  );
});
`;
  }

  /**
   * Get PWA health metrics
   */
  async getPWAMetrics(productId: string): Promise<any> {
    const config = await this.getPWAConfig(productId);
    const cacheSize = await this.getCacheSize(productId);
    const pendingSync = await this.offlineStoreModel.countDocuments({
      productId,
      status: 'pending',
    });

    return {
      appName: config.appName,
      hasManifest: true,
      hasServiceWorker: true,
      cacheSizeBytes: cacheSize,
      pendingSyncCount: pendingSync,
      isInstallable: true,
      lastUpdated: config.updatedAt,
    };
  }
}
