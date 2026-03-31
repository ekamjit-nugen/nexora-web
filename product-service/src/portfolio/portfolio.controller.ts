import { Controller, Post, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { IPortfolioProduct } from './portfolio.model';

@Controller('api/v1/portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  /**
   * Create portfolio
   */
  @Post()
  async createPortfolio(@Body() body: any) {
    return this.portfolioService.createPortfolio(body.organizationId, {
      name: body.name,
      description: body.description,
      managers: body.managers,
    });
  }

  /**
   * Get portfolio
   */
  @Get(':id')
  async getPortfolio(@Param('id') id: string) {
    return this.portfolioService.getPortfolio(id);
  }

  /**
   * Get organization portfolio
   */
  @Get('organization/:organizationId')
  async getOrganizationPortfolio(@Param('organizationId') organizationId: string) {
    return this.portfolioService.getOrganizationPortfolio(organizationId);
  }

  /**
   * Add product
   */
  @Post(':id/products')
  async addProduct(@Param('id') id: string, @Body() product: IPortfolioProduct) {
    return this.portfolioService.addProduct(id, product);
  }

  /**
   * Update product
   */
  @Put(':id/products/:productId')
  async updateProduct(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() updates: any,
  ) {
    return this.portfolioService.updateProduct(id, productId, updates);
  }

  /**
   * Remove product
   */
  @Delete(':id/products/:productId')
  async removeProduct(@Param('id') id: string, @Param('productId') productId: string) {
    return this.portfolioService.removeProduct(id, productId);
  }

  /**
   * Get statistics
   */
  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    return this.portfolioService.getPortfolioStats(id);
  }

  /**
   * Update portfolio
   */
  @Put(':id')
  async updatePortfolio(@Param('id') id: string, @Body() body: any) {
    return this.portfolioService.updatePortfolio(id, body);
  }

  /**
   * Delete portfolio
   */
  @Delete(':id')
  async deletePortfolio(@Param('id') id: string) {
    await this.portfolioService.deletePortfolio(id);
    return { success: true };
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'portfolio' };
  }
}
