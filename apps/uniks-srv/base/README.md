# Uniks Service Backend (@universo/uniks-srv)

Backend module providing Express routes and TypeORM entities for the **Uniks** (workspace) feature in Universo Platformo.

## Project Structure

```
apps/uniks-srv/base/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts               # Package exports
    ├── routes/
    │   └── uniksRoutes.ts     # `createUniksRouter` factory
    └── database/
        ├── entities/
        │   ├── Unik.ts
        │   └── UserUnik.ts
        └── migrations/postgres/
            ├── 1741277504476-AddUniks.ts
            └── index.ts       # `uniksMigrations`
```

## Exports

- `createUniksRouter(ensureAuth, supabase)` – Express router with nested routes
- `Unik`, `UserUnik` – TypeORM entities
- `uniksMigrations` – array of database migrations

## Usage

```ts
import { createUniksRouter, uniksMigrations } from '@universo/uniks-srv'
```

This package is designed as a scoped workspace module and can be extracted to a standalone repository in the future.
