# Progress Log

> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

---

## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**
| Release | Date | Codename | Highlights |
| ------------ | ---------- | -------------- | ------------------------------ |
| 0.62.0-alpha | 2026-05-06 | 0.62.0 Alpha — 2026-05-06 | Node.js 22 migration, isolated-vm 6.x upgrade, autoskills support, startup DB reset |
| 0.61.0-alpha | 2026-04-29 | 0.61.0 Alpha — 2026-04-30 | Harden data-driven entity resource surfaces |

---

## Completed: Startup Supabase Full Reset (2026-05-07)

> Goal: Enable runtime-configurable full Supabase database reset at platform startup via `.env` configuration.

### Summary

Implemented `FULL_DATABASE_RESET` environment variable that performs a complete database reset (drops all project-owned schemas, deletes all Supabase auth users) before platform initialization. Reuses the proven E2E cleanup algorithm adapted for the TypeScript/DbExecutor stack.

### Changes Made

**New module:** `packages/universo-core-backend/base/src/bootstrap/startupReset.ts`
- Config parsing with `FULL_DATABASE_RESET` env var (off by default)
- Production guard (`NODE_ENV=production` blocks execution)
- Advisory lock via `withAdvisoryLock` + `getPoolExecutor()` (same pattern as `bootstrapSuperuser.ts`)
- Schema discovery from `registeredSystemAppDefinitions` + dynamic schema detection
- Safe schema drop with `quoteIdentifier`, validation regex, infrastructure protection
- Auth user deletion via `supabaseAdmin.auth.admin.deleteUser()`
- Post-reset verification with residue detection

**Integration:** `packages/universo-core-backend/base/src/index.ts` — `executeStartupFullReset()` called before migrations in `initDatabase()`

**Environment:** `.env.example` / `.env` — "DANGER ZONE" block with `FULL_DATABASE_RESET`

**Tests:** 14 new tests (13 in `startupReset.test.ts`, 1 in `App.initDatabase.test.ts`)

**Documentation:** `docs/en/` and `docs/ru/getting-started/configuration.md` — "Danger Zone" section

---

## Completed: Node.js 22 Migration (2026-05-06)

> Goal: Migrate project from Node.js 20 to Node.js 22.6.0+ to enable autoskills tool support.

### Summary

Migrated the project to Node.js 22 with upgraded isolated-vm dependency for scripting engine compatibility. All configuration files, documentation, and CI/CD workflows have been updated.

### Changes Made

**Configuration Updates:**
- `package.json` - Updated engines.node to `>=22.6.0`
- `.nvmrc` - Created with Node.js 22 version specification
- `packages/scripting-engine/base/package.json` - Upgraded isolated-vm from 5.0.4 to ^6.1.2
- `.github/workflows/main.yml` - Updated CI matrix to Node.js 22.x

**Documentation Updates:**
- `.kiro/steering/tech.md` - Added Node.js 22 requirements and critical flag notes
- `README.md` - Updated tech stack section with Node.js 22 requirement
- `memory-bank/techContext.md` - Added Node.js 22 and isolated-vm 6.x notes
- `docs/migration/nodejs-22-migration-guide.md` - Created comprehensive migration guide
- `docs/migration/NODEJS_22_MIGRATION_INSTRUCTIONS.md` - Created user action instructions

**Critical Finding:**
- isolated-vm 5.0.4 does NOT support Node.js 22 (requires >=18.0.0)
- isolated-vm 6.x is REQUIRED for Node.js 22 (requires >=22.0.0)
- Migration sequence: upgrade isolated-vm first, then migrate Node.js

### Validation Status

Configuration changes complete. User actions required:
1. Install Node.js 22 (`nvm install 22`)
2. Clean install dependencies (`pnpm clean:all && pnpm install`)
3. Run build and tests
4. Verify autoskills tool (`npx autoskills --dry-run`)

### Technical Notes

- `--no-node-snapshot` flag already configured in startup scripts
- No import assertions usage found (no migration needed)
- ESM packages isolated (only universo-i18n and universo-store)
- Native addon dependencies minimal (only isolated-vm in use)

---
| 0.60.0-alpha | 2026-04-23 | 0.60.0 Alpha — 2026-04-23 | Refresh metahub resources/docs and add empty template support |
| 0.59.0-alpha | 2026-04-17 | 0.59.0 Alpha — 2026-04-17 | Implement Entity Component Architecture and metahub resources |
| 0.58.0-alpha | 2026-04-08 | 0.58.0 Alpha — 2026-04-08 (Ancient Manuscripts) | Metahub snapshot import/export, self-hosted parity, scripting, shared/common layout flow |
| 0.57.0-alpha | 2026-04-03 | 0.57.0 Alpha — 2026-04-03 (Good Eyesight) 🧐 | QA remediation, controller extraction, domain-error cleanup, Playwright CLI hardening |
| 0.56.0-alpha | 2026-03-27 | 0.56.0 Alpha — 2026-03-27 (Cured Disease) 🤒 | Entity-display fixes, codename JSONB/VLC convergence, security hardening, csurf replacement |
| 0.55.0-alpha | 2026-03-19 | 0.55.0 Alpha — 2026-03-19 (Best Role) 🎬 | DB access standard, start app, platform attributes, admin roles/metapanel, application workspaces, bootstrap superuser |
| 0.54.0-alpha | 2026-03-13 | 0.54.0 Alpha — 2026-03-13 (Beaver Migration) 🦫 | MetaHub drag-and-drop ordering, nested hubs, create options/settings UX, optimistic CRUD, SQL-first convergence |
| 0.53.0-alpha | 2026-03-05 | 0.53.0 Alpha — 2026-03-04 (Lucky Set) 🍱 | Copy options expansion across Applications, Metahubs, Branches, and Sets/Constants delivery |
| 0.52.0-alpha | 2026-02-25 | 0.52.0 Alpha — 2026-02-25 (Tabular infinity) 🤪 | TABLE UX/data table improvements and NUMBER behavior hardening across form contexts |
| 0.51.0-alpha | 2026-02-19 | 0.51.0 Alpha — 2026-02-19 (Counting Sticks) 🥢 | Headless Controller, Application Templates, Enumerations |
| 0.50.0-alpha | 2026-02-13 | 0.50.0 Alpha — 2026-02-13 (Great Love) ❤️ | Applications, Template System, DDL Migration Engine, Enhanced Migrations |
| 0.49.0-alpha | 2026-02-05 | 0.49.0 Alpha — 2026-02-05 (Stylish Cow) 🐮 | Attribute Data Types, Display Attribute, Layouts System |
| 0.48.0-alpha | 2026-01-29 | 0.48.0 Alpha — 2026-01-29 (Joint Work) 🪏 | Branches, Elements rename, Three-level system fields |
| 0.47.0-alpha | 2026-01-23 | 0.47.0 Alpha — 2026-01-23 (Friendly Integration) 🫶 | Runtime migrations, Publications, schema-ddl |
| 0.46.0-alpha | 2026-01-16 | 0.46.0 Alpha — 2026-01-16 (Running Stream) 🌊 | Applications modules, DDD architecture |
| 0.45.0-alpha | 2026-01-12 | 0.45.0 Alpha — 2026-01-11 (Structured Structure) 😳 | i18n localized fields, VLC, Catalogs |
| 0.44.0-alpha | 2026-01-04 | 0.44.0 Alpha — 2026-01-04 (Fascinating Acquaintance) 🖖 | Onboarding, legal consent, cookie banner, captcha |
| 0.43.0-alpha | 2025-12-27 | 0.43.0 Alpha — 2025-12-27 (New Future) 🏋️‍♂️ | Pagination fixes, onboarding wizard |
| 0.42.0-alpha | 2025-12-18 | 0.42.0 Alpha — 2025-12-18 (Dance Agents) 👯‍♀️ | VLC system, dynamic locales, upstream shell 3.0 |
| 0.41.0-alpha | 2025-12-11 | 0.41.0 Alpha — 2025-12-11 (High Mountains) 🌄 | Admin panel, auth migration, UUID v7 |
| 0.40.0-alpha | 2025-12-06 | 0.40.0 Alpha — 2025-12-05 (Straight Rows) 🎹 | Package extraction, Admin RBAC, global naming |
| 0.39.0-alpha | 2025-11-26 | 0.39.0 Alpha — 2025-11-25 (Mighty Campaign) 🧙🏿 | Storages, Campaigns, useMutation refactor |
| 0.38.0-alpha | 2025-11-22 | 0.38.0 Alpha — 2025-11-21 (Secret Organization) 🥷 | Projects, AR.js Quiz, Organizations |
| 0.37.0-alpha | 2025-11-14 | 0.37.0 Alpha — 2025-11-13 (Smooth Horizons) 🌅 | REST API docs, Uniks metrics, Clusters |
| 0.36.0-alpha | 2025-11-07 | 0.36.0 Alpha — 2025-11-07 (Revolutionary indicators) 📈 | dayjs migration, publish-frontend, Metaverse Dashboard |
| 0.35.0-alpha | 2025-10-30 | 0.35.0 Alpha — 2025-10-30 (Bold Steps) 💃 | i18n TypeScript migration, Rate limiting |
| 0.34.0-alpha | 2025-10-23 | 0.34.0 Alpha — 2025-10-23 (Black Hole) ☕️ | Global monorepo refactoring, tsdown build system |
| 0.33.0-alpha | 2025-10-16 | 0.33.0 Alpha — 2025-10-16 (School Test) 💼 | Publication system fixes, Metaverses module |
| 0.32.0-alpha | 2025-10-09 | 0.32.0 Alpha — 2025-10-09 (Straight Path) 🛴 | Canvas versioning, Telemetry, Pagination |
| 0.31.0-alpha | 2025-10-02 | 0.31.0 Alpha — 2025-10-02 (Victory Versions) 🏆 | Quiz editing, Canvas refactor, MUI Template |
| 0.30.0-alpha | 2025-09-21 | 0.30.0 Alpha — 2025-09-21 (New Doors) 🚪 | TypeScript aliases, Publication library, Analytics |
| 0.29.0-alpha | 2025-09-15 | 0.29.0 Alpha — 2025-09-15 (Cluster Backpack) 🎒 | Resources/Entities architecture, CI i18n |
| 0.28.0-alpha | 2025-09-07 | 0.28.0 Alpha — 2025-09-07 (Orbital Switch) 🥨 | Resources, Entities modules, Template quiz |
| 0.27.0-alpha | 2025-08-31 | 0.27.0 Alpha — 2025-08-31 (Stable Takeoff) 🐣 | Finance module, i18n, Language switcher |
| 0.26.0-alpha | 2025-08-24 | 0.26.0 Alpha — 2025-08-24 (Slow Colossus) 🐌 | MMOOMM template, Colyseus multiplayer |
| 0.25.0-alpha | 2025-08-17 | 0.25.0 Alpha — 2025-08-17 (Gentle Memory) 😼 | Space Builder, Metaverse MVP, core utils |
| 0.24.0-alpha | 2025-08-12 | 0.24.0 Alpha — 2025-08-12 (Stellar Backdrop) 🌌 | Space Builder enhancements, AR.js wallpaper |
| 0.23.0-alpha | 2025-08-05 | 0.23.0 Alpha — 2025-08-05 (Vanishing Asteroid) ☄️ | Russian docs, UPDL node params |
| 0.22.0-alpha | 2025-07-27 | 0.22.0 Alpha — 2025-07-27 (Global Impulse) ⚡️ | Memory Bank, MMOOMM improvements |
| 0.21.0-alpha | 2025-07-20 | 0.21.0 Alpha — 2025-07-20 (Firm Resolve) 💪 | Handler refactoring, PlayCanvas stabilization |

## 2026-05-06 Generic Hub-Assignable Entity QA Follow-Up

Closed the QA blocker left after making hub-assignment behavior generic across Entity types.

| Area                | Resolution                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend regression  | Updated hub delete route tests for the new generic query order and added coverage for a required hub-assignable Page blocking hub deletion.                            |
| Fixture contract    | Verified the LMS snapshot hash and confirmed Page, Catalog, Set, and Enumeration definitions expose enabled `treeAssignment` and Hubs tabs through Entity metadata.    |
| Validation          | Focused backend Jest, metahubs frontend Vitest, runtime/application focused tests, package lint/build checks, full root `pnpm build`, and Chromium Basic Pages UX flow passed. |
| Residual warnings   | `@universo/metahubs-backend` lint still reports existing warnings only; no lint errors were introduced by this closure.                                                |

## 2026-05-06 Generic Hub-Assignable Entity Integration

Made hub-scoped authoring and hub delete blocking derive from Entity constructor metadata instead of fixed Catalog/Set/Enumeration assumptions.

| Area                         | Resolution                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hub tabs                     | Hub detail tabs are now built from editable Entity types with enabled `treeAssignment`, so Pages and future hub-assignable kinds appear automatically.                           |
| Hub-scoped lists             | Non-hub child routes under a hub now render the generic Entity instance surface and filter by `config.hubs`; the persisted generic fallback to old `config.treeEntities` was removed. |
| Delete blockers              | Hub deletion checks now return generic `blockingRelatedObjects` and `blockingChildTreeEntities`, with Entity kind and display type labels for each blocker.                      |
| Baseline templates           | Set and Enumeration definitions now enable hub assignment and expose the Hubs tab, matching Pages and Catalogs under the constructor-driven model.                                |
| LMS fixture                  | `tools/fixtures/metahubs-lms-app-snapshot.json` was updated to the new Set/Enumeration hub-assignment contract and its `snapshotHash` was recalculated.                         |
| Regression coverage          | Added backend Jest for generic hub blockers and frontend Vitest for hub-scoped generic child routes and updated delete-dialog/query-key tests.                                    |
| Validation                   | Focused backend Jest, focused frontend Vitest, metahubs frontend/backend lint/build, and full root `pnpm build` passed; backend lint still reports only pre-existing warnings.    |

## 2026-05-06 Runtime Start Section Stale Placeholder Suppression

Fixed the published application runtime root flashing a non-start section before the configured start page rendered.

| Area                    | Resolution                                                                                                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root cause              | `useCrudDashboard` could expose React Query placeholder/fallback data while the menu-defined start section was already being selected and fetched, so users briefly saw Access Links before Welcome.       |
| Generic runtime fix     | The hook now suppresses mismatched section data and returns a loading state when the current response section differs from the initial menu start section or selected section under fetch.                  |
| Menu start support      | Initial menu section detection now treats `page` items as valid section targets, matching the runtime menu model used by Page start screens.                                                                |
| Regression coverage     | Added deterministic hook coverage for the stale Access Links -> Welcome transition and extended the LMS browser flow to assert that Access Links / Ссылки доступа is not visible on runtime root loading. |
| E2E robustness          | The LMS flow now waits for the successful `200` sync response instead of failing on the expected first CSRF retry `419` response.                                                                           |
| Validation              | Focused `useCrudDashboard` Vitest, `@universo/apps-template-mui` lint/build, root `pnpm build`, Chromium LMS import/runtime Playwright, and `git diff --check` passed.                                      |

## 2026-05-06 Application Sync RLS Transaction Boundary Closure

Fixed the LMS Connector Board schema sync 500 that appeared after importing the canonical LMS snapshot and creating an application schema with workspaces enabled.

| Area                     | Resolution                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sync transaction boundary | `/api/v1/application/:id/sync` now uses plain authenticated middleware instead of the request-scoped RLS transaction wrapper because schema sync performs long-running DDL under its own transaction locks. |
| Authorization             | Regular application routes still use request RLS middleware; the sync route keeps explicit application access enforcement inside the existing sync controller/service path.                                |
| Regression coverage       | Core route-composition Jest verifies plain auth is passed only to sync. The LMS Playwright flow now drives the real Connector Board diff dialog and schema sync UI instead of calling sync directly.       |
| Validation                | Applications backend build/lint, core backend build/lint, focused core Jest, Chromium LMS import/runtime Playwright, root `pnpm build`, and `git diff --check` passed.                                      |

## 2026-05-05 LMS Runtime Welcome Assertion Closure

Closed the QA blocker where the LMS snapshot import/runtime browser flow still asserted the old short Welcome page copy after the LMS fixture was expanded.

| Area                   | Resolution                                                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared text contract   | Added canonical `LMS_WELCOME_PAGE` EN/RU text constants to the LMS fixture contract so import/runtime assertions use the same source as snapshot contract validation.                              |
| Runtime browser checks | Updated the LMS import/runtime Playwright flow to assert the expanded Welcome page title, introduction, getting-started heading, and workspace guidance in both English and Russian runtime views. |
| Slow flow timeout      | Raised the flow timeout to match the current full-reset workload across migrations, snapshot import, publication, linked app creation, schema sync, runtime checks, and guest progress recording.  |
| Regression result      | The Chromium flow now completes the linked app runtime checks and both public guest journeys, including quiz submission and module progress persistence.                                           |
| Validation             | Chromium LMS import/runtime Playwright, full root `pnpm build`, and `git diff --check` passed.                                                                                                     |

## 2026-05-05 Page Shared Action Icons And LMS Welcome Content Closure

Closed the last Page menu/icon parity issues, Page content editor alignment issues, primary content locale ordering, and the short LMS Welcome page content.

| Area                       | Resolution                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared action icons        | Added standard CRUD action icon factories in `@universo/template-mui` and reused them from both generic Page/Entity actions and Catalog linked-collection actions.                                            |
| Menu root cause            | Page menus used the shared `BaseEntityMenu` container, but their generic Entity action descriptors supplied different `Rounded` icons than Catalog descriptors. Centralized icon factories removed the drift. |
| Editor.js toolbar geometry | The shared Editor.js wrapper now keeps add/tune controls inside the editor card and left of block text without overlap.                                                                                       |
| Language tab parity        | Page content language tabs now use the same metahub tab typography scale, with compact tab action/add buttons aligned on the same centerline.                                                                 |
| Primary locale ordering    | Page content opens the stored primary content locale first when variants exist; active UI locale remains the default only for empty Page content.                                                             |
| LMS Welcome content        | The LMS template seeds a fuller localized Welcome/Learner Home page with EN/RU onboarding, getting-started steps, workspace guidance, and support text.                                                       |
| Fixture regeneration       | `tools/fixtures/metahubs-lms-app-snapshot.json` was regenerated through the official Playwright generator, and the fixture contract now asserts the full EN/RU content.                                       |
| Regression coverage        | Chromium Basic Pages UX now compares Page and Catalog menu SVG signatures, checks Editor.js control bounds and text overlap, validates compact button alignment, and verifies primary-locale ordering.        |
| Validation                 | Focused Vitest suites, affected package lint/build checks, Chromium Basic Pages UX Playwright, LMS fixture generator, full root `pnpm build`, and `git diff --check` passed.                                  |

## 2026-05-05 Page Entity Menu Parity And Hubs Column Closure

Closed the Page list UI parity issue where Page card/table menus differed from Catalog menus and the table showed a generic container label for Hub assignments.

| Area                | Resolution                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Menu root cause     | Page menus differed because the generic Entity list added block-content-specific `Open content` and `Edit properties` descriptors for Page entities.                           |
| Standard CRUD menu  | Page three-dot menus now render the same standard action model as Catalogs: `Edit`, `Copy`, and danger-group `Delete`; Page content remains accessible through card/row click. |
| Hubs column label   | The table tree-assignment column now uses `Hubs` when the Entity type declares the `hubs` tab alias, while generic custom Entity types continue to show `Containers`.          |
| i18n cleanup        | Removed no-longer-used Page-specific menu label keys from the metahubs locale files.                                                                                           |
| Regression coverage | Unit tests assert the standard Page menu and `Hubs` column label; Chromium Basic Pages UX checks the real table header and menu contents.                                      |
| Validation          | Focused Vitest, metahubs frontend lint/build, core frontend build, Chromium Basic Pages UX Playwright, full root `pnpm build`, and `git diff --check` passed.                  |

## 2026-05-05 Page Hubs Picker VLC Codename Crash Closure

Closed the clean rebuild/runtime crash in the Page create dialog when opening the Hubs add picker.

| Area                | Resolution                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crash source        | `TreeEntity.codename` is VLC data and was rendered directly in `EntitySelectionPanel` secondary text, causing React error #31 after the Page create dialog `Hubs -> Add` action.            |
| Container picker    | `ContainerSelectionPanel` now resolves name and codename values through `getVLCString` before rendering, with a stable id fallback.                                                         |
| Parent picker       | `ContainerParentSelectionPanel` now uses the same string-only label/codename resolution path, keeping parent-container UI safe for VLC codenames.                                           |
| Regression coverage | Added focused component tests for regular and parent container pickers with object-valued VLC codenames.                                                                                    |
| Browser coverage    | Extended the Chromium Basic Pages UX flow to open the Page create dialog, switch to `Hubs`, press `Add`, and verify the picker opens with hub labels instead of falling into ErrorBoundary. |
| Validation          | Focused Vitest, `@universo/metahubs-frontend` lint/build, `@universo/core-frontend` build, Chromium Basic Pages UX Playwright, full root `pnpm build`, and `git diff --check` passed.       |

## 2026-05-05 Page Content Visual And Generic Capability Closure

Closed the remaining Page content visual regressions and restored Page container/layout capability parity through generic Entity configuration handling.

| Area                         | Resolution                                                                                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compact language controls    | Page content language action buttons and the add-language button now use the same 28px compact icon-button sizing as shared entity card menus and are aligned through the tab row layout.                                           |
| Editor.js toolbar geometry   | The shared Editor.js wrapper positions add/tune controls left of the edited block content without overlapping text; Chromium Playwright now asserts both control bounding boxes against the first text block.                       |
| Stable menu close behavior   | Content-language menu state is retained until the close transition exits, preventing stale tab/add menu item flashes during click-away close.                                                                                       |
| Generic Page form capability | The generic Entity form accepts the standard `hubs` tab alias and exposes Page `Hubs` and `Layouts` tabs from template capability metadata instead of Page-specific hardcoding.                                                     |
| Snapshot decision            | No LMS snapshot regeneration was required for this closure because Page template capability metadata already contained `hubs` and `layout` declarations; the fix was generic frontend interpretation of the existing metadata.      |
| Regression coverage          | Entity list unit tests assert Page create dialogs expose `Hubs` and `Layouts`; Chromium Basic Pages UX now covers Page create/edit/copy dialogs, Editor.js toolbar geometry, and click-away menu-close stability with DOM watching. |
| Validation                   | `@universo/metahubs-frontend` unit/lint/build, `@universo/template-mui` lint/build, full `pnpm build`, `git diff --check`, and Chromium Basic Pages UX Playwright passed.                                                           |

## 2026-05-05 Generic Page Entity UX Parity Closure

Closed the remaining Page-specific UX drift by moving labels, loading behavior, dialog titles, and editor spacing back onto generic Entity and shared template contracts.

| Area                    | Resolution                                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable labels           | Generic Entity list helpers and navbar breadcrumbs now use localized built-in fallbacks for Pages before asynchronous Entity type metadata resolves.                                                                            |
| Loading behavior        | Generic Entity instance routes keep skeletons visible during initial instance loading, preventing a false "no pages yet" empty state while data is in flight.                                                                   |
| Dialog title contract   | Standard Entity template presets expose localized `presentation.dialogTitles` for create/edit/copy/delete actions, including inflected Page labels.                                                                             |
| Page content tab parity | Page content language tabs use the same typography scale as existing metahub tab surfaces, with compact sibling action and add-language icon buttons.                                                                           |
| Editor.js spacing       | The shared Editor.js wrapper reserves less left toolbar space while keeping block tools from overlapping text.                                                                                                                  |
| LMS fixture             | The canonical LMS snapshot was regenerated through the Playwright generator so imported LMS metahubs include updated Entity presentation metadata.                                                                              |
| Regression coverage     | Entity list and breadcrumb unit tests assert no raw `page/pages` fallback leak, no false empty-state flash, and Page dialog titles; Chromium Basic Pages UX covers dialog title and editor spacing checks.                      |
| Validation              | `@universo/metahubs-frontend` unit/lint/build, `@universo/template-mui` unit/lint/build, `@universo/metahubs-backend` build, full `pnpm build`, `git diff --check`, Chromium Basic Pages UX, and LMS snapshot generator passed. |

## 2026-05-05 Localized Editor.js Page Content QA Closure

Closed the Page content QA findings around Editor.js menu positioning, Editor.js Russian UI strings, and locale-aware block editing.

| Area                         | Resolution                                                                                                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Locale-aware editing         | `EditorJsBlockEditor` now accepts `contentLocale` separately from UI locale, renders that locale into Editor.js, and merges saves back into the selected locale only.                                                                                                                                                    |
| Localized data preservation  | Existing EN/RU block text values are preserved when editing one locale; new non-EN edits on legacy plain strings keep the original string as EN and write the selected locale.                                                                                                                                           |
| Page content language switch | The metahub Page content route now exposes content-language tabs labeled from admin content locales, so authors can add/change/remove/mark primary block content locales without changing the full interface language.                                                                                                   |
| LMS fixture VLC contract     | The Page preset and regenerated LMS snapshot store Editor.js block text inside VLC locale sections, so RU UI renders RU content while preserving EN content.                                                                                                                                                             |
| Editor.js Russian i18n       | The shared editor dictionary now covers core popover labels, block tunes, enabled tool names, and used tool labels such as list/header/image/table controls.                                                                                                                                                             |
| Popover layout               | Editor.js toolbar and popover CSS now reserves left-side toolbar space and keeps the opened menu inside the content card instead of under the metahub sidebar.                                                                                                                                                           |
| Accessible tab actions       | Content locale tabs use sibling action icon controls beside tab buttons instead of nesting interactive controls inside MUI tab labels.                                                                                                                                                                                   |
| Regression coverage          | Shared editor tests cover locale rendering, localized merge safety, and language-variant management; Chromium Basic Pages UX checks RU content, language tabs, add/change/remove/primary variant actions with a third admin content locale, Editor.js menu i18n, bounds, lifecycle, screenshots, and saved VLC payloads. |
| Validation                   | `@universo/template-mui` tests/lint/build, `@universo/metahubs-frontend` lint/build, full `pnpm build`, `git diff --check`, and targeted Chromium Playwright passed.                                                                                                                                                     |

## 2026-05-04 Page Block Content Constraint Closure

Closed the remaining QA findings around Entity-specific Page block constraints and noisy tests.

| Area                       | Resolution                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared block contract      | `normalizePageBlockContentForStorage` and `normalizeEditorJsOutputData` now enforce optional `allowedBlockTypes` and `maxBlocks` constraints.     |
| Backend mutation safety    | Entity create/update/copy flows pass the resolved Entity `blockContent` component constraints into the shared normalizer before persistence.      |
| Snapshot import safety     | `SnapshotRestoreService` applies imported Entity type `blockContent` constraints and rejects disallowed Page blocks before `_mhb_objects` writes. |
| Editor fallback validation | `EditorJsBlockEditor` passes allowed block types and max block count into visual-editor save and fallback JSON normalization.                     |
| Test signal                | The metahubs frontend Entity list unit harness mocks the shared menu behavior instead of mounting MUI `Popover`, removing `anchorEl` noise.       |
| Validation                 | Targeted type/backend/template/frontend tests, package lints, affected builds, `git diff --check`, and Chromium Basic Pages UX passed.            |

## 2026-05-04 Editor.js Page Authoring QA Closure

Closed the post-QA findings for the metahub Page content editor.

| Area                    | Resolution                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot import safety  | `SnapshotRestoreService` normalizes imported Page `config.blockContent` with the shared Page block schema and rejects unsafe content before object insertion. |
| Metadata form isolation | Page metadata dialogs no longer include hidden `blockContentText`; the dedicated content route owns block-content authoring.                                  |
| Shared editor adapter   | `EditorJsBlockEditor` handles upstream value changes after mount and fallback JSON now accepts raw Editor.js `OutputData` through the storage normalizer.     |
| Regression coverage     | Added backend restore tests, frontend metadata isolation test, template editor tests, and reran Chromium Basic Pages UX.                                      |
| Validation              | Targeted Jest/Vitest suites, package lints, affected package builds, `git diff --check`, and Chromium Playwright passed.                                      |

## 2026-05-04 Editor.js Page Authoring Route Implementation

Implemented real Editor.js authoring for metahub Page content without moving Editor.js into the published runtime template.

| Area                    | Resolution                                                                                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dependency model        | Added official Editor.js core/tools through the central PNPM catalog and pinned the repository package manager to a pnpm version that supports the current workspace catalog/trust policy contract.       |
| Shared editor adapter   | Added a lazy-loaded `EditorJsBlockEditor` and Editor.js tool factory in `@universo/template-mui`, keeping the component domain-neutral and reusable by any `blockContent` Entity type.                    |
| Canonical block storage | Added shared Editor.js-to-Page block adapters that normalize list 2.x data, reject nested lists and inline HTML-like text, validate safe URLs, and persist only canonical Page block content.             |
| Backend safety          | Hardened entity create/update validation so Page block content is normalized before persistence and invalid Editor.js payloads fail closed before store calls.                                            |
| Metahub UX              | Added an entity-owned `/content` route for `components.blockContent.enabled` Entity types. Page cards and rows now open content authoring, while metadata edits stay in the shared three-dot entity menu. |
| Runtime boundary        | `packages/apps-template-mui` remains Editor.js-free and renders the existing canonical Page blocks through safe MUI runtime components.                                                                   |
| Validation              | Focused shared types, backend route, template UI, metahubs frontend tests, affected lints/builds, dependency install checks, Chromium Basic Pages UX Playwright flow, and `git diff --check` passed.      |

## 2026-05-04 Entity Page UI Parity Cleanup

Closed the remaining Page metadata UI parity issues reported from the browser screenshots.

| Area                | Resolution                                                                                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Breadcrumbs         | Entity-route breadcrumbs now resolve labels from localized Entity type presentation/codename data before using legacy menu-key fallbacks, preventing raw `pages` and `metahubs:pages.title` labels on Page routes.                                                                                   |
| Shared actions      | Generic entity Page card and table actions now render through the shared `BaseEntityMenu` three-dot menu, with descriptors derived from the same copy/edit/delete/restore capability flags.                                                                                                          |
| Pagination          | Generic entity pagination now has a full-width wrapper matching the standard entity list layout instead of shrinking to the intrinsic table pagination width.                                                                                                                                        |
| Regression coverage | Added focused tests for localized Page breadcrumbs, shared action menu rendering, hidden disabled Page actions, and the full-width pagination wrapper. The Chromium Basic Pages UX flow now checks breadcrumbs, action menus, pagination width, and the full Page create/edit/copy/delete lifecycle. |
| Validation          | `@universo/template-mui` lint/build/tests, `@universo/metahubs-frontend` lint/build/tests, `@universo/core-frontend` build, Chromium Basic Pages UX Playwright flow, Prettier check, and `git diff --check` passed.                                                                                  |

## 2026-05-04 LMS Snapshot Import Failure Closure

Closed the clean-database LMS snapshot import failure and the unreadable `[object Object]` import error display.

| Area                   | Resolution                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Import bootstrap       | Snapshot import now disables the standard `page` preset along with `hub`, `catalog`, `set`, and `enumeration` when creating the temporary target branch, so restore starts from an empty branch schema. |
| Backend error safety   | Import compensation now extracts readable messages from structured thrown objects before falling back to JSON/string conversion.                                                                        |
| Frontend error display | Metahub-level and publication-version snapshot import mutations use a shared formatter that renders `details.importError` and `details.cleanupError` instead of `[object Object]`.                      |
| Regression coverage    | Added backend route assertions for empty import presets and readable structured restore errors, plus frontend tests for structured import rollback/cleanup messages.                                    |
| Validation             | Focused frontend/backend tests, package lints, metahubs backend/frontend builds, core frontend build, Chromium LMS snapshot import/runtime flow, and whitespace checks passed.                          |

## 2026-05-04 LMS Page QA Closure

Closed the Page QA findings that remained after the Basic template and Page UX cleanup.

| Area                    | Resolution                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page list data loading  | Standard Page metadata routes now enable the generic entity authoring query pipeline, so browser-created Pages appear in the list without reload workarounds. |
| Page action permissions | Page copy/delete affordances now read `entity.page.allowCopy` and `entity.page.allowDelete`; edit remains governed by metahub management permission.          |
| Regression coverage     | `EntityInstanceList` tests assert Page pagination is enabled and Page copy/delete actions are hidden when Page settings disable them.                         |
| Browser proof           | Chromium Basic Pages UX flow now creates, reopens/edits, copies, and deletes a Page through the real UI while preserving the RU label/order/settings checks.  |
| Validation              | Focused frontend tests, frontend/backend lint, metahubs/core frontend builds, Chromium Playwright, and whitespace checks passed.                              |

## 2026-05-04 LMS Basic Template Sets And Page UX Cleanup

Closed the follow-up cleanup for the LMS product fixture baseline and the new Page metadata UX.

| Area                | Resolution                                                                                                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LMS Basic baseline  | The LMS template now includes the standard Basic presets by default and keeps LMS configuration constants in Sets-backed fixed values. The generated fixture contains `hub`, `page`, `catalog`, `set`, and `enumeration` baseline entities plus LMS-specific values. |
| Standard menu order | Basic, basic-demo, and LMS standard entity type ordering is now Hubs, Pages, Catalogs, Sets, Enumerations.                                                                                                                                                           |
| Page collection UX  | The Page list uses localized `pages.*` strings for title/search/empty states, removes the generic entity-owned helper/alert copy, removes the deleted toggle, keeps the primary action as `Create`, and localizes the Page block tab as `Content`.                   |
| Page settings       | Page copy/delete settings are in the shared metahub settings registry and the settings API filters tabs by entity types present in the current metahub.                                                                                                              |
| Regression coverage | Added backend template/schema tests, frontend entity/settings/i18n tests, shared types/menu-order tests, the LMS fixture contract update, and a Chromium Playwright Basic Pages UX flow with screenshots.                                                            |
| Validation          | Focused backend/frontend/types/template tests, package lints/builds, docs i18n check, Playwright LMS fixture generator, Playwright Basic Pages UX flow, fixture inspection, and `git diff --check` passed.                                                           |

## 2026-05-04 LMS Workspace Policy And Runtime Menu Cleanup

Closed the follow-up cleanup for LMS workspace policy, default workspace seeding, and runtime navigation.

| Area                         | Resolution                                                                                                                                                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Publication workspace policy | Removed the old no-workspaces publication/version policy from shared contracts, backend validation, metahub UI, connector handling, i18n, docs, tests, and fixture contracts. Valid publication policies are now `optional | required`.                                                                                                     |
| Connector schema options     | Renamed the optional connector-side choice to `enabled                                                                                                                                                                     | not_requested`, keeping optional first-sync behavior without reusing the removed publication policy semantics. |
| LMS menu                     | Removed inert Learning hub labels from the template and regenerated fixture. Development and Reports stay in the primary sidebar, and the LMS runtime flow asserts no `More` button.                                       |
| Workspace bootstrap          | Removed automatic shared `Published` workspace seeding. Workspace-enabled apps now start from owner/member personal `Main` workspaces only.                                                                                |
| Workspace UI                 | Moved Set default into the three-dot menu and render the default workspace marker as a star next to the workspace name in card and table views.                                                                            |
| Public runtime               | Public access-link and guest-session resolution scans active workspaces and binds to the workspace that owns the explicit link/session instead of using a special shared workspace codename.                               |
| Validation                   | Focused backend/frontend/template tests, package lint, package builds, docs i18n check, Playwright LMS fixture generator, Playwright LMS import/runtime flow, and `git diff --check` passed.                               |

## 2026-05-03 LMS Workspace And Page QA Hardening

Closed the remaining QA implementation gaps for connector-owned schema sync, irreversible workspace enablement, generic Page authoring, and the expanded LMS product fixture.

| Area                      | Resolution                                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connector persistence     | Connector publication `schema_options` are persisted only after an applied schema sync result. Pending destructive confirmations return without storing requested workspace choices.                                              |
| Workspace acknowledgement | First-time workspace enablement now requires explicit irreversible acknowledgement in shared policy validation, backend sync, connector UI, and affected e2e flows.                                                               |
| Publication schema bypass | Publication creation and publication-linked application creation no longer generate application schemas directly. Linked apps are still created, while schema installation remains connector-owned.                               |
| Page authoring            | Page entities with `blockContent` expose an Editor.js JSON authoring tab through the existing entity form dialog and validate payloads with the shared Page block schema.                                                         |
| LMS model                 | The LMS template and generated fixture now include Departments, Learning Tracks, Assignments, Training Events, Certificates, Reports, and supporting status/type enumerations.                                                    |
| Fixture/runtime proof     | The Playwright LMS generator regenerated `tools/fixtures/metahubs-lms-app-snapshot.json`; the Chromium LMS import/runtime flow passed after linked app creation, schema sync, navigation, localization, and guest runtime checks. |
| Validation                | Focused Jest/Vitest suites, targeted builds/lints, `apps-template-mui` build, docs i18n check, fixture generator, final Chromium LMS runtime flow, and `git diff --check` passed.                                                 |

## 2026-05-03 LMS Security And Page UX QA Closure

Closed the remaining post-QA findings for public runtime session integrity, Page navigation authoring, Page block rendering, and connector workspace browser coverage.

| Area                   | Resolution                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest runtime security | Guest sessions persist the issued access link id, workspace id, secret, and expiry; validation rejects tampered link/workspace transport tokens and compares secrets with constant-time checks.                 |
| Page menu authoring    | `page` is part of the shared menu item kind contract and is exposed in metahub and application menu editors using existing dialog/form patterns and EN/RU i18n.                                                 |
| Page rendering         | `apps-template-mui` now renders accepted Page blocks for ordered/unordered lists, tables, images, embeds as safe links, delimiters, quotes, headers, and paragraphs instead of silently dropping valid content. |
| Browser coverage       | Connector schema Playwright flow now opens the Schema Changes dialog, selects the workspace option through UI, verifies the sync payload, and confirms the application workspace state.                         |
| LMS runtime proof      | The LMS snapshot runtime Chromium flow passed after the guest-session hardening, including snapshot import, linked app creation, schema sync, guest session, guest progress, and guest submit.                  |
| Validation             | Targeted backend/types/apps-template tests, affected package lint/build checks, targeted Chromium connector flow, targeted Chromium LMS runtime flow, and `git diff --check` passed.                            |

## 2026-05-03 LMS Page Type And Workspace Policy Implementation

Implemented the Page metadata type, publication-version workspace policy, connector-owned workspace schema decisions, and regenerated LMS product snapshot.

| Area                    | Resolution                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Shared contracts        | Added `page` to metahub/script/runtime kind unions, added `blockContent`, and introduced `WorkspaceModePolicy` plus shared validation helpers.                                      |
| Templates and snapshots | Registered the Page preset in standard templates, added LMS `LearnerHome` Page with Editor.js-compatible blocks, and preserved runtime policy through publication snapshots.        |
| Runtime DDL/sync        | Added a physical-table contract so `hub`, `set`, `enumeration`, and `page` sync as metadata-only objects with nullable runtime `table_name`.                                        |
| Workspace policy        | Publication versions store `optional                                                                                                                                                | required`; transition guards prevent disabling a previously required workspace contract. |
| Connector sync          | `schema_options` on connector-publication links stores optional workspace choices; application `workspaces_enabled` is installed state updated after successful schema sync.        |
| Frontend UI             | Removed workspace mode from application creation flows; publication version dialogs and connector diff dialogs own policy/choice/acknowledgement UI with EN/RU i18n.                |
| Published runtime       | `apps-template-mui` renders Page block content through the existing dashboard details surface and supports Page menu items.                                                         |
| LMS fixture/docs        | Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through Playwright; GitBook LMS/application docs now describe `LearnerHome` and connector schema sync workspace policy. |
| Validation              | Shared package tests/builds, backend/frontend/template focused tests, affected frontend builds, `pnpm run build:e2e`, and the Playwright LMS generator all pass.                    |

## 2026-05-03 LMS Page Workspace QA Closure

Closed QA findings from the Page/workspace-policy implementation.

| Area                    | Resolution                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy workspace inputs | Removed workspace toggles from application/publication creation payloads and UI contracts; direct application creation now remains a shell until connector schema sync.                   |
| Page content safety     | Added strict shared Page block-content validation and fail-closed runtime Page block normalization.                                                                                       |
| Delete safety           | Page deletion now blocks active runtime navigation/layout references before destructive operations.                                                                                       |
| Sync consistency        | Connector schema options are persisted only after successful schema sync; failed sync attempts no longer record workspace choices.                                                        |
| Snapshot import         | Snapshot restore updates existing standard entity type definitions by `kind_key`, preventing duplicate Page definition failures when importing LMS snapshots into freshly seeded schemas. |
| Browser proof           | Targeted Chromium LMS snapshot/runtime flow passed (`2/2`): browser import, linked app creation, connector schema sync, EN/RU Page rendering, overflow navigation, and guest LMS runtime. |

## 2026-05-03 LMS PR Hygiene Closure

Closed QA hygiene findings before the LMS MVP PR.

| Area               | Resolution                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Legacy LMS wording | Replaced stale test fixture titles with neutral `Learning Portal Basics` wording.                                     |
| UUID policy        | Removed guest runtime `crypto.randomUUID()` fallback; IDs require `public.uuid_generate_v7()`.                        |
| Menu href safety   | Added `sanitizeMenuHref`/`isSafeMenuHref` in `@universo/utils`; editors reject protocol-relative/unsafe-scheme links. |
| Validation         | Backend tests, menu href unit tests, apps-template tests, root `pnpm build` pass.                                     |

## 2026-05-02 LMS Documentation And Template Lint QA Closure

| Area          | Resolution                                                             |
| ------------- | ---------------------------------------------------------------------- |
| GitBook docs  | Replaced stale wording about removed LMS widgets; EN/RU checker green. |
| Template lint | Reduced `@universo/apps-template-mui` ESLint warnings from 37 to zero. |
| Test hygiene  | Removed noisy JSDOM anchor warnings; 87/87 tests pass.                 |

## 2026-05-02 Phase 3 - Gate Demo Template Surfaces

Disabled demo template surfaces by default so published runtime apps don't show demo content unless explicitly enabled.

| Area                          | Resolution                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `dashboardLayout.ts` defaults | Changed `showOverviewCards`, `showSessionsChart`, etc. from `true` to `false`.  |
| `widgetRenderer.tsx`          | Replaced hardcoded demo user with generic "User" label and `PersonRoundedIcon`. |
| Tests                         | Updated defaults; 84/84 tests pass.                                             |

## 2026-05-02 Fix Public Shared Workspace Selection Ambiguity

Made public shared workspace selection deterministic via a dedicated codename at the time. This behavior was later replaced by link-owned workspace resolution without automatic shared workspace seeding.

| Area                        | Resolution                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| `_app_workspaces` DDL       | Added nullable `codename TEXT` column with unique active index.                           |
| Public workspace resolution | Superseded by link-owned workspace resolution without automatic shared workspace seeding. |
| Tests                       | 3 new tests; all 13 workspace tests pass.                                                 |

## 2026-05-02 LMS Portal Runtime Refactor Implementation

First LMS portal cleanup pass.

| Area                     | Resolution                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| LMS template/fixture     | Removed global `moduleViewerWidget`, `statsViewerWidget`, `qrCodeWidget`.                            |
| Runtime menu contract    | Extended `menuWidget` with `maxPrimaryItems`, `overflowLabelKey`, `startPage`, `workspacePlacement`. |
| Editors/schemas          | Updated shared types, application/metahub menu editors, widget config.                               |
| Columns container        | Preserved nested widget `id`, `sortOrder`, `config` in shared types and renderers.                   |
| Public workspace seeding | Superseded: workspace-enabled apps now start from the owner/member `Main` workspaces only.           |
| Published app template   | Added generic overflow menu rendering; LMS currently keeps primary items visible without overflow.   |
| Validation               | Root `pnpm build` 30/30, Playwright LMS flow green.                                                  |

## 2026-05-02 LMS Portal Runtime QA Remediation Closure

| Area                  | Resolution                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Start page resolution | Runtime row loading resolves `startPage` against materialized catalog ids/codenames.              |
| Menu contract         | LMS template/fixture no longer include inert top-level links; disabled link items lacking `href`. |
| Workspace navigation  | Shells deduplicate workspace root menu entry.                                                     |
| Public workspace sync | Existing shared workspaces get owner membership; avoids redundant seed pass.                      |
| Validation            | Root build, Playwright, docs check all green.                                                     |

## 2026-05-02 Safe Scheme Validation for Menu href Links

| Area                 | Resolution                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Editor validation    | Application/Metahub menu editors reject `javascript:`, `data:`, `vbscript:` URL schemes.                      |
| Runtime sanitization | `MenuContent.tsx` uses whitelist (`/`, `https:`, `mailto:`, `tel:`, `#`); unsafe links render as inert items. |
| i18n                 | Added `hrefUnsafeScheme` validation in both locales.                                                          |

## 2026-05-02 LMS Runtime QA Remediation

| Area                       | Resolution                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| JSONB/VLC runtime writes   | Plain string STRING fields normalized to VLC object before insert/update.                        |
| Public workspace isolation | Public guest runtime resolves the workspace that owns the explicit access link or guest session. |
| Dashboard defaults         | `MainGrid` falls back to shared dashboard defaults instead of local `true` fallbacks.            |
| Validation                 | Backend Jest, apps-template Vitest, Playwright `lms-qr-code`/`snapshot-import-lms-runtime` pass. |

## 2026-05-02 LMS Runtime Role And Copy QA Closure

| Area                 | Resolution                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Runtime member role  | Application `member` is now read-only: create/edit/copy/delete fail closed.                    |
| Permission contract  | Runtime app data responses expose content permissions; UI hides CRUD controls.                 |
| TABLE copy integrity | Runtime row copy loads child TABLE metadata and normalizes through metadata-aware insert path. |
| Validation           | Backend Jest, apps-template Vitest, root build, Playwright all green.                          |

## 2026-05-02 LMS Runtime Child Rows QA Closure

| Area                  | Resolution                                                                              |
| --------------------- | --------------------------------------------------------------------------------------- |
| Child-row permissions | TABLE child-row listing no longer requires mutation permissions; mutations fail closed. |
| Child-row copy        | Uses shared metadata-aware normalization for localized STRING/JSON child values.        |
| Validation            | Backend 67/67, root build 30/30, Playwright 2/2.                                        |

## 2026-05-02 LMS Frontend QA Closure

| Area                    | Resolution                                                       |
| ----------------------- | ---------------------------------------------------------------- |
| Connector sync test     | Mutation tests assert current `syncApplication(...)` call shape. |
| Mutable visibility test | Application list update coverage asserts `isPublic` submission.  |
| Validation              | Applications frontend 139/139, lint green.                       |

## 2026-05-02 LMS Backend QA Blocker Closure

| Area                    | Resolution                                                              |
| ----------------------- | ----------------------------------------------------------------------- |
| Sync diff preview       | Flattens TABLE child fields into table metadata for preview rendering.  |
| Release bundle contract | Route tests assert current application-origin release bundle shape.     |
| Menu href hardening     | Rejects protocol-relative `//host` href values.                         |
| Validation              | Backend 240/240, apps-template 89/89, root build 30/30, Playwright 2/2. |

## 2026-04-29 Runtime Workspace PR Review Hardening

| Area                    | Resolution                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Workspace copy metadata | Copy excludes runtime system columns; resets metadata with fresh timestamps.          |
| Workspace API errors    | Endpoints return stable error `code` values alongside messages.                       |
| SPA navigation          | Uses host-provided SPA navigation callbacks; removes direct `window.location.assign`. |
| Validation              | Backend 28/28, apps-template 14/14, builds green.                                     |

## 2026-04-29 Runtime Workspace I18n And Switcher Locale Closure

| Area                      | Resolution                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Workspace switcher locale | Reads VLC names with active `i18n.language`; Russian workspaces render as `Основное`. |
| Error localization        | Known backend errors mapped through EN/RU i18n keys.                                  |
| Validation                | apps-template 12/12, root build 30/30, Playwright 2/2.                                |

## 2026-04-28 Runtime Workspace Name-Only Contract Closure

| Area             | Resolution                                               |
| ---------------- | -------------------------------------------------------- |
| Backend schema   | `_app_workspaces` no longer creates machine-name column. |
| Runtime API      | Create/edit/copy accept only `name`.                     |
| Published app UI | No machine name fields; fallback labels use UUID.        |
| Validation       | Backend 36/36, apps-template 10/10, Playwright 2/2.      |

## 2026-04-28 Runtime Workspace Layout And CRUD QA Closure

| Area                   | Resolution                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Layout materialization | Workspace-enabled sync materializes `workspaceSwitcher` widget in left layout zone.                              |
| Workspace CRUD         | Create, edit, copy, delete from card/table views. Copy creates UUID v7 rows; deletion blocks personal workspace. |
| Access safety          | Owner-only mutations; prevents last-owner removal.                                                               |
| Validation             | Backend/frontend tests, root build 30/30, Playwright 2/2.                                                        |

## 2026-04-28 Runtime Workspace Direct Route QA Closure

| Area                   | Resolution                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Direct workspace route | `GET /applications/:applicationId/runtime/workspaces/:workspaceId` for direct loading. |
| Published app UI       | `RuntimeWorkspacesPage` resolves detail routes through detail query.                   |
| Validation             | Backend 27 tests, apps-template 7 tests, Playwright 2/2.                               |

## 2026-04-28 Runtime Workspace UI QA Remediation Closure

| Area                    | Resolution                                                                    |
| ----------------------- | ----------------------------------------------------------------------------- |
| Workspaces route layout | `/a/:applicationId/workspaces` reuses runtime menu with hidden demo surfaces. |
| CRUD shell isolation    | Workspace routes no longer mount generic runtime CRUD dialogs.                |
| Validation              | Vitest 15+9, root build 30/30, Playwright 2/2.                                |

## 2026-04-28 Runtime Workspace QA Gap Closure

| Area                         | Resolution                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Mutable visibility           | Applications switch Closed/Public in edit dialog; `isPublic` participates in General settings dirty state. |
| Runtime workspace navigation | Catalog clicks from `/workspaces` navigate back to `/a/:applicationId?linkedCollectionId=...`.             |
| Fixture integrity            | LMS/quiz/self-hosted fixture hashes refreshed.                                                             |
| Validation                   | Vitest, lint, root build, Playwright all green.                                                            |

## 2026-04-28 Runtime Workspace Final QA Closure

| Area                 | Resolution                                                            |
| -------------------- | --------------------------------------------------------------------- |
| Backend lint         | Removed remaining applications-backend lint warning.                  |
| Runtime member view  | Published workspace members reuse isolated card/list toolbar pattern. |
| Locale/browser proof | Russian labeling covered by Vitest and Playwright.                    |

## 2026-04-28 Runtime Workspace UX QA Closure

| Area                | Resolution                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Workspace switcher  | Follows isolated MUI `SelectContent` pattern: card-like selected state, grouped dropdown. |
| Sidebar separation  | Workspace selector auto-injected before runtime menu links.                               |
| Safe member actions | Backend-owned `canRemove` metadata; UI hides removal for protected members.               |

## 2026-04-27 Runtime Workspace QA Remediation Closure

Closed the post-QA implementation gaps for runtime workspace management.

| Area               | Resolution                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| Route hardening    | Workspace routes validate UUID format before schema resolution or service execution.                          |
| Workspace identity | Shared workspace creation is name-only; runtime UUID is the only identity.                                    |
| UI error handling  | Member removal dialog surfaces backend failures, including protected last-owner removal.                      |
| Test coverage      | Backend controller tests cover malformed route IDs; isolated page test covers removal-error rendering.        |
| Browser proof      | Playwright flow performs real negative UI actions for invalid creation, blocked removal, missing-user invite. |
| Validation         | Backend 92, apps-template 3, root build 30/30, Playwright 2/2.                                                |

## 2026-04-27 Mutable Application Visibility And Runtime Workspace Management

Closed the implementation pass for mutable application visibility and first-class runtime workspace management.

| Area                  | Resolution                                                                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mutable visibility    | Owners can change public/closed visibility through settings page; workspace mode is structural read-only.                                                                         |
| Backend workspace API | Pagination/search for workspace/member listing; member invitation accepts email or user id; requires active application member.                                                   |
| Published app UI      | `@universo/apps-template-mui` owns full runtime workspace section with card/list, pagination, search, CRUD, invite, remove.                                                       |
| Runtime navigation    | Core runtime route appends Workspaces menu item; workspace route bypasses normal CRUD adapter; routes honor `linkedCollectionId` query parameter.                                 |
| QA remediation        | Default-workspace switching and member removal through transaction-scoped checks with `RETURNING`; workspace create/edit/copy name-only; member-list ordering casts UUIDs safely. |
| Workspace switcher UX | Shows workspace type chips so shared `Main` and personal `Main` are distinguishable.                                                                                              |
| Documentation         | Package READMEs and EN/RU GitBook pages describe mutable visibility, workspace mode, email invitation, workspace management section.                                              |
| Validation            | Backend/frontend tests, root build, Playwright 2/2 green.                                                                                                                         |

### 2026-04-27 GitBook Documentation (4 entries)

-   **Refresh Implementation**: Updated stale EN/RU pages to entity-first architecture; removed roadmap wording; added i18n validation tooling. 78 EN/RU GitBook page pairs validated.
-   **Refresh QA Closure**: Updated screenshot generators for EN/RU; removed stale `catalog-compatible` assets; added asset-reference checker.
-   **Screenshot Coverage Completion**: Extended quiz/admin generators; added required-page screenshot checks. 20 pages with screenshots per locale.
-   **Final QA Remediation**: Expanded to 33 pages with screenshots per locale; removed remaining roadmap wording; translated RU headings.

## 2026-04-26 Entity Resource Surface (3 entries)

-   **Data-Driven Cleanup**: Removed runtime-only hardcoded Resources tab labels and synthetic standard entity type fallback behavior; seeded standard Catalog/Set/Enumeration labels as VLC metadata on persisted entity type definitions; backend no longer generates synthetic missing standard types; frontend resolves labels from persisted metadata through capability registry; publication path includes entity type metadata in canonical hashes. Root `pnpm build` green, focused tests green.
-   **QA Remediation**: Tightened resource surface VLC validation so malformed localized titles fail before persistence; added negative service tests proving standard entity type component/UI-structure mutations fail closed while label edits remain allowed; added i18n admin warning for conflicting labels; Playwright flow creates fresh Basic metahub, verifies EN/RU labels, edits through persisted metadata, verifies renamed UI. Targeted tests/builds green, Playwright green.
-   **QA Hardening**: Standard types reject publication state changes (frontend disables toggle); resource defaults from `@universo/types` removing duplicate frontend map; canonical JSON with sorted object keys for structural comparison; copy dialogs skip occupied `kindKey` with next available suffix; frontend preserves protected fields during standard-type saves. Playwright green on fresh DB.

## 2026-04-24 Steering Files Refactoring

Completed a comprehensive refactoring of `.kiro/steering/` files to align documentation with the current project architecture.

| Area                 | Resolution                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product.md`         | Completely rewritten to describe Metahubs Platform (ECAE architecture, key domains: Metahubs, Applications, Publications, Scripting, LMS).                                |
| `structure.md`       | Updated from 6 outdated packages to current 31 packages with classification by roles (Core shell, Feature modules, Infrastructure, UI support, Scripting, Documentation). |
| `tech.md`            | Updated technology stack with current versions from `pnpm-workspace.yaml`; added TanStack Query, Playwright, isolated-vm, UUID v7; added DDL & Migrations section.        |
| `recommendations.md` | Expanded with Three-Tier DB Access Pattern, Knex Boundary Rule, SQL Safety Rule, Mutation Rule, Testing Rule, TanStack Query recommendation, Security section.            |

## 2026-04-22 Application Layout Management (4 entries)

-   **Shared List And Parity Closure**: Added `LayoutAuthoringList` to `@universo/template-mui` as common card/list renderer; restored metahub compact embedded-header behavior through `adaptiveSearch`/`controlsAlign`/`toolbarSx` props; fixed `@universo/template-mui` package export contract. Metahub Vitest 12/12, applications Vitest 2/2, Playwright 3/3.
-   **Shared Authoring Convergence**: `LayoutAuthoringDetails` in `@universo/template-mui` is now common five-zone widget authoring surface for both metahub and application layout detail; metahub delegates zone rendering, add-widget, widget-row controls, and drag handling to shared component; application editor opens structured dialogs instead of raw JSON. Playwright 3/3.
-   **UI Parity Browser-Proof Closure**: Added shared `LayoutAuthoringDetails` move action menu with accessible zone-move control; rebuilt `@universo/template-mui`/`applications-frontend`/`core-frontend` for updated browser chunks. Playwright 3/3.
-   **Sidebar + Final Closure**: Added missing `application-layouts` entry to canonical sidebar menu config; `ConnectorDiffDialog` exposes stable select ids and test hooks for bulk/per-layout resolution; read access policy honors explicit per-application `settings.applicationLayouts.readRoles`; shared widget validation via `@universo/types` schema-driven parsers. Jest 13/13, canonical root build 30/30, Playwright 3/3.

## 2026-04-21 Application Layout Management + LMS (5 entries)

-   **Layout Management QA Remediation**: Widget catalog uses same fail-closed application ACL and runtime-schema guard; widget move/reorder with optimistic mutation; connector diff carries structured layout change data; five-zone layout UI with EN/RU i18n. Backend 5/5, frontend 9/9, Playwright 2/2.
-   **Layout Management MVP**: First-class application-side layout management with source lineage, sync state, source/content hashes, conflict handling (keep local or overwrite from metahub), SQL-first store with advisory locks and version checks, runtime filtering for active layouts/widgets, GitBook guide pages. Targeted builds green.
-   **PR #771 Bot Review Triage**: `RuntimeWorkspaceError` with stable codes mapped to HTTP statuses; `GuestApp` stores CSRF tokens under application-scoped storage key; `QRCodeWidgetConfig.url` now optional. Root build 30/30.
-   **LMS Guest Runtime Localization**: Added missing RU completion copy (`guest.completeModule`, `guest.restartModule`, `guest.moduleCompleted`); defensive locale resolution from URL query → persisted `i18nextLng` → prop; root cause was stale frontend bundle. Playwright 2/2.
-   **LMS Final Closure**: Header-based guest runtime transport (`X-Guest-Student-Id`/`X-Guest-Session-Token`); shared-workspace-aware access-link resolver; inline SVG fixture assets; official canonical regeneration 2/2.

## 2026-04-20 LMS MVP Completion (5 entries)

-   **Snapshot Import Browser Proof**: Explicit `workspaceId` query override with UUID format validation and membership check against `allowedWorkspaceIds`; `waitForApplicationRuntimeRowCount` forwards optional runtime query params. Backend 14/14, Playwright 2/2.
-   **Post-QA Security And ACL**: Public workspace discovery limited to active shared only; personal-workspace member-management fail-closed with explicit `403`; standalone locale from document/browser language via `i18n.changeLanguage`. Backend 27/27, Vitest 4/4.
-   **Snapshot Import Runtime Remap**: String-based child-table references (e.g., `Modules.ContentItems[].QuizId`) remapped to workspace-scoped ids during personal-workspace seeding; string-dependency ordering so `Modules` wait for `Quizzes`. Backend 6/6, Playwright green.
-   **Plan Completion And QA Debt**: Workspace-aware guest persistence (explicit `workspace_id`); quiz results preserved until explicit return to module; module completion gated on successful progress persistence. Backend 10/10, Playwright 3/3.
-   **MVP QA Remediation Finish**: Transaction-safe `createSharedWorkspace`/`addWorkspaceMember`; server-side guest session expiry (`secret`, `expiresAt` in JSON envelope); public script delivery with `Content-Type`, `nosniff`, CSP, cache headers; widget/runtime UX hardening (QRCode timeout cleanup, completion screen for last module item). Backend 20/20, Vitest 17/17.

## 2026-04-19 QA Remediation — Post-Refactoring Polish

Completed all actionable QA findings from Phase 13 audit. Fixed lint (0 errors in metahubs-backend), deleted 6 legacy doc files, updated 8 cross-ref files, stabilized MetahubMembers with timeout hardening (252/252 pass under parallel load), extracted `createEntityCopyCallback<TPayload>` factory applied to 4 list components, created full-lifecycle E2E spec (`metahub-entity-full-lifecycle.spec.ts`), fixed 5 entity preset build files from legacy export names to neutral names. Build 30/30, frontend 252/252, utils 289/289. E2E execution blocked on migration drift requiring DB reset.

## 2026-04-18 Metahub QA + Resources (7 entries)

-   **Final QA Debt Elimination**: REST/OpenAPI terminology updated (`Field Definitions`/`Fixed Values`/`Records` tags); shared repository wording aligned with entity-first terminology; frontend lint debt cleared with package-scoped ESLint override for test files. Backend 79/79, frontend 40/40, build 30/30.
-   **Resource Surfaces QA Follow-up**: Duplicate `resourceSurfaces.routeSegment` values rejected at `EntityTypeService`/`TemplateManifestValidator` level; `SharedResourcesPage` loads full sorted entity-type slice and resolves labels by capability; permission regression proof for read-only metahub members on CRUD surface. Backend 43/43, frontend 36/36, Playwright `empty` authoring flow green.
-   **Resource Surfaces Final QA**: Full entity-type pagination via `useAllEntityTypesQuery()` on `fetchAllPaginatedItems()` replacing hard `limit=1000`; legacy tab wording updated (`Field definitions`→`Определения полей`, `Lists of values`→`Значения перечислений` in RU); RU resource docs fully rewritten; extended member ACL Playwright flow. Frontend 36/36, Playwright flows green.
-   **Resource Surfaces QA Closure**: Custom surface keys/route segments allowed while constraining to supported capabilities; builder preserves surface metadata across edits; direct service/route tests for custom surfaces; `empty` template Playwright coverage; 8 new EN/RU doc files created. Backend tests, frontend tests, build 30/30.
-   **PR #767 Bot Review Triage**: `PublicationList.tsx` type safety fix (replaced unsafe cast with `PublicationMenuBaseContext`/`PublicationConfirmSpec` contracts); `SharedResourcesPage.tsx` fallback-tab suggestion rejected after QA review (component already renders through `effectiveTab`). Root build green.
-   **Terminology And QA Closure**: Renamed catalog metadata headings/dialogs/delete warnings from `Field Definitions` to `Attributes` in EN/RU locales; synced Playwright expectations in 3 browser spec files; workspace build boundary refreshed via root `pnpm build` before final validation. Frontend 40/40, backend 44/44, build 30/30.
-   **QA Closure — i18n, Resources, Lint**: Added complete `records.*` section (~44 keys) to both EN/RU; dynamic Resources tabs derived from entity type `ComponentManifest` fields (tabs appear only when entity type has corresponding component enabled); fixed 19 production lint warnings (9 `react-hooks/exhaustive-deps`, 8 `no-explicit-any`, 2 unused vars); README directory structure fixed. Build 30/30, backend 68/68, frontend 64/64.

## 2026-04-17 Entity-First Naming + QA (12 entries)

-   **Distributed Noodling Ullman Continuation**: Regenerated both canonical fixtures through Playwright generators (`metahubs-self-hosted-app-snapshot.json` and `metahubs-quiz-app-snapshot.json`); stabilized `docs-entity-screenshots.spec.ts` and `docs-quiz-tutorial-screenshots.spec.ts`; synced snapshot/import assertions with entity-first keys; updated `codename-mode.spec.ts` headings detection; revalidated 6 core browser flows including `metahub-domain-entities`, `metahub-entity-full-lifecycle`, `snapshot-export-import`, `snapshot-import-quiz-runtime`.
-   **Entity Type Naming Refactoring**: Renamed all entity type display names from surface-key terminology (`tree_entity`, `linked_collection`, `value_group`, `option_list`) to traditional names (Hubs, Catalogs, Sets, Enumerations). Internal surface keys preserved unchanged; only preset definitions, display strings, i18n labels, and documentation updated. Sidebar restructured with dynamic entity types under Resources. 25+ frontend source files, 11 Playwright specs, 14 doc files updated. Build 30/30, 934 tests.
-   **QA Closure — Entity Copy Contract**: `copyEntitySchema` accepts entity-specific copy flags (`copyAllRelations`, relation-specific flags, `copyFixedValues`, `copyOptionValues`) and `parentTreeEntityId` override; `applyDesignTimeCopyOverrides` merges all copy plan normalizers. `src/constants` folder renamed to `src/view-preferences`. Backend 40/40, build 30/30.
-   **QA Hardening — Public Route Guard**: `publicMetahubsController` rejects non-linked-collection-compatible objects; backend test contract synced with neutral entity-first wording (`tree entity`, `linked collection`, `option list`); negative coverage for excluded kinds. Backend 63/63, build 30/30.
-   **Neutral Kind/Settings Contract Layer**: `@universo/types` exposes neutral `EntitySurfaceKey`, `EntitySettingsScope`, surface-kind resolvers, setting-key builder while preserving legacy-compatible values; backend kind/settings consumers resolve through neutral helper mapping; frontend settings/permissions flows consume neutral scope helpers. Build 30/30.
-   **QA Remediation — Playwright CLI Generator**: Self-hosted fixture regeneration through wrapper-based Playwright CLI on port 3100 (2 passed in 5.0m); snapshot artifact `metahubs-self-hosted-app-snapshot.json` (141.0 KB) refreshed; hosted E2E finalize cleanup completed (7 schemas dropped, 2 auth users deleted).
-   **QA Remediation — Generator + Snapshot Flow**: Self-hosted fixture contract validates entity-first component keys (`records`, `treeAssignment`, `fixedValues`, `optionValues`); snapshot flow assertions use neutral keys; generator run 2/2, snapshot export/import 5/5. Legacy folder audit confirmed no active legacy folders. Build 30/30.
-   **i18n Remediation**: EN/RU metahubs locales expose `fieldDefinitions` instead of legacy `attributes`; removed top-level legacy `documents`/`elements` and dead nested sections; consolidation test and export test updated. Frontend 64/64 (252/252), lint 0 errors, build 30/30.
-   **Deep Internal Identifier Cleanup (Phase 13)**: 44+ identifier renames in nestedChildHandlers (`listNestedEnumerations`→`listNestedOptionLists`, etc.), optionValueHandlers (all `enumeration`→`optionList`), fixedValue controller (`ensureSetContext`→`ensureValueGroupContext`, `CONSTANT_LIMIT`→`FIXED_VALUE_LIMIT`), services (`moveConstant`→`moveFixedValue`, `getAllowedConstantTypes`→`getAllowedFixedValueTypes`). Build 30/30, backend 68/68 (581 tests), frontend 64/64 (252 tests).
-   **Entity-First Final Refactoring Phases 7-12**: E2E API helper renames (17 functions in `api-session.mjs` + 16 consumer spec files); test alignment (7 failing frontend test files fixed); created `docs-entity-screenshots.spec.ts` generator; created 8 new doc files (EN+RU: `entity-systems.md`, `shared-field-definitions.md`, `shared-fixed-values.md`, `shared-option-values.md`); zero-debt grep audit (all 9 checks pass). Build 30/30.
-   **Entity-First Closure Follow-Up**: Added explicit Testing Library cleanup in `setupTests.ts` to prevent DOM state leakage; fixed branch copy-options test mock to avoid `importActual` stall; eliminated all red eslint/prettier failures in metahubs packages; standard preset labels resolve through entity-first keys (`metahubs:treeEntities.title`, etc.). Backend 55/55, frontend 10/10.
-   **Full Legacy Vocabulary Elimination**: Phases 1-5, 7 of legacy vocabulary elimination: `predefinedElements`→`records` (223 refs), `hubAssignment`→`treeAssignment`, `enumerationValues`→`optionValues`, `constants`→`fixedValues`; `standardEntityKinds`→`builtinEntityKinds`, `standardKindBehaviorRegistry`→`builtinKindBehaviorRegistry`, `StandardEntityKinds`→`BuiltinEntityKinds`; fixed `publicationSnapshotHash.ts` broken reference. Build 30/30, backend 68/68, frontend 64/64.

## 2026-04-16 Legacy Elimination + Bulk Renames (3 entries)

-   **Final Legacy Elimination (13-phase plan A-M)**: Eliminated ALL remaining legacy naming across the codebase: copy option types (`AttributeCopyOptions`→`FieldDefinitionCopyOptions`), route params (`:attributeId`→`:fieldDefinitionId`), NavbarBreadcrumbs cleanup (~265 lines of dead legacy URL extractors), Playwright spec migration to entity-route paths, DND file renames (`AttributeDndProvider`→`FieldDefinitionDndProvider`), type renames (`AttributeDataType`→`FieldDefinitionDataType` across 7+ packages), template-MUI hook renames (`useCatalogName`→`useLinkedCollectionName`), backend shared file renames, NavbarBreadcrumbs vars neutralization. Build 30/30.
-   **Bulk Parameter/Variable Renames**: Automated renames via perl with word-boundary matching and negative lookbehinds: `enumerationId`→`optionListId` (321 refs), `setId`→`valueGroupId` (393 refs), `catalogId`→`linkedCollectionId` (904 refs), `hubId`→`treeEntityId` (957 refs). Fixed critical stored data access bug (`typed.linkedCollectionId` reading JSONB storing `catalogId`). Extended renames to applications-frontend, apps-template-mui, applications-backend with stored data preservation. Build 30/30.
-   **Wire Protocol Count Field Neutralization**: Backend `hubsCount`→`treeEntitiesCount`, `catalogsCount`→`linkedCollectionsCount`, `constantsCount`→`fixedValuesCount`; 8 frontend interfaces updated; UI consumers and mutation hooks synchronized; 3 build error fixes. Build 30/30.

## 2026-04-15 Backend De-specialization (12 entries)

-   **Backend Dead Controller Factory Removal**: Removed unused controller-factory tails from linked-collection and option-list helper modules; `linkedCollectionController.ts` keeps only live helper/runtime exports; `optionListController.ts` rebuilt as helper-only module. Backend 40/40, build 30/30.
-   **Standard Entity Copy Contract Neutralization**: `copyOptions.ts` in types/utils now treats `TreeEntityCopyOptions`/`LinkedCollectionCopyOptions`/`ValueGroupCopyOptions`/`OptionListCopyOptions` as canonical; frontend copy dialogs/API/i18n aligned; backend copy validation and child-copy helper use neutral keys. Frontend 7/7, backend 42/42, build 30/30.
-   **Standard Copy Backend Naming**: Copy-result contract returns `fieldDefinitionsCopied`/`recordsCopied`/`fixedValuesCopied`/`optionValuesCopied`; copy handlers use neutral schema names. Backend 42/42, build 30/30.
-   **Backend Value Group Controller Removal**: Nested set list/get/create/update/reorder/delete moved to generic entity controller directly; `valueGroupController.ts` deleted. Backend 40/40, build 30/30.
-   **Backend Tree Controller Removal**: Orphaned `treeController.ts` deleted after confirming no remaining imports; tree behavior lives in `entityInstancesController.ts` plus `treeCompatibility.ts`. Backend 40/40, build 30/30.
-   **Linked Collection Controller Removal**: Removed last child-controller delegation seam; nested linked-collection CRUD through direct service-backed handlers built from reusable helpers. Backend 40/40, build 30/30.
-   **ACL And Router Orchestration**: Generic custom-entity ACL maps to `createContent`/`editContent`/`deleteContent`; router-owned specialized dispatch removed; stale frontend proof synchronized. Backend 36/36, frontend 3, build 30/30.
-   **Layouts Resources Playwright Reconciliation**: Retargeted metahub layouts flow from removed `/common` to shipped `/resources` route; shared selector contract for `metahubResourcesTabs`/`metahubResourcesContent`. Playwright 2/2.
-   **RecordList Type Reconciliation**: Generic record editor repaired around neutral metadata/runtime contracts; `CodenameVLC` resolution before building dynamic field configs; `mutationTypes.ts` allows `expectedVersion` on updates. Build green.
-   **Behavior-Based Standard Blocking References**: `entityInstancesController.ts` exposes `getBlockingReferences` via behavior registry for catalog/set/enumeration; route dispatch removed from `entityInstancesRoutes.ts`. Backend 36/36.
-   **Behavior-Based Hub Blocking Endpoint**: `EntityBehaviorService` with reusable blocking-state hook; `standardKindCapabilities.ts` blocking-state builder; hub blocking through behavior registry instead of `treeController`. Backend 32/32.
-   **Public Runtime Hardening**: Public reads require real published runtime with active snapshot-backed version (not just `is_public` flag); metahubs frontend README pair repaired; neutral tree entity/linked collection wording for touched surfaces. Backend 63/63, build 30/30.

## 2026-04-14 Entity-First Neutralization (20+ entries)

Massive entity-first cleanup wave across backend and frontend:

-   **Metadata Transport**: Backend routes mount `field-definitions`/`fixed-values`/`records` suffixes; frontend URLs/navigation updated. Frontend 13/13, backend 39/39.
-   **Frontend Standard UI Local Alias**: `HubList`/`CatalogList`/`SetList`/`EnumerationList` replaced with neutral names. Vitest 8/8.
-   **Metadata API Helper Contract**: `listAttributes`→`listFieldDefinitions`, `listConstants`→`listFixedValues`, `listElements`→`listRecords` in API surfaces. Build 30/30.
-   **Frontend Route Builder**: `buildTreeEntityAuthoringPath` etc. replace Hub/Catalog/Set/Enumeration builders. Vitest 14/14.
-   **Standard Runtime API Helper**: `createCatalog*`→`createLinkedCollection*` etc. in standard runtime. Vitest 24/24.
-   **Standard Runtime Mutation**: Hook/type/form/action contracts neutralized to linked-collection/value-group/option-list. Vitest 32/32.
-   **Container Vocabulary And Shared Runtime**: Container-oriented prop names; neutral shared tab ids `fieldDefinitions`/`fixedValues`/`optionValues`. Vitest 12/12.
-   **Remaining Named Seam Neutralization**: `MetahubHubsService`→`MetahubTreeEntitiesService`; component barrel exposes neutral names. Backend 56/56, frontend 16/16.
-   **Frontend Public Type Contract**: `Hub`/`Catalog`/`MetahubSet`/`Enumeration` types replaced with neutral entity types. Frontend 16/16.
-   **Tree Runtime Seam**: Tree runtime modules renamed to tree-entity seam names. Frontend 32/32.
-   **Stale Contract Cleanup**: Removed `custom.catalog-v2`/`set-v2`/`hub-v2`/`enumeration-v2` markers from active tests/specs. Backend 81/81, build 30/30.
-   **Backend Neutral Service Vocabulary**: `attributesService`→`fieldDefinitionsService`, `constantsService`→`fixedValuesService`, `elementsService`→`recordsService`. Backend 81/81.
-   **Frontend Shared Vocabulary**: Metadata folder ownership to `fieldDefinition`/`fixedValue`/`optionValue`/`record`; orphan copies deleted. Frontend 5/5, build 30/30.
-   **Standard Entity Route And Export Neutralization**: Generic `StandardEntityCollectionPage` replaces per-kind page exports; `kinds/**`→`standard/**`. Frontend 14/14.
-   **Backend Entity Metadata Route Ownership**: Metadata controllers moved under `domains/entities/metadata/`; top-level folders deleted. Backend 39/39.
-   **Neutral Kinds Runtime Cutover**: Standard-kind logic relocated to `domains/entities/kinds/**`; legacy `attributes`/`constants`/`elements`/`general` folders deleted.
-   **Frontend Top-Level Metadata Folder Deletion**: Metadata/common implementations moved to entity-owned locations; top-level folders deleted. Frontend 17/17.
-   **Final Legacy Seam Removal**: Backend ownership to `domains/entities/children/**`; frontend authoring contract updated. Backend 36/36, frontend 18/18.
-   **Backend Generic Object Mutation**: Deleted business-named wrappers from `MetahubObjectsService`; removed child-controller registry. Backend 9/9, build 30/30.
-   **Entity-Owned Route Inventory**: OpenAPI source inventory updated; removed `managed` wording from backend/frontend/doc surfaces. Build 30/30.
-   **Neutral Entity-Surface Cleanup**: Removed transition-only `managed*` names from backend/frontend/schema/docs. Build 30/30.
-   **Remaining Legacy Ownership Cutover**: `legacyBuiltinObjectCompatibility.ts`→`entityDeletePatterns.ts`; entity-owned import paths. Backend 36/36, frontend 21/21.
-   **Post-Compression Test Repair**: Isolated test regressions after standard-entity folder moves. Frontend 83/83.
-   **Entity-Owned Child-Resource Contract**: Frontend child-resource APIs build entity-owned URLs; Playwright flows use entity-owned routes. Build green.
-   **Metadata Capability Neutralization**: Frontend/backend metadata folders renamed to `fieldDefinition`/`fixedValue`/`record`. Frontend 24/24, backend 70/70.
-   **Public Runtime Route Neutralization**: Public API exposes `tree-entities`/`linked-collections`/`field-definitions`/`records` instead of legacy paths. Backend 13/13, OpenAPI regenerated.
-   **Residual Legacy Cleanup**: UUID v7 for pending object ids; `catalog-v2` mock preset fixed; V2-only flow files renamed. Build 30/30.
-   **Final Entity-Only Surface Completion**: Removed legacy metahub compatibility entrypoints; rewritten `Resources workspace` documentation; permission browser proof stabilized. Build 30/30.
-   **Entity-Centric Navigation**: Static metahubs dashboard exports board/resources/entities; breadcrumbs target `/metahub/:id/resources`. Frontend 11/11, template 9/9.
-   **OpenAPI, Breadcrumb, Managed-Surface Cleanup**: Generated spec no longer publishes removed routes; `NavbarBreadcrumbs` neutral; managed create RBAC contract. Build green.
-   **Neutral Terminology Audit Closure**: Removed remaining `managed*` names from backend/frontend/schema/docs. Build 30/30.
-   **Frontend Top-Level Metadata And Common Folder Deletion**: Real metadata/common implementations moved under `domains/entities/metadata/*` and `domains/entities/shared/*`; top-level `domains/attributes`/`domains/constants`/`domains/elements`/`domains/general` physically deleted; tests/config retargeted. Frontend 17/17, build 30/30.
-   **Standard Subtree Barrel Cleanup**: Deleted barrel files (`index.ts`, `api/index.ts`, `hooks/index.ts`) under `standard/catalog`/`hub`/`set`/`enumeration`; consumers retargeted to direct module imports. Frontend 34/34, build 30/30.
-   **Final Legacy Seam Removal**: Backend standard-kind domain ownership moved to `domains/entities/children/**`; stale `domains/hubs`/`catalogs`/`sets`/`enumerations` route/domain files removed; frontend `EntitiesWorkspace` no longer marks direct standard kinds as system-managed. Backend 36/36, frontend 18/18, build 30/30.
-   **Post-Compression Test Repair**: Isolated test regressions after standard-entity folder moves; `OptionValueList` and `TreeList` test mocks updated to current module paths. Frontend 83/83, build 30/30.

## 2026-04-13 Legacy Removal (12+ entries)

-   **Residual Seam Cleanup**: Removed legacy `HubList`/`CatalogList`/`SetList`/`EnumerationList` frontend exports; neutral `getTypeById`/`listTypes`/`createType` naming in `EntityTypeService`; schema-ddl helpers renamed from `legacyCompatibility` to `managedStandardKinds`. Frontend 175 assertions/12 suites, build 30/30.
-   **Request-Scoped RLS Executor**: `createRlsExecutor` scopes transaction depth lexically instead of mutating shared counter; middleware-owned request transactions reused directly; Playwright helpers use entity-owned API paths instead of stale legacy reads. Database/Auth tests green, Playwright green.
-   **Managed Settings Namespace**: `entity.hub|catalog|set|enumeration.*` settings keys replace plural legacy prefixes; delete-dialog blocker routing through entity-route resolution; direct standard-kind backend/frontend tests aligned. Frontend/backend tests, build 30/30.
-   **Final Entity-Only Closure Wave**: Replaced `legacyCompatibility.ts` with `managedMetadataKinds` helper; `metahubsController` returns `entityCounts` grouped by kind instead of fixed hub/catalog aggregates; shared frontend components resolve through `listEntityInstances(...)` directly. Frontend tests, build 30/30.
-   **Standard-Kind Contract Sync**: `@universo/types` treats `catalog`/`hub`/`set`/`enumeration` as direct standard kinds without builtin registry; dynamic menu no longer depends on `includeBuiltins`/`source`; fixtures assert direct standard kinds. Build 30/30.
-   **QA Remediation For Legacy Removal**: `TemplateSeedExecutor` applies hub-assignment remap pass after seeded entities receive real ids; shipped UI copy matches unified standard-kind route model; EN/RU docs updated. Build green.
-   **Entity-Type Codename Enforcement**: Server-side duplicate codename blocking via `EntityTypeService`; `_mhb_entity_type_definitions` active-row unique index on lowered codename; `409`/`CODENAME_CONFLICT` contract. Build 30/30.
-   **Entity-Owned Metadata Route Cutover**: `createEntityInstancesRoutes` owns top-level entity routes; resolves managed kinds from compatibility metadata; delegates managed requests to specialized controllers; legacy mount removed from `router.ts`. Build 30/30.
-   **Legacy Frontend Route Tree Cleanup**: `MainRoutes.tsx` no longer registers old hubs/catalogs/sets/enumerations pages or their detail branches; unified `/entities/:kindKey/...` authoring surface; route-oriented tests rewritten for entity paths. Build 30/30.
-   **Legacy Removal Plan QA**: Template/preset reuse explicitly documented; dependency-safe seeding required; frontend cleanup breadth covers all real `source`/`isBuiltin`/`includeBuiltins` consumers; internal consistency resolved.
-   **Legacy Removal Shell And Snapshot Contract**: `MenuContent` fetches unified entity-type list without `includeBuiltins`; `NavbarBreadcrumbs` resolves labels through presentation/nameKey metadata; `SnapshotSerializer`/`SnapshotRestoreService` no longer serialize/restore `isBuiltin`. Build 30/30.
-   **Nested Child Instance Contract**: Standard child authoring through generic nested instance paths (`/entities/:kindKey/instance/:hubId/instances`) instead of business-named routes; frontend route builders and API helpers retargeted; docs/tests synchronized. Frontend 4/4, backend 31/31.

## 2026-04-12 Metahub QA + Spacing (3 entries)

-   **PR #763 Review Comment QA Triage**: `EntityFormDialog` now resets incoming initial state before paint on first open and syncs closed dialog state back to incoming initials; renders from internal state instead of prop-override; no longer writes ref during render (React render-purity guidance). `Header` inset removal rejected after Playwright proof showed breadcrumb/title alignment break. Jest green, build green, Playwright green.
-   **Metahub QA Gap Closure**: Shared shell-spacing contract extracted to `pageSpacing.ts` (both `MainLayoutMUI` and shared `Header` consume single route-aware source); `SkeletonGrid` exposes semantic `insetMode='page'|'content'` plus `skeleton-grid` test id; backend routes include isolated `403` ACL regressions. Build green, Playwright green.
-   **Metahub Page Horizontal Spacing Fix**: Standalone metahub pages respect outer gutter from `MainLayoutMUI` instead of compensating with local negative margins; legacy lists (Hubs, Catalogs, Sets, Enumerations, Branches, Members, etc.) and entity-based workspaces aligned under one left/right spacing rule; Common, Settings, Migrations, Layout details tabs no longer widen beyond header gutter. Build green.

## 2026-04-12 Entity V2 Closure Cluster

The remaining 2026-04-12 follow-up work stayed inside the same validated closure wave and is intentionally condensed here to keep this file focused on the newest durable outcomes.

| Entry                              | Durable outcome                                                                                                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Self-hosted fixture QA closure     | The committed self-hosted snapshot was regenerated through the supported generator path, the browser import flow re-exported and asserted the canonical envelope contract, and the canonical root build remained green. |
| Entity V2 QA completion follow-up  | Hub V2 and Enumeration V2 preset automation uplift is now locked through direct manifest tests and fixture export checks.                                                                                               |
| Entity V2 QA closure completion    | Compatibility-aware blocker queries now use full compatible kind arrays and `ANY($n::text[])`, preserving delete-safety for Set V2 / Enumeration V2 / Hub V2 custom kinds.                                              |
| Entity V2 post-rebuild remediation | First-open dialog hydration, delegated kind-key propagation, localized labels, copy support, and baseline fixture/schema version behavior were aligned with fresh-import proof.                                         |

## 2026-04-11 Entity V2 Completion Cluster

The 2026-04-11 wave closed the remaining Entity V2 route-ownership, compatibility, review-triage, automation, and workspace/browser seams. The detailed implementation inventory remains preserved in repository history; the durable outcomes below are the current operational summary.

| Entry                              | Durable outcome                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compatibility consolidation        | Entity-owned routes, read-only definition access, explicit shared-field labels, and browser workspace parity stayed aligned.                                               |
| Route ownership and genericization | Legacy-compatible V2 kinds now reuse mature legacy UI under entity-route ownership while preserving stored custom kinds across runtime, publication, and schema-ddl paths. |
| Review-triage fixes                | PR #757 lifecycle-id consistency and the later review-driven fixes were accepted only where confirmed by current contracts and external guidance.                          |
| Automation and ECAE closure        | Generic entity automation authoring, lifecycle dispatch, object-scoped Actions/Events, and browser proof all landed on green focused validation.                           |
| Workspace/browser closure          | Post-rebuild Entities workspace parity, Catalogs V2 shared-surface behavior, and action-menu robustness were all repaired and revalidated.                                 |

## 2026-04-10 Catalog V2 And ECAE Closeout Cluster

The 2026-04-10 wave primarily finished parity and closeout work rather than opening new architecture. The durable outcomes are summarized here while the exact command trail stays archived in repository history.

| Entry                                      | Durable outcome                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog V2 entity route isolation recovery | Catalog-compatible pages stay inside the entity route tree while still reusing shared catalog storage and mature authoring surfaces.                     |
| Shared-surface closure                     | Catalog-compatible entity views now delegate to the shared Catalogs authoring surface with localized preset labels and read-only-safe affordance gating. |
| Generator and deleted-state closure        | The self-hosted fixture contract uses the current structure baseline, and deleted-row inspection remains explicit behind `includeDeleted=true`.          |
| QA policy and ACL closure                  | Catalog-compatible copy/delete/permanent-delete and authoring visibility now reuse the same legacy policy split as Catalogs.                             |
| Final parity verification                  | Shared-field label drift and visual/browser proof mismatches were closed without widening scope into a new product phase.                                |
| Read-only entity contract                  | Backend entity-type reads now match the shipped read-only entity UI contract while writes remain manager-only.                                           |

## 2026-04-09 ECAE Delivery Cluster

The 2026-04-09 wave completed the first large end-to-end ECAE delivery set. This block is condensed, but the outcomes remain the active source of truth.

| Entry                                    | Durable outcome                                                                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Strict Catalogs V2 parity                | Backend/frontend/browser/runtime paths now treat catalog-compatible entity kinds as true parity-safe shared catalog surfaces.             |
| Phase 3.6-4 closure                      | Structured builder, browser/runtime proof, compatibility tests, and EN/RU docs all landed together.                                       |
| Phase 3.3-3.5 closure                    | Snapshot v3, DDL custom-type propagation, and runtime `section*` aliases were generalized without dropping legacy `catalog*` fields.      |
| Post-QA and dynamic menu closure         | The dynamic published custom-entity menu zone is now permission-aware and stable under the shared shell.                                  |
| Instance UI and browser validation       | The first generic entity instance UI, focused browser proof, and visual proof all passed on the real product route surface.               |
| Reusable presets and frontend foundation | Entity presets now reuse the template registry/versioning flow, and the frontend authoring workspace is integrated into the shared shell. |

## 2026-04-08 ECAE Foundation And QA Recovery Cluster

| Entry                                | Durable outcome                                                                                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend service foundation           | Entity types, actions, event bindings, lifecycle orchestration, and resolver DB extension are validated backend seams.                               |
| Generic CRUD and compatibility layer | Custom-only generic entity CRUD shipped first, then legacy built-in delete/detach/reorder semantics were lifted into shared helper layers.           |
| Design-time service genericization   | Shared child copy and object-scoped system-attribute management now exist behind reusable helpers rather than catalog-only seams.                    |
| Review and QA hardening              | PR review fixes, lint closure, attribute move ownership, strict E2E finalization, and current memory alignment were all validated on the root build. |

## 2026-04-07 Shared/Common And Runtime Materialization Cluster

| Entry                              | Durable outcome                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Shared/Common shell                | Common is the single authoring shell for shared attributes/constants/values/scripts/layouts.                                    |
| Shared snapshot v2                 | Shared sections export/import as first-class snapshot data but are materialized back into the flattened runtime/app-sync view.  |
| Shared override transaction safety | Request-scoped shared override writes reuse explicit caller runners instead of reopening nested transactions.                   |
| Inherited widget contract          | Catalog layout inherited widgets stay sparse, read-only for config, and gated by shared behavior rules for move/toggle/exclude. |
| Docs and runner cleanup            | The live REST/docs/browser-cleanup seams were aligned with the shipped route/runtime contract.                                  |

## 2026-04-06 Layout, Runtime, Fixture, And Docs Cluster

| Entry                                             | Durable outcome                                                                                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| General/Common and catalog layouts                | The General/Common page owns the single shell, catalog-specific layouts remain sparse overlays, and runtime behavior is layout-owned.         |
| Snapshot export/import consistency                | Full layout state, layout cache invalidation, and runtime materialization stayed aligned after QA remediation.                                |
| Fixture regeneration and browser-faithful imports | The self-hosted and quiz fixtures were repeatedly regenerated from real generator/browser flows and validated against import/runtime proof.   |
| Dialog/docs/tutorial closure                      | Dialog settings, GitBook documentation, screenshot generation, and publication/runtime/browser authoring docs were brought into EN/RU parity. |

## 2026-04-05 Scripting And Quiz Delivery Cluster

| Entry                                    | Durable outcome                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Compiler/runtime safety                  | Embedded scripts are SDK-only, browser worker execution is restricted, server runtime is pooled, and public RPC boundaries fail closed.          |
| Design-time and runtime product delivery | Scripts tabs, quizWidget, runtime execution, fixture export/import, and browser-authored quiz flows all landed.                                  |
| Validation and compatibility             | `sdkApiVersion`, CSRF retry, default capability resets, and runtime script sync fail-closed behavior all became durable cross-package contracts. |

## 2026-04-04 Self-Hosted Parity Cluster

| Entry                                  | Durable outcome                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Fixture identity and codename fidelity | Repeated real-generator reruns normalized localized self-hosted naming, section sets, and codename behavior.                       |
| Import/export and publication UX       | Snapshot import/export, publication linkage, runtime inheritance, and browser-import fidelity were aligned with the live product.  |
| Documentation and status trail         | Plans, docs, and memory-bank wording now describe real navigation/page/guard functionality instead of synthetic fixture structure. |

## 2026-04-03 Snapshot, E2E Reset, And Turbo Hardening Cluster

| Entry                                | Durable outcome                                                                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot import/export hardening     | Direct metahub export/import, publication version export, `SnapshotRestoreService`, and browser verification all landed as a supported feature set. |
| Hosted Supabase full-reset hardening | Wrapper-managed E2E runs now start from and return to a project-empty state with doctor/reset tooling and strict finalize semantics.                |
| Turbo root contract                  | Turbo 2 root migration, cache correctness, and repeated-build cache hits became the documented repository build contract.                           |
| Domain-error cleanup                 | Typed domain errors, response-shape alignment, and test parity were completed across the touched backend/frontend wave.                             |

## 2026-04-02 To 2026-03-11 Condensed Archive

| Date                     | Theme                           | Durable outcome                                                                                                                                                          |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-04-02               | Playwright full-suite hardening | Route timing, determinism, restart-safe cleanup, diagnostics, locale/theme, and route-surface browser-testing waves closed with the full suite green.                    |
| 2026-04-01               | Supabase auth + E2E QA          | HS256/JWKS verification, RLS cleanup, E2E runner cleanup, and public-route/auth QA seams were stabilized.                                                                |
| 2026-03-31               | Breadcrumbs + security          | Breadcrumb/query restore behavior, JSONB/text selector drift, and the late-March dependency/security tail were closed.                                                   |
| 2026-03-30               | Metahubs/applications refactor  | Thin routes, controller/service/store decomposition, shared hooks, and shared mutation/error helpers became the working baseline.                                        |
| 2026-03-28 to 2026-03-24 | CSRF + codename convergence     | `csurf` replacement, vulnerability cleanup, and the codename JSONB/VLC single-field contract landed across schemas, routes, and frontend authoring.                      |
| 2026-03-19 to 2026-03-11 | Platform foundation             | Request/pool/DDL DB access tiers, fixed system-app convergence, runtime-sync ownership, managed naming helpers, and bootstrap/application workspace work were completed. |

## 2026-05-06 Generic Localized Variant Tabs For Page Content

| Area              | Resolution                                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared UI surface | Extracted `LocalizedVariantTabs` into `@universo/template-mui` so Page content language tabs are no longer a Page-local custom tab implementation.             |
| Visual parity     | Matched localized content tabs to the metahub MUI tab typography and compact 28px action/add button geometry used on neighboring Entity authoring screens.     |
| Primary marker    | Marked the primary content locale with the same 16px `Star` icon affordance used by display attributes.                                                       |
| Regression proof  | Extended the Chromium Basic Pages UX flow to assert primary-star rendering, action/add centerline alignment, and Page-vs-Catalog tab typography equality.      |
| Validation        | Focused template-mui Jest, block editor Jest, package lints/builds, root `pnpm build`, Chromium Basic Pages UX Playwright, and `git diff --check` passed.     |

## 2026-05-06 LMS Page Content Import And Editor.js UX Closure

| Area                          | Resolution                                                                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| LMS product page seed          | Removed the short preset Welcome page from the LMS output path and kept `LearnerHome` as the stable internal page codename with visible Welcome text. |
| Template seed contract         | Added `localizeCodenameFromName` so seed entities can opt out of codename localization when presentation names are intentionally localized.           |
| Canonical fixture              | Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the official Playwright generator with full EN/RU Welcome block content.          |
| Editor.js first render/toolbox | Fixed late-data initialization so content renders on first open and constrained the block toolbox to remain visible and scrollable.                    |
| Validation                     | Backend/template Jest, block editor Jest/Vitest, generator Playwright, Basic Pages UX Playwright, LMS import/runtime Playwright, full build, and diff checks passed. |

## 2026-05-02 LMS Portal Runtime Refactor Implementation

Implemented the first LMS portal cleanup pass.

| Area                     | Resolution                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LMS template and fixture | Removed global `moduleViewerWidget`, `statsViewerWidget`, and `qrCodeWidget` bindings. Fixture uses neutral Learning Portal seed names with recomputed snapshot hash.                                        |
| Runtime menu contract    | Extended `menuWidget` config with `maxPrimaryItems`, `overflowLabelKey`, `startPage`, `workspacePlacement`. Resolves hub/catalog ids/codenames, expands hub items, selects Modules catalog as start section. |
| Public workspace seeding | Superseded: workspace-enabled apps now start from owner/member `Main` workspaces only.                                                                                                                       |
| Validation               | Root `pnpm build` passed (`30/30` tasks). Chromium Playwright passed for LMS snapshot import/runtime flow.                                                                                                   |

## 2026-05-02 LMS Portal Runtime QA Remediation Closure

| Area                  | Resolution                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Start page resolution | Runtime row loading resolves `menuWidget.config.startPage` against materialized runtime catalog ids/codenames before fallback.           |
| Menu contract         | LMS template no longer includes inert top-level link items. `Knowledge`, `Development`, `Reports` point to real catalog-backed sections. |
| Workspace navigation  | Integrated and standalone runtime shells deduplicate workspace root menu entry.                                                          |
| Public workspace sync | Existing public shared workspaces get owner membership during sync.                                                                      |

## 2026-04-29 Runtime Workspace PR Review Hardening

| Area                    | Resolution                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace copy metadata | Workspace row copy excludes runtime system columns, resets metadata with fresh timestamps, version `1`, active delete flags, unlocked state. |
| Workspace API errors    | Runtime workspace endpoints return stable error `code` values. UI localization prefers codes before falling back to legacy message matching. |
| SPA navigation          | Runtime workspace navigation uses host-provided SPA navigation callbacks.                                                                    |

## 2026-04-29 Runtime Workspace I18n And Switcher Locale Closure

| Area                      | Resolution                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Workspace switcher locale | Sidebar workspace switcher reads VLC names with active `i18n.language` before fallback to primary locale. |
| Error localization        | Known runtime workspace backend errors mapped through EN/RU i18n keys.                                    |
| Validation                | `@universo/apps-template-mui` focused tests passed (`12/12`). Playwright wrapper passed (`2/2`).          |

## 2026-04-28 Runtime Workspace Name-Only Contract Closure

| Area             | Resolution                                                           |
| ---------------- | -------------------------------------------------------------------- |
| Backend schema   | `_app_workspaces` no longer creates separate machine-name column.    |
| Runtime API      | Workspace create/edit/copy accept only `name`.                       |
| Published app UI | Workspace dialogs no longer read/display machine name.               |
| Validation       | Backend Jest (`36/36`), Vitest (`10/10`), Playwright (`2/2`) passed. |

## 2026-04-28 Runtime Workspace Layout And CRUD QA Closure

| Area                   | Resolution                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Layout materialization | Workspace-enabled app sync materializes `workspaceSwitcher` widget in left layout zone. |
| Runtime menu UX        | Published app menu renders divider before Workspaces section.                           |
| Workspace CRUD         | Runtime workspaces support safe create/edit/copy/delete from card/table views.          |

## 2026-04-27 Mutable Application Visibility And Runtime Workspace Management

| Area          | Resolution                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Backend       | `isPublic` mutable through application update path. Runtime workspace/member endpoints support paginated/searchable responses. |
| Frontend      | Application settings expose saveable visibility switch. Published workspace management renders as full dashboard section.      |
| Browser proof | Full LMS workspace-management Playwright flow passed.                                                                          |

## 2026-04-22 Application Layout Management Parity Closure

| Area           | Resolution                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Shared list    | Both application and metahub layout lists render through `LayoutAuthoringList` in `@universo/template-mui`. |
| Metahub parity | Metahub list rows normalize localized names/descriptions. Embedded header behavior preserved.               |
| Browser-proof  | Playwright flow walks real metahub `Resources` route, captures screenshots, checks width parity.            |

## 2026-04-21 LMS Guest Runtime Localization And QA Closure

| Area                | Resolution                                                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend/runtime    | EN/RU locale resources include missing guest completion keys. `GuestApp` resolves guest runtime locale from URL query first, then persisted `i18nextLng`. |
| Regression coverage | `GuestApp.test.tsx` proves RU completion path end-to-end.                                                                                                 |

## Older 2025-07 To 2026-02 Summary

-   Alpha-era platform work established the current APP architecture, template-first publication model, schema-ddl runtime engine, VLC/i18n convergence, application modules, publications, and the three-level system-fields model.
-   Release milestones `0.21.0-alpha` through `0.52.0-alpha` in the table above remain the canonical high-level timeline for those earlier waves.
