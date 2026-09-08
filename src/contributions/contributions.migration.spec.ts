import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(new URL('../../prisma/migrations/20260908110000_add_agents_and_contributions/migration.sql', import.meta.url), 'utf8');

describe('agents and contributions migration', () => {
  it('is additive and enforces exactly one target', () => {
    expect(sql).toContain('CREATE TABLE "Agent"');
    expect(sql).toContain('CREATE TABLE "Contribution"');
    expect(sql).toContain('CONSTRAINT "Contribution_exactly_one_target"');
    expect(sql).toContain('"workId" IS NOT NULL AND "editionId" IS NULL');
    expect(sql).not.toMatch(/(?:DROP|ALTER) TABLE "(?:Contributor|WorkContributor|EditionContributor)"/);
  });
});