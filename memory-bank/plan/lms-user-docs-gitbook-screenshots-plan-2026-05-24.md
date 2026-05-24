# LMS User Documentation GitBook Screenshots Plan - 2026-05-24

## Overview

Create a detailed bilingual GitBook user guide for the published LMS application generated from `tools/fixtures/metahubs-lms-app-snapshot.json`. The guide targets users who are already inside the created application, not platform administrators designing the metahub. It must include localized EN/RU pages, localized screenshots, whole-window `1920x1080` screenshot evidence by default, and automated documentation quality gates.

Research artifact: `memory-bank/research/lms-user-docs-gitbook-screenshot-research-2026-05-24.md`.

## Affected Areas

-   `docs/en/SUMMARY.md`
-   `docs/ru/SUMMARY.md`
-   New LMS user docs under `docs/en/lms/` and `docs/ru/lms/`.
-   Existing LMS docs under `docs/en/guides/lms-*.md` and `docs/ru/guides/lms-*.md` for cross-links and scope cleanup.
-   New localized assets under:
    -   `docs/en/.gitbook/assets/lms-user-guide/`
    -   `docs/ru/.gitbook/assets/lms-user-guide/`
-   New screenshot manifest and docs QA contract:
    -   `tools/docs/lms-user-guide-screenshot-manifest.json`
    -   New `tools/docs/check-lms-user-guide-docs.mjs`
-   Playwright screenshot generator:
    -   New `tools/testing/e2e/specs/generators/docs-lms-user-guide-screenshots.spec.ts`
    -   Shared docs screenshot helper if duplication with existing generators becomes significant.
    -   Existing `tools/testing/e2e/specs/generators/docs-pages-lms-screenshots.spec.ts` usage comments and scope, because it currently looks like an LMS generator but does not generate the new LMS user-guide assets.
-   Documentation checks:
    -   `tools/docs/check-i18n-docs.mjs`
    -   `tools/docs/check-gitbook-links.mjs`
    -   `tools/docs/check-gitbook-screenshot-assets.mjs`
    -   New `tools/docs/check-lms-user-guide-docs.mjs`
-   Package scripts in `package.json` if a new docs QA command is added.

## Architecture And Product Placement

-   The documentation must describe the published LMS application workspace layer, not the metahub authoring layer.
-   Metahub/application control-panel concepts appear only as prerequisites or references.
-   Learning Content projects are content containers inside the application workspace, not platform workspaces.
-   User-authored LMS data must be explained as workspace-scoped application content.
-   The guide must not document LMS-only implementation shortcuts or internal metadata names as user workflows.

## UI Contract

-   Default documentation viewport: `1920x1080`, light theme.
-   Default screenshot type: whole-window viewport screenshot (`page.screenshot`, `fullPage: false`) so the sidebar, page context, and modal placement are visible.
-   Exceptions:
    -   Full-page screenshots only for long learner pages where vertical continuity matters.
    -   Element screenshots only for deliberate close-up callouts, paired with a whole-window screenshot of the same dialog/state.
-   Every screenshot must use user-friendly visible data, not `E2E ...` names, UUIDs, raw ISO dates, raw JSON, or internal field names.
-   EN docs must use EN UI and EN screenshots; RU docs must use RU UI and RU screenshots.
-   Dialog screenshots must show the modal in the application context, not only the cropped dialog, unless explicitly marked as a detail image.
-   TanStack Query Devtools must be disabled and asserted absent before screenshots are saved.
-   Controls in screenshots must be stable and readable: no overlapping buttons, no page-level horizontal overflow, no clipped text in primary workflows.
-   Every procedural step in Markdown must map to a manifest screenshot ID or explicitly state `screenshot: none` with a reason.
-   Every screenshot manifest entry must be referenced by exactly one localized Markdown page, except deliberate shared orientation screenshots listed in the manifest.
-   Cropped/detail screenshots are allowed only with `captureMode: detail` and a `pairedContextId` that points to a whole-window `1920x1080` screenshot of the same dialog or state.
-   RU screenshots must define required Russian visible labels and forbidden English fallback patterns for the captured state.
-   Runtime UI states used for documentation must satisfy the runtime quality gate: no editable raw IDs, no hidden-knowledge workflows, no raw JSON/object cells, no `[object Object]`, no internal field names, no raw Zod/internal validation messages, and no raw ISO date/time values.
-   Semantic long-text fields such as descriptions, instructions, feedback, comments, and Editor.js/body content must use multiline controls by default.
-   Page-level horizontal overflow is forbidden. Table/DataGrid horizontal scrolling is acceptable only inside the table/grid container and must not move the full page.
-   If screenshot generation exposes a runtime UI defect, the implementation fix must reuse existing `apps-template-mui` and dashboard primitives before adding new LMS-only UI.

## Runtime UI Contract Matrix

The screenshot generator and focused runtime checks must cover these surfaces with explicit Playwright oracles before saving documentation screenshots:

-   Application shell and dashboard:
    -   localized sidebar, workspace selector, dashboard cards, and common controls;
    -   no TanStack/React Query Devtools launcher;
    -   no page-level horizontal overflow at `1920x1080`, `768x1024`, and `390x844`.
-   Learning Content library:
    -   search, type filter, create button, columns button, view toggles, table view, and card view;
    -   toolbar controls have aligned heights, no overlap, no inline overflow, and fit inside the viewport;
    -   DataGrid/table/card cells expose user-facing values only, with constrained internal scroll when needed.
-   Project workflows:
    -   create, edit, copy, move content between projects, delete, restore, and empty-trash confirmations;
    -   user-facing project names, no raw owner/user/reference IDs, localized validation in EN/RU.
-   Page and link resource workflows:
    -   create/edit forms, EN/RU title fields, source settings, Editor.js content, preview/open action, URL validation, and saved detail view;
    -   body-like fields are multiline or block-editor controls, not single-line inputs;
    -   resource-source metadata is rendered as user-facing labels, not raw JSON.
-   Course builder:
    -   create/edit shell, sections, course items, ordering, publish/status fields, learner player entry, copy/delete paths;
    -   relation pickers display titles, not internal IDs.
-   Learning track builder:
    -   create/edit shell, stages, steps, ordering, learner player entry, copy/delete paths;
    -   relation pickers display titles, not internal IDs.
-   Learner, guest, knowledge, reports, recent, favorites, sharing, and trash flows:
    -   each documented path has at least one success-state screenshot and one validation/error-state check where the UI can fail safely;
    -   report export and guest completion are tested through user-facing controls.
-   Keyboard path:
    -   primary create/edit dialogs and destructive confirmations must be reachable and operable by keyboard-visible focus order, not only mouse clicks.

## Plan Steps

### Phase 1: Documentation Inventory And Information Architecture

-   [x] Audit current LMS docs and classify each page as user guide, admin/setup guide, or architecture/reference.
-   [x] Use `docs/<locale>/lms/` as the final first-class location for the new user guide.
-   [x] Add a first-class GitBook section named `LMS User Guide` / `Руководство пользователя LMS` to both SUMMARY files.
-   [x] Define user roles and permission assumptions for each page: workspace owner, teacher/content author, learner, guest, and report viewer.
-   [x] Define the page set:
    -   `README.md` - orientation and roles.
    -   `getting-around.md` - sidebar, workspace selector, dashboard, common controls.
    -   `learning-content-library.md` - Learning Content overview, search, filters, table/card views, columns.
    -   `projects.md` - create/edit projects and move content between projects.
    -   `resources-pages-links.md` - create page/link resources, Editor.js body, source preview, validation.
    -   `courses.md` - course shell, sections, course items, learner player.
    -   `learning-tracks.md` - track stages, track steps, order policy, learner player.
    -   `sharing-recent-favorites-trash.md` - recent, favorites, shared content, delete and restore.
    -   `learner-experience.md` - opening content, progress, completion.
    -   `knowledge.md` - knowledge articles/folders/bookmarks if visible in the shipped app.
    -   `reports.md` - running reports, filters, CSV export, reading results.
    -   `guest-access.md` - guest link entry, learning flow, completion.
    -   `troubleshooting.md` - common safe user-level problems and fixes.
-   [x] Keep existing `guides/lms-*.md` as setup/reference pages and add links to the new user guide.

### Phase 2: Screenshot Scenario Design

-   [x] Build a screenshot manifest with stable screenshot IDs, EN/RU filenames, page ownership, target route, viewport, and allowed exceptions.
-   [x] Use this minimum manifest schema for every screenshot:
    -   `id`;
    -   `locale`;
    -   `docPage`;
    -   `heading`;
    -   `workflowStepId`;
    -   `route`;
    -   `state`;
    -   `captureMode`;
    -   `expectedDimensions`;
    -   `pairedContextId`;
    -   `requiredVisibleText`;
    -   `forbiddenVisibleText`;
    -   `viewportMatrixRequired`.
-   [x] Add Markdown workflow step markers that reference manifest IDs, so the checker can prove `Markdown -> manifest -> generated asset` coverage.
-   [x] Use visible documentation-friendly names:
    -   Application: `Learning Portal` / `Учебный портал`.
    -   Workspace: `Main` / `Основное`.
    -   Project examples: `Requirements Library`, `Onboarding Program` / `Библиотека требований`, `Программа адаптации`.
    -   Course examples: `Compliance Refresh Course` / `Курс обновления требований`.
    -   Track examples: `New Learner Onboarding Track` / `Трек адаптации нового учащегося`.
-   [x] Ensure no visible `E2E`, random run IDs, UUID-only labels, raw JSON, or raw ISO timestamps appear before screenshots.
-   [x] Prefer screenshots that show the user action result, not only empty screens.
-   [x] Include at least one screenshot for every documented procedural step unless the manifest explicitly marks the step as non-visual.
-   [x] Define RU required labels and forbidden English fallback text for each RU screenshot state.

### Phase 3: Screenshot Generator Implementation Plan

-   [x] Add `docs-lms-user-guide-screenshots.spec.ts` under `tools/testing/e2e/specs/generators/`.
-   [x] Reuse the existing E2E runner and authentication setup; do not use `pnpm dev`.
-   [x] For local E2E runs, use the dedicated minimal local Supabase profile (`pnpm supabase:e2e:start:minimal` and the local-supabase E2E wrappers).
-   [x] Set docs screenshot viewport explicitly to `1920x1080` inside the generator or a shared helper.
-   [x] Do not change the global Playwright default viewport yet, because the general suite currently depends on `1440x900` and visual snapshots may change.
-   [x] Force Query Devtools off for the docs generator environment and assert no visible TanStack/React Query devtools launcher before capture.
-   [x] Create/import the LMS application from the canonical fixture and then normalize visible documentation names where needed.
-   [x] Treat `tools/fixtures/metahubs-lms-app-snapshot.json` and `check:lms-fixture-contract` as the canonical source of the documentation application state.
-   [x] If backend APIs are used for speed after one import-path validation, keep a manifest note that proves the generated visible state still matches the canonical fixture-backed app.
-   [x] Capture EN and RU screenshots in separate locale passes with `applyBrowserPreferences(page, { language: locale, isDarkMode: false })`.
-   [x] Save assets under localized `lms-user-guide` directories using matching filenames for EN and RU.
-   [x] Centralize capture in a helper such as `captureDocsScreenshot()` that rejects `fullPage: true` by default and rejects detail captures without `pairedContextId`.
-   [x] Add post-capture assertions:
    -   file exists;
    -   PNG dimensions are `1920x1080` unless listed as an explicit exception;
    -   no visible technical leakage on the page before capture;
    -   `expectNoTechnicalLeakage(page.locator('body'), { checkUuidSubstrings: true })`;
    -   `expectNoDataGridTechnicalLeakage(...)` for table/grid surfaces;
    -   `expectLocalizedValidation(...)` for invalid EN/RU form states;
    -   `expectSemanticFieldControls(...)` for dialogs with semantic long-text fields;
    -   no page-level horizontal overflow.
-   [x] Add toolbar geometry assertions for primary actions, filters, column settings, and view toggles using existing spacing/bounds helpers.
-   [x] Run the docs generator through the generator project command, not a stale `--project=chromium` path.

### Phase 4: User Documentation Writing

-   [x] Write the English guide first with concise but complete task-based structure.
-   [x] Write the Russian guide as a full localized counterpart, matching section count, screenshot count, and workflow order.
-   [x] Each workflow page must include prerequisites, required role, task goal, numbered steps, expected result, what to check, and related links.
-   [x] Use GitBook-friendly Markdown:
    -   front matter descriptions;
    -   clear H1/H2/H3 hierarchy;
    -   numbered steps for workflows;
    -   short "Result" or "What to check" notes after important actions;
    -   image alt text and localized captions where useful.
-   [x] Avoid implementation-only words in user docs unless the user needs them.
-   [x] Keep internal architecture terms in reference callouts only, for example: "Projects are inside the selected workspace."
-   [x] Ensure all screenshots have localized alt text and point to existing localized assets.
-   [x] Add "When to use this" and "What happens next" guidance for each page.

### Phase 5: Existing Docs Cleanup

-   [x] Update existing `docs/<locale>/guides/lms-overview.md` to distinguish product overview from user guide.
-   [x] Update `lms-setup.md` so it remains for metahub/application creation, not day-to-day LMS use.
-   [x] Update `lms-learning-content.md` to become an implementation/reference companion or link into the user guide.
-   [x] Replace stale LMS screenshots that reuse `quiz-tutorial/runtime-quiz.png` where they now misrepresent the LMS runtime.
-   [x] Decide whether older non-LMS `1440x900` screenshots remain out of scope or should be migrated in a later documentation refresh.

### Phase 6: Documentation QA Gates

-   [x] Extend or add a docs checker for LMS user guide parity:
    -   EN/RU page files match one-to-one;
    -   H1/H2/H3 sequence and screenshot step markers match;
    -   image counts and screenshot IDs match;
    -   numbered-step counts and table/admonition/code-block counts match;
    -   local image links resolve;
    -   no `E2E` visible text appears in Markdown.
-   [x] Extend screenshot asset checking to validate PNG dimensions for the `lms-user-guide` folder.
-   [x] Add a manifest-based check for deliberate non-`1920x1080` exceptions.
-   [x] Add a manifest-based stale asset check: every generated LMS user-guide screenshot must be referenced by Markdown, and every manifest entry must have a generated asset.
-   [x] Add RU docs and screenshot checks for English fallback text in user-facing LMS surfaces.
-   [x] Run `pnpm run docs:i18n:check`.
-   [x] Run `node tools/docs/check-gitbook-links.mjs`.
-   [x] Run `node tools/docs/check-gitbook-screenshot-assets.mjs`.
-   [x] Run the new LMS user guide docs checker.

### Phase 7: Browser And Runtime QA

-   [x] Run the docs screenshot generator on local minimal Supabase.
-   [x] Run the existing LMS runtime flow or a targeted subset that proves:
    -   Learning Content library opens in EN and RU;
    -   create/edit/copy/delete/restore project flows work;
    -   create/edit/delete page and link resource flows work;
    -   move content between projects works;
    -   course/track builder screens render and support create/edit/delete paths;
    -   reports execute/export;
    -   guest access flow opens and completes;
    -   no TanStack Devtools banner appears;
    -   no horizontal overflow at `1920x1080`, `768x1024`, and `390x844`.
-   [x] Run runtime UI oracles for supported states:
    -   `expectNoTechnicalLeakage`;
    -   `expectNoDataGridTechnicalLeakage`;
    -   `expectDataGridHorizontalScrollConstrained`;
    -   `expectNoPageHorizontalOverflow`;
    -   `expectSemanticFieldControls`;
    -   `expectLocalizedValidation`.
-   [x] Review generated screenshots manually before commit, focusing on:
    -   readable data;
    -   no awkward empty states where examples should show content;
    -   no cropped controls;
    -   no low-quality modal-only context screenshots;
    -   RU screenshots are actually Russian.

### Phase 8: Final Validation And PR Hygiene

-   [x] Run Prettier on changed Markdown, scripts, and specs.
-   [x] Run targeted lint for changed TypeScript/JavaScript specs/scripts.
-   [x] Run docs checks and focused Playwright generator.
-   [x] Verify `git status` does not include local env files or generated test-result artifacts.
-   [x] Commit docs, assets, generator, and checks as one coherent documentation phase.

## Potential Challenges

-   The full import-and-application setup path may be slow. If it becomes too slow, keep one import-path validation and use backend APIs for screenshot state setup, but only if the visible app state remains identical to the fixture-backed user experience.
-   Full-window screenshots may include too much vertical whitespace for small dialogs. The default should remain context screenshots, with optional close-up images only when a field-level detail needs explanation.
-   RU and EN screenshots may drift if seeded content is not fully bilingual. The generator should fail when RU surfaces expose English fallback text in core user workflows.
-   Updating global viewport from `1440x900` could destabilize existing visual tests. Keep this as a separate explicit migration unless approved.
-   GitBook rendered image sizing is not identical to source PNG sizing. The source assets should be `1920x1080`; the docs should use Markdown/GitBook image blocks with useful alt text rather than depending on exact rendered size.

## Dependencies

-   PR with LMS runtime productization is already merged.
-   Local minimal Supabase E2E stack must be available for screenshot generation when local mode is used.
-   The canonical LMS snapshot fixture must remain valid and pass `check:lms-fixture-contract`.
-   The new LMS user-guide docs checker must be wired into a package script so CI and PR reviewers can run the full documentation gate.
-   Docs GitBook publishing will depend on the repository docs checks and GitBook sync.

## Acceptance Criteria

-   A normal LMS user can follow the docs from opening the application through creating and managing Learning Content without needing metahub/admin knowledge.
-   EN and RU user-guide pages have matching structure, matching screenshot coverage, and localized text.
-   Primary screenshots are `1920x1080` whole-window captures.
-   Every procedural step either references a validated screenshot ID or explicitly declares that no screenshot is needed.
-   RU screenshots are captured from the RU UI.
-   Documentation screenshots contain no TanStack Query Devtools banner.
-   Documentation screenshots contain no visible `E2E` labels, raw UUIDs, raw ISO timestamps, raw JSON, or clipped/overlapping controls.
-   Runtime UI checks prove no raw IDs, hidden-knowledge workflows, object cells, internal validation messages, or page-level horizontal overflow in documented flows.
-   Detail/cropped screenshots have paired whole-window context screenshots.
-   Docs checks, screenshot asset checks, parity checks, and focused Playwright documentation generator pass.
