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
import { CreateLibraryDto, UpdateLibraryDto } from './dto/library.dto.js';
import { LibrariesService } from './libraries.service.js';

@ApiTags('libraries')
@ApiBearerAuth()
@Controller('libraries')
@UseGuards(JwtAuthGuard)
export class LibrariesController {
  constructor(private readonly libraries: LibrariesService) {}

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
    return this.libraries.findAll(
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      query,
    );
  }

  @Post()
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiBadRequestResponse({
    description: 'Organization context is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'STAFF membership is required in the selected organization.',
  })
  create(@Body() body: CreateLibraryDto, @Req() request: Request) {
    forbidRequestFields(request.body, ['organizationId']);
    return this.libraries.create(
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      body,
    );
  }

  @Get(':id')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; must match the Library organization.',
  })
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.libraries.findById(
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
      'Optional consistency check; must match the Library organization.',
  })
  update(
    @Param('id') id: string,
    @Body() body: UpdateLibraryDto,
    @Req() request: Request,
  ) {
    forbidRequestFields(request.body, ['organizationId']);
    return this.libraries.update(
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
      'Optional consistency check; must match the Library organization.',
  })
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.libraries.remove(
      id,
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  private userId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
