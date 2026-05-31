---
description: PlayCanvas Editor artifact package foundation.
---

# PlayCanvas Editor Package

`@universo-react/playcanvas-editor` is the Platformo foundation package for the official PlayCanvas Editor frontend artifact.

The package vendors a pinned upstream PlayCanvas Editor snapshot and keeps it isolated from the runtime MUI shells. It is not a React component package and it is not registered as a metahub runtime package in this foundation slice.

## Current Scope

-   Workspace package: `packages/universo-react-playcanvas-editor/`
-   Package name: `@universo-react/playcanvas-editor`
-   Upstream repository: `https://github.com/playcanvas/editor`
-   Upstream tag: `v2.22.1`
-   Upstream commit: `0fcd44253ba1bba39c13d45b069265167249ecb6`
-   Upstream package version: `2.22.1`
-   Required Node.js version for Editor build: `>=22.22.0`
-   Smoke mode: `artifact-only`

The package can build and verify a static artifact, but it does not yet provide metahub scene storage, asset upload, collaboration, backend API emulation, iframe bridge, Colyseus authoring, or AI/MCP scene editing.

## Commands

```bash
pnpm --filter @universo-react/playcanvas-editor test
pnpm --filter @universo-react/playcanvas-editor editor:build
pnpm --filter @universo-react/playcanvas-editor editor:smoke
pnpm --filter @universo-react/playcanvas-editor editor:browser-smoke
```

The package intentionally does not define a normal `build` script yet. Root `pnpm build` does not build the Editor artifact until the package is deliberately enrolled in the root Turbo pipeline.

## Boundary Rules

-   Do not import PlayCanvas Editor vendor source, PCUI, or Observer state into normal MUI shells.
-   Do not add this package to metahub package seed data in the foundation slice.
-   Do not store an upstream `package.json` under `vendor/playcanvas-editor/`.
-   Keep upstream updates pinned and reviewed through `vendor/UPSTREAM.md`.

## Future Integration

Later briefs can add a serving route, iframe host, metahub storage adapter, asset pipeline, module external-file integration, Colyseus authoring, and AI/MCP tooling. Those integrations must preserve the artifact boundary unless a new approved plan changes it.
