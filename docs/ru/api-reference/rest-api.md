---
description: Базовые REST API-конвенции для Universo Platformo React.
---

# REST API

## Базовый URL

```text
https://your-instance.example.com/api/v1
```

## Текущая форма API

Текущий репозиторий организует API-маршруты по платформенным модулям и
поверхностям метахабов, принадлежащим сущностям.

Обычно сюда входят группы маршрутов для здоровья системы, auth, locales, profile,
onboarding, applications, connectors, admin, public metahub и проектного API метахаба.

## Конечные точки проектирования общих сущностей

- `GET /metahub/{metahubId}/entity-types` и `POST /metahub/{metahubId}/entity-types` перечисляют и создают определения типов сущностей для рабочего пространства Entities и административного реестра типов сущностей.
- `GET /metahub/{metahubId}/entity-type/{entityTypeId}`, `PATCH /metahub/{metahubId}/entity-type/{entityTypeId}` и `DELETE /metahub/{metahubId}/entity-type/{entityTypeId}` управляют одним типом сущности, включая его флаг публикации.
- `GET /metahub/{metahubId}/entities`, `POST /metahub/{metahubId}/entities` и `POST /metahub/{metahubId}/entities/reorder` перечисляют, создают и переупорядочивают проектные экземпляры для одного пользовательского вида.
- `GET /metahub/{metahubId}/entity/{entityId}`, `PATCH /metahub/{metahubId}/entity/{entityId}`, `DELETE /metahub/{metahubId}/entity/{entityId}`, `POST /metahub/{metahubId}/entity/{entityId}/restore`, `DELETE /metahub/{metahubId}/entity/{entityId}/permanent` и `POST /metahub/{metahubId}/entity/{entityId}/copy` управляют одним пользовательским экземпляром сущности через общую поверхность маршрута.

## Entity Automation Endpoints

- `GET /metahub/{metahubId}/object/{objectId}/actions` и `POST /metahub/{metahubId}/object/{objectId}/actions` перечисляют и создают действия сущности, принадлежащие объекту.
- `GET /metahub/{metahubId}/action/{actionId}`, `PATCH /metahub/{metahubId}/action/{actionId}` и `DELETE /metahub/{metahubId}/action/{actionId}` читают, обновляют и удаляют одно действие.
- `GET /metahub/{metahubId}/object/{objectId}/event-bindings` и `POST /metahub/{metahubId}/object/{objectId}/event-bindings` перечисляют и создают привязки событий для одного объекта.
- `GET /metahub/{metahubId}/event-binding/{bindingId}`, `PATCH /metahub/{metahubId}/event-binding/{bindingId}` и `DELETE /metahub/{metahubId}/event-binding/{bindingId}` читают, обновляют и удаляют одну привязку.

## Источник интерактивной документации

Слой интерактивного Swagger и OpenAPI поставляется пакетом
`@universo/rest-docs`.

Этот пакет пересобирает файл `src/openapi/index.yml` из живых файлов маршрутов бэкенда
перед валидацией и сборкой, чтобы опубликованный список маршрутов оставался
синхронизированным с репозиторием после рефакторингов.

Для сценария запуска и использования переходите к странице интерактивной OpenAPI-документации
внутри этого раздела.

## Конечные точки общего проектирования метахаба

- `GET /metahub/{metahubId}/shared-containers` разрешает виртуальные контейнеры рабочего пространства ресурсов, которые используются для общих атрибутов, констант и значений.
- `GET /metahub/{metahubId}/shared-entity-overrides` перечисляет разреженные переопределения исключения или порядка для одной общей сущности либо одного целевого объекта.
- `PATCH /metahub/{metahubId}/shared-entity-overrides` выполняет закрытый upsert переопределений исключения, активности или порядка для общих сущностей.
- `GET /metahub/{metahubId}/scripts` и `POST /metahub/{metahubId}/scripts` перечисляют и создают проектные скрипты; проектирование в рабочем пространстве ресурсов обязано сочетать `attachedToKind=general` с `moduleRole=library`.
- `GET /metahub/{metahubId}/script/{scriptId}`, `PATCH /metahub/{metahubId}/script/{scriptId}` и `DELETE /metahub/{metahubId}/script/{scriptId}` завершаются закрыто, если переименование, удаление или циклическая зависимость общей библиотеки сломают потребителей `@shared/<codename>`.
- `GET /metahub/{metahubId}/export` и `POST /metahubs/import` сохраняют общие разделы снимка вместе с макетами, скриптами и метаданными, готовыми к публикации.

## Runtime Script Endpoints

- `GET /applications/{applicationId}/runtime/scripts` перечисляет опубликованные рантайм-скрипты, видимые клиенту, без встраивания тел бандлов.
- `GET /applications/{applicationId}/runtime/scripts/{scriptId}/client` возвращает клиентский JavaScript-бандл с поддержкой `ETag` и `304 Not Modified`.
- `POST /applications/{applicationId}/runtime/scripts/{scriptId}/call` выполняет только опубликованные серверные методы без lifecycle у скриптов с `rpc.client` и сохраняет закрытую обработку возможностей и кодов ошибок.

Используйте эти конечные точки вместе, когда рантайм-поверхности нужны метаданные скриптов, доставка бандла и RPC-вызовы.
