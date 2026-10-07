import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreateWorkDto, UpdateWorkDto } from './work.dto.js';

describe('Work DTO edition boundaries', () => {
  it('allows editions on create', async () => {
    const dto = plainToInstance(CreateWorkDto, {
      title: 'Work title',
      editions: [{ title: 'Edition title' }],
      organizationId: 'untrusted-organization',
    });

    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto.editions).toHaveLength(1);
    expect(dto).not.toHaveProperty('organizationId');
  });

  it('strips editions and organizationId from Work update', async () => {
    const dto = plainToInstance(UpdateWorkDto, {
      title: 'Updated title',
      subtitle: 'Updated subtitle',
      editions: [{ title: 'Destructive replacement payload' }],
      organizationId: 'untrusted-organization',
      id: 'untrusted-id',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(await validate(dto, { whitelist: true })).toEqual([]);
    expect(dto).toEqual({
      title: 'Updated title',
      subtitle: 'Updated subtitle',
    });
    expect(dto).not.toHaveProperty('editions');
    expect(dto).not.toHaveProperty('organizationId');
  });
});
