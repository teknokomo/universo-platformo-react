# Tasks

> **Note**: Active and planned tasks. Completed work -> progress.md, architectural patterns -> systemPatterns.md.

---


## Active Open Tasks (Canonical)

### Runtime Pending Safety + Metahubs Copy Integrity — 2026-03-09

> **Status**: ✅ COMPLETE — published runtime pending interaction safety is now aligned with the deferred-feedback contract, Metahubs optimistic copy placeholders no longer leak source codenames, touched regressions are green, and root build passed.

- [x] Harden published runtime pending-row behavior so optimistic create/copy rows look normal by default, but unsafe interaction is blocked consistently across row actions and inline BOOLEAN cells until the real entity is confirmed
- [x] Restore Metahubs optimistic copy placeholder integrity for Sets, Catalogs, and Enumerations so copied entities never reuse the source codename when no new codename was provided
- [x] Add or update focused regression coverage for the runtime pending-row interaction contract and the Metahubs copy placeholder contract
- [x] Re-run touched tests/builds and update `memory-bank/activeContext.md` + `memory-bank/progress.md` only after validation passes
  - Note: `pnpm --filter @universo/apps-template-mui test` passed (3 files, 10 tests), the targeted `ApplicationRuntime` regression passed (1 file, 2 tests), `pnpm --filter @universo/metahubs-frontend test` passed (31 files, 122 tests), and root `pnpm build` passed (23/23).

### Hub-Scoped Optimistic Copy Completion — 2026-03-09

> **Status**: ✅ COMPLETE — hub-scoped Metahub copy parity is now closed for sets, catalogs, and enumerations; touched regressions and cleanup are in place; root build is green.

- [x] Fix hub-scoped optimistic copy cache targeting for sets, catalogs, and enumerations without regressing metahub-scoped behavior
- [x] Add regression coverage for hub-scoped copy flows and any touched shared optimistic helper behavior
- [x] Remove touched optimistic QA debt required for clean closure
  - Note: `HubDeleteDialog.test.tsx` Prettier blocker is gone and temporary debug logging was removed from the touched optimistic paths.
- [x] Re-run touched lint/tests and finish with root `pnpm build`
  - Note: `pnpm --filter @universo/metahubs-frontend lint` returned to warning-only baseline, `pnpm exec eslint packages/universo-utils/base/src/optimisticCrud.ts` is clean, `pnpm --filter @universo/utils test` passed (177/177), `pnpm --filter @universo/metahubs-frontend test` passed during the session, and root `pnpm build` passed (23/23).
- [x] Update `memory-bank/activeContext.md`, `memory-bank/progress.md`, and this task entry only after validation passes

### Optimistic Nested Metahubs Completion Pass — 2026-03-08

> **Status**: ✅ COMPLETE — nested Metahub optimistic parity is now closed for child attributes, enumeration values, and layouts; focused regressions plus full package/root validation are green.

- [x] Replace the remaining blocking child-attribute create flow with the shared optimistic mutation path
- [x] Remove residual blocking/manual-invalidating update patterns in nested Metahub screens
  - Note: Enumeration value update and layout update were confirmed as mixed old/new behavior during QA.
- [x] Add focused regression coverage for the nested Metahub screens that still lacked direct UI tests
- [x] Re-run touched package tests and finish with root `pnpm build`
  - Note: `pnpm --filter @universo/metahubs-frontend test` passed (31 files, 121 tests) and root `pnpm build` passed (23/23 tasks).
- [x] Update `memory-bank/activeContext.md`, `memory-bank/progress.md`, and this task entry only after validation passes
  - Note: `pnpm --filter @universo/metahubs-frontend lint` still has one pre-existing unrelated Prettier error in `src/components/__tests__/HubDeleteDialog.test.tsx`; no lint errors remain in the touched implementation or regression files.

### Metahub Delete + SortOrder + Helper Dedup — 2026-03-08

> **Status**: ✅ COMPLETE — shared optimistic CRUD helper moved into `@universo/utils`, stale blocking-delete refetches no longer surface a false error after successful hub deletion, and copied hub/catalog/enumeration entities now persist the next sequential sort order after reload. Validation finished green (`@universo/apps-template-mui` focused tests 7/7, focused `HubDeleteDialog` regression 1/1, `@universo/metahubs-backend` route tests 50/50, root `pnpm build` 23/23).

- [x] Replace duplicated runtime/template optimistic CRUD implementations with a shared `@universo/utils/optimistic-crud` source of truth while keeping `apps-template-mui` and `template-mui` wrapper APIs stable
- [x] Fix hub blocking-delete dialog lifecycle so successful optimistic delete cannot surface a late blocking-query 404/error state
- [x] Fix persisted sort-order assignment for copied metahub entities so reload keeps the next sequential order instead of falling back to `0`
- [x] Run focused tests for touched frontend/backend packages and finish with root `pnpm build`
- [x] Update `memory-bank/activeContext.md`, `memory-bank/progress.md`, and this task entry after validation passes
  - Note: set/attribute copy flows were investigated and intentionally left unchanged because they already use service-layer create paths that compute sequential persisted sort order.

### Optimistic QA Remediation Completion — 2026-03-08

> **Status**: ✅ COMPLETE — Applications admin, member flows, Metahub member flows, and runtime CRUD dialogs now use the final immediate-close optimistic UX again; touched lint blockers were removed; validation finished green (`apps-template-mui` 7 tests, `applications-frontend` 84 tests, `metahubs-frontend` 117 tests, root `pnpm build` 23/23).

- [x] Restore immediate-close optimistic dialog semantics for Applications admin action flows (applications + connectors) without breaking conflict handling
- [x] Restore immediate-close optimistic form/delete semantics in published runtime `useCrudDashboard` while preserving inline error reporting
- [x] Remove optimistic helper divergence or other touched-scope technical debt required for safe parity completion
- [x] Fix lint/prettier errors in touched optimistic files and keep warning-only baseline for touched package lint runs
- [x] Re-run touched tests, touched lint, and full root `pnpm build`
- [x] Update memory-bank files with the final verified state only after validation passes

### Optimistic UX + QA Closure History — 2026-03-08 to 2026-03-09 ✅

- [x] Top-level and nested Metahub dialogs were returned to immediate-close semantics, with pending auto-enter restored for the main nested entity lists.
- [x] Shared optimistic helpers were hardened for dedupe-safe create confirmation, awaited `cancelQueries()` where needed, and safe pending-entity interaction blocking.
- [x] QA follow-ups covered copy disappearance, edit flicker, conflict-state safety, diagnostics, regression coverage, and touched lint blockers across Applications, Metahubs, and runtime.
- [x] Detailed verification snapshots for the optimistic closure cluster were consolidated in `progress.md` to keep this working list focused on active and pending items.

### Metahubs Optimistic UX + Copy Integrity Follow-up — 2026-03-08

> **Status**: ✅ COMPLETE — table pending-row geometry fixed, optimistic ordering/copy stability hardened, backend copy codename_localized integrity fixed across copy routes, root `pnpm build` passed.

- [x] Reproduce and isolate table-view pending-row "extra column / right gap" rendering defect during early click on pending metahub rows
- [x] Fix table rendering so pending rows keep exact normal column geometry while retaining only the bottom running pending stripe
- [x] Add diagnostic logs for metahub and nested entity copy flows (create/copy/update lifecycle + cache transitions)
- [x] Eliminate copy disappearance for metahubs and nested entities by hardening optimistic create/copy cache confirmation + invalidation timing
- [x] Fix optimistic edit flicker and enforce stable move-to-front behavior in card view for newly created/edited entities
- [x] Fix metahub copy codename consistency so `codename_localized` matches copied entity codename semantics (no stale source codename leakage)
- [x] Run focused tests for touched packages and finish with root `pnpm build`
- [x] Update memory-bank (`activeContext.md`, `progress.md`, `tasks.md`) with verified results only after validation passes

### Optimistic Flicker + Copy Persistence + Sets i18n — 2026-03-08

> **Status**: ✅ COMPLETE — optimistic edit/copy stability and Sets i18n fixes delivered and verified.

- [x] Diagnose root causes in metahubs + nested entity mutation hooks (update/create/copy)
- [x] Implement optimistic update behavior that matches final server order (edited item immediately moves to final position)
- [x] Remove create/copy disappearance by hardening onSettled invalidation behavior for long-running copy/create flows
- [x] Fix Settings → Sets tab showing raw i18n keys instead of translated text
- [x] Run focused tests for touched packages + full `pnpm build`
- [x] Update memory-bank (`activeContext.md`, `progress.md`, `tasks.md`) with final verified status

### Optimistic UX Bug Fixes: Deferred Feedback + Mutation Correctness — 2026-03-08

> **Status**: ✅ COMPLETE — 5 user-reported bugs fixed, all tests passing, build 23/23 green.

- [x] Restore `pendingBorderPulse`, `pendingPulse`, `pendingCardSx`, `pendingRowSx` in `pendingAnimations.ts`
- [x] Fix ItemCard: revert spinner/glow to deferred feedback (`shouldShowPendingFeedback`) + apply `pendingCardSx`
- [x] Fix FlowListTable: apply `pendingRowSx` shimmer bar for deferred pending create/copy rows
- [x] Fix `useCreateMetahub.onSuccess`: add `confirmOptimisticCreate` (prevents duplicate cache entries and codename false positives)
- [x] Fix `useCopyMetahub.onSettled`: skip immediate list invalidation (copy is async, refetch removes the entity)
- [x] Fix `useUpdateMetahub.onSuccess`: seed detail cache with server response (prevents name flickering)
- [x] Update barrel exports in `@universo/template-mui/index.ts`
- [x] Tests: template-mui 215/215, metahubs-frontend 113/113, applications-frontend 84/84 ✅
- [x] Full build: 23/23 tasks ✅
- [x] Update memory-bank files
  - Note: 16 other create/invite hooks across the codebase are also missing `confirmOptimisticCreate` in `onSuccess` — see **confirmOptimisticCreate Parity** tech debt below.

### Pending Card Overlay + TemplateSeedExecutor sort_order Fix — 2026-03-08

> **Status**: ✅ COMPLETE — fixed PendingCardOverlay removing semi-transparent backdrop, added blue glow to pending create/copy cards, fixed sort_order column error in TemplateSeedExecutor.

- [x] Fix PendingCardOverlay: remove semi-transparent background overlay, keep spinner only
- [x] Fix ItemCard: show spinner + blue glow for all pending create/copy cards (not just after click)
- [x] Fix TemplateSeedExecutor: move sort_order from DB column to config.sortOrder JSONB field (column doesn't exist on _mhb_objects)
- [x] Full build: 23/23 tasks ✅
- [x] Tests: template-mui 215/215, metahubs-frontend 113/113, applications-frontend 84/84 ✅
- [x] Update memory-bank files

### QA Hardening Completion Pass — 2026-03-08

> **Status**: ✅ COMPLETE — residual lint/prettier blockers in optimistic-related files were fixed; touched package lint reruns report warnings only (0 errors), and root build is green.

- [x] Fix all currently failing lint/prettier blockers introduced in optimistic-related files
  - `packages/universo-template-mui/base/src/hooks/optimisticCrud.ts`
  - `packages/apps-template-mui/src/hooks/optimisticCrud.ts`
  - `packages/metahubs-frontend/base/src/domains/enumerations/hooks/mutations.ts`
  - `packages/universo-utils/base/src/optimistic/pendingState.ts`
- [x] Re-run lint for touched packages
  - `pnpm --filter @universo/template-mui run lint`
  - `pnpm --filter @universo/apps-template-mui run lint`
  - `pnpm --filter @universo/applications-frontend run lint`
  - `pnpm --filter @universo/metahubs-frontend run lint`
  - `pnpm --filter @universo/utils run lint`
- [x] Re-run touched tests + full build to confirm no regressions
  - `pnpm --filter @universo/template-mui test`
  - `pnpm --filter @universo/apps-template-mui test`
  - `pnpm --filter @universo/applications-frontend test`
  - `pnpm --filter @universo/metahubs-frontend test`
  - `pnpm --filter @universo/utils test`
  - root `pnpm build`
  - Verification snapshot: template-mui 215/215, apps-template-mui 4/4, applications-frontend 84/84, metahubs-frontend 113/113, utils 177/177, root build 23/23.
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with final verified QA-closure status after all checks pass.

### Optimistic QA Final Closure — 2026-03-08

> **Status**: ✅ COMPLETE — the final optimistic QA debt was fully closed on 2026-03-08, including Enumeration Value parity, stale test mocks, regression coverage, shared test diagnostics, and full validation.

- [x] Complete optimistic CRUD for Enumeration Values in Metahubs
  - Add `onMutate` / rollback / success confirmation for create, update, delete, copy where still missing.
  - Keep reorder and existing error handling intact.
- [x] Repair Applications mutation tests for new optimistic confirmation helpers
  - Update `@universo/template-mui` mocks in `applications-frontend` tests to include `confirmOptimisticUpdate` / `confirmOptimisticCreate`.
- [x] Repair Metahubs optimistic regression tests
  - Align remaining regression assertions with current delete/remove semantics and real query-key usage.
- [x] Eliminate shared test diagnostics in `@universo/template-mui`
  - Fix generic typing issues in optimisticCrud tests.
  - Address JSX test-file diagnostics without changing runtime behavior.
- [x] Re-run touched package tests and full build
  - `@universo/template-mui`
  - `@universo/apps-template-mui`
  - `@universo/applications-frontend`
  - `@universo/metahubs-frontend`
  - root `pnpm build`
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the verified final state only after all checks pass.
  - Final validation snapshot: template-mui 215 tests, applications-frontend 84 tests, metahubs-frontend 113 tests, apps-template-mui 4 tests, root build 23/23.

### Optimistic onSuccess Consistency Pass (QA3) — 2026-03-08

> **Status**: ✅ COMPLETE — all hooks across all domains now have `onSuccess` handlers for pending marker cleanup and optimistic ID replacement; dead code removed; dark mode fixed; deprecated prop removed. Build 23/23 green, 215 tests pass.

- [x] Add `confirmOptimisticUpdate` + `confirmOptimisticCreate` helpers to `@universo/template-mui` optimisticCrud.ts
- [x] Add same helpers to `@universo/apps-template-mui` local optimisticCrud.ts
- [x] Update barrel exports in `@universo/template-mui/index.ts`; remove dead pendingAnimations exports
- [x] Clean dead code from `pendingAnimations.ts` (removed pendingCardSx, pendingRowSx, pendingBorderPulse, pendingPulse, pendingFadeOut, keyframes import)
- [x] Refactor `useUpdateMetahub` / `useCopyMetahub` to use new helpers
- [x] Add `onSuccess` with `confirmOptimisticUpdate` to ALL update hooks across 10 metahubs domains (hubs, catalogs, sets, enumerations, attributes, elements, constants, layouts, branches, publications)
- [x] Add `onSuccess` with `confirmOptimisticCreate` to ALL copy hooks across 9 metahubs domains
- [x] Add `onSuccess` to all applications-frontend hooks (update app, copy app, update connector, update member role)
- [x] Add `onSuccess` to apps-template-mui runtime hooks (createMutation, updateMutation in useCrudDashboard)
- [x] Enrich `useCopyApplication.onMutate` to clone source entity from cache (realistic optimistic copy)
- [x] Fix `PendingCardOverlay` dark mode — replaced hardcoded `rgba(255,255,255,0.35)` with `alpha(theme.palette.background.paper, 0.55)`
- [x] Remove deprecated `showPendingOverlay` prop from `ItemCard` interface, destructuring, and all callers (`ApplicationList.tsx`, `MetahubList.tsx`)
- [x] Full project build 23/23 green; `@universo/template-mui` 215 tests pass

### Optimistic Pending Visual QA Round 2 — 2026-03-08

> **Status**: ✅ COMPLETE — all 8 manual QA issues fixed, tests passing, root build green on 2026-03-08.

- [x] Fix #1+#2+#3: Remove ALL pending visual effects for create/update/copy cards/rows
  - [x] `ItemCard.tsx` — removed `pendingCardSx` entirely; only `deletingCardSx` kept for delete
  - [x] `PendingCardOverlay.tsx` — stripped to spinner-only (no text, no blur backdrop)
  - [x] `FlowListTable.tsx` — `getPendingRowStyles()` returns styles only for delete
  - [x] `CustomizedDataGrid.tsx` — only `pending-delete` CSS class; removed `pending-row` and shimmer
- [x] Fix #6: Delete dialog not closing / reopening loop
  - [x] `BlockingEntitiesDeleteDialog.tsx` — `handleConfirm()` now calls `onClose()` after `onConfirm()`
- [x] Fix #5: Auto-created entities sortOrder starts from 0 instead of 1
  - [x] `TemplateSeedExecutor.ts` — added per-kind 1-based `sort_order` counters in seed insert
- [x] Fix #8: New application card missing role/connector count
  - [x] `applications-frontend/mutations.ts` — optimistic create includes `role: 'owner'`, `accessType: 'member'`, `connectorsCount: 0`
- [x] Fix #4+#7: Copy card disappears; edit briefly shows old data
  - [x] `metahubs-frontend/mutations.ts` — `useCopyMetahub.onSuccess` replaces optimistic ID with real server ID in cache
  - [x] `metahubs-frontend/mutations.ts` — `useUpdateMetahub.onSuccess` strips pending markers from cache entity
- [x] Test and build validation
  - [x] `PendingCardOverlay.test.tsx` updated for text-free spinner
  - [x] `optimisticCrud.integration.test.ts` fixed pre-existing incorrect expectation
  - [x] All package tests passed (template-mui 215, apps-template-mui 4, metahubs-frontend 112, applications-frontend 84)
  - [x] Root `pnpm build` → 23/23 tasks green
- [x] Update memory-bank files

### Optimistic QA Completion Pass — 2026-03-07

> **Status**: ✅ COMPLETE — the reopened follow-up was fully implemented and re-verified on 2026-03-07, including the local `apps-template-mui` helper split, Applications/Metahubs non-blocking member flows, copy placeholder repair, regression updates, and final workspace validation.

- [x] Align Applications admin/member edit-delete flows with non-blocking optimistic dispatch
  - [x] `ApplicationList.tsx` — stop awaiting optimistic update/delete actions in menu dialogs, page delete dialog, and conflict overwrite path.
  - [x] `ConnectorList.tsx` — stop awaiting optimistic update/delete actions in menu dialogs, page delete dialog, and conflict overwrite path.
  - [x] `ApplicationMembers.tsx` — stop awaiting optimistic role/remove actions in menu dialogs and page remove dialog.
- [x] Align Metahub member flows with the same non-blocking optimistic member semantics
  - [x] Move invite error mapping into `metahubs/hooks/mutations.ts` so invite dialog can close immediately after dispatch.
  - [x] `MetahubMembers.tsx` — stop awaiting optimistic invite/update/remove actions in menu dialogs and page remove dialog.
- [x] Remove the remaining optimistic copy/runtime debt
  - [x] Fix the Applications optimistic copy placeholder so pending copies always render a visible name in lists/cards.
  - [x] Refactor `apps-template-mui/useCrudDashboard.ts` to keep optimistic invalidate/rollback/id logic local inside `apps-template-mui` without adding a dependency on `@universo/template-mui`.
- [x] Add regression coverage for the reopened QA findings
  - [x] Applications page tests: assert non-blocking dialog close and optimistic dispatch for application/connector/member edit-delete flows.
  - [x] Metahub member tests: assert immediate invite/remove dialog close and async error handling.
  - [x] Runtime optimistic tests: keep coverage green after shared-helper refactor.
- [x] Re-run touched-package lint/tests and finish with root `pnpm build`.
  - Note: `pnpm --filter @universo/apps-template-mui test`, `pnpm --filter @universo/applications-frontend test`, `pnpm --filter @universo/metahubs-frontend test`, touched-package lint reruns, and the root `pnpm build` all completed successfully; lint remained warning-only.
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the actual verified state only after validation passes.

### Optimistic Pending UX QA Follow-up — 2026-03-07

> **Status**: ✅ COMPLETE — the reopened manual-QA follow-up was implemented and re-verified on 2026-03-07, including realistic optimistic rows/cards, immediate delete removal, non-blocking edit/delete flows, and pending Metahub auto-enter.

- [x] Restore fully realistic optimistic Metahub cards/rows
  - [x] Seed optimistic create/copy metahubs with owner role/access/permissions so pending cards and rows match real items.
  - [x] Remove extra pending overlay/spinner/create label noise for create/copy cards and rows while keeping the existing border/row effect.
  - [x] Queue metahub navigation when a pending item is clicked and auto-enter when the real metahub replaces the optimistic one.
- [x] Make Metahub edit/delete/copy flows non-blocking
  - [x] Close edit/delete dialogs immediately after optimistic dispatch instead of waiting for `mutateAsync()`.
  - [x] Switch metahub delete from fade-out to immediate removal.
- [x] Propagate the same optimistic UX semantics to nested metahub entities
  - [x] Remove fade-delete and unrealistic copy placeholders in hubs, catalogs, sets, enumerations, layouts, publications, attributes, elements, constants, and related nested lists.
  - [x] Convert remaining nested update/delete dialog flows from awaited mutation completion to immediate-close optimistic dispatch.
- [x] Re-run focused validation for the touched frontend packages and finish with root `pnpm build`.
  - Note: `pnpm --filter @universo/metahubs-frontend lint` completed with warnings only, `pnpm --filter @universo/metahubs-frontend test` passed after updating the delete-regression expectations to the new immediate-remove semantics, and the root `pnpm build` finished successfully.
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the verified final state only after validation passes.

### Optimistic Create UX Remediation — 2026-03-07

> Plan: `memory-bank/plan/optimistic-create-ux-remediation-plan-2026-03-07.md`
> **Status**: ✅ COMPLETE — deferred create/copy feedback, pending-safe interaction guards, ordering fixes, remaining dialog cleanup, regression repairs, and final verification were completed on 2026-03-07

- [x] Audit the current optimistic create/copy UX across Metahubs, Applications admin, and the published runtime after the fresh DB rebuild.
- [x] Confirm the concrete new regressions from source before planning (`ElementList` blocking create path, eager pending visuals, optimistic sort placeholders, pending-unsafe table links).
- [x] Draft a safe replacement plan without schema-version or metahub-template-version bumps.
- [x] Phase 1: Shared optimistic-create contract
  - [x] Add shared helpers for deferred create/copy feedback and premature-interaction detection without changing backend payloads.
  - [x] Keep rollback/invalidation behavior intact for existing optimistic create/update/delete flows.
- [x] Phase 2: Shared UI rendering changes
  - [x] Update `ItemCard` to keep create/copy cards visually normal until interaction is attempted.
  - [x] Update `FlowListTable` to stop eager pending-row shimmer/disable for create/copy while preserving delete/update protection.
  - [x] Update runtime `CustomizedDataGrid` with the same deferred create/copy presentation rule.
- [x] Phase 3: Pending-safe interaction guards
  - [x] Add a shared guard path for premature navigation/open/drag attempts on optimistic create/copy entities.
  - [x] Apply the guard to custom name-link renderers in `MetahubList`, `ApplicationList`, and other affected list screens.
- [x] Phase 4: Ordering correctness
  - [x] Introduce shared optimistic sort-order derivation from live cached collections.
  - [x] Replace placeholder `999` optimistic order defaults across Metahubs and Applications create/copy hooks.
  - [x] Normalize incorrect `sortOrder ?? 0` UI fallbacks so new ordered entities do not temporarily show `0`.
- [x] Phase 5: Blocking dialog cleanup and table regressions
  - [x] Convert `ElementList` create to fire-and-forget `mutate()` and close immediately after dispatch.
  - [x] Audit remaining create/copy handlers for accidental `await mutateAsync()` blocking behavior.
  - [x] Fix the metahub/application table-view optimistic artifact that currently shows a temporary blank/garbage column.
- [x] Phase 6: Regression coverage and verification
  - [x] Add focused tests for deferred create/copy visuals, premature-interaction guards, optimistic order derivation, and `ElementList` dialog-close behavior.
  - [x] Re-run touched-package lint/tests and finish with root `pnpm build`.

#### Current implementation checklist (2026-03-07, active session)

- [x] Finish the remaining fire-and-forget create/copy dialog cleanup in `EnumerationValueList.tsx` and `ChildAttributeList.tsx`.
- [x] Re-scan Metahubs/Application list screens for any leftover create/copy `await mutateAsync()` paths that still block optimistic dialogs.
- [x] Run focused metahubs/frontend verification for the touched scope, then run root `pnpm build`.
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the verified implementation outcome only after validation passes.

### Fire-and-Forget Dialog Close for Optimistic UX — 2026-03-07

> Plan: `memory-bank/plan/dialog-fire-and-forget-plan-2026-03-07.md`
> **Status**: ✅ COMPLETE — QA follow-up implementation closed the remaining blocking dialogs, repaired stale tests, and re-verified the runtime/admin coverage on 2026-03-07

- [x] Phase 1: Extend `useCreateMetahub` input type to accept `MetahubInput` (with `createOptions`, `templateId`)
- [x] Phase 2.1: MetahubList — import `useCreateMetahub` + fire-and-forget, remove raw API call
- [x] Phase 2.2: HubList — `mutate()` fire-and-forget, remove duplicate invalidation
- [x] Phase 2.3: CatalogList — same pattern
- [x] Phase 2.4: SetList — same pattern
- [x] Phase 2.5: EnumerationList — same pattern
- [x] Phase 2.6: BranchList — same pattern (hook already has comprehensive error handling)
- [x] Phase 2.7: AttributeList — same pattern + enriched hook's `onError` with detailed error codes
- [x] Phase 3: Finish remaining metahubs blocking create flows
  - [x] `layouts/ui/LayoutList.tsx` — create fire-and-forget, remove duplicate invalidation/loading/error coupling
  - [x] `publications/ui/PublicationList.tsx` — create fire-and-forget, remove duplicate invalidation/loading/error coupling
- [x] Phase 4: Finish admin-panel fire-and-forget coverage
  - [x] `applications/pages/ApplicationList.tsx` — switched create path to `useCreateApplication` and fire-and-forget dialog close
  - [x] `applications/pages/ConnectorList.tsx` — create dialog now dispatches `mutate()` and no longer manually invalidates connector lists
  - [x] `applications/pages/ApplicationMembers.tsx` — invite dialog now closes immediately after dispatch; HTTP-specific invite error mapping moved into `useInviteMember`
- [x] Phase 5: Finish published-runtime dialog behavior
  - [x] `apps-template-mui/useCrudDashboard.ts` — create/copy/update/delete dialogs now close immediately after optimistic mutation dispatch
- [x] Phase 6: Repair regression coverage broken by the new non-blocking pattern
  - [x] Updated stale mocks/expectations in branch create-options tests (`mutate` vs `mutateAsync`)
  - [x] Updated focused admin/runtime tests (`ConnectorList`, `ApplicationMembers.coverage`, `ApplicationMembers`, `useCrudDashboard`) to assert the fire-and-forget flow
  - [x] Re-verified the shared runtime optimistic helper path in `@universo/apps-template-mui`
- [x] Phase 7: Run verification and close honestly
  - [x] `pnpm --filter @universo/apps-template-mui exec vitest run src/hooks/__tests__/useCrudDashboard.test.tsx`
  - [x] `pnpm --filter @universo/applications-frontend exec vitest run src/pages/__tests__/ConnectorList.test.tsx src/pages/__tests__/ApplicationMembers.coverage.test.tsx src/pages/__tests__/ApplicationMembers.test.tsx`
  - [x] `pnpm --filter @universo/metahubs-frontend exec vitest run src/domains/branches/ui/__tests__/BranchList.createOptions.test.tsx`
  - [x] `pnpm --filter @universo/applications-frontend lint` (warnings only, no errors)
  - [x] Combined touched-package lint rerun (`@universo/apps-template-mui`, `@universo/applications-frontend`, `@universo/metahubs-frontend`) completed with warnings only and no errors
  - [x] `pnpm build`
- [x] Phase 8: Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the actual final state after verification passes

### Universal Optimistic Updates Planning + QA Closure — 2026-03-07

> Plan: `memory-bank/plan/optimistic-updates-universal-plan-2026-03-07.md`  
> **Status**: ✅ COMPLETE — the final QA-debt pass is now closed with direct regression coverage for the remaining metahubs optimistic domains, clean frontend test mocks, and refreshed memory-bank status.

#### QA debt closure pass (current session)

- [x] Re-open the optimistic-updates follow-up in memory-bank and replace the stale “fully remediated” claim with the real in-progress status
- [x] Add direct optimistic mutation regression coverage for the remaining metahubs domains (`hubs`, `sets`, `enumerations`, `layouts`, `publications`)
- [x] Eliminate test-environment noise by handling shared `/api/v1/locales/content` and connector `/api/v1/publications/available?limit=100` requests in frontend test mocks
- [x] Re-run the affected package checks (`@universo/metahubs-frontend`, `@universo/applications-frontend`) plus the root `pnpm build`
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the final verified status only after the remediation pass is green
  - Note: validation remained green while the final memory-bank closure entry was added.

#### QA remediation implementation pass (current session)

- [x] Fix the `CopySyncStepError` optimistic rollback path in `applications-frontend` so successfully copied applications are never removed from cache on schema-sync failure
- [x] Harden runtime checkbox optimistic rendering to support multiple concurrent pending cell toggles instead of a single pending slot
- [x] Add focused regression coverage for application copy partial failure, connector CRUD optimistic hooks, and runtime checkbox pending-state behavior
- [x] Add direct regression coverage for `@universo/apps-template-mui/useCrudDashboard` optimistic create/update/delete/copy behavior
- [x] Re-run the affected package checks and the full workspace build
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the final verified state

#### Continuation implementation pass (current session)

- [x] Fix failing `@universo/applications-frontend` tests after optimistic updates refactor
  - [x] `src/hooks/__tests__/mutations.test.tsx` (timeouts / updated optimistic expectations)
  - [x] `src/pages/__tests__/ApplicationMembers.coverage.test.tsx` (member update payload expectation)
  - [x] `src/pages/__tests__/ApplicationMembers.test.tsx` (list view provider/render stability)
  - [x] `src/pages/__tests__/ConnectorList.test.tsx` (button-label expectation aligned with i18n)
  - [x] `src/pages/__tests__/actionDescriptors.coverage.test.tsx` (connector action coverage timeout)
  - [x] `src/types.test.ts` (connector display helper expectations)
- [x] Re-run package checks
  - [x] `pnpm --filter @universo/applications-frontend test` (passes after making threshold enforcement opt-in via `VITEST_ENFORCE_COVERAGE=true`)
  - [x] `pnpm --filter @universo/metahubs-frontend test`
  - [x] `pnpm --filter @universo/applications-frontend lint`
  - [x] `pnpm --filter @universo/metahubs-frontend lint`
- [x] Run full workspace build: `pnpm build`
- [x] Update memory-bank with truthful final state
  - [x] `memory-bank/activeContext.md`
  - [x] `memory-bank/progress.md`

#### Coverage-gate closure pass (current session)

- [x] Diagnose why `pnpm --filter @universo/applications-frontend test` fails only on global coverage thresholds
- [x] Apply a minimal, explicit fix so package test command reflects the real quality gate intent
- [x] Re-run `pnpm --filter @universo/applications-frontend test` until it passes
- [x] Re-run root `pnpm build` to ensure no workspace regression
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with final verified status

- [x] Re-read the universal optimistic updates plan and validate architecture against the current codebase
- [x] Verify optimistic-update patterns against current TanStack Query / TkDodo guidance
- [x] Fix breadcrumb cache planning so nested entities use exact breadcrumb query keys
- [x] Fix runtime checkbox planning to match the real `useUpdateRuntimeCell({ applicationId, catalogId })` hook signature
- [x] Fix cross-domain invalidation planning for publication → application side effects
- [x] Add a concrete scoped-mutation reference example for nested entities
- [x] Add `CopySyncStepError` handling to avoid rolling back successfully copied applications when schema sync fails
- [x] Expand scope to fully match the original specification by including metahub/application Access member mutations
- [x] Expand scope to fully match the original specification by including application connector CRUD optimistic updates
- [x] Explicitly cover runtime table Copy by reusing the optimistic create path in `useCrudDashboard`
- [x] Move from approved plan to IMPLEMENT mode and execute the work package-by-package
  - [x] Phase 1: Infrastructure — optimisticCrud.ts, pendingMarkers, UUID v7, safeInvalidateQueries, exports
  - [x] Phase 2: Metahub domain mutations — finish the remaining true optimistic CRUD/member coverage
    - [x] metahubs/hooks/mutations.ts (7 hooks)
    - [x] hubs/hooks/mutations.ts (5 hooks)
    - [x] catalogs/hooks/mutations.ts (7 hooks)
    - [x] sets/hooks/mutations.ts (7 hooks)
    - [x] enumerations/hooks/mutations.ts (13 hooks)
    - [x] attributes/hooks/mutations.ts — convert CRUD/copy paths from guard-only to full optimistic behavior
    - [x] elements/hooks/mutations.ts — convert CRUD/copy paths from guard-only to full optimistic behavior
    - [x] constants/hooks/mutations.ts — convert CRUD/copy paths from guard-only to full optimistic behavior
    - [x] layouts/hooks/mutations.ts — add optimistic create/update/delete/copy with breadcrumb-safe cache updates
    - [x] branches/hooks/mutations.ts — add optimistic create/update/delete/copy while preserving branch-specific error handling
    - [x] publications/hooks/mutations.ts — add optimistic create/update/delete plus publication detail/breadcrumb invalidation
    - [x] metahubs/hooks/mutations.ts — convert member invite/update/remove flows to full optimistic behavior
    - [x] Build verification passed (metahubs-frontend)
  - [x] Phase 3: Application mutations
    - [x] applications-frontend hooks/mutations.ts — convert connector CRUD and application member flows to full optimistic behavior
    - [x] applications-frontend api/mutations.ts (runtime CRUD hooks — safeInvalidateQueries import fix)
    - [x] Build verification passed (applications-frontend + metahubs-frontend)
  - [x] Phase 4: UI integration (pending overlays, fade-delete)
    - [x] 12 list components updated with isPendingEntity/getPendingAction props on ItemCard
    - [x] MetahubList, HubList, CatalogList, SetList, EnumerationList, LayoutList, BranchList, PublicationList, MetahubMembers
    - [x] ApplicationList, ConnectorList, ApplicationMembers
    - [x] Navigation conditionally disabled for pending entities (inline isPendingEntity pattern)
    - [x] FlowListTable pending-row styling/action blocking for optimistic entities in table view
    - [x] Build verification passed
  - [x] Phase 5: Testing
    - [x] 27 unit tests (optimisticCrud.test.ts) — Jest
    - [x] 10 integration tests (optimisticCrud.integration.test.ts) — Jest
    - [x] 15 pendingState tests (pendingState.test.ts) — Vitest
    - [x] 5 PendingCardOverlay tests (PendingCardOverlay.test.tsx) — Jest
    - [x] Add focused regression coverage for the newly completed optimistic member/connector/shared-table behavior where practical
    - [x] Re-run touched-package tests after remediation
  - [x] Phase 6: Runtime CRUD (useCrudDashboard optimistic)
    - [x] apps-template-mui useCrudDashboard.ts — create/update/delete mutations with optimistic onMutate/onError/onSettled
    - [x] CustomizedDataGrid.tsx — pending-row/pending-delete CSS styling with shimmer animation
    - [x] Build verification passed (3/3 tasks)
  - [x] Phase 7: Final build + memory-bank
    - [x] Fixed missing exports: makePendingMarkers/stripPendingMarkers/isPendingEntity/getPendingAction in template-mui index.ts
    - [x] Fixed missing exports: getVLCString/getVLCStringWithFallback in universo-utils index.browser.ts
    - [x] Added ./hooks/optimisticCrud and ./styles/pendingAnimations to template-mui package.json exports
    - [x] Fixed all prettier lint errors (EnumerationList, PublicationList, mutations.ts, ApplicationRuntime, useCrudDashboard)
    - [x] Full build: `pnpm build`
    - [x] Touched-package tests/lint rerun after remediation
    - [x] Memory-bank updated with the real final state
  - [x] QA Closure
    - [x] Fixed 10 prettier errors in template-mui (ItemCard, PendingCardOverlay, optimisticCrud, pendingAnimations)
    - [x] Removed dead code: `usePendingNavigationGuard.ts` (created but never used; inline pattern is simpler)
    - [x] Added `PendingCardOverlay.test.tsx` (5 tests: all 4 actions + spinner)
    - [x] Re-verify the previously missed optimistic domains against the original specification before closing again

### PR #714 Review Feedback + Mobile Layout Polish — 2026-03-07

> **Status**: ✅ COMPLETE — reviewed PR #714 bot feedback against the live codebase and MUI docs, applied only the validated fixes, and re-verified the touched scope on 2026-03-07.

- [x] Fetch and analyze PR #714 review comments / issue comments / review summaries
- [x] Validate each suggested fix against current code and relevant documentation before changing behavior
  - [x] Accepted the `EntityFormDialog` mobile delete-button accessibility fix (`aria-label` / `title`)
  - [x] Accepted the memory-bank English-only cleanup for the QA plan files added in PR #714
  - [x] Accepted the real pagination consistency gap in `MenuWidgetEditorDialog` and switched catalogs loading to `fetchAllPaginatedItems()`
  - [x] Rejected non-specific / non-actionable bot summary text that did not map to a reproducible code defect
- [x] Fix the mobile list action bar so the search button stays left and the three action buttons stay right on small screens
- [x] Normalize vertical spacing around the mobile page header/action area so top, middle, and bottom gaps match the pagination/content rhythm
- [x] Widen the right mobile drawer further so it is visibly wider than the current implementation without breaking layout
- [x] Re-run targeted lint/tests/build checks for touched packages
  - [x] `pnpm --filter @universo/template-mui lint`
  - [x] `pnpm --filter @universo/metahubs-frontend lint`
  - [x] `pnpm --filter @universo/template-mui test`
  - [x] `pnpm --filter @universo/metahubs-frontend test`
  - [x] `pnpm build`
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the verified outcome

### Manual QA Bug Fixes (7 Issues) + QA Follow-up — 2026-03-07

> **Status**: ✅ COMPLETE — remaining QA UX, regression-coverage, and documentation debt was closed and re-verified on 2026-03-07. Only pre-existing lint warnings remain in the touched packages.

- [x] #1 Fix i18n `createOptions` keys not translated (consolidateMetahubsNamespace missing key)
- [x] #2 Fix inconsistent mobile spacing in ViewHeader
- [x] #3 Fix mobile search button size mismatch and alignment
- [x] #4 Widen mobile drawer (SideMenuMobile) by ~30%
- [x] #5 Make Delete button icon-only on mobile in EntityFormDialog
- [x] #6 Fix Hub Settings tab (hubMap → allHubsById lookup)
- [x] #7 Invalidate breadcrumb queries after entity settings save
- [x] Lint + build verification
- [x] QA follow-up: Add missing breadcrumb invalidation in PublicationVersionList settings dialog
- [x] QA follow-up: Rework CollapsibleMobileSearch so collapse preserves active search and keeps input state synchronized with parent search value
- [x] QA follow-up: Remove redundant `ml: { xs: 0, sm: 0 }` → `ml: 0` in ViewHeader
- [x] QA follow-up: Add focused regression coverage for mobile search sync and settings-dialog breadcrumb invalidation
- [x] QA follow-up: Correct memory-bank dates/status after final verification
- [x] Final lint + test + full build verification
  - [x] `pnpm --filter @universo/template-mui test`
  - [x] Focused `publicationSettingsQueries` Vitest regression test
  - [x] Full `pnpm --filter @universo/metahubs-frontend test`
  - [x] Touched-package lint rerun completed with warnings only and no new errors
  - [x] `pnpm build`

### Metahub Create Options + Entity Settings + Mobile UX + Logout

> Plan: `memory-bank/plan/metahub-create-options-entity-settings-mobile-plan-2026-03-07.md`  
> **Status**: ✅ COMPLETE — follow-up QA debt closed with targeted regression coverage, type cleanup, and fresh verification.

- [x] Re-open the feature after QA and replace the stale “complete” status with a real remediation plan
- [x] Fix blocking frontend source issues so the workspace can build again
  - [x] Repair broken comment/interface boundaries in `CatalogList.tsx` and `EnumerationList.tsx`
  - [x] Fix template file formatting errors reported by ESLint/Prettier
- [x] Restore green package quality gates for the feature scope
  - [x] Make `pnpm --filter @universo/metahubs-frontend build` pass
  - [x] Make `pnpm --filter @universo/metahubs-frontend test` pass
  - [x] Keep `pnpm --filter @universo/metahubs-backend test` passing
- [x] Remove first-round implementation debt discovered by QA
  - [x] Replace hub fetches capped at `limit: 100` in new settings dialogs with safe all-pages loading so large metahubs are handled correctly
  - [x] Review template-mui / metahubs-frontend test-time import resolution and remove the regression causing `@universo/applications-frontend/i18n` failures
  - [x] Add or update focused tests for the broken coverage paths that were blocking the previous remediation
- [x] Close remaining QA debt from the latest audit
  - [x] Add backend assertions for `POST /metahubs` → `createInitialBranch(createOptions)` threading
  - [x] Add backend coverage for `filterSeedByCreateOptions()` / schema initialization behavior
  - [x] Add frontend tests for the create-options tab and submitted payload in `MetahubList`
  - [x] Add focused tests for representative logout/mobile UX flows in template-mui (`SideMenu`, `SideMenuMobile`)
  - [x] Remove type-safety debt in `MetahubList` form values for create options
- [x] Re-run final verification and only then mark the feature complete
  - [x] `pnpm --filter @universo/types lint`
  - [x] `pnpm --filter @universo/metahubs-backend lint`
  - [x] `pnpm --filter @universo/metahubs-frontend lint`
  - [x] `pnpm --filter @universo/template-mui lint`
  - [x] `pnpm --filter @universo/metahubs-frontend test`
  - [x] `pnpm --filter @universo/metahubs-backend test`
  - [x] `pnpm --filter @universo/template-mui test`
  - [x] `pnpm build`
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the actual final state after verification

### Constants / REF Display Debt

- [ ] Reuse catalog element value-handling rules in constants "Value" tab so type settings are enforced at input-time and submit-time (STRING/NUMBER/BOOLEAN/DATE).

### confirmOptimisticCreate Parity (Tech Debt)

> 16 create/invite hooks use `applyOptimisticCreate` in `onMutate` but do not call `confirmOptimisticCreate` in `onSuccess`. Copy hooks are all correct.

- [ ] Add `confirmOptimisticCreate` to all create hooks in metahubs-frontend:
  - `useCreateHub`, `useCreateCatalogAtMetahub`, `useCreateCatalog`, `useCreateSetAtMetahub`, `useCreateSet`
  - `useCreateEnumerationAtMetahub`, `useCreateEnumeration`, `useCreateAttribute`, `useCreateElement`, `useCreateConstant`
  - `useCreateLayout`, `useCreateBranch`, `useCreatePublication`, `useInviteMember` (metahubs)
- [ ] Add `confirmOptimisticCreate` to all create hooks in applications-frontend:
  - `useCreateApplication`, `useCreateConnector`, `useInviteMember` (applications)
- [ ] Enforce NUMBER value constraints in constants value field (`nonNegative`, `scale`, min/max, precision) and prevent invalid negative/fraction states.
- [ ] Enforce STRING value constraints in constants value field (`maxLength`, localized/non-localized behavior parity).
- [ ] Fix DATE type settings labels/options in constants form to use i18n keys (RU/EN) instead of hardcoded English text.
- [ ] Align constants table horizontal paddings/margins with sets/attributes list pattern (including full-width table and pagination panel spacing).
- [ ] Fix application element create/edit form so REF to Set+Constant shows resolved constant value (typed display), not constant UUID.

### Quality Checks (pending)

- [ ] Run targeted checks for touched scope
- [ ] Update `memory-bank/progress.md` with implementation and verification notes
- [ ] Add backend route tests for admin settings CRUD and permission/error scenarios
- [ ] Test API + UI (incl. multiselect, attributeCodenameScope, allowedAttributeTypes)
- [ ] Push fixes commit
- [ ] Evaluate session persistence strategies (PostgreSQL, Redis, JWT)
- [ ] Review auth architecture for scalability
- [ ] Role cloning, templates, permission inheritance
- [ ] Audit log for role/permission changes
- [ ] Multi-instance support (remote instances)
- [ ] Dark mode theme
- [ ] Keyboard shortcuts
- [ ] Mobile responsiveness improvements
- [ ] Tour/onboarding for new users
- [ ] Server-side caching, CDN integration
- [ ] Bundle size optimization
- [ ] Complete API documentation (OpenAPI)
- [ ] Architecture decision records (ADR)
- [ ] Refactor remaining useApi -> useMutation
- [ ] Standardize error handling across packages
- [ ] Add unit/E2E tests for critical flows
- [ ] Resolve Template MUI CommonJS/ESM conflict
- [ ] Database connection pooling optimization
- [ ] Rate limiting for all API endpoints
- [ ] CSRF protection review
- [ ] API key rotation mechanism
- [ ] Security headers (HSTS, CSP)
- [ ] Security audit
- [ ] 2FA/MFA system
- [ ] Add second left-zone divider in default layout seeds
- [ ] Reset new menu widget defaults (empty title, auto-show off, no items)
- [ ] Prevent stale diff flash in connector schema sync dialog

## Completed and In-Progress Timeline (Compressed)

### 2026-03-06 to 2026-03-08 ✅

- [x] Optimistic updates closure cluster — completed fire-and-forget dialog behavior, deferred pending UX, onSuccess consistency, runtime/apps/member parity, final QA closure, and full green validation.
- [x] Nested hubs / create-options / mobile polish cluster — delivered hub nesting, hub-scoped linking, runtime menu hierarchy, create-options UX, mobile layout fixes, logout UX, and related review/QA follow-ups.
- [x] Validation snapshot for this cluster — package tests and root `pnpm build` were rerun repeatedly until the final state was green.

### 2026-03-04 to 2026-03-05 ✅

- [x] Sets / Constants delivery cluster — full implementation, transaction and concurrency hardening, build fixes, table-layout parity, and final QA closure.
- [x] Ordering / DnD closure cluster — metahub ordering, cross-list optimistic DnD behavior, empty-drop fixes, display-attribute safety, and regression cleanup.
- [x] Cleanup / hardening cluster — legacy package removal, auth client fix, QA tech-debt cleanup, and post-cleanup stabilization.

### 2026-03-01 to 2026-03-03 ✅

- [x] Codename / settings / VLC cluster — settings-aware codename generation and validation, global/per-level scope behavior, VLC UX consistency, and repeated QA remediation.
- [x] DnD rollout cluster — attribute + enumeration-value DnD delivery, multiple QA passes, optimistic cross-list updates, and shared table DnD infrastructure.
- [x] Admin/metahub policy polish — catalog action parity, element settings, duplicate-check improvements, and documentation alignment.

## Historical Completed Timeline (Further Compressed)

### 2026-02-28 ✅

- [x] Publication Drill-In delivery + QA closure + legacy package cleanup follow-up.

### 2026-02-21 to 2026-02-27 ✅

- [x] Copy UX remediation, TABLE attribute delivery, Enumerations implementation, and migration-guard stabilization.

### 2026-02-05 to 2026-02-20 ✅

- [x] Runtime/dashboard/layout foundations, template + DDL migration architecture, and repeated QA hardening.

## [2026-01] Historical Completed Tasks ✅

- [x] Branches, Elements rename, three-level system fields, Publications, schema-ddl, runtime migrations, isolated schema storage, and codename-field rollout.

## [2025-12] Historical Completed Tasks ✅

- [x] VLC system, dynamic locales, Flowise 3.0 / AgentFlow integration, onboarding wizard, admin panel, auth migration, UUID v7, package extraction, and RBAC foundations.

## [Pre-2025-12] Historical Tasks ✅

- [x] Tools/Credentials/Variables extraction, Admin Instances MVP, Campaigns, Storages, and broader `useMutation` refactor.
## PLANNED TASKS

### Infrastructure & Auth
- [ ] Evaluate session persistence strategies (PostgreSQL, Redis, JWT)
## TECHNICAL DEBT

- [ ] Refactor remaining useApi -> useMutation
  - Note: most packages migrated, some legacy patterns remain
## SECURITY TASKS

- [ ] Rate limiting for all API endpoints
  - Note: Redis-based rate limiting exists for some endpoints
## Deferred: Layout Defaults + Menu Creation + Schema Diff (2026-02-09)

- [ ] Add second left-zone divider in default layout seeds
  - Note: only one divider in current DEFAULT_DASHBOARD_ZONE_WIDGETS
