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
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { EditionsService } from './editions.service.js';
import type { EditionInput } from '../works/works.service.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';

@ApiTags('editions')
@ApiBearerAuth()
@Controller('editions')
@UseGuards(JwtAuthGuard)
export class EditionsController {
  constructor(private readonly editionsService: EditionsService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto, @Req() request: Request) {
    return this.editionsService.findAllByUser(this.getUserId(request), query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.editionsService.findById(id, this.getUserId(request));
  }

  @Post()
  create(
    @Body() body: EditionInput & { workId: string },
    @Req() request: Request,
  ) {
    const { workId, ...edition } = body;
    return this.editionsService.create(
      this.getUserId(request),
      workId,
      edition,
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<EditionInput>,
    @Req() request: Request,
  ) {
    return this.editionsService.update(id, this.getUserId(request), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.editionsService.remove(id, this.getUserId(request));
  }

  private getUserId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
