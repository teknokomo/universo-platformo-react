# Applications Backend — Migration System

> Overview of the application migration endpoints and database schema. For the full package overview see [README.md](README.md).

## Application Migration Endpoints

The application migration status endpoint is used by `ApplicationMigrationGuard` on the frontend.

### `GET /application/:id/migrations/status`

Returns `ApplicationMigrationStatusResponse`:

```typescript
{
  migrationRequired: boolean       // Whether any migration is needed
  severity: UpdateSeverity          // 'mandatory' | 'recommended' | 'optional'
  schemaExists: boolean             // Whether the dynamic schema (app_{uuid}) exists
  structureUpgradeRequired: boolean // Whether system table structure needs upgrading
  blockers: StructuredBlocker[]     // Structured blocker objects with i18n codes
}
```

**Severity determination** uses `determineSeverity()` from `@universo/migration-guard-shared/utils`:
- `MANDATORY` — schema doesn't exist OR structure upgrade required
- `RECOMMENDED` — migration required but not mandatory
- `OPTIONAL` — no migration needed

## Database Migrations (TypeORM)

Static schema migrations are in `src/database/migrations/postgres/`:

| Migration | Purpose |
|---|---|
| `1800000000000-CreateApplicationsSchema` | Creates `applications` schema with `applications` and `connector_publications` tables |

Migrations are exported as `applicationsMigrations` array and registered in `@flowise/core-backend` central registry.

## Dynamic Schema Tables

Application runtime schemas (`app_{uuid}`) are created by `SchemaGenerator`. Key tables:

| Table | Purpose |
|---|---|
| `_app_layouts` | Active layouts |
| `_app_widgets` | Widget configurations per layout zone |
| `_app_metadata` | Schema metadata (version, template hash, etc.) |

## Application Sync

`applicationSyncRoutes.ts` handles syncing published metahub data into the application's runtime schema. Functions:

- `persistPublishedWidgets` — persists published widget data from metahub snapshots
- `getPersistedPublishedWidgets` — reads existing widget data for diff comparison
- `hasPublishedWidgetsChanges` — detects whether widget data has changed since last sync
