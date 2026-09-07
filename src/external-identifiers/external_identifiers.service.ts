import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { paginate, paginationArgs, type PaginationInput } from '../common/pagination.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';

export interface ExternalIdentifierInput {
  type: string;
  value: string;
  source?: string | null;
  editionId: string;
}

@Injectable()
export class ExternalIdentifiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async findAllByUser(userId: string, query: PaginationInput = {}) {
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.externalIdentifier.findMany({
      where: { edition: { work: { organization: { memberships: { some: { userId } } } } } },
      orderBy: { createdAt: 'desc' },
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async create(userId: string, data: ExternalIdentifierInput) {
    const edition = await this.assertEditionOwnership(data.editionId, userId);
    try {
      return await this.prisma.externalIdentifier.create({
        data: { ...data, organizationId: edition.work.organizationId },
      });
    } catch (error: unknown) {
      throw this.mapUniqueViolation(error, data.type, data.value);
    }
  }

  async update(
    id: string,
    userId: string,
    data: Partial<ExternalIdentifierInput>,
  ) {
    const identifier = await this.assertIdentifierOwnership(id, userId);
    const { editionId, ...changes } = data;
    const edition = editionId
      ? await this.assertEditionOwnership(editionId, userId)
      : identifier.edition;
    if (edition.work.organizationId !== identifier.edition.work.organizationId) {
      throw new BadRequestException(
        'External identifiers cannot be reassigned across organizations',
      );
    }
    try {
      return await this.prisma.externalIdentifier.update({
        where: { id },
        data: {
          ...changes,
          ...(editionId ? { editionId } : {}),
          organizationId: edition.work.organizationId,
        },
      });
    } catch (error: unknown) {
      throw this.mapUniqueViolation(error, changes.type ?? identifier.type, changes.value ?? identifier.value);
    }
  }

  async remove(id: string, userId: string) {
    await this.assertIdentifierOwnership(id, userId);
    return this.prisma.externalIdentifier.delete({ where: { id } });
  }

  private async assertEditionOwnership(editionId: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { work: true },
    });
    if (!edition) throw new NotFoundException('Edition not found');
    await this.organizationMemberships.assertWorkWriteAccess(userId, edition.work);
    return edition;
  }

  private async assertIdentifierOwnership(id: string, userId: string) {
    const identifier = await this.prisma.externalIdentifier.findUnique({
      where: { id },
      include: { edition: { include: { work: true } } },
    });
    if (!identifier) throw new NotFoundException('External identifier not found');
    await this.organizationMemberships.assertWorkWriteAccess(
      userId,
      identifier.edition.work,
    );
    return identifier;
  }

  private mapUniqueViolation(error: unknown, type: string, value: string) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException(`External identifier ${type}:${value} already exists`);
    }
    return error;
  }
}
