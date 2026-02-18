# Applications Frontend — Migration Guard

> Overview of the application migration guard system. For the full package overview see [README.md](README.md).

## ApplicationMigrationGuard

Route guard component that blocks navigation when the application runtime schema requires updates. Uses `MigrationGuardShell` from `@universo/migration-guard-shared` for shared guard logic.

```tsx
import { ApplicationMigrationGuard } from '@universo/applications-frontend'

// Usage: wrap application runtime routes to enforce migration checks
<ApplicationMigrationGuard>
  <ApplicationBoard />
</ApplicationMigrationGuard>

// Capabilities:
// - Calls GET /application/:id/migrations/status on mount
// - Blocks access when migrationRequired=true (schema or structure out of date)
// - Shows UnderDevelopmentPage when schemaExists=false (MANDATORY severity)
// - Shows MaintenancePage when structureUpgradeRequired=true (MANDATORY severity)
// - Displays a modal dialog with severity chips and structured blockers
// - "Navigate to migrations" button for manual migration management
// - Skips /migrations route without blocking
// - Renders structured blockers with i18n: t('migrations.blockers.${code}', params)
```

## Shared Components

The guard delegates common logic to `MigrationGuardShell` from `@universo/migration-guard-shared`:

- **Entity ID check** — no ID → pass through
- **Route skip** — migrations route → pass through
- **Loading / error states** — spinner and error alert with retry
- **Severity logic** — OPTIONAL → pass, RECOMMENDED → dismissable dialog, MANDATORY → blocking dialog
- **Dismissed state** — persists within component lifecycle

### Application-specific rendering:
- Pre-dialog: `UnderDevelopmentPage` / `MaintenancePage` for MANDATORY severity
- Chip: schema needs update (when `migrationRequired && !schemaExists`)
- Chip: structure needs update (when `structureUpgradeRequired`)
- Navigate to migrations button

## Hooks

- `useApplicationMigrationStatus` — TanStack Query hook using `MIGRATION_STATUS_QUERY_OPTIONS` from shared package
- Query key pattern: `['applications', applicationId, 'migrations', 'status']`

## i18n Keys

Migration guard keys live under the `migrationGuard.*` namespace:

| Key | Purpose |
|---|---|
| `migrationGuard.checking` | Loading state text |
| `migrationGuard.statusError` | Error state text |
| `migrationGuard.retry` | Retry button label |
| `migrationGuard.title` | Dialog title |
| `migrationGuard.descriptionMandatory` | Mandatory update description |
| `migrationGuard.descriptionRecommended` | Recommended update description |
| `migrationGuard.navigateToMigrations` | Navigate button label |
| `migrationGuard.dismiss` | Dismiss button label |
