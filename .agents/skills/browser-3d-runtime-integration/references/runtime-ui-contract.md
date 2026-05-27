# Runtime UI Contract For Browser 3D Surfaces

Use this contract whenever browser 3D/game work touches a user-facing screen,
dialog, table, card, HUD, widget, or canvas surface.

## Contract

-   User goal and primary path.
-   Visible controls, labels, and accessible names.
-   Existing primitive reuse: identify the `apps-template-mui`
    dashboard/widget/dialog/list/DataGrid primitive being reused; if a new
    primitive is proposed, document why existing primitives do not fit.
-   Loading, empty, error, disconnected, reconnecting, unauthorized, room-full,
    and version-mismatch states where relevant.
-   Hidden/system-owned fields and forbidden technical leakage.
-   Display values for table/card/HUD values; no raw UUID-only labels, JSON,
    `[object Object]`, protocol errors, session IDs, room IDs, player IDs, or
    stack details.
-   Long-text behavior: semantic descriptions, room notes, scene notes, spawn
    rules, and debug notes use multiline controls by default when surfaced.
-   Localized validation and error mapping through project i18n patterns.
-   Error mapping: map Zod, Colyseus, WebSocket, auth, room-full, reconnect, and
    version-mismatch failures to localized user-facing messages.
-   Keyboard path and focus ownership, including canvas entry/exit, pointer lock
    escape behavior, dialogs, and text inputs.
-   Responsive proof at `1920x1080`, `768x1024`, and `390x844` unless a future
    feature documents a narrower support boundary.
-   Responsive overflow rule: reject document-level horizontal overflow at the
    viewport matrix; component-internal constrained scroll is allowed only for
    DataGrid/table/canvas panels with explicit bounded containers.
-   Browser evidence requirements, including Playwright UX oracles or
    equivalent assertions for no technical leakage, localized validation, no
    page overflow, viewport matrix, and keyboard path. Screenshots alone are not
    sufficient.

## Anti-Patterns

-   A surface requires a normal user to understand or copy a raw room, player,
    session, record, owner, or package id.
-   A normal surface displays JSON, `[object Object]`, internal field names, or
    raw protocol messages.
-   A canvas or overlay creates page-level horizontal overflow.
-   A dialog or text field cannot be operated because canvas input capture
    remains active.
-   UI errors show raw Zod, Colyseus, WebSocket, or server messages.

## Related Local Skills

-   `.agents/skills/mui-runtime-ux-patterns`
-   `.agents/skills/runtime-ux-qa`
-   `.agents/skills/playwright-best-practices`
