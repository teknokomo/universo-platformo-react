# Metahubs QA Closure: i18n, Resources, Fixtures, E2E, Docs

## Context

After the entity-first migration (replacing old hardcoded Hubs/Catalogs/Sets/Enumerations with entity-based presets), five critical issues remain:
1. **i18n broken**: raw keys like `records.title` visible in UI; ~25 untranslated English strings in RU locale
2. **Resources section**: tab names confusing ("Поля" vs expected "Определения полей"); shared pool should be configurable per entity type
3. **Fixtures broken**: self-hosted fixture gives "hash mismatch" on import; quiz fixture outdated (snapshotFormatVersion 1 vs current 3)
4. **Documentation outdated**: RU docs have untranslated English terms; screenshots outdated
5. **No end-to-end validation**: full metahub lifecycle never tested after entity-first migration

All changes recorded in `memory-bank/` per `.gemini/rules/memory-bank.md` rules.

---

## Phase A: Fix Critical i18n Issues (UI-blocking)

### A.1: Add missing `records.*` i18n section
`RecordList.tsx` and `InlineTableEditor.tsx` reference ~40 keys under `records.*` namespace that don't exist in either locale file. This causes `records.title` to show as raw text in Catalog tabs (confirmed by user's screenshot).

**Files**:
- [en/metahubs.json](packages/metahubs-frontend/base/src/i18n/locales/en/metahubs.json) — add `"records"` top-level section
- [ru/metahubs.json](packages/metahubs-frontend/base/src/i18n/locales/ru/metahubs.json) — add matching Russian translations

### A.2: Add missing `tabs.treeEntities` keys (9 components)
Components in [presets/ui/](packages/metahubs-frontend/base/src/domains/entities/presets/ui/) reference `hubs.tabs.treeEntities`, `catalogs.tabs.treeEntities`, `sets.tabs.treeEntities`, `enumerations.tabs.treeEntities` but these keys don't exist. Fallback shows raw `'TreeEntities'` or Russian `'Хабы'`.

**Files**: Same two locale files — add `"treeEntities"` key to each entity type's `tabs` section.

### A.3: Translate ~25 English strings in RU locale
Untranslated strings in `deleteDialog` sections for hubs, catalogs, sets, enumerations, fixedValues. Systematic replacement of all English fragments:
- `"Удалить hub"` → `"Удалить хаб"`, `"Set удалён"` → `"Набор удалён"`, etc.

**File**: [ru/metahubs.json](packages/metahubs-frontend/base/src/i18n/locales/ru/metahubs.json)

### A.4: Fix mixed pluralization in RU sets section
Keys `constantsCount_few` / `constantsCount_many` should be `fixedValuesCount_few` / `fixedValuesCount_many`.

**File**: [ru/metahubs.json](packages/metahubs-frontend/base/src/i18n/locales/ru/metahubs.json) under `sets` section

### A.5: Fix EN/RU key asymmetry
- Add `optionValues.copy.generalHint` to EN (exists only in RU)
- Align `branches.copy.options.copyTreeEntities` naming between EN/RU

### Verification
- `pnpm --filter @universo/metahubs-frontend build`
- Focused Vitest for RecordList, i18n, entity preset tests
- Playwright screenshot of Catalogs section to verify `records.title` is fixed

---

## Phase B: Fix Resources Section + Dynamic Shared Pool

### Architecture Decision (QA finding)

**No new interfaces or fields needed.** The existing `ComponentManifest` already controls shared pool participation:
- Entity types with `dataSchema: { enabled: true }` → participate in shared field definitions pool
- Entity types with `fixedValues: { enabled: true }` → participate in shared fixed values pool
- Entity types with `optionValues: { enabled: true }` → participate in shared option values pool

Current shared pool mapping is hardcoded in [shared.ts](packages/universo-types/base/src/common/shared.ts) (`SHARED_POOL_TO_TARGET_KIND`). The Resources section tabs are static in [SharedResourcesPage.tsx](packages/metahubs-frontend/base/src/domains/entities/shared/ui/SharedResourcesPage.tsx).

**Approach**: Make Resources section tabs dynamic by reading entity type definitions from the metahub. If any entity type has the relevant component enabled, show the corresponding tab. This makes the shared pool system work for future custom entity types too — without adding new fields.

### B.1: Update RU tab labels
Current RU labels are abbreviated/unclear:
- `"Поля"` → `"Определения полей"` (Field definitions)
- `"Списки значений"` → `"Значения перечислений"` (Enumeration values)
- `"Фиксированные значения"` stays (already correct)

**File**: [ru/metahubs.json](packages/metahubs-frontend/base/src/i18n/locales/ru/metahubs.json) — `general.tabs` section

### B.2: Make Resources tabs dynamic
Instead of hardcoded 5 tabs, dynamically render based on entity type definitions:

**Existing components to reuse** (NO new components):
- MUI `Tabs`/`Tab` — already used in SharedResourcesPage.tsx (lines 91-102)
- `useSharedContainerIds` hook — already exists
- `FieldDefinitionListContent`, `FixedValueListContent`, `SelectableOptionListContent`, `LayoutListContent`, `EntityScriptsTab` — all existing
- `ViewHeader` from `@universo/template-mui` — already used

**What changes**:
- Add a hook/query to fetch entity type definitions for the current metahub
- Filter tabs: show "Field definitions" only if any entity type has `dataSchema.enabled`; show "Fixed values" only if `fixedValues.enabled`; show "Option values" only if `optionValues.enabled`
- Layouts and Scripts tabs always show (they're not tied to entity types)

**Files to modify**:
- [SharedResourcesPage.tsx](packages/metahubs-frontend/base/src/domains/entities/shared/ui/SharedResourcesPage.tsx) — dynamic tab rendering
- No new components needed

### B.3: Update empty state descriptions
The empty state text should reference that these are **shared** across all instances of the entity type.

**File**: i18n keys under `general.shared.*` in both locale files

### Verification
- Playwright screenshot of Resources section with corrected tab labels
- Verify dynamic tab rendering (if no entity types have `fixedValues.enabled`, "Fixed values" tab should not appear)
- `pnpm build`

---

## Phase C: Regenerate Fixtures via Playwright

### C.1: Regenerate self-hosted app fixture
Hash mismatch occurs because `normalizePublicationSnapshotForHash` evolved after the fixture was generated.

```bash
npx playwright test tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts --project=generators
```

The generator creates metahub via API → seeds 11 sections → creates publication + app → exports snapshot → validates hash + contract → writes fixture.

### C.2: Regenerate quiz app fixture
Quiz fixture is outdated (April 6, snapshotFormatVersion 1 vs current 3). May need endpoint updates.

```bash
npx playwright test tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts --project=generators
```

**Potentially modified files**:
- [metahubs-quiz-app-export.spec.ts](tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts) — if legacy endpoints found

### C.3: Validate both fixtures via import flow
```bash
npx playwright test tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts
```

### Verification
- Both fixtures import without hash mismatch
- Quiz runtime test passes: `snapshot-import-quiz-runtime.spec.ts`
- Contract assertions pass for both fixtures

---

## Phase D: Full Cycle E2E Testing

### D.1: Write comprehensive full-cycle Playwright spec
Create `tools/testing/e2e/specs/flows/metahub-full-cycle.spec.ts` testing:

1. **Create metahub** from "Basic" template
2. **Add Hubs** — create tree entities, verify sidebar
3. **Add Catalogs** — create linked collections, add field definitions (string, number, boolean, reference), add records
4. **Add Sets** — create value groups, add fixed values
5. **Add Enumerations** — create option lists, add option values (set default)
6. **Hub connections** — link catalog to hub, verify hierarchy
7. **Shared Resources** — verify tab labels (from Phase B), add shared field definitions, verify inheritance in catalogs
8. **Publish** — create publication, sync schema, create version
9. **Create Application** — create app with connector
10. **Runtime verification** — navigate to app, verify menus and data rendering

**Reuse existing patterns from**:
- [metahubs-self-hosted-app-export.spec.ts](tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts) (API patterns)
- [metahub-domain-entities.spec.ts](tools/testing/e2e/specs/flows/metahub-domain-entities.spec.ts) (flow patterns)
- [api-session.mjs](tools/testing/e2e/support/backend/api-session.mjs) (API helpers)

### D.2: Screenshot validation at each step
Capture screenshots at each major step. **Do not invent UI state** — verify visually via screenshots.

### D.3: Run existing Playwright flows
Verify all existing flows still pass:
- `metahub-domain-entities.spec.ts`
- `snapshot-export-import.spec.ts`
- `snapshot-import-quiz-runtime.spec.ts`
- `metahub-settings.spec.ts`
- `codename-mode.spec.ts`

### Verification
- All Playwright specs pass on port 3100
- Screenshots reviewed for visual correctness

---

## Phase E: Documentation Update

### E.1: Translate English terms in RU docs
Fix untranslated English in:
- [shared-field-definitions.md](docs/ru/platform/metahubs/shared-field-definitions.md)
- [shared-fixed-values.md](docs/ru/platform/metahubs/shared-fixed-values.md)
- [shared-option-values.md](docs/ru/platform/metahubs/shared-option-values.md)
- Other `docs/ru/platform/metahubs/*.md` files as needed

### E.2: Capture new screenshots via Playwright
Use Playwright on port 3100 to capture:
- Entity type sections (Hubs, Catalogs, Sets, Enumerations)
- Resources section with corrected tab labels
- Full cycle flow screenshots
- Both EN and RU versions

### E.3: Rewrite docs to reflect entity-first architecture
Update both EN and RU docs to:
- Use current terminology (Hubs/Catalogs/Sets/Enumerations as entity presets)
- Reference current UI labels (from Phase A/B)
- Remove residual outdated descriptions

### Verification
- Review all updated docs for accuracy
- Verify EN/RU parity

---

## Phase F: Memory-Bank Update + Final Validation

### F.1: Update `activeContext.md`
Set current focus to completed 5-issue QA closure.

### F.2: Update `tasks.md`
Mark all tasks completed, add discovered follow-ups, remove stale items.

### F.3: Update `progress.md`
Add dated entry (2026-04-17) with session outcomes.

### F.4: Update `systemPatterns.md`
Document dynamic shared pool tab rendering pattern, i18n key structure for shared resources.

### F.5: Update `techContext.md`
Note current snapshot format version (3), fixture regeneration process.

### F.6: Final full workspace validation
```bash
pnpm build     # 30/30 packages
pnpm lint      # Zero errors
pnpm test      # All unit tests
npx playwright test  # All E2E tests on port 3100
```

---

## Dependency Graph

```
Phase A (i18n) ──→ Phase B (Resources + dynamic tabs) ──→ Phase E (Docs)
       │                       │
       │                       ↓
       └──────→ Phase C (Fixtures regeneration) ──→ Phase D (E2E full cycle)
                                                          │
                                                          ↓
                                                   Phase F (Memory bank)
```

## Key Files Summary

| Area | Files |
|------|-------|
| i18n EN | [en/metahubs.json](packages/metahubs-frontend/base/src/i18n/locales/en/metahubs.json) |
| i18n RU | [ru/metahubs.json](packages/metahubs-frontend/base/src/i18n/locales/ru/metahubs.json) |
| Resources UI | [SharedResourcesPage.tsx](packages/metahubs-frontend/base/src/domains/entities/shared/ui/SharedResourcesPage.tsx) |
| Shared types | [shared.ts](packages/universo-types/base/src/common/shared.ts) |
| ComponentManifest | [entityComponents.ts](packages/universo-types/base/src/common/entityComponents.ts) |
| Entity type defs | [standardEntityTypeDefinitions.ts](packages/metahubs-backend/base/src/domains/templates/data/standardEntityTypeDefinitions.ts) |
| Shared container svc | [SharedContainerService.ts](packages/metahubs-backend/base/src/domains/shared/services/SharedContainerService.ts) |
| Snapshot hash | [publicationSnapshotHash.ts](packages/universo-utils/base/src/serialization/publicationSnapshotHash.ts) |
| Snapshot archive | [snapshotArchive.ts](packages/universo-utils/base/src/snapshot/snapshotArchive.ts) |
| Self-hosted fixture | [metahubs-self-hosted-app-snapshot.json](tools/fixtures/metahubs-self-hosted-app-snapshot.json) |
| Quiz fixture | [metahubs-quiz-app-snapshot.json](tools/fixtures/metahubs-quiz-app-snapshot.json) |
| Self-hosted generator | [metahubs-self-hosted-app-export.spec.ts](tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts) |
| Quiz generator | [metahubs-quiz-app-export.spec.ts](tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts) |
| Docs EN | [docs/en/platform/metahubs/*.md](docs/en/platform/metahubs/), [entity-systems.md](docs/en/architecture/entity-systems.md) |
| Docs RU | [docs/ru/platform/metahubs/*.md](docs/ru/platform/metahubs/), [entity-systems.md](docs/ru/architecture/entity-systems.md) |
| Memory bank | [activeContext.md](memory-bank/activeContext.md), [tasks.md](memory-bank/tasks.md), [progress.md](memory-bank/progress.md) |

## Constraints

- No schema/template version bumps
- No legacy code preservation (test DB recreated)
- Playwright CLI on port 3100 (not `pnpm dev`)
- All text i18n-ready immediately (UUID v7, TanStack Query)
- Shared types → `packages/universo-types`, shared utils → `packages/universo-utils`
- Common UI → `packages/universo-template-mui`, common i18n → `packages/universo-i18n`
- **No new UI components** — reuse existing MUI Tabs/Tab, FieldDefinitionListContent, FixedValueListContent, etc.
- **No new fields in ComponentManifest** — derive shared pool participation from existing `dataSchema`/`fixedValues`/`optionValues` flags

## Architecture QA Notes

### Verified correct patterns:
- Entity system uses strategy/registry pattern (EntityBehaviorService, behaviorRegistry) ✅
- Zod validation for all API inputs ✅
- RBAC with proper role hierarchy ✅
- Parameterized SQL queries (no injection risk) ✅
- TanStack Query with optimistic updates ✅
- SHA-256 snapshot hash with defense-in-depth validation ✅

### No new abstractions needed:
- SharedResourcesPage.tsx already renders tabs correctly — just needs dynamic filtering
- Entity type settings already exist in EntitiesWorkspace.tsx — no new settings page
- Form controls use existing `FormControlLabel` + `Checkbox` pattern
- i18n keys follow established `general.tabs.*` pattern

### Out of scope for MVP (security hardening):
- Rate limiting on authenticated routes
- CORS/CSP headers
- Token refresh mechanism
- These are infrastructure concerns, not blocking the 5 reported issues
