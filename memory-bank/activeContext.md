# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: Start System App — Onboarding Architecture Migration COMPLETE (incl. clean-db bootstrap ordering fix)

- Date: 2026-03-15.
- Plan v3: `memory-bank/plan/start-system-app-onboarding-plan-2026-03-15.md`.
- **Implementation**: All 5 phases completed. Two QA follow-ups, the final remediation wave, and the clean-db bootstrap ordering fix are closed. Targeted validation and a fresh root build passed.
- QA follow-up #1 resolved:
  - Lint formatting fixed in start-backend (91 errors), start-frontend (10 errors), and migrations-platform (10 errors).
  - Created `startSystemApp.test.ts` with 17 migration integration tests.
- QA follow-up #2 resolved:
  - Added missing 401 test for POST /selections endpoint. 1 LOW finding fixed, 3 INFO observations documented.
- QA remediation wave resolved:
  - `POST /selections` now deduplicates repeated ids and syncs all three catalog kinds inside one transaction.
  - `AuthenticatedStartPage` now preloads onboarding items once and passes them into `OnboardingWizard` to avoid the extra fetch.
  - Added direct regressions for duplicate-id normalization, transaction-bound sync, wizard preload/no-refetch, and authenticated start-page completion/fallback rendering.
- Clean-db bootstrap ordering fix resolved:
  - Root cause: platform migrations are globally sorted by version/id, so the original `start` finalize migration ran before admin finalize on a clean database and tried to create policies that referenced `admin.has_admin_permission(...)` too early.
  - Resolution: admin-dependent `start` policies moved into `ApplyStartSchemaPolicies1733400000500`, which now runs after `FinalizeAdminSchemaSupport1733400000001`.
  - Regression coverage: start manifest tests now require 3 migrations, and migrations-platform tests assert the start policy migration sorts after admin finalize.
- Final validated counts: start-backend 26/26, start-frontend 16/16, migrations-platform 126/126.
- Key implementation outcomes:
  - New `start` schema with system-app architecture (4 business tables: cat_goals, cat_topics, cat_features, rel_user_selections).
  - 30 VLC seed items (10 goals + 10 topics + 10 features) with en/ru translations.
  - Backend: onboardingStore (5 functions), 3 route endpoints with Zod validation, parallel fetch for catalog items.
  - Frontend: VLC-based OnboardingCatalogItem types, goals/topics/features wizard flow, syncSelections + completeOnboarding API.
  - 'start' added to FIXED_SCHEMA_NAMES in migrations-core.

## Immediate Next Steps

- All plan items, QA follow-up items, remediation items, and the clean-db startup fix are complete. No active implementation debt remains for this feature.
- Pending user review: live clean-db startup confirmation, English translation tone, admin UI scope, resumable onboarding.

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
