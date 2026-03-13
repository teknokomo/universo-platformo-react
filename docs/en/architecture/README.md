---
description: Repository-level architecture for Universo Platformo React.
---

# Architecture

This section documents the current repository architecture as it exists today.

The repository is now best understood as a PNPM monorepo that assembles a
shared platform runtime, feature packages, migration tooling, documentation
packages, and a React frontend shell around a SQL-first backend.

## Core Principles

- Keep business domains in focused packages.
- Use Supabase (PostgreSQL) with shared Knex-based runtime services.
- Prefer SQL-first stores and neutral executor contracts.
- Keep frontend features modular and assembled by the core shell.
- Treat migrations, schema evolution, and docs as first-class platform concerns.

Read [Fixed System-App Convergence](system-app-convergence.md) for the converged fixed-schema model used by admin, profiles, metahubs, and applications.

Read [Optional Global Catalog](optional-global-catalog.md) for the disabled-by-default registry mode, release-bundle workflow, and operator recovery boundaries.

Read the pages below for structure, backend, frontend, database, and auth details.
