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
import {
  BibliographicRecordsService,
  type BibliographicRecordInput,
} from './bibliographic_records.service.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';

@ApiTags('bibliographic-records')
@ApiBearerAuth()
@Controller('bibliographic-records')
@UseGuards(JwtAuthGuard)
export class BibliographicRecordsController {
  constructor(
    private readonly bibliographicRecordsService: BibliographicRecordsService,
  ) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto, @Req() request: Request) {
    return this.bibliographicRecordsService.findAllByUser(
      this.getUserId(request),
      query,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.bibliographicRecordsService.findOne(this.getUserId(request), id);
  }

  @Post()
  create(@Body() body: BibliographicRecordInput, @Req() request: Request) {
    return this.bibliographicRecordsService.create(
      this.getUserId(request),
      body,
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<BibliographicRecordInput>,
    @Req() request: Request,
  ) {
    return this.bibliographicRecordsService.update(
      id,
      this.getUserId(request),
      body,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.bibliographicRecordsService.remove(id, this.getUserId(request));
  }

  private getUserId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
