import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@fol.io' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Nome do utilizador', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string | null;

  @ApiProperty({
    example: 'hash-da-password',
    description: 'Hash da password do utilizador',
  })
  @IsString()
  passwordHash!: string;
}