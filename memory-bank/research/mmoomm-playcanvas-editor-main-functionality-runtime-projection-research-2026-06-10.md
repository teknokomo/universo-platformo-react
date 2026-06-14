# Research: MMOOMM PlayCanvas Editor Main Functionality and Runtime Projection

> Created: 2026-06-10
> Status: QA-updated
> Trigger: `RESEARCH` request to validate the local manager-only MMOOMM PlayCanvas runtime projection brief dated 2026-06-09
> QA updated: 2026-06-10
> Follow-up plan: TBD

## Research Question

What is currently true about the repository and upstream PlayCanvas/Colyseus/Playwright capabilities, and what does that imply for planning the next work toward:

-   a Universo-hosted PlayCanvas Editor implementation that works across the main user-facing Editor functionality, excluding optional commercial/cloud extras such as marketplace, billing, and account/team administration; and
-   a browser-first Playwright product scenario that authors the canonical Universo MMOOMM configuration through the platform UI and PlayCanvas Editor, then exports `tools/fixtures/metahubs-mmoomm-app-snapshot.json` from published browser-authored state.

This research supports the next PLAN. It does not implement code or split the work into final implementation tasks.

## Source Inventory

| Source                                                                                                                            | Type                           | Date / Freshness                        | Why It Matters                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local manager-only MMOOMM PlayCanvas runtime projection brief                                                                     | Local brief                    | 2026-06-09                              | Defines the current target brief and acceptance boundary.                                                                                                                                                               |
| Local manager-only MMOOMM PlayCanvas runtime projection source input                                                              | Local source TZ                | 2026-06-09                              | Contains the original Russian goal and warns that prior research may over-map PlayCanvas concepts onto metahub entities.                                                                                                |
| `.backup/Копия-PlayCanvas-Editor-для-Universo-MMOOMM.md`                                                                          | Prior external research output | 2026-06-08 per embedded source list     | Useful capability inventory, but includes some over-aggressive domain mappings.                                                                                                                                         |
| `.backup/Разработка-PlayCanvas-Editor-для-Universo-MMOOMM.md`                                                                     | Prior external research output | 2026-06-08 per embedded source list     | Useful backend/realtime/asset guidance, but recommends browser security bypasses and blanket PlayCanvas-to-Platformo mappings that should not be accepted uncritically.                                                 |
| `docs/en/platform/playcanvas-editor.md`                                                                                           | Local product docs             | Current repository state                | Documents the authoring-only Editor package, iframe/origin guardrails, typed bridge, full-upstream UI boot checks, and current non-parity scope.                                                                        |
| `docs/en/platform/playcanvas-projects.md`                                                                                         | Local product docs             | Current repository state                | Documents metahub PlayCanvas project storage, Resources UI, adapter endpoints, snapshot/copy behavior, and runtime manifest publication.                                                                                |
| `docs/en/guides/mmoomm-flight-simulator.md`                                                                                       | Local product docs             | Current repository state                | Defines the current MMOOMM flight fixture intent, attached packages, runtime widget, authoritative Colyseus ownership, and reconnect behavior.                                                                          |
| `packages/universo-react-playcanvas-editor-frontend/README.md`                                                                    | Local package docs             | Current repository state                | States the vendored Editor version, artifact boundary, full-upstream UI mode, origin isolation requirements, and current non-runtime scope.                                                                             |
| `packages/universo-react-playcanvas-editor-backend/README.md`                                                                     | Local package docs             | Current repository state                | States the compatibility backend scope and explicit exclusions: Cloud parity, multi-user collaboration, durable ShareDB op history, broad binary asset pipeline.                                                        |
| `packages/universo-react-metahubs-frontend/README.md`                                                                             | Local package docs             | Current repository state                | Defines the current metahub route contract: entity-owned authoring routes and `/resources`, not revived top-level legacy kind routes.                                                                                   |
| `packages/universo-react-metahubs-backend/README.md` and `packages/universo-react-applications-backend/README.md`                 | Local package docs             | Current repository state                | Reinforce SQL-first domain storage, `DbExecutor`, DDL boundaries, parameterized SQL, and fail-closed mutations.                                                                                                         |
| `packages/universo-react-apps-template-mui/README.md`                                                                             | Local runtime package docs     | Current repository state                | Confirms published runtime must use the `apps-template-mui` data-driven dashboard package without depending on the legacy template package.                                                                             |
| `packages/universo-react-types/src/common/playcanvasProjects.ts`                                                                  | Local shared contract          | Current repository state                | Defines PlayCanvas project, scene, asset, script, binding, generated-artifact, and runtime manifest schemas; also exposes the current JSON/JS/MJS file limit.                                                           |
| `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts`                                                       | Local shared contract          | Current repository state                | Shows the current full-boot/minimal compatibility descriptors, stubbed cloud-only surfaces, ShareDB persistence mode, and unsupported code-editor sourcefiles.                                                          |
| `packages/universo-react-types/src/common/playcanvasEditorBridge.ts`                                                              | Local shared contract          | Current repository state                | Shows the current typed bridge command set and bounded scene payload model.                                                                                                                                             |
| `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/`                                                       | Local backend implementation   | Current repository state                | Owns metahub PlayCanvas project storage, editor bridge sessions, compatibility adapter, file storage, and project routes.                                                                                               |
| `packages/universo-react-applications-backend/src/routes/sync/syncPlayCanvasPersistence.ts`                                       | Local runtime publication sync | Current repository state                | Persists normalized `PlayCanvasRuntimeManifest` rows to `_app_playcanvas_manifests` and validates manifest checksums.                                                                                                   |
| `packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts` and `__tests__/publicationSnapshotHash.test.ts`      | Local publication hashing      | Current repository state                | Proves PlayCanvas projects, runtime manifests, generated artifacts, project file payloads, and script bindings participate in canonical publication hashing.                                                            |
| `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx`                                   | Local runtime UI               | Current repository state                | Current published runtime surface for PlayCanvas + Colyseus flight behavior.                                                                                                                                            |
| `packages/universo-react-metahubs-frontend/src/domains/modules/ui/EntityModulesTab.tsx`                                           | Local authoring UI             | Current repository state                | Existing UI for entity-attached modules, roles, capabilities, inline/file-backed source mode, localized validation, and stable test ids.                                                                                |
| `tools/testing/e2e/specs/flows/metahub-packages-resources.spec.ts`                                                                | Local E2E flow                 | Current repository state                | Existing browser evidence for Resources -> Packages, PlayCanvas package settings, project creation/selection, embedded/open-separately Editor iframe, conflict/dirty states, screenshots, EN/RU, and responsive checks. |
| `tools/testing/e2e/specs/generators/metahubs-mmoomm-flight-app-export.spec.ts`                                                    | Local E2E generator            | Current repository state                | Generates the existing MMOOMM flight fixture API-first, bypassing the PlayCanvas Editor and most UI authoring surfaces.                                                                                                 |
| `tools/testing/e2e/specs/flows/snapshot-import-mmoomm-flight-runtime.spec.ts`                                                     | Local E2E runtime flow         | Current repository state                | Strong existing runtime oracle for imported fixture, PlayCanvas canvas, multi-client Colyseus behavior, reconnect, localization, and no technical leakage.                                                              |
| `tools/testing/e2e/support/mmoommFlightFixtureContract.ts`                                                                        | Local fixture contract         | Current repository state                | Defines the existing `metahubs-mmoomm-flight-app-snapshot.json` contract and hard-coded fixture naming.                                                                                                                 |
| `packages/universo-react-playcanvas-editor-frontend/e2e/editor-artifact.spec.ts`                                                  | Local Editor artifact E2E      | Current repository state                | Verifies artifact shell security/nonblank/sandbox basics, but not full authoring workflows.                                                                                                                             |
| `AGENTS.md` and `memory-bank/techContext.md`                                                                                      | Local repository rules         | Current repository state                | Define RESEARCH/quality gates, DB/DDL rules, root build propagation, UUID v7 baseline, Thermos/autoreview expectations, and `apps-template-mui` migration direction.                                                    |
| [PlayCanvas Editor product page](https://playcanvas.com/products/editor)                                                          | Primary product source         | Opened 2026-06-10                       | Lists user-facing Editor features: collaboration, asset import, hot reload, templates, one-click publishing, asset store, version control, chat, REST/API automation.                                                   |
| [PlayCanvas Editor Workflow](https://developer.playcanvas.com/user-manual/editor/getting-started/workflow/)                       | Primary documentation          | Opened 2026-06-10                       | Defines the core workflow: assets, scene construction, scripting, and publishing/download.                                                                                                                              |
| [PlayCanvas Assets Panel](https://developer.playcanvas.com/user-manual/editor/assets/asset-panel/)                                | Primary documentation          | Opened 2026-06-10                       | Defines assets panel expectations: create/upload/delete/inspect/edit, folders, filtering/search, drag/drop, text-asset editing, dependency behavior.                                                                    |
| [PlayCanvas Code Editor](https://developer.playcanvas.com/user-manual/editor/scripting/code-editor/)                              | Primary documentation          | Opened 2026-06-10                       | Defines Monaco-based collaborative code editor behavior and the important save/revert nuance for text assets.                                                                                                           |
| [PlayCanvas Real-time Collaboration](https://developer.playcanvas.com/user-manual/editor/realtime-collaboration/)                 | Primary documentation          | Opened 2026-06-10                       | Defines presence, chat, viewport cameras, and selection indicators as main collaboration surfaces.                                                                                                                      |
| [PlayCanvas Version Control](https://developer.playcanvas.com/user-manual/editor/version-control/)                                | Primary documentation          | Opened 2026-06-10                       | Defines checkpoints, branches, merges, conflicts, and item history as built-in Editor VCS behavior.                                                                                                                     |
| [PlayCanvas Backup and Export](https://developer.playcanvas.com/user-manual/editor/projects/backup-and-export/)                   | Primary documentation          | Opened 2026-06-10                       | Confirms project export/backup behavior and branch/history limitations of exported projects.                                                                                                                            |
| [PlayCanvas Editor frontend open-source announcement](https://blog.playcanvas.com/playcanvas-editor-frontend-is-now-open-source/) | Primary vendor blog            | Published 2025-07-30, opened 2026-06-10 | Confirms the Editor frontend is open source under MIT and describes the official frontend ecosystem foundations.                                                                                                        |
| [playcanvas/editor GitHub repository](https://github.com/playcanvas/editor)                                                       | Primary source repository      | Opened 2026-06-10                       | Confirms upstream Editor is a visual WebGL/WebGPU/WebXR authoring environment and uses Playwright for Editor UI/API tests.                                                                                              |
| Context7 `/playcanvas/engine` query                                                                                               | Primary code-doc aggregation   | Queried 2026-06-10                      | Confirms current Engine behavior for ESM script loading, script class registration, script attributes, and runtime lifecycle examples.                                                                                  |
| [Colyseus docs](https://docs.colyseus.io/) and Context7 `/colyseus/docs` query                                                    | Primary documentation          | Opened/queried 2026-06-10               | Confirms Colyseus as an authoritative multiplayer framework with rooms, synchronized Schema state, messages, and reconnect lifecycle.                                                                                   |
| [Playwright Frame docs](https://playwright.dev/docs/api/class-frame) and Context7 `/microsoft/playwright` query                   | Primary documentation          | Opened/queried 2026-06-10               | Confirms iframe testing through frame locators, locator-first style, and trace evidence expectations.                                                                                                                   |
| [Playwright network/WebSocket docs](https://playwright.dev/docs/network) and Context7 `/microsoft/playwright` query               | Primary documentation          | Opened/queried 2026-06-10               | Confirms `page.on('websocket')` and WebSocket frame/close event inspection are available for realtime E2E evidence.                                                                                                     |
| [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)                                                               | Primary documentation          | Opened 2026-06-10                       | Confirms trace artifacts as a debugging/evidence mechanism for CI and failing browser flows.                                                                                                                            |

## QA Update Summary

This QA pass found that the research was aligned with the brief's main direction but was not yet ready to feed PLAN safely. The missing pieces were mostly repository-specific:

-   it did not preserve the source TZ's explicit clean-test-DB/refactor freedom and "do not bump schema/template version" constraint;
-   it was too backend/capability-matrix oriented and did not force PLAN to start from the requested step-by-step browser product journey;
-   it under-described existing UI authoring paths and Playwright evidence already present in the repository;
-   it did not make publication hashing, application sync, script lifecycle, runtime cleanup, DB/DDL safeguards, package ownership, build propagation, and Thermos review gates explicit enough.

The sections below incorporate those corrections.

## Key Findings

### 1. The current brief is directionally aligned with the clarified user goal

The brief now states the right product target: main PlayCanvas Editor functionality first, then MMOOMM runtime projection and `metahubs-mmoomm-app-snapshot.json` generated from browser-authored state. It also correctly rejects two excessive mappings from prior research:

-   PlayCanvas Project should not be replaced by metahub Hub.
-   PlayCanvas Entity should not automatically become Platformo Object.

The better boundary is already present in the brief: PlayCanvas remains the design-time 3D authoring store, Platformo remains the metahub/domain model, and Colyseus remains authoritative runtime state owner. Explicit `metadata.mmoomm.*` bindings are the right integration vocabulary for MMOOMM semantics.

### 2. Current implementation is a strong foundation, not the requested final capability

The repository has more than a placeholder:

-   `@universo-react/playcanvas-editor-frontend` vendors upstream `playcanvas/editor` `v2.23.4`, defaults to `universo-full-upstream-ui`, and defines artifact-origin guardrails.
-   `@universo-react/playcanvas-editor-backend` provides config, signed compatibility tokens, scene/settings REST loops, limited assets shell, full-boot WebSocket endpoints, and ShareDB-compatible single-user snapshot persistence.
-   Metahub PlayCanvas storage exists for projects, scenes, assets, script assets, script bindings, generated artifacts, snapshot import/export, and publication runtime manifests.
-   Application sync can persist validated `PlayCanvasRuntimeManifest` rows to `_app_playcanvas_manifests`.

However, the local contracts and README files explicitly mark the missing pieces:

-   current realtime is snapshot-port persistence, not durable ShareDB operation history;
-   current collaboration is not full multi-user Editor collaboration;
-   current asset handling is limited and not a broad binary texture/model/audio import pipeline;
-   current code editor sourcefiles are marked unsupported in the compatibility protocol;
-   cloud-only surfaces such as jobs, sourcefiles, publishing, users/collaboration, asset pipeline, and branches/checkpoints are stubbed or no-op;
-   current local file rules allow only `application/json`, `text/javascript`, and `application/javascript` with a 5 MB limit.

Inference: the next PLAN must treat "full main Editor functionality" as a capability-matrix target, not as a small extension of the existing scene save path. That matrix is still secondary to the product journey: it should explain which backend/frontend capabilities are needed for each user-visible step, not replace the browser-first scenario with a backend endpoint checklist.

### 3. "Main Editor functionality" has a concrete upstream shape

Upstream PlayCanvas describes a normal Editor workflow as:

-   create/upload assets;
-   construct scenes through entity/component hierarchy;
-   attach scripts for interactivity;
-   publish or download the application.

The user-facing product page and documentation also identify important main surfaces:

-   realtime collaboration;
-   asset import, filtering, folders, drag/drop, text asset editing, dependencies;
-   code editor with Monaco, collaboration, lint/autocomplete, tabs/files/status;
-   templates/prefabs;
-   hot reload;
-   version control with checkpoints, branches, merges, conflicts, and item history;
-   one-click publishing and export/download.

Optional extras can be excluded from the first product target if explicitly documented: asset store/marketplace, billing, hosted PlayCanvas account/team administration, commercial hosting/CDN parity, mobile/desktop/playable-ad packaging, and PlayCanvas account proxying.

### 4. Autosave must be modeled carefully

The prior research and user TZ ask whether PlayCanvas "just autosaves." The upstream documentation is nuanced:

-   Scene/property collaboration can feel live and continuously synchronized.
-   The Code Editor is collaborative, but text asset changes are not saved automatically; saved versions are what run, and users have save/revert semantics.

Planning implication: do not implement unconditional autosave for every document as "PlayCanvas parity." The likely target is:

-   scene/entity/component/settings persistence via realtime document sync and safe durable flushing;
-   text/script assets with explicit save/revert semantics compatible with upstream Code Editor;
-   dirty/conflict states that block unsafe publish/export.

### 5. The biggest functional gaps are asset pipeline, sourcefiles/code editor, durable realtime, and versioning

For normal PlayCanvas authoring, a scene-only JSON save is insufficient. The next PLAN must decide how to implement or phase:

-   binary uploads and import jobs for at least the first production asset set;
-   asset folders, metadata, dependencies, thumbnails/previews where upstream UI expects them;
-   text/sourcefile documents used by Code Editor;
-   script parsing and script attribute extraction;
-   generated `.js` / `.mjs` artifacts connected to metahub Modules or script assets;
-   ShareDB document persistence beyond single-user snapshots;
-   presence/chat/selection/camera collaboration surfaces;
-   checkpoints, branches, merge/conflict handling, and item history.

If PLAN phases these, the final acceptance target must remain explicit. A slice can be accepted as a milestone, but it should not claim the full brief is complete while these surfaces are still no-op/stubbed.

### 6. Existing PlayCanvas project storage is useful but currently too narrow for full Editor parity

`playcanvasProjects.ts` already models the right long-term concepts: project metadata, scenes, assets, script assets, scene-script bindings, generated artifacts, and runtime manifests. This is a good foundation for projection and snapshot transport.

The current constraints are intentionally narrow:

-   file provider currently allows local JSON/JS/MJS payloads;
-   S3 is represented as a future provider value, not implemented storage behavior;
-   binary asset types are modeled but not fully supported by the file/mime constraints;
-   project snapshots bundle small base64 files.

Planning implication: S3/admin provider configuration can remain a later slice only if the next work supplies a local provider path that is sufficient for Editor-authored main assets and the browser-first MMOOMM fixture. If normal project assets require large binaries, provider abstraction and snapshot policy must be revisited before the product flow is stable.

### 7. Existing MMOOMM fixture generation is API-first and cannot satisfy the new product-flow goal

`metahubs-mmoomm-flight-app-export.spec.ts` creates the current flight fixture by calling backend APIs for:

-   metahub creation;
-   package attachment;
-   Object/Set/Enumeration creation;
-   module source creation;
-   layout changes;
-   `playcanvasCanvas` widget scene config;
-   snapshot export and direct file write.

This is valuable as a deterministic generator, but it bypasses the user's requested route: real browser user opens the platform, creates a metahub, connects packages, authors through PlayCanvas Editor, publishes, verifies runtime, and exports the new fixture from browser-authored state.

Planning implication: the new `metahubs-mmoomm-app-snapshot.json` generator must not be a renamed version of the API-first generator. API usage may support authentication, cleanup, test users, or deterministic fixture export plumbing, but must not replace the user-facing authoring path for packages, PlayCanvas authoring, publish/open runtime, and fixture provenance.

The source TZ asks for an AI-agent instruction shape that starts from opening the Editor with a clean project and proceeds step by step through the main functionality. PLAN should therefore start with the product route:

1. open the platform in a clean E2E setup;
2. create a metahub through normal UI;
3. create or configure the required Platformo logic/modules where UI exists;
4. connect Colyseus and PlayCanvas packages through Resources -> Packages;
5. create/select a PlayCanvas project through the PlayCanvas package panel;
6. open the real upstream Editor iframe;
7. create the scene hierarchy, components, assets, scripts/sourcefiles, and MMOOMM metadata bindings through Editor-visible actions;
8. save/reopen and prove durable authoring state;
9. publish/sync to an application;
10. open the runtime and prove PlayCanvas + Colyseus behavior;
11. export the fixture from that browser-authored published state.

Only after this route is explicit should PLAN map the route to backend compatibility, storage, asset, code-editor, realtime, publication, and test-oracle work.

### 8. Existing browser UI paths already cover part of the requested flow

The repository is not starting from zero on user-facing authoring:

-   `metahub-packages-resources.spec.ts` already drives Resources -> Packages, connects/configures PlayCanvas Editor, creates/selects PlayCanvas projects, opens embedded and separate Editor hosts, checks `iframe[data-testid="playcanvas-editor-frame"]`, verifies upstream Editor DOM/canvas evidence, handles dirty/conflict states, and covers EN/RU plus responsive screenshots.
-   `docs/en/platform/playcanvas-projects.md` documents the same Resources UI as the supported way to list/create/select/delete PlayCanvas projects.
-   `EntityModulesTab.tsx` already exposes entity-attached modules, module roles, capabilities, inline/file-backed source mode, localized validation, and stable test ids such as `entity-modules-root` and `entity-modules-editor-shell`.
-   Existing PlayCanvas Editor tests already use iframe frame locators and upstream DOM evidence; the product flow should reuse those helpers instead of inventing a parallel selector strategy.

Gaps remain:

-   the current MMOOMM generator creates metahub entities, modules, layouts, and widget config through APIs, so PLAN must decide which of those steps now have adequate UI coverage and which UI helpers/test ids must be added;
-   layout/widget authoring for adding or configuring the `playcanvasCanvas` runtime widget needs a browser-first path or a clearly justified temporary API bridge if the UI genuinely does not exist yet;
-   the product fixture must keep provenance evidence tying the final JSON to the browser-authored/published state, not just to a deterministic backend export endpoint.

### 9. Existing runtime QA is strong and should be reused

`snapshot-import-mmoomm-flight-runtime.spec.ts` already verifies high-value runtime behavior:

-   UI snapshot import;
-   application creation and sync;
-   published runtime launch;
-   bounded nonblank PlayCanvas canvas;
-   no page overflow;
-   no raw technical leakage;
-   localized states;
-   unauthorized/read-only behavior;
-   multi-client Colyseus state sync;
-   movement, collision/guard behavior, prediction/interpolation evidence;
-   reconnect behavior.

This is stronger than the current fixture generator. The next PLAN should reuse or generalize this runtime oracle for the new product fixture rather than placing all authoring and runtime checks into one fragile mega-test.

### 10. Runtime projection must not import Editor internals

The published runtime currently uses `PlayCanvasCanvasWidget.tsx`, `@universo-react/playcanvas-engine`, `@universo-react/colyseus-client`, and runtime modules. It must not import PCUI, Observer, upstream Editor DOM state, or iframe bridge code.

The correct projection path is:

1. Editor authoring state persists in metahub PlayCanvas project storage.
2. Publish/export creates immutable `PlayCanvasRuntimeManifest` data and runtime assets.
3. Application sync persists `_app_playcanvas_manifests`.
4. Runtime widgets consume normalized manifest/config data, not mutable `playcanvas-projects/...` authoring paths.

The current runtime widget consumes `config.scene` objects directly. PLAN must decide whether to project the Editor-derived manifest into the existing `playcanvasCanvas` widget config, or evolve the widget/runtime manifest reader. A new widget schema should be introduced only if the existing widget cannot represent Editor-derived manifests cleanly.

Published runtime UI must stay inside `packages/universo-react-apps-template-mui` and its data-driven widget primitives. The next work must not make the runtime depend on `@universo-react/template-mui` or legacy feature packages scheduled for removal.

### 11. Colyseus ownership boundaries are already correct and must stay strict

Colyseus is documented as an authoritative server framework with server-owned synchronized state. The repository's `applicationsRealtimeRuntime.ts` also follows that direction: client messages are movement intents, server validates access and message shape, fixed tick state changes happen server-side, and reconnect/authorization states are explicit.

Planning implication: Editor-authored state may define templates, spawn points, collision/guard bounds, camera hints, script references, and room metadata. It must not become authoritative runtime world state. The runtime should continue to reject unsafe client-side position/state mutation and prove this through Playwright or API-level negative checks.

### 12. Browser security bypasses from prior research should be rejected

The second backup research suggests launching Playwright with disabled browser security to bypass local CORS. That conflicts with the repository's iframe/origin/CSP guardrails and with the brief's non-goal of disabling browser security for acceptance.

Planning implication:

-   keep the dedicated artifact origin requirement for `allow-scripts allow-same-origin`;
-   keep short-lived tokens and origin binding;
-   keep write CSRF requirements;
-   test misconfiguration/expired-token/hostile-origin failures;
-   do not make `--disable-web-security` a normal acceptance condition.

### 13. Publication hash, application sync, lifecycle, and cleanup are acceptance-critical

The brief requires publication hashing and application sync to change when the selected scene, runtime assets, generated script artifacts, script bindings, or MMOOMM runtime metadata changes. The repository already has relevant hooks:

-   `publicationSnapshotHash.ts` normalizes `playcanvasProjects` and `playcanvasRuntimeManifests`;
-   `publicationSnapshotHash.test.ts` already covers PlayCanvas runtime manifest changes, project file payload changes, and script binding changes;
-   `syncPlayCanvasPersistence.ts` validates checksums and persists runtime manifests to `_app_playcanvas_manifests`.

Planning implication: the next work should add or preserve tests that mutate each Editor-authored axis and prove the canonical publication hash/sync output changes. Runtime acceptance must also carry the brief's explicit cleanup requirements: script lifecycle (`initialize`, `update`, `postUpdate`, `destroy`), hot-reload cleanup where supported, no duplicate script registrations after reopen/switch, asset load/unload indicators, scene switch cleanup, resize listener cleanup, GPU/canvas disposal, stale-token/disconnect handling, dirty-state publish prevention, and conflict-safe save/reopen.

### 14. Playwright evidence must combine user-facing selectors, iframe access, network checks, and visual/runtime oracles

Official Playwright docs support frame locators for iframe content, `page.on('websocket')` plus WebSocket frame/close event listeners for realtime inspection, and trace artifacts for debugging/evidence. Repository rules add stricter local requirements: use the E2E wrapper, port `3100`, stable user-facing locators/test ids, no `pnpm dev`, and runtime UX/canvas evidence.

For the product flow, tests should include:

-   user-facing locators or stable test ids for platform UI;
-   frame-locator access for the Editor iframe;
-   upstream Editor DOM region checks to reject fallback UI;
-   screenshots/traces for Editor, publish/export, and runtime;
-   console/network/WebSocket checks for protocol leaks, failed requests, missing realtime connections, token leakage, and unexpected close/reconnect behavior;
-   canvas nonblank pixel checks plus deterministic data attributes or runtime state oracles;
-   responsive viewport matrix for desktop/tablet/mobile;
-   explicit failure when save/reopen loses Editor-authored data or dirty/conflict state allows unsafe publish.

### 15. Clean test DB and refactor freedom do not waive repository safeguards

The source TZ explicitly allows serious refactoring, states that the test database can be deleted and recreated, says no legacy code has to be preserved, and says not to increase metahub schema/template version. This is a planning freedom, not permission to bypass repository rules.

Implications:

-   PLAN may propose larger package refactors and fresh E2E data instead of preserving obsolete test fixtures.
-   PLAN should avoid unnecessary schema/template version bumps for metahub templates if the work can be represented in the current target schema and a clean test setup.
-   New backend storage still must use package migrations and registered DDL boundaries where schema changes are real. Domain storage goes through store modules with `DbExecutor.query()`, PostgreSQL bind parameters, schema-qualified SQL, safe quoted dynamic identifiers, and fail-closed mutations.
-   Route handlers and services must not import raw Knex/Supabase directly. Tier 3 Knex remains limited to infrastructure, migrations, and explicit package-local DDL boundaries.
-   "No legacy preservation" does not mean reviving removed route shapes or breaking current persisted authoring contracts in the same phase. Metahub authoring stays under entity-owned routes such as `/metahub/:id/entities/:kindKey/...` and shared resources under `/metahub/:id/resources/...`; removed top-level `/hubs`, `/objects`, `/sets`, and `/enumerations` authoring routes should not return.
-   The compatibility backend should remain a protocol package with injected ports/adapters. Metahub schemas, branch storage, and project storage remain mounted and owned through `metahubs-backend`, not moved wholesale into `playcanvas-editor-backend`.
-   Future code changes should pass the Thermos/autoreview quality gates: UUID v7 behavior, SQL parameterization, WebSocket origin headers, no credentials/PII in logs, API compatibility, package boundaries, and tests.

### 16. Build and CI constraints must be planned, not assumed

The Editor frontend package currently has package-local build/smoke commands and intentionally does not define a normal root `build` script. The vendored upstream package requires Node `>=22.22.0`, while existing repository E2E rules require explicit Node 22 activation where non-interactive shells may pick an older runtime.

Planning implication: before product E2E depends on a fresh Editor artifact, PLAN must decide how the artifact is built for E2E/CI and whether root build enrollment is part of this work or remains a prebuilt/local artifact prerequisite. Package-local builds are acceptable for fast checks, but repository propagation still requires root `pnpm build` when code changes cross workspace boundaries. If the Editor artifact remains outside the root/Turbo build, PLAN must state how CI obtains a verified artifact.

## Conflicts And Uncertainty

-   **"Fully working" vs "PlayCanvas Cloud parity"**: The user wants all main functionality, not merely the current minimal slice. But byte-for-byte PlayCanvas Cloud backend parity is neither necessary nor realistic. PLAN must define a capability matrix that separates main user-facing behavior from optional commercial/cloud extras.
-   **Autosave semantics**: Upstream product messaging emphasizes live collaboration, but Code Editor documentation says text asset changes are not automatically saved. PLAN must encode this distinction.
-   **Collaboration and version control phasing**: Collaboration and VCS are clearly main Editor surfaces. It is still a product decision whether the first implementation milestone can defer full multi-user and branching if it keeps the final brief open.
-   **Binary asset scope**: The product fixture can start with primitive/JSON/script assets, but a "main Editor functionality" claim will eventually require binary texture/model/audio workflows or an explicitly documented first-asset-set boundary.
-   **Runtime manifest shape**: The current `PlayCanvasRuntimeManifest` is intentionally normalized and compact. It may need extension to express Editor-authored scene hierarchy/assets/scripts without leaking upstream Editor internals.
-   **Existing runtime widget vs new widget**: Current `playcanvasCanvas` has strong MMOOMM runtime behavior. It is uncertain whether Editor-derived manifests can project cleanly into its current config model without a new manifest reader.
-   **Fixture naming and contract split**: Existing support constants hard-code `metahubs-mmoomm-flight-app-snapshot.json`. The new `metahubs-mmoomm-app-snapshot.json` needs either a generalized MMOOMM contract or a separate contract to avoid accidental flight-only assumptions.

## Project Implications

-   The brief should remain high priority and cross-project. It touches Platformo authoring, PlayCanvas Editor frontend/backend, metahub storage, application sync, apps-template runtime, Colyseus wrappers, E2E support, and fixtures.
-   Do not close the brief after only adding another compatibility endpoint. The acceptance target is a browser-authored product fixture and runtime proof.
-   The next PLAN should start with the step-by-step browser product journey, then map each step to a capability/gap matrix against upstream Editor surfaces and local protocol descriptors. The matrix should identify which stubbed surfaces must become real, which can be typed unavailable, and which are optional commercial extras.
-   The source TZ allows a clean recreated test DB, serious refactors, and no legacy preservation, but also says not to bump metahub schema/template version. PLAN should use that freedom for clean product data and package refactoring while still respecting DB/DDL, route, security, and package-boundary rules.
-   Asset/code/sourcefile work is a core dependency, not polish. Without it, the Editor cannot author MMOOMM scripts and normal project assets through the upstream UI.
-   Browser-first E2E should reuse existing Resources -> Packages, PlayCanvas project panel, Editor iframe, and entity Modules UI paths where possible. It also needs to identify missing UI support helpers and stable test ids for metahub logic/layout/widget authoring.
-   The current API-first generator remains useful as a baseline and fixture contract reference, but it cannot be the new product generator.
-   A direct final JSON write is acceptable only after the test has proven that the underlying state was browser-authored, published, synced, and exported through the intended product path. It is not acceptable as a substitute for Editor authoring or publication.
-   Existing runtime tests should be generalized and reused to validate `metahubs-mmoomm-app-snapshot.json` after the browser-first generator creates it.
-   Publication hashing and application sync must be acceptance gates for Editor-derived state: selected scene, runtime assets, generated script artifacts, script bindings, MMOOMM metadata, and project files must affect canonical hash/sync output.
-   Script lifecycle and runtime cleanup are not optional QA polish. They should be part of the implementation acceptance evidence before the product fixture is treated as canonical.
-   New backend persistence must stay SQL-first through stores and `DbExecutor.query()`, with registered migrations/DDL boundaries for real schema changes. `playcanvas-editor-backend` should keep protocol/route-factory ownership while metahub storage remains injected/mounted through `metahubs-backend`.
-   Published runtime work must stay in `apps-template-mui` and must not depend on Editor internals, `@universo-react/template-mui`, or legacy feature packages.
-   The PlayCanvas artifact build/runtime Node requirements must be accounted for before CI can rely on the product flow.
-   Future code changes should include Thermos/autoreview evidence for correctness, security, maintainability, package boundaries, SQL safety, WebSocket origin checks, and tests.

## Recommended Decision

Use the current brief as the correct top-level product brief, but require the next PLAN to treat it as a multi-phase implementation under one final acceptance target:

1. Write the browser product journey first: metahub creation, package connection, logic/modules where UI supports it, PlayCanvas project creation, real Editor authoring, save/reopen, publish, runtime verification, and fixture export.
2. Inventory existing UI/E2E helpers and identify the missing user-facing authoring paths or stable test ids before adding backend-only shortcuts.
3. Define the main Editor capability matrix and de-stub the minimum required backend surfaces for normal projects.
4. Implement real sourcefile/code-editor, asset, scene/component/settings, save/reopen, launch, publish/export, and runtime-manifest projection paths.
5. Decide the collaboration/version-control milestone boundary explicitly; do not silently leave main surfaces as no-op while claiming the full brief is complete.
6. Preserve repository safeguards while using the source TZ's clean-test-DB/refactor freedom: no unnecessary schema/template version bump, no revived removed routes, SQL-first storage, injected compatibility backend ports, normal iframe/origin/CSRF/token security, and Thermos QA for code changes.
7. Add publication hash/sync, script lifecycle, runtime cleanup, and WebSocket/network evidence as acceptance gates.
8. Build a browser-first product Playwright generator for `tools/fixtures/metahubs-mmoomm-app-snapshot.json`.
9. Reuse/generalize the existing MMOOMM runtime oracle to prove the generated fixture opens a published app with PlayCanvas + Colyseus behavior.

This keeps the user goal intact while avoiding an unrealistic demand for PlayCanvas Cloud account/billing/store parity.

## Open Questions Before PLAN

-   Which collaboration/VCS surfaces must be complete in the first implementation milestone, and which may remain explicitly unavailable while the overall brief stays open?
-   What is the first supported binary asset set for the product flow: none, local placeholder geometry only, images/textures, GLB/GLTF, audio, or a broader import pipeline?
-   Which metahub authoring steps already have acceptable user-facing UI for the product journey, and which may temporarily use API support only because no product UI exists yet?
-   What exact provenance check proves that `metahubs-mmoomm-app-snapshot.json` came from browser-authored, saved/reopened, published, and synced Editor state?
-   If new PlayCanvas asset/sourcefile/realtime persistence needs schema changes, can that be done without a metahub schema/template version bump, or does PLAN need a separate migration decision despite the source TZ preference?
-   Should `metahubs-mmoomm-app-snapshot.json` supersede the existing flight fixture immediately, or coexist while the new Editor-authored fixture stabilizes?
-   Should runtime projection extend the existing `playcanvasCanvas` widget config, or add a manifest reader/new widget only if the current widget cannot represent Editor-derived manifests?
-   Should the Editor artifact become part of root build/CI in this work, or should E2E use a package-local prebuilt artifact until build enrollment is planned separately?

## Sources

-   Local manager-only MMOOMM PlayCanvas runtime projection brief, dated 2026-06-09
-   Local manager-only MMOOMM PlayCanvas runtime projection source input, dated 2026-06-09
-   `.backup/Копия-PlayCanvas-Editor-для-Universo-MMOOMM.md`
-   `.backup/Разработка-PlayCanvas-Editor-для-Universo-MMOOMM.md`
-   `docs/en/platform/playcanvas-editor.md`
-   `docs/en/platform/playcanvas-projects.md`
-   `docs/en/guides/mmoomm-flight-simulator.md`
-   `AGENTS.md`
-   `memory-bank/techContext.md`
-   `packages/universo-react-playcanvas-editor-frontend/README.md`
-   `packages/universo-react-playcanvas-editor-backend/README.md`
-   `packages/universo-react-metahubs-frontend/README.md`
-   `packages/universo-react-metahubs-backend/README.md`
-   `packages/universo-react-applications-backend/README.md`
-   `packages/universo-react-apps-template-mui/README.md`
-   `packages/universo-react-types/src/common/playcanvasProjects.ts`
-   `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts`
-   `packages/universo-react-types/src/common/playcanvasEditorBridge.ts`
-   `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/`
-   `packages/universo-react-applications-backend/src/routes/sync/syncPlayCanvasPersistence.ts`
-   `packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts`
-   `packages/universo-react-utils/src/serialization/__tests__/publicationSnapshotHash.test.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx`
-   `packages/universo-react-applications-backend/src/realtime/applicationsRealtimeRuntime.ts`
-   `packages/universo-react-metahubs-frontend/src/domains/modules/ui/EntityModulesTab.tsx`
-   `tools/testing/e2e/specs/flows/metahub-packages-resources.spec.ts`
-   `tools/testing/e2e/specs/generators/metahubs-mmoomm-flight-app-export.spec.ts`
-   `tools/testing/e2e/specs/flows/snapshot-import-mmoomm-flight-runtime.spec.ts`
-   `tools/testing/e2e/support/mmoommFlightFixtureContract.ts`
-   `packages/universo-react-playcanvas-editor-frontend/e2e/editor-artifact.spec.ts`
-   [PlayCanvas Editor product page](https://playcanvas.com/products/editor)
-   [PlayCanvas Editor Workflow](https://developer.playcanvas.com/user-manual/editor/getting-started/workflow/)
-   [PlayCanvas Assets Panel](https://developer.playcanvas.com/user-manual/editor/assets/asset-panel/)
-   [PlayCanvas Code Editor](https://developer.playcanvas.com/user-manual/editor/scripting/code-editor/)
-   [PlayCanvas Real-time Collaboration](https://developer.playcanvas.com/user-manual/editor/realtime-collaboration/)
-   [PlayCanvas Version Control](https://developer.playcanvas.com/user-manual/editor/version-control/)
-   [PlayCanvas Backup and Export](https://developer.playcanvas.com/user-manual/editor/projects/backup-and-export/)
-   [PlayCanvas Editor frontend open-source announcement](https://blog.playcanvas.com/playcanvas-editor-frontend-is-now-open-source/)
-   [playcanvas/editor GitHub repository](https://github.com/playcanvas/editor)
-   [Colyseus documentation](https://docs.colyseus.io/)
-   [Playwright Frame docs](https://playwright.dev/docs/api/class-frame)
-   [Playwright network/WebSocket docs](https://playwright.dev/docs/network)
-   [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer)
-   Context7 documentation queries: `/playcanvas/engine`, `/colyseus/docs`, `/microsoft/playwright`
