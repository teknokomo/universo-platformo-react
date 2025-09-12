---
applyTo: '**'
---
# Repository Guidelines

## Project Structure & Module Organization
- Monorepo with feature apps under `apps/`.
  - Examples: `apps/publish-frt` (React front end), `apps/publish-srv` (Node/Express back end), `apps/updl` (UPDL tools).
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
- `pnpm lint`: Run ESLint across the workspace. For checking specific packages, use `pnpm --filter <package> lint` (e.g., `pnpm --filter publish-frt lint`) to avoid long execution times. Run global lint only when necessary and with user approval.

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
- Small, focused PRs are preferred; include `apps/*/base` paths in the scope when relevant.

## Security & Configuration Tips
- Never commit secrets. Use `.env`/`.env.local` and keep Supabase keys private.
- If provided, copy example envs (e.g., `cp .env.example .env`) and update per app.
