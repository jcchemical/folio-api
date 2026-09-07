import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { EditionInput } from '../works/works.service.js';
import { paginate, paginationArgs, type PaginationInput } from '../common/pagination.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';

@Injectable()
export class EditionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async findAllByUser(userId: string, query: PaginationInput = {}) {
    const { limit, prisma } = paginationArgs(query);
    const rows = await this.prisma.edition.findMany({
      where: {
        work: {
          organization: { memberships: { some: { userId } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        work: true,
        physicalDescriptions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
        },
      },
      ...prisma,
    });
    return paginate(rows, limit);
  }

  async findById(id: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id },
      include: {
        work: true,
        physicalDescriptions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
        },
        items: { where: { organization: { memberships: { some: { userId } } } } },
      },
    });
    await this.assertEditionAccess(edition, userId);
    return edition;
  }

  async create(userId: string, workId: string, data: EditionInput) {
    const work = await this.prisma.work.findUnique({ where: { id: workId } });
    if (!work) throw new NotFoundException('Work not found');
    await this.organizationMemberships.assertWorkWriteAccess(userId, work);
    const { physicalDescriptions, ...edition } = data;
    return this.prisma.edition.create({
      data: {
        ...edition,
        pageCount: derivePageCount(physicalDescriptions),
        workId,
        physicalDescriptions: physicalDescriptions?.length
          ? { create: physicalDescriptions.map(toPhysicalDescriptionCreate) }
          : undefined,
      },
      include: {
        physicalDescriptions: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: { parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
        },
      },
    });
  }

  async update(id: string, userId: string, data: Partial<EditionInput>) {
    await this.assertEditionOwnership(id, userId);
    const { physicalDescriptions, ...edition } = data;
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.edition.update({
        where: { id },
        data: { ...edition, pageCount: derivePageCount(physicalDescriptions) },
      });
      if (physicalDescriptions !== undefined) {
        await transaction.physicalDescription.deleteMany({ where: { editionId: id } });
        if (physicalDescriptions.length) {
          await transaction.physicalDescription.createMany({
            data: physicalDescriptions.map((description) => ({
              editionId: id,
              sortOrder: description.sortOrder,
              source: description.source ?? null,
            })),
          });
          const fields = await transaction.physicalDescription.findMany({
            where: { editionId: id },
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          });
          for (const [index, description] of physicalDescriptions.entries()) {
            const field = fields[index];
            await transaction.physicalDescriptionPart.createMany({
              data: description.parts.map((part) => ({
                physicalDescriptionId: field.id,
                subfield: part.subfield.toLowerCase(),
                value: part.value.trim(),
                sortOrder: part.sortOrder,
                normalizedValue: null,
              })),
            });
          }
        }
      }
      return transaction.edition.findUniqueOrThrow({
        where: { id: updated.id },
        include: {
          physicalDescriptions: {
            orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
            include: { parts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
          },
        },
      });
    });
  }

  async remove(id: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({ where: { id }, include: { work: true } });
    await this.assertEditionWriteAccess(edition, userId);
    return this.prisma.edition.delete({ where: { id } });
  }

  private async assertEditionOwnership(id: string, userId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id },
      include: { work: true },
    });
    await this.assertEditionWriteAccess(edition, userId);
  }

  private async assertEditionAccess(
    edition: { work: { organizationId: string } } | null,
    userId: string,
  ): Promise<void> {
    if (!edition) throw new NotFoundException('Edition not found');
    await this.organizationMemberships.assertWorkAccess(userId, edition.work);
  }

  private async assertEditionWriteAccess(
    edition: { work: { organizationId: string } } | null,
    userId: string,
  ): Promise<void> {
    if (!edition) throw new NotFoundException('Edition not found');
    await this.organizationMemberships.assertWorkWriteAccess(userId, edition.work);
  }
}

function toPhysicalDescriptionCreate(description: NonNullable<EditionInput['physicalDescriptions']>[number]) {
  return {
    sortOrder: description.sortOrder,
    source: description.source ?? null,
    parts: {
      create: description.parts.map((part) => ({
        subfield: part.subfield.toLowerCase(),
        value: part.value.trim(),
        sortOrder: part.sortOrder,
        normalizedValue: null,
      })),
    },
  };
}

function derivePageCount(
  descriptions: EditionInput['physicalDescriptions'] | undefined,
): number | null {
  const candidates = (descriptions ?? [])
    .flatMap(({ parts }) => parts)
    .filter(({ subfield }) => subfield.toLowerCase() === 'a')
    .map(({ value }) => /^(\d+)\s*(?:p\.?|pages?)$/i.exec(value.trim())?.[1])
    .filter((value): value is string => Boolean(value));
  return candidates.length === 1 ? Number(candidates[0]) : null;
}
