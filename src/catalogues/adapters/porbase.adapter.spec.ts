import { describe, expect, it, vi } from 'vitest';
import type { HttpService } from '@nestjs/axios';
import { PorbaseAdapter } from './porbase.adapter.js';

interface MockHttpService {
  axiosRef: {
    get: ReturnType<typeof vi.fn>;
  };
}

describe('PorbaseAdapter', () => {
  it('returns the upstream body and real Content-Type', async () => {
    const http: MockHttpService = {
      axiosRef: {
        get: vi.fn().mockResolvedValue({
          status: 200,
          data: '001 3664836',
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        }),
      },
    };
    const adapter = new PorbaseAdapter(http as unknown as HttpService);

    const response = await adapter.searchByIsbn('9789724426495');

    expect(response).toEqual({
      status: 200,
      body: '001 3664836',
      contentType: 'text/plain; charset=utf-8',
    });
    expect(http.axiosRef.get).toHaveBeenCalledWith(
      expect.stringContaining('/isbn/unimarc/marcxchange'),
      expect.objectContaining({
        params: { id: '9789724426495' },
        responseType: 'text',
      }),
    );
  });

  it('passes through HTTP 404 for normalized not-found handling', async () => {
    const http: MockHttpService = {
      axiosRef: {
        get: vi.fn().mockResolvedValue({
          status: 404,
          data: 'Registo inexistente',
          headers: { 'content-type': 'text/plain' },
        }),
      },
    };

    const response = await new PorbaseAdapter(
      http as unknown as HttpService,
    ).searchByIsbn('9789724426495');

    expect(response).toMatchObject({
      status: 404,
      body: 'Registo inexistente',
      contentType: 'text/plain',
    });
  });
});
