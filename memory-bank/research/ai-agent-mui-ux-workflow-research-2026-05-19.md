# Research: AI Agent Workflow For User-Friendly MUI Interfaces

> Created: 2026-05-19
> Status: Draft
> Trigger: User RESEARCH request after LMS runtime UI defects where agent-generated MUI screens were technically functional but not usable by humans.
> Follow-up plan: `../plan/ai-agent-mui-ux-workflow-plan-2026-05-19.md`

## Research Question

How should Universo Platformo configure coding agents, skills, custom modes, QA prompts, and browser tests so agents produce and verify MUI dashboard/runtime interfaces that are genuinely usable, not just technically connected to data?

The immediate defects that motivated the research are:

-   A project form exposed `Owner ID` as a raw text field instead of a user picker, an "assign to me" default, or a hidden server-owned value.
-   A Projects table displayed a raw JSON cover/resource object instead of a thumbnail, media badge, link preview, or no column at all.
-   A semantic long-text `Description` field rendered as a single-line input instead of a multiline text area.

## Source Inventory

| Source                                                               | Type                             | Accessed   | Why It Matters                                                                                                                                                                                                |
| -------------------------------------------------------------------- | -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.backup/Как-настроить-ИИ-агентов.md`                                | Local prior research             | 2026-05-19 | Directly analyzes the same three LMS UI defects and proposes skills, UX QA prompts, and repo-local rules.                                                                                                     |
| `.backup/Улучшение-ИИ-генерации-пользовательских-интерфейсов.md`     | Local prior research             | 2026-05-19 | Provides a broader model for agent rules, MUI field mapping, DataGrid rendering, and heuristic UX audits.                                                                                                     |
| `packages/universo-react-apps-template-mui/src/components/dialogs/FormDialog.tsx`   | Local code                       | 2026-05-19 | Shows the runtime form already supports `textarea`, row counts, hidden fields, resource-source widgets, localized validation, and select/reference controls.                                                  |
| `packages/universo-react-apps-template-mui/src/utils/columns.tsx`                   | Local code                       | 2026-05-19 | Shows the runtime grid already supports `gridHidden`, custom cell rendering, REF display labels, and textarea cell rendering, but still depends on metadata to avoid bad defaults.                            |
| `packages/universo-react-apps-template-mui/src/utils/displayValue.ts`               | Local code                       | 2026-05-19 | Shows the generic display fallback uses `JSON.stringify()` for opaque objects without recognized display keys, which is useful for diagnostics but unsafe as a user-facing default for media/resource fields. |
| `tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`  | Local tests                      | 2026-05-19 | Shows LMS browser tests already use runtime navigation, screenshots, and horizontal-overflow checks, but the UX gates need to be formalized as reusable anti-regression assertions.                           |
| MUI Dashboard template                                               | Official documentation           | 2026-05-19 | Confirms the project is based on a standard MUI dashboard shell, which should be extended through existing patterns instead of new one-off surfaces.                                                          |
| MUI TextField                                                        | Official documentation           | 2026-05-19 | Confirms `multiline`, `minRows`, and `maxRows` are first-class patterns for long text.                                                                                                                        |
| MUI Autocomplete                                                     | Official documentation           | 2026-05-19 | Confirms asynchronous "load on open" and "search as you type" selection patterns suitable for user pickers.                                                                                                   |
| MUI X Data Grid cells and columns                                    | Official documentation           | 2026-05-19 | Confirms `valueGetter`, `valueFormatter`, `renderCell`, and column visibility are the intended paths for derived/human-readable values and hidden technical columns.                                          |
| WAI-ARIA APG combobox pattern                                        | W3C documentation                | 2026-05-19 | Supports searchable pickers/selectors instead of forcing users to recall opaque identifiers.                                                                                                                  |
| WCAG 2.2 Reflow                                                      | W3C recommendation               | 2026-05-19 | Provides an accessibility basis for rejecting page-level two-dimensional scrolling except for narrow exceptions such as actual data tables.                                                                   |
| Nielsen Norman Group 10 usability heuristics                         | UX reference                     | 2026-05-19 | Provides the heuristic language for "recognition rather than recall", "match with the real world", "error prevention", "consistency", and "aesthetic/minimalist design".                                      |
| Playwright best practices, visual comparisons, accessibility testing | Official documentation           | 2026-05-19 | Confirms tests should target user-visible behavior and can combine screenshots with axe-based accessibility checks.                                                                                           |
| Testing Library guiding principles                                   | Official documentation           | 2026-05-19 | Reinforces that tests gain confidence when they resemble real user interaction.                                                                                                                               |
| Agent Skills specification and best practices                        | Agent Skills documentation       | 2026-05-19 | Defines `SKILL.md`, progressive disclosure, focused references, validation loops, and evidence-based skill evaluation.                                                                                        |
| Codex `AGENTS.md`, Skills, and Subagents docs                        | OpenAI documentation             | 2026-05-19 | Confirms Codex reads `AGENTS.md`, scans repository skills from `.agents/skills`, and expects project custom agents as `.codex/agents/*.toml`.                                                                 |
| OpenAI Harness Engineering                                           | OpenAI article                   | 2026-05-19 | Supports short `AGENTS.md` as a map, repository-local knowledge as the source of truth, and browser/screenshot/DOM legibility for UI QA.                                                                      |
| Anthropic Building Effective Agents / Writing Tools For Agents       | Anthropic engineering references | 2026-05-19 | Supports evaluator-optimizer loops, ground-truth feedback, clear tool boundaries, and avoiding raw opaque IDs in agent-readable outputs.                                                                      |
| Claude Code subagents and skills docs                                | Anthropic documentation          | 2026-05-19 | Confirms Claude project subagents are Markdown files in `.claude/agents/`, where the file body becomes the subagent system prompt, and Claude skills follow the Agent Skills standard.                        |
| Gemini CLI context, extensions, and subagents docs                   | Google/Gemini CLI documentation  | 2026-05-19 | Confirms Gemini uses `GEMINI.md` context files, supports imports, and defines custom subagents as Markdown files in `.gemini/agents/*.md`.                                                                    |
| VS Code / GitHub Copilot custom agents docs                          | Microsoft/GitHub documentation   | 2026-05-19 | Confirms Copilot custom agents are Markdown agent profiles under `.github/agents`, while VS Code can also detect Claude-format `.claude/agents`.                                                              |
| Roo Code custom modes                                                | Tool documentation               | 2026-05-19 | Confirms custom modes can specialize behavior, restrict tools, and standardize team workflows. This maps to the repo's existing `.gemini`, `.github`, `.claude`, `.qoder`, and `.kiro` mode files.            |
| Community UX/MUI skill registries                                    | Secondary examples               | 2026-05-19 | Shows UX audit and MUI skills exist in the ecosystem, but they vary in provenance and should be treated as inspiration, not imported blindly.                                                                 |

## Key Findings

### 1. The observed failures are agent workflow failures, not MUI limitations

Material UI already has the primitives needed for the reported cases:

-   Long text belongs in `TextField multiline` with bounded rows.
-   Selecting an entity from a known set belongs in `Autocomplete`, `Select`, or a domain record picker, not in a raw UUID text field.
-   DataGrid cells should render derived, formatted, or custom React content when raw row values are not meaningful to a user.
-   Technical columns can be hidden or controlled through column visibility models.

The local runtime layer also already contains many necessary hooks: `FormDialog` supports textarea widgets, hidden fields, resource-source widgets, enum/reference selects, and localized validation; `columns.tsx` supports `gridHidden` and custom renderers; LMS E2E tests already include screenshots and page-overflow checks. The missing piece is a mandatory product/UX contract that tells agents when these capabilities must be used.

### 2. "Functional tests passed" is not enough because the missing oracle was UX semantics

The prior tests could prove that:

-   routes loaded,
-   dialogs opened,
-   records could be created, copied, deleted, and progressed,
-   screenshots were captured,
-   broad horizontal page overflow did not occur in selected paths.

They did not necessarily fail on the UX defects because those defects are semantic:

-   A raw ID input is still a valid input element.
-   Raw JSON is still visible text.
-   A single-line Description is still a valid `TextField`.

The next QA layer needs explicit negative assertions for technical leakage and field semantics, for example:

-   user-facing dialogs must not expose editable `*Id`, `OwnerId`, `UserId`, `AssignedUserId`, or UUID-only fields unless the metadata marks the field as admin/debug-only;
-   user-facing grids must not render raw JSON-like strings for media/resource/localized/content fields;
-   semantic long-text fields such as description, notes, summary, comment, details, body, instructions, and feedback must render as multiline by default;
-   user-facing validation messages must be localized and must not expose Zod/internal implementation text;
-   page-level horizontal overflow must be blocked across desktop, tablet, and mobile viewports, while table-internal scroll remains allowed where appropriate.

### 3. Use short root instructions plus focused skills, not a giant AGENTS file

OpenAI's harness engineering write-up recommends a short `AGENTS.md` as a table of contents and repository-local docs as the real source of truth. Agent Skills documentation reaches the same operational conclusion through progressive disclosure: the agent should load a small skill description up front, then only load the full `SKILL.md` and focused references when the task requires them.

For this repository, the root `AGENTS.md` should remain compact. Detailed UI behavior should live in project-local skills and documentation:

-   `.agents/skills/mui-runtime-ux-patterns/SKILL.md`
-   `.agents/skills/runtime-ux-qa/SKILL.md`
-   optional references under those skills for field mapping, DataGrid rendering, browser QA, and localized validation.

This fits the repository's existing convention: it already has project-local skills, custom mode files, and Memory Bank artifacts.

### 4. Existing backup research is directionally correct but should be normalized into stricter project rules

Both backup files correctly identify the same root issue: agents mechanically map data schemas to UI controls unless the product semantics are explicit and testable. They are strongest where they tie decisions to MUI docs, Nielsen heuristics, and current code.

The backup files should be refined before implementation planning in three ways:

-   Treat community skill marketplaces and Reddit-style examples as weak evidence. They prove that the ecosystem has UX-audit skills, not that any particular third-party skill is safe or high quality.
-   Convert broad advice into enforceable project rules and testable acceptance criteria.
-   Prefer existing runtime metadata and app-template components over new LMS-only UI components.

### 5. Recommended MUI mapping contract

The agent workflow needs a stable table that every PLAN, IMPLEMENT, and QA pass must apply.

| Data/UI Semantics                                                   | Default UI                                                                                                         | Forbidden Default                                             | Metadata Needed                                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Owner, author, learner, assignee, reviewer, user, group, role       | User/record picker with label/email/name, or hidden server-owned default when current user is the only valid owner | Raw editable UUID/text ID                                     | `widget: 'reference'`, `recordPicker`, `defaultValue: runtime.currentUserId`, `formHidden`, `gridHidden`, or server-owned field config |
| Foreign key to known runtime object                                 | `Autocomplete`, `Select`, relation builder, or generic record picker                                               | Raw text field unless explicitly admin/debug                  | target object metadata, display field, filters, search endpoint                                                                        |
| Description, notes, summary, details, body, instructions, feedback  | `TextField multiline`, normally `rows`/`minRows` 2-4                                                               | Single-line input                                             | `uiConfig.widget = 'textarea'`, `uiConfig.rows`                                                                                        |
| Cover, avatar, media, resource source, file, URL package descriptor | Preview, image/avatar, icon chip, link badge, or hidden from grid                                                  | Raw JSON object in grid cell                                  | `uiConfig.widget = 'resourceSource'`, renderer contract, `gridHidden` when not useful                                                  |
| Structured JSON used for machine behavior                           | Hidden by default, or diagnostics-only behind admin/debug mode                                                     | Raw JSON on normal user surfaces                              | `formHidden`, `gridHidden`, `adminOnly`, `debugOnly`                                                                                   |
| Enum/status/boolean                                                 | MUI `Select`, radio group, `Chip`, checkbox display                                                                | Raw codename when label is available                          | enum labels and i18n keys                                                                                                              |
| Dates/numbers/progress                                              | localized formatting, percent/status chips where useful                                                            | unformatted raw strings when semantic formatting is available | formatter metadata or generic display helpers                                                                                          |

### 6. Recommended agent workflow

The next plan should turn UX quality into a mandatory three-pass loop.

1. Research/Plan pass:

    - Identify the user roles, user journey, data semantics, and expected MUI controls.
    - Include a "UI Contract" section for every screen/dialog/table touched.
    - Explicitly list what must be hidden, formatted, selected by display value, defaulted from runtime context, and localized.

2. Implementation pass:

    - Load the MUI runtime UX skill when touching `packages/universo-react-apps-template-mui`, `packages/universo-react-template-mui`, metahub template data, runtime metadata, or E2E UI flows.
    - Reuse existing app-template/dashboard primitives before creating new UI.
    - Update metadata so the generic runtime renderer does the right thing, instead of hardcoding LMS-only behavior.
    - Add tests before or alongside implementation for the specific UX anti-regressions.

3. QA pass:
    - Load a strict runtime UX QA skill.
    - Review as a human user, not only as a compiler/test runner.
    - Use Playwright browser evidence: create/edit/copy/delete path, keyboard path, localized error path, responsive widths, screenshots, and no technical leakage.
    - Return a structured verdict with `blockers`, `major issues`, `minor issues`, `evidence`, and `required fixes`.

### 7. UX QA must use both heuristics and executable checks

Nielsen heuristics explain why the defects are serious:

-   Raw User ID violates recognition over recall and match with the real world.
-   Raw JSON violates aesthetic/minimalist design and match with the real world.
-   A single-line Description violates flexibility and efficiency for the actual task.
-   English/internal validation messages in a Russian UI violate consistency and help users recover from errors.
-   Page-level horizontal overflow violates WCAG Reflow unless the overflow is constrained to a component such as a data table.

Executable Playwright checks should enforce these heuristics where possible:

-   `expectNoTechnicalLeakage(surface)` scans visible cells and dialogs for raw JSON-like values, UUID-only labels, internal field names, and untranslated validation phrases.
-   `expectSemanticFieldControls(dialog, contract)` verifies that long-text fields are textareas and reference/user fields are select/picker controls.
-   `expectRuntimeCrudUserJourney(...)` performs create, edit, copy, delete/restore, cancel, validation, and keyboard navigation from the user's point of view.
-   viewport matrix covers wide desktop, narrow desktop/tablet, and mobile widths.
-   screenshots are attached only after deterministic settling; visual comparisons can be added once the layout stabilizes.
-   axe-based checks cover baseline WCAG A/AA regressions, but they do not replace semantic UX assertions.

### 8. Subagents/custom modes are useful for QA, but only with narrow scope and evidence requirements

The user did not ask to run subagents in this research pass, but the implementation process can use narrow reviewers when explicitly requested. The most useful split is:

-   `mui-runtime-reviewer`: checks MUI control choice, grid rendering, metadata contracts, and template consistency.
-   `ux-flow-reviewer`: checks whether the user can complete the journey without hidden knowledge.
-   `a11y-responsive-reviewer`: checks keyboard path, labels, localized errors, reflow, screenshots, and no page overflow.
-   `test-oracle-reviewer`: checks whether automated tests would have caught the defects.

Anthropic's evaluator-optimizer and parallelization patterns support this split when the criteria are clear and each reviewer has a different perspective. OpenAI's harness engineering write-up supports browser-legible validation loops where the agent can inspect DOM, screenshots, and logs.

### 9. Shared `.agents/` should be the authoring source, but critical subagent files should be native and self-contained

The cross-agent structure should separate portable skills from platform-native subagents:

-   `.agents/skills/*/SKILL.md` is a strong shared layer because Codex officially scans repository skills from `.agents/skills`, and Agent Skills are explicitly Markdown-based portable workflow packages.
-   `.agents/agent-profiles/*.md` can be the human-maintained authoring source for reviewer roles, but current agent products do not all treat this directory as a native subagent registry.
-   Codex custom agents are official TOML files under `.codex/agents/*.toml`.
-   Claude Code custom subagents are official Markdown files under `.claude/agents/*.md`.
-   Gemini CLI custom subagents are official Markdown files under `.gemini/agents/*.md`.
-   VS Code/GitHub Copilot custom agents are official Markdown files under `.github/agents/*.agent.md` or `.github/agents/*.md`.

Thin wrappers that only say "read `.agents/agent-profiles/foo.md`" are convenient, but they add a reliability risk: a model may not follow the link, a product may not automatically expand the linked file, or another repository may copy only the native agent directory and omit the shared source. For critical QA roles, each native agent file should therefore include the full behavior-defining instructions in its own body or configuration field.

This is acceptable duplication because these files are not executable business logic. The main risk is instruction drift, not code duplication. Drift can be controlled by one of these approaches:

-   start with manually duplicated native files plus a QA checklist that verifies all critical invariants are present;
-   add a small sync/check script that compares required invariant phrases across `.codex/agents`, `.gemini/agents`, `.claude/agents`, `.github/agents`, and `.agents/agent-profiles`;
-   if the agent set grows, generate native files from `.agents/agent-profiles` and platform-specific templates, marking generated outputs clearly.

## Conflicts And Uncertainty

-   No single official "MUI UX for Codex" skill appears to be a canonical standard. There are community UX/MUI skills, but their provenance, safety, and freshness vary. The safe route is to synthesize project-local skills from official MUI/WCAG/Playwright sources plus this repository's existing patterns.
-   There is no single portable subagent file format across Codex, Claude, Gemini, GitHub Copilot, Qoder, and Kiro. Skills are the more portable abstraction; subagents still need product-native wrappers.
-   Markdown links inside custom agent files are useful for maintenance, but they are weaker than embedding the critical instructions directly. They should not be the only carrier of blocking QA rules.
-   MUI `renderCell()` is powerful but not the first choice for every field. MUI X positions `valueGetter()` and `valueFormatter()` as lighter display mechanisms, with `renderCell()` for React-node content. The project should prefer the simplest renderer that produces a human display value.
-   Some technical identifiers legitimately belong in admin/debug screens. The rule should be "no raw IDs in user-facing business workflows by default", with explicit metadata exceptions.
-   Automated UX checks cannot prove that a workflow is pleasant. They can reliably catch common anti-patterns and force the agent to provide browser evidence, but human exploratory QA remains valuable for complex product flows.
-   WCAG allows two-dimensional scrolling for actual data tables and certain complex visual content. The project should reject page-level horizontal overflow while allowing constrained internal DataGrid scroll where it is the expected MUI behavior.

## Project Implications

The next PLAN should avoid new LMS-only UI components unless a generic runtime extension is genuinely insufficient.

Recommended implementation targets:

-   Add `.agents/skills/mui-runtime-ux-patterns/SKILL.md`.
-   Add `.agents/skills/runtime-ux-qa/SKILL.md`.
-   Add focused references under those skills:
    -   `references/field-control-contract.md`
    -   `references/data-grid-display-contract.md`
    -   `references/playwright-ux-oracles.md`
-   Add `.agents/agent-profiles/` as the shared authoring source for reviewer/subagent role content:
    -   `plan-ux-reviewer.md`
    -   `mui-runtime-reviewer.md`
    -   `runtime-ux-qa.md`
    -   `test-oracle-reviewer.md`
    -   `a11y-responsive-reviewer.md`
-   Add full self-contained native agent files, not link-only wrappers:
    -   `.codex/agents/*.toml` with full `developer_instructions` for Codex.
    -   `.gemini/agents/*.md` with full Markdown bodies for Gemini CLI.
    -   `.claude/agents/*.md` with full Markdown bodies for Claude Code.
    -   `.github/agents/*.agent.md` or `.github/agents/*.md` with full Markdown bodies for GitHub Copilot / VS Code.
    -   Qoder and Kiro equivalents only where those tools have active project use.
-   Update `.gemini/rules/custom_modes/plan_mode.md`, `implement_mode.md`, and `qa_mode.md` to load or require these skills when UI/runtime/template work is in scope.
-   Add a drift-control check or checklist so native agent files keep the same critical UX invariants as `.agents/agent-profiles`.
-   Add a GitBook-style documentation page under `docs/` describing the UI quality gate and the runtime metadata UI contract.
-   Add reusable Playwright helpers for:
    -   no technical leakage,
    -   semantic control assertions,
    -   localized validation assertions,
    -   responsive/reflow assertions.
-   Add a focused LMS runtime UX regression spec for the exact failure class:
    -   project create/edit form has no editable owner-id field;
    -   project owner defaults to the current user or is hidden/server-owned;
    -   description is multiline;
    -   cover/resource field does not show an error when empty optional state is valid;
    -   cover column is hidden or rendered as a user-friendly media display, never raw JSON;
    -   course builder and relation-builder layouts do not cause page-level horizontal overflow at realistic widths.

## Recommended Decision

Adopt a repository-level "Runtime UI UX Quality Gate" based on project-local skills and executable QA oracles.

The gate should be treated as blocking for UI/runtime/template changes:

-   `.agents/skills` is the portable workflow layer.
-   `.agents/agent-profiles` is the shared authoring layer for reviewer roles.
-   Native subagent/custom-agent files must be self-contained for each actively used agent product, because critical instructions should not depend on optional file-link expansion.
-   No user-facing raw ID fields unless explicitly justified by metadata and role.
-   No user-facing raw JSON/object display unless explicitly marked diagnostics/admin-only.
-   Semantic long-text fields are multiline by default.
-   MUI Dashboard/app-template primitives are reused before new UI is created.
-   Browser QA must include screenshots, responsive widths, localized error states, and user-visible assertions.
-   QA reports must answer whether the result is actually usable by a human, not only whether code compiles or routes respond.

## Open Questions Before PLAN

-   Should the next implementation create two skills (`mui-runtime-ux-patterns`, `runtime-ux-qa`) or three skills by splitting DataGrid rendering into its own skill? Recommended default: start with two skills and keep DataGrid as a reference file.
-   Should UX gates be blocking in CI immediately, or start as focused local/E2E regression specs until stable? Recommended default: add focused regression specs now, then promote stable helpers to CI gates.
-   How much cross-agent mirroring is required in the first pass? Updated recommendation: create full native files for the actively used agents in the first pass, but keep the number of roles small and add drift-control checks.
-   Should native agent files be generated from `.agents/agent-profiles`? Recommended default: start with explicit full files plus a required-invariant check; move to generation once the profile set or platform count makes manual maintenance noisy.

## Sources

-   MUI Dashboard template: https://mui.com/material-ui/getting-started/templates/dashboard/
-   MUI TextField multiline docs: https://mui.com/material-ui/react-text-field/#multiline
-   MUI Autocomplete asynchronous requests: https://mui.com/material-ui/react-autocomplete/#asynchronous-requests
-   MUI X Data Grid cells: https://mui.com/x/react-data-grid/cells/
-   MUI X Data Grid column definition: https://mui.com/x/react-data-grid/column-definition/
-   MUI X Data Grid column visibility: https://mui.com/x/react-data-grid/column-visibility/
-   WAI-ARIA APG Combobox pattern: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
-   WCAG 2.2 Reflow: https://www.w3.org/TR/WCAG22/#reflow
-   Nielsen Norman Group, 10 Usability Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
-   Playwright best practices: https://playwright.dev/docs/best-practices
-   Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
-   Playwright accessibility testing: https://playwright.dev/docs/accessibility-testing
-   Testing Library guiding principles: https://testing-library.com/docs/guiding-principles/
-   Agent Skills specification: https://agentskills.io/specification
-   Agent Skills best practices: https://agentskills.io/skill-creation/best-practices
-   Agent Skills evaluation: https://agentskills.io/skill-creation/evaluating-skills
-   OpenAI Codex, AGENTS.md: https://developers.openai.com/codex/guides/agents-md
-   OpenAI Codex, Skills: https://developers.openai.com/codex/skills
-   OpenAI Codex, Subagents: https://developers.openai.com/codex/subagents
-   OpenAI, Harness engineering: https://openai.com/index/harness-engineering/
-   Anthropic, Building Effective Agents: https://www.anthropic.com/engineering/building-effective-agents
-   Anthropic, Writing effective tools for AI agents: https://www.anthropic.com/engineering/writing-tools-for-agents
-   Claude Code, custom subagents: https://code.claude.com/docs/en/sub-agents
-   Claude Code, skills: https://code.claude.com/docs/en/skills
-   Gemini CLI, `GEMINI.md` context: https://google-gemini.github.io/gemini-cli/docs/cli/gemini-md.html
-   Gemini CLI, subagents: https://github.com/google-gemini/gemini-cli/blob/main/docs/core/subagents.md
-   VS Code, custom agents: https://code.visualstudio.com/docs/copilot/customization/custom-agents
-   GitHub Copilot, custom agents configuration: https://docs.github.com/en/copilot/reference/custom-agents-configuration
-   Roo Code custom modes: https://docs.roocode.com/features/custom-modes
