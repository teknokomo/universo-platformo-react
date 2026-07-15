ATTENTION!!! These are your basic rules of work, always take them into account !!! It is forbidden to perform any actions without taking into account these basic rules of work !!! Only taking into account these basic rules of work allows you to work efficiently and do what the user needs !!! Thanks to these basic rules, you get the right context for your work.

# Custom Modes

1. If the user message starts with **VAN** command → `.gemini/rules/custom_modes/van_mode.md`
2. If the user message starts with **RESEARCH** or **RPLAN** command → `.gemini/rules/custom_modes/research_mode.md`
3. If the user message starts with **PLAN** command → `.gemini/rules/custom_modes/plan_mode.md`
4. If the user message starts with **CREATIVE** or **DESIGN** command → `.gemini/rules/custom_modes/creative_mode.md`
5. If the user message starts with **IMPLEMENT** or **IMP** command → `.gemini/rules/custom_modes/implement_mode.md`
6. If the user message starts with **QA** command → `.gemini/rules/custom_modes/qa_mode.md`
7. If the user message starts with **REFLECT** or **REF** command → `.gemini/rules/custom_modes/reflect_mode.md`
8. If the user message starts with **ARCHIVE** or **ARC** or **ARH** command → `.gemini/rules/custom_modes/archive_mode.md`
9. If the user message starts with **DOCS** or **DOC** command → `.gemini/rules/custom_modes/docs_mode.md`
10. If the user message starts with **GIT PULL** or **PULL** command → `.gemini/rules/custom_modes/git_pull_mode.md`
11. If the user message starts with **GIT PUSH** or **PUSH** command → `.gemini/rules/custom_modes/git_push_mode.md`
12. If the user message starts with **MB** command → `.gemini/rules/custom_modes/mb_mode.md`
13. If the user message starts with **DEVOPS** or **DEPLOY** command → `.gemini/rules/custom_modes/devops_mode.md`

All these Custom Modes use the rules that are in `.gemini/rules/`

# Runtime UI UX Quality Gate

When work touches MUI runtime screens, app-template dashboards, metahub template UI metadata, CRUD dialogs, DataGrid/table/card displays, relation builders, resource-source fields, or UI E2E flows, use the project-local skills `.agents/skills/mui-runtime-ux-patterns` and `.agents/skills/runtime-ux-qa`.

Non-negotiable runtime UI rules:

-   No raw user-facing IDs or hidden-knowledge workflows on normal user surfaces.
-   No raw JSON, `[object Object]`, or object cells in normal tables/cards.
-   Semantic long-text fields are multiline by default.
-   Validation messages are localized and user-facing.
-   Reuse existing MUI dashboard/app-template primitives before creating new UI.
-   Implemented UI needs browser UX evidence, including no page-level horizontal overflow.

# PlayCanvas Editor Quality Gate

When work affects PlayCanvas Editor integrations, asset processing, scripting components, realtime ShareDB servers, or backend controllers, use the project-local skills `.agents/skills/playcanvas-editor-*`.

# Thermos Review Quality Gate

For all code modifications, code reviews, final QA passes, or when the user requests an autoreview, apply the Thermos Rubrics via the `autoreview` tool with `.agents/skills/thermos*`.

-   **Correctness & Security:** Validate time-ordered UUID v7 usage, verify parameterized SQL query bind parameters, check origin headers in WebSocket upgrades, prevent credentials/PII logging, and maintain API backward compatibility.
-   **Maintainability:** Ensure files are modular and not monolithic, prevent circular dependencies, require unit/integration test coverage, and enforce styling standards.

Issues found are graded as CRITICAL (blocker), HIGH (fix before merge), MEDIUM (track in backlog), or LOW (suggestion). Any CRITICAL correctness or blocker maintainability finding blocks merging.

# Repository Guidelines

## Project Structure & Module Organization

-   Monorepo with feature apps under `packages/`.
    -   Examples: `packages/universo-react-applications-frontend` (React front end), `packages/universo-react-applications-backend` (Node/Express back end), `packages/universo-react-updl` (UPDL tools).
    -   Workspace packages use the flat `packages/universo-react-<name>/package.json` layout and the `@universo-react/<name>` npm scope.
-   Front-end apps include `i18n/` with default locales `en/` and `ru/`.
-   Context docs and planning live in `memory-bank/` (`productContext`, `techContext`, `progress`, `tasks`).
-   **Template system**: Two built-in metahub templates — `basic` (minimal widgets) and `basic-demo` (full demo with sample entities). Template data lives in `packages/universo-react-metahubs-backend/src/domains/templates/data/`.
-   **Create options**: `POST /metahubs` accepts optional `createOptions` (`createHub`, `createCatalog`, `createSet`, `createEnumeration` — all default true) to control which default entities are seeded.
-   **Entity settings**: Five entity detail views (Hub, Catalog, Set, Enumeration, Publication) include a "Settings" tab that opens an edit dialog overlay via `EntityFormDialog`.

## Build, Test, and Development Commands

-   `pnpm install`: Install workspace dependencies.
-   `pnpm dev`: Start development servers (run from the target app directory when applicable). Important: due to repo size and resource usage, only the user should run this locally; agents must not run it automatically.
-   `pnpm --filter <package> build`: Build a single package to validate it quickly (e.g., lint/type errors). Note: changes are fully applied across the workspace only after a full root rebuild.
-   `pnpm build` (root): Full workspace rebuild; required to propagate changes (even for a single package) and ensure cross-dependency consistency.
-   `pnpm start`: Run production server(s) for built apps.
-   `pnpm lint`: Run ESLint across the workspace. For checking specific packages, use `pnpm --filter <package> lint` (e.g., `pnpm --filter @universo-react/applications-frontend lint`) to avoid long execution times. Run global lint only when necessary and with user approval.

## Coding Style & Naming Conventions

-   Prefer TypeScript where present; otherwise modern ES modules.
-   Indentation: 2 spaces; avoid trailing whitespace.
-   React: `PascalCase` components, `camelCase` hooks/utils, `kebab-case` folders/files.
-   i18n keys use dot notation (e.g., `auth.login.button`).
-   Branch names use English only (e.g., `feature/publish-workflow`, `fix/updl-parser`).

## Testing Guidelines

-   Tests live near code in `__tests__/` or `tests/` when present.
-   Write unit tests for utilities and integration tests for API routes.
-   Run via `pnpm test` if configured in the target app; otherwise document manual steps in the PR.

## Commit & Pull Request Guidelines

-   Use Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, with optional scope (e.g., `feat(applications-frontend): add i18n loader`).
-   PRs include: clear description, linked issues, screenshots for UI, and notes on env vars or migrations.
-   Small, focused PRs are preferred; include `packages/*` paths in the scope when relevant.

## Security & Configuration Tips

-   Never commit secrets. Use `.env`/`.env.local` and keep Supabase keys private.
-   If provided, copy example envs (e.g., `cp .env.example .env`) and update per app.

# Recommendations

## 1. General Principles

1.  **Review Local READMEs**: Before starting a task, always review the `README.md` in the relevant package's directory (e.g., `packages/universo-react-profile-frontend/README.md`).
2.  **Adhere to Linters**: Always follow the project's configured linters when writing code to ensure consistency and quality. For linting, use `pnpm --filter <package> lint` instead of global `pnpm lint` to optimize execution time in the large workspace.
3.  **Language**: Respond to the user in Russian. However, all code comments and all information in the `memory-bank` folder must be written in English only.

## 2. Creating New Packages in `packages/<package-name>`

### 2.1. Workspace Imports

-   **DO**: When importing from another local package in the monorepo, always use the full PNPM workspace package name as defined in its `package.json` (e.g., `import { something } from '@universo-react/types'`).
-   **DO NOT**: Never use relative paths (`../`) to import across package boundaries.
-   **WHY**: This ensures correct module resolution via PNPM workspaces, prevents circular dependencies, and is critical for eventually extracting packages into separate repositories.

### 2.2. Frontend Packages (TSX)

-   **Technology**: New frontend packages must be written in **TypeScript (TSX)**.
-   **Build System**: Each new package must feature a dual-build system (similar to `packages/universo-react-admin-frontend`) to compile TSX into both **CommonJS** and **ES Modules**.
    -   Use two `tsconfig.json` files (`tsconfig.json` for CJS, `tsconfig.esm.json` for ESM).
    -   The compiled JavaScript output must be placed in a `dist/` directory within the package.
-   **Integration**: The package's `package.json` must correctly specify the `main` (for CJS) and `module` (for ESM) entry points, pointing to the compiled files in `dist/`. This allows new TSX components to be directly imported into the existing codebase (`packages/universo-react-core-frontend`) as standard dependencies.

### 2.3. Backend Packages (Knex + SQL Migrations)

-   **Data Access Pattern**: Direct database calls (e.g., to the Supabase client) are forbidden. All database interaction **must** go through **store modules** that use `DbExecutor.query()` with raw SQL.
-   **Database Target**: Currently, all schemas and migrations should be written for **PostgreSQL**, as it is the only database in use (via Supabase).
-   **Three-Tier Rule**: Tier 1 uses request-scoped executors for authenticated RLS flows, Tier 2 uses `getPoolExecutor()` for admin/bootstrap/public non-RLS work, and Tier 3 raw Knex is allowed only inside infrastructure, migrations, or explicit package-local DDL boundaries.
-   **Knex Boundary Rule**: Domain route handlers, stores, and services must not import `knex`, `KnexClient`, or call `getKnex()` directly. If a package needs DDL/runtime schema work, isolate it behind a dedicated boundary such as `src/ddl/index.ts`.
-   **SQL Safety Rule**: Domain SQL must be schema-qualified, parameterized with `$1`, `$2`, and use `qSchema`, `qTable`, `qSchemaTable`, or `qColumn` for every dynamic identifier.
-   **Mutation Rule**: UPDATE and DELETE flows should use `RETURNING` when row confirmation matters and must fail closed on zero-row results instead of silently succeeding.
-   **Testing Rule**: Critical SQL-first stores and service-level mutation contracts need direct tests, not only route-level mocks.
-   **Creating a New Service**: When creating a new backend service in `packages/` that requires database access, you must:
    1.  **Define SQL Migrations**: Create platform migration definitions in your package's `src/migrations/` directory using `createSchemaMigrationDefinition()` from `@universo-react/schema-ddl`.
    2.  **Register Migrations**: Import your migration definition into `packages/universo-react-migrations-platform/src/platformMigrations.ts` and add it to the `platformMigrations` array.
    3.  **Create Store Modules**: Write store files (e.g., `myStore.ts`) that accept a `DbExecutor` and run SQL queries via `executor.query(sql, params)`. Use `$1`, `$2`, etc. for PostgreSQL bind parameters.
    4.  **Use Request Executor**: In route handlers, obtain the request-scoped executor via `getRequestDbExecutor(req, getDbExecutor())` from `@universo-react/utils`. This ensures RLS context is applied.

<!-- ontoindex:start -->
# OntoIndex — Code Intelligence

This project is indexed by OntoIndex as **universo-platformo-react** (63049 symbols, 104964 relationships, 300 execution flows). Use the OntoIndex MCP tools to understand code, assess impact, and navigate safely.

> If any OntoIndex tool warns the index is stale, coordinate first; exactly one process should run `ontoindex analyze`.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run MCP `impact({action: "symbol", repo: "universo-platformo-react", target: "symbolName", direction: "upstream"})` or CLI `ontoindex impact --repo universo-platformo-react <symbol>`, then report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run MCP `gn_verify_diff({repo: "universo-platformo-react", scope: "all"})` or CLI `ontoindex detect-changes --repo universo-platformo-react` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use MCP `search({action: "semantic", repo: "universo-platformo-react", query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use MCP `inspect({action: "context", repo: "universo-platformo-react", target: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running MCP `impact` or CLI `ontoindex impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use MCP `refactor({action: "rename", ...})` which understands the call graph.
- NEVER commit changes without running MCP `gn_verify_diff` or CLI `ontoindex detect-changes` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `ontoindex://repo/universo-platformo-react/context` | Codebase overview, check index freshness |
| `ontoindex://repo/universo-platformo-react/clusters` | All functional areas |
| `ontoindex://repo/universo-platformo-react/processes` | All execution flows |
| `ontoindex://repo/universo-platformo-react/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/ontoindex/ontoindex-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/ontoindex/ontoindex-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/ontoindex/ontoindex-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/ontoindex/ontoindex-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/ontoindex/ontoindex-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/ontoindex/ontoindex-cli/SKILL.md` |

<!-- ontoindex:end -->
