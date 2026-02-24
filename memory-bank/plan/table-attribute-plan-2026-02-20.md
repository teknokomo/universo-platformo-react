# План: Тип атрибута TABLE (Табличная часть) для Метахабов и Приложений

Дата: 2026-02-20
Обновлено: 2026-02-21 (QA Review v1, System Fields + Version Reset v2)
Режим: PLAN (без реализации)
Сложность: Level 4 (Major/Complex)

> **QA Review Status**: План обновлён по результатам QA-анализа и глубокого исследования кодовой базы.
> Все критические/мажорные проблемы задокументированы в [Приложение A: QA-анализ](#приложение-a-qa-анализ-и-корректировки-плана).
> Изменённые секции помечены тегом `[QA-FIX]`.

---

## Обзор

Добавить новый тип атрибута `TABLE` (аналог «Табличной части» 1С:Предприятие 8.x) в систему Метахабов.
Это позволит пользователям создавать вложенные табличные структуры внутри каталогов:
каждый атрибут типа TABLE содержит собственный набор дочерних атрибутов и хранит данные в отдельной
дочерней таблице (parent-child pattern).

**Ключевая аналогия**: Справочник «Контрагенты» → Табличная часть «Контактные лица»
(каждая строка — отдельная запись с полями: ФИО, Телефон, Email).

---

## Архитектурное решение

### Хранение данных — Дочерние таблицы (рекомендуемое)

Каждый атрибут типа TABLE получает **отдельную физическую таблицу** в application-схеме:

```
app_<uuid32>/
  cat_<catalog_uuid32>          ← родительская таблица каталога
  cat_<catalog_uuid32>_tp_<attr_uuid32>  ← дочерняя таблица табличной части
```

Почему не JSONB-массив:
- JSONB не поддерживает FK для REF-полей внутри табличной части
- Невозможна индексация отдельных колонок
- Сложнее фильтрация и аналитика
- Не масштабируется при большом количестве строк

### Иерархия атрибутов

В `_mhb_attributes` добавляется `parent_attribute_id`:

```
_mhb_attributes:
  id: uuid (PK)
  object_id: uuid (FK → _mhb_objects)
  parent_attribute_id: uuid NULLABLE (FK → _mhb_attributes самоссылка)
  codename: string
  data_type: string  ← 'TABLE' для родительского, обычные типы для дочерних
  ...
```

- Если `parent_attribute_id IS NULL` и `data_type = 'TABLE'` → это атрибут-контейнер табличной части
- Если `parent_attribute_id IS NOT NULL` → это дочерний атрибут внутри TABLE
- Дочерние атрибуты поддерживают все типы КРОМЕ TABLE (вложенные таблицы запрещены)

### Дочерняя таблица в runtime

```sql
CREATE TABLE "app_<uuid32>"."cat_<catalog_uuid32>_tp_<attr_uuid32>" (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
  _tp_parent_id UUID NOT NULL REFERENCES "app_<uuid32>"."cat_<catalog_uuid32>"(id) ON DELETE CASCADE,
  _tp_sort_order INTEGER NOT NULL DEFAULT 0,
  -- Дочерние атрибуты (attr_<child_uuid32>)
  attr_<child1_uuid32> TEXT,
  attr_<child2_uuid32> NUMERIC(10,0),
  ...
  -- System fields (полный набор _upl_* + _app_*)
);
CREATE INDEX ON ... (_tp_parent_id);
```

---

## Затрагиваемые области (файлы)

### Пакет `@universo/types` (1 файл)
- `packages/universo-types/base/src/common/metahubs.ts`

### Пакет `@universo/schema-ddl` (5 файлов)
- `packages/schema-ddl/base/src/naming.ts`
- `packages/schema-ddl/base/src/types.ts`
- `packages/schema-ddl/base/src/snapshot.ts`
- `packages/schema-ddl/base/src/diff.ts`
- `packages/schema-ddl/base/src/SchemaGenerator.ts`
- `packages/schema-ddl/base/src/SchemaMigrator.ts`

### Пакет `@universo/metahubs-backend` (6+ файлов)
- `systemTableDefinitions.ts` — добавить `parent_attribute_id`
- `MetahubAttributesService.ts` — CRUD дочерних атрибутов
- `attributesRoutes.ts` — роуты и Zod-схемы для TABLE
- `MetahubElementsService.ts` — валидация данных TABLE в предопределённых элементах
- `SnapshotSerializer.ts` — сериализация дочерних атрибутов
- `applicationSyncRoutes.ts` — создание дочерних таблиц, seed данных

### Пакет `@universo/metahubs-frontend` (2+ файла)
- `AttributeList.tsx` — UI контейнер для дочерних атрибутов
- `AttributeFormFields.tsx` — настройки TABLE (showTitle toggle)
- `ElementList.tsx` — inline TABLE в диалоге элемента

### Пакет `@universo/universo-template-mui` (1 файл)
- `DynamicEntityFormDialog.tsx` — рендеринг TABLE в диалогах

### Пакет `@universo/apps-template-mui` (4+ файла)
- `FormDialog.tsx` — runtime TABLE CRUD + динамический maxWidth `[QA-FIX]`
- `columns.tsx` — рендеринг TABLE в DataGrid (кол-во строк) + toFieldConfigs `[QA-FIX]`
- `useCrudDashboard.ts` — переиспользование для дочерних таблиц `[QA-FIX: критично]`
- `api/types.ts` — `appDataResponseSchema` Zod enum + `CrudDataAdapter` `[QA-FIX]`
- `api/TabularPartAdapter.ts` — **НОВЫЙ** adapter для дочерних таблиц `[QA-FIX]`
- `components/RuntimeTabularPartView.tsx` — **НОВЫЙ** view через useCrudDashboard `[QA-FIX]`

### Пакет `@universo/applications-backend` (1+ файл)
- `applicationsRoutes.ts` — RUNTIME_WRITABLE_TYPES + coerceRuntimeValue + resolveRuntimeCatalog + транзакции + soft-delete cascade `[QA-FIX: критично]`

### i18n (2 файла)
- EN/RU `metahubs.json` — ключи для TABLE

---

## Фаза 0: Контракт и терминология

- [ ] Зафиксировать термины: `TABLE` (атрибут-контейнер), `Tabular Part` (табличная часть), `Child Attribute` (дочерний атрибут)
- [ ] Утвердить контракт API:
  - `data_type: 'TABLE'`
  - `parent_attribute_id: string | null` в `_mhb_attributes`
  - `uiConfig.showTitle: boolean` (настройка TABLE)
- [ ] Утвердить ограничения:
  - Максимум **10 TABLE атрибутов** на каталог
  - Максимум **20 дочерних атрибутов** внутри TABLE
  - Запрет вложенных TABLE (maxDepth = 1)
  - Дочерние атрибуты поддерживают: STRING, NUMBER, BOOLEAN, DATE, REF, JSON (не TABLE)

---

## Фаза 1: Типы и shared-контракты (`@universo/types`)

### Шаг 1.1: Добавить TABLE в ATTRIBUTE_DATA_TYPES

**Файл**: `packages/universo-types/base/src/common/metahubs.ts` (строка 10)

```typescript
// BEFORE:
export const ATTRIBUTE_DATA_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON'] as const

// AFTER:
export const ATTRIBUTE_DATA_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'] as const
```

### Шаг 1.2: Расширить getDefaultValidationRules

```typescript
export function getDefaultValidationRules(dataType: AttributeDataType): Partial<AttributeValidationRules> {
    switch (dataType) {
        // ... existing cases ...
        case 'TABLE':
            return {} // TABLE has no validation rules — it's a container
        default:
            return {}
    }
}
```

### Шаг 1.3: Расширить getPhysicalDataType

```typescript
export function getPhysicalDataType(dataType: AttributeDataType, rules?: ...): PhysicalTypeInfo {
    switch (dataType) {
        // ... existing cases ...
        case 'TABLE':
            // TABLE is not a physical column — it's a virtual container
            return { type: 'TABLE', isVLC: false }
        default:
            return { type: 'TEXT', isVLC: false }
    }
}
```

### Шаг 1.4: Расширить MetaFieldDefinition

```typescript
export interface MetaFieldDefinition {
    id: string
    codename: string
    dataType: AttributeDataType
    isRequired: boolean
    isDisplayAttribute?: boolean
    targetEntityId?: string | null
    targetEntityKind?: MetaEntityKind | null
    presentation: MetaPresentation
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    /** Parent TABLE attribute ID (for child attributes of tabular parts) */
    parentAttributeId?: string | null
    /** Child fields for TABLE attributes (populated in snapshots) */
    childFields?: MetaFieldDefinition[]
}
```

### Шаг 1.5: Типы для TABLE-специфичной конфигурации

```typescript
/**
 * TABLE type UI configuration.
 * Controls how the tabular part is displayed.
 */
export interface TableTypeUiConfig {
    /** Whether to show the table title in element forms */
    showTitle?: boolean
}

/** Data types allowed as children inside TABLE attributes */
export const TABLE_CHILD_DATA_TYPES = ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON'] as const
export type TableChildDataType = (typeof TABLE_CHILD_DATA_TYPES)[number]
```

---

## Фаза 2: Schema DDL — именование, snapshot, diff, генерация

### Шаг 2.1: Добавить именование табличных частей (`naming.ts`)

**Файл**: `packages/schema-ddl/base/src/naming.ts`

```typescript
// ADD:
/**
 * Generates table name for a tabular part (TABLE attribute).
 * Convention: {parentTableName}_tp_{attributeUuid32}
 * Example: cat_abc123_tp_def456
 */
export const generateTabularTableName = (parentTableName: string, attributeId: string): string => {
    const cleanId = attributeId.replace(/-/g, '')
    return `${parentTableName}_tp_${cleanId}`
}
```

### Шаг 2.2: Расширить snapshot (`snapshot.ts`)

**Файл**: `packages/schema-ddl/base/src/snapshot.ts`

Дочерние атрибуты TABLE нужно включить в snapshot. Два подхода:

**Подход A (рекомендуемый)**: Дочерние атрибуты хранятся в `childFields` внутри поля TABLE.
Snapshot формат уже поддерживает `MetaFieldDefinition.childFields`, нужно добавить
их генерацию:

```typescript
export const buildSchemaSnapshot = (entities: EntityDefinition[]): SchemaSnapshot => {
    const snapshot: SchemaSnapshot = { /* ... existing ... */ }

    for (const entity of entities) {
        snapshot.entities[entity.id] = {
            kind: entity.kind,
            codename: entity.codename,
            tableName: generateTableName(entity.id, entity.kind),
            fields: {}
        }

        for (const field of entity.fields) {
            // Skip child fields at top level — they're nested inside TABLE parent
            if (field.parentAttributeId) continue

            snapshot.entities[entity.id].fields[field.id] = {
                codename: field.codename,
                columnName: field.dataType === 'TABLE'
                    ? generateTabularTableName(
                        generateTableName(entity.id, entity.kind),
                        field.id
                      )
                    : generateColumnName(field.id),
                dataType: field.dataType,
                isRequired: field.isRequired,
                targetEntityId: field.targetEntityId ?? null,
                targetEntityKind: field.targetEntityKind ?? null,
                // NEW: child fields for TABLE type
                ...(field.dataType === 'TABLE' && field.childFields ? {
                    childFields: Object.fromEntries(
                        field.childFields.map(child => [child.id, {
                            codename: child.codename,
                            columnName: generateColumnName(child.id),
                            dataType: child.dataType,
                            isRequired: child.isRequired,
                            targetEntityId: child.targetEntityId ?? null,
                            targetEntityKind: child.targetEntityKind ?? null
                        }])
                    )
                } : {})
            }
        }
    }

    return snapshot
}
```

### Шаг 2.2a: Сброс `CURRENT_SCHEMA_SNAPSHOT_VERSION` → 1

**Файл**: `packages/schema-ddl/base/src/snapshot.ts`

Текущее значение `CURRENT_SCHEMA_SNAPSHOT_VERSION = 3` было установлено при первом создании файла (d1a0c2e6) и никогда не инкрементировалось. Значение `3` было произвольным — нигде в коде нет логики проверки или миграции по версии snapshot. Число просто штампуется в `SchemaSnapshot.version` и записывается в `_app_migrations.meta`.

**Изменение**:
```typescript
// До:
export const CURRENT_SCHEMA_SNAPSHOT_VERSION = 3

// После:
export const CURRENT_SCHEMA_SNAPSHOT_VERSION = 1
```

**Тест** (`packages/schema-ddl/base/src/__tests__/snapshot.test.ts`): тест проверяет `toBeGreaterThan(0)` — значение `1` пройдёт без изменений.

**Обоснование**: БД будет удалена и пересоздана — legacy snapshot-ов в _app_migrations нет. Все версии начинаются с первых значений (structure version = 1, template version = 1.0.0, snapshot format = 1, schema snapshot version → 1).

### Шаг 2.3: Расширить SchemaFieldSnapshot (`types.ts`)

```typescript
export interface SchemaFieldSnapshot {
    codename: string
    columnName: string
    dataType: string
    isRequired: boolean
    targetEntityId: string | null
    targetEntityKind: string | null
    /** Child field snapshots for TABLE attributes */
    childFields?: Record<string, SchemaFieldSnapshot>
}
```

### Шаг 2.4: Расширить diff (`diff.ts`)

Необходимо добавить обработку изменений в дочерних таблицах:

```typescript
// NEW ChangeTypes:
export enum ChangeType {
    // ... existing ...
    ADD_TABULAR_TABLE = 'ADD_TABULAR_TABLE',      // Create child table for TABLE attr
    DROP_TABULAR_TABLE = 'DROP_TABULAR_TABLE',    // Drop child table
    ADD_TABULAR_COLUMN = 'ADD_TABULAR_COLUMN',    // Add column in child table
    DROP_TABULAR_COLUMN = 'DROP_TABULAR_COLUMN',  // Drop column from child table
    ALTER_TABULAR_COLUMN = 'ALTER_TABULAR_COLUMN' // Alter column in child table
}
```

В `calculateSchemaDiff()` добавить блок после обработки обычных полей:

```typescript
// Handle TABLE attributes (tabular parts)
for (const field of entity.fields) {
    if (field.dataType !== 'TABLE') continue
    const oldField = oldEntity.fields[field.id]

    if (!oldField) {
        // New TABLE attribute — create child table
        diff.additive.push({
            type: ChangeType.ADD_TABULAR_TABLE,
            entityId: entity.id,
            entityKind: entity.kind,
            tableName: generateTabularTableName(tableName, field.id),
            fieldId: field.id,
            fieldCodename: field.codename,
            isDestructive: false,
            description: `Create tabular table for "${field.codename}" in "${entity.codename}"`
        })
    } else if (oldField && oldField.dataType !== 'TABLE') {
        // Changed from non-TABLE to TABLE — destructive
        // (handled by existing ALTER_COLUMN detection)
    }

    // Compare child fields
    if (oldField?.dataType === 'TABLE' && oldField.childFields) {
        const newChildIds = new Set(
            (field.childFields ?? []).map(c => c.id)
        )
        const oldChildIds = new Set(Object.keys(oldField.childFields))
        const tabularTableName = generateTabularTableName(tableName, field.id)

        // New child columns
        for (const child of field.childFields ?? []) {
            if (!oldChildIds.has(child.id)) {
                diff.additive.push({
                    type: ChangeType.ADD_TABULAR_COLUMN,
                    entityId: entity.id,
                    tableName: tabularTableName,
                    fieldId: child.id,
                    fieldCodename: child.codename,
                    columnName: generateColumnName(child.id),
                    newValue: child.dataType,
                    isDestructive: false,
                    description: `Add column "${child.codename}" to tabular "${field.codename}"`
                })
            }
        }

        // Dropped child columns
        for (const oldChildId of oldChildIds) {
            if (!newChildIds.has(oldChildId)) {
                const oldChild = oldField.childFields[oldChildId]
                diff.destructive.push({
                    type: ChangeType.DROP_TABULAR_COLUMN,
                    entityId: entity.id,
                    tableName: tabularTableName,
                    fieldId: oldChildId,
                    fieldCodename: oldChild.codename,
                    columnName: oldChild.columnName,
                    isDestructive: true,
                    description: `Drop column "${oldChild.codename}" from tabular "${field.codename}"`
                })
            }
        }
    }
}

// Handle dropped TABLE attributes
for (const oldFieldId of oldFieldIds) {
    const oldField = oldEntity.fields[oldFieldId]
    if (oldField.dataType !== 'TABLE') continue
    if (!newFieldIds.has(oldFieldId)) {
        diff.destructive.push({
            type: ChangeType.DROP_TABULAR_TABLE,
            entityId: entity.id,
            tableName: generateTabularTableName(tableName, oldFieldId),
            fieldId: oldFieldId,
            fieldCodename: oldField.codename,
            isDestructive: true,
            description: `Drop tabular table "${oldField.codename}" from "${entity.codename}" (DATA WILL BE LOST)`
        })
    }
}
```

### Шаг 2.5: Расширить SchemaGenerator (`SchemaGenerator.ts`)

#### 2.5.1: Добавить mapDataType для TABLE

```typescript
public static mapDataType(dataType: AttributeDataType, rules?: Partial<AttributeValidationRules>): string {
    switch (dataType) {
        // ... existing cases ...
        case AttributeDataType.TABLE:
            // TABLE is not a physical column — it has a child table
            // This should never be called for TABLE type in column creation
            throw new Error('TABLE data type does not map to a column type')
        default:
            return 'TEXT'
    }
}
```

#### 2.5.2: Добавить createTabularTable

```typescript
/**
 * Creates a child table for a TABLE attribute (tabular part).
 * Convention: {parentTableName}_tp_{attrUuid32}
 */
public async createTabularTable(
    schemaName: string,
    entity: EntityDefinition,
    tableField: FieldDefinition,
    trx?: Knex.Transaction
): Promise<void> {
    const parentTableName = generateTableName(entity.id, entity.kind)
    const tabularTableName = generateTabularTableName(parentTableName, tableField.id)
    const childFields = tableField.childFields ?? []
    const knex = trx ?? this.knex

    console.log(`[SchemaGenerator] Creating tabular table: ${schemaName}.${tabularTableName}`)

    await knex.schema.withSchema(schemaName).createTable(tabularTableName, (table: Knex.CreateTableBuilder) => {
        table.uuid('id').primary().defaultTo(knex.raw('public.uuid_generate_v7()'))

        // Parent reference (CASCADE delete)
        table.uuid('_tp_parent_id').notNullable()
            .references('id')
            .inTable(`${schemaName}.${parentTableName}`)
            .onDelete('CASCADE')

        // Row ordering within parent
        table.integer('_tp_sort_order').notNullable().defaultTo(0)

        // Child attribute columns
        for (const child of childFields) {
            if (child.dataType === 'TABLE') {
                console.warn(`[SchemaGenerator] Skipping nested TABLE: ${child.codename}`)
                continue
            }
            const columnName = generateColumnName(child.id)
            const pgType = SchemaGenerator.mapDataType(
                child.dataType,
                child.validationRules as Partial<AttributeValidationRules> | undefined
            )
            if (child.isRequired) {
                table.specificType(columnName, pgType).notNullable()
            } else {
                const col = table.specificType(columnName, pgType).nullable()
                if (child.dataType === AttributeDataType.BOOLEAN) {
                    col.defaultTo(false)
                }
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // Platform-level system fields (_upl_*)
        // ═══════════════════════════════════════════════════════════════════════
        table.timestamp('_upl_created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
        table.uuid('_upl_created_by').nullable()
        table.timestamp('_upl_updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
        table.uuid('_upl_updated_by').nullable()
        table.integer('_upl_version').notNullable().defaultTo(1)
        // Archive fields
        table.boolean('_upl_archived').notNullable().defaultTo(false)
        table.timestamp('_upl_archived_at', { useTz: true }).nullable()
        table.uuid('_upl_archived_by').nullable()
        // Soft delete fields
        table.boolean('_upl_deleted').notNullable().defaultTo(false)
        table.timestamp('_upl_deleted_at', { useTz: true }).nullable()
        table.uuid('_upl_deleted_by').nullable()
        table.timestamp('_upl_purge_after', { useTz: true }).nullable()
        // Lock fields
        table.boolean('_upl_locked').notNullable().defaultTo(false)
        table.timestamp('_upl_locked_at', { useTz: true }).nullable()
        table.uuid('_upl_locked_by').nullable()
        table.text('_upl_locked_reason').nullable()

        // ═══════════════════════════════════════════════════════════════════════
        // Application-level system fields (_app_*)
        // ═══════════════════════════════════════════════════════════════════════
        // Publication status
        table.boolean('_app_published').notNullable().defaultTo(true)
        table.timestamp('_app_published_at', { useTz: true }).nullable()
        table.uuid('_app_published_by').nullable()
        // Archive fields
        table.boolean('_app_archived').notNullable().defaultTo(false)
        table.timestamp('_app_archived_at', { useTz: true }).nullable()
        table.uuid('_app_archived_by').nullable()
        // Soft delete fields
        table.boolean('_app_deleted').notNullable().defaultTo(false)
        table.timestamp('_app_deleted_at', { useTz: true }).nullable()
        table.uuid('_app_deleted_by').nullable()
        // Access control
        table.uuid('_app_owner_id').nullable()
        table.string('_app_access_level', 20).notNullable().defaultTo('private')
    })

    // Create indexes for system fields
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_${tabularTableName}_upl_deleted
        ON "${schemaName}"."${tabularTableName}" (_upl_deleted_at)
        WHERE _upl_deleted = true
    `)
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_${tabularTableName}_app_deleted
        ON "${schemaName}"."${tabularTableName}" (_app_deleted_at)
        WHERE _app_deleted = true
    `)

    // Index on parent ID for fast lookups
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_${tabularTableName}_parent
        ON "${schemaName}"."${tabularTableName}" (_tp_parent_id)
    `)

    // Index on sort order within parent
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_${tabularTableName}_parent_sort
        ON "${schemaName}"."${tabularTableName}" (_tp_parent_id, _tp_sort_order)
    `)

    console.log(`[SchemaGenerator] Tabular table ${schemaName}.${tabularTableName} created`)
}
```

**Важно**: Дочерние таблицы получают **полный набор системных полей** (`_upl_*` + `_app_*`), идентичный родительским entity-таблицам:
- Это обеспечивает единообразие SQL-запросов (все runtime queries фильтруют по `_app_deleted`)
- `CrudDataAdapter` / `useCrudDashboard` работают одинаково для parent и child таблиц
- Дефолтные значения (`_app_published=true`, `_app_archived=false`, `_app_access_level='private'`) достаточны — независимое управление этими статусами для дочерних строк не требуется

#### 2.5.3: Расширить generateFullSchema

```typescript
// В цикле создания таблиц, ПОСЛЕ createEntityTable:
for (const entity of entities) {
    if (entity.kind === ENUMERATION_KIND) continue
    await this.createEntityTable(schemaName, entity, trx)
    result.tablesCreated.push(entity.codename)

    // Create tabular part tables for TABLE attributes
    for (const field of entity.fields) {
        if (field.dataType === 'TABLE' && field.childFields?.length) {
            await this.createTabularTable(schemaName, entity, field, trx)
        }
    }
}
```

#### 2.5.4: Расширить createEntityTable — пропуск TABLE колонок

```typescript
// В createEntityTable, цикл user-defined fields:
for (const field of entity.fields) {
    // Skip TABLE attributes — they have child tables, not columns
    if (field.dataType === 'TABLE') continue
    // Skip child attributes — they belong to child tables
    if (field.parentAttributeId) continue

    const columnName = generateColumnName(field.id)
    // ... existing column creation ...
}
```

#### 2.5.5: Расширить addForeignKey — FK для дочерних REF

```typescript
// В generateFullSchema, после основного addForeignKey цикла:
for (const entity of entities) {
    for (const field of entity.fields) {
        if (field.dataType !== 'TABLE' || !field.childFields) continue
        for (const child of field.childFields) {
            if (child.dataType === AttributeDataType.REF && child.targetEntityId) {
                const parentTableName = generateTableName(entity.id, entity.kind)
                const tabularTableName = generateTabularTableName(parentTableName, field.id)
                // Create FK from child table column to target
                await this.addTabularForeignKey(schemaName, tabularTableName, child, entities, trx)
            }
        }
    }
}
```

### Шаг 2.6: Расширить SchemaMigrator

**`[QA-FIX: CRITICAL]`** Текущий `SchemaMigrator.applyChange()` для `ADD_FK` **жёстко задаёт**
`ON DELETE SET NULL` (строка ~L300). Для дочерних таблиц табличных частей FK `_tp_parent_id`
**должен** использовать `ON DELETE CASCADE`. Два подхода:

**Подход A (рекомендуемый)**: Параметризация `onDelete` в `SchemaChange`:
```typescript
// В types.ts — расширить SchemaChange:
export interface SchemaChange {
    // ... existing fields ...
    /** ON DELETE action for FK. Default: 'SET NULL'. Tabular parts use 'CASCADE'. */
    onDeleteAction?: 'SET NULL' | 'CASCADE' | 'RESTRICT' | 'NO ACTION'
}
```

```typescript
// В SchemaMigrator.applyChange() — заменить хардкод:
case ChangeType.ADD_FK: {
    const onDelete = change.onDeleteAction ?? 'SET NULL'
    await trx.raw(
        `ALTER TABLE ??.?? ADD CONSTRAINT ?? FOREIGN KEY (??) REFERENCES ??.??(id) ON DELETE ${onDelete}`,
        [schemaName, change.tableName, constraintName, columnName, schemaName, targetTableName]
    )
    break
}
```

**Подход B**: Новый `ChangeType.ADD_CASCADE_FK` (менее гибкий, но не ломает API).

В `diff.ts`: при генерации `ADD_FK` для `_tp_parent_id` устанавливать `onDeleteAction: 'CASCADE'`.

Добавить обработку новых ChangeType в `applyChange()`:

```typescript
case ChangeType.ADD_TABULAR_TABLE: {
    const entity = entities.find(item => item.id === change.entityId)
    if (!entity) throw new Error(`Entity ${change.entityId} not found`)
    const tableField = entity.fields.find(f => f.id === change.fieldId)
    if (!tableField) throw new Error(`TABLE field ${change.fieldId} not found`)
    await this.generator.createTabularTable(schemaName, entity, tableField, trx)
    break
}

case ChangeType.DROP_TABULAR_TABLE: {
    await trx.schema.withSchema(schemaName).dropTableIfExists(change.tableName!)
    break
}

case ChangeType.ADD_TABULAR_COLUMN: {
    // Similar to ADD_COLUMN but finds field in childFields
    const entity = entities.find(item => item.id === change.entityId)
    if (!entity) throw new Error(`Entity ${change.entityId} not found`)
    // Find the child field across all TABLE fields
    let childField: FieldDefinition | undefined
    for (const f of entity.fields) {
        if (f.dataType === 'TABLE' && f.childFields) {
            childField = f.childFields.find(c => c.id === change.fieldId)
            if (childField) break
        }
    }
    if (!childField) throw new Error(`Child field ${change.fieldId} not found`)

    const pgType = SchemaGenerator.mapDataType(
        childField.dataType,
        childField.validationRules as Partial<AttributeValidationRules> | undefined
    )
    await trx.schema.withSchema(schemaName).alterTable(change.tableName!, (table) => {
        const col = table.specificType(change.columnName!, pgType).nullable()
        if (childField!.dataType === AttributeDataType.BOOLEAN) {
            col.defaultTo(false)
        }
    })
    break
}

case ChangeType.DROP_TABULAR_COLUMN: {
    await trx.schema.withSchema(schemaName).alterTable(change.tableName!, (table) => {
        table.dropColumn(change.columnName!)
    })
    break
}
```

Расширить `orderChangesForApply`:

**`[QA-FIX: MEDIUM]`** Текущий `orderChangesForApply()` использует flat-ранги (ADD_TABLE=10,
ADD_COLUMN=20, ADD_FK=40...). Для TABLE нужно гарантировать, что:
1. Parent table создаётся ПЕРЕД child table
2. `ADD_TABULAR_TABLE` идёт ПОСЛЕ `ADD_TABLE` того же entity
3. `DROP_TABULAR_TABLE` идёт ПЕРЕД `DROP_TABLE` parent entity

```typescript
// Destructive:
case ChangeType.DROP_TABULAR_COLUMN: return 15  // Before DROP_COLUMN
case ChangeType.DROP_TABULAR_TABLE: return 35    // Before DROP_TABLE

// Additive:
case ChangeType.ADD_TABULAR_TABLE: return 15     // After ADD_TABLE
case ChangeType.ADD_TABULAR_COLUMN: return 25    // After ADD_COLUMN
```

**Дополнительно**: Внутри одного ранга необходим вторичный порядок по `entityId`,
чтобы parent entity обрабатывался раньше дочерних таблиц того же entity.

---

## Фаза 3: Backend Metahubs — системные таблицы и сервисы

### Шаг 3.1: Добавить parent_attribute_id в _mhb_attributes

**Файл**: `systemTableDefinitions.ts`

```typescript
const mhbAttributes: SystemTableDef = {
    name: '_mhb_attributes',
    description: 'Field definitions for objects',
    columns: [
        // ... existing columns ...
        { name: 'target_object_kind', type: 'string', length: 20, nullable: true },
        // NEW:
        { name: 'parent_attribute_id', type: 'uuid', nullable: true }
    ],
    foreignKeys: [
        { column: 'object_id', referencesTable: '_mhb_objects', referencesColumn: 'id', onDelete: 'CASCADE' },
        // NEW: self-reference for child attributes
        { column: 'parent_attribute_id', referencesTable: '_mhb_attributes', referencesColumn: 'id', onDelete: 'CASCADE' }
    ],
    indexes: [
        // ... existing indexes ...
        // NEW index for child attribute lookup
        { name: 'idx_mhb_attributes_parent_attribute_id', columns: ['parent_attribute_id'] }
    ]
}
```

**Примечание**: Необходима также миграция `_app_attributes` для добавления `parent_attribute_id`:

В `SchemaGenerator.ensureSystemTables()`, таблица `_app_attributes` должна включить:
```typescript
{ name: 'parent_attribute_id', type: 'uuid', nullable: true }
```

### Шаг 3.2: Расширить MetahubAttributesService

**Файл**: `MetahubAttributesService.ts`

#### 3.2.1: create() — поддержка parent_attribute_id

```typescript
async create(metahubId: string, objectId: string, data: CreateAttributeData): Promise<AttributeRow> {
    const schemaName = generateMetahubSchemaName(metahubId)

    // Validate parent attribute if specified
    if (data.parentAttributeId) {
        const parent = await this.findById(metahubId, objectId, data.parentAttributeId)
        if (!parent) {
            throw new Error(`Parent attribute ${data.parentAttributeId} not found`)
        }
        if (parent.dataType !== 'TABLE') {
            throw new Error(`Parent attribute must be TABLE type, got ${parent.dataType}`)
        }
        // Nested TABLE check
        if (data.dataType === 'TABLE') {
            throw new Error('Nested TABLE attributes are not allowed')
        }
        // Check child count limit (max 20)
        const childCount = await this.countChildAttributes(metahubId, objectId, data.parentAttributeId)
        if (childCount >= 20) {
            throw new Error('Maximum 20 child attributes per TABLE')
        }
    }

    // If creating a TABLE attribute, check TABLE count limit (max 10)
    if (data.dataType === 'TABLE') {
        const tableCount = await this.countTableAttributes(metahubId, objectId)
        if (tableCount >= 10) {
            throw new Error('Maximum 10 TABLE attributes per catalog')
        }
    }

    // ... existing create logic with parent_attribute_id in INSERT ...
}
```

#### 3.2.2: findAll() — разделение root/child атрибутов

```typescript
/** Returns only root-level attributes (parentAttributeId IS NULL) */
async findAll(metahubId: string, objectId: string): Promise<AttributeRow[]> {
    // ... existing query + WHERE parent_attribute_id IS NULL ...
}

/** Returns child attributes of a TABLE attribute */
async findChildAttributes(metahubId: string, objectId: string, parentAttributeId: string): Promise<AttributeRow[]> {
    const schemaName = generateMetahubSchemaName(metahubId)
    const knex = KnexClient.getInstance()

    const rows = await knex
        .withSchema(schemaName)
        .select('*')
        .from('_mhb_attributes')
        .where({
            object_id: objectId,
            parent_attribute_id: parentAttributeId,
            _upl_deleted: false,
            _mhb_deleted: false
        })
        .orderBy('sort_order', 'asc')

    return rows.map(this.mapRowToAttribute)
}

/** Returns ALL attributes (root + child) for snapshot/sync purposes */
async findAllFlat(metahubId: string, objectId: string): Promise<AttributeRow[]> {
    // ... query without parent_attribute_id filter ...
}
```

#### 3.2.3: TABLE — запретить isDisplayAttribute

```typescript
async setDisplayAttribute(metahubId: string, objectId: string, attributeId: string): Promise<void> {
    const attribute = await this.findById(metahubId, objectId, attributeId)
    if (!attribute) throw new Error('Attribute not found')

    // TABLE attributes cannot be display attributes
    if (attribute.dataType === 'TABLE') {
        throw new Error('TABLE attributes cannot be set as display attribute')
    }
    // Child attributes cannot be display attributes
    if (attribute.parentAttributeId) {
        throw new Error('Child attributes of TABLE cannot be set as display attribute')
    }

    // ... existing logic ...
}
```

### Шаг 3.3: Расширить attributesRoutes.ts — Zod-схемы

```typescript
const createAttributeSchema = z.object({
    codename: z.string().min(1).max(100),
    dataType: z.enum(ATTRIBUTE_DATA_TYPES),
    // ... existing fields ...
    // NEW:
    parentAttributeId: z.string().uuid().nullish()
})
```

Добавить дополнительные эндпоинты:

```typescript
// GET /catalog/:objectId/attributes/:attributeId/children
// Returns child attributes of a TABLE attribute
router.get('/:objectId/attributes/:attributeId/children', async (req, res) => {
    const { objectId, attributeId } = req.params
    const children = await attributesService.findChildAttributes(metahubId, objectId, attributeId)
    res.json({ items: children, total: children.length })
})

// POST /catalog/:objectId/attributes/:attributeId/children
// Create a child attribute inside TABLE
router.post('/:objectId/attributes/:attributeId/children', async (req, res) => {
    const { objectId, attributeId } = req.params
    const data = createChildAttributeSchema.parse({
        ...req.body,
        parentAttributeId: attributeId
    })
    // Validate parent is TABLE type
    // ... create child attribute ...
})
```

Валидация: TABLE атрибуты не требуют target_object_id:

```typescript
// В validate route:
if (data.dataType === 'TABLE') {
    // TABLE has no target_object_id, no validation_rules
    // TABLE is always NOT required (presence is structural, not data-level)
    data.isRequired = false
    data.targetObjectId = null
    data.targetObjectKind = null
}
```

### Шаг 3.4: Расширить delete — каскадное удаление

При удалении TABLE-атрибута каскадно удаляются все дочерние атрибуты:

```typescript
async deleteAttribute(metahubId: string, objectId: string, attributeId: string): Promise<void> {
    const attribute = await this.findById(metahubId, objectId, attributeId)

    // If TABLE type, soft-delete all children first
    if (attribute.dataType === 'TABLE') {
        await this.softDeleteChildAttributes(metahubId, objectId, attributeId)
    }

    // ... existing soft-delete logic ...
}
```

FK с `ON DELETE CASCADE` в `_mhb_attributes(parent_attribute_id)` обеспечит каскад,
но для soft-delete нужно явно обрабатывать дочерние записи.

---

## Фаза 4: Backend — Предопределённые элементы и TABLE

### Шаг 4.1: Расширить MetahubElementsService.validateElementData

**Файл**: `MetahubElementsService.ts`

TABLE данные в предопределённых элементах хранятся как JSONB-массив в `data`:

```typescript
// Формат data в _mhb_elements:
{
    "name": "Иванов И.И.",        // STRING attr
    "contacts": [                  // TABLE attr (codename: "contacts")
        {
            "phone": "+7-999-123-4567",
            "email": "ivanov@mail.ru",
            "_tp_sort_order": 0
        },
        {
            "phone": "+7-999-765-4321",
            "email": "ivanov2@mail.ru",
            "_tp_sort_order": 1
        }
    ]
}
```

```typescript
async validateElementData(
    metahubId: string,
    objectId: string,
    data: Record<string, unknown>,
    attributes: AttributeRow[]
): Promise<void> {
    const rootAttributes = attributes.filter(a => !a.parentAttributeId)

    for (const attr of rootAttributes) {
        const value = data[attr.codename]

        if (attr.dataType === 'TABLE') {
            // TABLE value must be array or undefined
            if (value !== undefined && value !== null) {
                if (!Array.isArray(value)) {
                    throw new Error(`Attribute "${attr.codename}" (TABLE) must be an array`)
                }
                // Validate each row against child attributes
                const childAttrs = attributes.filter(a => a.parentAttributeId === attr.id)
                for (const row of value) {
                    if (typeof row !== 'object' || row === null) {
                        throw new Error(`Each row in TABLE "${attr.codename}" must be an object`)
                    }
                    for (const child of childAttrs) {
                        const childValue = (row as Record<string, unknown>)[child.codename]
                        if (child.isRequired && (childValue === null || childValue === undefined)) {
                            throw new Error(`Required child attribute "${child.codename}" missing in TABLE "${attr.codename}"`)
                        }
                        if (childValue !== null && childValue !== undefined) {
                            this.validateType(child.dataType, childValue, child.codename)
                        }
                    }
                }
            }
            continue
        }

        // ... existing validation for other types ...
    }
}
```

---

## Фаза 5: Backend — Snapshot и Sync для TABLE

### Шаг 5.1: Расширить SnapshotSerializer

**Файл**: `SnapshotSerializer.ts`

В `serializeMetahub()`, при сборке `fields` для каждого каталога:

```typescript
// Загрузить ВСЕ атрибуты (root + child) для объекта
const allAttributes = await this.attributesService.findAllFlat(metahubId, catalog.id)
const rootAttributes = allAttributes.filter(a => !a.parentAttributeId)
const childAttributesByParent = new Map<string, typeof allAttributes>()

for (const attr of allAttributes) {
    if (attr.parentAttributeId) {
        const list = childAttributesByParent.get(attr.parentAttributeId) ?? []
        list.push(attr)
        childAttributesByParent.set(attr.parentAttributeId, list)
    }
}

entities[catalog.id] = {
    // ... existing ...
    fields: rootAttributes.map(attr => ({
        id: attr.id,
        codename: attr.codename,
        dataType: attr.dataType,
        isRequired: attr.isRequired,
        isDisplayAttribute: attr.isDisplayAttribute ?? false,
        targetEntityId: attr.targetEntityId ?? undefined,
        targetEntityKind: attr.targetEntityKind ?? undefined,
        presentation: { name: attr.name || {}, description: attr.description || {} },
        validationRules: (attr.validationRules || {}) as any,
        uiConfig: (attr.uiConfig || {}) as any,
        sortOrder: attr.sortOrder,
        // NEW: child fields for TABLE type
        ...(attr.dataType === 'TABLE' ? {
            childFields: (childAttributesByParent.get(attr.id) ?? []).map(child => ({
                id: child.id,
                codename: child.codename,
                dataType: child.dataType,
                isRequired: child.isRequired,
                targetEntityId: child.targetEntityId ?? undefined,
                targetEntityKind: child.targetEntityKind ?? undefined,
                presentation: { name: child.name || {}, description: child.description || {} },
                validationRules: (child.validationRules || {}) as any,
                uiConfig: (child.uiConfig || {}) as any,
                sortOrder: child.sortOrder,
                parentAttributeId: attr.id
            }))
        } : {})
    }))
}
```

В `deserializeSnapshot()`: восстановить `childFields` из snapshot-формата.

В `normalizeSnapshotForHash()`: включить `childFields` в hash-расчёт.

### Шаг 5.2: Расширить applicationSyncRoutes — создание дочерних таблиц

В `applicationSyncRoutes.ts`, при вызове `SchemaGenerator.generateFullSchema()`:

EntityDefinition передаются с `childFields` внутри TABLE-атрибутов.
`generateFullSchema()` вызывает `createTabularTable()` для каждого TABLE-поля.

### Шаг 5.2a: `[QA-FIX: MAJOR]` Расширить syncSystemMetadata для дочерних таблиц

**Проблема**: `syncSystemMetadata()` в `SchemaGenerator.ts` записывает атрибуты в `_app_attributes`
через `entity.fields.map(...)` — только flat-список. Дочерние атрибуты TABLE НЕ попадут в
`_app_attributes` автоматически, а `resolveRuntimeCatalog()` (applications-backend) загружает
атрибуты именно из `_app_attributes WHERE object_id = catalog.id`.

**Решение**: В `syncSystemMetadata()` нужно:
1. Собирать ВСЕ атрибуты (root + child) через `entity.fields.flatMap()`
2. Дочерние атрибуты TABLE-поля записывать в `_app_attributes` с `parent_attribute_id`
3. Для TABLE-атрибута `column_name` = имя дочерней таблицы (не физическая колонка)

```typescript
// В syncSystemMetadata:
const attributeRows = entities.flatMap((entity) =>
    entity.fields.flatMap((field) => {
        const rows = [{
            id: field.id,
            object_id: entity.id,
            codename: field.codename,
            sort_order: field.sortOrder ?? 0,
            column_name: field.dataType === 'TABLE'
                ? generateTabularTableName(generateTableName(entity.id, entity.kind), field.id)
                : generateColumnName(field.id),
            data_type: field.dataType,
            is_required: field.isRequired,
            parent_attribute_id: field.parentAttributeId ?? null,
            target_object_id: field.targetEntityId ?? null,
            target_object_kind: field.targetEntityKind ?? null,
            // ... rest of fields ...
        }]

        // Add child fields for TABLE attributes
        if (field.dataType === 'TABLE' && field.childFields) {
            for (const child of field.childFields) {
                rows.push({
                    id: child.id,
                    object_id: entity.id,
                    codename: child.codename,
                    sort_order: child.sortOrder ?? 0,
                    column_name: generateColumnName(child.id),
                    data_type: child.dataType,
                    is_required: child.isRequired,
                    parent_attribute_id: field.id,  // ← parent TABLE attribute
                    target_object_id: child.targetEntityId ?? null,
                    target_object_kind: child.targetEntityKind ?? null,
                    // ... rest of fields ...
                })
            }
        }

        return rows
    })
)
```

**Важно**: Также необходимо добавить `parent_attribute_id` в DDL таблицы `_app_attributes`
(в `ensureSystemTables()` в SchemaGenerator.ts). Текущий DDL НЕ содержит этой колонки.
Нужно добавить:
```typescript
table.uuid('parent_attribute_id').nullable()
    .references('id').inTable(`${schemaName}._app_attributes`).onDelete('CASCADE')
```

И добавить `parent_attribute_id` в массив `onConflict merge` columns.

### Шаг 5.2b: `[QA-FIX: CRITICAL]` Расширить resolveRuntimeCatalog для дочерних атрибутов

**Проблема**: `resolveRuntimeCatalog()` в `applicationsRoutes.ts` загружает атрибуты запросом:
```sql
SELECT ... FROM {schema}._app_attributes WHERE object_id = $1
```
Это вернёт ВСЕ атрибуты (root + child), но код не различает их. Для TABLE нужно:
1. Разделить root и child атрибуты по `parent_attribute_id`
2. Группировать child атрибуты по parent
3. Обогатить API-ответ дочерними полями для TABLE-колонок

```typescript
// resolveRuntimeCatalog — дополнение:
const allAttrs = await manager.query(
    `SELECT id, codename, column_name, data_type, is_required, validation_rules,
            target_object_id, target_object_kind, ui_config, parent_attribute_id
     FROM ${schemaIdent}._app_attributes
     WHERE object_id = $1
       AND COALESCE(_upl_deleted, false) = false
       AND COALESCE(_app_deleted, false) = false`,
    [catalog.id]
)

const rootAttrs = allAttrs.filter(a => !a.parent_attribute_id)
const childByParent = new Map<string, typeof allAttrs>()
for (const attr of allAttrs) {
    if (attr.parent_attribute_id) {
        const list = childByParent.get(attr.parent_attribute_id) ?? []
        list.push(attr)
        childByParent.set(attr.parent_attribute_id, list)
    }
}

// При формировании columns для ответа:
const columns = rootAttrs.map(attr => ({
    ...mapAttrToColumn(attr),
    ...(attr.data_type === 'TABLE' ? {
        childColumns: (childByParent.get(attr.id) ?? []).map(mapAttrToColumn)
    } : {})
}))
```

### Шаг 5.3: Расширить seedPredefinedElements — TABLE данные

**`[QA-FIX: MEDIUM]`** `seedPredefinedElements()` использует `fieldByCodename` Map для маппинга
`codename → columnName`. Обработка значений полей (VLC, JSON, NUMBER, REF) идёт через
`prepareJsonbValue()`, `validateNumericValue()`, `normalizeReferenceId()`. Вложенные структуры
не поддерживаются — каждый element является плоской строкой.

**Решение**: После INSERT/MERGE основной строки, нужен отдельный блок для TABLE-данных:

```typescript
async function seedPredefinedElements(schemaName, snapshot, entities, userId) {
    // ... existing logic ...

    for (const objectId of catalogOrder) {
        // ... existing element loop ...

        for (const element of validElements) {
            // Insert main row (existing logic)
            await trx.withSchema(schemaName).table(tableName).insert(mainRow).onConflict('id').merge(mergeColumns)

            // Seed TABLE child rows
            for (const field of entity.fields) {
                if (field.dataType !== 'TABLE' || !field.childFields?.length) continue

                const tableData = (element.data as Record<string, unknown>)?.[field.codename]
                if (!Array.isArray(tableData) || tableData.length === 0) continue

                const tabularTableName = generateTabularTableName(tableName, field.id)
                const childFieldMap = new Map(
                    field.childFields.map(c => [c.codename, { columnName: generateColumnName(c.id), field: c }])
                )

                const childRows = tableData.map((rowData, index) => {
                    const row: Record<string, unknown> = {
                        id: knex.raw('public.uuid_generate_v7()'),
                        _tp_parent_id: element.id,
                        _tp_sort_order: (rowData as any)._tp_sort_order ?? index,
                        _upl_created_at: now,
                        _upl_created_by: userId ?? null,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null
                    }
                    for (const [codename, { columnName, field: childField }] of childFieldMap) {
                        const value = (rowData as Record<string, unknown>)[codename]
                        // Apply same type-specific handling as parent seed logic
                        row[columnName] = normalizeFieldValue(value, childField)
                    }
                    return row
                })

                if (childRows.length > 0) {
                    // Delete existing child rows for this parent (re-seed pattern)
                    await trx.withSchema(schemaName).table(tabularTableName)
                        .where('_tp_parent_id', element.id)
                        .del()
                    await trx.withSchema(schemaName).table(tabularTableName).insert(childRows)
                }
            }
        }
    }
}
```

---

## Фаза 6: Frontend Metahubs — Атрибуты и Элементы

### Шаг 6.1: AttributeList.tsx — добавить TABLE тип

**`[QA-FIX: MEDIUM]`** Конкретные изменения в `AttributeActions.tsx`:

```typescript
// В dataTypeOptions добавить:
{ value: 'TABLE', label: t('attributes.dataTypes.table'), icon: <TableRowsIcon /> }

// В getDataTypeColor добавить:
case 'TABLE': return theme.palette.info.main  // синий цвет для TABLE

// В AttributeActions.tsx — скрыть "Set as Display Attribute" для TABLE и child:
// Найти menuItem с action 'set-display-attribute' и добавить условие:
{attribute.dataType !== 'TABLE' && !attribute.parentAttributeId && (
    <MenuItem onClick={() => handleAction('set-display-attribute')}>
        {t('attributes.actions.setDisplayAttribute')}
    </MenuItem>
)}
```

**Также**: фильтровать root/child атрибуты в list query. `findAll()` должен
возвращать только `WHERE parent_attribute_id IS NULL` для основного списка.

### Шаг 6.2: AttributeList.tsx — контейнер дочерних атрибутов

**`[QA-FIX: MAJOR]`** FlowListTable (`universo-template-mui`) **НЕ поддерживает** expandable rows,
detail panels или вставку контента между строками. Это тонкая обёртка над MUI `<Table>`
со встроенной сортировкой и фильтрацией.

**Решение**: Вместо модификации FlowListTable, использовать отдельный UI-паттерн:

**Вариант A (рекомендуемый)**: Expand TABLE-атрибутов через отдельный `Collapse` ПОД таблицей
(или через кнопку, открывающую inline-секцию). AttributeList.tsx использует `customColumns`
prop FlowListTable — можно добавить кнопку expand в action-колонку, а дочерний список
рендерить в Collapse-блоке ПОД FlowListTable (не внутри TableRow).

```tsx
// В AttributeList.tsx — ПОД <FlowListTable>:
<FlowListTable
    data={rootAttributes}
    customColumns={customColumns}
    renderActions={(row) => (
        <>
            {row.dataType === 'TABLE' && (
                <IconButton
                    size="small"
                    onClick={() => toggleExpand(row.id)}
                >
                    {expandedTableId === row.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
            )}
            {/* existing actions */}
        </>
    )}
/>

{/* Child attributes panel BELOW FlowListTable */}
{expandedTableId && (
    <Collapse in={!!expandedTableId}>
        <Paper variant="outlined" sx={{ ml: 4, mt: 1, p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                {t('attributes.childAttributes')} — {expandedTableAttr?.codename}
            </Typography>
            <ChildAttributeList
                metahubId={metahubId}
                objectId={objectId}
                parentAttributeId={expandedTableId}
                onRefresh={handleRefresh}
            />
        </Paper>
    </Collapse>
)}
```

**Вариант B**: Заменить FlowListTable на DataGrid с `getDetailPanelContent` (MUI X Pro).
Отклонён: DataGrid Pro — платный; текущий код использует бесплатный DataGrid.

### Шаг 6.3: AttributeFormFields.tsx — настройки TABLE

```tsx
// В renderTypeSettings добавить case 'TABLE':
case 'TABLE':
    return (
        <Box>
            <FormControlLabel
                control={
                    <Switch
                        checked={uiConfig?.showTitle ?? true}
                        onChange={(e) => onUiConfigChange({ ...uiConfig, showTitle: e.target.checked })}
                    />
                }
                label={t('attributes.tableSettings.showTitle')}
            />
            <Alert severity="info" sx={{ mt: 1 }}>
                {t('attributes.tableSettings.hint')}
            </Alert>
        </Box>
    )
```

### Шаг 6.4: ElementList.tsx — TABLE данные в диалоге элемента

**`[QA-FIX: MAJOR]`** Вместо `CompactListTable` + `InlineEditableCell` (новых кастомных компонентов)
использовать **MUI DataGrid с `editable: true`** — паттерн, уже применяемый
в `apps-template-mui` для runtime CRUD. Это обеспечивает:
- Единообразие UX метахаб-дизайнера и runtime-приложения
- Готовую инфраструктуру inline-редактирования через `processRowUpdate`
- Валидацию типов через `preProcessEditCellProps`

В `DynamicEntityFormDialog` для TABLE-полей:

```tsx
// В renderField override:
if (fieldConfig.type === 'TABLE') {
    return (
        <TabularPartEditor
            label={fieldConfig.label}
            value={(formData[fieldConfig.name] as unknown[]) ?? []}
            onChange={(rows) => setFormData(prev => ({ ...prev, [fieldConfig.name]: rows }))}
            childFields={fieldConfig.childFields}
            showTitle={fieldConfig.uiConfig?.showTitle ?? true}
        />
    )
}
```

Компонент `TabularPartEditor` (новый, в `metahubs-frontend` или `universo-template-mui`):

```tsx
import { DataGrid, GridColDef } from '@mui/x-data-grid'

interface TabularPartEditorProps {
    label: string
    value: Record<string, unknown>[]
    onChange: (rows: Record<string, unknown>[]) => void
    childFields: DynamicFieldConfig[]
    showTitle?: boolean
    maxRows?: number
}

const TabularPartEditor: React.FC<TabularPartEditorProps> = ({
    label, value, onChange, childFields, showTitle = true, maxRows = 999
}) => {
    const { t } = useTranslation('metahubs')

    // Convert childFields to DataGrid columns with editable: true
    const columns: GridColDef[] = [
        ...childFields.map(f => ({
            field: f.name,
            headerName: f.label,
            editable: true,
            flex: 1,
            type: mapFieldTypeToGridType(f.type), // STRING→string, NUMBER→number, BOOLEAN→boolean, DATE→date
        })),
        {
            field: 'actions',
            headerName: '',
            width: 60,
            sortable: false,
            renderCell: (params) => (
                <IconButton size="small" onClick={() => handleDeleteRow(params.row._rowIndex)}>
                    <DeleteOutlineIcon fontSize="small" />
                </IconButton>
            )
        }
    ]

    // Add temporary _rowIndex for local state management
    const rows = value.map((row, index) => ({
        ...row,
        id: row.id ?? `temp-${index}`,
        _rowIndex: index,
        _tp_sort_order: (row._tp_sort_order as number) ?? index
    }))

    const handleAddRow = () => {
        const newRow: Record<string, unknown> = { _tp_sort_order: value.length }
        for (const field of childFields) {
            newRow[field.name] = field.defaultValue ?? null
        }
        onChange([...value, newRow])
    }

    const handleDeleteRow = (index: number) => {
        onChange(value.filter((_, i) => i !== index))
    }

    const processRowUpdate = (newRow: any) => {
        const updated = [...value]
        updated[newRow._rowIndex] = { ...updated[newRow._rowIndex], ...newRow }
        onChange(updated)
        return newRow
    }

    return (
        <Box>
            {showTitle && (
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{label}</Typography>
            )}
            <DataGrid
                rows={rows}
                columns={columns}
                processRowUpdate={processRowUpdate}
                hideFooter
                autoHeight
                density="compact"
                disableColumnMenu
                sx={{ maxHeight: 300, '& .MuiDataGrid-cell': { py: 0.5 } }}
            />
            <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddRow}
                disabled={value.length >= maxRows}
                sx={{ mt: 0.5 }}
            >
                {t('attributes.table.addRow')}
            </Button>
        </Box>
    )
}
```

> **Примечание**: Отдельный компонент `InlineEditableCell` НЕ создаётся.
> DataGrid `editable: true` + `processRowUpdate` полностью покрывает inline-редактирование.
```

---

## Фаза 7: Frontend Runtime — apps-template-mui

**`[QA-FIX: CRITICAL — ПОЛНАЯ ПЕРЕРАБОТКА ФАЗЫ]`**

> Требование ТЗ (Req 6): «В рантайме (Приложениях) для отображения и CRUD табличной части
> использовать ТЕ ЖЕ компоненты DataGrid/useCrudDashboard/RowActionsMenu, что уже работают
> для каталогов. НЕ дублировать логику в кастомных компонентах.»

### Архитектура: TabularPartAdapter

Вместо создания `RuntimeTabularPart` как нового кастомного компонента, реализуем паттерн
**CrudDataAdapter** — интерфейс, уже используемый в `apps-template-mui` для runtime CRUD:

```typescript
// CrudDataAdapter interface (packages/apps-template-mui/src/api/types.ts):
export interface CrudDataAdapter {
    queryKeyPrefix: string
    fetchList(): Promise<AppDataResponse>
    fetchRow(id: string): Promise<Record<string, unknown>>
    createRow(data: Record<string, unknown>): Promise<Record<string, unknown>>
    updateRow(id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>
    deleteRow(id: string): Promise<void>
}
```

Новый адаптер `TabularPartAdapter` реализует `CrudDataAdapter` для дочерних таблиц:

```typescript
// NEW FILE: packages/apps-template-mui/base/src/api/TabularPartAdapter.ts

export class TabularPartAdapter implements CrudDataAdapter {
    readonly queryKeyPrefix: string

    constructor(
        private appId: string,
        private catalogId: string,
        private parentRecordId: string,
        private attributeId: string,
        private apiClient: AxiosInstance
    ) {
        this.queryKeyPrefix = `tabular-${parentRecordId}-${attributeId}`
    }

    async fetchList(): Promise<AppDataResponse> {
        const { data } = await this.apiClient.get(
            `/applications/${this.appId}/catalogs/${this.catalogId}/records/${this.parentRecordId}/tabular/${this.attributeId}`
        )
        return data
    }

    async fetchRow(id: string): Promise<Record<string, unknown>> {
        const { data } = await this.apiClient.get(
            `/applications/${this.appId}/catalogs/${this.catalogId}/records/${this.parentRecordId}/tabular/${this.attributeId}/${id}`
        )
        return data
    }

    async createRow(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
        const { data } = await this.apiClient.post(
            `/applications/${this.appId}/catalogs/${this.catalogId}/records/${this.parentRecordId}/tabular/${this.attributeId}`,
            payload
        )
        return data
    }

    async updateRow(id: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
        const { data } = await this.apiClient.put(
            `/applications/${this.appId}/catalogs/${this.catalogId}/records/${this.parentRecordId}/tabular/${this.attributeId}/${id}`,
            payload
        )
        return data
    }

    async deleteRow(id: string): Promise<void> {
        await this.apiClient.delete(
            `/applications/${this.appId}/catalogs/${this.catalogId}/records/${this.parentRecordId}/tabular/${this.attributeId}/${id}`
        )
    }
}
```

### Шаг 7.1: FormDialog.tsx — TABLE рендеринг

**`[QA-FIX: MAJOR]`** `maxWidth` диалога: текущий `FormDialog` использует `maxWidth='sm'`.
Когда запись содержит TABLE-атрибут(ы), диалог должен быть шире.

```typescript
// Extend FieldType:
export type FieldType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'REF' | 'JSON' | 'TABLE'

// Extend FieldConfig:
export interface FieldConfig {
    // ... existing ...
    /** Child field configs for TABLE type */
    childFields?: FieldConfig[]
    /** TABLE-specific UI settings */
    tableUiConfig?: { showTitle?: boolean }
}

// Dynamic maxWidth:
const hasTableFields = fields.some(f => f.type === 'TABLE')
const dialogMaxWidth = hasTableFields ? 'lg' : 'sm'

// In Dialog:
<Dialog open={open} onClose={onClose} maxWidth={dialogMaxWidth} fullWidth>
```

В `renderField()`:

```tsx
case 'TABLE': {
    const childFields = field.childFields ?? []
    // При РЕДАКТИРОВАНИИ (есть parentRecordId) — рендерим вложенный CrudDashboard
    // При СОЗДАНИИ (нет parentRecordId) — inline DataGrid с локальным состоянием
    if (editingRow?.id) {
        return (
            <RuntimeTabularPartView
                appId={appId}
                catalogId={catalogId}
                parentRecordId={editingRow.id}
                attributeId={field.name}
                childFields={childFields}
                showTitle={field.tableUiConfig?.showTitle ?? true}
            />
        )
    } else {
        // Create mode — local state, no API
        const tableValue = (values[field.name] as Record<string, unknown>[]) ?? []
        return (
            <TabularPartEditor
                label={field.label ?? ''}
                value={tableValue}
                onChange={(rows) => handleFieldChange(field.name, rows)}
                childFields={childFields}
                showTitle={field.tableUiConfig?.showTitle ?? true}
            />
        )
    }
}
```

### Шаг 7.2: RuntimeTabularPartView — переиспользование useCrudDashboard

**`[QA-FIX: CRITICAL]`** Вместо кастомного компонента, используем существующий `useCrudDashboard`
с `TabularPartAdapter`:

```tsx
// NEW FILE: packages/apps-template-mui/base/src/components/RuntimeTabularPartView.tsx

import { useCrudDashboard } from '../hooks/useCrudDashboard'
import { TabularPartAdapter } from '../api/TabularPartAdapter'
import { CustomizedDataGrid } from './CustomizedDataGrid'
import { RowActionsMenu } from './RowActionsMenu'

interface RuntimeTabularPartViewProps {
    appId: string
    catalogId: string
    parentRecordId: string
    attributeId: string
    childFields: FieldConfig[]
    showTitle?: boolean
    label?: string
}

const RuntimeTabularPartView: React.FC<RuntimeTabularPartViewProps> = ({
    appId, catalogId, parentRecordId, attributeId, childFields, showTitle, label
}) => {
    const adapter = useMemo(
        () => new TabularPartAdapter(appId, catalogId, parentRecordId, attributeId, apiClient),
        [appId, catalogId, parentRecordId, attributeId]
    )

    // Reuse the SAME hook that catalogs use
    const {
        rows, columns, isLoading, error,
        handleCreate, handleUpdate, handleDelete,
        processRowUpdate
    } = useCrudDashboard(adapter, {
        fieldConfigs: childFields,
        enableInlineEdit: true
    })

    return (
        <Box sx={{ mt: 1, mb: 2 }}>
            {showTitle && label && (
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{label}</Typography>
            )}
            <CustomizedDataGrid
                rows={rows}
                columns={[
                    ...columns,
                    {
                        field: 'actions',
                        headerName: '',
                        width: 80,
                        renderCell: (params) => (
                            <RowActionsMenu
                                onEdit={() => handleUpdate(params.row.id)}
                                onDelete={() => handleDelete(params.row.id)}
                            />
                        )
                    }
                ]}
                loading={isLoading}
                processRowUpdate={processRowUpdate}
                density="compact"
                hideFooter
                autoHeight
                sx={{ maxHeight: 400 }}
            />
            <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleCreate}
                sx={{ mt: 0.5 }}
            >
                {t('table.addRow')}
            </Button>
        </Box>
    )
}
```

> **Ключевое отличие от оригинального плана**: Мы НЕ создаём отдельный RuntimeTabularPart
> с кастомной логикой CRUD. Вместо этого мы создаём `TabularPartAdapter` (реализация
> `CrudDataAdapter`) и передаём его в **тот же** `useCrudDashboard` + `CustomizedDataGrid` +
> `RowActionsMenu`, что уже работают для каталогов.

### Шаг 7.3: columns.tsx — рендеринг TABLE в DataGrid

**`[QA-FIX: CRITICAL]`** Необходимо добавить `'TABLE'` в:
1. `RUNTIME_WRITABLE_TYPES` (Set) — иначе TABLE не попадёт в writeable-колонки
2. `coerceRuntimeValue()` — нужен case для TABLE (return null или пропуск, т.к. TABLE не хранит данные в родительской таблице)
3. `appDataResponseSchema` — Zod enum `dataType` не содержит 'TABLE'

```typescript
// 1. applicationsRoutes.ts:
const RUNTIME_WRITABLE_TYPES = new Set([
    'BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE'  // ← ДОБАВИТЬ TABLE
])

// 2. coerceRuntimeValue():
case 'TABLE':
    // TABLE is a virtual type — no physical column in parent table.
    // Data lives in child table. Skip coercion.
    return null

// 3. appDataResponseSchema (api.ts):
const columnSchema = z.object({
    // ...
    dataType: z.enum([
        'STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'  // ← ДОБАВИТЬ TABLE
    ]),
    childColumns: z.array(columnSchema).optional()  // ← ДОБАВИТЬ для TABLE
})
```

В `toGridColumns()` — для TABLE показать badge с количеством строк:

```typescript
if (col.dataType === 'TABLE') {
    return {
        field: col.codename,
        headerName: col.label,
        sortable: false,
        width: 120,
        renderCell: (params) => {
            const count = Array.isArray(params.value) ? params.value.length : 0
            return (
                <Chip
                    label={count}
                    size="small"
                    variant="outlined"
                    icon={<TableRowsIcon fontSize="small" />}
                />
            )
        }
    }
}
```

В `toFieldConfigs()` — для TABLE добавить childFields:

```typescript
if (col.dataType === 'TABLE') {
    return {
        name: col.codename,
        label: col.label,
        type: 'TABLE' as FieldType,
        childFields: (col.childColumns ?? []).map(toFieldConfig),
        tableUiConfig: col.uiConfig
    }
}
```

### Шаг 7.4: Runtime API — эндпоинты дочерних таблиц

**`[QA-FIX: CRITICAL]`** Runtime CREATE с TABLE: нужна **транзакция**.
При создании записи с TABLE-данными бэкенд должен:
1. Начать транзакцию
2. INSERT parent row → получить parent ID
3. Для каждого TABLE-атрибута: INSERT child rows с `_tp_parent_id = parentId`
4. Commit транзакции

```typescript
// applicationsRoutes.ts — create endpoint:
router.post('/:catalogId/records', async (req, res) => {
    const { catalogId } = req.params
    const catalog = await resolveRuntimeCatalog(...)

    await knex.transaction(async (trx) => {
        // Separate TABLE data from flat data
        const flatData: Record<string, unknown> = {}
        const tableData: Record<string, unknown[]> = {}

        for (const [key, value] of Object.entries(req.body)) {
            const attr = catalog.attributes.find(a => a.codename === key)
            if (attr?.data_type === 'TABLE') {
                tableData[key] = Array.isArray(value) ? value : []
            } else {
                flatData[key] = value
            }
        }

        // 1. Insert parent record
        const parentRow = buildParentRow(flatData, catalog, userId)
        const [inserted] = await trx.withSchema(schemaName)
            .table(catalog.tableName).insert(parentRow).returning('id')
        const parentId = inserted.id

        // 2. Insert child rows for each TABLE attribute
        for (const [codename, rows] of Object.entries(tableData)) {
            if (rows.length === 0) continue
            const attr = catalog.attributes.find(a => a.codename === codename)
            if (!attr || attr.data_type !== 'TABLE') continue

            const tabularTableName = attr.column_name  // stored as table name in _app_attributes
            const childAttrs = catalog.childAttributes?.[attr.id] ?? []
            const childRows = rows.map((rowData, index) =>
                buildChildRow(rowData as Record<string, unknown>, childAttrs, parentId, index, userId)
            )
            await trx.withSchema(schemaName).table(tabularTableName).insert(childRows)
        }

        res.json({ id: parentId })
    })
})
```

**`[QA-FIX: MEDIUM]`** Runtime DELETE с soft-delete каскадом:

```typescript
// applicationsRoutes.ts — delete endpoint:
// При soft-delete родительской записи (_app_deleted = true),
// нужно также soft-delete все child rows:
router.delete('/:catalogId/records/:recordId', async (req, res) => {
    await knex.transaction(async (trx) => {
        // Soft-delete parent
        await trx.withSchema(schemaName).table(catalog.tableName)
            .where({ id: recordId }).update({ _app_deleted: true, _app_deleted_at: now, _app_deleted_by: userId })

        // Cascade soft-delete to child tables
        for (const attr of catalog.attributes.filter(a => a.data_type === 'TABLE')) {
            const tabularTableName = attr.column_name
            await trx.withSchema(schemaName).table(tabularTableName)
                .where({ _tp_parent_id: recordId })
                .update({ _app_deleted: true, _app_deleted_at: now, _app_deleted_by: userId })
        }

        res.json({ success: true })
    })
})
```

**`[QA-FIX: MEDIUM]`** `_upl_locked` check: перед модификацией child rows
проверять `_upl_locked` на parent record:

```typescript
// В tabular CRUD endpoints:
const parentRecord = await trx.withSchema(schemaName)
    .table(catalog.tableName).where({ id: parentRecordId }).first()
if (parentRecord?._upl_locked) {
    return res.status(423).json({ error: 'Parent record is locked' })
}
```

Дочерние эндпоинты:

```
GET  /applications/:appId/catalogs/:catalogId/records/:recordId/tabular/:attributeId
POST /applications/:appId/catalogs/:catalogId/records/:recordId/tabular/:attributeId
PUT  /applications/:appId/catalogs/:catalogId/records/:recordId/tabular/:attributeId/:rowId
DELETE /applications/:appId/catalogs/:catalogId/records/:recordId/tabular/:attributeId/:rowId
```

Каждый эндпоинт работает с дочерней таблицей `{parentTable}_tp_{attrUuid32}`:

```typescript
router.get('/:recordId/tabular/:attributeId', async (req, res) => {
    const { catalogId, recordId, attributeId } = req.params
    const schemaName = application.schemaName!
    const parentTableName = generateTableName(catalogId, 'catalog')
    const tabularTableName = generateTabularTableName(parentTableName, attributeId)

    const rows = await knex
        .withSchema(schemaName)
        .select('*')
        .from(tabularTableName)
        .where({ _tp_parent_id: recordId, _app_deleted: false })
        .orderBy('_tp_sort_order', 'asc')

    res.json({ items: rows, total: rows.length })
})
```

---

## Фаза 8: i18n — Интернационализация

### Шаг 8.1: Добавить ключи в EN/RU `metahubs.json`

**EN**:
```json
{
    "attributes": {
        "dataTypes": {
            "table": "Table"
        },
        "childAttributes": "Child attributes",
        "table": {
            "addRow": "Add row",
            "deleteRow": "Delete row",
            "noRows": "No rows",
            "rowCount": "{{count}} row(s)"
        },
        "tableSettings": {
            "showTitle": "Show table title",
            "hint": "TABLE attributes store rows in a separate child table. Each row can have its own set of fields."
        },
        "validation": {
            "maxTableAttributes": "Maximum {{max}} TABLE attributes per catalog",
            "maxChildAttributes": "Maximum {{max}} child attributes per TABLE",
            "nestedTableNotAllowed": "Nested TABLE attributes are not allowed",
            "tableCannotBeDisplay": "TABLE attributes cannot be set as the display attribute"
        }
    }
}
```

**RU**:
```json
{
    "attributes": {
        "dataTypes": {
            "table": "Таблица"
        },
        "childAttributes": "Дочерние атрибуты",
        "table": {
            "addRow": "Добавить строку",
            "deleteRow": "Удалить строку",
            "noRows": "Нет строк",
            "rowCount": "{{count}} строк(а)"
        },
        "tableSettings": {
            "showTitle": "Показывать заголовок таблицы",
            "hint": "Атрибуты типа ТАБЛИЦА хранят строки в отдельной дочерней таблице. Каждая строка может иметь свой набор полей."
        },
        "validation": {
            "maxTableAttributes": "Максимум {{max}} атрибутов типа ТАБЛИЦА на каталог",
            "maxChildAttributes": "Максимум {{max}} дочерних атрибутов на ТАБЛИЦУ",
            "nestedTableNotAllowed": "Вложенные атрибуты ТАБЛИЦА не допускаются",
            "tableCannotBeDisplay": "Атрибуты ТАБЛИЦА не могут быть отображаемым атрибутом"
        }
    }
}
```

---

## Фаза 9: Тестирование

### Шаг 9.1: schema-ddl тесты

- [ ] `generateTabularTableName()` — корректное именование
- [ ] `buildSchemaSnapshot()` — TABLE атрибуты с childFields попадают в snapshot
- [ ] `calculateSchemaDiff()` — ADD_TABULAR_TABLE, DROP_TABULAR_TABLE, ADD/DROP_TABULAR_COLUMN
- [ ] `SchemaGenerator.createTabularTable()` — создание таблицы с FK, индексами, system fields
- [ ] `SchemaMigrator.applyChange()` — обработка новых ChangeType
- [ ] Полный цикл: создание → snapshot → diff (add column) → migrate → verify

### Шаг 9.2: metahubs-backend тесты

- [ ] CRUD атрибутов с `parentAttributeId`
- [ ] Лимиты: max 10 TABLE, max 20 children
- [ ] Запрет вложенных TABLE
- [ ] Запрет isDisplayAttribute для TABLE/children
- [ ] Каскадное удаление: удаление TABLE удаляет дочерние атрибуты
- [ ] Snapshot сериализация/десериализация TABLE с childFields
- [ ] seedPredefinedElements с TABLE данными

### Шаг 9.3: Frontend тесты (ручные)

- [ ] Создание TABLE атрибута через UI
- [ ] Добавление дочерних атрибутов (включая REF)
- [ ] Редактирование/удаление дочерних атрибутов
- [ ] Reorder дочерних атрибутов
- [ ] Предопределённый элемент с TABLE данными
- [ ] Runtime: создание записи с табличной частью
- [ ] Runtime: редактирование табличной части (добавление/удаление строк)
- [ ] Runtime: отображение количества строк в DataGrid

---

## Потенциальные сложности и риски

### 1. Производительность snapshot/sync
**Риск**: Дочерние таблицы увеличивают количество DDL-операций при sync.
**Митигация**: TABLE-данные в predefined elements хранятся как JSONB-массив в `_mhb_elements.data`, физические дочерние таблицы создаются только в app-схеме.

### 2. Миграции при изменении структуры TABLE
**Риск**: Добавление/удаление дочерних колонок — деструктивная операция.
**Митигация**: Использовать существующий `SchemaMigrator` с новыми ChangeType; деструктивные изменения требуют подтверждения пользователя.

### 3. Runtime CRUD дочерних записей `[QA-FIX: уточнено]`
**Риск**: При создании родительской записи parent_id ещё не известен.
**Митигация**:
- **CREATE**: TABLE данные отправляются массивом в теле запроса; бэкенд создаёт parent → child **в одной транзакции** (обязательно, не опционально).
- **EDIT**: Дочерние записи загружаются/модифицируются через отдельные API endpoints (`TabularPartAdapter`).
- **DELETE**: Soft-delete каскадируется на child rows явно (FK CASCADE работает только для hard-delete).

### 4. Обратная совместимость snapshot
**Риск**: Старые snapshots не содержат `childFields`.
**Митигация**: `childFields` опционален; десериализация работает без него. `normalizeSnapshotForHash()` — `childFields: null → []` безопасно. Версия snapshot сбрасывается к 1 (БД будет пересоздана, legacy данных нет).

### 5. Версия структуры и шаблона
**Решение**: Не менять `CURRENT_STRUCTURE_VERSION` и версию шаблона метахаба.
`parent_attribute_id` добавляется как nullable + миграция в рамках существующей версии структуры.

### 6. `[QA-FIX: NEW]` SchemaMigrator FK ON DELETE
**Риск**: `ADD_FK` в SchemaMigrator жёстко задаёт `ON DELETE SET NULL`. Child table FK нужен `CASCADE`.
**Митигация**: Параметризация через `onDeleteAction` в `SchemaChange` (см. Шаг 2.6).

### 7. `[QA-FIX: NEW]` _app_attributes DDL
**Риск**: Таблица `_app_attributes` не содержит колонки `parent_attribute_id`.
**Митигация**: Добавить колонку в `ensureSystemTables()` + `syncSystemMetadata()` (см. Шаги 5.2a, 3.1).

### 8. `[QA-FIX: NEW]` resolveCatalogSeedingOrder
**Риск**: `resolveCatalogSeedingOrder()` — топологическая сортировка каталогов по REF-зависимостям.
Дочерние таблицы в этот порядок не входят, но seed выполняется ПОСЛЕ всех DDL → безопасно.
**Митигация**: Не требуется, если child table seed идёт внутри entity seed loop (Шаг 5.3).

---

## Порядок реализации (рекомендуемый)

| Этап | Фазы | Пакеты | Описание |
|------|-------|--------|----------|
| 1 | 0 + 1 | `@universo/types` | Контракт + типы |
| 2 | 2 | `@universo/schema-ddl` | naming, snapshot (version reset 3→1), diff, generator, migrator (вкл. FK CASCADE) |
| 3 | 3 | `@universo/metahubs-backend` | systemTables, CRUD, routes |
| 4 | 5.1 | `@universo/metahubs-backend` | SnapshotSerializer |
| 5 | 4 + 5.2-5.3 | `@universo/metahubs-backend` | Elements + Sync + syncSystemMetadata + _app_attributes DDL |
| 6 | 6 | `@universo/metahubs-frontend` | UI: AttributeList, Form, Elements (DataGrid editable) |
| 7 | 7.3-7.4 | `@universo/applications-backend` | Runtime: RUNTIME_WRITABLE_TYPES + coerceRuntimeValue + resolveRuntimeCatalog + транзакции + cascade soft-delete |
| 8 | 7.1-7.2 | `@universo/apps-template-mui` | Runtime UI: TabularPartAdapter + RuntimeTabularPartView + FormDialog + columns |
| 9 | 8 | `@universo/i18n` | EN/RU ключи |
| 10 | 9 | Все | Тестирование |

**Оценка трудозатрат**: ~35-40 файлов, 3500-4500 строк кода, 5-7 итераций IMPLEMENT.

---

## Заметки по модернизации

1. **TanStack Query**: Все API-запросы для дочерних атрибутов и табличных данных используют query key factory + `staleTime: 30_000`.
2. **UUID v7**: Все новые ID (дочерних атрибутов, строк табличной части) через `public.uuid_generate_v7()`.
3. **i18n**: Все текстовые строки через `useTranslation('metahubs')`, ключи в `universo-i18n`.
4. **Isolated packages**: `apps-template-mui` изолирован, все типы содержатся в нём.
5. **VLC**: Имена дочерних атрибутов используют стандартный VLC-паттерн.
6. **Soft delete**: Дочерние строки табличных частей используют `_app_deleted` для soft-delete (единый паттерн с parent entity). `[QA-FIX]` При soft-delete parent — явный каскад на child rows.
7. **Optimistic locking**: Дочерние строки имеют `_upl_version` для optimistic lock. `[QA-FIX]` Текущий runtime НЕ использует optimistic locking для runtime rows — risk=LOW.
8. **`[QA-FIX: NEW]` CrudDataAdapter pattern**: Runtime TABLE CRUD реализуется через `TabularPartAdapter implements CrudDataAdapter`, переиспользуя `useCrudDashboard`/`CustomizedDataGrid`/`RowActionsMenu` (ТЗ Req 6).
9. **`[QA-FIX: NEW]` RLS**: RLS не используется на runtime app tables (`app_*` schema) — отдельных RLS-политик для дочерних таблиц не требуется.
10. **`[QA-FIX: NEW]` _app_attributes DDL**: Необходимо расширить DDL `_app_attributes` колонкой `parent_attribute_id` в `ensureSystemTables()` (SchemaGenerator.ts).

---

## Приложение A: QA-анализ и корректировки плана

> Дата QA: 2026-02-21
> Методика: Полный анализ кодовой базы, верификация архитектурных решений,
> проверка всех затрагиваемых файлов, сопоставление с требованиями ТЗ.

### A.1 CRITICAL Issues (6)

| # | Проблема | Фаза/Шаг | Статус |
|---|----------|----------|--------|
| C1 | `RuntimeTabularPart` не соответствует ТЗ Req 6 — нужно переиспользовать `useCrudDashboard`/`CustomizedDataGrid`/`RowActionsMenu` | Фаза 7, Шаг 7.2 | ✅ Исправлено: `TabularPartAdapter implements CrudDataAdapter` + `RuntimeTabularPartView` |
| C2 | Отсутствие транзакции при CREATE с TABLE children — parent и child INSERT должны быть атомарны | Фаза 7, Шаг 7.4 | ✅ Исправлено: `knex.transaction()` обёртка |
| C3 | `RUNTIME_WRITABLE_TYPES` не содержит 'TABLE' — runtime CRUD не работает | Фаза 7, Шаг 7.3 | ✅ Исправлено: TABLE добавлен |
| C4 | `SchemaMigrator.applyChange(ADD_FK)` жёстко задаёт `ON DELETE SET NULL` — child->parent FK нужен CASCADE | Фаза 2, Шаг 2.6 | ✅ Исправлено: параметризация `onDeleteAction` |
| C5 | `coerceRuntimeValue()` не имеет case для TABLE + `appDataResponseSchema` Zod enum без TABLE | Фаза 7, Шаг 7.3 | ✅ Исправлено: case TABLE + Zod enum |
| C6 | `resolveRuntimeCatalog()` загружает только top-level атрибуты из `_app_attributes` — child attrs не обнаруживаются | Фаза 5, Шаг 5.2b | ✅ Исправлено: разделение root/child + childColumns в API |

### A.2 MAJOR Issues (6)

| # | Проблема | Фаза/Шаг | Статус |
|---|----------|----------|--------|
| M1 | `FormDialog` `maxWidth='sm'` — слишком узок для TABLE fields | Фаза 7, Шаг 7.1 | ✅ Исправлено: динамический `maxWidth` (sm→lg) |
| M2 | `FlowListTable` не поддерживает expand/detail panels — Collapse под TableRow невозможен | Фаза 6, Шаг 6.2 | ✅ Исправлено: Collapse ПОД FlowListTable, не внутри |
| M3 | `InlineEditableCell` — ненужный кастомный компонент, DataGrid `editable:true` покрывает | Фаза 6, Шаг 6.4 | ✅ Исправлено: DataGrid + processRowUpdate |
| M4 | Soft-delete НЕ каскадируется на child rows (FK CASCADE работает только для hard-delete) | Фаза 7, Шаг 7.4 | ✅ Исправлено: явный каскад soft-delete |
| M5 | `syncSystemMetadata()` записывает только flat attributes — child attrs не попадают в `_app_attributes` | Фаза 5, Шаг 5.2a | ✅ Исправлено: flatMap + child attrs с parent_attribute_id |
| M6 | DDL `_app_attributes` не содержит колонки `parent_attribute_id` | Фаза 3/5 | ✅ Исправлено: добавить в ensureSystemTables() |

### A.3 MEDIUM Issues (5)

| # | Проблема | Фаза/Шаг | Статус |
|---|----------|----------|--------|
| m1 | `orderChangesForApply()` — flat ранги не гарантируют parent→child порядок | Фаза 2, Шаг 2.6 | ✅ Исправлено: вторичная сортировка по entityId |
| m2 | `seedPredefinedElements()` — flat-only, не поддерживает вложенные TABLE данные | Фаза 5, Шаг 5.3 | ✅ Исправлено: блок child rows seed |
| m3 | `_upl_locked` check — нет проверки lock parent перед child row modification | Фаза 7, Шаг 7.4 | ✅ Исправлено: проверка parent._upl_locked |
| m4 | `AttributeActions.tsx` — нужен конкретный патч для `set-display-attribute` visibility | Фаза 6, Шаг 6.1 | ✅ Исправлено: условие visibility |
| m5 | `resolveCatalogSeedingOrder()` — не учитывает child tables, но seed внутри entity loop → OK | Фаза 5 | ✅ Подтверждено: не требует изменений |

### A.4 LOW/INFO Issues (3)

| # | Проблема | Оценка |
|---|----------|--------|
| L1 | Snapshot hash — `childFields: null→[]` backward compatible | Безопасно, `normalizeSnapshotForHash` обрабатывает |
| L2 | Optimistic locking (`_upl_version`) не используется для runtime rows | Текущее поведение, не затрагивается планом |
| L3 | RLS не используется на runtime `app_*` tables | Дочерним таблицам RLS не нужен |

### A.5 Архитектурные подтверждения

| Решение | Верификация |
|---------|------------|
| Дочерние таблицы `{parent}_tp_{attrUuid32}` | ✅ Корректно, соответствует naming convention |
| `parent_attribute_id` self-reference в `_mhb_attributes` | ✅ Корректно, FK ON DELETE CASCADE |
| `_app_*` prefix exclusion in `SchemaGenerator` | ✅ Корректно, `_app_*` не обрабатываются как user tables |
| TABLE data in `_mhb_elements.data` as JSONB array | ✅ Корректно, JSONB для метахаб design-time, физ. таблицы для app runtime |
| `_mhb_attributes` DDL — `parent_attribute_id` absent | ✅ Подтверждено: нужно добавить (Шаг 3.1) |
| `_app_attributes` DDL — same absence | ✅ Подтверждено: нужно добавить (Шаг 5.2a) |
| `systemTableDefinitions.ts` определяет только `_mhb_*` | ✅ Подтверждено: `_app_*` таблицы создаются в SchemaGenerator.ensureSystemTables() |

### A.6 Файлы, верифицированные в QA

| Файл | Пакет | Релевантные находки |
|------|-------|---------------------|
| `SchemaMigrator.ts` | schema-ddl | ADD_FK `ON DELETE SET NULL` hardcoded (L287-316) |
| `SchemaGenerator.ts` | schema-ddl | `syncSystemMetadata` flat only; `ensureSystemTables` no parent_attribute_id |
| `applicationSyncRoutes.ts` | metahubs-backend | generateFullSchema → SchemaMigrator; seedPredefinedElements flat-only |
| `applicationsRoutes.ts` | applications-backend | RUNTIME_WRITABLE_TYPES; coerceRuntimeValue; resolveRuntimeCatalog flat |
| `systemTableDefinitions.ts` | metahubs-backend | Only _mhb_* tables; _mhb_attributes DDL no parent_attribute_id |
| `FlowListTable.tsx` | universo-template-mui | No expand/detail panel; thin MUI Table wrapper |
| `types.ts` (CrudDataAdapter) | apps-template-mui | fetchList/fetchRow/createRow/updateRow/deleteRow — flat |
| `api.ts` (AppDataResponse) | apps-template-mui | Zod enum без TABLE |
| `columns.tsx` | apps-template-mui | toGridColumns/toFieldConfigs — no TABLE case |
| `SnapshotSerializer.ts` | metahubs-backend | normalizeSnapshotForHash — childFields=null→[] safe |

### A.7 Нерешённые вопросы (для обсуждения)

1. **ChangeTypes**: Добавлять отдельные `ADD_TABULAR_TABLE`/`DROP_TABULAR_TABLE` или использовать
   существующие `ADD_TABLE`/`DROP_TABLE` с флагом `isTabularPart`? План использует отдельные
   типы (рекомендуется для ясности), но это увеличивает размер enum. **Решение на усмотрение
   имплементатора**.

2. **Context7 / Supabase**: Не удалось подключиться к Context7 MCP (требуется аутентификация
   пользователя: `https://connect.composio.dev/link/lk_8RmnElT9N9nR`) и Supabase UP-test
   (проект приостановлен, connection timeout). Верификация структуры БД в Supabase
   не выполнена — рекомендуется проверить `_mhb_attributes` / `_app_attributes` схему
   вручную перед началом имплементации.
