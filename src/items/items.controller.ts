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
import { ItemsService, type ItemInput } from './items.service.js';

@ApiTags('items')
@ApiBearerAuth()
@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll(@Req() request: Request) {
    return this.itemsService.findAllByUser(this.getUserId(request));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.itemsService.findById(id, this.getUserId(request));
  }

  @Post()
  create(@Body() body: ItemInput, @Req() request: Request) {
    return this.itemsService.create(this.getUserId(request), body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<ItemInput>,
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
