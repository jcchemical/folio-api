import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { BibliographicRecordsService } from './bibliographic_records.service.js';

@ApiTags('bibliographic-records')
@ApiBearerAuth()
@Controller('bibliographic-records')
@UseGuards(JwtAuthGuard)
export class BibliographicRecordsController {
  constructor(
    private readonly bibliographicRecordsService: BibliographicRecordsService,
  ) {}

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.bibliographicRecordsService.findOne(this.getUserId(request), id);
  }

  private getUserId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
