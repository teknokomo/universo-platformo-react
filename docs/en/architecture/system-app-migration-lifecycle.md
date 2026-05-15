---
description: How fixed system application schemas are generated, upgraded, and tracked at runtime.
---

# System App Migration Lifecycle

This page documents the runtime lifecycle that generates, upgrades, and
tracks database schemas for the four fixed system applications: admin,
profiles, metahubs, and applications.

## Overview

Each fixed system app declares its target schema shape in a TypeScript
manifest (`SystemAppDefinition`). At server startup the platform compares
the manifest against the last recorded migration snapshot in the database
and applies only the necessary DDL changes. This is the same diff engine
used by user-created applications published through metahubs.

## Key Components

| Component                           | Package                          | Role                                      |
|-------------------------------------|----------------------------------|-------------------------------------------|
| `SystemAppDefinition`               | `@universo/migrations-core`      | Type contract for system app manifests     |
| `systemAppSchemaCompiler`           | `@universo/migrations-platform`  | Builds entities from manifest, runs diff   |
| `SchemaGenerator`                   | `@universo/schema-ddl`           | Creates schemas, tables, system metadata   |
| `SchemaMigrator`                    | `@universo/schema-ddl`           | Calculates and applies incremental diffs   |
| `MigrationManager`                  | `@universo/schema-ddl`           | Records migrations in `_app_migrations`    |
| `buildSchemaSnapshot`               | `@universo/schema-ddl`           | Builds a structural snapshot from entities |
| `calculateSchemaDiff`               | `@universo/schema-ddl`           | Computes change set between two snapshots  |

## Manifest Structure

A `SystemAppDefinition` contains:

- **`key`** — unique identifier (e.g. `admin`).
- **`schemaTarget`** — fixed schema name (e.g. `{ kind: 'fixed', schemaName: 'admin' }`).
- **`currentStorageModel` / `targetStorageModel`** — `'application_like'` for converged apps.
- **`currentBusinessTables` / `targetBusinessTables`** — arrays of table
  definitions with fields, data types, FK references, and defaults.
- **`currentStructureCapabilities` / `targetStructureCapabilities`** — flags
  for system tables (`_app_objects`, `_app_components`, `_app_migrations`, etc.).
- **`migrations`** — SQL migration entries with `bootstrapPhase` markers.

## Bootstrap Sequence

The full bootstrap runs inside `initDatabase()` in
`@universo/core-backend`:

```
1. validateRegisteredPlatformMigrations()
2. validateRegisteredSystemAppDefinitions()
3. validateRegisteredSystemAppSchemaGenerationPlans()
4. validateRegisteredSystemAppCompiledDefinitions()
5. runRegisteredPlatformPreludeMigrations()        ← pre_schema_generation SQL
6. ensureRegisteredSystemAppSchemaGenerationPlans() ← manifest-driven DDL
7. runRegisteredPlatformPostSchemaMigrations()      ← post_schema_generation SQL
8. bootstrapRegisteredSystemAppStructureMetadata()  ← _app_objects / _app_components sync
9. inspectLegacyFixedSchemaTables()                ← verify no legacy tables remain
10. inspectRegisteredSystemAppStructureMetadata()   ← verify metadata fingerprint
11. syncRegisteredPlatformDefinitionsToObject()    ← optional global object sync
```

## Diff Engine

The diff engine supports the following change types:

| Change Type             | Direction    | Example                         |
|------------------------|--------------|---------------------------------|
| `ADD_TABLE`            | Additive     | New business table added         |
| `DROP_TABLE`           | Destructive  | Business table removed           |
| `ADD_COLUMN`           | Additive     | New field added to a table       |
| `DROP_COLUMN`          | Destructive  | Field removed from a table       |
| `ALTER_COLUMN`         | Additive     | Field type or default changed    |
| `ADD_FK`               | Additive     | Foreign key constraint added     |
| `DROP_FK`              | Destructive  | Foreign key constraint removed   |
| `ADD_TABULAR_TABLE`    | Additive     | Child table for TABLE component  |
| `DROP_TABULAR_TABLE`   | Destructive  | Child table removed              |
| `ADD_TABULAR_COLUMN`   | Additive     | Column in child table added      |
| `DROP_TABULAR_COLUMN`  | Destructive  | Column in child table removed    |
| `ALTER_TABULAR_COLUMN` | Additive     | Column in child table changed    |

For system apps, destructive changes are applied automatically
(`confirmedDestructive: true`) because the manifest is the trusted source.

## Migration Storage

Each system app schema has its own `_app_migrations` table. The table is
created by `SchemaGenerator.ensureSystemTables()` during the first bootstrap.

A migration record contains:

```jsonc
{
  "name": "baseline_admin_structure_0_1_0",
  "meta": {
    "snapshotBefore": null,           // null for baseline
    "snapshotAfter": { ... },         // full SchemaSnapshot
    "changes": [ ... ],              // list of SchemaDiff changes
    "hasDestructive": false,
    "summary": "Initial schema creation with 6 table(s)"
  },
  "publication_snapshot": null        // always null for system apps
}
```

Subsequent upgrade migrations contain a non-null `snapshotBefore` and a
concrete list of `changes`.

## Synthetic Entity Generation

The manifest `targetBusinessTables` are converted to `EntityDefinition[]`
by `buildSystemAppBusinessEntities()` in the schema compiler. This
function:

1. Generates **deterministic UUIDs** for entities and fields using SHA-256
   hashes of `namespace:definitionKey:stage:kind:codename:tableName`.
2. Maps business table kinds (`object`, `document`, `relation`, `settings`)
   to runtime entity kinds.
3. Creates synthetic `presentation` objects for localized display names.
4. Resolves inter-table FK references via `targetTableCodename`.

The resulting `EntityDefinition[]` is identical in structure to what the
metahub publication pipeline produces, allowing the same `SchemaGenerator`
and `SchemaMigrator` to work with both paths.

## Ensure vs. Apply

- **`ensureRegisteredSystemAppSchemaGenerationPlans()`** is the startup
  entry point. It checks the current database state and decides whether
  to apply a full baseline, upgrade incrementally, or skip entirely.
- **`applyRegisteredSystemAppSchemaGenerationPlans()`** always runs a
  fresh full generation. It is used by the CLI `system-app-schema-apply`
  command and during development reset scenarios.

## Relationship to Metahub-Published Applications

System apps and metahub-published applications share the same DDL tools:

```
                    ┌─────────────────────────┐
                    │  SystemAppDefinition     │  ← TypeScript manifest
                    │  (targetBusinessTables)  │
                    └───────────┬─────────────┘
                                │
                    buildSystemAppBusinessEntities()
                                │
                                ▼
                    ┌─────────────────────────┐
                    │    EntityDefinition[]    │  ← shared format
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                  │
     buildSchemaSnapshot()  calculateSchemaDiff()  SchemaGenerator
              │                 │                  │
              ▼                 ▼                  ▼
         SchemaSnapshot    SchemaDiff         DDL execution
              │                 │                  │
              └─────────────────┼──────────────────┘
                                │
                    MigrationManager.recordMigration()
                                │
                                ▼
                       _app_migrations table
```

Metahub-published applications follow the same flow but receive their
`EntityDefinition[]` from publication snapshots instead of TypeScript
manifests.

## Related Pages

- [Updating System App Schemas](../guides/updating-system-app-schemas.md)
- [Fixed System-App Convergence](system-app-convergence.md)
- [Optional Global Catalog](optional-global-catalog.md)
- [Database Design](database.md)
