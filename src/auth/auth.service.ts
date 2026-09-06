import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser, JwtPayload } from './auth.types.js';
import { hashPassword, verifyPassword } from './password.utils.js';

const ACCESS_TOKEN_EXPIRES_IN = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    const passwordMatches = user
      ? await verifyPassword(user.passwordHash, password).catch(() => false)
      : false;

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.createTokens(user);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: tokens.refreshTokenHash,
        refreshTokenExpires: tokens.refreshTokenExpires,
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user,
    };
  }

  async refresh(refreshToken: string) {
    const userId = this.getRefreshTokenUserId(refreshToken);
    if (!userId) throw new UnauthorizedException('Invalid refresh token');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !user?.refreshToken ||
      !user.refreshTokenExpires ||
      user.refreshTokenExpires <= new Date()
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const matches = await verifyPassword(user.refreshToken, refreshToken).catch(
      () => false,
    );
    if (!matches) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.createTokens(user);
    const rotated = await this.prisma.user.updateMany({
      where: {
        id: user.id,
        refreshToken: user.refreshToken,
        refreshTokenExpires: { gt: new Date() },
      },
      data: {
        refreshToken: tokens.refreshTokenHash,
        refreshTokenExpires: tokens.refreshTokenExpires,
      },
    });

    if (rotated.count !== 1) {
      throw new UnauthorizedException('Refresh token has already been rotated');
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toAuthenticatedUser(user),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const userId = this.getRefreshTokenUserId(refreshToken);
    if (!userId) throw new UnauthorizedException('Invalid refresh token');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await verifyPassword(user.refreshToken, refreshToken).catch(
      () => false,
    );
    if (!matches) throw new UnauthorizedException('Invalid refresh token');

    await this.prisma.user.updateMany({
      where: { id: user.id, refreshToken: user.refreshToken },
      data: { refreshToken: null, refreshTokenExpires: null },
    });
  }

  async validateUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.toAuthenticatedUser(user);
  }

  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    return this.validateUser(userId);
  }

  private async createTokens(user: {
    id: string;
    email: string;
    name: string | null;
    passwordHash: string;
  }) {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });
    const refreshToken = `${user.id}.${uuid()}`;
    const refreshTokenHash = await hashPassword(refreshToken);
    const refreshTokenExpires = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    return {
      accessToken,
      refreshToken,
      refreshTokenHash,
      refreshTokenExpires,
      user: this.toAuthenticatedUser(user),
    };
  }

  private getRefreshTokenUserId(refreshToken: string): string | null {
    const separator = refreshToken.indexOf('.');
    if (separator <= 0 || separator === refreshToken.length - 1) return null;
    return refreshToken.slice(0, separator);
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    name: string | null;
  }): AuthenticatedUser {
    return { id: user.id, email: user.email, name: user.name, roles: [] };
  }
}
