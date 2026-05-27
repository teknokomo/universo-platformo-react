# Realtime Multiplayer QA Oracles

## WebSocket And Room Connection

For realtime browser tests, prove:

-   the client attempts a WebSocket/room connection when expected;
-   connected state is visible and user-facing;
-   errors are localized and do not leak raw protocol data;
-   leaving the page closes or detaches the room cleanly.

## Multi-Client State Propagation

When a feature claims multiplayer behavior:

-   run at least two browser contexts or users when feasible;
-   perform an action in one context;
-   assert the other context receives the authoritative result;
-   assert the UI displays stable user-facing labels, not raw IDs.

## Reconnect

When reconnection is in scope, prove:

-   reconnecting state appears after a temporary disconnect;
-   restored state appears after successful reconnect;
-   failure state appears when reconnect cannot complete;
-   no room ID, session ID, player ID, raw close code, or protocol stack is
    shown to normal users.

## Server Authority

QA should look for evidence that the server owns authoritative state:

-   client sends intents rather than final world state;
-   server state propagation determines remote view;
-   impossible or unauthorized client actions fail closed.

## Related Playwright References

-   `.agents/skills/playwright-best-practices/browser-apis/websockets.md`
-   `.agents/skills/playwright-best-practices/advanced/multi-user.md`
-   `.agents/skills/playwright-best-practices/references/universo-e2e.md`
