import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PorbaseImportService } from './porbase-import.service.js';
import type { PorbaseImportDto } from './dto/porbase-import.dto.js';

const baseInput: PorbaseImportDto = {
  work: { title: 'Work title', subtitle: null, institutionId: null },
  edition: {
    title: 'Edition title',
    subtitle: null,
    isbn10: null,
    isbn13: '9789724426495',
    publisher: 'Publisher',
    publishDate: '2022-01-01',
    language: 'por',
    country: 'PT',
    format: null,
    pages: 383,
  },
  contributors: [
    { name: '  Jane   Doe ', role: 'AUTHOR', scope: 'WORK', sortOrder: 0 },
    { name: 'John Smith', role: 'TRANSLATOR', scope: 'EDITION', sortOrder: 0 },
  ],
  externalIdentifiers: [
    { type: 'ISBN-13', value: '978-972-44-2649-5', source: 'PORBASE' },
    { type: 'PORBASE', value: 'record-1', source: 'PORBASE' },
  ],
  bibliographicRecord: {
    format: 'MARCXCHANGE',
    schema: 'UNIMARC',
    source: 'PORBASE',
    remoteId: 'record-1',
    rawContent: '<collection />',
  },
  item: {
    label: null,
    location: null,
    status: 'OWNED',
    notes: null,
    institutionId: null,
  },
};

function createTransactionMock() {
  const work = { id: 'work-1' };
  const edition = { id: 'edition-1' };
  const contributor = { id: 'contributor-1', name: 'Jane Doe' };
  const tx = {
    institution: {
      findFirst: vi.fn().mockResolvedValue({ id: 'institution-1' }),
    },
    edition: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(edition),
    },
    work: {
      create: vi.fn().mockResolvedValue(work),
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: work.id,
        institution: null,
        editions: [
          {
            ...edition,
            externalIdentifiers: [],
            bibliographicRecords: [],
            items: [],
            editionContributors: [],
          },
        ],
        workContributors: [],
        bibliographicRecords: [],
      }),
    },
    contributor: {
      findMany: vi.fn().mockResolvedValue([contributor]),
      create: vi
        .fn()
        .mockResolvedValue({ id: 'contributor-2', name: 'John Smith' }),
    },
    workContributor: { create: vi.fn().mockResolvedValue({}) },
    editionContributor: { create: vi.fn().mockResolvedValue({}) },
    externalIdentifier: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    bibliographicRecord: {
      create: vi.fn().mockResolvedValue({ id: 'record-1' }),
    },
    item: { create: vi.fn().mockResolvedValue({ id: 'item-1' }) },
  };

  return { tx, work, edition };
}

describe('PorbaseImportService', () => {
  it('persists a valid import atomically using the authenticated user id', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(prisma as never);

    const result = await service.import('jwt-user-1', baseInput);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.work.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'jwt-user-1' }),
    });
    expect(tx.item.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'jwt-user-1' }),
    });
    expect(result.id).toBe('work-1');
  });

  it('rejects an institution that does not exist for the authenticated user', async () => {
    const { tx } = createTransactionMock();
    tx.institution.findFirst.mockResolvedValue(null);
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(prisma as never);
    const input = {
      ...baseInput,
      work: { ...baseInput.work, institutionId: 'other' },
    };

    await expect(service.import('jwt-user-1', input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.work.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate ISBN belonging to the same user', async () => {
    const { tx } = createTransactionMock();
    tx.edition.findFirst.mockResolvedValue({ id: 'existing-edition' });
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(prisma as never);

    await expect(
      service.import('jwt-user-1', baseInput),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.work.create).not.toHaveBeenCalled();
  });

  it('allows imports without ISBNs', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(prisma as never);
    const input = {
      ...baseInput,
      edition: { ...baseInput.edition, isbn10: null, isbn13: null },
      externalIdentifiers: [],
    };

    await expect(service.import('jwt-user-1', input)).resolves.toBeDefined();
    expect(tx.edition.findFirst).not.toHaveBeenCalled();
  });

  it('validates ISBNs before opening a transaction', async () => {
    const prisma = { $transaction: vi.fn() };
    const service = new PorbaseImportService(prisma as never);
    const input = {
      ...baseInput,
      edition: { ...baseInput.edition, isbn13: '9789724426496' },
    };

    await expect(service.import('jwt-user-1', input)).rejects.toThrow(
      'not a valid ISBN',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rolls back when an internal creation fails', async () => {
    const { tx } = createTransactionMock();
    tx.item.create.mockRejectedValue(new Error('item failure'));
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(prisma as never);

    await expect(service.import('jwt-user-1', baseInput)).rejects.toThrow(
      'item failure',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('reuses an exact normalized contributor name and creates unmatched names', async () => {
    const { tx } = createTransactionMock();
    const prisma = {
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    };
    const service = new PorbaseImportService(prisma as never);

    await service.import('jwt-user-1', baseInput);

    expect(tx.contributor.create).toHaveBeenCalledTimes(1);
    expect(tx.workContributor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ contributorId: 'contributor-1' }),
    });
    expect(tx.editionContributor.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ contributorId: 'contributor-2' }),
    });
  });
});
