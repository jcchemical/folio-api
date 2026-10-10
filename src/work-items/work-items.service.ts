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

  async scan(
    userId: string,
    headerValue: OrganizationHeaderValue,
    data: CreateWorkItemDto,
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
      requiredRole: OrganizationRole.STAFF,
    });
    validateRawValue(data.rawValue);
    return this.prisma.workItem.create({
      data: {
        organizationId: context.organizationId,
        createdById: userId,
        source: WorkItemSource.SCAN,
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
    if (
      workItem.matchedItemId !== null &&
      status === WorkItemStatus.NEEDS_REVIEW
    ) {
      throw invalidTransition();
    }
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

  async match(
    id: string,
    userId: string,
    itemId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const workItem = await this.requireWorkItem(
      id,
      userId,
      headerValue,
      OrganizationRole.STAFF,
    );
    if (workItem.status === WorkItemStatus.VALIDATED) {
      throw matchInvalidState();
    }
    if (workItem.matchedItemId !== null) {
      throw matchAlreadyPresent();
    }

    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        holding: {
          select: {
            edition: {
              select: { work: { select: { organizationId: true } } },
            },
            location: {
              select: { library: { select: { organizationId: true } } },
            },
          },
        },
      },
    });
    if (
      !item ||
      item.holding.edition.work.organizationId !== workItem.organizationId ||
      item.holding.location.library.organizationId !== workItem.organizationId
    ) {
      throw resourceNotFound();
    }
    if (
      workItem.status !== WorkItemStatus.NEEDS_REVIEW &&
      workItem.status !== WorkItemStatus.IDENTIFIED
    ) {
      throw matchInvalidState();
    }

    const rows = await this.prisma.workItem.updateManyAndReturn({
      where: {
        id,
        organizationId: workItem.organizationId,
        status: workItem.status,
        matchedItemId: null,
      },
      data: {
        matchedItemId: item.id,
        status: WorkItemStatus.IDENTIFIED,
      },
    });
    if (!rows[0]) {
      const latest = await this.prisma.workItem.findUnique({ where: { id } });
      if (latest?.matchedItemId) throw matchAlreadyPresent();
      throw matchInvalidState();
    }
    return rows[0];
  }

  async unmatch(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    const workItem = await this.requireWorkItem(
      id,
      userId,
      headerValue,
      OrganizationRole.STAFF,
    );
    if (workItem.status === WorkItemStatus.VALIDATED) {
      throw matchInvalidState();
    }
    if (workItem.matchedItemId === null) {
      throw matchNotPresent();
    }
    if (workItem.status !== WorkItemStatus.IDENTIFIED) {
      throw matchInvalidState();
    }

    const rows = await this.prisma.workItem.updateManyAndReturn({
      where: {
        id,
        organizationId: workItem.organizationId,
        status: workItem.status,
        matchedItemId: workItem.matchedItemId,
      },
      data: {
        matchedItemId: null,
        status: WorkItemStatus.NEEDS_REVIEW,
      },
    });
    if (!rows[0]) {
      const latest = await this.prisma.workItem.findUnique({ where: { id } });
      if (latest?.status === WorkItemStatus.VALIDATED) {
        throw matchInvalidState();
      }
      if (latest?.matchedItemId === null) throw matchNotPresent();
      throw matchInvalidState();
    }
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

function validateRawValue(rawValue: string): void {
  if (!rawValue.trim()) {
    throw new ApiException(
      HttpStatus.BAD_REQUEST,
      API_ERROR_CODES.INVALID_REQUEST_DATA,
      'The capture value must not be blank.',
    );
  }
}

function resourceNotFound(): ApiException {
  return new ApiException(
    HttpStatus.NOT_FOUND,
    API_ERROR_CODES.RESOURCE_NOT_FOUND,
    'The requested resource was not found.',
  );
}

function matchNotPresent(): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    API_ERROR_CODES.WORK_ITEM_MATCH_NOT_PRESENT,
    'The WorkItem does not have an Item match.',
  );
}

function matchAlreadyPresent(): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    API_ERROR_CODES.WORK_ITEM_MATCH_ALREADY_PRESENT,
    'The WorkItem already has an Item match.',
  );
}

function matchInvalidState(): ApiException {
  return new ApiException(
    HttpStatus.CONFLICT,
    API_ERROR_CODES.WORK_ITEM_MATCH_INVALID_STATE,
    'The WorkItem state does not permit this match operation.',
  );
}
