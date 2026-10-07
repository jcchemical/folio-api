import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiHeader,
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
import { THROTTLE_TTL_MS } from '../common/throttling.config.js';
import { FOLIO_ORGANIZATION_HEADER } from '../organizations/organization-context.resolver.js';
import {
  CatalogueImportContextGuard,
  type CatalogueImportRequest,
} from './catalogue-import-context.guard.js';

@ApiTags('catalogues')
@ApiBearerAuth()
@Controller('catalogues')
@UseGuards(JwtAuthGuard)
export class CataloguesController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Post('search')
  @Throttle({ default: { limit: 5, ttl: THROTTLE_TTL_MS } })
  @ApiOperation({ summary: 'Search the default or selected catalogue source' })
  @ApiOkResponse({ type: ImportPreviewResponseDto })
  search(@Body() body: SearchCatalogueDto) {
    const provider = body.sourceId
      ? this.catalogueService.getProvider(body.sourceId)
      : this.catalogueService.getDefaultProvider();
    return provider.searchPreview(body.query as CatalogueSearchQuery);
  }

  @Post('import')
  @UseGuards(CatalogueImportContextGuard)
  @ApiHeader({ name: FOLIO_ORGANIZATION_HEADER, required: true })
  @ApiBadRequestResponse({
    description:
      'Organization context is missing or invalid, or the import contains competing ownership fields.',
  })
  @ApiForbiddenResponse({
    description:
      'Membership and STAFF role are required in the selected organization.',
  })
  @Throttle({ default: { limit: 5, ttl: THROTTLE_TTL_MS } })
  @ApiOperation({
    summary: 'Confirm and persist an import from a catalogue source',
    description:
      'Persists the confirmed payload under the organization selected by X-Folio-Organization-Id. The Work tenant is never taken from the body; nested Editions derive from the newly created Work.',
  })
  @ApiOkResponse({ type: CatalogueImportResponseDto })
  import(
    @Req() request: CatalogueImportRequest,
    @Body() body: CatalogueImportDto,
  ) {
    const provider = body.sourceId
      ? this.catalogueService.getProvider(body.sourceId)
      : this.catalogueService.getDefaultProvider();
    return provider.import(
      (request.user as AuthenticatedUser).id,
      body,
      request.catalogueImportOrganizationId!,
    );
  }
}
