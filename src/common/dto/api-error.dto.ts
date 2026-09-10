import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({ example: 'Conflict' })
  error!: string;

  @ApiProperty({ example: 'CONFLICT_DUPLICATE_EDITION' })
  code!: string;

  @ApiProperty({
    example: 'An edition with this ISBN already exists for this organization.',
  })
  message!: string;

  @ApiPropertyOptional({ example: { messages: ['email must be an email'] } })
  details?: unknown;

  @ApiPropertyOptional({
    description:
      'Only present when development diagnostics are explicitly enabled.',
    example: {
      name: 'Error',
      message: 'safe diagnostic message',
      stack: '...',
    },
  })
  debug?: {
    name?: string;
    message?: string;
    stack?: string;
    prismaCode?: string;
  };
}
