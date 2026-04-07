import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(['text', 'file', 'image', 'video', 'audio', 'code', 'system'])
  type?: string;

  @IsOptional()
  @IsString()
  replyTo?: string;

  @IsOptional()
  @IsString()
  threadId?: string;
}

export class EditMessageDto {
  @IsString()
  content: string;
}

export class MessageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class SearchMessageDto {
  @IsString()
  q: string;
}
