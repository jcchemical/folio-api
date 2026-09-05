import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PorbaseSearchQueryDto {
  @ApiProperty({
    description: 'ISBN-10 or ISBN-13, with optional spaces or hyphens',
    example: '9789724426495',
  })
  @IsString()
  @IsNotEmpty()
  isbn!: string;
}
