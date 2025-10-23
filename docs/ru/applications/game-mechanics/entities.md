# Entities (ECS) — [Статус: Планируется]

## Назначение

Сервис управления сущностями (Entity) по модели ECS: тонкая сущность (id + transform + world) и набор компонентов, определяющих данные и поведение. Инстанс создаётся из конкретной опубликованной версии ресурса (ResourceVersion).

## Интерфейсы

-   REST API (MVP):
    -   POST `/api/v1/entities/instantiate` — создать сущность по `resourceVersionId`
    -   PATCH `/api/v1/entities/:id` — обновить компоненты состояния (move/update-state)
    -   GET `/api/v1/entities/:id` — получить сущность
    -   GET `/api/v1/entities/:id/tree` — получить дерево составных сущностей по BOM
-   События: `entity.created`, `entity.moved`, `entity.state.updated`, `entity.assembled`, `entity.decomposed`

## Структура (ожидаемая)

```txt
packages/entities-srv/base/
  src/
    api/            # Контроллеры REST/WS
    domain/         # Модель ECS, агрегаты, фабрики, политики
    infra/          # БД (Supabase), репозитории, мапперы, очереди
    ws/             # Каналы Realtime/WS (позже)
```

## Компоненты (MVP)

-   Transform: позиция/ориентация/масштаб, worldId
-   Visual: варианты визуализации по состояниям/LOD
-   Health/Integrity: целостность и пороги переключения визуала
-   Inventory/Container: вместимость (масса/объём), стекуемость, правила
-   Ownership/Lock: владельцы, блокировки операций

## Связь с ресурсами

-   Сущность всегда привязана к `ResourceVersion` (immutable)
-   Дерево сущностей может порождаться из BOM соответствующей версии ресурса

## База данных (высокоуровнево)

-   Таблицы `ecs.entities`, `ecs.components` (JSONB), `ecs.entity_relations`
-   Индексы по `world_id`, `owner_id`, `updated_at` для потокового чтения

## Метрики

-   Создание/удаление сущностей, латентность операций move/update, размер компонент
