import { Body, Controller, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CreateContributionDto } from './contributions.dto.js';
import { ContributionsService } from './contributions.service.js';

@ApiTags('contributions')
@ApiBearerAuth()
@Controller('contributions')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Post()
  @ApiCreatedResponse()
  create(@Body() body: CreateContributionDto, @Req() request: Request) {
    return this.contributionsService.createManual(
      (request.user as AuthenticatedUser).id,
      body,
    );
  }
}