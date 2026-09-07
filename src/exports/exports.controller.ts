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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
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
  @ApiOperation({ summary: 'Export a local edition as MARCXchange XML' })
  @ApiOkResponse({ description: 'MARCXchange XML export' })
  @ApiBadRequestResponse({ description: 'The edition ID is invalid.' })
  @ApiForbiddenResponse({
    description:
      "The authenticated user is not a member of the Edition's organization.",
  })
  @ApiNotFoundResponse({ description: 'Edition not found.' })
  async exportEdition(
    @Param('editionId', EditionIdValidationPipe) editionId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    response.setHeader('Content-Type', 'application/xml; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="folio-${editionId}.marcxchange.xml"`,
    );

    return this.exportsService.exportMarcXchange(
      editionId,
      (request.user as AuthenticatedUser).id,
    );
  }
}
