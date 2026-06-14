# MMOOMM PlayCanvas Editor Main Functionality and Runtime Projection Plan

> Created: 2026-06-10
> Status: Draft for discussion
> Mode: PLAN
> Source brief: local manager-only MMOOMM PlayCanvas runtime projection brief, dated 2026-06-09
> Source research: `memory-bank/research/mmoomm-playcanvas-editor-main-functionality-runtime-projection-research-2026-06-10.md`

## Overview

Make the Universo-hosted PlayCanvas Editor usable for the main authoring workflow, excluding optional PlayCanvas commercial/cloud extras such as asset marketplace, billing, hosted account/team administration, and special packaging flows. The end-to-end product proof is a browser-first Playwright generator that authors the canonical MMOOMM configuration through the platform UI and the real upstream Editor, publishes/syncs it, verifies PlayCanvas + Colyseus runtime behavior, and exports `tools/fixtures/metahubs-mmoomm-app-snapshot.json` from that browser-authored state.

This is a master implementation plan. It should not be closed after a single backend compatibility endpoint or a simple scene-save loop. The final acceptance target is the full product journey plus runtime proof. Individual phases can be completed as milestones, but the source brief remains open until the final acceptance checklist passes.

## Milestone Boundaries

The work has two acceptance levels and they must not be conflated:

-   **Milestone A: Editor-authored MMOOMM fixture.** This milestone proves the browser-first product journey for `tools/fixtures/metahubs-mmoomm-app-snapshot.json`: create a metahub through UI, connect packages, author the MMOOMM scene through the real Editor, save/reopen, publish/sync, verify runtime, and export/replay the fixture. It may keep collaboration, VCS, broad binary assets, templates/prefabs, and full project download/export as typed unavailable only if the UX is honest and the full brief remains open.
-   **Milestone B: Full main PlayCanvas Editor functionality.** This is the final acceptance target for the brief. It requires the main Editor surfaces to be implemented or explicitly split into a user-approved follow-up brief: durable realtime collaboration, presence/selection/chat, checkpoints/branches/merges/conflicts/item history, project backup/download/export, GLB/GLTF/audio/material dependency workflows, sourcefiles/Code Editor, settings/launch, scene hierarchy/inspector operations, publishing, and runtime projection.

The plan can implement Milestone A first to get the MMOOMM product proof, but it must not mark the brief complete until Milestone B or an explicitly approved scope split is complete.

### Milestone A Done Criteria

-   Browser-first Playwright proof creates a new metahub, connects packages, opens the real Editor, authors the MMOOMM scene, saves/reopens, publishes/syncs, verifies runtime, and exports `tools/fixtures/metahubs-mmoomm-app-snapshot.json`.
-   In-scope Milestone A Editor surfaces have real backend support, not disabled/stub endpoints. Typed unavailable states are allowed only for optional commercial/cloud extras or explicitly deferred main surfaces while Milestone B remains open.
-   The first production asset set is sufficient for the MMOOMM fixture: JSON, scripts/sourcefiles, generated `.js`/`.mjs`, and small PNG/JPEG/WebP texture assets.
-   Runtime projection consumes immutable `PlayCanvasRuntimeManifest` data and published assets, never mutable `playcanvas-projects/...` authoring paths.
-   Generator guardrails prove the fixture was browser-authored and fail API-first, direct DB, hidden-route, or direct fixture-write shortcuts.

### Milestone B Done Criteria

-   All main PlayCanvas Editor surfaces from the brief are implemented or split into a user-approved follow-up before final close: durable realtime collaboration, presence/selection/chat, checkpoints/branches/merges/conflicts/item history, project backup/download/export, GLB/GLTF/audio/material dependency workflows, sourcefiles/Code Editor, settings/launch, scene hierarchy/inspector operations, publishing, and runtime projection.
-   Collaboration/VCS/asset/export gaps cannot be silently treated as complete because Milestone A passed.
-   Documentation and compatibility descriptors distinguish implemented, explicitly deferred, optional commercial/cloud, and typed unavailable surfaces.

## Planning Inputs

-   Brief: local manager-only MMOOMM PlayCanvas runtime projection brief, dated 2026-06-09
-   QA-updated research: `memory-bank/research/mmoomm-playcanvas-editor-main-functionality-runtime-projection-research-2026-06-10.md`
-   Prior external research to treat critically:
    -   `.backup/Копия-PlayCanvas-Editor-для-Universo-MMOOMM.md`
    -   `.backup/Разработка-PlayCanvas-Editor-для-Universo-MMOOMM.md`
-   Current product docs:
    -   `docs/en/platform/playcanvas-editor.md`
    -   `docs/en/platform/playcanvas-projects.md`
    -   `docs/en/guides/mmoomm-flight-simulator.md`
-   Relevant current contracts:
    -   `packages/universo-react-types/src/common/playcanvasProjects.ts`
    -   `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts`
    -   `packages/universo-react-types/src/common/playcanvasEditorBridge.ts`
-   Current E2E baselines:
    -   `tools/testing/e2e/specs/flows/metahub-packages-resources.spec.ts`
    -   `tools/testing/e2e/specs/generators/metahubs-mmoomm-flight-app-export.spec.ts`
    -   `tools/testing/e2e/specs/flows/snapshot-import-mmoomm-flight-runtime.spec.ts`
    -   `tools/testing/e2e/support/mmoommFlightFixtureContract.ts`

## Key Decisions

-   The product journey is the skeleton. Backend capability work must be mapped to user-visible Editor and runtime steps, not treated as a separate endpoint checklist.
-   PlayCanvas Project remains design-time PlayCanvas authoring storage. It is not mapped to metahub Hub.
-   PlayCanvas Entity remains a scene graph entity. It is mapped to a Platformo Object only through explicit metadata when the entity represents a domain object.
-   Platformo/metahub remains the canonical domain model for entity types, modules, package attachment, layouts, publication, and application sync.
-   Colyseus remains the server-authoritative runtime owner. Editor-authored data can define templates, spawn points, camera hints, collision bounds, script references, and room metadata, but cannot become authoritative client-controlled world state.
-   Published runtime consumes immutable `PlayCanvasRuntimeManifest` data and published assets. It must not read mutable `playcanvas-projects/...` authoring paths or import Editor/PCUI/Observer internals.
-   S3/admin storage provider settings, asset marketplace/store, billing/account/team administration, AI/MCP automation, and Kiberplano production-chain modeling are out of this implementation slice.
-   Use the source TZ's freedom for clean E2E data and serious refactoring, but do not bump metahub schema/template versions unless a real migration decision proves it is unavoidable.
-   All new user-facing text must be localized through the owning package locale files in EN/RU: metahub authoring strings belong to the metahubs frontend namespace/resources, published runtime strings belong to the apps/runtime package namespace/resources, and only truly shared cross-package labels belong in `packages/universo-react-i18n`.
-   Shared contracts belong in `packages/universo-react-types`; reusable helpers belong in `packages/universo-react-utils`.
-   Backend data access stays SQL-first through stores and `DbExecutor.query()` with schema-qualified, parameterized SQL.
-   Frontend server state should use TanStack Query with explicit query keys and invalidation around Editor save/publish/export operations.
-   Metahub authoring UI should reuse existing metahub frontend and shared `@universo-react/template-mui` primitives where that is the current established host surface.
-   Published runtime UI stays in `packages/universo-react-apps-template-mui` and remains isolated from legacy template packages and Editor frontend/backend internals.

## Affected Areas

-   Shared contracts and validation:
    -   `packages/universo-react-types/src/common/playcanvasProjects.ts`
    -   `packages/universo-react-types/src/common/playcanvasEditorCompatibility.ts`
    -   `packages/universo-react-types/src/common/playcanvasEditorBridge.ts`
    -   `packages/universo-react-utils/src/serialization/publicationSnapshotHash.ts`
-   PlayCanvas Editor protocol/backend:
    -   `packages/universo-react-playcanvas-editor-backend/`
    -   `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/`
    -   `packages/universo-react-rest-docs/`
-   PlayCanvas Editor frontend artifact:
    -   `packages/universo-react-playcanvas-editor-frontend/`
    -   vendored upstream `packages/universo-react-playcanvas-editor-frontend/vendor/playcanvas-editor/`
-   Metahub frontend authoring:
    -   `packages/universo-react-metahubs-frontend/src/domains/packages/`
    -   `packages/universo-react-metahubs-frontend/src/domains/modules/`
    -   metahub layout/package/resource UI and query keys
-   Runtime publication/sync:
    -   `packages/universo-react-applications-backend/src/routes/sync/`
    -   `_app_playcanvas_manifests`
-   Published application runtime:
    -   `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx`
    -   `packages/universo-react-playcanvas-engine/`
    -   `packages/universo-react-colyseus-client/`
    -   `packages/universo-react-colyseus-server/`
-   Product fixture and E2E:
    -   `tools/fixtures/metahubs-mmoomm-app-snapshot.json`
    -   existing `tools/fixtures/metahubs-mmoomm-flight-app-snapshot.json`
    -   `tools/testing/e2e/specs/generators/`
    -   `tools/testing/e2e/specs/flows/`
    -   `tools/testing/e2e/support/`
-   Documentation:
    -   `docs/en/platform/playcanvas-editor.md`
    -   `docs/ru/platform/playcanvas-editor.md`
    -   `docs/en/platform/playcanvas-projects.md`
    -   `docs/ru/platform/playcanvas-projects.md`
    -   `docs/en/guides/mmoomm-flight-simulator.md`
    -   `docs/ru/guides/mmoomm-flight-simulator.md`
    -   `docs/en/SUMMARY.md`
    -   `docs/ru/SUMMARY.md`
    -   relevant package READMEs

## Browser Product Journey

The implementation should be planned and verified against this route before backend details are considered complete:

1. Start a clean E2E environment with local minimal Supabase and the Playwright wrapper, not `pnpm dev`.
2. Authenticate a test user through the supported E2E setup.
3. Open the platform at `http://127.0.0.1:3100`.
4. Create a new metahub through the normal UI, using the intended starter template and no legacy top-level entity routes.
5. Create or configure the required MMOOMM logic through user-facing Platformo UI where it exists:
    - entity types/presets needed by the baseline;
    - attached modules for flight/runtime logic;
    - package resources;
    - runtime layout/widget configuration.
6. Connect the Colyseus client/server, PlayCanvas Engine, PlayCanvas Editor frontend, and PlayCanvas Editor backend packages through Resources -> Packages or the current supported package UI.
7. Create and select a PlayCanvas project through the PlayCanvas package panel.
8. Open the real upstream PlayCanvas Editor iframe or separate fullscreen Editor host.
9. In the Editor, create the basic MMOOMM scene from a clean project:
    - scene hierarchy;
    - camera and lighting;
    - controlled ship;
    - station/target;
    - selectable or helper objects;
    - collision/guard bounds;
    - spawn/default camera hints;
    - script/sourcefile assets and script attributes;
    - `metadata.mmoomm.*` bindings for runtime projection.
10. Save, close, reopen, and prove that the Editor-authored scene, assets, scripts, settings, and MMOOMM metadata survive reload.
11. Publish the PlayCanvas project/metahub, blocking publish when dirty, conflicted, stale, or missing runtime-critical artifacts.
12. Sync/open the published application runtime.
13. Verify runtime behavior with PlayCanvas canvas and Colyseus:

-   canvas renders nonblank bounded pixels;
-   keyboard/pointer focus can enter and leave;
-   clients send intents, server state changes, and at least one other client observes movement;
-   unsafe client-side state mutation fails closed.

14. Export `tools/fixtures/metahubs-mmoomm-app-snapshot.json` from the browser-authored, saved/reopened, published, and synced state.
15. Replay/import the generated fixture in a separate E2E flow and run the runtime oracle again.

API calls may bootstrap authentication, clean test data, and support deterministic fixture export plumbing. They must not replace the user-facing authoring path for package connection, PlayCanvas authoring, publish/sync, runtime verification, or fixture provenance.

## Architecture Ownership Matrix

| Concept                                      | Preset/template                                                                           | Owner layer                                                        | UI surface                                           | Runtime consumer                                     | Guardrail                                                                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Starter MMOOMM metahub                       | Start from `basic` unless Phase 0 explicitly proves another template is required.         | Metahub canonical config                                           | Normal metahub create flow                           | Published application snapshot                       | Do not introduce a new built-in entity kind for PlayCanvas concepts.                                                      |
| MMOOMM world/ship/station domain records     | Existing Object/Set/Enumeration presets and capabilities where domain data is meaningful. | Metahub config; workspace only for runtime user/session records.   | Existing entity, modules, and resources UI           | Runtime modules and Colyseus room options            | PlayCanvas visual/helper entities do not automatically become Platformo Objects.                                          |
| Package attachments and package resources    | Package attachment records, not entity presets.                                           | Metahub config published to application.                           | Resources -> Packages                                | Runtime package/module loader                        | Use package UI; no API-only authoring in the product generator.                                                           |
| Attached modules and script/module bindings  | Modules capability on metahub entities plus PlayCanvas script binding metadata.           | Metahub config and PlayCanvas project storage.                     | Existing module authoring UI plus Editor Code Editor | Runtime module loader and PlayCanvas script manifest | Bind explicitly; do not infer every script as a Platformo module.                                                         |
| PlayCanvas project/scenes/assets/sourcefiles | PlayCanvas project storage, not Hub/Object.                                               | Metahub PlayCanvas project storage.                                | PlayCanvas package panel and real Editor iframe      | Publication pipeline only                            | Runtime cannot fetch authoring paths or Editor internals.                                                                 |
| Layout/widget configuration                  | Existing layout/widget metadata.                                                          | Metahub-authored layout config, then publication/application sync. | Existing layout/widget editor primitives             | `apps-template-mui` dashboard renderer               | Prefer existing `playcanvasCanvas` plus manifest reader; new widget requires an impossibility proof and parity checklist. |
| Immutable runtime manifest                   | `PlayCanvasRuntimeManifest` contract.                                                     | Application sync/runtime publication.                              | Publish/export status surfaces                       | `apps-template-mui` PlayCanvas runtime               | Only immutable runtime asset endpoints with hashes; no signed/token/local/authoring URLs.                                 |
| Live MMOOMM gameplay state                   | Colyseus room Schema, not metahub config.                                                 | Workspace/runtime session state.                                   | Published application runtime                        | Colyseus clients and server room                     | Clients send intents; server mutates authoritative Schema.                                                                |
| Fixture provenance                           | Test artifact metadata.                                                                   | E2E artifact/export contract only.                                 | Hidden from normal user UI                           | Test contract and replay suite                       | IDs/hashes are internal proof fields and must never become normal UI labels.                                              |

## Capability Matrix

| Capability                              | Current repo signal                                                                                        | Required target                                                                                                                                                                                                                                                                                                                                          | Primary proof                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Editor boot and iframe security         | Full upstream UI boot exists with iframe/origin guardrails.                                                | Keep real upstream UI, no hosted fallback, no disabled/stub endpoints for in-scope Milestone A/B main surfaces, origin-bound tokens, no iframe access to host DOM. Typed unavailable is allowed only for optional commercial/cloud extras or explicitly deferred main surfaces while the brief remains open.                                             | Playwright iframe checks, network/console leak checks, hostile-origin and expired-token negatives. |
| Projects and scenes                     | Project/scene storage exists.                                                                              | Create/select/list/save/reopen scenes and settings through Editor-visible actions with stable revision/conflict handling.                                                                                                                                                                                                                                | Backend tests, frontend Query tests, Editor save/reopen E2E.                                       |
| Project settings and launch             | Settings documents exist in the compatibility slice, but broad settings/launch proof is thin.              | Project/settings documents support rendering, physics, audio, WebGL/WebGPU-safe config, Ammo/physics flags where supported, launch config, and launch preview without weakening iframe/origin/CSP rules. Projection must validate Editor engine `2.19.5` settings against runtime engine `2.18.1` and fail or strip unsupported runtime settings safely. | Settings contract tests, launch-token/origin/CSP negatives, Editor launch preview E2E.             |
| Hierarchy/entities/components/inspector | Real upstream UI is visible; simple persistence exists.                                                    | Author scene hierarchy and component data required by MMOOMM without bypassing Editor UI.                                                                                                                                                                                                                                                                | Frame-locator Editor actions plus persisted payload and runtime projection assertions.             |
| Assets                                  | Types model assets, but file MIME/size support is currently JSON/JS/MJS and narrow.                        | First production asset set supports scripts/sourcefiles/json and small local texture image assets; later phase extends to GLB/GLTF/audio before claiming broad main asset parity.                                                                                                                                                                        | Upload/import/list/edit/delete/folder/search/metadata tests and snapshot export/import.            |
| Sourcefiles and Code Editor             | `sourcefiles` and `codeEditorSourcefiles` are stubbed/unsupported.                                         | Sourcefile listing/content/save/revert, Monaco-compatible text asset behavior, script scan/attribute extraction, generated `.js`/`.mjs` artifacts.                                                                                                                                                                                                       | Unit parser tests, Editor Code Editor E2E, generated artifact/hash/runtime script lifecycle tests. |
| Script attributes and hot reload        | Shared types model scripts/bindings/artifacts.                                                             | Parse PlayCanvas script attributes, bind values to scene entities, regenerate artifacts, avoid duplicate script registrations after reopen/switch.                                                                                                                                                                                                       | Vitest/Jest parser/projection tests and browser runtime lifecycle probes.                          |
| Templates/prefabs                       | Upstream Editor exposes templates/prefabs, but the local first slice does not prove them.                  | Classify as phased main work unless Phase 0 proves the MMOOMM product fixture needs them immediately. Typed unavailable states are acceptable only while the full brief remains open.                                                                                                                                                                    | Contract/UI tests if implemented, or explicit unavailable UX and docs.                             |
| Realtime documents                      | Single-user snapshot-port persistence exists; durable ShareDB op history is not final.                     | Durable document persistence for scenes/assets/settings/sourcefiles; multi-user collaboration is either implemented or explicitly held as an open milestone.                                                                                                                                                                                             | ShareDB/op-store tests, WebSocket frame/close evidence, stale revision/conflict E2E.               |
| Presence/chat/selection collaboration   | Stubbed/no-op today.                                                                                       | Either implement main collaboration surfaces or keep the full brief open with typed unavailable states.                                                                                                                                                                                                                                                  | Multi-context Playwright if implemented; explicit product unavailable UX if deferred.              |
| Version control                         | Branches/checkpoints are stubbed.                                                                          | Checkpoints, branches, merges/conflicts, item history, or explicit phased non-closure.                                                                                                                                                                                                                                                                   | Backend contract tests and UI/E2E for VCS actions if implemented.                                  |
| PlayCanvas project export/download      | Backup/export behavior is not the same as Universo runtime publication or fixture export.                  | Export/download project authoring data safely when supported, with branch/history limitations documented and no token/path leaks.                                                                                                                                                                                                                        | Project export contract tests and safe UI evidence.                                                |
| Universo runtime manifest publication   | Runtime manifests exist; current publish returns snapshot-derived manifests.                               | Publish immutable runtime manifests/assets only, block dirty/conflicted projects, include selected scene/assets/scripts/bindings/MMOOMM metadata in hash/sync.                                                                                                                                                                                           | Hash tests, sync tests, publish E2E, runtime manifest assertions.                                  |
| Runtime projection                      | `PlayCanvasRuntimeManifest` exists; current widget primarily consumes widget config/runtime module output. | Runtime reads Editor-derived manifest/config without Editor internals and preserves Colyseus authoritative ownership.                                                                                                                                                                                                                                    | `apps-template-mui` tests, import/runtime E2E, no Editor package imports in runtime.               |
| Product fixture                         | Existing generator is API-first and writes the old flight fixture.                                         | Browser-first generator produces `metahubs-mmoomm-app-snapshot.json` with Editor provenance and runtime replay.                                                                                                                                                                                                                                          | New fixture contract plus generator and replay Playwright suites.                                  |

## Phase 0: Readiness, Gap Audit, and Test Strategy

-   [ ] Inventory current UI routes and E2E helpers for:
    -   metahub creation;
    -   package connection;
    -   PlayCanvas project creation/selection;
    -   entity module authoring;
    -   runtime layout/widget configuration;
    -   Editor iframe interactions;
    -   publication/application sync.
-   [ ] Identify which browser journey steps have acceptable user-facing UI and which need UI work before the generator can be browser-first.
-   [ ] Record every remaining PlayCanvas compatibility stub from `playcanvasEditorCompatibility.ts` and map it to:
    -   main required;
    -   explicitly phased but brief remains open;
    -   optional commercial/cloud extra;
    -   typed unavailable with safe UX.
-   [ ] Define the first production asset set:
    -   required in first implementation: JSON, scripts/sourcefiles, generated `.js`/`.mjs`, and small PNG/JPEG/WebP texture assets;
    -   Code Editor text assets: JavaScript, ESM, JSON, shader/text assets used by upstream Editor panels should be first-milestone if they are required by the Editor UI path; otherwise they must be typed unavailable with safe UX and keep the brief open;
    -   templates/prefabs: phased main work unless Phase 0 proves the MMOOMM product fixture needs them immediately;
    -   mandatory before Milestone B/full main Editor acceptance: GLB/GLTF model assets, audio assets, material/texture dependency metadata, dependency warnings, thumbnails/previews where upstream UI expects them, and snapshot/export policy for assets that are too large to inline;
    -   out of scope: asset marketplace/store and commercial cloud import services.
-   [ ] Decide whether runtime projection extends the existing `playcanvasCanvas` widget config or adds a manifest reader/new widget only if the existing config cannot represent Editor-derived manifests cleanly.
-   [ ] Produce a signed Phase 0 runtime widget decision before UI implementation starts:
    -   preferred path: extend the existing `playcanvasCanvas` widget with an Editor-derived manifest reader;
    -   new widget path: allowed only with a documented impossibility proof, dashboard-template parity checklist, i18n plan, and `apps-template-mui` boundary tests.
-   [ ] Define fixture provenance fields/assertions:
    -   browser-authored project id/scene id;
    -   saved/reopened revision;
    -   publish id/hash;
    -   runtime manifest checksum;
    -   generated artifact hashes;
    -   E2E trace/screenshot names;
    -   no API-only authoring marker.
-   [ ] Mark provenance ids/hashes as internal test/export evidence only; they must not become normal user-facing labels.
-   [ ] Define E2E suite split to avoid one fragile mega-test:
    -   authoring generator suite;
    -   runtime replay suite;
    -   negative/security suite;
    -   responsive/UX suite.
-   [ ] Define stable Playwright architecture:
    -   Page Object helpers for metahub creation, package resources, Editor iframe, sourcefiles/assets, publish/export, runtime launch, and Colyseus runtime;
    -   per-worker isolated metahub/application data;
    -   artifact handoff between generator and replay specs through explicit fixture/provenance files;
    -   web-first assertions instead of fixed sleeps;
    -   trace/video/screenshot-on-failure policy.
-   [ ] Confirm local E2E Node and Supabase workflow:
    -   `pnpm supabase:e2e:start:minimal`
    -   `pnpm env:e2e:local-supabase`
    -   `pnpm doctor:e2e:local-supabase`
    -   `pnpm run build:e2e:local-supabase`
    -   `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "..."`
-   [ ] Decide how CI obtains a verified PlayCanvas Editor artifact given the vendored upstream Node requirement `>=22.22.0` and the current package-local build posture.

## Phase 1: Shared Contracts and Safe Storage Shapes

-   [ ] Extend `@universo-react/types` contracts without unnecessary schema/template version bumps:
    -   sourcefiles/code editor documents;
    -   asset file metadata for first production asset set;
    -   project settings and launch documents;
    -   runtime projection metadata;
    -   dirty/conflict/revision state;
    -   publication preconditions;
    -   provenance metadata for generated fixtures.
-   [ ] Decide the sourcefile storage model before implementation:
    -   preferred path: model sourcefiles as PlayCanvas asset/script records in existing PlayCanvas tables with file references;
    -   fallback path: add a real metahub structure migration if existing assets/files cannot represent upstream sourcefile semantics;
    -   either path must update snapshot export/restore/copy and compatibility descriptors.
-   [ ] Add Zod validation for every new command/DTO:
    -   strict object schemas;
    -   bounded payload sizes;
    -   bounded array lengths;
    -   UUID v7 where new IDs are generated by the platform, using an actual UUID v7 validator instead of a generic UUID-only check;
    -   no unknown token/session fields.
-   [ ] Extend `PlayCanvasRuntimeManifest` only with runtime-safe fields. Do not leak authoring paths, PCUI state, Editor Observer data, or compatibility tokens.
-   [ ] Add helper utilities in `@universo-react/utils` for:
    -   stable manifest checksums;
    -   pure manifest/source path canonicalization that does not touch local filesystem roots;
    -   projection canonicalization;
    -   provenance contract verification.
-   [ ] Keep filesystem roots, symlink checks, MIME/path policy, file locks, and local-provider safety in `metahubs-backend` storage services, not in shared browser-safe utilities.
-   [ ] Add publication hash tests for each Editor-authored axis:
    -   selected scene changes;
    -   scene payload changes;
    -   runtime asset changes;
    -   generated artifact changes;
    -   script binding changes;
    -   `metadata.mmoomm.*` changes;
    -   sourcefile changes that affect generated artifacts.

### Contract Example

```ts
import { z } from 'zod'

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const uuidV7Schema = z
    .string()
    .uuid()
    .refine((value) => UUID_V7_PATTERN.test(value), 'Expected UUID v7 with RFC 4122 variant bits')

export const publishPlayCanvasProjectCommandSchema = z
    .object({
        projectId: uuidV7Schema,
        selectedSceneId: uuidV7Schema,
        expectedRevision: z.number().int().positive(),
        requestId: uuidV7Schema,
        includeRuntimeManifest: z.literal(true)
    })
    .strict()
```

## Phase 2: Backend Storage, Protocol, and Publication Guards

-   [ ] Keep `@universo-react/playcanvas-editor-backend` as a protocol/route-factory package with injected ports. Do not move metahub-owned storage wholesale into that package.
-   [ ] Implement metahub-backed sourcefile storage:
    -   list files;
    -   read content;
    -   create/update/delete;
    -   save/revert semantics for Code Editor text assets;
    -   revision/conflict handling;
    -   script scan integration.
-   [ ] Implement project settings and launch storage:
    -   rendering settings;
    -   physics settings and supported physics-engine flags;
    -   audio settings;
    -   WebGL/WebGPU-safe launch configuration;
    -   compatibility projection from Editor engine `2.19.5` to runtime engine `2.18.1`, including safe stripping or fail-closed handling for unsupported render, physics, WebGPU, Ammo, or launch settings;
    -   launch preview descriptor with origin-bound tokens;
    -   CSP/referrer/origin checks for launch preview;
    -   E2E launch proof that does not disable browser security.
-   [ ] Implement the first production asset pipeline:
    -   script/json/text assets;
    -   small image texture upload;
    -   updated allowed MIME/extension contracts for PNG/JPEG/WebP texture files in shared types and backend file service;
    -   metadata, virtual paths/folders, tags/search;
    -   dependency metadata when the Editor exposes it;
    -   checksum and size guards;
    -   snapshot export/import for bundled local files.
-   [ ] Add the full main asset pipeline before Milestone B:
    -   GLB/GLTF model upload/import;
    -   audio file upload/import;
    -   material and texture dependency metadata;
    -   thumbnails/previews where practical;
    -   import/conversion job status or explicit local-provider equivalent;
    -   unsupported/oversized asset fail-closed states;
    -   snapshot export/import policy for large binary assets without forcing S3/admin storage into this slice.
-   [ ] Implement script asset parsing and generated artifact storage:
    -   parse PlayCanvas script attributes;
    -   store parse diagnostics safely;
    -   generate `.js`/`.mjs` artifacts;
    -   link artifacts to Platformo modules only through explicit script/module bindings;
    -   fail publish when runtime-critical script artifacts are missing or stale.
-   [ ] Implement durable realtime document persistence:
    -   scenes;
    -   assets;
    -   settings;
    -   sourcefiles;
    -   stale revision detection;
    -   idempotent replay for same request/payload;
    -   fail-closed conflict responses.
-   [ ] Implement the ShareDB/OT backend as a real protocol surface, not a renamed snapshot-port:
    -   collections: `scenes`, `assets`, `settings`, and sourcefile/text documents if represented through ShareDB;
    -   operation payload: document the OT format, supported op shapes, maximum op size, and validation/canonicalization rules;
    -   binary policy: meshes, textures, audio, and other large binaries never travel over ShareDB/WebSocket control ops; control ops carry only metadata, file references, revisions, and hashes;
    -   op history: persist durable operation history or a documented compacted snapshot+revision log that supports reconnect/conflict semantics;
    -   permission gates: metahub/project/scene/asset/sourcefile allowlists per authenticated session;
    -   ownership gates: user role, project membership, package attachment, active branch/checkpoint scope where VCS is enabled;
    -   connection lifecycle: origin-bound handshake, token expiry close, stale-token disconnect, replay prevention, and cleanup on iframe reload;
    -   reconnect behavior: resume only when revisions match or produce a localized conflict state;
    -   tests: unit tests for op validation, backend tests for allowlists/stale revisions, and Playwright WebSocket frame/close evidence.
-   [ ] Decide collaboration/VCS milestone boundary:
    -   if implementing collaboration now, add presence, selection, chat, camera/selection indicators, and multi-context disconnect/reconnect behavior;
    -   if implementing VCS now, add checkout, commit/checkpoint, branch creation/switching, merge, conflict resolution, and item history preservation;
    -   VCS mutations must be owner/role checked, origin/token bounded, and network failures must not silently corrupt the active branch;
    -   dirty state must block checkout/switch/merge where upstream semantics require it;
    -   binary asset merge conflicts must fail closed with a user-facing conflict state;
    -   if collaboration/VCS is deferred, keep compatibility descriptors honest, add safe unavailable UX, document the gap, and keep the full brief open.
-   [ ] Separate export/publication semantics explicitly:
    -   PlayCanvas project export/download: authoring project backup/export, safe branch/history limitation messaging, no runtime claim;
    -   Universo runtime manifest publication: immutable `PlayCanvasRuntimeManifest` generation and application sync;
    -   browser-authored fixture export: final `metahubs-mmoomm-app-snapshot.json` generation after browser proof.
-   [ ] Implement PlayCanvas project export/download before Milestone B:
    -   define archive/envelope contents for project settings, scenes, assets metadata, sourcefiles, generated artifacts, script bindings, and runtime manifests when requested;
    -   document and enforce branch/history limitations of exported projects;
    -   omit or safely represent credentials, compatibility tokens, signed URLs, local absolute paths, and raw provider internals;
    -   add backend contract tests, frontend safe status UI, and an E2E download/export proof.
-   [ ] Strengthen Universo runtime manifest publication:
    -   selected scene required;
    -   dirty project blocked;
    -   conflicted project blocked;
    -   stale compatibility token blocked;
    -   missing artifact blocked;
    -   runtime manifest checksum validated;
    -   immutable published asset URLs only.
-   [ ] Extend application sync to preserve Editor-derived runtime manifests and ensure `_app_playcanvas_manifests` rows are updated/retired safely.
-   [ ] Add OpenAPI/rest-doc updates for new routes and typed unavailable states.

### Storage Boundary Note

Prefer the existing PlayCanvas project storage tables (`_mhb_playcanvas_projects`, `_mhb_playcanvas_scenes`, `_mhb_playcanvas_assets`, `_mhb_playcanvas_script_assets`, `_mhb_playcanvas_scene_script_bindings`, `_mhb_playcanvas_generated_artifacts`) for sourcefiles/assets where the model fits. Introduce a new dedicated sourcefile table only after Phase 0 proves the existing asset/file model is insufficient, and only through the registered metahub structure/migration boundary with tests. Adding a system table is a schema/structure migration decision, even when the metahub template version should not be bumped. The SQL example below uses the existing asset table to show the preferred store pattern.

### Safe SQL Store Example

```ts
import type { DbExecutor } from '@universo-react/utils'
import { qSchemaTable } from '@universo-react/database'

export async function updateSourcefileAssetRevision(
    executor: DbExecutor,
    schemaName: string,
    input: {
        assetId: string
        expectedRevision: number
        fileRef: Record<string, unknown>
        contentHash: string
        metadata: Record<string, unknown>
    }
) {
    const table = qSchemaTable(schemaName, '_mhb_playcanvas_assets')
    const result = await executor.query(
        `
      UPDATE ${table}
         SET file_ref = $1::jsonb,
             metadata = $2::jsonb,
             _upl_version = _upl_version + 1,
             _upl_updated_at = NOW()
       WHERE id = $3
         AND asset_type IN ('script', 'json', 'other')
         AND _upl_version = $4
         AND _upl_deleted = false
         AND _mhb_deleted = false
       RETURNING id, _upl_version AS "version", file_ref AS "fileRef"
    `,
        [
            JSON.stringify({ ...input.fileRef, hash: input.contentHash }),
            JSON.stringify(input.metadata),
            input.assetId,
            input.expectedRevision
        ]
    )

    if (result.rows.length !== 1) {
        throw new Error('PLAYCANVAS_SOURCEFILE_ASSET_REVISION_CONFLICT')
    }

    return result.rows[0]
}
```

## Phase 3: Editor Frontend Artifact Integration

-   [ ] Keep the upstream Editor artifact isolated. Do not import vendored Editor internals into MUI host code.
-   [ ] Define the Editor boot contract before wiring new surfaces:
    -   artifact origin and route shape;
    -   iframe attributes: `sandbox`, `referrerpolicy`, `allow`, `tabindex`, and focus behavior;
    -   CSP expectations for artifact, REST, realtime, asset, and launch endpoints;
    -   generated `window.config` keys and which values are allowed to reach the iframe;
    -   sanitized endpoint descriptors with no admin URLs, local filesystem paths, or raw signed URLs in normal UI;
    -   postMessage/bridge message schema, source marker, request id, command names, payload bounds, and error envelope;
    -   received-message origin checks and hostile-origin rejection tests;
    -   compatibility token expiry, refresh/renew flow where supported, stale-token close behavior, and iframe reload cleanup.
-   [ ] Extend `window.config` injection and compatibility descriptors for the new backend surfaces:
    -   sourcefiles;
    -   assets;
    -   realtime documents;
    -   publish/export;
    -   collaboration/VCS if implemented.
-   [ ] Wire upstream sourcefiles endpoints used by the vendored Editor:
    -   list;
    -   content;
    -   create;
    -   update;
    -   delete;
    -   scan;
    -   URL generation without leaking raw access tokens in normal UI.
-   [ ] Support Code Editor save/revert behavior for text assets instead of pretending all documents are unconditional autosave.
-   [ ] Integrate asset upload/list/search/folder actions expected by the upstream Assets Panel for the first production asset set.
-   [ ] Add Editor-visible user actions for the MMOOMM scene:
    -   create entities;
    -   delete entities;
    -   duplicate entities;
    -   reparent entities with cycle prevention;
    -   edit transforms;
    -   add components;
    -   edit camera/light/render/script inspector properties;
    -   switch scenes and prove cleanup/load semantics;
    -   attach scripts;
    -   edit script attributes;
    -   configure metadata.
-   [ ] Add Code Editor behavior expected by the main workflow:
    -   Monaco tabs/files/status indicators;
    -   lint/autocomplete diagnostics where supported by the vendored Editor;
    -   collaborative text state if collaboration is in the current milestone;
    -   syntax errors shown safely without crashing the viewport.
-   [ ] Use upstream Editor/PCUI extension conventions for any custom Editor-visible MMOOMM metadata controls. Do not rebuild Editor panels in MUI, and add iframe resize/focus proof for any custom visible control.
-   [ ] Ensure the Editor can close/reopen without duplicate script registration, stale session reuse, or hidden fallback mode.
-   [ ] Add E2E helpers with bounded upstream Editor selectors. Platformo/MUI surfaces should use roles, labels, accessible names, or stable test ids; upstream PCUI internals may use carefully scoped selectors where no accessible alternative exists.

## Phase 4: Metahub Frontend Authoring Surfaces

-   [ ] Extend the typed frontend API client beyond project list/create/update/delete:
    -   scenes;
    -   assets;
    -   files/sourcefiles;
    -   script assets;
    -   script bindings;
    -   generated artifacts;
    -   publish/export;
    -   conflict metadata.
-   [ ] Extend centralized `metahubsQueryKeys` for each new server-state surface.
-   [ ] Use TanStack Query invalidation around Editor saves and publish/export so MUI surfaces do not show stale project state.
-   [ ] Reuse existing package/resource/module/layout UI primitives from the current metahub frontend and shared `@universo-react/template-mui` authoring primitives rather than adding one-off panels.
-   [ ] Reuse concrete existing primitives by surface:
    -   package/resource lists: current `MetahubPackagesTab` table/card/actions patterns and `ConfirmDeleteDialog`;
    -   metahub entity/module authoring: existing entity workspace, `EntityFormDialog`, module editor shell, row actions, conflict dialogs, and localized validation patterns;
    -   layout/widget configuration: existing `LayoutList`, `LayoutDetails`, `ColumnsContainerEditorDialog`, widget action menus, and shared layout dialogs;
    -   published runtime lists/forms: `apps-template-mui` `detailsTable`, `relationBuilder`, `columnsContainer`, `FormDialog`, `CrudDialogs`, `ConfirmDeleteDialog`, and `ResourcePreview`;
    -   resource-source/media fields: existing `resourceSource` field editor, safe preview/placeholder behavior, and optional empty-state behavior.
-   [ ] Keep published runtime UI work strictly in `packages/universo-react-apps-template-mui`; it must not import `@universo-react/template-mui`, metahubs frontend/backend packages, or Editor packages.
-   [ ] Add static/component boundary tests for primitive reuse and package boundaries. Runtime MUI work must fail tests if it introduces a one-off CRUD/dialog/table surface where an existing primitive covers the interaction.
-   [ ] Add any missing UI/test ids needed for browser-first generation:
    -   package attachment;
    -   module source mode/sourcefile controls;
    -   runtime layout/widget selection;
    -   PlayCanvas project selection;
    -   publish status;
    -   export status.
-   [ ] Add localized EN/RU copy for:
    -   sourcefile save/revert;
    -   asset upload/unsupported type;
    -   stale/conflict;
    -   publish blocked;
    -   runtime manifest generation;
    -   safe unavailable states for deferred optional/cloud-only surfaces.
-   [ ] Ensure semantic long-text fields use multiline controls, and file/resource/JSON fields render previews, badges, or formatted summaries, not raw JSON.
-   [ ] Preserve optional resource-source/media empty-state behavior: empty optional fields render quiet placeholders/previews, not validation errors.

### TanStack Query Example

```tsx
const saveSceneMutation = useMutation({
    mutationFn: (payload: SavePlayCanvasSceneRequest) => playcanvasProjectsApi.saveScene(metahubId, projectId, payload),
    onSuccess: async () => {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.playcanvasProject(metahubId, projectId)
            }),
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.playcanvasScenes(metahubId, projectId)
            }),
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.playcanvasRuntimeManifests(metahubId, projectId)
            })
        ])
    }
})
```

## Phase 5: Runtime Projection and Colyseus Contract

-   [ ] Implement or extend a manifest reader in `apps-template-mui` that consumes Editor-derived `PlayCanvasRuntimeManifest` data without importing Editor packages.
-   [ ] Decide whether the existing `playcanvasCanvas` widget config is sufficient. Add a new widget schema only if the manifest cannot be represented cleanly in the existing widget contract.
-   [ ] Add differential proof that runtime reads the published `PlayCanvasRuntimeManifest` / `_app_playcanvas_manifests` data, not a hard-coded or stale `playcanvasCanvas` config:
    -   changing selected scene changes the rendered runtime;
    -   changing `metadata.mmoomm.*` changes runtime behavior;
    -   removing a required runtime manifest fails closed;
    -   authoring-only `playcanvas-projects/...` paths are never fetched by the published runtime.
-   [ ] Define allowed runtime URI forms structurally:
    -   allow only immutable published asset URLs or application runtime asset endpoints owned by the published application;
    -   require hashes/checksums for referenced runtime assets;
    -   reject authoring paths, local absolute paths, signed URLs, query tokens, `access_token`, compatibility session URLs, and arbitrary external origins unless a future approved provider contract explicitly allows them.
-   [ ] Map `metadata.mmoomm.*` to runtime-safe concepts:
    -   controlled ship template;
    -   station/target;
    -   selectable object metadata;
    -   collision/guard bounds;
    -   spawn/default camera;
    -   script-module link;
    -   Colyseus room/runtime role metadata.
-   [ ] Keep MMOOMM interpretation metadata/module/adapter driven. `apps-template-mui` may provide a generic manifest reader and PlayCanvas canvas runtime, but it must not grow MMOOMM-only dashboard branches unless they are isolated behind package metadata and covered by a static boundary test.
-   [ ] Keep Colyseus authoritative:
    -   client messages are intents;
    -   server validates shape and permissions;
    -   fixed server tick mutates Schema state;
    -   clients render with interpolation/prediction/reconciliation;
    -   reconnect states are safe and localized.
-   [ ] Add runtime script lifecycle handling:
    -   ESM module load and script registration;
    -   `initialize`;
    -   `update`;
    -   `postUpdate`;
    -   `destroy`;
    -   hot-reload cleanup where supported;
    -   no duplicate registrations after reopen/switch.
-   [ ] Add asset lifecycle handling:
    -   async load indicators;
    -   missing/unsupported asset states;
    -   scene switch cleanup;
    -   asset unload/dispose where applicable.
-   [ ] Preserve runtime cleanup:
    -   resize observer cleanup;
    -   window listener cleanup;
    -   room leave/disconnect cleanup;
    -   PlayCanvas app destroy;
    -   GPU/canvas disposal.

### Runtime Boundary Example

```ts
import type { PlayCanvasRuntimeManifest } from '@universo-react/types'

const FORBIDDEN_RUNTIME_URL_KEYS = [/token/i, /access_token/i, /session/i, /signature/i]
const AUTHORING_PATH_SEGMENT = 'playcanvas-projects/'

const isApprovedRuntimeUrl = (value: string, approvedOrigins: ReadonlySet<string>): boolean => {
    if (value.includes(AUTHORING_PATH_SEGMENT) || value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value)) {
        return false
    }

    const parsed = new URL(value)
    if (!approvedOrigins.has(parsed.origin)) return false
    for (const key of parsed.searchParams.keys()) {
        if (FORBIDDEN_RUNTIME_URL_KEYS.some((pattern) => pattern.test(key))) return false
    }
    return true
}

export function assertRuntimeManifestIsPublishable(manifest: PlayCanvasRuntimeManifest, approvedOrigins: ReadonlySet<string>): void {
    if (!manifest.checksum) {
        throw new Error('PLAYCANVAS_RUNTIME_MANIFEST_NOT_IMMUTABLE')
    }

    for (const asset of manifest.assets) {
        if (asset.url && (!asset.hash || !isApprovedRuntimeUrl(asset.url, approvedOrigins))) {
            throw new Error('PLAYCANVAS_RUNTIME_MANIFEST_HAS_UNSAFE_ASSET_URL')
        }
    }

    for (const script of manifest.scripts) {
        if (script.artifactUrl && (!script.artifactHash || !isApprovedRuntimeUrl(script.artifactUrl, approvedOrigins))) {
            throw new Error('PLAYCANVAS_RUNTIME_MANIFEST_HAS_UNSAFE_SCRIPT_URL')
        }
    }
}
```

## Phase 6: Browser-First Fixture Generator

-   [ ] Create a new generator spec, for example:
    -   `tools/testing/e2e/specs/generators/metahubs-mmoomm-app-export.spec.ts`
-   [ ] Create or generalize a fixture contract, for example:
    -   `tools/testing/e2e/support/mmoommAppFixtureContract.ts`
-   [ ] Keep the existing flight fixture and generator as a baseline until the new fixture is stable.
-   [ ] Make the new contract assert:
    -   fixture filename is `metahubs-mmoomm-app-snapshot.json`;
    -   `playcanvasProjects` exists;
    -   selected/default scene exists;
    -   assets/sourcefiles/scripts exist for the MMOOMM scene;
    -   generated artifacts exist with hashes;
    -   scene script bindings exist;
    -   `playcanvasRuntimeManifests` exists;
    -   runtime manifest checksum matches exported state;
    -   `metadata.mmoomm.*` exists for the controlled ship, station/target, spawn/camera, and Colyseus role metadata;
    -   provenance proves browser-authored -> save/reopen -> publish/sync -> export.
-   [ ] The generator may write the final JSON file only after browser proof passes. Direct JSON writing must be the last export step, not a substitute for authoring.
-   [ ] Add generator guardrails that fail the test if the authoring path uses API/DB/file shortcuts after bootstrap:
    -   no `APIRequestContext` metahub authoring calls for package connection, PlayCanvas authoring, publish, runtime verification, or provenance;
    -   no `page.request` authoring calls to metahub/package/module/layout/PlayCanvas endpoints after bootstrap;
    -   no direct DB writes for authoring state;
    -   no hidden test-only routes;
    -   no `fs.writeFile`/`fs.writeFileSync` to the final fixture path before the browser proof marker is recorded;
    -   no direct fixture writes until the final export step after browser proof;
    -   allow API only for auth bootstrap, cleanup, explicit state inspection, and final deterministic export plumbing.
-   [ ] Implement generator guardrails mechanically:
    -   static scan or lint rule for forbidden generator imports/calls in the authoring phase;
    -   runtime route/request recorder that fails when forbidden authoring endpoints are called outside allowed bootstrap/export windows;
    -   provenance verifier that ties browser screenshots/traces, saved/reopened revision, publication hash, runtime manifest checksum, and final JSON file hash together.
-   [ ] Save traces/screenshots for:
    -   metahub creation;
    -   package connection;
    -   Editor opened with real upstream regions;
    -   scene authoring;
    -   Code Editor/sourcefile save;
    -   publish;
    -   runtime canvas;
    -   export result.
-   [ ] Add a local minimal Supabase E2E lane for generator plus runtime replay.

## Phase 7: Test Plan

### Unit and Contract Tests

-   [ ] `@universo-react/types` tests:
    -   new Zod schemas;
    -   UUID v7-compatible inputs with semantic version-bit checks;
    -   bounded payload rejection;
    -   typed unavailable states.
-   [ ] `@universo-react/utils` tests:
    -   manifest canonicalization;
    -   publication hash change matrix;
    -   provenance contract verification;
    -   no authoring path leaks.
-   [ ] PlayCanvas script parser tests:
    -   attributes;
    -   ESM/classic distinction;
    -   parse diagnostics;
    -   invalid script fail-closed.
-   [ ] Add manifest differential tests:
    -   selected scene changes manifest hash, application sync output, and runtime behavior;
    -   `metadata.mmoomm.*` changes manifest hash and runtime behavior;
    -   runtime asset changes manifest hash and runtime asset loading;
    -   generated script artifact changes manifest hash and script behavior;
    -   removing required manifest data fails closed.

### Backend Tests

-   [ ] Metahub PlayCanvas stores:
    -   parameterized SQL;
    -   schema-qualified identifiers;
    -   fail-closed update/delete with `RETURNING`;
    -   revision conflicts;
    -   idempotent replay.
-   [ ] Compatibility backend route factories:
    -   strict DTO parsing;
    -   auth/role failure;
    -   CSRF failure;
    -   origin failure;
    -   token expiry/replay;
    -   WebSocket document allowlist.
-   [ ] Publish/export:
    -   dirty blocked;
    -   conflict blocked;
    -   missing generated artifact blocked;
    -   selected scene affects manifest/hash;
    -   `_app_playcanvas_manifests` sync inserts/updates/retires rows safely.

### Frontend Component and Hook Tests

-   [ ] API client tests for all new methods.
-   [ ] TanStack Query hook tests for:
    -   cache keys;
    -   invalidation;
    -   conflict UX;
    -   localized errors.
-   [ ] MUI UI tests for:
    -   no raw IDs;
    -   no raw JSON;
    -   multiline long text;
    -   disabled/unavailable states;
    -   concrete primitive reuse and package-boundary assertions for the surfaces listed in Phase 4.
-   [ ] Add UX negative canaries:
    -   seeded poison data with UUID-only names, raw object/resource/media/block-content fields, and raw protocol-like error payloads;
    -   UUID-only labels must not render as business labels;
    -   object cells and raw JSON must fail normal table/card checks;
    -   raw Zod/Colyseus/WebSocket messages must be mapped to localized user-facing errors;
    -   RU validation failures must render localized copy;
    -   optional empty resource-source/media fields must stay quiet and show placeholders/previews rather than errors;
    -   page-level overflow must fail except for approved internal table/grid scrolling.

### Playwright E2E Tests

-   [ ] Extend existing Resources -> Packages PlayCanvas flow.
-   [ ] Add browser-first generator for `metahubs-mmoomm-app-snapshot.json`.
-   [ ] Add static/runtime generator guards against API-first authoring shortcuts and direct fixture writes before browser proof.
-   [ ] Generalize runtime replay so the new fixture goes through import/publish/open runtime.
-   [ ] Add multi-client Colyseus tests:
    -   movement intent;
    -   server state update;
    -   observed movement in another browser;
    -   reconnect;
    -   unsafe state mutation rejected;
    -   malicious client-side coordinate/state patch does not mutate server Schema and is not observed by another client;
    -   direct messages that attempt to set final coordinates/state are rejected;
    -   malformed role/runtime metadata is rejected or ignored fail-closed;
    -   replayed auth/session messages are rejected;
    -   impossible movement vectors/speeds are clamped or rejected server-side;
    -   room-full and protocol/version-mismatch states are localized if the runtime exposes them;
    -   unauthorized message shape produces a localized safe error or silent fail-closed behavior without protocol leakage.
-   [ ] Add iframe and Editor UI tests:
    -   real upstream toolbar/hierarchy/assets/inspector/viewport;
    -   upstream boot fingerprint: iframe origin/sandbox/CSP/referrer policy, expected Editor REST/realtime endpoint classes, expected upstream UI markers, no host DOM access, and no hosted fallback;
    -   upstream-only action oracle: create entity/component/script through iframe-visible Editor actions, save, reopen, and assert persisted upstream-shaped scene/sourcefile payload plus runtime projection;
    -   Code Editor/sourcefile save/revert;
    -   no hosted fallback;
    -   no disabled/stub endpoints for in-scope Milestone A/B main surfaces;
    -   per-axis save/reopen persistence for scene, settings, assets, sourcefiles, script bindings, generated artifacts, and `metadata.mmoomm.*`.
-   [ ] Add WebSocket evidence:
    -   expected Editor realtime endpoint filters;
    -   expected Colyseus endpoint filters;
    -   frame sent/received counters per endpoint class;
    -   close codes/reasons and reconnect behavior;
    -   frame payload shape checks without logging secrets;
    -   no token/room/session/protocol leakage on normal user surfaces.
-   [ ] Add viewport matrix:
    -   `1920x1080`;
    -   `768x1024`;
    -   `390x844`.
-   [ ] Add screenshot evidence and canvas pixel checks for each runtime viewport.
-   [ ] Add runtime visual/input assertions:
    -   bounded canvas bounding box;
    -   nonblank pixel threshold with more than one sampled color bucket;
    -   primary object/camera framing;
    -   movement over time;
    -   HUD non-overlap;
    -   focus enter/exit;
    -   page-level overflow checks with internal grid/table scroll exceptions only where approved.
-   [ ] Add browser-observable runtime manifest differential tests:
    -   publish two runtimes that differ only in selected scene, then assert canvas/framing changes;
    -   publish two runtimes that differ only in `metadata.mmoomm.*`, then assert HUD/behavior/WebSocket room options change;
    -   publish two runtimes that differ only in runtime asset/script artifact, then assert visible canvas or script behavior changes;
    -   assert the runtime network log never fetches `playcanvas-projects/...`.
-   [ ] Add flakiness and locator guardrails:
    -   static/review check against `waitForTimeout` outside debugging helpers;
    -   static/review check against long CSS/XPath chains as primary Platformo locators;
    -   no shared mutable worker data across generator/replay specs;
    -   all WebSocket/canvas assertions wait for explicit readiness signals;
    -   screenshots are taken after settled UI/canvas readiness, not as a substitute for assertions.

### Bad Implementation Canary Matrix

| Bad implementation                                                                          | Required failing proof                                                                                                      |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| API-first generator authors metahub/packages/modules/Editor state through API instead of UI | Generator guard detects forbidden authoring API/DB calls or missing browser provenance and fails before fixture write.      |
| Fake/fallback Editor renders mock toolbar/hierarchy/assets DOM                              | Upstream-only action oracle cannot create/save/reopen a real entity/component/script through iframe-visible Editor actions. |
| Save/reopen only preserves scene but loses assets/sourcefiles/scripts/settings/metadata     | Per-axis save/reopen assertions fail for the missing state.                                                                 |
| Runtime ignores `PlayCanvasRuntimeManifest` and uses stale hard-coded widget config         | Manifest differential tests fail when selected scene/metadata/assets change without runtime behavior changing.              |
| Published runtime fetches authoring `playcanvas-projects/...` paths                         | Network assertions and manifest leak tests fail.                                                                            |
| Colyseus accepts client authoritative coordinates/state                                     | Malicious mutation test shows server Schema or second client changed and fails.                                             |
| WebSocket proof observes an unrelated socket only                                           | Endpoint filters and per-endpoint frame counters fail.                                                                      |
| UI exposes raw UUID/JSON/object/protocol/internal errors                                    | UX negative canaries fail in EN/RU.                                                                                         |
| Runtime canvas renders but is unusable or overlapped                                        | Canvas bbox/framing/movement/HUD/focus/overflow assertions fail.                                                            |
| One-off runtime UI bypasses `apps-template-mui` or imports legacy/template packages         | Static dependency guard or component boundary test fails.                                                                   |

### Playwright WebSocket Example

```ts
const sockets: Array<{ url: string; sent: number; received: number; closed: boolean }> = []

page.on('websocket', (ws) => {
    const record = { url: ws.url(), sent: 0, received: 0, closed: false }
    sockets.push(record)
    ws.on('framesent', () => {
        record.sent += 1
    })
    ws.on('framereceived', () => {
        record.received += 1
    })
    ws.on('close', () => {
        record.closed = true
    })
})

await expect.poll(() => sockets.some((socket) => socket.sent > 0 && socket.received > 0)).toBeTruthy()
await expect(page.getByText(/session|access_token|roomId|stack trace/i)).toHaveCount(0)
```

## UI Contract

-   Platformo/MUI surfaces use existing dashboard, dialog, table/list, card, toolbar, and package/resource primitives before creating new UI.
-   Editor iframe remains an isolated upstream authoring surface. The host can expose safe states and actions, but it must not rebuild Editor panels in MUI.
-   Normal user surfaces must not expose:
    -   raw UUID-only labels;
    -   raw user/owner/reference IDs;
    -   raw JSON;
    -   `[object Object]`;
    -   filesystem paths;
    -   compatibility tokens;
    -   room/session/player IDs;
    -   raw Zod/Colyseus/WebSocket errors;
    -   server stack traces.
-   Hidden/system-owned fields remain hidden unless the surface is explicitly admin/debug-only.
-   Semantic long text such as description, notes, source summary, diagnostics summary, and instructions uses multiline controls or formatted read-only blocks.
-   Structured resource/sourcefile fields render previews, badges, names, MIME/type/size summaries, or safe diagnostics, not raw serialized objects.
-   Validation and empty/error states are localized in EN/RU and user-facing.
-   Responsive proof is required at desktop, tablet, and mobile widths with no page-level horizontal overflow.
-   Keyboard path must work:
    -   focus enters Editor/canvas intentionally;
    -   Escape or explicit controls release focus;
    -   dialogs and text fields are not trapped by canvas controls.

### Per-Surface UI Contract Matrix

| Surface                                   | Reused primitive                                                                      | Visible user labels                                                              | Hidden/internal fields                                                                        | No-leak rule                                                                               | Multiline fields                                                                  | Localized states                                                                  | Responsive/focus evidence                                                          | Playwright proof                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Resources -> Packages package connection  | Existing metahub package/resource list and action controls                            | Package name, status, connect/remove/configure actions                           | Package ids, registry ids, internal version ids, auth tokens                                  | No raw package ids, JSON config blobs, stack traces, or protocol URLs on cards/tables      | Package description and notes are multiline or clipped with tooltip/expanded view | Empty list, attach success, conflict, permission denied, unsupported package      | Desktop/tablet/mobile screenshots, keyboard action path                            | Existing Resources flow extended with Colyseus/PlayCanvas packages          |
| PlayCanvas project panel                  | Existing PlayCanvas package panel/list/dialog primitives                              | Project display name, codename, selected/default scene, publishable status       | Project id, default scene id, artifact paths, compatibility token                             | No raw UUID labels, `playcanvas-projects/...` paths, tokenized URLs, or JSON payload cells | Project description and compatibility notes formatted/multiline                   | Create/update/delete/select, stale/conflict, package missing, project unavailable | No overflow in project list/dialogs, keyboard selection path                       | Project create/select/delete E2E plus component tests                       |
| Editor host shell                         | Existing host page/error/dirty-dialog primitives around isolated iframe               | Open embedded, open separately, save state, dirty/conflict/publish blocked state | Session id, nonce, CSRF token, compatibility token, raw endpoint descriptors                  | No token/session/protocol leakage; no hosted fallback presented as success                 | Safe diagnostics summary is multiline, not stack trace                            | Loading, ready, stale token, permission denied, conflict, artifact unavailable    | Iframe bounded at desktop/tablet/mobile; focus entry/exit; no host DOM access      | Frame-locator upstream UI, security negative tests, screenshots/traces      |
| Upstream Editor iframe                    | Vendored upstream PCUI only, no MUI panel replacement                                 | Upstream toolbar, hierarchy, assets, inspector, viewport, Code Editor labels     | Platform database ids, host session details, metahub storage paths                            | No host protocol/URLs shown in normal Editor UI; PCUI selectors bounded to iframe          | Code Editor text is normal Monaco/editor surface                                  | Sourcefile save/revert, asset unsupported, realtime disconnected, conflict        | Iframe viewport screenshots, Code Editor keyboard path, canvas nonblank            | Editor iframe E2E with upstream regions and sourcefile actions              |
| Sourcefile and script authoring states    | Existing Editor Code Editor plus safe host/status summaries                           | File name, type, save/revert, parse status, generated artifact status            | Sourcefile id, generated artifact id, internal source path, parse worker internals            | No raw diagnostics object, stack trace, or internal path in normal UI                      | Source content editor and parse diagnostics summary are multiline                 | Saved, dirty, reverted, parse failed, generated, stale artifact                   | Keyboard save/revert path and no focus trap                                        | Code Editor E2E, parser unit tests, artifact hash assertions                |
| Asset panel and upload states             | Upstream Assets Panel plus existing safe upload/status components if surfaced in host | Asset name, type, folder/path label, size, upload/import status                  | Asset id, file provider path, signed URL, storage provider internals                          | No tokenized URL, raw provider path, raw metadata JSON, or `[object Object]`               | Asset description/import notes formatted/multiline                                | Upload success, unsupported MIME, too large, missing file, dependency warning     | Drag/drop/upload screenshots, no overflow in lists                                 | Asset upload/list/search/folder E2E and snapshot assertions                 |
| Publish/export dialogs and status         | Existing shared dialogs/actions/status banners                                        | Publish, export, selected scene, validation result, last published time          | Publication id/hash unless formatted as short safe checksum, internal sync ids                | No raw manifest JSON, raw DB ids, token paths, or backend stack details                    | Validation summaries multiline with safe bullet list                              | Dirty blocked, conflict blocked, missing artifact, success, sync failed           | Dialog footer spacing, keyboard actions, responsive screenshots                    | Publish/export E2E, hash/sync tests, screenshot evidence                    |
| Runtime layout/widget selection           | Existing metahub layout/widget UI primitives                                          | Widget name, target area, PlayCanvas runtime manifest selection                  | Widget config JSON, manifest ids, scene ids, raw module ids                                   | No raw widget config JSON or UUID-only option labels                                       | Widget description/help text multiline                                            | Missing manifest, unsupported widget, save success, validation error              | Layout editor no overflow and keyboard path                                        | Layout/widget configuration E2E or explicitly justified temporary bridge    |
| Published `apps-template-mui` canvas/HUD  | Existing `apps-template-mui` dashboard widget/HUD/dialog primitives                   | Connection status, ready/loading, reconnecting, controls, safe gameplay labels   | Room id, session id, player id, raw Colyseus messages, stack traces                           | No room/session/player IDs, raw protocol errors, Zod errors, or JSON state                 | Error/reconnect details are safe multiline summaries                              | Loading, ready, reconnecting, failed reconnect, read-only, permission denied      | Canvas focus enter/exit, Escape release, no overflow at 1920x1080/768x1024/390x844 | Runtime canvas pixel checks, multi-client movement, reconnect screenshots   |
| Fixture import/export and replay surfaces | Existing snapshot import/export dialogs and runtime launch surfaces                   | Snapshot name, export success, import result, replay status                      | Raw fixture JSON, internal snapshot ids, filesystem paths beyond explicit dev artifact output | No raw JSON/object cells in import result tables/cards                                     | Import/export warnings multiline                                                  | Invalid snapshot, generated, imported, replay passed/failed                       | Dialog/list no overflow and keyboard path                                          | Generator writes only after browser proof; replay imports generated fixture |

### Inline Plan UX Review Checklist

-   [ ] Does a normal user complete the browser product journey without knowing database IDs or protocol details?
-   [ ] Are all new authoring/runtime states localized?
-   [ ] Are all long text fields multiline or formatted?
-   [ ] Are structured fields rendered as previews/summaries instead of raw JSON?
-   [ ] Is every destructive action using the shared confirmation contract?
-   [ ] Does the runtime stay inside `apps-template-mui` and reuse existing primitives?
-   [ ] Do screenshots prove no horizontal overflow at required viewports?
-   [ ] Do E2E locators use roles/labels/stable test ids for Platformo UI?
-   [ ] Are upstream Editor PCUI selectors bounded to iframe internals only?

## Documentation Plan

-   [ ] Update GitBook docs in English and Russian:
    -   PlayCanvas Editor main functionality;
    -   PlayCanvas project storage/sourcefiles/assets/scripts;
    -   MMOOMM Editor-authored runtime projection;
    -   fixture generation and replay;
    -   E2E local Supabase workflow.
-   [ ] Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` if new pages are added.
-   [ ] Update package READMEs:
    -   `packages/universo-react-playcanvas-editor-frontend/README.md`
    -   `packages/universo-react-playcanvas-editor-backend/README.md`
    -   `packages/universo-react-metahubs-backend/README.md`
    -   `packages/universo-react-metahubs-frontend/README.md`
    -   `packages/universo-react-apps-template-mui/README.md`
    -   Colyseus/PlayCanvas Engine package READMEs if runtime contracts change.
-   [ ] Document what is implemented, what is typed unavailable, and what is optional commercial/cloud scope.
-   [ ] Document why PlayCanvas Project is not Hub and PlayCanvas Entity is not automatically Platformo Object.
-   [ ] Document security boundaries:
    -   iframe sandbox;
    -   origin binding;
    -   CSRF;
    -   token expiry;
    -   no runtime authoring paths.

## Validation Commands

These commands are planned for IMPLEMENT/QA, not run during this PLAN phase.

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use --silent 22.22.0 || nvm use --silent 22
node -v
```

```bash
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
pnpm run build:e2e:local-supabase
```

Focused package checks should be added as implementation touches packages, for example:

```bash
pnpm --filter @universo-react/types test
pnpm --filter @universo-react/utils test
pnpm --filter @universo-react/metahubs-backend test
pnpm --filter @universo-react/metahubs-frontend test
pnpm --filter @universo-react/applications-backend test
pnpm --filter @universo-react/apps-template-mui test
```

Generator and runtime replay examples:

```bash
node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "MMOOMM Editor-authored app export"
node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "MMOOMM Editor-authored runtime"
```

Closeout should include Prettier/focused lint/build checks for touched packages, local minimal Supabase Playwright evidence, screenshot/trace artifacts, and Thermos/autoreview.

## Potential Challenges

-   "Main PlayCanvas Editor functionality" is broader than the current compatibility slice. The plan must not overclaim if sourcefiles, asset pipeline, realtime collaboration, or version control remain stubbed.
-   Collaboration and VCS are product-significant upstream Editor surfaces. If not implemented in the first milestone, the final brief remains open.
-   Binary asset support can expand storage/snapshot complexity. The first production asset set should be explicit, and GLB/audio/material dependency support is mandatory before Milestone B unless split into an approved follow-up brief.
-   Code Editor save/revert differs from scene live-sync semantics. Treating all documents as unconditional autosave would be incorrect.
-   Editor artifact build/CI needs Node `>=22.22.0`; root/Turbo enrollment or a package-local prebuild strategy must be decided before CI relies on the flow.
-   Browser-first generation is slower and more fragile than API-first generation. Split tests by concern, use Page Object helpers, and keep API support limited to auth/cleanup/export plumbing.
-   Runtime must avoid per-frame React state updates and must not import Editor internals.
-   WebSocket and token security regressions are easy to miss without explicit frame/origin/expiry tests.
-   Clean test DB freedom does not waive SQL safety, DDL boundaries, auth, CSRF, origin checks, or package boundaries.

## Dependencies

-   Local Docker/Supabase availability for E2E minimal stack.
-   Node 22.22+ for PlayCanvas Editor artifact build/smoke.
-   Existing Playwright wrapper remains the owner of app startup/cleanup for E2E.
-   Existing package registry and package attachment UI must expose required Colyseus/PlayCanvas packages.
-   `apps-template-mui` remains the runtime shell and should not depend on legacy frontend feature packages.
-   Owning package locale resources must accept new EN/RU keys; use the shared i18n package only for genuinely cross-package labels.

## Final Acceptance Checklist

### Milestone A Acceptance

-   [ ] The real upstream PlayCanvas Editor boots under normal iframe sandbox/origin/CSP rules with no hosted fallback.
-   [ ] Browser E2E creates a new metahub through UI.
-   [ ] Browser E2E connects Colyseus and PlayCanvas packages through UI.
-   [ ] Browser E2E creates/selects a PlayCanvas project through UI.
-   [ ] Browser E2E authors the MMOOMM scene, first-milestone assets, scripts/sourcefiles, and `metadata.mmoomm.*` through the Editor-visible workflow.
-   [ ] Save/reopen preserves Editor-authored scene, settings required by the fixture, first-milestone assets, sourcefiles, scripts, bindings, and metadata.
-   [ ] Scene hierarchy/inspector proof covers create, delete, duplicate, reparent with cycle prevention, transform edits, camera/light/render/script inspector edits, scene switching, and cleanup/load semantics required by the fixture.
-   [ ] Code Editor proof covers sourcefile list/read/create/update/delete, save/revert, Monaco tabs/files/status, and safe syntax-error handling for the first-milestone script workflow.
-   [ ] First-milestone asset proof covers scripts/sourcefiles/json/images, safe unsupported/oversized states, and snapshot/export policy.
-   [ ] In-scope Milestone A main surfaces have real support; any typed unavailable state is limited to optional commercial/cloud extras or explicitly deferred main surfaces while Milestone B remains open.
-   [ ] Publish/export blocks dirty, conflicted, stale, or missing-artifact projects.
-   [ ] Publication hash changes for selected scene, runtime assets, generated artifacts, script bindings, sourcefile-derived artifacts, and MMOOMM metadata.
-   [ ] Application sync persists valid `_app_playcanvas_manifests` rows and retires stale rows safely.
-   [ ] Published runtime consumes immutable `PlayCanvasRuntimeManifest` data only.
-   [ ] Manifest differential tests prove the runtime changes when selected scene, assets, scripts, or `metadata.mmoomm.*` changes and fails closed when required manifest data is missing.
-   [ ] Runtime canvas is nonblank and correctly framed at `1920x1080`, `768x1024`, and `390x844`.
-   [ ] Runtime input ownership allows keyboard/pointer entry and exit without trapping the user.
-   [ ] Colyseus proof shows server-authoritative intents/state and rejects unsafe client-side state mutation.
-   [ ] WebSocket evidence shows expected connections/frames/closes without leaking tokens, room IDs, session IDs, or protocol internals.
-   [ ] Script lifecycle proof covers generated script `initialize`, `update`, `postUpdate`, `destroy`, no leaked globals, and no duplicate registrations after scene reopen/switch.
-   [ ] Asset/runtime cleanup proof covers async load/unload indicators for first-milestone assets, scene switch cleanup, resize/listener cleanup, room leave, PlayCanvas app destroy, and GPU/canvas disposal.
-   [ ] `tools/fixtures/metahubs-mmoomm-app-snapshot.json` is generated from browser-authored, saved/reopened, published, and synced state.
-   [ ] Generator guardrails fail if the authoring path uses API-first shortcuts, direct DB writes, hidden test routes, or direct fixture writes before browser proof.
-   [ ] The new fixture contract validates PlayCanvas project storage, runtime manifests, generated artifacts, script bindings, selected scene, and provenance.
-   [ ] Runtime replay imports the new fixture and passes the MMOOMM canvas/multiplayer/reconnect/localization/no-overflow oracle.
-   [ ] EN/RU UI states are localized; normal surfaces show no raw IDs, raw JSON, `[object Object]`, filesystem paths, protocol errors, or backend stacks.
-   [ ] GitBook docs and package READMEs document Milestone A implementation and Milestone B remaining scope.
-   [ ] Focused Jest/Vitest/Playwright suites for Milestone A pass.
-   [ ] Thermos/autoreview finds no blocker correctness/security/maintainability findings for Milestone A.

### Milestone B Acceptance

-   [ ] Milestone A and Milestone B are reported separately; the brief is not marked complete after only the Editor-authored MMOOMM fixture milestone.
-   [ ] Full scene hierarchy/inspector proof covers the main upstream workflow beyond the MMOOMM fixture, or every unsupported main operation is explicitly split into a user-approved follow-up before final close.
-   [ ] Full Code Editor proof covers lint/autocomplete diagnostics where supported and collaborative text behavior when collaboration is implemented.
-   [ ] Full main asset proof covers GLB/GLTF/audio/material dependency workflows, thumbnails/previews where required, safe unsupported/oversized states, binary asset conflict policy, and snapshot/export policy.
-   [ ] Durable realtime proof covers ShareDB/OT collections, op validation, op-history or compacted revision persistence, permission/ownership gates, stale-token disconnect, reconnect/conflict behavior, and WebSocket evidence.
-   [ ] Collaboration proof covers presence, selection, chat, camera/selection indicators, multi-context disconnect/reconnect, or is explicitly split into a user-approved follow-up before final close.
-   [ ] VCS proof covers checkpoints/commits, branch create/switch/checkout, merge, conflict resolution, binary asset fail-closed conflicts, dirty-state blocking, and item history preservation, or is explicitly split into a user-approved follow-up before final close.
-   [ ] PlayCanvas project export/download proof covers safe archive/envelope contents, branch/history limitation messaging, no credential/token/signed URL/local path leaks, backend/frontend tests, and E2E download/export evidence.
-   [ ] Project settings/launch proof covers Editor `2.19.5` to runtime `2.18.1` compatibility, WebGL/WebGPU-safe settings, physics/Ammo handling, audio settings, origin-bound launch preview, and fail-closed unsupported settings.
-   [ ] Script lifecycle proof includes hot-reload cleanup where supported.
-   [ ] Asset/runtime cleanup proof includes unload/dispose for GLB/GLTF/audio/material assets where applicable.
-   [ ] Optional commercial/cloud extras remain explicitly documented as non-goals or future scope.
-   [ ] GitBook docs and package READMEs document implemented full main functionality, typed unavailable surfaces, and optional commercial/cloud exclusions.
-   [ ] Focused Jest/Vitest/Playwright suites for Milestone B pass.
-   [ ] Thermos/autoreview finds no blocker correctness/security/maintainability findings for Milestone B.

## Open Questions for Approval

-   Should collaboration and version control be implemented before the first `metahubs-mmoomm-app-snapshot.json` milestone, or may they remain typed unavailable while the full brief stays open?
-   Should GLB/GLTF and audio be part of the first production asset set, or should the first milestone support scripts/sourcefiles/json/images and document model/audio as the next main-asset phase?
-   Should the new fixture coexist with `metahubs-mmoomm-flight-app-snapshot.json` until runtime replay is stable, or replace it immediately after acceptance?
-   Should the Editor artifact be enrolled into root/Turbo build in this work, or should E2E consume a verified package-local artifact first?
-   Should runtime projection extend the current `playcanvasCanvas` widget, or introduce a new widget only if Phase 0 proves the current widget cannot represent Editor-derived manifests cleanly?
