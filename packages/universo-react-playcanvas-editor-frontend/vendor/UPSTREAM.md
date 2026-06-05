# Upstream PlayCanvas Editor

-   Repository: https://github.com/playcanvas/editor
-   Tag: `v2.23.4`
-   Commit: `c4916f4973963341984499f2d919f8bfd38e417c`
-   Upstream package: `@playcanvas/editor`
-   Upstream package version: `2.23.4`
-   Upstream Node requirement: `>=22.22.0`
-   Snapshot date: 2026-06-05
-   License: MIT
-   Copyright: `Copyright (c) 2011-2026 PlayCanvas Ltd.`

## Local Boundary

The upstream source is kept under `vendor/playcanvas-editor/` as an isolated artifact source tree. The upstream manifest is stored as `vendor/package.playcanvas-editor.json` instead of `package.json` so the Universo workspace and recursive package checks do not treat it as a workspace package or active package manifest.

The default local artifact mode is `universo-hosted`. It builds the pinned upstream Editor frontend, serves it from the Universo package boundary, injects the bounded Universo bridge bootstrap, and persists the current bridge-minimal scene payload through metahub PlayCanvas project storage. The `artifact-only` mode remains as an explicit fail-closed placeholder for diagnostics.

This boundary still does not claim PlayCanvas Cloud parity: PlayCanvas-shaped REST, durable ShareDB realtime, messenger, broad asset upload, collaboration, and full upstream backend API emulation remain outside the current bridge-minimal slice.

## Local Changes

-   Upstream `package.json` is not present inside `vendor/playcanvas-editor/`; it is copied to `vendor/package.playcanvas-editor.json`.
-   Upstream `package-lock.json`, `test/`, `test-suite/`, `.github/`, Docker files, and Renovate configuration are not vendored because this package owns dependency resolution, CI, and tests through the Universo monorepo.
-   Build scripts copy the vendored source into an external temporary directory before running Vite, so generated manifests are not visible to recursive repository checks under `packages/**`.
