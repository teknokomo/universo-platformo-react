# Metahub Packages System Foundation Research - 2026-05-27

## Research Question

How should the first metahub Packages foundation be planned so it fits the current Universo Platformo architecture, uses current upstream package entry points, and avoids UI/runtime quality regressions?

## Source Inventory

- Local repository architecture:
  - `memory-bank/techContext.md`
  - `memory-bank/systemPatterns.md`
  - `memory-bank/productContext.md`
  - `.kiro/steering/structure.md`
  - `.kiro/steering/recommendations.md`
  - `packages/universo-react-metahubs-frontend/README.md`
  - `packages/universo-react-metahubs-backend/README.md`
  - `packages/universo-react-metahubs-frontend/src/domains/entities/shared/ui/SharedResourcesPage.tsx`
  - `packages/universo-react-metahubs-backend/src/platform/systemAppDefinition.ts`
  - `packages/universo-react-metahubs-backend/src/platform/migrations/1766351182000-CreateMetahubsSchema.sql.ts`
  - `packages/universo-react-metahubs-backend/src/platform/migrations/1800000000200-SeedBuiltinTemplates.ts`
  - `packages/universo-react-applications-backend/src/routes/sync/syncModulePersistence.ts`
- Skills used:
  - `universo-platform-architecture`
  - `mui-runtime-ux-patterns`
  - `runtime-ux-qa`
  - `playwright-best-practices`
- Subagent findings:
  - Frontend Resources surface explorer: route, tab order, API hooks, i18n, TanStack Query patterns.
  - Backend migration/bootstrap explorer: fixed-schema table naming, system app migration registration, seed pattern, executor pattern.
  - Runtime UI UX plan reviewer: UI Contract blockers and browser evidence requirements.
- External/current sources:
  - Context7 `/playcanvas/engine`, sourced from PlayCanvas Engine README: https://github.com/playcanvas/engine/blob/main/README.md
  - Context7 `/colyseus/docs`, sourced from Colyseus docs: https://github.com/colyseus/docs/blob/master/pages/getting-started/typescript.mdx
  - npm metadata checked on 2026-05-27 with `npm view`:
    - `playcanvas`: latest `2.18.2`, npm page https://www.npmjs.com/package/playcanvas
    - `colyseus`: latest `0.17.10`, npm page https://www.npmjs.com/package/colyseus
    - `colyseus.js`: latest `0.16.22`, npm page https://www.npmjs.com/package/colyseus.js
    - `@colyseus/sdk`: latest `0.17.42`, npm page https://www.npmjs.com/package/@colyseus/sdk

## Key Findings

1. The Resources surface is a single shared page at `/metahub/:metahubId/resources`, rendered by `SharedResourcesPage.tsx`. The current tab order is `Layouts`, `Components`, `Fixed Values`, `Option Values`, `Modules`, and the current default tab is `layouts`.
2. The requested feature intentionally changes that UX contract: `Packages` must become the first tab and the default active tab, followed by `Components` and the remaining current tabs in their existing relative order. Because the brief explicitly says `Packages`, then `Components`, then existing tabs, the plan should move `Layouts` after `Components` unless product review decides that "existing tabs" meant after Components only.
3. The fixed metahubs schema uses system app table naming: `obj_*` for object tables, `doc_*` for document/version tables, and `rel_*` for relation tables. The product term `packages` should map physically to `metahubs.obj_packages` and `metahubs.rel_metahub_packages`, not a bare `metahub_packages` table.
4. The existing fixed-schema path has two sources that must stay aligned: `systemAppDefinition.ts` and the SQL migration artifact `1766351182000-CreateMetahubsSchema.sql.ts`. Tests already exist for schema parity and migration registration.
5. Idempotent seed behavior should mirror `SeedBuiltinTemplates`: stable configuration payload, stable checksum source, `createKnexExecutor(ctx.knex)`, and a post-schema platform migration. Repeated execution must upsert by stable logical keys without duplicate rows.
6. The package registry should be read-mostly and global. Per-metahub attachment mutations must use the metahub request-scoped handler and permission checks, not a raw pool executor.
7. PlayCanvas Engine current official npm import path is `playcanvas`, not `@playcanvas/engine`. The wrapper package can still be named `@universo-react/playcanvas-engine`, but its upstream dependency should be `playcanvas`.
8. Colyseus docs now show `@colyseus/sdk` as the TypeScript client SDK path, while existing docs/examples still reference `colyseus.js`. The brief explicitly names `colyseus.js` for the client wrapper, so the plan should either:
   - follow the brief strictly with `colyseus.js@0.16.22`, or
   - raise a design decision to switch the wrapper dependency to `@colyseus/sdk@0.17.42`.
   The safer MVP plan is to keep the requested wrapper name but choose and document the exact upstream dependency before implementation.
9. The modules compiler currently rejects external imports except `@universo-react/extension-sdk` and `@shared/*`. Runtime package resolution therefore requires a planned compiler/runtime import allowlist extension, not only DB/UI work.
10. Runtime sync already persists published modules into `_app_modules`. Packages should be added to the publication snapshot and application runtime sync in the same style so runtime consumers can resolve attached package names and versions from application metadata.
11. The UI plan must include a formal UI Contract. The UX reviewer blocks any plan that exposes raw IDs, raw JSON/object cells, hidden-knowledge workflows, unlocalized validation, or lacks browser evidence.
12. E2E should use the repository Playwright wrapper on port `3100`, not `pnpm dev`. For local Supabase evidence requested by the user, use the minimal stack path: `pnpm supabase:e2e:start:minimal`, `pnpm env:e2e:local-supabase`, `pnpm doctor:e2e:local-supabase`, then the Playwright wrapper with the local E2E env vars.

## Conflicts And Uncertainty

- Brief names the global table as `packages` and the attachment table as `metahub_packages`, but repository fixed-schema convention strongly favors physical names `obj_packages` and `rel_metahub_packages`.
- Brief says `@playcanvas/engine`, but official npm install/import guidance uses `playcanvas`.
- Colyseus client package choice is ambiguous between the brief's `colyseus.js` and current Colyseus docs' `@colyseus/sdk`.
- The exact package version policy needs product decision: one row per package-version in `obj_packages` versus separate package and version tables. The brief asks for one registry table with name and version, so this plan keeps one row per published package version for MVP.

## Project Implications

- Keep the MVP narrow: bundled workspace packages only, no external install flow, no ACL/sharing UI, no marketplace.
- Add shared package registry/attachment types to `@universo-react/types`; keep validation utilities there only if they are reused by backend and frontend.
- Add runtime package dependency metadata to module/publication/application sync contracts so Modules can discover package versions without direct database coupling.
- Extend the modules compiler allowlist deliberately for attached packages, preserving fail-closed behavior for any package not attached to the metahub/application runtime.
- Treat UI as a normal user surface: package name/version/source/status are user-facing, IDs and source config internals are not.

## Recommended Decision

Plan the foundation as:

- Workspace wrapper packages:
  - `@universo-react/colyseus-client` wrapping the selected Colyseus client package.
  - `@universo-react/colyseus-server` wrapping `colyseus`.
  - `@universo-react/playcanvas-engine` wrapping `playcanvas`.
- Fixed schema:
  - `metahubs.obj_packages`: one row per package name/version.
  - `metahubs.rel_metahub_packages`: active dependencies from metahub to package-version rows.
- Seed:
  - `packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json`
  - A post-schema platform seed migration, idempotent by package name/version.
- API:
  - `GET /metahub/:metahubId/packages/catalog`
  - `GET /metahub/:metahubId/packages`
  - `POST /metahub/:metahubId/packages`
  - `DELETE /metahub/:metahubId/package/:attachmentId`
  - Optional `PATCH /metahub/:metahubId/package/:attachmentId` for version change.
- UI:
  - New first `Packages` tab in Resources, default active.
  - Attached and available package sections with attach/change/detach dialogs.
- Runtime:
  - Publication snapshot includes attached package dependencies.
  - Application runtime sync persists `_app_packages` or equivalent runtime metadata.
  - Modules compiler/runtime allows imports only from package names attached to the metahub/application.

## Open Questions

1. Should the Colyseus client wrapper depend on the brief's `colyseus.js` or the newer documented `@colyseus/sdk`?
2. Should the MVP registry use one row per package-version (`obj_packages`) or introduce a separate `doc_package_versions` table now? The brief asks for two tables only, so separate versions are deferred unless product chooses otherwise.
3. Should package attachment be permitted to owners only or all users with `manageMetahub`? The plan assumes `manageMetahub`.
4. Should package source metadata be localized display metadata or a structured non-localized source descriptor? The plan uses structured metadata internally and formatted labels in UI.
