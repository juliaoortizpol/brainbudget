import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  relationCode?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsEnum(['expense', 'income'])
  @IsNotEmpty()
  type!: string;

  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}
