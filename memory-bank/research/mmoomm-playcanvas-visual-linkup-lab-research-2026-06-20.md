# Research: MMOOMM PlayCanvas Visual Linkup Lab

> Created: 2026-06-20
> Status: QA-reviewed
> Trigger: RESEARCH - additional codebase and current PlayCanvas analysis for the local cross-project MMOOMM PlayCanvas Visual Linkup Lab brief, dated 2026-06-20
> Follow-up plan: TBD
> QA update: 2026-06-20 - artifact checked against the active brief, repository PlayCanvas/Editor/runtime docs, local `playcanvas@2.18.1` API, Runtime UI UX gates, and Playwright/WebGL evidence rules.

## Research Question

What is currently true about PlayCanvas Engine/Editor capabilities and the Universo MMOOMM fixture pipeline, and what does that imply for implementing a second PlayCanvas project that compares 10-20 "weak robot-avatar linkup" visual presets?

The repository decision this research supports is whether the next PLAN should implement the visual lab as Editor-authored project data only, as a published runtime-visible scene, or as a broader runtime projection extension that carries shapes, materials, fog, and glow into `apps-template-mui`.

## Source Inventory

| Source                                                                                                                                                                               | Type                             | Date / Freshness                                                                                | Why It Matters                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local cross-project MMOOMM PlayCanvas Visual Linkup Lab brief                                                                                                                        | Primary local brief              | 2026-06-20                                                                                      | Defines the accepted brief, goals, non-goals, reference files, and open questions.                                                                                               |
| Local MMOOMM PlayCanvas Visual Linkup Lab input                                                                                                                                      | Primary local input              | 2026-06-20                                                                                      | Contains the original user TZ and MVP visual-lore requirements.                                                                                                                  |
| `.backup/Исследование-визуального-прототипа-Universo-MMOOMM-на-PlayCanvas.md`                                                                                                        | Secondary local research         | Current local backup, reviewed 2026-06-20                                                       | Provides candidate preset families and a code-heavy PlayCanvas visual prototype proposal.                                                                                        |
| `.backup/Анализ-визуальных-эффектов-PlayCanvas.md`                                                                                                                                   | Secondary local research         | Current local backup, reviewed 2026-06-20                                                       | Provides a broader shader/post-processing analysis and 20 named visual configurations.                                                                                           |
| `memory-bank/currentResearch.md`                                                                                                                                                     | Primary local Memory Bank        | Reviewed 2026-06-20                                                                             | Shows prior PlayCanvas project/entity-type, Editor, and runtime projection research.                                                                                             |
| `memory-bank/tasks.md`, `memory-bank/activeContext.md`, `memory-bank/techContext.md`, `memory-bank/systemPatterns.md`                                                                | Primary local Memory Bank        | Reviewed 2026-06-20                                                                             | Establishes current repository state, architectural placement rules, and ongoing PlayCanvas work.                                                                                |
| `docs/en/guides/browser-e2e-testing.md`                                                                                                                                              | Primary local docs               | Reviewed 2026-06-20                                                                             | Confirms repository E2E expectations for WebGL/runtime surfaces: nonblank bounded canvas, viewport matrix, no overflow, focus behavior, and no technical leakage.                |
| `docs/en/guides/mmoomm-flight-simulator.md`                                                                                                                                          | Primary local docs               | Reviewed 2026-06-20                                                                             | Documents the existing MMOOMM flight runtime proof and the canonical Editor-authored snapshot generation path that the lab must not regress.                                     |
| `docs/en/platform/playcanvas-projects.md`                                                                                                                                            | Primary local docs               | Reviewed 2026-06-20                                                                             | Documents PlayCanvas project storage, snapshot export/import, immutable runtime manifest sync, and the rule that runtime manifests must not expose mutable authoring file paths. |
| `docs/en/platform/playcanvas-editor.md`                                                                                                                                              | Primary local docs               | Reviewed 2026-06-20                                                                             | Documents the Editor artifact boundary, full-boot acceptance, compatibility bridge, token/origin protections, and authoring-only package constraints.                            |
| `packages/universo-react-playcanvas-engine/README.md`                                                                                                                                | Primary local docs               | Reviewed 2026-06-20                                                                             | Confirms the runtime wrapper re-exports PlayCanvas and currently adds only generic bounded canvas, box, follow-camera, zoom/rotation, and AABB helpers.                          |
| `tools/testing/e2e/specs/generators/metahubs-mmoomm-app-export.spec.ts`                                                                                                              | Primary local code               | Current worktree, reviewed 2026-06-20                                                           | Canonical browser-first generator for `tools/fixtures/metahubs-mmoomm-app-snapshot.json`; currently assumes one playable MMOOMM project in key places.                           |
| `tools/testing/e2e/support/mmoommAppFixtureContract.ts`                                                                                                                              | Primary local code               | Current worktree, reviewed 2026-06-20                                                           | Fixture validator; currently has box-only and all-runtime-manifests-have-MMOOMM-metadata assumptions.                                                                            |
| `tools/testing/e2e/support/mmoommPlaycanvasEditorAuthoring.ts`                                                                                                                       | Primary local code               | Current worktree, reviewed 2026-06-20                                                           | Existing browser Editor authoring helper; currently ship/station and box-oriented.                                                                                               |
| `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectsService.ts`                                                                     | Primary local code               | Current worktree, reviewed 2026-06-20                                                           | Publishes PlayCanvas project state and derives `metadata.mmoomm` only for scenes containing `MMOOMM Ship` and `MMOOMM Station`.                                                  |
| `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectSnapshotService.ts`                                                              | Primary local code               | Current worktree, reviewed 2026-06-20                                                           | Exports/imports PlayCanvas project state inside metahub snapshots.                                                                                                               |
| `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/playCanvasProjectsStore.ts`                                                                       | Primary local code               | Current worktree, reviewed 2026-06-20                                                           | Publication manifest list ordering is newest-first, so selecting `items[0]` is unsafe once two projects are published.                                                           |
| `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx`                                                                                      | Primary local code               | Current worktree, reviewed 2026-06-20                                                           | Runtime widget currently projects only `metadata.mmoomm.scene.objects` into white boxes.                                                                                         |
| `packages/universo-react-playcanvas-engine/src/runtime.ts`                                                                                                                           | Primary local code               | Current worktree, reviewed 2026-06-20                                                           | Runtime wrapper currently provides app lifecycle, standard material, and box helper only.                                                                                        |
| `packages/universo-react-playcanvas-engine/package.json`, `pnpm-workspace.yaml`                                                                                                      | Primary local code               | Current worktree, reviewed 2026-06-20                                                           | Confirms wrapper uses catalog `playcanvas: 2.18.1`.                                                                                                                              |
| `packages/universo-react-playcanvas-engine/node_modules/playcanvas/build/playcanvas.d.ts`                                                                                            | Primary local dependency API     | Installed local package `2.18.1`, checked 2026-06-20                                            | Confirms actual runtime availability of `CameraFrame`, `SphereGeometry`, `FOG_EXP2`, blend constants, opacity, emissive intensity, opacity dithering, and fog material flags.    |
| `packages/universo-react-playcanvas-editor-frontend/vendor/package.playcanvas-editor.json`                                                                                           | Primary local vendor metadata    | Current worktree, checked 2026-06-20                                                            | Confirms vendored Editor depends on `playcanvas@2.19.5`; do not mix Editor internals into runtime MUI.                                                                           |
| PlayCanvas Post Effects docs: `https://developer.playcanvas.com/user-manual/graphics/posteffects/`                                                                                   | Primary external docs            | Current docs opened 2026-06-20                                                                  | Confirms modern `CameraFrame` and legacy script post-processing paths; modern path includes HDR bloom, SSAO, DoF, TAA, grading, vignette/fringing.                               |
| PlayCanvas CameraFrame docs: `https://developer.playcanvas.com/user-manual/graphics/posteffects/cameraframe/`                                                                        | Primary external docs            | Current docs opened 2026-06-20                                                                  | Confirms `CameraFrame` built-in effects and customization entry points.                                                                                                          |
| PlayCanvas Physical Materials docs: `https://developer.playcanvas.com/user-manual/graphics/physical-rendering/physical-materials/`                                                   | Primary external docs            | Current docs opened 2026-06-20                                                                  | Confirms diffuse, metalness/glossiness, emissive, opacity, normal, and height material properties as current PlayCanvas material concepts.                                       |
| PlayCanvas StandardMaterial API: `https://api.playcanvas.com/engine/classes/StandardMaterial.html`                                                                                   | Primary external API             | Current API page is v2.19.7, checked against local v2.18.1 d.ts                                 | Confirms material properties such as emissive, emissiveIntensity, opacity, opacityDither, and useFog; local d.ts confirms these exist in v2.18.1.                                |
| PlayCanvas SphereGeometry API: `https://api.playcanvas.com/engine/classes/SphereGeometry.html`                                                                                       | Primary external API             | Current API page is v2.19.7, checked against local v2.18.1 d.ts                                 | Confirms procedural sphere bands (`latitudeBands`, `longitudeBands`, `radius`) useful for low-poly variants; local d.ts confirms availability in v2.18.1.                        |
| PlayCanvas Engine examples graphics directory: `https://github.com/playcanvas/engine/tree/main/examples/src/examples/graphics`                                                       | Primary external source/examples | Main branch opened 2026-06-20; examples may track latest engine                                 | Confirms relevant examples exist for post-processing, HDR, dithered transparency, colored outlines, and shapes. Use as reference only, not as direct version-locked code.        |
| PlayCanvas MMOOMM forum positioning: `https://forum.playcanvas.com/t/universo-mmoomm-explore-space-and-parallel-worlds-unite-and-transfer-your-achievements-to-the-real-world/38757` | Tertiary external context        | Referenced by brief; not needed as implementation authority                                     | Context for MMOOMM positioning, not a source for API or repository architecture.                                                                                                 |
| Context7 MCP                                                                                                                                                                         | Tooling status                   | Attempted 2026-06-20 during initial research and QA, returned `unsupported call: mcp__context7` | The requested MCP documentation path is unavailable in this session; official PlayCanvas docs/API/source were used directly instead.                                             |
| Web-search helper                                                                                                                                                                    | Tooling status                   | Attempted 2026-06-20 during QA, returned `unsupported call: omniroute_web_search`               | Direct access to official PlayCanvas docs/GitHub via `curl` still worked; the artifact must not claim full search-engine coverage.                                               |

## Key Findings

### Facts: repository architecture

-   The current canonical MMOOMM snapshot flow is browser-first. The generator at `tools/testing/e2e/specs/generators/metahubs-mmoomm-app-export.spec.ts` creates a metahub, attaches PlayCanvas/Colyseus packages, creates a single bound project named `MMOOMM Authoring`, opens the vendored PlayCanvas Editor, authors the flight scene, publishes it, configures a `playcanvasCanvas` widget, proves runtime, and exports `tools/fixtures/metahubs-mmoomm-app-snapshot.json`.
-   The existing PlayCanvas project binding model is appropriate for this work. The visual lab should be a second project instance and second PlayCanvas project inside the same metahub configuration. It should not be a new built-in entity kind, and it should not require a new MMOOMM-specific package unless PLAN proves runtime projection needs a reusable package boundary.
-   `project` entity instances bind through `config.projectBinding.projectCodename`; `projectId` is not the stable portable identity. Snapshot import/remap semantics make codename the correct comparison key for the fixture contract.
-   The runtime wrapper `@universo-react/playcanvas-engine` uses `playcanvas@2.18.1`, while the vendored Editor metadata declares `playcanvas@2.19.5`. Different package boundaries carry different PlayCanvas versions, so runtime research must use the package-local runtime d.ts as authority and Editor research must use the vendored Editor metadata/boundary.
-   The current runtime wrapper only provides `createBasicApplication`, `resizeApplicationCanvas`, `createStandardMaterial`, `createBoxEntity`, and flight-camera helpers. It does not yet expose sphere helpers, translucent material helpers, fog helpers, glow shell helpers, or low-poly custom geometry helpers.
-   Local PlayCanvas project docs reinforce that PlayCanvas projects are design-time metahub records and that published application sync uses normalized immutable `playcanvasRuntimeManifests`. Runtime manifests must not leak mutable `playcanvas-projects/...` authoring paths into the published app.
-   Local PlayCanvas Editor docs reinforce the package boundary: `@universo-react/playcanvas-editor-frontend` is authoring-only, vendored upstream Editor code must stay isolated, and runtime MUI code must not import PCUI/Observer/vendor internals.

### Facts: current generator and fixture risks

-   `createProjectInstanceAndBindThroughBrowser()` and `publishPlayCanvasProjectThroughBrowser()` resolve the target project by name, but the UI operation then opens a project edit dialog through a helper that targets the first project row. With two project instances, finding the target in API data does not prove the browser actually edits/publishes that target.
-   `publishPlayCanvasProjectThroughBrowser()` currently publishes via the edit dialog rather than a direct project-id specific UI action. PLAN must add deterministic row targeting and assert the opened dialog belongs to the intended project display name/codename.
-   After publish, the generator fetches `/playcanvas/published-runtime-manifests` and currently reads `items?.[0]`. The store lists publication manifests newest-first, so publishing a lab scene after the flight scene can make `items[0]` refer to the lab. Runtime binding and proof must select by `projectId`, `sceneId`, checksum, or project codename, never by list order.
-   `configurePlayCanvasCanvasWidgetThroughBrowser()` chooses a published scene option using a broad regex and `.last()`. If both the authoring and lab projects are published, this can bind the runtime flight widget to the lab. The selector must explicitly bind the existing playable widget to the `MMOOMM Authoring` manifest.
-   `mmoommAppFixtureContract.ts` currently accepts at least one PlayCanvas project, scene, and project-binding instance, not exactly the intended two projects. The new contract should assert exactly the active intended bound project set: `MMOOMM Authoring` and `MMOOMM Visual Linkup Lab`.
-   `assertRenderableMmoommEntity()` requires `render.type === 'box'` for render components. That is correct for the existing ship/station flight proof, but it cannot validate a visual lab containing spheres or custom mesh instances without project-aware logic.
-   The fixture contract currently requires every runtime manifest to carry `metadata.mmoomm`. That is compatible with the flight scene, but a visual lab without `MMOOMM Ship` and `MMOOMM Station` will likely publish without `metadata.mmoomm`. If the lab is published, the contract must distinguish playable flight manifests from lab manifests or define a separate lab metadata contract.
-   `PlayCanvasProjectsService.ts` derives `metadata.mmoomm.scene` only when the editor entities include renderable `MMOOMM Ship` and `MMOOMM Station`. A lab scene with station/ship/asteroid comparison objects under different names will not automatically get flight runtime projection metadata.

### Facts: current runtime projection limits

-   `PlayCanvasCanvasWidget.tsx` reads only `manifest.metadata.mmoomm.scene.objects` and normalizes object fields `{ id, position, scale, selectable, guard }`. It does not read Editor-authored material assets, render component primitive type, fog settings, low-poly bands, glow-shell metadata, or custom lab preset metadata.
-   The runtime widget currently renders all manifest objects as white boxes through `createBoxEntity()` and one white `StandardMaterial`. Therefore the current published-app runtime proof cannot prove spheres, translucent bodies, emissive glow, low-poly segmentation, dithered transparency, outline passes, or scene fog.
-   Fog-like settings exist in PlayCanvas scene settings and can be normalized/persisted by backend scene handling, but the current runtime widget does not apply manifest scene settings to `app.scene`.
-   The existing runtime proof is flight-specific. It checks the Space section, realtime status, movement intents, stop behavior, camera controls, and flight canvas labels. A visual lab proof needs separate assertions and cannot be treated as the same oracle unless the lab becomes a runtime-visible widget with its own projection model.
-   Repository E2E guidance already treats browser game/WebGL runtime surfaces as requiring nonblank bounded canvas checks, viewport matrix coverage, no page-level horizontal overflow, keyboard/focus behavior, no raw IDs/JSON/protocol leakage, and reconnect/WebSocket state proof where relevant. Any runtime-visible lab must inherit this gate; screenshots alone are not enough.

### Facts: PlayCanvas capabilities confirmed

-   Official PlayCanvas docs currently recommend `CameraFrame` as the modern post-processing path, with HDR bloom, SSAO, DoF, TAA, color grading/LUT, vignette, fringing, tone mapping, sharpness, and extensibility through compose shader customization or custom render passes.
-   Legacy script post effects are still documented and supported, including Bloom, Brightness-Contrast, Hue-Saturation, FXAA, Sepia, and Vignette. For this repository, modern `CameraFrame` is useful but should be gated until runtime projection and browser proof are in place.
-   Local `playcanvas@2.18.1` d.ts confirms the APIs needed for a conservative first implementation are available: `FOG_EXP2`, `BLEND_NORMAL`, `BLEND_ADDITIVE`, `StandardMaterial.opacity`, `StandardMaterial.opacityDither`, `StandardMaterial.emissiveIntensity`, `StandardMaterial.useFog`, `SphereGeometry`, `Mesh.fromGeometry`, and `CameraFrame`.
-   Local `playcanvas@2.18.1` d.ts also confirms the specific gated `CameraFrame` fields used by this artifact's example (`bloom.intensity`, `bloom.blurLevel`, `vignette.intensity`, and `update()`), plus `CameraFrame.destroy()`. If PLAN enables CameraFrame, cleanup must call the appropriate destroy/disable path when the owning widget unmounts.
-   The current public API pages are generated for PlayCanvas Engine v2.19.7, not v2.18.1. Their names and properties match local v2.18.1 for the conservative primitives above, but PLAN should keep using local d.ts as the version authority.
-   `SphereGeometry` supports `radius`, `latitudeBands`, and `longitudeBands`. Low-poly spheres can be represented by low band counts such as 6-10, rather than a custom mesh pipeline in the first pass.
-   `StandardMaterial.opacity` requires a blend mode for semi-transparent rendering, and the API documentation warns that `depthWrite` should usually be false for translucent objects. This aligns with a white translucent core material.
-   `StandardMaterial.emissive` and `emissiveIntensity` support colored glow material setup. A duplicate shell geometry with additive blending is a safer first-pass approximation of type-color halo than shader chunks or screen-space outline passes.
-   `StandardMaterial.useFog` and `app.scene.fog = pc.FOG_EXP2` support the dense white-fog look with low implementation risk.

### Facts: prior local research

-   The first `.backup` research correctly maps the lore requirement to diegetic UX: new users have an unstable sensory channel through a robot avatar, so white translucent shapes, dense fog, softened contours, low detail, and type-color glow are product-aligned rather than merely decorative.
-   The backup research's recommended preset families remain useful: soft white linkup, type-classification glow, low-poly/retrowave, and channel degradation.
-   The backup research's code-heavy CameraFrame and material examples are plausible, but should not be copied wholesale into the first PLAN without adapting to repository boundaries. Current Editor helper and runtime projection code do not yet persist or consume all the proposed render settings.
-   The second `.backup` research proposes shader chunks, Fresnel rim lighting, outline post effects, dither/noise, and 20 configurations. These are useful future directions, but for the first implementation they are higher-risk than fog + material opacity + emissive shell geometry + low-poly primitive segmentation.

### Inferences

-   A first slice that only creates an Editor-reviewable second project is much smaller and lower risk than making the lab fully visible in the published runtime. It can validate scene export/import and allow visual inspection inside PlayCanvas Editor without changing `PlayCanvasCanvasWidget.tsx`.
-   If the user needs published runtime-visible visual comparison in the same slice, PLAN must include a runtime projection contract extension for lab shapes/materials/fog/glow, or a separate lab widget/rendering path. Otherwise browser runtime evidence will not prove the actual requested effects.
-   Publishing the lab project is possible at the backend storage level because publication replacement is scoped by `projectIds: [projectId]`, but generator selectors and fixture validation must be made project-aware before doing so safely.
-   It is safer to start with 12 or 16 variants rather than exactly 20, unless the user explicitly wants the full catalog. Sixteen variants cover four families cleanly and keep the scene readable.
-   The active brief requires "about 10-20" sets, not exactly 20. A 16-variant grid is therefore compliant, but PLAN should explicitly record that it chooses coverage/readability over reproducing every backup-research preset.

## QA Review Findings

-   Verdict: pass-with-minor-issues after this QA update.
-   The artifact matches the active brief's core requirements: second PlayCanvas project in the existing MMOOMM metahub fixture, browser-authored state instead of manual snapshot patching, 10-20 primitive visual variants, stable first-pass PlayCanvas mechanisms, preservation of the flight runtime proof, and browser evidence requirements.
-   The initial artifact under-represented several local docs named by the brief. This QA update added `browser-e2e-testing.md`, `mmoomm-flight-simulator.md`, `playcanvas-projects.md`, `playcanvas-editor.md`, and the PlayCanvas Engine README to the source inventory and implications.
-   The initial artifact was directionally correct about runtime proof but not strict enough about repository WebGL evidence. This QA update ties runtime-visible lab acceptance to the project WebGL gate: nonblank bounded canvas, viewport matrix, no overflow, focus behavior, no raw technical leakage, and semantic assertions beyond screenshots.
-   The initial artifact correctly treated `CameraFrame` as gated, but did not mention cleanup. This QA update records that local `CameraFrame.destroy()` exists and that PLAN must own cleanup if the runtime path uses CameraFrame.
-   No blocker was found requiring a different recommended decision. The strongest remaining product decision is still Editor-only vs published vs runtime-visible lab.

## Runtime Helper Candidate Snippets

These examples are research snippets only. They are implementation-ready only for a runtime projection path that imports `@universo-react/playcanvas-engine`; they are not yet proof that the current product/Editor authoring path persists the same material, fog, primitive, or custom mesh payloads. PLAN must either prove the Editor serialized scene payload supports the needed fields or keep these snippets as runtime helper candidates.

### Conservative material helpers

```ts
import * as pc from '@universo-react/playcanvas-engine'

export const createLinkupCoreMaterial = (opacity = 0.62): pc.StandardMaterial => {
    const material = new pc.StandardMaterial()
    material.diffuse = new pc.Color(1, 1, 1)
    material.emissive = new pc.Color(0.04, 0.04, 0.05)
    material.emissiveIntensity = 0.5
    material.opacity = opacity
    material.blendType = pc.BLEND_NORMAL
    material.depthWrite = false
    material.useFog = true
    material.update()
    return material
}

export const createGlowShellMaterial = (color: pc.Color, opacity = 0.18): pc.StandardMaterial => {
    const material = new pc.StandardMaterial()
    material.diffuse = color
    material.emissive = color
    material.emissiveIntensity = 2.5
    material.opacity = opacity
    material.blendType = pc.BLEND_ADDITIVE
    material.depthWrite = false
    material.useLighting = false
    material.useFog = true
    material.update()
    return material
}
```

### Conservative fog helper

```ts
import * as pc from '@universo-react/playcanvas-engine'

export const applyLinkupFog = (app: pc.Application, density = 0.025): void => {
    app.scene.fog = pc.FOG_EXP2
    app.scene.fogColor = new pc.Color(0.88, 0.91, 0.98)
    app.scene.fogDensity = density
}
```

### Primitive render helpers

```ts
import * as pc from '@universo-react/playcanvas-engine'

type LabPrimitive = 'box' | 'sphere'

export const createPrimitiveEntity = (
    name: string,
    primitive: LabPrimitive,
    material: pc.Material,
    position: pc.Vec3,
    scale: pc.Vec3
): pc.Entity => {
    const entity = new pc.Entity(name)
    entity.addComponent('render', { type: primitive, material })
    entity.setLocalPosition(position)
    entity.setLocalScale(scale)
    return entity
}

export const addGlowShell = (parent: pc.Entity, primitive: LabPrimitive, color: pc.Color, shellScale = 1.06): pc.Entity => {
    const shell = createPrimitiveEntity(
        `${parent.name} Glow`,
        primitive,
        createGlowShellMaterial(color),
        parent.getLocalPosition().clone(),
        parent.getLocalScale().clone().mulScalar(shellScale)
    )
    parent.parent?.addChild(shell)
    return shell
}
```

### Low-poly sphere geometry option

Use this only when the built-in render primitive `type: 'sphere'` cannot express the desired low-poly segmentation through Editor data.

```ts
import * as pc from '@universo-react/playcanvas-engine'

export const createLowPolySphereEntity = (
    app: pc.Application,
    name: string,
    material: pc.Material,
    latitudeBands = 8,
    longitudeBands = 10
): pc.Entity => {
    const geometry = new pc.SphereGeometry({
        radius: 0.5,
        latitudeBands,
        longitudeBands
    })
    const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, geometry)
    const meshInstance = new pc.MeshInstance(mesh, material)
    const entity = new pc.Entity(name)
    entity.addComponent('render', { meshInstances: [meshInstance] })
    return entity
}
```

### Gated CameraFrame enhancement

Use only after PLAN proves the target runtime/editor path can mount and dispose `CameraFrame` safely and browser evidence shows it does not break the current flight runtime.

```ts
import * as pc from '@universo-react/playcanvas-engine'

export const attachLinkupCameraFrame = (app: pc.Application, camera: pc.CameraComponent): pc.CameraFrame => {
    const frame = new pc.CameraFrame(app, camera)
    frame.bloom.intensity = 0.04
    frame.bloom.blurLevel = 8
    frame.vignette.intensity = 0.15
    frame.update()
    return frame
}
```

## Recommended Visual Preset Families

The lab should compare families, not random parameter combinations. A 16-variant matrix is the best first default:

| Family                   | Example variants                                                                                      | Purpose                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Soft white linkup        | `white_link_halo`, `mist_core`, `soft_station_read`, `near_white_core`                                | Baseline lore fit: white translucent bodies, fog, readable silhouettes.                                      |
| Type-classification glow | `cyan_ship_magenta_station`, `amber_rock_ice_blue`, `classification_minimal`, `classification_strong` | Tests whether station, ship, rock asteroid, and ice asteroid remain distinguishable while bodies stay white. |
| Low-poly / retrowave     | `lowpoly_clean`, `lowpoly_radar`, `retrowave_soft`, `retrowave_aggressive`                            | Tests angular geometry and glow intensity without turning the scene into noise.                              |
| Channel degradation      | `linkup_boot`, `sensor_dropout`, `dense_fog_relay`, `near_whiteout`                                   | Tests narrative onboarding or link failure visuals; likely too heavy for normal flight.                      |

Suggested type colors for the first comparison:

| Object type   | Glow color        | Reason                                                                                      |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| Ship          | Cyan or cyan-blue | Reads as user/vehicle telemetry without dominating the scene.                               |
| Station       | Magenta or violet | Strongly separates infrastructure from ship.                                                |
| Rock asteroid | Amber or orange   | Reads as resource/rock mass.                                                                |
| Ice asteroid  | Ice blue          | Separates colder/resource variant from rock asteroid while staying in the sensor aesthetic. |

## Conflicts And Uncertainty

-   Context7 was explicitly requested, but the available MCP call returned `unsupported call: mcp__context7`. This research therefore relies on official PlayCanvas docs/API/source via direct network access plus local installed package d.ts validation.
-   The web-search helper available in some sessions was also unavailable during QA (`unsupported call: omniroute_web_search`). The QA pass still opened additional official PlayCanvas pages and example source directly, but it should be read as primary-source verification rather than broad web search coverage.
-   Public PlayCanvas API docs currently show Engine v2.19.7. The runtime wrapper is pinned to v2.18.1. For APIs used in the conservative first pass, local d.ts confirms compatibility, but PLAN should not assume all current docs examples work unchanged in v2.18.1.
-   The backup research suggests shader chunks, Fresnel rim lighting, outline post effects, and dither/noise. These are valid exploratory paths, but not all are proven through the Universo Editor serialization and runtime manifest projection path. Treat them as future or gated work unless PLAN expands the slice.
-   It is still an explicit product decision whether the visual lab must be visible in the published MMOOMM runtime. The original TZ says create a second PlayCanvas project and generate the snapshot; it does not unambiguously require a published runtime widget for the lab.
-   If the lab is Editor-only, browser evidence can prove Editor/canvas visibility and snapshot content, but not published-app runtime visual parity. If runtime parity is required, runtime code changes are necessary.
-   It is unclear whether material assets, scene settings, low-poly geometry, or shell-object relationships authored in the vendored Editor are currently exported in a form that can support rich lab validation without adding helper assertions. PLAN must inspect the exact serialized scene payload before finalizing contract assertions.
-   PlayCanvas official examples for dithered transparency and colored outlines are useful source references, but they depend on latest example infrastructure and sometimes asset pipelines (`container`, GLB, Draco, orbit scripts). For this MVP lab, examples should inform approach only; do not import their asset-heavy setup into the fixture generator.

## Project Implications

-   The next PLAN must be explicit about target scope:
    -   Editor-only lab: add second project, author comparison scene, prove the comparison layout in the Editor/fullscreen canvas, validate exported PlayCanvas snapshot payload, keep existing flight runtime proof unchanged.
    -   Published lab: also publish the lab project, update fixture contract to allow/validate lab manifest separately, and avoid `metadata.mmoomm` requirements for the lab unless adding a lab metadata contract.
    -   Runtime-visible lab: additionally extend `PlayCanvasCanvasWidget.tsx` or add a focused widget path to consume lab shape/material/fog/glow metadata and produce separate browser proof.
-   If PLAN chooses runtime-visible lab, the runtime UI contract must state the owning `apps-template-mui` widget zone, one PlayCanvas app instance per mounted canvas, camera/light/material/mesh setup, asset/procedural readiness states, resize behavior, input/focus ownership, and cleanup/disposal behavior.
-   The canonical generator must become project-aware before adding the second project:
    -   target project row by display name/codename in create/bind/publish flows;
    -   assert the opened dialog belongs to the target project;
    -   select published manifests by project identity, not list order;
    -   keep the existing `playcanvasCanvas` widget bound to `MMOOMM Authoring`.
-   The fixture contract should distinguish at least two project roles:
    -   `MMOOMM Authoring`: playable flight scene, requires `MMOOMM Ship`, `MMOOMM Station`, key light, `metadata.mmoomm.scene`, runtime manifest checksum, and runtime widget binding.
    -   `MMOOMM Visual Linkup Lab`: visual comparison scene, requires named lab scene/project, enough primitives/presets, allowed box/sphere/custom mesh renderables, lights/camera/fog/material evidence as appropriate, and no empty `New Entity`.
-   Do not manually patch `tools/fixtures/metahubs-mmoomm-app-snapshot.json`. It remains generated by the product Playwright flow.
-   Do not introduce glTF/Draco/textures or a production asset pipeline in this slice. The requested lab can be expressed with primitives, materials, scene fog, and optional procedural low-poly sphere geometry.
-   Do not replace the existing flight simulator proof. The lab is additive and must not regress move-to-target, stop, camera, realtime, import, and published runtime replay proof.
-   If any shared runtime helper is added later, it belongs in `@universo-react/playcanvas-engine` only if generic and reusable, for example `createSphereEntity`, `createTranslucentMaterial`, or `applyFog`. MMOOMM-specific preset names and visual-lore data should stay in metahub/project data or generator support.
-   Browser QA requirements must be separate:
    -   existing flight runtime proof remains flight-specific;
    -   Editor-only lab proof needs visible Editor/fullscreen canvas evidence for the comparison layout, plus serialized-scene assertions for the intended primitive/material/fog metadata, no empty default entities, and no raw IDs/checksums in normal UI surfaces;
    -   published/runtime-visible lab proof needs visible comparison layout, nonblank bounded canvas, stable view framing, no raw `projectId`/`sceneId`/checksum leakage on normal UI, no horizontal overflow, keyboard/focus checks, and desktop/tablet/mobile viewport matrix.

## Recommended Decision

Proceed to PLAN with a conservative first implementation:

1. Add `MMOOMM Visual Linkup Lab` as a second bound PlayCanvas project in the existing MMOOMM metahub generator.
2. Make project selection, publishing, manifest lookup, and fixture validation deterministic before relying on two projects.
3. Build the first lab as Editor-authored scene data with 16 variants, using the following mechanisms only where the Editor serialized payload proves support; otherwise keep them as runtime projection candidates:
    - white translucent core materials;
    - type-color emissive/additive shell geometry;
    - scene `FOG_EXP2`;
    - low-band spheres or low-poly custom sphere mesh where needed;
    - simple grid/line layout for human comparison.
4. Keep `CameraFrame`, shader chunks, screen-space outline, depth-driven blur, and dither/noise as gated enhancements after the lab's basic project/snapshot contract is stable.
5. Keep the published flight runtime widget bound to `MMOOMM Authoring`. Publish the lab only if PLAN adds explicit manifest selection and a lab manifest contract. Make the lab runtime-visible only if PLAN also extends runtime projection for shape/material/fog/glow.
6. If PLAN chooses runtime-visible lab, add the full browser runtime UI contract and Playwright canvas/WebGL evidence requirements before implementation starts, not as a closeout afterthought.

This path satisfies the original TZ's "second project in the existing metahub configuration" requirement while avoiding premature runtime projection work that the current code cannot prove.

## Open Questions Before PLAN

-   Is the first visual lab acceptance Editor-side review plus exported snapshot validation, or must it be visible in the published MMOOMM runtime immediately?
-   Should the first implementation use 16 variants as the recommended coverage matrix, or does the user require exactly 20 variants from the broader backup research?
-   If the lab is published, should it carry a new `metadata.mmoomm.visualLab` contract, or should fixture validation only inspect its editor scene payload and allow a manifest without `metadata.mmoomm`?
-   Should asteroid types remain visual-only lab objects in this slice, or should the MMOOMM domain model add rock/ice asteroid object types now?
-   Should shared PlayCanvas runtime helper additions be included in the same PLAN, or deferred until runtime-visible lab proof is explicitly selected?
-   If runtime-visible lab is chosen, what exact serialized metadata shape carries `primitive`, material opacity, glow color, shell scale, low-poly bands, and fog settings without leaking Editor-only storage details?

## Handoff To PLAN Checklist

-   Load this research artifact before planning.
-   Re-read the active brief and source TZ.
-   Decide Editor-only vs published vs runtime-visible lab scope before checklist phases.
-   Run OntoIndex impact analysis before editing any function/class/method.
-   Target exact generator symbols that currently assume a single project or first/latest manifest.
-   Keep `MMOOMM Authoring` flight runtime proof unchanged and project-bound.
-   Update fixture contract with project-role-aware assertions.
-   Use local `playcanvas@2.18.1` d.ts as runtime API authority.
-   Do not manually edit the tracked snapshot.
-   Include browser evidence requirements in PLAN, with separate flight and lab oracles.
-   Include a QA checklist for the research-derived implementation: deterministic project selection, manifest selection by project identity, fixture contract role split, Editor/runtime boundary preservation, WebGL canvas evidence, and no technical leakage.

## Sources

-   Local cross-project MMOOMM PlayCanvas Visual Linkup Lab brief, dated 2026-06-20
-   Local MMOOMM PlayCanvas Visual Linkup Lab input, dated 2026-06-20
-   `.backup/Исследование-визуального-прототипа-Universo-MMOOMM-на-PlayCanvas.md`
-   `.backup/Анализ-визуальных-эффектов-PlayCanvas.md`
-   `tools/testing/e2e/specs/generators/metahubs-mmoomm-app-export.spec.ts`
-   `tools/testing/e2e/support/mmoommAppFixtureContract.ts`
-   `tools/testing/e2e/support/mmoommPlaycanvasEditorAuthoring.ts`
-   `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectsService.ts`
-   `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/PlayCanvasProjectSnapshotService.ts`
-   `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/services/playCanvasProjectsStore.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/PlayCanvasCanvasWidget.tsx`
-   `packages/universo-react-playcanvas-engine/src/runtime.ts`
-   `packages/universo-react-playcanvas-engine/README.md`
-   `docs/en/guides/browser-e2e-testing.md`
-   `docs/en/guides/mmoomm-flight-simulator.md`
-   `docs/en/platform/playcanvas-projects.md`
-   `docs/en/platform/playcanvas-editor.md`
-   `packages/universo-react-playcanvas-engine/package.json`
-   `pnpm-workspace.yaml`
-   `packages/universo-react-playcanvas-engine/node_modules/playcanvas/build/playcanvas.d.ts`
-   `packages/universo-react-playcanvas-editor-frontend/vendor/package.playcanvas-editor.json`
-   PlayCanvas Post Effects docs: https://developer.playcanvas.com/user-manual/graphics/posteffects/
-   PlayCanvas CameraFrame docs: https://developer.playcanvas.com/user-manual/graphics/posteffects/cameraframe/
-   PlayCanvas Physical Materials docs: https://developer.playcanvas.com/user-manual/graphics/physical-rendering/physical-materials/
-   PlayCanvas StandardMaterial API: https://api.playcanvas.com/engine/classes/StandardMaterial.html
-   PlayCanvas SphereGeometry API: https://api.playcanvas.com/engine/classes/SphereGeometry.html
-   PlayCanvas Engine graphics examples: https://github.com/playcanvas/engine/tree/main/examples/src/examples/graphics
