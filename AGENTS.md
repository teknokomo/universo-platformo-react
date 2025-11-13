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

10. All these Custom Modes use the rules that are in .gemini/rules/custom_modes

# Repository Guidelines

## Project Structure & Module Organization
- Monorepo with feature apps under `packages/`.
  - Examples: `packages/publish-frt` (React front end), `packages/publish-srv` (Node/Express back end), `packages/updl` (UPDL tools).
  - Each app contains a `base/` directory for the default implementation.
- Front-end apps include `i18n/` with default locales `en/` and `ru/`.
- Context docs and planning live in `memory-bank/` (`productContext`, `techContext`, `progress`, `tasks`).
- Extends Flowise AI with Supabase multi-user features; keep upstream changes minimal and isolated.

## Build, Test, and Development Commands
- `pnpm install`: Install workspace dependencies.
- `pnpm dev`: Start development servers (run from the target app directory when applicable). Important: due to repo size and resource usage, only the user should run this locally; agents must not run it automatically.
- `pnpm --filter <package> build`: Build a single package to validate it quickly (e.g., lint/type errors). Note: changes are fully applied across the workspace only after a full root rebuild.
- `pnpm build` (root): Full workspace rebuild; required to propagate changes (even for a single package) and ensure cross-dependency consistency.
- `pnpm start`: Run production server(s) for built apps.
- `pnpm lint`: Run ESLint across the workspace.

## Coding Style & Naming Conventions
- Prefer TypeScript where present; otherwise modern ES modules.
- Indentation: 2 spaces; avoid trailing whitespace.
- React: `PascalCase` components, `camelCase` hooks/utils, `kebab-case` folders/files.
- i18n keys use dot notation (e.g., `auth.login.button`).
- Keep changes to original Flowise code minimal and well-scoped.
- Branch names use English only (e.g., `feature/publish-workflow`, `fix/updl-parser`).

## Testing Guidelines
- Tests live near code in `__tests__/` or `tests/` when present.
- Write unit tests for utilities and integration tests for API routes.
- Run via `pnpm test` if configured in the target app; otherwise document manual steps in the PR.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, with optional scope (e.g., `feat(publish-frt): add i18n loader`).
- PRs include: clear description, linked issues, screenshots for UI, and notes on env vars or migrations.
- Small, focused PRs are preferred; include `packages/*/base` paths in the scope when relevant.

## Security & Configuration Tips
- Never commit secrets. Use `.env`/`.env.local` and keep Supabase keys private.
- If provided, copy example envs (e.g., `cp .env.example .env`) and update per app.

# Recommendations

## 1. General Principles

1.  **Review Local READMEs**: Before starting a task, always review the `README.md` in the relevant package's directory (e.g., `packages/profile-frt/base/README.md`).
2.  **Adhere to Linters**: Always follow the project's configured linters when writing code to ensure consistency and quality.
3.  **Language**: Respond to the user in Russian. However, all code comments and all information in the `memory-bank` folder must be written in English only.

## 2. Creating New Packages in `packages/<package-name>`

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