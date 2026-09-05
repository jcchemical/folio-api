import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ImportPreviewQueryDto {
  @ApiProperty({
    description: 'ISBN-10 or ISBN-13 used to query PORBASE.',
    example: '9789724426495',
  })
  @IsString()
  @IsNotEmpty()
  isbn!: string;
}
