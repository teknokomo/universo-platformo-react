# Progress Log
> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

---
## ⚠️ IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**
| Release | Date | Codename | Highlights |
| ------------ | ---------- | -------------- | ------------------------------ |
| 0.60.0-alpha | 2026-04-24 | 0.60.0 Alpha — 2026-04-24 (Clear Vision) 👓 | Steering files refactoring, documentation alignment with current architecture |
| 0.58.0-alpha | 2026-04-08 | 0.58.0 Alpha — 2026-04-08 (Ancient Manuscripts) 📜 | Metahub snapshot import/export, self-hosted parity, scripting, shared/common layout flow |
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

## 2026-05-03 LMS PR Hygiene Closure

Closed the small QA hygiene findings before preparing the LMS MVP PR.

| Area | Resolution |
| --- | --- |
| Legacy LMS wording | Replaced stale `Orbital Navigation 101` test fixture titles with neutral `Learning Portal Basics` wording in application workspace tests. |
| UUID policy | Removed the guest runtime `crypto.randomUUID()` fallback. Guest runtime IDs now require `public.uuid_generate_v7()` and fail closed if the database does not return an id. |
| Menu href safety | Added shared `sanitizeMenuHref` / `isSafeMenuHref` validation in `@universo/utils` and reused it in the published runtime menu plus metahub/application menu editors. Editors now reject protocol-relative and unsupported-scheme links consistently with runtime rendering. |
| Validation | Focused backend tests, menu href unit tests, apps-template MenuContent tests, affected package lints, targeted builds, root `pnpm build`, and `git diff --check` pass. `@universo/utils` lint still reports unrelated pre-existing warnings in older files. |

## 2026-05-02 LMS Documentation And Template Lint QA Closure

Closed the remaining QA cleanup after the LMS portal runtime implementation.

| Area | Resolution |
| --- | --- |
| GitBook docs | Replaced stale wording about removed LMS global widgets in the EN setup/overview pages; the GitBook EN/RU page-pair checker is green again. |
| Memory-bank context | Refreshed active LMS context so removed module/statistics/QR widget surfaces are not described as active runtime functionality. |
| Template lint hygiene | Reduced `@universo/apps-template-mui` ESLint output from 37 warnings to zero by tightening test/theme/demo-template typing, removing empty no-op bodies, removing demo `console.log` handlers, and wiring `TabularPartEditor.minRows` to delete protection. |
| Test hygiene | Removed noisy JSDOM-only MUI anchor warnings from workspace tests and mocked `react-i18next` in the MainGrid unit tests; the intentional browser-worker timeout diagnostic remains covered by its fail-closed test. |
| Validation | `node tools/docs/check-i18n-docs.mjs`, `pnpm --filter @universo/apps-template-mui lint`, `pnpm --filter @universo/apps-template-mui test` (87/87), and `git diff --check` all pass. |

## 2026-05-02 Phase 3 - Gate Demo Template Surfaces and Fix Right-Zone Defaults

Disabled demo template surfaces by default in apps-template-mui so published runtime applications don't show demo content unless explicitly enabled.

| Area | Resolution |
| --- | --- |
| `dashboardLayout.ts` defaults | Changed `showOverviewCards`, `showSessionsChart`, `showPageViewsChart`, `showRightSideMenu`, `showProductTree`, `showUsersByCountryChart` from `true` to `false`. These demo surfaces only render when a layout explicitly enables them, keeping backward compatibility for layouts that already opt in. |
| `widgetRenderer.tsx` userProfile | Replaced hardcoded "Riley Carter" / "riley@email.com" demo user with a generic "User" label and `PersonRoundedIcon` avatar without demo data. Removed the `OptionsMenu` import dependency from this widget. |
| `dashboardLayout.test.ts` | Updated assertion: `showRightSideMenu` default is now `false`. |
| `dashboardLayout.test.ts` (utils) | Updated assertion in `normalizeDashboardLayoutConfig` test: `showRightSideMenu` default is now `false`. |
| LMS template | Verified that `lms.template.ts` contains only `menuWidget`, `appNavbar`, `header`, `detailsTitle`, `detailsTable` -- no demo widgets. |
| Validation | `@universo/types` (32/32), `@universo/utils` (297/297), `@universo/apps-template-mui` (84/84) tests all pass. Metahubs layout tests (12/12) pass. Builds pass for types and apps-template-mui. |

## 2026-05-02 Fix Public Shared Workspace Selection Ambiguity

Made public shared workspace selection deterministic by adding a `codename` column and a `__public_shared` constant.

| Area | Resolution |
| --- | --- |
| `_app_workspaces` DDL | Added nullable `codename TEXT` column to the workspaces table with a unique active index. Existing tables receive the column via `ADD COLUMN IF NOT EXISTS`. |
| `ensurePublicSharedWorkspace` | SELECT now prefers workspaces with `codename = '__public_shared'` via deterministic ORDER BY, then falls back to any active shared workspace for backward compatibility. INSERT now includes the `__public_shared` codename. |
| `listActivePublicWorkspaceIds` | Updated ORDER BY to prefer the `__public_shared` workspace first, ensuring deterministic iteration in the guest controller. |
| Tests | Added 3 new tests: deterministic selection with codename, fallback without codename, and codename set on creation. Updated existing workspace creation test to assert `'__public_shared'` in the INSERT SQL. All 13 workspace tests pass. |

## 2026-05-02 LMS Portal Runtime Refactor Implementation

Implemented the first LMS portal cleanup pass from the May 2 plan.

| Area | Resolution |
| --- | --- |
| LMS template and fixture | Removed global `moduleViewerWidget`, `statsViewerWidget`, and `qrCodeWidget` bindings from the built-in LMS template and committed fixture. The fixture no longer exports the removed metahub-level widget scripts and now uses neutral Learning Portal seed names with a recomputed snapshot hash. |
| Runtime menu contract | Extended `menuWidget` config with `maxPrimaryItems`, `overflowLabelKey`, `startPage`, and `workspacePlacement`. Runtime menu materialization now resolves hub/catalog ids or codenames, expands hub items, moves extra entries into overflow, selects the Modules catalog as the start section, and injects the workspace entry according to placement. |
| Editors and schemas | Updated shared types, application layout schemas, metahub menu editor, application menu editor, and initial application widget config so new menu fields persist through authoring. |
| Columns container | Preserved nested widget `id`, `sortOrder`, and `config` in shared types, metahub/application editors, and the published app widget renderer instead of dropping nested config. |
| Public shared workspace seeding | Public workspace-enabled applications now create and seed a shared `Published` workspace during schema sync, so public runtime access links are usable immediately while personal workspaces stay excluded from public reads. |
| Published app template | Added overflow menu rendering with existing MUI list/menu primitives, i18n for `runtime.menu.more`, and kept the runtime shell on existing dashboard components rather than adding LMS-only UI. |
| Tests and docs | Updated the LMS fixture contract, generator, import/runtime flow assertions, `useCrudDashboard` Vitest coverage, template manifest Jest coverage, package READMEs, and GitBook LMS docs. |
| Validation | Focused builds passed for types, apps-template, applications-backend, metahubs-backend, applications-frontend, and metahubs-frontend. Focused Vitest/Jest/fixture-contract checks passed, including the workspace seeding service test. Package lints passed, with apps-template retaining only unrelated pre-existing warnings. Targeted Chromium Playwright passed for the full LMS snapshot import/runtime flow with EN/RU dashboard screenshots, public guest journeys, and runtime row-count verification. Root `pnpm build` passed across the workspace (`30/30` tasks). |

## 2026-05-02 LMS Portal Runtime QA Remediation Closure

Closed the follow-up QA findings from the LMS portal runtime refactor.

| Area | Resolution |
| --- | --- |
| Start page resolution | Runtime row loading now resolves `menuWidget.config.startPage` against materialized runtime catalog ids/codenames before falling back to the bound hub, so imported LMS apps open `Modules` deterministically. |
| Menu contract | The LMS template and committed fixture no longer include inert top-level link items. `Knowledge`, `Development`, and `Reports` point to real catalog-backed sections, and generic menu rendering disables link items that lack an `href`. |
| Workspace navigation | Integrated and standalone runtime shells deduplicate the workspace root menu entry when the runtime menu already provides it, preserving the route without showing two `Workspaces` items. |
| Public workspace sync | Existing public shared workspaces now get owner membership during sync, and schema sync avoids a redundant shared-workspace seed pass while preserving the later all-workspaces seed flow. |
| Docs and fixture contract | LMS setup docs and fixture validation were refreshed to describe the Learning Portal contract, removed stale Orbital/default-widget/script residue, and enforce the new working navigation shape. |
| Validation | Focused backend Jest, frontend/apps-template Vitest, metahubs-backend Jest, package builds, package lints, root `pnpm build`, `git diff --check`, and targeted Chromium Playwright for `snapshot-import-lms-runtime.spec.ts` passed. The final Playwright screenshots show the EN/RU `Modules` dashboard without legacy widgets or transient loading state. |

## 2026-04-29 Runtime Workspace PR Review Hardening

Closed the actionable review findings on PR #779.

| Area | Resolution |
| --- | --- |
| Workspace copy metadata | Workspace row copy now excludes runtime system columns from source data and resets metadata explicitly with fresh timestamps, version `1`, active delete flags, unlocked state, and the acting user id for creator/updater fields. |
| Workspace API errors | Runtime workspace endpoints now return stable error `code` values alongside messages. The isolated apps-template API preserves those codes on `RuntimeWorkspaceApiError`, and UI localization prefers codes before falling back to legacy message matching. |
| SPA navigation | Runtime workspace navigation now uses host-provided SPA navigation callbacks in the React Router host and stateful history navigation in standalone template mode, removing direct `window.location.assign` calls from workspace UI paths. |
| Validation | Focused backend Jest passed (`28/28`), focused apps-template Vitest passed (`14/14`), applications-backend lint/build passed, applications-frontend lint/build passed, apps-template lint/build passed with only unrelated pre-existing warnings, and `git diff --check` passed. |

## 2026-04-29 Runtime Workspace I18n And Switcher Locale Closure

Closed the final localization gaps in the published-application runtime workspace UI.

| Area | Resolution |
| --- | --- |
| Workspace switcher locale | The sidebar workspace switcher now reads VLC names with the active `i18n.language` before falling back to the primary/English locale, so Russian workspaces render as `Основное` instead of `Main`. |
| Error localization | Known runtime workspace backend errors are mapped through EN/RU i18n keys, including missing user, workspace access denial, owner-only mutation, disabled workspaces, missing member/workspace, and last-owner removal. |
| Error handling | The add-member dialog catches rejected submit promises and lets TanStack Query `onError` render the localized dialog alert instead of producing an unhandled rejection. |
| Test coverage | Focused apps-template Vitest now covers the Russian switcher selected value/options and Russian missing-user error rendering. |
| Validation | `@universo/apps-template-mui` focused tests passed (`12/12`), package build passed, package lint passed with only unrelated pre-existing warnings, canonical root `pnpm build` passed (`30/30` tasks), targeted Playwright wrapper passed for `lms-workspace-management.spec.ts --project chromium` (`2/2`) after the rebuild, and `git diff --check` passed. |

## 2026-04-28 Runtime Workspace Name-Only Contract Closure

Removed the runtime workspace machine-name field from the workspace domain contract.

| Area | Resolution |
| --- | --- |
| Backend schema | `_app_workspaces` no longer creates or indexes a separate machine-name column; workspace roles keep their role codenames because they are access-control constants. |
| Runtime API | Workspace create, edit, and copy endpoints now accept only `name`; list/detail responses expose UUID identity plus display metadata, status, default flag, and role. |
| Published app UI | Workspace create/edit/copy dialogs and the sidebar switcher no longer read, display, fill, normalize, or submit a workspace machine name. Fallback labels use the workspace UUID if no display name is available. |
| Tests and browser proof | Backend Jest, apps-template Vitest, and the LMS Playwright flow were updated to verify name-only workspace creation/copy/edit/delete and UUID-based lookup. |
| Validation | Focused backend Jest passed (`36/36`), focused apps-template Vitest passed (`10/10`), backend lint/build passed, apps-template lint/build passed with only unrelated pre-existing warnings, `git diff --check` passed, `pnpm run build:e2e` passed (`30/30`), and the targeted Chromium Playwright wrapper passed (`2/2`). |

## 2026-04-28 Runtime Workspace Layout And CRUD QA Closure

Closed the QA findings around workspace-enabled published application layouts and workspace CRUD.

| Area | Resolution |
| --- | --- |
| Layout materialization | Workspace-enabled application sync now materializes a real `workspaceSwitcher` widget plus divider in the left layout zone before the runtime menu, so the widget is visible and manageable in layout authoring instead of being runtime-only. |
| Runtime menu UX | The published app menu renders a divider before the Workspaces section, and the switcher keeps the existing MUI template pattern with the manage action inside the dropdown. |
| Workspace CRUD | Runtime workspaces now support safe create, edit, copy, and delete actions from card and table views. Copy creates new UUID v7 rows, remaps copied workspace-scoped UUID references, and deletion blocks personal workspace removal while archiving workspace-scoped business rows. |
| Access safety | Workspace member access keeps owner-only mutations, hides member-add/remove controls for non-owners, and still prevents removal of the last owner. |
| Localization | Runtime workspace validation and add-member messages now map backend failures through EN/RU i18n, and dialog actions use the standard spacing. |
| Test coverage | Backend service/controller tests cover update/copy/delete and layout widget materialization. `apps-template-mui` Vitest covers normalized create plus edit/copy/delete actions. The LMS Playwright flow covers create, copy, edit, delete, member add, member permissions, workspace switching, screenshots, and personal/shared runtime-row isolation. |
| Validation | `@universo/applications-backend` tests/lint/build passed, `@universo/apps-template-mui` tests/lint/build passed with only pre-existing unrelated warnings, `pnpm run build:e2e` passed, `git diff --check` passed, and the targeted Playwright wrapper for `lms-workspace-management.spec.ts --project chromium` passed (`2/2`) on a clean database. |

## 2026-04-28 Runtime Workspace Direct Route QA Closure

Closed the remaining QA findings for runtime workspace detail routes and screenshot-backed browser validation.

| Area | Resolution |
| --- | --- |
| Direct workspace route | Added a user-scoped `GET /applications/:applicationId/runtime/workspaces/:workspaceId` endpoint so route workspace pages can load their target workspace directly. The SQL service returns only active workspaces where the current runtime user has an active membership. |
| Published app UI | `RuntimeWorkspacesPage` now resolves `/workspaces/:workspaceId` and `/workspaces/:workspaceId/access` through a detail query, with the paginated list as a fallback, so direct links no longer depend on the first workspace page or current search state. |
| Test coverage | Backend service/controller tests cover accessible and inaccessible direct workspace lookups. The apps-template workspace test covers a detail route whose workspace is absent from the current list page. |
| Browser proof | The LMS workspace Playwright flow now waits for rendered Russian workspace cards before screenshot capture, and the targeted Chromium run passed on a clean database (`2/2`). |
| Validation | Focused backend Jest passed (`27` tests), focused apps-template Vitest passed (`7` tests), `@universo/applications-backend` lint/build passed, and `@universo/apps-template-mui` lint/build passed with only pre-existing unrelated warnings. |

## 2026-04-28 Runtime Workspace UI QA Remediation Closure

Closed the remaining QA findings for the published application workspace-management route.

| Area | Resolution |
| --- | --- |
| Workspaces route layout | `/a/:applicationId/workspaces` now reuses the normal runtime application adapter/menu data while overriding the dashboard layout to hide demo overview title, stat cards, demo charts, details table, and footer. The workspace management section is the primary content. |
| Runtime navigation | The Workspaces route keeps the published application menu entries visible and appends the selected Workspaces link instead of replacing the menu with a one-item shell. |
| Demo sidebar cleanup | The fallback dashboard side menu and mobile side menu no longer render demo `Sitemark`, `Riley Carter`, logout, notifications, or discount-card content when no widget-driven side menu is configured. |
| CRUD shell isolation | Workspace management routes no longer mount the generic runtime CRUD dialogs or row-actions menu outside the workspace page. |
| Browser proof | The LMS workspace-management Playwright flow now asserts absence of demo overview/sidebar content, validates the real runtime menu, exercises card/list mode, workspace search, pagination controls, owner/member UI permissions, screenshots, and personal/shared runtime-row isolation. |
| Validation | Focused frontend/apps-template Vitest passed (`15` + `9` tests), touched-file ESLint passed, `applications-frontend`, `apps-template-mui`, and root `pnpm build` passed (`30/30` tasks), `git diff --check` passed, and the targeted Playwright wrapper for `lms-workspace-management.spec.ts --project chromium` passed (`2/2`) after the root rebuild. |

## 2026-04-27 Runtime Workspace QA Remediation Closure

Closed the post-QA implementation gaps for runtime workspace management after the mutable visibility and published-app workspace management pass.

| Area | Resolution |
| --- | --- |
| Route hardening | Runtime workspace member/list/default routes now validate `workspaceId` and `userId` as UUIDs before schema resolution or service execution, keeping malformed path parameters fail-closed. |
| Workspace identity | Shared workspace creation is now name-only; the runtime UUID is the only workspace identity used by API, UI, and browser coverage. |
| UI error handling | The published-app member removal dialog now surfaces backend failures, including protected last-owner removal, and clears the error state only on success/cancel/new action. |
| Test coverage | Backend controller tests now cover malformed route IDs and invalid workspace create payloads. The isolated `apps-template-mui` page test now covers removal-error rendering in the confirmation dialog. |
| Browser proof | The LMS workspace-management Playwright flow now performs real negative UI actions for invalid workspace creation, blocked last-owner removal, and missing-user invite before completing the successful shared-workspace/member/runtime-row isolation flow. |
| Validation | Focused backend Jest passed (`92` tests), focused apps-template Vitest passed (`3` tests), touched-file ESLint passed, targeted backend/apps-template builds passed, `pnpm run build:e2e` passed (`30/30` tasks), and the targeted Playwright wrapper for `lms-workspace-management.spec.ts` passed (`2/2`). |

## 2026-04-27 Mutable Application Visibility And Runtime Workspace Management

Closed the implementation pass for mutable application visibility and first-class runtime workspace management in published applications.

| Area | Resolution |
| --- | --- |
| Mutable visibility | Application owners can now change public/closed visibility after creation through the existing settings page, while workspace mode remains a structural read-only setting. |
| Backend workspace API | Runtime workspace listing and member listing now support pagination/search and return profile fields; member invitation accepts email or user id and requires the target user to already be an active application member. |
| Published app UI | `@universo/apps-template-mui` now owns a full runtime workspace section in the dashboard shell with card/list views, pagination, search, create, default-workspace selection, invite, and remove flows using isolated template APIs and existing shared primitives. |
| Runtime navigation | The core runtime route and standalone dashboard append a Workspaces menu item for workspace-enabled apps and render `RuntimeWorkspacesPage` in the existing details content slot instead of reusing the old dialog. The workspace route now bypasses the normal CRUD runtime adapter so it can render even when an application has no linked data sections, and normal runtime routes honor the URL `linkedCollectionId` query parameter for deterministic catalog selection. |
| QA remediation | Default-workspace switching and member removal now run through transaction-scoped checks with `RETURNING` confirmation, workspace create/edit/copy mutations are name-only, ambiguous SQL was removed from member invitation, member-list ordering casts UUIDs safely, and the invite dialog uses the accessible existing MUI `TextField select` pattern. |
| Workspace switcher UX | The published-app workspace switcher now shows workspace type chips so the built-in shared `Main` workspace and each user's personal `Main` workspace are distinguishable, while tests and browser flows select workspaces by UUID rather than non-unique display names. |
| Documentation | Package READMEs and EN/RU GitBook application/workspace pages now describe mutable visibility, structural workspace mode, email invitation, and the published-app workspace management section. |
| Validation | Focused backend Jest, frontend Vitest, touched-file ESLint, `git diff --check`, and builds for applications-backend, applications-frontend, apps-template-mui, and core-frontend passed. Full apps-template lint still has unrelated pre-existing Prettier errors outside this slice. The full LMS workspace-management Playwright flow passed (`2/2`), including screenshots, shared workspace creation, member invite, runtime row creation in `Modules`, owner/member switching, and personal/shared isolation assertions. |

## 2026-04-27 GitBook Documentation Final QA Remediation

Closed the final QA findings from the GitBook refresh implementation.

| Area | Resolution |
| --- | --- |
| Roadmap wording | Removed the remaining planned-layer wording from `docs/README.md`; public documentation now keeps to current behavior and operational boundaries. |
| Screenshot coverage | Increased screenshot-backed coverage from 20 to 33 pages per locale by placing stable Playwright-generated current UI images on LMS, workspace, publishing, UPDL, builder, analytics, simulation, and platform overview pages. |
| Validation gate | Expanded `requiredScreenshotPages` so the additional workflow/platform pages cannot silently lose all screenshots. |
| RU cleanup | Translated remaining avoidable English headings and prose in touched RU navigation, API, platform, and guide pages while keeping code/API identifiers intact. |
| Plan alignment | Updated the refresh plan to include the admin generator and removed the unstable LMS docs-generator line after current LMS E2E helpers proved tied to obsolete catalog-kind lookup. |
| Final inventory | Each locale now has 23 PNG GitBook assets, 60 Markdown image references, 33 pages with screenshots, and no unreferenced PNG assets. |
| Validation | `pnpm docs:i18n:check`, `I18N_SCOPE=all pnpm docs:i18n:check`, `pnpm run build:e2e`, stale-term scans, asset inventory, and `git diff --check` passed. |

## 2026-04-27 GitBook Documentation QA Findings Closure

Closed the follow-up QA findings about remaining roadmap-like wording, screenshot coverage interpretation, and stale plan status.

| Area | Resolution |
| --- | --- |
| Roadmap wording | Removed the remaining roadmap-like phrasing from `platform/spaces.md`, UPDL guide wording, and mirrored RU pages so public docs describe current implementation boundaries only. |
| Screenshot coverage | Added current Playwright-generated screenshots to spaces, UPDL node-family pages, and metahub scripting/shared-behavior reference pages where images add useful product context. |
| Screenshot policy | `tools/docs/check-i18n-docs.mjs` now enforces screenshots on every non-exempt product/workflow page and keeps API, architecture, contributing, setup, and index pages explicitly exempt. |
| Plan alignment | Updated the GitBook refresh plan to record closure status, resolved decisions, and current inventory instead of stale pre-implementation findings. |
| Final inventory | Each locale now has 23 PNG GitBook assets, 72 Markdown image references, 45 pages with screenshots, and no unreferenced PNG assets. |
| Validation | `pnpm docs:i18n:check`, `I18N_SCOPE=all pnpm docs:i18n:check`, combined Playwright documentation generator grep, `pnpm run build:e2e`, stale scans, asset inventory, and `git diff --check` passed. |

## 2026-04-27 GitBook Documentation Screenshot Coverage Completion

Closed the remaining screenshot coverage debt from the GitBook documentation refresh without forcing non-informative images into API/reference pages.

| Area | Resolution |
| --- | --- |
| Coverage policy | Defined a required screenshot set for workflow, operator, and product-surface pages while keeping reference-only pages text/table focused. |
| Platform screenshots | Extended the quiz tutorial generator to capture current publications, publication versions, publication applications, application list, and application connector pages for both EN and RU. |
| Admin screenshots | Added a dedicated Playwright generator for admin roles and admin settings screenshots in both locale roots. |
| Documentation placement | Added mirrored EN/RU screenshots to quick start, admin, applications, publications, app-template views, and metahub scripting pages, with Russian prose cleaned up around the inserted images. |
| Regression gate | Added required-page screenshot checks to `tools/docs/check-i18n-docs.mjs` so selected workflow pages cannot silently lose all images. |
| Final inventory | Each locale now has 23 PNG GitBook assets, 38 Markdown image references, 20 pages with screenshots, and no unreferenced PNG assets. |
| Validation | `pnpm run build:e2e`, admin and quiz Playwright generator greps, `pnpm docs:i18n:check`, `I18N_SCOPE=all pnpm docs:i18n:check`, stale-term scans, asset inventory, and `git diff --check` passed. |

## 2026-04-27 GitBook Documentation Refresh QA Closure

Closed the QA findings from the GitBook documentation refresh and validated the screenshot/documentation pipeline against the current UI.

| Area | Resolution |
| --- | --- |
| Roadmap checks | Removed the temporary roadmap/plans banned-term rules from `tools/docs/check-i18n-docs.mjs` while preserving stale legacy/product terminology checks. |
| Screenshot coverage | Referenced all current generated GitBook PNG assets from EN/RU pages where screenshots explain actual workflows; intentionally left API/reference-only pages image-free to avoid filler. |
| Asset validation | Added checker coverage so every committed GitBook PNG asset under a locale root must be referenced by at least one Markdown page. |
| Entity screenshots | Updated the entity documentation generator to capture the current create-entity dialog for EN/RU and to use stable current UI roles/labels. |
| Quiz screenshots | Updated the quiz tutorial generator to capture EN and RU screenshots separately instead of copying English images into RU docs, and hardened localized widget checks. |
| RU prose drift | Removed avoidable English prose fragments from the high-priority Russian GitBook pages and added drift-term coverage for the QA-found phrases. |
| Validation | `pnpm run build:e2e`, both Playwright generator greps, `pnpm docs:i18n:check`, `I18N_SCOPE=all pnpm docs:i18n:check`, stale-term scans, asset inventory, and `git diff --check` passed. |

## 2026-04-27 GitBook Documentation Refresh Implementation

Implemented the GitBook documentation refresh pass for the current entity-first metahub and application architecture.

| Area | Resolution |
| --- | --- |
| GitBook locale roots | Kept the existing externally configured locale-root setup with separate `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md`; no repo-local `.gitbook.yaml` was added. |
| Public navigation | Linked previously unlisted public pages in both EN and RU summaries and validated coverage for all public GitBook pages. |
| Current architecture content | Updated stale platform, architecture, guide, UPDL, metahub, application, and API pages to describe current entity-owned metahub surfaces, applications, publications, runtime, and builder boundaries. |
| Removed stale planning text | Removed old public roadmap/future/planned wording and legacy Flowise/catalog-compatible references from GitBook docs. |
| RU parity | Mirrored the EN structure in RU with matching line counts, heading/list/table/image structure, and translated stale English fragments where the Russian docs had drifted. |
| Screenshot assets | Removed unused stale `catalog-compatible` GitBook assets and orphaned visual snapshots from a removed spec while keeping the current documentation screenshot generators. |
| Validation tooling | Replaced the README-only i18n checker with GitBook-scoped validation for EN/RU pairs, front matter, local links/images, summary coverage, structural parity, and stale public-doc terms. |
| Validation | `pnpm docs:i18n:check` and `I18N_SCOPE=all pnpm docs:i18n:check` both passed for 78 EN/RU GitBook page pairs. |

## 2026-04-26 Entity Resource Surface Data-Driven Cleanup

Completed the entity-resource refactoring pass that removes runtime-only hardcoded Resources tab labels and synthetic standard entity type fallback behavior.

| Area | Resolution |
| --- | --- |
| Shared contracts | Added normalized resource surface capabilities, route/key validation, component compatibility checks, and localized title resolution in `@universo/types`. |
| Standard templates | Seeded standard Catalog/Set/Enumeration resource surface labels as VLC metadata on persisted entity type definitions. |
| Backend behavior | Removed synthetic missing standard entity type generation. Persisted standard rows can now receive guarded presentation/localized resource label updates while structural mutations fail closed. |
| Frontend behavior | Resources tabs now resolve labels from persisted entity resource surface metadata through a capability registry and the entity type editor reuses the existing localized inline field for label editing. |
| Publication path | Canonical publication hashes include entity type metadata, release bundles preserve resource labels, and executable schema payloads remain unchanged for label-only edits. |
| Documentation | Updated package READMEs and EN/RU GitBook architecture/guides for data-driven resource surfaces and standard kind guardrails. |
| Validation | Root `pnpm build` passed. Focused tests and package lint passed for the touched areas; DB-boundary audit still reports unrelated pre-existing violations. |

## 2026-04-26 Entity Resource Surface QA Remediation

Closed the follow-up QA findings for the entity-resource implementation.

| Area | Resolution |
| --- | --- |
| Validation hardening | Tightened resource surface VLC validation in shared contracts and backend route schemas so malformed localized titles fail before persistence. |
| Guardrail tests | Added negative service tests proving standard entity type component and UI-structure mutations fail closed while localized presentation/resource label edits remain allowed. |
| Conflict diagnostics | Added an i18n admin warning on the Resources page when persisted entity types define conflicting labels for one shared resource capability. |
| Browser proof | Added and passed a targeted Playwright flow that creates a fresh Basic metahub, verifies EN/RU resource labels, edits the standard Catalog resource label through persisted metadata, verifies the renamed EN/RU UI, and captures screenshots. |
| Validation | Focused type/backend/frontend tests passed, metahubs frontend lint/build passed, targeted Playwright wrapper passed against the e2e database, and root `pnpm build` passed. |

## 2026-04-26 Entity Resource Surface QA Remediation Hardening

Closed the remaining QA implementation gaps discovered after the initial remediation pass.

| Area | Resolution |
| --- | --- |
| Standard type publication | Backend standard-kind updates now reject publication state changes, and the frontend disables the dynamic-menu publication toggle for standard entity types. |
| Shared defaults | Resource surface default metadata now comes from `@universo/types`, removing the duplicate frontend default map. |
| Structural comparison | Standard entity type guardrails now compare canonical JSON with sorted object keys instead of insertion-order-sensitive `JSON.stringify`. |
| Copy safety | Entity type copy dialogs now skip occupied `kindKey` values and propose the next available `-copy-N` suffix. |
| Frontend payload safety | Standard entity type saves preserve protected `kindKey`, codename, components, config, UI structure, and publication state while allowing resource-surface labels to change. |
| Browser coverage | The Playwright flow now drives the real edit dialog, verifies locked structural controls, submits localized resource labels, verifies the renamed EN/RU Resources tabs, and captures screenshots. The final rerun passed against a fresh e2e database after the standard-type payload preservation fix. |
| Validation | Focused frontend tests passed with 15 tests, metahubs frontend lint/build passed, root `pnpm build` passed across 30 packages, and `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-entity-resources.spec.ts --project chromium` passed with 2 tests. |

## 2026-04-24 Steering Files Refactoring

Completed a comprehensive refactoring of `.kiro/steering/` files to align documentation with the current project architecture.

| Area | Resolution |
| --- | --- |
| product.md | Completely rewritten to describe Metahubs Platform instead of outdated UPDL/AR/VR focus. Added ECAE architecture description, key domains (Metahubs, Applications, Publications, Scripting, LMS), and current target use cases. |
| structure.md | Updated package list from 6 outdated packages to current 31 packages. Added package classification by roles (Core shell, Feature modules, Infrastructure, UI support, Scripting & Extensions, Documentation). Fixed directory structure diagram. |
| tech.md | Updated technology stack with current versions from pnpm-workspace.yaml. Added TanStack Query, Playwright, isolated-vm, UUID v7. Added DDL & Migrations system section. Updated Common Commands with migration commands. |
| recommendations.md | Expanded with Three-Tier DB Access Pattern, Knex Boundary Rule, SQL Safety Rule, Mutation Rule, Testing Rule. Added TanStack Query recommendation for frontend packages. Added Security section. |

- Validation note:
  - All 4 steering files have been completely rewritten.
  - Removed outdated UPDL/AR/VR focus, replaced with Metahubs Platform description.
  - Package list now matches current monorepo structure (31 packages).
  - Technology versions match pnpm-workspace.yaml catalog.
  - Recommendations now include critical patterns from techContext.md.

## 2026-04-22 Application Layout Management Shared List And Parity Closure

Closed the last UI-parity residue between metahub and application layout management by converging the list shell, restoring metahub embedded-header behavior through shared props, fixing the template package boundary, and proving parity on the real browser route.

| Area | Resolution |
| --- | --- |
| Shared list shell | Added `LayoutAuthoringList` to `@universo/template-mui` and moved both the application layout list and the metahub layout list onto that shared component instead of keeping duplicate card/list renderers. |
| Metahub list parity | Restored compact embedded-header behavior for metahub `Resources` lists through shared `adaptiveSearch`, `controlsAlign`, and `toolbarSx` passthrough props, while normalizing localized layout names/descriptions before rendering. |
| Package contract | Fixed the `@universo/template-mui` package export contract after the shared-list extraction so `@universo/core-frontend` can still resolve the package root in production builds. |
| Browser parity proof | Updated the Playwright parity flow to use the real metahub `Resources` route, capture application/metahub screenshots for list/detail surfaces, and compare widths on the shared authoring surface using relative tolerances instead of brittle outer-shell pixel deltas. |
| Validation | `pnpm --filter @universo/template-mui build` passed; focused metahub Vitest passed for `LayoutList.copyFlow.test.tsx`, `LayoutDetails.inheritedWidgets.test.tsx`, and `LayoutDetails.cacheInvalidation.test.tsx` (`12/12`); focused applications-frontend Vitest passed for `ApplicationLayouts.test.tsx` (`2/2`); `pnpm --filter @universo/metahubs-frontend build`, `pnpm --filter @universo/applications-frontend build`, and `pnpm --filter @universo/core-frontend build` passed; and the full Playwright wrapper `application-layout-management.spec.ts` passed (`3/3`). |

## 2026-04-22 Application Layout Management Shared Authoring Convergence

Removed the last duplicated layout-detail rendering layer between metahubs and applications by moving both detail screens onto the same extracted authoring surface, then revalidated the affected metahub and application flows.

| Area | Resolution |
| --- | --- |
| Shared authoring core | `LayoutAuthoringDetails` in `@universo/template-mui` is now the common five-zone widget authoring surface for both the metahub layout detail page and the application layout detail page, preserving the `layout-zone-*` and `layout-widget-*` selector contract. |
| Metahub convergence | `LayoutDetails.tsx` in `@universo/metahubs-frontend` now delegates zone rendering, add-widget affordances, widget-row controls, and drag handling to the shared authoring component instead of keeping a second bespoke local implementation. |
| Application editor path | The application layout screen now opens structured dialogs for the current authored widget types instead of using raw JSON as the default edit path, while keeping a narrow expert fallback for unsupported future widget configs. |
| Documentation | Updated the EN/RU GitBook application-layout guides and the `@universo/template-mui` README so the shared layout-authoring ownership model is documented explicitly instead of implied. |
| Validation | Focused `@universo/metahubs-frontend` eslint passed for `LayoutDetails.tsx`, focused metahub Vitest passed for `LayoutDetails.inheritedWidgets.test.tsx` and `LayoutDetails.cacheInvalidation.test.tsx` (`5/5`), `pnpm --filter @universo/metahubs-frontend build` passed, focused `@universo/applications-frontend` Vitest remained green (`2/2`), `pnpm --filter @universo/applications-frontend build` passed, and the full Playwright wrapper `application-layout-management.spec.ts` remained green (`3/3`). |

## 2026-04-22 Application Layout Management UI Parity Browser-Proof Closure

Closed the remaining browser-proof gap in the application-side layout parity rewrite so the shared application authoring surface now has stable real-browser evidence for widget moves and conflict-sync flows.

| Area | Resolution |
| --- | --- |
| Shared authoring surface | Added the shared `LayoutAuthoringDetails` move action menu path in `@universo/template-mui` so widget rows expose a visible, testable, and accessibility-friendly zone-move control without replacing the existing DnD model. |
| Application adapter | Wired the application layout detail page to the shared move-menu label/handlers and kept the existing layout lineage/sync-state behavior unchanged while preserving the `layout-zone-*` and `layout-widget-*` selector contract. |
| Build/runtime alignment | Rebuilt `@universo/template-mui`, `@universo/applications-frontend`, and `@universo/core-frontend` so the browser runner consumed the updated `ApplicationLayouts` chunk instead of stale frontend assets. |
| Browser verification | The focused Playwright reorder wrapper and the full `application-layout-management.spec.ts` suite now pass on the real built UI, proving both the widget reorder flow and the layout conflict-resolution flow after the parity rewrite changes. |
| Validation | Focused eslint passed for the touched shared/application files, focused `ApplicationLayouts.test.tsx` Vitest passed (`2/2`), `pnpm --filter @universo/template-mui build` passed, `pnpm --filter @universo/applications-frontend build` passed, `pnpm --filter @universo/core-frontend build` passed, the focused reorder wrapper passed (`2/2` including setup), and the full Playwright wrapper passed (`3/3`). |

## 2026-04-22 Application Layout Management Sidebar Closure

Closed the final shell-navigation defect for application-side layout management after live QA showed that the `Layouts` page existed but was unreachable from the actual application sidebar.

| Area | Resolution |
| --- | --- |
| Root cause | The live shell sidebar used `getApplicationMenuItems()` from `@universo/template-mui`, not the legacy `applications-frontend` menu declaration, and that canonical menu config omitted the `Layouts` item entirely. |
| Navigation fix | Added the missing `application-layouts` entry to the canonical application sidebar menu config so `/a/:applicationId/admin/layouts` is exposed in the real application shell. |
| Regression coverage | Added focused navigation assertions proving `Layouts` exists both in the generated application menu config and in the rendered sidebar when the application runtime schema exists. |
| Validation | Focused `@universo/template-mui` Jest passed for `menuConfigs.test.ts` and `MenuContent.test.tsx` (`13/13`), focused `@universo/applications-frontend` Vitest passed for `ApplicationLayouts.test.tsx` (`2/2`), and targeted `eslint` for the touched navigation files passed. |

## 2026-04-22 Application Layout Management Final Closure

Closed the remaining QA residue for application-side layout management and verified the full conflict-resolution/browser path end to end.

| Area | Resolution |
| --- | --- |
| Browser proof | `ConnectorDiffDialog` now exposes stable select ids and test hooks for the bulk/per-layout resolution controls, and the focused Playwright conflict-resolution scenario now passes reliably on the real browser path. |
| Read access policy | Application-layout reads remain fail-closed by default, but now honor explicit per-application `settings.applicationLayouts.readRoles` allowances for non-admin read roles without widening any mutation routes. |
| Shared widget validation | Application widget-config validation now uses shared schema-driven parsers in `@universo/types`, replacing the remaining backend-only hand-rolled validation branches and aligning persistence checks with runtime contracts. |
| Validation | Focused applications-backend Jest passed for `applicationLayoutsController.test.ts`, `applicationLayoutsStore.test.ts`, and `syncLayoutPersistence.test.ts`; focused applications-frontend Vitest passed for `ConnectorDiffDialog.test.tsx`, `ConnectorBoard.test.tsx`, and `ApplicationLayouts.test.tsx`; `pnpm --filter @universo/types build`, `pnpm --filter @universo/applications-frontend lint`, canonical root `pnpm build`, and the targeted Playwright wrapper `application-layout-management.spec.ts` all passed (`3/3`). |

## 2026-04-21 Application Layout Management QA Remediation

Closed the post-QA gaps in application-side layout management and validated the real browser path.

| Area | Resolution |
| --- | --- |
| Access control | The application layout widget catalog endpoint now uses the same fail-closed application ACL and runtime-schema guard as the rest of the layout API. |
| Widget ordering | Added and validated application-side widget move/reorder support with optimistic mutation flow and UI controls across all supported zones. |
| Conflict handling | Connector diff/sync now carries structured layout change data and explicit layout resolution policies instead of depending only on coarse marker strings. |
| Layout UI | The application admin layout detail screen now renders `top`, `left`, `center`, `right`, and `bottom` zones, with complete EN/RU i18n for the added zone/action text. |
| Validation | Focused backend Jest passed (`5/5`), focused applications-frontend Vitest passed (`9/9`), canonical root `pnpm build` passed (`30/30 successful`), and the targeted Playwright wrapper `application-layout-management.spec.ts` passed (`2/2`) with application layout list/detail screenshots and a real browser widget move. |

## 2026-04-21 Application Layout Management MVP

Implemented first-class application-side layout management for metahub-published and application-owned layouts.

| Area | Resolution |
| --- | --- |
| Shared contracts | Added application layout/source/sync/scope/widget contracts in `@universo/types` and kept hashing server-side in applications-backend to avoid leaking `node:crypto` into browser bundles. |
| Runtime schema | Extended `_app_layouts` and `_app_widgets` runtime DDL with source lineage, sync state, source/content hashes, source exclusion flags, and widget activity metadata without requiring a metahub template version bump. |
| Sync behavior | Connector schema sync now preserves application-owned layouts, excludes locally deleted metahub layouts, marks locally modified metahub layouts as conflicts instead of overwriting them, marks removed source layouts as source removed, and avoids replacing an application/local default with a source default in the same scope. |
| Connector update warning | The existing connector diff dialog now warns when layout changes are present and lets administrators choose the layout update policy: keep local application changes and mark conflicts, or explicitly overwrite local metahub-derived layouts with the metahub source. |
| Backend API | Added SQL-first application layout store/controller/routes with request-scoped executors, schema-qualified SQL, advisory locks for layout/widget mutations, optimistic version checks, default/last-active invariants, and local content hash refresh after widget changes. |
| Frontend UI | Added the application admin `Layouts` section, route, menu entry, TanStack Query keys, API client methods, EN/RU i18n, source/sync chips, create/copy/delete/default/active controls, and a minimal widget-zone editor using existing MUI/template components. |
| Runtime filtering | Application runtime now reads only active layouts and active widgets, so inactive application-side configuration stays editable but does not affect published runtime screens. |
| Documentation | Added GitBook guide pages for application layouts in EN/RU and linked them from both SUMMARY files. |
| Validation | Targeted builds passed for `@universo/types`, `@universo/utils`, `@universo/schema-ddl`, `@universo/applications-backend`, `@universo/applications-frontend`, and `@universo/core-frontend`; focused applications-backend Jest passed for layout materialization and layout hashing (`5/5`). |

## 2026-04-21 PR #771 Bot Review Triage

Completed a QA triage pass over the PR #771 bot comments, verified each recommendation against the live code and repository contracts, applied only the safe fixes, and rejected the false positives or risk-only suggestions.

| Area | Resolution |
| --- | --- |
| Runtime workspace error handling | `runtimeWorkspaceService.ts` now throws typed `RuntimeWorkspaceError` instances with stable codes for the verified controller-facing cases, and `runtimeWorkspaceController.ts` maps those codes to HTTP statuses instead of relying on brittle `message.includes(...)` checks. |
| Canonical build follow-up | The root build surfaced TypeScript `unknown` narrowing errors in the new controller catch blocks, so the controller now resolves response text through a shared `getRuntimeWorkspaceErrorMessage()` helper before returning JSON. |
| Public guest CSRF isolation | `GuestApp.tsx` now stores public CSRF tokens under an application-scoped storage key instead of a single shared session key, preventing cross-application token reuse on the same browser session. |
| Guest regression coverage | `GuestApp.test.tsx` now includes a regression that proves public CSRF tokens stay isolated per application id. |
| QR widget type contract | `QRCodeWidgetConfig.url` is now optional in shared types, aligning the contract with the already-shipped LMS template and QR widget runtime/tests that support `publicLinkSlug`-only configuration. |
| Rejected suggestions after QA review | Left `public.uuid_generate_v7()` unchanged because the repository defines it explicitly in the `public` schema as a platform contract; did not batch guest quiz inserts because the comment described an optimization rather than a proven bug; did not switch `GuestApp` to `useParams`-only lookup because the component must keep working in standalone/non-route-param contexts. |
| Validation | Focused `runtimeWorkspaceController.test.ts` passed (`8/8`), focused `GuestApp.test.tsx` passed (`9/9`), `pnpm --filter @universo/types build` passed, touched-file diagnostics were clean, and canonical root `pnpm build` passed (`30/30 successful`). |

## 2026-04-21 LMS Guest Runtime Localization And QA Closure

Closed the last LMS guest-language regression by completing the missing RU completion copy, hardening the guest runtime locale resolution against stale parent props, and revalidating the real public browser path on a freshly rebuilt bundle.

| Area | Resolution |
| --- | --- |
| Guest completion copy | Added the missing `guest.completeModule`, `guest.restartModule`, and `guest.moduleCompleted` locale keys to the EN/RU apps-template-mui resources so the final guest CTA/result state no longer falls back to English in RU flows. |
| Defensive runtime locale resolution | `GuestApp.tsx` now resolves the effective locale from the explicit public URL query first, then persisted `i18nextLng`, before using the incoming prop, which keeps public runtime requests aligned with `...?locale=ru` even if an upstream shell passes stale locale state. |
| Focused frontend regression coverage | `GuestApp.test.tsx` now covers the real RU completion path and explicitly proves that a public URL `?locale=ru` wins over a stale `locale='en'` prop for both access-link and runtime requests. |
| Real root cause | Playwright trace inspection showed the red browser run was still loading a stale pre-fix frontend bundle and therefore calling `/public/.../links/...?...locale=en` and `/runtime?...locale=en` even though source-level tests were already green. The fix became effective in the real browser path immediately after a fresh workspace rebuild. |
| Validation | Targeted `@universo/apps-template-mui` Vitest passed for `GuestApp.test.tsx` and `App.test.tsx` (`12/12`), canonical root `pnpm build` passed (`30/30 successful`), and the focused Playwright wrapper `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts` passed (`2/2`). |

## 2026-04-21 LMS Final Closure And Canonical Fixture Regeneration

Closed the last post-QA LMS residue by hardening guest-runtime credential transport, restoring shared-workspace-safe public access resolution on the controller path, removing external fixture media dependencies, and regenerating the canonical LMS snapshot through the official Playwright generator.

| Area | Resolution |
| --- | --- |
| Guest runtime transport hardening | `runtimeGuestController.ts` now accepts guest session credentials only from `X-Guest-Student-Id` and `X-Guest-Session-Token` headers, and `GuestApp.tsx` now sends those headers instead of leaking `studentId` and `sessionToken` through runtime query params. |
| Shared-workspace-safe public resolution | The public guest controller path now uses the shared-workspace-aware access-link resolver so runtime and guest-session reads stay pinned to the shared workspace instead of drifting through stale controller wiring. |
| Regression coverage | Backend coverage in `publicApplicationsRoutes.test.ts` now proves header-based guest runtime auth stays bound to the token workspace, and `GuestApp.test.tsx` now asserts runtime URLs remain free from guest credential query params. |
| Self-contained fixture assets | `lmsFixtureContract.ts` now embeds the LMS route-map imagery as inline SVG data URIs, removing the canonical fixture's dependency on external media URLs. |
| Official canonical regeneration | The official generator `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "canonical lms metahub and export snapshot fixture"` passed (`2/2`) and refreshed `tools/fixtures/metahubs-lms-app-snapshot.json` through the supported end-to-end export path. |
| Validation | Focused backend Jest passed for `publicApplicationsRoutes.test.ts` (`16/16`), focused frontend Vitest passed for `GuestApp.test.tsx` (`6/6`), touched-file diagnostics were clean, and the official generator completed green after a clean full-reset cycle. |

## 2026-04-21 LMS Snapshot Import Browser Proof Recovery Closure

Closed the last residual red in the LMS snapshot-import wrapper by removing the final authenticated runtime read's dependency on mutable default-workspace state and revalidating the exact browser flow on the built runtime path.

| Area | Resolution |
| --- | --- |
| Authenticated runtime workspace selection | `runtimeHelpers.ts` now accepts an explicit authenticated `workspaceId` query override, validates UUID format, checks membership against `allowedWorkspaceIds`, and then applies `app.current_workspace_id` from that deterministic workspace instead of always falling back to `defaultWorkspaceId`. |
| Focused regression coverage | `runtimeRowsController.test.ts` now covers the explicit-runtime-workspace selector, including allowed override, default fallback, and forbidden workspace rejection, while the earlier `applicationWorkspaces.test.ts` regression remains green for personal-default takeover. |
| E2E verification path | `waitForApplicationRuntimeRowCount` now forwards optional runtime query params, and `snapshot-import-lms-runtime.spec.ts` now polls the shared workspace directly for final Students, QuizResponses, and ModuleProgress counts instead of PATCHing default workspace state and hoping later reads observe it. |
| Validation | Focused backend Jest passed for `runtimeRowsController.test.ts` and `applicationWorkspaces.test.ts` (`14/14`), `@universo/applications-backend` was rebuilt, and the exact Playwright wrapper `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium` passed (`2/2`). |

## 2026-04-20 LMS Post-QA Security And ACL Remediation Closure

Closed the post-QA LMS follow-up slice by hardening workspace policy boundaries, owner-only workspace management, and standalone locale resolution, then revalidating the touched backend/frontend surfaces and the full workspace build.

| Area | Resolution |
| --- | --- |
| Public runtime workspace isolation | `publicRuntimeAccess.ts` now limits public workspace discovery to active shared workspaces only, and public-route regression coverage proves personal workspaces do not resolve public access links. |
| Personal workspace ACL hardening | `runtimeWorkspaceService.ts` and `runtimeWorkspaceController.ts` now fail closed for personal-workspace member-management operations, including explicit `403` handling for invite/remove flows and service-level guard coverage. |
| Workspace management UI | `WorkspaceManagerDialog.tsx` now hides invite/remove controls unless the selected workspace is shared and the current member is an owner; component coverage now includes the restricted-state path. |
| Standalone locale flow | `App.tsx` now resolves locale from document or browser language, synchronizes it through `i18n.changeLanguage`, and passes the resolved locale into guest/dashboard shells instead of hardcoding `ru`. |
| Validation | Targeted backend Jest passed for `publicApplicationsRoutes.test.ts`, `runtimeWorkspaceController.test.ts`, and `runtimeWorkspaceService.test.ts` (`27/27`); targeted `@universo/apps-template-mui` Vitest passed for `WorkspaceManagerDialog.test.tsx` and `App.test.tsx` (`4/4`); canonical root `pnpm build` completed successfully. |

## 2026-04-20 LMS Snapshot Import Runtime Remap Closure

Closed the last LMS snapshot-import browser blocker by fixing the remaining workspace-seeded runtime id drift in module child rows.

| Area | Resolution |
| --- | --- |
| Workspace seed remap | Extended `applicationWorkspaces.ts` so string-based child-table references such as `Modules.ContentItems[].QuizId` are remapped to workspace-scoped quiz row ids during personal-workspace seeding instead of keeping the original fixture seed id. |
| Seed ordering | Added string-dependency ordering so `Modules` wait for `Quizzes` when child rows depend on quiz ids, ensuring the workspace quiz row id exists before module child rows are cloned. |
| Regression coverage | Added a focused `applicationWorkspaces.test.ts` scenario that proves a seeded module content-item row stores the workspace-scoped quiz id rather than the stale source quiz id. |
| Browser proof | The focused Playwright scenario `lms snapshot fixture imports through the browser UI and is immediately usable after linked app creation` is now green end-to-end, including module load, quiz open, quiz submit, and completion flow after linked app creation. |
| Validation | Focused backend Jest passed for `applicationWorkspaces.test.ts` (`6/6`) and `publicApplicationsRoutes.test.ts` (`10/10`), `@universo/applications-backend` was rebuilt, and canonical root `pnpm build` passed (`30/30 successful`). |

## 2026-04-20 LMS Plan Completion And QA Debt Elimination Closure

Closed the last LMS blocker that remained after the QA pass and converted the final browser proof from partial to fully verified green.

| Area | Resolution |
| --- | --- |
| Guest persistence contract | Aligned `runtimeGuestController` with the canonical workspace-aware runtime write path so guest-created Students, QuizResponses, and ModuleProgress rows now persist `workspace_id` explicitly instead of relying on a narrower direct-insert contract. |
| Guest LMS UX hardening | Preserved quiz results until explicit return to the module, gated module completion on successful progress persistence, and kept the new progress-save failure path visible to the guest UI instead of masking backend errors as success. |
| Validation drift cleanup | Removed stale WorkspaceSwitcher assertion drift and rebuilt the workspace before browser proof so Playwright exercised the fresh LMS guest bundle. |
| Browser proof | The focused LMS Playwright wrapper is now green end-to-end: provisioning setup plus `lms-class-module-quiz` and `lms-qr-code`, with the class flow now proving ModuleProgress persistence as well as quiz score visibility and completion UX. |
| Validation | Focused backend public-route Jest passed (`10/10`), canonical root `pnpm build` passed (`30/30 successful`), and the focused LMS Playwright wrapper passed (`3/3`). |

## 2026-04-20 LMS MVP QA Remediation Finish

Closed the remaining LMS MVP QA items that had been left open after the previous remediation pass, with the focus on transaction safety, public guest-runtime hardening, widget-runtime cleanup, and explicit completion/test coverage.

| Area | Resolution |
| --- | --- |
| Workspace mutation integrity | `createSharedWorkspace` and `addWorkspaceMember` now execute multi-step writes inside transactions, eliminating partial workspace/member state when downstream role or membership writes fail. |
| Guest session expiry | Guest sessions now store a server-side JSON envelope (`secret`, `expiresAt`) in the existing students token column, validate expiry from persisted state, and use UUID v7 for guest-created rows without forcing a schema-version bump. |
| Public script delivery | Public client bundle responses now set `Content-Type: application/javascript`, `X-Content-Type-Options: nosniff`, a restrictive CSP, and explicit cache headers. |
| LMS widget/runtime UX | `QRCodeWidget` now clears its timeout on unmount, `ModuleViewerWidget` and `StatsViewerWidget` share the runtime script/bundle hook, `GuestApp` shows a completion screen for the last module item, and embedded quiz references now pass concrete `quizId` context into `QuizWidget`. |
| Test coverage | Added workspace-controller happy-path coverage, `StatsViewerWidget` and `runtimeWidgetHelpers` tests, a guest completion test, a quiz-scoping test, and negative Playwright coverage for wrong slug / expired link / exhausted max-uses public LMS links. |
| Validation | Targeted backend Jest passed (`20/20`), targeted `@universo/apps-template-mui` Vitest passed (`17/17`), and canonical root `pnpm build` completed successfully. |

## 2026-04-18 Metahub Final QA Debt Elimination

Closed the last repository-level cleanup items that remained after the metahub entity/resources rollout had already shipped functionally green.

| Area | Resolution |
| --- | --- |
| REST/OpenAPI terminology | Updated the REST docs generator and regenerated `packages/universo-rest-docs/src/openapi/index.yml` so `Field Definitions`/`Fixed Values` are now consistently emitted as `Attributes`/`Constants`, including the generated operation tags and ids. |
| Shared repository wording | Aligned shared menu locale entries and remaining public metahub route comments with the shipped entity-first terminology, removing the last legacy labels from the touched repository surfaces. |
| Frontend lint debt | Added a package-scoped ESLint override for metahubs frontend test files only, eliminating the long-standing test-only warning noise while preserving the production lint contract. |
| Validation | `@universo/metahubs-frontend` lint passed, focused frontend vitest passed (`40/40`), focused backend tests passed (`79/79`), `@universo/rest-docs` OpenAPI generation passed, and canonical root `pnpm build` finished green (`30/30 successful`). |

## 2026-04-18 Metahub Resource Surfaces QA Follow-up Closure

Closed the residual QA findings from the entity-driven Resources rollout and brought the implementation to a fully verified state without widening the shipped surface area.

| Area | Resolution |
| --- | --- |
| Backend contract hardening | `EntityTypeService` and `TemplateManifestValidator` now reject duplicate `resourceSurfaces.routeSegment` values, so callers cannot bypass the frontend-only duplicate-route guard. |
| Shared Resources determinism | `SharedResourcesPage.tsx` now loads a larger sorted entity-type slice, resolves labels by stable capability rules, prefers the canonical built-in kind when present, and falls back to the canonical shared label when custom types disagree. |
| Permission regression proof | Route tests now explicitly cover `403` create/update/delete attempts for read-only metahub members on the entity-type CRUD surface. |
| Docs completion | `docs/ru/guides/custom-entity-types.md` was fully rewritten into consistent Russian so the documentation phase is no longer partially mixed-language. |
| Validation | Focused backend tests passed (`43/43`), focused frontend vitest passed (`36/36`), `@universo/metahubs-frontend` build passed, the targeted Playwright `empty` authoring flow passed, and root `pnpm build` passed (`30/30 successful`). |

## 2026-04-18 Metahub Resource Surfaces Final QA Closure

Removed the last residual debt after the QA follow-up so the entity-driven `Resources` rollout is closed in data flow, terminology, and browser proof coverage.

| Area | Resolution |
| --- | --- |
| Full entity-type pagination | Added `useAllEntityTypesQuery()` on top of `fetchAllPaginatedItems()` and moved shared `Resources` label resolution off the hard `limit=1000` lookup. The page now derives labels from the complete entity-type set. |
| Legacy tab wording | Updated EN/RU `general.tabs` locale keys so reusable shared-resource labels no longer expose the old `Field definitions / Fixed values / Option values` terminology. |
| RU resource docs | Rewrote the remaining RU metahub resource pages (`common-section`, `shared-field-definitions`, `shared-fixed-values`, `shared-option-values`, `shared-behavior-settings`, `exclusions`) into consistent Russian aligned with the current UI and architecture. |
| Browser ACL coverage | Extended the `catalog-style entity instances stay read-only for metahub members` Playwright flow so the same member also opens the real `Entities` workspace and still gets no create affordance or entity-type actions. |
| Validation | Focused frontend vitest passed (`36/36`), `@universo/metahubs-frontend` lint returned warnings only (`0 errors`), `@universo/metahubs-frontend` build passed, the `empty` authoring Playwright flow passed, the member ACL Playwright flow passed, and the shared `Resources` publication/runtime Playwright flow passed. |

## 2026-04-18 Metahub Resource Surfaces QA Closure

Completed the post-QA closure for entity-driven Resources, the `empty` metahub template path, and the remaining documentation drift.

| Area | Resolution |
| --- | --- |
| `resourceSurfaces` contract | `@universo/types`, backend validation, and the Entities builder now allow custom stable surface keys and route segments while still constraining surfaces to supported metadata capabilities. |
| Shared Resources safety | `SharedResourcesPage.tsx` now resolves visible shared tab labels by capability instead of by hardcoded built-in keys, so custom labels remain visible without opening unsupported shared tabs. |
| Builder preservation | Entity-type editing no longer collapses resource-surface metadata back to fixed built-in labels. The form keeps stable key, route segment, and title editable for each enabled compatible capability. |
| Backend validation | Added direct service, route, and template-manifest tests for valid custom surface metadata, duplicate constraints, and fail-closed rejection when the matching component is disabled. |
| Browser coverage | Added Playwright coverage for creating a metahub from the built-in `empty` template and manually creating the first entity type through the real browser UI. |
| GitBook docs | Rewrote the remaining priority EN/RU pages for entity-system architecture, browser E2E guidance, and REST API wording so they describe the shipped entity-first model and the `empty` template correctly. |
| Validation | Focused backend tests passed, focused frontend vitest passed, `pnpm --filter @universo/metahubs-frontend build` passed, root `pnpm build` passed, and the targeted Playwright `empty` authoring flow passed. |

## 2026-04-18 PR #767 Bot Review Triage

Reviewed the bot feedback on PR #767 and applied only the fix that was supported by the current code and safe to merge.

| Area | Resolution |
| --- | --- |
| `PublicationList.tsx` type safety | Replaced the unsafe `baseContext` cast used to access `t` inside the publication confirm helper with typed `PublicationMenuBaseContext` and `PublicationConfirmSpec` contracts. Behavior is unchanged; only the context contract is safer and explicit. |
| `SharedResourcesPage.tsx` fallback-tab suggestion | Not applied after QA review. The component already renders through the derived `effectiveTab`, and no confirmed consumer relies on the hidden stale `activeTab`. Adding an effect only to mirror fallback state would introduce extra synchronization logic without a proven bug. |
| Validation | Root `pnpm build` passed successfully after the PublicationList follow-up fix. |

## 2026-04-18 Metahub Terminology And QA Closure Completion

Closed the last user-facing terminology drift left after the resource-surface rollout so shared `Resources`, entity-owned catalog metadata, browser specs, and generated GitBook screenshots all use the same `Attributes / Constants / Values` language.

| Area | Resolution |
| --- | --- |
| Entity-owned metadata copy | Renamed catalog metadata headings, dialogs, delete warnings, and empty-state messages from legacy `Field Definitions` wording to `Attributes` in EN/RU metahub locales. |
| Delete blocking UX | Updated catalog/set/enumeration delete dialogs and backend blocking-reference error strings to refer to `attributes` instead of `field definitions`, keeping frontend and API wording aligned. |
| Documentation generators | Updated `docs-entity-screenshots.spec.ts` so the generated GitBook screenshots now capture the final `Attributes` terminology on both EN and RU routes. |
| Browser regressions | Synced Playwright expectations in `metahub-entities-workspace`, `metahub-entity-dialog-regressions`, and `metahub-shared-common` with the shipped headings and dialog titles after the terminology cleanup. |
| Workspace build boundary | Re-ran the canonical root `pnpm build` so the core frontend bundle consumed the updated metahubs package before the final browser validation. |
| Validation | Frontend targeted Vitest `40/40`, backend targeted Jest `44/44`, `pnpm --filter @universo/metahubs-frontend build`, root `pnpm build`, docs generator, entity-dialog regression flow, member ACL flow, and shared publication/runtime flow all passed. |

## 2026-04-18 QA Closure — i18n, Resources, Lint, Documentation

Completed the final QA closure session addressing 5 issues: broken i18n keys, confusing Resources tab labels, fixture hash mismatch, documentation drift, and lint debt.

| Area | Resolution |
| --- | --- |
| i18n records namespace | Added complete `records.*` section (~44 keys) to both EN and RU locale files. Fixed raw `records.title` key showing in Catalogs UI. |
| i18n tabs.treeEntities | Added `treeEntities` key to all 4 entity type tab sections (hubs, catalogs, sets, enumerations) in both locales. |
| RU locale translations | Translated ~25 untranslated English strings across deleteDialog sections (hubs, catalogs, sets, enumerations, fixedValues, entities.instances). Fixed mixed pluralization (`constantsCount_*` → `fixedValuesCount_*`). Aligned EN/RU asymmetry. |
| Resources tab labels | Renamed RU labels: "Поля" → "Определения полей", "Списки значений" → "Значения перечислений". |
| Dynamic Resources tabs | `SharedResourcesPage.tsx` now derives tab visibility from entity type `ComponentManifest` fields. Shared pool tabs appear only when at least one entity type has the corresponding component enabled. Added new test for dynamic tab hiding. |
| Lint debt — production files | Fixed all 19 production-file lint warnings: 9 `react-hooks/exhaustive-deps` (real potential bugs), 8 `no-explicit-any`, 2 unused variables. Production files now have 0 warnings. |
| README documentation drift | Fixed both EN/RU README.md: `src/constants/` → `src/view-preferences/` in directory structure. |
| Memory-bank | Updated `systemPatterns.md` (dynamic shared resources tab pattern), `techContext.md` (shared resources architecture, i18n key structure, fixture contract). |
| Validation | `pnpm build` 30/30, backend tests 68/68 suites (583 passed), frontend tests 64/64 suites (253 passed), lint 0 errors. |

## 2026-04-17 Distributed Noodling Ullman Plan Continuation Closure

Finished the interrupted continuation session for the entity-first metahubs QA closure. The remaining work after Phases A/B was fixture regeneration, documentation screenshot generators, key full-cycle/import regressions, and final workspace validation.

| Area | Resolution |
| --- | --- |
| Workspace revalidation | Reconfirmed the continuation baseline with `pnpm build` and `pnpm --filter @universo/metahubs-backend test` (`68/68` suites). |
| Fixture regeneration | Regenerated both canonical fixtures through Playwright generators: `tools/fixtures/metahubs-self-hosted-app-snapshot.json` and `tools/fixtures/metahubs-quiz-app-snapshot.json`. |
| Documentation generators | Stabilized and reran `docs-entity-screenshots.spec.ts` and `docs-quiz-tutorial-screenshots.spec.ts`; both generator specs now pass and refreshed the GitBook screenshot assets. |
| Snapshot/import drift | Updated `snapshot-export-import.spec.ts` to read canonical shared snapshot keys (`sharedFieldDefinitions`, `sharedFixedValues`, `sharedOptionValues`) with compatibility fallbacks where needed. |
| Codename flow drift | Updated `codename-mode.spec.ts` to current entity-first headings and hardened metahub creation detection against current list payload timing/shape. |
| i18n/export drift | Synced `packages/metahubs-frontend/base/src/__tests__/exports.test.ts` with current consolidated entity-first translations (`Entity Types`, `treeEntities: Hubs`). |
| Full-cycle regression proof | Revalidated the core browser flows: `metahub-domain-entities.spec.ts`, `metahub-entity-full-lifecycle.spec.ts`, `metahub-settings.spec.ts`, `snapshot-export-import.spec.ts`, `snapshot-import-quiz-runtime.spec.ts`, and `codename-mode.spec.ts`. |
| Final status | The continuation session closed green for the targeted QA bundle; no schema/template version bump was required and no residual blocker remained in the validated path. |

## 2026-04-17 Entity Type Naming Refactoring — Complete ✅

Renamed all entity type display names from surface-key terminology to traditional names across the entire monorepo. Internal surface keys preserved unchanged; only preset definitions, display strings, i18n labels, and documentation updated.

**Key decision**: Keep internal surface keys (`tree_entity`, `linked_collection`, `value_group`, `option_list`) as-is. Only rename user-facing display names to traditional terminology (Hubs, Catalogs, Sets, Enumerations).

**Architecture confirmation**: Entity system is a fully generic constructor. Hubs, Catalogs, Sets, Enumerations are entity type presets defined in templates, not hardcoded types.

| Area | Resolution |
| --- | --- |
| Backend preset definitions | Renamed VLC names, descriptions, UI configs, component constants, and default instance constants from surface-key to traditional names. |
| i18n sections | Renamed JSON sections in both EN and RU `metahubs.json` files. |
| Frontend i18n key references | Updated 25+ source files referencing old i18n keys. |
| Sidebar menu | Restructured: dynamic entity types under Resources; "Entity Types" admin link moved after divider; added i18n keys for `entityTypes`. |
| Surface labels | Updated `ENTITY_SURFACE_LABELS` display strings in `@universo/types`. |
| Unit tests | Updated all test assertions and mocks across backend/frontend/template-mui. |
| Source code sweep | Comprehensive sweep of error messages, fallback strings, JSDoc comments across 30+ files. |
| Fixture generation script | Updated to use unified entity API endpoints. |
| Playwright E2E tests | Updated 11 test files with new terminology. |
| Documentation | Updated 14 files across `docs/en/` and `docs/ru/`. |
| Validation | Full workspace build (30 packages), lint, 934 tests passing. |
| Pending follow-ups | Playwright fixture regeneration was manual (needs server for full regen); documentation screenshots need updating when server is available. |

## 2026-04-17 QA Closure — Entity Copy Contract + Playwright Stability

Closed the remaining QA blockers from the latest review by fixing copy-contract drift, removing the last metahubs legacy folder seam, and rerunning targeted build/lint/test/e2e validation.

| Area | Resolution |
| --- | --- |
| Backend copy contract | `copyEntitySchema` now accepts entity-specific copy flags used by active dialogs (`copyAllRelations`, relation-specific flags, `copyFixedValues`, `copyOptionValues`) and tree parent override input (`parentTreeEntityId`). `applyDesignTimeCopyOverrides` now merges linked-collection, tree, value-group, and option-list copy option normalizers into one copy plan gate. |
| Tree copy parent linkage | `entityCrudHandlers.ts` now merges explicit `parentTreeEntityId` into copied entity config so copy flows can persist target parent assignment. |
| Frontend copy payload alignment | `trees.ts` copy API now maps `parentTreeEntityId` into `config`, matching create/update config transport. |
| Legacy folder seam removal | Renamed metahubs frontend folder `src/constants` → `src/view-preferences` and updated all consumers; metahubs backend/frontend directory audit now returns no `attributes/constants/elements/catalogs/sets/enumerations/hubs` folders. |
| Record dialog parity | Record create fallback changed to `Add Record`; related tests and e2e assertions were synchronized. |
| Validation | Backend focused suite `entityInstancesRoutes.test.ts` passed `40/40`; frontend focused suites passed (`EXIT:0`); metahubs frontend lint passed with `0` errors; canonical root `pnpm build` passed (`30/30`); Playwright wrapper run for `metahub-domain-entities.spec.ts` passed (`3 passed`) on the CLI flow without `pnpm dev`. |

## 2026-04-17 QA Hardening Closure — Public Route Guard + Neutral Contract Sync

Closed the QA findings from the latest review by hardening public linked-collection route filtering, aligning backend delete-policy assertions with neutral entity-first wording, and revalidating through focused tests plus workspace build.

| Area | Resolution |
| --- | --- |
| Public linked-collection route hardening | `publicMetahubsController` now rejects objects that are not linked-collection-compatible before returning list/get payloads, using both direct kind (`catalog`) and compatibility alias fallback checks. |
| Backend test contract sync | `entityInstancesRoutes.test.ts` delete-policy assertions now match the shipped neutral error contract (`tree entity`, `linked collection`, `option list`) instead of legacy catalog/hub/enumeration wording. |
| Public route regression proof | `publicMetahubsRoutes.test.ts` now includes negative coverage ensuring non-linked-collection kinds are excluded from list/get responses. |
| Validation | Focused backend suites passed (`3/3`, `63/63` tests), metahubs-backend lint rerun has `0` errors (warnings only), and canonical root `pnpm build` passed (`30/30 successful`). |
| Legacy-folder audit note | In metahubs source trees, no active legacy domain folders named `attributes`, `elements`, `values`, `catalogs`, `sets`, `enumerations`, or `hubs` remain; only a generic `src/constants` utility folder exists in metahubs-frontend. |

## 2026-04-17 Neutral Kind/Settings Contract Layer Closure

Completed the neutral kind/settings migration slice by introducing a compatibility-safe neutral helper layer in shared types and migrating active backend/frontend settings consumers to use it.

| Area | Resolution |
| --- | --- |
| Shared neutral helper layer | `@universo/types` now exposes neutral entity-surface/settings helpers (`EntitySurfaceKey`, `EntitySettingsScope`, surface-kind resolvers, setting-key builder) while preserving legacy-compatible builtin/storage values. |
| Backend migration | Metahubs backend kind/settings consumers now resolve through neutral helper mapping instead of direct hub/catalog/set/enumeration literals where safe. |
| Frontend migration | Metahubs settings/permissions flows now consume neutral scope helpers and helper-built setting keys; compatibility aliases remain where required by existing contracts. |
| Validation | Targeted builds passed for `@universo/types`, `@universo/metahubs-backend`, `@universo/metahubs-frontend`; canonical root `pnpm build` passed with `30/30 successful` and exit code `0`. |
| Environment note | Repeated terminal `waiting for input` notifications during root build were false positives; build did not require interactive input. |

## 2026-04-17 QA Remediation Final Closure — Playwright CLI Generator Completed

Closed the last open implementation item from the QA-remediation session by finishing the authoritative Playwright CLI generator run for the self-hosted app fixture and snapshot export flow, then syncing the session ledger.

| Area | Resolution |
| --- | --- |
| Fixture regeneration | `tools/testing/e2e/specs/generators/metahubs-self-hosted-app-export.spec.ts` completed successfully through the wrapper-based Playwright CLI flow on port `3100`; terminal finished with `2 passed (5.0m)`. |
| Snapshot artifact | Regenerated fixture at `tools/fixtures/metahubs-self-hosted-app-snapshot.json` (`141.0 KB`) and refreshed generator screenshots under `test-results/self-hosted-app/`. |
| Reset contract | Hosted E2E finalize cleanup completed successfully after the run (`dropped 7 schema(s), deleted 2 auth user(s)`), confirming the destructive reset contract remained intact. |
| Session closeout | `tasks.md` now marks the pending generator phase and final status-file sync as complete; `activeContext.md` already reflects the wrapper-based E2E requirement and validated outcomes. |

## 2026-04-17 QA Remediation Completion Session — Generator + Snapshot Flow Closure

Closed the pending QA remediation blockers for the self-hosted generator and snapshot export/import flow by aligning E2E contracts with the current entity-first snapshot/runtime surface, then re-running focused Playwright suites and the canonical root build.

| Area | Resolution |
| --- | --- |
| Self-hosted fixture contract | `tools/testing/e2e/support/selfHostedAppFixtureContract.mjs` now validates entity-first component keys (`records`, `treeAssignment`, `fixedValues`, `optionValues`), neutral name keys, and compatible snapshot/layout references (`sharedFixedValues` fallback, `linkedCollectionId` fallback). |
| Snapshot flow assertions | `tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts` now uses neutral snapshot keys and linked-collection layout checks; stale heading expectation was corrected to the shipped UI label `Linked collections`. |
| Focused Playwright proof | Generator run passed (`2 passed`); snapshot export/import flow passed (`5 passed`). |
| Legacy folder audit | Verified no active `attributes`, `constants`, `elements`, or `values` domain folders remain in metahubs backend/frontend source trees. |
| Final validation | Canonical root `pnpm build` completed green (`30/30 successful`). |

## 2026-04-17 i18n Remediation Closure — fieldDefinitions migration

Completed the pending i18n cleanup and validation slice by aligning translation surfaces, tests, and build quality gates after legacy key removal.

| Area | Resolution |
| --- | --- |
| i18n JSON normalization | EN/RU metahubs locales now expose `fieldDefinitions` instead of legacy `attributes`, removed top-level legacy `documents`/`elements`, and cleaned dead nested legacy tabs/sections (`hubs`, `catalogs`, `sets`, `enumerations`, `attributes`) where they were no longer consumed by code. |
| i18n tests | Consolidation test updated to assert `fieldDefinitions` translations instead of removed `documents` namespace. |
| Frontend export tests | Fixed stale expectation in `exports.test.ts` to match new `valueGroups.tabs` surface (removed legacy `hubs` entry). |
| Validation | `@universo/metahubs-frontend` test suite is green (`64/64` files, `252/252` tests), lint passes with `0` errors (warnings only), and canonical root `pnpm build` passes (`30/30 successful`). |

## 2026-04-20 Full Legacy Vocabulary Elimination — entityComponents + builtinKind + snapshot hash

Completed Phases 1–5 and 7 of the full legacy vocabulary elimination plan (tasks.md). Renamed all remaining legacy property names in entity component types, snapshot serialization, and utility snapshot hashing.

| Phase | Resolution |
| --- | --- |
| 1: catalogRuntimeConfig → linkedCollectionRuntimeConfig | File rename + 9 consumer files updated (layouts, snapshot, frontend, tests). |
| 2: entityComponents property neutralization | `predefinedElements` → `records`, `hubAssignment` → `treeAssignment`, `enumerationValues` → `optionValues`, `constants` → `fixedValues` across ~223 refs in universo-types, metahubs-backend, metahubs-frontend. MetahubSnapshot interface, componentRegistry, SnapshotRestoreService, SnapshotSerializer, MetahubSchemaService, metahubMigrationMeta all updated. |
| 3: isDisplayAttribute | SKIPPED — DB column mapping, requires data migration. |
| 4: SCRIPT_ATTACHMENT_KINDS | SKIPPED — DB stored values, requires data migration. |
| 5: standardKind → builtinKind | File renames: `standardEntityKinds.ts` → `builtinEntityKinds.ts`, `standardKindBehaviorRegistry` → `builtinKindBehaviorRegistry`, `standardKindCapabilities` → `builtinKindCapabilities`. Types: `StandardEntityKinds` → `BuiltinEntityKinds`, `isStandardEntityKind` → `isBuiltinEntityKind`. |
| 7: Build + test validation | Build 30/30 ✅, metahubs-backend 68/68 (581 tests) ✅, metahubs-frontend 64/64 (252 tests) ✅, universo-utils 27/27 ✅. Fixed `publicationSnapshotHash.ts`: broken `constant.codename` ref after sed, input/output key migration (`constants` → `fixedValues` with backward compat). |

**Pending**: Phase 6 (localStorage key migration), Phase 8 (E2E via Playwright CLI).

## 2026-04-19 QA Remediation — Post-Refactoring Polish

Completed all actionable QA findings from Phase 13 audit. Fixed lint, stale docs, flaky tests, extracted copy-helper, created full-lifecycle E2E spec, fixed discovered entity preset build breakage.

| Phase | Resolution |
| --- | --- |
| 1: Lint fix | `npx eslint --ext .ts src/ --fix` in metahubs-backend: 0 errors (251 `@typescript-eslint/no-explicit-any` warnings remain). |
| 2: Stale docs | Deleted 6 legacy doc files (shared-attributes/constants/values EN+RU). Updated 8 cross-ref files (SUMMARY.md ×2, common-section.md ×2, exclusions.md ×2, shared-behavior-settings.md ×2). |
| 3: MetahubMembers stability | Added `{ timeout: 5000 }` to all `findByRole`/`waitFor` in invite-error branches + 15s test-level timeouts. Full suite: 252/252 pass under parallel load. |
| 4: Copy-helper extraction | Created `createEntityCopyCallback<TPayload>` factory in `useStandardEntityListState.ts`. Applied to TreeEntityList, LinkedCollectionList, ValueGroupList, OptionListList — eliminated 4 inline copy callbacks. |
| 5: Full-lifecycle E2E | Created `metahub-entity-full-lifecycle.spec.ts`: metahub → hub + catalog via browser → field definition via API → catalog copy via browser → publication → linked app → sync → runtime verification. |
| 5b: Entity preset fix | 5 preset files (`tree-entity`, `linked-collection`, `value-group`, `option-list`, `fixed-values-library`) + `index.ts` — updated from legacy export names (`HUB_*`, `CATALOG_*`, `SET_*`, `ENUMERATION_*`) to neutral names (`TREE_ENTITY_*`, `LINKED_COLLECTION_*`, `VALUE_GROUP_*`, `OPTION_LIST_*`). |
| 6: E2E execution | BLOCKED: migration drift on remote Supabase (`FinalizeAdminSchemaSupport1733400000001` checksum mismatch). Requires DB reset or migration reconciliation. |
| 7: Final validation | Build 30/30 ✅, metahubs-frontend 64/64 files 252/252 tests ✅, universo-utils 26/26 files 289/289 tests ✅. |

## 2026-04-17 Entity-First Final Refactoring — Phases 7-12

Completed the continuation of the 12-phase entity-first final refactoring plan, covering E2E helper neutralization, test alignment, documentation, and final validation.

| Phase | Resolution |
| --- | --- |
| 7: E2E API Helper Renames | 17 functions renamed in `api-session.mjs` + 16 consumer spec files. 0 legacy refs remaining in all E2E files. |
| 8: Test Alignment | Fixed 7 failing frontend test files (9 tests): exports.test.ts (i18n key), TreeDeleteDialog.test.tsx (button text), optimisticMutations.remaining.test.tsx (4 mock API names), queryKeys.test.ts (2 query key segments), MetahubList.test.tsx (codename auto-derive), RecordActions.test.ts (moveElement property), RecordList.settingsContinuity.test.tsx (dialog text). Final: 64/64 files, 252/252 tests pass. Backend: 68/68 suites, 581 tests pass. |
| 9: E2E Specs | Created `docs-entity-screenshots.spec.ts` generator for EN/RU documentation screenshots. Existing specs already cover lifecycle (`metahub-entities-workspace.spec.ts`, `metahub-domain-entities.spec.ts`), presets (`metahub-create-options-codename.spec.ts`, `metahub-standard-preset-runtime.spec.ts`), sidebar, and hierarchy. E2E execution pending server availability. |
| 11: Documentation | Created 8 new doc files (EN+RU): `entity-systems.md` architecture overview, `shared-field-definitions.md`, `shared-fixed-values.md`, `shared-option-values.md`. Updated SUMMARY.md for both locales. |
| 12: Final Validation (partial) | Zero-debt grep audit: all 9 checks pass (0 managed folders, 0 built-in markers, 0 V2 keys, 0 legacy i18n refs, 0 Compatibility files, 0 dispatchEntityRoute, 0 legacy domain folders, 0 document kind, 0 business wrappers). Build 30/30. |

**Pending** (require running server):
- Phase 10: Fixture regeneration (requires E2E with `pnpm dev`)
- Phase 9 execution: Running new E2E specs against live server

## 2026-04-17 Entity-First Final Refactoring Closure Follow-Up

Closed the next QA remediation slice for the entity-first refactoring by fixing the concrete regressions that were still reproducible locally, cleaning the remaining active terminology drift in touched preset/docs/spec surfaces, and revalidating the affected frontend/backend tests.

| Area | Resolution |
| --- | --- |
| Frontend test stability | Added explicit Testing Library cleanup in `tools/testing/frontend/setupTests.ts` so DOM state no longer leaks between tests; fixed the branch copy-options test mock to avoid the previous long `importActual` stall; created the `coverage/.tmp` directory from metahubs frontend test setup so isolated Vitest runs stop failing with `ENOENT coverage-0.json`. |
| Targeted frontend proof | `BranchActions.copyOptions.test.tsx` and `EntitiesWorkspace.test.tsx` now pass together (`10/10` tests). |
| Lint / Prettier closure | Eliminated all red eslint/prettier failures in `@universo/metahubs-frontend` and `@universo/metahubs-backend`; both package lint commands now exit green with warnings only. |
| Standard preset naming | Updated `standardEntityTypeDefinitions.ts` so built-in preset UI labels now resolve through entity-first keys: `metahubs:treeEntities.title`, `metahubs:linkedCollections.title`, `metahubs:valueGroups.title`, `metahubs:optionLists.title`. Synchronized touched backend tests. |
| Active terminology cleanup | Removed the remaining active `catalog-compatible` wording from touched Playwright/browser specs, backend route test names, frontend mock template text, and the custom-entity guides (EN/RU). The docs now describe the shared entity-owned authoring surfaces instead of the old `HubList` / `CatalogList` / `SetList` / `EnumerationList` labels. |
| Focused backend proof | `EntityTypeService.test.ts`, `SnapshotSerializer.test.ts`, and `entityInstancesRoutes.test.ts` pass together (`55/55` tests). |

**Still blocked / not closed in this session**
- Playwright fixture regeneration and docs screenshot refresh still require the missing local E2E env files / running server.
- The system-app manifest still uses `document` as a core `SystemAppBusinessTableKind` in `@universo/migrations-core`; removing that term cleanly requires a broader platform-level contract refactor, not a safe local rename inside metahubs only.
- The large query-key tree is still structurally split across `treeEntities` / `linkedCollections` / `valueGroups` / `optionLists`; only the standard preset translation surface was closed here.

## 2026-04-18 Deep Internal Identifier Cleanup (Phase 13)

Completed deep rename pass of legacy internal identifiers (local variables, private methods, error messages, schema names, type aliases) that remained after the structural entity-first migration.

| Area | Changes |
| --- | --- |
| Schema Names | `AttributesListQuerySchema` → `FieldDefinitionsListQuerySchema`, `ConstantsListQuerySchema` → `FixedValuesListQuerySchema` |
| Route Services | `createEnumerationRouteServices` → `createOptionListRouteServices`, `EnumerationRouteRow` → `OptionListRouteRow` |
| nestedChildHandlers | 44+ identifier renames: `listNestedEnumerations` → `listNestedOptionLists`, `createNestedEnumeration` → `createNestedOptionList`, etc.; all error messages neutralized |
| optionValueHandlers | All `enumeration` local vars → `optionList`; error messages neutralized |
| fixedValue controller | `ensureSetContext` → `ensureValueGroupContext`, `moveConstantSchema` → `moveFixedValueSchema`, `CONSTANT_LIMIT` → `FIXED_VALUE_LIMIT`, `CONSTANT_LIMIT_REACHED` → `FIXED_VALUE_LIMIT_REACHED` |
| Services | `moveConstant` → `moveFixedValue` (MetahubFixedValuesService + test), `getAllowedConstantTypes` → `getAllowedFixedValueTypes`, `EnumerationValueCreate/UpdateInput` → `OptionValueCreate/UpdateInput`, `MetahubEnumerationValueRecord` → `MetahubOptionValueRecord` |
| FieldDefinitions | `maxChildAttributes` → `maxChildFieldDefinitions`, `createTableAttributeLimitError` → `createTableFieldDefinitionLimitError` |
| Validation | Build 30/30, backend 68/68 (581 tests), frontend 64/64 (252 tests) — all green |

## 2026-04-16 Final Legacy Elimination — Complete Entity-First Transition

Completed the full 13-phase plan (A–M) to eliminate ALL remaining legacy naming artifacts from the codebase, covering copy option types, route params, UI breadcrumbs, E2E tests, documentation, DND components, types, hooks, backend shared modules, and NavbarBreadcrumbs internals.

| Phase | Resolution |
| --- | --- |
| A: Copy option neutralization | Renamed `AttributeCopyOptions` → `FieldDefinitionCopyOptions`, `ConstantCopyOptions` → `FixedValueCopyOptions`, `ElementCopyOptions` → `RecordCopyOptions`; removed legacy alias maps. |
| B: Route param neutralization | Renamed `:attributeId` → `:fieldDefinitionId`, `:constantId` → `:fixedValueId`, `:elementId` → `:recordId` across 3 backend route files, 3 controllers, 3 services, 6 frontend API/hook files, 6 UI components, 4 test files. `parentAttributeId`/`targetConstantId`/`isDisplayAttribute` preserved (DB column names). |
| C: NavbarBreadcrumbs cleanup | Removed ~265 lines of dead legacy URL extractors and crumb handlers for `/catalog/`, `/hub/`, `/set/`, `/enumeration/`. Updated test file from legacy URL tests to entity-route tests. |
| D: Playwright spec migration | Updated all legacy URLs in 3 E2E spec files + API session helpers (`api-session.mjs`): UI routes and API endpoint checks now use entity-route paths (`/entities/:kind/instance/:id/field-definitions` etc). |
| E: Documentation cleanup | Fixed Russian SUMMARY.md TOC entry: `[Custom Entity Types]` → `[Пользовательские типы сущностей]`. All TOC links verified. |
| F: Build validation | Full `pnpm build` — 30/30 passed. |
| G: DND file renames | Renamed `AttributeDndProvider` → `FieldDefinitionDndProvider`, `AttributeDndContainerRegistry` → `FieldDefinitionDndContainerRegistry`, `useAttributeDnd` → `useFieldDefinitionDnd`; updated barrel, consumers, tests; renamed internal vars `activeAttribute` → `activeFieldDefinition`, `findAttribute` → `findFieldDefinition`. |
| H: Test file rename | `ElementActions.test.ts` → `RecordActions.test.ts`; fixed internal vars `elementActions` → `recordActions`, `moveElement` → `moveRecord`. |
| I: Type renames | `AttributeDataType` → `FieldDefinitionDataType`, `ATTRIBUTE_DATA_TYPES` → `FIELD_DEFINITION_DATA_TYPES`, `ConstantDataType` → `FixedValueDataType`, `CONSTANT_DATA_TYPES` → `FIXED_VALUE_DATA_TYPES`, `AttributeValidationRules` → `FieldDefinitionValidationRules` across universo-types, schema-ddl, metahubs-backend, metahubs-frontend, applications-backend, admin-backend, start-backend, apps-template-mui. |
| J: Template-MUI hook renames | `useCatalogName` → `useLinkedCollectionName`, `useCatalogNameStandalone` → `useLinkedCollectionNameStandalone`, `useSetNameStandalone` → `useValueGroupNameStandalone`, `truncateCatalogName` → `truncateLinkedCollectionName`, `truncateSetName` → `truncateValueGroupName`, `truncateEnumerationName` → `truncateOptionListName`; removed dead hooks: `useAttributeName`, `truncateAttributeName`, `truncateHubName`. |
| K: Backend shared file renames | `platformSystemAttributesPolicy.ts` → `platformSystemFieldDefinitionsPolicy.ts`, `systemAttributeSeed.ts` → `systemFieldDefinitionSeed.ts`, `setConstantRefs.ts` → `valueGroupFixedValueRefs.ts`; `PlatformSystemAttributesPolicy` → `PlatformSystemFieldDefinitionsPolicy`, `DEFAULT_PLATFORM_SYSTEM_ATTRIBUTES_POLICY` → `DEFAULT_PLATFORM_SYSTEM_FIELD_DEFINITIONS_POLICY`; all consumer function/type names updated. |
| L: NavbarBreadcrumbs vars | Neutralized 11 internal variable/function names: `buildEntityHubScopePath` → `buildEntityTreeEntityScopePath`, `entityRouteCatalogName` → `entityRouteLinkedCollectionName`, etc. |
| M: Build validation | Full `pnpm build` — 30/30 passed. |

## 2026-04-16 Bulk Parameter/Variable Legacy Identifier Elimination

- Eliminated ALL legacy naming identifiers from code-level parameters, variables, and type properties across 7+ packages.
- Automated bulk renames using perl with word-boundary matching and negative lookbehinds:
  - `enumerationId` → `optionListId` (321 refs), `setId` → `valueGroupId` (393 refs), `catalogId` → `linkedCollectionId` (904 refs), `hubId` → `treeEntityId` (957 refs).
  - All compound forms: blocking states, kind contexts, hooks, query keys, local type names.
- Fixed critical stored data access bug: `typed.linkedCollectionId` was reading JSONB that stores `catalogId`.
- Extended renames to applications-frontend, apps-template-mui, applications-backend with careful stored data preservation.
- Renamed API response properties (`catalog` → `linkedCollection`, `hubId` → `treeEntityId`), internal function names, type names, and loop variables.
- Fixed scoping bugs where automated rename conflated loop variables with outer destructured variables.
- Full workspace build `pnpm build` — 30/30 passed.
- Stored data access patterns preserved: `typed.hubId`, `typed.catalogId`, `config.parentHubId`, `config.boundHubId`, `config.bindToHub`, `attachmentKind: 'catalog'`, kind string literals.

## 2026-04-16 Wire Protocol Count Field Neutralization

Renamed all remaining legacy count field names across backend wire protocol, frontend types, UI consumers, mutation hooks, and test mock data. Fixed 3 residual build errors discovered during validation.

| Area | Resolution |
| --- | --- |
| Backend wire fields | `metahubsController.ts`: `hubsCount`→`treeEntitiesCount`, `catalogsCount`→`linkedCollectionsCount`. `entityInstancesController.ts`: `constantsCount`→`fixedValuesCount`, `valuesCount`→`optionValuesCount`. `optionListHelpers.ts`: `valuesCount`→`optionValuesCount`. |
| Frontend types | 8 interfaces updated in `types.ts`: MetahubListItem/Display, TreeEntity/Display, LinkedCollectionEntity/Display, ValueGroupEntity/Display, OptionListEntity/Display. |
| Frontend list utils | 3 files updated with `containersCount` for entity association-level hub counts. |
| Frontend UI consumers | MetahubList, MetahubBoard, TreeEntityList, LinkedCollectionList, ValueGroupList, OptionListList — table columns, board cards, delete dialogs updated. |
| Frontend mutations | 5 mutation hook files updated with neutral optimistic entity field names. |
| Backend/frontend tests | `metahubsRoutes.test.ts`, `entityInstancesRoutes.test.ts`, `optimisticMutations.remaining.test.tsx` — all assertions synchronized. |
| Build error fixes | Stale `EnumerationListItemRow` type reference → `OptionListListItemRow`, two `enumerationId` Zod schema references → `optionListId`. |
| Validation | `pnpm build` passed 30/30. |

## 2026-04-15 Backend Dead Controller Factory Removal

Closed the next backend dead-seam cleanup slice by removing the last unused controller-factory tails that survived inside the linked-collection and option-list helper modules after the earlier entity-owned controller cutovers. This pass stayed intentionally narrow and recovery-driven: the linked-collection factory tail was deleted, the option-list file was rebuilt as a helper-only module after a failed first trim attempt, and the slice closed only after focused route proof plus package/root builds returned green.

| Area | Resolution |
| --- | --- |
| Dead backend factory references | Active backend source search now returns no remaining `createLinkedCollectionController` or `createOptionListController` references anywhere in `packages/metahubs-backend/base/src/**`. |
| Linked-collection helper module | `packages/metahubs-backend/base/src/domains/entities/children/linkedCollectionController.ts` no longer carries the dead controller-factory tail and now keeps only the live linked-collection helper/runtime exports still used by the generic entity controller. |
| Option-list helper module | `packages/metahubs-backend/base/src/domains/entities/children/optionListController.ts` was rebuilt as a helper-only module that preserves the enumeration schemas plus the search/sort/hub-enrichment/blocking-reference helpers still imported by `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts`. |
| Validation | Focused `entityInstancesRoutes.test.ts` passed `40/40`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-15 Standard Entity Copy Contract Neutralization

## 2026-04-15 Backend Tree Controller File Removal

Closed the next backend file-level cleanup slice by deleting the now-orphaned tree child-controller file after the earlier entity-owned route and behavior cutovers had already removed its active runtime ownership. This pass stayed intentionally exact about scope: it proved the file was dead in the active backend graph, removed it, and reran the same focused/backend/root validation path instead of pretending a new tree-behavior rewrite happened here.

| Area | Resolution |
| --- | --- |
| Orphaned tree controller file | `packages/metahubs-backend/base/src/domains/entities/children/treeController.ts` was deleted after active backend source search showed no remaining imports or symbol references outside the file itself. |
| Surviving tree behavior ownership | `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts` together with `packages/metahubs-backend/base/src/domains/entities/children/treeCompatibility.ts` remain the live owners of the current tree-compatible nested behavior. |
| Focused proof and validation | Focused `entityInstancesRoutes.test.ts` passed `40/40`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-15 Standard Entity Copy Contract Neutralization

Closed the next shared-contract slice in the entity-first migration by removing the remaining hub/catalog/set/enumeration copy vocabulary from the active standard entity copy surface. This pass stayed intentionally contract-first: it rewired shared copy-option types and normalizers, retargeted the frontend copy dialogs/API payloads/locale labels, moved backend copy validation and the shared design-time child-copy helper to the same neutral keys, and kept legacy request aliases only as boundary compatibility inputs.

| Area | Resolution |
| --- | --- |
| Shared copy-option contract | `packages/universo-types/base/src/common/copyOptions.ts` and `packages/universo-utils/base/src/validation/copyOptions.ts` now treat `TreeEntityCopyOptions`, `LinkedCollectionCopyOptions`, `ValueGroupCopyOptions`, and `OptionListCopyOptions` as the canonical standard copy contract, with alias-aware normalization limited to legacy request inputs. |
| Frontend copy flows and i18n | The active generic entity copy screen plus the tree-entity, linked-collection, value-group, and option-list copy dialogs now emit the neutral payload keys; the touched EN/RU locale blocks now expose the matching neutral labels; and the focused `copyOptionPayloads` proof plus the touched record-list mock were synchronized to the new helper names. |
| Backend validation and child-copy wiring | `entityInstancesController.ts`, the specialized tree/linked-collection/option-list/value-group copy handlers, and `designTimeObjectChildrenCopy.ts` now use neutral internal copy keys while still accepting legacy request aliases where route compatibility matters. |
| Validation | `pnpm --filter @universo/types build` passed, `pnpm --filter @universo/utils build` passed, focused metahubs frontend tests passed (`2` files / `7` tests), focused metahubs backend Jest suites passed (`2` suites / `42` tests), `pnpm --filter @universo/metahubs-frontend build` passed, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-15 Standard Copy Backend Naming Closure

Closed the next backend-only cleanup slice after the standard copy contract cutover by removing the remaining legacy naming from the shared design-time child-copy result contract and the active backend copy schema locals. This pass stayed intentionally narrow: it neutralized copy-specific internal/result naming without pretending that the broader entity count contract (`attributesCount`, `elementsCount`, `valuesCount`, `constantsCount`) had already been migrated across the full runtime/frontend surface.

| Area | Resolution |
| --- | --- |
| Shared backend copy-result contract | `packages/metahubs-backend/base/src/domains/entities/services/designTimeObjectChildrenCopy.ts` now returns `fieldDefinitionsCopied`, `recordsCopied`, `fixedValuesCopied`, and `optionValuesCopied`, and its fixed-value validation/failure messages no longer publish `Constant copy` wording as the active internal truth surface. |
| Backend copy handler locals | The standard copy handlers now use `copyTreeEntitySchema`, `copyLinkedCollectionSchema`, `copyValueGroupSchema`, `copyOptionListSchema`, and `copyOptionValueSchema`; linked-collection and option-list copy paths now consume the neutral shared result fields internally, and the value-group copy response now publishes `copy.fixedValuesCopied` for the copy-specific result payload. |
| Focused proof and validation | Focused backend Jest suites passed (`2` suites / `42` tests), `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-15 Backend Value Group Controller Removal

Closed the next backend de-specialization slice by deleting the dedicated value-group child-controller file after moving its still-live nested set runtime into the generic entity controller. This pass stayed intentionally narrow and contract-preserving: it removed the file-level controller seam without claiming that the broader linked-collection or option-list helper/runtime divergences are already solved.

| Area | Resolution |
| --- | --- |
| Generic controller ownership | `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts` now owns nested set list/get/create/update/reorder/delete directly, including the supporting set-specific schemas, sorting/search helpers, hub enrichment, and blocked-delete logic that previously lived in the dedicated child-controller file. |
| File-level seam removal | `packages/metahubs-backend/base/src/domains/entities/children/valueGroupController.ts` was deleted, and the active backend source tree no longer imports or references `valueGroupController`. |
| Focused proof and validation | Focused `entityInstancesRoutes.test.ts` passed `40/40`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-15 Final Backend Entity-First Closure — Tree Controller Removal

## 2026-04-15 Branch Copy Contract Neutralization

Closed the next contract-focused entity-first migration slice by removing the legacy branch copy naming from the active shared/frontend/backend branch copy surface while keeping backend request compatibility at the route boundary. This pass stayed intentionally narrow and evidence-backed: it moved the canonical branch copy contract to neutral entity-first keys, aligned the branch create/copy UI and i18n with that contract, fixed the previously missing create-flow value-group toggle, and updated the focused backend/frontend proof to cover both canonical and alias-compatible paths.

| Area | Resolution |
| --- | --- |
| Shared branch copy contract | `packages/universo-types/base/src/common/copyOptions.ts` and `packages/universo-utils/base/src/validation/copyOptions.ts` now treat `copyTreeEntities`, `copyLinkedCollections`, `copyValueGroups`, and `copyOptionLists` as the canonical branch copy keys while still resolving the legacy request aliases during normalization. |
| Frontend branch flows | `packages/metahubs-frontend/base/src/domains/branches/**` plus the touched EN/RU locale blocks now use the neutral branch copy keys and labels in payload builders, forms, branch create/copy dialogs, focused tests, and branch compatibility warning text; the branch create screen also now exposes the value-group toggle that was previously missing from the create flow. |
| Backend compatibility path | `packages/metahubs-backend/base/src/domains/branches/controllers/branchesController.ts` and `services/MetahubBranchesService.ts` now use the neutral branch copy contract and neutral compatibility error codes/messages internally, while the route boundary still accepts legacy alias fields explicitly to preserve already-shipped callers during the transition. |
| Validation | `pnpm --filter @universo/types build` passed, `pnpm --filter @universo/utils build` passed, focused metahubs frontend branch copy tests passed (`2` files / `4` tests), focused metahubs backend branch copy tests passed (`2` suites / `18` tests), `pnpm --filter @universo/metahubs-frontend build` passed, and the touched backend branch copy files remained diagnostics-clean. |

## 2026-04-15 Final Backend Entity-First Closure — Value Group And Option List Controller Removal

## 2026-04-15 Final Backend Entity-First Closure — Linked Collection Controller Removal

Closed the last verified child-controller delegation seam inside the generic entity controller by removing the linked-collection controller instantiation. The nested standard route surface now resolves linked collections, sets, enumerations, and tree entities through direct service-backed handlers under `entityInstancesController.ts`, with focused route proof and full build verification after the cutover.

| Area | Resolution |
| --- | --- |
| Linked-collection controller seam | `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts` no longer instantiates `createLinkedCollectionController`; nested linked-collection list/create/reorder/detail/update/delete routes now use direct generic-controller handlers built from reusable linked-collection service helpers. |
| Linked-collection helper extraction | `packages/metahubs-backend/base/src/domains/entities/children/linkedCollectionController.ts` now exports reusable hub-scoped linked-collection handlers for list/create/reorder/detail/update/delete so the generic controller can wrap them directly without controller-to-controller delegation. |
| Focused proof and validation | `packages/metahubs-backend/base/src/tests/routes/entityInstancesRoutes.test.ts` now covers the entity-owned nested linked-collection detail endpoint, the focused route suite passed `40/40`, `pnpm --filter @universo/metahubs-backend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

Closed the next backend de-specialization slice by removing the remaining option-list and value-group child-controller instantiation from the generic entity controller. This pass stayed intentionally exact about scope: nested enumeration and set routes now run directly through service-backed generic controller handlers, but linked-collection nested CRUD still preserves the last specialized child-controller seam.

| Area | Resolution |
| --- | --- |
| Enumeration controller seam | `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts` no longer instantiates `createOptionListController`; nested enumeration instance CRUD and enumeration value routes now use direct service-backed generic controller handlers built from reusable option-list helper exports. |
| Value-group controller seam | `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts` no longer instantiates `createValueGroupController`; nested set routes now use direct generic-controller handlers built from reusable value-group service helpers, and `packages/metahubs-backend/base/src/domains/entities/children/valueGroupController.ts` now exposes those service-backed helpers instead of hiding them behind controller-only wiring. |
| Focused proof and validation | `packages/metahubs-backend/base/src/tests/routes/entityInstancesRoutes.test.ts` now covers the entity-owned enumeration value list and nested set detail endpoints, the focused route suite passed `39/39`, `pnpm --filter @universo/metahubs-backend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

Closed the next narrow backend de-specialization slice by removing the remaining `treeController` dependency from the generic entity controller. This pass stayed intentionally small and validated: it replaced only the nested child hub list path with direct generic-controller logic, added focused route coverage for that entity-owned endpoint, and kept the broader catalog/value-group/option-list controller seams explicitly open instead of pretending the entire controller layer is already generic.

| Area | Resolution |
| --- | --- |
| Child hub route ownership | `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts` no longer imports or instantiates `createTreeController`; the nested child hub list path now uses `MetahubTreeEntitiesService` plus `treeCompatibility` helpers directly inside the generic entity controller. |
| Focused route coverage | `packages/metahubs-backend/base/src/tests/routes/entityInstancesRoutes.test.ts` now covers `/metahub/:metahubId/entities/hub/instance/:hubId/instances`, so the entity-owned child hub list route is validated without the old tree-controller dependency. |
| Validation | The focused backend route suite passed `37/37`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-15 Final Backend Entity-First Closure — ACL And Router Orchestration

Closed the next backend entity-first stabilization slice by fixing the remaining custom-entity ACL asymmetry and by moving nested standard child-route orchestration out of the live router. This pass stayed intentionally honest about scope: it removed the router-owned specialized dispatch seam and synchronized the stale focused proof layer, but it did not claim that the backend is fully de-specialized while the controller factory still instantiates the specialized child controllers internally.

| Area | Resolution |
| --- | --- |
| Generic custom-entity ACL contract | `packages/metahubs-backend/base/src/domains/shared/entityMetadataKinds.ts` now maps generic entity instance create/edit/delete to `createContent` / `editContent` / `deleteContent` instead of falling back to `manageMetahub`, and `packages/metahubs-backend/base/src/tests/routes/entityInstancesRoutes.test.ts` now locks that contract explicitly for custom create/update/delete/copy flows. |
| Router-owned standard child dispatch seam | `packages/metahubs-backend/base/src/domains/entities/routes/entityInstancesRoutes.ts` no longer imports the specialized standard child-controller factories or owns the local dispatch helpers; nested standard child and option-value route handling now flows through controller-returned handlers from `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts`. |
| Focused stale proof synchronization | `packages/metahubs-frontend/base/src/components/__tests__/ValueGroupDeleteDialog.test.tsx` and `packages/metahubs-frontend/base/src/domains/entities/metadata/fieldDefinition/ui/__tests__/NestedFieldDefinitionList.optimisticCreate.test.tsx` were synchronized to the current linked-collection wording and mixed field-definition hook contract so the touched proof layer matches the shipped runtime. |
| Validation | The focused backend route suite passed `36/36`, the synced focused frontend tests passed (`3` tests), `pnpm --filter @universo/metahubs-backend build` passed after the final helper restoration, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-15 Frontend Entity-First Terminology Reconciliation

## 2026-04-15 Residual Frontend Truth-Surface Cleanup

Closed the next narrow frontend reconciliation slice by removing the last still-shipped wording/comment/fallback seams inside already-neutralized entity-first UI files. This pass deliberately stayed at the truth-surface layer: it changed active dialog copy, record-screen empty/error/tab labels, locale strings, and shared comments while preserving the current route/query/data contracts and avoiding the larger dirty-tree refactor already in flight.

| Area | Resolution |
| --- | --- |
| Touched delete dialogs and selection surfaces | `TreeDeleteDialog.tsx`, `LinkedCollectionDeleteDialog.tsx`, `ContainerSelectionPanel.tsx`, and `ContainerParentSelectionPanel.tsx` now describe tree entities, linked collections, and containers in the touched comments and labels instead of preserving the residual hub/catalog wording that survived in those active files. |
| Shared truth-surface comments and record-screen labels | `constants/storage.ts`, `types.ts`, `record/api/records.ts`, and `RecordList.tsx` now use neutral linked-collection / tree-entity wording for the touched shared comments plus the parent linked-collection empty/error/edit/tab text on the record screen. |
| Locale alignment and compatibility guard | The touched EN/RU locale blocks now carry the same linked-collection wording for the active delete-dialog and record-screen labels, and `ContainerSelectionPanel` keeps `currentHubId` as a compatibility alias so the wording cleanup does not break existing callers. |
| Validation | `get_errors` stayed clean for the touched files, `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

Closed the next narrow frontend truth-surface slice by removing the remaining active compatibility-only names and user-facing wording that still contradicted the shipped entity-owned authoring contract. This pass stayed intentionally limited to touched production source, locale text, and focused test descriptions so the dirty migration branch could keep moving without reopening the larger in-flight folder and runtime refactors.

| Area | Resolution |
| --- | --- |
| Compatibility type naming | `packages/metahubs-frontend/base/src/domains/metahubs/hooks/mutationTypes.ts` now uses `MetahubDraftInput` instead of `LegacyMetahubInput`, and the related mutation imports/usages were updated through semantic rename support. |
| Entity-instance and workspace wording | `packages/metahubs-frontend/base/src/domains/entities/ui/EntityInstanceList.tsx` plus `EntitiesWorkspace.tsx` now use linked-collection / entity-first wording for the touched banner, delete-dialog, and predefined-elements helper copy instead of the old `catalog-compatible` surface. |
| Locales and focused tests | The touched EN/RU `metahubs.json` blocks now use linked-collection and existing-format codename wording, and `packages/metahubs-frontend/base/src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx` now describes linked collection, tree entity, value group, and option list surfaces instead of the old compatibility labels. |
| Validation | `get_errors` stayed clean for the touched frontend files, `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-15 Residual Backend Truth-Surface Cleanup

Closed the next narrow backend/docs reconciliation slice by removing the last audited inline shared-target cleanup special-case from the metahub object service and by neutralizing the remaining metadata tag truth surface in the REST docs generator and package README pair. This pass stayed intentionally honest about scope: the route-source inventory itself was already aligned with the mounted router, so the actual remaining docs debt was the legacy `Attributes` / `Constants` / `Elements` tag vocabulary rather than deleted file references.

| Area | Resolution |
| --- | --- |
| Backend object-service seam | `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts` now resolves shared-override cleanup through a computed helper derived from `SHARED_POOL_TO_TARGET_KIND`, `SHARED_OBJECT_KINDS`, and the existing behavior-registry contract instead of repeating a hard-coded catalog/set/enumeration/shared-pool branch inside delete and permanent-delete flows. |
| REST docs metadata truth surface | `packages/universo-rest-docs/scripts/generate-openapi-source.js` now emits `Field Definitions`, `Fixed Values`, and `Records` tags/descriptions for the entity-owned metadata routes, and `packages/universo-rest-docs/README.md` plus `README-RU.md` now describe the same neutral route-group vocabulary. |
| Generated artifacts and validation | `pnpm --filter @universo/metahubs-backend build` passed, `pnpm --filter @universo/rest-docs build` passed with green `verify:route-sources`, regenerated `packages/universo-rest-docs/src/openapi/index.yml` and `packages/universo-rest-docs/dist/openapi-bundled.yml`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-15 Layouts Resources Flow Playwright Reconciliation

Closed the next narrow browser-proof slice in the entity-first migration branch by retargeting the stale metahub layouts Playwright flow from the removed Common surface to the shipped Resources route contract. This pass stayed deliberately focused on the validation layer: route expectations, shared selector helpers, and the heavy-flow timeout budget were updated without reopening unrelated runtime or documentation surfaces.

| Area | Resolution |
| --- | --- |
| Resources route/browser contract | `tools/testing/e2e/specs/flows/metahub-layouts.spec.ts` now opens `/metahub/:id/resources`, expects the `Resources` heading, follows `/resources/layouts/:layoutId`, and keeps the list -> details -> widget-toggle persistence proof on the shipped route tree instead of the removed `/common` surface. |
| Shared selector contract | `tools/testing/e2e/support/selectors/contracts.ts` now exports `metahubResourcesTabs` and `metahubResourcesContent`, so the focused flow uses the current shared-resources test ids rather than stale Common-only selectors. |
| Harness stability | The first focused wrapper rerun proved the old failure was a `60000ms` timeout during heavy API/bootstrap work before the first `page.goto()`, so the spec now carries `test.setTimeout(300_000)` like comparable heavy metahub/browser flows. |
| Validation | `get_errors` stayed clean for the touched selector/spec files, the first wrapper rerun isolated the timeout root cause, and the follow-up focused wrapper run `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-layouts.spec.ts` completed green with `2 passed`. |

## 2026-04-15 RecordList Entity-First Type Reconciliation

Closed the next frontend stabilization slice inside the already-dirty entity-first migration branch by repairing the generic record editor around the live neutral metadata/runtime contracts. This pass stayed intentionally narrow: it fixed the broken `RecordList.tsx` type surface and its immediate shared helper/mutation typings without opening a wider route or persistence rewrite.

| Area | Resolution |
| --- | --- |
| Direct query/API contract | `packages/metahubs-frontend/base/src/domains/entities/metadata/record/ui/RecordList.tsx` now passes the required pagination/query-key params for direct field-definition, record, and entity lookups, and the file imports the neutral record helper types it already uses. |
| Localized codename reconciliation | The record editor now resolves `CodenameVLC` values into stable string keys before building dynamic field configs, table columns, copy defaults, and set-reference payload normalization, so record payload keys stay string-based while the frontend metadata contract remains localized. |
| Shared helper and optimistic-lock contract | `packages/metahubs-frontend/base/src/domains/entities/metadata/record/hooks/mutationTypes.ts` now allows `expectedVersion` on record updates, and `packages/universo-template-mui/base/src/components/menu/BaseEntityMenu.tsx` explicitly types edit/copy dialog helper callbacks used by the record actions. |
| Validation | `get_errors` is clean for the touched `RecordList.tsx` slice, `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed without errors. |

## 2026-04-15 Behavior-Based Standard Blocking References

Closed the next small backend Phase 2 consolidation slice by removing the manual specialized-controller ownership from the entity-owned standard `blocking-references` endpoint while preserving the existing per-kind response contract. This pass stayed intentionally narrow and reused the existing behavior-registry infrastructure instead of attempting a broader child-controller rewrite on a dirty branch.

| Area | Resolution |
| --- | --- |
| Behavior-based controller ownership | `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts` now exposes `getBlockingReferences`, reuses the standard-kind behavior blocking-state path for `catalog`, `set`, and `enumeration`, preserves the current `catalogId` / `setId` / `enumerationId` plus `blockingReferences` / `canDelete` payload shapes, and keeps unsupported-kind / missing-entity failures explicit. |
| Entity-owned route consolidation | `packages/metahubs-backend/base/src/domains/entities/routes/entityInstancesRoutes.ts` no longer manually dispatches `/metahub/:metahubId/entities/:kindKey/instance/:entityId/blocking-references` to specialized child controllers; that route now resolves through the generic entity controller, and the focused route suite proves catalog/set/enumeration behavior through the entity-owned endpoint while rejecting `hub` on the generic blocking-references path. |
| Validation | `packages/metahubs-backend/base/src/tests/routes/entityInstancesRoutes.test.ts` passed `36/36`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green. |

## 2026-04-15 Behavior-Based Hub Blocking Endpoint

Closed the next small backend Phase 2 consolidation slice by removing the manual specialized-controller ownership from the entity-owned hub `blocking-dependencies` route while preserving the existing response contract. This pass stayed intentionally narrow: it reused the already-present behavior registry infrastructure instead of attempting a broad child-controller rewrite in one step.

| Area | Resolution |
| --- | --- |
| Behavior contract | `EntityBehaviorService` now includes a reusable blocking-state hook, and `standardKindCapabilities.ts` exposes a matching standard-kind blocking-state builder alongside the existing delete-plan logic. |
| Entity-owned route consolidation | `entityInstancesController.ts` now serves `/metahub/:metahubId/entities/hub/instance/:entityId/blocking-dependencies` through the generic entity controller + behavior registry, and `entityInstancesRoutes.ts` no longer dispatches that endpoint to `treeController`. |
| Validation | The focused backend route suite `entityInstancesRoutes.test.ts` passed `32/32`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green. |

## 2026-04-15 Public Runtime Hardening And Remaining Legacy Seams

Closed the next QA-driven entity-first remediation slice by fixing the broken metahubs frontend package README pair, tightening unauthenticated public metahub reads to require a real published runtime instead of a bare `is_public` flag, and neutralizing the next touched layer of shipped delete/conflict wording across backend/frontend production flows. This pass deliberately stayed narrow and evidence-backed: it fixed validated regressions without pretending the broader long-range migration plan was already complete.

| Area | Resolution |
| --- | --- |
| Package README truth surface | `packages/metahubs-frontend/base/README.md` and `README-RU.md` were repaired so the route/component examples and development sections no longer contain malformed code fences or duplicated headings, and the EN/RU pair stayed in exact parity (`437/437`). |
| Public runtime guard | `packages/metahubs-backend/base/src/domains/metahubs/controllers/publicMetahubsController.ts` now fails closed unless the public metahub also has a `full`-access publication with an active snapshot-backed version, so unauthenticated reads are backed by publication/runtime proof instead of only the metahub `is_public` flag. |
| Touched standard-kind message seam | The touched backend child/metadata controllers, frontend delete dialogs and list fallbacks, and EN/RU metahubs locale values now ship neutral tree entity / linked collection / value group / option list / field definition / fixed value / record wording for this slice while preserving compatibility-sensitive error codes and translation keys. |
| Validation | `publicMetahubsRoutes.test.ts` passed `16/16`, the focused backend message-contract suites passed `63/63`, both touched package builds passed, and the canonical root `pnpm build` completed green. |

## 2026-04-15 Public Runtime Route Neutralization

Closed the next isolated entity-first migration slice by removing the legacy hub/catalog/attribute/element path contract from the public read-only metahub API. This pass intentionally stayed within the standalone public router/controller surface so the cutover could be validated end-to-end together with its dedicated Jest suite and generated OpenAPI artifacts.

| Area | Resolution |
| --- | --- |
| Public route contract | `packages/metahubs-backend/base/src/domains/metahubs/routes/publicMetahubsRoutes.ts` now exposes `tree-entities`, `tree-entity/:treeEntityCodename`, `linked-collections`, `linked-collection/:linkedCollectionCodename`, `field-definitions`, `records`, and `record/:recordId` instead of `/hubs`, `/hub/:hubCodename`, `/catalogs`, `/catalog/:catalogCodename`, `/attributes`, and `/elements`. |
| Public controller vocabulary | `packages/metahubs-backend/base/src/domains/metahubs/controllers/publicMetahubsController.ts` now uses neutral controller/helper names such as `listTreeEntities`, `getTreeEntity`, `listLinkedCollections`, `listFieldDefinitions`, `listRecords`, and `getRecord` while preserving the same published read-only behavior over the existing underlying services and data relations. |
| Tests and generated OpenAPI | `packages/metahubs-backend/base/src/tests/routes/publicMetahubsRoutes.test.ts` now proves the neutral route contract (`13` tests passed), `pnpm --filter @universo/rest-docs build` regenerated `packages/universo-rest-docs/src/openapi/index.yml` and `packages/universo-rest-docs/dist/openapi-bundled.yml` with the new public paths, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-15 Residual Legacy Truth-Surface Cleanup

Closed the next low-risk entity-first cleanup slice by removing a few still-shipped residual truth surfaces that no longer matched the current repository contract. This pass deliberately stayed narrow and evidence-backed: it fixed the last metahubs backend pending-id UUID seam, removed the stale `catalog-v2` mock preset surface, and renamed the last V2-only E2E helper/spec files without claiming broader public-route closure.

| Area | Resolution |
| --- | --- |
| Backend UUID contract | `packages/metahubs-backend/base/src/domains/entities/controllers/entityInstancesController.ts` now uses `generateUuidV7()` instead of `randomUUID()` when reserving pending object ids for entity creation, aligning the controller with the repository-wide UUID v7 strategy already used in metahubs and utils. |
| Frontend/E2E V2 residue | `packages/metahubs-frontend/base/src/__mocks__/handlers.ts` now uses the direct `catalog` preset codename instead of `catalog-v2`, and the last V2-only flow/helper files were renamed from `metahub-entities-v2-runtime.spec.ts` / `entity-v2-helpers.ts` to `metahub-standard-preset-runtime.spec.ts` / `entity-runtime-helpers.ts`. |
| Validation | `get_errors` reported no issues in the touched files, `pnpm --filter @universo/metahubs-backend build` passed, `pnpm --filter @universo/metahubs-frontend build` passed, a targeted negative grep over the touched active paths returned no remaining `randomUUID()`, `catalog-v2`, `entity-v2-helpers`, or `metahub-entities-v2-runtime` matches, and the canonical root `pnpm build` task completed without errors. |

## 2026-04-15 Residual Standard-Kind Local Naming Cleanup

Closed the next small but still-live entity-first cleanup slice by removing the remaining business-named local create/request helper seam from the active tree runtime and the focused optimistic mutation coverage. This pass intentionally stayed at the local-symbol level: runtime behavior, routes, payload semantics, and i18n namespaces were left unchanged.

| Area | Resolution |
| --- | --- |
| Tree runtime local seam | `TreeEntityList.tsx` now uses neutral local names such as `createTreeEntityMutation`, `updateTreeEntityMutation`, `deleteTreeEntityMutation`, `copyTreeEntityMutation`, `reorderTreeEntityMutation`, `createTreeEntityContext`, `handleCreateTreeEntity`, and `validateCreateTreeEntityForm` instead of the remaining `createHub*` / `*HubMutation` local seam. |
| Focused optimistic test locals | `optimisticMutations.remaining.test.tsx` now uses request-controller locals such as `createTreeEntityRequest`, `createValueGroupRequest`, and `createOptionListRequest`, so the touched test surface no longer preserves `createHubRequest`, `createSetRequest`, and `createEnumerationRequest` naming. |
| Validation | `get_errors` reported no issues in the touched files, `pnpm --filter @universo/metahubs-frontend build` passed, a targeted rerun of the renamed optimistic mutation cases passed (`6 passed`, `7 skipped`), and the canonical root `pnpm build` completed green with `30 successful, 30 total`. A full run of the entire `optimisticMutations.remaining.test.tsx` file still exposed two unrelated locked-shared reorder failures in the constants/attributes coverage, so this entry records the local naming slice as complete without claiming that the whole file is green. |

## 2026-04-15 Final Entity-Only Surface Completion — Route, Docs, And Permission-Proof Pass

## 2026-04-15 Final Entity-Only Surface Completion — Nested Child Instance Contract

Closed the next verified entity-first route slice by removing the last business-named standard child URL fragments from the active entity-owned router contract. This pass changed the backend child-instance endpoints, the frontend route builders/router registrations, the standard child-resource API helpers, and the directly related metadata child mounts so standard child authoring now travels through generic nested instance paths instead of `/catalogs`, `/catalog/:id`, `/sets`, `/enumerations`, `/hubs`, and `blocking-catalogs` route shapes.

| Area | Resolution |
| --- | --- |
| Backend child route contract | `entityInstancesRoutes.ts` now dispatches standard child kinds through generic nested instance endpoints such as `/entities/:kindKey/instance/:hubId/instances`, `/instance/:hubId/instance/:entityId`, and `/blocking-dependencies`, while nested enumeration value routes and metadata child mounts were retargeted to `/instance/:hubId/instance/:entityId/...`. |
| Frontend route and API contract | `entityMetadataRoutePaths.ts`, `MainRoutes.tsx`, the standard child-resource API helpers, and the touched metadata API helpers now emit/consume the same nested instance surface, so child authoring/navigation no longer depends on `/catalogs`, `/catalog/:id`, `/sets`, `/enumerations`, or `/hubs` under entity-owned routes. |
| Focused docs/tests | The shared route-path test, the TreeEntityList route-state test, and the touched metahubs frontend README EN/RU examples were synchronized to the new nested instance contract. |
| Validation | Focused frontend Vitest passed for `entityMetadataRoutePaths.test.ts` and `TreeEntityList.settingsReopen.test.tsx` (`2` files / `4` tests), focused backend Jest passed for `entityInstancesRoutes.test.ts` (`31` tests), both touched package builds passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

Closed the next verified entity-first cleanup slice by removing the remaining legacy metahub compatibility entrypoints from the live router, rewriting the stale `Common section` documentation truth surface to the active `Resources workspace` narrative, and stabilizing the two long-running permission browser proofs that had timed out during the first validation pass. This entry deliberately does not claim broader zero-debt closure: source-only grep still shows deeper tree/catalog/set/enumeration semantics in active standard-kind and template code beyond the helper/export seams neutralized here.

| Area | Resolution |
| --- | --- |
| Live route and breadcrumb contract | `MainRoutes.tsx` no longer mounts `/common`, `/general`, or top-level `/layouts` metahub compatibility entrypoints, the legacy redirect helpers were removed, and `NavbarBreadcrumbs.tsx` now recognizes only the active `/resources/layouts/...` route surface for layout details. |
| Helper/export seam cleanup | The touched frontend/backend runtime helpers now use more neutral names for the audited slice, including `BlockingTreeDependency`, `TreeCompatibilityContext`, `TreeEntityFormSetValue`, `ContainerDisplayInfo`, and the linked-collection compatibility helper contract, while intentionally preserving deeper transport/data semantics that still remain active elsewhere. |
| Documentation truth surface | The central EN/RU metahub docs were rewritten from the removed `Common section` narrative to the active `Resources workspace` narrative, surrounding guides and summary references were retargeted, the stale `Common Section` / `Раздел Common` wording disappeared from active docs search, and the main EN/RU pairs stayed in parity. |
| Validation and proof stabilization | Focused touched-package builds stayed green, the canonical root `pnpm build` completed green with `30 successful, 30 total`, the initial full `@permission` suite exposed timeout pressure in two long-running browser flows, and the targeted rerun of those two specs passed after increasing their Playwright timeout budget and waiting for destructive confirm buttons to become enabled (`3 passed`). |

## 2026-04-15 Entity-First Final Reconciliation And Proof Closure

## 2026-04-15 Entity-Centric Navigation And Diagnostics Closure

Closed the next high-signal entity-first cleanup slice by removing the remaining first-class `common` navigation/export surface, dropping hard-coded standard-kind metahub sidebar entrypoints, and reconciling the touched TypeScript config debt against the actual compiler version used by workspace builds. This pass deliberately stayed honest about scope: it made the active navigation/runtime contract cleaner and build-safe, but it did not pretend the broader unchecked long-range migration phases were automatically finished.

| Area | Resolution |
| --- | --- |
| Navigation truth surface | The static metahubs dashboard export and the live template-mui metahub menu now expose board, resources, entities, and dynamic entity-type items instead of hard-coded `hubs` / `catalogs` / `sets` / `enumerations` sidebar links. Breadcrumbs and metahub layout redirects now target `/metahub/:id/resources` as the canonical shared-resource route. |
| Public resources contract | `@universo/metahubs-frontend` now exports `MetahubResources` instead of `MetahubSharedResources`, the active route surface uses `/metahub/:id/resources`, focused source tests were retargeted, EN/RU menu and metahubs labels now say `Resources` / `Ресурсы`, and the touched metahubs frontend README surfaces now match the shipped route/export contract. |
| TypeScript configuration reconciliation | `packages/start-backend/base/tsconfig.json` now sets `rootDir`, `packages/metahubs-backend/base/tsconfig.json` no longer carries the deprecated `baseUrl`, and the root tsconfig intentionally stays on the build-compatible `ignoreDeprecations: 5.0` contract because the actual workspace TypeScript compiler rejects `6.0` even though newer editor diagnostics may suggest it. |
| Validation | Focused Vitest passed for `exports.test.ts`, `SharedResourcesPage.test.tsx`, and `LayoutList.copyFlow.test.tsx` (`3` files / `11` tests); focused template-mui Jest passed for `NavbarBreadcrumbs.test.tsx` and `MenuContent.test.tsx` (`2` suites / `9` tests); the directly affected frontend package builds passed; `pnpm --filter @universo/metahubs-backend build` passed after the final tsconfig cleanup; and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

Closed the reopened reconciliation slice that was blocking an honest entity-first closure claim for the touched proof/doc surfaces. This pass did not introduce a new architecture rewrite; it repaired the stale browser fixture, synchronized the touched metahubs package README truth surfaces with the live tree/router contract, and reran the canonical validation so the branch state and its public documentation now match.

| Area | Resolution |
| --- | --- |
| Focused Playwright permission proof | `tools/testing/e2e/specs/flows/metahub-entities-workspace.spec.ts` now creates the instance through the generic entity endpoint for the same custom catalog-compatible kind whose route the browser opens, so the member-readonly proof no longer mixes a standard `catalog` fixture with a custom entity route. |
| Package README truth surfaces | `packages/metahubs-backend/base/README.md` and `README-RU.md` now describe the live entity-first router composition rather than legacy `attributes/constants/elements` mounts or `/:metahubId/hubs` examples, while `packages/metahubs-frontend/base/README.md` and `README-RU.md` now describe the current `components/`, `domains/`, `hooks/`, `i18n/`, `menu-items/`, `types.ts`, `displayConverters.ts`, and `utils/` layout instead of deleted legacy entrypoints. |
| Validation | `get_errors` reported no problems in the touched spec/README files, README EN/RU parity remained exact (`129/129` backend and `437/437` frontend lines), the focused Playwright rerun passed both tests including `catalog-compatible entity instances stay read-only for metahub members` (`2 passed`), and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Metadata Transport Segment Neutralization

Closed the next entity-first metadata cleanup slice by removing the live `attributes` / `constants` / `elements` transport route contract from the touched authoring surfaces. This pass changed mounted backend suffixes, emitted frontend URLs, metadata API client paths, and route-aware navigation/test expectations, while intentionally preserving the current internal tab/query-state vocabulary and deeper DTO semantics for a later slice.

| Area | Resolution |
| --- | --- |
| Backend metadata transport | The entity-owned backend metadata routes now mount on `field-definitions` / `field-definition`, `fixed-values` / `fixed-value`, and `records` / `record` suffixes instead of the legacy `attributes`, `constants`, and `elements` route segments. |
| Frontend route ownership | `entityMetadataRoutePaths.ts`, `MainRoutes.tsx`, the metadata API clients, breadcrumb href builders, and layout path derivations now emit the neutral metadata transport vocabulary while keeping the internal tab ids such as `attributes`, `system`, and `elements` stable for now. |
| Test and validation fallout | The touched backend/frontend route suites, shared route-path assertions, blocking-delete dialog expectations, and breadcrumb test were retargeted to the new transport segments; during validation, stale frontend mocks that still exported pre-neutralization mutation hook names were updated to the current field-definition / record hook contract. |
| Validation | Focused Vitest passed for `entityMetadataRoutePaths.test.ts`, `FieldDefinitionList.systemTab.test.tsx`, `RecordList.settingsContinuity.test.tsx`, `RecordList.createErrorFlow.test.tsx`, `ValueGroupDeleteDialog.test.tsx`, and `OptionListDeleteDialog.test.tsx` (`6` files / `13` tests); focused backend Jest passed for `fieldDefinitionsRoutes.test.ts`, `fixedValuesRoutes.test.ts`, and `recordsRoutes.test.ts` (`3` suites / `39` tests); `NavbarBreadcrumbs.test.tsx` passed (`3` tests); and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Frontend Standard UI Local Alias Neutralization

## 2026-04-15 Metadata API Helper Contract Neutralization

Closed the next entity-first metadata cleanup slice by removing the remaining `attribute` / `constant` / `element` helper-export seam from the active frontend metadata API surfaces and by neutralizing the touched backend controller-local schema names. This pass intentionally stopped at the helper-contract boundary: mounted transport path strings, request param names, and compatibility payload fields were left unchanged because they still define the live backend/runtime contract.

| Area | Resolution |
| --- | --- |
| Frontend metadata helper contract | The touched `fieldDefinition`, `fixedValue`, and `record` API surfaces now expose neutral field-definition / fixed-value / record helper names, direct variants, codename helpers, and matching hook/type contracts instead of the remaining `listAttributes|getAttribute|createAttribute`, `listConstants|getConstant|createConstant`, and `listElements|getElement|createElement` style export seam. |
| Backend metadata controller-local schemas | The touched controller-local schemas now use neutral names such as `createFieldDefinitionSchema`, `createFixedValueSchema`, and `createRecordSchema`, so the immediate metadata controller implementation surface no longer advertises legacy child-resource wording through its active local schema symbols. |
| Validation | `pnpm --filter @universo/metahubs-frontend build` passed after the helper-contract cutover, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Frontend Standard UI Local Alias Neutralization

Closed the next entity-first frontend cleanup slice by removing the remaining Hub/Catalog/Set/Enumeration local alias seam from the active standard UI entry modules and their focused action-factory test wording. This pass stayed strictly at the local/export-symbol boundary: runtime behavior, mounted URLs, i18n namespaces, and data semantics were intentionally preserved.

| Area | Resolution |
| --- | --- |
| Standard UI local alias surface | The touched standard UI modules now use neutral local/default-export names such as `TreeEntityList`, `LinkedCollectionList`, `ValueGroupList`, `OptionListList`, and `treeEntityActions` instead of the residual `HubList` / `CatalogList` / `SetList` / `EnumerationList` / `hubActions` seam. |
| Focused test wording | `actionsFactories.test.ts` now describes the touched standard UI action surfaces as `TreeEntityActions`, `LinkedCollectionActions`, and `OptionListActions`, matching the neutral local contract instead of the removed alias names. |
| Validation | Focused Vitest passed for `src/domains/metahubs/ui/__tests__/actionsFactories.test.ts` (`1` file / `8` tests), `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Frontend Entity Authoring Route Builder Neutralization

Closed the next entity-first frontend cleanup slice by removing the remaining business-named authoring-path builder contract from the active metahubs frontend runtime. This pass stopped at the symbol/helper ownership boundary: shared route-builder exports and local helper names were neutralized, while the emitted URL strings and mounted backend transport shape were intentionally left unchanged.

| Area | Resolution |
| --- | --- |
| Shared route-builder contract | `entityMetadataRoutePaths.ts` now exports `buildTreeEntityAuthoringPath`, `buildLinkedCollectionAuthoringPath`, `buildValueGroupAuthoringPath`, `buildOptionListAuthoringPath`, plus `TreeEntityAuthoringTab` / `LinkedCollectionAuthoringTab`, instead of the old Hub/Catalog/Set/Enumeration builder contract. |
| Consumer retargeting | The touched standard-runtime lists/actions, metadata screens, layout/detail navigation, blocking-delete dialogs, and the shared route-path test were retargeted to the neutral builder names without changing the emitted URL strings. |
| Local helper cleanup | The touched standard and metadata API files now use neutral linked-collection / value-group / option-list / tree-entity / collection / container helper identifiers instead of the stale Catalog/Set/Enumeration/Hub helper names where the file already proved a safe rename. |
| Validation | `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for `entityMetadataRoutePaths.test.ts`, `TreeDeleteDialog.test.tsx`, `ValueGroupDeleteDialog.test.tsx`, `OptionListDeleteDialog.test.tsx`, `FieldDefinitionList.systemTab.test.tsx`, `RecordList.settingsContinuity.test.tsx`, and `RecordList.createErrorFlow.test.tsx` (`7` files / `14` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Standard Runtime API Helper Neutralization

Closed the next entity-first frontend runtime cleanup slice by removing another live layer of business-named API helper exports from the entity-owned standard runtime. This pass stopped at the API-helper surface: exported helper/type names were neutralized, while the existing HTTP path shapes and backend payload semantics were intentionally left unchanged because they remain the transport truth for now.

| Area | Resolution |
| --- | --- |
| Standard runtime API helper contract | The touched `entities/standard/api/**` files now export neutral linked-collection / value-group / option-list / option-value helper names and type aliases instead of `createCatalog*`, `getSet*`, `listAllEnumerations`, `createEnumerationValue`, and the matching old API type names. |
| Downstream runtime/test consumers | The touched hooks, list-data helpers, metadata consumers, blocking-delete dialogs, and focused tests/mock seams were retargeted to the neutral API helper surface without changing the live HTTP path contract. |
| Validation | `pnpm --filter @universo/metahubs-frontend build` passed clean, focused Vitest passed for `optimisticMutations.remaining.test.tsx`, `SelectableOptionList.optimisticUpdate.test.tsx`, `ValueGroupDeleteDialog.test.tsx`, `OptionListDeleteDialog.test.tsx`, `FieldDefinitionList.systemTab.test.tsx`, `RecordList.settingsContinuity.test.tsx`, and `RecordList.createErrorFlow.test.tsx` (`7` files / `24` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Standard Runtime Mutation Contract Neutralization

Closed the next entity-first frontend runtime cleanup slice by removing another live layer of business-named hook, form, and action contracts from the entity-owned standard runtime. This pass intentionally stopped at the runtime contract boundary: the exported mutation/type/form/action names were neutralized, while API path shapes and durable kind semantics were left unchanged because they remain the backend/data truth for now.

| Area | Resolution |
| --- | --- |
| Standard runtime hook/type contract | The touched `entities/standard/**` hook and type seams now expose `useCreateLinkedCollection`, `useCreateValueGroup`, `useCreateOptionList`, `useCreateOptionValue`, the matching update/delete/copy/reorder hooks, and the corresponding neutral `Create*` / `Update*` / `Delete*` / `Copy*` / `Reorder*` parameter types instead of the old `Catalog` / `Set` / `Enumeration` contract names. |
| Standard runtime form/action surface | `LinkedCollectionActions.tsx`, `ValueGroupActions.tsx`, `OptionListActions.tsx`, the three standard list views, and the touched metadata consumers now use neutral linked-collection / value-group / option-list / option-value form, context, and action identifiers instead of `CatalogFormValues`, `SetActionContext`, `validateEnumerationForm`, and similar seams. |
| Validation | `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for `optimisticMutations.remaining.test.tsx`, `SettingsOriginTabs.test.tsx`, `actionsFactories.test.ts`, `FieldDefinitionList.systemTab.test.tsx`, `RecordList.settingsContinuity.test.tsx`, `RecordList.createErrorFlow.test.tsx`, and `SelectableOptionList.optimisticUpdate.test.tsx` (`7` files / `32` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Container Vocabulary And Shared Runtime Neutralization

Closed the next entity-first frontend cleanup slice by removing another live layer of business-owned runtime wording from the shared panels, shared/common page shell, and local entity-owned child-resource helpers. This pass intentionally kept persistence keys and live route shapes stable where they remain the backend/API truth, while still neutralizing the active UI/runtime contract that users and maintainers interact with in source.

| Area | Resolution |
| --- | --- |
| Shared selection-panel contract | `ContainerSelectionPanel.tsx` and `ContainerParentSelectionPanel.tsx` now use neutral container-oriented prop names, and the touched entity-owned consumers were retargeted to that contract without changing the persisted backend config keys that still store `hubs`, `isSingleHub`, and `isRequiredHub`. |
| Shared/common runtime vocabulary | `CommonPage.tsx` now uses the neutral shared tab ids and labels `fieldDefinitions`, `fixedValues`, and `optionValues`, while the touched child-resource API helpers now use neutral collection/container helper names instead of `resolveCatalogKindKey` / `buildHubScopedCatalogPath` wording. |
| Validation | EN/RU metahubs locale entries and the focused CommonPage / EntityInstanceList tests were updated to the new wording, focused Vitest passed for `src/domains/entities/shared/ui/__tests__/CommonPage.test.tsx` and `src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx` (`2` files / `12` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Remaining Named Seam Neutralization

Closed the next entity-first cleanup slice by removing another live layer of business-named runtime ownership seams from both the metahubs backend and frontend. This pass did not change the underlying standard kind data model, but it removed old service/component naming that still made the active codebase look like a preserved catalog/hub/set/enumeration architecture instead of an entity-owned runtime.

| Area | Resolution |
| --- | --- |
| Backend service seams | `MetahubHubsService` and `MetahubEnumerationValuesService` were renamed in active source/tests to `MetahubTreeEntitiesService` and `MetahubOptionValuesService`, and their import graph was retargeted across entity children, publications, guards, controllers, and focused Jest suites. |
| Frontend public component seams | The metahubs frontend component barrel and active consumers now expose `ContainerSelectionPanel`, `ContainerParentSelectionPanel`, `TreeDeleteDialog`, `LinkedCollectionDeleteDialog`, `ValueGroupDeleteDialog`, and `OptionListDeleteDialog` instead of the older kind-specific `Hub*`, `Catalog*`, `Set*`, and `Enumeration*` selection/delete seams. |
| Validation | `pnpm --filter @universo/metahubs-backend build` passed, focused backend Jest passed for `MetahubTreeEntitiesService.test.ts`, `MetahubOptionValuesService.test.ts`, `publicationsRoutes.test.ts`, `publicMetahubsRoutes.test.ts`, and `fieldDefinitionsRoutes.test.ts` (`5` suites / `56` tests), `pnpm --filter @universo/metahubs-frontend build` passed, focused frontend Vitest passed for the renamed delete/entity-instance slices (`5` files / `16` tests), the canonical root `pnpm build` completed green with `30 successful, 30 total`, and a negative grep over `packages/` returned zero matches for the removed service/component seam names. |

## 2026-04-14 Frontend Public Type Contract Neutralization

Closed the next entity-first frontend cleanup slice by removing the old business-named public type/export contract from `@universo/metahubs-frontend`. This pass did not rename end-user UI copy or data kind keys, but it stopped the package from exposing `Hub`, `Catalog`, `MetahubSet`, and `Enumeration` as its active frontend API surface where neutral entity-owned naming was already viable.

| Area | Resolution |
| --- | --- |
| Frontend public type contract | `packages/metahubs-frontend/base/src/types.ts`, `displayConverters.ts`, and the touched runtime consumers now use `TreeEntity`, `LinkedCollectionEntity`, `ValueGroupEntity`, `OptionListEntity`, the corresponding `*Display` / `*LocalizedPayload` types, and neutral converter names instead of the old `Hub` / `Catalog` / `MetahubSet` / `Enumeration` contract. |
| Package export surface | `packages/metahubs-frontend/base/src/index.ts` now re-exports only the neutral frontend type/converter names for this slice, and the touched delete dialogs plus entity standard/runtime views were retargeted to that new contract. |
| Validation | `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for `TreeDeleteDialog.test.tsx`, `ValueGroupDeleteDialog.test.tsx`, `OptionListDeleteDialog.test.tsx`, `EntityInstanceList.test.tsx`, and `TreeList.settingsReopen.test.tsx` (`5` files / `16` tests), a repository grep found no other package importing the removed public type names from `@universo/metahubs-frontend`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Tree Runtime Seam Neutralization

Closed the next frontend entity-first cleanup slice by removing the old tree/hub-oriented runtime ownership seam from the live tree-kind authoring modules. This pass did not rewrite the user-facing `hubs.*` translation namespace or the underlying kind key, but it stopped the active module graph from exposing `useMetahubTrees`, `TreeList`, `TreeActions`, and `useCreateHub` as the shipped runtime contract.

| Area | Resolution |
| --- | --- |
| Tree runtime module ownership | The touched tree-kind runtime files now live behind the neutral tree-entity seam names `useTreeEntities.ts`, `useTreeEntityListData.ts`, `treeEntityMutationTypes.ts`, `treeEntityMutations.ts`, `TreeEntityActions.tsx`, `TreeEntityList.tsx`, and `treeEntityListUtils.ts` instead of the removed `useMetahubTrees.ts`, `useTreeListData.ts`, `treeMutationTypes.ts`, `treeMutations.ts`, `TreeActions.tsx`, `TreeList.tsx`, and `treeListUtils.ts` names. |
| Hook/action/type contract | Active source now uses `useCreateTreeEntity`, `useUpdateTreeEntity`, `useDeleteTreeEntity`, `useCopyTreeEntity`, `useReorderTreeEntity`, `CreateTreeEntityParams`, `TreeEntityCopyInput`, `TreeEntityFormValues`, `TreeEntityMenuBaseContext`, `TreeEntityActionContext`, `buildTreeEntityInitialValues`, `buildTreeEntityFormTabs`, `validateTreeEntityForm`, `canSaveTreeEntityForm`, and `toTreeEntityPayload` across the touched runtime/test consumers. |
| Validation | `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for `TreeEntityList.settingsReopen.test.tsx`, `EntityInstanceList.test.tsx`, `actionsFactories.test.ts`, `copyOptionPayloads.test.tsx`, `FieldDefinitionList.systemTab.test.tsx`, `RecordList.createErrorFlow.test.tsx`, and `SelectableOptionList.optimisticUpdate.test.tsx` (`7` files / `32` tests), a negative grep over `packages/metahubs-frontend/base/src` returned zero matches for the removed tree/hub module identifiers, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Entity-First Stale Contract Cleanup

Closed the next reconciliation slice in the entity-first migration by removing the remaining stale V2/document truth-surface markers from active tests/specs, aligning the schema-ddl expectation with the shipped entity-first runtime contract, and rerunning the canonical workspace build after the cleanup. This pass intentionally did not declare final zero-debt closure; it eliminated a real residue layer and refreshed proof so the remaining open work is now narrower and more explicit.

| Area | Resolution |
| --- | --- |
| Active truth-surface cleanup | The touched backend, applications-backend, schema-ddl, and Playwright specs no longer preserve `custom.catalog-v2`, `custom.set-v2`, `custom.hub-v2`, `custom.enumeration-v2`, or metahub-specific `custom.document-*` assumptions in their active test/spec data. |
| Product correctness follow-up | `MetahubScriptsService.resolveAttachmentObjectKinds()` now deduplicates the returned compatible kind list, so direct `catalog` plus catalog-compatible custom kinds no longer produce repeated attachment-kind entries in the active script surface. |
| Schema-DDL contract | `SchemaGenerator.test.ts` now locks the current entity-first behavior: only direct standard `hub|set|enumeration` kinds are skipped as non-physical, while custom kinds with `compatibility.legacyObjectKind` hints still generate physical tables. |
| Validation | Focused Jest passed for the touched metahubs-backend and applications-backend suites, `pnpm --filter @universo/schema-ddl exec jest --config ./jest.config.js src/__tests__/SchemaGenerator.test.ts` passed (`43` tests), the stale-marker grep over active `packages/` + `tools/` returned zero matches for the removed `custom.*-v2` / `custom.document-*` markers, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Backend Neutral Service Vocabulary Cutover

Closed the in-progress backend neutral-service rename slice by finishing the active source/test object-name cutover, cleaning the most visible stale helper/doc wording, and revalidating both the package and canonical workspace build. This pass did not change the shipped HTTP or persistence contracts, but it removed the mixed service vocabulary that was left behind after the file/class rename step.

| Area | Resolution |
| --- | --- |
| Active backend service ownership naming | Factories, controllers, serializers, adapters, and the touched route/service tests now use `fieldDefinitionsService`, `fixedValuesService`, and `recordsService` instead of the transitional `attributesService`, `constantsService`, and `elementsService` object names. The renamed `MetahubRecordsService` also now exposes the internal record-oriented helper names `moveRecord`, `reorderRecord`, `validateRecordData`, and `mapRowToRecord` instead of keeping mixed `*Element*` names behind the renamed class. |
| Helper/doc wording | `designTimeObjectChildrenCopy.ts` now exposes a fixed-values service adapter seam for constant copying, and the renamed service docblocks now describe design-time field definitions and records while still acknowledging the underlying historical table names where that persistence detail matters. |
| Validation | `pnpm --filter @universo/metahubs-backend build` passed twice during stabilization, focused backend Jest passed for `MetahubFieldDefinitionsService.test.ts`, `MetahubFixedValuesService.test.ts`, `entityInstancesRoutes.test.ts`, `recordsRoutes.test.ts`, `publicationsRoutes.test.ts`, `publicMetahubsRoutes.test.ts`, and `loadPublishedPublicationRuntimeSource.test.ts` (`7` suites / `81` tests), the final focused `recordsRoutes.test.ts` rerun passed (`4` tests) after the internal record-method rename, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Frontend Shared Vocabulary And Metadata Ownership Stabilization

## 2026-04-14 Backend Generic Object Mutation And Route Wiring Cleanup

## 2026-04-14 Entity-Owned Route Inventory And Residual Wording Cleanup

Closed the next entity-first cleanup slice by fixing the active OpenAPI source inventory to point at the current entity-owned backend route files and by removing the last stale `managed` wording from the touched backend/frontend/doc surfaces. This pass did not change the shipped HTTP contract, but it removed real stale references that would otherwise keep generated docs and user-facing copy behind the live architecture.

| Area | Resolution |
| --- | --- |
| OpenAPI source inventory | `packages/universo-rest-docs/scripts/generate-openapi-source.js` now points at `domains/entities/metadata/fieldDefinition|fixedValue|record/routes.ts` instead of the deleted top-level `domains/attributes|constants|elements/routes/*.ts` files, and `pnpm --filter @universo/rest-docs build` regenerated the bundled OpenAPI spec after `verify:route-sources` passed. |
| Backend/frontend wording | `EntityTypeService.ts` now says standard kind keys are reserved for platform-provided entity types, `FieldDefinitionList.tsx` now describes system attributes as provided by the platform, and `EntitiesWorkspace.tsx` now describes the generated table prefix as a physical table name. |
| Documentation sync | `packages/metahubs-backend/base/README.md` and `README-RU.md` were updated together so the direct-standard-kind contract no longer describes `managed metadata requests`, and both localized files still match at `129` lines. |
| Validation | Focused Jest passed for `src/tests/services/EntityTypeService.test.ts` (`10` tests), focused Vitest passed for `FieldDefinitionList.systemTab.test.tsx` (`4` tests), `pnpm --filter @universo/rest-docs build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Backend Generic Object Mutation And Route Wiring Cleanup

Closed the next backend cleanup slice by deleting the remaining business-named object mutation wrappers from `MetahubObjectsService`, removing the extra child-controller registry from `entityInstancesRoutes.ts`, and revalidating the touched package plus the canonical workspace build. This pass keeps the entity-owned backend surface simpler and more transaction-safe without changing the shipped HTTP contract.

| Area | Resolution |
| --- | --- |
| Generic object mutation contract | `packages/metahubs-backend/base/src/domains/metahubs/services/MetahubObjectsService.ts` now exposes only `createObject` and `updateObject` for `_mhb_objects`; the deleted `createCatalog`, `createEnumeration`, `createSet`, `updateCatalog`, `updateEnumeration`, and `updateSet` wrappers no longer preserve business-named service ownership. |
| Entity route wiring | `packages/metahubs-backend/base/src/domains/entities/routes/entityInstancesRoutes.ts` now instantiates the four child controllers directly, and the deleted `domains/entities/children/controllerRegistry.ts` file no longer sits between the route surface and the actual controller factories. |
| Transaction correctness | The touched catalog-compatible create/update/copy/detach flows in `linkedCollectionController.ts` now use the generic object mutations directly, so the update path no longer splits the catalog branch away from an explicitly passed transaction runner. |
| Validation | `pnpm --filter @universo/metahubs-backend build` passed, focused Jest passed for `src/tests/services/MetahubObjectsService.test.ts` (`9` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Frontend Shared Vocabulary And Metadata Ownership Stabilization

Closed the next frontend entity-first cleanup slice by finishing the local shared-vocabulary rename, deleting the remaining parallel legacy metadata source trees, and removing the last dead `kinds/EnumerationValueList` duplicate. This pass turned the earlier folder rename into the actual active local contract rather than keeping backward-compat aliases and orphan source copies in the shipped tree.

| Area | Resolution |
| --- | --- |
| Shared vocabulary contract | Active metahubs-frontend consumers now use `toFieldDefinitionDisplay`, `toFixedValueDisplay`, `toRecordItemDisplay`, and `toOptionValueDisplay`, while `src/types.ts` and `src/index.ts` no longer re-export `Attribute`, `Constant`, `HubElement`, `EnumerationValue`, or the old converter aliases as canonical local surface. |
| Metadata folder ownership | `packages/metahubs-frontend/base/src/domains/entities/metadata` now contains only `fieldDefinition`, `fixedValue`, `optionValue`, and `record`; the orphan `attribute`, `constant`, and `element` source copies were deleted and the empty directories were removed. |
| Residual duplicate cleanup | The final `packages/metahubs-frontend/base/src/domains/entities/kinds/ui/EnumerationValueList.tsx` duplicate and its stale focused test were removed, leaving the active option-list runtime and tests under the neutral `standard/ui/SelectableOptionList` surface. |
| Validation | `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for `types.test.ts`, `FieldDefinitionList.systemTab.test.tsx`, `RecordList.settingsContinuity.test.tsx`, `RecordList.createErrorFlow.test.tsx`, and `SelectableOptionList.optimisticUpdate.test.tsx`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Final Legacy Seam Removal

## 2026-04-14 Standard Entity Route And Export Neutralization

Closed the next frontend-neutralization slice by removing the remaining public per-kind page contract from the metahubs package and replacing it with one generic standard-entity route/export surface. This pass also collapsed the short-lived `domains/entities/kinds/**` seam back into the stricter `domains/entities/standard/**` subtree so the route/export contract no longer advertises business-named page ownership.

| Area | Resolution |
| --- | --- |
| Generic standard route surface | `packages/metahubs-frontend/base/src/domains/entities/ui/StandardEntityCollectionPage.tsx` now renders standard metadata views through one generic page entrypoint for both direct `:kindKey/instances` routes and nested child-collection routes. |
| Public package contract | `@universo/metahubs-frontend` now exports `StandardEntityCollectionPage` and `StandardEntityChildCollectionPage` instead of the removed `HubEntityInstanceView`, `CatalogEntityInstanceView`, `SetEntityInstanceView`, and `EnumerationEntityInstanceView` page exports. |
| Core route tree | `packages/universo-core-frontend/base/src/routes/MainRoutes.tsx` now lazy-loads the generic child-collection page once and passes `childKind` props instead of wiring four separate per-kind page modules. |
| Folder-name cleanup | The temporary `packages/metahubs-frontend/base/src/domains/entities/kinds/**` subtree was renamed back to `domains/entities/standard/**`, and touched imports/tests/README surfaces were retargeted accordingly. |
| Validation | `pnpm --filter @universo/metahubs-frontend build` passed, focused metahubs-frontend Vitest passed for `exports.test.ts` and `EntityInstanceList.test.tsx` (`14` tests total), and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Backend Entity Metadata Route Ownership Cutover

Closed the next backend-only legacy-elimination slice by moving the remaining child-resource metadata route/controller ownership under `domains/entities/**`, deleting the now-obsolete top-level metadata/standard-kind backend folders, and locking the new entity-owned route contract with focused backend validation plus a full workspace build.

| Area | Resolution |
| --- | --- |
| Backend folder ownership | The active attribute, constant, and element controllers/routes now live under `packages/metahubs-backend/base/src/domains/entities/metadata/{attribute,constant,element}/**`; the old top-level `domains/attributes`, `domains/constants`, and `domains/elements` folders were removed after the move stabilized. |
| Legacy backend folder deletion | The leftover top-level backend controller ownership for `catalogs`, `sets`, and `enumerations` was deleted, and the empty `domains/attributes|catalogs|constants|elements|enumerations|sets` directories were physically removed from the source tree. |
| Entity-owned route contract | `createMetahubsServiceRoutes()` and the backend package entrypoint now mount/export the entity-owned metadata route factories, and those routes accept only entity-owned URL shapes instead of the removed legacy catalog/set/hub authoring paths. |
| Validation | `pnpm --filter @universo/metahubs-backend build` passed, focused Jest passed for `attributesRoutes`, `constantsRoutes`, and `elementsRoutes` (`39` tests total), and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Neutral Kinds Runtime Cutover Closure

Closed the deeper frontend cleanup slice that followed the top-level metadata/common deletions. This pass removed the last live `domains/entities/standard/**` ownership subtree from the shipped metahubs frontend runtime by relocating its real standard-kind logic into a neutral entity-owned `domains/entities/kinds/**` layout, repairing the post-move import graph, and revalidating the touched frontend and workspace builds.

| Area | Resolution |
| --- | --- |
| Residual legacy frontend folders | The still-live top-level runtime files under `domains/attributes`, `domains/constants`, `domains/elements`, and `domains/general` were physically deleted once their entity-owned replacements were already in place. |
| Neutral entity-owned runtime layout | The surviving standard-kind APIs, hooks, actions, list views, and focused tests were moved into `packages/metahubs-frontend/base/src/domains/entities/kinds/{api,hooks,ui}/**`, touched consumers were retargeted to the new direct module paths, and the empty legacy `domains/entities/standard/**` folder tree was removed afterward. |
| Validation | `pnpm --filter @universo/metahubs-frontend build` passed after the move, the touched focused metahubs-frontend Vitest slices reran clean after one stale moved mock target was repaired, and the canonical root `pnpm build` completed green. |

## 2026-04-14 Standard Subtree Barrel Cleanup Closure

Closed the safe cleanup follow-up inside the remaining `domains/entities/standard/**` subtree after the top-level metadata/common folders were deleted. This pass did not pretend the remaining kind-specific runtime folders were dead; instead it removed only the proven barrel seams, retargeted the touched consumers to direct modules, and reran focused plus workspace validation.

| Area | Resolution |
| --- | --- |
| Dead seam removal | The `index.ts`, `api/index.ts`, and `hooks/index.ts` barrel files under `standard/catalog`, `standard/hub`, `standard/set`, and `standard/enumeration` were deleted, so the surviving standard subtree no longer preserves those extra wrapper entry points. |
| Consumer retargeting | Delete dialogs, entity-instance consumers, metadata hooks, and the touched focused tests now import direct files such as `api/catalogs.ts`, `api/hubs.ts`, `api/sets.ts`, `api/enumerations.ts`, and `hooks/useMetahubTrees.ts` instead of the removed barrel paths. |
| Validation and remaining scope | Focused `@universo/metahubs-frontend` Vitest passed for the touched slices (`7` files / `34` tests), `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. The surviving `standard/**` folders were intentionally left in place because the audit confirmed they still contain real runtime behavior and therefore need a separate architectural rewrite if they are to be removed entirely. |

## 2026-04-14 Frontend Top-Level Metadata And Common Folder Deletion Closure

Closed the frontend cleanup slice that still left legacy metadata/common ownership visible in the metahubs frontend domain tree after the earlier entity-owned cutovers. This pass physically removed the shipped top-level `attributes`, `constants`, `elements`, and `general` folders from `packages/metahubs-frontend/base/src/domains`, moved the real code to entity-owned locations, repaired the touched tests/config, and revalidated both the package and workspace builds.

| Area | Resolution |
| --- | --- |
| Frontend domain ownership | The real metadata/common implementations now live under `packages/metahubs-frontend/base/src/domains/entities/metadata/*` and `packages/metahubs-frontend/base/src/domains/entities/shared/*`; the top-level wrapper files and the empty `domains/attributes`, `domains/constants`, `domains/elements`, and `domains/general` folders were deleted from the shipped tree. |
| Test/config alignment | `CommonPage.test.tsx`, `optimisticMutations.remaining.test.tsx`, and the touched element-list tests were retargeted to the moved entity-owned modules, while `vitest.config.ts` coverage excludes were updated to the new entity-owned metadata paths and repaired after the folder move. |
| Validation | Focused `@universo/metahubs-frontend` Vitest passed for the moved metadata/common surfaces (`4` files / `17` tests), `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

Closed the QA-reopened seam-removal pass that still left the branch architecturally mixed after earlier entity-first work. This pass removed the remaining top-level backend standard-kind domain ownership from production imports, removed the frontend workspace rule that still treated direct standard kinds as system-managed, and revalidated the touched backend/frontend packages before rerunning the canonical root build.

| Area | Resolution |
| --- | --- |
| Backend entity-owned ownership | Standard-kind child controllers/services now live under `packages/metahubs-backend/base/src/domains/entities/children/**`, the stale top-level `domains/hubs`, `domains/catalogs`, `domains/sets`, and `domains/enumerations` route/domain files were removed, and `entityInstancesController.ts` now resolves compatibility helpers from the new entity-owned backend paths. |
| Frontend authoring contract | `EntitiesWorkspace.tsx` no longer marks direct standard kinds as system-managed, so direct standard kinds now keep the same instances/edit/copy affordances as other entity types. Shared common/enumeration-value entry points and shared catalog authoring links were also retargeted to entity-owned wrapper/helper paths under `domains/entities/**` and `domains/shared/**`. |
| Validation | `pnpm --filter @universo/metahubs-backend build` passed, focused backend Jest passed (`2` suites / `36` tests), `pnpm --filter @universo/metahubs-frontend build` passed, focused frontend Vitest passed (`6` files / `18` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Neutral Entity-Surface And Shared-Term Cleanup Wave

## 2026-04-14 Remaining Legacy Ownership Cutover

Closed the next safe implementation slice in the entity-first migration by removing the last active legacy ownership markers from the touched backend/frontend source graph rather than only documenting them away. This pass kept the shipped HTTP/UI contract stable while cutting the remaining live imports over to entity-owned entry points and proving the change with focused package validation plus the canonical root build.

| Area | Resolution |
| --- | --- |
| Backend ownership cleanup | `legacyBuiltinObjectCompatibility.ts` was replaced in active source/tests by `entityDeletePatterns.ts`, and `entityInstancesRoutes.ts` now reaches standard child controller factories through `standardEntityChildrenControllers.ts` instead of importing the legacy per-domain controller modules directly. |
| Frontend ownership cleanup | The touched public metadata/common entry points now flow through `domains/entities/metadata/*` and `domains/entities/shared/*` wrapper modules, and the touched production consumers no longer import top-level `attributes`, `constants`, `elements`, or `general` modules directly. |
| Validation | Focused `@universo/metahubs-backend` Jest passed (`2` suites / `36` tests), focused `@universo/metahubs-frontend` Vitest passed (`6` files / `21` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`. |

## 2026-04-14 Post-Compression Test Mock Repair And Validation

Closed the continuation pass that followed context compression by rechecking the live working tree instead of relying on the earlier summary, isolating the only remaining regressions to two focused frontend tests that still mocked deleted pre-move module paths. Runtime code did not require another production fix in this pass; the real work was bringing the focused validation harness back into line with the moved standard-entity folders and the newer import graph.

| Area | Resolution |
| --- | --- |
| Live-tree audit | A fresh `@universo/metahubs-frontend` build confirmed the current production tree was already green, so the continuation-pass blockers were narrowed to test-only regressions instead of hidden runtime breakage. |
| Focused test repair | `OptionValueList.optimisticUpdate.test.tsx` and `TreeList.settingsReopen.test.tsx` now mock the current settings/shared/root modules and the import-time factories required after the `domains/entities/standard/*` move, replacing stale pre-move mock paths. |
| Validation | The focused metahubs-frontend matrix passed with `12` files / `83` tests, and the canonical root `pnpm build` completed green afterward with `30 successful, 30 total`. |

## 2026-04-14 Entity-Owned Child-Resource Contract And Browser Truth Cutover

Closed the QA-reopened route-contract tail for the entity-first migration by moving the last shipped child-resource frontend APIs onto entity-owned URLs and by rewriting the touched Playwright truth surfaces to stop treating the removed top-level authoring routes as product truth. This slice intentionally did not rewrite the remaining specialized backend controller composition, because the metahubs-backend package README documents that entity-owned top-level routes may reuse those specialized controllers underneath.

| Area | Resolution |
| --- | --- |
| Frontend child-resource APIs | `packages/metahubs-frontend/base/src/domains/attributes/api/attributes.ts`, `packages/metahubs-frontend/base/src/domains/constants/api/constants.ts`, and `packages/metahubs-frontend/base/src/domains/elements/api/elements.ts` now build canonical entity-owned URLs instead of legacy `/hub/...`, `/catalog/...`, `/set/...`, or `/enumeration/...` authoring paths. |
| Browser truth surfaces | The touched Playwright flows and generator now navigate through `/metahub/:id/entities/hub|catalog|set|enumeration/instances` and assert the matching entity-owned API endpoints rather than the removed top-level authoring routes. |
| Backend seam assessment | The reopened concern about specialized controller reuse inside `entityInstancesRoutes.ts` was resolved as documented internal composition: the metahubs-backend package contract explicitly allows entity-owned top-level routes to reuse specialized managed controllers underneath. |
| Validation | Targeted `@universo/metahubs-frontend` builds passed before and after lint auto-fix, targeted eslint on the changed files reduced to non-blocking pre-existing `no-console` warnings in the generator spec, and the canonical root `pnpm build` completed green after the route-contract cutover. |

Closed the next safe implementation wave inside the entity-first final migration by removing the most visible transitional managed seams from the shipped frontend contract and by normalizing part of the backend/schema/type naming surface. This pass intentionally stopped short of claiming final zero-debt closure because the repo-wide managed-term audit still shows additional untouched source modules outside this validated slice.

| Area | Resolution |
| --- | --- |
| Frontend entity-owned standard surfaces | The top-level metahubs frontend `domains/managedCatalogs`, `domains/managedHubs`, `domains/managedSets`, and `domains/managedEnumerations` folders were moved under `domains/entities/standard/*`, and the entity-owned wrapper seam was renamed from `ManagedStandardKindSurfaces` to `StandardEntityInstanceViews`. |
| Public export and route contract | `@universo/metahubs-frontend` now exports `HubEntityInstanceView`, `CatalogEntityInstanceView`, `SetEntityInstanceView`, and `EnumerationEntityInstanceView`, while `@universo/core-frontend` lazy routes and `@universo/template-mui` external-module typings were updated to the same neutral contract. |
| Shared/backend naming cleanup | Shared route helpers were renamed from `managedMetadataRoutePaths` to `entityMetadataRoutePaths`, the backend `isBuiltinMetahubObjectKind` helper was removed in favor of a type-safe optimistic-lock entity-type resolver, and part of the schema-ddl/backend/types managed terminology was renamed to neutral `standard*` / `entityMetadata*` / `buildEntitySettingKey` variants. |
| Tests, docs, and validation | Focused metahubs frontend truth surfaces were updated, EN/RU metahubs frontend READMEs now match the new public surface names while preserving exact line-count parity, touched package builds passed for `@universo/metahubs-backend`, `@universo/metahubs-frontend`, `@universo/template-mui`, and `@universo/core-frontend`, and the canonical root build task completed without surfacing a new touched-path failure. |

## 2026-04-14 Neutral Terminology Audit Closure

Closed the follow-up cleanup pass for the same migration slice by removing the remaining transition-only `managed*` names from active backend/frontend/schema/docs truth surfaces and then rerunning the canonical build and parity checks. This converts the earlier “validated slice with residual naming tail” state into a closed implementation slice whose remaining repository grep hits are intentional domain or external API terminology rather than migration debt.

| Area | Resolution |
| --- | --- |
| Backend/schema/type neutral pass | Entity metadata helpers, route-dispatch locals, publication serializer locals, schema naming wrappers, and application schema validation helpers now use neutral entity-oriented terminology instead of transitional `managed*` seam names. |
| Frontend/source truth cleanup | Query-key helpers, entity workspace/list internals, standard-kind API helper aliases, exported comments, and focused test descriptions now align to the entity-owned/standard metadata contract instead of the old managed seam vocabulary. |
| Documentation parity | The touched EN/RU architecture and custom-entity guide pages were updated in sync to describe standard metadata/entity-owned surfaces, and both locale pairs still match exactly by line count. |
| Audit and validation | Targeted source grep no longer finds the removed transitional seam symbols in active `src` surfaces, file diagnostics stayed clean, and the canonical root `pnpm build` completed after the follow-up pass to refresh generated artifacts. |

## 2026-04-14 OpenAPI, Breadcrumb, And Managed-Surface Contract Cleanup

Closed the remaining code-level QA remediation slice for the legacy-removal and entity-promotion wave. This pass synchronized the generated OpenAPI inventory with the mounted metahub router, removed the last shipped create-via-edit permission coupling, rewired `NavbarBreadcrumbs` away from legacy metadata URLs, and finished the internal frontend folder migration away from the old managed-standard-kind domain names.

| Area | Resolution |
| --- | --- |
| Mounted router vs OpenAPI truth | `@universo/rest-docs` now verifies metahub `routeSources` against the live mounted router before generate/build/validate, the generated spec no longer publishes removed top-level hubs/catalogs/sets/enumerations routes as current truth, and the touched EN/RU package READMEs now describe the canonical entity-owned route inventory. |
| Breadcrumb and shell navigation | `NavbarBreadcrumbs` now converts the remaining legacy-shaped metadata paths to entity-owned href targets, a focused Jest suite asserts breadcrumb link destinations instead of only labels, and the touched workspace browser spec now asserts canonical entity-owned breadcrumb hrefs for managed catalog-compatible instances. |
| Managed create RBAC contract | Managed entity creation now checks `createContent` while edit/copy keep `editContent` and delete keeps `deleteContent`, and the generic entity route tests now lock the declared permission model instead of preserving create-via-edit parity debt. |
| Frontend managed-surface ownership | The shipped metahubs frontend package no longer uses the old `domains/catalogs`, `domains/hubs`, `domains/sets`, or `domains/enumerations` runtime folders; those modules now live under `managedCatalogs`, `managedHubs`, `managedSets`, and `managedEnumerations`, with imports/tests/configuration updated accordingly. |
| Validation | `@universo/rest-docs validate` passed, focused `@universo/template-mui` Jest passed for the new breadcrumb href suite, focused `@universo/metahubs-frontend` Vitest passed for exports/managed surfaces/delete dialogs/route helpers, focused `entityInstancesRoutes` Jest passed, and the canonical root `pnpm build` completed green in 3m50.856s on 2026-04-14. A fresh browser rerun was attempted through both the supported harness and a manual warm-server fallback, but the server still failed to reach `/api/v1/ping` readiness before the touched specs could start, so final browser revalidation remains blocked on cold-start readiness rather than on a product assertion failure. |

## 2026-04-13 Residual Seam Cleanup Closure

Closed the last QA-reopened residual seam slice for the legacy-removal and entity-promotion wave. This pass removed the last legacy metahubs frontend package exports, neutralized the entity-type service/controller contract, replaced schema-ddl/runtime compatibility-era helper naming with direct standard-kind terminology, and reran the focused validation/build matrix until the branch was green again.

| Area | Resolution |
| --- | --- |
| Frontend public API cleanup | `@universo/metahubs-frontend` no longer exports legacy `HubList` / `CatalogList` / `SetList` / `EnumerationList` entry points, `MainRoutes.tsx` no longer lazy-loads those stale exports, and the metahubs entry/export typing tests now lock the managed entity surfaces as the public contract. |
| Neutral entity-type contract | `EntityTypeService` and `entityTypesController` now use neutral `getTypeById` / `listTypes` / `createType` / `updateType` / `deleteType` naming for DB-backed entity types, while filtered editable-only access stays explicit through `listEditableTypes*` helpers. |
| Schema/runtime helper cleanup | `packages/schema-ddl/base/src/managedStandardKinds.ts` replaced the deleted `legacyCompatibleKinds.ts`, schema-ddl/runtime helper names now describe direct standard kinds, and stale compatibility-oriented tests were updated to the shipped direct-kind behavior instead of preserving removed transitional aliases. |
| Validation | Focused metahubs-frontend Vitest passed, the targeted metahubs-backend Jest matrix passed with 175 assertions across 12 suites, touched package builds passed for schema-ddl/applications-backend/metahubs-backend/metahubs-frontend/template-mui/core-frontend, and the canonical root `pnpm build` completed green on 2026-04-13. |

## 2026-04-13 Request-Scoped RLS Executor And Browser Proof Closure

Closed the last active regression tail in the legacy-removal acceptance wave. This pass stabilized the pinned-connection RLS executor used by authenticated request middleware, removed the remaining stale E2E support reads that still targeted legacy managed-kind child routes, and reran the previously red browser flows until the shipped entity-owned contract passed again end to end.

| Area | Resolution |
| --- | --- |
| Request-scoped RLS transaction lifecycle | `createRlsExecutor(...)` now scopes transaction depth lexically instead of mutating one shared depth counter, middleware-owned request transactions are reused directly without reopening top-level savepoints, and explicit nested transaction calls still retain savepoint protection when intentionally invoked under that outer request transaction. |
| Browser support contract | The Playwright backend session helpers for managed catalog attributes, set constants, and enumeration values now read through the unified entity-owned API paths, eliminating the last stale legacy reads that were returning HTML payloads after successful managed-entity mutations. |
| Validation | Focused `@universo/database` Jest passed, focused `@universo/auth-backend` middleware Jest passed, the canonical root `pnpm build` stayed green, `metahub-entity-dialog-regressions.spec.ts` passed, and `metahub-settings.spec.ts` passed including the entity-scoped managed metadata tabs. |

## 2026-04-13 Managed Settings Namespace And Delete-Dialog Closure

Closed the last QA-reported follow-up slice inside the legacy-removal acceptance wave. This pass repaired the managed delete-dialog blocker links on unified entity routes, removed the remaining shipped `hubs/catalogs/sets/enumerations.*` settings namespace contract in favor of `entity.<kind>.*`, and aligned the direct standard-kind backend/frontend tests with the final entity-owned model.

| Area | Resolution |
| --- | --- |
| Delete-dialog blocker routing | `SetDeleteDialog` and `EnumerationDeleteDialog` now resolve blocking catalog links through the catalog kind even when the current authoring route is `set` or `enumeration`, and focused frontend tests lock that entity-route regression. |
| Managed settings namespace | Shared metahub settings definitions, backend policy checks, frontend settings hooks/pages, localized labels, and the self-hosted snapshot fixture now use `entity.hub|catalog|set|enumeration.*` keys instead of plural legacy prefixes. |
| Direct standard-kind validation | Focused backend route suites were updated to the final direct-kind contract so generic entity routes accept standard kinds without restoring removed `custom.*-v2` compatibility assumptions. |
| Validation | Focused metahubs-frontend dialog Vitest passed, focused metahubs-backend route Jest passed, and the canonical root `pnpm build` completed green in 4m30.618s on 2026-04-13. |

## 2026-04-13 Standard-Kind Contract Cleanup And Validation Sync

## 2026-04-13 Final Entity-Only Closure Wave

Closed the final follow-up implementation tail that QA had reopened on 2026-04-13. This pass removed the last shipped backend compatibility helper layer, migrated the remaining shared/frontend managed-kind consumers onto the generic entity API, and converted metahub board summary to an entity-owned count map so the delivered contract no longer depends on fixed hub/catalog aggregates.

| Area | Resolution |
| --- | --- |
| Backend compatibility seam removal | A new `managedMetadataKinds` helper now owns direct standard-kind resolution, entity routes/controllers no longer infer managed behavior through the deleted backend `legacyCompatibility.ts` module, and the old backend compatibility test was retired with that dead file. |
| Entity-owned count contract | `metahubsController` now groups `_mhb_objects` by `kind` and returns `entityCounts`, while list surfaces derive any remaining legacy display counters from that neutral map instead of compatibility-expanded SQL filters. |
| Shared frontend genericization | `TargetEntitySelector`, `MenuWidgetEditorDialog`, `SharedEntitySettingsFields`, `EntityInstanceList`, and `NavbarBreadcrumbs` now resolve managed standard kinds through direct standard kind keys and `listEntityInstances(...)` rather than separate catalogs/sets/enumerations fetch paths or compatibility fallbacks. |
| Validation | Focused `metahubBoardSummary` Jest passed, focused metahubs-frontend Vitest slices passed for the updated board and entity-owned UI contracts, and the canonical root `pnpm build` completed green in 49.68s. |

## 2026-04-13 Standard-Kind Contract Cleanup And Validation Sync

Closed the next implementation follow-up by removing the remaining hardcoded builtin/custom V2 assumptions from the shared type system, dynamic shell navigation, self-hosted fixture flow, and the touched runtime/browser proofs. The compressed memory-bank state is now synchronized with the validated branch state instead of leaving this cleanup wave recorded only in transient chat context.

| Area | Resolution |
| --- | --- |
| Shared type contract | `@universo/types` now treats `catalog`, `hub`, `set`, and `enumeration` as the direct standard metahub kinds, removes the builtin registry/source-style contract from the shipped type surface, and keeps kind-dependent behavior on the DB-backed entity definition plus component manifest path. |
| Shared shell and navigation | Dynamic menu and breadcrumb consumers no longer depend on `includeBuiltins`, `source`, or legacy `custom.*-v2` remapping; they resolve labels and ordering from the unified entity-type metadata for both standard and custom kinds. |
| Fixtures and browser/runtime proof | The self-hosted generator, committed fixture, snapshot import/export coverage, and touched runtime/browser flows now seed and assert direct standard kinds plus entity-owned routes instead of the removed V2 compatibility aliases. |
| Validation | Focused schema-ddl, metahubs-backend, applications-backend, template-mui, and touched Playwright regression slices were aligned during the implementation wave, and the canonical root `pnpm build` was rerun green on 2026-04-13 while syncing the memory bank. |

## 2026-04-13 QA Remediation Closure For Legacy Removal Acceptance

Closed the QA-reopened acceptance gap for the legacy-removal and entity-promotion wave by finishing the one remaining real backend tail and bringing shipped UI copy, focused regression coverage, browser proof, and bilingual documentation back into line with the direct standard-kind contract. This milestone is the durable closure for the earlier “implementation is not fully complete yet” QA verdict.

| Area | Resolution |
| --- | --- |
| Dependency-safe preset seeding | `TemplateSeedExecutor` now applies a final hub-assignment remap pass after seeded entities receive real object ids, so preset-derived default instances can reference seeded hubs safely through codename-to-id resolution. |
| Shipped runtime and UI truth surfaces | Entity-owned metadata pages and locale strings no longer describe the generic entity surface as coexistence-only or V2-branded; the shipped copy now matches the accepted unified standard-kind route model. |
| Focused regression and browser proof | The touched frontend unit suites were rewritten to direct `catalog` / `hub` / `set` / `enumeration` routes, the stale legacy-compatible V2 browser specs were retired or updated, and the remaining visual dialog proof now asserts the direct standard preset contract. |
| Docs and package READMEs | EN guides/architecture/README updates were mirrored in RU with matching structure, removing stale coexistence-era V2 guidance from the shipped documentation surfaces while preserving one explicit contrast note where the docs explain what is no longer recommended. |
| Validation | Focused frontend regression tests passed, focused metahubs-backend entity/template route tests passed, manual EN/RU line-count parity checks matched for the touched docs/READMEs, and the canonical root `pnpm build` completed green. |

## 2026-04-13 Entity-Type Codename Enforcement And Entity-Only Browser Validation Closure

Closed the next high-risk legacy-removal slice by hardening entity-type uniqueness at both the service and schema layers, then revalidating the entity-only publication/runtime/browser path on the current tree. This pass also repaired the self-hosted generator and browser import proof so the validation stack no longer depends on removed legacy route surfaces or brittle browser-response JSON parsing.

| Area | Resolution |
| --- | --- |
| Entity-type uniqueness | `EntityTypeService` now blocks duplicate codename conflicts server-side, `_mhb_entity_type_definitions` now carries an active-row unique index on lowered codename text, and focused service/route tests lock the `409` / `CODENAME_CONFLICT` contract. |
| Standard-kind/runtime alignment | `@universo/types` now recognizes the standard metahub kinds directly without deleted builtin-registry assumptions, which keeps publication/runtime/browser flows aligned with the standard preset-managed entity model. |
| Self-hosted generator and browser proof | The self-hosted generator now seeds sections and enumeration values through live entity-owned endpoints, writes a debug export envelope during generator runs, and the imported snapshot browser proof validates the restored structure through the canonical export-envelope contract. |
| Validation | `pnpm build` passed, focused snapshot tests passed, focused metahubs-backend reruns passed for `EntityTypeService`, `entitiesRoutes`, and `entityInstancesRoutes`, and the touched Playwright spec set passed. |

## 2026-04-13 Entity-Owned Metadata Route Cutover

Closed the next implementation batch of the legacy-removal migration by moving the shipped top-level metadata API surface fully onto the entity-owned route tree. This pass kept the mature domain-specific payloads and permissions intact by reusing existing hubs/catalogs/sets/enumerations controllers behind a managed-kind dispatcher instead of forcing the raw generic controller to emulate those richer contracts immediately.

| Area | Resolution |
| --- | --- |
| Backend top-level route ownership | `createEntityInstancesRoutes(...)` now owns the public top-level hubs/catalogs/sets/enumerations entity routes, resolves managed kinds from compatibility metadata plus entity-type lookup, and delegates managed requests to specialized controllers while keeping generic CRUD as the custom-kind fallback. |
| Frontend API cutover | Specialized metahubs frontend hubs/catalogs/sets/enumerations API modules now target the entity-owned endpoint family, and touched catalog hooks/query keys carry the effective child `kindKey` so hub-scoped child pages do not poison caches with the parent hub kind. |
| Legacy mount removal | `packages/metahubs-backend/base/src/domains/router.ts` no longer mounts the top-level legacy hubs/catalogs/sets/enumerations route families. Child-resource domains remain mounted separately and expose explicit entity-owned aliases for nested authoring surfaces. |
| Validation | Touched backend/frontend builds passed, focused query-key and `entityInstancesRoutes` suites passed, and the canonical root `pnpm build` completed green. |

## 2026-04-13 Legacy Frontend Route Tree Cleanup

Closed the next runtime-validation batch of the legacy-removal implementation by removing the residual hardcoded metahub object pages from the main frontend shell and retargeting the touched metahubs UI links to the unified entity route tree. This pass stayed intentionally frontend-only after code inspection showed that backend legacy router deletion was still unsafe until the remaining specialized API consumers migrated off the legacy endpoints.

| Area | Resolution |
| --- | --- |
| Main route tree | `MainRoutes.tsx` no longer registers the old hubs/catalogs/sets/enumerations object pages or their legacy object-detail branches, so the app shell now exposes the unified `/entities/:kindKey/...` authoring surface instead of both route families. |
| Entity-aware navigation cleanup | Shared route helpers now resolve child-kind navigation for both legacy-compatible custom kinds and the standard built-in kinds, while delete dialogs, list actions, and layout detail links remain inside the entity route tree. |
| Regression alignment | The touched route-oriented frontend tests were rewritten to mount unified entity paths, including migration guard, settings reopen flow, system-tab navigation, layout copy/detail flows, and create-error harnesses. |
| Validation | Focused metahubs-frontend route regression slice passed and the canonical root `pnpm build` completed green. |

## 2026-04-13 Legacy Removal Plan QA Finalization

Closed the second code-driven QA pass for the legacy-removal and entity-promotion implementation plan by applying the remaining seam-level refinements directly to the plan and then removing the last internal contradiction in its implementation-order notes. This milestone did not change runtime code yet; it finalized the implementation blueprint so future work can proceed without reopening plan-level technical debt.

| Area | Resolution |
| --- | --- |
| Template/preset reuse | The plan now explicitly reuses the existing template registry, validator, template detail API/hook path, and preset summary/detail cache. Preset default instances live in `entity_type_preset` manifests, and Parameters-tab labels are resolved from existing preset metadata instead of being duplicated. |
| Dependency-safe seeding | The plan now requires dependency-aware default-instance seeding for hub-linked presets: hub-kind instances are created first, codename-to-id mappings are recorded, and cross-instance hub assignments are applied in a final pass. |
| Frontend cleanup breadth | The plan now covers all real `source` / `isBuiltin` / `includeBuiltins` consumers, including `entityTypes.ts`, `EntitiesWorkspace`, `EntityInstanceList`, `TargetEntitySelector`, query-key normalization, and the related tests. |
| Final internal consistency | The last stale dependency note now matches the validated Phase 3 frontend migration before Phase 4 backend legacy removal ordering, so the plan no longer contradicts itself internally. |

## 2026-04-13 Legacy Removal Shell And Snapshot Contract Alignment

Closed the next runtime-validation batch of the legacy-removal implementation by moving the shared shell and publication snapshot seams onto the schema-backed entity-only contract. This pass removed the last `includeBuiltins` / `source` / `isBuiltin` usage from the touched shared menu, breadcrumb, snapshot, and focused validation surfaces without widening into the remaining route-tree deletion work yet.

| Area | Resolution |
| --- | --- |
| Shared shell navigation | `MenuContent` now fetches the unified metahub entity-type list without `includeBuiltins`, derives both standard and custom published object links from the same schema-backed metadata, and `getMetahubMenuItems(...)` renders those items through the unified `/entities/:kindKey/instances` route. |
| Permission and breadcrumb parity | Dynamic object links remain visible on read-only metahub surfaces while authoring-only shell entries stay permission-gated, and `NavbarBreadcrumbs` now resolves entity-type labels through presentation/nameKey metadata without relying on the removed `source` discriminator. |
| Snapshot round-trip | `SnapshotSerializer` and `SnapshotRestoreService` no longer serialize or restore `isBuiltin` on `entityTypeDefinitions`, keeping publication/import contracts aligned with the DB-backed entity-type model. |
| Validation | Shared template-mui, metahubs frontend, and focused backend suites passed, and the canonical root `pnpm build` completed green. |

## 2026-04-12 PR #763 Review Comment QA Triage

Closed the review-driven follow-up for GH763 by validating each bot suggestion against the live branch state, React documentation, and the existing browser proof before changing code. The real fixes were limited to the shared dialog first-open hydration seam; the suggested `Header` inset removal looked plausible in JSX but failed the real metahub shell-spacing browser contract and was therefore rejected.

| Area | Resolution |
| --- | --- |
| Confirmed dialog fixes | `EntityFormDialog` now resets incoming initial state before paint on first open, syncs the closed dialog state back to incoming initials, and renders from internal state instead of the earlier prop-override path. |
| Render purity | The dialog no longer writes `extraValuesRef.current` during render; the ref is synchronized only through state-reset helpers and effects, which aligns the component with React render-purity guidance. |
| Review rejection with proof | The proposed `Header` inset removal was tested through the spacing Playwright proof and immediately broke breadcrumb/title alignment, so the shared route-aware `Header` inset contract remains intentionally intact. |
| Validation | Focused dialog Jest passed, template build passed, `pnpm run build:e2e` passed, the targeted Chromium spacing flow passed, and the canonical root `pnpm build` completed successfully. |

## 2026-04-12 Metahub QA Gap Closure

Closed the three residual QA gaps left after the metahub spacing acceptance work: duplicated shell-spacing logic across shared layout components, ad hoc metahub loading-state overrides, and missing proof for both browser geometry and negative-path generic-entity permissions. This pass kept the accepted metahub inset unchanged while moving the contract into shared helpers and adding real validation instead of relying on JSX inspection alone.

| Area | Resolution |
| --- | --- |
| Shared shell-spacing contract | `pageSpacing.ts` now owns the shared metahub helpers, and both `MainLayoutMUI` and the shared `Header` consume that single route-aware source instead of maintaining separate metahub regex logic. |
| Loading-state contract | `SkeletonGrid` now exposes semantic `insetMode='page' | 'content'` plus the stable `skeleton-grid` test id, and the affected metahub routes now use `insetMode='content'` instead of scattered numeric overrides. |
| Regression proof | Backend routes now include isolated `403` ACL regressions, and the authenticated spacing flow proves breadcrumb/header/loading-skeleton edge alignment during a delayed real loading state. |
| Validation | Template/front-end builds and tests passed, the targeted Chromium shell-spacing flow passed, and the canonical root `pnpm build` completed green. |

## 2026-04-12 Metahub Page Horizontal Spacing Fix

Closed the metahub page-shell spacing drift that had accumulated across both the legacy authoring pages and the newer entity-based surfaces. This pass removed the old horizontal bleed offsets that pulled cards, tables, banners, tabs, and pagination wider than the shared header gutter provided by the main layout shell.

| Area | Resolution |
| --- | --- |
| Shared gutter contract | Standalone metahub pages now respect the outer gutter already applied by `MainLayoutMUI` instead of compensating it again with local negative margins. |
| Legacy and entity-based lists | Hubs, Catalogs, Sets, Enumerations, Branches, Members, Metahubs, Elements, Publications, and entity-based workspaces now align titles/actions with cards, tables, banners, and pagination under one left/right spacing rule. |
| Page-shell tabs and nested sections | Common, Settings, Migrations, Layout details, and nested attribute/constant/enumeration/layout surfaces no longer widen content beyond the header gutter. |
| Validation | Touched frontend build and the canonical root `pnpm build` completed green. |

## 2026-04-14 Metadata Capability Neutralization Slice

This slice removed the remaining business-era metadata folder ownership from both entity-owned frontend and backend seams without changing the accepted runtime behavior.

| Entry | Durable outcome |
| --- | --- |
| Frontend metadata folder neutralization | `domains/entities/metadata/attribute`, `constant`, `element`, and `enumerationValue` were renamed to `fieldDefinition`, `fixedValue`, `record`, and `optionValue`, with imports, wrappers, tests, package exports, and route consumers updated to match. |
| Public contract neutralization | Metahubs frontend exports and core-frontend lazy routes now expose `FieldDefinitionList`, `FixedValueList`, `RecordList`, and `SelectableOptionList`, and the touched template-mui external module declarations match the same contract. |
| Backend metadata folder neutralization | Entity-owned metadata route/controller folders were renamed to `fieldDefinition`, `fixedValue`, and `record`, and router/package exports plus route suites were switched to `createEntityFieldDefinitionRoutes`, `createEntityFixedValueRoutes`, and `createEntityRecordRoutes`. |
| Validation | Focused `@universo/metahubs-frontend` build + Vitest (`8` files / `24` tests), focused `@universo/metahubs-backend` build + Jest (`4` suites / `70` tests), and the canonical root `pnpm build` (`30 successful, 30 total`) all completed green. |

## 2026-04-12 Entity V2 Closure Cluster

The remaining 2026-04-12 follow-up work stayed inside the same validated closure wave and is intentionally condensed here to keep this file focused on the newest durable outcomes.

| Entry | Durable outcome |
| --- | --- |
| Self-hosted fixture QA closure | The committed self-hosted snapshot was regenerated through the supported generator path, the browser import flow re-exported and asserted the canonical envelope contract, and the canonical root build remained green. |
| Entity V2 QA completion follow-up | Hub V2 and Enumeration V2 preset automation uplift is now locked through direct manifest tests and fixture export checks. |
| Entity V2 QA closure completion | Compatibility-aware blocker queries now use full compatible kind arrays and `ANY($n::text[])`, preserving delete-safety for Set V2 / Enumeration V2 / Hub V2 custom kinds. |
| Entity V2 post-rebuild remediation | First-open dialog hydration, delegated kind-key propagation, localized labels, copy support, and baseline fixture/schema version behavior were aligned with fresh-import proof. |

## 2026-04-11 Entity V2 Completion Cluster

The 2026-04-11 wave closed the remaining Entity V2 route-ownership, compatibility, review-triage, automation, and workspace/browser seams. The detailed implementation inventory remains preserved in repository history; the durable outcomes below are the current operational summary.

| Entry | Durable outcome |
| --- | --- |
| Compatibility consolidation | Entity-owned routes, read-only definition access, explicit shared-field labels, and browser workspace parity stayed aligned. |
| Route ownership and genericization | Legacy-compatible V2 kinds now reuse mature legacy UI under entity-route ownership while preserving stored custom kinds across runtime, publication, and schema-ddl paths. |
| Review-triage fixes | PR #757 lifecycle-id consistency and the later review-driven fixes were accepted only where confirmed by current contracts and external guidance. |
| Automation and ECAE closure | Generic entity automation authoring, lifecycle dispatch, object-scoped Actions/Events, and browser proof all landed on green focused validation. |
| Workspace/browser closure | Post-rebuild Entities workspace parity, Catalogs V2 shared-surface behavior, and action-menu robustness were all repaired and revalidated. |

## 2026-04-10 Catalog V2 And ECAE Closeout Cluster

The 2026-04-10 wave primarily finished parity and closeout work rather than opening new architecture. The durable outcomes are summarized here while the exact command trail stays archived in repository history.

| Entry | Durable outcome |
| --- | --- |
| Catalog V2 entity route isolation recovery | Catalog-compatible pages stay inside the entity route tree while still reusing shared catalog storage and mature authoring surfaces. |
| Shared-surface closure | Catalog-compatible entity views now delegate to the shared Catalogs authoring surface with localized preset labels and read-only-safe affordance gating. |
| Generator and deleted-state closure | The self-hosted fixture contract uses the current structure baseline, and deleted-row inspection remains explicit behind `includeDeleted=true`. |
| QA policy and ACL closure | Catalog-compatible copy/delete/permanent-delete and authoring visibility now reuse the same legacy policy split as Catalogs. |
| Final parity verification | Shared-field label drift and visual/browser proof mismatches were closed without widening scope into a new product phase. |
| Read-only entity contract | Backend entity-type reads now match the shipped read-only entity UI contract while writes remain manager-only. |

## 2026-04-09 ECAE Delivery Cluster

The 2026-04-09 wave completed the first large end-to-end ECAE delivery set. This block is condensed, but the outcomes remain the active source of truth.

| Entry | Durable outcome |
| --- | --- |
| Strict Catalogs V2 parity | Backend/frontend/browser/runtime paths now treat catalog-compatible entity kinds as true parity-safe shared catalog surfaces. |
| Phase 3.6-4 closure | Structured builder, browser/runtime proof, compatibility tests, and EN/RU docs all landed together. |
| Phase 3.3-3.5 closure | Snapshot v3, DDL custom-type propagation, and runtime `section*` aliases were generalized without dropping legacy `catalog*` fields. |
| Post-QA and dynamic menu closure | The dynamic published custom-entity menu zone is now permission-aware and stable under the shared shell. |
| Instance UI and browser validation | The first generic entity instance UI, focused browser proof, and visual proof all passed on the real product route surface. |
| Reusable presets and frontend foundation | Entity presets now reuse the template registry/versioning flow, and the frontend authoring workspace is integrated into the shared shell. |

## 2026-04-08 ECAE Foundation And QA Recovery Cluster

| Entry | Durable outcome |
| --- | --- |
| Backend service foundation | Entity types, actions, event bindings, lifecycle orchestration, and resolver DB extension are validated backend seams. |
| Generic CRUD and compatibility layer | Custom-only generic entity CRUD shipped first, then legacy built-in delete/detach/reorder semantics were lifted into shared helper layers. |
| Design-time service genericization | Shared child copy and object-scoped system-attribute management now exist behind reusable helpers rather than catalog-only seams. |
| Review and QA hardening | PR review fixes, lint closure, attribute move ownership, strict E2E finalization, and current memory alignment were all validated on the root build. |

## 2026-04-07 Shared/Common And Runtime Materialization Cluster

| Entry | Durable outcome |
| --- | --- |
| Shared/Common shell | Common is the single authoring shell for shared attributes/constants/values/scripts/layouts. |
| Shared snapshot v2 | Shared sections export/import as first-class snapshot data but are materialized back into the flattened runtime/app-sync view. |
| Shared override transaction safety | Request-scoped shared override writes reuse explicit caller runners instead of reopening nested transactions. |
| Inherited widget contract | Catalog layout inherited widgets stay sparse, read-only for config, and gated by shared behavior rules for move/toggle/exclude. |
| Docs and runner cleanup | The live REST/docs/browser-cleanup seams were aligned with the shipped route/runtime contract. |

## 2026-04-06 Layout, Runtime, Fixture, And Docs Cluster

| Entry | Durable outcome |
| --- | --- |
| General/Common and catalog layouts | The General/Common page owns the single shell, catalog-specific layouts remain sparse overlays, and runtime behavior is layout-owned. |
| Snapshot export/import consistency | Full layout state, layout cache invalidation, and runtime materialization stayed aligned after QA remediation. |
| Fixture regeneration and browser-faithful imports | The self-hosted and quiz fixtures were repeatedly regenerated from real generator/browser flows and validated against import/runtime proof. |
| Dialog/docs/tutorial closure | Dialog settings, GitBook documentation, screenshot generation, and publication/runtime/browser authoring docs were brought into EN/RU parity. |

## 2026-04-05 Scripting And Quiz Delivery Cluster

| Entry | Durable outcome |
| --- | --- |
| Compiler/runtime safety | Embedded scripts are SDK-only, browser worker execution is restricted, server runtime is pooled, and public RPC boundaries fail closed. |
| Design-time and runtime product delivery | Scripts tabs, quizWidget, runtime execution, fixture export/import, and browser-authored quiz flows all landed. |
| Validation and compatibility | `sdkApiVersion`, CSRF retry, default capability resets, and runtime script sync fail-closed behavior all became durable cross-package contracts. |

## 2026-04-04 Self-Hosted Parity Cluster

| Entry | Durable outcome |
| --- | --- |
| Fixture identity and codename fidelity | Repeated real-generator reruns normalized localized self-hosted naming, section sets, and codename behavior. |
| Import/export and publication UX | Snapshot import/export, publication linkage, runtime inheritance, and browser-import fidelity were aligned with the live product. |
| Documentation and status trail | Plans, docs, and memory-bank wording now describe real navigation/page/guard functionality instead of synthetic fixture structure. |

## 2026-04-03 Snapshot, E2E Reset, And Turbo Hardening Cluster

| Entry | Durable outcome |
| --- | --- |
| Snapshot import/export hardening | Direct metahub export/import, publication version export, `SnapshotRestoreService`, and browser verification all landed as a supported feature set. |
| Hosted Supabase full-reset hardening | Wrapper-managed E2E runs now start from and return to a project-empty state with doctor/reset tooling and strict finalize semantics. |
| Turbo root contract | Turbo 2 root migration, cache correctness, and repeated-build cache hits became the documented repository build contract. |
| Domain-error cleanup | Typed domain errors, response-shape alignment, and test parity were completed across the touched backend/frontend wave. |

## 2026-04-02 To 2026-03-11 Condensed Archive

| Date | Theme | Durable outcome |
| --- | --- | --- |
| 2026-04-02 | Playwright full-suite hardening | Route timing, determinism, restart-safe cleanup, diagnostics, locale/theme, and route-surface browser-testing waves closed with the full suite green. |
| 2026-04-01 | Supabase auth + E2E QA | HS256/JWKS verification, RLS cleanup, E2E runner cleanup, and public-route/auth QA seams were stabilized. |
| 2026-03-31 | Breadcrumbs + security | Breadcrumb/query restore behavior, JSONB/text selector drift, and the late-March dependency/security tail were closed. |
| 2026-03-30 | Metahubs/applications refactor | Thin routes, controller/service/store decomposition, shared hooks, and shared mutation/error helpers became the working baseline. |
| 2026-03-28 to 2026-03-24 | CSRF + codename convergence | `csurf` replacement, vulnerability cleanup, and the codename JSONB/VLC single-field contract landed across schemas, routes, and frontend authoring. |
| 2026-03-19 to 2026-03-11 | Platform foundation | Request/pool/DDL DB access tiers, fixed system-app convergence, runtime-sync ownership, managed naming helpers, and bootstrap/application workspace work were completed. |

## Older 2025-07 To 2026-02 Summary

- Alpha-era platform work established the current APP architecture, template-first publication model, schema-ddl runtime engine, VLC/i18n convergence, application modules, publications, and the three-level system-fields model.
- Release milestones `0.21.0-alpha` through `0.52.0-alpha` in the table above remain the canonical high-level timeline for those earlier waves.

## 2026-04-28 Runtime Workspace QA Gap Closure

| Entry | Durable outcome |
| --- | --- |
| Mutable application visibility | Existing applications can now switch Closed/Public in the regular edit dialog; update payloads send `isPublic` while keeping `workspacesEnabled` immutable. |
| Unified settings save | Application visibility now participates in the General settings dirty state and uses the shared bottom Save button instead of an inline save action. |
| Runtime workspace navigation and locale | Published runtime Workspaces labels are available in the applications namespace, and catalog clicks from `/a/:applicationId/workspaces` navigate back to `/a/:applicationId?linkedCollectionId=...`. |
| Fixture integrity | LMS, quiz, and self-hosted committed fixture hashes were refreshed against the current snapshot normalizer, with generator documentation updated for all three fixture producers. |
| Validation | Focused Vitest, targeted lint, root `pnpm build`, workspace-management Playwright, settings/edit-dialog Playwright, and all snapshot import/export Playwright flows passed. |

## 2026-04-28 Runtime Workspace Final QA Closure

| Entry | Durable outcome |
| --- | --- |
| Backend lint closure | The remaining applications-backend lint warning in `applicationWorkspaces.test.ts` was removed after the prior Prettier drift was auto-fixed. |
| Runtime member view parity | Published application workspace members now reuse the isolated `apps-template-mui` card/list toolbar pattern, render members as cards by default, and can switch to the existing table view without new shared UI primitives. |
| Locale and browser proof | Runtime workspace Russian labeling is covered by a focused Vitest assertion and by the real `lms-workspace-management` Playwright flow, including a screenshot of `Рабочие пространства`. |
| Validation | `@universo/apps-template-mui` RuntimeWorkspacesPage Vitest, `@universo/applications-backend` lint and applicationWorkspaces Jest, `@universo/apps-template-mui` lint/build, root `build:e2e`, and the focused Chromium Playwright workspace-management flow passed. |

## 2026-04-28 Runtime Workspace UX QA Closure

| Entry | Durable outcome |
| --- | --- |
| Workspace switcher parity | The published runtime workspace selector now follows the isolated MUI `SelectContent` pattern: card-like selected state, grouped dropdown, and the Manage workspaces action as the final dropdown item instead of a separate icon button. |
| Sidebar separation | Applications with runtime workspaces auto-inject the workspace selector followed by the existing divider widget before runtime menu links. |
| Safe member actions | Workspace member list responses include backend-owned `canRemove` metadata, and the UI hides removal actions for members that cannot be safely removed, including the sole owner. |
| Runtime labels | Workspace creation and member access actions now use Create/Add wording, with the member dialog titled Add member and localized Russian equivalents. |
| Validation | Focused apps-template Vitest, applications-backend Jest, both touched package builds, backend lint, apps-template lint, root `build:e2e`, and the focused Chromium Playwright workspace-management flow passed with screenshots for the workspace list, member access, Russian page, and switcher dropdown. |

## 2026-05-02 Safe Scheme Validation for Menu href Links

| Entry | Durable outcome |
| --- | --- |
| Editor validation | Both `ApplicationMenuWidgetEditorDialog` and metahubs `MenuWidgetEditorDialog` now reject `javascript:`, `data:`, and `vbscript:` URL schemes in link items before saving, with a localized error message. |
| Runtime sanitization | `MenuContent.tsx` uses a `sanitizeHref` whitelist (`/`, `https:`, `mailto:`, `tel:`, `#`) at render time, blocking any unsafe href from becoming an anchor attribute. Links with unsafe schemes render as disabled inert items. |
| Unnecessary rel removed | `rel='noreferrer'` was removed from anchor elements since `target='_self'` does not require it. |
| i18n | Added `hrefUnsafeScheme` validation message in both en and ru locales for applications-frontend and metahubs-frontend. |
| Validation | ESLint passed on all modified TypeScript and JSON files. |

## 2026-05-02 LMS Runtime QA Remediation

| Entry | Durable outcome |
| --- | --- |
| JSONB/VLC runtime writes | Plain string runtime API input for localized/versioned `STRING` fields is normalized to a VLC object before insert/update, so parent and TABLE child JSONB-backed fields accept safe API payloads without PostgreSQL JSON syntax failures. |
| Public workspace isolation | Public guest runtime workspace discovery now resolves only the deterministic `__public_shared` workspace and no longer scans arbitrary active shared workspaces. Public shared workspace creation also parameterizes the codename insert value. |
| Dashboard default contract | `Dashboard` passes the resolved layout to `Header` and `MainGrid`, and `MainGrid` falls back to shared dashboard defaults instead of local `true` fallbacks for demo overview cards/charts. |
| Legacy widget lint closure | The stale `OptionsMenu` import left after deleting legacy LMS widgets was removed from `widgetRenderer.tsx`. |
| Validation | Focused backend Jest, apps-template Vitest, backend/apps-template build and lint, whitespace check, `lms-qr-code.spec.ts`, and `snapshot-import-lms-runtime.spec.ts` all passed. |

## 2026-05-02 LMS Runtime Role And Copy QA Closure

| Entry | Durable outcome |
| --- | --- |
| Runtime member role | Application `member` is now a read-only runtime content role: backend create/edit/copy/delete row mutations fail closed, while owner/admin/editor authoring contracts remain explicit. |
| Permission contract | Runtime app data responses expose content permissions, and both integrated and standalone MUI runtime clients hide create/edit/copy/delete controls through the existing dashboard/menu components. |
| TABLE copy integrity | Runtime row copy now loads child TABLE attribute `data_type` and validation rules, then normalizes copied child values through the same metadata-aware insert path as fresh writes. |
| Legacy widget cleanup | Remaining active editor/i18n/test references to the removed LMS global widgets were deleted; only negative tests and docs that state their absence still mention those keys. |
| Validation | Backend Jest, applications/apps-template Vitest, applications/metahubs frontend lint/build, backend/apps-template/application package lint/build, root `build:e2e`, `git diff --check`, and targeted Chromium `lms-workspace-management.spec.ts` all passed. |

## 2026-05-02 LMS Runtime Child Rows QA Closure

| Entry | Durable outcome |
| --- | --- |
| Child-row permissions | Runtime TABLE child-row listing no longer requires mutation permissions, so read-only members can inspect tabular content. Child-row create/update/copy/delete now fail closed through `editContent`, `createContent`, and `deleteContent` as appropriate. |
| Child-row copy integrity | TABLE child-row copy now uses shared metadata-aware normalization for localized/versioned `STRING` and `JSON` child values, matching parent-row TABLE copy behavior. |
| Regression coverage | Backend route tests now cover member read access, member mutation denial before table access, update guarded by `editContent`, and metadata-aware child-row copy parameters. |
| Validation | Focused backend Jest passed for `applicationsRoutes.test.ts` and `runtimeRowsController.test.ts` (`67/67`), `@universo/applications-backend` lint/build passed, root `build:e2e` passed (`30/30`), targeted Chromium `lms-workspace-management.spec.ts` passed (`2/2`), and `git diff --check` passed. |

## 2026-05-02 LMS Frontend QA Closure

| Entry | Durable outcome |
| --- | --- |
| Connector sync test contract | Applications frontend mutation tests now assert the current `syncApplication(applicationId, confirmDestructive, layoutResolutionPolicy)` call shape, including the default `undefined` policy. |
| Mutable visibility test contract | Application list update coverage now asserts that the edit flow submits `isPublic` with localized name/description updates, matching the current mutable visibility behavior. |
| Descriptor test stability | The dynamic import descriptor test now uses the same extended timeout as the adjacent connector descriptor test, removing the observed package-level timing flake without changing assertions. |
| Validation | Focused applications frontend Vitest passed for `mutations.test.tsx`, `ApplicationList.test.tsx`, and `actionsFactories.test.ts` (`34/34`); full `@universo/applications-frontend` Vitest passed (`139/139`); `@universo/applications-frontend` lint and `git diff --check` passed. |

## 2026-05-02 LMS Backend QA Blocker Closure

| Entry | Durable outcome |
| --- | --- |
| Sync diff preview | New-schema application diff preview now flattens TABLE child fields into table metadata, so preview rendering can see child `parentAttributeId` values while preserving nested record preview data. |
| Release bundle contract | Backend route tests now assert the current application-origin release bundle shape, including `fixedValues`, bootstrap artifacts, and incremental migration lineage. |
| Applications system migrations | The fixed applications system-app invariant now includes the persisted application settings migration as part of the fresh fixed-schema bootstrap contract. |
| Menu href hardening | Published app menu rendering now rejects protocol-relative `//host` href values in addition to unsafe schemes, with direct sanitizer coverage in `apps-template-mui`. |
| Documentation cleanup | The Russian LMS overview now avoids stale legacy wording while still documenting that removed LMS global widget keys are intentionally absent. |
| Validation | Full `@universo/applications-backend` Jest passed (`240/240`), full `@universo/apps-template-mui` Vitest passed (`89/89`), backend/apps-template lint and builds passed, GitBook docs check and `git diff --check` passed, root `pnpm build` passed (`30/30`), and targeted Chromium `snapshot-import-lms-runtime.spec.ts` passed (`2/2`) with screenshots. |
