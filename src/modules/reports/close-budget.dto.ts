import { Equals, IsDateString, Matches, ValidateIf } from 'class-validator';

const instant =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export class ClosePreviewDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsDateString({ strict: true, strictSeparator: true })
  @Matches(instant, {
    message: 'Use an ISO instant with an explicit UTC offset',
  })
  actualCutoffDate?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  closeThroughDate?: string;
}

export class ConfirmCloseDto {
  @Equals(true)
  confirmed!: boolean;

  @IsDateString({ strict: true, strictSeparator: true })
  @Matches(instant, {
    message: 'Use an ISO instant with an explicit UTC offset',
  })
  actualCutoffDate!: string;

  @Matches(/^[a-f0-9]{64}$/)
  previewToken!: string;
}
