# Research: MMOOMM Flight Simulator Metahub Configuration

> Created: 2026-05-28
> Updated: 2026-05-28 after re-reading the original MMOOMM TZ and prior backup research
> Status: Draft
> Trigger: RESEARCH request for the MMOOMM flight-simulator brief
> Follow-up plan: ../plan/mmoomm-flight-simulator-metahub-plan-2026-05-28.md

## Research Question

What is currently true about the repository and the relevant external runtime APIs, and what decisions should the next PLAN make to implement the smallest playable MMOOMM flight simulator as a metahub configuration rather than as a new MMOOMM-specific package?

This research supports the implementation decision for:

-   a PlayCanvas canvas widget inside `@universo-react/apps-template-mui`;
-   generic helpers in `@universo-react/playcanvas-engine`, `@universo-react/colyseus-client`, and `@universo-react/colyseus-server`;
-   a product-grade Playwright snapshot generator next to `tools/fixtures/metahubs-lms-app-snapshot.json`;
-   a browser E2E proof that the published app can fly one ship near one station.

## Source Inventory

| Source                                                                                                                                           | Type                        | Date / Freshness                                    | Why It Matters                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original MMOOMM foundation TZ text supplied by the project owner                                                                                 | Original local TZ           | 2026-05-25                                          | Defines the broad MMOOMM foundation context: metahubs as configuration, PlayCanvas, Colyseus, EVE-like control/economy references, package resources, PCUI question, and Scripts-to-Modules question. |
| Flight-simulator narrowing TZ text supplied by the project owner                                                                                 | Narrow local TZ             | 2026-05-27                                          | Narrows the broad MMOOMM idea to the smallest flight simulator step and explicitly selects variant (c): configuration inside a metahub.                                                               |
| Embedded flight-simulator brief text in the RESEARCH request                                                                                     | Local brief                 | 2026-05-27                                          | Defines the target feature, non-goals, package constraints, fixture requirement, and required skills.                                                                                                 |
| `.backup/Universo-MMOOMM-на-базе-метахабов-и-PlayCanvas.md`                                                                                      | Prior local research        | Imported backup; cited by original TZ               | Recommends MUI shell + embedded PlayCanvas viewport + server-authoritative Colyseus room + metahub publication; also documents broader mining/economy/ledger ideas now deferred.                      |
| `.backup/Разработка-MMO-на-PlayCanvas-и-Universo.md`                                                                                             | Prior local research        | Imported backup; cited by original TZ               | Confirms the value of point-and-click movement, primitive geometry, authoritative server, and MUI-over-PCUI for the broader MMOOMM architecture.                                                      |
| `.backup/universo-platformo-react-0.52.0-alpha/packages/multiplayer-colyseus-backend/base/*`                                                     | Historical local code       | Legacy backup                                       | Shows an older hardcoded MMOOMM-specific Colyseus server package existed; useful as negative evidence because the current brief forbids a new MMOOMM-specific package.                                |
| `.backup/universo-platformo-react-0.52.0-alpha/packages/template-mmoomm/base/*`                                                                  | Historical local code       | Legacy backup                                       | Shows an older hardcoded MMOOMM template package existed; current architecture deliberately replaces this with metahub configuration + generic helpers.                                               |
| `memory-bank/progress.md` and `memory-bank/tasks.md`                                                                                             | Local delivery history      | Current Memory Bank                                 | Confirms the Scripts-to-Modules rename was already implemented on 2026-05-25, so PLAN should not reopen that as a prerequisite.                                                                       |
| `memory-bank/techContext.md`                                                                                                                     | Local canonical context     | Reviewed 2026-05-22                                 | Defines module runtime, snapshot, package registry, app runtime, DB, Node, and build constraints.                                                                                                     |
| `memory-bank/systemPatterns.md`                                                                                                                  | Local canonical patterns    | Current Memory Bank                                 | Confirms research-before-plan, runtime widget module hook, snapshot, and generic UI patterns.                                                                                                         |
| `memory-bank/productContext.md`                                                                                                                  | Local product context       | Reviewed 2026-05-22                                 | Confirms MMOOMM is a planned configuration on the shared platform, not a separate product shell.                                                                                                      |
| `.kiro/steering/structure.md`                                                                                                                    | Local steering              | Current                                             | Confirms `packages/universo-react-<name>` and `@universo-react/<name>` naming and package-boundary import rules.                                                                                      |
| `.kiro/steering/recommendations.md`                                                                                                              | Local steering              | Current                                             | Confirms DB executor tiers, raw SQL safety, and no DB-layer rewrite.                                                                                                                                  |
| `.agents/skills/playcanvas-engine-runtime/SKILL.md` and references                                                                               | Project-local skill         | 2026-05-27                                          | Required guardrails for PlayCanvas Engine lifecycle, one app per canvas, resize, primitive geometry, cleanup.                                                                                         |
| `.agents/skills/colyseus-authoritative-multiplayer/SKILL.md` and references                                                                      | Project-local skill         | 2026-05-27                                          | Required guardrails for Colyseus room lifecycle, auth, Schema state, fixed tick, interpolation, reconnect.                                                                                            |
| `.agents/skills/browser-3d-runtime-integration/SKILL.md` and references                                                                          | Project-local skill         | 2026-05-27                                          | Required guardrails for canvas-in-MUI, input ownership, loops outside React, lazy loading, cleanup, evidence.                                                                                         |
| `.agents/skills/browser-game-runtime-qa/SKILL.md` and references                                                                                 | Project-local skill         | 2026-05-27                                          | Required WebGL/realtime QA evidence: nonblank canvas, framing, movement, no overflow, multi-client sync.                                                                                              |
| `.agents/skills/universo-platform-architecture/SKILL.md`                                                                                         | Project-local skill         | 2026-05-27                                          | Confirms entity preset mapping, metahub/application/workspace placement, and "strengthen existing presets" rule.                                                                                      |
| `.agents/skills/mui-runtime-ux-patterns/SKILL.md` and `.agents/skills/runtime-ux-qa/SKILL.md`                                                    | Project-local UI/QA skills  | Current                                             | Confirm UI contract, no raw IDs/JSON, localization, app-template primitive reuse, no horizontal overflow.                                                                                             |
| `packages/universo-react-apps-template-mui/README.md`                                                                                            | Local package docs          | Current                                             | Defines zone-based widget system and current widget list; new canvas widget must fit this renderer model.                                                                                             |
| `packages/universo-react-apps-template-mui/src/dashboard/Dashboard.tsx`                                                                          | Local source                | Current                                             | `ZoneWidgetItem` is keyed by `widgetKey`; details/context must remain bounded by the dashboard shell.                                                                                                 |
| `packages/universo-react-apps-template-mui/src/dashboard/components/widgetRenderer.tsx`                                                          | Local source                | Current                                             | Current supported widgets do not include a generic PlayCanvas canvas widget; PLAN must add one.                                                                                                       |
| `packages/universo-react-apps-template-mui/src/dashboard/components/runtimeWidgetHelpers.ts`                                                     | Local source                | Current                                             | Existing helper discovers widget-role client modules by object/metahub attachment and fetches client bundles; likely default path for the new canvas widget.                                          |
| `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`                                                                             | Local generator pattern     | Current                                             | Shows the product snapshot generator pattern to mirror for MMOOMM.                                                                                                                                    |
| `tools/testing/e2e/support/lmsFixtureContract.ts`                                                                                                | Local fixture contract      | Current                                             | Shows the contract-check style needed to prevent a generator from producing an incomplete product snapshot.                                                                                           |
| `packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json`                                                          | Local package registry seed | 2026-05-27                                          | Confirms the three wrapper package entries and runtime targets already exist.                                                                                                                         |
| `packages/universo-react-metahubs-backend/src/domains/publications/services/SnapshotSerializer.ts`                                               | Local source                | Current                                             | Published snapshots include `modules` and `packages`; the flight snapshot can carry package attachments.                                                                                              |
| `packages/universo-react-metahubs-backend/src/domains/metahubs/services/SnapshotRestoreService.ts`                                               | Local source                | Current                                             | Snapshot restore replaces metahub package attachments from snapshot data.                                                                                                                             |
| `packages/universo-react-playcanvas-engine/README.md` and `package.json`                                                                         | Local wrapper source        | Current                                             | Wrapper is thin and re-exports `playcanvas`; package version is `0.1.0`, upstream pinned to `playcanvas@2.18.1` in registry seed.                                                                     |
| `packages/universo-react-colyseus-client/README.md` and `package.json`                                                                           | Local wrapper source        | Current                                             | Wrapper is thin and re-exports `@colyseus/sdk`; registry exposes it as client-targeted.                                                                                                               |
| `packages/universo-react-colyseus-server/README.md` and `package.json`                                                                           | Local wrapper source        | Current                                             | Wrapper is thin and re-exports `@colyseus/core`; registry exposes it as server-targeted.                                                                                                              |
| PlayCanvas Engine docs and API references (`https://developer.playcanvas.com/user-manual/engine/`, `https://api.playcanvas.com/engine-v2.18.1/`) | Primary external docs       | Queried 2026-05-28; version-relevant                | Confirms Application, Entity, render primitives, camera, light, mouse, resize, update, and cleanup concepts for Engine-only runtime.                                                                  |
| PlayCanvas Engine repository (`https://github.com/playcanvas/engine`)                                                                            | Primary external source     | Queried 2026-05-28                                  | Confirms PlayCanvas Engine is a direct runtime engine package, not an Editor/PCUI requirement.                                                                                                        |
| PlayCanvas PCUI (`https://github.com/playcanvas/pcui`) and PCUI Graph (`https://github.com/playcanvas/pcui-graph`)                               | Primary external source     | Rechecked 2026-05-28                                | Confirms PCUI/Graph are tooling/editor-oriented UI options; useful later for graph tools, but not required for the flight simulator widget.                                                           |
| Colyseus docs (`https://docs.colyseus.io/`) and docs repository pages for rooms/state/fixed tick/reconnect                                       | Primary external docs       | Queried 2026-05-28; version family matches wrappers | Confirms Room lifecycle hooks, Schema state sync, `setSimulationInterval`, message sending, client callbacks, and reconnection behavior.                                                              |
| Colyseus package repositories (`https://github.com/colyseus/colyseus`, `https://github.com/colyseus/schema`)                                     | Primary external source     | Queried 2026-05-28                                  | Confirms authoritative multiplayer framework and Schema package relationship.                                                                                                                         |
| Playwright docs (`https://playwright.dev/docs/screenshots`, `https://playwright.dev/docs/api/class-locator`)                                     | Primary external docs       | Queried 2026-05-28                                  | Supports browser evidence through screenshots, locators, and in-page evaluation for canvas checks.                                                                                                    |
| EVE University Manual Piloting / Overview / camera-related pages (`https://wiki.eveuniversity.org/`)                                             | Tertiary UX reference       | Rechecked 2026-05-28                                | Useful as interaction inspiration for double-click movement, object actions, overview-style target lists, and camera orbit/zoom; not a source to copy mechanics wholesale.                            |
| `freshtechbro/claudedesignskills` (`https://github.com/freshtechbro/claudedesignskills`) and skills.sh PlayCanvas entry                          | Secondary external source   | Rechecked 2026-05-28                                | Prior source for the already-created project-local 3D/multiplayer skills; useful as inspiration, not as a runtime dependency or universal skill container.                                            |

## Key Findings

### Facts

1. The repository already contains the three requested foundation wrapper packages:
    - `@universo-react/playcanvas-engine`
    - `@universo-react/colyseus-client`
    - `@universo-react/colyseus-server`
2. These wrappers are intentionally thin. They re-export upstream packages and do not yet provide the generic helpers requested by the flight simulator brief.
3. The metahub package registry is already seeded with the three wrapper packages. The seed records upstream versions and runtime targets:
    - `@universo-react/playcanvas-engine` -> `playcanvas@2.18.1`, target `client`
    - `@universo-react/colyseus-client` -> `@colyseus/sdk@0.17.42`, target `client`
    - `@universo-react/colyseus-server` -> `@colyseus/core@0.17.43`, target `server`
4. Snapshot serialization already emits `modules` and `packages` when present. Snapshot restore already restores package attachments through the package registry. This means the MMOOMM snapshot can be a real importable metahub artifact with attached package dependencies, not a test-only fixture.
5. `apps-template-mui` already has a zone-based widget renderer, but the current widget list does not include a generic PlayCanvas canvas widget.
6. `ZoneWidgetItem` uses `widgetKey`, `id`, `sortOrder`, and `config`. A new canvas widget should follow the existing renderer model instead of creating a parallel shell.
7. The LMS Playwright generator is the closest existing pattern. It creates a live metahub through backend API helpers, seeds records, exports a snapshot envelope, validates the contract, and writes a committed JSON artifact under `tools/fixtures/`.
8. The project-local skills make the runtime architecture stricter than the brief alone:
    - exactly one PlayCanvas app per mounted canvas widget;
    - bounded canvas in the owning MUI widget/container;
    - game loops outside React render loops;
    - input ownership for pointer, keyboard, focus, Escape, and dialogs;
    - Colyseus server authority over positions and commands;
    - browser evidence for nonblank canvas, movement, no overflow, and realtime sync.
9. PlayCanvas Engine supports the needed MVP shape directly: an `Application` on a canvas, scene graph `Entity` nodes, render components with primitive box type, camera, lights, mouse input, update callbacks, canvas resize, and application/entity destruction.
10. Colyseus supports the needed authoritative flow directly: `Room` lifecycle hooks, `onAuth`, `onCreate`, `onJoin`, `onLeave`, `onDispose`, Schema-backed room state, client messages, `setSimulationInterval` fixed tick, and reconnection hooks/options.
11. The Module runtime contract currently limits module imports to allowed attached package imports and supported SDK API version `1.0.0`. PLAN must verify that the module compiler/bundler path can import the three package attachments from metahub modules before designing the room and client modules as configuration-owned code.
12. The package registry exposes `@universo-react/colyseus-client` as client-targeted and `@universo-react/colyseus-server` as server-targeted. PLAN should not ask server modules to import the client wrapper or browser modules to import the server wrapper.
13. Runtime UI quality gates apply even though the core surface is a canvas. Loading, disconnected, unauthorized, room-full, version-mismatch, and failure states must be localized normal-user states, not raw WebSocket, Zod, Colyseus, room ID, session ID, or stack traces.
14. The brief says no backward compatibility and no schema/template version bump. Local snapshot machinery still has a version envelope; PLAN should distinguish "do not bump existing template versions" from preserving the current snapshot envelope fields required by import/export contracts.
15. The original broad TZ already raised the "Scripts" vs. "Modules" question. The repository history shows that the no-legacy Scripts-to-Modules rename was completed on 2026-05-25, including routes, database contracts, snapshots, fixtures, tests, SDK names, and docs. The flight simulator can assume Modules are the current term and should not reserve a preliminary rename phase.
16. The original broad TZ and backup research included a larger mining/economy MVP: asteroid resources, Inmo, markets, ledger-style facts, and parallel worlds with different economic policies. The current flight-simulator brief intentionally defers all of that. This is a staging decision, not a rejection of the broader MMOOMM architecture.
17. Historical backup code contains `@universo/multiplayer-colyseus-backend` and `@universo/template-mmoomm`, both explicitly MMOOMM-specific. They validate that Colyseus/PlayCanvas had been explored before, but they should not be revived as package boundaries because the current selected architecture forbids new MMOOMM-specific packages.
18. Existing `runtimeWidgetHelpers.ts` already centralizes discovery and loading for widget-role client modules attached to either the active object or the metahub. A generic PlayCanvas canvas widget should strongly prefer this path unless PLAN finds a concrete capability gap.
19. The original research considered `@playcanvas/react`, PCUI, and PCUI Graph. The current wrapper exposes `playcanvas`, not `@playcanvas/react`, and the brief explicitly excludes PCUI/PCUI Graph. MUI remains the runtime UI shell; PlayCanvas owns the canvas scene only.

### Inferences

1. The domain model should start from the `basic` or `empty` metahub template and add flight-specific content as existing entity types, not introduce a built-in MMOOMM entity kind.
2. The most natural mapping is:
    - Hub: top-level "flight simulator" grouping or world hierarchy.
    - Object: world, controllable ship, station, movement command/state, camera preset/state, and possibly room/session configuration.
    - Enumeration: command type values such as `move_to_point`, `move_to_object`, and `stop`.
    - Set: fixed numeric constants or tunables if those should be authorable as configuration.
    - Module: client widget logic, server room logic, shared math helpers, and optional validation glue.
3. A new custom entity type is not justified by the researched facts. Existing Object + Components + Modules can represent the MVP world, ship, station, camera, and movement-command configuration.
4. A generic PlayCanvas widget should probably be named by capability, such as `playcanvasCanvas` or `runtimeCanvas3d`, not by MMOOMM. Its config should select a client-capable module and pass widget/runtime context to that module.
5. The generic wrapper helpers should be small and capability-oriented:
    - playcanvas-engine: application/canvas lifecycle helper, primitive box entity helper, follow/orbit camera helper;
    - colyseus-client: client connection and click-to-move intent helper;
    - colyseus-server: fixed-tick movement primitive and station/bounding-box guard helper.
6. The ship and station should be white primitive boxes in PlayCanvas units matching meters: ship scale `12 x 4 x 4`; station scale `48 x 16 x 16`.
7. The server fixed tick should own position, velocity/speed scalar, current command, target point/object reference, and stop/arrival status. Client prediction should be optional and conservative because the MVP controls one authoritative ship and observer sync is more important than competitive responsiveness.
8. The station collision guard can be implemented as a server-side movement clipping or segment-vs-AABB blocking check around the station bounding box, with a small stop radius. It should not rely on client-side collision or PlayCanvas physics.
9. Browser QA should combine semantic Playwright checks with canvas-specific oracles: canvas bounding box, sampled pixels or screenshot difference for nonblank render, state coordinate change after command, no horizontal overflow, and a second browser context observing the same final authoritative state.
10. The flight simulator should preserve future MMOOMM expansion seams without implementing them. The command model can be narrow (`move_to_point`, `move_to_object`, `stop`) but should be represented as an Enumeration/Module protocol that can later add mining, docking, route, market, and world-jump commands without replacing the widget/room architecture.
11. The current generator should probably start from `basic`, not `empty`, because the brief wants normal Object/Set/Enumeration/Page/Hub capability rather than a proof that every platform preset can be re-declared manually. If PLAN chooses `empty`, it must justify the extra snapshot complexity.
12. The authoritative room identity should probably be scoped by application + workspace + configured world Object. This keeps the single shared ship state tied to a published app and runtime workspace while leaving a later path to multiple worlds. PLAN still needs to verify the runtime API shape before locking this.

## Conflicts And Uncertainty

1. The brief says "Colyseus room defined in Modules metahub, served by the application." The local module runtime supports server/client bundles, but the exact production path for registering a Colyseus `Room` class from metahub module metadata into the application runtime needs PLAN-level source inspection. This may require a generic runtime registration seam in the applications/core backend rather than only helper functions in the wrapper package.
2. The brief requires a click on the station to move to the station. PlayCanvas can support screen-to-world rays, but the exact picking path in an Engine-only setup needs PLAN to choose between a minimal math-based ray/AABB hit test and a PlayCanvas collision/raycast component path. The MVP should avoid adding the full physics/collision stack unless ray/AABB is insufficient.
3. External EVE references are UX inspiration only. They confirm the interaction family but do not define an exact implementation contract for Universo. The product should use the brief's simplified semantics rather than trying to reproduce EVE Online behavior.
4. The current `apps-template-mui` widget config schemas live in `@universo-react/types`. PLAN must check where widget config unions are validated before adding a new widget key, otherwise a generated snapshot may import but fail runtime validation.
5. Colyseus documentation is evolving. The wrappers are pinned to the 0.17 line, so implementation should stay within APIs confirmed for the 0.17 wrapper versions and current local package exports.
6. The brief calls for `pnpm install && pnpm build`, but repository guidance says agents must not run `pnpm dev` automatically and should avoid expensive global commands without need. PLAN should include validation commands, and IMPLEMENT/QA should decide with the user whether to run the full root install/build locally.
7. EVE-style double-click movement is a UX reference, not an exact protocol. EVE manual piloting often describes double-clicking in space to fly in a direction, while this brief requires double-click-to-target-point semantics. PLAN should implement the brief's finite target-point behavior and cite EVE only as interaction inspiration.
8. Prior backup research suggested broader skills such as Blender pipeline, React Three Fiber, economy ledger, and graph tooling. These remain later-scope. Loading them into this implementation would increase drift because the current brief excludes asset pipelines, PCUI/Graph, economy, and non-PlayCanvas render stacks.
9. The older backup Colyseus package used the full `colyseus` package and MMOOMM-specific room names. Current wrapper policy uses `@colyseus/core` and generic package names due to repository supply-chain and architecture rules. PLAN must not import the old package structure as-is.

## Project Implications

1. No new `packages/universo-react-mmoomm-*` package should be planned. All reusable code belongs in existing generic wrapper/template packages or generic runtime seams.
2. The likely affected packages are:
    - `packages/universo-react-apps-template-mui`
    - `packages/universo-react-playcanvas-engine`
    - `packages/universo-react-colyseus-client`
    - `packages/universo-react-colyseus-server`
    - `packages/universo-react-types`
    - `packages/universo-react-metahubs-backend`
    - `packages/universo-react-applications-backend`
    - possibly `packages/universo-react-modules-engine` if package import or runtime room registration needs strengthening.
3. The affected tooling/test areas are:
    - `tools/testing/e2e/specs/generators/`
    - `tools/testing/e2e/support/`
    - `tools/fixtures/`
    - Playwright runtime flow specs under `tools/testing/e2e/specs/flows/`.
4. The new fixture generator should have a companion contract file similar to `lmsFixtureContract.ts`, with assertions for:
    - attached three package dependencies;
    - world/ship/station Objects;
    - command Enumeration values;
    - required client/server/shared Modules;
    - dashboard layout containing the generic canvas widget;
    - no MMOOMM-specific names inside wrapper helper tests/docs.
5. The UI contract for the canvas widget must define:
    - loading state;
    - ready state;
    - connection/reconnection state;
    - user-facing failure state;
    - stop command control;
    - focus/pointer behavior;
    - responsive bounded height/width;
    - no raw room/session/record IDs.
6. The runtime module/package contract is a central risk. PLAN must trace how metahub package attachments become allowed module imports, how compiled client bundles are loaded by `apps-template-mui`, and where server bundles execute. The implementation should avoid bypassing this with hardcoded imports outside the metahub configuration path.
7. The server movement primitive should be testable without PlayCanvas or browser dependencies. Unit tests should cover acceleration/deceleration, arrival, stop, `move_to_point`, `move_to_object`, and station AABB guard.
8. The client intent helper should be testable with DOM/math unit tests for double-click timing, screen ray target, station click target, and stop command payloads.
9. The PlayCanvas helper tests should stay generic: application lifecycle, primitive dimensions, camera orbit/zoom constraints, resize cleanup. They must not mention MMOOMM in package APIs or tests.
10. The browser E2E should exercise the generated/imported/published artifact, not a private test-only setup. The test should open the published application, verify canvas render, double-click move, stop, camera zoom/orbit, and observer synchronization.
11. The plan should explicitly reject the old `template-mmoomm` and `multiplayer-colyseus-backend` backup package shapes as implementation boundaries. Any useful ideas from them must be re-expressed through generic wrappers, `apps-template-mui`, metahub packages, and Modules.
12. The broader MMOOMM Foundation work should depend on this flight simulator output. Mining, Inmo, ledgers, markets, asteroids, world gates, and Kiberplano graph surfaces should be planned as later extensions over the same canvas widget, room bridge, package import, and fixture-generator pipeline.

## Recommended Decision

Proceed to PLAN with variant (c): implement the flight simulator as a metahub configuration and keep all code additions generic.

Recommended planning baseline:

1. Reuse the existing package registry seed and snapshot package restore path. Do not create a new package.
2. Add one generic `apps-template-mui` canvas widget that can host a client-capable module through the existing runtime widget module discovery path and own one PlayCanvas app lifecycle inside a bounded widget container.
3. Add generic PlayCanvas helpers for canvas app lifecycle, primitive box entities, and follow/orbit camera behavior.
4. Add generic Colyseus client helpers for joining a room, sending movement intents, connection state mapping, and click-to-move intent calculation.
5. Add generic Colyseus server helpers for fixed-tick movement, command queues, acceleration/deceleration, arrival, and AABB guard.
6. Define the MMOOMM world, ship, station, command types, movement/camera modules, and dashboard layout in the metahub snapshot generator.
7. Add a fixture contract that proves the generated snapshot is a product import artifact with package attachments and runtime modules, not an internal-only test shortcut.
8. Add browser evidence using Playwright, including canvas nonblank proof, movement proof, stop proof, camera proof, observer sync proof, and no page-level horizontal overflow.
9. Treat `basic` as the default generator starting template unless PLAN discovers a concrete import/export or preset-control reason to use `empty`.
10. Keep PCUI, PCUI Graph, `@playcanvas/react`, Blender/glTF, mining, Inmo, economy, and ledger work out of the first implementation slice.

## Open Questions Before PLAN

1. Where exactly should Colyseus room classes compiled from metahub Modules be registered at runtime: existing modules engine, applications backend runtime, core backend shell, or a new generic bridge in one of those packages?
2. Should the first canvas widget config select a module by codename, by module id, or through the existing `useRuntimeWidgetClientModule(...)` discovery contract? Current research recommends the existing discovery contract with optional `moduleCodename`.
3. Should station picking use a minimal generic screen-ray/AABB helper, or should PlayCanvas collision/raycast components be introduced for this MVP?
4. Is there any concrete reason not to start the generator from `basic`?
5. What is the authoritative room identity model for the single shared ship: one room per published application, one room per workspace, or one room per configured world Object? Current research recommends application + workspace + world Object if the runtime API supports it.

## Sources

-   PlayCanvas Engine user manual: https://developer.playcanvas.com/user-manual/engine/
-   PlayCanvas Engine API v2.18.1: https://api.playcanvas.com/engine-v2.18.1/
-   PlayCanvas Engine repository: https://github.com/playcanvas/engine
-   PlayCanvas PCUI repository: https://github.com/playcanvas/pcui
-   PlayCanvas PCUI Graph repository: https://github.com/playcanvas/pcui-graph
-   Colyseus documentation: https://docs.colyseus.io/
-   Colyseus room lifecycle docs repository page: https://github.com/colyseus/docs/blob/master/pages/room.mdx
-   Colyseus fixed tick docs repository page: https://github.com/colyseus/docs/blob/master/pages/learn/tutorial/phaser/fixed-tickrate.mdx
-   Colyseus state docs: https://docs.colyseus.io/state
-   Colyseus repository: https://github.com/colyseus/colyseus
-   Colyseus Schema repository: https://github.com/colyseus/schema
-   Playwright screenshots docs: https://playwright.dev/docs/screenshots
-   Playwright locator API docs: https://playwright.dev/docs/api/class-locator
-   EVE University wiki: https://wiki.eveuniversity.org/
-   Claude Design Skills repository: https://github.com/freshtechbro/claudedesignskills
