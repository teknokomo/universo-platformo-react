# MMOOMM 3D And Multiplayer Skills Research - 2026-05-27

## Research Question

What project-local `.agents/skills/` set should be planned before MMOOMM MVP implementation so agents have reusable operational guidance for PlayCanvas Engine, server-authoritative Colyseus multiplayer, and browser 3D/game integration inside the Universo runtime shell?

## Source Inventory

### Local Project Sources

| Source                                                                             | Role                                       | Decision relevance                                                                                                                                                                   |
| ---------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| First `.backup/` PlayCanvas/metahubs prior research file named in the brief        | Prior deep research outside the repository | Treat MMOOMM as a platform-native MUI shell plus embedded PlayCanvas viewport and Colyseus room, not as a separate game beside Universo.                                             |
| Second `.backup/` MMO/PlayCanvas/Universo prior research file named in the brief   | Prior deep research outside the repository | Confirms candidate skill areas: PlayCanvas engine, browser 3D integration, and multiplayer. Also mentions Blender/R3F/scroll patterns that should be deferred for the current brief. |
| `.agents/skills/research-before-plan/SKILL.md`                                     | Required research workflow                 | Requires a cited Memory Bank research artifact before PLAN when external/current sources shape the decision.                                                                         |
| `.agents/skills/universo-platform-architecture/SKILL.md`                           | Architecture guardrail                     | New skills must keep behavior inside the metahub/application/workspace and `apps-template-mui` runtime boundaries.                                                                   |
| `.agents/skills/mui-runtime-ux-patterns/SKILL.md`                                  | Runtime UI guardrail                       | Browser 3D widgets must reuse dashboard/runtime primitives and avoid raw IDs, raw JSON, hidden-knowledge workflows, or page-level overflow.                                          |
| `.agents/skills/runtime-ux-qa/SKILL.md`                                            | QA guardrail                               | QA skills or references must require browser evidence for normal-user workflows, including responsive layout and no technical leakage.                                               |
| `.agents/skills/SOURCES.md`                                                        | Skill source registry pattern              | New skills must register source, license, and local adaptation notes.                                                                                                                |
| `.kiro/steering/structure.md`                                                      | Package naming convention                  | Wrapper packages follow `packages/universo-react-<name>/` and `@universo-react/<name>`.                                                                                              |
| `memory-bank/techContext.md` and `memory-bank/systemPatterns.md`                   | Canonical runtime context                  | Skills must align with the current monorepo, MUI runtime, package, and database transition rules.                                                                                    |
| `packages/universo-react-playcanvas-engine/package.json` and `pnpm-workspace.yaml` | Wrapper version source                     | `@universo-react/playcanvas-engine` currently wraps `playcanvas@2.18.1`.                                                                                                             |
| `packages/universo-react-colyseus-client/package.json` and `pnpm-workspace.yaml`   | Wrapper version source                     | `@universo-react/colyseus-client` currently wraps `@colyseus/sdk@0.17.42`.                                                                                                           |
| `packages/universo-react-colyseus-server/package.json` and `pnpm-workspace.yaml`   | Wrapper version source                     | `@universo-react/colyseus-server` currently wraps `@colyseus/core@0.17.43`.                                                                                                          |

### External Sources

| Source                                                                                          | Type                            | License / attribution note                                                  | Relevance                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `freshtechbro/claudedesignskills` README, `playcanvas-engine/SKILL.md`, and repository contents | Community skill collection      | MIT License, copyright 2025 Claude Skills Project                           | Useful mined material for PlayCanvas and web 3D skill boundaries. Not suitable as a drop-in because it is Claude/plugin-specific and includes vendor-specific layouts and workflow language.                                                                           |
| PlayCanvas Engine docs and API reference v2.18.1                                                | Official upstream documentation | PlayCanvas Engine is MIT licensed, copyright PlayCanvas Ltd.                | Primary source for Engine-only concepts, direct npm package usage, TypeScript declarations, application/scene/entity patterns, primitive geometry, normals, and asset lifecycle.                                                                                       |
| PlayCanvas React docs                                                                           | Official upstream documentation | `playcanvas/react` repository is MIT licensed                               | Secondary source for React integration patterns: declarative PlayCanvas in React, Suspense asset loading, pointer events, hooks, and lazy-loaded physics. Useful as integration inspiration, not as a replacement for the wrapper's current `playcanvas` Engine focus. |
| Colyseus docs v0.17 raw documentation pages                                                     | Official upstream documentation | Colyseus packages are MIT licensed, copyright Endel Dreyer and contributors | Primary source for rooms, lifecycle hooks, `onAuth`, schema state, fixed tick simulation, interpolation, reconnection, and scaling. Version family matches the wrapper packages.                                                                                       |
| `colyseus/schema` and `colyseus/command` repositories                                           | Official ecosystem packages     | MIT licensed                                                                | `@colyseus/schema` is part of the state model used by Colyseus. `@colyseus/command` is useful as an optional command-pattern reference but should not be required in MVP unless wrapped or directly added later.                                                       |

## Key Findings

1. The research target is a project-local skill set, not a dependency or marketplace installation. New material should live under `.agents/skills/<skill-name>/SKILL.md` with optional `references/`, and the content must be vendor-neutral enough for Codex, Kiro, Claude Code, and other agents.
2. The foundation wrappers are already pinned through the workspace catalog:
    - `@universo-react/playcanvas-engine` -> `playcanvas@2.18.1`
    - `@universo-react/colyseus-client` -> `@colyseus/sdk@0.17.42`
    - `@universo-react/colyseus-server` -> `@colyseus/core@0.17.43`
      Any planned skill must call out these versions and prefer APIs documented for those versions or the matching 0.17 Colyseus line.
3. The PlayCanvas scope should be Engine-only. PlayCanvas Editor, PCUI, PCUI Graph, and heavy asset pipeline guidance are explicitly outside the brief. The Engine skill should cover runtime construction and lifecycle, not editor workflows.
4. PlayCanvas v2.18.1 API references support the primitive geometry needs in the brief:
    - `BoxGeometry` supports half extents, segment counts, tangents, and vertical offset.
    - `SphereGeometry` supports radius and latitude/longitude bands.
    - `TorusGeometry` supports tube/ring radius, sector angle, segments, and sides.
    - `calculateNormals` computes vertex normals from positions and triangle indices.
      The skill should teach a procedural-geometry workflow around geometry -> mesh -> mesh instance/render component/entity, with cleanup and normals/tangents guidance.
5. PlayCanvas React is useful for integration vocabulary, especially Suspense-style asset loading, React pointer events, hooks, and lazy-loaded optional systems. However, MMOOMM's wrapper currently exposes `playcanvas`, not `@playcanvas/react`, so the main skill must not assume React bindings are available unless a later package adds them.
6. Colyseus rooms are the authoritative session boundary. Official docs describe a room as an isolated game session, with mutable room state and lifecycle hooks such as `onAuth`, `onCreate`, `onJoin`, `onDrop`, `onReconnect`, `onLeave`, and `onDispose`.
7. Colyseus `onAuth` should be treated as the authentication gate before `onJoin`. The docs recommend static `onAuth` because a room instance does not always need to be created for authentication. Truthy results continue, falsy results reject, and thrown `ServerError` instances provide explicit rejection. The returned auth payload becomes available to `onJoin` and the client.
8. Colyseus state design requires skill guidance, not ad hoc implementation. Important constraints include patch-based sync, schema field ordering compatibility between server/client, TypeScript decorator settings, and the `Schema` serialized-field limit that pushes large models toward nested schemas.
9. The multiplayer skill should encode the server-authoritative loop:
    - Clients send input intents, not authoritative transforms.
    - The server queues inputs and advances simulation on a fixed tick through Colyseus' simulation interval.
    - The server mutates schema state.
    - Clients render with interpolation and optionally prediction/reconciliation where the UX requires it.
10. Colyseus docs state default state patching around 50ms / 20fps, while browser rendering commonly targets around 60fps. The skill should instruct agents to cache authoritative state and LERP render transforms instead of snapping visuals on every state patch.
11. Colyseus 0.17 reconnection should be represented because it is directly relevant to browser MMO UX. The workflow is `onDrop`, `allowReconnection(client, secondsOrManualMode)`, `onReconnect`, then normal `onLeave` handling if reconnection fails or is not allowed.
12. Scaling guidance should stay MVP-level. Each room belongs to one process; horizontal scaling uses more processes/rooms, seat reservation, and Redis-backed presence/driver (`RedisPresence`, `RedisDriver`) when multiple processes need shared discovery and coordination.
13. Browser 3D integration is a natural separate skill boundary because the hardest MMOOMM implementation risk is not only PlayCanvas or Colyseus APIs; it is coordinating canvas lifecycle, React/MUI layout, input capture, game loop, realtime state, dialogs/HUD, cleanup, and E2E evidence inside the existing `apps-template-mui` runtime shell.
14. QA needs explicit 3D/multiplayer checks. Existing runtime UX skills catch raw IDs/JSON/overflow, but they do not by themselves require canvas-pixel checks, nonblank WebGL evidence, moving/interactive state, reconnect behavior, interpolation behavior, or multi-client room scenarios. This can be either a separate QA skill or a dedicated reference inside the integration skill.

## Candidate Source Decisions

### `freshtechbro/claudedesignskills`

-   Coverage: includes `playcanvas-engine` and adjacent browser/3D skills, plus broad skill-marketplace structure.
-   License: MIT License, copyright 2025 Claude Skills Project.
-   Use: mine concept boundaries, anti-patterns, and examples of what a skill entry point can teach.
-   Rephrase: all operational guidance must be rewritten in project-local language.
-   Skip: vendor-specific `.claude/skills` layout, slash commands, plugin marketplace install flows, specialized-agent assumptions, and any PlayCanvas Editor-first framing.
-   Decision: cite as an MIT community inspiration source in `.agents/skills/SOURCES.md`, but do not import files verbatim and do not keep the original skill name if it suggests a vendor-specific origin.

### PlayCanvas Engine Official Docs And API v2.18.1

-   Coverage: direct engine usage, MIT package, TypeScript declarations, examples, app/scene/entity model, primitives, normals, materials, rendering components, and asset management concepts.
-   License: PlayCanvas Engine is MIT licensed.
-   Use: primary authority for the PlayCanvas Engine skill.
-   Rephrase: convert API facts into short operational checklists and workflow guardrails.
-   Skip: Editor, PCUI, PCUI Graph, and heavy asset pipeline topics for MVP.
-   Decision: make this the primary source for a `playcanvas-engine-runtime` style skill.

### PlayCanvas React Official Docs

-   Coverage: declarative React usage, PlayCanvas ECS in React, Suspense asset loading, pointer events, hooks, and lazy-loaded optional physics.
-   License: `playcanvas/react` is MIT licensed.
-   Use: source for integration patterns only when describing React shell interop, lazy loading, and asset readiness concepts.
-   Rephrase: present as patterns that may apply to the runtime widget boundary, not as a requirement to use `@playcanvas/react`.
-   Skip: any instruction that assumes `@playcanvas/react` is already wrapped or installed.
-   Decision: cite in the browser integration skill, with a warning to keep implementation aligned with the existing `@universo-react/playcanvas-engine` wrapper unless a later plan adds React bindings.

### Colyseus Official Docs v0.17

-   Coverage: room lifecycle, auth, state sync, schema constraints, fixed tick tutorial, interpolation tutorial, reconnection, and scaling.
-   License: Colyseus repositories are MIT licensed.
-   Use: primary authority for authoritative multiplayer skill.
-   Rephrase: turn docs into an Universo-specific implementation workflow for rooms, schema, input handling, prediction/interpolation, reconnect, and scaling notes.
-   Skip: framework-specific tutorial details that depend on Phaser or other renderers, except the portable fixed-tick and LERP concepts.
-   Decision: make this the primary source for a `colyseus-authoritative-multiplayer` style skill.

### Colyseus Command Pattern

-   Coverage: optional command pattern for structuring server-side room actions.
-   License: MIT.
-   Use: mention as optional future structure when room logic grows.
-   Rephrase: keep as a small note in references, not required setup.
-   Skip: hard dependency in MVP skills unless the package is added or wrapped later.
-   Decision: do not create a separate command-pattern skill now.

### Blender, React Three Fiber, Extended 3D Scroll, And Asset Pipeline Sources

-   Coverage: useful for later asset creation, alternate render stacks, and 3D web presentation.
-   License: varies by source and was not needed for the current decision.
-   Use: none for the current MVP skill set.
-   Skip: current brief excludes heavy glTF/Draco/texture optimization and fixes PlayCanvas as the engine target.
-   Decision: defer. Adding these skills now would increase agent drift away from the PlayCanvas/Colyseus foundation.

## Recommended Skill Set For PLAN

### 1. `playcanvas-engine-runtime`

Purpose: guide IMPLEMENT and QA agents when using `@universo-react/playcanvas-engine` / `playcanvas@2.18.1` for MMOOMM runtime scenes.

Recommended `SKILL.md` scope:

-   Triggers: PlayCanvas Engine, WebGL canvas, MMOOMM viewport, procedural geometry, camera/light setup, PlayCanvas asset lifecycle, engine cleanup.
-   Version guard: explicitly pin to `playcanvas@2.18.1` through `@universo-react/playcanvas-engine`.
-   Workflow:
    -   initialize one engine/app instance per mounted canvas;
    -   create scene graph entities with camera, lights, render components, materials, and mesh instances;
    -   build procedural primitives with `BoxGeometry`, `SphereGeometry`, `TorusGeometry`, and `calculateNormals` when custom mesh normals are needed;
    -   handle asset readiness and failure states before exposing the viewport as ready;
    -   resize to the widget container, not the full page;
    -   clean up event listeners, engine resources, app instances, and animation loops on unmount.
-   Anti-patterns:
    -   using PlayCanvas Editor concepts for runtime code;
    -   adding PCUI/Graph scope;
    -   assuming `@playcanvas/react` APIs exist in the wrapper;
    -   creating multiple engines for one widget mount;
    -   letting the canvas control page-level layout or create horizontal overflow.
-   References:
    -   `references/playcanvas-engine-runtime-notes.md`
    -   optional short geometry reference for primitives and normals.

### 2. `colyseus-authoritative-multiplayer`

Purpose: guide server-authoritative MMOOMM room design on `@universo-react/colyseus-server` / `@colyseus/core@0.17.43` and browser clients on `@universo-react/colyseus-client` / `@colyseus/sdk@0.17.42`.

Recommended `SKILL.md` scope:

-   Triggers: Colyseus rooms, realtime multiplayer, MMOOMM room state, prediction, reconciliation, reconnect, multi-client simulation.
-   Version guard: explicitly pin to Colyseus 0.17 wrappers listed above.
-   Workflow:
    -   authenticate with static `onAuth` before `onJoin`;
    -   initialize schema state in `onCreate`;
    -   mutate state directly rather than replacing the room state object;
    -   validate client messages, preferably through the project Zod patterns when message shape matters;
    -   process input intents on a server fixed tick;
    -   publish authoritative schema state;
    -   render client movement through interpolation and optionally prediction/reconciliation;
    -   use `allowReconnection` for temporary disconnects;
    -   keep Redis-backed scaling guidance as an MVP deployment note, not default local setup.
-   Anti-patterns:
    -   trusting client coordinates, inventory, or physics results as authoritative;
    -   using React component state as canonical multiplayer state;
    -   reassigning Colyseus state root casually;
    -   designing flat schemas that hit schema limits;
    -   skipping auth because a room is "just a game".
-   References:
    -   `references/colyseus-room-lifecycle.md`
    -   `references/colyseus-state-and-tick.md`
    -   `references/colyseus-reconnect-and-scale.md`

### 3. `browser-3d-runtime-integration`

Purpose: guide the glue between PlayCanvas/Colyseus and the existing React/MUI Universo runtime shell.

Recommended `SKILL.md` scope:

-   Triggers: embedding a 3D canvas in `apps-template-mui`, game HUD, input capture, lazy-loaded engine widgets, runtime Playwright proof, responsive WebGL surfaces.
-   Version guard: reference the three wrapper packages and defer to the PlayCanvas/Colyseus skills for engine/network specifics.
-   Workflow:
    -   mount the 3D experience as a widget zone inside `apps-template-mui`, not as a parallel application shell;
    -   lazy-load the engine and multiplayer client where route-level bundle size or first paint matters;
    -   separate slow platform data fetching from realtime room state;
    -   keep HUD/dialog/list UI in MUI primitives and canvas-only rendering in the canvas;
    -   define an input ownership model for keyboard, pointer lock, focus, escape handling, dialogs, and text fields;
    -   keep animation/game loops outside React render loops and bridge only summarized state into UI;
    -   handle mount/unmount, resize observers, visibility changes, and connection cleanup.
-   Anti-patterns:
    -   exposing raw room IDs, record IDs, JSON, or `[object Object]` as normal user UI;
    -   letting canvas keyboard capture break dialogs, navigation, or text inputs;
    -   driving 60fps transforms through React state;
    -   rebuilding a custom shell instead of using runtime dashboard primitives;
    -   shipping without browser evidence of a nonblank, framed, interactive canvas.
-   References:
    -   `references/react-mui-canvas-boundary.md`
    -   `references/browser-game-loop-and-input.md`
    -   `references/runtime-3d-e2e-evidence.md`

### 4. Optional: `browser-game-runtime-qa`

Purpose: make browser proof for 3D/multiplayer surfaces explicit. PLAN should decide whether this is a separate skill or a reference inside `browser-3d-runtime-integration`.

Recommended scope if separate:

-   canvas is nonblank by pixel/sample check;
-   primary object/camera is correctly framed on desktop and mobile;
-   canvas resizes without page-level horizontal overflow;
-   movement or scene animation is visible over time;
-   HUD text and controls do not overlap the canvas incoherently;
-   pointer/keyboard capture releases correctly for dialogs/navigation;
-   two-client room flow proves authoritative state propagation;
-   reconnect flow proves `allowReconnection` behavior when applicable;
-   no raw IDs/JSON/object cells leak through runtime UI;
-   screenshots or traces are attached to QA evidence.

Decision pressure: a separate QA skill is justified if MMOOMM will repeatedly ask agents to validate browser 3D/multiplayer behavior. If only one or two near-term tasks need this, keep the QA checklist as a reference under `browser-3d-runtime-integration`.

## Recommended Source Registry Updates For IMPLEMENT

During implementation of the skills, update `.agents/skills/SOURCES.md` with:

-   `freshtechbro/claudedesignskills` as MIT inspiration for PlayCanvas/browser-3D skill boundaries, explicitly noting that no vendor-specific layout or verbatim content was imported.
-   PlayCanvas Engine docs/API and GitHub license as primary MIT source for `playcanvas-engine-runtime`.
-   PlayCanvas React docs/license as secondary MIT source for React integration patterns.
-   Colyseus docs and GitHub licenses as primary MIT source for `colyseus-authoritative-multiplayer`.
-   A short local note explaining that these skills are tied to the three foundation wrappers:
    -   `@universo-react/playcanvas-engine`
    -   `@universo-react/colyseus-client`
    -   `@universo-react/colyseus-server`

## Conflicts And Uncertainty

1. Exact skill names are not locked. The names above are research recommendations; PLAN should finalize them.
2. `@playcanvas/react` is useful but not currently a foundation wrapper. Skills should not tell agents to import it unless a later plan adds that package.
3. `@colyseus/command` may become useful as server room complexity grows, but current wrappers do not make it part of the foundation. Keep it optional.
4. Prior backup research mentioned Blender/R3F/scroll skills. The current brief explicitly narrows MVP scope, so those sources should not shape this skill set except as deferred ideas.
5. The Colyseus docs are published as evolving documentation. The wrapper versions are pinned to the 0.17 line, so implementation should prefer version-compatible API pages or raw docs matching 0.17 behavior.

## Project Implications

-   PLAN should start from three core skills and decide whether QA is a fourth skill or a reference document.
-   Each skill should be concise at the entry point and push longer operational notes into `references/`.
-   Skill content must be rewritten project-local guidance, not copied upstream docs or imported marketplace files.
-   The PlayCanvas skill should prevent agent drift into Editor/PCUI/asset-pipeline work.
-   The Colyseus skill should make server authority the default, including auth, schema state, fixed tick input processing, interpolation, reconnection, and MVP scaling notes.
-   The integration skill should bind the 3D/game runtime to the existing MUI dashboard/runtime rules and require browser evidence.
-   QA evidence requirements should reuse `runtime-ux-qa` but add WebGL/game-specific checks.

## Recommended Decision

For PLAN, use this skill set:

1. `playcanvas-engine-runtime`
2. `colyseus-authoritative-multiplayer`
3. `browser-3d-runtime-integration`
4. Optional `browser-game-runtime-qa`, only if PLAN wants QA checks independently triggerable from implementation guidance.

Defer these skills:

-   Blender or full asset pipeline skills.
-   React Three Fiber skills.
-   PlayCanvas Editor skills.
-   PCUI / PCUI Graph skills.
-   External vendor-specific skill installation or marketplace integration.

## Open Questions Before PLAN

1. Should browser/game QA be a standalone skill or a `references/runtime-3d-e2e-evidence.md` document under `browser-3d-runtime-integration`?
2. Should a future task add `@playcanvas/react` as a wrapper package, or should the MVP keep direct PlayCanvas Engine integration only?
3. Should Colyseus command-pattern guidance remain a short optional reference, or should it be deferred entirely until room logic becomes hard to maintain?

## Source Links

-   `freshtechbro/claudedesignskills`: https://github.com/freshtechbro/claudedesignskills
-   `freshtechbro/claudedesignskills` license: https://github.com/freshtechbro/claudedesignskills/blob/main/LICENSE
-   PlayCanvas Engine docs: https://developer.playcanvas.com/user-manual/engine/
-   PlayCanvas Engine GitHub repository: https://github.com/playcanvas/engine
-   PlayCanvas Engine API v2.18.1: https://api.playcanvas.com/engine-v2.18.1/
-   PlayCanvas React docs: https://developer.playcanvas.com/user-manual/playcanvas-react/
-   PlayCanvas React GitHub repository: https://github.com/playcanvas/react
-   Colyseus docs: https://docs.colyseus.io/
-   Colyseus room docs source: https://github.com/colyseus/docs/blob/master/pages/room.mdx
-   Colyseus room auth docs source: https://github.com/colyseus/docs/blob/master/pages/auth/room.mdx
-   Colyseus reconnection docs source: https://github.com/colyseus/docs/blob/master/pages/room/reconnection.mdx
-   Colyseus fixed tick tutorial source: https://github.com/colyseus/docs/blob/master/pages/learn/tutorial/phaser/fixed-tickrate.mdx
-   Colyseus interpolation tutorial source: https://github.com/colyseus/docs/blob/master/pages/learn/tutorial/phaser/linear-interpolation.mdx
-   Colyseus scaling docs source: https://github.com/colyseus/docs/blob/master/pages/scalability.mdx
-   Colyseus state docs: https://docs.colyseus.io/state
-   Colyseus GitHub repository: https://github.com/colyseus/colyseus
-   Colyseus Schema GitHub repository: https://github.com/colyseus/schema
-   Colyseus Command GitHub repository: https://github.com/colyseus/command
