import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
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

export class PorbaseImportWorkDto {
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
  institutionId?: string | null;
}

export class PorbaseImportEditionDto {
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

  @ApiPropertyOptional({ example: '2022-01-01', nullable: true })
  @IsOptional()
  @IsDateString()
  publishDate?: string | null;

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

  @ApiPropertyOptional({ example: 383, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  pages?: number | null;
}

export class PorbaseImportContributorDto {
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

export class PorbaseImportExternalIdentifierDto {
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

export class PorbaseImportBibliographicRecordDto {
  @ApiProperty({ example: 'MARCXCHANGE' })
  @IsString()
  @IsNotEmpty()
  format!: string;

  @ApiProperty({ example: 'UNIMARC' })
  @IsString()
  @IsNotEmpty()
  schema!: string;

  @ApiProperty({ example: 'PORBASE' })
  @IsString()
  @IsNotEmpty()
  source!: string;

  @ApiPropertyOptional({ example: '3664836', nullable: true })
  @IsOptional()
  @IsString()
  remoteId?: string | null;

  @ApiProperty({ example: '<collection>...</collection>' })
  @IsString()
  @IsNotEmpty()
  rawContent!: string;
}

export class PorbaseImportItemDto {
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

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsString()
  institutionId?: string | null;
}

export class PorbaseImportDto {
  @ApiProperty({ type: PorbaseImportWorkDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => PorbaseImportWorkDto)
  work!: PorbaseImportWorkDto;

  @ApiProperty({ type: PorbaseImportEditionDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => PorbaseImportEditionDto)
  edition!: PorbaseImportEditionDto;

  @ApiProperty({ type: [PorbaseImportContributorDto] })
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PorbaseImportContributorDto)
  contributors!: PorbaseImportContributorDto[];

  @ApiProperty({ type: [PorbaseImportExternalIdentifierDto] })
  @IsDefined()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PorbaseImportExternalIdentifierDto)
  externalIdentifiers!: PorbaseImportExternalIdentifierDto[];

  @ApiProperty({ type: PorbaseImportBibliographicRecordDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => PorbaseImportBibliographicRecordDto)
  bibliographicRecord!: PorbaseImportBibliographicRecordDto;

  @ApiProperty({ type: PorbaseImportItemDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => PorbaseImportItemDto)
  item!: PorbaseImportItemDto;
}

export class PorbasePersistedInstitutionDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class PorbasePersistedExternalIdentifierDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() value!: string;
  @ApiPropertyOptional({ nullable: true }) source?: string | null;
}

export class PorbasePersistedBibliographicRecordDto {
  @ApiProperty() id!: string;
  @ApiProperty() format!: string;
  @ApiProperty() rawContent!: string;
  @ApiPropertyOptional({ nullable: true }) source?: string | null;
  @ApiPropertyOptional({ nullable: true }) remoteId?: string | null;
}

export class PorbasePersistedItemDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ nullable: true }) label?: string | null;
  @ApiPropertyOptional({ nullable: true }) location?: string | null;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ nullable: true }) notes?: string | null;
  @ApiPropertyOptional({ nullable: true }) institutionId?: string | null;
}

export class PorbasePersistedContributorDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() role!: string;
  @ApiProperty({ enum: ['WORK', 'EDITION'] }) scope!: 'WORK' | 'EDITION';
  @ApiProperty() sortOrder!: number;
}

export class PorbasePersistedEditionDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) subtitle?: string | null;
  @ApiPropertyOptional({ nullable: true }) isbn10?: string | null;
  @ApiPropertyOptional({ nullable: true }) isbn13?: string | null;
  @ApiPropertyOptional({ nullable: true }) publisher?: string | null;
  @ApiPropertyOptional({ nullable: true }) publishDate?: Date | null;
  @ApiPropertyOptional({ nullable: true }) language?: string | null;
  @ApiPropertyOptional({ nullable: true }) country?: string | null;
  @ApiPropertyOptional({ nullable: true }) format?: string | null;
  @ApiPropertyOptional({ nullable: true }) pages?: number | null;
  @ApiProperty({ type: [PorbasePersistedExternalIdentifierDto] })
  externalIdentifiers!: PorbasePersistedExternalIdentifierDto[];
  @ApiProperty({ type: [PorbasePersistedBibliographicRecordDto] })
  bibliographicRecords!: PorbasePersistedBibliographicRecordDto[];
  @ApiProperty({ type: [PorbasePersistedContributorDto] })
  contributors!: PorbasePersistedContributorDto[];
  @ApiProperty({ type: [PorbasePersistedItemDto] })
  items!: PorbasePersistedItemDto[];
}

export class PorbasePersistedWorkDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) subtitle?: string | null;
  @ApiPropertyOptional({ type: PorbasePersistedInstitutionDto, nullable: true })
  institution?: PorbasePersistedInstitutionDto | null;
  @ApiProperty({ type: [PorbasePersistedEditionDto] })
  editions!: PorbasePersistedEditionDto[];
  @ApiProperty({ type: [PorbasePersistedContributorDto] })
  contributors!: PorbasePersistedContributorDto[];
  @ApiProperty({ type: [PorbasePersistedBibliographicRecordDto] })
  bibliographicRecords!: PorbasePersistedBibliographicRecordDto[];
}

export class PorbaseImportResponseDto {
  @ApiProperty({ example: 'work_cuid' })
  id!: string;

  @ApiProperty({ type: PorbasePersistedWorkDto })
  work!: PorbasePersistedWorkDto;

  @ApiProperty({ type: PorbasePersistedEditionDto })
  edition!: PorbasePersistedEditionDto;

  @ApiProperty({ type: [PorbasePersistedContributorDto] })
  contributors!: PorbasePersistedContributorDto[];

  @ApiProperty({ type: [PorbasePersistedExternalIdentifierDto] })
  externalIdentifiers!: PorbasePersistedExternalIdentifierDto[];

  @ApiProperty({ type: PorbasePersistedBibliographicRecordDto })
  bibliographicRecord!: PorbasePersistedBibliographicRecordDto;

  @ApiProperty({ type: PorbasePersistedItemDto })
  item!: PorbasePersistedItemDto;
}
