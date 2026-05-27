# React, MUI, And Canvas Boundary

## Placement

The canvas belongs inside the published application runtime shell, normally as
an `apps-template-mui` widget zone. It must not create a second application
shell, independent navigation system, or full-page layout outside the runtime
dashboard contract.

## Primitive Reuse

Before adding UI:

-   identify the existing dashboard/widget/dialog/list/table/card primitive to
    reuse;
-   keep HUD controls, dialogs, side panels, and status banners in MUI;
-   keep world rendering inside the canvas;
-   document why a new primitive is needed if existing primitives cannot express
    the workflow.

## Data Boundaries

-   Use platform data fetching for slow metadata, configuration, permissions,
    and publication/runtime descriptors.
-   Use Colyseus for realtime room state and authoritative simulation state.
-   Do not mirror high-frequency transform data into React state.
-   Bridge summarized state to UI: connection state, selected object label,
    current mode, warnings, and user-facing errors.

## Runtime Package Imports

Modules may import attached packages only through the runtime package metadata
and compiler allowlist path. Arbitrary static imports, `require()`, dynamic
`import()`, and `import.meta` are rejected by the modules compiler.

Current wrapper target assumptions:

-   `@universo-react/playcanvas-engine`: client/browser.
-   `@universo-react/colyseus-client`: client/browser registry target.
-   `@universo-react/colyseus-server`: server.

## Sources

-   Local architecture skill: `.agents/skills/universo-platform-architecture`
-   Local MUI UX skill: `.agents/skills/mui-runtime-ux-patterns`
-   Local module compiler contract: `packages/universo-react-modules-engine/src/compiler.ts`
