# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: Repository-Wide Legacy Branding Removal Complete

- Date: 2026-03-15.
- Repository-wide legacy branding removal is complete: runtime code, env comments, i18n resources, config paths, memory-bank docs, historical plans, `.kiro` steering, repository instruction files, generated logs, and backup/build artifacts were scrubbed of upstream naming.
- Telemetry fully removed: deleted `telemetry.ts`, removed `posthog-node` dependency, cleaned all imports/usage from `index.ts`, CLI flags from `base.ts`, mocks from `App.initDatabase.test.ts`.
- Removed dead `OMIT_QUEUE_JOB_DATA` constant (zero consumers in entire codebase).
- ENV files rewritten to be definitive: added 12 previously undocumented live vars across 3 new sections — AUTHENTICATION (AUTH_REGISTRATION_ENABLED, AUTH_LOGIN_ENABLED, AUTH_EMAIL_CONFIRMATION_REQUIRED, AUTH_RLS_DEBUG), SESSION (SESSION_COOKIE_NAME/MAXAGE/SAMESITE/SECURE/PARTITIONED), CAPTCHA (SMARTCAPTCHA_SERVER_KEY/SITE_KEY/TEST_MODE + per-feature toggles), plus HOST.
- QA follow-up closed: documented `ALLOW_TRANSACTION_POOLER`, `DATABASE_KNEX_POOL_DEBUG`, `DATABASE_SHUTDOWN_GRACE_MS`, `UNIVERSO_PATH`, and the `FILE_SIZE_LIMIT` alias; removed leftover `DATABASE_TYPE` and structured `REDIS_*` legacy entries from both env files.
- `DATABASE_POOL_MAX=5` stays active in both env files because `KnexClient` still defaults to 15, while the current repo guidance and deployed Supabase Nano profile require a safe cap of 5.
- Orphaned CLI cleanup complete: `BaseCommand` now exposes only live flags for current backend runtime surfaces (`PORT`, auth/session, CORS/iframe, logging, database connection, storage, `REDIS_URL`, migration catalog toggle, and `FILE_SIZE_LIMIT`). Legacy passthrough for API keys, secret-key stores, LangSmith, model list config, queue/BullMQ, structured Redis TLS fields, `DEBUG`, and other removed upstream features is gone.
- Removed all telemetry-related vars (POSTHOG_PUBLIC_API_KEY and the legacy telemetry-disable flag) from both env files.
- Final verification is clean: repository-wide grep outside `.git` and `node_modules` returns zero `Flowise|FLOWISE|flowise` matches.
- Full build passed: `pnpm build` 27/27 successful tasks in 3m10.826s.

## Immediate Next Steps

- Wait for an explicit QA, live, or next product task trigger.
- Keep `.git` internals untouched; the zero-match verification applies to editable workspace content outside git metadata.

## Plan Decision: Keep Knex as Transport, Ban from Domain

- Knex stays as pool manager, connection handler, DDL engine.
- Only infrastructure packages may import from 'knex': schema-ddl, migrations-core, migrations-catalog, migrations-platform, universo-database. Plus DDL subsystem files in metahubs-backend (excluded via lint paths).
- Domain packages must use DbExecutor/SqlQueryable exclusively.
- Enforced by `tools/lint-db-access.mjs` in CI pipeline.

## Operational Posture

- Previous completed waves stay documented in `progress.md`; the Unified Database Access Standard initiative remains in a closed, documented state across code, docs, and AI guidance.
- Standing guards (system-app startup, catalog contracts) remain in `tasks.md`.

## References

- Active tasks: `memory-bank/tasks.md`.
- Package docs entrypoint: `packages/universo-rest-docs/README.md`.
- Generated OpenAPI source: `packages/universo-rest-docs/src/openapi/index.yml`.
- GitBook guide: `docs/en/api-reference/interactive-openapi-docs.md`.
- Architecture patterns: `memory-bank/systemPatterns.md`.
