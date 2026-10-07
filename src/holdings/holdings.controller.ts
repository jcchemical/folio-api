import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { forbidRequestFields } from '../common/forbid-request-fields.js';
import { THROTTLE_TTL_MS } from '../common/throttling.config.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import {
  CreateHoldingDto,
  HoldingListQueryDto,
  UpdateHoldingDto,
} from './dto/holding.dto.js';
import { HoldingsService } from './holdings.service.js';

@ApiTags('holdings')
@ApiBearerAuth()
@Controller('holdings')
@UseGuards(JwtAuthGuard)
export class HoldingsController {
  constructor(private readonly holdings: HoldingsService) {}

  @Get()
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiBadRequestResponse({
    description: 'Organization context is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'Membership in the selected organization is required.',
  })
  @Throttle({ default: { limit: 100, ttl: THROTTLE_TTL_MS } })
  findAll(@Query() query: HoldingListQueryDto, @Req() request: Request) {
    forbidRequestFields(request.query, [
      'organizationId',
      'libraryId',
      'workId',
      'holdingId',
      'itemId',
    ]);
    return this.holdings.findAll(
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      query,
    );
  }

  @Post()
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; context is derived from editionId and locationId.',
  })
  @ApiForbiddenResponse({
    description:
      'STAFF membership is required in the common parent organization.',
  })
  create(@Body() body: CreateHoldingDto, @Req() request: Request) {
    forbidRequestFields(request.body, [
      'organizationId',
      'libraryId',
      'workId',
      'location',
      'edition',
    ]);
    return this.holdings.create(
      this.userId(request),
      body,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Get(':id')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; must match the derived Holding organization.',
  })
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.holdings.findById(
      id,
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Put(':id')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; must match the derived Holding organization.',
  })
  update(
    @Param('id') id: string,
    @Body() body: UpdateHoldingDto,
    @Req() request: Request,
  ) {
    forbidRequestFields(request.body, [
      'organizationId',
      'libraryId',
      'editionId',
      'locationId',
      'workId',
    ]);
    return this.holdings.update(
      id,
      this.userId(request),
      body,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Delete(':id')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; must match the derived Holding organization.',
  })
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.holdings.remove(
      id,
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  private userId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
