---
name: playcanvas-editor-universo-compat
description: Use when working with the PlayCanvas Editor wrapper boundary inside the Universo platform, security sandboxing (iframes), window.config injection, bridge messages, and metahub storage.
metadata:
    version: '1.0.0'
    scope: 'playcanvas-editor-universo-compat'
    file_policy: 'markdown-only'
---

# PlayCanvas Editor Universo Compatibility

Use this skill when developing or reviewing the wrapper boundary between the hosted Editor artifact and the main Universo React/MUI dashboard application.

## Version Guard

- Governs `@universo-react/playcanvas-editor-frontend` and `@universo-react/playcanvas-editor-backend`.
- Enforces security guidelines for the sandbox iframe environment.

## Required Output

Before changing the bridge or security configurations:
- describe the message format sent across the iframe postMessage bridge;
- state the origin URL and sandbox attributes used on the iframe;
- detail how `window.config` variables are generated and sanitized.

## Workflow

1. The editor is loaded inside an iframe with restricted sandbox attributes (e.g. `allow-scripts`, `allow-same-origin`).
2. Communication between the host and the editor is handled via the bridge contract using the window postMessage API or custom bridge listeners.
3. Configuration parameters (access tokens, endpoints) are parsed by the backend and injected dynamically into the editor context.
4. Scene assets are saved and read through the metahub-scoped storage adapters.

## Blocking Rules

- Do not let the editor iframe access the host page DOM directly.
- Do not bypass Same-Origin verification on received messages. All messages must be origin-checked.
- Do not expose administrative API configurations to the editor runtime.
- Do not bypass token expirations; the bridge must request a fresh token before expiration occurs.
