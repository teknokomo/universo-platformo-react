---
description: How to update fixed system application schemas safely.
---

# Updating System App Schemas

Fixed system applications (admin, profiles, metahubs, applications) use
manifest-driven schema definitions stored in TypeScript source files. This
guide explains how to modify their database schemas safely and what happens
at runtime when the platform detects a change.

## Prerequisites

- Understanding of the monorepo package structure.
- Familiarity with `SystemAppDefinition` manifests in backend packages.
- Read [System App Migration Lifecycle](../architecture/system-app-migration-lifecycle.md)
  for the architectural context behind these steps.

## Where Definitions Live

Each fixed system app has a `SystemAppDefinition` manifest in its backend
package:

| System App     | Manifest File                                                          |
|----------------|------------------------------------------------------------------------|
| admin          | `packages/admin-backend/base/src/platform/systemAppDefinition.ts`      |
| profiles       | `packages/profile-backend/base/src/platform/systemAppDefinition.ts`    |
| metahubs       | `packages/metahubs-backend/base/src/platform/systemAppDefinition.ts`   |
| applications   | `packages/applications-backend/base/src/platform/systemAppDefinition.ts` |

The manifest declares business tables, fields, data types, and
capabilities. It is the single source of truth for the schema shape of
each system app.

## Step-by-Step: Adding a New Field

1. Open the manifest file for the target system app.
2. Find the `targetBusinessTables` array (or the shared `const` it references).
3. Add a new field entry to the appropriate table definition:

```typescript
{
    codename: 'priority',
    physicalColumnName: 'priority',
    dataType: AttributeDataType.NUMBER,
    physicalDataType: 'INTEGER',
    defaultSqlExpression: '0',
    isRequired: true
}
```

4. Build the package to verify the TypeScript compiles:

```bash
pnpm --filter <package-name> build
```

5. Run a full workspace build to propagate changes:

```bash
pnpm build
```

6. Start the server. The platform will detect the change and apply it
   automatically during `initDatabase()`.

## Step-by-Step: Adding a New Business Table

1. Add a new entry to the `targetBusinessTables` array with `kind`, `codename`,
   `tableName`, `fields`, and optional `presentation`.
2. Follow the naming convention: `cat_` for catalogs, `doc_` for documents,
   `rel_` for relations, `cfg_` for settings.
3. If the new table has foreign key references to other tables in the same
   system app, set `targetTableCodename` on the `REF` field.
4. Build and restart the server as described above.

## Step-by-Step: Removing a Field or Table

Removing fields or tables produces destructive changes. The diff engine will
generate `DROP_COLUMN` or `DROP_TABLE` entries and apply them automatically
because the system app upgrade path passes `confirmedDestructive: true`.

1. Remove the field or table from `targetBusinessTables`.
2. Build and restart. The platform will drop the corresponding column or table.
3. Make sure no application code references the removed column before deploying.

## What Happens at Runtime

When the server starts, `ensureRegisteredSystemAppSchemaGenerationPlans()`
runs for each `application_like` system app:

1. **First boot (no tables exist):** Full schema generation via
   `SchemaGenerator.generateFullSchema()`. A baseline migration is recorded
   in `<schema>._app_migrations`.

2. **Subsequent boot (tables match):** The latest snapshot is read from
   `_app_migrations`. A diff is calculated against the current manifest.
   If no changes exist, the boot continues without writing anything.

3. **Schema changed in manifest:** The diff engine detects additive and
   destructive changes. `SchemaMigrator.applyAllChanges()` applies only the
   computed DDL changes (not a full recreate). A new migration record is
   written to `_app_migrations` with `snapshotBefore`, `snapshotAfter`,
   and the list of changes.

## Where Migrations Are Stored

Migrations are stored **in the database**, not in files. Each system app
schema contains a `_app_migrations` table:

```
admin._app_migrations
profiles._app_migrations
metahubs._app_migrations
applications._app_migrations
```

Each row contains:

| Column                 | Content                                            |
|------------------------|----------------------------------------------------|
| `name`                 | Migration name (e.g. `baseline_admin_structure_0_1_0`) |
| `meta`                 | JSONB with `snapshotBefore`, `snapshotAfter`, `changes`, `summary` |
| `publication_snapshot` | Always `null` for system apps                      |
| `_upl_created_at`      | Timestamp of when the migration was applied         |

## SQL Migration Files vs. Manifest-Driven Changes

System apps may also have SQL migration entries in their `migrations` array
(the `kind: 'sql'` entries). These are separate from the manifest-driven
schema generation and serve a different purpose:

- **`pre_schema_generation`** SQL migrations run before `SchemaGenerator`
  creates tables. They typically create the schema itself or set up helper
  functions.
- **`post_schema_generation`** SQL migrations run after tables exist. They
  add indexes, RLS policies, seed data, or database functions.
- **Manifest-driven changes** (via `targetBusinessTables`) are handled
  entirely by the diff engine and recorded in `_app_migrations`.

## CLI Commands

The migration CLI provides commands for inspecting and managing system app
schemas:

```bash
# Show the schema generation plan for all system apps
pnpm migration system-app-schema-plan

# Show the plan for a specific app
pnpm migration system-app-schema-plan --keys=admin

# Apply schema generation plans to the database
pnpm migration system-app-schema-apply

# Bootstrap structure metadata (_app_objects, _app_attributes)
pnpm migration system-app-schema-bootstrap

# Run full platform health check
# including system app validation
pnpm migration doctor
```

## Common Mistakes

- **Forgetting to build before restart.** The server loads compiled JS from
  `dist/`. If you change the TypeScript source but skip the build step, the
  old manifest is used and no migration runs.
- **Referencing a removed column in application code.** The diff engine will
  drop it, but queries that still use it will fail at runtime.
- **Mismatched `currentBusinessTables` and `targetBusinessTables`.** Keep them
  in sync unless you are intentionally modeling a migration from one shape to
  another.

## Related Pages

- [System App Migration Lifecycle](../architecture/system-app-migration-lifecycle.md)
- [Fixed System-App Convergence](../architecture/system-app-convergence.md)
- [Database Design](../architecture/database.md)
- [Creating Packages](../contributing/creating-packages.md)
