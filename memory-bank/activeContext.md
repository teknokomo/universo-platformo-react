# Active Context

> **Last Updated**: 2026-03-02
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: PostgreSQL NUMERIC → JS Number Coercion Fix

**Status**: ✅ Fix Applied — build 56/56
**Date**: 2026-03-02

### Issue Reported

After the error message propagation fix, user could see the actual error:
`"Invalid value for kolichestvo: Expected number value"` — PATCH runtime rows returns 400 when saving an application element with NUMBER fields.

Same operation works fine in metahub catalog editor.

### Root Cause

PostgreSQL `NUMERIC(10,0)` columns return values as **strings** via `node-postgres` (well-known behavior for precision preservation). The application runtime endpoints passed these strings through without conversion:

1. GET row returns `{ kolichestvo: "2" }` (string from pg)
2. Frontend stores `"2"` in formData (user doesn't change the field)
3. PATCH sends `kolichestvo: "2"` (string) back to server
4. `coerceRuntimeValue` checks `typeof "2" !== 'number'` → throws

Metahubs doesn't have this problem because it stores data in a JSONB column (`_mhb_elements.data`), which preserves JS number types.

### Fix Applied

All changes in `applications-backend/base/src/routes/applicationsRoutes.ts`:

1. **Added `pgNumericToNumber` helper** — safely converts NUMERIC string values to JS numbers
2. **Fixed `resolveRuntimeValue`** — added NUMBER case to coerce NUMERIC strings (used by LIST endpoint)
3. **Fixed `coerceRuntimeValue`** — accepts both `number` and numeric `string` for NUMBER type (defensive fix for all write endpoints: PATCH, POST, cell update, tabular CRUD)
4. **Fixed GET single row endpoint** — converts NUMBER attributes from NUMERIC strings to JS numbers
5. **Fixed GET tabular rows endpoint** — converts NUMBER child attributes from NUMERIC strings to JS numbers

### Previous Fix (same session): Error Message Propagation

Added `extractApiErrorMessage()` helper to `useCrudDashboard.ts` and `RuntimeInlineTabularEditor.tsx` — extracts server error text from Axios response body instead of showing generic "Request failed with status code 400".

---

## Previous Focus: Legacy Packages Removal + QA Fixes (2026-02-28)

### PR #698 Review Fixes (Complete)

Completed full Publications drill-in navigation with inner tabs (Versions, Applications):

- **PR #698 Review Fixes**: branchId fallback, unused vars, noopener, VLC fallback via buildLocalizedContent, memory-bank compression
- **UX Polish Round 2**: Link colors, actions columns, pagination, app URLs — 3 files changed
- **UX Polish Round 1**: Table links, breadcrumbs, titles, search, action menus — 7 issues fixed
- **Create Dialog & Schema Fixes**: Reworked dialog layout, fixed broken DDL, fixed TypeError — 4 issues fixed
- **CollapsibleSection Export Fix**: Missing export from template-mui causing build failure — 4 files changed
- **Navigation & Create Dialog Rework**: Full R1-R9 implementation — 11 new files, 11 modified, 3 deleted
- **QA Remediation**: Slug collision, unused imports, i18n fallback, deps, validation, a11y — 10 issues fixed
- Build: **66/66** packages passing

---

## Recent Completions (2026-02-26 — 2026-02-27)

### Copy UX & QA Remediation

- **QA Remediation Round 10 — Copy UX** (02-27): Standardized copy with i18n-driven naming, template respects metahub locale
- **PR #696 Bot Review Fixes** (02-27): Safe string checks, dead code removal, rel="noopener", nullable name access
- **Copy UX Simplification** (02-27): `generateCopyName()` helper with i18n-driven " (copy N)" suffix, 4 files
- **Metahub/Application Entity Copy** (02-27): Full copy UX with dialog, progress indicator, error handling
- **QA Remediation Rounds 5-9** (02-27): Copy flow refinements, error messages, edge cases
- **QA Remediation Rounds 1-4 — Copy Flows** (02-26): Copy safety, schema sync, constraint fixes
- **PR #692 Bot Review Remediation** (02-26): Hardcoded locale → metahub locale, inline helpers
- **Copying UX/Logic Upgrade** (02-26): generateCopyName, ApplicationSchemaStatus reset, advisory lock

### NUMBER Field & Inline Table

- **NUMBER field parity** (02-26): Zone-aware stepping, NumberEditCell rewrite, 5 files across 3 packages
- **Fix inline table nonNegative** (02-26): Prevented NaN → null regression in NUMBER stepper

### QA & Architecture

- **QA Rounds 5-8** (02-25—02-26): Constraint text, spacing, 3-dot menu, runtime bugs, comprehensive fixes
- **Architectural Improvements** (02-24): Attribute edit race condition, 422 error payload, i18n for structured blockers
- **QA Remediation Rounds 1-2** (02-24): Button spacing, toast improvements, deletion guard, empty-state, column widths
- **QA Findings Code Remediation** (02-24): 5 bugs + 5 warnings across attributes, catalogs, API
- **QA Safe Remediation** (02-23): Number display, optimistic lock, enum dropdown, status dialog
- **QA Recommendations** (02-23): 2 high + 3 medium improvements for metahubs
- **Child TABLE Editing** (02-23): Full inline editing parity with parent table, 5 files

---

## Current Project State

- **Build**: 66/66 packages passing (`pnpm build`)
- **Current Branch**: PR #698 (Publication Drill-In + review fixes)
- **Template Version**: 1.0.0, Structure Version: 1
- **Active Feature**: Publications drill-in navigation (complete, in review)
- **Key Packages**: metahubs-frontend, metahubs-backend, apps-template-mui, template-mui, schema-ddl

---

## Recent Completions (2026-02-21 — 2026-02-23)

### TABLE Attribute & Inline Editing

- **Child TABLE Attribute Parity + Sync FK Fix** (02-23): Full parity for child attributes, 6 files
- **Dialog Init & Child REF Persistence** (02-23): Fixed form initialization, restored persistence, 4 files
- **QA Quality Fix Round 7** (02-22): Documentation updates — 4 README files (EN/RU)
- **TABLE Attribute UX Rounds 1-5.4** (02-21—02-23): Comprehensive inline editing with DnD reorder
- **QA Fixes Rounds 1-7** (02-21—02-23): Grid styling, delete cascade, schema diff, i18n fixes

---

## Key Technical Context

- **Circular build dependency**: template-mui builds before metahubs-frontend; solved with `(m: any)` cast in lazy imports
- **CollapsibleSection**: Reusable component in universo-template-mui
- **DDL after transaction**: Knex DDL runs after TypeORM transaction commit to avoid deadlocks
- **Publication inner tabs**: Versions + Applications via `/publication/:id/versions` and `/publication/:id/applications`
- **Copy mechanism**: `generateCopyName()` + i18n " (copy N)" suffix + advisory locks
- **Inline table editing**: NumberEditCell with zone-aware stepping, full NUMBER field parity
- **Structured blockers**: `StructuredBlocker` type with i18n keys for migration guard UI

---

## Immediate Next Steps

1. Await PR #698 merge
2. Consider next feature work (see tasks.md for planned items)
3. Runtime testing of publications drill-in end-to-end
