import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsMongoId,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateTransactionDto {
  @IsMongoId()
  @IsOptional()
  accountId?: string;

  @IsMongoId()
  @IsOptional()
  budgetItemId?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount!: number;

  @IsEnum(['expense', 'income'])
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsOptional()
  relationCode?: string;

  @IsDateString()
  @IsNotEmpty()
  date!: Date;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(['matched', 'needs_review', 'manual'])
  @IsNotEmpty()
  matchingStatus!: 'matched' | 'needs_review' | 'manual';

  @IsEnum(['rule', 'suggestion', 'manual'])
  @IsOptional()
  matchingSource?: 'rule' | 'suggestion' | 'manual';

  @IsNumber()
  @IsOptional()
  matchingConfidence?: number;

  @IsString()
  @IsOptional()
  rawDescription?: string;

  @IsString()
  @IsOptional()
  normalizedMerchant?: string;
}
