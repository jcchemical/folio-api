import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CatalogueService } from './catalogue.service.js';
import type { CatalogueSearchQuery } from './catalogue-provider.js';
import { CatalogueImportDto } from './dto/catalogue-import.dto.js';
import { SearchCatalogueDto } from './dto/search-catalogue.dto.js';
import { ImportPreviewResponseDto } from './dto/import-preview-response.dto.js';
import { CatalogueImportResponseDto } from './dto/catalogue-import.dto.js';

@ApiTags('catalogues')
@ApiBearerAuth()
@Controller('catalogues')
@UseGuards(JwtAuthGuard)
export class CataloguesController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Post('search')
  @ApiOperation({ summary: 'Search the default or selected catalogue source' })
  @ApiOkResponse({ type: ImportPreviewResponseDto })
  search(@Body() body: SearchCatalogueDto) {
    const provider = body.sourceId
      ? this.catalogueService.getProvider(body.sourceId)
      : this.catalogueService.getDefaultProvider();
    return provider.searchPreview(body.query as CatalogueSearchQuery);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Confirm and persist an import from a catalogue source',
  })
  @ApiOkResponse({ type: CatalogueImportResponseDto })
  import(@Req() request: Request, @Body() body: CatalogueImportDto) {
    const provider = body.sourceId
      ? this.catalogueService.getProvider(body.sourceId)
      : this.catalogueService.getDefaultProvider();
    return provider.import((request.user as AuthenticatedUser).id, body);
  }
}
