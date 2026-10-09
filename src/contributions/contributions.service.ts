import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentKind,
  ContributionSource,
  OrganizationRole,
  type Prisma,
  type PrismaClient,
} from '@prisma/client';
import {
  API_ERROR_CODES,
  ApiException,
  conflictAgentOrganizationMismatch,
} from '../common/api-errors.js';
import { paginate, paginationArgs } from '../common/pagination.js';
import type { PaginationInput } from '../common/pagination.js';
import { OrganizationContextResolver } from '../organizations/organization-context.resolver.js';
import { parseOrganizationContextHeader } from '../organizations/organization-context.resolver.js';
import type { OrganizationHeaderValue } from '../organizations/organization-context.resolver.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ContributionListQueryDto,
  CreateContributionDto,
  UpdateContributionDto,
} from './contributions.dto.js';

const contributionInclude = {
  agent: true,
  sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.ContributionInclude;

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export type ContributionSourcePartInput = {
  code: string;
  value: string;
  sortOrder: number;
};

export type PorbaseContributionInput = {
  targetScope: 'WORK';
  kind: AgentKind;
  displayName: string;
  roleLabel?: string;
  relationshipCodeScheme?: string;
  authorityId?: string | null;
  sourceTag: '700' | '701' | '702' | '710' | '711' | '712' | '713';
  indicator1: string;
  indicator2: string;
  sourceParts: ContributionSourcePartInput[];
  sortOrder: number;
};

@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contexts: OrganizationContextResolver,
  ) {}

  async createManual(
    userId: string,
    data: CreateContributionDto,
    headerValue?: OrganizationHeaderValue,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const target = await this.resolveTarget(
        transaction,
        data.workId,
        data.editionId,
      );
      await this.contexts.resolveDerivedContext({
        userId,
        headerValue,
        derivedOrganizationId: target.organizationId,
        requiredRole: OrganizationRole.STAFF,
      });
      if (Boolean(data.agentId) === Boolean(data.agent)) {
        throw new BadRequestException(
          'Provide exactly one of agentId or agent.',
        );
      }
      const agent = data.agentId
        ? await this.requireSameOrganizationAgent(
            transaction,
            data.agentId,
            target.organizationId,
          )
        : await this.findOrCreateAgent(
            transaction,
            target.organizationId,
            data.agent!.kind,
            data.agent!.displayName,
          );
      return transaction.contribution.create({
        data: {
          agentId: agent.id,
          ...(target.scope === 'WORK'
            ? { workId: target.id }
            : { editionId: target.id }),
          sortOrder: data.sortOrder ?? 0,
          roleLabel: data.roleLabel?.trim() || null,
          source: ContributionSource.MANUAL,
        },
        include: {
          agent: true,
          sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        },
      });
    });
  }

  async list(
    userId: string,
    headerValue: OrganizationHeaderValue,
    query: Partial<ContributionListQueryDto> & PaginationInput = {},
  ) {
    const context = await this.contexts.resolveRequiredRootContext({
      userId,
      headerValue,
    });
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.contribution.findMany({
      where: {
        AND: [
          {
            OR: [
              { work: { organizationId: context.organizationId } },
              { edition: { work: { organizationId: context.organizationId } } },
            ],
          },
          ...(query.workId ? [{ workId: query.workId }] : []),
          ...(query.editionId ? [{ editionId: query.editionId }] : []),
          ...(query.agentId ? [{ agentId: query.agentId }] : []),
        ],
      },
      include: contributionInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async findById(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const { organizationId, contribution } = await this.requireContribution(id);
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: organizationId,
    });
    return contribution;
  }

  async update(
    id: string,
    userId: string,
    data: UpdateContributionDto,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const { organizationId } = await this.requireContribution(id);
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    return this.prisma.contribution.update({
      where: { id },
      data: {
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.roleLabel !== undefined
          ? { roleLabel: data.roleLabel.trim() || null }
          : {}),
      },
      include: contributionInclude,
    });
  }

  async remove(
    id: string,
    userId: string,
    headerValue?: OrganizationHeaderValue,
  ) {
    parseOrganizationContextHeader(headerValue, false);
    const { organizationId } = await this.requireContribution(id);
    await this.contexts.resolveDerivedResourceContext({
      userId,
      headerValue,
      derivedOrganizationId: organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    return this.prisma.contribution.delete({
      where: { id },
      include: contributionInclude,
    });
  }

  private async requireContribution(id: string) {
    const contribution = await this.prisma.contribution.findUnique({
      where: { id },
      include: {
        ...contributionInclude,
        work: { select: { organizationId: true } },
        edition: { select: { work: { select: { organizationId: true } } } },
      },
    });
    if (!contribution) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        API_ERROR_CODES.RESOURCE_NOT_FOUND,
        'The requested resource was not found.',
      );
    }
    const { work, edition, ...rest } = contribution;
    return {
      organizationId: (work ?? edition!.work).organizationId,
      contribution: rest,
    };
  }

  async persistPorbase(
    transaction: TransactionClient,
    userId: string,
    workId: string,
    inputs: PorbaseContributionInput[],
  ) {
    if (!inputs.length) return [];
    const target = await this.resolveTarget(transaction, workId, undefined);
    await this.contexts.resolveDerivedContext({
      userId,
      headerValue: undefined,
      derivedOrganizationId: target.organizationId,
      requiredRole: OrganizationRole.STAFF,
    });
    const persisted = [];
    for (const input of inputs) {
      this.validatePorbaseInput(input);
      const agent = await this.findOrCreateAgent(
        transaction,
        target.organizationId,
        input.kind,
        input.displayName,
      );
      persisted.push(
        await transaction.contribution.create({
          data: {
            agentId: agent.id,
            workId,
            sortOrder: input.sortOrder,
            roleLabel: input.roleLabel ?? null,
            relationshipCodeScheme: input.relationshipCodeScheme ?? null,
            authorityId: input.authorityId ?? null,
            source: ContributionSource.PORBASE,
            sourceTag: input.sourceTag,
            indicator1: input.indicator1,
            indicator2: input.indicator2,
            sourceParts: {
              create: input.sourceParts.map((part) => ({
                code: part.code.toLowerCase(),
                value: part.value.trim(),
                sortOrder: part.sortOrder,
              })),
            },
          },
          include: {
            agent: true,
            sourceParts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          },
        }),
      );
    }
    return persisted;
  }

  private async resolveTarget(
    transaction: TransactionClient,
    workId?: string,
    editionId?: string,
  ) {
    if (Boolean(workId) === Boolean(editionId)) {
      throw new BadRequestException(
        'Contribution must target exactly one Work or Edition.',
      );
    }
    if (workId) {
      const work = await transaction.work.findUnique({ where: { id: workId } });
      if (!work) throw new NotFoundException('Work not found');
      return {
        id: work.id,
        scope: 'WORK' as const,
        organizationId: work.organizationId,
        work,
      };
    }
    const edition = await transaction.edition.findUnique({
      where: { id: editionId! },
      include: { work: true },
    });
    if (!edition) throw new NotFoundException('Edition not found');
    return {
      id: edition.id,
      scope: 'EDITION' as const,
      organizationId: edition.work.organizationId,
      work: edition.work,
    };
  }

  private async requireSameOrganizationAgent(
    transaction: TransactionClient,
    agentId: string,
    organizationId: string,
  ) {
    const agent = await transaction.agent.findUnique({
      where: { id: agentId },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    if (agent.organizationId !== organizationId)
      throw conflictAgentOrganizationMismatch();
    return agent;
  }

  private async findOrCreateAgent(
    transaction: TransactionClient,
    organizationId: string,
    kind: AgentKind,
    displayName: string,
  ) {
    const normalizedDisplayName = normalizeDisplayName(displayName);
    if (!normalizedDisplayName)
      throw new BadRequestException('Agent displayName is required.');
    const matches = await transaction.agent.findMany({
      where: { organizationId, kind, normalizedDisplayName },
      take: 2,
      orderBy: { id: 'asc' },
    });
    if (matches.length === 1) return matches[0];
    return transaction.agent.create({
      data: {
        organizationId,
        kind,
        displayName: displayName.trim(),
        normalizedDisplayName,
      },
    });
  }

  private validatePorbaseInput(input: PorbaseContributionInput): void {
    if (
      !['700', '701', '702', '710', '711', '712', '713'].includes(
        input.sourceTag,
      ) ||
      input.indicator1.length !== 1 ||
      input.indicator2.length !== 1 ||
      input.sourceParts.length === 0
    ) {
      throw new BadRequestException(
        'PORBASE contribution source metadata is invalid.',
      );
    }
    if (
      input.sourceParts.some(
        ({ code, value }) => !/^[a-z0-9]$/i.test(code) || !value.trim(),
      )
    ) {
      throw new BadRequestException(
        'PORBASE contribution source parts are invalid.',
      );
    }
  }
}

export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
