# Applications Backend — Система миграций

> Обзор эндпоинтов миграций приложений и схемы базы данных. Полный обзор пакета см. в [README-RU.md](README-RU.md).

## Эндпоинты миграций приложений

Эндпоинт статуса миграции приложения используется компонентом `ApplicationMigrationGuard` на фронтенде.

### `GET /application/:id/migrations/status`

Возвращает `ApplicationMigrationStatusResponse`:

```typescript
{
  migrationRequired: boolean       // Требуется ли миграция
  severity: UpdateSeverity          // 'mandatory' | 'recommended' | 'optional'
  schemaExists: boolean             // Существует ли динамическая схема (app_{uuid})
  structureUpgradeRequired: boolean // Требуется ли обновление структуры системных таблиц
  blockers: StructuredBlocker[]     // Структурированные блокировки с i18n-кодами
}
```

**Определение серьёзности** использует `determineSeverity()` из `@universo/migration-guard-shared/utils`:
- `MANDATORY` — схема не существует ИЛИ требуется обновление структуры
- `RECOMMENDED` — миграция требуется, но не обязательна
- `OPTIONAL` — миграция не требуется

## Миграции базы данных (TypeORM)

Миграции статической схемы находятся в `src/database/migrations/postgres/`:

| Миграция | Назначение |
|---|---|
| `1800000000000-CreateApplicationsSchema` | Создаёт схему `applications` с таблицами `applications` и `connector_publications` |

Миграции экспортируются как массив `applicationsMigrations` и регистрируются в центральном реестре `@flowise/core-backend`.

## Таблицы динамической схемы

Рантайм-схемы приложений (`app_{uuid}`) создаются генератором `SchemaGenerator`. Основные таблицы:

| Таблица | Назначение |
|---|---|
| `_app_layouts` | Активные макеты |
| `_app_widgets` | Конфигурации виджетов по зонам макета |
| `_app_metadata` | Метаданные схемы (версия, хеш шаблона и т.д.) |

## Синхронизация приложений

`applicationSyncRoutes.ts` обрабатывает синхронизацию опубликованных данных метахаба в рантайм-схему приложения. Функции:

- `persistPublishedWidgets` — сохраняет опубликованные данные виджетов из снапшотов метахаба
- `getPersistedPublishedWidgets` — читает существующие данные виджетов для сравнения
- `hasPublishedWidgetsChanges` — определяет, изменились ли данные виджетов с последней синхронизации
