import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@fol.io' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password-do-utilizador' })
  @IsString()
  @MinLength(8)
  password!: string;
}
