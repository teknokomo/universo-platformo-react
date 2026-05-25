# LMS User Documentation And GitBook Screenshot Research - 2026-05-24

## Research Question

How should the project produce a detailed bilingual GitBook user guide for the LMS application generated from `tools/fixtures/metahubs-lms-app-snapshot.json`, with high-quality localized screenshots, deterministic screenshot dimensions, and automated quality gates?

## Source Inventory

### Local Repository Sources

-   `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`
-   Existing LMS docs:
    -   `docs/en/guides/lms-overview.md`
    -   `docs/en/guides/lms-setup.md`
    -   `docs/en/guides/lms-learning-content.md`
    -   `docs/en/guides/lms-resource-model.md`
    -   `docs/en/guides/lms-reports.md`
    -   `docs/en/guides/lms-guest-access.md`
    -   Matching `docs/ru/guides/lms-*.md`
-   Existing screenshot generators:
    -   `tools/testing/e2e/specs/generators/docs-admin-screenshots.spec.ts`
    -   `tools/testing/e2e/specs/generators/docs-entity-screenshots.spec.ts`
    -   `tools/testing/e2e/specs/generators/docs-pages-lms-screenshots.spec.ts`
    -   `tools/testing/e2e/specs/generators/docs-quiz-tutorial-screenshots.spec.ts`
-   LMS runtime browser coverage:
    -   `tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
    -   `tools/testing/e2e/support/browser/runtimeUx.ts`
-   Documentation validation:
    -   `tools/docs/check-i18n-docs.mjs`
    -   `tools/docs/check-gitbook-links.mjs`
    -   `tools/docs/check-gitbook-screenshot-assets.mjs`
-   Playwright config:
    -   `tools/testing/e2e/playwright.config.mjs`

### External Primary Sources

-   GitBook Markdown documentation: https://gitbook.com/docs/creating-content/formatting/markdown
-   GitBook Images documentation: https://gitbook.com/docs/creating-content/blocks/insert-images
-   Playwright screenshots documentation: https://playwright.dev/docs/screenshots
-   Playwright `testOptions.viewport` documentation: https://playwright.dev/docs/api/class-testoptions#test-options-viewport

## Key Findings

1. Existing LMS docs are not yet a full user guide.
   They explain the LMS architecture, setup, resource model, reports, and guest access, but they are not organized as a step-by-step guide for users who already opened the published LMS application. Most pages use only one or two screenshots and reuse old quiz/entity/platform assets.

2. Current docs screenshots are mostly `1440x900`.
   The repository `tools/testing/e2e/playwright.config.mjs` still sets the default E2E viewport to `1440x900`. Sample image inspection confirmed `docs/en/.gitbook/assets/platform/applications-list.png`, `docs/en/.gitbook/assets/quiz-tutorial/runtime-quiz.png`, and similar assets are `1440 x 900`.

3. The runtime UX viewport matrix already includes `1920x1080`.
   `tools/testing/e2e/support/browser/runtimeUx.ts` defines `desktop-1920`, `tablet-768`, and `mobile-390`. This should be reused for UX assertions, while docs screenshot generators should explicitly use `1920x1080` for primary documentation screenshots.

4. Existing screenshot generators mix full-page, viewport, and element screenshots.
   `docs-quiz-tutorial-screenshots.spec.ts` explicitly sets `1440x900` and captures some full viewport screenshots, while `docs-entity-screenshots.spec.ts` captures an element-only dialog screenshot for `metahub-entities-create-dialog.png`. The new LMS user documentation should default to whole-window screenshots at `1920x1080` and reserve element screenshots for deliberate close-up exceptions.

5. The TanStack Query Devtools banner should be absent by default, but docs generation should assert it.
   `packages/universo-react-core-frontend/base/src/index.tsx` renders `ReactQueryDevtools` only when `NODE_ENV === 'development'` and `VITE_ENABLE_QUERY_DEVTOOLS === 'true'`. Documentation screenshot generation should still force the flag off and assert that no visible TanStack/React Query devtools launcher appears before each captured screenshot.

6. Existing E2E names are unsuitable for documentation screenshots.
   Many flow specs intentionally create visible names that start with `E2E ...`. That is acceptable for regression tests, but documentation generators should create user-facing names such as "Learning Portal", "Requirements Library", "Compliance Refresh Course", and matching Russian labels, not run-id based E2E labels.

7. GitBook supports Markdown-based documentation and image blocks with alt text/captions.
   GitBook's official Markdown docs confirm regular Markdown content support. GitBook's image docs recommend alt text for accessibility and support captions, frames, sizing, and light/dark image variants. The project should use explicit alt text, localized captions, and stable local asset paths.

8. Playwright supports both whole-page and element screenshots, but the project needs a stronger policy.
   Official Playwright docs show `page.screenshot({ fullPage: true })` for full scrollable pages and `locator.screenshot()` for element shots. For this user documentation, the default should be viewport screenshots (`fullPage: false`) at `1920x1080`, because the user needs surrounding navigation and modal placement context.

9. Existing docs QA can be extended instead of replacing it.
   `docs:i18n:check`, `check-gitbook-links.mjs`, and `check-gitbook-screenshot-assets.mjs` already validate bilingual docs structure, local links, and referenced images. The LMS user guide needs additional checks for EN/RU page parity, screenshot manifest coverage, screenshot dimensions, no `E2E` visible text in captured surfaces, no raw ISO/UUID/JSON leakage, and no TanStack Query devtools artifacts.

## Conflicts And Uncertainty

-   Updating the global Playwright default viewport from `1440x900` to `1920x1080` could change unrelated E2E behavior and visual snapshots. The safer default is to keep the global suite viewport stable and set `1920x1080` only in documentation screenshot generators and documentation-specific visual checks.
-   GitBook can resize images in the published site, so the source PNG should be `1920x1080`, while the Markdown should not rely on exact rendered dimensions in the browser.
-   Some dialog close-ups may still be useful, but they should be explicitly marked as close-up images and paired with a whole-window screenshot that shows where the dialog appears.

## Project Implications

-   Add a dedicated LMS user documentation section rather than overloading the existing architecture/setup guides.
-   Add a new `docs-lms-user-guide-screenshots.spec.ts` generator that imports/creates the LMS app from the canonical snapshot and captures deterministic EN and RU screenshots.
-   Store localized assets under separate folders, for example:
    -   `docs/en/.gitbook/assets/lms-user-guide/`
    -   `docs/ru/.gitbook/assets/lms-user-guide/`
-   Avoid visible run identifiers and `E2E` labels in documentation screenshots.
-   Keep user docs focused on published application workflows: workspace selection, navigation, Learning Content library, projects, resources, courses, tracks, sharing, trash/restore, learner player, reports, knowledge, and guest access.
-   Keep existing setup/resource-model/report docs as implementation/admin references, linking them to the user guide.

## QA Addendum

Plan QA found that documentation quality gates must also act as runtime UI oracles. The docs can otherwise pass while screenshots still contain hidden-knowledge workflows, raw IDs, raw JSON/object cells, clipped toolbar controls, or English fallback text in Russian screenshots.

Additional local findings:

-   `tools/testing/e2e/support/browser/runtimeUx.ts` already provides reusable oracles for technical leakage, DataGrid technical leakage, localized validation, semantic field controls, page overflow, constrained DataGrid scroll, and the `1920x1080` / `768x1024` / `390x844` viewport matrix.
-   `tools/testing/e2e/support/browser/spacing.ts` provides bounds and spacing assertions that can support toolbar geometry checks.
-   `tools/docs/check-i18n-docs.mjs` already enforces strict EN/RU parity and unreferenced asset detection, so new screenshots must be referenced by Markdown immediately.
-   `tools/docs/check-gitbook-links.mjs` and `tools/docs/check-gitbook-screenshot-assets.mjs` currently validate existence but not PNG dimensions or manifest coverage.
-   `tools/testing/e2e/specs/generators/docs-pages-lms-screenshots.spec.ts` has LMS wording but currently uses a basic metahub path and `fullPage: true`; the new LMS user-guide generator should have a separate helper that rejects full-page screenshots by default.
-   `snapshot-import-lms-runtime.spec.ts` has useful LMS runtime states but writes screenshots to test output, not GitBook assets, so its screenshots cannot be treated as documentation assets without an explicit generator path.

## Recommended Decision

Create a dedicated bilingual LMS User Guide in GitBook format, backed by a documentation-specific Playwright generator that uses the existing E2E runner and local minimal Supabase when requested. Use `1920x1080` whole-window screenshots by default, assert no TanStack Query devtools, assert no visible `E2E` labels or technical leakage, and add documentation parity/asset-dimension checks. Keep the global Playwright default viewport unchanged unless a separate E2E-wide viewport migration is approved.

Path decision after QA: use `docs/<locale>/lms/` as a first-class GitBook section.

## Open Questions

-   Should documentation generation import the existing fixture snapshot through the UI every time, or use backend APIs to create the same application state faster after validating the import path elsewhere?
-   Should old non-LMS `1440x900` screenshots be migrated in the same PR, or should this phase only enforce `1920x1080` for the new LMS user-guide screenshot set?
