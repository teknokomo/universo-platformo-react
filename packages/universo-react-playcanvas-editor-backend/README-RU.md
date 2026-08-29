# PlayCanvas Editor Backend

`@universo-react/playcanvas-editor-backend` владеет непользовательской protocol boundary для Universo PlayCanvas Editor compatibility backend.

Пакет не владеет схемами или хранилищем метахаба. Он экспортирует фабрики routes и port interfaces; `@universo-react/metahubs-backend` монтирует routes и передаёт metahub-scoped adapters.

Текущий scope:

-   schema-validated minimal compatibility REST routes;
-   project config descriptor;
-   short-lived signed-header compatibility token validation через `X-PlayCanvas-Editor-Token`;
-   scene list/read/save loop через metahub PlayCanvas storage;
-   settings document read/write loop через metahub project settings;
-   summaries ассетов Editor с детерминированными путями папок, multipart-создание небольших текстовых файлов, чтение исходных файлов с MIME/ETag, удаление по префиксу папки и fail-closed ответы для неподдерживаемой перезаписи;
-   realtime-фреймы управления ассетами для удаления и разбора атрибутов скриптов с сохранением ShareDB-документов и messenger-событиями завершения;
-   explicit typed no-op responses для cloud-only PlayCanvas surfaces.
-   `universo-full-upstream-ui` config для upstream Editor shell;
-   same-origin WebSocket upgrade endpoints для realtime, messenger и relay;
-   ShareDB-compatible single-user snapshot persistence через injected document port.

WebSocket runtime аутентифицируется тем же short-lived signed compatibility token. Realtime и messenger получают токен первым protocol message; relay тоже использует первое сообщение `authenticate` и не кладёт bearer token в WebSocket URL. Metahub adapter монтирует runtime как trusted Tier 2 service после signed-token validation и `manageMetahub` access checks.

Текущая ShareDB boundary — snapshot-port persistence для первого full-boot slice. Она seed-ит upstream-shaped `scenes`, `assets`, `settings` и per-scene/per-user `user_data` documents, валидирует snapshots перед storage и передаёт checksum/revision guards в storage writes. Это ещё не durable ShareDB op-store и не multi-user collaboration service.

Snapshot-port runtime намеренно работает в одном процессе. При наличии
`NODE_UNIQUE_ID` или значения `PLAYCANVAS_EDITOR_REALTIME_WORKER_COUNT` больше
единицы запуск завершается fail-closed: для кластерных workers сначала нужен
общий durable ShareDB backend. Перед realtime-чтением выполняется проверка
durable storage, принятые записи сохраняются после применения, а in-process OT
backend удаляется после закрытия последнего аутентифицированного socket.

Asset surface принимает файлы `folder`, `script`, `json`, `css`, `html`, `text`
и `shader` внутри namespace ассетов проекта. Строки только с metadata могут
представлять типы material, texture, model, audio и другие типы Editor, но этот
пакет не преобразует и не загружает произвольные binary files. Запись ассетов
ограничена full-boot token и лимитами размера файла и multipart-полей проекта.
Route создания намеренно возвращает upstream-ответ `{id}`; неподдерживаемые
записи возвращают типизированный JSON вместо HTML fallback.

Вне scope этого package slice:

-   PlayCanvas Cloud parity;
-   multi-user collaboration;
-   durable ShareDB operation history;
-   преобразование binary model, audio и texture или широкий binary asset upload.
