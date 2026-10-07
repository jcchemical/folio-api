import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import { BibliographicRecordsService } from './bibliographic_records.service.js';

@ApiTags('bibliographic-records')
@ApiBearerAuth()
@Controller('bibliographic-records')
@UseGuards(JwtAuthGuard)
export class BibliographicRecordsController {
  constructor(
    private readonly bibliographicRecordsService: BibliographicRecordsService,
  ) {}

  @Get(':id')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; the record organization is derived from Edition → Work.',
  })
  @ApiOperation({
    summary: 'Read a Bibliographic Record by id',
    description:
      'Organization is derived from the persisted Edition → Work relationship. A supplied X-Folio-Organization-Id must match.',
  })
  @ApiOkResponse({ description: 'The requested Bibliographic Record.' })
  @ApiBadRequestResponse({ description: 'The organization header is invalid.' })
  @ApiForbiddenResponse({
    description: 'Membership in the record organization is required.',
  })
  @ApiNotFoundResponse({
    description: 'The record or its target does not exist.',
  })
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.bibliographicRecordsService.findOne(
      this.getUserId(request),
      id,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  private getUserId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
