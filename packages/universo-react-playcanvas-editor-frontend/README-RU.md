# @universo-react/playcanvas-editor-frontend

Foundation-пакет для официального frontend-артефакта PlayCanvas Editor.

Этот пакет намеренно является границей артефакта, а не библиотекой React/MUI-компонентов. Он изолирует upstream source `playcanvas/editor`, собирает static artifact из закрепленного upstream tag и предоставляет package-local команды проверки.

## Upstream

-   Repository: https://github.com/playcanvas/editor
-   Tag: `v2.24.2`
-   Commit: `00360100b3b5747648eb3d7287421ef25491f5c7`
-   Package version: `2.24.2`
-   Node requirement: `>=22.22.0`
-   License: MIT, attribution находится в `NOTICE.md`

## Команды

```bash
pnpm --filter @universo-react/playcanvas-editor-frontend test
pnpm --filter @universo-react/playcanvas-editor-frontend editor:build
pnpm --filter @universo-react/playcanvas-editor-frontend editor:smoke
pnpm --filter @universo-react/playcanvas-editor-frontend editor:browser-smoke
```

Script `build` пакета делегирует в `editor:build`, поэтому root `pnpm build` обновляет artifact, который metahub backend отдаёт из `dist/editor`. Скрипты package-local и CI должны по-прежнему запускать `editor:smoke` и `editor:browser-smoke` после сборки.

## Режимы артефакта

Режим артефакта по умолчанию: `universo-full-upstream-ui`.

`universo-hosted` собирает закреплённые upstream Editor files, создаёт минимальный Universo shell, injects `window.config` и подключает bridge bootstrap script. `artifact-only` остаётся доступным через `UNIVERSO_PLAYCANVAS_EDITOR_ARTIFACT_MODE=artifact-only` как fail-closed unavailable page.

`universo-full-upstream-ui` — default acceptance mode для полного upstream Editor shell. В этом режиме artifact по-прежнему изолирует upstream Editor внутри iframe, но получает full-boot config от metahub host с включёнными realtime, messenger и relay URLs. Full-boot shell не устанавливает hosted entity fallback adapter и не содержит `/disabled` WebSocket shim. Browser acceptance должен подтверждать upstream DOM shell: `#layout-toolbar`, `#layout-hierarchy`, `#layout-viewport`, `#canvas-3d`, `#layout-assets` и `#layout-attributes`.

Hosted bridge-срез поддерживает первый manager-only путь authoring в метахабе: `protocol.describe` compatibility descriptor, project context, scene list/read/save, bounded JSON scene payloads и minimal JSON asset metadata. Backend также отдаёт same-origin compatibility namespace `/playcanvas/editor-compatible/...` для `config`, `scenes`, `assets`, `settings`, per-scene/per-user `user_data`, single-user ShareDB-compatible snapshot persistence и явных cloud-only no-op descriptors. Он не реализует PlayCanvas Cloud parity, durable ShareDB operation-log history, multi-user collaboration, широкий binary assets pipeline, Colyseus authoring, implicit runtime publication или MCP/AI tooling.

## Безопасность hosted artifact

Реальный upstream Editor размещается в iframe с `allow-scripts allow-same-origin`. Эта комбинация sandbox не должна указывать на тот же origin, что и platform shell. Backend метахаба возвращает tokenized artifact URL только когда может определить отдельный artifact origin:

-   Local/E2E: автоматический loopback sibling origin, например `127.0.0.1` как platform origin и `localhost` как artifact origin.
-   Non-loopback deployments: задайте `PLAYCANVAS_EDITOR_ARTIFACT_PUBLIC_ORIGIN` на HTTP(S) origin, который ведёт к тому же backend artifact endpoint через другой host.

Задайте `PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN`, если backend за proxy получает внутренние host headers, а browser-facing platform origin отличается. Forwarded origin headers по умолчанию игнорируются; включайте `PLAYCANVAS_EDITOR_TRUST_PROXY_HEADERS=true` только когда edge proxy перезаписывает `x-forwarded-host` и `x-forwarded-proto`.

Если отдельный origin недоступен, host descriptor возвращает `artifactStatus: "misconfigured"`, и MUI host не монтирует iframe.

## Boundary Rules

-   Не импортировать upstream Editor DOM, PCUI, Observer state или vendor source в MUI shells.
-   Сохранять этот пакет authoring-only в metahub package registry.
-   Не помещать upstream `package.json` в `vendor/playcanvas-editor/`.
-   Upstream updates должны оставаться reviewable через `vendor/UPSTREAM.md` и `vendor/package.playcanvas-editor.json`.
