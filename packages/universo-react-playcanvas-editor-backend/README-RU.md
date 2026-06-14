# PlayCanvas Editor Backend

`@universo-react/playcanvas-editor-backend` владеет непользовательской protocol boundary для Universo PlayCanvas Editor compatibility backend.

Пакет не владеет схемами или хранилищем метахаба. Он экспортирует фабрики routes и port interfaces; `@universo-react/metahubs-backend` монтирует routes и передаёт metahub-scoped adapters.

Текущий scope:

-   schema-validated minimal compatibility REST routes;
-   project config descriptor;
-   short-lived signed-header compatibility token validation через `X-PlayCanvas-Editor-Token`;
-   scene list/read/save loop через metahub PlayCanvas storage;
-   settings document read/write loop через metahub project settings;
-   empty/limited assets shell;
-   explicit typed no-op responses для cloud-only PlayCanvas surfaces.
-   `universo-full-upstream-ui` config для upstream Editor shell;
-   same-origin WebSocket upgrade endpoints для realtime, messenger и relay;
-   ShareDB-compatible single-user snapshot persistence через injected document port.

WebSocket runtime аутентифицируется тем же short-lived signed compatibility token. Realtime и messenger получают токен первым protocol message; relay тоже использует первое сообщение `authenticate` и не кладёт bearer token в WebSocket URL. Metahub adapter монтирует runtime как trusted Tier 2 service после signed-token validation и `manageMetahub` access checks.

Текущая ShareDB boundary — snapshot-port persistence для первого full-boot slice. Она seed-ит upstream-shaped `scenes`, `assets`, `settings` и per-scene/per-user `user_data` documents, валидирует snapshots перед storage и передаёт checksum/revision guards в storage writes. Это ещё не durable ShareDB op-store и не multi-user collaboration service.

Вне scope этого package slice:

-   PlayCanvas Cloud parity;
-   multi-user collaboration;
-   durable ShareDB operation history;
-   broad binary asset pipeline.
