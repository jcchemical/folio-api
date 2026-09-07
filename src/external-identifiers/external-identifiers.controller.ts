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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import {
  ExternalIdentifiersService,
  type ExternalIdentifierInput,
} from './external_identifiers.service.js';
import {
  CreateExternalIdentifierDto,
  UpdateExternalIdentifierDto,
} from './dto/external-identifier.dto.js';

@ApiTags('external-identifiers')
@ApiBearerAuth()
@Controller('external-identifiers')
@UseGuards(JwtAuthGuard)
export class ExternalIdentifiersController {
  constructor(private readonly service: ExternalIdentifiersService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto, @Req() request: Request) {
    return this.service.findAllByUser(this.userId(request), query);
  }

  @Post()
  create(
    @Body() body: CreateExternalIdentifierDto,
    @Req() request: Request,
  ) {
    return this.service.create(
      this.userId(request),
      body satisfies ExternalIdentifierInput,
    );
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateExternalIdentifierDto,
    @Req() request: Request,
  ) {
    return this.service.update(id, this.userId(request), body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: Request) {
    return this.service.remove(id, this.userId(request));
  }

  private userId(request: Request): string {
    return (request.user as AuthenticatedUser).id;
  }
}
