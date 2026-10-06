import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../storage/storage.service.js';

@Injectable()
export class EditionCoverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly memberships: OrganizationMembershipService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  async getActiveCover(editionId: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, work: { select: { organizationId: true } } },
    });
    if (!edition) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.EDITION_NOT_FOUND,
        'Edition not found.',
      );
    }

    try {
      await this.memberships.assertWorkAccess(userId, edition.work);
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.FORBIDDEN
      ) {
        throw new ApiException(
          HttpStatus.FORBIDDEN,
          API_ERROR_CODES.UNAUTHORIZED_READ_ROLE,
          'Read access to this Edition is required.',
        );
      }
      throw error;
    }

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
