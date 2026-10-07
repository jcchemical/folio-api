import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationMembershipService } from '../organizations/organization-membership.service.js';

@Injectable()
export class BibliographicRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async findOne(userId: string, id: string) {
    const record = await this.prisma.bibliographicRecord.findUnique({
      where: { id },
      include: { edition: { include: { work: true } } },
    });
    if (!record) throw new NotFoundException('Bibliographic record not found');
    if (!record.edition)
      throw new NotFoundException('Bibliographic record has no Edition');

    await this.organizationMemberships.assertWorkAccess(
      userId,
      record.edition.work,
    );
    return record;
  }

  async findByEdition(userId: string, editionId: string) {
    const edition = await this.prisma.edition.findUnique({
      where: { id: editionId },
      include: { work: true },
    });
    if (!edition) throw new NotFoundException('Edition not found');
    await this.organizationMemberships.assertWorkAccess(userId, edition.work);
    return this.prisma.bibliographicRecord.findMany({
      where: { editionId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
