# Plan: Unified Codename JSONB Across The Platform

> **Date**: 2026-03-23
> **Mode**: PLAN
> **Status**: IMPLEMENTED AND VALIDATED ON 2026-03-24
> **Complexity**: Level 4 (Cross-package architecture change)
> **Scope**: metahubs design-time entities, metahub child entities, admin roles, runtime application metadata, publication snapshots, frontend authoring flows, tests, README files, and GitBook docs

---

## Overview

The repository currently uses three incompatible codename contracts:

1. metahub root entities and branches store `codename VARCHAR` plus `codename_localized JSONB`
2. child entities often store plain `codename` plus localized codename inside `presentation.codename`
3. admin roles and runtime metadata still use plain string `codename`

The target architecture is to replace all of those variants with one canonical field only:

- `codename JSONB NOT NULL`
- shape: the existing `VersionedLocalizedContent<string>` / VLC structure already used elsewhere in the platform
- no `codename_localized`
- no string-only `codename`
- no legacy compatibility branch
- fresh test database recreation is acceptable
- no metahub template-version bump

The canonical semantic rule for v1 of this redesign is:

- `codename` always stores the full localized JSON object
- the `codename._primary` locale content is the canonical machine identifier used for routing, sorting, uniqueness, joins, and lookups
- non-primary locales are localized codename variants kept inside the same JSON document

This keeps the data model uniform without introducing a second persisted codename field.

## Implementation Note

The codebase has already landed the canonical single-field JSONB codename contract across shared types/helpers, fixed admin/metahubs schemas, runtime metadata, touched backend routes/services, and the touched frontend authoring flows. The original checklist below is preserved as planning history; active execution/validation tracking moved to `memory-bank/tasks.md` and durable outcomes moved to `memory-bank/progress.md`.

The 2026-03-24 QA remediation closed the remaining gaps that mattered for live rollout and contract consistency:

- already-deployed fixed schemas now have dedicated versioned upgrade migration IDs instead of relying on edits to already-applied bootstrap definitions
- backend uniqueness and frontend duplicate warnings are aligned on canonical primary codename comparison
- codename sanitization now applies to every locale entry in the VLC payload, not only to `_primary`

---

## Additional Findings From The Extra Analysis

### Verified Repository Reality

1. The currently checked-out codebase still preserves the now-rejected dual-field contract in persistence, routes, snapshots, frontend hooks, and Memory Bank architecture notes.
2. `packages/schema-ddl/base/src/SchemaGenerator.ts` still defines `_app_objects.codename` and `_app_attributes.codename` as `VARCHAR(100)` with string-only unique indexes.
3. `packages/applications-backend/base/src/routes/applicationsRoutes.ts`, `applicationSyncRoutes.ts`, and `applicationWorkspaces.ts` still order and filter by plain `codename` text.
4. `packages/metahubs-frontend/base/src/components/useCodenameDuplicateCheck.ts` still treats plain codename and localized codename as separate sources and flattens both into one duplicate set.
5. `packages/universo-template-mui/base/src/hooks/useCodenameVlcSync.ts` exists only because the current UI edits two codename representations at once.
6. `packages/metahubs-frontend/base/src/domains/settings/hooks/useCodenameConfig.ts` still exposes `general.codenameLocalizedEnabled`, which becomes obsolete once codename is always JSONB.
7. `packages/metahubs-backend/base/src/domains/publications/services/SnapshotSerializer.ts` still serializes localized codename through `presentation.codename` instead of a unified `codename` field.
8. Root docs and GitBook pages still describe system-app/schema flows using the current mixed codename contracts.

### External Evidence

1. PostgreSQL JSONB is suitable for this design, but uniqueness and fast ordering should rely on expression indexes over extracted scalar text, not on whole-document equality semantics.
2. Official PostgreSQL indexing guidance supports immutable expression indexes and unique indexes on derived text expressions.
3. Live Supabase `UP-test` inspection confirmed the repository still runs the mixed architecture in the real database: metahubs tables have dual codename columns, admin roles remain string-only, and runtime metadata remains string-only.
4. The existing VLC structure already matches the desired single-column JSONB representation, so the safest path is to standardize on the existing `VersionedLocalizedContent<string>` contract rather than inventing a second JSON schema.

---

## Canonical Target Contract

### Canonical Type

Use one shared type everywhere:

```ts
import type { VersionedLocalizedContent } from '@universo/types'

export type CodenameContent = VersionedLocalizedContent<string>
```

### Canonical JSON Shape

```json
{
  "_schema": "1",
  "_primary": "en",
  "locales": {
    "en": {
      "content": "productCatalog",
      "version": 1,
      "isActive": true,
      "createdAt": "2026-03-23T10:00:00.000Z",
      "updatedAt": "2026-03-23T10:00:00.000Z"
    },
    "ru": {
      "content": "katalogProduktov",
      "version": 1,
      "isActive": true,
      "createdAt": "2026-03-23T10:00:00.000Z",
      "updatedAt": "2026-03-23T10:00:00.000Z"
    }
  }
}
```

### Canonical Behavioral Rules

1. The primary locale entry must always exist and be non-empty.
2. The resolved primary content is the only value used as the canonical machine identifier for URLs and SQL uniqueness.
3. Every locale content must still pass codename sanitization/format rules.
4. New code must never write codename variants into `presentation.codename` or `codename_localized`.
5. New code must never accept raw string codename payloads at API boundaries.

### Canonical SQL Helper Strategy

Prefer one shared immutable SQL helper for extracting the primary text value from the JSONB document.

```sql
CREATE OR REPLACE FUNCTION upl_codename_primary_text(value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    btrim(jsonb_extract_path_text(value, 'locales', value->>'_primary', 'content')),
    ''
  )
$$;
```

Then build indexes on the derived text expression instead of storing a second machine field:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS cat_roles_codename_primary_unique
ON admin.cat_roles (lower(upl_codename_primary_text(codename)))
WHERE _upl_deleted = false;
```

This is the recommended performance/safety pattern for the migration because it keeps one persisted codename field while still giving deterministic lookup and uniqueness behavior.

---

## Non-Goals

- Preserve backward compatibility for the dual-field contract
- Add a temporary dual-write period
- Keep `general.codenameLocalizedEnabled` as a supported runtime feature flag
- Bump metahub template versions just for codename storage
- Introduce a second persisted “machine codename” mirror column

---

## Affected Areas

| Area | Packages / Surfaces | Planned Change |
| --- | --- | --- |
| Shared types and validation | `packages/universo-types`, `packages/universo-utils` | Make JSONB codename the only accepted shared contract and expose reusable extraction / validation / normalization helpers |
| Metahub system definitions | `packages/metahubs-backend/base/src/platform/systemAppDefinition.ts` and support SQL migrations | Replace dual-field metahub codename schema with one JSON field |
| Admin roles system definitions | `packages/admin-backend/base/src/platform/systemAppDefinition.ts` | Replace string role codename with JSON field |
| Metahub persistence + routes | `packages/metahubs-backend/base/src/persistence`, `domains/*/routes`, services | Read/write only JSON codename and remove `codename_localized` branching |
| Runtime metadata | `packages/schema-ddl`, `packages/applications-backend` | Convert `_app_objects` and `_app_attributes` codename to JSONB and refactor sort/lookup/index logic |
| Publications | `packages/metahubs-backend/base/src/domains/publications/services` | Serialize one codename field end-to-end |
| Frontend authoring | `packages/metahubs-frontend`, `packages/admin-frontend`, `packages/universo-template-mui` | Remove dual-representation UI logic and edit one VLC codename object |
| Published apps | `packages/apps-template-mui` | Verify published runtime consumers use the resolved primary codename contract |
| Documentation | root `README*`, package `README*`, `docs/en`, `docs/ru` | Update architecture and operational docs for the new single-field contract |
| Tests | backend/frontend/shared packages | Add unit, integration, snapshot, schema, and regression coverage |

---

## Plan Steps

### Phase 1: Freeze The Architecture Contract

- [ ] Document the approved codename contract as `VersionedLocalizedContent<string>` everywhere and explicitly retire the dual-field design.
- [ ] Define one shared naming vocabulary in the plan and follow-up implementation docs:
  - `codename`: JSONB/VLC document
  - `primary codename`: extracted canonical machine identifier from `_primary`
  - `localized codename variants`: non-primary locale entries stored inside the same JSON document
- [ ] Confirm the v1 uniqueness rule: database-level uniqueness is enforced on the extracted primary codename only.
- [ ] Confirm the v1 route contract: routing and joins use the extracted primary codename only.
- [ ] Confirm the v1 API contract: incoming/outgoing DTOs use one `codename` object, not string + localized split.

### Phase 2: Introduce Shared Codename Primitives

- [ ] In `packages/universo-types`, add a dedicated codename alias/type and Zod schema built on top of the existing VLC schema instead of ad hoc string/JSON unions.
- [ ] In `packages/universo-utils`, add one shared helper set for:
  - extracting the primary codename string
  - validating the primary locale presence
  - sanitizing all locale values under the configured codename policy
  - comparing candidate primary codenames case-insensitively
- [ ] Replace duplicated per-domain codename parsing with these shared helpers.
- [ ] Keep helper exports package-local and browser-safe where relevant.

Example target validator shape:

```ts
export const CodenameContentSchema = LocalizedStringSchema.superRefine((value, ctx) => {
  const primaryLocale = value._primary
  const primaryEntry = value.locales[primaryLocale]

  if (!primaryEntry?.content?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Primary codename locale must be present' })
  }
})
```

### Phase 3: Replace Design-Time Persistence Contracts

- [ ] Update metahubs fixed-system-app definitions so root entities and branches use one `codename JSON` attribute and no longer define `codename_localized`.
- [ ] Update admin fixed-system-app definitions so roles also use one `codename JSON` attribute.
- [ ] Replace support SQL migrations that still create `codename VARCHAR` or `codename_localized JSONB` in fixed schemas.
- [ ] Add PostgreSQL helper functions and expression indexes for primary-codename extraction/uniqueness in fixed schemas.
- [ ] Remove any stale DDL comments, seeds, and tests that still assume string codename or dual fields.

### Phase 4: Replace Runtime Metadata Contracts

- [ ] In `packages/schema-ddl`, change `_app_objects.codename` and `_app_attributes.codename` from `VARCHAR` to `JSONB`.
- [ ] Replace string-only unique indexes with expression indexes over the extracted primary codename.
- [ ] Replace string-based ordering helpers with safe ordering on `upl_codename_primary_text(codename)`.
- [ ] Rework runtime DDL generation so all new metadata tables start with the JSONB contract on a fresh database.
- [ ] Rebuild tests proving metadata generation, sync SQL, and uniqueness indexes all use the extracted primary codename.

Example target index pattern:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_objects_kind_primary_codename_active
ON "${schemaName}"._app_objects (kind, lower(upl_codename_primary_text(codename)))
WHERE _app_deleted = false;
```

### Phase 5: Refactor Backend Read/Write Paths

- [ ] Update stores in metahubs and admin packages to select, insert, update, and map only JSON `codename` values.
- [ ] Remove `codenameLocalized`, `codename_localized`, and `presentation.codename` codename transport paths from DTOs and row mappers.
- [ ] Refactor duplicate-check queries to use extracted primary codename at SQL level.
- [ ] Keep optional alias-level duplicate detection in service validation for non-primary locales until the product explicitly decides otherwise.
- [ ] Replace ad hoc raw SQL fragments with shared helpers or shared SQL constants where repetition becomes risky.

Example store query target:

```ts
const sql = `
  SELECT
    id,
    codename,
    upl_codename_primary_text(codename) AS primary_codename,
    name
  FROM admin.cat_roles
  WHERE lower(upl_codename_primary_text(codename)) = lower($1)
    AND _upl_deleted = false
`
```

### Phase 6: Refactor Publication And Snapshot Contracts

- [ ] Change snapshot serializers/deserializers so `codename` is serialized once as JSON and never mirrored into `presentation.codename`.
- [ ] Update publication normalization/hash paths so codename normalization is deterministic and consistent across authoring and runtime sync.
- [ ] Update release-bundle and runtime-sync payload contracts if they still flatten codename to string anywhere.
- [ ] Add snapshot regression fixtures covering metahub root entities, child entities, admin roles, and runtime metadata.

### Phase 7: Simplify Frontend Authoring Flows

- [ ] Remove `useCodenameVlcSync` from codename editing flows because there will be only one codename value source.
- [ ] Remove the `general.codenameLocalizedEnabled` platform/metahub setting from backend contracts, admin settings UI, and metahub settings hooks.
- [ ] Refactor codename form components so they edit one VLC object directly.
- [ ] Keep the UX inside `packages/universo-template-mui` patterns instead of inventing a parallel form system.
- [ ] Update all touched labels, helper texts, warnings, and validation strings through package-local i18n resources.
- [ ] Where touched frontend data fetching already uses TanStack Query, follow current repository direction: explicit query keys, explicit invalidation, no ad hoc local duplicate state caches.

Example component-state target:

```ts
const [codename, setCodename] = React.useState<VersionedLocalizedContent<string>>(
  createLocalizedContent(currentLocale, '')
)
```

### Phase 8: Align Runtime Consumers And Published Apps

- [ ] Audit `packages/apps-template-mui` and related runtime consumers for assumptions that `codename` is plain text.
- [ ] Ensure runtime table/list sorting, display, and admin links resolve the primary codename from JSONB consistently.
- [ ] Keep published-app package boundaries clean: shared helpers belong in `@universo/types` / `@universo/utils`, not copied into published-app templates.

### Phase 9: Execute The Full Test Strategy

- [ ] Add shared unit tests for codename schema validation, primary extraction, sanitization, and normalization helpers.
- [ ] Add schema-ddl tests for JSONB metadata columns and expression indexes.
- [ ] Add metahubs/admin persistence tests for JSON codename read/write and primary-codename lookup.
- [ ] Add route/service tests for create, update, copy, duplicate handling, sorting, and filtering across the new contract.
- [ ] Add snapshot tests proving publication serialization/deserialization no longer depends on `presentation.codename`.
- [ ] Add frontend hook/component tests proving one-field codename editing, validation, and duplicate warnings.
- [ ] Add focused application runtime tests proving `_app_objects` and `_app_attributes` JSON codenames still support sync/order/lookups.
- [ ] Re-run touched package lint/tests/builds, then finish with root `pnpm build` from the repository root.

### Phase 10: Update Documentation

- [ ] Update root `README.md` and `README-RU.md` with the unified codename JSONB architecture.
- [ ] Update relevant package READMEs in metahubs, admin, applications, schema-ddl, and shared packages where codename contracts are mentioned.
- [ ] Update GitBook docs under `docs/en` first and mirror them to `docs/ru` with matching structure.
- [ ] Specifically revise architecture/guides pages that still describe system-app or migration flows around string codename / `codename_localized`.
- [ ] Remove stale Memory Bank references to the dual-field contract only after implementation is approved and lands.

### Phase 11: Validation And Merge Readiness

- [ ] Validate that no source package still references `codename_localized`, `codenameLocalized`, or codename-in-`presentation` for this domain.
- [ ] Validate that fixed schemas, runtime metadata, snapshots, and frontends all speak the same codename DTO shape.
- [ ] Validate that all new or regenerated identifiers still use existing UUID v7 repository utilities where identifiers are created in touched flows.
- [ ] Validate that no centralized dependency version drift was introduced and that changes respect the root `pnpm-workspace.yaml` package-management model.

---

## Deep Test Strategy

### 1. Shared Contract Tests

- Validate `CodenameContentSchema` for valid/invalid `_primary`, missing locale, blank primary content, and malformed locale entries.
- Validate primary extraction helpers against mixed locale ordering and inactive locales.
- Validate sanitization rules on every locale entry, not only on `_primary`.

### 2. Fixed-Schema / Migration Tests

- Assert metahubs and admin fixed definitions generate `JSONB` codename columns only.
- Assert support SQL contains the helper function and expected expression indexes.
- Assert no fixed schema still contains `codename_localized`.

### 3. Runtime Metadata Tests

- Assert `_app_objects` / `_app_attributes` DDL uses JSONB codename.
- Assert generated indexes use extracted primary codename.
- Assert sync and lookup queries still return stable ordering.

### 4. Backend Persistence And Route Tests

- Metahub create/edit/copy for root entities and child entities.
- Admin role create/edit/copy/list/detail.
- Duplicate detection by extracted primary codename.
- Sorting/filtering by extracted primary codename.
- Snapshot import/export with codename JSON only.

### 5. Frontend Regression Tests

- `CodenameField` edits one JSONB/VLC value only.
- Removing `localizedEnabled` does not break forms, settings screens, or admin settings pages.
- Duplicate warnings still work for the chosen v1 rule.
- Form submission payloads no longer send split codename fields.

### 6. Documentation / Build Validation

- EN/RU doc pairs stay synchronized for touched pages.
- Touched package READMEs build/format consistently.
- Final validation is a root `pnpm build` only after targeted checks pass.

---

## Potential Challenges

1. **Uniqueness scope ambiguity**
   The current UI tries to prevent duplicates across all localized codename variants, but the database can enforce only one deterministic rule cheaply. The plan therefore treats primary-codename uniqueness as the hard database contract and leaves non-primary alias duplication as an explicit service-level decision.

2. **Runtime SQL surface is large**
   Applications runtime code has many `ORDER BY codename` and `WHERE codename = $1` paths. Missing even one of them would create mixed behavior after the migration.

3. **Snapshot compatibility seam**
   `presentation.codename` is currently an interchange seam. Removing it requires synchronized serializer, deserializer, and test-fixture updates.

4. **Frontend settings removal**
   `general.codenameLocalizedEnabled` currently affects both admin settings and metahub UI behavior. Removing it cleanly requires deleting settings UI, DTO plumbing, fallback logic, and i18n keys together.

5. **Memory Bank drift**
   `activeContext.md`, `systemPatterns.md`, and `techContext.md` still encode the old dual-field rule. They should not be treated as architecture truth for this work after approval.

---

## Design Notes

1. Reuse the existing VLC structure instead of inventing a second JSON schema.
2. Prefer shared codename helpers in `@universo/types` and `@universo/utils` rather than per-package utility drift.
3. Keep SQL-first backend patterns: stores/services/routes should continue using explicit SQL and shared quoting helpers where identifiers are dynamic.
4. Avoid introducing a second persisted “machine codename” column. Expression helpers and indexes are the preferred compromise between single-source storage and SQL performance.
5. Frontend changes should stay aligned with `@universo/template-mui` primitives and the ongoing TanStack Query direction instead of bespoke local state/data-fetch abstractions.

---

## Dependencies And Coordination Points

1. `@universo/types` and `@universo/utils` must land first because all other packages depend on the codename contract.
2. Fixed-system-app definitions and schema-ddl runtime metadata changes must stay aligned; otherwise design-time and runtime codename shapes will diverge again.
3. Publication serializer changes must be coordinated with applications runtime sync and release-bundle normalization.
4. Frontend package work depends on backend DTO finalization and the removal of the old settings flag.
5. Docs/README updates depend on the final accepted contract wording and should be done after implementation details stop moving.

---

## Recommended Execution Order

1. Shared types/utils
2. Fixed schema definitions and support SQL
3. Runtime metadata DDL and SQL helpers
4. Backend stores/routes/services
5. Publication/snapshot paths
6. Frontend forms/settings cleanup
7. Tests
8. README and GitBook docs
9. Root build and final grep-based contract audit

---

## Approval Questions

1. Is the proposed v1 hard uniqueness rule correct: database uniqueness on extracted primary codename only?
2. Do we explicitly remove `general.codenameLocalizedEnabled` now instead of preserving it as a no-op flag?
3. Is the SQL-helper-plus-expression-index approach acceptable as the main performance strategy for JSONB codename lookups?

---

## Success Criteria

- No package persists or transports `codename_localized`
- No touched domain persists codename as raw string
- Fixed schemas and runtime metadata both use `codename JSONB`
- Snapshots and release/runtime sync use one codename representation only
- Frontends edit one codename object only
- Docs and Memory Bank no longer describe the dual-field contract as the desired end state
