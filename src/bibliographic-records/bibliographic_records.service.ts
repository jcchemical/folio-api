import { HttpStatus, Injectable } from '@nestjs/common';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import type { OrganizationHeaderValue } from '../organizations/organization-context.resolver.js';
import { EditionRecordOutputDto } from './dto/edition-record-output.dto.js';

@Injectable()
export class BibliographicRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
  ) {}

  async findOne(
    userId: string,
    id: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const record = await this.prisma.bibliographicRecord.findUnique({
      where: { id },
      include: { edition: { include: { work: true } } },
    });
    if (!record) throw resourceNotFound('Bibliographic record');
    if (!record.edition?.work?.organizationId)
      throw resourceNotFound('Bibliographic record target');

    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: record.edition.work.organizationId,
    });
    return record;
  }

  async findByEdition(
    userId: string,
    editionId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { work: true },
    });
    if (!edition) throw resourceNotFound('Edition');
    if (!edition.work?.organizationId) throw resourceNotFound('Edition Work');
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: edition.work.organizationId,
    });
    return this.prisma.bibliographicRecord.findMany({
      where: { editionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findForEdition(
    userId: string,
    editionId: string,
    headerValue?: OrganizationHeaderValue,
  ): Promise<EditionRecordOutputDto> {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { work: true },
    });
    if (!edition) throw resourceNotFound('Edition');
    if (!edition.work?.organizationId) throw resourceNotFound('Edition Work');

    await this.contexts.resolveDerivedContext({
      userId,
      headerValue,
      derivedOrganizationId: edition.work.organizationId,
    });

    const record = await this.prisma.bibliographicRecord.findFirst({
      where: { editionId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        editionId: true,
        source: true,
        sourceId: true,
        createdAt: true,
        remoteId: true,
        format: true,
      },
    });
    if (!record) throw resourceNotFound('Bibliographic record');

    return new EditionRecordOutputDto(record);
  }
}

function resourceNotFound(resource: string): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    API_ERROR_CODES.RESOURCE_NOT_FOUND,
    `${resource} not found.`,
  );
}
