import { HttpStatus, Injectable } from '@nestjs/common';
import { API_ERROR_CODES, ApiException } from '../common/api-errors.js';
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
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        API_ERROR_CODES.INVALID_ISBN,
        'Invalid ISBN-10 or ISBN-13.',
      );
    }

    let response;
    try {
      response = await this.porbaseAdapter.searchByIsbn(query);
    } catch (error: unknown) {
      if (error instanceof PorbaseUpstreamError) {
        if (error.kind === 'timeout') {
          throw new ApiException(
            HttpStatus.SERVICE_UNAVAILABLE,
            API_ERROR_CODES.PORBASE_TIMEOUT,
            'PORBASE request timed out.',
          );
        }
        throw porbaseUnavailable();
      }
      throw error;
    }

    if (response.status === 404 || response.status === 204) {
      return notFoundResponse(query, response.body, response.contentType);
    }

    if (response.status >= 500) {
      throw porbaseUnavailable();
    }

    if (response.status < 200 || response.status >= 300) {
      throw porbaseUnavailable();
    }

    try {
      return parsePorbaseResponse(query, response.body, response.contentType);
    } catch (error: unknown) {
      if (error instanceof PorbaseXmlError) {
        throw new ApiException(
          HttpStatus.BAD_GATEWAY,
          API_ERROR_CODES.PORBASE_INVALID_RESPONSE,
          'PORBASE returned an invalid response.',
        );
      }
      throw error;
    }
  }
}

function porbaseUnavailable(): ApiException {
  return new ApiException(
    HttpStatus.BAD_GATEWAY,
    API_ERROR_CODES.PORBASE_UNAVAILABLE,
    'PORBASE is unavailable.',
  );
}
