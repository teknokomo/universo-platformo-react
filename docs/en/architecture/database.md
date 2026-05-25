---
description: Describe the PostgreSQL, Knex, migration, and schema-evolution model.
---

# Database Design

The current repository uses PostgreSQL, typically through Supabase, with a
shared Knex-based runtime.

## Current Model

- `@universo-react/database` owns the shared Knex runtime and executor helpers.
- Request-scoped execution is used where auth and RLS context must be applied.
- `@universo-react/migrations-platform` registers and runs platform migrations.
- `@universo-react/schema-ddl` provides runtime schema generation and diff utilities.

## Design Goals

The database layer is built for controlled schema evolution, soft-delete-aware
business domains, migration visibility, and exportable definitions.

That makes the data layer part of the platform kernel and its operational model.
