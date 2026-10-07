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
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { forbidRequestFields } from '../common/forbid-request-fields.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto.js';
import { LocationsService } from './locations.service.js';

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiBadRequestResponse({
    description: 'Organization context is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'Membership in the selected organization is required.',
  })
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
    return this.locations.findAll(
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
      'Optional consistency check; organization is derived from libraryId.',
  })
  @ApiForbiddenResponse({
    description: 'STAFF membership is required in the Library organization.',
  })
  create(@Body() body: CreateLocationDto, @Req() request: Request) {
    forbidRequestFields(request.body, ['organizationId']);
    return this.locations.create(
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
      'Optional consistency check; must match the Location organization.',
  })
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.locations.findById(
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
      'Optional consistency check; must match the Location organization.',
  })
  update(
    @Param('id') id: string,
    @Body() body: UpdateLocationDto,
    @Req() request: Request,
  ) {
    forbidRequestFields(request.body, ['organizationId', 'libraryId']);
    return this.locations.update(
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
      'Optional consistency check; must match the Location organization.',
  })
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.locations.remove(
      id,
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  private userId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
