import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PorbaseAdapter } from './adapters/porbase.adapter.js';
import { isValidIsbn, normalizeIsbn } from './isbn.utils.js';
import { PorbaseSearchResponseDto } from './dto/porbase-search-response.dto.js';
import { PorbaseUpstreamError, PorbaseXmlError } from './catalogues.types.js';
import { notFoundResponse, parsePorbaseResponse } from './porbase.parser.js';

@Injectable()
export class CataloguesService {
  constructor(private readonly porbaseAdapter: PorbaseAdapter) {}

  searchPorbaseByIsbn(isbnInput: string): Promise<PorbaseSearchResponseDto> {
    return this.searchPorbase(isbnInput);
  }

  async searchPorbase(isbnInput: string): Promise<PorbaseSearchResponseDto> {
    const query = normalizeIsbn(isbnInput);
    if (!isValidIsbn(query)) {
      throw new BadRequestException('Invalid ISBN-10 or ISBN-13');
    }

    let response;
    try {
      response = await this.porbaseAdapter.searchByIsbn(query);
    } catch (error: unknown) {
      if (error instanceof PorbaseUpstreamError) {
        if (error.kind === 'timeout') {
          throw new ServiceUnavailableException('PORBASE request timed out');
        }
        throw new BadGatewayException('PORBASE request failed');
      }
      throw error;
    }

    if (response.status === 404 || response.status === 204) {
      return notFoundResponse(query, response.body, response.contentType);
    }

    if (response.status >= 500) {
      throw new BadGatewayException('PORBASE service is unavailable');
    }

    if (response.status < 200 || response.status >= 300) {
      throw new BadGatewayException('PORBASE request failed');
    }

    try {
      return parsePorbaseResponse(query, response.body, response.contentType);
    } catch (error: unknown) {
      if (error instanceof PorbaseXmlError) {
        throw new BadGatewayException('PORBASE returned invalid XML');
      }
      throw error;
    }
  }
}
