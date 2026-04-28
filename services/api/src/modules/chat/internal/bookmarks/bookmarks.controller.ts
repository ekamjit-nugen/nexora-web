import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsString, IsOptional } from 'class-validator';

class CreateBookmarkDto {
  @IsString() messageId: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() note?: string;
}

class UpdateBookmarkDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() note?: string;
}

@Controller('chat/bookmarks')
@UseGuards(JwtAuthGuard)
export class BookmarksController {
  constructor(private bookmarksService: BookmarksService) {}

  @Get()
  async getBookmarks(@Req() req) {
    const bookmarks = await this.bookmarksService.getBookmarks(req.user.userId, req.user.organizationId);
    return { success: true, data: bookmarks };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async saveBookmark(@Body() dto: CreateBookmarkDto, @Req() req) {
    const bookmark = await this.bookmarksService.saveBookmark(
      req.user.userId, dto.messageId, req.user.organizationId, dto.label, dto.note,
    );
    return { success: true, message: 'Bookmark saved', data: bookmark };
  }

  @Put(':id')
  async updateBookmark(@Param('id') id: string, @Body() dto: UpdateBookmarkDto, @Req() req) {
    const bookmark = await this.bookmarksService.updateBookmark(id, req.user.userId, dto.label, dto.note);
    return { success: true, message: 'Bookmark updated', data: bookmark };
  }

  @Delete(':id')
  async removeBookmark(@Param('id') id: string, @Req() req) {
    await this.bookmarksService.removeBookmark(id, req.user.userId);
    return { success: true, message: 'Bookmark removed' };
  }
}
