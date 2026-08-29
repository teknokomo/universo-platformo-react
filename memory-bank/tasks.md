# PlayCanvas Editor Assets Pipeline + MMOOMM Script Assets (2026-08-25)

> Status: complete — implementation and post-QA remediation verified
> Source plan: `memory-bank/plan/playcanvas-editor-assets-and-mmoomm-script-assets-plan-2026-08-25.md` (QA-reviewed)
> Research: `memory-bank/research/playcanvas-editor-assets-and-mmoomm-script-assets-research-2026-08-25.md`
> Branch: `feature/playcanvas-editor-assets-and-mmoomm-scripts`

## Contract

-   No legacy code preservation; test DB deleted and recreated fresh. Metahub schema/template versions NOT bumped (zero DDL — folders derive from `virtual_path`).
-   All user-facing text EN/RU localized from day one; UUID v7 for new row PKs; TanStack Query on the frontend; Chromium-only browser scope.
-   Evidence: focused tests per phase + real-browser proof (Playwright, minimal local Supabase) for editor and runtime flows; screenshots for UI claims.

## Checklist

### Current implementation continuation — production shell returns HTTP 500 for static assets (2026-08-29)

-   [x] Diagnose the exact HTTP 500 response: browser asset requests were rejected by CORS because the generated development profile omitted `CORS_ORIGINS`.
-   [x] Keep static asset routing strict and make local profile generation always emit the two credential-safe loopback application origins.
-   [x] Extend the local Supabase doctor to fail before startup when the loopback CORS contract is absent, wildcarded, or incomplete.
-   [x] Regenerate the profile and verify HTML, JavaScript, CSS, missing-asset 404 behavior, and a rendered Chromium page at `http://localhost:3000`.

### Phase 0 — Preconditions

-   [x] P0.1 OntoIndex freshness check; branch created
-   [x] P0.2 Baseline: editor-backend 60✓, metahubs-backend playcanvas 212✓, modules-engine ✓, PlayCanvasCanvasWidget 43✓ (pre-existing: InterpretationNetwork 16 failures on main — unrelated)
-   [x] P0.3 `busboy@^1.6.0` in catalog + editor-backend deps; installed 1.6.0

### Phase 1 — Editor asset CRUD (backend + bridge)

-   [x] P1.1 Types: asset summary `path/parentId/createdAt`; `EditorAssetCreateRequest` zod (POST-only)
-   [x] P1.2 Service `createEditorCompatibilityAsset` (folders via virtual_path, uuidv7, replay-claim template, ShareDB seed, allow-list, `asset.new` push, `{id}` response)
-   [x] P1.3 File content route (raw bytes, stored MIME, ETag, 404 JSON)
-   [x] P1.4 Delete route (folder prefix, fail-closed, `asset.delete` push) + **P1.4b** fail-closed PUT 501 + catch-all JSON
-   [x] P1.5 Realtime frames: `fs{op:'delete'}` + `pipeline{script-attributes}` handlers (ShareDB ops + `scriptAttrsFinished:<guid>` push)
-   [x] P1.6 Messenger registry + `extendRealtimeAssetAllowList` seam
-   [x] P1.7 Bridge mapping: rewrite POST/DELETE/file/PUT/unknown `/api/assets*` to compatibility URLs (auth+CSRF headers)
-   [x] P1.8 Mapper upgrade: real `path[]`, numeric `uniqueId`, `createdAt`, folder rows
-   [x] P1.9 Whitelist extension at all four layers (types+zod, MIME map, extensions map, service validator)

### Phase 2 — ESM script-asset pipeline + runtime loader

-   [x] P2.1 `compileScriptAssetEsm` in modules-engine (+ exports, fail-closed import policy)
-   [x] P2.2 `runtimeFileUrl` MIME fix for `.mjs/.js` (text/javascript data URLs)
-   [x] P2.3 Import map plugin (core-frontend vite) + `ensure-playcanvas-esm.mjs` prebuild copy + gitignore
-   [x] P2.4 `playcanvasScriptAssets.ts` loader (fetch→sha256 verify→blob→import→registerScript→attach) + widget wiring + fail-closed i18n
-   [x] P2.5 Host bridge `app.__universoHost` + cleanup
-   [x] P2.6 `@shared/<codename>` resolution in `compileScriptAssetEsm`
-   [x] P2.7 Publication wiring: script_assets rows on parse, bindings via existing PUT routes, compile-at-publish → generated artifacts → manifest `scripts[]`

### Phase 3 — MMOOMM logic extraction + fixture regeneration

-   [x] P3.1 Built-in scripts: `flight-control.mjs`, `follow-camera.mjs`, `remote-ships.mjs` + `flight-math` library module
-   [x] P3.2 Widget slimming (remove extracted logic; keep manifest/entities/Colyseus/HUD/markers)
-   [x] P3.3 Generator updates: drop flight-canvas-widget module; author scripts through Editor; bind to entities; publish with scripts[]
-   [x] P3.4 Contract + drift: `assertRuntimeScripts`, `assertScriptAssets`, `assertGeneratedArtifacts`
-   [x] P3.5 Regenerate fixture + snapshot-import E2E green

### Phase 4 — Modules tabs merge (MUI)

-   [x] P4.1 `MetahubModulesSurface` (nested Tabs pattern from ComponentList)
-   [x] P4.2 `SharedResourcesPage` single modules tab
-   [x] P4.3 i18n keys EN/RU (`modules.scopes.*`), remove `runtimeModules` tab key
-   [x] P4.4 Tests: SharedResourcesPage + MetahubModulesSurface

### Phase 5 — Test system

-   [x] P5.1 Vitest editor-backend: create/file/delete/PUT-501/frames/messenger/allow-list/limits
-   [x] P5.2 Jest metahubs-backend: service create/delete, whitelist, MIME fix, manifest scripts + publication wiring
-   [x] P5.3 Vitest modules-engine: compileScriptAssetEsm + @shared
-   [x] P5.4 Vitest apps-template-mui: loader unit tests + widget updates + blob/import-map integration test
-   [x] P5.5 Playwright: assets-panel flow spec, baseline-trace spec, generator updates, runtime proof `scriptsLoaded`
-   [x] P5.6 Docs screenshots EN/RU

### Phase 6 — Docs + hygiene

-   [x] P6.1 GitBook page `platform/playcanvas-editor-assets.md` EN/RU + SUMMARY entries + shared-modules/module-scopes updates
-   [x] P6.2 READMEs: editor-backend (EN/RU scope), apps-template-mui, metahubs-frontend, modules-engine
-   [x] P6.3 Stale v2.24.2→v2.30.4 (frontend README, 2 skills) + engineVersions 2.21.3→2.21.4 sync
-   [x] P6.4 memory-bank progress/tasks updates

### Phase 7 — QA remediation and acceptance closure (2026-08-27)

-   [x] P7.1 Restore the exact EN/RU module i18n namespace merge and align the merged-scope browser flow with the `Shared modules` tab.
-   [x] P7.2 Remove production legacy MMOOMM fallback logic and duplicate built-in sources; generate or verify a single source of truth for script assets.
-   [x] P7.3 Align and enforce the published script host bridge contract, including script inheritance, duplicate-name, and entity-attachment validation.
-   [x] P7.4 Make editor asset paths and IDs safe and stable: validate every asset name/path, cascade folder moves, reject cycles, preserve numeric document IDs, and map duplicate conflicts to localized 409 responses.
-   [x] P7.5 Close file/artifact race and drift paths: checksum-guarded rollback, artifact cleanup after database failure, and fail-closed ETag handling.
-   [x] P7.6 Remove browser exposure of absolute storage paths and add production CodeMirror accessible naming.
-   [x] P7.7 Add immutable pre-extraction runtime baseline comparison and complete asset-type, role/origin/CSRF, responsive, keyboard, and settled screenshot E2E coverage.
-   [x] P7.8 Run formatting, package lint/build, focused/full tests, minimal-Supabase Playwright flows, drift checks, and final review; update progress and mark all tasks complete.

### Phase 8 — Post-QA implementation closure (2026-08-28)

-   [x] P8.1 Security logging: redact credentials, CSRF/access tokens, PII and raw source/file payloads from request logs; add regression tests.
-   [x] P8.2 Fetch compatibility: preserve `Request` method, body, headers and abort signal when rewriting Editor asset URLs; add POST/PUT/DELETE tests.
-   [x] P8.3 CSRF contract: make the full-boot editor mutation proof explicit, fail closed, and cover the chosen token/CSRF model with security tests.
-   [x] P8.4 Browser asset flow: remove internal Editor state mutations, add all required asset types, nested folders, content editing, RU and 1920/768/390 coverage with leakage/overflow/error oracles.
-   [x] P8.5 Runtime parity: generate a non-idle pre-extraction motion/camera baseline and compare timestamps, trajectory, camera pitch, guard clearance, source and bindings strictly.
-   [x] P8.6 Visual acceptance: add dedicated `ru-light`/`ru-dark` Playwright visual specs and robust screenshot dimensions/provenance/drift checks.
-   [x] P8.7 Runtime UX: localize Visual Lab family labels, use safe localized enum fallbacks, and protect multiline module descriptions with real integration tests.
-   [x] P8.8 Hygiene: remove stale fixture codenames/docs, make fixture drift deterministic, eliminate test cwd fragility and document/dedupe shared flight math.
-   [x] P8.9 Verification: run package/full builds, lint, Prettier, focused/full tests, minimal-Supabase E2E, contract/drift checks, OntoIndex diff verification and Thermos review.

### Phase 9 — QA findings remediation (2026-08-29)

-   [x] P9.1 Normalize metahub copy access roles so a copied source owner becomes an admin; add a regression test with a source owner different from the copier.
-   [x] P9.2 Align the runtime host bridge with the realtime readiness contract: start script runtime only after realtime authorization, or implement a bounded early-intent queue; add ordering and pre-connect intent tests.
-   [x] P9.3 Make optimistic-version semantics consistent for all PlayCanvas upserts; preserve the documented optional/required contract and add unversioned-update and stale-version tests.
-   [x] P9.4 Validate and remap every local snapshot file path through the safe-path and provider checks, including missing-file references; add traversal tests for assets, scenes, sourcefiles, and generated artifacts.
-   [x] P9.5 Buffer or reject ShareDB frames received during asynchronous authentication/setup until the stream is listening; add a concurrent handshake regression test.
-   [x] P9.6 Add browser-level RBAC/IDOR coverage for asset create/read/rename/delete/file access and unauthorized ShareDB mutations; clarify copy/clone scope and content-view acceptance.
-   [x] P9.7 Re-run focused/full verification, minimal-Supabase Playwright editor and runtime flows, package lint/build/Prettier, fixture contract/drift, and an independent review in a writable environment.

### Phase 10 — Strict QA debt closure (2026-08-29)

-   [x] P10.1 Split the PlayCanvas project persistence boundary into focused services/stores while preserving the existing DbExecutor, transaction, optimistic-lock, rollback, and realtime contracts.
-   [x] P10.2 Split the editor compatibility routes/realtime implementation into focused modules without changing the vendored protocol or security gates.
-   [x] P10.3 Centralize PlayCanvas runtime-manifest canonicalization/checksum logic and add producer/consumer parity coverage.
-   [x] P10.4 Reduce `PlayCanvasCanvasWidget.tsx` below the documented ~1200-line decomposition target using focused runtime hooks/modules; preserve browser behavior and accessibility.
-   [x] P10.5 Add direct multi-worker topology guard tests for single-worker, missing worker-id, and distinct-worker ownership cases.
-   [x] P10.6 Document newly exported public contracts with JSDoc and add browser asset-type matrix coverage for the supported text/data asset menu.
-   [x] P10.7 Run focused/full builds, lint, Prettier, Vitest/Jest, minimal-Supabase Playwright flows, fixture/docs/drift checks, OntoIndex diff verification, and independent Thermos reviews; update progress and close the phase.

## Notes / Decisions Log

-   2026-08-25 IMPLEMENT session 1: Phases 0, 1, 2, 4 and P3.1+P3.2 implemented and verified (editor-backend 60✓, metahubs-backend playcanvas 212✓, modules-engine 22✓, widget 43✓, modules-frontend 26✓ incl. new MetahubModulesSurface 2✓; lint clean in all touched packages; zero new tsc errors vs baseline).
-   2026-08-26 P6 documentation pass: added the EN/RU PlayCanvas Editor asset and script-asset GitBook page, synchronized navigation and module-scope guidance, refreshed the affected package READMEs, and reconciled active PlayCanvas Editor skill/version references. `pnpm docs:i18n:check` (112 EN/RU pairs) and `pnpm docs:gitbook-screenshot-assets:check` passed.
-   Create route returns upstream shape `{id}` (deliberate envelope deviation — vendor reads only `result.id`).
-   Folder document ids: `hashToPositiveInt('key:folder:<projectId>:<path>')` matching the batch resolver's `metadata.editorDocumentKey` scheme; row PKs stay `generateUuidV7()`.
-   Realtime: dynamic asset grants registry (`grantRealtimeAssetDocuments`, scope `metahubId:projectId`) + messenger socket registry (`sendMessengerEvent`); `fs{op:'delete'}` → `documentPort.deleteAssets`; `pipeline{script-attributes}` → ShareDB ops + `scriptAttrsFinished:<guid>` push; script-asset rows mirrored on persist (`editor-script-<hash>` ids, kind from `.mjs` extension).
-   Bridge: `resolveEditorAssetCompatibilityUrl` rewrite table (POST/DELETE/PUT/file-GET/unknown→`/-unsupported`); CSRF header from pre-warmed `marker.compatibilityCsrfToken`; artifact template literals require DOUBLE-escaped regexes (`\/` → `\/` in output) and NO nested backticks — two syntax bugs caught by artifact contract tests.
-   Import map: `universoImportMapPlugin` (core-frontend vite) + `ensure-playcanvas-esm.mjs` predev/prebuild copy (playcanvas@2.21.4 `build/playcanvas.mjs`, gitignored, version-marker cache).
-   Runtime loader: `playcanvasScriptAssets.ts` (fetch data-URL → hex sha-256 verify vs `artifactHash` → blob import → `app.scripts.add`); `scriptsLoaded` dataset marker: 'true'|'none'|'failed'; host bridge `app.__universoHost` = frozen `{moveToTarget, pickAt}`.
-   Publication wiring: `persistEditorRealtimeDocument` mirrors parsed scripts into `_mhb_playcanvas_script_assets`; `ensureGeneratedScriptArtifacts` (publish pre-step) compiles sources via `compileScriptAssetEsm` (with metahub `@shared` libraries from `MetahubModulesService.listSharedLibraryCompilationInputs`) → `_mhb_playcanvas_generated_artifacts` + manifest `scripts[]`.
-   Extraction (P3.1/3.2): canonical Editor-authored `.mjs` script assets (`flight-control.mjs`, `follow-camera.mjs`, `remote-ships.mjs`) plus the `libraries/flight-math.ts` shared module in metahubs-backend; the fixture generator reads these files directly when authoring the project, manifest scripts override builtins by scriptName, and the widget retains only generic runtime/bridge orchestration.
-   2026-08-27 completion: generated the canonical MMOOMM fixture through the real Editor authoring flow on minimal local Supabase; contract and drift checks passed; imported runtime and dedicated baseline/movement parity E2E both passed (2/2 each). Asset CRUD browser flow passed (2/2), including create, raw file read, ShareDB rename, and UUID-cast delete regression. Editor-backend Vitest (9 targeted tests), metahubs-backend Jest (172 targeted tests), modules-engine Vitest (30 tests), apps-template Vitest (55 tests), Editor artifact tests (15 tests), docs screenshot generator (2/2), and package lint/build checks passed. P6.3 engine configuration now uses runtime engine `2.21.4`; no schema or template version was bumped.
-   2026-08-27 hardening follow-up: script-asset compilation now rejects relative and absolute filesystem imports and resolves source text from an isolated virtual directory; generated-artifact reuse is checksum-aware and guarded by a publication advisory lock; runtime manifest selection ignores stale artifacts. Compatibility asset deletion now removes files with checksum/version preconditions and restores them on a rolled-back transaction; file renames lock both paths and use atomic no-clobber hard links. DELETE payloads are bounded, strict, unique, and the process-local realtime asset grant registry evicts deleted ids. Targeted metahubs PlayCanvas Jest (222/222), editor-backend Vitest full suite (72/72), modules-engine compiler tests (33/33), and file-service rename/rollback regressions passed.
-   2026-08-28 QA remediation closure: completed P7.1–P7.8. Added commit-before-response handling for request-scoped RLS transactions, deterministic ShareDB seed serialization for static and dynamic asset grants, rollback cleanup for files/artifacts written before a failed database transaction, cross-platform traversal rejection for package artifacts, and one bounded reload recovery for a cold `/a/<applicationId>` shell in the runtime oracle. Regenerated the canonical fixture from the real Editor flow (2/2), then verified fixture contract and drift, imported MMOOMM runtime (2/2 in 11.0 minutes), full workspace build (36/36), Editor build, focused package suites, package/E2E lint, Prettier, vendor drift, docs checks, and `git diff --check`. No schema or metahub template version was bumped; the advisory autoreview remains unavailable because the environment's Codex state database is read-only.
-   2026-08-29 production-shell closure: strict static routing now returns the SPA document only for document navigations and returns an empty 404 for missing hashed assets. The remaining white page was traced with Chromium to the generated development Supabase profile omitting `CORS_ORIGINS`; browser asset requests therefore failed with `500 Not allowed by CORS` while headerless curl requests appeared healthy. Local profile generation now emits only `http://127.0.0.1:<port>` and `http://localhost:<port>`, and the doctor fails closed if either is missing or a wildcard is present. The regenerated profile passed doctor, real HTML/JS/CSS response checks, stale-asset 404, and a rendered Playwright Chromium shell.
-   2026-08-29 post-QA remediation: copied source owners are demoted to admins while the copier remains the sole owner; runtime script startup waits for realtime setup and published script artifacts; all PlayCanvas upserts honor the same optional optimistic-version contract; snapshot scene, asset, source-file, and generated-artifact references validate provider, root, project namespace, and traversal even when files are missing; ShareDB handshakes use bounded buffering; browser RBAC covers asset create/read/rename/delete/file access, cross-project IDOR, and unauthorized realtime mutation; compatibility errors no longer echo PlayCanvas identifiers. Focused suites, minimal-Supabase Playwright flows, fixture contract/drift, builds, lint, Prettier, and diff checks passed. Thermos autoreview remained unavailable because the Codex state database is read-only.
-   2026-08-29 strict QA debt closure: split PlayCanvas project services/stores, compatibility routes, and realtime runtime modules while preserving public contracts; centralized runtime-manifest canonicalization/checksum logic; reduced `PlayCanvasCanvasWidget.tsx` to 888 lines; added topology guards and public-contract JSDoc; and expanded the browser asset flow to exercise Folder/CSS/CubeMap/HTML/JSON/Material/Script/Shader/Text creation. Fresh E2E build plus minimal Supabase target flow passed 2/2. Full workspace build passed 36/36; editor-backend Vitest 113/113; focused metahubs-backend Jest 188; modules-engine 35; apps-template 73; metahubs-frontend 30; Editor artifact 16; applications manifest 4; static checks, package lint, Prettier, fixture/docs/drift, and `gn_verify_diff` all passed. The local autoreview helper could not start because `/home/vladimir/.codex/state_5.sqlite` is read-only; no product findings were emitted.
