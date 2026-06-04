# Plan: PlayCanvas Project Storage Model for Metahubs

> Created: 2026-06-03
> Mode: PLAN
> Status: Draft for discussion
> Brief: private Manager brief
> Research: `memory-bank/research/playcanvas-project-storage-model-for-metahubs-research-2026-06-03.md`

## Overview

Implement a first-class PlayCanvas project storage model for metahubs before the Editor bridge/storage adapter work. The implementation will create branch-scoped PlayCanvas project metadata tables, a PlayCanvas-specific file namespace, snapshot import/export/copy/delete lifecycle support, publication hash/runtime projection support, a minimal metahub UI for project selection/status, and deep automated/browser coverage.

The first slice must not store scene/assets/generated artifacts inside `rel_metahub_packages.config`, must not import PlayCanvas Editor vendor code into MUI/runtime packages, and must not make published applications depend on live authoring files.

## Planning Decisions

-   Use a hybrid model: branch-scoped `_mhb_playcanvas_*` metadata tables plus provider-neutral file references under a sibling file-service namespace such as `playcanvas-projects/...`.
-   Because the user explicitly said the test DB will be recreated and no metahub schema/template version bump is needed, the implementation may update the current baseline/current system-table definitions without increasing template version for this disposable test rollout only. This is not a production upgrade path and must be treated as release-blocking for any non-disposable environment. If the same work is applied to existing branch schemas, the implementation must add the normal system-table migration path: update `SYSTEM_TABLE_VERSIONS`, bump `CURRENT_STRUCTURE_VERSION`, add `SystemTableMigrator`/diff tests, and document the upgrade behavior before release.
-   Keep `rel_metahub_packages.config` as display/lifecycle config only. It may store a default PlayCanvas project reference, but not scenes, asset indexes, binary metadata, or generated artifacts.
-   Support initial asset scope as scene JSON, script asset metadata, generated `.js/.mjs` artifacts, and metadata-only placeholders for textures/models/audio. Binary texture/model/audio upload, processing, thumbnailing, transcoding, and S3/provider configuration remain deferred unless a later storage-provider/asset-processing brief explicitly enables them.
-   Publish a normalized, schema-versioned `playcanvasRuntimeManifests` projection rather than direct Editor scene JSON. The projection must participate in `publicationSnapshotHash.ts` and application sync.
-   Make runtime projection persistence first-class for this plan: if a project is published into an application snapshot, persist/diff it through a dedicated `_app_playcanvas_manifests` application runtime table/section instead of silently reducing it into unrelated layout/module fields.
-   Add minimal MUI project-management/status controls under the existing metahub `/resources` Packages surface by extending `MetahubPackagesTab` behavior for PlayCanvas Editor attachments. Do not create a new top-level app shell or dedicated tab in the first slice, and do not implement scene editing UI or iframe messaging.

## Architecture Layer Placement

-   Metahub authoring layer: PlayCanvas project metadata, scene metadata, asset metadata, script metadata, generated artifact metadata, and file references live in branch-scoped `_mhb_playcanvas_*` tables plus the `playcanvas-projects/...` file namespace.
-   Metahub package attachment layer: `rel_metahub_packages.config` may store only display/lifecycle settings and a default PlayCanvas project pointer for the attached Editor package.
-   Publication/application layer: the normalized `playcanvasRuntimeManifests` projection is the only PlayCanvas project data copied into application runtime sync. Published applications must read immutable hashed runtime assets/artifacts or stored manifest data, not live authoring files.
-   Workspace/user-state layer: per-user runtime state, multiplayer room state, and gameplay state are out of scope for this storage-model slice.
-   Entity model layer: do not introduce a new built-in Platformo entity kind for PlayCanvas internals. Use explicit Platformo entity links only when the adapter/user creates them.

## Affected Areas

-   `packages/universo-react-types`
    -   Shared PlayCanvas project/snapshot/runtime manifest types and validation schemas.
    -   Optional package attachment config extension for a default project pointer.
-   `packages/universo-react-metahubs-backend`
    -   Branch system table definitions for `_mhb_playcanvas_projects`, `_mhb_playcanvas_scenes`, `_mhb_playcanvas_assets`, `_mhb_playcanvas_script_assets`, `_mhb_playcanvas_scene_script_bindings`, `_mhb_playcanvas_generated_artifacts`, and `_mhb_playcanvas_publication_manifests`.
    -   PlayCanvas project store/service/routes/controllers.
    -   PlayCanvas project file service.
    -   Snapshot serialization/restore, metahub copy/delete cleanup, package detach behavior.
-   `packages/universo-react-metahubs-frontend`
    -   API client/hooks using TanStack Query.
    -   Minimal PlayCanvas project/status UI in the package/resources surface.
    -   EN/RU i18n namespace updates through package-local i18n registration and shared i18n bundles where needed.
-   `packages/universo-react-utils`
    -   Canonical hash normalization for PlayCanvas project/runtime projection.
    -   Shared safe-path/hash helpers if they become reusable beyond the backend service.
-   `packages/universo-react-applications-backend`
    -   Runtime sync persistence/diff support and `_app_playcanvas_manifests` application runtime table/section for published `playcanvasRuntimeManifests`.
-   `packages/universo-react-apps-template-mui`
    -   Only if the runtime manifest is exposed to/consumed by the existing `playcanvasCanvas` widget or a placeholder viewer. Keep this package isolated from legacy metahub packages.
-   `packages/universo-react-playcanvas-editor`
    -   Documentation/contract notes only. Do not import vendor source into MUI/runtime.
-   `docs/en`, `docs/ru`
    -   GitBook docs for PlayCanvas project storage, snapshots, publication behavior, and current limitations.
-   `packages/universo-react-rest-docs` or the repository's current REST/OpenAPI documentation package
    -   Route documentation for the new PlayCanvas project and asset endpoints if they are exposed through generated/API docs.
-   `tools/testing/e2e`
    -   Local minimal Supabase Playwright scenarios and screenshot artifacts for the new project management/status UI.

## Data Model Contract

Use UUID v7 ids and branch-scoped tables in each metahub branch schema. Draft table shape:

-   `_mhb_playcanvas_projects`
    -   `id uuid primary key default public.uuid_generate_v7()`
    -   `codename jsonb not null`
    -   `display_name jsonb not null`
    -   `description jsonb null`
    -   `package_name text not null default '@universo-react/playcanvas-editor'`
    -   `package_version text null`
    -   `compatibility_status text not null default 'compatible'`
    -   `compatibility_notes jsonb not null default '{}'`
    -   `schema_version text not null default '1'`
    -   `settings jsonb not null default '{}'`
    -   `default_scene_id uuid null`
    -   `publication_config jsonb not null default '{}'`
    -   lifecycle fields inherited from system table helpers
-   `_mhb_playcanvas_scenes`
    -   project id, scene name/codename, editor entity hierarchy payload pointer, scene payload file reference, scene payload schema version, scene checksum, sort order, publish flag.
-   `_mhb_playcanvas_assets`
    -   project id, stable asset id, type, name, virtual path array, file reference, file hash, MIME, size, provider, metadata JSON, publish flag.
-   `_mhb_playcanvas_script_assets`
    -   asset id, module id/codename/source path reference, script name, ESM/classic type, parsed attributes schema, parse status, parse diagnostics summary.
-   `_mhb_playcanvas_scene_script_bindings`
    -   scene id, scene entity stable id, script asset id, script name, attribute values JSON, binding schema version, explicit Platformo entity link id nullable, sort order, enabled flag.
-   `_mhb_playcanvas_generated_artifacts`
    -   stable artifact id, script asset id, source module id/codename/source path, source checksum, output path, output checksum, output MIME, script name, module/class export name, ESM/classic type, parse status, generated/parsed timestamps.
-   `_mhb_playcanvas_package_compatibility`
    -   project id, package name/version, storage schema version, compatibility status, migration id nullable, migration diagnostics JSON, checked/migrated timestamps.
-   `_mhb_playcanvas_publication_manifests`
    -   project id, selected scene id, normalized runtime manifest JSON, manifest checksum, source project checksum, published flag.

Application runtime table shape:

-   `_app_playcanvas_manifests`
    -   `id uuid primary key default public.uuid_generate_v7()`
    -   `publication_id uuid null`
    -   `source_metahub_id uuid null`
    -   `source_project_id uuid not null`
    -   `source_scene_id uuid null`
    -   `manifest_schema_version text not null default '1'`
    -   `manifest_checksum text not null`
    -   `runtime_manifest jsonb not null`
    -   `asset_count integer not null default 0`
    -   `script_count integer not null default 0`
    -   `artifact_count integer not null default 0`
    -   lifecycle fields consistent with application runtime system tables

Application runtime migration contract:

-   Register `_app_playcanvas_manifests` through the applications backend system-table/DDL path, not through metahub branch DDL.
-   Add application schema bootstrap/migration tests proving fresh application schemas contain the table and existing application schemas receive it when production upgrade support is enabled.
-   Add sync rollback/cleanup behavior so failed manifest persistence does not leave mixed old/new runtime manifest rows after a failed publish sync.

Snapshot section contract:

-   `playcanvasProjects.schemaVersion` is required when the section exists; first implementation uses schema version `1`.
-   Snapshots without `playcanvasProjects` must import cleanly as legacy snapshots.
-   Unsupported future `playcanvasProjects.schemaVersion` values must fail with a localized, user-facing import error and must not leave DB rows or files behind.
-   If the repository has a top-level snapshot format version for added sections, increment it as part of implementation; otherwise keep section-level versioning explicit and add tests proving old snapshots remain compatible.
-   Generated artifact snapshots store both metadata and file payload/checksum. On restore, validate checksums; if an artifact is missing/stale but the module source is available, mark it regenerable and regenerate on import/publish. If source is unavailable, mark the project as not publishable until the artifact is restored or regenerated.
-   Scene payload files and non-script asset file references must also have recovery/status states: `ready`, `missing`, `checksumMismatch`, `unsupportedType`, and `deferredProvider`. Normal load/import must surface those states through typed service results and localized UI statuses without throwing raw file-system errors to normal user surfaces.

Do not force every PlayCanvas entity/object into a Platformo Object. Store Editor-facing scene hierarchy in the project store, and store only explicit links to Platformo entities when the user or adapter creates them.

## Example Contract Snippets

Shared type/schema direction:

```ts
export const playCanvasProjectSchema = z.object({
    schemaVersion: z.literal('1'),
    id: z.string().uuid(),
    codename: versionedLocalizedContentSchema,
    packageRef: z.object({
        packageName: z.literal('@universo-react/playcanvas-editor'),
        version: z.string().min(1).nullable()
    }),
    defaultSceneId: z.string().uuid().nullable(),
    assetRoot: z.object({
        provider: z.enum(['local']),
        root: z.literal('playcanvas-projects')
    })
})
```

SQL-first store direction:

```ts
export async function findPlayCanvasProject(exec: DbExecutor, schemaName: string, projectId: string): Promise<PlayCanvasProjectRow | null> {
    const rows = await exec.query<PlayCanvasProjectRow>(
        `SELECT id, codename, display_name AS "displayName", schema_version AS "schemaVersion"
       FROM ${qSchemaTable(schemaName, '_mhb_playcanvas_projects')}
      WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false
      LIMIT 1`,
        [projectId]
    )
    return rows[0] ?? null
}
```

Safe file namespace direction:

```ts
export const assertSafePlayCanvasProjectPath = (value: string): string => {
    const normalized = value.replace(/\\/g, '/').trim()
    if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
        throw new MetahubValidationError('PlayCanvas asset path must be relative', {
            messageCode: 'playcanvas.files.path.invalidRelative'
        })
    }
    const parts = normalized.split('/')
    if (parts[0] !== 'playcanvas-projects' || parts.some((part) => !part || part === '..' || part.startsWith('.'))) {
        throw new MetahubValidationError('PlayCanvas asset path is outside the project namespace', {
            messageCode: 'playcanvas.files.path.invalidNamespace'
        })
    }
    return parts.join('/')
}
```

Publication hash direction:

```ts
const normalizePlayCanvasRuntimeManifest = (value: unknown): Record<string, unknown> => {
    const manifest = asRecord(value)
    return {
        projectId: typeof manifest.projectId === 'string' ? manifest.projectId : '',
        sceneId: typeof manifest.sceneId === 'string' ? manifest.sceneId : '',
        assets: asArray(manifest.assets).map(normalizeRuntimeAsset).sort(compareById),
        scripts: asArray(manifest.scripts).map(normalizeRuntimeScript).sort(compareById),
        checksum: typeof manifest.checksum === 'string' ? manifest.checksum : ''
    }
}
```

## Plan Steps

### Phase 1: Contracts and Baseline Schema

-   [ ] Add shared PlayCanvas project contracts in `@universo-react/types`: project envelope, scene metadata, asset metadata, script asset metadata, generated artifact metadata, snapshot section, runtime manifest, adapter API request/response DTOs, and user-facing status enums.
-   [ ] Extend package attachment config with an optional default PlayCanvas project pointer only, guarded so no scene/asset payload can be stored in config.
-   [ ] Add `_mhb_playcanvas_*` system table definitions to the current branch baseline without bumping template version, per user instruction for a recreated test DB.
-   [ ] Add a production-ready migration note/task in the same plan implementation: if existing branches must be supported, update `SYSTEM_TABLE_VERSIONS`, bump `CURRENT_STRUCTURE_VERSION`, and add `SystemTableMigrator`/schema-diff tests before release. Mark release to any non-disposable environment as blocked until this path exists.
-   [ ] Update branch/schema bootstrap tests to prove fresh branches get the new tables and indexes.
-   [ ] Add explicit comments/docs that existing branches require a later structure migration if this is applied outside a recreated test DB.
-   [ ] Define package compatibility status/migration metadata for PlayCanvas projects so package version upgrades/downgrades can be reported as compatible, needs migration, unsupported, or blocked without deleting project data.

### Phase 2: PlayCanvas File Service

-   [ ] Implement `PlayCanvasProjectFileService` modeled after `ModuleSourceFileService`, but with a separate `playcanvas-projects/...` namespace and type-specific limits.
-   [ ] Enforce provider-scoped roots, traversal guards, symlink rejection, MIME/extension allowlists, checksum validation, atomic writes, copy tree, delete tree, and rollback helpers.
-   [ ] Keep future S3 compatibility as metadata fields (`provider`, `path`, `hash`, `size`, `mime`, `storageClass`) without implementing S3 storage in this slice.
-   [ ] Add lifecycle helpers for metahub copy, project delete, asset delete, and failed snapshot import cleanup.
-   [ ] Keep initial file writes limited to scene payload JSON and generated `.js/.mjs` artifacts. Texture/model/audio assets are metadata/file-reference placeholders in this slice and cannot enter a processing pipeline.

### Phase 3: Backend Store, Service, and Routes

-   [ ] Create `domains/playcanvas-projects` in `metahubs-backend` with SQL-first stores using `DbExecutor.query()`, schema-qualified identifiers, parameterized SQL, `RETURNING` for mutations, and fail-closed zero-row behavior.
-   [ ] Add service methods for:
    -   `loadProject`
    -   `listProjects`
    -   `createProject`
    -   `updateProjectSettings`
    -   `deleteProject`
    -   `listScenes`
    -   `readScene`
    -   `writeScene`
    -   `listAssets`
    -   `readAssetMetadata`
    -   `writeAssetMetadata`
    -   `resolveScriptAsset`
    -   `upsertGeneratedArtifact`
    -   `publishProjectState`
    -   `exportProjectState`
-   [ ] Add routes under `/metahub/:metahubId/playcanvas/...` with read/write rate limiters, `createMetahubHandlerFactory`, request-scoped executors, and existing metahub manage/read permission checks.
-   [ ] Add explicit project asset file routes under `/metahub/:metahubId/playcanvas/projects/:projectId/assets/...` for authorized upload/download/delete of project files, separate from package artifact hosting.
-   [ ] Apply route-level cache policy: authoring reads are `no-store`/short-lived; hashed generated artifacts may use immutable cache headers only when the path/checksum is content-addressed.
-   [ ] Validate MIME, extension, declared checksum, actual checksum, size, and namespace on every upload/download. Redact absolute file paths/provider internals from all route errors and logs visible to users.
-   [ ] Add optimistic guards for mutable project/scene/asset writes using `_upl_version` plus file checksum where a file is touched.
-   [ ] Ensure package detach/version-change does not delete project data. Project records must survive detach/reattach; config may only lose/default its pointer.

### Phase 4: Snapshot, Restore, Copy, and Delete Lifecycle

-   [ ] Extend `MetahubSnapshot` with an optional `playcanvasProjects` section for design-time project data and files.
-   [ ] Define `playcanvasProjects.schemaVersion = 1` and update top-level snapshot format version if the existing snapshot format uses a global version for added sections.
-   [ ] Update `SnapshotSerializer` to export project metadata, scene payload references/content, asset metadata, generated artifact metadata, and file checksums.
-   [ ] Update `SnapshotRestoreService` to restore projects after modules/packages are restored, remap project/scene/asset/artifact/module/entity ids, validate checksums, write files, roll back file writes on DB failure, and clean stale project files safely.
-   [ ] Update metahub copy to copy/remap PlayCanvas project metadata and file trees without pointing to the source metahub.
-   [ ] Update metahub delete/purge flows to clean PlayCanvas project file trees.
-   [ ] Add explicit handling for snapshots without `playcanvasProjects` so old snapshots import cleanly.
-   [ ] Add explicit handling for unsupported future `playcanvasProjects.schemaVersion` so restore fails closed with cleanup and localized import diagnostics.

### Phase 5: Publication and Application Runtime Projection

-   [ ] Define `playcanvasRuntimeManifests` as a normalized publication projection separate from authoring `playcanvasProjects`.
-   [ ] Add projection builder that resolves selected scene, asset URLs/hashes, generated script artifact URLs/hashes, module bundle references, script names, script attribute schemas, and instance values.
-   [ ] Update `publicationSnapshotHash.ts` so any runtime manifest scene/asset/script/generated-artifact change changes the publication hash.
-   [ ] Persist runtime projection through a first-class `_app_playcanvas_manifests` application runtime table/section when the manifest is present in a published application snapshot.
-   [ ] Register `_app_playcanvas_manifests` through the applications backend schema/DDL path and add application migration/bootstrap tests for fresh schemas and production upgrade support when enabled.
-   [ ] Add application sync diff/persist helpers and tests comparable to `syncModulePersistence.ts` and `syncPackagePersistence.ts`; prove manifest-only changes are not skipped by sync.
-   [ ] Add failure handling for application sync so partial `_app_playcanvas_manifests` writes are rolled back or replaced atomically with the previous known-good manifest set.
-   [ ] Keep published runtime independent of live authoring project files; runtime reads only immutable hashed assets/artifacts or stored publication projection.

### Phase 6: Minimal Metahub UI

-   [ ] Add a PlayCanvas Projects panel/section in the existing `/resources` Packages authoring flow by extending the current `SharedResourcesPage -> MetahubPackagesTab` path for attached PlayCanvas Editor packages.
-   [ ] Use TanStack Query hooks and existing MUI primitives from `packages/universo-react-template-mui`; do not create a one-off app shell, new top-level route, or new Resources tab in the first slice.
-   [ ] Reuse existing package-row action/menu patterns from `MetahubPackagesTab` and shared primitives such as `FlowListTable` or the closest existing embedded list pattern, `StandardDialog`, `ConfirmDeleteDialog`, `EmptyListState`, `Chip`, and `Alert`.
-   [ ] Add query-key contracts in `metahubsQueryKeys`: `playcanvasProjects(metahubId)`, project detail/status keys, and invalidation after create/delete/default selection. Invalidate package/detail keys only where a package attachment pointer actually changes.
-   [ ] Support list/create/select default project, project health/status, scene/asset/script counts, missing/stale artifact warnings, publishability state, and safe delete confirmation.
-   [ ] Do not implement scene editing, asset browser, or iframe bridge messaging in this slice.
-   [ ] Add EN/RU i18n for every label, empty state, loading state, validation message, error state, status chip, and destructive confirmation.

## UI Contract

-   Placement:
    -   PlayCanvas project management lives inside the existing `/resources` Packages surface for an attached PlayCanvas Editor package.
    -   The first slice must not add a new top-level app shell, route, or standalone Resources tab. A later brief may split it out if project management grows beyond package-scoped settings/status.
-   Package row/menu integration:
    -   PlayCanvas Editor package rows expose a localized action/menu entry for project settings/status using the existing row action pattern.
    -   Rows show only user-facing package/project names and localized status chips; raw attachment ids, project ids, branch schema names, file roots, and checksums stay hidden.
-   Projects panel:
    -   Shows project display name, localized status, default marker, scene count, script count, asset count, generated artifact health, and publishability summary.
    -   Scene/assets/scripts arrays must be aggregated into user-facing counts/statuses and never rendered as raw object cells.
    -   Empty state uses `EmptyListState`; recoverable errors use localized `Alert`.
-   Create/edit dialog:
    -   Uses `StandardDialog` or the package's existing equivalent dialog primitive.
    -   Matches the current package-dialog contract, including disabled presentation controls such as `disablePresentationControls` when using `StandardDialog`.
    -   Name/codename fields reuse existing metahub localized/codename helpers.
    -   Description is multiline with `minRows` and remains readable on mobile without clipping action buttons.
    -   Backend/Zod `.message` text must not be forwarded directly to snackbar/dialog surfaces; map backend `messageCode` values to EN/RU i18n keys.
-   Default project selector:
    -   Selects by localized display name and publishability/status, not by raw UUID.
    -   Shows a localized warning if the selected default project is missing required generated artifacts or scene data.
-   Status/developer details:
    -   Normal UI shows asset name, type, size, source label, and localized status.
    -   Virtual storage paths, full checksums, provider paths, and debug diagnostics are allowed only inside an explicitly named developer/details disclosure that is closed by default, keyboard reachable, and must never expose absolute filesystem paths.
-   Delete confirmation:
    -   Uses `ConfirmDeleteDialog` or the existing destructive confirmation primitive.
    -   Confirmation text is localized and explains that deleting a project removes its PlayCanvas project data/files, while package detach/reattach does not delete projects.
-   Controls:
    -   project name/codename: localized text fields using existing metahub locale/codename helpers;
    -   description: multiline text area with mobile-safe sizing;
    -   default project: select/autocomplete by display name, not raw UUID;
    -   project status: localized chips/alerts;
    -   delete: shared destructive confirmation dialog.
-   Display values:
    -   show project names, scene names, filenames, user-facing asset types/sizes, and localized statuses;
    -   never show raw UUIDs, filesystem absolute paths, raw Observer JSON, raw Zod errors, or backend stack messages on normal surfaces.
-   Hidden/system-owned fields:
    -   ids, branch schema, file root, virtual storage paths, checksum guards, full checksums, `_upl_version`, package attachment ids.
-   Validation:
    -   localized EN/RU messages for duplicate codename, unsupported file type, too-large file, checksum conflict, stale generated artifact, missing module, missing asset file, and publish-blocking state.
-   Responsive proof:
    -   desktop, tablet, and mobile screenshots must prove no page-level horizontal overflow, no clipped action buttons, and usable delete/settings dialogs.
-   Runtime/canvas proof:
    -   if Phase 5 changes runtime UI or `apps-template-mui`, Playwright must prove nonblank PlayCanvas rendering, cleanup on navigation, no keyboard/pointer traps, and no raw protocol/session ids.

## Test Plan

### Backend Jest

-   [ ] `PlayCanvasProjectFileService` path traversal, hidden segments, symlink rejection, namespace enforcement, MIME/extension validation, size limits, checksum mismatch, atomic write rollback, copyTree, deleteTree.
-   [ ] Project store/service CRUD: parameterized SQL, schema-qualified identifiers, UUID v7 defaults, optimistic version conflicts, zero-row fail-closed updates/deletes, permission-safe route handling.
-   [ ] Project asset routes: authorized upload/download/delete, no-cache authoring reads, immutable cache only for content-addressed artifacts, checksum validation, MIME validation, and absolute-path/provider-internal redaction.
-   [ ] Scene/asset/script/generated artifact flows: duplicate stable ids, duplicate virtual paths, missing module references, stale generated artifact status, artifact source module codename/path remapping, parsed attribute schema persistence, per-scene script value persistence.
-   [ ] Missing-file recovery states for scene payloads, non-script asset references, and generated artifacts: ready, missing, checksum mismatch, unsupported type, deferred provider, regenerable, and publish-blocking.
-   [ ] Package compatibility flows: detach/reattach survival, version upgrade/downgrade compatibility status, compatibility migration record persistence, unsupported package version status, and localized diagnostics.
-   [ ] Snapshot serializer/restore: export/import/remap projects, scenes, assets, script assets, scene script bindings, generated artifacts, file payloads; reject tampered checksums; clean/rollback files on DB failure; import old snapshots without `playcanvasProjects`; reject unsupported future `playcanvasProjects.schemaVersion`.
-   [ ] Metahub copy/delete lifecycle: remap ids and copy files; delete project files on metahub purge; preserve project data across package detach/reattach.
-   [ ] Application sync: `_app_playcanvas_manifests` diff/persist tests prove changed runtime manifests are detected and no-op paths remain no-op.
-   [ ] Application runtime schema tests for `_app_playcanvas_manifests` table shape, lifecycle fields, schema bootstrap, production migration path when enabled, and failed-sync rollback/no mixed state.
-   [ ] Fresh-DB bootstrap tests for `_mhb_playcanvas_*` tables. If implementation targets existing branches, add `SystemTableMigrator` and schema-diff tests for the structure version bump.

### Vitest / Shared Types / Frontend

-   [ ] `@universo-react/types` schema tests for project envelope, asset metadata, generated artifact metadata, runtime manifest, and package config pointer.
-   [ ] `@universo-react/utils` hash tests proving scene, asset hash, script attribute schema, generated artifact hash, and runtime manifest changes affect normalized hash.
-   [ ] Frontend component tests for the package-row integration, Projects panel, create/edit dialog, default selector, status/developer details disclosure, and delete confirmation.
-   [ ] Frontend assertions: no raw ids, no raw object cells, no raw JSON, no normal-surface storage paths/checksums, localized statuses, mapped validation display, loading/error/empty states, dialog presentation controls disabled where package dialogs disable them, and TanStack Query invalidation.
-   [ ] Developer/details disclosure tests: closed by default, localized as developer/details, keyboard reachable, no absolute filesystem paths even when expanded.
-   [ ] i18n registration tests or checks so EN/RU keys are loaded and no raw keys render.

### Playwright E2E

-   [ ] Use local minimal Supabase per user instruction:
    -   `pnpm supabase:e2e:start:minimal`
    -   run the repository Playwright CLI wrapper on `http://127.0.0.1:3100`
    -   stop/cleanup the E2E stack after the suite.
-   [ ] Browser flow: create fresh metahub, attach PlayCanvas Editor, create/select PlayCanvas project, view project health, export snapshot, import snapshot into a new metahub, verify restored project counts/status.
-   [ ] Browser flow: copy metahub and verify copied project points to copied file namespace through UI/API-visible safe status, not source metahub.
-   [ ] Browser flow: package detach/reattach does not delete project; default pointer behavior is clear and localized.
-   [ ] Keyboard-only flow: use Tab/Enter/Escape to reach `/resources`, open the PlayCanvas Editor package action/menu, create a project, select it as default, cancel delete, and confirm delete.
-   [ ] Keyboard-only developer/details flow: verify the developer disclosure is closed by default, reachable by keyboard, expandable/collapsible, and does not reveal absolute paths.
-   [ ] Screenshots:
    -   EN desktop project panel;
    -   RU desktop project panel;
    -   mobile project panel/actions;
    -   delete confirmation dialog;
    -   import/copy restored project status.
-   [ ] Viewports: desktop, tablet, and mobile. For each, assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth`; allow horizontal scroll only inside an intentionally scrollable table/list container.
-   [ ] UX assertions: no raw UUID-only cells, no raw JSON/object cells, no absolute paths, no normal-surface storage paths/checksums, no internal errors, no clipped buttons, no hidden keyboard path.
-   [ ] If runtime projection UI is changed: screenshot nonblank canvas/runtime manifest state and validate cleanup/no input trap.

### Validation Commands

-   [ ] `pnpm --filter @universo-react/types test`
-   [ ] `pnpm --filter @universo-react/utils test`
-   [ ] `pnpm --filter @universo-react/metahubs-backend test -- <focused test files>`
-   [ ] `pnpm --filter @universo-react/metahubs-frontend test -- <focused test files>`
-   [ ] `pnpm --filter @universo-react/applications-backend test -- <focused sync tests>` if runtime sync is touched.
-   [ ] `pnpm --filter @universo-react/apps-template-mui test -- <focused tests>` if runtime widget/UI is touched.
-   [ ] `pnpm --filter <touched-package> build` for each touched package.
-   [ ] `pnpm build` only as a final/user-approved validation step after focused checks, because root builds are expensive but cross-workspace propagation matters.
-   [ ] `node tools/lint-db-access.mjs`
-   [ ] Update and validate `@universo-react/rest-docs` or the repository's OpenAPI/rest documentation package if new routes are externally documented there.
-   [ ] Documentation/i18n checks already used by the repo, plus Playwright screenshot evidence.
-   [ ] Final `autoreview` skill pass after implementation.

## Documentation Plan

-   [ ] Update `docs/en/platform/playcanvas-editor.md` and `docs/ru/platform/playcanvas-editor.md` with the new project storage boundary, what is supported, and what remains deferred.
-   [ ] Add `docs/en/platform/playcanvas-projects.md` and `docs/ru/platform/playcanvas-projects.md` if the storage model needs its own GitBook page.
-   [ ] Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`.
-   [ ] Update package-local READMEs for metahubs backend/frontend if they document domain route surfaces.
-   [ ] Update API/OpenAPI/rest-docs documentation for new `/metahub/:metahubId/playcanvas/...` routes if the route family is exposed through the repository REST docs.
-   [ ] Document snapshot export/import/copy behavior and the fresh-DB/no-version-bump constraint.
-   [ ] Include real screenshots generated by Playwright for the project panel/status surfaces.

## Potential Challenges

-   No structure-version bump is only safe for recreated test databases. Existing branch schemas will not be upgraded automatically.
-   Application sync can silently skip runtime changes if `playcanvasRuntimeManifests` is not included in canonical hashing and diff/persist checks.
-   Direct Editor scene JSON is not proven stable. Runtime projection must be normalized and versioned.
-   Generated `.js/.mjs` artifacts need checksum and regeneration semantics; treating them as disposable without import/publish recovery would make snapshots incomplete.
-   Filesystem and DB transactions cannot be truly atomic together. Services need explicit backup/rollback/cleanup paths and tests.
-   PlayCanvas asset ids and virtual paths need remapping on import/copy; raw ids from source metahubs must not leak.
-   Runtime UI work must not couple `apps-template-mui` to metahubs/frontend packages or PlayCanvas Editor PCUI/Observer internals.

## Dependencies

-   Completed file-backed Modules implementation.
-   Completed PlayCanvas Editor artifact package and metahub package display settings.
-   Existing `@universo-react/playcanvas-engine` runtime wrapper and `playcanvasCanvas` widget remain runtime context but are not treated as Editor project storage.
-   Future separate briefs remain needed for:
    -   Editor iframe bridge/storage adapter;
    -   S3/admin file-provider configuration;
    -   full asset processing pipeline for textures/models/audio;
    -   Colyseus authoring model;
    -   AI/MCP scene editing.

## Plan UX Review Checklist

-   [x] Plan includes UI Contract for project/status surfaces.
-   [x] Plan blocks raw UUIDs, raw JSON, absolute paths, internal errors, and hidden-knowledge workflows.
-   [x] Plan requires EN/RU i18n for all user-facing states.
-   [x] Plan reuses existing MUI/TanStack Query patterns instead of a one-off shell.
-   [x] Plan requires responsive Playwright screenshots and no horizontal overflow assertions.
-   [x] Plan keeps `apps-template-mui` isolated if runtime work is touched.

## QA-Closed Decisions

-   Runtime manifests are first-class publication/application sync data in this plan, with `_app_playcanvas_manifests` when published.
-   First asset scope excludes binary texture/model/audio processing and S3/provider configuration; those are deferred to later briefs.
-   Minimal UI lives inside the existing `/resources` Packages surface by extending PlayCanvas Editor package row/settings behavior; no new top-level UI surface is added in this slice.
