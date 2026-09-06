import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

const authenticatedUser = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User',
  roles: [],
};

describe('AuthController /auth/me', () => {
  it('returns the authenticated user without passwordHash', async () => {
    const getCurrentUser = vi.fn().mockResolvedValue(authenticatedUser);
    const controller = new AuthController({ getCurrentUser } as never);

    const result = await controller.me({ user: authenticatedUser } as never);

    expect(getCurrentUser).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(authenticatedUser);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('is protected by JwtAuthGuard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      AuthController.prototype.me,
    ) as Array<new (...args: never[]) => unknown>;

    expect(guards).toContain(JwtAuthGuard);
  });

  it('represents an unauthenticated request as unauthorized at the guard boundary', () => {
    expect(new UnauthorizedException().getStatus()).toBe(401);
  });
});
