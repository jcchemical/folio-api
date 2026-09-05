import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PorbaseImportService } from './porbase-import.service.js';
import {
  PorbaseImportDto,
  PorbaseImportResponseDto,
} from './dto/porbase-import.dto.js';

@ApiTags('catalogues')
@ApiBearerAuth()
@Controller('catalogues/porbase')
@UseGuards(JwtAuthGuard)
export class PorbaseImportController {
  constructor(private readonly porbaseImportService: PorbaseImportService) {}

  @Post('import')
  @ApiOperation({
    summary: 'Confirm and persist a PORBASE bibliographic import',
  })
  @ApiBody({ type: PorbaseImportDto })
  @ApiCreatedResponse({ type: PorbaseImportResponseDto })
  @ApiBadRequestResponse({
    description: 'The import payload or ISBN is invalid.',
  })
  @ApiConflictResponse({
    description: 'The edition or identifier already exists.',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid JWT Bearer token is required.',
  })
  create(
    @Req() request: Request,
    @Body() body: PorbaseImportDto,
  ): Promise<PorbaseImportResponseDto> {
    const userId = (request.user as AuthenticatedUser).id;
    return this.porbaseImportService.import(userId, body);
  }
}
