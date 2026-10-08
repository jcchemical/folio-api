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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { forbidRequestFields } from '../common/forbid-request-fields.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import { ExternalIdentifiersService } from './external_identifiers.service.js';
import {
  CreateExternalIdentifierDto,
  ExternalIdentifierListQueryDto,
  ExternalIdentifierDto,
  ExternalIdentifierPageDto,
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
      'X-Folio-Organization-Id is required. entityType, entityId and authority refine results within that organization.',
  })
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiOkResponse({ type: ExternalIdentifierPageDto })
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
    forbidRequestFields(request.query, ['organizationId', 'workId']);
    return this.service.list(
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      query,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Create an External Identifier',
    description:
      'Organization is derived from the persisted entity. The optional organization header is a consistency check only.',
  })
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; organization is derived from the persisted entity.',
  })
  @ApiForbiddenResponse({
    description: 'STAFF membership is required in the target Organization.',
  })
  @ApiCreatedResponse({ type: ExternalIdentifierDto })
  create(@Body() body: CreateExternalIdentifierDto, @Req() request: Request) {
    forbidRequestFields(request.body, ['organizationId']);
    return this.service.create(
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
      'Optional consistency check; must match the identifier Organization.',
  })
  @ApiOperation({
    summary: 'Get an External Identifier',
    description: 'Organization is derived from the persisted identifier.',
  })
  @ApiOkResponse({ type: ExternalIdentifierDto })
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
      'Optional consistency check; must match the identifier Organization.',
  })
  @ApiOperation({
    summary: 'Update External Identifier fields',
    description:
      'Organization and entity binding are immutable; authority and value may be changed.',
  })
  @ApiForbiddenResponse({
    description: 'STAFF membership is required in the identifier organization.',
  })
  @ApiOkResponse({ type: ExternalIdentifierDto })
  update(
    @Param('id') id: string,
    @Body() body: UpdateExternalIdentifierDto,
    @Req() request: Request,
  ) {
    forbidRequestFields(request.body, [
      'organizationId',
      'entityType',
      'entityId',
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
      'Optional consistency check; must match the identifier Organization.',
  })
  @ApiOperation({
    summary: 'Delete an External Identifier',
    description: 'Organization is derived from the persisted identifier.',
  })
  @ApiForbiddenResponse({
    description: 'STAFF membership is required in the identifier organization.',
  })
  @ApiOkResponse({ type: ExternalIdentifierDto })
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
