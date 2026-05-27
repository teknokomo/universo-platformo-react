# Metahub Packages System Foundation Plan - 2026-05-27

## Overview

Implement the MVP metahub Packages foundation: three workspace wrapper packages, a fixed-schema global package registry plus metahub attachment relation, idempotent package seed loading from configuration, a first `Packages` tab in the metahub Resources surface, and runtime package dependency metadata for Modules.

Research artifact: `memory-bank/research/metahub-packages-system-foundation-research-2026-05-27.md`.

## Architectural Mapping

- Domain object: a reusable workspace package dependency for metahub Modules.
- Platform preset mapping: this is not a new entity type preset. It is fixed metahub system-app metadata, similar to templates/modules/resources ownership.
- Template impact: no template version bump and no legacy compatibility layer. New metahubs/applications will be created on a fresh DB.
- Layer ownership:
  - Metahub: package dependency declarations and attached versions.
  - Application runtime: published resolved package dependency metadata.
  - Workspace: no user-authored package content in this MVP.
- UI primitive reuse: extend the existing metahub Resources surface and existing MUI/TanStack patterns; do not create an isolated one-off shell.
- Existing UI primitives to reuse before adding package-local UI:
  - `TemplateMainCard` and `ViewHeaderMUI` from `@universo-react/template-mui` for the embedded Resources shell.
  - `ToolbarControls` for refresh/search/view controls and primary attach actions.
  - `FlowListTable` for compact desktop list/table rendering, or the existing `LayoutAuthoringList` composition pattern if the package list needs card/list switching.
  - `EmptyListState` and `SkeletonGrid` for empty/loading/error surfaces.
  - `PaginationControls` if registry/attachments become paginated.
  - `EntityFormDialog` for attach/change-version flows.
  - `ConfirmDeleteDialog` for detach confirmation.
  - MUI `Chip`, `Tooltip`, and icon buttons from existing list/action patterns for source/status/actions.
  - Do not create a new page shell, standalone card-in-card layout, or custom table component unless an existing primitive cannot express the workflow.

## Affected Areas

- Workspace/package management:
  - `pnpm-workspace.yaml`
  - `packages/universo-react-colyseus-client/`
  - `packages/universo-react-colyseus-server/`
  - `packages/universo-react-playcanvas-engine/`
- Shared contracts:
  - `packages/universo-react-types/src/common/*`
  - `packages/universo-react-types/src/common/modules.ts`
  - `packages/universo-react-types/src/index.ts`
- Backend fixed schema and seed:
  - `packages/universo-react-metahubs-backend/src/platform/systemAppDefinition.ts`
  - `packages/universo-react-metahubs-backend/src/platform/migrations/1766351182000-CreateMetahubsSchema.sql.ts`
  - `packages/universo-react-metahubs-backend/src/platform/migrations/*SeedBuiltinPackages*`
  - `packages/universo-react-metahubs-backend/src/domains/packages/**`
  - `packages/universo-react-metahubs-backend/src/persistence/packagesStore.ts`
  - `packages/universo-react-metahubs-backend/src/domains/router.ts`
- Runtime publication/application sync:
  - `packages/universo-react-schema-ddl/src/systemTables.ts`
  - `packages/universo-react-metahubs-backend/src/domains/publications/services/SnapshotSerializer.ts`
  - `packages/universo-react-applications-backend/src/services/applicationSyncContracts.ts`
  - `packages/universo-react-applications-backend/src/routes/sync/**`
  - `packages/universo-react-applications-backend/src/services/applicationReleaseBundle.ts`
  - `packages/universo-react-applications-backend/src/services/runtimeModulesService.ts`
  - `packages/universo-react-modules-engine/src/compiler.ts`
- Frontend:
  - `packages/universo-react-metahubs-frontend/src/domains/entities/shared/ui/SharedResourcesPage.tsx`
  - new `packages/universo-react-metahubs-frontend/src/domains/packages/**`
  - `packages/universo-react-metahubs-frontend/src/domains/shared/queryKeys.ts`
  - `packages/universo-react-metahubs-frontend/src/i18n/locales/{en,ru}/metahubs.json`
- E2E and docs:
  - `tools/testing/e2e/specs/flows/metahub-packages.spec.ts`
  - `docs/en/platform/metahubs/packages.md`
  - `docs/ru/platform/metahubs/packages.md`
  - `docs/en/SUMMARY.md`
  - `docs/ru/SUMMARY.md`
  - package READMEs and root docs references as needed.

## Plan Steps

- [ ] Step 1: Finalize the upstream dependency decision before coding.
  - Use current package/docs defaults:
    - `@universo-react/playcanvas-engine` wraps `playcanvas@2.18.2` and is browser/client-targeted.
    - `@universo-react/colyseus-server` wraps `colyseus@0.17.10` and is server-targeted.
    - `@universo-react/colyseus-client` wraps `@colyseus/sdk@0.17.42` and is client/browser plus Node-compatible. This deliberately uses the current official Colyseus JS/TS SDK package instead of the older `colyseus.js@0.16.22` package named in the brief references.
  - If product requires strict historical adherence to `colyseus.js`, record that as an explicit product override before implementation and update seed config, README, wrapper entry, and compiler target metadata together.
  - Add these upstream versions to `pnpm-workspace.yaml` catalog, then consume them as `catalog:` from wrapper packages.

- [ ] Step 2: Add shared package contracts in `@universo-react/types`.
  - Define `MetahubPackageRegistryItem`, `MetahubPackageAttachment`, `PackageSourceDescriptor`, and DTO payload types.
  - Add Zod schemas only if both frontend and backend need validation; otherwise keep backend validation local.
  - Use semantic package identifiers and versions in shared types; keep database row IDs transport-only.

  Example contract:

  ```ts
  export interface MetahubPackageRegistryItem {
    id: string
    packageName: string
    version: string
    displayName: string
    description?: string | null
    source: {
      kind: 'workspace'
      packageName: string
      importName: string
      upstreamPackageName: string
      upstreamVersion: string
      runtimeTargets: readonly ('server' | 'client')[]
    }
    isActive: boolean
  }

  export interface MetahubPackageAttachment {
    id: string
    metahubId: string
    packageId: string
    packageName: string
    version: string
    displayName: string
    sourceKind: 'workspace'
    attachedAt: string
  }
  ```

- [ ] Step 3: Create the three wrapper packages.
  - Use `packages/universo-react-<name>/` and `@universo-react/<name>`.
  - Use `tsdown`, `main`, `module`, `types`, `exports`, `src/index.ts`, `README.md`, and `README-RU.md`.
  - Keep wrapper entry thin and boring:

  ```ts
  export * from 'playcanvas'
  ```

  ```ts
  export * from 'colyseus'
  ```

  ```ts
  export * from '@colyseus/sdk'
  ```

  - Add focused build/import smoke tests proving CJS/ESM exports resolve.

- [ ] Step 4: Implement fixed-schema tables.
  - Use repository physical naming:
    - `metahubs.obj_packages`
    - `metahubs.rel_metahub_packages`
  - Keep user-facing/API names as Packages.
  - Treat `packages/universo-react-metahubs-backend/src/platform/systemAppDefinition.ts` and its `metahubBusinessTables` list as the canonical fixed-schema business-model source.
  - Add both tables to `metahubBusinessTables` in `systemAppDefinition.ts`; generated fixed-schema materialization owns business table creation.
  - Update `1766351182000-CreateMetahubsSchema.sql.ts` only as the explicit parity/support SQL artifact for indexes, foreign keys, RLS policies, lifecycle policy details, and down cleanup. Do not introduce a second independent `CREATE TABLE` owner that can drift from `systemAppDefinition.ts`.
  - Do not add schema-version or template-version bumps for this work. The implementation target is a fresh DB with newly created metahubs/applications, as required by the brief.
  - Suggested minimum columns:
    - `obj_packages`: `id uuid default public.uuid_generate_v7()`, `package_name text`, `version text`, `display_name jsonb`, `description jsonb`, `source jsonb`, `is_active boolean`, audit/lifecycle fields.
    - `rel_metahub_packages`: `id uuid`, `metahub_id uuid`, `package_id uuid`, `package_name text`, `expected_version text`, `is_active boolean`, audit/lifecycle fields.
    - `rel_metahub_packages.package_name` is intentionally denormalized from `obj_packages.package_name` so the database can enforce one active version per package name per metahub with a partial unique index.
  - Add uniqueness:
    - active registry unique on `(package_name, version)`.
    - active attachment unique on `(metahub_id, package_name)` because the MVP should enforce one active version per package name per metahub.
    - Every active-row predicate in indexes, stores, seed reconciliation, and sync reads must use both lifecycle flags: `_upl_deleted = false AND _app_deleted = false`.

  Example safe store SQL:

  ```ts
  const packagesTable = qSchemaTable('metahubs', 'obj_packages')
  const attachmentsTable = qSchemaTable('metahubs', 'rel_metahub_packages')

  await executor.query(
    `INSERT INTO ${attachmentsTable} (metahub_id, package_id, package_name, expected_version, _upl_created_by, _upl_updated_by)
     SELECT $1, p.id, p.package_name, p.version, $3, $3
       FROM ${packagesTable} p
      WHERE p.id = $2
        AND p.is_active = true
        AND p._upl_deleted = false
        AND p._app_deleted = false
     ON CONFLICT (${qColumn('metahub_id')}, ${qColumn('package_name')})
     WHERE _upl_deleted = false AND _app_deleted = false
     DO UPDATE SET expected_version = EXCLUDED.expected_version,
                   package_id = EXCLUDED.package_id,
                   _upl_updated_at = now(),
                   _upl_updated_by = EXCLUDED._upl_updated_by
     RETURNING id, metahub_id, package_id, package_name, expected_version`,
    [metahubId, packageId, userId]
  )
  ```

- [ ] Step 5: Add idempotent package seed configuration and loader.
  - Place config in `packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json` so it ships with the package and is imported by backend tests/build.
  - Seed exactly three package rows.
  - Seed each row with `source.runtimeTargets`:
    - `@universo-react/playcanvas-engine`: `['client']`
    - `@universo-react/colyseus-client`: `['client', 'server']`
    - `@universo-react/colyseus-server`: `['server']`
  - Implement `PackageSeeder` like `TemplateSeeder`: stable checksum source, transaction per seed, upsert by `(package_name, version)`, no diff on repeated run.
  - Register a post-schema platform migration after schema creation and before any runtime that depends on package rows.
  - Do not add startup reseed unless product chooses continuous config reconciliation; migration seed is enough for fresh DB MVP.

- [ ] Step 6: Implement backend package domain.
  - Add `persistence/packagesStore.ts` using `DbExecutor.query()` and `qSchemaTable`.
  - Add `domains/packages/controllers/packagesController.ts`, `routes/packagesRoutes.ts`, and optional service layer.
  - Mount in `domains/router.ts`.
  - API shape:
    - `GET /metahub/:metahubId/packages/catalog`: available registry rows with attachment status.
    - `GET /metahub/:metahubId/packages`: attached packages for the metahub.
    - `POST /metahub/:metahubId/packages`: attach or change selected version by `packageName` + `version` or registry row id.
    - `PATCH /metahub/:metahubId/package/:attachmentId`: change version if keeping attach and change separate.
    - `DELETE /metahub/:metahubId/package/:attachmentId`: detach, fail closed on missing row.
  - Use `createMetahubHandlerFactory(getDbExecutor)` for all metahub-scoped routes and `manageMetahub` for mutations.
  - Return localized, user-facing domain error codes; frontend maps them through i18n.

- [ ] Step 7: Add frontend Packages domain.
  - Add `domains/packages/api/packagesApi.ts`.
  - Add `domains/packages/hooks/useMetahubPackages.ts` using TanStack Query and `metahubsQueryKeys`.
  - Add `domains/packages/ui/MetahubPackagesTab.tsx`.
  - Extend `SharedResourcesPage.tsx`:
    - `type SharedResourcesTab = 'packages' | 'components' | 'layouts' | 'fixedValues' | 'optionValues' | 'modules'`.
    - Default `activeTab` becomes `'packages'`.
    - Tab order is fixed by the brief as `Packages`, `Components`, then all previously existing tabs in their current relative order except that `Components` has been moved immediately after `Packages`: `Packages`, `Components`, `Layouts`, `Fixed Values`, `Option Values`, `Modules`.
  - Update `SharedResourcesPage.test.tsx` for order, default tab, and content props.

- [ ] Step 8: UI Contract for the Packages tab.
  - Resources page/tab contract:
    - First tab label: localized `Packages` / `Пакеты`.
    - `Packages` is selected by default on `/metahub/:metahubId/resources`.
    - The tab is embedded in the existing `SharedResourcesPage` shell and must not render its own page-level `TemplateMainCard`.
    - Use user-facing role/name locators and stable test ids such as `metahub-packages-tab`, `metahub-packages-attached-list`, and `metahub-packages-available-list`.
    - No normal workflow may require typing, copying, or understanding `metahubId`, `packageId`, `attachmentId`, registry row IDs, or source JSON.
  - View model contract:
    - API DTOs may contain `id`, `metahubId`, `packageId`, and structured `source`, but the UI must map them into display view models before rendering table/card cells.
    - Table/card renderers must never render raw `id`, `metahubId`, `packageId`, `source`, JSON, arrays, objects, `[object Object]`, raw i18n keys, or ISO timestamps.
    - Source display is a localized label such as `Workspace package`; package name/version remain visible because they are semantic identifiers.
  - Attached packages section:
    - Reuse `ToolbarControls`, `FlowListTable` or existing card/list switching patterns, `EmptyListState`, `SkeletonGrid`, and MUI `Chip`/`Tooltip`.
    - Columns/cards: Package, Version, Source, Status, Attached, Actions.
    - Display values: localized package display name; npm-style package name as secondary text; version as semver label; source as localized workspace label; status as localized chip; attached date as localized date/time or relative label, not raw ISO.
    - Actions: Change version and Detach with accessible names/tooltips. Pending mutation disables only affected row actions and shows localized progress.
    - Empty state: localized "No packages attached" with an Attach action if catalog rows exist.
    - Error state: localized retry affordance, no internal error dump.
    - Permission/read-only state: users without `manageMetahub` can view attached packages but see disabled attach/change/detach actions with localized reasons.
  - Available packages section:
    - Columns/cards: Package, Available version, Source, Status, Action.
    - Actions: Attach when not attached; disabled `Attached` / `Current version` / `Unavailable` state when applicable.
    - Empty states: no registry packages, no available versions, filtered no-results, and registry unavailable are distinct localized states.
    - Search/filter, if implemented, uses existing toolbar/search patterns and never filters by hidden IDs.
  - Mobile card contract:
    - Cards show Package, Version, Source, Status, and one visible action row.
    - Long descriptions/source notes wrap to multiple lines.
    - No card content may force document-level horizontal overflow.
  - Attach dialog contract:
    - Use `EntityFormDialog`.
    - Title: localized `Attach package`.
    - Fields: Package readonly display, Version select, optional Description/Notes only if truly needed.
    - Version default: latest/only available version; options show semantic versions, not registry IDs.
    - Primary action: localized `Attach`; pending state disables primary action and shows progress.
    - Validation: localized required-version, package-unavailable, and conflict messages.
    - Cancel closes without mutation and returns focus to the opening action.
  - Change-version dialog contract:
    - Use `EntityFormDialog`.
    - Title: localized `Change package version`.
    - Shows current version and selected target version.
    - Current version is disabled or clearly marked; target version must differ unless there is only one version, in which case the primary action is disabled with a localized reason.
    - Primary action: localized `Change version`; pending/error/success states are visible and localized.
  - Detach confirmation contract:
    - Use `ConfirmDeleteDialog`.
    - Shows package display name and version.
    - Shows affected modules by display name when backend can provide them; otherwise shows a localized "Dependencies were not checked" warning instead of pretending there is no risk.
    - Explains that Modules depending on the package may fail after publication/runtime sync.
    - Requires explicit confirm action; cancel returns focus to the opening action.
  - Long-text contract:
    - Any Description, Notes, details, compatibility notes, or error details field is multiline/readable by default.
  - Responsive/browser contract:
    - Desktop: dense table/list.
    - Tablet/mobile: stacked cards or a bounded grid/list container.
    - Page-level horizontal overflow is forbidden at `1920x1080`, `768x1024`, and `390x844`.
    - Internal DataGrid/table horizontal scrolling is allowed only inside a bounded grid/list container.

- [ ] Step 9: Runtime package dependency metadata.
  - Extend `MetahubSnapshot` with `packages?: MetahubSnapshotPackage[]`.
  - Snapshot serialization loads active package attachments.
  - Add `_app_packages` as the runtime application system table for resolved package dependencies. Do not overload `_app_modules`, `_app_settings`, or release metadata JSON for this.
  - Extend `packages/universo-react-schema-ddl/src/systemTables.ts` and the related migration/diff surfaces so `_app_packages` is part of system-table definition, creation, diff detection, and additive migration planning.
  - Application sync persists runtime package dependencies in `_app_packages`, following `syncModulePersistence.ts` patterns for bootstrap, idempotent updates, stale-row deletion, and active-row filtering.
  - Add `syncPackagePersistence.ts` with `persistPublishedPackages()` and `hasPublishedPackagesChanges()`; wire both into `routes/sync/syncEngine.ts` for publication sync and release-bundle apply paths.
  - Extend release bundle creation, validation, checksums, and installed release metadata so packages are preserved through `applicationReleaseBundle.ts`, `syncDataLoader.ts`, and bundle apply/export flows.
  - Runtime modules service exposes a package dependency list to module execution context.
  - Add fail-closed behavior: if a Module imports `@universo-react/playcanvas-engine` but the application runtime does not declare it, compilation or runtime sync fails with a clear localized authoring error.

- [ ] Step 10: Extend Modules compiler/import policy safely.
  - Keep the current unsupported import checks for arbitrary packages.
  - Extend `packages/universo-react-types/src/common/modules.ts`:
    - `ModuleCompilationInput` gets an `allowedPackageImports?: readonly ModulePackageImport[]` field, not only a raw string array.
    - `ModulePackageImport` carries `packageName`, `version`, and target compatibility (`server`, `client`, or `server_and_client`) so validation can reject a server-only package in browser bundles and vice versa.
    - `ModuleManifest` records the semantic package imports used by the compiled module, so manifest/checksum changes when package dependencies change.
  - Update `analyzeModuleSource()` and `validateModuleSource()` signatures in `packages/universo-react-modules-engine/src/compiler.ts` to accept the attached package allowlist and return the exact static package imports used by source analysis.
  - Add an allowlist input derived from attached Packages.
  - Allow static imports only for exact attached package names.
  - Decide and implement runtime resolution semantics explicitly:
    - preferred: mark allowed package imports as external in Module bundles and resolve them from the attached runtime package registry once per application/runtime environment;
    - fallback: if bundling is chosen, document that it snapshots the dependency into the Module bundle and does not satisfy runtime "resolve once" semantics, so it should not be the MVP default.
  - Implement esbuild externalization with a dedicated plugin or `external` entries for allowed package names. The plugin must reject target-incompatible package imports before bundle emission and must not externalize arbitrary `@universo-react/*` imports.
  - Include the normalized package import list in `ModuleManifest` and in the checksum input. A package version or target-compatibility change must invalidate compiled artifacts.
  - Update runtime sync/compilation callers so the allowlist is derived from active `rel_metahub_packages` rows during authoring and from `_app_packages` during runtime/bundle validation.
  - Server and browser targets must each receive only packages that are valid for that target. For example, Colyseus server wrappers must not be exposed to browser bundles.
  - Version enforcement must compare the attached package version from runtime metadata with the package row expected by the Module compilation context.
  - Continue rejecting dynamic `import()`, `require()`, `import.meta`, and unregistered package names.

  Example compiler input shape:

  ```ts
  interface ModulePackageImport {
    packageName: string
    version: string
    targets: readonly ('server' | 'client')[]
  }

  interface CompileModuleSourceInput {
    sourceCode: string
    sdkApiVersion: string
    allowedPackageImports?: readonly ModulePackageImport[]
  }
  ```

  Example import guard:

  ```ts
  const allowedImports = new Set([
    '@universo-react/extension-sdk',
    ...(input.allowedPackageImports ?? []).map((item) => item.packageName)
  ])

  if (!allowedImports.has(importPath) && !importPath.startsWith('@shared/')) {
    unsupportedImports.add(importPath)
  }
  ```

- [ ] Step 11: Add deep test coverage.
  - Wrapper packages:
    - Build/import smoke tests for CJS and ESM entry points.
    - Version parity tests/checks against `pnpm-workspace.yaml`, seed config, and README pinned-version text.
  - Types:
    - Vitest for package DTO/schema normalization and source descriptor validation.
  - Backend Jest:
    - Add `packages/universo-react-metahubs-backend/src/tests/persistence/packagesStore.test.ts` for list/attach/change/detach SQL, partial unique key behavior, version replacement by `package_name`, and fail-closed zero-row behavior.
    - Add `packages/universo-react-metahubs-backend/src/tests/platform/packageSeedMigration.test.ts`, mirroring `builtinTemplateSeedMigration.test.ts`, for `createKnexExecutor(ctx.knex)`, fail-fast seeding, checksum source stability, and exact three seed packages.
    - Extend/mirror `packages/universo-react-metahubs-backend/src/tests/platform/metahubsSchemaParityContract.test.ts` for `obj_packages`, `rel_metahub_packages`, required indexes, FKs, RLS policy statements, and updated migration chain.
    - Add a fresh-DB-style seed oracle that applies schema + seed twice and asserts exactly three active registry rows and no duplicates.
    - Add/extend transaction-scope tests mirroring template seed transaction tests so a failed package seed cannot leave a partial registry update.
    - Add `packages/universo-react-metahubs-backend/src/tests/routes/packagesRoutes.test.ts`, mirroring `modulesRoutes.test.ts` and `createMetahubHandler` tests, for 401 unauthenticated, 403 unauthorized, catalog read permission, `manageMetahub` mutations, validation failures, and fail-closed update/delete.
    - API tests should assert response shape minimization and stable semantic fields. Raw structured source may be present for machine clients only when required, but normal UI tests must prove it is not rendered raw.
  - Applications backend Jest:
    - Add/extend schema-ddl/system-table tests for `_app_packages` in `packages/universo-react-schema-ddl` and migration-core diff tests so the new system table is created and detected consistently.
    - Add `packages/universo-react-applications-backend/src/tests/services/syncPackagePersistence.test.ts`, mirroring `syncModulePersistence.test.ts`, for `_app_packages` bootstrap, idempotent persistence, deletion of stale rows, and `hasPublishedPackagesChanges`.
    - Extend `packages/universo-react-applications-backend/src/tests/services/runtimeModulesService.test.ts` for runtime package metadata lookup and import allowlist handoff.
    - Extend/mirror sync store tests, including wrong-version and missing-runtime-package fail-closed behavior.
    - Extend `packages/universo-react-applications-backend/src/tests/services/applicationReleaseBundle.test.ts` and route tests for package preservation, package checksum tamper detection, and release-bundle apply/export parity.
    - Snapshot includes packages.
    - Runtime sync persists packages.
    - Module import allowlist fails closed when package is missing, wrong-version, target-incompatible, dynamic import, `require()`, arbitrary package bypass, or `import.meta` is used; it passes for an attached target-compatible package.
    - Extend `packages/universo-react-modules-engine/src/compiler.test.ts` for allowed package import, missing package, wrong target, dynamic import, `require()`, arbitrary package, and externalized bundle behavior.
  - Frontend Vitest:
    - `SharedResourcesPage` tab order and default tab.
    - Packages tab loading/empty/error/attached/available states.
    - Attach/change/detach dialogs and localized validation.
    - Query invalidation after mutations.
    - No raw JSON/object/UUID-only labels in rendered normal surfaces.
    - Add `packages/universo-react-metahubs-frontend/src/domains/packages/ui/__tests__/MetahubPackagesTab.test.tsx` for view-model formatting, primitive reuse, permission/read-only states, pending mutation states, disabled-action reasons, and no raw DTO leakage.
    - Extend `packages/universo-react-metahubs-frontend/src/domains/entities/shared/ui/__tests__/SharedResourcesPage.test.tsx` to assert `MetahubPackagesTab` is embedded in the existing Resources shell, not a standalone shell.
    - Mirror i18n setup from existing frontend tests and assert no raw i18n keys or internal validation strings in EN/RU.
  - Playwright:
    - New `@flow @runtime-ux-canary` spec for Packages tab.
    - Browser screenshots for Packages tab, attach dialog, version selector, detach confirmation.
    - Viewport matrix: `1920x1080`, `768x1024`, `390x844`.
    - EN and RU localization.
    - Keyboard path through attach, change version, detach confirmation.
    - No page-level horizontal overflow.
    - Data grid/list scroll constrained inside its container if used.
    - Use existing helpers from `tools/testing/e2e/support/browser/runtimeUx.ts`: `expectNoTechnicalLeakage`, `expectNoDataGridTechnicalLeakage`, `expectSemanticFieldControls`, `expectLocalizedValidation`, `expectNoPageHorizontalOverflow`, `expectDataGridHorizontalScrollConstrained`, and the runtime UX viewport matrix helper/pattern.
    - Mirror lifecycle/browser style from `tools/testing/e2e/specs/flows/metahub-entity-resources.spec.ts` and dialog overflow patterns from `metahub-entity-dialog-regressions.spec.ts`.
    - Add negative canaries for raw UUIDs, `[object Object]`, raw JSON source, raw i18n keys, internal validation strings, raw ISO dates, and page-level horizontal overflow.
    - Assert a normal user can complete attach/change/detach without seeing or entering package IDs.

- [ ] Step 12: Documentation updates.
  - Add package READMEs:
    - `packages/universo-react-colyseus-client/README.md`
    - `packages/universo-react-colyseus-server/README.md`
    - `packages/universo-react-playcanvas-engine/README.md`
    - Russian counterparts if package convention expects them.
  - Add GitBook pages:
    - `docs/en/platform/metahubs/packages.md`
    - `docs/ru/platform/metahubs/packages.md`
  - Update:
    - `docs/en/SUMMARY.md`
    - `docs/ru/SUMMARY.md`
    - `docs/en/platform/metahubs/common-section.md`
    - `docs/ru/platform/metahubs/common-section.md`
    - architecture docs if runtime package resolution affects modules.
  - Add screenshots only after implementation evidence is captured with Playwright.

- [ ] Step 13: Verification command plan.
  - Do not run `pnpm dev`.
  - Use focused checks first:
    - `pnpm --filter @universo-react/types test`
    - `pnpm --filter @universo-react/metahubs-backend test -- packages/universo-react-metahubs-backend/src/tests/...`
    - `pnpm --filter @universo-react/applications-backend test -- packages/universo-react-applications-backend/src/tests/...`
    - `pnpm --filter @universo-react/metahubs-frontend test -- SharedResourcesPage`
    - `pnpm --filter @universo-react/{colyseus-client,colyseus-server,playcanvas-engine} build`
  - Run package lints/builds:
    - `pnpm --filter @universo-react/metahubs-backend lint`
    - `pnpm --filter @universo-react/metahubs-frontend lint`
    - `pnpm --filter @universo-react/applications-backend lint`
  - Run docs checks:
    - `pnpm docs:i18n:check`
    - `pnpm docs:gitbook-screenshot-assets:check`
  - Run local Supabase E2E evidence:
    - `pnpm supabase:e2e:start:minimal`
    - `pnpm env:e2e:local-supabase`
    - `pnpm doctor:e2e:local-supabase`
    - `cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --grep "metahub packages"`
  - Final consistency:
    - `pnpm build`
    - root lint only with explicit user approval if needed because of repository size.

## Potential Challenges

- Physical table naming: product brief names `packages` and `metahub_packages`, but repository system-app convention should use `obj_packages` and `rel_metahub_packages`.
- Upstream package naming mismatch: PlayCanvas official package is `playcanvas`; Colyseus client choice needs explicit decision.
- Compiler/runtime gap: adding registry and UI is not enough. Modules cannot import attached packages until compiler allowlist and runtime metadata are extended.
- Fixed-schema ownership: `systemAppDefinition.ts` is the canonical table-shape source; SQL migration files are parity/support artifacts. Creating a second independent table owner is a drift risk.
- Runtime system table expansion: `_app_packages` must be added to `@universo-react/schema-ddl` system-table definitions, diff detection, sync persistence, and release-bundle export/apply paths as one coherent change.
- No version bump escape hatch: because the brief explicitly targets a fresh DB and no legacy compatibility, the plan must not hide required work behind schema/template version bumps.
- UI evidence burden: the plan is blocked unless implementation captures real browser screenshots and viewport checks.
- Security: attachments must be permission-checked through request-scoped DB access and must not let unregistered external imports bypass the module sandbox.
- Performance: package catalog is tiny in MVP, but APIs should still be pagination-ready and cache through TanStack Query.

## Dependencies

- Product sign-off that the modern Colyseus client wrapper should use `@colyseus/sdk@0.17.42` instead of the older `colyseus.js@0.16.22` package referenced in the brief.
- Confirmation that one active package version per metahub/package name is the desired MVP behavior.
- Existing local Supabase E2E workflow must be healthy enough to capture browser evidence.

## Completion Criteria

- Exactly three wrapper packages exist, build, and document their pinned upstream versions.
- Fresh DB creates package registry and attachment tables through platform migrations.
- Seed loader inserts exactly three registry rows and is idempotent.
- Resources opens on `Packages` as the first tab and supports attach/change/detach with localized UI.
- Runtime application schemas include `_app_packages`; sync and release-bundle paths preserve package dependencies without relying on opaque metadata JSON.
- Publication/application runtime exposes attached package versions to Modules.
- Module import policy allows only attached package names and fails closed otherwise.
- Module manifest/checksum includes package imports so dependency changes invalidate compiled artifacts.
- Jest/Vitest/Playwright coverage proves DB, API, UI, runtime sync, localization, keyboard workflow, and responsive screenshots.
- GitBook docs and package READMEs are updated.
