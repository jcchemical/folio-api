import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { WorksService } from './works.service.js';
import { CreateWorkDto, UpdateWorkDto } from './dto/work.dto.js';
import type { Work } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { THROTTLE_TTL_MS } from '../common/throttling.config.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';

@ApiTags('works')
@ApiBearerAuth()
@Controller('works')
@UseGuards(JwtAuthGuard)
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Get()
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiBadRequestResponse({
    description: 'Organization context is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'Membership in the selected organization is required.',
  })
  @Throttle({ default: { limit: 100, ttl: THROTTLE_TTL_MS } })
  async findAll(@Query() query: PaginationQueryDto, @Req() request: Request) {
    return this.worksService.findAllByUser(
      this.getUserId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      query,
    );
  }

  @Get(':id')
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: false })
  async findOne(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Work | null> {
    return this.worksService.findById(
      id,
      this.getUserId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Post()
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiBadRequestResponse({
    description: 'Organization context is missing or invalid.',
  })
  @ApiForbiddenResponse({
    description: 'STAFF membership is required in the selected organization.',
  })
  async create(
    @Body() body: CreateWorkDto,
    @Req() request: Request,
  ): Promise<Work | null> {
    return this.worksService.create(
      this.getUserId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
      body,
    );
  }

  @Put(':id')
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: false })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateWorkDto,
    @Req() request: Request,
  ): Promise<Work | null> {
    return this.worksService.update(
      id,
      this.getUserId(request),
      body,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  @Delete(':id')
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: false })
  async remove(
    @Param('id') id: string,
    @Req() request: Request,
  ): Promise<Work> {
    return this.worksService.remove(
      id,
      this.getUserId(request),
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }

  private getUserId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
