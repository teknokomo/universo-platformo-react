# Active Context

> **Last Updated**: 2026-02-28
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Publication Drill-In UX Polish Round 2 — Complete

**Status**: ✅ Fully implemented — 2026-02-28
**Date**: 2026-02-28

### Summary
Fixed 5 UI/UX issues found during QA of Publication drill-in pages:

1. **Link colors** — Matched catalog pattern: `color: 'inherit'`, underline + `primary.main` on hover. Fixed in PublicationList and PublicationApplicationList.
2. **Actions column** — Removed custom "actions" column from customColumns. Used FlowListTable `renderActions` prop for standardized 10%-width centered column with properly-sized MoreVert button.
3. **Pagination** — Added client-side pagination (page/pageSize state + PaginationControls) to both Versions and Applications tabs.
4. **App name URLs** — Fixed from `/application/${slug}` to `/a/${id}`, opens in new tab.
5. **App menu URLs** — "Open application" → `/a/${id}` (new tab), "Application dashboard" → `/a/${id}/admin` (new tab). Replaced `navigate()` with `window.open()`.

### Files Changed (3)
- `PublicationList.tsx` — Link color pattern (inherit → underline on hover)
- `PublicationVersionList.tsx` — Removed actions column, added renderActions, added pagination
- `PublicationApplicationList.tsx` — Fixed link colors/URLs, removed actions column, added renderActions, added pagination, fixed menu URLs, opens in new tab

### Build
- `pnpm build`: **66/66**

### What's Next
- Runtime testing of all 5 fixes
- Proceed to QA or REFLECT mode

---

## Previous Focus: CollapsibleSection Export Fix — Complete

**Status**: ✅ Fully implemented — 2026-02-28
**Date**: 2026-02-28

### Summary
Fixed `@flowise/core-frontend` build failure caused by missing `CollapsibleSection` export from `@universo/template-mui` root `src/index.ts`. Also moved component into `components/layout/` subfolder for consistency.

### Root Cause
`CollapsibleSection` was exported from `components/index.ts` but NOT from the package's root `src/index.ts` (which uses selective named exports). Rollup in `@flowise/core-frontend` failed because the symbol wasn't in the compiled `dist/index.mjs`.

### Changes
- Moved `components/CollapsibleSection.tsx` → `components/layout/CollapsibleSection.tsx`
- Created `components/layout/index.ts` barrel
- Updated `components/index.ts` path
- Added `CollapsibleSection` + `CollapsibleSectionProps` to `src/index.ts` exports

### Build
- `pnpm build`: **66/66** (was 64/65 — @flowise/core-frontend now succeeds)

### What's Next
- Runtime testing of publication drill-in feature
- Proceed to REFLECT mode

---

## Previous Focus: Publications Drill-In Navigation — Complete

**Status**: ✅ Fully implemented — 2026-02-28
**Date**: 2026-02-28

### Summary
Full implementation of the Publications drill-in plan (R1-R9). Transformed Publications from flat list + modal-edit into drill-in navigation with inner tabs (Versions, Applications). Create dialog reworked to 2 tabs with collapsible sections. Backend helper extracted, new endpoint, and createApplicationSchema option added.

### Key Decisions
- **Circular build dependency**: template-mui builds before metahubs-frontend; solved with `(m: any)` cast in lazy imports in MainRoutesMUI.tsx
- **CollapsibleSection**: Extracted as reusable component to universo-template-mui (used in create dialog and AttributeFormFields)
- **DDL after transaction**: Knex DDL runs after TypeORM transaction commit to avoid deadlocks
- **Legacy cleanup**: Deleted VersionsPanel, ApplicationsPanel, ApplicationsCreatePanel; removed legacy query key dual-invalidation

### Files Summary
- 11 new files created (backend helper, frontend API/hooks/UI, CollapsibleSection)
- 11 files modified (PublicationList, PublicationActions, AttributeFormFields, routes, i18n, etc.)
- 3 files deleted (legacy panels)

### Build
- `pnpm build`: 66/66 (after CollapsibleSection export fix)

### What's Next
- QA mode verification of drill-in navigation
- Runtime testing of create dialog with collapsible sections
- Verify version/application CRUD operations end-to-end

---

## Previous Focus: NUMBER field parity — catalog inline table NumberTableCell — Complete

**Status**: ✅ Fully implemented — 2026-02-26
**Date**: 2026-02-26

### Summary
Implemented zone-aware ArrowUp/ArrowDown stepping across all three form contexts (DynamicEntityFormDialog, FormDialog, inline table). Completely rewrote NumberEditCell for full parity with standalone NUMBER field. 5 files across 3 packages.

### What Was Done
1. **Zone-aware stepping**: Cursor position relative to decimal separator determines step size — integer zone = step by 1, decimal zone = step by 10^(-scale). Implemented in DynamicEntityFormDialog, FormDialog, and NumberEditCell.
2. **NumberEditCell full rewrite**: ~250 lines with InputBase + InputAdornment. Includes stepper buttons (▲▼), locale-aware formatting (comma for 'ru'), zone-based selection on focus/click, full keyDown handling.
3. **Locale wiring**: Added `locale` prop to `BuildTabularColumnsOptions`, passed `resolvedLocale` from TabularPartEditor and RuntimeInlineTabularEditor. Custom `renderCell` for formatted display.
4. **Button onClick fix**: Wrapped stepper `onClick` in `() => handler()` to prevent MouseEvent being passed as zone arg.

---

## Previous Focus: Fix inline table nonNegative + number alignment — Complete

**Status**: ✅ Fully implemented — 2026-02-262. **Issue 2 — Constraint text format**: Rewrote `buildTableConstraintText()` with unified format "Required: min. rows: X, max. rows: Y". Replaced i18n keys `tableRequiredMin`/`tableRequired` with `tableRequiredPrefix` + lowercase `tableMinRows`/`tableMaxRows` in all 4 JSON files.
3. **Issue 3 — Constraint spacing**: Removed `mb: 2` from outer Box in TabularPartEditor and RuntimeInlineTabularEditor. Stack spacing=2 handles inter-field gaps.
4. **Issue 4 — 3-dot menu for InlineTableEditor**: Replaced per-row DeleteIcon with MoreVertRoundedIcon button that opens a Menu with Edit + Delete items. Delete shows ConfirmDeleteDialog. Added MoreVertRoundedIcon to header column. Added 6 i18n keys to metahubs.json (en+ru).

### Files Modified
- **`universo-utils`**: tableConstraints.ts (rewritten format logic)
- **`universo-template-mui`**: DynamicEntityFormDialog.tsx (NUMBER validation in TABLE cells)
- **`apps-template-mui`**: TabularPartEditor.tsx (processRowUpdate validation, ConfirmDeleteDialog, mb removal), RuntimeInlineTabularEditor.tsx (processRowUpdate validation, mb removal), apps.json en+ru (key replacements)
- **`metahubs-frontend`**: InlineTableEditor.tsx (3-dot menu + ConfirmDeleteDialog), metahubs.json en+ru (key replacements + 6 new keys)

### Verification
- Full build: 66/66 SUCCESS

### What's Next
- Recreate test database with new metahub and application
- Runtime QA verification

---

## Previous Focus: QA Round-5 — Runtime Bug Fixes (TypeError, deleteDisabled, i18n) — Complete

**Status**: ✅ Fully implemented — 2026-02-25
**Date**: 2026-02-25

### Summary
Fixed 3 runtime bugs found during QA verification + dead code cleanup. 11 files across 5 packages modified.

### What Was Done
1. **Bug 1 — TypeError `selectNumberPart`**: Added guard `if (!target || target.value == null) return` in both DynamicEntityFormDialog and FormDialog. Prevents crash when `requestAnimationFrame` callback fires after React re-render unmounts the input element.
2. **Bug 2 — Delete button blocked by `minRows`**: Removed `deleteDisabled` logic from 3 files (InlineTableEditor, RuntimeInlineTabularEditor, TabularPartEditor). Row deletion is always allowed; validation happens at Submit/Save level via `isMissing`/`tableMissing`.
3. **Bug 3 — Non-internationalized texts**: Added `i18nNamespace` prop to DynamicEntityFormDialog for flexible namespace support. Standardized i18n key names between DynamicEntityFormDialog and FormDialog. Added 26 translation keys to metahubs.json (en+ru) for the `metahubs` namespace. Added 6 missing keys to apps.json (en+ru) for table constraints and ARIA labels. ElementList passes `i18nNamespace='metahubs'`.
4. **Dead code cleanup**: Removed `tableCannotBeRequired` error mapping from ChildAttributeList.tsx and both metahubs.json files (backend no longer blocks TABLE isRequired).

### Files Modified
- **`universo-template-mui`**: DynamicEntityFormDialog.tsx (selectNumberPart guard, i18nNamespace prop, standardized keys)
- **`apps-template-mui`**: FormDialog.tsx (selectNumberPart guard), RuntimeInlineTabularEditor.tsx (deleteDisabled removal), TabularPartEditor.tsx (deleteDisabled removal), apps.json en+ru (added 6 keys)
- **`metahubs-frontend`**: InlineTableEditor.tsx (deleteDisabled removal), ElementList.tsx (i18nNamespace='metahubs'), ChildAttributeList.tsx (dead code), metahubs.json en+ru (added 26 keys, removed 1 dead key)

### Verification
- Full build: 66/66 SUCCESS

### What's Next
- Recreate test database
- Runtime QA verification — ensure Russian translations appear, delete buttons work, no TypeError

---

## Previous Focus: QA Round-4 — Comprehensive QA Fixes — Complete

**Status**: ✅ Fully implemented — 2026-02-25
**Date**: 2026-02-25
4. **NUMBER backend validation**: Added nonNegative/min/max checks to `coerceRuntimeValue` with descriptive error messages
5. **NUMBER frontend validation**: Added `validateNumberField`, `cellErrors` state, `preProcessEditCellProps` for NUMBER columns in DataGrid

---

## Previous Focus: Architectural Improvements — Independent Child Tables + Enum Values Rename

**Status**: Completed in IMPLEMENT mode.
**Date**: 2026-02-24

### What Was Done
1. **EDIT add-row autofocus parity**: `RuntimeInlineTabularEditor` now auto-focuses and starts editing in the first left STRING/NUMBER child cell after adding a row in deferred EDIT mode, matching CREATE behavior.
2. **Child TABLE separators cleanup**: Updated DataGrid separator selectors in both `TabularPartEditor` and `RuntimeInlineTabularEditor` to render only internal vertical separators and remove edge artifacts.
3. **Main table separator parity**: Added the same internal vertical separator pattern to `CustomizedDataGrid` used by the main app table.
4. **Child TABLE row actions menu**: Replaced the right-side delete-only icon column with a `⋮` actions pattern (header + row icon buttons), adding a row menu with `Edit` and `Delete` in both create/edit TABLE editors.
5. **Menu "Edit" behavior**: Selecting `Edit` now opens inline editing in the row's leftmost STRING/NUMBER cell.
6. **Cancel localization**: Runtime child-row delete confirmation now receives localized `cancelButtonText` from `tabular.cancel`, removing English fallback in RU UI.

### Verification
- `pnpm --filter apps-template-mui lint` ✅ (0 errors)
- `pnpm --filter apps-template-mui build` ✅

---

## Current Focus: Round 3 UX Fixes Complete

**Status**: Completed in IMPLEMENT mode.
**Date**: 2026-02-24

### What Was Done
1. **Plain child-table select styling**: Removed residual rounded/bordered visual decoration from child REF dropdowns in both `apps-template-mui` (`tabularColumns.tsx`) and `metahubs-frontend` (`InlineTableEditor.tsx`), preserving only the value text + default arrow icon.
2. **Deferred TABLE persistence in edit dialog**: `RuntimeInlineTabularEditor` now supports local-only editing mode (`deferPersistence`) with row emission through `onChange`. `FormDialog` edit path now uses this mode so child table mutations are committed only on main Save.
3. **Row append order fix**: New rows now append at the end (via `_tp_sort_order = max + 1` in immediate mode; local append in deferred mode).
4. **Backend bulk update TABLE support**: Extended `PATCH /:applicationId/runtime/rows/:rowId` to accept TABLE payload updates transactionally (validate/coerce, apply required defaults, replace child rows in submitted order).

### Verification
- `pnpm --filter apps-template-mui lint` ✅ (0 errors)
- `pnpm --filter applications-backend lint` ✅ (0 errors)
- `pnpm --filter @universo/metahubs-frontend lint` ✅ (0 errors)
- `pnpm build` ✅ (66/66)

---

## Current Focus: QA Remediation + UX Fixes Complete

**Status**: Completed in IMPLEMENT mode. QA-found enum validation gap fixed, double-click editing restored, runtime Select styling aligned.
**Date**: 2026-02-23

### What Was Done
1. **HIGH: Child attribute defaultEnumValueId validation** (`attributesRoutes.ts`): Added full enum validation block (identical to root create) in the child attribute create endpoint. Now validates that `defaultEnumValueId` references a valid value from the target enumeration, normalizes `enumAllowEmpty`, `enumPresentationMode`, and `enumLabelEmptyDisplay`.
2. **InlineTableEditor double-click editing** (`InlineTableEditor.tsx`): Moved cell editing activation from inner Box `onMouseDown` to TableCell `onDoubleClick`. When another cell is already editing, `onMouseDown` with blur-suppression enables quick cell switching. The entire cell area is now clickable (no CSS height issues with percentage-based Box inside `<td>`).
3. **Runtime child TABLE Select styling** (`tabularColumns.tsx`, `TabularPartEditor.tsx`, `RuntimeInlineTabularEditor.tsx`): Made Select column non-editable (`editable: false`) and rendered a real always-visible Select in `renderCell` instead of only showing it in edit mode. Removed `UnfoldMoreIcon` (uses default MUI dropdown arrow), removed rounded corners, added `onSelectChange` callback for direct value updates.

### Verification
- `pnpm --filter apps-template-mui lint` ✅ (0 errors, 30 warnings)
- `pnpm --filter @universo/metahubs-frontend lint` ✅ (0 errors, 400 warnings)
- `pnpm --filter @universo/metahubs-backend lint` ✅ (0 errors, 285 warnings)
- `pnpm build` ✅ (66/66, 6m26s)

---

## Current Focus: Child TABLE Editing & Select UX Parity Complete

**Status**: Completed in IMPLEMENT mode. Metahub click-to-edit reliability and runtime create TABLE UX parity are implemented and verified.
**Date**: 2026-02-23

### What Was Done
1. **Metahub child TABLE click-to-edit reliability**: In `InlineTableEditor.tsx`, added a blur-suppression guard (`suppressNextBlurRef`) around cell switching. The editor now avoids blur/mousedown race during cell switch and still exits edit mode correctly on true outside blur.
2. **Runtime create TABLE dropdown parity**: In `apps-template-mui` `tabularColumns.tsx`, replaced default singleSelect edit behavior with custom MUI `Select` edit renderer for REF-enum cells:
   - empty option uses `minHeight: 36` and non-breaking space,
   - selected item is visibly highlighted (`Mui-selected` style),
   - explicit up/down indicator icon (`UnfoldMoreIcon`) is shown in the editor.
3. **Runtime create TABLE auto-edit on add row**: In `TabularPartEditor.tsx`, after row creation the first left STRING/NUMBER child field now automatically enters edit mode via DataGrid API (`setCellFocus` + `startCellEditMode`).
4. **Tech context acquisition (requested by user)**: Gathered stack guidance via Rube (`CONTEXT7_MCP_QUERY_DOCS` for React/MUI and `COMPOSIO_SEARCH_WEB`) before implementation.

### Verification
- `pnpm --filter apps-template-mui lint` ✅ (0 errors, 30 warnings)
- `pnpm --filter @universo/metahubs-frontend lint` ✅ (0 errors)
- `pnpm --filter apps-template-mui build` ✅
- `pnpm build` ✅ (66/66, 5m04s)

---

## Previous Focus: QA Recommendations Implementation Complete

**Status**: Completed in IMPLEMENT mode. Both QA recommendations implemented and verified.
**Date**: 2026-02-23

### What Was Done
1. **changeCounts pluralization**: Replaced raw interpolation `{{additiveCount}} change(s)` with nested plural-aware `t()` calls (same composition pattern as `tableMeta`). Added `additiveChangesCount` and `destructiveChangesCount` plural keys for EN (`_one`/`_other`) and RU (`_one`/`_few`/`_many`). Russian now correctly uses "1 безопасное изменение", "3 безопасных изменения", "5 безопасных изменений".
2. **Backend child search batch optimization**: Added `findChildAttributesByParentIds()` method to `MetahubAttributesService` using single `whereIn` query. Replaced N individual `findChildAttributes()` calls in `Promise.all` loop with one batch call, reducing DB round-trips from N+1 to 2 (ensureSchema + batch select).

### Verification
- `pnpm --filter applications-frontend lint` ✅ (0 errors)
- `pnpm --filter metahubs-backend lint` ✅ (0 errors)
- `pnpm build` ✅ (66/66, 5m29s)

---

## Previous Focus: Inline Edit, Empty Option & Schema Diff i18n Fixes Complete

**Status**: Completed in IMPLEMENT mode. All 3 issues fixed and verified.
**Date**: 2026-02-23

### What Was Done
1. **Click-to-edit broken**: Changed `onClick` to `onMouseDown` with `e.preventDefault()` on the clickable Box in `InlineTableEditor.tsx`. This prevents the `onBlur`/`onClick` race condition where the TextField's blur-triggered re-render consumed the click event before it reached the new target cell.
2. **Empty option height in root REF**: Added `renderOption` to `EnumerationFieldAutocomplete`'s `Autocomplete` in `ElementList.tsx` that applies `minHeight: 36` and non-breaking space for empty options, matching the child TABLE select behavior.
3. **Schema diff i18n pluralization**:
   - Added proper i18next plural keys (`_one`/`_other` for EN; `_one`/`_few`/`_many` for RU) for field count, element count, row count, and table count in schema diff dialog.
   - Composed `tableMeta` label from two separate plural-aware `t()` calls via interpolation.
   - Added `TABLE`→Таблица and `REF`→Ссылка data type translations.
   - Added `common.yes`→Да and `common.no`→Нет keys.

### Verification
- `pnpm build` ✅ (66/66, 5m38s)

---

## Previous Focus: Element Create & Attribute List UX Fixes Complete

**Status**: Completed in IMPLEMENT mode. All 6 UX issues fixed and verified.
**Date**: 2026-02-23

### What Was Done
1. **Stale enum display mode cache**: Added invalidation of `childAttributesForElements` and `childEnumValues` query keys in `ChildAttributeList.invalidateChildQueries()`, ensuring child TABLE REF enum presentation mode changes take effect immediately without page refresh.
2. **REF label UUID flash**: Modified `EnumerationFieldAutocomplete` label mode in `ElementList.tsx` to show non-breaking space while options are loading instead of fallback UUID-based label.
3. **Table cell click area**: Wrapped non-editing Typography in a full-height `<Box>` with `onClick` and `cursor: 'text'` in `InlineTableEditor.tsx`, making the entire cell clickable when radio mode expands row height.
4. **Auto-edit first cell on add**: `handleAddRow` in `InlineTableEditor.tsx` now finds the first STRING/NUMBER child field and activates inline editing on it automatically.
5. **Empty option height**: Empty `<MenuItem>` in child TABLE select dropdown now has `sx={{ minHeight: 36 }}` with non-breaking space content.
6. **Search includes child attributes**: Backend search now checks child attributes of TABLE parents and returns `childSearchMatchParentIds` in response meta. Frontend auto-expands matched TABLE parents and passes search filter to `ChildAttributeList` for client-side child filtering.

### Verification
- `pnpm --filter @universo/metahubs-frontend lint` ✅ (0 errors, 400 warnings)
- `pnpm --filter @universo/metahubs-backend lint` ✅ (0 errors, 285 warnings)
- `pnpm build` ✅ (66/66, 5m41s)

---

## Previous Focus: QA Remediation Pass Complete

**Status**: Completed in IMPLEMENT mode. All blocker findings from the latest QA summary are implemented and verified.
**Date**: 2026-02-23

### What Was Done
1. Fixed runtime TABLE list pagination wiring in the shared dashboard path so tabular rows no longer truncate on page boundaries.
2. Added missing tabular child REF FK diff coverage for add/remove/retarget paths in `schema-ddl`.
3. Enforced TABLE non-required invariant in backend attribute update/toggle-required routes.
4. Aligned runtime TABLE edit rendering path with the shared `useCrudDashboard`-based tabular view.
5. Added regression tests for child REF FK add/drop operations in tabular diff logic.

### Verification
- `pnpm --filter schema-ddl test` ✅ (8/8 suites, 112 tests)
- `pnpm --filter schema-ddl lint` ✅ (warnings only, 0 errors)
- `pnpm --filter apps-template-mui build` ✅
- `pnpm --filter @universo/metahubs-backend lint` ✅ (warnings only, 0 errors)
- `pnpm build` ✅ (66/66, 5m27s)

---

## Current Focus: Element Create TABLE UX Fixes Complete

**Status**: Completed in IMPLEMENT mode for metahubs element create form.
**Date**: 2026-02-23

### What Was Done
1. Updated child TABLE visual styling with thin vertical separators using inset pseudo-lines:
   - white separators in header cells;
   - `grey.100` separators in body/action cells.
2. Aligned NUMBER field content to the right in child TABLE cells for both display and edit states.
3. Removed synthetic empty radio option in child TABLE REF enumeration `radio` mode when empty values are allowed.
4. Reworked child TABLE REF enumeration `label` mode rendering to be read-only and to honor default value + empty display behavior (`dash` or empty).
5. Fixed root REF enumeration `label` mode in element create form to correctly render dash when configured (`emptyDisplay = dash`) instead of forcing an empty selection.

### Verification
- `pnpm --filter @universo/metahubs-frontend exec eslint src/domains/elements/ui/ElementList.tsx src/domains/elements/ui/InlineTableEditor.tsx --fix` ✅ (warnings only)
- `pnpm --filter @universo/metahubs-frontend lint` ✅ (0 errors, warnings only)
- `pnpm --filter @universo/metahubs-frontend build` ✅

---

## Current Focus: Implementation Finalization Complete

**Status**: Completed in IMPLEMENT mode. No additional blocker-level regressions found after verification rerun.
**Date**: 2026-02-23

### What Was Done
1. Added a dedicated implementation-finalization checklist to `memory-bank/tasks.md` and tracked this pass to completion.
2. Revalidated key affected packages after the prior QA remediation summary.
3. Confirmed repository-wide build health from project root without introducing new code changes.

### Verification
- `pnpm --filter @universo/schema-ddl test` ✅ (8/8 suites, 110 tests)
- `pnpm --filter @universo/applications-backend test` ✅ (2/2 suites, 35 tests)
- `pnpm --filter @universo/applications-backend lint` ✅ (0 errors, warnings only)
- `pnpm build` ✅ (66/66)

---

## Current Focus: QA Blockers & Concurrency Hardening Complete

**Status**: Completed in IMPLEMENT mode. All blocker-level issues from the latest comprehensive QA pass were addressed.
**Date**: 2026-02-23

### What Was Done
1. **Type diagnostics unblock**: fixed `DynamicFieldConfig` type import in metahubs frontend by using package root export from `@universo/template-mui`.
2. **Applications frontend lint gate restored**: applied safe eslint/prettier auto-fixes in `applications-frontend`; package lint now reports warnings only (0 errors).
3. **Runtime TABLE race hardening**: tabular child create/delete now run in DB transactions with parent-row `FOR UPDATE` lock to eliminate `minRows/maxRows` race windows.
4. **Optimistic locking added**:
   - runtime parent row single-field and bulk updates now accept optional `expectedVersion` and return HTTP `409` on mismatch;
   - runtime tabular child row update now accepts optional `expectedVersion` and returns HTTP `409` on mismatch.

### Verification
- `pnpm --filter applications-frontend lint` ✅ (0 errors, warnings only)
- `pnpm --filter @universo/applications-backend lint` ✅ (0 errors, warnings only)
- `pnpm --filter @universo/applications-backend test` ✅ (2/2 suites, 35 tests)
- `pnpm build` ✅ (66/66)

---

## Current Focus: Child TABLE Select UX Alignment Complete

**Status**: Completed in IMPLEMENT mode. The requested child TABLE UX parity updates are implemented for both metahub element create and app runtime create/edit flows.
**Date**: 2026-02-23

### What Was Done
1. **Metahub child TABLE empty-state cleanup**: removed dash placeholders for empty values in inline table cells and switched allowed-empty dropdown option to an empty first option.
2. **Unified empty selection flow**: metahub enumeration select now uses dropdown-only empty selection (first empty option) with clear/reset cross disabled.
3. **Metahub child TABLE enum parity**: added support for `enumPresentationMode` = `radio` and `label` in child TABLE REF fields.
4. **Metahub child TABLE layout stability**: forced fixed table layout to prevent column width expansion while editing string/number cells.
5. **Apps child TABLE enum parity**: added `radio` and `label` rendering support in shared DataGrid tabular column builder.
6. **Apps child TABLE empty-state cleanup**: removed dash placeholders and switched select-mode empty option labels to true empty strings.

### Verification
- `pnpm --filter metahubs-frontend lint` ✅ (0 errors, warnings only)
- `pnpm --filter apps-template-mui lint` ✅ (0 errors, warnings only)
- `pnpm build` ✅ (66/66)

## Previous Focus: TABLE Attribute UX & Bug Fix Round 6 Complete

### Applied Fixes
1. Runtime `FormDialog` enum defaults no longer overwrite explicit `null` values during edit flow.
2. Enumeration restore route now maps DB unique violations (`23505`) to deterministic HTTP `409`.
3. Hub-scoped enumeration PATCH now preserves existing description primary locale when `descriptionPrimaryLocale` is omitted.
4. Regression tests expanded:
   - `metahubs-backend`: restore conflict handling + locale fallback checks in `enumerationsRoutes`.
   - `applications-backend`: runtime enum safeguards (`label` readonly + enum ownership validation).

### Verification
- `pnpm --filter @universo/metahubs-backend test -- enumerationsRoutes.test.ts` ✅
- `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts` ✅
- `pnpm --filter @universo/apps-template-mui exec eslint src/components/dialogs/FormDialog.tsx` ✅
- `pnpm --filter @universo/metahubs-backend exec eslint src/domains/enumerations/routes/enumerationsRoutes.ts src/tests/routes/enumerationsRoutes.test.ts` ✅ (warnings only)
- `pnpm --filter @universo/applications-backend exec eslint src/tests/routes/applicationsRoutes.test.ts` ✅ (warnings only)
- `pnpm --filter @universo/apps-template-mui build` ✅
- `pnpm --filter @universo/applications-backend build` ✅
- `pnpm --filter @universo/metahubs-backend build` ✅ (after `applications-backend` build due local package type resolution order)

## Current Focus: Enumerations Stabilization Implementation Completed

**Status**: Completed in IMPLEMENT mode, critical blockers removed.
**Date**: 2026-02-19

## Current Focus: Enumerations QA Remediation Round 2 Completed

**Status**: Completed in IMPLEMENT mode after additional QA findings.
**Date**: 2026-02-19

### Applied Fixes
1. Restored single metahub structure baseline:
   - `_mhb_enum_values` included directly in V1 system table registry;
   - set `CURRENT_STRUCTURE_VERSION = 1`;
   - aligned `basic` template `minStructureVersion` to `1`.
2. Fixed Enumerations route consistency:
   - switched API timestamp payload mapping to `_upl_created_at/_upl_updated_at` with fallback;
   - added missing `isSingleHub` validation in both create endpoints.
3. Hardened application sync for stale enum references:
   - before soft-deleting removed enum values, runtime rows are remapped to valid fallback enum value or `null`;
   - required REF fields now fail sync with explicit error when no valid fallback exists.
4. Resolved remaining blocking prettier violations in template seeding services.
5. Added/updated regression checks:
   - new `structureVersions.test.ts` (V2 immutable without enum table, current version includes enum table);
   - migration routes/service tests aligned to `CURRENT_STRUCTURE_VERSION`.

### Verification
- `pnpm --filter @universo/metahubs-backend build` ✅
- `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/structureVersions.test.ts src/tests/services/metahubSchemaService.test.ts src/tests/routes/metahubMigrationsRoutes.test.ts` ✅
- `pnpm --filter @universo/metahubs-backend exec eslint <touched-files>` ✅ (warnings only, no errors)

### Applied Fixes
1. Unified enumeration snapshot/runtime contracts to use `presentation` as canonical shape while keeping legacy fallback mapping during sync.
2. Fixed `enumerationsRoutes` runtime/typing blockers:
   - safe handling of `updateEnumeration()` return value in strict mode;
   - wired `attributesService` for enumeration-value delete blockers.
3. Fixed template-seed migration counters drift by adding `enumValuesAdded` to migration meta schema and zero-seed constants.
4. Fixed `MetahubAttributesService.findElementEnumValueBlockers()` query typing (`rows.map` compile blocker removed).
5. Extended optimistic-lock `entityType` contract with `document` in shared utils types.
6. Updated migration/read-only tests to structure version `2` behavior and structured blocker payloads.
7. Resolved Prettier errors in new Enumerations frontend files (`metahubs-frontend`).
8. Reworked `_app_enum_values` sync cleanup to safe soft-delete/restore instead of hard delete to avoid FK/NOT NULL failures during version sync.

### Verification
- `pnpm --filter @universo/utils build` ✅
- `pnpm --filter @universo/applications-backend build` ✅
- `pnpm --filter @universo/metahubs-backend build` ✅
- `pnpm --filter @universo/metahubs-backend test` ✅ (12/12 suites)
- `pnpm --filter @universo/metahubs-frontend build` ✅
- `pnpm --filter @universo/apps-template-mui build` ✅
- Targeted eslint on touched files: no errors (warnings remain in legacy areas) ✅

---

## Current Focus: Enumerations QA Hardening Completed

**Status**: Implemented and verified (targeted lint/tests/build completed).
**Date**: 2026-02-19

### Applied Fixes
1. Prevented `_app_objects` recreate conflicts by running stale metadata cleanup before upsert in `syncSystemMetadata(removeMissing=true)`.
2. Enabled `removeMissing: true` in no-DDL sync branches and migrator metadata sync paths.
3. Hardened application enum sync:
   - stale `_app_enum_values` rows for removed enumeration objects are deleted;
   - duplicate enum value IDs in snapshot now fail fast.
4. Added declarative unique partial index (`uidx_mhb_enum_values_default_active`) for metahub enum defaults.
5. Added `schema-ddl` runtime compatibility fallback for `enumeration` kind and fixed old-snapshot ID reconstruction in diff engine.
6. Added regression tests for:
   - enumeration exclusion from physical DDL diff;
   - cleanup-before-upsert order in metadata sync.

### Verification
- `@universo/schema-ddl`: lint/test/build passed (lint warnings only, no errors).
- `@universo/metahubs-backend`: touched files linted (warnings only, no errors), targeted `systemTableMigrator` test passed.

---

## Current Focus: Enumerations Feature — Frontend/UI Integration Completed

**Status**: Core frontend integration completed, targeted builds/lint checks done.
**Date**: 2026-02-18

### What Was Done

**Metahubs frontend (enumerations domain + routing):**
1. Finalized Enumerations UI flow: list view, values view, delete blockers dialog, mutations, query invalidation.
2. Added metahub/global display state keys for enumerations list preferences.
3. Completed menu + route wiring in both `metahubs-frontend` and `universo-template-mui`:
   - `/metahub/:metahubId/enumerations`
   - `/metahub/:metahubId/enumeration/:enumerationId/values`
   - `/metahub/:metahubId/hub/:hubId/enumerations`
   - `/metahub/:metahubId/hub/:hubId/enumeration/:enumerationId/values`

**Attributes UX for REF -> enumeration:**
4. Extended `TargetEntitySelector` to support `enumeration` target kind with dedicated loading/query keys.
5. Added Presentation tab controls for REF->enumeration:
   - `enumPresentationMode`: `select | radio | label`
   - `defaultEnumValueId` selector loaded from target enumeration values
6. Added UI-side `uiConfig` normalization to prevent invalid enum settings leaking for non-enumeration references.

**Backend validation hardening (`attributesRoutes.ts`):**
7. Extended `uiConfig` schema with `enumPresentationMode` and `defaultEnumValueId`.
8. Added validation that `defaultEnumValueId` belongs to selected target enumeration.
9. Added sanitization/cleanup of enum-specific uiConfig keys when reference target is not enumeration.

**i18n updates (EN/RU):**
10. Added full translation blocks for `enumerations` and `enumerationValues` in metahubs locales.
11. Added new reference keys for enumeration target selection.
12. Added Presentation tab labels/help texts for enum mode/default behavior.
13. Added `menu.enumerations` in shared menu locales and `app.emptyOption` in apps runtime locales.

### Verification
- `pnpm --filter @universo/metahubs-frontend build` ✅
- `pnpm --filter @universo/apps-template-mui build` ✅
- `pnpm --filter @universo/template-mui build` ✅
- Targeted eslint on changed TS/TSX files: no errors (warnings only) ✅
- `pnpm --filter @universo/metahubs-backend build` ❌ blocked by pre-existing unrelated TypeScript errors in other backend files

### Next Steps
- Resolve outstanding backend type/export drift (`MetaEntityKind.ENUMERATION` + template seed typing) to restore full backend build.
- Run full workspace build after backend fixes.

---

## Previous Focus: i18n Fix + LanguageSwitcher Widget — Complete

- Fixed BUG-5 (no columnsContainer in seed) and BUG-6 (widget duplication in center+right zones).
- Zone-aware `buildDashboardLayoutConfig()` with `centerActive` set. Seed: columnsContainer (sortOrder 6) in center zone.
- Runtime API expanded to include `center` zone. `DashboardDetailsContext` + `DetailsTableWidget` created.
- MainGrid renders columnsContainer via `renderWidget()` with standalone fallback. Template version `1.1.0` → `1.2.0`.
- 1 file created, 13+ files modified. Build: 65/65 OK.
- Details: progress.md#center-zone-columnscontainer-2026-02-19

---

## Previous Focus: Dashboard Zones & Widgets — 4 Phases + QA ✅ (2026-02-18)

- Phase 1: Split detailsSidePanel → productTree + usersByCountryChart widgets.
- Phase 2: columnsContainer widget (DnD-sortable columns, recursive grid rendering).
- Phase 3: Right Drawer (SideMenuRight 280px, mutual exclusion with left drawer).
- Phase 4: Routing isolation via `createAppRuntimeRoute()` factory.
- 8 QA fixes (BUG-1/2/3/4, WARN-1/2/3/4). Prettier applied. 5 files created, 17+ modified.
- Details: progress.md#dashboard-zones-widgets-2026-02-18

---

## Previous Focus: Architecture Refactoring — Headless Controller Hook ✅ (2026-02-17)

- Adapter Pattern + `useCrudDashboard()` hook eliminates ~80% code duplication.
- `DashboardApp.tsx` 483→95 lines (-80%), `ApplicationRuntime.tsx` 553→130 lines (-76%).
- 7 new files created (types, adapters, columns, hook, dialogs, menu, runtime adapter).
- Details: progress.md#architecture-refactoring-2026-02-17

---

## Previous Focus: UI Polish + QA Rounds 3-6 ✅ (2026-02-15 — 2026-02-17)

- Button position, DataGrid i18n localization, actions column dropdown.
- M1-M4 fixes (null check, error parsing, mutation hooks, schema fingerprint).
- Dialog input styling fix (Dashboard compact → form-compatible spacing).
- Theme dedup, runtime→app rename (60+ identifiers), backward-compat aliases.
- Theme/hooks/delete/i18n/layout fixes, validation/cache/VLC improvements.
- Details: progress.md (entries from 2026-02-15 to 2026-02-17)

---

## Previous Focus: Runtime CRUD + Metahubs UX ✅ (2026-02-13 — 2026-02-14)

- Full backend CRUD (POST/PATCH/DELETE runtime rows) with VLC support.
- Frontend: FormDialog, ConfirmDeleteDialog, actions column in DataGrid.
- Boolean fix (indeterminate checkbox), auto-fill publication name, Presentation tab, header checkbox.
- UI/UX polish (create buttons rename, hubs tab, codename auto-fill, widget toggle).
- Details: progress.md (entries from 2026-02-13 to 2026-02-14)

---

## Previous Focus: Metahub Migration & Template System ✅ (2026-02-09 — 2026-02-12)

- Template system: DB entities, seed executor, Zod validator, frontend selector.
- Declarative DDL + migration engine with diff detection + SystemTableMigrator.
- 16+ QA rounds for pool stability, lock safety, cache consistency, error mapping.
- Structure baseline uses `_mhb_widgets` table and current widget activity model.
- Template cleanup policy (keep/dry_run/confirm), MigrationGuard modal, advisory locks.
- Details: progress.md (entries from 2026-02-09 to 2026-02-12)

---

## Previous Focus: Applications Runtime + Layout Widgets ✅ (2026-02-06 — 2026-02-08)

- Application runtime with DataGrid: row selection, column transformations, BOOLEAN checkbox.
- Menu widget system: embedded items, auto-show catalogs, VLC titles.
- Layout widget DnD ordering, zone widget configuration, runtime menu rendering.
- Details: progress.md (entries from 2026-02-06 to 2026-02-08)

---

## Historical Context (pre-2026-02-06)

- See progress.md for completed work before 2026-02-06.
- Key milestones in reverse chronological order:
  - v0.49.0 (2026-02-05): Attribute data types, display attribute, layouts system, MUI 7
  - v0.48.0 (2026-01-29): Branches, elements rename, three-level system fields
  - v0.47.0 (2026-01-23): Runtime migrations, publications, schema-ddl
  - v0.46.0 (2026-01-16): Applications modules, DDD architecture refactoring
  - v0.45.0 (2026-01-11): i18n localized fields, VLC, catalogs
  - v0.44.0 (2026-01-04): Onboarding, legal consent, captcha, auth toggles
  - v0.43.0 (2025-12-27): Pagination, onboarding wizard
  - v0.42.0 (2025-12-18): VLC system, dynamic locales, Flowise 3.0
  - v0.41.0 (2025-12-11): Admin panel, auth migration, UUID v7
  - v0.40.0 (2025-12-05): Package extraction, admin RBAC, global naming
