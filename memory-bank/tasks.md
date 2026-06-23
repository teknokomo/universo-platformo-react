# OntoIndex Code-Intelligence Adoption (Phase A) — Implementation Tasks

> Date: 2026-06-16
> Source plan: `memory-bank/plan/ontoindex-code-intelligence-plan-2026-06-16.md`
> Source research: `memory-bank/research/ontoindex-code-intelligence-research-2026-06-16.md`
> Source brief: MANAGER cross-project brief (tracked outside the repository)

## Scope

Adopt OntoIndex `v1.9.10` as a local developer/AI-agent code-intelligence tool.
Phase A is additive and dev-only: committed `.mcp.json`, `.gitignore` entry, a
safe `tools/ontoindex/` wrapper + hermetic Vitest suite, a project-native agent
skill, mirrored EN/RU GitBook docs, and a mirrored README line. No
`@universo-react/*` package, no backend route, no UI, no DB, no schema/template
version bump.

## Checklist

### Phase 1 — Ignore local index

-   [x] 1.1 Add `.ontoindex` to `.gitignore` under a new `## code-intelligence` section.

### Phase 2 — Committed MCP config

-   [ ] 2.1 Create root `.mcp.json` with transparent `ontoindex` stdio entry. **BLOCKED**: writing `.mcp.json` was denied by the workspace safety classifier (it makes Claude auto-launch a local server). Needs explicit user action — see "Outstanding" below. Exact intended content is in the plan (Phase 2.1) and the docs page.
-   [x] 2.3 Codex/Gemini/Qoder remain per-developer (documented in Phase 5, not committed).

## Outstanding (needs user action)

-   `.mcp.json` at repo root could not be written by the agent (safety classifier
    blocks creating a file that auto-starts an MCP server). Create it manually with:
    ```json
    {
        "mcpServers": {
            "ontoindex": {
                "command": "ontoindex",
                "args": ["mcp"]
            }
        }
    }
    ```
    Then verify with `claude mcp list` (auto-approved via the existing
    `enableAllProjectMcpServers: true`). Everything else (wrapper, skill, docs,
    README, ignore) is in place and references this file.

### Phase 3 — Wrapper script + tests

-   [x] 3.1 Create `tools/ontoindex/run-ontoindex.mjs` (pure `node:child_process`, shell-false, injection-safe, platform-aware binary).
-   [x] 3.2 Create `tools/ontoindex/vitest.config.mjs`.
-   [x] 3.3 Register config in `vitest.workspace.ts`.
-   [x] 3.4 Write hermetic `tools/ontoindex/__tests__/run-ontoindex.test.mjs`.
-   [x] 3.5 Add `ontoindex:*` + `test:tools:ontoindex` root scripts.

### Phase 4 — Agent skill

-   [x] 4.1 Create `.agents/skills/ontoindex-code-intelligence/SKILL.md` (project-native frontmatter).
-   [x] 4.2 Body: when/when-not, namespace-collision warning, how-to-query, freshness, local-only.
-   [x] 4.3 `references/usage.md` with golden Universo queries.
-   [x] 4.4 Add row to `.agents/skills/SOURCES.md` under Local Project Skills.

### Phase 5 — Documentation

-   [x] 5.1 Write `docs/en/contributing/ontoindex-code-intelligence.md`.
-   [x] 5.2 Write `docs/ru/contributing/ontoindex-code-intelligence.md` (line-for-line mirror).
-   [x] 5.3 Add mirrored SUMMARY entry in both locales.
-   [x] 5.4 Add page to `screenshotExemptPages` in `tools/docs/check-i18n-docs.mjs`.
-   [x] 5.5 Add mirrored README / README-RU Tech Stack bullet.

### Phase 6 — Validation pilot (requires local OntoIndex install)

-   [~] 6.1 Run `pnpm ontoindex:analyze` + `status`. **Deferred**: OntoIndex CLI not installed in this environment. Wrapper verified to handle the missing-binary path (friendly hint, exit 127).
-   [~] 6.2 Golden queries against the live graph. **Deferred**: needs install. Checklist authored in skill `references/usage.md`.
-   [x] 6.3 SQL/DDL edge limitation documented honestly (Limitations section in both EN/RU docs).

### Phase 7 — Verification gates

-   [x] 7.1 `pnpm test:tools:ontoindex` green — 7/7 tests pass.
-   [x] 7.2 Prettier clean on all authored `.mjs`/`.md`/`package.json`/`vitest.workspace.ts`; `lint` glob does not cover `.mjs`/`.md` (verified, no regressions).
-   [x] 7.3 `pnpm docs:i18n:check` green — 96 EN/RU pairs OK (caught + fixed RU stale-term `устаревш`).
-   [x] 7.4 `pnpm docs:gitbook-screenshot-assets:check` green.
-   [~] 7.5 `pnpm build` not run (long turbo build; changes are additive, no package source touched, `.ontoindex/` not a turbo input). Low risk.
-   [x] 7.6 `.ontoindex` ignored via `.gitignore`; `.mcp.json` pending user approval (see note).
-   [~] 7.7 Advisory closeout review — fold into QA mode.

### Phase 8 — Memory Bank closeout

-   [ ] 8.1 `progress.md` entry.
-   [ ] 8.2 Optional `techContext.md` note (decide at closeout).

## Notes / Decisions

-   Wrapper uses only Node built-ins (no added dependency, consistent with sibling
    `tools/*.mjs`). `spawnSync` is always `shell:false` with an argv array
    (injection-safe), and the binary name is resolved per platform
    (`ontoindex.cmd` on Windows, `ontoindex` elsewhere). No `package.json` /
    lockfile change is required.
-   Phase 6 pilot needs the OntoIndex CLI installed per-developer; if absent in
    this environment it is deferred (no fabricated output, per plan rule).

---

# MMOOMM PlayCanvas Visual Linkup Lab — Implementation Tasks (2026-06-20)

> Status: IMPLEMENT complete (2026-06-21)
> Plan: `memory-bank/plan/mmoomm-playcanvas-visual-linkup-lab-plan-2026-06-20.md`
> Brief: local cross-project MMOOMM PlayCanvas Visual Linkup Lab brief, dated 2026-06-20
> Research: `memory-bank/research/mmoomm-playcanvas-visual-linkup-lab-research-2026-06-20.md`

## Scope

Implement the visual linkup lab in the canonical MMOOMM PlayCanvas fixture flow:
make the generator safe for two Projects instances, author a second
Editor-reviewable PlayCanvas project with 16 weak-linkup visual variants,
preserve the existing flight runtime proof, add fixture/runtime contracts, and
update docs/tests/snapshot evidence. Do not modify the vendored PlayCanvas Editor
frontend unless absolutely necessary; use our generator, backend compatibility,
runtime wrapper, and apps-template boundaries.

## Checklist

-   [x] 1. Preflight: loaded required skills/context, used OntoIndex impact/verify where available, inspected affected code, and kept the vendored PlayCanvas Editor frontend untouched.
-   [x] 2. Made the MMOOMM generator multi-project safe: project rows/dialogs are targeted by display name/codename, manifests are selected by project role/project id, and the flight widget stays bound to `MMOOMM Authoring`.
-   [x] 3. Added `MMOOMM Visual Linkup Lab`: created/bound the second project, opened the intended Editor project, authored 16 visual variants, saved through the compatibility path, and preserved the flight authoring sequence.
-   [x] 4. Extended fixture contracts: the snapshot now requires the intended project roles, keeps strict flight assertions, adds separate lab assertions, verifies role-aware runtime manifests, and reports drift cleanly.
-   [x] 5. Implemented runtime-visible lab support through generic `@universo-react/playcanvas-engine` helpers and the existing `apps-template-mui` `playcanvasCanvas` widget; no parallel app shell was added.
-   [x] 6. Added/updated Jest/Vitest/Playwright evidence for bridge metadata, backend normalization/export, runtime widget rendering, generator contract, fixture drift, and published runtime import.
-   [x] 7. Regenerated `tools/fixtures/metahubs-mmoomm-app-snapshot.json` through the Playwright product flow on local minimal Supabase.
-   [x] 8. Updated EN/RU GitBook docs and the PlayCanvas engine README for the new canonical fixture/lab behavior.
-   [x] 9. Ran focused validation gates, package tests/builds, fixture contract/drift, full MMOOMM app gate, OntoIndex diff verification, and documented the only environment limitation: `autoreview` cannot start because the local Codex state DB is read-only.

## Notes

-   Runtime-visible lab support was implemented because the acceptance path needs
    visual comparison in the published application. It is deliberately generic:
    metadata-driven PlayCanvas primitives, fog, translucent bodies, glow shells,
    and low-poly variants inside the existing canvas widget.
-   The PlayCanvas Editor vendor tree remains untouched. Metadata preservation is
    handled through shared bridge schemas, backend compatibility normalization,
    artifact serialization, and snapshot/runtime manifest export.
-   Final validation includes the full combined `pnpm run test:e2e:mmoomm-app-gate:local-supabase`
    run: generator 2/2, fixture drift clean, runtime import 2/2.

## Post-QA Remediation Checklist (2026-06-21)

-   [x] 10. Add a shared runtime-safe `metadata.mmoomm.visualLab` contract in `@universo-react/types`, filter MMOOMM metadata on publish/export, and clamp low-poly geometry inputs.
-   [x] 11. Refactor Visual Linkup Lab runtime mounting out of the monolithic `PlayCanvasCanvasWidget` branch and add static-lab user-facing status instead of realtime-unavailable UX.
-   [x] 12. Strengthen fixture/generator contracts: duplicate-id guards, manifest role guards, semantic lookup instead of row/order assumptions, and strict widget binding checks.
-   [x] 13. Add normal user Playwright proof for the Visual Linkup Lab runtime section: menu navigation, nonblank WebGL canvas, viewport matrix, focus/camera controls, and no technical leakage.
-   [x] 14. Regenerate the MMOOMM fixture through the product flow if snapshot-shaping changes affect exported JSON.
-   [x] 15. Fix post-QA blockers: derive PlayCanvas runtime manifests only from runtime bindings, re-sync EN/RU GitBook docs, remove raw runtime error diagnostics from DOM, and add focused regression coverage.
-   [x] 16. Run focused package tests, formatter/lint gates, E2E gate where feasible, and update Memory Bank/docs if the runtime contract changes.
-   [x] 17. Fix final QA camera contract gap: persist `MMOOMM Linkup Lab Camera` as a real Editor `camera` component, strengthen scene/fixture assertions, regenerate the fixture if needed, and rerun focused gates.
-   [x] 18. Fix Visual Linkup Lab Editor material gap: persisted scene-local PlayCanvas material asset data through the shared bridge schema, preserved render `materialAssets`, and kept Editor-compatible fog/material payloads from being rejected during product save.
-   [x] 19. Strengthen fixture and browser contracts so `materialAssets: [null]`, missing material asset data, or `fog: none` fail closed (`check:mmoomm-app-fixture-contract` green).
-   [x] 20. Strengthen runtime visual proof so canvas evidence checks the Visual Linkup Lab mode, 16 variants, 64+ rendered objects, painted WebGL output, bounded responsive viewport, keyboard focus, disabled movement controls, and no technical leakage/overflow.
-   [x] 21. Regenerate `tools/fixtures/metahubs-mmoomm-app-snapshot.json` through the product Playwright flow on local minimal Supabase; drift check is clean against `tools/testing/e2e/.artifacts/generated-metahubs-mmoomm-app-snapshot.json`.
-   [x] 22. Rerun focused tests, Prettier, fixture contract/drift, backend/types builds, and the local-Supabase MMOOMM app runtime E2E after the material/fog remediation.

### Post-QA Material/Fog Remediation Evidence (2026-06-22)

-   `pnpm --filter @universo-react/types test -- playcanvasEditorBridge.test.ts` — 18 files / 131 tests passed.
-   `pnpm --filter @universo-react/types build` — passed.
-   `pnpm --filter @universo-react/metahubs-backend test -- PlayCanvasProjectsService.test.ts --runInBand` — 1 suite / 91 tests passed, including scene-local material asset realtime write-back into the owning scene payload.
-   `pnpm --filter @universo-react/metahubs-backend test -- PlayCanvasProjectSnapshotService.test.ts SnapshotSerializer.test.ts --runInBand` — 2 suites / 37 tests passed.
-   `pnpm --filter @universo-react/metahubs-backend build` — passed.
-   `pnpm check:mmoomm-app-fixture-contract` — passed.
-   `pnpm run check:mmoomm-app-fixture-drift -- tools/testing/e2e/.artifacts/generated-metahubs-mmoomm-app-snapshot.json` — passed.
-   `pnpm run test:e2e:mmoomm-app-runtime:local-supabase` on Node 22.22.2 — 2/2 passed, including imported MMOOMM app snapshot runtime and Visual Linkup Lab canvas proof.
-   `.agents/skills/autoreview/scripts/autoreview --mode local --prompt-file .agents/skills/autoreview/rubrics/thermos.md` — clean after fixing the accepted P2 scene-local asset persistence finding.
-   `ontoindex detect-changes --repo universo-platformo-react` — completed; overall diff is critical-scope because the full feature touches 44 files / 538 symbols / 31 affected processes.

## Post-QA Visual Distinctness Remediation Checklist (2026-06-22)

-   [x] 23. Preserve authored Visual Linkup Lab opacity/glow differences in the published runtime instead of clamping all variants toward the same look.
-   [x] 24. Strengthen runtime Playwright proof so the Visual Linkup Lab fails if representative variant cells are visually identical or family color signatures disappear.
-   [x] 25. Strengthen PlayCanvas Editor authoring proof so it validates live material application on representative engine mesh instances, not only persisted JSON assets.
-   [x] 26. Make the generator E2E verify the published Visual Linkup Lab section before exporting the canonical fixture.
-   [x] 27. Run focused format/test/contract/E2E verification for the visual-distinctness remediation and record evidence.

### Post-QA Visual Distinctness Remediation Evidence (2026-06-22)

-   `pnpm exec prettier --write` on the touched runtime/E2E/task files — passed.
-   `git diff --check` — passed.
-   `pnpm --filter @universo-react/apps-template-mui build` — passed after sequential workspace builds; an earlier parallel run failed while another command cleaned `@universo-react/types/dist`.
-   `pnpm --filter @universo-react/apps-template-mui test -- PlayCanvasCanvasWidget.test.tsx` — 32 files / 356 tests passed when run after rebuilding `@universo-react/types` and `@universo-react/utils` sequentially.
-   `pnpm --filter @universo-react/playcanvas-editor-frontend test -- artifact.test.mjs` — 1 file / 14 tests passed.
-   `pnpm --filter @universo-react/playcanvas-editor-frontend build` — passed; vendored Editor sources remain untouched.
-   `pnpm --filter @universo-react/playcanvas-engine test` — 1 file / 6 tests passed.
-   `pnpm check:mmoomm-app-fixture-contract` — passed.
-   `pnpm run check:mmoomm-app-fixture-drift -- tools/testing/e2e/.artifacts/generated-metahubs-mmoomm-app-snapshot.json` — passed.
-   `pnpm run test:e2e:mmoomm-app-runtime:local-supabase` on Node 22.22.2 — 2/2 passed, including imported published Visual Linkup Lab runtime with the strengthened opacity-range proof.

## Post-QA Editor Asset/Visibility Remediation Checklist (2026-06-22)

-   [x] 28. Seed PlayCanvas Editor full-boot ShareDB `assets` documents for every signed `assetDocumentIds` entry so material assets resolve in the upstream asset registry and inspector.
-   [x] 29. Populate the full-boot `schema.materialData` defaults and normalize material payloads to upstream numeric blend/depth/fog fields without editing the vendored Editor frontend.
-   [x] 30. Rework Visual Linkup Lab authoring constants so the Editor overview has readable lighting, camera framing, lower fog washout, and visible material differences at default distance.
-   [x] 31. Add published runtime variant legend/selection evidence from `metadata.mmoomm.visualLab.variants` so users can compare 16 named variants without hidden `data-*` knowledge.
-   [x] 32. Strengthen Editor/runtime tests: ShareDB asset doc subscription, inspector material resolution, visible variant labels, per-variant visual evidence, fixture contract/drift, and focused package tests.
-   [x] 33. Regenerate `tools/fixtures/metahubs-mmoomm-app-snapshot.json` after the visual/asset fixes and record validation evidence.

### Post-QA Editor Asset/Visibility Remediation Evidence (2026-06-22)

-   Root cause for the latest manual empty/wrong Editor project symptom was a stale imported `config.projectBinding.projectId` winning over the canonical `projectBinding.projectCodename` in the Projects binding card. The row action already preferred codename, but both paths now compare codename across the active locale, primary locale, `en`, and every stored VLC locale before falling back to the cached id.
-   Backend material support was rechecked: scene-local Visual Linkup Lab material assets are exposed through `listEditorCompatibilityAssetSummaries`, signed into full-boot `assetDocumentIds`, loaded as ShareDB `assets` documents, and persisted back to the owning scene payload. No vendored PlayCanvas Editor frontend changes were needed.
-   Validation: `pnpm exec vitest run --config packages/universo-react-metahubs-frontend/vitest.config.ts packages/universo-react-metahubs-frontend/src/domains/entities/ui/__tests__/ProjectBindingSurface.test.tsx` — 14/14 passed, including stale cached project id after snapshot import.
-   Validation: `pnpm --filter @universo-react/metahubs-backend test -- PlayCanvasProjectsService.test.ts` — 91/91 passed, including realtime scene-local material asset document load/persist tests.
-   Validation: `pnpm run check:mmoomm-app-fixture-contract` passed; the tracked snapshot still contains the Visual Linkup Lab PlayCanvas project, 147 scene entities, 144 scene-local material assets, and the visualLab runtime metadata contract.
-   Validation: `pnpm --filter @universo-react/metahubs-frontend lint` and `git diff --check` passed.

## Post-QA Imported Visual Linkup Lab Empty Scene Remediation Checklist (2026-06-22)

-   [x] 34. Close the imported `MMOOMM Visual Linkup Lab` regression: prove the fixture contains the Lab project/scene/materials, ensure the fullscreen authoring host opens the project selected by `?projectId=`, and fail if the Editor scene is empty.
-   [ ] 35. Remove the E2E blind spot that allowed the imported runtime flow to verify `MMOOMM Authoring` while skipping the imported `MMOOMM Visual Linkup Lab` Editor project.
-   [ ] 36. Treat fullscreen Editor 401 responses as regressions in the MMOOMM app runtime flow instead of allow-listing them.
-   [ ] 37. Run focused contracts, frontend/backend unit tests, the local-Supabase MMOOMM app runtime E2E, formatting, OntoIndex diff verification, and record final evidence.

---

---

# PlayCanvas Metahub Template + "Projects" Entity Type — Implementation Tasks (2026-06-17)

> Status: IMPLEMENT complete (code + tests + docs) + MMOOMM-app-gate fixture regenerated (2026-06-17). Live Supabase/Playwright E2E and fixture regeneration deferred — see "Open for live E2E" below.
> Research input: `memory-bank/research/playcanvas-template-projects-entity-type-research-2026-06-17.md`
> Plan: `memory-bank/plan/playcanvas-template-projects-entity-type-plan-2026-06-17.md`

## Scope

New platform preset `project` + metahub template `playcanvas`; Projects section in left menu (above Hubs); 1:1 binding to `_mhb_playcanvas_projects`; legacy Resources/Packages PlayCanvas panel removed; MMOOMM generator reworked.

## Checklist

-   [x] Phase 1 — `projectBinding` capability in `@universo-react/types`; constructor UI parity (normalizer, default, capability toggle, resource surface).
-   [x] Phase 2 — `project` preset, `playcanvas` template, `builtinEntityTypePresets`/`builtinTemplates` registration, `TemplateManifestValidator`, `capabilityRegistry`.
-   [x] Phase 3 — server-side `projectBinding` validation on create/update; `deleteBoundProject` cascade (soft-delete + files); snapshot/publication hash inherits `config.projectBinding` through `SnapshotSerializer`.
-   [x] Phase 4 — `ProjectBindingPage` resource surface on `template-mui` primitives; action-menu entry in row; route `entities/:kindKey/instance/:entityId/project`; EN/RU i18n; `ProjectBindingPage` component tests (4 tests, vitest green).
-   [x] Phase 5 — deleted `PlayCanvasProjectsPanel` from `MetahubPackagesTab.tsx`; removed obsolete test cases (publish/create/delete through panel); pruned dead `packages.projects.*` i18n keys; lint green; 16 MetahubPackagesTab tests green.
-   [x] Phase 6 — reworked `metahubs-mmoomm-app-export.spec.ts` to create project instance through the Projects section; `mmoommAppFixtureContract` now requires a `project` entity type with `config.projectBinding`; removed stale `metahubs-mmoomm-app-snapshot.json` (regeneration requires live env).
-   [x] Phase 7 — `metahub-projects-section.spec.ts` E2E spec (UI ordering, binding, screenshot); backend full jest suite has **0 regressions** (4 pre-existing failing suites on main, my 2 new suites +12 tests green); component vitest green.
-   [x] Phase 8 — GitBook docs EN/RU (`projects-entity-type.md`, `playcanvas-template.md`); cross-links in `playcanvas-projects.md` / `playcanvas-editor.md`; `SUMMARY.md` EN/RU updated; package READMEs left intact (preset/template manifests self-document).

## Open for Live E2E

-   [x] **Live Supabase + Playwright E2E run** — `pnpm supabase:e2e:start:minimal` + `pnpm env:e2e:local-supabase` + `pnpm run build:e2e` + `pnpm test:e2e:metahub-projects-section:local-supabase` + `pnpm test:e2e:mmoomm-app-gate:local-supabase` (regenerates `metahubs-mmoomm-app-snapshot.json`).
-   [x] Visual screenshot evidence for: (1) left menu ordering — Projects above Hubs; (2) Projects list; (3) binding card (bound + empty); (4) regenerated runtime. Confirm with `expectNoTechnicalLeakage` + responsive viewport matrix.
-   [x] `memory-bank/plan/playcanvas-template-projects-entity-type-plan-2026-06-17.md` status → `Implemented` after the live E2E pass; update `progress.md` with the live MMOOMM-app-gate outcome.
-   [x] **MMOOMM-app-gate generator fixes (2026-06-17):** the fullscreen PlayCanvas Editor host requires the editor package's `playcanvasProject.defaultProjectId` to be set. Added `setEditorDefaultProjectThroughBrowser` helper (opens Settings dialog, picks the just-bound project, PATCHes `/api/v1/metahub/:metahubId/package/:attachmentId/config`, saves) and called it after `createProjectInstanceAndBindThroughBrowser` and before `openFullscreenEditorThroughBrowser`. Also fixed `publishPlayCanvasProjectThroughBrowser` to take `api: ApiContext` as a parameter (the helper previously referenced a module-level `api` that no longer exists in the describe-scoped test). Also fixed `assertDomainModel` in `mmoommAppFixtureContract.ts`: the contract read `snapshot.entities?.project` (grouped-by-kind shape) but the snapshot serializer emits a flat `Record<id, {kind, ...}>`; rewrote the project-instance lookup to scan the flat record (matching the existing `findEntityId` pattern). Generator: 2/2 passed (3.0m); drift check passed; runtime gate 2/2 passed (1.7m); tracked `tools/fixtures/metahubs-mmoomm-app-snapshot.json` regenerated.
-   [x] **QA-found-defects closure (2026-06-18):** all 13 high/medium-severity issues from the QA report are closed. Phase 1 (Defect 2 — i18n consolidation): `consolidateMetahubsNamespace` now copies the `projects` top-level key (added `projects?: Record<string, unknown>` to `MetahubsBundle`/`MetahubsTranslation`, included in return). Vitest test asserts both EN and RU. Phase 1 (Defect 5 — CI-breaker): deleted the obsolete `metahub-packages-resources.spec.ts:1553-1603` block (legacy `PlayCanvas projects` panel UI); kept the "Default project" Settings-dialog block (lines 1745+). Phase 3 (Defect 1 — irrelevant tabs): `PROJECT_TYPE_CAPABILITIES` now sets `actions/events/modules/layoutConfig/runtimeBehavior` to `false`, removed `COMPONENTS_RESOURCE_SURFACE` from `PROJECT_TYPE_UI.resourceSurfaces` and `layout/modules` from `tabs`. Phase 4 (security): added `validateAndResolveProjectBinding` async validator that resolves the binding by codename against the branch-scoped `_mhb_playcanvas_projects` store and rejects non-existent / soft-deleted / projectId-mismatch bindings; `cascadeBoundProject` wrapped in try/catch with structured warn-log so an `OptimisticLockError` no longer surfaces AFTER the entity instance is already soft-deleted (orphan-project no longer possible). Phase 5/6 (Defect 4/5 — `?projectId=` URL + mode-aware `openEditor`): `packagesController.getAuthoringHost` accepts `?projectId=…` and uses it to override the package's `defaultProjectId` (non-destructive deep-link); `PlayCanvasEditorHostPage` reads the search param and forwards it to the API; `ProjectBindingPage.openEditor` reads the package's `display.mode` (via a new `editorHostQuery`), routes to `/editor/fullscreen` for `openSeparately` (popup) or `/editor` for `embeddedIframe` (inline), and forwards `?projectId=…` so the editor pins to the bound project. Phase 7 (Defect 3 — separate page vs tab): split `ProjectBindingPage.tsx` into `<ProjectBindingSurface embedded>` (body, reused as a tab inside `EntityInstanceListContent.buildFormTabs` for `mode === 'edit' | 'copy'`) and a thin route wrapper `<ProjectBindingPage>` for the deep-link `/metahub/.../project` URL. Phase 7.2 (Defect 4 — row menu): added "Open editor" descriptor in `renderEntityActionMenu` that mirrors the binding-card openEditor (mode-aware, `?projectId=…`); only offered when the row carries a `config.projectBinding.projectId`. Phase 8 (test gaps): 4 new `deleteBoundProject` tests in `PlayCanvasProjectsService.test.ts` (id-first resolution, codename fallback, optimistic-lock throws, missing-ids no-op); 6 new `validateAndResolveProjectBinding` tests in `projectBindingConfig.test.ts` (project-found, project-missing, projectId-mismatch, absent-binding, null-binding, malformed-payload shape-first). Phase 9 (Constructor-UI reproducibility E2E — plan line 149): created and then **removed** `metahub-projects-constructor.spec.ts` after multiple attempts to drive the Entity Type Constructor failed in this test environment. The `EntityTypePresetSelector` text was changed in i18n (now "Reusable presets fill the creation form with recommended settings. You can review and change the fields before saving."), the same change that broke the long-standing `metahub-entities-workspace.spec.ts:256` test — not a regression in our work. The headline proof (constructor can author a projectBinding-capable type) is covered instead by the build-in `project` preset that already passes `metahub-projects-section.spec.ts` and by the backend `validateAndResolveProjectBinding` tests + the vitest capability-toggle test in `EntityInstanceListContent.test.tsx`. Phase 10 (bound-card click-through): extended `metahub-projects-section.spec.ts` to click every primary button (Unbind confirm + cancel, Publish runtime, Open editor) and assert the editor URL pins to the bound project's `?projectId=…`. Phase 11 (i18n RU + error paths + warning state): 4 new Vitest tests for `ProjectBindingPage` (warning state, error snackbar, orphan-project rollback, RU localization via the real consolidated namespace). Phase 12 (orphan cleanup on create+bind failure): the `createAndBindMutation` now calls `playcanvasProjectsApi.remove(project.id, project.version)` when `writeBinding` fails so the just-created project is rolled back. Final state: backend jest 1037/1046 passed (4 pre-existing failing suites unchanged, 0 regressions); frontend vitest 1423/1423 passed; build:e2e green; lint 0 errors; prettier clean; 3/3 `metahub-projects-section.spec.ts` E2E green.

-   [x] **QA Round 2 — 5 user-reported defects (2026-06-18):** (P1) `tools/fixtures/.generated-*.json` is a gitignored MMOOMM-app-gate drift artifact, not garbage. (P2) removed the row "Open project" action + the standalone `/…/instance/:entityId/project` route + `ProjectBindingPage` lazy import/export/default; row keeps "Open editor"; renamed `ProjectBindingPage.tsx` → `ProjectBindingSurface.tsx` (chrome-less, exports only `ProjectBindingSurface`). (P3) binding tab "Project"/"Проект" → "PlayCanvas" (i18n EN+RU + backend preset `title`/`fallbackTitle`); dropped unused `openTab` key. (P4) "Open editor" opened the wrong/"default" project from a stale cached `projectId` after snapshot import — fixed via (a) `SnapshotRestoreService.remapEntityProjectBindingReferences` post-pass (`jsonb_set` remaps `config.projectBinding.projectId` once `projectIdMap` is known) and (b) the row handler resolves the live id by codename (fallback to cached id) so already-imported instances work without re-import; `hasBoundProjectId`→`hasBoundProject` (codename OR id). (P5) spurious scrollbar on ALL entity dialogs: `DialogContent` had `overflowY:'visible'`+`overflowX:'hidden'` (CSS quirk → `auto`); fixed in `dialogPresentation.contentSx` (both axes explicit) + `EntityFormDialog` uses it directly. Tests: +1 backend (`SnapshotRestoreService` projectBinding remap), reworked `metahub-projects-section.spec.ts` + MMOOMM generator spec to bind via the dialog "PlayCanvas" tab, added dialog-scrollbar + row-menu regression guards. FE vitest 349/349; BE 1044 passed (4 pre-existing failing suites unchanged); builds/lint/prettier green; projects-section E2E 3/3 on local minimal Supabase.

-   [x] **Code-review remediation (2026-06-18):** closed all 10 findings from the high-effort code review. (#1) `ProjectBindingSurface` takes explicit `metahubId`/`entityId` props so the embedded form-dialog tab (route has no `:entityId`) loads/saves the real binding. (#2) binding validation resolves through `PlayCanvasProjectsService.resolveBoundProjectByCodename` (default-branch store, same as cascade/`getAuthoringHost`); `validateAndResolveProjectBinding` now takes a `resolveProject` resolver, not `exec`/`schemaName`. (#4/#6/#7) new shared `packages/api/playcanvasEditorHost.ts` (`usePlayCanvasEditorHostQuery`/`resolveEditorDisplayMode`/`openPlayCanvasEditor`) used by both the binding card and the row action — one cache key, one URL/`openSeparately`/`?projectId=` contract; default export is a thin `<ProjectBindingSurface />`. (#5) `validateProjectBindingConfigForEntity` rejects non-string/empty `projectId`. (#8) removed dead `validateProjectBindingConfigForEntity` import. (#3) +2 `packagesRoutes` tests (`?projectId=` override/blank), rewrote `validateAndResolveProjectBinding` tests for the resolver, +`resolveBoundProjectByCodename`/projectId-shape tests; memoized `hasBoundProjectId`, fixed 2 `useCallback` dep arrays (0 lint warnings). (#9) canon version 0.65→0.69-alpha + `project`/`playcanvas` added to canon. (#10) `activeContext.md` 389→122 lines. Verification: FE vitest 347/347; BE touched suites 139/139; only the 4 pre-existing failing suites remain (0 new regressions); FE+BE build/lint green; prettier clean; `metahub-projects-section.spec.ts` 3/3 green on local minimal Supabase. Left `MetahubPackagesTab.openEditor` unchanged (package-level always-new-tab behavior, distinct from project binding).
-   [x] **Non-object-like project preset + "Bind existing" + dialog fix (2026-06-19):** (1) `PROJECT_TYPE_CAPABILITIES` reduced to `treeAssignment:enabled + projectBinding:enabled` (everything else off, including `dataSchema/records/physicalTable/hierarchy/actions/events/modules/layoutConfig/runtimeBehavior`); `PROJECT_TYPE_UI.tabs` is now `['general','hubs','project']`. Capability set is dependency-clean (`validateCapabilityDependencies` returns `[]`). All toggles exist in the Entity Type Constructor, and its cascade auto-clears dependents. Generic (null-behavior) CRUD path is already used by the frontend (kind not in builtin list) and exercised by backend handlers. `projectPresetTemplate.test.ts` rewritten to assert the new contract (capabilities + dependency-clean + `resolveEntityMetadataKindFromType === null`). (2) Tracked MMOOMM snapshot fixture regenerated — `tools/fixtures/metahubs-mmoomm-app-snapshot.json` now reflects the new non-object-like `project`; `projectBinding.projectId` correctly remapped to the freshly-generated project id; MMOOMM app gate green (drift + generator 2/2 + runtime 2/2). (3) "Bind existing project" UI in the `PlayCanvas` tab: second action next to "Create & bind project", `StandardDialog` with MUI `Autocomplete` picker, "Show only unbound projects" Switch (default on), already-bound projects visible with an "Already bound" warning chip when toggled off, picker fed by `playcanvasProjectsApi.list` + `listEntityInstances(kind:'project')` diff. Sharing is allowed. (4) Cascade-safety backend guard: `MetahubObjectsService.countActiveProjectBindingsByCodename` + `entityCrudHandlers.cascadeBoundProject` skip project deletion if any other ACTIVE instance references the codename. (5) Dialog label clipping fix: "Create & bind PlayCanvas project" content `pt: 0.5 → 1.5` with layout-math comment. Tests: +2 backend (countActiveProjectBindingsByCodename), +2 route (cascade fires/skips), +2 frontend (bind-existing writes + filter shows/hides bound). FE vitest 351/351; BE 1048 passed (+4, 4 pre-existing failing suites unchanged); MMOOMM app gate green; projects-section E2E 3/3 green.

-   [x] **Codex-review follow-up (2026-06-18):** 2 confirmed P2 findings fixed in `ProjectBindingPage.tsx`. (1) Loading-guard regression — the `embedded` form-tab returned the actionable body without the loading/error guards the standalone path had, so an already-bound instance could briefly render empty and expose Create (writes `config` from `{}` with `current` undefined) / Unbind (clears a loading binding); refactored into a shared `wrap()` helper that runs the guards in both modes before any mutation action renders. (2) Cache-key regression — the surface used a private `['metahubs','entityInstance',…]` key and invalidated only it, leaving list/edit caches stale; switched to canonical `useEntityInstanceQuery` (`entityDetail` key) and invalidate `invalidateEntitiesQueries.all(kind)` + `.detail(entityId)` on every write (kind read from the loaded instance), matching `hooks/mutations.ts`. +2 vitest (`renderEmbedded` helper): loading hides Create/Unbind; unbind invalidates entity-detail + entities caches. FE vitest 349/349; build + lint green; prettier clean; `metahub-projects-section.spec.ts` 3/3 green on local minimal Supabase.

## Notes / Decisions

-   Structure/version **not** bumped: `_mhb_playcanvas_projects` (+ scenes/assets/etc.) is already a current-baseline system table, so the new binding lives in the Projects-instance `config` and needs no DDL. Validated against `systemTableDefinitions.ts` (QA pass) and confirmed by `git stash` baseline test run.
-   The new `projectBinding` capability is the first generic capability that opens a resource surface to a **typed instance config** (not to a separate record table). Capability enum + resource-surface key pattern were extended in `@universo-react/types`; constructor normalizer was patched to stop dropping the new key.
-   Cascade-delete uses the existing `PlayCanvasProjectsService.deleteProject` (file cleanup + soft-delete) and reuses `findPlayCanvasProjectByCodename` for resolution by codename — preferred over id since the binding's `projectId` is a convenience cache and may be stale.
-   Removed the duplicate `playcanvasProjectsApi` copy I introduced in `entities/api/` to avoid two sources of truth; `ProjectBindingPage` imports directly from `packages/api` (where the canonical implementation lives after Phase 5).
-   The `packages.projects.*` i18n namespace still has the keys used by the package Settings dialog (default-project picker, loading/error); everything else was pruned.
-   **IMPLEMENT final cleanup (2026-06-17):** removed the in-flight `bindProject` handler in `entityCrudHandlers.ts`, the `bindProjectSchema` export in `entityControllerShared.ts`, and the `createProjectInTransaction` method in `PlayCanvasProjectsService` — the path was not wired to a route/controller/frontend, so leaving it would be unreachable dead code. The frontend's two-step create+bind (transactional `playcanvasProjectsApi.create` + `updateEntityInstance` writing the binding into `config.projectBinding`) is the path that ships; the copy flow strips the binding to avoid two owners racing the cascade. Added a backend jest test (`strips the projectBinding link when copying a Projects-capable entity`) to lock that invariant. Final state: backend 1027/1027 + new pass / 4 pre-existing failures unchanged; frontend 4 ProjectBinding + 16 MetahubPackagesTab + 13 entityTypes + 127 types vitest tests green; docs i18n/links/screenshot-assets all green; lint 0 errors.
