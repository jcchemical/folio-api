import { HttpStatus, Injectable } from '@nestjs/common';
import { AgentKind, OrganizationRole } from '@prisma/client';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { paginate, paginationArgs } from '../common/pagination.js';
import type { PaginationInput } from '../common/pagination.js';
import { normalizeDisplayName } from '../contributions/contributions.service.js';
import {
  OrganizationContextResolver,
  parseOrganizationContextHeader,
} from '../organizations/organization-context.resolver.js';
import type { OrganizationHeaderValue } from '../organizations/organization-context.resolver.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AgentListQueryDto,
  CreateAgentDto,
  UpdateAgentDto,
} from './dto/agent.dto.js';

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
  ) {}

  async list(
    userId: string,
    headerValue: OrganizationHeaderValue,
    query: Partial<AgentListQueryDto> & PaginationInput = {},
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
    });
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.agent.findMany({
      where: {
        organizationId: context.organizationId,
        ...(query.kind ? { kind: query.kind } : {}),
      },
      orderBy: [{ normalizedDisplayName: 'asc' }, { id: 'asc' }],
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async create(
    userId: string,
    data: CreateAgentDto,
    headerValue?: OrganizationHeaderValue,
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
      requiredRole: OrganizationRole.STAFF,
    });
    const normalizedDisplayName = requireName(data.displayName);
    await this.assertUnique(
      context.organizationId,
      data.kind,
      normalizedDisplayName,
    );
    return this.prisma.agent.create({
      data: {
        organizationId: context.organizationId,
        kind: data.kind,
        displayName: data.displayName.trim(),
        normalizedDisplayName,
      },
    });
  }

  async findById(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const agent = await this.requireAgent(id);
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: agent.organizationId,
    });
    return agent;
  }

  async update(
    id: string,
    userId: string,
    data: UpdateAgentDto,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const agent = await this.requireAgent(id);
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: agent.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    const displayName = data.displayName ?? agent.displayName;
    const kind = data.kind ?? agent.kind;
    const normalizedDisplayName = requireName(displayName);
    await this.assertUnique(
      agent.organizationId,
      kind,
      normalizedDisplayName,
      id,
    );
    return this.prisma.agent.update({
      where: { id },
      data: { kind, displayName: displayName.trim(), normalizedDisplayName },
    });
  }

  async remove(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const agent = await this.requireAgent(id);
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: agent.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    return this.prisma.agent.delete({ where: { id } });
  }

  private async requireAgent(id: string) {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.RESOURCE_NOT_FOUND,
        'The requested resource was not found.',
      );
    }
    return agent;
  }

  private async assertUnique(
    organizationId: string,
    kind: AgentKind,
    normalizedDisplayName: string,
    excludeId?: string,
  ) {
    const existing = await this.prisma.agent.findFirst({
      where: {
        organizationId,
        kind,
        normalizedDisplayName,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        API_ERROR_CODES.DUPLICATE_RESOURCE,
        'An Agent with this kind and name already exists in this organization.',
      );
    }
  }
}

function requireName(displayName: string): string {
  const normalized = normalizeDisplayName(displayName);
  if (!normalized) {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      API_ERROR_CODES.INVALID_REQUEST_DATA,
      'Agent displayName is required.',
    );
  }
  return normalized;
}
