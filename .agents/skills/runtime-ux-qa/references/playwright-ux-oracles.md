# Playwright UX Oracles

Use these oracles in browser E2E tests that validate user-facing runtime UI.

## Required Patterns

-   Prefer role, label, accessible name, and stable test-id locators.
-   Prefer web-first assertions over manual sleeps.
-   Attach screenshots only after the page is settled.
-   Keep checks scoped to user-facing dialogs, grids, and cards to avoid scanning hidden framework internals.
-   Allow component-internal DataGrid scroll where expected, but reject page-level horizontal overflow.

## Helper Expectations

-   `expectNoTechnicalLeakage(surface, options)` rejects visible raw JSON-like text, `[object Object]`, raw UUID-only business labels, and internal validation phrases.
-   `expectSemanticFieldControls(dialog, contract)` checks that long-text labels map to textareas and forbidden ID labels are absent or non-editable.
-   `expectLocalizedValidation(surface, locale, options)` checks that localized surfaces do not show raw internal English errors.
-   `expectNoPageHorizontalOverflow(page, label)` rejects document-level horizontal overflow.
-   `expectRuntimeUxViewportMatrix(page, label)` rejects document-level horizontal overflow at the shared runtime viewport matrix: `1920x1080`, `768x1024`, and `390x844`.

## UX Paths To Cover

-   Create, edit, copy, delete/restore where the workflow supports them.
-   Empty optional resource-source field.
-   Invalid validation state in Russian and English.
-   Keyboard path through the primary form/dialog.
-   Viewport matrix: wide desktop `1920x1080`, tablet `768x1024`, and mobile `390x844` where the feature supports it.

## Anti-Patterns

-   CSS/XPath selector chains for business assertions.
-   Assertions that only check HTTP success while ignoring visible output.
-   Broad allow lists for raw JSON or IDs.
-   Skipping UX checks because the current implementation fails them.
