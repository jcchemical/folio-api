import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { isValidBibliographicDate } from '../../common/bibliographic-date.js';

export const PORBASE_PUBLICATION_STATEMENT_INDICATOR_1 = ' ';
export const PORBASE_PUBLICATION_STATEMENT_INDICATOR_2 = '9';

export class PublicationStatementPartDto {
  @ApiProperty({ example: 'a', pattern: '^[a-z0-9]$' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9]$/)
  subfield!: string;

  @ApiProperty({ example: 'Coimbra' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiProperty({ example: 0, default: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class PublicationStatementDto {
  @ApiProperty({ example: 0, default: 0 })
  @IsInt()
  @Min(0)
  sortOrder!: number;

  @ApiPropertyOptional({ example: ' ', minLength: 1, maxLength: 1 })
  @IsOptional()
  @IsString()
  @Matches(/^.$/s)
  indicator1?: string;

  @ApiPropertyOptional({ example: '9', minLength: 1, maxLength: 1 })
  @IsOptional()
  @IsString()
  @Matches(/^.$/s)
  indicator2?: string;

  @ApiProperty({ type: [PublicationStatementPartDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PublicationStatementPartDto)
  parts!: PublicationStatementPartDto[];
}

export type PublicationStatementPartInput = {
  subfield: string;
  value: string;
  sortOrder: number;
};

export type PublicationStatementInput = {
  sortOrder: number;
  indicator1?: string;
  indicator2?: string;
  source?: string | null;
  parts: PublicationStatementPartInput[];
};

export type PublicationStatementProjectionInput = {
  statements: Array<{
    sortOrder: number;
    parts: Array<{
      subfield: string;
      value: string;
      sortOrder: number;
      normalizedValue?: string | null;
    }>;
  }>;
  publisher?: string | null;
  publicationDate?: string | null;
  publicationPlace?: string | null;
};

export type PublicationProjection = {
  publisher: string | null;
  publicationDate: string | null;
  publicationPlace: string | null;
  warnings: PublicationWarning[];
};

export type PublicationWarning = {
  code: 'PUBLICATION_DATE_NORMALIZED' | 'PUBLICATION_SCALAR_DIVERGENCE';
  field: string;
  message: string;
  original?: string;
  normalized?: string;
  type: 'normalization' | 'validation_warning';
};

export function derivePublicationProjection(
  input: PublicationStatementProjectionInput,
): PublicationProjection {
  const statements = [...input.statements].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const parts = statements.flatMap((statement) =>
    [...statement.parts].sort((a, b) => a.sortOrder - b.sortOrder),
  );
  const first = (code: string) =>
    parts.find(
      (part) => part.subfield.toLowerCase() === code && part.value.trim(),
    );
  const place = first('a');
  const publisher = first('c');
  const date = parts
    .map((part) => ({
      ...part,
      effectiveNormalizedValue:
        part.normalizedValue ?? normalizePublicationDateLiteral(part.value),
    }))
    .find(
      (part) =>
        part.subfield.toLowerCase() === 'd' &&
        isCanonicalDate(part.effectiveNormalizedValue),
    );
  const warnings: PublicationWarning[] = [];

  for (const part of parts.filter(
    ({ subfield }) => subfield.toLowerCase() === 'd',
  )) {
    const normalized =
      part.normalizedValue ?? normalizePublicationDateLiteral(part.value);
    if (normalized && part.value !== normalized) {
      warnings.push({
        code: 'PUBLICATION_DATE_NORMALIZED',
        field: 'publicationStatements.210$d',
        message: `Publication date normalized from '${part.value}' to '${part.normalizedValue}' for the Edition projection.`,
        original: part.value,
        normalized,
        type: 'normalization',
      });
    }
  }

  const compare = [
    ['publisher', input.publisher, publisher?.value ?? null],
    [
      'publicationDate',
      input.publicationDate,
      date?.effectiveNormalizedValue ?? null,
    ],
    ['publicationPlace', input.publicationPlace, place?.value ?? null],
  ] as const;
  for (const [field, supplied, derived] of compare) {
    if (supplied !== undefined && supplied !== derived) {
      warnings.push({
        code: 'PUBLICATION_SCALAR_DIVERGENCE',
        field: `edition.${field}`,
        message: `The scalar ${field} differs from the value derived from publicationStatements; the derived value is authoritative.`,
        original: supplied ?? undefined,
        normalized: derived ?? undefined,
        type: 'validation_warning',
      });
    }
  }

  return {
    publicationPlace: place?.value ?? null,
    publisher: publisher?.value ?? null,
    publicationDate: date?.effectiveNormalizedValue ?? null,
    warnings,
  };
}

export function isCanonicalDate(
  value: string | null | undefined,
): value is string {
  return (
    value !== undefined && value !== null && isValidBibliographicDate(value)
  );
}

export function normalizePublicationDateLiteral(value: string): string | null {
  const match =
    /^(?:D\.?\s*L\.?\s*)?(\d{4})(?:-(\d{2})(?:-(\d{2}))?)[.?]?$|^(?:D\.?\s*L\.?\s*)?(\d{4})[.?]?$/.exec(
      value.trim(),
    );
  if (!match) return null;
  const normalized = [match[1] ?? match[4], match[2], match[3]]
    .filter(Boolean)
    .join('-');
  return isCanonicalDate(normalized) ? normalized : null;
}
