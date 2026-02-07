# Active Context

> **Last Updated**: 2026-02-07
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Catalog Blocking Delete Stabilization (Completed)

**Status**: Completed implementation and targeted validation.

### Implemented in Stabilization Round
- Finalized backend-safe query shape for blocking catalog references:
  - `MetahubAttributesService.findCatalogReferenceBlockers(...)` uses table aliases compatible with `withSchema(...)` (`'_mhb_attributes as attr'`, `'_mhb_objects as obj'`).
  - Added active-row guards for both tables (`_upl_deleted=false`, `_mhb_deleted=false`) to avoid stale blockers.
- Unified catalog delete behavior from list mini-menu with edit-dialog delete path:
  - `CatalogActions` now routes delete action through `helpers.openDeleteDialog(...)` (same blocking-aware flow used by edit form delete button).
  - Added fallback path via `helpers.confirm(...)` for contexts where `openDeleteDialog` is unavailable.
- Updated action factory coverage test expectation to support descriptor shapes with `dialog` or `onSelect`.

### Validation Summary
- Passed:
  - `pnpm --filter @universo/metahubs-backend build`
  - `pnpm --filter @universo/metahubs-frontend build`
  - `pnpm --filter @universo/metahubs-frontend exec vitest run --config vitest.config.ts src/domains/metahubs/ui/__tests__/actionsFactories.test.ts -t "CatalogActions exports edit/delete descriptors for localized forms" --coverage=false`
  - `pnpm --filter @universo/metahubs-frontend exec eslint src/domains/catalogs/ui/CatalogActions.tsx src/domains/metahubs/ui/__tests__/actionsFactories.test.ts` (warnings only)
  - `pnpm --filter @universo/metahubs-backend exec eslint src/domains/metahubs/services/MetahubAttributesService.ts` (warnings only)
- Baseline limitations observed (not introduced by this stabilization):
  - Full `@universo/metahubs-frontend` test run still has pre-existing failures/timeouts and CSS-import test environment issues outside the touched path.
