# PlayCanvas Editor Backend

`@universo-react/playcanvas-editor-backend` владеет непользовательской protocol boundary для Universo PlayCanvas Editor compatibility backend.

Пакет не владеет схемами или хранилищем метахаба. Он экспортирует фабрики routes и port interfaces; `@universo-react/metahubs-backend` монтирует routes и передаёт metahub-scoped adapters.

Текущий scope:

-   schema-validated minimal compatibility REST routes;
-   project config descriptor;
-   scene list/read/save loop через metahub PlayCanvas storage;
-   settings document read/write loop через metahub project settings;
-   empty/limited assets shell;
-   explicit typed no-op responses для cloud-only PlayCanvas surfaces.

Вне scope первого package slice:

-   PlayCanvas Cloud parity;
-   ShareDB realtime persistence;
-   messenger WebSocket runtime;
-   multi-user collaboration;
-   broad binary asset pipeline.
