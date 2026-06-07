---
description: Foundation-пакет артефакта PlayCanvas Editor.
---

# Пакет PlayCanvas Editor

`@universo-react/playcanvas-editor-frontend` — foundation-пакет Platformo для официального frontend-артефакта PlayCanvas Editor.

Пакет содержит закреплённый upstream snapshot PlayCanvas Editor и изолирует его от runtime MUI shells. Это не пакет React-компонентов; он регистрируется как authoring-only пакет метахаба без runtime targets.

## Текущий охват

-   Workspace package: `packages/universo-react-playcanvas-editor-frontend/`
-   Package name: `@universo-react/playcanvas-editor-frontend`
-   Upstream repository: `https://github.com/playcanvas/editor`
-   Upstream tag: `v2.23.4`
-   Upstream commit: `c4916f4973963341984499f2d919f8bfd38e417c`
-   Upstream package version: `2.23.4`
-   Required Node.js version for Editor build: `>=22.22.0`
-   Default artifact mode: `universo-full-upstream-ui`
-   Fallback artifact mode: `artifact-only`

Пакет может собрать и проверить static artifact. Метахабы могут подключить его через **Resources → Packages**, настроить способ открытия редактора и загрузить static artifact через authenticated host route пакетов метахаба. Первый Universo-hosted bridge-срез добавляет типизированный iframe bridge и manager-only storage adapter для выбранного/default PlayCanvas project: загрузка контекста проекта, список/чтение сцен, сохранение bounded JSON scene payload, список minimal JSON asset metadata и повторное открытие сохранённой сцены.

Это не PlayCanvas Cloud parity. Collaboration, PlayCanvas account proxy, широкий binary asset pipeline, Colyseus authoring, AI/MCP scene editing и неявная публикация runtime остаются вне scope.

В платформе теперь есть первый срез модели хранения проектов PlayCanvas для метахабов. См. [Проекты PlayCanvas](playcanvas-projects.md): таблицы metadata проекта, правила file namespace, поведение снимков и синхронизация runtime manifests.

## Команды

```bash
pnpm --filter @universo-react/playcanvas-editor-frontend test
pnpm --filter @universo-react/playcanvas-editor-frontend editor:build
pnpm --filter @universo-react/playcanvas-editor-frontend editor:smoke
pnpm --filter @universo-react/playcanvas-editor-frontend editor:browser-smoke
```

Пакет намеренно пока не определяет обычный script `build`. Root `pnpm build` не собирает Editor artifact, пока пакет не будет явно подключён к root Turbo pipeline.

## Правила границы

-   Не импортировать vendor source PlayCanvas Editor, PCUI или Observer state в обычные MUI shells.
-   Сохранять пакет authoring-only: `source.runtimeTargets` должен оставаться пустым, пока отдельный утверждённый runtime-бриф не изменит эту границу.
-   Не включать пакет в runtime snapshots публикации и `_app_packages`.
-   Не хранить upstream `package.json` в `vendor/playcanvas-editor/`.
-   Upstream updates должны оставаться закреплёнными и reviewable через `vendor/UPSTREAM.md`.

## Настройки отображения в метахабе

Первый integration-срез хранит настройки отображения для конкретного метахаба в `metahubs.rel_metahub_packages.config`:

-   Отключён
-   Встроенный iframe
-   Открывать отдельно
-   Адрес разработки

Встроенный режим и режим отдельного открытия используют authenticated host page метахаба. Отдельное открытие запускает вторую страницу хоста в новой вкладке, и эта страница всё равно загружает artifact через iframe, а не открывает raw artifact URL как top-level document. Реальному upstream Editor нужен `sandbox="allow-scripts allow-same-origin"`, чтобы его scripts, workers и локальные browser APIs работали как обычное приложение; такая комбинация sandbox безопасна только когда iframe document находится на другом origin, чем platform shell. Поэтому authenticated host descriptor возвращает tokenized artifact URL только если доступен изолированный artifact origin.

Для локальных и E2E запусков backend автоматически использует loopback sibling origin (`127.0.0.1` против `localhost`), когда request origin является loopback. Для non-loopback deployments настройте `PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN` на HTTP(S) origin, который ведёт к тому же backend artifact route через другой host, чем platform UI. Настройте `PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN`, если proxy передаёт backend внутренние host headers, а browser-facing platform origin отличается; `x-forwarded-host` и `x-forwarded-proto` игнорируются, пока для доверенного edge proxy явно не задан `PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS=true`. CSP страницы PlayCanvas Editor host добавляет этот artifact origin в `frame-src`/`child-src`; если отдельный origin нельзя определить, descriptor возвращает `artifactStatus: "misconfigured"` и не возвращает `artifactUrl`.

Каждый tokenized artifact request повторно проверяется по текущему доступу `manageMetahub` пользователя, который получил token, и по текущему режиму отображения подключённого пакета перед отдачей файла. Tokenized artifact responses отправляют `Referrer-Policy: no-referrer`, route-specific CSP с `frame-ancestors 'self' <parentOrigin>`, короткий cache TTL для non-HTML assets и fail closed, если browser `Origin` header не совпадает с parent origin внутри token. Same-origin authenticated route `editor-artifact/*` не используется как entrypoint iframe. Режим адреса разработки показывается только если `PLAYCANVAS_EDITOR_DEVELOPMENT_URLS` включает хотя бы один backend-allowlisted origin, и backend всё равно валидирует сохранённый URL перед использованием в host surface.

Принятая `allow-same-origin` threat model предполагает, что artifact origin выделен только под Editor artifact, не разделяет platform cookies и не предоставляет credentialed application APIs кроме tokenized artifact files. Bridge sessions короткоживущие, scoped по metahub/package/project/default-scene/user и передаются backend в body запросов, а не в route params или query strings. Session ids и nonces хранятся в closure artifact bootstrap, а не на public marker object. Sandboxed iframe общается с MUI host через типизированные сообщения; MUI host использует обычный authenticated API client для backend bridge commands.

Копирование метахаба, экспорт снимка и импорт снимка сохраняют эти настройки отображения пакета. Считайте экспортированные снимки метахаба чувствительными артефактами, которыми управляет владелец: когда включён режим адреса разработки, снимок может содержать сохранённый адрес разработки, чтобы импорт мог восстановить authoring configuration.

## Типизированный bridge-контракт

Authoring host descriptor содержит `playcanvasEditor`, когда подключённый пакет может открыть Universo-hosted bridge session. MUI host отправляет типизированные команды в `POST /metahub/{metahubId}/playcanvas/editor-bridge/commands` с `sessionToken` в JSON body и command envelope с UUID v7 `requestId`, UUID v7 `sessionId` и session `nonce`.

Первый bridge contract поддерживает `protocol.describe`, `project.loadSelected`, `scene.list`, `scene.read`, `scene.save`, `scene.saveStatus`, `asset.listMinimalForScene`, `bridge.capabilities`, `bridge.close` и `bridge.dirtyState`. `protocol.describe` отдаёт текущий compatibility descriptor для upstream Editor `v2.23.4`: single-user identity, branch-equivalent context, cloud-only no-op surfaces и включённые same-origin REST/realtime/messenger/relay endpoints для full upstream UI boot. Изолированный compatibility namespace также отдаёт manager-only same-origin REST endpoints для `config`, `scenes`, `assets`, `settings` и типизированных `cloud-only` no-op responses в `/api/v1/metahub/{metahubId}/playcanvas/editor-compatible/projects/{projectId}`. Compatibility `config` включает short-lived signed-header token contract: `auth.accessToken` нужно отправлять как `X-PlayCanvas-Editor-Token` на compatibility REST requests, сохраняя обычную authenticated platform session. Mutations дополнительно используют стандартный CSRF contract: нужно получить token через `/api/v1/auth/csrf` и отправлять его как `X-CSRF-Token`. Этот surface сохраняет single-user payloads сцен и scoped settings через существующее хранилище PlayCanvas projects в метахабе и ShareDB-compatible snapshot runtime; это не полный PlayCanvas Cloud-compatible API, без durable ShareDB operation-log history, multi-user collaboration и cloud jobs. Сохранения сцен и scoped settings writes используют replay protection по `requestId` и возвращают сохранённый success response для безопасных повторных retries. Если checksum сохранённой сцены изменился, backend возвращает `saveConflict` с HTTP 409, а host показывает локализованный conflict dialog без утечки raw storage details.

Hosted artifact сериализует scene data через Editor-side API `entities:list` и `assets:list`. Если upstream Editor bundle в sandboxed hosted mode не инициализирует entity API, artifact устанавливает минимальный hosted entity adapter за теми же методами `editor.call('entities:new')` и `editor.call('entities:list')`. Так authoring action остаётся видимым внутри iframe, bridge получает dirty state через `entities:add`, а сохранение идёт через compatibility REST при наличии `config`; `scene.save` сохраняется только как bootstrap/fallback bridge command.

## Full Upstream UI Boot

`universo-full-upstream-ui` — целевой режим для отображения существующего upstream UI PlayCanvas Editor вместо hosted fallback panel. Host метахаба запрашивает full-boot compatibility config для выбранного/default PlayCanvas project, затем artifact запускает upstream bundle `./js/editor.js` с включёнными realtime, messenger и relay endpoints.

Full-boot browser acceptance должен падать, если виден только hosted fallback editor. Обязательная evidence включает видимые upstream DOM ids `#layout-toolbar`, `#layout-hierarchy`, `#layout-viewport`, `#canvas-3d`, `#layout-assets` и `#layout-attributes`, отсутствие `window.__UNIVERSO_PLAYCANVAS_EDITOR_BRIDGE__.hostedEntityAdapterInstalled === true` и отсутствие `/disabled` URL в `window.config.url`.

Текущий WebSocket runtime — single-user ShareDB-compatible snapshot boundary. Realtime, messenger и relay аутентифицируются короткоживущими full-boot compatibility tokens и origin checks; relay использует первое сообщение `authenticate`, а не token в URL. Metahub adapter работает как trusted Tier 2 service после signed-token validation и `manageMetahub` authorization, валидирует snapshots scenes/settings перед persistence и переносит checksum/revision guards в storage writes. Это не PlayCanvas Cloud parity, не durable ShareDB operation history и не multi-user collaboration.

## Устранение неполадок

Не копируйте `sessionToken`, artifact tokens, полные tokenized artifact URLs, bridge nonces, request bodies или экспортированные snapshots в публичные логи и тикеты. Используйте очищенные request ids, названия метахабов, package slug, artifact status, HTTP status и категории browser console.

-   **Artifact unavailable**: проверьте, что `pnpm --filter @universo-react/playcanvas-editor-frontend editor:build` и `editor:smoke` проходят, затем проверьте состояние подключения пакета в **Resources → Packages**. User-facing host должен показывать `artifactStatus` как безопасное состояние и не раскрывать filesystem paths или tokenized URLs.
-   **Editor frame cannot load**: проверьте, что `PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN` указывает на доступный из браузера origin, отличный от origin platform UI. Для доверенных reverse proxies задайте `PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN` или включайте `PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS=true` только когда edge proxy отбрасывает недоверенные forwarded headers.
-   **Permission blocked**: host и bridge требуют текущий доступ `manageMetahub`. Перепроверьте membership метахаба и состояние подключения пакета; не используйте artifact links от другого пользователя или из старой вкладки браузера.
-   **Save conflict**: загрузите последнюю версию сцены через conflict dialog и сохраните снова. Backend сравнивает scene checksums и намеренно fail-closed, если другой write изменил сохранённый payload.
-   **Development URL mode unavailable**: проверьте, что нужный origin есть в `PLAYCANVAS_EDITOR_DEVELOPMENT_URLS`. UI скрывает или отклоняет development URLs, которые backend не разрешает.

## Будущая интеграция

Следующие брифы могут расширить script asset parsing, generated artifacts, binary asset processing, S3 provider configuration, Colyseus authoring, runtime scene projection и AI/MCP tooling. Эти интеграции должны сохранять artifact boundary, если новый утверждённый план явно не изменит архитектуру.
