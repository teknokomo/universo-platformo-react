# PlayCanvas Editor Backend

`@universo-react/playcanvas-editor-backend` owns the non-user-facing protocol boundary for the Universo PlayCanvas Editor compatibility backend.

The package does not own metahub schemas or storage. It exports route factories and port interfaces; `@universo-react/metahubs-backend` mounts the routes and injects metahub-scoped adapters.

## Package Architecture

Following Phase 1 decomposition, the monolithic `index.ts` has been split into dedicated modules:

-   `src/config/`: Configuration parameters and environment variables.
-   `src/middleware/`: Express middleware, including token authentication.
-   `src/tokens/`: Types, local interfaces (e.g. `PlayCanvasEditorCompatibilityProjectPort`), and token helpers.
-   `src/routes/`: Route factory logic for scenes, settings, assets, etc.
-   `src/realtime/`: Realtime ShareDB interfaces, socket wrappers, and WebSocket upgrade helpers.
-   `src/index.ts`: Barrel exporter that maintains full backwards compatibility with consuming packages.

## Current Scope

-   schema-validated minimal compatibility REST routes;
-   project config descriptor;
-   short-lived signed-header compatibility token validation through `X-PlayCanvas-Editor-Token`;
-   scene list/read/save loop backed by metahub PlayCanvas storage;
-   settings document read/write loop backed by metahub project settings;
-   Editor asset summaries with deterministic folder paths, multipart creation for bounded text-like files, raw file reads with MIME/ETag, folder-prefix deletion, and fail-closed unsupported re-upload responses;
-   realtime asset-control frames for deletion and script-attribute parsing, with ShareDB document persistence and messenger completion events;
-   explicit typed no-op responses for cloud-only PlayCanvas surfaces.
-   `universo-full-upstream-ui` config for the upstream Editor shell;
-   same-origin WebSocket upgrade endpoints for realtime, messenger, and relay;
-   ShareDB-compatible single-user snapshot persistence through an injected document port.

The WebSocket runtime authenticates with the same short-lived signed compatibility token. Realtime and messenger authenticate with the first protocol message; relay also authenticates with a first `authenticate` message and does not put bearer tokens in the WebSocket URL. The metahub adapter mounts this runtime as a trusted Tier 2 service after signed-token validation and `manageMetahub` access checks, then persists through the metahub PlayCanvas project service.

The current ShareDB boundary is snapshot-port persistence for the first full-boot slice. It seeds upstream-shaped `scenes`, `assets`, `settings`, and per-scene/per-user `user_data` documents, validates snapshots before storage, and carries checksum/revision guards into storage writes. It is not yet a durable ShareDB op-store or a multi-user collaboration service.

The snapshot-port runtime is deliberately single-process. Startup fails closed
when `NODE_UNIQUE_ID` is present or `PLAYCANVAS_EDITOR_REALTIME_WORKER_COUNT`
is greater than one; deploy a shared durable ShareDB backend and remove this
guard before using clustered workers. Durable storage is checked before realtime
reads and updated after accepted writes, while the in-process OT backend is
evicted after its last authenticated socket closes.

The asset surface accepts `folder`, `script`, `json`, `css`, `html`, `text`, and
`shader` files within the project asset namespace. Metadata-only rows can
represent material, texture, model, audio, and other Editor types, but this
package does not convert or upload arbitrary binaries. Asset writes are scoped
by the full-boot token and bounded by the project file-size and multipart field
limits. The create route intentionally returns the upstream `{id}` response;
unsupported writes return typed JSON instead of an HTML fallback.

## Development and Testing

To run unit tests:

```bash
pnpm --filter @universo-react/playcanvas-editor-backend test
```

To build the package:

```bash
pnpm --filter @universo-react/playcanvas-editor-backend build
```

Out of scope for this package slice:

-   PlayCanvas Cloud parity;
-   multi-user collaboration;
-   durable ShareDB operation history;
-   binary model, audio, and texture conversion or broad binary asset upload.
