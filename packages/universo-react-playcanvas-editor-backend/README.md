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

Out of scope for this first package slice:

-   PlayCanvas Cloud parity;
-   ShareDB realtime persistence;
-   messenger WebSocket runtime;
-   multi-user collaboration;
-   broad binary asset pipeline.
