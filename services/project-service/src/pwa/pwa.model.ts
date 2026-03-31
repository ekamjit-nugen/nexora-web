import { Schema, Document } from 'mongoose';

export interface IPWAConfig extends Document {
  productId: string;
  appName: string;
  appShortName: string;
  appDescription: string;
  startUrl: string;
  display: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser';
  orientation: 'portrait' | 'landscape' | 'portrait-primary' | 'landscape-primary';
  theme: {
    primaryColor: string;
    backgroundColor: string;
    statusBarColor: string;
  };
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose: string;
  }>;
  screenshots: Array<{
    src: string;
    sizes: string;
    type: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IOfflineStore extends Document {
  productId: string;
  storeId: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  data: Record<string, any>;
  status: 'pending' | 'synced' | 'conflict';
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IServiceWorkerCache extends Document {
  productId: string;
  cacheKey: string;
  entries: Array<{
    url: string;
    status: number;
    contentType: string;
    size: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export const PWAConfigSchema = new Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    appName: String,
    appShortName: String,
    appDescription: String,
    startUrl: String,
    display: { type: String, enum: ['fullscreen', 'standalone', 'minimal-ui', 'browser'] },
    orientation: {
      type: String,
      enum: ['portrait', 'landscape', 'portrait-primary', 'landscape-primary'],
    },
    theme: {
      primaryColor: String,
      backgroundColor: String,
      statusBarColor: String,
    },
    icons: [
      {
        src: String,
        sizes: String,
        type: String,
        purpose: String,
      },
    ],
    screenshots: [
      {
        src: String,
        sizes: String,
        type: String,
      },
    ],
  },
  { timestamps: true },
);

export const OfflineStoreSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    storeId: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    resourceType: String,
    resourceId: String,
    data: Schema.Types.Mixed,
    status: { type: String, enum: ['pending', 'synced', 'conflict'], default: 'pending' },
    syncedAt: Date,
  },
  { timestamps: true },
);

export const ServiceWorkerCacheSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    cacheKey: { type: String, required: true },
    entries: [
      {
        url: String,
        status: Number,
        contentType: String,
        size: Number,
      },
    ],
  },
  { timestamps: true },
);

OfflineStoreSchema.index({ productId: 1, userId: 1 });
ServiceWorkerCacheSchema.index({ productId: 1, cacheKey: 1 });
