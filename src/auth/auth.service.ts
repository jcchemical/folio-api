import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuid } from 'uuid';
import {
  API_ERROR_CODES,
  ApiException,
  invalidAccessToken,
} from '../common/api-errors.js';
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
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        API_ERROR_CODES.INVALID_CREDENTIALS,
        'Invalid email or password.',
      );
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
    if (!userId) throw invalidRefreshToken();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.refreshToken || !user.refreshTokenExpires) {
      throw invalidRefreshToken();
    }
    if (user.refreshTokenExpires <= new Date()) {
      throw expiredRefreshToken();
    }

    const matches = await verifyPassword(user.refreshToken, refreshToken).catch(
      () => false,
    );
    if (!matches) throw invalidRefreshToken();

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
      throw reusedRefreshToken();
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.toAuthenticatedUser(user),
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const userId = this.getRefreshTokenUserId(refreshToken);
    if (!userId) throw invalidRefreshToken();

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.refreshToken) {
      throw invalidRefreshToken();
    }

    const matches = await verifyPassword(user.refreshToken, refreshToken).catch(
      () => false,
    );
    if (!matches) throw invalidRefreshToken();

    await this.prisma.user.updateMany({
      where: { id: user.id, refreshToken: user.refreshToken },
      data: { refreshToken: null, refreshTokenExpires: null },
    });
  }

  async validateUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw invalidAccessToken();
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

function invalidRefreshToken(): ApiException {
  return new ApiException(
    HttpStatus.UNAUTHORIZED,
    API_ERROR_CODES.INVALID_REFRESH_TOKEN,
    'The refresh token is invalid.',
  );
}

function expiredRefreshToken(): ApiException {
  return new ApiException(
    HttpStatus.UNAUTHORIZED,
    API_ERROR_CODES.EXPIRED_REFRESH_TOKEN,
    'The refresh token has expired.',
  );
}

function reusedRefreshToken(): ApiException {
  return new ApiException(
    HttpStatus.UNAUTHORIZED,
    API_ERROR_CODES.REUSED_REFRESH_TOKEN,
    'The refresh token has already been rotated.',
  );
}
