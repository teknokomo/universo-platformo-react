# PlayCanvas Engine Runtime Notes

## Scope

This reference covers direct PlayCanvas Engine runtime use through
`@universo-react/playcanvas-engine`, currently pinned to `playcanvas@2.18.1`.
It is intentionally Engine-only. Do not treat PlayCanvas Editor, PCUI, PCUI
Graph, React Three Fiber, or heavy asset-pipeline concerns as part of this MVP
skill.

## Runtime App Boundary

-   Create the PlayCanvas application from the real canvas owned by the runtime
    widget.
-   Treat the widget mount as the lifecycle owner: create on mount, resize while
    mounted, destroy on unmount.
-   Keep one PlayCanvas app/engine instance per mounted widget. If the widget
    remounts, the previous instance must be fully cleaned up first.
-   Keep game/render loops outside React render cycles. Bridge only summarized
    state to React UI.
-   Register resize listeners or observers through stable function references so
    they can be removed during cleanup.

## Scene Setup

Basic runtime scenes usually need:

-   root child entities for world objects;
-   one active camera, with near/far clips and clear color chosen for the
    runtime view;
-   directional/omni/spot lights as needed for the scene;
-   render components or mesh instances for visible objects;
-   material setup before the object is considered visually ready.

Prefer names that are useful for debugging, but do not display internal entity
names directly to end users.

## Asset Readiness

For MVP runtime widgets:

-   distinguish loading, ready, and failed states;
-   avoid marking the widget ready until required assets or procedural scene
    setup have completed;
-   surface failures through localized MUI UI around the canvas;
-   unload or release assets owned only by the destroyed widget when they are no
    longer needed.

Do not build a general glTF, Draco, or texture optimization pipeline in this
skill. That is later asset-pipeline scope.

## Resize And Layout

-   Size the canvas to its MUI/widget container.
-   Reject document-level horizontal overflow.
-   Component-internal constrained scroll is acceptable only when the container
    is explicitly bounded.
-   Recompute camera/aspect/canvas size after container changes.
-   Do not let the canvas introduce a full-page shell outside
    `apps-template-mui`.

## Cleanup Checklist

On unmount or feature shutdown:

-   remove window, pointer, keyboard, visibility, and resize listeners owned by
    the widget;
-   stop custom requestAnimationFrame loops if any exist outside the Engine;
-   disconnect runtime network/input handlers owned by the view;
-   destroy transient scene entities and their children;
-   unload widget-owned assets when appropriate;
-   destroy the PlayCanvas application.

## Sources

-   PlayCanvas Engine docs: https://developer.playcanvas.com/user-manual/engine/
-   PlayCanvas Engine repository: https://github.com/playcanvas/engine
-   PlayCanvas Engine API v2.18.1: https://api.playcanvas.com/engine-v2.18.1/
-   PlayCanvas React docs, used only as integration inspiration:
    https://developer.playcanvas.com/user-manual/playcanvas-react/
