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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ItemsService } from './items.service.js';
import { CreateItemDto, UpdateItemDto } from './dto/item.dto.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { THROTTLE_TTL_MS } from '../common/throttling.config.js';

@ApiTags('items')
@ApiBearerAuth()
@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  @Throttle({ default: { limit: 100, ttl: THROTTLE_TTL_MS } })
  findAll(@Query() query: PaginationQueryDto, @Req() request: Request) {
    return this.itemsService.findAllByUser(this.getUserId(request), query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.itemsService.findById(id, this.getUserId(request));
  }

  @Post()
  create(@Body() body: CreateItemDto, @Req() request: Request) {
    return this.itemsService.create(this.getUserId(request), body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateItemDto,
    @Req() request: Request,
  ) {
    return this.itemsService.update(id, this.getUserId(request), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.itemsService.remove(id, this.getUserId(request));
  }

  private getUserId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
