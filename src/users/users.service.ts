import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { User } from '@prisma/client';
import { hashPassword } from '../auth/password.utils.js';

export type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PublicUser[]> {
    const users = await this.prisma.user.findMany();
    return users.map(({ passwordHash: _passwordHash, ...user }) => user);
  }

  async findOne(id: string): Promise<PublicUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;

    const { passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser;
  }

  async create(data: {
    email: string;
    name?: string | null;
    passwordHash: string;
  }): Promise<PublicUser> {
    const passwordHash = await hashPassword(data.passwordHash);

    return this.prisma.user.create({
      data: { ...data, passwordHash },
    }).then(({ passwordHash: _storedPasswordHash, ...user }) => user);
  }

  async update(
    id: string,
    data: { email?: string; name?: string | null },
  ): Promise<PublicUser> {
    return this.prisma.user.update({
      where: { id },
      data,
    }).then(({ passwordHash: _storedPasswordHash, ...user }) => user);
  }

  async remove(id: string): Promise<PublicUser> {
    return this.prisma.user.delete({
      where: { id },
    }).then(({ passwordHash: _storedPasswordHash, ...user }) => user);
  }
}