# Progress Log

> **Note**: Completed work with dates and outcomes. Active tasks -> tasks.md, architectural patterns -> systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release | Date | Codename | Highlights |
| --- | --- | --- | --- |
| 0.46.0-alpha | 2026-01-16 | 0.46.0 Alpha — 2026-01-16 | GH639 Add Applications modules and Metahubs publications; GH641 Refactor Metahubs packages to Domain-Driven Design architecture |
| 0.45.0-alpha | 2026-01-12 | 0.45.0 Alpha — 2026-01-11 (Structured Structure) 😳 | GH630 Internationalize project metadata and update texts; GH632 Add localized fields UI, refactor admin locales, integrate into Metahubs; GH634 Implement Metahubs VLC localization + UI fixes |
| 0.44.0-alpha | 2026-01-04 | 0.44.0 Alpha — 2026-01-04 (Fascinating Acquaintance) 🖖 | GH613 Implement Onboarding Completion Tracking with Registration 419 Auto-Retry; GH615 Implement legal consent feature with Terms of Service and Privacy Policy during registration; GH618 Add consent tracking (Terms of Service and Privacy Policy) for Leads |
| 0.43.0-alpha | 2025-12-27 | 0.43.0 Alpha — 2025-12-27 (New Future) 🏋️‍♂️ | GH609 Metahubs Phase 3: Fix Pagination Display and Localization Issues; GH611 feat: Implement onboarding wizard with start pages i18n |
| 0.42.0-alpha | 2025-12-18 | 0.42.0 Alpha — 2025-12-18 (Dance Agents) 👯‍♀️ | GH601 VLC System Implementation and Breadcrumb Hooks Refactoring; GH603 Dynamic Locales Management System; GH605 Upgrade Flowise Components from 2.2.8 to 3.0.12 |
| 0.41.0-alpha | 2025-12-11 | 0.41.0 Alpha — 2025-12-11 (High Mountains) 🌄 | GH589 Implement admin panel disable system with ENV-based feature flags; GH591 Upgrade axios to 1.13.2 to fix SSRF vulnerability (CVE-2025-27152); GH593 Migrate Auth.jsx to auth-frontend package with TypeScript refactoring |
| 0.40.0-alpha | 2025-12-06 | 0.40.0 Alpha — 2025-12-05 (Straight Rows) 🎹 | GH563 Extract Tools functionality into separate packages; GH565 Extract Credentials functionality into separate packages; GH567 Extract Variables functionality into separate packages |
| 0.39.0-alpha | 2025-11-26 | 0.39.0 Alpha — 2025-11-25 (Mighty Campaign) 🧙🏿 | GH555 Refactor Configuration documentation and remove Spanish docs; GH557 Implement Storages Management with Three-Tier Architecture; GH559 Campaigns Integration: Three-tier Architecture Implementation |
| 0.38.0-alpha | 2025-11-22 | 0.38.0 Alpha — 2025-11-21 (Secret Organization) 🥷 | GH546 UI/UX Improvements: Card Link Preview, Pagination, Search, Routing Update; GH549 Implement Projects Management System with Hierarchical Structure; GH551 Implement AR.js Quiz Nodes Interaction Mode |
| 0.37.0-alpha | 2025-11-14 | 0.37.0 Alpha — 2025-11-13 (Smooth Horizons) 🌅 | GH529 Refactor REST API documentation: OpenAPI 3.1 modular structure with Zod validation; GH531 OpenAPI Documentation Refactoring: Workspace -> Unik Terminology & Description Field; GH533 Refactor Metaverses Frontend: Extract Dashboard Components to Template Package |
| 0.36.0-alpha | 2025-11-07 | 0.36.0 Alpha — 2025-11-07 (Revolutionary indicators) 📈 | GH510 Migrate date formatting to dayjs and refactor metaverse components to TypeScript; GH512 Refactor UI Components in universo-template-mui Package; GH514 Improve code quality and testing coverage for universo-template-mui |
| 0.35.0-alpha | 2025-10-30 | 0.35.0 Alpha — 2025-10-30 (Bold Steps) 💃 | GH497 Migrate flowise-chatmessage and flowise-store to base/ structure + i18n consolidation; GH499 Comprehensive i18n Documentation Update: Main README and Packages Documentation; GH502 QA Analysis: i18n Refactoring, TypeScript Modernization & RLS Integration |
| 0.34.0-alpha | 2025-10-23 | 0.34.0 Alpha — 2025-10-23 (Black Hole) ☕️ | GH495 Global monorepo refactoring: restructure packages, implement tsdown, centralize dependencies |
| 0.33.0-alpha | 2025-10-16 | 0.33.0 Alpha — 2025-10-16 (School Test) 💼 | GH487 Publication System: Fix 429 Errors, API Modernization, and UI Improvements; GH489 MVP Implementation: Metaverses Module Architecture Refactoring and Component Migration; GH493 Implement Quiz Timer Feature with Position Configuration and Bug Fixes |
| 0.32.0-alpha | 2025-10-09 | 0.32.0 Alpha — 2025-10-09 (Straight Path) 🛴 | GH464 Enable canvas version metadata editing flow; GH466 Complete Chatflow to Canvas Terminology Refactoring; GH468 Refactor telemetry to opt-in PostHog |
| 0.31.0-alpha | 2025-10-02 | 0.31.0 Alpha — 2025-10-02 (Victory Versions) 🏆 | GH441 Manual quiz editing workflow to Space Builder; GH444 Ensure Unik deletion removes orphaned canvases; GH447 Fix Space Builder dialog hook order mismatch |
| 0.30.0-alpha | 2025-09-21 | 0.30.0 Alpha — 2025-09-21 (New Doors) 🚪 | GH404 Implement TypeScript Path Aliases Standardization Across Frontend Applications; GH406 Implement Global Publication Library Management System and Lead Points Field; GH408 Analytics: hierarchical Space->Canvas selector & spaces API consolidation |
| 0.29.0-alpha | 2025-09-15 | 0.29.0 Alpha — 2025-09-15 (Cluster Backpack) 🎒 | GH385 Resources: Cluster/Domain/Resource architecture, tenant isolation and security hardening; GH387 Resources follow-ups: remove duplicate cluster link on create, simplify entities-srv repos API, clean logs; GH389 CI: Implement i18n docs consistency checker (PNPM task + GitHub Actions) + usage docs |
| 0.28.0-alpha | 2025-09-07 | 0.28.0 Alpha — 2025-09-07 (Orbital Switch) 🥨 | GH309 Add resources service; GH311 Add resources frontend module and menu entry; GH313 Scaffold entities service |
| 0.27.0-alpha | 2025-08-31 | 0.27.0 Alpha — 2025-08-31 (Stable Takeoff) 🐣 | GH277 Standardize GitHub workflow guidelines and AI assistant rules; GH279 Add Language Switcher to Application Header; GH281 Integrate Template MMOOMM translations into main i18n system |
| 0.26.0-alpha | 2025-08-24 | 0.26.0 Alpha — 2025-08-24 (Slow Colossus) 🐌 | GH267 feat: Extract MMOOMM template into modular package; GH270 feat: Create multiplayer-colyseus-srv application with comprehensive documentation; GH272 Add Kiro IDE configuration and steering rules |
| 0.25.0-alpha | 2025-08-17 | 0.25.0 Alpha — 2025-08-17 (Gentle Memory) 😼 | GH248 Space Builder: three-step flow, Model Settings modal, MUI fixes, docs sync; GH250 Space Builder: constraints input, iterative revise endpoint, read-only preview, i18n, docs sync (EN/RU); GH252 Space Builder - Creation mode (New Space default), safer Append, docs |
| 0.24.0-alpha | 2025-08-12 | 0.24.0 Alpha — 2025-08-12 (Stellar Backdrop) 🌌 | GH222 Comprehensive roadmap documentation enhancement; GH224 Fix: MMOOMM Entity hardcoded transform values override UPDL settings; GH226 The Uniks functionality has been moved to separate packages uniks-srv and uniks-frt |
| 0.23.0-alpha | 2025-08-04 | 0.23.0 Alpha — 2025-08-05 (Vanishing Asteroid) ☄️ | GH203 Complete Russian translation of Configuration and LangChain components documentation; GH206 Added new Russian translations to the CLI, Configuration, Using Flowise and LlamaIndex sections; GH208 Fixed Entity scale handling in MMOOMM asteroid system |
| 0.22.0-alpha | 2025-07-27 | 0.22.0 Alpha — 2025-07-27 (Global Impulse) ⚡️ | GH173 Added Memory Bank rules and refactored memory bank files; GH180 Fix UPDL Component Render Priority in MMOOMM Template; GH182 Update Cursor Memory Bank rules to work better with files |
| 0.21.0-alpha | 2025-07-20 | 0.21.0 Alpha — 2025-07-20 (Firm Resolve) 💪 | GH157 Optimized Memory Bank and upgraded to Alpha status; GH159 Fixed ship movement and logging issues in MMOOMM template; GH161 Changed the location of MMOOMM PlayCanvas handlers |
| 0.20.0-alpha | 2025-07-13 | 0.20.0 Alpha — 2025-07-13 (Tools Revolution) 🔧 | GH139 UPDL nodes have been refactored to improve reliability and consistency; GH141 Refactoring of the logic and UI of the publication system was carried out; GH143 Implemented a rendering page for PlayCanvas publications |
| 0.19.0-pre-alpha | 2025-07-06 | 0.19.0 Pre-Alpha — 2025-07-06 | GH89 Converted "publish-srv" application to workspace package; GH45 Complete refactoring of buildUPDLflow.ts with separation of functionality; GH101 Refactored UPDL types and removed legacy interfaces file |
| 0.18.0-pre-alpha | 2025-07-01 | 0.18.0 Pre-Alpha — 2025-07-01 | GH77 The project has been updated to Flowise version 2.2.8; GH95 Fixed critical bugs found after migration to Flowise 2.2.8; GH98 Fixed TypeScript compilation errors and TypeORM conflicts in Flowise Components |
| 0.17.0-pre-alpha | 2025-06-25 | 0.17.0 Pre-Alpha — 2025-06-25 | Added new fields to User Profile settings by @VladimirLevadnij in #82; Updated menu items Documentation, Chat Flows, Agent Flows by @VladimirLevadnij in #83; GH84 Convert profile-srv to workspace package |
| 0.16.0-pre-alpha | 2025-06-21 | 0.16.0 Pre-Alpha — 2025-06-21 | Fix Russian text in memory bank; Fix Russian comments; Update app READMEs and Russian translations |

---

## 2026-01-31

### Database Pool Error Logging
- **Objective**: Prevent pool exhaustion issues and improve observability when pool errors occur.
- **Changes**:
  - KnexClient pool size capped at 8; added pool error logging with `used/free/pending` metrics.
  - TypeORM pool size capped at 7; added pool error logging with `total/idle/waiting` metrics.
- **Files Changed**:
  - `packages/metahubs-backend/base/src/domains/ddl/KnexClient.ts`
  - `packages/flowise-core-backend/base/src/DataSource.ts`
- **Build**: Full workspace build successful (64 tasks).

### VLC String Field UX Fixes
- **Objective**: Fix VLC (Versioned/Localized Content) string field issues in Element forms.
- **Issues Fixed**:
  1. **Versioned-only fields show language switching UI**: When a field is only versioned (not localized), it shouldn't show language tabs. Added separate 'versioned' mode.
  2. **Missing maxLength enforcement**: VLC fields allowed typing beyond maxLength limit. Now input is blocked at maxLength (like NUMBER fields).
  3. **Missing constraint hints**: VLC fields didn't show helperText with min/max length constraints. Now displays "10-20" style hints.
  4. **No validation for non-primary locales**: Secondary locale fields had no maxLength. Now all locales enforce same limits.
- **Implementation Details**:
  - Added `VersionedFieldProps` type with `mode: 'versioned'` (no language switching)
  - Added `maxLength`/`minLength` props to `BaseProps` interface
  - Created `VersionedInlineField` component (single locale, no language tabs)
  - Updated `SimpleInlineField` with maxLength blocking and constraintText
  - Updated `LocalizedInlineFieldContent` with maxLength blocking for all locales
  - Updated `DynamicEntityFormDialog` to use correct mode based on `validationRules`
- **Files Changed**:
  - `packages/universo-template-mui/base/src/components/forms/LocalizedInlineField.tsx` - Added versioned mode, maxLength support
  - `packages/universo-template-mui/base/src/components/dialogs/DynamicEntityFormDialog.tsx` - Use correct mode and pass maxLength/minLength
- **Build**: 64 tasks successful

### QA Fix: Precision/Scale Limits
- **Objective**: Fix JavaScript number precision limits and scale validation logic.
- **Issues Fixed**:
  1. **maxPrecision too large**: PostgreSQL allows 38 digits, but JavaScript numbers lose precision beyond ~15-16 digits. Reduced maxPrecision from 38 to 15.
  2. **scale can equal precision**: When scale=precision, there are 0 integer digits which is logically invalid. Changed validation to require scale < precision (strictly less).
- **Files Changed**:
  - `packages/universo-utils/base/src/validation/numberValidation.ts` - NUMBER_DEFAULTS.maxPrecision: 15
  - `packages/universo-types/base/src/common/metahubs.ts` - getPhysicalDataType() limits precision to 15, scale to precision-1
  - `packages/metahubs-backend/base/src/domains/attributes/routes/attributesRoutes.ts` - Zod schema: precision max: 15, scale max: 14, strict inequality validation
  - `packages/metahubs-frontend/base/src/domains/attributes/ui/AttributeList.tsx` - UI: precision 1-15, scale 0-(precision-1)
- **Build**: 64 tasks successful

### NUMBER Input UX Improvement
- **Objective**: Replace error-based validation with input restrictions for NUMBER fields.
- **Changes**:
  - Removed validation errors for precision/scale - now enforced by controlled input.
  - Implemented text input (type="text" inputMode="decimal") with digit restrictions.
  - onKeyDown handler blocks invalid characters and excess digits.
  - Format displays fixed decimal places (e.g., "0.00" for scale=2).
  - Shows constraints hint below field (Range/Min/Max, Non-negative).
  - Added precision format indicator (e.g., "8,2") to helper text.
  - Auto-select integer/decimal parts for overwrite editing.
  - Prevent deletion of decimal separator; overwrite decimal digits in-place.
- **Files Changed**:
  - `packages/universo-template-mui/base/src/components/dialogs/DynamicEntityFormDialog.tsx`
- **Build**: 64 tasks successful

### NUMBER Precision/Scale Validation
- **Objective**: Add proper validation for NUMBER fields in element creation and schema sync.
- **Changes**:
  - Created `validateNumber()` utility with precision/scale/min/max/nonNegative checks.
  - Added `validateNumberOrThrow()` for sync operations that throw instead of returning null.
  - Backend MetahubElementsService.validateRules() now validates precision/scale.
  - applicationSyncRoutes.ts throws on overflow instead of silently setting null.
- **Files Changed**:
  - `packages/universo-utils/base/src/validation/numberValidation.ts` (new)
  - `packages/universo-utils/base/src/index.ts` (export)
  - `packages/universo-utils/base/src/index.browser.ts` (export)
  - `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubElementsService.ts`
  - `packages/metahubs-backend/base/src/domains/applications/routes/applicationSyncRoutes.ts`
- **Build**: 64 tasks successful

---

## 2026-01-30

### QA Fixes Round 3
- **Objective**: Fix schema sync failure caused by numeric overflow in predefined elements.
- **Fix**:
  - Added numeric normalization for NUMERIC(precision, scale) fields in `seedPredefinedElements()`.
  - Logs warnings and sets offending numeric values to null to avoid sync failure.
- **Files Changed**:
  - `packages/metahubs-backend/base/src/domains/applications/routes/applicationSyncRoutes.ts`
- **Build**: 64 tasks successful

### QA Fixes Round 2
- **Objective**: Fix additional issues discovered during QA testing.
- **Issues Fixed**:
  1. **MuiAlert severity colors**: Removed custom `info` palette from `colorSchemes` (light/dark) in themePrimitives.ts. Alert now uses standard MUI colors.
  2. **Number input minus sign**: Fixed logic in `handleNumberKeyDown` to check `currentValue.length > 0` before applying restrictions, allowing minus for empty fields.
  3. **JSON sync error for VLC fields**: Updated `seedPredefinedElements()` in applicationSyncRoutes.ts to use `JSON.stringify()` for primitive values in VLC/JSONB columns.
- **Files Changed**:
  - `packages/universo-template-mui/base/src/themePrimitives.ts` (removed info palette from colorSchemes)
  - `packages/universo-template-mui/base/src/components/dialogs/DynamicEntityFormDialog.tsx` (already fixed earlier)
  - `packages/metahubs-backend/base/src/domains/applications/routes/applicationSyncRoutes.ts` (added VLC handling)
- **Build**: 64 tasks successful

### QA Fixes for Physical Type Display
- **Objective**: Fix 5 issues found during QA testing of the physical PostgreSQL type display feature.
- **Issues Fixed**:
  1. **MuiAlert severity colors**: Removed hardcoded orange styles from `feedback.tsx`. Now Alert uses standard MUI severity colors (info=blue, warning=orange, error=red, success=green), keeping only `borderRadius: 10`.
  2. **Duplicate type mapping logic**: Refactored `SchemaGenerator.mapDataType()` in @universo/schema-ddl to use `getPhysicalDataType()` + `formatPhysicalType()` from @universo/types instead of duplicating the mapping switch statement.
  3. **IIFE anti-pattern**: Replaced inline IIFE `{(() => { ... })()}` in AttributeFormFields with `useMemo` hook for computing physicalTypeInfo.
  4. **Number input validation**: Added `handleNumberKeyDown` function to block minus key for `nonNegative` fields and prevent double minus (`--`). Minus is only allowed at position 0.
  5. **Redundant VLC Alert**: Removed the separate VLC info Alert from STRING type settings since VLC status is now shown in the PostgreSQL type Alert with "(VLC)" suffix.
- **Files Changed**:
  - `packages/universo-template-mui/base/src/themes/mui-custom/customizations/feedback.tsx`
  - `packages/universo-template-mui/base/src/components/dialogs/DynamicEntityFormDialog.tsx`
  - `packages/metahubs-frontend/base/src/domains/attributes/ui/AttributeList.tsx`
  - `packages/schema-ddl/base/src/SchemaGenerator.ts`
- **Build**: Full workspace build successful (64 tasks).

### Physical PostgreSQL Type Display in Attribute UI
- **Objective**: Add UI indication of computed PostgreSQL type to clarify how attributes will be stored in application database.
- **Background**: `data_type` column stores logical type (STRING, NUMBER, DATE, etc.), while `validation_rules` stores settings. SchemaGenerator.mapDataType() computes physical PostgreSQL type at sync time.
- **Architectural Decision**: Keep logical type in `data_type` + settings in `validation_rules` (current approach). Add computed display for user clarity.
- **Changes**:
  - **@universo/types**: Added `PhysicalTypeInfo` interface, `getPhysicalDataType()` and `formatPhysicalType()` helper functions that mirror SchemaGenerator.mapDataType() logic without Knex dependency.
  - **metahubs-frontend/types.ts**: Re-exported new functions and PhysicalTypeInfo type.
  - **AttributeList.tsx**: Added MUI Tooltip to dataType column showing "PostgreSQL: VARCHAR(1024)" etc. on hover; added info Alert in form showing computed type dynamically.
  - **i18n (EN/RU)**: Added `attributes.physicalType.label` and `attributes.physicalType.tooltip` keys.
- **Type Mappings Displayed**:
  - STRING → TEXT (default), VARCHAR(n) with maxLength, JSONB with versioned/localized
  - NUMBER → NUMERIC(precision,scale)
  - DATE → DATE/TIME/TIMESTAMPTZ based on dateComposition
  - BOOLEAN → BOOLEAN, REF → UUID, JSON → JSONB
- **Build**: Full workspace build successful.

### QA Fix: Attribute Validation Rules in Element Form
- **Objective**: Fix validation rules not being applied in Element creation/edit dialog.
- **Root Cause**: ElementList.tsx was hardcoding `localized: attribute.dataType === 'STRING'` instead of reading from validationRules.
- **UX Improvement**: Moved versioned/localized settings from JSON to STRING type for user clarity (all "String" fields from user perspective, even if stored as JSONB internally).
- **Changes**:
  - **@universo/types**: Removed JsonTypeConfig interface, moved versioned/localized to STRING settings in AttributeValidationRules
  - **@universo/schema-ddl**: mapDataType now returns JSONB for STRING when versioned||localized is true
  - **@universo/template-mui**: Added DynamicFieldValidationRules interface, extended DynamicFieldConfig with validationRules property, updated renderField for all types (STRING: localized/versioned check, minLength/maxLength; NUMBER: min/max/nonNegative/scale; DATE: dateComposition → date/time/datetime-local)
  - **metahubs-frontend AttributeList.tsx**: Moved VLC settings from JSON to STRING section, added [V][L] Chips in dataType table column, removed JSON from hasTypeSettings
  - **metahubs-frontend ElementList.tsx**: Now passes attribute.validationRules to DynamicFieldConfig
  - **i18n (EN/RU)**: Moved versioned/localized keys from typeSettings.json to typeSettings.string
- **Build**: Full project build successful.

### DATE Input Year Digits Fix (Round 3)
- **Objective**: Fix HTML5 date inputs allowing 5+ digit years (e.g., "275760" instead of "2026").
- **Root Cause**: Browser native `<input type="date">` and `<input type="datetime-local">` do not restrict year length by default.
- **Solution Implemented**:
  - Added `normalizeDateValue()` helper function that truncates year to 4 digits while preserving rest of date string.
  - Added `max` attribute: `9999-12-31` for date, `9999-12-31T23:59` for datetime-local (provides browser validation + some prevention).
  - Combined approach: `max` for native validation + `normalizeDateValue` on `onChange` for input restriction.
- **Technical Details**: Function extracts year portion before first `-`, checks if > 4 digits, keeps only last 4 digits.
- **Build**: @universo/template-mui successful.

### Inline Validation & Helper Text for Element Form
- **Objective**: Provide immediate UI validation feedback for constrained fields and disable Save when invalid.
- **Frontend Changes**:
  - ElementList now provides helper text for STRING length constraints (min/max) using i18n keys.
  - DynamicEntityFormDialog validates STRING length, NUMBER min/max/nonNegative, and DATE formats; shows error messages inline and disables Save while invalid.
  - DATE inputs now enforce stricter pattern/length expectations (year length) with input patterns.
- **i18n**: Updated numeric labels to clarify total digits vs decimal places (EN/RU).
- **Build**: @universo/template-mui and metahubs-frontend build successfully.

### Validation UX Round 2
- **Objective**: Address user feedback on validation behavior.
- **Changes**:
  - STRING maxLength: Re-added HTML maxLength attribute to prevent typing beyond max (UX preference: block input vs show error).
  - Save button: Added `disabled={isSubmitDisabled}` prop that was missing, causing button to remain active with validation errors.
  - DATE/DATETIME: Removed custom `normalizeDateInputValue` and `rotateDigits` functions; let native browser inputs handle keyboard navigation between date/time sections (day, month, year, hours, minutes) automatically.
- **Technical Note**: Browser native `<input type="date">` and `<input type="datetime-local">` have built-in section navigation (Tab/arrow keys) and proper overflow handling.
- **Build**: @universo/template-mui successful.

### Validation UX Follow-up
- **Objective**: Address remaining validation UX issues for max length, number ranges, and date/time inputs.
- **Changes**:
  - Removed HTML maxLength locking to allow inline errors to surface for max length violations.
  - Added helper text for NUMBER min/max and non-negative constraints.
  - Improved date/time input normalization to prevent full reset on invalid year input and support rotation behavior.
  - Updated numeric precision label to "Length" (EN/RU).
- **Build**: @universo/template-mui and metahubs-frontend build successful.

### Enhanced Attribute Types with Type-Specific Settings
- **Objective**: Implement 1C:Enterprise-like configurable attribute type system with settings per type.
- **Types Updated**: Removed DATETIME, kept 6 types (STRING, NUMBER, BOOLEAN, DATE, REF, JSON).
- **Type Settings Added**:
  - STRING: maxLength (null=unlimited TEXT, or VARCHAR(n)), minLength
  - NUMBER: precision (1-38), scale, min, max, nonNegative
  - DATE: dateComposition (date/time/datetime) - replaces old DATETIME type
  - JSON: versioned, localized (VLC pattern support)
- **Backend Changes**:
  - @universo/types: Added StringTypeConfig, NumberTypeConfig, DateTypeConfig, JsonTypeConfig, AttributeValidationRules interfaces, getDefaultValidationRules() helper
  - @universo/schema-ddl: mapDataType() now accepts optional config for VARCHAR(n), NUMERIC(p,s), DATE/TIME/TIMESTAMPTZ
  - metahubs-backend: Extended Zod validationRulesSchema with cross-field validation, removed DATETIME from migration enum
- **Frontend Changes**:
  - metahubs-frontend: Added collapsible "Type Settings" panel in AttributeFormFields with conditional rendering per type
  - Removed DATETIME from dataTypeOptions
  - Added validationRules to form handling and API payload
- **i18n**: Added typeSettings keys (EN/RU), removed datetime key
- **Tests**: Updated SchemaGenerator tests for new mapDataType signature with config parameter
- **Build**: Full project build successful.

---

## 2026-01-29

### Fix Element Create 400 for DATE Time Composition
- **Issue**: Element creation failed with 400 when DATE attributes used dateComposition = time (time-only strings like "11:11" failed Date.parse validation).
- **Backend Fix**: Updated MetahubElementsService DATE validation to honor dateComposition and accept time-only strings; added date/time validators.
- **Build**: metahubs-backend build successful.

### Optimistic Lock Conflict Handling Fix
- **Issue**: OptimisticLockError was returning 500 because the router-level error handler intercepted errors before the global middleware.
- **Backend Fix**: Added duck-typed OptimisticLockError handling in the router error handler to return 409 with conflict payload.
- **Global Middleware**: Kept duck-typed OptimisticLockError detection to support cross-bundle class instances.
- **Email Restoration**: Added updatedByEmail lookup in router-level conflict response to show editor email.
- **Build**: @flowise/core-backend rebuilt successfully.
- **Verification**: User tested and confirmed working (409 + ConflictResolutionDialog with email display).

### Optimistic Lock QA Remediation
- **Conflict Metadata**: Moved metahub `_uplUpdatedBy/_uplUpdatedAt` assignment to after version check for accurate conflict data.
- **Audit Fields**: Added updatedBy propagation for branch updates and publication updates.
- **Tests**: Added VersionColumn to TypeORM jest mocks and reran tests.
- **Test Results**:
  - metahubs-backend: multiple failures in routes tests (branches options meta, board summary counts, catalogs routes 500s, metahubs routes expectations).
  - applications-backend: connectors routes and applications members tests failing; multiple 500s and expectation mismatches.

## 2026-01-28

### Optimistic Locking Email Lookup Rollout
- **Backend Phase 1**: Added email lookup to conflict responses for 7 entities:
  - Branch (branchesRoutes.ts)
  - Publication (publicationsRoutes.ts) — also fixed entityType from 'catalog' to 'publication'
  - Hub (hubsRoutes.ts)
  - Catalog (catalogsRoutes.ts) — both PATCH routes updated
  - Attribute (attributesRoutes.ts)
  - Element (elementsRoutes.ts)
  - Connector (connectorsRoutes.ts) — also fixed entityType from 'catalog' to 'connector'
- **Backend Phase 2**: Full optimistic locking implementation for Application entity:
  - Added `expectedVersion` to Zod schema
  - Added version check logic with 409 response
  - Added email lookup for conflict info
- **Frontend Phase 3**: Updated API functions with `expectedVersion` parameter:
  - branches/api/branches.ts — updateBranch
  - publications/api/publications.ts — UpdatePublicationPayload + updatePublication
  - applications.ts — ApplicationInput + updateApplication
  - connectors.ts — updateConnector
- **Pattern**: All entities now return `updatedByEmail` in conflict response, fetched via `SELECT email FROM auth.users WHERE id = $1`
- **Builds verified**: metahubs-backend, applications-backend, metahubs-frontend, applications-frontend

### Optimistic Locking Version Field Implementation
- **Root Cause Fix**: API responses were missing `version` field, causing frontend to send `expectedVersion: undefined` which bypassed version checks.
- **Metahubs API**: Added `version: m._uplVersion || 1` to list, get, create, update endpoints in `metahubsRoutes.ts`.
- **Publications API**: Added `version` field to `/publications/available` SQL query and all CRUD endpoints in `publicationsRoutes.ts`.
- **Branches API**: Added `version: branch._uplVersion || 1` to list options, list, get, create, update endpoints in `branchesRoutes.ts`.
- **Connectors API**: Unified response format with explicit `version: connector._uplVersion || 1` field in get, create, update endpoints in `connectorsRoutes.ts`.

### Optimistic Locking Version Check Implementation
- **Metahubs UPDATE**: Added `expectedVersion` to Zod schema and version check before save with 409 Conflict response.
- **Branches UPDATE**: Added `expectedVersion` to schema, service, and routes with 409 response.
- **Publications UPDATE**: Added `expectedVersion` to schema with inline version check and 409 response.
- **Connectors UPDATE**: Added `expectedVersion` to schema with inline version check and 409 response.
- **Build/Test**: metahubs-backend and applications-backend builds successful.

### Key Files Modified
- `packages/metahubs-backend/base/src/domains/metahubs/routes/metahubsRoutes.ts`: 4 endpoints updated.
- `packages/metahubs-backend/base/src/domains/publications/routes/publicationsRoutes.ts`: SQL query + 4 endpoints updated.
- `packages/metahubs-backend/base/src/domains/branches/routes/branchesRoutes.ts`: 5 endpoints updated.
- `packages/applications-backend/base/src/routes/connectorsRoutes.ts`: 3 endpoints unified.

---

## 2026-01-27

### Three-Level System Fields Architecture
- **Architecture**: Implemented three-level prefixed system fields (`_upl_*`, `_mhb_*`, `_app_*`) for cascade soft delete and audit tracking.
- **Platform Fields (`_upl_*`)**: `created_at`, `created_by`, `updated_at`, `updated_by`, `version`, `deleted`, `deleted_at`, `deleted_by` — present in all entities.
- **Metahub Fields (`_mhb_*`)**: `published`, `published_at`, `unpublished_at`, `archived`, `archived_at` — for Design-Time entities in `mhb_*` schemas.
- **Application Fields (`_app_*`)**: `published`, `published_at`, `unpublished_at`, `archived`, `archived_at`, `deleted`, `deleted_at`, `deleted_by` — for Run-Time entities in `app_*` schemas.
- **Entity Updates**: All TypeORM entities updated with new field names (e.g., `_uplCreatedAt`, `_uplCreatedBy`).
- **Migration Consolidation**: Migrations updated to use new column names with proper defaults.
- **User ID Propagation**: Fixed `_upl_created_by`/`_upl_updated_by` across all routes:
  - `catalogsRoutes.ts`: Added `createdBy`/`updatedBy` to catalog create/update.
  - `attributesRoutes.ts`: Added `createdBy`/`updatedBy` to attribute create/update.
  - `elementsRoutes.ts`: Added `createdBy`/`updatedBy` to element create/update.
  - `publicationsRoutes.ts`: Added `_uplCreatedBy`/`_uplUpdatedBy` to publication and auto-created entities.
  - `connectorsRoutes.ts`: Added `resolveUserId` helper and user fields to connector/publication operations.
- **SchemaGenerator Fix**: Updated `syncSystemMetadata` to use `_upl_created_at`/`_upl_updated_at` column names.
- **Version Increment Fix**: Changed `MetahubBranchesService` to use `createQueryBuilder().update()` to avoid double version increment.
- **Build/Test**: metahubs-backend, applications-backend, schema-ddl builds successful.

### Key Files Modified
- `packages/metahubs-backend/base/src/database/entities/*.ts`: All entities with `_upl*` fields.
- `packages/applications-backend/base/src/database/entities/*.ts`: All entities with `_upl*` and `_app*` fields.
- `packages/schema-ddl/base/src/SchemaGenerator.ts`: System tables and `syncSystemMetadata` with new column names.
- `packages/*/routes/*.ts`: User ID propagation for audit fields.

---

## 2026-01-24

### Metahubs elements rename + UI sync
- Records renamed to Elements across metahubs backend/frontend (routes, services, types, snapshot, `_mhb_elements`).
- Metahub edit dialog includes Storage tab; Publications → Applications tab shows name/description only.
- Metahub menu reordered with dividers; docs updated; builds passed for metahubs-backend, metahubs-frontend, template-mui.

---

## 2026-01-23

### Metahub Codename + Migration Squash + Menu Order
- **Migrations**: Squashed metahubs migrations into `1766351182000-CreateMetahubsSchema.ts` (publications, versions, schema_name, codename). Removed later migration files and updated registry.
- **Metahub Codename**: Added `metahubs.metahubs.codename` (unique) with backend validation/search; responses now include codename.
- **Connectors/Publications**: `/publications/available` and connector publication joins now use Metahub codename (not UUID/slug).
- **Metahub UI**: Create/edit dialogs include codename with auto-fill and validation; i18n keys added (EN/RU); tests updated.
- **Side Menu**: Added divider support in template-mui and reordered Metahub menu: Board → Publications → Access | Hubs → Catalogs.
- **Build/Test**: `@universo/metahubs-backend`, `@universo/applications-backend`, `@universo/metahubs-frontend`, `@universo/template-mui` builds successful.

### Publication Snapshots + App System Tables
- **System Tables Renamed**: `_sys_*` → `_app_*` for app schemas; schema-ddl updated with tests.
- **Snapshot Versioning**: Publication versions now store full MetahubSnapshot (incl. all metahub records and hubs) with stable SHA-256 hash and normalized snapshot format version `1`.
- **Active Version Wiring**: Version creation/activation now updates `publication.activeVersionId`.
- **Application Sync**: Uses active version snapshot, skips diff by hash when possible, stores snapshot meta in `_app_migrations`, seeds predefined records into app tables.
- **Snapshot Hashing**: Switched to `json-stable-stringify` for deterministic snapshot hashing.
- **QoL Fixes**: Attribute sort order appends by default; record timestamps returned in camelCase; hub table_name persisted; snapshot JSON key order aligned; publication snapshot stored in dedicated migration column.
- **QA Fixes**: Snapshot loads all hubs, full catalog.config preserved, record seeding skips invalid required fields, records API no longer accepts ownerId, utils stableStringify uses json-stable-stringify.
- **QA Follow-ups**: HubRecord ownerId is nullable in frontend types; seed warnings are persisted into migration meta.
- **UI Seed Warnings**: Migration detail API now returns seed warnings; Applications UI shows them in migration details (i18n added).
- **Seed Warnings Indicator**: Migrations list shows a warning icon; sync API includes seedWarnings when present.
- **Frontend**: Versions UI warns on duplicate snapshots (i18n added).
- **Docs**: Metahubs backend README updated to `_app_*` tables.
- **Build/Test**: schema-ddl tests + builds, metahubs-backend build, metahubs-frontend build successful.

### Metahub UI Tweaks + Attribute Search + Record Ordering
- **Metahub Forms**: Added divider before codename field in create/edit dialogs to match Catalog layout.
- **Metahub List**: Removed Catalogs column; added sortable Codename column (backend and frontend sortBy support).
- **Attribute Search**: Attributes search now matches localized name content in addition to codename.
- **Record Columns**: Record list columns now follow attribute `sortOrder` left-to-right.
- **Build/Test**: metahubs-backend and metahubs-frontend builds successful.

### Attributes Limit + Locale Sort + Pagination Banner
- **Limit Enforcement**: Backend blocks attribute creation after 100 per catalog (409 with code).
- **Locale Sort**: Attributes list sorting by name uses current locale with VLC fallbacks.
- **Limit UX**: Attributes list shows info banner when limit reached; Add button disabled at 100.
- **Queries**: Attribute list requests include locale; count query added for limitReached detection.
- **Build/Test**: metahubs-backend and metahubs-frontend builds successful.

### PR Review Fixes (Attributes + RLS + Memory Bank)
- **Attributes Meta**: usePaginated now exposes list meta; removed extra count query and used meta limit in UI/error messages.
- **Attributes List**: totalAll derived from list length to avoid extra COUNT query.
- **RLS**: Added WITH CHECK to publication_versions policy to enforce write access.
- **Memory Bank**: activeContext reduced to a single Current Focus summary.
- **Build/Test**: template-mui, metahubs-backend, metahubs-frontend builds successful.

---

## 2026-01-22

### Metahubs Records Architecture Fix
- **Root Cause**: `MetahubRecordsService` queried non-existent `cat_<UUID>` tables in `mhb_*` schemas.
- **MetahubRecordsService Refactor**: Changed to query `_mhb_records` table with `object_id` filter.
- **schemaSync Simplification**: Removed DDL operations; Design-Time schemas only store metadata.
- **Hubs Unification**: Merged from `_mhb_hubs` into `_mhb_objects` with `kind: 'HUB'` and `table_name: NULL`.
- **Dead Code Removal**: Deleted TypeORM `Hub.ts` entity and all related imports.
- **Build Verification**: Full workspace build successful.

### Key Files Modified
- `MetahubRecordsService.ts`: Query `_mhb_records` instead of `cat_*` tables.
- `schemaSync.ts`: Simplified to only ensure schema exists (no DDL).
- `MetahubSchemaService.ts`: Removed `_mhb_hubs` table creation, use UUID v7.
- `MetahubHubsService.ts`: Query `_mhb_objects` with `kind: 'HUB'`.
- `Hub.ts`: DELETED.
- `catalogsRoutes.ts`: Removed 6 `syncMetahubSchema()` calls.
- `guards.ts`: Updated `HubData` interface for new structure.

### Architecture Clarification
- `mhb_*` schemas: Design-Time metadata only (`_mhb_objects`, `_mhb_attributes`, `_mhb_records`).
- `app_*` schemas: Run-Time data (`cat_<UUID>`, `_sys_*` tables) created during Publication sync.
- Hubs have `table_name: NULL` because they are organizational containers, not data-bearing objects.

---

## 2026-01-21

### Metahub Versioning & Hybrid Schema Isolation (Phases 1-7)
- **Versioning System**: Implemented `PublicationVersion` entity, `SnapshotSerializer` for deterministic snapshots, and version management routes.
- **Frontend Versioning**: Added `VersionsPanel` UI for creating/activating versions.
- **Hybrid Schema Isolation**: Implemented `mhb_<UUID>` schema strategy for Design-Time isolation using `MetahubSchemaService`.
- **Schema Synchronization**: `ensureSchema` and `syncDesignSchema` integrated into metahub/catalog/attribute lifecycles.
- **Migration & Entity Fixes**: Fixed migration order in `metahubs-backend` and `MetahubUser` entity registration.
- **Build Verification**: Full workspace build successful.

### Key Components Touched
- metahubs-backend: `MetahubSchemaService`, `SnapshotSerializer`, `publicationsRoutes`, `metahubsRoutes`.
- metahubs-backend: `Metahub`, `PublicationVersion` entities.
- metahubs-backend: Migrations for schema creation and versioning tables.
- metahubs-frontend: `VersionsPanel`, `PublicationActions`.

## 2026-01-20

### Refactor Connector-Publication Link (In Progress)
- Renamed connectors_metahubs → connectors_publications; metahub_id → publication_id; FK to metahubs.publications(id).
- Backend: ConnectorPublication entity, updated connectorsRoutes, applicationMigrationsRoutes, applicationSyncRoutes, /publications/available.
- Frontend: new types/API/hooks and selection panels; ConnectorList/Board/Actions/DiffDialog updated.
- UI: Metahubs tab label, Create/Sync Schema toggle, single-publication limit + PublicationList banner.
- i18n keys added (EN/RU); build success (64 tasks).
- Pending: manual schema creation flow QA.
- ConnectorDiffDialog now shows tables to be created when schema missing.
- PublicationSelectionPanel displays Metahub names but returns publication IDs internally.
- Add button in PublicationList disabled when publication already exists.
- Single-publication limit enforced with 400 error and user-facing banner.

### Key Components Touched
- applications-backend: ConnectorPublication entity + connectorsRoutes.ts updates.
- metahubs-backend: publicationsRoutes.ts and applicationSyncRoutes.ts adjustments.
- applications-frontend: connectorPublications.ts API client.
- applications-frontend: useConnectorPublications.ts hook.
- applications-frontend: PublicationSelectionPanel component.
- applications-frontend: ConnectorPublicationInfoPanel/Wrapper components.
- applications-frontend: ConnectorBoard and ConnectorActions updates.
- applications-frontend: ConnectorDiffDialog schema-create flow.

### @universo/schema-ddl QA Fixes
- Prettier cleanup, test migration into schema-ddl, and static imports in createDDLServices().
- Tests: 80 passed; build success (64 tasks).
- Migrated SchemaGenerator/MigrationManager tests from metahubs-backend.
- Verified no duplication between schema-ddl and metahubs-backend re-exports.
- eslint --fix applied to schema-ddl source formatting.
- createDDLServices uses static imports to avoid runtime require().

## 2026-01-19

### Publications access cleanup + connector UI polish
- Removed publications_users table and entity relations; /publications/available uses metahubs_users with slug/schema_name mapping.
- Migration updated to drop publications_users tables, indexes, and RLS policies.
- Connector UI i18n fixes: table codename, created label, search placeholder, locked text.
- Admin instances notice text/layout adjusted for MVP messaging.
- Connector list relation column + Metahub chip; connector name hover styling aligned with ApplicationList.
- schema-ddl cleanup: statement_timeout parameterized, deprecated static wrappers removed, tests updated.
- Build: 64 tasks successful.
- Publication entity cleaned up to remove PublicationUser OneToMany relation.
- Entities index and backend exports updated to drop PublicationUser.
- /publications/available now uses request-scoped manager for RLS context.
- Connector list shows relation column (25% width) with Metahub chip in table + card views.
- Admin notice banner spacing aligned with connector list banner spacing.

### Key Components Touched
- metahubs-backend: publicationsRoutes.ts access query + codename mapping.
- metahubs-backend: Publication entity cleanup + exports.
- applications-frontend: connector list i18n + table headers.
- applications-frontend: connector list relation column + Metahub chip.
- applications-frontend: connector name link styling.
- applications-frontend: admin instances notice copy + layout.
- schema-ddl: locking utilities + deprecated wrappers removal.
- migrations: publications_users table removal + RLS policy updates.

### @universo/schema-ddl package extraction
- Created standalone package to break metahubs-backend ↔ applications-backend circular dependency.
- DI pattern used; createDDLServices(knex) factory introduced.
- Moved naming/types/snapshot/diff/SchemaGenerator/SchemaMigrator/MigrationManager into schema-ddl.
- metahubs-backend uses getDDLServices wrapper; applications-backend imports generateSchemaName directly.
- Build: 64 tasks successful.
- schema-ddl now owns locking helpers and migration name generation.
- metahubs-backend keeps only domain-specific KnexClient and catalog definitions.

## 2026-01-18

### Publication/Connector QA Fixes + Application-Centric Sync
- Fixed connector create dialog issues (MetahubSelectionPanel import, togglesDisabled, schemaName generation).
- Refactored sync to be application-centric with /:applicationId/diff and /:applicationId/sync endpoints.
- Frontend uses applicationId for diff/sync; ConnectorBoard and ConnectorDiffDialog updated.
- Build: 63 tasks successful.
- New schema naming uses app_<applicationId> and supports manual applications without publications.
- Diff preview and sync flow now work for auto-created and manual applications.

### Key Components Touched
- applications-backend: applicationsRoutes.ts new diff/sync endpoints.
- applications-frontend: connectors.ts API updated to use applicationId.
- applications-frontend: useConnectorSync.ts applicationDiff hook.
- applications-frontend: ConnectorBoard uses applicationId for sync.
- applications-frontend: ConnectorDiffDialog accepts applicationId prop.
- applications-frontend: queryKeys.ts adds applicationDiff factory.
- metahubs-backend: schema naming logic aligned to Application UUID.
- migrations: schemaName generation and sync workflow updated.

### Publication as Separate Entity
- Introduced Publication/PublicationUser entities and access mode enums.
- Backend routes refactored; new linked applications endpoint.
- Frontend AccessPanel/ApplicationsPanel added; i18n keys updated (EN/RU).
- Build: 63 tasks successful.
- Publication dialog tabs reorganized for General/Metahubs/Access/Applications.
- Added API types for access mode and linked applications.
- Added access mode fields to Publication display and edit payloads.
- Publication schema/status fields tracked on entity.

### Publication/Connector QA Fixes (Round 2)
- Auto-create Application/Connector when Publication is created with autoCreateApplication.
- Publication UI cleanup (removed broken links/actions, updated dialog tabs).
- Build: 63 tasks successful.
- Connector create dialog uses Metahubs selection; codename fields removed.
- Removed redundant connectors_publications table and legacy exports.
- Publication cards no longer link to removed board routes.

### Key Components Touched
- metahubs-backend: publicationsRoutes.ts autoCreateApplication logic.
- metahubs-frontend: publication dialog tabs and actions cleanup.
- applications-backend: ConnectorMetahub usage cleanup.
- applications-frontend: connector form validation + tabs cleanup.
- migrations: connectors_publications rollback + cleanup.
- UI: Publication cards/table link removal.
- i18n: publication tabs/access mode keys.
- tests: publication board removal from exports/tests.

## 2026-01-17

### DDL + Migrations + Connector fixes
- Added DDL unit tests (naming/diff/snapshot/SchemaGenerator/MigrationManager), 7 suites / 127 tests.
- Tests cover initial deploy, add/drop tables/columns, kind changes, snapshot mapping, and migration history.
- Fixed migrations API URLs by removing /metahubs prefix; build success (63 tasks).
- Updated applications-frontend API client to align with application routes.
- ConnectorBoard now fetches application details directly; initial schema creation records migrations.
- Added GenerateFullSchemaOptions export to support initial migration recording.
- Breadcrumbs and connector routes updated for connectorId support; i18n keys added.
- Publication list responses now include connectorId for routing.
- Schema creation UX improved for missing schema; status fields returned by application endpoint.
- Sync endpoint path fixed (/metahub/...); debug logs cleaned; builds verified.
- Fixed connector metahub query to use metahubs.slug + request-scoped manager.
- Migration recording enabled for sync; sync UI moved under Applications routes.
- Added first-connector helper hook to simplify application connector navigation.
- Runtime migrations system implemented (MigrationManager, routes, UI, navigation).
- Added migrations UI tab with rollback dialog and destructive-change warnings.
- Application metadata tables (phase 1) extended in metahubs definitions.
- Added migrations namespace to applications i18n consolidation.
- Application detail API now returns schemaName/schemaStatus/schemaSyncedAt/schemaError fields.
- Connector routes adjusted to include connectorId before later simplification to app-level routing.

### Key Components Touched
- applications-frontend: migrations.ts API client path updates.
- applications-frontend: ConnectorBoard useApplicationDetails hook.
- metahubs-backend: SchemaGenerator generateFullSchema options.
- metahubs-backend: publicationsRoutes.ts recordMigration flag.
- applications-frontend: NavbarBreadcrumbs connector segment.
- applications-frontend: ConnectorBoard/Routes connectorId handling.
- applications-frontend: migrations tab + rollback UI.
- template-mui: ApplicationMigrations route + menu item.
- metahubs-backend: applicationMigrationsRoutes.ts endpoints.
- metahubs-backend: connector metahub join query fixes.
## 2026-01-16

### Metahubs backend domain refactor
- Moved backend routes into domain folders (metahubs/hubs/catalogs/attributes/records/publications + shared).
- Extracted runtime DDL tooling to domains/ddl (SchemaGenerator/SchemaMigrator/KnexClient + diff/naming).
- Removed legacy folders (routes/schema/schemas/services) and updated tests/imports.
- Updated README structure to reflect the domain layout.
- Build: pnpm --filter @universo/metahubs-backend build.

### Metahubs backend tests + ddl rename
- Renamed runtime-schema folder to `domains/ddl` and updated imports/docs.
- Fixed metahubsRoutes tests to match sorting/search/members enrichment logic.
- Moved `isolatedModules` setting into `tsconfig.test.json` (removed ts-jest warning).
- Tests: pnpm --filter @universo/metahubs-backend test.

### Metahubs frontend modular refactor
- Introduced domain-based folders (metahubs/hubs/catalogs/attributes/records/publications + shared) in metahubs-frontend.
- Moved UI pages/actions into domain UI modules; added page/action wrappers for compatibility exports.
- Moved API and hooks into domain modules; kept stable re-exports via src/api.
- Updated internal imports to use shared query keys and cross-domain API references.
- Build: pnpm --filter @universo/metahubs-frontend build.

### Metahubs frontend cleanup + domain barrels
- Removed pages and api proxy layers; updated package exports and entry mocks.
- Added domain barrel exports and shared API client; reduced cross-domain import depth.
- Split mutation hooks into per-domain modules; updated UI imports and tests.
- Updated template-mui routes to lazy-load from root metahubs-frontend exports.
- Build: pnpm --filter @universo/metahubs-frontend build.

### Metahubs frontend build-first + docs + tests
- Switched metahubs-frontend to build-first exports (dist entry for `src/index.ts` + tsdown entry updated).
- Removed temporary `src/index.d.ts` stub; aligned package.json exports to dist.
- Updated README.md + README-RU.md to drop `/api` imports and align docs structure.
- Fixed metahubs-frontend tests (api wrappers mock path, view preference mock shape, action factories/mutations/useMetahubDetails mocks).
- Adjusted vitest coverage include/exclude to focus on metahubs MVP scope.
- Tests: pnpm --filter @universo/metahubs-frontend test (warnings remain: act/MSW/useHasGlobalAccess).
- Tests: pnpm --filter @universo/metahubs-backend test (security warn logs expected).
- Build: full monorepo `pnpm build` successful (tsdown/import.meta + chunk size warnings pre-existing).

### Metahubs API route standardization + test/coverage cleanup
- Standardized backend routes to singular detail paths (metahub/hub/catalog/attribute/record/publication) and aligned public routes mount.
- Updated metahubs-frontend API clients, template-mui breadcrumb fetches, and MSW handlers for new paths.
- Added MSW handler for `/api/v1/profile/settings` and mocked useHasGlobalAccess to reduce test warnings.
- Restored shared/utils coverage and added tests for queryKeys/localizedInput.
- Tests: pnpm --filter @universo/metahubs-frontend test; pnpm --filter @universo/metahubs-backend test (security warn logs expected).
- Build: `pnpm build` started but timed out after ~200s; needs re-run to confirm full build.

## 2026-01-15

### Applications connectors refactor
- Renamed Sources -> Connectors across applications-backend/frontend (entities, routes, guards, tests).
- Updated publications integration in metahubs-backend and metahubs UI copy to connector terminology.
- Updated template-mui routes/menu/breadcrumbs + universo-i18n menu keys to connectors.
- Updated applications READMEs (EN/RU) to connector terminology and /connectors paths.
- Build: @universo/template-mui rebuilt to refresh dist imports.
- Tests: pnpm --filter @universo/applications-backend test; pnpm --filter @universo/applications-frontend test (pre-existing warnings remain).

### Applications frontend test noise cleanup
- MSW handler added for connectors metahubs endpoint.
- Mocked useHasGlobalAccess in test setup to avoid AbilityContext warnings.
- ApplicationMembers tests now await async updates (act/waitFor).
- Tests: pnpm --filter @universo/applications-frontend test.

### Types unification (canonical types)
- Standardized pagination/filter types in @universo/types (items array + filter configs).
- Removed PaginationMeta duplicates; template-mui dependency updated.
- @universo/template-mui re-exports shared types; only MUI-specific types remain.
- Pagination types migrated across 11 frontends; UseApi removed from 7 packages.
- Packages touched include admin/campaigns/storages/projects/organizations/clusters/metaverses/uniks/metahubs/applications.
- getLocalizedString removed in favor of getVLCString.
- Build: full monorepo build (63 tasks) passed.
- Pattern: systemPatterns.md#canonical-types-pattern-critical.

### QA fixes for types unification
- Updated member role tests for dynamic roles; added empty role rejection test.
- Role schema now matches z.string() behavior.
- Removed PaginationMeta duplicate (re-export from @universo/types).
- Replaced dangerouslySetInnerHTML with SafeHTML in chat components.

### Metahubs types refactor + cleanup
- Removed legacy types (gulp/ui, LocalizedField, getLocalizedContent, UseApi).
- Kept getLocalizedString with deprecation notice for public API.
- Moved pagination types to @universo/types; added PaginationParams alias.
- Reorganized types.ts and exports; build verified.

### Metahubs QA fixes
- SchemaMigrator FK naming/length fixes.
- Shared getVLCString usage in publications UI.
- Removed unused renderLocalizedFields; lint warning baseline unchanged.
- Prettier deviations in metahubs-frontend remain pre-existing.

### Publications refactor + sync fixes
- Backend routes: /metahubs/:id/publications for list/detail/sync/diff/delete.
- Frontend API aligned to /publications endpoints.
- Breadcrumbs fetch publication names from /publications.
- Sync action wired to create/update/sync/delete APIs.
- Remaining application naming cleaned in publications context.

### Source -> Metahub links UI
- MetahubSelectionPanel component + sourceMetahubs API/hooks.
- sourceMetahubsQueryKeys factory added for invalidation.
- Added SourceMetahub/MetahubSummary types and i18n keys.
- Build: @universo/applications-frontend successful.

### useViewPreference QA improvements
- SSR-safe hook with isLocalStorageAvailable guard.
- ViewStyle + DEFAULT_VIEW_STYLE exports; re-export across 7 packages.
- 14 unit tests added; localStorage keys normalized.
- SSR guard: isLocalStorageAvailable() integrated.
- Pattern: systemPatterns.md#universal-list-pattern-critical.

---

## 2026-01-14

### Publications rename stabilization and fixes
- Rename Application* -> Publication* in metahubs UI and types.
- Update routes, query keys, and API/hook names.
- Menu configs updated with publications labels (EN/RU).
- Add missing i18n labels; fix publication diff hook naming.
- Breadcrumbs aligned to publication routes.

### Source deletion + table unification
- Disable Source delete actions and hide Delete button.
- Extend CompactListTable action column; unify selection panels.
- Action column header/width standardized for dialogs.
- Pattern: systemPatterns.md#reusable-compact-list-table-pattern-dialogs.

### Application/Source UX improvements
- Add Stack spacing + tabs in dialogs; pass metahub context.
- Fix SourceMetahubInfoWrapper items extraction.
- Make Source cards clickable; keep Add button disabled but visible.

### Application creation from Metahubs
- Add Application creation tabs + MetahubInfoPanel.
- Copy Metahub name/description to Source on create.
- Single Source limit with translations.

### Link Applications and Metahubs via Sources
- Extend application schema with sync fields; add SourceMetahub entity + RLS.
- Create applicationsRoutes in metahubs-backend with CRUD/diff/sync.
- Add source-metahub link endpoints and verify build.

### Applications QA fixes + tests
- Rename tests, remove obsolete backend tests, update README terminology.
- Add applicationsRoutes/sourcesRoutes test suites + MSW handler.
- Apply useViewPreference to MetahubMembers; tests updated.

---

## 2026-01-13

### Applications packages creation
- Clone metahubs packages -> applications-frontend/backend.
- Remove catalogs/attributes/records artifacts.
- Register entities, migrations, routes, i18n, and menu entries.
- Postgres migrations registered in core index.
- Build verified.

### Catalogs/attributes improvements
- Normalize Attribute.sortOrder after delete.
- Hub-less attributes/records endpoints and direct query keys.
- Cache invalidation for direct keys added.
- Routes refactor: /catalogs/:id -> /catalog/:id.

### Schema sync UUID naming
- Use UUID-based app_/cat_ names; SchemaMigrator diff aligned.
- Build verified.

### Applications UI + diff fixes
- VLC structure comparisons; primaryLocale fields in create flow.
- Replace confirm() with ConfirmDeleteDialog.
- Add edit action + PATCH endpoint + i18n keys.
- Search/pagination and Options menu crash fixes.

### Applications config/data separation
- Application entity + schema status fields; migrations.
- SchemaGenerator/SchemaMigrator services + CRUD/diff/sync routes.
- Frontend hooks + ApplicationList/Board/Diff UI.
- Menu/routes/i18n/storage keys registered.

---

## 2026-01-12

### Catalogs endpoint tests
- Added catalogsRoutes tests (17 cases).
- Extended MockRepository count method.
- Documented UUID validation in routes.

---

## 2026-01-11

### Catalogs + QueryRunner QA fixes
- Hub-less catalog delete endpoint + deleteCatalogDirect API.
- escapeLikeWildcards and getRequestManager consolidation.
- Search endpoints aligned to safer LIKE handling.
- QueryRunner support in AccessGuards + loadMembers pattern.
- CompactListTable header + HubDeleteDialog UX improvements.
- HubDeleteDialog uses useQuery for blocking catalogs list.
- Catalog/Hub operations fixes and update endpoints.
- isRequiredHub migration + documentation.
- Pattern: systemPatterns.md#rls-queryrunner-reuse-for-admin-guards-critical.

---

## 2026-01-10

### Catalogs QA rounds + code quality
- Sorting, columns, catalogsCount, dashboard widget updates.
- AllCatalogs list UI, i18n fixes, cache invalidation.
- Catalogs dashboard widgets updated with counts.
- useCatalogName hook + breadcrumbs updates.
- Catalogs columns and tab URLs aligned with new naming.
- N+1 query fixes in catalogsRoutes/hubsRoutes.
- Centralized localStorage keys + useViewPreference in list pages.

---

## 2026-01-09

### Metahubs VLC rollout + FlowListTable fix
- VLC rendering fixes in metahubs lists.
- FlowListTable listView rendering corrected.

---

## 2026-01-08

### Record edit fixes
- Pass raw record data to actions; fetch full record when missing.
- Delay record edit fields until hydration completes.
- Build: metahubs-frontend verified.

---

## 2026-01-07

### Localized field UI rollout
- LocalizedInlineField + EntityFormDialog rolled out across metahubs/admin.
- VLC parsing hardened; primary-locale handling stabilized.
- Diagnostics cleanup and log level restored.
- Diagnostic logs removed; backend log level restored.

---

## 2026-01-06

### Project metadata i18n + localized fields hardening
- Added locale metadata files; updated landing/onboarding translations.
- Updated entrypoints + supported-languages sync scripts.
- Supported languages metadata synced via script.
- Hardened localized field handling for mixed formats.
- Updated frontend tests for VLC payloads.

---

## 2026-01-05

### Login error UX improvements
- mapSupabaseError now recognizes backend "Invalid credentials".
- Added loginFailed i18n keys (EN/RU) + improved serverError copy.
- Copy remains OWASP-safe (no account enumeration).
- Build passed (61 tasks).

---

## 2026-01-04

### Auth bot review fixes
- Extracted mode switcher outside conditional block in AuthView.tsx.
- Combined AuthPage effects via Promise.allSettled.
- Updated systemPatterns docs for flat config.

---

## 2026-01-03

### Auth toggles + start-frontend i18n cleanup
- Added AUTH_* env toggles + /auth-config endpoint.
- StartFooter added to legal pages; onboarding copy updated.
- Migrated start-frontend to registerNamespace(); deprecated legacy helpers.
- StartFooter added to legal pages for auth flows.
- Full build passed (61 tasks).

---

## 2026-01-02

### SmartCaptcha improvements
- Added login captcha support end-to-end.
- Captcha logic extracted to @universo/utils/captcha (axios-based).
- Fail-closed validation when enabled; improved UX errors.
- Full build passed (61 tasks).

---

## 2026-01-01

### SmartCaptcha + lead forms
- Server-side captcha validation for leads and publication flows.
- /p/:slug SmartCaptcha domain fix via server render endpoint.
- Quiz lead forms support with captchaEnabled + captchaSiteKey.
- API_WHITELIST updated for publish captcha/render endpoints.
- Auth captcha integration and i18n updates.
- Pattern: systemPatterns.md#public-routes-401-redirect-pattern-critical.

---

## 2025-12-31

### Privacy consent + lead consent
- Cookie consent banner (accept/decline) with i18n + persistence.
- Lead consent fields for quiz AR.js submissions.
- Consent versioning split into terms/privacy fields.
- Profile consent versioning and signup/profile fixes.

---

## 2025-12-30

### Profile + legal pages
- Profile creation debug fix and trigger consolidation.
- Legal pages (/terms, /privacy) with consent checkboxes.
- Consent trigger consolidation for profile creation.
- RLS alignment for profile creation flow.

---

## 2025-12-28

### Onboarding + auth fixes
- Onboarding completion tracking; auth 419 auto-retry.
- Start page UI spacing and button flicker fixes.

---

## 2025-12-26

### Quiz leads + auth UX + start page i18n
- Completed QA fixes + start page i18n updates.
- Captcha copy aligned to registration flow.

---

## 2025-12-25

### Start page MVP + API client refactor
- Start page MVP shipped; API client refactor completed.
- Start page layout stabilized for guest/auth views.

---

## 2025-12-23

### RLS + Metahubs fixes
- RLS issues resolved and QA fixes applied.
- Access control checks tightened for metahubs endpoints.
- Metahubs endpoints hardened for access control.

---

## 2025-12-22

### Metahubs transformation
- Metahubs MVP transformation (backend + frontend).
- Schema sync scaffolding introduced.

---

## 2025-12-18

### AgentFlow QA hardening
- QA hardening + lint fixes for AgentFlow.
- Stability improvements documented.

---

## 2025-12-17

### AgentFlow config UX
- AgentFlow configuration UX improvements.
- Dialog and form layout refinements.

---

## 2025-12-15

### AgentFlow integration
- AgentFlow integration across backend + frontend.
- Build verification logged.

---

## 2025-12-14

### Flowise 3.0.12 components
- Flowise components refresh to 3.0.12.
- Compatibility fixes for updated component APIs.

---

## 2025-12-09

### Catalogs baseline stabilization
- Initial catalogs QA stabilization pass.
- Baseline build status recorded.

---

## 2025-01-10

### Auth disabled state UX refinements
- Auth disabled-state UX improvements with conditional rendering pattern.
- Pattern: systemPatterns.md#admin-route-guards-pattern.
