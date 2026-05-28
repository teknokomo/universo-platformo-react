# MMOOMM Flight Simulator Metahub Plan

> Created: 2026-05-28
> Mode: PLAN
> Status: Draft for approval
> Research: `memory-bank/research/mmoomm-flight-simulator-metahub-research-2026-05-28.md`
> Scope: smallest playable MMOOMM flight simulator as a metahub configuration, no MMOOMM-specific package

## Overview

Build the first playable Universo MMOOMM flight simulator slice as an importable metahub configuration. The generated product snapshot will attach the existing generic wrapper packages for PlayCanvas and Colyseus, declare one world, one white ship, one white station, movement commands, camera/runtime modules, and a published app layout that hosts a bounded PlayCanvas canvas inside `@universo-react/apps-template-mui`.

The implementation must validate the full end-to-end chain: metahub configuration -> package attachments -> module compilation/publication -> application runtime sync -> generic PlayCanvas canvas widget -> generic Colyseus authoritative room -> browser evidence that the ship can move, stop, orbit/zoom the camera, and synchronize to a second observer tab.

## Research And Documentation Inputs

-   Use the existing research artifact: `memory-bank/research/mmoomm-flight-simulator-metahub-research-2026-05-28.md`.
-   Context7 was checked for PlayCanvas Engine and Colyseus:
    -   PlayCanvas Engine supports an `Application` bound to a canvas, primitive `Entity` render components such as `box`, camera/light setup, mouse wheel/input, `screenToWorld`, resize, update callbacks, and app/entity cleanup.
    -   Colyseus supports `Room` lifecycle hooks (`onAuth`, `onCreate`, `onJoin`, `onDrop`, `onReconnect`, `onLeave`, `onDispose`), Schema state, `onMessage`, client `joinOrCreate`, and fixed server simulation through `setSimulationInterval`.
-   Apply project skills during implementation and QA:
    -   `playcanvas-engine-runtime`
    -   `colyseus-authoritative-multiplayer`
    -   `browser-3d-runtime-integration`
    -   `browser-game-runtime-qa`
    -   `universo-platform-architecture`
    -   `mui-runtime-ux-patterns`
    -   `runtime-ux-qa`
    -   `playwright-best-practices`
    -   `turborepo`
    -   `vitest`

## Key Architecture Decisions

1. Use variant (c): the MMOOMM flight simulator is a metahub configuration, not a workspace package.
2. Start the generator from the `basic` metahub template unless implementation discovers a concrete import/export blocker. The MVP needs Hub, Object, Page, Set, and Enumeration presets, and `basic` already provides those without extra boilerplate.
3. Keep all reusable runtime code generic:
    - `@universo-react/playcanvas-engine`: PlayCanvas lifecycle, primitive geometry, camera, picking/math helpers.
    - `@universo-react/colyseus-client`: client connection, movement intent, interpolation/reconciliation helpers.
    - `@universo-react/colyseus-server`: fixed-tick simulation, command queue, movement, AABB guard helpers.
    - `@universo-react/apps-template-mui`: generic PlayCanvas canvas widget.
4. Do not add `packages/universo-react-mmoomm-*` or revive historical MMOOMM-specific package boundaries.
5. Treat existing sandboxed module execution as unsuitable for long-lived DOM/WebSocket runtime:
    - Use existing runtime module discovery and bundle metadata where it fits.
    - Add a controlled generic host bridge for trusted canvas/runtime and Colyseus room registration instead of running WebGL/WebSocket code through the restricted worker or per-call `isolated-vm` path.
6. Server authority is mandatory. The Colyseus room owns ship position, velocity scalar, movement command, target, arrival/stop state, and station guard decisions.
7. Client behavior is presentation only: send intents, interpolate authoritative state, optionally predict conservatively, and correct with LERP.
8. Station collision guard is a server-side segment/AABB or clipped-movement guard. Do not introduce PlayCanvas physics or a full collision system for this slice.
9. All user-facing text and states are localized in EN/RU. Normal users must not see raw UUIDs, room IDs, session IDs, WebSocket protocol errors, Zod errors, stack traces, JSON, or `[object Object]`.

## Affected Areas

-   `packages/universo-react-types`
    -   Widget key registry and strict widget config schema.
    -   Module manifest/package import normalization and runtime metadata types if needed.
    -   Shared runtime types if they are platform-wide and not wrapper-specific.
-   `packages/universo-react-modules-engine`
    -   Package import validation/externalization if attached package imports are not correctly propagated.
    -   Tests proving allowed package imports remain target-specific and fail closed.
-   `packages/universo-react-metahubs-backend`
    -   Module compilation path.
    -   Template seed executor.
    -   Snapshot restore/serializer manifest preservation.
    -   Package attachment import allowance for Modules.
-   `packages/universo-react-applications-backend`
    -   Runtime module sync.
    -   `_app_modules` and `_app_packages` consumption.
    -   Generic Colyseus runtime discovery/config and exported realtime attach seam for published application rooms.
    -   Auth, room scoping, and room lifecycle registration.
-   `packages/universo-react-core-backend`
    -   HTTP server integration for the applications realtime runtime.
    -   No second HTTP/WebSocket server should be created.
-   `packages/universo-react-apps-template-mui`
    -   Generic PlayCanvas canvas widget.
    -   Widget renderer and layout integration.
    -   Runtime widget helper reuse.
    -   i18n strings and runtime error sanitization.
    -   Package manifest dependency on `@universo-react/playcanvas-engine` and `@universo-react/colyseus-client`.
-   `packages/universo-react-playcanvas-engine`
    -   Generic PlayCanvas helpers.
    -   README/API documentation and tests.
-   `packages/universo-react-colyseus-client`
    -   Generic Colyseus client helpers.
    -   README/API documentation and tests.
-   `packages/universo-react-colyseus-server`
    -   Generic Colyseus server helpers.
    -   README/API documentation and tests.
-   Package manifests
    -   `@universo-react/apps-template-mui` must depend on the client/runtime wrappers it imports.
    -   `@universo-react/applications-backend` or the backend package that owns realtime registration must depend on `@universo-react/colyseus-server`.
    -   Direct upstream imports from `playcanvas`, `@colyseus/sdk`, or `@colyseus/core` outside wrapper packages need explicit justification.
-   `tools/testing/e2e`
    -   Product snapshot generator, contract checker, import helper, runtime helper, browser flow.
-   `tools/fixtures`
    -   New committed generated fixture: `metahubs-mmoomm-flight-app-snapshot.json`.
-   `docs/`
    -   GitBook EN/RU guide and architecture updates.
    -   Existing snapshot, modules, packages, and browser E2E docs.
-   `packages/universo-react-i18n` and package-local i18n
    -   Shared/common strings if they are cross-package.
    -   Widget-local strings in `apps-template-mui` if they are only used by the runtime widget.

## UI Contract

### UI Contract Matrix

Every touched user-facing screen, dialog, table, card, widget, and HUD must have an implementation-local UI contract before code lands. The minimum matrix is:

| Surface                                           | Existing Primitive To Reuse                                                                                      | Visible Controls And Labels                                                                                                             | Hidden/System-Owned Fields                                                                             | Required UX Proof                                                                                             |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Snapshot import dialog/page                       | Existing metahub snapshot import dialog, shared dialog actions, existing file/import controls                    | Localized file picker, import action, cancel/close, import progress, import result                                                      | Snapshot hash, snapshot format internals, metahub IDs, package IDs, module IDs, raw validation objects | Keyboard path through import, localized validation/errors, no raw JSON/object cells, no horizontal overflow   |
| Package attachment selector/table if touched      | Existing Packages tab table/list/dialog primitives                                                               | Localized package display name, runtime target badges, attach/change/detach actions                                                     | Package registry IDs, attachment IDs, internal dependency metadata                                     | No UUID-only labels, no raw dependency JSON, localized attach failures                                        |
| Module authoring/list/runtime metadata if touched | Existing Modules tab table/dialog primitives and shared runtime error sanitization                               | Localized module name, role, capability, target, compile status                                                                         | `manifest.packageImports` raw structure, bundle IDs, checksums, `_app_modules` rows                    | No raw JSON/object cells, package import errors mapped to localized messages, semantic descriptions multiline |
| Linked application creation                       | Existing application creation dialog/form primitives                                                             | Localized application name, create/cancel, success/failure state                                                                        | Application ID, workspace ID, publication ID                                                           | Keyboard path, localized validation, no raw IDs in normal success/failure states                              |
| Sync/runtime status                               | Existing application sync/status surfaces and alerts                                                             | Localized sync action/status, retry where available, concise failure summary                                                            | Runtime schema names, `_app_packages`, `_app_modules`, room registration keys                          | No internal schema/table names on normal user surface, sanitized technical failure details                    |
| Publish/open flow                                 | Existing publication/application actions and navigation primitives                                               | Localized publish/open labels, ready/error state                                                                                        | Publication IDs, runtime URLs with tokens, internal route keys                                         | User can complete flow without hidden knowledge; no raw IDs; responsive proof                                 |
| `playcanvasCanvas` widget                         | Existing dashboard widget container, widget renderer path, MUI toolbar/IconButton/Alert/Chip/Skeleton primitives | Focusable canvas, Stop icon button, connection state, optional compact HUD                                                              | Room ID, internal room name, session ID, world/object IDs, WebSocket URL, stack traces                 | Nonblank canvas, movement/camera proof, focus enter/leave, Escape release, no overflow                        |
| Runtime connection/error HUD                      | MUI `Alert`, `Chip`, `Tooltip`, `IconButton`, existing error sanitizer                                           | Localized connecting/reconnecting/restored/failed/ready/disconnected/unauthorized/room unavailable/full/version mismatch/runtime failed | Close codes, Zod errors, Colyseus auth payloads, protocol messages                                     | EN/RU assertions for all reachable states; no technical leakage                                               |

If implementation introduces any new surface not listed here, add it to the matrix before merging the implementation.

### Primary User Path Contract

The shipped product snapshot must be usable through the normal UI path, not through hidden direct URLs or API shortcuts after the fixture import starts:

1. Import the MMOOMM flight snapshot through the existing snapshot import dialog.
2. See localized import progress, success, and failure states.
3. Create a linked application from the imported publication through visible application UI actions.
4. Open the connector/sync surface, see non-empty diff/runtime options, sync through the UI, and see localized success/failure states.
5. Open the published application through visible navigation/actions.
6. Wait for the `playcanvasCanvas` widget to reach a localized ready state.
7. Move the ship, move toward the station, stop the ship, and zoom/orbit/reset camera without needing raw IDs or hidden protocol knowledge.
8. Validate reconnect/error states through deterministic state-oracle tests with localized UI and no technical leakage; they are not part of the normal happy path a user must manually trigger.

Playwright must prove this path with role/label/accessibility locators wherever the UI has a normal user surface. API checks may supplement the proof, but they must not replace the normal UI path.

### Surface

-   A new generic dashboard widget key, planned as `playcanvasCanvas`, renders inside `apps-template-mui` center-zone layouts and nested column layouts.
-   The widget is a bounded runtime surface, not a new page shell.
-   The canvas owner is the widget host component. It creates exactly one PlayCanvas application per mounted canvas and destroys it on unmount.
-   Reuse the existing dashboard/widget renderer path, existing widget container/grid behavior, MUI `Box`, `Stack`, `IconButton`, `Tooltip`, `Alert`, `Chip`, `Skeleton`, and existing runtime error sanitization before creating any new UI primitive. A new primitive needs a documented product reason in the implementation notes.
-   Existing dashboard widgets cannot host a long-lived bounded WebGL canvas with engine/realtime lifecycle ownership; this is the product reason for adding the generic `playcanvasCanvas` widget. All surrounding chrome still reuses app-template/MUI primitives.

### Controls

-   Canvas region:
    -   Focusable with an accessible localized label.
    -   Pointer interactions are active only when the canvas is focused or hovered as designed.
    -   Keyboard focus can enter and leave the widget.
    -   Escape releases any captured pointer/canvas mode and returns focus to normal page navigation.
-   Stop command:
    -   MUI `IconButton` with an accessible localized label.
    -   Sends a `stop` movement intent to the room.
-   Discoverable flight controls:
    -   Provide visible icon controls or a compact toolbar state for target/move mode, orbit mode, zoom in, zoom out, reset camera, and stop.
    -   Use MUI `IconButton`, `Tooltip`, localized accessible names, and stable test ids.
    -   Double-click, wheel, and drag remain supported shortcuts, but they are not the only discoverable way to operate the simulator.
-   Touch/mobile controls:
    -   Support tap-to-target for empty space, tap station for object movement, touch drag or explicit orbit buttons for camera orbit, pinch or explicit zoom buttons for zoom, and a visible release/reset control equivalent to Escape.
    -   The `390x844` viewport is a usable runtime target, not view-only.
-   Connection state:
    -   Localized compact state near the canvas: loading, connecting, reconnecting, restored, failed reconnect, ready, disconnected, unauthorized, room unavailable, room full, version mismatch, runtime initialization failed.
    -   No raw Colyseus room name, room ID, session ID, WebSocket URL, stack, or JSON.
-   Optional debug/test state:
    -   Do not expose raw IDs in normal UI.
    -   If test-only state is needed for Playwright, use stable `data-testid` attributes or sanitized summarized state, not visible raw protocol data.

### Defaults And Validation

-   `playcanvasCanvas` config should be strict, for example:

```ts
export const playcanvasCanvasWidgetConfigSchema = moduleBackedWidgetConfigSchema.extend({
    moduleCodename: z.string().min(1).optional(),
    attachedToKind: z.string().min(1).optional(),
    mountMethodName: z.string().min(1).default('mount'),
    minHeight: z.number().int().min(320).max(1200).default(520),
    aspectRatio: z
        .number()
        .positive()
        .min(1)
        .max(3)
        .default(16 / 9),
    worldCodename: z.string().min(1).optional()
})
```

-   Invalid config must fail through existing application layout validation with a localized user-facing error.
-   Default dimensions must prevent horizontal overflow and prevent layout shifts during loading, ready, reconnecting, and error states.
-   Runtime room identity is derived internally from application, workspace, and world binding. Do not require a normal user to type or understand a room name.
-   Normal package UI shows localized display names and runtime target badges. Scoped package names such as `@universo-react/...`, registry IDs, dependency JSON, checksums, and `_app_*` internals are admin/debug/docs-only, not normal user labels.
-   Semantic long text fields touched by the implementation, including descriptions, notes, runtime failure summaries, and fixture/generator descriptions, must use multiline controls where they are editable.
-   Raw ID fields, checksums, schema/table names, bundle IDs, and protocol fields are hidden or admin/debug-only, never normal-user display values.

### Responsive Proof

-   Browser QA must verify `1920x1080`, `768x1024`, and `390x844`.
-   Assertions must include:
    -   no document-level horizontal overflow;
    -   canvas visible and nonblank;
    -   controls do not overlap the canvas in an unusable way;
    -   text fits in loading/error/reconnect states;
    -   canvas remains bounded by the widget container;
    -   any internal table/grid overflow stays inside its own container and does not become page-level overflow.

## Entity And Snapshot Contract

The generated metahub snapshot must be importable as a real product artifact.

### Package Attachments

Attach these three packages through the metahub Packages system:

-   `@universo-react/playcanvas-engine`
-   `@universo-react/colyseus-client`
-   `@universo-react/colyseus-server`

The generator must use package attachment API helpers. Snapshot contract checks must fail if the fixture only contains modules but no package attachments.

### Configuration Entities

-   Hub:
    -   Flight simulator root/world grouping.
-   Objects:
    -   World object with room/runtime configuration.
    -   Ship object with dimensions `12 x 4 x 4`, white material, initial position, speed constants reference.
    -   Station object with dimensions `48 x 16 x 16`, white material, fixed position, AABB guard data.
    -   Optional camera state/preset object if it is clearer than putting all camera defaults in widget config.
-   Enumeration:
    -   Movement command types: `move_to_point`, `move_to_object`, `stop`.
-   Set:
    -   Simulation constants: cruise speed, acceleration time, deceleration time, arrival radius, station guard padding, camera min/max zoom.
-   Modules:
    -   Client widget module for scene assembly and runtime binding.
    -   Server room module/definition metadata consumed by the generic room bridge.
    -   Optional shared math/config module if it reduces duplication.
-   Layout:
    -   Center-zone `playcanvasCanvas` widget configured to select the client module and world/room.

### Naming

-   MMOOMM-specific names are allowed in the metahub configuration, fixture, and user-facing product docs.
-   MMOOMM-specific names are not allowed in generic wrapper package APIs, helper names, test names, package READMEs, or generic widget docs.

## Colyseus Contract

### Runtime Bridge

Add a generic Colyseus host owned by the applications runtime. Discovery and configuration remain in `applications-backend`, but the WebSocket transport is attached to the actual HTTP server in `core-backend`.

The bridge must not let arbitrary modules start their own servers. It owns server registration, auth, lifecycle, and cleanup. Do not create a second HTTP/WebSocket server.

Implementation direction:

-   Add/export `attachApplicationsRealtimeRuntime(server, deps)` or an equivalent attach function from the applications runtime boundary.
-   Call that attach function from `core-backend` after `http.createServer(...)`.
-   For the MVP, the host constructs a generic room from published application runtime metadata, package attachments, and world/ship/station configuration.
-   Metahub Modules may provide declarative metadata/configuration only. They must not provide arbitrary long-lived Colyseus room lifecycle code for the MVP.
-   Do not add a public `RuntimeRoomDefinition` shared interface to `@universo-react/types` for the MVP. Use existing module `config` on `MetahubModuleDefinition` / `ApplicationModuleDefinition`, `ModuleManifest.packageImports`, application runtime metadata, and host-owned adapters first; introduce a new shared interface only if implementation evidence proves cross-package compile-time coupling is needed.

### Room Lifecycle

-   `onAuth`: validate platform session/application/workspace access before join.
-   `onCreate`: load immutable configuration from the published application runtime snapshot and initialize room state.
-   `onJoin`: add client role as controller or observer.
-   `onMessage`: accept only validated intents: `move_to_point`, `move_to_object`, `stop`.
-   `setSimulationInterval`: process command queue and movement on a fixed tick.
-   `onDrop`/`onReconnect`: expose localized reconnect states and allow temporary reconnect when feasible.
-   `onLeave`: remove client references without resetting authoritative ship state while observers/controllers remain.
-   `onDispose`: clean timers, queues, module resources, and room cache entries.

### Authoritative State

Keep the Schema small and nested to avoid Colyseus Schema field limits:

```ts
export class Vector3State extends Schema {
    @type('number') x = 0
    @type('number') y = 0
    @type('number') z = 0
}

export class ShipState extends Schema {
    @type(Vector3State) position = new Vector3State()
    @type(Vector3State) target = new Vector3State()
    @type('number') speed = 0
    @type('string') command = 'stop'
    @type('boolean') moving = false
}

export class FlightRoomState extends Schema {
    @type(ShipState) ship = new ShipState()
    @type('number') serverTime = 0
}
```

### Movement Primitive

The server helper should be pure and unit-testable:

```ts
export function stepPointMovement(input: StepMovementInput): StepMovementResult {
    const desiredDirection = normalize(sub(input.target, input.position))
    const nextSpeed = approach(input.speed, input.cruiseSpeed, input.acceleration * input.dt)
    const requestedEnd = add(input.position, scale(desiredDirection, nextSpeed * input.dt))
    const guardedEnd = clipSegmentAgainstAabb({
        from: input.position,
        to: requestedEnd,
        blockedBox: expandAabb(input.stationBounds, input.guardPadding),
        stopDistance: input.arrivalRadius
    })

    return {
        position: guardedEnd.position,
        speed: guardedEnd.blocked ? 0 : nextSpeed,
        arrived: distance(guardedEnd.position, input.target) <= input.arrivalRadius,
        blocked: guardedEnd.blocked
    }
}
```

## PlayCanvas Contract

### Lifecycle

-   One PlayCanvas `Application` per mounted widget canvas.
-   The widget owns canvas creation, resize observer, input listeners, Colyseus client, scene entities, update callbacks, and cleanup.
-   The game loop must not drive per-frame transforms through React state.
-   React state receives only summarized UI state such as connection status, ready/error state, and maybe coarse debug telemetry for tests.

### Scene

-   Units are meters.
-   Ship:
    -   Primitive box.
    -   Local scale `12, 4, 4`.
    -   White flat material.
-   Station:
    -   Primitive box.
    -   Local scale `48, 16, 16`.
    -   White flat material.
    -   Fixed position.
-   Camera:
    -   Follow/orbit controller targets the authoritative ship position.
    -   Supports zoom in/out with min/max bounds.
    -   Supports orbit rotation around the ship.
    -   Smooths visually, but does not become authoritative physics.
-   Lighting:
    -   Minimal ambient/directional lighting sufficient to see white geometry against a darker neutral background.
-   Picking:
    -   Use generic screen ray + AABB helpers for empty-space target and station click where feasible.
    -   Avoid PlayCanvas physics/collision components unless the math helper is insufficient.

### Generic Helper Examples

```ts
export interface OrbitFollowCameraOptions {
    target: () => Vec3Like
    minDistance: number
    maxDistance: number
    initialDistance: number
    yaw: number
    pitch: number
    smoothing: number
}

export function createOrbitFollowCameraController(
    app: Application,
    camera: Entity,
    options: OrbitFollowCameraOptions
): OrbitFollowCameraController {
    // Implementation owns math and update callbacks, not React state.
}
```

```ts
export function createBoxEntity(app: Application, options: BoxEntityOptions): Entity {
    const entity = new Entity(options.name)
    entity.addComponent('render', { type: 'box', material: options.material })
    entity.setLocalScale(options.size.x, options.size.y, options.size.z)
    entity.setPosition(options.position.x, options.position.y, options.position.z)
    app.root.addChild(entity)
    return entity
}
```

## Plan Steps

### Phase 1: Baseline And Guardrails

-   [ ] Confirm the working tree state and avoid reverting unrelated user changes.
-   [ ] Read package READMEs for affected packages before editing them.
-   [ ] Confirm Node 22 in the shell before build/test commands.
-   [ ] Do not run `pnpm dev`; use package builds/tests and Playwright wrappers.
-   [ ] Add or update a small implementation ledger in the eventual IMPLEMENT notes so generic package changes and MMOOMM configuration changes remain visibly separated.

### Phase 2: Module Package Imports And Manifest Preservation

-   [ ] Fix module manifest normalization so `manifest.packageImports` is preserved through authoring, snapshot restore, publication sync, and runtime module list/read paths.
-   [ ] Preserve `manifest.packageImports` specifically in `syncModulePersistence.normalizeManifest`, `RuntimeModulesService.normalizeModule`, and snapshot restore validation.
-   [ ] Connect metahub package attachments to `allowedPackageImports` when compiling Modules in:
    -   `MetahubModulesService`
    -   `TemplateSeedExecutor`
    -   published module listing/compilation paths;
    -   snapshot restore recompilation;
    -   any snapshot restore or generator path that compiles modules.
-   [ ] Resolve metahub attached packages before every compile path and pass them as `allowedPackageImports` into `compileModuleSource`.
-   [ ] After snapshot restore, recompile restored modules with restored package attachments before the imported metahub is published/synced. Restored modules with `server_bundle: null` or `client_bundle: null` are not acceptable for this runtime fixture.
-   [ ] Keep target enforcement strict:
    -   browser/client modules may import `@universo-react/playcanvas-engine` and `@universo-react/colyseus-client`;
    -   server/room modules may import `@universo-react/colyseus-server`;
    -   unsupported imports, dynamic imports, `require`, and `import.meta` remain blocked.
-   [ ] Add focused compiler and metahubs backend tests for:
    -   attached package import succeeds;
    -   missing package attachment fails;
    -   client/server target mismatch fails;
    -   `manifest.packageImports` survives snapshot restore and runtime sync.
    -   `manifest.packageImports` survives metahub export -> import restore -> publication sync -> runtime module list/read.

### Phase 3: Generic Colyseus Runtime Bridge

-   [ ] Add a generic applications realtime host that registers host-owned Colyseus rooms under the existing core HTTP server.
-   [ ] Export `attachApplicationsRealtimeRuntime(server, deps)` or equivalent from the applications runtime boundary and call it from `core-backend` after `http.createServer(...)`.
-   [ ] Do not create a second HTTP/WebSocket server.
-   [ ] Do not execute arbitrary long-lived room lifecycle code from metahub Modules. For MVP, use published runtime metadata and host-owned generic adapters; Modules provide declarative configuration only.
-   [ ] Define new room-capable metadata in shared types only if existing module `config`, `ModuleManifest.packageImports`, module role/capabilities, and application runtime metadata cannot express it safely.
-   [ ] Load host-owned room runtime configuration from runtime `_app_modules.config` / application runtime metadata and package data from `_app_packages` after application sync.
-   [ ] Scope room names internally by application, workspace, and configured world object while keeping visible UI labels user-friendly.
-   [ ] Implement auth through existing application/workspace/session access services and request-scoped executor patterns where DB access is needed.
-   [ ] Ensure server-side code follows Knex/raw SQL boundary rules through `DbExecutor` and does not import `knex` directly outside allowed infrastructure.
-   [ ] Add tests for bridge discovery, registration, auth rejection, observer/controller joins, cleanup, and sync failure behavior.

### Phase 4: Generic Wrapper Helpers

-   [ ] Add required workspace dependencies to consuming package manifests before importing wrapper APIs:
    -   `@universo-react/apps-template-mui` -> `@universo-react/playcanvas-engine`, `@universo-react/colyseus-client`;
    -   applications/core backend runtime owner -> `@universo-react/colyseus-server`.
-   [ ] Keep direct upstream package imports inside the wrapper packages unless a local implementation note explains why a boundary package must import upstream directly.
-   [ ] In `@universo-react/playcanvas-engine`, add generic helpers for:
    -   bounded canvas app creation and resize cleanup;
    -   primitive box entity creation;
    -   flat material creation;
    -   orbit/follow camera;
    -   screen ray/AABB picking if not better placed in `@universo-react/utils`.
-   [ ] In `@universo-react/colyseus-server`, add generic helpers for:
    -   movement command schemas or validators;
    -   fixed-tick movement loop primitive;
    -   acceleration/deceleration;
    -   arrival/stop behavior;
    -   segment/AABB station guard;
    -   small Schema-friendly state helpers if appropriate.
-   [ ] In `@universo-react/colyseus-client`, add generic helpers for:
    -   connection lifecycle and state mapping;
    -   validated movement intent sending;
    -   double-click target adapter;
    -   interpolation/LERP correction;
    -   reconnect state handling.
-   [ ] Place only truly cross-package types in `@universo-react/types` and only pure shared utilities in `@universo-react/utils`.
-   [ ] Keep wrapper tests and docs generic and free of MMOOMM-specific wording.

### Phase 5: Generic PlayCanvas Canvas Widget

-   [ ] Add `playcanvasCanvas` to `DASHBOARD_LAYOUT_WIDGETS` with allowed zones at least `center`, and decide whether nested use in `columnsContainer` is supported.
-   [ ] Add strict widget config schema in `@universo-react/types/src/common/applicationLayouts.ts`.
-   [ ] Add renderer support in `apps-template-mui` without creating a parallel app shell.
-   [ ] Reuse `useRuntimeWidgetClientModule(...)` for module discovery and client bundle metadata.
-   [ ] Do not execute DOM/WebSocket/PlayCanvas logic through the existing restricted worker path. The widget host or a new explicit trusted bridge owns runtime mounting.
-   [ ] Add localized EN/RU states under the appropriate `apps-template-mui` i18n namespace:
    -   loading module;
    -   module not configured;
    -   connecting;
    -   reconnecting;
    -   restored after reconnect;
    -   failed reconnect;
    -   ready;
    -   disconnected;
    -   unauthorized;
    -   room unavailable;
    -   room full;
    -   version mismatch;
    -   WebSocket close mapped to a user-facing status;
    -   Colyseus auth rejection mapped to a user-facing status;
    -   Zod/schema validation failure mapped to a user-facing status;
    -   package import compile failure mapped to a user-facing status;
    -   snapshot import validation failure mapped to a user-facing status;
    -   runtime initialization failed;
    -   stop command label.
-   [ ] Use existing runtime error sanitization helpers for user-facing failures.
-   [ ] Add unit/component tests for standalone and nested rendering, loading/empty/error states, bounded sizing, localized labels, and no raw technical leakage.

### Phase 6: MMOOMM Product Snapshot Generator

-   [ ] Add package attachment helpers to `tools/testing/e2e/support/backend/api-session.mjs` for package catalog/list/attach/change/detach endpoints.
-   [ ] The MMOOMM generator must follow the LMS export-driven artifact pattern:
    -   create the product metahub through the same API/session path as LMS;
    -   attach packages through package APIs;
    -   create entities, modules, and layouts through product APIs;
    -   call `/api/v1/metahub/:id/export`;
    -   rebuild/validate the snapshot envelope with `buildSnapshotEnvelope` and `validateSnapshotEnvelope`;
    -   run `assertMmoommFlightFixtureEnvelopeContract`;
    -   only then write `tools/fixtures/metahubs-mmoomm-flight-app-snapshot.json`.
-   [ ] Direct hand-authored JSON fixtures are forbidden.
-   [ ] Add `tools/testing/e2e/support/mmoommFlightFixtureContract.ts`.
-   [ ] Add `tools/testing/e2e/support/checkMmoommFlightFixtureContract.ts`.
-   [ ] Add `tools/testing/e2e/support/mmoommFlightSnapshotImport.ts`.
-   [ ] Add `tools/testing/e2e/support/mmoommFlightRuntime.ts`.
-   [ ] Add generator spec:
    -   `tools/testing/e2e/specs/generators/metahubs-mmoomm-flight-app-export.spec.ts`.
-   [ ] Generate and commit:
    -   `tools/fixtures/metahubs-mmoomm-flight-app-snapshot.json`.
-   [ ] Contract checker must validate:
    -   snapshot envelope format and hash;
    -   runtime policy and product acceptance matrix;
    -   attached three packages;
    -   exact package/version/target contracts:
        -   `@universo-react/playcanvas-engine@0.1.0`, target `client`;
        -   `@universo-react/colyseus-client@0.1.0`, target `client`;
        -   `@universo-react/colyseus-server@0.1.0`, target `server`;
    -   world, ship, station objects;
    -   ship and station dimensions;
    -   movement command enumeration values;
    -   simulation constants;
    -   required client/server/runtime modules;
    -   `playcanvasCanvas` layout widget;
    -   no test-only shortcut that bypasses importable metahub data.
-   [ ] Add `MMOOMM_FLIGHT_ACCEPTANCE_MATRIX` in `mmoommFlightFixtureContract.ts` with gates for:
    -   `productSnapshot`;
    -   `packageAttachments`;
    -   `publishedRuntime`;
    -   `authoritativeMovement`;
    -   `stationGuard`;
    -   `cameraControls`;
    -   `touchControls`;
    -   `observerSync`;
    -   `runtimeUxLocalization`.
-   [ ] The contract checker must fail if any matrix area lacks required entities, modules, layout widgets, browser evidence, or has a deferred gap not explicitly scoped out.
-   [ ] Add a root script analogous to the LMS contract checker if useful.

### Phase 7: Browser Runtime E2E Flow

-   [ ] Add `tools/testing/e2e/specs/flows/snapshot-import-mmoomm-flight-runtime.spec.ts`.
-   [ ] Mirror the LMS import/runtime flow rather than opening a private test shortcut:
    -   use `loadMmoommFlightSnapshotFixture()` plus the UI import dialog;
    -   assert imported metahub/publication IDs for cleanup and API follow-up only, not as normal user-facing labels;
    -   verify imported package attachments and the `playcanvasCanvas` layout via API after import;
    -   create a linked app from the imported publication;
    -   open the connector board;
    -   assert non-empty diff metrics and workspace/runtime options;
    -   sync through the UI;
    -   reach the published runtime through visible Open/published-app navigation; `/a/:applicationId` may be asserted as the resulting route and used for cleanup, but must not be typed or constructed as the normal-user path.
-   [ ] Post-import proof must fail if the imported metahub only contains module references and not the three package attachments.
-   [ ] Use local minimal Supabase for this E2E plan:
    -   `pnpm supabase:e2e:start:minimal`
    -   `pnpm env:e2e:local-supabase`
    -   `pnpm doctor:e2e:local-supabase`
    -   `pnpm run build:e2e`
    -   Playwright wrapper with `UNIVERSO_ENV_FILE=.env.e2e.local-supabase` and frontend env file.
-   [ ] Use the repository Playwright wrapper; do not run `pnpm dev`.
-   [ ] Browser assertions:
    -   canvas exists, is visible, and is bounded;
    -   canvas is nonblank through pixel sampling or an equivalent canvas oracle, with screenshots only as supporting artifacts;
    -   ship and station are visible in expected relative scale;
    -   double-click empty space sends `move_to_point` and ship arrives near target;
    -   click station sends `move_to_object` and ship approaches without entering station AABB;
    -   Stop control stops the ship before target;
    -   wheel zoom changes camera distance;
    -   drag/orbit rotates camera around ship;
    -   visible toolbar/icon controls can move/select mode, zoom in/out, reset camera, orbit, and stop;
    -   touch/mobile controls work at `390x844`: tap target, tap station, zoom buttons or pinch, orbit touch/buttons, stop, and release/reset;
    -   second browser context observes the same authoritative ship state;
    -   deterministic fixtures/mocks cover connecting, reconnecting, restored, failed reconnect, disconnected, unauthorized, room unavailable/full, version mismatch, and runtime failed states;
    -   keyboard focus can enter and leave the canvas;
    -   Escape releases pointer capture/lock and returns control to normal page navigation;
    -   dialogs and text fields remain usable while the canvas widget exists;
    -   no page-level horizontal overflow across `1920x1080`, `768x1024`, and `390x844`;
    -   no visible raw IDs, JSON, protocol errors, stack traces, or `[object Object]`.
-   [ ] Canvas/WebGL assertions and observer-tab synchronization are primary evidence. Sanitized `data-testid` telemetry may supplement browser-visible canvas, user controls, Colyseus state propagation, and server/API assertions, but it must not be the sole proof of movement or synchronization.
-   [ ] Capture/assert EN and RU evidence for import result, app creation success, publish/open ready state, runtime first-load state, and runtime failure states.
-   [ ] Use or add explicit Playwright UX oracles:
    -   `expectNoTechnicalLeakage`;
    -   `expectLocalizedValidation`;
    -   `expectNoPageHorizontalOverflow`;
    -   `expectRuntimeUxViewportMatrix`;
    -   canvas nonblank pixel oracle;
    -   keyboard/focus path checks by role, label, accessible name, or stable test id.
-   [ ] Save screenshots for desktop/tablet/mobile runtime states and use assertions, not screenshots alone.

### Phase 8: Test Matrix

-   [ ] `@universo-react/types`
    -   Widget key/schema tests.
    -   Module manifest/package import preservation tests.
-   [ ] `@universo-react/modules-engine`
    -   Package import allowlist and target tests.
-   [ ] `@universo-react/metahubs-backend`
    -   Compile with attached packages.
    -   Snapshot restore/serialize package/module manifest tests.
    -   Fixture-generation API helper coverage where practical.
-   [ ] `@universo-react/applications-backend`
    -   Runtime sync tests for modules/packages.
    -   Realtime host discovery/config tests.
    -   Colyseus room registration/auth/cleanup tests through the exported attach seam.
    -   Route/controller tests for runtime module/room endpoints.
-   [ ] `@universo-react/core-backend`
    -   HTTP server integration test or focused startup test proving the applications realtime attach function is called on the existing server.
    -   Guard proving no second HTTP/WebSocket server is created.
-   [ ] `@universo-react/apps-template-mui`
    -   Widget renderer tests.
    -   Runtime helper tests.
    -   Component tests for localized loading/error/ready states and bounded layout.
-   [ ] Wrapper package tests:
    -   PlayCanvas helpers: lifecycle, resize, primitive dimensions, camera clamp/orbit math, cleanup.
    -   Colyseus server helpers: movement, acceleration, deceleration, arrival, stop, AABB guard.
    -   Colyseus client helpers: intent validation, double-click timing, interpolation, reconnect state mapping.
-   [ ] E2E:
    -   Generator.
    -   Contract checker.
    -   Snapshot import/runtime flow.
    -   Multi-context observer sync.
-   [ ] Final validation commands to plan for IMPLEMENT/QA:
    -   focused package tests/builds first;
    -   `pnpm run build:e2e`;
    -   generator suite;
    -   runtime E2E suite;
    -   docs screenshot/checker suite for the MMOOMM guide if added;
    -   full `pnpm install && pnpm build` before closure, acknowledging this is expensive and should be run at the final validation point.

## Documentation Plan

-   [ ] Update wrapper package READMEs:
    -   `packages/universo-react-playcanvas-engine/README.md`
    -   `packages/universo-react-colyseus-client/README.md`
    -   `packages/universo-react-colyseus-server/README.md`
-   [ ] Update `packages/universo-react-apps-template-mui/README.md` with the generic `playcanvasCanvas` widget contract.
-   [ ] Update E2E docs:
    -   `tools/testing/e2e/README.md`
    -   `tools/testing/e2e/README-RU.md`
-   [ ] Update GitBook docs EN/RU:
    -   `docs/*/guides/browser-e2e-testing.md`
    -   `docs/*/guides/snapshot-export-import.md` including current snapshot format version.
    -   `docs/*/guides/application-layouts.md` for the new widget key.
    -   `docs/*/guides/metahub-modules.md` for package imports and runtime module constraints.
    -   `docs/*/platform/metahubs/packages.md` for package attachment behavior.
    -   `docs/*/architecture/modules-system.md` for package import allowlists and runtime room bridge.
-   [ ] Add a user-facing MMOOMM flight simulator guide as part of the product snapshot deliverable:
    -   `docs/en/guides/mmoomm-flight-simulator.md`
    -   `docs/ru/guides/mmoomm-flight-simulator.md`
    -   entries in `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`.
-   [ ] Add a docs screenshot generator/manifest/checker entry analogous to the LMS user-guide workflow, with EN/RU parity and no technical leakage.
-   [ ] Ensure docs are GitBook-compatible Markdown and keep EN/RU parity.

## Potential Challenges And Mitigations

-   **Colyseus room registration from Modules is not currently first-class.**
    -   Mitigation: implement a generic applications-backend room bridge. Do not force long-lived rooms through per-call `isolated-vm`.
-   **Attached packages are not yet wired into module compilation everywhere.**
    -   Mitigation: treat package import propagation as an early blocker and add fail-closed tests before building the simulator fixture.
-   **Browser module worker sandbox cannot mount PlayCanvas or open WebSockets directly.**
    -   Mitigation: use runtime widget helpers for discovery/metadata, but let the trusted widget host own DOM/WebSocket/engine lifecycle.
-   **Canvas E2E tests can be flaky if they rely only on screenshots.**
    -   Mitigation: combine stable locators, canvas bounding boxes, pixel sampling, state assertions, and screenshot artifacts.
-   **White objects can be invisible against a light background.**
    -   Mitigation: use a darker neutral clear color and sufficient lighting while keeping ship/station materials flat white.
-   **Station click picking can accidentally require a physics stack.**
    -   Mitigation: start with generic ray/AABB math; introduce PlayCanvas collision only if implementation evidence shows the math path is insufficient.
-   **Room identity and state sharing can leak raw IDs into UI.**
    -   Mitigation: scope internally by IDs but display only localized labels and sanitized state.
-   **Full root build is expensive.**
    -   Mitigation: run focused package tests/builds during implementation and reserve full `pnpm install && pnpm build` for final closure.

## Approval Gate

Do not implement yet. After approval, proceed in IMPLEMENT mode with Phase 1 through Phase 8, keeping the generic package work and MMOOMM fixture configuration clearly separated in commits/notes.
