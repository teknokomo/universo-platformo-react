---
description: Foundation-пакет артефакта PlayCanvas Editor.
---

# Пакет PlayCanvas Editor

`@universo-react/playcanvas-editor` — foundation-пакет Platformo для официального frontend-артефакта PlayCanvas Editor.

Пакет содержит закреплённый upstream snapshot PlayCanvas Editor и изолирует его от runtime MUI shells. Это не пакет React-компонентов и в этом foundation-срезе он не регистрируется как runtime package метахаба.

## Текущий охват

-   Workspace package: `packages/universo-react-playcanvas-editor/`
-   Package name: `@universo-react/playcanvas-editor`
-   Upstream repository: `https://github.com/playcanvas/editor`
-   Upstream tag: `v2.22.1`
-   Upstream commit: `0fcd44253ba1bba39c13d45b069265167249ecb6`
-   Upstream package version: `2.22.1`
-   Required Node.js version for Editor build: `>=22.22.0`
-   Smoke mode: `artifact-only`

Пакет может собрать и проверить static artifact, но ещё не реализует хранение сцен в метахабе, загрузку ассетов, collaboration, backend API emulation, iframe bridge, Colyseus authoring или AI/MCP scene editing.

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
-   Не добавлять этот пакет в metahub package seed data в foundation-срезе.
-   Не хранить upstream `package.json` в `vendor/playcanvas-editor/`.
-   Upstream updates должны оставаться закреплёнными и reviewable через `vendor/UPSTREAM.md`.

## Будущая интеграция

Следующие брифы могут добавить serving route, iframe host, metahub storage adapter, asset pipeline, module external-file integration, Colyseus authoring и AI/MCP tooling. Эти интеграции должны сохранять artifact boundary, если новый утверждённый план явно не изменит архитектуру.
