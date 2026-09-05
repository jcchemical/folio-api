export interface PorbaseHttpResponse {
  status: number;
  body: string;
  contentType?: string;
}

export type PorbaseUpstreamErrorKind =
  'timeout' | 'server-error' | 'request-error';

export class PorbaseUpstreamError extends Error {
  constructor(
    readonly kind: PorbaseUpstreamErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'PorbaseUpstreamError';
  }
}

export class PorbaseXmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PorbaseXmlError';
  }
}
