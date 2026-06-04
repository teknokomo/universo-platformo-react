---
description: Foundation-пакет артефакта PlayCanvas Editor.
---

# Пакет PlayCanvas Editor

`@universo-react/playcanvas-editor` — foundation-пакет Platformo для официального frontend-артефакта PlayCanvas Editor.

Пакет содержит закреплённый upstream snapshot PlayCanvas Editor и изолирует его от runtime MUI shells. Это не пакет React-компонентов; он регистрируется как authoring-only пакет метахаба без runtime targets.

## Текущий охват

-   Workspace package: `packages/universo-react-playcanvas-editor/`
-   Package name: `@universo-react/playcanvas-editor`
-   Upstream repository: `https://github.com/playcanvas/editor`
-   Upstream tag: `v2.22.1`
-   Upstream commit: `0fcd44253ba1bba39c13d45b069265167249ecb6`
-   Upstream package version: `2.22.1`
-   Required Node.js version for Editor build: `>=22.22.0`
-   Smoke mode: `artifact-only`

Пакет может собрать и проверить static artifact. Метахабы могут подключить его через **Resources → Packages**, настроить способ открытия редактора и загрузить static artifact через authenticated host route пакетов метахаба. Сам iframe получает короткоживущий tokenized artifact URL, чтобы static JS/CSS ассеты загружались внутри sandbox без `allow-same-origin`. Он ещё не реализует хранение сцен в метахабе, загрузку ассетов, collaboration, backend API emulation, iframe bridge messaging, Colyseus authoring или AI/MCP scene editing.

В платформе теперь есть первый срез модели хранения проектов PlayCanvas для метахабов. См. [Проекты PlayCanvas](playcanvas-projects.md): таблицы metadata проекта, правила file namespace, поведение снимков и синхронизация runtime manifests.

## Команды

```bash
pnpm --filter @universo-react/playcanvas-editor test
pnpm --filter @universo-react/playcanvas-editor editor:build
pnpm --filter @universo-react/playcanvas-editor editor:smoke
pnpm --filter @universo-react/playcanvas-editor editor:browser-smoke
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

Встроенный режим и режим отдельного открытия используют authenticated route хоста метахаба. Отдельное открытие запускает вторую страницу хоста в новой вкладке, и эта страница всё равно загружает artifact через sandboxed iframe, а не открывает raw artifact URL как top-level document. Iframe хоста использует sandbox без `allow-same-origin`; после проверки authenticated host descriptor backend выдаёт короткоживущий tokenized artifact URL, чтобы sandboxed document мог загрузить свои static JS/CSS assets без cookie-based same-origin доступа. Каждый tokenized artifact request повторно проверяется по текущему доступу `manageMetahub` пользователя, который получил token, и по текущему режиму отображения подключённого пакета перед отдачей файла. Режим адреса разработки показывается только если `PLAYCANVAS_EDITOR_DEVELOPMENT_URLS` включает хотя бы один backend-allowlisted origin, и backend всё равно валидирует сохранённый URL перед использованием в host surface.

Копирование метахаба, экспорт снимка и импорт снимка сохраняют эти настройки отображения пакета. Считайте экспортированные снимки метахаба чувствительными артефактами, которыми управляет владелец: когда включён режим адреса разработки, снимок может содержать сохранённый адрес разработки, чтобы импорт мог восстановить authoring configuration.

## Будущая интеграция

Следующие брифы могут добавить Editor iframe bridge/storage adapter, asset processing pipeline, S3 provider configuration, Colyseus authoring и AI/MCP tooling. Эти интеграции должны сохранять artifact boundary, если новый утверждённый план явно не изменит архитектуру.
