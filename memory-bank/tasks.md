# Tasks

> **Note**: Active and planned tasks. Completed work -> progress.md, architectural patterns -> systemPatterns.md.

---


## Active Open Tasks (Canonical)

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

## Completed: Nested Hubs + Hub-Scoped Linking + Runtime Menu Hierarchy (IMPLEMENT) — 2026-03-06 ✅

> **Goal**: Deliver full implementation from approved plan and QA refinements, with safe backend guards, reusable UI patterns, i18n coverage, and verification without legacy debt.

### Phase 1. Contracts and Shared Foundations
## Completed: QA Debt Closure for Hub Nesting and Hub-Scoped UX — 2026-03-06 ✅

> **Goal**: Close all issues from the latest QA audit without introducing regressions.

### Phase 1. i18n Integrity and Localization Consistency
## Completed: PR #710 QA Fixes — 2026-03-06 ✅

> **Goal**: Fix failing tests and prettier errors discovered during comprehensive QA analysis of PR #710.

- [x] Fix 4 failing tests in `elementsRoutes.test.ts` — add missing `ensureMetahubAccess` mock (same pattern as 7 other test files)
## Completed: PR #710 Bot Review Fixes — 2026-03-06 ✅

> **Goal**: Analyze bot review comments on PR #710, validate against codebase, fix genuine issues without breaking functionality.

- [x] Fetch and analyze all 5 inline review comments + 1 summary from PR #710
## Completed: QA Cleanup — DnD Diagnostic Logs + Migration Display + Legacy ConfirmContext — 2026-03-05 ✅

> **Goal**: Clean up all technical debt identified during QA review of DnD implementation; remove diagnostic traces, fix display bug, eliminate dead legacy code.

### Phase 1. Remove Diagnostic Logs
## Completed: DnD Empty Child Table Drop Regression Fix — 2026-03-05 ✅

> **Goal**: Fix regression where dragging first attribute into empty child TABLE attribute list silently fails (drop rejected, attribute returns to original position).

### Phase 1. Stable Droppable Container
## Completed: Metahub Ordering/Validation QA Debt Closure — 2026-03-05 ✅

> **Goal**: Eliminate remaining QA findings for ordering safety and legacy validation fallback paths, and align verification evidence with real implementation state.

### Phase 1. Ordering Concurrency Hardening (Backend)
## In Progress: Constants Value Tab + Localization + Table Layout + App REF Display — 2026-03-05

> **Goal**: Close remaining runtime/UI defects in Sets/Constants flow and application element REF rendering with zero legacy fallback debt.

### Phase 1. Constants Form Behavior Parity
## Completed: Metahub Ordering + Table DnD + TABLE Child Limits — 2026-03-05 ✅

> **Goal**: Fully implement ordered behavior and table drag-and-drop parity for metahub entities, plus per-TABLE child attribute limits, with no legacy fallback debt.

### Phase 1. Backend Ordering Foundation
## Completed: Sets/Constants Final Debt Closure + Build Fix — 2026-03-05 ✅

> **Goal**: Remove remaining QA debt and fix full build failure in metahubs-backend without introducing regressions.

### Phase 1. Build Stability
## Completed: Sets/Constants Stabilization + Schema SemVer Alignment — 2026-03-04 ✅

> **Goal**: Fully fix post-QA/runtime issues for Sets/Constants and remove migration/versioning regressions for fresh metahubs (no legacy compatibility path).

### Phase 1. Mandatory QA Remediation (Backend + Frontend)
## Completed: Sets/Constants QA Final Closure (Transactional + Concurrency) — 2026-03-04 ✅

> **Goal**: Close all remaining QA findings for Sets/Constants implementation without introducing regressions or new technical debt.

### Phase 1. Backend Data Consistency
## Completed: Sets/Constants QA Closure & Final Hardening — 2026-03-05 ✅

> **Goal**: Fully close QA findings for Sets/Constants implementation and remove remaining technical debt in this scope.

### Phase 1. Backend Safety & Correctness
## Completed: Metahub Sets & Constants Full Implementation — 2026-03-04 ✅

> **Goal**: Deliver full Sets/Constants implementation with mandatory clone-first refactor parity, strict safety checks, and zero unfinished migration/template debt.

### Phase A. Clone-First Compliance and Naming Residue Audit
## In Progress: PR #706 Review Feedback Fixes — 2026-03-05

> **Goal**: Address valid bot review comments on PR #706 (cleanup/remove-legacy-packages → main).

- [x] Restore `pnpm.onlyBuiltDependencies: ["sqlite3"]` in root package.json (supply-chain hardening)
## Completed: Catalog Attributes DnD Deep Fix — 2026-03-04 ✅

> **Goal**: Find and fix the real root cause why attribute drag-and-drop still does not start, despite successful build and previous externals fix.

- [x] Compare full DnD implementation chain: attributes vs enumerations (provider, sensors, sortable rows, event handlers)
## Completed: Fix 5 UI/UX Bugs — 2026-03-04 ✅

> **Goal**: Fix 5 user-reported UI/UX bugs across admin-frontend and metahubs-frontend.

### Bug fixes
## Completed: Post-Cleanup Deep Hardening — 2026-03-04 ✅

> **Goal**: Complete post-legacy-cleanup deep audit and fix for core-frontend, core-backend, admin RBAC, and sidebar menu.

### 1. Ghost folder & legacy references
## Completed: QA Remediation — 2026-03-04 ✅

> **Goal**: Fix all issues found during QA analysis of Post-Cleanup Deep Hardening sprint.

### Fixes applied
## Completed: Fix Auth Login TypeError — 2026-03-04 ✅

> **Goal**: Fix `TypeError: e.get is not a function` in useSession/AuthProvider that prevented login after the legacy cleanup refactor.

- [x] Diagnose root cause: `@/api/client.ts` default export changed from raw AxiosInstance to full UniversoApiClient object, but `AuthProvider` expects AxiosInstance
## Completed: QA Findings Full Closure — 2026-03-04 ✅

> **Goal**: Fully close all issues identified in the comprehensive QA report for codename/CRUD safety, including missing tests and retry consistency, without regressing existing functionality.

- [x] Unify codename copy retry policy across domains (attributes/enumeration values/hubs/catalogs/enumerations) via shared constants in backend helper
## Completed: Final Hardening Wrap-up — 2026-03-04 ✅

> **Goal**: Finalize post-QA dependency override refinements, re-run critical verification, and close implementation documentation.

- [x] Re-run regression tests for previously failing suites (`@universo/metahubs-frontend`, `@universo/template-mui`)
## Completed: Post-QA Hardening — 2026-03-04 ✅

> **Goal**: Eliminate issues discovered in the latest QA pass (failing tests, lint blockers in touched scope, critical security advisories) without destabilizing the cleaned architecture.

- [x] Fix failing `@universo/metahubs-frontend` test (`MetahubMembers` view toggle)
## Completed: Legacy Cleanup — Remove Flowise Packages — 2026-03-04 ✅

> **Goal**: Remove 39 legacy Flowise/UPDL packages, clean core packages, rename @flowise/* → @universo/*, update all cross-references, documentation, and configs.

### Phase 0-3: Delete 38 legacy packages + clean types & permissions (commit a2a2d7e0)
## Completed: QA Tech Debt Cleanup — 2026-03-04 ✅

> **Goal**: Fix all issues found in the comprehensive QA analysis: stale JSDoc, fragile closure capture, over-broad cache invalidation, `as any` cleanup.

### Implementation
## Completed: Cross-List DnD Optimistic Update — 2026-03-03 ✅

> **Goal**: Add optimistic cache updates for cross-list attribute DnD transfers so items instantly appear in the target list instead of snapping back and re-appearing after 2-3s server response.

### Implementation
## Completed: DnD QA Pass 5 — Post-Analysis Fixes — 2026-03-03 ✅

> **Goal**: Fix 4 issues from comprehensive QA analysis: backend auto-set display attr, ghost row collision cycle, source list display protection, eslint-disable cleanup.

### Fix 1: Backend auto-set display attribute for first child (MEDIUM)
## Completed: DnD QA Pass 4 — 4 Issues Fix — 2026-03-03 ✅

> **Goal**: Fix 4 new QA issues: jitter on cross-list drag, empty child table drop target, first-attr confirmation dialog, lock display attribute toggle.

### Issue 1: Jitter on cross-list drag (width mismatch)
## Completed: DnD Table Design Restoration & Tech Debt Elimination — 2026-03-03 ✅

> **Goal**: Restore standard table design (FlowListTable) wherever DnD was introduced, extend FlowListTable with built-in DnD support, fix all pre-existing TS errors in EnumerationValueList, clean up redundant DnD components.

### Phase 1: Extend FlowListTable with DnD support
## Completed: DnD QA Critical Debt Closure — 2026-03-03 ✅

> **Goal**: Eliminate all remaining QA blockers for DnD attributes/enumeration values with safe backend enforcement, clean lint status in touched areas, and verified builds/tests.

### Final implementation plan (execution pass)
## Completed: Drag-and-Drop for Attributes & Enumeration Values — 2026-03-03 ✅

> **Goal**: Implement drag-and-drop reordering for root/child attributes and enumeration values. Add cross-list attribute transfer (root ↔ child, child ↔ child) with codename uniqueness and display-attribute validation. New metahub settings control permissions.

> **Plan**: See [memory-bank/plan/dnd-attributes-enum-values-plan-2026-03-03.md](plan/dnd-attributes-enum-values-plan-2026-03-03.md) for detailed implementation plan with code examples.
## Completed: Codename Auto-Convert UX Hardening — 2026-03-03 ✅

> **Goal**: Ensure mixed-alphabet auto-conversion works both for manual codename blur and for codename auto-generation from name across all codename-enabled forms; align settings wording in admin + metahub UI.

### Final implementation plan (execution pass)
## Completed: QA Debt Eradication — 2026-03-03 ✅

> **Goal**: Resolve all issues found in the latest QA pass with safe, minimal, lint-clean changes and no regressions.

### Final implementation plan (execution pass)
## Completed: DnD QA Pass 3 — 4 Issues Fix — 2026-03-03 ✅

> **Goal**: Fix 4 new QA issues found during testing of DnD attributes/enum values feature.

### Issue 1: Enum value row height too short
## Completed: DnD QA Pass 2 — 6 Issues Fix — 2026-03-04 ✅

> **Goal**: Fix 6 issues found during QA testing of DnD attributes/enum values feature.

### Issue 1: Root attribute row height too short
## Completed: QA Remediation — Root Attribute Codename Flow Hardening — 2026-03-03 ✅

> **Goal**: Remove remaining QA gaps in root attribute flow (global-scope duplicate checks, safe disable on duplicate, style-aware codename handling) with minimal and safe changes.

- [x] Align `AttributeList.tsx` with style-aware codename validation/normalization (`normalizeCodenameForStyle` + `isValidCodenameForStyle`) and remove legacy `sanitizeCodename` path for form save/validation
## Completed: Codename Bug Fixes + Global Scope + Button Disable — 2026-03-03 ✅

> **Goal**: Fix 4 QA issues: i18n error text language/case, auto-convert mixed alphabets, disable save button on duplicate, implement attributeCodenameScope global mode.

### Issue 1: i18n + original case in duplicate error
## Completed: Admin i18n fix + Codename Duplicate Check + Element Settings — 2026-03-03 ✅

> **Goal**: Fix "blur" i18n in admin settings, implement reactive codename duplicate checking (with VLC cross-locale uniqueness), add element copy/delete settings.

### Task 1: Fix "blur" i18n in admin settings
## Completed: QA Remediation — Catalog Actions Policy Parity — 2026-03-02 ✅

> **Goal**: Eliminate the remaining QA finding by aligning Catalog list action visibility with metahub policy settings, without changing backend behavior.

### Final implementation plan (execution pass)
## Completed: Comprehensive QA Finalization — 2026-03-02 ✅

> **Goal**: Complete end-to-end QA closure for the latest metahub settings/codename/policy scope with explicit clean-DB safety verdict and prioritized risk matrix.

### Final implementation plan (execution pass)
## Active: Metahub Language/Codename/Attribute Policy Fixes — 2026-03-02

> **Goal**: Implement the newly requested metahub fixes for language defaults, catalog codename behavior, localized codename rendering, attribute delete/copy policies, compact settings UI, and wording clarity.

### Final implementation plan (execution pass)
## Completed: Post-QA Debt Cleanup & Safety Hardening — 2026-03-02 ✅

> **Goal**: Fix all actionable issues found in the latest QA pass with minimal, safe changes and zero new regressions.

### Final implementation plan (execution pass)
## Active: Codename UX/Settings Refinement — 2026-03-02

> **Goal**: Align codename previews, helper texts, and mixed-alphabet behavior in Metahubs + Admin settings, plus fix copy codename casing.

### Final implementation plan (execution pass)
## Completed: QA Safety Remediation — 2026-03-02 ✅

> **Goal**: Fix all remaining QA findings in backend mutation flows with safe, minimal, regression-free changes.

### Final implementation plan
## Active: VLC UX & Settings Consistency Fixes — 2026-03-02

> **Goal**: Resolve all newly reported UX/logic defects for localized codename behavior, metahub settings clarity, and attribute type restrictions without introducing regressions.

### Final implementation plan
## Completed: QA Findings Fix — 2026-03-02 ✅

> **Goal**: Fix all issues discovered during QA analysis of VLC codename implementation. Zero remaining technical debt.

- [x] Add `GET /metahubs/codename-defaults` public endpoint in metahubs-backend (replaces admin-only `/admin/settings/metahubs` call)
## Completed: Settings UX & VLC Fixes — 2026-03-02 ✅

> **Goal**: Fix toggle flickering, VLC codename auto-generation, language sync, admin VLC propagation, and merge migrations.

- [x] Fix toggle flickering after save in metahub settings and admin settings (optimistic cache update)
## Completed: Post-QA Full Remediation — 2026-03-02 ✅

> **Goal**: Fix all remaining issues from the latest QA audit with minimal, safe changes and no residual technical debt in this scope.

- [x] Align metahubs codename blur normalization with style-aware settings (without breaking shared template behavior)
## Completed: QA Risk Closure — 2026-03-02 ✅

> **Goal**: Eliminate all QA findings from the latest comprehensive audit with safe, minimal, regression-free changes.
> **Safety constraints**: preserve existing behavior, avoid broad refactors, keep lint/test/build clean in touched scope.
## Completed: Session Finalization Handoff — 2026-03-02 ✅

> **Goal**: Close implementation session cleanly after comprehensive QA remediation and ensure final handoff consistency.

- [x] Re-check memory-bank closure entries for QA remediation (`tasks.md`, `activeContext.md`, `progress.md`)
## Completed: Comprehensive QA Remediation — 2026-03-02 ✅

> **Goal**: Fix all issues identified in the latest QA analysis without regressions or new technical debt.
> **Safety constraints**: preserve existing business behavior, keep changes minimal, enforce lint/test/build green status.
## Completed: Codename VLC End-to-End Closure — 2026-03-02 ✅

> **Goal**: Finalize codename VLC implementation parity (frontend + backend), verify with lint/build, and close Memory Bank updates.
> **Safety constraints**: keep canonical `codename` uniqueness behavior unchanged, preserve backward compatibility, avoid schema-breaking migrations.
## Completed: QA Hardening Fixes — 2026-03-02 ✅

> **Goal**: Close all issues from the latest QA audit without regressions or leftover technical debt.

- [x] Enforce `allowDelete` policy in all catalog and enumeration delete paths (including hub-scoped and permanent endpoints)
## Completed: QA Defects Remediation — 2026-03-02 ✅

> **Goal**: Fix all problems identified by comprehensive QA (functional bugs, test regressions, lint errors) without introducing new debt.

- [x] Fix critical codename/settings logic defects in backend and frontend
## Completed: Session Closure — 2026-03-01 ✅

> **Goal**: Finalize QA remediation session state across Memory Bank and keep deferred work explicit.

- [x] Reconcile `QA Remediation — 2026-03-02` checklist to actual implementation status
## Completed: QA Remediation — 2026-03-02 ✅

> **Goal**: Remove all QA findings from the latest audit without introducing regressions.
> **Complexity**: Level 4
## Planned Follow-up: Admin Settings Route Tests

- [ ] Add backend route tests for admin settings CRUD and permission/error scenarios
  - Note: `packages/admin-backend/base/package.json` currently has no `test` script; add/align test harness first.
## Completed: Codename Settings & Validation Overhaul — 2026-03-01 ✅

> **Goal**: Make codename generation/validation fully settings-aware across all entity forms. Add new settings (alphabet for kebab, Russian-only alphabet, allow mixed, auto-reformat, require-reformat). Change defaults to pascal-case + en-ru.
> **Complexity**: Level 4
## Completed: Admin Global Settings & Metahub Codename Fixes — 2026-03-02 ✅

> **Goal**: Fix 4 issues: (1) metahub creation 400 error with PascalCase Russian codenames, (2) wrong codename helper text, (3) admin global settings system (migration + entity + routes + frontend), (4) RoleEdit layout broken.
> **Complexity**: Level 3
## Completed: Settings Page UI/UX Fixes — 2026-03-03 ✅

> 5 UI/UX issues on Metahub Settings page fixed. Build 56/56. See progress.md.

---
## Completed: QA Fixes — Post-Settings Implementation — 2026-03-03 ✅

> **Goal**: Fix all issues found during QA analysis: 1 critical bug, prettier errors, code duplication, template seed, UI logic, frontend prep, memory-bank refs.
> **Complexity**: Level 2
## Completed: Metahub Settings Section — 2026-03-02 (IMPLEMENTED)

> **Goal**: Add "Settings" section to Metahub designer with tabbed UI, codename style config, entity-level settings.
> **Status**: ✅ All QA fixes complete — build 56/56
## Completed: VLC Comment Consolidation — Metahubs + Applications (2026-03-02) ✅

> **Goal**: Merge second metahubs migration into first (comment TEXT→JSONB), ensure applications-backend & frontend store/display comment the same VLC way as metahubs.
> **Status**: ✅ Complete — build 56/56
## Completed: PostgreSQL NUMERIC → JS Number Coercion Fix (2026-03-02) ✅

> **Goal**: Fix "Invalid value for kolichestvo: Expected number value" — pg returns NUMERIC columns as strings, causing write validation to fail.
> **Status**: ✅ Complete — build 56/56
## Completed: API Error Message Propagation Fix (2026-03-02) ✅

> **Goal**: Fix hidden 400 error messages — show actual server validation error text to users instead of generic "Request failed with status code 400".
> **Status**: ✅ Complete — build 56/56
## Completed: Documentation Overhaul — GitBook Stubs (2026-03-01) ✅

> **Goal**: Delete all outdated docs (2023 files from Flowise era), create GitBook-standard stub pages in EN/RU.
> **Status**: ✅ Complete — 41 files EN + 41 files RU, line counts matched, root README updated
## Completed: Legacy Packages Removal (10 packages) — 2026-02-28 ✅

> **Goal**: Remove 10 legacy packages and all cross-references (9-phase plan).
> **Status**: ✅ Complete — build 56/56 (was 66/66 before removal)
## Active: PR #698 QA Fixes — 2026-02-28 ✅

> **Goal**: Fix issues found during comprehensive QA analysis of Publication Drill-In.
> **Status**: ✅ Complete — build 66/66, lint 0 errors
## Completed: PR #698 Review Fixes — 2026-02-28 ✅

> **Goal**: Address Copilot bot review comments on PR #698 (Publication Drill-In).
> **Status**: ✅ Complete — pushed commit 2d7e07a4
## Completed: Publication Drill-In UX Polish Round 2 — 2026-02-28 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-28
## Completed: Publication Drill-In UX Polish — 2026-02-28 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-28
## Completed: Publication Create Dialog & Schema Fixes — 2026-02-28 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-28
## Completed: CollapsibleSection Export Fix — 2026-02-28 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-28
## Completed: Publications Drill-In Navigation & Create Dialog Rework — 2026-02-28 ✅

> **Status**: ✅ Complete — Full R1-R9 implementation
> Details: progress.md — 2026-02-28
## Completed: QA Fixes — Publication Drill-In Remediation — 2026-02-28 ✅

> **Status**: ✅ Complete — 10 issues fixed
> Details: progress.md — 2026-02-28
## Completed: Copy UX & QA Remediation — 2026-02-27 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-27
## Completed: Copy Flows & NUMBER Field — 2026-02-26 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-26
## Completed: QA & Architecture — 2026-02-24 to 2026-02-25 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-24 to 2026-02-25
## Completed: QA & Child TABLE Editing — 2026-02-23 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-23
## Completed: TABLE Attribute & QA — 2026-02-21 to 2026-02-22 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-21 to 2026-02-22
## Completed: TABLE Attribute Type — 2026-02-21 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-21
## Completed: Enumerations Feature — 2026-02-18 to 2026-02-19 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-18 to 2026-02-19
## Completed: Migration Guard — 2026-02-18 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-18
## Completed: Dashboard & Architecture — 2026-02-17 to 2026-02-20 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-17 to 2026-02-20
## Completed: Runtime CRUD & QA — 2026-02-14 to 2026-02-16 ✅

> **Status**: ✅ Complete
> Details: progress.md — 2026-02-14 to 2026-02-16
## Completed: Metahubs UX & Migrations — 2026-02-13 to 2026-02-14 ✅

- [x] Boolean fix, auto-fill, presentation tab, UI/UX polish rounds 1-2
- [x] QA remediation, Zod schema, pool starvation fix, widget activation, README rewrite
## Completed: QA Rounds 3-16 & Baseline — 2026-02-11 to 2026-02-12 ✅

- [x] 14 QA rounds: security, atomicity, locks, pool, cache, read-only, scoped repos
- [x] Structure baseline, template cleanup, DDL fixes, 76+ tests
## Completed: Migration Architecture & Templates — 2026-02-10 to 2026-02-11 ✅

- [x] Template system (10 phases), DDL engine (7 phases), migration architecture reset
- [x] Typed metadata, manifest validator, seed executor, plan/apply API
## Completed: PR Review & Layouts/Runtime — 2026-02-05 to 2026-02-09 ✅

- [x] PR #668, menu widget system, layout DnD, runtime + DataGrid, layouts foundation
- [x] Attribute data types (STRING/NUMBER/BOOLEAN/DATE/REF/JSON), display attribute
## [2026-01] Historical Completed Tasks ✅

- Jan 29 — Feb 4: Branches system, Elements rename, three-level system fields, optimistic locking
- Jan 16 — Jan 28: Publications, schema-ddl, runtime migrations, isolated schema, codename field
## [2025-12] Historical Completed Tasks ✅

- Dec 18-31: VLC system, Dynamic locales, Flowise 3.0, AgentFlow, Onboarding wizard
- Dec 5-17: Admin panel, Auth migration, UUID v7, Package extraction, Admin RBAC
## [Pre-2025-12] Historical Tasks ✅

- v0.40.0: Tools/Credentials/Variables extraction, Admin Instances MVP
- v0.39.0: Campaigns, Storages modules, useMutation refactor
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
