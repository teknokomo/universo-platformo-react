---
applyTo: '**'
---
# Recommendations

## 1. General Principles

1.  **Review Local READMEs**: Before starting a task, always review the `README.md` in the relevant package's directory (e.g., `apps/profile-frt/base/README.md`).
2.  **Adhere to Linters**: Always follow the project's configured linters when writing code to ensure consistency and quality. For linting, use `pnpm --filter <package> lint` instead of global `pnpm lint` to optimize execution time in the large workspace.
3.  **Language**: Respond to the user in Russian. However, all code comments and all information in the `memory-bank` folder must be written in English only.

## 2. Creating New Packages in `apps/`

### 2.1. Workspace Imports

*   **DO**: When importing from another local package in the monorepo, always use the full PNPM workspace package name as defined in its `package.json` (e.g., `import { something } from '@universo/types'`).
*   **DO NOT**: Never use relative paths (`../`) to import across package boundaries.
*   **WHY**: This ensures correct module resolution via PNPM workspaces, prevents circular dependencies, and is critical for eventually extracting packages into separate repositories.

### 2.2. Frontend Packages (TSX)

*   **Technology**: New frontend packages must be written in **TypeScript (TSX)**.
*   **Build System**: Each new package must feature a dual-build system (similar to `apps/space-builder-frt`) to compile TSX into both **CommonJS** and **ES Modules**.
    *   Use two `tsconfig.json` files (`tsconfig.json` for CJS, `tsconfig.esm.json` for ESM).
    *   The compiled JavaScript output must be placed in a `dist/` directory within the package.
*   **Integration**: The package's `package.json` must correctly specify the `main` (for CJS) and `module` (for ESM) entry points, pointing to the compiled files in `dist/`. This allows new TSX components to be directly imported into the existing JSX codebase (`packages/ui`) as standard dependencies.

### 2.3. Backend Packages (TypeORM)

*   **Data Access Pattern**: Direct database calls (e.g., to the Supabase client) are forbidden. All database interaction **must** go through the **TypeORM Repository pattern**.
*   **Database Target**: Currently, all entities and migrations should be written for **PostgreSQL**, as it is the only database in use (via Supabase).
*   **Creating a New Service**: When creating a new backend service in `apps/` that requires database access, you must:
    1.  **Define Entities**: Create TypeORM entity classes for your tables inside your package's `src/database/entities/` directory.
    2.  **Register Entities**: Import and export your new entities from the central registry file: `packages/server/src/database/entities/index.ts`.
    3.  **Define & Register Migrations**:
        a. Create TypeORM migration files for any schema changes inside your package's `src/database/migrations/postgres/` directory.
        b. Create an `index.ts` file in that same directory that exports an array containing all of your package's migrations (e.g., `export const myAppMigrations = [Migration1, Migration2]`).
        c. Import your package's migration array into the central registry (`packages/server/src/database/migrations/postgres/index.ts`) and spread it into the main `postgresMigrations` array.
    4.  **Use Repositories**: In your service logic, get the shared `DataSource` via `getDataSource()` from `packages/server/src/DataSource.ts`. Use it to get a repository for your entity (e.g., `getDataSource().getRepository(YourEntity)`) to perform all database operations.
