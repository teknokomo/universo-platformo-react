# E2E Dedicated Supabase And Agent Playwright Guidance Plan

Date: 2026-05-13

## Overview

The goal is to make browser E2E testing safer and more predictable by supporting a dedicated Supabase environment for E2E runs across both hosted and local Docker modes, while documenting repository-specific Playwright rules so agents stop using port `3000`, `pnpm dev`, or the wrong Supabase profile.

This plan keeps the current production-like E2E runner model: Playwright CLI is the primary regression tool, the built application is started through `pnpm start`, the E2E app listens on `http://127.0.0.1:3100`, and `pnpm dev` remains out of agent-driven browser testing.

## Research Findings

-   Context7 Supabase CLI docs confirm `supabase start` supports service exclusion through `--exclude/-x`, including `realtime`, `storage-api`, `imgproxy`, `edge-runtime`, `logflare`, and `vector`.
-   Context7 Supabase CLI docs confirm `supabase stop` supports `--project-id`, `--all`, and `--no-backup`, which is the safe primitive for stopping/nuking one local instance without affecting every local Supabase project.
-   Context7 Playwright docs confirm `baseURL`, `webServer`, fixed readiness URL, traces, screenshots, and multiple server entries are standard patterns. In this repository the custom runner already owns server startup, so we should document that repository override instead of adding another Playwright `webServer` layer.
-   Current repository state:
    -   Hosted E2E is already isolated by `.env.e2e` and port `3100`.
    -   Local E2E profile generation exists, but it reads `supabase status -o env` from the same root Supabase project as development. That means local E2E currently shares the development local Supabase instance, containers, and data unless the user manually stops/nukes it.
    -   `tools/testing/e2e/run-playwright-suite.mjs` already starts the built app itself and fails closed when `E2E_BASE_URL` is already in use.
    -   `load-e2e-env.mjs` defaults to `PORT=3100`, applies E2E-safe pool/timeouts, and loads `.env.e2e.local` / `.env.e2e` / `.env`.
    -   The Playwright skill is generic and does not yet contain repository-specific rules for Universo Platformo.
-   QA finding: the unconditional `.env` fallback in the E2E loader is unsafe once the user can choose between dedicated and main Supabase profiles. The implementation must make `.env` fallback conditional and explicit instead of silently running destructive E2E reset against the main profile.
-   QA finding: Supabase CLI supports a global `--workdir` flag. E2E local commands should use both `--workdir` and the E2E `project_id`; relying only on the process current directory is acceptable for manual use, but explicit `--workdir` is safer for scripts and agents.

## Recommended Architecture

### 1. E2E Supabase Source Policy

Add an explicit E2E Supabase policy that separates two axes:

-   Provider: `hosted` or `local`.
-   Isolation: `dedicated` or `main`.

Recommended defaults:

```env
# Recommended default. E2E should use a separate Supabase project/instance.
E2E_SUPABASE_PROVIDER=hosted
E2E_SUPABASE_ISOLATION=dedicated

# Local mode defaults. Used only when E2E_SUPABASE_PROVIDER=local or local E2E scripts are called.
E2E_LOCAL_SUPABASE_STACK=minimal
E2E_LOCAL_SUPABASE_INSTANCE=dedicated
```

Source precedence must be policy-driven:

-   `hosted + dedicated`: read `.env.e2e.local`, then `.env.e2e`; do not silently fall back to `.env`.
-   `hosted + main`: read `.env` only after `E2E_ALLOW_MAIN_SUPABASE=true`.
-   `local + dedicated`: start/read the generated dedicated E2E local profile `.env.e2e.local-supabase`.
-   `local + main` or `local + dev`: read the generated dev local profile `.env.local-supabase` only after `E2E_ALLOW_MAIN_SUPABASE=true`.

The main `.env` and `.env.example` may define the policy defaults, but secrets and connection details for dedicated hosted E2E must remain in `.env.e2e.local` / `.env.e2e`. This keeps the requested "single place to choose E2E mode" while still preventing accidental resets of the main database.

Safety rules:

-   `dedicated` is the default and recommended mode for hosted and local E2E.
-   `main` is allowed only for explicit manual debugging and must be fail-closed:
    -   require `E2E_ALLOW_MAIN_SUPABASE=true`;
    -   require `E2E_FULL_RESET_MODE=off` unless an additional explicit destructive override is present;
    -   print a clear warning in doctor output.
-   Hosted dedicated mode keeps using `.env.e2e` / `.env.e2e.local`.
-   Local dedicated mode uses a separate local Supabase CLI project, not the development local Supabase project.

### 2. Dedicated Local Supabase E2E Instance

Create a generated local Supabase workdir for E2E, for example:

```text
.local/supabase-e2e/
└── supabase/
    ├── config.toml
    └── seed.sql
```

Do not commit generated E2E local runtime files. Commit only the generator source and the root `supabase/config.toml` base.

Use a distinct project id and ports:

```ts
const localSupabaseProfiles = {
    dev: {
        projectId: 'upstream-universo-platformo-react',
        workdir: REPO_ROOT,
        ports: {
            api: 54321,
            db: 54322,
            studio: 54323,
            inbucket: 54324,
            shadow: 54320,
            pooler: 54329
        }
    },
    e2e: {
        projectId: 'upstream-universo-platformo-react-e2e',
        workdir: path.join(REPO_ROOT, '.local/supabase-e2e'),
        ports: {
            api: 55321,
            db: 55322,
            studio: 55323,
            inbucket: 55324,
            shadow: 55320,
            pooler: 55329
        }
    }
} as const
```

The E2E generated `config.toml` must also set auth redirects to `http://localhost:3100` and `http://127.0.0.1:3100`.
The generated config must set service ports and URLs consistently, including `api.port`, `db.port`, `db.shadow_port`, `db.pooler.port`, `studio.port`, `studio.api_url`, `inbucket.port`, `auth.site_url`, and `auth.additional_redirect_urls`.

Local E2E commands should operate by profile:

```bash
pnpm supabase:e2e:start:minimal
pnpm supabase:e2e:start
pnpm supabase:e2e:status
pnpm supabase:e2e:stop
pnpm supabase:e2e:nuke
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
```

`stop` and `nuke` must pass the E2E project id:

```js
runCommand('supabase', ['--workdir', profile.workdir, 'stop', '--project-id', profile.projectId])
runCommand('supabase', ['--workdir', profile.workdir, 'stop', '--project-id', profile.projectId, '--no-backup'])
```

The same explicit workdir rule applies to `start`, `status -o env`, and any future local E2E Supabase command.

### 3. E2E Runner Contract

Keep the custom runner as the single source of startup truth:

-   E2E app URL: `http://127.0.0.1:3100`.
-   E2E env target: `UNIVERSO_ENV_TARGET=e2e`.
-   Backend env file for hosted dedicated mode: `.env.e2e.local` or `.env.e2e`.
-   Backend env file for local dedicated mode: `.env.e2e.local-supabase`.
-   Frontend env file for local dedicated mode: `packages/universo-core-frontend/base/.env.e2e.local-supabase`.
-   Never start `pnpm dev` from agents or E2E wrapper commands.

The local E2E scripts should start the dedicated local Supabase instance automatically:

```json
{
    "build:e2e:local-supabase": "pnpm supabase:e2e:start:minimal && pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase && cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e",
    "test:e2e:smoke:local-supabase": "pnpm supabase:e2e:start:minimal && pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase && cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --grep @smoke"
}
```

Add full-stack variants only for tests that require Storage, Realtime, Edge Functions, or log infrastructure:

```bash
pnpm run build:e2e:local-supabase:full
pnpm run test:e2e:smoke:local-supabase:full
```

### 4. Agent Skill Update

Update `.agents/skills/playwright-best-practices/SKILL.md` with a top-level repository-specific section before the generic decision tree:

```md
## Universo Platformo Repository Rules

-   Use Playwright CLI wrapper commands by default; do not run `pnpm dev`.
-   The E2E application runs on `http://127.0.0.1:3100`, not `3000`.
-   The normal manual application can run on `3000`; do not confuse it with E2E.
-   For screenshots, target `http://127.0.0.1:3100` unless the user explicitly asks for the manual app.
-   Use hosted dedicated Supabase by default through `.env.e2e`.
-   Use local Supabase only when the user asks for it or when hosted Supabase is unavailable.
-   For local Supabase E2E, use the dedicated E2E instance and the minimal stack by default.
-   Use the full local Supabase stack only when Storage, Realtime, Edge Functions, or logging/analytics are under test.
-   Treat `tools/testing/e2e/run-playwright-suite.mjs` as the owner of app startup and cleanup.
```

Also add a short repository-specific reference file in the skill, for example:

```text
.agents/skills/playwright-best-practices/references/universo-e2e.md
```

This keeps the upstream/generic Playwright guidance readable while making the project-specific behavior obvious to future agents.

## Affected Areas

-   Root scripts:
    -   `package.json`
-   Local Supabase tooling:
    -   `tools/local-supabase/shared.mjs`
    -   `tools/local-supabase/network.mjs`
    -   `tools/local-supabase/write-env.mjs`
    -   `tools/local-supabase/doctor.mjs`
    -   new profile/config generator module, likely `tools/local-supabase/profiles.mjs`
    -   unit tests in `tools/local-supabase/__tests__/`
-   Supabase local configuration:
    -   root `supabase/config.toml` remains the dev base
    -   generated `.local/supabase-e2e/supabase/config.toml` and seed
    -   `.gitignore`
-   E2E runner/environment:
    -   `tools/testing/e2e/support/env/load-e2e-env.mjs`
    -   `tools/testing/e2e/run-playwright-suite.mjs`
    -   `tools/testing/e2e/support/backend/run-e2e-doctor.mjs`
    -   `tools/testing/e2e/README.md`
    -   `tools/testing/e2e/README-RU.md`
-   Env examples:
    -   `packages/universo-core-backend/base/.env.example`
    -   `packages/universo-core-backend/base/.env.e2e.example`
    -   frontend env examples if matching user-visible comments are needed
-   Docs:
    -   `packages/universo-core-backend/base/README.md`
    -   `packages/universo-core-backend/base/README-RU.md`
    -   `docs/en/getting-started/configuration.md`
    -   `docs/ru/getting-started/configuration.md`
    -   `docs/en/guides/browser-e2e-testing.md`
    -   `docs/ru/guides/browser-e2e-testing.md`
-   Agent skill:
    -   `.agents/skills/playwright-best-practices/SKILL.md`
    -   optional new project reference file under the same skill
-   Memory Bank:
    -   `memory-bank/tasks.md`
    -   `memory-bank/activeContext.md`
    -   `memory-bank/progress.md`

## Implementation Plan

### Phase 1: Profile Model And Safety Contract

-   [ ] Define `SupabaseProfile` metadata for `dev` and `e2e` local instances in `tools/local-supabase/profiles.mjs`.
-   [ ] Move profile constants out of ad hoc command strings:
    -   network id;
    -   project id;
    -   workdir;
    -   ports;
    -   default excluded services for minimal stack.
-   [ ] Add strict validators for:
    -   supported profile (`dev | e2e`);
    -   supported stack (`minimal | full`);
    -   supported E2E isolation (`dedicated | main`);
    -   supported provider (`hosted | local`).
-   [ ] Add fail-closed guards:
    -   local profile generation must still require localhost Supabase URLs;
    -   E2E main/shared mode must require an explicit opt-in;
    -   destructive E2E reset against main/shared Supabase must be blocked by default.

Example:

```js
export function assertSafeE2eReset({ isolation, resetMode, allowMainSupabase }) {
    if (isolation !== 'main') return
    if (resetMode !== 'off' && allowMainSupabase !== 'true') {
        throw new Error(
            'Refusing E2E reset against the main Supabase profile. Use a dedicated E2E profile or set E2E_FULL_RESET_MODE=off for manual debugging.'
        )
    }
}
```

### Phase 2: Dedicated Local E2E Supabase Workdir

-   [ ] Add a generator that creates `.local/supabase-e2e/supabase/config.toml` from the root local Supabase base settings.
-   [ ] Keep root dev ports unchanged.
-   [ ] Set E2E local ports to `55321/55322/55323/55324/55320/55329`.
-   [ ] Set E2E `project_id` to `upstream-universo-platformo-react-e2e`.
-   [ ] Copy or symlink `supabase/seed.sql` into the generated E2E workdir.
-   [ ] Add `.local/` or the exact generated workdir to `.gitignore`.
-   [ ] Avoid manual duplicate committed TOML files unless generation proves too brittle.

Implementation preference:

-   If adding a TOML parser is acceptable under the workspace dependency policy, add a small maintained TOML parser through the centralized dependency flow.
-   If avoiding a new dependency, generate the E2E config from a small explicit template function and keep it unit-tested. Do not use broad regex replacement over arbitrary TOML.

### Phase 3: Local Supabase CLI Commands By Profile

-   [ ] Keep existing development commands:
    -   `pnpm supabase:local:start`
    -   `pnpm supabase:local:start:minimal`
    -   `pnpm start:local-supabase:minimal`
-   [ ] Add E2E-specific commands:
    -   `pnpm supabase:e2e:start:minimal`
    -   `pnpm supabase:e2e:start`
    -   `pnpm supabase:e2e:status`
    -   `pnpm supabase:e2e:stop`
    -   `pnpm supabase:e2e:nuke`
-   [ ] Ensure E2E local commands run `supabase` with `cwd` set to the generated E2E workdir.
-   [ ] Prefer explicit `supabase --workdir <e2e-workdir>` in scripts, even when `cwd` is also set.
-   [ ] Ensure `stop` and `nuke` pass `--project-id upstream-universo-platformo-react-e2e`.
-   [ ] Ensure `status -o env` for E2E local env generation also runs against the E2E workdir/profile.
-   [ ] Keep minimal stack as default for local E2E.

### Phase 4: Env Strategy And Switching Controls

-   [ ] Add documented E2E source settings to `.env.example` and `.env.e2e.example`.
-   [ ] Keep secrets out of `.env.example`.
-   [ ] Keep concrete hosted E2E credentials in `.env.e2e` / `.env.e2e.local`.
-   [ ] Keep generated local E2E credentials in `.env.e2e.local-supabase`.
-   [ ] Update `load-e2e-env.mjs` so the selected source is visible in the returned environment object:
    -   `supabaseProvider`;
    -   `supabaseIsolation`;
    -   `localSupabaseStack`;
    -   `localSupabaseInstance`.
-   [ ] Add guardrails to the runner and E2E doctor so accidental shared/main usage is obvious before tests mutate data.
-   [ ] Remove unsafe E2E fallback to `.env` unless `E2E_SUPABASE_ISOLATION=main` and `E2E_ALLOW_MAIN_SUPABASE=true`.
-   [ ] Print the resolved E2E source file and policy in every E2E runner/doctor startup summary.

Suggested env contract:

```env
# E2E Supabase selection.
# provider: hosted | local
E2E_SUPABASE_PROVIDER=hosted

# isolation: dedicated | main
# dedicated is recommended. main is only for manual debugging.
E2E_SUPABASE_ISOLATION=dedicated

# local stack: minimal | full
E2E_LOCAL_SUPABASE_STACK=minimal

# local instance: dedicated | dev
E2E_LOCAL_SUPABASE_INSTANCE=dedicated

# Required only for E2E_SUPABASE_ISOLATION=main.
E2E_ALLOW_MAIN_SUPABASE=false
```

### Phase 5: E2E Scripts And Runner Integration

-   [ ] Update `build:e2e:local-supabase` to start the dedicated local E2E Supabase minimal stack before generating env.
-   [ ] Update `test:e2e:smoke:local-supabase` to use the dedicated local E2E Supabase minimal stack.
-   [ ] Add local full-stack variants for service-specific tests.
-   [ ] Add optional dedicated local variants for flows/full if useful:
    -   `test:e2e:flows:local-supabase`
    -   `test:e2e:full:local-supabase`
-   [ ] Keep runner startup on port `3100`.
-   [ ] Keep Playwright config without a separate `webServer` block unless the runner is intentionally retired later.
-   [ ] Add command output summaries that clearly print:
    -   E2E app URL `http://127.0.0.1:3100`;
    -   Supabase provider/isolation;
    -   local Supabase API URL;
    -   local Supabase Studio URL;
    -   whether minimal or full stack is active.

### Phase 6: E2E Reset And Cleanup Semantics

-   [ ] Keep current project-owned schema cleanup for hosted dedicated mode.
-   [ ] Reuse the same cleanup for local dedicated mode to keep behavior consistent.
-   [ ] Add an optional `supabase:e2e:nuke` path for manual "hard reset" of the local E2E Docker volumes.
-   [ ] Make `test:e2e:cleanup` refuse to run against main/shared Supabase unless explicitly allowed and reset mode is off or dry-run.
-   [ ] Ensure cleanup messages distinguish:
    -   hosted dedicated;
    -   local dedicated;
    -   main/shared debug.

### Phase 7: Playwright Skill Hardening

-   [ ] Add a repository-specific section to `.agents/skills/playwright-best-practices/SKILL.md`.
-   [ ] Add a dedicated reference file, for example `.agents/skills/playwright-best-practices/references/universo-e2e.md`.
-   [ ] Document the default agent flow:

```bash
pnpm run build:e2e
pnpm run test:e2e:smoke
```

-   [ ] Document local E2E flow:

```bash
pnpm supabase:e2e:start:minimal
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

-   [ ] Explicitly state:
    -   do not run `pnpm dev`;
    -   do not wait for port `3000` for E2E;
    -   use `3100` for screenshots and browser CLI unless the user explicitly asks for the manual app;
    -   hosted dedicated Supabase is default;
    -   local dedicated Supabase minimal is the default local mode;
    -   full local Supabase is only for Storage/Realtime/Edge/logging tests.
-   [ ] Add a small repository check that fails if the skill loses the key local rules:
    -   `3100`;
    -   `do not run pnpm dev`;
    -   `.env.e2e`;
    -   `local Supabase minimal`.

### Phase 8: Tests

-   [ ] Vitest/unit coverage for profile selection:
    -   dev profile keeps existing ports and project id;
    -   e2e profile uses separate ports and project id;
    -   minimal stack excludes expected services;
    -   full stack excludes nothing;
    -   `stop` / `nuke` commands include `--project-id`;
    -   `status -o env` runs in the selected profile workdir.
-   [ ] Vitest/unit coverage for env generation:
    -   local E2E profile reads the E2E local Supabase status, not the dev local Supabase status;
    -   `.env.e2e.local-supabase` uses port `3100`;
    -   generated DB connection points to E2E DB port `55322`;
    -   generated Supabase URL points to E2E API port `55321`;
    -   hosted-only JWKS/SSL overrides are cleared for local mode.
-   [ ] Vitest/unit coverage for E2E source policy:
    -   dedicated hosted is accepted;
    -   dedicated local is accepted;
    -   hosted dedicated refuses to fall back to `.env` when `.env.e2e*` files are absent;
    -   main/shared with strict reset is rejected unless explicit override is present;
    -   invalid provider/isolation values fail closed.
-   [ ] Unit coverage for generated E2E `config.toml`:
    -   E2E ports are separate from dev ports;
    -   `auth.site_url` points to `http://localhost:3100`;
    -   `auth.additional_redirect_urls` includes `localhost` and `127.0.0.1` on port `3100`;
    -   `studio.api_url` points to the E2E local API port.
-   [ ] E2E doctor coverage:
    -   local dedicated doctor reports local E2E API/DB/Studio ports;
    -   hosted doctor still works with `.env.e2e`.
-   [ ] Playwright smoke validation:
    -   run `pnpm run test:e2e:smoke` for hosted dedicated mode when credentials are available;
    -   run `pnpm run test:e2e:smoke:local-supabase` for dedicated local minimal mode;
    -   verify screenshots/trace artifacts still go to `test-results/` and `playwright-report/`.
-   [ ] Documentation checks:
    -   `pnpm docs:i18n:check`;
    -   Prettier for changed docs and scripts.

### Phase 9: Documentation

-   [ ] Update backend README EN/RU:
    -   local dev Supabase vs local E2E Supabase;
    -   dev Studio `54323`;
    -   E2E Studio `55323`;
    -   minimal vs full stack.
-   [ ] Update GitBook docs EN/RU:
    -   configuration;
    -   quick start;
    -   browser E2E testing guide.
-   [ ] Update `tools/testing/e2e/README.md` and `README-RU.md`:
    -   hosted dedicated default;
    -   local dedicated E2E default;
    -   main/shared mode warning;
    -   exact commands for agents.
-   [ ] Update `.env.example` and `.env.e2e.example` comments with the new policy variables.
-   [ ] Update Memory Bank after implementation.

## Risks And Mitigations

-   Risk: two local Supabase projects can still conflict if ports overlap.
    -   Mitigation: centralize ports in one profile module and unit-test uniqueness.
-   Risk: `supabase stop --no-backup` could delete the wrong local instance.
    -   Mitigation: always pass `--project-id` for E2E stop/nuke and run from the E2E workdir.
-   Risk: agents still run `pnpm dev` because generic Playwright guidance suggests starting dev servers.
    -   Mitigation: add repository-specific skill rules before the generic decision tree and repeat the rule in E2E docs.
-   Risk: users may intentionally choose main/shared Supabase and accidentally reset it.
    -   Mitigation: require explicit opt-in and block strict reset by default.
-   Risk: maintaining two local Supabase configs can drift.
    -   Mitigation: generate the E2E config from the dev base or a single typed template and validate generated config in tests.
-   Risk: local E2E minimal stack misses a service needed by a future test.
    -   Mitigation: keep full-stack local E2E commands and document when to use them.

## Acceptance Criteria

-   Dedicated hosted E2E remains the default for standard E2E wrapper commands.
-   Dedicated local E2E uses a separate Supabase CLI project, separate containers, separate Docker volumes, and separate ports from development local Supabase.
-   `pnpm start:allclean:local-supabase:minimal` can keep running for manual development while local E2E uses its own Supabase instance.
-   `pnpm run test:e2e:smoke:local-supabase` starts or verifies the dedicated local E2E minimal Supabase stack and runs against `http://127.0.0.1:3100`.
-   Agents have a clear Playwright skill rule: no `pnpm dev`, no port `3000` for E2E, use wrapper commands and port `3100`.
-   Docs explain hosted dedicated, local dedicated, and discouraged main/shared modes in English and Russian.
-   Unit tests, E2E tool tests, docs i18n checks, and focused Playwright smoke validation pass.
