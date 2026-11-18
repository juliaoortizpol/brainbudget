import { Equals, IsDateString, Matches, ValidateIf } from 'class-validator';

export class ClosePreviewDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsDateString({ strict: true })
  actualCutoffDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  closeThroughDate?: string;
}

export class ConfirmCloseDto {
  @Equals(true)
  confirmed!: boolean;

  @IsDateString({ strict: true })
  actualCutoffDate!: string;

  @Matches(/^[a-f0-9]{64}$/)
  previewToken!: string;
}
