import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  API_ERROR_CODES,
  ApiException,
  responseWithCode,
} from '../common/api-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  mapLocalEditionToUnimarc,
  type UnimarcLocalEditionInput,
} from '../bibliography/mappers/unimarc-local.mapper.js';
import { serializeMarcXchange } from '../bibliography/serializers/marcxchange.serializer.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import type { OrganizationHeaderValue } from '../organizations/organization-context.resolver.js';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
  ) {}

  async exportMarcXchange(
    editionId: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ): Promise<string> {
    const target = await this.prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        id: true,
        work: { select: { organizationId: true } },
      },
    });
    if (!target) throw resourceNotFound();

    await this.resolveExportContext({
      userId,
      headerValue,
      derivedOrganizationId: target.work.organizationId,
    });

    const edition = await this.prisma.edition.findUnique({
      where: {
        id: editionId,
        work: { organizationId: target.work.organizationId },
      },
      include: {
        work: {
          include: {
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
        contributions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            agent: true,
            sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          },
        },
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

    if (!edition) throw resourceNotFound();
    const identifiers = await this.prisma.externalIdentifier.findMany({
      where: {
        entityType: 'Edition',
        entityId: edition.id,
        organizationId: target.work.organizationId,
      },
      orderBy: [{ id: 'asc' }],
    });

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

      const localEdition: UnimarcLocalEditionInput = {
        id: edition.id,
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
          titles: edition.work.titles,
          notes: edition.work.notes,
          contributions: edition.work.contributions,
        },
        externalIdentifiers: identifiers.map((identifier) => ({
          type: identifier.authority.toUpperCase(),
          value: identifier.value,
        })),
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

  private async resolveExportContext(input: {
    userId: string;
    headerValue: OrganizationHeaderValue;
    derivedOrganizationId: string;
  }): Promise<void> {
    try {
      await this.contexts.resolveDerivedContext(input);
    } catch (contextError) {
      try {
        await this.contexts.resolveDerivedContext({
          ...input,
          headerValue: undefined,
        });
      } catch (membershipError) {
        if (
          membershipError instanceof HttpException &&
          responseWithCode(membershipError)?.code ===
            API_ERROR_CODES.ORGANIZATION_MEMBERSHIP_REQUIRED
        ) {
          throw resourceNotFound();
        }
        throw membershipError;
      }
      throw contextError;
    }
  }
}

function resourceNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    API_ERROR_CODES.RESOURCE_NOT_FOUND,
    'Edition not found.',
  );
}
