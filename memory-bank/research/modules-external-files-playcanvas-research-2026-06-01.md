# Research: Modules as External Files for PlayCanvas-Ready Authoring

> Created: 2026-06-01
> Status: Draft
> Trigger: RESEARCH request for `.manager/specs/platformo/modules-external-files-spec-2026-05-27.md`
> Follow-up plan: PLAN not created yet; future PLAN must load this artifact explicitly.

## Research Question

How should Universo Platformo implement file-backed metahub Modules so TypeScript/TSX sources are readable by the running platform without a root rebuild, while preserving current module security, snapshot portability, template seeding, metahub copy, published application lifecycle, and a later bridge to PlayCanvas Editor script assets?

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
| --- | --- | --- | --- |
| `.manager/specs/platformo/modules-external-files-spec-2026-05-27.md` | Local brief | Current 2026-06-01 | Defines the target scope: external module files, inline/external conversion, no root rebuild, snapshot/copy/runtime boundaries, and PlayCanvas script readiness. |
| `.manager/inputs/2026-05-27-modules-external-files.md` | Local source TZ | Current local file | Original request for external module files, inline-to-file and file-to-inline conversion, TS/TSX first, and repository structure decision. |
| `.manager/inputs/2026-05-31-playcanvas-editor-integration.md` | Local source TZ | Current local file | Connects external module files to future PlayCanvas Editor script/assets work. |
| `.backup/Интеграция-PlayCanvas-Editor-в-платформу.md` | Prior local research | Current local file | Recommends official Editor frontend, iframe/API bridge later, Colyseus integration later, and Editor-specific AI skills. |
| `.backup/Интеграция-PlayCanvas-Editor-в-Universo-Platformo.md` | Prior local research | Current local file | Recommends iframe isolation, Editor asset/scene mapping, script assets, Colyseus separation, and MCP adaptation later. |
| `memory-bank/research/playcanvas-editor-package-foundation-research-2026-05-31.md` | Prior Memory Bank research | Created 2026-05-31 | Establishes the Editor package as artifact-only and not a metahub storage bridge. |
| `memory-bank/research/playcanvas-editor-metahub-authoring-surface-settings-research-2026-06-01.md` | Prior Memory Bank research | Created 2026-06-01 | Establishes authoring-only package settings and host surface boundaries, including no scene/script storage bridge yet. |
| `memory-bank/techContext.md` | Local architecture context | Current | Defines the current module runtime contract, DB/migration rules, runtime snapshot boundaries, and UI/browser proof expectations. |
| `.agents/skills/universo-platform-architecture/SKILL.md` | Local skill | Current | Confirms metahub/application/workspace placement, template ownership, and DB-layer discipline. |
| `.agents/skills/research-before-plan/SKILL.md` | Local workflow skill | Current | Defines required research artifact structure and source-backed handoff to PLAN. |
| `.agents/skills/runtime-ux-qa/SKILL.md` | Local QA skill | Current | Defines future UI requirements for no raw JSON/IDs, localized validation, keyboard path, and no overflow. |
| `packages/universo-react-types/src/common/modules.ts` | Local shared contract | Current | Source of truth for `MODULE_SOURCE_KINDS`, authoring source kinds, module roles, capabilities, manifest, and runtime module types. |
| `packages/universo-react-metahubs-backend/src/domains/modules/services/MetahubModulesService.ts` | Local backend service | Current | Main authoring/publish service; assumes DB-resident `sourceCode` across list, compile, shared-library dependency checks, publish, update, and delete guards. |
| `packages/universo-react-metahubs-backend/src/domains/modules/controllers/modulesController.ts` | Local backend API | Current | Zod create/update schema currently accepts only `MODULE_AUTHORING_SOURCE_KINDS` and inline `sourceCode`. |
| `packages/universo-react-metahubs-backend/src/domains/modules/services/modulesStore.ts` | Local backend store | Current | `_mhb_modules` row type and insert path require non-null `source_code`. |
| `packages/universo-react-metahubs-backend/src/domains/metahubs/services/systemTableDefinitions.ts` | Local schema definition | Current | Defines design-time `_mhb_modules` with non-null `source_code`, bundles, checksum, and config. |
| `packages/universo-react-metahubs-backend/src/domains/metahubs/services/SystemTableMigrator.ts` | Local schema migrator | Current | Applies versioned system-table changes to existing metahub schemas; safe changes are additive or nullable-relaxation only. |
| `packages/universo-react-metahubs-backend/src/domains/metahubs/services/systemTableDiff.ts` | Local schema diff | Current | Classifies destructive vs safe system-table changes; relevant if `source_code` nullability or new columns are introduced. |
| `packages/universo-react-schema-ddl/src/SchemaGenerator.ts` | Local runtime schema generator | Current | Defines runtime `_app_modules` as bundle/manifest/checksum storage, not source-file storage. |
| `packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts` | Local hash normalizer | Current | Canonical publication/application snapshot hashing currently includes module source/bundles/checksum/config but has no file-storage envelope fields. |
| `packages/universo-react-modules-engine/src/compiler.ts` | Local compiler | Current | Enforces SDK/package import allowlists, rejects unsupported dynamic loading, and bundles from an in-memory source string. |
| `packages/universo-react-metahubs-frontend/src/domains/modules/ui/EntityModulesTab.tsx` | Local frontend UI | Current | Current authoring UI is inline CodeMirror over `sourceCode` with embedded source kind only. |
| `packages/universo-react-metahubs-frontend/src/domains/modules/api/modulesApi.ts` | Local frontend API client | Current | Current payload requires `sourceCode` and has no storage-mode/file metadata. |
| `packages/universo-react-metahubs-frontend/src/domains/modules/utils/moduleEditor.ts` | Local frontend utility | Current | CodeMirror setup and completions assume inline TypeScript authoring. |
| `packages/universo-react-metahubs-backend/src/domains/publications/services/SnapshotSerializer.ts` | Local snapshot export | Current | Serializes published modules and includes `sourceCode` from module records. |
| `packages/universo-react-metahubs-backend/src/domains/metahubs/controllers/metahubsController.ts` | Local metahub export/copy controller | Current | Metahub export overlays live module source; metahub copy clones DB schemas directly before central metadata transaction. |
| `packages/universo-react-metahubs-backend/src/domains/metahubs/services/SnapshotRestoreService.ts` | Local snapshot import | Current | Restores modules into `_mhb_modules`, rejects non-authoring source kinds, and can create a stub when source is missing. |
| `packages/universo-react-metahubs-backend/src/domains/templates/services/TemplateManifestValidator.ts` | Local template validation | Current | Template schema currently permits `sourceKind: external | visual` while still requiring inline `sourceCode`. |
| `packages/universo-react-metahubs-backend/src/domains/templates/services/TemplateSeedExecutor.ts` | Local template seeding | Current | Seeds template modules by compiling and inserting inline `sourceCode`. |
| `packages/universo-react-applications-backend/src/services/applicationSyncContracts.ts` | Local sync contract | Current | Published snapshot module type has optional `sourceCode`, but runtime module definition is bundle-oriented. |
| `packages/universo-react-applications-backend/src/routes/sync/syncModulePersistence.ts` | Local runtime sync | Current | Persists `_app_modules` with manifest, server/client bundles, checksum, and config, not source files. |
| `packages/universo-react-applications-backend/src/services/runtimeModulesService.ts` | Local runtime module service | Current | Runtime reads active modules from `_app_modules` and serves/executed compiled bundles. |
| `packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json` | Local package registry seed | Current | `@universo-react/playcanvas-editor` is authoring-only with empty runtime targets; should not become a Modules import dependency. |
| `packages/universo-react-playcanvas-editor/README.md` | Local package docs | Current | Confirms `@universo-react/playcanvas-editor` is artifact-only and not a storage bridge. |
| `packages/universo-react-playcanvas-editor/vendor/UPSTREAM.md` | Local upstream record | Current | Records pinned PlayCanvas Editor upstream baseline. |
| `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/src/editor/assets/assets-create-script.ts` | Vendored upstream source | Current pinned `v2.22.1` | Shows Editor script creation is asset-driven and filename/path/collision aware. |
| `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/src/editor/assets/handle-script-parse.ts` | Vendored upstream source | Current pinned `v2.22.1` | Shows Editor script parsing depends on asset virtual paths, file fetches, and backend pipeline messages. |
| `https://github.com/playcanvas/editor` | Primary upstream repository | Checked 2026-06-01 | Source of truth for the open-source Editor frontend and its asset/editor architecture. |
| `https://developer.playcanvas.com/user-manual/editor/editor-api/` | Primary vendor docs | Checked 2026-06-01 | Confirms Editor API exists but is a later bridge/automation concern, not solved by external module files alone. |
| `https://developer.playcanvas.com/user-manual/scripting/esm-scripts/` | Primary vendor docs | Checked 2026-06-01 | Confirms modern PlayCanvas script assets are ESM-oriented and `.mjs`/module behavior matters for future generated artifacts. |
| `https://developer.playcanvas.com/user-manual/scripting/script-attributes/` | Primary vendor docs | Checked 2026-06-01 | Confirms script attributes are Editor-facing metadata and must be preserved by any future script transform. |
| `https://developer.playcanvas.com/user-manual/scripting/script-attributes/esm/` | Primary vendor docs | Checked 2026-06-01 | Confirms ESM script attribute parsing is a distinct Editor/runtime concern. |
| `https://github.com/playcanvas/playcanvas-sync` | Primary upstream adjacent tool | Checked 2026-06-01 | Shows PlayCanvas has a local-file synchronization concept, but it targets PlayCanvas project assets and is only a comparison point. |
| `https://vite.dev/config/shared-options.html#publicdir` | Primary Vite docs | Checked 2026-06-01 via Context7 | Confirms `publicDir` serves/copies static assets as-is; it is not a transformed runtime source service. |
| `https://vite.dev/guide/api-plugin.html#handlehotupdate` | Primary Vite docs | Checked 2026-06-01 via Context7 | Confirms `handleHotUpdate` can notify dev clients, but does not replace backend source resolution for publish/export. |
| Context7 `/vitejs/vite` | MCP documentation | Checked 2026-06-01 | Confirms Vite public assets and HMR behavior. |
| Context7 `/playcanvas/engine` | MCP documentation | Checked 2026-06-01 | Confirms PlayCanvas Engine uses ESM script loading, script asset data schemas, and script attribute assignment behavior. |

## Key Findings

- `sourceKind=external` is already present in `MODULE_SOURCE_KINDS`, but authoring is hard-blocked to `embedded` through `MODULE_AUTHORING_SOURCE_KINDS`, controller validation, and `MetahubModulesService.assertSupportedSourceKind`. A PLAN that simply exposes the enum would collide with current semantics.
- The safest terminology is a separate physical storage contract such as `storageMode: inline | file`, with `sourceKind` kept for module authoring/runtime semantics unless PLAN deliberately migrates the meaning and compatibility rules.
- The current design-time module row is inline-first. `_mhb_modules.source_code` is non-null in `systemTableDefinitions.ts`, `modulesStore.ts`, and current insert/update flows. PLAN must choose nullable source, cached last-known source, new file metadata columns, or validated config fields.
- `_mhb_modules` is a metahub system table, so schema changes affect both new schemas and already-created metahub branch schemas. `SystemTableMigrator` and `systemTableDiff` support safe additive columns and nullable relaxation, while type changes or nullable tightening are destructive. PLAN must validate the migration path through `SYSTEM_TABLE_VERSIONS`, not only through baseline DDL.
- Source resolution is a platform service concern, not a narrow compile change. `MetahubModulesService` reads `module.sourceCode` for listing, shared-library dependency ordering, circular checks, delete/rename guards, publication, and compile. A central `ModuleSourceResolver` or equivalent is needed so every path sees the same current file content.
- External file edits must become visible to authoring, compile, publish, and export without `pnpm build`. Vite `publicDir` only serves/copies static assets as-is, and `handleHotUpdate` only provides dev-server client events. Neither guarantees backend publish/export reads current source.
- The compiler can likely remain content-based in the first slice: it already compiles from a source string and enforces import/package/loading restrictions. However, diagnostics and source maps currently use synthetic names such as `extension-module.ts`; file-backed modules may need a safe relative filename for user-facing errors without exposing absolute paths.
- The current compiler rejects unsupported imports, `require`, dynamic `import`, and `import.meta`. External files must not become an arbitrary filesystem import graph. They should remain single managed sources plus existing `@shared/...` and package-import contracts.
- Shared-library modules are especially sensitive. `@shared/*` dependency extraction and publication ordering currently scan source strings from DB records. File-backed library modules require current file reads before dependency graph checks, not only before final compile.
- Current frontend authoring is inline CodeMirror-first. `EntityModulesTab.tsx` stores one `sourceCode` field, renders the editor over that value, translates embedded-source errors, and exposes no file status. UI work needs storage mode, path, checksum/status, stale/missing/conflict states, conversion actions, and localized validation.
- Current frontend API payloads require `sourceCode` and have no expected file checksum/version guard. External file writes need both module `_upl_version` and file checksum comparison to avoid overwriting IDE/editor changes.
- The existing `incrementVersion` helper updates `_upl_version` without client-provided `expectedVersion` for modules. There is an optimistic-locking utility in the backend, but module routes do not currently expose `expectedVersion`. External files make stale-write protection more important.
- Snapshot export currently mixes published module artifacts with live design-time source. `SnapshotSerializer` serializes `listPublishedModules`, and metahub export overlays `sourceCode` from `modulesService.listModules`. If external files are added, export must resolve file content at export time or it can silently export stale inline fallback.
- Snapshot restore currently deletes `_mhb_modules`, validates module source kind against authoring-supported kinds, inserts inline `source_code`, nulls bundles, and recomputes checksum from source + manifest. File-backed restore must create files before accepting file metadata or intentionally convert to inline mode.
- The existing missing-source fallback in `SnapshotRestoreService.resolveModuleSourceCode` is dangerous for file-backed modules unless explicitly selected as a recovery mode. Silent placeholder source would make a restored external module look valid while losing user code.
- Snapshot module contracts currently carry optional `sourceCode`; they do not carry storage mode, file path, file checksum, file payload, or recovery mode. PLAN must extend the transport schema, not only the DB row.
- Canonical snapshot hashing is another required surface. `publicationSnapshotHash.ts` normalizes modules with `sourceCode`, `serverBundle`, `clientBundle`, `checksum`, `manifest`, and `config`; runtime sync and release-bundle validation use the resulting `publicationSnapshotHash` for duplicate detection, migration fast paths, and artifact integrity. New file-backed transport fields must either be included in hash normalization or explicitly reduced to resolved source/checksum fields before hashing.
- Template validation is inconsistent today: template modules may declare `sourceKind: external | visual`, but template seeding still requires and compiles inline `sourceCode`. This must be fixed or external-file support can create mixed, unrecoverable seed states.
- Metahub copy clones DB schemas directly before central metahub metadata persistence. External files live outside that cloned schema unless a file-copy/remap/rollback step is added. Otherwise copied metahubs can point back to the original file tree.
- Runtime application sync should stay bundle-only in the first implementation. `_app_modules` stores manifest, server/client bundles, checksum, config, and active flags; runtime services read bundles, not source files. File edits should not affect already published apps until a new compile/publish/sync step.
- The filesystem source resolver should stay out of `applications-backend` sync. Application sync should consume already resolved publication snapshots and compiled bundles; adding file reads there would blur authoring storage with deployed runtime state and could make installed apps depend on authoring volumes.
- Publication lifecycle must be explicit: authoring/compile/export/publication creation read current external source; installed/runtime apps consume published snapshots and bundles. This prevents live source files from mutating deployed app behavior implicitly.
- The PlayCanvas Editor package is artifact-only today. It can be attached and hosted, but it does not provide scene storage, script asset storage, backend API emulation, or postMessage bridge.
- PlayCanvas Editor script handling is asset-based. Vendored `assets-create-script.ts` and `handle-script-parse.ts` show script assets have filenames, folders/virtual paths, file fetch URLs, asset ids, and backend parsing pipeline events. A `.ts/.tsx` module file is not directly an Editor script asset.
- Context7 PlayCanvas Engine docs confirm ESM module loading and script schemas are tied to script assets and asset data. Future PlayCanvas integration needs generated JS/ESM artifacts, script names, asset ids, virtual paths, hashes, and script-attribute metadata preservation.
- `@universo-react/playcanvas-editor` is authoring-only with empty runtime targets. External module files must not accidentally make it runtime-importable in Modules. Script storage and runtime package imports are separate contracts.
- Current module package-import allowlisting has two barriers: `MetahubModulesService` filters attached packages by non-empty `runtimeTargets`, and `@universo-react/modules-engine` only allows package exports listed in `SUPPORTED_RUNTIME_PACKAGE_EXPORTS`. Any future runtime-importable package needs both registry/runtime-target metadata and compiler allowlist support. This boundary should be preserved for the Editor package.
- Vendored PlayCanvas Editor script parsing distinguishes `.mjs` module scripts, uses asset `file.hash` for invalidation, fetches by asset virtual path/filename, and sends parsed script-attribute results through a backend pipeline. Future bridge work therefore needs generated Editor-consumable JS/ESM asset files, stable virtual paths, asset-id mapping, file-hash/cache invalidation, and parsed attribute persistence.
- Browser-side direct filesystem access is not viable for the intended architecture. Reads/writes should go through backend services with metahub permissions and path guards.
- Path safety must be designed as part of the file service: approved root, relative normalized paths, extension allowlist, no absolute paths, no traversal, no symlink escape, no hidden/internal files, atomic writes where possible, and no raw absolute path leakage in UI/API errors.
- The first source root should likely be a metahub-scoped directory under an explicit runtime data/workspace root, not inside package source that requires workspace rebuilds. Git-tracked repository storage can be supported later only if it does not become the only runtime source location.
- Existing module E2E coverage is strong for inline modules, shared libraries, runtime bundle execution, browser authoring, and snapshot import. External-file implementation should extend those flows rather than invent a parallel QA surface.
- Runtime UX constraints apply to the future UI: no raw module IDs, no raw JSON config, localized validation, multiline or file-path-safe displays, keyboard-accessible conversion actions, and no horizontal overflow inside entity settings dialogs.

## Conflicts And Uncertainty

- The original 2026-05-27 modules-only request was low priority, but PlayCanvas Editor script readiness makes the storage contract a medium-priority prerequisite. PLAN should confirm the product priority before implementation starts.
- `sourceKind` already contains `external`, so reusing it would be tempting. However, current code uses `sourceKind` in manifests, snapshot contracts, runtime module records, and package hashing. A new `storageMode` is less disruptive, but it requires new schema/API/UI fields.
- It is undecided whether DB should keep last-known source for file-backed modules. Keeping a cache improves recovery and export fallback but risks stale exports if not clearly marked. Not keeping a cache makes missing files more disruptive.
- It is undecided whether file changes should trigger continuous watchers, lazy checksum detection, or explicit "sync/recompile" actions. Watchers improve development feedback but are harder in multi-instance deployments.
- It is undecided whether external files should be git-tracked repository files, runtime-generated files in a data volume, or configurable per deployment. Runtime availability without rebuild argues for backend-owned runtime storage as the first supported path.
- PlayCanvas Editor future integration is broader than this brief. External module files can prepare script-source storage, but Editor script assets require a separate bridge/storage brief.
- PlayCanvas official docs cover ESM scripts and script attributes, but Editor backend/API behavior for asset persistence remains partly tied to the PlayCanvas service and vendored frontend internals. Treat the asset bridge as uncertain until separately researched/planned.
- Vite can support development HMR, but production runtime source visibility cannot rely on Vite dev-server behavior. The source service must work in backend/publication paths independent of `pnpm dev`.

## Project Implications

- PLAN should start by designing a module source resolution service used by all design-time module paths: list, get, create/update conversion, dependency checks, publish, snapshot export, and restore.
- Shared types need a versioned storage metadata contract, likely separate from `ModuleSourceKind`: `storageMode`, `sourcePath`, `sourceChecksum`, `sourceStatus`, optional `lastKnownSource`, and snapshot file payload fields.
- Backend schema work must cover `systemTableDefinitions.ts`, `SYSTEM_TABLE_VERSIONS` / `SystemTableMigrator` behavior for existing metahub schemas, migrations through `@universo-react/schema-ddl` / migrations platform registration where applicable, store row types, and migration tests. Runtime `_app_modules` should remain bundle-only unless a separate runtime-source feature is approved.
- Module create/update routes need new endpoints or payload variants for extract-to-file, inline-from-file, file status, and recompile/sync. They also need expected module version and file checksum guards.
- Source path validation should be implemented in one backend boundary rather than scattered in controllers. The boundary should expose normalized relative paths only and keep absolute filesystem paths out of normal API/UI responses.
- Snapshot export/import must add versioned file-backed module transport fields. Import should either recreate files before inserting file-backed rows or intentionally inline the source with a visible recovery reason.
- Snapshot hash normalization and release-bundle tests must be updated with external-file cases. A changed file-backed module that is recompiled/published must produce a changed canonical snapshot hash; otherwise application sync can legitimately skip module persistence by seeing an unchanged `publicationSnapshotHash`.
- Template manifests need a cleanup before or during implementation: either reject `external`/`visual` source kinds until supported, or define file payload/reference semantics for templates and seed them through the same file service.
- Metahub copy needs file-copy/remap/rollback integration coordinated with DB schema clone rollback. PLAN must decide whether files are copied before or after DB clone and how cleanup works after partial failure.
- The published application lifecycle should not be widened. External-file edits should update authoring state only; runtime apps change only after compile/publish creates a new snapshot/hash and sync persists bundles. The resolver belongs in metahub authoring/publication/export paths, not in application runtime sync.
- The frontend should extend `EntityModulesTab` with a storage mode panel and status surface rather than replacing the existing module authoring UI. CodeMirror can remain for inline modules and maybe read-only/resolved previews, but file-backed modules need a path/status-first workflow.
- UI tests should extend existing module browser specs (`metahub-shared-common`, `metahub-entities-workspace`, `application-runtime-modules-quiz-browser-authoring`) with external-file authoring, conversion, missing/stale/conflict states, snapshot round-trip, and publish lifecycle evidence.
- PlayCanvas script readiness should be treated as a compatibility constraint: preserve stable module identity and source metadata so a later bridge can emit Editor script assets, but do not implement scene/script asset bridge in this slice. `.ts/.tsx` external module files are source inputs only; the later bridge still needs JS/ESM artifact generation, `.mjs` handling, virtual path stability, `file.hash` invalidation, asset ids, and script-attribute parse/result persistence.
- Documentation should distinguish three layers clearly: file-backed module source, compiled published module bundles, and future PlayCanvas Editor script assets.

## Recommended Decision

Proceed to PLAN with a conservative file-service-first design:

1. Add a distinct module physical storage contract (`storageMode: inline | file`) instead of redefining `sourceKind` in the first slice.
2. Implement a backend-owned module source resolver/file service under an approved metahub-scoped source root. All compile/publish/export/dependency paths must resolve through it.
3. Treat `_mhb_modules` schema changes as system-table version work for existing metahub schemas, not only as baseline DDL edits.
4. Keep runtime `_app_modules` bundle-only and keep filesystem resolution out of application sync. A file edit must not alter an already published application until explicit recompile/publish creates a new snapshot/hash.
5. Extend snapshot transport, canonical snapshot hash normalization, and template seeding deliberately. Do not rely on the current optional `sourceCode` field or template `sourceKind` allowance.
6. Add explicit conversion/status APIs and UI actions with optimistic module version + file checksum guards.
7. Treat PlayCanvas Editor integration as future bridge work: external module files can become source inputs for generated Editor script assets, but they are not Editor assets by themselves.

## Open Questions Before PLAN

- Where exactly should the approved external module source root live for local development, server deployment, and self-hosted instances?
- Should DB store a last-known source cache for file-backed modules, and if yes, how is stale cache clearly marked during export/restore?
- Should file-backed module updates be watcher-driven, lazy checksum-driven, or explicit action-driven for the first implementation?
- Should templates be allowed to seed file-backed modules in the first slice, or should non-embedded template source kinds be rejected until a later template-file contract exists?
- What snapshot field names should represent file-backed modules: `storage`, `file`, `sourceFile`, or a versioned `sourceStorage` envelope?
- Should canonical snapshot hash normalization include file-backed storage metadata directly, or should export/publish reduce file-backed modules to resolved source/checksum fields before hashing?
- Should external module source files be generated into a git-trackable repository location, a runtime data volume, or both through a deployment setting?
- What is the minimum PlayCanvas script metadata to preserve now for future bridge compatibility: module codename, class name, script name, attribute schema hints, or generated asset id?

## Sources

- `.manager/specs/platformo/modules-external-files-spec-2026-05-27.md`
- `.manager/inputs/2026-05-27-modules-external-files.md`
- `.manager/inputs/2026-05-31-playcanvas-editor-integration.md`
- `.backup/Интеграция-PlayCanvas-Editor-в-платформу.md`
- `.backup/Интеграция-PlayCanvas-Editor-в-Universo-Platformo.md`
- `memory-bank/research/playcanvas-editor-package-foundation-research-2026-05-31.md`
- `memory-bank/research/playcanvas-editor-metahub-authoring-surface-settings-research-2026-06-01.md`
- `memory-bank/techContext.md`
- `.agents/skills/universo-platform-architecture/SKILL.md`
- `.agents/skills/research-before-plan/SKILL.md`
- `.agents/skills/runtime-ux-qa/SKILL.md`
- `packages/universo-react-types/src/common/modules.ts`
- `packages/universo-react-metahubs-backend/src/domains/modules/services/MetahubModulesService.ts`
- `packages/universo-react-metahubs-backend/src/domains/modules/controllers/modulesController.ts`
- `packages/universo-react-metahubs-backend/src/domains/modules/services/modulesStore.ts`
- `packages/universo-react-metahubs-backend/src/domains/metahubs/services/systemTableDefinitions.ts`
- `packages/universo-react-schema-ddl/src/SchemaGenerator.ts`
- `packages/universo-react-modules-engine/src/compiler.ts`
- `packages/universo-react-metahubs-frontend/src/domains/modules/ui/EntityModulesTab.tsx`
- `packages/universo-react-metahubs-frontend/src/domains/modules/api/modulesApi.ts`
- `packages/universo-react-metahubs-frontend/src/domains/modules/utils/moduleEditor.ts`
- `packages/universo-react-metahubs-backend/src/domains/publications/services/SnapshotSerializer.ts`
- `packages/universo-react-metahubs-backend/src/domains/metahubs/controllers/metahubsController.ts`
- `packages/universo-react-metahubs-backend/src/domains/metahubs/services/SnapshotRestoreService.ts`
- `packages/universo-react-metahubs-backend/src/domains/templates/services/TemplateManifestValidator.ts`
- `packages/universo-react-metahubs-backend/src/domains/templates/services/TemplateSeedExecutor.ts`
- `packages/universo-react-applications-backend/src/services/applicationSyncContracts.ts`
- `packages/universo-react-applications-backend/src/routes/sync/syncModulePersistence.ts`
- `packages/universo-react-applications-backend/src/services/runtimeModulesService.ts`
- `packages/universo-react-metahubs-backend/src/domains/packages/data/seed-packages.json`
- `packages/universo-react-playcanvas-editor/README.md`
- `packages/universo-react-playcanvas-editor/vendor/UPSTREAM.md`
- `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/src/editor/assets/assets-create-script.ts`
- `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/src/editor/assets/handle-script-parse.ts`
- `https://github.com/playcanvas/editor`
- `https://developer.playcanvas.com/user-manual/editor/editor-api/`
- `https://developer.playcanvas.com/user-manual/scripting/esm-scripts/`
- `https://developer.playcanvas.com/user-manual/scripting/script-attributes/`
- `https://developer.playcanvas.com/user-manual/scripting/script-attributes/esm/`
- `https://github.com/playcanvas/playcanvas-sync`
- `https://vite.dev/config/shared-options.html#publicdir`
- `https://vite.dev/guide/api-plugin.html#handlehotupdate`
- Context7 `/vitejs/vite`
- Context7 `/playcanvas/engine`
