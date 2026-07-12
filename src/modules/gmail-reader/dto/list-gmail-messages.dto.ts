import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListGmailMessagesDto {
  @IsOptional()
  @IsString()
  query: string = 'newer_than:7d';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxResults: number = 25;

  @IsOptional()
  @IsString()
  pageToken?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeBody: boolean = true;
}
