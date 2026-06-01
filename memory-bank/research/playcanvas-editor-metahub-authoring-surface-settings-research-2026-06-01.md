# Research: PlayCanvas Editor Metahub Authoring Surface Settings

> Created: 2026-06-01
> Status: Draft
> Trigger: RESEARCH request for `.manager/specs/platformo/playcanvas-editor-metahub-authoring-surface-settings-spec-2026-06-01.md`
> Follow-up plan: PLAN not created yet; the future PLAN must load this artifact explicitly.

## Research Question

How should Universo Platformo implement the next PlayCanvas Editor integration slice so a connected `@universo-react/playcanvas-editor` package can expose metahub-owner authoring display settings and a safe Editor host surface, while preserving package lifecycle, snapshot/copy behavior, MUI UX quality, iframe isolation, and future storage/bridge extensibility?

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
| --- | --- | --- | --- |
| `.manager/specs/platformo/playcanvas-editor-metahub-authoring-surface-settings-spec-2026-06-01.md` | Local brief | Current 2026-06-01 | Defines the intended scope: metahub package settings and safe authoring host only, no scene persistence or full Editor backend integration. |
| `.manager/inputs/2026-05-31-playcanvas-editor-integration.md` | Local source TZ | Current local file | Original product and architecture request for PlayCanvas Editor integration into Platformo/MMOOMM. |
| `.backup/Интеграция-PlayCanvas-Editor-в-платформу.md` | Prior local research | Current local file | Recommends official Editor frontend, iframe/postMessage/API bridge later, Colyseus package interaction, and Editor-specific AI skills. |
| `.backup/Интеграция-PlayCanvas-Editor-в-Universo-Platformo.md` | Prior local research | Current local file | Recommends iframe isolation, metadata/ECS mapping, Colyseus edit-time/runtime separation, and MCP adaptation as later deeper work. |
| `memory-bank/research/playcanvas-editor-package-foundation-research-2026-05-31.md` | Prior Memory Bank research | Created 2026-05-31 | Establishes the package-foundation decision: isolated artifact package, no root build integration by default, no metahub registry seeding in the foundation slice. |
| `packages/universo-react-playcanvas-editor/README.md` and `vendor/UPSTREAM.md` | Local package docs | Current local file | Confirm the implemented package is artifact-only, pinned to upstream `v2.22.1`, Node `>=22.22.0`, and not a MUI component library. |
| `packages/universo-react-playcanvas-editor/src/index.ts` and `scripts/lib/playcanvas-editor-artifact.mjs` | Local package source | Current local file | Defines the artifact manifest constants, `dist/editor` output root, and `artifact-only` smoke mode. |
| `packages/universo-react-metahubs-backend/src/persistence/packagesStore.ts` | Local backend store | Current local file | Source of truth for package catalog/attachment reads, attach/detach/version changes, copy, and snapshot restore persistence. |
| `packages/universo-react-metahubs-backend/src/domains/packages/controllers/packagesController.ts` | Local backend API | Current local file | Shows current routes support only catalog/list/attach/change version/detach and gate writes with `manageMetahub`. |
| `packages/universo-react-metahubs-backend/src/platform/migrations/1766351182000-CreateMetahubsSchema.sql.ts` | Local platform schema | Current local file | Shows `rel_metahub_packages` has no config column and `obj_packages` has only runtime/import-oriented source metadata. |
| `packages/universo-react-metahubs-backend/src/platform/systemAppDefinition.ts` | Local system app manifest | Current local file | Must stay aligned with any new `obj_packages` or `rel_metahub_packages` fields. |
| `packages/universo-react-types/src/common/packages.ts` | Local shared types | Current local file | Current package contracts are runtime/import oriented and do not include authoring descriptors or per-attachment config. |
| `packages/universo-react-metahubs-frontend/src/domains/packages/ui/MetahubPackagesTab.tsx` | Local frontend UI | Current local file | Existing Packages surface uses `FlowListTable`, icon actions, `StandardDialog`, `ConfirmDeleteDialog`, and `manageMetahub` read-only behavior. |
| `packages/universo-react-metahubs-frontend/src/domains/packages/api/packagesApi.ts` | Local frontend API client | Current local file | Current client mirrors the narrow backend contract; settings endpoints are absent. |
| `packages/universo-react-metahubs-frontend/src/domains/entities/shared/ui/SharedResourcesPage.tsx` | Local frontend page | Current local file | Shows the Packages tab is mounted inside the shared Resources surface. |
| `packages/universo-react-metahubs-frontend/src/i18n/locales/en/metahubs.json` and `ru/metahubs.json` | Local i18n | Current local file | Existing package translations do not cover settings, host states, or open-editor actions. |
| `packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json` | Local package seeds | Current local file | Currently seeds Colyseus client/server and PlayCanvas Engine only; Editor is not registered. |
| `packages/universo-react-applications-backend/src/routes/sync/syncPackagePersistence.ts` | Local runtime sync | Current local file | Runtime `_app_packages.config` exists but sync resets it to `{}` and ignores it in diff normalization. |
| `packages/universo-react-applications-backend/src/routes/sync/syncDataLoader.ts` | Local runtime export | Current local file | Runtime release export can read `_app_packages.config`, but the current sync writer does not preserve metahub package config. |
| `packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts` | Local snapshot hash normalizer | Current local file | Normalizes package `source` to known runtime/import fields only; unknown authoring metadata inside `source` would be ignored by snapshot hashing. |
| `packages/universo-react-metahubs-backend/src/domains/modules/services/MetahubModulesService.ts` and `packages/universo-react-modules-engine/src/compiler.ts` | Local Modules compilation path | Current local file | `MetahubModulesService` derives allowed imports from all attached packages, while the compiler later drops entries with no runtime targets. |
| `packages/universo-react-core-backend/src/index.ts` | Local backend static serving | Current local file | Core backend mounts API routes, realtime middleware, then core frontend static files and SPA fallback; no Editor artifact route exists. |
| `packages/universo-react-rest-docs/src/openapi/index.yml` | Local REST/OpenAPI docs | Current local file | Any package settings endpoint changes the public REST contract and should be documented or regenerated. |
| `https://github.com/playcanvas/editor` | Primary upstream repository | Checked 2026-06-01 | Source of truth for the Editor frontend. Local package is pinned to `v2.22.1` commit `0fcd44253ba1bba39c13d45b069265167249ecb6`. |
| `https://github.com/playcanvas/editor/releases/tag/v2.22.1` | Primary upstream release | Checked 2026-06-01; release published 2026-05-27 | Confirms the pinned release tag used by the local package. |
| `https://raw.githubusercontent.com/playcanvas/editor/v2.22.1/package.json` | Primary upstream manifest | Checked 2026-06-01 | Confirms upstream `@playcanvas/editor@2.22.1`, MIT license, Vite scripts, dependencies, and Node `>=22.22.0`. |
| `https://developer.playcanvas.com/user-manual/getting-started/open-source/` | Primary vendor docs | Checked 2026-06-01 | Confirms PlayCanvas open-source project context. |
| `https://developer.playcanvas.com/user-manual/editor/editor-api/` | Primary vendor docs | Checked 2026-06-01 | Describes Editor API as beta and example-driven; useful for later bridge work, not enough for this host/settings slice. |
| `https://developer.playcanvas.com/user-manual/editor/publishing/web/communicating-webpage/` | Primary vendor docs | Checked 2026-06-01 | Documents parent-page/iframe communication patterns for PlayCanvas published apps; relevant as general browser isolation evidence, not a full Editor bridge contract. |
| `https://developer.playcanvas.com/user-manual/editor/publishing/web/self-hosting/` | Primary vendor docs | Checked 2026-06-01 | Documents static deployment/iframe embedding for published builds, relevant to artifact route thinking. |
| `https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html` | Security reference | Checked 2026-06-01 | Supports explicit iframe/CSP/frame-ancestors/sandbox decisions for any embedded Editor host. |
| Context7 `/mui/material-ui` | MCP documentation | Checked 2026-06-01 | Confirms accessible MUI patterns for responsive Dialog, labeled Select/TextField select, Tabs, and localization support. |
| Context7 `/vitejs/vite` | MCP documentation | Checked 2026-06-01 | Confirms Vite `base`/nested public path behavior for static artifacts served under reserved routes. |
| `.agents/skills/universo-platform-architecture/SKILL.md` | Local skill | Current | Confirms metahub/application/workspace ownership and the need to avoid layer confusion. |
| `.agents/skills/mui-runtime-ux-patterns/SKILL.md` and `.agents/skills/runtime-ux-qa/SKILL.md` | Local skills | Current | Defines required UI contract: no raw IDs/JSON/internal errors, localized validation, responsive proof, and reuse of existing MUI primitives. |
| `.agents/skills/browser-3d-runtime-integration/SKILL.md` | Local skill | Current | Provides iframe/canvas/input/focus isolation guidance relevant to the future host surface. |

## Key Findings

- The brief's scope is appropriate: this slice should create a metahub-owner design-time package settings and host surface, not a PlayCanvas scene/project storage system, Editor backend emulator, typed postMessage bridge, MCP workflow, Colyseus authoring layer, or runtime multiplayer change.
- The original TZ and prior research are broader than this slice. They discuss API bridges, scene/entity mapping, network interception, MCP, and AI authoring. Those are plausible future directions but should not be pulled into this host/settings implementation.
- The current package foundation is intentionally artifact-only. `@universo-react/playcanvas-editor` exposes metadata for an artifact rooted at `dist/editor`, but the built page is a safe unavailable/artifact-only page and does not represent connected PlayCanvas project persistence.
- The current metahub package model is runtime/import oriented. `PackageSourceDescriptor` has `runtimeTargets` and import/upstream names, but no authoring/display descriptor. `MetahubPackageAttachment` and `MetahubSnapshotPackage` have no per-attachment config.
- `rel_metahub_packages` is the lifecycle owner for a package attachment to a metahub. It already owns `metahub_id`, `package_id`, `package_name`, `expected_version`, active/soft-delete fields, permissions through the surrounding service routes, copy, snapshot restore, and uniqueness by `(metahub_id, package_name)`.
- The best first storage location for per-metahub package display settings is a `config JSONB NOT NULL DEFAULT '{}'` column on `metahubs.rel_metahub_packages`, with a small versioned envelope such as `{ "schemaVersion": "1", "display": { ... } }`. A companion table is possible but creates unnecessary lifecycle coupling in the first slice.
- Registry-level authoring metadata should be separate from `source.runtimeTargets`. A new package-version descriptor such as `authoringSurface` or `displaySurface` belongs to `obj_packages` metadata and shared types. This avoids making the Editor look like a normal Modules import package.
- Do not hide authoring/display metadata inside `source` unless PLAN explicitly updates every package source normalizer, shared type, registry equality check, publication snapshot hash normalizer, and sync persistence path. Current code normalizes `source` to runtime/import fields only and drops unknown source fields.
- If `@universo-react/playcanvas-editor` is seeded in the package catalog in this slice, the safest current runtime-import contract is `source.runtimeTargets: []` plus explicit authoring/display metadata. Otherwise the package can become visible as a normal module dependency. This also breaks current Packages table semantics because the UI has a `Runtime` column that renders only `source.runtimeTargets`; PLAN must add authoring/none wording, seed tests, and module allowlist filtering instead of relying on an empty target list alone.
- Current copy/export/import flows will silently drop future package settings unless updated together:
  - `copyMetahubPackages` copies only package id/name/version.
  - `MetahubPackagesService.listPublishedPackages` serializes only package name/version/source.
  - `SnapshotRestoreService` validates only package name/version and `replaceMetahubPackagesFromSnapshot` inserts only identity/version/source.
- Runtime `_app_packages.config` is not a safe dependency for this slice. The runtime table has a config JSON field and `syncDataLoader.ts` can read it into release-bundle snapshots as an extra structural property, but `ApplicationPackageDefinition` does not type `config`, `syncPackagePersistence.ts` normalizes snapshots without config, resets `config = '{}'::jsonb` on insert/update, and ignores config in change detection. Runtime package config currently has asymmetric read/write semantics.
- Publication/runtime propagation of package display config should be explicitly deferred unless PLAN expands the sync/diff contract. Copy, metahub snapshot export, and metahub snapshot import are the minimum preservation requirements for this slice.
- Package version changes currently update `package_id` and `expected_version` only. Once settings exist, version changes need a policy: preserve compatible config, reset to defaults, or block/confirm incompatible config.
- Existing frontend package UI is a good base. It already uses `FlowListTable`, stable icon actions with tooltips, MUI `Select`, `StandardDialog`, `ConfirmDeleteDialog`, mutation error alerts, localized strings, and a read-only `manageMetahub` permission pattern.
- Adding Settings and Open Editor actions can crowd the existing table. Current package rows have a single action icon per state; PLAN should preserve a stable actions cell or introduce an overflow/action menu for Settings/Open/Disconnect instead of widening the table enough to create horizontal overflow.
- Existing package i18n covers load/table/status/actions/dialogs/notifications only. It does not cover settings, host states, display modes, validation, authoring/display labels, or an empty-runtime state; current EN/RU labels such as `Runtime` / `Среда` will mislabel authoring-only packages unless changed.
- Settings UI must be a typed localized form, not a raw JSON editor. Initial fields should likely include `displayMode`, optional dev-only `developmentUrl`, and an artifact-only notice/defaults field, with reset/cancel/save behavior and localized validation.
- `developmentUrl` mode is high risk. It should be disabled in production by default, require explicit environment/admin gating, validate or allowlist URLs, set iframe sandbox/referrer policy, and map errors to user-facing localized messages without showing raw URLs or internal paths.
- `Open editor` should be honest while the package remains artifact-only. The host can show "artifact available", "artifact only", "artifact missing", "misconfigured", or "development URL blocked" states, but must not imply scene persistence is connected.
- Core backend currently serves the core frontend static build and then an SPA fallback at `/`. Any Editor artifact route must be mounted after the existing security/session/auth middleware that should protect it, but before `express.static('/')` and the SPA fallback, or it will not serve the artifact correctly.
- The existing global `frame-ancestors` CSP in core backend controls who may frame Universo itself; it does not decide which child iframe origins the Editor host may load. The Editor host needs separate parent-host `frame-src`/`child-src` policy, iframe `sandbox`, `allow`, `referrerPolicy`, development URL allowlist behavior, and route-specific child artifact response headers.
- The package-local `serve-editor.mjs` has useful traversal checks and basic content-type/cache headers, but it is not integrated into Express auth/session/CSRF/static serving, has no CSP or iframe policy, and only checks `index.html` availability rather than both `index.html` and `universo-artifact-manifest.json`. It is a development/smoke helper, not the production host route.
- Vite documentation confirms nested deployment needs an explicit `base` strategy if the artifact contains absolute asset paths. The artifact route and Editor build command must agree on the served public base path.
- PlayCanvas official "Communication with web pages" and "Self-hosting" docs are about published apps/builds, not a full autonomous open-source Editor backend. They support iframe/static-host patterns only at a general level.
- PlayCanvas Editor API documentation describes beta automation examples. It is not stable enough to smuggle a typed bridge into this slice, and any Editor API integration should be a later bridge/storage brief with its own tests.
- MUI documentation supports the planned UI patterns: responsive full-screen Dialog via media query, accessible labeled Select/TextField select controls, accessible Tabs, and global localization.

## Conflicts And Uncertainty

- The prior research recommends network interception/backend emulation and typed postMessage bridges. This conflicts with the current brief's narrow first host/settings slice. Treat those ideas as future architecture candidates, not current acceptance criteria.
- The package catalog currently assumes runtime/import packages. It is uncertain whether adding an authoring-only package with empty `runtimeTargets` will require UI wording changes, compiler allowlist checks, or seed validation updates.
- The exact shape of the package-version authoring descriptor is undecided. Options include `authoringSurface`, `displaySurface`, or a generic `surfaces[]` descriptor. The descriptor should be versioned and validate defaults for the attachment config.
- Runtime propagation is unresolved. The current `_app_packages.config` schema exists but does not preserve sync data, so publishing package display settings would require deliberate sync/diff changes.
- Static artifact serving ownership is unresolved. Possible owners include core backend static middleware, a package-provided helper consumed by core backend, or a metahubs/backend route. The route must be registered before the SPA fallback either way.
- It is unclear whether the first host should be a route, a dialog, or both. A route is better for iframe size/focus and "open separately"; a dialog may fit quick artifact status. PLAN should choose based on UX and implementation complexity.
- `SharedResourcesPage` mounts Packages inside a normal Resources tab shell. A full Editor host should likely be route-first or full-viewport, with the Packages tab providing status/settings/launch actions rather than embedding the full Editor host inside the tab content.
- The local artifact package requires Node `>=22.22.0`, while the broader repository foundation previously avoided root build integration. This slice should not accidentally make root build depend on Editor artifact build unless the Node/dependency constraints are accepted.

## Project Implications

- PLAN should update the metahub package model before frontend UI:
  - add a registry-level authoring/display descriptor separate from `source.runtimeTargets`;
  - add per-attachment config to `rel_metahub_packages`;
  - update shared TypeScript types before API/UI work.
- If storage uses `rel_metahub_packages.config`, implementation must include:
  - SQL/platform migration for existing databases;
  - base schema and `systemAppDefinition` field updates;
  - store select/insert/update/copy/restore changes;
  - backend API endpoint for config update;
  - package version-change config policy;
  - focused store/controller tests.
- Snapshot compatibility must be explicit. The smallest backward-compatible shape is likely optional `packages[].config` or `packages[].displayConfig`, with imports defaulting missing values to package descriptor defaults.
- Copy, export, and import must be implemented in the same slice as the settings UI. Otherwise the UI creates a configuration that the platform immediately loses in normal lifecycle operations.
- Runtime publication should remain documented as deferred unless PLAN explicitly expands `syncPackagePersistence` and `ApplicationPackageDefinition` to preserve config in `_app_packages`.
- The Editor seed entry should not be a normal runtime dependency. If seeded now, update `seed-packages.json`, package seed tests, UI labels, and docs so "Runtime" does not misrepresent an authoring-only package.
- Module compilation must not treat authoring-only packages as ordinary allowed imports. PLAN should either filter authoring-only packages out of `MetahubModulesService.listAllowedPackageImports` or represent them so they never reach module compilation input.
- If authoring/display descriptor metadata is added outside `source`, update `obj_packages` schema, `systemAppDefinition`, shared types, seed data, registry store reads/writes, and package seed tests. If PLAN instead extends `source`, it must also update `packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts`, sync source normalizers, registry equality checks, and all shared types that currently assume runtime/import-only source fields.
- If a package settings endpoint is added, update the REST/OpenAPI contract in `packages/universo-react-rest-docs/src/openapi/index.yml` or the corresponding generated OpenAPI source used by the repo.
- Frontend implementation should extend `MetahubPackagesTab` rather than create a parallel Packages page. Reuse existing `FlowListTable`, `StandardDialog`, tooltip/icon action patterns, and the existing permission/read-only pattern.
- Update `MetahubPackagesTab` table contract: split runtime/import package display from authoring/display package display, add an explicit authoring-surface chip/column or empty runtime label, and use an overflow/action menu or stable action cluster for Settings/Open/Disconnect.
- UI contract should include:
  - display mode: `disabled`, `embeddedIframe`, `openSeparately`, `developmentUrl`;
  - dev URL field shown only when environment/admin gating allows it;
  - explicit artifact-only notice while smoke mode remains `artifact-only`;
  - read-only mode for users without `manageMetahub`;
  - localized validation/errors in EN/RU;
  - no raw package IDs, attachment IDs, JSON, stack traces, filesystem paths, internal routes, or full blocked URLs in viewer/error states. Manager-only settings may show the configured development URL field because the owner edits that value directly.
- Host route/static serving contract should include:
  - reserved route name;
  - artifact availability check against `index.html` plus `universo-artifact-manifest.json`;
  - registration after the relevant security/session/auth middleware but before core frontend `express.static('/')` and SPA fallback;
  - traversal-safe static serving;
  - separate parent host CSP (`frame-src`/`child-src`) and child artifact response headers, plus content-type, cache, nosniff, iframe `sandbox`, `allow`, `referrerPolicy`, and development URL allowlist policy;
  - user-facing fallback for missing artifact.
- Browser evidence should cover desktop/tablet/mobile widths, no page-level horizontal overflow, keyboard access to Settings/Open Editor, read-only behavior, artifact-only/missing/misconfigured states, and iframe load/error behavior.

## Recommended Decision

Proceed to PLAN with a conservative implementation path:

1. Treat this as a metahub design-time package settings slice, not an Editor backend/storage slice.
2. Add versioned registry-level authoring/display metadata outside `source.runtimeTargets`; prefer a dedicated top-level registry field/column over extending `source` unless PLAN explicitly updates all source normalizers and snapshot hash behavior.
3. Store per-metahub package display config directly on `rel_metahub_packages.config` with a versioned JSON envelope and backend validation against the attached package version descriptor.
4. Preserve settings through metahub copy, metahub snapshot export, and metahub snapshot import in the same implementation.
5. Defer publication/runtime `_app_packages.config` propagation until a later sync/diff brief unless PLAN explicitly expands the scope.
6. Add `@universo-react/playcanvas-editor` to the package catalog only as an authoring/display package, with safeguards that it is not accepted as a Modules import dependency.
7. Build the UI on the existing Packages tab patterns, using typed localized forms and explicit artifact-only states.
8. Serve or frame the Editor artifact only through an explicit reserved route/host contract; do not import upstream PCUI/Observer/Editor DOM into the MUI React tree.

## Open Questions Before PLAN

- What exact registry descriptor shape should be used: `authoringSurface`, `displaySurface`, or a generic `surfaces[]` contract?
- Should the first seed for `@universo-react/playcanvas-editor` use an empty `runtimeTargets` array, a new source kind/target type, or a separate catalog field to avoid Modules allowlist leakage?
- Should authoring-only packages be excluded from `MetahubModulesService.listAllowedPackageImports`, or represented in a way that never reaches module compilation input?
- Should snapshot persistence use `packages[].config` or a narrower `packages[].displayConfig` field?
- On package version change, should incompatible config be reset, migrated, or blocked until the user confirms?
- Which package owns the reserved artifact route, and what exact route namespace should be used?
- Should the first host be route-first, dialog-first, or route plus lightweight status dialog?
- Is development URL mode allowed only in local development, or also for selected admin/staging deployments through an explicit allowlist?
- Should runtime publication propagation remain deferred, or should this slice intentionally expand `syncPackagePersistence` and application release bundle contracts?

## Sources

- `.manager/specs/platformo/playcanvas-editor-metahub-authoring-surface-settings-spec-2026-06-01.md`
- `.manager/inputs/2026-05-31-playcanvas-editor-integration.md`
- `.backup/Интеграция-PlayCanvas-Editor-в-платформу.md`
- `.backup/Интеграция-PlayCanvas-Editor-в-Universo-Platformo.md`
- `memory-bank/research/playcanvas-editor-package-foundation-research-2026-05-31.md`
- `packages/universo-react-playcanvas-editor/README.md`
- `packages/universo-react-playcanvas-editor/vendor/UPSTREAM.md`
- `packages/universo-react-playcanvas-editor/src/index.ts`
- `packages/universo-react-playcanvas-editor/scripts/lib/playcanvas-editor-artifact.mjs`
- `packages/universo-react-metahubs-backend/src/persistence/packagesStore.ts`
- `packages/universo-react-metahubs-backend/src/domains/packages/controllers/packagesController.ts`
- `packages/universo-react-metahubs-backend/src/platform/migrations/1766351182000-CreateMetahubsSchema.sql.ts`
- `packages/universo-react-metahubs-backend/src/platform/systemAppDefinition.ts`
- `packages/universo-react-types/src/common/packages.ts`
- `packages/universo-react-metahubs-frontend/src/domains/packages/ui/MetahubPackagesTab.tsx`
- `packages/universo-react-metahubs-frontend/src/domains/packages/api/packagesApi.ts`
- `packages/universo-react-metahubs-frontend/src/domains/entities/shared/ui/SharedResourcesPage.tsx`
- `packages/universo-react-metahubs-frontend/src/i18n/locales/en/metahubs.json`
- `packages/universo-react-metahubs-frontend/src/i18n/locales/ru/metahubs.json`
- `packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json`
- `packages/universo-react-applications-backend/src/routes/sync/syncPackagePersistence.ts`
- `packages/universo-react-applications-backend/src/routes/sync/syncDataLoader.ts`
- `packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts`
- `packages/universo-react-metahubs-backend/src/domains/modules/services/MetahubModulesService.ts`
- `packages/universo-react-modules-engine/src/compiler.ts`
- `packages/universo-react-core-backend/src/index.ts`
- `packages/universo-react-rest-docs/src/openapi/index.yml`
- `https://github.com/playcanvas/editor`
- `https://github.com/playcanvas/editor/releases/tag/v2.22.1`
- `https://raw.githubusercontent.com/playcanvas/editor/v2.22.1/package.json`
- `https://developer.playcanvas.com/user-manual/getting-started/open-source/`
- `https://developer.playcanvas.com/user-manual/editor/editor-api/`
- `https://developer.playcanvas.com/user-manual/editor/publishing/web/communicating-webpage/`
- `https://developer.playcanvas.com/user-manual/editor/publishing/web/self-hosting/`
- `https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html`
- Context7 `/mui/material-ui`
- Context7 `/vitejs/vite`
- `.agents/skills/universo-platform-architecture/SKILL.md`
- `.agents/skills/mui-runtime-ux-patterns/SKILL.md`
- `.agents/skills/runtime-ux-qa/SKILL.md`
- `.agents/skills/browser-3d-runtime-integration/SKILL.md`
