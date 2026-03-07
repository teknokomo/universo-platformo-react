# Metahubs Frontend — Migration Guard

> Extracted from [README.md](README.md). For general package overview, see the README.

## MetahubMigrationGuard

Route guard component that blocks navigation when metahub migrations are pending. Uses `MigrationGuardShell` from `@universo/migration-guard-shared` for common guard logic.

```tsx
import { MetahubMigrationGuard } from '@universo/metahubs-frontend'

// Usage: wrap metahub routes to ensure migrations are applied before access
<MetahubMigrationGuard>
  <MetahubBoard />
</MetahubMigrationGuard>

// Features:
// - Calls GET /metahub/:id/migrations/status on mount to check migration state
// - Blocks access when migrationRequired=true (structure or template upgrade)
// - Shows modal dialog with status chips (structure/template upgrade needed)
// - "Apply (keep user data)" button — calls POST /metahub/:id/migrations/apply
// - "Open migrations" button — navigates to /metahub/:id/migrations
// - Allows /migrations route passthrough without blocking
// - Displays structured blockers with i18n: t('migrations.blockers.${code}', params)
// - Disables "Apply" when blockers are present (hasBlockers guard)
```

## Shared Components

The guard delegates common logic to `MigrationGuardShell` from `@universo/migration-guard-shared`:

- **Entity ID check** — no ID → passthrough
- **Route skip** — migrations route → passthrough
- **Loading/Error states** — spinner and error alert with retry
- **Severity logic** — OPTIONAL → passthrough, RECOMMENDED → dismissible dialog, MANDATORY → blocking dialog
- **Dismissed state** — persisted per component lifecycle

### Metahub-specific rendering:
- Structure upgrade chip + Template upgrade chip
- "Apply (keep user data)" button with loading state
- "Open migrations" navigation button
- Apply error display

## Structured Blockers (i18n)

Migration blockers use structured objects for internationalized display:

```typescript
// StructuredBlocker type (from @universo/types):
interface StructuredBlocker {
  code: string        // i18n key suffix (e.g., 'entityCountMismatch')
  params: Record<string, unknown>  // interpolation params (e.g., { expected: 5, actual: 3 })
  message: string     // fallback English message
}

// Frontend rendering pattern (MetahubMigrationGuard.tsx):
t(`migrations.blockers.${blocker.code}`, {
  defaultValue: blocker.message,
  ...blocker.params
})

// 15 blocker i18n keys defined in EN/RU locales
```

## Hooks

- `useMetahubMigrationsStatus` — TanStack Query hook using `MIGRATION_STATUS_QUERY_OPTIONS` from shared package
- `useMetahubMigrationsList` — fetches migration history
- `useMetahubMigrationsPlan` — fetches migration plan details

## Entity Settings Tab (Edit Dialog Overlay)

Five entity detail views now include a "Settings" tab that opens an edit dialog overlay (same form as the three-dots → Edit action). The tab uses `EntityFormDialog` with the exported builder functions from the corresponding `*Actions.tsx` file:

- **HubList.tsx** — Hub settings via `HubActions` (buildInitialValues, buildFormTabs, validateHubForm, canSaveHubForm, toPayload)
- **AttributeList.tsx** — Catalog settings via `CatalogActions` (parent catalog context)
- **ConstantList.tsx** — Set settings via `SetActions` (parent set context)
- **EnumerationValueList.tsx** — Enumeration settings via `EnumerationActions` (parent enumeration context)
- **PublicationVersionList.tsx** — Publication settings via `PublicationActions` (uses `buildFormTabs(ctx, metahubId)` signature)

## Create Options Tab

The metahub creation dialog now has a third "Options" tab (`MetahubCreateOptionsTab`) with toggle switches for optional default entities (Hub, Catalog, Set, Enumeration). Branch and Layout toggles are shown as always-on (disabled).
