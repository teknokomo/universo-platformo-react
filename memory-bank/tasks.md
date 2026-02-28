# Tasks

> **Note**: Active and planned tasks. Completed work -> progress.md, architectural patterns -> systemPatterns.md.

## Completed: Publication Drill-In UX Polish Round 2 — 2026-02-28 ✅

> **Goal**: Fix 5 UI/UX issues found during QA of Publication drill-in pages.
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Complete — moved to progress.md

### PDUX2-1. Link colors (Publications + Applications tables)
- [x] Match catalog link style: `color: 'inherit'`, underline + primary.main on hover
- [x] Fix in PublicationList.tsx publicationColumns
- [x] Fix in PublicationApplicationList.tsx appColumns

### PDUX2-2. Actions column styling (Versions + Applications)
- [x] Remove custom "actions" column from customColumns in both components
- [x] Use FlowListTable `renderActions` prop instead (auto-creates standardized 10% width, centered column)
- [x] MoreVert button matching catalog BaseEntityMenu size

### PDUX2-3. Pagination (Versions + Applications tabs)
- [x] Add client-side pagination state (useState for page/pageSize)
- [x] Slice data for current page
- [x] Add PaginationControls below FlowListTable in both components

### PDUX2-4. Application name link URL
- [x] Fix from `/application/${slug}` to `/a/${id}` (correct route)
- [x] Open in new tab (target="_blank")

### PDUX2-5. Application menu action URLs + new tab
- [x] Fix "Open application" to `/a/${id}` in new tab via window.open()
- [x] Fix "Application dashboard" to `/a/${id}/admin` in new tab via window.open()
- [x] Removed incorrect navigate() usage

### PDUX2-6. Verification
- [x] `pnpm build`: 66/66
- [x] Update memory-bank

## Completed: Publication Drill-In UX Polish — 2026-02-28 ✅

> **Goal**: Fix 7 UI/UX issues in Publication drill-in pages (list table links, breadcrumbs, titles, table columns, search, action menus, applications tab).
> **Complexity**: Level 3 (Significant)
> **Status**: ✅ Complete — moved to progress.md

### PDUX-1. Table name as drill-in link
- [x] In PublicationList table view, make publication name a clickable link navigating into /publication/:id/versions

### PDUX-2. Breadcrumbs: show name instantly + add tab suffix
- [x] Remove UUID fallback in NavbarBreadcrumbs.tsx — show "..." while name loads
- [x] Add "Версии"/"Приложения" as final breadcrumb segment based on segments[4]
- [x] Publication name breadcrumb link should point to default versions page

### PDUX-3. Title: show only tab name, not publication name
- [x] In PublicationVersionList/PublicationApplicationList ViewHeader, show only "Версии"/"Приложения"

### PDUX-4. Versions table: remove empty Name column + fix Branch
- [x] Add render function to name column (was showing null due to FlowListTable custom columns)
- [x] Remove "Branch" column entirely
- [x] Adjust column widths and add translated actions column header

### PDUX-5. Add search field for versions and applications tabs
- [x] Add search field next to Create button in PublicationVersionList
- [x] Add search field in PublicationApplicationList

### PDUX-6. Version row actions: three-dot menu
- [x] Replace icon buttons with MoreVert three-dot menu
- [x] Menu items: Edit, Activate (for non-active), divider, Delete (red, disabled for active)
- [x] Add version DELETE backend endpoint with active version guard
- [x] Add version delete frontend API + useDeletePublicationVersion hook + confirm dialog

### PDUX-7. Applications tab fixes
- [x] Fix missing app name display (added render with Link + Typography)
- [x] Translate "Slug" column header to Russian
- [x] Fix "table.createdAt" translation key (used metahubs namespace key)
- [x] Add "Действия" column with three-dot menu: "Перейти в приложение" + "Панель управления приложения"
- [x] Make app name clickable (opens app in new tab)

### PDUX-8. i18n translations
- [x] Add missing translations in EN/RU metahubs.json (version delete, app actions, search placeholders)
- [x] Add "versions" key to menu namespace (EN/RU)

### PDUX-9. Verification
- [x] `pnpm build`: 66/66
- [x] Update memory-bank

## Completed: Publication Create Dialog & Schema Fixes — 2026-02-28 ✅

> **Goal**: Fix 3 issues found during manual testing: (1) Rework Create Publication dialog layout — move toggles above CollapsibleSection, add app name/description fields inside; (2) Fix broken schema creation during publication create (missing post-DDL operations); (3) Fix TypeError crash on publication drill-in pages.
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Implemented

### PCF-1. Fix TypeError on drill-in pages
- [x] Fix `useCommonTranslations()` destructuring in `PublicationVersionList.tsx` (line 76)
- [x] Fix `useCommonTranslations()` destructuring in `PublicationApplicationList.tsx` (line 62)

### PCF-2. Rework Create Publication dialog UI
- [x] Move "Create Application" and "Create Application Schema" toggles above CollapsibleSection
- [x] Add simplified info Alert between toggles and spoiler
- [x] Add `applicationNameVlc` and `applicationDescriptionVlc` fields inside CollapsibleSection
- [x] Update `handleCreatePublication` to extract and send custom app name/description
- [x] Update i18n EN/RU translations for `applicationWillBeCreated`

### PCF-3. Fix missing post-DDL operations in publication CREATE
- [x] Export 5 helper functions from `applicationSyncRoutes.ts`
- [x] Extend Zod schema with `applicationName`, `applicationDescription`, `applicationNamePrimaryLocale`, `applicationDescriptionPrimaryLocale`
- [x] Add post-DDL operations (syncSystemMetadata, persistPublishedLayouts, persistPublishedWidgets, syncEnumerationValues, seedPredefinedElements, persistSeedWarnings) to CREATE publication handler
- [x] Add same post-DDL operations to POST applications handler
- [x] Fix TS2322 type error (`undefined` → `null` coercion via `?? null`)

### PCF-4. Verification
- [x] `pnpm build`: **66/66**
- [x] Update memory-bank

## Completed: CollapsibleSection Export Fix — 2026-02-28 ✅

> **Goal**: Fix @flowise/core-frontend build failure (CollapsibleSection not exported from @universo/template-mui dist) and move component to proper subfolder.
> **Complexity**: Level 1 (Small)
> **Status**: ✅ Implemented

### CS-1. Move CollapsibleSection to layout subfolder
- [x] Create `components/layout/` directory
- [x] Move `CollapsibleSection.tsx` into `components/layout/`
- [x] Create `components/layout/index.ts` barrel export
- [x] Update `components/index.ts` import path (`./CollapsibleSection` → `./layout`)

### CS-2. Fix root export chain
- [x] Add `CollapsibleSection` to named exports in `src/index.ts`
- [x] Add `CollapsibleSectionProps` to type exports in `src/index.ts`

### CS-3. Verification
- [x] No consumer code changes needed (all import via `@universo/template-mui`)
- [x] `pnpm build`: **66/66** (was 64/65)
- [x] Update memory-bank

## Completed: QA Fixes Round 2 — Publication Drill-In — 2026-02-28 ✅

> **Goal**: Fix 2 issues found in second QA analysis of Publication Drill-In feature.
> **Complexity**: Level 1 (Small)
> **Status**: ✅ Implemented

### QA2-R1. Backend: appStructureVersion in DDL blocks
- [x] Import `TARGET_APP_STRUCTURE_VERSION` from `../../applications/constants`
- [x] Add `appStructureVersion: TARGET_APP_STRUCTURE_VERSION` to CREATE publication DDL success block
- [x] Add `appStructureVersion: TARGET_APP_STRUCTURE_VERSION` to POST applications DDL success block

### QA2-R2. Frontend: extract usePublicationApplications hook
- [x] Create `usePublicationApplications.ts` hook
- [x] Refactor `PublicationApplicationList.tsx` to use new hook (remove inline useQuery, useQuery import, metahubsQueryKeys import, listPublicationApplications import)
- [x] Add re-export in hooks/index.ts

### QA2-R3. Verification
- [x] Lint: 0 errors (metahubs-backend, metahubs-frontend)
- [x] Build: 66/66 (after CollapsibleSection export fix)
- [x] Update memory-bank

## Completed: QA Remediation Round 10 — Copy UX & Stability Fixes — 2026-02-27 ✅

> **Goal**: Fix confirmed QA findings from comprehensive PR #696 audit: child attribute copy sends incomplete data, stale useMemo, double error notification, Russian i18n fallbacks, copy menu not disabled at maxRows.
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Implemented

### Q10-R1. Backend: extend copyAttributeSchema to accept overrides
- [x] Add `validationRules`, `uiConfig`, `isRequired` optional fields to `copyAttributeSchema`
- [x] Apply overrides from request body in the copy route handler (fallback to source values)

### Q10-R2. Frontend: child attribute copy sends all edited fields
- [x] Update `handleCopy` in ChildAttributeList.tsx to include validationRules, uiConfig, isRequired in the copy payload

### Q10-R3. Frontend: fix childColumns useMemo missing dependency
- [x] Add `childAttributeMap` to the dependency array of `childColumns` useMemo in ChildAttributeList.tsx

### Q10-R4. Frontend: remove double error notification on copy failure
- [x] Remove `notifyError(t, enqueueSnackbar, error)` from handleCopy catch block in ChildAttributeList.tsx (keep only dialog error)

### Q10-R5. Frontend: fix Russian i18n fallbacks to English
- [x] Replace Russian default strings with English in copy dialog titles (AttributeActions, ChildAttributeList, EnumerationValueList, BranchList — 11 strings total)

### Q10-R6. Frontend: disable copy menu when maxRows reached
- [x] Add `disabled` prop to copy MenuItem in RuntimeInlineTabularEditor.tsx when `effectiveRows.length >= maxRows`

### Q10-R7. Verification and bookkeeping
- [x] Build all affected packages (metahubs-backend, metahubs-frontend, apps-template-mui)
- [x] Update memory-bank progress

## In Progress: PR #696 Bot Review Fixes — 2026-02-27 🚧

> **Goal**: Address valid bot review comments on PR #696 (copy-attributes-elements-values-runtime-rows). Remove legacy migration code, add ROLLBACK error logging.
> **Complexity**: Level 1 (Small)
> **Status**: ✅ Implemented

### PRF-R1. SchemaGenerator legacy migration removal
- [x] Remove backward-compat ELSE branch (sort_order, parent_attribute_id column migration)
- [x] Remove DROP CONSTRAINT for legacy `_app_attributes_object_id_codename_unique`
- [x] Move partial unique indexes into CREATE TABLE block (IF NOT EXISTS)

### PRF-R2. Application ROLLBACK error logging
- [x] Replace all `.catch(() => {})` on ROLLBACK queries with error logging (15 instances)

### PRF-R3. Rejected bot comments (no action needed)
- [x] isDisplayAttribute=false on copy: correct behavior (display attr is exclusive per object)
- [x] useEffect auto-isRequired: intentional business logic (display attr must be required)
- [x] STRING_DEFAULT_MAX_LENGTH=10: pre-existing intentional default in 3+ files

### PRF-R4. Verification and push
- [x] Build affected packages to verify no regressions
- [x] Commit and push to PR branch

## In Progress: IMPLEMENT Follow-up — Copy UX Simplification & Stability — 2026-02-27 🚧

> **Goal**: Finalize the requested simplifications for copy dialogs/flows in applications and metahubs, ensure display-attribute propagation integrity, and close UX/localization defects without keeping legacy copy-option logic.
> **Complexity**: Level 3 (Significant)
> **Status**: ✅ Implemented

### IFU-R1. App runtime + metahub elements copy dialog simplification
- [x] Keep copy via standard entity form dialog (create/edit-style) without copy-options tab for app runtime elements
- [x] Keep copy via standard entity form dialog (create/edit-style) without copy-options tab for metahub catalog elements
- [x] Preserve auto-suffix behavior for first STRING field only (` (copy)` / ` (копия)`)

### IFU-R2. Attribute copy UX simplification
- [x] Ensure copy dialog always shows correct data type and matching type-settings block for source attribute
- [x] Keep `Presentation` tab in copy and force `isDisplayAttribute = false` (disabled), preserving other presentation settings
- [x] Keep `Options` tab only for `TABLE` attributes with single `copyChildAttributes` toggle; remove legacy options logic

### IFU-R3. Enumeration values + defaults + i18n
- [x] Keep enumeration-value copy dialog aligned to edit form (no options tab), with copied name suffix
- [x] Set default STRING `maxLength` to `10` for both root and child attribute create flows
- [x] Localize enumeration-value delete confirmation body in RU/EN and remove hardcoded EN fallback usage

### IFU-R4. Publication snapshot / application sync integrity and verification
- [x] Verify that display-attribute marker is propagated through publication snapshot/version to application runtime metadata
- [x] Run targeted lint/tests for touched packages and close residual compile/runtime regressions
- [x] Update checklist and progress notes after validation

## In Progress: Implement Round — Metahub/Application Entity Copy Expansion — 2026-02-27 🚧

> **Goal**: Implement full copy expansion scope from `memory-bank/plan/metahub-entity-copy-plan-2026-02-26.md` safely and with existing architecture patterns.
> **Complexity**: Level 4 (Complex)
> **Status**: ✅ Implemented

### IMPL-R1. Shared contracts and codename scope foundation
- [x] Extend shared copy options in `@universo/types` and normalizers in `@universo/utils` for attribute/element/enumeration-value copy
- [x] Implement scoped attribute codename uniqueness (root vs child scope) in metahub system table definitions and attribute checks/routes

### IMPL-R2. Metahub copy flows
- [x] Implement attribute copy endpoint + frontend action/dialog (root + child attributes, table-children option)
- [x] Implement metahub element copy endpoint + frontend action/dialog with `copyChildTables` and required-table lock behavior
- [x] Implement metahub child-table row copy in `InlineTableEditor` menu (UI-local clone below source row)
- [x] Implement enumeration value copy endpoint + frontend action/dialog with presentation-settings option

### IMPL-R3. Applications runtime copy flows and terminology
- [x] Implement runtime row copy endpoint + frontend row action/dialog with `copyChildTables` option and required-table lock behavior
- [x] Implement runtime tabular child-row copy endpoint + UI action in `RuntimeInlineTabularEditor`
- [x] Replace runtime user-facing terminology `record` -> `element` in dialogs/labels/i18n

### IMPL-R4. Edit dialog delete-button standardization and enum first-open fix
- [x] Add standard delete button in edit dialogs for layout, publication, child attributes, enumeration values (disabled where delete is forbidden)
- [x] Fix enumeration value first-open empty edit form issue (stable key/state reset pattern)

### IMPL-R5. Verification and bookkeeping
- [x] Add/update targeted backend/frontend tests for new copy flows and regressions
- [x] Run targeted lint and tests for touched packages
- [x] Update `memory-bank/progress.md` and mark all implementation tasks as done

## In Progress: QA Remediation Round 9 — Copy Type-Safety & Evidence — 2026-02-27 🚧

> **Goal**: Resolve remaining confirmed QA issues in metahub entity copy implementation: actionable backend typing defects and insufficient evidence depth in copy-route tests.
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Implemented

### Q9-R1. Backend typing hardening in changed copy files
- [x] Remove remaining `no-explicit-any` usages in changed copy-related backend route files without behavior changes
- [x] Replace unsafe `unknown`/generic row plumbing in copy response mapping with explicit local row/value types

### Q9-R2. Copy-flow route evidence hardening
- [x] Extend backend route tests with focused deterministic assertions for copy option forwarding and response payload shape
- [x] Keep tests aligned with existing transaction mock strategy (no architecture rewrite)

### Q9-R3. Verification and bookkeeping
- [x] Run targeted backend tests, build, and lint for touched files/packages
- [x] Mark this checklist done and append implementation note to `memory-bank/progress.md`

## In Progress: QA Remediation Round 5 — Metahub Entity Copy Hardening — 2026-02-26 🚧

> **Goal**: Fix QA findings for metahub entity copy implementation (security consistency, deterministic API behavior, concurrency safety, and test coverage).
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Implemented

### Q5-R1. Backend copy-route access and existence checks
- [x] Add explicit metahub access checks for hub/catalog/enumeration copy routes
- [x] Add explicit metahub existence checks in catalog/enumeration copy routes to keep deterministic 404 behavior

### Q5-R2. Hub copy relation propagation concurrency safety
- [x] Harden relation propagation update path against stale read/write conflicts during hub copy

### Q5-R3. Test coverage gap closure (copy flows)
- [x] Add backend route tests for copy-route validation/access edge cases (hubs/catalogs/enumerations/layouts)
- [x] Add frontend tests for copy option payload normalization (hubs/catalogs/enumerations)
- [x] Add frontend test coverage for layout copy flow entry (menu/dialog invocation)

### Q5-R4. Verification and bookkeeping
- [x] Run targeted tests/lint for touched packages
- [x] Mark checklist done and append progress entry

## In Progress: QA Remediation Round 6 — Metahub Entity Copy Reliability — 2026-02-26 🚧

> **Goal**: Fix all confirmed QA issues from the latest audit for metahub entity copy flows with safe, bounded behavior and stronger route-level evidence.
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Implemented

### Q6-R1. Hub copy bounded retry behavior
- [x] Remove unbounded retry behavior on hub relation concurrent-update conflicts and keep deterministic bounded outcome
- [x] Add focused regression test coverage for successful hub copy route execution path

### Q6-R2. Copy route test hardening for remaining entities
- [x] Extend copy-route tests beyond access-only checks for catalogs/enumerations/layouts with deterministic validation or success-path assertions

### Q6-R3. Verification and bookkeeping
- [x] Run targeted backend/frontend tests for touched copy-flow files
- [x] Run targeted lint checks for touched files and ensure no new lint errors
- [x] Mark checklist done and append progress entry

## In Progress: QA Remediation Round 7 — Metahub Entity Copy Cleanup — 2026-02-26 🚧

> **Goal**: Apply the remaining confirmed implementation fix from QA follow-up and keep copy-flow codebase lint-clean regarding real actionable issues.
> **Complexity**: Level 1 (Small)
> **Status**: ✅ Implemented

### Q7-R1. Frontend actionable lint defect cleanup
- [x] Remove unused `searchValue` state binding in `HubList` search hook wiring to eliminate stale variable and keep intent explicit

### Q7-R2. Verification and bookkeeping
- [x] Run targeted frontend tests for metahub copy action payloads and action descriptors
- [x] Run targeted eslint for touched file and confirm no new errors
- [x] Record completion in `memory-bank/progress.md`

## In Progress: QA Remediation Round 8 — Metahub Entity Copy Completion — 2026-02-26 🚧

> **Goal**: Close remaining QA gaps for metahub entity copy implementation: test-completeness and actionable lint cleanup in changed copy files.
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Implemented

### Q8-R1. Backend copy test completeness
- [x] Add missing copy happy-path tests for catalogs/enumerations/layouts routes
- [x] Add missing copy codename-conflict retry/409 tests where applicable
- [x] Add focused constraint-path test for hub relation copy (`isSingleHub` conflict code)

### Q8-R2. Copy-file lint cleanup (no-explicit-any)
- [x] Remove `no-explicit-any` usages in changed copy-focused frontend files without behavior changes
- [x] Remove `no-explicit-any` usages in changed copy-focused backend files/tests without behavior changes

### Q8-R3. Completion bookkeeping
- [x] Run targeted backend/frontend copy tests
- [x] Run targeted eslint for changed copy files and confirm no new errors
- [x] Update `memory-bank/progress.md` with final remediation summary

## In Progress: Metahub Entity Copy — Hubs/Catalogs/Enumerations/Layouts — 2026-02-26 🚧

> **Goal**: Implement copy flows for metahub entities per `memory-bank/plan/metahub-entity-copy-plan-2026-02-26.md` using existing architecture patterns and safe transactional backend behavior.
> **Complexity**: Level 3 (Significant)
> **Status**: 🚧 In implementation

### MHEC-R1. Shared copy contracts and normalizers
- [x] Extend `@universo/types` copy options with hub/catalog/enumeration/layout options + defaults and keys
- [x] Extend `@universo/utils` copy-options normalization and exports for new option groups

### MHEC-R2. Backend copy endpoints and core algorithms
- [ ] Add `POST /metahub/:metahubId/hub/:hubId/copy` with options validation and relation-copy safety checks
- [ ] Add canonical `POST /metahub/:metahubId/catalog/:catalogId/copy` with attribute/element cloning and FK-safe remapping
- [ ] Add canonical `POST /metahub/:metahubId/enumeration/:enumerationId/copy` with optional values cloning
- [ ] Add `POST /metahub/:metahubId/layout/:layoutId/copy` with optional widgets cloning and default-safe layout creation

### MHEC-R3. Frontend APIs, mutations, actions, and dialogs
- [ ] Add copy API wrappers and mutation hooks for hubs/catalogs/enumerations/layouts with proper query invalidation
- [ ] Add copy actions below edit for hubs/catalogs/enumerations via existing `BaseEntityMenu` descriptor pattern
- [ ] Add copy action in layouts custom menu and implement copy dialog with `General`/`Options` tabs
- [ ] Implement option-state behavior (master/child sync and dependencies) without introducing new generic UI frameworks
- [ ] Keep copy dialog spacing and field layout consistent with existing edit/copy dialogs

### MHEC-R4. i18n and validation/error texts
- [ ] Add RU/EN i18n keys for all new copy dialogs/options/actions/validation messages under existing namespaces

### MHEC-R5. Tests, lint, and bookkeeping
- [ ] Update/add frontend tests for action descriptors and copy options payload behavior
- [ ] Update/add backend route tests for new copy endpoints and validation edge cases
- [ ] Run targeted tests and lint for touched packages
- [ ] Mark all checklist items complete and append implementation summary to `memory-bank/progress.md`

## In Progress: PR #692 Bot Review Remediation — 2026-02-26 🚧

> **Goal**: Validate bot review recommendations from PR #692 and apply only proven, safe fixes without functional regressions.
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Implemented

### PR692-R1. Branch frontend duplication cleanup
- [x] Extract duplicated branch copy-option state helpers from `BranchList.tsx` and `BranchActions.tsx` into a shared domain utility
- [x] Extract branch copy compatibility error-code resolver into the same shared utility and reuse it in both UI and hooks

### PR692-R2. Backend DB error helper deduplication
- [x] Extract common DB error helper functions (`getDbErrorCode`, `getDbErrorConstraint`, `getDbErrorDetail`, `isUniqueViolation`, `isSlugUniqueViolation`) into shared `@universo/utils`
- [x] Replace duplicated local implementations in applications/branches routes with shared imports

### PR692-R3. Verification and bookkeeping
- [x] Run targeted tests for changed frontend/backend files
- [x] Run package-level lint for touched packages (warnings acceptable, no new errors)
- [x] Mark tasks done and append progress entry

## In Progress: QA Remediation Round 4 — Copy Flows Final Hardening — 2026-02-26 🚧

> **Goal**: Fix residual correctness gaps from the latest QA review without introducing regressions in existing copy flows.
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Implemented

### Q4-R1. Application copy `createSchema` server-side contract alignment
- [x] Align copy API contract so backend copy endpoint handles only copy-state options (`copyConnector`, `copyAccess`) and ignores legacy `createSchema` payload
- [x] Keep deterministic schema creation orchestration in frontend (`copy -> sync`) and adjust API/backend tests for contract behavior

### Q4-R2. Branch create dialog error mapping completeness
- [x] Map branch copy compatibility 400 codes to stable i18n messages in create dialog
- [x] Keep fallback handling backward-safe for unexpected backend error payloads

### Q4-R3. Verification and bookkeeping
- [x] Run targeted tests/lint for changed packages
- [x] Mark checklist done and append progress entry

## In Progress: QA Remediation Round 3 — Copy Flows Stabilization — 2026-02-26 🚧

> **Goal**: Close remaining QA findings for copy flows and apply UI/logic adjustments requested after manual review.
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Implemented

### Q3-R1. Application copy: UI spacing + race-safe slug behavior
- [x] Restore standard vertical spacing before description field in application copy dialog ("General" tab)
- [x] Harden backend copy endpoint against concurrent slug collisions with deterministic conflict handling

### Q3-R2. Branch copy: mandatory migrations + option model cleanup
- [x] Remove `copyMigrations` option from branch copy UI, shared types, and backend validation
- [x] Force migrations to always copy during branch clone and keep selective copy for other entities only
- [x] Align branch copy tests (frontend/backend) with new mandatory-migrations behavior

### Q3-R3. Branch copy errors: deterministic i18n mapping
- [x] Add stable frontend error mapping for structured branch copy compatibility codes
- [x] Keep backward-safe fallback for legacy string-based backend messages

### Q3-R4. Verification and bookkeeping
- [x] Run targeted tests and package-level lint for changed packages
- [x] Mark checklist done and append progress entry

## In Progress: Copying UX/Logic Upgrade — Metahubs, Applications, Branches — 2026-02-26 🚧

> **Goal**: Implement approved plan from `memory-bank/plan/copy-improvements-plan-2026-02-26.md` with QA addendum corrections.
> **Complexity**: Level 3 (Significant)
> **Status**: ✅ Implemented (awaiting dedicated QA pass)

## In Progress: QA Remediation Round 2 — Copying Reliability Hardening — 2026-02-26 🚧

> **Goal**: Close all remaining QA findings for copy flows with focus on data integrity and deterministic API behavior.
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Implemented

### Q2-R1. Application copy slug collision resilience
- [x] Remove UI-blocking slug conflicts for repeated copy operations when source has slug
- [x] Add backend test for automatic unique slug resolution in copy flow

### Q2-R2. Branch partial-copy data integrity
- [x] Eliminate dangling `config.hubs` references when hubs are excluded from branch copy
- [x] Keep branch copy compatibility guard deterministic for attribute target references
- [x] Add backend test coverage for hub-reference cleanup on partial copy

### Q2-R3. Deterministic error contract plumbing
- [x] Replace fragile string-matching branch-copy error mapping with structured error codes (with backward-safe fallback)
- [x] Keep HTTP response contract unchanged for existing frontend behavior

### Q2-R4. Frontend test coverage gap
- [x] Add branch create-flow test to assert options payload forwarding (`fullCopy` and child flags)

### Q2-R5. Verification and bookkeeping
- [x] Run targeted tests and lint for changed packages
- [x] Mark checklist done and append progress entry

### A. Metahub copy dialog
- [x] Rename metahub copy tab label from "Copy options" / "Опции копирования" to "Options" / "Опции" (i18n + usage checks)

### B. Application copy dialog + backend contract
- [x] Extend application copy payload with `copyConnector`, `createSchema`, `copyAccess` and conditional validation
- [x] Implement tabbed copy dialog in applications frontend: "General" + "Options"
- [x] Add options behavior: `copyConnector` default true, `createSchema` default false, disable+reset createSchema when copyConnector=false, `copyAccess` moved to options
- [x] Update applications backend copy route: no runtime schema clone, conditional connector copy, safe schema metadata reset
- [x] Implement copy->sync orchestration in `useCopyApplication` when `createSchema=true` with non-destructive failure handling
- [x] Update application i18n keys (ru/en) and adjust API/hooks/page tests

### C. Branch copy options (metahub branches)
- [x] Add branch copy options payload and frontend state machine (`fullCopy`, `copyLayouts`, `copyHubs`, `copyCatalogs`, `copyEnumerations`, `copyMigrations`)
- [x] Add "Options" tab to branch copy entry points and ensure parity for both flows (copy action + create-from-source)
- [x] Extend backend branch create validation schema with copy options and dependency rules
- [x] Implement selective prune in `MetahubBranchesService.createBranch` after clone inside single transaction context
- [x] Add backend/frontend tests for branch copy options and validation error cases
- [x] Update metahubs i18n keys (ru/en) for branch options UI

### D. Verification and bookkeeping
- [x] Run targeted tests/lint for changed packages
- [x] Mark completed checklist items and add implementation entry to `memory-bank/progress.md`

## Completed: QA Remediation — Copying UX/Logic Upgrade — 2026-02-26 ✅

> **Goal**: Fix all QA findings from the latest audit and close remaining reliability gaps in copy flows.
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Implemented

### R1. Application copy partial-success consistency
- [x] Ensure `copy -> sync` partial failure still refreshes application list cache so created copies are visible
- [x] Add frontend hook test for `copy created + sync failed` behavior (error message + cache refresh)

### R2. Branch copy safety checks
- [x] Extend backend compatibility checks to prevent dangling references for non-enumeration partial-copy combinations
- [x] Map new backend incompatibility error to deterministic HTTP 400 contract
- [x] Add/extend backend tests for new incompatibility branch-copy response

### R3. i18n parity and frontend tests
- [x] Fix EN metahub copy tab label (`copy.optionsTab`) to `Options`
- [x] Add frontend branch copy action test for options payload/state behavior

### R4. Lint quality gate
- [x] Fix current `@universo/metahubs-frontend` lint errors (prettier violations) that block the package lint command
- [x] Re-run targeted tests/lints for changed packages and record results

## Completed: NUMBER field parity — catalog inline table NumberTableCell — 2026-02-26 ✅

> **Goal**: Replicate correct standalone NUMBER field behavior from DynamicEntityFormDialog into all 3 other NUMBER field contexts: (1) catalog inline table, (2) app standalone NUMBER (FormDialog), (3) app inline table (NumberEditCell via DataGrid).
> **Complexity**: Level 2 (Moderate) — 1 file modified (DynamicEntityFormDialog.tsx). FormDialog and NumberEditCell were already correct.
> **Status**: ✅ Fully implemented — 2026-02-26

### Analysis & Comparison
- [x] Studied reference implementation: DynamicEntityFormDialog standalone NUMBER field
- [x] Compared FormDialog standalone NUMBER — already matches reference (identical code)
- [x] Compared NumberEditCell (tabularColumns.tsx) — already matches reference behavior
- [x] Found gap: DynamicEntityFormDialog TABLE case uses basic TextField for NUMBER cells (no formatting, no steppers, no zone selection, DOT instead of comma)

### Fix: DynamicEntityFormDialog inline table NUMBER cells
- [x] Created `NumberTableCell` component (~200 lines) in DynamicEntityFormDialog.tsx
  - Formatted display with locale-aware decimal separator (comma for 'ru')
  - Zone-based selection (integer vs decimal part) on focus/click
  - Zone-aware ArrowUp/ArrowDown stepping
  - Stepper buttons (▲▼) with doStep
  - Full keyDown handling: blocks "-" for nonNegative, protects decimal separator, digit replacement in decimal zone
  - Compact sizing for table cells (fontSize: 13, small stepper buttons)
- [x] Replaced simple TextField in TABLE case childFieldDefs.map with conditional rendering: NumberTableCell for NUMBER, TextField for other types

### Verification
- [x] TypeScript: 0 errors
- [x] Full build (`pnpm build`) — 66/66 SUCCESS

## Completed: Zone-aware NUMBER stepper + inline table parity — 2026-02-26 ✅

> **Goal**: (1) Zone-aware ArrowUp/ArrowDown stepping in DynamicEntityFormDialog, FormDialog, and inline table; (2) Full NumberEditCell rewrite for inline table parity with standalone NUMBER field (stepper buttons, formatted display, zone selection).
> **Complexity**: Level 3 (Complex) — 5 files across 3 packages
> **Status**: ✅ Fully implemented — 2026-02-26

### P1: Zone-aware stepping in DynamicEntityFormDialog (catalog predefined records)
- [x] Added `numberInputRefsRef` + `numberCursorZoneRef` useRefs for per-field tracking
- [x] `selectNumberPart` now sets `numberCursorZoneRef.current.set(field.id, zone)`
- [x] ArrowUp/ArrowDown in `handleNumberKeyDown` detect zone from cursor position relative to separator
- [x] `getStepValue(zone)` returns 1 for integer zone, 10^(-scale) for decimal zone
- [x] `inputRef` callback added to TextField for tracking input elements
- [x] Stepper button onClick wrapped: `() => handleStepUp()` to prevent MouseEvent as zone arg

### P2: Zone-aware stepping in FormDialog (app record creation)
- [x] Same 6-point pattern as P1 applied to FormDialog.tsx

### P3: Full NumberEditCell rewrite for inline table parity
- [x] Complete rewrite of NumberEditCell (~250 lines) with InputBase + InputAdornment
- [x] Formatted display with locale-aware decimal separator (comma for 'ru', dot for 'en')
- [x] Zone-based selection (integer vs decimal part) on focus/click
- [x] Zone-aware ArrowUp/ArrowDown stepping
- [x] Stepper buttons (▲▼) with zone-aware doStep
- [x] Full keyDown handling: blocks "-" for nonNegative, protects decimal separator, digit replacement in decimal zone
- [x] handleBlur re-formatting

### P4: Wiring locale through buildTabularColumns
- [x] `BuildTabularColumnsOptions` interface: added `locale?: string`
- [x] `buildTabularColumns` function: added `locale = 'en'` to destructuring
- [x] NUMBER colDef `renderEditCell`: passes `locale` and `validationRules` to NumberEditCell
- [x] NUMBER colDef `renderCell`: custom formatter with locale-aware decimal separator
- [x] `MouseEvent` → `ReactMouseEvent` fix in interface
- [x] TabularPartEditor.tsx: added `locale: resolvedLocale` to buildTabularColumns call
- [x] RuntimeInlineTabularEditor.tsx: added `locale: resolvedLocale` to buildTabularColumns call

### Verification
- [x] TypeScript: 0 errors across all 5 modified files
- [x] Full build (`pnpm build`) — 66/66 SUCCESS

## Completed: Fix inline table nonNegative + number alignment — 2026-02-26 ✅

> **Goal**: Fix two bugs in inline table (child table) NUMBER cells: (1) nonNegative validation not blocking "-" or native spinner buttons, (2) negative numbers displayed left-aligned instead of right.
> **Complexity**: Level 2 (Moderate) — 3 files changed, new NumberEditCell component
> **Status**: ✅ Fully implemented — 2026-02-26

### P1: nonNegative not enforced in inline table cells
- [x] tabularColumns.tsx: Create `NumberEditCell` component with custom text input replacing native `<input type="number">`
  - Blocks "-" key via `onKeyDown` + `preventDefault()` when nonNegative
  - Validates input pattern (`onChange`) to enforce precision/scale/nonNegative rules
  - Uses `type='text'` input to eliminate native browser spinner buttons that bypass validation
  - Preserves `preProcessEditCellProps` for min/max range validation
- [x] tabularColumns.tsx: Add `renderEditCell` to NUMBER colDef using `NumberEditCell`

### P2: Number alignment in inline table cells
- [x] tabularColumns.tsx: Add explicit `align: 'right'` and `headerAlign: 'right'` to NUMBER colDef
- [x] NumberEditCell: Input text right-aligned via `sx={{ textAlign: 'right' }}`
- [x] TabularPartEditor.tsx: Add `'& .MuiDataGrid-cell--textRight': { justifyContent: 'flex-end' }` to fix flexbox overriding text-align
- [x] RuntimeInlineTabularEditor.tsx: Same CSS alignment fix

### Verification
- [x] TypeScript: 0 errors in all 3 modified files
- [x] Full build (`pnpm build`) — 66/66 SUCCESS

## Completed: QA Round-8 — toNumberRules consistency + FormDialog precision validation — 2026-02-25 ✅

> **Goal**: Fix 4 LOW issues from QA Round-8 comprehensive analysis. Apply `toNumberRules()` consistently across all files, add precision/scale validation to FormDialog `getFieldError`.
> **Complexity**: Level 1 (Simple) — 4 source files + 2 i18n files
> **Status**: ✅ Fully implemented — 2026-02-25

### L1: InlineTableEditor validateNumberField → toNumberRules
- [x] InlineTableEditor.tsx: Import `toNumberRules`, replace 5-line inline param building with `toNumberRules(rules)` call

### L2: tabularColumns preProcessEditCellProps → toNumberRules
- [x] tabularColumns.tsx: Import `toNumberRules`, replace inline param building with `toNumberRules(field.validationRules)` call

### L3: FormDialog getFieldError missing precision/scale validation
- [x] FormDialog.tsx: Import `toNumberRules`, replace inline nonNegative/min/max checks in `getFieldError` NUMBER case with `validateNumber(value, toNumberRules(rules))` + `errorKey` switch mapping
- [x] apps.json (en+ru): Add `validation.numberPrecisionExceeded` and `validation.invalidNumber` keys

### L4: FormDialog handleStepUp/handleStepDown inline param building
- [x] FormDialog.tsx: Extract `numberRules = toNumberRules(rules)` before steppers, use in both `handleStepUp` and `handleStepDown`

### Verification
- [x] Full build (`pnpm build`) — 66/66 SUCCESS
- [x] i18n key parity — EN/RU match perfectly

## Completed: QA Round-7 — Code Quality Fixes (processRowUpdate, Edit disabled, dead code, toNumberRules) — 2026-02-25 ✅

> **Goal**: Fix 2 MEDIUM + 3 LOW issues from QA analysis of Round-6: (M1) processRowUpdate returns unvalidated row, (M2) Edit menu not disabled when no editable fields, (L1) dead code in tableConstraints, (L2) dead min:0 inputProp, (L3) duplicated validateNumber parameter building.
> **Complexity**: Level 2 (Moderate) — 8 files across 4 packages + new utility function
> **Status**: ✅ Fully implemented — 2026-02-25

### M1: TabularPartEditor processRowUpdate return value
- [x] TabularPartEditor.tsx: Return `correctedRow` (copy of `newRow` with reverted NUMBER values) instead of original `newRow`

### M2: InlineTableEditor Edit menu disabled
- [x] InlineTableEditor.tsx: Add `firstEditableFieldId` useMemo, use in `handleEditRowFromMenu`, add `disabled={!firstEditableFieldId}` to Edit MenuItem

### L1: Dead code in tableConstraints.ts
- [x] tableConstraints.ts: Remove duplicate `effectiveMin` variable (identical to `minRequired`), remove unreachable `else if (required)` branch

### L2: Dead min:0 in DynamicEntityFormDialog
- [x] DynamicEntityFormDialog.tsx: Remove `...(child.type === 'NUMBER' && child.validationRules?.nonNegative ? { min: 0 } : {})` — `type='text'` ignores HTML min attribute

### L3: Duplicated validateNumber parameter building
- [x] numberValidation.ts: Add `toNumberRules<T extends object>()` helper to extract NUMBER rules from generic objects
- [x] validation/index.ts, index.ts, index.browser.ts: Export `toNumberRules`
- [x] TabularPartEditor.tsx: Replace inline param building with `toNumberRules(field.validationRules)`
- [x] RuntimeInlineTabularEditor.tsx: Replace in both deferred and API modes
- [x] DynamicEntityFormDialog.tsx: Replace in `handleTableCellChange`

### Verification
- [x] Full build (`pnpm build`) — 66/66 SUCCESS

## Completed: QA Round-6 — Negative Numbers, Constraint Text, Spacing, 3-Dot Menu — 2026-02-25 ✅

> **Goal**: Fix 4 issues from user screenshots: (1) negative numbers in nonNegative NUMBER table cells, (2) constraint text format inconsistency, (3) constraint spacing too large in app, (4) plain delete icon → 3-dot menu with Edit/Delete + confirmation in InlineTableEditor.
> **Complexity**: Level 2 (Moderate) — 8 files across 4 packages
> **Status**: ✅ Fully implemented — 2026-02-25

### Issue 1: Negative numbers in nonNegative NUMBER table cells
- [x] DynamicEntityFormDialog.tsx: Validate NUMBER child fields via `validateNumber()` in `handleTableCellChange`; block '-' key for nonNegative; add `min: 0` inputProp
- [x] TabularPartEditor.tsx: Validate NUMBER fields in `processRowUpdate`, revert to `oldRow[field.id]` on failure
- [x] RuntimeInlineTabularEditor.tsx: Same `processRowUpdate` validation in both `deferPersistence` and API modes

### Issue 2: Constraint text format
- [x] tableConstraints.ts: Rewrite `buildTableConstraintText()` with new format — "Required: min. rows: X, max. rows: Y"
- [x] metahubs.json (en+ru): Replace `tableRequiredMin`/`tableRequired` with `tableRequiredPrefix`, update `tableMinRows`/`tableMaxRows` to lowercase
- [x] apps.json (en+ru): Same key replacements

### Issue 3: Constraint spacing in app
- [x] TabularPartEditor.tsx: Remove `mb: 2` from outer Box
- [x] RuntimeInlineTabularEditor.tsx: Remove `mb: 2` from outer Box

### Issue 4: 3-dot menu for InlineTableEditor
- [x] Add imports: `MoreVertRoundedIcon`, `EditIcon`, `Menu`, `Divider`, `ConfirmDeleteDialog`
- [x] Add state: `menuAnchorEl`, `menuRowId`, `deleteRowId`
- [x] Add handlers: `handleOpenRowMenu`, `handleCloseRowMenu`, `handleEditRowFromMenu`, `handleDeleteRowFromMenu`, `handleConfirmDelete`, `handleCancelDelete`
- [x] Replace per-row DeleteIcon with MoreVertRoundedIcon button + Menu (Edit + Divider + Delete)
- [x] Add ConfirmDeleteDialog for delete confirmation
- [x] Add MoreVertRoundedIcon to header column
- [x] Add 6 i18n keys to metahubs.json (en+ru): edit, delete, actions, deleteTitle, deleteDescription, cancel

### Verification
- [x] Full build (`pnpm build`) — 66/66 SUCCESS

## Completed: QA Round-5 — Runtime Bug Fixes (TypeError, deleteDisabled, i18n) — 2026-02-25 ✅

> **Goal**: Fix 3 runtime bugs found during QA verification: (1) non-internationalized English texts in element/app dialogs, (2) delete button blocked by minRows at row level instead of submit level, (3) TypeError in selectNumberPart from stale rAF target. Plus dead code removal.
> **Complexity**: Level 2 (Moderate) — 11 files across 5 packages
> **Status**: ✅ Fully implemented — 2026-02-25

### Bug 1: TypeError "Cannot read properties of undefined (reading 'length')"
- [x] DynamicEntityFormDialog.tsx: Add guard `if (!target || target.value == null) return` at start of `selectNumberPart`
- [x] FormDialog.tsx: Same guard added

### Bug 2: Delete button blocked by minRows at row level
- [x] InlineTableEditor.tsx: Remove `deleteDisabled` variable, remove `disabled` from delete button, remove minRows guard from `handleDeleteRow`
- [x] RuntimeInlineTabularEditor.tsx: Remove `deleteDisabled`, remove `disabled` from menu item
- [x] TabularPartEditor.tsx: Remove `deleteDisabled`, remove `disabled` from menu item, remove minRows guard from `handleDeleteRow`

### Bug 3: Non-internationalized English texts (i18n)
- [x] DynamicEntityFormDialog.tsx: Add `i18nNamespace` prop, use `useTranslation(i18nNamespace)`
- [x] DynamicEntityFormDialog.tsx: Standardize key names — `lengthRange`→`lengthBetween`, `dateTimeFormat`→`datetimeFormat`, `numberLength2`→`numberLengthWithScale`, params `{int,dec}`→`{integer,scale}`
- [x] DynamicEntityFormDialog.tsx: Rename `table.addRow`→`tableField.addRow`, `table.noRowsYet`→`tableField.noRowsYet` (avoid conflict with `metahubs.table`)
- [x] ElementList.tsx: Pass `i18nNamespace='metahubs'` to both DynamicEntityFormDialog instances
- [x] metahubs.json (en+ru): Add `validation.*` (22 keys), `number.*` (2 keys), `tableField.*` (2 keys) to `metahubs` object
- [x] apps.json (en+ru): Add `validation.tableRequiredMin/tableRequired/tableMinRows/tableMaxRows`, `number.increment/decrement`

### Dead code cleanup
- [x] ChildAttributeList.tsx: Remove `tableCannotBeRequired` error mapping (backend no longer returns this error since TABLE isRequired is allowed)
- [x] metahubs.json (en+ru): Remove `tableValidation.tableCannotBeRequired` key

### Verification
- [x] Full build (`pnpm build`) — 66/66 SUCCESS

## Completed: QA Round-4 — D1+H1+M1-M7+L1-L2 Comprehensive Fixes — 2026-02-27 ✅

> **Goal**: Fix ALL findings from comprehensive QA analysis: refactor TABLE required to standard isRequired, add backend TABLE validation, stepper precision, keyboard navigation, ARIA localization, error tooltips, i18n standardization, constraint text deduplication, TABLE cell type+alignment fixes.
> **Complexity**: Level 3 (Significant) — 10 files across 5 packages + new shared utility
> **Status**: ✅ Fully implemented — 2026-02-27

### D1 (CRITICAL): Refactor TABLE required — `requiredFilling` → standard `isRequired`
- [x] Backend: Remove `requiredFilling` from uiConfigSchema in attributesRoutes.ts
- [x] Backend: Unblock TABLE type for `isRequired` in create/update/toggle-required handlers
- [x] Backend: Add TABLE-specific `hasRequiredValue` in MetahubElementsService.ts (checks Array.isArray + minRows)
- [x] Frontend: Remove `dataType !== 'TABLE'` guard from isRequired toggle in AttributeFormFields.tsx
- [x] Frontend: Remove entire `requiredFilling` toggle from Presentation tab
- [x] Frontend: Remove TABLE exclusion from set-required context menu in AttributeActions.tsx
- [x] Frontend: Remove `tableRequiredFilling` from ElementList.tsx, pass `required` to InlineTableEditor
- [x] Frontend: Rename `requiredFilling` prop → `required` in InlineTableEditor.tsx
- [x] Frontend: Remove `tableRequiredFilling` from DynamicFieldConfig in DynamicEntityFormDialog.tsx
- [x] Frontend: Update `hasMissingRequired` to use `field.required` in FormDialog.tsx

### H1 (HIGH): Backend required validation for TABLE
- [x] MetahubElementsService `hasRequiredValue` now validates TABLE: `Array.isArray(value) && value.length >= Math.max(1, minRows)`

### M1: Stepper precision validation
- [x] DynamicEntityFormDialog: handleStepUp/Down validate with `validateNumber()` before applying
- [x] FormDialog: Same pattern — reject invalid step results

### M2: ArrowUp/ArrowDown keyboard
- [x] DynamicEntityFormDialog: ArrowUp → handleStepUp(), ArrowDown → handleStepDown() in handleNumberKeyDown
- [x] FormDialog: Same interceptors added

### M3: ARIA labels localization
- [x] DynamicEntityFormDialog: `t('number.increment/decrement', ...)` instead of hardcoded strings
- [x] FormDialog: Same localized ARIA labels

### M4+M5: NUMBER error tooltip in InlineTableEditor
- [x] Added Tooltip import, wrap error NUMBER cells with `<Tooltip title={errorMessage} arrow placement='top'>`

### M6: i18n standardization in DynamicEntityFormDialog
- [x] Added `useTranslation` from react-i18next, removed legacy `formatMessage` helper
- [x] Replaced ALL `formatMessage(en, ru)` calls with `t(key, defaultValue)` — getFieldError, NUMBER constraints, TABLE constraints, buttons, empty state
- [x] Removed `isRuLocale` callback

### M7: Deduplicate TABLE constraint text
- [x] Created `buildTableConstraintText()` utility in `@universo/utils/validation/tableConstraints.ts`
- [x] Exported from `@universo/utils` (index.ts + index.browser.ts + validation/index.ts)
- [x] Replaced duplicated logic in DynamicEntityFormDialog, FormDialog, InlineTableEditor

### L1+L2: TABLE cells type + alignment
- [x] DynamicEntityFormDialog: NUMBER cells in TABLE use `type='text'` + `inputMode='decimal'` + `textAlign: 'right'`

### Verification
- [x] Full build (`pnpm build`) — 66/66 SUCCESS
- [x] Update memory-bank

## Completed: QA Fixes + NUMBER Stepper + TABLE Required Filling — 2026-02-25 ✅

> **Goal**: (1) Fix QA findings F1/F2 (validateNumber on frontend, cellErrors cleanup). (2) Add NUMBER right-alignment + stepper buttons. (3) Add "Required table filling" toggle for TABLE attributes.
> **Complexity**: Level 2 (Moderate) — 6 packages, 10 files
> **Status**: ✅ Fully implemented — 2026-02-25

### F1: Use shared validateNumber on frontend (InlineTableEditor + tabularColumns)
- [x] Replace custom `validateNumberField` with `validateNumber` from `@universo/utils` in InlineTableEditor.tsx — now checks precision, scale, min, max, nonNegative
- [x] Replace inline preProcessEditCellProps validation with `validateNumber` from `@universo/utils` in tabularColumns.tsx

### F2: cellErrors cleanup on row delete
- [x] Add cellErrors cleanup in `handleDeleteRow` — removes entries with matching `${rowId}:` prefix in InlineTableEditor.tsx

### NUMBER right-alignment + stepper buttons
- [x] DynamicEntityFormDialog.tsx: Added `inputProps={{ style: { textAlign: 'right' } }}`, stepper buttons via InputAdornment with ArrowDropUp/ArrowDropDown
- [x] FormDialog.tsx: Same stepper buttons pattern, right-alignment

### TABLE "Required filling" toggle
- [x] Backend: Add `requiredFilling: z.boolean().optional()` to `uiConfigSchema` in attributesRoutes.ts
- [x] Frontend toggle: Add Switch in AttributeFormFields.tsx PresentationTabFields (default: ON)
- [x] DynamicFieldValidationRules: Add `minRows`, `maxRows` fields
- [x] DynamicFieldConfig: Add `tableRequiredFilling?: boolean`
- [x] ElementList: Pass `tableRequiredFilling` from `uiConfig.requiredFilling`
- [x] DynamicEntityFormDialog: `hasMissingRequired` updated, constraint text below TABLE
- [x] FormDialog: `hasMissingRequired` updated, constraint text below TABLE editors
- [x] InlineTableEditor: Add `requiredFilling` prop, constraint text below TableContainer

### Verification
- [x] Full build (`pnpm build`) — 66/66 tasks SUCCESS, 5m19s
- [x] Update memory-bank

## Completed: QA Round-3 — TABLE Validation & Row Limits — 2026-02-26 ✅

> **Goal**: Fix 6 bugs from QA analysis: backend validateRules for TABLE children, minRows/maxRows enforcement, NUMBER input safety in InlineTableEditor, frontend row-limit enforcement.
> **Complexity**: Level 2 (Moderate) — 5 packages, 8 files
> **Status**: ✅ Fully implemented — 2026-02-26

### H1: validateRules not called for TABLE child fields (backend)
- [x] Add `this.validateRules(...)` call for each child value in TABLE loop in MetahubElementsService.ts

### H2: minRows/maxRows not validated in design-time backend
- [x] Check `value.length` against `attr.validationRules.minRows`/`maxRows` after TABLE row loop in MetahubElementsService.ts

### M1+M2: InlineTableEditor NUMBER input issues
- [x] Prevent saving invalid NUMBER values — reject change in handleCellChange if validation fails
- [x] Add onKeyDown handler to block `-` for nonNegative fields (match FormDialog pattern)

### M3: Frontend minRows/maxRows enforcement (3 components)
- [x] Add `minRows`/`maxRows` props to InlineTableEditor and enforce Add/Delete button states
- [x] Pass minRows/maxRows from ElementList.tsx (validationRules available)
- [x] Add `minRows`/`maxRows` props to TabularPartEditor and RuntimeInlineTabularEditor
- [x] Pass minRows/maxRows from FormDialog.tsx TABLE case (validationRules available)
- [x] Add minRows/maxRows to FieldValidationRules in FormDialog.tsx

### Verification
- [x] Lint all affected packages (metahubs-backend, metahubs-frontend, apps-template-mui) — 0 errors
- [x] Run metahubs-backend tests — 83/83 passed + 3 skipped (15 suites)
- [x] Run applications-backend tests — 35/35 passed (2 suites)
- [x] Full build (`pnpm build`) — 66/66 tasks SUCCESS, 5m9s
- [x] Update memory-bank

## Completed: TABLE Attribute Settings Bugfixes — 2026-02-25 ✅

> **Goal**: Fix 5 bugs in TABLE attribute type: (1) minRows/maxRows not persisting, (2) showTitle toggle not working, (3) child NUMBER validation not enforced.
> **Complexity**: Level 2 (Moderate) — 5 packages, 7 files changed
> **Status**: ✅ Fully implemented — 2026-02-26

### Bug #2: minRows/maxRows stripped by Zod schema
- [x] Add `minRows` and `maxRows` to `validationRulesSchema` in metahubs-backend attributesRoutes.ts
- [x] Add cross-validation: minRows <= maxRows when both set

### Bug #3a: showTitle hardcoded in runtime FormDialog
- [x] Replace hardcoded `showTitle` with `field.tableUiConfig?.showTitle !== false` in FormDialog.tsx (EDIT + CREATE modes)

### Bug #3b: showTitle missing in metahub InlineTableEditor
- [x] Add `showTitle?: boolean` prop to InlineTableEditor
- [x] Conditionally render title based on showTitle (default true)
- [x] Pass `showTitle` from ElementList.tsx where InlineTableEditor is used
- [x] Add `tableShowTitle` to DynamicFieldConfig interface in universo-template-mui

### Bug #4a: NUMBER validation missing in backend coerceRuntimeValue
- [x] Add nonNegative, min, max validation to NUMBER case in coerceRuntimeValue

### Bug #4b: NUMBER validation missing in metahub InlineTableEditor
- [x] Add NUMBER validation (nonNegative, min, max) in handleCellChange
- [x] Show visual feedback for invalid values (cellErrors state + error prop)
- [x] Add HTML input constraints (min, max, step) via getNumberInputConstraints

### Bug #4c: NUMBER validation missing in runtime DataGrid editors
- [x] Add NUMBER validation preProcessEditCellProps in buildTabularColumns (tabularColumns.tsx)

### Verification
- [x] Run tests for metahubs-backend — 83/83 passed + 3 skipped (15 suites)
- [x] Run tests for applications-backend — 35/35 passed (2 suites)
- [x] Lint all 5 packages — 0 errors
- [x] Full build (`pnpm build`) — 66/66 tasks SUCCESS, 6m55s
- [x] Update memory-bank

## Completed: Architectural Improvements — Independent Child Tables + Enum Values Rename — 2026-02-25 ✅

> **Goal**: (1) Rename `_mhb_enum_values` → `_mhb_values` / `_app_enum_values` → `_app_values`. (2) Change child table naming from `{parent}_tp_{attrId12}` to independent `tbl_<UUIDv7>`. No legacy code. Test DB will be recreated.
> **Plan**: [memory-bank/plan/tabular-enum-architecture-improvement-plan-2026-02-25.md](../memory-bank/plan/tabular-enum-architecture-improvement-plan-2026-02-25.md)
> **Complexity**: Level 3 (Significant)
> **Status**: ✅ Fully implemented — 2026-02-26

### Phase 1: `@universo/schema-ddl` (Core DDL)
- [x] Rename `generateTabularTableName` → `generateChildTableName` in naming.ts
- [x] Update public exports in index.ts
- [x] Update snapshot.ts (import + call + version bump to v2)
- [x] Update diff.ts (import + 2 calls)
- [x] Update SchemaGenerator.ts — internal naming + `_app_enum_values` → `_app_values`
- [x] Update SchemaMigrator.ts — FK target table name
- [x] Update all DDL tests (naming, snapshot, diff, migrator)

### Phase 2: `@universo/metahubs-backend`
- [x] Rename `_mhb_enum_values` → `_mhb_values` in systemTableDefinitions.ts + indexes
- [x] Update MetahubEnumerationValuesService.ts (25+ refs)
- [x] Update applicationSyncRoutes.ts (import + calls + enum table)
- [x] Update template seed files (2 files, 6 refs)
- [x] Update tests

### Phase 3: `@universo/applications-backend`
- [x] Update import + 5 calls to generateTabularTableName → generateChildTableName
- [x] Replace 2 `_app_enum_values` refs → `_app_values`
- [x] Update tests

### Phase 4: Frontend (comments only)
- [x] Update comments in metahubs-frontend types.ts

### Phase 5: Verification
- [x] Full build verification (`pnpm build`) — 66/66 tasks SUCCESS
- [x] Global grep for remnants — 0 matches
- [x] Update memory-bank

### Phase 6: QA Remediation
- [x] Fix `diff.ts` forward-compatibility: use stored `oldField.columnName` for existing TABLE fields instead of recalculating via `generateChildTableName(field.id)`
- [x] Add `tableName` assertion in `diff.test.ts` to verify stored snapshot name usage
- [x] Add `tableName` assertion in `diff.test.ts` for ADD_TABULAR_TABLE (new TABLE field) to verify `tbl_<uuid>` format
- [x] Verify tests (113/113) and build pass

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

## Completed: Publications Drill-In Navigation & Create Dialog Rework — 2026-02-28 ✅

> **Goal**: Transform Publications from flat list + modal-edit into drill-in navigation (mirroring Catalogs). 2 inner tabs: Versions, Applications. Create dialog reworked to 2 tabs with collapsible sections. New "Create application schema" option.
> **Complexity**: Level 4 (Major)
> **Plan**: `memory-bank/plan/publication-drill-in-plan-2026-02-28.md`
> **Status**: ✅ Implemented

### PDI-R1. Backend: Extract helper + new endpoint + createApplicationSchema
- [x] R1.0: Extract `createLinkedApplication()` helper
- [x] R1.1: Add `createApplicationSchema` to Zod schema
- [x] R1.2: Refactor CREATE handler — DDL after transaction, use helper
- [x] R1.3: New POST .../publication/:publicationId/applications endpoint
- [x] R1.4: Build metahubs-backend — passes clean

### PDI-R2. Frontend: Routes + lazy imports
- [x] R2.1: Add `/publication/:publicationId/versions` and `/applications` routes in MainRoutesMUI.tsx
- [x] R2.2: Export PublicationVersionList, PublicationApplicationList from metahubs-frontend/index.ts

### PDI-R3. Frontend: PublicationVersionList + API + hooks
- [x] R3.1: PublicationVersionList component with tabs, ViewHeader, FlowListTable, Create/Edit/Activate dialogs
- [x] R3.2: usePublicationVersions hook + usePublicationDetails hook
- [x] R3.3: Version mutations (create, activate, update) with legacy key dual-invalidation
- [x] R3.4: Version API functions (list, create, update, activate)
- [x] R3.5: Query keys for versions/applications lists

### PDI-R4. Frontend: PublicationApplicationList + API + hooks
- [x] R4.1: PublicationApplicationList component with tabs, ViewHeader, FlowListTable, Create dialog
- [x] R4.2: Application API + hooks + mutations (create via publication)

### PDI-R5. Frontend: PublicationList + Create Dialog rework
- [x] R5.1: Add drill-in navigation (onClick on ItemCard, getRowLink on FlowListTable)
- [x] R5.2: Rework create dialog — 2 tabs (General + Access) with CollapsibleSection spoilers for version/application settings
- [x] R5.3: Extract CollapsibleSection to universo-template-mui
- [x] R5.4: Update handleCreatePublication payload with createApplicationSchema
- [x] R5.5: Refactor AttributeFormFields to use CollapsibleSection (removed inline Collapse + useState)

### PDI-R6. Frontend: PublicationActions simplification
- [x] R6.1: Simplified edit dialog to 2 tabs (General, Access)
- [x] R6.2: Removed VersionsPanel/ApplicationsPanel imports

### PDI-R7. Frontend: i18n keys EN + RU
- [x] R7.1: Added ~13 EN keys and ~13 RU keys (create.*, applications.*)

### PDI-R8. Cleanup legacy panels
- [x] R8.1: Deleted VersionsPanel.tsx, ApplicationsPanel.tsx, ApplicationsCreatePanel.tsx
- [x] R8.2: Removed all imports + cleaned legacy query key dual-invalidation from versionMutations

### PDI-R9. Full build + verify
- [x] R9.1: Full `pnpm build` — 64/65 packages pass (only pre-existing core-frontend rollup error)
- [x] R9.2: Verified no stale imports or dead code in source files

## Completed: QA Fixes — Publication Drill-In QA Remediation — 2026-02-28 ✅

> **Goal**: Fix all QA findings from comprehensive review of Publications Drill-In Navigation implementation.
> **Complexity**: Level 2 (Moderate)
> **Status**: ✅ Implemented

### QAFIX-1. H-1: Application slug collision
- [x] Fix `createLinkedApplication.ts` — generate unique slug per application (not per publication)

### QAFIX-2. M-2: Remove unused imports (4 files)
- [x] Remove `Typography` from PublicationVersionList.tsx
- [x] Remove `metahubsQueryKeys` from PublicationVersionList.tsx (imported but unused)
- [x] Remove `Typography` from AttributeFormFields.tsx
- [x] Remove `ApplicationUser` from publicationsRoutes.ts

### QAFIX-3. M-3: Fix Russian i18n fallback
- [x] Replace `'Удалённая ветка'` with `'Deleted branch'` in PublicationList.tsx

### QAFIX-4. M-4: Fix react-hooks/exhaustive-deps
- [x] Fix `rawVersions`/`branches` deps in PublicationVersionList.tsx (wrapped in useMemo)
- [x] Fix `rawApps` deps in PublicationApplicationList.tsx (wrapped in useMemo)
- [x] Move `handleOpenEditDialog` before `versionColumns` and add to deps in PublicationVersionList.tsx

### QAFIX-5. M-5: Add name validation in create application dialog
- [x] Add `required` prop and disable Create button when name is empty in PublicationApplicationList.tsx

### QAFIX-6. L-2: Fix non-null assertion
- [x] Replace `publicationName!` with safe fallback in createLinkedApplication.ts

### QAFIX-7. L-3: Fix hardcoded applicationsQueryKeys
- [x] Add documentation comment for cross-domain invalidation pattern in applicationMutations.ts

### QAFIX-8. L-4: Add aria attributes to CollapsibleSection
- [x] Add `role="button"`, `aria-expanded`, `aria-label`, `tabIndex`, keyboard handler to CollapsibleSection.tsx
- [x] Suppress `react/prop-types` false positive for TypeScript-typed component

### QAFIX-9. M-1: Run lint --fix and verify
- [x] Run prettier auto-fix for metahubs-frontend (17→0 errors)
- [x] Run prettier auto-fix for metahubs-backend (0 errors)
- [x] Fix prop-types errors in template-mui CollapsibleSection (3→0 errors)
- [x] Verify 0 errors in all modified files

### QAFIX-10. Build verification
- [x] Full `pnpm build` passes — 64/65 (pre-existing core-frontend error only)

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
