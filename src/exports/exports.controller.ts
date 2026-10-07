import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import { ExportsService } from './exports.service.js';

/**
 * Prisma uses cuid() for IDs in this project. UUIDs are accepted for
 * compatibility with clients that use UUID-shaped identifiers, while cuid
 * values keep existing Edition IDs exportable without a schema change.
 */
export class EditionIdValidationPipe implements PipeTransform<string> {
  transform(value: string, _metadata: ArgumentMetadata): string {
    if (!isUuid(value) && !isCuid(value)) {
      throw new BadRequestException('Invalid edition ID');
    }

    return value;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isCuid(value: string): boolean {
  return /^c[a-z0-9]{24}$/i.test(value);
}

@ApiTags('exports')
@ApiBearerAuth()
@ApiProduces('application/xml')
@Controller('exports')
@UseGuards(JwtAuthGuard)
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('marcxchange/edition/:editionId')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; Organization is derived from Edition → Work.',
  })
  @ApiOperation({
    summary: 'Export a local Edition as MARCXchange XML',
    description:
      'The export is scoped to the persisted Edition → Work organization. If X-Folio-Organization-Id is supplied, it must match.',
  })
  @ApiOkResponse({ description: 'MARCXchange XML export' })
  @ApiBadRequestResponse({ description: 'The edition ID is invalid.' })
  @ApiConflictResponse({
    description:
      'The supplied organization header does not match the Edition organization.',
  })
  @ApiNotFoundResponse({
    description:
      'Edition not found or not accessible to the authenticated user.',
  })
  async exportEdition(
    @Param('editionId', EditionIdValidationPipe) editionId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const xml = await this.exportsService.exportMarcXchange(
      editionId,
      (request.user as AuthenticatedUser).id,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );

    response.setHeader('Content-Type', 'application/xml; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="folio-${editionId}.marcxchange.xml"`,
    );

    return xml;
  }
}
