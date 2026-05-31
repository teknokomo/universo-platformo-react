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

## Smoke Mode

The current smoke mode is `artifact-only`.

The generated `dist/editor/index.html` is a safe unavailable page that explains the artifact is built but not connected to a PlayCanvas-hosted or Universo-backed Editor session. This is deliberate. This slice does not implement metahub scene persistence, asset upload, collaboration, backend API emulation, iframe bridge, Colyseus authoring, or MCP/AI tooling.

## Boundary Rules

-   Do not import upstream Editor DOM, PCUI, Observer state, or vendor source into MUI shells.
-   Do not add this package to the metahub package seed list in the foundation slice.
-   Do not put an upstream `package.json` under `vendor/playcanvas-editor/`.
-   Keep upstream updates reviewable through `vendor/UPSTREAM.md` and `vendor/package.playcanvas-editor.json`.
