# Tasks

> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## Completed: LMS Runtime UX QA Findings Closure (2026-05-23)

> Goal: close the latest QA findings that still prevent release-ready status: duplicate primary create controls, insufficient RU control-label oracles, weak spacing/toolbar geometry checks, missing ID uniqueness assertions after create/copy/restore, and backend regression gaps for reorder and hostile locale inputs.

### IMPLEMENT Action Plan

-   [x] Suppress duplicate top-level create actions when a metadata details widget owns the create-target toolbar.
-   [x] Strengthen browser UX oracles for RU control labels, single primary create action, module spacing/overlap, and toolbar geometry across desktop/tablet/mobile.
-   [x] Add create/copy/delete/restore ID uniqueness assertions and additional ISO leakage scans for date-heavy runtime grids.
-   [x] Add backend regressions for reorder duplicate/version-map failures and hostile `records.union` locale input.
-   [x] Run Prettier, focused unit/backend/fixture tests, local minimal Supabase E2E, and update progress with the closure outcome.

---

## Completed: LMS Runtime UX/i18n Release Blocker Remediation (2026-05-23)

> Goal: close the latest user-visible Learning Content blockers without LMS-only forks: locale-aware runtime dates, Russian resource preview labels, bilingual seeded LMS content on normal runtime surfaces, consistent toolbar/detail spacing, and executable Playwright UX oracles that catch these regressions.

### IMPLEMENT Action Plan

-   [x] Add generic runtime DATE/DATETIME display formatting that never exposes raw ISO timestamps on normal grids, cards, details tables, or player surfaces.
-   [x] Fix ResourcePreview i18n namespace usage and add regression coverage for Russian resource type/action labels.
-   [x] Normalize LMS template/snapshot user-facing strings so Russian runtime surfaces do not fall back to English seeded titles/body copy.
-   [x] Tighten Learning Content toolbar/detail spacing through existing MUI primitives without LMS-only runtime forks.
-   [x] Strengthen Playwright/runtime UX oracles for raw ISO dates, English fallback text, DataGrid leakage, control geometry, and no page-level overflow.
-   [x] Run Prettier, focused unit/fixture tests, local minimal Supabase E2E where feasible, and update progress with the remediation outcome.

---

## Completed: LMS Learning Content Post-QA Release Blocker Remediation (2026-05-23)

> Goal: close the latest release-blocking QA findings: make guest progress truly server-owned, enforce workspace limits on restore, prevent locked-row reorder mutations, remove public access-link slug ambiguity, align public workspace documentation with behavior, and replace weak public guest browser evidence with a realistic quiz/content flow.

### IMPLEMENT Action Plan

-   [x] Convert public guest progress to an action-intent API where the backend derives status/progress values.
-   [x] Enforce workspace row limits when restoring deleted runtime rows.
-   [x] Block persisted row reordering for locked runtime rows.
-   [x] Fail closed on duplicate public access-link slugs inside the same workspace and cover same-workspace/cross-workspace ambiguity.
-   [x] Align public workspace documentation with the implemented non-personal public workspace policy.
-   [x] Strengthen public guest Playwright evidence with real quiz questions, viewport/no-overflow checks, and request-body assertions.
-   [x] Run Prettier, focused lint/tests, fixture/no-fork gates, local minimal Supabase E2E, and update progress.

---

## Completed: LMS Learning Content Final QA Remediation Follow-up (2026-05-23)

> Goal: close the remaining post-QA findings that still block release-ready status after the previous public workspace isolation pass: guest progress/assessment concurrency, duplicate public-link slug ambiguity, runtime copy access-entry validation parity, and missing browser UX evidence for public guest viewport/localized negative paths.

### IMPLEMENT Action Plan

-   [x] Reconcile the previous follow-up checklist against the code and document which parent ACL/public workspace items were already completed.
-   [x] Make public guest progress writes concurrency-safe and fail closed without duplicate progress rows.
-   [x] Make public guest assessment attempt numbering concurrency-safe and covered by backend regression tests.
-   [x] Fail closed when the same public access-link slug exists in multiple active non-personal public workspaces.
-   [x] Apply access-entry membership validation parity to runtime copy overrides and add backend regression coverage.
-   [x] Strengthen Playwright UX evidence for public guest positive viewport/no-overflow paths and RU negative guest error pages.
-   [x] Run Prettier, focused lint/tests, release gates, local minimal Supabase browser E2E where feasible, and update progress with the remediation outcome.

---

## Completed: LMS Learning Content Final Security Gate Remediation (2026-05-23)

> Goal: close the latest QA blockers before the Learning Content plan can be treated as release-ready: enforce parent-derived row access for LMS outline records, apply row-level access to record posting commands, make original restore targets fail closed, wire executable release gates into CI/agent paths, remove stale docs wording, and strengthen guest/public UX leakage coverage.

### IMPLEMENT Action Plan

-   [x] Enforce runtime row-level edit access on direct `post`, `unpost`, and `void` record commands.
-   [x] Add generic parent-record access inheritance for child outline records and configure the LMS course/track child objects through metadata.
-   [x] Make original restore targets fail closed by validating existing parent references before undelete.
-   [x] Strengthen backend regression tests for record commands, child outline mutation boundaries, and restore target authorization.
-   [x] Wire LMS fixture/no-fork release gates into normal agent/CI checks and remove stale post-V2 docs wording.
-   [x] Strengthen public guest browser UX leakage coverage without LMS-only runtime forks.
-   [x] Run Prettier, focused lint/tests, fixture/no-fork/docs/audit checks, and update progress with the remediation outcome.

---

## Completed: LMS Learning Content QA Findings Remediation (2026-05-22)

> Goal: close the latest QA findings before the Learning Content plan can be treated as release-ready: enforce owner/shared access consistently across workflow, reference, and report helper paths; make mutation outcomes fail closed; remove user-facing option codenames; and add executable tests for the corrected contracts.

### IMPLEMENT Action Plan

-   [x] Enforce runtime row-level access on workflow actions, record-picker reference validation, and report reference-label joins.
-   [x] Make progress and reorder mutation paths fail closed with affected-row confirmation and duplicate-progress protection where the runtime contract supports it.
-   [x] Render string option values in runtime tables/cards with metadata labels instead of stored codenames.
-   [x] Add focused backend and frontend tests for the security, mutation, and display contracts.
-   [x] Run Prettier, focused lint/tests, fixture/no-fork gates, and update progress with the remediation outcome.

## Completed: LMS Learning Content QA Release Gate Closure (2026-05-22)

> Goal: close the post-QA release-gate gaps without adding LMS-only runtime forks: make the acceptance matrix honest about release vs deferred scope, prove reports through the UI, derive learner-player progress from persisted rows, and remove remaining localized-validation/display heuristics debt.

### IMPLEMENT Action Plan

-   [x] Tighten the LMS acceptance matrix so deferred or API-only areas cannot be counted as browser-proven release gates.
-   [x] Derive learner-player completion counts from persisted runtime item status as well as local completion state.
-   [x] Add UI-level Playwright evidence for running/exporting the primary Learning Content report surface.
-   [x] Close remaining generic validation and technical-field display heuristics that can leak internal text or hide legitimate business fields.
-   [x] Run Prettier, focused runtime UI tests, fixture/no-fork/docs guards, audit, and LMS Playwright validation.

---

## Completed: LMS Learning Content QA Blocker Remediation (2026-05-22)

> Goal: resolve the post-QA blocker list before considering the Learning Content productization plan closed: runtime access-entry integrity, owner/shared mutation boundaries, shared edit semantics, restore target authorization, backend suite stability, mobile runtime toolbar usability, accessible/localized row actions, and missing Playwright UX evidence.

### IMPLEMENT Action Plan

-   [x] Harden runtime access-entry creation/update so share rows cannot be forged through generic CRUD.
-   [x] Apply owner/shared row-level access consistently to update, bulk update, restore-target, reorder, and mutation access predicates.
-   [x] Distinguish shared read and shared edit access for copy/delete/restore/update-style mutations.
-   [x] Stabilize the full applications-backend test suite after canonical schema-name validation.
-   [x] Fix generic records-union mobile toolbar visibility and localized/row-aware action accessibility.
-   [x] Strengthen Playwright/browser UX evidence for mobile controls, reports UI/export, RU validation, and keyboard paths.
-   [x] Run Prettier, focused tests, full backend suite, app-template tests/lint/build, fixture/no-fork/docs/audit checks, and LMS Playwright validation.

---

## Completed: LMS Learning Content Final QA Fixes (2026-05-22)

> Goal: close the final QA findings after the Learning Content productization pass: enforce row-level runtime access on direct reads, reports, progress, copy, delete, and restore; finish numeric tabular UX; remediate moderate production dependency advisories; and re-run the focused validation chain.

### IMPLEMENT Action Plan

-   [x] Qualify and test runtime row-level access predicates for direct reads, reports, progress, copy, delete, and restore.
-   [x] Integrate and verify generic numeric tabular validation UX fixes.
-   [x] Remediate moderate production dependency audit advisories with minimal supported overrides/upgrades.
-   [x] Strengthen focused backend and runtime UX/test-oracle coverage for the QA gaps.
-   [x] Run Prettier, focused backend/frontend tests, fixture/no-fork/docs checks, dependency audit, and package builds.

---

## Completed: LMS Learning Content QA Remediation (2026-05-22)

> Goal: close the QA blockers found after the productization pass without LMS-only runtime forks: fail closed on sensitive runtime helper objects, prevent viewer re-share escalation, fix remaining generic runtime UX defects, strengthen executable fixture and browser oracles, and re-run the focused validation chain.

### IMPLEMENT Action Plan

-   [x] Harden runtime access controls for `records.union` helper-object targets and `library/shared` grants.
-   [x] Add backend coverage for union helper-object denial and shared-viewer re-share denial.
-   [x] Hide server-owned LMS author fields and add fixture contract coverage for duplicate/system-owned metadata regressions.
-   [x] Render semantic long text in tabular editors as multiline controls and add accessible row action labels.
-   [x] Strengthen frontend unit coverage for tabular long-text editing and accessibility labels.
-   [x] Strengthen Playwright UX oracles for fixed waits, copy lifecycle, reports/export, player leakage, and localized validation.
-   [x] Remediate production dependency audit high/critical findings where patched versions are available.
-   [x] Run Prettier, focused backend/frontend tests, fixture/no-fork/docs checks, audit, and LMS Playwright validation.

## Completed: LMS Learning Content Productization Implementation (2026-05-20)

> Goal: implement `memory-bank/plan/lms-learning-content-productization-plan-2026-05-20.md` as a production-grade Learning Content runtime without LMS-only forks, starting from generic contracts, server-owned mutations, reusable MUI runtime primitives, tests, docs, and fixture generation.
> Status: the standalone fixture gate, acceptance-matrix reconciliation, Phase 1 union datasource foundation audit, Knowledge Base actionable/audited gates, Reports audited gate, Role Visibility scoped gate, and final release validation are complete for the current plan state.

### IMPLEMENT Action Plan

-   [x] Phase 0: re-audit implementation seams and add executable acceptance gates for technical leakage, static LMS-fork drift, and docs/screenshot drift.
-   [x] Phase 1: harden generic datasource/table foundations without LMS-only runtime branches.
-   [x] Phase 2: close mutation correctness gaps for `expectedVersion`, reorder row-version maps, restore targets, and server-owned progress actions.
-   [x] Phase 3: productize Learning Content metadata and generated LMS snapshot through the existing metahub/template generator.
-   [x] Phase 4: apply Learning Content application settings through existing settings/runtime bootstrap surfaces.
-   [x] Phase 5: refine published MUI runtime UX using existing dashboard primitives and no raw IDs/JSON/object cells.
-   [x] Phase 6: complete page/link authoring on Editor.js/resource-source primitives without broad file imports.
-   [x] Phase 7: refine Course Builder and related copy/reorder/enrollment warning flows.
-   [x] Phase 8: refine Learning Track Builder, learner lists, player, progress, trash restore, reports/export, and access actions.
-   [x] Phase 9: finish remaining product fixture/docs/browser validation for the open broad acceptance chains.
-   [x] Phase 10: run final formatting, lint, package tests, fixture contract, and E2E gates for the whole plan state.

### Completed Slice: Remaining Product Acceptance Closure

-   [x] Reconcile the fixture-contract acceptance matrix against the remaining Phase 1 and Phase 3-8 checklist wording.
-   [x] Verify whether the Phase 1 server-side `records.union` datasource foundation is fully implemented or should stay as an explicit remaining architecture gap.
-   [x] Close or explicitly defer the remaining open matrix gates: `roleVisibility.actionable` and `roleVisibility.audited`.
-   [x] Add or tighten product-level coverage for any remaining Learning Content workflow behind those open gates.
-   [x] Run final no-fork, formatting, lint, docs, fixture, focused package, and E2E gates for the plan state.
-   [x] Move fully proven phase outcomes to `progress.md` and keep only genuinely active work here.

### Completed Slice: Final Release Validation

-   [x] Verify the executable LMS product acceptance matrix has no open gates.
-   [x] Re-run the standalone LMS fixture contract.
-   [x] Re-run focused backend and frontend role/report contract tests for the remaining gates closed in this slice.
-   [x] Re-run docs i18n, runtime no-LMS-forks, formatting, lint, whitespace, and the main LMS runtime Playwright flow.

### Completed Slice: LMS Product Acceptance Matrix Reconciliation

-   [x] Inspect `LMS_PRODUCT_ACCEPTANCE_MATRIX` through the executable fixture-contract module.
-   [x] Confirm no open gates remain for core content projects, Learning Content shell, standalone Page/Link authoring, course detail/builder, track progression/builder, manual enrollment, learner player, trash restore, workspace isolation, or public guest access.
-   [x] Identify the remaining open gates as reports auditability, knowledge-base actionability/auditability, and role-visibility actionability/auditability.
-   [x] Keep explicit deferred gaps visible for broad package ingestion, learner-home audit ledger, saved/scheduled reports, knowledge bookmarks/trash/permission-limited search, mentor comments/export, and advanced role predicates.

### Completed Slice: Knowledge Base Actionable Gate

-   [x] Confirm Phase 1 `records.union` foundation is already server-side and covered by generic backend/app-template tests.
-   [x] Mark `knowledgeBase.actionable` complete in the fixture contract based on the existing published-app create/edit Knowledge Article browser flow.
-   [x] Initially kept `knowledgeBase.audited` open until the follow-up Knowledge Base audited gate closed the supported generic lifecycle scope.
-   [x] Update English and Russian Learning Content docs to describe the supported Knowledge authoring scope and deferred gates.

### Completed Slice: Reports Audited Gate

-   [x] Mark `reports.audited` complete in the fixture contract based on existing saved-report authorization, execution, export, and runtime identifier suppression coverage.
-   [x] Keep saved-filter management and scheduled report delivery as explicit deferred capabilities rather than blockers for the current Learning Content fixture.
-   [x] Update English and Russian LMS Reports docs to describe the supported auditability scope and deferred report capabilities.

### Completed Slice: Knowledge Base Audited Gate

-   [x] Mark `knowledgeBase.audited` complete in the fixture contract based on seeded Knowledge spaces/folders/articles/bookmarks, published-app article create/edit evidence, and generic mutation/trash lifecycle coverage.
-   [x] Keep dedicated bookmark UI and permission-limited knowledge search as explicit deferred capabilities rather than blockers for the current Learning Content fixture.
-   [x] Update English and Russian Learning Content docs to describe the supported Knowledge auditability scope and deferred product capabilities.

### Completed Slice: Role Visibility Scoped Gate

-   [x] Mark `roleVisibility.actionable` and `roleVisibility.audited` complete in the fixture contract for the current supported scope: workspace membership, owner/shared record access, and fail-closed unsupported scoped role-policy rules.
-   [x] Keep department, class, and group predicates as explicit deferred capabilities until a generic predicate engine can enforce them across row lists, union datasources, reports, and mutations.
-   [x] Update English and Russian Learning Content docs to describe supported role visibility scope and deferred scoped predicates.

### Completed Slice: Standalone LMS Fixture Contract Gate

-   [x] Add a repository-supported root command for validating the committed LMS snapshot fixture contract without starting Playwright.
-   [x] Keep `lmsFixtureContract.ts` as the single product oracle and use the checker only as a tiny CLI wrapper.
-   [x] Document the standalone fixture gate in the E2E runner README in English and Russian.
-   [x] Run focused formatting, fixture contract, lint, docs, no-fork, and whitespace validation.

### Completed Slice: Generic Course Field Report Coupling

> QA Contract: represent the first Phase 9 custom-field/report coupling proof through ordinary Object components, Learning Content column presets, and records.union report projections without adding an LMS-only runtime field subsystem.

-   [x] Add one reusable Course business component to Learning Content union projections, default column settings, and the summary report filter/export path.
-   [x] Strengthen shared settings, fixture, backend report, and app-template coverage for the generic projected Course field path.
-   [x] Update Learning Content reports/docs wording so the supported Phase 9 path is explicit and does not claim a separate published-app custom-field designer.
-   [x] Run focused formatting, tests, lint/build, fixture contract, and no-fork validation for the slice.

### Completed Slice: Generic Guest Runtime Error Sanitization

-   [x] Route public guest link, session, runtime, and quiz submit errors through the shared runtime error sanitizer.
-   [x] Reuse existing localized guest error messages as safe fallbacks without changing guest-session/runtime API behavior.
-   [x] Add focused GuestApp coverage proving public alerts do not expose SQL, UUIDs, or internal relation text.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Learner Player ID Fallback Safety

-   [x] Replace learner-player user-facing row-id title fallbacks with localized untitled labels.
-   [x] Keep row IDs only as internal keys, select values, and mutation targets.
-   [x] Add English and Russian learner-player untitled fallback labels.
-   [x] Add focused widgetRenderer coverage proving missing labels and UUID-like labels do not expose UUIDs.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Runtime Record Picker Load Error Sanitization

-   [x] Route runtime record picker load failures through the shared runtime error sanitizer.
-   [x] Route relation-builder parent/panel load failures through localized sanitized runtime error surfaces.
-   [x] Keep existing localized `recordPicker.loadFailed` fallbacks in English and Russian.
-   [x] Add focused FormDialog and relation-builder coverage proving helper text, panel alerts, create errors, and delete errors do not expose SQL, relation names, or UUIDs.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Workspace Switcher ID Fallback Safety

-   [x] Replace workspace-name raw ID fallbacks with localized untitled workspace labels.
-   [x] Keep workspace IDs only as internal select values and mutation targets.
-   [x] Add focused WorkspaceSwitcher coverage proving missing names do not expose UUID-like workspace IDs.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Datasource Load Error UX Safety

-   [x] Show localized sanitized load errors for `records.list` details-table widgets.
-   [x] Show localized sanitized load errors for primary `records.union` details-table widgets.
-   [x] Add focused widgetRenderer coverage proving datasource load alerts do not expose SQL, relation names, or UUIDs.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Runtime Workspaces Raw-ID And Error Leakage Safety

-   [x] Replace Runtime Workspaces page name/member fallbacks that expose workspace IDs or user IDs with localized labels.
-   [x] Route unknown workspace mutation errors through the shared runtime error sanitizer.
-   [x] Add focused RuntimeWorkspacesPage coverage proving workspace IDs, user IDs, SQL, relation names, and UUIDs are not visible in fallback/error states.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Workflow Row-Action Label Fallback Safety

-   [x] Replace workflow action menu fallback labels that expose action codenames with localized generic labels.
-   [x] Replace workflow confirmation fallback title, message, and confirm labels that expose action codenames with localized generic labels.
-   [x] Keep action codenames only in internal payloads and stable test IDs.
-   [x] Add focused RowActionsMenu coverage proving action codenames are not visible when metadata labels are missing.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Runtime Record Picker ID Fallback Safety

-   [x] Replace runtime record picker option fallbacks that expose row IDs with localized untitled record labels.
-   [x] Keep row IDs only as internal select values and mutation payloads.
-   [x] Add focused FormDialog record picker coverage proving UUID-like row IDs are not visible when label fields are missing.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Details Tabs And Sequence Label Fallback Safety

-   [x] Replace details-tabs missing-label fallbacks that expose tab IDs with localized tab labels.
-   [x] Replace sequence locked-by fallbacks that expose step IDs with safe prerequisite labels.
-   [x] Add focused widgetRenderer coverage proving raw tab IDs and UUID-like step IDs are not visible.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Relation Builder And Runtime List Fallback Safety

-   [x] Replace relation-builder wizard step and panel label fallbacks that expose raw IDs with localized safe labels.
-   [x] Replace generic runtime card/table row label fallbacks that expose row IDs with localized safe labels.
-   [x] Add focused runtime UI coverage proving missing labels do not expose raw IDs.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Runtime Flow-List Cell Display Safety

-   [x] Replace default flow-list description rendering that can expose raw JSON/object values with safe runtime formatting.
-   [x] Replace custom flow-list cell fallback rendering that can expose raw JSON/object values with safe runtime formatting.
-   [x] Add focused runtime UI coverage proving custom/default cells do not expose raw IDs, raw JSON, or object placeholders.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Runtime Chart Axis Display Safety

-   [x] Replace runtime chart x-axis fallback formatting that can expose raw JSON/object/UUID values with safe runtime formatting.
-   [x] Add focused MainGrid coverage proving chart axis data does not expose raw IDs, raw JSON, or object placeholders.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Runtime Chart Metric Value Display Safety

-   [x] Sanitize configured runtime chart metric values before passing them to chart components.
-   [x] Preserve computed chart totals when configured metric values are unsafe or absent.
-   [x] Add focused MainGrid coverage proving chart values do not expose raw IDs or runtime JSON.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Runtime DataGrid Cell Display Safety

-   [x] Replace default runtime DataGrid cell formatting that can expose raw UUID values with safe runtime formatting.
-   [x] Keep localized/object labels readable while suppressing raw JSON, UUID strings, and object placeholders.
-   [x] Preserve REF option-label fallback when REF object labels are unsafe.
-   [x] Add focused `toGridColumns` coverage for default, semantic long-text, and REF object cells.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Runtime Stat Card Metric Value Display Safety

-   [x] Sanitize configured overview stat-card metric values before rendering.
-   [x] Preserve existing fallback values when configured stat-card metric values are unsafe.
-   [x] Add focused MainGrid coverage proving stat-card values do not expose raw IDs or runtime JSON.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Runtime Quiz Widget Text Display Safety

-   [x] Sanitize quiz widget title, description, question, option, feedback, and empty-state text before rendering.
-   [x] Preserve readable plain/localized quiz content while suppressing raw UUID, runtime JSON, and object placeholders.
-   [x] Keep quiz question and option IDs only as internal answer keys and mutation payloads.
-   [x] Add focused QuizWidget coverage proving unsafe runtime text does not leak to users.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Runtime Object Display-Key Fallback Safety

-   [x] Stop treating object-only `codename` and `id` fields as normal user-facing display labels.
-   [x] Preserve explicit human labels from `label`, `name`, `title`, and `displayName`.
-   [x] Add focused display formatter and DataGrid coverage proving object-only codenames/IDs are suppressed.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Resource Preview Title And Description Safety

-   [x] Sanitize `ResourcePreview` title and description before rendering.
-   [x] Preserve readable title/description text and the existing default title fallback.
-   [x] Add focused ResourcePreview coverage proving UUID/runtime JSON captions do not leak.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Records Union Card-Mode Display Safety

-   [x] Sanitize records-union card title and description values with the shared safe runtime display formatter.
-   [x] Preserve readable card labels while replacing unsafe/missing values with localized untitled labels.
-   [x] Add focused widgetRenderer card-mode coverage proving embedded UUID/runtime JSON/object text does not leak.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Form Dialog JSON Field Display Safety

-   [x] Stop rendering raw JSON strings for normal JSON fields without an approved runtime widget.
-   [x] Preserve specialized `resourceSource` and `editorjsBlockContent` JSON widgets.
-   [x] Add focused FormDialog coverage proving plain JSON payloads do not leak.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Localized Inline Validation Helper Safety

-   [x] Replace technical `min:` and `max:` helper text with localized user-facing length helper text.
-   [x] Apply the same helper contract to simple, versioned, and localized inline fields.
-   [x] Add focused component coverage proving raw helper prefixes do not leak.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Target Picker Option Label Safety

-   [x] Stop using object/record `Codename` fields as default user-facing target-picker labels.
-   [x] Sanitize workspace member picker names and emails before rendering share targets.
-   [x] Add focused widgetRenderer coverage proving target/share pickers do not expose UUIDs, raw JSON, or codenames.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Target And Share Mutation Error Sanitization Coverage

-   [x] Add target-field mutation error coverage proving SQL, relation names, and UUIDs do not leak.
-   [x] Add share-member mutation error coverage proving SQL, relation names, and UUIDs do not leak.
-   [x] Preserve existing sanitized alert behavior without changing API payloads.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Workspace Invite Email Validation

> UI Contract: workspace owners invite members through the existing email field and MUI dialog; invalid email input is blocked with localized field feedback before a runtime member mutation is sent.

-   [x] Validate workspace invite email input against the shared email contract before mutation submission.
-   [x] Render localized invite email validation feedback through the existing MUI field surface.
-   [x] Add focused RuntimeWorkspacesPage coverage proving invalid email input does not submit.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Tabular Fetch Error Sanitization

-   [x] Route TABLE child-row fetch errors through the shared runtime error sanitizer.
-   [x] Add localized English and Russian `tabular.errorFetch` messages.
-   [x] Add focused component coverage proving fetch failures do not expose SQL, UUIDs, or backend relation text.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Report Table Technical Column Safety

-   [x] Filter unsafe technical report columns before rendering normal saved-report DataGrid surfaces.
-   [x] Preserve explicitly human report labels for resolved technical references such as Project while hiding raw target/source/system columns.
-   [x] Humanize report column fallback headers instead of exposing raw field keys.
-   [x] Add focused widgetRenderer coverage for saved reports with technical fields, resolved labels, raw UUIDs, and structured payloads.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Ledger Table Technical Field Safety

-   [x] Filter technical ledger datasource columns before rendering normal runtime DataGrid surfaces.
-   [x] Replace ledger cell formatting with safe runtime value formatting so raw JSON, UUIDs, and object placeholders are suppressed.
-   [x] Humanize ledger column headers instead of exposing raw field keys.
-   [x] Preserve stable DataGrid row identities even when ledger payloads contain an `id` field.
-   [x] Add focused widgetRenderer coverage for ledger facts and projections with technical fields and structured payloads.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Tabular String Object Display Safety

-   [x] Replace `STRING` tabular object-value stringification with the shared safe runtime display formatter.
-   [x] Keep localized string values readable while suppressing raw JSON, UUID, and object-placeholder output in tabular cells/editors.
-   [x] Normalize localized `STRING` tabular values from safe display text instead of `String(object)`.
-   [x] Harden unresolved tabular `REF` formatter fallback so missing option labels do not expose raw IDs.
-   [x] Add focused tabular formatter/render coverage for label objects, raw resource JSON strings, opaque objects, and localized normalization.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Runtime Technical Column Safety

-   [x] Filter technical runtime columns out of normal current-object and records-list grid column sets, even when metadata presets try to make them visible.
-   [x] Keep action/control columns available while preventing `*Id`, owner/principal, JSON payload, and `_upl_*` fields from entering user-facing column controls.
-   [x] Align reorder flow-list cells with safe runtime value formatting so structured values do not render raw payloads.
-   [x] Add focused helper, MainGrid, and widgetRenderer coverage for metadata/local preference hardening.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Resource Source Type Selector Labels

-   [x] Replace raw resource type fallback labels in the `resourceSource` authoring selector with safe localized labels.
-   [x] Apply the same safe label fallback to create-target policy disabled reasons.
-   [x] Add focused FormDialog and widgetRenderer coverage proving Page/Link labels are user-facing and raw `url`/`embed` codenames are not used as reasons.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Resource Preview Title Wrapping

-   [x] Let long `ResourcePreview` titles wrap inside the existing MUI preview surface instead of truncating them with `noWrap`.
-   [x] Preserve compact preview layout using existing MUI primitives and responsive text wrapping without adding new UI.
-   [x] Add focused component coverage proving the preview title no longer uses the MUI no-wrap class.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Resource Preview Type Labels

-   [x] Replace raw `ResourceSource.type` captions in `ResourcePreview` with localized resource type labels.
-   [x] Add focused component coverage proving URL resources render as Link and deferred SCORM stays explicit without raw lowercase codenames.
-   [x] Keep the change generic and reuse existing `resourceSource.types.*` i18n keys without adding LMS-only runtime code.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Learning Content Create Menu Deferred Package Evidence

-   [x] Assert the disabled Import package create target reason in fixture-contract and template manifest coverage.
-   [x] Extend runtime create-menu browser expectations so Package import is visibly deferred with a localized reason.
-   [x] Update Learning Content docs to document the deferred package-import target alongside deferred assessments.
-   [x] Run focused formatting, fixture-contract, manifest/app-template tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Resource Preview Domain Badge

-   [x] Add a safe domain badge to the generic `ResourcePreview` for URL-backed ready resources.
-   [x] Reuse existing MUI primitives and shared safe URL parsing without exposing raw resource-source payloads or validator internals.
-   [x] Add focused component coverage for link/domain rendering and unsafe URL fail-closed behavior.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Generic Create Target Capacity Hardening

-   [x] Raise the generic `detailsTable.createTargets` schema capacity so LMS Learning Content is not capped at its current eight-item menu.
-   [x] Keep the create menu on existing MUI primitives with disabled reasons and no LMS-only runtime branch.
-   [x] Add focused schema coverage for accepting more than eight create targets while preserving validation of invalid targets.
-   [x] Run focused formatting, tests, lint/build, no-fork, and whitespace validation.

### Completed Slice: Deferred Assessment Create Targets

-   [x] Expose Quiz-lite and Assignment-lite as disabled metadata-defined Learning Content create targets.
-   [x] Keep those targets on the existing generic `detailsTable.createTargets` contract with localized deferred reasons and no LMS-only runtime branch.
-   [x] Strengthen fixture/widget/docs coverage so the create menu is honest about currently deferred assessment authoring.
-   [x] Regenerate or validate the LMS snapshot through the product Playwright generator when metadata changes require fixture updates.
-   [x] Run focused formatting, tests, lint/build, no-fork, fixture, docs, and whitespace validation.

### Completed Slice: Generic Report Runtime Filters

-   [x] Accept ad hoc report filters in the generic run/export report API payloads.
-   [x] Apply report DataGrid filters to saved report run and export without LMS-only runtime branches.
-   [x] Merge ad hoc filters with saved report filters and datasource filters at the backend boundary.
-   [x] Add focused backend/API/widget coverage proving report filters are sent, validated, applied, and exported.
-   [x] Run focused formatting, tests, lint/build, no-fork, fixture, and whitespace validation.

### Completed Slice: Generic Report Error UX Safety

-   [x] Show a localized report-load error state instead of leaving failed report tables looking empty or stuck.
-   [x] Sanitize report run/export errors through the shared runtime error helper before rendering them.
-   [x] Add focused app-template coverage for report run and export failures without leaking SQL, UUIDs, or backend details.
-   [x] Run focused formatting, app-template tests, lint/build, no-fork, fixture, and whitespace validation.

### Completed Slice: Generic Records List Column Preset Parity

-   [x] Apply `details.tableDefaults.columnPreset` to generic `records.list` details-table columns.
-   [x] Preserve sequence runtime columns and row-reordering flow-list behavior while filtering technical configured columns.
-   [x] Add focused app-template coverage for hidden technical records-list columns.
-   [x] Run focused formatting, app-template tests, lint/build, no-fork, fixture, and whitespace validation.

### Completed Slice: Report Export Filename User Label Contract

-   [x] Build CSV export filenames from localized report titles instead of technical report codenames.
-   [x] Keep `reportCodename` as the API identifier only and preserve fallback behavior when a title is unavailable.
-   [x] Add focused app-template coverage for the report export filename contract.
-   [x] Run focused formatting, app-template tests, lint/build, docs/no-fork, and relevant fixture checks.

### Completed Slice: Saved Report Widget Codename Contract

-   [x] Add a generic `detailsTable.reportCodename` contract for saved report widgets.
-   [x] Keep existing inline `reportDefinition` support for compatibility while preferring saved report references.
-   [x] Convert LMS Course Builder and Learning Track Builder report tabs to saved-report references only.
-   [x] Strengthen schema, app-template, fixture-contract, docs, and snapshot validation.
-   [x] Run focused formatting, tests, fixture, generator, runtime E2E, and no-fork/docs validation.

### Completed Slice: Builder Report Definition Productization

-   [x] Seed the Course Builder and Learning Track Builder report definitions that existing report widgets execute by codename.
-   [x] Keep Reports object JSON configuration fields out of normal runtime grids.
-   [x] Strengthen fixture-contract coverage for builder report definitions and hidden report JSON fields.
-   [x] Update Learning Content docs and regenerate the LMS snapshot through Playwright.
-   [x] Run focused formatting, fixture, lint/build, generator, runtime E2E, and no-fork/docs validation.

### Completed Slice: Generic Records Union Report Execution

-   [x] Reuse the generic `records.union` datasource executor for saved report run/export without adding LMS-only report code.
-   [x] Keep `records.list` reports unchanged and fail closed for unsupported union aggregations.
-   [x] Add an LMS Learning Content Summary report backed by `records.union` with safe Type/Title/Status/Project columns.
-   [x] Strengthen fixture, backend route, browser/API, docs, and snapshot validation for cross-type Learning Content reports.
-   [x] Run focused formatting, tests, lint/build, no-fork, fixture, generator, and runtime E2E validation.

### Completed Slice: Generic Records Union Target Filters

-   [x] Add a generic `records.union` target-filter metadata contract for details-table widgets.
-   [x] Render the target filter through existing MUI toolbar/select primitives without LMS-only runtime branches.
-   [x] Apply selected filters by narrowing union datasource targets and resetting pagination.
-   [x] Configure LMS Learning Content and Trash views with Resources/Courses/Tracks type filters.
-   [x] Update fixture/schema/widget/E2E/docs coverage and regenerate the LMS snapshot.
-   [x] Run focused formatting, tests, lint/build, no-fork, fixture, and E2E validation.

### Completed Slice: Generic Learner Player Settings Enforcement

-   [x] Apply existing application-level `pagePlayer` settings to the generic `learnerPlayer` widget without LMS-only branches.
-   [x] Hide learner-player outline and progress header when runtime settings disable them.
-   [x] Respect `completeButtonMode` for manual, hidden, and auto-after-open item completion.
-   [x] Keep nested Editor.js page-block previews inside learner-player from showing duplicate completion controls.
-   [x] Add focused app-template coverage for hidden outline, progress, and completion controls.
-   [x] Run focused formatting, package tests, lint, build, docs, and no-fork validation for the touched surfaces.

### Completed Slice: Generic Shared Workspace Member Row Actions

-   [x] Add a generic `library.toggle` workspace-member target contract for shared `records.union` row actions.
-   [x] Render the Share action through existing MUI dialog/select primitives with readable workspace member labels and no raw user IDs.
-   [x] Validate explicit shared principals at the backend mutation boundary for active workspace membership or application user membership.
-   [x] Configure LMS Learning Content Share metadata, update the generated snapshot, and strengthen the fixture contract.
-   [x] Add focused schema, backend, API, app-template widget, Playwright, docs, no-fork, and E2E validation for the shared-member picker.
-   [x] Stabilize dedicated local E2E API rate limits through generic env overrides without changing production defaults.

### Completed Slice: Records Union Trash Runtime E2E Stabilization

-   [x] Keep misconfigured `records.union` widgets fail-closed with a localized runtime configuration message instead of falling back to the current-object grid.
-   [x] Add a stable generic DOM marker for `records.union` table surfaces so browser tests assert the intended widget rather than internal query-key text.
-   [x] Stabilize the LMS Trash restore browser proof by deleting a Learning Content row through generic row actions before verifying Trash and restore.
-   [x] Run focused app-template tests, lint/build, docs/no-fork guards, E2E build, and the full LMS snapshot runtime Playwright flow on local minimal Supabase.

### Completed Slice: Generic Records Union Row Actions

-   [x] Add a generic row-target action contract for datasource widgets without LMS-only branches.
-   [x] Wire active `records.union` rows to existing runtime edit, copy, and delete flows through source object metadata.
-   [x] Add focused published-runtime tests for union row action delegation and target switching.
-   [x] Run focused formatting, tests, lint, no-fork, docs, fixture, build, and E2E validation for the touched surfaces.

### Completed Slice: Generic Target-Field Row Actions

-   [x] Add a generic `field.updateWithTarget` row action contract for metadata-defined target pickers.
-   [x] Wire `records.union` row menus to update a configured target field through the existing optimistic runtime row update path.
-   [x] Configure the LMS Learning Content library with a `Move to project` action backed by `ProjectId -> ContentProjects`.
-   [x] Update the LMS snapshot, fixture contract, docs, schema tests, app-template tests, and full runtime E2E proof for the target-field action.

### Completed Slice: Generic Records Union Starred Actions

-   [x] Add a generic `detailsTable.rowActions` metadata contract for personal library relation actions.
-   [x] Expose Star/Unstar in active `records.union` tables and cards through the existing row action menu, without requiring edit permissions.
-   [x] Add a server-owned runtime relation endpoint that validates the source row, workspace, authenticated user, and object `runtimeLibrary.starred` metadata before inserting or soft-deleting relation rows.
-   [x] Add generic starred state projection to server-side `records.union` rows without showing technical relation columns.
-   [x] Update the LMS template, canonical fixture, fixture contract, docs, and focused backend/app-template/schema tests.

### Completed Slice: Generic Records Union Project Labels

-   [x] Add a generic `records.union` project label projection contract without exposing raw `ProjectId`.
-   [x] Resolve configured object `REF` project fields to human-readable label objects in the server-side union datasource.
-   [x] Configure LMS Learning Content union targets to show `Project` labels while keeping technical project IDs hidden.
-   [x] Add focused schema, backend, app-template, fixture-contract, docs, formatting, lint, build, and no-fork validation for the touched surfaces.

### Completed Slice: Generic Runtime Recent Capture

-   [x] Configure Learning Content recent relations with a timestamp field through generic `runtimeLibrary` metadata.
-   [x] Persist recent-view relation facts from the server-owned content progress `view` and `complete` actions without LMS-only branches.
-   [x] Trigger page-content view persistence from the generic `PageBlocksView` runtime player surface.
-   [x] Add focused backend, app-template, fixture-contract, docs, formatting, lint, build, and no-fork validation for the touched surfaces.

### Completed Slice: Generic Runtime Recent Ordering

-   [x] Project recent-view timestamps from generic `runtimeLibrary.recent` metadata in `records.union` datasource rows.
-   [x] Sort the LMS Recent view by the projected recent timestamp instead of content title.
-   [x] Keep the projected recent timestamp human-readable in table/card surfaces without exposing relation row IDs.
-   [x] Add focused backend, app-template, fixture-contract, docs, formatting, lint, build, and no-fork validation for the touched surfaces.

### Completed Slice: Generic Runtime Shared Relation Mutation

-   [x] Extend the generic runtime library relation endpoint to support `runtimeLibrary.shared` entries without reusing the personal starred toggle semantics.
-   [x] Validate shared principals, source-row access, server-owned default access levels, and workspace membership at the backend mutation boundary.
-   [x] Update typed app-template API contracts, LMS metadata, fixture contract, and docs for the generic shared relation mutation.
-   [x] Add focused backend/API tests and run formatting, lint, build, docs, fixture, and no-fork validation for the touched surfaces.

### Completed Slice: Generic SharedAt Projection And Shared View Ordering

-   [x] Project shared relation timestamps from generic `runtimeLibrary.shared` metadata in `records.union` datasource rows.
-   [x] Sort the LMS Shared Learning Content view by the projected shared timestamp instead of title.
-   [x] Keep the projected shared timestamp human-readable without exposing access-entry row IDs or principal IDs.
-   [x] Add focused backend, fixture-contract, docs, formatting, lint/build, no-fork, and snapshot validation for the touched surfaces.

### Completed Slice: Generic Project Create Target In Learning Content Menu

-   [x] Expose `ContentProjects` through the generic Learning Content `detailsTable.createTargets` menu.
-   [x] Keep the Project target on the existing CRUD dialog path with no LMS-only runtime widget or browser-owned system fields.
-   [x] Persist a Project through the browser create dialog and verify the created `ContentProjects` row through the generic runtime API.
-   [x] Update fixture-contract, E2E canary, docs, formatting, snapshot, and focused validation for the touched surfaces.

### Completed Slice: Runtime Report REF Output Type Safety

-   [x] Fix REF report SQL projection so every `CASE` branch returns one compatible JSONB value.
-   [x] Keep unresolved REF report values safe for CSV/output formatting without leaking raw UUIDs as user-facing labels.
-   [x] Add focused service coverage and re-run the full LMS runtime canary that exposed the database type mismatch.

### Completed Slice: Runtime Safety And QA Gates

-   [x] Added a static no-fork guard for runtime LMS-specific branches in published runtime packages.
-   [x] Added GitBook local link and screenshot asset guards.
-   [x] Propagated `_upl_version` through update, delete, copy, restore, and reorder adapter contracts.
-   [x] Reworked row reorder to use per-row expected-version maps, duplicate/exact-key validation, row locks, and transaction-scoped version checks.
-   [x] Reworked restore to support a generic restore target contract with target row, workspace, object, and parent reference validation.
-   [x] Reworked Learning Content progress calls so the browser sends only an action intent and the backend owns progress percent and status.
-   [x] Added focused frontend, backend, API wrapper, app-template, docs guard, and LMS E2E validation for the implemented slice.

### Completed Slice: Generic Runtime UX Projection Hardening

-   [x] Merged `records.union` projection columns from all configured targets so Learning Content resources, courses, and tracks do not inherit only the first target's fields.
-   [x] Replaced learner player target-codename display with generic human-readable object labels.
-   [x] Hardened normal runtime value formatting so structured objects without display metadata do not render raw JSON in tables/cards.
-   [x] Restored standard `ViewHeaderMUI` toolbar actions for metadata-defined `detailsTable` widgets so published-app create actions remain available after replacing fallback current-object grids.
-   [x] Added focused app-template tests for union column merging, learner player codename leakage, structured-value formatting, and metadata-defined details-table actions.
-   [x] Revalidated the LMS snapshot import runtime flow on local minimal Supabase after the UX projection fixes.

### Completed Slice: Generic Server-Side Records Union Datasource

-   [x] Added a generic backend `records.union` datasource endpoint under the existing runtime API surface without LMS-specific branches.
-   [x] Moved Learning Content union table pagination/search/sort/filter execution from client fan-out to a typed server-side datasource request.
-   [x] Preserved existing `detailsTable`, `CustomizedDataGrid`, toolbar, column-leak filtering, and Trash restore behavior instead of adding LMS-only UI.
-   [x] Added backend route coverage for target resolution, server-side search/sort, merged response columns, synthetic row ids, and hidden source row metadata.
-   [x] Added app-template API/widget tests proving one union datasource request replaces per-target runtime list requests.
-   [x] Re-ran focused Prettier, lint, package builds, backend route tests, and app-template Vitest coverage for the implemented server-side datasource slice.

### Completed Slice: Generic Records Union Presentation Bridge

-   [x] Preserved `records.union` target presentation fields from template metadata through the published app widget request.
-   [x] Added generic server-side union projection columns for safe `type`, `title`, and `status` display without LMS-specific branches.
-   [x] Translated union projection sort/filter aliases back to per-target physical fields before backend validation and SQL generation.
-   [x] Updated generic grid columns to honor metadata sort/filter guards so non-physical projection columns cannot trigger unsupported server queries.
-   [x] Updated the LMS template and committed snapshot to use safe Learning Content union target projections and a non-raw default column preset.
-   [x] Strengthened fixture-contract checks for safe Learning Content union projections and default column presets.
-   [x] Added focused app-template, backend, fixture, lint, and build validation for the implemented presentation bridge.

### Completed Slice: Playwright Runtime Table Defaults UX Canary

-   [x] Extended the runtime UX browser helper so LMS canaries can reject visible raw UUID substrings in addition to raw UUID-only lines.
-   [x] Expanded the LMS snapshot runtime flow to prove Learning Content table defaults, card defaults, hidden `ProjectId`/`CreatedBy` columns, and no technical text leakage.
-   [x] Added desktop, tablet, and mobile screenshot capture for both Learning Content table and card default surfaces.
-   [x] Allowed `settings.learningContent` through the existing application settings API contract so control-panel Learning Content defaults can be saved without a runtime fork.
-   [x] Hardened the generic `records.union` card renderer so card mode uses semantic title/status fields and never falls back to raw runtime IDs for user-facing text.
-   [x] Revalidated the full LMS snapshot import runtime Playwright flow on local minimal Supabase after the card-default UX fix.

### Completed Slice: Generic Current-Object Card Safety

-   [x] Removed raw row-id fallbacks from the generic current-object dashboard card view.
-   [x] Filtered id-like technical columns from current-object card title and description candidates.
-   [x] Added focused app-template coverage for UUID substring suppression and localized untitled fallback behavior.
-   [x] Expanded the runtime no-LMS-fork guard to reject LMS-only widget keys and runtime UI component/file names.
-   [x] Ran focused formatting, lint, tests, build, and no-fork checks for the touched surfaces.

### Completed Slice: Runtime UX Canary Guard Tightening

-   [x] Expanded the browser technical-leakage helper to catch raw resource/media JSON keys such as `storageKey`, `mimeType`, `launchMode`, `packageDescriptor`, `recordId`, and `targetId`.
-   [x] Added a reusable DataGrid constrained-scroll assertion so wide grids may scroll internally without creating page-level overflow.
-   [x] Connected the constrained DataGrid assertion to the LMS Learning Content published table canary.

### Completed Slice: Generic Relation Builder Display Safety

-   [x] Added shared runtime display helpers for technical field names and raw resource/media JSON strings.
-   [x] Applied the helpers to relation-builder child list columns and parent labels without adding LMS-specific branches.
-   [x] Added focused app-template tests for hidden relation-builder technical columns, raw JSON suppression, and non-ID parent fallback labels.
-   [x] Added a browser relationBuilder no-leakage and viewport-overflow oracle to the LMS builder flow.
-   [x] Ran focused formatting, lint, tests, build, and no-fork validation for the touched surfaces.

### Completed Slice: Runtime Form UX Safety

-   [x] Added generic semantic long-text inference so runtime `Description`, `Summary`, `Body`, `Instructions`, `Feedback`, `Comment`, and similar string fields render as multiline controls.
-   [x] Added shared runtime mutation error sanitization and reused it in CRUD, relation-builder, workflow/reorder, and inline TABLE mutation surfaces.
-   [x] Made unavailable runtime record pickers and unconfigured generic `REF` fields fail closed with localized user-facing labels instead of exposing raw IDs.
-   [x] Added focused unit/component tests plus browser dialog no-leakage oracles for published runtime dialogs.
-   [x] Ran focused formatting, lint, tests, build, no-fork, E2E, and whitespace validation for the touched surfaces.

### Completed Slice: Legacy Concurrency Checklist Closure

-   [x] Verify that old delete/restore expected-version checklist items are already implemented at the SQL mutation boundary.
-   [x] Verify that backend tests cover stale-before-mutation and stale-between-read-and-mutation delete/restore cases.
-   [x] Verify that the LMS runtime Playwright navigation assertion is stable with the current flow.
-   [x] Close obsolete Memory Bank checkboxes and record the evidence without changing product behavior.

### Completed Slice: Generic Runtime Resource Source Policy

-   [x] Apply Learning Content resource type settings to generic runtime resource-source form controls without LMS-only UI branches.
-   [x] Pass the same resource-source policy through production runtime, standalone runtime, CRUD dialogs, and relation-builder dialogs.
-   [x] Add focused app-template coverage proving enabled types stay selectable, deferred types are disabled with user-facing text, and disabled types are hidden unless already selected.
-   [x] Run focused formatting, tests, lint/build, no-fork, docs, and whitespace validation for the touched surfaces.

### Completed Slice: Metadata-Driven Union Create Menu

-   [x] Add a generic `detailsTable`/`records.union` create-target metadata contract without LMS-only widget keys.
-   [x] Render Page, Link, Course, and Learning Track create entries through existing MUI toolbar/menu primitives.
-   [x] Open the existing CRUD form for the selected target object without route/state races and without browser-owned server fields.
-   [x] Add fixture-contract, component, ApplicationRuntime, and Playwright browser proof for the create menu.

### Completed Slice: Create-Target Form Defaults And Resource Type Presets

-   [x] Add a generic, allow-listed create-target defaults contract for safe non-server fields.
-   [x] Use the defaults so Page and Link targets preselect the expected LearningResources type/source without exposing workspace/user/system fields.
-   [x] Add focused shared-schema, frontend, fixture-contract, and browser coverage proving create-target defaults cannot set owner, workspace, progress, lifecycle, or `_upl_*` fields.
-   [x] Re-run LMS runtime browser proof for Page and Link authoring dialogs after the defaults are applied.

### Completed Slice: Auto-Resolved Page Resource Source Authoring

-   [x] Add generic metadata-driven auto page-codename derivation for `resourceSource` page drafts.
-   [x] Configure LMS Page authoring so authors fill title/body, not a raw page codename field.
-   [x] Add focused FormDialog and fixture-contract coverage for the auto-resolved page source contract.
-   [x] Update LMS runtime browser proof so Page dialogs reject the old manual codename workflow.

### Completed Slice: Generic Link Resource Domain Preview

-   [x] Add a generic, localized domain preview for valid URL resource-source drafts.
-   [x] Keep unsafe URL drafts blocked without rendering a preview or leaking raw validation internals.
-   [x] Extend focused FormDialog and LMS browser assertions for Link authoring.
-   [x] Run focused formatting, tests, lint, no-fork, fixture, and docs validation for touched surfaces.

### Completed Slice: Generic Settings-Derived Create Defaults

-   [x] Add a safe generic `contextPath` source for create-target defaults without allowing system-owned fields or unsafe path segments.
-   [x] Pass a curated Learning Content create-default context from published and standalone runtime hosts.
-   [x] Configure Course and Learning Track create targets to derive policy defaults from application settings.
-   [x] Extend schema, hook, fixture-contract, runtime host, docs, and LMS browser coverage for settings-derived defaults.
-   [x] Run focused formatting, tests, lint, no-fork, fixture, build, E2E, and whitespace validation for touched surfaces.

### Completed Slice: Generic Create-Target Resource Policy Availability

-   [x] Derive create-target menu availability from generic resource-source type policy without LMS-only branches.
-   [x] Keep disabled targets visible with localized user-facing reasons instead of silently hiding actions.
-   [x] Add focused app-template coverage for disabled, deferred, missing, and unaffected create targets.
-   [x] Run focused formatting, tests, lint, no-fork, and whitespace validation for touched surfaces.

### Completed Slice: Generic Runtime Report Export Output Safety

-   [x] Replace raw JSON object serialization in runtime report CSV output with safe human-readable formatting.
-   [x] Preserve localized text, primitive values, and safe object labels without leaking raw IDs or JSON payloads.
-   [x] Add focused service and route coverage for report export output safety.
-   [x] Run focused formatting, backend tests, lint, no-fork, docs guard, and whitespace validation.

### Completed Slice: Generic Runtime Report Primitive ID Output Safety

-   [x] Suppress primitive ID-like and UUID report values in generic CSV serialization without suppressing safe resolved object labels.
-   [x] Suppress primitive ID-like and UUID report values in generic report DataGrid cells without adding LMS-only runtime branches.
-   [x] Add focused backend and app-template tests for report primitive ID output safety.
-   [x] Run focused formatting, tests, lint, no-fork, docs guard, and whitespace validation.

### Completed Slice: Generic Runtime Report REF Label Projection

-   [x] Resolve object `REF` report columns to safe label objects through generic runtime metadata.
-   [x] Preserve fail-closed primitive ID suppression when a referenced row or display component is unavailable.
-   [x] Add focused backend service and route coverage for report REF label projection.
-   [x] Run focused formatting, tests, lint/build, no-fork, docs guard, and whitespace validation.

### Completed Slice: Generic Runtime Report REF Label Filtering

-   [x] Resolve generic report `REF` text filters through display-label joins instead of raw row ids.
-   [x] Keep report count and aggregation SQL consistent when filters depend on reference-label joins.
-   [x] Add focused backend coverage for REF label filtering without LMS-only branches.
-   [x] Run focused formatting, backend tests, lint/build, no-fork, docs guard, and whitespace validation.

### Completed Slice: Generic Trash Restore Target Picker

-   [x] Add a generic `detailsTable.restoreTarget` metadata contract for target-based restore flows.
-   [x] Render a reusable MUI restore-target picker for deleted `records.union` rows without LMS-only runtime branches.
-   [x] Configure LMS Learning Content Trash to restore records into `ContentProjects` through `ProjectId`.
-   [x] Add focused schema, app-template, fixture-contract, formatting, lint/build, no-fork, docs, and whitespace validation.

---

## Active: Runtime UI UX Quality Gate (2026-05-19)

> Goal: implement `memory-bank/plan/ai-agent-mui-ux-workflow-plan-2026-05-19.md` so agent-driven UI work gets a reusable MUI/runtime UX contract, self-contained reviewer profiles, drift checks, Playwright UX helpers, LMS canary coverage, and GitBook documentation.
> Status: completed.

### IMPLEMENT Action Plan

-   [x] Create portable `mui-runtime-ux-patterns` and `runtime-ux-qa` skills with focused references and evaluation fixtures.
-   [x] Add shared reviewer role profiles and self-contained native reviewer files for the active agent ecosystems.
-   [x] Wire the Runtime UI UX Quality Gate into PLAN, IMPLEMENT, and QA mode files without bloating root instructions.
-   [x] Add drift-control tooling and a root validation script for duplicated reviewer instructions.
-   [x] Add reusable Playwright runtime UX helpers and connect them to the LMS runtime flow.
-   [x] Strengthen LMS fixture-contract checks for the reported raw ID, raw JSON, long-text, and optional resource-source defect class.
-   [x] Add GitBook EN/RU documentation and update summaries.
-   [x] Run focused validation and update Memory Bank progress.

### QA Responsive Closure

-   [x] Add a reusable runtime UX viewport matrix helper for `1920x1080`, `768x1024`, and mobile `390x844`.
-   [x] Connect the LMS runtime canary flow to the shared viewport matrix instead of checking only the default `1440x900` viewport.
-   [x] Update runtime UX skills, reviewer profiles, and GitBook docs to require the explicit viewport matrix.
-   [x] Extend drift validation so the helper, documentation, and LMS canary cannot silently drop the viewport matrix.
-   [x] Re-run focused validation.

---

## Active: LMS Learning Content V2 Implementation (2026-05-17)

> Goal: implement `memory-bank/plan/lms-learning-content-implementation-plan-2026-05-17-v2.md` as a real workspace-authored Learning Content subsystem without LMS-only runtime forks, using generic contracts, app-template MUI primitives, safe backend boundaries, Playwright-generated fixtures, tests, and GitBook documentation.
> Status: completed through the latest IMPLEMENT remediation. Shared contracts, runtime restore semantics, LMS template reshape, app-template union datasource shell, application-level Learning Content defaults, generic Trash restore action, visual resource source authoring, metadata-driven title/name sync, page outline extraction, server-owned page progress persistence, browser screenshot proof, generic outline row ordering, workspace-scoped datasource reads, metadata-defined builder tabs, inline builder linking, active-enrollment warnings, learner My Courses/My Tracks visibility, server-owned sequence progress guard, metadata-driven enrollment wizard due-date derivation, metadata-driven parent progress aggregation, explicit server-owned progress complete/recalculate actions, Playwright fixture validation, focused tests, documentation, and the final no-Modules LMS fixture remediation are implemented.

### IMPLEMENT Action Plan

#### Runtime LMS Product UX Remediation Slice

-   [x] Make optional resource-source fields quiet until a source is provided, with localized validation messages.
-   [x] Reuse existing metadata UI contracts for textarea descriptions, select defaults, hidden system fields, and clean grid columns.
-   [x] Remove editable LMS project owner IDs and rely on server-owned runtime record ownership.
-   [x] Harden relation-builder and columns-container responsive behavior so dense child tables do not create page-level horizontal scrolling.
-   [x] Regenerate the LMS snapshot and run focused app-template, metahubs, lint, build, and diff validation.

#### Final QA Concurrency And E2E Stabilization Slice

-   [x] Make runtime delete/restore expected-version checks atomic at the SQL mutation boundary.
-   [x] Add focused backend coverage for expected-version predicates on delete and restore mutations.
-   [x] Stabilize the LMS snapshot runtime Playwright navigation assertion without weakening UI coverage.
-   [x] Re-run focused backend, published-app, E2E, lint, build, docs, and DB-boundary validation.

#### Final QA Defect Remediation Slice

-   [x] Remove the active LMS auto-enrollment lifecycle script that can create invalid placeholder `default` content targets.
-   [x] Add direct backend API denial coverage for shared-viewer write attempts against runtime content rows.
-   [x] Regenerate or reconcile the LMS snapshot so the product fixture matches the active template.
-   [x] Re-run focused template/backend/app fixture validation and lint for the remediation.

#### Post-QA Learning Content Closure Slice

-   [x] Remove public guest `module` compatibility from runtime API schemas, payload types, app UI copy, and tests.
-   [x] Replace remaining active LMS Learning Content documentation/template wording that presents modules as the canonical content container.
-   [x] Close explicit Learning Content shell fixture-contract gaps where the implementation already has browser proof, and keep only intentionally deferred non-Learning-Content scope.
-   [x] Mark the V2 implementation plan as implemented instead of draft.
-   [x] Run focused lint/tests/docs/diff validation for the remediation.

#### Final QA Remediation Continuation Slice

-   [x] Remove `Modules` as a compatible LMS entity from the active template, generator, fixture contract, generated snapshot, and GitBook setup/entity docs.
-   [x] Move public guest content rows into canonical `LearningResources` with structured `ContentItems`, `TargetType: content`, and `ContentNodeIdRef`.
-   [x] Harden runtime shared-library access by preserving case-insensitive component lookup without regressing existing validation metadata.
-   [x] Reject metadata-configured content access entries outside an active workspace before any runtime insert.
-   [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` through the local-Supabase Playwright generator.
-   [x] Re-run targeted backend, metahubs, apps-template, docs, build, lint, and diff validation.

#### QA Gap Closure Slice

-   [x] Clear metadata-driven runtime record picker values when their target Object field changes.
-   [x] Add backend fail-closed validation for metadata-driven runtime record picker references.
-   [x] Add focused tests for stale picker values and invalid polymorphic references.
-   [x] Re-run focused lint, typecheck, and tests for the changed packages.

#### Course Builder Continuation Slice

-   [x] Replace free-text course/track policy fields with metadata-driven select controls backed by shared LMS contracts.
-   [x] Add a generic datasource row-count warning contract to `detailsTable` and use it for large course outlines.
-   [x] Add focused shared/runtime tests for the new policy and warning behavior.
-   [x] Regenerate the LMS fixture through the Playwright generator and re-run focused validation.

#### Relation Builder Slice

-   [x] Add a generic metadata-driven relation builder widget for parent-scoped child records.
-   [x] Rewire Course Builder and Track Builder outline tabs from global child tables to parent-scoped relation builders.
-   [x] Reuse existing CRUD dialogs, record pickers, and row-ordering primitives for inline child create/edit/delete/reorder flows.
-   [x] Add focused shared/runtime tests and browser proof that child rows are scoped to the selected parent record.
-   [x] Regenerate the LMS fixture through the Playwright generator after the template changes.

#### Manual Enrollment Foundation Slice

-   [x] Add generic relation-builder defaults so scoped child records can be created with safe metadata-defined initial values.
-   [x] Rewire Course Builder and Track Builder enrollment tabs to scoped relation builders over the shared Enrollments Object.
-   [x] Replace module-only enrollment targeting with polymorphic `TargetType`/`TargetId` support and move the canonical LMS fixture to `ContentNodeIdRef`.
-   [x] Remap polymorphic enrollment targets during workspace seed creation for module, course, and track records.
-   [x] Add browser screenshot coverage for active enrollment warnings on Course Builder and Track Builder enrollment tabs.

#### Learner Visibility Slice

-   [x] Add a generic runtime datasource token for the authenticated user without introducing LMS-only backend branches.
-   [x] Add workspace seed runtime-token substitution so template rows can become user-scoped personal workspace rows.
-   [x] Seed enrollment rows with `AssignedUserId` and display-safe `TargetTitle` values for module, course, and track targets.
-   [x] Add learner-facing My Courses and My Tracks tabs to the LMS home page using existing `detailsTabs` and `detailsTable` widgets.
-   [x] Fix the published MUI dashboard so Page blocks and standalone center widgets render together.
-   [x] Add focused backend, template, app-template, fixture-contract, generator, and runtime browser validation for learner enrollment visibility.

#### Enrollment Validation Slice

-   [x] Add generic Object-level runtime date-order validation metadata.
-   [x] Enforce date-order validation on runtime create, single-field update, and bulk update before persistence.
-   [x] Configure LMS Enrollments so `DueDate` cannot be before `EnrolledAt`.
-   [x] Add focused backend proof that direct enrollment creation without `createContent` fails before runtime metadata reads.
-   [x] Add focused backend proof that invalid enrollment due dates fail before insert/update.
-   [x] Regenerate the LMS fixture through the Playwright generator and revalidate the imported runtime flow.

#### Enrollment List Tab Slice

-   [x] Reuse existing detailsTable/DataGrid primitives for Course and Track enrollment lists.
-   [x] Strengthen fixture-contract coverage for enrollment list widgets.
-   [x] Extend Playwright runtime proof for the enrollment list tab.
-   [x] Regenerate the LMS snapshot through Playwright and run focused validation.

#### Generic Sequence Availability DetailsTable Slice

-   [x] Reuse existing detailsTable/DataGrid primitives for CourseItems and TrackSteps sequence availability.
-   [x] Extend the shared sequence policy contract with parent-scoped availability grouping.
-   [x] Configure Course Builder and Track Builder completion tabs with scoped sequential availability metadata.
-   [x] Strengthen fixture-contract coverage for scoped sequence policies.
-   [x] Add focused unit coverage proving scoped rows do not lock rows from another parent course.
-   [x] Regenerate the LMS snapshot through Playwright and run focused validation.

#### Runtime Sequence Progress Guard Slice

-   [x] Add generic Object-level runtime progress sequence policy metadata.
-   [x] Enforce sequence availability before server-owned progress writes.
-   [x] Configure CourseItems and TrackSteps runtime progress sequence guards.
-   [x] Add direct API proof that locked CourseItems cannot be completed through the progress endpoint.
-   [x] Add fail-closed proof for invalid runtime progress sequence policy metadata.
-   [x] Regenerate the LMS snapshot through Playwright and run focused validation.

#### Enrollment Wizard Due-Date Derivation Slice

-   [x] Add generic metadata-driven runtime date-offset derivation for due-date fields.
-   [x] Derive hidden wizard due dates from start date plus period days and clear due dates for no-due-date mode.
-   [x] Configure LMS Enrollments to use the generic derivation without LMS-only runtime branches.
-   [x] Add focused frontend and backend coverage for period-based due-date derivation.
-   [x] Regenerate the LMS snapshot through Playwright and revalidate the imported runtime flow.

#### Parent Progress Aggregation Slice

-   [x] Add generic metadata-driven runtime parent-progress aggregation for completed child content items.
-   [x] Persist parent progress updates in the same server-owned progress store transaction as child progress writes.
-   [x] Configure LMS CourseItems to aggregate required weighted progress into Courses.
-   [x] Configure LMS TrackSteps to aggregate required step progress into LearningTracks.
-   [x] Add focused backend coverage for weighted required-only aggregation and fixture-contract coverage for aggregation metadata.
-   [x] Regenerate the LMS snapshot through Playwright and revalidate the imported runtime flow.

#### Runtime Progress Complete/Recalculate Action Slice

-   [x] Add explicit metadata-safe `update`, `complete`, and `recalculate` actions to the generic runtime progress endpoint.
-   [x] Keep existing progress updates backward compatible while deriving complete actions server-side as 100 percent completed progress.
-   [x] Recalculate parent progress only from server-owned `runtimeProgress.aggregateParents` metadata without accepting browser-supplied progress/status values.
-   [x] Add backend coverage for successful metadata-driven recalculation and fail-closed missing recalculation metadata.
-   [x] Add published-app API/widget coverage for the explicit complete and recalculation request contracts.
-   [x] Re-run focused backend/frontend tests, lint, and package builds for the changed packages.

#### Runtime Copy Relations Slice

-   [x] Add generic metadata-driven `runtimeCopy.relations` support for runtime record copy commands.
-   [x] Configure Courses so copy duplicates CourseSections and CourseItems while remapping CourseItems.SectionId to the copied CourseSections.
-   [x] Configure LearningTracks so copy duplicates TrackStages and TrackSteps while remapping TrackSteps.StageId to the copied TrackStages.
-   [x] Keep enrollments, learner progress, reports, and linked learning resources out of default course/track copies unless metadata explicitly opts them in.
-   [x] Add focused backend coverage for course outline copy semantics and no-copy enrollment/progress/report safety.
-   [x] Strengthen the LMS fixture contract, regenerate the snapshot through Playwright, and revalidate the imported runtime flow.

#### Runtime Copy UI Integration Slice

-   [x] Route published-app Copy actions through the generic runtime copy endpoint instead of recreating rows with `createRow`.
-   [x] Preserve copy dialog override values while still invoking backend `runtimeCopy.relations` for metadata-defined outline relations.
-   [x] Pass `_upl_version` as `expectedVersion` for copy operations when the row exposes optimistic version metadata.
-   [x] Add backend coverage for copy overrides and stale-version copy rejection before insert.
-   [x] Add published-app API and hook coverage for copy endpoint body, optimistic pending rows, and expected-version propagation.
-   [x] Re-run focused tests, lint, and builds for the affected backend and published-app packages.

-   [x] Phase 0: freeze Learning Content V2 scope and extend acceptance gates.
-   [x] Phase 1: add strict shared Learning Content contracts and union datasource schema.
-   [x] Phase 2: harden generic runtime trash/delete/restore semantics with fail-closed concurrency checks.
-   [x] Phase 3: reshape the LMS template around Projects, standalone resources, CourseItems, TrackStages, and TrackSteps.
-   [x] Phase 4: expose generic application settings for Learning Content defaults through existing settings surfaces.
-   [x] Phase 5: add the published Learning Content shell through existing apps-template MUI dashboard primitives.
-   [x] Phase 6: complete page authoring and standalone resource behavior with safe block/resource validation.
    -   [x] Replace raw JSON editing for `resourceSource` fields with a generic visual form editor and inline `ResourcePreview`.
    -   [x] Add focused published-app form coverage for safe URL resources, unsafe URL rejection, and page resources.
    -   [x] Add metadata-driven title/name sync with a persisted manual-edit flag for standalone Learning Resources.
    -   [x] Add shared page outline extraction and runtime outline navigation for Editor.js header blocks.
    -   [x] Add generic publication workflow for standalone resources over REF enumeration statuses.
    -   [x] Pass runtime Page blocks into the published dashboard and add Learning Content player metadata with local reading progress.
    -   [x] Add server-owned learner progress persistence through a metadata-defined progress object.
    -   [x] Add browser proof for page player progress persistence.
-   [x] Phase 7: implement the Course Builder over canonical CourseItems.
    -   [x] Add generic persisted row ordering for datasource-backed details tables and reuse it for CourseSections/CourseItems outline surfaces.
    -   [x] Add CourseSections and CourseItems scoped ordering layouts to the LMS template.
    -   [x] Add metadata-defined Course Builder detail tabs and browser screenshot proof.
    -   [x] Add inline content linking.
    -   [x] Add completion policy editing through metadata-driven selects and generic large-course warnings.
    -   [x] Add metadata-driven course copy semantics for CourseSections/CourseItems while excluding enrollments, progress, reports, and linked resource duplication by default.
-   [x] Phase 8: implement progress, completion, and learner player behavior.
    -   [x] Add generic scoped sequence availability display for CourseItems and TrackSteps through detailsTable `sequencePolicy`.
    -   [x] Add direct API locked-item rejection for metadata-configured runtime progress targets.
    -   [x] Add generic CourseItems learner player shell with parent selection, target preview, sequence lock state, and runtime progress persistence.
    -   [x] Add metadata-driven parent progress aggregation for CourseItems/Courses and TrackSteps/LearningTracks.
    -   [x] Add fail-closed explicit complete/recalculate runtime actions over the generic progress endpoint.
-   [x] Phase 9: implement the Learning Track Builder over courses and stages.
    -   [x] Reuse generic persisted row ordering for TrackStages and TrackSteps outline surfaces.
    -   [x] Add TrackStages and TrackSteps scoped ordering layouts to the LMS template.
    -   [x] Add metadata-defined Track Builder detail tabs and browser screenshot proof.
    -   [x] Add course/stage linking and sequence policy editing.
    -   [x] Add active-enrollment warnings.
    -   [x] Add metadata-driven track copy semantics for TrackStages/TrackSteps while excluding enrollments, progress, reports, and linked course duplication by default.
-   [x] Phase 10: implement manual enrollment and learner visibility.
    -   [x] Add scoped Course/Track enrollment authoring through the generic relation builder.
    -   [x] Seed course/track enrollments with due date and restrict-after-due metadata.
    -   [x] Keep module enrollment compatibility while moving the canonical target model to `TargetType`/`TargetId`.
    -   [x] Add basic learner My Courses/My Tracks visibility over current-user enrollment rows.
    -   [x] Add direct API permission proof for enrollment creation.
    -   [x] Add generic due-date ordering validation for enrollment rows.
    -   [x] Add Course/Track enrollment list tabs with generic detailsTable/DataGrid widgets.
    -   [x] Full guided Enrollment Wizard is implemented through metadata-defined relation-builder `createWizard` steps.
    -   [x] Due-for-period and no-due-date wizard parameter UX is implemented through metadata-defined date-offset derivation and clear rules.
-   [x] Phase 11: regenerate the LMS fixture only through Playwright and strengthen fixture contracts.
-   [x] Phase 12: add focused Jest/Vitest/Playwright/screenshot coverage.
    -   [x] Focused shared type, backend route, app-template API/hook/widget, metahubs template, and Playwright generator coverage added.
    -   [x] Focused application settings coverage and deleted `records.union` restore action coverage added.
    -   [x] Focused standalone resource source form coverage added.
    -   [x] Focused metadata-driven title/name sync and hidden-field grid coverage added.
    -   [x] Focused page block outline helper and runtime page rendering coverage added.
    -   [x] Browser screenshot coverage for page player progress persistence added.
    -   [x] Focused generic datasource row-ordering coverage added for the published MUI runtime.
    -   [x] Focused browser runtime flow revalidated generic Learning Content navigation, workspace-scoped detail datasources, and persisted row reordering.
    -   [x] Browser screenshot coverage for metadata-defined Course Builder and Track Builder tabs added.
    -   [x] Browser screenshot coverage for inline builder linking added.
    -   [x] Browser screenshot coverage for Course/Track active enrollment warnings added.
    -   [x] Browser runtime coverage for learner My Courses/My Tracks visibility added.
    -   [x] Focused backend coverage for direct enrollment permission and due-date validation added.
    -   [x] Focused shared/app-template/template/fixture/browser coverage for scoped sequence availability added.
    -   [x] Focused backend/template/fixture/browser coverage for server-owned sequence progress guard added.
    -   [x] Browser screenshot coverage for the CourseItems learner player added.
    -   [x] Focused backend/app-template coverage for explicit runtime progress complete and recalculation actions added.
    -   [x] Focused backend/template/fixture/browser coverage for metadata-driven course/track outline copy relations added.
-   [x] Phase 13: update GitBook documentation and package READMEs.

---

## Active: iSpring-like LMS Platform Implementation (2026-05-15)

> Goal: implement the roadmap in `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` without hardcoded LMS runtime forks, with generic platform primitives, fail-closed permissions, app-side content authoring, realistic LMS fixture generation, tests, and docs.
> Status: completed after final QA gap closure and Node 22 local Supabase E2E validation.

### Final QA Gap Closure Action Plan

-   [x] Restore backend fail-closed permission checks for runtime record posting commands before runtime table access.
-   [x] Extend the LMS acceptance matrix contract with explicit phase gates and include every declared acceptance area.
-   [x] Harden LMS fixture contract checks so unfinished scope/format areas stay explicit instead of looking complete.
-   [x] Fix the published runtime rows E2E setup so it reuses the seeded Title component instead of creating a duplicate.
-   [x] Expand LMS browser workflow coverage so every operational workflow transition uses the published UI path where the UI exposes the action.
-   [x] Add a published-app rich-content authoring browser proof through the existing generic CRUD UI.
-   [x] Refresh stale E2E documentation inventory and memory-bank traceability.
-   [x] Rerun focused backend/shared/frontend tests, lint, docs checks, and the local Supabase LMS Playwright flow under Node 22.

### QA Follow-up Remediation Action Plan

-   [x] Decouple metadata workflow actions from broad `editContent` permission in published runtime UI and backend, while preserving exact capability fail-closed checks.
-   [x] Replace native workflow confirmations with the existing MUI runtime surface and add focused component coverage.
-   [x] Extend LMS browser E2E workflow coverage with additional UI-click walkthroughs instead of API-only operational transitions.
-   [x] Align remaining Node 22 / PNPM 10 metadata and documentation references, including workspace catalog type metadata.
-   [x] Update roadmap/tasks/progress traceability after remediation and rerun focused lint/test validation.

### QA Remediation Action Plan

-   [x] Fix the red `@universo/applications-backend` route coverage for runtime scripts listing and public RPC denial semantics.
-   [x] Add Playwright browser/API proof that LMS workflow actions are hidden and rejected without role-policy capabilities, then become available after the generic capability grant.
-   [x] Re-run focused backend, shared type, published-app, block-editor, docs, and E2E validation; record the local E2E environment blocker separately from code failures.
-   [x] Update `memory-bank/progress.md` with the final QA remediation evidence.

---

## Active: Node 22 Environment And E2E Validation Remediation (2026-05-16)

> Goal: remove obsolete nvm Node versions where safe, align documentation with the current Node 22 / PNPM 10 requirement, and rerun the LMS E2E flow that was previously blocked by Node 20.

-   [x] Remove non-22 Node versions managed by nvm and confirm the active nvm/default version is Node 22.
-   [x] Audit documentation and workspace metadata for stale Node 18/20 and PNPM 9 requirements; update them to Node 22 and PNPM 10.
-   [x] Rebuild and rerun the previously blocked LMS Playwright E2E flow with Node 22 explicitly active.
-   [x] Record the validation result in `memory-bank/progress.md`.

---

## Active: LMS Final QA Remediation Follow-up (2026-05-16)

> Goal: close the latest QA findings without adding LMS-only runtime forks: keep every LMS primary section directly visible, remove stale Playwright Node 20 examples, localize generic runtime UI fallbacks, and keep workflow execution capabilities exact.

-   [x] Keep LMS Reports in the primary published-app menu and update fixture/E2E contracts.
-   [x] Remove stale Node 20 Playwright provider examples.
-   [x] Replace generic runtime UI hardcoded English fallbacks with localized keys.
-   [x] Remove broad workflow execution from the edit-content alias and update guard coverage.
-   [x] Run focused lint, unit, fixture, docs, and LMS E2E validation under Node 22.

### IMPLEMENT Action Plan

-   [x] Phase 0.5: remove `packages/apps-template-mui` runtime dependency on `@universo/template-mui` by moving required runtime UI primitives locally and adding a boundary test.
-   [x] Phase 0.6: align published runtime permissions to fail closed across wrapper/runtime/backend tests.
-   [x] Phase 1: add app-side rich block content authoring groundwork for JSON content fields without raw JSON-only authoring.
    -   [x] Extract the duplicated Editor.js implementation into a neutral shared workspace package.
    -   [x] Reuse the shared Editor.js package from both administrative and published-app UI layers without cross-package relative imports.
-   [x] Phase 2: harden shared resource URL/source validation and preview contracts for safe early formats.
    -   [x] Add shared safe URL/resource source contracts in `@universo/types`.
    -   [x] Reuse the shared URL contract from page block validation and LMS resource contracts.
    -   [x] Add a generic published-app `ResourcePreview` component with localized unsupported/deferred states.
    -   [x] Validate runtime JSON fields configured as block content or resource source on backend writes.
    -   [x] Extend LMS fixture contract coverage for realistic resource source types and unsafe/deferred boundaries.
-   [x] Phase 3: add generic sequence/completion engine groundwork and deterministic tests.
    -   [x] Extract sequence policy and completion condition contracts into a neutral shared module.
    -   [x] Add deterministic weighted progress calculation for mixed completion items.
    -   [x] Add generic completion condition evaluation for records and step collections.
    -   [x] Add generic sequence availability evaluation for free, sequential, scheduled, and prerequisite modes.
    -   [x] Reuse the shared progress helper in the existing guest module runtime path.
    -   [x] Add focused tests for progress, completion conditions, locking, and schema compatibility.
-   [x] Phase 4: add generic workflow action service groundwork with scoped permission checks, optimistic locking, audit, and direct mutation tests.
    -   [x] Extract workflow action and scoped capability contracts into a neutral shared module.
    -   [x] Add fail-closed workflow action availability evaluation for status, capabilities, and unsupported scopes.
    -   [x] Add SQL-first backend workflow action mutation with current-version requirement and workspace gating.
    -   [x] Persist workflow action audit facts in a generic runtime system table.
    -   [x] Add direct tests for safe mutation, missing capabilities, stale versions, unsupported scopes, and schema generation.
-   [x] Phase 5: replace the current LMS surrogate Knowledge/Development navigation targets with real page/object targets and fixture contract gates.
    -   [x] Add real `KnowledgeHome` and `DevelopmentHome` Page entities to the LMS template.
    -   [x] Route primary Knowledge and Development LMS menu entries to those portal pages instead of surrogate object collections.
    -   [x] Strengthen the LMS fixture contract to reject surrogate Knowledge/Development primary navigation targets.
-   [x] Phase 6: extend existing app control panel editors instead of creating duplicate UI.
    -   [x] Reuse the existing Access settings tab for role-policy validation previews.
    -   [x] Sanitize unsupported scoped active role-policy grants to fail closed settings before persistence.
    -   [x] Add TanStack Query optimistic update with rollback for general/application access settings saves.
    -   [x] Add datasource validation previews to the existing widget behavior editor.
    -   [x] Add a generic resource preview layout widget and resource display settings to the existing widget behavior editor.
    -   [x] Add validation previews for resource display settings before saving.
    -   [x] Add generic sequence-policy settings to the existing detailsTable widget behavior editor.
    -   [x] Add validation previews for sequence-policy settings before saving.
    -   [x] Add typed inline report-definition settings to the existing detailsTable widget behavior editor.
    -   [x] Add validation previews for report-definition settings before saving.
    -   [x] Run inline report definitions through the existing published-app detailsTable and reports endpoint.
    -   [x] Extend existing layout/widget dialogs for workflow actions.
    -   [x] Add validation previews for workflow settings before saving.
-   [x] Phase 7: expand operational LMS modules, including assignments, events, certificates, knowledge, development, gamification, and notifications.
    -   [x] Add a trusted runtime workflow action endpoint that resolves actions from server-side object metadata.
    -   [x] Expose metadata-backed workflow actions in the published app row actions menu.
    -   [x] Filter workflow actions through effective application/workspace capability policy.
    -   [x] Add LMS template workflow actions for assignment review, attendance, certificate issue/revoke, development tasks, and notifications.
    -   [x] Add LMS fixture contract gates for required operational workflow metadata.
    -   [x] Add Playwright runtime flows for each operational workflow.
    -   [x] Add gamification and achievement Objects, workflow actions, and deterministic fixture contract coverage.
    -   [x] Seed gamification settings, point rules, manual point adjustments, badge definitions/issues, leaderboard rows, and achievement report definitions through the LMS Playwright generator.
-   [x] Phase 8: expand generic reports, analytics, and export coverage.
    -   [x] Add generic saved-report CSV export without accepting arbitrary inline report definitions from the browser.
    -   [x] Add a published-app export helper and reuse the existing detailsTable report widget surface.
    -   [x] Add backend route, service, API, and widget tests for saved report export.
    -   [x] Add generic report aggregation metric datasources for overview cards without LMS-specific widgets.
    -   [x] Extend the existing widget behavior editor to configure saved-report aggregation metrics.
    -   [x] Add shared schema, published dashboard, and control-panel tests for report aggregation metrics.
-   [x] Phase 9: restore `packages/apps-template-mui` dashboard visual parity using existing template components and screenshot checks.
    -   [x] Align runtime record card view with the dashboard card grid by stretching `ItemCard` inside configured grid columns.
    -   [x] Align workspace dashboard metric cards with the original outlined MUI dashboard card surface.
    -   [x] Add a Playwright screenshot gate for workspace dashboard metric cards.
-   [x] Phase 10: regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only through Playwright generator for the current portal-navigation and workflow-metadata template slices.
-   [x] Phase 11: add focused unit, integration, and Playwright coverage for all implemented contracts.
    -   [x] Add committed LMS fixture unit coverage for gamification, achievements, and report rows.
    -   [x] Cover workspace dashboard metric card parity in the LMS workspace Playwright flow.
    -   [x] Replace stale LMS Playwright flow imports that still use removed Catalog helper names.
-   [x] Phase 12: update package READMEs and root `docs/` GitBook pages after implementation.
    -   [x] Update LMS resource and report GitBook pages for deferred xAPI/broad-file resources, saved report rendering, CSV export, report aggregation widgets, leaderboard reports, and achievement reports.
    -   [x] Update Ledger architecture GitBook pages so the LMS ledger set matches the current operational template.
    -   [x] Add GitBook LMS gamification and achievements guide.
    -   [x] Update `packages/apps-template-mui` package READMEs for the independent published-runtime architecture and new runtime authoring/reporting surfaces.
    -   [x] Add `@universo/block-editor` package READMEs and register the shared package in `packages/README.md`.
-   [x] Phase 13: keep SCORM/xAPI/broad file/messenger capabilities hidden or clearly unsupported until complete.
    -   [x] Model xAPI as an explicit deferred package resource type.
    -   [x] Keep storage-backed video, audio, document, and file resources valid but deferred until runtime players/importers exist.
    -   [x] Extend the LMS fixture contract and regenerate the committed fixture with a deferred xAPI placeholder.

---

## Active: Documentation Refresh Implementation (2026-05-15)

> Goal: comprehensive update of GitBook documentation in `docs/en` and `docs/ru` to match current platform state, remove non-existent functionality, add Pages entity documentation, add screenshots, and align with modern documentation patterns.
> Status: **COMPLETED** - All 6 phases successfully finished.

### Implementation Action Plan

**Phase 1: Analysis (COMPLETED via QA)**

-   [x] QA analysis completed - verified legacy terminology already removed
-   [x] QA analysis completed - verified Russian localization already complete
-   [x] QA analysis completed - verified Pages entity implementation exists
-   [x] QA analysis completed - identified 26 files to delete
-   [x] QA analysis completed - identified LMS/Ledgers screenshot gaps

**Phase 2: Content Deletion (COMPLETED - Priority 1)**

-   [x] Delete UPDL section (16 files: 8 EN + 8 RU)
    -   [x] Delete `docs/en/platform/updl/` directory (8 files)
    -   [x] Delete `docs/ru/platform/updl/` directory (8 files)
-   [x] Delete Space Builder documentation (2 files)
    -   [x] Delete `docs/en/platform/space-builder.md`
    -   [x] Delete `docs/ru/platform/space-builder.md`
-   [x] Delete Metaverses documentation (2 files)
    -   [x] Delete `docs/en/platform/metaverses.md`
    -   [x] Delete `docs/ru/platform/metaverses.md`
-   [x] Delete Analytics documentation (2 files)
    -   [x] Delete `docs/en/platform/analytics.md`
    -   [x] Delete `docs/ru/platform/analytics.md`
-   [x] Delete Working with UPDL guide (2 files)
    -   [x] Delete `docs/en/guides/working-with-updl.md`
    -   [x] Delete `docs/ru/guides/working-with-updl.md`
-   [x] Delete Multi-Platform Export guide (2 files)
    -   [x] Delete `docs/en/guides/multi-platform-export.md`
    -   [x] Delete `docs/ru/guides/multi-platform-export.md`
-   [x] Update SUMMARY.md files to remove deleted sections
    -   [x] Update `docs/en/SUMMARY.md`
    -   [x] Update `docs/ru/SUMMARY.md`

**Phase 3: Platform Section Updates (COMPLETED)**

-   [x] Update Platform README
    -   [x] Update `docs/en/platform/README.md`
    -   [x] Update `docs/ru/platform/README.md`
-   [x] Update Metahubs documentation
    -   [x] Update `docs/en/platform/metahubs.md` (add Pages and Ledgers sections)
    -   [x] Update `docs/ru/platform/metahubs.md`

**Phase 4: Create Pages Entity Documentation (COMPLETED - Priority 2 - Critical Gap Closed)**

-   [x] Create Pages entity guide
    -   [x] Create `docs/en/guides/pages-entity-type.md`
    -   [x] Create `docs/ru/guides/pages-entity-type.md`
-   [x] Add Pages guide to SUMMARY.md
    -   [x] Update `docs/en/SUMMARY.md`
    -   [x] Update `docs/ru/SUMMARY.md`

**Phase 5: Screenshot Generation (COMPLETED)**

-   [x] Set up Playwright screenshot generation (requires E2E environment)
    -   [x] Create `tools/testing/e2e/specs/generators/docs-entity-screenshots.spec.ts`
    -   [x] Implement locale switching helpers (using existing applyBrowserPreferences)
-   [x] Generate entity screenshots (EN + RU) - COMPLETED
    -   [x] Entity workspace
    -   [x] Create dialogs
    -   [x] Hub tree view
    -   [x] Resources workspace
    -   [x] Shared components, constants, values
    -   [x] Object records
    -   [x] Set fixed values
    -   [x] Enumeration option values
-   [x] Insert screenshot references into documentation
    -   [x] Added entity workspace screenshot to Pages guide (EN + RU)

**Phase 6: Final Validation (COMPLETED)**

-   [x] Verify all internal links work in documentation - VERIFIED: No broken links
-   [x] Verify EN and RU SUMMARY.md structure matches exactly - VERIFIED: Structure is identical
-   [x] Verify line counts match between EN and RU versions of all files - VERIFIED: All 72 page pairs match
-   [x] Verify screenshot references are correct - VERIFIED: Screenshots exist and are referenced
-   [x] Run documentation i18n check script - PASSED: All checks successful
-   [x] Update tasks.md and progress.md with completion

### Summary of Completed Work

**COMPLETED:**

-   ✅ Deleted 26 files of non-existent functionality documentation
-   ✅ Updated navigation (SUMMARY.md files)
-   ✅ Updated Platform overview documentation
-   ✅ Created comprehensive Pages entity guide (EN + RU, ~400 lines)
-   ✅ Generated 14 entity screenshots per locale (28 total)
-   ✅ Fixed broken links in guides README
-   ✅ Updated i18n check script configuration
-   ✅ All documentation validation checks passed
-   ✅ Closed critical documentation gap
-   ✅ Updated memory-bank/progress.md with completion record

**IMPACT:**

-   Documentation now accurately reflects platform capabilities
-   Users can learn about Pages entity type with Editor.js
-   No misleading information about non-existent features
-   Cleaner, more focused documentation structure
-   EN and RU versions fully synchronized (72 page pairs validated)
-   All internal links working correctly

---

## Current Task Ledger (Canonical)

## Active: Object Collections And Components Rename Implementation (2026-05-14)

> Goal: implement the approved rename of the current universal Catalog entity type to Objects/Object collections and replace remaining Attribute terminology with Components across templates, runtime, fixtures, tests, and docs.
> Status: completed. Final QA cleanup removed the stale test filename and the targeted MUI test-environment warnings.

-   [x] Review and approve `memory-bank/plan/object-collections-and-components-rename-plan-2026-05-14.md`
    -   Note: implementation should start by renaming Entity type capability infrastructure from `components` to `capabilities`, then proceed with the Object/Component contract.

### IMPLEMENT Action Plan

-   [x] QA closure: rename the remaining stale shared policy test file to Component terminology.
-   [x] QA closure: remove MUI warnings from TargetEntitySelector tests without weakening the real component behavior.
-   [x] QA closure: remove MUI menu anchor warnings from PublicationApplicationList tests by tightening the test double.
-   [x] QA closure: run focused backend/frontend tests, lint, and stale-term checks.
-   [x] QA closure: update Memory Bank progress with final validation evidence.

-   [x] Final QA remediation: replace stale Playwright `createLinkedCollection` usage with Object helper usage and align local variable naming in affected flows.
-   [x] Final QA remediation: update `@universo/template-mui` breadcrumb/menu tests from Catalog/LinkedCollection routes and mocks to Object routes and hooks.
-   [x] Final QA remediation: rename the public layout authoring widget catalog type to an Object-neutral available widget item type.
-   [x] Final QA remediation: run focused unit, lint, build, stale-term grep, and local Supabase Playwright validation.
-   [x] Final QA remediation: update Memory Bank progress with final closure evidence.

-   [x] QA remediation: align layout widget Object API naming, frontend query keys, mocks, and tests with the backend `/zone-widgets/object` route.
-   [x] QA remediation: remove the stale `CatalogTable.tsx` file name by publishing `ObjectTable.tsx` and make package build coverage include component barrels.
-   [x] QA remediation: replace remaining user-facing Attribute wording and stale `cat_` docs with Component/Object terminology.
-   [x] QA remediation: update stale frontend test fixtures/routes from Catalog assumptions to Object assumptions.
-   [x] QA remediation: run focused builds/tests/grep checks and update Memory Bank progress with the closure.

-   [x] Phase 1A: Rename Entity type capability infrastructure from `components`/`ComponentManifest` to `capabilities`/`EntityCapability*` across shared types, backend, DDL, snapshots, and tests.
-   [x] Phase 1B: Rename shared Attribute/FieldDefinition contracts to Component contracts in `@universo/types` and direct consumers.
-   [x] Phase 2: Update schema DDL naming, runtime metadata tables, columns, and prefix generation so Object tables use constructor/snapshot prefixes and standard Objects use `obj_*`.
-   [x] Phase 2A: Update platform system-app and migrations compiler contracts from Catalog/Attribute terminology to Object/Component terminology.
-   [x] Phase 3: Replace Catalog presets/templates with Object presets/templates in basic, basic-demo, LMS, quiz, and self-hosted fixture generation inputs.
-   [x] Phase 4: Refactor Metahubs backend routes/services/snapshot restore/export/scripts/layouts to Object/Component terminology and capability-driven behavior.
-   [x] Phase 5: Refactor Metahubs frontend by renaming existing UI surfaces, preserving current `EntityFormDialog`, tabs, tables, menus, settings, i18n, and shared selectors.
-   [x] Phase 6: Refactor Applications backend sync/runtime/workspaces/reports/scripts/ledgers to use Object/Component contracts and snapshot-provided physical table metadata.
-   [x] Phase 7: Refactor published app template runtime UI/API/types from Catalog/Attribute to Object/Component without introducing new UI shells.
-   [x] Phase 8: Regenerate Playwright product fixtures and update fixture contracts for LMS, quiz, and self-hosted apps.
-   [x] Phase 9: Add/update Jest, Vitest, Playwright, visual, local Supabase E2E, and grep-gate coverage.
-   [x] Phase 10: Update package READMEs and GitBook docs in `docs/` for Object/Component terminology.
-   [x] Phase 11: Remove temporary aliases and verify no active legacy Catalog/Attribute contract remains outside documented migration-catalog allowlists.

### Latest Validation

-   [x] `pnpm --filter @universo/metahubs-frontend test -- --runInBand LayoutDetails.cacheInvalidation LayoutDetails.inheritedWidgets queryKeys TargetEntitySelector LayoutList.copyFlow QuizWidgetEditorDialog EntityScriptsTab MetahubBoard`
-   [x] `pnpm --filter @universo/metahubs-backend test -- componentRoutes MetahubComponentsService systemComponentSeed layoutsRoutes entityInstancesRoutes fixedValuesRoutes EntityDeletePatterns SnapshotRestoreService snapshotLayouts`
-   [x] `pnpm --filter @universo/applications-backend test -- applicationReleaseBundle syncLayoutPersistence syncLayoutMaterialization runtimeRowsController applicationWorkspaces publicRuntimeAccess applicationsRoutes`
-   [x] `pnpm --filter @universo/apps-template-mui build`
-   [x] `pnpm --filter @universo/metahubs-frontend build`
-   [x] `pnpm --filter @universo/apps-template-mui lint`
-   [x] `pnpm --filter @universo/metahubs-frontend lint`
-   [x] `git diff --check`
-   [x] Targeted `rg` audit for stale Object/Component rename terms, with only migration-catalog, ABAC, and DnD attribute allowlist hits remaining.
-   [x] `pnpm --filter @universo/applications-backend test`
-   [x] `pnpm --filter @universo/metahubs-backend test`
-   [x] `pnpm --filter @universo/admin-backend test`
-   [x] `pnpm --filter @universo/profile-backend test`
-   [x] `pnpm --filter @universo/start-backend test`
-   [x] `pnpm --filter @universo/auth-backend test`
-   [x] `pnpm --filter @universo/migrations-core test`
-   [x] `pnpm --filter @universo/migrations-platform test`
-   [x] Focused `@universo/core-backend` startup/publication sync Jest tests
-   [x] Builds for core backend, migrations, rest docs, admin/profile/start/auth/applications/metahubs backend packages

## Active: Dedicated E2E Supabase And Agent Playwright Guidance Implementation (2026-05-13)

> Goal: implement the approved dedicated E2E Supabase plan with separate local Docker profile, fail-closed E2E source policy, repository-specific Playwright agent guidance, tests, and EN/RU documentation.
> Status: in progress.

-   [x] Add centralized local Supabase profile model, generated E2E workdir/config, and profile-safe CLI commands
-   [x] Update env generation, E2E env loading, doctor/reset safeguards, and package scripts for dedicated hosted/local E2E modes
-   [x] Harden Playwright agent skill guidance and add tests that preserve repository-specific E2E rules
-   [x] Update README and GitBook EN/RU documentation for hosted/local dedicated E2E and discouraged shared/main modes
-   [x] Run focused tests, formatting, docs checks, and update memory-bank progress/context

## Active: Local Supabase Env Profile Generation Improvement (2026-05-13)

> Goal: make local Supabase env generation preserve the full backend env contract by deriving generated profiles from `.env` or `.env.example`, replacing only local Supabase/Postgres overrides, and documenting the workflow in EN/RU README and GitBook docs.
> Status: completed. Local Supabase env profiles now preserve the normal `.env` / `.env.example` contract and only replace local Supabase/Postgres values, with docs and tests updated.

-   [x] Update the local Supabase env generator to use `.env` as the preferred backend base, `.env.example` as fallback, and the minimal generated template only when neither exists.
-   [x] Remove obsolete local Supabase backend example duplication and align tests with the generated-profile source order.
-   [x] Update backend README and GitBook docs in English and Russian with the preserved-settings workflow, local/hosted switching, E2E behavior, and allclean local command.
-   [x] Run focused local Supabase tooling tests and update memory-bank progress/context.

## Active: Local Supabase Docker Switch Implementation (2026-05-13)

> Goal: implement a safe local Supabase Docker profile for development and E2E, including explicit env switching, doctor checks, tests, and GitBook documentation.
> Status: completed. Local Supabase can now be started through the CLI on a localhost-bound Docker network, generated local dev/E2E env profiles stay gitignored, doctor checks guard local destructive flows, and focused tests/docs cover the workflow.

-   [x] Add Supabase CLI/Docker local configuration and root scripts for init/start/status/stop/nuke without changing default remote Supabase behavior.
-   [x] Add explicit local development and E2E env profile generation with safe local-host guards and no committed secrets.
-   [x] Add `supabase:doctor` checks for Auth, REST, PostgreSQL, JWT/service-role configuration, and local Docker/CLI readiness.
-   [x] Add focused Vitest/Jest/Playwright-adjacent coverage for scripts, env switching, JWT/Auth assumptions, and command contracts.
-   [x] Update README and GitBook docs in EN/RU with local/remote switching, troubleshooting, and E2E usage.
-   [x] Run targeted validation and update memory-bank progress/context.

## Active: Scoped Widget Visibility Lint And Generic Menu Closure (2026-05-13)

> Goal: close the final QA findings by fixing frontend lint formatting and removing the remaining catalog/page-only menu item editor path in favor of generic layout-capable Entity section targets.
> Status: completed. Menu widget authoring/runtime now uses the neutral `section/hub/link` item contract, active templates and fixture contracts use `autoShowAllSections`, and the remaining catalog/page-only menu branches were removed from the editor/runtime path.

-   [x] Fix Prettier lint errors in connector diff and runtime menu components.
-   [x] Generalize menu item target editing so layout-capable Entity sections can be selected without Catalog/Page-only editor branches or legacy menu item kinds.
-   [x] Add focused regression coverage for the generic section menu item editor behavior.
-   [x] Run targeted lint/build/tests and update memory-bank progress/context.

## Active: Scoped Widget Visibility QA Closure (2026-05-13)

> Goal: close the remaining scoped widget visibility QA findings by adding centralized global-layout widget visibility management for all layout-capable Entity scopes, preserving generic scoped layout contracts, and aligning runtime startup resolution with renderable sections.
> Status: completed. Global widgets can now be managed centrally per layout-capable Entity scope, scoped layouts are auto-created on first visibility override, runtime startup lookup is aligned with renderable sections, and focused backend/frontend/build/browser validation passes.

-   [x] Add a generic backend contract to list and update global widget visibility per layout-capable Entity scope, auto-creating scoped layouts when the first override is saved.
-   [x] Add a metahub global widget visibility panel that reuses existing layout dialogs and exposes reverse scoped-layout override state without LMS-specific UI.
-   [x] Align runtime start-page lookup with renderable runtime sections so unsupported Entity tokens cannot silently fall back after being resolved.
-   [x] Add backend/frontend/browser regression coverage for centralized visibility, scoped-layout auto-creation, reverse state display, and startup token fallback behavior.
-   [x] Run focused lint/tests/Playwright validation and update memory-bank progress/context.

## Active: Scoped Layout QA Closure (2026-05-13)

> Goal: close the final QA findings for the generic scoped layout rollout by removing the remaining kind-specific startup lookup restriction and proving through browser coverage that Home-only dashboard widgets do not leak into non-Home LMS destinations.
> Status: completed. Runtime startup token lookup no longer filters candidates by Catalog/Page kinds, the resolver has focused regression coverage for generic Entity tokens, and the imported LMS runtime flow now fails if Home dashboard widgets leak into non-Home sections.

-   [x] Generalize runtime menu startup scope lookup so token resolution is not restricted to Catalog/Page objects.
-   [x] Add focused backend regression coverage for generic startup scope lookup behavior.
-   [x] Extend imported LMS Playwright coverage with explicit negative assertions and screenshot evidence for Home-only widget absence on non-Home sections.
-   [x] Run targeted tests, lint/diff checks, and update memory-bank progress/context after validation.

## Active: Scoped Layout Widget Visibility Implementation (2026-05-12)

> Goal: implement generic Entity-scoped layout overlays and widget visibility so published LMS dashboard widgets render only on configured destinations, without LMS-specific runtime forks or catalog-specific layout contracts.
> Status: completed. Generic scoped layouts now use `scopeEntityId`/`scopedLayouts`/`layoutWidgetOverrides`, LMS Home owns dashboard widgets through a Page-scoped layout, non-Home runtime sections do not inherit Home dashboard widgets, empty columns containers fail closed, and the dedicated fresh-database Entity-scoped Playwright flow passes.

-   [x] Phase 0: Capture and verify the current layout/snapshot/schema baseline and remaining catalog-specific layout names.
-   [x] Phase 1: Refactor shared layout contracts from catalog-scoped fields to generic `scopeEntityId` / `scopedLayouts` / `layoutWidgetOverrides`.
-   [x] Phase 2: Refactor metahub design-time layout schema, services, snapshot export/restore, and tests to use generic scoped layout tables and capability gates.
-   [x] Phase 3: Refactor application runtime layout schema, sync materialization, persistence store, runtime layout selection, and snapshot hashing.
-   [x] Phase 4: Update existing layout/widget editor UI, query keys, i18n, and runtime MUI rendering guards without adding LMS-only UI.
-   [x] Phase 5: Rebuild the LMS template/generator/fixture contract so Home gets scoped dashboard widgets and non-Home sections do not inherit them.
-   [x] Phase 6: Add focused unit, backend, frontend, and Playwright coverage for scoped visibility, UUID v7 persisted rows, and LMS UX sanity.
-   [x] Phase 7: Update GitBook docs, package README notes, progress, and run targeted validation.

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
-   **LMS Lifecycle Script Seeds**: Auto-enrollment, quiz/module/certificate posting scripts seeded; ContentProgress marked transactional.
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

## Active: Local Supabase Minimal App Start Commands (2026-05-13)

-   [x] Add root app-start commands for the minimal local Supabase stack
-   [x] Keep minimal allclean behind local Supabase startup, doctor checks, and explicit local env profiles
-   [x] Cover the minimal command contract in local Supabase tool tests
-   [x] Update backend README and GitBook EN/RU quick-start/configuration docs
-   [x] Document the default local Supabase Studio URL and distinguish Studio (`:54323`) from the API (`:54321`)

## Planned: Dedicated E2E Supabase And Agent Playwright Guidance (2026-05-13)

-   [ ] Review and approve [e2e-dedicated-supabase-and-agent-playwright-guidance-plan-2026-05-13.md](plan/e2e-dedicated-supabase-and-agent-playwright-guidance-plan-2026-05-13.md)
-   [ ] Implement separate local E2E Supabase profile, source policy guards, and repository-specific Playwright skill guidance after approval

## Active: Object Collections And Components Rename Implementation (2026-05-14)

-   [x] Replace built-in Catalog terminology with Object terminology across entity templates, metahub/application snapshots, runtime schema generation, public routes, frontend i18n, and docs.
-   [x] Replace Attribute/Field Definition terminology with Component terminology across metadata services, frontend surfaces, shared resources, system tables, fixture contracts, and docs.
-   [x] Remove legacy technical names from fresh-schema targets: `_mhb_attributes`, `_app_attributes`, `cat_*`, `field-definitions`, `linked-collection(s)`, and attribute-specific system columns.
-   [x] Regenerate product fixtures through Playwright generators:
    -   LMS: `2bd91c828905339a5817ba594d94e9821f5ce3970986c299843f1731f0592da3`
    -   Quiz: `2a3f63f5304bdee9777a5c8e53f39c7be1d876c137dba8594bd328bfc40290e9`
    -   Self-hosted: `8cc2efb200d1a654e9c16dab4d298b468499449136e12ad521c6aae6582626a2`
-   [x] Validate the updated LMS fixture through full import, publication, application schema sync, workspace runtime, public guest journey, posting/unposting, and report execution.
-   [x] Regenerate GitBook screenshot assets for entity and quiz tutorial documentation.
-   [x] Run final grep audits for forbidden old identifiers and RU user-visible terminology in templates, i18n, docs, fixtures, and E2E specs.

## Completed: Object Collections QA Remediation (2026-05-14)

-   [x] Update Playwright/API runtime tests and helpers to use the Object Collection contract instead of `catalogId` and `catalog` response fields.
-   [x] Make apps-template runtime permissions fail closed when permissions are missing from the backend payload.
-   [x] Remove remaining user-facing/documentation stale Catalog/Attribute terminology found by QA.
-   [x] Fix formatting/lint quality gate issues reported by `git diff --check`.
-   [x] Run targeted unit and E2E contract validations for the remediation.
-   [x] Record the completed QA remediation in `memory-bank/progress.md`.

## Active: iSpring-like LMS Platform Implementation (2026-05-15)

-   [x] Expose metadata-backed workflow actions in published app row actions without adding LMS-specific UI.
-   [x] Resolve workflow `statusFieldCodename` to runtime column names in both frontend availability checks and backend execution.
-   [x] Keep workflow execution behind the trusted backend endpoint with CSRF, edit permission, optimistic row version checks, and server-side metadata validation.
-   [x] Add effective workflow capability maps from application role-policy rules and expose them to published runtime data.
-   [x] Filter published app workflow actions by exact `requiredCapabilities`, not only by base `editContent`.
-   [x] Cover the published app row action menu, dashboard hook workflow execution, and backend workflow route with focused tests.
-   [x] Extract the shared Editor.js runtime package and remove duplicated implementations before declaring the LMS implementation roadmap complete.
-   [x] Add metadata-driven runtime record pickers so LMS CourseItems can link to Pages, Quizzes, and StandaloneContent without raw UUID entry.

## Active: LMS Product QA Remediation (2026-05-16)

-   [x] Expose real published-app content-authoring entry points for LMS administrators instead of leaving Knowledge and Development on informational-only portal pages.
-   [x] Add Editor.js-backed runtime content fields to the LMS template and generated snapshot so app-side authors can create and edit block content without raw JSON.
-   [x] Re-align isolated `apps-template-mui` runtime cards, tables, and pagination with the original MUI/template surfaces while keeping the package boundary independent.
-   [x] Replace shallow LMS/workspace acceptance coverage with browser flows that prove authoring, block-editor persistence, and the real workspace list surfaces.
-   [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator and run focused lint/build/unit/E2E validation on local minimal Supabase.

## Completed: LMS Enrollment Wizard And Due-Date Validation Closure (2026-05-17)

-   [x] Add metadata-driven `createWizard` steps to the shared relation-builder panel contract and published `FormDialog` surface.
-   [x] Use the generic wizard for course and track enrollment creation without adding an LMS-only runtime component.
-   [x] Add generic conditional field visibility and conditional required-field handling to the published runtime form.
-   [x] Enforce enrollment due-date requirements server-side through reusable Object `runtimeValidations.requiredWhen` metadata.
-   [x] Keep enrollment create/update validation behind generic runtime permissions, backend validation, and parameterized SQL mutation paths.
-   [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator and rerun the LMS import/runtime flow on local minimal Supabase.

## Completed: LMS Catalog-Ready Course And Track Metadata (2026-05-17)

-   [x] Add a shared catalog publication policy contract for Learning Content records.
-   [x] Add catalog-ready metadata fields to LMS Courses and LearningTracks without implementing self-enrollment approval.
-   [x] Seed catalog metadata in the Playwright LMS product generator.
-   [x] Strengthen the LMS fixture contract for course/track catalog metadata.
-   [x] Regenerate the LMS snapshot through Playwright and run focused validation.

## Completed: LMS Enrollment List Tab Closure (2026-05-17)

-   [x] Reuse existing detailsTable/DataGrid primitives for Course and Track enrollment lists.
-   [x] Strengthen fixture-contract coverage for enrollment list widgets.
-   [x] Extend Playwright runtime proof for the enrollment list tab.
-   [x] Regenerate the LMS snapshot through Playwright and run focused validation.

## Completed: LMS Track Learner Player Closure (2026-05-18)

-   [x] Extend the generic `learnerPlayer` widget contract with metadata-defined static target object support.
-   [x] Reuse the existing Course Player runtime component for Learning Track playback without adding an LMS-specific widget.
-   [x] Add a Track Builder `Player` tab that scopes `TrackSteps` by `LearningTracks` and previews the linked `Courses` records.
-   [x] Persist Track Player completion against `TrackSteps` so existing parent progress aggregation can update `LearningTracks`.
-   [x] Strengthen unit, template, fixture, generator, and browser runtime coverage for the new Track Player path.

## Completed: LMS Learning Content QA Remediation (2026-05-18)

-   [x] Turn Recent, Starred, and Shared Learning Content views into real metadata-driven runtime data paths with fail-closed record access.
-   [x] Harden runtime copy and lifecycle mutations with transactional optimistic concurrency and lossless TABLE copy behavior.
-   [x] Remove obsolete LMS template remnants and keep the product fixture generated from the current metadata model only.
-   [x] Extend focused backend, frontend, and Playwright coverage for copy, library access, and regenerated LMS runtime behavior.
-   [x] Synchronize the implementation plan, docs, and progress ledger with the completed remediation.
-   [x] Close the final no-compatible-Modules QA pass by keeping `LearningResources` as the only active public content object, using remap-safe `REF` links, and validating the regenerated LMS runtime flow.

## Completed: LMS Learning Content Final QA Closure (2026-05-18)

-   [x] Replace stale LMS E2E scenarios that still depend on `Modules` with the canonical `LearningResources`/`ContentProgress` model.
-   [x] Remove stale `Modules`/`ModuleProgress` fixture names from backend/frontend tests where they describe LMS runtime behavior.
-   [x] Reconcile the V2 implementation plan checklist with the completed implementation and remaining explicitly deferred scope.
-   [x] Run focused lint/unit/E2E validation for the QA closure.
-   [x] Record the closure in `memory-bank/progress.md`.

## Completed: LMS Learning Content Runtime Table Defaults Bridge (2026-05-20)

-   [x] Add a generic `DashboardDetailsSlot.tableDefaults` contract for runtime list/card defaults without adding LMS-only widgets.
-   [x] Pass sanitized Learning Content application settings from both embedded and standalone app hosts into the published dashboard details slot.
-   [x] Apply column presets and default table/card mode through existing `MainGrid`, `detailsTable`, `records.union`, `ItemCard`, `ToolbarControls`, and `PaginationControls` primitives.
-   [x] Keep technical LMS reference columns such as `ProjectId` and `CreatedBy` hidden by default in the product column preset.
-   [x] Add focused host, dashboard, widget-renderer, column utility, and LMS platform tests for default view and column preset behavior.
-   [x] Fix the generic current-object card path so object/localized values are formatted through `formatRuntimeValue` instead of leaking `[object Object]`.
-   [x] Run focused lint, build, unit, and no-LMS-fork validation for the runtime table defaults bridge.

## Completed: Generic Runtime Table Column Visibility (2026-05-21)

-   [x] Add a generic runtime column visibility control to existing MUI toolbar primitives.
-   [x] Apply safe local column visibility preferences to current-object `detailsTable` and `records.union` DataGrid surfaces.
-   [x] Force technical runtime columns such as `ProjectId`, `TargetRecordId`, source JSON, and hidden internal fields out of the user-facing column menu.
-   [x] Keep at least one business column visible and preserve action/control columns outside normal user configuration.
-   [x] Add focused helper, runtime UI, and records.union widget tests for safe column visibility behavior.
-   [x] Run focused Prettier, apps-template tests, lint, build, no-LMS-fork, E2E, and whitespace validation.

## Completed: Generic Records Union Runtime Search (2026-05-21)

-   [x] Add a generic `showSearch` details-table metadata flag for `records.union` runtime widgets.
-   [x] Reuse the existing `ViewHeaderMUI` search control instead of adding an LMS-only toolbar or custom widget.
-   [x] Delegate runtime search to the server-side `records.union` datasource request while preserving static metadata search and resetting pagination to the first page.
-   [x] Enable search in the LMS Learning Content all/recent/starred/shared views and Trash view through template metadata.
-   [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator.
-   [x] Add schema, widget, fixture-contract, and browser E2E coverage for the generic search behavior.
-   [x] Run focused Prettier, type schema tests, apps-template tests, lint, builds, fixture contract, no-LMS-fork guard, generator, runtime E2E, and whitespace validation.

## Active: LMS Learning Content Runtime Form UX Safety (2026-05-20)

-   [x] Make semantic long-text runtime fields multiline by default without requiring LMS-specific `textarea` metadata.
-   [x] Add shared runtime mutation error sanitization so raw internal/backend details are not shown on normal user surfaces.
-   [x] Reuse the sanitizer in CRUD form/delete/reorder/workflow paths, relation-builder mutation errors, and inline TABLE editor errors.
-   [x] Add focused unit/component tests for multiline defaults, unavailable record-picker labels, and safe localized mutation errors.
-   [x] Run focused Prettier, lint, build, unit, no-LMS-fork, E2E, and whitespace validation for the new runtime form UX safety slice.

## Completed: LMS Guest Public Workspace Isolation QA Closure (2026-05-23)

-   [x] Seed LMS public guest links into a shared public workspace during the snapshot-import E2E flow and restore the main personal workspace as the default runtime workspace.
-   [x] Harden public guest runtime SQL reads so content, quiz, tabular child rows, and access-link usage updates are explicitly scoped by workspace when a public link belongs to a workspace.
-   [x] Split main-workspace and shared-public-workspace row-count assertions so guest participants, quiz responses, and content progress prove isolation instead of relying on aggregate counts.
-   [x] Prevent the MUI guest app from reusing a previous public-link session after navigating to another slug or locale.
-   [x] Add focused unit regression coverage for public-link session scoping and rerun the full local minimal Supabase snapshot-import browser flow.
