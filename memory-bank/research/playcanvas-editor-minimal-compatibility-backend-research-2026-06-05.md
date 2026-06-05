# Research: PlayCanvas Editor Minimal Compatibility Backend

> Created: 2026-06-05
> Status: Reviewed
> Trigger: RESEARCH request based on the PlayCanvas Editor Minimal Compatibility Backend brief, followed by RESEARCH QA on 2026-06-05
> Follow-up plan: Not started. Create the PLAN artifact only after the upstream update and runtime contract tracing decision is explicitly requested.

## Research Question

What is the smallest safe backend strategy for making the vendored upstream `playcanvas/editor` frontend work as a useful single-user Universo authoring editor, beyond the already implemented Universo-hosted postMessage bridge/storage adapter?

This research supports the PLAN decision about whether to create a separate `@universo-react/playcanvas-editor-backend` package, how to place it against `metahubs-backend`, which upstream backend contracts must be traced first, and which existing Platformo storage/security pieces should be reused.

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
| --- | --- | --- | --- |
| User-provided local deep research: full PlayCanvas Editor integration | Local research input | Provided by user, re-read 2026-06-05; local backup path intentionally not repeated in Memory Bank | Frames the symptom: the current hosted artifact is not full PlayCanvas Cloud parity and needs backend-compatible services for the full upstream UI. |
| User-provided local deep research: PlayCanvas Editor in Universo | Local research input | Provided by user, re-read 2026-06-05; local backup path intentionally not repeated in Memory Bank | Analyzes the sovereign-backend path, ShareDB vs Colyseus separation, `window.config`, and the limits of `use_local_frontend`. |
| `memory-bank/research/playcanvas-editor-runtime-host-bridge-storage-adapter-research-2026-06-04.md` | Local research artifact | 2026-06-04 | Establishes the existing bridge/storage adapter as a bounded Universo-hosted authoring slice, not upstream backend parity. |
| `memory-bank/research/playcanvas-project-storage-model-for-metahubs-research-2026-06-03.md` | Local research artifact | 2026-06-03 | Defines metahub-scoped PlayCanvas project storage, lifecycle, snapshot/copy, and runtime manifest constraints. |
| `packages/universo-react-playcanvas-editor-frontend/README.md` | Local source | Current local file | Defines the current package as an isolated frontend artifact boundary with `universo-hosted` and `artifact-only` modes. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/UPSTREAM.md` | Local source | Current local file, stale wording | Records local upstream pin `v2.22.1` and still describes the initial artifact-only foundation, creating documentation drift. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/package.playcanvas-editor.json` | Local source | Current local file | Stores the vendored upstream package manifest because `vendor/playcanvas-editor/package.json` is intentionally absent from the workspace tree. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/AGENTS.md` | Vendored upstream guidance | Local `v2.22.1` snapshot | Documents the upstream loading model: backend-rendered HTML shell, injected `window.config`, configurable bundle base URL, and page variants. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor-api/external-types/config.d.ts` | Vendored upstream source | Local `v2.22.1` snapshot | Shows the breadth of `EditorConfig`: users, owner, project, scene, schema, URLs, engine versions, AWS/store/sentry/metrics/wasm fields. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor-api/realtime/connection.ts` | Vendored upstream source | Local `v2.22.1` snapshot | Shows the realtime protocol: WebSocket auth prefix, ShareDB client binding, keepalive ping, reconnect, `getDocument`, bulk subscribe. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor-api/realtime/scene.ts` | Vendored upstream source | Local `v2.22.1` snapshot | Shows scene persistence through ShareDB collection `scenes`, `submitOp`, `whenNothingPending`, and `close:scene`. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor-api/realtime/asset.ts` | Vendored upstream source | Local `v2.22.1` snapshot | Shows asset realtime document expectations through ShareDB collection `assets`. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor-api/messenger.ts` | Vendored upstream source | Local `v2.22.1` snapshot | Shows messenger `authenticate`, `welcome`, and `projectWatch` semantics. |
| `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/src/editor-api/rest/*` | Vendored upstream source | Local `v2.22.1` snapshot | Shows broad REST surface: projects, scenes, assets, branches, checkpoints, jobs, upload, users, store, payment, merge, diff. |
| `packages/universo-react-playcanvas-editor-frontend/scripts/lib/playcanvas-editor-artifact.mjs` | Local source | Current local file | Current Universo-hosted artifact injects synthetic config, disables realtime/messenger URLs, and overrides WebSocket for bridge mode. |
| `packages/universo-react-types/src/common/playcanvasProjects.ts` | Local source | Current local file | Defines existing PlayCanvas project, scene, asset, script, binding, generated artifact, runtime manifest, file, and package reference contracts. |
| `packages/universo-react-types/src/common/playcanvasEditorBridge.ts` | Local source | Current local file | Defines existing bounded postMessage bridge commands; it is not PlayCanvas REST or ShareDB protocol parity. |
| `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/**` | Local source | Current local files | Current metahub-scoped CRUD/storage/bridge backend using `DbExecutor`, Zod validation, auth, and `manageMetahub`. |
| `packages/universo-react-metahubs-backend/src/domains/packages/controllers/packagesController.ts` | Local source | Current local file | Current controller mixes package registry, artifact token/CSP, authoring-host descriptor, and bridge session creation. |
| `packages/universo-react-metahubs-backend/src/domains/metahubs/services/systemTableDefinitions.ts` | Local source | Current local file | Existing `_mhb_playcanvas_*` branch tables may cover first compatibility storage unless a ShareDB op log/document store is required. |
| `docs/en/platform/playcanvas-editor.md` | Local docs | Current local file | Public docs describe the implemented bridge, isolated artifact origin, tokenized artifact routes, and current non-parity scope. |
| `https://github.com/playcanvas/editor/tree/v2.23.4` | Primary upstream repository | Checked 2026-06-05 | Mandatory target tag for updating the vendored Editor before contract tracing. |
| `https://github.com/playcanvas/editor/releases/tag/v2.23.4` | Primary upstream release | Published 2026-06-04, checked 2026-06-05 | Latest release found through GitHub API: `v2.23.4`. |
| Upstream `v2.23.4` `package.json` and `.nvmrc` through GitHub API | Primary upstream source | Checked 2026-06-05 | Confirms `@playcanvas/editor@2.23.4`, package `engines.node >=22.22.0`, and upstream `.nvmrc` `22.22.3`. |
| `https://github.com/playcanvas/editor` | Primary upstream repository | Checked 2026-06-05 | README states local development loads frontend from `localhost:3487` after opening `playcanvas.com/editor/scene/<id>?use_local_frontend`. |
| `https://blog.playcanvas.com/playcanvas-editor-frontend-is-now-open-source/` | Primary vendor blog | Current vendor announcement | Clarifies that the open-source artifact is the Editor Frontend, intended to connect to PlayCanvas backend. |
| `https://api.playcanvas.com/editor/` | Primary vendor API docs | Checked 2026-06-05 | Documents Editor API concepts and confirms realtime/assets/entities/settings are real API surfaces, but not a full self-host backend spec. |
| `https://api.playcanvas.com/editor/classes/RealtimeConnection.html` | Primary vendor API docs | Checked 2026-06-05 | Confirms realtime connection concepts that align with local ShareDB source tracing. |
| `https://developer.playcanvas.com/user-manual/editor/realtime-collaboration/` | Primary vendor docs | Checked 2026-06-05 | Confirms collaboration/realtime is central to the official Editor, but it is not first-slice scope. |
| `https://developer.playcanvas.com/user-manual/editor/publishing/web/self-hosting/` | Primary vendor docs | Checked 2026-06-05 | Covers self-hosting published app builds, not self-hosting the authoring Editor backend. |
| `https://forum.playcanvas.com/t/how-could-i-host-the-game-editor/25631` | Tertiary vendor forum evidence | Checked 2026-06-05 | Supports the conclusion that self-hosting the editor backend requires non-trivial services and is not provided as a simple package. |
| `https://github.com/share/sharedb` / ShareDB docs through Context7 | Primary OSS docs | Queried 2026-06-05 | Shows expected server/client concepts: WebSocket server, `backend.listen(stream)`, document `subscribe`, `create`, and `submitOp`. |
| `https://vite.dev/config/shared-options.html#base` and `https://vite.dev/guide/build.html#public-base-path` | Primary tool docs | Queried 2026-06-05 | Confirms Vite `base` behavior for nested/relative static artifact hosting; relevant but not a substitute for backend compatibility. |

## Key Findings

1. **The brief scope is correctly narrower than PlayCanvas Cloud parity.**  
   The official upstream repository and announcement describe an Editor Frontend. The documented local development flow still opens `playcanvas.com/editor/scene/<id>?use_local_frontend` and swaps the frontend bundle to `localhost:3487`; it does not create a standalone backend. PlayCanvas self-hosting docs are for published app builds, not the authoring Editor backend.

2. **The current Universo implementation is a bounded bridge, not upstream backend compatibility.**  
   The current `universo-hosted` artifact injects a synthetic `window.config`, disables realtime/messenger URLs, overrides WebSocket for the hosted bridge path, and saves bounded JSON scene payloads through `POST /metahub/:metahubId/playcanvas/editor-bridge/commands`. This is useful and already implemented, but it is not PlayCanvas REST/ShareDB/messenger compatibility.

3. **Updating the vendored Editor is a hard prerequisite.**  
   Local vendor metadata is still pinned at upstream `v2.22.1`, while GitHub latest release is `v2.23.4` published on 2026-06-04. PLAN should re-check latest, then update the vendored snapshot to at least `v2.23.4` before runtime contract tracing. Upstream `v2.23.4` package metadata requires Node `>=22.22.0`, and its `.nvmrc` pins `22.22.3`; this is stricter than the broader repository Node baseline noted in Memory Bank (`>=22.6.0`). The local vendored upstream manifest is stored as `vendor/package.playcanvas-editor.json`, not as `vendor/playcanvas-editor/package.json`.

4. **`window.config` must be treated as a schema-quality backend product.**  
   The upstream Editor does not only need `projectId` and `sceneId`. Local `EditorConfig` includes user, owner, project permissions/settings, branch/checkpoint placeholders, scene id/uniqueId, schema definitions, engine versions, access token, URL surfaces, store/AWS/sentry/metrics/wasm fields, and more. The current `universo-hosted` synthetic config is bridge-only evidence and should not be treated as a schema-valid upstream-compatible backend fixture. A first compatibility slice needs a validated config builder with explicit no-op values for cloud-only surfaces.

5. **ShareDB should be the default compatibility path until proven otherwise.**  
   Vendored `RealtimeConnection` imports `sharedb/lib/client/index`, registers `ot-text`, creates a `share.Connection`, expects an auth-prefixed WebSocket handshake, exposes `getDocument`, starts/ends bulk subscribe, pings, reconnects, and emits realtime events. `RealtimeScene` and `RealtimeAsset` use ShareDB documents in `scenes` and `assets` collections and persist edits through `submitOp`. Context7 ShareDB docs confirm the standard server shape: a WebSocket stream passed to `backend.listen(stream)`, client `Connection`, document `subscribe`, `create`, and `submitOp`. ShareDB's default in-memory backend is not production persistence, so the Universo slice must decide whether to add a metahub-backed ShareDB persistence adapter, a document/op-log table, or a proven translation layer. A custom single-user adapter is possible only if Playwright proves unmodified upstream Editor can boot, mutate, save, reconnect, and reload through it.

6. **Settings are part of the minimum boot/save contract.**  
   Upstream Editor creates settings documents for user, project-user, and project-private settings, with ids such as `user_<selfId>`, `project_<projectId>_<selfId>`, and `project-private_<projectId>`. These must either become ShareDB docs or be deliberately stubbed/disabled with browser evidence that viewport, hierarchy, inspector, and save still work.

7. **Messenger cannot be ignored casually.**  
   Messenger is a separate WebSocket concept from realtime. It authenticates with access token and role `designer`, then watches the project and emits events such as asset create/delete, scene delete, permission changes, settings create, usage, and pipeline/job notifications. First slice can use no-op/stub behavior, but it must avoid reconnect noise and must satisfy any boot-relevant listeners.

8. **The REST surface is broad; PLAN must trace what is actually called.**  
   Vendored REST modules export projects, scenes, assets, branches, checkpoints, merge, diff, jobs, upload, users, apps, store, invitations, payment, and watch APIs. First slice should not implement all of these. It should instrument or trace the real boot/save path after updating to `v2.23.4`, then implement only required endpoints with explicit no-op/stub contracts for cloud-only surfaces.

9. **The static candidate REST facade starts with project scenes, scene get/create/delete, project assets, asset get/file/thumbnail/list, and selected job/upload no-ops.**  
   Local source points to `GET /projects/:projectId/scenes?branchId=...`, `GET /scenes/:sceneId?branchId=...`, `POST /scenes`, `DELETE /scenes/:id`, `GET /projects/:projectId/assets?branchId=...&view=designer`, `GET /assets/:id`, asset file/thumbnail URL generation, and multipart asset create/update paths. This is a static candidate list, not a verified boot/save contract. PLAN must validate it through browser network and WebSocket tracing after the upstream update instead of relying on static search alone.

10. **A separate backend package is justified only for the real compatibility surface.**  
    If the work includes shell/config builder, REST facade, ShareDB realtime server, messenger stubs, and explicit storage adapters, a potential `@universo-react/playcanvas-editor-backend` package is justified. If the work only adds a few more bridge commands, keeping it inside `metahubs-backend` is simpler.

11. **Storage ownership should remain metahub-scoped.**  
    Existing `_mhb_playcanvas_*` tables already model projects, scenes, assets, scripts, bindings, generated artifacts, compatibility, and publication manifests. A compatibility backend package should depend on public ports/adapters injected by `metahubs-backend`, not import private metahub domain modules and not own branch schema lifecycle directly.

12. **Layer placement must stay explicit.**  
    PlayCanvas project authoring records are design-time content stored inside the metahub branch. Package display/default-project settings belong to metahub package attachment config. Published runtime manifests are a separate output surface. This backend slice is Platformo infrastructure for authoring, not a workspace end-user content feature and not a dynamic metahub schema module.

13. **Current package controller coupling is a refactoring risk.**  
    `packagesController.ts` currently owns package catalog/attachment behavior and PlayCanvas-specific artifact token, origin/CSP, host descriptor, selected project, and bridge-session logic. PLAN should split or introduce explicit ports before adding a much wider upstream-compatible backend surface.

14. **Frontend MUI work should stay a host shell, not a PCUI rewrite.**  
    The existing docs and package README correctly state that the PlayCanvas Editor artifact is not a React/MUI component library. The full Editor should remain in an isolated iframe with a dedicated origin; MUI should own package settings, launch/open flows, loading/error states, and safe host chrome only.

15. **Security is not optional for this slice.**  
    Existing bridge/host security pieces include artifact token TTLs, separate artifact origin, HMAC session tokens, replay/idempotency, CSRF handling, and `manageMetahub` checks. Some existing artifact-token routes use token-scoped executor flows rather than ordinary request-scoped metahub handlers, so PLAN must be precise about executor tiering. A REST/ShareDB/messenger-compatible backend must preserve equivalent guarantees for bearer access tokens, websocket auth, origin isolation, replay/idempotency where mutations matter, and no leakage of raw tokens or storage paths.

16. **Vite base is useful background, but the current artifact also uses explicit relative shell paths.**  
    Vite docs confirm `base: './'` or `''` is valid for embedded deployments with unknown nested paths. The local artifact currently records a relative base strategy and loads shell assets with explicit relative paths plus `config.url.frontend`; Vite base-path behavior helps explain the static hosting constraints but does not solve backend compatibility.

17. **Colyseus and MMOOMM runtime remain separate lifecycle stages.**  
    The user-provided research is directionally right that ShareDB belongs to authoring while Colyseus belongs to runtime simulation. This slice should not mix them. Runtime publication/Colyseus authoring should be a later brief after upstream-compatible boot/save is proven.

## Conflicts And Uncertainty

- Upstream README says Node 18 or later for local development, but `v2.23.4` `package.json` declares `engines.node >=22.22.0` and `.nvmrc` pins `22.22.3`. Treat the package manifest and `.nvmrc` as authoritative for CI/tooling.
- Local vendored source is still `v2.22.1`; static tracing in this research is useful, but PLAN must repeat key tracing after updating to `v2.23.4`.
- PlayCanvas Editor API docs confirm concepts but do not provide a complete self-hosted backend compatibility spec. Source-code tracing and browser network/WebSocket evidence are required.
- The forum source about self-hosting editor backend is tertiary evidence. It aligns with official frontend-only documentation, but should not be treated as a formal support contract.
- It is unknown whether first-slice boot can avoid real asset documents by using an empty assets list plus messenger no-ops. Browser proof is required.
- It is unknown whether existing `_mhb_playcanvas_*` tables are sufficient for ShareDB persistence. A minimal implementation may need a new branch-scoped document/op-log table or a translation layer to existing scene/asset payload tables.
- It is unknown whether the fastest path is unmodified upstream plus backend facade, or a tiny reviewable upstream patch that disables selected cloud-only side-effect modules. The project preference remains unmodified upstream unless tracing proves otherwise.
- This research intentionally avoids repeating local backup paths in Memory Bank. The local deep research files were read from the prompt-provided backup locations, but Memory Bank artifacts should remain portable and repository-facing.

## Project Implications

- `packages/universo-react-playcanvas-editor-frontend` must be updated from upstream `v2.22.1` to at least `v2.23.4`, including `vendor/UPSTREAM.md`, `vendor/package.playcanvas-editor.json`, NOTICE/license review, dependency alignment, smoke tests, and Node/CI guardrails. Local package dependencies already partially match newer upstream versions, but the vendored source/docs remain pinned and must be reconciled as one reviewed update.
- The current `universo-hosted` bridge should remain as a bounded mode or compatibility fallback while the new upstream-compatible backend is developed. Do not silently replace it without preserving existing tested behavior.
- The compatibility backend should expose a PlayCanvas-shaped shell/config/REST/realtime/messenger surface under a clearly isolated route namespace, while internally using metahub-scoped storage and access checks.
- If created, `@universo-react/playcanvas-editor-backend` should be a package boundary for PlayCanvas-compatible protocol logic, not the owner of metahub schemas. It should receive ports/adapters for metahub access, schema resolution, package attachment resolution, project storage, file storage, and audit/security services.
- `metahubs-backend` should remain the composition owner that registers routes and injects request-scoped executors/adapters. Avoid importing private `metahubs-backend/src/domains/...` internals from the new package.
- Zod schemas should validate generated `EditorConfig`, REST inputs/outputs, bearer/session tokens, messenger events, and any ShareDB document initialization payloads at system boundaries. Use `safeParse` for user/network input and fail closed.
- The backend plan must distinguish ordinary request-scoped metahub routes from tokenized artifact/session/WebSocket flows, then choose the correct DbExecutor tier for each path.
- Rate limits for REST and WebSocket mutation flows may need a different profile from ordinary CRUD because active editor sessions can create bursts of operations.
- Existing `PLAYCANVAS_EDITOR_PACKAGE_NAME` currently identifies the frontend package in project metadata. PLAN should decide whether backend compatibility is represented by a separate adapter/version field rather than overloading `packageRef.packageName`.
- The existing `_mhb_playcanvas_*` storage model is a strong reuse candidate for durable project/scene/asset metadata, but PLAN must decide how ShareDB `scenes/assets/settings` documents map to those tables and whether op-level persistence is needed.
- If ShareDB is used directly, do not ship the default in-memory backend beyond tests or demos; persistence must be explicit and metahub-scoped.
- The backend must preserve the layer split: metahub branch owns authoring records, package attachment config owns package display/defaults, and runtime manifests remain publication outputs.
- Frontend E2E must go beyond page-load smoke. It should prove iframe boot, realtime/messenger connection stability, visible hierarchy/inspector/viewport, one minimal entity/settings mutation, save persistence, reload/reopen, negative auth/origin/token cases, and no page overflow.
- Documentation should be corrected before or during implementation: `vendor/UPSTREAM.md` currently under-describes the implemented `universo-hosted` bridge mode.

## Recommended Decision

Proceed with a staged sovereign backend path:

1. **Stage 0 - Update and trace.** Re-check latest upstream release, update the vendored Editor to at least `v2.23.4`, reconcile vendor docs, align Node/CI guardrails with upstream `.nvmrc`, then add tracing around boot, REST calls, realtime WebSocket messages, ShareDB collections/docs, messenger messages, and console failures.
2. **Stage 1 - Build a minimal upstream-compatible backend proof.** Treat real minimal ShareDB as the default, implement schema-valid `window.config`, minimum REST facade, `scenes/assets/settings` documents, messenger no-op/stub behavior, and cloud-only no-op contracts only after tracing confirms the required calls.
3. **Stage 2 - Package boundary decision.** If Stage 1 includes REST facade plus ShareDB/messenger protocol logic, create or plan `@universo-react/playcanvas-editor-backend` with injected adapters and register it from `metahubs-backend`. If tracing shows only small bridge extensions are needed, keep the work in the current metahub domain.
4. **Stage 3 - Prove value before expanding scope.** First success is one useful editor loop: boot real upstream UI, load schema-valid scene, perform one visible entity/settings mutation through upstream UI, persist through ShareDB or a proven equivalent transition, reload, and verify the change.

Do not attempt PlayCanvas Cloud parity, broad binary asset processing, version-control graph, collaboration, code editor, store, publishing, Colyseus runtime authoring, or AI/MCP editing in this slice.

## Open Questions Before PLAN

- After updating to `v2.23.4`, which exact network calls and WebSocket messages occur for a clean boot with one project and one scene?
- Is real ShareDB with a custom metahub-backed persistence adapter required, or can a protocol-compatible single-user adapter pass browser evidence without patching upstream?
- What is the minimal schema-valid `EditorConfig` fixture, including required dummy values for cloud-only surfaces?
- Which cloud-only REST endpoints must return no-op/stub responses to avoid UI errors during the first authoring loop?
- Can `_mhb_playcanvas_scenes`, `_mhb_playcanvas_assets`, and existing file storage represent ShareDB documents directly, or is a branch-scoped ShareDB document/op table required?
- How should numeric upstream project/scene/asset ids and existing UUID v7 Platformo ids map without collisions or user-visible raw IDs?
- Should backend compatibility be represented by a new package identity, an adapter/version field, or package attachment config tied to the existing frontend package identity?
- What route namespace should expose PlayCanvas-shaped REST/WebSocket APIs while preserving existing authenticated metahub API semantics?
- What token model should the iframe use for PlayCanvas-shaped REST and WebSocket APIs: existing bridge session token, a short-lived bearer access token, or a separate protocol token?
- Which browser evidence is the minimum acceptance gate before PLAN can claim the first upstream-compatible editor loop?

## Sources

- https://github.com/playcanvas/editor/tree/v2.23.4
- https://github.com/playcanvas/editor/releases/tag/v2.23.4
- https://github.com/playcanvas/editor
- https://blog.playcanvas.com/playcanvas-editor-frontend-is-now-open-source/
- https://api.playcanvas.com/editor/
- https://api.playcanvas.com/editor/classes/RealtimeConnection.html
- https://developer.playcanvas.com/user-manual/editor/realtime-collaboration/
- https://developer.playcanvas.com/user-manual/editor/publishing/web/self-hosting/
- https://forum.playcanvas.com/t/how-could-i-host-the-game-editor/25631
- https://github.com/share/sharedb
- https://vite.dev/config/shared-options.html#base
- https://vite.dev/guide/build.html#public-base-path
