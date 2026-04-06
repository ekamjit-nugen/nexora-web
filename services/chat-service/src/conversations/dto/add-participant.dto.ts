import { IsArray, IsString, IsOptional } from 'class-validator';

export class AddParticipantsDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}

export class ConvertToGroupDto {
  @IsArray()
  @IsString({ each: true })
  memberIds: string[];

  @IsOptional()
  @IsString()
  groupName?: string;
}
