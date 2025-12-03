# Metaverse Backend (metaverse-backend) — [Статус: MVP]

## Назначение

Бэкенд домена «метавселенные»: управление жизненным циклом метавселенных, связями (дочерние/партнёрские), правами доступа, публикацией, интеграцией с ECS и UPDL.

Широкий контекст и роль метавселенных см. [Об Universo Platformo](../../universo-platformo/about.md).

## Границы сервиса

-   Внутри: `metaverse`, `unik`, `space`, `link` (meta↔meta), ACL
-   Снаружи: ECS (`entities-backend`), ресурсы (`resources-backend`), экономика (`economy-backend`), публикация (`template-engine-backend`, `publish-frontend`)

## Интерфейсы

-   REST API (минимум):
    -   POST `/api/v1/metaverses` — создание
    -   POST `/api/v1/metaverses/default` — инициализация дефолтной метавселенной для пользователя
    -   PATCH `/api/v1/metaverses/:id` — настройки/доступ
    -   POST `/api/v1/metaverses/:id/links` — дочерние/партнёрские связи; подключаемые локации
    -   POST `/api/v1/metaverses/:id/import` — импорт проекта с конвертацией в UPDL
    -   GET `/api/v1/metaverses/:id/overview` — обзор (Uniks, Spaces, связи)
    -   POST `/api/v1/metaverses/:id/publish` — публикация по шаблону
-   События: `metaverse.created`, `metaverse.linked`, `metaverse.published`

## Структура каталогов (ожидаемая)

```txt
packages/metaverse-backend/base/
  src/
    api/
    domain/
    infra/
    integrations/
```

## Данные (высокоуровнево)

-   Таблицы: `metaverse.metaverses`, `metaverse.uniks`, `metaverse.spaces`, `metaverse.links`
-   Связь с ECS: `ecs.entities` (world/metaverse scope)

## Безопасность

-   Supabase Auth, ACL на уровне мета/спейс
-   RLS политики для разделения арендаторов (owner/team/org)

## Метрики

-   Кол-во мета/связей, латентность публикации, ошибки ACL

## Интеграции и конвертация

-   Импорт существующих проектов → конвертация в UPDL-графы Space
-   Управление совместимостью версий UPDL и шаблонов публикации
