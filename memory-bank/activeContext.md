# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

The active focus is the completed MMOOMM PlayCanvas Visual Linkup Lab slice on
top of the PlayCanvas Projects entity type. Sections below cover the current
invariants, standing guardrails, and a navigation index into progress.md.

---

## Current Focus: MMOOMM Visual Linkup Lab (2026-06-20 → 2026-06-21, complete)

The MMOOMM canonical fixture now has two PlayCanvas-backed Projects instances:

-   `MMOOMM Authoring` remains the existing flight simulator project and powers
    the published flight runtime widget.
-   `MMOOMM Visual Linkup Lab` is a second Editor-authored project with 16
    weak-linkup visual variants for white translucent bodies, dense fog,
    low-poly/primitive shapes, and type-colored glow semantics for ships,
    stations, rock asteroids, and ice asteroids.

Implementation placement:

-   Multi-project fixture generation lives in the Playwright product generator
    and support helpers. Project selection is by role/display name/codename,
    not by row order or newest manifest.
-   Runtime-visible lab rendering is generic and metadata-driven through
    `@universo-react/playcanvas-engine` helpers and the existing
    `apps-template-mui` `playcanvasCanvas` widget when
    `metadata.mmoomm.visualLab` is present.
-   PlayCanvas scene entity metadata is preserved through shared bridge schemas,
    the artifact serializer, backend compatibility normalization, snapshot
    serialization, and runtime manifest export.
-   The PlayCanvas Editor vendor tree remains untouched; all changes are at the
    Universo generator/backend/runtime boundaries.

Latest verification:

-   Full combined `pnpm run test:e2e:mmoomm-app-gate:local-supabase` passed:
    generator 2/2, fixture drift clean, runtime import 2/2.
-   Focused package tests/builds passed for metahubs-backend, shared types,
    playcanvas-engine, playcanvas-editor-frontend, and apps-template canvas
    widget coverage.
-   OntoIndex diff verification passed with the expected changed file set.
-   Advisory autoreview could not start because `~/.codex/state_5.sqlite` is
    read-only in this environment; keep this as an environment limitation, not a
    content finding.

---

## Completed Focus: PlayCanvas Projects entity type (2026-06-17 → 2026-06-19)

Latest pass closed the `project` entity-type binding feature. The four recent
QA/closure passes are complete; full per-pass detail (root causes, file lists,
verification) is in [progress.md](progress.md) (2026-06-17 → 2026-06-19 entries).
Highlights of the most recent work:

-   **Unbind no-op fix (2026-06-19):** root cause was the backend shallow-merge — the PATCH `update` (`MetahubObjectsService.updateObject`) treats an absent `config` key as "leave unchanged", so `delete config.projectBinding` let the old binding survive. Fix: send the clear signal `projectBinding: null` (survives `stripUndefinedEntries`; readers treat `null` as unbound).
-   **Dialog scrollbar fix (2026-06-19):** `dialogPresentation` per-metahub stored size was applied as a fixed `height`, clipping taller dialogs. Fix: apply stored height as a `minHeight` floor when idle; pin exact `height` only during an active resize drag.
-   **Non-object-like preset + "Bind existing" (2026-06-19):** `PROJECT_TYPE_CAPABILITIES` trimmed to `{treeAssignment, projectBinding}`, tabs `['general','hubs','project']` (no Components/Layouts/Modules/Actions/Events); added the "Bind existing project" Autocomplete picker with unbound-only filter; reference-counted cascade so a shared project is not orphan-deleted.
-   **Prior passes (2026-06-17/18):** entity type + `playcanvas` template + live E2E + MMOOMM gate; QA Round 2 (5 defects: removed junk row action, tab rename, projectId remap, dialog overflow); code-review remediation (10 findings); QA defects closure (13 issues).
-   Latest verification: ✅ FE vitest 351/351, BE full sweep 0 new regressions (4 pre-existing failing suites), builds + lint + prettier + tsc clean, MMOOMM app gate green, projects-section E2E green on local minimal Supabase; vendor PlayCanvas Editor untouched.

---

## Invariants to preserve (PlayCanvas binding)

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

### Key files for the active feature

-   `…/metahubs-backend/.../templates/data/standardEntityTypeDefinitions.ts` — `PROJECT_TYPE_CAPABILITIES` (`treeAssignment + projectBinding`); `PROJECT_TYPE_UI.tabs`.
-   `…/metahubs-backend/.../metahubs/services/MetahubObjectsService.ts` — `countActiveProjectBindingsByCodename` (cascade-safety, shallow-merge `updateObject`).
-   `…/metahubs-backend/.../entities/controllers/entityCrudHandlers.ts` — `cascadeBoundProject` (reference-counted, best-effort).
-   `…/metahubs-frontend/src/domains/entities/ui/ProjectBindingSurface.tsx` — binding tab (Create / Bind existing / Unbind; null-clear write).
-   `…/template-mui/src/components/dialogs/dialogPresentation.tsx` — stored dialog size as `minHeight` floor when idle.
-   `packages/api/playcanvasEditorHost.ts` — single editor-host helper (`?projectId=` contract).
-   `tools/fixtures/metahubs-mmoomm-app-snapshot.json` — regenerate via the documented Playwright generator after binding/capability changes.

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
