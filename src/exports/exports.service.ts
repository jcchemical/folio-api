import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  mapLocalEditionToUnimarc,
  type UnimarcLocalEditionInput,
} from '../bibliography/mappers/unimarc-local.mapper.js';
import { serializeMarcXchange } from '../bibliography/serializers/marcxchange.serializer.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async exportMarcXchange(editionId: string, userId: string): Promise<string> {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        work: {
          include: {
            workContributors: {
              include: { contributor: true },
            },
            contributions: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: { sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
            },
          },
        },
        editionContributors: {
          include: { contributor: true },
        },
        contributions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
        },
        externalIdentifiers: true,
        physicalDescriptions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
        },
        publicationStatements: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
        },
      },
    });

    if (!edition) {
      throw new NotFoundException('Edition not found');
    }

    await this.organizationMemberships.assertWorkAccess(userId, edition.work);

    try {
      const localEdition: UnimarcLocalEditionInput = {
        id: edition.id,
        title: edition.title,
        subtitle: edition.subtitle,
        isbn10: edition.isbn10,
        isbn13: edition.isbn13,
        publisher: edition.publisher,
        publicationDate: edition.publicationDate,
        publicationPlace: edition.publicationPlace,
        language: edition.language,
        pageCount: edition.pageCount,
        physicalDescriptions: edition.physicalDescriptions,
        publicationStatements: edition.publicationStatements,
        work: { title: edition.work.title },
        editionContributors: edition.editionContributors,
        workContributors: edition.work.workContributors,
        editionContributions: edition.contributions,
        workContributions: edition.work.contributions,
        externalIdentifiers: edition.externalIdentifiers,
      };

      const mapping = mapLocalEditionToUnimarc(localEdition);
      return serializeMarcXchange(mapping.record);
    } catch (error: unknown) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Could not serialize the local edition as MARCXchange',
      );
    }
  }
}
