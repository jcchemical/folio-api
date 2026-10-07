import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(
  new URL('../../prisma/schema.prisma', import.meta.url),
  'utf8',
);
const sql = readFileSync(
  new URL(
    '../../prisma/migrations/20261006150000_tomos_domain_baseline/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('Tomos domain baseline', () => {
  it('defines the approved institutional and inventory models without legacy contributors', () => {
    expect(schema).toContain('model Library {');
    expect(schema).toContain('model Location {');
    expect(schema).toContain('model Holding {');
    expect(schema).toContain('model Item {');
    expect(schema).toContain('@@unique([organizationId, name])');
    expect(schema).toContain('@@unique([libraryId, name])');
    const itemModel = schema.match(/model Item \{([\s\S]*?)\n\}/)?.[1];
    const identifierModel = schema.match(
      /model ExternalIdentifier \{([\s\S]*?)\n\}/,
    )?.[1];
    const recordModel = schema.match(
      /model BibliographicRecord \{([\s\S]*?)\n\}/,
    )?.[1];
    expect(itemModel).toBeDefined();
    expect(itemModel).toContain('holdingId String');
    expect(itemModel).not.toMatch(
      /\b(organizationId|editionId|libraryId|locationId)\b/,
    );
    expect(identifierModel).toBeDefined();
    expect(identifierModel).not.toContain('organizationId');
    expect(identifierModel).toContain('@@unique([editionId, type, value])');
    expect(recordModel).toBeDefined();
    expect(recordModel).toContain('editionId String');
    expect(recordModel).not.toContain('workId');
    expect(schema).not.toMatch(
      /model (Contributor|WorkContributor|EditionContributor)\s*\{/,
    );
    expect(sql).toContain('CREATE TABLE "Library"');
    expect(sql).toContain('CREATE TABLE "Location"');
    expect(sql).toContain('CREATE TABLE "Holding"');
    expect(sql).toContain('CREATE TABLE "Item"');
    expect(sql).not.toContain('CREATE TABLE "Contributor"');
    expect(sql).not.toContain('CREATE TABLE "WorkContributor"');
    expect(sql).not.toContain('CREATE TABLE "EditionContributor"');
  });

  it('enforces XOR targets and organization equality for cross-parent relations', () => {
    expect(sql).toContain('CREATE TABLE "Agent"');
    expect(sql).toContain('CREATE TABLE "Contribution"');
    expect(sql).toContain('CONSTRAINT "Contribution_exactly_one_target"');
    expect(sql).toContain('"workId" IS NOT NULL AND "editionId" IS NULL');
    expect(sql).toContain('CONSTRAINT "BibliographicNote_exactly_one_target"');
    expect(sql).toContain('assert_holding_organization_consistency');
    expect(sql).toContain('Holding_same_organization');
    expect(sql).toContain('assert_contribution_agent_organization');
    expect(sql).toContain('Contribution_agent_same_organization');
    expect(sql).toContain('assert_edition_cover_organization_consistency');
    expect(sql).toContain('EditionCover_same_organization');
    expect(sql).toContain('assert_cover_candidate_organization_consistency');
    expect(sql).toContain('CoverCandidate_same_organization');
  });

  it('retains one-active-cover and organization-scoped cover-asset deduplication', () => {
    expect(sql).toContain('CoverAsset_organizationId_contentHash_key');
    expect(sql).toContain('EditionCover_one_active_per_edition_key');
    expect(sql).toContain('WHERE "isActive" = true');
  });
});
