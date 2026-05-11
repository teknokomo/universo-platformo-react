# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: Fix start:allclean Database Reset + SQL Auth Deletion (2026-05-11)

-   **Bug fixed**: `pnpm start:allclean` never reset Supabase DB because `--reset-db` CLI flag was lost in `run-script-os -> npm` chain (npm without `--` separator doesn't forward unknown flags)
-   **Env var fix**: replaced with `_FORCE_DATABASE_RESET=true pnpm start` in the script — env var is inherited by all child processes, unlike CLI flags
-   **SQL deletion**: auth user deletion switched from Supabase Admin HTTP API (timed out at ~35s/user) to direct SQL `DELETE FROM auth.users WHERE id = ANY($1::uuid[])` — reset now takes 4 seconds instead of 3+ minutes
-   **Dead code removed**: `--reset-db` flag from `start.ts`, stale comment from `index.ts`, unused `StartupResetEnabledConfig`/`getStartupResetConfig`/`assertPresent`/`createSupabaseAdminClient` import
-   **Test fixes**: added missing `getPoolExecutor`+`seedTemplates` mocks in `App.initDatabase.test.ts` (5 pre-existing failures); rewrote `startupReset.test.ts` for SQL deletion
-   **Known issue**: `punycode` DEP0040 deprecation from `node-fetch@2.7.0 -> whatwg-url@5.0.0` via `@google-cloud/logging-winston` — deferred to next dependency update cycle
-   **Next**: Memory bank compression, then continued development
-   Details: progress.md#2026-05-11

## Previous Focus: Catalog-Backed Ledger Schema Templates (2026-05-10)

-   Ledger schemas support catalog-backed fact attributes with typed fact columns, auto-generated index tables, idempotent DDL, and E2E posting proof
-   Catalog entity type templates expose generic `ledgerSchema` capability in Entity constructor contract
-   LMS template models progress, score, enrollment, attendance, certificate, points, activity, and notification registers as Catalog instances with `config.ledger`
-   Registrar-only Catalog-backed ledger objects excluded from ordinary runtime CRUD and workspace seed flows
-   Details: progress.md#2026-05-10

## Previous Focus: Entity-Driven Catalog Record Behavior UI (2026-05-09)

-   Catalog record behavior exposed through generic Entity authoring surface — `behavior` tab from entity type `components` + `ui.tabs`, not Catalog-only branching
-   `TemplateManifestValidator` now preserves `identityFields`, `recordLifecycle`, `posting`, and `ledgerSchema` during Zod parsing
-   Runtime Datasource QA: dashboard widgets receive active locale, sections, linked collections; chart widgets localize empty-data overlay
-   Runtime UX QA: Ledger collections use `ledgers` i18n namespace; field-definition tabs/empty-states have shared localized keys
-   Details: progress.md#2026-05-09

## Previous Focus: LMS Catalog/Ledger Platform Implementation (2026-05-08)

-   20+ LMS QA/feature closures: public guest runtime neutral aliases, SHA-256 guest session secrets, application settings preservation
-   Ledger projection errors return controlled `UpdateFailure` responses; manual-editable facts observable through guarded `PATCH`/`DELETE` routes
-   LMS fixture: lifecycle scripts, bilingual page entities, transactional event catalogs, additional ledger definitions, generic runtime policy settings
-   Generic metric widgets, runtime datasource tables, posting movement E2E proof with authenticated runtime record commands through real UI action menu
-   Details: progress.md#2026-05-08

## Previous Focus: Startup Supabase Full Reset (2026-05-07)

-   Full database reset on startup: drops project-owned schemas, deletes auth users, verifies cleanup
-   Safety: production guard, advisory lock, schema validation, post-reset residue check
-   Triggered by `FULL_DATABASE_RESET=true` or `_FORCE_DATABASE_RESET=true` env vars
-   Details: progress.md#2026-05-07

## Previous Focus: Node.js 22 Migration (2026-05-06)

-   Migrated from Node.js 20 to 22.6.0+; upgraded isolated-vm 5.0.4 to ^6.1.2
-   Critical: isolated-vm 5.x does NOT support Node.js 22; 6.x REQUIRED; upgrade isolated-vm first, then Node.js
-   `--no-node-snapshot` flag already configured in startup scripts
-   Details: progress.md#2026-05-06

## Previous Focus: Page Entity Authoring And Editor.js (2026-05-04 to 2026-05-06)

-   Implemented real Editor.js authoring for metahub Page content via shared `EditorJsBlockEditor` in `@universo/template-mui`
-   `apps-template-mui` remains Editor.js-free, rendering canonical Page blocks through safe MUI runtime components
-   Entity-owned `/content` route for `components.blockContent.enabled` Entity types
-   Fixed LMS snapshot import failure (empty presets for `page` type), `[object Object]` error display, VLC codename crash in Hubs picker
-   Shared block content normalizer enforces optional `allowedBlockTypes` and `maxBlocks` constraints
-   `SnapshotRestoreService` applies imported Entity type `blockContent` constraints and rejects disallowed blocks
-   Page metadata dialogs no longer include hidden `blockContentText`; dedicated content route owns block-content authoring
-   Editor.js first render: content renders on first open; block toolbox stays visible/scrollable inside viewport
-   Details: progress.md#2026-05-04

## Previous Focus: Page Entity UX Parity Closures (2026-05-05)

-   Page card/table menus now share same centralized CRUD icon factories as Catalogs via shared `BaseEntityMenu`
-   Table tree-assignment column renders `Hubs` when Entity type uses `hubs` tab alias; generic `Containers` for custom types
-   Container selection panels resolve VLC codenames through `getVLCString` before rendering (fixed React error #31)
-   Generic Entity form accepts standard `hubs` tab alias and exposes Page `Hubs`/`Layouts` from template capability metadata
-   Generic Entity list helpers/breadcrumbs render localized built-in Page labels before async metadata resolves
-   Editor.js toolbar/popover CSS reserves left toolbar space and keeps opened menu inside content card
-   Details: progress.md#2026-05-05

## Previous Focus: LMS Workspace Policy And Runtime Cleanup (2026-05-02 to 2026-05-03)

-   Implemented Page metadata type, publication-version workspace policy, connector-owned workspace schema decisions
-   Removed old no-workspaces publication policy; valid policies are `optional | required`
-   `sanitizeMenuHref`/`isSafeMenuHref` in `@universo/utils`; editors reject protocol-relative/unsafe-scheme links
-   JSONB/VLC runtime writes: plain string STRING fields normalized to VLC object before insert/update
-   Application `member` is read-only: create/edit/copy/delete fail closed
-   Details: progress.md#2026-05-02

## Current Guardrails

-   Do not reintroduce `includeBuiltins`, `isBuiltin`, `source`, `custom.*-v2`, old top-level managed route families, or deleted frontend `domains/catalogs|hubs|sets|enumerations` folder names
-   Runtime workspace management stays on isolated `apps-template-mui` card/list patterns
-   Keep public-runtime exposure tied to publication-backed state, not raw design-time flags
-   Keep the `EntityFormDialog` first-open state hydration pattern intact (no render-phase ref writes)
-   Future fixture changes must be regenerated through documented Playwright generator specs

## Constraints to Preserve

1. Legacy Catalogs/Sets/Enumerations must remain user-visible until entity-based replacements pass acceptance
2. `_mhb_objects.kind` accepts both built-in and custom kind values
3. Snapshot format version bumps preserve backward compatibility for v2 imports
4. All existing E2E tests must remain green at every phase boundary
5. ComponentManifest JSON remains stable contract for advanced Zerocode tooling

## Stored Data Access Preserved (Do NOT rename)

These stored JSONB/DB column names remain unchanged despite neutralization of local variable names:

-   `typed.hubId`, `typed.catalogId`, `typed.sectionId` -- stored JSONB field names
-   `config.parentHubId`, `config.boundHubId`, `config.hubs` -- stored config JSONB
-   Kind key strings: 'hub', 'catalog', 'set', 'enumeration' -- database values
-   DB columns: `parent_attribute_id`, `target_constant_id`, `is_display_attribute`, `attribute_id`
-   Settings namespace keys: `catalogs.allowCopy`, `hubs.resetNestingOnce` etc.
-   URL tab segments: `attributes`, `system`, `elements`, `constants`, `values`
-   i18n keys (~758 refs): `t('hubs.*')`, `t('catalogs.*')`, `t('sets.*')`, `t('enumerations.*')`

## References

-   [tasks.md](tasks.md)
-   [progress.md](progress.md)
-   [systemPatterns.md](systemPatterns.md)
-   [techContext.md](techContext.md)
