---
name: mui-runtime-ux-patterns
description: Use when planning, implementing, or reviewing MUI runtime screens, apps-template MUI dashboards, metahub template metadata, CRUD dialogs, DataGrid/table/card displays, relation builders, resource-source fields, or UI E2E flows. Enforces user-friendly runtime UI contracts: no raw user-facing IDs, no raw JSON/object cells, multiline long-text fields, localized validation, and reuse of existing dashboard primitives.
metadata:
  version: "1.0.0"
  scope: "universo-runtime-mui-ux"
  file_policy: "markdown-only"
---

# MUI Runtime UX Patterns

Use this skill whenever work touches published application runtime UI, `packages/apps-template-mui`, `packages/universo-template-mui`, metahub template metadata, app layouts, CRUD dialogs, DataGrid tables, cards, relation builders, or Playwright browser flows for user-facing runtime screens.

## Required Output

Before implementation, produce or verify a UI Contract for every touched screen, dialog, table, or card:

-   field semantics and user role;
-   default control type;
-   display value in grids/cards;
-   hidden/system-owned fields;
-   default values from runtime context;
-   validation and localized error behavior;
-   responsive behavior and browser proof.

## Blocking Rules

-   Normal user-facing surfaces must not expose raw editable `*Id`, `OwnerId`, `UserId`, `AssignedUserId`, UUID-only values, or hidden-knowledge workflows unless explicitly marked admin/debug-only.
-   Semantic long-text fields such as `description`, `notes`, `summary`, `details`, `body`, `instructions`, `feedback`, and `comment` must use multiline controls by default.
-   Media, cover, file, resource-source, block-content, and structured JSON fields must be hidden, formatted, or rendered with previews/badges. Raw `JSON.stringify()` output is not acceptable on normal grids/cards.
-   Validation messages must be localized and user-facing. Raw Zod/internal messages are defects on localized surfaces.
-   Reuse existing MUI dashboard/app-template primitives before creating new widgets or layouts.
-   Fix generic runtime metadata/rendering behavior where possible. Do not add LMS-only UI forks for generic problems.

## References

-   Read `references/field-control-contract.md` when mapping metadata fields to form controls.
-   Read `references/data-grid-display-contract.md` when table/card output or DataGrid columns are affected.
-   Read `references/dashboard-template-contract.md` when app layout, widgets, relation builders, or dashboard consistency are affected.
-   Read `references/evaluation.md` when checking that this skill would catch known bad UI plans.
