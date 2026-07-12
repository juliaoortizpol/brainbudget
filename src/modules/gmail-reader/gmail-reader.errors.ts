import { HttpException, HttpStatus } from '@nestjs/common';

export enum GmailReaderErrorCode {
  NOT_CONNECTED = 'GMAIL_NOT_CONNECTED',
  REAUTH_REQUIRED = 'GMAIL_REAUTH_REQUIRED',
  MESSAGE_NOT_FOUND = 'GMAIL_MESSAGE_NOT_FOUND',
  TEMPORARILY_UNAVAILABLE = 'GMAIL_TEMPORARILY_UNAVAILABLE',
}

export class GmailReaderException extends HttpException {
  constructor(
    public readonly code: GmailReaderErrorCode,
    message: string,
    status: HttpStatus,
  ) {
    super(
      {
        statusCode: status,
        code,
        message,
        error: HttpStatus[status],
      },
      status,
    );
  }
}
