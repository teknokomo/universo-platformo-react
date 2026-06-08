---
name: playcanvas-editor-authoring
description: Use when planning, implementing, or reviewing work that touches PlayCanvas Editor authoring, the Editor/Engine boundary, vendored upstream artifacts, Editor boot contract, or Editor package routing. Applies to @universo-react/playcanvas-editor-frontend vendoring playcanvas/editor v2.23.4 with playcanvas@2.19.5; does NOT cover playcanvas-engine-runtime (playcanvas@2.18.1) or PlayCanvas Cloud parity.
metadata:
    version: '1.0.0'
    scope: 'playcanvas-editor-authoring'
    file_policy: 'markdown-only'
---

# PlayCanvas Editor Authoring

Use this skill when dealing with the PlayCanvas Editor integration, package boundaries, upstream vendoring, and editor execution routing.

## Version Guard

- Upstream Editor: `v2.23.4` (vendored at `packages/universo-react-playcanvas-editor-frontend/vendor/`)
- Editor Engine: `playcanvas@2.19.5` (dependency of upstream editor)
- Runtime Engine: `playcanvas@2.18.1` (separate, via `@universo-react/playcanvas-engine`)
- Node requirement: `>=22.22.0` (as defined in `package.playcanvas-editor.json`)
- Do NOT mix Editor and Engine Skills. They are separate version-guarded stacks.

## Required Output

Before modifying any editor authoring or package layout, state:
- which package boundaries are affected (frontend, backend, or types);
- the boot lifecycle phase affected (iframe mounting, config injection, websocket handshake);
- how upstream dependencies (e.g. `sharedb`, `ot-text`, `pcui`) are impacted;
- the testing plan to prevent regression in the E2E boot sequence.

## Workflow

1. Keep the editor frontend completely isolated as an upstream vendored artifact.
2. Inject configuration at boot via `window.config` in the iframe shell.
3. Keep database/backend routing separated from the frontend. The backend only handles protocol translation via injected ports.
4. Run ESLint/Prettier on all package-local files before validation.

## Blocking Rules

- Do not import upstream Editor internals into MUI host code.
- Do not assume PlayCanvas Cloud REST/WS parity.
- Do not claim multi-user realtime collaboration is implemented.
- Do not expose authoring storage paths in runtime manifests.
- Do not let the artifact iframe access host page DOM.
- Do not issue compatibility tokens without origin binding.
