# Upstream PlayCanvas Editor

-   Repository: https://github.com/playcanvas/editor
-   Tag: `v2.22.1`
-   Commit: `0fcd44253ba1bba39c13d45b069265167249ecb6`
-   Upstream package: `@playcanvas/editor`
-   Upstream package version: `2.22.1`
-   Upstream Node requirement: `>=22.22.0`
-   Snapshot date: 2026-05-31
-   License: MIT
-   Copyright: `Copyright (c) 2011-2026 PlayCanvas Ltd.`

## Local Boundary

The upstream source is kept under `vendor/playcanvas-editor/` as an isolated artifact source tree. The upstream manifest is stored as `vendor/package.playcanvas-editor.json` instead of `package.json` so the Universo workspace and recursive package checks do not treat it as a workspace package or active package manifest.

The first foundation slice uses artifact-only smoke mode. It proves that the pinned Editor frontend can be built from the Universo package boundary and that the resulting artifact can be served as static files. It does not prove PlayCanvas-hosted project persistence, asset upload, collaboration, backend API emulation, or metahub storage.

## Local Changes

-   Upstream `package.json` is not present inside `vendor/playcanvas-editor/`; it is copied to `vendor/package.playcanvas-editor.json`.
-   Upstream `package-lock.json`, `test/`, `test-suite/`, `.github/`, Docker files, and Renovate configuration are not vendored because this package owns dependency resolution, CI, and tests through the Universo monorepo.
-   Build scripts copy the vendored source into an external temporary directory before running Vite, so generated manifests are not visible to recursive repository checks under `packages/**`.
