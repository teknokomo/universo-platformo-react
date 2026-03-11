# @universo/rest-docs

Отдельный Swagger UI и OpenAPI-сервер для текущего слоя REST-документации Universo Platformo.

## Overview

Этот пакет поднимает bundled OpenAPI specification по адресу `/api-docs` и предоставляет отдельный documentation-процесс, независимый от основного backend runtime.
Он документирует те route groups, которые сейчас реально присутствуют в спецификации пакета, включая исторические API-группы, ещё остающиеся в transitional OpenAPI-layer.

## What The Package Does

- Загружает bundled OpenAPI document, который генерируется из `src/openapi/index.yml`.
- Поднимает небольшой Express-сервер, который перенаправляет `/` на `/api-docs`.
- Отдаёт интерактивный Swagger UI для локального и удалённого изучения API.
- Хранит authoring source в модульном виде под `src/openapi/` и собирает его в runtime bundle.

## Current Specification Scope

Текущее OpenAPI-дерево всё ещё включает route groups, определённые в `src/openapi/index.yml`:

- authentication
- uniks
- spaces
- canvases
- metaverses
- publications
- profile
- space-builder

Этот README намеренно описывает пакет в его текущем состоянии.
Если platform taxonomy изменится, сначала должен быть обновлён OpenAPI source, а затем уже этот README должен следовать за ним.

## Development Notes

```bash
pnpm --filter @universo/rest-docs build
pnpm --filter @universo/rest-docs validate
pnpm --filter @universo/rest-docs lint
```

- `build` компилирует TypeScript и собирает модульные OpenAPI-файлы в bundle.
- `validate` проверяет `src/openapi/index.yml` через Redocly.
- Runtime serving использует `dist/openapi-bundled.yml`, а не authoring-tree напрямую.

## Running The Docs Server

```bash
pnpm --filter @universo/rest-docs build
pnpm --filter @universo/rest-docs start
```

По умолчанию Swagger UI доступен по адресу `http://localhost:6655/api-docs`.

## Related Documentation

- [Индекс пакетов](../README-RU.md)
- [Корневой README проекта](../../README-RU.md)
- [Точка входа OpenAPI authoring](src/openapi/index.yml)
- [Архитектурные заметки](ARCHITECTURE.md)

---

Universo Platformo | REST docs server