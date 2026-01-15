# Active Context

> **Last Updated**: 2026-01-15
> 
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Applications connectors refactor (complete)

- Renamed Sources -> Connectors across applications-backend/frontend (entities, migrations, routes, guards, tests).
- Updated metahubs publications integration and UI copy to connector terminology.
- Updated template-mui routes/menu/breadcrumbs and universo-i18n menu keys.
- Updated applications READMEs (EN/RU) to connectors and /connectors paths.
- Tests: applications-backend + applications-frontend suites ran (existing warnings remain).
- Details: progress.md#2026-01-15.

## Recent Highlights (last 7 days)

### Publications rename stabilization (2026-01-14)
- Routes standardized to /publications and /metahubs/:id/publications.
- Breadcrumbs and diff hook aligned to publication naming.
- Details: progress.md#2026-01-14.

### Metahubs QA fixes (2026-01-15)
- SchemaMigrator FK naming/length fixes and shared getVLCString reuse.
- Publications UI cleanup and grammar fixes.
- Details: progress.md#2026-01-15.

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
- Pending lint cleanup remains out of scope for this pass.
- Build verification: 63 tasks (latest full run).
- Applications-frontend tests now mock useHasGlobalAccess and cover connector metahubs MSW handler.

## Active Checks

- Manual QA: publications list/detail/sync/diff endpoints.
- Manual QA: connector-metahub link/unlink constraints (single/required).
- Manual QA: useViewPreference storage keys in projects/storages.
- Confirm publication naming consistency across UI and API.
- Confirm member role tests remain green after schema changes.
- Verify SafeHTML usage in chat message rendering.

## Context Snapshot

- Publications endpoints: `/metahubs/:id/publications`, `/publications/:id`, `/publications/:id/diff`, `/publications/:id/sync`.
- Connector-metahub links: `/applications/:appId/connectors/:connectorId/metahubs`.
- Query keys: `metahubsQueryKeys.publications*`.
- Mutation hooks: useCreatePublication/useUpdatePublication/useSyncPublication/useDeletePublication.
- UI entry points: PublicationList + PublicationBoard.
- Selection UI: MetahubSelectionPanel (connectors -> metahubs).
- Canonical types: PaginationParams, PaginationMeta, PaginatedResponse<T>, Filter* (in @universo/types).
- Pattern: systemPatterns.md#universal-list-pattern-critical.
- Breadcrumbs: useMetahubPublicationName used in navigation.
- Schema naming: `app_<uuid32>` remains standard.
- DB linkage: Connector uses applicationId at DB level (expected).

## Blockers

- None.

## Next Steps

- Await QA verification and close remaining manual checks.
- If no blockers, switch to reflect mode on request.
- Review open tasks: tasks.md#planned-tasks.
