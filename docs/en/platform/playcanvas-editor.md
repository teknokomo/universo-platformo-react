---
description: PlayCanvas Editor artifact package foundation.
---

# PlayCanvas Editor Package

`@universo-react/playcanvas-editor-frontend` is the Platformo foundation package for the official PlayCanvas Editor frontend artifact.

The package vendors a pinned upstream PlayCanvas Editor snapshot and keeps it isolated from the runtime MUI shells. It is not a React component package and it is registered as an authoring-only metahub package with no runtime targets.

## Current Scope

-   Workspace package: `packages/universo-react-playcanvas-editor-frontend/`
-   Package name: `@universo-react/playcanvas-editor-frontend`
-   Upstream repository: `https://github.com/playcanvas/editor`
-   Upstream tag: `v2.22.1`
-   Upstream commit: `0fcd44253ba1bba39c13d45b069265167249ecb6`
-   Upstream package version: `2.22.1`
-   Required Node.js version for Editor build: `>=22.22.0`
-   Default artifact mode: `universo-hosted`
-   Fallback artifact mode: `artifact-only`

The package can build and verify a static artifact. Metahubs can connect it from **Resources → Packages**, configure how the editor opens, and load the static artifact through the authenticated metahub package route. The first Universo-hosted bridge slice adds a typed iframe bridge and manager-only storage adapter for the selected/default PlayCanvas project: load project context, list/read scenes, save a bounded JSON scene payload, list minimal JSON asset metadata, and reopen the saved scene.

This is not PlayCanvas Cloud parity. Collaboration, PlayCanvas account proxying, broad binary asset pipelines, Colyseus authoring, AI/MCP scene editing, and implicit runtime publication remain out of scope.

The platform now has a first PlayCanvas project storage model for metahubs. See [PlayCanvas Projects](playcanvas-projects.md) for project metadata tables, file namespace rules, snapshot behavior, and runtime manifest sync.

## Commands

```bash
pnpm --filter @universo-react/playcanvas-editor-frontend test
pnpm --filter @universo-react/playcanvas-editor-frontend editor:build
pnpm --filter @universo-react/playcanvas-editor-frontend editor:smoke
pnpm --filter @universo-react/playcanvas-editor-frontend editor:browser-smoke
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

Embedded and open-separately modes both use the authenticated metahub host page. Open separately opens a second host page in a new tab, and that page still loads the artifact through the iframe instead of exposing the raw artifact URL as the top-level document. The real upstream Editor needs `sandbox="allow-scripts allow-same-origin"` so its scripts, workers, and local browser APIs behave like a normal app; because that sandbox combination is only safe when the iframe document is on a different origin than the platform shell, the authenticated host descriptor only returns a tokenized artifact URL when an isolated artifact origin is available.

For local and E2E runs, the backend automatically uses a loopback sibling origin (`127.0.0.1` vs `localhost`) when the request origin is loopback. For non-loopback deployments, configure `PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN` to an HTTP(S) origin that reaches the same backend artifact route through a different host than the platform UI. Configure `PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN` when a proxy forwards traffic to the backend with internal host headers; `x-forwarded-host` and `x-forwarded-proto` are ignored unless `PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS=true` is set for a trusted edge proxy. The PlayCanvas Editor host page CSP adds that artifact origin to `frame-src`/`child-src`; if no separate origin can be resolved, the descriptor returns `artifactStatus: "misconfigured"` and no `artifactUrl`.

Every tokenized artifact request is revalidated against the issuing user's current `manageMetahub` access and the current package attachment display mode before a file is served. Tokenized artifact responses send `Referrer-Policy: no-referrer`, a route-specific CSP with `frame-ancestors 'self' <parentOrigin>`, short cache TTL for non-HTML assets, and fail closed when a browser `Origin` header does not match the parent origin embedded in the token. The same-origin authenticated `editor-artifact/*` route is not used as the iframe entrypoint. Development URL mode is shown only when `PLAYCANVAS_EDITOR_DEVELOPMENT_URLS` enables at least one backend-allowlisted origin, and the backend still validates the saved URL before the host can use it.

The accepted `allow-same-origin` threat model assumes the artifact origin is dedicated to the Editor artifact, does not share platform cookies, and exposes no credentialed application APIs beyond tokenized artifact files. Bridge sessions are short-lived, scoped to the metahub/package/project/default-scene/user, and are sent to the backend in request bodies, not route parameters or query strings. Session ids and nonces are kept in the artifact bootstrap closure rather than on the public marker object. The sandboxed iframe communicates with the MUI host by typed messages; the MUI host uses the normal authenticated API client for backend bridge commands.

Metahub copy, snapshot export, and snapshot import preserve these package display settings. Treat exported metahub snapshots as owner-managed sensitive artifacts: when Development URL mode is enabled, the snapshot can include the saved development URL so imports can restore the authoring configuration.

## Typed Bridge Contract

The authoring host descriptor includes `playcanvasEditor` when the attached package can open an Universo-hosted bridge session. The MUI host sends typed commands to `POST /metahub/{metahubId}/playcanvas/editor-bridge/commands` with `sessionToken` in the JSON body and a command envelope containing UUID v7 `requestId`, UUID v7 `sessionId`, and the session `nonce`.

The first bridge contract supports `project.loadSelected`, `scene.list`, `scene.read`, `scene.save`, `scene.saveStatus`, `asset.listMinimalForScene`, `bridge.capabilities`, `bridge.close`, and `bridge.dirtyState`. `scene.save` uses replay protection keyed by `requestId` and returns the stored success response for safe duplicate retries. If the saved scene checksum changed, the backend returns `saveConflict` with HTTP 409 and the host shows a localized conflict dialog instead of leaking raw storage details.

The hosted artifact serializes scene data from the Editor-side `entities:list` and `assets:list` APIs. When the upstream Editor bundle does not initialize the entity API in the sandboxed hosted mode, the artifact installs a minimal hosted entity adapter behind the same `editor.call('entities:new')` and `editor.call('entities:list')` methods. This keeps authoring actions visible inside the iframe, marks the bridge dirty through `entities:add`, and still saves through the normal `scene.save` command instead of staging synthetic payloads from the parent page.

## Troubleshooting

Do not copy `sessionToken`, artifact tokens, full tokenized artifact URLs, bridge nonces, request bodies, or exported snapshots into public logs or tickets. Use sanitized request ids, metahub names, package slug, artifact status, HTTP status, and browser console categories instead.

-   **Artifact unavailable**: verify that `pnpm --filter @universo-react/playcanvas-editor-frontend editor:build` and `editor:smoke` pass, then check the package attachment status in **Resources → Packages**. The user-facing host should show `artifactStatus` as a safe state and must not expose filesystem paths or tokenized URLs.
-   **Editor frame cannot load**: check that `PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN` points to a browser-reachable origin different from the platform UI origin. For trusted reverse proxies, set `PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN` or enable `PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS=true` only when the edge proxy strips untrusted forwarded headers.
-   **Permission blocked**: the host and bridge require current `manageMetahub` access. Recheck metahub membership and package attachment state; do not reuse artifact links from another user or an old browser tab.
-   **Save conflict**: reload the latest scene from the conflict dialog and save again. The backend compares scene checksums and intentionally fails closed when another write changed the stored payload.
-   **Development URL mode unavailable**: confirm the desired origin is present in `PLAYCANVAS_EDITOR_DEVELOPMENT_URLS`. The UI hides or rejects development URLs that the backend does not allow.

## Future Integration

Later briefs can expand script asset parsing, generated artifacts, binary asset processing, S3 provider configuration, Colyseus authoring, runtime scene projection, and AI/MCP tooling. Those integrations must preserve the artifact boundary unless a new approved plan changes it.
