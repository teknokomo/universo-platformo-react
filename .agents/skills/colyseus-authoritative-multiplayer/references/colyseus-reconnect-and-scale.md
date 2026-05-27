# Colyseus Reconnect And Scale

## Reconnection

Use reconnection for temporary network loss when the room can safely keep a
player seat:

1. In `onDrop`, mark the player disconnected and call `allowReconnection`.
2. Keep the authoritative player state in the room while reconnection is
   allowed.
3. In `onReconnect`, mark the player connected and resume normal updates.
4. In `onLeave`, remove or finalize state when reconnection fails or the leave
   is permanent.

User-facing states should include connecting, connected, reconnecting,
disconnected, failed to reconnect, unauthorized, room full, and version
mismatch where applicable.

## MVP Scaling Notes

-   A room belongs to one process.
-   Horizontal scale means more processes and more rooms, not splitting one
    active room across processes.
-   Multi-process discovery and coordination require shared presence/driver
    infrastructure such as Redis-backed presence and driver.
-   Do not make Redis mandatory for local MVP development unless the deployment
    topology requires it.

## Sources

-   Colyseus reconnection docs:
    https://github.com/colyseus/docs/blob/master/pages/room/reconnection.mdx
-   Colyseus scalability docs:
    https://github.com/colyseus/docs/blob/master/pages/scalability.mdx
