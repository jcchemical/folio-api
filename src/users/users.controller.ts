import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import type { User } from '@prisma/client';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<User | null> {
    return this.usersService.findOne(id);
  }

  @Post()
  async create(
    @Body() body: {
      email: string;
      name?: string | null;
      passwordHash: string;
    },
  ): Promise<User> {
    return this.usersService.create(body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { email?: string; name?: string | null },
  ): Promise<User> {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<User> {
    return this.usersService.remove(id);
  }
}