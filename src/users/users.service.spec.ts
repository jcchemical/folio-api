import argon2 from 'argon2';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ARGON2_OPTIONS } from '../auth/password.utils.js';
import { UsersService } from './users.service.js';

vi.setConfig({ testTimeout: 15_000 });

const baseUser = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User',
  passwordHash: '',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createService() {
  const prisma = {
    user: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...baseUser, ...data }),
      ),
      findAll: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  } as unknown as PrismaService;

  const organizationMemberships = {
      provisionPersonalOrganization: vi.fn().mockResolvedValue({
        id: 'organization-1',
      }),
    };

  return {
    prisma,
    organizationMemberships,
    service: new UsersService(prisma, organizationMemberships as never),
  };
}

describe('UsersService password hashing', () => {
  it('hashes the password before creating a user', async () => {
    const { prisma, service, organizationMemberships } = createService();

    const created = await service.create({
      email: 'user@example.com',
      name: 'User',
      password: 'plain-password',
    });
    const storedData = vi.mocked(prisma.user.create).mock.calls[0][0].data;

    expect(storedData.passwordHash).not.toBe('plain-password');
    expect(await argon2.verify(storedData.passwordHash, 'plain-password')).toBe(
      true,
    );
    expect(created).not.toHaveProperty('passwordHash');
    expect(organizationMemberships.provisionPersonalOrganization).toHaveBeenCalledWith(
      'user-1',
      'user@example.com',
    );
  });

  it('uses Argon2id with an explicit memory, time and parallelism cost', () => {
    expect(ARGON2_OPTIONS.type).toBe(argon2.argon2id);
    expect(ARGON2_OPTIONS.memoryCost).toBe(65_536);
    expect(ARGON2_OPTIONS.timeCost).toBe(3);
    expect(ARGON2_OPTIONS.parallelism).toBe(1);
  });

  it('generates a different salted hash for the same password', async () => {
    const { prisma, service } = createService();
    const input = {
      email: 'user@example.com',
      password: 'same-password',
    };

    await service.create(input);
    await service.create(input);

    const calls = vi.mocked(prisma.user.create).mock.calls;
    const firstHash = calls[0][0].data.passwordHash;
    const secondHash = calls[1][0].data.passwordHash;

    expect(firstHash).not.toBe(secondHash);
    expect(await argon2.verify(firstHash, 'same-password')).toBe(true);
    expect(await argon2.verify(secondHash, 'same-password')).toBe(true);
  });
});
