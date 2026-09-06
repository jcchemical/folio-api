import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Biblioteca Municipal de Lisboa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;
}
