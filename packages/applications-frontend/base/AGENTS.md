# Applications Frontend — AI Agent Guide

## Overview

This package (`@universo/applications-frontend`) provides the React UI for standalone applications, including the **Application Migration Guard** system.

## Migration Guard Architecture

### Guard Chain

```
AuthGuard → ApplicationMigrationGuard → ApplicationRuntime (children)
```

### ApplicationMigrationGuard (`src/components/ApplicationMigrationGuard.tsx`)

Route guard that checks migration status before allowing access to application pages. Uses `MigrationGuardShell` from `@universo/migration-guard-shared` for common guard logic.

**Decision flow:**
1. No `applicationId` or admin route → pass through
2. Loading/error → show spinner/alert
3. No migration required or `OPTIONAL` severity → pass through
4. `RECOMMENDED` + dismissed → pass through
5. `MANDATORY` + no schema → `<UnderDevelopmentPage />`
6. Maintenance + non-privileged user → `<MaintenancePage />`
7. Otherwise → migration dialog (with "Continue anyway" for non-mandatory)

**Role-based behavior:**
- `isPrivileged` = `owner` or `admin` (from `status.currentUserRole`)
- Privileged users see the migration dialog with sync controls
- Non-privileged users see `MaintenancePage` during active syncs

### Pages

- `UnderDevelopmentPage` (`src/pages/UnderDevelopmentPage.tsx`) — shown when schema doesn't exist yet
- `MaintenancePage` (`src/pages/MaintenancePage.tsx`) — shown during active sync for non-privileged users

### API Hook

- `useApplicationMigrationStatus` (`src/hooks/useApplicationMigrationStatus.ts`) — TanStack Query hook fetching `/application/:id/migrations/status`. Uses `MIGRATION_STATUS_QUERY_OPTIONS` from shared package.

### i18n Keys

- `migrationGuard.*` — dialog titles, descriptions, buttons
- `migrationGuard.blockers.*` — blocker messages (mirrors `metahubs` blockers)
- `underDevelopment.*` — under-development page text
- `maintenance.*` — maintenance page text

Locales: `src/i18n/locales/en/applications.json`, `src/i18n/locales/ru/applications.json`

## Key Types (from `@universo/types`)

- `UpdateSeverity` enum: `MANDATORY | RECOMMENDED | OPTIONAL`
- `ApplicationMigrationStatusResponse` — includes `severity`, `currentUserRole`, `isMaintenance`
