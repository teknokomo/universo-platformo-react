# Current Research

## 2026-03-13: Optional global migration catalog true final closure

- Research outcome implemented: the last remaining gap was not runtime correctness but artifact completeness. `application_release_bundle` now embeds deterministic executable payloads for both baseline and incremental execution instead of checksum-only descriptors.
- The executable payload contract is intentionally deterministic: bundle artifact `schemaSnapshot.generatedAt` is bound to `manifest.generatedAt`, which keeps checksum validation stable across export and import.
- Bundle apply now consumes the embedded artifact payloads on the real execution paths and rejects corrupted payload/checksum combinations before any schema existence checks, diff calculation, or DDL execution begin.
- Validation for this closure wave is complete: `@universo/applications-backend` tests passed (80/80), package lint is green, and the final root `pnpm build` completed green (`27/27`, `2m38.453s`).
- No open research thread remains for this architecture wave.

## 2026-03-13: Optional global migration catalog closure

- Research outcome implemented: the remaining QA gaps were operational closure issues, not missing core architecture.
- `@universo/applications-backend` now exposes a real application release-bundle workflow: publication-backed export emits the canonical `application_release_bundle` contract, and bundle apply reuses the existing schema sync engine instead of creating a second install path.
- Successful publication sync and bundle apply now both persist `installed_release_metadata` through the central `applications.cat_applications` sync-state seam, keeping release/install state out of per-app runtime schemas.
- The last touched raw global-catalog env parser in migrations-platform CLI now uses the shared `@universo/utils` helper, aligning the touched startup/runtime/CLI paths on one parsing contract.
- Mirrored EN/RU operator docs now describe disabled-vs-enabled catalog behavior, release bundles, recovery guidance, and the env flag.
- Validation for this closure wave is complete: utils tests 189, core-backend tests 17, applications-backend release-bundle tests 12 with lint green, migrations-platform tests 49 with lint green, final root `pnpm build` green (`27/27`, `2m37.175s`).
- No open research thread remains for this architecture wave.

## 2026-03-13: QA blocker closure wave

## 2026-03-13: Optional global migration catalog architecture audit

- Code audit: `@universo/core-backend` startup still always calls `syncRegisteredPlatformDefinitionsToCatalog(...)`, so global catalog bootstrap remains in the critical startup path.
- Code audit: runtime application/metahub migrations already write local history into `_app_migrations` / `_mhb_migrations`, but `MigrationManager`, `SystemTableMigrator`, and `MetahubSchemaService` also hard-call `mirrorToGlobalCatalog(...)`, which currently auto-creates `upl_migrations` through `PlatformMigrationCatalog.ensureStorage()`.
- Code audit: fixed system-app schema generation uses `SchemaGenerator.generateFullSchema(...)` directly and does not record local baseline rows, which is why fixed-schema `_app_migrations` tables remain empty in the live database.
- Context7 findings: Knex treats seeds as repeatable data loaders and keeps schema history in migrations; Prisma baselining uses a full `0_init` baseline plus incremental pending migrations, which matches the target direction for exported/file-backed apps.
- Supabase UP-test read-only inspection: `upl_migrations` currently holds 20 `migration_runs`, 215 `definition_registry` rows, 215 `definition_revisions`, 215 `definition_exports`, 215 `definition_drafts`, and 430 `approval_events`; fixed `applications._app_migrations` and `metahubs._app_migrations` exist but have zero rows.
- Planning implication: local per-schema migration history should remain canonical, while the global catalog should become optional observability/export infrastructure behind a feature flag and explicit capability checks.
- Open research thread: implementation must safely degrade CLI/doctor/export commands that currently assume `PlatformMigrationCatalog.isStorageReady()` or definition-registry tables.
- QA refinement finding: the earlier master-plan wording that expected `definition_registry` population on every fresh bootstrap is too strict for the intended architecture and must be replaced with an explicit two-mode acceptance contract.
- QA refinement finding: enabled-mode global audit should remain fail-closed and same-transaction with local history/schema-state persistence; disabled mode may no-op safely, but enabled mode must not silently degrade.
- QA refinement finding: file-bundle release/install metadata should reuse the existing central application sync-state surface in `applications.cat_applications` before any new metadata store is introduced.
- QA refinement finding: the env/config layer should follow the repository’s established small helper pattern in `@universo/utils` first, rather than introducing a broader shared capability abstraction prematurely.

## 2026-03-13: Optional global migration catalog implementation closure

- Research outcome implemented: the repository now supports explicit catalog-enabled and catalog-disabled modes without treating the full global definition registry as a mandatory cold-start dependency.
- `@universo/migrations-platform` now uses `PlatformMigrationKernelCatalog` in disabled mode, preserving `upl_migrations.migration_runs` while keeping definition-registry lifecycle storage behind the feature flag.
- Runtime application/metahub migration writes now preserve local canonical history even when global catalog mirroring is disabled, and enabled mode remains fail-closed by keeping explicit capability checks.
- Fixed system-app schema generation now records deterministic local baseline rows and backfills missing `_app_migrations` baseline history when a schema already exists.
- Central application release/install metadata now reuses `applications.cat_applications.installed_release_metadata`, keeping sync/install state in one canonical persistence surface.
- Validation for this wave is complete: `@universo/schema-ddl` tests green, `@universo/migrations-catalog` tests 36/36 green, `@universo/migrations-platform` tests 101/101 green, and final root `pnpm build` green (`27/27`, `2m41.284s`).
- No open research thread remains for this architecture wave.

## 2026-03-13: QA blocker closure wave

- Research outcome implemented: the still-live blockers were narrow package-level correctness/tooling issues, not missing architecture from the completed system-app program.
- The failing `@universo/migrations-core` validation case was caused by a malformed test owner id; the fix preserved strict managed owner-id validation by correcting the test input to a canonical UUID.
- `@universo/migrations-core` lint now ignores committed/generated `src/**/*.d.ts`, `@universo/schema-ddl` no longer has error-level lint failures, and `@universo/core-backend` again exposes a package-level lint script with warning-only output on the touched surface.
- Validation for this closure wave is complete: `@universo/migrations-core` tests 58/58 + lint green, `@universo/schema-ddl` tests green with warning-only lint, `@universo/core-backend` tests 16/16 with warning-only lint, final root `pnpm build` green (`27/27`, `2m27.925s`).
- No open research thread remains for this blocker-closure wave.

## 2026-03-13: Final QA closure gap audit

- Research outcome implemented: the remaining repository-side gaps were narrow contract and proof issues, not missing architectural waves.
- Profile and admin fixed-system-app manifests now keep string validation limits aligned with their backing `VARCHAR(50)` columns, and shared migrations-platform tests assert that manifest `maxLength` never exceeds declared `VARCHAR(N)` lengths.
- `@universo/applications-backend` now has direct persistence-level regression coverage for `copyApplicationWithOptions(...)`, so copy safety no longer depends only on route-level mocks.
- The core-backend acceptance regression now captures both halves of the final contract: application-like fixed-schema fresh bootstrap and publication-created application runtime sync composition.
- The docs tree now contains mirrored English/Russian architecture docs for fixed system-app convergence, with verified line parity across the touched doc pairs.
- Validation for this closure wave is complete: profile Jest 5/5, admin Jest 3/3, applications persistence Jest 12/12, migrations-platform Jest 35/35, core-backend acceptance Jest 2/2, error-free lint for applications-backend and migrations-platform, warning-only touched lint elsewhere, final root `pnpm build` green (`27/27`, `2m37.515s`).
- No open research thread remains for this final QA closure wave.

## 2026-03-13: QA closure completion revalidation

- Research outcome implemented: four real residual defects remained after the earlier green state, and all were operational contract issues rather than broad architectural failures.
- `@universo/migrations-platform` now records export lifecycle rows for bundle-oriented catalog exports, so CLI export and doctor observe the same active published revision state.
- `@universo/migrations-catalog` and `@universo/migrations-platform` now use stable artifact-equivalence checks, so dependency-only changes are no longer skipped behind checksum-only no-op detection.
- `@universo/utils` now exposes a browser-specific env entry whose precedence is `__UNIVERSO_PUBLIC_ENV__` → `import.meta.env` → `process.env` → browser origin, and `@universo/store` mirrors `import.meta.env` fallback support.
- `@universo/migrations-core` now rejects malformed managed owner ids instead of silently normalizing them into potentially colliding schema-name inputs.
- Validation for this closure wave is complete: `@universo/migrations-catalog` tests 28/28, `@universo/migrations-platform` regressions 64/64, `@universo/utils` env tests 5/5, `@universo/migrations-core` identifiers 8/8, touched-surface lint green, final root `pnpm build` green (`27/27`, `2m39.834s`).
- No open research thread remains for this QA closure completion wave.

## 2026-03-13: QA plan completion revalidation

- Research outcome implemented: the suspected metahubs naming/parity mismatch was not real on the live branch; the parity contract already expects the converged `cat_*` / `doc_*` fixed-schema naming.
- `@universo/migrations-platform` doctor lifecycle checks now treat any export recorded for the active published revision as healthy, while operational sync/export flows still keep explicit export targets.
- Shared backend Jest mapping now resolves `@universo/database`, which restores package-local execution of the metahubs parity contract suite.
- A new core-backend router-level regression now covers publication-created application bootstrap through the composed runtime-sync seam.
- Validation for this closure wave is complete: touched focused Jest suites are green, touched-package lint is green, and final root `pnpm build` is green (`27/27`, `2m39.643s`).
- No open research thread remains for this QA completion wave.

## 2026-03-13: Definition lifecycle closure audit

- Research outcome implemented: the remaining gap was operational, not storage-level — lifecycle tables and helpers already existed, but live imports still bypassed them.
- `@universo/migrations-catalog` now routes active imports through draft creation, review request, and publication, while preserving published lifecycle provenance on unchanged revisions.
- `@universo/migrations-platform` no-op and doctor checks now require published lifecycle provenance in addition to registry checksum/export parity, so pre-fix catalog rows are repaired once.
- Validation for this closure wave is complete: `@universo/migrations-catalog` tests 34/34, `@universo/migrations-platform` tests 98/98, package lint green, final root `pnpm build` green (`27/27`, `2m51.177s`).
- No open research thread remains for this lifecycle closure wave.

## 2026-03-12: Ownership seam and live-start bootstrap investigation

- Research outcome implemented: the publication-derived runtime sync seam now stops at `loadPublishedPublicationRuntimeSource(...)` in `@universo/metahubs-backend`, while `@universo/applications-backend` owns the final sync-context adapter.
- Reproduced and fixed package-level Jest forwarding drift by moving touched backend packages to the shared `tools/testing/backend/run-jest.cjs` wrapper.
- Live startup investigation proved that the remaining bootstrap failures were phase-ordering defects, not only SQL idempotency defects: `OptimizeRlsPolicies1800000000200` and `SeedBuiltinMetahubTemplates1800000000250` both needed `post_schema_generation` registration.
- Live validation now reaches a serving server: after bootstrap, `node ./run start` listens on port 3000 and returns `HTTP/1.1 200 OK` for the root route.
- No open research thread remains for this closure wave; future work should treat live startup smoke as mandatory whenever platform migration phases or fixed-schema bootstrap sequencing change.

## 2026-03-11: System-app unification completion planning audit

- Codebase audit result: the loader/CLI/registry foundation exists, but the completion program still lacks a rich system-app contract, unified schema-target handling across fixed + runtime schemas, runtime application-sync ownership separation, and the deep acceptance test matrix.
- Context7 PostgreSQL 17 guidance confirmed that `SECURITY DEFINER` functions must set a trusted `search_path` explicitly with `pg_temp` last, and should revoke default `PUBLIC` execute privileges before selective grants.
- Context7 TanStack Query guidance confirmed the repository should keep creating a fresh `QueryClient` per test, disable retries in tests, and prefer explicit query-key invalidation patterns.
- Supabase UP-test (`osnvhnawsmyfduygsajj`) currently shows live drift: `profiles` schema exists with zero tables, `public.profiles` still exists, and all `upl_migrations.definition_*` tables are present but empty.
- Supabase UP-test operational defaults observed during planning: transaction pooler on port `6543`, `search_path = "$user", public`, `statement_timeout = 2min`, `lock_timeout = 0`.
- The failed live SQL probe against `upl_migrations.migration_runs.created_at` confirmed that operational tooling must use the real catalog timestamp columns (`_upl_created_at`, `_upl_updated_at`) instead of assuming generic names.
- QA refinement after the first draft of the master plan: exact Metahub schema parity must stay explicit, requirement traceability must remain inside the plan, and future-facing abstractions such as managed custom schemas / rich artifact catalogs must not delay the current parity milestone unless they solve a concrete present-tense requirement.
- Existing frontend reuse patterns confirmed during the QA pass: `MigrationGuardShell`, `ApplicationMigrationGuard`, `MetahubMigrationGuard`, `ConnectorDiffDialog`, `EntityFormDialog`, `DynamicEntityFormDialog`, `CrudDialogs`, `RowActionsMenu`, `useCrudDashboard`, `createEntityActions`, `createMemberActions`, and existing optimistic/query invalidation helpers should be treated as the default UI/CRUD surface.

## 2026-03-07: Optimistic create UX redesign audit

- Existing optimistic create/copy behavior is intentionally immediate in cache **and** immediate in presentation: `ItemCard`, `FlowListTable`, and `CustomizedDataGrid` all react to `__pending` right away instead of deferring visual feedback until user interaction.
- The current shared model has no dedicated concept of “optimistically created but visually normal until touched”; that distinction will need to be introduced at the helper/renderer level without changing backend schemas.
- Metahubs and Applications optimistic create hooks still contain temporary `sortOrder ?? 999` placeholders, while many list renderers still display `sortOrder ?? 0`; this combination is the strongest current explanation for the observed temporary `999` / `0` ordinal artifacts.
- `ElementList` still awaits `createElementMutation.mutateAsync(...)`, confirming that at least one create dialog remains blocking after the earlier fire-and-forget pass.
- `MetahubList` and `ApplicationList` table name cells use direct `Link` rendering, so pending entities in those views do not inherit the shared pending-navigation guard behavior.

## 2026-03-04: Codename QA closure follow-up

- Research outcome implemented: codename retry policy standardized across backend domains using shared constants.
- Added direct unit coverage for codename validation/sanitization (`@universo/utils`) and retry candidate generation (`metahubs-backend` helper).
- No unresolved blocker from this research thread remains.

## 2026-02-10: Application Runtime 404 on Checkbox Update

- Root cause: runtime update requests did not include `catalogId`, so backend defaulted to the first catalog by codename and returned 404 (row not found) for other catalogs.
- Fix: include `catalogId` in runtime cell update payloads to target the correct runtime table.

## 2026-02-03: Display Attribute UX Fixes

- No new external research required; changes were internal UX and default-value adjustments.

## RLS QueryRunner freeze investigation (2026-01-11)

### Observations
- UI can appear to “freeze” after create operations until server restart; server logs show repeated RLS middleware activity (QueryRunner create/connect).

### Code audit (createQueryRunner call sites)
- `@universo/auth-backend`: `ensureAuthWithRls` creates a per-request QueryRunner and releases it on response completion.
- `@universo/auth-backend`: `permissionService` creates a QueryRunner only when one is not provided; releases it in `finally`.
- `@flowise/core-backend`: export/import uses QueryRunner with explicit connect + transaction and releases in `finally`.

### Current hypothesis
- The freeze is likely caused by pooled connection contention (too many concurrent requests each holding a per-request QueryRunner) or an edge-case where cleanup/release does not run.
- The middleware cleanup is now guarded to run once per request to reduce cleanup races.

---

## schema-ddl cleanup follow-up (2026-01-19)

### Notes
- Parameterized statement_timeout in `@universo/schema-ddl` locking helper to avoid raw interpolation
- Removed deprecated static wrapper methods in `SchemaGenerator` and `MigrationManager`
- Updated tests to use naming utilities directly

---

## Database pool monitoring (2026-01-31)

### Notes
- Supabase Pool Size observed at 15 connections for the project tier.
- Knex + TypeORM pool budgets aligned to 8 + 7 (total 15).
- Error logging now includes pool state metrics to diagnose exhaustion events.