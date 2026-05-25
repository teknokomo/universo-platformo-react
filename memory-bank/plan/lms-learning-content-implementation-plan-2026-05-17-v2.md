# LMS Learning Content Implementation Plan V2

Date: 2026-05-17
Mode: PLAN
Status: Implemented and reconciled through the 2026-05-18 final QA closure, supersedes `lms-learning-content-implementation-plan-2026-05-17.md`
Research artifact: [lms-learning-content-ispring-research-2026-05-17.md](../research/lms-learning-content-ispring-research-2026-05-17.md)

## Implementation Closure Note

The checklist below is closed as of the 2026-05-18 final QA closure. Checked items mean either:

- implemented in the canonical Learning Content model;
- validated through focused unit, backend, fixture-contract, or Playwright coverage;
- explicitly deferred by the first-slice scope decision in this plan.

The active LMS product path no longer keeps a compatible `Modules` content type. `LearningResources` is the only canonical public content object, `ContentProgress` is the unified progress object, and the remaining broad import/SCORM/xAPI/office conversion, internal messaging, and AI-generation scope stays deferred by design.

## Overview

Implement a real iSpring-like Learning Content subsystem for the LMS configuration generated into `tools/fixtures/metahubs-lms-app-snapshot.json`, while preserving Universo Platformo's core architecture:

- Metahub defines metadata, layouts, defaults, scripts, and seed/demo content.
- Application settings define global runtime defaults, menu behavior, resource policies, role policies, and player presets.
- Workspace runtime owns operational authoring and data: projects, pages, links, courses, tracks, enrollments, progress, sharing, and trash.
- The logical kernel remains generic Entity types: Hubs, Pages, Objects with Components, Sets, Enumerations, Ledgers, and attached TypeScript scripts.
- The published LMS app must be built with `packages/universo-react-apps-template-mui` and the original dense MUI dashboard style from `.backup/templates/dashboard`.
- Do not hardcode an LMS-only runtime fork. Add or extend generic platform primitives first.

The V2 emphasis is narrower and more product-focused than the first plan. The repository already contains many generic LMS primitives: safe resource source contracts, block-content authoring, resource preview, workflow actions, reports, sequence helpers, workspace runtime, and Playwright fixture generation. The missing work is not another broad platform groundwork pass. The missing work is a coherent Learning Content product surface:

1. Content Projects inside Workspaces.
2. A unified authoring library with Recent, Starred, Shared with me, Projects, and Trash.
3. Workspace-authored learning pages and links.
4. Course Builder with Course -> Section -> Course Item.
5. Learning Track Builder with stages and course order policies.
6. Manual enrollment and learner progress/player proof.
7. A regenerated canonical LMS snapshot created only by Playwright.

Broad file import, SCORM/xAPI runtime tracking, office conversion, internal messaging, and AI generation stay explicitly deferred.

## Planning Inputs Reviewed

Primary planning inputs:

- Updated research: `memory-bank/research/lms-learning-content-ispring-research-2026-05-17.md`.
- Previous plan: `memory-bank/plan/lms-learning-content-implementation-plan-2026-05-17.md`.
- Original user brief restated in this PLAN request.
- Local project state:
  - `memory-bank/tasks.md`
  - `memory-bank/activeContext.md`
  - `packages/universo-react-apps-template-mui/README.md`
  - `.backup/templates/dashboard/README.md`
  - `packages/universo-react-metahubs-backend/base/src/domains/templates/data/lms.template.ts`
  - `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
  - `tools/testing/e2e/support/lmsFixtureContract.ts`
  - `packages/universo-react-types/base/src/common/lmsPlatform.ts`
  - `packages/universo-react-types/base/src/common/resourceSources.ts`
  - `packages/universo-react-types/base/src/common/sequenceCompletion.ts`
  - `packages/universo-react-types/base/src/common/runtimeDataSources.ts`
  - `packages/universo-react-apps-template-mui/src/dashboard/components/CustomizedDataGrid.tsx`
  - `packages/universo-react-apps-template-mui/src/dashboard/components/MainGrid.tsx`

Current documentation checked through Context7:

- MUI X Data Grid v8 patterns: server-side pagination/sorting/filtering and `columnVisibilityModel`. Context7 returned v8.11.0 docs, while the workspace catalog currently targets MUI X `^8.27.0`, so implementation should verify exact prop availability against the installed package before coding.
- TanStack Query v5.90.3: optimistic mutation lifecycle with `onMutate`, query cancellation, snapshot, rollback, and invalidation.
- Editor.js: `editor.save()` JSON output, block `type`, read-only support, and tool sanitizer behavior.

## Review Result

The updated RESEARCH file is suitable as the planning basis. It correctly separates:

- iSpring documentation facts;
- local repository facts;
- architecture inferences for Universo.

The most important corrected inference is retained in V2: iSpring Projects must be workspace-scoped Learning Content records, not Universo Workspaces and not Metahubs.

The previous PLAN is directionally correct, but V2 improves it in five places:

1. It treats already completed generic primitives as baseline, not as new major phases.
2. It makes the replacement of the retired `Modules` course surrogate explicit.
3. It adds a current codebase gap matrix before implementation phases.
4. It splits "generic platform gaps" from "LMS product surfaces" so implementation does not drift into an LMS-only runtime fork.
5. It adds screenshot-driven CREATIVE checkpoints before high-risk UI work.

## Current Codebase Gap Matrix

### Already Available Baseline

- `@universo-react/apps-template-mui` is an independent MUI v7 runtime package with generic CRUD, dashboard widgets, runtime workspaces, workflow actions, block-content authoring, reports/export, and resource previews.
- `LearningResources.Body` already uses JSON `editorjsBlockContent` UI config in the LMS template.
- `@universo-react/types` already contains generic resource source validation, safe URL rules, deferred resource detection, workflow action contracts, role policy templates, LMS acceptance matrix contracts, and sequence/completion helpers.
- `CustomizedDataGrid` already supports server pagination, sorting, and filtering through MUI X Data Grid modes.
- Application settings already have role policy handling and validation previews for unsupported scopes.
- The LMS Playwright product generator exists and already seeds resources, courses, sections, tracks, enrollments, progress-like rows, reports, knowledge, development, workflow actions, and gamification.
- The current fixture contract already rejects some fake support and validates block content, resource source honesty, workflow metadata, reports, and menu rules.

### Missing Or Weak For iSpring-Like Learning Content

- `ContentProjects` does not exist in the LMS template.
- `ContentAccessEntries`, `ContentStars`, `RecentContentViews`, and runtime Trash records do not exist as product concepts.
- `CourseItems` does not exist. The current model uses `CourseSections` with direct `ResourceId` and `ModuleId`, which is not enough for iSpring's Course -> Section -> Content item structure.
- `TrackStages` does not exist. `TrackSteps` exists but still points to `ModuleId`/`ResourceId` rather than a course-centered track outline.
- `LearningTracks.TrackItems` is a table field around modules, which should not be the canonical track implementation.
- `runtimeDatasourceDescriptorSchema` does not support a generic union datasource for a unified project library over resources, courses, tracks, assignments, and quizzes.
- `CustomizedDataGrid` does not expose controlled `columnVisibilityModel`, so iSpring-like custom columns and metadata-defined course fields cannot yet be first-class runtime behavior.
- The acceptance matrix has broad `contentLibrary` and `courseDetail` areas, but lacks specific gates for Projects, page authoring, Course Builder, Track Builder, Trash/Restore, and Learner Player.
- The published app still behaves mostly like generic Object CRUD for LMS content. It does not yet feel like a cohesive Learning Content workspace.

## Target Architecture

### Boundary Model

Use this boundary consistently:

- Metahub: defines LMS metadata, default layouts, scripts, enums, sets, and seed examples.
- Application settings: configure global enabled resource types, player presets, role policies, menu behavior, column presets, and default completion policies.
- Workspace runtime: owns all real authoring, editing, copy, delete, restore, sharing, enrollment, and progress records.
- Content Project: a workspace-scoped Object record that groups Learning Content items inside the Workspace.

The 1C-style analogy maps to current Universo primitives as Objects + Components + workflow actions + ledgers + server-owned services + script hooks. Do not add a separate LMS business-engine layer when the behavior can be expressed by these generic primitives.

### Canonical Objects

V2 should converge the LMS template on these Objects:

- `ContentProjects`
- `ContentAccessEntries` with generic principals, not LMS-only user/group branching
- `ContentStars`
- `RecentContentViews`
- `TrashEntries` if generic trash needs an Object projection
- `LearningResources`
- `Courses`
- `CourseSections`
- `CourseItems`
- `LearningTracks`
- `TrackStages`
- `TrackSteps`
- `Enrollments`
- `LearnerProgress`
- `AssignmentSubmissions` if assignment-lite is kept in scope

`Modules` is no longer part of the active Learning Content product path. `LearningResources` and `CourseItems` replace the old course surrogate completely.

### Canonical Enumerations

- `ContentItemType`: Page, Link, Quiz, Assignment, Course, LearningTrack, Training, File, External.
- `ProjectAccessLevel`: CanView, CanEdit.
- `PublicationStatus`: Draft, Published, UnpublishedChanges, Archived.
- `ResourceType`: Page, Url, Video, Audio, Document, Embed, Scorm, Xapi, File.
- `CourseNavigationMode`: Free, Sequential.
- `CompletionCondition`: AllItems, SelectedItems.
- `CourseStatusFormat`: CompleteIncomplete, PassedFailed.
- `TrackOrderMode`: ByDays, Sequential, Free.
- `EnrollmentStatus`: NotStarted, InProgress, Completed, Failed, Overdue, Canceled.
- `DueDateMode`: UseSettings, ByDate, ForPeriod, NoDueDate.
- `TrashRestoreState`: Restorable, RequiresTarget, Expired, NotRestorable.

### Canonical Sets

- `LearningContentDefaults`
- `SupportedResourceTypes`
- `PlayerPresets`
- `LearningContentColumnPresets`
- `EnrollmentDefaults`
- `CompletionDefaults`

### Script Use

Use TypeScript scripts as configuration/business hooks, not as arbitrary client-side logic:

- `LearningContentAccessScript`
- `CourseProgressCalculationScript`
- `CourseCompletionScript`
- `TrackProgressCalculationScript`
- `SequenceAvailabilityScript`
- `RecentViewCaptureScript`
- `TrashRestoreValidationScript`

Server-owned services must still enforce permission, sequence, and persistence safety. Scripts customize trusted rule points after backend validation.

## Affected Areas

- `packages/universo-react-types/base/src/common/`
  - content references, project access, supported-resource policy, course/track policies, trash entries, union datasources, column presets.
- `packages/universo-react-utils/base/src/`
  - workspace package `@universo-react/utils`: existing UUID v7 helpers (`generateUuidV7`) and DB-side `$uuid_v7` defaults, localized label utilities, safe value coercion, snapshot/contract helpers.
- `packages/universo-react-metahubs-backend/base/src/domains/templates/data/lms.template.ts`
  - LMS Objects, Components, Enumerations, Sets, scripts, layouts, menu items, and seed metadata.
- `packages/universo-react-applications-backend/base/src/`
  - runtime rows, workspace-scoped queries, permission checks, soft-delete/restore, generic content references, progress/enrollment services, runtime datasource execution.
- `packages/universo-react-applications-frontend/base/src/`
  - generic application settings editors for Learning Content defaults, supported resource policy, player presets, role policies, and column presets.
- `packages/universo-react-apps-template-mui/src/`
  - Learning Content shell, generic union table/card view, controlled DataGrid column visibility, project dialogs, page authoring, course/track builders, learner player.
- i18n locale packages:
  - `packages/universo-react-i18n/base/src/locales/{en,ru}/` for labels that are genuinely shared by multiple frontend packages;
  - `packages/universo-react-apps-template-mui/src/i18n/locales/{en,ru}/apps.json` for published runtime Learning Content labels;
  - `packages/universo-react-applications-frontend/base/src/i18n/locales/{en,ru}/applications.json` for application control-panel settings labels;
  - `packages/universo-react-metahubs-frontend/base/src/i18n/locales/{en,ru}/metahubs.json` for metahub authoring labels owned by the metahub UI.
- `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
  - canonical product snapshot generation through Playwright/API-supported flows.
- `tools/testing/e2e/support/lmsFixtureContract.ts`
  - Learning Content-specific contract gates.
- `tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
  - imported runtime proof and screenshots.
- `tools/testing/e2e/specs/generators/docs-entity-screenshots.spec.ts`
  - screenshot generation for GitBook docs, or a focused new Learning Content screenshot generator.
- `docs/en`, `docs/ru`
  - GitBook LMS Learning Content, page authoring, Course Builder, Track Builder, player, and fixture regeneration docs.
- Package READMEs:
  - `packages/universo-react-apps-template-mui/README.md`
  - `packages/universo-react-metahubs-backend/base/README.md`
  - `tools/testing/e2e/README.md`

## Plan Steps

### Phase 0. Baseline Contract And Scope Freeze

- [x] Mark this V2 plan as the current Learning Content plan in implementation notes before coding starts.
- [x] Add a small "Learning Content V2" implementation ledger to `memory-bank/tasks.md` during IMPLEMENT, not during PLAN.
- [x] Freeze first-slice scope:
  - Projects;
  - standalone Pages and Links;
  - Course Builder;
  - Learning Track Builder;
  - manual enrollment;
  - learner player/progress;
  - Trash/restore;
  - generated snapshot and docs.
- [x] Explicitly defer:
  - SCORM/xAPI runtime tracking;
  - file upload/import/conversion;
  - broad video/audio/office players;
  - internal messages;
  - AI generation;
  - full quiz engine;
  - full classroom training scheduling.
- [x] Add or revise fixture-contract areas:
  - `contentProjects`;
  - `learningContentShell`;
  - `standalonePageAuthoring`;
  - `standaloneLinkResources`;
  - `courseBuilder`;
  - `trackBuilder`;
  - `manualEnrollment`;
  - `learnerPlayer`;
  - `trashRestore`.

Acceptance:

- The acceptance contract can fail when the snapshot only contains placeholder LMS rows.
- The contract distinguishes seeded, visible, actionable, workspace-isolated, audited, and covered-by-e2e gates.

### Phase 1. Generic Contracts For Content References And Project Library

- [x] Add strict shared schemas in `@universo-react/types`:
  - `runtimeContentRefSchema`;
  - `contentProjectSchema`;
  - `contentAccessEntrySchema`;
  - `contentStarSchema`;
  - `recentContentViewSchema`;
  - `trashEntrySchema`;
  - `courseCompletionPolicySchema`;
  - `trackOrderPolicySchema`;
  - `playerPresetSchema`;
  - `learningContentColumnPresetSchema`.
- [x] Add a generic `records.union` or `runtimeContentLibrary` datasource contract after checking the best naming fit with existing `runtimeDataSources.ts`.
- [x] Keep union datasource target resolution server-side. Browser payloads may identify allowed Object codenames, but must never select physical tables.
- [x] Keep persisted IDs on the existing UUID v7 path: `generateUuidV7` in TypeScript helpers and `$uuid_v7`/database defaults for server-created runtime rows. Do not introduce `crypto.randomUUID()` for persisted records.
- [x] Add tests for schema success and rejection paths:
  - unknown Object codename;
  - malformed UUID;
  - unknown content type;
  - unsupported resource state;
  - unsafe URL;
  - invalid column preset.
- [x] Model sharing principals generically:
  - `PrincipalType`;
  - `PrincipalId`;
  - first supported type: workspace member/user;
  - group, department, and class principals stay disabled or fail closed until scoped predicates are implemented.
- [x] Export new contracts through package index files and update `@universo-react/types` README.

Acceptance:

- All new schemas are strict where safety matters.
- No LMS template file carries local copies of shared contracts.

### Phase 2. Runtime Soft Delete, Trash, And Restore

- [x] Audit current runtime Object row delete behavior in `applications-backend`.
- [x] Keep backend data access inside the existing SQL-first boundary: request-scoped `DbExecutor` for authenticated flows, `qSchemaTable`/`qColumn` for dynamic identifiers, parameterized SQL for values, and no direct `knex`/`getKnex()` imports in new domain stores or controllers.
- [x] Build on existing runtime lifecycle fields instead of adding parallel deletion columns:
  - `_upl_deleted`;
  - `_upl_deleted_at`;
  - `_upl_deleted_by`;
  - `_app_deleted`;
  - `_app_deleted_at`;
  - `_app_deleted_by`.
- [x] Store Trash-specific expiry and restore state through generic trash metadata, a generic Object projection, or explicit lifecycle extension only if implementation proves the extension is reusable beyond LMS.
- [x] Add workspace-scoped Trash query and restore endpoints.
- [x] Enforce restore permissions before returning runtime metadata or row details.
- [x] Keep hard delete reserved for expired cleanup/internal admin paths.
- [x] Require optimistic concurrency for destructive/restore operations when the row exposes `_upl_version`; stale `expectedVersion` must fail with a conflict instead of silently deleting/restoring the current row.
- [x] Add direct store tests:
  - delete uses `UPDATE ... RETURNING`;
  - zero-row delete fails closed;
  - stale-version delete/restore fails closed;
  - restore after expiry fails;
  - restore without permission fails closed;
  - restore into missing project fails;
  - restore into another project requires edit permission there.
- [x] Add generic Trash table/card surface in `apps-template-mui`.

Acceptance:

- A deleted content item disappears from active project lists and appears in Trash with deleted by/date.
- Restore brings it back when the project still exists and the user can edit it.
- The feature is generic, not named around LMS-specific routes.

### Phase 3. LMS Template Reshape Around Projects And Course Items

- [x] Add `ContentProjects` with Components:
  - Title;
  - Description;
  - OwnerUserId;
  - runtime workspace binding through the existing workspace system column/context, not an editable duplicate `WorkspaceId` business Component;
  - optional read-only workspace display metadata only if needed for the UI;
  - AccessMode;
  - Cover/Thumbnail;
  - SortOrder;
  - ArchivedAt.
- [x] Add `ContentAccessEntries`:
  - TargetObjectCodename;
  - TargetRecordId;
  - PrincipalType;
  - PrincipalId;
  - AccessLevel;
  - InvitedBy;
  - InvitedAt.
- [x] Validate access entries against current Workspace membership before saving. Group/department/class principals must remain disabled or fail closed until the corresponding generic scoped-capability predicates exist.
- [x] Add `ContentStars` and `RecentContentViews`.
- [x] Add or project generic Trash metadata into `TrashEntries` only if the published app needs Object-like display metadata.
- [x] Update `LearningResources`:
  - ProjectId;
  - FolderId only if folders ship;
  - Title;
  - ResourceType;
  - Source;
  - Body;
  - PublicationStatus;
  - EstimatedTimeMinutes;
  - Language;
  - Version;
  - Thumbnail;
  - CreatedBy.
- [x] Update `Courses`:
  - ProjectId;
  - Title;
  - Description;
  - Status;
  - NavigationMode;
  - CompletionCondition;
  - StatusFormat;
  - Cover;
  - Instructor;
  - Tags;
  - Catalog flags for later learner catalog work.
- [x] Update `CourseSections` so it only represents section/grouping metadata:
  - CourseId;
  - Title;
  - Description;
  - SortOrder.
- [x] Add `CourseItems` as ordered polymorphic references:
  - CourseId;
  - SectionId;
  - TargetObjectCodename;
  - TargetRecordId;
  - ItemType;
  - SortOrder;
  - IsRequired;
  - CompletionWeight;
  - AvailabilityOverride;
  - EstimatedTimeMinutes.
- [x] Update `LearningTracks`:
  - ProjectId;
  - Title;
  - Description;
  - Status;
  - OrderMode;
  - Cover;
  - Instructor;
  - Tags.
- [x] Add `TrackStages` and revise `TrackSteps`:
  - TrackId;
  - StageId;
  - CourseId;
  - SortOrder;
  - EnrollmentOffsetDays;
  - DueOffsetDays;
  - RestrictAfterDueDate;
  - IsRequired.
- [x] Remove or demote `Modules` where it conflicts with the new model.
- [x] Add localized layouts for:
  - Learning Content home;
  - project detail;
  - learning resource detail;
  - course detail;
  - track detail;
  - learner player;
  - trash.
- [x] Do not bump schema/template versions.

Acceptance:

- Fresh LMS metahub has a coherent Learning Content metadata model before seed data is added.
- The model represents iSpring's Course -> Section -> Content item structure.
- Projects are clearly inside Workspaces.

### Phase 4. Application Settings For Learning Content Defaults

- [x] Extend existing application settings pages instead of creating an LMS-only control panel.
- [x] Add generic settings groups:
  - supported resource types and deferred labels;
  - default Learning Content view;
  - default course completion policy;
  - default track order policy;
  - player preset;
  - column presets;
  - author/reviewer/learner/manager role-policy templates.
- [x] Validate settings with shared schemas before persistence.
- [x] Use TanStack Query v5 optimistic updates with rollback for modified settings forms if current forms do not already cover that mutation.
- [x] Add EN/RU i18n keys in the shared i18n package.
- [x] Add tests for invalid settings, unsupported scopes, and localized validation feedback.

Acceptance:

- Application admins can configure Learning Content behavior without editing JSON.
- Unsupported settings fail closed and remain visible as localized validation feedback.

### Phase 5. Published Learning Content Shell

- [x] Build a metadata-configured Learning Content runtime surface in `apps-template-mui`, not a separate LMS app.
- [x] Reuse existing dashboard primitives:
  - `ViewHeaderMUI`;
  - `ToolbarControls`;
  - `ItemCard`;
  - `CustomizedDataGrid`;
  - existing `detailsTable`/`MainGrid` enhanced details surface;
  - `FlowListTable`;
  - `RowActionsMenu`;
  - `CrudDialogs`;
  - runtime menu/workspace primitives.
- [x] Extend existing generic table/card/details surfaces before introducing a new widget key. If a new widget key becomes unavoidable, make it a generic runtime primitive with a shared schema in `@universo-react/types`, not an LMS-only component.
- [x] Any union datasource response must adapt to the existing `detailsTable`/`MainGrid` and `CustomizedDataGrid` contracts before a new Learning Content table component is considered.
- [x] Add left navigation:
  - Recent;
  - Starred;
  - Shared with me;
  - Projects;
  - Trash.
- [x] Add project list scoped to current Workspace.
- [x] Add selected project header:
  - project title;
  - project members/access summary;
  - Create button;
  - Upload button shown as disabled/deferred until imports exist.
- [x] Add unified table/card toggle over the union datasource.
- [x] Add columns:
  - Title;
  - Type;
  - Status;
  - Enrollments;
  - Updated;
  - Created by;
  - Project;
  - Shared;
  - Starred.
- [x] Extend `CustomizedDataGrid` with controlled `columnVisibilityModel` and `onColumnVisibilityModelChange`.
- [x] Persist column/view preferences through existing runtime preference helpers or a generic preference Object if needed.
- [x] Add row actions:
  - open;
  - preview;
  - edit;
  - copy;
  - move;
  - invite;
  - star/unstar;
  - delete.
- [x] Pass current `_upl_version`/`expectedVersion` from row actions into destructive, copy, and workflow mutations when the current row has version metadata.
- [x] Add Create menu options:
  - Project;
  - Page;
  - Link;
  - Course;
  - Learning Track;
  - Assignment-lite if enabled;
  - Quiz-lite if enabled.
- [x] Add desktop and mobile Playwright screenshots.

Acceptance:

- A Workspace editor can create a Project and see it immediately in the project list.
- Recent, Starred, Shared with me, Projects, and Trash are visible and backed by real data paths.
- The UI remains dense and operational, matching the MUI dashboard template style rather than a marketing layout.

### Phase 6. Page Authoring And Standalone Resources

- [x] Reuse `@universo-react/block-editor` for `LearningResources.Body`.
- [x] Keep normal users away from raw JSON editing for authored pages.
- [x] Add title/name sync:
  - title drives page name until name is manually edited;
  - store a manual-name flag if needed.
- [x] Add chapter/outline extraction from headings.
- [x] Add draft, published, and unpublished-changes status.
- [x] Add preview mode using read-only block rendering.
- [x] Add learner page rendering with reading progress metadata.
- [x] Validate block content on backend writes, not only in Editor.js.
- [x] Add standalone resource support for:
  - Page;
  - Url;
  - Embed for allowed hosts;
  - URL-backed video/audio/document only where current runtime proof exists.
- [x] Keep SCORM, xAPI, storage-backed files, and office formats as deferred placeholders.
- [x] Reuse `ResourcePreview` for resource preview states.
- [x] Add tests and E2E proof:
  - create page in project;
  - edit body in the visual editor;
  - publish;
  - preview;
  - reopen as learner/player;
  - create safe link;
  - reject unsafe URL.

Acceptance:

- A page created in a Workspace survives export/import.
- Unsafe blocks and URLs are rejected.
- Deferred resource states are honest and localized.

### Phase 7. Course Builder

- [x] Implement `CourseItems` as the canonical course outline item model.
- [x] Add metadata-driven course detail tabs:
  - Outline;
  - General;
  - Availability;
  - Completion;
  - Enrollments;
  - Reports.
- [x] Build Outline as a generic sequence/relation builder:
  - sections;
  - content item rows;
  - icon actions;
  - stable dimensions;
  - no nested cards inside cards.
- [x] Prefer extending existing `FlowListTable`, `RuntimeInlineTabularEditor`, `CrudDialogs`, and relation/table-part patterns before adding a new drag-and-drop or outline dependency.
- [x] Add section create/edit/delete/reorder.
- [x] Add content item picker:
  - project-scoped;
  - access-aware;
  - type filter;
  - status and estimated time display;
  - no raw IDs in UI.
- [x] Add inline "create Page" and "create Link" from outline.
- [x] Add required/optional flags and completion weights.
- [x] Add 100-item warning for large courses.
- [x] Add completion settings:
  - free/sequential navigation;
  - all/selected items;
  - complete/incomplete or passed/failed;
  - selected required/scored items;
  - rated-item warning before passed/failed scoring.
- [x] Add course copy semantics:
  - copy metadata and outline;
  - do not copy enrollments/reports by default;
  - leave linked copies as explicit deferred behavior unless implemented generically.
- [x] Add backend tests for course item ordering, polymorphic reference validation, delete behavior, and copy behavior.
  - [x] Add copy behavior coverage for metadata-defined CourseSections/CourseItems relations, SectionId remapping, and enrollment/progress/report exclusion.
  - [x] Add published-app copy UI integration coverage proving Copy uses the runtime copy endpoint with override data and optimistic version checks.

Acceptance:

- A Workspace editor can build a course from a newly authored page and link.
- Course outline is not JSON editing.
- Sequential and completion policies are stored through generic contracts.

### Phase 8. Progress, Completion, And Learner Player

- [x] Add a backend progress service with script hooks for:
  - resource opened;
  - page completed;
  - course item completed;
  - course progress recalculated;
  - track progress recalculated.
- [x] Store progress in Object rows and ledgers where appropriate, with backend-owned writes.
- [x] Add fail-closed complete/recalculate runtime actions.
- [x] Build generic CourseItems learner player shell:
  - outline rail;
  - content pane;
  - progress header;
  - locked/unlocked states;
  - current/next navigation;
  - read-only page rendering;
  - safe resource preview.
- [x] Implement free and sequential course modes first through metadata-defined `sequencePolicy`.
- [x] Surface generic scoped sequential availability in CourseItems and TrackSteps completion tables through detailsTable `sequencePolicy`.
- [x] Reject direct progress writes for metadata-locked CourseItems and TrackSteps through generic `runtimeProgress.sequencePolicy`.
- [x] Implement explicit Complete button for V1 page completion.
- [x] Add tests:
  - weighted progress;
  - required vs optional items;
  - sequential locking;
  - direct API locked-item rejection;
    - [x] Direct progress endpoint rejects locked CourseItems with `SEQUENCE_ITEM_LOCKED`.
    - [x] Invalid runtime progress sequence metadata fails closed with `SEQUENCE_POLICY_INVALID`.
  - stale/missing enrollment fail-closed behavior.

Acceptance:

- Learner can open an assigned course, view page/link content, complete allowed items, and see progress update.
- Locked items cannot be opened through UI or direct API.

### Phase 9. Learning Track Builder

- [x] Add `TrackStages`.
- [x] Align `TrackSteps` around course references and stage membership.
- [x] Add track detail tabs:
  - Outline;
  - General;
  - Availability;
  - Completion;
  - Enrollments;
  - Reports.
- [x] Reuse the generic sequence/relation builder:
  - stage headers;
  - course rows/cards;
  - order mode selector: by days, sequential, free;
  - per-course enrollment offset and due offset.
- [x] Reuse the same Course Builder sequence/relation primitive for track stages and steps; do not add a second track-specific builder.
- [x] Add warnings when editing a track with active enrollments.
- [x] Calculate track progress from child course progress.
- [x] Add track copy semantics through the same metadata-defined relation copy primitive used by Course Builder.
- [x] Add E2E proof:
  - create track;
  - add stage;
  - add course;
  - set sequential order;
  - enroll learner;
  - open learner player and verify gating.

Acceptance:

- Track behavior is a layer over courses, not a duplicate course system.
- Track progress updates after child course progress.

### Phase 10. Manual Enrollment And Catalog-Ready Metadata

- [x] Add generic Enrollment Wizard with MUI Stepper:
  - content selection;
  - users/workspace members;
  - parameters.
- [x] Support parameters:
  - start date;
  - due by date;
  - due for period;
  - no due date;
  - restrict after due date.
- [x] Add enrollment list tab:
  - learner;
  - status;
  - due date;
  - progress;
  - search/filter;
  - CSV export if the generic export path already covers it.
- [x] Add basic learner "My Courses" view over enrollments.
- [x] Add catalog-ready flags/categories to course/track metadata, but keep full self-enrollment approval for a later slice.
- [x] Add tests for permission, due date validation, learner visibility, and workspace isolation.

Acceptance:

- Author can enroll a learner in a course/track.
- Learner sees enrolled content in the published app.
- Direct API cannot enroll without permission.

### Phase 11. Fixture Generator And Snapshot Contract

- [x] Update `metahubs-lms-app-export.spec.ts` for the new canonical model.
- [x] Generate data through product-like flows where UI proof matters; use API setup only for deep seed data already covered by focused UI tests.
- [x] Seed realistic bilingual records:
  - two content projects;
  - project access entries;
  - recent/starred/shared examples;
  - multiple page resources with Editor.js content;
  - safe links;
  - deferred SCORM/xAPI/file placeholders;
  - two courses with sections/items;
  - one learning track with stages/courses;
  - manual enrollments;
  - progress rows;
  - one trash example if it does not make the fixture feel broken.
- [x] Strengthen `lmsFixtureContract.ts`:
  - required entities;
  - required components;
  - required policies;
  - required menu targets;
  - specific Learning Content acceptance gates;
  - no retired `Modules` course surrogate;
  - no false SCORM/xAPI/file support;
  - no schema/template version bump.
- [x] Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only through Playwright.
- [x] Run import/runtime flow under the E2E runner after implementation.

Acceptance:

- The committed snapshot is self-contained and useful after import.
- Manual edits to snapshot JSON are not part of the workflow.

### Phase 12. Testing Strategy

Testing must be implemented throughout the phases, not postponed.

- [x] Jest/backend:
  - runtime stores;
  - permission guards;
  - content reference resolution;
  - soft delete/restore;
  - stale-version conflicts for delete, restore, workflow actions, and course/track item reorder where version metadata is available;
  - system lifecycle field behavior for `_upl_deleted_*` and `_app_deleted_*`;
  - workspace membership validation for access entries;
  - course item ordering;
  - runtime copy relations;
  - progress calculation;
  - enrollment mutation;
  - report filters.
- [x] Vitest/shared/frontend:
  - Zod schemas;
  - resource source safety;
  - completion/sequence helpers;
  - settings forms;
  - DataGrid column visibility;
  - Create menu;
  - project dialog;
  - page editor field integration;
  - Course Builder;
  - Track Builder;
  - ResourcePreview.
- [x] Playwright:
  - product snapshot generator;
  - imported LMS snapshot runtime;
  - Learning Content shell;
  - project authoring;
  - page editor screenshot;
  - course builder screenshot;
  - track builder screenshot;
  - [x] learner player screenshot;
  - mobile viewport smoke.
- [x] Visual checks:
  - inspect screenshots, do not infer UI quality from code;
  - verify no overlapping text;
  - verify MUI dashboard visual parity;
  - verify desktop and mobile views.
- [x] E2E guardrails:
  - do not run `pnpm dev`;
  - use the repository Playwright wrapper;
  - use `http://127.0.0.1:3100`;
  - use Node 22;
  - use `pnpm supabase:e2e:start:minimal` only for explicit local Supabase validation.

Acceptance:

- Every shipped Learning Content workflow has unit/integration and browser proof.
- Screenshots become part of acceptance, not a documentation afterthought.

### Phase 13. Documentation

- [x] Add GitBook pages:
  - `docs/en/guides/lms-learning-content.md`;
  - `docs/ru/guides/lms-learning-content.md`;
  - course builder guide;
  - learning track guide;
  - resource/page authoring guide;
  - fixture regeneration guide.
- [x] Update existing docs:
  - LMS Overview;
  - LMS Resource Model;
  - LMS Setup;
  - Workspaces;
  - Pages Entity Type;
  - Ledgers if progress/ledger contracts change.
- [x] Update package READMEs:
  - `packages/universo-react-apps-template-mui/README.md`;
  - `packages/universo-react-metahubs-backend/base/README.md`;
  - `tools/testing/e2e/README.md`.
- [x] Add screenshots generated from real Playwright runs.
- [x] Keep EN/RU docs aligned and update GitBook SUMMARY files.

Acceptance:

- Docs describe actual implemented functionality.
- Deferred features are labeled as deferred and do not look complete.

## Design Notes

Run a CREATIVE/DESIGN checkpoint before implementing Phases 5, 7, and 8. The checkpoint should produce screenshot-oriented UI specs for:

- Learning Content shell:
  - dense project/navigation layout;
  - table/card toggle;
  - create menu;
  - sharing/star/trash states.
- Course Builder:
  - tabs;
  - outline;
  - section/item editing;
  - completion settings.
- Learner Player:
  - outline rail;
  - content pane;
  - locked states;
  - progress indicators.

Design must stay in the `apps-template-mui` visual language:

- MUI dashboard spacing and outlined surfaces;
- compact operational layout;
- icons in action buttons;
- no hero/marketing page;
- no card-inside-card composition;
- stable dimensions for toolbars, table rows, sequence rows, and player rail.

## Code Examples For Implementation Quality

### Strict Content Reference Schema

```ts
import { z } from 'zod'

const codenameSchema = z.string().trim().min(1).max(128)
const uuidSchema = z.string().uuid()

export const runtimeContentRefSchema = z
  .object({
    objectCodename: codenameSchema,
    recordId: uuidSchema,
    displayType: z.enum(['resource', 'course', 'track', 'assignment', 'quiz', 'training'])
  })
  .strict()

export type RuntimeContentRef = z.infer<typeof runtimeContentRefSchema>
```

### Server-Side Target Resolution

```ts
type RuntimeObjectMetadata = {
  id: string
  codename: string
  contentReferenceEnabled?: boolean
}

export function resolveAllowedContentTarget(
  objectsByCodename: ReadonlyMap<string, RuntimeObjectMetadata>,
  value: unknown
) {
  const ref = runtimeContentRefSchema.parse(value)
  const target = objectsByCodename.get(ref.objectCodename)

  if (!target?.contentReferenceEnabled) {
    throw new Error('CONTENT_TARGET_NOT_ALLOWED')
  }

  return {
    objectId: target.id,
    objectCodename: target.codename,
    recordId: ref.recordId,
    displayType: ref.displayType
  }
}
```

### SQL-First Fail-Closed Mutation

```ts
import { qColumn, qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'

type SoftDeleteInput = {
  schemaName: string
  tableName: string
  rowId: string
  deletedBy: string
  expectedVersion?: number
}

export async function softDeleteRuntimeRecord(executor: DbExecutor, input: SoftDeleteInput) {
  const table = qSchemaTable(input.schemaName, input.tableName)
  const hasExpectedVersion = typeof input.expectedVersion === 'number'
  const versionClause = hasExpectedVersion
    ? `and coalesce(${qColumn('_upl_version')}, 1) = $3`
    : ''

  const result = await executor.query<{ id: string }>(
    `
      update ${table}
      set ${qColumn('_upl_deleted')} = true,
          ${qColumn('_upl_deleted_at')} = now(),
          ${qColumn('_upl_deleted_by')} = $2,
          ${qColumn('_upl_updated_at')} = now(),
          ${qColumn('_upl_updated_by')} = $2,
          ${qColumn('_upl_version')} = coalesce(${qColumn('_upl_version')}, 1) + 1,
          ${qColumn('_app_deleted')} = true,
          ${qColumn('_app_deleted_at')} = now(),
          ${qColumn('_app_deleted_by')} = $2
      where ${qColumn('id')} = $1
        and ${qColumn('_upl_deleted')} is not true
        and ${qColumn('_app_deleted')} is not true
        ${versionClause}
      returning ${qColumn('id')}
    `,
    hasExpectedVersion ? [input.rowId, input.deletedBy, input.expectedVersion] : [input.rowId, input.deletedBy]
  )

  if (result.rows.length !== 1) {
    throw new Error('RUNTIME_RECORD_DELETE_FAILED')
  }

  return result.rows[0]
}
```

### MUI DataGrid Server Modes And Column Visibility

```tsx
<DataGrid
  rows={rows}
  columns={columns}
  rowCount={rowCount}
  paginationMode="server"
  sortingMode="server"
  filterMode="server"
  paginationModel={paginationModel}
  sortModel={sortModel}
  filterModel={filterModel}
  columnVisibilityModel={columnVisibilityModel}
  onPaginationModelChange={setPaginationModel}
  onSortModelChange={setSortModel}
  onFilterModelChange={setFilterModel}
  onColumnVisibilityModelChange={setColumnVisibilityModel}
/>
```

### TanStack Query V5 Optimistic Mutation

```tsx
import { useMutation } from '@tanstack/react-query'

export function useStarContent(projectId: string) {
  const queryKey = ['learning-content', projectId]

  return useMutation({
    mutationFn: starContent,
    onMutate: async (variables, context) => {
      await context.client.cancelQueries({ queryKey })
      const previousRows = context.client.getQueryData(queryKey)

      context.client.setQueryData(queryKey, (old: unknown) => {
        if (!Array.isArray(old)) return old
        return old.map((row) =>
          typeof row === 'object' && row && 'id' in row && row.id === variables.recordId
            ? { ...row, starred: true }
            : row
        )
      })

      return { previousRows }
    },
    onError: (_error, _variables, result, context) => {
      context.client.setQueryData(queryKey, result?.previousRows)
    },
    onSettled: (_data, _error, _variables, _result, context) => {
      context.client.invalidateQueries({ queryKey })
    }
  })
}
```

### Editor.js Output Normalization Gate

```ts
import { z } from 'zod'

const editorBlockSchema = z
  .object({
    id: z.string().trim().min(1).max(128).optional(),
    type: z.enum(['paragraph', 'header', 'list', 'quote', 'table', 'image', 'embed', 'delimiter']),
    data: z.record(z.string(), z.unknown()),
    tunes: z.record(z.string(), z.unknown()).optional()
  })
  .strict()

export const editorJsOutputSchema = z
  .object({
    time: z.number().int().optional(),
    blocks: z.array(editorBlockSchema).max(200),
    version: z.string().trim().min(1).max(32).optional()
  })
  .strict()
```

## Potential Challenges

### Project vs Workspace Confusion

Mitigation:

- Use explicit UI labels: Workspace switcher stays global; Project belongs to Learning Content.
- Store every Project under the current Workspace.
- Add tests proving two Workspaces can have Projects with the same title and isolated content.

### Retired Modules Shape

Mitigation:

- Replace the course critical path with `CourseItems`.
- Keep `Modules` out of the active LMS Learning Content template, generated fixture, public guest access path, and workspace seed remap.
- Keep fixture contract checks that reject old surrogate course structures.

### Generic Union Datasource Safety

Mitigation:

- Resolve allowed Object codenames from server-side metadata.
- Never accept raw table names from browser input.
- Restrict union columns to an explicit public column map.
- Test unknown codenames, unsupported fields, and workspace boundary leaks.

### Course Builder Complexity

Mitigation:

- Build a generic sequence/relation builder.
- Configure labels, item types, and target Objects through metadata.
- Reuse the same builder for `CourseItems` and `TrackSteps`.

### Script vs Service Boundary

Mitigation:

- Backend services own persistence, permission, and fail-closed checks.
- Scripts customize calculation and policy decisions after validated inputs.
- Add deterministic service tests before script customization tests.

### UI Scope Creep

Mitigation:

- V2 ships Pages, Links, Courses, Tracks, Manual Enrollment, Player, and Trash.
- Keep SCORM/xAPI/import/AI/messages/advanced quizzes out of first slice.
- Make deferred states visible and localized.

## Dependencies

- Node 22 and PNPM 10 remain required.
- New dependencies must be added through the `pnpm-workspace.yaml` catalog. Prefer existing MUI, MUI icons, `apps-template-mui` primitives, and current runtime helpers before adding a dependency.
- E2E runner owns app startup on `http://127.0.0.1:3100`; do not run `pnpm dev`.
- Local Supabase minimal is required only for explicit local validation.
- `@universo-react/block-editor` remains the shared Editor.js integration.
- `packages/universo-react-apps-template-mui` remains isolated and must not import from legacy `@universo-react/template-mui`.
- `@universo-react/types`, `@universo-react/utils`, backend runtime APIs, fixture contracts, and Playwright generator must stay in sync.

## Implementation Order Recommendation

1. Phase 0 first: freeze scope and acceptance gates.
2. Phase 1 next: shared contracts and safe datasource/reference model.
3. Phase 2 next: generic Trash, because delete semantics affect every content type.
4. Phase 3 next: reshape LMS metadata around Projects and CourseItems.
5. Phase 4 next: application settings for defaults and policies.
6. Run CREATIVE/DESIGN for Learning Content shell.
7. Phase 5 and Phase 6: Projects, library shell, pages, and links as the first visible product slice.
8. Run CREATIVE/DESIGN for Course Builder and Learner Player.
9. Phase 7 and Phase 8: Course Builder, progress, and learner player.
10. Phase 9 and Phase 10: Track Builder, manual enrollment, and catalog-ready metadata.
11. Phase 11: regenerate and validate the canonical snapshot.
12. Phase 12 and Phase 13: testing and documentation are continuous, with final hardening at the end.

## Done Definition

The Learning Content implementation is done when a fresh import of `tools/fixtures/metahubs-lms-app-snapshot.json` produces an LMS app where a Workspace editor can:

1. Create a content project.
2. Invite or share content with another user where supported by current workspace membership.
3. Create and publish an Editor.js learning page inside the project.
4. Create a safe link resource inside the project.
5. Star, preview, copy, delete, and restore content through the Learning Content shell.
6. Build a course with sections and required/optional content items.
7. Configure basic completion and navigation policy.
8. Build a learning track from courses.
9. Enroll a learner manually.
10. Open the learner player and complete at least one page/course flow.
11. See progress update.
12. Validate the same flow through unit tests, backend tests, Vitest, Playwright, screenshots, and GitBook docs.

The implementation must not:

- add an LMS-only runtime fork;
- require raw JSON editing for normal content authoring;
- claim unsupported file/SCORM/xAPI capabilities as complete;
- hand-edit the committed snapshot JSON;
- bump schema/template versions just for the fresh LMS fixture rebuild;
- preserve obsolete fixture-only shapes when they conflict with the target Learning Content model.
