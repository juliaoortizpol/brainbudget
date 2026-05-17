import { IsNotEmpty, IsString, IsNumber, IsMongoId, IsOptional, IsEnum, IsDateString, Min } from 'class-validator';

export class CreateTransactionDto {
  @IsMongoId()
  @IsNotEmpty()
  accountId!: string;

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
}
