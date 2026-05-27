---
name: browser-game-runtime-qa
description: Use when QA-reviewing implemented browser game, WebGL, PlayCanvas canvas, Colyseus realtime, reconnect, multi-client, or MMOOMM runtime UI surfaces. Checks canvas rendering, movement, responsive layout, no page overflow, keyboard/focus behavior, localized states, no raw IDs/JSON/protocol leakage, and Playwright evidence inside Universo `apps-template-mui`.
metadata:
    version: '1.0.0'
    scope: 'mmoomm-browser-game-runtime-qa'
    file_policy: 'markdown-only'
---

# Browser Game Runtime QA

Use this skill to QA browser 3D/game runtime surfaces from the perspective of a
normal user.

## Required Companion Skills

Use `runtime-ux-qa` with this skill for any implemented user-facing runtime
surface. This skill adds browser game/WebGL/realtime checks; it does not replace
the general Runtime UI UX Quality Gate.

## Verdict Format

Return:

-   `verdict`: pass, pass-with-minor-issues, or fail;
-   `blockers`;
-   `majorIssues`;
-   `minorIssues`;
-   `passedChecks`;
-   `browserEvidence`;
-   `missingEvidence`;
-   `requiredFixes`.

## Required Checks

-   Canvas is present, visible, bounded by its MUI container, and nonblank after
    load.
-   Primary object/camera is framed on desktop, tablet, and mobile.
-   Movement or animation changes over time where the feature claims
    interactivity.
-   No document-level horizontal overflow.
-   HUD and controls do not overlap incoherently.
-   Keyboard focus can enter and leave the canvas area.
-   Pointer lock or pointer capture can be released.
-   Loading, empty, error, reconnecting, disconnected, unauthorized, room-full,
    and version-mismatch states are localized where relevant.
-   Forms, dialogs, and validation states use localized user-facing messages.
-   Semantic long-text fields use multiline controls by default.
-   Optional resource-source fields do not show errors before a source is
    selected.
-   Implemented canvas widgets reuse existing `apps-template-mui` or MUI
    dashboard/widget/dialog/list/table/card primitives, or document a product
    reason for any new primitive.
-   No raw IDs, JSON, `[object Object]`, protocol errors, room IDs, player IDs,
    session IDs, or server stack details are visible.
-   WebSocket/multiplayer assertions prove state propagation when the feature is
    realtime.
-   Reconnect assertions prove reconnecting, restored, and failed reconnect
    states when reconnect is in scope.

## Evidence Rules

-   Use user-facing locators and stable test ids.
-   Use existing Playwright UX helpers when available. When a helper is not
    available, implement equivalent assertions with the same semantics:
    -   `expectNoTechnicalLeakage`;
    -   `expectLocalizedValidation`;
    -   `expectNoPageHorizontalOverflow`;
    -   `expectRuntimeUxViewportMatrix`;
    -   keyboard path checks by role, label, accessible name, or stable test id.
-   Screenshots support the result, but screenshots alone are not sufficient.
-   Do not require Playwright for Markdown-only skill/docs changes.
-   Do not run `pnpm dev`; use the repository Playwright wrapper and port
    `3100` when browser evidence is needed.

## References

-   Read `references/canvas-webgl-oracles.md` for canvas/WebGL checks.
-   Read `references/realtime-multiplayer-oracles.md` for WebSocket,
    multi-client, and reconnect checks.
-   Read `references/qa-evidence-template.md` for a structured QA report.
-   Use `.agents/skills/playwright-best-practices/testing-patterns/canvas-webgl.md`
    for general canvas/WebGL Playwright patterns.
-   Use `.agents/skills/playwright-best-practices/browser-apis/websockets.md`
    for WebSocket test patterns.
-   Use `.agents/skills/playwright-best-practices/advanced/multi-user.md`
    for multi-user scenarios.
-   Use `.agents/skills/playwright-best-practices/references/universo-e2e.md`
    for repository-specific E2E commands.
