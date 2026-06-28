# Interpretation Network Workspace URL and Catalog UX Tasks (2026-06-28)

> Status: IMPLEMENT complete
> Scope: fix remaining runtime UX defects after importing `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`.

## Checklist

-   [x] 1. Preflight: load IMPLEMENT rules, MUI Runtime UX, Runtime UX QA, Thermos/autoreview instructions, inspect the dirty worktree, and run OntoIndex impact where available.
-   [x] 2. Make the Structures and Materials panes visually balanced: equal pane widths and a Structures catalog title matching Materials.
-   [x] 3. Reuse one local app-template catalog toolbar for Structures and Materials: filter first, table/card icon toggle next, and right-aligned `Create` action.
-   [x] 4. Persist opened Structure state in the runtime URL and restore it on refresh/back navigation without breaking existing `/a/:applicationId/:sectionId` routing.
-   [x] 5. Bring Material language tabs closer to metahub Pages behavior: default-language star, adjacent small three-dot menu, adjacent small add-language button, and localized menu actions.
-   [x] 6. Add or update reliable component tests for layout, catalog toolbar labels, URL restoration, and material language-tab controls.
-   [x] 7. Fix Thermos closeout findings: avoid workspace-id structure URLs and reject malformed batch child row IDs before runtime SQL.
-   [x] 8. Run formatting, focused tests, lint/build, app-template isolation check, OntoIndex diff verification, and Thermos/autoreview where feasible.

## UI Contract

-   Structures and Materials catalogs use the same local `apps-template-mui` controls and do not import metahub/template UI components.
-   Catalog toolbar order is stable: title above, then filter, view toggle, and the `Create` button at the far right on desktop; controls wrap without page-level horizontal overflow on narrow screens.
-   The two main panes inside the Interpretation Network workspace divide the available workspace content width equally.
-   Opened Structure state is represented by a URL segment after the active runtime section and optional workspace segment. Refresh restores the opened structure when the row still exists; invalid structure segments fall back to the structure catalog.
-   Material language controls show the default language immediately, keep add/menu icon buttons small and adjacent to language tabs, and expose only valid localized actions for the current language set.
