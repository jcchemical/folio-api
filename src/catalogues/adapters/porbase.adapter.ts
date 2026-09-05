import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { isAxiosError } from 'axios';
import {
  PorbaseHttpResponse,
  PorbaseUpstreamError,
} from '../catalogues.types.js';

const DEFAULT_BASE_URL = 'https://urn.porbase.org/isbn/unimarc/marcxchange';

@Injectable()
export class PorbaseAdapter {
  private readonly baseUrl = (
    process.env.PORBASE_URN_BASE_URL ?? DEFAULT_BASE_URL
  ).replace(/\/$/, '');

  constructor(private readonly http: HttpService) {}

  async searchByIsbn(isbn: string): Promise<PorbaseHttpResponse> {
    try {
      const response = await this.http.axiosRef.get<string>(this.baseUrl, {
        params: { id: isbn },
        headers: { Accept: 'application/xml, text/xml' },
        responseType: 'text',
        validateStatus: () => true,
      });

      return {
        status: response.status,
        body: typeof response.data === 'string' ? response.data : '',
        contentType:
          typeof response.headers['content-type'] === 'string'
            ? response.headers['content-type']
            : undefined,
      };
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          throw new PorbaseUpstreamError(
            'timeout',
            'PORBASE request timed out',
          );
        }

        if (error.response?.status && error.response.status >= 500) {
          throw new PorbaseUpstreamError(
            'server-error',
            `PORBASE returned HTTP ${error.response.status}`,
          );
        }
      }

      throw new PorbaseUpstreamError('request-error', 'PORBASE request failed');
    }
  }
}
