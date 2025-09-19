# Finance Server (finance-srv)

Backend workspace package for financial management in the Universo Platformo ecosystem.

## Overview

The Finance Server provides backend routes for handling accounts and currencies inside a workspace.
It exposes REST endpoints for account and currency CRUD operations and integrates with the main platform server.

## Key Features

- **Account CRUD**: Create, read, update and delete accounts
- **Currency CRUD**: Manage currencies and exchange rates per workspace
- **Workspace Integration**: Routes mounted under `/uniks/:unikId/finance`
- **TypeScript Support**: Fully typed Express and TypeORM setup

## Structure

```
src/
├── routes/         # Express routes for finance operations
│   ├── accountRoutes.ts
│   └── currencyRoutes.ts
├── database/       # Database-related files (entities, migrations)
├── types/          # TypeScript declarations
└── index.ts        # Package entry point
```

## API Endpoints

### Accounts

- `GET /uniks/:unikId/finance/accounts`
- `POST /uniks/:unikId/finance/accounts`
- `PUT /uniks/:unikId/finance/accounts/:id`
- `DELETE /uniks/:unikId/finance/accounts/:id`

### Currencies

- `GET /uniks/:unikId/finance/currencies`
- `POST /uniks/:unikId/finance/currencies`
- `PUT /uniks/:unikId/finance/currencies/:id`
- `DELETE /uniks/:unikId/finance/currencies/:id`

## Development

### Prerequisites

- Node.js 18+
- PNPM package manager
- PostgreSQL database
- Supabase project access

### Installation

```bash
pnpm install
pnpm build
pnpm dev
```

### Build Commands

```bash
pnpm build
pnpm dev
pnpm build --filter @universo/finance-srv
```

## Related Documentation

- [Finance Frontend Documentation](../finance-frt/base/README.md)
- [Platform Architecture](../../../docs/en/applications/README.md)

---

**Universo Platformo | Finance Server Package**

See also: Creating New Apps/Packages (best practices)

- ../../../docs/en/universo-platformo/shared-guides/creating-apps.md

## Testing

Run the in-memory route tests with Jest:

```bash
pnpm --filter @universo/finance-srv test
```

The suites exercise the express routers without external services thanks to deterministic UUID mocks.
