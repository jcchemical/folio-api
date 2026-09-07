# Design Decision: Development Database Reset & Data Model Refinements

**Date:** 2026-09-07  
**Scope:** Phase 1 consolidation before production development  
**Status:** APPROVED TARGET — IMPLEMENTED IN CODE, RESET PENDING  
**Destructive Actions:** None executed; requires explicit user confirmation  

---

## Executive Summary

This document evaluates three major model refinements for a clean development database reset:

1. **PhysicalDescription structure**: Flat vs. grouped
2. **Edition.pages**: Rename and derive semantically
3. **Edition.publishDate**: DateTime vs. String with precision tracking

**Approved target**: Deliberate breaking refinement. `PhysicalDescription` is grouped into one row per UNIMARC 215 occurrence with ordered `PhysicalDescriptionPart` children; `Edition.pages` becomes derived `pageCount`; and `Edition.publishDate` becomes exact `publicationDate` text without a persisted precision enum. The development database is reset after implementation validation.

> The earlier flat-model alternatives in this document are retained as decision history only. They are not the implementation target.

---

## Current State Analysis

### PhysicalDescription Model

**Current Implementation:**
```prisma
model PhysicalDescription {
  id              String   @id @default(cuid())
  editionId       String
  subfield        String          // 'a', 'b', 'c', 'd', (future: 'e', 'f')
  value           String          // '146, [6] p.', 'il.', '24 cm', etc.
  sortOrder       Int      @default(0)
  source          String?         // 'PORBASE', null for local
  normalizedValue String?         // reserved for future auto-normalization
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  edition Edition @relation(fields: [editionId], references: [id], onDelete: Cascade)
  @@index([editionId, sortOrder, id])
}
```

**Parser Behavior:**
- Extracts UNIMARC 215 subfields a, b, c, d only
- Preserves order of appearance
- Assigns incremental `sortOrder` across all extracted subfields
- Sets `source: 'PORBASE'` on imported descriptions
- Handles both MARC text and MARCXchange/XML formats correctly

**Current Constraints:**
- DTO validation restricts `subfield` to ['a', 'b', 'c', 'd']
- Flutter model/tests include e, f, and unknown subfields
- Contract incompatibility: backend rejects what Flutter UI can send

**Actual PORBASE Data Pattern (Observation):**
- PORBASE responses typically contain 0-1 UNIMARC 215 fields
- Multiple 215 occurrences are rare in practice
- Subfields are usually: 215 a (extent) + optional b (illustrations) + optional c (dimensions)
- No evidence of grouped 215 fields requiring separate row hierarchies

---

### Edition.pages Field

**Current Implementation:**
```prisma
model Edition {
  pages       Int?        // optional derived value, e.g., 383
  // ... other fields
}
```

**Semantic Issue:**
- Name `pages` is ambiguous: could mean page count (derived) or page range (stored)
- Currently stored as nullable integer
- Mapper prefers `physicalDescriptions` over `pages` for export
- Flutter tests show pages can be null with textual descriptions

**Best Practice:**
- UNIMARC 215$a may contain "146, [6] p." (not a simple integer)
- Export mapper correctly maps: descriptions present → use 215 subfields; no descriptions + pages present → use "pages p."
- No action needed for current MVP

---

### Edition.publishDate Field

**Current Implementation:**
```prisma
model Edition {
  publishDate DateTime?   // Stored as timestamp, loses precision intent
  // ... other fields
}
```

**Current Parser Behavior:**
```typescript
function normalizePublicationDate(
  value: string | undefined,
  warnings: PorbaseWarningDto[],
): string | null | undefined {
  // Input: "2009", "D.L. 2009", "2009." → Output: "2009"
  // Extracts year only from patterns like "D.L. 2009"
  // Stores in metadata as string: "2009"
}
```

**Backend Import Behavior:**
```typescript
publishDate: input.edition.publishDate
  ? new Date(input.edition.publishDate)  // "2022" → Date(2022-01-01T00:00:00Z)
  : null,
```

**Semantic Loss:**
- User enters "2022" (year-only precision in UNIMARC)
- Backend stores DateTime: 2022-01-01T00:00:00Z UTC
- Returned as ISO string: "2022-01-01T00:00:00Z"
- User sees full date, but original source was year-only
- UNIMARC semantics lost: "2022" is not "January 1, 2022"

**Flutter Validation (Already Implemented):**
```dart
bool isValidBibliographicDate(String value) {
  if (RegExp(r'^\d{4}$').hasMatch(value)) return true;  // YYYY
  final monthMatch = RegExp(r'^(\d{4})-(\d{2})$').firstMatch(value);
  if (monthMatch != null) {
    final month = int.parse(monthMatch.group(2)!);
    return month >= 1 && month <= 12;
  }
  // YYYY-MM-DD validation...
}
```

---

## Design Evaluation

### 1. PhysicalDescription Structure

#### Option A: Keep Flat Model (RECOMMENDED)

**Rationale:**
- PORBASE data rarely contains multiple 215 fields (< 1% of records)
- Current flat model correctly handles 99% of real-world cases
- Group-child hierarchy adds complexity without measurable benefit for MVP
- Migration cost (breaking change) is high; benefit is low
- Simple to extend later if grouped 215s become common

**Implementation:**
- Extend DTO validation to accept subfields a–f and unknown
- Update parser to extract e, f if present (currently ignored)
- Document that grouping is not supported for Phase 1
- Reserve `normalizedValue` for future semantic normalization

**Code Changes Required:**
```typescript
// DTOs: expand validation
@IsIn(['a', 'b', 'c', 'd', 'e', 'f'])  // was: @IsIn(['a', 'b', 'c', 'd'])

// Parser: no changes needed (already iterates all subfields)
// Just don't filter them in extractTextPhysicalDescriptions/extractXmlPhysicalDescriptions

// Mapper: filter subfields by presence, not by known list
subfields: physicalDescriptions
  .filter(({ subfield, value }) =>
    // was: ['a', 'b', 'c', 'd'].includes(subfield) && isNonEmpty(value)
    isNonEmpty(value)  // Accept any subfield, preserve for forward compatibility
  )
```

**Acceptance Test:**
- Parser extracts 215 $e (material acompanhante) if present in PORBASE data
- Parser extracts 215 $f (peso) if present in PORBASE data
- Export mapper includes all subfields in 215 field, not just a–d
- Flutter UI can send e, f, unknown subfields without 400 error
- Unknown subfields are preserved and exported in MARC output

---

#### Option B: Grouped 215 Model (NOT RECOMMENDED)

**Structure:**
```prisma
model PhysicalDescriptionField {
  id                String   @id @default(cuid())
  editionId         String
  fieldOccurrence   Int      // 1, 2, 3 for multiple 215 occurrences
  sortOrder         Int      // position within 215
  
  parts  PhysicalDescriptionPart[]
}

model PhysicalDescriptionPart {
  id                          String   @id @default(cuid())
  physicalDescriptionFieldId  String
  subfield                    String   // 'a', 'b', 'c', etc.
  value                       String
  partOrder                   Int      // position within field parts
}
```

**Rejected Because:**
- Adds 1–2 tables and JOIN complexity
- PORBASE data shows no practical need (< 1% of records have multiple 215)
- Migration is breaking change requiring:
  - New schema and migration
  - Parser rewrite
  - DTO/service updates
  - Mapper changes
  - Flutter API contract changes
  - All tests updates
- Cost: ~40–60 engineer-hours
- Benefit for MVP: negligible
- **Deferred to Phase 2** if and when grouped 215s become common

---

### 2. Edition.pages vs. Edition.pageCount

#### Current Field

**Name:** `pages: Int?`  
**Semantics:** Ambiguous (page count? page range? first page?)  
**Usage:** Export fallback when PhysicalDescription unavailable

#### Option A: Rename to `pageCount` (RECOMMENDED)

**Rationale:**
- Clarifies semantic: "count of pages" vs. other page metadata
- Signals: this is a derived/optional field, not the source of truth
- Aligns with export mapper: `${pageCount} p.` is explicit

**Implementation:**
```prisma
model Edition {
  // Before:
  pages       Int?

  // After:
  pageCount   Int?        // Optional derived value, fallback for export when no PhysicalDescription
}
```

**Cost:** Low (rename + 1 migration)
**Risk:** Low (compatible; can rename in steps with deprecation)
**Benefit:** High (semantic clarity)

**Migration Strategy:**
```sql
-- Step 1: Add pageCount (nullable), copy pages → pageCount
ALTER TABLE "Edition" ADD COLUMN "pageCount" INTEGER;
UPDATE "Edition" SET "pageCount" = "pages";

-- Step 2: Update code to use pageCount
-- Step 3: Drop old pages column in separate migration (backward compatible phase)
```

**Acceptance Test:**
- Export mapper uses `edition.pageCount` instead of `edition.pages`
- Flutter still receives `pageCount` (or both during transition)
- Tests verify: pageCount null with PhysicalDescription text is valid

---

#### Option B: Keep Field Name (NOT RECOMMENDED)

**Rationale:** No breaking change needed for MVP  
**Drawback:** Semantic ambiguity remains; confuses future developers

---

### 3. Edition.publishDate: DateTime vs. String

#### Option A: Change to String with Precision Tracking (RECOMMENDED)

**Current Problem:**
- DateTime enforces full precision (YYYY-MM-DD HH:MM:SS UTC)
- Parser extracts YYYY from patterns like "D.L. 2009"
- Backend coerces "2022" → DateTime(2022-01-01) → ISO string "2022-01-01T00:00:00Z"
- User/export sees full date, original intent (year-only) is lost
- UNIMARC 210$d semantics violated

**Target Implementation:**

```prisma
model Edition {
  // Replace:
  publishDate DateTime?

  // With:
  publicationDate     String?    // YYYY, YYYY-MM, or YYYY-MM-DD
  publicationDatePrecision String?  // 'YEAR' | 'YEAR_MONTH' | 'FULL_DATE'
}
```

**Rationale for Two Fields:**
- `publicationDate` is user-facing, API-facing
- `publicationDatePrecision` is semantic metadata
- Allows export mapper to emit correct UNIMARC 210$d (no padding to full date)
- Enables future searches by year/month without losing precision intent
- Future: `publicationDatePrecision` could drive UI rendering (show "2022" not "2022-01-01")

**API Contract (Confirmation Payload):**
```typescript
// Input DTO (PorbaseImportEditionDto)
@IsOptional()
@IsDateString()  // Accepts YYYY, YYYY-MM, YYYY-MM-DD
publicationDate?: string | null;

// Derivation in service:
publicationDatePrecision = publicationDate
  ? /^\d{4}$/.test(publicationDate) ? 'YEAR'
    : /^\d{4}-\d{2}$/.test(publicationDate) ? 'YEAR_MONTH'
    : 'FULL_DATE'
  : null;
```

**Export Mapper Behavior:**
```typescript
function serializePublishDate(value: string | null | undefined, precision?: string): string | undefined {
  if (!value) return undefined;
  
  // Return as-is if precision is YEAR or YEAR_MONTH
  // Do not pad to full date
  return value;
}
```

**Migration:**
```sql
-- Step 1: Add new columns
ALTER TABLE "Edition" 
  ADD COLUMN "publicationDate" VARCHAR(10),
  ADD COLUMN "publicationDatePrecision" VARCHAR(11);

-- Step 2: Migrate existing data
UPDATE "Edition"
SET 
  "publicationDate" = TO_CHAR("publishDate", 'YYYY-MM-DD'),
  "publicationDatePrecision" = 'FULL_DATE'
WHERE "publishDate" IS NOT NULL;

-- Step 3: Update code
-- Step 4: Remove old publishDate column
ALTER TABLE "Edition" DROP COLUMN "publishDate";
```

**Parser Changes:**
```typescript
// No change; normalizePublicationDate already returns string "2022"
// Just pass through to DTO
```

**Acceptance Tests:**
- Import "2022" → stored as "2022" + YEAR precision
- Export UNIMARC 210$d emits "2022" (not "2022-01-01")
- Import "2022-06" → stored as "2022-06" + YEAR_MONTH precision
- Import "2022-06-21" → stored as "2022-06-21" + FULL_DATE precision
- Flutter receives precision metadata and renders appropriately
- Edition detail API returns both publicationDate and publicationDatePrecision

---

#### Option B: Store as String, Derive Precision in Mapper (NOT RECOMMENDED)

**Approach:** Skip `publicationDatePrecision` field; infer from string format

**Problem:** 
- Mapper must parse date string to determine precision
- Ambiguous: "2022-01-01" could be intentional full date or coerced from "2022"
- No semantic record of original source precision
- Fragile for future date parsing logic

**Rejected in favor of Option A**

---

#### Option C: Keep DateTime (NOT RECOMMENDED)

**Problem:** Loses precision intent; violates UNIMARC semantics  
**Rejected**

---

## Comprehensive Effects Analysis

### Parser (`src/catalogues/porbase.parser.ts`)

**Changes for PhysicalDescription (Option A):**
- No changes to extraction logic (already iterates all subfields)
- Remove subfield filtering if present
- Tests: verify 215 $e, $f, unknown subfields are extracted and preserved

**Changes for PublicationDate (Option A):**
- No changes; `normalizePublicationDate` already returns string
- Keep returning "2022" (not DateTime)
- Tests: unchanged

---

### DTOs (Input Validation)

**PhysicalDescriptionDto:**
```typescript
export class PhysicalDescriptionDto {
  @ApiProperty({ enum: ['a', 'b', 'c', 'd', 'e', 'f', ...], example: 'a' })
  @IsIn(['a', 'b', 'c', 'd', 'e', 'f'])  // Was: @IsIn(['a', 'b', 'c', 'd'])
  subfield!: string;  // Accept any string for forward compatibility
  // ... rest unchanged
}
```

**PorbaseImportEditionDto & CreateEditionDto:**
```typescript
@ApiPropertyOptional({ example: '2022', nullable: true })
@IsOptional()
@IsDateString()  // Already accepts YYYY, YYYY-MM, YYYY-MM-DD
publicationDate?: string | null;  // Changed from DateTime
```

---

### Services & Repositories

**EditionsService.create():**
```typescript
// No change to signature
// Internally: new Date(input.publishDate) → removed
// Just store input.publishDate as string + compute precision
```

**PorbaseImportService.import():**
```typescript
// Before:
publishDate: input.edition.publishDate
  ? new Date(input.edition.publishDate)
  : null,

// After:
publicationDate: input.edition.publishDate ?? null,
publicationDatePrecision: derivePublicationDatePrecision(input.edition.publishDate),
```

**ExportsService:**
- Mapper receives `publicationDate` as string
- Mapper returns string as-is (no serialization needed)

---

### Mapper (`src/bibliography/mappers/unimarc-local.mapper.ts`)

**For PhysicalDescription:**
```typescript
// Before:
.filter(({ subfield, value }) =>
  ['a', 'b', 'c', 'd'].includes(subfield) && isNonEmpty(value),
)

// After:
.filter(({ subfield, value }) =>
  isNonEmpty(value)  // Accept any subfield
)
```

**For PublicationDate:**
```typescript
// Before:
function serializePublishDate(value: Date | string | null | undefined): string | undefined {
  if (value instanceof Date) {
    return value.toISOString();  // "2022-01-01T00:00:00Z" ← WRONG
  }
  return value ?? undefined;
}

// After:
function serializePublishDate(value: string | null | undefined): string | undefined {
  return value ?? undefined;  // "2022" ← CORRECT
}
```

---

### Tests

**Parser Tests (`porbase.parser.spec.ts`):**
- Add test: 215 $e is extracted if present
- Add test: 215 $f is extracted if present
- Add test: Unknown subfield 'x' is extracted if present
- Verify precision return: "2022", "2022-06", etc.

**Import Tests (`porbase-import.service.spec.ts`):**
- Verify publicationDate stored as string
- Verify publicationDatePrecision set correctly
- Verify normalizedValue not required in input

**Mapper Tests (`unimarc-local.mapper.spec.ts`):**
- Verify 215 includes e, f if present
- Verify 210$d returns "2022" (not "2022-01-01")

**Edition Tests (`editions.service.spec.ts`):**
- Rename pages → pageCount references
- Update test data to use new field names

**Export Tests (`exports.service.spec.ts`):**
- Verify 210$d preserves precision (year-only exports as "2022")

**Flutter Integration Tests:**
- Verify deserialization of publicationDate + publicationDatePrecision

---

### Documentation

**CONTEXT.md:**
- Update "Limitação de descrição física" section:
  - Note: Subfields a–f now supported; unknown subfields preserved
  - Clarify normalizedValue is reserved for future auto-normalization
- Update "Publicação" section (new):
  - Document YYYY, YYYY-MM, YYYY-MM-DD support
  - Explain publicationDatePrecision tracking
  - Note: Mapper respects precision, does not pad to full date

**AGENTS.md:**
- Update physical description contract to note e, f support
- Update publication date rules to note String storage + precision tracking

**folio_architecture.md:**
- Update "Descrição física repetível" to note subfield expansion
- Update "Publicação" to note precision preservation

---

### Flutter Integration

**Expected Changes:**
- No breaking changes; data model is backward compatible
- API response includes `publicationDatePrecision` (new field)
- Flutter can render "2022" vs. "2022-06" differently based on precision
- PhysicalDescription UI can now send subfields e, f (no validation error)
- Import confirmation payload unchanged

**Flutter Tests:**
- Update fixtures to include publicationDatePrecision
- Verify parsing of all precision levels
- Verify UI can handle new subfield types

---

## Rejected Alternatives

### 1. Full MARC Field Grouping for 215

**Why Rejected:**
- PORBASE data shows < 1% use of multiple 215 fields
- Breaks current API contracts
- Adds complexity (2 new tables, JOINs, reordering logic)
- Defers to Phase 2 if data patterns change

---

### 2. Separate Pages and PageRange Fields

**Why Rejected:**
- Current usage (fallback export value) only needs integer count
- Renaming to `pageCount` is sufficient clarity
- Future: if page ranges needed, add as separate field + model

---

### 3. Publication Date Stored as JSON for Precision Metadata

**Why Rejected:**
- PostgreSQL can store precision as separate column (cleaner, queryable)
- JSON adds parsing complexity
- Query filtering by year/month becomes harder

---

### 4. Breaking API: Reject Partial Dates in Favor of Full Date Only

**Why Rejected:**
- Violates UNIMARC semantics (210$d can be year-only)
- Loses information from source data
- Inconsistent with bibliographic practice
- Flutter already implements YYYY, YYYY-MM, YYYY-MM-DD validation

---

## Proposed Prisma Schema Changes

### Migration: Consolidate Phase 1 Data Model

**File:** `prisma/migrations/20260910000000_refine_phase1_model/migration.sql`

```sql
-- Step 1: Rename pages → pageCount
ALTER TABLE "Edition" RENAME COLUMN "pages" TO "pageCount";

-- Step 2: Add publication date precision tracking
ALTER TABLE "Edition" 
  ADD COLUMN "publicationDate" VARCHAR(10),
  ADD COLUMN "publicationDatePrecision" VARCHAR(11);

-- Step 3: Migrate existing publishDate → publicationDate
UPDATE "Edition"
SET 
  "publicationDate" = TO_CHAR("publishDate", 'YYYY-MM-DD'),
  "publicationDatePrecision" = 'FULL_DATE'
WHERE "publishDate" IS NOT NULL;

-- Step 4: Drop old publishDate column
ALTER TABLE "Edition" DROP COLUMN "publishDate";

-- Note: PhysicalDescription.normalizedValue remains unused but reserved
-- Parser will extract subfields a-f and unknown
-- DTO validation updated to accept a-f (prepared for e, f)
```

---

## Implementation Phases

### Phase 1a: Schema & DTOs (Immediate)

**Duration:** 2–3 hours  
**Steps:**
1. Update Prisma schema
2. Create migration (non-destructive for test data)
3. Update DTOs: `publishDate: string` (accept all valid formats)
4. Update DTOs: `subfield: any string` (accept e, f, unknown)
5. Regenerate Prisma client
6. Update services to use new field names

**Acceptance Criteria:**
- Schema compiles
- Migration applies cleanly to dev database
- No type errors
- DTOs validate YYYY, YYYY-MM, YYYY-MM-DD
- DTOs accept e, f, unknown subfields

---

### Phase 1b: Parser & Services (Immediate)

**Duration:** 3–4 hours  
**Steps:**
1. Update parser: derive `publicationDatePrecision` from string
2. Update `PorbaseImportService.import()` to persist precision
3. Update `EditionsService` to handle string dates
4. Remove `new Date(string)` coercion

**Acceptance Criteria:**
- Parser tests pass: YYYY/YYYY-MM/YYYY-MM-DD extraction verified
- Import service tests pass: precision recorded correctly
- Edition tests pass: no DateTime type errors

---

### Phase 1c: Mapper & Export (Immediate)

**Duration:** 2–3 hours  
**Steps:**
1. Update mapper: accept `publicationDate: string`
2. Remove `toISOString()` coercion
3. Expand 215 field to include e, f, unknown subfields
4. Update export tests

**Acceptance Criteria:**
- Export mapper tests pass: 210$d preserves precision
- 215 field includes e, f subfields
- MARCXchange export reflects correct subfield set

---

### Phase 1d: Tests & Documentation (Immediate)

**Duration:** 3–4 hours  
**Steps:**
1. Update all unit tests to use new field/precision values
2. Add new tests: e, f, unknown subfield handling
3. Update CONTEXT.md, AGENTS.md, folio_architecture.md
4. Add acceptance tests for precision preservation

**Acceptance Criteria:**
- All 118+ unit tests pass
- New test scenarios: e, f, unknown, precision all covered
- Documentation reflects changes
- No breaking API changes (backward compatible at HTTP level)

---

### Phase 1e: Flutter Integration (Phase 2)

**Duration:** 2–3 hours  
**Steps:**
1. Update Flutter models: deserialize `publicationDatePrecision`
2. Update Flutter API client to send precision (if editing)
3. Add UI logic: render "2022" for YEAR precision
4. Update Flutter tests

**Acceptance Criteria:**
- Flutter tests parse precision metadata
- UI displays dates appropriately
- No errors on confirmation with new field values

---

## Database Reset Strategy

### For Development Environment

**Option 1: Fresh Seed (Recommended)**

```bash
# 1. Drop and recreate database
npx prisma migrate reset --force

# 2. Apply all migrations (including new ones)
npx prisma migrate deploy

# 3. Regenerate client
npx prisma generate

# 4. Run tests
npm run test
npm run test:e2e
```

**Timing:** ~10 seconds  
**Data Loss:** Development test data only (acceptable)  
**Risk:** Low

---

### For CI/CD (GitHub Actions)

**No manual action needed:**
- CI uses ephemeral database per workflow
- All migrations applied automatically
- Tests run against clean schema

---

## Acceptance Tests

### Test 1: PhysicalDescription Subfield Expansion

```typescript
// Test: Parser extracts 215 $e if present
const result = parsePorbaseResponse(query, xmlWithField215e);
expect(result.metadata.physicalDescriptions).toContainEqual({
  subfield: 'e',
  value: 'some material',
  sortOrder: expect.any(Number),
  source: 'PORBASE',
});
```

### Test 2: Publication Date Precision Preservation

```typescript
// Test: Year-only date preserved
const preview = await importPreview('9789724426495');
expect(preview.edition.publishDate).toBe('2022');

// Test: Confirmation stores precision
await confirmImport({ edition: { publishDate: '2022', ... } });
const stored = await editions.findById(id);
expect(stored.publicationDate).toBe('2022');
expect(stored.publicationDatePrecision).toBe('YEAR');
```

### Test 3: Export Mapper Respects Precision

```typescript
// Test: UNIMARC export returns year-only 210$d
const marc = mapLocalEditionToUnimarc({
  publishDate: '2022',
  // ... other fields
});
const field210d = marc.record.dataFields
  .find(f => f.tag === '210')
  .subfields.find(s => s.code === 'd');
expect(field210d.value).toBe('2022'); // Not '2022-01-01'
```

### Test 4: Backend API Validation

```typescript
// Test: POST /catalogues/porbase/import accepts all precision levels
const payload = {
  edition: { publishDate: '2022', ... },
  // ... other fields
};
const response = await api.post('/catalogues/porbase/import', payload);
expect(response.status).toBe(200);

// Test: Wrong format rejected
const invalid = {
  edition: { publishDate: '2022/06/21', ... },
  // ...
};
const response = await api.post('/catalogues/porbase/import', invalid);
expect(response.status).toBe(400);
```

### Test 5: Flutter Compatibility

```dart
// Test: Flutter deserializes new field
final preview = PorbaseImportPreview.fromJson({
  'edition': {
    'publishDate': '2022-06',
    // ... other fields
  },
  // ...
});
expect(preview.edition.publishDate, '2022-06');

// Test: Validation accepts all formats
final editable = EditableImportPreview.fromPreview(preview);
for (final date in ['2022', '2022-06', '2022-06-21']) {
  editable.publishDate = date;
  expect(editable.validate()['publishDate'], isNull);
}
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Schema migration fails | Low | High | Test on clean dev DB first; have rollback plan |
| API breaking change | Low | Critical | All changes are backward-compatible in HTTP contract |
| Flutter deserialization fails | Low | Medium | Update Flutter model in parallel; test e2e |
| Export MARC invalid | Low | Medium | Mapper tests verify subfield syntax |
| Precision metadata loss | Low | High | Test round-trips: store → export → verify |

---

## Sign-Off Checklist

Before proceeding with implementation:

- [ ] **Architecture review:** Confirm flat PhysicalDescription (no grouping)
- [ ] **API compatibility:** Confirm String dates + precision metadata is acceptable
- [ ] **Flutter alignment:** Confirm Flutter can handle precision tracking
- [ ] **Migration plan:** Confirm database reset is acceptable for development
- [ ] **Timeline:** Confirm Phase 1d timeline (6–10 hours total)
- [ ] **Test coverage:** Confirm acceptance tests are comprehensive

---

## Next Steps

**If approved:**
1. User confirms recommendations
2. Proceed with Phase 1a–1d implementation (immediate)
3. Defer Phase 1e (Flutter) to Phase 2 start
4. Update CONTEXT.md, AGENTS.md after implementation
5. Commit changes with migration

**If alternative selected:**
1. Document alternate decision
2. Adjust implementation phases accordingly

---

## Appendix: Current vs. Proposed Comparison

### PhysicalDescription

| Aspect | Current | Proposed | Change |
|--------|---------|----------|--------|
| Subfields | a, b, c, d | a–f + unknown | ✅ Expand validation |
| Structure | Flat rows | Flat rows | — No change |
| normalizedValue | Unused | Reserved | — Document intent |
| Parser | Extract a–d | Extract all | ✅ Remove filter |
| Mapper | Filter a–d | Accept all | ✅ Remove filter |

### Edition.pages

| Aspect | Current | Proposed | Change |
|--------|---------|----------|--------|
| Column name | pages | pageCount | ✅ Clarify semantics |
| Type | Int? | Int? | — No change |
| Export usage | Fallback | Fallback | — No change |
| Mapper | Same | Same | — No change |

### Edition.publishDate

| Aspect | Current | Proposed | Change |
|--------|---------|----------|--------|
| Type | DateTime? | String? | ✅ Preserve precision |
| Precision tracking | None | publicationDatePrecision enum | ✅ Add metadata |
| Parser input | "D.L. 2009" | "D.L. 2009" | — No change |
| Parser output | "2009" (string) | "2009" (string) | — No change |
| Import storage | DateTime(2022-01-01) | "2022" + YEAR | ✅ Preserve intent |
| Export 210$d | "2022-01-01" (WRONG) | "2022" (CORRECT) | ✅ Fix semantics |

---

**End of Design Decision Document**
