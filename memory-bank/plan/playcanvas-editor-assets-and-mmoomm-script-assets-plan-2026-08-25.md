# Plan: PlayCanvas Editor Assets Pipeline + MMOOMM Script Assets

> Created: 2026-08-25
> Status: Complete
> Brief: manager-only PlayCanvas Editor assets and script-assets brief.
> Source TZ: manager-only PlayCanvas Editor assets and script-assets input.
> Research: `memory-bank/research/playcanvas-editor-assets-and-mmoomm-script-assets-research-2026-08-25.md` (+ 3 implementation-level exploration reports, same day)

---

## Overview

Two coupled workstreams, implemented in one coherent delivery:

1. **Editor assets work**: implement the editor-facing asset CRUD surface (create via "+", folder tree, raw file content, delete, script-attribute parse round-trip) in the compatible backend + artifact bridge, so the integrated PlayCanvas Editor v2.30.4 behaves like playcanvas.com for text-like assets.
2. **MMOOMM script assets**: extract flight/camera/collision logic from `PlayCanvasCanvasWidget.tsx` (2416 lines) into ESM script assets delivered through the full script-asset pipeline (repo built-in catalog + file-backed modules → ESM artifact → manifest `scripts[]` → main-thread loader → `registerScript` → script components), regenerate `tools/fixtures/metahubs-mmoomm-app-snapshot.json`, and merge the two module tabs in metahub Resources.

Hard constraints: no legacy code preservation (test DB wiped; new metahubs/apps from the new fixture); NO metahub schema/template version bumps (system tables unchanged — folder hierarchy is derived from `virtual_path`, zero DDL); deep refactor allowed; all user-facing text EN/RU from day one; UUID v7 for new row ids; TanStack Query on the frontend; types in `@universo-react/types`, shared utils in `@universo-react/utils`.

## Affected Areas

| Area                         | Packages / files                                                                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Editor compatibility backend | `packages/universo-react-playcanvas-editor-backend/src/routes/index.ts`, `src/realtime/index.ts`, `src/tokens/index.ts`                                                                                                                          |
| Metahub playcanvas domain    | `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/**` (service, store, file service, snapshot service)                                                                                                                   |
| Artifact bridge              | `packages/universo-react-playcanvas-editor-frontend/scripts/lib/playcanvas-editor-artifact.mjs` (+ rebuild)                                                                                                                                      |
| ESM script pipeline          | `packages/universo-react-modules-engine/src/compiler.ts` (new exported function)                                                                                                                                                                 |
| Runtime widget               | `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx` (+ new loader module)                                                                                                                            |
| Import map / static engine   | `packages/universo-react-core-frontend/vite.config.js`, `index.html`, new `scripts/ensure-playcanvas-esm.mjs`, `public/vendor/playcanvas/` (gitignored)                                                                                          |
| Built-in MMOOMM scripts      | `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/builtin-script-assets/*.mjs` (new)                                                                                                                                     |
| Modules tabs UI              | `packages/universo-react-metahubs-frontend/src/domains/entities/shared/ui/SharedResourcesPage.tsx`, new `MetahubModulesSurface.tsx`, locales                                                                                                     |
| Fixture + generator          | `tools/testing/e2e/specs/generators/metahubs-mmoomm-app-export.spec.ts`, `support/mmoommAppGeneratorData.ts`, `support/mmoommAppFixtureContract.ts`, `support/checkMmoommAppFixtureDrift.ts`, `tools/fixtures/metahubs-mmoomm-app-snapshot.json` |
| Docs                         | `docs/{en,ru}/platform/playcanvas-editor-assets.md` (new), `SUMMARY.md` ×2, package READMEs ×4, stale v2.24.2 → v2.30.4 fixes (frontend README + 2 skills)                                                                                       |

## Key Decisions (from research, normative)

1. **Bridge-side forwarding** for POST/DELETE/file routes: rewrite relative `/api/assets*` calls to `${universoBridge.compatibilityRestBaseUrl}/assets*` inside the XHR/fetch adapters, reusing `isRestCompatibilityEndpointUrl` + `withRestCompatibilityAuthHeaders` + the existing CSRF fetch. All new endpoints live under `/api/v1/.../editor-compatible/...` with existing signed-header (`X-PlayCanvas-Editor-Token`) + `requireConfiguredCsrfProtection` seams. No new platform-global surface.
2. **Zero DDL**: folders are asset rows (`asset_type='folder'`) whose hierarchy is derived from `virtual_path` segments; folder asset ids are deterministic hashes of the directory path (numeric `editorDocumentId` via the existing `createPlayCanvasEditorNumericAssetId` hash — derived columns, NOT primary keys; row PKs remain `generateUuidV7()` per existing convention, `PlayCanvasProjectsService.ts:2978`). The asset-type whitelist is extended at **all four layers** (see P1.9): `PLAYCANVAS_ASSET_TYPES` + zod, `PLAYCANVAS_PROJECT_ALLOWED_MIME_TYPES`, `PLAYCANVAS_PROJECT_FILE_EXTENSIONS` + extension→MIME map, `isPlayCanvasAssetType`. File-backed creation is restricted to text-like extensions (`.js/.mjs/.json/.css/.html/.txt/.shader`); data-only types (material/cubemap/texture) create as rows without files; binary upload writes fail-closed 501. `html` is included per brief Goal 1 (supersedes research RD1 which deferred it); `shader` is accepted at the whitelist level because the vendored "+" menu offers it, but it is not exercised by the generator.
3. **Script parse round-trip**: the ESM worker already sends `parse_result` inside the `pipeline{script-attributes}` frame — the server only writes ShareDB ops `data.scripts.<name>` and pushes messenger `scriptAttrsFinished:<guid>`. No server-side JS parsing.
4. **Messenger push format**: JSON frames `{name, data}` on the messenger WS; `asset.new` payload `{asset:{branchId:<numericSceneId>, id:<documentId>, source:false, status:'complete', type, source_asset_id:'0', createdAt}}`. New scope-keyed messenger-socket registry in editor-backend realtime.
5. **Allow-list extension**: exported `extendRealtimeAssetAllowList(scopeKey, documentIds)` from editor-backend realtime (module registry beside the existing `backends` closure), called by the create route in the same package. In-session sockets are covered immediately; a socket that (re)authenticates later relies on the existing sliding `refreshFullBootAccessToken` re-mint (≤5 min TTL) — this lag is accepted and covered by a test. Asset **field** updates (name/data/preload/tags/meta) already flow through the existing ShareDB persist path (`persistEditorRealtimeDocument`) and keep working unchanged; multipart file re-upload (`PUT /api/assets/:id`, reachable via drag-drop overwrite and driver flows) is answered with a fail-closed JSON 501 — never HTML.
6. **Runtime loading**: keep `data:` artifact URLs but fix MIME to `text/javascript` for `.mjs/.js` in `runtimeFileUrl`; the widget fetches → verifies sha-256 `artifactHash` (WebCrypto digest hex-encoded, compared to the stored lowercase-hex sha-256 from `PlayCanvasProjectFileService.ts:47-48`) → re-blobs as `text/javascript` → dynamic `import()` → `registerScript(cls, name, app)` (app-scoped `app.scripts` registry per playcanvas 2.21.4 `playcanvas.mjs:97846-97864`; the parallel module-global `ScriptTypes` push is drained only by the legacy ScriptHandler and is harmless for our flow) → `entity.script.create(scriptName, { attributes })` (the `attributes` key is the correct 2.21.4 option, `playcanvas.d.ts:44416-44421`) matched by `sceneEntityStableId` against the widget's `entities` Map (fail-closed on miss). No new HTTP endpoints. Guest compatibility: the data:-URL approach needs no auth, but guest PlayCanvas rendering itself does not exist today (no guest widget route) — out of scope. Import-map `integrity` keys are rejected for MVP (blob-URL artifacts are not import-map entries); `assertArtifactHash` is the integrity mechanism.
7. **Import map**: build-time injection in `core-frontend/index.html` via a vite `transformIndexHtml` plugin (pattern of `supportedLanguagesPlugin`); `playcanvas` → `/vendor/playcanvas/playcanvas.mjs` copied from `node_modules` by a prebuild script (gitignored). Editor artifact iframe is a separate document — no leakage.
8. **Colyseus for scripts**: host-bridge object attached to the pc app (`app.__universoHost = { sendIntent, pickAt, getRoomState }`), passed to scripts via attributes/lookup — Room, seq-state and **raw input capture intentionally remain widget-owned** (accepted deviation from brief Goal 3's "input glue": scripts consume intents via the bridge rather than owning keyboard/mouse). No bare `@universo-react/colyseus-client` import in script assets for MVP.
9. **ESM pipeline**: new exported `compileScriptAssetEsm(source)` in `@universo-react/modules-engine` (esbuild `format:'esm'`, `platform:'browser'`, `playcanvas` bare import allowed + external, everything else fail-closed). esbuild 0.25.0 is already its runtime dep; `metahubs-backend` already imports the package (no new dependency edge).
10. **Tabs merge**: single `modules` tab + new `MetahubModulesSurface` wrapper (scope switch styled after the existing nested Tabs pattern in `ComponentList.tsx:1585-1602` — `minHeight: 40`, `textTransform: 'none'`), `EntityModulesTab` signature unchanged (7 reuse sites stay back-compat). Labels in metahubs-frontend locales (package-local convention; `universo-react-i18n` not used by this package).
11. **Security posture (trust boundary)**: main-thread script assets run with document-level trust — equivalent to the widget code itself (published applications already execute trusted widget code). Mitigations: publication gate (fail-closed checksums), `artifactHash` verification before import, no dynamic-import capability inside the ESM compiler output beyond the allowlisted `playcanvas` specifier. Capability flags per script asset are deferred.
12. **Built-in catalog semantics**: built-in MMOOMM scripts are **copied into the project at authoring time** (snapshot semantics — the generator creates script assets from the repo files through the Editor). The repo file remains the canonical source; platform upgrades do not mutate existing projects (re-running the generator re-authors from the current repo content).

---

## Plan Steps

### Phase 0 — Preconditions

-   [x] **P0.1** OntoIndex freshness check; record indexed HEAD; create branch `feature/playcanvas-editor-assets-and-mmoomm-scripts`.
-   [x] **P0.2** Baseline: run `pnpm --filter @universo-react/playcanvas-editor-backend test`, `pnpm --filter @universo-react/metahubs-backend test -- playcanvas`, `pnpm --filter @universo-react/apps-template-mui test`, `pnpm test:e2e:mmoomm-app-runtime:local-supabase` — record green set.
-   [x] **P0.3** Add `busboy@^1.6.0` to the `catalog:` section of `pnpm-workspace.yaml` + `"busboy": "catalog:"` in `packages/universo-react-playcanvas-editor-backend/package.json` (no multipart parser exists anywhere in the workspace — verified; global `express.json` skips multipart untouched). Dependency-audit per repo procedure; respect `minimumReleaseAge: 10080`.

### Phase 1 — Editor asset CRUD (backend + bridge)

-   [x] **P1.1** Types (`@universo-react/types`, `playcanvasEditorCompatibility.ts` + `playcanvasProjects.ts`): extend asset summary schema with `path: number[]`, `parentId: number | null`, `createdAt: string`; add `EditorAssetCreateRequest` zod schema (POST: `name`, `type` enum, `parent?`, `filename?`, `data?`, `meta?`, `tags?`, `preload?`) — **separate** from any update schema (PUT is fail-closed 501, see P1.4b; field updates go through ShareDB ops).
-   [x] **P1.2** Service (`PlayCanvasProjectsService`): `createEditorCompatibilityAsset(ctx, input, fileBuffer?)` following the `writeEditorCompatibilitySourceFile` template (`:2915-3079`): replay-claim → `id = existing?.id ?? generateUuidV7()` → metadata upsert with `expectedVersion`, `stableAssetId` generation, initial `file.status:'missing'`, `publish` default → file write (hash/size/mime strictly from the `fileService.write` result) → finalize upsert (same `expectedVersion`), rollback captures previous content on failure:
    -   resolve folder `path:number[]` from the `virtual_path` parent chain; folder rows synthesized per directory segment with deterministic numeric ids (`deriveUniqueNumericAssetIds` extended with per-path salt);
    -   `type:'folder'` → row only, no file; text types → write via `PlayCanvasProjectFileService.write` (`assets/` namespace, MIME map, 5 MiB cap); user-supplied folder names and multipart `filename` must pass `assertSafeRelativePlayCanvasProjectPath` + `assertProjectSubdirectoryPath(…, 'assets')`;
    -   derive numeric `editorDocumentId`, persist the ShareDB doc seed via `persistEditorRealtimeDocument`, extend realtime allow-list, push `asset.new`;
    -   return `{ id: <numericDocumentId> }` — the ONLY field the editor reads (`upload.ts:129-134`). Note: this route deliberately returns the upstream shape `{id}` at the top level, NOT the internal `{ok, requestId, item}` envelope (the vendored parser would ignore `item`).
    ```ts
    // editor-backend/src/routes/index.ts (new route beside the existing asset routes)
    compatibilityRouter.post(
        '/metahub/:metahubId/playcanvas/editor-compatible/projects/:projectId/assets',
        deps.writeLimiter,
        deps.csrfProtection,
        createMultipartParser({
            // busboy wrapper
            limits: { fileSize: PLAYCANVAS_PROJECT_FILE_MAX_BYTES, files: 1, fields: 24, fieldSize: 64 * 1024 }
        }),
        wrapAsync(async (req, res) => {
            const claims = validateFullBootClaims(deps.tokenService, resolveCompatibilityToken(req) ?? '', {
                metahubId: req.params.metahubId,
                projectId: req.params.projectId,
                origin: resolveRequestOrigin(req) ?? resolvePlatformApiOrigin(req)
            }) // pattern: routes/index.ts:659-668
            const fields = parseEditorAssetCreateFields(req) // busboy fields + single file buffer
            const result = await port.createEditorCompatibilityAsset(claims, fields)
            res.status(201).json({ id: result.id }) // upstream shape; editor reads only `id`
        })
    )
    ```
    All error paths use the existing helpers only: `sendInvalid` / `sendUnauthorized` / `sendNotFound` / `sendUnsupported` (`{ok:false, requestId, code:'playcanvasEditor.compatibility.*'}`, `routes/index.ts:55-81`).
-   [x] **P1.3** File content route: `GET /projects/:projectId/assets/:assetId/file/:filename` — stream raw bytes with stored MIME (`text/javascript` for `.mjs/.js`), `ETag` from `file_hash`, fail-closed 404 JSON (never HTML).
-   [x] **P1.4** Delete route: `DELETE /projects/:projectId/assets` body `{assets:number[], branchId}` — folder delete = prefix delete over `virtual_path`; rows+files removed transactionally (RETURNING-confirmed, fail-closed on zero rows); push `asset.delete` messenger events; return 204.
-   [x] **P1.4b** Fail-closed coverage of the remaining editor asset surface (brief Goal: "no HTML-instead-of-JSON anywhere"):
    -   `PUT /api/assets/:id` (multipart re-upload — reachable via drag-drop overwrite `assets-upload.ts:280-311` and driver flows `driver/asset.ts:73-91,:828`): bridge rewrites to the compatibility URL; backend answers `501` JSON `{ok:false, requestId, code:'playcanvasEditor.compatibility.unsupported'}` — never HTML;
    -   catch-all for unmatched `/api/assets*` and `/api/projects/:id/assets*` editor calls (both in the bridge rewrite table and as a terminal compatibility router): JSON 404/501, never the SPA fallback;
    -   field updates (rename, data edits from the panel/inspector) keep flowing through the existing ShareDB ops → `persistEditorRealtimeDocument` path — no new route needed; covered by tests.
-   [x] **P1.5** Realtime frames (editor-backend `src/realtime/index.ts`):
    -   replace silent drop of `fs{…}` and `pipeline{…}` (`isPlayCanvasRealtimeControlFrame`, :258-288) with dispatch to handlers before the ShareDB filter;
    -   `fs{op:'delete'}` → same service delete path as P1.4;
    -   `pipeline{script-attributes}` → write ShareDB ops `data.scripts.<scriptName> = {attributes, attributesOrder, attributesInvalid?}`, `data.loading=false` into the asset doc, then messenger push `{name:'scriptAttrsFinished:<job_id>', data:{ok:true}}`.
-   [x] **P1.6** Messenger registry + allow-list seam: scope-keyed `Set` of messenger sockets in `handleMessengerSocket`; export `sendMessengerEvent(scopeKey, name, data)` and `extendRealtimeAssetAllowList(scopeKey, documentIds)`; wire both into the create/delete service callbacks (same package import seam).
-   [x] **P1.7** Bridge mapping (`playcanvas-editor-artifact.mjs`): in the XHR adapter `open()` and the fetch adapter, rewrite relative editor asset calls to compatibility URLs before the existing forwarder:
    ```js
    // artifact.mjs (generator) — alongside isRestCompatibilityEndpointUrl (3421-3443)
    const EDITOR_ASSET_ROUTES = [
        { re: /^\/api\/assets$/, method: 'POST' }, // create (multipart passthrough)
        { re: /^\/api\/assets$/, method: 'DELETE' }, // delete (JSON body passthrough)
        { re: /^\/api\/assets\/([^/]+)\/file\/(.+)$/, method: 'GET' } // raw file content
    ]
    // on match: url = compatibilityRestBaseUrl + '/assets' + suffix; mark request for
    // withRestCompatibilityAuthHeaders + CSRF header (existing helpers 3445-3459, 2428-2451)
    ```
    Keep synthetic GET list/get responses unchanged. Rebuild artifact (`pnpm --filter @universo-react/playcanvas-editor-frontend editor:build`); update artifact string-contract tests.
-   [x] **P1.8** List mapping upgrade: extend `mapCompatibilityAssetToPlayCanvasAsset` to emit real `path:number[]`, numeric `uniqueId`, `createdAt`, folder rows (type `folder`) — so the panel builds the tree (`asset-panel.ts:2092-2112`).
-   [x] **P1.9** Whitelist extension at **all four layers** (otherwise new types fail at the file layer before the service sees them): `PLAYCANVAS_ASSET_TYPES` + zod schema (`types/playcanvasProjects.ts:45-56,:499`), `PLAYCANVAS_PROJECT_ALLOWED_MIME_TYPES` (`:12-18`), `PLAYCANVAS_PROJECT_FILE_EXTENSIONS` + extension→MIME map (`PlayCanvasProjectFileService.ts:31-40` — add `.css/.html/.txt/.shader`), `isPlayCanvasAssetType` (`PlayCanvasProjectsService.ts:360-361`); validate `data` JSON shape for scripts (`{scripts:{}, loading:false, loadingType:0}` default per `createScript`); data-only types (material/cubemap/texture) create as rows without files; binary file writes fail-closed 501. Unit tests along the way (Phase 5).

### Phase 2 — ESM script-asset pipeline + runtime loader

-   [x] **P2.1** `modules-engine/compiler.ts`: export `compileScriptAssetEsm(source: string, opts): Promise<{ code: string; checksum: string; scriptNames: string[] }>`:
    ```ts
    // packages/universo-react-modules-engine/src/compiler.ts (new, beside bundleSource)
    const result = await esbuild.build({
        entryPoints: ['virtual:script'],
        bundle: true,
        write: false,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        plugins: [createScriptAssetPlugin()] // allows bare 'playcanvas' import (external), rejects all else
    })
    ```
    Bare `playcanvas` stays external (resolved by import map at runtime); relative imports within the single file are inlined; any other bare specifier → fail-closed error. Vitest coverage: happy path, unknown-import rejection, syntax-error reporting.
-   [x] **P2.2** MIME fix: `runtimeFileUrl` (`PlayCanvasProjectSnapshotService.ts:110-124`) — for `.mjs`/`.js` outputs use `data:text/javascript;base64,…` (mime already stored correctly in `output_mime`); keep `application/octet-stream` for unknown types. Update snapshot hash tests.
-   [x] **P2.3** Import map + static engine (core-frontend):
    -   `scripts/ensure-playcanvas-esm.mjs`: copy `playcanvas/build/playcanvas.mjs` (resolve via `packages/universo-react-playcanvas-engine/node_modules`) → `public/vendor/playcanvas/playcanvas.mjs`; wire as `predev`/`prebuild`; gitignore `public/vendor/`;
    -   vite plugin `importMapPlugin()` (pattern of `supportedLanguagesPlugin`, `vite.config.js:46-55`):
    ```js
    const importMapPlugin = () => ({
        name: 'inject-universo-import-map',
        transformIndexHtml(html) {
            const map = { imports: { playcanvas: '/vendor/playcanvas/playcanvas.mjs' } }
            return html.replace('</head>', `  <script type="importmap">${JSON.stringify(map)}</script>\n  </head>`)
        }
    })
    ```
    Must appear before the module entry (`index.html:95`). Editor artifact iframe unaffected (separate document).
-   [x] **P2.4** Widget script loader — new module `packages/universo-react-apps-template-mui/src/dashboard/components/playcanvasScriptAssets.ts`:
    ```ts
    export async function loadManifestScripts(app: pc.AppBase, scripts: RuntimeScriptManifest[]): Promise<void> {
        for (const script of scripts) {
            const bytes = await fetchScriptArtifact(script.artifactUrl) // data: URL fetch
            assertArtifactHash(bytes, script.artifactHash) // WebCrypto sha-256, fail-closed
            const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }))
            try {
                const module = await import(/* @vite-ignore */ blobUrl)
                registerScriptClasses(module, app) // registerScript(cls, name, app)
            } finally {
                URL.revokeObjectURL(blobUrl) // safe: module already evaluated
            }
        }
    }
    export function attachManifestScripts(app: pc.AppBase, entities: Map<string, pc.Entity>, scripts: RuntimeScriptManifest[]): void {
        for (const script of scripts) {
            const entity = entities.get(script.sceneEntityStableId ?? '')
            if (!entity) throw new ManifestScriptBindingError(script.scriptName) // localized fail-closed
            if (!entity.script) entity.addComponent('script')
            entity.script.create(script.scriptName, { attributes: script.attributeValues ?? {} })
        }
    }
    ```
    Widget wiring: call `loadManifestScripts` after manifest match (:817-846) and entity creation (:1127-1136), before `app.start()` (:1615); add `scripts` to the effect deps and to the `sceneReady` gate (`:930`); errors follow the existing localized fail-closed path (`:1950-1954`, new i18n key `playcanvasCanvas.scriptLoadFailed`). Cleanup: script components die with `app.destroy()` (`runtime.ts:83-91`); registry is app-scoped (`registerScript(cls, name, app)` — verified `playcanvas.mjs:97846-97864`; the module-global `ScriptTypes` push is inert for our flow). `assertArtifactHash` must hex-encode the WebCrypto digest and compare against the stored lowercase-hex sha-256 (64 chars, `PlayCanvasProjectFileService.ts:47-48`). Integration test (P5.4): a blob-URL module importing bare `playcanvas` resolves through the document import map (no repo precedent — must be proven, not assumed).
-   [x] **P2.5** Host bridge for scripts: attach `app.__universoHost = Object.freeze({ sendIntent, pickAt, getParticipants })` after `connectRealtime` resolves; delete in cleanup beside `__playcanvasMoveToTarget` (`:1946-1947`). Scripts read `this.app.__universoHost` — documented contract in the builtin-script header comment.
-   [x] **P2.6** `@shared/<codename>` resolution in `compileScriptAssetEsm` (brief Goal: shared gameplay code in library-role modules): extend the esbuild plugin to resolve `@shared/<codename>` imports from library-role modules of the same metahub (inlined into the artifact, circular imports rejected — mirroring the CJS compiler's `createSharedLibraryPlugin`, `compiler.ts:929-999`); any other bare specifier stays fail-closed. Vitest: happy path, cycle rejection, unknown-library rejection.
-   [x] **P2.7** Publication wiring (the missing producer of the manifest `scripts[]` pipeline): on script-asset creation/parse (P1.5 pipeline handler) persist `_mhb_playcanvas_script_assets` rows (`script_name` from `parse_result`, `script_kind` from extension, nullable `module_id` for editor-authored scripts); expose the existing compatibility PUT routes for scene script bindings (`/script-bindings/:bindingId`) to the generator; at publish, `buildGeneratedRuntimeManifests` compiles each script asset via `compileScriptAssetEsm` → writes the generated artifact file + `_mhb_playcanvas_generated_artifacts` row (via the existing `upsertGeneratedArtifact`) → manifest `scripts[]{artifactUrl, artifactHash, attributes, attributeValues, sceneEntityStableId}` (fail-closed on compile error, per existing `:561-585` semantics). Jest coverage in P5.2.

### Phase 3 — MMOOMM logic extraction + fixture regeneration

-   [x] **P3.1** Built-in script assets (new dir `metahubs-backend/src/domains/playcanvas-projects/builtin-script-assets/`): `flight-control.mjs` (prediction, reconciliation, orientation — from widget :1445-1544, :1251-1288), `follow-camera.mjs` (:148-165, :1154-1199, :1570-1593), `remote-ships.mjs` (:1358-1443), plus a shared library module `flight-math` (AABB/OBB helpers from :276-657) authored as a `library`-role module and imported by the scripts via `@shared/flight-math` (per P2.6). ESM classes `extends Script`, attributes for tunables (cruiseSpeed, cameraDistance, guardBoxes…), intents via `this.app.__universoHost.sendIntent(...)`. These files are the single source of truth (repo built-in catalog; future Store path). Built-in scripts are **copied into the project at authoring time** (snapshot semantics, KD12).
-   [x] **P3.2** Widget slimming: remove extracted logic from `PlayCanvasCanvasWidget.tsx` (keep manifest fetch, entity creation from scene objects, Colyseus room lifecycle + intent bridge, HUD/status, dataset markers). Target: widget ≤ ~1200 lines; logic lives in scripts. No legacy kept.
-   [x] **P3.3** Generator updates (`metahubs-mmoomm-app-export.spec.ts` + `mmoommAppGeneratorData.ts`):
    -   drop the `flight-canvas-widget` client module (replaced by script assets); keep `fixed-tick-flight-runtime` server module;
    -   author script assets **through the Editor** (read builtin `.mjs` files from the repo, create via `editor.api.globals.assets.createScript({ filename: 'flight-control.mjs', text })`, wait for parse completion — proves the whole Phase 1 loop), bind them to `MMOOMM Ship` / camera entities with attributes via scene script bindings;
    -   publish → assert `runtimeManifests[].scripts[]` non-empty with matching hashes.
-   [x] **P3.4** Contract + drift: extend `assertMmoommAppFixtureEnvelopeContract` — `assertRuntimeModules` stays; new `assertRuntimeScripts` (non-empty `scripts[]`, `artifactHash` present, `sceneEntityStableId` ∈ scene object ids), `assertScriptAssets` and `assertGeneratedArtifacts` (non-empty envelope sections, deterministic hashes); extend `checkMmoommAppFixtureDrift` normalizers (volatile fields: none new expected — hashes are deterministic).
-   [x] **P3.5** Regenerate fixture: `UPDATE_MMOOMM_APP_FIXTURE=1 pnpm test:e2e:generators -- metahubs-mmoomm-app-export` against minimal local Supabase (`pnpm supabase:e2e:start:minimal`); commit new `tools/fixtures/metahubs-mmoomm-app-snapshot.json`; verify snapshot-import flow (`flows/snapshot-import-mmoomm-app-runtime.spec.ts`) end-to-end: import → Editor (assets visible, "+" works) → publish → app runs with script-driven flight/camera (dataset markers: `shipScreenX`, `cameraDistance` move **and** a new `scriptsLoaded` marker).

### Phase 4 — Modules tabs merge (MUI)

> **UI Contract** (runtime-ux gate): one "Modules" tab in metahub Resources; inside, a compact scope switcher (`Tabs`, small variant — existing package primitive) with two options: "Модули метахаба" / "Общие модули" (EN: "Metahub modules" / "Shared modules"). No raw ids, no JSON cells; role/source Selects remain localized (`EntityModulesTab` already complies); scope choice persists in component state (not URL) for MVP; no page-level horizontal overflow at 1440×900 and 375px widths; screenshots EN+RU required in Phase 5. Entity-attached module tabs (entity detail views) are out of scope and unchanged.

-   [x] **P4.1** New `packages/universo-react-metahubs-frontend/src/domains/modules/ui/MetahubModulesSurface.tsx` (scope switch styled after the existing nested Tabs pattern `ComponentList.tsx:1585-1602`):
    ```tsx
    export const MetahubModulesSurface = ({ metahubId, t }: { metahubId: string | null; t: TranslationFn }) => {
        const [scope, setScope] = useState<'metahub' | 'general'>('metahub')
        return (
            <Box>
                <Tabs
                    value={scope}
                    onChange={(_, next) => setScope(next)}
                    sx={{ mb: 2, minHeight: 40, '& .MuiTab-root': { textTransform: 'none' } }}
                >
                    <Tab value='metahub' label={t('modules.scopes.metahub', 'Metahub modules')} />
                    <Tab value='general' label={t('modules.scopes.general', 'Shared modules')} />
                </Tabs>
                <EntityModulesTab metahubId={metahubId} attachedToKind={scope} attachedToId={null} t={t} />
            </Box>
        )
    }
    ```
    `EntityModulesTab` signature untouched (7 reuse sites stay valid).
-   [x] **P4.2** `SharedResourcesPage.tsx`: remove `runtimeModules` from `SharedResourcesTab` type + tab config (:171-182); render `<MetahubModulesSurface/>` for the single `modules` tab (:310-314 replaced).
-   [x] **P4.3** i18n: add `modules.scopes.*` keys to `metahubs-frontend/src/i18n/locales/{en,ru}/metahubs.json`; remove `general.tabs.runtimeModules` after no-references check.
-   [x] **P4.4** Tests: update `SharedResourcesPage.test.tsx` (tab list shrinks by one; single render + scope-switch assertions on `mockEntityModulesTab` props); new `MetahubModulesSurface.test.tsx` (scope switch changes `attachedToKind`, query-key separation, default scope).

### Phase 5 — Test system (deep, per repo conventions)

-   [x] **P5.1** Vitest — editor-backend (`pnpm --filter @universo-react/playcanvas-editor-backend test`): multipart create route (fields+file, 201 `{id}`, CSRF reject, busboy limits exceed — fileSize/files/fields, oversize reject), file route (MIME, ETag, 404 JSON), PUT route → JSON 501 (never HTML), unknown asset route → JSON 404/501, delete route (folder prefix, fail-closed), `fs`/`pipeline` frame dispatch, messenger registry push format, allow-list extension + reconnect-with-refreshed-token case.
-   [x] **P5.2** Jest — metahubs-backend: service create/delete asset (folder path derivation, deterministic document ids, rollback on file failure), whitelist extension, `runtimeFileUrl` MIME fix (hash stability), manifest `scripts[]` with bindings (existing `PlayCanvasProjectSnapshotService.test.ts` extended).
-   [x] **P5.3** Vitest — modules-engine: `compileScriptAssetEsm` (happy path with `import { Script } from 'playcanvas'`, unknown-bare-import rejection, syntax error surface, checksum determinism).
-   [x] **P5.4** Vitest — apps-template-mui: `playcanvasScriptAssets` unit tests (hash mismatch fail-closed, blob import, registration, attribute pass-through, missing-entity error) + `PlayCanvasCanvasWidget.test.tsx` extensions (scripts gate, `scriptsLoaded` marker, slimmed widget still passes the existing ~40 cases).
-   [x] **P5.5** Playwright E2E (stack via `pnpm supabase:e2e:start:minimal` per `test:e2e:mmoomm-app-runtime:local-supabase` chain):
    -   **New flow spec** `flows/playcanvas-editor-assets.spec.ts`: open fullscreen editor (`openFullscreenEditorThroughBrowser` pattern, `frameLocator('iframe[data-testid="playcanvas-editor-frame"]')`), assert `#layout-assets` shows folder tree, click "+" → Script → asset appears (ShareDB + messenger loop proof), open the script file (content view through the file endpoint; the code editor itself stays fail-closed per Out of Scope), rename via panel (ShareDB ops), delete it; **screenshots** of the assets panel via `page.screenshot({ clip: assetsPanelBox })` into `testInfo.outputPath` + docs assets;
    -   **Baseline-trace spec** (runs BEFORE Phase 3 extraction on the pre-refactor widget): record dataset-marker trajectories (`shipScreenX/Y`, `cameraDistance`, `cameraYaw`) over a fixed 5 s scenario into a JSON baseline artifact; after P3.2 the same scenario must reproduce markers within tolerance (≤1 px screen markers, ≤0.5 world units for positions, sampled at 10 Hz) — this makes extraction parity measurable, not eyeballed;
    -   extend `metahubs-mmoomm-app-export.spec.ts` per P3.3 (script authoring through Editor is itself the deepest E2E proof);
    -   extend runtime proof: `scriptsLoaded` dataset marker + existing ship/camera markers must move **with scripts active** (proves extraction parity);
    -   visual specs: assets panel + merged Modules tab (`ru-light`/`ru-dark` matrix per existing visual spec pattern).
-   [x] **P5.6** Screenshots for docs: extend the `docs-entity-screenshots.spec.ts` pattern → `docs/{en,ru}/.gitbook/assets/platform/` (assets panel with tree, create-script menu, merged Modules tab with scope switcher); `pnpm docs:gitbook-screenshot-assets:check` green.

### Phase 6 — Docs, READMEs, stale-version hygiene

-   [x] **P6.1** New GitBook page `docs/{en,ru}/platform/playcanvas-editor-assets.md` (frontmatter `description:`, H1, sections: asset model, supported types, create/delete flows, script assets & attributes, folder rules, limitations) + `SUMMARY.md` entries near `platform/playcanvas-editor.md` (~:59) in both locales; update `platform/metahubs/shared-modules.md` + `module-scopes.md` for the merged tab.
-   [x] **P6.2** README updates: `playcanvas-editor-backend/README.md` + `README-RU.md` ("Current Scope": replace `empty/limited assets shell` with the implemented surface; move "broad binary asset pipeline" wording to reflect new scope), `apps-template-mui/README.md` (script-asset loading contract, new dataset markers), `metahubs-frontend` (merged tab), `modules-engine` (new export).
-   [x] **P6.3** Stale v2.24.2 → v2.30.4 fixes: `playcanvas-editor-frontend/README.md:10-12`, `.agents/skills/playcanvas-editor-authoring/SKILL.md` (:3,:16 + references/notes.md), `.agents/skills/playcanvas-editor-assets/SKILL.md:16`; while touching version docs, sync `editor-backend/src/config/index.ts:306-307` (`engineVersions 2.21.3` → `2.21.4` to match the installed engine).
-   [x] **P6.4** Memory bank: update `memory-bank/progress.md` + `tasks.md` at milestones; `currentResearch.md` link to plan.

## Potential Challenges

1. **Multipart + CSRF through the bridge**: the vendored XHR sends `withCredentials` but no CSRF token; the bridge must attach the CSRF cookie/header (existing fetch pattern `artifact.mjs:2428-2451`) to rewritten asset calls — otherwise `deps.csrfProtection` rejects. Mitigation: reuse the exact `saveCurrentScene` header pattern; test both artifact-origin siblings. Cross-origin is already solved today by the global `cors(getCorsOptions())` middleware (`core-backend/src/index.ts:413`, `XSS.ts:23-53`) — `saveCurrentScene` proves the pattern; production deployments must keep `CORS_ORIGINS` inclusive of the artifact origin and `SESSION_COOKIE_SAMESITE=none`, otherwise rewritten calls break exactly like `saveCurrentScene` would.
2. **Deterministic folder/document ids across fixture regenerations**: folder ids derived from path hashes must be stable; salt derivation tested against reorderings (a/b vs b/a must differ, same input must collide to same id).
3. **Script-parse loop timing**: `createScript` waits `file.url:set` → parse → `data.scripts.*` within 30 s; our pipeline frame handler must be fast and idempotent; a lost messenger push = 30 s hang. Mitigation: write ShareDB ops synchronously in the frame handler; integration test with real WS.
4. **Extraction parity**: script-driven flight/camera must reproduce dataset-marker trajectories within the P5.5 baseline tolerances (≤1 px screen markers, ≤0.5 world units, 10 Hz sampling over 5 s); the baseline spec runs before extraction and the comparison is a committed artifact, not an eyeball check.
5. **`import()` of data:/blob: URLs under future CSP tightening**: document currently has no CSP; if one is added later, `blob:` must be in `script-src`. Noted in docs; no action now.
6. **Widget regression surface**: the widget has ~40 existing Vitest cases; extraction must keep them green with minimal edits (they mock the engine layer, not the extracted math).
7. **Fixture size**: builtin script sources embedded in the snapshot increase size (~10-20 KB each) — acceptable; drift normalizers must not normalize hashes.

## Dependencies

-   Phase 2 depends on Phase 1 only for P2.7's editor-authored script rows (the compiler work P2.1-P2.6 is independent).
-   Phase 3 depends on Phases 1 **and** 2 (generator authors scripts through the Editor — requires the create/parse loop — and the runtime loader — requires import map + ESM pipeline).
-   Phase 5 (E2E) interleaves: P5.1-P5.4 land with their phases; P5.5-P5.6 after Phase 3 (the baseline-trace spec runs before P3.2).
-   No external-team dependencies; no DB migrations; no version bumps.

## Out of Scope

-   Binary asset uploads (models/textures/audio) and the Upload menu item (fail-closed error for now; data-only rows for material/cubemap/texture are allowed, file writes are not).
-   Asset Store/marketplace catalog (design leaves room; not built).
-   ShareDB `documents` collection for the code editor (first iteration: editor code editor stays fail-closed; scripts authored via generator/API content).
-   `visualLinkupLabRuntime.ts` stays widget-static — it is a deterministic scene renderer, not gameplay logic; migration onto script assets is deferred (research open question D8 answered: no migration in this iteration).
-   Branches/checkpoints/version control for assets.
-   Restoring removed gameplay (mining/docking/cargo/gates).
