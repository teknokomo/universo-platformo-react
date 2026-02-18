# Metahubs Backend — AI Agent Guide

## Overview

This package (`@universo/metahubs-backend`) handles **Metahub** and **Application** schema management, including the Unified Application Migration Guard system.

## Migration System Architecture

### Two Parallel Migration Systems

1. **Metahub Migrations** (`src/domains/metahubs/routes/metahubMigrationsRoutes.ts`)
   - Manages the metahub (template) schema (`mhb_{uuid}`)
   - Compares structure version + template version
   - Uses `determineSeverity()` from `@universo/migration-guard-shared/utils`
   - Severity: `MANDATORY` (structure/blockers), `RECOMMENDED` (template only), `OPTIONAL`

2. **Application Migrations** (`src/domains/applications/routes/applicationMigrationsRoutes.ts`)
   - Manages the application schema (`app_{uuid}`)
   - Compares structure version + publication sync status
   - Uses `determineSeverity()` from `@universo/migration-guard-shared/utils`
   - Severity: `MANDATORY` (!schemaExists or structure upgrade), `RECOMMENDED` (publication update), `OPTIONAL`
   - Returns `currentUserRole` and `isMaintenance` for role-based frontend behavior

### Application Sync (`src/domains/applications/routes/applicationSyncRoutes.ts`)

- Acquires a PostgreSQL advisory lock (`app-sync:{applicationId}`) to prevent concurrent syncs
- Sets `schema_status = MAINTENANCE` during sync (visible to non-privileged users as a maintenance page)
- Sets `schema_status = SYNCED` on success, `ERROR` on failure
- Releases the advisory lock in a `finally` block

### Publications & Notifications (`src/domains/publications/routes/publicationsRoutes.ts`)

- `notifyLinkedApplicationsUpdateAvailable()` uses a single UPDATE query with sub-select (no N+1)
- Publication DELETE resets `UPDATE_AVAILABLE` status on linked applications within the same transaction

### Shared Constants

- `TARGET_APP_STRUCTURE_VERSION` lives in `src/domains/applications/constants.ts`
- Imported by both `applicationMigrationsRoutes.ts` and `applicationSyncRoutes.ts`

## Key Types (from `@universo/types`)

- `UpdateSeverity` enum: `MANDATORY | RECOMMENDED | OPTIONAL`
- `MetahubMigrationStatusResponse` — metahub migration status with `severity`
- `ApplicationMigrationStatusResponse` — app migration status with `severity`, `currentUserRole`, `isMaintenance`
- `StructuredBlocker` — structured blocker with `code`, `params`, `message`

## DDL Module

The `src/domains/ddl/` directory contains the schema generation and migration engine:
- `SchemaGenerator` — generates/diffs PostgreSQL schemas from catalog definitions
- `MigrationManager` — records and manages migration history
- `KnexClient` — Knex-based query builder for DDL operations
