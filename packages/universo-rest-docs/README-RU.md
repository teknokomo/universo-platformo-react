# @universo/rest-docs

Отдельный Swagger UI и OpenAPI-сервер для актуальной REST-поверхности Universo Platformo.

## Overview

Этот пакет отдаёт сгенерированную OpenAPI-спецификацию по адресу `/api-docs` и держит интерактивный REST-справочник отдельно от основного backend runtime.
Исходный OpenAPI-файл пересобирается из живых backend route files перед validate и build, поэтому удалённые домены не продолжают жить в документации после рефакторингов репозитория.

## What The Package Does

- Сканирует смонтированные backend route files и заново генерирует `src/openapi/index.yml`.
- Собирает сгенерированный OpenAPI source в `dist/openapi-bundled.yml` для runtime-serving.
- Поднимает небольшой Express-сервер, который перенаправляет `/` на `/api-docs`.
- Отдаёт интерактивный Swagger UI для локальной валидации, QA и integration work.

## Current Route Coverage

Сгенерированная спецификация организована вокруг route groups, которые сейчас реально существуют в репозитории:

- system health и ping
- auth
- public locales
- profile
- onboarding
- admin global users, instances, roles, locales, and settings
- applications, connectors, and runtime sync
- public metahub, metahubs, branches, publications, migrations, entity types, entities, entity actions, event bindings, field definitions, fixed values, records, layouts, scripts, shared entity overrides, settings, and templates

Пакет намеренно в первую очередь документирует текущий inventory путей и методов.
Payload schemas пока остаются generic, если только позднее они не будут стабилизированы и вынесены в явные contract-level schemas.

## Development Commands

```bash
pnpm --filter @universo/rest-docs generate:openapi
pnpm --filter @universo/rest-docs verify:route-sources
pnpm --filter @universo/rest-docs validate
pnpm --filter @universo/rest-docs build
pnpm --filter @universo/rest-docs start
pnpm --filter @universo/rest-docs lint
```

- `generate:openapi` пересобирает `src/openapi/index.yml` из живых route files.
- `verify:route-sources` падает, если список route sources для metahubs расходится с живым mounted router contract.
- `validate` сначала проверяет route source list, затем заново генерирует и проверяет OpenAPI source через Redocly.
- `build` сначала проверяет route source list, затем пересобирает source, компилирует TypeScript и бандлит runtime YAML.
- `start` отдаёт Swagger UI из `dist/openapi-bundled.yml`.

## Running The Docs Server

```bash
pnpm --filter @universo/rest-docs build
pnpm --filter @universo/rest-docs start
```

По умолчанию Swagger UI доступен по адресу `http://localhost:6655/api-docs`.
Используйте локальный backend base URL `http://localhost:3000/api/v1` внутри Swagger, если хотите выполнять запросы к локальному стеку.

## Safe Usage Notes

- Считайте сгенерированный документ актуальным inventory путей и методов, а не полностью типизированным payload-контрактом.
- Для mutating endpoints предпочитайте non-production environments.
- Authenticated endpoints требуют bearer token в Swagger authorization dialog.
- Если route mounts меняются, сначала пересоберите OpenAPI source, а уже потом проверяйте или публикуйте doc changes.

## Related Documentation

- [Архитектура пакета](ARCHITECTURE.md)
- [Справочник эндпоинтов](API_ENDPOINTS.md)
- [Точка входа OpenAPI source](src/openapi/index.yml)
- [Корневой README проекта](../../README-RU.md)

---

Universo Platformo | REST docs server
