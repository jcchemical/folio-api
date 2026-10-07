import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import type { OrganizationHeaderValue } from '../organizations/organization-context.resolver.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../storage/storage.service.js';

@Injectable()
export class EditionCoverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async getActiveCover(
    editionId: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, work: { select: { organizationId: true } } },
    });
    if (!edition) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.RESOURCE_NOT_FOUND,
        'Edition not found.',
      );
    }

    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: edition.work.organizationId,
    });

    const editionCover = await this.prisma.editionCover.findFirst({
      where: { editionId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: {
        coverAsset: {
          select: {
            storageKey: true,
            contentHash: true,
            mimeType: true,
          },
        },
      },
    });
    if (!editionCover?.coverAsset) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.COVER_NOT_FOUND,
        'Cover not found.',
      );
    }

    return {
      ...editionCover.coverAsset,
    };
  }

  readCover(storageKey: string) {
    return this.storage.get(storageKey);
  }
}
