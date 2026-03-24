import { HttpException, HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from './error-codes';

export class ApiException extends HttpException {
  constructor(
    public readonly errorCode: ERROR_CODES,
    message: string,
    status: HttpStatus,
    data?: Record<string, unknown>,
  ) {
    super(
      {
        ok: false,
        errorCode,
        message,
        data: data || null,
      },
      status,
    );
  }
}
