# Interpretation Network Runtime Toolbar Button Rail Follow-up Tasks (2026-07-02)

> Status: IMPLEMENT complete
> Scope: align the visible color-mode button itself with the published app content rail without legacy retention or schema/template version bumps.

## Checklist

-   [x] 1. Reproduce the visual mismatch from the supplied screenshots and inspect the rendered toolbar component structure.
-   [x] 2. Run the available OntoIndex impact lookup and identify the isolated apps-template `AppNavbar` symbol.
-   [x] 3. Remove spacing contributed by desktop-hidden mobile toolbar controls so the visible theme button owns the right edge.
-   [x] 4. Replace the container-edge Playwright oracle with a visible color-mode button edge oracle for wide, compact, and overlay modes.
-   [x] 5. Run formatting, focused tests/build/lint/isolation checks, local-Supabase Chromium evidence, screenshots, and closeout review.

## UI Contract

-   The visible color-mode button and the visible runtime content cards share the same right rail; their right edges must differ by no more than 2 px at desktop widths.
-   The side-menu wide/compact button tooltip describes the next action, not the current state.
-   In overlay mode, the docked menu is absent and the drawer toggle remains on the drawer side so users can reopen/close it from the same edge.
-   Compact and overlay modes give the active runtime page the full content width available in the application shell without large side gutters.
-   No page-level horizontal overflow is allowed at desktop, tablet, or mobile widths.

## Closeout Notes

-   Root cause: responsive `display: none` was applied to inner `IconButton` elements while their outer `Badge` wrappers remained flex children; the toolbar therefore retained 16 px in wide/compact mode and 8 px in overlay mode after the visible theme button.
-   Previous tests compared the right edge of `runtime-app-toolbar-actions`, so they validated the wrapper containing those margins instead of the visible theme button.
-   The corrected Playwright oracle compares `[data-testid="runtime-color-mode-button"]` directly with the visible content rail and allows at most a 2 px difference.
