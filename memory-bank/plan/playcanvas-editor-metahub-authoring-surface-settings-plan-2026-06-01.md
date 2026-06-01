# Plan: PlayCanvas Editor Metahub Authoring Surface Settings

> Created: 2026-06-01
> Mode: PLAN
> Status: Draft for discussion
> Brief: `.manager/specs/platformo/playcanvas-editor-metahub-authoring-surface-settings-spec-2026-06-01.md`
> Research: `memory-bank/research/playcanvas-editor-metahub-authoring-surface-settings-research-2026-06-01.md`

## Overview

Implement the next PlayCanvas Editor integration slice as a metahub design-time package settings and host surface.

The implementation should let a metahub owner attach `@universo-react/playcanvas-editor`, configure how the isolated artifact is displayed, and open a safe localized host page. This plan deliberately does not add PlayCanvas scene/project persistence, Editor backend emulation, typed bridge synchronization, Colyseus authoring, or runtime publication propagation.

## Inputs And Verification Used

- Brief: `.manager/specs/platformo/playcanvas-editor-metahub-authoring-surface-settings-spec-2026-06-01.md`.
- Research artifact: `memory-bank/research/playcanvas-editor-metahub-authoring-surface-settings-research-2026-06-01.md`.
- Prior package foundation plan/research:
  - `memory-bank/plan/playcanvas-editor-package-foundation-plan-2026-05-31.md`
  - `memory-bank/research/playcanvas-editor-package-foundation-research-2026-05-31.md`
- Local package foundation:
  - `packages/universo-react-playcanvas-editor/README.md`
  - `packages/universo-react-playcanvas-editor/vendor/UPSTREAM.md`
  - `packages/universo-react-playcanvas-editor/src/index.ts`
  - `packages/universo-react-playcanvas-editor/scripts/lib/playcanvas-editor-artifact.mjs`
- Current package/metahub code:
  - `packages/universo-react-types/src/common/packages.ts`
  - `packages/universo-react-metahubs-backend/src/persistence/packagesStore.ts`
  - `packages/universo-react-metahubs-backend/src/domains/packages/`
  - `packages/universo-react-metahubs-backend/src/domains/modules/services/MetahubModulesService.ts`
  - `packages/universo-react-metahubs-frontend/src/domains/packages/`
  - `packages/universo-react-metahubs-frontend/src/domains/entities/shared/ui/SharedResourcesPage.tsx`
  - `packages/universo-react-core-backend/src/index.ts`
  - `packages/universo-react-applications-backend/src/routes/sync/syncPackagePersistence.ts`
  - `packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts`
- Repository architecture context requested by the brief:
  - `.kiro/steering/structure.md`
  - `.kiro/steering/recommendations.md`
  - `memory-bank/techContext.md`
  - `memory-bank/productContext.md`
  - `memory-bank/systemPatterns.md`
- Skills used for this plan:
  - `research-before-plan`
  - `universo-platform-architecture`
  - `mui-runtime-ux-patterns`
  - `runtime-ux-qa`
  - `browser-3d-runtime-integration`
  - `playwright-best-practices`
- Subagent reviews:
  - backend/storage/snapshot/sync review confirmed `authoringSurface` should be separate from runtime `source`, `rel_metahub_packages.config` is the best first storage owner, and runtime `_app_packages.config` propagation should be deferred.
  - frontend/UX/security review confirmed the need for a route-first host, typed settings UI, action overflow, localized states, iframe sandbox/CSP gates, and Playwright browser evidence.
- Current external documentation rechecked on 2026-06-01:
  - PlayCanvas Editor package foundation remains based on upstream Editor `v2.22.1` and artifact-only local integration.
  - Context7 `/mui/material-ui` confirms responsive `Dialog` with `useMediaQuery`, accessible labeled `Select`/`TextField select`, and accessible `Tabs` patterns.
  - Context7 `/vitejs/vite` confirms nested static artifact serving must align with `base` or relative base behavior.
  - OWASP clickjacking/CSP guidance supports explicit `frame-src`/`child-src`, `frame-ancestors`, and iframe `sandbox` decisions.

## Architecture Decisions

### 1. Descriptor Name And Ownership

Use `authoringSurface` as the package-version registry descriptor.

Reasons:

- The package is an authoring tool, not a runtime module dependency.
- `displaySurface` is too generic and can be confused with published-app display.
- Extending `source.runtimeTargets` would make the Editor look like a Modules import package and would be ignored by current source normalizers.

The descriptor lives on `metahubs.obj_packages.authoring_surface JSONB NOT NULL DEFAULT '{}'::jsonb` and in shared TypeScript types as `PackageAuthoringSurfaceDescriptor`.

### 2. Per-Attachment Settings Storage

Store metahub-specific package settings in `metahubs.rel_metahub_packages.config JSONB NOT NULL DEFAULT '{}'::jsonb`.

Reasons:

- The setting belongs to the package attachment lifecycle: attach, detach, version change, copy, snapshot export, and snapshot import.
- A companion table adds lifecycle and permission coupling without current benefit.
- The relation already enforces one active package version per metahub/package name.

### 3. Runtime Publication Propagation

Defer publication/runtime `_app_packages.config` propagation.

Reasons:

- Runtime sync currently resets `_app_packages.config` and does not model it in `ApplicationPackageDefinition`.
- This slice is design-time metahub settings and host access, not published runtime configuration.
- Copy and metahub snapshot export/import must preserve settings now; runtime sync can be a later explicit brief.

Important boundary:

- Authoring-only packages such as `@universo-react/playcanvas-editor` must be excluded from runtime publication snapshots and must not be written into application `_app_packages`.
- Current publication serialization can read all attached packages through `MetahubPackagesService.listPublishedPackages()`, and application sync writes `snapshot.packages` to `_app_packages`. Implementation must split design-time package export/import from runtime publication package serialization or add an explicit runtime-target filter at the publication boundary.
- Runtime package definitions remain limited to packages with at least one supported `source.runtimeTargets` entry.

### 4. Host Shape

Use a route-first MUI host page, launched from the Packages tab.

Recommended routes:

- Frontend host route: `/metahub/:metahubId/resources/packages/:packageSlug/editor`
- Authenticated same-origin artifact route: `/api/v1/metahub/:metahubId/packages/:packageSlug/editor-artifact/*`

The user-facing host route uses a readable package slug such as `playcanvas-editor`; normal users never need to type or understand package attachment UUIDs. The backend resolves the slug to the attached package and validates metahub access.

The artifact route is served through authenticated API routing or an equivalent explicit non-API auth/access guard. Session middleware alone is not enough because the current core backend auth guard only protects `/api/v1`, while the root static frontend fallback is public. The static route must be mounted before the core frontend static serving plus SPA fallback.

### 5. Version Change Policy

For this first slice:

- preserve config only when the target package version has the same `authoringSurface.schemaVersion` and supports the current display mode;
- otherwise reset to the target version defaults after explicit user confirmation in the version-change dialog;
- never silently carry incompatible config.

This avoids writing a generic migration engine before there is more than one descriptor version.

### 6. Development URL Policy

For this first implementation, `developmentUrl` is a local/development-only mode.

- Production builds must treat `developmentUrl` as disabled unless a later brief explicitly adds staging/admin external URL support.
- Backend validation is authoritative; frontend gating is only a convenience.
- Allowed development origins must be configured through an explicit environment allowlist.
- Blocked URL errors must be localized and must not expose full blocked URLs outside manager-only settings fields.

## Affected Areas

- Shared contracts:
  - `packages/universo-react-types/src/common/packages.ts`
  - `packages/universo-react-types/src/index.ts`
- Backend schema, seed, and stores:
  - `packages/universo-react-metahubs-backend/src/platform/migrations/1766351182000-CreateMetahubsSchema.sql.ts`
  - new additive platform migration for existing databases
  - `packages/universo-react-metahubs-backend/src/platform/systemAppDefinition.ts`
  - `packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json`
  - `packages/universo-react-metahubs-backend/src/domains/packages/services/PackageSeeder.ts`
  - `packages/universo-react-metahubs-backend/src/persistence/packagesStore.ts`
  - `packages/universo-react-metahubs-backend/src/domains/packages/controllers/packagesController.ts`
  - `packages/universo-react-metahubs-backend/src/domains/packages/routes/packagesRoutes.ts`
  - `packages/universo-react-metahubs-backend/src/domains/modules/services/MetahubModulesService.ts`
- Copy, snapshot, and hash behavior:
  - `packages/universo-react-metahubs-backend/src/domains/publications/services/SnapshotSerializer.ts`
  - `packages/universo-react-metahubs-backend/src/domains/publications/services/SnapshotRestoreService.ts`
  - package copy flow in metahubs backend controllers/services
  - `packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts` only for an explicit audit proving design-time package config should not accidentally affect runtime publication hashing in this slice.
- Static host and artifact integration:
  - `packages/universo-react-metahubs-backend/src/domains/packages/`
  - `packages/universo-react-core-backend/src/index.ts` only for generic static/CSP plumbing if the metahubs router cannot own the whole response path
  - `packages/universo-react-playcanvas-editor/src/index.ts` only if route constants or manifest helpers need to be exported
- Frontend:
  - `packages/universo-react-metahubs-frontend/src/domains/packages/api/packagesApi.ts`
  - `packages/universo-react-metahubs-frontend/src/domains/packages/hooks/`
  - `packages/universo-react-metahubs-frontend/src/domains/packages/ui/MetahubPackagesTab.tsx`
  - new package settings dialog/component under `packages/universo-react-metahubs-frontend/src/domains/packages/ui/`
  - new host page/route under the current metahub frontend route owner
  - `packages/universo-react-metahubs-frontend/src/i18n/locales/en/metahubs.json`
  - `packages/universo-react-metahubs-frontend/src/i18n/locales/ru/metahubs.json`
  - `packages/universo-react-i18n` only for labels reused outside the metahubs package boundary
- REST/OpenAPI and docs:
  - `packages/universo-react-rest-docs/src/openapi/index.yml`
  - `docs/en/platform/playcanvas-editor.md`
  - `docs/ru/platform/playcanvas-editor.md`
  - `docs/en/platform/metahubs/packages.md`
  - `docs/ru/platform/metahubs/packages.md`
  - `docs/en/SUMMARY.md`
  - `docs/ru/SUMMARY.md`

## Shared Contract

Add typed contracts before backend/UI changes so all layers agree on the descriptor and config shape.

Recommended initial type shape:

```ts
export type PackageAuthoringSurfaceKind = 'none' | 'playcanvasEditor'

export type PackageDisplayMode =
  | 'disabled'
  | 'embeddedIframe'
  | 'openSeparately'
  | 'developmentUrl'

export interface PackageAuthoringSurfaceNoneDescriptor {
  schemaVersion: '1'
  kind: 'none'
  supportedDisplayModes: readonly []
  defaultConfig: PackageAttachmentEmptyConfig
}

export interface PlayCanvasEditorAuthoringSurfaceDescriptor {
  schemaVersion: '1'
  kind: 'playcanvasEditor'
  supportedDisplayModes: readonly PackageDisplayMode[]
  defaultConfig: PackageAttachmentConfig
  artifact?: {
    packageName: '@universo-react/playcanvas-editor'
    manifestFileName: 'universo-artifact-manifest.json'
    outputRoot: 'dist/editor'
    smokeMode: 'artifact-only'
  }
}

export type PackageAuthoringSurfaceDescriptor =
  | PackageAuthoringSurfaceNoneDescriptor
  | PlayCanvasEditorAuthoringSurfaceDescriptor

export interface PackageAttachmentEmptyConfig {
  schemaVersion: '1'
  kind: 'none'
}

export interface PackageAttachmentDisplayConfig {
  schemaVersion: '1'
  kind: 'display'
  display: {
    mode: PackageDisplayMode
    developmentUrl?: string | null
    showArtifactOnlyNotice: boolean
  }
}

export type PackageAttachmentConfig =
  | PackageAttachmentEmptyConfig
  | PackageAttachmentDisplayConfig

export type PackageSlug = 'playcanvas-editor' | string

export interface PackageAuthoringHostDescriptor {
  packageSlug: PackageSlug
  packageName: string
  attachmentConfig: PackageAttachmentConfig
  authoringSurface: PackageAuthoringSurfaceDescriptor
  artifactStatus: 'available' | 'missing' | 'disabled' | 'blocked' | 'misconfigured'
}
```

Rules:

- Keep config envelope small and versioned.
- Normalize database `{}` or missing `authoring_surface` to `{ schemaVersion: '1', kind: 'none', supportedDisplayModes: [] }` at API boundaries.
- Normalize database `{}` or missing attachment `config` to `{ schemaVersion: '1', kind: 'none' }` for packages without an authoring surface.
- Define slug mapping deterministically: start from the unscoped package basename (`@universo-react/playcanvas-editor` -> `playcanvas-editor`), reserve slugs in the registry, and reject seed/registry collisions. Do not derive a route from a database UUID.
- Keep design-time package attachment DTOs separate from runtime `ApplicationPackageDefinition`; authoring config and host descriptors must not be added to runtime publication DTOs in this slice.
- Keep validation strict; unknown top-level keys should be rejected by the backend endpoint.
- Do not expose raw config JSON in normal UI.
- Add local normalization helpers first; move pure shared helpers to `@universo-react/utils` only when both backend and frontend need the exact same runtime logic.

## UI Contract

### Packages Tab

- Reuse the existing Resources shell and `FlowListTable` density.
- Keep columns stable and compact:
  - `#`
  - Package
  - Version
  - Dependency
  - Surface / Availability
  - Status
  - Actions
- Replace the current runtime-only wording with authoring-aware labels:
  - runtime packages show localized runtime targets;
  - authoring-only packages show a localized `Authoring tool` chip;
  - packages with no module import target show a localized `No runtime import` label.
- Use an overflow menu or stable action cluster for `Open editor`, `Settings`, `Change version`, and `Disconnect`.
- Users without `manageMetahub` can see status and open allowed read-only surfaces, but cannot save settings, change versions, or disconnect packages.
- Never show raw package IDs, attachment IDs, source JSON, config JSON, `[object Object]`, or internal route names.

### Package Settings Dialog

- Reuse existing MUI dialog patterns, preferably `StandardDialog` if it matches this flow.
- Use responsive `fullScreen` behavior for small screens via MUI `useMediaQuery`.
- Use an accessible labeled `TextField select`, `Select` plus `InputLabel`, or a segmented/radio control for display mode.
- Fields:
  - display mode: disabled, embedded iframe, open separately, development URL;
  - development URL: visible only when environment/admin gating allows it;
  - artifact status: read-only localized status chip/block, not manifest JSON;
  - reset to defaults action.
- Validation:
  - localized EN/RU messages;
  - no raw Zod/internal messages;
  - invalid or blocked development URL maps to a safe user-facing error code.
- Save behavior:
  - optimistic update only if existing package mutation patterns already support it safely;
  - otherwise invalidate TanStack Query keys after successful save.

### Editor Host Page

- Route-first page, not a card nested inside the Packages table.
- Header shows localized package display name and state, not IDs.
- Iframe region has stable dimensions and responsive constraints.
- Supported states:
  - loading;
  - disabled by settings;
  - artifact available but artifact-only;
  - artifact missing;
  - development URL blocked;
  - misconfigured package attachment;
  - iframe load failed.
- The normal user surface must not show stack traces, raw protocol errors, absolute filesystem paths, raw manifest JSON, or full blocked URLs. Manager-only settings may show the configured development URL field because the owner edits that value directly.

## Security And Artifact Host Contract

- Mount the static artifact route after existing security/session/auth middleware and before core frontend `express.static('/')` plus SPA fallback.
- Require authenticated metahub access to both the host route and the artifact route. Direct unauthenticated requests to the raw artifact route must return 401/403 or a safe redirect; they must not return artifact HTML.
- Serve the artifact through `/api/v1/metahub/:metahubId/packages/:packageSlug/editor-artifact/*` or an equivalent explicitly authenticated proxy. Do not rely on session middleware placement alone.
- Follow the existing API session/auth/CSRF policy for the new config mutation and artifact endpoints, or document a narrow safe exception for static GET/HEAD artifact assets.
- Validate both `index.html` and `universo-artifact-manifest.json` before reporting artifact availability.
- Protect against normal and encoded path traversal.
- Send explicit content types, `X-Content-Type-Options: nosniff`, and a deliberate cache policy.
- Configure parent host `frame-src`/`child-src` for same-origin artifact route and allowlisted dev origins only.
- Account for the current backend CSP shape: global CSP mainly sets `frame-ancestors`, and API routes may disable Helmet CSP. The host implementation must explicitly prove parent `frame-src`/`child-src` and child artifact headers do not weaken or conflict with existing policy.
- Keep `frame-ancestors` policy separate from child iframe loading policy.
- Do not import upstream Editor DOM, PCUI, Observer state, or vendored Editor source into the metahubs React tree. The iframe/static artifact boundary is the only allowed integration surface in this slice.
- Use iframe attributes:

```tsx
<iframe
  title={t('metahubs.packages.editorHost.iframeTitle')}
  src={iframeSrc}
  sandbox="allow-scripts"
  referrerPolicy="no-referrer"
  allow=""
/>
```

Implementation may add `allow-same-origin` only if the artifact is served from an isolated origin/subdomain or the implementation proves the need with compensating controls and tests. Same-origin `allow-scripts allow-same-origin` is not the default because it gives framed scripts stronger access to the platform origin.

Development URL mode:

- disabled in production by default;
- enabled only in local/development deployments through an explicit environment allowlist;
- URL parsed and allowlisted by the backend, not only by frontend controls;
- blocked states localize the reason and avoid leaking full URLs to viewer/error states.

## Plan Steps

- [ ] Step 1: Lock final storage and descriptor contracts before coding.
  - Confirm `authoringSurface` as the registry descriptor.
  - Confirm `rel_metahub_packages.config` as the per-attachment settings owner.
  - Confirm `packages[].config` as the snapshot field.
  - Confirm runtime `_app_packages.config` propagation is deferred.
  - Confirm authoring-only packages are excluded from runtime publication snapshots and application `_app_packages`.
  - Confirm `developmentUrl` is local/development-only in this slice; staging/admin external URL support is deferred.
  - Record these decisions in the implementation PR and docs.

- [ ] Step 2: Extend shared package types.
  - Add `PackageAuthoringSurfaceDescriptor`, `PackageAttachmentConfig`, `PackageDisplayMode`, and related DTOs in `packages/universo-react-types/src/common/packages.ts`.
  - Add `PackageAuthoringHostDescriptor` and slug-related types for the host route/API.
  - Extend `MetahubPackageRegistryItem`, `MetahubPackageAttachment`, `MetahubPackageCatalogItem`, and `MetahubSnapshotPackage`.
  - Keep `PackageSourceDescriptor` runtime/import-oriented.
  - Keep runtime `ApplicationPackageDefinition` separate from design-time package config/host DTOs.
  - Add type-level tests or focused compile tests if the package has an existing pattern for shared type contracts.

- [ ] Step 3: Add schema and system app metadata.
  - Add an additive migration:
    - `metahubs.obj_packages.authoring_surface JSONB NOT NULL DEFAULT '{}'::jsonb`
    - `metahubs.rel_metahub_packages.config JSONB NOT NULL DEFAULT '{}'::jsonb`
  - Update `1766351182000-CreateMetahubsSchema.sql.ts` so fresh DB creation matches migrations.
  - Export the additive migration from `packages/universo-react-metahubs-backend/src/platform/migrations/index.ts`.
  - Register the additive migration through the metahubs system app definition migration list used by platform migration loading.
  - Update `systemAppDefinition.ts`.
  - Do not bump metahub schema version or metahub template version.

- [ ] Step 4: Update package seed data.
  - Add `@universo-react/playcanvas-editor` to `seed-packages.json`.
  - Set `source.runtimeTargets: []`.
  - Add `authoringSurface` with schema version `1`, default config, supported display modes, and artifact metadata.
  - Add or derive a reserved deterministic `packageSlug`, initially `playcanvas-editor`, and fail seed/registry validation on slug collisions.
  - Update `PackageSeeder` checksum/upsert logic so `authoringSurface` changes are detected.
  - Add seed tests proving the Editor package is authoring-only and does not expose runtime targets.

- [ ] Step 5: Update backend stores.
  - Return `authoringSurface` from registry/catalog queries.
  - Return attachment `config` from attached package queries.
  - Initialize config from descriptor defaults when attaching a package.
  - Add `updateMetahubPackageConfig` with `RETURNING` and fail-closed behavior.
  - Copy `config` in metahub copy flow.
  - Restore `config` in snapshot import; legacy snapshots without config default safely.
  - Apply the version-change policy: preserve compatible config; require confirmation and reset incompatible config.
  - Define all conflict/upsert paths explicitly:
    - re-attaching the same package version preserves existing config unless the user requested reset to defaults;
    - changing package version preserves compatible config and resets incompatible config only after confirmation;
    - copy `ON CONFLICT DO UPDATE` writes source config into the target attachment;
    - restore `ON CONFLICT DO UPDATE` writes snapshot config into the restored attachment;
    - every returning shape includes `authoringSurface` and normalized `config`.

  Example store mutation:

  ```ts
  await executor.query(
    `UPDATE ${attachmentsTable}
        SET config = $3::jsonb,
            _upl_updated_at = now(),
            _upl_updated_by = $4
      WHERE id = $2
        AND metahub_id = $1
        AND _upl_deleted = false
        AND _app_deleted = false
      RETURNING id, metahub_id, package_id, package_name, expected_version, config`,
    [metahubId, attachmentId, JSON.stringify(config), userId]
  )
  ```

- [ ] Step 6: Add backend validation and routes.
  - Add `PATCH /metahub/:metahubId/package/:attachmentId/config`.
  - Add a read endpoint for the host route, such as `GET /metahub/:metahubId/packages/:packageSlug/authoring-host`, that resolves the attached package by slug and returns a DTO without exposing attachment UUIDs as user-facing data.
  - Gate config writes with `manageMetahub`.
  - Keep the config mutation under the existing authenticated API and CSRF protection policy.
  - Validate config against the attached package version descriptor.
  - Return client-mappable domain error codes, not raw Zod or SQL messages.
  - Add an artifact status endpoint if the frontend host needs server-side artifact availability without probing static HTML directly.
  - Ensure artifact status errors never expose absolute filesystem paths or internal package paths.
  - Update OpenAPI in `packages/universo-react-rest-docs/src/openapi/index.yml`, including an explicit note that attachment config is preserved for metahub copy/snapshot flows but is not propagated to runtime publication in this slice.

- [ ] Step 7: Protect Modules allowlist.
  - Update only metahub package allowlist filtering so authoring-only packages never become Modules import dependencies; do not change compiler behavior, external-file modules behavior, or the broader Modules subsystem in this slice.
  - Filter packages with no `runtimeTargets`.
  - Add a test with PlayCanvas Editor attached and verify it is absent from allowed imports.

- [ ] Step 8: Update snapshot, copy, and hash flows.
  - Split design-time metahub package snapshot export/import from runtime publication package serialization if they currently share `MetahubPackagesService.listPublishedPackages()`.
  - Export package `config` only in metahub design-time snapshots.
  - Restore package `config` only from metahub design-time snapshots, with backwards compatibility for snapshots that do not include it.
  - Copy package `config` during metahub copy.
  - Filter authoring-only packages out of runtime publication snapshots and application sync input; runtime `_app_packages` must receive only packages with non-empty supported `source.runtimeTargets`.
  - Do not add design-time package config to runtime `publicationSnapshotHash` unless the implementation first proves that hash is used for metahub snapshot equivalence rather than application runtime publication. The default expectation for this slice is no runtime publication hash change.
  - Add deterministic JSON key-order normalization only inside metahub snapshot export/import tests or local snapshot comparison helpers that are not runtime publication sync.

- [ ] Step 9: Add static artifact host backend integration.
  - Own artifact status and artifact serving routes in the metahubs backend packages domain, because attachment resolution and metahub access checks belong there.
  - Use core backend only for generic Express/static/CSP plumbing if the metahubs router cannot own the whole response path.
  - Serve `packages/universo-react-playcanvas-editor/dist/editor` as the PlayCanvas Editor artifact source; `@universo-react/playcanvas-editor` may export route constants or manifest helpers, but must not export UI components from upstream Editor.
  - Mount the route under the authenticated artifact URL `/api/v1/metahub/:metahubId/packages/:packageSlug/editor-artifact/*` or an equivalent explicit auth proxy.
  - Validate authenticated metahub access and attached package resolution before serving artifact HTML/assets.
  - Validate `index.html` and `universo-artifact-manifest.json`.
  - Verify the Editor artifact Vite `base` or relative asset strategy is compatible with the nested `/api/v1/.../editor-artifact/*` route.
  - Add a test that asset URLs under the nested route resolve to JS/CSS/assets rather than the SPA fallback.
  - Mount before core frontend static serving and SPA fallback.
  - Add security headers and cache policy.
  - Keep the route independent from root build enrollment of the Editor artifact.
  - Prohibit direct imports of upstream PCUI, Observer, Editor DOM, or vendored app state into MUI code.

- [ ] Step 10: Extend frontend API and TanStack Query hooks.
  - Add typed `updatePackageConfig`, optional `getPackageArtifactStatus`, and host launch helpers in `packagesApi.ts`.
  - Add query keys for package settings/artifact status.
  - Invalidate the attached package list and relevant settings queries after mutations.
  - Keep API DTOs mapped to view models before rendering.

- [ ] Step 11: Update Packages tab UI.
  - Replace runtime-only column text with authoring-aware `Surface / Availability`.
  - Add localized authoring/no-runtime chips.
  - Add `Open editor` and `Settings` actions through an existing menu/action primitive such as `BaseEntityMenu` if it fits; otherwise document why a small local MUI `Menu` is needed in `MetahubPackagesTab`.
  - Preserve read-only permission behavior.
  - Avoid page-level horizontal overflow on desktop/tablet/mobile.

- [ ] Step 12: Add typed Package Settings dialog.
  - Build a PlayCanvas Editor settings form driven by `authoringSurface`.
  - Support display mode, gated development URL, artifact status, save, cancel, and reset defaults.
  - Localize all labels, helper text, validation, success, and error states in EN/RU.
  - Use existing MUI/template primitives before adding new UI components.
  - Check `StandardDialog` capabilities before relying on responsive fullscreen behavior. If `StandardDialog` still does not support `fullScreen`, either extend that shared primitive with tests or use MUI `Dialog` locally with an explicit rationale and matching visual contract.

- [ ] Step 13: Add route-first Editor host page.
  - Register the host route in the current core frontend route owner under singular `/metahub/:metahubId/resources/packages/:packageSlug/editor`.
  - Use readable `packageSlug` route values such as `playcanvas-editor`; never require users to type or recognize attachment UUIDs.
  - Fetch attachment/config/status through the slug-based authoring-host API, not by exposing attachment UUIDs in the route.
  - Render honest states for disabled, artifact-only, missing artifact, blocked dev URL, misconfigured attachment, and load failed.
  - Render iframe only when the selected mode permits it.
  - Implement `openSeparately` as opening the host route in a new tab/window, not the raw static artifact route.
  - Add keyboard/no-hidden-knowledge acceptance checks: the workflow must be reachable through visible row actions and route state, not manual URL construction.

- [ ] Step 14: Add i18n.
  - Add EN/RU keys for:
    - authoring surface labels;
    - no-runtime labels;
    - settings dialog;
    - display modes;
    - artifact status;
    - host states;
    - validation and domain error codes;
    - action labels/tooltips.
  - Keep feature-local keys in metahubs frontend unless reused by another package boundary.
  - Move shared labels to `packages/universo-react-i18n` only when another package consumes them.

- [ ] Step 15: Add GitBook documentation.
  - Update `docs/en/platform/playcanvas-editor.md` and `docs/ru/platform/playcanvas-editor.md`.
  - Update `docs/en/platform/metahubs/packages.md` and `docs/ru/platform/metahubs/packages.md`.
  - Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` if new pages or headings are added.
  - Document artifact-only status, supported display modes, development URL gating, copy/snapshot behavior, and explicitly deferred runtime propagation.
  - Match the OpenAPI/API wording: package config is a metahub design-time attachment setting and is not part of runtime application publication in this slice.

- [ ] Step 16: Add backend tests.
  - Store tests:
    - attach creates default config;
    - catalog/list return `authoringSurface` and config;
    - update config requires attachment/metahub match;
    - version change resets incompatible config only after confirmation;
    - copy preserves config;
    - restore preserves config and imports legacy snapshots without config.
  - Seeder tests:
    - PlayCanvas Editor seed includes `authoringSurface`;
    - seed checksum changes when descriptor changes;
    - Editor `runtimeTargets` is empty.
  - Route/controller tests:
    - config update requires `manageMetahub`;
    - invalid mode/dev URL returns safe 400 domain error;
    - unknown attachment returns 404;
    - successful update returns typed config.
  - Modules tests:
    - authoring-only package is excluded from import allowlist.
  - Runtime publication tests:
    - authoring-only package is absent from runtime publication snapshots;
    - authoring-only package is not written to application `_app_packages`;
    - runtime packages with non-empty targets continue to sync as before.
  - Static host tests:
    - unauthenticated direct artifact route returns 401/403 or a safe redirect;
    - authenticated user without metahub access cannot load the artifact through the host/artifact route;
    - route order before SPA fallback;
    - manifest and index checks;
    - traversal and encoded traversal forbidden;
    - CSP/security headers present.
    - iframe sandbox defaults do not include `allow-same-origin` for same-origin artifact routes.
    - artifact route never falls through to the public SPA `index.html`.
  - Slug tests:
    - `@universo-react/playcanvas-editor` resolves to `playcanvas-editor`;
    - unknown slug returns 404 without leaking internal IDs;
    - slug collision in registry/seed validation fails closed.
  - Migration/bootstrap tests:
    - compiled system app definition includes `authoring_surface` and `config`;
    - fixed system-app structure/configuration version policy is covered by an explicit test or documented migration-only rationale;
    - additive migration is exported and registered through the metahubs system app definition.

- [ ] Step 17: Add frontend Vitest tests.
  - `packagesApi` typed config methods.
  - `MetahubPackagesTab` renders PlayCanvas Editor without empty runtime/raw cells.
  - Actions menu contains `Open editor`, `Settings`, and `Disconnect` with permission-aware states.
  - Settings dialog defaults, validation, reset, save, read-only behavior.
  - Host component states and iframe attributes.
  - Route registration uses `/metahub/:metahubId/resources/packages/:packageSlug/editor`.
  - EN/RU i18n keys exist for all new visible text.

- [ ] Step 18: Add Playwright E2E with browser evidence.
  - Use local Supabase minimal for this feature as requested.
  - Do not run `pnpm dev`; use the repository Playwright wrapper.
  - Recommended command flow for implementation verification:

  ```bash
  pnpm supabase:e2e:start:minimal
  pnpm run build:e2e:local-supabase
  cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "PlayCanvas Editor package settings"
  pnpm supabase:e2e:stop
  ```

  - Required browser flows:
    - create/open a metahub on fresh local Supabase;
    - attach PlayCanvas Editor package;
    - open settings;
    - change display mode and save;
    - refresh and verify persistence;
    - open Editor host;
    - verify artifact-only state;
    - verify blocked development URL state;
    - verify direct unauthenticated raw artifact URL is blocked;
    - verify PlayCanvas Editor is absent from runtime publication package output;
    - copy metahub and verify settings;
    - export/import snapshot and verify settings.
  - Required screenshots:
    - Packages tab at `1920x1080`, `768x1024`, and `390x844`;
    - settings dialog EN and RU;
    - host artifact-only state;
    - missing artifact or blocked development URL state;
    - read-only user Packages tab.
  - Required UX assertions:
    - no page-level horizontal overflow;
    - no raw IDs, raw JSON, `[object Object]`, stack traces, Zod messages, or absolute paths;
    - keyboard path opens settings, changes mode, saves, and opens the host;
    - iframe has expected `sandbox`, `referrerpolicy`, and constrained `allow`.

- [ ] Step 19: Run package-scoped verification.
  - Use targeted package commands first:

  ```bash
  pnpm --filter @universo-react/types build
  pnpm --filter @universo-react/metahubs-backend test
  pnpm --filter @universo-react/metahubs-frontend test
  pnpm --filter @universo-react/core-backend test
  pnpm --filter @universo-react/rest-docs build
  ```

  - Run root `pnpm build` only after targeted checks pass or when the user explicitly wants the full workspace rebuild.
  - Do not make the root build depend on building the PlayCanvas Editor upstream artifact unless the Node/dependency constraints are deliberately accepted in a later step.

- [ ] Step 20: Final QA and closeout.
  - Run the Runtime UI UX Quality Gate on screenshots and Playwright traces.
  - Review the implementation against the brief non-goals.
  - Confirm docs match actual UI and artifact-only limitations.
  - Confirm no stale references imply scene persistence or runtime publication propagation.

## Testing Matrix

| Layer | Tool | Coverage |
| --- | --- | --- |
| Shared contracts | TypeScript build / focused tests | Descriptor/config DTO compatibility and exports |
| Backend storage | Jest or existing backend test runner | schema fields, defaults, update, copy, restore, version policy |
| Backend routes | Jest/API tests | permissions, validation, 400/404/200 behavior |
| Seeder | Jest | PlayCanvas Editor registry row, checksum, authoring-only status |
| Modules | Jest | authoring-only package excluded from allowed imports |
| Static host | Jest/API tests | route order, traversal, headers, manifest/index checks |
| Frontend components | Vitest/RTL | table labels, actions, dialog, host states, iframe attrs, i18n |
| E2E browser | Playwright wrapper | full attach/settings/open flow, EN/RU, read-only, screenshots, no overflow |
| Docs | manual review plus link check if available | GitBook pages and SUMMARY entries match actual implementation |

## Potential Challenges

- `source` metadata drift: putting authoring fields inside `source` would be dropped or misread by current runtime normalizers. Keep authoring metadata separate.
- UI crowding: adding actions directly as separate icons can break responsive layout. Use an overflow menu or stable action cluster.
- False runtime expectations: the host must say artifact-only until scene/project persistence exists.
- Development URL risk: external iframes can weaken security if allowlists, CSP, and sandbox policies are loose.
- Static route order: mounting the artifact route after the SPA fallback will make artifact loading fail or return the core app shell.
- Snapshot compatibility: old snapshots without `config` must still import.
- Version changes: incompatible config must not silently survive package version changes.
- Root build coupling: the Editor artifact has separate upstream assumptions and should not become a required root build dependency in this slice.

## Dependencies

- Existing metahub package foundation must remain in place.
- Local Supabase minimal E2E workflow must be healthy for browser validation.
- The current PlayCanvas Editor package remains artifact-only and pinned through `vendor/UPSTREAM.md`.
- No metahub schema/template version bump is planned; implementation targets fresh DB parity plus additive migration safety.
