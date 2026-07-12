import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  SUPPORTED_ACCOUNT_TYPES,
  SupportedAccountType,
} from '../institution.constants';

export class CreateInstitutionEmailRuleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEmail({}, { each: true })
  senderAddresses!: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  subjectKeywords: string[] = [];

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/)
  parserKey!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  parserVersion: number = 1;

  @IsEnum(SUPPORTED_ACCOUNT_TYPES)
  accountType!: SupportedAccountType;

  @IsOptional()
  @IsBoolean()
  enabled: boolean = true;
}

export class CreateInstitutionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  aliases: string[] = [];

  @IsArray()
  @ArrayUnique()
  @IsEnum(SUPPORTED_ACCOUNT_TYPES, { each: true })
  supportedAccountTypes!: SupportedAccountType[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInstitutionEmailRuleDto)
  emailRules: CreateInstitutionEmailRuleDto[] = [];

  @IsOptional()
  @IsBoolean()
  enabled: boolean = true;
}
