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

## Миграции платформенной схемы

Определения статической платформенной схемы находятся в `src/platform/migrations/`:

| Миграция | Назначение |
|---|---|
| `1800000000000-CreateApplicationsSchema.sql.ts` | Создаёт схему `applications` с платформенными таблицами приложений, коннекторов, членства и метаданных синхронизации |

Единый раннер платформенных миграций использует `createApplicationsSchemaMigrationDefinition` напрямую через `@universo/migrations-platform`. Этот пакет больше не экспортирует TypeORM-массив `applicationsMigrations` для platform bootstrap.

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
