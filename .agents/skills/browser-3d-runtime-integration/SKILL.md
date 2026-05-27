---
name: browser-3d-runtime-integration
description: Use when planning, implementing, or reviewing a browser 3D/game runtime surface inside Universo published applications, especially PlayCanvas canvas widgets, Colyseus realtime clients, game HUDs, lazy-loaded engine widgets, input ownership, game loops, cleanup, or Playwright proof in `apps-template-mui`. Requires the Runtime UI UX Quality Gate for any user-facing screen, dialog, card, table, HUD, widget, or canvas surface.
metadata:
    version: '1.0.0'
    scope: 'mmoomm-browser-3d-runtime-integration'
    file_policy: 'markdown-only'
---

# Browser 3D Runtime Integration

Use this skill for the glue between PlayCanvas/Colyseus and the Universo
React/MUI runtime shell.

## Required Companion Skills

When implementation or QA touches runtime UI, also use:

-   `mui-runtime-ux-patterns`
-   `runtime-ux-qa`
-   `playwright-best-practices`

For engine-specific decisions, use `playcanvas-engine-runtime`. For room/network
decisions, use `colyseus-authoritative-multiplayer`.

## Required Output

Before implementation, state:

-   the `apps-template-mui` widget zone or runtime surface that owns the canvas;
-   existing MUI/app-template primitives being reused;
-   engine and multiplayer package imports and runtime targets;
-   lazy-loading strategy if bundle cost matters;
-   game loop, input, focus, pointer lock, and cleanup ownership;
-   UI Contract for all screens, HUDs, dialogs, cards, tables, widgets, and
    canvas surfaces;
-   browser evidence required by QA.

## Workflow

1. Mount the 3D experience inside `apps-template-mui`; do not build a parallel
   application shell.
2. Reuse existing dashboard, widget, dialog, list, table, DataGrid, card, and
   toolbar primitives before proposing a new UI primitive.
3. Lazy-load PlayCanvas and Colyseus client code when route-level bundle size or
   first paint matters.
4. Separate platform data from realtime state: use platform/TanStack Query data
   for slow metadata and Colyseus for realtime room state.
5. Keep HUD/dialog/list controls in MUI and world rendering in the canvas.
6. Keep game loops outside React render loops; bridge summarized UI state only.
7. Define input ownership for keyboard, pointer, pointer lock, focus, Escape,
   dialogs, and text fields.
8. Handle mount/unmount, visibility changes, resize observers, network cleanup,
   and engine cleanup.
9. Require browser evidence for implemented runtime UI.

## Blocking Rules

-   Do not expose raw room IDs, player IDs, session IDs, record IDs, JSON,
    `[object Object]`, protocol errors, Zod errors, or server stack details on
    normal user surfaces.
-   Do not capture keyboard or pointer input in a way that traps users in the
    canvas or breaks dialogs/text fields.
-   Do not drive per-frame transforms through React state.
-   Do not introduce document-level horizontal overflow.
-   Do not add one-off page shells, cards, dialogs, or tables when existing
    `apps-template-mui` or MUI primitives fit.

## References

-   Read `references/react-mui-canvas-boundary.md` for widget-shell, primitive
    reuse, and runtime UI rules.
-   Read `references/browser-game-loop-and-input.md` for loops, input, focus,
    and cleanup.
-   Read `references/runtime-ui-contract.md` for the required UI Contract.
