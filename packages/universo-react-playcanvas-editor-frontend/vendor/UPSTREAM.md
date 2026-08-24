# Upstream PlayCanvas Editor

-   Repository: https://github.com/playcanvas/editor
-   Tag: `v2.30.4`
-   Tag object: `5322373fd18c03177fc07c433b77eb5bce04835c` (annotated)
-   Commit (peeled): `cf296bcb669bdcb168778bf2979160a9fe8f67de`
-   Tree: `fd88bd1fd602b683a3a349da4b8c0c59f5d99e9d`
-   Upstream package: `@playcanvas/editor`
-   Upstream package version: `2.30.4`
-   Upstream Node requirement: `>=22.22.0`
-   Embedded engine dependency: `playcanvas 2.21.3` (upstream devDependency)
-   Snapshot date: 2026-08-22
-   Provenance inventory: `vendor/upstream-inventory.json` (sha256 per file, generated from `git archive v2.30.4` minus the omit lists in `tools/playcanvas-editor-omit-paths.mjs`)
-   License: MIT
-   Copyright: `Copyright (c) 2011-2026 PlayCanvas Ltd.`

## Local Boundary

The upstream source is kept under `vendor/playcanvas-editor/` as an isolated artifact source tree. The upstream manifest is stored as `vendor/package.playcanvas-editor.json` instead of `package.json` so the Universo workspace and recursive package checks do not treat it as a workspace package or active package manifest.

The default local artifact mode is `universo-full-upstream-ui`. It builds the pinned upstream Editor frontend, serves it from the Universo package boundary, injects full-boot `window.config`, and uses the metahub PlayCanvas Editor compatibility backend for the boot-critical REST and WebSocket surfaces. The `universo-hosted` mode remains available for the older hosted bridge shell, and `artifact-only` remains as an explicit fail-closed placeholder for diagnostics.

This boundary still does not claim PlayCanvas Cloud parity: PlayCanvas-shaped REST, durable ShareDB realtime, messenger, broad asset upload, collaboration, and full upstream backend API emulation remain outside the current bridge-minimal slice.

## Local Changes

-   Upstream `package.json` is not present inside `vendor/playcanvas-editor/`; it is copied to `vendor/package.playcanvas-editor.json`.
-   Upstream `package-lock.json`, `test/`, `test-suite/`, `.github/`, Docker files, Renovate configuration, and the symlink-only `.env.template` are not vendored because this package owns dependency resolution, CI, and tests through the Universo monorepo.
-   Build scripts copy the vendored source into an external temporary directory before running Vite, so generated manifests are not visible to recursive repository checks under `packages/**`.

## Update from v2.24.2 → v2.30.4 (2026-08-22)

Atomic snapshot import verified against immutable GitHub evidence: annotated tag object `5322373f…`, peeled commit `cf296bcb…`, tree `fd88bd1f…`. The complete file inventory (928 files after omit lists) is hash-pinned in `vendor/upstream-inventory.json`; drift verification compares the vendored tree against this committed inventory instead of requiring a sibling upstream checkout.

Key upstream movements relevant to the Universo compatibility contract:

-   Since v2.30.3 the editor consumes a versioned schema catalog (`{ version: 1, documents, assetData }`) from `window.config.schema`; the legacy `{ asset, scene, settings }` `$type/$default/$scope/$of` tree is no longer accepted at boot.
-   The embedded engine devDependency moved to `playcanvas 2.21.3`; browser font generation dependencies (`@playcanvas/font-tools 0.1.2`, `@playcanvas/msdfgen-wasm 0.1.0`) appeared and remain OUT of scope (font import stays hidden/fail-closed).
-   Code Editor (`src/code-editor/`) and Launch (`src/launch/`) bundles are built by the upstream Vite config; both remain product-nonfunctional locally and stay behind typed unavailable states until their contracts pass.
-   MCP loopback resolution changed from `localhost` to `127.0.0.1` upstream; MCP support remains entirely out of scope with no CSP widening.

## Update from v2.23.4 → v2.24.2 (2026-06-15)

The v2.24.2 update is dominated by a version-control picker rewrite upstream:

-   11 per-widget files in `src/editor/pickers/version-control/` (e.g. `picker-version-control-checkpoints.ts`, `picker-version-control-side-panel.ts`) were collapsed into a single orchestrator `picker-version-control.ts` plus 9 new modules (`branch-switcher.ts`, `dialogs.ts`, `panel-changes.ts`, `panel-detail.ts`, `panel-history.ts`, `picker-version-control-diff.ts`, `vc-helpers.ts`, `vc-diff-data.ts`, `vc-diff-fields.ts`).
-   The `picker-builds-publish.ts` was rewritten ground-up (`+1630/-416`) with a new `{ reload?: boolean }` argument shape and modern card layout.
-   `picker-conflict-manager.ts` now hard-depends on the new `picker:versioncontrol:hasRetainedDiff` editor method.
-   `picker-project.ts` exposes new `picker:project:suspend` / `:resume` methods.
-   Two new SCSS files were added: `sass/editor/_editor-version-control-picker.scss` (1414 lines) and `sass/editor/_editor-version-control-diff.scss` (412 lines). `sass/editor/_editor-main.scss` was rewritten (`+1952/-1381`) — the pre-existing local SASS drift in that file was naturally absorbed by the upstream rewrite.
-   `src/editor-api/models.ts` adds two new types: `BuildJobFormat` (union of `'playcanvas' | 'static' | 'npm' | 'web_lens'`) and `BuildJob`. These are additive and not yet represented in `@universo-react/types`; the new picker calls reach REST endpoints that the Universo compatibility backend already returns as `cloud-only` no-op descriptors, so no new routes are required.
-   `src/editor/viewport/gizmo/gizmo.ts` adds a single `editor.call('viewport:render')` after `gizmo:type` state change.
-   Upstream package version `2.24.2`, dependency tree identical to v2.23.4 (all other devDependencies unchanged).

The local Universo compatibility contract (`protocol.describe`, `scene.list`, `scene.read`, `scene.save`, etc.) operates at a different layer than the picker widgets and is unaffected by the upstream rewrite. The single-user, branch-equivalent, no-ShareDB-history, cloud-only-no-op semantics from `protocol.describe` stay valid for the new picker without any change to `playCanvasProjectsService` or the schema in `playcanvasEditorCompatibility.ts`.
