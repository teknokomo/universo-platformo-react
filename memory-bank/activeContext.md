# Active Context

> **Last Updated**: 2026-03-06
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Constants Value Tab + Localization + Table Layout + App REF Display

**Status**: 🔄 In Progress  
**Date**: 2026-03-06  
**Branch**: `feature/dnd-ordering-entity-lists`

### Recently Completed

1. Closed QA debt for hub nesting and hub-scoped UX:
   - removed duplicate EN locale keys in `metahubs` translations,
   - added missing shared `common.fields.codename` in EN/RU,
   - removed debug `console.log` traces from shared `usePaginated` hook.
2. Replaced fixed `limit: 500` full-list fetches with all-pages helper logic in hub/catalog/set/enumeration list flows and menu widget editor using deterministic `sortOrder` ordering.
3. Validated parent hub selection safety path for edit/copy flows (cycle exclusions remain enforced via `HubActions` + `HubParentSelectionPanel`).
4. Verified scoped quality gates for touched packages:
   - lint: `@universo/metahubs-frontend`, `@universo/template-mui` (warnings only),
   - tests: `@universo/metahubs-frontend`, `@universo/template-mui` passed,
   - builds: `@universo/metahubs-frontend`, `@universo/template-mui` passed.

### Prior Completed (Same Sprint)

1. Implemented hub nesting (`parentHubId`) end-to-end: backend validation (self/cycle checks), create/edit/copy support, child hubs endpoint, and delete blocking for parent hubs with children.
2. Added metahub hub settings runtime behavior: `hubs.allowNesting`, one-shot `hubs.resetNestingOnce` execution and reset, `hubs.allowAttachExistingEntities`.
3. Completed hub-scoped UX parity in frontend:
   - tabs order `Hubs / Catalogs / Sets / Enumerations`,
   - `Hubs` tab in create/edit/copy flows according to scope rules,
   - fast re-link to current hub action,
   - detached-from-current-hub confirmation flow for save/create/copy.
4. Implemented split action (`Create` + `Add`) and add-existing flows in hub-scoped lists for hubs/catalogs/sets/enumerations using shared `ToolbarControls`, `EntityFormDialog`, and `EntitySelectionPanel`.
5. Added menu widget hub binding and runtime hierarchy rendering in application runtime menu.
6. Removed physical `hub_*` table generation in schema DDL path while preserving runtime metadata behavior.
7. Added branch copy safety sanitization for dangling/self `parentHubId` references after clone prune.
8. Updated RU/EN i18n keys for new settings, dialogs, tabs, and menu labels.

### Verification Snapshot

- Lint (scoped packages): pass with warnings only, no errors.
- Build (scoped packages): pass for `@universo/types`, `@universo/template-mui`, `@universo/metahubs-frontend`, `@universo/apps-template-mui`, `@universo/schema-ddl`, `@universo/applications-backend`, `@universo/metahubs-backend`.
- Tests:
  - `@universo/metahubs-backend`: hubs/catalogs/sets/enumerations/elements/layouts routes + `metahubBranchesService` passed.
  - `@universo/applications-backend`: applications/connectors routes passed.
  - `@universo/metahubs-frontend`: full vitest run passed (25 test files, 102 tests).

### Next Active Work

- Continue with `Constants Value Tab + Localization + Table Layout + App REF Display` task block from `memory-bank/tasks.md`.
