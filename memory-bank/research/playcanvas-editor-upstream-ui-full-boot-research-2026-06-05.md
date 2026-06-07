# Research: PlayCanvas Editor Upstream UI Full Boot

> Created: 2026-06-05
> Status: QA-reviewed
> Trigger: RESEARCH request after manual testing showed only an empty canvas plus the "Add Entity" control
> Follow-up plan: TBD

## Research Question

Determine whether the upstream PlayCanvas Editor frontend already contains the base visual editor UI used on playcanvas.com, why the current Universo integration shows only a minimal canvas/add-entity experience, and what the next plan must target before claiming a full upstream Editor UI integration.

The repository decision this research supports is whether the next work should build new UI, extend the current bridge-minimal mode, or make the vendored upstream Editor boot against a PlayCanvas-compatible Universo backend/realtime contract.

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
|--------|------|------------------|----------------|
| Source brief supplied by the user | Private local brief | 2026-06-05 | Defines the current backend compatibility goal and the requirement to keep the upstream Editor frontend largely unmodified. |
| `.backup/Интеграция-полного-PlayCanvas-Editor-новое.md` | Local prior research | Current local file | Previously identified that the visible empty-canvas mode is expected from the limited Universo-hosted bridge/fallback path, not proof that upstream UI is absent. |
| `.backup/Интеграция-PlayCanvas-Editor-в-Universo-новое.md` | Local prior research | Current local file | Documents the upstream Editor frontend architecture: PCUI/Observer/ShareDB/Monaco bundles, backend-injected `window.config`, and `use_local_frontend` over PlayCanvas Cloud. |
| `memory-bank/research/playcanvas-editor-minimal-compatibility-backend-research-2026-06-05.md` | Local research artifact | 2026-06-05 | Establishes that the first backend slice is REST/bridge-minimal and not full upstream backend parity. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor/index.ts` | Vendored upstream source | Local `v2.23.4` snapshot | Proves the full editor entrypoint imports layout, realtime, hierarchy, assets, inspector, chat, toolbar, viewport controls, viewport, and related editor modules. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor/layout/layout.ts` | Vendored upstream source | Local `v2.23.4` snapshot | Proves the upstream DOM/PCUI shell creates `HIERARCHY`, `INSPECTOR`, toolbar, viewport, assets panel, and console containers. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor/entities/entities-control.ts` | Vendored upstream source | Local `v2.23.4` snapshot | Proves the upstream hierarchy header itself has an `Add Entity` tooltip/control, so the text alone does not distinguish real upstream UI from fallback. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor/entities/entities-panel.ts` | Vendored upstream source | Local `v2.23.4` snapshot | Proves the hierarchy tree binds to `layout.hierarchy` and is populated on `entities:load`. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor/assets/assets-panel.ts` | Vendored upstream source | Local `v2.23.4` snapshot | Proves the bottom assets panel binds loaded assets into `layout.assets`. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor/inspector/attributes-inspector.ts` | Vendored upstream source | Local `v2.23.4` snapshot | Proves `layout-attributes` is populated by the upstream PCUI inspector system, not just an empty panel container. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor/viewport/viewport.ts` | Vendored upstream source | Local `v2.23.4` snapshot | Proves the real viewport creates a `canvas-3d` PlayCanvas canvas inside `layout.viewport`. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor/realtime/realtime.ts` | Vendored upstream source | Local `v2.23.4` snapshot | Shows full scene loading is triggered after realtime authentication and depends on `config.url.realtime.http`. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor-api/realtime/connection.ts` | Vendored upstream source | Local `v2.23.4` snapshot | Shows upstream imports the ShareDB client, binds it to the authenticated socket, and treats `auth` messages as the gate for realtime document loading. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor-api/realtime/scene.ts` | Vendored upstream source | Local `v2.23.4` snapshot | Shows scenes are ShareDB documents in collection `scenes`, with scene mutations submitted through `submitOp`. |
| `packages/universo-react-playcanvas-editor-frontend/scripts/lib/playcanvas-editor-artifact.mjs` | Local source | Current local file | Shows the current `universo-hosted` bootstrap injects synthetic `window.config`, points realtime/messenger/relay to `/disabled`, loads `./js/editor.js`, and installs a fallback hosted entity adapter. |
| `packages/universo-react-playcanvas-editor-frontend/e2e/editor-artifact.spec.ts` | Local test source | Current local file | Shows current browser smoke coverage explicitly proves the fallback bridge path, including absence of the full upstream toolbar. |
| `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectsService.ts` | Local source | Current local file | Shows the current protocol descriptor is `universo-bridge-minimal` and marks REST, realtime, and messenger surfaces as disabled. |
| `packages/universo-react-playcanvas-editor-backend/src/index.ts` | Local source | Current local file | Shows the compatibility backend exposes REST-minimal config/scenes/assets/settings routes and explicitly does not attach a WebSocket runtime. |
| `https://github.com/playcanvas/editor/tree/v2.23.4` | Primary upstream repository | Checked 2026-06-05 | Confirms upstream tag `v2.23.4`, repository contents, README, visual editor positioning, local development model, and latest release marker. |
| `https://github.com/playcanvas/editor/releases/tag/v2.23.4` | Primary upstream release | Latest release shown on GitHub on 2026-06-05 | Confirms the currently targeted upstream release exists. |
| `https://blog.playcanvas.com/playcanvas-editor-frontend-is-now-open-source/` | Primary vendor blog | Published 2025-07-30, checked 2026-06-05 | Confirms PlayCanvas open-sourced the Editor Frontend and positions it as a frontend that can be customized and connected to a backend. |
| `https://api.playcanvas.com/editor/` and `https://api.playcanvas.com/editor/classes/RealtimeConnection.html` | Primary API reference | Crawled within recent weeks, checked 2026-06-05 | Confirms the Editor API exposes Realtime, RealtimeConnection, RealtimeScenes, RealtimeAssets, Messenger, Jobs, and related APIs. |
| `https://github.com/share/sharedb` | Primary dependency source | Latest release shown as 2025-05-20, checked 2026-06-05 | Confirms ShareDB is a realtime JSON document backend with OT, collaboration, middleware, persistence integrations, and in-memory test implementations. |

## Key Findings

1. **The base PlayCanvas Editor UI is present in the vendored upstream frontend.**

   This is not a case where the repository lacks the UI from the screenshot. The vendored upstream entrypoint imports the full editor app. In `src/editor/index.ts`, the first section imports core `layout`, `messenger`, `relay`, and `realtime`; later sections import entity selection/create/delete/panel/tree/menu/control modules, viewport gizmos, asset registry/panel/upload/create/delete/edit modules, sourcefiles, settings, scene settings, inspector/attributes modules, chat, toolbar, viewport controls, and the viewport stack.

   The layout module creates actual PCUI panels with stable DOM ids and user-visible headers: `layout-root`, `layout-toolbar`, `layout-hierarchy` with `HIERARCHY`, `layout-viewport`, `layout-assets`, `layout-attributes` with `INSPECTOR`, `layout-attributes-secondary`, and the console panel. The real viewport module creates `canvas-3d` and prepends it into `layout.viewport`. The hierarchy tree binds to `layout.hierarchy`, the assets panel binds loaded assets into `layout.assets`, and the inspector stack uses `AttributesInspector` plus entity/asset inspector modules to populate `layout-attributes`.

   Therefore the next implementation should not recreate these panels in MUI or build a new left tree/right inspector from scratch. The UI shown in the screenshot is already the upstream PCUI/DOM app; the missing work is making that app boot and receive valid data.

2. **The current empty-canvas/Add Entity experience is the Universo bridge-minimal mode, not full upstream Editor boot success.**

   The local artifact wrapper defaults to `universo-hosted`, creates a synthetic `window.config`, then loads `./js/editor.js`. However, the same wrapper sets `config.url.messenger.ws`, `config.url.realtime.http`, and `config.url.relay.ws` to `/disabled` endpoints and installs a WebSocket shim for disabled URLs. It also installs `installHostedEntityAdapter()`, which registers fallback `entities:list`, `entities:raw`, and `entities:new` methods when the upstream entity API is not available.

   The wording must be precise: an `Add Entity` control also exists in the real upstream hierarchy header through `entities-control.ts`. The text or tooltip alone is not proof of fallback. The current failed user experience is identified as bridge-minimal/fallback because the local wrapper also creates a standalone hosted `Add entity` button, `hostedEntityAdapterInstalled` can become true, `#layout-toolbar` may be absent, realtime/messenger URLs contain `/disabled`, and current E2E coverage explicitly expects this fallback path. Full-boot acceptance must distinguish these states through DOM ids, bridge flags, config URLs, console/network/WebSocket traces, and screenshots.

3. **The first compatibility backend slice is intentionally REST-minimal and does not provide the upstream realtime contract.**

   The metahub PlayCanvas project service still returns protocol mode `universo-bridge-minimal` and marks `endpoints.rest`, `endpoints.realtime`, and `endpoints.messenger` as disabled in that protocol descriptor. Separately, the new `universo-compatibility-rest-minimal` route layer is live and exposes same-origin config, scenes, assets, settings, and cloud-only no-op routes. This REST layer should not be described as absent. It should be described as useful bridge/fallback save support that is still insufficient for upstream scene population.

   This means the current implementation can save through Universo bridge/minimal REST paths, but it does not yet make upstream Editor's realtime scene loading path work.

4. **Upstream Editor scene loading depends on realtime authentication and ShareDB-style documents, not only REST scene reads.**

   The upstream realtime module listens for `authenticated`; when that event fires and `config.scene.uniqueId` exists, it calls `realtime.scenes.load(config.scene.uniqueId)`. It connects through `realtime.connection.connect(config.url.realtime.http)`. The local upstream `RealtimeConnection` imports `sharedb/lib/client/index`, creates or reuses a ShareDB connection, binds it to the authenticated socket, and treats messages beginning with `auth` as the authentication gate. `RealtimeScene` then gets the `scenes` document through `getDocument('scenes', uniqueId)`, subscribes to it, and submits scene mutations with `document.submitOp([op])`.

   The public PlayCanvas Editor API documents the same conceptual surface: `RealtimeConnection.connect(url)`, `getDocument(collection, id)`, `sharedb`, bulk subscribe, `RealtimeScenes.load(sceneId)`, `RealtimeScene.submitOp()`, and asset realtime APIs.

   Inference: a REST-only compatibility facade can support explicit Universo save/read calls, but it cannot by itself populate the upstream hierarchy/inspector/scene state in the way the Editor expects. A minimal ShareDB-compatible WebSocket/runtime, or a carefully proven equivalent adapter at the upstream realtime boundary, is required for full upstream UI boot.

5. **The upstream repository's own local development flow depends on PlayCanvas Cloud for backend state.**

   The upstream README instructs developers to run the local frontend and then open a scene on `playcanvas.com` with `?use_local_frontend`; that loads frontend assets from `localhost:3487` while PlayCanvas Cloud still provides the editor page, authentication, config, scene data, and backend services. This is consistent with the blog announcement that the open-sourced piece is the Editor Frontend.

   Inference: running the repository locally is not the same as running a standalone offline editor. Universo must either emulate enough of the PlayCanvas backend contract or explicitly build a different Universo authoring UI. The current product goal still points to the first option.

6. **The vendored source has already been updated to `v2.23.4`, but the next plan still needs post-update boot tracing.**

   Local `vendor/package.playcanvas-editor.json` reports `2.23.4`, and `vendor/UPSTREAM.md` records tag `v2.23.4`. A direct Git tag check confirms `refs/tags/v2.23.4` exists. The follow-up plan should not spend a phase "eventually update upstream" unless verification shows drift; instead it should verify the vendored `v2.23.4` artifact, rebuild behavior, and browser boot/network/WebSocket traces.

7. **A robust acceptance gate must fail when only the fallback UI appears.**

   Current smoke behavior can pass while the user still sees the wrong result. The current artifact E2E even asserts `#layout-toolbar .pcui-button.logo` has count `0`, then verifies the fallback `Add entity` button and bridge `entities:list` adapter. That test is useful for bridge-minimal mode, but it proves the opposite of the desired screenshot-level outcome.

   Future tests need browser-level assertions and screenshots for the upstream shell: visible `#layout-root`, `#layout-toolbar`, `#layout-hierarchy`, `#layout-viewport`, `#canvas-3d`, `#layout-assets`, `#layout-attributes`, visible toolbar/viewport controls, a loaded default scene entity in the hierarchy, selecting an entity populates the inspector, adding/mutating an entity emits/persists through the compatibility backend, and reload/reopen preserves the change. Full-boot tests should explicitly reject fallback-only state: missing `#layout-toolbar`, `hostedEntityAdapterInstalled === true`, realtime/messenger URLs containing `/disabled`, the local fallback entity panel being the only entity UI, or console/WebSocket failures that prevent realtime authentication.

8. **The right implementation direction is not to rebuild PlayCanvas UI in Universo MUI.**

   The upstream panels are PCUI/DOM modules, not React/MUI components. The Universo MUI host should remain a thin, localized, secure iframe/container/entry surface. The full editor UI should be enabled inside the isolated PlayCanvas artifact by satisfying its config/backend/runtime expectations. MUI work is still required for the host shell, errors, package settings, and permissions, but not for recreating hierarchy/assets/inspector.

## Conflicts And Uncertainty

- The prior backend brief and research correctly identified backend/realtime gaps, but the implementation acceptance was too weak: it allowed a bridge-minimal path that did not visibly prove the upstream UI panels and scene state were operational.
- The exact minimal realtime surface is not yet proven. The upstream code and API point to ShareDB collections such as `scenes`, `assets`, and `settings`, but browser tracing must determine the first required messages, auth flow, document ids, op shapes, and whether a no-op messenger/relay is enough for single-user authoring.
- The local fallback `Add entity` control may mask failures by making the editor look partially interactive. The next plan must either quarantine this fallback behind a diagnostic mode or add detection that marks full boot as failed when the fallback adapter is active.
- The upstream hierarchy also has an `Add Entity` control. Therefore future QA must not use the button label alone as a mode detector. It must inspect the surrounding shell (`#layout-toolbar`, `#layout-hierarchy`, `#layout-assets`, `#layout-attributes`, `#canvas-3d`), bridge flags, and runtime URLs.
- Context7 resolved `/share/sharedb`, but the documentation query failed due to an MCP transport error. This research therefore relies on local upstream source, PlayCanvas API docs, and ShareDB's primary GitHub/documentation entry point for the realtime conclusion.
- It remains unclear whether the upstream shell is currently failing before or after layout creation in the user's tested build. The next plan needs Playwright tracing of DOM, console, network, and WebSocket events against the rebuilt artifact.

## Project Implications

- The next PLAN must be scoped as **upstream PlayCanvas Editor full UI boot**, not another REST-minimal backend extension and not a custom Universo editor UI.
- `packages/universo-react-playcanvas-editor-frontend` should keep the upstream `src/editor/index.ts -> dist/js/editor.js` artifact path, but add or expose a full-boot mode whose config points to real same-origin compatibility endpoints instead of `/disabled`.
- `packages/universo-react-playcanvas-editor-backend` already has a REST-minimal compatibility layer for config/scenes/assets/settings. Full-boot planning must keep and reuse the safe parts of that layer where they match upstream needs, but must not treat it as enough for hierarchy/inspector/viewport population. The missing contract is realtime authentication, ShareDB-style scene/asset/settings documents, op persistence, and messenger/relay stability.
- `packages/universo-react-metahubs-backend` should continue owning metahub-scoped project storage and permissions. The PlayCanvas backend package should own PlayCanvas-compatible protocol behavior through injected ports/adapters rather than directly owning metahub schemas.
- The current fallback entity adapter in `playcanvas-editor-artifact.mjs` should be treated as a diagnostic or emergency bridge path. It must not be part of full-boot acceptance.
- Existing fallback E2E coverage should be split: keep a bridge-minimal test that intentionally expects fallback behavior, and add a separate full-boot test that fails on fallback flags and requires the screenshot-level upstream UI shell.
- Documentation and tests should state the difference between:
  - `universo-hosted` bridge-minimal mode,
  - full upstream UI boot mode,
  - future optional cloud-parity/collaboration features.
- Browser QA must capture screenshots and DOM/network/WebSocket evidence. A successful manual test should show the upstream left hierarchy, right inspector, bottom assets panel, toolbar/viewport controls, and persisted scene changes after reload.

## Recommended Decision

Proceed with a follow-up plan whose first milestone is to make the vendored upstream `v2.23.4` Editor boot in a **full upstream UI mode** against Universo-owned compatibility services.

Do not build replacement hierarchy/assets/inspector panels in MUI. Do not claim success from the fallback `Add entity` surface. The implementation should instead:

1. Trace the current artifact in a browser and record why the upstream shell/panels are missing or incomplete.
2. Split bridge-minimal and full-boot modes so full-boot does not silently use `/disabled` realtime/messenger URLs.
3. Build a schema-valid upstream `window.config` for full-boot mode.
4. Implement the minimal realtime/document contract required for one-user scene loading and mutation, preferably with ShareDB-compatible semantics unless tracing proves a smaller safe boundary. This contract must define auth message semantics, document ids and initial document shapes, subscribe/load flow, submitOp persistence, when-nothing-pending behavior, reconnect behavior, and user-facing failure states.
5. Provide stable same-origin messenger/relay behavior sufficient for single-user authoring, even if chat/collaboration are no-op.
6. Prove through Playwright screenshots and assertions that the real upstream hierarchy, inspector, assets panel, toolbar, viewport controls, scene mutation, persistence, and reload path work.

## Open Questions Before PLAN

- What exact console errors, REST requests, and WebSocket messages occur in the current rebuilt artifact before the user sees only the minimal Add Entity experience?
- Does the upstream layout DOM exist but fail visually due to CSS/sizing, or does boot stop before layout/panel modules become usable?
- What minimum ShareDB collections/documents and initial document shapes are required for a default single-user scene with one root entity?
- Which exact `auth`, ShareDB subscribe/load, `submitOp`, `whenNothingPending`, and reconnect semantics are mandatory for the upstream hierarchy, inspector, viewport, and save flow?
- Can messenger and relay be stable no-op WebSocket services for single-user authoring, or do specific upstream modules require acknowledgements such as authenticate/welcome/projectWatch?
- Should the fallback hosted entity adapter be removed from default mode, moved to an explicit diagnostic mode, or retained only as a last-resort unavailable-state with clear user-facing labeling?
- Which Playwright acceptance selectors are stable enough across upstream updates: IDs such as `layout-hierarchy`, `layout-assets`, `layout-attributes`, `layout-toolbar`, and `layout-viewport`, or higher-level visual assertions?

## Sources

- https://github.com/playcanvas/editor/tree/v2.23.4
- https://github.com/playcanvas/editor/releases/tag/v2.23.4
- https://blog.playcanvas.com/playcanvas-editor-frontend-is-now-open-source/
- https://api.playcanvas.com/editor/
- https://api.playcanvas.com/editor/classes/RealtimeConnection.html
- https://api.playcanvas.com/editor/classes/Realtime.html
- https://api.playcanvas.com/editor/classes/RealtimeScenes.html
- https://api.playcanvas.com/editor/classes/RealtimeScene.html
- https://api.playcanvas.com/editor/classes/RealtimeAssets.html
- https://api.playcanvas.com/editor/classes/RealtimeAsset.html
- https://api.playcanvas.com/editor/classes/Messenger.html
- https://github.com/share/sharedb
