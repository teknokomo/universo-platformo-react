# Colyseus Room Lifecycle

## Lifecycle Hooks

Use rooms as authoritative game-session boundaries. The relevant Colyseus 0.17
room lifecycle for MMOOMM is:

-   `onAuth`: validate credentials/options before the client joins.
-   `onCreate`: initialize room state, message handlers, and simulation timers.
-   `onJoin`: add the authenticated client to room state.
-   `onDrop`: handle unexpected disconnects and call `allowReconnection` when
    temporary reconnect is allowed.
-   `onReconnect`: restore connection state after a successful reconnect.
-   `onLeave`: remove or finalize player state after a permanent leave.
-   `onDispose`: clean up room-owned resources after the room is destroyed.

## Auth Contract

-   Prefer static `onAuth` when the auth decision does not require a live room
    instance.
-   Return a truthy auth payload to continue, return a falsy value to reject, or
    throw `ServerError` when the client needs a specific rejection code.
-   Treat the auth payload as server-owned context passed into `onJoin`.
-   Map auth failures to localized UI states such as unauthorized,
    session expired, room unavailable, or version mismatch.
-   Do not display tokens, raw room IDs, session IDs, stack traces, or protocol
    errors to normal users.

## Message Handlers

-   Validate client messages before applying them to simulation state.
-   Prefer input intents such as movement direction, action type, or command id.
-   Reject direct authoritative updates such as absolute position, inventory
    value, score, or progression.
-   Keep message names stable and intentional; they become part of the room
    protocol.

## Cleanup

Room cleanup should cover:

-   simulation intervals/timers;
-   delayed reconnection handles if still pending;
-   external service handles owned by the room;
-   transient state that should not leak into a later room.

## Sources

-   Colyseus room docs: https://github.com/colyseus/docs/blob/master/pages/room.mdx
-   Colyseus room auth docs:
    https://github.com/colyseus/docs/blob/master/pages/auth/room.mdx
-   Colyseus reconnection docs:
    https://github.com/colyseus/docs/blob/master/pages/room/reconnection.mdx
