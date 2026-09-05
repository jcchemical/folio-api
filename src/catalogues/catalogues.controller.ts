import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CataloguesService } from './catalogues.service.js';
import { PorbaseSearchQueryDto } from './dto/porbase-search-query.dto.js';
import { PorbaseSearchResponseDto } from './dto/porbase-search-response.dto.js';

@ApiTags('catalogues')
@ApiBearerAuth()
@Controller('catalogues')
@UseGuards(JwtAuthGuard)
export class CataloguesController {
  constructor(private readonly cataloguesService: CataloguesService) {}

  @Get('porbase/search')
  @ApiOperation({
    summary: 'Search PORBASE by ISBN without persisting the result',
  })
  @ApiQuery({
    name: 'isbn',
    required: true,
    description: 'ISBN-10 or ISBN-13, with optional spaces or hyphens',
    example: '9789724426495',
  })
  @ApiOkResponse({ type: PorbaseSearchResponseDto })
  @ApiBadRequestResponse({ description: 'The ISBN is invalid.' })
  @ApiBadGatewayResponse({
    description: 'PORBASE returned an upstream error or invalid XML.',
  })
  @ApiServiceUnavailableResponse({ description: 'PORBASE timed out.' })
  searchPorbase(@Query() query: PorbaseSearchQueryDto) {
    return this.cataloguesService.searchPorbase(query.isbn);
  }
}
