# MMOOMM PlayCanvas Editor Main Functionality Runtime Projection Implementation Tasks

> Date: 2026-06-10
> Source plan: `memory-bank/plan/mmoomm-playcanvas-editor-main-functionality-runtime-projection-plan-2026-06-10.md`
> Source brief: local manager-only MMOOMM PlayCanvas runtime projection brief, dated 2026-06-09
> Source research: `memory-bank/research/mmoomm-playcanvas-editor-main-functionality-runtime-projection-research-2026-06-10.md`

## Scope

Implement the UI-first MMOOMM PlayCanvas path. The canonical
`metahubs-mmoomm-app-snapshot.json` generator must follow the same visible
product workflow a user follows: create a metahub, connect packages, author the
domain model through existing metahub screens, open the real PlayCanvas Editor,
create/persist the baseline scene through the Editor surface, publish it,
configure the runtime layout/widget through the layout UI, export the snapshot,
and replay it in the published application. API calls may verify state or fetch
ids needed for navigation, but they must not be the primary authoring mechanism
for the MMOOMM configuration.

## UI Contract

-   Metahub creation uses the existing metahub list dialog and the `basic`
    template. The test may look up the created id after the dialog completes.
-   Package connection uses the existing package tab dialogs for PlayCanvas
    Editor, PlayCanvas Engine, Colyseus Client, and Colyseus Server.
-   Domain authoring uses existing entity list and metadata screens for Object,
    Set, Enumeration, option values, fixed values, and modules. If a required
    screen is missing, implement it in the existing metahubs UI rather than
    seeding through API.
-   PlayCanvas authoring opens the hosted Editor iframe/fullscreen surface and
    uses visible Editor or host controls. Direct compatibility REST writes are
    only acceptable behind a user-facing Editor action that mutates the current
    project.
-   Runtime layout configuration uses the layout authoring UI and widget editor
    dialogs. Widget config must not require raw JSON entry for normal users.
-   Export/import/runtime verification may use API calls as oracles, but the
    produced fixture must carry browser-authored provenance.

## Checklist

-   [x] 2026-06-15: Remove empty upstream `New Entity` authoring artifacts from the canonical MMOOMM app fixture generator output.
-   [x] 2026-06-15: Add a product fixture oracle that fails if empty default PlayCanvas entities are exported.
-   [x] 2026-06-15: Regenerate `tools/fixtures/metahubs-mmoomm-app-snapshot.json` through the UI-first Playwright generator and verify fixture drift.
-   [x] 2026-06-15: Run focused formatting/lint/tests plus local minimal Supabase Playwright evidence for the regenerated fixture.
-   [x] 2026-06-14: Normalize PlayCanvas Editor compatibility scene saves so browser-authored MMOOMM entities publish with `metadata.mmoomm.scene`.
-   [x] 2026-06-14: Add focused backend regression coverage for direct compatibility scene saves and published runtime manifest metadata.
-   [ ] 2026-06-14: Re-run focused backend checks plus local minimal Supabase Playwright generator/runtime proof.
-   [ ] 2026-06-14: Run Thermos/autoreview closeout and update Memory Bank progress.
-   [x] Phase 0: Record the original implementation checklist and verify the backend/runtime gap map.
-   [x] Phase 1: Extend shared contracts for PlayCanvas sourcefiles, image assets, runtime manifest widget bindings, and browser-authored fixture provenance.
-   [x] Phase 2: Extend metahub PlayCanvas storage for sourcefiles/image assets, ShareDB asset persistence, publish blocking, and persisted runtime manifests.
-   [x] Phase 3: Extend the PlayCanvas Editor compatibility backend routes for sourcefiles, asset CRUD/file reads, publish status, and runtime-safe settings.
-   [x] Phase 4A: Audit existing UI coverage and list every remaining authoring bypass in the MMOOMM generator.
-   [x] Phase 4B: Add missing user-facing UI needed for MMOOMM layout/widget and PlayCanvas publish authoring using existing MUI primitives and localized EN/RU strings.
-   [x] Phase 4C: Replace API authoring in the MMOOMM generator with UI-first steps; keep API only for navigation ids, polling, export, and contract verification. Completed for metahub creation, package connection, Object/Set/Enumeration/option values/fixed values, page content, runtime modules, layout chrome, menu widget, PlayCanvas canvas widget, PlayCanvas project publish, and the iframe-local Universo MMOOMM authoring control that mutates the current Editor scene and persists through the normal Editor save path.
-   [x] Phase 5: Expose published PlayCanvas runtime manifests through applications backend APIs and Colyseus room option resolution.
-   [x] Phase 6: Make `apps-template-mui` consume published PlayCanvas runtime manifests without importing metahub/editor packages.
-   [x] Phase 7: Regenerate `metahubs-mmoomm-app-snapshot.json` from the UI-first generator and validate browser-authored provenance.
-   [x] Phase 8: Add/extend unit, integration, and E2E tests across contracts, storage, runtime, publication hashing, UI authoring, iframe-local MMOOMM authoring controls, and Playwright evidence.
-   [x] Phase 9: Update package READMEs, GitBook docs, Memory Bank progress/current context, then run Prettier, focused checks, and Thermos/autoreview.

## 2026-06-14 Compatibility Closure Checklist

> Scope: close the resumed QA finding where the full upstream PlayCanvas Editor
> frontend could select imported MMOOMM entities but emitted ShareDB JSON0 list
> errors and viewport component errors while authoring/reloading the scene.

-   [x] Keep the vendored PlayCanvas Editor source tree unpatched; implement compatibility only at the Universo bootstrap adapter and backend protocol boundary.
-   [x] Add backend ShareDB `apply` middleware that repairs allowed document snapshots before upstream JSON0 nested list operations are applied.
-   [x] Preserve full-boot WebSocket token, origin, session, and allowed-document checks while adding the snapshot-shape repair.
-   [x] Normalize persisted PlayCanvas `render` and `light` component defaults before handing scene payloads to the upstream Editor API so MMOOMM ship/station boxes hydrate with readable default material and directional key light data.
-   [x] Add regression coverage for empty settings snapshot list-op repair and artifact guard coverage for component normalization.
-   [x] Re-run focused Editor frontend/backend tests, builds, artifact smoke, fixture contract/drift checks, and the local minimal Supabase MMOOMM import/runtime Playwright flow with strict browser regression watcher.

## QA Remediation Checklist

> Date: 2026-06-10
> Scope: close the IMPLEMENT QA findings for security, data safety, UI-first
> evidence, runtime proof, and test reliability without bumping the metahub
> schema/template version because the test database is recreated from scratch.

-   [x] Add strict Origin validation for application Colyseus WebSocket upgrades and tests for allowed, missing, and hostile origins.
-   [x] Persist PlayCanvas application runtime manifests by project plus scene identity instead of project id only, with multi-scene regressions.
-   [x] Make PlayCanvas Editor sourcefile writes/delete lifecycle fail closed and path-accurate for `.js` and `.mjs` files.
-   [x] Replace raw runtime widget codenames/checksums with user-facing selectors/labels and localized validation errors.
-   [x] Remove the always-on MMOOMM shortcut panel from the normal Editor artifact path and gate any automation-only projection control explicitly.
-   [x] Strengthen the MMOOMM Playwright generator/runtime oracle for runtime canvas pixels, viewport matrix, realtime connected/restored, and movement evidence.
-   [x] Stabilize focused frontend/backend tests, run Prettier/lint/build checks, add the main MMOOMM app fixture contract script, and run Thermos/subagent review. Local minimal Supabase Playwright remains the next heavy browser proof command for CI or a dedicated E2E run.

## QA Closure Checklist: Main Editor Workflow and MMOOMM Fixture Proof

> Date: 2026-06-10
> Trigger: IMPLEMENT after QA found that the current slice is still not
> acceptable as the main PlayCanvas Editor + MMOOMM runtime projection target.

-   [x] Add idempotent application schema upgrade for `_app_playcanvas_manifests` project+scene unique index before sync uses the expression conflict target.
-   [x] Make PlayCanvas sourcefile write/delete lifecycle fail closed under stale rollback and concurrent delete/write races.
-   [x] Add metahub additive schema sync for PlayCanvas sourcefile tables without changing the public structure/template version.
-   [x] Replace hidden query-only MMOOMM projection authoring with a documented, localized, user-facing Editor action or a normal upstream Editor workflow.
-   [x] Extend the generator to verify the just-created published application runtime before exporting `metahubs-mmoomm-app-snapshot.json`.
-   [x] Extend the target MMOOMM app runtime proof with viewport matrix, multi-client Colyseus propagation, reconnect, and unsafe mutation oracles.
-   [x] Add CI/package scripts for the main MMOOMM app fixture contract and local-Supabase runtime gate.
-   [x] Add UX canaries for target Resources/modules/layout/runtime surfaces: no raw IDs/JSON, localized validation, semantic fields, and constrained horizontal scroll.
-   [x] Run focused backend/frontend tests, fixture contract, Playwright local-Supabase evidence where feasible, Prettier, and Thermos/autoreview.

## QA Runtime Layout Overflow Closure Checklist

> Date: 2026-06-10
> Trigger: IMPLEMENT after local minimal Supabase Playwright found that the
> MMOOMM PlayCanvas runtime canvas overflowed the tablet viewport.

-   [x] Constrain the apps-template dashboard flex layout and standalone center widgets so PlayCanvas canvas cannot create page-level horizontal overflow.
-   [x] Run focused formatting/lint/tests and rerun the local minimal Supabase MMOOMM app runtime Playwright gate.

## Autoreview P1 Closure Checklist

> Date: 2026-06-10
> Trigger: Thermos/autoreview found concrete P1 regressions in realtime WebSocket
> origin fallback handling and PlayCanvas sourcefile delete concurrency.

-   [x] Preserve the documented `CORS_ORIGINS=*` realtime WebSocket fallback while still rejecting missing or malformed Origins and honoring explicit realtime origin lists.
-   [x] Guard PlayCanvas sourcefile metadata soft-delete with the sourcefile version read before the physical delete.
-   [x] Run focused regressions and rerun Thermos/autoreview.

## QA Imported Editor Viewport And Security Closure Checklist

> Date: 2026-06-13
> Trigger: IMPLEMENT after manual QA proved that imported MMOOMM PlayCanvas Editor scenes expose entities in hierarchy/inspector but do not render boxes in the central viewport.

-   [x] Fix persisted Editor entity hydration so component paths materialize PlayCanvas engine render components and mesh instances.
-   [ ] Add import-first Editor E2E proof that opens the Editor after snapshot import and verifies Ship/Station are renderable in the viewport.
-   [ ] Close PlayCanvas Editor bridge postMessage target-origin fallbacks and replay user binding gaps.
-   [ ] Close sourcefile delete CSRF/checksum and snapshot/sourcefile lifecycle gaps.
-   [ ] Run focused formatting, unit tests, and feasible E2E/browser checks.

## QA User-Reported Runtime And Fixture Closure Checklist

> Date: 2026-06-11
> Trigger: IMPLEMENT continuation after manual QA found stale canonical MMOOMM
> fixture localization/provenance concerns and runtime/editor visual behavior
> gaps.

-   [x] Confirm the tracked MMOOMM app fixture is regenerated only by the UI-first Playwright generator and passes the strict fixture contract.
-   [x] Run the local minimal Supabase generator path for `metahubs-mmoomm-app-snapshot.json`.
-   [x] Run the imported MMOOMM app runtime Playwright proof against the regenerated fixture.
-   [x] Run focused package tests/lint/build checks for the changed PlayCanvas Editor/runtime/backend surfaces.
-   [x] Run Thermos/autoreview and resolve accepted findings.

# PlayCanvas Editor Full Upstream UI WebSocket Implementation Tasks

> Date: 2026-06-05
> Source plan: `memory-bank/plan/playcanvas-editor-upstream-ui-full-boot-plan-2026-06-05.md`
> Source brief: PlayCanvas Editor minimal compatibility backend specification, 2026-06-05.

## Scope

Implement the full upstream PlayCanvas Editor UI boot path inside the existing iframe artifact. The implementation must use the vendored upstream Editor UI, add same-origin WebSocket realtime/messenger/relay services, keep authoring state metahub-scoped, and avoid replacement MUI panels.

## Checklist

-   [x] Add full-boot shared contracts, mode descriptors, token claims, and PlayCanvas-compatible numeric id mapping.
-   [x] Implement backend full-boot config builder and explicit full-boot REST/WS endpoint descriptors.
-   [x] Add PlayCanvas Editor WebSocket runtime attachment at the core HTTP server upgrade point without breaking the existing applications realtime runtime.
-   [x] Implement single-user realtime, messenger, and relay WebSocket semantics required by upstream Editor boot.
-   [x] Implement durable metahub-backed scene/settings document adapter and persistence tests using `DbExecutor.query()` stores.
-   [x] Integrate full-boot ports/adapters in `metahubs-backend` with fail-closed access, origin, and project/scene checks.
-   [x] Add frontend artifact full-boot mode that loads upstream UI without fallback adapter or `/disabled` URLs.
-   [x] Update host shell mode selection and localized unavailable/error states while reusing existing MUI primitives only.
-   [x] Add focused unit/integration tests for contracts, config, WS handshakes, persistence, security negatives, and fallback/full-boot separation.
-   [x] Add Playwright browser evidence for upstream toolbar, hierarchy, viewport canvas, assets panel, inspector, persistence/reload, no fallback, no `/disabled`, and no host technical leakage.
-   [x] Update READMEs, GitBook docs, and Memory Bank progress.
-   [x] Run local minimal Supabase E2E and Playwright browser evidence.
-   [x] Run Prettier and focused build/test checks.

## QA Security And Realtime Persistence Closure Checklist

> Date: 2026-06-07
> Trigger: IMPLEMENT after QA found full-boot token origin, ShareDB scope, stale persistence, and canvas oracle gaps.

-   [x] Restrict full-boot artifact origins/base URLs to trusted same-origin/package-issued values and cover hostile query origins.
-   [x] Enforce exact ShareDB collection/document allowlists per authenticated full-boot session before submit/persist.
-   [x] Close full-boot WebSockets at token expiry and prevent token/session replay where the package runtime can do so without breaking normal refresh.
-   [x] Make realtime scene/settings persistence fail closed on stale durable revisions while keeping idempotent same-payload retries.
-   [x] Add focused backend tests for origin, ShareDB doc scope, token expiry/replay, and stale scene/settings conflicts.
-   [x] Add Playwright canvas-scoped nonblank/bounds evidence and realtime ShareDB persistence evidence.
-   [x] Run Prettier, focused backend/frontend/metahubs tests/builds, and local minimal Supabase E2E.

## QA Fullscreen, Inspector, And WebSocket Browser Closure Checklist

> Date: 2026-06-07
> Trigger: IMPLEMENT after QA found that full upstream UI boot still lacks passing browser proof for standalone fullscreen mode, user-driven inspector selection, direct WebSocket evidence, and reload-visible persistence.

-   [x] Make `openSeparately` fullscreen mode chrome-free so normal users see the upstream Editor surface without extra Universo/MUI header controls.
-   [x] Strengthen PlayCanvas Editor browser helpers to assert direct WebSocket connection state, no disabled URLs, no connection overlays, and no fallback entity adapter.
-   [x] Replace programmatic inspector selection bypasses with user-visible hierarchy selection or a documented upstream UI click sequence.
-   [x] Run the create/select/save/reload proof in the open-separately fullscreen editor and assert the persisted entity is visible and inspectable after reload.
-   [x] Update focused component/E2E tests, docs or progress notes where behavior changed.
-   [x] Run Prettier, focused tests/builds, and local minimal Supabase Playwright evidence.

# PlayCanvas Editor Minimal Compatibility Backend Implementation Tasks

> Date: 2026-06-05
> Source plan: `memory-bank/plan/playcanvas-editor-minimal-compatibility-backend-plan-2026-06-05.md`
> Source brief: private manager brief for the PlayCanvas Editor minimal compatibility backend slice

## QA Typecheck, Replay, And Snapshot Remap Closure Checklist

> Date: 2026-06-05
> Trigger: IMPLEMENT after QA found type-check, settings replay, and snapshot restore lifecycle defects.

-   [x] Pass a host-fetched CSRF token through the PlayCanvas Editor bootstrap descriptor so sandboxed compatibility REST saves use the authenticated platform session.
-   [x] Fix the new PlayCanvas Editor backend package test fixtures so direct TypeScript checks pass.
-   [x] Make PlayCanvas Editor compatibility settings writes idempotent by `requestId` and payload fingerprint.
-   [x] Remap PlayCanvas Editor compatibility settings document ids during PlayCanvas project snapshot restore/copy.
-   [x] Add focused regression tests for settings replay and restored compatibility settings ids.
-   [x] Add an explicit CSRF token/header contract for compatibility REST mutations.
-   [x] Keep scene/settings replay claims after committed mutations when replay-response persistence fails to block duplicate retries.
-   [x] Run focused type-check, tests, lint/build, Prettier/diff checks, and autoreview.

## True Compatibility Backend Closure Checklist

> Date: 2026-06-05
> Trigger: IMPLEMENT after QA found that the bridge-minimal descriptor slice does not complete the original backend plan.

### Scope

Implement the first real PlayCanvas Editor compatibility backend boundary beyond the bridge-minimal descriptor. This closure must add a package-owned protocol layer, metahub-injected adapters, schema-valid config/REST contracts, durable single-user document persistence using existing metahub PlayCanvas storage where possible, no-op messenger/realtime status contracts that fail closed, and browser/test evidence that does not overclaim PlayCanvas Cloud parity.

### Checklist

-   [x] Create `@universo-react/playcanvas-editor-backend` as a non-user-facing protocol package with typed route factories and no private metahub imports.
-   [x] Extend shared compatibility contracts for Editor config, REST scene/assets/settings DTOs, protocol token claims, and explicit no-op messenger/realtime descriptors.
-   [x] Implement metahub-owned adapters in `metahubs-backend` and mount isolated `/playcanvas/editor-compatible/...` REST routes with `manageMetahub`, Zod validation, no-store responses, and fail-closed project access.
-   [x] Implement the first durable single-user compatibility REST loop: project descriptor, scene list/read/save, settings read/write, assets empty/list shell, and cloud-only typed no-op responses backed by existing PlayCanvas project storage.
-   [x] Add backend Jest/Vitest coverage for package route factories, adapters, DTO validation, auth/role failures, save/reload persistence, replay/idempotency, and unsupported cloud-only surfaces.
-   [x] Strengthen Playwright/browser evidence for real keyboard shortcuts, mobile selected-project unsupported state, no raw IDs/JSON/tokens, screenshots, and compatibility REST status.
-   [x] Update OpenAPI, GitBook docs, package READMEs, and Memory Bank so the completed bridge-minimal slice and new compatibility backend slice are not conflated.
-   [x] Run Prettier, focused lint/build/test, browser smoke, local minimal Supabase E2E, and autoreview before closeout.

## Scope

Implement the first sovereign PlayCanvas Editor compatibility slice: update the vendored upstream Editor to `v2.23.4`, trace the current boot contract, add typed compatibility contracts, expose a metahub-scoped `protocol.describe` bridge capability, preserve the existing `playcanvas-editor` user-facing slug and bridge fallback, and prove the current browser edit/persist/reload loop with focused tests and documentation. Full PlayCanvas Cloud-compatible REST, ShareDB realtime, and messenger backend surfaces remain out of this completed slice and must stay explicitly documented as future work.

## Checklist

-   [x] Phase 0: Update the vendored PlayCanvas Editor artifact to upstream `v2.23.4`, align metadata/dependencies/docs, and run artifact metadata/smoke checks.
-   [x] Phase 0/1: Trace the updated artifact boot/config/REST/WebSocket/messenger behavior and decide that a separate backend package is not required for this bridge-minimal slice.
-   [x] Phase 1/2: Add shared compatibility contracts and a typed `protocol.describe` descriptor for the current single-user bridge mode, including explicit disabled REST/realtime/messenger surfaces.
-   [x] Phase 2/3: Preserve the existing secured metahub bridge/storage path and expose the minimal required protocol surface through metahub-owned adapters; do not claim PlayCanvas Cloud-compatible REST, ShareDB, or messenger implementation in this slice.
-   [x] Phase 4: Reuse existing backend routes/adapters/storage lifecycle with no new persistence tables, no DDL/migration changes, and no schema/template version bump.
-   [x] Phase 5: Update only required MUI host/settings states with existing template primitives, localized EN/RU text, and no raw IDs/JSON/protocol leakage.
-   [x] Phase 6/7: Add focused Jest/Vitest/Playwright coverage for contracts, security failures, persistence/reload, responsive UX, and browser evidence with local minimal Supabase where required.
-   [x] Phase 8/9: Update GitBook docs, package READMEs, OpenAPI notes where applicable, run Prettier/lint/build/test checks, update Memory Bank progress, and close with verification notes.

## QA Corrective Closure Checklist

-   [x] Make `protocol.describe` read-only so it no longer initializes or mutates the default scene outside replay-guarded commands.
-   [x] Require iframe `event.source` to match the real PlayCanvas Editor iframe before accepting bootstrap requests.
-   [x] Split compatibility descriptor contracts into `playcanvasEditorCompatibility.ts` and validate returned descriptors with Zod.
-   [x] Validate bridge session token claims with a strict shared Zod schema and reject unknown token fields.
-   [x] Reduce synthetic compatibility privileges by removing descriptor/client `admin` and `superUser` claims.
-   [x] Clarify ShareDB status as `not-implemented` while documenting that current scene saves use metahub PlayCanvas storage.
-   [x] Add a read-only `/playcanvas/editor-compatible/.../protocol` namespace for the current descriptor without claiming PlayCanvas Cloud REST/WS parity.
-   [x] Strengthen artifact browser smoke evidence with responsive screenshot size checks and explicit no-admin/no-superUser assertions.
-   [x] Update docs/OpenAPI sources/Memory Bank to reflect the corrected bridge-minimal scope.

## QA Replay/OpenAPI/E2E Oracle Closure Checklist

-   [x] Release replay claims on early `scene.save` capability rejection and cover the retry contract with a regression.
-   [x] Canonicalize replay fingerprints for nested JSON command payloads and cover equivalent key-order retries.
-   [x] Document PlayCanvas file endpoint `sourcePath` and checksum preconditions in generated OpenAPI.
-   [x] Strengthen PlayCanvas Editor artifact browser smoke screenshot oracles without requiring full upstream toolbar in bridge-minimal mode.
-   [x] Run focused backend/rest-docs/editor checks, Prettier, and update progress notes.

## QA Final Contract Drift Closure Checklist

-   [x] Align PlayCanvas asset file OpenAPI endpoints with runtime `sourcePath` and checksum guards.
-   [x] Synchronize the PlayCanvas Editor frontend public smoke-mode export with the hosted artifact mode.
-   [x] Run focused rest-docs/editor/backend checks, Prettier/diff checks, and update progress notes.

## QA Final E2E And Contract Closure Checklist

-   [x] Declare the PlayCanvas Editor browser-smoke PNG parser dependency explicitly.
-   [x] Replace stale artifact-only wording in the PlayCanvas Editor upstream vendor note.
-   [x] Make the minimal compatibility protocol descriptor avoid claiming that the current user owns the project.
-   [x] Strengthen Playwright evidence for real duplicate bridge replay retries and stabilize the conflict-to-dirty flow.
-   [x] Close minor UX fallback and viewport evidence gaps.
-   [x] Run focused tests, local minimal Supabase E2E, Prettier, lint/build/static checks, autoreview, and update progress notes.

# PlayCanvas Editor Frontend Package Rename Implementation Tasks

> Date: 2026-06-05
> Source plan: `memory-bank/plan/playcanvas-editor-frontend-package-rename-plan-2026-06-05.md`

## Scope

Rename the PlayCanvas Editor artifact workspace to the frontend package boundary `packages/universo-react-playcanvas-editor-frontend` / `@universo-react/playcanvas-editor-frontend`. Keep the user-facing package slug and routes as `playcanvas-editor`.

## Checklist

-   [x] Inventory active old package references and classify slug-only references before editing.
-   [x] Rename the workspace folder and package manifest to the frontend package name.
-   [x] Update workspace, CI, lint, Vitest, and guardrail tooling to the new package name and path.
-   [x] Update shared constants, package registry seeds/defaults, validation, and artifact path references while keeping the metahub slug stable.
-   [x] Update affected tests and fixtures so package metadata uses the new name and slug/route expectations remain stable.
-   [x] Update package READMEs, GitBook docs, and current Memory Bank state references.
-   [x] Regenerate PNPM lockfile metadata and run focused formatting/checks/tests.
-   [x] Run final stale-reference scans, update progress, and document any verification constraints.

# PlayCanvas Editor Runtime Host, Bridge, and Storage Adapter Implementation Tasks

> Date: 2026-06-04
> Source plan: `memory-bank/plan/playcanvas-editor-runtime-host-bridge-storage-adapter-plan-2026-06-04.md`
> Source brief: private Manager brief

## QA Round 4 Corrective Closure Checklist

-   [x] Keep recoverable PlayCanvas Editor save conflicts out of the global bridge error state.
-   [x] Require session/nonce on iframe-to-host PlayCanvas Editor bridge messages and validate them before backend calls.
-   [x] Return typed `csrfRequired` bridge errors from the frontend bridge client and cover the backend CSRF contract with a route-specific regression.
-   [x] Strengthen artifact keyboard handling and E2E selectors/evidence for real visible editor changes, conflict, and localized host states.
-   [x] Run focused tests, lints/builds, Prettier, browser checks where practical, and update progress notes.

## QA Round 5 Final Acceptance Closure Checklist

-   [x] Fix bridge replay persistence so non-UUID authenticated user ids cannot break replay-guarded commands.
-   [x] Make bridge/artifact HMAC secrets fail closed in production while preserving explicit dev/test fallback.
-   [x] Scope `scene.save` to the selected/default scene unless an explicit scene-create capability is added.
-   [x] Reduce production bridge credential exposure and document the `allow-same-origin` sandbox threat model.
-   [x] Replace Playwright save/reopen evidence that depends on debug payload staging with visible Editor user actions and localized assertions.
-   [x] Run focused backend/types/editor/frontend/E2E checks, Prettier, diff checks, autoreview, and update Memory Bank closeout notes.

## QA Round 3 Corrective Closure Checklist

-   [x] Invalidate PlayCanvas project and package host TanStack Query caches after successful bridge scene saves.
-   [x] Narrow bridge error response typing so save conflict handling is type-safe under strict TypeScript.
-   [x] Align PlayCanvas Editor host CSP origin resolution with the documented trusted proxy header flag.
-   [x] Strengthen Playwright evidence names and assertions for save/reopen, permission-blocked, artifact-unavailable, and dirty-dialog states.
-   [x] Add PlayCanvas Editor troubleshooting docs without exposing secrets.
-   [x] Run focused tests/builds/Prettier/diff checks and close with independent verification.

## Scope

Implement the first Universo-backed PlayCanvas Editor authoring slice: real hosted artifact mode, typed bridge contracts, manager-only bridge command API, scene save/load through metahub PlayCanvas project storage, minimal JSON asset metadata, frontend host integration, docs, tests, and browser evidence. Keep S3/provider administration, PlayCanvas Cloud parity, broad binary assets, Colyseus authoring, AI/MCP automation, and implicit runtime publication out of this slice.

## Checklist

-   [x] Shared contracts: extend package artifact/host descriptors and add strict PlayCanvas Editor bridge schemas/types with UUID v7 and bounded payload validation.
-   [x] Editor artifact: add `universo-hosted` real mode, manifest/readiness checks, bootstrap/bridge runtime, package isolation, and smoke/browser tests.
-   [x] Backend host: extend authoring host descriptor, artifact headers/CSP/referrer controls, package seed data, and fail-closed readiness states.
-   [x] Backend bridge: add authenticated manager-only bridge command route with explicit CSRF, HMAC session payload, replay/idempotency store, strict parsing, safe errors, rate limits, and OpenAPI docs.
-   [x] Backend storage adapter: implement selected/default project load, scene list/read/save, minimal JSON asset metadata, ordered metadata/file/checksum writes, rollback/conflict mapping, and focused regressions.
-   [x] Frontend host: add bridge API/client, iframe message hook, TanStack Query integration, localized safe UI states, dirty/conflict dialogs using existing primitives, and anti-leakage tests.
-   [x] E2E/browser evidence: run local minimal Supabase Playwright flow for real artifact, handshake, save/reopen, conflict, permission blocked, responsive no-overflow, negative bridge messages, and referrer/header leakage.
-   [x] Docs and closeout: update package READMEs, GitBook docs, progress/current context, run focused tests/builds/Prettier/lints/OpenAPI checks/autoreview, and stop local E2E services.

## PlayCanvas Editor Host Bridge E2E Closure

-   [x] Fix the real host/artifact bootstrap handshake so iframe initialization is request-bound and race-resistant.
-   [x] Add platform E2E evidence for iframe save through the bridge, backend storage persistence, and reload/reopen scene restore.
-   [x] Strengthen iframe-visible leakage and user-level keyboard assertions for the editor host flow.
-   [x] Run focused editor/frontend/E2E checks, keep local E2E Supabase stopped, and update Memory Bank closeout notes.

## PlayCanvas Editor Bridge QA Repair Checklist

-   [x] Restore metadata-first editor scene save ordering and add crash-window/retry regressions.
-   [x] Make successful bridge save replay idempotent by returning the stored response instead of rejecting duplicate retries.
-   [x] Add dirty navigation protection, localized conflict UX, and stronger user-facing save evidence.
-   [x] Stabilize PlayCanvas Editor browser smoke screenshot evidence across desktop/tablet/mobile.
-   [x] Replace generic OpenAPI bridge endpoint docs and resolve PlayCanvas docs drift.
-   [x] Run focused backend/types/editor/frontend/E2E checks, Prettier, diff checks, and update Memory Bank closeout notes.

## PlayCanvas Editor Bridge QA Round 2 Closure Checklist

-   [x] Make host bridge request ids fail closed instead of repairing invalid iframe messages.
-   [x] Harden authoring host parent origin resolution and document the same-origin sandbox decision.
-   [x] Close OpenAPI schema drift for PlayCanvas package display and authoring host descriptors.
-   [x] Add negative token tampering evidence and avoid overclaiming anonymous token isolation.
-   [x] Verify checksum-guarded rollback delete and scene-owned payload file validation with regressions.
-   [x] Run focused backend/frontend/types/editor/rest-docs checks, Prettier, diff checks, and autoreview.

# PlayCanvas Project Storage Model QA Closure Tasks

> Date: 2026-06-03
> Source plan: `memory-bank/plan/playcanvas-project-storage-model-for-metahubs-plan-2026-06-03.md`

## Scope

Close the QA blockers found after the first implementation pass. This work completes the approved storage-model plan without adding the PlayCanvas Editor bridge, S3 provider administration, Colyseus authoring, AI/MCP authoring, or a custom scene-editing UI.

## Checklist

-   [x] Backend contracts: replace weak snapshot `unknown[]` sections with typed Zod schemas and add bounded strict base64/MIME/checksum validation.
-   [x] Backend schema/store: add virtual path collision guard and first-class scene, asset, script, binding, generated-artifact store methods.
-   [x] Backend API: expose the planned project/scene/asset/script/generated-artifact routes with permission, rate-limit, no-store/cache, optimistic, and fail-closed behavior.
-   [x] Snapshot lifecycle: remap PlayCanvas ids on restore/copy, validate checksums, preserve file rollback, and generate complete runtime manifests with scene bindings and artifact URLs.
-   [x] Application sync: ensure PlayCanvas manifest-only changes are detected and reported as updates.
-   [x] Frontend UX: remove the required user-facing Codename workflow, add localized project create validation/errors, and keep shared MUI dialog/list primitives.
-   [x] E2E: add Playwright evidence for create/delete dialogs, keyboard paths, invalid validation, responsive screenshots, and no raw IDs/JSON/paths.
-   [x] Tests/docs: extend focused Jest/Vitest coverage, update OpenAPI/GitBook docs where contracts changed, run Prettier/lints/builds, and finish with autoreview.

## Follow-up QA Closure Checklist

-   [x] Preserve legacy snapshot bundle hash compatibility when PlayCanvas runtime manifests are absent.
-   [x] Include PlayCanvas script binding values and target entity ids in publication hash normalization.
-   [x] Detect PlayCanvas file checksum drift during snapshot export instead of silently accepting changed files.
-   [x] Add optimistic current-file checksum guards for PlayCanvas file writes.
-   [x] Make PlayCanvas project delete clear package default pointers before irreversible file cleanup.
-   [x] Close the metahub copy lifecycle gap for copied PlayCanvas ids and references.
-   [x] Add focused regression tests and rerun backend/frontend/types/utils/schema checks plus autoreview.

## QA Implementation Closure Checklist

-   [x] Treat missing PlayCanvas storage tables as an empty snapshot during metahub copy/export.
-   [x] Validate package `defaultProjectId` against the metahub default branch, not the user's active branch.
-   [x] Reject restored local PlayCanvas file refs that lack bundled snapshot content.
-   [x] Stabilize application backend build or document remaining unrelated blockers with focused PlayCanvas proof.
-   [x] Run focused tests, builds, static checks, Prettier, and autoreview.

## Final QA Findings Closure Checklist

-   [x] Count scene payload, script parse, and generated artifact statuses in PlayCanvas project health and publishability.
-   [x] Prevent free project-level file writes from creating orphan PlayCanvas files outside scene/asset/artifact metadata.
-   [x] Make runtime PlayCanvas manifests fail closed when local file references are not ready instead of publishing live authoring paths as implicitly valid resources.
-   [x] Add focused regression tests for health aggregation, orphan-file guards, and runtime manifest gating.
-   [x] Protect PlayCanvas authoring file/snapshot read endpoints with `manageMetahub` and add a controller permission regression.
-   [x] Extend browser/API evidence for snapshot export/import, metahub copy, and package detach/reattach persistence.
-   [x] Run focused backend/frontend/application tests, DB-access/i18n/diff checks, and document any E2E constraints.

## QA Round 2 Closure Checklist

-   [x] Require `manageMetahub` for PlayCanvas authoring metadata read endpoints and extend permission regressions.
-   [x] Produce resolved runtime PlayCanvas file URLs without leaking authoring storage paths, with fail-closed manifest validation.
-   [x] Add restore preflight validation for duplicate snapshot ids and broken references before destructive cleanup or file writes.
-   [x] Reject symlinked PlayCanvas files in normal read/write/delete flows, not only tree copy.
-   [x] Make project/metahub file deletion lifecycle fail safer and avoid restoring DB metadata to partially deleted files.
-   [x] Extend Playwright evidence for confirmed delete, manual default selection/reset, and RU labels.
-   [x] Run focused tests, build/static checks, Prettier where needed, and final autoreview.

## QA Round 3 Closure Checklist

-   [x] Scope PlayCanvas project publish/export before runtime manifest generation so unrelated broken projects cannot block a healthy project.
-   [x] Correct PlayCanvas optimistic-lock diagnostics to use a PlayCanvas-specific entity type.
-   [x] Add focused regressions for project-scoped publish/export isolation.
-   [x] Run focused backend tests, build/static checks, Prettier where needed, and autoreview.

## QA Round 4 Closure Checklist

-   [x] Make configured default PlayCanvas projects fail closed when no publishable scene can produce a runtime manifest.
-   [x] Persist normal runtime publication manifests into `_mhb_playcanvas_publication_manifests` and clear stale rows when the latest publication has no manifests.
-   [x] Add backend regressions for default-project publish blocking and branch-scoped publication manifest persistence.
-   [x] Extend Playwright evidence for populated PlayCanvas projects panel at mobile/tablet widths and read-only member behavior.
-   [x] Run focused backend/frontend/application tests, builds/static checks, local minimal Supabase Playwright, and autoreview.

## QA Round 5 Closure Checklist

-   [x] Move PlayCanvas publication manifest persistence out of snapshot serialization side effects and into publication transactions.
-   [x] Make project delete rollback fail closed when physical cleanup may be partial.
-   [x] Include asset file references in project-level PlayCanvas file ownership checks.
-   [x] Preserve PlayCanvas restore file rollback during metahub copy failures.
-   [x] Normalize application runtime manifest diff fields so persisted manifests do not create false-positive sync changes.
-   [x] Fix frontend accessibility lint and backend unused warnings.
-   [x] Add focused regressions for the fixed lifecycle/diff/accessibility paths.
-   [x] Run focused tests, lints, DB access check, Prettier where needed, and final autoreview.

## QA Round 6 Closure Checklist

-   [x] Split project-level PlayCanvas file ownership from asset file ownership.
-   [x] Make PlayCanvas file metadata marker updates fail closed on zero-row results.
-   [x] Allow first-time PlayCanvas metadata upserts without meaningless `expectedVersion`.
-   [x] Add focused regressions for asset-owned project endpoint rejection, zero-row marker rollback, and optional `expectedVersion` creates.
-   [x] Run focused tests, lints/static checks, Prettier, and autoreview.

## QA Round 7 Closure Checklist

-   [x] Enforce role-specific PlayCanvas file reference extensions and MIME classes before metadata is persisted.
-   [x] Add focused regressions for invalid scene payload, generated artifact, and script asset file refs.
-   [x] Fix PlayCanvas-only application sync messages so manifest-only updates are not reported as already up to date.
-   [x] Run focused backend/application tests, lint/build/static checks, local minimal Supabase Playwright, and autoreview.

## QA Round 8 UI Closure Checklist

-   [x] Fix PlayCanvas projects empty state image and accessible alt text.
-   [x] Align PlayCanvas Editor open action with new-tab icon semantics.
-   [x] Normalize PlayCanvas project create/delete dialog action labels and form spacing.
-   [x] Strengthen component and Playwright UX assertions for empty images, dialog clipping, standard labels, and popup behavior.
-   [x] Run focused tests, Prettier, and targeted checks for the changed frontend/E2E slice.

## PlayCanvas Editor Bridge Security Hardening Checklist

-   [x] Add iframe-side origin/source validation for PlayCanvas Editor bootstrap and bridge responses.
-   [x] Add browser smoke assertions for rejected spoofed bootstrap and bridge response messages.
-   [x] Run focused PlayCanvas Editor artifact tests and static checks.
-   [x] Update Memory Bank progress after verification.

## PlayCanvas Editor Runtime Host QA Closure Checklist

> Date: 2026-06-04
> Source brief: private Manager brief

-   [x] Make bridge replay completion fail closed after successful mutations instead of releasing completed-but-unrecorded requests.
-   [x] Add expected checksum guards to PlayCanvas project and asset file delete APIs.
-   [x] Strengthen Playwright evidence for user-facing Editor scene mutation and approved dialog primitives.
-   [x] Add RU browser assertions for Editor host dirty/save/conflict/error lifecycle states.
-   [x] Run focused backend/frontend/editor tests, Playwright smoke/E2E where practical, lint, Prettier, and diff checks.

## PlayCanvas Editor Runtime Host QA Round 2 Closure Checklist

> Date: 2026-06-04
> Scope: fix implemented host/settings/storage/test defects while deferring full upstream PlayCanvas Editor UI hosting to a separate research/brief.

-   [x] Align PlayCanvas project creation and package settings dialogs with the shared MUI UX contract.
-   [x] Add default PlayCanvas project selection to package settings and keep project list management as a separate surface.
-   [x] Add visible host save action and robust host-to-iframe shortcut handling without browser Save Page leakage.
-   [x] Remove the open-separately interstitial and make the package action open the final editor host directly.
-   [x] Make hosted readiness fail closed for artifact-only/placeholder manifests when the package expects `universo-hosted`.
-   [x] Lock bridge scene saves to scene-owned payload paths so one scene cannot overwrite another scene's file.
-   [x] Strengthen unit, artifact, and Playwright tests so fallback `Add entity` is not accepted as real Editor UI proof.
-   [x] Run focused backend/frontend/editor tests, lint, Prettier, Playwright evidence where practical, and autoreview.

## PlayCanvas Editor Minimal Compatibility Backend QA Closure Checklist

> Date: 2026-06-05
> Scope: close QA findings for the minimal compatibility REST backend slice.

-   [x] Add a short-lived compatibility REST token boundary and bind it to metahub, project, user, package slug, mode, expiry, and origin.
-   [x] Route iframe save through the compatibility REST scene endpoint when the compatibility config is available, with bridge fallback only before config bootstrap.
-   [x] Prevent user-scoped compatibility settings from being carried into restored/copied project snapshots.
-   [x] Extend focused route/service tests for token negatives, role/CSRF negatives, replay fingerprint conflicts, and snapshot settings filtering.
-   [x] Update E2E/agent coverage so the compatibility backend package and focused route/service tests run explicitly and browser tests assert the compatibility REST save path.
-   [x] Pass a host-fetched CSRF token through the PlayCanvas Editor bootstrap descriptor so sandboxed compatibility REST saves use the authenticated platform session.
-   [x] Normalize PlayCanvas Editor compatibility REST conflict errors and surface them in the host UI.
-   [x] Update docs and Memory Bank progress for the corrected security/test contract.
-   [x] Run focused builds, lints, tests, Prettier/diff checks, and autoreview.

## PlayCanvas Editor Full Boot QA Closure Checklist

> Date: 2026-06-07
> Scope: close QA findings for upstream Editor full-boot dirty state, fullscreen UX, realtime relay security, ShareDB cache safety, and browser oracles.

-   [x] Harden relay WebSocket authentication by removing query-token auth, adding auth timeout/fail-closed close behavior, and bounding pending messages.
-   [x] Make ShareDB full-boot document seeding refresh/fail closed against durable storage revisions instead of serving stale in-memory documents.
-   [x] Fix full-boot dirty-state lifecycle so initial hydration is clean and real upstream realtime/ShareDB edits mark the host dirty.
-   [x] Make fullscreen/open-separately host chrome minimal and non-intrusive, and remove technical terms from normal user-facing host messages.
-   [x] Strengthen component and Playwright tests for initial clean state, fullscreen chrome contract, dirty lifecycle, and relay security.
-   [x] Run Prettier, focused unit/backend/frontend builds, local minimal Supabase Playwright, and autoreview.

## PlayCanvas Editor Full Boot QA Round 2 Closure Checklist

> Date: 2026-06-07
> Scope: close QA findings for full-boot protocol gating, WebSocket DB security, origin binding, schema strictness, and upstream UI workflow evidence.

-   [x] Make REST compatibility tokens fail closed when an origin-bound token is replayed without request origin evidence.
-   [x] Return the explicit full-boot protocol descriptor with enabled REST/realtime/messenger/relay surfaces and persisted ShareDB snapshot contract.
-   [x] Tighten the full-boot config schema around boot-critical project, URL, schema, engine, and bridge fields.
-   [x] Document the WebSocket realtime DB boundary as trusted Tier 2 with signed-token and manageMetahub authorization, or move it to a request-scoped session if the existing stack supports that.
-   [x] Strengthen browser acceptance for `#layout-root`, real upstream Add Entity interaction, entity selection, and attributes inspector population.
-   [x] Run focused backend/frontend/editor tests, Prettier, local minimal Supabase Playwright where practical, and autoreview.

## PlayCanvas Editor Full Boot QA Round 3 Security Closure Checklist

> Date: 2026-06-07
> Scope: close the full-boot WebSocket token origin minting finding from QA/autoreview.

-   [x] Require an explicit trusted artifact origin/base URL before issuing full-boot WebSocket tokens.
-   [x] Add regression tests for hostile full-boot config requests without artifact origin evidence.
-   [x] Run focused backend/metahubs tests, formatting/static checks, and autoreview.

## PlayCanvas Editor Full Boot QA Round 4 UX and Reliability Closure Checklist

> Date: 2026-06-07
> Scope: close QA findings for embedded host spacing, duplicate ready notifications, browser UX oracles, WebSocket pre-auth pressure, replay reliability, and PlayCanvas project lifecycle atomicity.

-   [x] Collapse PlayCanvas Editor host readiness and bridge notices into one localized status slot.
-   [x] Normalize embedded Editor iframe layout so bottom spacing matches side padding.
-   [x] Add focused component and Playwright assertions for a single status alert and embedded bottom-gap parity.
-   [x] Bound unauthenticated full-boot WebSocket upgrades with explicit pre-auth connection limits.
-   [x] Make replay completion after committed PlayCanvas mutations fail closed without leaving permanent in-progress claims.
-   [x] Make PlayCanvas project creation atomic and project deletion fail closed on partial physical cleanup.
-   [x] Run focused frontend/backend tests, formatting/static checks, and update progress.

## MMOOMM PlayCanvas Editor Product Flow QA Closure Checklist

> Date: 2026-06-11
> Scope: close QA blockers for the Editor-authored MMOOMM app snapshot, runtime canvas UX, generator provenance, and safety contracts.

-   [x] Persist MMOOMM Ship and Station as renderable PlayCanvas Editor entities with transforms and standard components, not metadata-only nodes.
-   [x] Strengthen shared scene payload schemas, fixture contracts, and tests so metadata-only MMOOMM scenes fail.
-   [x] Localize generated app menu/widget content in EN/RU and require RU labels in fixture/runtime oracles.
-   [x] Make the PlayCanvas runtime canvas use fit-viewport sizing by default and prove it avoids the large lower blank area.
-   [x] Correct runtime drag semantics so pointer drag moves the scene/camera model in the expected same-screen direction.
-   [x] Prevent follow camera clipping through guarded station geometry and expose testable clearance evidence.
-   [x] Tighten product generator/CI evidence so committed `metahubs-mmoomm-app-snapshot.json` is produced from browser-authored, saved/reopened, published state.
-   [x] Fix backend safety regressions found by QA: snapshot export mode, sourcefile delete checksum fallback, manifest replacement atomicity/sourcefile table guard/manifest binding alignment where applicable.
-   [x] Run focused type/editor/runtime/backend tests, fixture contract checks, Prettier/lint where practical, and Playwright E2E with local minimal Supabase if the environment supports it.

## MMOOMM PlayCanvas Editor Product Flow QA Continuation Checklist

> Date: 2026-06-12
> Scope: continue the IMPLEMENT pass after QA flagged the hidden MMOOMM projection panel, metadata shortcutting, direct snapshot export API, and missing backend derivation from native editor entities.

-   [x] Remove the dead `data-universo-mmoomm-projection-panel` checks from the Playwright authoring helper and artifact spec.
-   [x] Remove the hidden MMOOMM metadata write from `configureMmoommSceneFromUserCreatedEntities`; the helper now authors normal renderable PlayCanvas entities.
-   [x] Derive canonical MMOOMM runtime metadata in the backend from renderable native PlayCanvas Editor entities named `MMOOMM Ship` and `MMOOMM Station`.
-   [x] Add backend regression coverage proving MMOOMM metadata is derived when the scene initially has no `metadata.mmoomm`.
-   [x] Replace the generator's direct `/metahub/:id/export` API read with the browser MetahubList export/download action.
-   [x] Remove the generator's direct `syncApplicationSchema` shortcut and keep only read-back polling for application schema status.
-   [x] Run Prettier, focused editor frontend tests, editor backend tests, metahubs backend PlayCanvasProjectsService tests, fixture contract, fixture drift, and an ad-hoc TypeScript check for the changed E2E support/spec files.
-   [x] Replace the remaining generator `createPublication` and `createPublicationLinkedApplication` API helpers with a full Playwright UI flow through PublicationList, PublicationApplicationList, and ConnectorDiffDialog.
-   [x] Add Milestone B browser evidence for Editor Settings/Launch, Sourcefiles/Code Editor, VCS/Checkpoints, project export/import, and asset import pipeline.
-   [x] Re-run full local minimal Supabase generator/runtime E2E after the remaining browser-flow replacement is implemented.
-   [x] Re-run scoped Thermos/autoreview when the helper completes reliably; the 2026-06-12 scoped run timed out after 300 seconds without findings.

## MMOOMM PlayCanvas Editor Product Flow Finalization Checklist

> Date: 2026-06-12
> Scope: final IMPLEMENT pass to remove the last product-generator shortcuts and close browser evidence gaps.

-   [x] Move publication and linked-application creation in the MMOOMM app fixture generator to user-facing Playwright actions.
-   [x] Drive application schema creation through the application ConnectorDiffDialog instead of backend sync helpers.
-   [x] Add or tighten browser evidence for PlayCanvas Editor main functionality surfaces that were still missing after QA.
-   [x] Regenerate and validate the MMOOMM app snapshot fixture through the product Playwright generator.
-   [x] Run focused unit/static checks, local minimal Supabase E2E generator/runtime checks where feasible, Prettier, diff checks, and scoped review.

## MMOOMM PlayCanvas Editor Hydration Hardening Checklist

> Date: 2026-06-13
> Scope: close the QA finding that imported renderable entities appear in hierarchy/inspector but are not visible in the central Editor viewport.

-   [x] Normalize persisted and realtime scene entities into a `{ resource_id, parent, children }` shape and rebuild parent `children` from `parent` links.
-   [x] Make persisted scene hydration fall back to saved payload entities when realtime scene data is missing or empty.
-   [x] Let assetless persisted scenes satisfy the Editor viewport asset-load gate without forcing asset-loaded state for scenes with real assets.
-   [x] Strengthen MMOOMM Editor Playwright checks so they assert real PlayCanvas engine entities and render mesh instances, not only nonblank canvas pixels.
-   [x] Run formatting, focused checks, local minimal Supabase browser generator evidence, fixture contract/drift checks, and review the resulting diff.

## MMOOMM PlayCanvas Editor Full Implementation QA Closure Checklist

> Date: 2026-06-13
> Scope: implement the remaining master-plan acceptance work after QA proved that the imported Editor viewport, artifact build lifecycle, security closure, and main Editor capability claims were incomplete.

-   [ ] Fix persisted entity hydration so standard component paths materialize engine components and the artifact source parses, builds, and smokes.
-   [ ] Make normal repository build/CI workflows fail closed on a missing or stale PlayCanvas Editor artifact.
-   [ ] Add import-first Playwright proof that opens the imported MMOOMM Editor and verifies hierarchy, inspector, engine entities, render mesh instances, framing, pixels, reload, and browser errors.
-   [ ] Close PlayCanvas Editor bridge target-origin, replay user-binding, sourcefile DELETE CSRF/checksum, publish dirty/conflict, and production realtime-secret gaps.
-   [ ] Reconcile compatibility descriptors, documentation, fixture contents, and browser evidence with the actual Milestone A and Milestone B capability matrix.
-   [ ] Implement or explicitly prove every remaining main Editor workflow required by the master plan: scenes/components, assets, sourcefiles/Code Editor, settings/launch, publication/export, collaboration/realtime, and VCS.
-   [ ] Refactor touched oversized PlayCanvas implementation modules into focused boundaries without changing public contracts.
-   [ ] Run Prettier, focused lint/tests/builds, fixture contract/drift checks, local minimal Supabase generator/import/runtime Playwright, and repeat critical browser proof.
-   [ ] Run Thermos/autoreview and resolve all accepted correctness, security, maintainability, and test-oracle findings.

## PlayCanvas Editor Backend Compatibility Thermos Follow-up

> Date: 2026-06-14
> Scope: close the four actionable findings from the full local Thermos review without patching the upstream Editor vendor.

-   [x] Make ShareDB JSON0 list-operation repair transactional and non-destructive for existing arrays and incompatible values.
-   [x] Keep full metahub PlayCanvas snapshots independent from runtime-manifest publication validation.
-   [x] Restrict PlayCanvas canvas widget manifest selection to active display-package projects serialized by runtime publication.
-   [x] Resolve and validate the applications realtime room signing secret at runtime attachment instead of module import.
-   [x] Run focused tests, full metahubs-frontend tests, affected package builds/lints, local minimal Supabase MMOOMM Playwright, fixture contract/drift checks, and diff checks.
-   [x] Repeat Thermos/autoreview and resolve any remaining accepted findings. Final helper run was stopped after a long dirty-worktree bundle timeout; scoped manual Thermos review found no new accepted findings.

## MMOOMM Imported PlayCanvas Editor Viewport Closure

> Date: 2026-06-14
> Scope: fix the user-reported imported `metahubs-mmoomm-app-snapshot.json` Editor viewport where hierarchy and inspector show MMOOMM entities but the center viewport does not visibly render the Box meshes.

-   [x] Reproduce and inspect the imported scene data path from fixture snapshot to persisted PlayCanvas scene, realtime ShareDB document, and upstream viewport entity/component materialization.
-   [x] Fix backend/config/fixture normalization so `MMOOMM Ship` and `MMOOMM Station` become visible upstream PlayCanvas engine render entities without relying on vendor frontend patches.
-   [x] Keep generated MMOOMM fixture artifacts out of the canonical fixture source path unless explicitly promoted.
-   [x] Put the imported MMOOMM Editor viewport proof into the normal agent/E2E gate so hierarchy-only or nonblank-grid-only checks cannot pass.
-   [x] Run focused unit/static checks, fixture contract/drift checks, local minimal Supabase MMOOMM app runtime/import E2E, and a final Thermos/autoreview pass. Final helper run was stopped after a long dirty-worktree bundle timeout; scoped manual Thermos review found no new accepted findings.

# PlayCanvas Editor Upstream Update v2.24.2 Implementation Tasks

> Date: 2026-06-15
> Source plan: `memory-bank/plan/playcanvas-editor-upstream-2-24-2-update-plan-2026-06-15.md`
> Source brief: `.manager/specs/platformo/playcanvas-editor-upstream-2-24-2-update-governance-spec-2026-06-15.md`
> Source research: `memory-bank/research/playcanvas-editor-upstream-2-24-2-update-research-2026-06-15.md`

## Scope

Update the vendored PlayCanvas Editor frontend in `@universo-react/playcanvas-editor-frontend` from upstream `v2.23.4` to `v2.24.2`, with a new 3-guard governance surface (metadata, vendor-drift, formatter protection) so the next upstream bump is mechanical. Keep the package as a minimally modified upstream artifact boundary, not a fork.

## Checklist

-   [x] 2026-06-15: Replace `vendor/playcanvas-editor/` snapshot with v2.24.2 (commit `00360100b3b5747648eb3d7287421ef25491f5c7`) using atomic `.next` rename; update `vendor/UPSTREAM.md` (with v2.23.4 → v2.24.2 changelog section), `vendor/package.playcanvas-editor.json` (`version: "2.24.2"`), `vendor/LICENSE.playcanvas-editor`, `NOTICE.md`. Drop `package.json`, `package-lock.json`, `test/`, `test-suite/`, `.github/`, Docker files, Renovate, `.env.template`, `.mocharc.json`, `.nvmrc`, `.stylelintrc.json`.
-   [x] 2026-06-15: Bump in-tree constants in `src/index.ts` (3 constants) and `scripts/lib/playcanvas-editor-artifact.mjs` (mirror). Update `tests/artifact.test.mjs` (3 expect assertions + Node assertion test on lines 90-97).
-   [x] 2026-06-15: Bump cross-package metadata: `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts:216` (`z.literal`), `playcanvasEditorBridge.test.ts`, `playcanvas-editor-backend/src/index.test.ts:50`, `PlayCanvasProjectsService.ts:974`, `playCanvasEditorCompatibilityRoutes.test.ts:35`, `playCanvasProjectsController.test.ts` (2 occurrences).
-   [x] 2026-06-15: Update `packages/universo-react-rest-docs/scripts/generate-openapi-source.js:1007` (enum `v2.24.2`); regenerate `index.yml` via `pnpm --filter @universo-react/rest-docs generate:openapi`. Verified `v2.24.2` appears at line 14903.
-   [x] 2026-06-15: Update 9 PlayCanvas Editor Skills (`authoring` frontmatter + Version Guard + new "Upstream Update Governance" section; `api-realtime`, `assets`, `interface`, `scenes`, `scripting`, `settings`, `version-control` Version Guard bumps). `universo-compat` does not mention a specific version, no change.
-   [x] 2026-06-15: Update `packages/universo-react-playcanvas-editor-frontend/README.md` and `README-RU.md` (Tag/Commit/Version); `NOTICE.md`.
-   [x] 2026-06-15: Update `docs/en/platform/playcanvas-editor.md` and `docs/ru/platform/playcanvas-editor.md` — Current Scope + Typed Bridge Contract (with `BuildJob` / `BuildJobFormat` additive types note) + Full Upstream UI Boot (with "Builds panel" + "Version control picker" sub-bullets marked "TBD — verify after first browser smoke") + Troubleshooting (new `picker:versioncontrol:hasRetainedDiff` note).
-   [x] 2026-06-15: Add `tools/check-playcanvas-editor-metadata.mjs` (reads `src/index.ts` for current version, scans active code paths for stale `2.23.4` / `v2.23.4` literals, allowlists vendor/memory-bank/self/UPSTREAM.md). Wire as `check:playcanvas-editor-metadata` in root `package.json`.
-   [x] 2026-06-15: Add `tools/check-playcanvas-editor-vendor-drift.mjs` (developer-local only; reads `PC_EDITOR_UPSTREAM_DIR`; **exits 0 in CI** when absent). Wire as `check:playcanvas-editor-vendor-drift`.
-   [x] 2026-06-15: Add `.prettierignore` excluding `packages/universo-react-playcanvas-editor-frontend/vendor/**` and other generated paths. Verified vendor is not in the `--check` output.
-   [x] 2026-06-15: Add v2.24.2 picker sub-assertion + screenshot to `e2e/editor-artifact.spec.ts`. **All 30 E2E tests pass** across desktop/tablet/mobile viewports.
-   [x] 2026-06-15: Run all 3 governance guards, focused E2E on local artifact server, and update Memory Bank records.
