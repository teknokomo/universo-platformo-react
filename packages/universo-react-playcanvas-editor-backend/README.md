# PlayCanvas Editor Backend

`@universo-react/playcanvas-editor-backend` owns the non-user-facing protocol boundary for the Universo PlayCanvas Editor compatibility backend.

The package does not own metahub schemas or storage. It exports route factories and port interfaces; `@universo-react/metahubs-backend` mounts the routes and injects metahub-scoped adapters.

Current scope:

-   schema-validated minimal compatibility REST routes;
-   project config descriptor;
-   short-lived signed-header compatibility token validation through `X-PlayCanvas-Editor-Token`;
-   scene list/read/save loop backed by metahub PlayCanvas storage;
-   settings document read/write loop backed by metahub project settings;
-   empty/limited assets shell;
-   explicit typed no-op responses for cloud-only PlayCanvas surfaces.
-   `universo-full-upstream-ui` config for the upstream Editor shell;
-   same-origin WebSocket upgrade endpoints for realtime, messenger, and relay;
-   ShareDB-compatible single-user snapshot persistence through an injected document port.

The WebSocket runtime authenticates with the same short-lived signed compatibility token. Realtime and messenger authenticate with the first protocol message; relay also authenticates with a first `authenticate` message and does not put bearer tokens in the WebSocket URL. The metahub adapter mounts this runtime as a trusted Tier 2 service after signed-token validation and `manageMetahub` access checks, then persists through the metahub PlayCanvas project service.

The current ShareDB boundary is snapshot-port persistence for the first full-boot slice. It seeds upstream-shaped `scenes`, `assets`, and `settings` documents, validates scene/settings snapshots before storage, and carries checksum/revision guards into storage writes. It is not yet a durable ShareDB op-store or a multi-user collaboration service.

Out of scope for this package slice:

-   PlayCanvas Cloud parity;
-   multi-user collaboration;
-   durable ShareDB operation history;
-   broad binary asset pipeline.
