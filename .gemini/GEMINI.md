ATTENTION!!! These are your basic rules of work, always take them into account !!! It is forbidden to perform any actions without taking into account these basic rules of work !!! Only taking into account these basic rules of work allows you to work efficiently and do what the user needs !!! Thanks to these basic rules, you get the right context for your work.

# Custom Modes

1. If the user message starts with VAN command, then you need to work and perform all the actions according to Custom Mode .gemini/rules/custom_modes/van_mode.md and then execute the instructions indicated in this file, upload the files specified in this Custom Mode.

2. If the user message starts with PLAN command, then you need to work and perform all the actions according to Custom Mode .gemini/rules/custom_modes/plan_mode.md and then execute the instructions indicated in this file, upload the files specified in this Custom Mode.

3. If the user message starts with CREATIVE or DESIGN command, then you need to work and perform all the actions according to Custom Mode .gemini/rules/custom_modes/creative_mode.md and then execute the instructions indicated in this file, upload the files specified in this Custom Mode.

4. If the user message starts with IMPLEMENT or IMP command, then you need to work and perform all the actions according to Custom Mode .gemini/rules/custom_modes/implement_mode.md and then execute the instructions indicated in this file, upload the files specified in this Custom Mode.

5. If the user message starts with QA command, then you need to work and perform all the actions according to Custom Mode .gemini/rules/custom_modes/qa_mode.md and then execute the instructions indicated in this file, upload the files specified in this Custom Mode.

6. If the user message starts with REFLECT or REF command, then you need to work and perform all the actions according to Custom Mode .gemini/rules/custom_modes/reflect_mode.md and then execute the instructions indicated in this file, upload the files specified in this Custom Mode.

7. If the user message starts with ARCHIVE or ARC or ARH command, then you need to work and perform all the actions according to Custom Mode .gemini/rules/custom_modes/archive_mode.md and then execute the instructions indicated in this file, upload the files specified in this Custom Mode.

8. If the user message starts with DOCS or DOC command, then you need to work and perform all the actions according to Custom Mode .gemini/rules/custom_modes/docs_mode.md and then execute the instructions indicated in this file, upload the files specified in this Custom Mode.

9. If the user message starts with GIT command, then you need to work and perform all the actions according to Custom Mode .gemini/rules/custom_modes/git_mode.md and then execute the instructions indicated in this file, upload the files specified in this Custom Mode.

10. All these Custom Modes use the rules that are in .gemini/rules/isolation_rules

# Rules

1. When you want to update any file in memory-bank, including activeContext.md, tasks.md, progress.md, productContext.md, systemPatterns.md, techContext.md and any other in this folder, follow the rule .gemini/rules/memory-bank.md

2. We are using PNPM in our current project not npm/yarn, follow the rule .gemini/rules/pnpm-not-npm.md

3. When to write an Issue for GitHub, follow the rule .gemini/rules/github-issues.md

4. When you are asked to update Readme files or other documentation files, follow the rule .gemini/rules/i18n-docs.md

# Recommendations

## 1. General Principles

1.  **Review Local READMEs**: Before starting a task, always review the `README.md` in the relevant package's directory (e.g., `packages/profile-frt/base/README.md`).
2.  **Adhere to Linters**: Always follow the project's configured linters when writing code to ensure consistency and quality.
3.  **Language**: Respond to the user in Russian. However, all code comments and all information in the `memory-bank` folder must be written in English only.

## 2. Creating New Packages in `packages/`

### 2.1. Workspace Imports

*   **DO**: When importing from another local package in the monorepo, always use the full PNPM workspace package name as defined in its `package.json` (e.g., `import { something } from '@universo/types'`).
*   **DO NOT**: Never use relative paths (`../`) to import across package boundaries.
*   **WHY**: This ensures correct module resolution via PNPM workspaces, prevents circular dependencies, and is critical for eventually extracting packages into separate repositories.

### 2.2. Frontend Packages (TSX)

*   **Technology**: New frontend packages must be written in **TypeScript (TSX)**.
*   **Build System**: Each new package must feature a dual-build system (similar to `packages/space-builder-frt`) to compile TSX into both **CommonJS** and **ES Modules**.
    *   Use two `tsconfig.json` files (`tsconfig.json` for CJS, `tsconfig.esm.json` for ESM).
    *   The compiled JavaScript output must be placed in a `dist/` directory within the package.
*   **Integration**: The package's `package.json` must correctly specify the `main` (for CJS) and `module` (for ESM) entry points, pointing to the compiled files in `dist/`. This allows new TSX components to be directly imported into the existing JSX codebase (`packages/flowise-ui`) as standard dependencies.

### 2.3. Backend Packages (TypeORM)

*   **Data Access Pattern**: Direct database calls (e.g., to the Supabase client) are forbidden. All database interaction **must** go through the **TypeORM Repository pattern**.
*   **Database Target**: Currently, all entities and migrations should be written for **PostgreSQL**, as it is the only database in use (via Supabase).
*   **Creating a New Service**: When creating a new backend service in `packages/` that requires database access, you must:
    1.  **Define Entities**: Create TypeORM entity classes for your tables inside your package's `src/database/entities/` directory.
    2.  **Register Entities**: Import and export your new entities from the central registry file: `packages/flowise-server/src/database/entities/index.ts`.
    3.  **Define & Register Migrations**:
        a. Create TypeORM migration files for any schema changes inside your package's `src/database/migrations/postgres/` directory.
        b. Create an `index.ts` file in that same directory that exports an array containing all of your package's migrations (e.g., `export const myAppMigrations = [Migration1, Migration2]`).
        c. Import your package's migration array into the central registry (`packages/flowise-server/src/database/migrations/postgres/index.ts`) and spread it into the main `postgresMigrations` array.
    4.  **Use Repositories**: In your service logic, get the shared `DataSource` via `getDataSource()` from `packages/flowise-server/src/DataSource.ts`. Use it to get a repository for your entity (e.g., `getDataSource().getRepository(YourEntity)`) to perform all database operations.