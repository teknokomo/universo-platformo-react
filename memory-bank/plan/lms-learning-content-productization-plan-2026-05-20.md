# LMS Learning Content Productization Plan

Date: 2026-05-20
Mode: PLAN
Status: Implemented and release-validated for the current accepted scope
Research artifact: [lms-learning-content-product-roadmap-research-2026-05-20.md](../research/lms-learning-content-product-roadmap-research-2026-05-20.md)

## Goal

Turn the current LMS Learning Content V2 baseline into a coherent, iSpring-like authoring and learner experience generated into `tools/fixtures/metahubs-lms-app-snapshot.json`, without creating an LMS-only runtime fork.

The target result keeps the Universo architecture intact:

-   Metahub defines metadata, Objects, Pages, Sets, Enumerations, scripts, layouts, seed content, and default logic.
-   Application settings define global defaults: enabled resource types, column presets, player presets, role policy defaults, completion defaults, menu behavior, and report defaults.
-   Workspace runtime owns real operational work: projects, pages, links, courses, tracks, sharing, copying, deletion, restore, enrollment, progress, and reporting.
-   Published application UI is built from `packages/universo-react-apps-template-mui` and its MUI dashboard primitives, preserving the original dashboard style from `.backup/templates/dashboard`.
-   Generic platform behavior is improved in reusable primitives before adding any new widget. No package should branch on `template === 'lms'` for normal runtime behavior.
-   Broad import/player support for SCORM 1.2, SCORM 2004, xAPI, office files, video/audio conversion, internal messaging, and AI generation remains deferred.

## Inputs Reviewed

Primary sources:

-   Deep research file: `memory-bank/research/lms-learning-content-product-roadmap-research-2026-05-20.md`.
-   Previous implementation plan: `memory-bank/plan/lms-learning-content-implementation-plan-2026-05-17-v2.md`.
-   Previous LMS platform roadmaps: `memory-bank/plan/ispring-like-lms-platform-roadmap-2026-05-11.md` and `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md`.
-   Current task state: `memory-bank/tasks.md`, `memory-bank/activeContext.md`, `memory-bank/systemPatterns.md`, `memory-bank/currentResearch.md`.
-   Runtime docs and code: `packages/universo-react-apps-template-mui/README.md`, `packages/universo-react-metahubs-backend/base/README.md`, `.backup/templates/dashboard/README.md`.
-   Current shared contracts: `packages/universo-react-types/base/src/common/lmsPlatform.ts`, `runtimeDataSources.ts`, `applicationLayouts.ts`, `resourceSources.ts`.
-   Current runtime implementation: `CustomizedDataGrid.tsx`, `RelationBuilderWidget.tsx`, `widgetRenderer.tsx`, `FormDialog.tsx`, `ResourcePreview.tsx`, `runtimeRowsController.ts`, `ApplicationSettings.tsx`, `runtimeAdapter.ts`.
-   Current E2E and contract baseline: `tools/testing/e2e/support/lmsFixtureContract.ts`, `tools/testing/e2e/support/browser/runtimeUx.ts`, `tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`, `tools/testing/e2e/README.md`.
-   GitBook docs: `docs/en/guides/lms-learning-content.md`, `docs/ru/guides/lms-learning-content.md`, `docs/*/guides/lms-resource-model.md`.

Documentation checked through Context7 for current implementation patterns:

-   MUI X Data Grid: server-side pagination/sorting/filtering and controlled column visibility.
-   TanStack Query v5: optimistic mutation lifecycle with cancel, snapshot, rollback, and invalidation.
-   Playwright: web-first locators/assertions, screenshots through `testInfo.outputPath`, API verification after UI actions, traces on retry.

Subagent findings incorporated:

-   Explorer: LMS V2 already has the canonical Object-backed Learning Content baseline and should now be productized, not rebuilt.
-   Plan UX reviewer: the plan must include a UI Contract for every touched surface, no raw IDs/JSON/object cells, localized validation, and browser evidence at `1920x1080`, `768x1024`, and `390x844`.
-   Test oracle reviewer: the plan must include workflow-complete browser flows, multi-user sharing, restore target, custom field/report coupling, server-owned progress/status guards, and local Supabase minimal release gates.

QA refinement on 2026-05-20:

-   The first QA pass found that the direction is correct but the implementation guide needed sharper contracts for UI surfaces, API boundaries, static no-fork checks, report/export output, fixture drift, docs/screenshot drift, and exact existing code seams.
-   The sections below include those corrections so the plan can be used as a safer implementation checklist.

## Current Baseline

Already present:

-   Canonical Learning Content Objects: content projects, resources, courses, course sections/items, tracks, stages/steps, enrollments, progress, access entries, stars, recent views, and trash semantics.
-   Generic published runtime primitives: `detailsTable`, `records.union`, `relationBuilder`, CRUD dialogs, row actions, resource source authoring, Editor.js block content, `ResourcePreview`, reports/export, and `learnerPlayer`.
-   Application-level Learning Content settings tab with strict shared contracts.
-   Existing fixture contract checks for important UX invariants: no editable raw identity IDs, descriptions as textarea, resource source fields hidden in normal grids, builder/player/copy/progress acceptance areas.
-   Existing browser proof for seeded library/recent/starred/shared/trash, builders, enrollment warning/wizard, learner player, screenshots, viewport overflow, and technical leakage.

High-risk gaps:

-   `records.union` currently fans out client-side, uses `offset + limit`, merges locally, and uses columns from the first target. This is fragile for global search, sort, pagination, and heterogeneous content columns.
-   `expectedVersion` is not fully passed through production frontend delete/copy adapters, even though backend and CRUD contracts support concurrency predicates.
-   Learning Content application settings are partly stored but not consistently applied to runtime default view, column presets, supported resource types, and player behavior.
-   Star, Share, Recent, and Trash are present as data concepts, but need first-class row actions and human-readable projections so the product does not feel like seeded CRUD.
-   Trash restore needs a generic restore-target flow when the original project/parent is missing.
-   `learnerPlayer` and union/detail surfaces must not expose `TargetObjectCodename`, target IDs, storage/source payloads, progress object IDs, or raw enum values.
-   Docs still contain some older wording such as "V1 fixture" and must be aligned with the post-V2 Learning Content model.

## Non-Goals For This Plan

-   No SCORM/xAPI package runtime, import pipeline, file conversion, video/audio transcoding, office document rendering, internal messaging, or AI content generation.
-   No LMS-only published runtime module.
-   No manual editing of `tools/fixtures/metahubs-lms-app-snapshot.json`.
-   No `pnpm dev` validation path. E2E uses repository Playwright wrappers and local Supabase minimal when needed.
-   No preservation of obsolete fixture shapes. Test databases and generated metahubs/apps may be recreated.
-   No schema/template version bump just to preserve disposable test data.

## Affected Areas

-   `packages/universo-react-types/base/src/common/`
    -   Extend generic runtime datasource contracts, column projection contracts, restore target contracts, content access/star/recent action contracts, and Learning Content settings defaults.
-   `packages/universo-react-utils/base/src/`
    -   Add reusable display-label, reference projection, UUID v7 validation, and fail-closed coercion helpers only when needed by more than one package.
-   `packages/universo-react-metahubs-backend/base/src/domains/templates/data/lms.template.ts`
    -   Update LMS metadata, layouts, Object components, row actions, reports, settings defaults, fixture seed rows, and scripts.
-   `packages/universo-react-applications-backend/base/src/`
    -   Add generic union datasource execution, fail-closed permission predicates, expected-version mutation boundaries, restore target resolution, progress/status ownership guards, reports/custom field filters, and route/service tests.
    -   Explicit seams: `routes/applicationsRoutes.ts`, `controllers/runtimeRowsController.ts`, `controllers/runtimeReportsController.ts`, `services/runtimeReportsService.ts`, and route/service tests.
-   `packages/universo-react-applications-frontend/base/src/`
    -   Apply Learning Content settings in app control panel and runtime bootstrap, pass `expectedVersion`, keep settings localized and validated.
    -   Explicit seams: `api/runtimeAdapter.ts`, `api/applications.ts`, `pages/ApplicationRuntime.tsx`, `pages/ApplicationSettings.tsx`, and related tests.
-   `packages/universo-react-apps-template-mui/src/`
    -   Productize the workbench, generic table/card projections, row actions, relation builders, dialogs, learner player, report views, and UX helpers without hardcoded LMS screens.
    -   Explicit seams: `api/api.ts`, `api/adapters.ts`, `api/types.ts`, `hooks/useCrudDashboard.ts`, `dashboard/components/widgetRenderer.tsx`, `dashboard/components/RelationBuilderWidget.tsx`, `dashboard/components/CustomizedDataGrid.tsx`, `components/dialogs/FormDialog.tsx`, `components/resource-preview/ResourcePreview.tsx`, `standalone/DashboardApp.tsx`, and related tests.
-   `packages/universo-react-i18n` and package-local i18n folders
    -   Add shared labels in the correct ownership layer. All new UI text and validation messages must ship in English and Russian.
-   `tools/testing/e2e/`
    -   Extend fixture contract, add focused product Playwright flow, add screenshots, run local Supabase minimal release gate.
-   `docs/en`, `docs/ru`
    -   Update GitBook docs for Learning Content, resource model, setup, reports, runtime UX quality gate references, and screenshot assets.
-   Package READMEs
    -   Update `packages/universo-react-apps-template-mui/README.md`, `packages/universo-react-metahubs-backend/base/README.md`, and `tools/testing/e2e/README.md`.

## Architecture Principles

1. Extend generic primitives first.
   `detailsTable`, `records.union`, `relationBuilder`, `FormDialog` runtime record picker controls, `FormDialog`, `ResourcePreview`, `learnerPlayer`, reports, and Application Settings are the default implementation targets.

2. Keep Projects inside Workspaces.
   iSpring-like Projects map to workspace-scoped `ContentProjects` records. They are not Universo Workspaces and not Metahubs.

3. Hide system-owned data on normal surfaces.
   `OwnerId`, `UserId`, `ProjectId`, `CourseId`, `TrackId`, `TargetObjectCodename`, `TargetRecordId`, `PrincipalId`, progress IDs, storage payloads, block JSON, and UUID-only labels are hidden or replaced with human labels.

4. Use scripts as validated business hooks.
   Attached TypeScript scripts can customize access, sequencing, completion, progress aggregation, recent capture, and restore validation, but backend services must remain the enforcement boundary.

5. Make server-owned state explicit.
   Progress, parent aggregation, completion status, restore state, access predicates, and expected-version mutation checks are not trusted from browser payloads.

6. Keep UI dense and work-focused.
   Follow the existing MUI dashboard template: restrained layout, useful table/card density, clear toolbars, no marketing hero, no decorative gradients/orbs, no nested cards.

7. Treat tests as product oracles.
   A fixture row existing is not enough. A normal user must be able to complete the workflow in the published app.

## UI Contract

| Surface                                   | Reused primitive                                                                                      | Users                                  | Required controls                                                                                                                         | Hidden/system fields                                                    | Display contract                                                                                                 | Validation and i18n                                                                          | Responsive evidence                                                   |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Learning Content workbench                | `records.union`, `detailsTable`, row actions, view toggle, `CustomizedDataGrid`                       | author, manager, learner where allowed | Create menu, search, filters, card/table toggle, column settings, star/share/copy/delete actions                                          | all IDs, target codename, JSON payloads, raw storage/source descriptors | title, type chip, status chip, project label, owner/author label, updated/viewed date, shared/starred indicators | all labels in `en`/`ru`; empty states guide next action                                      | `1920x1080`, `768x1024`, `390x844`; no page-level horizontal overflow |
| Project list/detail and project dialogs   | `detailsTable`, `FormDialog`, `ResourcePreview`, member picker                                        | author, project editor, manager        | create/edit/copy/delete project, cover preview, access summary, content count                                                             | owner/user/project UUIDs, raw principal IDs                             | project title, multiline description, cover thumbnail, owner name/email, counts                                  | `description` multiline; localized access/status errors                                      | dialog fits mobile; table scroll contained                            |
| Item sharing/access dialog                | generic access-entry dialog, searchable picker, row actions                                           | owner/editor, viewer                   | invite by member/user, select Can view/Can edit, revoke, copy link when supported                                                         | `TargetObjectCodename`, `TargetRecordId`, `PrincipalId`, `UserId`       | collaborator name/email, role chip, inherited/direct label, updated date                                         | localized deny/update messages; no raw backend errors                                        | keyboard path and mobile dialog proof                                 |
| Standalone Page authoring                 | `FormDialog`, shared block editor, `ResourcePreview`, preview/player mode                             | author/editor                          | title, project picker, status, visual block editor, preview, publish/unpublish, unsaved guard                                             | block JSON, storage payloads, object IDs                                | readable blocks, outline from headings, publication status                                                       | semantic text fields multiline; Editor.js errors localized                                   | desktop/mobile screenshots of edit and preview                        |
| Standalone Link authoring                 | `FormDialog`, URL field, `ResourcePreview`                                                            | author/editor                          | title, project, safe URL, preview, completion policy                                                                                      | raw URL parse errors, IDs                                               | URL domain/preview badge, status chip, project label                                                             | `http`/`https` only; localized unsafe URL messages                                           | mobile dialog proof                                                   |
| Course Builder                            | `relationBuilder`, `FormDialog` runtime record picker, `FlowListTable`, tabs, row actions             | course author/editor                   | Outline, General, Availability, Completion, Enrollments, Reports, Player/Preview tabs; add section; add existing/create new item; reorder | `CourseId`, section/item UUIDs, target codename/record ID               | section title, item title, type, required/optional, estimated time, completion weight, lock state                | all long text multiline; localized sequence/completion warnings                              | desktop and mobile builder screenshots; no overflow                   |
| Learning Track Builder                    | same builder primitives as Course                                                                     | track author/editor                    | stages, add course, order mode, offsets/dates, due policy, active-enrollment warning                                                      | `TrackId`, stage/step UUIDs, course UUIDs                               | stage title, course title, due/offset labels, order mode chip                                                    | localized learner-impact warnings                                                            | desktop/mobile proof                                                  |
| Enrollment wizard                         | existing dialog/wizard pattern + pickers                                                              | manager, instructor                    | Users, Content, Parameters steps; start date; due date mode; restrict after due date; apply to all                                        | learner/content UUIDs, raw enrollment refs                              | user names/emails, course/track titles, due labels, status chips                                                 | localized validation; no manual ID input                                                     | keyboard flow and mobile proof                                        |
| Learner player                            | `learnerPlayer`, `ResourcePreview`, outline rendering                                                 | learner, reviewer                      | outline, next/previous, complete/recalculate action where allowed, progress header, due/lock state                                        | progress IDs, target codename, target record ID, JSON/source payloads   | content title, type/status chips, progress %, readable outline                                                   | localized locked/overdue/completed messages                                                  | screenshots for course and track on desktop/mobile                    |
| Trash and restore                         | `records.union`, `detailsTable`, restore action, restore-target picker                                | author/editor/manager                  | deleted item list, filter by type/project, restore, choose target if required, permanent delete only if scoped                            | deleted row IDs, original target IDs                                    | title, type, deleted date, deleted by, original project label, restore state                                     | fail-closed target validation messages                                                       | restore-target dialog mobile proof                                    |
| Column settings/custom fields             | `CustomizedDataGrid` column visibility, Application Settings                                          | admin/manager/author if allowed        | visible columns, order, per-view preset, custom fields                                                                                    | internal field names as primary labels                                  | localized field labels, preview examples, hidden technical fields                                                | localized duplicate/invalid field messages                                                   | no horizontal page overflow                                           |
| Reports/export                            | generic reports runner/export                                                                         | manager/instructor                     | filters, columns, saved views, export, scheduled shell if present                                                                         | raw SQL/report JSON, IDs                                                | labels for content, user, status, progress, project                                                              | localized filter validation                                                                  | desktop/mobile report proof                                           |
| Application Learning Content settings     | `ApplicationSettings` tab, existing settings form style                                               | app admin                              | supported resource types, default view, player preset, column preset, role policy preview, completion defaults                            | raw JSON settings block                                                 | localized sections and summary preview                                                                           | strict schema messages mapped to user text                                                   | settings page viewport matrix                                         |
| Create menu and deferred states           | metadata-defined row actions/menu items, supported resource settings, existing menu/action components | author/editor                          | Create Page, Link, Course, Track, Quiz-lite, Assignment-lite; disabled/deferred import/package actions with reason                        | policy flags, resource type internals, storage config                   | icon + localized label + localized deferred reason; no fake enabled import/player action                         | unsupported resource/player messages localized                                               | viewport matrix and keyboard menu path                                |
| Workbench card mode                       | same datasource projection as table, existing cards/list item primitives                              | author/manager/learner where allowed   | open, star, share, more menu, status/project/type chips                                                                                   | IDs, JSON, object fields, internal names                                | title, short description, type/status/project labels, last activity, safe preview thumbnail                      | empty optional cover/source fields do not show errors                                        | viewport matrix; cards wrap without page overflow                     |
| Row and bulk action menus                 | generic row actions and bulk selection in table/card toolbar                                          | author/editor/manager                  | star/unstar, share, move, copy, enroll, delete, restore where permissioned                                                                | hidden action policy flags, raw IDs                                     | unavailable actions hidden or disabled with localized reason                                                     | stale/permission/unsupported errors localized                                                | keyboard path for menu and bulk toolbar                               |
| Inline create inside builders             | `relationBuilder` + `FormDialog` + runtime record picker                                              | course/track author                    | create Page/Link inline, link existing item/course, return to outline with selected parent scoped                                         | parent UUIDs, target IDs, codename fields                               | created item appears by title/type/status; parent scope is visible by label                                      | required parent/picker validation localized                                                  | builder viewport matrix and keyboard path                             |
| Learner content lists                     | metadata-driven `records.union`/`detailsTable` views, not hardcoded LMS pages                         | learner                                | My Courses, My Tracks, assigned standalone content, due/lock filters                                                                      | enrollment UUIDs, progress row IDs, target IDs                          | title, due date, status, progress, lock reason                                                                   | locked/overdue/unavailable messages localized                                                | viewport matrix                                                       |
| Confirmation dialogs                      | `ConfirmDeleteDialog` or generic confirmation primitive                                               | author/editor/manager                  | copy, move, delete, permanent delete, active-enrollment impact acknowledgement                                                            | raw related IDs and policy internals                                    | human item names, impact summary, affected counts when available                                                 | conflict/permission/permanent-delete messages localized                                      | keyboard path and mobile fit                                          |
| Restore target picker                     | `FormDialog` runtime record picker, generic restore target contract                                   | author/editor/manager                  | choose valid target project/parent when original target is missing                                                                        | original target IDs, deleted target IDs, cross-workspace IDs            | target title/path/workspace label; restore state chip                                                            | wrong type, deleted target, no-permission, cross-workspace, stale version messages localized | viewport matrix and keyboard path                                     |
| Report filters/results/export/saved views | generic reports runner/export and `CustomizedDataGrid` result table                                   | manager/instructor                     | filters, visible columns, saved view, CSV export                                                                                          | SQL/report JSON, raw IDs, object values, codenames                      | report UI and CSV export use human labels, localized status/type values, formatted dates                         | invalid filter/export limit messages localized                                               | viewport matrix plus exported-file assertions                         |
| Course adjunct tabs                       | generic tabs over existing Objects/reports/scripts                                                    | course manager/instructor              | Notifications, Reviews, Certificate policy only when backed by real generic objects/scripts                                               | notification/certificate ledger IDs, review object IDs                  | visible as real configured tabs or clearly deferred, not fake                                                    | unsupported/deferred state localized                                                         | screenshot if enabled                                                 |

Global UI rules:

-   No raw user-facing IDs or UUID-only labels on normal surfaces.
-   No raw JSON, `[object Object]`, object cells, storage payloads, or resource-source payloads in tables, cards, builders, player metadata, trash, reports, or settings.
-   Semantic long-text fields are multiline by default: `description`, `summary`, `instructions`, `body`, `notes`, `feedback`, `comment`, and page/content text.
-   DataGrid horizontal scroll is allowed only inside a constrained component. Page-level horizontal overflow is a release blocker.
-   Validation messages must be localized and user-facing. Raw Zod/internal messages are blockers.
-   Icon buttons use existing icon library patterns and tooltips where meaning is not obvious.
-   Dangerous failure states that require explicit localized validation coverage: unsafe URL, stale mutation conflict, active-enrollment structural warning, restore target failure, duplicate custom field, unsupported resource/player, permission denial, empty optional resource-source/media fields, report filter/export errors.
-   Report result UI and exported files must follow the same display contract: no raw IDs, no raw JSON/object cells, no internal codenames, no raw enum values, and no hidden technical columns.
-   Any new LMS-facing surface must identify one of these implementation paths before code is written: reuse existing primitive, extend existing generic primitive, or add a new generic primitive with non-LMS metadata contract and tests.

## Plan Steps

### Phase 0. Baseline Re-Audit And Acceptance Reset

Goal: freeze the real post-V2 baseline and turn the research into implementation-ready gates.

Work:

-   Re-audit the files listed in "Inputs Reviewed" at the start of implementation.
-   Add a gap matrix per workflow: create project, create page/link, share, star, recent, create course, add section/item, configure completion, enroll, play, complete, delete, restore, report/export.
-   Split acceptance into:
    -   metadata/fixture contract;
    -   backend/security contract;
    -   frontend unit/component contract;
    -   browser workflow contract;
    -   docs/screenshot contract.
-   Add explicit release blockers to `lmsFixtureContract.ts` for no raw IDs, no raw JSON, no object cells, no `TargetObjectCodename` leakage, no editable server-owned progress/status, no unsupported resource type claiming a real player.
-   Add Phase 0 negative oracle inventory before implementation starts:
    -   technical leakage: visible internal field names, `ProjectId`, `OwnerId`, `TargetObjectCodename`, `TargetRecordId`, `PrincipalId`, raw enum codenames, UUIDs embedded in normal cells, JSON-like arrays, object fallbacks;
    -   per-dialog semantic controls for every create/edit/share/enroll/restore/report dialog;
    -   invalid submit in both `en` and `ru` for every new form;
    -   keyboard path, focus order, and primary workflow completion for every new or touched dialog/table/card/builder/player/report surface;
    -   per-tab semantic matrix for Course Builder, Track Builder, reports, custom-field editor/settings, and column preset dialogs;
    -   empty optional cover/media/resource-source fields;
    -   permission matrix for owner, editor, viewer, learner, cross-workspace, and cross-target access;
    -   stale-version matrix for edit, copy, delete, restore, move, and reorder;
    -   progress forgery matrix for wrong learner, unenrolled content, forged target, forged parent aggregation, and cross-workspace records;
    -   restore target matrix for wrong object type, deleted target, no-permission target, cross-workspace target, missing target, and stale version;
    -   fixture generator determinism and docs/screenshot drift.
-   Add a static no-fork oracle:
    -   fail if `packages/universo-react-apps-template-mui/src`, `packages/universo-react-applications-frontend/base/src`, or runtime backend code introduces `template === 'lms'` branches for normal behavior;
    -   fail if a new LMS-specific widget bypasses generic `detailsTable`, `records.union`, `relationBuilder`, `FormDialog`, `CustomizedDataGrid`, `ResourcePreview`, reports, or `learnerPlayer` without an approved generic primitive contract.
-   Extend runtime UX helpers or fixture contract so the oracles catch internal field names/codenames and embedded UUID values, not only UUID-only lines.

Deliverables:

-   Updated acceptance matrix in implementation tasks.
-   No product code changes before this contract is reviewed.

### Phase 1. Generic Datasource And Table Foundations

Goal: make the Learning Content library scalable and coherent through generic runtime data primitives.

Work:

-   Replace or augment client-side `records.union` fan-out with a generic server-side union datasource executor.
-   Define the backend API boundary explicitly:
    -   either add a generic `/applications/:applicationId/runtime/datasources/union` endpoint or extend `/runtime` with a typed union datasource mode;
    -   keep request/response schemas in `@universo-react/types`;
    -   keep projection ownership in layout/widget metadata, not LMS code;
    -   merge per-target permission predicates fail-closed and return only rows the current workspace/user can read;
    -   return consistent projection fields, row action capabilities, pagination metadata, and display labels.
-   Define a union projection contract that does not inherit columns only from the first target.
-   Support server-side pagination, sorting, filtering, search, and lifecycle/library views.
-   Add display-label resolution for project, owner, created-by, target content, principal, status, and type fields.
-   Apply application column presets to runtime tables.
-   Keep row-level permission predicates fail-closed per target Object and per action.
-   Make existing `CustomizedDataGrid` column visibility and server modes the default path rather than a custom LMS table.

Acceptance:

-   Unit tests prove union requests validate and reject unsupported targets/fields.
-   Backend tests prove pagination/sorting/filtering across at least resources, courses, and tracks.
-   Browser test proves no raw IDs/JSON/object cells in workbench, Recent, Starred, Shared, and Trash.

### Phase 2. Concurrency, Actions, And Server-Owned State

Goal: close correctness gaps before product UX depends on them.

Work:

-   Pass `expectedVersion` through frontend runtime adapter delete/copy/update/reorder calls.
-   Close the full `expectedVersion` chain:
    -   `CrudDataAdapter` types;
    -   standalone adapter in `packages/universo-react-apps-template-mui/src/api/adapters.ts`;
    -   standalone HTTP helpers in `packages/universo-react-apps-template-mui/src/api/api.ts`;
    -   production adapter in `packages/universo-react-applications-frontend/base/src/api/runtimeAdapter.ts`;
    -   production HTTP helpers in `packages/universo-react-applications-frontend/base/src/api/applications.ts`;
    -   `useCrudDashboard`;
    -   `RelationBuilderWidget` update/delete/reorder;
    -   backend reorder request schema and SQL/service tests.
-   Define reorder concurrency as a row-version map, not a single ambiguous version:
    -   request body includes `orderedRowIds` and `expectedVersionsByRowId: Record<rowId, version>`;
    -   backend validates that every ordered row exists, is active, belongs to the same workspace and parent/order scope, and has the expected `_upl_version`;
    -   validation runs inside a transaction with row locks before sort-order updates;
    -   all reordered rows that change order receive a version bump;
    -   stale, missing, duplicate, cross-parent, cross-workspace, or extra rows fail the whole reorder with a localized conflict/error path.
-   Enforce expected-version predicates at the SQL mutation boundary for update, delete, restore, copy, move, and reorder.
-   Ensure browser payloads cannot set progress percent/status directly.
-   Replace direct browser-owned progress/status writes:
    -   narrow `updateLearningContentProgress` so browser commands send action intent, target, and expected context instead of arbitrary `progressPercent`/`status`;
    -   remove `progressPercent` and `status` from the current browser-sent `complete` payload as well; completion is an intent, not a trusted progress write;
    -   update `widgetRenderer` learner player, `PageBlocksView`, `standalone/DashboardApp`, and related tests;
    -   adjust backend `/runtime/progress/content` schema so `progressPercent`/`status` are derived server-side except for explicitly trusted internal commands;
    -   keep malicious direct payload tests for forged progress/status, parent aggregation, target object/record, learner, enrollment, and workspace.
-   Add explicit commands for complete/recalculate/restore/move/copy that route through backend services.
-   Use TanStack Query optimistic updates only with rollback snapshots and final invalidation.
-   Add user-facing conflict messages when a stale version is detected.

Acceptance:

-   Backend tests cover stale update/delete/restore/copy/reorder failure.
-   Frontend tests cover optimistic rollback.
-   Playwright flows trigger stale edit, copy, delete, restore, move, and reorder mutations and see localized conflict messages.

### Phase 3. Workbench, Projects, Star, Share, Recent

Goal: make the Learning Content home feel like a real authoring workspace.

Work:

-   Productize the workbench layout:
    -   Learning Content, Recent, Starred, Shared with me, Projects, Trash.
    -   Header with workspace label and primary Create action.
    -   Search, filters, view toggle, column settings, bulk actions.
    -   Human-readable rows/cards with type/status/project/owner/date indicators.
-   Make Create menus metadata-driven through layout/menu metadata, supported resource type settings, and generic row action descriptors. Do not hardcode Page/Link/Course/Track menus in `apps-template-mui`.
-   Add first-class row actions: Star/Unstar, Share, Move to project, Copy, Delete, Restore where applicable.
-   Productize `ContentProjects`:
    -   create/edit/copy/delete project;
    -   cover preview;
    -   content counts;
    -   access summary;
    -   project detail view with related content.
-   Productize sharing:
    -   invite workspace members/users by name/email;
    -   Can view / Can edit;
    -   revoke/update access;
    -   Shared with me view.
-   Recent views should be captured by a backend command or trusted script hook after permission checks.
-   Folders are not part of this first productization slice unless a cheap generic folder primitive already exists. If folder parity is added later, it must be a generic nested Object/Hub pattern, not a project/workspace substitute.

Acceptance:

-   Multi-user Playwright:
    -   owner creates project and page;
    -   owner shares page with viewer;
    -   viewer sees the page in Shared with me;
    -   viewer does not see Edit/Copy/Delete/Restore;
    -   direct API write as viewer returns `403`.
-   Screenshots for workbench/project/share/recent/starred/shared/trash at desktop and mobile.

### Phase 4. Standalone Page And Link Authoring

Goal: make content authored in the published app usable without file import.

Work:

-   Create menu: Page, Link, Course, Learning Track, Quiz-lite, Assignment-lite; deferred upload/package types stay disabled or clearly marked as unsupported.
-   Page authoring:
    -   visual block editor instead of raw JSON;
    -   safe block schema validation;
    -   title/name sync until manual override;
    -   outline extraction from headings;
    -   preview/learner mode;
    -   publish/unpublish/unpublished changes state;
    -   unsaved-change guard if browser navigation would drop content.
-   Link authoring:
    -   safe `http`/`https` URL validation;
    -   domain/preview badge;
    -   complete-on-open behavior.
-   Keep resource preview honest: unsupported import/player types show a deferred state, not fake support.
-   Replace/download/version behavior from iSpring is acknowledged but not claimed until there is real import/storage/player support. For now, unsupported replacement/download actions stay hidden or disabled with localized deferred reasons.

Acceptance:

-   Browser creates a Page with blocks, edits it, previews it, completes it in player, and verifies persisted progress.
-   Browser creates a Link, validates unsafe URL rejection, opens preview, and records recent view.
-   No block JSON or resource-source payload appears in normal UI.

### Phase 5. Course Builder Productization

Goal: make Course Builder the main structured authoring surface over generic relation builders.

Work:

-   Course detail tabs:
    -   Outline;
    -   General;
    -   Notifications when backed by real generic notification rules/outbox behavior;
    -   Availability;
    -   Completion;
    -   Enrollments;
    -   Reports;
    -   Reviews when backed by real generic review/submission behavior;
    -   Certificate policy when backed by real certificate Objects/ledgers/scripts;
    -   Player/Preview.
-   Outline:
    -   add/edit/delete section;
    -   add existing resource;
    -   create Page/Link inline;
    -   reorder sections/items;
    -   required/optional toggle;
    -   estimated time;
    -   completion weight;
    -   human-label polymorphic reference picker.
-   Completion:
    -   Free/Sequential navigation;
    -   All/Selected items completion;
    -   Complete/Incomplete or Passed/Failed status format;
    -   warning and recalculation path when required/rated items change.
-   Copy:
    -   copy course settings, sections, and items;
    -   do not copy enrollments, progress, or report runs unless metadata explicitly opts in.
-   Large-course warning:
    -   keep the 100-item warning but show it in an author-friendly place.
-   Adjacent iSpring course tabs must not be fake. If Notifications, Reviews, or Certificates are not operational in the current slice, render them as absent or clearly deferred with a localized reason and backlog reference.

Acceptance:

-   Browser creates course, section, inline Page item, sets sequential completion, previews player, verifies lock/unlock behavior, copies course, and confirms copied outline without enrollments/progress.

### Phase 6. Learning Track Builder Productization

Goal: make tracks a program layer over courses rather than a duplicate course engine.

Work:

-   Reuse Course Builder primitives for stages and steps.
-   Track tabs parallel the Course tabs where useful.
-   Track outline:
    -   add/edit/delete stage;
    -   add existing course;
    -   order mode: By days, Sequential, Free;
    -   start offset/date and due offset/date;
    -   restrict-after-due-date.
-   Active-enrollment structural edits require explicit warning acknowledgement.
-   Copy/move/delete should explain learner impact and avoid copying enrollments/progress/report runs.

Acceptance:

-   Browser creates/opens a track, adds a stage and course, changes order mode, verifies active-enrollment warning, and opens the learner player with readable stage/course labels.

### Phase 7. Enrollment, Learner Player, And Progress Semantics

Goal: connect authoring to a reliable learner workflow.

Work:

-   Enrollment wizard:
    -   entry from course/track detail, library row action, and bulk selection;
    -   Users, Content, Parameters steps;
    -   searchable user picker by name/email;
    -   start date;
    -   due date modes: Use settings, By Date, For Period, No Due Date;
    -   restrict after due date;
    -   Apply to all.
-   Learner views:
    -   My Courses;
    -   My Tracks;
    -   assigned standalone content;
    -   due dates, lock states, readable status chips.
-   Build learner lists through metadata-driven `records.union`/`detailsTable` views and role-scoped datasources, not through hardcoded LMS pages.
-   Player:
    -   type-aware content rendering;
    -   section/stage outline;
    -   next/previous;
    -   complete/recalculate commands;
    -   parent progress aggregation from server.
-   Progress is always server-owned and recalculated by backend services/scripts after validation.

Acceptance:

-   Browser enrolls a learner, learner opens course/track, completes a Page/Link, status updates, parent progress aggregates, and malicious direct progress/status write fails.
-   Browser and API tests cover owner/editor/viewer/learner permissions for edit, copy, delete, restore, enroll, report/export, complete, and recalculate.

### Phase 8. Trash, Restore Target, Copy, Move

Goal: make destructive and recovery workflows dependable.

Work:

-   Trash view:
    -   readable title/type/project/deleted date/deleted by/restore state;
    -   filters by type/project/date;
    -   restore action;
    -   permanent delete only if permissioned and explicitly in scope.
-   Restore target:
    -   if original project/parent exists, direct restore;
    -   if missing, show `Requires target` and open a picker;
    -   target picker uses human labels and permission checks;
    -   invalid or missing target fails closed.
-   Add a shared restore target contract and backend body shape:
    -   `objectCollectionId`;
    -   `expectedVersion`;
    -   optional `restoreTarget` object with `mode: 'original' | 'target'`, `targetObjectCollectionId`, `targetRecordId`, optional `targetWorkspaceId`, and metadata-owned parent/relation mapping such as `parentFieldCodename`;
    -   frontend adapter support in `CrudDataAdapter.restoreRow`, standalone `restoreAppRow`, production `restoreApplicationRuntimeRow`, `widgetRenderer` trash actions, and restore-target picker dialogs;
    -   server-side validation of target type, lifecycle state, workspace, permission, and parent relation.
-   Copy/move:
    -   preserve/omit related records by metadata;
    -   no enrollments/progress/report runs copied by default;
    -   conflict handling through expected version.

Acceptance:

-   Browser deletes a project parent, opens Trash for a child item, sees `Requires target`, selects a valid project by title, restores successfully, and invalid target API calls fail.
-   Negative restore tests cover wrong object type, deleted target, no-permission target, cross-workspace target, missing target, and stale version.
-   Browser tests trigger every restore-target negative class and verify localized, user-facing messages instead of raw backend/internal errors.

### Phase 9. Custom Fields, Column Presets, Reports

Goal: make Learning Content configurable like a business app, not a fixed demo.

Work:

-   Define generic custom field metadata for Object forms where needed.
-   Connect custom field visibility through:
    -   application settings;
    -   course/resource forms;
    -   workbench columns;
    -   report filters;
    -   report/export columns.
-   Apply Learning Content settings:
    -   default view;
    -   supported resource types;
    -   player preset;
    -   column preset;
    -   completion defaults.
-   Reports:
    -   learning content summary;
    -   course progress;
    -   track progress;
    -   project activity;
    -   access/sharing report where useful.
-   Include `runtimeReportsController.ts`, `runtimeReportsService.ts`, report/export request schemas, CSV serialization, and frontend report runners in the implementation checklist.
-   Resolve report datasource scope explicitly:
    -   per-object reports may continue to use existing `records.list`;
    -   cross-type Learning Content summary/report/export must use the generic union datasource executor from Phase 1 or a generic union report executor that shares the same projection and permission service;
    -   if the union report executor is not implemented, do not claim cross-type Learning Content report/export parity in the product fixture.
-   Report UI and exported files must format references, status/type enums, dates, progress, project, user, and custom fields with human-readable labels. Raw IDs/codenames/JSON/object values are blockers in both UI and export output.

Acceptance:

-   Browser adds/enables a custom field, sees it in Course General, enables it in workbench columns, filters a report by it, exports report with human-readable labels.
-   Export tests parse the downloaded CSV and assert no unauthorized rows, UUID-only labels, internal codenames, raw enum values, raw JSON, object cells, or hidden technical columns.

### Phase 10. Fixture Generator, Snapshot, Docs, And Release Gate

Goal: produce the final artifact the user will import and evaluate.

Work:

-   Update `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts` to generate the product snapshot from real metahub/application flows.
-   Update `tools/testing/e2e/support/lmsFixtureContract.ts` with product-level invariants and negative checks.
-   Add or extend static plan/code guards for:
    -   no LMS-only runtime widget where a generic primitive should be extended;
    -   no `template === 'lms'` runtime behavior branches in app-template/runtime packages;
    -   no raw technical fields in normal Learning Content metadata;
    -   no stale docs wording such as "V1 fixture" or canonical `Modules` content path.
-   Add focused Playwright product flow, preferably `tools/testing/e2e/specs/flows/lms-learning-content-product.spec.ts`, instead of expanding the existing mega spec indefinitely.
-   Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only through Playwright.
-   Add a deterministic fixture drift gate: after regeneration, committed `tools/fixtures/metahubs-lms-app-snapshot.json` must match generated output, or the implementation fails until the diff is reviewed and committed.
-   Add docs link/screenshot asset guards if they do not already exist:
    -   a GitBook markdown link checker;
    -   a screenshot asset manifest checker that fails on missing/stale assets referenced by LMS docs;
    -   a screenshot regeneration/diff path for intentional UI changes.
-   Update docs:
    -   `docs/en/guides/lms-learning-content.md`;
    -   `docs/ru/guides/lms-learning-content.md`;
    -   `docs/*/guides/lms-resource-model.md`;
    -   `docs/*/guides/lms-setup.md`;
    -   `docs/*/guides/lms-reports.md`;
    -   related GitBook screenshot assets.
-   Update package READMEs.

Release gate:

```bash
export NVM_DIR="$HOME/.nvm"
. "$NVM_DIR/nvm.sh"
nvm use --silent 22
node -v

pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
pnpm --filter @universo-react/types test
pnpm --filter @universo-react/applications-backend test
pnpm --filter @universo-react/apps-template-mui test
pnpm --filter @universo-react/applications-frontend test
pnpm --filter @universo-react/metahubs-backend test
! rg -n "template\\s*===\\s*['\"]lms['\"]|case\\s+['\"]lms['\"]|widgetKey\\s*[:=]\\s*['\"]lms-" \
  packages/universo-react-apps-template-mui/src \
  packages/universo-react-applications-frontend/base/src \
  packages/universo-react-applications-backend/base/src
UNIVERSO_ENV_FILE=.env.e2e.local-supabase \
UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/base/.env.e2e.local-supabase \
  pnpm run build:e2e
UNIVERSO_ENV_FILE=.env.e2e.local-supabase \
UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/base/.env.e2e.local-supabase \
  node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project chromium
git diff --exit-code -- tools/fixtures/metahubs-lms-app-snapshot.json
UNIVERSO_ENV_FILE=.env.e2e.local-supabase \
UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/base/.env.e2e.local-supabase \
  node tools/testing/e2e/run-playwright-suite.mjs specs/flows/lms-learning-content-product.spec.ts --project chromium
UNIVERSO_ENV_FILE=.env.e2e.local-supabase \
UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/base/.env.e2e.local-supabase \
  node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium --grep "lms snapshot fixture imports"
pnpm docs:i18n:check
! rg -n "V1 fixture|canonical Modules|lms-module-viewer|lms-stats-viewer" docs/en docs/ru
node tools/docs/check-gitbook-links.mjs
node tools/docs/check-gitbook-screenshot-assets.mjs
```

Do not use `pnpm dev` for these checks.

If docs link/screenshot guard scripts are missing at implementation time, Phase 10 must add them before release. Screenshot assets referenced by GitBook pages must exist and must be regenerated after intentional UI changes.

## Testing Matrix

| Layer                       | Required tests                                                         | Key fail-oracles                                                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contracts            | Vitest/Zod tests in `packages/universo-react-types`                          | invalid union targets, unsafe URLs, invalid access principals, unsupported resource types, restore target schema, union projection schema, raw internal settings blocks                                                |
| Backend routes/services     | Jest/Vitest route and service tests in `packages/universo-react-applications-backend` | stale expected version across edit/copy/delete/restore/move/reorder, shared viewer write denial, malicious progress/status writes, restore target fail-closed, report/custom field filters, report export label safety |
| Frontend runtime primitives | Vitest/component tests in `packages/universo-react-apps-template-mui`                 | no raw object cells, column preset application, optimistic rollback, relation builder labels, FormDialog multiline/editor fields, card mode display contract, disabled/deferred action states                          |
| Application settings UI     | Vitest/component tests in `packages/universo-react-applications-frontend`             | settings saved strictly, localized validation, runtime defaults applied                                                                                                                                                |
| Fixture contract            | Node/Playwright support contract                                       | product entities and flows present, deterministic generated snapshot, no `Modules` canonical path, no unsupported player claims, no technical field leakage                                                            |
| Browser E2E                 | Playwright via repository wrapper                                      | create/share/star/recent/course/enroll/player/delete/restore/report lifecycle; screenshots; localized invalid submits; permission matrix; no page-level overflow                                                       |
| Static/no-fork              | grep or AST guard                                                      | no LMS-only runtime widgets or `template === 'lms'` branches in normal runtime packages                                                                                                                                |
| Docs                        | docs/i18n/link/screenshot review                                       | GitBook pages mention current post-V2 model, no stale "V1 fixture" wording, screenshot assets exist and match UI                                                                                                       |

Required Playwright UX helpers on every new/touched surface:

-   `expectNoTechnicalLeakage`
-   `expectSemanticFieldControls`
-   `expectLocalizedValidation`
-   `expectRuntimeUxViewportMatrix`
-   screenshot artifacts named by surface, locale, and viewport
-   per-surface semantic contracts for long text, forbidden editable ID labels, and reference picker labels
-   explicit invalid submit path before `expectLocalizedValidation`
-   keyboard path, focus order, and primary workflow completion for every new or touched surface

Minimum viewport matrix:

-   `1920x1080`
-   `768x1024`
-   `390x844`

Minimum multi-user scenarios:

-   owner/editor creates and shares content;
-   viewer sees Shared with me but cannot edit/copy/delete/restore;
-   direct API write as viewer returns `403`;
-   deleted original parent forces restore target picker;
-   learner completes content and server aggregates progress.
-   report/export output contains labels, not UUIDs/codenames/JSON.

## Code Examples

### Generic Union Datasource Contract

```ts
import { z } from 'zod'

export const runtimeUnionProjectionFieldSchema = z
    .object({
        field: z.string().min(1),
        labelKey: z.string().min(1),
        source: z.enum(['record', 'display', 'computed']),
        type: z.enum(['text', 'chip', 'date', 'number', 'boolean']),
        visibleByDefault: z.boolean().default(true)
    })
    .strict()

export const runtimeUnionTargetSchema = z
    .object({
        objectCodename: z.string().min(1),
        typeLabelKey: z.string().min(1),
        titleField: z.string().min(1),
        statusField: z.string().optional(),
        projectField: z.string().optional(),
        updatedAtField: z.string().optional(),
        projection: z.array(runtimeUnionProjectionFieldSchema).min(1)
    })
    .strict()

export const runtimeUnionRowsRequestSchema = z
    .object({
        workspaceId: z.string().uuid(),
        lifecycle: z.enum(['active', 'deleted']).default('active'),
        libraryView: z.enum(['all', 'recent', 'starred', 'shared', 'project', 'trash']).default('all'),
        projectId: z.string().uuid().optional(),
        search: z.string().trim().max(200).optional(),
        page: z.number().int().min(0),
        pageSize: z.number().int().min(1).max(100),
        sort: z
            .array(
                z
                    .object({
                        field: z.string().min(1),
                        direction: z.enum(['asc', 'desc'])
                    })
                    .strict()
            )
            .max(3)
            .default([])
    })
    .strict()
```

### SQL Boundary Pattern For Expected Version

```ts
import { qColumn, qSchemaTable } from '@universo-react/schema-ddl'
import type { DbExecutor } from '@universo-react/utils'

export async function softDeleteRuntimeRow(params: {
    executor: DbExecutor
    schema: string
    table: string
    rowId: string
    workspaceId: string
    actorId: string
    expectedVersion: number
}) {
    const sql = `
    update ${qSchemaTable(params.schema, params.table)}
       set ${qColumn('DeletedAt')} = now(),
           ${qColumn('DeletedBy')} = $3,
           ${qColumn('Version')} = ${qColumn('Version')} + 1
     where ${qColumn('Id')} = $1
       and ${qColumn('WorkspaceId')} = $2
       and ${qColumn('Version')} = $4
       and ${qColumn('DeletedAt')} is null
     returning ${qColumn('Id')}, ${qColumn('Version')}
  `

    const result = await params.executor.query(sql, [params.rowId, params.workspaceId, params.actorId, params.expectedVersion])

    if (result.rows.length !== 1) {
        throw new ConflictError('runtime.errors.recordChanged')
    }

    return result.rows[0]
}
```

### TanStack Query Optimistic Action With Rollback

```ts
const starMutation = useMutation({
    mutationFn: (input: StarContentInput) => runtimeApi.starContent(input),
    onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey: ['runtime', 'learning-content', input.workspaceId] })

        const key = ['runtime', 'learning-content', input.workspaceId, input.view]
        const previous = queryClient.getQueryData<LearningContentPage>(key)

        queryClient.setQueryData<LearningContentPage>(key, (current) => {
            if (!current) return current
            return {
                ...current,
                rows: current.rows.map((row) => (row.id === input.recordId ? { ...row, starred: input.starred } : row))
            }
        })

        return { key, previous }
    },
    onError: (_error, _input, context) => {
        if (context?.previous) {
            queryClient.setQueryData(context.key, context.previous)
        }
    },
    onSettled: (_data, _error, input) => {
        queryClient.invalidateQueries({ queryKey: ['runtime', 'learning-content', input.workspaceId] })
    }
})
```

### DataGrid Column Visibility From Metadata

```tsx
<CustomizedDataGrid
    rows={rows}
    columns={columns}
    rowCount={rowCount}
    paginationMode='server'
    sortingMode='server'
    filterMode='server'
    columnVisibilityModel={columnVisibilityModel}
    onColumnVisibilityModelChange={(model) => {
        setColumnVisibilityModel(model)
        saveColumnPreset({ viewId, model })
    }}
/>
```

### Playwright Product Oracle

```ts
test('learning content lifecycle is user-friendly and permission-safe', async ({ page, request }, testInfo) => {
    await openLearningContent(page)
    await createProject(page, { title: 'Sales onboarding' })
    await createPage(page, { title: 'Welcome lesson', blocks: ['Heading', 'Paragraph'] })
    await shareContent(page, { title: 'Welcome lesson', viewerEmail: 'viewer@example.test' })

    const workbench = page.getByTestId('lms-learning-content-workbench')
    await expectNoTechnicalLeakage(workbench, { label: 'Learning Content workbench' })

    const projectDialog = page.getByRole('dialog', { name: /project/i })
    await expectSemanticFieldControls(projectDialog, {
        longTextLabels: ['Description'],
        forbiddenEditableIdLabels: ['Project ID', 'Owner ID', 'User ID'],
        referenceFieldLabels: ['Project']
    })

    await submitInvalidLinkUrl(page, 'ftp://unsafe.example.test/file')
    await expectLocalizedValidation(page.getByRole('dialog'), 'ru', {
        label: 'Learning Content link validation'
    })

    await expectRuntimeUxViewportMatrix(page, 'Learning Content workbench', {
        beforeEachViewport: async (viewport) => {
            await workbench.screenshot({
                path: testInfo.outputPath(`lms-learning-content-workbench-ru-${viewport.name}.png`)
            })
        }
    })

    const writeAsViewer = await request.patch('/api/runtime/rows/...', {
        data: { title: 'Unauthorized edit' },
        headers: viewerHeaders
    })
    expect(writeAsViewer.status()).toBe(403)
})
```

## Documentation Plan

Update GitBook docs in English and Russian:

-   `lms-learning-content.md`: current product model, user workflows, screenshots, deferred formats.
-   `lms-resource-model.md`: post-V2 Object model; remove stale "V1 fixture" wording.
-   `lms-setup.md`: fixture regeneration through Playwright only, local Supabase minimal release gate.
-   `lms-reports.md`: custom fields, report filters, exports, progress reports.
-   `runtime-ui-ux-quality-gate.md`: mention Learning Content product oracles if useful.

Update README files:

-   `packages/universo-react-apps-template-mui/README.md`: generic primitives used by Learning Content and rules for avoiding raw IDs/JSON.
-   `packages/universo-react-metahubs-backend/base/README.md`: LMS template structure and product snapshot contract.
-   `tools/testing/e2e/README.md`: focused LMS product spec, screenshot naming, local Supabase minimal commands.

## Explicit Later Parity Backlog

These items are accounted for from the iSpring Learning Content research, but should not be mixed into the first productization implementation unless the user explicitly expands scope:

-   Automatic assignment rules for new group/department members, including non-retroactive behavior.
-   Automatic course re-enrollment and certificate/time-window constraints.
-   Catalog/self-enrollment flows: categories, approval requests, add to My Courses, and unenrollment constraints.
-   Generic folders inside Learning Content Projects. First slice may use flat projects plus filters; folders require a reusable nested Object/Hub pattern.
-   Linked-copy semantics from iSpring. Do not reproduce them until Universo has a clear generic reference/copy contract that does not revive the old `Modules` path.
-   Replace/download/version behavior for imported files/packages. Keep disabled/deferred until real import/storage/player support exists.
-   Full notification automation, review inboxes, and certificate issuing beyond the generic tabs/contracts explicitly proven in Course Builder.
-   Broad SCORM/xAPI/video/audio/document/office import and runtime players.
-   Internal messaging and AI generation.

## Risks And Mitigations

| Risk                                                 | Mitigation                                                                                          |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| LMS-specific UI fork appears under schedule pressure | Require every UI change to map to an existing generic primitive or document a new generic primitive |
| Workbench looks complete but workflows are fake      | Workflow-complete Playwright lifecycle, not only fixture metadata checks                            |
| Raw IDs/JSON leak through new projections            | Extend runtime UX helpers and fixture contract before implementation                                |
| Union datasource becomes slow or inconsistent        | Server-side union executor with field whitelist, permission predicates, and tests                   |
| Sharing creates security gaps                        | Multi-user browser + API tests; shared viewer write denial                                          |
| Progress/status can be forged                        | Server-owned commands, malicious write tests, no editable progress fields                           |
| Restore corrupts relationships                       | Restore target contract, expected-version predicates, fail-closed invalid target tests              |
| Custom fields drift between forms/tables/reports     | Single metadata contract tested through settings -> form -> columns -> report/export                |
| Screenshots are not meaningful                       | Viewport- and locale-named screenshots for each touched surface                                     |

## Phase Order Recommendation

Implement in this order:

1. Phase 0 acceptance reset.
2. Phase 1 datasource/table foundations.
3. Phase 2 concurrency and server-owned state.
4. Phase 3 workbench/projects/share/star/recent.
5. Phase 4 standalone page/link authoring.
6. Phase 5 course builder.
7. Phase 6 track builder.
8. Phase 7 enrollment/player/progress.
9. Phase 8 trash/restore/copy/move.
10. Phase 9 custom fields/reports/settings.
11. Phase 10 generator/snapshot/docs/release gate.

This order deliberately fixes generic platform and correctness seams before polishing high-level LMS workflows.

## Implementation Closeout

These pre-IMPLEMENT approvals were resolved by the completed implementation cycle and are kept here as historical decisions, not as active tasks.

-   [x] This plan superseded the post-V2 Learning Content roadmap for the completed implementation cycle.
-   [x] The original first-slice recommendation was expanded through Phase 10 across subsequent implementation slices.
-   [x] Broad import/player formats, messaging, and AI generation remain deferred.
-   [x] Browser coverage stayed on the existing LMS runtime flow and executable fixture contract instead of introducing a separate product spec.
-   [x] Product code was refactored freely for regenerated test databases, templates, and LMS snapshots.
