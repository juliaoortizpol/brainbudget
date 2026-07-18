import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class TransactionMailImportOptionsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  newerThanDays: number = 30;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxPages: number = 5;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 50;
}
