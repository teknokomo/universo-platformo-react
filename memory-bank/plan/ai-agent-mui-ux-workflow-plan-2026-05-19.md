# AI Agent MUI Runtime UX Workflow Implementation Plan

> Created: 2026-05-19
> Status: Implemented
> Research: `memory-bank/research/ai-agent-mui-ux-workflow-research-2026-05-19.md`

## Overview

Implement a repository-level Runtime UI UX Quality Gate so Codex and other coding agents stop producing technically connected but unusable MUI runtime interfaces. The goal is to make UX semantics explicit, reusable, and mechanically testable: no raw user-facing IDs, no raw JSON/object cells, multiline long-text fields by default, localized validation, responsive browser proof, and honest QA verdicts.

This is a workflow and quality-system change, not a new LMS-specific UI feature. It should reuse the existing app-template MUI dashboard, runtime metadata contracts, `FormDialog`, DataGrid conversion helpers, existing Playwright suite infrastructure, and current cross-agent mode files.

## Research And Source Context

-   Local research artifact: `memory-bank/research/ai-agent-mui-ux-workflow-research-2026-05-19.md`.
-   Local backup research:
    -   `.backup/Как-настроить-ИИ-агентов.md`
    -   `.backup/Улучшение-ИИ-генерации-пользовательских-интерфейсов.md`
-   Official sources verified during planning:
    -   OpenAI Codex `AGENTS.md`, Skills, and Subagents docs.
    -   MUI TextField, Autocomplete, and MUI X Data Grid column/cell rendering docs.
    -   Playwright best practices, user-facing locators, web-first assertions, and accessibility testing docs.
-   Context7 docs checked:
    -   `/mui/material-ui`
    -   `/microsoft/playwright`

## Codebase Findings

-   `.agents/skills` already exists and is the right portable layer for reusable project-local workflows.
-   `.claude/agents`, `.github/agents`, `.qoder/agents`, and `.kiro/steering/custom_modes` already exist, so the project already maintains per-tool instruction files.
-   `.codex/agents` and `.gemini/agents` do not yet exist. Codex custom agents should be added under `.codex/agents/*.toml`; Gemini custom subagents should be added under `.gemini/agents/*.md`.
-   Current mode files (`plan`, `implement`, `qa`) are generic and do not yet enforce a runtime UX quality gate.
-   `packages/apps-template-mui/src/components/dialogs/FormDialog.tsx` already supports `textarea`, row counts, hidden fields, resource-source widgets, localized validation, and REF/select controls.
-   `packages/apps-template-mui/src/utils/columns.tsx` already supports `gridHidden`, custom renderers, REF labels, and textarea cell rendering.
-   `packages/apps-template-mui/src/utils/displayValue.ts` still falls back to `JSON.stringify()` for opaque objects. That fallback can remain useful for diagnostics, but UX gates must prevent it from leaking into normal user-facing surfaces.
-   `tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts` already has browser navigation, screenshots, console issue collection, and a local page-overflow assertion, but the UX checks are not reusable and do not detect raw IDs, raw JSON cells, single-line descriptions, or untranslated/internal validation text.
-   Existing workspace member UI already uses human-readable email/name and role chips instead of requiring users to manually type user IDs. This is a useful local precedent for the UX contract.

## Affected Areas

-   Agent workflow instructions:
    -   `AGENTS.md`
    -   `.gemini/GEMINI.md`
    -   `.gemini/rules/custom_modes/plan_mode.md`
    -   `.gemini/rules/custom_modes/implement_mode.md`
    -   `.gemini/rules/custom_modes/qa_mode.md`
    -   `.claude/agents/{plan,implement,qa}.md`
    -   `.github/agents/{plan,implement,qa}.agent.md`
    -   `.qoder/agents/{plan,implement,qa}.md`
    -   `.kiro/steering/custom_modes/{plan,implement,qa}_mode.md`
-   New portable skills and shared role profiles:
    -   `.agents/skills/mui-runtime-ux-patterns/`
    -   `.agents/skills/runtime-ux-qa/`
    -   `.agents/agent-profiles/`
-   New native custom-agent/subagent profiles:
    -   `.codex/agents/`
    -   `.gemini/agents/`
    -   `.claude/agents/`
    -   `.github/agents/`
    -   `.qoder/agents/`
    -   `.kiro/steering/agent_profiles/` or equivalent Kiro steering location
-   Drift-control tooling:
    -   `tools/agents/check-runtime-ux-agent-invariants.mjs`
    -   optional root `package.json` script such as `check:runtime-ux-agents`
-   Playwright UX helpers and regression specs:
    -   `tools/testing/e2e/support/browser/runtimeUx.ts`
    -   `tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
    -   optionally `tools/testing/e2e/specs/flows/lms-runtime-ux-regressions.spec.ts`
-   GitBook documentation:
    -   `docs/en/contributing/runtime-ui-ux-quality-gate.md`
    -   `docs/ru/contributing/runtime-ui-ux-quality-gate.md`
    -   `docs/en/SUMMARY.md`
    -   `docs/ru/SUMMARY.md`
-   Memory Bank:
    -   `memory-bank/tasks.md`
    -   `memory-bank/progress.md` after implementation

## Design Decisions

1. Use two skills, not three:

    - `mui-runtime-ux-patterns` covers MUI form controls, reference/user fields, dashboard-template consistency, and DataGrid display contracts.
    - `runtime-ux-qa` covers human-user review, Playwright browser evidence, anti-technical-leakage checks, responsive checks, localized validation, and structured verdicts.
    - DataGrid guidance will live as a focused reference under `mui-runtime-ux-patterns`, not as a separate skill unless it grows too large.

2. Keep `AGENTS.md` and global mode files short:

    - They should point to skills and define blocking quality gates.
    - They should not become large duplicated UI manuals.

3. Make native reviewer/subagent files self-contained:

    - `.agents/agent-profiles` is the shared authoring source.
    - Native files for Codex, Gemini, Claude, GitHub Copilot, Qoder, and Kiro should include the full behavior-defining instructions, not only "read `.agents/agent-profiles/...`".
    - Duplication is acceptable here because these are instruction artifacts, but drift must be checked mechanically.

4. Do not depend on mandatory subagent spawning:

    - The workflow must work when a tool supports native subagents and when it does not.
    - PLAN/IMPLEMENT/QA instructions should require the same reviewer checklist inline if subagents are unavailable or not explicitly used.

5. Prefer existing runtime metadata and generic widgets:

    - No LMS-only UI component should be introduced for this quality gate.
    - The LMS snapshot/spec becomes the first canary because it exposed the concrete defects.

6. Keep instruction artifacts safe by default:

    - New skills and reviewer profiles should be Markdown/instruction-only unless an executable helper is explicitly justified.
    - Reviewer profiles should be read-only by default and must not request shell, write, database, browser, or network permissions just to produce an architectural verdict.
    - Third-party or community skills may be used as research inspiration, but this implementation must not vendor opaque external skill bundles.

7. Treat UX canaries as blocking checks:

    - If the new LMS UX canary exposes an existing defect, fix the generic runtime metadata/rendering behavior or fixture contract.
    - Do not skip, weaken, or over-broaden allow lists just to make the canary pass.

8. Evaluate the new skills and reviewer profiles:
    - Each skill should include small activation and non-activation examples.
    - Each reviewer profile should have a minimal bad/good fixture so future agents can verify that the profile catches raw IDs, raw JSON cells, single-line long text, and untranslated/internal validation.

## Plan Steps

### Phase 1: Create Portable UX Skills

-   [ ] Add `.agents/skills/mui-runtime-ux-patterns/SKILL.md`.

    -   Define when to use: any work touching MUI runtime screens, `packages/apps-template-mui`, `packages/universo-template-mui`, application layouts, metahub template metadata, DataGrid/table/card renderers, CRUD dialogs, or UI E2E flows.
    -   Require a "UI Contract" before implementation: field semantics, control type, display value, hidden fields, default values, localization, responsive behavior, and validation state.
    -   Forbid raw editable `*Id`, `OwnerId`, `UserId`, `AssignedUserId`, and UUID-only fields on normal user-facing surfaces unless explicitly marked admin/debug.
    -   Require semantic long-text fields (`description`, `notes`, `summary`, `details`, `body`, `instructions`, `feedback`, `comment`) to use multiline controls by default.
    -   Require media/resource/JSON fields to be hidden, formatted, or rendered with previews/badges, never raw `JSON.stringify()` in normal grids.

-   [ ] Add `.agents/skills/mui-runtime-ux-patterns/references/field-control-contract.md`.

    -   Map owner/user/reference fields to pickers, email selectors, current-user defaults, or hidden server-owned values.
    -   Map long text to `textarea`/`TextField multiline`.
    -   Map enums/status/booleans/dates/numbers to existing MUI controls and localized display.
    -   Include local examples from `FormDialog`, `RuntimeWorkspacesPage`, and `LocalizedInlineField`.

-   [ ] Add `.agents/skills/mui-runtime-ux-patterns/references/data-grid-display-contract.md`.

    -   Document when to use `valueGetter`, `valueFormatter`, `renderCell`, `gridHidden`, and REF display labels.
    -   Define "technical leakage" examples: raw JSON objects, arrays of objects, internal field names, raw UUID-only values, and storage descriptors shown as business content.
    -   Explain that `formatRuntimeValue()` fallback is diagnostic, not sufficient as a user-facing contract for media/resource fields.

-   [ ] Add `.agents/skills/mui-runtime-ux-patterns/references/dashboard-template-contract.md`.

    -   Require reuse of existing MUI dashboard/app-template primitives before creating new UI.
    -   Cover relation-builder, detailsTable, columnsContainer, cards, row actions, menus, and workspace patterns.

-   [ ] Add `.agents/skills/mui-runtime-ux-patterns/references/evaluation.md`.

    -   Include should-trigger and should-not-trigger examples.
    -   Include a bad fixture with editable `OwnerId`, single-line `Description`, and raw `Cover` JSON.
    -   Include the expected reviewer outcome and the corrected UI contract.

-   [ ] Add `.agents/skills/runtime-ux-qa/SKILL.md`.

    -   Define when to use: QA of PLAN, IMPLEMENT output, runtime UI, Playwright specs, screenshots, and user-facing CRUD flows.
    -   Require a verdict format: `verdict`, `blockers`, `majorIssues`, `minorIssues`, `passedChecks`, `browserEvidence`, `missingEvidence`, `requiredFixes`.
    -   Include explicit fail criteria for raw IDs, raw JSON/object cells, single-line long-text fields, untranslated/internal validation errors, page-level horizontal overflow, missing keyboard path, or workflows requiring hidden user knowledge.

-   [ ] Add `.agents/skills/runtime-ux-qa/references/playwright-ux-oracles.md`.

    -   Define reusable Playwright assertions for technical leakage, semantic field controls, localized validation, keyboard path, screenshots, and responsive reflow.
    -   Require user-facing locators and web-first assertions.
    -   Clarify that axe checks are useful but do not replace semantic UX assertions.

-   [ ] Add `.agents/skills/runtime-ux-qa/references/qa-verdict-template.md`.

    -   Provide an output template for PLAN review, IMPLEMENT review, and post-browser QA review.
    -   Require "human usability" conclusion, not only "tests pass".

-   [ ] Add `.agents/skills/runtime-ux-qa/references/evaluation.md`.
    -   Include should-trigger and should-not-trigger examples.
    -   Include bad/good verdict fixtures for PLAN QA and IMPLEMENT QA.
    -   Ensure the bad fixture fails even when the UI is technically connected and CRUD calls succeed.

### Phase 2: Add Shared Reviewer Role Profiles

-   [ ] Add `.agents/agent-profiles/plan-ux-reviewer.md`.

    -   Reviews plans for UX contracts, requirement coverage, missing browser evidence, test oracle gaps, and overuse of new UI components.

-   [ ] Add `.agents/agent-profiles/mui-runtime-reviewer.md`.

    -   Reviews MUI field/control mapping, DataGrid display, dashboard-template consistency, metadata reuse, and anti-LMS-hardcoding.

-   [ ] Add `.agents/agent-profiles/runtime-ux-qa.md`.

    -   Reviews implemented runtime behavior from the perspective of a normal user and returns a blocking verdict when the UI is not realistically usable.

-   [ ] Add `.agents/agent-profiles/test-oracle-reviewer.md`.

    -   Reviews whether Jest/Vitest/Playwright tests would have caught the reported defect class.

-   [ ] Add `.agents/agent-profiles/a11y-responsive-reviewer.md`.

    -   Reviews keyboard navigation, accessible names/labels, localized errors, viewport behavior, and page-level overflow.

-   [ ] Add `.agents/agent-profiles/README.md`.
    -   Explain that `.agents/agent-profiles` is the authoring source, while native agent files are self-contained copies.
    -   Define the minimum invariant anchors that must appear in every native copy.
    -   Document the safe-default policy: reviewer profiles are read-only, instruction-only, and must not request privileged tools unless a future role explicitly needs them.

### Phase 3: Add Self-Contained Native Agent Files

-   [ ] Add Codex custom agents under `.codex/agents/*.toml`.

    -   Files: `plan-ux-reviewer.toml`, `mui-runtime-reviewer.toml`, `runtime-ux-qa.toml`, `test-oracle-reviewer.toml`, `a11y-responsive-reviewer.toml`.
    -   Each file should include a full `developer_instructions` body and should not rely only on links to `.agents/agent-profiles`.
    -   Keep permissions read-only for reviewer agents where possible.
    -   Do not include destructive commands, secret-handling instructions, broad tool permission requests, or instructions that bypass approval policies.

-   [ ] Add Gemini custom subagents under `.gemini/agents/*.md`.

    -   Use full Markdown bodies that mirror the relevant `.agents/agent-profiles` content.
    -   Keep existing `.gemini/rules/custom_modes` as the mode entrypoints.

-   [ ] Add or extend Claude Code subagents under `.claude/agents/*.md`.

    -   Add specialized reviewer files rather than overloading the existing generic `qa.md`.
    -   Keep frontmatter tools read-only for reviewers unless a specific role needs diagnostics.
    -   Keep the body self-contained even when it links back to `.agents/agent-profiles` for maintenance context.

-   [ ] Add or extend GitHub Copilot / VS Code custom agents under `.github/agents/*.agent.md`.

    -   Use full Markdown bodies and existing GitHub agent conventions.

-   [ ] Add Qoder reviewer agents under `.qoder/agents/*.md`.

    -   Use full Markdown bodies matching the shared role profiles.

-   [ ] Add Kiro reviewer steering files under a project-local Kiro-compatible location.
    -   Prefer `.kiro/steering/agent_profiles/*.md` if Kiro accepts project steering docs there; otherwise mirror the reviewer gates into existing `.kiro/steering/custom_modes/{plan,implement,qa}_mode.md`.
    -   Do not rely on links only.
    -   If Kiro does not have a native subagent registry in this repository, do not invent one that the tool will ignore; place the full reviewer rules in steering files that Kiro already loads.

### Phase 4: Wire UX Gates Into PLAN / IMPLEMENT / QA Modes

-   [ ] Update `AGENTS.md` with a compact "Runtime UI UX Quality Gate" section.

    -   Point to the two new skills and the GitBook docs.
    -   Add only the non-negotiable rules: no raw user-facing IDs, no raw JSON/object display, long text multiline, localized errors, dashboard-template reuse, browser UX evidence.

-   [ ] Update `.gemini/GEMINI.md` with the same compact pointer, keeping it short.

-   [ ] Update PLAN mode files across active tools.

    -   `.gemini/rules/custom_modes/plan_mode.md`
    -   `.claude/agents/plan.md`
    -   `.github/agents/plan.agent.md`
    -   `.qoder/agents/plan.md`
    -   `.kiro/steering/custom_modes/plan_mode.md`
    -   Requirement: any UI/runtime/template plan must include a `UI Contract` section and must either run or inline the `plan-ux-reviewer` checklist.

-   [ ] Update IMPLEMENT mode files across active tools.

    -   `.gemini/rules/custom_modes/implement_mode.md`
    -   `.claude/agents/implement.md`
    -   `.github/agents/implement.agent.md`
    -   `.qoder/agents/implement.md`
    -   `.kiro/steering/custom_modes/implement_mode.md`
    -   Requirement: when touching UI/runtime/template code, load `mui-runtime-ux-patterns`, preserve dashboard-template primitives, and add/adjust UX oracles alongside implementation.

-   [ ] Update QA mode files across active tools.
    -   `.gemini/rules/custom_modes/qa_mode.md`
    -   `.claude/agents/qa.md`
    -   `.github/agents/qa.agent.md`
    -   `.qoder/agents/qa.md`
    -   `.kiro/steering/custom_modes/qa_mode.md`
    -   Requirement: QA must explicitly answer whether a normal user can complete the workflow, not only whether tests pass.

### Phase 5: Add Drift-Control For Instruction Duplication

-   [ ] Add `tools/agents/check-runtime-ux-agent-invariants.mjs`.

    -   Check that all critical instruction files contain required invariant phrases or equivalent anchors.
    -   Cover `.agents/agent-profiles`, `.codex/agents`, `.gemini/agents`, `.claude/agents`, `.github/agents`, `.qoder/agents`, and Kiro reviewer files.
    -   Fail with actionable output naming missing invariants and files.
    -   Reject link-only wrappers that do not contain the behavior-defining instructions.
    -   Reject obvious unsafe drift such as destructive command instructions, secret-copying instructions, or reviewer profiles that request broad write permissions.
    -   Check that every skill has an `evaluation.md` reference with at least one should-trigger and one should-not-trigger fixture.

-   [ ] Add a root script in `package.json`, for example:

    -   `check:runtime-ux-agents`: `node tools/agents/check-runtime-ux-agent-invariants.mjs`

-   [ ] Add a lightweight test or direct command proof for the drift-control script.
    -   At minimum run the script successfully after creating all files.
    -   If the script is complex, add a focused fixture-based test.

### Phase 6: Add Playwright Runtime UX Helpers

-   [ ] Add `tools/testing/e2e/support/browser/runtimeUx.ts`.

    -   `expectNoTechnicalLeakage(surface, options)`:
        -   rejects raw JSON-like visible cells/text in user-facing scope;
        -   rejects visible raw UUID-only content in business labels unless allowed;
        -   rejects internal validation phrases such as raw Zod messages on localized surfaces;
        -   supports allow lists for debug/admin-only surfaces.
    -   `expectSemanticFieldControls(dialog, contract)`:
        -   checks long-text fields are `textarea`;
        -   checks forbidden raw ID labels are absent or not editable;
        -   checks user/reference fields use picker/select/email/current-user semantics when configured.
    -   `expectLocalizedValidation(surface, locale, options)`:
        -   checks localized user-facing error text and no internal English fallback in Russian flows.
    -   `expectNoPageHorizontalOverflow(page, label)`:
        -   extracts the existing LMS helper into reusable support.
        -   allows component-internal DataGrid scroll but rejects page-level overflow.

-   [ ] Reuse Playwright best-practice patterns.
    -   Prefer role, label, accessible name, and stable test-id locators.
    -   Prefer web-first assertions.
    -   Keep screenshot capture deterministic and attach evidence only after the page settles.

### Phase 7: Add Canary Regression Coverage For The Reported LMS Defect Class

-   [ ] Add focused LMS runtime UX coverage using the imported/generated LMS snapshot.

    -   Prefer a new `tools/testing/e2e/specs/flows/lms-runtime-ux-regressions.spec.ts` if adding the checks to `snapshot-import-lms-runtime.spec.ts` would make that large spec harder to maintain.
    -   Otherwise add a clearly isolated `test.step` section to `snapshot-import-lms-runtime.spec.ts`.

-   [ ] Cover the exact reported class:

    -   Project create/edit dialog does not expose editable owner/user raw ID fields.
    -   Owner is hidden/server-owned or represented through a human-readable picker/default.
    -   Description is multiline with at least two rows.
    -   Empty optional resource/cover field does not show an error.
    -   Cover/resource data is hidden or rendered as a human-friendly display, never raw JSON.
    -   Course builder / relation builder surfaces do not create page-level horizontal overflow at realistic viewport widths.
    -   Russian locale does not show raw English/internal validation phrases for these controls.
    -   Failures are treated as product/runtime defects, not as flaky visual noise, unless the failure is proven to be an environment issue with attached evidence.

-   [ ] Add fixture-contract assertions if the failure is metadata-driven.
    -   In `tools/testing/e2e/support/lmsFixtureContract.ts`, assert that the LMS snapshot metadata marks long-text fields as textarea, owner/system fields as hidden/server-owned, and cover/resource columns as hidden or display-rendered.
    -   Keep the contract generic enough to avoid overfitting to one label.

### Phase 8: Add GitBook Documentation

-   [ ] Add `docs/en/contributing/runtime-ui-ux-quality-gate.md`.

    -   Explain the gate, examples of bad/good patterns, MUI control mapping, DataGrid display contract, Playwright UX checks, and agent workflow.
    -   Include concise examples for owner/user fields, resource JSON fields, and description fields.

-   [ ] Add `docs/ru/contributing/runtime-ui-ux-quality-gate.md`.

    -   Full Russian parity with the English document.

-   [ ] Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`.

-   [ ] Run `pnpm docs:i18n:check`.

### Phase 9: Validation And Cleanup

-   [ ] Run static validation:

    -   `node tools/agents/check-runtime-ux-agent-invariants.mjs`
    -   `pnpm docs:i18n:check`
    -   Run the narrowest relevant lint command first.
    -   Use full `pnpm lint` only when JavaScript/TypeScript changes span multiple packages or the touched scope is unclear.

-   [ ] Run focused package validation if TypeScript source changes:

    -   `pnpm --filter @universo/apps-template-mui lint`
    -   `pnpm --filter @universo/apps-template-mui test`
    -   `pnpm --filter @universo/apps-template-mui build`

-   [ ] Run focused E2E validation for the new UX canary:

    -   Start minimal local Supabase for E2E when needed:
        -   `pnpm supabase:e2e:start:minimal`
        -   `pnpm env:e2e:local-supabase`
        -   `pnpm doctor:e2e:local-supabase`
    -   Run the target Playwright spec through the repository runner, for example:
        -   `cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs flows/lms-runtime-ux-regressions.spec.ts --project chromium`
    -   If the new checks live inside `snapshot-import-lms-runtime.spec.ts`, run that focused spec instead.

-   [ ] Update Memory Bank after implementation:
    -   Add the active checklist to `memory-bank/tasks.md` at IMPLEMENT start.
    -   Add a completion entry to `memory-bank/progress.md` after validation passes.

## Requirement Coverage Matrix

| Requirement                                               | Plan Coverage                                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Prevent raw User ID fields and hidden-knowledge workflows | Skills field-control contract, mode gates, reviewer profiles, Playwright semantic field checks, LMS canary                     |
| Prevent raw JSON in user-facing tables                    | DataGrid display contract, `expectNoTechnicalLeakage`, LMS cover/resource canary                                               |
| Make Description and similar fields multiline             | Field-control contract, Playwright semantic controls, LMS canary                                                               |
| Use MUI dashboard/template patterns instead of one-off UI | `dashboard-template-contract.md`, mode gates, `mui-runtime-reviewer`                                                           |
| Support PLAN/IMPLEMENT/QA workflow checks                 | Mode updates plus `plan-ux-reviewer`, `runtime-ux-qa`, `test-oracle-reviewer`                                                  |
| Support Codex and other agents                            | Portable skills plus self-contained native files for Codex, Gemini, Claude, GitHub, Qoder, Kiro                                |
| Avoid unreliable thin wrappers                            | Native files contain full instructions; drift-control checks detect missing invariants                                         |
| Avoid unsafe or stale agent instructions                  | Instruction-only default, read-only reviewer roles, drift-control unsafe-pattern checks, no opaque third-party skill vendoring |
| Prove the new skills actually catch the defects           | Skill `evaluation.md` fixtures and drift checks for trigger/non-trigger coverage                                               |
| Add browser-based UX proof                                | Playwright runtime UX helpers and LMS regression spec                                                                          |
| Keep documentation in GitBook format                      | EN/RU contributing guide plus `SUMMARY.md` updates                                                                             |

## Potential Challenges

-   Cross-agent file formats differ. Mitigation: keep `.agents/agent-profiles` as the authoring source, but make native files full and self-contained.
-   Instruction duplication can drift. Mitigation: add `check-runtime-ux-agent-invariants.mjs` and make it part of validation.
-   Technical-leakage assertions can be too broad and fail legitimate admin/debug surfaces. Mitigation: scope helpers to user-facing dialogs/grids and support explicit allow lists.
-   DataGrid internals may contain hidden serialized text or virtualized content. Mitigation: scan visible user-facing cells/regions, not the entire document blindly.
-   Page-level overflow checks must allow DataGrid internal scroll. Mitigation: check `documentElement` overflow for page-level regressions and separately inspect constrained components where needed.
-   Some tools may not automatically load `.agents/skills`. Mitigation: mode files and native reviewer instructions should explicitly mention when to load or inline the skills/checklists.
-   Creating many native files can be noisy. Mitigation: start with five reviewer roles only and keep their invariant anchors consistent.
-   Reviewer profiles can become security-sensitive operational prompts. Mitigation: keep them instruction-only and read-only, add unsafe-pattern checks, and do not import unreviewed third-party skill bundles.
-   Skill trigger descriptions can be too broad and cause noise. Mitigation: include should-trigger and should-not-trigger fixtures and adjust descriptions based on those fixtures.
-   A failing canary may tempt future agents to add broad allow lists. Mitigation: require evidence for every allow-list entry and keep allow lists scoped to admin/debug surfaces only.

## Definition Of Done

-   Two project-local UX skills exist with focused references.
-   Shared reviewer profiles and self-contained native reviewer files exist for active agent ecosystems.
-   PLAN/IMPLEMENT/QA mode instructions require the Runtime UI UX Quality Gate when UI/runtime/template work is in scope.
-   Drift-control script passes.
-   Skill evaluation fixtures exist and cover both activation and output quality.
-   Playwright UX helpers exist and are used by at least one focused LMS runtime regression flow.
-   The LMS canary catches the reported defect class: raw owner IDs, raw JSON cover cells, single-line descriptions, optional resource-source false errors, untranslated/internal validation, and page-level horizontal overflow.
-   GitBook EN/RU docs describe the gate and pass `pnpm docs:i18n:check`.
-   Validation commands are recorded in the final IMPLEMENT summary.
