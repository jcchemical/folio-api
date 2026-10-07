import { HttpStatus } from '@nestjs/common';
import { API_ERROR_CODES, ApiException } from './api-errors.js';

export function forbidRequestFields(
  body: unknown,
  forbiddenFields: readonly string[],
): void {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return;
  const present = forbiddenFields.filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field),
  );
  if (!present.length) return;

  throw new ApiException(
    HttpStatus.BAD_REQUEST,
    API_ERROR_CODES.VALIDATION_INVALID_BODY,
    'Request validation failed.',
    { messages: present.map((field) => `${field} is not allowed.`) },
  );
}
