# Procedural Geometry And MVP Asset Guardrails

## Primitive Geometry

Use procedural geometry for early MMOOMM MVP surfaces when the scene can be
expressed with simple meshes and the goal is to validate runtime, camera,
lighting, multiplayer, and UI integration.

Relevant PlayCanvas Engine 2.18.x APIs include:

-   `BoxGeometry` for box-like objects. It supports size/segment options and can
    generate tangents when needed by materials.
-   `SphereGeometry` for spherical objects. It supports radius and latitude /
    longitude band style controls.
-   `TorusGeometry` for ring/tube objects. It supports tube/ring sizes, segment
    counts, sides, and sector angle.
-   `calculateNormals` for custom meshes when vertex normals must be computed
    from positions and triangle indices.

Operational workflow:

1. Define geometry and any required normals/tangents.
2. Convert geometry into a mesh or renderable resource using the local
   PlayCanvas pattern.
3. Attach it through a render component or mesh instance.
4. Add the owning entity to the scene graph.
5. Destroy or release owned resources during cleanup.

## Normals And Tangents

-   Recalculate normals when constructing custom geometry from raw vertices and
    indices.
-   Generate tangents only when the material/shader needs them.
-   Avoid hiding broken normals with lighting hacks; fix the geometry contract.

## Asset Guardrails

This skill does not cover a production asset pipeline. For MVP work:

-   prefer primitives or small known assets;
-   keep asset loading explicit and fail closed;
-   display user-facing loading/failure states outside the canvas;
-   do not add glTF conversion, Draco compression, texture atlas, or heavy
    optimization guidance here.

## Sources

-   PlayCanvas Engine API v2.18.1: https://api.playcanvas.com/engine-v2.18.1/
-   PlayCanvas Engine examples: https://github.com/playcanvas/engine/tree/main/examples
