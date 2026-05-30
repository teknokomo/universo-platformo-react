# MMOOMM Multi-Ship Authoritative Sync Plan

**Date**: 2026-05-29  
**Brief**: MMOOMM — Multi-Ship Authoritative Sync  
**Research Artifact**: `memory-bank/research/mmoomm-multi-ship-authoritative-sync-research-2026-05-29.md`  
**Mode**: PLAN only; do not implement until approved.

## Overview

Extend the implemented MMOOMM flight runtime from one authoritative ship to a minimal multi-user Colyseus room where two authenticated users each receive a server-owned ship, send movement intents only, and see each other's ships move in the published `apps-template-mui` PlayCanvas runtime. The work must keep wrapper packages generic, avoid a new MMOOMM-specific package, and prove the feature with unit, integration, and Playwright browser evidence on local minimal Supabase.

## Affected Areas

-   `packages/universo-react-applications-backend/src/realtime/applicationsRealtimeRuntime.ts`
    Current single-ship `fixed_tick_scene` room, matchmake middleware, auth-derived room options, room lifecycle, state schema, intent validation.
-   `packages/universo-react-applications-backend/src/tests/realtime/applicationsRealtimeRuntime.test.ts`
    Jest coverage for room options, auth/control, multi-ship state, invalid intents, spawn safety, reconnect lifecycle.
-   `packages/universo-react-colyseus-server/src/movement.ts`
    Generic pure helpers for actor/entity spawn search, blocking tests, keyed movement stepping, and input queue helpers if they remain generic.
-   `packages/universo-react-colyseus-client/src/interpolation.ts`
    Generic interpolation/prediction helper additions for keyed remote entity snapshots if useful outside MMOOMM.
-   `packages/universo-react-playcanvas-engine/src/runtime.ts`
    Only generic primitive helper additions if keyed primitive entity creation/orientation can be abstracted cleanly without MMOOMM naming.
-   `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx`
    Runtime widget rendering local and remote entities from configured realtime state, input ownership, status UI, dataset probes for E2E, no raw protocol leakage.
-   `packages/universo-react-apps-template-mui/src/dashboard/components/__tests__/PlayCanvasCanvasWidget.test.tsx`
    Vitest component coverage for keyed realtime entity rendering, local control only, remote interpolation, UX states, leakage guards.
-   `packages/universo-react-apps-template-mui/src/i18n/locales/{en,ru}/apps.json`
    New localized labels/states for local entity, remote entity, reconnect, room full, unauthorized, version mismatch, and user-facing multiplayer status.
-   `tools/testing/e2e/specs/flows/snapshot-import-mmoomm-flight-runtime.spec.ts`
    Extend or split the existing MMOOMM runtime flow to prove two authenticated users and remote movement propagation.
-   `tools/testing/e2e/specs/generators/metahubs-mmoomm-flight-app-export.spec.ts`, `tools/testing/e2e/support/mmoommFlightFixtureContract.ts`, `tools/fixtures/metahubs-mmoomm-flight-app-snapshot.json`
    Update only if the fixture module contract or snapshot needs new multi-ship runtime metadata.
-   `tools/testing/e2e/support/checkMmoommFlightFixtureContract.ts`
    Add this CLI checker if the implementation wires a root fixture-contract script, mirroring `checkLmsFixtureContract.ts`.
-   `package.json`
    Add a root `check:mmoomm-flight-fixture-contract` script if the implementation keeps requiring the checker in closeout, mirroring the LMS fixture contract pattern.
-   `docs/en/guides/mmoomm-flight-simulator.md`, `docs/ru/guides/mmoomm-flight-simulator.md`, `docs/en/SUMMARY.md`, `docs/ru/SUMMARY.md`
    GitBook-style documentation update for the multiplayer runtime proof and commands.
-   `memory-bank/tasks.md`, `memory-bank/progress.md`
    Update during IMPLEMENT/QA closure, not during this PLAN.

## Design Notes

### Architecture Placement

-   Keep MMOOMM-specific behavior in the metahub runtime modules and the published application runtime configuration.
-   Keep the room host in `@universo-react/applications-backend`, because it already bridges application auth, runtime schema, modules, and Colyseus matchmaking.
-   Add only generic reusable helpers to `@universo-react/colyseus-server`, `@universo-react/colyseus-client`, or `@universo-react/playcanvas-engine`.
-   Do not add a new MMOOMM package.
-   Do not use Supabase Realtime; this feature uses Colyseus WebSockets owned by the app backend.
-   Preserve the metahub-as-configuration boundary: MMOOMM domain setup remains in Hub/Object/Enumeration/Set entities and attached Modules. Generic package code must not mention MMOOMM, stations, pilots, sectors, mining, Inmo, or other domain terms.
-   The product fixture remains the delivery artifact. Changes to `tools/fixtures/metahubs-mmoomm-flight-app-snapshot.json` must be generated through `tools/testing/e2e/specs/generators/metahubs-mmoomm-flight-app-export.spec.ts`; do not hand-edit the JSON snapshot.
-   No schema/template version bump is required for this MVP slice. The implementation may migrate the current fixture/test contract in one cut because the test database will be recreated.

### Server State Contract

Replace the singleton `state.ship` surface with a keyed state shape while preserving a compatibility path if necessary for existing tests during migration:

```ts
class Vector3State extends Schema {
    x = 0
    y = 0
    z = 0
}

class ShipState extends Schema {
    shipId = ''
    displayName = ''
    connected = true
    lastProcessedInputSeq = 0
    lastServerTick = 0
    position = new Vector3State()
    velocity = new Vector3State()
    heading = new Vector3State()
    target = new Vector3State()
    hasTarget = false
    speed = 0
}

class FixedTickSceneState extends Schema {
    ships = new MapSchema<ShipState>()
    serverTick = 0
}
```

Do not put `controlledByCurrentClient` or other client-specific truth into shared room state unless it is explicitly filtered per client. The local ship identity must come from the authenticated join response or a private server message such as `local_ship_assigned`, then be stored client-side. Do not expose raw user/session IDs in UI.

The server must keep private runtime maps outside Schema:

```ts
interface PrivateShipRuntime {
    shipId: string
    ownerUserId: string
    sessionIds: Set<string>
    canControl: boolean
    inputQueue: MovementIntentEnvelope[]
    reservedSpawn: Vector3Like
    reconnectingUntil: number | null
}
```

`shipId` is a stable opaque runtime ID for this room scope, not a user-facing label. It can be generated with UUID v7 or a deterministic room-local allocator, but normal users see localized labels from runtime config, never the raw ID.

### Intent Contract

Use a strict intent envelope with sequence numbers and server validation:

```ts
const movementIntentSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal('stop'), seq: z.number().int().nonnegative() }).strict(),
    z
        .object({
            type: z.literal('move_to_point'),
            seq: z.number().int().nonnegative(),
            target: boundedVector3Schema
        })
        .strict(),
    z
        .object({
            type: z.literal('move_to_object'),
            seq: z.number().int().nonnegative(),
            objectId: z.string().min(1).max(128)
        })
        .strict()
])
```

Use `safeParse`, drop invalid messages fail-closed, and never return raw Zod errors to clients.

The message handler only validates, authorizes, bounds, and queues intents. Movement state changes happen during `setSimulationInterval`, where the server processes each ship queue in sequence order, updates `lastProcessedInputSeq`, and mutates Schema state.

### Spawn Safety

Use a deterministic server-owned search around the configured origin:

```ts
export function findFreeSpawnPosition(params: {
    origin: Vector3Like
    blockers: readonly AabbLike[]
    occupiedEntities: readonly { position: Vector3Like; radius: number }[]
    bodyRadius: number
    safetyMargin: number
    maxAttempts: number
    ringSpacing: number
}): Vector3Like | null {
    for (let attempt = 0; attempt < params.maxAttempts; attempt += 1) {
        const angle = attempt * 2.399963229728653 // golden angle
        const ring = Math.floor(Math.sqrt(attempt))
        const distance = ring * params.ringSpacing
        const candidate = {
            x: params.origin.x + Math.cos(angle) * distance,
            y: params.origin.y,
            z: params.origin.z + Math.sin(angle) * distance
        }
        if (isSpawnFree(candidate, params)) return candidate
    }
    return null
}
```

Reserve a candidate during `onJoin`; if none is free, reject the join with a generic room-full/unavailable status and no raw room data.

### PlayCanvas Runtime Contract

-   One `pc.Application` per mounted canvas.
-   Static scene objects remain primitive boxes from metahub config.
-   Local and remote ships are PlayCanvas entities created from authoritative `state.ships`.
-   Local controlled entity: prediction + LERP correction.
-   Remote entities: interpolation buffers keyed by opaque runtime entity ID.
-   Per-frame transforms stay inside `app.on('update')`; do not drive 60fps transforms through React state.
-   Cleanup removes room listeners, pointer captures, timers, entity maps, ResizeObserver, event listeners, and destroys the PlayCanvas app.

## UI Contract

-   Surface: existing `playcanvasCanvas` widget inside `apps-template-mui`; no parallel runtime shell.
-   Controls: reuse the existing widget toolbar/buttons after implementation discovery. Do not introduce a new runtime shell, modal, side panel, or bespoke control framework.
-   Local/remote distinction: all ships stay primitive white PlayCanvas boxes. The local ship is identified by camera follow plus localized status text from widget/runtime config; remote ships are identified by localized labels from widget/runtime config in the existing widget status area. For the MMOOMM fixture those labels can be `You` and `Pilot 2`; generic template code must use neutral defaults such as `You` and `Remote object` unless configured. Do not add final art, textures, avatars, minimaps, or a new legend panel in this slice.
-   Labels: local ship is shown as localized `You`; remote ships use a safe display name or a localized configurable fallback. No raw `shipId`, `userId`, `sessionId`, room ID, UUID-only value, or socket ID is visible.
-   States: localized EN/RU messages for loading, connecting, connected, reconnecting, restored, disconnected, failed reconnect, unauthorized, room full, version mismatch, and unavailable.
-   Validation/errors: raw Colyseus/WebSocket/Zod/server errors are mapped to user-facing messages.
-   Focus/input: canvas is focusable; Escape releases pointer capture and stops local ship; dialogs/text fields are never intercepted by game controls; focus can leave the canvas by normal keyboard navigation.
-   Responsive: canvas remains bounded by its MUI widget container; no document-level horizontal overflow at desktop/tablet/mobile; HUD/status text wraps instead of overflowing.
-   Evidence: Playwright must assert no technical leakage, no page-level horizontal overflow, nonblank canvas, visible local/remote ships, and multi-client movement propagation.

### UI Contract Matrix

| State                           | Placement                                                                               | Visible Copy                                                     | Controls                                                                  | Required Assertions                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Loading module                  | Existing widget body/status caption                                                     | Localized loading text                                           | Movement disabled; camera controls disabled until canvas is ready         | No raw module IDs or bundle names                                   |
| Connecting                      | Existing realtime status caption                                                        | Localized connecting text                                        | Movement disabled; camera controls may remain disabled until room joins   | `data-realtime-status=connecting` and localized EN/RU text          |
| Connected controller            | Existing status caption and toolbar                                                     | Localized connected text plus configured local and remote labels | Move/stop enabled for local ship only; camera controls enabled            | Two controller contexts show one local and at least one remote ship |
| Connected read-only observer    | Existing status caption and toolbar                                                     | Localized view-only text                                         | Move/stop disabled; camera controls enabled                               | Observer cannot send intents and sees remote ships                  |
| Reconnecting                    | Existing status caption/Alert if current widget already uses Alert for transient issues | Localized reconnecting text                                      | Movement disabled; camera controls stay usable if canvas remains mounted  | No duplicate ship after reconnect                                   |
| Restored                        | Existing status caption                                                                 | Localized restored text, transient if already patterned          | Movement restored for controller                                          | Same local `shipId` privately, same visible `You` label             |
| Disconnected / failed reconnect | Existing status caption/Alert                                                           | Localized disconnected or failed reconnect text                  | Movement disabled; camera controls allowed only if scene remains readable | No raw WebSocket close code or room/session IDs                     |
| Unauthorized                    | Existing status caption/Alert                                                           | Localized access-denied text                                     | Movement disabled                                                         | No raw 401/403 payload, no stack/protocol details                   |
| Room full / spawn unavailable   | Existing status caption/Alert                                                           | Localized room unavailable text                                  | Movement disabled                                                         | No raw spawn attempts, room ID, or internal blocker data            |
| Version mismatch / unavailable  | Existing status caption/Alert                                                           | Localized sync unavailable text                                  | Movement disabled                                                         | No raw Colyseus/Zod/module error                                    |

MVP read-only behavior is fixed for implementation: only authenticated members with control permission receive a controllable ship. Public/read-only members join as observers, receive no owned ship, cannot send movement intents, and see the localized view-only state.

## Plan Steps

### Phase 1 — Contract Discovery And Baseline Preservation

-   [ ] Confirm Node 22 in implementation shells before any test/build command.
-   [ ] Re-run focused discovery on `applicationsRealtimeRuntime.ts`, `PlayCanvasCanvasWidget.tsx`, fixture generator, and current MMOOMM E2E flow to capture exact current line-level contracts.
-   [ ] Decide whether to keep room name `fixed_tick_scene` or add a versioned room name. Default: keep `fixed_tick_scene` and migrate state shape because the feature is still MVP and the test DB will be recreated.
-   [ ] Define the compatibility strategy for existing `state.ship` tests: either update all consumers to `state.ships` in one cut or provide a temporary derived `primaryShip` for tests only. Default: update all consumers in one cut.

### Phase 2 — Generic Server Helpers

-   [ ] Add pure generic spawn/blocking helpers in `packages/universo-react-colyseus-server/src/movement.ts`:
    -   `findFreeSpawnPosition(...)`
    -   `isSpawnPositionFree(...)`
    -   body-vs-AABB and body-vs-body clearance checks
    -   optional keyed movement map stepping helper if it stays domain-neutral.
-   [ ] Add Vitest coverage in `packages/universo-react-colyseus-server/src/index.test.ts` for:
    -   default spawn accepted when free;
    -   spawn shifts when occupied by an AABB blocker;
    -   spawn shifts when occupied by another body;
    -   deterministic results for the same blocker set;
    -   fail-closed when no position is available;
    -   movement cannot cross guarded AABB.
-   [ ] Keep helper names generic: no `MMOOMM`, no station-specific names, no game copy.

### Phase 3 — Server Room Multi-Ship State

-   [ ] Refactor `createFixedTickSceneRoom(...)` in `applicationsRealtimeRuntime.ts` from singleton movement to `Map<string, ShipRuntime>` plus `MapSchema<ShipState>`.
-   [ ] Add auth-derived player identity to room options/auth result:
    -   user id for ownership only;
    -   safe display name or generated pilot label;
    -   role/control permission;
    -   workspace/application/scope metadata.
-   [ ] Extend `FixedTickSceneRoomOptions` / `onAuth` result to carry private `userId`, `displayName`, and `canControl` metadata into `onJoin`; do not rely on client-supplied options for ownership.
-   [ ] Replace room-level `controllerSessionId` with per-client ownership:
    -   each controlling authenticated user can send intents only for their own ship;
    -   read-only members/public observers join without an owned controllable ship and with `canControl=false`;
    -   no client can select another user's ship as the controlled ship.
-   [ ] Add `inputQueue` per ship and process inputs only during `setSimulationInterval`.
-   [ ] Store `lastProcessedInputSeq` in authoritative state so the client can drop acknowledged predictions.
-   [ ] Add `onDrop`, `allowReconnection(client, 30)`, `onReconnect`, `onLeave`, and `onDispose`:
    -   dropped ship remains connected=false and server-controlled;
    -   reconnect restores the same ship, not a duplicate;
    -   permanent leave removes or parks the ship according to MVP rules;
    -   timers/listeners are cleaned up.
-   [ ] Keep room metadata scoped by `scopeId` and preserve `.filterBy(['scopeId'])`.
-   [ ] Map server exceptions/statuses to generic matchmake errors; never leak room IDs or stack traces.
-   [ ] Export or otherwise expose enough room factory/test seams for backend tests to instantiate the room lifecycle without depending only on broad integration flow.

### Phase 4 — Auth And Matchmaking Hardening

-   [ ] Extend `authorizeAndBuildRoomOptions(...)` to pass safe identity/display metadata into room options/auth without bypassing current application access checks.
-   [ ] Review the DB executor boundary while touching matchmake/runtime option loading:
    -   use request-scoped `DbExecutor` for authenticated access checks where the request context is available;
    -   use `getPoolExecutor()` only for public/admin/bootstrap-style non-RLS work where that is already the package boundary;
    -   do not import Knex or call `getKnex()` from room/domain logic;
    -   keep SQL schema-qualified, parameterized, and fail-closed.
-   [ ] Keep request-scoped/session auth behavior consistent with current middleware; do not introduce a second login path.
-   [ ] Validate matchmake body shape and size before room creation; preserve `MAX_MATCHMAKE_BODY_BYTES`.
-   [ ] Confirm local Supabase minimal E2E does not require Supabase Realtime/Storage/Edge.
-   [ ] Add Jest tests for unauthorized matchmake, invalid application/workspace, read-only member no-control behavior, and no client-supplied movement authority.
-   [ ] Keep the initial control permission tied to the existing application permission surface: `runtimeAccessMode === 'member'` and `editContent === true` currently controls the canvas. The two-pilot E2E must therefore create the second account as `editor`, `admin`, or an equivalent role with `editContent=true`. Do not use a plain `member` account as the second pilot unless the product contract is deliberately changed.
-   [ ] If implementation introduces a more specific realtime-control permission later, map it through existing application role policy settings and test the migration from `editContent`; do not create a parallel account or permission model for Colyseus.

### Phase 5 — Client Runtime Multi-Ship Rendering

-   [ ] Update `FixedTickSceneState` types in `PlayCanvasCanvasWidget.tsx` to read the MMOOMM room `ships` map while keeping generic widget internals named around local/remote entities, not hardcoded domain terms.
-   [ ] Obtain local ship identity only from trusted join/auth/private room message data, never by guessing from the first item in `state.ships`.
-   [ ] Replace the current manual reconnect-by-`joinOrCreate` path with Colyseus reconnect semantics where available:
    -   store reconnect token/session data supplied by the SDK;
    -   use the SDK reconnect flow for temporary drops;
    -   treat a fallback `joinOrCreate` after failed reconnect as a new session state, not a restored reconnect;
    -   prove restored reconnect does not allocate a new room or duplicate the local ship.
-   [ ] Create/destroy PlayCanvas primitive entities as `state.ships` changes:
    -   local ship uses the existing white primitive shape;
    -   remote ships use the same white primitive geometry;
    -   the existing widget status area shows localized configured local/remote labels so users can tell local and remote ships apart without new art.
-   [ ] Maintain interpolation buffers per remote opaque entity ID.
-   [ ] Maintain local prediction queue keyed by input `seq`; reconcile when authoritative `lastProcessedInputSeq` advances.
-   [ ] Update input sending to include monotonic `seq`.
-   [ ] Ensure stop and move controls are enabled only for the local controllable ship.
-   [ ] Keep the camera following the local ship; remote ships must not steal camera target.
-   [ ] Add dataset probes for E2E that are not user-visible:
    -   local ship position;
    -   remote entity count;
    -   first remote entity position;
    -   authoritative update count;
    -   reconnect status.
-   [ ] Keep all visible statuses localized through `apps.json`.

### Phase 6 — Runtime UX And i18n

-   [ ] Add EN/RU i18n keys/config fields for:
    -   local/remote ship labels;
    -   multiplayer connected state;
    -   reconnecting/restored/failed reconnect;
    -   unauthorized/room full/version mismatch/unavailable;
    -   generic sync unavailable and retry copy if a retry action is added.
-   [ ] Ensure visible labels never expose raw room/session/user/ship IDs.
-   [ ] Keep generic template defaults domain-neutral. MMOOMM-specific words such as `Pilot` belong in the generated fixture/module configuration or app-level i18n metadata, not hardcoded generic widget logic.
-   [ ] Preserve existing MUI toolbar/button primitives; do not add a bespoke shell.
-   [ ] Add component tests that assert no raw technical strings appear for simulated failures (`roomId`, UUID, close code, Zod, WebSocket, stack, `[object Object]`).
-   [ ] Add RU-locale component coverage for reconnect/error/read-only states so raw English/internal validation strings cannot pass on Russian surfaces.

### Phase 7 — Fixture And Snapshot

-   [ ] Keep `metahubs-mmoomm-flight-app-snapshot.json` as the fixture artifact name, but update its generated content when the widget/server module contract changes.
-   [ ] If fixture changes, update `metahubs-mmoomm-flight-app-export.spec.ts` first, regenerate the snapshot through the Playwright generator, and never hand-edit the snapshot.
-   [ ] Preserve the current server-module placement unless implementation deliberately generalizes it:
    -   MMOOMM server runtime module remains `attachedToKind: 'metahub'` and `moduleRole: 'module'`;
    -   client widget module remains resolved from the widget `attachedToKind`, defaulting to `metahub`;
    -   if server module lookup is generalized beyond metahub attachment, add backend tests for each supported attachment kind.
-   [ ] Update the generator's server module source if multi-ship room metadata is needed:
    -   spawn origin;
    -   ship half extents/radius;
    -   spawn safety margin/ring spacing/max attempts;
    -   guarded blocking objects derived from the station object.
-   [ ] Keep only one configured prototype ship Object in the fixture unless implementation proves an entity-model need for per-player Objects. Runtime ship instances belong to Colyseus room state, not separate pre-seeded metahub Objects.
-   [ ] Update `mmoommFlightFixtureContract.ts` to require:
    -   server module still present;
    -   `playcanvasCanvas` widget still bound to client/server modules;
    -   multi-ship-compatible room options where encoded;
    -   no inherited lower detail widgets;
    -   packages preserved.
-   [ ] Update the acceptance matrix text from single-ship "move the ship" wording to multi-ship authoritative sync wording.
-   [ ] Add a root script:

```json
"check:mmoomm-flight-fixture-contract": "pnpm --filter @universo-react/types build && pnpm --filter @universo-react/utils build && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON tools/testing/e2e/support/checkMmoommFlightFixtureContract.ts tools/fixtures/metahubs-mmoomm-flight-app-snapshot.json"
```

-   [ ] Add `tools/testing/e2e/support/checkMmoommFlightFixtureContract.ts` as the script entrypoint if absent, reusing `mmoommFlightFixtureContract.ts` and mirroring the LMS checker CLI behavior.
-   [ ] Run the fixture contract checker after regeneration.

### Phase 8 — Unit, Integration, And Component Tests

-   [ ] `@universo-react/colyseus-server` Vitest:
    -   spawn search;
    -   blocker clearance;
    -   movement guard;
    -   deterministic ring/spiral results.
-   [ ] `@universo-react/colyseus-client` Vitest:
    -   interpolation buffers for keyed remote entities;
    -   local prediction ack handling helpers if added;
    -   intent creator sequence fields.
-   [ ] `@universo-react/playcanvas-engine` Vitest:
    -   only if new generic runtime helpers are added.
-   [ ] `@universo-react/applications-backend` Jest:
    -   parse/auth room options;
    -   multi-ship onJoin state;
    -   per-client control isolation;
    -   invalid intent ignored;
    -   onDrop/onReconnect restores same ship;
    -   onLeave cleanup/final removal;
    -   no transform/update-coordinate message accepted.
-   [ ] `@universo-react/apps-template-mui` Vitest:
    -   renders local and remote realtime entity state;
    -   sends only intent messages;
    -   disables controls for observer/read-only state;
    -   reconnect/unauthorized/room-full/version-mismatch localized states;
    -   protocol leakage guard.

### Phase 9 — Playwright E2E And Browser Evidence

-   [ ] Extend `snapshot-import-mmoomm-flight-runtime.spec.ts` or add a focused sibling flow tagged `@flow @mmoomm-multiplayer`.
-   [ ] Use two authenticated browser contexts:
    -   primary seeded E2E user;
    -   generated second user added as `editor` or another role with `editContent=true` so the current runtime control gate treats it as a second pilot.
-   [ ] Keep the existing read-only observer coverage, but separate it from the two-controller proof.
-   [ ] Do not treat a second page in the same browser context as multi-user proof. Use `createLoggedInBrowserContext(...)` or an equivalent helper for a separate authenticated account.
-   [ ] Keep the read-only observer as a third role/path if useful: plain `member`, no owned controllable ship, movement controls disabled, remote ships visible.
-   [ ] Assert:
    -   both contexts open `/a/{applicationId}` and `Space`;
    -   both canvases are visible, bounded, nonblank, and connected;
    -   each canvas reports one local ship and at least one remote ship;
    -   moving user A changes remote ship position on user B;
    -   moving user B changes remote ship position on user A;
    -   stop works for each local ship;
    -   reconnect restores the same ship and does not duplicate it;
    -   spawn positions are distinct and do not overlap station/ship blockers;
    -   controller keyboard path works: canvas can receive focus, Escape releases pointer capture and sends/stabilizes stop for local ship, and Tab/Shift+Tab can leave the canvas;
    -   observer keyboard/input path works: clicks, double-clicks, Enter, and Escape do not send movement intents while camera controls remain usable;
    -   no page-level horizontal overflow on desktop/tablet/mobile;
    -   no raw IDs/protocol/internal errors are visible.
-   [ ] Use the existing UX oracles where available:
    -   `expectNoTechnicalLeakage`;
    -   `expectNoPageHorizontalOverflow`;
    -   `expectRuntimeUxViewportMatrix`;
    -   canvas/WebGL pixel checks from existing MMOOMM flow;
    -   user-facing locators/roles for visible controls and localized states.
-   [ ] Save screenshots/artifacts through the Playwright runner for desktop/tablet/mobile proof. Screenshots support the proof but do not replace assertions.
-   [ ] Do not use `pnpm dev`; use the E2E wrapper on `127.0.0.1:3100`.

### Phase 10 — Documentation

-   [ ] Update GitBook docs:
    -   `docs/en/guides/mmoomm-flight-simulator.md`
    -   `docs/ru/guides/mmoomm-flight-simulator.md`
    -   `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` only if a new subsection/page is added.
-   [ ] Document:
    -   multi-user runtime behavior;
    -   server-authoritative intent rule;
    -   local vs remote ship display;
    -   reconnect behavior;
    -   local Supabase minimal E2E commands;
    -   limitation: no mining/economy/combat in this slice.
-   [ ] Keep docs user-facing; do not expose internal room IDs or implementation-only terms as normal workflow concepts.

### Phase 11 — Validation Commands

-   [ ] Before E2E, ensure Node 22:

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --silent 22; node -v
```

-   [ ] Focused tests/builds:

```bash
pnpm --filter @universo-react/colyseus-server test
pnpm --filter @universo-react/colyseus-client test
pnpm --filter @universo-react/playcanvas-engine test
pnpm --filter @universo-react/apps-template-mui test
pnpm --filter @universo-react/applications-backend test -- src/tests/realtime/applicationsRealtimeRuntime.test.ts

pnpm --filter @universo-react/colyseus-server build
pnpm --filter @universo-react/colyseus-client build
pnpm --filter @universo-react/playcanvas-engine build
pnpm --filter @universo-react/apps-template-mui build
pnpm --filter @universo-react/applications-backend build
```

-   [ ] Fixture contract:

```bash
pnpm run check:mmoomm-flight-fixture-contract
```

-   [ ] Local Supabase minimal browser proof. `build:e2e:local-supabase` already starts, generates, and doctors the minimal profile, so do not duplicate those setup steps unless debugging the local stack:

```bash
pnpm run build:e2e:local-supabase
cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-mmoomm-flight-runtime.spec.ts
```

-   [ ] Broader closeout:

```bash
pnpm run test:e2e:smoke:local-supabase
pnpm run test:e2e:flows:local-supabase
pnpm build
```

Stop local E2E Supabase after validation if it remains running:

```bash
pnpm supabase:e2e:stop
```

## Potential Challenges

-   **Single-ship schema migration**: current client and tests depend on `state.ship`. Mitigation: update server, client, and tests in one coordinated cut; keep fixture behavior visually stable.
-   **Controller model mismatch**: current room has one controller per room. Mitigation: remove room-level controller ownership and map each controllable client to its own ship.
-   **Reconnect duplication**: naive rejoin creates a new ship. Mitigation: use auth-derived user ownership plus `onDrop`/`allowReconnection`/`onReconnect` and tests that count ships before/after reconnect.
-   **Prediction drift**: client prediction without sequence ack can fight server updates. Mitigation: add `seq` and `lastProcessedInputSeq`, only keep unacknowledged predictions.
-   **Spawn races**: simultaneous joins can choose the same spot. Mitigation: reserve spawn position during join and treat existing disconnected ships as blockers during reconnect window.
-   **UI leakage**: Colyseus and Zod errors often include technical details. Mitigation: map all failures to localized statuses and add leakage tests.
-   **Canvas flake in E2E**: WebGL timing and screenshots can be flaky. Mitigation: use polling on data attributes plus pixel checks, not screenshots alone.
-   **Local Supabase reset risk**: E2E reset is destructive for the selected profile. Mitigation: always generate and doctor `.env.e2e.local-supabase` before running wrapper commands; do not point E2E env at dev/main DB.

## Dependencies

-   Current wrapper versions from `pnpm-workspace.yaml`: `playcanvas@2.18.1`, `@colyseus/core@0.17.43`, `@colyseus/sdk@0.17.42`, `@colyseus/schema@4.0.25`, `@colyseus/ws-transport@0.17.13`.
-   Node.js 22 is required by the repository runtime.
-   Local Supabase minimal stack requires Docker.
-   No new third-party runtime dependency should be added unless implementation proves the existing wrappers cannot cover the need.

## Plan UX Review Gate

The implementation must not proceed past QA unless all of these are satisfied:

-   [ ] UI Contract exists for canvas widget, toolbar/status overlay, loading, reconnecting/restored/failed reconnect, disconnected, unauthorized, room full, version mismatch, and unavailable states.
-   [ ] No user-facing raw room IDs, session IDs, player IDs, user IDs, ship IDs, UUID-only values, raw JSON, `[object Object]`, Zod messages, WebSocket errors, close codes, or stack traces.
-   [ ] All visible text is localized in EN/RU.
-   [ ] Keyboard and pointer release paths are explicitly tested.
-   [ ] Browser evidence proves no page-level horizontal overflow.
-   [ ] Browser evidence proves multi-user local/remote ship sync.
-   [ ] Browser evidence proves canvas nonblank/framed/object-visible state.
-   [ ] Reconnect tests prove reconnecting, restored, and failed reconnect/disconnected states.

## Recommended Approval Boundary

Approve this plan for IMPLEMENT only if the next implementation pass is allowed to change the existing `fixed_tick_scene` state contract from singleton ship to multi-ship map and update the current MMOOMM flight fixture/tests accordingly. Keeping both contracts long-term would add avoidable complexity during an MVP phase where the test DB and snapshots can be regenerated.
