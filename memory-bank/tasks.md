# Tasks

> **Note**: Active and planned tasks. Completed work -> progress.md, architectural patterns -> systemPatterns.md.

---

## Completed: Post-QA Hardening — 2026-03-04 ✅

> **Goal**: Eliminate issues discovered in the latest QA pass (failing tests, lint blockers in touched scope, critical security advisories) without destabilizing the cleaned architecture.

- [x] Fix failing `@universo/metahubs-frontend` test (`MetahubMembers` view toggle)
- [x] Fix failing `@universo/template-mui` tests (`useBreadcrumbName` suite)
- [x] Re-run targeted test suites and confirm green status
- [x] Resolve critical dependency advisories (`@casl/ability`, `fast-xml-parser`) via safe version upgrades/overrides
- [x] Re-run `pnpm audit --prod --audit-level=critical` and confirm no critical vulnerabilities
- [x] Re-run `pnpm build:clean` and verify full workspace build stability

---

## Completed: Legacy Cleanup — Remove Flowise Packages — 2026-03-04 ✅

> **Goal**: Remove 39 legacy Flowise/UPDL packages, clean core packages, rename @flowise/* → @universo/*, update all cross-references, documentation, and configs.

### Phase 0-3: Delete 38 legacy packages + clean types & permissions (commit a2a2d7e0)
- [x] All 38+1 packages deleted (directories removed)
- [x] @universo/types cleaned of Flowise-specific types
- [x] Admin permissions cleaned

### Phase 4: Clean flowise-core-backend (commit 271bd32a)
- [x] Removed dead Flowise code & deps from core-backend

### Phase 5: Migrate flowise-core-backend → universo-core-backend (commit 7d3812fb)
- [x] Migrated remaining code to @universo/core-backend

### Phase 6: Rename flowise-core-frontend → universo-core-frontend (commit e9eb5c97)
- [x] Renamed package, updated all imports

### Phase 7: Clean universo-template-mui (commit 05a51530)
- [x] Removed dead routes (Canvas, Chatbot, PublicFlow) & unik/metaverse code

### Phase 8: Rename flowise-store → universo-store (commit 57e92204)
- [x] Renamed to @universo/store, cleaned dead canvas code

### Phase 9: Merge flowise-template-mui → universo-template-mui (commit 34b9580e)
- [x] Absorbed SCSS, themes, Nav, Auth routes into universo-template-mui
- [x] Deleted flowise-template-mui (229 files, -22021 lines)

### Phase 10: Clean universo-i18n (commit 526c13ff)
- [x] Removed ~20 stale comments referencing deleted packages

### Phase 11: Clean universo-api-client (commit 571c1ce5)
- [x] Deleted 20 dead API modules, cleaned types/ and queryKeys/

### Phase 12: Root configs cleanup (commit 9a8420a6)
- [x] Removed ghost workspaces, dead AI/LLM overrides, stale resolutions, dead deps

### Phase 13: Documentation update (commit e9deb169)
- [x] Updated packages/README.md and README-RU.md

### Phase 14: Full rebuild + lint (commit 3c21cb30)
- [x] Fixed rest-docs stale Metaverse schema imports
- [x] Fixed ThemeRoutes import (default vs named)
- [x] Added MainCard export for backwards compatibility
- [x] Removed all remaining @flowise/ stale references
- [x] Lint-fixed template-mui (299 prettier errors auto-fixed)
- [x] 23/23 packages build successfully

### Phase 15: Documentation & Memory Bank (commit c6279e8d)
- [x] Fixed 30+ @flowise/ references across 13 README/doc files
- [x] Updated pnpm-workspace.yaml comment

---

## Completed: QA Tech Debt Cleanup — 2026-03-04 ✅

> **Goal**: Fix all issues found in the comprehensive QA analysis: stale JSDoc, fragile closure capture, over-broad cache invalidation, `as any` cleanup.

### Implementation
- [x] Fixed stale JSDoc comment on `useReorderAttribute` — "cross-list skipped" → "both same-list and cross-list"
- [x] Replaced fragile `movedItem` closure capture with pre-extraction from cache via `getQueriesData` before applying updaters
- [x] Optimized `onSuccess` — child attribute caches invalidated only for cross-list transfers (`newParentAttributeId !== undefined`), not for same-list reorder
- [x] Cleaned up `as any` casts in same-list `reorderUpdater` to use typed `Record<string, unknown>` casts matching cross-list code

### Verification
- [x] Lint: metahubs-frontend 0 errors/153 warnings (13 fewer than before — `as any` removals)
- [x] Tests: metahubs-frontend 97/97
- [x] Build: metahubs-frontend ✔ success

---

## Completed: Cross-List DnD Optimistic Update — 2026-03-03 ✅

> **Goal**: Add optimistic cache updates for cross-list attribute DnD transfers so items instantly appear in the target list instead of snapping back and re-appearing after 2-3s server response.

### Implementation
- [x] Added `currentParentAttributeId` parameter to `onReorder` callback chain (`useAttributeDnd` → `AttributeDndProvider` → `AttributeList` → `mutations.ts`)
- [x] In `handleDragEnd`: pass `activeContainer.parentAttributeId` as 4th argument to `onReorder` for cross-list transfers
- [x] In `onMutate`: implemented cross-list optimistic update — removes item from source cache, inserts into target cache at correct position, re-indexes sort orders in both
- [x] Unified rollback: snapshots both root and child caches before modification, restores all on error
- [x] Same-list reorder optimistic update preserved (refactored to use extracted `reorderUpdater`)

### Verification
- [x] Lint: metahubs-frontend 0 errors/166 warnings
- [x] Tests: metahubs-frontend 97/97, metahubs-backend 128/128
- [x] Build: 56/56 successful
- [x] Memory Bank updated

---

## Completed: DnD QA Pass 5 — Post-Analysis Fixes — 2026-03-03 ✅

> **Goal**: Fix 4 issues from comprehensive QA analysis: backend auto-set display attr, ghost row collision cycle, source list display protection, eslint-disable cleanup.

### Fix 1: Backend auto-set display attribute for first child (MEDIUM)
- [x] In `reorderAttribute()`: after cross-list move to child list, count siblings; if count === 1, auto-set `is_display_attribute: true` + `is_required: true`

### Fix 2: Ghost row collision guard (MEDIUM)
- [x] In `handleDragOver`: early return when `over.id === active.id && pendingTransfer` exists — prevents render cycle where ghost unmounts/remounts
- [x] In `handleDragEnd`: save `pendingTransferRef.current` before clearing state; when `over.id === active.id`, resolve target container from saved pending transfer instead of re-resolving via findContainer
- [x] Sort order calculation: use `savedPendingTransfer.insertIndex + 1` when dropped on ghost row (overIndex not found in target items)

### Fix 3: Source list display attribute protection (LOW)
- [x] In `_validateCrossListTransfer()`: changed condition from `attribute.is_display_attribute && targetParentId !== null` to `attribute.is_display_attribute` — blocks ALL display attribute cross-list transfers, aligned with frontend behavior

### Fix 4: eslint-disable cleanup (LOW)
- [x] Extracted inline type annotation to named `EmptyDroppableChildAreaProps` interface
- [x] Reduced from 2 eslint-disable comments (one inside type annotation) to 1 standard eslint-disable-next-line before component declaration

### Verification
- [x] Lint: metahubs-backend 0 errors/216 warnings, metahubs-frontend 0 errors/163 warnings
- [x] Tests: metahubs-backend 128/128, metahubs-frontend 97/97, template-mui 169/169
- [x] Build: 56/56 successful (5m29s)
- [x] Memory Bank updated

---

## Completed: DnD QA Pass 4 — 4 Issues Fix — 2026-03-03 ✅

> **Goal**: Fix 4 new QA issues: jitter on cross-list drag, empty child table drop target, first-attr confirmation dialog, lock display attribute toggle.

### Issue 1: Jitter on cross-list drag (width mismatch)
- [x] Add `overflowX: 'hidden'` to FlowListTable `TableContainer` when `isDropTarget` is active, prevent horizontal scrollbar jitter

### Issue 2: Empty child table needs droppable area
- [x] In ChildAttributeList: render `EmptyDroppableChildArea` component with `useDroppable` when no children + no ghost row
- [x] Container detected as drop target via @dnd-kit useDroppable — registered with containerId
- [x] Show drop target visual feedback (dashed border highlight) on empty placeholder
- [x] Restructured rendering: always compute effectiveData, show EmptyDroppableChildArea or FlowListTable

### Issue 3: First attribute in empty table → confirmation dialog
- [x] Extended `onValidateTransfer` signature with `targetContainerItemCount` parameter
- [x] Show confirmation dialog when dropping to empty child container (targetContainerItemCount === 0)
- [x] Added i18n keys for EN (firstChildAttributeTitle/firstChildAttributeDescription) and RU translations

### Issue 4: Lock display attribute toggle when editing display attribute
- [x] In `AttributeActions.tsx`: added `|| isDisplayAttributeEntity(ctx)` to `displayAttributeLocked` computation
- [x] In `ChildAttributeList.tsx`: pass `displayAttributeLockedOverride: editState.attribute?.isDisplayAttribute ? true : undefined` in edit dialog tabs
- [x] Verified childActionDescriptors context menu actions are correctly gated (clear-display-attribute requires displayAttributesCount > 1)

### Verification
- [x] Lint: 0 errors, 163 warnings (metahubs-frontend)
- [x] Build: 56/56 successful (5m36s)
- [x] Memory Bank updated

---

## Completed: DnD Table Design Restoration & Tech Debt Elimination — 2026-03-03 ✅

> **Goal**: Restore standard table design (FlowListTable) wherever DnD was introduced, extend FlowListTable with built-in DnD support, fix all pre-existing TS errors in EnumerationValueList, clean up redundant DnD components.

### Phase 1: Extend FlowListTable with DnD support
- [x] Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` to `universo-template-mui` deps
- [x] Create `FlowListTableDnd.tsx` with internal DnD building blocks (SortableTableRow, SortableTableBody, InternalDndWrapper)
- [x] Add DnD props to `FlowListTableProps` (sortableRows, sortableItemIds, droppableContainerId, externalDndContext, onSortableDragEnd, renderDragOverlay, etc.)
- [x] Integrate DnD rendering path in FlowListTable (drag handle column, sortable rows, disabled internal sort)
- [x] Export new types from template-mui index

### Phase 2: Fix dialog component types
- [x] Add `'copy'` to `EntityFormDialogProps.mode` union
- [x] Add `deleteButtonDisabledReason?: string` to `EntityFormDialogProps` with Tooltip support

### Phase 3: Fix pre-existing TS errors in EnumerationValueList (9 errors)
- [x] Fix `appendCopySuffix` locales type mismatch (line 104)
- [x] Fix `onSearchChange={setSearch}` type mismatch (line 723)
- [x] Fix `t()` overload issues (lines 827, 929)
- [x] Fix `deleting` → `loading` prop on ConfirmDeleteDialog (line 970)
- [x] Type all implicit `any` params (11 `ctx: ValueActionCtx`, `deriveCodename`, `onChange`, `onTouchedChange`, `onLocalizedChange`, `onSearchChange`, `extraFields` destructured params)
  - Note: readonly `descriptors` and `createValueActionContext` errors were cascading from VS Code TS server module resolution cache, not real code bugs

### Phase 4: Migrate consumers to FlowListTable DnD
- [x] Migrate AttributeList to use FlowListTable with `sortableRows` + `externalDndContext`
- [x] Migrate ChildAttributeList to use FlowListTable with `sortableRows` + `externalDndContext`
- [x] Migrate EnumerationValueList to use FlowListTable with `sortableRows` (internal DndContext)

### Phase 5: Clean up & verify
- [x] Remove redundant DnD components (SortableAttributeRow, SortableAttributeTableBody, SortableValueRow, SortableEnumerationValueTable)
- [x] Update dnd/index.ts barrel exports
- [x] Lint verification (`metahubs-frontend`: 0 errors/149 warnings, `metahubs-backend`: 0 errors/216 warnings)
- [x] Build verification (`pnpm build` — 56 successful, 56 total, 5m32s)
- [x] Backend tests (21/21 passed)

---

## Completed: DnD QA Critical Debt Closure — 2026-03-03 ✅

> **Goal**: Eliminate all remaining QA blockers for DnD attributes/enumeration values with safe backend enforcement, clean lint status in touched areas, and verified builds/tests.

### Final implementation plan (execution pass)

- [x] Enforce cross-list move settings on backend reorder endpoint/service (not frontend-only)
- [x] Add strict ownership checks in reorder services (`attribute.object_id === catalogId`, `value.object_id === enumerationId`)
- [x] Add/adjust backend tests for settings enforcement and ownership guardrails in reorder APIs
- [x] Fix all new lint/prettier errors introduced by DnD files and route/service edits
- [x] Re-run targeted verification (`metahubs-frontend lint/test`, `metahubs-backend lint/test`, touched builds)
- [x] Update Memory Bank closure (`activeContext.md`, `progress.md`, `tasks.md`) with outcomes

### Verification evidence (this completion)

- [x] `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/attributesRoutes.test.ts src/tests/routes/enumerationsRoutes.test.ts` -> pass (`2/2` suites, `21/21` tests)
- [x] `pnpm --filter @universo/metahubs-backend build` -> pass
- [x] `pnpm --filter @universo/metahubs-frontend build` -> pass (`Build complete in 6597ms`)
- [x] `pnpm --filter @universo/template-mui build` -> pass (`Build complete in 1461ms`)
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `6m33.197s`)

---

## Completed: Drag-and-Drop for Attributes & Enumeration Values — 2026-03-03 ✅

> **Goal**: Implement drag-and-drop reordering for root/child attributes and enumeration values. Add cross-list attribute transfer (root ↔ child, child ↔ child) with codename uniqueness and display-attribute validation. New metahub settings control permissions.

> **Plan**: See [memory-bank/plan/dnd-attributes-enum-values-plan-2026-03-03.md](plan/dnd-attributes-enum-values-plan-2026-03-03.md) for detailed implementation plan with code examples.

> **Complexity**: Level 4 (Major/Complex)

### Phase 1: FlowListTable Key Fix
- [x] Fix `key={index}` → `key={row.id}` in `FlowListTable.tsx`

### Phase 2: New Metahub Settings
- [x] Add 2 new settings to `METAHUB_SETTINGS_REGISTRY` in `universo-types`
- [x] Add i18n keys for new settings (EN + RU) — added in QA fix pass

### Phase 3: Backend — Attribute Reorder Endpoint
- [x] Add Zod schema and PATCH `/attributes/reorder` route (hub-scoped + direct)
- [x] Implement `reorderAttribute()` in `MetahubAttributesService` (same-list + cross-list)
- [x] Implement `_validateCrossListTransfer()` (display attr, TABLE nesting, codename uniqueness)

### Phase 4: Backend — Enum Value Reorder Endpoint
- [x] Add PATCH `/values/reorder` route for enumeration values
- [x] Implement `reorderValue()` in `MetahubEnumerationValuesService`

### Phase 5: Frontend — DnD Dependencies & API
- [x] Add `@dnd-kit` deps to `metahubs-frontend` (catalog versions)
- [x] Add `reorderAttribute` and `reorderEnumerationValue` API functions
- [x] Add `useReorderAttribute` and `useReorderEnumerationValue` mutation hooks

### Phase 6: Frontend — DnD Components for Attributes
- [x] Create `SortableAttributeRow` (useSortable + drag handle)
- [x] Create `DragOverlayRow` (floating drag preview)
- [x] Create `useAttributeDnd` hook (DnD event handlers)
- [x] Create `AttributeDndProvider` (DndContext + sensors + overlay)
- [x] Create `SortableAttributeTableBody` (SortableContext + droppable body)

### Phase 7: Frontend — Integrate DnD in AttributeList
- [x] Wrap AttributeList with AttributeDndProvider
- [x] Replace FlowListTable with SortableAttributeTableBody when DnD enabled
- [x] Implement optimistic reorder handler
- [x] Implement cross-list transfer validation (display attr, TABLE nesting, codename, confirm dialog)

### Phase 8: Frontend — Integrate DnD in ChildAttributeList
- [x] Register child lists as DnD containers via context
- [x] Render SortableAttributeTableBody per child list
- [x] Create `AttributeDndContainerRegistry` for cross-container awareness

### Phase 9: Frontend — DnD for Enumeration Values
- [x] Create DnD components for enumeration values
- [x] Integrate in EnumerationValueList with setting toggle

### Phase 10: i18n
- [x] Add all DnD-related i18n keys (EN + RU)

### Phase 11: QA Fixes & Verification
- [x] QA analysis (comprehensive review of all phases)
- [x] Fix Phase 2.2: add missing settings i18n keys (EN + RU)
- [x] Fix unused `dragHandle` keys: add `aria-label` to drag handles via prop chain
- [x] Fix unused `reorderSuccess` keys: add success snackbars after reorder
- [x] Remove unused `transferBlocked` key (redundant with specific messages)
- [x] `pnpm --filter metahubs-frontend build` -> pass

---

## Completed: Codename Auto-Convert UX Hardening — 2026-03-03 ✅

> **Goal**: Ensure mixed-alphabet auto-conversion works both for manual codename blur and for codename auto-generation from name across all codename-enabled forms; align settings wording in admin + metahub UI.

### Final implementation plan (execution pass)

- [x] Extend codename generation path to apply mixed-alphabet auto-conversion (when disallowed) during auto-fill from name
- [x] Propagate updated generation call to all metahubs forms using `useCodenameAutoFill` / `useCodenameVlcSync`
- [x] Rename setting label `Автоконвертация смешанного алфавита при выходе из поля` to `Автоконвертация смешанного алфавита` in admin and metahub settings (RU+EN parity)
- [x] Update setting descriptions to explicitly mention both scenarios: auto-generation from name and manual codename input on blur
- [x] Re-run verification (`@universo/metahubs-frontend` lint+test and root `pnpm build`) and update Memory Bank closure

### Verification evidence (this completion)

- [x] `pnpm --filter @universo/metahubs-frontend lint` -> pass (`0` errors, `149` warnings)
- [x] `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m23.968s`)
- [x] Memory Bank closure synchronized in `activeContext.md` and `progress.md`

## Completed: QA Debt Eradication — 2026-03-03 ✅

> **Goal**: Resolve all issues found in the latest QA pass with safe, minimal, lint-clean changes and no regressions.

### Final implementation plan (execution pass)

- [x] Fix all error-level lint issues in affected `metahubs-frontend` files (primarily `prettier/prettier` + `react/prop-types`) without changing functional behavior
- [x] Add missing MSW handler for `GET /api/v1/metahubs/codename-defaults` to remove noisy test warnings and connection attempts
- [x] Re-run targeted package verification (`metahubs-frontend lint`, `metahubs-frontend test`, `metahubs-backend test`, `template-mui test`)
- [x] Re-run full workspace verification (`pnpm build` at repository root)
- [x] Update Memory Bank closure (`activeContext.md`, `progress.md`, `tasks.md`) with final evidence and outcomes

### Verification evidence (this completion)

- [x] `pnpm --filter @universo/metahubs-frontend lint` -> pass (`0` errors, `149` warnings)
- [x] `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- [x] `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `123` passed, `3` skipped)
- [x] `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests)
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m20.626s`)

---

## Completed: DnD QA Pass 3 — 4 Issues Fix — 2026-03-03 ✅

> **Goal**: Fix 4 new QA issues found during testing of DnD attributes/enum values feature.

### Issue 1: Enum value row height too short
- [x] Remove `compact` from `FlowListTable` in `EnumerationValueList.tsx`

### Issue 2: Drag handle not vertically centered
- [x] Add `verticalAlign: 'middle'` to drag handle StyledTableCell in `SortableTableRow` (FlowListTableDnd.tsx)

### Issue 3: Cross-list DnD ghost placeholder missing
- [x] Add `pendingTransfer` state to `useAttributeDnd` (itemId, from/to container, insertIndex)
- [x] Expose `pendingTransfer` + `activeAttribute` through `AttributeDndStateContext`
- [x] In `AttributeList.tsx`: modify `data` and `sortableItemIds` based on pendingTransfer (remove from source, inject ghost in target)
- [x] In `ChildAttributeList.tsx`: same ghost injection logic
- [x] Result: cross-list drag shows semi-transparent row at insertion point (using @dnd-kit isDragging opacity)

### Issue 4: Verify codename_localized auto-rename logic
- [x] Trace flow for VLC on + VLC off scenarios — both correct
- [x] Confirm `codename_localized: null` is correct for both cases — fallback to plain codename works

### Verification
- [x] Build: 56/56, lint: 0 errors/164 warnings, tests: 128+97+169 passed
- [x] Memory Bank updated

## Completed: DnD QA Pass 2 — 6 Issues Fix — 2026-03-04 ✅

> **Goal**: Fix 6 issues found during QA testing of DnD attributes/enum values feature.

### Issue 1: Root attribute row height too short
- [x] Remove `compact` from root `FlowListTable` in `AttributeList.tsx` (keep compact in `ChildAttributeList.tsx`)

### Issue 2: Cross-list DnD has no visual feedback
- [x] Add visual drop indicator when dragging between root ↔ child containers
  - Created `AttributeDndStateContext` in `AttributeDndProvider.tsx` exposing `activeId`, `activeContainerId`, `overContainerId`
  - Added `useAttributeDndState()` hook
  - Created `DndDropTarget` render-prop component in `AttributeList.tsx`
  - Added `isDropTarget` prop to `FlowListTable` with dashed primary border + 4% alpha background

### Issue 3: Display attribute cross-list validation order
- [x] Block display attribute from ANY cross-list transfer (not just root → child)
  - Removed `&& targetParentId !== null` condition in `handleValidateTransfer`

### Issue 4: Codename conflict dialog too narrow
- [x] Widen `ConfirmDialog` from `maxWidth='xs'` to `'sm'` and add padding to `DialogActions`

### Issue 5: Codename rename bug + suffix format
- [x] Fix `buildCodenameAttempt` to not use separator before number (e.g., `Name2` not `Name_2`)
- [x] Fix auto-rename to also set `codename_localized: null` so display shows new codename

### Issue 6: No optimistic updates for DnD reorder
- [x] Add optimistic updates to `useReorderAttribute` (same-list only) and `useReorderEnumerationValue`
  - `onMutate`: cancel queries, snapshot cache, reorder items optimistically
  - `onError`: rollback from snapshot

### Verification
- [x] Build verification — 56/56 packages, 0 lint errors, all tests pass
- [x] Memory Bank updated

## Completed: QA Remediation — Root Attribute Codename Flow Hardening — 2026-03-03 ✅

> **Goal**: Remove remaining QA gaps in root attribute flow (global-scope duplicate checks, safe disable on duplicate, style-aware codename handling) with minimal and safe changes.

- [x] Align `AttributeList.tsx` with style-aware codename validation/normalization (`normalizeCodenameForStyle` + `isValidCodenameForStyle`) and remove legacy `sanitizeCodename` path for form save/validation
- [x] Add root-level `ExistingCodenamesProvider` wiring with settings-based global/per-level codename source in `AttributeList.tsx`
- [x] Ensure root create/save/copy buttons are blocked on duplicate (`_hasCodenameDuplicate`) consistently
- [x] Run targeted verification (`metahubs-frontend lint`, backend attributes route test) and final root `pnpm build`
- [x] Update Memory Bank closure (`activeContext.md`, `progress.md`, `tasks.md`) with outcomes and evidence

### Verification evidence (this completion)
- [x] `pnpm --filter @universo/metahubs-frontend exec eslint --ext .ts,.tsx src/domains/attributes/ui/AttributeList.tsx` -> pass (0 errors, 0 warnings)
- [x] `pnpm --filter metahubs-backend test -- src/tests/routes/attributesRoutes.test.ts` -> pass (`6/6` tests)
- [x] `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `123` passed, `3` skipped)
- [x] `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `4m46.265s`)

---

## Completed: Codename Bug Fixes + Global Scope + Button Disable — 2026-03-03 ✅

> **Goal**: Fix 4 QA issues: i18n error text language/case, auto-convert mixed alphabets, disable save button on duplicate, implement attributeCodenameScope global mode.

### Issue 1: i18n + original case in duplicate error
- [x] Fix i18n keys in `CodenameField.tsx` — changed from `metahubs.validation.*` to `validation.*` (due to `consolidateMetahubsNamespace()` flattening)
- [x] Preserve original case in `useCodenameDuplicateCheck.ts` — `collectAllCodenameValues()` now returns `{original, lower}[]` pairs

### Issue 2: Auto-convert mixed alphabets broken
- [x] Remove explicit `normalizeOnBlur` overrides from all 12 form builders — restores CodenameField's built-in `settingsBasedNormalize` which includes `autoConvertMixedAlphabetsByFirstSymbol()`

### Issue 3: Disable Create/Save/Copy buttons on duplicate
- [x] Add `onDuplicateStatusChange` callback prop to `CodenameField` with `useEffect` + `useRef` notification
- [x] Wire `onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}` in all 12 CodenameField usages
- [x] Add `!values._hasCodenameDuplicate &&` check to all 15 `canSave` functions across 14 files

### Issue 4: attributeCodenameScope global mode
- [x] Backend: new `GET /metahub/:id/catalog/:catalogId/attribute-codenames` endpoint using `findAllFlat()`
- [x] Frontend API: `listAllAttributeCodenames()` function
- [x] Frontend: query key `allAttributeCodenames` + invalidation in `invalidateAttributesQueries`
- [x] Frontend: `AttributeList.tsx` reads `catalogs.attributeCodenameScope` setting, queries all codenames when 'global'
- [x] Frontend: `ChildAttributeList.tsx` same global scope logic with shared codenames query
- [x] Invalidation: all attribute mutation paths (hub-based + hub-less) invalidate global codenames cache

### Verification
- [x] `pnpm build` (root) → pass (`56 successful, 56 total`)

### QA Fix (post-QA pass)
- [x] Add `invalidateAttributesQueries.allCodenames()` to 4 mutation points in `AttributeList.tsx` — `refreshList`, `handleCreateAttribute`, `ChildAttributeList onRefresh`, `ConflictResolutionDialog onCancel`
- [x] Fix 2 prettier errors in `CodenameField.tsx` (long line `t()` call, single-line JSX return)
- [x] Fix 1 prettier error in `attributes.ts` (multi-line function params → single line)
- [x] Verified: 0 TS errors, 0 lint errors in all 3 modified files

---

## Completed: Admin i18n fix + Codename Duplicate Check + Element Settings — 2026-03-03 ✅

> **Goal**: Fix "blur" i18n in admin settings, implement reactive codename duplicate checking (with VLC cross-locale uniqueness), add element copy/delete settings.

### Task 1: Fix "blur" i18n in admin settings
- [x] Replace "blur" with proper translations in `admin-frontend/base/src/i18n/ru/admin.json` → "при выходе из поля"/"при потере фокуса"
- [x] Replace "on Blur" with "on Field Exit"/"when the field loses focus" in `admin-frontend/base/src/i18n/en/admin.json`

### Task 2+3: Codename duplicate checking + VLC cross-locale uniqueness
- [x] Create `ExistingCodenamesContext` in `metahubs-frontend/base/src/components/`
- [x] Create `useCodenameDuplicateCheck` hook in `metahubs-frontend/base/src/components/`
- [x] Modify `metahubs-frontend` `CodenameField` wrapper: consume context, add `editingEntityId` prop, merge duplicate error
- [x] Add i18n keys for duplicate error messages (EN + RU)
- [x] Integrate context provider in all entity list components:
  - [x] MetahubList.tsx → wrap dialog with ExistingCodenamesProvider (metahubs)
  - [x] HubList.tsx → wrap with provider (hubs)
  - [x] CatalogList.tsx → wrap with provider (catalogs)
  - [x] EnumerationList.tsx → wrap with provider (enumerations)
  - [x] EnumerationValueList.tsx → wrap with provider (enum values)
  - [x] BranchList.tsx → wrap with provider (branches)
  - [x] ChildAttributeList.tsx → wrap with provider (child attributes)
  - [x] AttributeList.tsx → wrap with provider (top-level attributes)
- [x] Pass `editingEntityId` in edit/copy dialogs across all entity types:
  - [x] MetahubActions.tsx (edit: ctx.entity.id, copy: null)
  - [x] HubActions.tsx (edit: ctx.entity.id, copy: null)
  - [x] CatalogActions.tsx (edit: ctx.entity.id, copy: null)
  - [x] EnumerationActions.tsx (edit: ctx.entity.id, copy: null)
  - [x] EnumerationValueList.tsx inline dialogs (edit: editingValue?.id, copy: null)
  - [x] BranchActions.tsx (edit: ctx.entity.id, copy: null)
  - [x] ChildAttributeList.tsx buildTabs (create: null, edit: editState.attribute?.id, copy: null)
  - [x] AttributeList.tsx renderTabs (create: null)
  - [x] AttributeActions.tsx (edit: ctx.entity.id, copy: null)
- [x] Handle VLC cross-locale uniqueness: collect all codename strings from all locales when checking

### Task 4: Element copy/delete settings
- [x] Add `catalogs.allowElementCopy` and `catalogs.allowElementDelete` to `METAHUB_SETTINGS_REGISTRY` in `universo-types`
- [x] Add i18n keys for element settings in `metahubs-frontend` EN + RU
- [x] Filter `elementActions` in `ElementList.tsx` based on settings

### Verification
- [x] `pnpm build` (root) → pass (`56 successful, 56 total`, `6m31s`)
- [x] QA analysis → all issues resolved, no remaining technical debt

---

## Completed: QA Remediation — Catalog Actions Policy Parity — 2026-03-02 ✅

> **Goal**: Eliminate the remaining QA finding by aligning Catalog list action visibility with metahub policy settings, without changing backend behavior.

### Final implementation plan (execution pass)

- [x] Add settings-based action filtering in `CatalogList` (`catalogs.allowCopy`, `catalogs.allowDelete`) for both card and table views
- [x] Keep backend enforcement unchanged; apply minimal and safe frontend-only diff
- [x] Run targeted lint check for changed file(s) and ensure no new diagnostics
- [x] Update memory-bank closure (`activeContext.md`, `progress.md`, `tasks.md`) with verification evidence

### Verification evidence (this pass)

- [x] Catalog actions parity fixed in `CatalogList`: menu descriptors now use settings-aware `filteredCatalogActions` in both card and table render paths.
- [x] `pnpm --filter @universo/metahubs-frontend exec eslint --max-warnings=0 --ext .ts,.tsx src/domains/catalogs/ui/CatalogList.tsx` -> pass.
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `6m44.189s`).

---

## Completed: Comprehensive QA Finalization — 2026-03-02 ✅

> **Goal**: Complete end-to-end QA closure for the latest metahub settings/codename/policy scope with explicit clean-DB safety verdict and prioritized risk matrix.

### Final implementation plan (execution pass)

- [x] Re-validate fresh-DB safety path (admin locale/settings seed + metahub fallback defaults)
- [x] Complete policy and data-operation QA audit for catalogs/enumerations/hubs/attributes routes
- [x] Verify frontend policy parity against backend enforcement and classify UX vs security impact
- [x] Run final workspace verification baseline (`pnpm build` at root)
- [x] Update memory-bank closure (`activeContext.md`, `progress.md`, `tasks.md`) and publish final QA verdict

### Verification evidence (this pass)

- [x] Fresh-DB seed chain confirmed in `CreateAdminSchema1733400000000` (`admin.locales`, `admin.settings`) plus additive migration `AddCodenameAutoConvertMixedSetting1733500000000`.
- [x] Backend policy checks re-confirmed: `hubs.allowCopy/allowDelete`, `catalogs.allowCopy/allowDelete`, `enumerations.allowCopy/allowDelete`, `catalogs.allowAttributeCopy/allowAttributeDelete/allowDeleteLastDisplayAttribute` are enforced in corresponding mutation routes.
- [x] Hub-scoped catalog/enumeration delete semantics validated: settings block full entity deletion while hub unlink path remains allowed when another hub association still exists (intentional N:M behavior).
- [x] Frontend parity classification completed: `HubList` and `EnumerationList` filter action menu by settings, while `CatalogList` currently uses raw `catalogActions` descriptors; classified as **UX consistency debt** (backend still enforces policy, so no direct security bypass).
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m29.979s`), warnings only (non-blocking chunk-size/Sass deprecation in Flowise packages).
- [x] Memory-bank closure synchronized (`activeContext.md`, `progress.md`, `tasks.md`) with final QA verdict and prioritized follow-up.

---

## Active: Metahub Language/Codename/Attribute Policy Fixes — 2026-03-02

> **Goal**: Implement the newly requested metahub fixes for language defaults, catalog codename behavior, localized codename rendering, attribute delete/copy policies, compact settings UI, and wording clarity.

### Final implementation plan (execution pass)

- [x] Add functional `general.language` behavior with `system` option and dynamic language options from Admin locales
- [x] Apply metahub language setting as default primary locale for VLC entity creation flows
- [x] Fix catalog create flow to use settings-aware codename normalization and localized codename payload
- [x] Render localized codename in root/child attributes tables using current UI locale fallback chain
- [x] Add catalog attribute policy settings (`allowAttributeCopy`, `allowAttributeDelete`, `allowDeleteLastDisplayAttribute`) and enforce them in backend/frontend
- [x] Make `catalogs.allowedAttributeTypes` multiselect in settings compact (horizontal/wrapped layout)
- [x] Replace ambiguous `blur` wording in RU/EN i18n and helper text copy
- [x] Run targeted lint for changed packages and full root `pnpm build`
- [x] Update memory-bank closure (`activeContext.md`, `progress.md`, `tasks.md`) with final verification evidence

### Verification evidence (current completion pass)

- [x] `pnpm --filter @universo/metahubs-frontend lint` -> pass (`0` errors, warnings only).
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m0.269s`).

### Notes

- [x] Additional sub-task discovered and completed: style-aware `normalizeOnBlur` wiring for `CodenameField` across entity forms to prevent unintended kebab-case conversion on blur in Pascal/VLC mode.
- [x] Additional sub-task discovered and completed: conditionally hide `catalogs.allowDeleteLastDisplayAttribute` in settings UI when `catalogs.allowAttributeDelete` is disabled.

---

## Completed: Post-QA Debt Cleanup & Safety Hardening — 2026-03-02 ✅

> **Goal**: Fix all actionable issues found in the latest QA pass with minimal, safe changes and zero new regressions.

### Final implementation plan (execution pass)

- [x] Collect current lint warnings in active QA scope (`metahubs-frontend`, `metahubs-backend`, `admin-frontend`, `admin-backend`, `template-mui`, `utils`)
- [x] Fix warning-level technical debt introduced or touched in the latest codename/settings scope (no broad unrelated refactors)
- [x] Re-run package lint/test where affected and ensure no error-level regressions
- [x] Run full workspace validation (`pnpm build` at root)
- [x] Update memory-bank closure (`activeContext.md`, `progress.md`, `tasks.md`) with final evidence

### Verification evidence (this completion)

- [x] Strict lint across all changed `@universo/metahubs-frontend` source files -> pass (`--max-warnings=0`, no warnings)
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m28.522s`)

---

## Active: Codename UX/Settings Refinement — 2026-03-02

> **Goal**: Align codename previews, helper texts, and mixed-alphabet behavior in Metahubs + Admin settings, plus fix copy codename casing.

### Final implementation plan (execution pass)

- [x] Finalize code consistency for codename preview/helper/autoconvert behavior in Metahubs + Admin
- [x] Run package-level verification (`lint`/`test` where available) for touched areas
- [x] Run full workspace validation (`pnpm build` at root)
- [x] Fix regressions from verification and re-run affected checks
- [x] Close memory-bank records (`activeContext.md`, `progress.md`, `tasks.md`) with final evidence

### Verification evidence (this completion)

- [x] `pnpm --filter @universo/utils lint` -> pass (0 errors, warnings only)
- [x] `pnpm --filter @universo/template-mui lint` -> pass (0 errors, warnings only)
- [x] `pnpm --filter @universo/types lint` -> pass (0 errors, warnings only)
- [x] `pnpm --filter @universo/metahubs-backend lint` -> pass (0 errors, warnings only)
- [x] `pnpm --filter @universo/metahubs-frontend lint` -> pass (error-level clean, warnings only)
- [x] `pnpm --filter @universo/admin-backend lint` -> pass (0 errors, warnings only)
- [x] `pnpm --filter @universo/admin-frontend lint` -> pass (0 errors, warnings only)
- [x] `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests)
- [x] `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `123` passed, `3` skipped)
- [x] `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- [x] `pnpm --filter @universo/utils test` -> pass (`10/10` files, `154/154` tests)
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m25.055s`)

### Notes

- [x] During verification, fixed `prettier` regressions in settings UI wrappers (`SettingsPage`, `CodenameStylePreview`, metahubs `CodenameField`) and re-ran lint.

---

## Completed: QA Safety Remediation — 2026-03-02 ✅

> **Goal**: Fix all remaining QA findings in backend mutation flows with safe, minimal, regression-free changes.

### Final implementation plan

- [x] Add strict `kind === CATALOG` guards in all catalog routes that currently rely only on `findById`
- [x] Align catalog permanent delete with soft-delete safety checks (blocking references validation)
- [x] Add conflict-safe restore handling for catalog trash restore (return 409 on codename conflicts)
- [x] Enforce `isSingleHub` constraint in catalog hub-scoped create path (parity with other create/update paths)
- [x] Eliminate global attribute codename race risk by serializing global-scope codename mutations with advisory lock
- [x] Expand backend route tests for all fixes (catalog + attribute race-safe path)
- [x] Run `@universo/metahubs-backend` lint/tests and full root `pnpm build`
- [x] Update memory-bank closure (`activeContext.md`, `progress.md`, `tasks.md`)

### Verification evidence (this completion)

- [x] `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/catalogsRoutes.test.ts src/tests/routes/attributesRoutes.test.ts` -> pass (`2/2` suites, `30/30` tests)
- [x] `pnpm --filter @universo/metahubs-backend lint` -> pass (`0` errors, warnings only)
- [x] `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `123` passed, `3` skipped)
- [x] `pnpm --filter @universo/metahubs-backend build` -> pass (`BUILD_OK`)
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m41.147s`)

---

## Active: VLC UX & Settings Consistency Fixes — 2026-03-02

> **Goal**: Resolve all newly reported UX/logic defects for localized codename behavior, metahub settings clarity, and attribute type restrictions without introducing regressions.

### Final implementation plan

- [x] Fix codename locale sync when name locale is changed vs. added (no duplicate codename field on language switch)
- [x] Fix localized field connector line alignment for codename multi-locale rendering
- [x] Restore codename blur normalization in localized mode (trim/format on blur)
- [x] Apply VLC codename auto-fill sync across all entity forms (not only metahub create/edit)
- [x] Remove duplicated/unused `common.defaultLocale` metahub setting and show informational placeholder on `Common` tab
- [x] Localize `catalogs.allowedAttributeTypes` option labels in metahub settings UI
- [x] Enforce frontend filtering of attribute type choices based on `catalogs.allowedAttributeTypes` in create dialogs
- [x] Run lint/tests/build and update memory-bank closure

### Verification checklist for this pass

- [x] Fix current lint error-level diagnostics in `@universo/metahubs-frontend` (prettier errors)
- [x] Re-run `pnpm --filter @universo/template-mui lint`
- [x] Re-run `pnpm --filter @universo/metahubs-frontend lint`
- [x] Re-run `pnpm --filter @universo/types lint`
- [x] Re-run targeted tests for touched packages
- [x] Re-run root `pnpm build`

### Verification evidence (this completion)

- [x] `pnpm --filter @universo/metahubs-frontend exec eslint --ext .ts,.tsx,.jsx src/domains/attributes/ui/ChildAttributeList.tsx --fix` -> removed error-level Prettier diagnostics (warnings only)
- [x] `pnpm --filter @universo/metahubs-frontend exec eslint --ext .ts,.tsx,.jsx src/domains/attributes/ui/AttributeList.tsx --fix` -> removed remaining Prettier error
- [x] `pnpm --filter @universo/template-mui lint` -> `0 errors`, warnings only (`120`)
- [x] `pnpm --filter @universo/metahubs-frontend lint` -> `0 errors`, warnings only (`381`)
- [x] `pnpm --filter @universo/types lint` -> `0 errors`, warnings only (`8`)
- [x] `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests)
- [x] `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `4m54.002s`)

---

## Completed: QA Findings Fix — 2026-03-02 ✅

> **Goal**: Fix all issues discovered during QA analysis of VLC codename implementation. Zero remaining technical debt.

- [x] Add `GET /metahubs/codename-defaults` public endpoint in metahubs-backend (replaces admin-only `/admin/settings/metahubs` call)
- [x] Rewrite `useAdminMetahubDefaults` → `usePlatformCodenameDefaults` in `useCodenameConfig.ts` to use new public endpoint
- [x] Add `localizedEnabled: false` to `DEFAULT_CC` in 6 files (MetahubActions, AttributeActions, BranchActions, HubActions, CatalogActions, EnumerationActions)
- [x] Fix Prettier formatting errors in `useCodenameVlcSync.ts` and `useCodenameConfig.ts`
- [x] Optimize `useCodenameVlcSync` first useEffect dependencies (remove extra re-render cycle via `codenameVlcRef`)
- [x] Run lint/tests/build and verify all clean

### Verification evidence

- [x] `pnpm --filter @universo/template-mui lint` -> pass (0 errors, warnings only)
- [x] `pnpm --filter @universo/metahubs-frontend lint` -> pass (0 errors, warnings only)
- [x] `pnpm --filter @universo/metahubs-backend lint` -> pass (0 errors, warnings only)
- [x] `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests)
- [x] `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `117` passed, `3` skipped)
- [x] `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `5m23.313s`)

---

## Completed: Settings UX & VLC Fixes — 2026-03-02 ✅

> **Goal**: Fix toggle flickering, VLC codename auto-generation, language sync, admin VLC propagation, and merge migrations.

- [x] Fix toggle flickering after save in metahub settings and admin settings (optimistic cache update)
- [x] Fix codename auto-generation when VLC mode is enabled (sync plain codename → codenameVlc via `useCodenameVlcSync` hook)
- [x] Sync language switch from name field to codename field when codename is empty in VLC mode
- [x] Make admin-level VLC setting (codenameLocalizedEnabled) work for metahub creation (admin settings fallback in `useCodenameConfig`)
- [x] Merge AddCodenameLocalizedColumns migration into CreateMetahubsSchema, remove legacy migration
- [x] Run lint/tests/build and update memory-bank

---

## Completed: Post-QA Full Remediation — 2026-03-02 ✅

> **Goal**: Fix all remaining issues from the latest QA audit with minimal, safe changes and no residual technical debt in this scope.

- [x] Align metahubs codename blur normalization with style-aware settings (without breaking shared template behavior)
- [x] Enforce strict key validation for `metahubs` category in admin settings route
- [x] Remove remaining TODO technical debt in catalogs details counts (`attributesCount`, `elementsCount`)
- [x] Add service-level value validation for settings `bulkUpsert` path
- [x] Run targeted lint/tests for touched packages and full root `pnpm build`
- [x] Update memory-bank closure (`activeContext.md`, `progress.md`, `tasks.md`) with final evidence

### Verification evidence (this completion)

- [x] `pnpm --filter @universo/template-mui lint` -> pass (warnings only)
- [x] `pnpm --filter @universo/metahubs-frontend lint` -> pass (warnings only)
- [x] `pnpm --filter @universo/admin-backend lint` -> pass (warnings only)
- [x] `pnpm --filter @universo/metahubs-backend lint` -> pass (warnings only)
- [x] `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests)
- [x] `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `117` passed, `3` skipped)
- [x] `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`, `4m33.455s`)

---

## Completed: QA Risk Closure — 2026-03-02 ✅

> **Goal**: Eliminate all QA findings from the latest comprehensive audit with safe, minimal, regression-free changes.
> **Safety constraints**: preserve existing behavior, avoid broad refactors, keep lint/test/build clean in touched scope.

- [x] Harden backend hub-association update paths against concurrent lost updates
  - Note: remove stale full-config writes in hub-scoped catalog/enumeration unlink and hub delete association cleanup flows.
- [x] Remove create-time TOCTOU codename conflict windows in backend routes
  - Note: normalize duplicate key handling to deterministic 409 responses instead of potential 500 on concurrent creates.
- [x] Fix frontend stale codename settings usage in memoized callbacks
  - Note: include `codenameConfig` dependencies where codename validation/normalization is memoized.
- [x] Resolve new lint diagnostics introduced by the fixes
  - Note: no suppression shortcuts; keep code and dependencies explicit.
- [x] Re-run targeted verification and full workspace build
  - Note: run package lint/tests first, then root `pnpm build`.
- [x] Update memory-bank closure (`activeContext.md`, `progress.md`, `tasks.md`)
  - Note: include command evidence and closure status.

### Verification evidence (this completion)

- [x] `pnpm --filter @universo/metahubs-backend lint && pnpm --filter @universo/metahubs-frontend lint` -> no error-level diagnostics (warnings only)
- [x] `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `120/120` tests with `3` skipped)
- [x] `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- [x] `pnpm build` (root) -> pass (`56 successful, 56 total`)

---

## Completed: Session Finalization Handoff — 2026-03-02 ✅

> **Goal**: Close implementation session cleanly after comprehensive QA remediation and ensure final handoff consistency.

- [x] Re-check memory-bank closure entries for QA remediation (`tasks.md`, `activeContext.md`, `progress.md`)
- [x] Confirm latest verification baseline is recorded (template tests, backend tests/lint, full build)
- [x] Prepare final implementation completion report and QA-mode recommendation

### Handoff note

- [x] No new runtime code changes required in this finalization pass; state synchronized and ready for QA validation mode.

---

## Completed: Comprehensive QA Remediation — 2026-03-02 ✅

> **Goal**: Fix all issues identified in the latest QA analysis without regressions or new technical debt.
> **Safety constraints**: preserve existing business behavior, keep changes minimal, enforce lint/test/build green status.

- [x] Fix metahub settings reset/upsert uniqueness conflict in backend service logic
  - Note: upsert after reset must not fail due to `UNIQUE(key)` with soft-deleted rows.
- [x] Align branch codename backend validation with settings-aware style/alphabet policy
  - Note: branch create/update must support the same codename style policy as other metahub entities.
- [x] Harden attribute TABLE copy flow against codename-scope conflicts for child attributes
  - Note: enforce safe conflict handling when `catalogs.attributeCodenameScope=global`.
- [x] Fix `@universo/template-mui` failing tests
  - Note: stabilize `RoleChip` i18n handling in tests and replace incorrect test-runner imports in Jest suites.
- [x] Fix `@universo/utils` lint/prettier errors introduced in active scope
  - Note: keep changes formatting-focused; avoid unrelated refactors.
- [x] Run targeted verification and full workspace validation
  - Note: run package-level lint/test first, then root `pnpm build`.
- [x] Update memory-bank closure entries (`activeContext.md`, `progress.md`, `tasks.md`)
  - Note: include final command evidence and outcomes.

### Verification evidence (this completion)

- [x] `pnpm --filter @universo/template-mui test -- src/components/chips/__tests__/RoleChip.test.tsx src/factories/__tests__/createEntityActions.test.ts` -> pass (`35/35`)
- [x] `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `168/168` tests)
- [x] `pnpm --filter @universo/utils exec eslint --ext .ts src --fix` -> applied autofix; follow-up lint has `0 errors`
- [x] `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/attributesRoutes.test.ts src/tests/routes/branchesOptions.test.ts` -> pass (`10/10`)
- [x] `pnpm --filter @universo/metahubs-backend lint` -> `0 errors` (warnings only)
- [x] `pnpm build` (root) -> `56 successful, 56 total` (`4m35.893s`)

---

## Completed: Codename VLC End-to-End Closure — 2026-03-02 ✅

> **Goal**: Finalize codename VLC implementation parity (frontend + backend), verify with lint/build, and close Memory Bank updates.
> **Safety constraints**: keep canonical `codename` uniqueness behavior unchanged, preserve backward compatibility, avoid schema-breaking migrations.

- [x] Validate frontend dual-mode codename wiring in all metahub entities (metahub, branch, hub, catalog, enumeration, enumeration value, attribute)
  - Note: localized mode must submit `codenameInput` + `codenamePrimaryLocale`; plain mode must preserve current payload semantics.
- [x] Validate backend schema and persistence support for localized codename across catalogs/enumerations/values/attributes
  - Note: localized codename stored only as supplemental metadata (`codenameLocalized` / `presentation.codename`).
- [x] Run targeted lint checks for changed packages and fix all new diagnostics
  - Note: use quiet package-level lint for `@universo/metahubs-frontend` and `@universo/metahubs-backend`.
- [x] Run full workspace build from root and fix any regressions
  - Note: required final verification command is `pnpm build`.
- [x] Update Memory Bank closure files (`activeContext.md`, `progress.md`, `tasks.md`) with verified outcomes
  - Note: include actual command evidence and final completion status.

### Verification evidence (closure baseline)

- [x] `pnpm --filter @universo/metahubs-frontend lint` -> 0 errors (warnings only)
- [x] `pnpm --filter @universo/metahubs-backend lint` after direct eslint autofix -> 0 errors (warnings only)
- [x] `pnpm --filter @universo/metahubs-backend build` -> success after TS2345 typing fix in VLC codename helpers
- [x] `pnpm build` (root) -> `56 successful, 56 total` (time: `4m56.836s`)

---

## Completed: QA Hardening Fixes — 2026-03-02 ✅

> **Goal**: Close all issues from the latest QA audit without regressions or leftover technical debt.

- [x] Enforce `allowDelete` policy in all catalog and enumeration delete paths (including hub-scoped and permanent endpoints)
- [x] Remove unsupported `enumerations.allowedValueTypes` setting (registry + helper + UI exposure) to eliminate misleading config
- [x] Fix TypeScript diagnostics in settings code (`useCodenameConfig` import issue and admin-frontend tsconfig declaration conflict)
- [x] Re-run targeted lint/tests and full workspace build
- [x] Update memory-bank (`activeContext.md`, `progress.md`, `tasks.md`) with final verified outcomes

  - Note: Verification baseline for this completion — quiet ESLint clean for `@universo/metahubs-backend`, `@universo/metahubs-frontend`, `@universo/admin-frontend`; backend targeted route tests `29/29`; full workspace build `56/56`.

---

## Completed: QA Defects Remediation — 2026-03-02 ✅

> **Goal**: Fix all problems identified by comprehensive QA (functional bugs, test regressions, lint errors) without introducing new debt.

- [x] Fix critical codename/settings logic defects in backend and frontend
- [x] Fix failing tests in `@universo/metahubs-frontend`
- [x] Fix lint/prettier errors in affected packages (`metahubs-*`, `admin-*`)
- [x] Re-run targeted checks (`test`, `lint`) and full `pnpm build`
- [x] Update memory-bank (`activeContext.md`, `progress.md`, `tasks.md`) with final verified state

  - Note: Verification baseline for this completion — `@universo/metahubs-frontend` targeted regressions `22/22` files (`97/97` tests), `@universo/metahubs-backend` targeted route suite `10/10`, full workspace build `56/56`.

---

## Completed: Session Closure — 2026-03-01 ✅

> **Goal**: Finalize QA remediation session state across Memory Bank and keep deferred work explicit.

- [x] Reconcile `QA Remediation — 2026-03-02` checklist to actual implementation status
- [x] Update `activeContext.md` with final current state and explicit deferred item
- [x] Add final remediation entry to `progress.md` with verification outcomes

---

## Completed: QA Remediation — 2026-03-02 ✅

> **Goal**: Remove all QA findings from the latest audit without introducing regressions.
> **Complexity**: Level 4

- [x] Integrate metahub CREATE/COPY/UPDATE codename rules with `admin.settings` values (remove hardcoded defaults)
- [x] Make admin settings upsert flow atomic and concurrency-safe
- [x] Prevent partial save on Admin Settings page (all-or-nothing persistence semantics)
- [x] Strengthen admin settings payload typing and validation (remove `any`/weak parsing in new code)
- [x] Fix metahubs-backend failing test suites introduced by codename/settings changes
- [x] Fix lint/prettier issues in newly added or changed files
- [x] Re-run targeted package checks and full workspace build
- [x] Update memory bank (`activeContext.md`, `progress.md`, `tasks.md`) with final status
- [x] Record deferred follow-up for admin settings route tests (no dedicated `@universo/admin-backend` test script/harness in package)

---

## Planned Follow-up: Admin Settings Route Tests

- [ ] Add backend route tests for admin settings CRUD and permission/error scenarios
  - Note: `packages/admin-backend/base/package.json` currently has no `test` script; add/align test harness first.

---

## Completed: Codename Settings & Validation Overhaul — 2026-03-01 ✅

> **Goal**: Make codename generation/validation fully settings-aware across all entity forms. Add new settings (alphabet for kebab, Russian-only alphabet, allow mixed, auto-reformat, require-reformat). Change defaults to pascal-case + en-ru.
> **Complexity**: Level 4
> **Details**: See later sections + progress.md for 9-phase breakdown.

---

## Completed: Admin Global Settings & Metahub Codename Fixes — 2026-03-02 ✅

> **Goal**: Fix 4 issues: (1) metahub creation 400 error with PascalCase Russian codenames, (2) wrong codename helper text, (3) admin global settings system (migration + entity + routes + frontend), (4) RoleEdit layout broken.
> **Complexity**: Level 3

### Issue #1: Fix Metahub 400 Error
- [x] Update `metahubsRoutes.ts` — replace `normalizeCodename`/`isValidCodename` with `normalizeCodenameForStyle`/`isValidCodenameForStyle` in CREATE, COPY, UPDATE handlers
- [x] Add `codenameErrorMessage()` for proper error messages
- [x] Change COPY suffix from `-copy` to `Copy` (PascalCase)

### Issue #2: Fix Codename Helper Text
- [x] Add `codenameHelperPascal` + `codenameHelperPascalEn` i18n keys to root metahubs namespace (EN + RU)
- [x] Create `getCodenameHelperKey()` utility in `useCodenameConfig.ts`
- [x] Update `MetahubList.tsx` and `MetahubActions.tsx` to use dynamic helper key

### Issue #3: Admin Global Settings System
- [x] Consolidate migrations — merge locales table + add settings table to `1733400000000-CreateAdminSchema.ts`
- [x] Delete obsolete `1734100000000-CreateLocalesTable.ts`
- [x] Create `AdminSetting` TypeORM entity with JSONB value column
- [x] Create `adminSettingsRoutes.ts` — GET all, GET by category, GET by category+key, PUT upsert, DELETE
- [x] Add `'settings'` to PermissionSubjects in schemas
- [x] Register routes in admin-backend exports + core-backend at `/admin/settings`
- [x] Create `settingsApi.ts` frontend API module
- [x] Add `settingsQueryKeys` to query keys
- [x] Create `AdminSettings.tsx` page with Metahubs tab (codename style, alphabet, allowMixed) + Applications tab (placeholder)
- [x] Add i18n keys for settings (EN + RU) in admin.json
- [x] Add settings menu item in `menuConfigs.ts` (IconSettings)
- [x] Add settings route in `MainRoutesMUI.tsx`

### Issue #4: Fix RoleEdit Layout
- [x] Replace Grid layout with Stack + flex-row for codename/color fields
- [x] Remove unused `Grid` import

### Verification
- [x] `pnpm build` — 56/56 packages pass
- [x] Update memory-bank

---

### Phase 1: Types & Validation Functions
- [x] Update `CodenameAlphabet` type: add `'ru'` → `'en' | 'ru' | 'en-ru'`
- [x] Change defaults: `general.codenameStyle` → `'pascal-case'`, `general.codenameAlphabet` → `'en-ru'`
- [x] Update `general.codenameAlphabet` options: add `'ru'`, remove "PascalCase only" description
- [x] Add 3 new settings to `METAHUB_SETTINGS_REGISTRY`: `general.codenameAllowMixedAlphabets` (bool, false), `general.codenameAutoReformat` (bool, true), `general.codenameRequireReformat` (bool, true)
- [x] Add kebab-case Russian + en-ru validation patterns & functions in `codename.ts`
- [x] Add pascal-case Russian-only validation pattern & function
- [x] Add `sanitizeCodenameForStyle()` — auto-generate codename from name per settings
- [x] Update `isValidCodenameForStyle()` — add `allowMixed` param, support kebab + ru/en-ru
- [x] Update `normalizeCodenameForStyle()` — support all style+alphabet combos
- [x] Add `hasMixedAlphabets()` helper for mixed alphabet detection

### Phase 2: Backend Helper + Routes
- [x] Update `codenameStyleHelper.ts` — handle `'ru'` alphabet, add `getAllowMixed`, expand `getCodenameSettings`, update error messages
- [x] Update `catalogsRoutes.ts` — read `allowMixed`, pass to `isValidCodenameForStyle`
- [x] Update `hubsRoutes.ts` — same
- [x] Update `enumerationsRoutes.ts` — same
- [x] Update `attributesRoutes.ts` — same (fixed missing `extractAllowMixedAlphabets` import)

### Phase 3: Frontend Hook + Utils
- [x] Create `useCodenameConfig.ts` hook — reads all codename settings, returns { style, alphabet, allowMixed, autoReformat, requireReformat }
- [x] Update `utils/codename.ts` re-exports — add new functions

### Phase 4: i18n + Settings Page UI
- [x] Add i18n keys for 3 new settings (EN + RU)
- [x] Add `'ru'` alphabet option labels, kebab-case preview variants
- [x] Update `SettingsPage.tsx` — remove "hide alphabet when kebab", add conditional visibility for allowMixed (only when en-ru), requireReformat (only when autoReformat=off)
- [x] Update `CodenameStylePreview.tsx` — show previews for all style+alphabet combos

### Phase 5: Frontend Form Components (settings-aware codename)
- [x] Update `CatalogList.tsx` — use settings-aware codename funcs
- [x] Update `HubList.tsx` — same
- [x] Update `EnumerationList.tsx` — same
- [x] Update `EnumerationValueList.tsx` — same
- [x] Update `AttributeActions.tsx` — same + `_cc(values)` in canSave/toPayload/buildProps
- [x] Update `AttributeFormFields.tsx` — same + useEffect config injection
- [x] Update `AttributeList.tsx` — same
- [x] Update `ChildAttributeList.tsx` — same
- [x] Update `MetahubList.tsx` — same
- [x] Update `MetahubActions.tsx` — same + `_cc(values)` in canSave/toPayload
- [x] Update `BranchActions.tsx` — same + `_cc(values)` in canSave/toPayload
- [x] Update `BranchList.tsx` — same
- [x] Update `mutations.ts` — same
- [x] Update `CatalogActions.tsx` — same + useEffect config injection
- [x] Update `HubActions.tsx` — same + useEffect config injection
- [x] Update `EnumerationActions.tsx` — same + useEffect config injection

### Phase 6: Template Seed + Cleanup
- [x] Update `basic.template.ts` — update defaults (pascal-case) + add 3 new settings
- [x] Remove legacy transform script (`tools/transform_codename.py`)

### Phase 7: Build Verification
- [x] `pnpm build` — 56/56 packages pass, 0 TS errors

### Phase 8: Memory Bank
- [x] Update activeContext.md, progress.md, tasks.md

### Phase 9: QA Fixes (post-QA analysis)
- [x] Fix BUG-1: Add `const cc = _cc(values)` to `CatalogActions.tsx` `toPayload` — was runtime crash on save
- [x] Fix BUG-2: Add `const cc = _cc(values)` to `EnumerationActions.tsx` `toPayload` — was runtime crash on save
- [x] Fix ISSUE-3: Rename `validateCatalogForm`/`canSaveCatalogForm` → `validateEnumerationForm`/`canSaveEnumerationForm` in `EnumerationActions.tsx` — copy-paste naming artifact
- [x] Verified: `tsc --noEmit` — 0 cc-related errors; `pnpm build` — 56/56 pass

---

## Completed: Settings Page UI/UX Fixes — 2026-03-03 ✅

> 5 UI/UX issues on Metahub Settings page fixed. Build 56/56. See progress.md.

---

## Completed: QA Fixes — Post-Settings Implementation — 2026-03-03 ✅

> **Goal**: Fix all issues found during QA analysis: 1 critical bug, prettier errors, code duplication, template seed, UI logic, frontend prep, memory-bank refs.
> **Complexity**: Level 2

### Critical
- [x] Add `<ConfirmDialog />` back to SettingsPage.tsx (removed incorrectly in Fix #4; confirm() Promise never resolves)

### Code Quality
- [x] Fix prettier errors in 3 files (SettingsPage.tsx, validation/index.ts, enumerationsRoutes.ts)
- [x] Extract shared `validateSettingValue` from settingsRoutes.ts + MetahubSettingsService.ts into shared module

### Data Completeness
- [x] Add `general.codenameAlphabet` to basic.template.ts seed

### UI Logic
- [x] Hide `general.codenameAlphabet` setting when codenameStyle is `kebab-case`

### Frontend Validation Prep
- [x] Export style-aware codename functions from `utils/codename.ts`
- [x] Add `getCodenameSettings` batch helper to codenameStyleHelper.ts
- [x] Add pascal-case i18n variants for codenameHelper/codenameInvalid (EN + RU)

### Docs
- [x] Update memory-bank stale function name refs (progress.md)

### Verify
- [x] Build verification — `pnpm build` — 56/56

---

## Completed: Metahub Settings Section — 2026-03-02 (IMPLEMENTED)

> **Goal**: Add "Settings" section to Metahub designer with tabbed UI, codename style config, entity-level settings.
> **Status**: ✅ All QA fixes complete — build 56/56
> **Plan**: memory-bank/plan/metahub-settings-plan-2026-03-02.md
> **Complexity**: Level 3
> **QA Review**: 16 findings (3 critical, 6 serious, 3 component reuse, 4 architectural) — all resolved in plan

### Phase 1: Types & Shared Code ✅
- [x] Add settings types to `universo-types` (CodenameStyle, SettingDefinition, SettingValueType incl. `multiselect`, MetahubSettingRow, etc.)
- [x] Add `METAHUB_SETTINGS_REGISTRY` constant (incl. `catalogs.attributeCodenameScope`, `catalogs.allowedAttributeTypes`, `enumerations.allowedValueTypes`)
- [x] Add 1C codename validation to `universo-utils` (regex: `/^[A-ZА-Я][A-ZА-Яa-zа-яA-Za-z0-9_]{0,79}$/`)

### Phase 2: Backend Service & Routes ✅
- [x] Create `MetahubSettingsService` (bulkUpsert with `knex.transaction()`)
- [x] Create `settingsRoutes.ts` — `Router({ mergeParams: true })`, `router.use(ensureAuth)`, `asyncHandler`
  - URLs: `/metahub/:metahubId/settings` (collection), `/metahub/:metahubId/setting/:key` (single)
- [x] Create `codenameStyleHelper.ts` — `getCodenameStyle()`, `getAttributeCodenameScope()`, `getAllowedAttributeTypes()`
- [x] Register in `router.ts`, add seed to `basic.template.ts`

### Phase 3: Backend Integration ✅
- [x] Update `catalogsRoutes.ts` — codename style + allowCopy/allowDelete checks
- [x] Update `hubsRoutes.ts` — same
- [x] Update `enumerationsRoutes.ts` — same + allowedValueTypes
- [x] Update `attributesRoutes.ts` — codename style + attributeCodenameScope + allowedAttributeTypes

### Phase 4: Frontend Domain ✅
- [x] Create `settingsApi.ts` (singular `/setting/:key` for single-resource endpoints)
- [x] Create `useSettings.ts` (useSettings, useUpdateSettings, useResetSetting, useSettingValue hooks)
- [x] Create `SettingsPage.tsx` — reuse TemplateMainCard, ViewHeaderMUI, ConfirmDialog/useConfirm
- [x] Create `SettingControl.tsx` (incl. multiselect: MUI Checkbox group)
- [x] Create `CodenameStylePreview.tsx`

### Phase 5: Frontend Integration ✅
- [x] Add settings query keys + invalidation helpers to `queryKeys.ts`
- [x] Add i18n keys (EN/RU) — incl. attributeCodenameScope, allowedAttributeTypes
- [x] Update `i18n/index.ts` bundle + export from `index.ts`

### Phase 6: Route & Menu Registration ✅
- [x] Add settings route in `MainRoutesMUI.tsx` (lazy Loadable with `(m: any)` pattern)
- [x] Add settings menu item in `menuConfigs.ts` (IconSettings, divider-footer)
- [x] Add settings menu item in `metahubDashboard.ts` (IconSettings, divider-footer)

### Phase 7: Build & Verify ✅
- [x] `pnpm build` — 56/56 packages pass
- [ ] Test API + UI (incl. multiselect, attributeCodenameScope, allowedAttributeTypes)
- [x] Update memory-bank

### Phase 8: QA Fixes (10 issues) ✅
- [x] Fix #7: Extract `codenameErrorMessage` to `codenameStyleHelper.ts`, remove from 4 route files
- [x] Fix #8: Batch N+1 settings queries in `attributesRoutes.ts` using `findAll()` + extract helpers
- [x] Fix #2: Add `getAllowedEnumValueTypes` to `codenameStyleHelper.ts` (future enforcement ready)
- [x] Fix #6: Add registry-aware value validation in `settingsRoutes.ts` PUT handler (`validateSettingValue`)
- [x] Fix #9: Validate key against registry in DELETE handler
- [x] Fix #10: Fix `resetToDefault` to filter by `_mhb_deleted: false`
- [x] Fix #4+5: Fix API response types in `settingsApi.ts` + return merged format in PUT
- [x] Fix #3: Add missing `enumerations.allowedValueTypes` i18n keys (EN + RU)
- [x] Fix #1: Create `useEntityPermissions` hook + export from package
- [x] Build 56/56 — all fixes verified

---

## Completed: VLC Comment Consolidation — Metahubs + Applications (2026-03-02) ✅

> **Goal**: Merge second metahubs migration into first (comment TEXT→JSONB), ensure applications-backend & frontend store/display comment the same VLC way as metahubs.
> **Status**: ✅ Complete — build 56/56

### Metahubs Backend (migration consolidation)
- [x] Change `comment TEXT` → `comment JSONB` in `1766351182000-CreateMetahubsSchema.ts` (line 358)
- [x] Delete `1766351182001-AlterMetahubUsersCommentToJsonb.ts`
- [x] Update `migrations/postgres/index.ts` — remove second migration import

### Applications Backend (align with metahubs VLC pattern)
- [x] Change `comment TEXT` → `comment JSONB` in `1800000000000-CreateApplicationsSchema.ts` (line 259)
- [x] Update `ApplicationUser` entity: `type: 'text'` → `type: 'jsonb'`, add VLC type
- [x] Update `applicationsRoutes.ts`:
  - `mapMember`: add `commentVlc` field (like metahubs)
  - Invite member: accept localized `comment` input + `commentPrimaryLocale`
  - Update member: same VLC input handling
  - Copy member: preserve JSONB comment

### Applications Frontend (align with metahubs VLC pattern)
- [x] Update `ApplicationMember` type in `types.ts`: add `commentVlc` field
- [x] Update `applications.ts` API: `inviteApplicationMember` and `updateApplicationMemberRole` to pass VLC data
- [x] Update `ApplicationMemberActions.tsx`: add `localizedComment: true` + `getInitialFormData`
- [x] Update `ApplicationMembers.tsx`:
  - Add VLC imports (`getVLCString`, `extractLocalizedInput`)
  - `isMemberFormData`: validate `commentVlc` field
  - `handleInviteMember`: accept VLC data, call `extractLocalizedInput`
  - `createMemberContext.updateEntity`: use `extractLocalizedInput`
  - Table comment column: resolve VLC string
  - Card description: resolve VLC string
  - `MemberFormDialog`: add `commentMode='localized'`, `uiLocale`, `commentTooLongMessage`
- [x] Update `mutations.ts`: change `InviteMemberParams` and `UpdateMemberRoleParams` to use VLC types

### Verification
- [x] Build entire project (`pnpm build`) — 56/56
- [x] Update memory-bank

---

## Completed: PostgreSQL NUMERIC → JS Number Coercion Fix (2026-03-02) ✅

> **Goal**: Fix "Invalid value for kolichestvo: Expected number value" — pg returns NUMERIC columns as strings, causing write validation to fail.
> **Status**: ✅ Complete — build 56/56

### Root Cause
- PostgreSQL `NUMERIC(10,0)` columns return string values via `node-postgres`
- Application runtime endpoints passed strings through without conversion
- `coerceRuntimeValue` required strict `typeof value === 'number'`
- Metahubs unaffected because it stores data in JSONB (preserves JS number types)

### Changes (all in `applicationsRoutes.ts`)
- [x] Add `pgNumericToNumber` helper — safe NUMERIC string → JS number conversion
- [x] Fix `resolveRuntimeValue` — add NUMBER case for LIST endpoint
- [x] Fix `coerceRuntimeValue` — accept numeric strings for NUMBER type (all write endpoints)
- [x] Fix GET single row endpoint — convert NUMBER attributes to JS numbers
- [x] Fix GET tabular rows endpoint — convert NUMBER child attributes to JS numbers
- [x] Build verification — 56/56

---

## Completed: API Error Message Propagation Fix (2026-03-02) ✅

> **Goal**: Fix hidden 400 error messages — show actual server validation error text to users instead of generic "Request failed with status code 400".
> **Status**: ✅ Complete — build 56/56

### Changes
- [x] Add `extractApiErrorMessage` helper to `useCrudDashboard.ts` — extracts `error`/`message` from Axios response body
- [x] Update all catch blocks (create, update, delete) in `useCrudDashboard.ts` to use helper
- [x] Add `extractApiErrorMessage` helper to `RuntimeInlineTabularEditor.tsx`
- [x] Update all catch blocks (create, update, delete, copy, processRowUpdate) in `RuntimeInlineTabularEditor.tsx`
- [x] Build verification — 56/56

---

## Completed: Documentation Overhaul — GitBook Stubs (2026-03-01) ✅

> **Goal**: Delete all outdated docs (2023 files from Flowise era), create GitBook-standard stub pages in EN/RU.
> **Status**: ✅ Complete — 41 files EN + 41 files RU, line counts matched, root README updated

- [x] Analyze existing docs structure (2023 files, 175 directories)
- [x] Research GitBook format (SUMMARY.md, front matter, hints, cards)
- [x] Delete all old files in docs/en and docs/ru (including .gitbook/assets)
- [x] Create EN GitBook stubs (41 files across 7 sections)
- [x] Create RU GitBook stubs (41 files mirroring EN structure)
- [x] Align EN/RU line counts (25 pairs fixed)
- [x] Update docs/README.md root (removed Spanish, updated links)
- [x] Verify structure parity (41/41 files, all line counts OK)
- [x] Update memory-bank

---

## Completed: Legacy Packages Removal (10 packages) — 2026-02-28 ✅

> **Goal**: Remove 10 legacy packages and all cross-references (9-phase plan).
> **Status**: ✅ Complete — build 56/56 (was 66/66 before removal)
> **Plan**: memory-bank/plan/legacy-packages-removal-plan-2026-03-01.md

- [x] Phase 1: @universo/types cleanup — removed 4 validation files, 4 re-exports, 5 PermissionSubject/PERMISSION_SUBJECTS entries
- [x] Phase 2: Backend core cleanup — routes/index.ts, index.ts, entities, migrations, package.json
- [x] Phase 3: Admin permissions — admin-backend schemas, admin-frontend i18n EN/RU
- [x] Phase 4: universo-template-mui — routes, menus, breadcrumbs, hooks, tests (~8 files)
- [x] Phase 5: flowise-core-frontend — i18n imports, deps, vite config
- [x] Phase 6: Delete 10 package directories
- [x] Phase 7: Update documentation — EN/RU READMEs, deleted 6 doc directories
- [x] Phase 8: Build verification — pnpm install + pnpm build (56/56)
  - Note: Unplanned fix in start-backend/onboardingRoutes.ts — replaced 357-line file with stub (entities removed)
  - Note: Removed 3 deps from start-backend/package.json
- [x] Phase 9: Memory bank updates
- [x] Phase 10 (QA fixes): flowise-template-mui MenuList cleanup, dashboard.js cleanup, lint fixes, docs/ru cleanup, onboarding 404 fix

---

## Active: PR #698 QA Fixes — 2026-02-28 ✅

> **Goal**: Fix issues found during comprehensive QA analysis of Publication Drill-In.
> **Status**: ✅ Complete — build 66/66, lint 0 errors

- [x] M1: Wrap ACTIVATE VERSION in `ds.transaction()` for atomicity (deactivate + activate + update activeVersionId)
- [x] M2: Add Zod validation schemas `createVersionSchema` / `updateVersionSchema` for CREATE/UPDATE VERSION endpoints
- [x] L1: Fix prettier errors in `publicationsRoutes.ts` (line-length in ternaries and `console.error`)
- [x] L1: Fix prettier errors in `applicationSyncRoutes.ts` (inline interface → multi-line)
- [x] L1: Fix prettier errors in `PublicationVersionList.tsx`, `PublicationApplicationList.tsx`, `PublicationList.tsx`
- [x] Build: 66/66
- [ ] Push fixes commit

---

## Completed: PR #698 Review Fixes — 2026-02-28 ✅

> **Goal**: Address Copilot bot review comments on PR #698 (Publication Drill-In).
> **Status**: ✅ Complete — pushed commit 2d7e07a4

- [x] Fix branchId fallback — use `metahub.defaultBranchId` instead of empty string (C2)
- [x] Remove unused vars — `publicationName` + `usePublicationDetails` in VersionList & AppList (C3, C7)
- [x] Add noopener — `noopener,noreferrer` to `window.open()` calls (C8)
- [x] Fix nullable names — use `buildLocalizedContent` from `@universo/utils` for VLC fallback (C6)
- [x] Compress memory-bank — tasks.md, activeContext.md, progress.md (C1, C4, C5)
- [x] Build: 66/66
- [x] Push updated commit and re-request review

---

## Completed: Publication Drill-In UX Polish Round 2 — 2026-02-28 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-28

### PDUX2-1. Link colors (Publications + Applications tables)
- [x] Match catalog link style: `color: 'inherit'`, underline + primary.main on hover
- [x] Fix in PublicationList.tsx publicationColumns
- [x] Fix in PublicationApplicationList.tsx appColumns

### PDUX2-2. Actions column styling (Versions + Applications)
- [x] Remove custom "actions" column from customColumns in both components
- [x] Use FlowListTable `renderActions` prop (standardized 10% width, centered)
- [x] MoreVert button matching catalog BaseEntityMenu size

### PDUX2-3. Pagination (Versions + Applications tabs)
- [x] Add client-side pagination state (useState for page/pageSize)
- [x] Slice data for current page
- [x] Add PaginationControls below FlowListTable in both components

### PDUX2-4. Application name link URL
- [x] Fix from `/application/${slug}` to `/a/${id}`
- [x] Open in new tab (target="_blank")

### PDUX2-5. Application menu action URLs + new tab
- [x] Fix "Open application" to `/a/${id}` in new tab via window.open()
- [x] Fix "Application dashboard" to `/a/${id}/admin` in new tab via window.open()
- [x] Remove incorrect navigate() usage

### Verification
- [x] `pnpm build`: 66/66
- [x] Update memory-bank

## Completed: Publication Drill-In UX Polish — 2026-02-28 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-28

### PDUX-1 through PDUX-8
- [x] PDUX-1: Publication name as drill-in link navigating to `/publication/:id/versions`
- [x] PDUX-2: Breadcrumbs — remove UUID fallback ("..."), add tab suffix based on segments[4]
- [x] PDUX-3: ViewHeader title — show only tab name, not publication name
- [x] PDUX-4: Versions table — fix name render, remove Branch column, adjust widths
- [x] PDUX-5: Add search field for versions and applications tabs
- [x] PDUX-6: Version row three-dot menu (Edit/Activate/Delete) + DELETE endpoint + hook
- [x] PDUX-7: Applications tab — name display, translate Slug, fix createdAt key, action menu
- [x] PDUX-8: i18n translations EN/RU (version delete, app actions, search, menu)
- [x] Build: 66/66

## Completed: Publication Create Dialog & Schema Fixes — 2026-02-28 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-28

- [x] PCF-1: Fix TypeError — useCommonTranslations destructuring in VersionList and AppList
- [x] PCF-2: Rework Create Publication dialog — toggles above CollapsibleSection, app fields inside
- [x] PCF-3: Fix broken schema creation — DDL after TypeORM transaction commit (deadlock fix)
- [x] PCF-4: Add applicationNameVlc/descriptionVlc inside CollapsibleSection
- [x] Build: 66/66

## Completed: CollapsibleSection Export Fix — 2026-02-28 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-28

- [x] Move CollapsibleSection.tsx → components/layout/CollapsibleSection.tsx
- [x] Create components/layout/index.ts barrel
- [x] Update components/index.ts path reference
- [x] Add CollapsibleSection + CollapsibleSectionProps to src/index.ts exports
- [x] Build: 66/66 (was 64/65 — core-frontend now succeeds)

## Completed: Publications Drill-In Navigation & Create Dialog Rework — 2026-02-28 ✅

> **Status**: ✅ Complete — Full R1-R9 implementation
> Details: progress.md — 2026-02-28

### PDI-R1. Backend: Extract helper + new endpoint + createApplicationSchema
- [x] R1.0: Extract `createLinkedApplication()` helper
- [x] R1.1: Add `createApplicationSchema` to Zod schema
- [x] R1.2: Refactor CREATE handler — DDL after transaction, use helper
- [x] R1.3: New POST .../publication/:publicationId/applications endpoint
- [x] R1.4: Build metahubs-backend — passes

### PDI-R2 through PDI-R9
- [x] R2: Frontend routes + lazy imports for version/application sub-pages
- [x] R3: PublicationVersionList + API + hooks (list, create, activate, update)
- [x] R4: PublicationApplicationList + API + hooks (create via publication)
- [x] R5: PublicationList drill-in + Create Dialog rework (2 tabs, CollapsibleSection)
- [x] R6: PublicationActions simplification (2 tabs: General, Access)
- [x] R7: i18n keys EN + RU (~13 keys each)
- [x] R8: Cleanup legacy panels (3 files deleted: VersionsPanel, ApplicationsPanel, ApplicationsCreatePanel)
- [x] R9: Full build 66/66 — 11 new, 11 modified, 3 deleted

## Completed: QA Fixes — Publication Drill-In Remediation — 2026-02-28 ✅

> **Status**: ✅ Complete — 10 issues fixed
> Details: progress.md — 2026-02-28

- [x] H-1: Application slug collision — generate unique slug per application (not per publication)
- [x] M-1: Lint --fix (17→0 errors metahubs-frontend, 3→0 template-mui)
- [x] M-2: Remove unused imports (Typography, metahubsQueryKeys, ApplicationUser) in 4 files
- [x] M-3: Fix Russian i18n fallback → English (PublicationList.tsx)
- [x] M-4: Fix react-hooks/exhaustive-deps (rawVersions, rawApps wrapped in useMemo)
- [x] M-5: Add name validation + disabled Create button in PublicationApplicationList
- [x] L-2: Replace `publicationName!` with safe fallback in createLinkedApplication
- [x] L-3: Add documentation comment for cross-domain invalidation pattern
- [x] L-4: Add aria attributes to CollapsibleSection (role, aria-expanded, keyboard handler)
- [x] Build: 66/66

---

## Completed: Copy UX & QA Remediation — 2026-02-27 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-27

### QA Remediation Round 10 — Copy UX
- [x] Standardized copy naming convention: i18n-driven naming per metahub locale
- [x] Template seed respects metahub primary locale during copy

### PR #696 Bot Review Fixes
- [x] Safe `typeof` checks for string access patterns
- [x] Dead code removal across modified files
- [x] `rel="noopener noreferrer"` for external links
- [x] Nullable name safe-access patterns

### Copy UX Simplification + Entity Copy
- [x] `generateCopyName()` helper with i18n " (copy N)" suffix — shared across metahubs + applications
- [x] Metahub copy dialog with progress indicator, error handling, advisory lock
- [x] Application copy with schema status reset (SYNCED→SYNCED, else→OUTDATED)
- [x] Application copy clears `schemaError` and `lastSyncedPublicationVersionId`
- [x] QA Remediation Round 5: edge case — copy with no active branch
- [x] QA Remediation Round 6: error message clarity for locked metahubs
- [x] QA Remediation Round 7: copy naming collision detection
- [x] QA Remediation Round 8: schema status propagation after copy
- [x] QA Remediation Round 9: connector cleanup during entity copy

### Verification
- [x] Build: 66/66

## Completed: Copy Flows & NUMBER Field — 2026-02-26 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-26

### Copy Flows
- [x] QA Remediation Round 1: copy safety — prevent copy of soft-deleted entities
- [x] QA Remediation Round 2: schema sync after copy — ensure target has correct status
- [x] QA Remediation Round 3: unique constraint handling during copy (codename conflicts)
- [x] QA Remediation Round 4: FK reference integrity for copied connector publications
- [x] PR #692 Bot Review: hardcoded locale → metahub locale, inline helpers, formatting
- [x] Copying UX/Logic Upgrade: generateCopyName, ApplicationSchemaStatus reset, advisory lock
- [x] Copy flow integration: advisory lock prevents concurrent copies of same entity

### NUMBER Field Parity
- [x] Zone-aware ArrowUp/ArrowDown stepping across all 3 form contexts
- [x] NumberEditCell complete rewrite for parity with standalone number field
- [x] Fix inline table nonNegative: prevented NaN→null regression
- [x] 5 files across 3 packages (apps-template-mui, metahubs-frontend, metahubs-backend)

### Verification
- [x] Build: 66/66

## Completed: QA & Architecture — 2026-02-24 to 2026-02-25 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-24 to 2026-02-25

### QA Rounds 5-8 (02-25 to 02-26)
- [x] Round 5: Constraint text UX — human-readable constraint violation messages
- [x] Round 6: Spacing fixes — table cell padding alignment, dialog margins
- [x] Round 7: 3-dot menu alignment — consistent MoreVert positioning across all lists
- [x] Round 8: Runtime bugs — stale cache, error state recovery, loading indicators
- [x] Comprehensive QA pass: 15+ issues resolved across metahubs frontend/backend

### Architectural Improvements (02-24)
- [x] Attribute edit race condition fix — useRef snapshot prevents stale data submission
- [x] 422 error payload: structured blocker array instead of plain string message
- [x] i18n support for structured blockers in migration guard UI
- [x] Error feedback: toast notifications for validation failures

### QA Remediation Rounds 1-2 (02-24)
- [x] Button spacing, toast improvements, deletion guard
- [x] Empty-state messaging, column width adjustments

### QA Findings Code Remediation (02-24)
- [x] 5 bugs + 5 warnings across attributes, catalogs, API routes

### Unified Application Migration Guard QA Fixes (02-24)
- [x] BUG-1: "Continue anyway" button calling refetch instead of dismissing
- [x] BUG-2: Application copy missing `appStructureVersion` + `lastSyncedPublicationVersionId`
- [x] 5 additional WARNs/INFOs fixed

### Verification
- [x] Build: 66/66

## Completed: QA & Child TABLE Editing — 2026-02-23 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-23

- [x] QA Safe Remediation: number display, optimistic lock, enum dropdown, status dialog
- [x] QA Recommendations Implementation: 2 high + 3 medium improvements
- [x] Child TABLE Editing & Select UX Parity: full inline editing matching parent table
- [x] Inline Edit, Empty Option & Schema Diff i18n: 4 targeted fixes
- [x] Element Create & Attribute List UX: validation, column widths, i18n
- [x] QA Remediation Pass: 7 issues across frontend/backend
- [x] Child TABLE Select UX: dropdown, column widths, type consistency
- [x] QA Findings Remediation: 6 issues (data loading, types, error handling)
- [x] Child TABLE Attribute Parity + Sync FK Fix: full parity, 6 files
- [x] Dialog Init & Child REF Persistence Fix: form initialization, persistence, 4 files
- [x] Build: 66/66

## Completed: TABLE Attribute & QA — 2026-02-21 to 2026-02-22 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-21 to 2026-02-22

### Documentation (02-22)
- [x] README updates — metahubs-frontend (EN/RU): ColumnsContainer, MigrationGuard, Blockers i18n
- [x] README updates — metahubs-backend (EN/RU): Structured Blockers, Migration Endpoints, file structure
- [x] New apps-template-mui README (EN/RU): dashboard system, zone widgets, CRUD, 307 lines each

### TABLE Attribute UX (02-21 to 02-22)
- [x] Rounds 1-5.4: comprehensive inline editing with DnD reorder
- [x] Round 6: stacked columns layout, delete confirmation dialog, persistence
- [x] Column ordering via drag handles, auto-save on reorder

### QA Fixes (02-21 to 02-22)
- [x] Critical/Major Pass: 5 critical + 3 major issues (data loss, cascades, schema sync)
- [x] Rounds 1-4: grid styling, delete cascade fix, schema diff alignment, i18n
- [x] PR #686 Bot Review: import cleanup, typing improvements, deprecation markers, lodash removal

### Entity Management (02-21)
- [x] Hub Delete Blockers: cascading FK checks across catalogs/hubs/attributes/elements
- [x] Confirmation dialog with blocker list display
- [x] Unified Action Menus: standardized 3-dot MoreVert menus across all entity types
- [x] Build: 66/66

## Completed: TABLE Attribute Type — 2026-02-21 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-21

- [x] Full TABLE attribute type: backend CRUD, schema DDL, frontend editing
- [x] Inline editing with DnD reorder, REF column support
- [x] Publication snapshot pipeline for TABLE children
- [x] Build: 66/66

## Completed: Enumerations Feature — 2026-02-18 to 2026-02-19 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-18 to 2026-02-19

### QA & Stabilization
- [x] QA Round 1: runtime safety — FormDialog enum default injection (undefined vs null)
- [x] QA Round 2: structure versioning — consolidated V1/V2/V3 → single V1
- [x] QA Round 3: FK safety — enum REF targets `_app_enum_values(id)`
- [x] QA Round 4: restore conflict — 409 on codename collision, locale fallback
- [x] QA Round 5: toggle-required guard — ownership validation for defaultEnumValueId
- [x] Stabilization: presentation canonicalization, backend fixes, shared DTO types
- [x] Hardening: metadata cleanup order, duplicate guard, stale values cleanup

### Frontend/UI Integration
- [x] Enumeration list + values list flows with CRUD hooks
- [x] Attribute presentation tab: enumPresentationMode (select/radio/label)
- [x] TargetEntitySelector supports enumeration target kind
- [x] i18n: enumerations, enumerationValues, ref.*, attributes.presentation.* (EN/RU)

### QA Fixes + UI Polish Rounds 5-6
- [x] Round 6: delete cascade N+1→bulk UPDATE, prettier fixes, baseline column, layout default
- [x] Round 5: widget label i18n, dry run text, actions headerName, schema/template split
- [x] Build: 66/66

## Completed: Migration Guard — 2026-02-18 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-18

### i18n & Language
- [x] i18n consolidation bug: `consolidateApplicationsNamespace()` dropped migrationGuard/underDevelopment/maintenance
- [x] LanguageSwitcher widget: copied from universo-template-mui, registered in dashboard
- [x] Template version bump 1.0.0 → 1.1.0 to trigger update_available

### Post-QA Polish (3 Rounds)
- [x] Round 1: BUG-1 CRITICAL — missing `import '@universo/applications-frontend/i18n'`
- [x] Round 2: BUG-2 — local SchemaStatus (5 values) vs backend (7 values) mismatch
- [x] Round 3: BUG-3 — paginationDisplayedRows ignored MUI v8 estimated parameter
- [x] WARN fixes: double AppMainLayout wrap, typo in RU locale, hardcoded bgcolor

### Core Implementation
- [x] Runtime Fix: `jsx: "react"` → `"react-jsx"` (React.createElement without import)
  - dist/index.mjs now contains `import { jsx } from "react/jsx-runtime"`
- [x] QA Round 1: split ./utils (pure JS) and . (React-dependent) entry points
- [x] QA Round 2: removed MIGRATION_STATUS_QUERY_OPTIONS from data-listing hooks
- [x] Full Spec (6 phases): table rename, shared package, AGENTS.md, MIGRATIONS.md, README, dedup
  - MigrationGuardShell<TStatus> render-props pattern in migration-guard-shared
  - Both guards rewritten (202→134 / 199→154 lines)
- [x] Unified App Migration Guard QA (2 rounds): extractAxiosError.message, isAdminRoute regex,
  copy status reset, N+1→bulk UPDATE, advisory lock, aria improvements
- [x] Build: 66/66

## Completed: Dashboard & Architecture — 2026-02-17 to 2026-02-20 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-17 to 2026-02-20

### 5-Étap QA Fixes (02-20)
- [x] Étap 1: Editor canSave + dirty tracking with useRef snapshot
- [x] Étap 2: Inner widget label display in LayoutDetails chip labels
- [x] Étap 3: Migration guard "Apply (keep data)" button with loading/error states
- [x] Étap 4: Structured blockers i18n — StructuredBlocker interface, 16 sites converted, 15 keys
- [x] Étap 5: Multi-widget columns — `widgets[]` array, DnD editor, MAX_WIDGETS_PER_COLUMN=6

### columnsContainer & Dashboard (02-17 to 02-19)
- [x] columnsContainer QA: multiInstance=false, Array.isArray guard, useMemo for refs
- [x] Center Zone: zone-aware buildDashboardLayoutConfig, detailsTable seed (sortOrder 6)
- [x] Dashboard Zones (4 phases): widget split, right drawer, columnsContainer, route factory
- [x] DashboardDetailsContext for MainGrid rendering, standalone fallback

### Architecture Refactoring (02-17)
- [x] Headless Controller Hook + CrudDataAdapter pattern
- [x] DashboardApp 483→95 lines (-80%), ApplicationRuntime 553→130 lines (-76%)
- [x] createStandaloneAdapter (raw fetch) + createRuntimeAdapter (auth'd apiClient)

### UI Polish & QA Rounds 3-6 (02-17)
- [x] Button position, actions centering, DataGrid i18n getDataGridLocaleText
- [x] Required null check, extractErrorMessage, 5 shared mutation hooks, schema fingerprint
- [x] Build: 65-66/65-66

## Completed: Runtime CRUD & QA — 2026-02-14 to 2026-02-16 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-14 to 2026-02-16

### Dialog & Theme Fixes
- [x] QA Round 5: dialog input styling — shared spacing constants, MuiOutlinedInput padding fix
  - Root cause: apps-template-mui had compact MUI Dashboard style incompatible with form dialogs
- [x] QA Round 4 (CRITICAL): removed duplicate AppTheme+CssBaseline from Dashboard.tsx
- [x] Runtime rename: 60+ identifiers across 6+ files (runtime→app namespace)

### Validation & Security
- [x] QA Round 3: AppMainLayout wrapper, hooks order fix, ConfirmDeleteDialog, FormDialog i18n
- [x] QA Round 2: Date validation (new Date + isNaN), UUID validation, cache broadening, VLC check
- [x] Security: UUID_REGEX constant, _upl_updated_by audit field, safe error handling (no re-throw)
- [x] Runtime CRUD (7 phases): POST/PATCH/DELETE rows, FormDialog, VLC, i18n, DataGrid UX
- [x] Build: 65/65

---

## Completed: Metahubs UX & Migrations — 2026-02-13 to 2026-02-14 ✅

- [x] Boolean fix, auto-fill, presentation tab, UI/UX polish rounds 1-2
- [x] QA remediation, Zod schema, pool starvation fix, widget activation, README rewrite
- Details: progress.md — 2026-02-13 to 2026-02-14

## Completed: QA Rounds 3-16 & Baseline — 2026-02-11 to 2026-02-12 ✅

- [x] 14 QA rounds: security, atomicity, locks, pool, cache, read-only, scoped repos
- [x] Structure baseline, template cleanup, DDL fixes, 76+ tests
- Details: progress.md — 2026-02-11 to 2026-02-12

## Completed: Migration Architecture & Templates — 2026-02-10 to 2026-02-11 ✅

- [x] Template system (10 phases), DDL engine (7 phases), migration architecture reset
- [x] Typed metadata, manifest validator, seed executor, plan/apply API
- Details: progress.md — 2026-02-10 to 2026-02-11

## Completed: PR Review & Layouts/Runtime — 2026-02-05 to 2026-02-09 ✅

- [x] PR #668, menu widget system, layout DnD, runtime + DataGrid, layouts foundation
- [x] Attribute data types (STRING/NUMBER/BOOLEAN/DATE/REF/JSON), display attribute
- Details: progress.md — 2026-02-05 to 2026-02-09

---

## [2026-01] Historical Completed Tasks ✅

- Jan 29 — Feb 4: Branches system, Elements rename, three-level system fields, optimistic locking
- Jan 16 — Jan 28: Publications, schema-ddl, runtime migrations, isolated schema, codename field
- Jan 11 — Jan 15: Applications modules, DDD architecture, VLC, Catalogs, i18n localized fields
- Jan 4 — Jan 10: Onboarding, legal consent, cookie banner, captcha, auth toggles
- Details: progress.md (January 2026 entries)

## [2025-12] Historical Completed Tasks ✅

- Dec 18-31: VLC system, Dynamic locales, Flowise 3.0, AgentFlow, Onboarding wizard
- Dec 5-17: Admin panel, Auth migration, UUID v7, Package extraction, Admin RBAC
- Details: progress.md (December 2025 entries)

## [Pre-2025-12] Historical Tasks ✅

- v0.40.0: Tools/Credentials/Variables extraction, Admin Instances MVP
- v0.39.0: Campaigns, Storages modules, useMutation refactor
- v0.38.0: Organizations, Projects, AR.js Quiz Nodes
- v0.37.0: REST API docs (OpenAPI 3.1), Uniks metrics
- v0.36.0: dayjs migration, publish-frontend architecture
- v0.35.0: i18n TypeScript migration, rate limiting
- v0.34.0: Global monorepo refactoring, tsdown build system
- v0.33.0-v0.21.0: Metaverses, Canvas, Publications, Resources, Auth, Space Builder, UPDL
- Details: progress.md (Pre-December 2025 entries)

---

## PLANNED TASKS

### Infrastructure & Auth
- [ ] Evaluate session persistence strategies (PostgreSQL, Redis, JWT)
  - Note: current sessions are in-memory, not persistent across restarts
- [ ] Review auth architecture for scalability
  - Note: Passport.js + Supabase hybrid; needs evaluation for multi-instance
- [ ] Role cloning, templates, permission inheritance
- [ ] Audit log for role/permission changes
- [ ] Multi-instance support (remote instances)

### User Experience
- [ ] Dark mode theme
  - Note: some hardcoded colors exist (e.g., 'grey.50' was fixed to 'action.hover')
- [ ] Keyboard shortcuts
- [ ] Mobile responsiveness improvements
  - Note: SideMenuMobile exists but limited testing
- [ ] Tour/onboarding for new users

### Performance & Documentation
- [ ] Server-side caching, CDN integration
- [ ] Bundle size optimization
- [ ] Complete API documentation (OpenAPI)
  - Note: partial OpenAPI 3.1 docs exist in packages/
- [ ] Architecture decision records (ADR)

## TECHNICAL DEBT

- [ ] Refactor remaining useApi -> useMutation
  - Note: most packages migrated, some legacy patterns remain
- [ ] Standardize error handling across packages
  - Note: extractErrorMessage helper exists but not uniformly used
- [ ] Add unit/E2E tests for critical flows
  - Note: metahubs-backend has test suites, frontend testing limited
- [ ] Resolve Template MUI CommonJS/ESM conflict
  - Note: migration-guard-shared uses react-jsx transform as workaround
- [ ] Database connection pooling optimization
  - Note: pool starvation fixed (Promise.all→single query), budget formula updated

## SECURITY TASKS

- [ ] Rate limiting for all API endpoints
  - Note: Redis-based rate limiting exists for some endpoints
- [ ] CSRF protection review
  - Note: CSRF token lifecycle documented in systemPatterns.md
- [ ] API key rotation mechanism
- [ ] Security headers (HSTS, CSP)
- [ ] Security audit
- [ ] 2FA/MFA system

## Deferred: Layout Defaults + Menu Creation + Schema Diff (2026-02-09)

- [ ] Add second left-zone divider in default layout seeds
  - Note: only one divider in current DEFAULT_DASHBOARD_ZONE_WIDGETS
- [ ] Reset new menu widget defaults (empty title, auto-show off, no items)
  - Note: current defaults come from template seed with pre-populated items
- [ ] Prevent stale diff flash in connector schema sync dialog
  - Note: ConnectorDiffDialog shows briefly before data loads
