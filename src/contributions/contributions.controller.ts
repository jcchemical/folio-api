import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import { CreateContributionDto } from './contributions.dto.js';
import { ContributionsService } from './contributions.service.js';

@ApiTags('contributions')
@ApiBearerAuth()
@Controller('contributions')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Post()
  @ApiHeader({
    name: FOLIO_ORGANIZATION_HEADER,
    required: false,
    description:
      'Optional consistency check; Organization is derived from workId or editionId.',
  })
  @ApiOperation({
    summary: 'Create a manual Contribution under a Work or Edition',
    description:
      'Provide exactly one persisted workId or editionId. Organization is derived from that target. Only STAFF+ members may write, and source is assigned by the server as MANUAL.',
  })
  @ApiForbiddenResponse({
    description: 'STAFF membership is required in the target organization.',
  })
  @ApiCreatedResponse()
  create(@Body() body: CreateContributionDto, @Req() request: Request) {
    return this.contributionsService.createManual(
      (request.user as AuthenticatedUser).id,
      body,
      request.headers[FOLIO_ORGANIZATION_HEADER],
    );
  }
}
