# Metahubs Backend — Система миграций

> Извлечено из [README-RU.md](README-RU.md). Общий обзор пакета см. в README.

## Движок миграций

- **Движок сравнения** — `calculateSystemTableDiff()` сравнивает две версии структуры и генерирует списки аддитивных/деструктивных изменений
- **Безопасные миграции** — `SystemTableMigrator` применяет только аддитивные изменения (ADD_TABLE, ADD_COLUMN, ADD_INDEX, ADD_FK); деструктивные изменения логируются, но не применяются
- **История миграций** — Таблица `_mhb_migrations` записывает каждую применённую миграцию с версией, названием и метаданными
- **Рекомендательные блокировки** — Защита от конкурентных миграций через advisory locks PostgreSQL

## Структурированные блокировки и гард миграций

- **Тип StructuredBlocker** — `{ code, params, message }` для i18n-совместимого отображения блокировок миграций
- **11 мест блокировок** в `TemplateSeedCleanupService` конвертированы из простых строк в структурированные объекты
- **5 мест блокировок** в `metahubMigrationsRoutes` для проверок миграций на уровне схемы
- **Эндпоинт статуса миграции** — `GET /metahub/:id/migrations/status` возвращает `{ migrationRequired, structureUpgradeRequired, templateUpgradeRequired, blockers: StructuredBlocker[] }`
- **Эндпоинт применения миграции** — `POST /metahub/:id/migrations/apply` с телом `{ cleanupMode: 'keep' }`

## Определение уровня серьёзности

Оба эндпоинта миграций (метахаб и приложение) используют общую утилиту `determineSeverity()` из `@universo/migration-guard-shared/utils`:

```typescript
import { determineSeverity } from '@universo/migration-guard-shared/utils'

// Метахаб: обновление структуры или блокировки → MANDATORY, только шаблон → RECOMMENDED
const severity = determineSeverity({
    migrationRequired,
    isMandatory: structureUpgradeRequired || blockers.length > 0
})

// Приложение: отсутствует схема или обновление структуры → MANDATORY, обновление публикации → RECOMMENDED
const severity = determineSeverity({
    migrationRequired,
    isMandatory: !schemaExists || structureUpgradeRequired
})
```

## Обновление существующих метахабов

Когда добавляется новая функциональность (новые системные таблицы, новые seed-данные), ранее созданные метахабы обновляются **автоматически** через два независимых механизма:

### Сценарий 1: Новые системные таблицы или колонки (DDL-изменения)

**Триггер**: `CURRENT_STRUCTURE_VERSION` увеличивается (например, 1 → N).

**Как это работает**: Когда любой API-вызов обращается к метахабу, вызывается `MetahubSchemaService.ensureSchema()`. Он считывает `structureVersion` ветки и сравнивает с `CURRENT_STRUCTURE_VERSION`. Если ветка отстаёт, запускается конвейер автомиграции:

```
ensureSchema() обнаруживает: branch.structureVersion (старее) < CURRENT (новее)
  → SystemTableMigrator.migrate(fromVersion, toVersion)
      → calculateSystemTableDiff(previous_tables, current_tables)
      → Применяются только АДДИТИВНЫЕ изменения (ADD_TABLE, ADD_COLUMN, ADD_INDEX, ADD_FK)
      → Миграция записывается в таблицу _mhb_migrations
  → branch.structureVersion = CURRENT_STRUCTURE_VERSION (сохраняется в БД)
```

**Гарантии безопасности**:
- Автоматически применяются только аддитивные изменения; деструктивные (DROP TABLE/COLUMN) логируются, но НИКОГДА не применяются
- Advisory locks PostgreSQL предотвращают конкурентные миграции одной и той же схемы
- Каждая миграция записывается в таблицу `_mhb_migrations` с полными метаданными
- Миграции выполняются в транзакции — частичные ошибки откатываются

### Сценарий 2: Новые seed-данные (обновления шаблонов)

**Триггер**: Версия манифеста шаблона увеличивается (например, `basic` шаблон 1.0.x → 1.0.y).

**Как это работает**: При запуске приложения `TemplateSeeder.seed()` обнаруживает изменение хеша и обновляет версию шаблона. При следующем вызове `ensureSchema()` для каждого метахаба запускается seed-миграция:

```
ensureSchema() обнаруживает: seed нуждается в миграции
  → TemplateSeedMigrator.migrateSeed(newSeed)
      → migrateLayouts()        — добавляет новые макеты по template_key (пропускает существующие)
      → migrateZoneWidgets()    — добавляет новые виджеты в новые макеты
      → migrateSettings()       — добавляет новые ключи настроек (пропускает существующие)
  → branch.seedVersion обновляется
```

**Ключевое поведение**: Добавляются только НОВЫЕ элементы. Существующие пользовательские настройки никогда не перезаписываются.

## Синхронизация приложений

Синхронизация схемы приложения выполняется в `applicationSyncRoutes.ts`:

- Захватывает advisory lock PostgreSQL (`app-sync:{applicationId}`) для предотвращения конкурентных синхронизаций
- Устанавливает `schema_status = MAINTENANCE` во время синхронизации (отображается как страница обслуживания для непривилегированных пользователей)
- Устанавливает `schema_status = SYNCED` при успехе, `ERROR` при ошибке
- Использует `persistPublishedWidgets()` и `persistPublishedLayouts()` для синхронизации данных виджетов/макетов
- Освобождает advisory lock в блоке `finally`
