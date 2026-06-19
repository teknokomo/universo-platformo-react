# Research: PlayCanvas Metahub Template + "Projects" Entity Type, MMOOMM Snapshot Regeneration

> Created: 2026-06-17
> Status: Reviewed (QA pass 2026-06-17: verified resource-surface capability list, template picker, and structure-version mechanics against source; resolved 3 open questions via new user directives)
> Trigger: RESEARCH command for the PlayCanvas metahub template + "Projects" entity-type brief (MANAGER cross-project brief, tracked outside the repository)
> Follow-up plan: PLAN not created yet; a future PLAN must load this artifact explicitly.
>
> User directives locked in this QA pass: (1) DELETE the legacy "PlayCanvas projects" panel under Resources/Packages — no legacy code retained; (2) do NOT bump the metahub schema/template structure version; (3) the test DB is recreated (no back-compat / migration burden); (4) significant refactoring of any package/code is permitted.

## Research Question

Can a new platform entity-type preset "Projects" and a new metahub template "PlayCanvas" be implemented entirely through the existing Entity Type Constructor / preset / template mechanisms (no feature-specific hardcoding), rendered with the same shared base UI components as Objects, placed above "Hubs" in the metahub left menu, and bound to a PlayCanvas Editor project — and what (if anything) is missing in the configurator? Then: what does the MMOOMM Playwright generator rework require to regenerate `tools/fixtures/metahubs-mmoomm-app-snapshot.json` from the new template?

## Source Inventory

| Source | Type | Date / Freshness | Why It Matters |
|--------|------|------------------|----------------|
| `packages/universo-react-metahubs-backend/src/domains/templates/data/index.ts` | Local backend registry | Current 2026-06-17 | `builtinEntityTypePresets` + `builtinTemplates` are the registration points for a new preset/template. |
| `.../templates/data/one-c-compatible.entity-presets.ts` | Local preset set | Current | Precedent: 11 registered presets with custom `kindKey`s mapping to the Object surface via object-like capabilities. |
| `.../templates/data/one-c-compatible.template.ts` | Local template | Current | Precedent: a template declaring `presets: [{presetCodename, includedByDefault}]` + per-kind seeded settings. |
| `.../templates/data/standardEntityTypeDefinitions.ts` | Local capability/UI defs | Current | `EntityTypeUIConfig` (`sidebarSection`, `sidebarOrder`), capability sets. Hub `sidebarOrder` = 10. |
| `.../domains/shared/entityMetadataKinds.ts` | Local kind resolver | Current | `resolveEntityMetadataKindFromType` maps custom/template-managed object-like types onto the OBJECT metadata surface; otherwise returns null. |
| `.../domains/entities/services/builtinKindBehaviorRegistry.ts` | Local behavior registry | Current | Builtin behavior kinds derive from a FIXED `ENTITY_SURFACE_KEYS` set; custom kinds reuse the object behavior via metadata-kind resolution. |
| `packages/universo-react-metahubs-frontend/src/domains/entities/ui/EntitiesWorkspace.tsx` | Local constructor UI | Current | THE Entity Type Constructor. Generic form: kindKey, icon, tabs, sidebarSection, sidebarOrder (integer), capabilities (dependency graph), resourceSurfaces, behaviorProfile, preset selector. |
| `.../domains/entities/ui/entityTypePreset.ts` | Local form-patch builder | Current | Maps a preset manifest into constructor form values (`buildEntityTypePresetFormPatch`). |
| `.../menu-items/metahubDashboard.ts` | Local menu | Current | Entity-type items injected dynamically ("Dynamic entity-type items … appear here"); no hardcoded per-kind menu. |
| `.../domains/entities/ui/EntityInstanceList.tsx`, `BuiltinEntityCollectionPage.tsx` (routes `/entities/:kindKey/instances`) | Local generic rendering | Current | Instance rendering is generic by `:kindKey`; a new kind reuses the same components. |
| `.../domains/packages/` (`MetahubPackagesTab.tsx`, `playcanvasProjectsApi.ts`, `PlayCanvasEditorHostPage.tsx`) | Local current project surface | Current | Today's PlayCanvas project create/list/open-editor/publish lives under Resources/Packages. |
| `.../domains/playcanvas-projects/` (backend) + `packages/universo-react-types/src/common/playcanvasProjects.ts` | Local project store | Current | The metahub-scoped PlayCanvas project store and `PlayCanvasProject` / `PlayCanvasRuntimeManifest` types. |
| `.../domains/metahubs/services/systemTableDefinitions.ts` | Local system tables | Current 2026-06-17 (QA) | `_mhb_playcanvas_projects` (+ scenes/assets/script_assets/bindings/artifacts/sourcefiles/compatibility/publication_manifests) are ALREADY current-baseline system tables; `_mhb_playcanvas_projects.codename` is unique-active. `ADDITIVE_CURRENT_BASELINE_TABLE_NAMES` adds tables to baseline without a version bump. |
| `.../domains/metahubs/services/structureVersions.ts` | Local version engine | Current 2026-06-17 (QA) | `CURRENT_STRUCTURE_VERSION = 1`, SemVer `0.1.0`; additive baseline tables do not force a bump. |
| `packages/universo-react-types/src/common/entityTypeDefinition.ts` | Local capability contract | Current 2026-06-17 (QA) | `ENTITY_RESOURCE_SURFACE_CAPABILITIES = ['dataSchema','fixedValues','optionValues']` — confirms no existing surface for a project binding. |
| `.../domains/metahubs/ui/MetahubList.tsx` (`TemplateSelector`, `createOptions`) | Local create dialog | Current 2026-06-17 (QA) | Metahub-create dialog already has a `TemplateSelector` + per-preset `createOptions` toggles — generator can pick "PlayCanvas". |
| `tools/testing/e2e/specs/generators/metahubs-mmoomm-app-export.spec.ts` + support (`mmoommAppFixtureContract.ts`, `mmoommAppGeneratorData.*`, `mmoommPlaycanvasEditorAuthoring.*`) | Local product generator | Current | The flow to rework: basic-template metahub + package-panel project today. |
| `memory-bank/research/playcanvas-project-storage-model-for-metahubs-research-2026-06-03.md` | Prior research | 2026-06-03 | Concluded the project store is metahub-scoped (stable project id/codename + package compatibility); warned a new system table needs a structure-version bump. |
| `memory-bank/research/mmoomm-playcanvas-editor-main-functionality-runtime-projection-research-2026-06-10.md` | Prior research | 2026-06-10 | Established the design-time/runtime boundary and "explicit binding, not absorption" rule. |
| `.agents/skills/universo-platform-architecture/SKILL.md` | Local skill | Current | Strengthen-existing-preset rule, Entity Type Constructor, template model. |
| [Projects — PlayCanvas](https://developer.playcanvas.com/user-manual/editor/projects/) (via search) | Primary vendor docs | Checked 2026-06-17 | A Project = collection of Scenes + Assets + Settings owned by a user; can export multiple apps. |
| [Version Control — PlayCanvas](https://developer.playcanvas.com/user-manual/editor/version-control/) + Branches/Checkpoints sub-pages | Primary vendor docs | Checked 2026-06-17 | Branches/checkpoints/merging live INSIDE a PlayCanvas project; the metahub anchor must not duplicate them. |
| [PlayCanvas Editor Frontend is now Open Source](https://blog.playcanvas.com/playcanvas-editor-frontend-is-now-open-source/) | Primary vendor blog | July 2025 / checked 2026-06-17 | Confirms `github.com/playcanvas/editor` frontend-only; Universo backend is a custom compatibility layer. |

## Key Findings

### A. A new builtin entity KIND is NOT required — the one-c precedent applies directly
- The platform has a FIXED set of builtin metadata kinds (`ENTITY_SURFACE_KEYS`/`BuiltinEntityKinds` in `@universo-react/types`): hub, object, page, set, enumeration, ledger. Behavior is registered only for those.
- BUT `builtinEntityTypePresets` already contains 11 one-c presets (`catalog`, `document`, `information-register`, `constant`, etc.) whose `kindKey`s are NOT in that builtin set. They use object-like capability sets and map onto the OBJECT metadata surface via `isTemplateManagedObjectLikeType` (records + components + physicalTable). They render through the generic Object instance UI and appear in the sidebar at `sidebarSection: 'objects'` with distinct `sidebarOrder` (70–170).
- "Projects" can follow exactly this pattern: a registered preset with `kindKey: 'project'`, object-like capabilities, mapped to the OBJECT surface, with `sidebarOrder` below Hub's 10 to sit above "Hubs". No change to the builtin-kind enum is needed for the type/section itself.

### B. The Entity Type Constructor is fully generic and exposes every field "Projects" needs
- `EntitiesWorkspace.tsx` is the constructor. Its create/edit form exposes, through normal UI controls: localized name/description, `codename`, free-form `kindKey` (validated `^[a-z][a-z0-9._-]{0,63}$`), `iconName` (Tabler), `tabs`, `sidebarSection` ('objects' | 'admin'), `sidebarOrder` (validated non-negative integer), capability toggles with a dependency graph (`CAPABILITY_DEPENDENCIES`, `validateCapabilityDependencies`), `resourceSurfaces`, a `behaviorProfile` picker, and an `EntityTypePresetSelector` to start from a built-in preset manifest.
- Therefore "as if a user built it through the UI, nothing hardcoded" is satisfiable for the type definition + placement. The shipped platform preset is seeded as a built-in manifest (exactly like the one-c presets), which is the legitimate interpretation of "the user could have built this in the constructor."
- Built-in base kinds are structure-LOCKED on edit (`isBuiltinEntityKind`); a custom `project` kind is fully editable like the one-c kinds.

### C. The metahub left menu and instance rendering are data-driven
- `metahubDashboard.ts` injects entity-type items dynamically; ordering is driven by `sidebarOrder`. A `project` preset with `sidebarOrder < 10` appears above Hubs without editing menu code.
- Routes are generic: `/metahub/:metahubId/entities/:kindKey/instances` → `EntityInstanceList` / `BuiltinEntityCollectionPage`. A new `project` kind reuses these — satisfying the TZ requirement to use the same shared base UI components as Objects.

### D. The "PlayCanvas" template follows the one-c template precedent
- `one-c-compatible.template.ts` declares `presets: [{presetCodename, includedByDefault}, …]` and seeds per-kind settings via `buildObjectLikeSettings(kind, …)`. The PlayCanvas template would declare `project` + the base presets the MMOOMM config still uses (hub, page, object, set, enumeration) and seed analogous settings + the dashboard layout.
- Templates can seed default instances/content; adding a new template manifest is additive to `builtinTemplates`.

### E. The ONLY genuinely new platform capability is the PlayCanvas project binding / launch-editor surface
- `resourceSurfaces` are capability-bound: a surface maps to one of `ENTITY_RESOURCE_SURFACE_CAPABILITIES` (currently dataSchema→components, fixedValues→constants, optionValues→values). There is no existing capability/surface for "this entity instance is bound to a PlayCanvas project; open the Editor; publish the runtime."
- So a first-class "Projects → open Editor / publish" surface requires EITHER (Option A) a new generic capability (e.g. `externalProject` / `projectBinding`) added to the capability enum + `ENTITY_RESOURCE_SURFACE_CAPABILITIES` + a generic resource-surface renderer that embeds the existing PlayCanvas project create/list/open-editor/publish UI (reusing `playcanvasProjectsApi.ts`, the project panel, `PlayCanvasEditorHostPage`, and the editor host route), OR (Option B) modelling the link as a per-instance reference field + a custom action/module that opens the Editor. This is precisely the "if the constructor lacks functionality, add it" clause of the TZ.

### F. The PlayCanvas project store already exists and is the backing store for the binding
- The metahub-scoped PlayCanvas project store (`domains/playcanvas-projects`, `PlayCanvasProject` type) already holds scenes/assets/manifests. **QA-confirmed**: it is implemented as current-baseline metahub system tables — `_mhb_playcanvas_projects` (with a unique-active `codename`, `display_name`, `package_name`/`package_version`, `compatibility_status`, `settings`, `default_scene_id`, `publication_config`) plus `_mhb_playcanvas_{scenes,assets,script_assets,scene_script_bindings,generated_artifacts,sourcefiles,package_compatibility,publication_manifests}`.
- The store ALREADY carries exactly the anchor the prior storage-model research recommended: a stable metahub-scoped project `codename` + package compatibility metadata. A "Projects" entity instance becomes a 1:1 domain anchor to a `_mhb_playcanvas_projects` row (e.g. instance config holds the project `codename`/`id`). "Binding, not absorption" is preserved: scenes/assets/branches/checkpoints/version control stay inside the PlayCanvas project (vendor version-control docs confirm version control lives inside the project).
- Because the store is already baseline, NO new system table is strictly required for the binding if the link is stored in the Projects-instance's generic record/config (object-like instance) referencing the existing `codename`. This is what makes the user's "no structure-version bump" directive achievable.

### G. MMOOMM generator rework is bounded
- Current flow (`metahubs-mmoomm-app-export.spec.ts`): `createMetahubThroughBrowser` (default/basic template) → connect packages → `createPlayCanvasProjectThroughBrowser` (Packages panel) → open Editor / author scene / publish runtime → create Objects/Enumerations/Sets/Welcome Page/modules → configure layout → publish → export `metahubs-mmoomm-app-snapshot.json` via `exportMetahubSnapshotThroughBrowser`.
- Rework deltas: (1) metahub-create dialog selects the "PlayCanvas" template (template selection already exists for lms/1c); (2) replace `createPlayCanvasProjectThroughBrowser` (Packages panel) with creating a "Projects" entity-section instance that creates/binds the PlayCanvas project; (3) update `mmoommAppFixtureContract.ts` / `assertMmoommAppFixtureEnvelopeContract` to expect the `project`-kind entity type + binding in the snapshot; (4) the rest (Editor authoring, runtime modules, layout, runtime proof, export) is largely unchanged.

## Conflicts And Uncertainty

- The 2026-06-03 storage-model research concluded "a new built-in Platformo entity type is not justified" for that slice and preferred Object+Components+Modules links. The current TZ deliberately revisits this: it asks for a dedicated "Projects" entity-type SECTION. There is no hard conflict — the recommended path (object-like preset that maps to the Object surface + a binding capability) honours both: it is not a new builtin metadata KIND, and the binding is an explicit link, not absorption.
- Whether "Projects" should be object-like (records/components, a `proj_*` physical table) or a lean instance-only type is undecided. If it is NOT object-like and NOT a builtin kind, `resolveEntityMetadataKindFromType` returns null and instance storage/metadata surface is unresolved. Safest: make it object-like-minimal so it reuses generic instance storage, then layer the binding capability on top. PLAN must confirm the minimal capability set.
- **RESOLVED in this QA pass (user directive): no structure-version bump.** QA confirmed this is achievable: `CURRENT_STRUCTURE_VERSION = 1` and the PlayCanvas project store (`_mhb_playcanvas_projects` + siblings) is ALREADY a current-baseline system-table set. Adding an object-like `project` kind creates only per-instance `proj_*` data tables at runtime (no bump). The binding can reference the existing `_mhb_playcanvas_projects.codename` from the Projects-instance record/config, so no NEW system table is required. If PLAN ever did add a baseline system table, the `ADDITIVE_CURRENT_BASELINE_TABLE_NAMES` mechanism already adds tables to the current baseline without a bump — but the recommended path needs neither.
- Snapshot/publication hashing: a "Projects" instance and its binding must be represented in snapshot serialization and `publicationSnapshotHash.ts`, or reduced into existing hashed fields, so publication hashes change when the bound project/scene changes (per storage-model research). The `_mhb_playcanvas_publication_manifests` table + existing manifest hashing already cover the project's runtime content; the new piece is only the instance↔project link.
- The PlayCanvas Editor frontend is open-source but its backend is not; the Universo backend is a custom compatibility layer. Version-control REST endpoints are not exposed upstream (issue #498). Any automation of project versioning must go through the Universo backend, not upstream Editor APIs.
- **RESOLVED in this QA pass (user directive): DELETE the legacy "PlayCanvas projects" panel** under Resources/Packages — no legacy code retained, no dual creation surface. The Projects entity-section becomes the sole creation/open/publish surface. Because the test DB is recreated, the create/list/open/publish logic can be MOVED from `domains/packages` UI into the generic Projects resource-surface without a compatibility shim. PLAN must also remove the now-dead Packages-panel project code paths and any tests asserting them.

## Project Implications

- Add a `project` preset to `builtinEntityTypePresets` (a new `project.entity-preset.ts`), object-like-minimal capabilities, `sidebarSection: 'objects'`, `sidebarOrder` below 10 (e.g. 5), Tabler icon, `nameKey: 'metahubs:projects.title'`, EN/RU i18n + dialog titles, optional `resourceSurfaces` for the binding.
- Add a `playcanvas.template.ts` to `builtinTemplates`: presets `project` + hub/page/object/set/enumeration, seeded layout, per-kind settings analogous to `buildObjectLikeSettings`.
- Decide and implement the binding capability (Option A new generic capability + resource surface vs Option B reference field + action). Option A is the most "configurator-native" and matches the TZ but touches `@universo-react/types` (capability enum, `ENTITY_RESOURCE_SURFACE_CAPABILITIES`, dependency graph), backend validators (`TemplateManifestValidator`, `builtinKindCapabilities`), the generic resource-surface renderer, and parity/contract tests (`metahubsSchemaParityContract.test.ts`, `templateManifestValidator.test.ts`, `builtinKindCapabilities.test.ts`).
- Reuse the existing PlayCanvas project APIs/host (`playcanvasProjectsApi.ts`, `PlayCanvasEditorHostPage`, editor host route, publish-runtime endpoint) from inside the Projects surface; do not re-implement project storage (the `_mhb_playcanvas_*` baseline tables stay).
- Persist the Projects-instance ↔ PlayCanvas-project link by referencing the existing `_mhb_playcanvas_projects.codename`/`id` from the instance record/config; extend snapshot export/import/copy + publication hash to carry the link (no new system table → no structure-version bump).
- **DELETE the legacy Packages-panel project creation/list/publish surface** (`MetahubPackagesTab.tsx` PlayCanvas-projects section + the e2e `createPlayCanvasProjectThroughBrowser`/`publishPlayCanvasProjectThroughBrowser` paths) and any tests asserting it; move that logic into the generic Projects resource-surface. No back-compat shim (DB is recreated).
- Do NOT bump the metahub structure/template version; the new template + preset manifests are additive (each carries its own manifest `version`, independent of `CURRENT_STRUCTURE_VERSION`).
- Rework the MMOOMM generator + fixture contract (`mmoommAppFixtureContract.ts`, `assertMmoommAppFixtureEnvelopeContract`, plus `checkMmoommAppFixtureContract.ts` / `checkMmoommAppFixtureDrift.ts` / `mmoommAppSnapshotImport.ts`); regenerate `tools/fixtures/metahubs-mmoomm-app-snapshot.json` through the browser product flow only.
- Maintain runtime-UX rules (EN/RU, no raw UUIDs/JSON/paths) on the new Projects surface (skills `mui-runtime-ux-patterns`, `runtime-ux-qa`).

## Recommended Decision

Proceed to PLAN with: "Projects" as an object-like registered preset (the one-c precedent) seeded into a new "PlayCanvas" template, rendered through the generic entity UI and placed above Hubs via `sidebarOrder`; plus ONE new generic configurator capability (Option A) — a PlayCanvas/external-project binding + launch-editor/publish resource surface — that anchors each Projects instance to the existing `_mhb_playcanvas_projects` baseline store (1:1, by `codename`/`id`), without duplicating the store or its version control. DELETE the legacy Packages-panel project surface and move its create/open/publish logic into the Projects resource-surface (no back-compat shim; DB is recreated). Do NOT bump the structure/template version — the project store is already baseline and the link lives in the instance record/config. Then rework the MMOOMM generator + fixture contract on top of the new template and regenerate the snapshot through the browser flow.

## Open Questions Before PLAN

Resolved during this QA pass (user directives): legacy panel → DELETE; structure/template version → NO bump (achievable, the project store is already baseline); binding-storage location → instance record/config referencing existing `_mhb_playcanvas_projects` (no new system table). Remaining:

- Option A (new generic capability + resource surface) vs Option B (reference field + custom action) for the PlayCanvas binding? Recommended: Option A.
- Minimal capability set for "Projects": object-like-minimal (records/components/physicalTable) to reuse generic storage, or leaner? If leaner, how are instances stored and which metadata surface resolves?
- How is the Projects-instance ↔ PlayCanvas-project link represented in snapshot serialization and publication hashing (instance record vs a dedicated link field)?
- `sidebarSection`: reuse `'objects'` with `sidebarOrder < 10`, or introduce a dedicated section value (would require menu-grouping support)?
- Commit the regenerated `metahubs-mmoomm-app-snapshot.json` immediately, or stabilize in E2E output first?

## Sources

- `packages/universo-react-metahubs-backend/src/domains/templates/data/index.ts`
- `packages/universo-react-metahubs-backend/src/domains/templates/data/one-c-compatible.entity-presets.ts`
- `packages/universo-react-metahubs-backend/src/domains/templates/data/one-c-compatible.template.ts`
- `packages/universo-react-metahubs-backend/src/domains/templates/data/standardEntityTypeDefinitions.ts`
- `packages/universo-react-metahubs-backend/src/domains/shared/entityMetadataKinds.ts`
- `packages/universo-react-metahubs-backend/src/domains/entities/services/builtinKindBehaviorRegistry.ts`
- `packages/universo-react-metahubs-backend/src/domains/metahubs/services/systemTableDefinitions.ts`
- `packages/universo-react-metahubs-backend/src/domains/metahubs/services/structureVersions.ts`
- `packages/universo-react-types/src/common/entityTypeDefinition.ts`
- `packages/universo-react-metahubs-frontend/src/domains/metahubs/ui/MetahubList.tsx`
- `packages/universo-react-metahubs-frontend/src/domains/entities/ui/EntitiesWorkspace.tsx`
- `packages/universo-react-metahubs-frontend/src/domains/entities/ui/entityTypePreset.ts`
- `packages/universo-react-metahubs-frontend/src/menu-items/metahubDashboard.ts`
- `packages/universo-react-metahubs-frontend/src/domains/packages/` (`MetahubPackagesTab.tsx`, `playcanvasProjectsApi.ts`, `PlayCanvasEditorHostPage.tsx`)
- `packages/universo-react-metahubs-backend/src/domains/playcanvas-projects/`
- `packages/universo-react-types/src/common/playcanvasProjects.ts`
- `tools/testing/e2e/specs/generators/metahubs-mmoomm-app-export.spec.ts`
- `tools/testing/e2e/support/mmoommAppFixtureContract.ts`, `mmoommAppGeneratorData.*`, `mmoommPlaycanvasEditorAuthoring.*`
- `memory-bank/research/playcanvas-project-storage-model-for-metahubs-research-2026-06-03.md`
- `memory-bank/research/mmoomm-playcanvas-editor-main-functionality-runtime-projection-research-2026-06-10.md`
- `.agents/skills/universo-platform-architecture/SKILL.md`
- https://developer.playcanvas.com/user-manual/editor/projects/
- https://developer.playcanvas.com/user-manual/editor/version-control/
- https://developer.playcanvas.com/user-manual/editor/version-control/branches/
- https://developer.playcanvas.com/user-manual/editor/version-control/checkpoints/
- https://blog.playcanvas.com/playcanvas-editor-frontend-is-now-open-source/
- https://github.com/playcanvas/editor
