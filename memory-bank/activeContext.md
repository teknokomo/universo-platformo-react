## Current Focus

**The reopened optimistic QA follow-up is fully fixed and re-validated; the branch is back in a QA-ready handoff state.**

### Current Session Goal (2026-03-09)

- Close the published runtime pending interaction gap for optimistic create/copy rows.
- Restore Metahubs optimistic copy placeholder integrity for Sets, Catalogs, and Enumerations.
- Re-verify the touched scope with focused tests and root `pnpm build` before handoff.

### Current Session Outcome (2026-03-09)

- `useCrudDashboard` now exposes a shared pending-interaction handler, and `ApplicationRuntime` BOOLEAN cells call it before dispatching inline runtime cell mutations.
- `CustomizedDataGrid` now reveals the running pending stripe only after deferred feedback is revealed for optimistic create/copy rows; unrevealed rows stay visually normal.
- `useCopySet`, `useCopyCatalog`, and `useCopyEnumeration` no longer reuse the source codename for optimistic copies when no new codename is provided.
- The remaining optimistic delete debug log in Publications was removed, and stale `react-i18next` test mocks were fixed in the touched Metahubs/Application runtime suites.
- Regression coverage now asserts the runtime pending-interaction contract, the grid pending-row class contract, and the empty-codename placeholder contract for copied Sets, Catalogs, and Enumerations.
- Validation finished green for `pnpm --filter @universo/apps-template-mui test` (3 files, 10 tests), targeted `ApplicationRuntime` regression coverage (1 file, 2 tests), `pnpm --filter @universo/metahubs-frontend test` (31 files, 122 tests), and root `pnpm build` (23/23 tasks).

### Expected Product Behavior After Closure

- Create/copy/edit dialogs still close immediately after optimistic dispatch.
- Optimistic create/copy rows look fully created by default; no pending indicator is shown until the user tries to interact with the still-pending entity.
- Unsafe runtime interaction attempts on pending create/copy rows are blocked consistently and reveal the running stripe feedback only after that attempt.
- Delete still removes the entity from the visible list immediately.
- Pending copied Sets, Catalogs, and Enumerations no longer surface stale source codenames while waiting for server confirmation.

### Files Most Relevant to the Current Work

- `packages/apps-template-mui/src/hooks/useCrudDashboard.ts`
- `packages/apps-template-mui/src/dashboard/components/CustomizedDataGrid.tsx`
- `packages/applications-frontend/base/src/pages/ApplicationRuntime.tsx`
- `packages/apps-template-mui/src/hooks/__tests__/useCrudDashboard.test.tsx`
- `packages/apps-template-mui/src/dashboard/components/__tests__/CustomizedDataGrid.test.tsx`
- `packages/applications-frontend/base/src/pages/__tests__/ApplicationRuntime.test.tsx`
- `packages/metahubs-frontend/base/src/domains/sets/hooks/mutations.ts`
- `packages/metahubs-frontend/base/src/domains/catalogs/hooks/mutations.ts`
- `packages/metahubs-frontend/base/src/domains/enumerations/hooks/mutations.ts`
- `packages/metahubs-frontend/base/src/domains/shared/__tests__/optimisticMutations.remaining.test.tsx`

### Validation Snapshot

- `pnpm --filter @universo/apps-template-mui test` → passed (3 files, 10 tests)
- targeted `pnpm exec vitest run --config vitest.config.ts src/pages/__tests__/ApplicationRuntime.test.tsx` in `applications-frontend/base` → passed (1 file, 2 tests)
- `pnpm --filter @universo/metahubs-frontend test` → passed (31 files, 122 tests)
- `pnpm build` → passed, 23/23 tasks green

### Current Technical Interpretation

- Pending interaction blocking must exist at both the generic row-action layer and any page-specific inline editors; hook-level safety alone is not enough.
- Deferred pending visuals remain opt-in by user interaction attempt, not default styling.
- Optimistic copy placeholders must preserve visibility-critical fields such as `name` while avoiding source identity leakage such as inherited `codename`.

### Immediate Next Step

- Wait for QA or user review.
- If another optimistic regression appears, check the exact rendered interaction path before assuming the shared mutation helpers already cover it.
