# Tasks

> **Note**: Active and planned tasks. Completed work -> progress.md, architectural patterns -> systemPatterns.md.

---

## Active: PR #698 Review Fixes — 2026-02-28 ✅

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
