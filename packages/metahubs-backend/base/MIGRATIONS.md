# Metahubs Backend — Migration System

> Extracted from [README.md](README.md). For general package overview, see the README.

## Migration Engine

- **Diff Engine** — `calculateSystemTableDiff()` compares two structure versions and emits additive/destructive change lists
- **Safe Migrations** — `SystemTableMigrator` applies only additive changes (ADD_TABLE, ADD_COLUMN, ADD_INDEX, ADD_FK); destructive changes are logged but not applied
- **Migration History** — `_mhb_migrations` table records every applied migration with version, name, and metadata
- **Advisory Locks** — Concurrent migration protection via PostgreSQL advisory locks

## Structured Blockers & Migration Guard

- **StructuredBlocker type** — `{ code, params, message }` for i18n-ready migration blocker display
- **11 blocker sites** in `TemplateSeedCleanupService` converted from plain strings to structured objects
- **5 blocker sites** in `metahubMigrationsRoutes` for schema-level migration checks
- **Migration status endpoint** — `GET /metahub/:id/migrations/status` returns `{ migrationRequired, structureUpgradeRequired, templateUpgradeRequired, blockers: StructuredBlocker[] }`
- **Migration apply endpoint** — `POST /metahub/:id/migrations/apply` with `{ cleanupMode: 'keep' }` body

## Severity Determination

Both metahub and application migration endpoints use the shared `determineSeverity()` utility from `@universo/migration-guard-shared/utils`:

```typescript
import { determineSeverity } from '@universo/migration-guard-shared/utils'

// Metahub: structure upgrade or blockers → MANDATORY, template-only → RECOMMENDED
const severity = determineSeverity({
    migrationRequired,
    isMandatory: structureUpgradeRequired || blockers.length > 0
})

// Application: missing schema or structure upgrade → MANDATORY, publication update → RECOMMENDED
const severity = determineSeverity({
    migrationRequired,
    isMandatory: !schemaExists || structureUpgradeRequired
})
```

## Updating Existing Metahubs

When new functionality is added (new system tables, new seed data), previously created metahubs are updated **automatically** through two independent mechanisms:

### Scenario 1: New System Tables or Columns (DDL Changes)

**Trigger**: `CURRENT_STRUCTURE_VERSION` is bumped (e.g., 1 → N).

**How it works**: When any API call accesses a metahub, `MetahubSchemaService.ensureSchema()` is invoked. It reads the branch's `structureVersion` and compares it against `CURRENT_STRUCTURE_VERSION`. If the branch is behind, the auto-migration pipeline runs:

```
ensureSchema() detects: branch.structureVersion (older) < CURRENT (newer)
  → SystemTableMigrator.migrate(fromVersion, toVersion)
      → calculateSystemTableDiff(previous_tables, current_tables)
      → Apply only ADDITIVE changes (ADD_TABLE, ADD_COLUMN, ADD_INDEX, ADD_FK)
      → Record migration in _mhb_migrations table
  → branch.structureVersion = CURRENT_STRUCTURE_VERSION (saved to DB)
```

**Safety guarantees**:
- Only additive changes are auto-applied; destructive changes (DROP TABLE/COLUMN) are logged but NEVER applied
- PostgreSQL advisory locks prevent concurrent migrations on the same schema
- Each migration is recorded in the `_mhb_migrations` table with full metadata
- Migrations run within a transaction — partial failures are rolled back

### Scenario 2: New Seed Data (Template Updates)

**Trigger**: Template manifest version is bumped (e.g., `basic` template 1.0.x → 1.0.y).

**How it works**: At application startup, `TemplateSeeder.seed()` detects the hash change and upserts the new template version. On the next `ensureSchema()` call for each metahub, the seed migration runs:

```
ensureSchema() detects: seed needs migration
  → TemplateSeedMigrator.migrateSeed(newSeed)
      → migrateLayouts()        — add new layouts by template_key (skip existing)
      → migrateZoneWidgets()    — add new widgets to new layouts
      → migrateSettings()       — add new setting keys (skip existing)
  → branch.seedVersion updated
```

**Key behavior**: Only NEW items are added. Existing user customizations are never overwritten.

## Application Sync

Application schema sync is handled in `applicationSyncRoutes.ts`:

- Acquires a PostgreSQL advisory lock (`app-sync:{applicationId}`) to prevent concurrent syncs
- Sets `schema_status = MAINTENANCE` during sync (visible to non-privileged users as a maintenance page)
- Sets `schema_status = SYNCED` on success, `ERROR` on failure
- Uses `persistPublishedWidgets()` and `persistPublishedLayouts()` to sync widget/layout data
- Releases the advisory lock in a `finally` block
