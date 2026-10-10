import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordProvenanceOutputDto {
  @ApiProperty({ example: 'PORBASE' })
  pipeline!: string;

  @ApiProperty({ example: 'pipeline-only' })
  auditability!: string;

  @ApiProperty({
    example:
      'Source identifies the ingestion pipeline; no upstream snapshot is retained.',
  })
  note!: string;

  constructor(pipeline: string) {
    this.pipeline = pipeline;
    this.auditability = 'pipeline-only';
    this.note =
      'Source identifies the ingestion pipeline; no upstream snapshot is retained.';
  }
}

export class EditionRecordOutputDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  editionId!: string;

  @ApiPropertyOptional({ nullable: true })
  source!: string | null;

  @ApiPropertyOptional({ nullable: true })
  sourceId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  importedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  remoteId!: string | null;

  @ApiProperty()
  format!: string;

  @ApiProperty({ type: RecordProvenanceOutputDto })
  provenance!: RecordProvenanceOutputDto;

  constructor(record: {
    id: string;
    editionId: string;
    source: string | null;
    sourceId: string | null;
    createdAt: Date;
    remoteId: string | null;
    format: string;
  }) {
    this.id = record.id;
    this.editionId = record.editionId;
    this.source = record.source;
    this.sourceId = record.sourceId;
    this.importedAt = record.createdAt;
    this.remoteId = record.remoteId;
    this.format = record.format;
    this.provenance = new RecordProvenanceOutputDto(
      record.source === 'PORBASE'
        ? 'PORBASE'
        : (record.sourceId ?? record.source ?? 'Unknown'),
    );
  }
}
