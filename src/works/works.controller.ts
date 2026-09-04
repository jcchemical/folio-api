import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { WorksService } from './works.service.js';
import type { Work } from '@prisma/client';

@ApiTags('works')
@ApiBearerAuth()
@Controller('works')
@UseGuards(JwtAuthGuard)
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Get()
  async findAll(@Req() request: Request): Promise<Work[]> {
    return this.worksService.findAllByUser(this.getUserId(request));
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Work | null> {
    return this.worksService.findById(id, this.getUserId(request));
  }

  @Post()
  async create(
    @Body()
    body: {
      title: string;
      description?: string | null;
      year?: number | null;
      institutionId?: string | null;
    },
    @Req() request: Request,
  ): Promise<Work> {
    return this.worksService.create(this.getUserId(request), body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string | null;
      year?: number | null;
      institutionId?: string | null;
    },
    @Req() request: Request,
  ): Promise<Work> {
    return this.worksService.update(id, this.getUserId(request), body);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Work> {
    return this.worksService.remove(id, this.getUserId(request));
  }

  private getUserId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
