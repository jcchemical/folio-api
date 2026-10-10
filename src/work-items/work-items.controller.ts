import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { forbidRequestFields } from '../common/forbid-request-fields.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import {
  CreateWorkItemDto,
  TransitionWorkItemDto,
  WorkItemDto,
  WorkItemListQueryDto,
  WorkItemPageDto,
} from './dto/work-item.dto.js';
import { WorkItemsService } from './work-items.service.js';

const IMMUTABLE_FIELDS = [
  'id',
  'organizationId',
  'createdById',
  'createdAt',
  'updatedAt',
  'source',
  'matchedItemId',
  'matchedItem',
  'organization',
  'createdBy',
];

@ApiTags('work-items')
@ApiBearerAuth()
@Controller('work-items')
@UseGuards(JwtAuthGuard)
export class WorkItemsController {
  constructor(private readonly service: WorkItemsService) {}

  @Get()
  @ApiOperation({ summary: 'List WorkItems in the selected Organization' })
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiOkResponse({ type: WorkItemPageDto })
  list(@Query() query: WorkItemListQueryDto, @Req() request: Request) {
    forbidRequestFields(request.query, ['organizationId', 'createdById']);
    return this.service.list(
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      query,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Create a manual WorkItem without matching',
    description: 'STAFF+. Source, initial status and creator are server-owned.',
  })
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiCreatedResponse({ type: WorkItemDto })
  @ApiForbiddenResponse({ description: 'STAFF membership is required.' })
  create(@Body() body: CreateWorkItemDto, @Req() request: Request) {
    forbidRequestFields(request.body, [...IMMUTABLE_FIELDS, 'status']);
    return this.service.create(
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      body,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Read a WorkItem using its derived Organization' })
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: false })
  @ApiOkResponse({ type: WorkItemDto })
  @ApiNotFoundResponse({ description: 'Resource missing or not accessible.' })
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.service.findById(
      id,
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Transition a WorkItem; STAFF+ only' })
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: false })
  @ApiOkResponse({ type: WorkItemDto })
  @ApiForbiddenResponse({ description: 'STAFF membership is required.' })
  @ApiNotFoundResponse({ description: 'Resource missing or not accessible.' })
  @ApiConflictResponse({
    description:
      'WORK_ITEM_TRANSITION_INVALID or ORGANIZATION_CONTEXT_CONFLICT.',
  })
  transition(
    @Param('id') id: string,
    @Body() body: TransitionWorkItemDto,
    @Req() request: Request,
  ) {
    forbidRequestFields(request.body, [...IMMUTABLE_FIELDS, 'rawValue']);
    return this.service.transition(
      id,
      this.userId(request),
      body.status,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  private userId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
