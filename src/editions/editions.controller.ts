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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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

@ApiTags('editions')
@ApiBearerAuth()
@Controller('editions')
@UseGuards(JwtAuthGuard)
export class EditionsController {
  constructor(
    private readonly editionsService: EditionsService,
    private readonly editionCoverService: EditionCoverService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 100, ttl: THROTTLE_TTL_MS } })
  findAll(@Query() query: PaginationQueryDto, @Req() request: Request) {
    return this.editionsService.findAllByUser(this.getUserId(request), query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.editionsService.findById(id, this.getUserId(request));
  }

  @Get(':id/cover')
  async getCover(
    @Param('id') id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    if (!isCuid(id)) throw new BadRequestException('Invalid edition ID');

    const cover = await this.editionCoverService.getActiveCover(
      id,
      this.getUserId(request),
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
      throw error;
    }
  }

  @Post()
  create(@Body() body: CreateEditionRequestDto, @Req() request: Request) {
    const { workId, ...edition } = body;
    return this.editionsService.create(
      this.getUserId(request),
      workId,
      edition,
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateEditionDto,
    @Req() request: Request,
  ) {
    return this.editionsService.update(id, this.getUserId(request), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.editionsService.remove(id, this.getUserId(request));
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
