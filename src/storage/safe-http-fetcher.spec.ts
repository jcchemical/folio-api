import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import {
  DEFAULT_SAFE_HTTP_FETCHER_CONFIG,
  getSafeHttpFetcherConfig,
  isPublicAddress,
  readStreamWithLimit,
  SafeHttpFetcherError,
  SafeHttpFetcherService,
  type ResolvedAddress,
  type SafeHttpFetcherConfig,
  type SafeHttpFetcherDependencies,
  type SafeHttpResponse,
} from './safe-http-fetcher.js';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==',
  'base64',
);
const publicAddress: ResolvedAddress = { address: '93.184.216.34', family: 4 };
const imageResponse: SafeHttpResponse = {
  statusCode: 200,
  headers: { 'content-type': 'image/png' },
  body: png,
};

describe('SafeHttpFetcherService', () => {
  function createFetcher(
    options: Partial<SafeHttpFetcherConfig> = {},
    responses: SafeHttpResponse[] = [imageResponse],
  ) {
    const resolveHost = vi.fn(async () => [publicAddress]);
    const request = vi.fn(async (_url: URL) => {
      const response = responses.shift();
      if (!response) throw new Error('No mock response configured');
      return response;
    });
    const config = {
      ...DEFAULT_SAFE_HTTP_FETCHER_CONFIG,
      allowedHosts: ['covers.example'],
      ...options,
    };
    const dependencies: SafeHttpFetcherDependencies = {
      resolveHost,
      request,
    };
    return {
      fetcher: new SafeHttpFetcherService(config, dependencies),
      resolveHost,
      request,
    };
  }

  it('rejects hosts outside the exact allowlist before DNS or HTTP', async () => {
    const { fetcher, resolveHost, request } = createFetcher();

    await expect(
      fetcher.fetch('https://sub.covers.example/cover.png'),
    ).rejects.toMatchObject({
      code: 'HOST_NOT_ALLOWED',
    });
    expect(resolveHost).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it('accepts HTTPS and HTTP only for explicitly allowlisted hosts', async () => {
    const { fetcher, request } = createFetcher({}, [
      imageResponse,
      imageResponse,
    ]);

    await expect(
      fetcher.fetch('https://covers.example/cover.png'),
    ).resolves.toMatchObject({
      mimeType: 'image/png',
      sizeBytes: png.length,
      width: 1,
      height: 1,
    });
    await expect(
      fetcher.fetch('http://covers.example/cover.png'),
    ).resolves.toMatchObject({
      mimeType: 'image/png',
    });
    expect(request.mock.calls.map(([url]) => url.protocol)).toEqual([
      'https:',
      'http:',
    ]);
  });

  it.each([
    'https://user:pass@covers.example/cover.png',
    'https://@covers.example/cover.png',
    'https://covers.example:8443/cover.png',
    'ftp://covers.example/cover.png',
  ])('rejects unsafe URL form %s', async (url) => {
    const { fetcher, resolveHost } = createFetcher();

    await expect(fetcher.fetch(url)).rejects.toBeInstanceOf(
      SafeHttpFetcherError,
    );
    expect(resolveHost).not.toHaveBeenCalled();
  });

  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.2',
    '169.254.1.1',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fe80::1',
    'fc00::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
  ])('blocks non-public resolved address %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['8.8.8.8', '2606:4700:4700::1111'])(
    'allows public address %s',
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );

  it('rejects a hostname if any DNS answer is private', async () => {
    const dependencies: SafeHttpFetcherDependencies = {
      resolveHost: async () => [
        publicAddress,
        { address: '10.0.0.2', family: 4 },
      ],
      request: vi.fn(),
    };

    await expect(
      new SafeHttpFetcherService(
        {
          ...DEFAULT_SAFE_HTTP_FETCHER_CONFIG,
          allowedHosts: ['covers.example'],
        },
        dependencies,
      ).fetch('https://covers.example/cover.png'),
    ).rejects.toMatchObject({ code: 'UNSAFE_IP' });
  });

  it('follows at most three redirects and revalidates the destination host', async () => {
    const redirect: SafeHttpResponse = {
      statusCode: 302,
      headers: { location: 'https://outside.example/cover.png' },
      body: Buffer.alloc(0),
    };
    const { fetcher, resolveHost, request } = createFetcher({}, [redirect]);

    await expect(
      fetcher.fetch('https://covers.example/cover.png'),
    ).rejects.toMatchObject({
      code: 'HOST_NOT_ALLOWED',
    });
    expect(resolveHost).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('resolves DNS again when following an allowlisted redirect', async () => {
    const redirect: SafeHttpResponse = {
      statusCode: 302,
      headers: { location: 'https://cdn.example/cover.png' },
      body: Buffer.alloc(0),
    };
    const { fetcher, resolveHost, request } = createFetcher(
      { allowedHosts: ['covers.example', 'cdn.example'] },
      [redirect, imageResponse],
    );

    await expect(
      fetcher.fetch('https://covers.example/cover.png'),
    ).resolves.toMatchObject({
      mimeType: 'image/png',
    });
    expect(resolveHost).toHaveBeenNthCalledWith(1, 'covers.example');
    expect(resolveHost).toHaveBeenNthCalledWith(2, 'cdn.example');
    expect(request.mock.calls.map(([url]) => url.hostname)).toEqual([
      'covers.example',
      'cdn.example',
    ]);
  });

  it('rejects a redirect chain longer than three hops', async () => {
    const redirects = Array.from({ length: 4 }, () => ({
      statusCode: 302,
      headers: { location: '/next.png' },
      body: Buffer.alloc(0),
    }));
    const { fetcher, request } = createFetcher({}, redirects);

    await expect(
      fetcher.fetch('https://covers.example/cover.png'),
    ).rejects.toMatchObject({
      code: 'REDIRECT_LIMIT',
    });
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('rejects a body larger than the configured cap', async () => {
    const { fetcher } = createFetcher({ maxSizeBytes: 10 }, [
      { ...imageResponse, body: Buffer.alloc(11) },
    ]);

    await expect(
      fetcher.fetch('https://covers.example/cover.png'),
    ).rejects.toMatchObject({
      code: 'BODY_TOO_LARGE',
    });
  });

  it('cuts off a streamed body as soon as its cumulative size exceeds the cap', async () => {
    const stream = Readable.from([
      Buffer.alloc(4),
      Buffer.alloc(4),
      Buffer.alloc(4),
    ]);

    await expect(readStreamWithLimit(stream, 8)).rejects.toMatchObject({
      code: 'BODY_TOO_LARGE',
    });
  });

  it('checks magic bytes and requires a matching declared MIME type', async () => {
    const { fetcher } = createFetcher({}, [
      { ...imageResponse, headers: { 'content-type': 'image/jpeg' } },
    ]);

    await expect(
      fetcher.fetch('https://covers.example/cover.png'),
    ).rejects.toMatchObject({
      code: 'INVALID_IMAGE',
    });
  });

  it('rejects unknown magic bytes even when the server declares an image type', async () => {
    const { fetcher } = createFetcher({}, [
      { ...imageResponse, body: Buffer.from('not an image') },
    ]);

    await expect(
      fetcher.fetch('https://covers.example/cover.png'),
    ).rejects.toMatchObject({
      code: 'INVALID_IMAGE',
    });
  });

  it('rejects an image exceeding configured dimensions before decoding', async () => {
    const largeImage = await sharp({
      create: {
        width: 2,
        height: 1,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    const { fetcher } = createFetcher({ maxWidth: 1 }, [
      { ...imageResponse, body: largeImage },
    ]);

    await expect(
      fetcher.fetch('https://covers.example/cover.png'),
    ).rejects.toMatchObject({
      code: 'INVALID_IMAGE',
    });
  });

  it('converts DNS and network failures into safe fetch errors', async () => {
    const dependencies: SafeHttpFetcherDependencies = {
      resolveHost: async () => [publicAddress],
      request: vi.fn(async () => {
        throw new Error('private network detail');
      }),
    };

    await expect(
      new SafeHttpFetcherService(
        {
          ...DEFAULT_SAFE_HTTP_FETCHER_CONFIG,
          allowedHosts: ['covers.example'],
        },
        dependencies,
      ).fetch('https://covers.example/cover.png'),
    ).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'The image could not be fetched safely.',
    });
  });

  it('enforces the total timeout while DNS is pending', async () => {
    const dependencies: SafeHttpFetcherDependencies = {
      resolveHost: () => new Promise(() => undefined),
      request: vi.fn(),
    };

    await expect(
      new SafeHttpFetcherService(
        {
          ...DEFAULT_SAFE_HTTP_FETCHER_CONFIG,
          allowedHosts: ['covers.example'],
          httpTimeoutMs: 5,
        },
        dependencies,
      ).fetch('https://covers.example/cover.png'),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  it('uses fail-closed host configuration and the documented numeric defaults', () => {
    const config = getSafeHttpFetcherConfig({
      COVER_ALLOWED_HOSTS: ' first.example, second.example ',
      COVER_HTTP_TIMEOUT: '0',
      COVER_CONNECT_TIMEOUT: '2500',
      COVER_MAX_SIZE_BYTES: '2048',
      COVER_MAX_WIDTH: 'bad',
      COVER_MAX_HEIGHT: '6000',
    });

    expect(config).toEqual({
      allowedHosts: ['first.example', 'second.example'],
      httpTimeoutMs: 10_000,
      connectTimeoutMs: 2_500,
      maxSizeBytes: 2_048,
      maxWidth: 5_000,
      maxHeight: 6_000,
    });
  });
});
