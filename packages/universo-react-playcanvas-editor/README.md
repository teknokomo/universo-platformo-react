# @universo-react/playcanvas-editor

Foundation package for the official PlayCanvas Editor frontend artifact.

This package is intentionally an artifact boundary, not a React/MUI component library. It keeps the upstream `playcanvas/editor` source isolated, builds a static artifact from a pinned upstream tag, and exposes package-local verification commands.

## Upstream

-   Repository: https://github.com/playcanvas/editor
-   Tag: `v2.22.1`
-   Commit: `0fcd44253ba1bba39c13d45b069265167249ecb6`
-   Package version: `2.22.1`
-   Node requirement: `>=22.22.0`
-   License: MIT, with attribution in `NOTICE.md`

## Commands

```bash
pnpm --filter @universo-react/playcanvas-editor test
pnpm --filter @universo-react/playcanvas-editor editor:build
pnpm --filter @universo-react/playcanvas-editor editor:smoke
pnpm --filter @universo-react/playcanvas-editor editor:browser-smoke
```

The package does not define a normal `build` script in this foundation slice. Root `pnpm build` should not pick up the Editor artifact until Node, pnpm, dependency, Turbo, CI, and guardrail compatibility are intentionally approved.

## Artifact Modes

The default artifact mode is `universo-hosted`.

`universo-hosted` builds the pinned upstream Editor files, writes a minimal Universo shell, injects `window.config`, and loads the bridge bootstrap script. `artifact-only` remains available through `UNIVERSO_PLAYCANVAS_EDITOR_ARTIFACT_MODE=artifact-only` as a fail-closed unavailable page.

The hosted bridge slice supports the first manager-only metahub authoring path: project context, scene list/read/save, bounded JSON scene payloads, and minimal JSON asset metadata. It does not implement PlayCanvas Cloud parity, collaboration, broad binary assets, Colyseus authoring, implicit runtime publication, or MCP/AI tooling.

## Hosted Artifact Security

The real upstream Editor is hosted in an iframe with `allow-scripts allow-same-origin`. That sandbox combination must not point at the same origin as the platform shell. The metahub backend only returns a tokenized artifact URL when it can resolve a separate artifact origin:

-   Local/E2E: automatic loopback sibling origin, for example `127.0.0.1` as the platform origin and `localhost` as the artifact origin.
-   Non-loopback deployments: set `PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN` to an HTTP(S) origin that routes to the same backend artifact endpoint through a different host.

Set `PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN` when the backend receives internal host headers behind a proxy but the browser-facing platform origin is different. Forwarded origin headers are ignored by default; enable `PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS=true` only when the edge proxy overwrites `x-forwarded-host` and `x-forwarded-proto`.

If no separate origin is available, the host descriptor returns `artifactStatus: "misconfigured"` and the MUI host does not mount the iframe.

## Boundary Rules

-   Do not import upstream Editor DOM, PCUI, Observer state, or vendor source into MUI shells.
-   Keep this package authoring-only in the metahub package registry.
-   Do not put an upstream `package.json` under `vendor/playcanvas-editor/`.
-   Keep upstream updates reviewable through `vendor/UPSTREAM.md` and `vendor/package.playcanvas-editor.json`.
