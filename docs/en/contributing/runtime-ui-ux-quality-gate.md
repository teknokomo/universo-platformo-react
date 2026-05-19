# Runtime UI UX Quality Gate

This gate prevents technically wired but unusable runtime interfaces in published MUI applications.

It applies when work touches MUI runtime screens, app-template dashboards, metahub template UI metadata, CRUD dialogs, DataGrid/table/card displays, relation builders, resource-source fields, or UI E2E flows.

## Required Agent Skills

Use these project-local skills:

-   `.agents/skills/mui-runtime-ux-patterns`
-   `.agents/skills/runtime-ux-qa`

Reviewer profiles live in `.agents/agent-profiles` and are mirrored into native agent directories such as `.codex/agents`, `.gemini/agents`, `.claude/agents`, `.github/agents`, `.qoder/agents`, and `.kiro/steering/agent_profiles`.

Run drift validation after changing them:

```bash
pnpm check:runtime-ux-agents
```

## Non-Negotiable Rules

-   Do not expose raw user-facing IDs or hidden-knowledge workflows on normal user surfaces.
-   Do not show raw JSON, `[object Object]`, or object cells in normal tables or cards.
-   Use multiline controls for semantic long text such as description, notes, summary, details, body, instructions, feedback, and comments.
-   Localize validation messages and do not show raw Zod/internal messages.
-   Reuse existing MUI dashboard/app-template primitives before creating new UI.
-   Implemented UI needs browser evidence, including no page-level horizontal overflow.

## UI Contract

Every runtime UI plan must include a UI Contract for each touched screen, dialog, table, or card:

| Area                 | Required Decision                                                          |
| -------------------- | -------------------------------------------------------------------------- |
| Field semantics      | What the user understands this field to mean                               |
| Control type         | Text input, textarea, select, picker, resource-source editor, block editor |
| Display value        | What appears in DataGrid/cards instead of raw stored values                |
| Hidden/system fields | Owner/current-user/server-owned fields that users should not edit          |
| Defaults             | Values derived from runtime context                                        |
| Validation           | Localized user-facing errors                                               |
| Responsive proof     | Browser widths and screenshots/checks                                      |

## Examples

Bad:

-   `OwnerId` as a free text field.
-   `Cover` shown in a grid as `{"type":"video","url":"..."}`.
-   `Description` as a single-line input.
-   Russian UI showing `String must contain at least 1 character(s)`.

Good:

-   Owner is server-owned current user or a human-readable picker.
-   Cover uses the shared resource-source editor and is hidden from default grids unless a preview renderer exists.
-   Description uses a textarea with at least two rows.
-   Optional resource-source fields stay quiet until a source is provided.

## Playwright UX Oracles

Use `tools/testing/e2e/support/browser/runtimeUx.ts` for reusable checks:

-   `expectNoTechnicalLeakage`
-   `expectSemanticFieldControls`
-   `expectLocalizedValidation`
-   `expectNoPageHorizontalOverflow`
-   `expectRuntimeUxViewportMatrix`
-   `expectElementFitsViewport`

The shared viewport matrix is `1920x1080`, `768x1024`, and mobile `390x844`. A feature may use a narrower matrix only when its documented support boundary explicitly excludes a viewport.

Tests should use user-facing locators, labels, roles, stable test IDs, and web-first assertions. CRUD success alone is not enough.
