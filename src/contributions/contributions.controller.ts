import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
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
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import { forbidRequestFields } from '../common/forbid-request-fields.js';
import {
  ContributionListQueryDto,
  CreateContributionDto,
  UpdateContributionDto,
} from './contributions.dto.js';
import { ContributionsService } from './contributions.service.js';

@ApiTags('contributions')
@ApiBearerAuth()
@Controller('contributions')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Get()
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiOperation({
    summary: 'List Contributions in one organization',
    description:
      'X-Folio-Organization-Id is required. workId, editionId and agentId refine results within that organization.',
  })
  @ApiOkResponse()
  findAll(@Query() query: ContributionListQueryDto, @Req() request: Request) {
    forbidRequestFields(request.query, ['organizationId']);
    return this.contributionsService.list(
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      query,
    );
  }

  @Get(':id')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description: 'Optional consistency check.',
  })
  @ApiOperation({ summary: 'Get a Contribution' })
  @ApiOkResponse()
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.contributionsService.findById(
      id,
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Patch(':id')
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description: 'Optional consistency check.',
  })
  @ApiOperation({
    summary: 'Update Contribution roleLabel or sortOrder',
    description: 'Target and Agent bindings are immutable.',
  })
  @ApiForbiddenResponse({ description: 'STAFF membership is required.' })
  @ApiOkResponse()
  update(
    @Param('id') id: string,
    @Body() body: UpdateContributionDto,
    @Req() request: Request,
  ) {
    forbidRequestFields(request.body, [
      'organizationId',
      'workId',
      'editionId',
      'agentId',
      'source',
      'sourceTag',
      'indicator1',
      'indicator2',
      'sourceParts',
      'authorityId',
      'relationshipCodeScheme',
    ]);
    return this.contributionsService.update(
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
    description: 'Optional consistency check.',
  })
  @ApiOperation({ summary: 'Delete a Contribution' })
  @ApiForbiddenResponse({ description: 'STAFF membership is required.' })
  @ApiOkResponse()
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.contributionsService.remove(
      id,
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Post()
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; Organization is derived from workId or editionId.',
  })
  @ApiOperation({
    summary: 'Create a manual Contribution under a Work or Edition',
    description:
      'Provide exactly one persisted workId or editionId. Organization is derived from that target. Only STAFF+ members may write, and source is assigned by the server as MANUAL.',
  })
  @ApiForbiddenResponse({
    description: 'STAFF membership is required in the target organization.',
  })
  @ApiCreatedResponse()
  create(@Body() body: CreateContributionDto, @Req() request: Request) {
    forbidRequestFields(request.body, [
      'organizationId',
      'source',
      'sourceTag',
      'indicator1',
      'indicator2',
      'sourceParts',
      'authorityId',
      'relationshipCodeScheme',
    ]);
    return this.contributionsService.createManual(
      (request.user as AuthenticatedUser).id,
      body,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  private userId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
