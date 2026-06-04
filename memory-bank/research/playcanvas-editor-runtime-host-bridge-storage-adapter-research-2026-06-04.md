# Research: PlayCanvas Editor Runtime Host, Bridge, and Storage Adapter

> Created: 2026-06-04
> Status: Draft
> Trigger: RESEARCH request for private Manager brief
> Follow-up plan: PLAN not created yet; the future PLAN must load this artifact explicitly.

## Research Question

What is the safest first implementation path for turning the isolated PlayCanvas Editor artifact, metahub Editor host, and PlayCanvas project storage APIs into a usable Universo-backed authoring flow, given upstream PlayCanvas Editor backend/realtime assumptions, iframe sandbox/CSP constraints, storage write ordering, and current frontend API gaps?

## Source Inventory

| Source                                                                                                                | Type                        | Date / Freshness    | Why It Matters                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| private Manager brief                                                                                                 | Local brief                 | Current 2026-06-04  | Defines the proposed vertical slice: real Editor host, typed bridge, and storage adapter.                                                                                 |
| private Manager source input                                                                                          | Local source TZ             | Current local file  | Original PlayCanvas Editor integration request and research anchor.                                                                                                       |
| `memory-bank/research/playcanvas-editor-package-foundation-research-2026-05-31.md`                                    | Prior research              | Created 2026-05-31  | Establishes the isolated artifact package, upstream boundary, Node/package-manager constraints, and root-build caution.                                                   |
| `memory-bank/research/playcanvas-editor-metahub-authoring-surface-settings-research-2026-06-01.md`                    | Prior research              | Created 2026-06-01  | Establishes authoring package settings, safe artifact host, route/static serving, iframe isolation, and no storage bridge in that prior slice.                            |
| `memory-bank/research/modules-external-files-playcanvas-research-2026-06-01.md`                                       | Prior research              | Created 2026-06-01  | Establishes file-backed Modules as future script source inputs and separates generated PlayCanvas script artifacts from source code.                                      |
| `memory-bank/research/playcanvas-project-storage-model-for-metahubs-research-2026-06-03.md`                           | Prior research              | Created 2026-06-03  | Establishes the metahub PlayCanvas project storage model and authoring/runtime publication separation.                                                                    |
| `packages/universo-react-playcanvas-editor/README.md`, `README-RU.md`, `vendor/UPSTREAM.md`                           | Local docs                  | Current local files | Confirm the package is currently artifact-only and pinned to upstream Editor `v2.22.1`.                                                                                   |
| `packages/universo-react-playcanvas-editor/scripts/build-editor.mjs` and `scripts/lib/playcanvas-editor-artifact.mjs` | Local package scripts       | Current local files | Show that the current build intentionally overwrites `dist/editor/index.html` with a safe unavailable page and declares `smokeMode: artifact-only`.                       |
| `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/AGENTS.md`                                        | Vendored upstream guidance  | Current local file  | Documents the upstream shell/config model: backend-rendered HTML with injected `window.config` and frontend bundle loaded from a configurable base.                       |
| `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/src/common/editor.ts`                             | Vendored upstream source    | Current local file  | Shows the Editor initializes REST globals from `config.project.id`, branch, access token, API URL, and home URL.                                                          |
| `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/src/editor/realtime/realtime.ts`                  | Vendored upstream source    | Current local file  | Shows the full Editor expects realtime/ShareDB-style scene, asset, and messenger flows.                                                                                   |
| `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/src/editor/assets/handle-script-parse.ts`         | Vendored upstream source    | Current local file  | Shows script parsing uses workers and backend/realtime pipeline acknowledgements, not only static file parsing.                                                           |
| `packages/universo-react-metahubs-frontend/src/domains/packages/ui/PlayCanvasEditorHostPage.tsx`                      | Local frontend host         | Current local file  | Current iframe host uses `sandbox="allow-scripts"`, `referrerPolicy="no-referrer"`, and artifact/development URL modes, but does not pass project/session bridge context. |
| `packages/universo-react-metahubs-frontend/src/domains/packages/api/playcanvasProjectsApi.ts`                         | Local frontend API client   | Current local file  | Currently wraps only project CRUD while the backend exposes a much broader PlayCanvas project API.                                                                        |
| `packages/universo-react-metahubs-backend/src/domains/packages/controllers/packagesController.ts` and routes          | Local backend artifact host | Current local file  | Defines artifact tokening, TTL, `manageMetahub` checks, artifact CSP, and static serving behavior.                                                                        |
| `packages/universo-react-metahubs-backend/src/domains/packages/services/packageConfigValidation.ts`                   | Local backend validation    | Current local file  | Validates display modes, development URL allowlists, and package attachment config before host descriptors or artifact URLs are exposed.                                  |
| `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/`                                           | Local backend storage API   | Current local files | Defines PlayCanvas projects, scenes, assets, files, script assets, generated artifacts, publish/export, permission, and file write semantics.                             |
| `packages/universo-react-types/src/common/playcanvasProjects.ts`                                                      | Shared contract             | Current local file  | Defines project/scene/asset/script/generated artifact/runtime manifest types and snapshot transport shapes.                                                               |
| `packages/universo-react-types/src/common/packages.ts`                                                                | Shared contract             | Current local file  | Defines package attachment display settings, including `playcanvasProject.defaultProjectId`.                                                                              |
| `docs/en/platform/playcanvas-editor.md` and `docs/ru/platform/playcanvas-editor.md`                                   | Local docs                  | Current local files | Confirm the Editor package is authoring-only, has no runtime targets, opens through a sandboxed host, and is currently `artifact-only`.                                   |
| `docs/en/platform/playcanvas-projects.md` and `docs/ru/platform/playcanvas-projects.md`                               | Local docs                  | Current local files | Explain that runtime uses normalized PlayCanvas runtime manifests and explicit publication, not live authoring files.                                                     |
| `packages/universo-react-applications-backend/src/routes/sync/syncPlayCanvasPersistence.ts`                           | Local runtime sync          | Current local file  | Shows published application sync persists PlayCanvas manifests from publication snapshots.                                                                                |
| `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx`                       | Local runtime widget        | Current local file  | Shows the current published runtime surface is a widget/manifest consumer, not the PlayCanvas Editor authoring UI.                                                        |
| `packages/universo-react-rest-docs/src/openapi/index.yml`                                                             | Local REST documentation    | Current local file  | Any new bridge-specific backend endpoint changes the public REST contract and should be documented with typed request/response envelopes.                                 |
| `tools/testing/e2e/specs/flows/metahub-packages-resources.spec.ts`                                                    | Local E2E                   | Current local file  | Current browser evidence covers package panel/placeholder host, not a real Editor handshake or save/reopen flow.                                                          |
| `https://github.com/playcanvas/editor`                                                                                | Primary upstream repository | Checked 2026-06-04  | Source of truth for the open-source Editor frontend. Local package tracks `v2.22.1`; future implementation should re-verify the pinned revision.                          |
| `https://developer.playcanvas.com/user-manual/editor/editor-api/`                                                     | Primary vendor docs         | Checked 2026-06-04  | Confirms Editor API exists and is relevant for automation/bridge discussion, but docs are example-driven and not a complete self-host backend contract.                   |
| `https://developer.playcanvas.com/user-manual/scripting/esm-scripts/`                                                 | Primary vendor docs         | Checked 2026-06-04  | Documents modern ESM `.mjs` scripts and supports planning for generated script artifacts.                                                                                 |
| `https://developer.playcanvas.com/user-manual/scripting/script-attributes/`                                           | Primary vendor docs         | Checked 2026-06-04  | Confirms script attributes are the Editor-visible configurable interface and must be preserved outside raw scene JSON.                                                    |
| `https://developer.playcanvas.com/user-manual/editor/publishing/web/communicating-webpage/`                           | Primary vendor docs         | Checked 2026-06-04  | Documents iframe/webpage communication patterns and reinforces explicit API/postMessage boundaries for embedded PlayCanvas content.                                       |
| `https://developer.playcanvas.com/user-manual/editor/publishing/web/self-hosting/`                                    | Primary vendor docs         | Checked 2026-06-04  | Useful for static path and self-hosting considerations, though it covers published builds rather than a full self-hosted Editor backend.                                  |
| `https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage`                                                 | Browser platform docs       | Checked 2026-06-04  | Requires exact target-origin where possible and sender identity/message-shape validation for postMessage.                                                                 |
| `https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe`                                         | Browser platform docs       | Checked 2026-06-04  | Documents iframe sandbox behavior and the security-sensitive effect of sandbox flags.                                                                                     |
| `https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox`                 | Browser platform docs       | Checked 2026-06-04  | Defines CSP sandbox restrictions and allowed relaxation tokens relevant to artifact response headers.                                                                     |
| `https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html`                                      | Security reference          | Checked 2026-06-04  | Reinforces origin validation, message validation, and not trusting cross-document messages by shape alone.                                                                |
| Context7 `/vitejs/vite`                                                                                               | MCP documentation           | Checked 2026-06-04  | Confirms Vite `base` rewrites asset URLs and `base: "./"` / `""` supports unknown/nested embedded deployment paths.                                                       |
| Context7 `/playcanvas/engine`                                                                                         | MCP documentation           | Checked 2026-06-04  | Confirms ESM script asset loading depends on `.mjs` modules, `scriptName`, and asset `data.scripts` attribute schema.                                                     |
| Context7 `/colinhacks/zod`                                                                                            | MCP documentation           | Checked 2026-06-04  | Confirms `safeParse` and strict object schemas are the appropriate project-aligned pattern for validating untrusted bridge messages without throwing raw errors into UI.  |
| `.agents/skills/research-before-plan/SKILL.md`                                                                        | Local skill                 | Current             | Defines source-backed research artifact workflow.                                                                                                                         |
| `.agents/skills/universo-platform-architecture/SKILL.md`                                                              | Local skill                 | Current             | Confirms metahub/package/application boundaries and storage/publishing separation.                                                                                        |
| `.agents/skills/browser-3d-runtime-integration/SKILL.md` and `.agents/skills/playcanvas-engine-runtime/SKILL.md`      | Local skills                | Current             | Provide browser 3D/PlayCanvas lifecycle checks and runtime script semantics.                                                                                              |
| `.agents/skills/runtime-ux-qa/SKILL.md` and `.agents/skills/playwright-best-practices/SKILL.md`                       | Local skills                | Current             | Define required user-facing quality and browser evidence for iframe/canvas flows.                                                                                         |

## Key Findings

-   The brief direction is correct: the next vertical slice should connect the existing Editor package, metahub host, and PlayCanvas project storage model rather than starting with Colyseus gameplay metadata, AI/MCP automation, S3 provider configuration, or published runtime scene rendering.
-   The largest implementation risk is that the current artifact is not a real usable Editor runtime. The package build currently produces an upstream build but then intentionally writes a safe unavailable page over `dist/editor/index.html`; the artifact manifest declares `artifact-only`. A PLAN that only serves the current artifact will still show a placeholder.
-   Upstream PlayCanvas Editor is not just a static UI that naturally talks through `postMessage`. Vendored source initializes REST globals from injected `window.config`, project id, branch id, access token, API URL, and home URL. The full Editor also uses realtime scene/asset/messenger flows and script-parse pipeline messages.
-   Therefore the first PLAN must choose an explicit integration seam:
    -   Serve a real upstream Editor shell with Universo-injected `window.config` and implement enough local REST/realtime compatibility for the first flow.
    -   Patch/add a narrow Universo bridge seam inside the vendored Editor artifact and keep storage operations postMessage-driven.
    -   Use a hybrid, where `window.config` boots the Editor while a typed bridge provides storage and host commands.
        Pure postMessage-only is not proven sufficient for the full upstream Editor because the upstream app has direct config, REST, and realtime assumptions.
-   The current host iframe uses `sandbox="allow-scripts"` without `allow-same-origin`. That preserves stronger isolation but creates an opaque-origin frame for many browser purposes. PLAN must explicitly handle `event.origin === "null"` by validating `event.source`, a bridge session nonce/token, request ids, message schema, capability version, and expiry.
-   If the real Editor requires `allow-same-origin`, service workers, workers, popups, downloads, local storage, or broader network access, that is a security design change, not a mechanical iframe fix. The backend artifact CSP currently includes `sandbox allow-scripts`, `connect-src 'self'`, `frame-ancestors 'self'`, and script relaxations for upstream needs; any relaxation must be route-specific and justified.
-   MDN and OWASP guidance supports strict postMessage validation: sender identity must be checked through origin and/or source, received message syntax must be validated, and exact target origins should be used where the receiver has a stable origin. In opaque sandbox mode, exact-origin validation alone is impossible, and host-to-frame messages may not have a stable exact `targetOrigin`; PLAN must document that target-origin tradeoff and compensate with source identity, session nonce, schema validation, request ids, expiry, and capability checks.
-   The bridge protocol should use shared TypeScript contracts plus strict Zod schemas, not ad hoc `typeof` checks scattered across iframe and host code. Context7 Zod docs confirm `safeParse` returns a success/error result without throwing, which fits untrusted `postMessage` payload validation and localized error mapping.
-   Vite `base` matters for the real artifact route because the backend serves assets under a nested tokenized path. Context7 confirms Vite rewrites built asset URLs according to `base`, and `base: "./"` or `""` is the documented approach when the deployment base is unknown or embedded.
-   Current artifact tokening is short-lived and path-based. Multi-asset Editor pages must keep relative asset URLs and token lifetime consistent, otherwise `index.html` can load but chunk/CSS/worker URLs can fail after navigation, reload, or delayed chunk loading.
-   The host currently does not pass enough Editor session context. It loads an artifact or development URL and locale, but does not establish a selected/default project, bridge nonce, read/write mode, capability descriptor, or compatibility status.
-   Package attachment config already has a `playcanvasProject.defaultProjectId`, and backend validation ensures the configured default project exists. This is the correct initial selection source, but actual project/scene/asset/script/generated payloads must remain in PlayCanvas project storage, not package config.
-   The frontend PlayCanvas projects API is behind the backend. Frontend currently wraps project list/create/update/delete only, while backend routes already cover scene/asset/project-file reads and writes plus publish/export. Script assets, script bindings, and generated artifacts currently have write endpoints, but no first-class list/get routes except through export/snapshot-style flows. The bridge needs either a typed frontend adapter over the existing routes or a narrow bridge-specific command endpoint.
-   A narrow bridge command endpoint is worth considering because it can hide ordered storage writes, checksum handling, and conflict mapping from iframe/UI code. If using low-level REST routes directly, the frontend adapter must still enforce ordering and map backend errors to localized user states.
-   Existing backend storage writes are deliberately stricter than a normal "save scene JSON" operation. Metadata must already reference a `payloadFile` or `file` path before file content is written, file writes require checksum guards, and metadata/status must be refreshed after content writes. Save order must be part of the adapter contract.
-   Read-only Editor mode is not available today. Existing project reads and writes require `manageMetahub`, and tests assert the permission requirement. The first slice should remain manager-only unless PLAN adds explicit read permission, non-mutating routes, and server-side mutation rejection.
-   The current file store supports JSON/JS/MJS only, with strict path, MIME, symlink/traversal, namespace, and size constraints. Binary textures, models, audio, and large asset pipelines should stay outside the first flow unless a separate provider/storage decision expands the file service.
-   PlayCanvas script semantics must stay separated from scene JSON. Shared types already model script assets, parsed attributes, scene bindings, generated artifacts, and runtime manifests. Context7 PlayCanvas Engine docs confirm ESM runtime loading depends on `.mjs` modules, class `scriptName`, and asset `data.scripts` schema. Scene-level attribute values must remain separate from script asset schema.
-   PlayCanvas docs confirm script attributes are the Editor-visible configurable interface. The adapter should preserve `scriptName`, `scriptKind`, parsed attribute schema, parse diagnostics, generated artifact checksums, and scene-level attribute values rather than embedding generated code or attribute metadata into arbitrary scene JSON fields.
-   Runtime publication must remain explicit. Local docs and application sync code show published applications consume normalized PlayCanvas runtime manifests from publication snapshots, not live authoring files. Editor save should update metahub authoring state only, not silently update runtime applications.
-   The current `apps-template-mui` PlayCanvas runtime surface is not an Editor scene runner yet. Any handoff from this brief to runtime should be limited to preserving or producing normalized manifests for later runtime work, not wiring live Editor scene JSON directly into the widget.
-   Current E2E coverage proves the package panel/placeholder host, not real Editor readiness. The new brief needs browser evidence for nonblank real artifact, handshake, save/reopen persistence, conflict states, desktop/mobile framing, focus/keyboard behavior, and no page-level overflow.
-   User-facing UI must not leak raw ids, tokens, paths, raw JSON, backend stack traces, or Zod/internal validation details. This is especially important for bridge conflicts, artifact token expiry, missing artifact manifests, blocked permissions, and storage checksum errors.

## Conflicts And Uncertainty

-   The brief correctly asks for a "real Editor runtime host", but the existing package intentionally prevents that by replacing `index.html` with an unavailable page. PLAN must first define a supported real artifact mode and manifest contract.
-   Upstream Editor source suggests a full Editor session expects local equivalents for config, REST, realtime, and asset/script parse pipeline behavior. It is uncertain how little of that can be implemented before a simple scene can be created and saved without PlayCanvas Cloud.
-   PlayCanvas public docs on iframe communication and self-hosting primarily describe published PlayCanvas applications/builds, not self-hosting the open-source Editor with a replacement backend. They support general iframe/static path decisions but are not a complete Editor bridge recipe.
-   The safest sandbox remains `allow-scripts` without `allow-same-origin`, but this may break parts of a real Editor artifact. There is no evidence yet that the full Editor can run under the current sandbox. PLAN should test this before broadening permissions.
-   Development URL bridge support is unresolved. Supporting bridge commands against a dev URL can help local iteration but increases origin/allowlist and token-leak risk. Artifact-only bridge support is simpler for the first production path.
-   Existing backend routes include many storage operations, but script assets, bindings, and generated artifacts do not currently have first-class list/get route coverage. If the first slice includes scripts beyond simple scene JSON, read/list contracts must be added or the bridge must deliberately consume export/snapshot-shaped project state.
-   The Node requirement remains a cross-cutting risk. Upstream Editor/package foundation requires Node `>=22.22.0`, while the broader repo baseline previously tolerated `>=22.6.0`. Root build enrollment should remain explicit.

## Project Implications

-   Implementation planning must start in `packages/universo-react-playcanvas-editor`, not only in the metahub iframe host. The artifact package needs a real supported host mode, manifest field, readiness checks, Vite base strategy, and an injection point for Universo bootstrap/config.
-   The backend artifact route must prove that it serves the real Editor shell plus chunks/assets/workers with correct content types, cache policy, CSP, token behavior, and traversal protection before frontend considers the Editor available.
-   `PlayCanvasEditorHostPage.tsx` should evolve from URL-only iframe loading into a host session controller: selected/default project, bridge session descriptor, nonce/expiry, capabilities, read/write mode, compatibility state, dirty-state close guards, and localized blocked states.
-   `playcanvasProjectsApi.ts` needs expansion or replacement with a bridge adapter facade. A bridge-specific endpoint may be preferable for the first flow because it can keep write ordering, checksums, conflict envelopes, and permission decisions server-side and typed.
-   If a bridge-specific endpoint is added, define request/response envelopes in shared types with Zod validation and update REST/OpenAPI documentation. The endpoint should return structured machine-readable error codes for the host while the MUI surface maps them to localized user-facing messages.
-   Backend storage code should not be weakened for the bridge. The adapter should follow the existing sequence: upsert metadata with intended file reference, write file with `expectedCurrentChecksum`, update ready/status/checksum metadata, refresh project/scene summary, then report conflicts in a user-readable form.
-   Keep the first usable path intentionally small: selected/default project, one scene load, one scene save, minimal JSON assets needed by that scene, and save/reopen persistence. Gate scripts, bindings, generated artifacts, publish, export, and runtime manifests behind explicit capabilities until basic persistence is stable.
-   Do not add binary asset handling, S3/provider admin settings, PlayCanvas Cloud parity, collaboration, Colyseus gameplay metadata, or AI/MCP authoring into this implementation plan. Those are legitimate later briefs but would obscure the first real Editor integration risk.
-   Permission UX should remain manager-only unless the PLAN deliberately adds read-only routes. Hiding buttons in the UI is insufficient; backend mutation attempts from the bridge must be rejected by permission and capability checks.
-   Runtime publication and application sync should remain explicit operations. Editor save should not call publish/sync implicitly and should not mutate `_app_playcanvas_manifests` directly.
-   Browser QA should include iframe/canvas-specific evidence: nonblank artifact, correct frame sizing on desktop/mobile, successful handshake, save/reopen, stale checksum conflict, blocked permission state, missing/stale artifact state, keyboard/focus behavior, no horizontal overflow, and no raw technical leakage.

## Recommended Decision

Proceed to PLAN, but treat the first implementation as a proof of the real host seam before expanding feature coverage.

Recommended first slice:

1. Add a real artifact mode in `@universo-react/playcanvas-editor` with an explicit manifest contract, Vite base-path strategy, and Universo bootstrap/config injection. Keep `artifact-only` placeholder mode as a fail-closed fallback.
2. Build a host bootstrap descriptor that contains metahub id, package slug, default/selected PlayCanvas project, bridge protocol version, session nonce, expiry, capabilities, write mode, and compatibility/readiness status.
3. Implement a typed bridge with shared contracts, strict Zod schemas, request ids, timeout/error envelopes, dirty-state events, `event.source` validation, and explicit opaque-origin handling for the current sandbox.
4. Implement only the minimum storage adapter needed for a simple save/reopen flow: load selected project, list/read one scene, write one scene payload through existing ordered metadata/file semantics, and refresh status/conflict state.
5. Keep script assets, script bindings, generated artifacts, publish/export, and runtime manifest operations capability-gated until the simple scene path is proven by browser evidence.
6. Keep all project operations manager-only unless PLAN intentionally designs a read-only permission/API addition.
7. Preserve explicit publication: Editor save updates metahub authoring storage only.

Do not claim full PlayCanvas Cloud parity. The milestone should be "real Universo-hosted Editor artifact can boot, handshake, and persist a simple scene through Platformo storage" rather than "the full upstream Editor works like PlayCanvas Cloud."

## Open Questions Before PLAN

-   What is the smallest viable upstream seam for the first real flow: injected `window.config` plus local REST/realtime shim, postMessage-only storage bridge with patched Editor seams, or a hybrid?
-   Can the real Editor artifact boot under the current `sandbox="allow-scripts"` and CSP sandbox, or is `allow-same-origin` or another relaxation required?
-   Should bridge support be allowed for development URL mode, or limited to the production artifact route until token/origin behavior is stable?
-   Should the first storage bridge use low-level existing REST routes through a frontend adapter, or a narrow bridge-specific command endpoint that hides ordered writes and conflicts?
-   If a bridge-specific endpoint is chosen, which shared type/Zod envelope and OpenAPI contract should be canonical for bridge commands, errors, and capability discovery?
-   Which exact scene format should be accepted for the first save/reopen proof, and how much of upstream Editor scene/entity/asset shape must be normalized before writing?
-   Are script assets mandatory for the first real Editor flow, or can they remain capability-disabled until scene-only persistence is proven?
-   If read-only authoring is needed, which permission owns it and which project routes can safely expose non-mutating data without `manageMetahub`?
-   Why is `@universo-react/utils` affected in the brief: bridge endpoint executor/auth/error helper changes, shared schema/validation helpers, or should this package be removed from PLAN scope?
-   How will Node `>=22.22.0` for the Editor artifact build be handled in local development and CI without accidentally breaking the root workspace baseline?

## Sources

-   private Manager brief
-   private Manager source input
-   `memory-bank/research/playcanvas-editor-package-foundation-research-2026-05-31.md`
-   `memory-bank/research/playcanvas-editor-metahub-authoring-surface-settings-research-2026-06-01.md`
-   `memory-bank/research/modules-external-files-playcanvas-research-2026-06-01.md`
-   `memory-bank/research/playcanvas-project-storage-model-for-metahubs-research-2026-06-03.md`
-   `packages/universo-react-playcanvas-editor/README.md`
-   `packages/universo-react-playcanvas-editor/README-RU.md`
-   `packages/universo-react-playcanvas-editor/vendor/UPSTREAM.md`
-   `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/AGENTS.md`
-   `packages/universo-react-playcanvas-editor/scripts/build-editor.mjs`
-   `packages/universo-react-playcanvas-editor/scripts/lib/playcanvas-editor-artifact.mjs`
-   `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/src/common/editor.ts`
-   `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/src/editor/realtime/realtime.ts`
-   `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/src/editor/assets/handle-script-parse.ts`
-   `packages/universo-react-playcanvas-editor/vendor/playcanvas-editor/src/editor/assets/assets-create-script.ts`
-   `packages/universo-react-metahubs-frontend/src/domains/packages/ui/PlayCanvasEditorHostPage.tsx`
-   `packages/universo-react-metahubs-frontend/src/domains/packages/api/playcanvasProjectsApi.ts`
-   `packages/universo-react-metahubs-backend/src/domains/packages/controllers/packagesController.ts`
-   `packages/universo-react-metahubs-backend/src/domains/packages/services/packageConfigValidation.ts`
-   `packages/universo-react-metahubs-backend/src/domains/packages/routes/packagesRoutes.ts`
-   `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/routes/playCanvasProjectsRoutes.ts`
-   `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/controllers/playCanvasProjectsController.ts`
-   `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectsService.ts`
-   `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectFileService.ts`
-   `packages/universo-react-metahubs-backend/src/tests/controllers/playCanvasProjectsController.test.ts`
-   `packages/universo-react-types/src/common/playcanvasProjects.ts`
-   `packages/universo-react-types/src/common/packages.ts`
-   `docs/en/platform/playcanvas-editor.md`
-   `docs/ru/platform/playcanvas-editor.md`
-   `docs/en/platform/playcanvas-projects.md`
-   `docs/ru/platform/playcanvas-projects.md`
-   `packages/universo-react-applications-backend/src/routes/sync/syncPlayCanvasPersistence.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx`
-   `packages/universo-react-rest-docs/src/openapi/index.yml`
-   `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectSnapshotService.ts`
-   `tools/testing/e2e/specs/flows/metahub-packages-resources.spec.ts`
-   `https://github.com/playcanvas/editor`
-   `https://developer.playcanvas.com/user-manual/editor/editor-api/`
-   `https://developer.playcanvas.com/user-manual/scripting/esm-scripts/`
-   `https://developer.playcanvas.com/user-manual/scripting/script-attributes/`
-   `https://developer.playcanvas.com/user-manual/editor/publishing/web/communicating-webpage/`
-   `https://developer.playcanvas.com/user-manual/editor/publishing/web/self-hosting/`
-   `https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage`
-   `https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe`
-   `https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox`
-   `https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html`
-   Context7 `/vitejs/vite`
-   Context7 `/playcanvas/engine`
-   Context7 `/colinhacks/zod`
-   `.agents/skills/research-before-plan/SKILL.md`
-   `.agents/skills/universo-platform-architecture/SKILL.md`
-   `.agents/skills/browser-3d-runtime-integration/SKILL.md`
-   `.agents/skills/playcanvas-engine-runtime/SKILL.md`
-   `.agents/skills/runtime-ux-qa/SKILL.md`
-   `.agents/skills/playwright-best-practices/SKILL.md`
