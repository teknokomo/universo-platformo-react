# Tasks

> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## Current Task Ledger (Canonical)

## Active: Connector Schema Diff Entity Metrics QA (2026-05-12)

> Goal: replace misleading zero field/element summaries for non-Catalog entity types in the application connector schema diff with entity-appropriate metrics and add focused component/backend/browser coverage that catches unfinished, illogical schema-diff UI states.
> Status: completed. The connector schema diff now renders Entity-appropriate metrics for Hubs, Pages, Sets, Enumerations, Catalogs, and custom fallback types, and focused backend/frontend/browser coverage prevents misleading `0 fields, 0 elements` summaries for non-field-based Entity types.

-   [x] Add backend schema diff metrics for Hub, Page, Set, Enumeration, Catalog, and unknown/custom entity fallbacks.
-   [x] Render entity metrics in the connector schema diff dialog without showing meaningless `0 fields, 0 elements` summaries.
-   [x] Add focused backend and frontend regression tests for the new metrics.
-   [x] Extend the imported LMS Playwright flow with low-overhead UX assertions for schema diff metric sanity and screenshot evidence.
-   [x] Run targeted tests/build checks and update memory-bank progress/context.

## Active: LMS Connector QA Closure (2026-05-12)

> Goal: close the QA findings from the latest LMS connector/entity localization pass: persist connector schema-label settings through the backend contract, localize schema diff codenames without breaking preview value lookup, update browser flow assertions, and rerun focused validation.
> Status: completed. The backend settings contract now accepts the connector schema label option, managed role-policy codenames are enforced even without `baseRole`, schema diff previews localize codenames without breaking canonical preview data lookup, and the imported LMS runtime Playwright flow passes on a fresh root build.

-   [x] Accept `schemaDiffLocalizedLabels` in the backend application settings schema and cover it with an API regression test.
-   [x] Render localized schema diff codenames when the setting is enabled while preserving canonical data keys for preview row lookup.
-   [x] Update Playwright LMS runtime flow expectations for the source-Metahub workspace-policy copy.
-   [x] Run focused frontend/backend/template tests and the imported LMS runtime Playwright flow.
-   [x] Update memory-bank progress and active context with the QA closure evidence.

## Active: LMS Connector And Entity Localization Remediation (2026-05-12)

> Goal: close the latest manual QA findings from the rebuilt LMS metahub/application: localized Page codenames, entity-driven settings tab order, clearer connector schema diff UX, configurable localized schema diff labels, full entity-type diff overview, and active home menu on root app URL.
> Status: completed. Page codenames now keep canonical EN values while adding RU values, Settings tabs follow Entity ordering, connector schema diff UX is clearer and entity-type aware, localized schema diff labels are configurable, root runtime URLs mark Home active, and the LMS snapshot was regenerated through the product Playwright generator.

-   [x] Fix LMS Page seed/generator data so Page codenames have both EN and RU VLC values without bumping schema or template versions.
-   [x] Make metahub Settings entity tabs follow Entity constructor ordering so Pages appear immediately after Hubs without hardcoded kind ordering.
-   [x] Improve required Workspace connector notification copy and place it above the disabled enabled switch.
-   [x] Add application Connector settings for localized schema diff labels, defaulting to enabled.
-   [x] Expand connector schema diff overview to show all transferred entity types grouped dynamically by Entity metadata, using localized display names when enabled.
-   [x] Mark the published app home menu item active on the root application URL.
-   [x] Add/adjust regression tests and regenerate the LMS snapshot through the product Playwright generator.

## Active: LMS Runtime Manual QA Remediation (2026-05-12)

> Goal: close manual QA findings from the freshly rebuilt LMS application without adding LMS-specific runtime forks: improve required workspace connector UX, render structured values safely, restore active menu state, enforce EN/RU fixture localization, and add regression coverage.
> Status: completed. Required workspace connector UX, generic structured value formatting, active published-app menu state, bilingual LMS fixture seed data, regenerated snapshot, and regression coverage are complete.

-   [x] Improve required workspace policy messaging in the connector diff dialog and remove unnecessary acknowledgement when workspaces are required by the publication.
-   [x] Add generic structured runtime value formatting so objects/arrays/VLC/report definitions/quiz options never render as `[object Object]`.
-   [x] Restore active published-app menu styling to match the MUI dashboard template behavior.
-   [x] Audit and fix LMS fixture/generator EN/RU localization gaps, including codename/presentation/seed data that currently shows English in RU fields.
-   [x] Expand unit and Playwright coverage for workspace policy UX, structured table/form rendering, active menu state, and bilingual fixture integrity.
-   [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only through the product Playwright generator and run targeted validation.

## Active: iSpring-like LMS QA Remediation (2026-05-12)

> Goal: close the implementation QA findings without adding LMS-specific runtime forks: saved-report execution, report aggregations, registrar-only ledger boundaries, role policy control-panel editing, and updated validation/docs.
> Status: completed. Runtime saved-report execution, aggregations, ledger-boundary filtering, access settings editing, docs, unit tests, lint/build checks, and LMS Playwright runtime proof are complete.

-   [x] Restrict runtime report execution to saved `Reports` Catalog records and preserve safe metadata-only SQL resolution.
-   [x] Add real report aggregation execution and response validation for generic report definitions.
-   [x] Align report target discovery with runtime Catalog boundaries so registrar-only ledger Catalogs stay internal.
-   [x] Add an application settings role-policy editor that reuses the existing MUI settings surface and persists through sanitized settings.
-   [x] Update tests, API helper contracts, docs, and memory-bank records for the QA remediation.
-   [x] Run targeted lint/build/test validation for the changed packages.

## Active: iSpring-like LMS Platform Roadmap Implementation (2026-05-11)

> Goal: implement the approved iSpring-like LMS platform roadmap end to end without LMS-specific runtime forks, preserving the Metahub-first architecture, generic Entity primitives, MUI dashboard parity, UUID v7, i18n, secure SQL, and Playwright-generated fixture workflow.
> Status: completed. 2026-05-11 implementation completed shared contracts, LMS template/fixture expansion, safe report runner, docs, generator proof, imported-workspace seed hardening, role policy enforcement, metadata-backed widget datasource pickers, optimistic mutation rollback coverage, and no-version-bump guard coverage.

-   [x] Phase 0: Capture baseline audit for LMS fixture, generic widgets, scripts, ledgers, demo surfaces, and no-version-bump constraints.
-   [x] Phase 1: Add product acceptance matrix and expand LMS fixture contract with generic product-level invariants.
-   [x] Phase 2: Add shared generic resource contracts and wire LMS resource metadata through existing Catalog/Page/runtime surfaces.
-   [x] Phase 3: Add generic sequence, completion policy, lifecycle status, and workflow-action contracts without expanding core `post`/`unpost`/`void` commands.
-   [x] Phase 4: Extend existing application/workspace capability policy model for LMS labels and backend runtime enforcement.
-   [x] Phase 5: Add Catalog-backed report definition contracts and safe report runner over validated runtime datasource descriptors.
-   [x] Phase 6: Improve existing application control-panel and widget editor surfaces with metadata-backed pickers and TanStack Query-safe mutations.
-   [x] Phase 7: Restore published app MUI dashboard visual parity and block remaining demo-only surfaces from runtime layouts.
-   [x] Phase 8: Expand LMS template metadata, ledgers, scripts, statuses, and realistic seed records using generic platform primitives.
-   [x] Phase 9: Update the Playwright LMS generator, regenerate `tools/fixtures/metahubs-lms-app-snapshot.json`, and enforce snapshot contract validation.
-   [x] Phase 10: Add backend, frontend, and Playwright coverage for workflows, reports, roles, workspace isolation, screenshots, i18n, and no-version-bump checks.
-   [x] Phase 11: Update package READMEs and GitBook docs in `docs/en` and `docs/ru`.

### Current Implementation Slice

-   [x] Phase 4a: Add generic application role-policy normalization and effective permission resolution from existing application settings.
-   [x] Phase 4b: Enforce report read capability in the safe report runner and cover fail-closed behavior.
-   [x] Phase 6a: Replace raw section datasource entry in the existing widget behavior editor with metadata-backed section pickers while preserving manual codename fallback.
-   [x] Phase 6b: Add TanStack Query optimistic rollback coverage for layout widget config saves.
-   [x] Phase 10a: Add targeted backend/frontend tests for role policy, report authorization, metadata pickers, and no-version-bump guard.
-   [x] Phase 10b: Re-run focused package lint/build/tests and LMS generator/runtime Playwright flows.
-   [x] Phase 10c: Wire the safe generic report runner to an authenticated runtime reports endpoint and typed published-app API helper.

### Current Blocker

-   [x] Fix imported publication workspace seed reference remapping for catalog `REF` values in restored snapshots. Evidence: `node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts` now passes through linked app creation, schema sync, guest runtime, ledger facts, and post/unpost flow.
-   [x] Added regression hardening for workspace seed ordering, retrying unresolved references, unique global `_seed_source_key` fallback, and legacy `table_name` object id lookup.

## Active: LMS Fixture Workspace Policy And Sync Regression Closure (2026-05-10)

> Goal: make the product LMS snapshot require application Workspaces, preserve that policy through snapshot import, regenerate the fixture from the Playwright generator, and keep optional no-Workspace sync behavior guarded.
> Status: completed and recorded in progress.md.

-   [x] Add an explicit required Workspace runtime policy to the LMS product snapshot generator and fixture contract.
-   [x] Preserve imported snapshot runtime policy when creating the canonical publication/version during metahub import.
-   [x] Adjust browser flow coverage for required Workspace policy during imported LMS schema sync.
-   [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator.
-   [x] Run focused backend, contract, and Playwright validation and record progress.

## Completed: Generic Posting Registrar Kind QA Closure (2026-05-10)

> Goal: close the QA findings that left Catalog-specific posting semantics in the runtime posting movement path.
> Status: completed and recorded in progress.md.

-   [x] Pass posting registrar kind from runtime Entity metadata instead of hardcoding Catalog in `RuntimePostingMovementService`.
-   [x] Replace remaining Catalog-specific runtime posting error text with neutral record-collection wording.
-   [x] Add focused backend regression coverage for non-Catalog registrar kinds.
-   [x] Run targeted backend validation and record the completed evidence.

## Completed: Catalog-Backed Ledger Schema Templates (2026-05-10)

> Goal: make Catalogs the default universal Entity type for directory, document, and ledger-like behavior while keeping standalone Ledgers as optional entity type presets.
> Status: completed and recorded in progress.md.

-   [x] Enable `ledgerSchema` in the standard Catalog entity type contract and expose it through shared Entity constructor UI.
-   [x] Remove default Ledger seeding from `basic`, `basic-demo`, and LMS metahub templates while keeping the Ledger preset available for manual use.
-   [x] Convert LMS ledger-like objects to Catalog instances with `config.ledger` instead of standalone `kind: ledger` objects.
-   [x] Replace remaining Catalog/Ledger option hardcoding in linked collection dialogs with component-capability discovery.
-   [x] Keep registrar-only Catalog-backed ledger objects out of ordinary published runtime CRUD and workspace seed flows.
-   [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator.
-   [x] Run focused backend/frontend/runtime validation and record the final evidence.

## Completed: Ledger Schema QA Closure (2026-05-10)

> Goal: close the implementation QA findings for generic Ledger schema support without legacy kind fallbacks, uncontrolled runtime errors, or untested Ledger authoring UI.
> Status: completed and recorded in progress.md.

-   [x] Return controlled runtime API errors for invalid, missing, or unavailable Ledger ids.
-   [x] Enforce full `config.ledger` reference validation in Entity authoring and publication/import boundaries.
-   [x] Remove remaining Ledger `kind === 'ledger'` compatibility fallbacks from schema/runtime/workspace/script gates.
-   [x] Add focused tests for component-only Ledger capability gates and Ledger config reference validation.
-   [x] Add browser coverage for the `Schema registr` authoring tab and persistence flow.
-   [x] Run targeted tests, lint/build checks, regenerate the LMS snapshot when needed, and record progress.

## Active: Generic Ledger Schema Entity Constructor Implementation (2026-05-10)

> Goal: implement the QA-refined `ledgerSchema` plan so Ledger behavior is driven by the generic Entity constructor component contract, supports future hybrid Catalog-like entities, and remains safe in published runtime applications.
> Status: completed and recorded in progress.md.

-   [x] Harden shared Ledger config and component capability contracts in `@universo/types`.
-   [x] Replace Ledger kind-only backend/schema/runtime gates with component-capability checks and safe published runtime metadata.
-   [x] Add generic metahub UI for `config.ledger` through the existing Entity dialog and shared field-definition surfaces.
-   [x] Extend application widget datasource editing and `apps-template-mui` runtime widgets for `ledger.facts`, `ledger.projection`, and real metric datasource behavior.
-   [x] Update standard templates, LMS template, fixture contract, and regenerate the LMS snapshot only through the product Playwright generator.
-   [x] Add focused unit, backend, frontend, schema, and Playwright coverage.
-   [x] Update GitBook docs and package README notes for generic Ledgers and hybrid Catalog/Ledger configurations.
-   [x] Run targeted validation and record progress.

## Completed: Linked Collection Record Behavior QA Fixes (2026-05-09)

> Goal: close the QA findings in the standard linked-collection Catalog preset without adding Catalog-only UI or breaking the generic Entity constructor contract.
> Status: completed and recorded in progress.md.

-   [x] Preserve edited `recordBehavior` values when copying a linked collection.
-   [x] Use the active linked-collection `kindKey` for script attachment queries and tabs instead of hardcoded `catalog`.
-   [x] Add focused regression coverage for copy payload behavior and non-catalog linked-collection script attachment kind.
-   [x] Run targeted lint/tests and record the completed validation.

## Active: Catalog Record Behavior QA Closure (2026-05-09)

> Goal: close the QA findings for the generic Catalog record behavior UI without adding Catalog-only interfaces or LMS-specific shortcuts.
> Status: completed and recorded in progress.md.

-   [x] Avoid MUI out-of-range select warnings when saved behavior references fields, scripts, or ledgers whose option lists have not loaded yet.
-   [x] Fetch Ledger options for the behavior tab only while a create/edit/copy entity dialog is open.
-   [x] Add browser E2E coverage for the RU Catalog `Povedenie` authoring flow, including save/reopen persistence and screenshots.
-   [x] Run focused frontend/build/Playwright validation and update progress notes.

## Active: Entity-Driven Catalog Record Behavior UI (2026-05-09)

> Goal: expose the existing record behavior runtime contract through the generic Entities constructor, update standard Catalog templates, localize script capabilities, and prove the flow with focused tests.
> Status: completed and recorded in progress.md.

-   [x] Add shared `recordBehavior` validation and normalization in `@universo/types`, then reuse it in runtime consumers.
-   [x] Add `behavior` as a structured entity authoring tab driven by entity type components, not Catalog hardcode.
-   [x] Implement a generic `RecordBehaviorFields` dialog section and persist `config.recordBehavior` without dropping unrelated config.
-   [x] Fix script capability i18n for `posting`, `ledger.read`, and `ledger.write`.
-   [x] Update standard Catalog template contracts, fixture contract checks, and documentation.
-   [x] Add focused unit/component tests and run targeted validation.

## Completed: LMS Runtime Datasource QA Closure (2026-05-09)

> Goal: close the stopped follow-up implementation by proving the generated LMS snapshot and published app runtime path with strict browser/runtime issue checks.
> Status: completed and recorded in progress.md.

-   [x] Re-run the LMS snapshot import/runtime Playwright flow from the product fixture path.
-   [x] Keep `tools/fixtures/metahubs-lms-app-snapshot.json` generated from the product Playwright generator rather than manually edited.
-   [x] Pass locale, sections, and linked collections through the integrated application runtime dashboard details provider.
-   [x] Localize MUI Charts no-data overlays for configured runtime chart widgets.
-   [x] Pass runtime search/sort/filter parameters through the production frontend adapter and API wrapper.
-   [x] Fix backend runtime datasource sort/filter validation for localized attribute codenames.
-   [x] Run focused unit/build validation and the full LMS browser flow.

## Completed: LMS Runtime UX QA Remediation (2026-05-09)

> Goal: close the user-reported LMS runtime QA findings without adding LMS-specific UI or diverging from the shared Entity and MUI template surfaces.
> Status: completed and recorded in progress.md.

-   [x] Restore Ledger collection localization and shared search labels in the metahub Entity list.
-   [x] Make Ledger cards/table rows open the shared internal field-definition surface.
-   [x] Localize the shared field-definition tab and empty states for Ledgers and generic entity kinds.
-   [x] Prevent configured runtime dashboard chart widgets from falling back to demo data when datasources are empty.
-   [x] Localize LMS dashboard widget labels through generic localized widget config.
-   [x] Add focused frontend regressions and run targeted validation.
-   [x] Update progress notes after validation.

## [2026-05-08] LMS QA And Platform Expansion Cluster

-   **LMS QA Final Debt Closure**: Ledger mutation/source policies enforced, posting reversal metadata added, hardcoded LMS guest bindings replaced with generic config.
-   **LMS QA Debt Closure**: Neutral public guest API aliases added; `manualEditable` Ledger mutation policy enforced.
-   **LMS QA Final Remediation**: Neutral public guest runtime config accepted; browser-flow security assertions added.
-   **LMS QA Blocker Closure**: Server-managed settings preserved; guest session secrets stored as hashes; CSRF retry races hardened.
-   **LMS QA Follow-up Hardening**: Guest bindings moved from LMS defaults to explicit settings; system-level Ledger reversal idempotency added.
-   **LMS QA Remediation Hardening**: Database-level Ledger idempotency; posting reversal fails closed; browser E2E extended.
-   **LMS QA Remediation Completion**: All QA blockers removed (Ledger policies, posting reversals, runtime hardcoding, browser proof).
-   **LMS Phase 10 Validation**: Full package tests run; stale test contracts fixed; docs/generator/lint/build verified.
-   **LMS Fixture Generator And Import Proof**: EN/RU breadth enforced; fixture regenerated and proved through browser flow.
-   **LMS Generic Widget Datasources**: Codename-based datasource targets added; LMS widgets configured via generic keys.
-   **LMS Placeholder Cleanup**: Support email placeholder replaced with empty configurable value.
-   **LMS Lifecycle Script Seeds**: Auto-enrollment, quiz/module/certificate posting scripts seeded; ModuleProgress marked transactional.
-   **LMS Bilingual Page Entities**: Reusable localized Editor.js page helpers; CourseOverview, KnowledgeArticle, etc. Page entities added.
-   **LMS Transactional Event Catalogs**: QuizAttempts, AssignmentSubmissions, TrainingAttendance, CertificateIssues added as transactional event catalogs.
-   **LMS Transactional Catalog Behavior**: Reusable transactional config helper; QuizResponses, Assignments, etc. marked transactional.
-   **LMS Additional Ledger Definitions**: Generic additional Ledger entities via reusable template helper.
-   **LMS Generic Runtime Policy Settings**: Dashboard/datasource/workspace policy fields added; EN/RU i18n keys.
-   **LMS Overview Cards Metric Authoring**: Multi-card metric controls in ApplicationWidgetBehaviorEditorDialog.
-   **LMS Chart Datasource QA**: MUI chart cards consume runtime props; `records.list` datasource resolved.
-   **LMS Generic Metric Widgets**: Typed metric-backed stat/overview card config; `records.count` metrics resolved.
-   **LMS Details Table Datasource Authoring**: `detailsTable` datasource settings in widget behavior editor.
-   **LMS Generic Runtime Datasource Tables**: Generic datasource descriptors; server-side search/sort/filter query models.
-   **LMS Posting Movement E2E Proof**: LMS posting lifecycle script added; reusable E2E runtime API helpers.
-   **LMS Posting Movement Contract**: Shared posting movement return types; backend movement validation; fail-closed beforePost.
-   **LMS Ledger Runtime Services**: RuntimeLedgerService with metadata/facts/projection/append/reversal; script SDK `ctx.ledger.reverse()`.
-   **LMS Runtime Record Command Hardening**: Concurrent record number tests; invalid transition tests; posted-row immutability tests.
-   **LMS Runtime Record Commands UI**: Record behavior/state in runtime responses; post/unpost/void row actions in apps-template-mui.
-   Details: progress.md (2026-05-08 entries)

## Active: LMS Catalog And Ledger Platform Expansion (2026-05-07)

> Goal: implement the QA-reviewed LMS platform plan by extending Catalog behavior, adding the standard Ledger entity kind, keeping shared Entity UI reuse, and preparing the runtime/snapshot/testing path without LMS-specific runtime forks.
> Status: completed and recorded in progress.md.

-   [x] Add shared Catalog record behavior and Ledger contracts in `@universo/types`.
-   [x] Extend the Entity component manifest and dependency validation for identity, lifecycle, posting, and ledger capabilities.
-   [x] Add `ledger` to built-in entity kinds, entity settings/surfaces, menu kinds, script attachment kinds, and schema DDL built-in helpers.
-   [x] Add the standard Ledger type definition and preset metadata; extend standard Catalog preset with default record behavior config.
-   [x] Route Ledgers through the shared generic Entity instance UI; add EN/RU i18n labels for Ledgers and shared dialog titles.
-   [x] Ensure record behavior and ledger config round-trip through template, publication, snapshot, and restore paths.
-   [x] Extend the LMS template with Ledger objects and transactional Catalog behavior.
-   [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` through the official Playwright generator.
-   [x] Add runtime numbering/posting service contracts, ledger metadata/query contracts, and generic datasource plumbing.
-   [x] Update package READMEs and GitBook docs.
-   [x] Run focused type/unit tests, frontend route tests, full build, LMS Playwright generator, runtime Ledger/script bridge tests, and schema DDL tests.

## Completed: start:allclean Command Implementation (2026-05-07)

-   Added `force` parameter to `executeStartupFullReset()`, `--reset-db` CLI flag, `start:allclean` script. All 21 unit tests pass; full build passes (30 packages).
-   Details: progress.md#2026-05-07-start-allclean-command

## Completed: Startup Supabase Full Reset (2026-05-07)

-   All phases implemented and QA-verified. Details: progress.md#2026-05-07-startup-supabase-full-reset

## Active: Node.js 22 Migration (2026-05-06)

> Goal: Migrate project from Node.js 20 to Node.js 22.6.0+ to enable autoskills tool support.

### Critical Finding from QA

**isolated-vm version incompatibility discovered:**

-   Current: isolated-vm@5.0.4 (requires Node.js >=18.0.0, does NOT support Node.js 22)
-   Required: isolated-vm@6.x (requires Node.js >=22.0.0, mandatory for Node.js 22)

**Migration sequence must be:**

1. First upgrade isolated-vm to 6.x on Node.js 20
2. Verify all tests pass
3. Then migrate to Node.js 22

### Phase 1: Preparation and Risk Assessment

-   [x] Step 1.1: Create comprehensive dependency audit for Node.js 22 compatibility
-   [x] Step 1.2: Review isolated-vm 6.x CHANGELOG for breaking changes
-   [x] Step 1.3: Audit AWS SDK dependencies compatibility

### Phase 2: Local Development Migration

-   [x] Step 2.1: Update package.json engines field to >=22.6.0
-   [x] Step 2.2: Create .nvmrc file at project root with "22"
-   [x] Step 2.3: Verify server startup scripts have --no-node-snapshot flag
-   [x] Step 2.4: Install Node.js 22 locally via nvm
-   [x] Step 2.5: Upgrade isolated-vm from 5.0.4 to 6.1.2
-   [x] Step 2.6: Clean install with new Node.js version

### Phase 3: Build and Test Validation

-   [x] Step 3.1: Run full build (pnpm build) - PASSED (3m1s)
-   [x] Step 3.2: Run linting (pnpm lint) - PASSED (scripting-engine fixed)
-   [x] Step 3.3: Run unit tests (pnpm test:vitest) - PASSED (911 tests, 173s)
-   [ ] Step 3.4: Run E2E smoke tests (pnpm test:e2e:smoke)
-   [ ] Step 3.5: Run Playwright flow tests (pnpm test:e2e:flows)
-   [x] Step 3.6: Verify scripting engine runtime (pnpm benchmark) - PASSED (mean: 1.47ms, p95: 2.16ms)

### Validation Summary (2026-05-07)

-   Build: All 30 packages built successfully
-   Lint: Fixed prettier formatting in scripting-engine
-   Unit tests: 911 tests passed across 161 test files
-   Scripting engine: isolated-vm 6.x works correctly with Node.js 22
-   Remaining: E2E tests (require running server)

### Phase 4: CI/CD Pipeline Update

-   [x] Step 4.1: Update GitHub Actions workflow to Node.js 22.x
-   [x] Step 4.2: Update pnpm version in CI if needed (no change required)
-   [ ] Step 4.3: Verify CI build passes (USER ACTION: push to test branch)

### Phase 5: Production Deployment Preparation

-   [x] Step 5.1: Update deployment documentation
-   [ ] Step 5.2: Create deployment checklist (environment-specific)
-   [ ] Step 5.3: Staging environment test (environment-specific)

### Phase 6: Documentation and Knowledge Transfer

-   [x] Step 6.1: Update tech.md steering file with Node.js 22 requirements
-   [x] Step 6.2: Update README.md prerequisites section
-   [x] Step 6.3: Update memory-bank/techContext.md
-   [x] Step 6.4: Create migration guide for developers

## [2026-05-06] Hub-Assignable, Runtime Sync, Localized Tabs

-   **QA Follow-Up For Generic Hub-Assignable Entities**: Backend route tests fixed for generic `treeAssignment` query order; LMS fixture hash verified.
-   **Generic Hub-Assignable Entity Integration**: Hub detail tabs built from Entity types with enabled tree assignment; hub dependency detection generalized.
-   **Runtime Start Section Stale Placeholder Suppression**: Fixed runtime root briefly rendering non-start section; React Query placeholderData race fixed.
-   **Application Sync RLS Transaction Boundary Closure**: Schema sync 500 fixed by mounting sync route with plain auth (sync manages own DDL transactions).
-   **Generic Localized Variant Tabs For Page Content**: Page content language tabs extracted into reusable `LocalizedVariantTabs` component; primary locale marked with Star icon.
-   Details: progress.md (2026-05-06 entries)

## [2026-05-05] Page UX And LMS Content Closure Cluster

-   **LMS Page Content Import And Editor.js UX**: Short preset Welcome Page removed; `LearnerHome` renamed to Welcome; Editor.js init fixed for late-loaded content.
-   **LMS Runtime Welcome Assertion**: Welcome page assertions moved to shared fixture contract text constants; LMS Playwright flow updated.
-   **Page Shared Action Icons And LMS Welcome Content**: Entity action icons centralized; LMS Welcome expanded with full EN/RU Editor.js block content.
-   **Page Entity Menu Parity And Hubs Column**: Page-specific menu descriptors removed; table column relabeled as `Hubs` when using `hubs` tab alias.
-   **Page Hubs Picker VLC Codename Crash**: Fixed crash from VLC codename objects reaching React render output; string extraction added.
-   **Page Content Visual And Generic Capability**: Language buttons reduced to shared 28px size; Editor.js toolbar repositioned; Hubs/Layouts tabs derived from Entity capability.
-   **Generic Page Entity UX Parity**: Stable localized fallbacks before async metadata; skeleton loading prevents empty-state flash; localized `presentation.dialogTitles`.
-   **Localized Editor.js Page Content QA**: `contentLocale` separate from UI locale; independent content language tabs; Russian Editor.js dictionary completed.
-   Details: progress.md (2026-05-05 entries)

## [2026-05-04] Editor.js Authoring And LMS Template Closure Cluster

-   **Page Block Content Constraint**: `allowedBlockTypes` and `maxBlocks` enforced on backend create/update/copy and snapshot import.
-   **Editor.js Page Authoring QA**: Snapshot restore normalizes imported block content; metadata dialogs no longer carry hidden `blockContentText`.
-   **Editor.js Page Authoring Route**: Dedicated `/content` route with Editor.js core; stored content normalized to canonical schema.
-   **Entity Page UI Parity**: Breadcrumbs prefer localized Entity type data; row/card actions replaced with shared `BaseEntityMenu`.
-   **LMS Snapshot Import Failure**: Page preset disabled during import bootstrap; import errors now show structured messages.
-   **LMS Page QA**: Page metadata UI reads allowCopy/allowDelete; Chromium flow covers full Page lifecycle.
-   **LMS Basic Template Sets And Page UX**: LMS inherits Basic baseline; Page collection UI uses standard translations; Page settings through shared registry.
-   **LMS Workspace Policy And Runtime Menu Cleanup**: "No workspaces" policy removed; only personal Main workspace seeded; workspace actions in three-dot menu.
-   Details: progress.md (2026-05-04 entries)

## [2026-05-03] LMS Page Type, Workspace, And Security Cluster

-   **LMS Workspace And Page QA Hardening**: Connector schema_options persisted only after applied sync; irreversible workspace acknowledgement; Page block authoring added; LMS template expanded with Departments, Learning Tracks, etc.
-   **LMS Security And Page UX QA**: Guest session tokens bound to access link; `page` added to shared menu item kind contract; all Page block types rendered.
-   **LMS Page Workspace QA**: Legacy workspace inputs removed; Page blockContent validated with Zod; Page deletion blocks active references.
-   **LMS Page Type And Workspace Policy**: `page` registered as standard metadata type; publication versions persist `runtimePolicy.workspaceMode`; Page rendering in apps-template-mui.
-   **LMS PR Hygiene**: Stale test wording replaced; UUID v4 fallback removed; shared `sanitizeMenuHref`/`isSafeMenuHref` added.
-   Details: progress.md (2026-05-03 entries)

## [2026-05-02] LMS Portal Runtime And QA Cluster

-   **LMS Backend QA Blocker**: Migration-chain invariant aligned; sync diff TABLE child-field regression fixed; menu href hardened.
-   **LMS Documentation And Template Lint**: Stale GitBook wording removed; `activeContext.md` refreshed; `apps-template-mui` lint reduced to zero warnings.
-   **LMS Runtime Child Rows QA**: Child-row read/write permissions corrected; copied values normalized with declared `data_type`.
-   **LMS QA Closure**: `member` made read-only runtime role; runtime content permissions exposed; TABLE child copy fixed.
-   **Gate Demo Template Surfaces**: Dashboard defaults set to false; hardcoded user profile replaced; LMS template has no demo widgets.
-   **Public Shared Workspace Selection**: `codename` column added to `_app_workspaces`; public runtime resolves workspace from access link.
-   **Remove Legacy LMS Widget Types**: moduleViewerWidget, statsViewerWidget, qrCodeWidget fully removed.
-   **LMS Portal Runtime Refactor**: Legacy widgets removed; runtime menu supports maxPrimaryItems/overflow/startPage; public workspaces seed only personal Main; QA remediation for start page, duplicate entries, menu links.
-   Details: progress.md (2026-05-02 entries)

## Completed: Runtime Workspace PR Review Hardening (2026-04-29)

-   [x] Reset runtime system metadata instead of copying from source rows during workspace copy
-   [x] Return and consume stable runtime workspace API error codes for localized UI errors
-   [x] Replace workspace UI hard reload navigation with host-provided SPA navigation
-   Details: progress.md#2026-04-29-runtime-workspace-pr-review-hardening

## Completed: Runtime Workspace I18n And Switcher Locale Closure (2026-04-29)

-   [x] Render workspace switcher VLC names using the active UI locale
-   [x] Localize remaining runtime workspace backend error messages in the published-app UI
-   [x] Add focused component tests for Russian switcher labels and error messages
-   Details: progress.md#2026-04-29-runtime-workspace-i18n-and-switcher-locale-closure

## Completed: Runtime Workspace Direct Route QA Closure (2026-04-28)

-   [x] Add backend direct workspace detail contract for user-scoped lookups
-   [x] Update runtime workspace UI to resolve `/workspaces/:workspaceId` independently of list pagination
-   [x] Stabilize the Playwright RU screenshot wait for rendered workspace cards
-   Details: progress.md#2026-04-28-runtime-workspace-direct-route-qa-closure

## Completed: Runtime Workspace Layout And CRUD QA Closure (2026-04-28)

-   [x] Materialize runtime `workspaceSwitcher` widget as real left-zone layout widget
-   [x] Add workspace card/table actions for edit, copy, and delete
-   [x] Localize workspace form/action errors and fix dialog action spacing
-   [x] Browser proof: card/list mode, search, pagination, owner/member permissions, screenshots
-   Details: progress.md#2026-04-28-runtime-workspace-layout-and-crud-qa-closure

## Completed: Runtime Workspace QA Remediation Closure (2026-04-27)

-   [x] Add fail-closed UUID validation for runtime workspace route params
-   [x] Remove the shared workspace machine-name contract (name-only workspace mutations)
-   [x] Surface workspace member removal failures in the published-app UI
-   [x] Expand Playwright browser coverage for negative/error workspace paths
-   Details: progress.md#2026-04-27-runtime-workspace-qa-remediation-closure

## Completed: Mutable Application Visibility And Runtime Workspace Management (2026-04-27)

-   [x] Backend visibility mutation with optimistic locking, RLS-compatible SQL, fail-closed public runtime
-   [x] Runtime workspace APIs with pagination, search, profile fields, email-based member invitation
-   [x] Application settings UI for mutable visibility and read-only workspace mode
-   [x] Published workspace section inside dashboard shell using shared UI primitives
-   [x] EN/RU i18n keys across touched frontend packages
-   [x] Playwright/browser coverage and screenshots for visibility and workspace flows
-   Details: progress.md#2026-04-27-mutable-application-visibility-and-runtime-workspace-management

## Completed: Entity Resources Data-Driven Cleanup (2026-04-26)

-   [x] Add shared resource surface contracts/helpers in `@universo/types`
-   [x] Seed standard resource surface labels as localized entity metadata
-   [x] Remove synthetic builtin entity type fallback
-   [x] Render Resources tabs from persisted resource surface metadata through capability registry
-   [x] Preserve and test entity type resource metadata through snapshot/release bundle paths
-   [x] QA remediation: VLC validation, negative tests, conflict diagnostics, Playwright browser coverage
-   Details: progress.md#2026-04-26-entity-resource-surface-data-driven-cleanup

## Completed: Steering Files Refactoring (2026-04-24)

-   [x] Rewrite product.md (Metahubs Platform description, ECAE architecture)
-   [x] Update structure.md (31 packages, package classification)
-   [x] Update tech.md (current versions, DDL system, new technologies)
-   [x] Expand recommendations.md (Three-Tier DB Access, SQL Safety, Testing Rules)
-   Details: progress.md#2026-04-24-steering-files-refactoring

## Completed: Application Layout Management (2026-04-21 to 2026-04-22)

-   [x] Backend layout store/service/routes with SQL-first access, validation, optimistic version checks
-   [x] Merge-aware connector sync with structured layout conflict resolution
-   [x] Frontend layout detail/list editor reusing shared `@universo/template-mui` components
-   [x] Metahub/application list and detail parity convergence
-   [x] Sidebar navigation fix, read-access policy, shared widget-config validation
-   [x] Browser proof: conflict-resolution, widget moves, parity screenshots
-   Details: progress.md#2026-04-22-application-layout-management-shared-list-and-parity-closure

## Completed: PR #771 Bot Review Triage (2026-04-21)

-   [x] Typed runtime workspace errors plus stable error codes
-   [x] Per-app CSRF token isolation for public guest apps
-   [x] QRCodeWidgetConfig.url made optional in shared types
-   [x] Rejected: uuid_generate_v7() rename, batch quiz inserts, useParams-only GuestApp refactor
-   Details: progress.md#2026-04-21-pr-771-bot-review-triage

## Completed: LMS MVP Full Implementation (2026-04-19 to 2026-04-21)

-   [x] Generic workspace runtime API/UI wiring in the dashboard shell
-   [x] LMS metahub template/data contract with learning hub seed
-   [x] Guest/public runtime access end-to-end (public links, sessions, quiz, progress)
-   [x] Guest runtime credential transport hardening (headers instead of query params)
-   [x] Shared-workspace-safe public access resolution
-   [x] Canonical LMS snapshot regeneration through official Playwright generator
-   [x] LMS guest localization and QA closure (RU completion copy, defensive locale resolution)
-   [x] EN/RU GitBook pages for LMS, workspace management, guest access
-   Details: progress.md#2026-04-21-lms-final-closure-and-canonical-fixture-regeneration

## Completed: LMS MVP QA Remediation (2026-04-19 to 2026-04-20)

-   [x] Fix RLS blocker: public guest queries set `app.current_workspace_id` before catalog queries
-   [x] Wrap `submitGuestQuiz` question inserts in transaction
-   [x] Add IDENTIFIER_REGEX validation for dynamic column names in guest controller
-   [x] Fix ModuleViewerWidget quiz_ref rendering, WorkspaceManagerDialog duplicate heading, WorkspaceSwitcher spinner
-   [x] Remove deprecated `document.execCommand('copy')` fallback
-   [x] Wrap `createSharedWorkspace` and `addWorkspaceMember` in transactions
-   [x] Add guest-session expiry enforcement without schema-version churn
-   [x] Extract shared runtime widget script-loading hook for ModuleViewerWidget and StatsViewerWidget
-   [x] Add negative E2E coverage for public LMS guest runtime (expired link, max-uses, wrong slug)
-   [x] Resolve public LMS workspace isolation from access-link workspace
-   [x] Fix public guest runtime TABLE child-row loading and enumeration codename normalization
-   [x] Align guest persistence writes with canonical runtime workspace-aware contract
-   Details: progress.md (2026-04-19 to 2026-04-20 entries)

## Completed: Metahub Final QA Debt Elimination (2026-04-18)

-   [x] Remove remaining legacy metadata terminology from rest-docs, shared comments, menu labels
-   [x] Eliminate metahubs-frontend test-only lint warning debt with package-scoped ESLint override
-   [x] Replace Resources entity-type label lookup hard limit with full pagination
-   [x] Remove stale legacy `general.tabs` labels from EN/RU metahubs i18n
-   [x] Rewrite remaining RU metahub resource docs pages
-   [x] Add browser-level ACL regression for read-only metahub members
-   Details: progress.md (2026-04-18 entries)

## Completed: QA Closure - i18n, Resources, Lint, Documentation (2026-04-18)

-   [x] Add missing `records.*` i18n section (~44 keys) to EN/RU locales
-   [x] Make Resources tabs dynamic based on entity type ComponentManifest
-   [x] Fix all 19 production-file lint warnings
-   [x] Fix README documentation drift
-   [x] Full validation: pnpm build 30/30, backend 68/68, frontend 64/64, lint 0 errors
-   Details: progress.md (2026-04-18 QA closure entries)

## Completed: Entity Type Naming Refactoring (2026-04-17)

-   [x] Rename all entity type display names to traditional names (Hubs, Catalogs, Sets, Enumerations)
-   [x] Internal surface keys preserved; only display names, presets, i18n, and docs updated
-   [x] Sidebar menu restructured: dynamic entity types under Resources
-   [x] Updated: backend presets, i18n sections (EN+RU), 25+ frontend source files, 11 E2E specs, 14 docs files
-   Details: progress.md#2026-04-17-entity-type-naming-refactoring

## Completed: Distributed Noodling Ullman Plan Continuation (2026-04-17)

-   [x] Regenerated both canonical snapshot fixtures via Playwright generators
-   [x] Stabilized documentation screenshot generators
-   [x] Closed Playwright drift in regression/full-cycle flows
-   [x] Revalidated entity-first browser flows
-   Details: progress.md#2026-04-17-distributed-noodling-ullman-plan-continuation-closure

## Completed: QA Hardening + Entity-First Contract Closure (2026-04-17)

-   [x] Harden public linked-collection resolution to prevent unrelated object surface leaks
-   [x] Synchronize entityInstancesRoutes delete-policy expectations to neutral entity-first contract
-   [x] Extended public routes tests for non-linked-collection exclusion
-   [x] Reconcile entity copy payload contracts across frontend and backend
-   [x] Remove stale legacy-named metahubs frontend folder seam (`constants` -> `view-preferences`)
-   Details: progress.md (2026-04-17 QA entries)

## Completed: Full Legacy Vocabulary Elimination (2026-04-16)

-   [x] Phase 1: `catalogRuntimeConfig.ts` -> `linkedCollectionRuntimeConfig.ts`
-   [x] Phase 2: `entityComponents.ts` property neutralization (`predefinedElements` -> `records`, etc.)
-   [x] Phase 5: `standardKind*` infra file renaming -> `builtinKind*`
-   [x] Phase 6: localStorage key migration with backward-compat aliases
-   [x] Phase 7: Full build 30/30, backend 68/68 suites, frontend 64/64 files
-   [x] Phase 8: E2E via Playwright CLI -- 2/2 passed
-   [x] Wire protocol count field neutralization across backend/frontend
-   [x] Bulk parameter/variable renaming: `hubId`->`treeEntityId`, `catalogId`->`linkedCollectionId`, `setId`->`valueGroupId`, `enumerationId`->`optionListId`
-   Details: progress.md (2026-04-16 entries)

## Completed: Final Legacy Snapshot Key + Preset KindKey Cleanup (2026-04-21)

-   [x] Rename snapshot output keys (`sharedAttributes` -> `sharedFieldDefinitions`, etc.)
-   [x] Rename `constants-library` preset -> `fixed-values-library`
-   [x] Remove `legacyObjectKind` IIFE + compatibility fallback
-   [x] Full build verification: 30/30 packages pass
-   Details: progress.md (2026-04-21 snapshot cleanup entry)

## Completed: Entity-First Final Refactoring (2026-04-14 to 2026-04-15)

All phases of the entity-first final migration completed:

-   [x] Backend behavior registry, controller de-specialization, legacy domain folder deletion
-   [x] Frontend metadata capability neutralization (`attribute`->`fieldDefinition`, `constant`->`fixedValue`, `element`->`record`)
-   [x] Public runtime route neutralization, metadata transport segment neutralization
-   [x] Public type/API helper/mutation/hook/route builder neutralization
-   [x] Standard copy contract, branch copy contract neutralization
-   [x] Controller decomposition (entityInstancesController.ts split into 5 focused modules)
-   [x] Backend dead controller factory removal (tree, valueGroup, linkedCollection, optionList)
-   [x] Frontend top-level metadata/common folder removal
-   [x] Metadata API helper contract, frontend standard UI local alias neutralization
-   [x] Container vocabulary and shared runtime neutralization
-   [x] Frontend public type contract, tree runtime seam neutralization
-   [x] Public runtime hardening (publication-backed reads, not raw `is_public` flag)
-   [x] RecordList entity-first type reconciliation
-   [x] Behavior-based standard blocking references and hub blocking endpoint
-   [x] Entity-centric navigation, sidebar, breadcrumbs finalization
-   [x] Frontend managed-domain collapse, standard-runtime cutover
-   [x] Zero-debt grep audit for forbidden legacy markers
-   Plan: [entity-first-final-refactoring-plan-2026-04-16.md](plan/entity-first-final-refactoring-plan-2026-04-16.md)
-   Details: progress.md (2026-04-14 to 2026-04-15 entries)

## Completed: QA Remediation Post-Refactoring Polish (2026-04-14)

-   [x] Entity-First Final Refactoring phases 1-13 (Prettier/lint, i18n key migration, query key renaming, backend controller decomposition, frontend consolidation, E2E API helper renames, test alignment, fixture regeneration, documentation rewrite, final validation, deep internal identifier cleanup)
-   [x] Validation: build 30/30, backend 68/68 (581 tests), frontend 64/64 (252 tests), lint 0 errors
-   Details: progress.md#2026-04-14-refactoring-polish-entry

## Completed: Platform Infrastructure (2026-04-08 to 2026-04-12)

-   [x] Entity Component Architecture (ECAE) delivery: presets, generic entity UI, dynamic menu, browser proof
-   [x] Catalog V2 closeout, shared dialog/shell/spacing fixes, entity V2 completion
-   [x] Fixture regeneration, compatibility fixes, review triage (PR #759, PR #763)
-   [x] Shared/Common and runtime materialization closure
-   [x] Compatibility-aware blocker query, validated legacy-compatible read union
-   Details: progress.md#2026-04-08-ecae-foundation-and-qa-recovery-cluster

## Completed: Snapshot/Scripting/Parity (2026-04-03 to 2026-04-07)

-   [x] Snapshot import/export, self-hosted parity, scripting/quiz delivery
-   [x] Layout/runtime fixture and docs, E2E reset stabilization
-   Details: progress.md#2026-04-06-layout-runtime-fixture-and-docs-cluster

## [2025-07 to 2026-04-02] Earlier Platform Work

-   2026-03-11 to 2026-04-02: platform, auth, Playwright, security, codename convergence
-   2025-07 to 2026-02: alpha-era milestones (see release table in progress.md)
-   Details: progress.md#2026-04-02-to-2026-03-11-condensed-archive

---

## Notes For The Next Session

-   Keep the active ledger centered on only genuinely new regressions
-   When one open active item closes, record the durable outcome in `progress.md` first and then update this ledger
-   `tasks.md` should remain the operational checklist, not a second full progress log
-   Do not reopen the 2026-04-13+ QA remediation waves unless fresh failing evidence appears

## Active: Workspace Policy QA Remediation (2026-05-10)

-   [x] Make snapshot import fail closed for invalid `runtimePolicy.workspaceMode`
-   [x] Stabilize the non-workspace application Playwright regression after default catalog seed changes
-   [x] Run focused backend tests for metahub import and application sync
-   [x] Run Playwright proof for LMS required-workspace import/sync and generic non-workspace runtime sharing
-   [x] Record the completed remediation in `memory-bank/progress.md`
