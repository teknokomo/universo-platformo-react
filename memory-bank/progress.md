# Progress Log

> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

## IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release      | Date       | Codename                    | Highlights                                                                                                                   |
| ------------ | ---------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 0.68.0-alpha | 2026-06-14 | (no codename)               | PlayCanvas Editor Skills + Thermos review framework, MMOOMM Editor runtime projection                                        |
| 0.67.0-alpha | 2026-06-07 | Visual Workshop 🧰          | PlayCanvas Editor package, authoring settings, file-backed modules, project storage, host bridge, full upstream UI boot      |
| 0.66.0-alpha | 2026-05-31 | Synchronized Flight 🛸      | Metahub packages, MMOOMM + autoreview skills, PlayCanvas/Colyseus flight sim, multi-ship multiplayer                         |
| 0.65.0-alpha | 2026-05-26 | Canonical Packages 📦       | LMS Learning Content runtime, LMS user guide, scripts→modules rename, flat package roots, universo-react naming, 1C template |
| 0.64.0-alpha | 2026-05-19 | Learning Compass 🧭         | LMS generic table widgets, Track Learner Player, runtime form UX safety, search                                              |
| 0.63.0-alpha | 2026-05-13 | Local Universe 🪐           | Local Supabase minimal stack, Object/Component terminology refactoring, workspace policy                                     |
| 0.62.0-alpha | 2026-05-06 | Dynamic Portal 🌀           | LMS portal runtime MVP, Page entity authoring, Node.js 22 migration                                                          |
| 0.61.0-alpha | 2026-04-30 | Hardened Surface 🛡️         | Data-driven entity resource surfaces, runtime workspace management, GitBook docs refresh                                     |
| 0.60.0-alpha | 2026-04-23 | Academic Foundation 🎓      | LMS MVP platform support, application layout management, empty template                                                      |
| 0.59.0-alpha | 2026-04-17 | Universal Entities 🧩       | Entity Component Architecture, entity-first transition, i18n refactoring                                                     |
| 0.58.0-alpha | 2026-04-08 | Ancient Manuscripts 📜      | Metahub scripting, quiz runtime, General section, shared attributes                                                          |
| 0.57.0-alpha | 2026-04-03 | Good Eyesight 🧐            | Playwright E2E coverage, QA hardening, controllers extraction                                                                |
| 0.56.0-alpha | 2026-03-27 | Cured Disease 🤒            | JSONB/VLC unification, security fixes, CSRF middleware                                                                       |
| 0.55.0-alpha | 2026-03-19 | Best Role 🎬                | Bootstrap superuser, admin roles, metapanel dashboard, workspaces                                                            |
| 0.54.0-alpha | 2026-03-13 | Beaver Migration 🦫         | Knex.js migration system, system app convergence, optimistic CRUD                                                            |
| 0.53.0-alpha | 2026-03-05 | Lucky Set 🍱                | Sets and constants, drag-and-drop ordering, metahub settings                                                                 |
| 0.52.0-alpha | 2026-02-25 | Tabular Infinity 🤪         | TABLE attribute type, inline editing, NUMBER field improvements                                                              |
| 0.51.0-alpha | 2026-02-19 | Counting Sticks 🥢          | Enumerations, migration guard, data-driven MainGrid                                                                          |
| 0.50.0-alpha | 2026-02-13 | Great Love ❤️               | Template system, declarative DDL, layout widgets, cloning                                                                    |
| 0.49.0-alpha | 2026-02-05 | Stylish Cow 🐮              | Layouts system, MUI 7 migration, display attributes, VLC support                                                             |
| 0.48.0-alpha | 2026-01-29 | Joint Work 🪏                | Metahub branches, three-level system fields, optimistic locking                                                              |
| 0.47.0-alpha | 2026-01-23 | Friendly Integration 🫶      | Publication versioning, schema-ddl package, runtime migrations                                                               |
| 0.46.0-alpha | 2026-01-16 | Running Stream 🌊           | Applications modules, metahubs publications, DDD refactoring                                                                 |
| 0.45.0-alpha | 2026-01-11 | Structured Structure 😳     | Catalogs functionality, VLC localization, i18n integration                                                                   |
| 0.44.0-alpha | 2026-01-04 | Fascinating Acquaintance 🖖 | Onboarding wizard, GDPR consent, Yandex SmartCaptcha                                                                         |
| 0.43.0-alpha | 2025-12-27 | New Future 🏋️‍♂️               | Onboarding wizard, start pages i18n, pagination fixes                                                                        |
| 0.42.0-alpha | 2025-12-18 | Dance Agents 👯‍♀️             | VLC system, dynamic locales, Flowise 3.x agents integration                                                                  |
| 0.41.0-alpha | 2025-12-11 | High Mountains 🌄           | UUID v7 infrastructure, auth-frontend package, dynamic roles                                                                 |
| 0.40.0-alpha | 2025-12-05 | Straight Rows 🎹            | Admin panel with RBAC, package extraction, global naming refactoring                                                         |
| 0.39.0-alpha | 2025-11-25 | Mighty Campaign 🧙🏿          | Campaigns integration, storages management, useMutation pattern                                                              |
| 0.38.0-alpha | 2025-11-21 | Secret Organization 🥷      | Organizations module, projects hierarchy, AR.js quiz nodes                                                                   |
| 0.37.0-alpha | 2025-11-13 | Smooth Horizons 🌅          | Agents system, clusters module, OpenAPI 3.1 refactoring                                                                      |
| 0.36.0-alpha | 2025-11-07 | Revolutionary Indicators 📈 | Metaverse dashboard, analytics charts, sections refactoring                                                                  |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃               | Rate limiting with Redis, i18n refactoring, TypeScript modernization                                                         |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️              | Global monorepo refactoring, tsdown implementation, dependency centralization                                                |
| 0.33.0-alpha | 2025-10-16 | School Test 💼              | Metaverses module, quiz timer, publication system fixes                                                                      |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴            | Publication system, Base58 links, access control, role-based permissions                                                     |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆         | Canvas versioning, Material-UI template system, UPDL refactoring                                                             |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪                | Passport.js + Supabase hybrid auth, Vitest coverage, AR.js camera mode                                                       |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒         | Metaverses architecture, cluster/domain/resource isolation, publication settings                                             |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨           | Resources and entities services, spaces refactoring, CTE queries                                                             |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣           | Template modularization, finance module, multiplayer-colyseus integration                                                    |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌            | MMOOMM template extraction, PlayCanvas integration, Kiro IDE config                                                          |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼            | Metaverse module MVP, Space Builder, Gemini Code Assist rules                                                                |
| 0.24.0-alpha | 2025-08-12 | Stellar Backdrop 🌌         | Space Builder prompt-to-flow, AR.js wallpaper mode, uniks extraction                                                         |
| 0.23.0-alpha | 2025-08-05 | Vanishing Asteroid ☄️       | UPDL conditional parameters, custom modes system, Russian docs                                                               |
| 0.22.0-alpha | 2025-07-27 | Global Impulse ⚡️          | MMOOMM modular architecture, laser mining, inventory refactoring                                                             |
| 0.21.0-alpha | 2025-07-20 | Firm Resolve 💪             | PlayCanvas MMOOMM stabilization, handler refactoring, ship controls                                                          |

---

## 2026-06-29 - Interpretation Network Runtime Menu Improvements

Implemented the Interpretation Network runtime/menu improvement plan without schema or template version bumps.

-   Added shared dashboard side-menu configuration contracts and validation helpers, including `wide`, `compact`, and `overlay` modes with safe defaults.
-   Materialized menu widget targets to runtime UUIDs during application sync so metahub/application renames and codename changes no longer break published navigation.
-   Updated metahub and application layout editors with localized side-menu mode settings and UUID-backed, human-label menu target selectors.
-   Reworked the published apps-template side menu with the existing MUI dashboard primitives: permanent wide menu, compact icon-only menu, overlay drawer, accessible mode switching, mobile/fallback menu behavior, and no page-level horizontal overflow.
-   Cleaned up Interpretation Network runtime naming and create surfaces: `Structure`/`Name`, no required Context field in structure creation, a standard MUI cell dialog, a Structure screen `Matrix` tab, and matrix cell move-not-swap behavior.
-   Regenerated `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` from the Playwright product generator and strengthened the fixture/import E2E contract.
-   Updated EN/RU GitBook docs for Interpretation Network and application layouts.
-   Verified on Node 22 with local minimal Supabase where needed: shared types/utils Vitest, backend sync/layout Jest, metahubs template-shape Jest, apps-template focused Vitest with `--coverage=false`, applications/metahubs focused Vitest, `build:e2e:local-supabase`, fixture generator, fixture contract, and Chromium imported snapshot flow with browser proof for wide/compact/overlay menu modes.
-   Closed the final keep-mounted Drawer test-oracle gap by scoping docked and overlay navigation separately. The default control now proves `wide -> compact -> wide` without entering overlay mode, while a separate overlay opener is exercised at desktop, tablet, and mobile widths with Escape dismissal and page-overflow checks.
-   Closed the final autoreview findings: cross-row matrix moves now compute in-memory ordering with the same generated column key/label that is persisted, and the side-menu mode is initialized from validated local storage before the first visible render instead of reconciling through a post-mount chrome reset.
-   Final closeout passed: apps-template Dashboard + Interpretation Network focused tests 37/37, full apps-template Vitest 433/433, apps-template lint/build, full E2E build 36/36 packages, apps-template isolation guard, `git diff --check`, OntoIndex pre-commit audit `READY`, and local-minimal-Supabase Chromium imported-snapshot coverage 3/3. Responsive screenshots for wide, compact, and overlay states were inspected at `1920x1080`, `768x1024`, and `390x844`.
-   Closed the 2026-07-01 rebuilt-project follow-up: the metahub side-menu shared-behavior description is localized in Russian, published-app toolbar actions align with the content edge, the overlay-mode control lives in the bottom-left side-menu controls, overlay toggling hides/restores the docked menu instead of layering drawers, and compact mode keeps normal-sized vertically stacked controls. Focused Dashboard/CRUD/Interpretation Network Vitest, backend sync Jest, apps-template full Vitest, apps-template and applications-backend build/lint, fixture/isolation guards, Supabase local status/doctor, browser screenshot evidence, and final autoreview all passed. OntoIndex change detection exited successfully but reported critical scope because the current dirty worktree is intentionally broad.
-   Closed the second 2026-07-01 rebuilt-project follow-up: the published-app toolbar now measures against the same 1700px content rail as `MainGrid`, wide/compact tooltips use next-action labels, overlay mode exposes a left-side opener instead of a right-corner control, and closed overlay mode gives the `Structures` page the full available width. The Playwright oracle was strengthened to prove toolbar/content right-edge alignment and overlay full-width geometry at `1920x1080`, including the real `Structures` page in open and closed overlay states. Validation passed: apps-template Dashboard Vitest 16/16, apps-template lint, apps-template isolation guard, Prettier check, `git diff --check`, local-minimal-Supabase Chromium imported snapshot flow/smoke 3/3, and inspected screenshots `side-menu-overlay-structures-desktop-1920.png` plus `side-menu-overlay-structures-closed-desktop-1920.png`. OntoIndex impact was ambiguous by fuzzy symbol because legacy and apps-template symbols share names; `pnpm ontoindex:changes` completed but reported critical scope for the broad existing dirty tree.

## 2026-06-28 - Interpretation Network Materials UX Follow-Up

Closed the latest manual QA follow-up for the generic Interpretation Network materials workflow.

-   Changed the Structures right pane so the first-use and no-cell-selected states show contextual guidance only; the Materials heading and Add material action now appear only after a matrix cell is selected.
-   Reworked selected-cell Materials inside `apps-template-mui` with local runtime primitives: `CustomizedDataGrid` table mode, compact table/card toggles, full-card click targets, row/card action menus, localized Title and Description metadata dialogs, and a body-only Editor.js material editor with language tabs plus add-language flow.
-   Kept the material architecture aligned with the Page model by treating Material as a Page-like Object with localized metadata and Editor.js Body while preserving the `apps-template-mui` isolation boundary from legacy metahub/template UI packages.
-   Updated the Interpretation Network seed and committed fixture so `Material.Title` is localized/versioned, then recomputed the snapshot hash.
-   Updated browser coverage for the imported snapshot so the flow now proves empty Structures guidance, cell selection, material creation, table/card modes, metadata edit menu, body-only Editor.js editing, add-language, body save, technical-leakage checks, and responsive viewport matrix.
-   Verified: focused `InterpretationNetworkWorkspaceWidget` Vitest passed 13/13, `@universo-react/apps-template-mui` build/lint passed, apps-template isolation guard passed, GitBook i18n check passed, metahubs-backend `interpretationNetworkTemplateShape` passed 12/12, the Interpretation Network fixture contract passed, `git diff --check` passed, OntoIndex `detect-changes` reported medium expected risk, and Chromium `Interpretation Network imported snapshot @flow` passed 2/2 on local minimal Supabase.

## 2026-06-27 - Generic Interpretation Network Runtime Naming And Materials Closure

Closed the latest post-import implementation slice for the generic interpretation-network runtime.

-   Renamed the active product fixture to `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` and removed Suzdal/Suz-Dal naming from the active template, fixture contract, i18n namespace, cell-style types, runtime tests, and E2E helper names.
-   Updated the runtime workspace contract: the first left pane lists/creates Structures; after opening a Structure, the left pane switches to the structure internals and matrix; the right pane is materials-only for the selected matrix cell.
-   Reworked Materials in `apps-template-mui` as a page-like runtime surface with title filter, table/card view toggle, create dialog limited to Title/Description, and a separate opened-material editor with localized fields plus Editor.js Body.
-   Added `Material.Description` to the interpretation-network seed model and committed fixture, then recomputed the snapshot hash.
-   Verified: focused `InterpretationNetworkWorkspaceWidget` Vitest passed 13/13, metahubs-backend `interpretationNetworkTemplateShape` Jest passed 12/12, and `pnpm run check:interpretation-network-fixture-contract` passed.

## 2026-06-26 - Interpretation Network Interpretation Network Runtime Remediation

Implemented the remediation plan for the Interpretation Network interpretation-network runtime and replaced the previous dashboard-shell output with the real two-pane workspace workflow.

-   Added a generic metadata-driven `interpretationNetworkWorkspace` widget in `@universo-react/apps-template-mui`, reusing the existing dashboard, workspace, table, row-action, dialog, and Editor.js preview primitives where possible. The published Interpretation Network app keeps the left main menu/workspace switcher and now uses the current split: Structures list first, opened structure internals/matrix on the left, and cell Materials only on the right.
-   Rebuilt the `interpretation-network` template and committed `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` from the product Playwright generator. The fixture contract now rejects unrelated demo dashboard widgets and requires the basic-derived entity model, Set-backed options, nested matrix cells, cell styling, relation endpoints, Editor.js material attachments, and workspace-authored table templates.
-   Strengthened runtime TABLE row APIs and dialogs so child rows carry `workspaceId`, cell styling is validated through a structured field, relation/material previews avoid raw IDs or JSON, and localized Editor.js block text is summarized safely.
-   Updated EN/RU GitBook docs, package/E2E README notes, generator/import/smoke/visual Playwright suites, backend template-shape tests, app-template unit tests, and the Interpretation Network fixture contract.
-   Verified: `docs:i18n:check`, `docs:gitbook-screenshot-assets:check`, `git diff --check`, `build:e2e:local-supabase`, Interpretation Network fixture gate, metahubs-backend focused Jest, apps-template focused test/build, Chromium imported snapshot flow, full `--grep "Interpretation Network"` browser suite, and OntoIndex `detect-changes` (medium risk, expected `FormDialog` flows). Thermos/autoreview found and drove fixes for relation scoping plus Editor.js material preview/localized text extraction; the final rerun was blocked by an external Codex engine `503 Service Unavailable` before a valid JSON report was returned.

## 2026-06-27 - Interpretation Network Post-QA Runtime Closure

Closed the Post-QA remediation checklist for the Interpretation Network interpretation-network runtime.

-   Tightened the latest manual QA fixes: the Interpretation Network app now opens on the `InterpretationNetworkIntro` Page, while `interpretationNetworkWorkspace` is scoped to the `Structures` (`Concept`) section through `visibleFor`; the fresh `Structures` surface keeps only `Create structure` in the left pane and moves the empty-state memo to the right pane.
-   Updated the committed `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` with the scoped widget metadata and recomputed the snapshot integrity hash; the fixture contract now rejects a Interpretation Network workspace widget that is not limited to `Structures` / `Concept`.
-   Added regression coverage proving the empty Structures left pane has no old prompt text, no left `Add page`, right-pane material authoring remains available for selected cells, and selected colored cells keep their configured fill/border instead of turning black.
-   The published app flow now proves the localized `Structures` return navigation, the `Workspaces` round trip, two-pane interpretation workspace rendering, right-pane material body rendering, responsive no-overflow guards, workspace table-template creation, and row-scoped copy of `Workspace matrix template`.
-   The focused widget suite now covers permission-aware controls, selected-structure page creation, matrix mutation rollback/error states, keyboard-accessible cell movement, Editor.js material authoring, cell style editing, and visible template copy behavior.
-   Verified on Node 22 with local minimal Supabase where needed: Interpretation Network fixture contract, focused `InterpretationNetworkWorkspaceWidget` Vitest file (10 tests), `apps-template-mui` lint/build, `build:e2e`, Chromium imported snapshot Playwright flow (2 tests), full Chromium `--grep "Interpretation Network"` browser suite (4 tests), `git diff --check`, and OntoIndex `detect-changes` (medium expected risk across the Interpretation Network/FormDialog diff). The advisory Thermos/autoreview command was stopped after 20 minutes of heartbeat without a final JSON report; no child review process remained.

---

## 2026-06-21 - MMOOMM PlayCanvas Visual Linkup Lab Implementation

Implemented the second PlayCanvas project in the canonical MMOOMM app fixture
as an Editor-reviewable and runtime-visible weak-linkup visual comparison lab.

-   The Playwright product generator now creates two bound Projects instances:
    `MMOOMM Authoring` for the existing flight simulator and
    `MMOOMM Visual Linkup Lab` for 16 visual variants. Project targeting is
    role/name-aware instead of row-order based, and both projects are published
    with role-aware runtime manifest checks.
-   The lab scene is authored through the existing PlayCanvas Editor flow and
    preserved through the compatibility save path. The fixture contract now
    verifies the two project roles, keeps the strict flight scene assertions,
    and separately validates lab metadata/variant coverage for ships, stations,
    rock asteroids, and ice asteroids.
-   Runtime support was added without a parallel app shell: generic
    `@universo-react/playcanvas-engine` helpers render translucent white
    primitives, low-poly geometry, dense fog, and colored glow shells through
    the existing `apps-template-mui` `playcanvasCanvas` widget when
    `metadata.mmoomm.visualLab` is present.
-   Snapshot/export now preserves PlayCanvas scene entity metadata end to end:
    shared bridge schemas allow bounded JSON metadata, the Editor artifact
    serializer includes entity metadata, backend compatibility normalization
    keeps it, and publication snapshot/runtime manifest export carries both
    `mmoomm.scene` and `mmoomm.visualLab`.
-   Documentation updated in EN/RU MMOOMM flight simulator guides and the
    PlayCanvas engine README. The vendored PlayCanvas Editor frontend was not
    modified.
-   Verified: `@universo-react/metahubs-backend` build; focused backend Jest
    suites for project snapshots, snapshot serialization, and project service;
    shared types bridge tests; PlayCanvas engine tests; PlayCanvas Editor
    frontend tests; apps-template widget tests; fixture drift check; and the
    full combined `pnpm run test:e2e:mmoomm-app-gate:local-supabase`
    (generator 2/2, drift clean, runtime import 2/2). OntoIndex diff
    verification was rerun with the expected file set and passed. Advisory
    autoreview could not start because the local Codex state DB is read-only
    (`~/.codex/state_5.sqlite`), so manual review plus focused tests were used.

---

## 2026-06-19 - Dialog scrollbar + PlayCanvas unbind regressions (2 user-reported)

Two regressions reported with screenshots; both fixed at the root cause with tests.

-   **Unbind no-op — root cause was the backend shallow-merge, not the surface.** Entity `update` PATCH (`MetahubObjectsService.updateObject`) merges `config` as `stripUndefinedEntries({...existing.config, ...input.config})`, so an absent key means "leave unchanged" (`stripUndefinedEntries` drops `undefined`, never `null`). `ProjectBindingSurface.writeBinding(null)` used `delete config.projectBinding`, so the omitted key let the server binding survive the merge (200 + success toast + cache refetch still carried the binding). Fix: send the documented clear signal `projectBinding: null` (`config.projectBinding = nextBinding ?? null`). `null` survives `stripUndefinedEntries`; every reader treats it as unbound. `JSON.stringify` drops `undefined`, so `null` is the only client-side clear signal that reaches the server.
-   **Spurious dialog scrollbar — root cause was the stored resize height used as a hard cap.** `dialogPresentation` persists a per-metahub dialog size (`storageScopeKey: metahubId`), applied as fixed `height: min(viewportHeight, storedHeight)`; when stored height was shorter than another dialog's content, `DialogContent` (`overflowY:auto`) showed an inner scrollbar. Fix: when idle, apply stored height as `minHeight` (a floor) not fixed `height`; exact `height` still pinned during active resize drag (`isResizing`).
-   **Tests:** template-mui jest +1 (stored size as `minHeight` floor); metahubs-frontend vitest — rewrote `ProjectBindingSurface` unbind test for null-clear contract; backend jest +1 (`projectBinding: null` clears, absent key keeps); E2E `metahub-projects-section.spec.ts` +unbind-confirm flow with data-truth assertion.
-   Verified: ✅ template-mui jest 263/265 (2 pre-existing XSS failures), metahubs-frontend vitest 351/351, backend full sweep 0 new regressions (4 known pre-existing failing suites), projects-section E2E green on local minimal Supabase; lint + prettier + tsc clean; vendor PlayCanvas Editor untouched.

## 2026-06-19 - PlayCanvas Projects: Non-object-like preset + "Bind existing" + dialog fix

Three QA follow-ups closed in one pass, all from the user's "make project like Enumeration" direction.

-   **Project preset is now a dedicated (non-object-like) type.** `PROJECT_TYPE_CAPABILITIES` reduced to `treeAssignment:enabled` + `projectBinding:enabled`; all other capabilities `false`. `PROJECT_TYPE_UI.tabs = ['general','hubs','project']` — no Components/Layouts/Modules/Actions/Events on a fresh metahub. Capability set is dependency-clean. Generic null-behavior CRUD path already covers `project` (no frontend routing/permission changes needed).
-   **Tracked MMOOMM snapshot fixture regenerated** for the new capability set; `projectBinding.projectId` remapped to freshly-generated project id via existing snapshot-import post-pass. MMOOMM app gate green (drift clean, generator 2/2, runtime import 2/2).
-   **"Bind existing project" UI (Phase 3).** PlayCanvas tab adds a second action with an MUI `Autocomplete` picker fed by `playcanvasProjectsApi.list` + `listEntityInstances({kind:'project'})`, "Show only unbound" Switch (default on), "Already bound" warning chip on shared projects. **Cascade-safety backend guard:** `MetahubObjectsService.countActiveProjectBindingsByCodename` (filters `_mhb_deleted=FALSE`) lets `cascadeBoundProject` skip project deletion when other instances still reference it, so deleting one instance no longer orphans a shared project.
-   **Dialog label clipping fix (Phase 2).** Create-and-bind dialog content stack `pt: 0.5 → 1.5` so the outlined TextField floating label is not clipped by the scroll `DialogContent`.
-   Tests: `projectPresetTemplate.test.ts` rewritten (non-object-like contract); backend +2 (`countActiveProjectBindingsByCodename`), +2 route (cascade fires/skipped by sibling count); frontend `ProjectBindingSurface.test.tsx` +2 (picker write, unbound-only filter), 13/13.
-   Verified: ✅ FE vitest 351/351, BE 1048 passed (+4 this work, 4 pre-existing failures, 0 new regressions), builds + lint + prettier clean, i18n docs 98/98, MMOOMM app gate green, projects-section E2E 3/3 local minimal Supabase; vendor Editor untouched.

## 2026-06-18 - PlayCanvas Projects: QA Round 2 (5 user-reported defects)

Closed 5 defects from manual QA of a metahub imported from the tracked MMOOMM app snapshot.

-   **P1 (no code change):** `tools/fixtures/.generated-*.json` is a gitignored drift-comparison artifact; safe to delete between runs.
-   **P2 (remove junk row action + page):** removed the row "Open project" descriptor + handler, standalone `/project` route, `ProjectBindingPage` lazy import. Renamed `ProjectBindingPage.tsx → ProjectBindingSurface.tsx` (always chrome-less). Binding management lives only in the edit-dialog "PlayCanvas" tab.
-   **P3 (tab rename):** binding tab is now "PlayCanvas" (was "Project") — EN+RU keys, fallback, backend preset surface title; removed unused `openTab` key.
-   **P4 (editor opened wrong project):** root cause stale cached `config.projectBinding.projectId`. (a) Snapshot import added `remapEntityProjectBindingReferences` post-pass (`jsonb_set` remapped project id). (b) Row "Open editor" resolves the LIVE project id by codename, falling back to cached id. `hasBoundProjectId → hasBoundProject` (codename OR id).
-   **P5 (spurious dialog scrollbar):** `DialogContent` `overflowY:'visible'` + `overflowX:'hidden'` computes to `auto` per the CSS overflow spec. Fixed at source: `dialogPresentation.contentSx` sets both axes explicitly. (Superseded as a full fix by the 2026-06-19 minHeight-floor change.)
-   Tests: +1 backend (projectId remap), reworked E2E to drive binding through the dialog tab + scrollbar/row-menu guards. Verified: ✅ FE vitest 349/349, BE 1044 passed, builds + lint + prettier clean, E2E 3/3 local minimal Supabase.

## 2026-06-18 - PlayCanvas Projects: Code-Review Remediation (10 findings)

Closed all 10 findings from the 2026-06-18 high-effort code review of the PlayCanvas "Projects" entity-type binding work.

-   **#1 Embedded binding tab:** `ProjectBindingSurface` takes explicit `metahubId`/`entityId` props (fallback `useParams`); the dialog tab passes them so it loads/saves the real binding.
-   **#2 Branch-schema mismatch:** binding validation resolves project via `PlayCanvasProjectsService.resolveBoundProjectByCodename` (default-branch store); `validateAndResolveProjectBinding` takes a `resolveProject` resolver, removing schema-resolution duplication.
-   **#4/#6/#7 Editor-open dedup:** new shared `packages/api/playcanvasEditorHost.ts` (`usePlayCanvasEditorHostQuery`, `resolveEditorDisplayMode`, `openPlayCanvasEditor`) used by both card and row action — one cache key, one URL/`?projectId=` contract.
-   **#5 projectId shape:** `validateProjectBindingConfigForEntity` rejects non-string/empty `projectId`. **#8:** removed dead import. **#3 tests:** +2 packagesRoutes, rewrote resolver tests, added `resolveBoundProjectByCodename` + shape tests; fixed 2 `useCallback` dep arrays.
-   **#9 Canon Refresh + #10 activeContext compression:** version 0.65.0 → 0.69.0-alpha in canon; added `project` preset + `playcanvas` template; `activeContext.md` 389 → 122 lines.
-   **Codex follow-up (2 P2):** embedded tab exposed actions before data settled (single `wrap()` helper now applies loading/error guards in both modes); private cache key → canonical `useEntityInstanceQuery` with `invalidateEntitiesQueries.all(kind)` + `.detail(entityId)` on every write.
-   Verified: ✅ FE vitest 349/349, BE touched suites green + 0 new regressions, builds + lint + prettier clean, E2E 3/3 local minimal Supabase. Deliberately unchanged: `MetahubPackagesTab.openEditor` keeps package-level always-new-tab behavior.

## 2026-06-17 - PlayCanvas Metahub Template + "Projects" Entity Type (code complete)

-   Added `projectBinding` capability in `@universo-react/types` and threaded it through the Entity Type Constructor (normalizer, default, capability toggle, resource surface). Removed the silent-drop bug for unknown capabilities. Registered the `project` preset (object-like-minimal, `sidebarOrder: 5` — above Hubs) and the `playcanvas` metahub template (no package-declaration field; the `MetahubTemplateManifest` schema doesn't support that).
-   Server-side `config.projectBinding` validation on create/update (`validateProjectBindingConfigForEntity`) + cascade-delete on instance removal (`PlayCanvasProjectsService.deleteBoundProject`, idempotent on stale binding). New `ProjectBindingPage` resource surface on `template-mui` primitives; row action menu entry; route `entities/:kindKey/instance/:entityId/project`; EN/RU i18n; component tests (4, vitest green).
-   Removed `PlayCanvasProjectsPanel` from `MetahubPackagesTab.tsx`; pruned obsolete tests; deleted dead `packages.projects.*` i18n keys; reworked `metahubs-mmoomm-app-export.spec.ts` to author the project through the Projects section; `mmoommAppFixtureContract.assertDomainModel` requires a project instance with `config.projectBinding.projectCodename`. GitBook EN/RU `projects-entity-type.md` + `playcanvas-template.md` + cross-links + `SUMMARY.md`. Backend full jest: 0 regressions (4 pre-existing failing suites unchanged, 2 new suites +12 tests green).

## 2026-06-17 - PlayCanvas Projects Section Live E2E Pass + MMOOMM-app-gate Regeneration

-   **Live E2E pass:** `metahub-projects-section.spec.ts` 3/3 green on local minimal Supabase (auth setup, bound-state, empty-state) through `pnpm supabase:e2e:start:minimal` + `env:e2e:local-supabase` + `build:e2e` (36 tasks, 0 failures). Fixed 3 real spec bugs (passed `page` not `browser` to `createLoggedInBrowserContext`; passed `runManifest` to `createMetahub`; `expectNoTechnicalLeakage` was given a `Page` not a `Locator`). Added `listEntityInstances` to `tools/testing/e2e/support/backend/api-session.mjs` (imported by two specs, never exported; corrected URL to include `/api/v1`). Added empty-state test + responsive matrix (1920×1080 / 768×1024 / 390×844) with `expectNoPageHorizontalOverflow`. Visual evidence: bound/empty cards, Projects above Hubs, no raw UUIDs/JSON.
-   **MMOOMM-app-gate live regeneration green** (generator 2/2, drift, runtime 2/2); tracked `metahubs-mmoomm-app-snapshot.json` regenerated with a `project` instance + PlayCanvas project + scene + runtime manifest. Three root causes fixed: (1) Editor fullscreen host blocked on a missing default project (the section binds a project to an instance, not a package) → new `setEditorDefaultProjectThroughBrowser` helper opens Settings → picks the bound project → PATCHes `/package/:attachmentId/config`; (2) `publishPlayCanvasProjectThroughBrowser` had a module-scope `api` reference → added `api: ApiContext` param; (3) `assertDomainModel` read a grouped-by-kind shape the serializer doesn't emit → rewrote to scan the flat `Record<id,{kind}>` (matching the existing `findEntityId` pattern).
-   Final verification: ✅ export spec 2/2 (3.0m), `check:mmoomm-app-fixture-drift` (1 project entity, 1 PlayCanvas project, 1 scene + 1 runtime manifest), runtime 2/2 (1.7m), prettier + eslint + `docs:i18n:check` clean.

## 2026-06-18 - QA Defects Closure (Projects Entity Type) — 13 issues

Closed all 13 high/medium QA issues. No tech debt, no schema bump, no legacy retained.

-   **Defect 2 (i18n):** `consolidateMetahubsNamespace` dropped the top-level `projects` key → every `t('projects.*')` returned the raw key. Added `projects` to `MetahubsBundle`/`Translation` + copied into consolidated return; Vitest asserts EN+RU against real consolidation.
-   **Defect 5 (CI-breaker):** removed dead `metahub-packages-resources.spec.ts` block testing the legacy panel; kept the supported Default-project Settings-dialog block.
-   **Defect 1 (irrelevant tabs):** `PROJECT_TYPE_CAPABILITIES` sets `actions/events/modules/layoutConfig/runtimeBehavior:false`; form shows only General/Hubs/Project. `runtimeBehavior:false` also breaks the `runtimeBehavior→layoutConfig` dependency.
-   **Defect security (Phase 4):** `validateAndResolveProjectBinding` resolves binding by codename against branch-scoped `_mhb_playcanvas_projects`; rejects missing/soft-deleted/projectId-mismatch; wrapped `cascadeBoundProject` in try/catch + `log.warn` so post-soft-delete failures don't surface a 409 + orphan.
-   **Defect 4 (`?projectId=` + mode-aware open):** `getAuthoringHost` accepts `?projectId=` override; `PlayCanvasEditorHostPage` reads it via `useSearchParams`; `openEditor` reads package `display.mode` → `openSeparately` new tab, `embeddedIframe` same tab. Pins editor to bound project (fixed "new project shows MMOOMM scene").
-   **Defect 3 (page vs tab, Phase 7):** split `ProjectBindingPage.tsx` into `<ProjectBindingSurface embedded>` (reusable body) + a thin route-only `<ProjectBindingPage>` wrapper. `EntityInstanceListContent.buildFormTabs` adds a `PlayCanvas project` tab when `showProjectBindingTab && mode === 'edit' && entityId`; the standalone route stays as a deep-link target.
-   **Defect 4 row menu (Phase 7.2):** "Open editor" row descriptor in `renderEntityActionMenu`, same mode-aware + `?projectId=` flow as the card; only offered when the row carries `config.projectBinding.projectId`.
-   **Tests (Phase 8/9/10/11):** +4 `deleteBoundProject` (id-first, codename-fallback, optimistic-lock throws, missing-ids no-op); +6 `validateAndResolveProjectBinding` (found, missing, projectId-mismatch, absent-binding, null-binding, malformed shape); new `metahub-projects-constructor.spec.ts` (Constructor toggles `projectBinding`, saves, creates an instance, asserts ONLY General/Hubs/Project tabs — the headline universal-constructor proof); Phase 10 extended `metahub-projects-section.spec.ts` to click every primary button (Unbind confirm + cancel, Publish, Open editor) and assert the editor popup URL pins `?projectId=`; +4 FE `ProjectBindingPage` (warning state, create-fail error snackbar, orphan-project rollback via `playcanvasProjectsApi.remove`, RU localization).
-   **Phase 12 (orphan cleanup):** `createAndBindMutation.mutationFn` wraps `writeBinding` in try/catch; on failure it calls `playcanvasProjectsApi.remove(project.id, project.version)` to roll back the just-created project (prevents the "create succeeded, bind failed, project orphaned" leak). BE jest 1037/1046 (4 pre-existing failures, 0 regressions); component vitest green.

## 2026-06-17 - OntoIndex Generated Skills Committed + Complement Slimmed

-   `ontoindex setup` generated 6 Claude-native skills under `.claude/skills/ontoindex/` (guide, cli, exploring, impact-analysis, debugging, refactoring) + `AGENTS.md` block + root `CLAUDE.md`. Decision: **commit them** so the team shares guidance (`.claude/skills/` is Claude Code's native discovery path; `.agents/skills/` is the project convention).
-   Slimmed `.agents/skills/ontoindex-code-intelligence/SKILL.md` into a thin complement: keeps only what generated skills lack — namespace-collision caveat, pnpm wrapper + golden queries, SQL-first edge-quality limitation. Registered generated artifacts in `.agents/skills/SOURCES.md` (AGPL-3.0-or-later, regenerable).
-   Verified: ✅ prettier clean, `check:agent-profiles` green. Branch `feature/ontoindex-setup-skills` (PR #857 merged; this is a follow-up).

## 2026-06-16 - OntoIndex Code-Intelligence Adoption (Phase A)

-   Adopted OntoIndex `v1.9.10` as a local developer/AI-agent code-intelligence tool. Additive, dev-only: no `@universo-react/*` package, no backend route, no UI, no DB, no schema/template version bump.
-   Added a safe wrapper `tools/ontoindex/run-ontoindex.mjs` using only Node built-ins (`node:child_process`, `shell:false`, argv array — injection-safe; platform-aware binary name for Windows `.cmd` shims). DI so the hermetic Vitest suite never needs the real binary; 7/7 tests pass; registered in `vitest.workspace.ts`; no dependency/lockfile change. Root scripts: `ontoindex:analyze`/`:status`/`:changes`/`test:tools:ontoindex`.
-   Authored project-native skill `.agents/skills/ontoindex-code-intelligence` (SKILL.md + `references/usage.md` golden queries), registered in `.agents/skills/SOURCES.md`, carrying the namespace-collision warning (code intelligence over source, not OWL/RDF/SPARQL, not the Rust `ontoindex-*` crates). Mirrored EN/RU GitBook docs `contributing/ontoindex-code-intelligence.md` (both `SUMMARY.md` entries + `screenshotExemptPages`); mirrored README/README-RU Tech Stack bullet. `.ontoindex` added to `.gitignore`.
-   Verified: ✅ `test:tools:ontoindex` green, `docs:i18n:check` green (96 pairs), screenshot-assets check green, prettier clean; missing-binary path verified (friendly hint, exit 127).
-   Outstanding: root `.mcp.json` could not be written by the agent (safety classifier blocks auto-launching MCP config) — documented for manual add. Phase 6 index pilot deferred (CLI not installed; no fabricated output). Plan: `memory-bank/plan/ontoindex-code-intelligence-plan-2026-06-16.md`.

## 2026-06-15 - PlayCanvas Editor v2.23.4 → v2.24.2 Upstream Update ✅

-   Replaced `vendor/playcanvas-editor/` snapshot (8 commits, 42 files) with upstream `v2.24.2` (peeled commit `00360100b3b5747648eb3d7287421ef25491f5c7`) via atomic `.next` rename. Updated 30 active-code metadata files (frontend package, types contract, editor-backend test, 4 metahubs-backend sites, rest-docs OpenAPI emitter + regenerated `index.yml`, READMEs EN/RU, `NOTICE.md`, 9 PlayCanvas Editor Skills, EN/RU GitBook docs). Verified zero remaining `v2.23.4` / `2.23.4` / `c4916f4…` references in active code paths.
-   New 3-guard governance surface: `check:playcanvas-editor-metadata` (fails on stale `2.23.4`/`v2.23.4`), `check:playcanvas-editor-vendor-drift` (developer-local only, no-op in CI), `.prettierignore` excluding `vendor/playcanvas-editor/**`. `playcanvas-editor-authoring` Skill extended with `## Upstream Update Governance` (11-step checklist for the next bump). Files: 30 active-code metadata + 9 Skills + 2 docs + 4 governance + 3 Memory Bank + 2 generated. Pattern: `playcanvas-editor-authoring/SKILL.md#upstream-update-governance`.
-   Verified: ✅ 14/14 unit, 30/30 E2E (desktop/tablet/mobile incl. the new v2.24.2 picker probe screenshot at `e2e/screenshots/v2-24-2-picker.png`), 42/42 editor-backend, 125/125 types, 123/123 metahubs-backend targeted, 95/95 EN/RU doc pairs, all 3 governance guards on clean state.

## 2026-06-16 - PlayCanvas Editor v2.24.2 PR CI Fix ✅

-   Fixed the CI-breaking `Error: invalid json at Ajax._onLoad` regression on the MMOOMM runtime import E2E (`snapshot-import-mmoomm-app-runtime.spec.ts:103`). Root cause: the v2.24.2 upstream Editor probes additional editor-api REST GET paths (`/builds`, `/apps`, etc.) during boot that the hosted shell's `createFullBootCloudApiResponse` did not handle; the unmatched request fell through to native, the static artifact server answered with HTML/empty body, and upstream `Ajax._onLoad` threw `invalid json` on `JSON.parse`.
-   Fix in `scripts/lib/playcanvas-editor-artifact.mjs` only (no vendored-source edit): fail-safe branch answers any unmatched editor-api REST GET with an empty cloud-only no-op (`{result:[],pagination:{hasMore:false,total:0}}` for list-shaped paths, `{}` otherwise); matched paths keep their exact responses.
-   Verified: ✅ exact failing command on local minimal Supabase (imported MMOOMM app runtime 2 passed, 1.5m) + 30/30 browser-smoke + 14/14 unit. Gemini review: applied 2 valid tool-file fixes (removed unused `fileURLToPath`; async sentinel read), declined 3 vendored-source suggestions (byte-identical to upstream `v2.24.2`, editing would break the vendor-drift guard — they belong upstream) + the 2-space indent suggestion (Prettier pins `tabWidth:4`).

## 2026-06-15 - MMOOMM PlayCanvas Fixture Cleanup Closure

-   Removed the upstream Editor's empty default `New Entity` authoring artifact from the canonical MMOOMM app fixture path without changing the vendored PlayCanvas Editor frontend or filtering valid empty/group entities in the backend.
-   Scoped the cleanup to the MMOOMM product generator helper: tests can still create a native `New Entity` to prove upstream Editor authoring behavior, but the MMOOMM fixture cleanup deletes empty default artifacts before save, export, and publication verification.
-   Added a fixture contract oracle that fails if any PlayCanvas scene exports a non-root entity named `New Entity` with no components and no children. Regenerated `tools/fixtures/metahubs-mmoomm-app-snapshot.json` through the UI-first Playwright generator — the tracked fixture now contains only `Root`, `MMOOMM Ship`, `MMOOMM Station`, and `MMOOMM Key Light` in the authored scene.
-   Verified: ✅ Prettier, scoped ESLint, fixture contract, fixture drift against the generated browser output, local minimal Supabase MMOOMM fixture generator Playwright, imported app runtime Playwright, `git diff --check`.

## 2026-06-10 → 2026-06-14 - MMOOMM Imported PlayCanvas Editor Viewport / ShareDB / Hydration

Series closing the user-reported imported `metahubs-mmoomm-app-snapshot.json` Editor regressions; vendored PlayCanvas Editor tree kept untouched throughout — all fixes at the Universo artifact/bridge/backend boundary. Verified per-slice: ✅ Editor frontend/backend Vitest, artifact build/smoke, focused metahubs-backend Jest, local minimal Supabase generator + runtime Playwright (2 passed), fixture contract + drift, `git diff --check`.

-   **UI-first runtime projection (06-10):** Playwright generator creates the metahub, connects Colyseus + PlayCanvas packages, authors the domain model/modules/layout through product UI, opens the hosted Editor, applies the MMOOMM scene via an iframe-local authoring control, publishes the PlayCanvas project, configures the runtime canvas widget, exports the snapshot. Aligned PlayCanvas canvas widget `runtimeManifest` bindings with the final generated publication checksum before snapshot hashing.
-   **Fixture browser proof (06-12):** canonical generator opens the fullscreen Editor through the visible Resources action popup; wired the Editor artifact build into both MMOOMM local-Supabase E2E commands; route-order regression guard (chrome-free fullscreen Editor matched before generic metahub + Resources routes); regenerated fixture, validated strict contract + drift.
-   **Product flow finalization (06-12):** generator captures the UI-created metahub id, creates publications + linked applications through the UI, drives schema creation through `ConnectorDiffDialog`, opens the fullscreen Editor through the package popup, exports the snapshot through the MetahubList download action. Split MMOOMM-specific Editor authoring/export helpers out of the generic helper to stay below the Thermos 1,000-line limit.
-   **Hydration hardening (06-13):** bridge normalizes saved/realtime entity records into `{resource_id,parent,children}`, reads persisted scenes through one response-shape helper, creates Editor entities without id-only `children` arrays, counts only real observer materialization as hydration success. Expanded render-component schema defaults so saved ship/station entities hydrate with standard fields + real viewport mesh instances.
-   **ShareDB compatibility closure (06-14):** full Editor selected imported entities but produced `Referenced element not a list` ShareDB errors. Backend ShareDB `apply` middleware repairs missing nested arrays on the in-memory snapshot only for upstream JSON0 list ops (preserves origin/token/allowlist checks). Frontend bridge bootstrap normalizes persisted/realtime `render`/`light` defaults so ship/station boxes hydrate with default material slots + a valid directional key light.
-   **Imported viewport closure (06-14):** MMOOMM entities appeared in hierarchy/inspector but the viewport didn't render Box meshes. Full-boot saves now refresh save status/checksum before bridge save; the generated artifact removes remote font/image/GitHub maintenance deps without weakening iframe sandbox permissions. Strengthened the E2E oracle (hierarchy, inspector, engine entities, `render.meshInstances`, key-light, camera projection/framing, pixel evidence inside projected mesh bounds, save/reload).

## 2026-06-08 - PlayCanvas Editor Skills and Thermos Review Integration

-   Implemented 9 PlayCanvas Editor Skills (`.agents/skills/playcanvas-editor-*`) + 3 Thermos Review Skills (`thermo-nuclear-review`, `thermo-nuclear-code-quality-review`, `thermos`).
-   Formulated 4 shared agent profiles under `.agents/agent-profiles/` and distributed 24 native copies across all 6 runtimes (`.codex`, `.gemini`, `.claude`, `.github`, `.qoder`, `.kiro`). Added `pnpm check:agent-profiles` (mapped to `tools/agents/check-agent-profiles.mjs`) as drift-control for agent profiles. Integrated Thermos correctness/maintainability rubrics with `autoreview` via `--prompt-file`.
-   Decomposed the 1908-line backend monolith `universo-react-playcanvas-editor-backend/src/index.ts` into a modular design (`src/config/`, `src/middleware/`, `src/tokens/`, `src/routes/`, `src/realtime/`) while preserving full API backward-compatibility. Implemented a Vitest structure-validation suite for AI Skills in `src/skills.test.ts`.
-   Verified: ✅ package tests, compiler type checks, and drift-checking scripts run successfully.

## 2026-06-07 - PlayCanvas Editor Full Upstream UI QA Closure

-   Closed the full upstream Editor UI boot QA findings around artifact origin trust, ShareDB document scope, WebSocket token lifecycle, stale realtime persistence, and browser-evidence gaps. Hardened full-boot artifact URL handling with trusted-origin allowlists + hostile-origin rejection. Exact ShareDB document allowlists for authenticated full-boot sessions + recoverable stale-persistence reseed from durable metahub storage after checksum/revision conflicts. Tightened realtime session claims (required session ids + nonces, token-expiry socket closure, active-session replay guards across realtime/messenger/relay).
-   Strengthened Playwright evidence for upstream toolbar, hierarchy, viewport canvas, assets panel, attributes panel, no fallback UI, no `/disabled` endpoints, scoped non-blank canvas pixels, ShareDB submit/pending, persistence without bridge save, responsive viewport coverage.
-   Verified: ✅ `playcanvas-editor-backend` test + build, metahubs-backend `PlayCanvasProjectsService` + `playCanvasEditorCompatibilityRoutes` Jest, focused local minimal Supabase `metahub resources packages tab is usable and localized` Playwright.

## 2026-06-07 - PlayCanvas Editor Full Boot WebSocket Token Origin Closure

-   Closed the QA/autoreview security finding where the full-boot config endpoint could mint WebSocket-capable Editor tokens for the caller's request origin when no explicit artifact origin/base URL was supplied. Full-boot token issuance now fails closed unless the request provides an artifact origin/base URL passing the existing trusted artifact-origin allowlist (REST-minimal compatibility token behavior unchanged). Added package-level + metahubs route-level regression tests for hostile full-boot config requests without artifact-origin evidence.

## 2026-06-07 - PlayCanvas Editor Full Boot UX And Reliability Closure

-   Closed the remaining full-boot UX/reliability findings: single localized status alert in embedded mode (no duplicate "Editor is ready" consuming vertical space), bounded flex iframe sizing with hidden overflow, conflict-guarded replay-completion upsert (recovery when a replay row disappears after commit), atomic project creation (row + default scene + pointer update + summary read in one transaction; deletion stays fail-closed on partial physical cleanup), bounded pre-auth WebSocket pressure via explicit unauthenticated connection limits.
-   Autoreview found + fixed 2 accepted defects: full-boot asset listing was hard-coded empty (now proxies the compatibility REST asset endpoint, maps metahub assets into upstream Editor asset documents, scopes ShareDB `assets` docs to exact signed-token `assetDocumentIds`); pre-auth WebSocket per-address limiter trusted spoofable `X-Forwarded-For` (now keys pre-auth sockets from transport `remoteAddress`).
-   Verified: ✅ focused metahubs FE Vitest + lint/build, metahubs BE Jest + lint/build, PlayCanvas Editor backend tests, root local minimal Supabase E2E build, targeted Chromium `metahub resources packages tab` Playwright, prettier, `git diff --check`.

## 2026-06-05 - PlayCanvas Editor Minimal Compatibility REST Backend (+ QA / E2E / drift closures)

All verified ✅ (types/metahubs-backend/playcanvas-editor-backend tests + builds + lint, rest-docs validate, frontend browser-smoke, local minimal Supabase Playwright packages flow, `git diff --check` (vendored CRLF only), `autoreview --mode local` clean). E2E needs fresh built workspace artifacts (rebuild `@universo-react/types` so prod imports pick up `dist`).

-   **Backend (impl):** added `@universo-react/playcanvas-editor-backend` as a non-user-facing protocol package exporting typed Express route factories with injected metahub storage/access ports. Extended shared compatibility contracts with Zod schemas (REST config, scene save/read DTOs, asset summaries, scoped settings docs, token claims, cloud no-op). Mounted manager-only same-origin REST routes under `/metahub/{id}/playcanvas/editor-compatible/projects/{projectId}` for config/scenes/assets/settings/cloud-only. Route factory wraps async handlers so access/domain errors flow through error middleware. Closed autoreview findings: root-level assets expose explicit `/` `virtualPath`; REST scene saves replay-idempotent by `requestId`. Out of scope (explicit): ShareDB op persistence, messenger WebSocket, collaboration, PlayCanvas Cloud jobs, broad asset parity.
-   **Backend QA repair:** replay-idempotent settings writes by `requestId`/fingerprint/project/kind/user; remapped project-scoped settings doc ids during snapshot restore; explicit same-origin CSRF contract (`/api/v1/auth/csrf` → `X-CSRF-Token`); replay-completion failure after a committed mutation keeps the in-progress claim as a duplicate-retry barrier; package-level `tsc --noEmit` validates test source against the exported DTOs.
-   **QA follow-up (host save gaps):** host CSRF token passed via bootstrap descriptor (artifact no longer fetches CSRF inside the iframe); loopback URL normalization (`localhost`/`127.0.0.1`/IPv6); scene-checksum hydration before the first compatibility REST write; retained pending iframe `bootstrapRequestId` + replay of `editor.bootstrap.init` after config/CSRF queries resolve; compatibility config requests include the iframe artifact origin (backend signs the REST token for that origin); direct REST conflicts throw a normalized `{ok:false,code:'saveConflict',status:409}` envelope + `bridge.saveError`.
-   **E2E + final drift closure:** `pngjs` declared in the frontend manifest; `identity.owner` can be `metahub`; replaced artifact-only wording in `vendor/UPSTREAM.md` with `universo-hosted` bridge-minimal scope; fixed autoreview data-loss finding (compact viewport no longer unmounts a loaded editor iframe); asset file OpenAPI matches the runtime contract (`sourcePath`, strict PUT, DELETE checksum precondition); public artifact manifest export reports `universo-hosted`.

## 2026-06-05 - PlayCanvas Editor Minimal Bridge Compatibility Slice + Frontend Package Rename

-   **Bridge-minimal slice:** updated vendored Editor frontend artifact to upstream `v2.23.4`; added typed `protocol.describe` bridge command + compatibility descriptor for `universo-bridge-minimal` mode (explicitly reports PlayCanvas Cloud REST / ShareDB realtime / messenger disabled). QA hardening: read-only `protocol.describe`, strict Zod descriptor/session validation, reject non-editor iframe bootstrap, remove synthetic admin/superUser claims, split ShareDB status from the metahub scene storage bridge. Integrated through the project service, bridge controller, read-only `/playcanvas/editor-compatible/.../protocol` namespace, hosted artifact bootstrap, OpenAPI, host E2E without a premature full backend package.
-   **Package rename:** workspace boundary → `packages/universo-react-playcanvas-editor-frontend` / `@universo-react/playcanvas-editor-frontend`; kept the user-facing slug/routes stable as `playcanvas-editor`. Updated workspace metadata, CI/tooling filters, Vitest entries, isolation guardrails, seed/default metadata, validation refs, docs.
-   Verified: ✅ types/metahubs FE+BE tests/build/lint, PlayCanvas Editor tests/build/smoke/browser-smoke, rest-docs lint, full local-Supabase E2E build, prettier, local minimal Supabase Chromium packages/resources Playwright 2/2. Full metahubs-backend has unrelated pre-existing failures outside the rename slice; targeted regressions for renamed paths passed.

## 2026-06-04 - PlayCanvas Editor Runtime Host, Bridge & Storage Adapter (impl)

-   Implemented the first real Universo-backed Editor authoring slice: hosted `universo-hosted` artifact mode, tokenized metahub artifact host URLs, typed bridge contracts, manager-only bridge command API, scene read/save through the PlayCanvas project storage model. Shared bridge schemas in `@universo-react/types`, backend HMAC bridge sessions with replay protection, package authoring host descriptors, OpenAPI coverage. Metahub host UI with TanStack Query, localized EN/RU safe states, MUI dialogs, iframe postMessage, dirty-state reporting, embedded + open-separately modes.
-   Hardened artifact hosting (CSP/referrer/nosniff/cache headers, `allow-scripts allow-same-origin` sandbox required by the Editor's localStorage/Worker/fetch/SW probes + no-op SW shim). Follow-up bridge closure: request-bound iframe bootstrap, replay cleanup after transient save failures, metadata-first scene-save conflict handling with guarded file writes, explicit `Escape` focus-return to the host.
-   Verified: ✅ shared types tests/build, artifact smoke + 15-test browser smoke (desktop/tablet/mobile), metahubs-backend controller/session/service tests + build, metahubs/core-frontend builds, OpenAPI generation/validation, full local minimal Supabase E2E build, Chromium `@packages` flow 2/2. Supabase stopped after the run.

## 2026-06-04 - PlayCanvas Editor Runtime Host — QA Rounds 2 / Final Acceptance / Host QA

-   **Bridge QA Round 2:** iframe-originated commands with missing/invalid UUID v7 request ids fail closed (no host repair); `PLAYCANVAS_EDITOR_PARENT_PUBLIC_ORIGIN` (stop trusting forwarded origin headers by default, documented trusted-proxy opt-in); closed OpenAPI drift for display settings + authoring host descriptors; negative token-tampering browser evidence; checksum-guarded rollback delete + scene-owned payload validation.
-   **Final acceptance closure:** replay rows no longer depend on UUID-shaped auth ids; replay responses status-tagged; production bridge/artifact HMAC secrets fail closed without explicit config; `scene.save` restricted to the session's selected default scene; bridge session id/nonce kept in bootstrap closure (not the public marker); hosted entity adapter registers `entities:new`/`entities:list` when the upstream entity API isn't initialized in sandboxed mode. Replaced parent-page debug staging in Playwright with iframe-visible Editor authoring actions.
-   **Runtime host QA closure:** fail-closed bridge replay completion after successful mutating commands; project/asset file delete APIs require + pass `expectedCurrentChecksum` (checksum-guarded physical removal, metadata restore on stale delete); hosted fallback exposes a `Add entity` control across viewports; Playwright covers non-resizable dirty/conflict dialogs + RU host lifecycle states.
-   Verified: ✅ focused metahubs-backend Jest, FE/BE lint, PlayCanvas Editor Vitest/build/browser-smoke (desktop/tablet/mobile), core-backend CSP/csrf tests, local minimal Supabase Chromium `@packages`/packages flow 2/2, `git diff --check`, local autoreview clean. Supabase stopped after runs.

## 2026-06-04 - Metahub Structure Baseline Reset

-   Reset metahub branch structure numbering back to baseline `CURRENT_STRUCTURE_VERSION = 1` and public semver `0.1.0` for the current test-stage project where databases are recreated from scratch.
-   Kept the full current system-table surface — including PlayCanvas authoring tables — in `SYSTEM_TABLE_VERSIONS[1]` so fresh metahubs are created with the complete baseline without structure-version bumps.
-   Reset built-in template + entity preset `minStructureVersion` values to `0.1.0` and aligned backend/frontend tests + mocks with the baseline.

## 2026-06-01 - PlayCanvas Editor Metahub Authoring Surface Settings (implementation)

-   Added shared package contracts for authoring surfaces, deterministic package slugs, per-metahub attachment display config, host descriptors, and explicit authoring-only runtime boundaries. Extended package schema with `obj_packages.authoring_surface` + `rel_metahub_packages.config` (forward migration + initial parity coverage). Seeded `playcanvas-editor-frontend` as authoring-only (empty `runtimeTargets`, default embedded config) while keeping runtime publication + module imports filtered to runtime-capable packages.
-   Authenticated package config APIs, authoring host resolution, artifact serving under the metahubs package route (manifest checks, traversal protection, cache/content headers, iframe CSP). Backend artifact-root resolves against the package layout with `PLAYCANVAS_EDITOR_ARTIFACT_ROOT` override so E2E CLI startup serves the built artifact. Metahub Resources Packages UI: authoring-aware surface labels, row action menu, localized display-settings dialog, route-first host page with iframe sandbox without `allow-same-origin`. Updated OpenAPI + EN/RU docs.
-   Verified: ✅ `@universo-react/types` build, full metahubs-backend Jest, applications-backend runtime-sync regression, metahubs-frontend + core-frontend + rest-docs builds, full `build:e2e:local-supabase`, focused Metahub Packages Vitest, local minimal Supabase `@packages` Playwright with host-page screenshots, `check:playcanvas-editor-isolation`.

## 2026-06-01 - PlayCanvas Editor Authoring Surface QA Closures (rounds 1–3)

All verified ✅ (focused metahubs-backend Jest, Metahub Packages Vitest, PlayCanvas Editor tests/browser-smoke, types/metahubs builds, full local-Supabase E2E build, local minimal Supabase `@packages` Playwright, `check:playcanvas-editor-isolation`, `git diff --check`, local autoreview clean).

-   **Settings QA Closure:** kept the legacy built-in package seed migration immutable, moved PlayCanvas Editor reseeding/default backfill to the authoring-settings migration, used stable seed-derived checksums. Preserved valid attachment config during direct reattach; normalized empty configs to descriptor defaults; registry updates bump `_upl_version` only when seed-backed fields actually change. Revalidated saved development-URL configs at the host read boundary (URLs saved under an older allowlist are blocked + omitted). Redacted dev URLs from the read-level list endpoint. Package attachment config in canonical snapshot hash normalization (tamper detection). Imported snapshots stay design-time; import-created publication uses runtime-mode serialization.
-   **QA Remediation Follow-Up:** stale/disabled display configs cannot serve the artifact after current server policy changes; backend dev-URL validation aligned with frontend contract (require http/https, reject credential-bearing URLs); host descriptor exposes currently-allowed display modes; settings dialog hides server-disabled dev-URL mode + shows localized policy copy + avoids transient MUI select warnings.
-   **Final Hardening Closure:** strict Zod validation for authoring-surface descriptors at registry + seed boundaries (malformed-descriptor regressions, metadata-only isolation-guard allowlist); host failure states with stable package heading + localized permission-denied + contextual unavailable (missing/blocked/disabled/misconfigured); response-level CSP sandboxing on artifact HTML so direct navigation can't bypass the route-first iframe sandbox; preserved design-time snapshot portability (restore saved dev-URL configs without applying current allowlist during import, host/API validation still fail-closed).

## 2026-06-01 - PlayCanvas Editor Authoring Surface QA Closures (rounds 4–6)

-   **Post-Review Defect Closure:** forced Editor host launch through document navigation; normalized dev-URL CSP frame sources to URL origins; regenerated the OpenAPI source from the fixed generator + verified package schemas (display-config union, `{items,total}` lists, catalog `id`, `resetConfig`, manager-only host descriptors).
-   **Final QA Evidence Closure:** DB-level authoring slug owner trigger for active `authoringSurface.packageSlug` in baseline schema + additive migration (rejects slug reuse by a different package name, preserves the versioned registry model); replaced the mobile reachability oracle with a real horizontal wheel gesture + scroll assertion; localized Back-to-packages action across host happy/open-separately/missing-artifact/permission-denied states; RU browser validation evidence for invalid Development URL.
-   **Final QA Findings Closure:** revalidated signed Editor artifact-token requests against the issuing user's current `manageMetahub` access + the current attachment display mode before serving static files; package version switching fails closed unless the user explicitly resets display settings; missing-artifact host-state browser screenshot + GitBook EN/RU docs for tokenized artifact request revalidation.
-   **Runtime Contract QA Closure:** kept package display settings design-time for this slice (removed the half-read `_app_packages.config` release-loader path while preserving copy/snapshot `packages[].config`); `ApplicationPackageDefinition` carries package identity/source/active only (no design-time authoring config); signed artifact-token route resolves the required manifest from the attached descriptor; narrowed the authoring-settings migration seed to the PlayCanvas Editor package so its data mutation matches the migration checksum contract.

## 2026-06-04 - PlayCanvas Projects UI QA Rounds 7–8 Closure

-   **Round 7 (storage validation):** scene payload refs must be JSON under `playcanvas-projects/{projectId}/scenes/`, asset refs under `assets/`, script refs require JS MIME/extension, generated artifacts JS under `generated/`; canonicalized metadata paths before persistence; nullable `output_checksum` until a real file checksum exists; project health ignores metadata-only placeholders in publish-blocking counts; PlayCanvas-only runtime sync reports manifest-only updates correctly.
-   **Round 8 (UI):** accessible empty-state images, editor open action matches its new-tab icon, short shared dialog footer labels, create-form spacing no longer clips the focused label. Strengthened frontend unit + Playwright coverage (loaded empty-state images, short dialog actions, no inline overflow, separate/embedded editor popup behavior).
-   Verified: ✅ metahubs-backend PlayCanvas/snapshot/package Jest matrix (185 tests), applications-backend sync Jest, shared types Vitest, ESLint, sequential dependent builds, `tools/lint-db-access.mjs`, GitBook i18n, local minimal Supabase `@packages` Playwright (2 tests), local autoreview clean.

## 2026-06-03 - PlayCanvas Project Storage Model for Metahubs (implementation)

-   Shared PlayCanvas project/scene/asset/script/generated-artifact/snapshot/runtime-manifest contracts in `@universo-react/types`. Branch-scoped `_mhb_playcanvas_*` authoring tables added to the fresh metahub baseline (no structure-version bump). Application runtime `_app_playcanvas_manifests` schema + publication hash/sync persistence for published manifests.
-   Metahub PlayCanvas project CRUD + safe file read/write/delete routes through `DbExecutor` stores + a guarded local file service. Integrated project metadata + local file payloads into snapshot export/restore/copy/delete/publication serialization. Minimal PlayCanvas projects panel inside the existing Packages resources surface (preserves package display settings + default-project pointer). EN/RU GitBook docs, summaries, OpenAPI, localized UI.
-   Verified: ✅ types/metahubs-backend/applications-backend/utils/metahubs-frontend focused tests, local minimal Supabase `metahub resources packages tab` Playwright, `tools/lint-db-access.mjs`, dependent package builds.

## 2026-06-03 - PlayCanvas Project Storage Model — QA Rounds (5–7 + repair/final/autoreview)

All verified ✅ (focused metahubs-backend PlayCanvas/snapshot/package Jest, applications-backend sync Jest, metahubs-frontend package UI Vitest, types/utils Vitest, `tools/lint-db-access.mjs`, GitBook i18n, local minimal Supabase Playwright packages flow, `git diff --check`, local autoreview clean).

-   **Initial QA closure:** project-scoped publish/export isolated before runtime manifest generation; authoring snapshot export split from runtime manifest (draft/recovery projects stay portable); runtime publication limited to configured package default projects (skips metadata-only placeholders, no null runtime URLs); merged scene/asset readiness status into exported refs before gating; stale application manifests removed when the latest publication drops projects; project ownership validation for exported script/binding/artifact rows; corrected optimistic-lock diagnostics.
-   **Round 5:** publication manifest persistence runs inside publication transactions; project delete separates pointer-cleanup rollback from partial file-cleanup fail-closed; requested project ids fail closed during export instead of silently dropped; asset file refs included in project file ownership checks; normalized persisted runtime manifest metadata for sync diffs; removed package settings `autoFocus` accessibility lint issue.
-   **Round 6:** split project-level vs asset file-path ownership (asset-owned files handled only by asset endpoints); project + asset file metadata marker updates return affected-row evidence + fail closed on zero rows; physical-file rollback preserved for failed write metadata updates; no physical delete when missing-marker updates touch zero rows; first-time scene/asset/script/binding/artifact upserts allowed without `expectedVersion`.
-   **Repair + Final + Autoreview closures:** child-row ownership guards; snapshot runtime-manifest remapping (project id remap applied to restored package `defaultProjectId`); asset-scoped file route enforcement; `defaultSceneId` validated against the same project (`null` = explicit clear); frontend delete invalidates project-list + package/detail queries; export always rebuilds runtime manifests from current metadata (not stale stored); bounded codename uniqueness suffix before insert; partial-index-compatible `ON CONFLICT` + soft-delete of all active manifests when publishing with no PlayCanvas manifests; generated-artifact `RETURNING` normalizes path/checksum/MIME into the adapter `outputFile`; `manageMetahub` required for export/file-read; missing storage tables no longer break copy/export; unsupported snapshot versions rejected before destructive cleanup; module source-tree copy narrowed to the `modules/` namespace.

## 2026-06-01 - File-Backed Metahub Module Sources (implementation)

-   First file-backed metahub module source slice for PlayCanvas-ready authoring: module source storable in a backend-managed source root + read by the running platform without a root rebuild; published apps stay bundle-only. Shared module storage contracts, source status metadata, file compile-status fields, diagnostic source filenames. Fresh `_mhb_modules` baseline gains nullable `source_code`/`storage_mode`/`source_path`/checksums/compile-status + partial unique active `source_path` index.
-   Filesystem boundary: relative `modules/` paths, `.ts/.tsx` allowlist, byte limits, checksums, atomic writes, symlink-containment checks, source-root isolation, metahub-copy support. Create/update/list/publish support `inline` + `file` storage (keeps `sourceKind=embedded` authoring semantics). Snapshot serialization/restore/copy/hash carry file-backed content + checksums. `UPL_MODULE_SOURCE_ROOT` CLI/env plumbing; Modules tab storage-mode + relative source-path fields; EN/RU GitBook docs.
-   Verified: ✅ types/modules-engine/utils/metahubs-backend/metahubs-frontend/core-backend builds, `ModuleSourceFileService` + `systemTableDefinitions` Jest, `EntityModulesTab` Vitest, `docs:i18n:check`.

## 2026-06-02 - File-Backed Module Sources — QA + Lifecycle Hardening Closures

All verified ✅ (focused/expanded metahubs-backend Jest, metahubs-frontend `EntityModulesTab` Vitest, applications-backend sync Jest, utils snapshot-hash Vitest, builds, `docs:i18n:check`, local minimal Supabase file-backed Modules Playwright, `git diff --check`, local autoreview clean).

-   **QA + checksum guard:** recompile file-backed modules when the external checksum changes even if `sourcePath` is unchanged; storage-aware `_mhb_modules` insert placeholders bind `config`/timestamps/creator to their own params; fail-closed current-file checksum checks for metadata saves / source-path changes / file→inline conversion; file→inline uses the current backend-managed source (not stale editor content); rejected symlink artifacts during source-tree copy (incl. symlinked source branch root); Modules tab save preflight refreshes file checksum but blocks stale drafts on concurrent version change.
-   **Snapshot/delete integrity:** shared-library sources + `sourceStorage.content` kept in published snapshots while runtime bundles stay null; shared libraries filtered out of `_app_modules`; snapshot-restored paths normalized + checksum-validated; destructive file-backed delete confirmation moved to a live source-file read under the source-path lock before soft-delete; localized MUI delete confirmation (file-backed warning copy + keyboard-confirmed Playwright).
-   **Lifecycle hardening + final defect closure:** required `expectedVersion` + `expectedSourceChecksum` for destructive deletes; cleanup physically deletes old source files only when the current checksum still matches the captured DB checksum; checksum-aware snapshot-restore cleanup + import rollback for restored source trees; advisory-lock-wrapped source-write critical sections (DB advisory lock + in-process source-path queue); `OptimisticLockError` → `409 OPTIMISTIC_LOCK_CONFLICT`; runtime-field allowlist before `_app_modules` sync (keeps `sourceCode`/`sourceStorage` out of sync diffs); hydrated file-backed records returned from create responses; best-effort post-commit / post-delete / copy-rollback cleanup (IO errors don't fail a committed soft-delete); historical v3 schema kept immutable (file columns only in v4); included `sourceStorage.path` in canonical publication hashes + refreshed committed LMS/Quiz fixture hashes; removed generated E2E `bin/storage` artifacts + added an ignore rule.

## 2026-05-31 → 2026-06-01 - PlayCanvas Editor Package Foundation (impl + QA + guard closure)

-   **Implementation (05-31):** added the isolated `@universo-react/playcanvas-editor-frontend` workspace package around a vendored Editor `v2.22.1` snapshot pinned to commit `0fcd44253ba1bba39c13d45b069265167249ecb6`. Artifact-only build + smoke tooling (builds upstream Editor from a temporary external workspace, writes a static artifact manifest, validates license/version/Node metadata, no Editor internals in the public API). Repository isolation + catalog guards (Editor/PCUI/Observer/vendored source cannot leak into other packages). Package-local Vitest + Playwright artifact smoke + GitHub Actions checks + EN/RU docs.
-   **QA remediation (05-31):** package-local browser smoke in CI + agent gates, Playwright evidence across desktop/tablet/mobile, hardened static artifact header + traversal checks, realpath path-boundary checks (encoded sibling traversal + symlink escapes fail closed), supply-chain guards (build scripts assert root lockfile hash stable, no-install/network scan of the script tree, negative fixtures, `ot-text` pinned to the resolved upstream commit), Editor-specific Vite `7.3.2` as an explicit catalog guard exception.
-   **Guard closure (06-01):** package script guard fails closed on additional install + network command variants (`npm ci`, `pnpm i`, bare Yarn, Corepack activate/install, Bun/Bunx, shell wrapper literals, git submodule network updates). Expanded negative Vitest fixtures for direct strings + split `spawn`/`execFile` args.
-   Verified: ✅ package-local TS check + Vitest, artifact build/smoke, Playwright browser smoke (desktop/tablet/mobile), catalog + package-naming + no-package-base + PlayCanvas Editor isolation guards, GitBook i18n docs check, `git diff --check`.

## 2026-05-28 → 2026-05-29 - MMOOMM Flight Simulator + Multi-Ship Authoritative Sync

All verified ✅ (colyseus-client/server Vitest, applications-backend realtime Jest, apps-template-mui Vitest, modules-engine compiler, local minimal Supabase MMOOMM generator + runtime Playwright 2/2, fixture contract, `git diff --check`, autoreview clean).

-   **Flight simulator QA closure (05-28):** the published metahub snapshot drives the PlayCanvas widget through a configured client runtime module and the Colyseus room through a configured server runtime module, with fail-closed module loading, hardened runtime-module responses, control/observer access coverage, and browser evidence for the playable loop. Browser-module runtime allowlist for compiled client bundles importing the generic PlayCanvas/Colyseus wrappers. Realtime matchmake loads the published server module by codename. Stabilized PlayCanvas widget lifecycle (no repeated app recreation on React re-render).
-   **Manual runtime usability + QA remediation (05-28):** explicit Welcome/Space navigation in the generator + fixture contract; generic widget `visibleFor` scoping by section id/codename; fit-viewport canvas without page scroll; camera-ray double-click target (default 720m); ship orientation toward predicted/authoritative movement (`data-ship-forward-*`); `MovementCommands` enum (`MoveToPoint`/`MoveToObject`/`Stop`) + `FlightSimulationConstants` set; schema-level duplicate scene-id validation; expanded realtime state model (unavailable/unauthorized/reconnecting/disconnected); removed inherited lower-details widgets; wheel-zoom ownership without page scroll; station-collision guard expanded by controlled-ship half extents (server helper + room options + isolated-vm shim). Fixed module compiler bundling for target-specific runtime imports (disabled virtual modules for the opposite bundle target).
-   **Multi-ship authoritative sync (05-29):** two authenticated users connect to one Colyseus world room, get separate server-owned ships, send movement intents only, observe each other in real time. Generic Colyseus helpers (deterministic safe spawn, keyed snapshot interpolation, prediction-queue ack). Authoritative multi-ship state with per-user ownership, strict Zod intent validation, duplicate-sequence rejection, safe spawn reservation, `onAuth`/`onDrop`/`onReconnect`. Isolated apps-template-mui PlayCanvas widget (local prediction, remote interpolation, local ship assignment, remote primitive rendering, localized realtime states, SDK reconnection, non-passive canvas wheel).
-   **Multi-ship runtime QA evidence + lifecycle closures (05-29):** unauthorized realtime no-movement browser assertions; pointer-capture release during drag/Escape (`data-pointer-captured` probe); stable `shipId` across two sessions per user (single ship in room state, survives one drop); authoritative `currentCommand`/`currentCommandObjectId` fields; capture-phase wheel ownership preventing propagation/scroll. **Spinoff:** application member role update route 500 fix (store auth context before role-level comparison; accept persisted `commentVlc: null`).

## 2026-05-30 - MMOOMM 3D Flight Orientation And Collision Closure

-   Replaced PlayCanvas ship rotation with full 3D forward alignment from authoritative/predicted headings (vertical movement pitches the primitive ship toward the target instead of sliding flat). Reworked movement/prediction collision envelopes from bounding-radius expansion to direction-aware oriented half-extents (preserves station/ship contact safety without the large nose-to-object standoff). Strengthened tests + browser oracles for lower-screen/vertical free-space double-clicks, ship forward vectors, oriented approaches, bounded clearance.
-   Verified: ✅ `git diff --check`, colyseus-server Vitest (18), apps-template-mui Vitest (336, incl. 19 PlayCanvasCanvasWidget), MMOOMM fixture contract, local minimal Supabase MMOOMM runtime Playwright 2/2, autoreview clean.

## 2026-05-27 - Autoreview Project Skill Adoption

-   Vendored + adapted the OpenClaw `autoreview` skill as a project-local `.agents/skills/autoreview/` workflow: concise Universo-specific closeout review guidance, copied helper scripts (`scripts/autoreview` + `scripts/test-review-harness` from OpenClaw `agent-skills` commit `7b6ca5b2078af2746d1c4424fe90211901b997ae`), explicit MIT attribution, validation commands that avoid live review-engine execution by default. Added SPDX/provenance comments; changed the harness default to Codex-only (other engines opt-in). Registered the skill + OpenClaw MIT notice in `.agents/skills/SOURCES.md`.
-   **QA + final closures:** replaced the implicit `git fetch origin --quiet` in branch-bundle generation with an explicit `--fetch` opt-in (so normal runs don't mutate remote refs) that fails closed when fetch fails; removed generated Python bytecode + switched syntax validation to AST parsing (no `__pycache__` recreation); wrapped Codex/Droid temporary prompt/schema cleanup in `finally` so engine startup failures don't leave review bundles on disk.
-   Verified: ✅ `quick_validate.py`, AST parse of `scripts/autoreview`, `bash -n` on the harness, `--help`/`--dry-run`, prettier, `git diff --check`, targeted grep for upstream-specific operational wording; fetch failure + missing-binary cleanup verified in a temporary git repo without invoking a live engine.

## 2026-05-25 - Flatten Base Directory Migration (impl + 2 QA closures)

-   Completed the package-layout flattening refactor: active packages use flat `packages/universo-react-<name>/package.json` (the old package-root `base/` layer removed); `pnpm-workspace.yaml` discovers via `packages/*`. Updated workspace, Turbo/package exports, local Supabase, E2E runner, OpenAPI/docs tooling, agent instructions, GitBook docs, READMEs.
-   **Final QA remediation:** added the stale-path checker + `start-frontend` views barrel to the tracked set, `core-backend/src/commands/index.ts` so command tests/oclif startup resolve `../commands`, `block-editor/vitest.config.ts` into the root workspace, wired `check:no-package-base-paths` into CI + the `test:e2e:agent` gate, asserted exact flat frontend env paths in local-Supabase script tests.
-   **Index + backend-matrix closure:** synced the Git index with the flat layout, removed the unnecessary root `migrations-platform` dev dependency, centralized the backend Jest mapper for `migrations-core` in `jest.base.config.cjs`, updated core-backend Jest mocks for flat resolution.
-   Verified: ✅ `pnpm install --frozen-lockfile`, `pnpm build`, vitest 192 files/1263 tests, backend Jest matrix (12 packages), `check:no-package-base-paths`, `git diff --check`, smoke E2E 11 tests local minimal Supabase, `turbo ls` (32 flat packages).

## 2026-05-25 → 2026-05-26 - Packages Naming Convention Rollout (+ QA closure)

-   Repository-wide package naming cutover: all 32 active workspace packages now use canonical `packages/universo-react-<name>/` dirs + `@universo-react/<name>` npm names. Legacy `universo-*` folders flattened into the new prefix (not double-prefixed); no compatibility aliases / re-export packages / publish aliases / symlinks for the old `@universo/*` scope. Rewrote all active cross-package imports, root scripts, workspace deps, Turbo/Vitest/Jest/Playwright tooling, local Supabase helpers, CI/agent guidance, GitBook docs, READMEs, steering docs. Published the convention in `.kiro/steering/structure.md` + `techContext.md`. Regenerated `pnpm-lock.yaml`.
-   Fail-closed guards: package naming, dependency-graph drift, stale package-base refs, `apps-template-mui` isolation, React package loading. Kept schema/template versions unchanged (only the canonical LMS fixture hash refreshed after name-only changes).
-   **QA closure:** removed active stale examples from agent guidance / README / GitBook architecture / Memory Bank; the naming guard now fails closed on double-prefix refs, removed-package examples, legacy filter examples, and generic package-layout wording; synced `lint-db-access.mjs` Tier-3 boundary paths to `packages/universo-react-*`; added `check:package-naming` + `check:apps-template-isolation` to the main workflow.
-   Verified: ✅ `pnpm install --frozen-lockfile`, `turbo run build --force`, `pnpm build`, `build:e2e:local-supabase`, smoke E2E 11 tests, vitest 192/1263, backend Jest matrix, lint, all `check:*` guard scripts, docs i18n + screenshot-assets, dependency-graph compare, final active-source search for residual `@universo/*` imports (clean).

## 2026-05-25 - Scripts To Modules Rename (+ 2 QA closures)

-   Renamed the metahub attached-TypeScript-code capability from Scripts/Scripting to Modules across packages, routes, DB contracts, snapshots, fixtures, tests, SDK names, and GitBook docs — no legacy aliases.
-   **QA fix closure (backend):** snapshot module restore stores source + normalized metadata only, drops imported precompiled bundles, derives a local restore checksum, relies on publication-time compilation. Snapshot module attachment kinds fail closed unless known anchors or matching the restored source entity's kind. Module updates no longer preserve out-of-scope library modules as legacy-compatible state.
-   **Final QA fix closure:** runtime client bundle downloads use the same client-visible module predicate as the runtime list (direct bundle access can't expose a client-bundle-without-client-manifest module); removed deprecated snapshot compatibility aliases from sync contracts / restore / serialization / canonical hashing / fixture contracts / E2E assertions; refreshed canonical fixture hashes. Updated snapshot docs to the renamed contracts (`sharedFixedValues`/`sharedOptionValues`/`sharedComponents`).
-   Verified: ✅ utils/applications-backend/metahubs-backend focused tests, docs i18n, lint + builds, `git diff --check`.

## 2026-05-24 - LMS User Guide GitBook Documentation (impl + 5 QA hardening passes)

-   **Implementation:** first-class bilingual GitBook LMS user guide for apps created from `tools/fixtures/metahubs-lms-app-snapshot.json` — `docs/en/lms/` + `docs/ru/lms/` as a new top-level section (13 paired workflow pages), localized `1920×1080` screenshot assets under `.gitbook/assets/lms-user-guide/` with strict dimension validation, existing-guide cross-links, manifest-driven checker `tools/docs/check-lms-user-guide-docs.mjs`, Playwright generator that imports the canonical snapshot through the UI and captures whole-window screenshots on the dedicated local minimal Supabase profile (blocks TanStack banner leakage, scans raw IDs/ISO/object leakage, verifies no RU fallback).
-   **QA remediation:** localized RU section labels (role/goal/prerequisites/workflow/result/checks/related); visible step-level screenshots after every numbered step (no invisible `<!-- screenshot -->` placeholders); checker validates H1 against manifest, enforces step counts, requires step→visible-image→marker, inspects step image dimensions, rejects English boilerplate on RU pages.
-   **Step screenshot closure:** every workflow step performs a concrete UI action before capture; regenerated EN/RU `1920×1080`; checker fails on duplicate step-hash, stale assets, raw IDs/ISO, devtools text, RU English fallback; dedicated PR workflow runs the local-Supabase generator before static checks. Removed tracked `.env.e2e.backup` from the index.
-   **User-facing text + CI gate closure:** removed all `<!-- screenshot: -->` comments (coverage now validated from manifest + visible refs + committed assets + provenance); checker fails on TODO/FIXME/placeholder + user-hostile wording (raw ID/JSON/UUID, metahub, source-preview, workspace-selector, row-action); broadened the docs screenshot workflow to every PR.
-   **Screenshot oracle hardening + final gate closure:** global duplicate-PNG-hash detection across all guide assets; per-capture provenance (id/locale/route/viewport/type/step); normalized dynamic application/public-link/UUID/32-hex route segments (no leaked identifiers); whole-viewport safety checks before every capture; edit/copy/delete/project/guest/report path coverage; distinct (non-duplicate) workflow-step states; `check:runtime-no-lms-forks` folded into `docs:lms-user-guide:check`.
-   Verified: ✅ `docs:lms-user-guide:verify:local-supabase`, `docs:lms-user-guide:check`, `docs:i18n:check`, gitbook links + screenshot-assets, ESLint, `git diff --check`.

## 2026-05-23 - LMS Runtime UX/i18n Release Blocker Remediation

-   Closed screenshot-driven runtime UX/i18n blockers: generic locale-aware DATE/DATETIME formatting for runtime values / DataGrid columns / cards / detail (no raw ISO); fixed `ResourcePreview` localization for type/action labels + normalized page/source body rendering (no English fallback on RU); normalized LMS template/snapshot user-facing text to VLC without LMS-only runtime forks; tightened MUI toolbar control geometry + detail spacing; `records.union` backend projection localizes string fields + referenced labels by requested runtime locale.
-   Playwright oracles for raw ISO timestamps, RU English-fallback, DataGrid technical leakage, toolbar control geometry, page-level horizontal overflow.
-   Verified: ✅ displayValue/ResourcePreview/runtimeUi Vitest (28), `check:lms-fixture-contract` + `check:runtime-no-lms-forks`, applications-backend route Jest (155), build, `build:e2e:local-supabase`, local minimal Supabase LMS runtime Playwright (2 passed).

## 2026-05-23 - LMS Learning Content Public Guest Release-Blocker Remediation (+ 2 follow-ups)

-   **Post-QA release blockers:** guest progress is now server-owned (action-intent API; backend derives status/percent/last-item; browser-owned `status`/`progressPercent`/`lastAccessedItemIndex` rejected via strict schema); guest content-item refs validated before progress writes; same-workspace duplicate access-link slugs fail closed; workspace object row limits enforced before restore; reorder blocked when any selected row is locked; public runtime links resolve through non-personal shared workspaces (not personal `Main`). Strengthened the public-guest Playwright flow with real content + embedded quiz, `Score 2/2`, viewport screenshots, no-overflow + technical-leakage checks, guest-progress request-body assertions.
-   **Final QA remediation follow-up:** transaction-scoped advisory locks for guest content-progress writes + assessment attempt numbering; attempt-number calculation moved into the same transaction; workspace-aware access-link lookup returns a link only when exactly one active non-personal public workspace owns the slug/id; runtime access-entry membership validation applied to copied rows; RU wrong-slug + viewport-matrix browser coverage.
-   **Final security gate remediation:** runtime row-level edit ACL enforced on direct `post`/`unpost`/`void` (locked selection + final update); `runtimeRecordParentAccess` metadata + parent-reference validation + SQL access inheritance so LMS child outline records inherit parent ACL (`CourseSections`/`CourseItems`/`TrackStages`/`TrackSteps`); create/update/bulk/restore/original-target restore fail closed on invalid/unauthorized parent refs; normalized public access-link dates + counters; guest Playwright for active/wrong-slug/expired/exhausted links.
-   Verified: ✅ applications-backend route Jest (177–185 per suite), apps-template-mui GuestApp Vitest (14), `check:lms-fixture-contract` + `check:runtime-no-lms-forks` + `check:runtime-ux-agents`, builds, docs i18n (75 pairs), `pnpm audit --prod` clean, local minimal Supabase guest runtime Playwright (positive + negative), `git diff --check`. Note: `.env.e2e.backup` sanitized to placeholders — any real exposed credentials still need external rotation + history cleanup.

## 2026-05-22 - LMS Learning Content QA Findings Remediation

-   Closed the remaining QA findings for the LMS Learning Content release gate: runtime row-level access applied consistently to workflow action targets, record-picker reference validation, and report reference-label joins (SQL placeholder shifting so report joins can't reveal labels for unreadable rows); progress + reorder mutations fail closed (advisory locks, `RETURNING` confirmation, explicit zero-row failure); runtime table/card displays render configured option labels instead of stored codenames (generic string-option display formatting for DataGrid/table/card).
-   Strengthened the LMS Playwright flow with visible row-order assertions after reorder + E2E-only API rate-limit overrides. Remediated production audit findings for `qs` + `@tootallnate/once` (patched overrides + narrow `minimumReleaseAgeExclude` for the emergency `qs` security patch).
-   Verified: ✅ runtimeReportsService + applicationsRoutes Jest (147 passed), apps-template-mui displayValue/columns Vitest (307), backend + template lint, core-frontend build, ESLint on E2E suite, `check:runtime-no-lms-forks` + `check:lms-fixture-contract` (Node 22), full LMS browser flow (2 passed incl. setup), `git diff --check`, `pnpm install --frozen-lockfile`, `pnpm audit --prod` clean.

## Archive — Title-level micro-history (2026-05-13 → 2026-06-14) ✅

> One line per completed entry, preserved from the prior detailed log. These are the fine-grained QA/closure/slice entries whose full multi-paragraph detail (verification command dumps, file lists) lives in `progress.md.backup-20260619`. Newest-first ordering matches the original log; truncated tails (`…`) are as the source recorded them.

### LMS Learning Content productization (2026-05-13 → 2026-05-23)

-   **2026-05-23: LMS Guest Public Workspace Isolation QA Closure** — Scoped public guest runtime record reads, child TABLE reads, access-link lookup, and access-link…
-   **2026-05-23: LMS Runtime UX QA Findings Closure** — Suppressed top-level metadata create actions when a `detailsTable` widget owns `createTargets`…
-   **2026-05-22: LMS Learning Content QA Release Gate Closure** — Added explicit browser/API/fixture evidence fields to the LMS acceptance matrix and prevented d…
-   **2026-05-22: LMS Learning Content QA Remediation Closure** — Hardened generic runtime access handling for `records.union` helper-object targets and `library…
-   **2026-05-22: LMS Learning Content Productization Final Validation** — Marked Phase 10 complete in `tasks.md` for the current plan state.
-   **2026-05-22: LMS Learning Content Final QA Fixes** — Hardened `buildRuntimeRecordAccessClause` so `runtimeRecordAccess.ownerOrShared` is bypassed on…
-   **2026-05-22: Role Visibility Scoped Gate** — Marked `roleVisibility.actionable`/`roleVisibility.audited` complete in `LMS_PRODUCT_ACCEPTANCE_MATRIX`.
-   **2026-05-22: Knowledge Base Audited Gate** — Marked `knowledgeBase.audited` complete in `LMS_PRODUCT_ACCEPTANCE_MATRIX`.
-   **2026-05-22: Reports Audited Gate** — Marked `reports.audited` complete in `LMS_PRODUCT_ACCEPTANCE_MATRIX`.
-   **2026-05-22: Knowledge Base Actionable Gate** — Confirmed the Phase 1 `records.union` datasource foundation is already server-side.
-   **2026-05-22: LMS Product Acceptance Matrix Reconciliation** — Confirmed the matrix has no open gates for content projects, Learning Content shell, standalone…
-   **2026-05-22: Standalone LMS Fixture Contract Gate** — Added `pnpm run check:lms-fixture-contract` for validating `tools/fixtures/…`.
-   **2026-05-22: Generic Course Field Report Coupling** — Added the reusable `Instructor` business component to the Learning Content union projection.
-   **2026-05-18: LMS Learning Content Product UX Remediation** — Made optional `resourceSource` fields submit as absent until a concrete locator is provided.
-   **2026-05-18: LMS Learning Content Final QA Closure** — Removed public guest runtime compatibility for `module` targets; kept only `content`/`asses…`.
-   **2026-05-18: LMS Learning Content No-Modules Remediation** — Removed the active `Modules` entity path from LMS template/generator/fixture-contract/snapshot.
-   **2026-05-18: LMS Learning Content Auto-Enrollment QA Remediation** — Removed `AutoEnrollmentRuleModule` from the active LMS template and regenerated fixtures.
-   **2026-05-18: LMS Runtime Copy UI Integration** — Routed `useCrudDashboard` copy submissions through `adapter.copyRow`.
-   **2026-05-18: LMS Runtime Copy Relations** — Added `config.runtimeCopy.relations` support to the runtime rows controller.
-   **2026-05-18: LMS Runtime Progress Complete/Recalculate Actions** — Extended `POST /runtime/progress/content` with `action: update|complete|recalculate`.
-   **2026-05-18: LMS Track Learner Player Closure** — Added `targetObjectCodename` to the generic `learnerPlayer` widget config contract.
-   **2026-05-17: LMS Relation Builder Runtime Closure** — Added a generic published-app `RelationBuilderWidget` for parent-scoped child datasources.
-   **2026-05-17: LMS Learning Content Generic Ordering Runtime Closure** — Added generic persisted row ordering for datasource-backed details tables (Course/Track).
-   **2026-05-17: LMS Learning Content Builder Tabs Runtime Closure** — Added `detailsTabs` to the shared dashboard widget registry + strict layout validation.
-   **2026-05-17: LMS Course Item Runtime Record Picker** — Added generic `stringOptions` rendering for STRING fields (metadata-driven select controls).
-   **2026-05-17: LMS Runtime Record Picker QA Gap Closure** — Cleared `runtimeRecordPicker` field values when their `targetObjectCodenameField` changes.
-   **2026-05-17: LMS Course Builder Policy Controls And Large Outline Warning** — Added a generic `rowCountWarning` contract to `detailsTable` widget metadata.
-   **2026-05-17: LMS Enrollment Wizard And Conditional Due-Date Validation** — Added `createWizard` metadata to relation-builder panel config.
-   **2026-05-17: LMS Enrollment Wizard Due-Date Derivation** — Added generic `uiConfig.derivedDateOffset` handling in the published `FormDialog`.
-   **2026-05-17: LMS Parent Progress Aggregation** — Added `runtimeProgress.aggregateParents` handling to the runtime progress endpoint.
-   **2026-05-17: LMS Generic Learner Player Shell** — Added the generic `learnerPlayer` widget to the published MUI app template renderer.
-   **2026-05-17: LMS Server-Owned Sequence Progress Guard** — Added Object-level `config.runtimeProgress.sequencePolicy` for server-owned progression.
-   **2026-05-17: LMS Scoped Sequence Availability In Details Tables** — Added optional `scopeFieldCodename` to the sequence policy contract.
-   **2026-05-17: LMS Course And Track Enrollment List Tabs** — Added `detailsTable` enrollment-list widgets to Course/Track Builder enrollment tabs.
-   **2026-05-17: LMS Catalog-Ready Course And Track Metadata** — Added shared `catalogPublicationPolicySchema` with fail-closed self-enrollment.
-   **2026-05-16: Published LMS Authoring and Workspace UI Closure** — LMS nav primary sections now open operational object surfaces.
-   **2026-05-16: LMS Final QA Follow-up Closure** — Raised LMS runtime menu `maxPrimaryItems` to 8 in template/fixture/snapshot.
-   **2026-05-16: Final LMS QA Gap Closure** — Updated `application-runtime-rows.spec.ts` to reuse the seeded `Title` component.
-   **2026-05-16: LMS QA Follow-up Remediation Complete** — Decoupled published-app metadata workflow actions from broad `editContent`.
-   **2026-05-16: LMS QA Remediation: Runtime Scripts And Workflow Capability Gate** — Canonical application schema names in runtime script route tests.
-   **2026-05-16: Node 22 Environment And LMS E2E Remediation** — Removed obsolete nvm Node versions; nvm default → Node 22.22.2.
-   **2026-05-16: LMS Platform Slice 9C/11B: Workspace Metric Screenshot Gate + LMS Flow Cleanup** — Extended `lms-workspace-management.spec.ts` with metric-card coverage.
-   **2026-05-16: LMS Platform Slice 9D/12C: Published Runtime README Alignment** — Confirmed Phase 9 acceptance coverage via runtime record-card unit tests.
-   **2026-05-16: LMS Platform Slice 1B/12D: Shared Block Editor Package** — Added `@universo-react/block-editor` (shared `EditorJsBlockEditor`, locale-aware headers).
-   **2026-05-15: LMS Platform Slice 7B: Published Runtime Workflow Actions** — Added workflow actions to the apps-template runtime response schema.
-   **2026-05-15: LMS Platform Slice 7C: Workflow Capability Policy** — Added `resolveEffectiveRoleCapabilities()` in application access guards.
-   **2026-05-15: LMS Platform Slice 7D: Knowledge and Development Portal Navigation** — Added `KnowledgeHome` as a Page entity (EN/RU Editor.js blocks).
-   **2026-05-15: LMS Platform Slice 7E: LMS Workflow Metadata** — Added reusable LMS workflow action builders in the LMS template.
-   **2026-05-15: LMS Platform Slice 7G: Gamification And Achievements** — Added GamificationSettings/PointAwardRules/PointTransactions/BadgeDefinitions entities.
-   **2026-05-15: LMS Platform Slice 8A: Saved Runtime Report CSV Export** — Added `POST /applications/:id/runtime/reports/export` for saved `records.union` reports.
-   **2026-05-15: LMS Platform Slice 8B: Report Aggregation Overview Metrics** — Added a typed `report.aggregation` metric datasource for stat cards.
-   **2026-05-15: LMS Platform Slice 9A: Runtime Dashboard Card Grid Parity** — Stable test target for the runtime details card grid.
-   **2026-05-15: LMS Platform Slice 9B: Workspace Metric Card Parity** — Replaced custom `WorkspaceMetricCard` Box surface with `Card`.
-   **2026-05-15: LMS Platform Slice 11A: Committed LMS Fixture Contract** — Extended `snapshotFixtures.test.ts` with a committed LMS fixture.
-   **2026-05-15: LMS Platform Slice 12A: LMS Resource And Report Docs** — Updated EN/RU `lms-resource-model.md` for xAPI/file resources.
-   **2026-05-15: LMS Platform Slice 12B: Gamification Guide** — Added `docs/en/guides/lms-gamification.md`.
-   **2026-05-15: LMS Platform Slice 13A: Deferred xAPI And Broad File Resources** — Added `xapi` to the shared `ResourceSource` type contract.
-   **2026-05-15: Documentation Refresh Implementation (Phase 1-4 Complete)** — Verified legacy terminology already removed from all documentation.
-   **2026-05-13: Local Supabase Minimal App Start Commands** — Added `start:local-supabase:minimal` / `start:allclean:local-supabase:minimal` root scripts.
-   **2026-05-13: Dedicated E2E Supabase Profile And Agent Playwright Guidance** — Centralized local Supabase profile model with separate dev/E2E project ids.
-   **2026-04-13 And Earlier: Archive** — Removed legacy `HubList`/`CatalogList`/`SetList`/`EnumerationList` frontend exports.

### Generic runtime safety/display hardening (2026-05-19 → 2026-05-23)

-   **2026-05-23: LMS Runtime UX QA Findings Closure** — (see LMS cluster) suppressed duplicate top-level create actions.
-   **2026-05-22: Generic Runtime Stat Card Metric Value Display Safety** — Reused the shared configured metric formatter for overview stat cards.
-   **2026-05-22: Generic Runtime DataGrid Cell Display Safety** — Replaced default `toGridColumns()` formatting with `formatRuntimeSafeValue`.
-   **2026-05-22: Generic Runtime Chart Metric Value Display Safety** — `MainGrid` chart metric formatter reuses `formatRuntimeSafeValue`.
-   **2026-05-22: Generic Runtime Chart Axis Display Safety** — `MainGrid` chart-axis formatter reuses `formatRuntimeSafeValue`.
-   **2026-05-22: Generic Runtime Flow-List Cell Display Safety** — Shared flow-list cell helper preserves React elements while sanitizing.
-   **2026-05-22: Generic Relation Builder And Runtime List Fallback Safety** — Safe metadata fallback labels for relation-builder panels + wizard steps.
-   **2026-05-22: Generic Details Tabs And Sequence Label Fallback Safety** — Humanize non-technical tab IDs + localized generic fallbacks.
-   **2026-05-22: Generic Runtime Record Picker ID Fallback Safety** — Record picker option labels return a localized fallback instead of raw ID.
-   **2026-05-22: Generic Workflow Row-Action Label Fallback Safety** — Added generic workflow action fallback labels to `RowActionsMenuLabels`.
-   **2026-05-22: Generic Workspace Invite Email Validation** — Reused shared `emailSchema` in the invite-member dialog before mutation.
-   **2026-05-22: Generic Runtime Quiz Widget Text Display Safety** — Safe display normalization for quiz title/description/labels/prompts.
-   **2026-05-22: Generic Runtime Object Display-Key Fallback Safety** — Restricted object display keys to explicit human label fields.
-   **2026-05-22: Generic Resource Preview Title And Description Safety** — Routed `ResourcePreview` title/description through the safe formatter.
-   **2026-05-22: Generic Records Union Card-Mode Display Safety** — Records-union card value formatter uses `formatRuntimeSafeValue`.
-   **2026-05-22: Generic Form Dialog JSON Field Display Safety** — Localized read-only structured-data message replaces JSON fallback editor.
-   **2026-05-22: Generic Localized Inline Validation Helper Safety** — Shared length-constraint helper for simple/versioned/localized fields.
-   **2026-05-22: Generic Target Picker Option Label Safety** — Removed `Codename`/`codename` from default target-picker label candidates.
-   **2026-05-22: Generic Target And Share Mutation Error Sanitization Coverage** — Share-member mutation failure coverage for the records-union shared dialog.
-   **2026-05-21: Generic Runtime Workspaces Raw-ID And Error Leakage Safety** — Runtime Workspaces page uses localized `workspace.untitled` fallback.
-   **2026-05-21: Generic Datasource Load Error UX Safety** — `records.list` query failures routed through the runtime error sanitizer.
-   **2026-05-21: Generic Records Union Target Filters** — Generic `detailsTable.targetFilters` schema for `records.union` widgets.
-   **2026-05-21: Generic Records Union Runtime Search** — Added `showSearch` to the generic details-table widget metadata.
-   **2026-05-21: Generic Records Union Report Execution** — Reused `executeRuntimeRecordsUnionDatasource` for saved reports.
-   **2026-05-21: Generic Runtime Table Column Visibility** — Added `useRuntimeColumnVisibilityPreference` with normalization + persistence.
-   **2026-05-21: Generic Runtime Technical Column Safety** — Exported runtime grid column classifiers from `useRuntimeColumnVisibility`.
-   **2026-05-21: Generic Records List Column Preset Parity** — Applied runtime table column presets before building `records.list` columns.
-   **2026-05-21: Generic Report Table Technical Column Safety** — Filtered report columns (`TargetRecordId`, `sourceJson`, …).
-   **2026-05-21: Generic Ledger Table Technical Field Safety** — Filtered ledger datasource columns with the runtime technical-field classifier.
-   **2026-05-21: Generic Tabular String Object Display Safety** — Replaced STRING tabular `JSON.stringify` fallback with `formatRuntimeSafeValue`.
-   **2026-05-21: Generic Tabular Fetch Error Sanitization** — TABLE child-row fetch errors routed through `extractRuntimeErrorMessage`.
-   **2026-05-21: Generic Report Runtime Filters** — Added optional ad hoc report filters to run/export payloads.
-   **2026-05-21: Generic Report Error UX Safety** — Localized report-load error state in `ReportDetailsTableWidget`.
-   **2026-05-21: Generic Record Picker And Relation Builder Error Sanitization** — `FormDialog` record-picker load failures sanitized.
-   **2026-05-21: Generic Workspace Switcher ID Fallback Safety** — Workspace menu raw-ID fallbacks replaced with `workspace.untitled`.
-   **2026-05-21: Generic Guest Runtime Error Sanitization** — Sanitized guest error rendering in `GuestApp`.
-   **2026-05-21: Generic Learner Player ID Fallback Safety** — Learner-player safe row-text helper backed by the safe formatter.
-   **2026-05-21: Generic Resource Source Type Selector Labels** — Shared default resource type labels for runtime fallback paths.
-   **2026-05-21: Generic Resource Preview Type Labels / Title Wrapping / Domain Badge** — Localized type labels; removed `noWrap`; domain chip for ready URL sources.
-   **2026-05-21: Generic Create Target Capacity Hardening** — Raised `detailsTable.createTargets` capacity 8 → 16.
-   **2026-05-21: Report Export Filename User Label Contract** — Generic report CSV filename builder in the published MUI report widget.
-   **2026-05-21: Saved Report Widget Codename Contract** — Added `detailsTable.reportCodename` metadata contract.
-   **2026-05-21: Builder Report Definition Productization** — Seeded `CourseBuilderOutline`/`TrackBuilderOutline` report definitions.
-   **2026-05-21: Deferred Assessment Create Targets** — Disabled Quiz-lite/Assignment-lite create targets in LMS metadata.
-   **2026-05-21: Learning Content Create Menu Deferred Package Evidence** — Fixture-contract coverage for the disabled Import package create target.
-   **2026-05-20: LMS Learning Content Records Union Presentation Bridge** — Preserved title/status/type/updatedAt fields from `records.union`.
-   **2026-05-20: LMS Learning Content Generic Records Union Starred Actions** — Generic `detailsTable.rowActions` for `library.toggle` starred actions.
-   **2026-05-20: LMS Learning Content Generic Runtime Report REF Label Projection** — Enriched report field metadata with object reference + display labels.
-   **2026-05-20: LMS Learning Content Generic Runtime Report Primitive ID Output Safety** — Generic primitive-ID suppression in report CSV serialization.
-   **2026-05-20: LMS Learning Content Generic Runtime Report Export Output Safety** — Safe report value formatting in `RuntimeReport…` CSV.
-   **2026-05-20: LMS Learning Content Generic Create-Target Resource Policy Availability** — Create-target availability resolution from `cr…` policy.
-   **2026-05-20: LMS Learning Content Generic Settings-Derived Create Defaults** — Safe `contextPath` create-default source in layout schema.
-   **2026-05-20: LMS Learning Content Generic Resource Source Policy** — Generic `resourceSourceTypes` policy on FormDialog/CrudDialogs/DashboardDetails.
-   **2026-05-20: LMS Learning Content Generic Runtime UX Projection Slice** — `records.union` merges projection columns across configured targets.
-   **2026-05-20: LMS Learning Content Runtime Safety Slice** — Executable guard scripts for runtime LMS-only branch drift + docs links.
-   **2026-05-20: LMS Learning Content Runtime Table Defaults Bridge** — `tableDefaults.defaultViewMode`/`columnPreset` in dashboard schema.
-   **2026-05-20: LMS Learning Content Runtime Table Defaults UX Canary** — Optional raw-UUID substring detection in the runtime UX Playwright helper.
-   **2026-05-20: LMS Learning Content Current-Object Card Safety** — `MainGrid` current-object card ignores id/actions/`*Id`/owner fields.
-   **2026-05-20: LMS Learning Content Runtime UX Canary Guard Tightening** — Expanded `expectNoTechnicalLeakage` (storageKey/mi… JSON detection).
-   **2026-05-20: LMS Learning Content Generic Relation Builder Display Safety** — Shared display helpers for technical names/raw resource/media.
-   **2026-05-20: LMS Learning Content Runtime Form UX Safety** — Shared `fieldSemantics` helpers (Description/Summary/Body/Instructions/Fee…).
-   **2026-05-20: LMS Legacy Concurrency Checklist Closure** — Verified delete/restore use `buildRuntimeExpectedVersionPredicate`.
-   **2026-05-20: LMS Metadata-Driven Union Create Menu** — Generic `detailsTable.createTargets` contract with localized labels.
-   **2026-05-20: LMS Create-Target Form Defaults And Resource Type Presets** — Strict `CreateTargetDefault` metadata contract.
-   **2026-05-20: Generic Link Resource Domain Preview** — Domain preview chip in the shared `resourceSource` form widget.
-   **2026-05-20: LMS Auto-Resolved Page Resource Source Authoring** — Metadata-driven auto page resource source resolution in `FormDialog`.
-   **2026-05-20: Generic Records Union Row Actions** — Generic `DashboardRowTarget` action contract for datasource widgets.
-   **2026-05-21: LMS Learning Content Generic Learner Player Settings Enforcement** — `details.pagePlayer.showOutline` applied to outline + Editor.js.
-   **2026-05-21: LMS Learning Content Generic Shared Workspace Member Row Actions** — `library.toggle` row action with `principalTarget` + localized dialog.
-   **2026-05-21: LMS Learning Content Generic Target-Field Row Actions** — `field.updateWithTarget` row action with target collection ref.
-   **2026-05-21: Records Union Trash Runtime E2E Stabilization** — Stable `records-union-details-table` runtime marker.
-   **2026-05-21: LMS Learning Content Report REF Filtering And Trash Restore Target Picker** — Report SQL `contains`/`startsWith`/`endsWith`/`equals` REF filters.
-   **2026-05-21: LMS Learning Content Generic Project Create Target And Report REF Safety** — `ContentProjects` create target + REF safety.
-   **2026-05-21: LMS Learning Content Generic SharedAt Projection And Shared View Ordering** — Generic shared-relation timestamp projection.
-   **2026-05-21: LMS Learning Content Generic Runtime Shared Relation Mutation** — Added `shared` to the runtime library relation key contract.
-   **2026-05-21: LMS Learning Content Generic Runtime Recent Ordering** — Generic `recentAt` virtual projection for `records.union` rows.
-   **2026-05-21: LMS Learning Content Generic Runtime Recent Capture** — Added `recent` as a runtime library relation key.
-   **2026-05-21: LMS Learning Content Generic Records Union Project Labels** — Optional generic `records.union` target `projectField` contract.
-   **2026-05-19: Runtime UI UX Viewport Matrix Closure** — `RUNTIME_UX_VIEWPORT_MATRIX` + `expectRuntimeUxViewportMatrix` (1920/768/…).
-   **2026-05-19: Runtime UI UX Quality Gate** — Portable `mui-runtime-ux-patterns` + `runtime-ux-qa` skills.

### 1C-Compatible Metahub Template (2026-05-26) — GH822/823, shipped in 0.65.0-alpha

-   **1C-Compatible Metahub Template Implementation** — Opt-in `1C-Compatible` template (codename `1c-compatible`); `basic` stays default.
-   **Post-QA Closure** — Preview-safe milestone model; selector shows localized preview status; docs require behavior/storage/UI/test evidence before promotion.
-   **Security QA Closure** — Reserved registered platform preset `kindKey` values in `EntityTypeService` (closes `document`/`catalog` kind squatting).
-   **Final QA Remediation** — Object-compatible reference deletion fails closed for specialized template-managed target kinds.
-   **Route Isolation And UX Evidence Closure** — Specialized nested routes own the effective `kindKey` (no `?kindKey=` / body spoofing).
-   **Runtime UX QA Closure** — Removed duplicate preview chip + old optional-template wording from the selector.
-   **QA Findings Closure** — Enforced 1C constant delete/permanent-delete policy.
-   **Full Preset QA Remediation Closure** — Shipped the full 12-preset 1C-compatible template manifest.
-   **Constructor UX And Lifecycle QA Closure** — Moved runtime/constructor behavior presentation into reusable components.
-   **Requisites Runtime QA Closure** — Removed PostgreSQL/storage terminology + raw component data-type codes.
-   **Runtime QA Remediation Closure** — Disabled 1C tree/container assignment metadata until Subsystems exist.

> Verified across the cluster: ✅ metahubs-backend Jest (EntityTypeService/template/preset suites), metahubs-frontend Vitest (template selector + constructor), builds, docs i18n, local minimal Supabase Playwright. Preview-safe milestone model means presets stay marked "preview" until behavior/storage/UI/test evidence promotes them.

### Metahub Packages MVP + MMOOMM skills (2026-05-27)

-   **Metahub Packages Final QA Follow-Up** — Fixed package catalog attachment matching by joining active metahub package rows.
-   **MMOOMM 3D And Multiplayer Project Skills** — Added four project-local MMOOMM skills under `.agents/skills/`.

> Package attachments preserve integrity across copy / snapshot-restore / runtime-sync with duplicate-name guards, registry/source validation, and explicit snapshot-empty replacement semantics; removed normal-user raw package identifiers from UI + seed descriptions. Verified ✅ (metahubs + applications backend Jest, metahubs-frontend + wrapper-package Vitest, local minimal Supabase `@packages` Playwright). Foundation: GH824 (packages) + GH826 (MMOOMM/autoreview skills), shipped in 0.66.0-alpha.

### PlayCanvas Editor / project storage / file-backed modules — per-entry closures (2026-05-31 → 2026-06-14)

> Detailed narrative versions of these are kept above in the per-release sections (2026-06-01 → 2026-06-14); retained here as a flat title-level closure ledger so the original per-entry history is searchable in one place. Full multi-paragraph detail (verification dumps, file lists) is in `progress.md.backup-20260619`.

-   **2026-05-31: PlayCanvas Editor Package Foundation Implementation** — Isolated `@universo-react/playcanvas-editor-frontend` around vendored Editor `v2.22.1`.
-   **2026-05-31: PlayCanvas Editor Package Foundation QA Remediation** — Package-local browser smoke in CI/agent gates; artifact header/traversal checks.
-   **2026-06-01: PlayCanvas Editor Package Foundation Guard Closure** — Script guard fails closed on install/network command variants.
-   **2026-06-01: PlayCanvas Editor Metahub Authoring Surface Settings Implementation** — Shared package contracts, deterministic slugs, host descriptors.
-   **2026-06-01: …Settings QA Closure** — Legacy seed migration immutable; reseeding moved to authoring-settings migration.
-   **2026-06-01: …QA Remediation Follow-Up** — Stale/disabled display configs cannot serve the artifact after policy changes.
-   **2026-06-01: …Final Hardening Closure** — Strict Zod descriptor validation at registry/seed boundaries.
-   **2026-06-01: …Post-Review Defect Closure** — Editor host launch forced through document navigation; CSP frame-source origins.
-   **2026-06-01: …Final QA Evidence Closure** — DB-level authoring slug owner trigger; real mobile wheel-gesture oracle.
-   **2026-06-01: …Final QA Findings Closure** — Signed artifact-token requests revalidated against current `manageMetahub` + mode.
-   **2026-06-01: PlayCanvas Editor Runtime Contract QA Closure** — Package display settings kept design-time (removed half-read release-loader path).
-   **2026-06-02: File-Backed Module Sources Final QA Defect Closure** — Advisory-lock executor for guarded source-path writes; atomic temp-write entropy.
-   **2026-06-02: …Historical Schema Migration Closure** — `_mhb_modules` v3 immutable; file columns only in v4.
-   **2026-06-02: …Optimistic Lock And Source Path Closure** — File-backed updates fail closed without client `expectedVersion`.
-   **2026-06-02: …Runtime Sync Normalization Closure** — Runtime-field allowlist before `_app_modules` persistence.
-   **2026-06-02: …Fixture And Source Root Closure** — Explicit `UPL_MODULE_SOURCE_ROOT` across profiles; absolute repo `storage` root.
-   **2026-06-03: PlayCanvas Project Storage Model Implementation Closure** — Storage model across contracts/system tables/file storage/routes/snapshots/sync.
-   **2026-06-03: …QA Repair Closure** — Child-row ownership guards, snapshot remap, asset-scoped file routes.
-   **2026-06-03: …Round 5 QA Closure** — Manifest persistence in publication transactions; fail-closed export ids.
-   **2026-06-03: …Final QA Closure** — `manageMetahub` required for export/file-read; orphan project-file guards.
-   **2026-06-03: …Final Autoreview Closure** — Missing storage tables no longer break copy/export; version rejection before cleanup.
-   **2026-06-04: PlayCanvas Editor Runtime Host, Bridge, and Storage Adapter** — First real Universo-backed Editor authoring slice.
-   **2026-06-04: …Final Acceptance Closure** — Replay rows independent of UUID auth ids; production HMAC secrets fail closed.
-   **2026-06-04: …Bridge QA Round 2 Closure** — Missing/invalid UUID v7 request ids fail closed; parent-origin env contract.
-   **2026-06-04: …Runtime Host QA Closure** — Fail-closed bridge replay completion; checksum-guarded file delete.
-   **2026-06-05: PlayCanvas Editor Minimal Compatibility Backend QA Follow-up** — Host-provided CSRF token; loopback URL normalization; saveConflict envelope.
-   **2026-06-14: PlayCanvas Editor Backend Compatibility Thermos Closure** — ShareDB JSON0 repair traverses existing arrays; deferred realtime signing-secret resolution.

-   **2026-06-27: Generic Interpretation Network Runtime Follow-Up** — Closed the post-import UX defects for `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`: the Start page remains the first section, active template/fixture/runtime naming is generic Interpretation Network, Structures has no top explanatory text or seeded runtime rows, the initial left pane is only `Create structure` plus the structure list, opening a structure replaces that left list with the structure internals and matrix, and the right pane is Materials-only. Materials now use title filtering, table/card toggle, title/description create dialog, Editor.js Body editing, and a keyboard-accessible table open action. Workspace-scoped row mutations now include `workspaceId` for create/update/delete/copy/tabular helpers and structure rollback deletes. Validation: focused apps-template Vitest 29/29, metahubs-backend Interpretation Network template shape 12/12, Interpretation Network fixture contract, snapshot fixture contract 321/321, apps-template lint/build, apps-template isolation, docs i18n, and `git diff --check` passed.
-   **2026-06-28: Interpretation Network Structure Matrix UX Closure** — Reworked the Structures pane to mirror the Materials list pattern with title filtering, table/card views, full-card activation, and localized DataGrid chrome. The opened Structure view now uses row-based matrix cell cards instead of the grid/header hybrid, with only `Add row` and `Add cell` top actions. Cells now have localized title/description editing in a Basic tab, style controls in a Style tab, full-height drag handles, non-destructive selected styling, three-dot menus with Edit, available directional moves, and confirmed Delete. Material cards now expose the full card area as the click/hover target and material tables pass localized DataGrid text. The template and fixture include `CellDescription`, and the committed fixture hash was regenerated after the snapshot payload change. Autoreview follow-up fixed the E2E fixture envelope type import, selected the locally generated matrix `CellId` after create because the child-row create endpoint returns only a short status envelope, kept generic tabular row focus away from hidden fields, resolved style-preview codenames to physical field ids, and made the workspace load all paginated Concept/Interpretation/Material rows instead of truncating at 100. Relation and TableTemplate records remain model-level/template entities for later UI stages; they are intentionally not exposed in this workspace slice because the current user contract keeps the visible workflow to Structures, matrix cells, and cell Materials. Validation: apps-template lint/build, focused Interpretation Network Vitest 16/16, tabular utility Vitest 20/20, metahubs-backend template shape 12/12, Interpretation Network fixture contract, snapshot fixture contract 5/5, and Prettier check for the final contract files passed.
-   **2026-06-28: Interpretation Network Matrix Move Payload Fix** — Final Thermos review found that matrix move operations swapped only slot coordinates and left `CellId`, content, style fields, and `MaterialRef` attached to the original physical child rows. The move mutation now swaps the full logical cell payload while preserving each destination slot's `RowKey`/`RowLabel`/`ColKey`/`ColLabel`, so materials and styling travel with the moved card. The card-menu move test now asserts the transferred `CellId`, localized value/description, fill color, and material reference in both PATCH bodies. Validation: focused move Vitest, full Interpretation Network workspace + tabular utility Vitest 36/36, apps-template lint/build passed.
-   **2026-06-28: Runtime Tabular Atomic Batch Update Closure** — Follow-up Thermos review found that the full-payload matrix move still used two independent child-row PATCH requests and could leave the matrix partially swapped if the second request or rollback failed. Added a generic runtime TABLE child-row batch update endpoint at `POST /runtime/rows/:recordId/tabular/:componentId/batch`; it resolves the same runtime schema/context as existing child-row CRUD, checks `editContent`, rejects duplicate child rows, accepts the existing string child-row id contract, locks the parent and requested child rows, reuses the normal child-field validation/coercion path, and updates all requested rows inside one `DbExecutor.transaction()`. The Interpretation Network matrix move now calls the batch helper once, and tests assert no partial PATCH calls are emitted. Validation: backend tabular permission/atomic batch Jest 6/6, apps-template API/workspace/tabular Vitest 53/53, applications-backend lint/build, apps-template lint/build passed.
-   **2026-06-28: Interpretation Network Workspace URL And Catalog UX Closure** — Fixed the remaining runtime workspace UX issues for `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`: the Structures and Materials panes now split the content width evenly, Structures has a matching catalog title, both catalogs share one local `apps-template-mui` toolbar with filter → table/card toggle → right-aligned `Create`, and opening a Structure now writes/restores a structure URL segment without breaking the existing runtime section route. Material content editing now uses local Page-like language tabs with an immediate default-language star, adjacent small language action menu, adjacent small add-language button, keyboard tab navigation, and Editor.js locale add/change/make-primary/remove logic through `@universo-react/block-editor` helpers. Final validation also fixed the localized title max-length path: component tests keep submit disabled for programmatic over-limit values, while browser E2E proves the native field limit caps user input at 255 characters without raw validation leakage. Validation: full focused apps-template Vitest for `FormDialog.blockEditor` plus `InterpretationNetworkWorkspaceWidget` passed 46/46, Chromium imported Interpretation Network flow/smoke passed 3/3 on local minimal Supabase, apps-template lint passed, apps-template isolation guard passed, Interpretation Network fixture contract passed, `git diff --check` passed, and OntoIndex change detection passed with expected medium risk across `FormDialog` flows.
-   **2026-07-01: Interpretation Network Runtime Menu Rail Follow-Up** — Fixed the rebuilt published app layout regressions in the isolated `apps-template-mui` shell: the top toolbar no longer keeps the old centered `1700px` cap, the overlay opener button is visually inset on the same left rail as content, and compact side-menu mode gives the Structures page the full available content rail instead of retaining large side gutters. The Playwright oracle now measures real Structures pane geometry at `1920x1080` for wide, compact, and overlay modes and compares toolbar actions to the right pane, which closes the earlier gap where tests only checked `runtime-main-grid`. Validation: Prettier on touched files, focused Dashboard Vitest 17/17, apps-template lint, apps-template isolation guard, `git diff --check`, local-Supabase E2E build, and Chromium Interpretation Network imported snapshot flow/smoke 3/3 passed. Screenshots were produced for compact and overlay Structures states in `test-results/flows-interpretation-netwo-0121e-he-interpretation-workspace-chromium/`.
-   **2026-07-02: Interpretation Network Visible Theme Button Rail Closure** — Removed the remaining published-app toolbar inset at its source. Responsive hiding now applies to the outer wrappers of mobile-only toolbar controls, so hidden `Badge` wrappers no longer remain as flex children after the visible theme button. The browser oracle now measures the visible color-mode button itself against the content right rail with a 2 px tolerance in wide, compact, open-overlay, and closed-overlay states; the previous wrapper-based oracle could pass while preserving 16 px or 8 px of invisible spacing. Validation: focused Dashboard Vitest 17/17, apps-template lint, apps-template isolation guard, `git diff --check`, focused core-frontend build, local minimal Supabase Chromium imported Interpretation Network flow 3/3, and manual inspection of fresh 1920 px screenshots passed.
-   **2026-07-04: Interpretation Network Matrix Settings And Horizontal Hierarchy Closure** — Published Interpretation Network apps now create the root matrix cell as `Universe` / `Вселенная`, expose Matrix settings only when the materialized `interpretationNetworkWorkspace` widget exists, hide LMS Learning Content settings for non-LMS apps, and default hierarchical cells to horizontal rows with position numbering. Runtime Matrix actions use the shared contained Create/Add button style, the main matrix action is `Add`, cell materials use `Create`, view toggles switch horizontal rows and vertical tree, and drag/drop now has overlay, drop indicators, horizontal before/after placement, center-drop reparenting, and persisted reload checks. The Interpretation Network template and committed snapshot fixture include the default horizontal layout and numbering config. A follow-up backend fix removed an unused bind parameter for `scope=global` application-layout reads, restoring Matrix Settings discovery in imported apps. Validation: focused Vitest/Jest suites for apps-template, applications-frontend, applications-backend, metahubs-backend, and types; package builds; fixture contract; apps-template isolation; `git diff --check`; local minimal Supabase build; Chromium imported Interpretation Network snapshot flow 2/2 with screenshots and runtime UX viewport checks; OntoIndex changes passed with expected medium InterpretationNetworkWorkspaceWidget flow impact.
-   **2026-07-05: Interpretation Network Matrix Drag Preview And Settings QA Closure** — Aligned Matrix view toggles with the dark selected Material toggle style, restored published SideMenu icon-to-label spacing, kept numbered cell titles centered with end ellipsis, and refined horizontal/vertical drag previews so child insertion, sibling insertion, placeholders, and cross-level drops match the saved placement. Matrix Settings now save to every active materialized `interpretationNetworkWorkspace` widget, including scoped layouts; unsupported Limits settings are hidden until runtime schema and workspace mode are ready. Backend hierarchy validation now accepts reparent updates without resubmitting hidden `CellId` and generates UUID v7 identities for server-owned hierarchy creates before validation. Empty hierarchical matrices no longer expose manual root recreation through the Matrix toolbar; root `Universe` creation remains owned by Structure creation. Validation: apps-template matrix Vitest 31/31, applications-frontend settings Vitest 22/22, applications-backend hierarchical/tabular Jest 21/21, package lints, apps-template isolation, Interpretation Network fixture contract, local minimal Supabase Chromium imported snapshot flow 3/3, `git diff --check`, OntoIndex changes with expected medium dirty-worktree risk/version warning, and Thermos/autoreview clean after two accepted remediation rounds.
-   **2026-07-05: Interpretation Network Nested Create And Cross-Level Drop Follow-Up** — Preserved focused hierarchy expansion during nested child creation/refetch and improved matrix DnD target selection by preferring the cell under the pointer or dragged-card center before falling back to broad rectangle intersections. This keeps cross-level horizontal drops aligned with the existing 25/50/25 target-zone contract and reduces accidental sibling-row jumps when moving a child into another higher-level cell. Validation: apps-template lint/build, focused apps-template Vitest 62/62 for `InterpretationNetworkWorkspaceWidget`, `matrixMove`, and `matrixCollisionDetection`, Prettier on touched files, `git diff --check`, and `pnpm ontoindex:changes` passed with the expected medium dirty-worktree risk plus the local OntoIndex 2.0.3 vs pinned 1.9.10 warning.
