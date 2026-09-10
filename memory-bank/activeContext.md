# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

## Marketing-page top-bar regression fix (2026-09-10)

The published marketing runtime now preserves the original MUI demo geometry
and applies one current policy to every active Navigation instance: every
`marketing.navigation` AppBar is fixed, receives a deterministic vertical stack
offset, and remains visible while the document scrolls behind it. The page
reserves the complete stack height, so repeated bars render one below another
without overlaying or displacing the page background. The first instance still
owns the shared language control and navigation shell state; the widget-level
position setting remains available for the future configuration contract.

The focused apps-template Vitest run passed 15/15 tests, and package lint and
typecheck passed. The fresh local minimal-Supabase cross-template Playwright
wrapper passed 4/4 Chromium scenarios after the full workspace build. Its new
browser oracles verified all-repeated `fixed` positioning, non-overlapping
stack geometry, Hero `top=0`, stable navigation coordinates after scrolling,
repeated navigation order, responsive 390/768/1440 coverage, no horizontal
overflow, and an empty console/page/request-failure/API-error issue set. They
also verify that a single-navigation page keeps the gradient on Hero, while
repeated navigation moves the gradient to the page root and disables the
duplicate Hero background. Inspected artifacts include the initial and
post-scroll repeated-navigation screenshots, the single-navigation scrolled
view, tablet, and RU mobile marketing screenshots.

No schema, migration, or metahub-template version changed. The worktree was
already broadly dirty from the preceding implementation; direct source remains
authoritative while OntoIndex is based on an earlier committed snapshot. The
Thermos/autoreview helper was rerun with a 600-second limit but produced no
structured report; no clean external review claim is made. Final OntoIndex
`gn_verify_diff` passed against the complete 195-file dirty-worktree allowlist
with no unexpected files, symbols, impacted symbols, or missing test evidence.

## Unified layout post-QA implementation closeout (2026-09-09)

The latest post-QA implementation is complete for the hosted application
runtime. Repeated marketing Navigation instances now occupy independent
vertical flow positions; Dashboard rendering treats persisted composition as
authoritative; application-owned versus inherited lineage is explicit; and
copy, seed, sync, delete, and reset paths preserve UUID v7 identity,
`instanceKey`, optimistic versions, and source lineage without a schema,
migration, or metahub-template version bump.

The final local minimal-Supabase cross-template Playwright wrapper passed 4/4
Chromium scenarios after a 36-package workspace build. Its inspected
screenshots prove three visible non-overlapping marketing Navigation instances,
scoped Dashboard rendering, RU mobile controls, and responsive marketing
layout. The browser gate also collected console/pageerror/requestfailed data;
the final issue set was empty. Full applications-backend and
metahubs-backend Jest suites, the focused apps-template Vitest suite,
applications-frontend/types/utils checks, package lint/typecheck/build, seed
contract, i18n/provenance, isolation, MUI policy, runtime-fork, Prettier, and
diff checks pass.

The standalone browser wrapper remains an explicit BLOCKED environment gate
because this checkout has no separately configured authenticated standalone
host and entity-type IDs; no standalone acceptance claim is made. OntoIndex
`gn_verify_diff` passes for the complete dirty-worktree allowlist, while the
index status correctly remains dirty/degraded until a commit or clean snapshot
is available. The Thermos autoreview helper reached its ten-minute limit
without a structured report, and replacement review agents were unavailable
because of the external usage limit; no automated clean-review verdict is
claimed. Direct security checks found no newly introduced DOM injection,
dynamic-code, shell-execution, dynamic SQL/Knex-boundary, or unsafe redirect
sinks in the changed surfaces.

The active focus is the **completed Unified Application Template Widgets and
Entity-Scoped Layouts** implementation on branch
`feature/playcanvas-editor-assets-and-mmoomm-scripts` (plan:
`memory-bank/plan/unified-application-template-widgets-scoped-layouts-plan-2026-09-07.md`,
research:
`memory-bank/research/unified-application-template-widgets-scoped-layouts-research-2026-09-07.md`,
brief: external MANAGER brief
`unified-application-template-widgets-and-scoped-layouts-spec-2026-09-07.md`,
checklist + evidence log: top of `tasks.md`). The target-aware effective-layout
route, shared widget registry, scoped cross-template selection, responsive
shell ownership, i18n, focused tests, and minimal-Supabase browser evidence are
complete without a schema, snapshot, or metahub-template version bump.

The implementation closeout passed the hosted cross-template flow 4/4 after a
36-package workspace build. Fresh screenshots cover Marketing desktop, RU
mobile, tablet, scoped Dashboard desktop, and scoped Dashboard RU mobile; the
normal visible target links lead into the entity-scoped runtime, where the
existing table and shared LanguageSwitcher render without UUID/internal-key
leakage or page-level horizontal overflow. The later marketing wrapper passed
9 Chromium lifecycle tests with one intentional standalone skip, the visual
matrix passed 5/5, and the real layout-details screenshot contains no runtime
error alert. Standalone browser proof is not claimed because no separate
authenticated standalone deployment is configured; the wrapper records this as
an explicit BLOCKED environment gate and direct standalone/component coverage
remains in the repository. Full applications-backend, metahubs-backend, utils,
and applications-frontend package suites pass; the apps-template Vitest package
suite now passes serially after its stale aggregate-endpoint mocks and one
cell-create mutation ordering defect were repaired. The latest local autoreview
invocation ran for twenty minutes
without a structured report and was interrupted; earlier attempts were also
blocked by the environment-owned Codex state database. No clean external review
verdict is claimed. OntoIndex is dirty/degraded, so direct source and executed
tests remain authoritative.

The final continuation also routes marketing applications' workspace subpaths
through the existing shared workspace runtime instead of falling back to the
marketing landing page. The complete marketing wrapper passed its Chromium
lifecycle phase with 9 passes and one intentional standalone skip, its visual
matrix passed 5/5, and the documentation/provenance gates passed. The
applications-frontend package lint and 33-file/253-test package run passed; the
current task checklist is fully closed except for the explicitly unavailable
external review verdict. The apps-template package now passes its full serial
run: 54 test files and 732 tests, with package lint and TypeScript build clean.

## QA remediation closeout (2026-09-08)

The follow-up QA findings are implemented without a schema, migration, or
metahub-template version change. Hosted and standalone runtime dispatch now
selects `marketing-page` for scoped entity routes by the resolved template key;
the marketing controller and effective-layout resolver share the custom-object
kind predicate; repeated marketing navigation widgets have unique drawer ids;
the shared LanguageSwitcher has one shell owner; content requests bind to the
host layout through an expected effective-hash handshake; and authoring scope
validation accepts only runtime-supported Page/custom-Object entities.

Application-owned layout deletion remains a fail-closed tombstone operation
with `RETURNING` confirmation. Request-scoped authentication, application
access checks, workspace checks, role-aware effective-layout resolution,
parameterized schema-qualified SQL, UUID v7 validation, and transaction/version
guards are preserved. Effective-layout resolution re-reads the application and
selected candidate inside its transaction; a two-request marketing read with a
changed hash returns a localized stale-layout conflict instead of publishing a
torn result.

The latest local minimal-Supabase cross-template Playwright run passed 4/4 and
produced the scoped marketing and scoped Dashboard screenshots plus desktop,
tablet, and RU-mobile evidence. The latest two-session optimistic-version
concurrency gate passed 2/2 with one committed `200` and one expected `409`.
Focused Vitest/Jest suites passed 9 backend suites / 400 tests plus the
real-server reconnect suite 5/5; package lint/typecheck/build, documentation,
static isolation, and diff checks are the authoritative verification gates. The
standalone wrapper is intentionally fail-closed and records `BLOCKED` when its
separately configured authenticated shell variables are absent; this environment
does not claim standalone browser evidence. The stale structure-create and
matrix-move mocks in `InterpretationNetworkWorkspaceWidget.test.tsx` now use the
current aggregate response contracts, and the cell-create mutation resolves its
system-field allowlist before stripping server-owned fields. The full serial
apps-template run passes 54 files/732 tests; no product test was changed to mask
a failure. Vitest still emits non-failing React `act(...)` warnings from
existing FormDialog/ResourcePreview test paths; no warning is treated as a pass.

The final security/data-integrity remediation also uses a true UUID v7 timestamp
for deterministic generated widget lineage, defaults the shared realtime Origin
validator to deny when omitted, filters inactive layouts from published and
inherited reads, converges source-removal tombstones, and validates scoped-layout
query parameters as UUID v7 values with mutually exclusive global scope. No
schema, migration, or metahub-template version was changed and no legacy layer
was retained.

## Historical PlayCanvas context

The previous active focus was the **completed PlayCanvas Editor assets pipeline + MMOOMM
script assets** implementation on branch
`feature/playcanvas-editor-assets-and-mmoomm-scripts` (plan:
`memory-bank/plan/playcanvas-editor-assets-and-mmoomm-script-assets-plan-2026-08-25.md`,
research: `memory-bank/research/playcanvas-editor-assets-and-mmoomm-script-assets-research-2026-08-25.md`,
checklist + decisions log: top of `tasks.md`).

The 2026-08-29 production-shell follow-up is also complete. The white page was
caused by the generated development Supabase profile omitting `CORS_ORIGINS`,
so browser-originated JavaScript and CSS requests failed with `500 Not allowed
by CORS`. Local profile generation now emits the strict localhost and
127.0.0.1 application origins, and the local doctor fails before startup when
that contract is missing, wildcarded, or incomplete. Static routing separately
keeps missing hashed assets out of the SPA document fallback. A regenerated
profile passed doctor and rendered the production landing page in Chromium.

The final post-QA hardening and strict debt-closure phase are complete. Copied
metahub source owners are admins while the copier remains the sole owner;
runtime script startup waits for realtime and script-artifact readiness; every
PlayCanvas realtime upsert uses the same optimistic-version contract; snapshot
references validate the local provider, project namespace, and traversal-safe
path even when the file is absent; ShareDB handshakes and relays have bounded
buffers and reject prototype-polluting JSON0 paths; compatibility errors no
longer expose PlayCanvas identifiers. The scoped ShareDB MemoryDB gates
publication on durable snapshot persistence and recovers or blocks a document
on failure. PlayCanvas project services/stores, compatibility routes, and
realtime runtime are split into focused modules; runtime-manifest
canonicalization is shared; and `PlayCanvasCanvasWidget.tsx` is 888 lines with
the extracted runtime modules. Browser RBAC/IDOR and all supported asset-type
flows are covered by focused tests and a fresh minimal-Supabase Playwright run
(2/2). Full build, package lint, Prettier, fixture/docs/drift checks, and
OntoIndex verification are complete. No schema or metahub template version
was changed. The local autoreview helper remains unavailable because the Codex
state database is read-only; no product findings were emitted.

## IMPLEMENT sessions 1–3 (2026-08-25 → 2026-08-28) — state

DONE and verified: Phases 0–7. Phase 0 (busboy, baselines), Phase 1 (editor asset CRUD:
multipart create route with upstream `{id}` response, raw file route, delete +
fail-closed PUT 501/catch-all, `fs`/`pipeline` realtime frame handlers, dynamic
asset grants + messenger socket registries, bridge rewrite table, folder tree
via `virtual_path` with deterministic document keys, four-layer whitelist),
Phase 2 (`compileScriptAssetEsm` + `@shared`, text/javascript data URLs,
import map plugin + engine staging script, `playcanvasScriptAssets.ts` loader
with sha-256 verification, `app.__universoHost`, publication wiring:
script-asset mirror + `ensureGeneratedScriptArtifacts` at publish), Phase 4
(merged Modules tab via `MetahubModulesSurface`), P3.1+P3.2 (gameplay extracted
into Editor-authored builtin `.mjs` assets plus the `flight-math` shared
library; the widget retains generic runtime/bridge orchestration), Phase 3 generator/contract/fixture
completion, Phase 4 merged Modules surface, Phase 5 focused and browser test
coverage, and Phase 6 documentation/version hygiene. The canonical MMOOMM
fixture was regenerated through the real Editor authoring flow on minimal local
Supabase; contract, drift, asset CRUD, parity, and imported runtime checks all
pass. The complete checklist and decisions log live at the top of `tasks.md`.

Verification gates used: editor-backend realtime/routes 9 targeted Vitest tests,
metahubs-backend 172 targeted Jest tests, modules-engine 30 Vitest tests,
apps-template-mui loader/widget 55 Vitest tests, PlayCanvas Editor artifact 15
tests, assets CRUD E2E 2/2, baseline/movement parity E2E 2/2, imported MMOOMM
runtime E2E 2/2, fixture generator 2/2, docs screenshot generator 2/2,
contract/drift checks, full build (36/36), Editor build, package lint, and docs
checks. Pre-existing unrelated baseline failures remain documented separately;
no schema or metahub template version was bumped.

The QA-remediation acceptance pass is complete. Request-scoped RLS responses now
commit before the response body is exposed; ShareDB asset seeding is serialized
per backend/document; failed asset/artifact writes are checksum-cleaned after
database or callback failures; package artifact paths reject platform-independent
traversal; and the runtime oracle has one bounded reload recovery for a cold
lazy-loaded `/a/<applicationId>` shell. The canonical fixture was regenerated by
the real Editor flow and the imported runtime proof passed 2/2 after these fixes.
P7.1–P7.8 are all checked in `tasks.md`; no schema or metahub template version
was changed. The advisory autoreview helper remains unavailable in this
environment because its Codex state database is read-only.

---

## Previous Focus: PlayCanvas Engine / Editor / Colyseus Upgrade Gate (2026-08-22, code complete)

Three dependency lines upgraded as one compatibility gate on branch
`feature/playcanvas-engine-editor-colyseus-upgrade` (plan:
`memory-bank/plan/playcanvas-engine-editor-colyseus-upgrade-plan-2026-08-22.md`,
evidence: top of `progress.md`). Code-level work is DONE; browser-evidence and
date-gated steps remain (see "Gated follow-ups" in progress.md):

-   Colyseus coherent set INSTALLED (core 0.17.50 / sdk 0.17.43 /
    schema 4.0.31) via a temporary quarantine window approved by the user;
    policy restored to 10080 min. All realtime suites green on the target
    stack. MMOOMM fixtures REGENERATED through product flows; both CI browser
    gates green; full build + lint clean. Generator reload blocker resolved:
    readiness budget raised to 150 s for heavy v2.30.4 cold reloads.
-   MMOOMM fixtures must be regenerated through the product flow AFTER that
    bump (they embed `upstreamVersion` descriptors; import is fail-closed).
-   New guards wired into CI: `check:zod-resolution`,
    `check:playcanvas-editor-schema-vocabulary`; vendor drift checker now
    verifies against committed `vendor/upstream-inventory.json` (no sibling
    checkout, CI-safe).

Standing invariants added this slice: editor sessions take a transactional
document backup before the first post-open write (`1800000000280`);
artifact tokens slide per bridge session with a 12h absolute cap;
`createBasicApplication` requires unique canvas ids and owns keyboard on the
canvas by default.

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

## Unified layout continuation: final browser regression closure — 2026-09-09

-   The canonical Interpretation Network snapshot was regenerated through the documented Playwright create/configure/export flow. The generator now sends the required `expectedVersion`, and the tracked fixture carries the current global independent-layout composition contract.
-   The fixture contract and generated-fixture drift gate both pass. The focused local minimal-Supabase Playwright flow passes 2/2 after exercising the real language switcher, reload persistence, Russian child-cell creation, UUID v7 response validation, hidden system-field protection, localized validation, no technical leakage, and no page-level overflow.
-   The successful browser artifact `test-results/flows-interpretation-netwo-1ca82-acement-controls-are-hidden-chromium/interpretation-network-child-cell-ru.png` was visually inspected. It shows the localized two-pane Matrix/Materials surface with the created child cell and no raw identifiers or error state.
