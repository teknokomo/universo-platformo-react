# Tasks

> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## Active: Flatten Base Directory Layout (2026-05-25)

> Goal: remove the unused `base/` package-root layer from all active
> workspaces, update tooling/documentation references, and prove pnpm/Turbo,
> tests, local Supabase, OpenAPI, docs, and runtime UX gates still work.

### IMPLEMENT Action Plan

-   [x] Establish the live package inventory and implementation ledger.
-   [x] Move tracked package files with `git mv`, preserve ignored local env
        profiles, and clean rebuildable generated artifacts under old `base/`
        directories.
-   [x] Rewrite workspace, root script, package config, test harness, local
        Supabase, OpenAPI, docs, agent, and manager path references.
-   [x] Add a fail-closed stale `base/` path checker covering root-relative,
        relative, and Windows-style paths.
-   [x] Regenerate workspace lock/importer metadata with `pnpm install` and
        verify pnpm/Turbo package discovery against the implementation ledger.
-   [x] Run formatting, targeted static/unit/build/docs checks, package-local
        script oracles, and local Supabase validation.
-   [x] Run local minimal Supabase Playwright evidence for smoke/runtime UX
        flows without using `pnpm dev`.
-   [x] Update Memory Bank progress and active context with the final outcome.

### Post-QA Closure Action Plan

-   [x] Remove active stale documentation that still describes package roots as
        `base/` directories.
-   [x] Extend the stale package-base checker so standalone active layout
        guidance and package tree snippets fail closed.
-   [x] Verify the new `start-frontend` views components barrel is intentional
        and required by package exports/build.
-   [x] Run formatting and focused validation after the QA follow-up fixes.
-   [x] Record the closure outcome in Memory Bank.

### Final QA Closure Action Plan

-   [x] Add the new stale-path checker and `start-frontend` views components
        barrel to the tracked change set.
-   [x] Fix the `@universo/core-backend` Jest command import regression.
-   [x] Include all flat-package Vitest configs in the root Vitest workspace.
-   [x] Wire the stale package-base guard into CI and agent verification gates.
-   [x] Strengthen local Supabase tests for exact flattened frontend env paths.
-   [x] Run formatting, focused Jest/Vitest/tooling checks, full validation,
        and local minimal Supabase Playwright smoke.
-   [x] Record the final QA closure outcome in Memory Bank.

### Final Index And Backend Matrix Closure Action Plan

-   [x] Sync the Git index with the flat package layout and include the Memory
        Bank plan, research, and implementation ledger artifacts in the tracked
        change set.
-   [x] Re-verify the root workspace development dependencies required by the
        E2E/tooling entry points after flattening.
-   [x] Run the backend Jest package matrix that was not fully covered by the
        previous QA closure.
-   [x] Re-run stale-path, formatting, and Git whitespace guards against the
        worktree and staged index.
-   [x] Record the final closure outcome in Memory Bank.

## Active: Scripts To Modules Rename (2026-05-25)

> Goal: rename the metahub attached TypeScript-code capability from Scripts/Scripting to Modules across code, database contracts, API routes, UI, i18n, fixtures, docs, and tests with no legacy compatibility layer.

### IMPLEMENT Action Plan

-   [x] Establish the implementation ledger for Scripts -> Modules rename.
-   [x] Rename shared type contracts, capability keys, package boundaries, and engine/SDK public names.
-   [x] Rename backend database tables, route families, stores, services, migrations, snapshots, template seeds, and action attachment contracts.
-   [x] Rename frontend APIs, MUI authoring surfaces, runtime widget contracts, i18n keys, and visible labels while reusing existing UI primitives.
-   [x] Rename fixtures, E2E flows, docs screenshot generators, and GitBook documentation with EN/RU parity.
-   [x] Close final rename residue in test helper names and rerun the no-legacy grep inventory.
-   [x] Run Prettier and targeted Jest/Vitest/backend/frontend/docs checks; run local minimal Supabase Playwright evidence where feasible.
-   [x] Update active context and progress with the final implementation outcome.

### QA Fix Action Plan

-   [x] Harden snapshot module restore so imported snapshots cannot bypass module compilation boundaries.
-   [x] Validate snapshot module attachment kinds with the same module attachment contract as design-time APIs.
-   [x] Remove the out-of-scope library compatibility allowance from module updates.
-   [x] Add regression tests for the QA findings and rerun focused backend verification.

### Final QA Fix Action Plan

-   [x] Enforce the runtime client-module visibility predicate on direct client bundle fetches.
-   [x] Remove unrelated deprecated snapshot compatibility aliases found during the final QA pass.
-   [x] Add regression tests and rerun focused backend/frontend/docs checks.

### Post-QA Closure Action Plan

-   [x] Update current EN/RU snapshot docs and Memory Bank architecture notes to use `sharedFixedValues` and `sharedOptionValues`.
-   [x] Fix the modules quiz runtime E2E fixture so the published runtime exercises the real client-to-server submit flow.
-   [x] Re-run focused formatting, docs, unit/build, and local minimal Supabase Playwright checks.
-   [x] Record the final closure status in Memory Bank.

## Recently Closed: LMS User Guide Screenshot QA (2026-05-24)

-   [x] Add a global duplicate screenshot gate for all localized LMS user-guide PNG assets.
-   [x] Add per-capture provenance evidence for overview and workflow-step screenshots.
-   [x] Exercise edit, copy, delete, project, report, learner, and guest flows in the Playwright screenshot generator.
-   [x] Remove user-facing implementation wording from English and Russian LMS guide pages.
-   [x] Include `check:runtime-no-lms-forks` in the LMS user-guide verification scripts.
-   [x] Normalize generated route identifiers in screenshot provenance and fail the docs check when raw route IDs remain.
-   [x] Run whole-viewport technical-leakage and DataGrid-leakage checks before every full-window screenshot.
-   [x] Add block-editor and semantic multiline dialog oracles to the LMS screenshot generator.
-   [x] Make learner-experience progress screenshots deterministic and distinct from course preview screenshots.
-   [x] Re-run the full local minimal Supabase verification pipeline after regenerating screenshots.

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
-   [x] Step 3.2: Run linting (pnpm lint) - PASSED (modules-engine fixed)
-   [x] Step 3.3: Run unit tests (pnpm test:vitest) - PASSED (911 tests, 173s)
-   [ ] Step 3.4: Run E2E smoke tests (pnpm test:e2e:smoke)
-   [ ] Step 3.5: Run Playwright flow tests (pnpm test:e2e:flows)
-   [x] Step 3.6: Verify modules engine runtime (pnpm benchmark) - PASSED (mean: 1.47ms, p95: 2.16ms)

### Validation Summary (2026-05-07)

-   Build: All 30 packages built successfully
-   Lint: Fixed prettier formatting in modules-engine
-   Unit tests: 911 tests passed across 161 test files
-   Modules engine: isolated-vm 6.x works correctly with Node.js 22
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

## Notes For The Next Session

-   Keep the active ledger centered on only genuinely new regressions
-   When one open active item closes, record the durable outcome in `progress.md` first and then update this ledger
-   `tasks.md` should remain the operational checklist, not a second full progress log
-   Do not reopen the 2026-04-13+ QA remediation waves unless fresh failing evidence appears

## Planned: Dedicated E2E Supabase And Agent Playwright Guidance (2026-05-13)

-   [ ] Review and approve [e2e-dedicated-supabase-and-agent-playwright-guidance-plan-2026-05-13.md](plan/e2e-dedicated-supabase-and-agent-playwright-guidance-plan-2026-05-13.md)
-   [ ] Implement separate local E2E Supabase profile, source policy guards, and repository-specific Playwright skill guidance after approval

## Recently Completed (Full Detail)

## Completed: LMS User Guide User-Facing Text And CI Gate Closure (2026-05-24)

> Goal: close the final LMS GitBook user-guide QA blockers by removing implementation-only screenshot markers, replacing internal/QA wording with user-facing language, and making the screenshot workflow run broadly enough to catch runtime documentation regressions.

### IMPLEMENT Action Plan

-   [x] Remove all `<!-- screenshot: ... -->` comments from English and Russian LMS user-guide Markdown while keeping visible per-step screenshots.
-   [x] Refactor `docs:lms-user-guide:check` so screenshot coverage is driven by the manifest, visible images, assets, and provenance rather than hidden Markdown comments.
-   [x] Add checker failures for TODO/FIXME/placeholder markers and user-facing technical wording such as raw ID/JSON/UUID/metahub/source-preview/row-action terminology.
-   [x] Replace internal LMS setup, source-preview, row-action, and technical-value wording in the user guide with user-facing English and Russian copy.
-   [x] Make the LMS user-guide screenshot GitHub Actions workflow run for every pull request instead of only a narrow path set.
-   [x] Run Prettier, static docs checks, and the local minimal Supabase Playwright verification after the final text/checker edits.

---

## Completed: LMS User Guide Step Screenshot And Detail Remediation (2026-05-24)

> Goal: close the QA blockers in the GitBook LMS user guide so every documented workflow step has a real localized 1920x1080 screenshot, the guide text is detailed enough for end users, and checks fail on duplicated placeholder screenshots.

### IMPLEMENT Action Plan

-   [x] Replace overview-buffer step screenshot generation with real per-step capture actions and assertions.
-   [x] Strengthen `docs:lms-user-guide:check` so duplicated step screenshots, weak manifests, and stale placeholder assets fail closed.
-   [x] Expand English and Russian LMS guide pages into detailed user-facing workflows while keeping EN/RU structural parity.
-   [x] Regenerate localized LMS guide screenshots through local minimal Supabase Playwright and verify no TanStack banner, raw IDs, raw ISO dates, or English RU fallback text.
-   [x] Fix the learner-experience screenshot flow so step 2 captures a distinct outline-item state instead of duplicating another step.
-   [x] Update screenshot manifest evidence after the EN/RU generation order changed project counts and RU guest-content assertions.
-   [x] Add a first-class LMS user-guide verify command and CI workflow that regenerate browser screenshots before running static docs checks.
-   [x] Run Prettier, docs checks, targeted lint, local minimal Supabase Playwright generator, update Memory Bank, and leave the repo ready for QA.

---

## Completed: LMS User Guide QA Remediation (2026-05-24)

> Goal: close the documentation QA blockers found after the first LMS user-guide implementation: Russian pages must be fully localized, every workflow step must show a visible GitBook image, and the docs checker must reject invisible screenshot-comment placeholders.

### IMPLEMENT Action Plan

-   [x] Localize Russian LMS user-guide boilerplate headings and role/goal labels without changing the EN/RU structural parity required by GitBook checks.
-   [x] Add visible step-level screenshot images after every numbered workflow step in EN/RU LMS user-guide pages.
-   [x] Add or generate referenced step-level screenshot assets and update the Playwright generator so regenerated docs assets keep those references valid.
-   [x] Strengthen `docs:lms-user-guide:check` so it rejects English RU boilerplate and numbered steps without adjacent visible images.
-   [x] Run Prettier, docs checks, targeted lint, and local-minimal-Supabase Playwright generator, then update `progress.md`.

---

## Completed: LMS User Guide GitBook Documentation (2026-05-24)

> Goal: implement the approved bilingual GitBook user documentation plan for the published LMS application generated from `tools/fixtures/metahubs-lms-app-snapshot.json`, including localized user-guide pages, screenshot assets, manifest-driven docs QA, and a Playwright screenshot generator that uses `1920x1080` whole-window captures by default.

### IMPLEMENT Action Plan

-   [x] Add the first-class `docs/<locale>/lms/` GitBook section and update existing LMS guides with user-guide cross-links.
-   [x] Write matching English and Russian LMS user-guide pages with task-based workflows, role assumptions, results, and localized screenshot references.
-   [x] Add localized LMS user-guide screenshot assets, a manifest, and a docs checker that enforces EN/RU parity, screenshot coverage, dimensions, no stale assets, and no technical leakage.
-   [x] Add a Playwright docs screenshot generator with local-minimal-Supabase-compatible setup, `1920x1080` capture defaults, RU fallback checks, runtime UX oracles, and toolbar/overflow guards.
-   [x] Run Prettier and targeted docs/checker/generator validation, then update `progress.md`.

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

## Completed: LMS Guest Public Workspace Isolation QA Closure (2026-05-23)

-   [x] Seed LMS public guest links into a shared public workspace during the snapshot-import E2E flow and restore the main personal workspace as the default runtime workspace.
-   [x] Harden public guest runtime SQL reads so content, quiz, tabular child rows, and access-link usage updates are explicitly scoped by workspace when a public link belongs to a workspace.
-   [x] Split main-workspace and shared-public-workspace row-count assertions so guest participants, quiz responses, and content progress prove isolation instead of relying on aggregate counts.
-   [x] Prevent the MUI guest app from reusing a previous public-link session after navigating to another slug or locale.
-   [x] Add focused unit regression coverage for public-link session scoping and rerun the full local minimal Supabase snapshot-import browser flow.

---

## Historical Tasks (Condensed) ✅

### LMS Learning Content Productization Implementation ✅ (2026-05-20)

-   Phase 0: re-audit implementation seams and add executable acceptance gates for technical leakage, static LMS-fork drift, and docs/screenshot drift.
-   Details: progress.md#2026-05-20-lms-learning-content-productization-implementation

### Remaining Product Acceptance Closure ✅ (Older)

-   Reconcile the fixture-contract acceptance matrix against the remaining Phase 1 and Phase 3-8 checklist wording.
-   Details: progress.md#lder-remaining-product-acceptance-closure

### Final Release Validation ✅ (Older)

-   Verify the executable LMS product acceptance matrix has no open gates.
-   Details: progress.md#lder-final-release-validation

### LMS Product Acceptance Matrix Reconciliation ✅ (Older)

-   Inspect `LMS_PRODUCT_ACCEPTANCE_MATRIX` through the executable fixture-contract module.
-   Details: progress.md#lder-lms-product-acceptance-matrix-reconciliation

### Knowledge Base Actionable Gate ✅ (Older)

-   Confirm Phase 1 `records.union` foundation is already server-side and covered by generic backend/app-template tests.
-   Details: progress.md#lder-knowledge-base-actionable-gate

### Reports Audited Gate ✅ (Older)

-   Mark `reports.audited` complete in the fixture contract based on existing saved-report authorization, execution, export, and runtime identifier suppression coverage.
-   Details: progress.md#lder-reports-audited-gate

### Knowledge Base Audited Gate ✅ (Older)

-   Mark `knowledgeBase.audited` complete in the fixture contract based on seeded Knowledge spaces/folders/articles/bookmarks, published-app article create/edit evidence, and generic mutation/trash lifecycle coverage.
-   Details: progress.md#lder-knowledge-base-audited-gate

### Role Visibility Scoped Gate ✅ (Older)

-   Mark `roleVisibility.actionable` and `roleVisibility.audited` complete in the fixture contract for the current supported scope: workspace membership, owner/shared record access, and fail-closed unsupported scoped role-policy rules.
-   Details: progress.md#lder-role-visibility-scoped-gate

### Standalone LMS Fixture Contract Gate ✅ (Older)

-   Add a repository-supported root command for validating the committed LMS snapshot fixture contract without starting Playwright.
-   Details: progress.md#lder-standalone-lms-fixture-contract-gate

### Generic Course Field Report Coupling ✅ (Older)

-   Add one reusable Course business component to Learning Content union projections, default column settings, and the summary report filter/export path.
-   Details: progress.md#lder-generic-course-field-report-coupling

### Generic Guest Runtime Error Sanitization ✅ (Older)

-   Route public guest link, session, runtime, and quiz submit errors through the shared runtime error sanitizer.
-   Details: progress.md#lder-generic-guest-runtime-error-sanitization

### Generic Learner Player ID Fallback Safety ✅ (Older)

-   Replace learner-player user-facing row-id title fallbacks with localized untitled labels.
-   Details: progress.md#lder-generic-learner-player-id-fallback-safety

### Generic Runtime Record Picker Load Error Sanitization ✅ (Older)

-   Route runtime record picker load failures through the shared runtime error sanitizer.
-   Details: progress.md#lder-generic-runtime-record-picker-load-error-sanitization

### Generic Workspace Switcher ID Fallback Safety ✅ (Older)

-   Replace workspace-name raw ID fallbacks with localized untitled workspace labels.
-   Details: progress.md#lder-generic-workspace-switcher-id-fallback-safety

### Generic Datasource Load Error UX Safety ✅ (Older)

-   Show localized sanitized load errors for `records.list` details-table widgets.
-   Details: progress.md#lder-generic-datasource-load-error-ux-safety

### Generic Runtime Workspaces Raw-ID And Error Leakage Safety ✅ (Older)

-   Replace Runtime Workspaces page name/member fallbacks that expose workspace IDs or user IDs with localized labels.
-   Details: progress.md#lder-generic-runtime-workspaces-raw-id-and-error-leakage-safety

### Generic Workflow Row-Action Label Fallback Safety ✅ (Older)

-   Replace workflow action menu fallback labels that expose action codenames with localized generic labels.
-   Details: progress.md#lder-generic-workflow-row-action-label-fallback-safety

### Generic Runtime Record Picker ID Fallback Safety ✅ (Older)

-   Replace runtime record picker option fallbacks that expose row IDs with localized untitled record labels.
-   Details: progress.md#lder-generic-runtime-record-picker-id-fallback-safety

### Generic Details Tabs And Sequence Label Fallback Safety ✅ (Older)

-   Replace details-tabs missing-label fallbacks that expose tab IDs with localized tab labels.
-   Details: progress.md#lder-generic-details-tabs-and-sequence-label-fallback-safety

### Generic Relation Builder And Runtime List Fallback Safety ✅ (Older)

-   Replace relation-builder wizard step and panel label fallbacks that expose raw IDs with localized safe labels.
-   Details: progress.md#lder-generic-relation-builder-and-runtime-list-fallback-safety

### Generic Runtime Flow-List Cell Display Safety ✅ (Older)

-   Replace default flow-list description rendering that can expose raw JSON/object values with safe runtime formatting.
-   Details: progress.md#lder-generic-runtime-flow-list-cell-display-safety

### Generic Runtime Chart Axis Display Safety ✅ (Older)

-   Replace runtime chart x-axis fallback formatting that can expose raw JSON/object/UUID values with safe runtime formatting.
-   Details: progress.md#lder-generic-runtime-chart-axis-display-safety

### Generic Runtime Chart Metric Value Display Safety ✅ (Older)

-   Sanitize configured runtime chart metric values before passing them to chart components.
-   Details: progress.md#lder-generic-runtime-chart-metric-value-display-safety

### Generic Runtime DataGrid Cell Display Safety ✅ (Older)

-   Replace default runtime DataGrid cell formatting that can expose raw UUID values with safe runtime formatting.
-   Details: progress.md#lder-generic-runtime-datagrid-cell-display-safety

### Generic Runtime Stat Card Metric Value Display Safety ✅ (Older)

-   Sanitize configured overview stat-card metric values before rendering.
-   Details: progress.md#lder-generic-runtime-stat-card-metric-value-display-safety

### Generic Runtime Quiz Widget Text Display Safety ✅ (Older)

-   Sanitize quiz widget title, description, question, option, feedback, and empty-state text before rendering.
-   Details: progress.md#lder-generic-runtime-quiz-widget-text-display-safety

### Generic Runtime Object Display-Key Fallback Safety ✅ (Older)

-   Stop treating object-only `codename` and `id` fields as normal user-facing display labels.
-   Details: progress.md#lder-generic-runtime-object-display-key-fallback-safety

### Generic Resource Preview Title And Description Safety ✅ (Older)

-   Sanitize `ResourcePreview` title and description before rendering.
-   Details: progress.md#lder-generic-resource-preview-title-and-description-safety

### Generic Records Union Card-Mode Display Safety ✅ (Older)

-   Sanitize records-union card title and description values with the shared safe runtime display formatter.
-   Details: progress.md#lder-generic-records-union-card-mode-display-safety

### Generic Form Dialog JSON Field Display Safety ✅ (Older)

-   Stop rendering raw JSON strings for normal JSON fields without an approved runtime widget.
-   Details: progress.md#lder-generic-form-dialog-json-field-display-safety

### Generic Localized Inline Validation Helper Safety ✅ (Older)

-   Replace technical `min:` and `max:` helper text with localized user-facing length helper text.
-   Details: progress.md#lder-generic-localized-inline-validation-helper-safety

### Generic Target Picker Option Label Safety ✅ (Older)

-   Stop using object/record `Codename` fields as default user-facing target-picker labels.
-   Details: progress.md#lder-generic-target-picker-option-label-safety

### Generic Target And Share Mutation Error Sanitization Coverage ✅ (Older)

-   Add target-field mutation error coverage proving SQL, relation names, and UUIDs do not leak.
-   Details: progress.md#lder-generic-target-and-share-mutation-error-sanitization-coverage

### Generic Workspace Invite Email Validation ✅ (Older)

-   Validate workspace invite email input against the shared email contract before mutation submission.
-   Details: progress.md#lder-generic-workspace-invite-email-validation

### Generic Tabular Fetch Error Sanitization ✅ (Older)

-   Route TABLE child-row fetch errors through the shared runtime error sanitizer.
-   Details: progress.md#lder-generic-tabular-fetch-error-sanitization

### Generic Report Table Technical Column Safety ✅ (Older)

-   Filter unsafe technical report columns before rendering normal saved-report DataGrid surfaces.
-   Details: progress.md#lder-generic-report-table-technical-column-safety

### Generic Ledger Table Technical Field Safety ✅ (Older)

-   Filter technical ledger datasource columns before rendering normal runtime DataGrid surfaces.
-   Details: progress.md#lder-generic-ledger-table-technical-field-safety

### Generic Tabular String Object Display Safety ✅ (Older)

-   Replace `STRING` tabular object-value stringification with the shared safe runtime display formatter.
-   Details: progress.md#lder-generic-tabular-string-object-display-safety

### Generic Runtime Technical Column Safety ✅ (Older)

-   Filter technical runtime columns out of normal current-object and records-list grid column sets, even when metadata presets try to make them visible.
-   Details: progress.md#lder-generic-runtime-technical-column-safety

### Generic Resource Source Type Selector Labels ✅ (Older)

-   Replace raw resource type fallback labels in the `resourceSource` authoring selector with safe localized labels.
-   Details: progress.md#lder-generic-resource-source-type-selector-labels

### Generic Resource Preview Title Wrapping ✅ (Older)

-   Let long `ResourcePreview` titles wrap inside the existing MUI preview surface instead of truncating them with `noWrap`.
-   Details: progress.md#lder-generic-resource-preview-title-wrapping

### Generic Resource Preview Type Labels ✅ (Older)

-   Replace raw `ResourceSource.type` captions in `ResourcePreview` with localized resource type labels.
-   Details: progress.md#lder-generic-resource-preview-type-labels

### Learning Content Create Menu Deferred Package Evidence ✅ (Older)

-   Assert the disabled Import package create target reason in fixture-contract and template manifest coverage.
-   Details: progress.md#lder-learning-content-create-menu-deferred-package-evidence

### Generic Resource Preview Domain Badge ✅ (Older)

-   Add a safe domain badge to the generic `ResourcePreview` for URL-backed ready resources.
-   Details: progress.md#lder-generic-resource-preview-domain-badge

### Generic Create Target Capacity Hardening ✅ (Older)

-   Raise the generic `detailsTable.createTargets` schema capacity so LMS Learning Content is not capped at its current eight-item menu.
-   Details: progress.md#lder-generic-create-target-capacity-hardening

### Deferred Assessment Create Targets ✅ (Older)

-   Expose Quiz-lite and Assignment-lite as disabled metadata-defined Learning Content create targets.
-   Details: progress.md#lder-deferred-assessment-create-targets

### Generic Report Runtime Filters ✅ (Older)

-   Accept ad hoc report filters in the generic run/export report API payloads.
-   Details: progress.md#lder-generic-report-runtime-filters

### Generic Report Error UX Safety ✅ (Older)

-   Show a localized report-load error state instead of leaving failed report tables looking empty or stuck.
-   Details: progress.md#lder-generic-report-error-ux-safety

### Generic Records List Column Preset Parity ✅ (Older)

-   Apply `details.tableDefaults.columnPreset` to generic `records.list` details-table columns.
-   Details: progress.md#lder-generic-records-list-column-preset-parity

### Report Export Filename User Label Contract ✅ (Older)

-   Build CSV export filenames from localized report titles instead of technical report codenames.
-   Details: progress.md#lder-report-export-filename-user-label-contract

### Saved Report Widget Codename Contract ✅ (Older)

-   Add a generic `detailsTable.reportCodename` contract for saved report widgets.
-   Details: progress.md#lder-saved-report-widget-codename-contract

### Builder Report Definition Productization ✅ (Older)

-   Seed the Course Builder and Learning Track Builder report definitions that existing report widgets execute by codename.
-   Details: progress.md#lder-builder-report-definition-productization

### Generic Records Union Report Execution ✅ (Older)

-   Reuse the generic `records.union` datasource executor for saved report run/export without adding LMS-only report code.
-   Details: progress.md#lder-generic-records-union-report-execution

### Generic Records Union Target Filters ✅ (Older)

-   Add a generic `records.union` target-filter metadata contract for details-table widgets.
-   Details: progress.md#lder-generic-records-union-target-filters

### Generic Learner Player Settings Enforcement ✅ (Older)

-   Apply existing application-level `pagePlayer` settings to the generic `learnerPlayer` widget without LMS-only branches.
-   Details: progress.md#lder-generic-learner-player-settings-enforcement

### Generic Shared Workspace Member Row Actions ✅ (Older)

-   Add a generic `library.toggle` workspace-member target contract for shared `records.union` row actions.
-   Details: progress.md#lder-generic-shared-workspace-member-row-actions
