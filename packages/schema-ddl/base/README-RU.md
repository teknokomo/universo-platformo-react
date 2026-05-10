# @universo/schema-ddl

Общие DDL-утилиты (Data Definition Language) для управления схемами PostgreSQL.

## Обзор

Этот пакет предоставляет чистые функции и классы для динамического управления схемами PostgreSQL во время выполнения. Он был выделен из `metahubs-backend`, чтобы несколько пакетов могли переиспользовать код без циклических зависимостей.

## Ключевые возможности

- **Генерация схем**: создание схем PostgreSQL и таблиц из определений сущностей
- **Миграция схем**: вычисление и применение изменений схемы (аддитивных и деструктивных)
- **История миграций**: запись, просмотр и анализ миграций для безопасности отката
- **Чистые функции**: нейминг-утилиты, работающие без подключения к базе данных
- **Внедрение зависимостей**: все классы получают экземпляр Knex через конструктор
- **Поддержка транзакционных Catalog**: материализация системных колонок `recordBehavior` для нумерации, lifecycle, posting и сохранённых posting movements
- **Поддержка Ledger**: генерация стандартных таблиц `ledger` для append-only facts отдельно от generic row CRUD

## Установка

```bash
pnpm add @universo/schema-ddl
```

## Использование

### Базовое использование с фабричной функцией (рекомендуется)

```typescript
import { createDDLServices, generateSchemaName } from '@universo/schema-ddl'
import { KnexClient } from './your-knex-singleton'

const knex = KnexClient.getInstance()
const { generator, migrator, migrationManager } = createDDLServices(knex)

// Generate schema name from application ID
const schemaName = generateSchemaName(applicationId)

// Create schema
await generator.createSchema(schemaName)

// Calculate diff and apply changes
const diff = migrator.calculateDiff(oldSnapshot, newEntities)
if (diff.hasChanges) {
    await migrator.applyAllChanges(schemaName, diff, entities, confirmedDestructive)
}
```

### Чистые функции (база данных не требуется)

```typescript
import {
    generateSchemaName,
    generateTableName,
    generateColumnName,
    buildFkConstraintName,
    isValidSchemaName,
} from '@universo/schema-ddl'

// Generate schema name from application UUID
const schemaName = generateSchemaName('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
// -> 'app_a1b2c3d4e5f67890abcdef1234567890'

// Generate table name based on entity kind
const tableName = generateTableName('entity-uuid', 'catalog')
// -> 'cat_entityuuid'

// Validate schema name format
isValidSchemaName('app_abc123') // true
isValidSchemaName('invalid-name') // false
```

### Вычисление diff

```typescript
import { calculateSchemaDiff, ChangeType } from '@universo/schema-ddl'

const diff = calculateSchemaDiff(oldSnapshot, newEntities)

console.log(diff.summary) // "2 new table(s), 1 dropped column(s)"
console.log(diff.hasChanges) // true
console.log(diff.additive) // Non-destructive changes
console.log(diff.destructive) // Destructive changes requiring confirmation
```

### Transactional Catalogs и Ledgers

`SchemaGenerator` читает конфигурацию сущностей, включая `config.recordBehavior` и `config.ledger`, при материализации runtime schemas.
Catalogs с активным record behavior получают системные колонки для record number, effective date, lifecycle state, posting metadata и optimistic runtime safety.
Ledgers используют префикс таблиц `led_` и предназначены для append-only facts, posting movements и projection queries.

Operational Ledger facts являются runtime data.
Publication snapshots экспортируют Ledger metadata и configuration, но application release bundles не должны экспортировать operational facts как обычные seeded Catalog rows.

## Справочник API

### Чистые функции

| Function | Description |
|----------|-------------|
| `generateSchemaName(applicationId)` | Генерирует имя схемы PostgreSQL из UUID приложения |
| `generateTableName(entityId, kind)` | Генерирует имя таблицы с префиксом kind (cat_, hub_, doc_) |
| `generateColumnName(fieldId)` | Генерирует имя колонки с префиксом attr_ |
| `buildFkConstraintName(table, column)` | Генерирует имя FK-constraint |
| `isValidSchemaName(name)` | Валидирует формат имени схемы |
| `calculateSchemaDiff(old, new)` | Вычисляет изменения между снапшотами |
| `buildSchemaSnapshot(entities)` | Создаёт снапшот из определений сущностей |

### Классы

| Class | Description |
|-------|-------------|
| `SchemaGenerator` | Создаёт схемы, таблицы и системные метаданные |
| `SchemaMigrator` | Применяет изменения схемы с блокировками |
| `MigrationManager` | Записывает и перечисляет историю миграций |

### Фабричная функция

```typescript
createDDLServices(knex: Knex): {
    generator: SchemaGenerator,
    migrator: SchemaMigrator,
    migrationManager: MigrationManager
}
```

## Архитектура

Этот пакет использует паттерн **Dependency Injection**:

- Все классы получают экземпляр `Knex` через конструктор
- Внутри пакета нет singleton-ов или глобального состояния
- Потребляющий пакет (например, `metahubs-backend`) управляет жизненным циклом Knex

```
┌─────────────────────────┐
│   metahubs-backend      │
│   ┌─────────────────┐   │
│   │   KnexClient    │───┼──> Manages DB connection
│   └────────┬────────┘   │
│            │            │
│            ▼            │
│   createDDLServices(knex)
│            │            │
└────────────┼────────────┘
             │
             ▼
┌─────────────────────────┐
│   @universo/schema-ddl  │
│   ┌─────────────────┐   │
│   │ SchemaGenerator │   │
│   │ SchemaMigrator  │   │
│   │ MigrationManager│   │
│   └─────────────────┘   │
│   Pure functions        │
└─────────────────────────┘
```

## Тестирование

```bash
pnpm --filter @universo/schema-ddl test
```

## Связанные пакеты

- `metahubs-backend`: использует этот пакет для управления схемами publication
- `applications-backend`: использует этот пакет для операций на уровне application
