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

type CanonicalExportInput = UnimarcLocalEditionInput & {
  legacyProjection: {
    edition: {
      title: string;
      subtitle: string | null;
      isbn10: string | null;
      isbn13: string | null;
      publisher: string | null;
      publicationDate: string | null;
      publicationPlace: string | null;
      language: string | null;
      pageCount: number | null;
    };
    work: { title: string };
  };
  titles: unknown[];
  responsibilityStatements: unknown[];
  languages: unknown[];
  editionStatements: unknown[];
  series: unknown[];
  notes: unknown[];
  classifications: unknown[];
  contributions: NonNullable<UnimarcLocalEditionInput['editionContributions']>;
  work: NonNullable<UnimarcLocalEditionInput['work']> & {
    titles: unknown[];
    notes: unknown[];
    contributions: NonNullable<UnimarcLocalEditionInput['workContributions']>;
  };
};

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
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: { contributor: true },
            },
            titles: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            notes: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
            contributions: {
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              include: {
                agent: true,
                sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
              },
            },
          },
        },
        titles: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        responsibilityStatements: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
        languages: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        editionStatements: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
        series: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        notes: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        classifications: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
        editionContributors: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { contributor: true },
        },
        contributions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            agent: true,
            sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          },
        },
        // ExternalIdentifier has no sortOrder column; id provides stable ordering.
        externalIdentifiers: { orderBy: [{ id: 'asc' }] },
        physicalDescriptions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          },
        },
        publicationStatements: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          },
        },
      },
    });

    if (!edition) {
      throw new NotFoundException('Edition not found');
    }

    await this.organizationMemberships.assertWorkAccess(userId, edition.work);

    try {
      const legacyProjection = {
        edition: {
          title: edition.title,
          subtitle: edition.subtitle,
          isbn10: edition.isbn10,
          isbn13: edition.isbn13,
          publisher: edition.publisher,
          publicationDate: edition.publicationDate,
          publicationPlace: edition.publicationPlace,
          language: edition.language,
          pageCount: edition.pageCount,
        },
        work: { title: edition.work.title },
      };

      const localEdition: CanonicalExportInput = {
        id: edition.id,
        // Transitional aliases remain until the mapper is updated in 1G-API.2.
        ...legacyProjection.edition,
        legacyProjection,
        titles: edition.titles,
        responsibilityStatements: edition.responsibilityStatements,
        languages: edition.languages,
        editionStatements: edition.editionStatements,
        series: edition.series,
        notes: edition.notes,
        classifications: edition.classifications,
        contributions: edition.contributions,
        physicalDescriptions: edition.physicalDescriptions,
        publicationStatements: edition.publicationStatements,
        work: {
          title: legacyProjection.work.title,
          titles: edition.work.titles,
          notes: edition.work.notes,
          contributions: edition.work.contributions,
          workContributors: edition.work.workContributors,
        } as CanonicalExportInput['work'],
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
