# Colyseus State And Fixed Tick

## Schema State Design

Colyseus Schema state is the synchronized authoritative state. Design it before
writing message handlers.

Required checks:

-   Keep server and client Schema definitions compatible, including field order.
-   Use the TypeScript decorator settings expected by Colyseus Schema in the
    package where schemas are compiled.
-   Use nested schemas for large state models.
-   Avoid flat schemas that approach the Colyseus Schema serialized-field limit:
    one Schema class can serialize up to 64 fields, so larger models need nested
    Schema classes or collections.
-   Mutate state fields and collections intentionally; do not replace the room
    state root casually after initialization.

Good schema boundaries usually separate:

-   room-level metadata;
-   players;
-   controllable objects;
-   transient simulation state that must be synchronized;
-   server-only state that must not be synchronized.

## Fixed Tick Simulation

Server authority requires deterministic input processing:

1. Client sends input intent.
2. Server queues the input with session/user context.
3. Simulation interval advances one or more fixed ticks.
4. Tick consumes queued inputs and mutates authoritative Schema state.
5. State patches flow to clients.

Do not make browser frame rate the simulation clock.

## Interpolation And Reconciliation

Clients often render faster than state patches arrive. For moving objects:

-   cache the last authoritative state;
-   render toward it with interpolation such as LERP;
-   use prediction only when the UX requires immediate local response;
-   reconcile predicted state with authoritative state without snapping unless
    the correction is too large to hide safely.

## Error And Validation UX

Zod, Colyseus, WebSocket, and internal validation failures must map to localized
user-facing UI states. Do not expose raw parser errors, protocol frames, session
IDs, player IDs, or stack details.

## Sources

-   Colyseus state docs: https://docs.colyseus.io/state
-   Fixed tick tutorial:
    https://github.com/colyseus/docs/blob/master/pages/learn/tutorial/phaser/fixed-tickrate.mdx
-   Interpolation tutorial:
    https://github.com/colyseus/docs/blob/master/pages/learn/tutorial/phaser/linear-interpolation.mdx
