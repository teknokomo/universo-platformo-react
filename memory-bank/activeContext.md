# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Implementation: Connector Schema Diff Entity Metrics QA (2026-05-12)

-   The connector schema diff metric QA closure is complete.
-   Backend sync diff details now include generic `metrics` for created Entity previews.
-   Catalog previews still show field and element counts, while Hubs show linked Entity counts, Pages show block counts, Sets show constant counts, and Enumerations show value counts.
-   The connector diff dialog renders those Entity-specific summaries instead of forcing non-Catalog Entity types to display misleading `0 fields, 0 elements` text.
-   Unknown/custom Entity types fall back to non-zero field/element metrics only, avoiding empty filler summaries.
-   EN/RU metric labels are localized with pluralization.
-   The imported LMS runtime Playwright flow now includes low-overhead browser assertions that the schema diff does not contain `0 fields, 0 elements` and does contain linked-entity, block, constant, and value metrics, plus a screenshot artifact.
-   Latest validation: applications backend focused tests pass; applications frontend focused tests pass; package builds pass; `pnpm build` passes; `git diff --check` passes; `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium` passes.

## Previous Implementation: LMS Connector QA Closure (2026-05-12)

-   The latest connector QA closure is complete.
-   Backend application settings now accept and persist `schemaDiffLocalizedLabels`, including explicit `false`, instead of dropping the Connectors tab option at the strict API boundary.
-   Managed role policy templates now apply when their codename is `memberPolicy`/`editorPolicy`/`adminPolicy` even if `baseRole` is missing, preserving access behavior for imported fixture policy records.
-   Connector schema diff previews now keep canonical primary codenames for preview row lookup while rendering localized codenames through a separate display field when localized schema labels are enabled.
-   The LMS imported runtime Playwright expectation now matches the source-Metahub Workspace isolation copy.
-   A full root build was required before Playwright because the production runner serves built `core-frontend` assets; after `pnpm build`, the imported LMS runtime flow passed on the updated UI.
-   Latest validation: backend focused tests pass; applications frontend focused tests pass; apps-template focused tests pass; package builds pass; `pnpm build` passes; `git diff --check` passes; `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium` passes.

## Previous Implementation: LMS Runtime Manual QA Remediation (2026-05-12)

-   The latest connector and Entity localization remediation is complete.
-   LMS Page seed generation now preserves canonical EN codenames such as `LearnerHome` while adding RU codename VLC values from localized page names.
-   Metahub Settings tabs now follow Entity constructor ordering from entity type metadata, so Pages appear immediately after Hubs without hardcoded kind branching.
-   The connector schema diff dialog now places the required Workspace notice above the disabled enabled switch and explains that the source Metahub requires workspace-isolated application data.
-   Application Settings now include a generic Connectors tab with a default-enabled option for localized schema diff labels.
-   Connector schema diff previews now show all created Entity groups dynamically from Entity metadata, with localized type/entity/field labels when enabled and primary VLC labels when disabled.
-   Published app root URLs mark the first runtime menu item active, so `/a/:applicationId` highlights Home before the route includes a section id.
-   `tools/fixtures/metahubs-lms-app-snapshot.json` was regenerated through the product Playwright generator and validated for bilingual Page codenames.
-   Latest validation: targeted metahubs backend tests pass; targeted applications frontend/backend tests pass; targeted apps-template tests pass; package builds pass for applications frontend/backend, apps-template-mui, metahubs backend, and metahubs frontend; the LMS product generator passes.

## Previous Implementation: LMS Runtime Manual QA Remediation (2026-05-12)

-   The previous manual QA remediation is complete.
-   Required publication Workspace policy now forces Workspace mode without showing the irreversible acknowledgement checkbox; the connector diff dialog shows a disabled enabled switch and clearer explanatory copy.
-   Generic runtime value formatting now prevents `[object Object]` rendering for report definitions, saved filters, quiz option arrays, localized values, and other structured values in runtime grids and edit dialogs.
-   Published application navigation marks both metadata-selected items and safe URL link items as active with the original MUI selected-list styling and `aria-current="page"`.
-   LMS fixture class seed data now stores localized EN/RU `Name` and `Description` values; the fixture contract validates localized records.
-   `tools/fixtures/metahubs-lms-app-snapshot.json` was regenerated only through the product Playwright generator.
-   Latest validation: targeted workspace policy, connector dialog, application sync, runtime formatting/menu tests pass; targeted lint passes for `@universo/apps-template-mui`, `@universo/applications-frontend`, `@universo/applications-backend`, and `@universo/utils` with existing warnings only; `@universo/apps-template-mui`, `@universo/applications-frontend`, `@universo/core-frontend`, `@universo/utils`, `@universo/applications-backend`, and `@universo/core-backend` builds pass; LMS generator and imported runtime Playwright flows pass.

## Previous Implementation: iSpring-like LMS Platform Roadmap QA Remediation (2026-05-12)

-   Latest QA remediation closes the remaining report security, aggregation, metadata filtering, application access settings UI, docs, and regression coverage gaps found after the initial roadmap implementation.
-   Runtime report execution now accepts only saved `Reports` Catalog references (`reportId` or `reportCodename`) and loads the JSON `Definition` from published runtime data.
-   Inline report definitions are rejected before runtime metadata lookup.
-   Report aggregations are executed server-side through the same safe field map, with public aliases preserved in the response.
-   Report target discovery and ordinary runtime row discovery now share the same filter, excluding registrar-only ledger Catalogs.
-   Application settings now include a generic Access tab for role/capability policy editing, reusing the existing settings page and MUI controls instead of adding an LMS-only UI.
-   The LMS import runtime Playwright flow now includes saved report execution against the generated fixture.
-   Latest validation: targeted backend/frontend/apps-template tests pass, focused lint/build checks pass for changed packages, `git diff --check` passes, and `node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts` passes.
-   `resolveEffectiveRolePermissions` now derives effective app/runtime permissions from generic application `rolePolicies` settings and exposes `readReports` for owner/admin/editor by default while fail-closing reports for unauthorized roles.
-   `RuntimeReportsService` requires an explicit `readReports` permission before executing validated report datasources.
-   `RuntimeReportsService` is reachable through `POST /applications/:applicationId/runtime/reports/run`; the controller resolves report definitions and target metadata from published runtime `_app_objects` and `_app_attributes`, applies workspace/lifecycle row conditions, and refuses unauthorized report access before touching runtime metadata.
-   `apps-template-mui` exposes a typed `runRuntimeReport` helper with Zod response validation, CSRF handling, saved report references, and aggregation output.
-   Application layout behavior editing now reuses the existing shared widget editor for details tables, title widgets, charts, and overview cards, with section options sourced from runtime layout metadata.
-   Latest validation: targeted `@universo/types`, `@universo/applications-backend`, `@universo/applications-frontend`, and `@universo/apps-template-mui` tests pass; focused lint/build checks pass for `@universo/types`, `@universo/applications-backend`, `@universo/applications-frontend`, and `@universo/apps-template-mui`; LMS generator and imported runtime Playwright flows pass.
-   Phase 0 baseline audit confirmed the LMS fixture already uses generic Metahub entities, Catalog-backed Ledgers, `recordBehavior`, Page blocks, generic runtime datasources, and required Workspace policy.
-   Main implementation gap is product breadth and contract depth: resources/courses/sections/track steps/knowledge base/development plans/report definitions need to exist as ordinary metadata and seeded runtime records.
-   Core runtime record commands must remain `post` / `unpost` / `void`; LMS actions are modeled as lifecycle/workflow configuration and scripts.
-   Report definitions stay in the existing `Reports` Catalog for V1; `ReportDefinitions` remains optional only if implementation proves separation is necessary.
-   `@universo/types` now contains strict generic LMS platform primitive schemas for resources, sequences, lifecycle statuses, workflow actions, role policies, report definitions, and acceptance matrix data.
-   The LMS template has been expanded with generic Catalogs for learning resources, courses, course sections, track steps, knowledge spaces/folders/bookmarks, development plans/stages/tasks, notification rules/outbox, and richer report definitions.
-   Imported LMS snapshot runtime flow now passes after workspace seed remapping hardening: table-child reference dependencies, retry on unresolved references, unique global `_seed_source_key` fallback, and legacy table-name object-id lookup cover restored publication snapshots.
-   Latest validation: `@universo/applications-backend` focused tests/build/lint pass, and `node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts` passes.

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
