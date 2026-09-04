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
import { InstitutionsService } from './institutions.service.js';
import type { Institution } from '@prisma/client';

@ApiTags('institutions')
@ApiBearerAuth()
@Controller('institutions')
@UseGuards(JwtAuthGuard)
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Get()
  async findAll(@Req() request: Request): Promise<Institution[]> {
    return this.institutionsService.findAllByUser(this.getUserId(request));
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Institution | null> {
    return this.institutionsService.findById(id, this.getUserId(request));
  }

  @Post()
  async create(
    @Body()
    body: {
      name: string;
      address?: string | null;
      description?: string | null;
    },
    @Req() request: Request,
  ): Promise<Institution> {
    return this.institutionsService.create(this.getUserId(request), body);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      address?: string | null;
      description?: string | null;
    },
    @Req() request: Request,
  ): Promise<Institution> {
    return this.institutionsService.update(id, this.getUserId(request), body);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Institution> {
    return this.institutionsService.remove(id, this.getUserId(request));
  }

  private getUserId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
