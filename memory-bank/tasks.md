# Tasks

> **Note**: Active and planned tasks. Completed work -> progress.md, architectural patterns -> systemPatterns.md.

## Completed: UX Fixes Round 5 — Separator Edges + Tabular Refresh — 2026-02-24 ✅

> **Goal**: Remove remaining edge separator artifacts and ensure child TABLE rows are fresh immediately after Save + reopen, without full page reload.

### Implementation checklist
- [x] Refine main app table separators to render only between real columns (no left/right edge artifacts)
- [x] Invalidate/refetch child TABLE query cache after parent row Save in EDIT flow
- [x] Verify `apps-template-mui` lint + build
- [x] Update memory-bank context (`activeContext.md`, `progress.md`) and mark round complete

## Completed: UX Fixes Round 4 — Tabular Focus, Separators, Row Menu, i18n — 2026-02-24 ✅

> **Goal**: Align child TABLE behavior in EDIT mode with CREATE mode and unify table UI patterns with the main app DataGrid.

### Implementation checklist
- [x] Add auto-focus to first editable child-cell when adding a row in EDIT mode
- [x] Remove extra edge separators in child TABLE (keep only internal vertical separators)
- [x] Add the same internal vertical separators to main app table
- [x] Replace child TABLE delete icon column with `⋮` actions menu (`Edit` / `Delete`)
- [x] On `Edit` action, start editing the leftmost STRING/NUMBER cell in the row
- [x] Localize delete dialog cancel button (`Cancel` -> translated value)
- [x] Run lint/build verification for touched package(s)

## Completed: UX Fixes Round 3 — Select Plain Style + Deferred Tabular Save — 2026-02-24 ✅

> **Goal**: Make child-table select look like plain text with only arrow icon, and ensure adding rows in EDIT mode appends to end without immediate DB persistence.

### Fixes checklist
- [x] Remove residual visual decoration from child-table REF select (no rounded corners/background/border)
- [x] Switch TABLE editing in FormDialog EDIT mode to deferred persistence (commit only on Save)
- [x] Ensure newly added child row appears at end of list
- [x] Extend backend runtime bulk update to accept TABLE payload updates on Save
- [x] Lint/build verification
- [x] Update memory-bank progress

## Completed: UX Fixes Round 2 — Overlay Height, Select Styling, NOT NULL Default — 2026-02-24 ✅

> **Goal**: Fix 3 remaining UX issues: DataGrid overlay height still large, select dropdown visually prominent, and DB NOT NULL constraint on empty tabular row creation.

### Fixes checklist
- [x] Override `--DataGrid-overlayHeight` from 300px → 52px in child TABLE DataGrids and main app DataGrid theme
- [x] Remove select dropdown visual decoration in tabularColumns.tsx (disableUnderline, transparent background, no border/radius)
- [x] Insert type-appropriate default values ('' for STRING, 0 for NUMBER) for required NOT NULL columns when creating empty tabular rows
- [x] Lint verification (0 errors)
- [x] Full build verification (66/66)
- [x] Update memory-bank progress

## Completed: UX Fixes — Empty Height, Column Separators, Tabular Required — 2026-02-24 ✅

> **Goal**: Fix 3 UX issues: oversized empty child table, missing column separator borders, and tabular row creation failing on required fields.

### Fixes checklist
- [x] Reduce empty child table height in CREATE mode (108 → 36px, ~3x smaller)
- [x] Reduce empty child table height in EDIT mode (108 → 36px)
- [x] Add column border separators to child TABLE DataGrid (CREATE mode) — white in header, grey.100 in body
- [x] Add column border separators to child TABLE DataGrid (EDIT mode) — white in header, grey.100 in body
- [x] Add column border separators to main app DataGrid (theme customization) — divider in header, grey.100 in body
- [x] Fix "Required field missing" error when adding empty tabular row in EDIT mode — skip required validation on tabular child row creation
- [x] Lint verification (0 errors)
- [x] Full build verification (66/66)
- [x] Update memory-bank progress

## Completed: QA Round-2 Remediation — 2026-02-24 ✅

> **Goal**: Fix remaining issues from second QA analysis: deprecated `autoHeight` prop and JSX header duplication.

### Fixes checklist
- [x] Replace deprecated `autoHeight` in TabularPartEditor.tsx with flex container sizing
- [x] Replace deprecated `autoHeight` in RuntimeInlineTabularEditor.tsx with flex container sizing
- [x] Replace deprecated `autoHeight` in RuntimeTabularPartView.tsx (deprecated file) with flex container sizing
- [x] Deduplicate showTitle/!showTitle JSX header in TabularPartEditor.tsx
- [x] Deduplicate showTitle/!showTitle JSX header in RuntimeInlineTabularEditor.tsx
- [x] Lint verification (0 errors in apps-template-mui)
- [x] Full build verification (66/66)
- [x] Update memory-bank progress

## Completed: QA Findings Code Remediation — 2026-02-24 ✅

> **Goal**: Fix all issues found during comprehensive QA analysis of TABLE inline editing implementation.

### Fixes checklist
- [x] Fix `rows.indexOf(row)` O(n²) in TabularPartEditor.tsx → use direct `String(row.id)`
- [x] Unify `maxHeight` (300→400) in TabularPartEditor to match RuntimeInlineTabularEditor
- [x] Add optimistic cache updates for `handleSelectChange` in RuntimeInlineTabularEditor to prevent UI flicker
- [x] Deprecate `RuntimeTabularPartView` (dead code) — add `@deprecated` JSDoc + exports
- [x] Deprecate `TabularPartAdapter` (only used by deprecated RuntimeTabularPartView) — add `@deprecated` JSDoc + exports
- [x] Lint verification (0 errors in apps-template-mui)
- [x] Full build verification (66/66)
- [x] Update memory-bank progress

## Completed: QA Findings Safe Remediation — 2026-02-23 ✅

> **Goal**: Safely remediate latest QA findings with minimal scoped changes and verification after each fix.

### Session checklist
- [x] Fix `MetahubMembers.coverage.test.tsx` translation mock (`t is not a function`)
- [x] Stabilize `actionsFactories.test.ts` by removing unnecessary module resets that can cause timeouts
- [x] Harden project npm registry config to HTTPS at workspace level
- [x] Run targeted tests/lint for touched package(s)
- [x] Update memory-bank context files and close this remediation pass

## Completed: QA Recommendations Implementation — 2026-02-23 ✅

> **Goal**: Implement 2 non-blocking QA recommendations: changeCounts i18n pluralization and backend child search batch optimization.

### Implementation checklist
- [x] Rec 1: Replace `changeCounts` interpolation with nested plural `t()` calls (EN `_one/_other`, RU `_one/_few/_many`) for additive/destructive counts
- [x] Rec 2: Add `findChildAttributesByParentIds()` batch method to `MetahubAttributesService` and replace N per-parent queries with single `whereIn` query in search route
- [x] Lint verification (0 errors in applications-frontend and metahubs-backend)
- [x] Full build verification (66/66)

## Completed: Child TABLE Editing & Select UX Parity (Metahub + Runtime) — 2026-02-23 ✅

> **Goal**: Restore stable click-to-edit behavior in metahub element create dialog and align runtime child TABLE select/editor behavior with metahub UX.

### Implementation checklist
- [x] Gather stack-specific guidance via Rube (Context7 + web research) for MUI/React blur-click race and select option rendering
- [x] Fix click-to-edit re-entry reliability in metahub child TABLE inline editor after blur/outside click
- [x] Runtime app: make empty option height equal to regular options in child TABLE dropdown
- [x] Runtime app: highlight previously selected dropdown option and show up/down arrow indicator like metahub create flow
- [x] Runtime app: on add row, auto-activate first editable STRING/NUMBER child column
- [x] Run lint/build verification for touched packages and full `pnpm build`

## Completed: Inline Edit, Empty Option & Schema Diff i18n Fixes — 2026-02-23 ✅

> **Goal**: Fix 3 UX issues: broken click-to-edit in child TABLE, empty option height in root REF select, and missing i18n pluralization/localization in schema diff dialog.

### Implementation checklist
- [x] Fix 1: Repair click-to-edit in inline table (onMouseDown + preventDefault to avoid blur/click race)
- [x] Fix 2: Add minHeight and renderOption for empty option in root REF Autocomplete
- [x] Fix 3: Add i18next pluralization for rows/fields/elements/tables counts, localize Yes/No and TABLE/REF data types in schema diff dialog
- [x] Run full build verification (66/66)

## Completed: Element Create & Attribute List UX Fixes — 2026-02-23 ✅

> **Goal**: Fix 6 UX issues related to child TABLE attribute enum display modes, REF label rendering, inline editing ergonomics, and attribute search scope.

### Implementation checklist
- [x] Fix 1: Invalidate child attribute queries when child attr uiConfig changes (stale enum display mode cache)
- [x] Fix 2: Show loading/placeholder in label mode until options are fetched (prevent UUID flash)
- [x] Fix 3: Make full table cell area clickable for editing (not just the text content)
- [x] Fix 4: Auto-focus first editable cell when adding a new table row
- [x] Fix 5: Set minimum height on empty MenuItem in child TABLE select dropdown
- [x] Fix 6: Extend attribute search to include child attributes, show matched parent with filtered children
- [x] Run targeted verification (lint/build) for touched packages

## Completed: QA Remediation Pass — 2026-02-23 ✅

> **Goal**: Safely fix all remaining issues from the latest QA verdict (runtime tabular pagination/data visibility, child REF FK migration integrity, TABLE required-rule bypass, runtime tabular view wiring).

### Implementation checklist
- [x] Fix tabular runtime pagination/data visibility in `apps-template-mui` (no row truncation, controlled paging)
- [x] Add child REF FK diff/migration handling for tabular columns in `schema-ddl`
- [x] Enforce `TABLE` non-required invariant in attribute update/toggle backend routes
- [x] Wire runtime TABLE form path to the shared `useCrudDashboard`-based view
- [x] Run targeted verification (tests/build/lint) for touched packages and confirm green status

## Completed: Element Create TABLE UX Fixes — 2026-02-23 ✅

> **Goal**: Apply requested UX/behavior fixes for child TABLE editing and REF-enumeration presentation consistency in catalog element create dialog.

### Requested fixes
- [x] Add visual vertical separators between child TABLE columns with top/bottom inset (header and body styles)
- [x] Right-align NUMBER values in child TABLE cells (view and edit states)
- [x] Remove empty radio option for child TABLE REF enumeration when `radio` mode + `allowEmpty` are enabled
- [x] Fix child TABLE REF `label` mode rendering to show read-only text with proper empty/default handling
- [x] Fix root REF enumeration `label` mode empty display (`dash` vs empty) in element create form
- [x] Run package verification (`@universo/metahubs-frontend` lint + build)

## Completed: QA Remediation + UX Fixes — 2026-02-23 ✅

> **Goal**: Fix QA-found enum validation gap, restore double-click cell editing in InlineTableEditor, and align runtime child TABLE select styling with metahub design-time.

### Implementation checklist
- [x] Fix HIGH: Add defaultEnumValueId validation to child attribute create route (attributesRoutes.ts)
- [x] Fix double-click cell editing in InlineTableEditor (metahubs design-time)
- [x] Fix runtime child TABLE select styling: remove rounded corners, show dropdown icon always, match standard Select icon
- [x] Run verification (lint/build for touched packages + full pnpm build)

## Completed: Runtime Child TABLE Enum Display Parity — 2026-02-24 ✅

> **Goal**: Align all 3 enum presentation modes (select/radio/label) in runtime child TABLE with metahub design-time InlineTableEditor behavior.

### Implementation checklist
- [x] Select mode: remove underline/border styling, make fully flat like InlineTableEditor
- [x] Radio mode: always-visible radio buttons in renderCell (no DataGrid edit mode), no empty radio option
- [x] Label mode: resolve defaultEnumValueId, show dash for empty with enumLabelEmptyDisplay='dash'
- [x] Add resolveEnumValue() helper for consistent default value resolution
- [x] Run verification (lint 0 errors + full build 66/66)

## Completed: Runtime Child TABLE Cell Alignment & Radio Expansion — 2026-02-24 ✅

> **Goal**: Fix vertical centering of label/dash text, font size consistency, delete button alignment, and radio button clipping in runtime child TABLE DataGrid.

### Implementation checklist
- [x] Fix label mode: use `component='span'` + `fontSize: 'inherit'` for consistent font size and proper flex centering
- [x] Fix radio mode: change `my: -0.25` → `py: 0.5`, use `fontSize: 'inherit'` for label text
- [x] Fix select mode: use `fontSize: 'inherit'` for consistent font size
- [x] Add `getRowHeight={() => 'auto'}` to TabularPartEditor and RuntimeInlineTabularEditor DataGrid for radio button expansion
- [x] Add `'& .MuiDataGrid-cell': { alignItems: 'center' }` to DataGrid sx for vertical centering
- [x] Run verification (lint 0 errors + full build 66/66)

## Completed: Runtime TABLE Inline Editing & Cell Centering — 2026-02-24 ✅

> **Goal**: Fix 3 issues: (1) table height not expanding for single radio row, (2) EDIT mode using dialog instead of inline editing, (3) text vertically misaligned in cells.

### Implementation checklist
- [x] Replace `height: 108` with `minHeight: 108` in TabularPartEditor and RuntimeInlineTabularEditor, allowing auto-expansion for radio rows
- [x] Replace `RuntimeTabularPartView` with `RuntimeInlineTabularEditor` in FormDialog EDIT mode — eliminates separate edit dialog
- [x] Add explicit `display: 'flex', alignItems: 'center', py: '8px', minHeight: 36` to DataGrid cells for proper vertical centering with getRowHeight='auto'
- [x] Run verification (lint 0 errors + full build 66/66)

## Completed: Implementation Finalization — 2026-02-23 ✅

> **Goal**: Confirm current remediation state from the latest QA summary and finish this implement pass with documented verification.

### Session checklist
- [x] Validate current workspace status and memory-bank alignment
- [x] Run focused verification commands for touched areas
- [x] Update memory-bank session records and close this pass

## In Progress: QA Blockers & Concurrency Hardening — 2026-02-23

> **Goal**: Fix all issues from the latest comprehensive QA pass with minimal, safe changes and keep lint/build/test health.

### 1) Blocking quality gates
- [x] Fix TypeScript diagnostics for `@universo/template-mui/components/dialogs` type import in metahubs frontend
- [x] Restore lint pass for `applications-frontend` (error-level issues)

### 2) Runtime data integrity & concurrency
- [x] Eliminate tabular `minRows/maxRows` race windows in runtime child create/delete flows
- [x] Add optimistic-lock checks to runtime row and tabular child update endpoints

### 3) Verification
- [x] Run targeted lint/tests/build for touched packages
- [x] Run full workspace build (`pnpm build`) and ensure green result

## Completed: Child TABLE Select UX Alignment — 2026-02-23 ✅

> **Goal**: Unify empty-value behavior and enum presentation modes for REF fields inside child TABLE rows in both metahub element create flow and app runtime create flow.

### Empty value behavior (no dash placeholders)
- [x] Remove dash placeholders for empty values in child TABLE cells in metahub element create flow
- [x] Remove dash placeholders for empty values in child TABLE cells in app runtime create flow
- [x] Use an empty first option in dropdowns when empty value is allowed (instead of dash text)

### Unified empty selection behavior
- [x] Ensure empty value is selected only via dropdown option (no clear/reset cross behavior)
- [x] Apply the same empty-option behavior for both standalone REF fields and child TABLE REF fields in metahub element create flow

### Stable child TABLE layout/editing
- [x] Prevent child TABLE column width expansion while editing string/number in metahub element create flow

### Enum presentation mode support in child TABLE rows
- [x] Implement REF enum `radio` mode rendering for child TABLE fields in metahub element create flow
- [x] Implement REF enum `radio` mode rendering for child TABLE fields in app runtime create flow
- [x] Implement REF enum `label` mode rendering for child TABLE fields in metahub element create flow
- [x] Implement REF enum `label` mode rendering for child TABLE fields in app runtime create flow

### Verification
- [x] Lint/build affected frontend packages and confirm no error-level issues

## Completed: QA Findings Remediation — 2026-02-23 ✅

> **Goal**: Fix all issues found in the latest QA pass with minimal, safe changes and restore lint health for touched areas.

### Critical backend/runtime fixes
- [x] Fix catalog REF option resolution to exclude TABLE child attributes from parent-table label SQL
- [x] Add enum ownership validation for TABLE child REF values in runtime create/update flows

### Seed migration consistency fixes
- [x] Ensure child attributes are synchronized when TABLE parent attribute already exists in seed migrator/executor
- [x] Preserve child REF target resolution during TABLE child attribute seed insert

### Runtime UI contract fixes
- [x] Preserve full child field metadata (REF/options/validation/uiConfig/attributeId) in tabular adapter/view path

### Lint and verification
- [x] Fix lint errors in touched files (including @universo/template-mui)
- [x] Run targeted package checks and full root build

## Completed: Child TABLE Attribute Parity + Sync FK Fix — 2026-02-23 ✅

> **Goal**: Align child attribute edit behavior with regular attributes, remove escaped dash garbage in enum REF UI, and fix initial app schema sync failure (missing FK column).

### Regression fixes
- [x] Child attribute edit parity: lock data type/settings exactly like regular attribute edit flow
- [x] Child TABLE row REF enum default option: replace escaped `\u2014` garbage with proper empty placeholder behavior
- [x] App schema sync 500: prevent FK creation on parent table for child REF fields and create FK in correct tabular table

### Verification
- [x] Lint affected frontend/backend/ddl packages
- [x] Run full workspace build (`pnpm build`) — 66/66 ✅ (5m6s)

## Completed: Dialog Initialization & Child REF Persistence Fix — 2026-02-23 ✅

> **Goal**: Fix first-open empty form values and child REF target persistence after clean DB reset.

### Regression fixes
- [x] Fix child attribute edit first-open initialization (name/codename empty on first open)
- [x] Fix child REF persistence (targetEntityKind/targetEntityId) in frontend payload assembly
- [x] Fix child REF persistence in backend child-create route
- [x] Fix publication create dialog first-open auto-name initialization

### Verification
- [x] Lint metahubs-frontend and metahubs-backend affected files/packages
- [x] Run full workspace build (`pnpm build`) — 66/66 ✅ (6m10s)

---

## Completed: QA Quality Fix Round 7 — 2026-02-22 ✅

> **Goal**: Fix all critical, architectural, logical, and data integrity issues found in QA analysis of Round 6 implementation.

### Critical fixes (§1)
- [x] §1.1: Fix processRowUpdate swallowing errors in RuntimeInlineTabularEditor — DataGrid must revert on failure
- [x] §1.2: Add delete confirmation dialog (ConfirmDeleteDialog) for API-backed row deletion
- [x] §1.3: Add user-visible error feedback (Alert + optional onError callback) for mutation failures

### Architectural fixes (§2)
- [x] §2.1: Create reusable tabular API helpers in api.ts (fetchTabularRows, createTabularRow, updateTabularRow, deleteTabularRow) with extractErrorMessage + Zod validation
- [x] §2.2: Migrate RuntimeInlineTabularEditor to React Query (useQuery for fetching, queryClient.invalidateQueries for mutations)
- [x] §2.3: Remove obsolete isMounted ref anti-pattern
- [x] §2.4: Remove buildTabularUrl duplication — use buildAppApiUrl from api.ts

### Logical fixes (§3)
- [x] §3.1: Fix REF empty string '' → null conversion in TabularPartEditor processRowUpdate and RuntimeInlineTabularEditor
- [x] §3.2: Unify refetch strategy (always invalidate React Query after all mutations)
- [x] §3.3: Add Zod validation for tabular rows API response (tabularRowsResponseSchema)

### Data integrity fixes (§4)
- [x] §4.2: Add console.warn for silent catch in attributesRoutes.ts setDisplayAttribute

### Code quality recommendations (§6)
- [x] §6.1: Add key prop on DataGrid to reset state on parent/attribute change
- [x] §6.2: Extract shared column builder (buildTabularColumns) from duplicated code
- [x] §6.4: Fix idiomatic negation: `=== false` → `!` in AttributeList.tsx
- [x] §6.5: Sort childEnumTargetIds for stable React Query key in ElementList.tsx
- [x] §6.6: Add console.warn for silent catch in ElementList.tsx childEnumValuesMap query

### Verification
- [x] Build apps-template-mui package — 0 errors
- [x] Full workspace build (`pnpm build`) — 66/66 ✅ (5m5s)
- [x] Lint apps-template-mui: 0 errors, 30 warnings
- [x] Lint metahubs-frontend: 0 errors, 394 warnings

---

## Completed: TABLE Attribute UX & Bug Fix Round 6 — 2026-02-22 ✅

> **Goal**: Fix 6 issues: lint errors, REF in child tables, unified inline editing, independent expand/collapse, auto display attribute, connector sync 500 error.

### 1. Fix QA lint errors (metahubs-frontend)
- [x] ChildAttributeList.tsx: Remove duplicate `hideDisplayAttribute` prop
- [x] InlineTableEditor.tsx: Add `eslint-disable` for `autoFocus` accessibility warning
- [x] Auto-fix prettier formatting errors (21 auto-fixed)

### 2. REF attributes in child tables — enum/catalog as dropdown
- [x] api.ts (apps-template-mui): Add `refTargetEntityId`, `refTargetEntityKind`, `refOptions`, `enumOptions` to childColumns Zod schema
- [x] applicationsRoutes.ts (backend): Include child REF target IDs in enum/catalog option queries; add REF properties to childColumns response
- [x] columns.tsx (apps-template-mui): Map REF properties from childColumns to FieldConfig childFields
- [x] TabularPartEditor.tsx: Add `singleSelect` type with `valueOptions` for REF columns in DataGrid
- [x] InlineTableEditor.tsx: Add MUI Select/MenuItem for REF field rendering in renderCell
- [x] ElementList.tsx (metahubs-frontend): Add REF properties to childFields mapping; load enum values for child REF→enumeration attributes

### 3. Unify inline editing (CREATE and EDIT modes same UX)
- [x] Create RuntimeInlineTabularEditor.tsx: New component with inline DataGrid editing backed by API calls (fetch, create, update, delete)
- [x] FormDialog.tsx: Replace RuntimeTabularPartView with RuntimeInlineTabularEditor in EDIT mode
- [x] index.ts (apps-template-mui): Export new component

### 4. Independent expand/collapse for TABLE attributes in catalog
- [x] AttributeList.tsx: Change `expandedTableId: string | null` to `expandedTableIds: Set<string>` for independent expand/collapse

### 5. Auto-set display attribute for first child attribute
- [x] ChildAttributeList.tsx: Add `isDisplayAttribute` to create payload in handleCreate
- [x] attributesRoutes.ts (backend): Call `setDisplayAttribute` when `isDisplayAttribute: true` is sent during child attribute creation

### 6. Fix connector sync 500 error on layout migration
- [x] applicationSyncRoutes.ts: Clear `is_default` on existing layouts before upserting to avoid unique partial index violation

### Verification
- [x] Full workspace build (`pnpm build`) — 66/66 ✅ (5m6s)
- [x] Lint metahubs-frontend: 0 errors (394 warnings only)
- [x] Build apps-template-mui: clean (0 errors)

---

## Completed: QA Critical/Major Fix Pass — 2026-02-21 ✅

> **Goal**: Fix all critical and important QA findings for TABLE runtime/metadata integrity, with minimal and safe changes.

### A. Data integrity and duplicate consistency (backend)
- [x] Align duplicate codename checks for child attributes with DB uniqueness and active-row semantics
- [x] Remove silent skip of invalid child values in runtime create/update paths (fail loud with 400)

### B. TABLE constraints enforcement (runtime backend)
- [x] Enforce TABLE `minRows`/`maxRows` in parent create and tabular create/delete operations
- [x] Keep lock and soft-delete behavior intact while adding row-count guards

### C. Runtime adapter contract and behavior (apps-template-mui)
- [x] Align `TabularPartAdapter` with `CrudDataAdapter` contract (`fetchList` params, `fetchRow` signature)
- [x] Keep pagination/query-key behavior compatible with `useCrudDashboard`

### D. Lint/quality and verification
- [x] Fix lint issues introduced in touched files (no new lint regressions)
  - Note: Blocking errors in `applicationsRoutes.ts`, `MetahubAttributesService.ts`, `attributesRoutes.ts`, and `apps-template-mui` formatting spots were resolved.
- [x] Run targeted tests/build/lint for affected packages and confirm green/expected status
  - Note: Lint in affected packages now has warnings only (no error-level violations); targeted builds pass; full workspace build `pnpm build` passed (66/66).

## Completed: TABLE Attribute UX Improvements Round 5.4 — 2026-02-21 ✅

> **Context**: 4 follow-up UX issues reported after Round 5.3 QA.
> **Scope**: apps-template-mui, metahubs-frontend

### 1. Restore column menu in child table CREATE mode (apps runtime)
- [x] TabularPartEditor.tsx: enable DataGrid column menu so sort/filter menu is available in CREATE mode

### 2. Match sort button hover style with main table (apps runtime)
- [x] TabularPartEditor.tsx and RuntimeTabularPartView.tsx: make sort/menu hover background dark like main table

### 3. Add row number column in child table (apps runtime)
- [x] TabularPartEditor.tsx: add leading `#` column with row numbers
- [x] RuntimeTabularPartView.tsx: add leading `#` column with row numbers

### 4. Align metahub predefined element TABLE empty state with app dialog
- [x] InlineTableEditor.tsx: show default table frame (header + 2-row empty height)
- [x] InlineTableEditor.tsx: ensure table header uses `grey.100` (not white)

### Verification
- [x] Full workspace build (`pnpm build`) — 66/66 ✅ (5m42s)

---

## Completed: TABLE Attribute UX Improvements Round 5.3 — 2026-02-21 ✅

> **Context**: 5 UX issues reported after Round 5.2 testing.
> **Scope**: apps-template-mui, universo-template-mui

### 1. Fix DataGrid i18n in tabular parts (apps runtime)
- [x] TabularPartEditor.tsx: Add `locale` prop, import `getDataGridLocaleText`, merge full locale into DataGrid `localeText`
- [x] TabularPartEditor.tsx: Add `disableColumnMenu` to disable column context menu in inline editor
- [x] RuntimeTabularPartView.tsx: Add `localeText={state.localeText}` to DataGrid for full i18n
- [x] FormDialog.tsx: Pass `locale` prop to TabularPartEditor

### 2. Fix empty tabular part height (too large empty space)
- [x] TabularPartEditor.tsx: Change `minHeight: 108` to `height: 108` when <2 rows (fixed height for empty/1-row)

### 3. Fix gray Select dropdown background
- [x] FormDialog.tsx: Change `bgcolor: 'background.paper'` to `bgcolor: 'background.default'` on enum/ref Selects (matches TextField MuiOutlinedInput theme)

### 4. Fix dropdown menu item height (too compact)
- [x] FormDialog.tsx: Add `MenuProps={{ PaperProps: { sx: { '& .MuiMenuItem-root': { minHeight: 40 } } } }}` to both Selects

### 5. Fix element editor tabular display
- [x] DynamicEntityFormDialog.tsx: Remove `#` column from TABLE editor (match app visual)
- [x] DynamicEntityFormDialog.tsx: Change `minHeight: 108` to `height: 108` with auto for >1 rows

### Verification
- [x] Full workspace build (`pnpm build`) — 66/66 ✅ (5m16s)

---

## Completed: TABLE Attribute UX Improvements Round 5.2 — 2026-02-21 ✅

> **Context**: 7 UX polish issues reported after tabular data started working.
> **Scope**: apps-template-mui, universo-template-mui, metahubs-frontend

### 1. Narrow FormDialog width (apps runtime)
- [x] FormDialog.tsx: Dialog maxWidth `lg→md` (with TABLE), `md→sm` (without TABLE)

### 2. Fix tabular loading flash (Skeleton)
- [x] RuntimeTabularPartView.tsx: Show Skeleton (height=80) while loading + 0 rows instead of empty DataGrid

### 3. Fix gray Select/dropdown background
- [x] FormDialog.tsx: Add `sx={{ bgcolor: 'background.paper' }}` to both enum and ref `<Select>` components

### 4. Fix empty tabular part in CREATE mode
- [x] TabularPartEditor.tsx: Always render DataGrid (with headers + noRowsLabel), remove conditional text fallback
- [x] TabularPartEditor.tsx: Add `minHeight: 108` when <2 rows (header + 2 data rows), `autoHeight` only when >1 rows

### 5. Fix tabular header color to match main table (grey.100)
- [x] RuntimeTabularPartView.tsx: Add `backgroundColor: 'grey.100'` to `.MuiDataGrid-columnHeader`
- [x] TabularPartEditor.tsx: Same fix

### 6. Fix element editor dialog — size + inline TABLE editor
- [x] DynamicEntityFormDialog.tsx: Dynamic `maxWidth` — `'md'` when TABLE fields present, `'sm'` otherwise
- [x] DynamicEntityFormDialog.tsx: Replace TABLE stub with full inline editor (MUI Table with add/delete/edit)
- [x] DynamicEntityFormDialog.tsx: Added imports (Table, TableHead, TableBody, TableRow, TableCell, IconButton, AddIcon, useRef)

### 7. Fix child table spacing in catalog attribute list
- [x] AttributeList.tsx: Increase bottom padding `pb: 0.5 → pb: 1` in renderRowExpansion wrapper
- [x] ChildAttributeList.tsx: Increase spacing below Create button `mb: 0.5 → mb: 1`

### Verification
- [x] Full workspace build (`pnpm build`) — 66/66 ✅ (7m36s)

---

## Completed: TABLE Attribute UX Improvements Round 5.1 — 2026-02-21 ✅

> **Context**: QA findings from Round 5 + 2 new user-reported issues during runtime testing.
> **Scope**: metahubs-backend, metahubs-frontend, apps-template-mui
> **Note**: No legacy concerns — test DB will be recreated.

### 1. Fix QA findings — seed try/catch + persistSeedWarnings in hash-match branch
- [x] applicationSyncRoutes.ts: Wrap `seedPredefinedElements` in try/catch on hash-match fast path
- [x] applicationSyncRoutes.ts: Add `persistSeedWarnings` call after seed in hash-match branch

### 2. Fix enum values list — oversized three-dot menu button
- [x] EnumerationValueList.tsx: Remove custom `renderTrigger` (use BaseEntityMenu default trigger with 28×28 sizing)
- [x] EnumerationValueList.tsx: Remove unused imports (IconButton, MoreVertRoundedIcon, TriggerProps)

### 3. Fix tabular 400 Bad Request when editing existing records (CRITICAL)
- [x] FormDialog.tsx: Add `attributeId` property to `FieldConfig` interface
- [x] FormDialog.tsx: Use `field.attributeId ?? field.id` for RuntimeTabularPartView
- [x] columns.tsx: Pass `c.id` (UUID) as `attributeId` for TABLE-type columns in `toFieldConfigs`

### Verification
- [x] Full workspace build (`pnpm build`) — 66/66 ✅ (5m34s)

---

## Completed: TABLE Attribute UX Improvements Round 5 — 2026-02-21 ✅

> **Context**: User testing revealed 3 more issues after Round 4 fixes.
> **Scope**: metahubs-frontend, metahubs-backend, universo-template-mui
> **Note**: No legacy concerns — test DB will be recreated.

### 1. Make expand/collapse button same size as three-dot menu
- [x] AttributeList.tsx: Add `width: 28, height: 28, p: 0.5` to expand IconButton (match BaseEntityMenu sizing)

### 2. Fix horizontal dividers when TABLE is expanded
- [x] FlowListTable.tsx: Add explicit `borderBottom: '1px solid'` with `borderColor: 'divider'` to expansion cell
- [x] AttributeList.tsx: Add dashed `borderTop` with side margins between parent row and child table in renderRowExpansion

### 3. Fix predefined elements not seeding (CRITICAL — root cause: child field leakage)
- [x] applicationSyncRoutes.ts: Add `!field.parentAttributeId` filter to `fieldByCodename` map (exclude child TABLE fields from parent INSERT)
- [x] applicationSyncRoutes.ts: Add `!field.parentAttributeId` filter to `missingRequired` check (prevent false skip on child required fields)
- [x] applicationSyncRoutes.ts: Add `seedPredefinedElements` call in hash-match early-return branch (L1466-1500)

### Verification
- [x] Full workspace build (`pnpm build`) — 66/66 ✅ (5m4s)

---

## Completed: TABLE Attribute UX Improvements Round 4 — 2026-02-24 ✅

> **Context**: User testing revealed 8 new issues with TABLE attributes during live testing.
> **Scope**: metahubs-frontend, metahubs-backend, apps-template-mui, universo-template-mui, applications-frontend
> **Note**: No legacy concerns — test DB will be recreated.

### 1. Fix _localId leakage in buildPayload (QA fix)
- [x] DynamicEntityFormDialog.tsx: Strip `_localId` and `__rowId` from TABLE field arrays in buildPayload
- [x] FormDialog.tsx (apps-template-mui): Same fix

### 2. Fix child attribute Presentation tab — display attribute toggle
- [x] ChildAttributeList.tsx: Set `isDisplayAttribute: childAttributes.length === 0` in localizedDefaults
- [x] ChildAttributeList.tsx: Replace `hideDisplayAttribute` with proper display attribute props in PresentationTabFields
- [x] ChildAttributeList.tsx: Add `displayAttributeLocked={childAttributes.length === 0}` for auto-lock behavior

### 3. Move expand button from sortOrder to Actions column
- [x] AttributeList.tsx: Remove expand IconButton from sortOrder column render
- [x] AttributeList.tsx: Add expand IconButton in renderActions (before BaseEntityMenu)
- [x] AttributeList.tsx: Use KeyboardArrowUp/Down icons instead of ExpandLess/More

### 4. Fix horizontal divider between table rows when TABLE expanded
- [x] FlowListTable.tsx: Remove `border: 0` from expansion row cell
- [x] FlowListTable.tsx: Suppress parent row bottom border when expansion content exists

### 5. Fix preset elements not migrating to application (CRITICAL)
- [x] applicationSyncRoutes.ts: Add `seedPredefinedElements` call in `!diff.hasChanges` branch
- [x] applicationSyncRoutes.ts: Add `persistSeedWarnings` after migration recording
- [x] applicationSyncRoutes.ts: Include seed warnings in response

### 6. Add tabular i18n keys + fix dialog width
- [x] en/apps.json: Add `tabular.*` section (14 keys) and `table.*` section
- [x] ru/apps.json: Add Russian translations for all tabular/table keys
- [x] FormDialog.tsx: Change default dialog width from `'sm'` to `'md'`

### 7. Fix TABLE rows not loading when editing existing record
- [x] ApplicationRuntime.tsx: Pass `apiBaseUrl`, `applicationId`, `catalogId` to CrudDialogs
- [x] DashboardApp.tsx: Pass `apiBaseUrl`, `applicationId`, `catalogId` to CrudDialogs

### 8. Fix blocking-references 404 errors on catalog delete
- [x] catalogsRoutes.ts: Return empty result instead of 404 for non-existent catalogs

### Verification
- [x] Build all affected packages
- [x] Full workspace build (`pnpm build`) — 66/66 ✅ (5m49s)

---

## Completed: TABLE Attribute UX Improvements Round 3 — 2026-02-23 ✅

> **Context**: User testing revealed 7 new issues with TABLE attributes during live testing.
> **Scope**: metahubs-frontend, metahubs-backend, schema-ddl, applications-frontend
> **Note**: No legacy concerns — test DB will be recreated.

### 1. Fix child table left padding
- [x] AttributeList.tsx: Changed `pl: 4` to `pl: 1` in renderRowExpansion Box

### 2. Fix move/sort scoping by parent_attribute_id (CRITICAL backend bug)
- [x] MetahubAttributesService.ts: `_ensureSequentialSortOrder` — scoped by `parentAttributeId`
- [x] MetahubAttributesService.ts: `moveAttribute` — fetches attribute, scopes neighbor query by `parent_attribute_id`
- [x] MetahubAttributesService.ts: `getNextSortOrder` — scoped by `parentAttributeId`
- [x] attributesRoutes.ts: Updated 4 callers to pass `parentAttributeId`

### 3. Add sorting to child table columns
- [x] ChildAttributeList.tsx: Added `sortable: true` and `sortAccessor` to #, name, codename columns

### 4. Fix TABLE display in element editor (replace DataGrid with MUI Table)
- [x] InlineTableEditor.tsx: Complete rewrite using MUI Table with click-to-edit cells

### 5. Fix [object Object] in element list
- [x] ElementList.tsx: Added `case 'TABLE':` — shows row count or "—"
- [x] i18n: Added `elements.table.rowCount` key in EN/RU metahubs.json

### 6. Fix migration preview for TABLE data
- [x] ConnectorDiffDialog.tsx: Added `formatPreviewCellValue()` helper for VLC + arrays
- [x] i18n: Added `connectors.diffDialog.tableRowCount` key in EN/RU applications.json

### 7. Fix sync 500 — tabular table names exceed PostgreSQL 63-char limit (CRITICAL)
- [x] naming.ts: Shortened UUID to first 12 chars + `.substring(0, 63)` safety
- [x] SchemaGenerator.ts: Abbreviated index suffixes (`_pi`, `_ps`, `_ad`, `_ud`) + 63-char cap
- [x] Tests updated: naming.test.ts, snapshot.test.ts, diff.test.ts (110/110 ✅)
- [x] Full build: 66/66 ✅

---

## Completed: TABLE Attribute UX Improvements Round 2 — 2026-02-22 ✅

> **Context**: User testing revealed 5 additional UX problems with TABLE attributes after first round of fixes.
> **Scope**: metahubs-frontend, metahubs-backend, universo-template-mui

### 1. Fix parent table numbering
- [x] AttributeList.tsx: Use `(row, index) => index + 1` instead of `row.sortOrder` for # column

### 2. Fix child display attribute
- [x] MetahubAttributesService.ts: Scope `setDisplayAttribute` clearing to siblings (root vs children of same parent)
- [x] attributesRoutes.ts: Remove `parentAttributeId` check that blocks child display attributes
- [x] ChildAttributeList.tsx: Add display attribute toggle, star icon, set/clear-display-attribute menu actions
- [x] MetahubElementsService.ts: Change `findAll` to `findAllFlat` for TABLE validation

### 3. Remove child table border/padding
- [x] AttributeList.tsx: Remove Paper wrapper from renderRowExpansion, reduce margin

### 4. Compact child table rows
- [x] FlowListTable.tsx: Add `compact` prop to reduce row/header heights
- [x] ChildAttributeList.tsx: Pass `compact` to FlowListTable, smaller Create button

### 5. Implement TABLE in element editor
- [x] DynamicEntityFormDialog.tsx: Add `childFields` to DynamicFieldConfig type
- [x] Create InlineTableEditor.tsx component in metahubs-frontend
- [x] ElementList.tsx: Fetch child attributes, include childFields, render InlineTableEditor via renderField

### 6. i18n + Build
- [x] Update EN + RU metahubs.json with new keys
- [x] Full workspace build verification: 66/66 ✅

---

## Completed: TABLE Attribute UX Improvements — 2026-02-21 ✅

> **Context**: User testing revealed 7 UX problems in the TABLE attribute feature. All fixed.
> **Scope**: metahubs-frontend, metahubs-backend, @universo/types, universo-template-mui

### Frontend UI Fixes
- [x] 1. Remove TABLE hint Alert from type settings
- [x] 2. Move "Show table title" toggle from General→TypeSettings to Presentation tab
- [x] 3. Add min/max rows settings in TABLE type settings (minRows/maxRows in AttributeValidationRules)
- [x] 4. Allow TABLE as display attribute (removed restrictions in backend + frontend, 4 files)
- [x] 5. Change TABLE constraint notification (show physical type info like other types)
- [x] 6. Fix child table UI: inline nesting via renderRowExpansion, independent numbering, full action menu (BaseEntityMenu)
- [x] 7. Fix child attr dialog: added Presentation tab, i18n keys for editChildDialog

### Build Verification
- [x] Full workspace build: 66/66 tasks ✅
- [x] Schema-ddl tests: 109/109 ✅

---

## Completed: TABLE Attribute Type (Tabular Parts) — 2026-02-20 ✅

> **Context**: Implemented TABLE attribute type (analog of 1C:Enterprise "Табличная часть") in Metahubs.
> **Complexity**: Level 4 (Major/Complex). ~35-40 files, 3500-4500 LOC.
> **Plan**: `memory-bank/plan/table-attribute-plan-2026-02-20.md`
> **QA Review**: 2026-02-21 — 6 CRITICAL, 6 MAJOR, 5 MEDIUM issues found and resolved in plan.
> **Implementation**: 2026-02-21 — All phases completed, all 6 packages build successfully.

### Phase 0+1: Types (`@universo/types`)
- [x] Add TABLE to ATTRIBUTE_DATA_TYPES, MetaFieldDefinition, TableTypeUiConfig, TABLE_CHILD_DATA_TYPES
- [x] Extend getDefaultValidationRules, getPhysicalDataType

### Phase 2: Schema DDL (`@universo/schema-ddl`)
- [x] generateTabularTableName, SchemaFieldSnapshot.childFields, buildSchemaSnapshot TABLE
- [x] CURRENT_SCHEMA_SNAPSHOT_VERSION = 1, new ChangeTypes, createTabularTable
- [x] SchemaMigrator + onDeleteAction parametrization + orderChangesForApply

### Phase 3: Backend Metahubs
- [x] parent_attribute_id in systemTableDefinitions, MetahubAttributesService, attributesRoutes, MetahubElementsService

### Phase 4+5: Snapshot, Sync & Frontend Metahubs
- [x] SnapshotSerializer TABLE childFields, applicationSyncRoutes, seedPredefinedElements
- [x] syncSystemMetadata child attrs, ensureSystemTables parent_attribute_id
- [x] AttributeList TABLE, AttributeActions, ChildAttributeList, AttributeFormFields

### Phase 6+7: Runtime (applications-backend + apps-template-mui)
- [x] TABLE in runtime data_type filter, physicalAttributes, childColumns, coerceRuntimeValue
- [x] CREATE with transaction (child row insertion), DELETE with cascade soft-delete
- [x] resolveTabularContext helper + 4 tabular CRUD endpoints
- [x] apps-template-mui: TABLE in Zod schema, columns.tsx, FormDialog

### Phase 8: i18n
- [x] EN/RU metahubs.json TABLE keys (dataTypeOptions, typeSettings, childAttributes, tableValidation)

### Phase 9: Build Verification
- [x] @universo/types ✅, @universo/schema-ddl ✅, metahubs-backend ✅, metahubs-frontend ✅, applications-backend ✅, apps-template-mui ✅

### Remaining
- [x] Unit tests for schema-ddl TABLE operations (108 tests, all passing)
- [x] TabularPartAdapter.ts, RuntimeTabularPartView.tsx, TabularPartEditor.tsx (3 missing CRITICAL files)
- [x] FormDialog maxWidth dynamic ('lg' for TABLE fields), TABLE case rendering
- [x] CrudDialogs TABLE props passthrough (apiBaseUrl, applicationId, catalogId, editRowId)
- [x] TemplateSeedExecutor/Migrator childAttributes insertion
- [x] seedAttributeSchema childAttributes validation
- [x] Exports from index.ts and api/index.ts
- [ ] Unit tests for metahubs-backend CRUD + sync
- [ ] Manual frontend testing
- [ ] Full workspace build (`pnpm build`)

## Completed: QA Fixes Round 3 — 2026-02-20 ✅

> **Context**: Third comprehensive QA review found 1 CRITICAL + 3 HIGH + 7 MEDIUM + 7 LOW issues
> **Result**: 4 mandatory fixes applied (I8.1, C1, C2-C4, D1) + 109/109 tests pass + all packages build

### CRITICAL
- [x] I8.1: Fix i18n key paths mismatch (`attributes.tableSettings.*` → `attributes.typeSettings.table.*`) in AttributeFormFields.tsx

### HIGH
- [x] C1: Fix `metahubsQueryKeys.childAttributes` non-existent property — replaced with inline query key array
- [x] C2-C4: Fix 3 TypeScript errors in ChildAttributeList.tsx (unused imports `MetaEntityKind`/`getDefaultValidationRules`, invalid `size` prop)
- [x] D1: Wrap `MetahubAttributesService.delete()` in `this.knex.transaction()` for atomic child+parent deletion

### Deferred → Fixed (QA Fixes Round 4) ✅
- [x] I8.2: Add 4 missing i18n keys (addRow, deleteRow, noRows, rowCount) to EN + RU metahubs.json
- [x] I8.3: Use 5 tableValidation i18n keys in frontend code (AttributeFormFields hints, ChildAttributeList validation)
- [x] R7.4: Backend — add TABLE child row count subqueries to data listing; Frontend — show count in TABLE Chip
- [x] D2: Add `_upl_locked` check to runtime PATCH (single + bulk) and DELETE parent routes
- [x] D3: Fix soft-delete cascade: `_app_deleted` → `_upl_deleted` for child tabular rows
- [x] D4: Add `COALESCE(_upl_locked, false) = false` to tabular CRUD WHERE clauses (atomic locked check)
- [x] F6.1: Add TABLE to DynamicFieldType + render info box in DynamicEntityFormDialog + ElementList renderField

### Verification
- [x] Run schema-ddl tests — 109/109 pass
- [x] Build metahubs-backend ✅, metahubs-frontend ✅
- [x] No TypeScript errors in modified files

## Completed: QA Fixes Round 2 — 2026-02-20 ✅

> **Context**: Second QA review found C1 CRITICAL + M1-M6 MEDIUM + L1-L6 LOW issues
> **Result**: All 13 fixes applied + 109/109 tests pass + all 6 packages build

### CRITICAL
- [x] C1: Fix `deserializeSnapshot()` nested→flat mismatch (childFields not flattened into `entity.fields`)

### MEDIUM
- [x] M1: Replace global `let nextLocalId` with `useRef` in TabularPartEditor
- [x] M2: Add `onProcessRowUpdateError` to DataGrid in TabularPartEditor
- [x] M3: Add TABLE throw guard in `mapDataType` (SchemaGenerator)
- [x] M4: Add edit functionality to ChildAttributeList (edit button + dialog + updateAttribute API)
- [x] M5: Replace silent `catch {}` with logged warnings in tabular coerceRuntimeValue (3 locations)
- [x] M6: Add ALTER_TABULAR_COLUMN test in diff.test.ts

### LOW
- [x] L1: Add 4th index (`idx_upl_deleted`) to `createTabularTable`
- [x] L2: Use distinct color for TABLE (`'warning'`) vs REF (`'info'`) in `getDataTypeColor`
- [x] L3: Document inefficient `fetchRow` in TabularPartAdapter (JSDoc)
- [x] L4: Extract duplicated `getRowId` helper in TabularPartEditor
- [x] L5: Remove unnecessary `forceUpdate` + `handleCellChange` pattern in TabularPartEditor
- [x] L6: Stabilize `childFields` reference in RuntimeTabularPartView + extract PAGE_SIZE_THRESHOLD constant

### Verification
- [x] Run schema-ddl tests — 109/109 pass
- [x] Build all affected packages — all 6 OK

---

## Completed: PR #686 Bot Review Fixes — 2026-02-20 ✅

> **Context**: IMPLEMENT mode. Applied fixes for 5 valid bot review comments (Gemini + Copilot) on PR #686.

### Code fixes
- [x] Add `_upl_version` increment to `removeHubFromObjectAssociations` update in `hubsRoutes.ts`
- [x] Standardize error response envelope in `metahubsRoutes.ts` for `normalizedComment.error` (2 locations)
- [x] Add `maxLength={510}` to `LocalizedInlineField` in `MemberFormDialog.tsx` and replace hardcoded English validation message with i18n prop
- [x] Add missing i18n keys (`members.validation.commentCharacterCount`, `members.validation.commentTooLong`) to EN/RU `metahubs.json`
- [x] Revert migration `1766351182000` back to `comment TEXT` and create new migration `1766351182001-AlterMetahubUsersCommentToJsonb.ts`
- [x] Update `MetahubMembers.tsx` to pass `commentTooLongMessage` prop to `MemberFormDialog`
- [x] Update test assertion in `metahubsRoutes.test.ts` to match new error envelope format

### Verification
- [x] Build: 66/66 packages
- [x] Tests: 15/15 suites, 83 passed
- [x] Commit and push to PR #686

---

## Completed: Hub Delete Blockers for Enumerations — 2026-02-19 ✅

> **Context**: IMPLEMENT mode. Extend hub delete blocker logic and UI from catalogs-only to catalogs + enumerations.

### Execution checklist
- [x] Analyze current hub delete blocker flow in backend and frontend dialog
- [x] Add backend blocker detection for enumerations with same rule as catalogs (`isSingleHub` + `isRequiredHub` + only this hub linked)
- [x] Extend hub delete API blocker payload with grouped sections (`catalogs`, `enumerations`) and totals
- [x] Update frontend hub delete dialog to show separate tables for blocking catalogs and blocking enumerations
- [x] Run targeted tests/lint/build for touched packages and record outcomes

## Completed: Unified Action Menus, Row Indexing, Access Member Dialog, Migrations Spacing — 2026-02-19 ✅

> **Context**: IMPLEMENT mode. Unify action menu UX and row numbering across metahubs/applications lists; modernize access member dialog (including VLC comment); align migrations page spacing.

### Execution checklist
- [x] Finalize unified `BaseEntityMenu` behavior (three-dot trigger + icon/text spacing + danger action color) and remove per-page trigger deviations in target lists/cards
- [x] Ensure all delete actions in affected metahub/application menus use `tone: 'danger'` so destructive entries are red and visually consistent
- [x] Complete `#` auto-number column parity for hubs, catalogs, enumerations (frontend columns + stable backend sorting by `sortOrder`)
- [x] Refactor metahub access add/edit member dialog to standard spacing and migrate member comment to VLC payload/storage/rendering
- [x] Update add-member dialog title to localized “Добавление участника / Add member” while preserving short toolbar button text
- [x] Verify and align migrations page horizontal gutters with other list sections (no extra side padding)
- [x] Keep structure/template default versions unchanged and avoid adding legacy fallback branches
- [x] Run targeted lint/build checks for touched packages and record outcomes

## Completed: Enumerations QA Remediation Round 5 — 2026-02-19 ✅

> **Context**: IMPLEMENT mode after latest QA report. Goal is to close critical runtime/backend gaps without widening scope.

### Execution checklist
- [x] Restore invariant checks in `toggle-required` route for enum REF attributes (label mode/default ownership)
- [x] Remove UUID fallback from enum REF runtime cell rendering and show safe empty fallback instead
- [x] Make connector touch operation during schema sync always update `updatedAt`
- [x] Fix blocking prettier/eslint error in `HubList.tsx`
- [x] Run targeted tests/lint/build for touched packages and record outcomes

## Completed: Enumerations QA Remediation Round 4 — 2026-02-19 ✅

> **Context**: IMPLEMENT mode after latest QA report. Goal is to close remaining high/medium findings before the next QA pass.

### Execution checklist
- [x] Fix runtime FormDialog enum defaults so explicit `null` values are never auto-overwritten in edit flow
- [x] Harden enumeration restore route to return deterministic `409` on codename unique conflicts
- [x] Align hub-scoped enumeration PATCH locale fallback with metahub-scoped PATCH behavior
- [x] Add regression tests for restore conflict handling and locale fallback behavior in `enumerationsRoutes`
- [x] Add runtime enumeration regression tests in `applicationsRoutes` for label readonly and enum ownership validation
- [x] Run targeted lint/test/build verification for touched packages and record outcomes

## Completed: Enumerations QA Remediation Round 3 — 2026-02-19 ✅

> **Context**: IMPLEMENT mode after repeated QA requests. Goal is to close remaining functional safety gaps around enum FK migration behavior, attribute required/default invariants, and permanent delete blockers.

### Execution checklist
- [x] Fix `schema-ddl` FK migration path for `REF -> enumeration` to target `_app_enum_values(id)` and ensure system tables are present before FK creation
- [x] Add backend invariant guard for `toggle-required` (`label` mode + required enum REF requires valid `defaultEnumValueId`)
- [x] Add blocker checks to Enumerations permanent delete route (parity with soft delete semantics)
- [x] Add regression tests for all three fixes (`schema-ddl` + metahubs backend routes)
- [x] Run targeted lint/test/build verification for touched packages and record outcomes

## Completed: Enumerations QA Remediation Round 2 — 2026-02-19 ✅

> **Context**: IMPLEMENT mode after comprehensive QA findings. Goal is to remove high/medium risks that still affect Enumerations behavior and migration safety.

### Execution checklist
- [x] Introduce explicit metahub structure V3 (keep V2 immutable), move `_mhb_enum_values` addition to V3, and align template minimum structure version
- [x] Fix Enumerations routes consistency: `_upl_*` timestamps in API payloads + single-hub validation on create endpoints
- [x] Harden application enum sync to remap stale runtime references before soft-deleting removed enum values
- [x] Resolve remaining blocking prettier errors in touched backend template services
- [x] Add/adjust regression tests for structure version expectations and migration plan target version
- [x] Run targeted verification (`build`/`test`/`lint`) for affected packages and record outcomes

## Completed: Enumerations Stabilization Implementation — 2026-02-19 ✅

> **Context**: IMPLEMENT mode after QA. Goal is to resolve compile/runtime blockers and formatter errors introduced by Enumerations rollout.

### Execution checklist
- [x] Align `EnumerationValueDefinition` usage (`presentation` vs legacy `name/description`) across snapshot + sync flow
- [x] Fix `enumerationsRoutes` typing/runtime blockers (`updated.presentation/config` unknown, missing `attributesService` in value delete handler)
- [x] Fix metahub migration route seed counters mismatch (`enumValuesAdded` in zero seed counts)
- [x] Fix `MetahubAttributesService.findElementEnumValueBlockers` result typing (`rows.map` compile issue)
- [x] Fix optimistic lock entity type narrowing in `MetahubObjectsService` / `MetahubEnumerationValuesService`
- [x] Validate and harden enumeration value sync mapping for `_app_enum_values`
- [x] Replace destructive enum sync cleanup with safe soft-delete/restore semantics to avoid FK/NOT NULL migration breakage
- [x] Resolve Prettier errors in new Enumerations frontend files (`metahubs-frontend`)
- [x] Run targeted verification: build + test + lint for touched packages and record outcomes

## PR #682 Bot Review Fixes — 2026-02-18

> **Context**: Gemini Code Assist and Copilot PR Reviewer left 10 comments on PR #682. QA analysis confirmed 9 actionable items.

### Code fixes
- [x] Add `staleTime: 30_000` to `useMetahubMigrationsList` and `useMetahubMigrationsPlan` hooks
- [x] Remove unused `UpdateSeverity` import from `metahubMigrationsRoutes.ts`
- [x] Remove unused `UpdateSeverity` import from `applicationMigrationsRoutes.ts`
- [x] Add `typeof` guard for `meta?.templateVersionLabel` in `MetahubMigrations.tsx`
- [x] Update `determineSeverity` JSDoc — OPTIONAL means "no update needed / pass-through"

### Documentation fixes
- [x] Fix AGENTS.md roles: `viewer` → `member`
- [x] Fix AGENTS.md schema statuses: add DRAFT, OUTDATED, UPDATE_AVAILABLE
- [x] Fix MIGRATIONS.md: align description with actual guard behavior
- [x] Fix memory-bank/progress.md: translate Russian fragments to English

### Verification
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: Enumerations QA Hardening — 2026-02-19 ✅

> **Context**: Post-QA implementation hardening for enumeration sync safety, metadata cleanup correctness, and regression coverage.

### Backend/DDL fixes
- [x] Make `syncSystemMetadata(removeMissing=true)` cleanup run **before** upsert to prevent `(kind, codename)` unique conflicts on recreate
- [x] Enable `removeMissing: true` for all schema sync paths that can run with no DDL changes (application sync + publication sync + migrator paths)
- [x] Harden `syncEnumerationValues()` with duplicate ID guard and stale-row cleanup for removed enumeration objects
- [x] Add declarative unique partial index `uidx_mhb_enum_values_default_active` to `_mhb_enum_values` system table definition

### Compatibility + regression
- [x] Add runtime-compatible enumeration kind fallback in `schema-ddl` for mixed `@universo/types` versions
- [x] Fix `calculateSchemaDiff()` old snapshot entity ID extraction (`Object.entries` + id restore)
- [x] Add regression test: enumeration entities are ignored by physical DDL diff
- [x] Add regression test: metadata cleanup happens before upsert when `removeMissing=true`

### Verification
- [x] `pnpm --filter @universo/schema-ddl lint` (warnings only, no errors)
- [x] `pnpm --filter @universo/schema-ddl test` (7/7 test suites passed)
- [x] `pnpm --filter @universo/schema-ddl build` (success)
- [x] `pnpm --filter @universo/metahubs-backend exec eslint ...` for touched backend files (warnings only, no errors)
- [x] `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/systemTableMigrator.test.ts` (passed)

---

## In Progress: Enumerations Feature Implementation — 2026-02-18

> **Context**: Implementing metahub/application Enumerations end-to-end (entity kind, values, REF support, runtime controls, sync, i18n, routes, and tests/build verification).

### Execution checklist
- [x] Finalize shared contracts: `MetaEntityKind.ENUMERATION`, enum value/presentation types, schema/table version constants
- [x] Implement metahub backend enumeration domain (routes + value CRUD + hub association + delete blockers)
- [x] Extend attribute backend validation and payload normalization for `REF -> enumeration`
- [x] Extend publication snapshot serializer/deserializer for enumeration entities and values
- [x] Extend template manifest validator, seed executor, and seed migrator for enumeration support
- [x] Extend application sync pipeline to copy enumeration values into `_app_enum_values`
- [x] Extend runtime backend (`applicationsRoutes`) to expose/read/write `REF` and validate enum value ownership
- [x] Extend `apps-template-mui` runtime API/types/form renderer for enum presentation modes (`select`, `radio`, `label`)
- [x] Complete metahub frontend enumerations domain (API + hooks + list + values)
- [x] Add metahub menu + route wiring (`metahubs-frontend`, `universo-template-mui`)
- [x] Extend attribute frontend UX: target entity selector supports enumerations and presentation tab supports enum modes/defaults
- [x] Add i18n keys and localized labels in EN/RU for menus, metahub pages, and runtime controls
- [x] Run targeted lint/build for touched files/packages and resolve introduced errors (full `metahubs-backend` build still blocked by pre-existing unrelated TypeScript issues)
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with implementation summary

---

## Completed: QA Fixes + UI Polish Round 6 — 2026-02-19 ✅

> **Context**: QA analysis found 1 bug + 3 warnings. User also requested 4 additional improvements.

### QA Fixes
- [x] **BUG-1 + WARN-3**: Publication DELETE cascade fix — moved linked-app status reset BEFORE `remove()` (FK ON DELETE CASCADE), replaced N+1 loop with single bulk UPDATE sub-select query
- [x] **WARN-1**: Fixed prettier indentation in `ApplicationMigrationGuard.tsx` — MigrationGuardShell props at 16 spaces (was 12)
- [x] **WARN-2**: Fixed 89 prettier errors in `columns.tsx` — converted from 2-space to 4-space indentation project-wide

### UI & Backend Improvements
- [x] Remove extra `px` padding from migrations page inner Stack — matches other list pages (MetahubList, PublicationList)
- [x] Template column for baseline migrations — added `templateVersionLabel` to baseline meta schema/builder, frontend shows `"0 → version"` for baseline kind
- [x] Default layout: `detailsTable` widget as standalone active (sortOrder 6), `columnsContainer` moved to sortOrder 7 with `isActive: false`
- [x] Reset template version `1.1.0` → `1.0.0` in `basic.template.ts` (DB wipe pending)

### Verification
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: UI Polish Round 5 — 5 Fixes — 2026-02-19 ✅

> **Context**: Manual testing found 5 UI issues after LanguageSwitcher integration.

### Fix 1: languageSwitcher widget label missing i18n
- [x] Add `"languageSwitcher": "Переключатель языка"` to ru/metahubs.json `layouts.widgets`
- [x] Add `"languageSwitcher": "Language switcher"` to en/metahubs.json `layouts.widgets`

### Fix 2: Dry run button text too verbose
- [x] Change ru `"dryRun": "Проверить (dry run)"` → `"Проверить"`
- [x] Change en `"dryRun": "Dry run"` → `"Verify"`

### Fix 3: Actions column shows "actions" key in column management panel
- [x] Add `type: 'actions' as const` to actions column in `columns.tsx`
- [x] Set `headerName: options.actionsAriaLabel ?? 'Actions'` (non-empty for MUI DataGrid v8 fallback)

### Fix 4: Table side padding root cause — investigated
- [x] Root cause: `MainLayoutMUI.tsx` has `Stack px: {xs:2, md:3}` (16-24px). Inner `Stack px: {xs:1.5, md:2}` + `Box mx: -2` compensating pattern is universal across all list pages. Not a bug — by design.

### Fix 5: Split "Из → В" column into "Схема" + "Шаблон"
- [x] Update `MigrationDisplayRow` type: replace `fromTo` with `schemaDisplay` + `templateDisplay`
- [x] Row mapping: baseline → schema `"0 → N"`, template_seed → template `"— → {templateVersionLabel}"`
- [x] Replace `fromTo` column with `schema` (14%) + `template` (14%) columns
- [x] Update column widths: appliedAt 24%, name 48%, schema 14%, template 14%
- [x] Add i18n keys: `migrations.columns.schema` / `migrations.columns.template` (EN + RU)

### Verification
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: i18n Fix + LanguageSwitcher Widget — 2026-02-18 ✅

> **Context**: Guard dialog showed English despite `i18nextLng = ru` in localStorage. Also: copy LanguageSwitcher from `universo-template-mui` → `apps-template-mui` as a dashboard widget.

### i18n Fix
- [x] Add `migrationGuard`, `underDevelopment`, `maintenance` to `ApplicationsBundle` type and `consolidateApplicationsNamespace()` in `i18n/index.ts`

### LanguageSwitcher Widget
- [x] Register `languageSwitcher` widget in `DASHBOARD_LAYOUT_WIDGETS` (`@universo/types`)
- [x] Create `LanguageSwitcher.tsx` in `apps-template-mui/src/components/` — self-contained with static labels
- [x] Integrate into `Header.tsx` (desktop) with `showLanguageSwitcher` config flag
- [x] Integrate into `AppNavbar.tsx` (mobile)
- [x] Add to `DEFAULT_DASHBOARD_ZONE_WIDGETS` (sortOrder 7, top zone, active by default)
- [x] Add `showLanguageSwitcher` to `buildDashboardLayoutConfig()`
- [x] Add `showLanguageSwitcher` to Zod schema in `api.ts`
- [x] Add `showLanguageSwitcher` to `useCrudDashboard.ts` defaults
- [x] Add `showLanguageSwitcher?: boolean` to `DashboardLayoutConfig` interface in `Dashboard.tsx`
- [x] Export `LanguageSwitcher` from `apps-template-mui/src/index.ts`
- [x] Bump template version `1.0.0` → `1.1.0` in `basic.template.ts` (triggers `update_available` for existing metahubs)

### Verification
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: Post-QA Polish Round 3 — 6 Fixes — 2026-02-18 ✅

> **Context**: Comprehensive QA analysis found 3 bugs + 3 warnings in Migration Guard implementation.

### BUG-1 (CRITICAL): Missing i18n registration for applications-frontend
- [x] Add `import '@universo/applications-frontend/i18n'` to `MainRoutesMUI.tsx` — namespace was never registered

### BUG-2 (MEDIUM): SchemaStatus type mismatch
- [x] Export `SchemaStatus` type from `types.ts` (single source of truth, 7 values)
- [x] Remove local `SchemaStatus` from `ConnectorBoard.tsx`, import from `types.ts`
- [x] Remove local `SchemaStatus` from `ConnectorDiffDialog.tsx`, import from `types.ts`

### BUG-3 (MINOR): paginationDisplayedRows ignores estimated param
- [x] Add `estimated` to destructuring in `getDataGridLocale.ts` with `примерно ${estimated}` label

### WARN-1: Double AppMainLayout wrapping
- [x] Remove `<AppMainLayout>` from `ApplicationRuntime.tsx` — Guard already provides it
- [x] Remove `AppMainLayout` import from `ApplicationRuntime.tsx`

### WARN-2: Typo in ru locale
- [x] Fix "приложениеа" → "приложения" in `applications.json` line 351

### WARN-3: grey.50 not dark-theme compatible
- [x] Change `bgcolor: 'grey.50'` → `'action.hover'` in `ConnectorBoard.tsx`

### Verification
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: Post-QA Polish — 4 Fixes — 2026-02-18 ✅

> **Context**: Manual testing revealed 4 remaining issues after QA assessed ~96% ТЗ coverage.

### Fix 1: WARN-1 — MIGRATIONS.md links in READMEs
- [x] Add `> **Migration documentation**: [MIGRATIONS.md](MIGRATIONS.md) | [MIGRATIONS-RU.md](MIGRATIONS-RU.md)` to `applications-backend/base/README.md`
- [x] Add same link to `applications-backend/base/README-RU.md`
- [x] Add link + "Migration Guard" feature bullet to `applications-frontend/base/README.md`
- [x] Add same to `applications-frontend/base/README-RU.md`

### Fix 2: Guard dialog not themed (default MUI blue buttons)
- [x] Root cause: `MinimalLayout` renders bare `<><Outlet />` with no ThemeProvider; guard Dialog renders before `ApplicationRuntime`'s `AppMainLayout`
- [x] Fix: Import and wrap with `<AppMainLayout>` in `ApplicationMigrationGuard.tsx` — Dialog now inherits custom theme

### Fix 3: Table i18n (actions column + pagination)
- [x] `actions` column in column toggle panel: Added `hideable: false` to actions column in `columns.tsx`
- [x] Pagination "1-1 of 1" → "1–1 из 1": Added `paginationDisplayedRows` override to `getDataGridLocale.ts` for 'ru' locale
  - Note: MUI X DataGrid v8 ruRU locale does NOT include `paginationDisplayedRows` by default

### Fix 4: Status display shows "Черновик" for update_available
- [x] Expand `SchemaStatus` type in `ConnectorBoard.tsx`: add `'update_available' | 'maintenance'`
- [x] Add `update_available` and `maintenance` entries to `statusConfig` (color + i18n label)
- [x] Add cases to status description ternary chain
- [x] Add i18n keys to EN and RU `applications.json` (`connectors.status.*` and `connectors.statusDescription.*`)

### Verification
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: Runtime Fix — React is not defined — 2026-02-18 ✅

> **Context**: Metahub page crashed at runtime with `ReferenceError: React is not defined` in `index.mjs:33`.

- [x] Diagnose: `tsconfig.json` had `"jsx": "react"` (classic transform → `React.createElement`) but source uses named imports only (`{ useState }`)
- [x] Fix: Changed `"jsx": "react"` → `"jsx": "react-jsx"` (automatic JSX runtime, React 17+)
- [x] Verify: `dist/index.mjs` now imports from `react/jsx-runtime`, zero `React.createElement` calls
- [x] Build: 66/66 packages

---

## Completed: QA Fixes Round 2 — WARN-1/2/3 — 2026-02-18 ✅

> **Context**: Fixes for warnings from second QA verification of Migration Guard fixes.

### WARN-1: Shared status options suppress retry/refetch for listing hooks
- [x] Remove `...MIGRATION_STATUS_QUERY_OPTIONS` from `useMetahubMigrationsList` — use TanStack Query defaults
- [x] Remove `...MIGRATION_STATUS_QUERY_OPTIONS` from `useMetahubMigrationsPlan` — use TanStack Query defaults
- [x] Keep shared options only in `useMetahubMigrationsStatus` (status query)

### WARN-2: Backend-safe entry exports unused RQ config
- [x] Remove `MIGRATION_STATUS_QUERY_OPTIONS` re-export from `utils.ts`

### WARN-3: Missing peerDependenciesMeta with optional: true
- [x] Add `peerDependenciesMeta` to `package.json` — all React deps marked optional

### Verification
- [x] Lint: 0 errors on all modified files
- [x] Build: 66/66 packages

---

## Completed: QA Fixes — BUG-1 + WARN-3/4/5 — 2026-02-18 ✅

> **Context**: Fixes for issues found during comprehensive QA analysis of the Migration Guard implementation.

### BUG-1: CJS bundle pulls React/MUI on backend
- [x] Create `src/utils.ts` — backend-safe entry point (determineSeverity + MIGRATION_STATUS_QUERY_OPTIONS only)
- [x] Update `tsdown.config.ts` — add second entry point `utils`
- [x] Update `package.json` exports map — add `./utils` subpath
- [x] Update `applicationMigrationsRoutes.ts` import → `@universo/migration-guard-shared/utils`
- [x] Update `metahubMigrationsRoutes.ts` import → `@universo/migration-guard-shared/utils`
- [x] Verify `dist/utils.js` has no React/MUI requires

### WARN-3: Inline query options duplication in useMetahubMigrations.ts
- [x] Replace inline options in `useMetahubMigrationsList` with `...MIGRATION_STATUS_QUERY_OPTIONS`
- [x] Replace inline options in `useMetahubMigrationsPlan` with `...MIGRATION_STATUS_QUERY_OPTIONS`

### WARN-4: Misleading error on refetch failure in MetahubMigrationGuard
- [x] Separate try-catch blocks for migration apply and refetch

### WARN-5: Unstable statusQuery in useCallback deps
- [x] Extract `refetchStatus = statusQuery.refetch` (stable ref)
- [x] Use `refetchStatus` in useCallback deps instead of `statusQuery`

### Verification
- [x] Lint: 0 errors on all modified files
- [x] Build: 66/66 packages
- [x] Memory-bank updated

---

## Completed: Migration Guard — Full ТЗ Coverage (6-Phase Plan) — 2026-02-18 ✅

> **Context**: 6-phase plan to achieve 100% ТЗ coverage for the Unified Application Migration Guard feature. Covers table rename, shared package creation, AGENTS.md, MIGRATIONS.md extraction, README updates, and code deduplication.

### Phase 1: Rename _app_layout_zone_widgets → _app_widgets
- [x] Rename table in `SchemaGenerator.ts` (table name + 2 index names)
- [x] Rename in `applicationSyncRoutes.ts` (8 table refs, 3 function renames, variable rename with 6 refs)
- [x] Rename in `applicationsRoutes.ts` (2 SQL literals)
- [x] Reset template version 1.2.0 → 1.0.0 in `basic.template.ts`
- [x] CURRENT_STRUCTURE_VERSION already at 1, no change needed

### Phase 2: Create @universo/migration-guard-shared package
- [x] Create package.json, tsconfig.json, tsdown.config.ts
- [x] Create `determineSeverity.ts` — pure utility function
- [x] Create `migrationStatusQueryOptions.ts` — shared TanStack Query options
- [x] Create `MigrationGuardShell.tsx` — generic render-props shell component
- [x] Create `index.ts` — re-exports (backend-safe + frontend-only)
- [x] Build verification: 66/66 packages

### Phase 3: Create missing AGENTS.md files
- [x] `metahubs-frontend/base/AGENTS.md` — new
- [x] `applications-backend/base/AGENTS.md` — new
- [x] `migration-guard-shared/base/AGENTS.md` — new
- [x] `applications-frontend/base/AGENTS.md` — updated (MigrationGuardShell ref)
- [x] `metahubs-backend/base/AGENTS.md` — updated (determineSeverity ref)

### Phase 4: Extract MIGRATIONS.md from READMEs (4 packages × 2 languages)
- [x] `metahubs-backend/base/MIGRATIONS.md` + `MIGRATIONS-RU.md`
- [x] `metahubs-frontend/base/MIGRATIONS.md` + `MIGRATIONS-RU.md`
- [x] `applications-frontend/base/MIGRATIONS.md` + `MIGRATIONS-RU.md`
- [x] `applications-backend/base/MIGRATIONS.md` + `MIGRATIONS-RU.md`

### Phase 5: Update READMEs with links to MIGRATIONS.md
- [x] `metahubs-backend/base/README.md` — replaced 4 migration sections with links
- [x] `metahubs-backend/base/README-RU.md` — replaced 4 migration sections with links
- [x] `metahubs-frontend/base/README.md` — replaced MetahubMigrationGuard + Structured Blockers with link
- [x] `metahubs-frontend/base/README-RU.md` — replaced MetahubMigrationGuard + Structured Blockers with link

### Phase 6: Refactor Guards to use shared package
- [x] `applicationMigrationsRoutes.ts` — determineSeverity() replaces inline logic
- [x] `metahubMigrationsRoutes.ts` — determineSeverity() replaces inline logic
- [x] `useApplicationMigrationStatus.ts` — MIGRATION_STATUS_QUERY_OPTIONS from shared
- [x] `useMetahubMigrations.ts` — MIGRATION_STATUS_QUERY_OPTIONS from shared
- [x] `ApplicationMigrationGuard.tsx` — rewritten with MigrationGuardShell (202→134 lines)
- [x] `MetahubMigrationGuard.tsx` — rewritten with MigrationGuardShell (199→154 lines)
- [x] Prettier/lint fixes on both Guard files

### Verification
- [x] Build: 66/66 packages (65 original + migration-guard-shared)
- [x] Grep: 0 remaining references to old names
- [x] Memory-bank updated

---

## Completed: Unified Application Migration Guard — 2026-02-18 ✅

> **Context**: Unifying metahub migration system with application sync system. Adding proactive schema status checking, severity-based migration guard, and "under development" page for applications.

### Implementation (Этапы 1-10) — ✅ Completed 2026-02-23
- [x] All 10 étaps implemented and build-verified (65/65)

### QA Fixes Round 1 — ✅ Completed 2026-02-24
- [x] **BUG-1**: Fix "Continue anyway" button — added `useState(false)` dismissed state, `setDismissed(true)` on click
- [x] **BUG-2**: Application copy now copies `appStructureVersion` and `lastSyncedPublicationVersionId`
- [x] **WARN-1**: Added test mocks for new exports in `exports.test.ts` (was timeout, now 653ms)
- [x] **WARN-2**: Fixed all prettier formatting errors in guard + hook
- [x] **WARN-3**: Changed `key={idx}` to `key={blocker.code}` for blockers list
- [x] **INFO-2**: Extracted `TARGET_APP_STRUCTURE_VERSION = 1` constant in both route files
- [x] **INFO-5**: Added `ensureMemberAccess` for status endpoint (any member can check, not just admins)
- [x] Build verification: 65/65 packages, 0 errors

### QA Fixes Round 2 — ✅ Completed 2026-02-18
- [x] **BUG-1**: `extractAxiosError()` returns object, not string — appended `.message` in 4 places (ApplicationGuard, MetahubGuard×2, mutations.ts)
- [x] **BUG-2**: `isAdminRoute`/`isMigrationsRoute` — replaced `.includes()` with regex `/\/admin(\/|$)/`; removed unused `useMemo` imports
- [x] **BUG-3**: Application copy resets `schemaStatus` (SYNCED→SYNCED, else→OUTDATED), clears `schemaError` and `lastSyncedPublicationVersionId`
- [x] **BUG-4**: Publication DELETE cleanup — resets `UPDATE_AVAILABLE` → `SYNCED` on linked applications (inside transaction)
- [x] **BUG-5**: Connector/ConnectorPublication DELETE cleanup — same `UPDATE_AVAILABLE` → `SYNCED` reset
- [x] **WARN-4**: `notifyLinkedApplicationsUpdateAvailable()` — replaced N+1 loop with single UPDATE + sub-select query
- [x] **WARN-5**: Advisory lock for sync route — `pg_try_advisory_lock` via `acquireAdvisoryLock`, returns 409 on conflict
- [x] **WARN-6**: `useMetahubMigrationsStatus` — added `staleTime: 30_000` for consistency
- [x] **WARN-7**: MetahubGuard severity fallback — changed to `status?.severity === MANDATORY` (matches ApplicationGuard pattern)
- [x] **WARN-8**: MetahubGuard — `key={blocker.code}` instead of `key={idx}`
- [x] **WARN-9/12**: Dialog `aria-describedby` + `onClose` for RECOMMENDED severity (both guards)
- [x] **WARN-10**: `MaintenancePage` + `UnderDevelopmentPage` — added `role='status'` + `aria-live='polite'`
- [x] **WARN-11**: ApplicationGuard blockers i18n — 15 keys in EN + RU `applications.json`
- [x] AGENTS.md files moved to `/base` directories (metahubs-backend, applications-frontend)
- [x] Prettier/lint fixes on all 8 modified files
- [x] Build verification: 65/65 packages, 0 errors, 0 new lint errors

---

## Completed: Documentation Updates (QA Recommendations) — 2026-02-22 ✅

> **Context**: README updates recommended during QA analysis of columnsContainer + migration guard implementation.

### metahubs-frontend README (EN + RU)
- [x] Add ColumnsContainerEditorDialog section (DnD editor, MAX_COLUMNS=6, MAX_WIDGETS_PER_COLUMN=6)
- [x] Add MetahubMigrationGuard section (route guard, status check, apply button, structured blockers)
- [x] Add Structured Blockers i18n section (StructuredBlocker type, rendering pattern)
- [x] Update file structure to show `domains/layouts/` and `domains/migrations/` directories
- [x] Verify EN/RU line count parity: 435/435

### metahubs-backend README (EN + RU)
- [x] Add Structured Blockers & Migration Guard subsection to Key Features
- [x] Add ColumnsContainer Seed Config subsection to Key Features
- [x] Add Metahub Migrations Endpoints section (GET status + POST apply with response format)
- [x] Update file structure to show `migrations/` domain and updated `layoutDefaults.ts` description
- [x] Verify EN/RU line count parity: 771/771

### apps-template-mui README (NEW, EN + RU)
- [x] Create README.md — dashboard system, columnsContainer, widget renderer, CRUD components, route factory, architecture, file structure, key types
- [x] Create README-RU.md — mirror of EN with identical line count
- [x] Verify EN/RU line count parity: 307/307

---

## Completed: QA Bug & Warning Fixes — 2026-02-21 ✅

> **Context**: Fixes for 2 BUGs and 4 WARNs found during QA of the 5-Étap implementation.

### BUG Fixes
- [x] BUG-1: Disable "Apply (keep user data)" button when `status.blockers.length > 0` (`MetahubMigrationGuard.tsx`)
- [x] BUG-2: Inline `goToMigrations` function + fix Rules of Hooks violation (`MetahubMigrationGuard.tsx`)

### WARN Fixes
- [x] WARN-1: Replace `key={idx}` with stable `key={column.id}-w${idx}` in SortableColumnRow widgets (`ColumnsContainerEditorDialog.tsx`)
- [x] WARN-2: Remove redundant `makeDefaultConfig()` call from `useState` initializer (`ColumnsContainerEditorDialog.tsx`)
- [x] WARN-3: Add save-time validation to strip `columnsContainer` widgetKey nesting (`ColumnsContainerEditorDialog.tsx`)
- [x] WARN-4: Tests already passing — confirmed setup via `happy-dom` + shared `setupTests.ts` chain

### Verification
- [x] Full workspace build: 65/65 packages, 0 errors
- [x] Lint: 0 errors (320 pre-existing warnings)
- [x] Tests: 3/3 passing
- [x] Update memory-bank

---

## Completed: 5-Etap QA Fixes — User-Reported Issues — 2026-02-20 ✅

> **Context**: Comprehensive QA fixes addressing user-reported issues across metahubs and apps-template-mui. 5 etaps covering editor UX, layout display, migration UX, structured i18n blockers, and multi-widget columns.

### Etap 1: Editor canSave + dirty tracking
- [x] Add `useRef` snapshot for initial state in `ColumnsContainerEditorDialog.tsx`
- [x] Add `isDirty` useMemo comparing JSON snapshots
- [x] Add `canSave` prop to EntityFormDialog: `() => isDirty && columns.length > 0 && totalWidth <= MAX_WIDTH`
- [x] Add `widthError` i18n key to EN and RU

### Etap 2: LayoutDetails inner widgets display
- [x] `getWidgetChipLabel()` in `LayoutDetails.tsx` shows inner widget names for columnsContainer
- [x] Uses `col.widgets.flatMap()` for multi-widget support

### Etap 3: Migration guard "Apply (keep user data)" button
- [x] Add warning-color button in `MetahubMigrationGuard.tsx` calling `applyMetahubMigrations(id, { cleanupMode: 'keep' })`
- [x] Add loading (`applying`) and error (`applyError`) states
- [x] Add `applyKeepData` i18n key to EN and RU

### Etap 4: Structured blockers i18n (largest change, 7 files)
- [x] New `StructuredBlocker` interface in `@universo/types`: `{ code, params, message }`
- [x] Backend `TemplateSeedCleanupService.ts`: 11 blocker sites converted from strings to structured objects
- [x] Backend `metahubMigrationsRoutes.ts`: 5 blocker sites converted
- [x] Frontend `migrations.ts` API types updated to `StructuredBlocker[]`
- [x] Frontend `MetahubMigrationGuard.tsx` renders structured blockers with `<ul>/<li>` and `t()`
- [x] 15 blocker i18n keys added to EN/RU locales

### Etap 5A: multiInstance revert + MainGrid filter
- [x] `columnsContainer.multiInstance` back to `true` in `metahubs.ts`
- [x] `MainGrid.tsx`: `.find()` -> `.filter()` for multiple columnsContainers, each rendered in `<Box>`

### Etap 5B: Multi-widget columns (6 files)
- [x] New `ColumnsContainerColumnWidget` interface: `{ widgetKey: DashboardLayoutWidgetKey }`
- [x] `ColumnsContainerColumn`: `widgetKey` property replaced with `widgets: ColumnsContainerColumnWidget[]`
- [x] `widgetRenderer.tsx`: renders `(col.widgets ?? []).map()` per column
- [x] `layoutDefaults.ts`: seed updated to `widgets: [{ widgetKey: 'detailsTable' }]`
- [x] `ColumnsContainerEditorDialog.tsx`: full rewrite for multi-widget — per-column widget list with add/remove, `MAX_WIDGETS_PER_COLUMN=6`
- [x] `LayoutDetails.tsx`: chip label uses `col.widgets.flatMap()`
- [x] Added `addWidget` i18n key to EN/RU

### Verification
- [x] Full workspace build: 65/65 packages, 0 errors
- [x] Modified 12 files total

### Next Steps
- QA mode for validation

---

## Completed: Center Zone columnsContainer + Data-Driven MainGrid — 2026-02-19 ✅

> **Context**: Follow-up to Dashboard Zones & Widgets Enhancement. Fixes BUG-5/BUG-6 and implements columnsContainer in center zone.

### Etap A: Fix buildDashboardLayoutConfig — zone-aware center widget flags
- [x] A.1 Add `centerActive` set filtered by `zone === 'center'` in `layoutDefaults.ts`
- [x] A.2 Remove `showDetailsSidePanel`, add `showColumnsContainer`

### Etap D: Seed data + template version
- [x] D.1 Replace standalone `detailsTable` with `columnsContainer` in `DEFAULT_DASHBOARD_ZONE_WIDGETS`
- [x] D.2 Remove `detailsSidePanel` from right zone seed entries
- [x] D.3 Bump template version `1.1.0` -> `1.2.0` in `basic.template.ts`

### Etap B: Runtime API center zone
- [x] B.1 Expand SQL filter to `zone IN ('left', 'right', 'center')` in `applicationsRoutes.ts`
- [x] B.2 Add `center` zone mapping in widget row processing
- [x] B.3 Add `center` array to Zod schema in `api.ts`
- [x] B.4 Add `center` to `applications-frontend/types.ts`

### Etap C: MainGrid data-driven refactor
- [x] C.1 Create `DashboardDetailsContext.tsx` with Provider + hook
- [x] C.2 Add `detailsTable` case to `widgetRenderer.tsx` (uses context)
- [x] C.3 Add `center` to `ZoneWidgets`, wrap Dashboard in `DashboardDetailsProvider`, pass centerWidgets to MainGrid
- [x] C.4 Refactor `MainGrid.tsx` — columnsContainer via `renderWidget()`, fallback to standalone `detailsTable`

### Etap F: Remove legacy code
- [x] F.1 Remove `showDetailsSidePanel` from `useCrudDashboard.ts`, add `showColumnsContainer`
- [x] F.2 Remove `showDetailsSidePanel` from `applicationSyncRoutes.ts`, add `showColumnsContainer`
- [x] F.3 Remove `showDetailsSidePanel` from `LayoutList.tsx`, add `showColumnsContainer`
- [x] F.4 Replace `showDetailsSidePanel` with `showColumnsContainer` in i18n EN/RU

### Etap E-G: Verification
- [x] E.1 Verified `TemplateSeedMigrator` correctly adds columnsContainer to existing metahubs
- [x] E.2 Verified `enrichConfigWithVlcTimestamps` does not corrupt columnsContainer config
- [x] G.1 Full workspace build — 65/65 packages, 0 errors
- Details: progress.md#center-zone-columnscontainer

---

## Completed: Dashboard Zones & Widgets Enhancement (Level 4) — 2026-02-18 ✅

> **Creative phase** — design documented in `memory-bank/creative/creative-dashboard-zones-widgets.md`
> **Implementation**: All 4 phases completed and verified.

### Phase 1: Split detailsSidePanel -> productTree + usersByCountryChart
- [x] 1.1 Add widget keys to `universo-types/metahubs.ts`
- [x] 1.2 Add default widget entries in `layoutDefaults.ts`
- [x] 1.3 Split rendering in `MainGrid.tsx`
- [x] 1.4 Update DashboardLayoutConfig, useCrudDashboard defaults
- [x] 1.5 Update i18n files (widget labels)

### Phase 2: columnsContainer Widget
- [x] 2.1 Add `ColumnsContainerConfig` type + `columnsContainer` widget key to `universo-types`
- [x] 2.2 Create `ColumnsContainerEditorDialog.tsx` (metahubs-frontend, DnD-sortable)
- [x] 2.3 Integrate editor trigger in `LayoutDetails.tsx`
- [x] 2.4 Add `columnsContainer` rendering in `widgetRenderer.tsx` (center zone)
- [x] 2.5 Add i18n keys for columnsContainer

### Phase 3: Right Drawer (SideMenuRight)
- [x] 3.1 Extract `renderWidget()` to shared `widgetRenderer.tsx`
- [x] 3.2 Create `SideMenuRight.tsx` (permanent, 280px), `SideMenuMobileRight.tsx` (temporary)
- [x] 3.3 Modify `SideMenuMobile.tsx` (anchor: right->left)
- [x] 3.4 Update Dashboard + AppNavbar for dual drawer support with mutual exclusion
- [x] 3.5 Backend: expand zone filter in `applicationsRoutes.ts` for right zone
- [x] 3.6 Update `allowedZones` for widgets (`infoCard`, `divider`, `spacer`)

### Phase 4: Routing isolation
- [x] 4.1 Create `createAppRuntimeRoute()` factory in `apps-template-mui`
- [x] 4.2 Export types `AppRouteObject`, `AppRuntimeRouteConfig`
- [x] 4.3 Import and use in `MainRoutesMUI.tsx`

### QA Fixes (8 issues)
- [x] BUG-1: `ColumnsContainerEditorDialog` dead state reset — `useEffect([open, config])`
- [x] BUG-2: `detailsSidePanel` ghost widget — explicit deprecated case in `widgetRenderer.tsx`
- [x] BUG-3: Template version `1.0.0` -> `1.1.0` in `basic.template.ts`
- [x] BUG-4: `TemplateSeedMigrator` ignoring `w.isActive` from seed — fixed
- [x] WARN-1: `totalWidth > 12` validation blocking save
- [x] WARN-2: `MAX_COLUMNS = 6` limit with disabled button
- [x] WARN-3: `MAX_CONTAINER_DEPTH = 1` recursion guard with depth parameter
- [x] WARN-4: Documented SideMenuMobile anchor change. STYLE: Prettier applied (6 files)
- [x] 5 files created, 17+ modified. Build: all packages OK.
- Details: progress.md#dashboard-zones-widgets

---

## Completed: Architecture Refactoring — Headless Controller Hook — 2026-02-17 ✅

- [x] 1. Create `CrudDataAdapter` interface (`api/types.ts`) — decouples CRUD logic from API implementations
- [x] 2. Extract `toGridColumns()` + `toFieldConfigs()` into shared `utils/columns.tsx`
- [x] 3. Create `useCrudDashboard()` headless controller hook (~400 lines)
- [x] 4. Create `createStandaloneAdapter()` + `createRuntimeAdapter()` implementations
- [x] 5. Create `CrudDialogs` + `RowActionsMenu` shared components
- [x] 6. Refactor `DashboardApp.tsx` — 483 -> ~95 lines (-80%)
- [x] 7. Refactor `ApplicationRuntime.tsx` — 553 -> ~130 lines (-76%)
- [x] 8. 7 new files, 4 modified. Build: apps-template-mui clean.
- Pattern: systemPatterns.md#headless-controller-hook
- Details: progress.md#architecture-refactoring

## Completed: QA Bug Fixes — BUG-1/2/3, PERF-1 (2026-02-17) ✅

- [x] BUG-1: Fix `catalogId` propagation in `useUpdateRuntimeCell` — passed dynamically via mutate params + ref
- [x] BUG-2: `useCrudDashboard` accepts `adapter: CrudDataAdapter | null` — queries disabled when null
- [x] BUG-3: Extracted `mapMenuItems()` helper — eliminated ~50 lines duplication
- [x] PERF-1: Stabilized `cellRenderers` ref via `useRef` — prevents DataGrid column re-creation
- [x] Build: 65/65 OK

## Completed: UI Polish — Button Position, Actions Centering, DataGrid i18n — 2026-02-17 ✅

- [x] 1. Move create button below title (toolbar area) — `MainGrid.tsx`
- [x] 2. Fix options button vertical centering — DataGrid cell `display: flex, alignItems: center`
- [x] 3. DataGrid i18n — `getDataGridLocaleText()` utility with `ruRU` locale
- [x] 4. Column menu (Sort/Filter/Hide/Manage) and pagination fully localized
- [x] 5. 6 files modified, 1 created. Build: 65/65 OK.
- Details: progress.md#ui-polish

## Completed: QA Round 6 — M1-M4, UX Improvements — 2026-02-17 ✅

- [x] M1: Backend PATCH null check for required fields in `applicationsRoutes.ts`
- [x] M2: `extractErrorMessage()` helper — structured JSON error parsing across 5 API functions
- [x] M3: 5 shared mutation hooks in `applications-frontend/mutations.ts`, refactored ApplicationRuntime
- [x] M4: Schema fingerprint tracking via `useRef` — prevents stale data submission
- [x] Actions column: `MoreVertRoundedIcon` dropdown menu (28x28, width 48)
- [x] Button text: "Create record"->"Create" across 4 i18n files + JSX fallbacks
- [x] i18n: Added `errorSchemaChanged` key to all 4 locale files
- [x] Build: 65/65 OK.
- Details: progress.md#qa-round-6

## Completed: QA Round 5 — Dialog Input Styling — 2026-02-16 ✅

- [x] Root cause: Dashboard compact `MuiOutlinedInput` (padding: 0, hidden notchedOutline) incompatible with form Dialogs
- [x] Fix: Replaced with form-compatible spacing (`padding: '15.5px 16px'`, standard notchedOutline)
- [x] Added `MuiInputLabel` customization (floating label with shrink background, focused color)
- [x] Added `MuiButton` disabled state (`opacity: 0.6`) + per-variant disabled colors
- [x] Build: 65/65 OK. Only `inputs.tsx` file modified.
- Details: progress.md#qa-round-5

## Completed: QA Round 4 — Theme Dedup, Runtime Rename — 2026-02-16 ✅

- [x] THEME-1: Removed duplicate `<AppTheme>` + `<CssBaseline>` from Dashboard.tsx
- [x] RUNTIME-1: Renamed runtime->app terminology in `api.ts` (functions, types, schema names)
- [x] RUNTIME-2: Renamed in `mutations.ts` (hooks, query keys). Cache namespace: `'application-runtime'`->`'application-data'`
- [x] RUNTIME-3: Updated `DashboardApp.tsx` — imports, local var `runtime`->`appData`, i18n keys
- [x] RUNTIME-4: Updated `index.ts` — canonical `appQueryKeys` export, deprecated `runtimeKeys` alias
- [x] RUNTIME-5: Updated `ApplicationRuntime.tsx` — new imports, i18n `app.*`
- [x] RUNTIME-6: Renamed `tsconfig.runtime.json` -> `tsconfig.build.json`, updated build script
- [x] i18n: Updated `runtime.*` -> `app.*` keys (4 locale files). Backward-compat aliases maintained.
- [x] Build: 65/65 OK.
- Details: progress.md#qa-round-4

## Completed: QA Round 3 — Theme, Hooks, Delete, i18n, Layout — 2026-02-15 ✅

- [x] 1. Created `AppMainLayout` component (theme wrapper + CssBaseline + x-theme)
- [x] 2. Fixed HOOKS-1: moved `useMemo`/`isFormReady` before conditional early return
- [x] 3. Wrapped DashboardApp + ApplicationRuntime returns in `AppMainLayout`
- [x] 4. Fixed DELETE-1: removed auto-close from `ConfirmDeleteDialog.handleConfirm`
- [x] 5. Fixed I18N-1: replaced hardcoded `formatMessage` with `useTranslation('apps')` + 16 new keys
- [x] 6. Updated `index.ts` exports
- [x] 7. Deleted dead code: `MinimalLayout.tsx`, `TableRoute.tsx`, empty `routes/`
- [x] 8. Prettier fixes (12 files). Build: 65/65 OK.
- Details: progress.md#qa-round-3

## Completed: QA Rounds 1-2 — Validation, Cache, VLC, Security — 2026-02-14/15 ✅

- [x] DATE-1: Backend date validation (`new Date()` + `isNaN` check) in coerceRuntimeValue
- [x] VALID-2/3: UUID validation for catalogId and applicationId
- [x] CACHE-1: Broadened cache invalidation (applicationId-only key)
- [x] VLC-1: Structural check for VLC objects (require `locales` property)
- [x] VALID-1: UUID format validation for path params (returns 400 instead of 500)
- [x] AUDIT-1: Added `_upl_updated_by` to PATCH endpoints
- [x] UX-1: Removed `throw err` from delete handlers (avoids Unhandled Promise Rejection)
- [x] I18N-1: `{{message}}` interpolation in standalone error keys
- Details: progress.md#qa-rounds-1-2

## Completed: Runtime CRUD + VLC + i18n + DataGrid — 2026-02-15 ✅

### Phase 1: Backend API (applications-backend)
- [x] 1.1 Extend GET runtime: DATE/JSON types, isRequired, validationRules
- [x] 1.2 POST /:applicationId/runtime/rows — create row with VLC support
- [x] 1.3 PATCH — support all field types (not just BOOLEAN)
- [x] 1.4 DELETE — soft delete
- [x] 1.5 GET /:applicationId/runtime/rows/:rowId — raw data for edit form

### Phase 2: Frontend Components (apps-template-mui)
- [x] 2.1-2.4 Adapted RuntimeFormDialog, LocalizedInlineField, ConfirmDeleteDialog

### Phase 3-4: API + CRUD UI
- [x] 3.1-3.2 Zod schema extension + React Query mutations
- [x] 4.1-4.5 Actions slot, create button, edit/delete columns, dialogs connected

### Phase 5-7: i18n, DataGrid UX, Finalization
- [x] 5.1-5.3 `apps` namespace i18n (EN/RU), `useTranslation` connected
- [x] 6.1-6.3 Column header jitter fix, sorting enabled, actions toolbar
- [x] 7.1 Full build: 65/65 OK
- Details: progress.md#runtime-crud

## Completed: Metahubs UX — Boolean Fix, Auto-fill, Presentation Tab — 2026-02-13 ✅

- [x] Task 1: Fix indeterminate checkbox (DDL `.defaultTo(false)`, runtime null->false, frontend `indeterminate={false}`)
- [x] Task 2: Auto-fill publication name (metahub name + " API" suffix via VLC)
- [x] Task 3: Presentation tab (tabs pattern, PresentationTabFields, display attribute + headerAsCheckbox)
- [x] Task 4: Boolean header as checkbox (uiConfigSchema -> SQL -> Zod -> renderHeader pipeline)
- [x] Task 5: Migration verification (no new migrations needed)
- [x] QA: TYPE-1 (uiConfig to AttributeFormValues), CONCUR-1 (shallow merge for uiConfig update)
- [x] Build: 65/65 OK. 14 files in 6 packages.
- Details: progress.md#metahubs-ux

## Completed: UI/UX Polish — Menu Fix, Buttons, Widget Toggle, Hubs Tab — 2026-02-14 ✅

- [x] Fixed "Layouts" menu position in PRODUCTION config (`menuConfigs.ts`) + synced `metahubDashboard.ts`
- [x] Changed page buttons from "Add" to "Create" in 10 list files (metahubs + applications)
- [x] Replaced Switch with Activate/Deactivate buttons + icons in LayoutDetails
- [x] Show Hubs tab in catalog edit dialog (always, matching create mode)
- [x] Change create dialog button "Save" -> "Create" across 10 files
- [x] Fix codename auto-fill: reset `codenameTouched` when name cleared in edit mode
- [x] Build: 65/65 OK.
- Details: progress.md#ui-ux-polish

---

## Completed: QA Remediation + Migration Support — 2026-02-10 to 2026-02-13 ✅

### QA Round 2 Remediation (2026-02-13)
- [x] Fix `ensureDefaultZoneWidgets` and `createLayout` to respect `isActive` from defaults
- [x] Add unique partial index on `(layout_id, zone, widget_key, sort_order)`
- [x] Fix stale test expectations in `metahubMigrationsRoutes.test.ts` and `metahubBranchesService.test.ts`
- [x] Fix `layoutCodename -> template_key` assumption in TemplateSeedCleanupService
- [x] Reset schema version to 1 and template version to 1.0.0

### Zod Schema + cleanupMode Fix (2026-02-13)
- [x] Add `isActive: z.boolean().optional()` to `seedZoneWidgetSchema`
- [x] Change `cleanupMode` default from `'keep'` to `'confirm'`

### Seed isActive + Cleanup Mode + i18n + Pool Docs (2026-02-13)
- [x] Add `isActive` to `DefaultZoneWidget` type, map through seed pipeline
- [x] Pass `cleanupMode: 'confirm'` from frontend apply handler
- [x] Add `UI_LAYOUT_ZONES_UPDATE` case in `ConnectorDiffDialog` + i18n keys

### Migration 503 Pool Starvation Fix (2026-02-13)
- [x] Replace `inspectSchemaState` Promise.all(7x hasTable) with single information_schema query
- [x] Fix `widgetTableResolver` similarly — single information_schema query
- [x] Update pool formulas in KnexClient.ts and DataSource.ts

### Hash/Typing/UI Toggle Polish (2026-02-13)
- [x] Add `isActive` into snapshot hash normalization
- [x] Remove unnecessary `as any` cast, add optimistic UI update + rollback

### Widget Activation Toggle (2026-02-13)
- [x] Structure V3 DDL (`is_active` column in `_mhb_widgets`) + bump to V3
- [x] Backend service toggle + route, frontend types/API/UI
- [x] `TemplateSeedCleanupService` + `TemplateSeedExecutor` + `TemplateSeedMigrator` updates
- [x] Snapshot/Publication pipeline + Application Sync updates

### README Documentation (2026-02-12/13)
- [x] Full rewrite metahubs-backend README.md (EN, 730 lines) + README-RU.md (RU, 730 lines)
- Details: progress.md (entries from 2026-02-10 to 2026-02-13)

---

## Completed: QA Rounds 5-16 — Pool, Locks, Cache, Error Mapping — 2026-02-11/12 ✅

### Rounds 9-10: Migration Gate + Template Version Source (2026-02-12)
- [x] DB-aware `ensureSchema()`, V1/V2-compatible widget table resolver
- [x] Migration-required 428 errors, pool-timeout 503, `GET /migrations/status` endpoint
- [x] `MetahubMigrationGuard` modal — route-level block until migration resolved
- [x] Branch-level template sync tracking, removed unsafe early cache-return
- [x] Connect-timeout -> 503 mapping, frontend retry reduction + loading indicator

### Rounds 11-12: Scoped Manager + Pool Load Shedding (2026-02-12)
- [x] Split `ensureSchema` into explicit modes, version-aware table checks
- [x] Request-scoped EntityManager in MetahubSchemaService, propagated to routes/services
- [x] Frontend refetch flow fixes, removed global manager fallback

### Rounds 13-14: Atomic Sync + Error Mapping (2026-02-12)
- [x] Update structureVersion only after successful structure + seed sync
- [x] Scoped widget resolver in seed executor/migrator
- [x] Retry dedup in auth-frontend, timeout/domain error mapping
- [x] Apply pre-plan error mapping, status load shedding (skip dry-run in GET)
- [x] Copy sync fields preservation (lastTemplateVersionId/Label/SyncedAt)

### Rounds 15-16: Apply Safety + Pool Contention (2026-02-12)
- [x] Apply post-read safety (no false 500 after successful apply)
- [x] Widget cache freshness, copy cleanup strictness, lock error semantics
- [x] RLS cleanup guard for pool contention, pool budget rebalance
- [x] Advisory lock + transactional initial branch, regression tests
- [x] 12 test suites, 76+ tests across all rounds
- Details: progress.md (entries from 2026-02-11 to 2026-02-12)

---

## Completed: Structure Baseline + Template Cleanup + DDL QA — 2026-02-11 ✅

### Structure Baseline + Cleanup Policy
- [x] `_mhb_widgets` baseline alignment, `CURRENT_STRUCTURE_VERSION=1`
- [x] Safe rename execution in SystemTableMigrator transaction
- [x] Template cleanup policy: `keep`/`dry_run`/`confirm` modes with blocker support
- [x] Removed starter `tags` catalog from template

### QA Rounds 3-8 (2026-02-11)
- [x] Round 3: Metahub access checks, publication delete fail-fast, kind normalization, seed layout protection
- [x] Round 4: Branch access guards, delete locking (advisory + transactional), 32-bit advisory key fix
- [x] Round 5: Shared advisory lock helpers, false structureVersion upgrade prevention, copy hardening
- [x] Round 6: Branch structureVersion alignment, TOCTOU conflict -> 409, advisory lock timeout fix
- [x] Round 7: Branch cache invalidation on activation/reset, race condition removal, codename pre-check
- [x] Round 8: MSW handlers for templates, configurable coverage thresholds, typed user extraction

### DDL Deep Fixes + Declarative DDL QA (2026-02-11)
- [x] JSONB `meta` column fix, unique migration names, SQL identifier quoting
- [x] Entity lookup by `kind`, layouts/zone widgets incremental migration, lazy manifest load
- [x] Copy route structureVersion, branch creation structureVersion, shared helper extraction
- Details: progress.md (entries from 2026-02-11)

---

## Completed: Migration Architecture + Hardened Plan/Apply — 2026-02-10/11 ✅

- [x] V1 baseline, baseline entry in `_mhb_migrations`
- [x] Decouple template seed from structure upgrades, idempotent seed migration
- [x] ALTER_COLUMN handling, migration history/plan/apply API, Migrations page
- [x] Typed migration meta contracts (baseline/structure/template_seed/manual_destructive)
- [x] Template manifest validation with cross-reference safety + structure compatibility
- [x] Seed migration dry-run planning, seed-sync events in `_mhb_migrations`
- [x] Upgraded plan/apply API: structured diffs, blockers, deterministic status codes
- [x] Branch-level template sync tracking fields
- Details: progress.md#migration-architecture

## Completed: DDL Phase 2 — FK Diff + Seed Enrichment — 2026-02-10 ✅

- [x] buildIndexSQL DRY refactor (helper extracted)
- [x] FK diff detection (ADD_FK, DROP_FK, ALTER_COLUMN) in SystemTableDiff
- [x] `_mhb_migrations` table (V2), SystemTableMigrator FK support
- [x] recordMigration method -> `_mhb_migrations` within transaction
- [x] Seed enrichment: settings (language, timezone), entities (tags catalog), elements
- [x] TemplateSeedMigrator implementation
- Details: progress.md#ddl-phase-2

## Completed: Declarative DDL & Migration Engine — 2026-02-10 ✅

- [x] SystemTableDef declarative types, shared field sets (UPL_SYSTEM_FIELDS, MHB_SYSTEM_FIELDS)
- [x] 6 V1 tables defined, SystemTableDDLGenerator
- [x] SystemTableDiff engine, SystemTableMigrator (additive auto, destructive warnings)
- [x] Layout defaults dedup. 7 phases. Build: 65/65 OK.
- Details: progress.md#declarative-ddl

## Completed: Metahub Template System — 2026-02-09/10 ✅

- [x] 10 phases: types, DB migration, entities, JSON template, seed-at-startup
- [x] Schema service refactor, backend routes, publication rename, frontend
- [x] QA Fixes: Zod VLC, default template, audit fields, transaction wrapper
- [x] Template Selector UX: chip layout, localization, edit display
- [x] QA Hardening: Atomic creation, strict VLC schema, DTO types, widgetKey narrowing
- Details: progress.md#template-system

## Completed: PR #668 Bot Review Fixes — 2026-02-09 ✅

- [x] Zod schema mismatch (menus, menu items), non-deterministic fallback
- [x] Unused imports cleanup, initial value fix
- Details: progress.md#pr-668

---

## [2026-02] Historical Completed Tasks ✅

- Menu Widget System (2026-02-09): 6 QA fixes, editor rewrite, runtime integration
- Move Menu into Layout Widget System (2026-02-08): remove menus domain, embed in widgets
- Layout Widget DnD + Edit + Zone Rendering (2026-02-08): widgetRenderer, SortableWidgetChip
- Application Runtime + DataGrid (2026-02-07): column transformers, row counts, route factory
- Layouts System Foundation (2026-02-06): backend CRUD, frontend components, zone widget management
- Details: progress.md (entries from 2026-02-06 to 2026-02-09)

## [2026-01] Historical Completed Tasks ✅

- Feb 5: Attribute data types (STRING/NUMBER/BOOLEAN/DATE/REF/JSON), display attribute, MUI 7 prep
- Jan 29 - Feb 4: Branches system, Elements rename, three-level system fields, optimistic locking
- Jan 16 - Jan 28: Publications, schema-ddl, runtime migrations, isolated schema, codename field
- Jan 11 - Jan 15: Applications modules, DDD architecture, VLC, Catalogs, i18n localized fields
- Jan 4 - Jan 10: Onboarding, legal consent, cookie banner, captcha, auth toggles
- See progress.md for detailed entries.

## [2025-12] Historical Completed Tasks ✅

- Dec 18-31: VLC system, Dynamic locales, Flowise 3.0, AgentFlow, Onboarding wizard
- Dec 5-17: Admin panel, Auth migration, UUID v7, Package extraction, Admin RBAC
- See progress.md for detailed entries.

## [Pre-2025-12] Historical Tasks ✅

- v0.40.0: Tools/Credentials/Variables extraction, Admin Instances MVP.
- v0.39.0: Campaigns, Storages modules, useMutation refactor.
- v0.38.0: Organizations, Projects, AR.js Quiz Nodes.
- v0.37.0: REST API docs (OpenAPI 3.1), Uniks metrics.
- v0.36.0: dayjs migration, publish-frontend architecture.
- v0.35.0: i18n TypeScript migration, rate limiting.
- v0.34.0: Global monorepo refactoring, tsdown build system.

---

## PLANNED TASKS

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

## TECHNICAL DEBT

- [ ] Refactor remaining useApi -> useMutation
- [ ] Standardize error handling across packages
- [ ] Add unit/E2E tests for critical flows
- [ ] Resolve Template MUI CommonJS/ESM conflict
- [ ] Database connection pooling optimization

## SECURITY TASKS

- [ ] Rate limiting for all API endpoints
- [ ] CSRF protection review
- [ ] API key rotation mechanism
- [ ] Security headers (HSTS, CSP)
- [ ] Security audit
- [ ] 2FA/MFA system

## Deferred: Layout Defaults + Menu Creation + Schema Diff (2026-02-09)

- [ ] Add second left-zone divider in default layout seeds
- [ ] Reset new menu widget defaults (empty title, auto-show off, no items)
- [ ] Prevent stale diff flash in connector schema sync dialog
