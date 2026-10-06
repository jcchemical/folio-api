import { ApiPropertyOptional } from '@nestjs/swagger';

export class EditionOutputDto {
  @ApiPropertyOptional({
    nullable: true,
    example: '/editions/clxxxxxxxxxxxxxxxxxxxxxxxx/cover',
    description: 'Relative URL of the active Edition cover, when available.',
  })
  coverUrl!: string | null;

  constructor(edition: Record<string, unknown>, hasActiveCover: boolean) {
    Object.assign(this, edition);
    this.coverUrl = hasActiveCover
      ? `/editions/${String(edition.id)}/cover`
      : null;
  }
}
