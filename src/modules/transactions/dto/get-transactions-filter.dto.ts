import {
  IsOptional,
  IsMongoId,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetTransactionsFilterDto {
  @IsOptional()
  @IsMongoId()
  budgetId?: string;

  @IsOptional()
  @IsMongoId()
  accountId?: string;

  @IsOptional()
  @IsMongoId()
  budgetItemId?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;

  @IsOptional()
  @IsEnum(['expense', 'income'])
  type?: string;

  @IsOptional()
  @IsEnum(['needs_review'])
  matchingStatus?: 'needs_review';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
