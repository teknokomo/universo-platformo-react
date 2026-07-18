# Interpretation Network Configuration and Runtime UX (2026-07-14)

> Status: completed
> Source plan: `memory-bank/plan/interpretation-network-configuration-runtime-ux-plan-2026-07-14.md`

## Architecture Record

-   Existing Interpretation Network Objects/Pages remain the domain model; no new entity preset, database migration, schema-version, or template-version increment is permitted.
-   Metahub owns seed defaults, Application Settings owns materialized widget configuration, and the published workspace owns transient selection/pane width.
-   Published UI stays inside `@universo-react/apps-template-mui`; it may use stable shared types/utils/i18n but must not import legacy template or feature UI packages.

## Checklist

-   [x] T1. Baseline the dirty worktree, inspect exact callers, update shared type/config/color contracts, and add focused unit tests.
-   [x] T2. Replace Interpretation Network template styling metadata and widget defaults; remove obsolete colour entities/preset contracts; extend fixture contracts and template tests.
-   [x] T3. Enforce safe `hexColor` processing at metadata, runtime TABLE writes, seed/materialization, and import boundaries with stable localized error mapping and direct backend tests.
-   [x] T4. Wire `splitPane.enabled` through metahub widget authoring and Application Settings using the existing atomic batch-save/cache contract, with tests and EN/RU keys.
-   [x] T5. Repair runtime VLC edit initialization; replace legacy scalar style picker with the scoped grouped editor; add text-colour/contrast-safe rendering and preview coverage.
-   [x] T6. Implement the parent Structure header, start-preserving breadcrumbs, selection painting, and accessible bounded responsive pane splitter without persisted user ratio.
-   [x] T7. Update fixture generator/import/runtime browser flows, focused visual/a11y checks, E2E wrapper, EN/RU docs, package READMEs, and required project checks.
-   [ ] T8. Run formatting, focused tests/builds, local-minimal-Supabase Playwright proof, guards, OntoIndex diff verification, Thermos/autoreview, and record completed progress. Formatting, focused tests/builds, guards, and OntoIndex have run; browser proof is blocked by an already running local app server on port 3100, and Thermos/autoreview did not finish within the interactive window.

---

# Unified Settings and Workspace Overrides (2026-07-16)

> Status: completed
> Source plan: `memory-bank/plan/unified-settings-and-workspace-overrides-plan-2026-07-16.md`

## Architecture Record

-   Shared settings contract lives in `packages/universo-react-types` and is the single source of truth for metahub, application, and workspace settings metadata.
-   Metahub remains canonical for defaults, application control panel stores materialized defaults, and workspace stores explicit overrides.
-   Workspace overrides use a dedicated persistence boundary and do not reuse `_app_settings` blindly.
-   Runtime UI stays on existing `@universo-react/apps-template-mui` primitives; no new legacy UI fork is introduced for published apps.
-   All user-facing text must remain localized.
-   UUID v7 is required for new persisted rows.

## Checklist

-   [x] U1. Add the shared settings registry/contract and normalized effective-value helpers in `packages/universo-react-types`.
-   [x] U2. Add dedicated workspace override persistence, API routes, request-scoped store helpers, and optimistic version semantics.
-   [x] U3. Refactor metahub settings surfaces to use the shared registry while preserving contextual editors and aggregated settings views.
-   [x] U4. Refactor application settings/layouts to consume the shared contract and remove raw JSON fallback behavior on normal surfaces.
-   [x] U5. Add workspace settings routing and UI in both runtime hosts with allowed-key gating and reset-to-application behavior.
-   [x] U6. Update i18n, package READMEs, and GitBook docs for the three-layer settings model.
-   [x] U7. Add/refresh tests across Vitest, Jest, and Playwright, including Interpretation Network coverage and minimal local Supabase proof.
-   [x] U8. Run formatting, lint, builds, browser proof, OntoIndex diff verification, and Thermos/autoreview; close out progress with evidence. Formatting, focused Jest/Vitest, lint, package builds, guards, docs checks, `git diff --check`, OntoIndex diff verification, and the full minimal-local-Supabase Interpretation Network verification wrapper passed. The E2E wrapper now recreates the local E2E Supabase profile between fixture generation and browser verification so generated fixed-schema state cannot leak into the browser proof.

### QA remediation slice (2026-07-17)

-   [x] Q1. Allow application administrators to manage workspace settings even when they are not members of the target workspace, while keeping non-admin/non-member access fail-closed.
-   [x] Q2. Normalize `workspaceOverrides` on backend application settings updates so unknown, duplicate, and locked keys cannot persist.
-   [x] Q3. Filter copied workspace setting overrides against the current application workspace policy.
-   [x] Q4. Ensure published runtime workspace settings resolve localized labels/options from the `apps` bundle and do not show raw i18n keys.
-   [x] Q5. Re-run focused backend/frontend tests and record remaining evidence gaps. The enhanced Interpretation Network browser flow passes against minimal local Supabase; route Jest can require a non-sandbox listener permission in restricted environments.

### QA remediation slice (2026-07-18)

-   [ ] Q6. Align the application Interpretation Network widget editor with the shared template dialog footer pattern and localized application text.
-   [ ] Q7. Make the application workspace switcher widget edit action deterministic instead of clicking into an empty handler.
-   [ ] Q8. Fix published-app Russian workspace Settings menu localization in the standalone runtime host.
-   [ ] Q9. Strengthen component and Playwright coverage so localized labels, footer actions, and workspace switcher behavior are asserted directly.

## MMOOMM fixture drift follow-up (2026-07-15)

-   [x] M4. Investigate the next Node 22 drift failure: PlayCanvas material asset metadata emitted `meta: null` while the authored fixture omitted the optional field.
-   [x] M5. Normalize only null `assets/<index>/metadata/meta` records that have PlayCanvas asset metadata shape; preserve strict comparison for authored asset fields and unrelated snapshot metadata.
-   [x] M6. Validate the fix with the fixture contract, a synthetic `metadata.meta: null` drift regression, affected package lint/builds, formatting, and `git diff --check`.

## Runtime UX verification follow-up (2026-07-15)

> Status: completed
> Scope: user-reported regressions after rebuilding and importing the Interpretation Network snapshot.

### UI Contract

-   Editing an existing Structure loads the raw persisted record and displays every saved locale for localized Name and Description fields.
-   Every cell-style colour selector offers the shared preset sequence with white immediately after black, while still accepting valid custom hexadecimal colours.
-   Cell-coloured breadcrumbs preserve their fill and text colours during hover and focus, adding only a visible overlay effect.
-   Text/fill contrast is evaluated with WCAG relative luminance and shown as localized advisory guidance without blocking a deliberate save.
-   Focused tests cover raw localized edit loading, preset ordering, breadcrumb interaction styling, contrast ratios, advisory rendering, and successful submission.

### Checklist

-   [x] F1. Load raw Structure data before opening edit and retain all localized Name/Description variants.
-   [x] F2. Add white after black to the shared colour preset sequence and verify every style control.
-   [x] F3. Preserve cell breadcrumb colours on hover/focus and apply a non-destructive interaction effect.
-   [x] F4. Keep WCAG contrast feedback advisory and verify authored low-contrast pairs can still be saved.
-   [x] F5. Add focused Vitest and Playwright regression coverage, format, lint, build, and run browser proof with minimal local Supabase. Focused and full Vitest/lint/build checks pass; Chromium Playwright passed 2/2 against the imported snapshot on minimal local Supabase.
-   [x] F6. Run OntoIndex diff verification and Thermos/autoreview closeout; update progress evidence. OntoIndex diff verification completes with expected broad dirty-tree critical scope; Thermos/autoreview was attempted but did not finish within the interactive window.

## Authored Matrix Text Colour Regression (2026-07-15)

> Status: in_progress
> Scope: published Interpretation Network cells render an automatic contrast foreground instead of the saved `TextColor`.

### UI Contract

-   A valid saved `TextColor` is the exact foreground used by cell content in table, horizontal-row, vertical-tree, header-card, and breadcrumb surfaces.
-   Automatic black/white foreground selection is used only when `TextColor` is absent or invalid.
-   Selection, hover, focus, and drag states must not replace an authored text colour.
-   Regression tests cover white, red, null fallback, and runtime persistence/refetch paths.

### Checklist

-   [x] C1. Trace saved `TextColor` through runtime row decoding and every Matrix renderer; run OntoIndex impact before edits.
-   [x] C2. Fix the shared rendering boundary without adding legacy or view-specific forks.
-   [x] C3. Add focused model/component tests for authored white/red foregrounds and automatic fallback only when absent.
-   [ ] C4. Add browser E2E proof against the imported snapshot on minimal local Supabase, including a screenshot/computed-style assertion (deferred: current flow has no stable cell-style edit fixture).
-   [x] C5. Run Prettier, lint, build, focused/full tests, fixture contract/drift checks, and `git diff --check`; OntoIndex CLI diff and Thermos closeout remain pending.

## MMOOMM Fixture Drift Gate Regression (2026-07-15)

> Scope: the Node 22 GitHub Actions build repeatedly failed because PlayCanvas Editor injected a scene-local `metadata.editorDocument.version` field into generated material assets, while the authored fixture intentionally omitted that optimistic-concurrency revision.

-   [x] M1. Confirm the failing CI path and compare the generated/tracked normalized diff.
-   [x] M2. Normalize only the PlayCanvas scene-local editor-document revision field; do not mutate the tracked fixture or hide unrelated asset drift.
-   [x] M3. Run the MMOOMM fixture contract/drift checks and affected package builds.

---

# Interpretation Network Matrix Visual And Drop Follow-up (2026-07-12)

> Status: completed
> Scope: fix Matrix cell selection visibility, hierarchical table spacing, total cell counter wording/coverage, and center-zone drop-to-child behavior.

## UI Contract

-   Selected Matrix cell cards render a visible focus/selection outline that is not clipped in hierarchical table, horizontal rows, or vertical tree views.
-   Hierarchical table row-header cards keep a small stable gap before child-cell columns.
-   The total tree-cell counter uses localized wording equivalent to "Total N cells in the structure" and appears in every Matrix view when the setting is enabled.
-   Hierarchical drag/drop uses center-zone nesting for child placement and edge zones for before/after sibling placement.
-   Runtime UI remains localized, template-style, and covered by focused tests.

## Checklist

-   [x] T1. Inspect Matrix view rendering, DnD placement logic, i18n, and run OntoIndex impact for edited symbols.
-   [x] T2. Fix selected-card outline visibility and hierarchical table row/child spacing.
-   [x] T3. Update total-cell counter wording and render it across all Matrix views behind the existing setting.
-   [x] T4. Adjust hierarchical DnD hit-zone logic so center means nesting and edges mean sibling placement.
-   [x] T5. Add reliable Vitest coverage for selection styling, spacing, counter coverage/wording, and DnD placement.
-   [x] T6. Run Prettier, focused tests, fixture contract, OntoIndex diff verification, and autoreview.
