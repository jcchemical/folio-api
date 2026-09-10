import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import {
  API_ERROR_CODES,
  responseWithCode,
  type ApiErrorCode,
} from './api-errors.js';
import {
  getErrorHandlingConfig,
  type ErrorHandlingConfig,
} from './error-handling.config.js';
import {
  toSafeErrorDiagnostics,
  type SafeErrorDiagnostics,
} from './safe-error-diagnostics.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  // No ConfigService exists in this app; config is a plain env-derived value, not DI.
  constructor(
    private readonly config: ErrorHandlingConfig = getErrorHandlingConfig(),
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      // Deliberately thrown HttpExceptions are expected control flow; only
      // log the rare ones that still signal a server-side failure (5xx).
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logException(exception, request, status);
      }

      const coded = responseWithCode(exception);
      if (coded) {
        response.status(status).json({
          statusCode: coded.statusCode,
          error: httpErrorName(status),
          code: coded.code,
          message: coded.message,
          ...(coded.details ? { details: coded.details } : {}),
        });
        return;
      }

      const mapped = mapHttpException(exception);
      response.status(status).json({
        statusCode: status,
        error: httpErrorName(status),
        code: mapped.code,
        message: mapped.message,
        ...(mapped.details ? { details: mapped.details } : {}),
      });
      return;
    }

    const prismaMapped = mapPrismaException(exception);
    if (prismaMapped) {
      this.logException(exception, request, prismaMapped.statusCode);
      response
        .status(prismaMapped.statusCode)
        .json(this.withDebug(prismaMapped, exception));
      return;
    }

    this.logException(exception, request, HttpStatus.INTERNAL_SERVER_ERROR);
    const fallback = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred.',
    };
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(this.withDebug(fallback, exception));
  }

  private withDebug<T extends object>(
    body: T,
    exception: unknown,
  ): T & { debug?: SafeErrorDiagnostics } {
    // Fail-closed even if a caller hands in a malformed/inconsistent config.
    if (
      !this.config.includeDebugDetails ||
      this.config.nodeEnv !== 'development'
    ) {
      return body;
    }
    return { ...body, debug: toSafeErrorDiagnostics(exception) };
  }

  private logException(
    exception: unknown,
    request: Request,
    status: number,
  ): void {
    const diagnostics = toSafeErrorDiagnostics(exception);
    this.logger.error(
      `${request?.method ?? 'UNKNOWN'} ${request?.originalUrl ?? request?.url ?? 'UNKNOWN'} -> ${status} [${diagnostics.name ?? 'Error'}] ${diagnostics.message ?? ''}`,
      diagnostics.stack,
    );
  }
}

function mapPrismaException(exception: unknown): {
  statusCode: number;
  error: string;
  code: ApiErrorCode;
  message: string;
} | null {
  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: httpErrorName(HttpStatus.BAD_REQUEST),
        code: API_ERROR_CODES.INVALID_REQUEST_DATA,
        message: 'The request contains invalid data.',
      };
    }
    return null;
  }

  switch (exception.code) {
    case 'P2002':
      return {
        statusCode: HttpStatus.CONFLICT,
        error: httpErrorName(HttpStatus.CONFLICT),
        code: API_ERROR_CODES.DUPLICATE_RESOURCE,
        message: 'A record with the same unique value already exists.',
      };
    case 'P2025':
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: httpErrorName(HttpStatus.NOT_FOUND),
        code: API_ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'The requested resource was not found.',
      };
    case 'P2003':
      return {
        statusCode: HttpStatus.CONFLICT,
        error: httpErrorName(HttpStatus.CONFLICT),
        code: API_ERROR_CODES.FOREIGN_KEY_CONFLICT,
        message: 'The operation violates a related resource reference.',
      };
    default:
      return null;
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
  const rawMessage =
    typeof body === 'string'
      ? body
      : typeof body === 'object' && body !== null && 'message' in body
        ? (body as { message?: unknown }).message
        : undefined;

  if (status === HttpStatus.BAD_REQUEST && Array.isArray(rawMessage)) {
    return {
      code: API_ERROR_CODES.VALIDATION_INVALID_BODY,
      message: 'Request validation failed.',
      details: {
        messages: rawMessage.filter(
          (value): value is string => typeof value === 'string',
        ),
      },
    };
  }

  const message =
    typeof rawMessage === 'string' ? rawMessage : 'Request failed.';
  return { code: codeFor(status, message), message };
}

function codeFor(status: number, message: string): ApiErrorCode {
  const normalized = message.toLowerCase();
  if (status === HttpStatus.UNAUTHORIZED) {
    if (normalized.includes('expired'))
      return API_ERROR_CODES.EXPIRED_REFRESH_TOKEN;
    if (normalized.includes('already been rotated'))
      return API_ERROR_CODES.REUSED_REFRESH_TOKEN;
    if (normalized.includes('email or password'))
      return API_ERROR_CODES.INVALID_CREDENTIALS;
    return API_ERROR_CODES.INVALID_REFRESH_TOKEN;
  }
  if (status === HttpStatus.FORBIDDEN) {
    if (normalized.includes('role'))
      return API_ERROR_CODES.UNAUTHORIZED_WRITE_ROLE;
    return API_ERROR_CODES.UNAUTHORIZED_MEMBERSHIP;
  }
  if (status === HttpStatus.NOT_FOUND) {
    if (normalized.includes('porbase') || normalized.includes('record found')) {
      return API_ERROR_CODES.PORBASE_RECORD_NOT_FOUND;
    }
    if (normalized.includes('organization'))
      return API_ERROR_CODES.ORGANIZATION_NOT_FOUND;
    if (normalized.includes('edition'))
      return API_ERROR_CODES.EDITION_NOT_FOUND;
    return API_ERROR_CODES.RESOURCE_NOT_FOUND;
  }
  if (status === HttpStatus.CONFLICT) {
    if (normalized.includes('organization') && normalized.includes('delet'))
      return API_ERROR_CODES.ORGANIZATION_DELETE_CONFLICT;
    if (normalized.includes('external identifier'))
      return API_ERROR_CODES.DUPLICATE_EXTERNAL_IDENTIFIER;
    return API_ERROR_CODES.DUPLICATE_EDITION;
  }
  if (status === HttpStatus.BAD_REQUEST) {
    if (normalized.includes('isbn')) return API_ERROR_CODES.INVALID_ISBN;
    if (normalized.includes('cursor') || normalized.includes('limit'))
      return API_ERROR_CODES.INVALID_CURSOR_OR_LIMIT;
    if (normalized.includes('date'))
      return API_ERROR_CODES.INVALID_BIBLIOGRAPHIC_DATE;
  }
  if (status === HttpStatus.SERVICE_UNAVAILABLE)
    return API_ERROR_CODES.PORBASE_TIMEOUT;
  if (status === HttpStatus.BAD_GATEWAY) {
    if (normalized.includes('invalid xml') || normalized.includes('invalid'))
      return API_ERROR_CODES.PORBASE_INVALID_RESPONSE;
    return API_ERROR_CODES.PORBASE_UNAVAILABLE;
  }
  return API_ERROR_CODES.INTERNAL_ERROR;
}
