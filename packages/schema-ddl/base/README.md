# @universo/schema-ddl

Shared DDL (Data Definition Language) utilities for PostgreSQL schema management.

## Overview

This package provides pure functions and classes for managing PostgreSQL schemas dynamically at runtime. It was extracted from `metahubs-backend` to allow code sharing between multiple packages without circular dependencies.

## Key Features

- **Schema Generation**: Create PostgreSQL schemas and tables from entity definitions
- **Schema Migration**: Calculate and apply schema changes (additive and destructive)
- **Migration History**: Record, list, and analyze migrations for rollback safety
- **Pure Functions**: Naming utilities that work without database connection
- **Dependency Injection**: All classes receive Knex instance via constructor

## Installation

```bash
pnpm add @universo/schema-ddl
```

## Usage

### Basic Usage with Factory Function (Recommended)

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

### Pure Functions (No Database Required)

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

### Diff Calculation

```typescript
import { calculateSchemaDiff, ChangeType } from '@universo/schema-ddl'

const diff = calculateSchemaDiff(oldSnapshot, newEntities)

console.log(diff.summary) // "2 new table(s), 1 dropped column(s)"
console.log(diff.hasChanges) // true
console.log(diff.additive) // Non-destructive changes
console.log(diff.destructive) // Destructive changes requiring confirmation
```

## API Reference

### Pure Functions

| Function | Description |
|----------|-------------|
| `generateSchemaName(applicationId)` | Generates PostgreSQL schema name from application UUID |
| `generateTableName(entityId, kind)` | Generates table name with kind prefix (cat_, hub_, doc_) |
| `generateColumnName(fieldId)` | Generates column name with attr_ prefix |
| `buildFkConstraintName(table, column)` | Generates FK constraint name |
| `isValidSchemaName(name)` | Validates schema name format |
| `calculateSchemaDiff(old, new)` | Calculates changes between snapshots |
| `buildSchemaSnapshot(entities)` | Creates snapshot from entity definitions |

### Classes

| Class | Description |
|-------|-------------|
| `SchemaGenerator` | Creates schemas, tables, and system metadata |
| `SchemaMigrator` | Applies schema changes with locking |
| `MigrationManager` | Records and lists migration history |

### Factory Function

```typescript
createDDLServices(knex: Knex): {
    generator: SchemaGenerator,
    migrator: SchemaMigrator,
    migrationManager: MigrationManager
}
```

## Architecture

This package uses **Dependency Injection** pattern:

- All classes receive `Knex` instance via constructor
- No singletons or global state inside this package
- The consuming package (e.g., `metahubs-backend`) manages the Knex lifecycle

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

## Testing

```bash
pnpm --filter @universo/schema-ddl test
```

## Related Packages

- `metahubs-backend`: Uses this package for Publication schema management
- `applications-backend`: Uses this package for Application-level operations
