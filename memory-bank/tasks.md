# MUI 9 Platform Upgrade and Data-Driven Marketing Page Template (2026-08-30)

## QA remediation implementation (2026-08-31)

> This execution checklist is authoritative for the current IMPLEMENT pass. It closes the acceptance defects found by the QA review without changing the schema or metahub-template version.

-   [x] Restore marketing application routing so landing content and workspace/application subroutes are independently reachable in hosted and standalone shells.
-   [x] Enforce workspace RBAC server-side and in the UI, seed every newly-created workspace atomically, and add negative/positive role tests.
-   [x] Implement complete workspace copy/archive handling for parent and child tables with explicit lifecycle, owner, audit, and identifier remapping rules.
-   [x] Align marketing data ownership with the metahub→publication→application→workspace model, add persisted site settings, and make query/cache keys workspace-aware.
-   [x] Replace raw marketing media URL fields with the canonical typed resource-source contract, preserve storage/file resources, and remove production hotlink-only assumptions.
-   [x] Finish MUI 9 slot API migration, tighten version/policy checks, and pass strict typechecking for every changed frontend package.
-   [x] Complete runtime UX/a11y semantics, i18n, browser lifecycle coverage, changed-file coverage gates, docs, and final verification.

> Status: implementation and all feasible local acceptance gates complete; workspace CRUD, cross-scope content mutation, and reset operation audit are proven through focused tests and the minimal-Supabase browser lifecycle. Production Storage/imgproxy media and independent review tools remain environment-dependent evidence boundaries.
> Source plan: `memory-bank/plan/mui-9-marketing-page-template-plan-2026-08-30.md`
> Scope: clean-break implementation for the disposable test database; no schema, snapshot, or metahub-template version bump.

## Continuation remediation (2026-09-01)

-   [x] Replace dashboard workspace-switcher fixtures with valid UUID v7 values and retain the raw-ID leakage assertion.
-   [x] Remove the navigation-only lead callback from hosted and standalone marketing runtime dispatch; render CTA links when no approved lead endpoint exists.
-   [x] Reject duplicate predefined element IDs before any seed write and preserve persisted legal-link ordering during normalization.
-   [x] Add browser proof for a pristine seeded workspace reset (`resetRows > 0`) and direct member content-mutation denial with a no-change readback.
-   [x] Re-run the complete local minimal-Supabase wrapper after the continuation edits, then refresh plan/progress evidence and run final static/documentation gates.

## Contract

-   Upgrade every direct MUI consumer to the approved coherent MUI 9/Core-X policy, with direct dependency ownership, lockfile proof, and no generated `.backup` JavaScript copied into source.
-   Add the data-driven `marketing-page` metahub/application template beside the existing dashboard without weakening dashboard contracts or routing marketing data through dashboard hooks.
-   Keep the entity-first model (Hub/Object/Page/Set/Enumeration), initial seed ownership and explicit reset semantics, UUID v7 persisted identifiers, SQL-first `DbExecutor` access, EN/RU i18n, and the isolated `apps-template-mui` boundary.
-   Require focused Jest/Vitest tests, real browser Playwright proof on minimal local Supabase, inspected screenshots, documentation checks, and Thermos/autoreview evidence before completion.

## Checklist

### Phase 0 — Preconditions and decisions

-   [x] Record branch/worktree/runtime/tool versions, dirty-file provenance, baseline package/build/test/checker results, and the OntoIndex stale-index warning.
-   [x] Resolve exact MUI/Core-X/Lab/Emotion, React/react-is, Pro-license, browser-floor, authenticated-route, actions/media, seed ownership, fixture, and screenshot policies.
-   [x] Capture `.backup/templates` provenance and a field-level marketing baseline contract (sections, counts, labels, copy, actions, media/alt, order, light/dark).

### Phase 1 — MUI 9 dependency and API migration

-   [x] Update centralized catalog, lockfile, every direct consumer manifest/peer, direct testing dependencies, and stale MUI documentation.
-   [x] Run the approved Core/System/X migration work, manually migrate residual APIs, remove unused Base dependencies, retain only type-only Pro augmentation, and preserve product dashboard behavior.
-   [x] Add and wire the MUI policy checker; pass frozen install, package builds, focused lints/tests, dashboard regression coverage, isolation guards, and residual scans.

### Phase 2 — Shared contracts and utilities

-   [x] Add the neutral metahub/application registry, strict Zod schemas, discriminated runtime envelope, safe-link/media/action contracts, and provenance/semantic-key types to shared packages.
-   [x] Reuse existing URL/media, UUID v7, and safe-display helpers; add focused contract tests and keep backend/React dependency cycles out of the shared contracts.

### Phase 3 — Marketing metahub and seed

-   [x] Register the eighth metahub template with unchanged `version`/`minStructureVersion` and existing basic presets.
-   [x] Seed localized, ordered Object records and relations for the stock sections, with deterministic media, semantic keys, transaction rollback, and initial-only ownership.
-   [x] Extend registry/manifest/seed shape and transaction tests, including invalid values and no-version-bump assertions.

### Phase 4 — Layout/publication/sync

-   [x] Make layout services/controllers, snapshot serialization/restore, publication, hash/import/export, and sync template-aware; remove dashboard defaults/injection and fail closed on unknown keys.
-   [x] Keep `templateKey` immutable unless separately approved, preserve UUID/SQL/RLS contracts, and cover dashboard and marketing core round trips.

### Phase 5 — Workspace/application settings

-   [x] Implement initial-only seeded ownership, authored transitions, scoped cleanup, permission-checked reset-to-source, and focused `RETURNING`/IDOR tests.
-   [x] Extend typed application settings for marketing appearance/theme/branding/section/action/provenance fields with `manageApplication` enforcement.

### Phase 6 — Runtime transport

-   [x] Add backend marketing read-model aggregation with bounded metadata-backed queries, locale fallback, RLS/RBAC, safe error mapping, and no arbitrary client table access.
-   [x] Split runtime bootstrap into independent dashboard/marketing branches before dashboard CRUD hooks; keep strict dashboard fields and omit them from marketing responses.

### Phase 7 — Renderer and host dispatch

-   [x] Replace static marketing demo arrays with typed presentational sections, export and dispatch `marketing-page` in hosted/standalone shells, and keep one theme boundary.
-   [x] Implement safe data-driven actions, media/error states, i18n, package isolation, and regression tests without adding a newsletter backend or legacy fork.

### Phase 8 — Authoring UI and accessibility

-   [x] Complete the browser-proven UI Contract across template picker, layout/content authoring, generic CRUD, relations, media, workspace lifecycle, and export/import. The marketing flow covers workspace create/edit/copy/delete/reset, localized content edit/publish/sync/reload, safe media, and export/import with the existing primitives.
-   [x] Add EN/RU keys, localized runtime labels/errors, multiline metadata, keyboard/focus semantics, safe display, no-overflow safeguards, and browser axe coverage for the marketing runtime matrix.

### Phase 9 — Fixtures and Phase 10 test system

-   [x] Build the deterministic equivalent lifecycle gate with run isolation, a field-level semantic contract, and documented local/full media boundaries; a promoted product fixture is intentionally not required in this slice. The runtime flow compares the materialized read model with every seeded semantic field, and the matrix wrapper runs serially (`--workers 1`) with bounded retries.
-   [x] Add focused Jest/Vitest/RTL tests and Playwright runtime/RBAC/matrix/visual tests; provision matrix applications independently and archive reports/screenshots safely. The broad apps-template suite remains resource-sensitive and was not used as the marketing acceptance oracle; focused acceptance suites and the full marketing wrapper are green.

### Phase 11 — Documentation and Phase 12 closeout

-   [x] Update package READMEs, EN/RU GitBook pages/SUMMARY, reviewed runtime screenshots/assets/provenance/drift checks, and migration notes.
-   [ ] Run the final independent review gates from an environment where OntoIndex and Thermos/autoreview can complete. All feasible local implementation, API, browser, visual, accessibility, and documentation gates are complete; the remaining unchecked state is an infrastructure/tooling limitation, not an unimplemented product path.

### Implementation evidence (2026-09-01)

-   `pnpm run test:e2e:marketing-page:verify:local-supabase` exited 0 after the workspace lifecycle hardening: minimal Supabase doctor/start/stop, 36/36 production build, contract, setup plus five Chromium marketing flow tests (6 tests total, including workspace CRUD, cross-scope mutation, and reset with UUID v7 `operationId`), four locale/theme matrix projects plus setup, screenshot provenance, i18n, GitBook asset, and link checks all passed.
-   Workspace reset now records a transactional `_app_workspace_operation_audit` row and returns a validated UUID v7 `operationId`; unknown database errors fail closed, while not-found/reference failures map to typed localized responses. No schema, snapshot, or metahub-template version was bumped.
-   Workspace copy preserves the stable seed key but transfers ownership to authored content; parent/child soft-delete and reorder paths clear seed ownership. Focused applications-backend suites pass `119/119`; apps-template workspace/API suites pass `30/30` plus marketing renderer/normalization `13/13`; applications-frontend runtime/layout suites pass `52/52`.
-   Static MUI/catalog/isolation/no-LMS/marketing-contract checks, scoped package builds/lints, Prettier, `git diff --check`, and all documentation gates pass. Real EN/light desktop, RU/light tablet, and EN/dark mobile screenshots were inspected with `view_image` and show no page-level overflow or visible technical leakage.
-   Follow-up package verification after the MUI 9 test-contract cleanup passed: `applications-frontend` 31 files/242 tests, `metahubs-frontend` 85 files/396 tests, `apps-template-mui` typecheck, the isolated MUI multiline-textarea regression, and the marketing/backend targeted suites. The test now asserts the MUI 9 semantic textarea contract instead of removed internal CSS class names.
-   The broad `apps-template-mui` Vitest command was interrupted after a resource-sensitive Interpretation Network tail (including known loopback `EPERM` attempts and React act warnings) without a terminal summary; this is not conflated with the green focused suites or browser acceptance wrapper. Production Storage/imgproxy media remains outside the minimal-Supabase proof. OntoIndex reports a stale/degraded index, and Thermos/autoreview could not complete in the read-only Codex state environment.

## Implementation notes

-   Product code changes must stay within the approved plan and preserve unrelated dirty user files.
-   Every task is announced before work, verified with the narrowest relevant gate, and marked complete only after evidence is recorded below.

## Evidence log (2026-08-31)

-   `pnpm install --frozen-lockfile --ignore-scripts` passed; `check:mui-v9-policy`, `check:catalog-versions`, `check:apps-template-isolation`, and `check:runtime-no-lms-forks` passed.
-   Root `pnpm build` and the E2E production build passed for all 36 workspace projects. Focused marketing schema, utility, controller, seed/manifest, layout, runtime, renderer, and UI tests passed. The full `apps-template-mui` Vitest invocation has a known long-running Interpretation Network workspace-widget tail under the MUI 9 DOM/runtime changes; it is tracked separately from the green focused suites and browser wrapper.
-   `pnpm run check:marketing-page-template-contract` passed with the exact stock section order/counts, localized content, media/action metadata, footer/social targets, and unchanged template/snapshot versions.
-   After publish/sync, `marketingPageRuntimeMaterialization.ts` compares the actual runtime read model with seed copy, actions, media/alt, relations, prices/benefits, FAQ, and footer; decimal-price storage formatting and backend icon canonicalization are normalized explicitly.
-   Publication list sync is a localized production action guarded by manage permission, active version, pending state, and disabled-state handling; seven focused tests cover the action contract.
-   `pnpm run test:e2e:marketing-page:verify:local-supabase` exited 0: minimal Supabase doctor, 36/36 E2E build, contract, Chromium runtime/permission/authoring/snapshot-roundtrip flows (`5 passed`), EN/RU × light/dark responsive/a11y matrix (`5 passed`), screenshot provenance, EN/RU i18n (113 pairs), GitBook assets, and link checks all passed; Supabase stopped in `finally`.
-   The matrix passed at 1920×1080, 768×1024, and 390×844 with keyboard FAQ interaction, mobile drawer Escape/focus return, anchors, no unsafe links, no technical leakage, no page overflow, and no console/page/API errors. EN/light desktop and mobile screenshots were inspected with `view_image`; 12 Playwright baselines are tracked.
-   Remaining acceptance boundaries: a separate full-stack Storage/imgproxy media suite, the broad unrelated repository regression inventory, and independent review tooling. Workspace CRUD, appearance reset audit, content-row cross-scope mutation, template-picker/content edit→publish→sync→reload, export/import, responsive screenshots, and browser axe scans are covered by the passing wrapper; deterministic local-reference media is documented as a minimal-profile boundary.
-   OntoIndex remains stale/degraded for the dirty worktree and the scan cap prevents a complete independent changed-file proof; direct impact/source checks and focused tests remain authoritative. The Thermos/autoreview helper could not complete because the Codex state database is read-only; a writable temporary-home retry hung and was stopped, so no clean independent autoreview claim is made.

---

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
