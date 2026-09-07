import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  API_ERROR_CODES,
  responseWithCode,
  type ApiErrorCode,
} from './api-errors.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();

    if (exception instanceof HttpException) {
      const coded = responseWithCode(exception);
      if (coded) {
        response.status(exception.getStatus()).json({
          statusCode: coded.statusCode,
          error: httpErrorName(exception.getStatus()),
          code: coded.code,
          message: coded.message,
          ...(coded.details ? { details: coded.details } : {}),
        });
        return;
      }

      const mapped = mapHttpException(exception);
      response.status(exception.getStatus()).json({
        statusCode: exception.getStatus(),
        error: httpErrorName(exception.getStatus()),
        code: mapped.code,
        message: mapped.message,
        ...(mapped.details ? { details: mapped.details } : {}),
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred.',
    });
  }
}

function httpErrorName(status: number): string {
  const name = HttpStatus[status];
  if (!name) return 'Error';
  return name
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function mapHttpException(exception: HttpException): {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
} {
  const status = exception.getStatus();
  const body = exception.getResponse();
  const rawMessage = typeof body === 'string'
    ? body
    : typeof body === 'object' && body !== null && 'message' in body
      ? (body as { message?: unknown }).message
      : undefined;

  if (status === HttpStatus.BAD_REQUEST && Array.isArray(rawMessage)) {
    return {
      code: API_ERROR_CODES.VALIDATION_INVALID_BODY,
      message: 'Request validation failed.',
      details: { messages: rawMessage.filter((value): value is string => typeof value === 'string') },
    };
  }

  const message = typeof rawMessage === 'string' ? rawMessage : 'Request failed.';
  return { code: codeFor(status, message), message };
}

function codeFor(status: number, message: string): ApiErrorCode {
  const normalized = message.toLowerCase();
  if (status === HttpStatus.UNAUTHORIZED) {
    if (normalized.includes('expired')) return API_ERROR_CODES.EXPIRED_REFRESH_TOKEN;
    if (normalized.includes('already been rotated')) return API_ERROR_CODES.REUSED_REFRESH_TOKEN;
    if (normalized.includes('email or password')) return API_ERROR_CODES.INVALID_CREDENTIALS;
    return API_ERROR_CODES.INVALID_REFRESH_TOKEN;
  }
  if (status === HttpStatus.FORBIDDEN) {
    if (normalized.includes('role')) return API_ERROR_CODES.UNAUTHORIZED_WRITE_ROLE;
    return API_ERROR_CODES.UNAUTHORIZED_MEMBERSHIP;
  }
  if (status === HttpStatus.NOT_FOUND) {
    if (normalized.includes('porbase') || normalized.includes('record found')) {
      return API_ERROR_CODES.PORBASE_RECORD_NOT_FOUND;
    }
    if (normalized.includes('organization')) return API_ERROR_CODES.ORGANIZATION_NOT_FOUND;
    if (normalized.includes('edition')) return API_ERROR_CODES.EDITION_NOT_FOUND;
    return API_ERROR_CODES.RESOURCE_NOT_FOUND;
  }
  if (status === HttpStatus.CONFLICT) {
    if (normalized.includes('organization') && normalized.includes('delet')) return API_ERROR_CODES.ORGANIZATION_DELETE_CONFLICT;
    if (normalized.includes('external identifier')) return API_ERROR_CODES.DUPLICATE_EXTERNAL_IDENTIFIER;
    return API_ERROR_CODES.DUPLICATE_EDITION;
  }
  if (status === HttpStatus.BAD_REQUEST) {
    if (normalized.includes('isbn')) return API_ERROR_CODES.INVALID_ISBN;
    if (normalized.includes('cursor') || normalized.includes('limit')) return API_ERROR_CODES.INVALID_CURSOR_OR_LIMIT;
    if (normalized.includes('date')) return API_ERROR_CODES.INVALID_BIBLIOGRAPHIC_DATE;
  }
  if (status === HttpStatus.SERVICE_UNAVAILABLE) return API_ERROR_CODES.PORBASE_TIMEOUT;
  if (status === HttpStatus.BAD_GATEWAY) {
    if (normalized.includes('invalid xml') || normalized.includes('invalid')) return API_ERROR_CODES.PORBASE_INVALID_RESPONSE;
    return API_ERROR_CODES.PORBASE_UNAVAILABLE;
  }
  return API_ERROR_CODES.INTERNAL_ERROR;
}
