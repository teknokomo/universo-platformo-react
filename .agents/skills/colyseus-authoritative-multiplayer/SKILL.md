---
name: colyseus-authoritative-multiplayer
description: Use when planning, implementing, or QA-reviewing MMOOMM realtime multiplayer with Colyseus rooms, server-authoritative simulation, room authentication, Schema state, fixed tick processing, client interpolation or reconciliation, reconnection, or MVP scaling. Applies to `@universo-react/colyseus-server` wrapping `@colyseus/core@0.17.43` and `@universo-react/colyseus-client` wrapping `@colyseus/sdk@0.17.42`.
metadata:
    version: '1.0.0'
    scope: 'mmoomm-colyseus-authoritative-multiplayer'
    file_policy: 'markdown-only'
---

# Colyseus Authoritative Multiplayer

Use this skill for server-authoritative MMOOMM multiplayer work using the
Universo Colyseus wrappers.

## Version And Package Guards

-   Server room code uses `@universo-react/colyseus-server`, currently wrapping
    `@colyseus/core@0.17.43`.
-   Browser client code uses `@universo-react/colyseus-client`, currently
    wrapping `@colyseus/sdk@0.17.42`.
-   The package registry currently exposes the client wrapper as client-targeted.
    Do not tell agents to import it from server modules unless registry metadata
    and compiler rules are deliberately changed later.
-   Do not assume `colyseus.js` or the full `colyseus` package is available.

## Required Output

For each multiplayer plan or implementation, state:

-   room lifecycle hooks used;
-   authentication and auth payload contract;
-   authoritative state owner and Schema structure;
-   message validation strategy;
-   fixed tick and input queue behavior;
-   client interpolation/prediction/reconciliation behavior;
-   reconnect behavior and user-facing states;
-   scaling assumptions for the MVP.

## Workflow

1. Authenticate with static `onAuth` before `onJoin` when possible.
2. Initialize room state in `onCreate`.
3. Add clients and auth-derived player state in `onJoin`.
4. Accept input intents from clients, not authoritative world state.
5. Validate message shape with project Zod patterns when shape matters.
6. Process queued inputs on a fixed server tick.
7. Mutate Schema state as the authoritative source.
8. Render clients with interpolation and optionally prediction/reconciliation.
9. Use `onDrop`, `allowReconnection`, `onReconnect`, and `onLeave` for
   temporary disconnects and permanent leaves.
10. Clean up timers, external resources, and room-owned state in `onDispose`.

## Blocking Rules

-   Do not trust client coordinates, inventory, physics results, or progression
    as authoritative.
-   Do not use React state as canonical multiplayer state.
-   Do not casually replace the room state root after initialization.
-   Do not design flat oversized schemas that ignore Colyseus Schema limits.
-   Do not skip auth because a room is "just a game".
-   Do not show raw Zod, Colyseus, WebSocket, room, session, or server errors on
    normal user-facing surfaces.
-   Do not require `@colyseus/command` for MVP room logic; keep it optional
    until complexity justifies it and dependencies are approved.

## References

-   Read `references/colyseus-room-lifecycle.md` for room hooks, auth,
    reconnect, and cleanup.
-   Read `references/colyseus-state-and-tick.md` for Schema design, fixed tick,
    input queues, interpolation, and reconciliation.
-   Read `references/colyseus-reconnect-and-scale.md` for reconnection UX and
    MVP scaling notes.
