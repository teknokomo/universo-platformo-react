# Universo Core Backend

✅ **Modern Package** — `@universo/core-backend`

## Overview

The main backend server for Universo Platformo. This is the central Express-based application that boots the HTTP server, connects to PostgreSQL via TypeORM, sets up authentication middleware, registers all API routes, and integrates feature-specific `@universo/*` backend packages.

## Package Information

- **Package**: `@universo/core-backend`
- **Version**: `0.1.0`
- **Type**: Backend Server (Modern)
- **Framework**: Express.js + TypeORM + OCLIF CLI
- **Language**: TypeScript
- **Database**: PostgreSQL via Supabase
- **Authentication**: Passport.js + JWT + Supabase integration

## Key Features

### 🎯 Core Server Functionality
- **Express API Server**: REST API with rate limiting, CORS, and body parsing
- **TypeORM DataSource**: Centralized database connection with migration runner
- **Entity & Migration Registry**: All packages register entities and migrations through the core
- **OCLIF CLI**: `universo start` command with configurable port and host

### 🔐 Security
- **CSRF Protection**: Token-based CSRF middleware
- **Rate Limiting**: Express rate limiter with configurable window
- **Request Sanitization**: XSS protection middleware
- **Session Management**: Passport.js with secure cookie sessions
- **API Key Validation**: Multi-layer auth (JWT → session → API key fallback)

### 🏗️ Architecture
- **Modular Routes**: Feature routes imported from `@universo/*` backend packages
- **Error Handling**: Centralized error middleware with `InternalError` class
- **Queue Management**: Redis-based job queue for background processing
- **Metrics**: Prometheus and OpenTelemetry integration (optional)
- **Multiplayer**: Colyseus server integration for real-time features

## CLI Commands (OCLIF)

```bash
# Start the server
pnpm start

# Start in development mode (from project root)
pnpm dev
```

## Architecture

### Boot Sequence

```
bin/run                        → OCLIF CLI entry point
  └─ commands/start.ts         → Start command
       └─ index.ts (App)       → Express application class
            ├─ DataSource.ts   → TypeORM connection + migrations
            ├─ middlewares/     → Auth, CSRF, rate-limit, error handling
            ├─ routes/         → API v1 router (aggregates feature routes)
            └─ utils/          → Server utilities (paths, versions)
```

### Key Modules

| Module | Purpose |
|---|---|
| `index.ts` | `App` class — Express setup, middleware chain, route mounting |
| `DataSource.ts` | TypeORM DataSource factory with pool management |
| `routes/` | API v1 router that imports feature-specific routers |
| `middlewares/errors/` | Centralized Express error handler |
| `errors/internalError/` | `InternalError` custom HTTP error class |
| `utils/` | `getUserHome()`, `getAppVersion()`, path utilities |
| `database/entities/` | Central entity registry (all packages register here) |
| `database/migrations/` | Central migration registry (Postgres) |

### Data Directory

The server stores runtime data in `~/.universo/` (configurable via `UNIVERSO_PATH` env var, with `FLOWISE_PATH` fallback for backward compatibility).

## File Structure

```
packages/universo-core-backend/
└── base/
    ├── bin/                    # CLI entry point (OCLIF)
    ├── src/
    │   ├── commands/           # OCLIF commands (start)
    │   ├── database/
    │   │   ├── entities/       # Central entity registry
    │   │   └── migrations/     # Central migration registry (postgres)
    │   ├── errors/
    │   │   └── internalError/  # InternalError HTTP error class
    │   ├── middlewares/
    │   │   └── errors/         # Express error handler
    │   ├── routes/             # API v1 router
    │   ├── utils/              # Server utilities
    │   ├── DataSource.ts       # TypeORM DataSource factory
    │   ├── Interface.ts        # Shared TypeScript interfaces
    │   └── index.ts            # Express App class (main server)
    ├── package.json
    ├── README.md
    └── README-RU.md
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_JWT_SECRET` | Yes | JWT secret for token verification |
| `UNIVERSO_PATH` | No | Custom data directory (default: `~/.universo`) |
| `FILE_SIZE_LIMIT` | No | Max upload file size (default: `50mb`) |
| `PORT` | No | Server port (default: `3000`) |

### Adding Entities & Migrations

Feature packages register their TypeORM entities and migrations through the central registries:

```typescript
// 1. Define entity in your package
// packages/your-backend/base/src/database/entities/YourEntity.ts

// 2. Register in central entity registry
// packages/universo-core-backend/base/src/database/entities/index.ts
export { YourEntity } from '@universo/your-backend/entities'

// 3. Register migrations in central migration registry
// packages/universo-core-backend/base/src/database/migrations/postgres/index.ts
import { yourMigrations } from '@universo/your-backend/migrations'
export const postgresMigrations = [...yourMigrations, ...]
```

## Development

```bash
# From project root
pnpm install
pnpm build              # Full workspace build
pnpm start              # Start production server
```

> **Note**: Always run commands from the project root. Individual package builds are for validation only — use `pnpm build` at root to propagate changes.

## Related Packages

- [universo-core-frontend](../../universo-core-frontend/base/README.md) — React frontend application
- [universo-types](../../universo-types/base/README.md) — Shared TypeScript types
- [universo-utils](../../universo-utils/base/README.md) — Shared utilities (UUID, codename, etc.)
- [auth-backend](../../auth-backend/base/README.md) — Authentication service
