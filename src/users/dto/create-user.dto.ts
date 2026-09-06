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
    example: 'password-do-utilizador',
    description: 'Password do utilizador; é convertida em Argon2id antes de ser guardada',
  })
  @IsString()
  password!: string;
}