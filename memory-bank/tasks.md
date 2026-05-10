# Tasks

> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## Current Task Ledger (Canonical)

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
-   [x] Add browser coverage for the `Схема регистра` authoring tab and persistence flow.
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
-   [x] Add browser E2E coverage for the RU Catalog `Поведение` authoring flow, including save/reopen persistence and screenshots.
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

## Completed: LMS QA Final Debt Closure (2026-05-08)

> Goal: close the last QA findings from the LMS Catalog/Ledger implementation without changing the generic Entity architecture or adding LMS-specific UI.
> Status: completed and recorded in progress.md.

-   [x] Return controlled Ledger API validation errors for direct append/projection/update payloads.
-   [x] Add focused backend regressions for invalid Ledger fact and projection values.
-   [x] Remove newly identified TypeScript suppression and stale task-comment debt from touched template/UI surfaces.
-   [x] Run targeted backend/frontend tests and lint checks.
-   [x] Update progress notes after validation.

## Completed: LMS QA Debt Closure (2026-05-08)

> Goal: close the remaining QA findings from the LMS Catalog/Ledger implementation without changing the established Entity architecture or adding LMS-only UI.
> Status: completed and recorded in progress.md.

-   [x] Add neutral public guest API payload/session aliases while preserving existing LMS-shaped payload compatibility.
-   [x] Bound public guest assessment answer payloads at the Zod boundary.
-   [x] Return controlled Ledger projection API errors instead of uncaught generic errors.
-   [x] Make `manualEditable` Ledger mutation policy observable and enforced through focused update/delete fact endpoints.
-   [x] Add focused regression tests and run targeted lint/build/E2E validation.
-   [x] Update progress notes after validation.

## Completed: LMS QA Final Remediation (2026-05-08)

> Goal: close the remaining QA findings after the LMS Catalog/Ledger implementation and keep the final runtime path generic, secure, and testable.
> Status: completed and recorded in progress.md.

-   [x] Accept a neutral public guest runtime configuration contract while keeping legacy LMS-shaped snapshots readable.
-   [x] Remove the Ledger information-schema compatibility probe now that tests can model real column rows.
-   [x] Add browser-flow security assertions for registrar-only Ledger writes and public guest edge cases.
-   [x] Reduce test warning noise in the newly touched metahub settings tab tests.
-   [x] Run focused backend/frontend/Playwright validation, docs checks, build, and update progress notes.

## Completed: LMS QA Blocker Closure (2026-05-08)

> Goal: close the QA blockers found after the LMS Catalog/Ledger implementation and re-prove the browser import/runtime path.
> Status: completed and recorded in progress.md.

-   [x] Preserve server-managed public runtime application settings when generic settings are saved.
-   [x] Store public guest session secrets as hashes instead of raw bearer secrets.
-   [x] Make the LMS snapshot import Playwright flow robust against CSRF retry races and visible import loading states.
-   [x] Add focused regression tests for the settings and guest-session contracts.
-   [x] Run targeted backend/frontend/Playwright validation and update progress notes.

## Completed: LMS QA Follow-up Hardening (2026-05-08)

> Goal: close the remaining non-blocking QA findings from the LMS Catalog/Ledger implementation.
> Status: completed and recorded in progress.md.

-   [x] Move public guest runtime bindings from LMS-shaped backend defaults to explicit application settings seeded from the LMS metahub.
-   [x] Add system-level Ledger reversal idempotency that does not require a string business idempotency field.
-   [x] Add Playwright browser console/pageerror/API-response failure checks to the LMS snapshot flow.
-   [x] Reset section-scoped runtime sort/filter state when switching published application sections.
-   [x] Reduce newly touched lint/type issues and run focused validation.
-   [x] Update progress notes after validation.

## Completed: LMS QA Remediation Hardening (2026-05-08)

> Goal: close the remaining QA findings from the LMS Catalog/Ledger implementation without adding LMS-specific UI or unsafe runtime shortcuts.
> Status: completed and recorded in progress.md.

-   [x] Add database-level Ledger idempotency protection for generated runtime schemas.
-   [x] Make posting movement reversal fail closed when stored movement metadata is malformed or incomplete.
-   [x] Extend browser E2E coverage so LMS posting and unposting are executed through the runtime row action UI.
-   [x] Add visual/geometry assertions for the LMS runtime dashboard and workspace template surfaces.
-   [x] Reconcile the implementation plan checklist with the QA-remediated state.
-   [x] Run focused backend, schema, frontend, docs, and Playwright validation.

## Completed: LMS QA Remediation Completion (2026-05-08)

> Goal: remove the remaining QA blockers around Ledger policies, posting reversals, LMS runtime hardcoding, browser proof, and plan traceability.
> Status: completed and recorded in progress.md.

-   [x] Enforce Ledger mutation/source policies for direct API calls and script contexts.
-   [x] Add generic posting reversal metadata so unpost and void can compensate prior ledger movements instead of leaving stale facts.
-   [x] Replace hardcoded LMS guest runtime bindings with generic access-flow configuration where feasible without adding LMS-specific UI.
-   [x] Add focused backend tests for policy enforcement, post/unpost/void ledger compensation, and idempotent fact behavior.
-   [x] Extend browser/runtime proof for record command and ledger compensation paths.
-   [x] Close EN/RU GitBook guide coverage for transactional Catalogs and Ledgers.
-   [x] Update plan/progress documentation with completed evidence and remaining constraints.

## Completed: LMS Phase 10 Validation Closure (2026-05-08)

> Goal: close the broad validation debt found during the LMS Catalog/Ledger implementation QA pass.
> Status: completed and recorded in progress.md.

-   [x] Run full package tests for `@universo/schema-ddl`, `@universo/applications-backend`, `@universo/metahubs-backend`, `@universo/metahubs-frontend`, and `@universo/apps-template-mui`.
-   [x] Fix stale release-bundle, metahub import, LMS template seed, and settings-route test contracts introduced by the Ledger and richer LMS model.
-   [x] Confirm docs i18n alignment, root build, generator Playwright flow, LMS import/runtime Playwright flow, and direct LMS fixture contract.
-   [x] Preserve existing generic UI and route contracts: Ledgers continue through shared Entity list/detail surfaces and LMS widgets use generic datasource configs.

## Completed: LMS Fixture Generator And Import Proof (2026-05-08)

> Goal: close the Phase 8 and Phase 9 LMS product-fixture gaps with a regenerated canonical snapshot and browser proof.
> Status: completed and recorded in progress.md.

-   [x] Enforce equal EN/RU breadth for LMS demo quiz questions, answers, and module content in the fixture contract.
-   [x] Align script attachment validation with the exported snapshot contract.
-   [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator.
-   [x] Prove the regenerated fixture through the browser import/runtime flow, including public guest rows and ledger facts.
-   [x] Update the implementation plan and progress notes.

## Completed: LMS Generic Widget Datasources (2026-05-08)

> Goal: close the Phase 8 generic widget configuration gap by wiring LMS dashboard widgets through existing generic widget keys and runtime datasource contracts.
> Status: completed and recorded in progress.md.

### Phase 1: Generic Datasource Contract

-   [x] Add codename-based datasource target fields for template-authored widget configs.
-   [x] Resolve datasource codenames to runtime section ids in published app widgets.
-   [x] Add focused runtime widget tests for codename datasource targets.

### Phase 2: LMS Template Widgets

-   [x] Configure LMS `overviewCards`, chart widgets, and report/table widgets using existing generic widget keys.
-   [x] Extend template and fixture-contract checks for generic widget datasource config.
-   [x] Update the implementation plan and progress notes.

### Phase 3: Validation

-   [x] Run focused types, apps-template, metahubs validation and whitespace checks.

## Completed: LMS Placeholder Configuration Cleanup (2026-05-08)

> Goal: remove placeholder external support-domain data from the LMS template while preserving the generic configuration Set.
> Status: completed and recorded in progress.md.

-   [x] Replace the default support email placeholder with an empty configurable value.
-   [x] Add a template regression check for the non-placeholder default.
-   [x] Update the implementation plan and progress notes.
-   [x] Run focused metahubs validation and whitespace checks.

## Completed: LMS Lifecycle Script Seeds (2026-05-08)

> Goal: close the Phase 8 script gap by seeding generic lifecycle/posting scripts for LMS workflows through the existing extension SDK contract.
> Status: completed and recorded in progress.md.

### Phase 1: Template Model

-   [x] Add auto-enrollment, quiz attempt posting, module completion posting, and certificate issue posting scripts.
-   [x] Attach scripts to standard Catalog entities and keep declared capabilities minimal.
-   [x] Mark `ModuleProgress` transactional so module completion posting uses the same generic record behavior path.

### Phase 2: Validation And Memory

-   [x] Extend template and fixture-contract checks for required LMS scripts.
-   [x] Update the implementation plan and progress notes.
-   [x] Run focused metahubs validation and whitespace checks.

## Completed: LMS Bilingual Page Entities (2026-05-08)

> Goal: close the Phase 8 page-content gap by adding reusable bilingual Page entities to the LMS template without custom UI or LMS-only runtime behavior.
> Status: completed and recorded in progress.md.

### Phase 1: Template Model

-   [x] Add reusable LMS page helpers for localized Editor.js content.
-   [x] Add `CourseOverview`, `KnowledgeArticle`, `AssignmentInstructions`, and `CertificatePolicy` Page entities.

### Phase 2: Validation And Memory

-   [x] Extend template and fixture-contract checks for the new Page entities.
-   [x] Update the implementation plan and progress notes.
-   [x] Run focused metahubs validation and whitespace checks.

## Completed: LMS Transactional Event Catalogs (2026-05-08)

> Goal: close the Phase 8 product-model gap by adding separate document-like LMS event catalogs as complements to the current catalogs, using only generic Catalog record behavior and Ledger posting metadata.
> Status: completed and recorded in progress.md.

### Phase 1: Template Model

-   [x] Add `QuizAttempts`, `AssignmentSubmissions`, `TrainingAttendance`, and `CertificateIssues` to the LMS template.
-   [x] Mark the new event catalogs as transactional and connect them to generic target Ledgers.

### Phase 2: Validation And Memory

-   [x] Extend template and fixture-contract checks so the richer LMS snapshot cannot regress.
-   [x] Update the implementation plan and progress notes.
-   [x] Run focused metahubs validation and whitespace checks.

## Completed: LMS Transactional Catalog Behavior (2026-05-08)

> Goal: advance Phase 8 by marking document-like LMS catalogs as transactional with generic record behavior metadata.
> Status: completed and recorded in progress.md.

### Phase 1: Template Model

-   [x] Add reusable transactional catalog config helper to the LMS template.
-   [x] Mark `QuizResponses`, `Assignments`, `TrainingEvents`, `Certificates`, and `Enrollments` as transactional catalogs.
-   [x] Keep posting declarations generic and Ledger-target based.

### Phase 2: Validation

-   [x] Extend template and fixture-contract checks for transactional record behavior.
-   [x] Run focused metahubs template tests, build, and lint.

## Completed: LMS Additional Ledger Definitions (2026-05-08)

> Goal: advance Phase 8 by adding the missing generic Ledger entities required by the richer LMS product model.
> Status: completed and recorded in progress.md.

### Phase 1: Template Model

-   [x] Add generic additional LMS Ledger entities through a reusable template helper.
-   [x] Keep Ledger configs append-only, idempotent, and projection-ready.
-   [x] Extend template and fixture-contract checks for the additional Ledger codenames.

### Phase 2: Validation

-   [x] Run focused metahubs template tests, build, and lint.

## Completed: LMS Generic Runtime Policy Settings (2026-05-08)

> Goal: close Phase 7 application settings gaps with generic runtime policy fields, strict backend validation, frontend defaults, EN/RU i18n, and focused tests.
> Status: completed and recorded in progress.md.

### Phase 1: Shared Settings Contract

-   [x] Add generic runtime dashboard, datasource, and workspace policy fields to `ApplicationDialogSettings`.
-   [x] Add matching frontend defaults and strict backend Zod validation.

### Phase 2: Settings UI

-   [x] Add a generic runtime behavior section to `ApplicationSettings.tsx` using existing MUI settings rows.
-   [x] Add EN/RU i18n keys without LMS-specific wording.

### Phase 3: Tests And Validation

-   [x] Add focused frontend settings tests for saving the new policy fields.
-   [x] Run affected frontend/backend tests, build, lint, and whitespace validation.

## Completed: LMS Overview Cards Metric Authoring (2026-05-08)

> Goal: close the remaining Phase 7 widget authoring gap for `overviewCards` without adding a new LMS-specific interface or replacing the existing shared behavior editor pattern.
> Status: completed and recorded in progress.md.

### Phase 1: Existing Editor Extension

-   [x] Add compact multi-card metric controls to `ApplicationWidgetBehaviorEditorDialog`.
-   [x] Normalize saved overview card configs to the implemented `records.count` metric contract only.
-   [x] Add EN/RU i18n keys for the generic overview-card datasource controls.

### Phase 2: Tests And Validation

-   [x] Add focused frontend tests for multi-card metric authoring.
-   [x] Run affected package tests, build, lint, and whitespace validation.

## Completed: LMS Chart Datasource QA Remediation (2026-05-08)

> Goal: close the QA gap where chart widget contracts were typed but still rendered only static demo data, while preserving existing dashboard components and avoiding LMS-specific widgets.
> Status: completed and recorded in progress.md.

### Phase 1: Runtime Chart Consumption

-   [x] Reuse existing MUI chart cards and pass optional runtime props instead of creating new LMS chart components.
-   [x] Resolve `records.list` datasource rows through the existing runtime list API.
-   [x] Map configured `xField` and numeric series fields into chart props with safe numeric coercion.

### Phase 2: Contract And Tests

-   [x] Add shared type tests for chart datasource schema acceptance and unsupported datasource rejection.
-   [x] Add runtime tests proving chart rows are fetched and passed into the existing chart components.
-   [x] Add shared behavior editor tests for chart datasource authoring through `EntityFormDialog`.
-   [x] Run affected package test/build/lint checks and whitespace validation.

## Completed: LMS Generic Metric Widgets (2026-05-08)

> Goal: continue Phase 7 by letting existing dashboard card/stat surfaces consume generic metric datasources without adding LMS-specific widgets or a new dashboard style.
> Status: completed and recorded in progress.md.

### Phase 1: Shared Widget Contract

-   [x] Add typed config for metric-backed stat/overview cards in `@universo/types`.
-   [x] Keep the config generic enough for non-LMS apps and compatible with existing `metric` datasource descriptors.

### Phase 2: Runtime Consumption

-   [x] Render metric-backed stat cards through existing MUI `StatCard`/overview layout primitives.
-   [x] Resolve safe `records.count` metrics through the existing runtime records API instead of creating an LMS endpoint.

### Phase 3: Tests And Validation

-   [x] Add focused runtime tests for metric-backed card rendering.
-   [x] Run affected package test/build/lint checks and whitespace validation.

## Completed: LMS Details Table Datasource Authoring (2026-05-08)

> Goal: continue Phase 7 by letting application admins configure generic `detailsTable` datasources through the existing ApplicationLayouts widget editor and rendering `records.list` datasources in the published app without LMS-specific widgets.
> Status: completed and recorded in progress.md.

### Phase 1: Existing Editor Extension

-   [x] Extend `ApplicationWidgetBehaviorEditorDialog` for `detailsTable` datasource settings.
-   [x] Keep the editor based on `EntityFormDialog` and shared MUI controls, without adding a new standalone UI surface.

### Phase 2: Runtime Consumption

-   [x] Render `detailsTable` with a `records.list` datasource through the existing `CustomizedDataGrid`.
-   [x] Preserve current active-section behavior when no datasource descriptor is configured.

### Phase 3: Tests And Validation

-   [x] Add focused frontend tests for datasource editing and runtime rendering.
-   [x] Run affected package test/build/lint checks and whitespace validation.

## Completed: LMS Generic Runtime Datasource Tables (2026-05-08)

> Goal: continue Phase 7 by adding generic datasource descriptors and wiring server-side search/sort/filter through the existing detailsTable runtime path without new LMS-specific widgets.
> Status: completed and recorded in progress.md.

### Phase 1: Shared Contract

-   [x] Add generic runtime datasource descriptor schemas in `@universo/types`.
-   [x] Extend the existing `detailsTable` widget config schema with an optional datasource descriptor.

### Phase 2: Runtime Rows API

-   [x] Extend the authenticated runtime list endpoint with validated server-side search, sort, and filter query models.
-   [x] Keep SQL schema-qualified, parameterized, and restricted to declared runtime attributes.

### Phase 3: Existing MUI Runtime Table

-   [x] Extend `CrudDataAdapter.fetchList(...)` and `fetchAppData(...)` with generic list query params.
-   [x] Wire `CustomizedDataGrid` and `detailsTable` to server-side sort/filter/search using existing components.

### Phase 4: Validation

-   [x] Add focused backend and frontend tests for the new generic table query path.
-   [x] Run affected package lint/build/test checks and whitespace validation.

## Completed: LMS Posting Movement E2E Proof (2026-05-08)

> Goal: finish Phase 6 by proving that a metahub-authored LMS posting script can post an enrollment record and create generic Ledger facts in the published application runtime.
> Status: completed and recorded in progress.md.

### Phase 1: Fixture Contract

-   [x] Add an LMS template posting lifecycle script without introducing LMS-specific runtime code.
-   [x] Declare the Enrollment catalog target Ledger through generic record behavior metadata.
-   [x] Extend the LMS fixture contract so the snapshot must contain the posting script and target Ledger declaration.

### Phase 2: Runtime Flow

-   [x] Add reusable E2E runtime API helpers for record posting and Ledger fact lookup.
-   [x] Extend the existing LMS import flow with a posting proof after schema sync.
-   [x] Keep the proof API-level and generic, reusing the existing browser import/sync flow and published app runtime setup.

### Phase 3: Validation

-   [x] Regenerate or normalize the LMS fixture snapshot from the updated template.
-   [x] Run focused contract, Playwright, lint, and build checks that cover the changed files.

## Active: LMS Posting Movement Contract (2026-05-08)

> Goal: continue Phase 6 by adding a safe declarative posting movement contract for lifecycle scripts and applying movements through generic Ledger runtime services in the active transaction.

### Phase 1: Contract And Runtime Application

-   [x] Add shared posting movement return types for lifecycle scripts.
-   [x] Add backend movement validation that accepts only declared target ledgers and structured fact data.
-   [x] Apply valid movements through runtime Ledger append inside the posting transaction.
-   [x] Keep beforePost fail-closed and afterPost after transaction commit.

### Phase 2: Tests And Validation

-   [x] Add focused unit tests for valid movements, undeclared ledgers, invalid payloads, and invalid Ledger fields.
-   [x] Add route tests proving movement failures abort record posting and afterPost does not run before commit.
-   [x] Run focused backend tests, affected package lint/build, and whitespace validation.

## Active: LMS Ledger Runtime Services (2026-05-08)

> Goal: close Phase 5 runtime Ledger services with generic append-only facts, safe projections, idempotent append, reversals, script SDK access, and permission tests.

### Phase 1: Runtime Service And Routes

-   [x] Create `RuntimeLedgerService` with metadata, fact listing, projection query, append, and reversal operations.
-   [x] Add HTTP routes for ledger metadata, facts, projection queries, append, and reverse.
-   [x] Keep Ledger runtime APIs separate from generic row CRUD sections.

### Phase 2: Safety Contracts

-   [x] Restrict projection filters, dimensions, and resources to declared metadata fields.
-   [x] Keep all projection and fact queries parameterized and schema-qualified.
-   [x] Add idempotency checks scoped to the active workspace when workspace columns exist.
-   [x] Implement reversal as append-only compensating facts instead of updates to existing facts.

### Phase 3: Script SDK And Validation

-   [x] Expose `ctx.ledger.reverse()` behind `ledger.write`.
-   [x] Add `ledger.reverse()` to design-time and client-side fail-closed script contexts.
-   [x] Add focused tests for append-only behavior, idempotency, reversal, workspace isolation, aggregation, invalid fields, and permission failures.
-   [x] Run focused backend tests, backend lint/build, extension SDK lint/build, metahubs/apps-template package validation, and whitespace validation.

## Active: LMS Runtime Record Command Backend Hardening (2026-05-08)

> Goal: close the remaining Phase 4 backend QA coverage for transactional Catalog record commands without changing public UI contracts or adding LMS-specific runtime behavior.

### Phase 1: Numbering And State Transition Tests

-   [x] Add focused tests for concurrent record number allocation.
-   [x] Add focused tests for global and workspace-scoped numbering keys.
-   [x] Add focused tests for invalid post/unpost/void transitions.

### Phase 2: Immutability And Permission Tests

-   [x] Add focused tests for posted-row immutability on update/delete and tabular edits.
-   [x] Add focused tests for edit permission failures on record commands.

### Phase 3: Validation

-   [x] Run focused backend record behavior/controller tests.
-   [x] Run backend build and whitespace validation.

## Active: LMS Runtime Record Commands UI (2026-05-08)

> Goal: continue the LMS platform plan by exposing generic record lifecycle commands in the published application runtime with existing apps-template MUI components, shared metadata, and focused tests.

### Phase 1: Runtime Metadata Contract

-   [x] Expose record behavior and record system state in runtime list responses.
-   [x] Keep the response generic for all record-enabled Catalog-like entities, with no LMS-specific fields.

### Phase 2: Published App UI

-   [x] Add reusable runtime record state chip/action helpers in `@universo/apps-template-mui`.
-   [x] Render post/unpost/void row actions through the existing details table/action column pattern.
-   [x] Invalidate runtime queries after successful commands and surface API errors through the existing snackbar path.

### Phase 3: Validation

-   [x] Add focused frontend tests for command visibility, disabled states, and mutation calls.
-   [x] Run focused apps-template tests/build and whitespace validation.

## Active: LMS Catalog And Ledger Platform Expansion (2026-05-07)

> Goal: implement the QA-reviewed LMS platform plan by extending Catalog behavior, adding the standard Ledger entity kind, keeping shared Entity UI reuse, and preparing the runtime/snapshot/testing path without LMS-specific runtime forks.

### Phase 1: Shared Type And Standard Kind Foundation

-   [x] Add shared Catalog record behavior and Ledger contracts in `@universo/types`.
-   [x] Extend the Entity component manifest and dependency validation for identity, lifecycle, posting, and ledger capabilities.
-   [x] Add `ledger` to built-in entity kinds, entity settings/surfaces, menu kinds, script attachment kinds, and schema DDL built-in helpers.
-   [x] Update standard kind tests and shared type tests.

### Phase 2: Standard Presets And Metahub Authoring Routing

-   [x] Add the standard Ledger type definition and preset metadata.
-   [x] Extend the standard Catalog preset with default record behavior config.
-   [x] Route Ledgers through the shared generic Entity instance UI and update standard route tests.
-   [x] Add EN/RU i18n labels for Ledgers and shared dialog titles.

### Phase 3: Snapshot And LMS Fixture Contract

-   [x] Ensure record behavior and ledger config round-trip through template, publication, snapshot, and restore paths.
-   [x] Extend the LMS template with Ledger objects and transactional Catalog behavior.
-   [x] Expand the LMS fixture contract assertions.
-   [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` through the official Playwright generator.

### Phase 4: Runtime Commands, Ledgers, Widgets, And Docs

-   [x] Add runtime numbering/posting service contracts and fail-closed validation.
-   [x] Add runtime ledger metadata/query service contracts and generic datasource plumbing.
-   [x] Keep widgets generic and avoid LMS-specific runtime widgets or Ledger-specific authoring pages.
-   [x] Update package READMEs and GitBook docs.

### Validation

-   [x] Run focused type/unit tests for affected packages.
-   [x] Run focused frontend route tests.
-   [x] Run full `pnpm run build:e2e`.
-   [x] Run LMS Playwright snapshot generator.
-   [x] Run runtime Ledger service and script bridge tests.
-   [x] Run runtime record behavior numbering/immutability tests.
-   [x] Run schema DDL system-table and generator tests.
-   [x] Run `git diff --check`.

## Completed: start:allclean Command Implementation (2026-05-07)

> All phases implemented and verified. The `start:allclean` command performs a complete platform reset with database cleanup via `--reset-db` CLI flag.

**Implementation summary:**

-   Added `force` parameter to `executeStartupFullReset()` for bypassing env var check
-   Added `--reset-db` CLI flag to `start.ts` command
-   Added `start:allclean` script to root `package.json`
-   Added `NODE_ENV=development` to `.env` and `.env.example`
-   Updated documentation (EN/RU)
-   All 21 unit tests pass
-   Full build passes (30 packages)

---

## Completed: Startup Supabase Full Reset (2026-05-07)

> All phases implemented and QA-verified. See progress.md for details.

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
-   [x] Step 2.4: Install Node.js 22 locally via nvm ✅ DONE by user
-   [x] Step 2.5: Upgrade isolated-vm from 5.0.4 to 6.1.2
-   [x] Step 2.6: Clean install with new Node.js version ✅ DONE by user

### Phase 3: Build and Test Validation

-   [x] Step 3.1: Run full build (pnpm build) ✅ PASSED (3m1s)
-   [x] Step 3.2: Run linting (pnpm lint) ✅ PASSED (scripting-engine fixed)
-   [x] Step 3.3: Run unit tests (pnpm test:vitest) ✅ PASSED (911 tests, 173s)
-   [ ] Step 3.4: Run E2E smoke tests (pnpm test:e2e:smoke)
-   [ ] Step 3.5: Run Playwright flow tests (pnpm test:e2e:flows)
-   [x] Step 3.6: Verify scripting engine runtime (pnpm benchmark) ✅ PASSED (mean: 1.47ms, p95: 2.16ms)

### Validation Summary (2026-05-07)

**Completed validations:**

-   ✅ Build: All 30 packages built successfully
-   ✅ Lint: Fixed prettier formatting in scripting-engine, all lint checks pass
-   ✅ Unit tests: 911 tests passed across 161 test files
-   ✅ Scripting engine: isolated-vm 6.x works correctly with Node.js 22
-   ✅ autoskills: Tool runs successfully, detected 8 technologies, 14 skills available

**Code changes made:**

-   Fixed prettier formatting in `packages/scripting-engine/base/src/runtime.ts`
-   Fixed prettier formatting in `packages/scripting-engine/base/src/compiler.ts`
-   Fixed prettier formatting in `packages/scripting-engine/base/src/index.ts`
-   Fixed prettier formatting in `packages/scripting-engine/base/src/runtime.test.ts`
-   Fixed no-useless-escape error in `runtime.ts` (line 438)

**Remaining:**

-   E2E tests (require running server, user should run manually)
-   CI/CD verification (push to test branch)

### Phase 4: CI/CD Pipeline Update

-   [x] Step 4.1: Update GitHub Actions workflow to Node.js 22.x
-   [x] Step 4.2: Update pnpm version in CI if needed (no change required)
-   [ ] Step 4.3: Verify CI build passes (USER ACTION: push to test branch)

### Phase 5: Production Deployment Preparation

-   [x] Step 5.1: Update deployment documentation (migration guide created)
-   [ ] Step 5.2: Create deployment checklist (environment-specific)
-   [ ] Step 5.3: Staging environment test (environment-specific)

### Phase 6: Documentation and Knowledge Transfer

-   [x] Step 6.1: Update tech.md steering file with Node.js 22 requirements
-   [x] Step 6.2: Update README.md prerequisites section
-   [x] Step 6.3: Update memory-bank/techContext.md
-   [x] Step 6.4: Create migration guide for developers

---

## Completed: QA Follow-Up For Generic Hub-Assignable Entities (2026-05-06)

> Goal: close QA blockers found after the generic hub-assignable Entity implementation.

### Final Action Plan

-   [x] Fix backend route tests for generic hub blockers after the `treeAssignment` query-order change.
-   [x] Verify the LMS snapshot fixture hash and hub-assignment metadata.
-   [x] Run focused backend/frontend/runtime tests plus package lint/build validation.
-   [x] Record the completed QA follow-up in `progress.md`.

### Validation Notes

-   The backend route tests now match the generic `treeAssignment` query order, where related-object checks are skipped when no hub-assignable non-hub kinds exist.
-   Added a regression proving hub deletion is blocked when a required hub-assignable Page would become orphaned.
-   The LMS fixture hash is valid and its Page, Catalog, Set, and Enumeration entity type definitions have enabled hub assignment with Hubs tabs.
-   Focused backend Jest, focused metahubs frontend Vitest, runtime/application focused tests, package lint/build checks, full root build, Chromium Basic Pages UX Playwright, and whitespace checks passed.
-   `@universo/metahubs-backend` lint still reports existing warnings only; no lint errors were introduced.

## Completed: Generic Hub-Assignable Entity Integration (2026-05-06)

> Goal: make hub detail tabs and hub deletion dependency checks use Entity constructor metadata instead of fixed Catalog/Set/Enumeration assumptions.

### Final Action Plan

-   [x] Build hub detail tabs from all Entity types with enabled tree assignment, including Pages.
-   [x] Route hub-scoped non-hub tabs to the generic Entity instance list so custom hub-assignable types use the same UI.
-   [x] Generalize backend hub dependency detection and detach logic to all hub-assignable Entity types.
-   [x] Update delete-blocker UI/API typing so blockers can show arbitrary Entity type labels, not only Catalogs/Sets/Enumerations.
-   [x] Add focused unit tests for Page tab visibility and generic hub blockers, then run affected validation.

### Validation Notes

-   Hub detail tabs are now derived from editable Entity types with enabled `treeAssignment`, so Pages and any future hub-assignable Entity type appear without hardcoded tab lists.
-   Hub-scoped non-hub routes use the generic Entity instance surface and filter by `config.hubs`; the old generic fallback to persisted `config.treeEntities` was removed because the database will be recreated.
-   Hub delete blockers now return generic `blockingRelatedObjects` and `blockingChildTreeEntities`, with each blocker carrying its Entity kind and display type label.
-   Set and Enumeration base definitions now enable hub assignment and expose the Hubs tab, matching the new constructor-driven rule.
-   The LMS snapshot fixture was updated so its Set and Enumeration Entity type definitions use the new hub-assignment contract, and its `snapshotHash` was recalculated.
-   Focused backend Jest, focused frontend Vitest, frontend/backend lint, frontend/backend builds, and full root `pnpm build` passed. Backend lint still reports pre-existing warnings only.

## Completed: Runtime Start Section Stale Placeholder Suppression (2026-05-06)

> Goal: prevent the published application runtime root from briefly rendering a non-start section such as Access Links before the menu-defined start page loads.

### Final Action Plan

-   [x] Trace the runtime root load path across `ApplicationRuntime`, `useCrudDashboard`, React Query placeholder data, and backend menu start-section resolution.
-   [x] Suppress mismatched placeholder/fallback section data while the menu-defined start section is being selected or fetched.
-   [x] Keep the fix generic for all runtime sections and pages instead of special-casing the LMS fixture or Access Links.
-   [x] Extend hook-level regression coverage for the exact stale-section transition.
-   [x] Extend the LMS import/runtime browser flow to assert that Access Links is not shown on initial runtime root load.
-   [x] Run focused tests, package build, full root build, Chromium LMS browser flow, and whitespace checks.

### Validation Notes

-   Root cause: the runtime hook could render the first backend/fallback section response while React Query was already fetching the menu-defined start section through `placeholderData`.
-   The hook now returns a loading state and empty display data when the current response section does not match the initial menu start section or the selected section under fetch.
-   The LMS Playwright flow also needed to wait for the successful sync retry response because the browser can legitimately receive an initial CSRF `419` before the final `200`.
-   Focused `useCrudDashboard` Vitest, `@universo/apps-template-mui` lint/build, full root `pnpm build`, Chromium LMS import/runtime Playwright, and `git diff --check` passed.

## Completed: Application Sync RLS Transaction Boundary Closure (2026-05-06)

> Goal: fix the connector-board schema sync 500 observed after importing the LMS snapshot and creating an application schema with workspaces enabled.

### Final Action Plan

-   [x] Identify why `/api/v1/application/:id/sync` could fail during heavy schema DDL while regular application routes stayed healthy.
-   [x] Keep regular application routes behind the request RLS middleware, but mount the schema sync route with plain authenticated access because sync manages its own DDL transactions and advisory lock.
-   [x] Preserve authorization through the existing application access checks inside the sync route/controller.
-   [x] Add route-composition regression coverage proving sync receives plain auth while the rest of the application service still receives RLS auth.
-   [x] Convert the LMS import/runtime Playwright flow from direct sync API usage to the real Connector Board diff dialog and sync button flow.
-   [x] Run focused backend tests, package lint/build checks, Chromium LMS browser flow, full root build, and whitespace checks.

### Validation Notes

-   Root cause: schema sync was wrapped by the request-scoped RLS transaction middleware even though the sync engine performs long-running DDL with its own explicit transaction and advisory lock boundaries.
-   The observed failure matched the request RLS transaction dying at final `COMMIT` after the DDL sync completed.
-   The LMS browser flow now validates the exact UI path that failed for the user: linked application creation, Connector Board diff, workspace enablement confirmation, schema sync, runtime checks, and public guest runtime checks.
-   `pnpm --filter @universo/applications-backend build`, `pnpm --filter @universo/applications-backend lint`, `pnpm --filter @universo/core-backend build`, `pnpm --filter @universo/core-backend lint`, focused core-backend Jest, Chromium LMS import/runtime Playwright, root `pnpm build`, and `git diff --check` passed.

## Completed: Generic Localized Variant Tabs For Page Content (2026-05-06)

> Goal: align Page content language tabs with the standard metahub tab surface, mark the primary content locale with the same star affordance used by display attributes, and keep the tab/add controls generic for future Entity components.

### Final Action Plan

-   [x] Extract Page content language tabs into a reusable `LocalizedVariantTabs` component in `@universo/template-mui`.
-   [x] Match the Page content tab typography and compact action/add button geometry to the standard MUI tab customization used by other metahub Entity screens.
-   [x] Render the primary content locale with the same `Star` icon affordance used by display attributes.
-   [x] Keep Page content as a consumer of generic variant-tab props instead of hardcoding the tab UI directly inside the Page route.
-   [x] Add focused unit coverage and extend the Chromium Pages UX flow for primary marker, action/add alignment, and tab typography parity with Catalog tabs.

### Validation Notes

-   The Page route now passes locale variants, active locale, primary locale, and menu handlers into a generic shared component.
-   The LMS snapshot was not regenerated in this closure because no template seed data changed.
-   Focused template-mui Jest, block editor Jest, template-mui lint/build, metahubs-frontend lint/build, full root `pnpm build`, Chromium Basic Pages UX Playwright, and `git diff --check` passed.

## Completed: LMS Page Content Import And Editor.js UX Closure (2026-05-05)

> Goal: make the imported LMS Page content immediately visible, ensure the visible Welcome page contains the full LMS onboarding copy, and keep the Editor.js block toolbox inside the visible page area.

### Final Action Plan

-   [x] Remove the short preset Welcome Page from the LMS product template while keeping the Page entity type available through the LMS seed.
-   [x] Rename the LMS `LearnerHome` page presentation to the visible Welcome labels and regenerate `tools/fixtures/metahubs-lms-app-snapshot.json`.
-   [x] Fix Editor.js initialization so late-loaded entity content is rendered on first open without requiring a language-tab switch.
-   [x] Constrain Editor.js toolbox/menu height so the block picker remains visible and scrollable within the viewport.
-   [x] Extend focused unit/Playwright fixture checks and run affected validation.

### Validation Notes

-   The LMS product template now keeps `LearnerHome` as the stable internal page codename while showing localized Welcome labels through presentation data.
-   `localizeCodenameFromName` was added as a general template seed option so visible localized names can change without breaking codename-based layout/menu references.
-   The canonical LMS snapshot was regenerated through the official Playwright generator and now contains one Welcome page with full EN/RU onboarding block content.
-   Editor.js content now renders after late-loaded page data on first open, and the block toolbox geometry is checked in the Chromium Basic Pages UX flow.
-   Focused backend/template tests, block editor tests, fixture generator, Chromium Basic Pages UX Playwright, Chromium LMS import/runtime Playwright, full root `pnpm build`, and `git diff --check` passed.

## Completed: LMS Runtime Welcome Assertion Closure (2026-05-05)

> Goal: close the QA blocker where the LMS import/runtime Playwright flow still asserted the old short Welcome page paragraph after the canonical LMS fixture was expanded.

### Final Action Plan

-   [x] Move the canonical LMS Welcome page runtime assertions onto shared fixture contract text constants.
-   [x] Update the LMS import/runtime Playwright flow to assert the expanded EN/RU Welcome content.
-   [x] Re-run the LMS import/runtime Chromium flow and final whitespace/build checks.
-   [x] Update Memory Bank with the completed closure.

### Validation Notes

-   The LMS import/runtime flow now reads Welcome page assertions from the same fixture contract that validates `tools/fixtures/metahubs-lms-app-snapshot.json`.
-   The expanded EN/RU Welcome page text is asserted in the browser runtime after linked application creation.
-   The flow timeout was raised to match the current full-reset cost: migrations, import, publication, linked app creation, application sync, runtime checks, and public guest progress recording now complete in one verified run.
-   Chromium LMS import/runtime Playwright, full root `pnpm build`, and `git diff --check` passed.

## Completed: Page Shared Action Icons And LMS Welcome Content Closure (2026-05-05)

> Goal: remove the last Page-specific action menu/icon drift, fix Page content editor control alignment, prioritize the primary content locale, and regenerate the LMS snapshot with fuller localized Welcome page content.

### Final Action Plan

-   [x] Centralize standard entity action icons in `@universo/template-mui` and reuse them from both generic Page/Entity lists and Catalog preset actions.
-   [x] Keep Page three-dot menus on the same shared `BaseEntityMenu` surface and the same icon glyphs as Catalog menus.
-   [x] Adjust Editor.js toolbar geometry so the add/tune controls stay inside the editor card while remaining left of block text.
-   [x] Align Page content language tab typography and compact tab action/add buttons with the shared metahub tab surfaces.
-   [x] Open Page content on the primary stored content locale when variants already exist; keep the UI-locale default only for empty content.
-   [x] Expand the LMS Welcome/Learner Home page with full EN/RU Editor.js block content and regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator.
-   [x] Add/extend unit and Chromium Playwright coverage for menu icon parity, editor control bounds, language-button alignment, primary-locale ordering, and LMS fixture text depth.

### Validation Notes

-   Page menus previously used the shared menu container but supplied Page/generic Entity action descriptors with `Rounded` icons, while Catalogs supplied standard MUI CRUD icons. The new shared icon factories remove that divergence.
-   The Chromium Basic Pages UX flow now compares Page and Catalog menu SVG path signatures, checks Editor.js controls against block text and editor bounds, and verifies primary-locale ordering after save/reload.
-   The LMS snapshot was regenerated by the official Playwright generator and the fixture contract now asserts full EN/RU onboarding text, not only minimal placeholder blocks.
-   Focused Vitest suites, affected package lint/build checks, Chromium Basic Pages UX Playwright, LMS fixture generator, full root `pnpm build`, and `git diff --check` passed.

## Completed: Page Entity Menu Parity And Hubs Column Closure (2026-05-05)

> Goal: make Page card/table action menus match the standard Entity CRUD menu used by Catalogs and relabel the table tree-assignment column from generic containers to Hubs when the Entity template uses the `hubs` alias.

### Final Action Plan

-   [x] Remove the Page-specific `Open content` and `Edit properties` menu descriptors from the generic Page instance action menu.
-   [x] Keep Page content navigation on the existing card/row click path while leaving the three-dot menu for standard metadata actions.
-   [x] Order Page actions as standard `Edit`, `Copy`, and danger-group `Delete`, matching the Catalog action menu behavior.
-   [x] Label the table tree-assignment column as `Hubs` when the Entity type declares the `hubs` tab alias, and keep `Containers` only for generic custom Entity types.
-   [x] Add unit and Chromium Playwright coverage for the standard Page menu and `Hubs` table column.

### Validation Notes

-   The Page menu differed because `EntityInstanceListContent` had a block-content-specific `open-content` descriptor and a Page-only `editProperties` label.
-   The table column showed `Containers` because it reused the neutral `treeEntities` label even when the Page template exposed the generic tree assignment as `hubs`.
-   Focused Vitest, metahubs frontend lint/build, core frontend build, Chromium Basic Pages UX Playwright, full root `pnpm build`, and `git diff --check` passed.

## Completed: Page Hubs Picker VLC Codename Crash Closure (2026-05-05)

> Goal: fix the Page create dialog crash when opening the Hubs add picker after a clean rebuild/import and prevent object-valued VLC codenames from reaching React render output.

### Final Action Plan

-   [x] Resolve container codenames through VLC string extraction before rendering regular and parent container selection dialogs.
-   [x] Keep display-name fallbacks string-only by falling back from localized name to localized codename and then to the container id.
-   [x] Add focused component tests for container and parent-container pickers with VLC `codename` values.
-   [x] Extend the Chromium Basic Pages UX flow to open the Page create dialog, switch to the `Hubs` tab, press `Add`, and verify the picker renders instead of crashing.
-   [x] Run focused unit, lint, affected builds, browser flow, full root build, and whitespace checks.

### Validation Notes

-   The crash source was `TreeEntity.codename` being a VLC object passed as `ListItemText.secondary`, which produced React error #31 after the `Hubs` picker opened.
-   `ContainerSelectionPanel` and `ContainerParentSelectionPanel` now always pass strings to the generic `EntitySelectionPanel`.
-   Focused Vitest coverage, `@universo/metahubs-frontend` lint/build, `@universo/core-frontend` build, Chromium Basic Pages UX Playwright, full root `pnpm build`, and `git diff --check` passed.

## Completed: Page Content Visual And Generic Capability Closure (2026-05-05)

> Goal: close the remaining Page content visual regressions and restore generic Entity capability parity for Page containers and layouts.

### Final Action Plan

-   [x] Reduce Page content language icon buttons to the shared compact menu-button size and align the add-language button with tab action buttons.
-   [x] Reposition Editor.js block toolbar controls so add/tune buttons remain left of content without overlapping text, and add browser assertions for both buttons.
-   [x] Fix content-language menu close behavior so stale tab/add menu items never flash during click-away close, and add Playwright close-state coverage.
-   [x] Restore Page form tabs from Entity capability configuration by accepting the standard `hubs` tab alias and validating Page create/edit dialogs expose container/layout capability surfaces.
-   [x] Regenerate the LMS snapshot if template/capability metadata changes and run focused unit, lint, build, and Playwright checks.

### Validation Notes

-   Page content language action buttons and the add-language button now use the shared 28px compact icon-button surface and are center-aligned through the tab row layout.
-   The shared Editor.js wrapper positions add/tune controls to the left of the block content without text overlap; the browser flow now asserts the add and tune button bounding boxes against the edited block text.
-   Content-language menu close state now keeps tab/add menu contents stable through the close transition; the browser flow watches the DOM during click-away close and fails if stale menu items flash.
-   Page dialogs now derive `Hubs` and `Layouts` tabs from generic Entity capability metadata, including the standard `hubs` tab alias used by Page templates.
-   No LMS snapshot regeneration was required in this closure because Page template capability metadata already contained `hubs` and `layout` capabilities; the fix was the generic frontend interpretation of that metadata.
-   Focused unit tests, affected package lint/build checks, full root build, `git diff --check`, and the Chromium Basic Pages UX Playwright flow passed.

## Completed: Generic Page Entity UX Parity Closure (2026-05-05)

> Goal: remove remaining Page-specific UX drift by making generic entity routes render stable localized labels, loading states, dialog titles, and Page content editor spacing from Entity template metadata.

### Final Action Plan

-   [x] Add Entity-template presentation metadata for customizable create/edit/copy/delete dialog titles.
-   [x] Make generic entity list labels and breadcrumbs use stable localized built-in fallbacks before async entity type data arrives.
-   [x] Prevent generic entity empty states from flashing while the instance query is still loading.
-   [x] Align Page content language tabs, action buttons, add button, and Editor.js left spacing with the existing MUI template surfaces.
-   [x] Extend unit and Playwright coverage for no leaked `page/pages` fallback keys, no false empty-state flash, dialog titles, and editor spacing.
-   [x] Regenerate the LMS snapshot if template presentation metadata changes and run targeted lint/build/e2e validation.

### Validation Notes

-   Built-in Page labels now have stable localized fallbacks before asynchronous Entity type metadata resolves, covering both list headings and breadcrumbs.
-   Generic Entity instance lists keep showing skeletons while the initial instance query is loading, preventing the false empty-state flash on Pages.
-   Entity template presets now carry localized `presentation.dialogTitles` for create/edit/copy/delete actions, so Page dialogs can show inflected Russian labels such as `Create Page` / `Создать страницу` without Page-specific hardcoding.
-   Page content language tabs now use the same typography scale as the standard MUI tab surfaces, with compact sibling three-dot and add-language icon buttons.
-   The shared Editor.js wrapper keeps toolbar controls off the text while reducing the reserved left padding to match the vertical card padding more closely.
-   The LMS snapshot was regenerated through the official Playwright generator and includes the updated template presentation metadata.
-   Focused unit tests, affected package lint/build checks, full root build, `git diff --check`, and the Chromium Basic Pages UX Playwright flow passed.

## Completed: Localized Editor.js Page Content QA Closure (2026-05-05)

> Goal: close QA findings for Page content Editor.js positioning, i18n completeness, and locale-aware content editing without switching the full interface language.

### Final Action Plan

-   [x] Make the shared Editor.js adapter render and save the selected content locale while preserving other localized Page block values.
-   [x] Add an independent content language tab surface to the metahub Page content route using admin content locales.
-   [x] Complete the Russian Editor.js dictionary for the core popover, block tunes, and enabled tools.
-   [x] Constrain Editor.js popovers/toolbars so menus remain visible inside the content area instead of opening under the sidebar.
-   [x] Add focused unit and Playwright regression coverage for localized content preservation, editor menu i18n, and popover bounds.
-   [x] Run targeted lint/tests/builds and update Memory Bank progress/context.

### Validation Notes

-   `EditorJsBlockEditor` now accepts `contentLocale` separately from UI locale and merges saved Editor.js output into that locale without dropping other localized block text.
-   The Page content route exposes content language tabs independent of the global interface language, labels tabs from admin content locales, and defaults new content to the active UI locale.
-   Content locale actions now render as sibling controls beside accessible tab buttons, avoiding nested interactive elements inside tab labels.
-   Page block content now stores localized Editor.js text inside VLC locale sections in both template presets and the regenerated LMS snapshot.
-   The Russian Editor.js dictionary covers core popover labels, block tunes, tool names, and enabled tool labels used by Page content.
-   Editor.js toolbar/popover CSS keeps block menus within the content card instead of opening under the metahub sidebar.
-   The Chromium Basic Pages UX flow now covers add/change/remove/primary language variant actions with an admin-created third content locale.
-   Focused shared editor tests, affected package lints/builds, full root build, `git diff --check`, and Chromium Basic Pages UX Playwright passed.

## Completed: Page Block Content Constraint Closure (2026-05-04)

> Goal: close QA findings by enforcing Entity-specific Page block constraints consistently across API mutations, snapshot import, and tests.

### Final Action Plan

-   [x] Enforce Entity component `blockContent.allowedBlockTypes` and `maxBlocks` on backend create/update/copy flows and snapshot import.
-   [x] Add focused tests for component-specific block content constraints and clean up the Page block schema test readability issue.
-   [x] Re-run targeted backend, shared type, Editor.js, frontend, lint, and Playwright validation.
-   [x] Update Memory Bank progress/context with the completed QA closure.

### Validation Notes

-   Shared Page block normalization now enforces Entity-specific block type and block count constraints.
-   Metahub entity mutation routes and snapshot import pass component constraints into the shared normalizer before persistence.
-   The metahubs frontend test no longer mounts real MUI menus in the Entity list unit harness, removing `anchorEl` noise while keeping menu behavior covered.

## Completed: Editor.js Page Authoring QA Closure (2026-05-04)

> Goal: close the post-QA findings for imported Page block content, metadata-form content isolation, shared editor value refresh behavior, and negative coverage.

### Final Action Plan

-   [x] Normalize and reject Page `blockContent` during snapshot restore/import with the same shared block schema used by entity create/update/copy
-   [x] Remove the hidden Page content JSON validation/mutation path from the metadata properties form so only the dedicated content route owns `blockContent`
-   [x] Make the shared Editor.js adapter handle upstream value changes without relying on route-level remounts only
-   [x] Add focused backend/frontend/template tests for import safety, metadata edit isolation, and editor value refresh
-   [x] Re-run targeted tests, lint, Playwright coverage, whitespace checks, and update memory-bank progress/context

### Validation Notes

-   Snapshot restore now normalizes imported Page `config.blockContent` through the shared Page block schema and rejects unsafe content before `_mhb_objects` writes.
-   Page metadata create/edit/copy dialogs no longer carry hidden `blockContentText`; metadata updates preserve existing `blockContent` as config data while the dedicated `/content` route remains the only authoring surface.
-   `EditorJsBlockEditor` now renders upstream `value` changes into an already mounted Editor.js instance and fallback JSON accepts raw Editor.js `OutputData` through the same storage normalizer.
-   Focused backend, frontend, template, type, lint, build, whitespace, and Chromium Basic Pages UX checks passed.

## Completed: Editor.js Page Authoring Route Implementation (2026-05-04)

> Goal: replace the temporary JSON Page content authoring UX with a real Editor.js block editor on an entity-owned detail route, gated by the generic `blockContent` Entity component.

### Final Action Plan

-   [x] Add official Editor.js dependencies through the central catalog and expose a domain-neutral shared editor adapter from `@universo/template-mui`
-   [x] Add canonical Editor.js-to-Page block adapters that never persist raw `OutputData`, enforce plain text, safe URLs, supported block types, and list 2.x normalization
-   [x] Harden backend block-content validation for create/update/copy/import paths and keep published runtime renderer Editor.js-free
-   [x] Add a generic entity-owned `/content` route for types with `components.blockContent.enabled`, using existing Entity shell/menu/dialog/query patterns
-   [x] Change Page/block-content list interactions so cards/rows open content while metadata edits stay in the shared three-dot menu/dialog
-   [x] Add EN/RU i18n keys, package/GitBook docs, and memory-bank updates
-   [x] Add focused unit/component/API/Playwright coverage for adapters, route gating, Page UX, copy/delete, persistence, and runtime rendering
-   [x] Run targeted tests, lint/build checks, dependency install checks, Chromium Playwright flow, and whitespace checks

### Validation Notes

-   Metahub Page content is now authored on `/metahub/:metahubId/entities/:kindKey/instance/:entityId/content` with the official Editor.js core wrapped by a shared `@universo/template-mui` adapter.
-   Page cards and table rows open the dedicated content route; metadata editing, copy, delete, and restore stay in the shared three-dot entity menu.
-   Stored Page block content is normalized to the platform canonical block schema before persistence; raw Editor.js `OutputData` is accepted only as input and is not stored directly.
-   Runtime rendering in `packages/apps-template-mui` remains Editor.js-free and uses the existing safe Page block renderer.
-   Focused types, backend route, metahubs frontend, template UI, lint, build, dependency install, Chromium Playwright, and whitespace checks passed.

## Completed: Entity Page UI Parity Cleanup (2026-05-04)

> Goal: remove the remaining Page-specific UX regressions by making entity breadcrumbs, row actions, and pagination use the shared Entity contracts consistently.

### Final Action Plan

-   [x] Make entity-route breadcrumbs prefer localized Entity type presentation/codename data before legacy menu-key fallbacks
-   [x] Replace inline Page/generic entity row/card action buttons with the shared `BaseEntityMenu` three-dot action menu
-   [x] Align generic entity pagination with the full-width pagination surface used by standard entity lists
-   [x] Add focused regression tests for localized Page breadcrumbs, Page action menu rendering, and full-width pagination wrapper
-   [x] Run targeted tests/lint/build checks and update memory-bank progress/context

### Validation Notes

-   Entity-route breadcrumbs now prefer localized Entity type presentation data, so Page routes render `Страницы` instead of `pages` or `metahubs:pages.title`.
-   Generic Page/list actions now render through the shared `BaseEntityMenu` three-dot menu in both cards and table rows.
-   Generic entity pagination now exposes a full-width wrapper matching the standard entity list surface.
-   Focused unit tests and the Chromium Basic Pages UX flow now assert localized breadcrumbs, shared action menus, Page lifecycle actions, and full-width pagination.

## Active: LMS Snapshot Import Failure Closure (2026-05-04)

> Goal: fix the clean-database LMS snapshot import failure and make import failures readable instead of surfacing `[object Object]`.

### Final Action Plan

-   [x] Reproduce the LMS snapshot import through the browser Playwright flow on a fully reset database
-   [x] Ensure snapshot import creates an empty metahub branch by disabling the newly added Page preset along with the other standard presets
-   [x] Harden backend import error normalization for structured thrown values
-   [x] Harden frontend metahub/publication snapshot import mutations so structured API errors render readable messages
-   [x] Add focused backend/frontend regression tests for the import branch contract and structured error formatting
-   [x] Rebuild affected packages and re-run the LMS import/runtime Playwright flow

### Validation Notes

-   The initial failed Chromium import flow timed out waiting for `201` after `POST /api/v1/metahubs/import`, matching the user-facing broken import path.
-   After disabling the Page preset during import bootstrap, the same Chromium LMS snapshot import/runtime flow completed: import, linked app creation, schema sync, runtime navigation, guest progress, and guest submit.
-   Import dialog errors now extract `details.importError` and `details.cleanupError` before falling back to JSON/string messages, so backend object payloads no longer become `[object Object]`.

## Active: LMS Page QA Closure (2026-05-04)

> Goal: close the QA findings for Page metadata action permissions, lifecycle browser coverage, and touched lint hygiene without changing the broader LMS scope.

### Final Action Plan

-   [x] Make the Page metadata UI read `entity.page.allowCopy` and `entity.page.allowDelete` for copy/delete affordances
-   [x] Add focused frontend regression coverage for hidden Page copy/delete actions when Page settings are disabled
-   [x] Expand the Chromium Basic Pages UX flow to create, save, reopen/edit, copy, and delete a Page through the browser
-   [x] Remove the touched backend lint warning in settingsController
-   [x] Re-run focused tests, lint, Playwright, whitespace checks, and update progress/context

### Validation Notes

-   Standard Page routes now enable the generic entity list/query pipeline; created Pages appear without a manual reload.
-   Page copy/delete buttons now respect the `entity.page.allowCopy` and `entity.page.allowDelete` settings.
-   The Basic Pages Chromium flow creates, edits, copies, and deletes a Page through the browser and keeps the RU UX checks for clean labels/order/settings.
-   Focused frontend tests, frontend/backend lint, package builds, Chromium Playwright, and `git diff --check` passed.

## Completed: LMS Basic Template Sets And Page UX Cleanup (2026-05-04)

> Goal: align the LMS product snapshot with the Basic metahub template, restore Sets/Constants coverage, and make the new Page metadata type use polished generic entity UX without leaked translation keys or one-off hardcoding.

### Final Action Plan

-   [x] Verify the current Basic/basic-demo/LMS template contracts, Page entity metadata, generic entity UI, settings tabs, and LMS generator fixture
-   [x] Make the LMS product template/generator inherit the Basic baseline behavior and include Sets/Constants resources used by the LMS configuration
-   [x] Put Pages immediately after Hubs in Basic, basic-demo, LMS navigation/resource ordering, and generated snapshots
-   [x] Clean up the Page collection UX: localized title, no generic helper/alert copy, no deleted toggle, simple Create button, and localized Content tab
-   [x] Make Page settings derive from entity template capabilities and expose copy/delete settings like other standard metadata types
-   [x] Add focused unit/component/Playwright coverage so leaked keys, generic copy, missing Sets, wrong ordering, and Page settings regressions fail tests
-   [x] Regenerate the LMS fixture, run focused validation, update progress/context, and check whitespace

### Validation Notes

-   LMS now carries the Basic baseline standard entity presets, including Sets and Constants-backed fixed values used by LMS configuration.
-   Basic and basic-demo standard metadata ordering is Hubs, Pages, Catalogs, Sets, Enumerations.
-   Page collection UI uses the standard title/search/empty-state translations, no entity-owned route helper text, no deleted toggle, a simple Create action, and a localized Content tab.
-   Page settings are exposed through the shared settings registry only when the metahub actually has the Page entity type.
-   Focused backend/frontend/types/template tests, fixture generator, Chromium Basic Pages UX flow, package builds/lints, docs i18n check, and `git diff --check` passed.

## Active: LMS Workspace Policy And Runtime Menu Cleanup (2026-05-04)

> Goal: remove the no-workspaces publication policy, simplify LMS runtime navigation, seed only one default workspace, and align workspace management actions with the existing icon-menu pattern.

### Final Action Plan

-   [x] Remove the old "no workspaces" publication policy from shared types, backend validation, connector sync, metahub UI, i18n, docs, tests, and fixture contracts
-   [x] Remove inert LMS menu items and keep Development/Reports in the primary sidebar without creating `More`
-   [x] Seed only the user's personal Main workspace by default and stop creating the extra Published workspace
-   [x] Move workspace "make primary" actions into the three-dot menu and render default state as a star icon beside the workspace name
-   [x] Regenerate/update LMS fixture expectations and run focused tests, lint, docs, and Playwright coverage

## Completed: LMS Workspace And Page QA Hardening (2026-05-03)

> Goal: close the remaining QA findings for connector workspace persistence, irreversible workspace acknowledgement, connector-owned schema creation semantics, Page authoring coverage, and LMS product completeness without introducing LMS-only platform branches.

### Final Action Plan

-   [x] Persist connector schema options only after an applied schema sync, not while destructive changes are pending confirmation
-   [x] Require irreversible workspace acknowledgement on first-time connector workspace enablement in both backend and UI
-   [x] Remove or disable publication-side direct schema creation paths that bypass connector schema workspace decisions
-   [x] Add generic Page block authoring/editing coverage using existing entity/menu patterns
-   [x] Expand the LMS template and fixture toward missing iSpring-like core areas through generic entity metadata and scripts
-   [x] Add focused unit/UI/Playwright regression coverage for the QA findings
-   [x] Run focused lint, tests, builds, docs checks, Playwright, whitespace checks, and update progress/context

### Validation Notes

-   Connector `schema_options` are persisted only after applied sync results; pending destructive confirmations no longer store requested workspace choices.
-   First-time workspace enablement now requires explicit irreversible acknowledgement in shared policy validation, backend sync, connector UI, and e2e flows.
-   Publication application creation no longer generates application schemas directly; linked apps are created and schema creation remains connector-owned.
-   Page entities with `blockContent` expose an Editor.js JSON authoring tab through the existing entity form dialog and shared validation.
-   LMS template and generated fixture now include Departments, Learning Tracks, Assignments, Training Events, Certificates, Reports, and supporting enumerations.
-   Focused Jest/Vitest tests, package builds/lints, docs i18n checks, fixture generator, final Chromium LMS import/runtime flow, and `git diff --check` passed.

## Completed: LMS Security And Page UX QA Closure (2026-05-03)

> Goal: close the post-QA findings for guest runtime token integrity, Page navigation authoring, complete Page block rendering, and connector workspace browser coverage.

### Final Action Plan

-   [x] Bind guest runtime session tokens to the issued access link and add tamper regression tests
-   [x] Add `page` to the shared menu item kind contract and expose it in metahub/application menu editors
-   [x] Render all accepted Page block types in `apps-template-mui` without silently dropping valid content
-   [x] Add focused tests for Page menu contracts and Page block rendering
-   [x] Extend Playwright coverage so connector schema workspace decisions are exercised through the UI dialog
-   [x] Re-run focused tests, lint, builds, Playwright, whitespace checks, and update memory-bank progress/context

### Validation Notes

-   Guest runtime sessions now store and validate the issued access link id, workspace id, and secret; tampered transport tokens are rejected.
-   Page menu items are a shared contract and can be authored in both metahub and application menu editors without LMS-only widgets.
-   Page runtime blocks render accepted text, list, table, image, embed, delimiter, and quote data through existing MUI surfaces.
-   Connector schema Playwright coverage clicks the workspace decision UI and asserts the sync payload requests workspaces.
-   Targeted Jest/Vitest, package lint/build checks, Chromium connector flow, Chromium LMS runtime flow, and whitespace checks passed.

## Completed: LMS Page Workspace QA Closure (2026-05-03)

> Goal: close the QA findings from the LMS Page and workspace policy implementation without leaving lint, API-contract, validation, or browser-coverage debt.

### Final Action Plan

-   [x] Fix formatter and lint blockers in touched LMS Page/workspace-policy files
-   [x] Remove legacy workspace enablement inputs from publication/application creation backend and frontend contracts
-   [x] Add strict Page block-content validation and safe runtime payload normalization
-   [x] Block Page deletion when layout/menu references still point to the Page
-   [x] Make connector schema options persist only after successful schema sync
-   [x] Add focused unit and route coverage for workspace policies, Page validation, delete blockers, and connector sync persistence
-   [x] Add Playwright browser coverage for publication policy, connector schema decisions, and runtime Page rendering
-   [x] Re-run focused lint, tests, builds, Playwright, whitespace checks, and update memory-bank progress/context

### Validation Notes

-   Legacy application/publication workspace creation inputs are rejected or removed from UI contracts; connector schema sync owns the effective workspace decision.
-   Page `blockContent` is validated with shared Zod schemas and runtime Page blocks are normalized fail-closed.
-   Page deletion now blocks active layout/menu references before destructive operations.
-   Snapshot restore updates existing standard entity type definitions instead of inserting duplicate `kind_key` rows during LMS snapshot import.
-   Focused Jest/Vitest suites, package lint/build checks, `pnpm run build:e2e`, `git diff --check`, and targeted Chromium Playwright LMS snapshot/runtime flow passed.

## Completed: LMS Page Type And Workspace Policy Implementation (2026-05-03)

> Goal: implement the approved LMS Page metadata type, publication workspace policy, connector-level workspace schema decision, runtime template parity, LMS fixture refresh, tests, and documentation without adding LMS-only package branches.

### Final Action Plan

-   [x] Inventory affected type, template, publication, sync, runtime UI, fixture, and docs contracts
-   [x] Implement shared Page/block-content/runtime-policy types and workspace policy helpers
-   [x] Register Page in metahub templates and preserve Page block content through snapshot import/export
-   [x] Add runtime physical-table contract so nonphysical Page objects sync as metadata only
-   [x] Move workspace schema choice from application creation to connector schema sync with irreversible enablement rules
-   [x] Add publication-version runtime policy persistence, validation, hashing, and UI controls
-   [x] Add generic Page rendering and reuse-first runtime views in `apps-template-mui`
-   [x] Refresh LMS Playwright generator, fixture contract, generated snapshot, and sample LMS model
-   [x] Add focused Jest/Vitest/Playwright coverage and run package validation
-   [x] Update GitBook docs, package READMEs, active context, and progress notes

### Validation Notes

-   `page` is now a standard metadata type with `blockContent`, no physical runtime table, and LMS `LearnerHome` seed content.
-   Publication versions persist `runtimePolicy.workspaceMode`; connector schema sync resolves `optional|required` with irreversible workspace enablement checks.
-   `packages/apps-template-mui` renders Page block content through the existing dashboard details surface.
-   `tools/fixtures/metahubs-lms-app-snapshot.json` was regenerated through the official Playwright generator and passed the LMS fixture contract.
-   Focused package tests/builds and root e2e build passed; details are recorded in `progress.md`.

## Completed: LMS PR Hygiene Closure (2026-05-03)

> Goal: close the small QA hygiene findings before the LMS MVP PR without widening the product scope.

### Action Plan

-   [x] Replace stale legacy LMS test wording with neutral learning portal wording
-   [x] Remove the guest runtime UUID v4 fallback so runtime IDs remain UUID v7/fail-closed
-   [x] Align application and metahub menu editor URL validation with runtime href sanitization
-   [x] Run focused tests/lint checks and update memory-bank progress

### Validation Notes

-   Replaced stale `Orbital Navigation 101` test fixture titles with neutral `Learning Portal Basics` wording
-   Added shared `sanitizeMenuHref` / `isSafeMenuHref` validation in `@universo/utils` and reused in published runtime menu plus metahub/application menu editors
-   Focused backend tests, menu href unit tests, apps-template MenuContent tests, affected package lints, targeted builds, root `pnpm build`, and `git diff --check` all pass

## Completed: LMS Backend QA Blocker Closure (2026-05-02)

> Goal: close the backend QA blockers found after the LMS runtime remediation without widening the LMS MVP scope.

### Action Plan

-   [x] Align the applications fixed-schema migration-chain invariant with the current application settings migration contract
-   [x] Fix or update the application sync diff TABLE child-field regression so preview metadata returns 200 with child fields
-   [x] Align the canonical application release-bundle route contract with the current bundle shape without weakening integrity checks
-   [x] Harden published-app menu href rendering against protocol-relative URLs
-   [x] Remove stale LMS legacy wording from GitBook docs
-   [x] Re-run focused backend tests, affected frontend/template checks, docs checks, whitespace checks, root build, and targeted LMS Playwright

## Completed: LMS Documentation And Template Lint QA Closure (2026-05-02)

> Goal: close the remaining QA blockers in GitBook documentation, memory-bank context, and apps-template-mui lint warnings.

-   [x] Remove stale GitBook wording that fails the docs checker while preserving the current LMS widget-removal contract
-   [x] Refresh `memory-bank/activeContext.md` so it no longer describes removed LMS global widgets as active
-   [x] Reduce `@universo/apps-template-mui` lint output to zero warnings without changing runtime behavior
-   [x] Re-run docs check, apps-template lint/test, and whitespace validation

## Completed: LMS Runtime Child Rows QA Closure (2026-05-02)

> Goal: close the remaining QA blockers in runtime TABLE child-row permissions, copy normalization, and regression coverage.

-   [x] Correct runtime child-row read/write permission checks so read-only members can read child rows but cannot mutate them
-   [x] Normalize copied child-row values with declared child attribute `data_type` and validation rules
-   [x] Add backend regression coverage for child-row read access, mutation denial, and copy normalization
-   [x] Run focused backend validation, lint/build, whitespace checks, and update memory-bank progress

## Completed: LMS QA Closure Implementation (2026-05-02)

> Goal: close the remaining QA findings around LMS runtime roles, runtime copy integrity, browser coverage, and implementation hygiene.

-   [x] Make application `member` a read-only runtime content role while keeping owner/admin/editor authoring contracts explicit
-   [x] Expose runtime content permissions to published app clients and hide unavailable create/edit/copy/delete controls
-   [x] Fix TABLE child-row copy normalization so copied child values use declared `data_type` and validation rules
-   [x] Add focused Jest/Vitest coverage for member mutation denial, permission-driven UI gating, and TABLE child copy metadata
-   [x] Extend LMS Playwright workspace flow with member negative checks for runtime authoring controls
-   [x] Run focused lint/build/test validation and update memory-bank progress

## Completed: Phase 3 - Gate demo template surfaces and fix right-zone defaults (2026-05-02)

> Goal: disable demo surfaces by default in apps-template-mui so published runtime applications don't show demo content unless explicitly enabled.

-   [x] Update default values in `dashboardLayout.ts` (showOverviewCards, showSessionsChart, showPageViewsChart, showRightSideMenu to false)
-   [x] Replace hardcoded user profile in `widgetRenderer.tsx` with generic profile
-   [x] Update `dashboardLayout.test.ts` and `normalizeDashboardLayoutConfig` test to match new defaults
-   [x] Verify LMS template has no demo widgets
-   [x] Run build and tests to validate changes

## Active: Fix Public Shared Workspace Selection Ambiguity (2026-05-02)

> Superseded: public runtime now resolves the active workspace that owns the explicit access link or guest session instead of creating a dedicated automatic public shared workspace.

-   [x] Add `codename` column to `_app_workspaces` DDL (with `ADD COLUMN IF NOT EXISTS` for backwards compat)
-   [x] Earlier deterministic public shared workspace implementation was removed during the 2026-05-04 cleanup
-   [x] `listActivePublicWorkspaceIds` no longer prefers a special public workspace codename
-   [x] Update backend tests for the new codename behavior
-   [x] Run tests to validate changes

## Active: Remove Legacy LMS Widget Types (2026-05-02)

> Goal: fully remove the three legacy LMS widget types (moduleViewerWidget, statsViewerWidget, qrCodeWidget) from platform code.

-   [x] Remove legacy LMS widget entries from `DASHBOARD_LAYOUT_WIDGETS` and interface definitions
-   [x] Remove legacy widget config schemas from `applicationLayouts.ts`
-   [x] Clean up `widgetRenderer.tsx` imports and switch cases
-   [x] Delete `ModuleViewerWidget.tsx`, `StatsViewerWidget.tsx`, `QRCodeWidget.tsx` component files and tests
-   [x] Fix `applicationLayoutsStore.test.ts` to replace `statsViewerWidget` references
-   [x] Clean up i18n locale files, `ApplicationLayouts.tsx` widget filtering, e2e test references
-   [x] Run lint/build validation

## Active: LMS Portal Runtime Refactor Implementation (2026-05-02)

> Goal: turn the LMS fixture/runtime into a clean entity-first MVP portal.

### Final Action Plan

-   [x] Remove global LMS module/statistics/QR widgets from the LMS template and product fixture contract
-   [x] Extend the existing menu widget contract for quick access, overflow, start page, and workspace placement
-   [x] Preserve nested `columnsContainer` widget config through shared types, editors, sync, and runtime rendering
-   [x] Replace or gate demo runtime surfaces in `apps-template-mui` using existing dashboard components and i18n
-   [x] Rebuild the LMS seed/generator contract toward product-facing entities, navigation, and scripts
-   [x] Rewrite focused Jest/Vitest/Playwright coverage for the new LMS product contract
-   [x] Superseded: public workspace-enabled applications now seed only member personal `Main` workspaces
-   [x] Update package READMEs, GitBook docs, and memory-bank progress
-   [x] Run focused lint/build/test validation and document any remaining environment limits

### Validation Notes

-   LMS template and committed fixture no longer include `moduleViewerWidget`, `statsViewerWidget`, `qrCodeWidget`
-   Runtime menu supports `maxPrimaryItems`, overflow label, `startPage`, workspace placement
-   `columnsContainer` nested widget `id`, `sortOrder`, `config` preserved through shared schemas
-   Public workspace-enabled applications now seed only owner/member personal `Main` workspaces during schema sync
-   Targeted Chromium Playwright passed for LMS snapshot import/runtime with EN/RU screenshots
-   Root `pnpm build` passed (`30/30` tasks)

### QA Remediation Pass (2026-05-02)

-   [x] Make the LMS published app open the configured `Modules` start page deterministically
-   [x] Remove duplicate runtime workspace navigation entries
-   [x] Replace no-op LMS menu links with working catalog/section-backed navigation
-   [x] Harden shared public workspace sync for existing workspaces
-   [x] Refresh stale GitBook setup docs and fixture contract residue
-   [x] Expand Jest/Vitest/Playwright coverage for the QA defects

## Completed: Runtime Workspace PR Review Hardening (2026-04-29)

-   [x] Reset runtime system metadata instead of copying from source rows during workspace copy
-   [x] Return and consume stable runtime workspace API error codes for localized UI errors
-   [x] Replace workspace UI hard reload navigation with host-provided SPA navigation

### Validation Notes

-   Focused backend Jest passed (`28/28`), focused apps-template Vitest passed (`14/14`)
-   Applications-backend lint/build passed, applications-frontend lint/build passed
-   Apps-template lint/build passed with only unrelated pre-existing warnings
-   `git diff --check` passed
-   Details: progress.md#2026-04-29-runtime-workspace-pr-review-hardening

## Completed: Runtime Workspace I18n And Switcher Locale Closure (2026-04-29)

-   [x] Render workspace switcher VLC names using the active UI locale
-   [x] Localize remaining runtime workspace backend error messages in the published-app UI
-   [x] Add focused component tests for Russian switcher labels and error messages

### Validation Notes

-   `WorkspaceSwitcher` now reads localized workspace names using `i18n.language` before falling back to primary/English VLC locale
-   Runtime workspace UI translates backend errors: missing user, owner-only mutation, unavailable workspaces, missing member/workspace, last-owner removal
-   `InviteMemberDialog` catches rejected submit promises for proper error rendering
-   Focused apps-template Vitest passed (`12/12`), package build and lint passed, root `pnpm build` passed (`30/30`)
-   Targeted Playwright `lms-workspace-management.spec.ts --project chromium` passed (`2/2`) after rebuild
-   Details: progress.md#2026-04-29-runtime-workspace-i18n-and-switcher-locale-closure

## Completed: Runtime Workspace Direct Route QA Closure (2026-04-28)

-   [x] Add backend direct workspace detail contract for user-scoped lookups
-   [x] Update runtime workspace UI to resolve `/workspaces/:workspaceId` independently of list pagination
-   [x] Stabilize the Playwright RU screenshot wait for rendered workspace cards

### Validation Notes

-   Added `GET /applications/:applicationId/runtime/workspaces/:workspaceId` with user-scoped SQL service lookup
-   `RuntimeWorkspacesPage` uses route workspace detail query so direct links work independently of list page state
-   Focused backend Jest passed (`27` tests), focused apps-template Vitest passed (`7` tests)
-   Targeted Playwright wrapper passed for `lms-workspace-management.spec.ts --project chromium` (`2/2`) on clean database
-   Details: progress.md#2026-04-28-runtime-workspace-direct-route-qa-closure

## Completed: Runtime Workspace Layout And CRUD QA Closure (2026-04-28)

-   [x] Materialize runtime `workspaceSwitcher` widget as real left-zone layout widget
-   [x] Add workspace card/table actions for edit, copy, and delete
-   [x] Localize workspace form/action errors and fix dialog action spacing
-   [x] Add persistent divider before Workspaces menu section
-   [x] Browser proof: card/list mode, search, pagination, owner/member permissions, screenshots, personal/shared isolation

### Validation Notes

-   Workspace-enabled app sync materializes real `workspaceSwitcher` widget plus divider in left layout zone
-   Runtime workspaces support safe create, edit, copy, delete from card and table views
-   Copy creates UUID v7 rows, remaps workspace-scoped UUID references; deletion blocks personal workspace removal
-   Backend service/controller tests cover update/copy/delete and layout widget materialization
-   Full LMS Playwright flow passed: create, copy, edit, delete, member add, workspace switching, screenshots, personal/shared isolation
-   Details: progress.md#2026-04-28-runtime-workspace-layout-and-crud-qa-closure

## Completed: Runtime Workspace QA Remediation Closure (2026-04-27)

-   [x] Add fail-closed UUID validation for runtime workspace route params
-   [x] Remove the shared workspace machine-name contract (name-only workspace mutations)
-   [x] Surface workspace member removal failures in the published-app UI
-   [x] Expand Playwright browser coverage for negative/error workspace paths

### Validation Notes

-   Runtime workspace controller rejects malformed workspace and user route IDs before schema resolution
-   Shared workspace create/edit/copy accepts only display name; identity is the generated UUID
-   Published-app member removal failures stay visible in confirmation dialog
-   Focused backend Jest passed (`92` tests), focused apps-template Vitest passed (`3` tests)
-   `pnpm run build:e2e` passed (`30/30`), targeted Playwright `lms-workspace-management.spec.ts` passed (`2/2`)
-   Details: progress.md#2026-04-27-mutable-application-visibility-and-runtime-workspace-management

## Completed: Mutable Application Visibility And Runtime Workspace Management (2026-04-27)

-   [x] Backend visibility mutation with optimistic locking, RLS-compatible SQL, fail-closed public runtime
-   [x] Runtime workspace APIs with pagination, search, profile fields, email-based member invitation
-   [x] Application settings UI for mutable visibility and read-only workspace mode
-   [x] Published workspace section inside dashboard shell using shared UI primitives
-   [x] EN/RU i18n keys across touched frontend packages
-   [x] Playwright/browser coverage and screenshots for visibility and workspace flows

### Validation Notes

-   Application owners can change public/closed visibility after creation through settings page
-   Runtime workspace listing supports pagination/search; member invitation accepts email or user id
-   Published-app workspace section uses card/list views, pagination, search, create, invite, remove flows
-   Workspace switcher shows type chips to distinguish shared `Main` from personal `Main`
-   Full LMS workspace-management Playwright flow passed (`2/2`): create, invite, runtime row creation, owner/member switching, personal/shared isolation
-   Details: progress.md#2026-04-27-mutable-application-visibility-and-runtime-workspace-management

## Completed: Entity Resources Data-Driven Cleanup (2026-04-26)

-   [x] Add shared resource surface contracts/helpers in `@universo/types`
-   [x] Seed standard resource surface labels as localized entity metadata
-   [x] Remove synthetic builtin entity type fallback
-   [x] Render Resources tabs from persisted resource surface metadata through capability registry
-   [x] Preserve and test entity type resource metadata through snapshot/release bundle paths
-   [x] Add focused unit/backend/frontend tests and hardcoding audit coverage
-   [x] QA remediation: VLC validation, negative tests, conflict diagnostics, Playwright browser coverage

### Validation Notes

-   Root `pnpm build` passed across 30 packages
-   Focused tests passed for types, utils, metahubs-backend, metahubs-frontend, applications-backend
-   QA remediation added: shared VLC validation rejects malformed titles, negative service tests for structural mutations, i18n conflict diagnostics, Playwright EN/RU resource label screenshots
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

### Validation Notes

-   Shared list shell: `LayoutAuthoringList` in `@universo/template-mui` used by both application and metahub layout lists
-   Shared authoring: `LayoutAuthoringDetails` is common five-zone widget authoring surface for both metahub and application detail pages
-   Sidebar fix: `getApplicationMenuItems()` now includes `application-layouts` entry pointing to `/a/:applicationId/admin/layouts`
-   Read access: fail-closed by default, honors explicit `settings.applicationLayouts.readRoles` for non-admin read
-   Application widget-config validation uses shared schema-driven parsers in `@universo/types`
-   Full Playwright `application-layout-management.spec.ts` suite passed (`3/3`)
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

### Validation Notes

-   `EntityTypeService` synthesizes platform standard entity types when schema lacks persisted builtin rows
-   `POST /api/v1/metahubs` now supports `templateCodename` as first-class selector with explicit conflict handling
-   Full Playwright generator cycle passed and produced `tools/fixtures/metahubs-lms-app-snapshot.json`
-   Guest runtime locale resolution: `GuestApp.tsx` resolves from explicit public URL query first, then persisted `i18nextLng`, then incoming prop
-   Guest credentials sent via `X-Guest-Student-Id` and `X-Guest-Session-Token` headers, not query params
-   Official generator refreshed `tools/fixtures/metahubs-lms-app-snapshot.json` through supported end-to-end export path
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

### Validation Notes

-   `publicRuntimeAccess.ts` calls `setPublicWorkspaceContext()` which sets `app.current_workspace_id` before catalog queries
-   Guest sessions persist JSON envelope `{ secret, expiresAt }` in existing token column without schema migration
-   `runtimeGuestController` explicitly writes `workspace_id` for guest-created Students, QuizResponses, ModuleProgress rows
-   Targeted backend Jest (`20/20`), apps-template Vitest (`17/17`), root `pnpm build` (`30/30`) all passed
-   Focused LMS Playwright wrapper passed (`3/3`) including class-module-quiz proof and QR flow
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

### Validation Notes

-   `enumerationId` -> `optionListId` (321 refs), `setId` -> `valueGroupId` (393 refs), `catalogId` -> `linkedCollectionId` (904 refs), `hubId` -> `treeEntityId` (957 refs)
-   Stored JSONB field access preserved: `typed.hubId`, `typed.catalogId`, `config.parentHubId` etc. remain unchanged
-   Fixed stored data access bug where `typed.linkedCollectionId` was reading JSONB that stores `catalogId`
-   Full workspace build `pnpm build` -- 30/30 passed
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

### Validation Notes

-   Generic custom entity instance ACL maps create/edit/delete to `createContent` / `editContent` / `deleteContent`
-   `entityInstancesController.ts` no longer instantiates specialized child-controller factories; all nested standard routes run through direct service-backed handlers
-   Backend `entityInstancesRoutes.ts` no longer imports or owns specialized standard child-controller dispatch helpers
-   Public metahub runtime requires `full`-access publication with active snapshot-backed version for unauthenticated reads
-   Frontend no longer ships separate per-kind page exports (`HubEntityInstanceView`, `CatalogEntityInstanceView`, etc.)
-   Frontend `domains/entities/standard/**` barrel re-export layers deleted; consumers import direct module files
-   Top-level `domains/attributes`, `domains/constants`, `domains/elements`, `domains/general` physically removed
-   Top-level backend `domains/hubs`, `domains/catalogs`, `domains/sets`, `domains/enumerations` physically removed
-   All canonical root `pnpm build` runs completed green (`30/30`) after each sub-slice

## Completed: QA Remediation Post-Refactoring Polish (2026-04-14)

-   [x] Entity-First Final Refactoring phases 1-13 (Prettier/lint, i18n key migration, query key renaming, backend controller decomposition, frontend consolidation, E2E API helper renames, test alignment, fixture regeneration, documentation rewrite, final validation, deep internal identifier cleanup)
-   [x] Validation: build 30/30, backend 68/68 (581 tests), frontend 64/64 (252 tests), lint 0 errors

### Validation Notes

-   Phase 2: 324 i18n key refs renamed, JSON sections renamed
-   Phase 3: 94 files, ~60 query key function renames
-   Phase 4: entityInstancesController.ts split from 3159 to 173 lines (composition root) + 4 focused handler modules
-   Phase 6: EntityInstanceList.tsx decomposition (1773 to 19-line shell + 1450 content + 180 helpers)
-   Phase 7: 17 E2E API helper functions renamed + 16 consumer spec files updated
-   Phase 13: 60+ legacy local variables/schema names/error messages renamed across 8 files
-   Details: progress.md (2026-04-14 refactoring polish entry)

## Completed: Platform Infrastructure (2026-04-08 to 2026-04-12)

-   [x] Entity Component Architecture (ECAE) delivery: presets, generic entity UI, dynamic menu, browser proof
-   [x] Catalog V2 closeout, shared dialog/shell/spacing fixes, entity V2 completion
-   [x] Fixture regeneration, compatibility fixes, review triage (PR #759, PR #763)
-   [x] Shared/Common and runtime materialization closure
-   [x] Compatibility-aware blocker query, validated legacy-compatible read union

### Validation Notes

-   Shared `CommonPage` became single shared shell for metahubs
-   `EntityFormDialog` first-open hydration fix validated (no render-phase ref writes)
-   Metahub shell gutter and header inset logic consolidated under shared route-aware helper source
-   Browser geometry and negative-path permission proof added
-   Compatibility-aware blocker queries accept full compatible target-kind set with `ANY($n::text[])`
-   Details: progress.md#2026-04-08-ecae-foundation-and-qa-recovery-cluster

## Completed: Snapshot/Scripting/Parity (2026-04-03 to 2026-04-07)

-   [x] Snapshot import/export, self-hosted parity, scripting/quiz delivery
-   [x] Layout/runtime fixture and docs, E2E reset stabilization
-   Details: progress.md#2026-04-06-layout-runtime-fixture-and-docs-cluster

## Completed: Earlier Platform Work (2025-07 to 2026-04-02)

-   [x] 2026-03-11 to 2026-04-02: platform, auth, Playwright, security, codename convergence
-   [x] 2025-07 to 2026-02: alpha-era milestones (see release table in progress.md)
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
