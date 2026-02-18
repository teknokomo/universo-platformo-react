# Metahubs Frontend — AI Agent Guide

## Overview

This package (`@universo/metahubs-frontend`) provides the React UI for metahub management, including the **Metahub Migration Guard** system and the migrations management page.

## Migration Guard Architecture

### Guard Chain

```
AuthGuard → MetahubMigrationGuard → MetahubDashboard (children)
```

### MetahubMigrationGuard (`src/domains/migrations/ui/MetahubMigrationGuard.tsx`)

Route guard that checks migration status before allowing access to metahub pages. Uses `MigrationGuardShell` from `@universo/migration-guard-shared` for common guard logic.

**Decision flow (handled by MigrationGuardShell):**
1. No `metahubId` or migrations route → pass through
2. Loading/error → show spinner/alert
3. No migration required or `OPTIONAL` severity → pass through
4. `RECOMMENDED` + dismissed → pass through
5. Otherwise → migration dialog

**Metahub-specific dialog features:**
- Structure upgrade chip (shows if structure upgrade is needed)
- Template upgrade chip (shows if template upgrade is needed)
- "Apply (keep user data)" button — applies migrations directly from the dialog
- "Open migrations" button — navigates to `/metahub/:id/migrations`
- Apply state management (loading/error during apply)

### Hooks

- `useMetahubMigrationsStatus` (`src/domains/migrations/hooks/useMetahubMigrations.ts`) — TanStack Query hook fetching migration status. Uses `MIGRATION_STATUS_QUERY_OPTIONS` from shared package.
- `useMetahubMigrationsList` — fetches migration history list
- `useMetahubMigrationsPlan` — fetches migration plan details

### API

- `applyMetahubMigrations` (`src/domains/migrations/api/`) — POST to apply migrations with cleanup mode
- `listMetahubMigrations` — GET migration history
- `planMetahubMigrations` — GET migration plan
- `getMetahubMigrationsStatus` — GET migration status

### Tests

- `src/domains/migrations/ui/__tests__/MetahubMigrationGuard.test.tsx` — unit tests for guard behavior
- `src/domains/migrations/hooks/__tests__/useMetahubMigrations.test.ts` — unit tests for hooks

### i18n Keys

- `migrations.guard.*` — dialog titles, descriptions, buttons
- `migrations.blockers.*` — blocker messages
- `migrations.structureUpgradeNeeded` / `migrations.templateUpgradeNeeded` — chip labels
- `migrations.applying` — loading state text

Locales: `src/i18n/locales/en/metahubs.json`, `src/i18n/locales/ru/metahubs.json`

## Key Types (from `@universo/types`)

- `UpdateSeverity` enum: `MANDATORY | RECOMMENDED | OPTIONAL`
- `MetahubMigrationStatusResponse` — includes `severity`, `structureUpgradeRequired`, `templateUpgradeRequired`

## Shared Dependencies

- `@universo/migration-guard-shared` — `MigrationGuardShell`, `MIGRATION_STATUS_QUERY_OPTIONS`
- `@universo/types` — type definitions
- `@universo/utils` — `extractAxiosError`
