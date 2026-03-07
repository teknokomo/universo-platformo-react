# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks -> tasks.md, architectural patterns -> systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
| --- | --- | --- | --- |
| 0.53.0-alpha | 2026-03-05 | 0.53.0 Alpha — 2026-03-04 | Copy options expansion across Applications/Metahubs/Branches and full Sets/Constants delivery cycle |
| 0.52.0-alpha | 2026-02-25 | 0.52.0 Alpha — 2026-02-25 (Tabular infinity) 🤪 | TABLE UX/data table improvements and NUMBER behavior hardening across form contexts |
| 0.51.0-alpha | 2026-02-19 | Counting Sticks 🥢 | Headless Controller, Application Templates, Enumerations |
| 0.50.0-alpha | 2026-02-13 | Great Love ❤️ | Applications, Template System, DDL Migration Engine, Enhanced Migrations |
| 0.49.0-alpha | 2026-02-05 | Stylish Cow 🐮 | Attribute Data Types, Display Attribute, Layouts System |
| 0.48.0-alpha | 2026-01-29 | Joint Work 🪏 | Branches, Elements rename, Three-level system fields |
| 0.47.0-alpha | 2026-01-23 | Friendly Integration 🫶 | Runtime migrations, Publications, schema-ddl |
| 0.46.0-alpha | 2026-01-16 | Running Stream 🌊 | Applications modules, DDD architecture |
| 0.45.0-alpha | 2026-01-11 | Structured Structure 😳 | i18n localized fields, VLC, Catalogs |
| 0.44.0-alpha | 2026-01-04 | Fascinating Acquaintance 🖖 | Onboarding, Legal consent, Cookie banner, Captcha |
| 0.43.0-alpha | 2025-12-27 | New Future 🏋️ | Pagination fixes, Onboarding wizard |
| 0.42.0-alpha | 2025-12-18 | Dance Agents 👯 | VLC system, Dynamic locales, Flowise 3.0 |
| 0.41.0-alpha | 2025-12-11 | High Mountains 🌄 | Admin panel, Auth migration, UUID v7 |
| 0.40.0-alpha | 2025-12-05 | Straight Rows 🎹 | Package extraction, Admin RBAC, Global naming |
| 0.39.0-alpha | 2025-11-25 | Mighty Campaign 🧙🏿 | Storages, Campaigns, useMutation refactor |
| 0.38.0-alpha | 2025-11-21 | Secret Organization 🥷 | Projects, AR.js Quiz, Organizations |
| 0.37.0-alpha | 2025-11-13 | Smooth Horizons 🌅 | REST API docs, Uniks metrics, Clusters |
| 0.36.0-alpha | 2025-11-07 | Revolutionary Indicators 📈 | dayjs migration, publish-frontend, Metaverse Dashboard |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃 | i18n TypeScript migration, Rate limiting |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️ | Global monorepo refactoring, tsdown build system |
| 0.33.0-alpha | 2025-10-16 | School Test 💼 | Publication system fixes, Metaverses module |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴 | Canvas versioning, Telemetry, Pagination |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆 | Quiz editing, Canvas refactor, MUI Template |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪 | TypeScript aliases, Publication library, Analytics |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒 | Resources/Entities architecture, CI i18n |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨 | Resources, Entities modules, Template quiz |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣 | Finance module, i18n, Language switcher |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌 | MMOOMM template, Colyseus multiplayer |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼 | Space Builder, Metaverse MVP, core utils |
| 0.24.0-alpha | 2025-08-12 | Stellar Backdrop 🌌 | Space Builder enhancements, AR.js wallpaper |
| 0.23.0-alpha | 2025-08-05 | Vanishing Asteroid ☄️ | Russian docs, UPDL node params |
| 0.22.0-alpha | 2025-07-27 | Global Impulse ⚡️ | Memory Bank, MMOOMM improvements |
| 0.21.0-alpha | 2025-07-20 | Firm Resolve 💪 | Handler refactoring, PlayCanvas stabilization |

---

## Manual QA Bug Fixes — 7 Issues (2026-03-07)

Fixed 7 bugs discovered during manual testing of the Create Options + Entity Settings + Mobile UX feature.

| # | Issue | Fix |
|---|-------|-----|
| 1 | i18n keys shown as raw text on Create Options tabs | Added `createOptions` to `consolidateMetahubsNamespace()` |
| 2 | Inconsistent mobile spacing in ViewHeader | Removed negative margins on xs breakpoint, reduced gap to 0.5 |
| 3 | Mobile search button too small and right-aligned | Changed IconButton from `size='small'` to `size='medium'`, left-aligned action bar |
| 4 | Mobile drawer too narrow | Changed `maxWidth` from `70dvw` to `90dvw` in SideMenuMobile |
| 5 | Delete button text shown on mobile | Responsive delete button: icon-only (`IconButton`) on mobile, full `Button` on desktop |
| 6 | Hub Settings tab click did nothing | Changed `hubMap.get(hubId)` to `allHubsById.get(hubId)` — parent hub not in children map |
| 7 | Breadcrumbs not updating after settings save | Added breadcrumb query invalidation in 4 settings dialogs (catalogs, sets, enumerations, hubs) |

Verification: touched-package lint reruns produced warnings only, and the full workspace build passed (23/23 tasks).

### QA Follow-up Closure (2026-03-07)

A final QA pass found remaining UX, regression-coverage, and documentation debt. All items were closed without widening scope.

| Area | Completion |
|---|---|
| Publication settings invalidation | Kept the publication breadcrumb invalidation fix and extracted `invalidatePublicationSettingsQueries()` so publication detail, publications list, and breadcrumb refresh stay in one reusable path. |
| Mobile search UX | Reworked `ViewHeader` so collapsing the mobile overlay preserves the active search value; added controlled `searchValue` support plus internal fallback state for older callers. |
| Caller synchronization | Updated `PublicationVersionList` to pass `searchValue` into `ViewHeader`, ensuring the shared header stays aligned with parent-managed search state. |
| Regression coverage | Added `ViewHeader.test.tsx` for mobile search persistence + parent-sync behavior and `publicationSettingsQueries.test.ts` for publication detail/list/breadcrumb invalidation. |
| Memory-bank accuracy | Corrected stale 2026-03-09 status/date references and aligned `tasks.md`, `activeContext.md`, and `progress.md` with the actual 2026-03-07 verification state. |

Verification: `pnpm --filter @universo/template-mui test` passed (13 suites / 175 tests), the focused `publicationSettingsQueries` Vitest passed, the full `@universo/metahubs-frontend` suite re-ran successfully, touched-package lint reruns produced warnings only, and `pnpm build` finished 23/23 successful.

## Metahub Create Options + Entity Settings + Mobile UX + Logout (2026-03-06)

Implemented the full 9-phase plan covering 8 ТЗ points. Plan went through 3 QA rounds before implementation.

### Delivered Changes

| Area | Delivered |
|------|-----------|
| **Types** | `MetahubCreateOptions` interface in `@universo/types` (4 optional booleans) |
| **Backend templates** | Split into `basic` (minimal) + `basic-demo` (full demo); template registry updated |
| **Backend API** | `createOptions` Zod schema in POST /metahubs; `filterSeedByCreateOptions()` in MetahubSchemaService |
| **Create dialog** | 3rd "Options" tab with Checkbox toggles (Hub, Catalog, Set, Enumeration default on; Branch+Layout locked) |
| **Entity settings** | "Settings" tab in HubList, AttributeList, ConstantList, EnumerationValueList, PublicationVersionList — EntityFormDialog overlay |
| **Builder exports** | All *Actions.tsx files export builder functions + types for reuse |
| **Mobile UX** | AppNavbar: removed Kiberplano/CustomIcon; ViewHeader: CollapsibleMobileSearch; SideMenuMobile: functional logout |
| **CardAlert** | Returns null (placeholder for future subscription feature) |
| **Desktop logout** | SideMenu logout button with useConfirm confirmation + useAuth().logout() |
| **ConfirmDialog** | Added at MainLayoutMUI level inside ConfirmContextProvider |
| **i18n** | EN+RU keys for createOptions tab + logout confirmation (flat common:xxx keys) |
| **Documentation** | MIGRATIONS.md EN+RU (backend + frontend), AGENTS.md updated |
| **Build** | Full project build: 23/23 tasks, 0 errors |

### QA Fixes Applied (2026-03-06)

Comprehensive QA analysis found 12 issues (1 CRITICAL, 3 HIGH, 4 MEDIUM, 4 LOW). All resolved:

| Severity | Issue | Fix |
|----------|-------|-----|
| CRITICAL | HubList `validateHubForm` shadow — Settings validation broken | Renamed local → `validateCreateHubForm`/`canSaveCreateHubForm` |
| HIGH | ViewHeader mobile layout — no flexWrap | Added `flexWrap: { xs: 'wrap', sm: 'nowrap' }`, title full-width on xs |
| HIGH | CollapsibleMobileSearch setTimeout without cleanup | Replaced with `ClickAwayListener` from MUI |
| HIGH | Race condition onBlur vs mousedown | Eliminated by ClickAwayListener refactor |
| MEDIUM | Publication Settings missing expectedVersion | Added `expectedVersion: publicationData.version` |
| MEDIUM | Shared searchInputRef corruption | Separate `desktopSearchRef` + internal `mobileInputRef` |
| MEDIUM | Package-level AGENTS.md not updated | Added Template System + createOptions sections |
| MEDIUM | Manual mousedown instead of ClickAwayListener | Replaced in CollapsibleMobileSearch refactor |
| LOW | Missing currentHubId in 3 settingsCtx | Added to AttributeList, ConstantList, EnumerationValueList |
| LOW | metahubId type mismatch in buildPubFormTabs | Changed to `metahubId!` (guarded above) |
| LOW | No touchstart handling in mobile search | Resolved by ClickAwayListener (handles all events) |
| LOW | getOS() called every render | Memoized with `useMemo` |

Data safety audit (copy flow, IDs, edge cases) confirmed safe — no issues found.

### Lint Cleanup (2026-03-06)

Second QA pass verified all fixes (89 PASS / 0 FAIL). Additional lint cleanup:

| Issue | Fix |
|-------|-----|
| prettier/prettier formatting in touched frontend/backend files | Fixed the specific formatting regressions in template seeds, list pages, test utilities, and settings imports; reran lint successfully with warnings only |
| `react/prop-types` for `MetahubCreateOptionsTab` in MetahubList.tsx | Converted from `React.FC<inline>` to named interface + function declaration |
| `jsx-a11y/no-autofocus` in ViewHeader.tsx CollapsibleMobileSearch | Replaced `autoFocus` prop with imperative `useEffect(() => ref.current?.focus(), [])` |

Build after cleanup: 23/23 tasks, 0 errors.

### Final QA Remediation (2026-03-06)

The follow-up QA audit found several real gaps between the implemented code and the original ТЗ. A final remediation pass closed them without widening scope.

| Area | Final remediation |
|------|-------------------|
| **Template parity** | Reverted `basic` template version to `0.1.0`, aligned default RU names to `Основная` / `Основное`, and added default descriptions for the seeded hub/catalog/set/enumeration entities in both `basic` and `basic-demo` |
| **Settings overlays** | Fixed `EnumerationValueList.tsx` settings/value typing issues (query params, action-context typing, copy dialog labels, optimistic locking) and aligned publication settings data typing with backend `version` |
| **Mobile UX** | Restored focus-on-expand in `ViewHeader.tsx` using `requestAnimationFrame` without bringing back `autoFocus` |
| **Confirm dialog ownership** | Removed duplicate page-level `ConfirmDialog` renders from metahubs pages after centralizing the dialog in `MainLayoutMUI` |
| **Build/test truthfulness** | Restored broken `CatalogList.tsx` / `EnumerationList.tsx` syntax, fixed seed template formatting, repaired Vitest import resolution for `template-mui` + frontend i18n, and updated the failing `MetahubMembers` coverage test to use isolated dialog mocks |
| **Large-metahub safety** | Replaced `limit: 100` hub-loading shortcuts in Catalog/Set/Enumeration create dialogs and Attribute/Constant/Enumeration Value settings flows with `fetchAllPaginatedItems()` so all hubs are available even when pagination spans multiple pages |
| **Validation** | Re-ran `pnpm --filter @universo/types lint`, `pnpm --filter @universo/metahubs-backend lint`, `pnpm --filter @universo/metahubs-frontend lint`, `pnpm --filter @universo/template-mui lint`, `pnpm build`, `pnpm --filter @universo/metahubs-frontend test`, and `pnpm --filter @universo/metahubs-backend test`; all required commands finished successfully (lint with warnings only) |

### QA Debt Closure Addendum (2026-03-07)

The final follow-up pass removed the last remaining debt from the fresh audit without changing runtime behavior.

| Area | Completion |
|------|------------|
| **Backend regression coverage** | Added route coverage proving `POST /metahubs` threads `createOptions` into `createInitialBranch()` and service coverage for `initializeSchema(..., createOptions)` plus `filterSeedByCreateOptions()` filtering of entities/elements/enumeration values |
| **Frontend regression coverage** | Added a focused `MetahubList` test that opens the create dialog, switches to the create-options tab, toggles entity defaults, and asserts the submitted `createOptions` payload |
| **Template MUI regression coverage** | Added desktop/mobile logout confirmation tests for `SideMenu` and `SideMenuMobile` so the new logout UX is now guarded on both layouts |
| **Type safety** | Declared `createHub`, `createCatalog`, `createSet`, and `createEnumeration` on `MetahubFormValues`, removing the last runtime/type mismatch in the metahub create form |
| **Verification** | Re-ran `pnpm --filter @universo/types lint`, `pnpm --filter @universo/metahubs-backend lint`, `pnpm --filter @universo/metahubs-frontend lint`, `pnpm --filter @universo/template-mui lint`, `pnpm --filter @universo/metahubs-backend test`, `pnpm --filter @universo/metahubs-frontend test`, `pnpm --filter @universo/template-mui test`, and `pnpm build`; all completed successfully, with only pre-existing lint warnings remaining |

### Files Modified (11 packages touched)

- `packages/universo-types` — MetahubCreateOptions type
- `packages/metahubs-backend` — basic.template.ts (rewritten), basic-demo.template.ts (new), index.ts, metahubsRoutes.ts, MetahubBranchesService.ts, MetahubSchemaService.ts, MIGRATIONS.md/RU
- `packages/metahubs-frontend` — MetahubList.tsx (Options tab), HubList.tsx, AttributeList.tsx, ConstantList.tsx, EnumerationValueList.tsx, PublicationVersionList.tsx (Settings tabs), 5 *Actions.tsx (exports), metahubs.ts API, MIGRATIONS.md/RU
- `packages/universo-template-mui` — AppNavbar.tsx, ViewHeader.tsx, SideMenuMobile.tsx, SideMenu.tsx, CardAlert.tsx, MainLayoutMUI.tsx
- `packages/universo-i18n` — common.json EN+RU (logout keys), metahubs.json EN+RU (createOptions keys)
- `AGENTS.md` — template registry + createOptions documentation

## QA Debt Closure for Hub Nesting and Hub-Scoped UX (2026-03-06)

Completed the follow-up implementation pass for QA debt in hub nesting and hub-scoped entity flows.

### Delivered fixes

| Area | Delivered |
## Nested Hubs + Hub-Scoped Linking + Runtime Menu Hierarchy (2026-03-06)

Completed end-to-end implementation of the approved Nested Hubs plan with backend safety guards, frontend UX parity, runtime menu hierarchy rendering, and DDL connector alignment.

### Key Delivered Changes

| Area | Delivered |
## PR #710 QA Fixes (2026-03-06)

Comprehensive QA analysis of all 66 files in PR #710 found 4 failing tests and 2 prettier errors. Both issues fixed and verified.

### Changes

| File | Change |
## PR #710 Bot Review Fixes (2026-03-06)

Analyzed 5 inline review comments (Gemini + Copilot) on PR #710 and applied 3 validated fixes. Rejected 1 premature optimization suggestion.

### Changes

| File | Change |
## QA Cleanup: Diagnostic Logs + Migration Display + Legacy ConfirmContext (2026-03-05)

Comprehensive QA review identified three categories of technical debt; all resolved in a single implementation pass.

### Changes

| File | Change |
## DnD Empty Child Table Drop Regression Fix (2026-03-05)

Fixed regression where dragging first attribute into an empty child TABLE attribute list was silently rejected (attribute returned to original position instead of showing confirmation dialog).

### Root Cause (Two-Part)

**Part 1 — Component switching**: `ChildAttributeList.tsx` switched between two components based on `effectiveData.length`:
## Metahub Ordering/Validation QA Debt Closure (2026-03-05)

Completed the follow-up implementation cycle after QA findings and re-validated the scope with fresh lint/test/build evidence.

### Fixes delivered

- Fixed `ElementList` runtime safety issue by moving move-handler wiring to a stable `useCallback` declared before context construction (removed TDZ risk for `handleMoveElement`).
## Metahub Ordering + Table DnD + TABLE Child Limits (2026-03-05)

Completed full implementation of ordering and table drag-and-drop parity for metahub entities, added per-TABLE child-attribute limits, and closed dependency/test debt for this scope.

### Completed implementation

- Added backend reorder foundation for object kinds (`hub`, `catalog`, `set`, `enumeration`) via shared `reorderByKind` path and new reorder endpoints in hubs/catalogs/sets/enumerations routes.
## Sets/Constants Final Debt Closure + Build Fix (2026-03-05)

Completed the focused implementation cycle for remaining Sets/Constants debt and the blocking metahubs-backend TypeScript build failure.

### Completed changes

- Fixed `TS2352` in `applicationSyncRoutes.ts` by replacing unsafe cast flow with typed `MetaConstantSnapshot` lookup (`buildSetConstantLookup` now stores typed snapshots).
## Sets/Constants Stabilization + SemVer Alignment Closure (2026-03-04)

Completed the implementation closure cycle for Sets/Constants runtime issues reported after QA and aligned verification scope with full workspace build.

### Key outcomes

- Fixed Sets/Constants i18n leakage path in UI screens by enforcing `metahubs` namespace usage in:
## Sets/Constants QA Final Closure (Transactional + Concurrency) (2026-03-04)

Closed the remaining QA findings for Sets/Constants by hardening transaction boundaries, concurrency checks, and removing legacy attribute aliases.

### Backend safety and consistency

- Implemented atomic set copy flow:
## Sets/Constants QA Closure & Final Hardening (2026-03-05)

Closed remaining QA gaps for Sets/Constants with strict contract hardening, blocker semantic alignment, and additional regression tests.

### Backend hardening completed

- Removed legacy reorder payload handling in constants route and enforced strict schema payload shape.
## Metahub Sets & Constants Full Implementation (2026-03-04)

Completed end-to-end implementation and verification for the Sets/Constants scope based on clone-first parity with Catalogs/Attributes.

### What was finalized

- **Backend template/publication integration**
## Catalog Attributes DnD Deep Fix (2026-03-04)

Resolved the remaining production issue where dragging catalog attributes did not start, even after full rebuild/hard refresh.

### Root cause

- Attribute DnD provider (`DndContext`) lived in `@universo/metahubs-frontend`
## Fix 5 UI/UX Bugs (2026-03-04)

Fixed 5 user-reported bugs across admin-frontend and metahubs-frontend.

### Changes

1. **Admin "settings" i18n** — Added missing `settings` key to `roles.permissions.subjects` in both ru/en admin locale files.
## Post-Cleanup Deep Hardening (2026-03-04)

Comprehensive deep hardening across core packages after the main legacy cleanup.

### Changes

**Ghost folder & Flowise naming**:
## Fix Auth Login TypeError (2026-03-04)

After the legacy cleanup refactor, login was broken with `TypeError: e.get is not a function` in `useSession`. Root cause: `@/api/client.ts` exports the full `UniversoApiClient` wrapper, not a raw AxiosInstance. `AuthProvider` was receiving the wrapper object instead of the axios instance. Fixed by passing `api.$client` in `index.jsx`. Build verified (23/23).

---

## QA Findings Full Closure (2026-03-04)

Implemented and verified full closure for the codename/CRUD QA findings.

### What was fixed

- **Unified retry policy**: introduced shared constants in backend helper:
## Legacy Cleanup — Remove Flowise Packages (2026-03-04)

Massive repository cleanup: removed 39 legacy Flowise/UPDL packages, renamed remaining @flowise/* → @universo/*, cleaned all cross-references.

### Summary

- **39 packages deleted** (38 from plan + flowise-template-mui merged then deleted)
## Post-QA Hardening (2026-03-04)

Closed all issues found in the latest QA pass for the cleanup scope.

### What was fixed

- Fixed failing `metahubs-frontend` test (`MetahubMembers`): merged duplicate `@universo/template-mui` mocks so `FlowListTable` and `InputHintDialog` are stubbed in one module mock.
## QA Tech Debt Cleanup (2026-03-04)

Fixed all tech debt items identified in the comprehensive QA analysis.

### What was fixed

- **Stale JSDoc comment (MEDIUM)**: Updated `useReorderAttribute` docstring — said "cross-list skipped" but cross-list optimistic updates were already implemented.
## Cross-List DnD Optimistic Update (2026-03-03)

Added instant visual feedback for cross-list attribute DnD transfers (root↔child, child↔child).

### What was fixed

- **Cross-list snap-back eliminated**: Previously, `onMutate` skipped optimistic updates for cross-list transfers (`newParentAttributeId !== undefined`), causing attributes to snap back to original position for 2-3s until server response arrived. Now items instantly move between caches.
## DnD QA Pass 5 — Post-Analysis Fixes (2026-03-03)

Fixed 4 issues identified by comprehensive QA analysis of the DnD implementation.

### What was fixed

- **Backend auto-set display attribute (Fix 1, MEDIUM)**: In `reorderAttribute()`, after cross-list move to child list, counts siblings in target. If count === 1, auto-sets `is_display_attribute: true` + `is_required: true`. Ensures newly populated child lists always have a display attribute.
## DnD QA Pass 4 — 4 Issues Fix (2026-03-03)

Fixed 4 QA issues from manual testing of DnD cross-list transfers and attribute editing.

### What was fixed

- **Cross-list drag jitter (Issue 1)**: Added `overflowX: 'hidden'` to FlowListTable TableContainer when `isDropTarget` active. Prevents horizontal scrollbar cycle caused by wider ghost rows injected into narrower child tables.
## DnD QA Pass 3 — 4 Issues Fix (2026-03-03)

Fixed 4 QA issues from manual testing of DnD attributes/enumeration values.

### What was fixed

- **Enum value row height**: Removed `compact` from EnumerationValueList FlowListTable (standard 64px rows).
## DnD QA Pass 2 — 6 Issues Fix (2026-03-04)

Fixed 6 QA issues found during manual testing of the DnD attributes/enumeration values feature.

### What was fixed

- **Row height**: Removed `compact` from root AttributeList FlowListTable (64px standard rows), child lists remain compact (40px).
## DnD Table Design Restoration & Tech Debt Elimination (2026-03-03)

Restored standard table design across all DnD-enabled lists by extending FlowListTable with built-in DnD support, fixed all pre-existing TS errors, and cleaned up redundant components.

### What was implemented

- **FlowListTable DnD extension** (`universo-template-mui`): Created `FlowListTableDnd.tsx` with internal building blocks (SortableTableRow, SortableTableBody, InternalDndWrapper). Added 12 DnD props to FlowListTable: `sortableRows`, `sortableItemIds`, `droppableContainerId`, `externalDndContext`, `onSortableDragEnd/Start/Over/Cancel`, `renderDragOverlay`, `dragHandleAriaLabel`, `dragDisabled`. Added `@dnd-kit` deps.
## DnD QA Critical Debt Closure (2026-03-03)

Completed a focused remediation pass to eliminate remaining QA blockers in DnD reorder flows for attributes and enumeration values.

### What was fixed

- Backend reorder policy enforcement now uses metahub settings for cross-list transfers (`allowAttributeMoveBetweenRootAndChildren`, `allowAttributeMoveBetweenChildLists`) so restricted moves are rejected server-side.
## Drag-and-Drop for Attributes & Enumeration Values (2026-03-03)

Implemented full drag-and-drop reordering for attributes (root + child lists with cross-list transfer) and enumeration values in metahubs. Uses `@dnd-kit` library (same as spaces-frontend).

### What was implemented

- **Backend**: `reorderAttribute()` with transactional gap-shift + sequential normalization, cross-list transfer validation (display attr, TABLE nesting, codename uniqueness with auto-rename up to 20 attempts), `reorderValue()` for enumerations. PATCH routes with Zod validation and proper HTTP error codes (409/422/403).
## Codename Auto-Convert UX Hardening (2026-03-03)

Completed a focused UX/logic hardening pass to make mixed-alphabet codename conversion consistent between manual codename editing and codename auto-generation from Name.

### What was fixed

- `@universo/utils` codename sanitizer was extended so generation flows can opt into mixed-alphabet auto-conversion when mixed alphabet input is disallowed by settings.
## QA Debt Eradication Closure (2026-03-03)

Completed closure for the latest QA remediation pass focused on final lint blocker elimination and test stability hardening in `metahubs-frontend`.

### What was fixed

- `EnumerationValueList.tsx`: added missing `editingEntityId?: string | null` prop typing in `ValueFormFields` props to remove the remaining `react/prop-types` error-level lint blocker.
## QA Remediation — Root Attribute Codename Flow Hardening (2026-03-03)

Completed final remediation for the remaining root attribute QA gaps in codename handling and duplicate safety.

### What was fixed

- `AttributeList.tsx` moved to settings-aware codename normalization/validation (`normalizeCodenameForStyle` + `isValidCodenameForStyle`) for create/edit save paths; legacy `sanitizeCodename` root path removed from this flow.
## Codename Bug Fixes + Global Scope + Button Disable (2026-03-03)

Fixed 4 QA issues found during testing of the codename duplicate checking feature.

### What was fixed

**Issue 1 — i18n + original case**:
## Admin i18n + Codename Duplicate Check + Element Settings (2026-03-03)

Implemented 4 tasks: admin i18n fix, reactive codename duplicate checking with VLC cross-locale uniqueness, and element copy/delete settings.

### What was built

**Infrastructure (new files)**:
## Catalog Actions Policy Parity Remediation (2026-03-02)

Completed the remaining QA follow-up in metahubs frontend by aligning catalog action visibility with existing settings-based policy logic.

### What was fixed
- `CatalogList` action menus now apply settings-based filtering (`catalogs.allowCopy`, `catalogs.allowDelete`) before rendering descriptors.
## Comprehensive QA Finalization (2026-03-02)

Completed an evidence-based QA closure pass for the latest metahub settings/codename/policy work, with explicit clean-database resilience checks and final build verification.

### What was validated
- Fresh-DB safety chain: admin bootstrap migration seeds both `admin.locales` and `admin.settings`, and follow-up migration adds `metahubs.codenameAutoConvertMixedAlphabets` with idempotent upsert behavior.
## Metahub Language/Codename/Attribute Policy Fixes Closure (2026-03-02)

Closed the requested metahub fixes for language defaults, codename behavior, attribute policies, and settings UX, then finalized with an additional blur-normalization hardening pass.

### What was fixed
- Ensured `general.language` is functional with `system` mode and dynamic locale options sourced from Admin content locales.
## Post-QA Debt Cleanup & Safety Hardening Closure (2026-03-02)

Completed the final warning-level cleanup for changed `@universo/metahubs-frontend` files and closed the implementation validation cycle.

### What was fixed
- Removed remaining strict-lint findings in changed metahubs frontend files (`no-explicit-any`, hook dependency warnings, unsafe error typing) with behavior-preserving refactors.
## Codename UX/Settings Refinement Completion (2026-03-02)

Completed the requested codename UX/settings refinement pass across metahubs and admin surfaces, including preview logic parity, new mixed-alphabet auto-convert setting, and normalization consistency.

### What was fixed
- Added and wired `general.codenameAutoConvertMixedAlphabets` (default `true`) through shared settings registry, metahub template defaults, admin settings validation/migration, and metahub codename defaults API output.
## QA Safety Remediation Hardening (2026-03-02)

Completed the QA hardening pass for metahubs backend route safety and closed the remaining build blocker introduced during the implementation iteration.

### What was fixed
- Added strict catalog-kind guards in route paths previously relying only on object existence checks.
## VLC UX & Settings Consistency Fixes (2026-03-02)

Implemented and finalized all newly reported VLC/codename UX and settings consistency defects for metahubs frontend/template integration.

### What was fixed
- Localized codename sync behavior corrected for language switch vs locale addition to avoid duplicate/empty codename locale artifacts.
## QA Findings Fix (2026-03-02)

Fixed all issues discovered during comprehensive QA analysis of VLC codename implementation.

### What was fixed
- **Admin auth for regular users**: Replaced `useAdminMetahubDefaults` (calling admin-only `/admin/settings/metahubs`) with `usePlatformCodenameDefaults` using new public `GET /metahubs/codename-defaults` endpoint. Regular users can now access platform-level codename defaults when creating new metahubs.
## Settings UX & VLC Fixes (2026-03-02)

Fixed 5 issues found during user testing of the codename VLC feature.

### What was fixed
- **Toggle flickering**: Both `useUpdateSettings`/`useResetSetting` (metahub) and `AdminSettings.tsx` (admin) now use `queryClient.setQueryData()` with mutation response before `invalidateQueries()`, preventing stale-data flash.
## Post-QA Full Remediation Completion (2026-03-02)

Completed an additional QA-driven hardening pass to remove remaining correctness and technical-debt findings discovered after the previous closure.

### What was fixed
- Codename blur normalization alignment: shared `template-mui` `CodenameField` now supports an optional `normalizeOnBlur` override, while `metahubs-frontend` wrapper injects settings-aware normalization (`style` + `alphabet`) without changing global default behavior.
## QA Risk Closure Completion (2026-03-02)

Completed a focused remediation pass for the latest QA findings with concurrency-safe backend updates and frontend codename-settings reactivity fixes.

### What was fixed
- Backend routes hardened for race paths: deterministic duplicate-key conflict handling (`409`) on create flows and safer hub-association updates in hub-scoped unlink/delete operations.
## Session Finalization Handoff (2026-03-02)

Final closure synchronization pass completed after comprehensive QA remediation.

### What was done
- Re-checked `memory-bank` closure consistency (`tasks.md`, `activeContext.md`, `progress.md`) against implemented remediation scope.
## Comprehensive QA Remediation — Final Closure (2026-03-02)

Final implementation pass completed for the latest QA findings with zero remaining blocking issues in the touched scope.

### What was finalized
- Backend hardening completed for metahub settings/branches/attributes paths:
## Codename VLC End-to-End Closure — Implementation Complete (2026-03-02)

Final closure pass completed for codename VLC parity rollout. This session focused on regression cleanup, lint/build stabilization, and Memory Bank synchronization.

### What was fixed
- Frontend lint blocker removed in branches UI by deleting an accidental `codenameVlc: null` artifact in `BranchList.tsx` column configuration.
## QA Hardening Fixes — Implementation Complete (2026-03-02)

Closed all high-priority defects identified in the latest QA hardening pass for metahubs/admin settings integration, with focused low-risk patches and full re-validation.

### What was fixed
- Enforced `allowDelete` policy in destructive catalog/enumeration paths that could escalate from hub-scoped removal to full entity deletion.
## QA Defects Remediation Completion (2026-03-01)

Final remediation pass completed for the latest QA findings. All blocking test and lint failures identified in the QA cycle were resolved and re-verified without introducing additional technical debt.

### What was fixed
- Frontend settings hook hardened to tolerate incomplete payloads (`data.settings` absent/non-array) and avoid runtime crashes in affected test paths.
## QA Remediation Closure Sync (2026-03-01)

Final closure pass completed for the QA remediation stream: Memory Bank state synchronized with actual implementation, remediation checklist reconciled, and deferred scope captured explicitly.

### Closure outcomes
- `tasks.md`: `QA Remediation — 2026-03-02` marked completed with implemented items reconciled to verified outcomes.
## Admin Global Settings & Metahub Codename Fixes (2026-03-02)

Fixed 4 issues: metahub 400 error, wrong helper text, admin global settings system, RoleEdit layout.

**Changes:**
- **Issue #1 — Metahub 400 error**: `metahubsRoutes.ts` CREATE/COPY/UPDATE handlers replaced `normalizeCodename`/`isValidCodename` (kebab-only) with `normalizeCodenameForStyle`/`isValidCodenameForStyle` (style-aware). PascalCase codenames transliterated from Russian labels (for example, `SpisokPokupok`) are now accepted. COPY suffix changed from `-copy` to `Copy`.
## Codename Settings & Validation Overhaul (2026-03-01)

Major overhaul making codename generation/validation fully settings-aware across all entity forms. 8 phases, ~30 files modified.

**Changes:**
- **Types**: `CodenameAlphabet` expanded to `'en' | 'ru' | 'en-ru'`; defaults changed to `pascal-case` + `en-ru`; 3 new settings added to `METAHUB_SETTINGS_REGISTRY` (total 20): `codenameAllowMixedAlphabets` (bool, default false), `codenameAutoReformat` (bool, default true), `codenameRequireReformat` (bool, default true)
## Settings Page UI/UX Fixes (2026-03-03)

Five UI/UX issues found during manual testing of the Settings page, all resolved:

1. **Breadcrumbs** — Added `settings` case to `NavbarBreadcrumbs.tsx` metahub handler
2. **Padding** — Added `mx: { xs: -1.5, md: -2 }` negative margins matching CatalogList pattern
## Metahub Settings — Phase 8: QA Fixes (2026-03-02)

After comprehensive QA review (10 findings: 3 critical, 3 serious, 4 moderate), all issues resolved:

- **Fix #1 (Critical)**: Created `useEntityPermissions` hook — reads `allowCopy`/`allowDelete` from settings, exported from `metahubs-frontend`
- **Fix #2 (Critical)**: Added `getAllowedEnumValueTypes` helper to `codenameStyleHelper.ts` (future enforcement — enum values lack `valueType` field)
## Metahub Settings — Phases 4–7 Implementation (2026-03-02)

### Phase 4: Frontend Domain ✅
- Created `settingsApi.ts` — API client with `getAll`, `getByKey`, `update`, `resetToDefault`
- Created `useSettings.ts` — `useSettings`, `useUpdateSettings`, `useResetSetting`, `useSettingValue` hooks (TanStack Query v5)
## QA Fixes — Post-Settings Implementation (2026-03-03)

Comprehensive QA analysis found 1 critical bug + 6 code quality/UX issues. All fixed. Build: 56/56.

### Fixes Applied
- **CRITICAL**: `<ConfirmDialog />` was incorrectly removed from SettingsPage.tsx — confirm() Promise never resolved (reset button hung). Re-added `ConfirmDialog` import and render.
## Metahub Settings Plan — QA Review & Update (2026-03-02)

Comprehensive QA analysis of the metahub-settings-plan found **16 findings** (3 critical, 6 serious, 3 component reuse, 4 architectural). All findings have been resolved in the plan document.

### Key Corrections Applied
- **Critical**: `codenameUniquenessScope` → `attributeCodenameScope` (per-level/global, not metahub/hub); added missing `catalogs.allowedAttributeTypes` + `enumerations.allowedValueTypes` (multiselect type); added `asyncHandler` wrapper to all route handlers
## Metahub Settings — Phases 1–3 Implementation (2026-03-02)

### Phase 1: Types & Shared Code ✅
- Added `CodenameStyle`, `SettingDefinition`, `SettingValueType` (incl. `multiselect`), `MetahubSettingRow`, `METAHUB_SETTINGS_REGISTRY` (14→17 settings, 5 tabs) to `universo-types`
- Added `CODENAME_PASCAL_PATTERN`, `CODENAME_PASCAL_EN_PATTERN`, `isValidPascalCodename`, `isValidPascalEnCodename`, `isValidCodenameForStyle`, `normalizePascalCodename`, `normalizePascalEnCodename`, `normalizeCodenameForStyle` to `universo-utils`
## PostgreSQL NUMERIC → JS Number Coercion Fix (2026-03-02)

Fixed "Invalid value for kolichestvo: Expected number value" error when saving application runtime rows with NUMBER fields. Root cause: PostgreSQL `NUMERIC(10,0)` columns return string values via `node-postgres`, but `coerceRuntimeValue` required strict `typeof value === 'number'`. Metahubs was unaffected because it stores data in JSONB (preserves JS number types). Fix: added `pgNumericToNumber` helper, updated `resolveRuntimeValue`, `coerceRuntimeValue`, GET single row, and GET tabular rows endpoints in `applicationsRoutes.ts`. Build: 56/56.

---

## API Error Message Propagation Fix (2026-03-02)

Fixed hidden error messages in runtime row CRUD operations. Previously, server validation errors (e.g., "Invalid value for X: Expected number value") were replaced by generic "Request failed with status code 400" in the UI. Added `extractApiErrorMessage()` helper to `useCrudDashboard.ts` and `RuntimeInlineTabularEditor.tsx` that extracts `error`/`message` from Axios response body. Build: 56/56.

---

## VLC Comment Consolidation — Metahubs + Applications (2026-03-02)

Merged second metahubs migration into first (comment TEXT→JSONB in `metahubs_users`), aligned applications-backend & frontend with the same VLC comment pattern used in metahubs. Build: 56/56.

### Changes
- **Metahubs migration**: merged `AlterMetahubUsersCommentToJsonb` into `CreateMetahubsSchema`, deleted second migration file
## Documentation Overhaul — GitBook Stubs (2026-03-01)

Deleted all outdated documentation (2023 files from Flowise era, 175 directories, hundreds of images) and created fresh GitBook-standard stub pages indicating documentation is under development.

### What Was Deleted
- docs/en: all files including .gitbook/assets (hundreds of images)
## Legacy Packages Removal — 10 Packages (2026-02-28)

Removed 10 legacy packages and all cross-references across the monorepo per 9-phase plan (see `memory-bank/plan/legacy-packages-removal-plan-2026-03-01.md`).

### Packages Removed
- campaigns-backend, campaigns-frontend
## PR #698 Review Fixes (2026-02-28)

Addressed 9 Copilot bot review comments on PR #698. Analysis found 5 valid code fixes + 3 memory-bank cleanups:

- **C2**: branchId fallback — `activeVersion.branchId ?? metahub.defaultBranchId` with early-return warning (publicationsRoutes.ts)
- **C3/C7**: Removed unused `publicationName` + `usePublicationDetails` from PublicationVersionList & PublicationApplicationList
## Publication Drill-In Feature — Consolidated (2026-02-28)

Full implementation of Publications drill-in navigation with inner tabs (Versions, Applications), replacing the previous flat list + modal-edit approach.

### UX Polish Round 2 (5 fixes)
- Link colors matched catalog pattern: `color: 'inherit'`, underline + `primary.main` on hover
## Copy UX & QA Remediation (2026-02-27)

### QA Remediation Round 10 — Copy UX
Standardized copy naming convention with i18n-driven naming per metahub locale. Template seed respects metahub primary locale during copy.

### PR #696 Bot Review Fixes
## Copy Flows & NUMBER Field Parity (2026-02-26)

### QA Remediation Rounds 1-4 — Copy Flows
- Round 1: prevent copy of soft-deleted entities
- Round 2: schema sync after copy — correct status propagation
## QA & Architecture Fixes (2026-02-24 to 2026-02-25)

### QA Rounds 5-8 (02-25 to 02-26)
- Constraint text UX: human-readable violation messages
- Spacing fixes: table cell padding, dialog margins
## QA & Child TABLE Editing (2026-02-23)

### QA Safe Remediation
Number display formatting, optimistic lock improvements, enum dropdown fixes, status dialog.

### QA Recommendations Implementation
## TABLE Attribute & QA (2026-02-21 to 2026-02-22)

### Documentation Updates — QA Recommendations (02-22)
- metahubs-frontend README (EN/RU): ColumnsContainer, MigrationGuard, Blockers i18n
- metahubs-backend README (EN/RU): Structured Blockers, Migration Endpoints, file structure
## TABLE Attribute Type Implementation (2026-02-21)

Full TABLE attribute type: backend CRUD, schema DDL, frontend inline editing with DnD reorder, REF column support, publication snapshot pipeline for TABLE children.

**Build**: 66/66 packages.

---
## Enumerations Feature (2026-02-18 to 2026-02-19)

### QA Remediation Rounds 1-5
- Round 1: runtime safety — FormDialog enum default injection (undefined vs null)
- Round 2: structure versioning — consolidated V1/V2/V3 → single V1 (CURRENT_STRUCTURE_VERSION=1)
## Migration Guard + UI Polish (2026-02-18)

### i18n Fix + LanguageSwitcher Widget
- `consolidateApplicationsNamespace()` dropped 3 sections (migrationGuard, underDevelopment, maintenance)
- LanguageSwitcher widget: copied from universo-template-mui, registered in dashboard (key: languageSwitcher)
## PR #682 Bot Review Fixes (2026-02-18)

9 actions: staleTime for list/plan hooks, unused imports, type safety guard, determineSeverity JSDoc, AGENTS.md roles/statuses, MIGRATIONS.md corrections, memory-bank English translation.

**Build**: 66/66.

---
## Dashboard & Architecture (2026-02-17 to 2026-02-20)

### 5-Étap QA Fixes (02-20)
- Étap 1: editor canSave + dirty tracking (useRef snapshot)
- Étap 2: inner widget labels in LayoutDetails chip
## Runtime CRUD & QA (2026-02-14 to 2026-02-16)

### QA Round 5 — Dialog Input Styling (02-16)
Root cause: apps-template-mui compact MUI Dashboard style (padding: 0, notchedOutline: none). Fixed with proper spacing, MuiInputLabel, MuiButton disabled state.

### QA Round 4 — Theme Dedup + Runtime Rename (02-16)
## Metahubs UX & UI Polish (2026-02-13 to 2026-02-14)

### Boolean Fix, Auto-fill, Presentation Tab (02-13)
Boolean indeterminate: DDL `.defaultTo(false)`, runtime null→false, frontend indeterminate=false. Publication auto-fill from metahub name + " API". Presentation tab: `uiConfig` with `headerAsCheckbox`.

### UI/UX Polish Rounds 1-2 (02-14)
## 2026-02-12: QA Rounds 9-16 — Pool, Locks, Cache, Migrations ✅

### Round 9: Migration Gate, Baseline Compatibility, Pool-Safe Apply
- DB-aware `ensureSchema()` with strict order. Widget table resolver aligned to `_mhb_widgets`.
- Deterministic error model: `MIGRATION_REQUIRED` (428), `CONNECTION_POOL_EXHAUSTED` (503).
## 2026-02-11: QA Rounds 3-8, Structure Baseline, DDL Deep Fixes ✅

### Structure Baseline + Template Cleanup
_mhb_widgets baseline table. CURRENT_STRUCTURE_VERSION=1. Diff engine: RENAME_TABLE/RENAME_INDEX via renamedFrom. TemplateSeedCleanupService with modes keep/dry_run/confirm. Removed starter tags catalog.

### QA Rounds 3-8
## Metahub Migration Hardening — Structured Plan/Apply (2026-02-11)

Typed migration metadata contracts: baseline | structure | template_seed | manual_destructive. Template manifest validation with cross-reference safety checks. Seed dry-run planning. Structured plan/apply API with deterministic blocking. Branch-level template sync tracking. Tests: templateManifestValidator, metahubMigrationMeta, metahubMigrationsRoutes.

---

## 2026-02-10: Template System, DDL Engine, Migration Architecture ✅

### Metahub Template System (10 phases)
DB entities (templates, templates_versions), TemplateSeedExecutor, TemplateManifestValidator (Zod), TemplateSeeder (SHA-256 idempotent), frontend TemplateSelector. QA: Zod VLC fix, default auto-assign, transaction wrapper, atomic creation.

### Declarative DDL & Migration Engine (7 phases)
## 2026-02-05 to 2026-02-09: Layouts, Runtime, Menu Widget, PR Review ✅

### PR #668 Bot Review Fixes (02-09)
Zod schema mismatch, non-deterministic Object.keys→Object.values, unused imports.

### Menu Widget System (02-08 to 02-09)
## 2026-01-29 through 2026-02-04: Branches, Elements, System Fields ✅ (v0.48.0-alpha)

- Metahub branches system (create, activate, delete, copy with schema isolation)
- Records renamed to Elements across backend, frontend, types, i18n
- Three-level system fields (`_upl_*`, `_mhb_*`, `_app_*`) with cascade soft delete
## 2026-01-16 through 2026-01-28: Publications, schema-ddl, Migrations ✅ (v0.47.0-alpha)

- Runtime migrations (schema sync between metahub design and application runtime)
- Publication as separate entity with application-centric schema sync
- `@universo/schema-ddl` package for DDL utilities (SchemaGenerator, SchemaMigrator, KnexClient)
## 2026-01-11 through 2026-01-15: i18n, VLC, Catalogs ✅ (v0.45.0-alpha, v0.46.0-alpha)

- Applications modules (frontend + backend) with Metahubs publications integration
- Domain-Driven Design architecture refactoring for metahubs packages
- VLC (Versioned Localized Content) localization system for metahub entities
## 2026-01-04 through 2026-01-10: Auth & Onboarding ✅ (v0.44.0-alpha)

- Onboarding completion tracking with registration 419 auto-retry
- Legal consent, cookie banner, captcha, auth toggles
- Pattern: systemPatterns.md#public-routes-401-redirect
## 2025-12-18 through 2025-12-31: VLC, Flowise 3.0, Onboarding ✅ (v0.42.0-alpha, v0.43.0-alpha)

- VLC system implementation + breadcrumb hooks refactoring
- Dynamic locales management. Flowise Components upgrade 2.2.8 → 3.0.12
- AgentFlow Agents + Executions integration (Flowise 3.x)
## 2025-12-05 through 2025-12-17: Admin Panel, Auth, Package Extraction ✅ (v0.40.0-alpha, v0.41.0-alpha)

- Admin panel disable system with ENV-based feature flags
- Axios 1.13.2 upgrade (CVE-2025-27152). Auth.jsx → auth-frontend TypeScript migration
- UUID v7 infrastructure and core backend package
## 2025-11-07 through 2025-11-25: Organizations, Projects, Campaigns ✅ (v0.36.0-v0.39.0-alpha)

- dayjs migration, UI refactoring, publish-frontend TypeScript migration
- Russian README files. Metaverse Dashboard with analytics. REST API docs refactoring
- Member actions factory, Agents migration. Projects management. AR.js Quiz Nodes
## 2025-10-23 through 2025-11-01: Global Refactoring ✅ (v0.34.0-alpha, v0.35.0-alpha)

- Global monorepo refactoring: package restructuring, tsdown build system, centralized dependencies
- i18n TypeScript migration. Rate limiting production implementation with Redis
- Pattern: systemPatterns.md#build-system-patterns, systemPatterns.md#rate-limiting-pattern
## 2025-10-02 through 2025-10-16: Metaverses, Canvas, Publications ✅ (v0.31.0-v0.33.0-alpha)

- Publication system fixes, Metaverses module MVP, Quiz timer
- Canvas versioning, telemetry refactoring, role-based permissions
- MUI Template System implementation
## 2025-09-07 through 2025-09-21: Resources, Testing, Auth ✅ (v0.28.0-v0.30.0-alpha)

- Resources/Entities architecture with tenant isolation and security hardening
- CI i18n docs consistency checker. Spaces/Canvases publication settings
- TypeScript path aliases. Global publication library. Analytics hierarchy
## Pre-2025-09: Foundation Work ✅ (v0.21.0-v0.27.0-alpha)

- v0.27.0 (2025-08-31): Finance module, language switcher, i18n integration
- v0.26.0 (2025-08-24): MMOOMM template extraction, Colyseus multiplayer server
- v0.25.0 (2025-08-17): Space Builder MVP, Metaverse module, core utils package
