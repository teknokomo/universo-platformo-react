# Migration Guard Shared — AI Agent Guide

## Overview

This package (`@universo/migration-guard-shared`) provides shared utilities and React components for the Unified Application Migration Guard system, used by both `@universo/applications-frontend` and `@universo/metahubs-frontend`.

## Exports

### Pure Utilities (backend-safe, import from `@universo/migration-guard-shared/utils`)

- **`determineSeverity(options)`** — derives `UpdateSeverity` from migration flags
  - Input: `{ migrationRequired: boolean, isMandatory: boolean }`
  - Output: `UpdateSeverity.MANDATORY | RECOMMENDED | OPTIONAL`
  - Used by `applicationMigrationsRoutes.ts` and `metahubMigrationsRoutes.ts`

- **`MIGRATION_STATUS_QUERY_OPTIONS`** — shared TanStack React Query options
  - `refetchOnWindowFocus: false`, `retry: false`, `staleTime: 30_000`, etc.
  - Used by `useApplicationMigrationStatus` and `useMetahubMigrationsStatus`

### React Components (frontend only)

- **`MigrationGuardShell<TStatus>`** — render-props shell component
  - Handles common guard logic: entityId check, route skip, loading/error states, severity checks, dismissed state, dialog container
  - Domain-specific rendering via render-prop slots:
    - `renderPreDialog` — interceptor for special pages (UnderDevelopmentPage, MaintenancePage)
    - `renderDialogTitle` — dialog title
    - `renderDialogContent` — chips, descriptions, blockers
    - `renderDialogActions` — action buttons

### Types

- `BaseMigrationStatus` — minimal status shape: `{ migrationRequired, severity, blockers? }`
- `GuardRenderContext<TStatus>` — context passed to render-props: `{ status, isMandatory, hasBlockers, onDismiss, onRetry }`
- `MigrationGuardShellProps<TStatus>` — full props interface
- `DetermineSeverityOptions` — input for `determineSeverity`

## Build

Uses `tsdown` with dual-format output (ESM + CJS) and two entry points:
- `index` — full package (React components + utilities)
- `utils` — backend-safe utilities only (no React/MUI dependencies)

React, MUI, TanStack Query are peer dependencies (only needed for the `index` entry).

## Consumers

- `@universo/applications-frontend` — `ApplicationMigrationGuard` uses `MigrationGuardShell`
- `@universo/metahubs-frontend` — `MetahubMigrationGuard` uses `MigrationGuardShell`
- `@universo/metahubs-backend` — uses `determineSeverity` via `@universo/migration-guard-shared/utils`
