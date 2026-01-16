# Active Context

> **Last Updated**: 2026-01-16
> 
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Metahubs route standardization + test/coverage cleanup (complete)

- Standardized backend routes to singular detail paths and aligned public routes.
- Updated metahubs-frontend API clients, template-mui breadcrumbs, and MSW handlers.
- Restored shared/utils coverage and added tests; metahubs frontend/backend tests pass.
- Root build started but timed out; needs re-run to confirm full build.
- Details: progress.md#2026-01-16.

## Recent Highlights (last 7 days)

### Publications rename stabilization (2026-01-14)
- Routes standardized to /publications and /metahubs/:id/publications.
- Breadcrumbs and diff hook aligned to publication naming.
- Details: progress.md#2026-01-14.

### Metahubs QA fixes (2026-01-15)
- SchemaMigrator FK naming/length fixes and shared getVLCString reuse.
- Publications UI cleanup and grammar fixes.
- Details: progress.md#2026-01-15.

### Metahubs frontend build-first (2026-01-16)
- Dist-first exports and updated README imports for metahubs frontend.
- Tests fixed and coverage scope refined for MVP modules.
- Full build and package tests verified.
- Details: progress.md#2026-01-16.

### Applications connectors refactor (2026-01-15)
- Sources renamed to Connectors across applications + metahubs integration.
- template-mui navigation and universo-i18n menu keys aligned to connectors.
- Details: progress.md#2026-01-15.

### Connector -> Metahub links UI (2026-01-15)
- Added MetahubSelectionPanel, connectorMetahubs APIs, and query hooks.
- Added ConnectorMetahub/MetahubSummary types and i18n keys.
- Details: progress.md#2026-01-15.

### useViewPreference QA improvements (2026-01-15)
- SSR-safe hook with isLocalStorageAvailable guard.
- 14 unit tests added; localStorage keys normalized across packages.
- Details: progress.md#2026-01-15.

## QA Notes

- Pre-existing Prettier deviations remain in metahubs-frontend.
- No new lint regressions introduced by the QA cleanups.
- Root build timed out after ~200s; rerun needed for full verification.
- metahubs-frontend tests emit React Router future-flag and KaTeX quirks warnings.
- metahubs-backend tests emit expected security warn logs for permission checks.

## Active Checks

- Re-run full `pnpm build` to confirm monorepo build completion.
- Manual QA: publications list/detail/sync/diff endpoints.
- Manual QA: connector-metahub link/unlink constraints (single/required).
- Manual QA: useViewPreference storage keys in projects/storages.
- Confirm publication naming consistency across UI and API.
- Confirm member role tests remain green after schema changes.

## Context Snapshot

- Metahubs-backend: domain architecture under `src/domains/*`; runtime schema tooling moved to `domains/ddl`.
- Legacy backend folders removed: `src/routes`, `src/schema`, `src/schemas`, `src/services`.
- Singular detail routes: `/metahub/:metahubId`, `/metahub/:metahubId/hub/:hubId`, `/metahub/:metahubId/catalog/:catalogId`, `/attribute/:attributeId`, `/record/:recordId`, `/metahub/:metahubId/publication/:publicationId`.
- List routes remain plural: `/metahubs`, `/metahub/:metahubId/catalogs`, `/metahub/:metahubId/hubs`, `/metahub/:metahubId/publications`.
- Public routes base: `/public/metahub/:slug` (core backend mount updated).
- Connector-metahub links: `/applications/:appId/connectors/:connectorId/metahubs`.
- Canonical types: PaginationParams, PaginationMeta, PaginatedResponse<T>, Filter* (in @universo/types).
- Pattern: systemPatterns.md#universal-list-pattern-critical.
- Schema naming: `app_<uuid32>` remains standard.

## Blockers

- None.

## Next Steps

- Await QA verification and close remaining manual checks.
- If no blockers, switch to reflect mode on request.
- Review open tasks: tasks.md#planned-tasks.
