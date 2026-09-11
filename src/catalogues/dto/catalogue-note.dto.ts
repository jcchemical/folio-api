import { ApiProperty } from '@nestjs/swagger';

export type CatalogueNoteType =
  | 'GENERAL'
  | 'BIBLIOGRAPHY'
  | 'CONTENTS'
  | 'SUMMARY'
  | 'PROVENANCE'
  | 'DISSERTATION';

export class CatalogueNoteDto {
  @ApiProperty({
    enum: [
      'GENERAL',
      'BIBLIOGRAPHY',
      'CONTENTS',
      'SUMMARY',
      'PROVENANCE',
      'DISSERTATION',
    ],
  })
  type!: CatalogueNoteType;

  @ApiProperty()
  value!: string;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty()
  sourceTag!: string;
}
