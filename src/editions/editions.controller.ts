import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { pipeline } from 'node:stream/promises';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { EditionsService } from './editions.service.js';
import {
  CreateEditionRequestDto,
  UpdateEditionDto,
} from './dto/edition.dto.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { THROTTLE_TTL_MS } from '../common/throttling.config.js';
import { EditionCoverService } from './edition-cover.service.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import { BibliographicRecordsService } from '../bibliographic-records/bibliographic_records.service.js';
import { EditionRecordOutputDto } from '../bibliographic-records/dto/edition-record-output.dto.js';

@ApiTags('editions')
@ApiBearerAuth()
@Controller('editions')
@UseGuards(JwtAuthGuard)
export class EditionsController {
  constructor(
    private readonly editionsService: EditionsService,
    private readonly editionCoverService: EditionCoverService,
    private readonly bibliographicRecordsService: BibliographicRecordsService,
  ) {}

  @Get()
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiBadRequestResponse({
    description: 'Organization context is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'Membership in the selected organization is required.',
  })
  @Throttle({ default: { limit: 100, ttl: THROTTLE_TTL_MS } })
  findAll(@Query() query: PaginationQueryDto, @Req() request: Request) {
    return this.editionsService.findAllByUser(
      this.getUserId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      query,
    );
  }

  @Get(':id')
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: false })
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.editionsService.findById(
      id,
      this.getUserId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Get(':id/record')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; Organization is derived from Edition → Work.',
  })
  @ApiOperation({
    summary: 'Read the Bibliographic Record associated with an Edition',
    description:
      'Organization is derived from Edition → Work. A supplied X-Folio-Organization-Id must match. The response contains declared provenance and excludes raw source content.',
  })
  @ApiOkResponse({ type: EditionRecordOutputDto })
  @ApiBadRequestResponse({
    description: 'The organization header is invalid.',
  })
  @ApiForbiddenResponse({
    description: 'Membership in the Edition organization is required.',
  })
  @ApiNotFoundResponse({
    description: 'The Edition or its Bibliographic Record was not found.',
  })
  getRecord(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<EditionRecordOutputDto> {
    return this.bibliographicRecordsService.findForEdition(
      this.getUserId(request),
      id,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Get(':id/cover')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; Organization is derived from Edition → Work.',
  })
  @ApiHeader({
    name: 'If-None-Match',
    required: false,
    description: 'Conditional request using the active cover ETag.',
  })
  @ApiOperation({
    summary: 'Read an Edition’s active cover image',
    description:
      'Organization is derived from Edition → Work. A supplied X-Folio-Organization-Id must match.',
  })
  @ApiProduces('image/jpeg', 'image/png', 'image/gif', 'image/webp')
  @ApiOkResponse({
    description: 'The active cover image bytes.',
    headers: {
      ETag: {
        description: 'Content hash of the active image.',
        schema: { type: 'string' },
      },
      'Cache-Control': { schema: { type: 'string' } },
      'X-Content-Type-Options': { schema: { type: 'string' } },
    },
    content: {
      'image/jpeg': { schema: { type: 'string', format: 'binary' } },
      'image/png': { schema: { type: 'string', format: 'binary' } },
      'image/gif': { schema: { type: 'string', format: 'binary' } },
      'image/webp': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 304, description: 'The active cover is unchanged.' })
  @ApiBadRequestResponse({
    description: 'Edition ID or organization header is invalid.',
  })
  @ApiForbiddenResponse({
    description: 'Membership in the Edition organization is required.',
  })
  @ApiNotFoundResponse({
    description: 'The Edition or its active cover was not found.',
  })
  async getCover(
    @Param('id') id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (!isCuid(id)) throw new BadRequestException('Invalid edition ID');

    const cover = await this.editionCoverService.getActiveCover(
      id,
      this.getUserId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
    const etag = `"${cover.contentHash}"`;

    response.setHeader('Content-Type', cover.mimeType);
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'private, max-age=31536000');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    if (matchesIfNoneMatch(request.headers['if-none-match'], etag)) {
      response.status(304).end();
      return;
    }

    response.status(200);
    try {
      await pipeline(
        await this.editionCoverService.readCover(cover.storageKey),
        response,
      );
    } catch (error) {
      if (response.headersSent) {
        response.destroy(error instanceof Error ? error : undefined);
        return;
      }
      response.removeHeader('Content-Type');
      response.removeHeader('ETag');
      response.removeHeader('Cache-Control');
      response.removeHeader('X-Content-Type-Options');
      throw error;
    }
  }

  @Post()
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; context is derived from the persisted workId.',
  })
  @ApiOperation({
    summary: 'Create an edition under a Work the caller may write',
    description:
      'Organization context is derived from workId. If X-Folio-Organization-Id is supplied, it must match the Work organization.',
  })
  create(@Body() body: CreateEditionRequestDto, @Req() request: Request) {
    const { workId, ...edition } = body;
    return this.editionsService.create(
      this.getUserId(request),
      workId,
      edition,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Put(':id')
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: false })
  update(
    @Param('id') id: string,
    @Body() body: UpdateEditionDto,
    @Req() request: Request,
  ) {
    return this.editionsService.update(
      id,
      this.getUserId(request),
      body,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Delete(':id')
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: false })
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.editionsService.remove(
      id,
      this.getUserId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  private getUserId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}

function isCuid(value: string): boolean {
  return /^c[a-z0-9]{24}$/i.test(value);
}

function matchesIfNoneMatch(
  header: string | string[] | undefined,
  etag: string,
): boolean {
  if (!header) return false;
  const currentTag = normalizeEntityTag(etag);
  return (Array.isArray(header) ? header : [header]).some((value) =>
    value.split(',').some((candidate) => {
      const trimmed = candidate.trim();
      return trimmed === '*' || normalizeEntityTag(trimmed) === currentTag;
    }),
  );
}

function normalizeEntityTag(value: string): string {
  return value.trim().replace(/^W\//i, '').replace(/^"|"$/g, '');
}
