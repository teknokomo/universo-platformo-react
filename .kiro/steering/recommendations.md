---
inclusion: always
---

# Recommendations

## 1. General Principles

1.  **Review Local READMEs**: Before starting a task, always review the `README.md` in the relevant package's directory (e.g., `packages/profile-frontend/base/README.md`).
2.  **Adhere to Linters**: Always follow the project's configured linters when writing code to ensure consistency and quality. For linting, use `pnpm --filter <package> lint` instead of global `pnpm lint` to optimize execution time.
3.  **Language**: Respond to the user in Russian. However, all code comments and all information in the `memory-bank` folder must be written in English only.

## 2. Creating New Packages in `packages/`

### 2.1. Workspace Imports

*   **DO**: When importing from another local package in the monorepo, always use the full PNPM workspace package name as defined in its `package.json` (e.g., `import { something } from '@universo/types'`).
*   **DO NOT**: Never use relative paths (`../`) to import across package boundaries.
*   **WHY**: This ensures correct module resolution via PNPM workspaces, prevents circular dependencies, and is critical for eventually extracting packages into separate repositories.

### 2.2. Frontend Packages (TSX)

*   **Technology**: New frontend packages must be written in **TypeScript (TSX)**.
*   **Build System**: Each new package must feature a dual-build system to compile TSX into both **CommonJS** and **ES Modules**.
    *   Use `tsdown` for building packages.
    *   The compiled JavaScript output must be placed in a `dist/` directory within the package.
*   **Integration**: The package's `package.json` must correctly specify the `main` (for CJS) and `module` (for ESM) entry points, pointing to the compiled files in `dist/`.
*   **Data Fetching**: Use TanStack Query (`@tanstack/react-query`) for data fetching and caching in frontend packages.

### 2.3. Backend Packages (Knex + SQL Migrations)

*   **Data Access Pattern**: Direct database calls (e.g., to the Supabase client) are forbidden. All database interaction **must** go through **store modules** that use `DbExecutor.query()` with raw SQL.
*   **Database Target**: Currently, all schemas and migrations should be written for **PostgreSQL**, as it is the only database in use (via Supabase).

### 2.4. Three-Tier DB Access Pattern

*   **Tier 1**: `getRequestDbExecutor(req, getDbExecutor())` for authenticated routes with RLS context.
*   **Tier 2**: `getPoolExecutor()` for admin/bootstrap/background jobs without RLS.
*   **Tier 3**: `getKnex()` only for schema-ddl, migration runners, and explicit DDL boundaries.
*   **WHY**: This ensures proper RLS (Row Level Security) context and prevents security issues.

### 2.5. Knex Boundary Rule

*   Domain route handlers, stores, and services must not import `knex`, `KnexClient`, or call `getKnex()` directly.
*   If a package needs DDL/runtime schema work, isolate it behind a dedicated boundary such as `src/ddl/index.ts`.

### 2.6. SQL Safety Rule

*   Domain SQL must be **schema-qualified** (e.g., `metahubs.metahubs` not just `metahubs`).
*   Use **parameterized queries** with `$1`, `$2`, etc. for PostgreSQL bind parameters.
*   Use helper functions for dynamic identifiers:
    *   `qSchema()` for schema names
    *   `qTable()` for table names
    *   `qColumn()` for column names
    *   `qSchemaTable()` for schema-qualified table names

### 2.7. Mutation Rule

*   UPDATE and DELETE flows should use `RETURNING` when row confirmation matters.
*   Must **fail closed** on zero-row results instead of silently succeeding.
*   Example: `UPDATE ... RETURNING id` and check that a row was returned.

### 2.8. Testing Rule

*   Critical SQL-first stores and service-level mutation contracts need direct tests.
*   Do not rely only on route-level mocks for database operations.

### 2.9. Creating a New Service

When creating a new backend service in `packages/` that requires database access, you must:

1.  **Define SQL Migrations**: Create platform migration definitions in your package's `src/migrations/` directory using `createSchemaMigrationDefinition()` from `@universo/schema-ddl`.
2.  **Register Migrations**: Import your migration definition into `packages/universo-migrations-platform/base/src/platformMigrations.ts` and add it to the `platformMigrations` array.
3.  **Create Store Modules**: Write store files (e.g., `myStore.ts`) that accept a `DbExecutor` and run SQL queries via `executor.query(sql, params)`. Use `$1`, `$2`, etc. for PostgreSQL bind parameters.
4.  **Use Request Executor**: In route handlers, obtain the request-scoped executor via `getRequestDbExecutor(req, getDbExecutor())` from `@universo/utils`. This ensures RLS context is applied.

## 3. Code Quality

### 3.1. Linting

*   Run `pnpm --filter <package> lint` for specific packages.
*   Run `pnpm lint-fix` to auto-fix linting issues.
*   Follow ESLint rules configured in the project.

### 3.2. Testing

*   Write unit tests with Vitest for utilities and services.
*   Write E2E tests with Playwright for critical user flows.
*   Run `pnpm test:vitest` for unit tests.
*   Run `pnpm test:e2e:smoke` for smoke E2E tests.

## 4. Internationalization (i18n)

*   Base locale: English.
*   Full parity locale: Russian.
*   Feature packages register namespaces through package-local `src/i18n/index.ts`.
*   Use `i18next` and `react-i18next` for translations.
*   Ensure all user-facing text is internationalized.

## 5. Security

### 5.1. Authentication

*   Use Passport.js session authentication integrated with Supabase identity.
*   Frontend uses cookie/session + CSRF protection.
*   Backend uses request-scoped auth with RLS-aware database execution.

### 5.2. Access Control

*   Use `WorkspaceAccessService` for workspace-level access control.
*   Unik-scoped routes must use `ensureUnikMembershipResponse(...)` or `requireUnikRole` middleware.
*   Security layers: request-scoped membership validation, RLS fallback, request cache.

### 5.3. Secrets

*   Never commit secrets to version control.
*   Use `.env` files for local development.
*   Keep Supabase keys private.
