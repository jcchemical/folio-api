import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'catalogueSearchQueryShape', async: false })
class CatalogueSearchQueryShapeConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, { object }: ValidationArguments): boolean {
    const query = object as CatalogueSearchQueryDto;
    const fieldsByType = {
      isbn: 'isbn',
      title: 'title',
      author: 'author',
      keyword: 'keyword',
    } as const;
    const selectedField = fieldsByType[query.type];
    if (!selectedField) return false;

    return Object.entries(fieldsByType).every(
      ([, field]) => field === selectedField || query[field] === undefined,
    );
  }

  defaultMessage(): string {
    return 'query must contain only the field matching query.type';
  }
}

export class CatalogueSearchQueryDto {
  @ApiProperty({ enum: ['isbn', 'title', 'author', 'keyword'] })
  @IsString()
  @IsIn(['isbn', 'title', 'author', 'keyword'])
  @Validate(CatalogueSearchQueryShapeConstraint)
  type!: 'isbn' | 'title' | 'author' | 'keyword';

  @ApiProperty({ example: '9789724426495' })
  @ValidateIf(({ type }: CatalogueSearchQueryDto) => type === 'isbn')
  @IsString()
  @IsNotEmpty()
  isbn?: string;

  @ApiPropertyOptional({ example: 'Vida e andanças de Alexis Zorbás' })
  @ValidateIf(({ type }: CatalogueSearchQueryDto) => type === 'title')
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ example: 'Nikos Kazantzakis' })
  @ValidateIf(({ type }: CatalogueSearchQueryDto) => type === 'author')
  @IsString()
  @IsNotEmpty()
  author?: string;

  @ApiPropertyOptional({ example: 'literatura grega' })
  @ValidateIf(({ type }: CatalogueSearchQueryDto) => type === 'keyword')
  @IsString()
  @IsNotEmpty()
  keyword?: string;
}

export class SearchCatalogueDto {
  @ApiPropertyOptional({ example: 'porbase' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sourceId?: string;

  @ApiProperty({ type: CatalogueSearchQueryDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => CatalogueSearchQueryDto)
  query!: CatalogueSearchQueryDto;
}
