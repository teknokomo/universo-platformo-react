# `packages/updl` — UPDL Backend — [Статус: N/A]

## Назначение

UPDL — это чисто **frontend модуль с определениями нод** для редактора Flowise. Backend компонент **не существует** в данном пакете.

## Архитектура

UPDL следует принципу **чистого разделения ответственности**:

- **Определения нод**: Обрабатываются в `packages/updl` (только frontend)
- **Логика сборки пространств**: Обрабатывается в `packages/publish-srv` и `packages/space-builder-srv`
- **API для экспорта**: Обрабатывается в публикационных сервисах
- **Хранение данных**: Обрабатывается в Flowise Server через TypeORM

## Почему нет Backend компонента?

UPDL — это **модуль определений нод**, который:

1. **Не требует API**: Ноды загружаются напрямую в Flowise через механизм NodesPool
2. **Не хранит состояние**: Определения нод статичны и не требуют базы данных
3. **Не выполняет бизнес-логику**: Логика выполнения обрабатывается в публикационных сервисах
4. **Не обрабатывает запросы**: Все взаимодействие происходит через Flowise UI

## Связанные Backend сервисы

Если вам нужна backend функциональность для работы с UPDL пространствами, обратитесь к:

- **[Publish Backend](../publish/backend.md)** — API для публикации UPDL пространств в AR.js/PlayCanvas
- **[Space Builder Backend](../space-builder/backend.md)** — API для AI-генерации UPDL пространств
- **[Flowise Server](../../getting-started/installation.md)** — Основной backend для редактора Flowise

## Типичный workflow

```
UPDL Definitions (Frontend)
        ↓
Flowise Editor (UI)
        ↓
Space Builder API (Backend) ← AI генерация
        ↓
Publish API (Backend) ← Экспорт в технологии
        ↓
AR.js / PlayCanvas / Другие
```

## См. также

- [UPDL Frontend](./frontend.md) — Определения нод и интеграция
- [UPDL README](./README.md) — Общее описание системы
- [Publish Backend](../publish/backend.md) — API публикации
- [Space Builder Backend](../space-builder/backend.md) — API AI-генерации
