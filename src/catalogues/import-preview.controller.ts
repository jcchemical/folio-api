import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ImportPreviewService } from './import-preview.service.js';
import { ImportPreviewQueryDto } from './dto/import-preview-query.dto.js';
import { ImportPreviewResponseDto } from './dto/import-preview-response.dto.js';

@ApiTags('catalogues')
@ApiBearerAuth()
@Controller('catalogues/porbase')
@UseGuards(JwtAuthGuard)
export class ImportPreviewController {
  constructor(private readonly importPreviewService: ImportPreviewService) {}

  @Post('import-preview')
  @ApiOperation({
    summary: 'Preview a PORBASE bibliographic import without persisting it',
  })
  @ApiOkResponse({ type: ImportPreviewResponseDto })
  @ApiBadRequestResponse({ description: 'The ISBN is invalid.' })
  @ApiNotFoundResponse({ description: 'No PORBASE record was found.' })
  create(@Body() body: ImportPreviewQueryDto) {
    return this.importPreviewService.createPreview(body.isbn);
  }
}
