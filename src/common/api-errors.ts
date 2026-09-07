import { HttpException, HttpStatus } from '@nestjs/common';

export const API_ERROR_CODES = {
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN: 'AUTH_INVALID_REFRESH_TOKEN',
  EXPIRED_REFRESH_TOKEN: 'AUTH_EXPIRED_REFRESH_TOKEN',
  REUSED_REFRESH_TOKEN: 'AUTH_REUSED_REFRESH_TOKEN',
  VALIDATION_INVALID_BODY: 'VALIDATION_INVALID_BODY',
  INVALID_ISBN: 'CATALOGUE_INVALID_ISBN',
  INVALID_BIBLIOGRAPHIC_DATE: 'BIBLIOGRAPHIC_INVALID_DATE',
  INVALID_CURSOR_OR_LIMIT: 'PAGINATION_INVALID_CURSOR_OR_LIMIT',
  UNAUTHORIZED_MEMBERSHIP: 'AUTHORIZATION_MEMBERSHIP_REQUIRED',
  UNAUTHORIZED_WRITE_ROLE: 'AUTHORIZATION_WRITE_ROLE_REQUIRED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  ORGANIZATION_NOT_FOUND: 'ORGANIZATION_NOT_FOUND',
  EDITION_NOT_FOUND: 'EDITION_NOT_FOUND',
  DUPLICATE_EDITION: 'CONFLICT_DUPLICATE_EDITION',
  DUPLICATE_EXTERNAL_IDENTIFIER: 'CONFLICT_DUPLICATE_EXTERNAL_IDENTIFIER',
  ORGANIZATION_DELETE_CONFLICT: 'CONFLICT_ORGANIZATION_DELETE',
  PORBASE_TIMEOUT: 'PORBASE_TIMEOUT',
  PORBASE_UNAVAILABLE: 'PORBASE_UNAVAILABLE',
  PORBASE_INVALID_RESPONSE: 'PORBASE_INVALID_RESPONSE',
  PORBASE_RECORD_NOT_FOUND: 'PORBASE_RECORD_NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

type ApiExceptionResponse = {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    code: ApiErrorCode,
    message: string,
    details?: unknown,
  ) {
    super({ statusCode: status, code, message, ...(details ? { details } : {}) }, status);
  }
}

export function conflictDuplicateEdition(message = 'An edition with this ISBN already exists for this organization.') {
  return new ApiException(HttpStatus.CONFLICT, API_ERROR_CODES.DUPLICATE_EDITION, message);
}

export function conflictDuplicateExternalIdentifier(message: string) {
  return new ApiException(HttpStatus.CONFLICT, API_ERROR_CODES.DUPLICATE_EXTERNAL_IDENTIFIER, message);
}

export function responseWithCode(exception: HttpException): ApiExceptionResponse | null {
  const response = exception.getResponse();
  if (typeof response === 'object' && response !== null) {
    const candidate = response as Partial<ApiExceptionResponse>;
    if (typeof candidate.code === 'string' && typeof candidate.message === 'string') {
      return {
        statusCode: exception.getStatus(),
        code: candidate.code as ApiErrorCode,
        message: candidate.message,
        ...(candidate.details ? { details: candidate.details } : {}),
      };
    }
  }
  return null;
}
