# Active Context

> **Last Updated**: 2026-01-31
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Database Pool Error Logging (Completed)

**Status**: Completed; full workspace build verified (64 tasks).

### Summary (2026-01-31)
- Aligned Knex + TypeORM pool sizes to stay within Supabase Pool Size (15).
- Added pool error logging with pool state metrics for Knex and TypeORM.
- Kept connection lifecycle logging lightweight (error-only metrics + connection created log).

### Changed Files
- `packages/metahubs-backend/base/src/domains/ddl/KnexClient.ts` - Pool max set to 8; pool error logging with state metrics
- `packages/flowise-core-backend/base/src/DataSource.ts` - Pool max set to 7; pool error logging with state metrics

### Technical Details

- **Knex pool**: `max: 8` with pool error listener logging `used/free/pending` metrics.
- **TypeORM pool**: `max: 7` with `poolErrorHandler` logging `total/idle/waiting` metrics.

### Previous: VLC String Field UX Fixes (Completed)
- Added versioned mode, maxLength enforcement, and VLC validation improvements in form dialogs.
