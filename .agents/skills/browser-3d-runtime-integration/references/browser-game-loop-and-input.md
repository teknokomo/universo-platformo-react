# Browser Game Loop And Input

## Game Loop Ownership

-   Let PlayCanvas own frame updates for scene transforms and rendering.
-   Keep React renders event-driven and low-frequency.
-   Do not put per-frame positions, rotations, or animation state into React
    component state.
-   Bridge only summarized state to MUI: connection status, selected object,
    mode, warnings, and current user action.

## Input Ownership

Define how each input type behaves:

-   keyboard movement/action inputs;
-   pointer drag/click inputs;
-   pointer lock entry and exit;
-   Escape behavior;
-   dialog focus and text input focus;
-   touch/mobile gestures if supported.

Canvas input must not trap users. Users need a visible and keyboard-accessible
way to leave or suspend canvas control, and dialogs/text fields must retain
normal focus behavior.

## Visibility And Cleanup

Handle:

-   route leave/unmount;
-   browser tab visibility changes;
-   network disconnect/reconnect;
-   resize observer disconnect;
-   event listener removal;
-   room leave/disconnect;
-   PlayCanvas app destroy.

## Browser Evidence

Implemented runtime surfaces need proof that:

-   the canvas renders nonblank;
-   the scene is framed;
-   input works without trapping focus;
-   controls do not overlap incoherently;
-   document-level horizontal overflow is absent;
-   reconnect/disconnect states are visible and localized where relevant.

Use `browser-game-runtime-qa` for the detailed QA checklist.
