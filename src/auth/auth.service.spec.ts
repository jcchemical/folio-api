import argon2 from 'argon2';
import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword } from './password.utils.js';
import { AuthService } from './auth.service.js';

vi.setConfig({ testTimeout: 15_000 });

const user = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User',
  passwordHash: '',
  refreshToken: null as string | null,
  refreshTokenExpires: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createService(
  passwordHash: string,
  refreshToken: string | null = null,
  refreshTokenExpires: Date | null = null,
) {
  const state = {
    user: { ...user, passwordHash, refreshToken, refreshTokenExpires },
  };
  const prisma = {
    user: {
      findUnique: vi.fn().mockImplementation(() => Promise.resolve(state.user)),
      update: vi.fn().mockImplementation(({ data }) => {
        state.user = { ...state.user, ...data };
        return Promise.resolve(state.user);
      }),
      updateMany: vi.fn().mockImplementation(({ data }) => {
        state.user = { ...state.user, ...data };
        return Promise.resolve({ count: 1 });
      }),
    },
  } as unknown as PrismaService;
  const jwtService = {
    signAsync: vi.fn().mockResolvedValue('access-token'),
  } as unknown as JwtService;

  return { service: new AuthService(prisma, jwtService), state };
}

describe('AuthService password verification', () => {
  it('logs in with the correct password', async () => {
    const { service, state } = createService(await hashPassword('correct-password'));

    const result = await service.login('user@example.com', 'correct-password');

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toMatch(/^user-1\.[0-9a-f-]{36}$/);
    expect(await argon2.verify(state.user.refreshToken!, result.refreshToken)).toBe(true);
    expect(result.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      roles: [],
    });
  });

  it('refreshes a valid token and rotates it', async () => {
    const { service } = createService(await hashPassword('password'));
    const login = await service.login('user@example.com', 'password');

    const refreshed = await service.refresh(login.refreshToken);

    expect(refreshed.accessToken).toBe('access-token');
    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
  });

  it('rejects an expired refresh token with 401', async () => {
    const token = 'user-1.expired-token';
    const { service } = createService(
      await hashPassword('password'),
      await hashPassword(token),
      new Date(Date.now() - 1_000),
    );

    await expect(service.refresh(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an invalid refresh token with 401', async () => {
    const { service } = createService(await hashPassword('password'));

    await expect(service.refresh('user-1.invalid-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logs out and invalidates the refresh token', async () => {
    const { service, state } = createService(await hashPassword('password'));
    const login = await service.login('user@example.com', 'password');

    await service.logout(login.refreshToken);

    expect(state.user.refreshToken).toBeNull();
    expect(state.user.refreshTokenExpires).toBeNull();
    await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns the current user without a password hash', async () => {
    const { service } = createService(await hashPassword('correct-password'));

    await expect(service.getCurrentUser('user-1')).resolves.toEqual({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      roles: [],
    });
  });

  it('rejects the current-user lookup when the user no longer exists', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new AuthService(prisma, {} as JwtService);

    await expect(service.getCurrentUser('missing-user')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an incorrect password with the existing 401 error', async () => {
    const { service } = createService(await hashPassword('correct-password'));

    await expect(
      service.login('user@example.com', 'wrong-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a legacy plaintext value instead of comparing it directly', async () => {
    const { service } = createService('legacy-plaintext-password');

    await expect(
      service.login('user@example.com', 'legacy-plaintext-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
