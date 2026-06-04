# Plan: Modules as External Files for PlayCanvas-Ready Authoring

> Created: 2026-06-01
> Mode: PLAN
> Brief: private Manager brief
> Research: `memory-bank/research/modules-external-files-playcanvas-research-2026-06-01.md`
> Status: QA-reviewed draft for discussion

## Overview

Implement file-backed metahub Modules so `.ts` / `.tsx` module source files are readable by the running platform without a root rebuild. The feature must preserve the current module compiler security model, shared-library dependency ordering, publication/runtime bundle lifecycle, snapshot portability, metahub copy behavior, and future PlayCanvas Editor script-asset compatibility.

The concrete implementation direction is:

-   keep `sourceKind` as module semantic/runtime metadata;
-   add a separate physical storage contract, `storageMode: inline | file`;
-   keep application runtime `_app_modules` bundle-only;
-   resolve external files only inside metahub authoring, compile, publish, export, restore, and copy paths;
-   do not implement PlayCanvas scene/project/script-asset storage in this slice.

The user explicitly allows a fresh test database and does not want a metahub schema/template version bump. Therefore this plan uses a baseline-first schema change for the current system table definition and tests the fresh-DB path. A production migration for already-created databases is out of scope for this slice.

QA clarification: existing metahub schemas are explicitly unsupported until a separate migration/version-bump plan is approved. This slice must include static checks proving `SYSTEM_TABLE_VERSIONS`, built-in template version identifiers, and production migrator paths are not changed accidentally. In non-fresh schemas that lack the new columns, file mode must be hard-disabled with a clear unsupported-schema response instead of partially enabling the feature.

## Skills And Sources Used

-   `research-before-plan`: loaded the existing source-backed research artifact before planning.
-   `universo-platform-architecture`: confirmed layer ownership, module placement, DB access rules, and runtime/application boundaries.
-   `mui-runtime-ux-patterns` and `runtime-ux-qa`: used to define the UI contract and browser evidence requirements.
-   `playwright-best-practices`: used for local Supabase E2E and screenshot/testing workflow.
-   `vitest` and `turborepo`: used for test/build planning in the monorepo.
-   Context7 `/vitejs/vite`: confirmed `publicDir` serves/copies assets as-is and `handleHotUpdate` is dev-client HMR, not backend source resolution.
-   Context7 `/playcanvas/engine`: confirmed ESM script loading, asset data, and script attributes remain future Editor bridge concerns.
-   Context7 `/tanstack/query`: confirmed array query keys, invalidation from mutations, and optimistic update rollback patterns for React Query v5.
-   Explorer subagent reviewed affected files and confirmed risk areas around schema, resolver placement, snapshot/hash, runtime sync, UI, and tests.
-   QA subagents reviewed the plan against the brief, research, and local architecture. Their findings are incorporated in this revision.

## Affected Areas

-   Shared contracts:
    -   `packages/universo-react-types/src/common/modules.ts`
    -   `packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts`
-   Compiler:
    -   `packages/universo-react-modules-engine/src/compiler.ts`
    -   related compiler tests
-   Backend metahub modules:
    -   `packages/universo-react-metahubs-backend/src/domains/modules/services/modulesStore.ts`
    -   `packages/universo-react-metahubs-backend/src/domains/modules/services/MetahubModulesService.ts`
    -   new `packages/universo-react-metahubs-backend/src/domains/modules/services/ModuleSourceFileService.ts`
    -   new `packages/universo-react-metahubs-backend/src/domains/modules/services/ModuleSourceResolver.ts`
    -   `packages/universo-react-metahubs-backend/src/domains/modules/controllers/modulesController.ts`
    -   module routes under `packages/universo-react-metahubs-backend/src/domains/modules/`
-   Metahub system table baseline:
    -   `packages/universo-react-metahubs-backend/src/domains/metahubs/services/systemTableDefinitions.ts`
    -   related system table tests
-   Snapshot, import/export, copy, templates:
    -   `packages/universo-react-metahubs-backend/src/domains/publications/services/SnapshotSerializer.ts`
    -   `packages/universo-react-metahubs-backend/src/domains/metahubs/controllers/metahubsController.ts`
    -   `packages/universo-react-metahubs-backend/src/domains/metahubs/services/SnapshotRestoreService.ts`
    -   `packages/universo-react-metahubs-backend/src/domains/templates/services/TemplateManifestValidator.ts`
    -   `packages/universo-react-metahubs-backend/src/domains/templates/services/TemplateSeedExecutor.ts`
-   Applications runtime sync boundary:
    -   `packages/universo-react-applications-backend/src/services/applicationSyncContracts.ts`
    -   `packages/universo-react-applications-backend/src/routes/sync/syncModulePersistence.ts`
    -   `packages/universo-react-applications-backend/src/services/runtimeModulesService.ts`
-   Core backend configuration:
    -   `packages/universo-react-core-backend/src/commands/base.ts`
    -   relevant env examples and E2E env setup for `UPL_MODULE_SOURCE_ROOT`
-   Frontend:
    -   `packages/universo-react-metahubs-frontend/src/domains/modules/api/modulesApi.ts`
    -   `packages/universo-react-metahubs-frontend/src/domains/modules/ui/EntityModulesTab.tsx`
    -   `packages/universo-react-metahubs-frontend/src/domains/modules/utils/moduleEditor.ts`
    -   package query key helpers in `domains/shared/queryKeys.ts`
    -   `packages/universo-react-metahubs-frontend/src/i18n/locales/en/metahubs.json`
    -   `packages/universo-react-metahubs-frontend/src/i18n/locales/ru/metahubs.json`
    -   `packages/universo-react-i18n` only if a label becomes cross-package instead of metahubs-only
-   Documentation:
    -   `docs/en/guides/metahub-modules.md`
    -   `docs/ru/guides/metahub-modules.md`
    -   `docs/en/architecture/modules-system.md`
    -   `docs/ru/architecture/modules-system.md`
    -   `docs/en/api-reference/modules.md`
    -   `docs/ru/api-reference/modules.md`
    -   `docs/en/SUMMARY.md` / `docs/ru/SUMMARY.md` only if new pages are added

## Architecture Decisions

### Storage Contract

Add explicit physical storage fields to design-time module records:

```ts
export const MODULE_STORAGE_MODES = ['inline', 'file'] as const
export type ModuleStorageMode = (typeof MODULE_STORAGE_MODES)[number]

export type ModuleSourceStatus = 'inline' | 'ready' | 'modified' | 'missing' | 'unreadable' | 'conflict'

export interface ModuleSourceStorage {
    mode: ModuleStorageMode
    path?: string | null
    checksum?: string | null
    status?: ModuleSourceStatus
    lastReadAt?: string | null
    lastCompileAt?: string | null
    lastCompileStatus?: 'never' | 'success' | 'failed' | null
    lastCompileMessageCode?: string | null
}
```

Use DB columns for core storage metadata:

-   `storage_mode` string, not nullable, default `inline`;
-   `source_code` text, nullable: inline modules use it as source of truth; file modules keep it `null` and must not use it as an implicit last-known fallback;
-   `source_path` string, nullable, normalized relative path;
-   `source_checksum` string, nullable, SHA-256 of the last resolved file content;
-   `source_last_read_at` timestamptz, nullable.
-   `source_last_compile_at` timestamptz, nullable;
-   `source_last_compile_status` string, nullable, constrained in service code to `never | success | failed`;
-   `source_last_compile_message_code` string, nullable, sanitized/localizable diagnostic code only.

Keep `sourceKind` unchanged. Do not enable `sourceKind=external` as an authoring shortcut in this slice.

### Source Root

Use a backend-owned runtime data root, not package source and not Vite public assets:

```text
<UPL_MODULE_SOURCE_ROOT or runtime data root>/
  metahubs/
    <metahubId>/
      branches/
        <branch-or-schema-slug>/
          modules/
            general/
              <module-codename>.ts
            metahub/
              <module-codename>.ts
            attached/
              <attached-kind-slug>/
                <module-codename>.ts
```

The API and UI expose only relative paths such as `modules/general/shared-helpers.ts`. Absolute paths never appear in normal responses, logs exposed to users, validation messages, or UI.

Persisted `source_path` is always relative to the metahub branch source root and starts under `modules/...`; it never contains `metahubs/<id>`, branch/schema ids, attached entity ids, or absolute runtime roots. `ModuleSourceFileService` methods must receive `metahubId` plus branch/schema identity explicitly or expose a scoped instance such as `forMetahubBranch(metahubId, schemaName)` so cross-metahub and cross-branch aliasing is impossible even when two branches contain the same relative path.

Generated paths must be user-friendly and ID-free. The default path comes from module codename, module scope, and a safe attachment kind slug; it must not include raw UUIDs. If the implementation needs an internal physical discriminator, keep it below the branch root and outside displayed/persisted `source_path`, or use a non-user-facing mapping table.

File mode has no stale DB source fallback. If a file cannot be read during compile, publish, export, or copy, the operation fails closed unless the user explicitly chooses an import recovery mode that converts the module to inline source from snapshot content.

Supported source-root deployment modes:

-   runtime data volume, the default self-hosted path;
-   git-tracked workspace directory, optional and supported when `UPL_MODULE_SOURCE_ROOT` points inside a repository;
-   deterministic temporary root for Jest/Playwright.

All modes must work without root `pnpm build` after file edits. Documentation must explain `.gitignore` expectations for runtime-generated roots and how a git-tracked root can be reviewed with normal source diffs.

### Runtime Boundary

The resolver lives in metahub backend authoring/publication/export paths. `applications-backend` sync receives already resolved snapshots and compiled bundles. It must not read filesystem module sources.

### PlayCanvas Boundary

External module files are source inputs for later PlayCanvas Editor script work. They are not Editor script assets yet. Later bridge work still needs generated JS/ESM or `.mjs` files, stable virtual paths, asset ids, file hashes, and script-attribute parse/result persistence.

## Plan Steps

### Phase 1: Baseline Contracts And Schema

-   [ ] Add `ModuleStorageMode`, `ModuleSourceStatus`, `ModuleSourceStorage`, source checksum guard types, and snapshot source-storage types in `@universo-react/types`.
-   [ ] Extend `MetahubModuleRecord` with `storageMode`, `sourcePath`, `sourceChecksum`, `sourceStatus`, `sourceLastReadAt`, `sourceLastCompileAt`, `sourceLastCompileStatus`, `sourceLastCompileMessageCode`, and `version`.
-   [ ] Keep `sourceCode` optional or nullable in shared DTOs where a file-backed module can be listed without inlining full source.
-   [ ] Update `_mhb_modules` baseline in `systemTableDefinitions.ts` with the new storage columns and nullable `source_code`.
-   [ ] Add partial unique index `idx_mhb_modules_source_path_active_unique` on `source_path` where `storage_mode = 'file'`, `source_path IS NOT NULL`, `_upl_deleted = false`, and `_mhb_deleted = false`.
-   [ ] Do not increment metahub structure/template versions in this slice. Update current baseline tests and fixture expectations for a fresh DB.
-   [ ] Add a static regression check that `SYSTEM_TABLE_VERSIONS`, template version constants/manifests, and production migrator paths are unchanged in this slice.
-   [ ] Add schema tests proving new `_mhb_modules` rows can represent both inline and file modes.
-   [ ] Add schema/store tests proving concurrent duplicate `source_path` attempts fail on the DB constraint, not only on service pre-checks.
-   [ ] Add a fresh-DB-only acceptance note to implementation docs and tests. Existing databases require a separate migration/versioning brief.
-   [ ] Add a capability/schema guard so existing schemas without the new columns return an explicit unsupported-schema response for file-mode commands.

Example DTO normalization:

```ts
const normalizeStorageMode = (value: unknown): ModuleStorageMode => (value === 'file' ? 'file' : 'inline')

const resolveModuleSourceStatus = (input: {
    storageMode: ModuleStorageMode
    sourcePath?: string | null
    sourceChecksum?: string | null
    readError?: unknown
    currentChecksum?: string | null
}): ModuleSourceStatus => {
    if (input.storageMode === 'inline') return 'inline'
    if (!input.sourcePath) return 'missing'
    if (input.readError) return 'unreadable'
    if (input.sourceChecksum && input.currentChecksum && input.sourceChecksum !== input.currentChecksum) return 'modified'
    return 'ready'
}
```

### Phase 2: Backend File Service

-   [ ] Implement `ModuleSourceFileService` as the only filesystem boundary for module source files.
-   [ ] Resolve an approved root from a backend config/env path with a deterministic test override.
-   [ ] Add `UPL_MODULE_SOURCE_ROOT` to backend CLI/env plumbing in `packages/universo-react-core-backend/src/commands/base.ts`, implementation docs, and E2E environment setup.
-   [ ] Use deterministic temporary source roots for Jest and Playwright, and clean them between tests.
-   [ ] Validate paths with:
    -   normalized POSIX-style relative path;
    -   no absolute paths;
    -   no `..` traversal;
    -   no empty segments;
    -   no hidden/internal file segments;
    -   `.ts` / `.tsx` extension allowlist;
    -   realpath containment after symlink resolution;
    -   no absolute path leakage in returned errors.
-   [ ] Implement safe read, stat/checksum, directory creation, atomic write, rename/replace, delete, and copy tree helpers.
-   [ ] Use `crypto.createHash('sha256')` for source checksums.
-   [ ] Reject duplicate `sourcePath` ownership per metahub unless a separate shared-file contract is approved.
-   [ ] Add focused Jest tests for path validation, `.mts`/`.js`/`.jsx`/`.mjs` rejection, symlink escape rejection, checksum, atomic write, duplicate path ownership, copy/remap, cross-metahub read/copy rejection, and sanitized errors.

Example path guard shape:

```ts
const assertSafeRelativeModulePath = (value: string): string => {
    const normalized = value.replace(/\\/g, '/').trim()
    if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
        throw new MetahubValidationError('Module source path must be a relative TypeScript file path')
    }
    const parts = normalized.split('/')
    if (parts.some((part) => part.length === 0)) {
        throw new MetahubValidationError('Module source path cannot contain empty segments')
    }
    if (parts.some((part) => part === '..' || part.startsWith('.'))) {
        throw new MetahubValidationError('Module source path cannot contain hidden or parent segments')
    }
    if (!/\.tsx?$/.test(parts[parts.length - 1] ?? '')) {
        throw new MetahubValidationError('Module source path must end with .ts or .tsx')
    }
    return parts.join('/')
}
```

For this slice, `.mts`, `.js`, `.jsx`, and `.mjs` paths are rejected even though later PlayCanvas bridge work may generate ESM/`.mjs` assets.

Example atomic write pattern:

```ts
async function writeTextAtomically(target: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(target), { recursive: true })
    const temp = `${target}.${process.pid}.${Date.now()}.tmp`
    await fs.writeFile(temp, content, 'utf8')
    await fs.rename(temp, target)
}
```

### Phase 3: Source Resolver And Compile Pipeline

-   [ ] Implement `ModuleSourceResolver` that converts stored rows into resolved module records with current source content and status.
-   [ ] Refactor `MetahubModulesService` so all source-consuming paths go through the resolver:
    -   `listModules`;
    -   `getModuleById`;
    -   `createModule`;
    -   `updateModule`;
    -   shared-library dependency graph;
    -   `findSharedLibraryDependents`;
    -   `loadSharedLibraries`;
    -   delete/rename guards;
    -   `listPublishedModules`;
    -   entity action execution through `EntityActionExecutionService`;
    -   shared import extraction and dependency guards;
    -   snapshot export helpers.
-   [ ] Ensure file-backed modules are compiled from current file content, not stale DB source.
-   [ ] Keep compiler import rules unchanged: no arbitrary filesystem import graph; only single managed module source plus `@shared/*` and existing package allowlist.
-   [ ] Add optional safe logical filenames to compiler diagnostics without exposing absolute paths.
-   [ ] Preserve package import boundaries: runtime imports require both attached package `runtimeTargets` and `SUPPORTED_RUNTIME_PACKAGE_EXPORTS`.
-   [ ] Extend `ModuleCompilationInput` and shared-library inputs with optional `diagnosticFileName` / `sourcePathLabel` used only for diagnostics or virtual filenames. Do not turn these labels into filesystem imports.

Example resolver boundary:

```ts
interface ResolvedModuleSource {
    sourceCode: string
    checksum: string
    status: ModuleSourceStatus
    sourcePath: string | null
    diagnosticFileName: string
}

async function resolveModuleSource(metahubId: string, row: StoredMetahubModuleRow): Promise<ResolvedModuleSource> {
    if (row.storage_mode !== 'file') {
        const sourceCode = row.source_code ?? ''
        return {
            sourceCode,
            checksum: sha256(sourceCode),
            status: 'inline',
            sourcePath: null,
            diagnosticFileName: `${getCodenameText(row.codename)}.ts`
        }
    }

    const result = await fileService.forMetahub(metahubId).readModuleSource(row.source_path)
    return {
        sourceCode: result.content,
        checksum: result.checksum,
        status: row.source_checksum && row.source_checksum !== result.checksum ? 'modified' : 'ready',
        sourcePath: row.source_path,
        diagnosticFileName: row.source_path
    }
}
```

### Phase 4: Module APIs And Optimistic Guards

-   [ ] Extend create/update payloads to support:
    -   inline source mode;
    -   file-backed create from explicit path + source content;
    -   file-backed create from path that already exists;
    -   `expectedVersion`;
    -   `expectedSourceChecksum`.
-   [ ] Add dedicated endpoints or command routes for:
    -   `GET /metahub/:metahubId/module/:moduleId/source-status`;
    -   `POST /metahub/:metahubId/module/:moduleId/extract-to-file`;
    -   `POST /metahub/:metahubId/module/:moduleId/inline-from-file`;
    -   `POST /metahub/:metahubId/module/:moduleId/recompile`;
    -   optional `PATCH /metahub/:metahubId/module/:moduleId/source-file` for path/source updates.
-   [ ] Validate all commands through Zod schemas and localized frontend error mapping.
-   [ ] Add stale-write protection:
    -   reject if `_upl_version` does not match `expectedVersion`;
    -   reject file writes if current checksum does not match `expectedSourceChecksum`;
    -   use existing `updateWithVersionCheck()` for versioned metadata updates;
    -   perform the file checksum check inside the same locked/transactional section where possible;
    -   use `RETURNING` and fail closed on zero-row updates.
-   [ ] Keep domain SQL through store modules using `DbExecutor.query()` and schema-qualified SQL helpers.
-   [ ] Add store helpers such as `findStoredMetahubModuleBySourcePath` and map DB unique-constraint violations to structured `conflict` domain errors.
-   [ ] Define command semantics precisely:
    -   file-backed create with new `sourcePath` and content creates the file atomically;
    -   file-backed create from an existing file requires an empty/omitted content body;
    -   extract-to-file rejects an existing path unless an explicit overwrite command is added;
    -   duplicate path ownership returns `conflict`;
    -   stale version/checksum returns `conflict`.
-   [ ] Add route tests for every command, including missing file, stale version, stale checksum, unsafe path, duplicate path, extract-to-existing-file collision, conflict, and permissions.
-   [ ] Ensure every file command route uses `ensureAuth`, `writeLimiter`, `createMetahubHandler(..., { permission: 'manageMetahub' })`, request-scoped executor, and no public/read-only bypass.
-   [ ] Enforce a module source size limit separate from the global `FILE_SIZE_LIMIT`; reject oversized files before compile/export/import with localized user-facing errors.
-   [ ] Add route tests for rate-limit middleware wiring, `manageMetahub` permission enforcement, unsupported-schema guard, double slash/trailing slash rejection, and oversized file rejection.

### Phase 5: Snapshot, Hash, Export, Import, Copy, Templates

-   [ ] Extend snapshot module transport with a versioned `sourceStorage` envelope:

```ts
interface SnapshotModuleSourceStorage {
    version: 1
    mode: 'inline' | 'file'
    path?: string | null
    checksum?: string | null
    content?: string | null
    recovery?: 'none' | 'inline'
}
```

-   [ ] Export file-backed modules with current resolved content and checksum.
-   [ ] Import file-backed modules by recreating files before accepting file metadata, or explicitly recovering to inline mode with a visible recovery reason.
-   [ ] Use staging for snapshot import/restore:
    -   stage files under a temporary import directory;
    -   validate snapshot and DB transaction before promotion;
    -   promote staged files only after DB commit or through an equivalent compensating transaction boundary;
    -   cleanup staged/final files on DB rollback or file write failure.
-   [ ] Remove or guard the current silent missing-source stub behavior for file-backed modules.
-   [ ] Update `publicationSnapshotHash.ts` so changed file-backed source changes the canonical snapshot hash after recompile/publish.
-   [ ] Prove hash stability when only `sourcePath` display metadata or `sourceLastReadAt` changes and resolved content/checksum are unchanged.
-   [ ] Update release-bundle/application-sync tests proving unchanged hash skips sync only when resolved module content truly did not change.
-   [ ] Add metahub copy file-copy/remap/rollback behavior:
    -   copy files to the target metahub source root;
    -   remap root/path ownership to the new metahub id;
    -   use a staging directory plus post-commit promote, or compensating cleanup if the existing copy flow cannot expose a post-commit hook;
    -   cleanup staged/copied files if metadata transaction fails;
    -   fail closed and cleanup metadata if file copy fails before commit;
    -   never leave copied metahubs pointing to the source metahub file tree.
-   [ ] For templates in this slice, choose the conservative path: reject `sourceKind: external | visual` and file-backed template modules unless a template file payload contract is explicitly provided. Seed executor remains inline-first for built-in templates.
-   [ ] Do not alter built-in template version identifiers. Update `TemplateManifestValidator` only to reject unsupported module source states at load/seed time; built-in templates remain inline and existing fixtures prove no template version bump.
-   [ ] Refine `seedModuleSchema` and add tests for `sourceKind: external`, `sourceKind: visual`, and any future file payload fields being rejected in this slice.
-   [ ] Add tests for snapshot export/import round trip, missing file recovery/fail-closed behavior, canonical hash changes/stability, metahub copy remap/rollback, failed file copy cleanup, and template validation.

### Phase 6: Frontend API, TanStack Query, And UI

-   [ ] Extend `modulesApi` with typed storage payloads and command methods.
-   [ ] Move hardcoded module query keys into shared `metahubsQueryKeys.modules(...)` helpers and update `queryKeys` tests.
-   [ ] Use split list/detail/source-status queries:
    -   list query returns compact module metadata and source-storage summary, not large source bodies;
    -   detail query returns resolved inline/file preview for the selected module;
    -   source-status query refreshes file status without reloading the whole list;
    -   create/update/extract/inline/recompile invalidates both list and affected detail/status keys.
-   [ ] Refactor `EntityModulesTab.tsx` into smaller pieces if necessary:
    -   module list/sidebar;
    -   source storage panel;
    -   inline editor panel;
    -   file status panel;
    -   conversion/recompile actions;
    -   capability/role form.
-   [ ] Keep CodeMirror for inline authoring.
-   [ ] For file-backed modules, show a read-only resolved source preview by default, with explicit actions for recompile, inline from file, and extract/update file.
-   [ ] Add EN/RU i18n keys for all labels, statuses, confirmations, and validation messages.
-   [ ] Use existing MUI primitives from the metahubs/template stack: `Stack`, `Alert`, `Chip`, `TextField`, `Select`, shared dialog providers, and standard action spacing.
-   [ ] Prefer the existing `Select`/dialog/action patterns already used in `EntityModulesTab`. Use a segmented/toggle control only if an existing shared primitive already provides that pattern.
-   [ ] Add a generated-path workflow:
    -   extract-to-file pre-fills a generated path from module codename and scope;
    -   create file-backed module asks for scope/codename first and generates the path automatically;
    -   custom relative path editing is an advanced explicit affordance, not the primary required path;
    -   generated/displayed paths never contain raw UUID-only segments.
-   [ ] Do not expose raw UUID-only values, absolute paths, raw JSON config, or internal filesystem errors.
-   [ ] Add frontend Vitest coverage for:
    -   storage mode rendering;
    -   status chips;
    -   missing/unreadable/conflict messages;
    -   extract/inline/recompile button states;
    -   optimistic guard payloads;
    -   localized error mapping;
    -   generated path defaults and custom path advanced mode;
    -   responsive dialog layout snapshots where practical.

## UI Contract

### User Workflow

-   A module author can create an inline module as today.
-   A module author can choose file-backed storage and enter a relative `.ts` / `.tsx` path.
-   A module author can accept a generated file path without knowing folder taxonomy.
-   A module author can extract an inline module to a generated relative path.
-   A module author can convert a file-backed module back to inline source.
-   A module author can see whether the file is ready, modified, missing, unreadable, or in conflict.
-   A module author can see the last compile result as user-facing status, not as raw logs or stack traces.
-   A module author can recompile from the current file without rebuilding the root monorepo.
-   A module author sees a clear publication boundary: file changes affect authoring; runtime changes only after recompile/publish/sync.

### Controls

-   `storageMode`: existing MUI `Select` pattern with `Inline` / `File`, unless an existing shared segmented-control primitive is already available in the metahubs UI stack.
-   `sourcePath`: generated by default from module codename/scope. Advanced editable text field only for custom relative paths; never show absolute root, metahub id, branch/schema id, attached entity id, or route name.
-   `sourceStatus`: `Chip` with localized label and severity color.
-   `lastCompile`: localized status text/chip for never/success/failed, with sanitized message code mapped to EN/RU copy.
-   `sourceChecksum`: hidden from the normal workflow. Show short checksum/version details only inside a collapsed `Technical details` or admin/debug-only area.
-   `Extract to file`, `Inline from file`, `Recompile`, `Refresh status`: icon+text buttons with disabled/loading states.
-   Source preview: CodeMirror editor for inline, read-only CodeMirror preview for file-backed resolved source.

### UI Contract By Surface

-   `Modules tab`: uses the existing tab layout and density. It shows module labels/codenames, storage status, and actions; it never shows UUID-only identifiers or raw JSON.
-   `Module list/sidebar`: keeps current list behavior and selected state. Storage status may appear as a compact chip, but the list must not become a second editor or expose internal paths.
-   `Source storage panel`: uses `Select`, generated path display, optional advanced custom path `TextField`, and localized validation. It owns empty/loading/error states for source metadata.
-   `File status area`: shows ready/modified/missing/unreadable/conflict and last compile result. It explains conflicts as user actions, for example “file changed since last check,” not checksum jargon.
-   `Extract-to-file dialog`: pre-fills generated ID-free path, confirms overwrite is not available in this slice, has normal footer spacing, no resize/fullscreen controls, and keyboard path through confirm/cancel.
-   `Inline-from-file confirmation`: explains that current file content will become inline source; no absolute path or checksum is required to understand the action.
-   `Recompile/refresh actions`: use existing button/loading/disabled patterns, invalidate `metahubsQueryKeys.modules(...)`, and map backend codes to localized messages.
-   `Read-only source preview`: uses CodeMirror in read-only mode, preserves stable dimensions, and does not resize the surrounding layout when content changes.
-   Semantic long text fields introduced by this feature use multiline MUI `TextField` or CodeMirror, never one-line inputs.

### Validation And Localization

-   All validation copy must be EN/RU.
-   Backend may return structured codes, but UI maps them to user-facing messages.
-   No raw Zod flatten output, raw stack trace, absolute path, or internal filesystem message is shown on normal screens.

### Responsive Proof

-   Browser evidence must cover desktop, tablet, and mobile widths.
-   No page-level horizontal overflow.
-   Dialog text and buttons must not overlap.
-   Keyboard-only path must reach storage mode, path field, conversion actions, save, and cancel.
-   A normal module author must be able to complete the workflow without knowing filesystem roots, UUIDs, raw JSON structures, or internal route names.

## Testing Plan

### Unit And Service Tests

-   [ ] `@universo-react/types` Vitest:
    -   storage mode constants;
    -   normalization;
    -   snapshot storage envelope types if covered by runtime validators.
-   [ ] `@universo-react/utils` Vitest:
    -   `publicationSnapshotHash` changes for changed external-file content;
    -   hash stability for unchanged resolved content;
    -   sorting/normalization with source storage fields.
-   [ ] `@universo-react/modules-engine` tests:
    -   diagnostics logical filename;
    -   no arbitrary file imports;
    -   existing unsupported import rules remain green.
-   [ ] `@universo-react/metahubs-backend` Jest:
    -   `ModuleSourceFileService`;
    -   `ModuleSourceResolver`;
    -   `MetahubModulesService`;
    -   direct `modulesStore` SQL contracts for nullable `source_code`, storage fields, duplicate path checks, and `RETURNING` behavior;
    -   `modulesRoutes`;
    -   `SnapshotSerializer`;
    -   `SnapshotRestoreService`;
    -   metahub export/import/copy routes;
    -   `TemplateManifestValidator`;
    -   `TemplateSeedExecutor`;
    -   system table baseline tests.
-   [ ] `@universo-react/applications-backend` Jest:
    -   `syncModulePersistence`;
    -   `runtimeModulesService`;
    -   `applicationSyncRoutes`;
    -   release bundle hash/integrity tests.
-   [ ] `@universo-react/schema-ddl` Jest:
    -   assert runtime `_app_modules` schema remains bundle-only and has no `storage_mode`, `source_path`, `source_code`, or file-source columns.
-   [ ] `@universo-react/metahubs-frontend` Vitest:
    -   `EntityModulesTab`;
    -   `modulesApi`;
    -   module query keys;
    -   i18n bundle registration.

### Browser E2E And Screenshots

Use Playwright CLI wrappers, not `pnpm dev`.

Local Supabase minimal workflow for implementation QA:

```bash
nvm use 22
pnpm supabase:e2e:start:minimal
export UPL_MODULE_SOURCE_ROOT="$(pwd)/.tmp/e2e/storage"
pnpm run build:e2e:local-supabase
pnpm run test:e2e:smoke:local-supabase
```

Focused browser flows to add or extend:

-   [ ] `tools/testing/e2e/specs/flows/metahub-shared-common.spec.ts`
    -   create shared library as inline;
    -   extract to file;
    -   edit file through test helper/fixture;
    -   refresh status;
    -   compile and publish.
-   [ ] `tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts`
    -   attach file-backed consumer module to an entity;
    -   validate UI status and no raw path leaks.
-   [ ] `tools/testing/e2e/specs/flows/application-runtime-modules-quiz-browser-authoring.spec.ts`
    -   prove file edit does not alter runtime before publish;
    -   prove publish/sync applies compiled bundle after recompile.
-   [ ] `tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts`
    -   export file-backed module;
    -   import into new metahub;
    -   verify file recreated or intentionally recovered inline;
    -   verify re-export hash consistency.
-   [ ] `tools/testing/e2e/specs/flows/metahub-copy-delete.spec.ts`
    -   copy metahub with file-backed modules;
    -   verify copied metahub has independent file paths and source content.

Screenshot evidence to capture:

-   desktop/tablet/mobile modules tab with inline mode;
-   desktop/tablet/mobile modules tab with file mode ready;
-   desktop/tablet/mobile missing file status;
-   desktop/tablet/mobile modified/stale checksum status;
-   desktop/tablet/mobile extract confirmation;
-   desktop/tablet/mobile inline-from-file confirmation;
-   keyboard-only conversion flow evidence;
-   RU localized validation/error state with no overflow.

Playwright UX oracles to assert, not just screenshot:

-   `expectRuntimeUxViewportMatrix(page, 'module file storage')` or equivalent document-level overflow checks at `1920x1080`, `768x1024`, and `390x844`.
-   No visible `[object Object]`, raw JSON-looking values, raw UUID-only labels, absolute paths, branch/schema ids, route names, stack traces, or raw Zod/internal validation output.
-   Managed relative source paths may be shown; absolute runtime roots and internal physical paths must not be shown.
-   Keyboard-only flow uses role/name locators for storage mode, generated/custom path affordance, extract, inline, recompile, refresh, save, and cancel.
-   EN and RU validation assertions cover unsafe path, duplicate path, missing file, conflict, unsupported schema, and oversized file.
-   Confirmation dialogs use existing spacing/action conventions and do not expose resize/fullscreen controls.

### Suggested Focused Commands

```bash
pnpm --filter @universo-react/types test
pnpm --filter @universo-react/utils test
pnpm --filter @universo-react/modules-engine test
pnpm --filter @universo-react/metahubs-backend test -- src/tests/services/MetahubModulesService.test.ts src/tests/routes/modulesRoutes.test.ts src/tests/services/SnapshotSerializer.test.ts src/tests/services/SnapshotRestoreService.test.ts src/tests/routes/metahubsRoutes.test.ts
pnpm --filter @universo-react/applications-backend test -- src/tests/services/syncModulePersistence.test.ts src/tests/services/runtimeModulesService.test.ts src/tests/routes/applicationSyncRoutes.test.ts
pnpm --filter @universo-react/metahubs-frontend test -- src/domains/modules/ui/__tests__/EntityModulesTab.test.tsx src/i18n/__tests__/index.test.ts
pnpm --filter @universo-react/metahubs-backend build
pnpm --filter @universo-react/metahubs-frontend build
pnpm --filter @universo-react/applications-backend build
pnpm run build:e2e:local-supabase
```

Run root `pnpm build` only after focused checks are green or when preparing final closure.

## Documentation Plan

-   [ ] Update `docs/en/guides/metahub-modules.md` and `docs/ru/guides/metahub-modules.md` with:
    -   inline vs file storage;
    -   path rules;
    -   extract/inline workflow;
    -   recompile/publish lifecycle;
    -   no-root-rebuild guarantee;
    -   supported source-root deployment modes and `.gitignore` expectations;
    -   PlayCanvas Editor boundary.
-   [ ] Update `docs/en/architecture/modules-system.md` and `docs/ru/architecture/modules-system.md` with:
    -   source resolver;
    -   backend file service;
    -   runtime `_app_modules` bundle-only invariant;
    -   snapshot/hash implications.
-   [ ] Update `docs/en/api-reference/modules.md` and `docs/ru/api-reference/modules.md` with new fields and endpoints.
-   [ ] Update `docs/en/api-reference/rest-api.md` and `docs/ru/api-reference/rest-api.md` route inventories, and ensure `@universo-react/rest-docs` regeneration remains aligned with the live backend routes.
-   [ ] Update or cross-link `docs/en/platform/metahubs/modules.md`, `docs/ru/platform/metahubs/modules.md`, `docs/en/platform/metahubs/shared-modules.md`, and `docs/ru/platform/metahubs/shared-modules.md`.
-   [ ] Update `docs/en/platform/playcanvas-editor.md` and `docs/ru/platform/playcanvas-editor.md` only to cross-link the deferred script-asset bridge boundary if needed.
-   [ ] Add GitBook `SUMMARY.md` entries only if new pages are created; prefer updating existing pages to avoid navigation churn.
-   [ ] Documentation must explicitly separate three layers: file-backed design-time module source, published `_app_modules` bundles, and deferred PlayCanvas Editor script assets.

## Potential Challenges

-   **Silent stale exports**: every export/publish path must resolve current file content, not reuse stale cached source.
-   **Snapshot hash mismatch**: new source storage fields must participate in canonical hash through resolved content/checksum, or runtime sync may skip real module changes.
-   **Filesystem security**: path validation must be centralized and tested; no controller should build filesystem paths manually.
-   **Source path uniqueness races**: duplicate `source_path` must be protected by a partial DB unique index plus service-level checks.
-   **Shared library ordering**: `@shared/*` dependency extraction must run after resolving current file contents for all libraries.
-   **Copy rollback**: copying DB schemas without copying/remapping files will create cross-metahub aliasing. File copy must be rollback-aware.
-   **UI overload**: the current Modules tab is already dense. Split components if needed, keep controls predictable, and avoid nested cards.
-   **PlayCanvas scope creep**: do not emit Editor assets in this slice. Preserve metadata that makes a later bridge possible.
-   **Fresh DB assumption**: this plan intentionally avoids production migration/versioning. If later the target includes existing databases, add a separate migration plan.

## Acceptance Criteria

-   File-backed modules can be created, listed, resolved, compiled, published, exported, imported, copied, and converted back to inline.
-   File edits are visible to authoring/compile/publish/export without root `pnpm build`.
-   File edits do not change already published runtime applications until explicit recompile/publish/sync.
-   `_app_modules` remains bundle-only.
-   `applications-backend`, `syncModulePersistence`, and `runtimeModulesService` never receive or read `sourceStorage`, `storage_mode`, `source_path`, or `source_code`.
-   Unsafe paths, missing files, unreadable files, stale module versions, and stale file checksums fail closed with localized user-facing messages.
-   `.mts`, `.js`, `.jsx`, and `.mjs` source paths are rejected in this slice.
-   Snapshot hash changes when resolved file-backed module content changes after recompile/publish.
-   Snapshot hash does not change when only `sourceLastReadAt` or non-semantic file metadata changes.
-   Metahub copy produces independent file-backed module storage.
-   Built-in `basic`, `basic-demo`, `empty`, and `lms` templates seed successfully without template version bumps.
-   Templates cannot produce mixed unsupported external/visual source states.
-   EN/RU UI text has parity.
-   Browser screenshots prove desktop/tablet/mobile UX with no page-level horizontal overflow and no raw internal paths/JSON/IDs.
-   Existing schemas without the new storage columns fail closed with an unsupported-schema/migration-required response until a separate production migration plan is approved.
-   File-backed source paths are generated by default, ID-free, branch-isolated, and editable only through an explicit advanced custom path affordance.
-   Normal UI shows user-facing file/compile status; checksums and version internals are hidden in technical details.

## Implementation Handoff

Recommended implementation order:

1. Contracts and baseline DB fields.
2. File service and resolver with tests.
3. Service/controller API commands and optimistic guards.
4. Compile/publication/export/import/copy/template integration.
5. Frontend UI/API/i18n.
6. Docs.
7. Focused Jest/Vitest checks.
8. Local Supabase Playwright E2E with screenshots.
9. Final QA/autoreview and root build.

Do not start implementation until this plan is approved or revised.
