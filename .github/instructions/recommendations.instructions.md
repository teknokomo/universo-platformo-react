---
applyTo: '**'
---

# Recommendations

## 1. General Principles

1.  **Review Local READMEs**: Before starting a task, always review the `README.md` in the relevant package's directory (e.g., `packages/profile-frontend/base/README.md`).
2.  **Adhere to Linters**: Always follow the project's configured linters when writing code to ensure consistency and quality. For linting, use `pnpm --filter <package> lint` instead of global `pnpm lint` to optimize execution time in the large workspace.
3.  **Language**: Respond to the user in Russian. However, all code comments and all information in the `memory-bank` folder must be written in English only.

## 2. Creating New Packages in `packages/`

### 2.1. Workspace Imports

-   **DO**: When importing from another local package in the monorepo, always use the full PNPM workspace package name as defined in its `package.json` (e.g., `import { something } from '@universo/types'`).
-   **DO NOT**: Never use relative paths (`../`) to import across package boundaries.
-   **WHY**: This ensures correct module resolution via PNPM workspaces, prevents circular dependencies, and is critical for eventually extracting packages into separate repositories.

### 2.2. Frontend Packages (TSX)

-   **Technology**: New frontend packages must be written in **TypeScript (TSX)**.
-   **Build System**: Each new package must feature a dual-build system (similar to `packages/space-builder-frontend`) to compile TSX into both **CommonJS** and **ES Modules**.
    -   Use two `tsconfig.json` files (`tsconfig.json` for CJS, `tsconfig.esm.json` for ESM).
    -   The compiled JavaScript output must be placed in a `dist/` directory within the package.
-   **Integration**: The package's `package.json` must correctly specify the `main` (for CJS) and `module` (for ESM) entry points, pointing to the compiled files in `dist/`. This allows new TSX components to be directly imported into the existing codebase (`packages/universo-core-frontend/base`) as standard dependencies.

### 2.3. Backend Packages (Knex + SQL Migrations)

-   **Data Access Pattern**: Direct database calls (e.g., to the Supabase client) are forbidden. All database interaction **must** go through **store modules** that use `DbExecutor.query()` with raw SQL.
-   **Database Target**: Currently, all schemas and migrations should be written for **PostgreSQL**, as it is the only database in use (via Supabase).
-   **Creating a New Service**: When creating a new backend service in `packages/` that requires database access, you must:
    1.  **Define SQL Migrations**: Create platform migration definitions in your package's `src/migrations/` directory using `createSchemaMigrationDefinition()` from `@universo/schema-ddl`.
    2.  **Register Migrations**: Import your migration definition into `packages/universo-migrations-platform/base/src/platformMigrations.ts` and add it to the `platformMigrations` array.
    3.  **Create Store Modules**: Write store files (e.g., `myStore.ts`) that accept a `DbExecutor` and run SQL queries via `executor.query(sql, params)`. Use `$1`, `$2`, etc. for PostgreSQL bind parameters.
    4.  **Use Request Executor**: In route handlers, obtain the request-scoped executor via `getRequestDbExecutor(req, getDbExecutor())` from `@universo/utils`. This ensures RLS context is applied.
