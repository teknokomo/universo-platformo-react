---
inclusion: always
---

# Technology Stack

## Core Technologies

- **Node.js**: >=22.6.0 (REQUIRED for isolated-vm 6.x and autoskills tool)
- **PNPM**: >=9 (package manager - NOT npm)
- **TypeScript**: ^5.8.3
- **React**: ^18.3.1
- **Express**: ^4.17.3

**CRITICAL**: Node.js 22+ requires `--no-node-snapshot` flag for isolated-vm compatibility.
This flag is already configured in `packages/universo-core-backend/base/bin/run`.

## Build System

- **Turbo**: ^2.9.3 (Monorepo build orchestration)
- **Vite**: ^5.4.19 (Frontend development server)
- **tsdown**: 0.15.7 (TypeScript bundler for packages)
- **TSC**: TypeScript compilation

## Database & Storage

- **Supabase**: Authentication and multi-user functionality
- **PostgreSQL**: Primary database (via Supabase)
- **Knex**: ^3.1.0 (SQL query builder)
- **pg**: ^8.11.1 (PostgreSQL client)
- **Redis**: ^5.8.2 (caching/sessions/rate limiting)

## Key Libraries

### Frontend

- **Material-UI**: ^7.3.7 (UI components)
- **TanStack Query**: ^5.62.13 (data fetching and caching)
- **React Router**: ^6.28.0 (routing)
- **ReactFlow**: ^11.5.6 (node editor)
- **i18next**: 23.16.8 (internationalization)
- **react-i18next**: 15.5.3 (React bindings for i18next)
- **Zod**: ^3.25.76 (schema validation)
- **react-hook-form**: ^7.54.2 (form management)
- **Framer Motion**: ^10.16.4 (animations)

### Backend

- **Passport.js**: Authentication middleware
- **isolated-vm**: Server-side scripting isolation
- **express-rate-limit**: ^8.2.0 (rate limiting)
- **http-errors**: ^2.0.0 (HTTP error handling)

### Testing

- **Playwright**: ^1.58.2 (E2E testing)
- **Vitest**: ^2.1.8 (unit testing)
- **@testing-library/react**: ^14.3.1 (React testing)
- **happy-dom**: ^20.8.8 (DOM environment for tests)

## Common Commands

### Installation & Setup

```bash
pnpm install                    # Install all dependencies
```

### Development (use only when absolutely necessary)

```bash
pnpm dev                        # Start all apps in development mode
pnpm --filter <package-name> dev    # Start specific package in dev mode
```

### Building

```bash
pnpm build                      # Build all packages and apps
pnpm build-force               # Clean build (with --force)
pnpm --filter <package-name> build # Build specific package
```

### Starting Production

```bash
pnpm start                     # Start production server
pnpm start-worker             # Start worker process
```

### Maintenance

```bash
pnpm clean                     # Clean build artifacts
pnpm clean:all                # Clean everything including node_modules
pnpm nuke                     # Nuclear clean (packages only)
```

### Code Quality

```bash
pnpm lint                     # Run ESLint
pnpm lint-fix                 # Fix linting issues
pnpm format                   # Format with Prettier
```

### Testing

```bash
pnpm test:vitest              # Run unit tests
pnpm test:e2e:smoke           # Run smoke E2E tests
pnpm test:e2e:flows           # Run flow E2E tests
pnpm test:e2e:full            # Run full E2E test suite
```

### Migrations

```bash
pnpm migration:status         # Check migration status
pnpm migration:plan           # Plan migrations
pnpm migration:diff           # Show migration diff
pnpm migration:sync           # Sync migrations
```

## Environment Setup

- Create `.env` in `packages/universo-core-backend/base/` with Supabase configuration
- Required environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_JWT_SECRET`
  - `DATABASE_URL` (for direct PostgreSQL connection)

## DDL & Migrations System

The platform uses a custom DDL (Data Definition Language) system:

- **@universo/schema-ddl**: Runtime schema generation, migration, and diff utilities
- **@universo/migrations-core**: Core migration runtime and execution helpers
- **@universo/migrations-platform**: Platform-wide migration registry and CLI
- **@universo/migrations-catalog**: Catalog storage for migration history

Key features:
- Schema-qualified SQL with parameterized queries
- Request-scoped database executors for RLS
- Platform and application-level migrations
- Runtime schema synchronization

## UUID v7

The project uses UUID v7 for time-ordered identifiers:
- PostgreSQL function: `public.uuid_generate_v7()`
- Application generation: `uuidv7` package (^1.1.0)
