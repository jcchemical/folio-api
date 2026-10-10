import { HttpStatus, Injectable } from '@nestjs/common';
import {
  OrganizationRole,
  WorkItemSource,
  WorkItemStatus,
} from '@prisma/client';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
import { paginate, paginationArgs } from '../common/pagination.js';
import {
  OrganizationContextResolver,
  parseOrganizationContextHeader,
  type OrganizationHeaderValue,
} from '../organizations/organization-context.resolver.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateWorkItemDto,
  WorkItemListQueryDto,
} from './dto/work-item.dto.js';
import { canTransition } from './work-item-transitions.js';

@Injectable()
export class WorkItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
  ) {}

  async list(
    userId: string,
    headerValue: OrganizationHeaderValue,
    query: Partial<WorkItemListQueryDto> = {},
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
    });
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.workItem.findMany({
      where: {
        organizationId: context.organizationId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async create(
    userId: string,
    headerValue: OrganizationHeaderValue,
    data: CreateWorkItemDto,
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
      requiredRole: OrganizationRole.STAFF,
    });
    if (!data.rawValue.trim()) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        API_ERROR_CODES.INVALID_REQUEST_DATA,
        'The capture value must not be blank.',
      );
    }
    return this.prisma.workItem.create({
      data: {
        organizationId: context.organizationId,
        createdById: userId,
        source: WorkItemSource.MANUAL,
        status: WorkItemStatus.NEEDS_REVIEW,
        rawValue: data.rawValue,
      },
    });
  }

  async findById(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    return this.requireWorkItem(id, userId, headerValue);
  }

  async transition(
    id: string,
    userId: string,
    status: WorkItemStatus,
    headerValue?: OrganizationHeaderValue,
  ) {
    const workItem = await this.requireWorkItem(
      id,
      userId,
      headerValue,
      OrganizationRole.STAFF,
    );
    if (!canTransition(workItem.status, status)) throw invalidTransition();

    // Compare-and-set prevents a concurrent transition from bypassing the graph.
    const rows = await this.prisma.workItem.updateManyAndReturn({
      where: {
        id,
        organizationId: workItem.organizationId,
        status: workItem.status,
      },
      data: { status },
    });
    if (!rows[0]) throw invalidTransition();
    return rows[0];
  }

  private async requireWorkItem(
    id: string,
    userId: string,
    headerValue: OrganizationHeaderValue,
    requiredRole?: OrganizationRole,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const workItem = await this.prisma.workItem.findUnique({ where: { id } });
    if (!workItem) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.RESOURCE_NOT_FOUND,
        'The requested resource was not found.',
      );
    }
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: workItem.organizationId,
      requiredRole,
    });
    return workItem;
  }
}

function invalidTransition(): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    API_ERROR_CODES.WORK_ITEM_TRANSITION_INVALID,
    'The requested WorkItem transition is invalid or its state has changed.',
  );
}
