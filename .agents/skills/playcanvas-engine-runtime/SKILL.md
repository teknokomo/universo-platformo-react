---
name: playcanvas-engine-runtime
description: Use when planning, implementing, or QA-reviewing MMOOMM or browser 3D work that uses the Universo PlayCanvas wrapper, PlayCanvas Engine runtime scenes, WebGL canvas lifecycle, camera/light setup, procedural geometry, asset readiness, resize behavior, or cleanup. Applies to `@universo-react/playcanvas-engine` wrapping `playcanvas@2.18.1`; does not cover PlayCanvas Editor, PCUI, PCUI Graph, React Three Fiber, or heavy glTF/Draco/texture pipelines.
metadata:
    version: '1.0.0'
    scope: 'mmoomm-playcanvas-engine-runtime'
    file_policy: 'markdown-only'
---

# PlayCanvas Engine Runtime

Use this skill for PlayCanvas Engine runtime work in Universo, especially MMOOMM
widgets mounted inside the published application shell.

## Version Guard

-   Use `@universo-react/playcanvas-engine`.
-   The wrapper currently re-exports `playcanvas@2.18.1`.
-   Prefer APIs documented for PlayCanvas Engine 2.18.x.
-   Do not assume `@playcanvas/react` is available. It is useful source
    material for integration patterns, but it is not a current wrapper package.

## Required Output

Before implementing or reviewing PlayCanvas runtime code, state:

-   where the canvas mounts and who owns its lifecycle;
-   how many PlayCanvas app/engine instances are created per mounted widget;
-   camera, light, scene graph, material, and mesh setup;
-   asset readiness and failure behavior;
-   resize behavior and bounded container rules;
-   cleanup/disposal behavior;
-   whether procedural geometry or custom normals are used.

## Workflow

1. Initialize exactly one PlayCanvas application per mounted canvas.
2. Keep the canvas bounded by the owning widget/container, not the full page.
3. Build the scene graph with entities, render components, camera, lights,
   materials, meshes, and transforms.
4. For procedural MVP geometry, prefer Engine primitives and explicit geometry
   workflows before introducing asset pipelines.
5. Gate ready UI on asset and scene readiness; provide user-facing failure
   states through the surrounding MUI runtime surface.
6. Resize through the widget/container contract and call the appropriate
   PlayCanvas canvas resize path when the container changes.
7. On unmount, remove event listeners, stop animation/update hooks, detach room
   or input handlers owned by the widget, destroy entities, unload assets where
   appropriate, and destroy the PlayCanvas app.

## Blocking Rules

-   Do not use PlayCanvas Editor workflow assumptions for runtime code.
-   Do not add PCUI or PCUI Graph scope.
-   Do not add glTF/Draco/texture optimization guidance for the MVP skill.
-   Do not create multiple PlayCanvas applications for a single mounted widget.
-   Do not drive 60fps transforms through React state.
-   Do not let canvas layout cause document-level horizontal overflow.
-   Do not expose engine errors, raw asset URLs, or stack details directly to
    normal users.

## References

-   Read `references/playcanvas-engine-runtime-notes.md` for app, scene, asset,
    resize, and cleanup guidance.
-   Read `references/procedural-geometry-and-assets.md` for primitive geometry,
    custom normals, and MVP asset guardrails.
