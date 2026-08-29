# Research: PlayCanvas Engine, Editor, and Colyseus Stable Upgrade Gate

> Created: 2026-08-21
> Status: Reviewed
> Trigger: `RESEARCH` request to extend and validate the manager-only PlayCanvas Engine, Editor, and Colyseus upgrade brief.
> Follow-up plan: TBD

## Research Question

What is currently true about the repository, the linked historical research, and the current stable upstream PlayCanvas Engine, open-source Editor frontend, and Colyseus lines, and what must the next PLAN resolve before these dependencies can be upgraded safely?

This document researches an upgrade prerequisite. It does not change application code, dependency declarations, vendored Editor files, the lockfile, fixtures, or migrations, and it does not attempt PlayCanvas Cloud backend parity.

## Scope And Method

The research combined:

-   the supplied bilingual brief and all four linked historical research artifacts;
-   current package manifests, lockfile/catalog policy, wrapper READMEs, runtime consumers, compatible Editor backend, artifact host, package registry, compiler/runtime shims, tests, and canonical MMOOMM fixtures;
-   OntoIndex semantic exploration followed by direct source inspection where graph confidence or dynamic edges were insufficient;
-   current Context7 documentation for `/playcanvas/engine`, `/playcanvas/editor`, and `/colyseus/docs`;
-   official tagged releases, tagged source/manifests, pull requests, npm registry metadata, and pnpm supply-chain documentation; and
-   independent read-only subagent reviews of the Engine/runtime/registry and Editor/backend surfaces.

OntoIndex matched the committed source HEAD at research time, but reported only `review` authority because the worktree contained five documentation-only changes and its source manifest confidence was medium. No source file was dirty. Graph results were therefore used for discovery, not as a substitute for current source and lockfile evidence.

## Source Inventory

| Source                                                                                  | Role                                                         | Freshness                     | Authority / limitation                                         |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------- | -------------------------------------------------------------- |
| Supplied upgrade brief                                                                  | Requested scope and acceptance baseline                      | 2026-08-21                    | Project intent; findings below may strengthen it               |
| Four linked `memory-bank/research` artifacts                                            | Earlier architecture, Editor, runtime, and E2E decisions     | 2026-05-27 through 2026-06-15 | Historical context; old versions are not current targets       |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml`, wrapper manifests                              | Installed/catalog versions and supply-chain policy           | Current worktree              | Normative local state                                          |
| Runtime, compatible-backend, registry, compiler/runtime, and E2E sources named below    | Reachability and contract evidence                           | Current committed source      | Normative local implementation                                 |
| Context7 `/playcanvas/engine`                                                           | Application/canvas lifecycle and event cleanup               | Queried 2026-08-21            | Useful API guidance; not version-delta authority               |
| Context7 `/playcanvas/editor`                                                           | Open-source frontend boot and `window.config` page model     | Queried 2026-08-21            | High-level only; tagged source is normative for `v2.30.4`      |
| Context7 `/colyseus/docs`                                                               | Room lifecycle, Schema state, fixed simulation, reconnection | Queried 2026-08-21            | Current documentation; package tags/manifests remain normative |
| Official Engine `2.19.0`, `2.20.0`, `2.21.0`, `2.21.4` releases                         | Runtime delta                                                | Checked 2026-08-21            | Primary upstream release evidence                              |
| Editor `v2.30.4` release, tag, compare, manifest, schema/config source, PRs #2197/#2182 | Vendored frontend delta and compatible-backend contract      | Checked 2026-08-21            | Primary version-specific evidence                              |
| Colyseus docs, core releases `0.17.48`/`0.17.49`, issue #942, npm manifests             | Protocol/reconnect/security delta                            | Checked 2026-08-21            | Primary upstream evidence; issue #942 remains unresolved       |
| pnpm settings and supply-chain docs                                                     | Release-age and dependency policy semantics                  | Checked 2026-08-21            | Primary package-manager evidence                               |

## Verified Version And Policy Snapshot

### Current repository state

| Surface                   | Current version / rule                                  | Local source of truth                                |
| ------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| Runtime PlayCanvas Engine | `playcanvas 2.18.1`                                     | pnpm catalog and `@universo-react/playcanvas-engine` |
| Vendored Editor           | `playcanvas/editor v2.24.2`                             | vendor metadata and frontend constants               |
| Editor-embedded Engine    | `playcanvas 2.19.5`                                     | Editor package-local direct dependency               |
| Colyseus server           | `@colyseus/core 0.17.43`                                | pnpm catalog and server wrapper                      |
| Colyseus client           | `@colyseus/sdk 0.17.42`                                 | pnpm catalog and client wrapper                      |
| Colyseus Schema           | `@colyseus/schema 4.0.25`                               | pnpm catalog/lockfile                                |
| Colyseus transport        | `@colyseus/ws-transport 0.17.13`                        | pnpm catalog/lockfile                                |
| ShareDB                   | `3.3.2`                                                 | pnpm catalog and Editor stack                        |
| Zod                       | repository override `^3.25.76`                          | root pnpm policy                                     |
| Release quarantine        | 10,080 minutes / seven days                             | `minimumReleaseAge`                                  |
| Release-age exceptions    | `qs`, `playcanvas`                                      | `minimumReleaseAgeExclude`                           |
| Supply-chain controls     | `blockExoticSubdeps: true`, `trustPolicy: no-downgrade` | root pnpm policy                                     |

### Candidate snapshot observed on 2026-08-21

| Surface                | Researched candidate | Important qualification                                                                                       |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Runtime Engine         | `playcanvas 2.21.4`  | Stable; published 2026-08-13; existing `playcanvas` exception still requires an explicit keep/remove decision |
| Editor frontend        | tag `v2.30.4`        | Released on the research date; pnpm release-age does not protect a vendored Git tag                           |
| Editor-embedded Engine | `playcanvas 2.21.3`  | Must remain the version selected by the tagged Editor manifest                                                |
| Colyseus core          | `0.17.50`            | Stable; requires Node `>=22.x`; optional peer `zod ^4.1.12`                                                   |
| Colyseus SDK           | `0.17.43`            | Stable; peers Core `0.17.x`; depends on Schema `^4.0.7`                                                       |
| Colyseus Schema        | `4.0.31`             | Published 2026-08-18 04:10 UTC; not eligible under the seven-day policy until 2026-08-25 04:10 UTC            |
| Colyseus transport     | `0.17.13`            | Already current; peers Core `0.17.x`                                                                          |

`playcanvas 2.22` beta, Colyseus `0.18`, and Schema `5` are prerelease/non-default lanes and are outside this gate. The table is a dated candidate, not an implementation freeze. PLAN must require another manifest, integrity, publication-time, and installability check immediately before IMPLEMENT.

## Key Findings

### 1. The brief has the correct architecture: this is three upgrades, not one aligned version

The runtime wrapper, the Editor's embedded Engine, and the Colyseus protocol set have different ownership and upgrade boundaries. The published MUI runtime imports `@universo-react/playcanvas-engine`; the vendored Editor builds against its own package-local `playcanvas`; the authoritative room imports Core/Schema/transport while the browser client uses the SDK.

**Decision implication:** never deduplicate or force the runtime Engine to the Editor Engine version. Upgrade and verify each line independently, then run cross-surface product evidence.

### 2. Runtime Engine `2.18.1 -> 2.21.4` is locally bounded, but browser proof remains mandatory

The wrapper constructs one `pc.Application` per canvas, owns mouse/touch/keyboard input, uses `FILLMODE_NONE` and `RESOLUTION_AUTO`, exposes resize helpers, procedural geometry/material helpers, and destroys the application on cleanup. `PlayCanvasCanvasWidget.tsx` adds `ResizeObserver` and window-resize cleanup and directly consumes the wrapper.

The official releases show breaking changes concentrated in removed HTML audio fallback, GSplat behavior/casing/ranges, MeshInstance parameter pass flags, and newer rendering/physics paths. Direct inspection found local `MeshInstance` construction but no use of the removed parameter-pass flags. The current MMOOMM and Visual Linkup Lab paths are WebGL2, procedural primitive, standard-material paths; XR, WebGPU, GSplat, and a new physics backend are not required by this upgrade.

**Inference:** no known source-level blocker was found for the wrapper's currently used API subset. This is not runtime compatibility proof. PLAN must map every breaking release item to affected/N/A evidence and retain real Chromium canvas tests for resize, picking, camera aspect, repeated mount/unmount, context/resource cleanup, and localized unsupported-device behavior.

### 3. Bundle and startup cost are part of the Engine acceptance contract

The runtime widget is user-facing and currently loaded inside the generic `apps-template-mui` dashboard. A dependency bump can change chunk size, parse time, graphics initialization, or failure behavior even without a TypeScript break.

Direct inspection found that `widgetRenderer.tsx` statically imports `PlayCanvasCanvasWidget`, while PlayCanvas documents `Application` as a convenience class that pulls the complete Engine into a bundle. An existing, non-clean benchmark build also contains the Engine/runtime strings in the approximately 5 MiB uncompressed main frontend chunk. That artifact is not candidate-version performance proof, but the static dependency edge is conclusive.

**Decision implication:** make a lazy PlayCanvas widget/Engine chunk the recommended baseline, then capture before/after chunk size and startup-to-ready timing and enforce a regression budget in the existing MMOOMM flows. Prove that a dashboard without a `playcanvasCanvas` widget does not download the Engine. Preserve the current bounded canvas and MUI shell; do not import Editor/PCUI internals into published runtime.

The current canvas has no explicit `id`, while tagged Engine keeps an application registry keyed by `canvas.id`; `createBasicApplication()` also attaches keyboard input to `window`, although the current widgets handle interaction separately. This is a pre-existing multi-widget/input-ownership risk rather than a confirmed `2.21.4` regression. PLAN must either support simultaneous 3D widgets with stable unique canvas identity, active-canvas input ownership, and a two-widget test, or declare and enforce a one-widget invariant.

### 4. Editor `v2.30.4` is a compatibility migration, not an artifact replacement

The official compare contains 108 commits across 788 files. The tagged manifest moves the embedded Engine to `2.21.3`, requires Node `>=22.22`, and adds browser font-generation dependencies. The repository root permits Node `>=22.6`, so the Editor build must keep its stricter package-level Node gate.

The tag object, peeled commit, tree, complete inventory, omission manifest, and critical hashes must be recorded. The upstream manifest still references a floating Git `ot-text`; Universo's existing commit pin must be preserved and independently verified rather than copied back to a floating dependency.

The current drift checker is not a sufficient CI oracle: it exits successfully when the optional sibling upstream checkout is absent, ignores symlinks, and says line endings are normalized while hashing raw bytes. A non-skipping check must work from immutable tag/archive/tree evidence and a committed inventory.

### 5. The new Editor schema is a hard boot and behavior gate

Editor PR #2197 and tagged `Schema` source require `version: 1`, `documents`, and `assetData`. The change is recursive JSON Schema, including ordinary keywords and `x-editor-type`, `x-merge-method`, `x-scope`, and `x-open-map`.

Local `buildDefaultEditorSchema()`, shared Zod types, artifact fallback, and hosted config still use the legacy `{ asset, scene, settings }` tree with `$type`, `$default`, `$scope`, `$of`, and related `$*` fields. Wrapping that tree in a new envelope would satisfy neither tagged semantics nor inspector/default/merge behavior.

**Blocker:** identify a canonical and licensed catalog source. The open-source tag consumes a catalog from `window.config` but does not ship a complete production catalog; its small schema file is a test fixture. PLAN must choose either an Universo-owned versioned catalog for explicitly supported surfaces or a separately sourced canonical catalog. Claims of a “complete upstream catalog conversion” are unsupported until this source is identified.

### 6. `window.config` must be tested per page variant, not accepted by permissive parsing

Context7 confirms the upstream hosting model: backend-rendered Editor, Blank/project picker, Code Editor, and Launch pages inject different `window.config` shapes. Tagged types include a top-level version and richer URL, project, user, plan, metrics, and schema objects.

Current local config is compatible with the old shim but diverges from tagged shapes, including string plan fields where upstream expects objects and incomplete project/metrics fields. Permissive Zod passthrough can hide these mismatches.

**Decision implication:** inventory every tagged-source `config.*` access and create shared tagged fixtures/contracts for Editor, Blank/CMS, Code Editor, and Launch. Each page must be explicitly supported, disabled, or deferred.

### 7. Code Editor and Launch are currently bundle-present but product-nonfunctional

The artifact smoke requires `js/code-editor.js` and `js/launch.js`, but the application serves only the main Editor shell. Tagged Editor navigates to `/editor/code/${projectId}` and constructs launch URLs from `url.launch`; local routing/config does not provide corresponding token-scoped shells. Bundle existence is not route or boot evidence.

**Decision implication:** either add isolated, token-scoped shell/config/route fixtures and browser tests for each supported page, or hide/disable the actions with localized unavailable states. Do not leave controls that end in raw 404, HTML parse errors, or a blank shell.

### 8. ShareDB `documents` is a hard Code Editor gate

Local realtime accepts only `scenes | assets | settings | user_data`, and signed claims cover numeric asset documents. Tagged Code Editor calls `connection.get('documents', uniqueId)`. PR #2182 fixes a close/immediate-reopen race involving delayed destruction of a ShareDB document.

**Blocker:** supporting Code Editor requires a project-owned source-file mapping, signed least-privilege authorization, persistence, and tests for load/op/save/revert, close-immediate-reopen, delayed unsubscribe/destroy, socket drop/reconnect, and cross-project denial. Otherwise the Code Editor route/action must be intentionally unavailable.

### 9. Artifact-token lifetime is incompatible with newly lazy-loaded Editor assets

The artifact base token is validated for each file and expires after five minutes; static non-HTML files also receive a 300-second private cache lifetime. Realtime/bridge session refresh does not renew that base token. Candidate Editor adds or increases lazy chunks, worker/WASM, Code Editor, Launch, and font assets that may first load after five minutes.

**Inference:** an otherwise valid long-running Editor session can receive 404 responses for late-loaded resources. PLAN must define renewable session-bound artifact delivery or stable authenticated asset URLs and include an interaction that first loads a lazy asset after the current TTL.

### 10. Browser font generation is a full asset mutation pipeline, not a MIME-only change

Candidate Editor uses `@playcanvas/font-tools` and `@playcanvas/msdfgen-wasm` to create a source TTF/OTF asset, JSON descriptor, and one or more PNG atlases through worker/WASM and asset mutations. Local compatibility routes expose mainly GET asset surfaces and do not provide the required multipart create/upload lifecycle.

**Decision implication:** either support the complete typed pipeline with size/content validation, worker/WASM CSP and MIME, `source_asset_id`, atlas references, realtime additions, rollback/orphan cleanup, and reload persistence, or hide/fail closed the import action. A partial UI that only reaches an unsupported POST is not acceptable.

### 11. Editor MCP must remain disabled unless separately hardened

`v2.30.4` only changes MCP loopback resolution from `localhost` to `127.0.0.1`. The UI can persist auto-connect and a port and repeatedly connect to a loopback WebSocket. The official sidecar is a useful upstream reference but is not an authenticated multi-tenant Universo service.

**Decision implication:** default to unsupported/hidden. Enabling it requires a separately pinned/reviewed sidecar, loopback bind, constrained port, per-session handshake secret, exact origin policy, dedicated CSP, explicit consent/persistence decision, sandbox/null-origin decision, and negative origin/port/CSP tests. Do not widen the standard Editor artifact CSP.

### 12. Automatic Editor migrations need data-safety gates

Candidate Editor contains Engine v1-to-v2 project and batched entity/asset migrations. The compatible realtime layer persists documents independently after ShareDB writes.

**Inference:** merely opening a project could partially persist a multi-document upstream migration. PLAN must add a checkpoint/backup, dry-run or preflight, idempotence, failure injection, recoverability, and an explicit transaction/ordering model before upgraded authoring is accepted.

### 13. Numeric compatibility IDs need collision handling before high-volume asset creation

The backend derives PlayCanvas-shaped numeric IDs from UUIDs through a 31-bit hash without a persisted bijective map. Existing scale makes collisions unlikely, but font generation and broader asset support increase the number of generated IDs.

**Decision implication:** PLAN should require a persisted per-project mapping or collision detection/retry with a uniqueness invariant before broad asset mutation support. Probability alone is not a fail-closed authorization or persistence contract.

### 14. Colyseus must move as one real protocol set

The local authoritative room uses Core, Schema, and WebSocket transport; the widget client uses the SDK. It has signed scoped auth, an origin-filtered upgrade proxy, server-owned movement, fixed ticks, rate limiting, observer read-only behavior, `onDrop`, reconnection reservation, `onReconnect`, and `onLeave` cleanup.

Core `0.17.48` fixed a reconnection flow when `onDrop` awaits `allowReconnection` and a stale connection remains open. Core `0.17.49` fixed duplicate leave/negative CCU behavior. These changes touch the exact lifecycle used locally. Current tests extensively mock the Room base and transport, so they cannot prove compatibility of the installed Core/SDK/Schema/transport combination.

**Decision implication:** test the coherent set with the real libraries, server, transport, and at least two browser clients. The acceptance oracle must prove drop -> reconnect to the same session/ship with no premature leave, continued state patches and RBAC revalidation, followed by timeout/consented leave exactly once with no duplicate ship or negative CCU.

### 15. The current `onDrop` pattern deserves an explicit compatibility decision

Local `onDrop` calls a helper that starts `allowReconnection(...).catch(...)` with `void`; it does not return or await that promise. This may be a deliberate non-blocking design, but it differs from the lifecycle emphasized by the upstream reconnection fix.

**Decision implication:** PLAN must decide the intended Core `0.17.50` lifecycle after testing stale-socket, immediate reconnect, timeout, and shutdown paths. Do not mechanically change the method merely to imitate documentation; prove which form preserves local ship reservation and exactly-once cleanup.

### 16. The unresolved LocalPresence issue is reachable by default configuration

Colyseus issue #942 describes prototype-key behavior in `LocalPresence` and remained open during research. Local application code does not import `LocalPresence`, but the `new Server({ transport, gracefullyShutdown, greet })` call supplies no custom presence. Therefore the default local presence path is in the effective configuration even though it is not named in source.

**Security implication:** the brief's “prove unreachable or mitigate” gate is necessary. Audit whether any user-derived room/scope/channel key can reach vulnerable presence operations. If reachability cannot be excluded, patch/upgrade/configure a safe presence strategy before acceptance; do not rely on the absence of a direct import.

### 17. Colyseus `0.17.50` conflicts with the repository's global Zod 3 policy on paper

The installed Core `0.17.43` lockfile entry declares optional peer `zod 3.25.76`, matching the repository's Zod 3 resolution. Candidate Core `0.17.50` instead declares optional peer `zod ^4.1.12`. The Zod 4 mismatch is therefore introduced by the candidate upgrade, not inherited debt as stated in the supplied brief.

**Decision implication:** inspect the packed candidate and the used Core paths, perform strict peer/install/type/build checks, and run the real runtime. Either prove the optional Zod path is not loaded, approve a scoped dual-version/Zod 4 strategy, or hold the target. A monorepo-wide Zod 4 migration is a separate scope requiring approval.

### 18. Package registry identity is not the same as upstream dependency version

All four registry seeds currently use wrapper version `0.1.0`; `source.upstreamVersion` carries the upstream library/tag. Module manifests and snapshot attachments select packages by wrapper `{ packageName, version }`. Changing only `upstreamVersion` would change the meaning of an existing wrapper version and can invalidate old snapshot expectations.

The supposedly legacy checksum is also not truly frozen: `legacyBuiltinPackageSeedChecksumSource` includes every non-Editor seed dynamically. Adding upgraded `0.2.0` rows to the same array would change the historical migration checksum and cause the old migration path to seed new data.

**Blocker:** freeze the exact original three-row legacy checksum source byte-for-byte (`colyseus-client@0.1.0`, `colyseus-server@0.1.0`, and `playcanvas-engine@0.1.0`) and introduce a separate forward migration/checksum source for new wrapper records. PLAN must choose new wrapper versions and a default-selection rule while proving old `0.1.0` snapshot import and execution. The current frontend already sorts attached-package candidates by numeric wrapper version, so a new `0.2.0` row is a compatible default-selection candidate without mutating existing attachments.

### 19. Executable module resolution currently ignores package version

The compiler validates a small allowlist and records package imports, but emitted bundles keep external package names. `browserModuleRuntime.ts` and the server module runtime satisfy those imports from hard-coded helper objects selected only by package name. They do not load the workspace wrapper and do not receive or check the wrapper version.

**Implication:** updating registry metadata does not update these embedded helper implementations, while attaching `0.1.0` versus a future `0.2.0` also does not alter runtime resolution. PLAN must either preserve identical helper ABI/semantics across versions or add version-aware runtime resolution. Tests must cover legacy and new manifests and reject source/version mismatches.

### 20. Canonical fixtures must be regenerated through the product flow

Both MMOOMM snapshot fixtures embed old wrapper/upstream descriptors and compiled artifacts. Existing E2E already provides generator, import, canvas, multi-client, and reconnect foundations. Hand-editing JSON would bypass publication hashes, package attachment resolution, and provenance.

Snapshot restore performs exact registry lookup using package name, wrapper version, and source descriptor, then clears stored bundles so published access recompiles from source. Current fixture contracts check package name/version/target but do not fully assert `upstreamPackageName`, `upstreamVersion`, `importName`, and exact module `packageImports` versions.

**Decision implication:** strengthen provenance assertions; update generator inputs/UI flows; republish; export; run the fixture contract/drift checks; then import and execute the regenerated fixture. Preserve a legacy fixture or targeted legacy snapshot test long enough to prove backward resolution. Include negative cases for mismatched wrapper/upstream descriptors and unknown wrapper versions before worker execution.

### 21. Existing browser/runtime evidence should be reused, not replaced with mocks

`mmoommRuntimeProof.ts` and the local-Supabase flows already cover visible canvas state, multi-client behavior, reconnect, and runtime UX. The correct upgrade evidence adds desktop/tablet/mobile canvas bounds, nonblank pixels, resize/picking/camera, focus exit, no page overflow, no raw IDs/protocol errors, cleanup, WebSocket frames/close events, and Editor save/reload/reopen behavior.

Mocked Engine or Room unit tests are valuable for deterministic logic but are not sufficient proof for WebGL, iframe, ShareDB, asset token, or reconnect compatibility.

Current Playwright projects and MMOOMM scripts run Chromium only. Chromium remains the mandatory proof browser; Firefox/WebKit smoke must be added if the product claims cross-browser support. The cleanup oracle should include repeated Flight/Visual Lab mount cycles, listener/context counts, initialization failure without WebGL2, and `webglcontextlost`/restore handling or a localized terminal state.

## Conflicts And Uncertainty

-   **Fresh stable versus repository quarantine:** Schema `4.0.31` was current stable but ineligible on the research date. Editor `v2.30.4` was a same-day Git tag outside pnpm quarantine. PLAN must schedule or re-freeze, not add broad exceptions.
-   **Full schema catalog provenance:** the tagged open-source frontend does not contain the production catalog it consumes. Ownership and licensing remain unresolved and are a pre-implementation evidence gate.
-   **Editor surface promise:** built bundles do not prove supported Code Editor, Launch, fonts, MCP, VCS, or publish behavior. Each needs a supported/disabled/deferred verdict.
-   **Zod peer compatibility:** manifest mismatch is confirmed; actual runtime reachability in the selected Core paths still needs packed-source and real-server proof.
-   **LocalPresence reachability severity:** default configuration is confirmed, but the exact user-controlled key path and viable mitigation need a focused security trace.
-   **Registry compatibility policy:** clean test databases make fixture regeneration easy, but package/snapshot contracts are product data contracts. Whether legacy wrapper records remain indefinitely or through a bounded migration window is a product decision.
-   **Editor automatic migration atomicity:** upstream migration behavior and local per-document persistence are confirmed independently; partial-persistence failure behavior has not yet been reproduced.
-   **Lazy asset renewal:** the five-minute token boundary is confirmed; the preferred renewable delivery design remains open.

## Project Implications

-   The supplied brief is directionally correct and substantially stronger than a dependency-bump request. The next PLAN should use it, with the hard gates and uncertainties in this research made explicit.
-   Sequence the work as a compatibility program: version/provenance freeze; registry migration design; runtime Engine; Colyseus coherent set; atomic Editor import; schema/config/realtime/backend migration; artifact/font/page capability gates; fixture regeneration; product/browser evidence; final graph and Thermos review.
-   Keep runtime UI in `packages/universo-react-apps-template-mui`, use current MUI primitives and localized states, and prevent raw IDs, JSON, protocol payloads, or unsupported controls from leaking into normal surfaces.
-   Keep Editor frontend vendoring isolated. Universo continues to own config, REST, storage, ShareDB, messenger/relay, artifact delivery, iframe bridge, authentication, authorization, origin, CSP, and migration safety.
-   Keep the committed legacy seed/checksum immutable. An upgrade is a new wrapper/package definition and forward migration, not a semantic rewrite of `0.1.0`.
-   Treat direct wrapper consumers and embedded name-only module shims as different execution paths. Both require explicit compatibility tests.
-   Use tagged source/releases/manifests for version-specific claims. Context7 is working and valuable for current API/lifecycle guidance, but it did not contain the detailed `v2.30.4` schema, route, font, MCP, or ShareDB delta.
-   No application code should be changed until PLAN resolves the catalog source, page capability matrix, registry versioning, Zod strategy, LocalPresence disposition, and release-age/soak timing.

## Recommended Decision

Proceed to PLAN, but do not start IMPLEMENT from the candidate table alone.

The recommended planning baseline is:

1. Re-freeze the stable versions, npm integrities/signatures, release dates, tagged Editor provenance, Node constraints, and lockfile resolution immediately before implementation. Do not adopt prerelease lanes.
2. Target runtime Engine `2.21.4` independently from Editor's tagged `2.21.3`, subject to the release ledger and browser/WebGL gates.
3. Target Editor `v2.30.4` only after an explicit same-day-tag soak/approval decision and a canonical schema-catalog decision. Treat schema v1, page-specific config, `documents`, token renewal, automatic migrations, and vendor provenance as blockers.
4. Keep MCP hidden by default. Keep font import, Code Editor, Launch, VCS/build/publish controls hidden or typed unavailable until their complete contracts pass.
5. Target the Colyseus `0.17.x` coherent set (`core 0.17.50`, `sdk 0.17.43`, `schema 4.0.31`, `ws-transport 0.17.13`) only after Schema becomes release-age eligible and the Zod, LocalPresence, and real reconnection gates pass.
6. Freeze the existing legacy registry checksum source and add new wrapper records through a forward migration. Define version-aware runtime resolution or prove helper ABI identity. Preserve and execute legacy snapshot evidence alongside new fixtures.
7. Require real browser/WebGL, iframe, ShareDB, artifact-lifetime, and multi-client WebSocket evidence before declaring the upgrade complete; focused builds and mocked unit tests are necessary but insufficient.

## Open Questions Before PLAN

-   What is the canonical, licensed source and ownership model for the Editor schema v1 catalog?
-   For Editor, Blank/CMS, Code Editor, and Launch, which page variants are supported now, explicitly disabled, or deferred?
-   Should artifact access be renewed by the existing Editor session, or should authenticated static assets use a different stable URL contract?
-   Are browser fonts in this upgrade, or should font import remain hidden until a general asset mutation/upload service is approved?
-   Is MCP explicitly out of the first upgraded Editor milestone, as recommended?
-   What backup/checkpoint and transaction semantics protect automatic upstream migrations from partial persistence?
-   What wrapper versions (for example `0.2.0`) and default-selection rule represent the upgraded Engine, Editor, and Colyseus packages?
-   Does runtime package resolution become version-aware, or will old and new wrapper records intentionally share an identical helper ABI?
-   Can Core's optional Zod 4 path be proven inactive with the repository override, or is a scoped dual-version strategy required?
-   Can the LocalPresence issue be proven unreachable for all user-derived keys, or which mitigation will be adopted?
-   Should implementation wait until both Schema quarantine and an Editor soak interval have elapsed, then re-freeze all candidates together?

## Sources

### Local sources

-   Manager-only PlayCanvas Engine, Editor, and Colyseus upgrade brief.
-   `memory-bank/research/mmoomm-3d-multiplayer-skills-research-2026-05-27.md`
-   `memory-bank/research/mmoomm-flight-simulator-metahub-research-2026-05-28.md`
-   `memory-bank/research/mmoomm-playcanvas-editor-main-functionality-runtime-projection-research-2026-06-10.md`
-   `memory-bank/research/playcanvas-editor-upstream-2-24-2-update-research-2026-06-15.md`
-   `pnpm-workspace.yaml`, `pnpm-lock.yaml`, and root `package.json`
-   `packages/universo-react-playcanvas-engine/src/runtime.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/runtime/browserModuleRuntime.ts`
-   `packages/universo-react-applications-backend/src/realtime/applicationsRealtimeRuntime.ts`
-   `packages/universo-react-modules-engine/src/compiler.ts` and `src/runtime.ts`
-   `packages/universo-react-playcanvas-editor-frontend/vendor/`, artifact scripts, E2E, metadata, and drift tools
-   `packages/universo-react-playcanvas-editor-backend/src/config/index.ts` and `src/realtime/index.ts`
-   `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts`
-   `packages/universo-react-metahubs-backend/src/domains/packages/` and `src/domains/playcanvas-projects/`
-   `tools/testing/e2e/support/mmoommRuntimeProof.ts` and MMOOMM generator/import flows
-   `tools/fixtures/metahubs-mmoomm-flight-app-snapshot.json` and `metahubs-mmoomm-app-snapshot.json`

### Primary external sources

-   [PlayCanvas Engine 2.19.0](https://github.com/playcanvas/engine/releases/tag/v2.19.0)
-   [PlayCanvas Engine 2.20.0](https://github.com/playcanvas/engine/releases/tag/v2.20.0)
-   [PlayCanvas Engine 2.21.0](https://github.com/playcanvas/engine/releases/tag/v2.21.0)
-   [PlayCanvas Engine 2.21.4](https://github.com/playcanvas/engine/releases/tag/v2.21.4)
-   [PlayCanvas Editor v2.30.4](https://github.com/playcanvas/editor/releases/tag/v2.30.4)
-   [Editor v2.24.2...v2.30.4 compare](https://github.com/playcanvas/editor/compare/v2.24.2...v2.30.4)
-   [Tagged Editor manifest](https://raw.githubusercontent.com/playcanvas/editor/v2.30.4/package.json)
-   [Tagged Editor schema implementation](https://raw.githubusercontent.com/playcanvas/editor/v2.30.4/src/editor-api/schema.ts)
-   [Tagged Editor config types](https://raw.githubusercontent.com/playcanvas/editor/v2.30.4/src/editor-api/external-types/config.d.ts)
-   [Editor schema catalog PR #2197](https://github.com/playcanvas/editor/pull/2197)
-   [Code Editor lifecycle PR #2182](https://github.com/playcanvas/editor/pull/2182)
-   [PlayCanvas Editor frontend open-source announcement](https://blog.playcanvas.com/playcanvas-editor-frontend-is-now-open-source/)
-   [Official Editor MCP server](https://github.com/playcanvas/editor-mcp-server)
-   [PlayCanvas font-tools](https://github.com/playcanvas/font-tools)
-   [PlayCanvas msdfgen-wasm](https://github.com/playcanvas/msdfgen-wasm)
-   [Colyseus Room lifecycle](https://docs.colyseus.io/room)
-   [Colyseus reconnection](https://docs.colyseus.io/room/reconnection)
-   [Colyseus 0.17 migration](https://docs.colyseus.io/migrating/0.17)
-   [Core 0.17.48 release](https://github.com/colyseus/colyseus/releases/tag/%40colyseus%2Fcore%400.17.48)
-   [Core 0.17.49 release](https://github.com/colyseus/colyseus/releases/tag/%40colyseus%2Fcore%400.17.49)
-   [Colyseus LocalPresence issue #942](https://github.com/colyseus/colyseus/issues/942)
-   [pnpm settings](https://pnpm.io/settings)
-   [pnpm supply-chain security](https://pnpm.io/supply-chain-security)

### Context7 sources

-   `/playcanvas/engine`
-   `/playcanvas/editor`
-   `/colyseus/docs`
