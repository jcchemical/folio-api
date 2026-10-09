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
import { forbidRequestFields } from '../common/forbid-request-fields.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import { AgentsService } from './agents.service.js';
import {
  AgentDto,
  AgentListQueryDto,
  AgentPageDto,
  CreateAgentDto,
  UpdateAgentDto,
} from './dto/agent.dto.js';

const derivedHeader = {
  name: FOLIO_ORGANIZATION_HEADER,
  required: false,
  description: 'Optional consistency check; must match the Agent Organization.',
};

@ApiTags('agents')
@ApiBearerAuth()
@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List Agents in one organization',
    description: 'X-Folio-Organization-Id is required. kind refines results.',
  })
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiOkResponse({ type: AgentPageDto })
  findAll(@Query() query: AgentListQueryDto, @Req() request: Request) {
    forbidRequestFields(request.query, ['organizationId']);
    return this.service.list(
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      query,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Create an Agent in the selected organization',
    description:
      'X-Folio-Organization-Id is required and is the only tenant authority. STAFF+ only.',
  })
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiForbiddenResponse({ description: 'STAFF membership is required.' })
  @ApiCreatedResponse({ type: AgentDto })
  create(@Body() body: CreateAgentDto, @Req() request: Request) {
    forbidRequestFields(request.body, ['organizationId']);
    return this.service.create(
      this.userId(request),
      body,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Get(':id')
  @ApiHeader(derivedHeader)
  @ApiOperation({ summary: 'Get an Agent' })
  @ApiOkResponse({ type: AgentDto })
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.service.findById(
      id,
      this.userId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Patch(':id')
  @ApiHeader(derivedHeader)
  @ApiOperation({ summary: 'Update an Agent' })
  @ApiForbiddenResponse({ description: 'STAFF membership is required.' })
  @ApiOkResponse({ type: AgentDto })
  update(
    @Param('id') id: string,
    @Body() body: UpdateAgentDto,
    @Req() request: Request,
  ) {
    forbidRequestFields(request.body, ['organizationId']);
    return this.service.update(
      id,
      this.userId(request),
      body,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Delete(':id')
  @ApiHeader(derivedHeader)
  @ApiOperation({
    summary: 'Delete an Agent',
    description:
      'Fails with CONFLICT_FOREIGN_KEY_REFERENCE while Contributions reference the Agent.',
  })
  @ApiForbiddenResponse({ description: 'STAFF membership is required.' })
  @ApiOkResponse({ type: AgentDto })
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
