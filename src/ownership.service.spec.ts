import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from './prisma/prisma.service.js';
import { WorksService } from './works/works.service.js';
import { EditionsService } from './editions/editions.service.js';
import { ItemsService } from './items/items.service.js';
import { InstitutionsService } from './institutions/institutions.service.js';
import { ContributorsService } from './contributors/contributors.service.js';
import { BibliographicRecordsService } from './bibliographic-records/bibliographic_records.service.js';
import { ExternalIdentifiersService } from './external-identifiers/external_identifiers.service.js';

const userId = 'user-1';
const otherUserId = 'user-2';

function prismaWith(model: Record<string, unknown>): PrismaService {
  return { [Object.keys(model)[0]]: Object.values(model)[0] } as unknown as PrismaService;
}

describe('resource ownership', () => {
  it('allows a user to access their own work', async () => {
    const work = { id: 'work-1', userId, institution: null, editions: [] };
    const service = new WorksService(
      prismaWith({ work: { findUnique: vi.fn().mockResolvedValue(work) } }),
    );

    await expect(service.findById('work-1', userId)).resolves.toEqual(work);
  });

  it.each([
    ['missing work', () => new WorksService(prismaWith({ work: { findUnique: vi.fn().mockResolvedValue(null) } })).findById('work-1', userId)],
    ['missing edition', () => new EditionsService(prismaWith({ edition: { findUnique: vi.fn().mockResolvedValue(null) } })).findById('edition-1', userId)],
    ['missing item', () => new ItemsService(prismaWith({ item: { findUnique: vi.fn().mockResolvedValue(null) } })).findById('item-1', userId)],
    ['missing institution', () => new InstitutionsService(prismaWith({ institution: { findUnique: vi.fn().mockResolvedValue(null) } })).findById('institution-1', userId)],
  ])('%s returns 404 semantics', async (_name, action) => {
    await expect(action()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a work belonging to another user with 403', async () => {
    const service = new WorksService(
      prismaWith({ work: { findUnique: vi.fn().mockResolvedValue({ id: 'work-1', userId: otherUserId }) } }),
    );

    await expect(service.findById('work-1', userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an edition belonging to another user with 403', async () => {
    const service = new EditionsService(
      prismaWith({
        edition: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'edition-1',
            work: { userId: otherUserId },
          }),
        },
      }),
    );

    await expect(service.findById('edition-1', userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an item belonging to another user with 403', async () => {
    const service = new ItemsService(
      prismaWith({ item: { findUnique: vi.fn().mockResolvedValue({ id: 'item-1', userId: otherUserId }) } }),
    );

    await expect(service.findById('item-1', userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an institution belonging to another user with 403', async () => {
    const service = new InstitutionsService(
      prismaWith({ institution: { findUnique: vi.fn().mockResolvedValue({ id: 'institution-1', userId: otherUserId }) } }),
    );

    await expect(service.findById('institution-1', userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a contributor linked to another user with 403', async () => {
    const service = new ContributorsService(
      prismaWith({
        contributor: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'contributor-1',
            workContributors: [{ work: { userId: otherUserId } }],
            editionContributors: [],
          }),
        },
      }),
    );

    await expect(service.findById('contributor-1', userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a bibliographic record linked to another user with 403', async () => {
    const service = new BibliographicRecordsService(
      prismaWith({
        bibliographicRecord: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'record-1',
            work: { userId: otherUserId },
            edition: null,
          }),
        },
      }),
    );

    await expect(
      service.update('record-1', userId, { source: 'test' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an external identifier linked to another user with 403', async () => {
    const service = new ExternalIdentifiersService(
      prismaWith({
        externalIdentifier: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'identifier-1',
            edition: { work: { userId: otherUserId } },
          }),
        },
      }),
    );

    await expect(service.update('identifier-1', userId, { value: 'x' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
