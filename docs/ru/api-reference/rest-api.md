---
description: Базовые REST API-конвенции для Universo Platformo React.
---

# REST API

## Базовый URL

```text
https://your-instance.example.com/api/v1
```

## Текущая форма API

Текущий репозиторий организует API-маршруты по платформенным модулям.

Обычно сюда входят группы маршрутов для auth, start, profile, metahubs,
publications, applications, admin, configuration и OpenAPI-generated endpoints.

## Источник документации

Слой Swagger или OpenAPI-представления поставляется пакетом `@universo/rest-docs`.
Этот пакет собирает модульную документацию маршрутов в одну опубликованную поверхность.
