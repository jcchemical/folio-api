import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PhysicalDescriptionDto } from '../../editions/dto/physical-description.dto.js';
import { IsBibliographicDate } from '../../common/bibliographic-date.js';
import { PublicationStatementDto } from '../../editions/dto/publication-statement.dto.js';

export class CatalogueContributionSourcePartInputDto {
  @ApiProperty() @IsString() @IsNotEmpty() code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() value!: string;
  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
}

export class CatalogueContributionInputDto {
  @ApiProperty({ enum: ['WORK'] }) @IsIn(['WORK']) targetScope!: 'WORK';
  @ApiProperty({ enum: ['PERSON', 'CORPORATE_BODY', 'UNKNOWN'] })
  @IsIn(['PERSON', 'CORPORATE_BODY', 'UNKNOWN'])
  kind!: 'PERSON' | 'CORPORATE_BODY' | 'UNKNOWN';
  @ApiProperty() @IsString() @IsNotEmpty() displayName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() roleLabel?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relationshipCodeScheme?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  authorityId?: string | null;
  @ApiProperty({ enum: ['700', '701', '702', '710', '711', '712', '713'] })
  @IsIn(['700', '701', '702', '710', '711', '712', '713'])
  sourceTag!: '700' | '701' | '702' | '710' | '711' | '712' | '713';
  @ApiProperty() @IsString() @IsNotEmpty() indicator1!: string;
  @ApiProperty() @IsString() @IsNotEmpty() indicator2!: string;
  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
  @ApiProperty({ type: [CatalogueContributionSourcePartInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogueContributionSourcePartInputDto)
  sourceParts!: CatalogueContributionSourcePartInputDto[];
}

// Client-editable Phase 1 structures. `source` provenance is never accepted
// here: the import service always stamps it server-side ('PORBASE' for the
// only current provider), matching the existing PublicationStatement/
// PhysicalDescription precedent.
export class CatalogueTitleInputDto {
  @ApiProperty({ enum: ['MAIN', 'PARALLEL', 'VARIANT', 'OTHER'] })
  @IsIn(['MAIN', 'PARALLEL', 'VARIANT', 'OTHER'])
  type!: 'MAIN' | 'PARALLEL' | 'VARIANT' | 'OTHER';

  @ApiProperty() @IsString() @IsNotEmpty() value!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  subtitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  language?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  partNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  partName?: string | null;

  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
}

export class CatalogueResponsibilityStatementInputDto {
  @ApiProperty({ enum: ['STATEMENT', 'SUBSEQUENT_STATEMENT'] })
  @IsIn(['STATEMENT', 'SUBSEQUENT_STATEMENT'])
  label!: 'STATEMENT' | 'SUBSEQUENT_STATEMENT';

  @ApiProperty() @IsString() @IsNotEmpty() value!: string;

  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
}

export class CatalogueLanguageInputDto {
  @ApiProperty() @IsString() @IsNotEmpty() code!: string;

  @ApiProperty({
    enum: ['TEXT', 'ORIGINAL_LANGUAGE', 'PARALLEL_TEXT', 'SUBTITLES'],
  })
  @IsIn(['TEXT', 'ORIGINAL_LANGUAGE', 'PARALLEL_TEXT', 'SUBTITLES'])
  role!: 'TEXT' | 'ORIGINAL_LANGUAGE' | 'PARALLEL_TEXT' | 'SUBTITLES';

  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
}

export class CatalogueSeriesInputDto {
  @ApiProperty() @IsString() @IsNotEmpty() title!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  parallelTitle?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  volumeNumber?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  issn?: string | null;

  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
}

export class CatalogueNoteInputDto {
  @ApiProperty({
    enum: [
      'GENERAL',
      'BIBLIOGRAPHY',
      'CONTENTS',
      'SUMMARY',
      'PROVENANCE',
      'DISSERTATION',
      'OTHER',
    ],
  })
  @IsIn([
    'GENERAL',
    'BIBLIOGRAPHY',
    'CONTENTS',
    'SUMMARY',
    'PROVENANCE',
    'DISSERTATION',
    'OTHER',
  ])
  type!:
    | 'GENERAL'
    | 'BIBLIOGRAPHY'
    | 'CONTENTS'
    | 'SUMMARY'
    | 'PROVENANCE'
    | 'DISSERTATION'
    | 'OTHER';

  @ApiProperty() @IsString() @IsNotEmpty() value!: string;

  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
}

export class CatalogueClassificationInputDto {
  @ApiProperty() @IsString() @IsNotEmpty() notation!: string;

  @ApiProperty() @IsString() @IsNotEmpty() system!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  systemEdition?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  authorityId?: string | null;

  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;
}

export class CatalogueEditionStatementInputDto {
  @ApiProperty({ enum: ['EDITION', 'OTHER', 'RESPONSIBILITY'] })
  @IsIn(['EDITION', 'OTHER', 'RESPONSIBILITY'])
  kind!: 'EDITION' | 'OTHER' | 'RESPONSIBILITY';

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  label?: string | null;

  @ApiProperty() @IsString() @IsNotEmpty() value!: string;

  @ApiProperty() @IsInt() @Min(0) sortOrder!: number;

  @ApiProperty() @IsString() @IsNotEmpty() sourceTag!: string;
}

export class CatalogueImportWorkDto {
  @ApiProperty({ example: 'Vida e andanças de Alexis Zorbás' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  subtitle?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  organizationId?: string | null;

  @ApiPropertyOptional({ type: [CatalogueTitleInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogueTitleInputDto)
  titles?: CatalogueTitleInputDto[];
}

export class CatalogueImportEditionDto {
  @ApiProperty({ example: 'Vida e andanças de Alexis Zorbás' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  subtitle?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  isbn10?: string | null;

  @ApiPropertyOptional({ example: '9789724426495', nullable: true })
  @IsOptional()
  @IsString()
  isbn13?: string | null;

  @ApiPropertyOptional({ example: 'Edições 70', nullable: true })
  @IsOptional()
  @IsString()
  publisher?: string | null;

  @ApiPropertyOptional({ example: '2022', nullable: true })
  @IsOptional()
  @IsBibliographicDate()
  publicationDate?: string | null;

  @ApiPropertyOptional({ example: 'por', nullable: true })
  @IsOptional()
  @IsString()
  language?: string | null;

  @ApiPropertyOptional({ example: 'PT', nullable: true })
  @IsOptional()
  @IsString()
  country?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  format?: string | null;

  @ApiPropertyOptional({ type: [PhysicalDescriptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhysicalDescriptionDto)
  physicalDescriptions?: PhysicalDescriptionDto[];

  @ApiPropertyOptional({ type: [PublicationStatementDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicationStatementDto)
  publicationStatements?: PublicationStatementDto[];
  @ApiPropertyOptional({ nullable: true }) publicationPlace?: string | null;

  @ApiPropertyOptional({ type: [CatalogueTitleInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogueTitleInputDto)
  titles?: CatalogueTitleInputDto[];

  @ApiPropertyOptional({ type: [CatalogueResponsibilityStatementInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogueResponsibilityStatementInputDto)
  responsibilityStatements?: CatalogueResponsibilityStatementInputDto[];

  @ApiPropertyOptional({ type: [CatalogueLanguageInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogueLanguageInputDto)
  languages?: CatalogueLanguageInputDto[];

  @ApiPropertyOptional({ type: [CatalogueSeriesInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogueSeriesInputDto)
  series?: CatalogueSeriesInputDto[];

  @ApiPropertyOptional({ type: [CatalogueNoteInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogueNoteInputDto)
  notes?: CatalogueNoteInputDto[];

  @ApiPropertyOptional({ type: [CatalogueClassificationInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogueClassificationInputDto)
  classifications?: CatalogueClassificationInputDto[];

  @ApiPropertyOptional({ type: [CatalogueEditionStatementInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogueEditionStatementInputDto)
  editionStatements?: CatalogueEditionStatementInputDto[];
}

export class CatalogueImportContributorDto {
  @ApiProperty({ example: 'Nikos Kazantzakis' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'AUTHOR' })
  @IsString()
  @IsNotEmpty()
  role!: string;

  @ApiProperty({ enum: ['WORK', 'EDITION'], example: 'WORK' })
  @IsIn(['WORK', 'EDITION'])
  scope!: 'WORK' | 'EDITION';

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CatalogueImportExternalIdentifierDto {
  @ApiProperty({ example: 'ISBN-13' })
  @IsString()
  @IsNotEmpty()
  type!: string;

  @ApiProperty({ example: '9789724426495' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ example: 'PORBASE', nullable: true })
  @IsOptional()
  @IsString()
  source?: string | null;
}

export class CatalogueImportBibliographicRecordDto {
  @ApiProperty({ enum: ['MARCXCHANGE', 'MARC_TEXT'] })
  @IsIn(['MARCXCHANGE', 'MARC_TEXT'])
  format!: 'MARCXCHANGE' | 'MARC_TEXT';

  @ApiPropertyOptional({ example: '3664836', nullable: true })
  @IsOptional()
  @IsString()
  remoteId?: string | null;

  @ApiProperty({ example: '<collection>...</collection>' })
  @IsString()
  @IsNotEmpty()
  rawContent!: string;
}

export class CatalogueImportItemDto {
  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  label?: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  location?: string | null;

  @ApiProperty({ example: 'OWNED' })
  @IsString()
  @IsNotEmpty()
  status!: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class CatalogueImportDto {
  @ApiPropertyOptional({ example: 'porbase' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sourceId?: string;

  @ApiProperty({ type: CatalogueImportWorkDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CatalogueImportWorkDto)
  work!: CatalogueImportWorkDto;

  @ApiProperty({ type: CatalogueImportEditionDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CatalogueImportEditionDto)
  edition!: CatalogueImportEditionDto;

  @ApiProperty({ type: [CatalogueImportContributorDto] })
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogueImportContributorDto)
  contributors!: CatalogueImportContributorDto[];

  @ApiPropertyOptional({ type: [CatalogueContributionInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogueContributionInputDto)
  contributions?: CatalogueContributionInputDto[];

  @ApiProperty({ type: [CatalogueImportExternalIdentifierDto] })
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogueImportExternalIdentifierDto)
  externalIdentifiers!: CatalogueImportExternalIdentifierDto[];

  @ApiProperty({ type: CatalogueImportBibliographicRecordDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CatalogueImportBibliographicRecordDto)
  bibliographicRecord!: CatalogueImportBibliographicRecordDto;

  @ApiProperty({ type: CatalogueImportItemDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CatalogueImportItemDto)
  item!: CatalogueImportItemDto;
}

export class CatalogueImportedOrganizationDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class CatalogueImportedExternalIdentifierDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() value!: string;
  @ApiPropertyOptional({ nullable: true }) source?: string | null;
}

export class CatalogueImportedUnmappedSubfieldDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() value!: string;
  @ApiProperty() sortOrder!: number;
}

export class CatalogueImportedUnmappedFieldDto {
  @ApiProperty() id!: string;
  @ApiProperty() tag!: string;
  @ApiPropertyOptional({ nullable: true }) indicator1?: string | null;
  @ApiPropertyOptional({ nullable: true }) indicator2?: string | null;
  @ApiProperty() occurrence!: number;
  @ApiPropertyOptional({ nullable: true }) reason?: string | null;
  @ApiProperty({ type: [CatalogueImportedUnmappedSubfieldDto] })
  subfields!: CatalogueImportedUnmappedSubfieldDto[];
}

export class CatalogueImportedBibliographicRecordDto {
  @ApiProperty() id!: string;
  @ApiProperty() format!: string;
  @ApiProperty() rawContent!: string;
  @ApiPropertyOptional({ nullable: true }) source?: string | null;
  @ApiPropertyOptional({ nullable: true }) sourceId?: string | null;
  @ApiPropertyOptional({ nullable: true }) remoteId?: string | null;
  @ApiProperty({ type: [CatalogueImportedUnmappedFieldDto] })
  unmappedSourceFields!: CatalogueImportedUnmappedFieldDto[];
}

export class CatalogueImportedPhysicalDescriptionPartDto {
  @ApiProperty() id!: string;
  @ApiProperty() subfield!: string;
  @ApiProperty() value!: string;
  @ApiProperty() sortOrder!: number;
  @ApiPropertyOptional({ nullable: true }) normalizedValue?: string | null;
}

export class CatalogueImportedPhysicalDescriptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() sortOrder!: number;
  @ApiPropertyOptional({ nullable: true }) source?: string | null;
  @ApiProperty({ type: [CatalogueImportedPhysicalDescriptionPartDto] })
  parts!: CatalogueImportedPhysicalDescriptionPartDto[];
}

export class CatalogueImportedPublicationStatementPartDto {
  @ApiProperty() id!: string;
  @ApiProperty() subfield!: string;
  @ApiProperty() value!: string;
  @ApiProperty() sortOrder!: number;
  @ApiPropertyOptional({ nullable: true }) normalizedValue?: string | null;
}

export class CatalogueImportedPublicationStatementDto {
  @ApiProperty() id!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() indicator1!: string;
  @ApiProperty() indicator2!: string;
  @ApiPropertyOptional({ nullable: true }) source?: string | null;
  @ApiProperty({ type: [CatalogueImportedPublicationStatementPartDto] })
  parts!: CatalogueImportedPublicationStatementPartDto[];
}

export class CatalogueImportedItemDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ nullable: true }) label?: string | null;
  @ApiPropertyOptional({ nullable: true }) location?: string | null;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ nullable: true }) notes?: string | null;
  @ApiProperty() organizationId!: string;
}

export class CatalogueImportedTitleDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() value!: string;
  @ApiPropertyOptional({ nullable: true }) subtitle?: string | null;
  @ApiPropertyOptional({ nullable: true }) language?: string | null;
  @ApiPropertyOptional({ nullable: true }) partNumber?: string | null;
  @ApiPropertyOptional({ nullable: true }) partName?: string | null;
  @ApiProperty() sortOrder!: number;
}

export class CatalogueImportedResponsibilityStatementDto {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiProperty() value!: string;
  @ApiProperty() sortOrder!: number;
}

export class CatalogueImportedLanguageDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() role!: string;
  @ApiProperty() sortOrder!: number;
}

export class CatalogueImportedSeriesDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) parallelTitle?: string | null;
  @ApiPropertyOptional({ nullable: true }) volumeNumber?: string | null;
  @ApiPropertyOptional({ nullable: true }) issn?: string | null;
  @ApiProperty() sortOrder!: number;
}

export class CatalogueImportedNoteDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() value!: string;
  @ApiProperty() sortOrder!: number;
}

export class CatalogueImportedClassificationDto {
  @ApiProperty() id!: string;
  @ApiProperty() notation!: string;
  @ApiProperty() system!: string;
  @ApiPropertyOptional({ nullable: true }) systemEdition?: string | null;
  @ApiPropertyOptional({ nullable: true }) authorityId?: string | null;
  @ApiProperty() sortOrder!: number;
}

export class CatalogueImportedContributorDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() role!: string;
  @ApiProperty({ enum: ['WORK', 'EDITION'] }) scope!: 'WORK' | 'EDITION';
  @ApiProperty() sortOrder!: number;
}

export class CatalogueImportedContributionSourcePartDto {
  @ApiProperty() code!: string;
  @ApiProperty() value!: string;
  @ApiProperty() sortOrder!: number;
}

export class CatalogueImportedContributionDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ['PERSON', 'CORPORATE_BODY', 'UNKNOWN'] }) kind!: string;
  @ApiProperty({ enum: ['WORK', 'EDITION'] }) scope!: 'WORK' | 'EDITION';
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ enum: ['PORBASE', 'MANUAL'] }) source!: string;
  @ApiPropertyOptional() roleLabel?: string | null;
  @ApiPropertyOptional() relationshipCodeScheme?: string | null;
  @ApiPropertyOptional({ nullable: true }) authorityId?: string | null;
  @ApiPropertyOptional() sourceTag?: string | null;
  @ApiPropertyOptional() indicator1?: string | null;
  @ApiPropertyOptional() indicator2?: string | null;
  @ApiProperty({ type: [CatalogueImportedContributionSourcePartDto] })
  sourceParts!: CatalogueImportedContributionSourcePartDto[];
}

export class CatalogueImportedEditionStatementDto {
  @ApiProperty() id!: string;
  @ApiProperty() value!: string;
  @ApiProperty() kind!: string;
  @ApiPropertyOptional({ nullable: true }) label?: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() sourceTag!: string;
}

export class CatalogueImportedEditionDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) subtitle?: string | null;
  @ApiPropertyOptional({ nullable: true }) isbn10?: string | null;
  @ApiPropertyOptional({ nullable: true }) isbn13?: string | null;
  @ApiPropertyOptional({ nullable: true }) publisher?: string | null;
  @ApiPropertyOptional({ nullable: true }) publicationDate?: string | null;
  @ApiPropertyOptional({ nullable: true }) language?: string | null;
  @ApiPropertyOptional({ nullable: true }) country?: string | null;
  @ApiPropertyOptional({ nullable: true }) format?: string | null;
  @ApiPropertyOptional({ nullable: true }) pageCount?: number | null;
  @ApiProperty({
    type: [CatalogueImportedPhysicalDescriptionDto],
    required: false,
  })
  physicalDescriptions?: CatalogueImportedPhysicalDescriptionDto[];
  @ApiProperty({
    type: [CatalogueImportedPublicationStatementDto],
    required: false,
  })
  publicationStatements?: CatalogueImportedPublicationStatementDto[];
  @ApiProperty({ type: [CatalogueImportedExternalIdentifierDto] })
  externalIdentifiers!: CatalogueImportedExternalIdentifierDto[];
  @ApiProperty({ type: [CatalogueImportedBibliographicRecordDto] })
  bibliographicRecords!: CatalogueImportedBibliographicRecordDto[];
  @ApiProperty({ type: [CatalogueImportedContributorDto] })
  contributors!: CatalogueImportedContributorDto[];
  @ApiProperty({ type: [CatalogueImportedContributionDto] })
  contributions!: CatalogueImportedContributionDto[];
  @ApiProperty({ type: [CatalogueImportedItemDto] })
  items!: CatalogueImportedItemDto[];
  @ApiProperty({ type: [CatalogueImportedTitleDto] })
  titles!: CatalogueImportedTitleDto[];
  @ApiProperty({ type: [CatalogueImportedResponsibilityStatementDto] })
  responsibilityStatements!: CatalogueImportedResponsibilityStatementDto[];
  @ApiProperty({ type: [CatalogueImportedLanguageDto] })
  languages!: CatalogueImportedLanguageDto[];
  @ApiProperty({ type: [CatalogueImportedSeriesDto] })
  series!: CatalogueImportedSeriesDto[];
  @ApiProperty({ type: [CatalogueImportedNoteDto] })
  notes!: CatalogueImportedNoteDto[];
  @ApiProperty({ type: [CatalogueImportedClassificationDto] })
  classifications!: CatalogueImportedClassificationDto[];
  @ApiProperty({ type: [CatalogueImportedEditionStatementDto] })
  editionStatements!: CatalogueImportedEditionStatementDto[];
}

export class CatalogueImportedWorkDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) subtitle?: string | null;
  @ApiProperty({ type: CatalogueImportedOrganizationDto })
  organization!: CatalogueImportedOrganizationDto;
  @ApiProperty({ type: [CatalogueImportedEditionDto] })
  editions!: CatalogueImportedEditionDto[];
  @ApiProperty({ type: [CatalogueImportedContributorDto] })
  contributors!: CatalogueImportedContributorDto[];
  @ApiProperty({ type: [CatalogueImportedContributionDto] })
  contributions!: CatalogueImportedContributionDto[];
  @ApiProperty({ type: [CatalogueImportedBibliographicRecordDto] })
  bibliographicRecords!: CatalogueImportedBibliographicRecordDto[];
  @ApiProperty({ type: [CatalogueImportedTitleDto] })
  titles!: CatalogueImportedTitleDto[];
}

export class CatalogueImportResponseDto {
  @ApiProperty({ example: 'porbase' })
  sourceId!: string;

  @ApiProperty({ example: 'work_cuid' })
  id!: string;

  @ApiProperty({ type: CatalogueImportedWorkDto })
  work!: CatalogueImportedWorkDto;

  @ApiProperty({ type: CatalogueImportedEditionDto })
  edition!: CatalogueImportedEditionDto;

  @ApiProperty({ type: [CatalogueImportedContributorDto] })
  contributors!: CatalogueImportedContributorDto[];
  @ApiProperty({ type: [CatalogueImportedContributionDto] })
  contributions!: CatalogueImportedContributionDto[];

  @ApiProperty({ type: [CatalogueImportedExternalIdentifierDto] })
  externalIdentifiers!: CatalogueImportedExternalIdentifierDto[];

  @ApiProperty({ type: CatalogueImportedBibliographicRecordDto })
  bibliographicRecord!: CatalogueImportedBibliographicRecordDto;

  @ApiProperty({ type: CatalogueImportedItemDto })
  item!: CatalogueImportedItemDto;

  @ApiProperty({ type: [Object], example: [] })
  warnings?: Array<{
    code: string;
    field?: string;
    message: string;
    original?: string;
    normalized?: string;
    type: string;
  }>;
}
