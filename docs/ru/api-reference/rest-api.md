---
description: Базовые REST API-конвенции для Universo Platformo React.
---

# REST API

## Базовый URL

```text
https://your-instance.example.com/api/v1
```

## Текущая форма API

Текущий репозиторий организует API-маршруты по платформенным модулям, а не по
удалённой legacy taxonomy рабочих пространств.

Обычно сюда входят группы маршрутов для system health, auth, locales, profile,
onboarding, applications, connectors, admin, public metahub и metahub design-time API.

## Источник интерактивной документации

Слой интерактивного Swagger и OpenAPI поставляется пакетом
`@universo/rest-docs`.

Этот пакет пересобирает файл `src/openapi/index.yml` из живых backend route files
перед validate и build, чтобы опубликованный inventory маршрутов оставался
синхронизированным с репозиторием после рефакторингов.

Для сценария запуска и использования переходите к странице Interactive OpenAPI Docs
внутри этого раздела.

## Runtime Script Endpoints

- `GET /applications/{applicationId}/runtime/scripts` перечисляет опубликованные runtime scripts, видимые клиенту, без встраивания bundle bodies.
- `GET /applications/{applicationId}/runtime/scripts/{scriptId}/client` возвращает JavaScript client bundle с поддержкой `ETag` и `304 Not Modified`.
- `POST /applications/{applicationId}/runtime/scripts/{scriptId}/call` выполняет только не-lifecycle опубликованные server-методы у скриптов с `rpc.client` и сохраняет fail-closed capability/error codes.

Используйте эти endpoints вместе, когда runtime-поверхности нужны metadata скриптов, доставка bundle и RPC-вызовы.
