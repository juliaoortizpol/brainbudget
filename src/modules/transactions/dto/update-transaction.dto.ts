import { PartialType } from '@nestjs/mapped-types';
import { CreateTransactionDto } from './create-transaction.dto';
import { IsBoolean, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateTransactionDto extends PartialType(CreateTransactionDto, {
  skipNullProperties: false,
}) {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  rememberMerchant?: boolean;

  @ValidateIf(
    (dto: UpdateTransactionDto) =>
      dto.rememberMerchant === true || dto.merchantKeyword !== undefined,
  )
  @IsString()
  @MaxLength(256)
  merchantKeyword?: string;
}
