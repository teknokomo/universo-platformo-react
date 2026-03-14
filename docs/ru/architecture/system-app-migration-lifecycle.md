---
description: Как схемы фиксированных системных приложений генерируются, обновляются и отслеживаются во время выполнения.
---

# Жизненный цикл миграций системных приложений

На этой странице описан жизненный цикл генерации, обновления и отслеживания
схем баз данных для четырёх фиксированных системных приложений: admin, profiles,
metahubs и applications.

## Обзор

Каждое фиксированное системное приложение декларирует целевую форму своей
схемы в TypeScript-манифесте (`SystemAppDefinition`). При запуске сервера
платформа сравнивает манифест с последним записанным снимком миграции в базе
данных и применяет только необходимые DDL-изменения. Это тот же движок
сравнения, который используется пользовательскими приложениями, публикуемыми
через метахабы.

## Ключевые компоненты

| Компонент                           | Пакет                            | Роль                                       |
|-------------------------------------|----------------------------------|--------------------------------------------|
| `SystemAppDefinition`               | `@universo/migrations-core`      | Типовой контракт для манифестов приложений  |
| `systemAppSchemaCompiler`           | `@universo/migrations-platform`  | Строит сущности из манифеста, вычисляет diff|
| `SchemaGenerator`                   | `@universo/schema-ddl`           | Создаёт схемы, таблицы, системные метаданные|
| `SchemaMigrator`                    | `@universo/schema-ddl`           | Вычисляет и применяет инкрементальные diff  |
| `MigrationManager`                  | `@universo/schema-ddl`           | Записывает миграции в `_app_migrations`     |
| `buildSchemaSnapshot`               | `@universo/schema-ddl`           | Строит структурный снимок из сущностей      |
| `calculateSchemaDiff`               | `@universo/schema-ddl`           | Вычисляет набор изменений между снимками    |

## Структура манифеста

`SystemAppDefinition` содержит:

- **`key`** — уникальный идентификатор (например, `admin`).
- **`schemaTarget`** — фиксированное имя схемы (например, `{ kind: 'fixed', schemaName: 'admin' }`).
- **`currentStorageModel` / `targetStorageModel`** — `'application_like'` для конвергентных приложений.
- **`currentBusinessTables` / `targetBusinessTables`** — массивы определений таблиц с полями, типами данных, FK-ссылками и значениями по умолчанию.
- **`currentStructureCapabilities` / `targetStructureCapabilities`** — флаги для системных таблиц (`_app_objects`, `_app_attributes`, `_app_migrations` и т.д.).
- **`migrations`** — SQL-записи миграций с маркерами `bootstrapPhase`.

## Последовательность начальной загрузки

Полная начальная загрузка выполняется внутри `initDatabase()` в `@universo/core-backend`:

```
1. validateRegisteredPlatformMigrations()
2. validateRegisteredSystemAppDefinitions()
3. validateRegisteredSystemAppSchemaGenerationPlans()
4. validateRegisteredSystemAppCompiledDefinitions()
5. runRegisteredPlatformPreludeMigrations()        ← pre_schema_generation SQL
6. ensureRegisteredSystemAppSchemaGenerationPlans() ← DDL на основе манифестов
7. runRegisteredPlatformPostSchemaMigrations()      ← post_schema_generation SQL
8. bootstrapRegisteredSystemAppStructureMetadata()  ← синхронизация _app_objects / _app_attributes
9. inspectLegacyFixedSchemaTables()                ← проверка отсутствия устаревших таблиц
10. inspectRegisteredSystemAppStructureMetadata()   ← проверка отпечатка метаданных
11. syncRegisteredPlatformDefinitionsToCatalog()    ← опциональная синхронизация с глобальным каталогом
```

## Движок сравнения

Движок сравнения поддерживает следующие типы изменений:

| Тип изменения           | Направление  | Пример                               |
|------------------------|--------------|--------------------------------------|
| `ADD_TABLE`            | Аддитивный   | Добавлена новая бизнес-таблица       |
| `DROP_TABLE`           | Деструктивный| Бизнес-таблица удалена               |
| `ADD_COLUMN`           | Аддитивный   | Новое поле добавлено в таблицу       |
| `DROP_COLUMN`          | Деструктивный| Поле удалено из таблицы              |
| `ALTER_COLUMN`         | Аддитивный   | Тип поля или значение по умолчанию изменены|
| `ADD_FK`               | Аддитивный   | Добавлено ограничение внешнего ключа |
| `DROP_FK`              | Деструктивный| Ограничение внешнего ключа удалено   |
| `ADD_TABULAR_TABLE`    | Аддитивный   | Дочерняя таблица для TABLE-атрибута  |
| `DROP_TABULAR_TABLE`   | Деструктивный| Дочерняя таблица удалена             |
| `ADD_TABULAR_COLUMN`   | Аддитивный   | Столбец в дочерней таблице добавлен  |
| `DROP_TABULAR_COLUMN`  | Деструктивный| Столбец в дочерней таблице удалён    |
| `ALTER_TABULAR_COLUMN` | Аддитивный   | Столбец в дочерней таблице изменён   |

Для системных приложений деструктивные изменения применяются автоматически
(`confirmedDestructive: true`), поскольку манифест является доверенным источником.

## Хранение миграций

Каждая схема системного приложения имеет собственную таблицу `_app_migrations`.
Таблица создаётся через `SchemaGenerator.ensureSystemTables()` при первой
начальной загрузке.

Запись миграции содержит:

```jsonc
{
  "name": "baseline_admin_structure_0_1_0",
  "meta": {
    "snapshotBefore": null,           // null для базовой миграции
    "snapshotAfter": { ... },         // полный SchemaSnapshot
    "changes": [ ... ],              // список изменений SchemaDiff
    "hasDestructive": false,
    "summary": "Initial schema creation with 6 table(s)"
  },
  "publication_snapshot": null        // всегда null для системных приложений
}
```

Последующие миграции обновления содержат ненулевой `snapshotBefore` и
конкретный список `changes`.

## Генерация синтетических сущностей

`targetBusinessTables` из манифеста преобразуются в `EntityDefinition[]`
функцией `buildSystemAppBusinessEntities()` в компиляторе схем. Эта функция:

1. Генерирует **детерминированные UUID** для сущностей и полей с помощью
   SHA-256 хешей вида `namespace:definitionKey:stage:kind:codename:tableName`.
2. Отображает типы бизнес-таблиц (`catalog`, `document`, `relation`, `settings`)
   на типы сущностей времени выполнения.
3. Создаёт синтетические объекты `presentation` для локализованных
   отображаемых имён.
4. Разрешает межтабличные FK-ссылки через `targetTableCodename`.

Результирующий `EntityDefinition[]` идентичен по структуре тому, что
производит конвейер публикации метахабов, что позволяет одним и тем же
`SchemaGenerator` и `SchemaMigrator` работать с обоими путями.

## Ensure vs. Apply

- **`ensureRegisteredSystemAppSchemaGenerationPlans()`** — точка входа при
  запуске. Проверяет текущее состояние базы данных и решает, следует ли
  применить полную базовую миграцию, инкрементальное обновление или пропустить.
- **`applyRegisteredSystemAppSchemaGenerationPlans()`** — всегда выполняет
  полную генерацию заново. Используется CLI-командой `system-app-schema-apply`
  и в сценариях сброса во время разработки.

## Связь с приложениями, публикуемыми через метахабы

Системные приложения и приложения, публикуемые через метахабы, используют
одни и те же инструменты DDL:

```
                    ┌─────────────────────────┐
                    │  SystemAppDefinition     │  ← TypeScript-манифест
                    │  (targetBusinessTables)  │
                    └───────────┬─────────────┘
                                │
                    buildSystemAppBusinessEntities()
                                │
                                ▼
                    ┌─────────────────────────┐
                    │    EntityDefinition[]    │  ← общий формат
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
     buildSchemaSnapshot()  calculateSchemaDiff()  SchemaGenerator
              │                 │                  │
              ▼                 ▼                  ▼
         SchemaSnapshot    SchemaDiff         DDL-выполнение
              │                 │                  │
              └─────────────────┼──────────────────┘
                                │
                    MigrationManager.recordMigration()
                                │
                                ▼
                       таблица _app_migrations
```

Приложения, публикуемые через метахабы, следуют тому же потоку, но
получают свои `EntityDefinition[]` из снимков публикаций, а не из
TypeScript-манифестов.

## Связанные страницы

- [Обновление схем системных приложений](../guides/updating-system-app-schemas.md)
- [Конвергенция фиксированных системных приложений](system-app-convergence.md)
- [Опциональный глобальный каталог](optional-global-catalog.md)
- [Проектирование базы данных](database.md)
