# Active Context

> **Last Updated**: 2026-02-04
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Applications Runtime UI + `/a/:applicationId` Routing (Completed)

**Status**: Completed implementation for MVP runtime flow.

### Implemented
- New runtime endpoint: `GET /applications/:applicationId/runtime` (single-catalog MVP, dynamic columns/rows)
- Role hardening on application-scoped backend routes (connectors, sync, diff, migrations)
- New user route: `/a/:applicationId` (available for all application members)
- New admin route: `/a/:applicationId/admin/*` (owner/admin/editor only via `ApplicationAdminGuard`)
- Applications list now opens runtime URL by default and exposes role-gated "Control Panel" action
- Follow-up cleanup: removed remaining legacy admin sidebar links in `flowise-template-mui` and normalized them to `/a/:applicationId/admin/...`
- Follow-up hardening: fixed `ApplicationGuard` parameter wiring (`resourceIdParam`) and kept unit coverage
- Runtime normalization: backend now resolves VLC/JSONB `STRING` field values to requested locale strings before returning table rows
- Runtime UX: boolean attribute cells now render explicit checkboxes; pagination uses `keepPreviousData` to avoid full-page flicker
- Applications list item menu now shows "Delete" under "Edit" (single divider after "Control Panel") for `owner` only (backend enforces owner-only delete)
- Application delete now drops the application schema (`DROP SCHEMA ... CASCADE`) to avoid orphan schemas
- Copied `.backup/templates` to `packages/apps-template-mui`
- Added minimal layout/route/table scaffolding in `packages/apps-template-mui` for next iterations, now reusing Dashboard `CustomizedDataGrid` without demo data
- `@universo/apps-template-mui` is part of the workspace and is used by `ApplicationRuntime` to render the runtime Dashboard layout (MUI template) in `/a/:applicationId`

### Follow-up Fixes (2026-02-04)
- UI-only layout changes now propagate to existing Applications during connector sync:
  - Diff endpoint marks `ui.layout.update` as additive change when `_app_ui_settings` differs.
  - Sync persists `_app_ui_settings` even when there are no DDL changes.
- Dashboard pages across feature packages were normalized to MUI 7 Grid v2 API and template-like StatCard heights (avoid `description` usage).
- AuthView layout regression fixed by using `Stack` instead of Grid for the login/register form.

### Validation Summary
- `@universo/applications-backend` build: passed
- `@universo/metahubs-backend` build: passed
- `@universo/template-mui` build: passed
- `@universo/metahubs-frontend` build: passed
- `@universo/applications-frontend` build: passed (package build script compiles i18n entry)
- `ApplicationGuard` unit test: passed
- `@flowise/template-mui` lint: no errors (warnings only, baseline debt)
- `ConnectorList` test file updated and passes when run directly with coverage disabled

### Known Baseline Issues (Not Introduced by This Task)
- `@universo/applications-frontend` lint has many pre-existing Prettier/typing errors across unrelated files
- Full frontend test suite has existing failing/timeouting tests and coverage-threshold failures
- `ApplicationBoard` test suite currently fails due MUI X Charts axis/series length mismatch in existing chart fixtures (unrelated to runtime route changes)
