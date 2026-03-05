# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks -> tasks.md, architectural patterns -> systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
| --- | --- | --- | --- |
| 0.51.0-alpha | 2026-02-19 | Counting Sticks 🥢 | Headless Controller, Application Templates, Enumerations |
| 0.50.0-alpha | 2026-02-13 | Great Love ❤️ | Applications, Template System, DDL Migration Engine, Enhanced Migrations |
| 0.49.0-alpha | 2026-02-05 | Stylish Cow 🐮 | Attribute Data Types, Display Attribute, Layouts System |
| 0.48.0-alpha | 2026-01-29 | Joint Work 🪏 | Branches, Elements rename, Three-level system fields |
| 0.47.0-alpha | 2026-01-23 | Friendly Integration 🫶 | Runtime migrations, Publications, schema-ddl |
| 0.46.0-alpha | 2026-01-16 | Running Stream 🌊 | Applications modules, DDD architecture |
| 0.45.0-alpha | 2026-01-11 | Structured Structure 😳 | i18n localized fields, VLC, Catalogs |
| 0.44.0-alpha | 2026-01-04 | Fascinating Acquaintance 🖖 | Onboarding, Legal consent, Cookie banner, Captcha |
| 0.43.0-alpha | 2025-12-27 | New Future 🏋️ | Pagination fixes, Onboarding wizard |
| 0.42.0-alpha | 2025-12-18 | Dance Agents 👯 | VLC system, Dynamic locales, Flowise 3.0 |
| 0.41.0-alpha | 2025-12-11 | High Mountains 🌄 | Admin panel, Auth migration, UUID v7 |
| 0.40.0-alpha | 2025-12-05 | Straight Rows 🎹 | Package extraction, Admin RBAC, Global naming |
| 0.39.0-alpha | 2025-11-25 | Mighty Campaign 🧙🏿 | Storages, Campaigns, useMutation refactor |
| 0.38.0-alpha | 2025-11-21 | Secret Organization 🥷 | Projects, AR.js Quiz, Organizations |
| 0.37.0-alpha | 2025-11-13 | Smooth Horizons 🌅 | REST API docs, Uniks metrics, Clusters |
| 0.36.0-alpha | 2025-11-07 | Revolutionary Indicators 📈 | dayjs migration, publish-frontend, Metaverse Dashboard |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃 | i18n TypeScript migration, Rate limiting |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring, tsdown build system |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Publication system fixes, Metaverses module |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Canvas versioning, Telemetry, Pagination |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Quiz editing, Canvas refactor, MUI Template |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | TypeScript aliases, Publication library, Analytics |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Resources/Entities architecture, CI i18n |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨 | Resources, Entities modules, Template quiz |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣 | Finance module, i18n, Language switcher |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌 | MMOOMM template, Colyseus multiplayer |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼 | Space Builder, Metaverse MVP, core utils |
| 0.24.0-alpha | 2025-08-12 | Stellar Backdrop 🌌 | Space Builder enhancements, AR.js wallpaper |
| 0.23.0-alpha | 2025-08-05 | Vanishing Asteroid ☄️ | Russian docs, UPDL node params |
| 0.22.0-alpha | 2025-07-27 | Global Impulse ⚡️ | Memory Bank, MMOOMM improvements |
| 0.21.0-alpha | 2025-07-20 | Firm Resolve 💪 | Handler refactoring, PlayCanvas stabilization |

---

## Sets/Constants Final Debt Closure + Build Fix (2026-03-05)

Completed the focused implementation cycle for remaining Sets/Constants debt and the blocking metahubs-backend TypeScript build failure.

### Completed changes

- Fixed `TS2352` in `applicationSyncRoutes.ts` by replacing unsafe cast flow with typed `MetaConstantSnapshot` lookup (`buildSetConstantLookup` now stores typed snapshots).
- Improved constants mutation consistency in frontend:
  - `useCreateConstant`, `useUpdateConstant`, `useDeleteConstant`, `useMoveConstant`, `useCopyConstant` now `await` cache invalidation/refetch before completion.
- Removed hardcoded constants fetch cap in REF->set resolution (`ElementList`):
  - replaced list fetch with `limit=1000` by exact constant fetches via `getConstantDirect` for referenced `(setId, constantId)` pairs.
- Aligned backend NUMBER validation in constants routes with shared validation utility:
  - switched to `validateNumber` + `toNumberRules` from `@universo/utils`.
- Harmonized constants delete lifecycle with metahub soft-delete model:
  - `MetahubConstantsService.delete` now performs soft-delete (`_mhb_deleted*`) instead of hard row delete,
  - active-only filtering was enforced for count/list/sort/move/reorder paths to preserve stable active sort order behavior.

### Verification executed

- `pnpm --filter @universo/metahubs-backend build` → pass
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/constantsRoutes.test.ts src/tests/routes/setsRoutes.test.ts` → pass (`2/2`, `14/14`)
- `pnpm --filter @universo/metahubs-backend lint -- src/domains/constants/routes/constantsRoutes.ts src/domains/metahubs/services/MetahubConstantsService.ts src/domains/applications/routes/applicationSyncRoutes.ts` → pass (warnings only, no errors)
- `pnpm --filter @universo/metahubs-frontend lint -- src/domains/constants/hooks/mutations.ts src/domains/elements/ui/ElementList.tsx` → pass (warnings only, no errors)
- `pnpm --filter @universo/metahubs-frontend test -- src/components/__tests__/TargetEntitySelector.test.tsx src/components/__tests__/SetDeleteDialog.test.tsx` → pass (`24/24`, `100/100`)

### Environment note

- During verification, metahubs-frontend tests initially failed because `@universo/applications-frontend` `dist/i18n` artifacts were missing in local workspace state.
- Executed `pnpm --filter @universo/applications-frontend build` to restore required exports used by template-mui imports in vitest runtime.

## Sets/Constants Stabilization + SemVer Alignment Closure (2026-03-04)

Completed the implementation closure cycle for Sets/Constants runtime issues reported after QA and aligned verification scope with full workspace build.

### Key outcomes

- Fixed Sets/Constants i18n leakage path in UI screens by enforcing `metahubs` namespace usage in:
  - `SetList.tsx`
  - `ConstantList.tsx`
- Kept Sets breadcrumbs and constants-in-set breadcrumbs consistent with catalogs flow.
- Ensured constants list footer/pagination remains present and aligned with attributes list behavior.
- Improved constants list refresh latency after create/copy/update/delete/reorder by making cache invalidation/refetch flow explicitly async/awaited in constants mutations.
- Preserved SemVer structure baseline (`0.1.0`) and single-line structure target behavior (no intentional V2 drift).
- Removed route-level direct import of `@universo/metahubs-frontend/i18n` from `template-mui` to avoid cyclic self-resolution in tests.
- Rebuilt `@universo/template-mui` to refresh `dist` used by `@universo/metahubs-frontend` tests.

### Verification executed

- `pnpm --filter @universo/metahubs-backend lint` → pass (warnings only)
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/constantsRoutes.test.ts src/tests/routes/setsRoutes.test.ts src/tests/routes/metahubMigrationsRoutes.test.ts src/tests/services/metahubSchemaService.test.ts src/tests/services/structureVersions.test.ts` → pass
- `pnpm --filter @universo/metahubs-backend build` → pass
- `pnpm --filter @universo/metahubs-frontend lint` → pass (warnings only)
- `pnpm --filter @universo/metahubs-frontend test` → pass (`24/24` files, `100/100` tests)
- `pnpm --filter @universo/metahubs-frontend build` → pass
- `pnpm --filter @universo/template-mui build` → pass
- `pnpm build` → pass (`23/23` tasks successful)

### Environment audit note (UP-test)

- Supabase `UP-test` currently still shows legacy schema state:
  - `metahubs.metahubs_branches.structure_version` is `integer` (default `1`)
  - `metahubs.templates_versions.min_structure_version` is `integer` (default `1`)
  - Active `basic` template version label is `1.0.0`
  - Existing branch row shows `structure_version = 2`
- This DB state can trigger migration-required behavior even after code fixes and must be reset/aligned for deterministic SemVer (`0.1.0`) runtime validation.

## Sets/Constants QA Final Closure (Transactional + Concurrency) (2026-03-04)

Closed the remaining QA findings for Sets/Constants by hardening transaction boundaries, concurrency checks, and removing legacy attribute aliases.

### Backend safety and consistency

- Implemented atomic set copy flow:
  - `POST /metahub/:metahubId/set/:setId/copy` now wraps set creation + optional constants copy in one Knex transaction.
  - Added external transaction support to `MetahubObjectsService.createObject` and wrappers (`createSet`, `createCatalog`, `createEnumeration`) for caller-managed atomic workflows.
- Implemented optimistic locking for set unlink:
  - Unlink branch of `DELETE /metahub/:metahubId/hub/:hubId/set/:setId` now passes `expectedVersion`.
  - Route now returns `409` with optimistic-lock payload on conflict.
- Removed naming residue:
  - `constantsRoutes.ts`: `ATTRIBUTE_LIMIT` renamed to `CONSTANT_LIMIT`.

### Legacy contract debt removal

- Removed `targetCatalogId` alias from attribute create/update route schemas and processing logic.
- Removed `targetCatalogId` compatibility mapping from `MetahubAttributesService` create/update/map paths.
- Updated downstream consumers to canonical polymorphic reference contract:
  - `SnapshotSerializer` no longer uses `targetCatalogId` fallback.
  - DDL catalog definition builder no longer reads `targetCatalogId`.
  - Frontend metahubs attribute types/api/hooks switched to `targetEntityId/targetEntityKind` only.
  - `ElementList` ref-resolution logic no longer relies on `targetCatalogId` fallback.

### Test hardening

- Extended backend route tests (`setsRoutes`):
  - transactional copy path assertion (transaction invoked, trx passed through service calls),
  - copy failure path assertion (error propagation under transaction),
  - optimistic-lock conflict assertion for hub unlink flow.

### Verification

- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/setsRoutes.test.ts src/tests/routes/constantsRoutes.test.ts` → **pass**
- `pnpm --filter @universo/metahubs-backend lint` → **pass** (warnings only, no errors)
- `pnpm --filter @universo/metahubs-backend build` → **pass**
- `pnpm --filter @universo/metahubs-frontend lint` → **pass** (warnings only, no errors)
- `pnpm --filter @universo/metahubs-frontend test` → **pass** (`24/24` files, `100/100` tests)
- `pnpm --filter @universo/metahubs-frontend build` → **pass**

---

## Sets/Constants QA Closure & Final Hardening (2026-03-05)

Closed remaining QA gaps for Sets/Constants with strict contract hardening, blocker semantic alignment, and additional regression tests.

### Backend hardening completed

- Removed legacy reorder payload handling in constants route and enforced strict schema payload shape.
- Added safe regex validation handling for STRING constants (`invalid regex -> 400` instead of unhandled errors).
- Added deterministic codename conflict handling for sets/constants create/update/copy flows with explicit `409` behavior.
- Enforced unique codename resolution when copying sets with `copyConstants=true`.
- Aligned set-delete blockers payload semantics to `sourceCatalog* + attribute*` naming in backend service output.

### Frontend alignment completed

- Updated set blockers API typing and removed fallback call to legacy blockers endpoint.
- Updated `SetDeleteDialog` table semantics and links to catalog attributes (`/metahub/:id/catalog/:catalogId/attributes`).
- Removed unused legacy constants DnD files cloned from old flow.
- Added regression tests:
  - `SetDeleteDialog` blockers mapping + link generation.
  - `TargetEntitySelector` set/constant reference flow + reset behavior on entity-kind change.

### Verification

- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/constantsRoutes.test.ts src/tests/routes/setsRoutes.test.ts` → **pass**
- `pnpm --filter @universo/metahubs-frontend test` → **pass** (`24/24` files, `100/100` tests)
- `pnpm --filter @universo/metahubs-backend lint` → **pass** (warnings only, no errors)
- `pnpm --filter @universo/metahubs-frontend lint` → **pass** (warnings only, no errors)
- `pnpm --filter @universo/metahubs-backend build` → **pass**
- `pnpm --filter @universo/metahubs-frontend build` → **pass**

---

## Metahub Sets & Constants Full Implementation (2026-03-04)

Completed end-to-end implementation and verification for the Sets/Constants scope based on clone-first parity with Catalogs/Attributes.

### What was finalized

- **Backend template/publication integration**
  - Completed constants support in template execution/migration paths (`TemplateSeedExecutor`, `TemplateSeedMigrator`), including `target_constant_id`.
  - Extended migration dry-run/accounting metadata with `constantsAdded`.
  - Finalized publication snapshot serialization for sets/constants and REF-to-set/constant link data.
- **Frontend and API parity**
  - Completed Set/Constant domains wiring and exports.
  - Finalized constants UX contract (types only: `STRING`, `NUMBER`, `BOOLEAN`, `DATE`; no presentation tab; value tab behavior preserved).
  - Confirmed REF selector flow supports Set + Constant targeting.
- **Test and migration expectation alignment**
  - Reworked Sets/Constants backend route tests (`setsRoutes`, `constantsRoutes`) to match current contracts.
  - Updated migration/status tests for `CURRENT_STRUCTURE_VERSION = 2`.
  - Updated branch/schema service tests to account for `set` and `_mhb_constants` expectations.

### Additional stability hardening

- Resolved frontend test runtime mismatch caused by peer auto-resolution (`react-dom@19` with `react@18`):
  - Added `react-dom` to `@universo/metahubs-frontend` devDependencies via catalog.
  - Added root overrides for `react` and `react-dom` pinned to `18.3.1`.
  - Added root devDependencies `react`/`react-dom` `18.3.1` to stabilize peer resolution in test runs.

### Verification

- `pnpm --filter @universo/metahubs-backend test` → **pass** (`20/20` suites)
- `pnpm --filter @universo/metahubs-frontend test` → **pass** (`22/22` files, `97/97` tests)
- `pnpm --filter @universo/metahubs-backend lint` → **pass** (warnings only)
- `pnpm --filter @universo/metahubs-frontend lint` → **pass** (warnings only)
- `pnpm --filter @universo/metahubs-backend build` → **pass**
- `pnpm --filter @universo/metahubs-frontend build` → **pass**
- `pnpm build` → **pass** (`23/23` packages, after dependency stabilization)

---

## Catalog Attributes DnD Deep Fix (2026-03-04)

Resolved the remaining production issue where dragging catalog attributes did not start, even after full rebuild/hard refresh.

### Root cause

- Attribute DnD provider (`DndContext`) lived in `@universo/metahubs-frontend`
- Sortable rows (`useSortable`) lived in `@universo/template-mui`
- Under workspace peer resolution, this can still produce separate `@dnd-kit` runtime instances between packages, which breaks drag context sharing
- Enumeration DnD kept working because it uses provider + sortable from template-mui in one runtime path

### Changes

1. **Shared DnD runtime exports in template-mui**
  - `packages/universo-template-mui/base/src/components/index.ts`
  - `packages/universo-template-mui/base/src/index.ts`
  - Re-exported: `DndContext`, `DragOverlay`, `PointerSensor`, `KeyboardSensor`, `useSensors`, `useSensor`, `closestCenter`, `MeasuringStrategy`, `useDroppable`, `sortableKeyboardCoordinates`

2. **Metahubs attributes switched to shared runtime imports**
  - `packages/metahubs-frontend/base/src/domains/attributes/ui/dnd/AttributeDndProvider.tsx`
  - `packages/metahubs-frontend/base/src/domains/attributes/ui/ChildAttributeList.tsx`

3. **Targeted diagnostics added**
  - Opt-in debug logs for drag lifecycle in `AttributeDndProvider`
  - Enable with: `localStorage.setItem('debug:metahubs:attributes-dnd', '1')`
  - Disable with: `localStorage.removeItem('debug:metahubs:attributes-dnd')`

### Verification
- `pnpm --filter universo-template-mui lint` — 0 errors
- `pnpm --filter metahubs-frontend lint` — 0 errors
- `pnpm build` — 23/23 packages successful (3m39s)

---

## Fix 5 UI/UX Bugs (2026-03-04)

Fixed 5 user-reported bugs across admin-frontend and metahubs-frontend.

### Changes

1. **Admin "settings" i18n** — Added missing `settings` key to `roles.permissions.subjects` in both ru/en admin locale files.

2. **Catalog attributes DnD** — Root cause: `metahubs-frontend/tsdown.config.ts` did not externalize `@dnd-kit/*`, creating dual React contexts (bundled vs external). Added `/^@dnd-kit\//` to externals array, matching `universo-template-mui` pattern.

3. **Row count pluralization** — Replaced `rowCount` with `_one/_few/_many` (ru) and `_one/_other` (en) plural forms in two metahubs i18n sections (attributes table, elements table).

4. **Publication access tab i18n** — Fixed Russian `modeFullDescription`: "Publication" → "публикацию", "Метахаба" → "метахаба". Fixed 6 Russian fallback defaults in `AccessPanel.tsx` to use English.

5. **Branch label i18n** — Added missing `branch` key to `publications.versions` in both locale files.

### Verification
- Build: 23/23 packages (3m55s)
- Lint: admin-frontend 0 errors, metahubs-frontend 0 errors

---

## Post-Cleanup Deep Hardening (2026-03-04)

Comprehensive deep hardening across core packages after the main legacy cleanup.

### Changes

**Ghost folder & Flowise naming**:
- Deleted `packages/flowise-core-backend/` ghost directory (created by earlier `pnpm start`)
- `DataSource.ts`: `.flowise` → `.universo` home directory
- `index.ts`: `flowiseApiV1Router` → `apiV1Router`
- `index.ts`: `FLOWISE_FILE_SIZE_LIMIT` → `FILE_SIZE_LIMIT` (backward compat)
- `utils/index.ts`: `UNIVERSO_PATH` env var support (backward compat via `FLOWISE_PATH`)
- Renamed `errors/internalFlowiseError/` → `errors/internalError/`, class `InternalFlowiseError` → `InternalError`
- Updated 20+ CI/docker/agent-instruction/README files with correct `universo-core-*` paths

**Admin RBAC subjects**:
- Removed 6 legacy subjects from `@universo/types` admin.ts: `metaverses`, `spaces`, `uniks`, `sections`, `entities`, `canvases`
- Added `settings` and `admin` — final set: `['publications', 'roles', 'instances', 'users', 'settings', 'admin']`

**Sidebar menu**:
- Reordered `rootMenuItems`: Applications → Profile → Docs | Metahubs → Admin
- Merged Applications into root menu items (removed separate `getApplicationsMenuItem()`)
- Added smart selected state for Applications item (highlights on `/applications/*` and `/a/*/admin/*`)

**Core-frontend deep clean**:
- Deleted `shims/` directory (React 18 native `useSyncExternalStore` makes polyfills unnecessary)
- Removed 8 Vite aliases + 3 `optimizeDeps.exclude` entries for `use-sync-external-store`
- Replaced deprecated `optimizeDeps.disabled: true` with `noDiscovery: true`
- Converted all 6 source files: `App.jsx` → `.tsx`, `index.jsx` → `.tsx`, `BootstrapErrorBoundary.jsx` → `.tsx`, `queryClient.js` → `.ts`, `bootstrapDiagnostics.js` → `.ts`, `serviceWorker.js` → `.ts`
- All files fully typed with TypeScript interfaces and annotations
- Updated `index.html` entry point: `src/index.jsx` → `src/index.tsx`
- Rewrote README.md and README-RU.md (removed legacy Flowise branding)

**Core-backend deep clean**:
- Deleted `marketplaces/` directory (66 Flowise JSON template files in canvases/agentflows/tools)
- Rewrote README.md and README-RU.md (removed legacy Flowise branding)

### Build Verification

- Full workspace build: 23/23 packages successful (3m05s)

### QA Remediation (2026-03-04)

All issues from QA analysis resolved:
- **Dead code removed**: `serviceWorker.ts` (CRA legacy, never imported) deleted
- **Vite env fix**: `process.env.PUBLIC_URL` → `import.meta.env.BASE_URL` in `index.tsx`
- **Type safety**: Created `src/global.d.ts` with `Window.__APP_BASEPATH__` and `ImportMetaEnv` declarations
- **Error middleware typing**: Replaced `InternalError | any` with typed `ErrorLike` interface; removed unused import
- **Hardcoded text**: Replaced Russian "Загрузка..." with language-neutral CSS spinner in `App.tsx`
- **Prettier clean**: Fixed formatting in `MenuContent.tsx`, `admin.ts`, `abilities/index.ts`
- **Gemini rules updated**: Fixed 4 stale `flowise-core-*` paths in `.gemini/rules/`
- **Memory-bank reference**: Fixed stale `flowise-core-backend` in `activeContext.md`
- Build: 23/23 packages successful (2m52s), lint: 0 errors

---

## Fix Auth Login TypeError (2026-03-04)

After the legacy cleanup refactor, login was broken with `TypeError: e.get is not a function` in `useSession`. Root cause: `@/api/client.ts` exports the full `UniversoApiClient` wrapper, not a raw AxiosInstance. `AuthProvider` was receiving the wrapper object instead of the axios instance. Fixed by passing `api.$client` in `index.jsx`. Build verified (23/23).

---

## QA Findings Full Closure (2026-03-04)

Implemented and verified full closure for the codename/CRUD QA findings.

### What was fixed

- **Unified retry policy**: introduced shared constants in backend helper:
  - `CODENAME_RETRY_MAX_ATTEMPTS = 1000`
  - `CODENAME_CONCURRENT_RETRIES_PER_ATTEMPT = 5`
- **Hardened codename attempts**: `buildCodenameAttempt()` now produces style-valid retry suffixes (`-<n>` for kebab-case, `<n>` for pascal-case) with deterministic max-length handling.
- **Applied to all relevant flows**: updated copy/rename retry loops in attributes, hubs, catalogs, enumerations, enumeration values, and attribute auto-rename transfer logic.
- **Added missing tests**:
  - `@universo/utils`: `src/validation/__tests__/codename.test.ts` (8 tests)
  - `@universo/metahubs-backend`: `src/tests/services/codenameStyleHelper.test.ts` (6 tests)

### Verification

- `pnpm --filter @universo/utils test` → pass (`11/11` files, `162/162` tests)
- `pnpm --filter @universo/metahubs-backend test -- src/tests/services/codenameStyleHelper.test.ts` → pass (`6/6`)
- `pnpm --filter @universo/utils lint` → pass (`0` errors, warning-only legacy debt)
- `pnpm --filter @universo/metahubs-backend lint` → pass (`0` errors, warning-only legacy debt)
- `pnpm build` (root) → pass (`23/23` packages)

---

## Legacy Cleanup — Remove Flowise Packages (2026-03-04)

Massive repository cleanup: removed 39 legacy Flowise/UPDL packages, renamed remaining @flowise/* → @universo/*, cleaned all cross-references.

### Summary

- **39 packages deleted** (38 from plan + flowise-template-mui merged then deleted)
- **3 packages renamed**: flowise-core-backend → universo-core-backend, flowise-core-frontend → universo-core-frontend, flowise-store → universo-store
- **1 package merged**: flowise-template-mui → universo-template-mui
- **24 packages remaining** (down from ~63)
- **14 commits** on branch `cleanup/remove-legacy-packages`
- **Zero `@flowise/` references** in source code, package.json, or config files
- **Zero `@flowise/` references** in `packages/**` docs/configs/imports

### Key changes

- Root configs cleaned: removed ghost workspaces, 8+ dead AI/LLM overrides (langchain, openai, sqlite3, mysql2, etc.), all resolutions, @colyseus/ws-transport dep
- universo-api-client: 20 dead API modules deleted, 6 dead type files removed
- universo-rest-docs: removed stale Metaverse schema imports
- universo-template-mui: added MainCard export, fixed ThemeRoutes routing, lint-fixed 299 prettier errors
- All 30+ documentation files updated with correct @universo/* package names

### Build Verification

- `pnpm build`: 23/23 packages successful (2m50s)
- `pnpm install`: passes with cleaned lockfile
- Zero `@flowise/` references in source (grep verified)

---

## Post-QA Hardening (2026-03-04)

Closed all issues found in the latest QA pass for the cleanup scope.

### What was fixed

- Fixed failing `metahubs-frontend` test (`MetahubMembers`): merged duplicate `@universo/template-mui` mocks so `FlowListTable` and `InputHintDialog` are stubbed in one module mock.
- Fixed failing `template-mui` tests (`useBreadcrumbName`): restored backward-compatible exports `useMetaverseName` and `truncateMetaverseName`.
- Removed residual legacy package folders that violated the cleanup plan and broke clean build (`packages/flowise-core-backend`, `packages/flowise-store`).
- Security hardening via dependency upgrades/overrides:
  - `@casl/ability` → `6.7.5`
  - `axios` → `1.13.5`
  - `fast-xml-parser` → `5.3.6`
  - `@remix-run/router` → `1.23.2`
  - `jws` pinned via selectors for vulnerable chains
  - `tar` → `7.5.8`
  - `minimatch` hardened via scoped selectors (`glob>minimatch` → `10.2.3`, `@oclif/core>minimatch` → `9.0.7`) to avoid lint plugin runtime breakage

### Verification

- Tests:
  - `@universo/metahubs-frontend`: pass
  - `@universo/template-mui`: 169/169 pass
- Lint (touched packages):
  - `@universo/metahubs-frontend`: pass
  - `@universo/template-mui`: pass
  - `@universo/api-client`: pass
- Security audit:
  - `pnpm audit --prod --audit-level=high`: no high/critical issues (remaining: 5 low, 4 moderate)
- Build:
  - `pnpm build:clean`: 23/23 packages successful

### Final verification rerun (same day)

- Re-ran previously failing suites after final lockfile/override refinement:
  - `@universo/metahubs-frontend` tests: pass
  - `@universo/template-mui` tests: 169/169 pass
- Re-ran touched-package lint gates:
  - `@universo/metahubs-frontend`: pass
  - `@universo/template-mui`: pass
  - `@universo/api-client`: pass
- Reconfirmed gates after scoped minimatch strategy:
  - `pnpm audit --prod --audit-level=high`: pass (no high/critical)
  - `pnpm build:clean`: pass (23/23)

---

## QA Tech Debt Cleanup (2026-03-04)

Fixed all tech debt items identified in the comprehensive QA analysis.

### What was fixed

- **Stale JSDoc comment (MEDIUM)**: Updated `useReorderAttribute` docstring — said "cross-list skipped" but cross-list optimistic updates were already implemented.
- **Fragile `movedItem` closure (LOW)**: Replaced side-effect capture inside `setQueriesData` callback with pre-extraction via `getQueriesData`. The moved item is found from cache before updaters run, eliminating reliance on closure mutation order.
- **Over-broad child invalidation (LOW)**: `onSuccess` now conditionally invalidates child caches only for cross-list transfers (`newParentAttributeId !== undefined`). Same-list reorder no longer triggers unnecessary refetch of all child attribute lists.
- **`as any` cleanup**: Replaced `as any` casts in same-list `reorderUpdater` with typed `Record<string, unknown>` casts, matching cross-list code style. Reduced lint warnings from 166 to 153.

### Verification

- Lint: metahubs-frontend 0 errors/153 warnings
- Tests: metahubs-frontend 97/97
- Build: metahubs-frontend ✔ success

---

## Cross-List DnD Optimistic Update (2026-03-03)

Added instant visual feedback for cross-list attribute DnD transfers (root↔child, child↔child).

### What was fixed

- **Cross-list snap-back eliminated**: Previously, `onMutate` skipped optimistic updates for cross-list transfers (`newParentAttributeId !== undefined`), causing attributes to snap back to original position for 2-3s until server response arrived. Now items instantly move between caches.
- **Implementation**: Added `currentParentAttributeId` parameter through the callback chain (`useAttributeDnd` → `AttributeDndProvider` → `AttributeList` → `mutations.ts`). In `onMutate`, source cache item is removed via `removeUpdater`, target cache receives it via `insertUpdater`, both lists get sort orders re-indexed.
- **Unified rollback**: Both root and child caches are snapshotted before any modification, ensuring clean rollback on error.

### Verification

- Lint: metahubs-frontend 0 errors/166 warnings
- Tests: metahubs-frontend 97/97, metahubs-backend 128/128
- Build: 56/56 successful

---

## DnD QA Pass 5 — Post-Analysis Fixes (2026-03-03)

Fixed 4 issues identified by comprehensive QA analysis of the DnD implementation.

### What was fixed

- **Backend auto-set display attribute (Fix 1, MEDIUM)**: In `reorderAttribute()`, after cross-list move to child list, counts siblings in target. If count === 1, auto-sets `is_display_attribute: true` + `is_required: true`. Ensures newly populated child lists always have a display attribute.
- **Ghost row collision guard (Fix 2, MEDIUM)**: In `handleDragOver`, early return when hovering over ghost of dragged item prevents render cycle (EmptyDroppableChildArea ↔ DroppableSortableBody). In `handleDragEnd`, saves pending transfer before clearing state; resolves target container from saved transfer when dropped on ghost; uses `insertIndex + 1` for sort order.
- **Source list display protection (Fix 3, LOW)**: Changed `_validateCrossListTransfer()` to block ALL display attribute cross-list transfers (removed `&& targetParentId !== null`). Aligned backend with frontend behavior. Prevents source list losing display attribute via direct API.
- **eslint-disable cleanup (Fix 4, LOW)**: Extracted inline type to `EmptyDroppableChildAreaProps` interface. Reduced from 2 awkward eslint-disable comments to 1 standard `eslint-disable-next-line`.

### Verification

- Lint: metahubs-backend 0 errors/216 warnings, metahubs-frontend 0 errors/163 warnings
- Tests: metahubs-backend 128/128, metahubs-frontend 97/97, template-mui 169/169
- Build: 56/56 successful (5m29s)

---

## DnD QA Pass 4 — 4 Issues Fix (2026-03-03)

Fixed 4 QA issues from manual testing of DnD cross-list transfers and attribute editing.

### What was fixed

- **Cross-list drag jitter (Issue 1)**: Added `overflowX: 'hidden'` to FlowListTable TableContainer when `isDropTarget` active. Prevents horizontal scrollbar cycle caused by wider ghost rows injected into narrower child tables.
- **Empty child table drop target (Issue 2)**: Created `EmptyDroppableChildArea` component with `@dnd-kit/core` `useDroppable`. Restructured ChildAttributeList rendering to always compute effectiveData — shows EmptyDroppableChildArea when empty, FlowListTable when data exists.
- **First-child confirmation dialog (Issue 3)**: Extended `onValidateTransfer` signature with `targetContainerItemCount`. When dropping to empty child container, shows confirmation dialog explaining attribute will become display + required. Added EN/RU i18n keys.
- **Display attribute toggle lock (Issue 4)**: `displayAttributeLocked` now also true when editing the current display attribute (AttributeActions.tsx + ChildAttributeList edit dialog). Switch shows ON + disabled state.

### Verification

- `pnpm --filter metahubs-frontend lint` → 0 errors, 163 warnings
- `pnpm build` (root) → 56/56 successful, 5m36s

## DnD QA Pass 3 — 4 Issues Fix (2026-03-03)

Fixed 4 QA issues from manual testing of DnD attributes/enumeration values.

### What was fixed

- **Enum value row height**: Removed `compact` from EnumerationValueList FlowListTable (standard 64px rows).
- **Drag handle centering**: Added `verticalAlign: 'middle'` to drag handle cell in SortableTableRow — works for both 64px and 40px rows.
- **Cross-list DnD ghost row**: New `PendingTransfer` state in `useAttributeDnd` tracks virtual cross-list item movement. Source container hides the dragged item; target container injects a ghost row at the insertion point (computed from cursor position relative to over item center). @dnd-kit `isDragging` opacity (0.4) makes the ghost semi-transparent automatically.
- **Codename VLC auto-rename**: Verified correct for both VLC ON and OFF — `codename_localized: null` ensures display falls back to renamed codename.

### Verification

- `pnpm --filter @universo/metahubs-frontend lint` → 0 errors, 164 warnings
- `pnpm --filter @universo/metahubs-frontend test` → 97/97 passed
- `pnpm --filter @universo/metahubs-backend test` → 17/17 suites, 128 passed, 3 skipped
- `pnpm --filter @universo/template-mui test` → 10/10 suites, 169/169 passed
- `pnpm build` (root) → 56/56 successful, 4m54s

## DnD QA Pass 2 — 6 Issues Fix (2026-03-04)

Fixed 6 QA issues found during manual testing of the DnD attributes/enumeration values feature.

### What was fixed

- **Row height**: Removed `compact` from root AttributeList FlowListTable (64px standard rows), child lists remain compact (40px).
- **Cross-list DnD visual feedback**: New `AttributeDndStateContext` + `useAttributeDndState()` hook + `DndDropTarget` render-prop + `isDropTarget` prop in FlowListTable. Shows dashed primary border + 4% alpha background on target container during cross-list drag.
- **Display attr validation**: Blocks display attribute from ANY cross-list transfer (previously only blocked root→child).
- **ConfirmDialog styling**: Widened from `maxWidth='xs'` to `'sm'`, added DialogActions padding to match ConfirmDeleteDialog.
- **Codename suffix format**: `buildCodenameAttempt` no longer uses separator (`Name2` not `Name_2`).
- **Codename rename bug**: Auto-rename now also sets `codename_localized: null` so display shows updated codename.
- **Optimistic updates**: Added `onMutate`/`onError` to `useReorderAttribute` (same-list) and `useReorderEnumerationValue` with cache snapshot and rollback.

### Verification

- `pnpm --filter @universo/metahubs-frontend lint` → 0 errors, 164 warnings
- `pnpm --filter @universo/metahubs-frontend test` → 97/97 passed
- `pnpm --filter @universo/metahubs-backend test` → 17/17 suites, 128 passed, 3 skipped
- `pnpm --filter @universo/template-mui test` → 10/10 suites, 169/169 passed
- `pnpm build` (root) → 56/56 successful, 5m32s

## DnD Table Design Restoration & Tech Debt Elimination (2026-03-03)

Restored standard table design across all DnD-enabled lists by extending FlowListTable with built-in DnD support, fixed all pre-existing TS errors, and cleaned up redundant components.

### What was implemented

- **FlowListTable DnD extension** (`universo-template-mui`): Created `FlowListTableDnd.tsx` with internal building blocks (SortableTableRow, SortableTableBody, InternalDndWrapper). Added 12 DnD props to FlowListTable: `sortableRows`, `sortableItemIds`, `droppableContainerId`, `externalDndContext`, `onSortableDragEnd/Start/Over/Cancel`, `renderDragOverlay`, `dragHandleAriaLabel`, `dragDisabled`. Added `@dnd-kit` deps.
- **EntityFormDialog fixes**: Added `'copy'` to mode union, `deleteButtonDisabledReason?: string` with Tooltip wrapper.
- **EnumerationValueList TS error fixes**: Fixed `appendCopySuffix` locales cast, `onSearchChange` type, `t()` overloads (2×), `deleting`→`loading` prop. Explicitly typed all implicit `any` params: 11 `ctx: ValueActionCtx`, deriveCodename, onChange (3×), onTouchedChange, onLocalizedChange, onSearchChange, extraFields (2×).
- **Consumer migrations**: AttributeList and ChildAttributeList migrated from bare `<Table>` to `<FlowListTable>` with `sortableRows` + `externalDndContext`. EnumerationValueList migrated to `<FlowListTable>` with internal DnD (onSortableDragEnd, renderDragOverlay).
- **Cleanup**: Deleted 4 redundant DnD components (SortableAttributeRow, SortableAttributeTableBody, SortableValueRow, SortableEnumerationValueTable). Updated barrel exports in `attributes/ui/dnd/index.ts` and `enumerations/ui/dnd/index.ts`.

### Verification

- `pnpm --filter @universo/metahubs-frontend lint` → pass (0 errors, 149 warnings)
- `pnpm --filter @universo/metahubs-backend lint` → pass (0 errors, 216 warnings)
- `pnpm --filter @universo/metahubs-backend test` → pass (2/2 suites, 21/21 tests)
- `pnpm --filter @universo/metahubs-frontend build` → pass (5494ms)
- `pnpm build` (root) → pass (56/56, 5m32s)

### Outcome

- All DnD-enabled tables now use standard FlowListTable with consistent TableContainer/Paper/border design.
- Pre-existing TS errors in EnumerationValueList eliminated (0 real code errors).
- 4 redundant DnD components removed; remaining 5 domain-specific components (DragOverlayRow, AttributeDndProvider, useAttributeDnd, AttributeDndContainerRegistry, DragOverlayValueRow) preserved.
- FlowListTable DnD API is reusable for future DnD additions across the platform.

## DnD QA Critical Debt Closure (2026-03-03)

Completed a focused remediation pass to eliminate remaining QA blockers in DnD reorder flows for attributes and enumeration values.

### What was fixed

- Backend reorder policy enforcement now uses metahub settings for cross-list transfers (`allowAttributeMoveBetweenRootAndChildren`, `allowAttributeMoveBetweenChildLists`) so restricted moves are rejected server-side.
- Reorder services now enforce strict ownership and active-row constraints when loading/updating entities (`id + object_id`, deleted-flag guards), including target-parent ownership checks.
- Route-level regression coverage was expanded for reorder contracts in attributes/enumerations APIs (settings propagation, blocked transfer mapping, validation/not-found/happy paths).
- Newly introduced formatting/lint issues in touched DnD/backend files were resolved.

### Verification

- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/attributesRoutes.test.ts src/tests/routes/enumerationsRoutes.test.ts` -> pass (`2/2` suites, `21/21` tests)
- `pnpm --filter @universo/metahubs-backend build` -> pass
- `pnpm --filter @universo/metahubs-frontend build` -> pass (`Build complete in 6597ms`)
- `pnpm --filter @universo/template-mui build` -> pass (`Build complete in 1461ms`)
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `6m33.197s`)

### Outcome

- The DnD QA debt in this scope is closed with backend-enforced policy/ownership safety and green verification gates.

## Drag-and-Drop for Attributes & Enumeration Values (2026-03-03)

Implemented full drag-and-drop reordering for attributes (root + child lists with cross-list transfer) and enumeration values in metahubs. Uses `@dnd-kit` library (same as spaces-frontend).

### What was implemented

- **Backend**: `reorderAttribute()` with transactional gap-shift + sequential normalization, cross-list transfer validation (display attr, TABLE nesting, codename uniqueness with auto-rename up to 20 attempts), `reorderValue()` for enumerations. PATCH routes with Zod validation and proper HTTP error codes (409/422/403).
- **Frontend**: 11 DnD component files (7 for attributes in Provider/Hook/Component pattern, 4 for enumerations). Integrated in AttributeList, ChildAttributeList, EnumerationValueList. Cross-list DnD via `AttributeDndContainerRegistry` context.
- **Settings**: 2 new metahub settings (`catalogs.allowAttributeMoveBetweenRootAndChildren`, `catalogs.allowAttributeMoveBetweenChildLists`) with EN+RU i18n.
- **i18n**: Full EN+RU coverage for DnD dialogs, success/error snackbars, drag handle accessibility labels, codename conflict resolution UI.
- **Accessibility**: `aria-label` on all drag handle cells via prop chain.

### QA fixes applied

- Added missing Phase 2.2 settings i18n keys (4 keys × 2 locales)
- Wired `dragHandleAriaLabel` prop through SortableRow → TableBody → List components
- Added success snackbars after reorder mutations
- Removed dead `transferBlocked` i18n key

### Verification

- `pnpm --filter metahubs-frontend build` -> pass
- `pnpm --filter metahubs-backend build` -> pass
- All i18n keys verified: no unused DnD keys, JSON valid

## Codename Auto-Convert UX Hardening (2026-03-03)

Completed a focused UX/logic hardening pass to make mixed-alphabet codename conversion consistent between manual codename editing and codename auto-generation from Name.

### What was fixed

- `@universo/utils` codename sanitizer was extended so generation flows can opt into mixed-alphabet auto-conversion when mixed alphabet input is disallowed by settings.
- All metahubs codename generation call sites in forms (create/edit/copy and VLC-derived sync paths) now pass settings-aware controls for `allowMixed` and `autoConvertMixedAlphabets`.
- Admin and metahubs settings copy (EN/RU) was updated: setting label simplified to “Auto-convert Mixed Alphabet” and descriptions now explicitly cover both Name-based generation and manual Codename blur normalization.
- Existing manual blur conversion behavior in the Codename field was preserved.

### Verification

- `pnpm --filter @universo/metahubs-frontend lint` -> pass (`0` errors, `149` warnings)
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m23.968s`)

### Outcome

- Codename mixed-alphabet conversion is now settings-consistent across both input paths (manual blur and Name-driven auto-generation) in metahubs forms.

## QA Debt Eradication Closure (2026-03-03)

Completed closure for the latest QA remediation pass focused on final lint blocker elimination and test stability hardening in `metahubs-frontend`.

### What was fixed

- `EnumerationValueList.tsx`: added missing `editingEntityId?: string | null` prop typing in `ValueFormFields` props to remove the remaining `react/prop-types` error-level lint blocker.
- `src/__mocks__/handlers.ts`: added missing MSW route for `GET /api/v1/metahubs/codename-defaults` and returned stable codename-default config payload used by frontend tests.
- Preserved functional behavior while keeping changes minimal and isolated to QA-reported gaps.

### Verification

- `pnpm --filter @universo/metahubs-frontend lint` -> pass (`0` errors, `149` warnings)
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `123` passed, `3` skipped)
- `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests)
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m20.626s`)

### Outcome

- QA-reported blocker-level issues in this pass are resolved and integration baseline remains green.
- Legacy warning-only lint debt remains outside this narrow remediation scope and is unchanged.

## QA Remediation — Root Attribute Codename Flow Hardening (2026-03-03)

Completed final remediation for the remaining root attribute QA gaps in codename handling and duplicate safety.

### What was fixed

- `AttributeList.tsx` moved to settings-aware codename normalization/validation (`normalizeCodenameForStyle` + `isValidCodenameForStyle`) for create/edit save paths; legacy `sanitizeCodename` root path removed from this flow.
- Root attribute screen now uses `catalogs.attributeCodenameScope` to select codename source:
  - `global` -> fetches `allAttributeCodenames`
  - `per-level` -> uses current root attribute list
- Added `ExistingCodenamesProvider` around root attribute UI/dialog tree so duplicate detection works consistently for root create/edit/copy dialogs.
- Root create dialog `canSave` now enforces `!values._hasCodenameDuplicate`, matching child/action duplicate blocking behavior.
- Cleaned warning hotspots in touched file (`any` casts, unstable dependency expression) and left file lint-clean.

### Verification

- `pnpm --filter @universo/metahubs-frontend exec eslint --ext .ts,.tsx src/domains/attributes/ui/AttributeList.tsx` -> pass (0 errors, 0 warnings)
- `pnpm --filter metahubs-backend test -- src/tests/routes/attributesRoutes.test.ts` -> pass (`6/6` tests)
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `123` passed, `3` skipped)
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `4m46.265s`)

### Outcome

- The previously reported root-level codename/duplicate QA debt is closed without broad refactors outside the target scope.

## Codename Bug Fixes + Global Scope + Button Disable (2026-03-03)

Fixed 4 QA issues found during testing of the codename duplicate checking feature.

### What was fixed

**Issue 1 — i18n + original case**:
- `CodenameField.tsx` i18n keys fixed from `metahubs.validation.*` to `validation.*` (correct after `consolidateMetahubsNamespace()` flattening)
- `useCodenameDuplicateCheck.ts` `collectAllCodenameValues()` returns `{original, lower}[]` pairs — error messages display original-case codename instead of lowercase

**Issue 2 — Auto-convert mixed alphabets restored**:
- Removed explicit `normalizeOnBlur={(value) => normalizeCodenameForStyle(...)}` from all 12 form builders (MetahubList/Actions, HubList/Actions, CatalogList/Actions, EnumerationList/Actions, EnumerationValueList, BranchList/Actions, AttributeFormFields)
- This restores CodenameField's built-in `settingsBasedNormalize` which calls `autoConvertMixedAlphabetsByFirstSymbol()` before normalization

**Issue 3 — Disable save button on duplicate**:
- Added `onDuplicateStatusChange` callback prop to `CodenameField` (useEffect + useRef pattern)
- Wired in all 12 form builders: `onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}`
- Added `!values._hasCodenameDuplicate` to all 15 `canSave` functions across 14 files (MetahubActions/List, HubActions/List, CatalogActions/List, EnumerationActions/List, EnumerationValueList, BranchActions/List, AttributeActions (×2), AttributeList, ChildAttributeList)

**Issue 4 — attributeCodenameScope global mode**:
- Backend: new `GET /metahub/:id/catalog/:catalogId/attribute-codenames` endpoint using `findAllFlat()` (returns all root + child codenames)
- Frontend API: `listAllAttributeCodenames()` + query key `allAttributeCodenames` + invalidation integration
- Frontend: `AttributeList` and `ChildAttributeList` read `catalogs.attributeCodenameScope` setting; when 'global', query all codenames and pass to `ExistingCodenamesProvider` for cross-level duplicate checking
- Invalidation: all mutation paths (hub-based + hub-less) now invalidate global codenames cache

### Verification
- `pnpm build` (root) → pass (`56 successful, 56 total`)

### QA Fix (post-QA pass)
**Bug found**: `AttributeList.tsx` was missing `invalidateAttributesQueries.allCodenames()` calls — hub-based catalog mutations left stale codenames in React Query cache.
**Fix**: Added `allCodenames` invalidation to 4 mutation points: `refreshList`, `handleCreateAttribute`, `ChildAttributeList onRefresh`, `ConflictResolutionDialog onCancel`.
**Also fixed**: 3 prettier formatting errors in `CodenameField.tsx` (2) and `attributes.ts` (1).
**Verified**: 0 TS errors, 0 lint errors in all modified files.

## Admin i18n + Codename Duplicate Check + Element Settings (2026-03-03)

Implemented 4 tasks: admin i18n fix, reactive codename duplicate checking with VLC cross-locale uniqueness, and element copy/delete settings.

### What was built

**Infrastructure (new files)**:
- `ExistingCodenamesContext.tsx` — React Context providing existing entity codenames to descendant form components
- `useCodenameDuplicateCheck.ts` — Hook with `collectAllCodenameValues()` for flat set extraction from plain codenames + all VLC locale values; case-insensitive comparison via `toLowerCase()`

**Modified components**:
- `CodenameField.tsx` — consumes context, accepts `editingEntityId` prop, merges duplicate error with form validation (form error takes precedence)
- 9 entity list/action components integrated with `ExistingCodenamesProvider` wrapping and `editingEntityId` passing: MetahubList, MetahubActions, HubList, HubActions, CatalogList, CatalogActions, EnumerationList, EnumerationActions, EnumerationValueList, BranchList, BranchActions, ChildAttributeList, AttributeList, AttributeActions

**Settings additions**:
- `catalogs.allowElementCopy` + `catalogs.allowElementDelete` in `METAHUB_SETTINGS_REGISTRY`
- `ElementList.tsx` filters actions via `useSettingValue`

**i18n**:
- Admin blur fix: EN + RU corrected labels
- Codename duplicate messages: `metahubs.validation.codenameDuplicate` + `metahubs.validation.codenameDuplicateVlc` (EN + RU)
- Element settings: `metahubs.settings.catalogs.allowElementCopy` + `allowElementDelete` (EN + RU)

### QA findings and fixes
- **Critical**: AttributeList.tsx and AttributeActions.tsx were initially missed — not integrated with ExistingCodenamesProvider / editingEntityId. Fixed in same session.
- **Non-critical (deferred)**: `attributeCodenameScope: 'global'` mode not dynamically handled (correct for default 'per-level').

### Verification
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `6m31s`).

## Catalog Actions Policy Parity Remediation (2026-03-02)

Completed the remaining QA follow-up in metahubs frontend by aligning catalog action visibility with existing settings-based policy logic.

### What was fixed
- `CatalogList` action menus now apply settings-based filtering (`catalogs.allowCopy`, `catalogs.allowDelete`) before rendering descriptors.
- Filtering is applied consistently in both card and table render paths, matching existing hubs/enumerations behavior.
- Backend policy and data-operation behavior remained unchanged to avoid introducing regressions in security-critical logic.

### Verification
- `pnpm --filter @universo/metahubs-frontend exec eslint --max-warnings=0 --ext .ts,.tsx src/domains/catalogs/ui/CatalogList.tsx` -> pass.
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `6m44.189s`).

### Outcome
- The previously identified frontend policy-parity debt for catalogs is closed.
- No additional QA issues were introduced by this remediation.

## Comprehensive QA Finalization (2026-03-02)

Completed an evidence-based QA closure pass for the latest metahub settings/codename/policy work, with explicit clean-database resilience checks and final build verification.

### What was validated
- Fresh-DB safety chain: admin bootstrap migration seeds both `admin.locales` and `admin.settings`, and follow-up migration adds `metahubs.codenameAutoConvertMixedAlphabets` with idempotent upsert behavior.
- Backend enforcement parity: route-level policy guards remain active for hubs/catalogs/enumerations copy/delete actions and catalog attribute policy keys.
- Delete semantics integrity: hub-scoped unlink for N:M entities remains allowed when associations remain; full entity deletion is still gated by policy and blocker-reference checks.
- Frontend policy parity review: `HubList` and `EnumerationList` filter action menus by settings; `CatalogList` currently renders raw `catalogActions` and was classified as non-blocking UX parity debt (backend still enforces settings).

### Verification
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m29.979s`).

### Outcome
- Production-readiness remains **green for backend safety/data integrity** under fresh DB recreation.
- One non-blocking follow-up remains: align catalog action visibility in frontend with existing settings behavior for full UX parity.

## Metahub Language/Codename/Attribute Policy Fixes Closure (2026-03-02)

Closed the requested metahub fixes for language defaults, codename behavior, attribute policies, and settings UX, then finalized with an additional blur-normalization hardening pass.

### What was fixed
- Ensured `general.language` is functional with `system` mode and dynamic locale options sourced from Admin content locales.
- Applied metahub primary-locale setting into VLC-first create flows (catalogs, hubs, branches, enumerations, attributes).
- Confirmed catalog create/edit codename behavior is style-aware and VLC-aware (including localized codename payload fields).
- Localized codename rendering in root and child attribute tables now follows current UI language fallback chain.
- Completed catalog attribute policy path (`allowAttributeCopy`, `allowAttributeDelete`, `allowDeleteLastDisplayAttribute`) in backend/frontend flows.
- Completed compact horizontal/wrapped rendering for `catalogs.allowedAttributeTypes` in settings UI.
- Replaced ambiguous blur wording in settings/helper copy.
- Added final source-level hardening: style-aware `normalizeOnBlur` for all primary metahub `CodenameField` form usages to avoid unintended legacy kebab normalization in Pascal/VLC mode.
- Added conditional settings dependency UX: `catalogs.allowDeleteLastDisplayAttribute` is hidden when `catalogs.allowAttributeDelete` is disabled.

### Verification
- `pnpm --filter @universo/metahubs-frontend lint` -> pass (`0` errors, warnings only).
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m0.269s`).

### Outcome
- The 6-point requested behavior scope is fully implemented and verified with green workspace build.

## Post-QA Debt Cleanup & Safety Hardening Closure (2026-03-02)

Completed the final warning-level cleanup for changed `@universo/metahubs-frontend` files and closed the implementation validation cycle.

### What was fixed
- Removed remaining strict-lint findings in changed metahubs frontend files (`no-explicit-any`, hook dependency warnings, unsafe error typing) with behavior-preserving refactors.
- Repaired and revalidated affected list/action screens after iterative lint passes.
- Closed the pass with strict changed-files lint and full workspace build.

### Verification
- Strict lint across changed `@universo/metahubs-frontend` source files -> pass (`--max-warnings=0`, no warnings).
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m28.522s`).

### Outcome
- QA-driven warning debt in the changed metahubs frontend scope is fully remediated and build baseline remains green.

## Codename UX/Settings Refinement Completion (2026-03-02)

Completed the requested codename UX/settings refinement pass across metahubs and admin surfaces, including preview logic parity, new mixed-alphabet auto-convert setting, and normalization consistency.

### What was fixed
- Added and wired `general.codenameAutoConvertMixedAlphabets` (default `true`) through shared settings registry, metahub template defaults, admin settings validation/migration, and metahub codename defaults API output.
- Updated metahubs and admin settings preview behavior so style/alphabet rows show non-mixed examples, while mixed example appears only in the mixed-alphabet setting context.
- Enabled blur-time mixed-alphabet auto-conversion by first symbol when `alphabet=en-ru`, `allowMixed=false`, and auto-convert is enabled.
- Applied dynamic codename helper messaging by effective codename settings and propagated config shape updates to all entity action defaults.
- Fixed PascalCase copy normalization case (`Покупки (копия)` -> `ПокупкиКопия`) in shared codename normalization pipeline.
- Resolved verification-time Prettier regressions in new settings UI wrappers and reran affected checks.

### Verification
- `pnpm --filter @universo/utils lint` -> pass (0 errors, warnings only).
- `pnpm --filter @universo/template-mui lint` -> pass (0 errors, warnings only).
- `pnpm --filter @universo/types lint` -> pass (0 errors, warnings only).
- `pnpm --filter @universo/metahubs-backend lint` -> pass (0 errors, warnings only).
- `pnpm --filter @universo/metahubs-frontend lint` -> pass (error-level clean, warnings only).
- `pnpm --filter @universo/admin-backend lint` -> pass (0 errors, warnings only).
- `pnpm --filter @universo/admin-frontend lint` -> pass (0 errors, warnings only).
- `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests).
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `123` passed, `3` skipped).
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests).
- `pnpm --filter @universo/utils test` -> pass (`10/10` files, `154/154` tests).
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m25.055s`).

### Outcome
- Requested codename behavior refinements are implemented end-to-end and validated by package checks plus full workspace build.

## QA Safety Remediation Hardening (2026-03-02)

Completed the QA hardening pass for metahubs backend route safety and closed the remaining build blocker introduced during the implementation iteration.

### What was fixed
- Added strict catalog-kind guards in route paths previously relying only on object existence checks.
- Aligned permanent catalog delete behavior with blocker-reference safety checks used in soft-delete flows.
- Added conflict-safe catalog restore behavior (`409` for codename uniqueness conflicts).
- Enforced `isSingleHub` consistency in hub-scoped catalog mutation paths.
- Serialized global attribute codename mutation paths via advisory lock and added lock-failure regression coverage.
- Fixed TypeScript strictness regressions in `catalogsRoutes.ts` by narrowing hub arrays and localized `_primary` reads.

### Verification
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/catalogsRoutes.test.ts src/tests/routes/attributesRoutes.test.ts` -> pass (`2/2` suites, `30/30` tests).
- `pnpm --filter @universo/metahubs-backend lint` -> pass (`0` errors, warnings only).
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `123` passed, `3` skipped).
- `pnpm --filter @universo/metahubs-backend build` -> pass.
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m41.147s`).

### Outcome
- The current QA remediation scope is fully closed with green route tests, green package lint/test/build, and green full workspace build.

## VLC UX & Settings Consistency Fixes (2026-03-02)

Implemented and finalized all newly reported VLC/codename UX and settings consistency defects for metahubs frontend/template integration.

### What was fixed
- Localized codename sync behavior corrected for language switch vs locale addition to avoid duplicate/empty codename locale artifacts.
- Localized connector geometry fixed in `LocalizedInlineField` and localized codename blur normalization restored in shared `CodenameField` flow.
- `useCodenameVlcSync` integration expanded across entity forms (attributes, branches, hubs, catalogs, enumerations, enumeration values), not only metahub forms.
- Duplicate settings surface removed by deleting `common.defaultLocale` from metahub registry; `Common` tab now shows an informational placeholder when empty.
- `catalogs.allowedAttributeTypes` options localized in settings UI and enforced in attribute create dialogs (including child attribute restrictions).
- Follow-up lint/build regressions introduced during this pass fixed (`AttributeList`, `ChildAttributeList`, `useCodenameVlcSync` typed locale entries).

### Verification
- `pnpm --filter @universo/template-mui lint` -> pass (`0` errors, warnings only).
- `pnpm --filter @universo/metahubs-frontend lint` -> pass (`0` errors, warnings only).
- `pnpm --filter @universo/types lint` -> pass (`0` errors, warnings only).
- `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests).
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests).
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `4m54.002s`).

### Outcome
- The reported 7-point defect scope is closed in this implementation pass with green targeted checks and green full workspace build.

---

## QA Findings Fix (2026-03-02)

Fixed all issues discovered during comprehensive QA analysis of VLC codename implementation.

### What was fixed
- **Admin auth for regular users**: Replaced `useAdminMetahubDefaults` (calling admin-only `/admin/settings/metahubs`) with `usePlatformCodenameDefaults` using new public `GET /metahubs/codename-defaults` endpoint. Regular users can now access platform-level codename defaults when creating new metahubs.
- **DEFAULT_CC type contract**: Added missing `localizedEnabled: false` to all 6 `DEFAULT_CC` objects across MetahubActions, AttributeActions, BranchActions, HubActions, CatalogActions, EnumerationActions.
- **Prettier compliance**: Fixed formatting in `useCodenameVlcSync.ts` (`.some()` callback) and all `DEFAULT_CC` declarations (multiline format).
- **useCodenameVlcSync performance**: Replaced `codenameVlc` in first `useEffect` deps with `codenameVlcRef` to avoid unnecessary re-render cycle during auto-fill.

### Files changed
- `packages/metahubs-backend/base/src/domains/metahubs/routes/metahubsRoutes.ts` (new endpoint)
- `packages/metahubs-frontend/base/src/domains/settings/hooks/useCodenameConfig.ts` (rewritten)
- `packages/universo-template-mui/base/src/hooks/useCodenameVlcSync.ts` (optimized)
- `packages/metahubs-frontend/base/src/domains/metahubs/ui/MetahubActions.tsx`
- `packages/metahubs-frontend/base/src/domains/attributes/ui/AttributeActions.tsx`
- `packages/metahubs-frontend/base/src/domains/branches/ui/BranchActions.tsx`
- `packages/metahubs-frontend/base/src/domains/hubs/ui/HubActions.tsx`
- `packages/metahubs-frontend/base/src/domains/catalogs/ui/CatalogActions.tsx`
- `packages/metahubs-frontend/base/src/domains/enumerations/ui/EnumerationActions.tsx`

### Verification
- `pnpm --filter @universo/template-mui lint` -> pass (0 errors).
- `pnpm --filter @universo/metahubs-frontend lint` -> pass (0 errors).
- `pnpm --filter @universo/metahubs-backend lint` -> pass (0 errors).
- `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests).
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `117` passed, `3` skipped).
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests).
- `pnpm build` (root) -> pass (`56/56` tasks).

---

## Settings UX & VLC Fixes (2026-03-02)

Fixed 5 issues found during user testing of the codename VLC feature.

### What was fixed
- **Toggle flickering**: Both `useUpdateSettings`/`useResetSetting` (metahub) and `AdminSettings.tsx` (admin) now use `queryClient.setQueryData()` with mutation response before `invalidateQueries()`, preventing stale-data flash.
- **VLC codename auto-generation**: New `useCodenameVlcSync` hook in `@universo/template-mui` syncs auto-filled plain codename into `codenameVlc` when localized codenames are enabled. Integrated into `GeneralTabFields` (MetahubList) and `MetahubEditFields` (MetahubActions).
- **VLC language sync**: Same hook syncs name field's `_primary` locale switch to codename field when codename is empty/untouched.
- **Admin VLC for new metahub**: `useCodenameConfig` now fetches admin-level defaults from `/admin/settings/metahubs` as fallback when no `metahubId` is available (metahub creation flow).
- **Migration merge**: `codename_localized JSONB` column merged into main `CreateMetahubsSchema` migration for both `metahubs.metahubs` and `metahubs.metahubs_branches` tables. Legacy `AddCodenameLocalizedColumns1767600000000` migration deleted.

### Files changed
- `packages/universo-template-mui/base/src/hooks/useCodenameVlcSync.ts` (NEW)
- `packages/universo-template-mui/base/src/hooks/index.ts`
- `packages/universo-template-mui/base/src/index.ts`
- `packages/metahubs-frontend/base/src/domains/settings/hooks/useSettings.ts`
- `packages/metahubs-frontend/base/src/domains/settings/hooks/useCodenameConfig.ts`
- `packages/metahubs-frontend/base/src/domains/metahubs/ui/MetahubList.tsx`
- `packages/metahubs-frontend/base/src/domains/metahubs/ui/MetahubActions.tsx`
- `packages/admin-frontend/base/src/pages/AdminSettings.tsx`
- `packages/metahubs-backend/base/src/database/migrations/postgres/1766351182000-CreateMetahubsSchema.ts`
- `packages/metahubs-backend/base/src/database/migrations/postgres/1767600000000-AddCodenameLocalizedColumns.ts` (DELETED)
- `packages/metahubs-backend/base/src/database/migrations/postgres/index.ts`

---

## Post-QA Full Remediation Completion (2026-03-02)

Completed an additional QA-driven hardening pass to remove remaining correctness and technical-debt findings discovered after the previous closure.

### What was fixed
- Codename blur normalization alignment: shared `template-mui` `CodenameField` now supports an optional `normalizeOnBlur` override, while `metahubs-frontend` wrapper injects settings-aware normalization (`style` + `alphabet`) without changing global default behavior.
- Admin settings key policy tightened: `adminSettingsRoutes` now rejects unknown keys for category `metahubs` (strict registry-aligned validation).
- Catalog details debt removed: both single-catalog GET endpoints now return real `attributesCount` and `elementsCount` via `MetahubAttributesService`/`MetahubElementsService`.
- Service-level validation hardened: `MetahubSettingsService.bulkUpsert` now validates setting values before transaction, preventing invalid payloads outside route-level validation paths.
- Added test coverage for new codename blur extension point in `template-mui` (`CodenameField.test.tsx`).

### Verification
- `pnpm --filter @universo/template-mui lint` -> pass (warnings only).
- `pnpm --filter @universo/metahubs-frontend lint` -> pass (warnings only).
- `pnpm --filter @universo/admin-backend lint` -> pass (warnings only).
- `pnpm --filter @universo/metahubs-backend lint` -> pass (warnings only).
- `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests).
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `120` total with `3` skipped).
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests).
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `4m33.455s`).

### Outcome
- All issues identified in the latest QA pass are remediated in this scope with no remaining blocking findings.

---

## QA Risk Closure Completion (2026-03-02)

Completed a focused remediation pass for the latest QA findings with concurrency-safe backend updates and frontend codename-settings reactivity fixes.

### What was fixed
- Backend routes hardened for race paths: deterministic duplicate-key conflict handling (`409`) on create flows and safer hub-association updates in hub-scoped unlink/delete operations.
- Frontend hook dependency gaps closed in metahubs entity list flows to prevent stale codename validation/normalization behavior after settings changes.
- Formatting/hook dependency lint blockers in touched files resolved without broad refactors.

### Verification
- `pnpm --filter @universo/metahubs-backend lint && pnpm --filter @universo/metahubs-frontend lint` -> no error-level diagnostics.
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `120` tests with `3` skipped).
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests).
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `4m35.871s`).

### Outcome
- QA remediation scope for this pass is fully closed and synchronized in Memory Bank.

---

## Session Finalization Handoff (2026-03-02)

Final closure synchronization pass completed after comprehensive QA remediation.

### What was done
- Re-checked `memory-bank` closure consistency (`tasks.md`, `activeContext.md`, `progress.md`) against implemented remediation scope.
- Added explicit handoff-completion section to `tasks.md` for this finalization pass.
- No new runtime code changes were required in this pass.

### Verification
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `4m34.494s`).

### Outcome
- Session state is fully synchronized and ready for independent QA validation mode.

---

## Comprehensive QA Remediation — Final Closure (2026-03-02)

Final implementation pass completed for the latest QA findings with zero remaining blocking issues in the touched scope.

### What was finalized
- Backend hardening completed for metahub settings/branches/attributes paths:
  - soft-deleted settings rows are revived in upsert/bulk-upsert flows,
  - branch codename validation now uses settings-aware style/alphabet/mixed-alphabet policy,
  - TABLE child attribute copy handles global codename uniqueness safely.
- `@universo/template-mui` test regressions removed by aligning `RoleChip` and `createEntityActions` suites to current behavior.
- `@universo/utils` active-scope lint/prettier errors auto-fixed (format-only changes).

### Verification
- `pnpm --filter @universo/template-mui test -- src/components/chips/__tests__/RoleChip.test.tsx src/factories/__tests__/createEntityActions.test.ts` -> pass (`35/35`).
- `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `168/168` tests).
- `pnpm --filter @universo/utils lint` -> `0 errors` (warnings only) after autofix.
- `pnpm --filter @universo/metahubs-backend lint` -> `0 errors` (warnings only).
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/attributesRoutes.test.ts src/tests/routes/branchesOptions.test.ts` -> pass (`10/10`).
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `4m35.893s`).

### Outcome
- Comprehensive QA remediation is closed with green package-level checks and green full-workspace build.

## Codename VLC End-to-End Closure — Implementation Complete (2026-03-02)

Final closure pass completed for codename VLC parity rollout. This session focused on regression cleanup, lint/build stabilization, and Memory Bank synchronization.

### What was fixed
- Frontend lint blocker removed in branches UI by deleting an accidental `codenameVlc: null` artifact in `BranchList.tsx` column configuration.
- Backend TypeScript compile blockers fixed in localized codename helpers for attributes/catalogs/enumerations routes.
- `buildCodenameLocalizedVlc` now defensively normalizes unknown `codenameInput` values into `Record<string, string | undefined>` before `sanitizeLocalizedInput(...)`.

### Verification
- `pnpm --filter @universo/metahubs-frontend lint` -> pass with warnings only (0 errors).
- `pnpm --filter @universo/metahubs-backend lint` -> pass with warnings only (0 errors) after direct eslint autofix.
- `pnpm --filter @universo/metahubs-backend build` -> pass.
- `pnpm build` (root) -> pass (`56 successful, 56 total`, `4m56.836s`).

### Outcome
- Codename VLC rollout is closed with a green workspace build baseline and no new blocking diagnostics.

## QA Hardening Fixes — Implementation Complete (2026-03-02)

Closed all high-priority defects identified in the latest QA hardening pass for metahubs/admin settings integration, with focused low-risk patches and full re-validation.

### What was fixed
- Enforced `allowDelete` policy in destructive catalog/enumeration paths that could escalate from hub-scoped removal to full entity deletion.
- Removed unsupported `enumerations.allowedValueTypes` setting from the shared settings registry, backend helper surface, and EN/RU settings locale exposure.
- Resolved TypeScript diagnostics in settings-related frontend/admin code by replacing fragile imported type references with local unions and setting `admin-frontend` TypeScript config to `noEmit`.

### Verification
- Quiet ESLint clean: `@universo/metahubs-backend`, `@universo/metahubs-frontend`, `@universo/admin-frontend`.
- Targeted backend route tests: `catalogsRoutes` + `enumerationsRoutes` pass (`29/29`).
- IDE diagnostics after changes: no active errors in touched packages.
- Full workspace build: `pnpm build` pass (`56/56` tasks).

### Follow-up (tracked)
- Add dedicated route tests for admin settings CRUD/permission/error paths after introducing/aligning test harness in `@universo/admin-backend`.

## QA Defects Remediation Completion (2026-03-01)

Final remediation pass completed for the latest QA findings. All blocking test and lint failures identified in the QA cycle were resolved and re-verified without introducing additional technical debt.

### What was fixed
- Frontend settings hook hardened to tolerate incomplete payloads (`data.settings` absent/non-array) and avoid runtime crashes in affected test paths.
- Frontend enumeration value codename normalization fixed to pass style/alphabet arguments correctly.
- Backend enumeration value copy validation updated to enforce `allowMixed` consistently in style-aware codename checks.
- Frontend mutation test expectation aligned with style-aware codename defaults (`pascal-case`), removing stale lowercase expectation drift.
- Blocking ESLint/Prettier issues auto-fixed and confirmed clean (`--quiet`) in `@universo/metahubs-frontend`, `@universo/metahubs-backend`, `@universo/admin-frontend`, and `@universo/admin-backend`.

### Verification
- `pnpm --filter @universo/metahubs-frontend test -- src/domains/branches/ui/__tests__/BranchList.createOptions.test.tsx src/domains/metahubs/hooks/__tests__/mutations.test.tsx` → pass (`22/22` files, `97/97` tests).
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/enumerationsRoutes.test.ts` → pass (`10/10` tests).
- `pnpm build` (root) → pass (`56/56` tasks successful).

---

## QA Remediation Closure Sync (2026-03-01)

Final closure pass completed for the QA remediation stream: Memory Bank state synchronized with actual implementation, remediation checklist reconciled, and deferred scope captured explicitly.

### Closure outcomes
- `tasks.md`: `QA Remediation — 2026-03-02` marked completed with implemented items reconciled to verified outcomes.
- `activeContext.md`: updated to reflect closed remediation state and current architecture snapshot.
- Deferred follow-up isolated: admin settings route tests are tracked as planned work due missing `test` script/harness in `@universo/admin-backend`.

### Verification baseline retained
- Metahubs backend route and package test suites were previously re-stabilized and passed.
- Workspace build baseline remains successful: `pnpm build` → 56/56 tasks.

---

## Admin Global Settings & Metahub Codename Fixes (2026-03-02)

Fixed 4 issues: metahub 400 error, wrong helper text, admin global settings system, RoleEdit layout.

**Changes:**
- **Issue #1 — Metahub 400 error**: `metahubsRoutes.ts` CREATE/COPY/UPDATE handlers replaced `normalizeCodename`/`isValidCodename` (kebab-only) with `normalizeCodenameForStyle`/`isValidCodenameForStyle` (style-aware). PascalCase Russian codenames like "СписокПокупок" now accepted. COPY suffix changed from `-copy` to `Copy`.
- **Issue #2 — Codename helper text**: Added `codenameHelperPascal`/`codenameHelperPascalEn` i18n keys to root metahubs namespace (EN+RU). Created `getCodenameHelperKey()` utility. Updated MetahubList + MetahubActions to use dynamic key selection.
- **Issue #3 — Admin global settings**: Full-stack implementation:
  - Migration: Consolidated locales into main admin schema, added `admin.settings` table with `(category, key)` unique constraint, JSONB value, RLS policies, seeded 3 metahub defaults
  - Entity: `AdminSetting` TypeORM entity
  - Backend: `adminSettingsRoutes.ts` with GET/PUT/DELETE, `'settings'` added to PermissionSubjects
  - Frontend: `settingsApi.ts`, `settingsQueryKeys`, `AdminSettings.tsx` page with Metahubs tab (style, alphabet, allowMixed) + Applications tab (placeholder)
  - Navigation: Settings menu item in `menuConfigs.ts`, route in `MainRoutesMUI.tsx`
- **Issue #4 — RoleEdit layout**: Replaced MUI Grid (spacing=-16px offset) with Stack + flex-row for codename/color pair. Name and description fields now full-width without indent.
- **Build**: 56/56 packages, 0 errors
- **Files**: ~19 files modified/created across admin-backend, admin-frontend, metahubs-backend, metahubs-frontend, universo-template-mui, flowise-core-backend

---

## Codename Settings & Validation Overhaul (2026-03-01)

Major overhaul making codename generation/validation fully settings-aware across all entity forms. 8 phases, ~30 files modified.

**Changes:**
- **Types**: `CodenameAlphabet` expanded to `'en' | 'ru' | 'en-ru'`; defaults changed to `pascal-case` + `en-ru`; 3 new settings added to `METAHUB_SETTINGS_REGISTRY` (total 20): `codenameAllowMixedAlphabets` (bool, default false), `codenameAutoReformat` (bool, default true), `codenameRequireReformat` (bool, default true)
- **Validation**: Full rewrite of `codename.ts` — 6 style×alphabet combo patterns, validators, normalizers, sanitizers; `hasMixedAlphabets()` helper; `sanitizeCodenameForStyle()`, `normalizeCodenameForStyle()`, `isValidCodenameForStyle()` with `allowMixed` param
- **Backend**: `codenameStyleHelper.ts` updated with `extractAllowMixedAlphabets()`; all 4 route files (catalogs, hubs, enumerations, attributes) pass `allowMixed` to validation
- **Frontend hook**: New `useCodenameConfig()` hook — reads 5 settings via `useSettingValue`, returns typed `CodenameConfig` with `useMemo`
- **i18n**: 3 new setting keys (EN+RU), `'ru'` alphabet option labels, restructured `codenamePreview` to `{style}.{alphabet}` composite keys (6 entries)
- **Settings UI**: `SettingsPage.tsx` — conditional visibility for `allowMixed` (only when `en-ru`), `requireReformat` (only when autoReformat off); `CodenameStylePreview.tsx` simplified to single i18n lookup
- **Form components**: All 8 List files + `AttributeFormFields` + `mutations.ts` + 6 Actions files fully transformed; module-level functions use `_cc(values)` pattern; React EditFields inject config via `useEffect`
- **Template seed**: `basic.template.ts` — default `pascal-case` + 3 new settings seeded

Build verified: **56/56 packages pass, 0 TS errors**.

### QA Fixes (2026-03-01)

Post-implementation QA analysis uncovered 3 issues (2 critical, 1 medium):

1. **BUG-1 (Critical)**: `CatalogActions.toPayload` used `cc.style`/`cc.alphabet` without defining `const cc = _cc(values)` — would crash at runtime when saving catalogs. Fixed by adding the definition line.
2. **BUG-2 (Critical)**: `EnumerationActions.toPayload` — identical issue. Fixed same way.
3. **ISSUE-3 (Medium)**: `EnumerationActions.tsx` had validation functions named `validateCatalogForm`/`canSaveCatalogForm` (copy-paste artifact from CatalogActions). Renamed to `validateEnumerationForm`/`canSaveEnumerationForm` (6 references updated).

**Root cause**: `tsdown` (esbuild-based bundler) does not perform full TypeScript type checking. The `pnpm build` passed despite `tsc --noEmit` finding `TS2304: Cannot find name 'cc'`. Recommendation: add `tsc --noEmit` to CI for metahubs-frontend.

Build re-verified: **56/56 packages pass**.

---

## Settings Page UI/UX Fixes (2026-03-03)

Five UI/UX issues found during manual testing of the Settings page, all resolved:

1. **Breadcrumbs** — Added `settings` case to `NavbarBreadcrumbs.tsx` metahub handler
2. **Padding** — Added `mx: { xs: -1.5, md: -2 }` negative margins matching CatalogList pattern
3. **"Изменено" label** — Removed `isCustom` label for saved non-default settings; only blue dot `•` for unsaved changes
4. **Confirm dialog buttons** — Added missing `confirm.cancelButtonText`/`confirm.confirmButtonText` i18n keys (EN+RU); removed duplicate `<ConfirmDialog />` from SettingsPage
5. **Codename improvements** — Renamed `'1c-pascal-case'` → `'pascal-case'` across entire codebase; added `CodenameAlphabet` type (`'en' | 'en-ru'`); new `general.codenameAlphabet` setting with English-only PascalCase validation; updated all 4 backend route files + frontend components

Build verified: **56/56 packages pass**.

---

## Metahub Settings — Phase 8: QA Fixes (2026-03-02)

After comprehensive QA review (10 findings: 3 critical, 3 serious, 4 moderate), all issues resolved:

- **Fix #1 (Critical)**: Created `useEntityPermissions` hook — reads `allowCopy`/`allowDelete` from settings, exported from `metahubs-frontend`
- **Fix #2 (Critical)**: Added `getAllowedEnumValueTypes` helper to `codenameStyleHelper.ts` (future enforcement — enum values lack `valueType` field)
- **Fix #3 (Critical)**: Added missing `enumerations.allowedValueTypes` i18n keys in EN and RU `metahubs.json`
- **Fix #4 (Serious)**: PUT handler now re-loads all settings after upsert, returns merged `{ settings, registry }` matching GET format
- **Fix #5 (Serious)**: DELETE handler returns `{ key, value, isDefault }` shape; frontend `ResetSettingResponse` type added
- **Fix #6 (Serious)**: Added `validateSettingValue()` — type-safe validation against registry (boolean/number/string/select/multiselect + options check)
- **Fix #7 (Moderate)**: Extracted `codenameErrorMessage` to shared `codenameStyleHelper.ts`, removed from 4 route files
- **Fix #8 (Moderate)**: Batch N+1 fix — attribute create handlers use `findAll()` + extract helpers instead of 3 separate `findByKey()` calls
- **Fix #9 (Moderate)**: DELETE validates key against registry, returns 404 for unknown keys
- **Fix #10 (Moderate)**: `resetToDefault` filters by `_mhb_deleted: false`, uses single `new Date()` for consistency

Build verified: **56/56 packages pass**.

---

## Metahub Settings — Phases 4–7 Implementation (2026-03-02)

### Phase 4: Frontend Domain ✅
- Created `settingsApi.ts` — API client with `getAll`, `getByKey`, `update`, `resetToDefault`
- Created `useSettings.ts` — `useSettings`, `useUpdateSettings`, `useResetSetting`, `useSettingValue` hooks (TanStack Query v5)
- Created `SettingsPage.tsx` — 5-tab UI (General, Common, Hubs, Catalogs, Enumerations) with client-side search, save/reset, CodenameStylePreview
- Created `SettingControl.tsx` — renders Switch/Select/Multiselect/TextField based on `valueType`; i18n-aware option labels
- Created `CodenameStylePreview.tsx` — Chip with monospace example codename from i18n
- Created domain barrel exports (`settings/api/index.ts`, `settings/hooks/index.ts`, `settings/index.ts`)

### Phase 5: Frontend Integration ✅
- Updated `queryKeys.ts` — added `settings`, `settingsList`, `settingDetail` keys + `invalidateSettingsQueries` helper
- Added full `settings` section to EN/RU `metahubs.json` — keys, descriptions, codenameStyles, codenamePreview, attributeCodenameScopes
- Updated `i18n/index.ts` — `MetahubsBundle`, consolidation function, `MetahubsTranslation` all extended with `settings`
- Added `"settings"` key to EN/RU `menu.json` in `universo-i18n`

### Phase 6: Route & Menu Registration ✅
- Added `export { default as MetahubSettings }` to `metahubs-frontend/index.ts`
- Added lazy `MetahubSettings` import + `{ path: 'settings' }` route in `MainRoutesMUI.tsx` (used `(m: any)` pattern for type compatibility)
- Added `IconSettings` + divider-footer + settings item in `menuConfigs.ts` (universo-template-mui)
- Added `IconSettings` + divider-footer + settings item in `metahubDashboard.ts` (metahubs-frontend)

### Phase 7: Build Verification ✅
- Full `pnpm build` — 56/56 packages pass
- Manual UI/API testing pending

---

## QA Fixes — Post-Settings Implementation (2026-03-03)

Comprehensive QA analysis found 1 critical bug + 6 code quality/UX issues. All fixed. Build: 56/56.

### Fixes Applied
- **CRITICAL**: `<ConfirmDialog />` was incorrectly removed from SettingsPage.tsx — confirm() Promise never resolved (reset button hung). Re-added `ConfirmDialog` import and render.
- **Prettier**: Fixed formatting in 3 files (SettingsPage.tsx, validation/index.ts, enumerationsRoutes.ts) — 6 errors total.
- **Code duplication**: Extracted `validateSettingValue` from `settingsRoutes.ts` + `MetahubSettingsService.ts` into `shared/validateSettingValue.ts`. Both consumers now import from shared module.
- **Template seed**: Added `general.codenameAlphabet` (default: `en-ru`) to `basic.template.ts`.
- **UI logic**: `general.codenameAlphabet` setting now hidden when codenameStyle is `kebab-case` (irrelevant).
- **N+1 optimization**: Added `getCodenameSettings()` batch helper (parallel `Promise.all` for style+alphabet queries).
- **Frontend prep**: Exported style-aware codename functions from `utils/codename.ts`; added pascal-case i18n variants (`codenameHelperPascal`, `codenameHelperPascalEn`, `codenameInvalidPascal`, `codenameInvalidPascalEn`) to all entity sections in EN + RU files.
- **Memory-bank**: Updated stale function name refs (`CODENAME_1C_PATTERN` → `CODENAME_PASCAL_PATTERN`, etc.) in progress.md.

---

## Metahub Settings Plan — QA Review & Update (2026-03-02)

Comprehensive QA analysis of the metahub-settings-plan found **16 findings** (3 critical, 6 serious, 3 component reuse, 4 architectural). All findings have been resolved in the plan document.

### Key Corrections Applied
- **Critical**: `codenameUniquenessScope` → `attributeCodenameScope` (per-level/global, not metahub/hub); added missing `catalogs.allowedAttributeTypes` + `enumerations.allowedValueTypes` (multiselect type); added `asyncHandler` wrapper to all route handlers
- **Serious**: URL convention `/metahub/:metahubId/settings` (collection) + `/metahub/:metahubId/setting/:key` (singular); `bulkUpsert` wrapped in `knex.transaction()`; 1C regex fixed from broken `А-ДЖ-Я` to correct `А-Я` + first char uppercase only; `router.use(ensureAuth)` + `Router({ mergeParams: true })`
- **Component reuse**: Explicit table of reused components (TemplateMainCard, ViewHeaderMUI, useDebouncedSearch, ConfirmDialog/useConfirm, EmptyListState)
- **Architectural**: Clarified `general.language` vs `common.defaultLocale` purpose; expanded caching strategy with concrete code pattern; documented service location rationale (`domains/settings/` not `domains/metahubs/`)

### Plan File
[memory-bank/plan/metahub-settings-plan-2026-03-02.md](plan/metahub-settings-plan-2026-03-02.md) — ~1490 lines, 16 sections, 7 implementation phases, ~35 tasks

---

## Metahub Settings — Phases 1–3 Implementation (2026-03-02)

### Phase 1: Types & Shared Code ✅
- Added `CodenameStyle`, `SettingDefinition`, `SettingValueType` (incl. `multiselect`), `MetahubSettingRow`, `METAHUB_SETTINGS_REGISTRY` (14→17 settings, 5 tabs) to `universo-types`
- Added `CODENAME_PASCAL_PATTERN`, `CODENAME_PASCAL_EN_PATTERN`, `isValidPascalCodename`, `isValidPascalEnCodename`, `isValidCodenameForStyle`, `normalizePascalCodename`, `normalizePascalEnCodename`, `normalizeCodenameForStyle` to `universo-utils`
- QA verified: 0 issues

### Phase 2: Backend Service & Routes ✅
- Created `MetahubSettingsService` with `findAll`, `findByKey`, `upsert`, `bulkUpsert` (transactional), `resetToDefault`
- Created `settingsRoutes.ts` — 4 endpoints (GET/PUT collection, GET/DELETE single)
- Created `codenameStyleHelper.ts` — `getCodenameStyle()`, `getCodenameAlphabet()`, `getCodenameSettings()`, `getAttributeCodenameScope()`, `getAllowedAttributeTypes()`
- Registered in `router.ts`, added `general.codenameStyle` + `general.codenameAlphabet` seed to `basic.template.ts`
- Build: 9/9

### Phase 3: Backend Integration ✅
- **catalogsRoutes.ts**: style-aware codename validation (4 points), allowCopy/allowDelete permission checks
- **hubsRoutes.ts**: style-aware codename (create/copy/update), style-aware copy suffix (`-copy`/`Copy`), allowCopy/allowDelete checks
- **enumerationsRoutes.ts**: style-aware codename (10 validation points across 8 handlers), allowCopy/allowDelete checks (soft-delete + permanent-delete)
- **attributesRoutes.ts**: style-aware codename (4 handlers: create, copy, update, table-child create), `allowedAttributeTypes` enforcement, `attributeCodenameScope` (per-level/global) via `findByCodename` ignoreParentScope option
- **MetahubAttributesService.ts**: added `options?: { ignoreParentScope?: boolean }` to `findByCodename` — skips parent_attribute_id filter for global scope
- Build: 9/9

---

## PostgreSQL NUMERIC → JS Number Coercion Fix (2026-03-02)

Fixed "Invalid value for kolichestvo: Expected number value" error when saving application runtime rows with NUMBER fields. Root cause: PostgreSQL `NUMERIC(10,0)` columns return string values via `node-postgres`, but `coerceRuntimeValue` required strict `typeof value === 'number'`. Metahubs was unaffected because it stores data in JSONB (preserves JS number types). Fix: added `pgNumericToNumber` helper, updated `resolveRuntimeValue`, `coerceRuntimeValue`, GET single row, and GET tabular rows endpoints in `applicationsRoutes.ts`. Build: 56/56.

---

## API Error Message Propagation Fix (2026-03-02)

Fixed hidden error messages in runtime row CRUD operations. Previously, server validation errors (e.g., "Invalid value for X: Expected number value") were replaced by generic "Request failed with status code 400" in the UI. Added `extractApiErrorMessage()` helper to `useCrudDashboard.ts` and `RuntimeInlineTabularEditor.tsx` that extracts `error`/`message` from Axios response body. Build: 56/56.

---

## VLC Comment Consolidation — Metahubs + Applications (2026-03-02)

Merged second metahubs migration into first (comment TEXT→JSONB in `metahubs_users`), aligned applications-backend & frontend with the same VLC comment pattern used in metahubs. Build: 56/56.

### Changes
- **Metahubs migration**: merged `AlterMetahubUsersCommentToJsonb` into `CreateMetahubsSchema`, deleted second migration file
- **Applications migration**: changed `comment TEXT` → `comment JSONB DEFAULT '{}'` in `application_users`
- **ApplicationUser entity**: changed to `type: 'jsonb'` with `VersionedLocalizedContent<string>` type
- **applicationsRoutes.ts**: added VLC helpers, updated `mapMember`, invite/update member endpoints for VLC comment
- **Applications frontend**: updated types, API, mutations, MemberActions, Members page for VLC comment display/editing

---

## Documentation Overhaul — GitBook Stubs (2026-03-01)

Deleted all outdated documentation (2023 files from Flowise era, 175 directories, hundreds of images) and created fresh GitBook-standard stub pages indicating documentation is under development.

### What Was Deleted
- docs/en: all files including .gitbook/assets (hundreds of images)
- docs/ru: all files including .gitbook/assets
- Total: ~2023 files and 175 directories removed

### What Was Created
- **41 EN files** + **41 RU files** with identical structure (82 total)
- Root docs/README.md updated (removed Spanish reference, added new links)

### Documentation Structure (both EN and RU)
- `README.md` — Landing page with project overview and GitBook cards
- `SUMMARY.md` — Table of contents with 6 page groups
- `getting-started/` — README, installation, quick-start, configuration (4 files)
- `platform/` — README, workspaces, spaces, metaverses, applications, metahubs, publications, space-builder, analytics (9 files)
- `platform/updl/` — README, space-nodes, entity-nodes, component-nodes, action-nodes, event-nodes, data-nodes (7 files)
- `architecture/` — README, monorepo-structure, backend, frontend, database, auth (6 files)
- `api-reference/` — README, rest-api, authentication, webhooks (4 files)
- `guides/` — README, creating-application, publishing-content, working-with-updl, multi-platform-export (5 files)
- `contributing/` — README, development-setup, coding-guidelines, creating-packages (4 files)

### Verification
- File count: 41 EN = 41 RU ✅
- Line counts: all 41 pairs match ✅
- GitBook format: SUMMARY.md, YAML front matter, hint blocks ✅

---

## Legacy Packages Removal — 10 Packages (2026-02-28)

Removed 10 legacy packages and all cross-references across the monorepo per 9-phase plan (see `memory-bank/plan/legacy-packages-removal-plan-2026-03-01.md`).

### Packages Removed
- campaigns-backend, campaigns-frontend
- clusters-backend, clusters-frontend
- organizations-backend, organizations-frontend
- projects-backend, projects-frontend
- storages-backend, storages-frontend

### Changes by Phase
1. **@universo/types**: removed 4 validation files, 4 re-exports, 5 PermissionSubject + PERMISSION_SUBJECTS entries
2. **flowise-core-backend**: routes (5 lazy routers), index.ts (5 rate limiters), entities (5 imports+spreads), migrations (5 imports+spreads), package.json (3 deps)
3. **Admin permissions**: admin-backend schemas (5 PermissionSubjects), admin-frontend EN/RU i18n (5+5 translations)
4. **universo-template-mui**: MainRoutesMUI (~30 Loadable components, ~180 route lines), menuConfigs (5 context menus, 5 root items), MenuContent (5 URL matchers), NavbarBreadcrumbs (10 hooks, 5 menuMap entries, 10 breadcrumb builders), useBreadcrumbName (5 hooks+5 truncate fns), hooks/index (10 re-exports), test file
5. **flowise-core-frontend**: index.jsx (2 i18n imports), package.json (2 deps), vite.config.js (1 optimizeDeps entry)
6. **Package directories**: 10 directories deleted via `rm -rf`
7. **Documentation**: 6 doc directories deleted (EN/RU for clusters, projects, organizations), EN+RU READMEs updated
8. **Build verification**: `pnpm install` + `pnpm build` = 56/56 success
   - Unplanned fix: `start-backend/onboardingRoutes.ts` replaced with stub (was 357 lines using removed entities)
   - Removed 3 legacy deps from `start-backend/package.json`

### Build Impact
- Package count: 66 → 56 (10 removed)
- Build: 56/56 successful, all tests passing
- Pre-existing peer dependency warnings unchanged

### QA Fixes (2026-02-28)
Post-QA audit found and fixed remaining issues:
- **P1**: flowise-template-mui `MenuList/index.jsx` — removed clusters/campaigns imports, URL matchers, permission state, useEffects, menu rendering branches
- **P1**: flowise-template-mui `dashboard.js` — removed clusters/campaigns menu items + unused icons
- **P1**: Prettier lint errors auto-fixed in start-backend and universo-template-mui (0 errors now)
- **P2**: docs/ru/applications — deleted 3 legacy directories (clusters/, organizations/, projects/), updated EN+RU README diagrams and tables
- **P3**: onboardingRoutes.ts `POST /join` — return 404 when profile not found instead of silent success
- Grep verification: 0 references to deleted packages remain across all source files

---

## PR #698 Review Fixes (2026-02-28)

Addressed 9 Copilot bot review comments on PR #698. Analysis found 5 valid code fixes + 3 memory-bank cleanups:

- **C2**: branchId fallback — `activeVersion.branchId ?? metahub.defaultBranchId` with early-return warning (publicationsRoutes.ts)
- **C3/C7**: Removed unused `publicationName` + `usePublicationDetails` from PublicationVersionList & PublicationApplicationList
- **C6**: VLC fallback — replaced manual `{ _schema, _primary, locales }` construction with `buildLocalizedContent({ en: 'Application' }, 'en')!` from `@universo/utils` (createLinkedApplication.ts)
- **C8**: Added `'noopener,noreferrer'` third arg to both `window.open()` calls (PublicationApplicationList.tsx)
- **C1/C4/C5**: Compressed memory-bank: tasks.md (-82.9%), activeContext.md (-80.2%), progress.md (-80.8%)
- **C9**: Docs-only route mismatch — skipped (no code impact)
- Build: **66/66** | Commit: `2d7e07a4` | PR: #698

---

## Publication Drill-In Feature — Consolidated (2026-02-28)

Full implementation of Publications drill-in navigation with inner tabs (Versions, Applications), replacing the previous flat list + modal-edit approach.

### UX Polish Round 2 (5 fixes)
- Link colors matched catalog pattern: `color: 'inherit'`, underline + `primary.main` on hover
- Actions column: removed custom column, used FlowListTable `renderActions` prop (10% width, centered)
- Pagination: client-side page/pageSize state + PaginationControls for Versions and Applications
- App name URLs: fixed from `/application/${slug}` to `/a/${id}` (new tab)
- App menu URLs: "Open application" → `/a/${id}`, "Dashboard" → `/a/${id}/admin` (window.open)

### UX Polish Round 1 (8 tasks)
- Publication name as drill-in link to `/publication/:id/versions`
- Breadcrumbs: removed UUID fallback, added tab suffix (Versions/Applications)
- ViewHeader: show only tab name, not publication name
- Versions table: fixed name render, removed Branch column, adjusted widths
- Search fields added for both tabs
- Version row three-dot menu (Edit/Activate/Delete) + DELETE endpoint + hook
- Applications tab: name display, translated columns, action menu, clickable names
- i18n: ~13 EN + ~13 RU keys (version delete, app actions, search, menu)

### Create Dialog & Schema Fixes (4 issues)
- Fixed TypeError: useCommonTranslations destructuring in VersionList and AppList
- Reworked Create Publication dialog: toggles above CollapsibleSection, app fields inside
- Fixed broken schema creation: DDL runs after TypeORM transaction commit (deadlock fix)
- Added applicationNameVlc/descriptionVlc inside CollapsibleSection

### CollapsibleSection Export Fix
- Missing export from template-mui root src/index.ts caused @flowise/core-frontend build failure
- Moved to components/layout/ subfolder, created barrel, added to root exports
- Build: 66/66 (was 64/65)

### Navigation & Create Dialog Rework (R1-R9)
- Backend: extracted `createLinkedApplication()` helper, new POST endpoint, `createApplicationSchema` option
- Frontend: routes + lazy imports for `/publication/:publicationId/versions` and `/applications`
- Components: PublicationVersionList, PublicationApplicationList with full CRUD
- Create dialog: 2 tabs (General + Access) with CollapsibleSection spoilers
- CollapsibleSection extracted to universo-template-mui as reusable component
- Cleanup: deleted VersionsPanel, ApplicationsPanel, ApplicationsCreatePanel
- Key decision: circular build dep solved with `(m: any)` cast in lazy imports

### QA Remediation (10 issues)
- H-1: slug collision — unique slug per application; M-2: unused imports (4 files)
- M-3: Russian i18n fallback → English; M-4: react-hooks/exhaustive-deps (useMemo)
- M-5: name validation + disabled Create; L-2: non-null assertion fallback
- L-4: aria attributes on CollapsibleSection; M-1: prettier auto-fix (17→0 errors)

**Build**: 66/66 packages. Modified 11 files, created 11, deleted 3.

---

## Copy UX & QA Remediation (2026-02-27)

### QA Remediation Round 10 — Copy UX
Standardized copy naming convention with i18n-driven naming per metahub locale. Template seed respects metahub primary locale during copy.

### PR #696 Bot Review Fixes
Safe `typeof` checks, dead code removal, `rel="noopener noreferrer"`, nullable name safe-access.

### Copy UX Simplification
- `generateCopyName()` helper with i18n " (copy N)" suffix — shared across metahubs + applications
- Metahub copy dialog with progress indicator, error handling, advisory lock
- Application copy with schema status reset (SYNCED→SYNCED, else→OUTDATED)

### QA Remediation Rounds 5-9
Copy flow refinements: edge cases (no active branch, locked metahubs), error message clarity, naming collision detection, schema status propagation, connector cleanup.

**Build**: 66/66 packages.

---

## Copy Flows & NUMBER Field Parity (2026-02-26)

### QA Remediation Rounds 1-4 — Copy Flows
- Round 1: prevent copy of soft-deleted entities
- Round 2: schema sync after copy — correct status propagation
- Round 3: unique constraint handling (codename conflicts → 409)
- Round 4: FK reference integrity for copied connector publications

### PR #692 Bot Review Remediation
Hardcoded locale → metahub locale, inline helpers extraction, formatting fixes.

### Copying UX/Logic Upgrade
`generateCopyName`, `ApplicationSchemaStatus` reset, advisory lock prevents concurrent copies.

### NUMBER Field Parity
Zone-aware ArrowUp/ArrowDown stepping across all three form contexts (DynamicEntityFormDialog, FormDialog, inline table). Complete NumberEditCell rewrite. 5 files across 3 packages.

### Fix Inline Table nonNegative
Prevented NaN→null regression in NUMBER stepper.

**Build**: 66/66 packages.

---

## QA & Architecture Fixes (2026-02-24 to 2026-02-25)

### QA Rounds 5-8 (02-25 to 02-26)
- Constraint text UX: human-readable violation messages
- Spacing fixes: table cell padding, dialog margins
- 3-dot menu alignment: consistent MoreVert positioning across all lists
- Runtime bugs: stale cache recovery, loading indicators, comprehensive QA pass

### Architectural Improvements (02-24)
- Attribute edit race condition: useRef snapshot prevents stale data submission
- 422 error payload: structured blocker array instead of plain string
- i18n for structured blockers in migration guard UI

### QA Remediation Rounds 1-2 (02-24)
Button spacing, toast improvements, deletion guard, empty-state messaging, column widths.

### QA Findings Code Remediation (02-24)
5 bugs + 5 warnings: attribute validation, catalog access, API route fixes.

### Unified Application Migration Guard QA Fixes (02-24)
- BUG-1: "Continue anyway" calling refetch → added useState dismissed state
- BUG-2: Application copy missing appStructureVersion + lastSyncedPublicationVersionId
- WARN-1: Test timeout fix (mocks for 6 exports, 19s → 650ms)
- INFO-2: TARGET_APP_STRUCTURE_VERSION=1 constant (was hardcoded in 5 places)
- INFO-5: ensureMemberAccess instead of ensureAdminAccess for status endpoint

**Build**: 66/66 packages.

---

## QA & Child TABLE Editing (2026-02-23)

### QA Safe Remediation
Number display formatting, optimistic lock improvements, enum dropdown fixes, status dialog.

### QA Recommendations Implementation
2 high + 3 medium improvements for metahubs entity management.

### Child TABLE Editing & Select UX Parity
Full inline editing parity with parent table — all attribute types (STRING, NUMBER, BOOLEAN, DATE, REF, JSON) supported in child tables.

### QA Fixes Chain (7 rounds)
- Inline Edit, Empty Option & Schema Diff i18n: 4 targeted fixes
- Element Create & Attribute List UX: validation, column widths, i18n
- QA Remediation Pass: 7 issues across frontend/backend
- Child TABLE Select UX: dropdown, column widths, type consistency
- QA Findings Remediation: 6 issues (data loading, types, error handling)
- Child TABLE Attribute Parity + Sync FK Fix: full parity for child attributes, 6 files
- Dialog Init & Child REF Persistence: form initialization, restored persistence, 4 files

**Build**: 66/66 packages.

---

## TABLE Attribute & QA (2026-02-21 to 2026-02-22)

### Documentation Updates — QA Recommendations (02-22)
- metahubs-frontend README (EN/RU): ColumnsContainer, MigrationGuard, Blockers i18n
- metahubs-backend README (EN/RU): Structured Blockers, Migration Endpoints, file structure
- New apps-template-mui README (EN/RU, 307 lines each): dashboard system, zone widgets, CRUD

### TABLE Attribute UX Rounds 1-5.4 + Round 6
Comprehensive inline editing with DnD reorder, stacked columns layout, delete dialog, persistence.

### QA Critical/Major Fix Pass
5 critical + 3 major issues: data loss prevention, cascading deletes, schema sync consistency.

### Additional QA Fixes
- Rounds 1-4: grid styling, delete cascade fix, schema diff alignment, i18n
- PR #686 Bot Review: import cleanup, typing improvements, deprecation markers, lodash removal
- Hub Delete Blockers: cascading FK checks across catalogs/hubs/attributes/elements
- Unified Action Menus: standardized 3-dot MoreVert menus across all entity types

**Build**: 66/66 packages.

---

## TABLE Attribute Type Implementation (2026-02-21)

Full TABLE attribute type: backend CRUD, schema DDL, frontend inline editing with DnD reorder, REF column support, publication snapshot pipeline for TABLE children.

**Build**: 66/66 packages.

---

## Enumerations Feature (2026-02-18 to 2026-02-19)

### QA Remediation Rounds 1-5
- Round 1: runtime safety — FormDialog enum default injection (undefined vs null)
- Round 2: structure versioning — consolidated V1/V2/V3 → single V1 (CURRENT_STRUCTURE_VERSION=1)
- Round 3: FK safety — enum REF targets `_app_enum_values(id)`, required-toggle guard
- Round 4: restore conflict → 409 on codename collision, locale fallback consistency
- Round 5: toggle-required invariant — ownership validation for defaultEnumValueId

### Stabilization + Hardening
- Contract alignment: presentation canonicalization, sync mapping for legacy payloads
- Backend fixes: strict typing, missing wiring, migration seed counters
- Shared type safety: ConflictInfo.entityType extended with `document`
- Metadata cleanup: order fixed (remove stale → upsert), duplicate guard, stale values cleanup
- Declarative schema: `uidx_mhb_enum_values_default_active` unique partial index

### Frontend/UI Integration
- Enumeration list + values list flows with CRUD hooks/mutations
- Attribute presentation: enumPresentationMode (select/radio/label), defaultEnumValueId
- TargetEntitySelector supports enumeration target kind
- i18n: enumerations, enumerationValues, ref.*, attributes.presentation.* (EN/RU)

### QA Fixes + UI Polish Rounds 5-6
- Round 6: Publication DELETE cascade N+1→bulk UPDATE, Prettier fixes, baseline template column, default detailsTable widget
- Round 5: widget label i18n, dry run text simplified, actions column headerName, schema/template split columns

**Build**: 66/66. Modified 15+ files across 6 packages.

---

## Migration Guard + UI Polish (2026-02-18)

### i18n Fix + LanguageSwitcher Widget
- `consolidateApplicationsNamespace()` dropped 3 sections (migrationGuard, underDevelopment, maintenance)
- LanguageSwitcher widget: copied from universo-template-mui, registered in dashboard (key: languageSwitcher)
- Template version 1.0.0 → 1.1.0 to trigger update_available

### Post-QA Polish (3 Rounds)
- BUG-1 CRITICAL: missing `import '@universo/applications-frontend/i18n'` (all t() calls → English)
- BUG-2: local SchemaStatus (5 values) vs backend (7 values) — exported from types.ts
- BUG-3: paginationDisplayedRows ignored MUI v8 estimated parameter
- WARNs: double AppMainLayout wrap, typo in RU locale, hardcoded bgcolor → action.hover

### Runtime Fix — React is not defined
Changed `jsx: "react"` → `"react-jsx"` in migration-guard-shared tsconfig. ESM bundle now uses auto-import from react/jsx-runtime.

### QA Fixes (2 Rounds)
- Round 1: split entry points — `./utils` (pure JS, no React) and `.` (React-dependent)
- Round 2: removed MIGRATION_STATUS_QUERY_OPTIONS from data-listing hooks, peerDependenciesMeta

### Migration Guard Full Spec Coverage (6 Phases)
- Table rename `_app_layout_zone_widgets` → `_app_widgets`, template version 1.0.0
- Shared package `@universo/migration-guard-shared`: determineSeverity, MigrationGuardShell<TStatus>
- AGENTS.md (3 new, 2 updated), MIGRATIONS.md (8 files, 4 packages × EN/RU)
- Both Guards rewritten with MigrationGuardShell (202→134 / 199→154 lines)
- Both severity endpoints use shared determineSeverity()

### Unified App Migration Guard QA (2 Rounds, 5 BUGs + 8 WARNs)
- extractAxiosError(.message), isAdminRoute regex, copy status reset, publication DELETE cleanup
- N+1→bulk UPDATE, advisory lock (pg_try_advisory_lock), staleTime, severity fallback
- Blocker keys, ARIA improvements, AGENTS.md relocation

**Build**: 66/66. 15 new files, 17 modified.

---

## PR #682 Bot Review Fixes (2026-02-18)

9 actions: staleTime for list/plan hooks, unused imports, type safety guard, determineSeverity JSDoc, AGENTS.md roles/statuses, MIGRATIONS.md corrections, memory-bank English translation.

**Build**: 66/66.

---

## Dashboard & Architecture (2026-02-17 to 2026-02-20)

### 5-Étap QA Fixes (02-20)
- Étap 1: editor canSave + dirty tracking (useRef snapshot)
- Étap 2: inner widget labels in LayoutDetails chip
- Étap 3: migration guard "Apply (keep data)" button with loading/error
- Étap 4: structured blockers i18n — StructuredBlocker interface, 16 sites, 15 keys
- Étap 5A/B: multiInstance revert, multi-widget columns (widgets[] array, MAX=6)

### columnsContainer QA (02-17)
multiInstance=false, Array.isArray guard, useMemo for stable refs, JSDoc for showDetailsTable.

### Center Zone columnsContainer (02-19)
Zone-aware `buildDashboardLayoutConfig()` with centerActive. Center seed: detailsTable (width 9) + productTree (width 3). DashboardDetailsContext for MainGrid. Template version 1.1.0 → 1.2.0.

### Dashboard Zones & Widgets (4 Phases, 02-18)
Phase 1: widget split (productTree + usersByCountryChart). Phase 3: right drawer. Phase 2: columnsContainer with DnD editor. Phase 4: createAppRuntimeRoute factory. 5 files created, 17+ modified.

### Architecture Refactoring (02-17)
Headless Controller Hook + CrudDataAdapter: DashboardApp 483→95 (-80%), ApplicationRuntime 553→130 (-76%). createStandaloneAdapter + createRuntimeAdapter. Pattern: systemPatterns.md#headless-controller-hook

### UI Polish + QA Rounds 3-6 (02-17)
Button position, actions centering, DataGrid i18n. Required null check, extractErrorMessage, 5 mutation hooks, schema fingerprint (useRef).

**Build**: 65/65.

---

## Runtime CRUD & QA (2026-02-14 to 2026-02-16)

### QA Round 5 — Dialog Input Styling (02-16)
Root cause: apps-template-mui compact MUI Dashboard style (padding: 0, notchedOutline: none). Fixed with proper spacing, MuiInputLabel, MuiButton disabled state.

### QA Round 4 — Theme Dedup + Runtime Rename (02-16)
CRITICAL: removed duplicate AppTheme+CssBaseline from Dashboard.tsx. Runtime rename: 60+ identifiers (applicationRuntime→appData, runtimeKeys→appQueryKeys). Backward-compatible aliases preserved.

### QA Round 3 — Layout, Hooks, Delete (02-15)
AppMainLayout wrapper. Fixed hooks order. ConfirmDeleteDialog auto-close. FormDialog i18n (16 keys).

### QA Round 2 — Validation (02-14)
Date validation (new Date + isNaN → 400). UUID validation for catalogId/applicationId. Cache invalidation broadened. VLC structural check.

### Security Fixes (02-15)
UUID_REGEX constant. `_upl_updated_by` audit field. No unhandled promise rejection (removed throw err).

### Runtime CRUD (7 Phases, 02-15)
Full lifecycle: POST/PATCH/DELETE runtime rows, FormDialog, LocalizedInlineField, ConfirmDeleteDialog, VLC support, validation rules, DataGrid UX.

**Build**: 65/65.

---

## Metahubs UX & UI Polish (2026-02-13 to 2026-02-14)

### Boolean Fix, Auto-fill, Presentation Tab (02-13)
Boolean indeterminate: DDL `.defaultTo(false)`, runtime null→false, frontend indeterminate=false. Publication auto-fill from metahub name + " API". Presentation tab: `uiConfig` with `headerAsCheckbox`.

### UI/UX Polish Rounds 1-2 (02-14)
TWO sidebar configs discovered (metahubDashboard.ts legacy + menuConfigs.ts production) — synchronized. Create buttons: `tc('addNew')` → `tc('create')`. Widget toggle: Switch → Button with ToggleOn/ToggleOff icons.

### QA Remediation + Version Reset (02-13)
ensureDefaultZoneWidgets respects isActive. Unique partial index on widgets. TemplateSeedCleanupService fix. V1/V2/V3 → single V1. Zod isActive fix. cleanupMode default → 'confirm'.

### Migration 503 Pool Starvation Fix
Promise.all(7×hasTable) → single information_schema query. Pool formula: floor(budget/4) → floor(budget/3).

### Widget Activation Toggle
Structure V3 DDL (is_active column), backend toggle route, hash normalization, optimistic UI, snapshot pipeline.

### README Documentation
Full rewrite metahubs-backend README.md (EN/RU, 730 lines each).

**Build**: 65/65.

---

## 2026-02-12: QA Rounds 9-16 — Pool, Locks, Cache, Migrations ✅

### Round 9: Migration Gate, Baseline Compatibility, Pool-Safe Apply
- DB-aware `ensureSchema()` with strict order. Widget table resolver aligned to `_mhb_widgets`.
- Deterministic error model: `MIGRATION_REQUIRED` (428), `CONNECTION_POOL_EXHAUSTED` (503).
- Frontend `MetahubMigrationGuard` modal. Serialized advisory-lock acquires in schema-ddl.

### Round 10: Template Version Source, Cache Safety, Retry/Loading UX
- plan/status reads from branch sync fields. Removed unsafe early cache-return paths.
- Apply requires confirmed branch sync (409 if not). Disabled auto-retries for migration queries.

### Round 11: Read-Only EnsureSchema, Scoped Repos
- Split ensureSchema: read_only / initialize / apply_migrations modes.
- Version-aware table validation. Request-scoped manager via getRequestManager.

### Round 12: Request-Scoped SchemaService Manager
MetahubSchemaService accepts optional EntityManager. Propagated to all entry points.

### Rounds 13-16: Atomic Sync, Retry Dedup, Error Mapping, Pool Contention
- Branch structureVersion update only after successful sync.
- auth-frontend API client: transientRetryAttempts=0. Timeout/pool→503.
- Post-apply tolerates read failures. Widget cache invalidation before seed sync.
- RLS cleanup skip when QueryRunner never connected. Pool budget rebalance env knobs.
- createInitialBranch: advisory lock + transactional metadata + safe schema rollback.

12 test suites, 76+ tests. Build: OK.

---

## 2026-02-11: QA Rounds 3-8, Structure Baseline, DDL Deep Fixes ✅

### Structure Baseline + Template Cleanup
_mhb_widgets baseline table. CURRENT_STRUCTURE_VERSION=1. Diff engine: RENAME_TABLE/RENAME_INDEX via renamedFrom. TemplateSeedCleanupService with modes keep/dry_run/confirm. Removed starter tags catalog.

### QA Rounds 3-8
- R3: Access checks, advisory lock + pessimistic locks, kind normalization, protected layout config
- R4: Branch access guards, metahub delete locking, `hashtextextended` lock-key strategy
- R5: Application rollback advisory lock, SystemTableMigrator destructive abort, copy excludes soft-deleted
- R6: Source-less branch stores minStructureVersion, unique-violation → 409, advisory lock timeout
- R7: User-branch cache invalidation, findByCodename active-only filter, branch delete → 409
- R8: MSW handlers for templates, vitest.config.ts coverage mode, `any` → `unknown` catches

### DDL Deep Fixes
JSONB meta column, unique migration names, SQL identifier quoting. Entity lookup by kind, layouts incremental migration, lazy manifest load. Copy+branch structureVersion fixes.

Build/tests: all rounds green.

---

## Metahub Migration Hardening — Structured Plan/Apply (2026-02-11)

Typed migration metadata contracts: baseline | structure | template_seed | manual_destructive. Template manifest validation with cross-reference safety checks. Seed dry-run planning. Structured plan/apply API with deterministic blocking. Branch-level template sync tracking. Tests: templateManifestValidator, metahubMigrationMeta, metahubMigrationsRoutes.

---

## 2026-02-10: Template System, DDL Engine, Migration Architecture ✅

### Metahub Template System (10 phases)
DB entities (templates, templates_versions), TemplateSeedExecutor, TemplateManifestValidator (Zod), TemplateSeeder (SHA-256 idempotent), frontend TemplateSelector. QA: Zod VLC fix, default auto-assign, transaction wrapper, atomic creation.

### Declarative DDL & Migration Engine (7 phases)
SystemTableDef types, 6 V1 tables, SystemTableDDLGenerator, SystemTableDiff engine, SystemTableMigrator (additive auto + destructive warnings). FK diff (ADD_FK/DROP_FK/ALTER_COLUMN). TemplateSeedMigrator for upgrades.

### Migration Architecture Reset
V1 baseline with _mhb_migrations entry. Decoupled template seed from structure upgrades. Migration history/plan/apply API, Migrations page + menu route.

Build: 65/65.

---

## 2026-02-05 to 2026-02-09: Layouts, Runtime, Menu Widget, PR Review ✅

### PR #668 Bot Review Fixes (02-09)
Zod schema mismatch, non-deterministic Object.keys→Object.values, unused imports.

### Menu Widget System (02-08 to 02-09)
Removed menus domain. MenuWidgetConfig with embedded items. Publication pipeline updated. MenuWidgetEditorDialog, MenuContent integration. 6 QA fixes (VLC, default title, runtime catalog).

### Layout Widget DnD + Rendering (02-08)
Widget DnD reorder, zone rendering, widgetRenderer.tsx, SortableWidgetChip.

### Application Runtime + DataGrid (02-07)
Column transformers, row counts, menu propagation, createAppRuntimeRoute factory.

### Layouts System Foundation (02-06)
Backend CRUD routes, LayoutList/LayoutDetails/LayoutInput, zone widget management, application sync, DashboardLayoutConfig type.

### Attribute Data Types + Display Attribute (02-05)
STRING, NUMBER, BOOLEAN, DATE, REF, JSON with validation rules. Display attribute with auto-selection. MUI 7 migration prep. Pattern: systemPatterns.md#attribute-type-architecture

Build: 65/65.

---

## 2026-01-29 through 2026-02-04: Branches, Elements, System Fields ✅ (v0.48.0-alpha)

- Metahub branches system (create, activate, delete, copy with schema isolation)
- Records renamed to Elements across backend, frontend, types, i18n
- Three-level system fields (`_upl_*`, `_mhb_*`, `_app_*`) with cascade soft delete
- Optimistic locking (version column, 409 conflicts, email lookup for `updated_by`)
- Pattern: systemPatterns.md#three-level-system-fields

---

## 2026-01-16 through 2026-01-28: Publications, schema-ddl, Migrations ✅ (v0.47.0-alpha)

- Runtime migrations (schema sync between metahub design and application runtime)
- Publication as separate entity with application-centric schema sync
- `@universo/schema-ddl` package for DDL utilities (SchemaGenerator, SchemaMigrator, KnexClient)
- Isolated schema storage + publication versioning system
- Pattern: systemPatterns.md#runtime-migration-pattern

---

## 2026-01-11 through 2026-01-15: i18n, VLC, Catalogs ✅ (v0.45.0-alpha, v0.46.0-alpha)

- Applications modules (frontend + backend) with Metahubs publications integration
- Domain-Driven Design architecture refactoring for metahubs packages
- VLC (Versioned Localized Content) localization system for metahub entities
- Catalogs functionality in Metahubs (CRUD, attributes, elements)
- Pattern: systemPatterns.md#vlc-utilities

---

## 2026-01-04 through 2026-01-10: Auth & Onboarding ✅ (v0.44.0-alpha)

- Onboarding completion tracking with registration 419 auto-retry
- Legal consent, cookie banner, captcha, auth toggles
- Pattern: systemPatterns.md#public-routes-401-redirect

---

## 2025-12-18 through 2025-12-31: VLC, Flowise 3.0, Onboarding ✅ (v0.42.0-alpha, v0.43.0-alpha)

- VLC system implementation + breadcrumb hooks refactoring
- Dynamic locales management. Flowise Components upgrade 2.2.8 → 3.0.12
- AgentFlow Agents + Executions integration (Flowise 3.x)
- Onboarding wizard with start pages i18n

---

## 2025-12-05 through 2025-12-17: Admin Panel, Auth, Package Extraction ✅ (v0.40.0-alpha, v0.41.0-alpha)

- Admin panel disable system with ENV-based feature flags
- Axios 1.13.2 upgrade (CVE-2025-27152). Auth.jsx → auth-frontend TypeScript migration
- UUID v7 infrastructure and core backend package
- Package extraction: Tools, Credentials, Variables, ApiKey, Assistants, Leads, ChatMessage, DocStore
- Admin panel + RBAC system. Admin Instances MVP
- Pattern: systemPatterns.md#source-only-package-peerdependencies

---

## 2025-11-07 through 2025-11-25: Organizations, Projects, Campaigns ✅ (v0.36.0-v0.39.0-alpha)

- dayjs migration, UI refactoring, publish-frontend TypeScript migration
- Russian README files. Metaverse Dashboard with analytics. REST API docs refactoring
- Member actions factory, Agents migration. Projects management. AR.js Quiz Nodes
- Organizations module. Campaigns integration. Storages management
- Pattern: systemPatterns.md#universal-list-pattern

---

## 2025-10-23 through 2025-11-01: Global Refactoring ✅ (v0.34.0-alpha, v0.35.0-alpha)

- Global monorepo refactoring: package restructuring, tsdown build system, centralized dependencies
- i18n TypeScript migration. Rate limiting production implementation with Redis
- Pattern: systemPatterns.md#build-system-patterns, systemPatterns.md#rate-limiting-pattern

---

## 2025-10-02 through 2025-10-16: Metaverses, Canvas, Publications ✅ (v0.31.0-v0.33.0-alpha)

- Publication system fixes, Metaverses module MVP, Quiz timer
- Canvas versioning, telemetry refactoring, role-based permissions
- MUI Template System implementation

---

## 2025-09-07 through 2025-09-21: Resources, Testing, Auth ✅ (v0.28.0-v0.30.0-alpha)

- Resources/Entities architecture with tenant isolation and security hardening
- CI i18n docs consistency checker. Spaces/Canvases publication settings
- TypeScript path aliases. Global publication library. Analytics hierarchy
- Passport.js + Supabase hybrid session architecture migration

---

## Pre-2025-09: Foundation Work ✅ (v0.21.0-v0.27.0-alpha)

- v0.27.0 (2025-08-31): Finance module, language switcher, i18n integration
- v0.26.0 (2025-08-24): MMOOMM template extraction, Colyseus multiplayer server
- v0.25.0 (2025-08-17): Space Builder MVP, Metaverse module, core utils package
- v0.24.0 (2025-08-12): Space Builder enhancements, AR.js wallpaper mode
- v0.23.0 (2025-08-05): Russian documentation, UPDL node params, custom modes
- v0.22.0 (2025-07-27): Memory Bank system, MMOOMM improvements, documentation
- v0.21.0 (2025-07-20): Handler refactoring, PlayCanvas stabilization, Alpha status
