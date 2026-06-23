# Plan: MMOOMM PlayCanvas Visual Linkup Lab

> Created: 2026-06-20
> Status: Implemented (2026-06-21)
> Mode: PLAN
> QA update: 2026-06-20 - tightened UI/WebGL evidence, project targeting, Editor/runtime boundaries, and docs screenshot provenance after QA review.
> Brief: local cross-project MMOOMM PlayCanvas Visual Linkup Lab brief, dated 2026-06-20
> Research: `memory-bank/research/mmoomm-playcanvas-visual-linkup-lab-research-2026-06-20.md`
> Target fixture: `tools/fixtures/metahubs-mmoomm-app-snapshot.json`

## Overview

Create a second PlayCanvas project inside the canonical Universo MMOOMM metahub fixture and use it as a visual comparison lab for the MVP "weak robot-avatar linkup" style: white translucent primitive bodies, dense fog, soft type-color glow, and optional low-poly / retrowave geometry.

The implementation creates an Editor-reviewable and runtime-visible lab project
with 16 visual variants, generated through the existing Playwright product flow
and exported through the normal snapshot pipeline. The existing playable
`MMOOMM Authoring` flight scene and published runtime proof remain intact.
Runtime-visible support was added as a generic metadata-driven extension of the
existing `playcanvasCanvas` widget, not as a parallel app shell.

## Baseline Decisions For Discussion

-   Implement the first slice as a second bound project named `MMOOMM Visual Linkup Lab`.
-   Use 16 variants by default: four visual families with four variants each. This satisfies the brief's "about 10-20" target while keeping the scene readable.
-   Keep asteroids visual-only inside the lab for this slice. Do not add MMOOMM rock/ice asteroid Object domain types unless the user explicitly expands gameplay scope.
-   Keep the lab Editor-reviewable and publish it deterministically as the second
    project role once multi-project manifest validation is in place.
-   Bind runtime-visible lab metadata only through the existing canvas widget and
    role-aware runtime manifests.
-   Do not add CameraFrame, shader chunks, screen-space outlines, dithering/noise, textures, glTF, Draco, or asset pipelines in the first pass.
-   Keep the generator on the existing `PlayCanvas` metahub template. Do not bump metahub schema/template versions. The existing `project` preset and `_mhb_playcanvas_*` project store already cover this work.

## Affected Areas

-   `tools/testing/e2e/specs/generators/metahubs-mmoomm-app-export.spec.ts`
    -   Add second project creation and lab authoring sequence.
    -   Refactor project row targeting and runtime manifest selection away from first-row / first-item assumptions.
-   `tools/testing/e2e/support/mmoommPlaycanvasEditorAuthoring.ts` or a new sibling helper
    -   Add `authorMmoommVisualLinkupLabThroughPlayCanvasEditorAndExpectReload`.
    -   Keep existing flight authoring helper unchanged except for shared utilities.
-   `tools/testing/e2e/support/mmoommAppFixtureContract.ts`
    -   Validate exactly the intended project roles: `MMOOMM Authoring` and `MMOOMM Visual Linkup Lab`.
    -   Add lab-scene assertions that allow boxes, spheres, shell children, and visual-lab metadata without weakening the flight contract.
-   `tools/testing/e2e/support/checkMmoommAppFixtureContract.ts` and drift checks
    -   Run against the regenerated snapshot and update diagnostics where needed.
-   `tools/testing/e2e/support/mmoommRuntimeProof.ts`
    -   Preserve the existing flight runtime proof.
    -   Add separate lab Editor/browser proof helpers only if useful; do not fold lab assertions into flight runtime movement checks.
-   `packages/universo-react-playcanvas-engine/src/runtime.ts`
    -   Add generic helpers for primitive geometry, low-poly meshes, translucent materials, glow shells, and fog.
-   `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx`
    -   Extend the existing runtime projection with a generic visual-lab metadata mode.
-   `packages/universo-react-playcanvas-engine/README.md`
    -   Update only if new generic runtime helpers are added.
-   `docs/en/guides/mmoomm-flight-simulator.md` and `docs/ru/guides/mmoomm-flight-simulator.md`
    -   Document the canonical app fixture and the visual lab after browser proof exists.
-   `docs/en/platform/playcanvas-projects.md`, `docs/ru/platform/playcanvas-projects.md`, and `docs/*/SUMMARY.md`
    -   Update if project role semantics or fixture documentation expands beyond the flight guide.

## Architecture Placement

-   Metahub template: the current generator selects the built-in `PlayCanvas` template so the metahub boots with the `Projects` entity type. The plan adds another `Projects` instance; it does not introduce a new template, template version, or schema version.
-   Platform preset mapping: both `MMOOMM Authoring` and `MMOOMM Visual Linkup Lab` are `project` entity instances with `projectBinding` capability. They are not new MMOOMM entity kinds.
-   Ownership layer: the lab is metahub configuration/design-time project data. Runtime application behavior stays in published application widgets/modules only if the optional runtime-visible phase is selected.
-   Package boundary: Editor authoring stays in `@universo-react/playcanvas-editor-frontend` through the hosted iframe/bridge. Runtime helpers, if added, must be generic in `@universo-react/playcanvas-engine`; MMOOMM variant names and lore data stay in generator support or metahub project data.
-   Runtime boundary: `packages/universo-react-apps-template-mui` owns canvas mounting if the lab becomes runtime-visible. It must reuse the existing dashboard/widget shell and create exactly one PlayCanvas application per mounted canvas.
-   Editor boot lifecycle: project selection affects the fullscreen Editor host config injection and iframe boot context. Prefer opening the Editor with a target `?projectId=<id>` or equivalent target-specific host context; use package default switching only as a documented fallback, and assert that the loaded compatibility config/default scene belongs to the intended project.
-   Data safety: generated fixture data must come from the Playwright product flow. Do not hand-edit `tools/fixtures/metahubs-mmoomm-app-snapshot.json` as source of truth.
-   Identifier safety: new platform-side records or save/request identifiers must keep the existing UUID v7 contracts. Native PlayCanvas scene entity ids remain scoped to the Editor payload and must not be treated as platform database ids.

## UI Contract

### Per-Surface Contract

| Surface                                    | Existing primitive to reuse                                                           | Must prove                                                                                                                                          | Forbidden leakage                                                           |
| ------------------------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Projects` entity list/table               | Existing metahub entity list/table and row action menu                                | Two readable project names, target row selection by display name/codename, no row-order assumptions, keyboard path to row actions                   | Raw project ids, scene ids, checksums, JSON, `[object Object]`              |
| `Edit Project` dialog, `PlayCanvas` tab    | Existing `EntityFormDialog` / resource tab surface                                    | Dialog belongs to the target project before `Create & bind project`, `Open editor`, or `Publish runtime`; tab actions stay localized and accessible | Editable `Project id`, mutable authoring paths, compatibility tokens        |
| `Create & bind PlayCanvas project` dialog  | Existing project-binding dialog                                                       | User-facing project name is used; project codename/project id are system-owned; failure messages are localized                                      | Internal validation strings, stack traces, raw backend payloads             |
| PlayCanvas Editor fullscreen host / iframe | Existing fullscreen host and vendored Editor iframe                                   | Host opens the intended project, iframe boots, canvas is visible/bounded/nonblank, scene persists after reload, focus can leave the host            | Token/session ids, storage roots, raw bridge/protocol messages              |
| Existing published flight runtime widget   | Existing `playcanvasCanvas` widget in `apps-template-mui`                             | Still bound to `MMOOMM Authoring`, movement/camera/realtime proof stays green, no page overflow                                                     | Lab manifest ids, raw room/session/player ids, protocol errors              |
| Optional runtime-visible lab widget        | Existing `playcanvasCanvas` widget zone or justified generic mode in the same package | One PlayCanvas app per mounted canvas, localized states, semantic lab oracle, cleanup on unmount, desktop/tablet/mobile viewport matrix             | New parallel app shell, raw IDs/JSON, engine stack details, authoring paths |

### Required For The Default Editor-Reviewable Lab

-   User goal: a manager/developer opens the second PlayCanvas project and visually compares 16 weak-linkup style variants in one scene.
-   Visible surfaces: existing Projects list, Project edit dialog `PlayCanvas` tab, existing PlayCanvas Editor fullscreen host.
-   Controls: reuse existing `Create Project`, `Create & bind project`, `Open editor`, `Publish runtime` where relevant. Do not add one-off runtime UI.
-   Display values: show project display names, not raw project ids, scene ids, checksums, storage paths, or JSON.
-   Hidden/system fields: `projectId`, `sceneId`, checksums, authoring file roots, compatibility tokens, and storage paths remain hidden from normal UI.
-   Localization: any new user-facing generator UI labels, project names, validation/error text, and runtime labels must be EN/RU localized where the surface supports localized values. The default Editor-only lab should mainly use existing labels, but tests must still catch raw English/internal validation on localized surfaces.
-   Long-text fields: no new long-text UI fields are expected in this slice. If descriptions, notes, debug notes, or scene notes are surfaced later, they must use multiline controls by default.
-   Responsive proof: project list/dialog/host surfaces must pass no document-level horizontal overflow at `1920x1080`, `768x1024`, and `390x844`. Editor-internal mobile limitations can be documented only after the host shell itself remains bounded and the limitation is proven by Playwright evidence.
-   Keyboard/focus proof: cover keyboard navigation through Projects table/list row actions, `Edit Project` dialog tabs/actions, `Open editor`, the fullscreen host, iframe/canvas focus entry, and focus escape back to the host/page.
-   Browser evidence helpers: use existing or equivalent helpers by name: `expectNoTechnicalLeakage(..., { checkUuidSubstrings: true })`, `expectLocalizedValidation`, `expectNoPageHorizontalOverflow`, and `expectRuntimeUxViewportMatrix`.
-   Lab WebGL/scene oracle: nonblank canvas is necessary but not sufficient. The default lab proof must also assert that the Editor-authored scene contains 16 named variants, expected object families, type-color glow semantics, fog/material evidence where serialized, and a framed/navigable comparison layout.
-   Browser evidence: prove the Editor iframe loads, the lab scene contains visible comparison objects, the serialized scene persists after reload, and the exported snapshot carries the lab project.

### Required If Runtime-Visible Lab Is Selected

-   Surface owner: existing `playcanvasCanvas` widget zone inside `apps-template-mui`, or a justified generic widget mode in the same package. No parallel app shell.
-   Product gate: if the acceptance target is a normal end-user published runtime view of the lab, Phase 7 is mandatory rather than optional; the default Editor-reviewable lab is only manager/developer evidence.
-   Canvas lifecycle: one `pc.Application` per mounted canvas; app, entities, observers, event handlers, and optional CameraFrame must be destroyed on unmount.
-   Visible controls: localized, accessible controls for camera/view only if controls are exposed; no flight movement buttons unless the lab is explicitly playable.
-   States: localized loading, empty, invalid config, manifest unavailable, render failure, unauthorized if runtime auth applies.
-   Input/focus: keyboard focus can enter and leave the canvas; Escape/pointer capture behavior must not trap users or block dialogs/text fields.
-   Responsive proof: `1920x1080`, `768x1024`, and `390x844`; canvas bounded by widget; no document-level horizontal overflow.
-   Technical leakage rule: no raw UUIDs, checksums, project ids, scene ids, room ids, JSON, protocol messages, stack traces, or mutable authoring paths on normal surfaces.

## Plan Steps

### Phase 0 - Preflight And Impact

-   [ ] Confirm Node 22 is active before any E2E or Editor artifact work:

    ```bash
    export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --silent 22; node -v
    ```

-   [ ] Re-run focused code intelligence before implementation edits:
    -   `createProjectInstanceAndBindThroughBrowser`
    -   `openProjectEditDialogPlayCanvasTab`
    -   `publishPlayCanvasProjectThroughBrowser`
    -   `configurePlayCanvasCanvasWidgetThroughBrowser`
    -   `authorMmoommSceneThroughPlayCanvasEditorAndExpectReload`
    -   `assertPlayCanvasProjectSnapshot`
    -   `assertDomainModel`
    -   optional runtime-visible symbols: `PlayCanvasCanvasWidget`, `createStandardMaterial`, `createBoxEntity`.
-   [ ] If OntoIndex reports HIGH or CRITICAL blast radius on runtime symbols, stop and report before implementation.
-   [ ] Reconfirm the installed PlayCanvas runtime API from local `playcanvas@2.18.1` d.ts before using material/fog/geometry APIs. Current Context7 access returned an expired OAuth token, so official PlayCanvas docs and local d.ts are the fallback authority.
-   [ ] Confirm the generator still selects the `PlayCanvas` metahub template and that the `Projects` section is present before project-instance creation.

### Phase 1 - Make MMOOMM Generator Multi-Project Safe

-   [ ] Replace `openProjectEditDialogPlayCanvasTab(page)` with a target-aware helper, for example `openProjectEditDialogPlayCanvasTabForProject(page, { projectName })`.
-   [ ] In the Projects table, target the row by localized project display name or stable codename before opening the action menu.
-   [ ] Assert the opened edit dialog belongs to the intended project before clicking `Create & bind project`, `Publish runtime`, or `Open editor`.
-   [ ] Extract a shared resolver for project instances by localized display name / codename to avoid repeated ad hoc JSON parsing.
-   [ ] Replace runtime manifest selection by list order with project-aware selection.
-   [ ] Keep the flight `playcanvasCanvas` widget explicitly bound to the `MMOOMM Authoring` published manifest.

Safe selector pattern:

```ts
const findProjectInstanceByName = (items: Array<{ id?: string; name?: unknown; codename?: unknown }>, projectName: string) => {
    return items.find((item) => {
        const localized = readLocalizedContent(item.name, 'en')
        return localized === projectName || readCodenameText(item.codename) === projectName.replace(/\s+/g, '')
    })
}

const findPublishedManifestForProject = (items: Array<{ projectId?: string; sceneId?: string; checksum?: string }>, projectId: string) => {
    const manifest = items.find((item) => item.projectId === projectId && /^[a-f0-9]{64}$/i.test(String(item.checksum ?? '')))
    if (!manifest) {
        throw new Error(`Expected published PlayCanvas runtime manifest for project ${projectId}`)
    }
    return manifest
}
```

Implementation note: `readLocalizedContent` / `readCodenameText` should reuse existing local helpers or be implemented as narrow test-support utilities, not production exports unless another package already needs them.

### Phase 2 - Create The Second Bound Project

-   [ ] In `metahubs-mmoomm-app-export.spec.ts`, create and bind two project instances:
    -   `MMOOMM Authoring`
    -   `MMOOMM Visual Linkup Lab`
-   [ ] Resolve and store both PlayCanvas project ids immediately after creation.
-   [ ] Prefer opening the Editor with `?projectId=<targetProjectId>` or an equivalent target-specific host context before each authoring pass. Use `setEditorDefaultProjectThroughBrowser` only as a fallback where the current host still requires it.
-   [ ] After Editor boot, assert the loaded compatibility config/default scene references the target project id; do not trust the package default or previous iframe state.
-   [ ] Keep the existing `MMOOMM Authoring` authoring sequence unchanged:
    -   save default scene;
    -   author `MMOOMM Ship` / `MMOOMM Station`;
    -   save and reload;
    -   publish runtime;
    -   configure existing runtime widget to this manifest.
-   [ ] Add a second Editor authoring pass for `MMOOMM Visual Linkup Lab` after the flight scene is stable.
-   [ ] Close and reopen/reload the Editor per project where needed to prevent bridge state from leaking across projects.

### Phase 3 - Author The Visual Linkup Lab Scene

-   [ ] Add a new helper such as `authorMmoommVisualLinkupLabThroughPlayCanvasEditorAndExpectReload`.
-   [ ] First inspect the current serialized scene payload after creating a minimal box/sphere/material sample. Use that payload as the contract source for material, render type, children, and fog assertions.
-   [ ] Build a 4x4 grid of 16 named variants. Keep each cell compact and readable from one camera:
    -   four object types per variant: ship, station, rock asteroid, ice asteroid;
    -   white translucent core bodies where serialized Editor data supports it;
    -   type-color glow shell child entities where serialized data supports additive/emissive material evidence;
    -   sphere primitives for asteroids where Editor render components support `type: 'sphere'`; otherwise use low-poly sphere metadata as a runtime candidate and use boxes for Editor-safe proof;
    -   one camera and one or more lights named clearly for the lab.
-   [ ] Use a deterministic naming contract:
    -   root: `MMOOMM Visual Linkup Lab`
    -   camera: `MMOOMM Linkup Lab Camera`
    -   light: `MMOOMM Linkup Lab Key Light`
    -   variants: `Linkup Lab 01 White Link Halo`, etc.
    -   objects: `Linkup Lab 01 Ship Core`, `Linkup Lab 01 Ship Glow`, etc.
-   [ ] Persist lab metadata under a dedicated non-flight key if needed, for example `metadata.mmoomm.visualLab`, without changing the existing `metadata.mmoomm.scene` flight contract.
-   [ ] Do not rely on Editor-internal PCUI/Observer code outside the iframe-local evaluated authoring helper.
-   [ ] Add lab proof data that does not depend only on screenshots: serialized scene names, render primitive types, transforms, material opacity/emissive evidence where persisted, fog/settings evidence where persisted, and stable camera/light names.

Variant configuration shape:

```ts
type LinkupObjectType = 'ship' | 'station' | 'rockAsteroid' | 'iceAsteroid'

type LinkupVariantConfig = {
    slug: string
    family: 'softWhiteLinkup' | 'typeGlow' | 'lowPolyRetrowave' | 'channelDegradation'
    fogDensity: number
    coreOpacity: number
    glowOpacity: number
    shellScale: number
    lowPolyBands?: number
}

const LINKUP_OBJECT_GLOW: Record<LinkupObjectType, [number, number, number]> = {
    ship: [0.15, 0.85, 1],
    station: [0.9, 0.25, 1],
    rockAsteroid: [1, 0.58, 0.18],
    iceAsteroid: [0.45, 0.8, 1]
}

const LINKUP_VARIANTS = [
    { slug: 'white-link-halo', family: 'softWhiteLinkup', fogDensity: 0.018, coreOpacity: 0.68, glowOpacity: 0.12, shellScale: 1.06 },
    { slug: 'mist-core', family: 'softWhiteLinkup', fogDensity: 0.026, coreOpacity: 0.54, glowOpacity: 0.1, shellScale: 1.08 },
    { slug: 'classification-strong', family: 'typeGlow', fogDensity: 0.022, coreOpacity: 0.62, glowOpacity: 0.2, shellScale: 1.1 },
    {
        slug: 'lowpoly-radar',
        family: 'lowPolyRetrowave',
        fogDensity: 0.02,
        coreOpacity: 0.65,
        glowOpacity: 0.16,
        shellScale: 1.07,
        lowPolyBands: 8
    }
] satisfies readonly LinkupVariantConfig[]
```

The final implementation should define all 16 entries; the snippet shows the intended type and parameter style.

### Phase 4 - Snapshot And Fixture Contract Updates

-   [ ] Update `assertDomainModel` to require exactly two active project instances with project bindings for the two intended roles.
-   [ ] Update `assertPlayCanvasProjectSnapshot` to split project validation by role:
    -   `MMOOMM Authoring`: existing flight assertions stay strict: ship, station, key light, enabled box render components, `metadata.mmoomm.scene`, runtime manifest metadata, and runtime widget binding.
    -   `MMOOMM Visual Linkup Lab`: new lab assertions: 16 variants, expected object type coverage, allowed primitive render types, transform tuples, no empty default `New Entity`, stable names, camera/light evidence, optional `metadata.mmoomm.visualLab`.
-   [ ] Do not weaken `assertRenderableMmoommEntity` for the flight scene. Add a separate `assertVisualLabRenderableEntity` or equivalent.
-   [ ] If the lab is not published, keep runtime manifest requirements scoped to the flight project only.
-   [ ] If the lab is published, add a lab manifest contract that selects by `projectId` and either:
    -   validates `metadata.mmoomm.visualLab`, or
    -   explicitly allows a lab manifest without `metadata.mmoomm.scene` while snapshot scene payload carries the visual proof.
-   [ ] Update drift diagnostics to redact volatile ids and preserve readable failure messages for project-role mismatches.

Contract split sketch:

```ts
const EXPECTED_PROJECT_NAMES = ['MMOOMM Authoring', 'MMOOMM Visual Linkup Lab'] as const

type PlayCanvasProjectRole = (typeof EXPECTED_PROJECT_NAMES)[number]

const groupProjectsByRole = (projects: PlayCanvasProjectSnapshot): Record<PlayCanvasProjectRole, ProjectEvidence> => {
    const result = Object.create(null) as Record<PlayCanvasProjectRole, ProjectEvidence>
    for (const role of EXPECTED_PROJECT_NAMES) {
        const evidence = findProjectEvidence(projects, role)
        if (!evidence) {
            throw new Error(`MMOOMM app fixture is missing PlayCanvas project role: ${role}`)
        }
        result[role] = evidence
    }
    return result
}
```

### Phase 5 - Keep Existing Flight Runtime Proof Green

-   [ ] Publish only `MMOOMM Authoring` in the default path.
-   [ ] Fetch published manifests and select the `MMOOMM Authoring` manifest by `projectId`.
-   [ ] Configure the existing `PlayCanvas canvas` widget with the selected flight manifest only.
-   [ ] Keep `expectMmoommRuntimeReady` as the flight runtime oracle:
    -   painted nonblank canvas;
    -   playable height;
    -   camera framing;
    -   movement intent and stop behavior;
    -   keyboard focus path;
    -   viewport matrix;
    -   no technical leakage.
-   [ ] Add a regression assertion that the widget binding does not point to the lab project.

### Phase 6 - Optional Published Lab Without Runtime Widget

This phase is optional and should be enabled only if the user wants the lab to have its own published manifest in the fixture.

-   [ ] Publish `MMOOMM Visual Linkup Lab` after project-aware publish helpers are in place.
-   [ ] Add explicit lab manifest selection by lab `projectId`.
-   [ ] Ensure published flight widget still selects `MMOOMM Authoring` by project identity, not by newest manifest.
-   [ ] Extend fixture contract so lab manifest metadata rules do not break the flight manifest contract.
-   [ ] Do not claim runtime-visible visual proof unless Phase 7 is also implemented.

### Phase 7 - Optional Runtime-Visible Lab Projection

This phase is larger and should be approved separately if the first implementation must show the lab inside the published application runtime.

-   [ ] Define a stable runtime metadata shape, likely `metadata.mmoomm.visualLab`, that contains only portable runtime data:
    -   variant slug/family;
    -   object primitive type;
    -   position/rotation/scale;
    -   core opacity;
    -   glow color;
    -   glow shell scale;
    -   low-poly bands;
    -   scene fog settings.
-   [ ] Add generic helpers to `@universo-react/playcanvas-engine` only if reusable:

    ```ts
    import * as pc from '@universo-react/playcanvas-engine'

    export const createTranslucentStandardMaterial = (options: {
        color: pc.Color
        opacity: number
        emissive?: pc.Color
        emissiveIntensity?: number
    }): pc.StandardMaterial => {
        const material = new pc.StandardMaterial()
        material.diffuse = options.color
        material.opacity = Math.max(0, Math.min(1, options.opacity))
        material.blendType = pc.BLEND_NORMAL
        material.depthWrite = false
        material.useFog = true
        if (options.emissive) {
            material.emissive = options.emissive
            material.emissiveIntensity = options.emissiveIntensity ?? 1
        }
        material.update()
        return material
    }
    ```

-   [ ] Add `createPrimitiveEntity` / `createSphereEntity` / `applySceneFog` helpers with cleanup expectations documented.
-   [ ] Extend or split `PlayCanvasCanvasWidget.tsx` so visual lab rendering remains generic and does not add MMOOMM-only hardcoded branches to shared widgets.
-   [ ] Keep game loops and per-frame transforms outside React state.
-   [ ] Add localized runtime labels/states in `packages/universo-react-apps-template-mui/src/i18n/locales/{en,ru}/apps.json`.
-   [ ] If new runtime metadata queries are added, reuse the existing apps-template data-fetching pattern and TanStack Query direction rather than adding ad hoc fetch state.
-   [ ] Add runtime browser proof with nonblank canvas, visible comparison layout, no overflow, focus path, and desktop/tablet/mobile screenshots.

### Phase 8 - Tests

-   [ ] Jest / backend tests, if backend services or snapshot restore behavior are touched:
    -   PlayCanvas project snapshot export/import remains portable with two bound projects.
    -   `projectBinding.projectId` remap still follows `projectCodename`.
    -   published manifests are selected/filtered by project identity.
    -   no raw mutable `playcanvas-projects/...` authoring path appears in runtime manifests.
-   [ ] Vitest / engine tests:
    -   existing `@universo-react/playcanvas-engine` tests stay green.
    -   optional runtime helpers clamp opacity, set blend/depth/fog flags, and create primitive entities with expected transforms.
-   [ ] Vitest / apps-template tests, if runtime-visible lab is selected:
    -   manifest normalization reads `metadata.mmoomm.visualLab` without breaking `metadata.mmoomm.scene`.
    -   localized EN/RU lab runtime states exist and do not expose protocol details.
    -   invalid lab manifest fails closed with user-facing messages.
    -   cleanup destroys app/entities/CameraFrame if used.
-   [ ] Fixture contract tests:
    -   `pnpm run check:mmoomm-app-fixture-contract`
    -   `pnpm run check:mmoomm-app-fixture-drift -- <generated-file>`
    -   sample negative cases for missing lab, duplicate project roles, wrong widget binding, and unsupported render primitive.
-   [ ] Playwright generator and runtime tests on local minimal Supabase:

    ```bash
    pnpm supabase:e2e:start:minimal
    pnpm run test:e2e:mmoomm-app-fixture-generator:local-supabase
    pnpm run test:e2e:mmoomm-app-gate:local-supabase
    ```

-   [ ] UI/UX assertions:

    -   Projects list/table, project edit dialog, Editor host, and existing flight runtime widget call `expectNoTechnicalLeakage(..., { checkUuidSubstrings: true })`.
    -   Localized project/dialog validation paths call `expectLocalizedValidation` for EN/RU where the flow exposes validation.
    -   Project/dialog/host/runtime surfaces call `expectNoPageHorizontalOverflow` and `expectRuntimeUxViewportMatrix` at `1920x1080`, `768x1024`, and `390x844`.
    -   Keyboard tests cover row actions, dialog tabs/buttons, Editor host entry/exit, and canvas focus escape.

-   [ ] For fixture regeneration into the tracked file, run the existing generator with the tracked output path only after the generated artifact passes drift/contract checks:

    ```bash
    MMOOMM_APP_FIXTURE_OUTPUT_PATH=tools/fixtures/metahubs-mmoomm-app-snapshot.json \
      pnpm run test:e2e:mmoomm-app-fixture-generator:local-supabase
    pnpm run check:mmoomm-app-fixture-contract
    pnpm run check:mmoomm-app-fixture-drift -- tools/fixtures/metahubs-mmoomm-app-snapshot.json
    pnpm run test:e2e:mmoomm-app-runtime:local-supabase
    ```

-   [ ] Browser screenshots:
    -   Editor lab desktop screenshot with all 16 variants visible or clearly navigable.
    -   Editor lab tablet/mobile proof for the host/project surfaces; document Editor-internal limitations only with Playwright evidence.
    -   Existing flight runtime screenshot/proof unchanged.
    -   Runtime-visible lab screenshots only if Phase 7 is selected.
-   [ ] Browser WebGL oracles:
    -   canvas visible and nonzero;
    -   canvas pixels are not blank after ready state;
    -   primary layout is framed;
    -   lab semantic evidence proves 16 variants and all expected object families, not just painted pixels;
    -   sampled/screenshot color evidence supports type-color glow families where feasible, while serialized scene assertions carry the exact material/fog contract;
    -   no document-level horizontal overflow;
    -   keyboard focus can leave the canvas;
    -   screenshots support assertions but do not replace them.
-   [ ] Boundary guards:
    -   `pnpm run check:playcanvas-editor-isolation` if any Editor host/bridge/package boundary code changes.
    -   `pnpm run check:apps-template-isolation` if Phase 7 touches `packages/universo-react-apps-template-mui`.

### Phase 9 - Documentation

-   [ ] Update `docs/en/guides/mmoomm-flight-simulator.md` and `docs/ru/guides/mmoomm-flight-simulator.md` after implementation evidence exists:
    -   describe the canonical app fixture now containing two PlayCanvas projects;
    -   document that `MMOOMM Authoring` remains the playable flight runtime source;
    -   document that `MMOOMM Visual Linkup Lab` is a visual comparison project.
-   [ ] Add GitBook screenshots only after Playwright proof exists. Use Playwright-generated artifacts, not manual captures, and keep EN/RU asset parity under paths such as `docs/{en,ru}/.gitbook/assets/mmoomm-flight/visual-linkup-lab-editor.png` if screenshots are added.
-   [ ] Document screenshot provenance in the relevant generator/check docs or commit notes: source spec, viewport, locale, and why the screenshot is stable enough for GitBook.
-   [ ] Update `docs/en/platform/playcanvas-projects.md` and `docs/ru/platform/playcanvas-projects.md` only if the work changes or clarifies project-role, publication, or multi-project snapshot semantics.
-   [ ] Update `docs/en/platform/projects-entity-type.md` and `docs/ru/platform/projects-entity-type.md` only if the project-binding semantics change.
-   [ ] Update `docs/en/platform/playcanvas-editor.md` and `docs/ru/platform/playcanvas-editor.md` only if the Editor opening/default-project workflow changes.
-   [ ] Update `packages/universo-react-playcanvas-engine/README.md` only if new generic runtime helpers ship.
-   [ ] Run documentation gates:

    ```bash
    pnpm docs:i18n:check
    pnpm docs:gitbook-screenshot-assets:check
    ```

## Validation Commands

Use the smallest relevant set during implementation, then run the full gate before closing the task.

```bash
pnpm --filter @universo-react/playcanvas-engine test
pnpm --filter @universo-react/apps-template-mui test
pnpm run check:playcanvas-editor-isolation
pnpm run check:apps-template-isolation
pnpm run check:mmoomm-app-fixture-contract
pnpm run check:mmoomm-app-fixture-drift -- tools/testing/e2e/.artifacts/generated-metahubs-mmoomm-app-snapshot.json
pnpm run test:e2e:mmoomm-app-gate:local-supabase
pnpm docs:i18n:check
pnpm docs:gitbook-screenshot-assets:check
```

Focused build/lint commands after code changes:

```bash
pnpm --filter @universo-react/playcanvas-engine build
pnpm --filter @universo-react/apps-template-mui build
pnpm --filter @universo-react/playcanvas-editor-frontend editor:build
pnpm --filter @universo-react/playcanvas-editor-frontend test
pnpm --filter @universo-react/apps-template-mui lint
```

Do not run `pnpm dev`. Playwright E2E must use the repository wrapper and target `http://127.0.0.1:3100`.

## Potential Challenges

-   Project targeting is currently unsafe for two projects. Mitigation: make row/dialog/manifest helpers project-aware before adding the lab.
-   Current runtime widget cannot prove the requested lab visuals. Mitigation: default to Editor-reviewable lab; runtime-visible proof is a separate gated phase with metadata and rendering work.
-   Default Editor-reviewable lab is manager/developer evidence, not a normal end-user published runtime experience. Mitigation: make Phase 7 mandatory if the acceptance requirement becomes "user sees the lab in the published MMOOMM runtime".
-   Editor serialization may not persist all desired material/fog fields. Mitigation: inspect serialized payload first and only assert fields that are actually persisted; keep richer material helpers as runtime candidates.
-   Publishing the lab can break the flight widget if selectors use newest/last manifest. Mitigation: select manifests by `projectId` and add regression assertions.
-   Visual screenshots can become flaky with WebGL antialiasing or animations. Mitigation: use semantic canvas pixel/oracle checks as acceptance, with screenshots as supporting evidence.
-   Upstream PlayCanvas public docs currently track newer Engine versions than the runtime wrapper. Mitigation: treat local `playcanvas@2.18.1` d.ts as the runtime API authority.
-   Context7 is not currently usable in this environment due to an expired OAuth token. Mitigation: record this explicitly and rely on official PlayCanvas docs/API plus local installed types until Context7 is reauthenticated.
-   The lab scene can become too dense. Mitigation: use a 4x4 grid, stable camera, bounded per-cell spacing, and 16 variants rather than 20 unless requested.

## QA Checklist Before Implementation Is Marked Done

-   [ ] Exactly two intended project roles exist in the exported fixture.
-   [ ] `MMOOMM Authoring` still publishes and powers the existing flight runtime widget.
-   [ ] `MMOOMM Visual Linkup Lab` is authored through the real Editor flow, not by patching the snapshot.
-   [ ] The lab contains 16 variants and covers ship, station, rock asteroid, and ice asteroid type-color semantics.
-   [ ] The fixture contract distinguishes flight scene assertions from lab scene assertions.
-   [ ] No raw ids, checksums, storage paths, JSON, or protocol messages leak on normal UI surfaces.
-   [ ] Per-surface UI Contract is implemented/proven for Projects list, project edit dialog, Editor fullscreen host, existing flight runtime widget, and optional runtime lab widget if selected.
-   [ ] Browser evidence includes Editor lab visibility, semantic 16-variant lab proof, keyboard/focus proof, viewport matrix/no-overflow proof, and existing flight runtime proof.
-   [ ] Runtime-visible lab evidence is present only if the runtime-visible phase is implemented.
-   [ ] EN/RU docs are mirrored and GitBook checks pass.
-   [ ] OntoIndex diff verification or CLI detect-changes is run before commit/closeout after code edits.
-   [ ] Thermos/autoreview is run for non-trivial implementation changes.

## Sources

-   Local cross-project MMOOMM PlayCanvas Visual Linkup Lab brief, dated 2026-06-20
-   `memory-bank/research/mmoomm-playcanvas-visual-linkup-lab-research-2026-06-20.md`
-   `.backup/Исследование-визуального-прототипа-Universo-MMOOMM-на-PlayCanvas.md`
-   `.backup/Анализ-визуальных-эффектов-PlayCanvas.md`
-   `tools/testing/e2e/specs/generators/metahubs-mmoomm-app-export.spec.ts`
-   `tools/testing/e2e/support/mmoommAppFixtureContract.ts`
-   `tools/testing/e2e/support/mmoommPlaycanvasEditorAuthoring.ts`
-   `tools/testing/e2e/support/mmoommRuntimeProof.ts`
-   `packages/universo-react-playcanvas-engine/src/runtime.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx`
-   `docs/en/guides/browser-e2e-testing.md`
-   `docs/en/guides/mmoomm-flight-simulator.md`
-   `docs/en/platform/projects-entity-type.md`
-   `docs/en/platform/playcanvas-projects.md`
-   `docs/en/platform/playcanvas-editor.md`
-   `.agents/skills/runtime-ux-qa/references/playwright-ux-oracles.md`
-   `.agents/skills/browser-game-runtime-qa/references/canvas-webgl-oracles.md`
-   `.agents/skills/mui-runtime-ux-patterns/references/apps-template-isolation.md`
-   `.agents/skills/playwright-best-practices/references/universo-e2e.md`
-   PlayCanvas Engine docs: https://developer.playcanvas.com/user-manual/engine/
-   PlayCanvas Post Effects docs: https://developer.playcanvas.com/user-manual/graphics/posteffects/
-   PlayCanvas CameraFrame docs: https://developer.playcanvas.com/user-manual/graphics/posteffects/cameraframe/
-   PlayCanvas Physical Materials docs: https://developer.playcanvas.com/user-manual/graphics/physical-rendering/physical-materials/
-   PlayCanvas API: https://api.playcanvas.com/engine/
-   PlayCanvas Engine examples: https://github.com/playcanvas/engine/tree/main/examples
