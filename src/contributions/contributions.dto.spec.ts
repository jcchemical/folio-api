import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateContributionDto } from './contributions.dto.js';

describe('CreateContributionDto', () => {
  it('does not declare server-controlled source or MARC metadata fields', async () => {
    const value = plainToInstance(CreateContributionDto, {
      workId: 'work-1', agentId: 'agent-1', source: 'PORBASE', sourceTag: '700', indicator1: ' ', sourceParts: [],
    });
    const errors = await validate(value, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['source', 'sourceTag', 'indicator1', 'sourceParts']));
  });
});