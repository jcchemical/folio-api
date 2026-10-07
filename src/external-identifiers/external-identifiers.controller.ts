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
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { forbidRequestFields } from '../common/forbid-request-fields.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import {
  ExternalIdentifiersService,
  type ExternalIdentifierInput,
} from './external_identifiers.service.js';
import {
  CreateExternalIdentifierDto,
  ExternalIdentifierListQueryDto,
  UpdateExternalIdentifierDto,
} from './dto/external-identifier.dto.js';

@ApiTags('external-identifiers')
@ApiBearerAuth()
@Controller('external-identifiers')
@UseGuards(JwtAuthGuard)
export class ExternalIdentifiersController {
  constructor(private readonly service: ExternalIdentifiersService) {}

  @Get()
  @ApiOperation({
    summary: 'List External Identifiers in one organization',
    description:
      'X-Folio-Organization-Id is required. editionId may narrow the results but cannot replace organization context.',
  })
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiBadRequestResponse({
    description: 'Organization context is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'Membership in the selected organization is required.',
  })
  findAll(
    @Query() query: ExternalIdentifierListQueryDto,
    @Req() request: Request,
  ) {
    forbidRequestFields(request.query, [
      'organizationId',
      'workId',
      'libraryId',
      'locationId',
      'holdingId',
      'itemId',
    ]);
    return this.service.findAll(
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      query,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Create an External Identifier for an Edition',
    description:
      'Organization is derived from the persisted editionId. The optional organization header is a consistency check only.',
  })
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; organization is derived from the persisted editionId.',
  })
  @ApiForbiddenResponse({
    description: 'STAFF membership is required in the Edition organization.',
  })
  create(@Body() body: CreateExternalIdentifierDto, @Req() request: Request) {
    forbidRequestFields(request.body, [
      'organizationId',
      'workId',
      'libraryId',
      'locationId',
      'holdingId',
      'itemId',
    ]);
    return this.service.create(
      this.userId(request),
      body satisfies ExternalIdentifierInput,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Get(':id')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; must match the persisted identifier Edition organization.',
  })
  @ApiOperation({
    summary: 'Get an External Identifier',
    description:
      'Organization is derived from External Identifier → Edition → Work.',
  })
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.service.findById(
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
      'Optional consistency check; must match the persisted identifier Edition organization.',
  })
  @ApiOperation({
    summary: 'Update External Identifier fields',
    description:
      'Organization is derived from the persisted identifier. editionId cannot be reassigned.',
  })
  @ApiForbiddenResponse({
    description: 'STAFF membership is required in the identifier organization.',
  })
  update(
    @Param('id') id: string,
    @Body() body: UpdateExternalIdentifierDto,
    @Req() request: Request,
  ) {
    forbidRequestFields(request.body, [
      'organizationId',
      'workId',
      'editionId',
      'libraryId',
      'locationId',
      'holdingId',
      'itemId',
    ]);
    return this.service.update(
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
      'Optional consistency check; must match the persisted identifier Edition organization.',
  })
  @ApiOperation({
    summary: 'Delete an External Identifier',
    description:
      'Organization is derived from External Identifier → Edition → Work.',
  })
  @ApiForbiddenResponse({
    description: 'STAFF membership is required in the identifier organization.',
  })
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.service.remove(
      id,
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  private userId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
