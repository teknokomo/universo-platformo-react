# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

The active focus is the PlayCanvas Projects entity type and the closure of the
2026-06-19 "non-object-like project preset" pass. Sections below cover that
focus, the invariants it relies on, standing guardrails, and a navigation
index into progress.md.

---

## Current Focus: Dialog scrollbar + PlayCanvas unbind regressions (2026-06-19, complete)

Two QA regressions fixed with tests. Full detail in [progress.md](progress.md)
(2026-06-19 entry).

-   **Unbind no-op (root cause = backend shallow-merge).** The PATCH `update` endpoint shallow-merges `config` (`MetahubObjectsService.updateObject`), so an absent key means "leave unchanged", not "remove". `ProjectBindingSurface.writeBinding(null)` used `delete config.projectBinding`, so the old binding survived the merge and the unbind silently no-oped (200 + success toast, binding intact). Fix: send the documented clear signal `projectBinding: null` (allowed by `validateProjectBindingConfigForEntity`; survives `stripUndefinedEntries`, which only strips `undefined`). Readers (`readBinding`, `extractProjectBindingFromConfig`, the cascade `COUNT` SQL) all treat `null` as unbound.
-   **Spurious dialog scrollbar (root cause = stored resize height as a hard cap).** `dialogPresentation` storage is keyed per-metahub (`storageScopeKey: metahubId`), so a custom size set on one dialog is applied to every dialog in the metahub. It was applied as a fixed `height`, so a stored height shorter than another dialog's content clipped it → inner scrollbar while the viewport still had room. Fix: when idle, apply the stored height as `minHeight` (a floor) instead of `height`; the paper grows to fit content up to `maxHeight` and only scrolls when genuinely larger than the viewport. Exact `height` is still pinned during an active resize drag for 1:1 cursor feedback.
-   **Verification:** template-mui jest (incl. new min-height guard) — TooltipWithParser XSS 2 failures pre-existing/unrelated; metahubs-frontend vitest 351/351 (incl. rewritten unbind test asserting `projectBinding: null` + untouched sibling config); backend jest `MetahubObjectsService` 12/12 (incl. new null-clear vs absent-key merge guard); full backend sweep 4 pre-existing failing suites only (0 new regressions); projects-section E2E green incl. new unbind-confirm + data-truth (`projectBinding` is null after confirm). Lint + prettier clean; template-mui `tsc` 0 errors. Supabase profile stopped after the run.

### Key files touched (this pass)

-   `packages/universo-react-template-mui/src/components/dialogs/dialogPresentation.tsx` — stored resize height applied as `minHeight` floor when idle (exact `height` only during active drag); `isResizing` added to the `paperSx` deps.
-   `packages/universo-react-metahubs-frontend/src/domains/entities/ui/ProjectBindingSurface.tsx` — `writeBinding` sends `projectBinding: nextBinding ?? null` (explicit null clear) instead of deleting the key.
-   `…/dialogs/__tests__/EntityFormDialog.test.tsx` — +1 jest: stored size applied as `minHeight` floor, no fixed `height`.
-   `…/entities/ui/__tests__/ProjectBindingSurface.test.tsx` — rewrote the unbind test to assert the null-clear contract.
-   `…/tests/services/MetahubObjectsService.test.ts` — +1 jest: `projectBinding: null` clears, absent key keeps (documents merge semantics).
-   `tools/testing/e2e/specs/flows/metahub-projects-section.spec.ts` — +unbind-confirm flow with UI empty-state + persisted-config assertions.

---

## Prior Focus: PlayCanvas Projects — Non-object-like + "Bind existing" (2026-06-19, complete)

Three QA follow-ups in one pass: make `project` like an Enumeration (own
storage, no Components/Layouts), add a "Bind existing" picker with a filter,
and fix the clipped label in the create dialog. Full detail in
[progress.md](progress.md) (2026-06-19 entry).

-   **Project preset is now non-object-like** (like an Enumeration, not like an Object). `PROJECT_TYPE_CAPABILITIES` = `{ treeAssignment:enabled, projectBinding:enabled }`; everything else off. `PROJECT_TYPE_UI.tabs` = `['general','hubs','project']` — no more Компоненты/Макеты/Модули/Действия/События on a fresh metahub. The capability set is dependency-clean (`validateCapabilityDependencies` returns `[]`). All toggles exist in the Entity Type Constructor (`EntitiesWorkspace.tsx:2027` for `projectBinding`, `:1865` for `treeAssignment`, `:2215` for `physicalTable`, `:1795` for `dataSchema`); the constructor's cascade (`disableRecursively`) auto-clears the dependents. The generic (null-behavior) CRUD path is already used by the frontend (`resolveEntityMetadataKind` returns `null` for `project`, since the kind is not in the builtin list) and exercised by backend handlers — no extra wiring needed.
-   **Tracked MMOOMM snapshot fixture regenerated** (`tools/fixtures/metahubs-mmoomm-app-snapshot.json`): `project` now reflects the new capability set, `projectBinding.projectId` correctly remapped to the freshly-generated project id (via the existing snapshot-import post-pass). MMOOMM app gate green: drift check clean, generator 2/2, runtime 2/2.
-   **"Bind existing project" UI** in the `PlayCanvas` tab: second action next to "Create & bind project". `StandardDialog` with an MUI `Autocomplete` picker, "Show only unbound projects" Switch (default on), already-bound projects visible with an "Already bound" warning chip when toggled off. Picker fed by the existing `playcanvasProjectsApi.list` + a `listEntityInstances({kind:'project'})` diff. Sharing a project across multiple instances is allowed.
-   **Cascade-safety backend guard** (the real fix): `MetahubObjectsService.countActiveProjectBindingsByCodename` returns the count of ACTIVE instances still bound to a given codename; `entityCrudHandlers.cascadeBoundProject` consults it (excluding the about-to-be-deleted instance) and **skips project deletion** if any other ACTIVE instance still references it. Filter on `_mhb_deleted = FALSE` so a soft-deleted sibling cannot keep a shared project alive.
-   **Dialog label clipping fix:** the "Create & bind PlayCanvas project" content stack had `pt: 0.5`; the outlined TextField's floating label sat above the dialog's top edge and got clipped by the (now-scroll) `DialogContent`. Bumped to `pt: 1.5` with a layout-math comment.
-   **Verification:** FE vitest 351/351; BE 1048 passed (4 pre-existing failing suites unchanged, +4 from this work, 0 new regressions); builds + lint + prettier clean; i18n docs check 98/98 OK; MMOOMM app gate green; projects-section E2E 3/3 green on local minimal Supabase; Supabase profile stopped after runs. Vendor PlayCanvas Editor (`packages/universo-react-playcanvas-editor-frontend/vendor`) untouched.

---

## Recent focuses (historical, complete)

-   **2026-06-19 — Non-object-like `project` preset + "Bind existing" + dialog clipping fix** — current focus above; full detail in [progress.md](progress.md).
-   **2026-06-18 — QA Round 2 (5 defects)**: P2 removed the row "Open project" + standalone `/…/instance/:entityId/project` route + `ProjectBindingPage` export (renamed file to `ProjectBindingSurface.tsx`). P3 renamed binding tab "Project"/"Проект" → "PlayCanvas". P4 fixed "Open editor" opening the wrong project: snapshot import now remaps `config.projectBinding.projectId` (`remapEntityProjectBindingReferences` post-pass), and the row handler resolves the live id by codename. P5 fixed the global dialog scrollbar (`dialogPresentation.contentSx` now sets both `overflowX: 'hidden'` + `overflowY: 'auto'`).
-   **2026-06-18 — Code-review remediation (10 findings)**: explicit `metahubId`/`entityId` props on the embedded surface; shared editor-host helper; canonical `entityDetail` cache + invalidations; `projectId` shape validation; dead-import removal; canon refresh.
-   **2026-06-18 — Codex-review follow-up (2 P2)**: shared `wrap()` helper gates actions before data loads; invalidation uses canonical entity keys.

### Key files touched (current remediation)

-   `packages/universo-react-metahubs-backend/src/domains/templates/data/standardEntityTypeDefinitions.ts` — `PROJECT_TYPE_CAPABILITIES` trimmed to `treeAssignment + projectBinding` (non-object-like); `PROJECT_TYPE_UI.tabs` = `['general','hubs','project']`; updated comment.
-   `…/metahubs/services/MetahubObjectsService.ts` — NEW `countActiveProjectBindingsByCodename` for the cascade-safety guard.
-   `…/entities/controllers/entityCrudHandlers.ts` — `cascadeBoundProject` consults the reference count and skips project deletion if any other ACTIVE instance still references the codename.
-   `…/playcanvas-projects/services/PlayCanvasProjectsService.ts` — no changes (reuses `deleteBoundProject`).
-   `tools/fixtures/metahubs-mmoomm-app-snapshot.json` — regenerated; the new tracked fixture reflects the non-object-like `project` capability set and a remapped `projectBinding.projectId`.
-   `packages/universo-react-metahubs-frontend/src/domains/entities/ui/ProjectBindingSurface.tsx` — "Bind existing project" second action + `StandardDialog` + `Autocomplete` picker + "Show only unbound projects" Switch + "Already bound" warning chip; create-dialog content `pt: 1.5` to keep the floating label visible.
-   `…/i18n/locales/{en,ru}/metahubs.json` — new `bindExisting` / `boundExisting` / `bindFailed` / `alreadyBound` / `filterUnbound` keys.
-   `…/services/MetahubObjectsService.test.ts` + `tests/routes/entityInstancesRoutes.test.ts` — +2 unit / +2 route tests for the reference-counted cascade.
-   `…/domains/entities/ui/__tests__/ProjectBindingSurface.test.tsx` — +2 vitest for the bind-existing flow (writes config; filter shows/hides bound projects with the chip).

### Verification commands

-   Frontend: `pnpm --filter @universo-react/metahubs-frontend build && pnpm --filter @universo-react/metahubs-frontend lint && pnpm --filter @universo-react/metahubs-frontend vitest run`.
-   Backend: `pnpm --filter @universo-react/metahubs-backend build && pnpm --filter @universo-react/metahubs-backend lint`; targeted jest via `tools/testing/backend/run-jest.cjs`.
-   E2E: `pnpm supabase:e2e:start:minimal` then the projects-section spec through the repository runner on `http://127.0.0.1:3100`.

### Invariants to preserve (PlayCanvas binding)

Non-obvious facts a future session must respect:

-   **Project store lives in the default branch only.** Entity instances live in the user's active branch, but PlayCanvas projects (`_mhb_playcanvas_projects`) live in the metahub's default-branch schema. Binding validation, cascade delete, and `getAuthoringHost` must all resolve projects against the default branch — never `ensureSchema(metahubId, userId)`. Route everything through `PlayCanvasProjectsService` so the schema cannot drift.
-   **`project` preset is a dedicated (non-object-like) type.** It enables only `treeAssignment` + `projectBinding`; the entity lives in the generic `_mhb_objects` table and uses the null-behavior CRUD path (no OBJECT metadata kind). Its tabs are exactly `['general','hubs','project']` — no Components / Layouts / Modules / Actions / Events. The capability set is dependency-clean (`validateCapabilityDependencies` returns `[]`); all toggles exist in the Entity Type Constructor and the cascade auto-clears dependents. Do not re-add `dataSchema`/`records`/`physicalTable`/`hierarchy` etc. — that would re-introduce the Компоненты/Layouts tabs and turn the type into a generic Object.
-   **Sharing a PlayCanvas project across instances is allowed; cascade is reference-counted.** "Bind existing" can pick a project that another instance already binds. When deleting an instance, `cascadeBoundProject` consults `countActiveProjectBindingsByCodename` (excluding the about-to-be-deleted instance, filtered on `_mhb_deleted = FALSE`) and SKIPS project deletion if any other ACTIVE instance still references the codename — otherwise the surviving instance would be orphaned. The copy flow still strips `projectBinding` (copying a binding would create two owners racing the reference count).
-   **The cascade is best-effort.** Errors (optimistic-lock, file cleanup) are logged and swallowed so the user-facing `204` is never blocked; an orphan is acceptable over a phantom failure.
-   **create+bind is a two-step client flow with rollback.** `createAndBindMutation` creates the project, then writes the binding; if the write fails it removes the just-created project. The copy flow strips `projectBinding` so copies never share a project.
-   **"Open editor" is mode-aware and project-pinned.** `openSeparately` pops `/editor/fullscreen` in a new tab; every other mode navigates inline to `/editor`; both forward `?projectId=` so the bridge session pins to the bound project, overriding the package `defaultProjectId` for that session only (non-destructive).
-   **The binding surface gates actions behind data.** The `ProjectBindingSurface` (edit-dialog "PlayCanvas" tab — there is no standalone page) runs the loading/error guards before rendering Create/Unbind/Bind; never expose those actions while `instanceQuery`/`projectsQuery` are still loading (Create would write `config` from `{}`, Unbind would clear a still-loading binding).
-   **Bind by codename, resolve the live id.** `config.projectBinding.projectCodename` is the canonical reference; `projectId` is a cache that can be stale (e.g. after snapshot import remaps project ids). "Open editor" (row + card) resolves the live id by codename; snapshot import remaps the binding's `projectId`. Never open the editor off the cached id alone.

Earlier slices of this feature (binding capability threading, `PlayCanvasProjectsService.deleteBoundProject`,
legacy `PlayCanvasProjectsPanel` removal, MMOOMM generator rework, docs EN/RU) and the
prior PlayCanvas Editor host/bridge/storage work are recorded in
[progress.md](progress.md).

---

## Known State / Follow-ups

-   **Pre-existing failing backend suites (not from this work)**: `modulesRoutes`, `metahubMigrationsRoutes`, `playCanvasProjectsController` (bridge-save replay/idempotency cases), `publicationsRoutes`. These fail on the untouched baseline; verify any future change does not add to them rather than assuming green.
-   **Constructor-UI E2E**: the dedicated constructor reproducibility spec was removed; the headline proof (a `projectBinding`-capable type behaves like the built-in `project` preset) is covered by the built-in `project` preset in `metahub-projects-section.spec.ts` plus the frontend capability-toggle vitest. Re-add a constructor spec only after the preset-helper i18n churn that also affects `metahub-entities-workspace.spec.ts` settles.
-   **Snapshot/template versions**: deliberately not bumped (fresh-database migration); the test DB is recreated.

## Completed Work (history)

All prior focuses are complete and fully documented in [progress.md](progress.md).
Do not re-log them here; the index below is navigation only.

-   PlayCanvas Projects entity type + `playcanvas` template — progress.md 2026-06-17 / 2026-06-18.
-   PlayCanvas Editor runtime host, bridge, storage adapter + security hardening — progress.md 2026-06-04.
-   1C-Compatible metahub template, runtime UX QA, constructor UX/lifecycle QA — progress.md 2026-05/2026-06.
-   Scripts → Modules rename — progress.md 2026-05-25.
-   Package naming rollout (`packages/universo-react-*`, `@universo-react/*`) — progress.md 2026-05.
-   Base-directory flatten — progress.md 2026-05.
-   Object/Component rename (Catalogs/Attributes → Objects/Components) — progress.md 2026-05-14.
-   Local Supabase env profile generation — progress.md 2026-05-13.
-   Scoped menu contract + layouts QA — progress.md 2026-05-12 / 2026-05-13.
-   Memory Bank compression + GitHub releases table — progress.md 2026-05-23.

---

## Current Guardrails

-   **E2E testing boundaries**: browser E2E must use the dedicated E2E boundary — hosted dedicated `.env.e2e.local` / `.env.e2e` by default, or the dedicated local Supabase profile on ports `55321/55322/55323` when local mode is explicitly requested.
-   **Agent restrictions**: agents must not use `pnpm dev` or port `3000` for Playwright E2E; the repository E2E runner owns startup on `http://127.0.0.1:3100`. For Playwright CLI use the `.agents/skills/playwright-best-practices` skill, and for E2E start local Supabase minimal (`pnpm supabase:e2e:start:minimal`, etc.).
-   **Main Supabase testing**: shared/main Supabase E2E mode is only for manual debugging and must require `E2E_ALLOW_MAIN_SUPABASE=true` plus `E2E_FULL_RESET_MODE=off`.
-   **Local Supabase scripts**: local Supabase app-start scripts have two supported profiles — full stack (`start:local-supabase`) and minimal stack (`start:local-supabase:minimal`); both must keep `doctor:local-supabase` before app startup/reset and must pass explicit `.env.local-supabase` profiles.
-   **Local URL distinction**: local Supabase docs must distinguish Supabase Studio (`http://127.0.0.1:54323`) from the local API URL (`http://127.0.0.1:54321`).
-   **Legacy avoidance**: do not reintroduce `includeBuiltins`, `isBuiltin`, `source`, `custom.*-v2`, old top-level managed route families, or deleted frontend `domains/catalogs|hubs|sets|enumerations` folder names.
-   **Runtime workspaces**: runtime workspace management stays on isolated `apps-template-mui` card/list patterns.
-   **Public exposure**: keep public-runtime exposure tied to publication-backed state, not raw design-time flags.
-   **Form hydration**: keep the `EntityFormDialog` first-open state hydration pattern intact (no render-phase ref writes).
-   **Fixtures maintenance**: future fixture changes must be regenerated through documented Playwright generator specs.
-   **PlayCanvas Editor vendor**: keep `packages/universo-react-playcanvas-editor-frontend/vendor` unmodified (or minimal) for easy upstream version bumps; do project-side work in `packages/universo-react-playcanvas-editor-backend` and the metahubs packages instead.

## Constraints to Preserve

1. **Canonical terminology**: built-in kind key `object`, component resource route segment `components`, capability manifest key `capabilities`.
2. **Entity kinds**: `_mhb_objects.kind` accepts built-in + custom kinds; custom kinds define their own table prefixes via constructor metadata.
3. **Snapshot versions**: schema/template version numbers intentionally not bumped for fresh-database migrations.
4. **Compatibility limits**: old test databases are disposable; add no compatibility shims unless a future migration request requires them.
5. **Testing integrity**: all existing E2E tests must remain green at every phase boundary.
6. **Single editor-host helper**: "Open editor" everywhere must go through `packages/api/playcanvasEditorHost.ts` (`usePlayCanvasEditorHostQuery` / `resolveEditorDisplayMode` / `openPlayCanvasEditor`); do not re-implement the URL/`openSeparately`/`?projectId=` contract inline.
7. **Single project-store resolver**: binding existence/ownership checks must go through `PlayCanvasProjectsService` (default-branch schema); do not pass a caller-resolved `schemaName` into binding validation.
8. **Canonical entity caches**: the binding surface reads via `useEntityInstanceQuery` (`entityDetail` key) and on every write invalidates `invalidateEntitiesQueries.all(kind)` + `.detail(entityId)`; do not reintroduce a private `entityInstance` query key or narrow single-key invalidation, or the list/edit surfaces go stale.
9. **Reference-counted cascade**: `cascadeBoundProject` must skip project deletion when any other ACTIVE instance references the same `projectBinding.projectCodename`. Use `MetahubObjectsService.countActiveProjectBindingsByCodename` (filters on `_mhb_deleted = FALSE`) — do not delete a shared project.

## Stored Data Access Notes

Domain-concept names still allowed (not the renamed entity type):

-   `config.parentHubId`, `config.boundHubId`, `config.hubs` — hub/tree configuration JSONB.
-   `config.projectBinding` — `{ provider, projectCodename, projectId? }` on a `project`-kind instance; `projectCodename` is the canonical reference resolved against the default-branch project store, `projectId` is an optional cached id.
-   `set`, `enumeration`, `page`, `ledger`, `project` — separate standard entity kind keys.
-   `catalog` only where it refers to the migration registry package, not the Object entity type.

## References

-   [tasks.md](tasks.md)
-   [progress.md](progress.md)
-   [systemPatterns.md](systemPatterns.md)
-   [techContext.md](techContext.md)
-   [projectbrief.md](projectbrief.md) — refreshed 2026-06-18 (version, `project` preset, `playcanvas` template).
-   [productContext.md](productContext.md) — refreshed 2026-06-18 (version, PlayCanvas binding).
