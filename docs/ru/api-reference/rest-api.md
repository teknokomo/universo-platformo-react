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

## Generic Entity Authoring Endpoints

- `GET /metahub/{metahubId}/entity-types` и `POST /metahub/{metahubId}/entity-types` перечисляют и создают определения custom entity type для workspace Entities.
- `GET /metahub/{metahubId}/entity-type/{entityTypeId}`, `PATCH /metahub/{metahubId}/entity-type/{entityTypeId}` и `DELETE /metahub/{metahubId}/entity-type/{entityTypeId}` управляют одним custom entity type, включая его publication flag.
- `GET /metahub/{metahubId}/entities`, `POST /metahub/{metahubId}/entities` и `POST /metahub/{metahubId}/entities/reorder` перечисляют, создают и переупорядочивают design-time instances для одного custom kind.
- `GET /metahub/{metahubId}/entity/{entityId}`, `PATCH /metahub/{metahubId}/entity/{entityId}`, `DELETE /metahub/{metahubId}/entity/{entityId}`, `POST /metahub/{metahubId}/entity/{entityId}/restore`, `DELETE /metahub/{metahubId}/entity/{entityId}/permanent` и `POST /metahub/{metahubId}/entity/{entityId}/copy` управляют одним custom entity instance через generic route surface.

## Entity Automation Endpoints

- `GET /metahub/{metahubId}/object/{objectId}/actions` и `POST /metahub/{metahubId}/object/{objectId}/actions` перечисляют и создают object-owned entity actions.
- `GET /metahub/{metahubId}/action/{actionId}`, `PATCH /metahub/{metahubId}/action/{actionId}` и `DELETE /metahub/{metahubId}/action/{actionId}` читают, обновляют и удаляют один action.
- `GET /metahub/{metahubId}/object/{objectId}/event-bindings` и `POST /metahub/{metahubId}/object/{objectId}/event-bindings` перечисляют и создают event bindings для одного object.
- `GET /metahub/{metahubId}/event-binding/{bindingId}`, `PATCH /metahub/{metahubId}/event-binding/{bindingId}` и `DELETE /metahub/{metahubId}/event-binding/{bindingId}` читают, обновляют и удаляют один binding.

## Источник интерактивной документации

Слой интерактивного Swagger и OpenAPI поставляется пакетом
`@universo/rest-docs`.

Этот пакет пересобирает файл `src/openapi/index.yml` из живых backend route files
перед validate и build, чтобы опубликованный inventory маршрутов оставался
синхронизированным с репозиторием после рефакторингов.

Для сценария запуска и использования переходите к странице Interactive OpenAPI Docs
внутри этого раздела.

## Metahub Shared Authoring Endpoints

- `GET /metahub/{metahubId}/shared-containers` разрешает виртуальные контейнеры Common, которые используются для shared attributes, constants и values.
- `GET /metahub/{metahubId}/shared-entity-overrides` перечисляет sparse overrides исключения или порядка для одной shared entity либо одного target object.
- `PATCH /metahub/{metahubId}/shared-entity-overrides` выполняет fail-closed upsert overrides исключения, active-state или sort-order для shared entities.
- `GET /metahub/{metahubId}/scripts` и `POST /metahub/{metahubId}/scripts` перечисляют и создают design-time scripts; authoring в Common обязан сочетать `attachedToKind=general` с `moduleRole=library`.
- `GET /metahub/{metahubId}/script/{scriptId}`, `PATCH /metahub/{metahubId}/script/{scriptId}` и `DELETE /metahub/{metahubId}/script/{scriptId}` завершаются fail-closed, если rename, delete или circular dependency shared-library сломают consumer-ы `@shared/<codename>`.
- `GET /metahub/{metahubId}/export` и `POST /metahubs/import` сохраняют shared snapshot sections вместе с layouts, scripts и publication-ready metadata.

## Runtime Script Endpoints

- `GET /applications/{applicationId}/runtime/scripts` перечисляет опубликованные runtime scripts, видимые клиенту, без встраивания bundle bodies.
- `GET /applications/{applicationId}/runtime/scripts/{scriptId}/client` возвращает JavaScript client bundle с поддержкой `ETag` и `304 Not Modified`.
- `POST /applications/{applicationId}/runtime/scripts/{scriptId}/call` выполняет только не-lifecycle опубликованные server-методы у скриптов с `rpc.client` и сохраняет fail-closed capability/error codes.

Используйте эти endpoints вместе, когда runtime-поверхности нужны metadata скриптов, доставка bundle и RPC-вызовы.
