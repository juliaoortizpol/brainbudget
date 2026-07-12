import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsMongoId,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateAccountDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsMongoId()
  institutionId?: string | null;

  @IsOptional()
  @IsEnum([
    'checking',
    'savings',
    'credit_card',
    'investment',
    'loan',
    'brokerage',
    'retirement',
    'other',
  ])
  type?: string;

  @IsOptional()
  @IsNumber()
  maxBalance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4)
  last4Digits?: string;

  @IsOptional()
  @IsEnum(['active', 'pending', 're_auth_required'])
  status?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
