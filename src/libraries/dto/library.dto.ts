import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateLibraryDto {
  @ApiProperty({ example: 'Biblioteca Central' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(200)
  name!: string;
}

export class UpdateLibraryDto extends PartialType(CreateLibraryDto) {}
