import { lookup } from 'node:dns/promises';
import { Agent as HttpAgent, request as httpRequest } from 'node:http';
import type { ClientRequest } from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import type { Readable } from 'node:stream';
import ipaddr from 'ipaddr.js';
import sharp from 'sharp';

export interface FetchedImage {
  buffer: Buffer;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
}

export interface SafeHttpFetcher {
  fetch(url: string): Promise<FetchedImage>;
}

export interface SafeHttpFetcherConfig {
  allowedHosts: readonly string[];
  httpTimeoutMs: number;
  connectTimeoutMs: number;
  maxSizeBytes: number;
  maxWidth: number;
  maxHeight: number;
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

export interface SafeHttpResponse {
  statusCode: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

export interface SafeHttpFetcherDependencies {
  resolveHost(hostname: string): Promise<readonly ResolvedAddress[]>;
  request(
    url: URL,
    pinnedAddress: ResolvedAddress,
    limits: {
      connectTimeoutMs: number;
      remainingTimeoutMs: number;
      maxSizeBytes: number;
    },
  ): Promise<SafeHttpResponse>;
}

export type SafeHttpFetcherErrorCode =
  | 'INVALID_URL'
  | 'HOST_NOT_ALLOWED'
  | 'UNSAFE_IP'
  | 'REDIRECT_LIMIT'
  | 'BODY_TOO_LARGE'
  | 'INVALID_IMAGE'
  | 'HTTP_STATUS'
  | 'TIMEOUT'
  | 'NETWORK_ERROR';

export class SafeHttpFetcherError extends Error {
  constructor(
    readonly code: SafeHttpFetcherErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SafeHttpFetcherError';
  }
}

export const DEFAULT_SAFE_HTTP_FETCHER_CONFIG: SafeHttpFetcherConfig = {
  allowedHosts: ['images.porbase.pt', 'purl.pt'],
  httpTimeoutMs: 10_000,
  connectTimeoutMs: 5_000,
  maxSizeBytes: 5 * 1024 * 1024,
  maxWidth: 5_000,
  maxHeight: 5_000,
};

const MAX_REDIRECTS = 3;
const IMAGE_MIME_TYPES = new Map([
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['gif', 'image/gif'],
  ['webp', 'image/webp'],
]);

export function getSafeHttpFetcherConfig(
  environment: NodeJS.ProcessEnv = process.env,
): SafeHttpFetcherConfig {
  return {
    allowedHosts: parseAllowedHosts(environment.COVER_ALLOWED_HOSTS),
    httpTimeoutMs: readPositiveInteger(
      environment.COVER_HTTP_TIMEOUT,
      DEFAULT_SAFE_HTTP_FETCHER_CONFIG.httpTimeoutMs,
    ),
    connectTimeoutMs: readPositiveInteger(
      environment.COVER_CONNECT_TIMEOUT,
      DEFAULT_SAFE_HTTP_FETCHER_CONFIG.connectTimeoutMs,
    ),
    maxSizeBytes: readPositiveInteger(
      environment.COVER_MAX_SIZE_BYTES,
      DEFAULT_SAFE_HTTP_FETCHER_CONFIG.maxSizeBytes,
    ),
    maxWidth: readPositiveInteger(
      environment.COVER_MAX_WIDTH,
      DEFAULT_SAFE_HTTP_FETCHER_CONFIG.maxWidth,
    ),
    maxHeight: readPositiveInteger(
      environment.COVER_MAX_HEIGHT,
      DEFAULT_SAFE_HTTP_FETCHER_CONFIG.maxHeight,
    ),
  };
}

export function isPublicAddress(address: string): boolean {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === 'ipv6') {
      const ipv6 = parsed as ipaddr.IPv6;
      if (ipv6.isIPv4MappedAddress()) parsed = ipv6.toIPv4Address();
    }

    if (parsed.kind() === 'ipv4') {
      const ipv4 = parsed as ipaddr.IPv4;
      return (
        ipv4.range() === 'unicast' &&
        !ipv4.match(ipaddr.IPv4.parse('100.64.0.0'), 10)
      );
    }

    const ipv6 = parsed as ipaddr.IPv6;
    return (
      ipv6.range() === 'unicast' &&
      !ipv6.match(ipaddr.IPv6.parse('::'), 128) &&
      !ipv6.match(ipaddr.IPv6.parse('::1'), 128)
    );
  } catch {
    return false;
  }
}

export class SafeHttpFetcherService implements SafeHttpFetcher {
  private readonly allowedHosts: ReadonlySet<string>;

  constructor(
    private readonly config: SafeHttpFetcherConfig = getSafeHttpFetcherConfig(),
    private readonly dependencies: SafeHttpFetcherDependencies = {
      resolveHost: resolveHost,
      request: requestWithNode,
    },
  ) {
    this.allowedHosts = new Set(
      config.allowedHosts.map(normalizeHostname).filter(Boolean),
    );
  }

  async fetch(url: string): Promise<FetchedImage> {
    try {
      return await this.fetchAndValidate(url);
    } catch (error) {
      if (error instanceof SafeHttpFetcherError) throw error;
      throw new SafeHttpFetcherError(
        'NETWORK_ERROR',
        'The image could not be fetched safely.',
      );
    }
  }

  private async fetchAndValidate(input: string): Promise<FetchedImage> {
    const deadline = Date.now() + this.config.httpTimeoutMs;
    let currentUrl = parseUrl(input);

    for (let redirects = 0; ; redirects += 1) {
      this.validateUrl(currentUrl);
      const hostname = normalizeHostname(currentUrl.hostname);
      const addresses = await beforeDeadline(
        this.dependencies.resolveHost(hostname),
        deadline,
      );
      if (
        addresses.length === 0 ||
        addresses.some(({ address }) => !isPublicAddress(address))
      ) {
        throw new SafeHttpFetcherError(
          'UNSAFE_IP',
          'The image host resolved to an unsafe IP address.',
        );
      }

      const remainingTimeoutMs = deadline - Date.now();
      if (remainingTimeoutMs <= 0) {
        throw new SafeHttpFetcherError('TIMEOUT', 'Image fetch timed out.');
      }

      const response = await beforeDeadline(
        this.dependencies.request(currentUrl, addresses[0], {
          connectTimeoutMs: Math.min(
            this.config.connectTimeoutMs,
            remainingTimeoutMs,
          ),
          remainingTimeoutMs,
          maxSizeBytes: this.config.maxSizeBytes,
        }),
        deadline,
      );

      if (isRedirect(response.statusCode)) {
        const location = headerValue(response.headers.location);
        if (!location) {
          throw new SafeHttpFetcherError(
            'HTTP_STATUS',
            'Image server returned a redirect without a destination.',
          );
        }
        if (redirects >= MAX_REDIRECTS) {
          throw new SafeHttpFetcherError(
            'REDIRECT_LIMIT',
            'Image server exceeded the redirect limit.',
          );
        }
        try {
          currentUrl = parseUrl(location, currentUrl);
        } catch {
          throw new SafeHttpFetcherError(
            'INVALID_URL',
            'Image server returned an invalid redirect destination.',
          );
        }
        continue;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new SafeHttpFetcherError(
          'HTTP_STATUS',
          'Image server returned an unsuccessful response.',
        );
      }

      return beforeDeadline(
        this.validateImage(response.body, response.headers),
        deadline,
      );
    }
  }

  private validateUrl(url: URL): void {
    if (
      (url.protocol !== 'https:' && url.protocol !== 'http:') ||
      !url.hostname ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      hasUserInfo(url)
    ) {
      throw new SafeHttpFetcherError('INVALID_URL', 'Invalid image URL.');
    }

    if (url.port && url.port !== '80' && url.port !== '443') {
      throw new SafeHttpFetcherError(
        'INVALID_URL',
        'Image URL uses a disallowed port.',
      );
    }

    if (!this.allowedHosts.has(normalizeHostname(url.hostname))) {
      throw new SafeHttpFetcherError(
        'HOST_NOT_ALLOWED',
        'Image host is not allowlisted.',
      );
    }
  }

  private async validateImage(
    buffer: Buffer,
    headers: IncomingHttpHeaders,
  ): Promise<FetchedImage> {
    if (buffer.length === 0 || buffer.length > this.config.maxSizeBytes) {
      throw new SafeHttpFetcherError(
        'BODY_TOO_LARGE',
        'Image body is empty or exceeds the configured size limit.',
      );
    }

    const detectedMimeType = detectImageMimeType(buffer);
    const declaredMimeType = headerValue(headers['content-type'])
      ?.split(';', 1)[0]
      .trim()
      .toLowerCase();
    if (!detectedMimeType || declaredMimeType !== detectedMimeType) {
      throw new SafeHttpFetcherError(
        'INVALID_IMAGE',
        'Image signature and Content-Type do not match.',
      );
    }

    try {
      const pixelLimit = this.config.maxWidth * this.config.maxHeight;
      const image = sharp(buffer, {
        animated: true,
        failOn: 'error',
        limitInputPixels: pixelLimit,
      });
      const metadata = await image.metadata();
      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width > this.config.maxWidth ||
        metadata.height > this.config.maxHeight ||
        (metadata.pages ?? 1) > 1 ||
        IMAGE_MIME_TYPES.get(metadata.format ?? '') !== detectedMimeType
      ) {
        throw new Error('Image dimensions or format are invalid.');
      }

      await sharp(buffer, {
        failOn: 'error',
        limitInputPixels: pixelLimit,
      }).toBuffer();

      return {
        buffer,
        mimeType: detectedMimeType,
        sizeBytes: buffer.length,
        width: metadata.width,
        height: metadata.height,
      };
    } catch {
      throw new SafeHttpFetcherError(
        'INVALID_IMAGE',
        'Image data could not be decoded within the configured limits.',
      );
    }
  }
}

function parseUrl(input: string, base?: URL): URL {
  if (containsRawUserInfo(input)) {
    throw new SafeHttpFetcherError('INVALID_URL', 'Invalid image URL.');
  }
  try {
    return new URL(input, base);
  } catch {
    throw new SafeHttpFetcherError('INVALID_URL', 'Invalid image URL.');
  }
}

function containsRawUserInfo(input: string): boolean {
  const schemeMatch = /^[a-z][a-z\d+.-]*:\/\//i.exec(input);
  const authorityStart =
    schemeMatch?.[0].length ?? (input.startsWith('//') ? 2 : 0);
  if (authorityStart === 0) return false;
  return input.slice(authorityStart).split(/[/?#]/, 1)[0].includes('@');
}

function hasUserInfo(url: URL): boolean {
  const authority = url.href
    .slice(url.protocol.length + 2)
    .split(/[/?#]/, 1)[0];
  return authority.includes('@');
}

export function readStreamWithLimit(
  stream: Readable,
  maxSizeBytes: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let sizeBytes = 0;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      stream.destroy();
      reject(error);
    };

    stream.on('data', (chunk: Buffer | string) => {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      sizeBytes += data.length;
      if (sizeBytes > maxSizeBytes) {
        fail(
          new SafeHttpFetcherError(
            'BODY_TOO_LARGE',
            'Image body exceeds the size limit.',
          ),
        );
        return;
      }
      chunks.push(data);
    });
    stream.once('error', fail);
    stream.once('close', () => {
      if (!settled) {
        fail(
          new SafeHttpFetcherError(
            'NETWORK_ERROR',
            'Image response stream closed before completion.',
          ),
        );
      }
    });
    stream.once('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, sizeBytes));
    });
  });
}

async function beforeDeadline<T>(
  operation: Promise<T>,
  deadline: number,
): Promise<T> {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) {
    throw new SafeHttpFetcherError('TIMEOUT', 'Image fetch timed out.');
  }

  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new SafeHttpFetcherError('TIMEOUT', 'Image fetch timed out.'),
            ),
          remainingMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseAllowedHosts(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((host) => normalizeHostname(host.trim()))
    .filter(Boolean);
}

function normalizeHostname(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isRedirect(statusCode: number): boolean {
  return [301, 302, 303, 307, 308].includes(statusCode);
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function detectImageMimeType(buffer: Buffer): string | undefined {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 6 &&
    ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))
  ) {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return undefined;
}

async function resolveHost(
  hostname: string,
): Promise<readonly ResolvedAddress[]> {
  if (ipaddr.isValid(hostname)) {
    return [
      {
        address: hostname,
        family: ipaddr.parse(hostname).kind() === 'ipv4' ? 4 : 6,
      },
    ];
  }
  return lookup(hostname, { all: true, verbatim: true });
}

async function requestWithNode(
  url: URL,
  pinnedAddress: ResolvedAddress,
  limits: {
    connectTimeoutMs: number;
    remainingTimeoutMs: number;
    maxSizeBytes: number;
  },
): Promise<SafeHttpResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request: ClientRequest;
    let connectTimer: NodeJS.Timeout | undefined;
    const requestTimer = setTimeout(
      () => fail(new SafeHttpFetcherError('TIMEOUT', 'Image fetch timed out.')),
      limits.remainingTimeoutMs,
    );
    const finish = (response: SafeHttpResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(requestTimer);
      if (connectTimer) clearTimeout(connectTimer);
      agent.destroy();
      resolve(response);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(requestTimer);
      if (connectTimer) clearTimeout(connectTimer);
      agent.destroy();
      request?.destroy();
      reject(error);
    };
    const hostname = normalizeHostname(url.hostname);
    const pinnedLookup = ((requestedHostname, options, callback) => {
      if (normalizeHostname(String(requestedHostname)) !== hostname) {
        callback(
          Object.assign(new Error('Unexpected DNS lookup host.'), {
            code: 'EINVAL',
          }),
          '',
          pinnedAddress.family,
        );
        return;
      }
      if (
        options &&
        typeof options === 'object' &&
        'all' in options &&
        options.all
      ) {
        callback(null, [pinnedAddress]);
      } else {
        callback(null, pinnedAddress.address, pinnedAddress.family);
      }
    }) as LookupFunction;
    const agent =
      url.protocol === 'https:'
        ? new HttpsAgent({ keepAlive: false, lookup: pinnedLookup })
        : new HttpAgent({ keepAlive: false, lookup: pinnedLookup });
    const makeRequest = url.protocol === 'https:' ? httpsRequest : httpRequest;
    request = makeRequest(
      url,
      {
        agent,
        maxHeaderSize: 16 * 1024,
        headers: { accept: 'image/jpeg,image/png,image/gif,image/webp' },
      },
      (response) => {
        const declaredLength = Number(response.headers['content-length']);
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > limits.maxSizeBytes
        ) {
          fail(
            new SafeHttpFetcherError(
              'BODY_TOO_LARGE',
              'Image body exceeds the size limit.',
            ),
          );
          return;
        }
        void readStreamWithLimit(response, limits.maxSizeBytes).then((body) => {
          finish({
            statusCode: response.statusCode ?? 0,
            headers: response.headers,
            body,
          });
        }, fail);
      },
    );

    request.once('error', fail);
    request.once('socket', (socket) => {
      if (!socket.connecting) return;
      connectTimer = setTimeout(
        () =>
          fail(
            new SafeHttpFetcherError('TIMEOUT', 'Image connection timed out.'),
          ),
        limits.connectTimeoutMs,
      );
      const connectedEvent =
        url.protocol === 'https:' ? 'secureConnect' : 'connect';
      socket.once(connectedEvent, () => {
        if (connectTimer) clearTimeout(connectTimer);
      });
    });
    request.once('close', () => {
      if (!settled && request.destroyed) {
        fail(
          new SafeHttpFetcherError(
            'NETWORK_ERROR',
            'Image connection closed unexpectedly.',
          ),
        );
      }
    });
    request.end();
  });
}
