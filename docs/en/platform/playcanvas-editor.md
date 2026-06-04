---
description: PlayCanvas Editor artifact package foundation.
---

# PlayCanvas Editor Package

`@universo-react/playcanvas-editor` is the Platformo foundation package for the official PlayCanvas Editor frontend artifact.

The package vendors a pinned upstream PlayCanvas Editor snapshot and keeps it isolated from the runtime MUI shells. It is not a React component package and it is registered as an authoring-only metahub package with no runtime targets.

## Current Scope

-   Workspace package: `packages/universo-react-playcanvas-editor/`
-   Package name: `@universo-react/playcanvas-editor`
-   Upstream repository: `https://github.com/playcanvas/editor`
-   Upstream tag: `v2.22.1`
-   Upstream commit: `0fcd44253ba1bba39c13d45b069265167249ecb6`
-   Upstream package version: `2.22.1`
-   Required Node.js version for Editor build: `>=22.22.0`
-   Smoke mode: `artifact-only`

The package can build and verify a static artifact. Metahubs can connect it from **Resources → Packages**, configure how the editor opens, and load the static artifact through the authenticated metahub package route. It does not yet provide metahub scene storage, asset upload, collaboration, backend API emulation, iframe bridge messaging, Colyseus authoring, or AI/MCP scene editing.

The platform now has a first PlayCanvas project storage model for metahubs. See [PlayCanvas Projects](playcanvas-projects.md) for project metadata tables, file namespace rules, snapshot behavior, and runtime manifest sync.

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
-   Keep this package authoring-only: `source.runtimeTargets` must stay empty unless a later approved runtime brief changes that boundary.
-   Do not include this package in publication runtime snapshots or `_app_packages`.
-   Do not store an upstream `package.json` under `vendor/playcanvas-editor/`.
-   Keep upstream updates pinned and reviewed through `vendor/UPSTREAM.md`.

## Metahub Display Settings

The first integration slice stores per-metahub display settings in `metahubs.rel_metahub_packages.config`:

-   Disabled
-   Embedded iframe
-   Open separately
-   Development URL

Embedded and open-separately modes both use the authenticated metahub host route. Open separately opens a second host page in a new tab, and that page still loads the artifact through the sandboxed iframe instead of exposing the raw artifact URL as the top-level document. The host iframe uses a sandbox without `allow-same-origin`; when the authenticated host descriptor is resolved, the backend issues a short-lived tokenized artifact URL so the sandboxed document can load its static JS/CSS assets without cookie-based same-origin access. Every tokenized artifact request is revalidated against the issuing user's current `manageMetahub` access and the current package attachment display mode before a file is served. Development URL mode is shown only when `PLAYCANVAS_EDITOR_DEVELOPMENT_URLS` enables at least one backend-allowlisted origin, and the backend still validates the saved URL before the host can use it.

Metahub copy, snapshot export, and snapshot import preserve these package display settings. Treat exported metahub snapshots as owner-managed sensitive artifacts: when Development URL mode is enabled, the snapshot can include the saved development URL so imports can restore the authoring configuration.

## Future Integration

Later briefs can add the Editor iframe bridge/storage adapter, asset processing pipeline, S3 provider configuration, Colyseus authoring, and AI/MCP tooling. Those integrations must preserve the artifact boundary unless a new approved plan changes it.
