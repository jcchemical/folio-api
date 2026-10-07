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
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { forbidRequestFields } from '../common/forbid-request-fields.js';
import { ItemsService } from './items.service.js';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { THROTTLE_TTL_MS } from '../common/throttling.config.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';

@ApiTags('items')
@ApiBearerAuth()
@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @Throttle({ default: { limit: 100, ttl: THROTTLE_TTL_MS } })
  findAll(@Query() query: PaginationQueryDto, @Req() request: Request) {
    forbidRequestFields(request.query, [
      'organizationId',
      'libraryId',
      'locationId',
      'workId',
      'editionId',
      'holdingId',
      'itemId',
    ]);
    return this.itemsService.findAllByUser(
      this.getUserId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      query,
    );
  }

  @Get(':id')
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: false })
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.itemsService.findById(
      id,
      this.getUserId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Post()
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; Item organization is derived from holdingId.',
  })
  create(@Body() body: CreateItemDto, @Req() request: Request) {
    forbidRequestFields(request.body, [
      'organizationId',
      'editionId',
      'libraryId',
      'locationId',
    ]);
    return this.itemsService.create(
      this.getUserId(request),
      body,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Put(':id')
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: false })
  update(
    @Param('id') id: string,
    @Body() body: UpdateItemDto,
    @Req() request: Request,
  ) {
    forbidRequestFields(request.body, [
      'organizationId',
      'editionId',
      'libraryId',
      'locationId',
      'holdingId',
    ]);
    return this.itemsService.update(
      id,
      this.getUserId(request),
      body,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Delete(':id')
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: false })
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.itemsService.remove(
      id,
      this.getUserId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  private getUserId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
