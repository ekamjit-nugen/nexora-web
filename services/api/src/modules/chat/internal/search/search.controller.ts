import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { FeatureGuard } from '../../../../bootstrap/auth/feature.guard';
@Controller('chat/search')
@UseGuards(JwtAuthGuard, FeatureGuard)
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async globalSearch(
    @Query('q') q: string,
    @Query('from') from: string,
    @Query('in') inConv: string,
    @Query('has') has: string,
    @Query('before') before: string,
    @Query('after') after: string,
    @Query('type') type: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Req() req,
  ) {
    const result = await this.searchService.globalSearch(
      req.user.userId,
      { q: q || '', from, in: inConv, has, before, after, type },
      parseInt(page || '1'),
      parseInt(limit || '20'),
    );
    return {
      success: true,
      data: result.results,
      pagination: {
        page: parseInt(page || '1'),
        limit: parseInt(limit || '20'),
        total: result.total,
        pages: Math.ceil(result.total / parseInt(limit || '20')),
      },
    };
  }
}
