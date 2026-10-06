import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

export type CoverCandidateStatus = 'PENDING' | 'REJECTED';

export interface ExtractedCoverCandidate {
  url: string;
  urlHash: string;
  sourceType: 'PORBASE';
  mimeType: string | null;
  status: CoverCandidateStatus;
  rejectReason: 'INVALID_URL' | 'NOT_IMAGE_LINK' | null;
  linkLabel: string | null;
  note: string | null;
}

export interface BibliographicRecordForCoverExtraction {
  id: string;
  rawContent: string;
}

export interface CoverCandidateExtractor {
  extract(
    bibliographicRecord: BibliographicRecordForCoverExtraction,
  ): Promise<ExtractedCoverCandidate[]>;
}

interface Subfield {
  code: string;
  value: string;
}

interface XmlObject {
  [key: string]: unknown;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

const KNOWN_COVER_HOSTS = new Set(['purl.pt', 'porbase.pt']);

@Injectable()
export class PorbaseCoverCandidateExtractor implements CoverCandidateExtractor {
  async extract(
    bibliographicRecord: BibliographicRecordForCoverExtraction,
  ): Promise<ExtractedCoverCandidate[]> {
    const subfieldGroups = extract856Subfields(bibliographicRecord.rawContent);
    return subfieldGroups.flatMap((subfields) => {
      const urls = subfields
        .filter(({ code }) => code === 'u')
        .map(({ value }) => value.trim())
        .filter(Boolean);
      return urls.map((url) => {
        const mimeType =
          subfields.find(({ code }) => code === 'q')?.value ?? null;
        const linkLabel =
          subfields.find(({ code }) => code === 'y')?.value ?? null;
        const note = subfields.find(({ code }) => code === 'z')?.value ?? null;
        return classifyCandidate(url, mimeType, linkLabel, note);
      });
    });
  }
}

function classifyCandidate(
  url: string,
  mimeType: string | null,
  linkLabel: string | null,
  note: string | null,
): ExtractedCoverCandidate {
  const urlHash = createHash('sha256').update(url).digest('hex');
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return candidate(url, urlHash, mimeType, linkLabel, note, 'INVALID_URL');
  }

  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname) {
    return candidate(url, urlHash, mimeType, linkLabel, note, 'INVALID_URL');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const knownHost = [...KNOWN_COVER_HOSTS].some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
  const imageMimeType = /^image\/[a-z0-9.+-]+(?:\s*;.*)?$/i.test(
    mimeType?.trim() ?? '',
  );
  if (!imageMimeType && !knownHost) {
    return candidate(url, urlHash, mimeType, linkLabel, note, 'NOT_IMAGE_LINK');
  }

  return {
    url,
    urlHash,
    sourceType: 'PORBASE',
    mimeType,
    status: 'PENDING',
    rejectReason: null,
    linkLabel,
    note,
  };
}

function candidate(
  url: string,
  urlHash: string,
  mimeType: string | null,
  linkLabel: string | null,
  note: string | null,
  rejectReason: 'INVALID_URL' | 'NOT_IMAGE_LINK',
): ExtractedCoverCandidate {
  return {
    url,
    urlHash,
    sourceType: 'PORBASE',
    mimeType,
    status: 'REJECTED',
    rejectReason,
    linkLabel,
    note,
  };
}

function extract856Subfields(rawContent: string): Subfield[][] {
  const trimmed = rawContent.trimStart();
  if (trimmed.startsWith('<')) {
    return extractXml856Subfields(rawContent);
  }
  return rawContent
    .split(/\r?\n/)
    .filter((line) => /^\s*856(?:\s+|[:|])/.test(line))
    .map((line) => parseTextSubfields(line.replace(/^\s*856(?:\s+|[:|])/, '')));
}

function parseTextSubfields(value: string): Subfield[] {
  return [...value.matchAll(/\$([a-z0-9])\s*([^$]*)/gi)].map((match) => ({
    code: match[1].toLowerCase(),
    value: match[2].trim(),
  }));
}

function extractXml856Subfields(rawContent: string): Subfield[][] {
  let document: unknown;
  try {
    document = xmlParser.parse(rawContent);
  } catch {
    return [];
  }
  return find856Datafields(document).map((field) =>
    asArray(field.subfield)
      .map((subfield) => ({
        code: textValue(subfield['@_code'])?.toLowerCase() ?? '',
        value: textValue(subfield) ?? '',
      }))
      .filter(({ code, value }) => /^[a-z0-9]$/.test(code) && Boolean(value)),
  );
}

function find856Datafields(value: unknown): XmlObject[] {
  if (Array.isArray(value)) return value.flatMap(find856Datafields);
  if (!isXmlObject(value)) return [];

  const ownDatafields = asArray(value.datafield).filter(
    (field) => textValue(field['@_tag']) === '856',
  );
  return [
    ...ownDatafields,
    ...Object.entries(value)
      .filter(([key]) => key !== 'datafield')
      .flatMap(([, child]) => find856Datafields(child)),
  ];
}

function asArray(value: unknown): XmlObject[] {
  if (Array.isArray(value)) return value.filter(isXmlObject);
  return isXmlObject(value) ? [value] : [];
}

function isXmlObject(value: unknown): value is XmlObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function textValue(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }
  if (isXmlObject(value)) return textValue(value['#text']);
  return undefined;
}
