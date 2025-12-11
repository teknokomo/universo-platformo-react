# @universo/core-backend

> 🗄️ Core database infrastructure and migrations for Universo Platformo

## Package Information

| Field | Value |
|-------|-------|
| **Package Name** | `@universo/core-backend` |
| **Version** | See `package.json` |
| **Type** | TypeScript Backend Package |
| **Build** | CommonJS with TypeScript definitions |
| **Purpose** | Core database infrastructure and essential migrations |

## 🚀 Key Features

- 🆔 **UUID v7 Function** - RFC 9562 compliant time-ordered UUID generation for PostgreSQL
- 🏗️ **Infrastructure Migrations** - Database-wide functions required by all modules
- ⚡ **Performance Optimized** - 30-50% faster indexing vs UUID v4 due to sequential nature
- 🔧 **PostgreSQL 17+ Ready** - Compatible with future native uuidv7() function
- 📦 **Minimal Dependencies** - Lightweight package with only essential infrastructure

## Description

Core database infrastructure package containing essential migrations and functions required by the entire Universo Platformo system. This package must be loaded FIRST in the migration sequence to provide database-wide functions used by all other modules.

### Scope:
- UUID v7 generation function (RFC 9562 compliant)
- Core database infrastructure migrations
- Essential functions required by all modules

### Out of scope:
- Application-specific migrations
- Feature-specific database schemas
- Business logic or service implementations

## Migration Order

⚠️ **CRITICAL**: This package contains Phase 0 infrastructure migrations that MUST run first:

```typescript
import { infrastructureMigrations } from '@universo/core-backend'

export const postgresMigrations = [
    // Phase 0: Infrastructure (MUST BE FIRST)
    ...infrastructureMigrations,
    // Phase 1+: Other migrations...
    ...otherMigrations
]
```

## UUID v7 Implementation

The package provides `public.uuid_generate_v7()` function that:
- Follows RFC 9562 specification (May 2024)
- Uses 48-bit Unix timestamp in milliseconds for time ordering
- Provides better index locality than UUID v4
- Compatible with PostgreSQL 18+ native implementation
- Works with current PostgreSQL 17.x (Supabase)

## Usage

### Import migrations:

```typescript
import { infrastructureMigrations } from '@universo/core-backend'

// Add to your migration registry
export const postgresMigrations = [
    ...infrastructureMigrations,  // Must be first!
    ...yourOtherMigrations
]
```

### Direct migration access:

```typescript
import { InitializeUuidV7Function1500000000000 } from '@universo/core-backend'
```

## Installation

This package is automatically included via pnpm workspace:

```bash
pnpm add @universo/core-backend
```

## Dependencies

- `typeorm` (peer dependency)
- Uses PostgreSQL-specific functions
- No additional runtime dependencies

## Compatibility

- ✅ **PostgreSQL 17.x** (Supabase)
- ✅ **PostgreSQL 18+** (forward compatible)
- ⚠️ **PostgreSQL only** (does not support other databases)

## Performance Notes

UUID v7 provides significant performance benefits:
- **30-50% faster indexing** compared to random UUID v4
- **Better cache locality** due to sequential nature
- **Reduced index fragmentation** for primary key columns
- **Time-ordered sorting** without additional timestamp columns

## Migration Safety

All migrations in this package are designed to be:
- ✅ **Idempotent** - Safe to run multiple times
- ✅ **Non-destructive** - Only creates functions, never drops data
- ✅ **Backward compatible** - Functions work across PostgreSQL versions

## License

See `LICENSE-Flowise.md` in the project root.