# Plan: PlayCanvas Metahub Template + "Projects" Entity Type, MMOOMM Snapshot Regeneration

> Created: 2026-06-17
> Status: Implemented (code complete 2026-06-17) — Phases 1–8 done; live Supabase + Playwright E2E run and fixture regeneration deferred to the next session. Backend full jest suite has 0 regressions from this branch; 2 new backend suites +12 tests green; `ProjectBindingPage` 4 component tests green; `MetahubPackagesTab` 16 tests green after panel removal. See `tasks.md` for the live-E2E checklist.
> Research input (required): `memory-bank/research/playcanvas-template-projects-entity-type-research-2026-06-17.md`
> Brief: MANAGER cross-project brief (tracked outside the repository, not readable by IMPLEMENT — facts surfaced below)
> Skills to load for IMPLEMENT: `universo-platform-architecture`, `mui-runtime-ux-patterns`, `runtime-ux-qa`, `nodejs-backend-patterns`, `playwright-best-practices`, `playcanvas-editor-authoring`, `react-best-practices`, `typescript-advanced-types`, `vitest`

## Overview

Introduce a first-class metahub entity-type section **"Projects"** (preset `kindKey: 'project'`) and a new metahub template **"PlayCanvas"**, both expressed through the existing preset/template/Entity-Type-Constructor mechanisms (no feature-specific hardcoding). A "Projects" instance binds 1:1 to a PlayCanvas Editor project in the existing `_mhb_playcanvas_*` baseline store. The "Projects" section sits **above "Hubs"** in the metahub left menu and renders through the same generic entity UI as Objects. The legacy "PlayCanvas projects" panel under Resources/Packages is **deleted** (no legacy code retained). Finally, the MMOOMM Playwright product generator is reworked to bootstrap from the "PlayCanvas" template and author the project through the "Projects" section, regenerating `tools/fixtures/metahubs-mmoomm-app-snapshot.json`.

Hard constraints (user directives): no structure/template version bump; test DB recreated (no back-compat shims); deep test system (Vitest/Jest + Playwright with real screenshots); full EN/RU i18n from day one; UUID v7; modern patterns (TanStack Query, shared `universo-react-types`/`utils`/`i18n`/`template-mui`); GitBook docs.

## Affected Areas

**Shared contracts (`packages/universo-react-types`)**
- `src/common/entityTypeDefinition.ts` — add `projectBinding` to capability enum + `ENTITY_RESOURCE_SURFACE_CAPABILITIES` + dependency graph.
- `src/common/playcanvasProjects.ts` — reuse existing project types; add a small `ProjectBindingConfig` type for the instance `config`.

**Backend (`packages/universo-react-metahubs-backend`)**
- `src/domains/templates/data/project.entity-preset.ts` (new), `playcanvas.template.ts` (new — no package-declaration field exists; presets + seed only), `index.ts` (register both).
- `src/domains/templates/data/standardEntityTypeDefinitions.ts` — `PROJECT_TYPE_CAPABILITIES` + `PROJECT_TYPE_UI` + names.
- `src/domains/entities/services/builtinKindCapabilities.ts`, `behaviorRegistry`/metadata-kind resolution — ensure `project` maps to the Object metadata surface.
- `src/domains/templates/services/TemplateManifestValidator.ts` — accept the new capability.
- Snapshot serialization (`SnapshotSerializer.ts`) + publication hash (`@universo-react/utils/serialization/publicationSnapshotHash.ts`) — carry the binding link.
- `src/domains/playcanvas-projects/*` — reuse as-is (no schema change).

**Frontend (`packages/universo-react-metahubs-frontend`)**
- `src/domains/entities/ui/` — generic resource-surface renderer gains a `projectBinding` surface (reuses `playcanvasProjectsApi`, `PlayCanvasEditorHostPage`).
- `src/domains/packages/ui/MetahubPackagesTab.tsx` — **delete** `PlayCanvasProjectsPanel` + its render branch; keep package connect/settings.
- `src/i18n/locales/{en,ru}` — `metahubs:projects.*` keys (move/rename from `packages.projects.*`).

**Shared i18n (`packages/universo-react-i18n`)** — only if cross-package keys are needed (default: keep in metahubs namespace).

**E2E + fixtures (`tools/`)**
- `tools/testing/e2e/specs/generators/metahubs-mmoomm-app-export.spec.ts` + support (`mmoommAppFixtureContract.ts`, `mmoommAppGeneratorData.ts`, `mmoommPlaycanvasEditorAuthoring.ts`, `checkMmoommAppFixtureContract.ts`, `checkMmoommAppFixtureDrift.ts`, `mmoommAppSnapshotImport.ts`).
- `tools/fixtures/metahubs-mmoomm-app-snapshot.json` (regenerated).
- New flow spec for the Projects section CRUD + binding.

**Docs** — `docs/en/platform/` + `docs/ru/platform/` (Projects entity type, PlayCanvas template), package READMEs.

## Architecture Decision: Option A — `projectBinding` capability + resource surface

Chosen over Option B (reference field + action) because it is the most "configurator-native" path (the TZ requires the type to be reproducible through the constructor UI), keeps the binding generic (any future entity type / external system can reuse it), and slots into the existing `resourceSurfaces` renderer.

Key shape (illustrative, to refine in IMPLEMENT):

```ts
// packages/universo-react-types/src/common/entityTypeDefinition.ts
export const ENTITY_RESOURCE_SURFACE_CAPABILITIES = ['dataSchema', 'fixedValues', 'optionValues', 'projectBinding'] as const

export interface ProjectBindingCapabilityConfig {
    enabled: true
    // which package authoring surface backs the binding; generic, not PlayCanvas-only
    provider: 'playcanvasEditor'
    // allow exactly one bound project per instance (1:1 anchor)
    cardinality: 'single'
}
```

```ts
// Instance-level binding stored in the generic entity-instance `config` (no new system table)
export interface ProjectBindingInstanceConfig {
    projectBinding?: {
        provider: 'playcanvasEditor'
        // stable anchor into _mhb_playcanvas_projects (codename is unique-active; id is UUID v7)
        projectCodename: string
        projectId?: string | null
    }
}
```

The binding lives in the Projects-instance `config` (the entity-instance API already accepts `config: Record<string, unknown>`), referencing the existing `_mhb_playcanvas_projects.codename`. No new table, no structure-version bump.

## UI Contract (Runtime UI UX Quality Gate)

Per `.agents/skills/mui-runtime-ux-patterns`. The "Projects" section reuses the generic entity surfaces, so it inherits their compliant contracts; the only new surface is the `projectBinding` resource tab.

**Projects list (section "Projects", `/metahub/:id/entities/project/instances`)**
- Renders through `EntityInstanceList` / `BuiltinEntityCollectionPage` — same primitive as Objects. Columns: `#`, Name (localized), Description (localized, normal wrap), updated-at. No raw UUIDs/JSON in cells.
- Create/Edit dialog: `EntityFormDialog` (same as Objects). Fields: Name (localized inline), Codename (auto from name, codename policy), Description (multiline). No raw `*Id` fields exposed.
- Localized validation via existing `crud.*` / `entities.validation.*` keys.

**Project Binding resource tab (`/metahub/:id/entities/project/instance/:instanceId/project`)** — NEW
- Controls: a single "PlayCanvas project" card showing project display name (localized), status chip (Ready/Needs attention/Compatibility), scene/asset/script counts (already provided by `PlayCanvasProjectSummary`), and actions **Open editor**, **Publish runtime**, **Unbind**. If no project bound: a "Create & bind project" primary action that creates a `_mhb_playcanvas_projects` row and writes the binding into instance `config`.
- Display values: project name + counts + status chip — no raw `projectId`/`projectCodename` UUIDs on the normal surface (codename may appear only as a small monospace technical caption, like existing codename display, not as an editable field).
- Hidden/system-owned: `projectId` (UUID v7), runtime manifest checksums, file paths — never rendered raw.
- Defaults: provider `playcanvasEditor`; project codename derived from the instance codename on create-and-bind.
- Localized validation: bind/create/publish errors use `metahubs:projects.*` localized messages (EN/RU), never raw Zod/protocol text.
- Responsive: card stacks on `xs`; "Open editor" opens the existing editor host route (embedded or separate per package display settings). Proven at `1920x1080`, `768x1024`, `390x844` with screenshots.
- Reuse: the editor-open + publish logic is **moved** out of `MetahubPackagesTab` `PlayCanvasProjectsPanel` into this surface; no new bespoke widgets beyond the binding card.

**Removed surface**: the Resources/Packages "PlayCanvas projects" panel (create/list/default/publish/delete) is deleted; package connect/version/settings stays.

## Plan Steps

### Phase 0 — Branch, baseline, local Supabase E2E up
- [ ] Create a feature branch (not default branch).
- [ ] Bring up minimal local Supabase for E2E and capture a clean baseline: `pnpm supabase:e2e:start:minimal`, then `pnpm env:e2e:local-supabase`, then `pnpm run build:e2e`. Confirm the current MMOOMM generator passes before changes (`test:e2e:mmoomm-app-gate:local-supabase`) so the rework delta is isolated.
- [ ] Snapshot the current metahub left menu + Resources/Packages PlayCanvas panel with Playwright screenshots (before-state evidence).

### Phase 1 — Shared contract: `projectBinding` capability (types)
- [ ] In `packages/universo-react-types/src/common/entityTypeDefinition.ts`: add `projectBinding` to `ENTITY_RESOURCE_SURFACE_CAPABILITIES`, the capability union, `ENTITY_CAPABILITY_KEYS`, `CAPABILITY_DEPENDENCIES` (depends on nothing structural — it is an independent surface), and the resource-surface default (`getDefaultEntityResourceSurfaceDefinition`). Add `ProjectBindingCapabilityConfig` + `ProjectBindingInstanceConfig` types. Keep PlayCanvas naming out of the generic enum (`provider` field carries it).
- [ ] **Constructor-UI parity (central TZ thesis — "as if a user built it through the configurator"):** thread `projectBinding` through the Entity Type Constructor in `EntitiesWorkspace.tsx`. `normalizeEntityTypeCapabilitiesForBuilder` builds a FIXED-key manifest — an unknown capability is silently dropped. The new capability must be (a) added to that normalizer, (b) added to `getDefaultEnabledComponent`, (c) rendered as a capability toggle, and (d) surfaced as a `resourceSurfaces` row the user can title. Without this, the preset is config-native but NOT reproducible in the UI, which is the brief's headline proof.
- [ ] Unit tests (Vitest): capability is recognized by `isEntityResourceSurfaceCapability`, default surface resolves, dependency validation passes, AND `normalizeEntityTypeCapabilitiesForBuilder` preserves `projectBinding` (round-trip), AND `buildEntityTypePresetFormPatch` maps the `project` preset into form values including the binding surface.
- [ ] Build `@universo-react/types` (dual CJS/ESM) and downstream typecheck.

### Phase 2 — Backend preset + template manifests
- [ ] `standardEntityTypeDefinitions.ts`: add `STANDARD_PROJECT_NAME/DESCRIPTION` (EN "Projects"/RU "Проекты"), `PROJECT_TYPE_CAPABILITIES` (object-like-minimal: `dataSchema` + `records` + `physicalTable{prefix:'proj'}` so it maps to the OBJECT metadata surface and reuses generic instance storage, plus `modules`, `layoutConfig`, `runtimeBehavior`; `projectBinding: { enabled, provider:'playcanvasEditor', cardinality:'single' }`), `PROJECT_TYPE_UI` (`iconName: 'IconBox3d'` or similar, `sidebarSection: 'objects'`, `sidebarOrder: 5` → above Hub=10, `nameKey: 'metahubs:projects.title'`, `resourceSurfaces: [projectBindingSurface]`).
- [ ] `project.entity-preset.ts` (mirror `object.entity-preset.ts`): `codename: 'project'`, `kindKey: 'project'`, presentation + dialog titles (EN/RU), `defaultInstances: []` (template seeds, not the preset).
- [ ] `playcanvas.template.ts` (mirror `one-c-compatible.template.ts`): `codename: 'playcanvas'`, presets `[project, hub, page, object, set, enumeration]` (`project` first/default), seed dashboard layout via `buildBasicMinimalSeedZoneWidgets`, per-kind settings (`buildObjectLikeSettings('project')`).
  - **QA correction:** `MetahubTemplateManifest` has NO package-declaration field (only `presets` + `seed`; verified in `packages/universo-react-types/src/common/metahubs.ts`). A template CANNOT declare PlayCanvas/Colyseus package attachments. Package connection stays a runtime step in the metahub (the generator keeps connecting packages through the Resources UI, exactly as today). Do NOT add a package field to the manifest in this plan — that would be a contract change outside scope. If "recommended packages" must be surfaced, document them in `meta`/docs only, not as a functional attachment declaration.
- [ ] Register both in `index.ts` (`builtinEntityTypePresets`, `builtinTemplates`).
- [ ] Confirm `resolveEntityMetadataKindFromType` maps `project` → OBJECT (it already does for object-like template-managed kinds; add a focused unit test).
- [ ] `TemplateManifestValidator` + `builtinKindCapabilities` accept `projectBinding`; update `templateManifestValidator.test.ts`, `builtinKindCapabilities.test.ts`, `metahubsSchemaParityContract.test.ts`.

### Phase 3 — Backend binding wiring + snapshot/publication
- [ ] Ensure the generic entity-instance create/update accepts the `projectBinding` config (it already passes `config` through; add validation that `projectCodename` references an existing `_mhb_playcanvas_projects` row in the same metahub branch, request-scoped `DbExecutor`, parameterized SQL).
- [ ] On create-and-bind: create the `_mhb_playcanvas_projects` row (UUID v7 default already in the table) with codename derived from the instance, then write the binding into instance `config` in the same request (transactional).
- [ ] On unbind/delete instance: define behavior (unbind leaves the project; instance delete optionally cascades — default: unbind only, project removal stays an explicit action to avoid accidental data loss). Document the choice.
- [ ] Snapshot serialization carries instance `config.projectBinding`; publication hash (`publicationSnapshotHash.ts`) includes the bound project's manifest (already hashed via `_mhb_playcanvas_publication_manifests`) — add the instance→project link to the hashed set so re-binding changes the hash. Unit tests in `SnapshotSerializer.test.ts`.

### Phase 4 — Frontend: generic `projectBinding` resource surface
- [ ] Add a generic `ProjectBindingSurface` under `domains/entities/.../resource-surfaces` rendered as a resource tab when an entity type has the `projectBinding` capability (parallel to Components/Constants/Values tabs). It reuses TanStack Query + `playcanvasProjectsApi` and the editor host route.
  - **QA note:** resource-surface rendering in `EntityInstanceListContent.tsx` is NOT fully metadata-generic — it branches on `capability === 'dataSchema'` with fallback route segments (verified). So the `projectBinding` tab needs explicit wiring: a route segment (default `project`), a tab-visibility flag (`showProjectBindingTab` from `isEnabledCapabilityConfig(capabilities.projectBinding)`), the tab label from the `resourceSurfaces` entry, and a registered route → `ProjectBindingSurface`. Follow the existing `SharedResourcesPage`/`dataSchemaSurface` pattern; do not invent a parallel router.
- [ ] Card UI per UI Contract: bound-project card (name, status chip, counts) with **Open editor** / **Publish runtime** / **Unbind**; empty state with **Create & bind project**. All strings via `metahubs:projects.*` (EN/RU). Use `template-mui` primitives (`StandardDialog`, `ConfirmDeleteDialog`, `EmptyListState`, `FlowListTable` where a list is needed).
- [ ] Wire create-and-bind: call backend create-and-bind, optimistic cache update, localized snackbars (`notistack`).
- [ ] Vitest component tests: empty→create→bound transitions, open-editor route, publish success/failure, unbind, no raw IDs leaked.

### Phase 5 — Delete legacy Packages PlayCanvas panel
- [ ] Remove `PlayCanvasProjectsPanel` from `MetahubPackagesTab.tsx` and its render branch (lines ~1005–1024) + the now-unused `settingsProjectsQuery` default-project picker if it is fully superseded (keep package display-mode settings; the "default project" concept moves to the Projects section binding).
- [ ] Move `playcanvasProjectsApi` usage to the entities domain (or keep shared in `domains/shared` if reused); delete dead imports.
- [ ] Remove `packages.projects.*` i18n keys that are no longer referenced; relocate needed ones to `metahubs:projects.*`. Keep EN/RU in lockstep.
- [ ] Delete or rewrite tests asserting the old panel (`MetahubPackagesTab.test.tsx` PlayCanvas-projects cases).
- [ ] Grep for `PlayCanvasProjectsPanel`, `packages.projects.`, `createPlayCanvasProjectThroughBrowser` to confirm no dangling references.

### Phase 6 — MMOOMM generator + fixture regeneration
- [ ] `metahubs-mmoomm-app-export.spec.ts`: in `createMetahubThroughBrowser`, select the "PlayCanvas" template via the existing `TemplateSelector`; replace `createPlayCanvasProjectThroughBrowser` (Packages panel) with a new `createProjectInstanceAndBind` helper that goes to `/entities/project/instances`, creates an instance, opens its Project Binding tab, and does Create & bind. Keep Editor authoring/publish/runtime-proof/export.
- [ ] Update `mmoommAppGeneratorData.ts` (project/section codenames), `mmoommPlaycanvasEditorAuthoring.ts` (navigation to the binding surface), and `mmoommAppFixtureContract.ts` / `assertMmoommAppFixtureEnvelopeContract` to require the `project` entity type + `config.projectBinding` in the snapshot. Update `checkMmoommAppFixtureContract.ts`, `checkMmoommAppFixtureDrift.ts`, `mmoommAppSnapshotImport.ts`.
- [ ] Regenerate the fixture through the browser flow only: `UPDATE_MMOOMM_APP_FIXTURE=1 ... test:e2e:mmoomm-app-gate:local-supabase`. Never hand-edit `metahubs-mmoomm-app-snapshot.json`.
- [ ] Decision: commit the regenerated fixture after QA stabilizes the flow (generate in E2E output first, commit once green twice).

### Phase 7 — Deep test system + screenshots
- [ ] **Vitest/Jest (unit/component)**: types capability (Phase 1), preset/template manifests + metadata-kind mapping + validators (Phase 2), backend binding validation + snapshot/hash (Phase 3), `ProjectBindingSurface` component (Phase 4). Target meaningful coverage of all new code paths.
- [ ] **Playwright (E2E, browser-truth)**: new flow spec `metahub-projects-section.spec.ts` — create a PlayCanvas-template metahub, open the Projects section (assert it sits **above Hubs** in the left menu via DOM order + screenshot), create an instance, Create & bind a project, Open editor (iframe loads), Publish, verify no raw UUID/JSON leakage (`expectNoTechnicalLeakage`), responsive matrix screenshots (`1920x1080`, `768x1024`, `390x844`).
- [ ] **Screenshots are evidence, not decoration**: capture and visually verify the Projects list, the binding card (bound + empty), the menu ordering, and the regenerated runtime. Do not claim UI correctness without looking at the images.
- [ ] **Supabase data check**: via Playwright/API session, assert the `_mhb_playcanvas_projects` row exists and the instance `config.projectBinding.projectCodename` matches.
- [ ] **Constructor-UI reproducibility E2E (TZ headline proof)**: a spec that opens the Entity Type Constructor, creates a custom type, enables the `projectBinding` capability toggle, sets its resource-surface title, saves, and verifies the new type renders a working binding tab — proving the preset is reproducible by a user, not just shipped as a manifest.
- [ ] Run `plan-ux-reviewer` checklist against the implemented surfaces.

### Phase 8 — Docs (GitBook) + READMEs + closeout
- [ ] `docs/en/platform/` + `docs/ru/platform/`: a "Projects entity type" page (what it is, how it binds to PlayCanvas, screenshots) and a "PlayCanvas template" page; cross-link from `playcanvas-projects.md` / `playcanvas-editor.md`. Keep EN/RU in lockstep (docs-i18n-check).
- [ ] Update affected package READMEs (`universo-react-metahubs-backend`, `-frontend`, `universo-react-types`) and `tools/testing/e2e` docs for the new generator flow.
- [ ] Update `memory-bank/tasks.md` + `progress.md`; Canon Refresh if package/architecture facts changed.
- [ ] Run lint + build + full affected test suites; ensure docs-i18n-check passes.

## Potential Challenges

- **Metadata-kind mapping precision**: `resolveEntityMetadataKindFromType` → `isTemplateManagedObjectLikeType` maps to OBJECT iff `dataSchema + records + physicalTable` are ON and `optionValues + fixedValues + blockContent` are OFF (verified). `modules`, `layoutConfig`, `runtimeBehavior`, and the new `projectBinding` are NOT part of that check, so the extended `PROJECT_TYPE_CAPABILITIES` set is SAFE for OBJECT mapping. Mitigation: mirror the one-c `objectLikeCapabilities` shape and keep option/fixed/block OFF; add a direct unit test asserting `project → OBJECT`.
- **`sidebarOrder` collision/grouping**: `sidebarOrder: 5` places Projects above Hub(10) within the same `'objects'` section. Confirm the menu sorts purely by order and no separate grouping is needed (research says yes). If a visual divider above Hubs is desired, that is a follow-up, not this plan.
- **Binding integrity**: instance config references a project codename that could be deleted. Mitigation: server-side validation on bind; localized "project no longer available" state on the surface; unbind action. No FK (config is JSON), so validation is at the service layer.
- **Publication hash coverage**: if the instance→project link is not hashed, re-binding wouldn't change the release hash. Mitigation: explicit hash inclusion + a regression test that re-binding changes the hash.
- **Legacy deletion fallout**: removing `PlayCanvasProjectsPanel` may break tests/imports and the package "default project" config. Mitigation: grep sweep + move the default-project concept to the binding; DB is recreated so no migration of old `defaultProjectId` config is required.
- **E2E flakiness (iframe + canvas + Colyseus)**: the Editor host is an iframe and runtime uses WebGL/Colyseus. Mitigation: reuse the proven helpers (`expectPlayCanvasEditorIframeLoaded`, `expectMmoommRuntimeReady`), role/testid locators per `playwright-best-practices`, generous timeouts already in the spec.
- **i18n lockstep**: docs-i18n-check enforces EN/RU parity. Mitigation: add RU keys/pages in the same commits as EN.
- **PlayCanvas version control stays inside the project (guardrail, research Conflicts #5 / upstream issue #498)**: the upstream Editor backend is not open; branches/checkpoints/merging live inside the PlayCanvas project. Any project-version automation must route through the Universo compatibility backend, never upstream Editor REST. The binding must NOT try to mirror or duplicate PlayCanvas version control into the metahub instance.
- **Constructor-UI reproducibility is a first-class acceptance item, not an afterthought**: `normalizeEntityTypeCapabilitiesForBuilder` drops unknown capabilities. If `projectBinding` is not threaded through the constructor (Phase 1), the brief's headline proof fails silently — the manifest works but a user cannot rebuild it in the UI. Mitigation: the Phase 7 E2E asserts a user can author a `projectBinding`-capable type through the configurator.

## Dependencies

- Local minimal Supabase for all E2E/Playwright phases (`pnpm supabase:e2e:start:minimal`); Playwright CLI runs without `pnpm dev`.
- Existing PlayCanvas Editor packages + `_mhb_playcanvas_*` baseline tables (unchanged).
- Shared packages build order: `universo-react-types` → backend/frontend (TanStack Query, `template-mui`, `i18n`, `utils`).
- No structure/template version bump; manifests are additive.

## Suggested Phase Ordering / Milestones

1. **Contract + backend** (Phases 1–3): types, preset, template, binding, snapshot — green unit tests.
2. **Frontend surface + legacy delete** (Phases 4–5): Projects section binding tab live; old panel gone.
3. **Generator + fixture** (Phase 6): MMOOMM rebuilt on the new template; fixture regenerated.
4. **Tests + docs** (Phases 7–8): deep tests, screenshots, GitBook docs, closeout.

Single PR is acceptable since the DB is recreated and there is no back-compat burden; if CI must stay green at each step, land Phases 1–3 first (additive, no UI removal), then 4–6 together (UI swap), then 7–8.
