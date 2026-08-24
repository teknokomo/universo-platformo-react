---
description: Server-authoritative realtime multiplayer in published applications - Colyseus dependency set, reconnection contract, presence pinning, and integration coverage.
---

# Multiplayer Realtime

Published applications get realtime multiplayer by attaching two metahub packages: `@universo-react/colyseus-server` (server runtime) and `@universo-react/colyseus-client` (browser SDK). The production room used by application widgets is `FixedTickSceneRoom`, defined in `packages/universo-react-applications-backend/src/realtime/applicationsRealtimeRuntime.ts`. The server owns ship state, assigns one stable ship per user, validates movement intents, and streams fixed-tick patches to every connected client.

## Dependency Versions

| Upstream library         | Version | Consumed through                  |
| ------------------------ | ------- | --------------------------------- |
| `@colyseus/core`         | 0.17.50 | `@universo-react/colyseus-server` |
| `@colyseus/sdk`          | 0.17.43 | `@universo-react/colyseus-client` |
| `@colyseus/schema`       | 4.0.31  | core dependency set               |
| `@colyseus/ws-transport` | 0.17.13 | core dependency set               |

Both wrappers keep thin entry points (`export * from '@colyseus/core'` / `export * from '@colyseus/sdk'`) so upstream upgrades stay confined to the workspace catalog and wrapper builds.

## Reconnection Contract

Short network drops must not duplicate ships or leak participants. The contract below is implemented in the production room; the reconnection window stays `RECONNECT_WINDOW_SECONDS = 30`.

-   On an unconsented disconnect the room reserves the controller seat: the ship is marked `connected = false`, and the reservation expires after the reconnection window.
-   Seat restoration goes through an awaited `allowReconnection(client, RECONNECT_WINDOW_SECONDS)` call inside the preserved reservation logic; a restored client keeps its session id and ship.
-   Cleanup is exactly-once: `removeClientShip` is idempotent by design (delete-before-check), so the core `onLeave` callback after a failed reservation and the local catch path converge without duplicate removals or leaked ships.
-   Phantom-seat guard: when a drop lands on a session whose ship mapping is already removed, no seat is reserved; cleanup runs immediately so the room can still dispose normally after the last client leaves.
-   Window expiry fails closed: on the first retry inside the window, `onReconnect` revalidates runtime access, and a revoked grant closes the reserved seat and terminates that client with exactly one leave event.

## Presence Pinning

At attach time the runtime constructs the Colyseus `Server` with an explicit `new LocalPresence()` and rejects the `COLYSEUS_CLOUD` environment variable with an error. Single-process presence therefore stays deterministic instead of depending on ambient transport defaults or cloud matchmaking configuration.

## Integration Coverage

`packages/universo-react-applications-backend/src/tests/realtime/realServerReconnect.integration.test.ts` boots the real Colyseus stack (core `Server`, WebSocket transport, production room) on a loopback HTTP server and drives it with real SDK clients through five scenarios:

1. Seat restore after abrupt socket loss without emitting a leave event.
2. Continued patch streaming to surviving partners while a peer reconnects.
3. Fail-closed revoked seat terminating with exactly one leave event.
4. Immediate ship removal on consented leave.
5. Normal room disposal after dropping a client whose ship mapping was already removed.

Run it with `pnpm --filter @universo-react/applications-backend test -- realServerReconnect`.

## Related Documentation

-   [PlayCanvas Editor v2.30.4 Compatibility Matrix](playcanvas-editor-compatibility-v2-30-4.md)
-   [PlayCanvas Engine Ledger 2.18.1 to 2.21.4](playcanvas-engine-ledger-2-18-1-to-2-21-4.md)
-   [MMOOMM Flight Simulator](../guides/mmoomm-flight-simulator.md)
