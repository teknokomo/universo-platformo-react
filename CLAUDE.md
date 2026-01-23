ATTENTION!!! These are your basic rules of work, always take them into account !!! It is forbidden to perform any actions without taking into account these basic rules of work !!! Only taking into account these basic rules of work allows you to work efficiently and do what the user needs !!! Thanks to these basic rules, you get the right context for your work.

# Custom Agents

The project uses a structured workflow with specialized agents. Each agent is located in `.claude/agents/` directory.

## Available Agents:

1. **van** - Initial analysis mode. Analyses context, estimates task complexity (Level 1-4), and recommends the next workflow step.

2. **plan** - Planning mode. Produces a structured, step-by-step implementation plan before any code is written.

3. **creative** - Design mode. Explores and documents alternative designs—architecture, algorithms, UI/UX—before any code is written.

4. **implement** - Implementation mode. Turns the approved plan into working code and updates the task checklist accordingly.

5. **qa** - Quality Assurance mode. Verifies code or documentation quality and reports issues, without fixing them.

6. **reflect** - Reflection mode. Post-implementation review stage for analyzing and documenting results.

7. **archive** - Archive mode. Finalises documentation and stores the feature in the project archive.

8. **docs** - Documentation mode. Generates or updates multilingual user-facing documentation.

9. **git-push** - Git Push mode. Automates committing changes, creating GitHub issues, and opening pull requests.

10. **git-pull** - Git Pull mode. Safely pulls updates with stash-first approach and conflict resolution.

11. **mb** - Memory Bank mode. Compresses Memory Bank files while preserving critical knowledge.

12. **devops** - DevOps mode. Automated deployment with zero-downtime updates, maintenance mode, and rollback capabilities.

## Typical Workflow:

```
VAN → PLAN → [CREATIVE] → IMPLEMENT → QA → REFLECT → ARCHIVE → [DOCS]
```

# Rules

1. When you want to update any file in memory-bank, including activeContext.md, tasks.md, progress.md, productContext.md, systemPatterns.md, techContext.md and any other in this folder, follow the rule `.gemini/rules/memory-bank.md`

2. We are using PNPM in our current project not npm/yarn, follow the rule `.gemini/rules/pnpm-not-npm.md`

3. When to write an Issue for GitHub, follow the rule `.gemini/rules/github-issues.md`

4. When you are asked to update Readme files or other documentation files, follow the rule `.gemini/rules/i18n-docs.md`

5. When compressing Memory Bank files, follow the rule `.gemini/rules/memory-bank-compression.md`

6. For repository structure and coding guidelines, follow the rule `.gemini/rules/repository-guidelines.md`

7. For recommendations on working with the project, follow the rule `.gemini/rules/recommendations.md`

# Repository Guidelines

## Project Structure & Module Organization
- Monorepo with feature apps under `packages/`.
  - Examples: `packages/publish-frontend` (React front end), `packages/publish-backend` (Node/Express back end), `packages/updl` (UPDL tools).
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
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, with optional scope (e.g., `feat(publish-frontend): add i18n loader`).
- PRs include: clear description, linked issues, screenshots for UI, and notes on env vars or migrations.
- Small, focused PRs are preferred; include `packages/*/base` paths in the scope when relevant.

## Security & Configuration Tips
- Never commit secrets. Use `.env`/`.env.local` and keep Supabase keys private.
- If provided, copy example envs (e.g., `cp .env.example .env`) and update per app.

# Recommendations

## 1. General Principles

1.  **Review Local READMEs**: Before starting a task, always review the `README.md` in the relevant package's directory (e.g., `packages/profile-frontend/base/README.md`).
2.  **Adhere to Linters**: Always follow the project's configured linters when writing code to ensure consistency and quality.
3.  **Language**: Respond to the user in Russian. However, all code comments and all information in the `memory-bank` folder must be written in English only.

## 2. Creating New Packages in `packages/<package-name>`

### 2.1. Workspace Imports

*   **DO**: When importing from another local package in the monorepo, always use the full PNPM workspace package name as defined in its `package.json` (e.g., `import { something } from '@universo/types'`).
*   **DO NOT**: Never use relative paths (`../`) to import across package boundaries.
*   **WHY**: This ensures correct module resolution via PNPM workspaces, prevents circular dependencies, and is critical for eventually extracting packages into separate repositories.

### 2.2. Frontend Packages (TSX)

*   **Technology**: New frontend packages must be written in **TypeScript (TSX)**.
*   **Build System**: Each new package must feature a dual-build system (similar to `packages/space-builder-frontend`) to compile TSX into both **CommonJS** and **ES Modules**.
    *   Use two `tsconfig.json` files (`tsconfig.json` for CJS, `tsconfig.esm.json` for ESM).
    *   The compiled JavaScript output must be placed in a `dist/` directory within the package.
*   **Integration**: The package's `package.json` must correctly specify the `main` (for CJS) and `module` (for ESM) entry points, pointing to the compiled files in `dist/`. This allows new TSX components to be directly imported into the existing JSX codebase (`packages/flowise-core-frontend/base`) as standard dependencies.

### 2.3. Backend Packages (TypeORM)

*   **Data Access Pattern**: Direct database calls (e.g., to the Supabase client) are forbidden. All database interaction **must** go through the **TypeORM Repository pattern**.
*   **Database Target**: Currently, all entities and migrations should be written for **PostgreSQL**, as it is the only database in use (via Supabase).
*   **Creating a New Service**: When creating a new backend service in `packages/` that requires database access, you must:
    1.  **Define Entities**: Create TypeORM entity classes for your tables inside your package's `src/database/entities/` directory.
    2.  **Register Entities**: Import and export your new entities from the central registry file: `packages/flowise-core-backend/base/src/database/entities/index.ts`.
    3.  **Define & Register Migrations**:
        a. Create TypeORM migration files for any schema changes inside your package's `src/database/migrations/postgres/` directory.
        b. Create an `index.ts` file in that same directory that exports an array containing all of your package's migrations (e.g., `export const myAppMigrations = [Migration1, Migration2]`).
        c. Import your package's migration array into the central registry (`packages/flowise-core-backend/base/src/database/migrations/postgres/index.ts`) and spread it into the main `postgresMigrations` array.
    4.  **Use Repositories**: In your service logic, get the shared `DataSource` via `getDataSource()` from `packages/flowise-core-backend/base/src/DataSource.ts`. Use it to get a repository for your entity (e.g., `getDataSource().getRepository(YourEntity)`) to perform all database operations.
