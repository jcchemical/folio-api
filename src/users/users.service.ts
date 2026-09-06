import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { User } from '@prisma/client';
import { hashPassword } from '../auth/password.utils.js';
import { paginate, paginationArgs, type PaginationInput } from '../common/pagination.js';

export type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: PaginationInput = {}) {
    const { limit, prisma } = paginationArgs(query);
    const users = await this.prisma.user.findMany({
      where: { id: userId },
      orderBy: { id: 'asc' },
      ...prisma,
    });
    return paginate(
      users.map(({ passwordHash: _passwordHash, ...user }) => user),
      limit,
    );
  }

  async findOne(id: string, userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    this.assertOwnership(user, userId);

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

  async create(data: {
    email: string;
    name?: string | null;
    password: string;
  }): Promise<PublicUser> {
    const passwordHash = await hashPassword(data.password);

    return this.prisma.user.create({
      data: { email: data.email, name: data.name, passwordHash },
    }).then(({ passwordHash: _storedPasswordHash, ...user }) => user);
  }

  async update(
    id: string,
    userId: string,
    data: { email?: string; name?: string | null },
  ): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    this.assertOwnership(user, userId);
    return this.prisma.user.update({
      where: { id },
      data,
    }).then(({ passwordHash: _storedPasswordHash, ...user }) => user);
  }

  async remove(id: string, userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    this.assertOwnership(user, userId);
    return this.prisma.user.delete({
      where: { id },
    }).then(({ passwordHash: _storedPasswordHash, ...user }) => user);
  }

  private assertOwnership(
    user: User | null,
    userId: string,
  ): asserts user is User {
    if (!user) throw new NotFoundException('User not found');
    if (user.id !== userId) {
      throw new ForbiddenException('User does not belong to the authenticated user');
    }
  }
}