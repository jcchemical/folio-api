import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
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
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { OrganizationsService } from './organizations.service.js';
import { FOLIO_ORGANIZATION_HEADER } from './organization-context.resolver.js';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List organizations where the user is a member' })
  @ApiOkResponse({ description: 'Membership-scoped organization summaries' })
  findAll(@Req() request: Request) {
    return this.organizations.findAllByUser(this.userId(request));
  }

  @Post()
  @ApiOperation({ summary: 'Create an organization and become its owner' })
  @ApiOkResponse({ description: 'Created organization and OWNER membership' })
  create(@Req() request: Request, @Body() body: CreateOrganizationDto) {
    return this.organizations.create(this.userId(request), body);
  }

  @Get(':id')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; must match the organization ID in the path.',
  })
  @ApiOperation({ summary: 'Get an organization where the user is a member' })
  @ApiForbiddenResponse({ description: 'The user is not a member.' })
  @ApiNotFoundResponse({ description: 'Organization not found.' })
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.organizations.findOneByUser(
      this.userId(request),
      id,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Put(':id')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; must match the organization ID in the path.',
  })
  @ApiOperation({ summary: 'Rename an organization as OWNER or ADMIN' })
  @ApiForbiddenResponse({ description: 'OWNER or ADMIN role required.' })
  @ApiNotFoundResponse({ description: 'Organization not found.' })
  update(
    @Param('id') id: string,
    @Req() request: Request,
    @Body() body: UpdateOrganizationDto,
  ) {
    return this.organizations.update(
      this.userId(request),
      id,
      body,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Delete(':id')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; must match the organization ID in the path.',
  })
  @ApiOperation({ summary: 'Request organization deletion' })
  @ApiConflictResponse({
    description: 'Deletion is disabled until resource reassignment is defined.',
  })
  @ApiForbiddenResponse({ description: 'OWNER role required.' })
  @ApiNotFoundResponse({ description: 'Organization not found.' })
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.organizations.remove(
      this.userId(request),
      id,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  private userId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
