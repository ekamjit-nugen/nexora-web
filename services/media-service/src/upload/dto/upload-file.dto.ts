import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UploadFileDto {
  @IsOptional() @IsString() conversationId?: string;
  @IsOptional() @IsString() messageId?: string;
  @IsOptional() @IsEnum(['conversation', 'org', 'public']) accessLevel?: string;
}
