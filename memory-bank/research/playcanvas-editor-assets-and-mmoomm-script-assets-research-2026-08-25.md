# Research: PlayCanvas Editor Assets Pipeline and MMOOMM Script-Asset Runtime Loading

> Created: 2026-08-25
> Status: Draft
> Trigger: RESEARCH command following the manager-only PlayCanvas Editor assets and script-assets brief.
> Follow-up plan: ../plan/ (pending)

## Research Question

Three decision areas must be pinned before PLAN for the brief "PlayCanvas Editor Assets Pipeline Fix and MMOOMM Script-Asset Refactoring":

1. **Editor asset CRUD contracts**: exact request/response shapes for create/upload, list, file content, delete, and script parsing that the vendored Editor v2.30.4 expects from our compatible backend — plus the ShareDB document lifecycle that makes a newly created asset appear in the ASSETS panel.
2. **Runtime script loading**: how generated ESM (`.mjs`) script artifacts can be loaded into the published application's PlayCanvas engine — existing worker sandbox vs main-thread registration — and how the `playcanvas` module specifier is resolved (import map vs bundle-time inlining).
3. **Supporting decisions**: minimal asset-type set for the first CRUD iteration, `editorDocumentId` stability for fixture determinism, and the folder model.

## Source Inventory

| Source                                                                                                                               | Type                 | Date / Freshness    | Why It Matters                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Vendored Editor v2.30.4 source (`packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/`)                  | Primary (normative)  | vendored 2026-08-25 | Defines the exact client-side contracts our backend must satisfy                                     |
| `packages/universo-react-playcanvas-editor-backend/`, `universo-react-metahubs-backend/`, `universo-react-apps-template-mui/` source | Primary              | current HEAD        | Current implementation state and gaps                                                                |
| https://developer.playcanvas.com/user-manual/api/asset-create/                                                                       | Primary (external)   | fetched 2026-08-25  | Official create-asset contract (multipart; allowed types; response schema)                           |
| https://developer.playcanvas.com/user-manual/api/asset-list/                                                                         | Primary (external)   | fetched 2026-08-25  | Official list-asset response schema                                                                  |
| https://developer.playcanvas.com/user-manual/scripting/esm-scripts/                                                                  | Primary (external)   | fetched 2026-08-25  | ESM script format, `registerScript`, engine-only registration flow                                   |
| https://developer.playcanvas.com/user-manual/engine/standalone/                                                                      | Primary (external)   | fetched 2026-08-25  | Import-map option for resolving the `playcanvas` specifier                                           |
| https://developer.playcanvas.com/user-manual/editor/scripting/import-maps/                                                           | Primary (external)   | fetched 2026-08-25  | Editor-side import maps (ESM-only)                                                                   |
| https://github.com/playcanvas/editor/releases (v2.30.4, 2026-08-21)                                                                  | Primary (external)   | 2026-08-21          | Confirms vendored tag is current latest                                                              |
| https://github.com/playcanvas/editor/issues/1118                                                                                     | Primary (external)   | closed 2024-05-13   | Launcher/export use a global import map resolving `playcanvas` to the ESM engine build               |
| https://api.playcanvas.com/engine/functions/registerScript.html                                                                      | Primary (external)   | v2.21.4 docs        | `registerScript(script, name?, app?)` signature and hot-swap semantics                               |
| https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap                                           | Primary (external)   | fetched 2026-08-25  | Import-map processing rules: before-first-module requirement, workers excluded, multiple-map merging |
| https://bugzilla.mozilla.org/show_bug.cgi?id=1997781 + https://github.com/WICG/import-maps/issues/92                                 | Primary (external)   | fetched 2026-08-25  | Dynamic import-map injection is rejected by Firefox; spec error after module loading started         |
| https://lea.verou.me/blog/2026/external-import-maps-today/                                                                           | Secondary (external) | 2026-03-02          | Classic-script injector technique works Chrome 89+/Safari 16.4+/Firefox 108+                         |

## Key Findings

### A. Editor-facing asset CRUD contracts (facts from vendored v2.30.4 source)

-   **Create response is minimal**: `POST /api/assets` (XHR, `withCredentials`, multipart) is a success on HTTP 200/201, and the editor consumes **only `result.id`** from the response JSON (`vendor/editor-api/assets/upload.ts:96-102,129-134`; `vendor/editor-api/assets.ts:631-640`). The local `Asset` is NOT built from the response — the editor waits for either a messenger `asset.new` push (stub + `loadAndSubscribe()`) or a full `GET /api/assets/:id`. The official REST docs confirm the full response schema (`id, name, type, file{hash,filename,size,url}, parent, path-less; status 201`) but the vendored code ignores all of it except `id`.
-   **Messenger `asset.new` is mandatory** for the panel: `Assets.upload()` blocks on `add[result.id]`, which is emitted only after `_onMessengerAddAsset` creates a stub from the push payload `{asset:{branchId, id:<uniqueId>, source, status:'complete', type, source_asset_id, createdAt}}` and subscribes the ShareDB doc (`vendor/editor-api/assets.ts:206-262`). Without the push, "+"-creation hangs forever (folder) or until `SCRIPT_PARSE_TIMEOUT` (script).
-   **Folder tree is built from `path` arrays**: `asset.get('path')` (array of ancestor ids, root = `[]`) drives `_addFolder`, re-parenting on `path:set`, and per-folder filtering (`vendor/editor/assets/asset-panel.ts:2092-2112,1873-1878,2408-2422`). Assets carry no `parentId` field — the `parentId` occurrences in the vendored source are unrelated local variables. Per-folder filtering has two modes: `path.includes(currentFolderId)` with an active search query, last-path-element comparison without (`asset-panel.ts:2414,2422`). `createFolder` sends `type:'folder'` with no file/data (`vendor/editor-api/assets.ts:815-827`).
-   **File content endpoint**: `GET /api/assets/:id/file/:filename?branchId=` returns raw text (`notJson:true`); the file `url` is computed client-side as that path (`vendor/editor-api/asset.ts:353-355`). It feeds script parsing, `assets:realPath`, and the code editor's dirty-check.
-   **Delete has two paths**: UI delete sends a realtime text frame `fs{"op":"delete","ids":[uniqueId…]}` (`vendor/editor/assets/assets-fs.ts:18-23`) and expects messenger `asset.delete`/`assets.delete` to update the list; the API path is `DELETE /api/assets` with JSON body `{assets:[ids], branchId}` (`vendor/editor-api/assets.ts:1244-1261`). Our backend currently discards `fs{…}` frames silently (`editor-backend/src/realtime/index.ts:258-289`).
-   **Script parse is a server round-trip**: `createScript` → ESM worker (`esm-script.worker.js`, `@playcanvas/attribute-parser`) fetches the script via the files endpoint → result is sent to the server as a realtime `pipeline{script-attributes,…}` frame → the server must write ShareDB ops `data.scripts.<scriptName> = {attributes, attributesOrder, …}, data.loading:false` and emit messenger `scriptAttrsFinished:<job_id>` (`vendor/editor/assets/handle-script-parse.ts:35-101,156-165,197-231`; `vendor/editor-api/assets.ts:1050-1079`). Our backend drops `pipeline{` frames (`realtime/index.ts:262,275-276`), so parsing always times out at 30 s. ESM vs classic is determined solely by the `.mjs` extension (`vendor/editor/assets/assets.ts:102-104`).
-   **ShareDB doc minimal shape**: collection `assets`, docId = stringified numeric uniqueId; data must carry `item_id:number, name, type, path:number[], file:{filename,hash?,size?}|null, data, meta, tags, preload, source` (plus `exclude/scope/i18n/has_thumbnail` for full inspector sync); synced paths are `['name','path','exclude','preload','tags','scope','data','meta','file','i18n']` (`vendor/editor-api/asset.ts:255-295`; `vendor/editor/assets/assets-sync.ts:5`). Client deletes `item_id`/`branch_id` after read.
-   **Code editor** uses a separate ShareDB collection `documents` (docId = uniqueId, `ot-text`) plus the files endpoint for verification (`vendor/code-editor/documents/documents-load.ts:55-74`). Our backend allow-lists only `scenes|assets|settings|user_data` (`editor-backend/src/realtime/index.ts:69`).

### B. Token and allow-list lifecycle constraint

-   Asset docs are allow-listed by `claims.assetDocumentIds` minted into the full-boot token; the allow-list of a **live** realtime backend is extended only when a new socket authenticates (`editor-backend/src/realtime/index.ts:426-442,1116-1126`). The sliding token refresh (`refreshFullBootAccessToken`, 5-minute TTL, `bridgeSessionId` renewal) re-mints the claim list from a fresh DB read (`editor-backend/src/routes/index.ts:461-508`), but an already-open socket does not gain new keys mid-session.
-   Therefore subscribing to an asset created **after** the current socket's auth requires both a token refresh and a realtime re-auth (reconnect). Today our backend never pushes `asset.new`/`asset.delete` (only `authenticate`/`project.watch` are handled, `realtime/index.ts:886-953`), so the create loop is open at both ends.

### C. Runtime script loading (facts)

-   The engine wrapper re-exports the whole `playcanvas` npm module (`packages/universo-react-playcanvas-engine/src/index.ts:1`), which is bundled into the SPA (no externals in `apps-template-mui/vite.config.ts`); the widget already holds the full `pc` namespace on the main thread and creates entities with stable ids into an `entities` Map (`PlayCanvasCanvasWidget.tsx:1032,1108-1136`). `manifest.scripts[]` is consumed by nothing (`grep` = 0 hits).
-   The published app document has **no CSP** (`core-backend/src/routes/index.ts:56` disables CSP; SPA fallback sets no `script-src`), so main-thread dynamic `import()` and blob modules are not blocked. Bundle resources themselves carry strict per-response CSP (`runtimeModulesController.ts:78-85`) — resource-level, not document-level.
-   **The existing worker sandbox cannot host script assets**: no DOM/WebGL/canvas in a Dedicated Worker; the sandbox shadows `document/window/Blob/URL/Function` and disables worker globals (`browserModuleRuntime.ts:12-105`); the fake `require` exposes only intent/camera/AABB helpers, `require('playcanvas')` throws (`:238-244`); workers are one-shot with a 15 s timeout (`:80,562-590`); the compiler forbids dynamic `import()` in bundles (`compiler.ts:648-680`); only serialized host functions cross the boundary.
-   **`artifactUrl` is currently unusable for module loading**: it is a `data:application/octet-stream;base64,…` URL (`PlayCanvasProjectSnapshotService.ts:110-124`) — wrong MIME for ES module import; a `text/javascript` HTTP (or data) source is required.
-   **No import map exists anywhere** in the published app HTML; the SPA is served from one place (`core-frontend/index.html` + `core-backend` static/fallback), and vite already has an HTML-transform plugin hook (`supportedLanguagesPlugin`, `core-frontend/vite.config.js:46-48,81`). Local ESM builds of playcanvas 2.21.4 exist in `node_modules` (`build/playcanvas.mjs`, `playcanvas.min.mjs`, exports map `import` condition) and could be served.
-   **Import-map browser constraints** (MDN importmap reference; WICG import-maps #92; Firefox bugzilla 1997781; es-module-shims): a map must be declared and processed **before** any module using its specifiers loads; maps apply only to document-loaded module imports — **not to workers** or `<script src>`; the current spec merges multiple maps, but some browsers allow only a single declaration, and **dynamically adding a map after module loading has started is an error** (works in Chromium/Safari, rejected by current Firefox). Injection via a classic blocking script before the main module works across Chrome 89+, Safari 16.4+, Firefox 108+. Import maps also support an `integrity` key usable for SRI-style artifact-hash enforcement of dynamically imported artifacts.
-   **Engine-only registration is a documented, supported flow**: `import { Script } from 'playcanvas'` → `registerScript(MyScript, undefined, app)` (or `app.scripts.add`) keyed by `static scriptName` → `entity.addComponent('script')` → `entity.script.create('<scriptName>')`; name-based registration is exactly what enables dynamic `import()` + registration workflows (ESM scripts docs; `registerScript` API v2.21.4). Upstream's own launcher resolves the `playcanvas` specifier via a global import map (editor issue #1118, completed 2024-05-13).
-   **The modules compiler cannot produce script assets as-is**: output is hard-wired `format:'cjs'` with a CJS shim, `playcanvas` imports are rejected by the allowlist (`compiler.ts:64-103,1001-1049`), and the class contract is `ExtensionModule` + decorators, not `ScriptType` lifecycle. A separate ESM pipeline (esbuild, `playcanvas` external, `format:'esm'`) is needed for script-asset artifacts. `artifactHash` participates in snapshot checksums but is never verified before execution (`publicationSnapshotHash.ts:189`).

### D. Official REST API vs vendored editor internals (conflict noted)

-   The public REST list returns `{result:[…], pagination:{skip,limit,total}}` and create returns the full asset JSON with status 201. The vendored editor's internal endpoints differ: its project-assets call (`/api/projects/:id/assets?…&view=designer`) expects a **raw JSON array** (`vendor/editor-api/assets.ts:494,551`), and create consumes only `id`. **The vendored source is normative for our compatibility backend**, not the public REST docs; public docs serve as the shape reference for fields we choose to return.
-   **Folder type divergence**: the public create endpoint documents support only `script, html, css, text, shader, json` (no `folder`), yet the vendored `createFolder` sends `type:'folder'` to the same internal `POST /api/assets`. The compatibility backend must accept `folder` on the editor-facing route regardless of the public docs.

## Conflicts And Uncertainty

-   **Public REST docs vs vendored internal API** (above): resolved in favor of vendored source; flagged so PLAN does not copy official response schemas verbatim.
-   **`undefined` status-bar mechanism** (from the original screenshots) is unverified in source; kept as an observed symptom only.
-   **v2.30.4-specific behaviors**: all editor-side contracts were read from the vendored v2.30.4 snapshot; upstream releases after 2026-08-21 may change them (release notes show no asset-pipeline changes in v2.30.x as of the research date).
-   **Stale project docs**: frontend `README.md` and skills `playcanvas-editor-authoring` / `playcanvas-editor-assets` still reference v2.24.2; actual vendor tag is v2.30.4 (`playcanvas-editor-artifact.mjs:10`, seed `v2.30.4-vendor`).
-   **Security posture of main-thread script execution** is a policy question, not a technical unknown: published script code would run with full document access (equivalent to the widget code itself), unlike the worker-sandboxed module methods.

## Project Implications

-   **Backend (editor compatibility)**: implement `POST /api/assets` (multipart; types: folder/script/css/text/json minimum; response `{id}`), `GET /api/assets/:id/file/:filename` (raw, correct MIME), `DELETE /api/assets`; route the `fs{op:'delete'}` realtime frame and the `pipeline{script-attributes}` frame to handlers; push messenger `asset.new`/`asset.delete`/`scriptAttrsFinished:<job_id>` over the realtime socket; persist `path:number[]` (folder hierarchy) and `createdAt` on every asset document; extend the bridge mapper (`mapCompatibilityAssetToPlayCanvasAsset`) to emit real `path`, numeric `uniqueId`, and `createdAt`.
-   **Token/realtime lifecycle**: on asset create/delete, re-mint the token (existing sliding refresh) and extend the live backend allow-list — either by forcing a realtime re-auth or by adding an in-session allow-list extension message; without this, "+"-created assets cannot be subscribed by the creating client.
-   **Runtime (apps-template-mui / applications-backend)**: add a script-asset loader on the main thread — serve generated `.mjs` artifacts with `text/javascript` (new HTTP endpoint or data-URL with correct MIME), inject an import map resolving `playcanvas` (and future bare specifiers) **before the SPA's main module loads** — build-time HTML transform in `core-frontend` or a classic blocking injector script; runtime injection at widget mount is not cross-browser viable because the SPA has already loaded modules by then (see import-map browser constraints above) — then dynamically import each `manifest.scripts[]` artifact, `registerScript` it on the widget's `pc` app, then `addComponent('script')` + `entity.script.create(scriptName)` + apply `attributeValues` on entities matched by `sceneEntityStableId`; verify `artifactHash` before execution (optionally also via the import map `integrity` key). The existing worker sandbox stays untouched for module methods.
-   **Artifact pipeline**: new ESM artifact path for script assets (esbuild, `playcanvas` external, `format:'esm'`) — either a new mode in `@universo-react/modules-engine` or a sibling pipeline in the playcanvas-projects domain; built-in MMOOMM scripts ship as repo files compiled through it, user scripts as file-backed modules compiled through the same path.
-   **Fixture/generator**: `scriptAssets/generatedArtifacts/scripts` stop being empty; generator authors scripts via the Editor ("+" → Script), contract `assertMmoommAppFixtureEnvelopeContract` gains script-asset assertions; drift normalizers learn the new fields; `editorDocumentId` deterministic hashing extends to script assets to keep fixture diffs stable.
-   **Docs hygiene (implementation-time)**: correct v2.24.2 → v2.30.4 in frontend README and the two skills.

## Recommended Decision

1. **Editor CRUD**: implement the minimal upstream-compatible surface — types `folder`, `script` (`.js`/`.mjs`), `css`, `text`, `json` (defer `shader`/`html`/uploads/binaries); contracts exactly as in Key Findings A (create response `{id}` only; messenger `asset.new` push; ShareDB doc with `path[]`; files endpoint; `fs` delete frame + messenger; `pipeline` script-attributes round-trip). Pair every create/delete with token refresh + realtime allow-list extension.
2. **Runtime loading**: main-thread dynamic import + import map + `registerScript` + script components (Key Findings C). The worker sandbox is architecturally incapable of hosting script assets; do not attempt it. Accept that published script code runs with document-level trust, same as widget code, and gate user-authored script execution behind the existing publication flow (fail-closed checksums, verified `artifactHash`).
3. **Artifact pipeline**: build the ESM script-artifact pipeline as a distinct mode (esbuild, `playcanvas` external) rather than warping the CJS module compiler; share the source storage (`storage/modules/**` file-backed modules + repo-file built-in catalog) between them.
4. **Fixture determinism**: keep deterministic `editorDocumentId` hashing; extend it to newly created script assets so regenerated fixtures diff only on real content.

## Open Questions Before PLAN

-   **Trust boundary wording**: is main-thread execution of user-authored published scripts acceptable as-is (parity with widget code), or does PLAN need an intermediate restriction (e.g. capability flags per script asset) for the first iteration?
-   **Built-in catalog import semantics**: are repo-file scripts copied into the project at creation time (snapshot semantics) or referenced live (platform-upgrade semantics)? Affects fixture stability and upgrade story.
-   **Code editor scope**: is ShareDB `documents` collection (ot-text) for editing scripts inside the integrated editor in scope for this brief, or does the first iteration keep the editor's code editor read-only/fail-closed?
-   **Import map injection point**: evidence leans to a build-time HTML transform in `core-frontend` (or a classic blocking injector script before the main module); programmatic injection at widget mount is not cross-browser viable (Firefox rejects maps added after module loading started). PLAN confirms placement and whether import-map `integrity` keys additionally carry `artifactHash`.
-   **Visual lab**: does `visualLinkupLabRuntime.ts` stay widget-static, or migrate onto script assets in this brief?

## Sources

-   https://developer.playcanvas.com/user-manual/api/asset-create/
-   https://developer.playcanvas.com/user-manual/api/asset-list/
-   https://developer.playcanvas.com/user-manual/scripting/esm-scripts/
-   https://developer.playcanvas.com/user-manual/engine/standalone/
-   https://developer.playcanvas.com/user-manual/editor/scripting/import-maps/
-   https://api.playcanvas.com/engine/functions/registerScript.html
-   https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap
-   https://bugzilla.mozilla.org/show_bug.cgi?id=1997781
-   https://github.com/WICG/import-maps/issues/92
-   https://lea.verou.me/blog/2026/external-import-maps-today/
-   https://github.com/guybedford/es-module-shims (multiple/dynamic import-map polyfill reference)
-   https://github.com/playcanvas/editor/releases (v2.30.4)
-   https://github.com/playcanvas/editor/issues/1118
-   Vendored Editor v2.30.4 source and Universo backend/frontend source (paths cited inline above)
