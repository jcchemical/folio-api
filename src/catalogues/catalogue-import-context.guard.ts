import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrganizationRole } from '@prisma/client';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';

export type CatalogueImportRequest = Request & {
  catalogueImportOrganizationId?: string;
};

const FORBIDDEN_OWNERSHIP_FIELDS = new Set([
  'organizationId',
  'workId',
  'editionId',
  'libraryId',
  'locationId',
  'holdingId',
]);

@Injectable()
export class CatalogueImportContextGuard implements CanActivate {
  constructor(private readonly contexts: OrganizationContextResolver) {}

  async canActivate(executionContext: ExecutionContext): Promise<boolean> {
    const request = executionContext
      .switchToHttp()
      .getRequest<CatalogueImportRequest>();
    const userId = request.user as { id?: string } | undefined;
    const context = await this.contexts.resolveRequiredRootContext({
      userId: userId?.id,
      headerValue: request.headers[FOLIO_ORGANIZATION_HEADER],
      requiredRole: OrganizationRole.STAFF,
    });

    const forbiddenPaths = findForbiddenOwnershipPaths(request.body);
    if (forbiddenPaths.length) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        API_ERROR_CODES.VALIDATION_INVALID_BODY,
        'Request validation failed.',
        {
          messages: forbiddenPaths.map(
            (path) => `${path} is not allowed in catalogue import.`,
          ),
        },
      );
    }

    request.catalogueImportOrganizationId = context.organizationId;
    return true;
  }
}

function findForbiddenOwnershipPaths(value: unknown, path = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      findForbiddenOwnershipPaths(entry, `${path}[${index}]`),
    );
  }
  if (!value || typeof value !== 'object') return [];

  const paths: string[] = [];
  for (const [key, nested] of Object.entries(value)) {
    const fieldPath = path ? `${path}.${key}` : key;
    if (
      FORBIDDEN_OWNERSHIP_FIELDS.has(key) ||
      isServerOwnedBibliographicProvenance(fieldPath)
    ) {
      paths.push(fieldPath);
    }
    paths.push(...findForbiddenOwnershipPaths(nested, fieldPath));
  }
  return paths;
}

function isServerOwnedBibliographicProvenance(path: string): boolean {
  return [
    'bibliographicRecord.source',
    'bibliographicRecord.sourceId',
    'bibliographicRecord.schema',
  ].includes(path);
}
