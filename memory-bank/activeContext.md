# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: Snapshot Import Final Stabilization — COMPLETE — 2026-04-03

## Current Focus: PR #747 Review Remediation QA — COMPLETE — 2026-04-03

- Goal achieved: every Copilot/Gemini review note on PR #747 was re-checked against the live branch state, and only the low-risk findings that mapped to real defects were fixed.
- Confirmed-and-fixed items: the misplaced `attachLayoutsToSnapshot` static import, the `ImportSnapshotDialog` `React.ChangeEvent` namespace mismatch, the ineffective snapshot prototype-pollution test, the unreadable VLC codename logging in `SnapshotRestoreService`, the timestamp-only imported-metahub codename suffix, and the `MainGrid` FlowListTable `renderCell` call that passed `api: {} as never`.
- Explicitly deferred items: the runtime comments about server-wide search coverage and persisted row ordering were classified as broader product/architecture changes rather than safe review-remediation fixes, so they were intentionally left out of this pass.
- Validation closure: touched-file diagnostics stayed clean, focused utils/apps-template/metahubs backend tests passed, and the canonical root `pnpm build` finished green.

### Immediate Next Steps

- No active work remains from this remediation wave.
- If the user wants the PR updated remotely, the next step is to commit and push this validated fix set to the existing PR branch.

## Current Focus: Verified Snapshot/Runtime Residual Gap Closure — COMPLETE — 2026-04-04

- Goal achieved: the residual defects found during the trust-but-verify pass are now closed without reopening unrelated feature scope.
- Backend closure: `importFromSnapshot` no longer returns before compensation when the imported metahub is missing its initial branch or branch schema; those paths now fail through the same rollback cleanup contract as restore failures.
- Runtime closure: `tools/testing/e2e/specs/flows/app-runtime-views.spec.ts` now provisions a real application and exercises the repository-standard `/a/...` route with assertions for card mode, search filtering, and FlowListTable activation instead of behaving like a smoke test.
- Fixture/tooling closure: the self-model generator and manual utility now persist enhanced runtime layout settings after widget/config synchronization, the committed fixture contains those fields, and the manual script uses `/api/v1/auth/csrf`.
- Documentation closure: both E2E READMEs now describe the generator as the real 13-section self-model flow instead of the older 9-catalog wording.

### Immediate Next Steps

- No active work remains from this verified follow-up wave.
- If another QA pass is requested, start with the newly regenerated self-model fixture and the `/a/...` runtime flow because both now act as the canonical proof that enhanced runtime layout settings survive export/import.

## Current Focus: QA Closure For Snapshot Import Cleanup And Runtime Contracts — COMPLETE — 2026-04-03

- Goal achieved: the six validated post-QA implementation gaps are closed without reverting unrelated working-tree changes.
- Backend closure: `importFromSnapshot` now compensates restore/publication failures by dropping created branch schemas, soft-deleting created metahub metadata, and returning explicit `METAHUB_IMPORT_ROLLED_BACK` vs `METAHUB_IMPORT_CLEANUP_FAILED` responses.
- Runtime closure: apps-template filtered search now uses local filtered totals/page slices instead of stale server counts, and `enableRowReordering` now switches table mode to the shared FlowListTable sortable path while keeping the existing DataGrid path intact when disabled.
- Fixture closure: the self-model Playwright generator and CLI now create the planned 13 sections through real hub/set/enumeration endpoints, seed an enumeration value, and regenerate `tools/fixtures/self-model-metahub-snapshot.json` from the corrected architecture.
- Validation closure: focused metahubs route/service tests, apps-template Vitest, utils snapshot tests, the targeted self-model generator run, and the full root `pnpm build` all passed.

## Current Focus: QA Remediation Follow-up For Snapshot/Runtime Settings Hardening — COMPLETE — 2026-04-03

- Goal achieved: the post-QA remediation wave closed the remaining verified technical debt without widening scope beyond the validated findings.
- Snapshot contract closure: `buildSnapshotEnvelope()` now accepts the stricter transport snapshot type, matching the shared envelope schema and clearing the confirmed editor/type-contract drift in utils plus backend export callsites.
- Runtime contract closure: the stale `enableRowReordering` setting is no longer advertised by the live apps-template-mui runtime surface, metahub layout translations, or public docs, avoiding a noop feature seam.
- Regression-proofing closure: publication version import now has a direct happy-path backend test that asserts the permission path, deactivation of older versions, active-version pointer update, linked-app notification, and imported source metadata.
- Repository hygiene closure: accidental repository-root artifact files were removed, focused utils/backend checks stayed green, and the full root `pnpm build` finished green (`28/28`).

### Immediate Next Steps

- No active implementation work remains from this remediation wave.
- If a new QA pass is requested, start from publication import/export contracts and apps-template runtime settings because those seams were the only touched production surfaces in this closure.

## Previous Focus: Snapshot Import Final Stabilization — COMPLETE — 2026-04-03

- Goal achieved: importing the self-model metahub now creates a coherent publication/version structure, so connector diff and first-attempt schema creation succeed immediately after import.
- UI closure: the import dialog now uses the shared `StandardDialog`, shows configuration wording instead of snapshot wording, localizes the no-file-selected state, and no longer renders the extra divider lines.
- Validation closure: focused metahubs route tests, root `pnpm build`, targeted Playwright reruns, and the final `pnpm run test:e2e:full` all passed.
- Teardown closure: post-run `lsof -iTCP:3100 -sTCP:LISTEN` returned no listener, confirming wrapper-managed shutdown released the owned server port.

### Working Findings

| Finding | Current decision |
| --- | --- |
| `pnpm start` can recreate fixed project schemas on an empty database | Confirmed via direct E2E startup and wrapper-managed startup before `bootstrapStartupSuperuser()` |
| Full reset must also remove `upl_migrations` | Required so startup migrations rerun from a truly empty project state |
| Manifest cleanup is insufficient for historical leftovers | Keep only as targeted recovery/helper cleanup |
| Full reset must not drop Supabase-managed schemas | Restrict destructive scope to project-owned schemas and auth users only; self-heal `public` if a previous bad reset removed it |
| Runner shutdown must stop the entire `pnpm start` process tree | Killing only the parent shell leaves backend children alive and blocks destructive post-reset |

## Previous Focus: Metahub Self-Hosted App & Snapshot Export/Import — COMPLETE — 2026-04-03

- Plan v3 at `memory-bank/plan/metahub-self-hosted-app-and-snapshot-export-plan-2026-04-03.md`.
- **Status: FULLY COMPLETE — All phases implemented + all QA findings resolved. Build 28/28, metahubs-backend 47 suites / 421 tests, utils 274/274.**

### QA v3 Hardening Fixes (2026-04-03)

| Issue | Fix |
| --- | --- |
| C1: VLC format in `importFromSnapshot` | Replaced `buildLocalizedContent()` with `ensureVLC()` for name/description/publication |
| H1+H2: Silent reference drops | Added `log.warn()` for unmapped hub IDs and cross-references in SnapshotRestoreService |
| H3: `defaultLayoutId` not remapped | Confirmed false positive — snapshot is self-consistent with original IDs |
| M1: Zod snapshot passthrough | Added explicit optional fields for known snapshot structure; passthrough kept for forward compat |
| M2: Server-side file size | Added Content-Length check in import route (defense-in-depth) |
| C2: Missing route tests | Added 7 unit tests for import/export routes (metahubsRoutes.test.ts) |
| M5: Missing service tests | Created SnapshotRestoreService.test.ts with 6 tests |
| M3: E2E spec failures | Fixed toolbar selector (`-menu-trigger`) + import response ID extraction |
| F1: E2E selector mismatch | Fixed `toolbar-primary-action-dropdown` → `toolbar-primary-action-menu-trigger` |

### Self-Model E2E Results

- `self-model-metahub-export.spec.ts` — **PASS** (3.2 min)
- Creates 9 catalogs (Metahubs, Catalogs, Attributes, Elements, Constants, Branches, Publications, Layouts, Settings) with 27 fields
- Exports snapshot: `tools/fixtures/self-model-metahub-snapshot.json` (62 KB, 13 entities incl. 4 system)
- 3 screenshots in `test-results/self-model/`
- `snapshot-export-import.spec.ts` — tampered hash test passes; 2 findings open (F1: UI selector, F2: VLC import compat)

### Generators Architecture — 2026-04-03

- `specs/generators/` is the dedicated folder for on-demand snapshot generators. Excluded from `test:e2e:full` and all `--grep @flow/@smoke/…` runs.
- Playwright config has a dedicated `generators` project; `chromium` project ignores generator files via `testIgnore`.
- `pnpm run test:e2e:generators` runs all generators; individual via `--grep "self-model"`.
- Output: persistent fixtures in `tools/fixtures/` (not gitignored, not cleaned by runner). Ephemeral screenshots in `test-results/`.
- Both E2E READMEs (EN+RU) document the architecture, commands, available generators table, and how to add new ones.

### QA Post-Implementation Fixes Applied

| Issue | Fix |
| --- | --- |
| H1: E2E tampered hash test wrong length | `'a'.repeat(64)` tests actual hash mismatch |
| H2: `enableRowReordering` toggle noop | Removed from LayoutDetails UI; Zod schema field kept for future DnD |
| M3: Field/element limits not validated | Added per-entity checks in `validateSnapshotEnvelope` + 2 unit tests |
| M4: File input not reset on dialog close | Added `useRef` to clear native input element |

### Completed Phases

- **Phase 1.1**: Shared types + Zod schema in `@universo/types` (`common/snapshots.ts`)
- **Phase 1.2**: Snapshot helpers in `@universo/utils` (`snapshot/snapshotArchive.ts`) + 13 unit tests
- **Phase 2.0**: CSRF global protection on `/api/v1` routes
- **Phase 2.1–2.5**: Backend export/import routes, SnapshotRestoreService
- **Phase 3.1–3.5**: Frontend export/import UI + i18n
- **Phase 4**: `apps-template-mui` — EnhancedDetailsSection, card/table toggle, Zod schema, row height, i18n
- **Phase 5**: Layout config UI — Application View Settings panel in LayoutDetails
- **Phase 6**: Self-model metahub script — `tools/create-self-model-metahub.mjs`
- **Phase 7**: Tests — publication route tests, E2E snapshot-export-import + app-runtime-views specs
- **Phase 8**: Documentation — GitBook guides (en/ru), README updates (apps-template-mui, metahubs-backend)

### Build Fix Notes (Session 11)

- Fixed TypeScript cast errors in metahubsController.ts and publicationsController.ts: VLC→Record casts need `as unknown as Record<string, unknown>`
- Fixed `'readMetahub'` not in `RolePermission` union — export routes use no-permission (membership-only) access check
- Fixed `useCrudDashboard.ts` return type: `DashboardLayoutConfig` (from Zod) is `{...} | undefined` so `Required<>` was incompatible; changed to `NonNullable<>`
- Made `showSideMenu`, `showAppNavbar`, `showHeader` optional in `DashboardLayoutConfig` interface to match Zod schema

### Key Implementation Decisions

- `SnapshotRestoreService` uses 3-pass creation order matching `TemplateSeedExecutor`: (1) entities+system attrs, (2) constants, (3) attributes/enum values/elements/layouts
- `CatalogSystemFieldsSnapshot.fields` (not the whole object) is passed to `ensureCatalogSystemAttributesSeed`
- Import generates new UUIDs with old→new ID remapping for cross-references
- `createPoolSnapshotRestoreService(schemaName)` wrapper added to `ddl/index.ts`
- Import dialog validates file size (50MB limit) and `.json` extension client-side before upload

## Operational Constraints

- Use `pnpm build` as the canonical root validation path.
- Preserve Turbo `envMode: "strict"`.
- Helper changes should fail closed when persisted state is missing.

## Session Hygiene

- Keep this file current-focus only.
- Keep durable completion detail in [progress.md](progress.md).
- Keep checklist state in [tasks.md](tasks.md).

## References

- [tasks.md](tasks.md)
- [progress.md](progress.md)
- [techContext.md](techContext.md)
- [systemPatterns.md](systemPatterns.md)
