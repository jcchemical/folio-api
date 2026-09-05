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
import {
  ContributorsService,
  type ContributorInput,
} from './contributors.service.js';

@ApiTags('contributors')
@ApiBearerAuth()
@Controller('contributors')
@UseGuards(JwtAuthGuard)
export class ContributorsController {
  constructor(private readonly contributorsService: ContributorsService) {}

  @Get()
  findAll(@Req() request: Request) {
    return this.contributorsService.findAllByUser(this.getUserId(request));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: Request) {
    return this.contributorsService.findById(id, this.getUserId(request));
  }

  @Post()
  create(@Body() body: ContributorInput, @Req() request: Request) {
    return this.contributorsService.create(this.getUserId(request), body);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: Partial<ContributorInput>,
    @Req() request: Request,
  ) {
    return this.contributorsService.update(id, this.getUserId(request), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.contributorsService.remove(id, this.getUserId(request));
  }

  private getUserId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
