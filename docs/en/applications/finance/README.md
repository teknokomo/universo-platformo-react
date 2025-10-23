# Finance Applications

The Finance module provides account, currency, and transaction management as a child resource of Uniks workspaces.

- Frontend package: `@universo/finance-frt`
- Backend package: `@universo/finance-srv`

## Architecture Overview

- Server exposes nested routes under `/api/v1/uniks/:unikId/finance/*` via `createFinanceRouter()`.
- TypeORM integration: `financeEntities` and `financeMigrations` are exported and aggregated in the main server registry.
- UI integration: routes are added inside the Unik workspace scope (e.g., `finance/accounts`, `finance/currencies`).
- i18n: dedicated `finance` namespace is loaded into the main app.

```
packages/
├─ finance-srv/
│  └─ base/
│     ├─ src/database/entities/Transaction.ts
│     ├─ src/database/migrations/postgres/
│     ├─ src/routes/(accountRoutes|currencyRoutes).ts
│     └─ src/index.ts (exports router, entities, migrations)
├─ finance-frt/
│  └─ base/
│     ├─ src/api/finance/(accounts|currencies).ts
│     ├─ src/pages/(AccountList|CurrencyList).jsx
│     ├─ src/i18n/index.js (namespace: finance)
│     └─ src/index.ts (exports menu, i18n, api)
└─ ...
```

## Backend (`@universo/finance-srv`)

- Router: `createFinanceRouter()` mounts sub-resources:
  - `GET/POST /currencies`, `GET/PUT/DELETE /currencies/:id`
  - `GET/POST /accounts`, `GET/PUT/DELETE /accounts/:id`
- Entities:
  - `Transaction` – basic example entity with RLS policies
- Migrations:
  - `AddTransactions1741277504478` creates `transactions` with RLS and optional FKs

### Server Integration

- Add to server dependencies: `"@universo/finance-srv": "workspace:*"`
- Aggregate entities and migrations in the central registries.
- Mount the router in the Uniks route: `createUniksRouter(..., createFinanceRouter())`.

## Frontend (`@universo/finance-frt`)

- Pages: `AccountList.jsx`, `CurrencyList.jsx` under Unik scope.
- API helpers: `/uniks/{unikId}/finance/(accounts|currencies)`.
- i18n namespace: `finance` with EN/RU translations.
- Exported menu section: integrates into Unik dashboard.

### UI Integration

- Add lazy routes inside Unik workspace (e.g., `finance/accounts`, `finance/currencies`).
- Register `financeTranslations` in the main i18n loader.

## Best Practices

- Treat Finance as a child of Uniks to inherit workspace scoping and auth.
- Use TypeORM Repository pattern (no direct DB client usage).
- Keep packages minimal and typed (TypeScript throughout).
- Avoid cyclic deps: frontend libs must not depend on the UI app (`flowise-ui`).

