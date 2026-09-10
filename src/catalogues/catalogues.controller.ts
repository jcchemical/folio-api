import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CatalogueService } from './catalogue.service.js';
import { CataloguesService } from './catalogues.service.js';
import { ImportCatalogueDto } from './dto/import-catalogue.dto.js';
import { PorbaseSearchQueryDto } from './dto/porbase-search-query.dto.js';
import { PorbaseSearchResponseDto } from './dto/porbase-search-response.dto.js';
import { SearchCatalogueDto } from './dto/search-catalogue.dto.js';
import { ImportPreviewResponseDto } from './dto/import-preview-response.dto.js';
import { PorbaseImportResponseDto } from './dto/porbase-import.dto.js';

@ApiTags('catalogues')
@ApiBearerAuth()
@Controller('catalogues')
@UseGuards(JwtAuthGuard)
export class CataloguesController {
  constructor(
    private readonly catalogueService: CatalogueService,
    private readonly cataloguesService: CataloguesService,
  ) {}

  @Post('search')
  @ApiOperation({ summary: 'Search the default or selected catalogue source' })
  @ApiOkResponse({ type: ImportPreviewResponseDto })
  search(@Body() body: SearchCatalogueDto) {
    const provider = body.sourceId
      ? this.catalogueService.getProvider(body.sourceId)
      : this.catalogueService.getDefaultProvider();
    return provider.searchPreview(body.query);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Confirm and persist an import from a catalogue source',
  })
  @ApiOkResponse({ type: PorbaseImportResponseDto })
  import(@Req() request: Request, @Body() body: ImportCatalogueDto) {
    const provider = body.sourceId
      ? this.catalogueService.getProvider(body.sourceId)
      : this.catalogueService.getDefaultProvider();
    return provider.import((request.user as AuthenticatedUser).id, body);
  }

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
