import { Controller, Post, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { PWAService } from './pwa.service';

@Controller('api/v1/pwa')
export class PWAController {
  constructor(private readonly pwaService: PWAService) {}

  /**
   * Create PWA configuration
   */
  @Post('config')
  async createPWAConfig(@Body() body: any) {
    return this.pwaService.createPWAConfig(body.productId, body);
  }

  /**
   * Get PWA configuration
   */
  @Get('config/:productId')
  async getPWAConfig(@Param('productId') productId: string) {
    return this.pwaService.getPWAConfig(productId);
  }

  /**
   * Update PWA configuration
   */
  @Put('config/:productId')
  async updatePWAConfig(@Param('productId') productId: string, @Body() body: any) {
    return this.pwaService.updatePWAConfig(productId, body);
  }

  /**
   * Generate manifest.json
   */
  @Get('manifest/:productId')
  async generateManifest(@Param('productId') productId: string) {
    return this.pwaService.generateManifest(productId);
  }

  /**
   * Store offline data
   */
  @Post('offline/store')
  async storeOfflineData(@Body() body: any) {
    return this.pwaService.storeOfflineData(
      body.productId,
      body.userId,
      body.resourceType,
      body.resourceId,
      body.data,
    );
  }

  /**
   * Get user offline data
   */
  @Get('offline/user/:productId/:userId')
  async getUserOfflineData(
    @Param('productId') productId: string,
    @Param('userId') userId: string,
  ) {
    return this.pwaService.getUserOfflineData(productId, userId);
  }

  /**
   * Sync offline data
   */
  @Post('offline/sync')
  async syncOfflineData(@Body() body: any) {
    return this.pwaService.syncOfflineData(body.productId, body.userId);
  }

  /**
   * Get offline conflicts
   */
  @Get('offline/conflicts/:productId/:userId')
  async getOfflineConflicts(
    @Param('productId') productId: string,
    @Param('userId') userId: string,
  ) {
    return this.pwaService.getOfflineConflicts(productId, userId);
  }

  /**
   * Resolve offline conflict
   */
  @Post('offline/conflicts/resolve/:storeId')
  async resolveConflict(
    @Param('storeId') storeId: string,
    @Body() body: any,
  ) {
    return this.pwaService.resolveConflict(storeId, body.resolvedData);
  }

  /**
   * Cache API response
   */
  @Post('cache/store')
  async cacheResponse(@Body() body: any) {
    return this.pwaService.cacheResponse(
      body.productId,
      body.cacheKey,
      body.urls,
      body.contentType,
    );
  }

  /**
   * Get cache size
   */
  @Get('cache/size/:productId')
  async getCacheSize(@Param('productId') productId: string) {
    const size = await this.pwaService.getCacheSize(productId);
    return { productId, cacheSizeBytes: size };
  }

  /**
   * Clear cache
   */
  @Delete('cache/clear/:productId')
  async clearCache(@Param('productId') productId: string) {
    await this.pwaService.clearCache(productId);
    return { success: true };
  }

  /**
   * Get service worker code
   */
  @Get('service-worker')
  async getServiceWorkerCode() {
    return { code: this.pwaService.generateServiceWorkerCode() };
  }

  /**
   * Get PWA metrics
   */
  @Get('metrics/:productId')
  async getPWAMetrics(@Param('productId') productId: string) {
    return this.pwaService.getPWAMetrics(productId);
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'pwa' };
  }
}
