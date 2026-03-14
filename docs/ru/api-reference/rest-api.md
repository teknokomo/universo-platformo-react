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
