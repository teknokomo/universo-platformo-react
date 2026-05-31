# @universo-react/playcanvas-editor

Foundation-пакет для официального frontend-артефакта PlayCanvas Editor.

Этот пакет намеренно является границей артефакта, а не библиотекой React/MUI-компонентов. Он изолирует upstream source `playcanvas/editor`, собирает static artifact из закрепленного upstream tag и предоставляет package-local команды проверки.

## Upstream

-   Repository: https://github.com/playcanvas/editor
-   Tag: `v2.22.1`
-   Commit: `0fcd44253ba1bba39c13d45b069265167249ecb6`
-   Package version: `2.22.1`
-   Node requirement: `>=22.22.0`
-   License: MIT, attribution находится в `NOTICE.md`

## Команды

```bash
pnpm --filter @universo-react/playcanvas-editor test
pnpm --filter @universo-react/playcanvas-editor editor:build
pnpm --filter @universo-react/playcanvas-editor editor:smoke
pnpm --filter @universo-react/playcanvas-editor editor:browser-smoke
```

В foundation-срезе пакет не определяет обычный script `build`. Root `pnpm build` не должен автоматически собирать Editor artifact, пока явно не подтверждена совместимость Node, pnpm, dependencies, Turbo, CI и guardrail-проверок.

## Smoke Mode

Текущий режим smoke-проверки: `artifact-only`.

Сгенерированный `dist/editor/index.html` является безопасной unavailable-страницей: она объясняет, что artifact собран, но ещё не подключён к PlayCanvas-hosted или Universo-backed Editor session. Это намеренно. Этот срез не реализует сохранение сцен в метахаб, загрузку ассетов, collaboration, backend API emulation, iframe bridge, Colyseus authoring или MCP/AI tooling.

## Boundary Rules

-   Не импортировать upstream Editor DOM, PCUI, Observer state или vendor source в MUI shells.
-   Не добавлять этот пакет в metahub package seed list в foundation-срезе.
-   Не помещать upstream `package.json` в `vendor/playcanvas-editor/`.
-   Upstream updates должны оставаться reviewable через `vendor/UPSTREAM.md` и `vendor/package.playcanvas-editor.json`.
