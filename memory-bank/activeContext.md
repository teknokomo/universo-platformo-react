# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

## Current Focus: No Active Metahub Frontend Reopen

- Date: 2026-03-13.
- Status: complete; the metahub frontend regression reopen is closed and no active implementation wave remains in this slice.
- Scope: preserve the restored Settings continuity in deep hub/publication views, the hardened shared confirm delayed-render contract, and the shared pending-row feedback parity for optimistic publications.
- Operational posture: keep these fixes anchored in the shared frontend layer unless a future regression is reproduced in a more local seam.

## Immediate Next Step

- No active implementation work is required for this slice.
- Wait for an explicit QA, live, or product trigger before reopening hub/publication settings continuity, confirm rendering, or optimistic publication interaction remediation.
- If reopened, start by reproducing the exact deep-view route or blocked optimistic interaction path before changing shared seams again.

## Latest Closure: Metahub Frontend Regression Reopen

- `ElementList` restores hub-scoped Settings access, and `PublicationApplicationList` now keeps publication Settings reachable from the applications subview by reusing the existing publication edit dialog flow.
- The shared `useConfirm` fallback now tolerates delayed dialog mount timing, and `ConfirmDialog` exposes an additional request-id marker so detached-create warnings no longer auto-cancel early.
- Shared `FlowListTable` and `FlowListTableDnd` now intercept blocked pending-row interactions across custom row content, restoring the same glow/spinner feedback path for optimistic publications.
- Direct frontend/shared regressions passed, touched package lint remained warning-only, and the final root `pnpm build` passed with 27/27 successful tasks.

## Previous Focus: No Active Optional Global Catalog Remediation Wave

- Date: 2026-03-13.
- Status: the reopened QA follow-through wave is complete, and there is no active optional global catalog remediation slice open.
- Scope: keep the repaired profile update/delete contract and runtime release-bundle lineage contract closed unless a new explicit QA, live, or product trigger appears.
- Operational posture: preserve package boundaries, keep request-scoped/RLS-safe execution intact, and continue reusing shared identifier helpers instead of local SQL quoting forks.

## Latest Closure: Optional Global Catalog QA Reopen Follow-Through

- `profile-backend` now fails closed on cross-user update/delete attempts at the controller boundary, rejects unsupported public update fields, and persists profile changes only through an explicit allowlist of SQL columns.
- `applications-backend` runtime release-bundle export now selects the installed base snapshot according to the actual `fromVersion` lineage contract, so advancing from an installed release uses `releaseSchemaSnapshot` while unchanged bundle re-exports keep the stored `baseSchemaSnapshot` lineage.
- The touched runtime snapshot loaders now reuse shared `@universo/migrations-core` identifier helpers instead of maintaining a private regex-based quoting implementation.
- Focused tests passed for `@universo/profile-backend` and `@universo/applications-backend`, both touched package lint runs passed cleanly, and the final root `pnpm build` passed with 27/27 successful tasks.

## Previous Immediate Next Step

- No active implementation work is required for this slice.
- Wait for an explicit QA, live, or product trigger before reopening profile update/delete or application release-bundle remediation.
- If reopened, begin by reproducing the exact controller payload or runtime export lineage break before changing shared seams.

## Previous Closure: Optional Global Catalog QA Follow-Through

- `profile-backend` now enforces self-only profile creation in both the controller and the RLS INSERT policy, and direct controller/service regressions cover the repaired ownership path.
- `applications-backend` release bundles now carry `baseSchemaSnapshot` plus a precomputed incremental `diff`, and apply/export flows validate and use that embedded lineage instead of recalculating from the target payload alone.
- Focused tests passed for `@universo/profile-backend` and `@universo/applications-backend`, both touched package lint runs passed cleanly, and the final root `pnpm build` passed.

## Immediate Next Step

- No active implementation work is required for this slice.
- Wait for an explicit QA, live, or product trigger before reopening profile ownership or application release-bundle remediation.
- If reopened, begin by reproducing the concrete contract break at the controller or bundle-validation boundary before changing shared runtime seams.

## Previous Focus: No Active Metahub Remediation Wave

- Date: 2026-03-13.
- Status: the final shared-table QA reopen is complete, and there is no active metahub implementation wave in progress.
- Scope: keep the metahub/shared-table area closed unless a new explicit QA, live, or product trigger appears.
- Operational posture: preserve the repaired shared-table filtering/sorting/DnD alignment contract and the previously restored branch-schema active-row reads; avoid reopening unrelated metahub, startup, or optional-global-catalog work.

## Latest Closure

- `FlowListTable` now derives `SortableContext` ids from the visible filtered/sorted rows, while external `sortableItemIds` remain only the allowed DnD id set.
- Direct shared-table regression proof now covers `sortableItemIds + sortableRows + filterFunction + column sort` so visible order and DnD order cannot silently diverge again.
- Validation for the final reopen completed with `FlowListTable.test.tsx` 4/4 green, `@universo/template-mui` lint back to warning-only status, and a passing root `pnpm build`.

## Previous Completed Wave

### 2026-03-13: Metahub QA Final Closure

- `FlowListTable` now applies `filterFunction` before render, empty-state/header decisions, and sortable DnD id derivation when `sortableRows` is enabled.
- `MetahubAttributesService.getAllAttributes(...)` now applies `_upl_deleted = false AND _mhb_deleted = false` before ordering, keeping the branch-schema read contract consistent.
- Direct regressions now cover both the shared-table `filterFunction + sortableRows` case and the backend `getAllAttributes(...)` query-builder path.
- The package-local `@universo/template-mui` lint blocker in `src/hooks/optimisticCrud.ts` was cleared during revalidation so the package returned to warning-only lint status.

### Validation

- `MetahubAttributesService.test.ts` passed 4/4.
- `FlowListTable.test.tsx` passed 4/4.
- `HubList.settingsReopen.test.tsx` passed 1/1.
- `@universo/template-mui` lint is warning-only with no error-level failures.
- `@universo/metahubs-backend` lint remains warning-only on the touched validation pass.
- Final root `pnpm build` passed.

## Latest Completed Wave

### 2026-03-13: Metahub QA Follow-Up Remediation Closure

- Runtime attribute raw SQL reads in `MetahubAttributesService` now honor the branch-schema active-row contract (`_upl_deleted = false AND _mhb_deleted = false`) across the remaining hot read paths.
- `HubList` now has a direct regression proving hub-scoped settings reopen from `location.state.openHubSettings` and clear the one-shot route state.
- `FlowListTable` now has a direct shared-table regression proving real row reordering under `sortableRows` when a sortable column is selected.
- The shared `@universo/template-mui` Jest bootstrap blocker caused by JSON proxy mapping was removed, so the package-local table regression now executes directly.

### Validation

- Focused backend regressions passed 77/80 with 3 expected skips, including the new `MetahubAttributesService` service test.
- Focused frontend regressions passed 2/2, including the new `HubList.settingsReopen` proof.
- The direct shared-table Jest regression passed 3/3 in `@universo/template-mui` after the bootstrap fix.
- Touched package lint is error-free, and the final root `pnpm build` passed.

## Previous Completed Wave

### Outcome

- Hub-scoped Settings navigation is visible again across sibling pages.
- Nested entity creation warning confirmations render again instead of auto-cancelling.
- Attribute table columns can be sorted again without sacrificing DnD row ordering.
- The catalog/attribute read path no longer trips backend `500` responses through extra pool acquisition under request-scoped RLS.

### Root Cause

- Several metahub pages mounted local `ConfirmContextProvider` wrappers even though the real dialog/provider pair already lives at the root layout.
- `CatalogList`, `SetList`, and `EnumerationList` lost the Settings tab in their hub-scoped tab bars during the refactor.
- Shared `FlowListTable` disabled sortable headers and skipped column sorting whenever `sortableRows` was enabled.
- Hot metahub read methods on the catalog/attribute page path still used global Knex instead of the request-scoped SQL executor pinned by RLS middleware.

### Implementation Summary

- Removed redundant metahub-page confirm providers so `useConfirm()` resolves against the root dialog.
- Restored Settings tabs on hub-scoped sibling pages and added `HubList` state-driven reopening of hub settings.
- Reworked `FlowListTable` so DnD-backed tables preserve incoming order by default but still activate sortable headers and explicit column sorting.
- Added a request-scoped SQL pass-through on `MetahubSchemaService` and moved the hot object/hub/attribute/element read methods onto that seam.
- Restored the historical loose object-row contract in `MetahubObjectsService` so route and serializer consumers keep compatible typing after the raw-SQL refactor.

## Validation

### Focused Validation

- Direct Vitest regression for `ChildAttributeList.optimisticCreate` passed 1/1.
- Backend route regressions for `attributesRoutes` and `catalogsRoutes` passed 37/37.
- Touched package builds passed for `@universo/template-mui`, `@universo/metahubs-frontend`, and `@universo/metahubs-backend`.

### Full Validation

- Root `pnpm build` passed.

## Current Operating Posture

- Treat the metahub post-refactor regression wave, the QA follow-up remediation wave, the QA final closure wave, and the final shared-table QA reopen closure as complete.
- Keep the fixed-system repeated-start closure and optional global catalog program closed unless a new explicit trigger appears.
- Prefer shared-layer fixes when metahub regressions originate in root confirm infrastructure, shared table behavior, or request-scoped database seams.

## What Must Not Regress

- Metahub pages must not shadow the root confirm provider when they rely on the global confirm dialog.
- Hub-scoped sibling pages must preserve the Settings tab affordance even when the actual dialog lives on `HubList`.
- `FlowListTable` must keep sortable-column behavior available even when row drag-and-drop is enabled.
- Routes running under RLS must avoid hot-path global Knex reads that acquire a second pool connection outside the request-scoped executor.

## Immediate Next Step

- No active implementation wave is open for this area.
- Wait for an explicit QA, live, or product trigger before reopening the metahub regression slice.
- If reopened, start by reproducing the exact frontend flow or catalog/attribute page load path before changing shared seams.

## Recent Completed Context That Still Matters

### 2026-03-13: Fixed System-App Repeated-Start Stability Closure

- Repeated startup no longer fails after the first clean bootstrap.
- Fixed system apps continue to evolve from canonical local `_app_migrations` history instead of existence-only shortcuts.
- Compiler regressions now match the real `SchemaSnapshot.entities` record/object contract.
- Future startup changes in this area still require focused validation plus a real second live start.

### 2026-03-13: Optional Global Catalog Final Integrity Closure

- Closed the last delete-cascade integrity gap.
- Kept fixed system apps on local-history-driven schema evolution.
- Hardened shared schema-ddl apply flows for fixed-schema upgrades.
- Removed accidental generated artifacts from `@universo/migrations-core/src` and kept cleanup deterministic.

### 2026-03-13: Optional Global Catalog Closure Waves

- Release-bundle apply is fail-closed for schema-bearing targets without tracked installed release lineage.
- Executable bundle payloads are embedded and validated before apply.
- Application-origin release-bundle export reconstructs canonical runtime snapshots without introducing a second release store.
- Central application sync state remains in `applications.cat_applications`.

### 2026-03-13: QA Remediation Waves

- Dual-flag predicates were completed across touched application/metahub/admin/profile paths.
- Cascade soft-delete ordering is child-first where publication-version lineage requires it.
- Persisted schema-sync state stays on converged `cat_*` tables.
- Touched package lint/test/build surfaces are green again after the final remediation passes.

### 2026-03-12: Fixed System-App Convergence Foundation

- Application-like fixed system apps bootstrap through definition-driven schema-ddl plans.
- Legacy fixed-schema table names are reconciled forward into the converged `cat_` / `cfg_` / `doc_` / `rel_` model.
- Startup doctor and fail-fast checks validate both metadata completeness and legacy-leftover absence.
- Frontend acceptance coverage expanded around application, connector, publication, and metahub management flows.

## Constraints

- Branch schemas `mhb_<uuid>_bN` intentionally keep `_mhb_*` fields.
- Dynamic application schemas `app_<uuid>` intentionally keep `_app_*` fields.
- Fixed application-like system schemas are the only target of the convergence and repeated-start guarantees described here.
- Monolithic fixed-schema SQL definitions remain reference parity contracts, not the active bootstrap source of truth.
- Existing untouched warning-level lint debt may remain elsewhere in the workspace; this closure only claims error-free status on validated touched surfaces and direct regressions.

## Working Rules For The Next Reopen

- Reproduce first with live repeated startup.
- Verify snapshot shape at the read boundary before changing migrator behavior.
- Update regression fixtures to match the live serialized contract before trusting a green suite.
- Finish with focused tests, touched lint/build, full root build, second live start, and HTTP health check.

## References

- Progress details: `memory-bank/progress.md#2026-03-13-repeated-start-stability-closure`.
- Active and follow-up tasks: `memory-bank/tasks.md#fixed-system-app-restart-stability-wave---2026-03-13`.
- Architecture patterns that still apply: `memory-bank/systemPatterns.md`.
