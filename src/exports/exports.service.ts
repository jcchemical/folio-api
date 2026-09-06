import {
  ForbiddenException,
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

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  async exportMarcXchange(editionId: string, userId: string): Promise<string> {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        work: {
          include: {
            workContributors: {
              include: { contributor: true },
            },
          },
        },
        editionContributors: {
          include: { contributor: true },
        },
        externalIdentifiers: true,
      },
    });

    if (!edition) {
      throw new NotFoundException('Edition not found');
    }

    if (edition.work.userId !== userId) {
      throw new ForbiddenException('Edition does not belong to the authenticated user');
    }

    try {
      const localEdition: UnimarcLocalEditionInput = {
        id: edition.id,
        title: edition.title,
        subtitle: edition.subtitle,
        isbn10: edition.isbn10,
        isbn13: edition.isbn13,
        publisher: edition.publisher,
        publishDate: edition.publishDate,
        language: edition.language,
        pages: edition.pages,
        work: { title: edition.work.title },
        editionContributors: edition.editionContributors,
        workContributors: edition.work.workContributors,
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
