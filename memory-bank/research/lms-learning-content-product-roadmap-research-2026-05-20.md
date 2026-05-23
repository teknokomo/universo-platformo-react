# Research: LMS Learning Content Product Roadmap After V2

> Created: 2026-05-20
> Status: Draft
> Trigger: `RESEARCH` request to re-study iSpring LMS Learning Content and produce a planning-ready roadmap for the Universo LMS configuration.
> Follow-up plan: Recommended next file `../plan/lms-learning-content-product-roadmap-plan-2026-05-20.md` if the user starts PLAN mode.

## Research Question

What Learning Content functionality from iSpring LMS is still product-relevant for the Universo LMS configuration, and how should the next implementation plan improve the current metadata-driven platform without creating an LMS-only runtime fork?

The decision this research supports:

-   keep Universo's architecture: Metahub defines base metadata and reusable logic, application settings define global defaults, and workspace runtime owns authored content and individual operational settings;
-   preserve Workspaces as the main application container and model iSpring-like Projects as content containers inside each Workspace;
-   use the existing generic Entity kernel: Hubs, Pages, Objects, Sets, Enumerations, ledgers, and attached TypeScript scripts;
-   continue using `packages/apps-template-mui` and the original MUI dashboard style;
-   regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only through the product Playwright flow when implementation later starts.

## Source Inventory

| Source                                                                                                | Type                                               | Date / Freshness                                              | Why It Matters                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://ispringhelpdocs.com/ispring-learn/ispring-lms-10683320.html                                   | Primary                                            | Accessed 2026-05-20; current iSpring Help Docs copyright 2026 | Confirms broad iSpring LMS content formats and explicitly supported created content types.                                                                                   |
| https://ispringhelpdocs.com/ispring-learn/learning-content-35665427.html                              | Primary                                            | Accessed 2026-05-20; current iSpring Help Docs copyright 2026 | Defines the Learning Content root: Projects plus Recent, Starred, and Shared with me.                                                                                        |
| https://ispringhelpdocs.com/ispring-learn/projects-35666255.html                                      | Primary                                            | Accessed 2026-05-20                                           | Defines Projects as collaboration/content clusters, not infrastructure workspaces.                                                                                           |
| https://ispringhelpdocs.com/ispring-learn/adding-a-project-35666262.html                              | Primary                                            | Accessed 2026-05-20                                           | Documents project title, team invitation, and `Can view` / `Can edit` access levels.                                                                                         |
| https://ispringhelpdocs.com/ispring-learn/access-to-content-35666364.html                             | Primary                                            | Accessed 2026-05-20                                           | Shows item-level sharing, individual access levels, shared icons, and Shared with collaborators filtering.                                                                   |
| https://ispringhelpdocs.com/ispring-learn/standalone-content-35666278.html                            | Primary                                            | Accessed 2026-05-20                                           | Defines standalone content and broad deferred formats.                                                                                                                       |
| https://ispringhelpdocs.com/ispring-learn/creating-a-standalone-content-item-35666351.html            | Primary                                            | Accessed 2026-05-20                                           | Confirms project-level Create menu for Page, Link, Quiz, and Assignment.                                                                                                     |
| https://ispringhelpdocs.com/ispring-learn/actions-with-standalone-content-35666366.html               | Primary                                            | Accessed 2026-05-20                                           | Defines edit, preview, replace, download, delete-to-trash, and replacement/version implications.                                                                             |
| https://ispringhelpdocs.com/ispring-learn/pages-10685013.html                                         | Primary                                            | Accessed 2026-05-20                                           | Defines Pages as no-code long-form LMS articles with media and interactive elements.                                                                                         |
| https://ispringhelpdocs.com/ispring-learn/creating-a-page-10685014.html                               | Primary                                            | Accessed 2026-05-20                                           | Confirms Page creation in either a Project or Course and title-to-name sync behavior.                                                                                        |
| https://ispringhelpdocs.com/ispring-learn/adding-elements-to-pages-10685017.html                      | Primary                                            | Accessed 2026-05-20                                           | Confirms moving, changing, duplicating, deleting blocks, and right-side settings sidebar.                                                                                    |
| https://ispringhelpdocs.com/ispring-learn/links-10683588.html                                         | Primary                                            | Accessed 2026-05-20                                           | Defines Web Link creation inside a course outline.                                                                                                                           |
| https://ispringhelpdocs.com/ispring-learn/courses-10683357.html                                       | Primary                                            | Accessed 2026-05-20                                           | Defines courses as sections plus content items or a direct row of content items.                                                                                             |
| https://ispringhelpdocs.com/ispring-learn/creating-a-course-16187609.html                             | Primary                                            | Accessed 2026-05-20                                           | Confirms project-scoped course creation and the recommendation to keep courses near 100 content items.                                                                       |
| https://ispringhelpdocs.com/ispring-learn/course-outline-10683358.html                                | Primary                                            | Accessed 2026-05-20                                           | Confirms Course -> Section -> Content item and learner/admin outline split.                                                                                                  |
| https://ispringhelpdocs.com/ispring-learn/adding-content-17303894.html                                | Primary                                            | Accessed 2026-05-20                                           | Confirms content item actions in course sections: edit, view, move, delete, download, replace for some types.                                                                |
| https://ispringhelpdocs.com/ispring-learn/course-completion-settings-35665810.html                    | Primary                                            | Accessed 2026-05-20                                           | Defines course navigation, completion condition, and status format.                                                                                                          |
| https://ispringhelpdocs.com/ispring-learn/course-completion-order-17302424.html                       | Primary                                            | Accessed 2026-05-20                                           | Defines Free vs Restricted/Sequential navigation and optional item availability.                                                                                             |
| https://ispringhelpdocs.com/ispring-learn/course-completion-condition-17302430.html                   | Primary                                            | Accessed 2026-05-20                                           | Defines all vs selected completion, 95% video completion threshold, and deletion recalculation.                                                                              |
| https://ispringhelpdocs.com/ispring-learn/scoring-a-course-35653408.html                              | Primary                                            | Accessed 2026-05-20                                           | Defines scoring prerequisites, rated item selection, and recalculation behavior.                                                                                             |
| https://ispringhelpdocs.com/ispring-learn/enrollments-16187447.html                                   | Primary                                            | Accessed 2026-05-20                                           | Defines multi-entry enrollment, Users/Courses/Parameters steps, due-date modes, and My Courses visibility.                                                                   |
| https://ispringhelpdocs.com/ispring-learn/learning-tracks-22611015.html                               | Primary                                            | Accessed 2026-05-20                                           | Defines learning tracks as larger programs over courses.                                                                                                                     |
| https://ispringhelpdocs.com/ispring-learn/learning-track-outline-22611018.html                        | Primary                                            | Accessed 2026-05-20                                           | Confirms stages/courses admin and learner views.                                                                                                                             |
| https://ispringhelpdocs.com/ispring-learn/course-completion-order-within-learning-track-22613656.html | Primary                                            | Accessed 2026-05-20                                           | Defines By days, Sequential, Free, enrollment dates, due dates, and due-date access restriction.                                                                             |
| https://ispringhelpdocs.com/ispring-learn/editing-a-learning-track-22613645.html                      | Primary                                            | Accessed 2026-05-20                                           | Confirms edit mode warning for enrolled learners and due date impact.                                                                                                        |
| https://ispringhelpdocs.com/ispring-learn/actions-with-learning-tracks-22611155.html                  | Primary                                            | Accessed 2026-05-20                                           | Defines track copy/move/delete semantics and what is intentionally not copied.                                                                                               |
| https://ispringhelpdocs.com/ispring-learn/learning-track-enrollment-48334181.html                     | Primary                                            | Accessed 2026-05-20                                           | Confirms track enrollment entry points and due-date modes.                                                                                                                   |
| https://ispringhelpdocs.com/ispring-learn/automatic-assignment-of-learning-track-128353504.html       | Primary                                            | Accessed 2026-05-20                                           | Defines automatic assignment rules and non-retroactive behavior; deferred beyond the current core slice.                                                                     |
| https://ispringhelpdocs.com/ispring-learn/automatic-re-enrollments-22609945.html                      | Primary                                            | Accessed 2026-05-20                                           | Defines course re-enrollment constraints; deferred beyond the current core slice.                                                                                            |
| https://ispringhelpdocs.com/ispring-learn/trash-100867397.html                                        | Primary                                            | Accessed 2026-05-20                                           | Defines 30-day Trash, restore rules, roles, deleted-by/date columns, and non-restorable cases.                                                                               |
| https://ispringhelpdocs.com/ispring-learn/content-statuses-in-reports-10684550.html                   | Primary                                            | Accessed 2026-05-20                                           | Defines status semantics per content type, including Pages, Assignments, Courses, and Tracks.                                                                                |
| https://ispringhelpdocs.com/ispring-learn/custom-course-fields-100866604.html                         | Primary                                            | Accessed 2026-05-20                                           | Defines custom course fields, column settings, and report filters/columns.                                                                                                   |
| https://ispringhelpdocs.com/ispring-learn/catalog-in-the-user-portal-17301982.html                    | Primary                                            | Accessed 2026-05-20                                           | Defines later learner catalog/self-enrollment expectations.                                                                                                                  |
| https://mui.com/x/react-data-grid/column-visibility/                                                  | Primary                                            | Accessed 2026-05-20; MUI docs crawled recently                | Supports column visibility/presets and hiding technical fields.                                                                                                              |
| https://mui.com/x/react-data-grid/server-side-data/                                                   | Primary                                            | Accessed 2026-05-20; MUI docs crawled recently                | Supports server-side pagination/filtering/sorting and Data Source abstraction for dense library tables.                                                                      |
| https://editorjs.io/saving-data/                                                                      | Primary                                            | Accessed 2026-05-20; stable Editor.js docs                    | Confirms Editor.js clean JSON output shape and backend persistence contract.                                                                                                 |
| https://editorjs.io/inline-tool-sanitizing/                                                           | Primary                                            | Accessed 2026-05-20; stable Editor.js docs                    | Confirms sanitizer hooks but reinforces the need for backend validation.                                                                                                     |
| `memory-bank/research/lms-learning-content-ispring-research-2026-05-17.md`                            | Internal primary for prior research state          | Created 2026-05-17; still fresh, updated by this research     | Shows prior iSpring mapping and corrected architecture decisions.                                                                                                            |
| `memory-bank/plan/lms-learning-content-implementation-plan-2026-05-17-v2.md`                          | Internal primary for implemented plan              | Marked implemented/reconciled after 2026-05-18 QA closure     | Prevents re-planning already closed V2 groundwork.                                                                                                                           |
| `memory-bank/tasks.md`                                                                                | Internal primary for current work state            | Read 2026-05-20                                               | Confirms V2 status, remaining QA concurrency slice, and Runtime UI UX Quality Gate.                                                                                          |
| `memory-bank/currentResearch.md`                                                                      | Internal primary for research traceability         | Read 2026-05-20                                               | Confirms existing research history and current conclusions.                                                                                                                  |
| `memory-bank/activeContext.md`                                                                        | Internal primary for current architectural context | Read 2026-05-20                                               | Confirms current Object/Component vocabulary and apps-template runtime direction.                                                                                            |
| `memory-bank/systemPatterns.md`                                                                       | Internal primary for durable rules                 | Read 2026-05-20                                               | Confirms research-aware planning and generic runtime patterns.                                                                                                               |
| `.backup/Доработка-Learning-Content-для-LMS-конфигурации.md`                                          | Internal secondary                                 | Reviewed 2026-05-20                                           | Useful product analysis, but must be corrected against current architecture and current implementation progress.                                                             |
| `.backup/Разработка-LMS-функционала-Learning-Content.md`                                              | Internal secondary                                 | Reviewed 2026-05-20                                           | Useful iSpring decomposition, but contains greenfield and 1C analogy recommendations that need mapping to current primitives.                                                |
| `packages/apps-template-mui/README.md`                                                                | Internal primary                                   | Reviewed 2026-05-20                                           | Confirms current generic runtime primitives: detailsTable, relationBuilder, records.union, ResourcePreview, Trash-aware operations, page progress, and workspace management. |
| `packages/metahubs-backend/base/README.md`                                                            | Internal primary                                   | Reviewed 2026-05-20                                           | Confirms the `lms` template is entity-first and Learning Content layouts use generic runtime widgets.                                                                        |
| `.backup/templates/dashboard/README.md`                                                               | Internal primary for template lineage              | Reviewed 2026-05-20                                           | Confirms original MUI dashboard template and dependency set.                                                                                                                 |
| `.agents/skills/mui-runtime-ux-patterns/SKILL.md` and references                                      | Internal primary for UI quality gate               | Reviewed 2026-05-20                                           | Defines blocking runtime UI rules and dashboard contract.                                                                                                                    |
| `.agents/skills/runtime-ux-qa/SKILL.md`                                                               | Internal primary for QA output contract            | Reviewed 2026-05-20                                           | Defines user-facing QA gates and evidence expectations.                                                                                                                      |
| `packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts`                           | Internal primary                                   | Inspected 2026-05-20                                          | Confirms current LMS metadata/entities/layouts after V2.                                                                                                                     |
| `tools/testing/e2e/support/lmsFixtureContract.ts`                                                     | Internal primary                                   | Inspected 2026-05-20                                          | Confirms acceptance matrix and fixture-contract UX checks.                                                                                                                   |
| `tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`                                   | Internal primary                                   | Inspected 2026-05-20                                          | Confirms current browser proof, screenshots, viewport/no-leakage helpers.                                                                                                    |
| `packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx`                              | Internal primary                                   | Inspected 2026-05-20                                          | Confirms current records.union, restore, and learnerPlayer implementations.                                                                                                  |
| `docs/en/guides/lms-overview.md` and `docs/en/guides/lms-resource-model.md`                           | Internal primary                                   | Reviewed 2026-05-20                                           | Confirms documented current LMS MVP and deferred resource-source scope.                                                                                                      |

## Screenshot Observations

iSpring docs expose screenshots that are useful for product parity, even when exact visual cloning is not the goal:

-   Learning Content root screenshot: project-focused two-pane operational table with left slices (`Recent`, `Starred`, `Shared with me`, `Projects`), selected project header, Upload/Create actions, and rows with Title, Type, Status, Enrollments, Created by.
    Source image: https://ispringhelpdocs.com/ispring-learn/files/35665427/54761045/1/1653661460000/image2022-5-27_17-24-20.png
-   Page editor screenshot: a long-form editor surface with selected block toolbar and a right-side settings sidebar, not a raw JSON editor.
    Source image: https://ispringhelpdocs.com/ispring-learn/files/10685017/86769689/1/1692358255000/image-2023-8-18_14-30-54.png
-   Course outline screenshot: dense admin course page with header, View button, tabs (`Outline`, `General`, `Notifications`, `Availability`, `Completion`, `Enrollments`, `Reports`, `Reviews`), Course Settings, Add, and outline rows.
    Source image: https://ispringhelpdocs.com/ispring-learn/files/10683358/141560313/1/1761244244000/image-2025-10-23_21-30-40.png
-   Learning Track outline screenshot: stages/courses timeline with enrollment date, due date controls, tabbed detail page, and Add action.
    Source image: https://ispringhelpdocs.com/ispring-learn/files/22611018/22611120/1/1577307968000/image2019-12-26_0-6-6.png
-   Trash screenshot flow: Learning Content left navigation includes Trash; restore supports bulk selection and target choice when a folder/project was deleted.
    Source page: https://ispringhelpdocs.com/ispring-learn/trash-100867397.html

Implication: Universo should keep the MUI dashboard visual language, but the next product plan should shape the workspace into similar dense authoring surfaces: project list + content library, page authoring surface, course/track builders, enrollment wizard, player, and trash.

## Key Findings

### External Facts From iSpring Docs

-   Learning Content is project-centered. All learning content is stored in Projects, with root navigation slices for Recent, Starred, and Shared with me.
-   Projects are collaboration/content clusters. They are useful when several professionals work on shared content; project access can be restricted to some team members.
-   A new Project includes a title limit of 255 characters, team invitations, and `Can view` / `Can edit` access. By default, only the project owner and account owner have access.
-   iSpring also supports item-level sharing. A content item can be invited separately, per member access can be set, shared items appear in Shared with me, and shared content has visible sharing indicators.
-   Standalone content can be created/uploaded outside courses and assigned directly. The documented create menu includes Page, Link, Quiz, and Assignment. Broad file/package formats are supported by iSpring but are intentionally deferred for Universo's current slice.
-   Standalone item actions include edit title/description, preview, replace/download for some types, and delete to Trash. Replacement has version/best-result implications and should not be claimed in Universo before real import/storage/player support exists.
-   iSpring Pages are LMS-authored long-form learning articles. They can be created in a Project or inside a Course. They support title-to-page-name sync until manual override, block movement, block conversion, duplication, deletion, and a right settings sidebar.
-   Courses use a Course -> Section -> Content item outline, or can be a flat row of content items. Courses include due date/order/completion conditions, certificates, enrollment, and reports.
-   iSpring recommends up to 100 content items per course for performance and usability.
-   Course completion settings include navigation order, completion condition, and status format:
    -   Free vs Sequential/Restricted navigation.
    -   Complete all content items vs Complete selected content items.
    -   Complete/Incomplete vs Passed/Failed scoring format.
-   Course sequential order is more nuanced than a simple lock: optional/non-required items can remain available when selected required items are the completion target.
-   Course completion recalculation is required when required/scored items are removed or status format changes.
-   Learning Tracks are programs over courses, not copies of courses. They may contain stages and courses or a continual list of courses.
-   Track order modes are By days, Sequential, and Free. Per-course enrollment date, due date, and restrict-after-due-date behavior are part of the track outline.
-   Editing a track after enrollment requires an explicit warning because structure/due-date changes affect learners.
-   Track copy semantics preserve outline/settings while enrollments and reports are not copied.
-   Enrollment has multiple entry points: content detail tab, Learning Content list action, context menu/bulk action, or user page. The wizard has Users/Courses/Parameters steps and supports start date, due-date modes, apply-to-all, restrict-after-due-date, edit/cancel/reset/export.
-   Automatic assignment rules apply only to new group/department members after the rule is set. Existing users are not retroactively enrolled.
-   Automatic course re-enrollment is course-specific, has certificate/time constraints, starts a new statistics cycle, and does not work for courses inside learning tracks.
-   Trash keeps restorable content for 30 days, preserves settings/data, and shows Deleted by / Date Deleted. Restorable content includes standalone items, content inside courses/projects, courses, and tracks; some items such as linked copies and external-course tracking data cannot be restored.
-   Content statuses differ by content type. Pages have Not started/In Progress/Completed; assignments have Not started/Pending Review/Declined/Accepted; courses/tracks aggregate child progress; documents/links become complete on open.
-   Custom Course Fields are centrally defined, filled on the course General tab, visible through Learning Content column settings, and usable in report filters/columns.
-   The learner catalog is later adjacent scope: browse categories, sort, add to My Courses, request approval, and unenroll subject to constraints.

### Internal Facts From Current Repository

-   The previous V2 plan is marked implemented and reconciled through the 2026-05-18 QA closure. Do not re-plan the core V2 primitives as if they are missing.
-   `packages/metahubs-backend/base/README.md` states the built-in `lms` template is entity-first and includes content projects, resources, courses, course sections/items, learning tracks/stages/steps, content access/star/recent/trash projections, and generic layouts.
-   `packages/apps-template-mui/README.md` confirms current generic runtime primitives relevant to Learning Content:
    -   `detailsTable`;
    -   `records.union`;
    -   `relationBuilder`;
    -   `columnsContainer`;
    -   workflow actions;
    -   block-content authoring via `@universo/block-editor`;
    -   `ResourcePreview`;
    -   reports/export;
    -   Trash-aware delete/restore;
    -   page player progress;
    -   workspace management.
-   `lms.template.ts` already defines `ContentProjects`, `ContentAccessEntries`, `ContentStars`, `RecentContentViews`, `TrashEntries`, `LearningResources`, `Courses`, `CourseSections`, `CourseItems`, `LearningTracks`, `TrackStages`, `TrackSteps`, `Enrollments`, and `ContentProgress`.
-   The LMS template already uses `records.union` for active library and deleted Trash views.
-   Course Builder and Track Builder already use metadata-defined `detailsTabs`, `relationBuilder`, sequence policies, enrollment relation builders, and `learnerPlayer`.
-   `widgetRenderer.tsx` already implements a generic `RecordsUnionDetailsTableWidget`, restore action for deleted union rows, and a generic learner-player surface.
-   `lmsFixtureContract.ts` already asserts acceptance areas for contentProjects, learningContentShell, standalone page/link, courseBuilder, trackBuilder, manualEnrollment, learnerPlayer, and trashRestore.
-   The current fixture contract has important UX gates: no editable raw identity IDs, textareas for semantic descriptions, resourceSource fields hidden from grids, and no missing acceptance areas.
-   `snapshot-import-lms-runtime.spec.ts` already captures Learning Content, Recent, Starred, Shared with me, Trash, Course Builder, Track Builder, player, enrollment warning/wizard, outline ordering, and no horizontal overflow / no technical leakage checks.
-   The Runtime UI UX Quality Gate is now an active repository rule. Future Learning Content plans must include a UI Contract and browser UX evidence across desktop/tablet/mobile viewports.

### Important Facts vs Inferences

Facts:

-   iSpring Projects are not the same as Universo Workspaces.
-   iSpring uses dense operational authoring surfaces rather than marketing pages.
-   iSpring status/progress semantics differ by content type.
-   Universo already implemented much of the V2 data and generic runtime shell.

Repository-specific inferences:

-   The next valuable slice is product coherence and UX, not another schema-first rebuild.
-   iSpring Projects should remain `ContentProjects` Object records inside workspace runtime.
-   Workspace runtime should own real authoring, copying, moving, deleting/restoring, sharing, enrollment, progress, and learner interactions.
-   Application settings should own global defaults/presets/policies, not per-record operational content.
-   Metahub should seed the canonical entity model, layouts, defaults, scripts, enums, and demo content, but not individual workspace work choices.
-   Custom Course Fields should be implemented as generic Object components + column/report metadata, not as an LMS-only text-field subsystem.
-   Course/Track builder gaps should usually be solved by improving `relationBuilder`, `detailsTabs`, `detailsTable`, `records.union`, `RuntimeRecordPicker`, and generic progress/status hooks.

## Conflicts And Uncertainty

-   The backup documents are useful but partly stale. They describe a greenfield build and sometimes understate what V2 has already implemented.
-   The backup documents sometimes map Projects too close to workspace-like containers. For Universo, this must be rejected: Workspaces remain the application data boundary; Projects are content records inside a Workspace.
-   The backup documents recommend direct 1C-style posting/register expansion. The safer current mapping is Objects + workflow actions + Object-backed ledgers + server-owned services + TypeScript scripts at trusted extension points.
-   Some iSpring docs are terse and screenshot-heavy. The extracted text does not expose every UI detail, so exact visual behavior should be validated through screenshot observation and product reasoning, not over-claimed as documented text.
-   iSpring supports broad formats and replacement/download/version behavior, but Universo's current scope explicitly defers broad upload/import/conversion. The UI must show honest deferred states.
-   Current repository acceptance matrix marks many areas as covered. This is valuable, but the next plan should still verify user-level coherence because a fixture contract can prove entities/widgets exist without proving that a normal author can complete the flow comfortably.
-   `ContentProjects.Title` in the current template uses a 500-character max, while iSpring documents 255 characters for project title. This is not a blocker, but PLAN should decide whether to align project-like labels to 255 for parity or keep the broader platform rule.
-   `ContentAccessEntries`, `ContentStars`, `RecentContentViews`, and `TrashEntries` include technical target fields. Fixture checks hide some identity IDs, but the next UI review must verify these records are not presented as ordinary raw CRUD surfaces to normal users.
-   `records.union` currently fetches each target with `offset: 0` and `requestLimit = offset + pageSize`, then merges and slices client-side. This is reasonable for current seeded/demo sizes, but may become inefficient for large workspaces. PLAN should define a generic server-side union datasource upgrade when product scale grows.
-   The current generic learner player renders the target object codename as secondary text. That is a technical label and may be acceptable in internal QA, but it is not ideal for normal learner UX. PLAN should replace it with localized content type/status labels.

## Project Implications

### Architecture

-   Keep the three-level model:
    -   Metahub: canonical LMS configuration, generic layouts, default data, scripts, enums, sets.
    -   Application settings: enabled resource policies, player presets, column presets, role policy templates, default completion/enrollment policies.
    -   Workspace runtime: projects, resources, courses, tracks, sharing, stars, recent views, enrollments, progress, trash, learner actions.
-   Avoid LMS-only route/component forks. Improve generic runtime widgets first.
-   Keep `LearningResources` as the canonical standalone content Object. Do not reintroduce `Modules` as a content container.
-   Treat metahub Page entities as app/static/navigation pages. Treat workspace-authored learning pages as `LearningResources` with Editor.js block content.
-   Use scripts for trusted lifecycle/custom rule hooks after backend validation, not as arbitrary browser-owned logic.

### Generic Platform Primitives To Improve

-   `records.union` should become a first-class authoring library datasource with:
    -   server-side pagination/sort/filter for multiple target Objects;
    -   per-target display mapping;
    -   search across display fields;
    -   column presets and role-aware columns;
    -   star/share/recent/trash action projections.
-   `detailsTable` / DataGrid should expose column preset and user column preference behavior. MUI Data Grid supports column visibility models and a column management panel; this maps directly to iSpring Custom Course Fields and Learning Content column settings.
-   `relationBuilder` should evolve from "two scoped tables" into a stronger builder surface where needed:
    -   parent header;
    -   grouped outline;
    -   inline create/link existing;
    -   human reference labels;
    -   scoped reorder;
    -   warning banners for active enrollments;
    -   compact cards or rows depending on viewport.
-   Runtime record pickers should be the default for polymorphic references. Normal users should not type UUIDs or target record IDs.
-   Progress/status should be content-type-aware and server-owned. UI should show page/link/course/track/assignment statuses with localized labels and chips.
-   Trash restore should support restore target selection when the original Project/parent is gone, not only a direct row restore.

### MUI Runtime UI Contract For PLAN

Every touched screen must declare:

-   controls and defaults;
-   hidden/system fields;
-   display values in tables/cards;
-   validation/localization;
-   responsive behavior and browser proof.

Blocking UX rules:

-   No raw user-facing IDs or UUID-only labels.
-   No raw JSON, `[object Object]`, or object cells in normal tables/cards.
-   Long semantic text uses multiline controls.
-   Optional resource-source fields stay quiet when empty.
-   Validation is localized and user-facing.
-   Page-level horizontal overflow is a blocker.
-   Reuse existing dashboard primitives before creating a widget.

## Recommended Decision

Proceed to a new PLAN focused on "Learning Content Product Roadmap After V2".

The plan should not rebuild the existing V2 foundation. It should make the shipped LMS configuration feel like a cohesive, iSpring-like Learning Content product while preserving generic platform architecture.

Recommended priority:

1. Audit and tighten the current product workflow gates against real author/learner scenarios.
2. Polish the Learning Content workbench and Project UX around the existing `records.union` + MUI dashboard shell.
3. Improve item-level collaboration/share/star/recent actions as generic runtime affordances.
4. Strengthen workspace-authored Page authoring and learner reading semantics.
5. Make Course Builder and Track Builder feel like builders, not generic CRUD tables.
6. Improve enrollment, learner player, progress/status semantics, and report coupling.
7. Complete Trash restore semantics and column/report custom field coupling.
8. Keep automatic assignment, re-enrollment, catalog/self-enrollment, broad import formats, messaging, and AI generation as later phases.

## Detailed Phased Roadmap For PLAN

### Phase 0. Baseline Re-Audit And Acceptance Contract Reset

Goal: establish the real current baseline and stop treating entity presence as product completeness.

Work:

-   Re-read `lms.template.ts`, `lmsFixtureContract.ts`, `snapshot-import-lms-runtime.spec.ts`, docs, and current screenshots.
-   Produce a gap matrix per user workflow:
    -   create project;
    -   create standalone page/link;
    -   share item;
    -   star item;
    -   view recent;
    -   create course;
    -   add section;
    -   create or link content inside course;
    -   configure completion;
    -   enroll learner;
    -   open player;
    -   complete page/link;
    -   view status;
    -   delete/restore.
-   Add "workflow-complete" acceptance gates that require a normal user path, not just seeded metadata.
-   Keep fixture contract strict about no `Modules` canonical path, no raw JSON, no raw IDs, no page overflow.

Deliverables:

-   Updated plan under `memory-bank/plan/`.
-   Updated acceptance matrix only during IMPLEMENT.
-   No app code changes in PLAN.

### Phase 1. Learning Content Workbench Polish

Goal: make Learning Content the recognizable authoring home similar to iSpring's root screen.

Current baseline:

-   `records.union` and Learning Content/Recent/Starred/Shared/Trash navigation exist.
-   Overview cards and details tables exist.

Needed improvements:

-   Use a stable workbench layout:
    -   left menu: Learning Content, Recent, Starred, Shared with me, Projects, Trash;
    -   main header: selected slice/project title, workspace label, primary Create action;
    -   toolbar: search, filters, table/card view toggle, column settings, bulk actions;
    -   content grid/card rows: Title, Type, Status, Project, Enrollments, Shared indicator, Created by, Updated/Viewed date.
-   Remove columns that only serve persistence or debugging.
-   Replace technical type labels with localized chips:
    -   Page, Link, Course, Learning Track, Quiz-lite, Assignment-lite, Deferred file/package.
-   Add empty states that lead to action:
    -   no projects -> create project;
    -   no starred -> use star action in the library;
    -   no shared -> content shared with you appears here;
    -   empty trash -> deleted items will appear here for restore.
-   Keep component-internal grid scroll only; prove no page-level overflow at `1920x1080`, `768x1024`, and `390x844`.

Generic platform work:

-   Extend `detailsTable` or runtime table config for column presets and column management.
-   Improve `records.union` display mapping so all target types have consistent visible columns.
-   Consider server-side union datasource if current client merge becomes a real scale constraint.

Acceptance:

-   Browser flow creates or views a real library row and asserts no raw IDs/JSON/object cells.
-   Screenshot matrix for Learning Content, Recent, Starred, Shared with me, Trash.

### Phase 2. Projects And Collaboration UX

Goal: make `ContentProjects` behave like content containers inside Workspaces, with clear project-level and item-level access.

Current baseline:

-   `ContentProjects` and `ContentAccessEntries` exist.
-   Shared library slice exists.

Needed improvements:

-   Project list and project detail header:
    -   title, description, cover/thumbnail preview, content counts, access summary, owner/created-by display, actions.
-   Create/edit project dialog:
    -   title;
    -   multiline description;
    -   access mode;
    -   team member invite/permissions;
    -   no raw user/principal IDs.
-   Item sharing dialog:
    -   invite workspace members/users by name/email;
    -   access level `Can view` / `Can edit`;
    -   per-user rows;
    -   shared indicator in library rows;
    -   Shared with collaborators filter.
-   Keep Workspaces visually separate from Projects:
    -   workspace switcher remains top-level application context;
    -   projects are Learning Content records.

Generic platform work:

-   Add or refine `workspaceMemberPicker` / `userPicker` for generic access entries.
-   Hide `TargetObjectCodename`, `TargetRecordId`, `PrincipalId`, `UserId` from normal access-entry grids.
-   Add generic row actions: Share, Star, Move to project, Copy, Delete.

Acceptance:

-   A user can create a project, add content to it, share an item, and see it in Shared with me without typing any ID.

### Phase 3. Standalone Content And Page Authoring

Goal: make Page and Link authoring feel real and visual, while broad import remains honest deferred scope.

Current baseline:

-   `LearningResources` includes Editor.js block content, resource source, workflow actions, safe preview, and source validation.

Needed improvements:

-   Create menu from Workbench and Project:
    -   Page;
    -   Link;
    -   Quiz-lite;
    -   Assignment-lite;
    -   Course;
    -   Learning Track;
    -   Deferred upload options visually disabled or labelled as deferred when not supported.
-   Page authoring:
    -   visual block editor, not raw JSON;
    -   autosave or clear unsaved-change guard;
    -   title-to-name sync until manual override;
    -   block actions: move, duplicate, delete, convert where supported;
    -   safe settings sidebar for block background/margins/callout/table-like options;
    -   outline extraction from headings;
    -   preview/learner mode;
    -   publish/unpublish/unpublished changes state.
-   Link authoring:
    -   title + safe URL;
    -   preview badge;
    -   complete-on-open progress behavior.
-   Deferred resource states:
    -   SCORM/xAPI/video/audio/document/file can be present in enum/policy but must render as not yet supported unless a real player/import path exists.

Generic platform work:

-   Strengthen `editorjsBlockContent` UI config and backend validation for allowed block types.
-   Add reusable block settings metadata if it benefits non-LMS pages too.
-   Add generic title/name sync metadata if not already complete.

Acceptance:

-   Browser creates/edits a Page in runtime, verifies block content persists, opens learner preview, completes progress, and sees correct status.

### Phase 4. Course Builder Productization

Goal: make Course Builder a guided authoring flow over existing generic primitives.

Current baseline:

-   `Courses`, `CourseSections`, `CourseItems`, relationBuilder, ordering, completion tab, enrollment tab, learner player, and copy relations exist.

Needed improvements:

-   Course header:
    -   title, status, project, cover, View/Preview, primary Add action, More menu.
-   Tabs:
    -   Outline;
    -   General;
    -   Availability;
    -   Completion;
    -   Enrollments;
    -   Reports;
    -   Player/Preview.
-   Outline:
    -   section grouping;
    -   add section;
    -   add existing resource;
    -   create Page/Link inline;
    -   runtime record picker with human labels;
    -   row reorder;
    -   required/optional toggle;
    -   estimated time;
    -   completion weight;
    -   no raw target object/record IDs.
-   Completion:
    -   navigation mode Free/Sequential;
    -   completion condition All/Selected;
    -   status format Complete/Incomplete or Passed/Failed;
    -   scoring preconditions from rated items;
    -   warning/recalculation behavior when required/rated items change.
-   Large course warning at 100 items remains useful, but it should appear in an author-friendly place, not as a generic table warning only.
-   Copy:
    -   copy sections/items/settings;
    -   exclude enrollments/progress/reports unless metadata explicitly opts in.

Generic platform work:

-   Improve `relationBuilder` visual grouping and inline add/link behavior.
-   Improve polymorphic reference picker display for `CourseItems.TargetRecordId`.
-   Add generic completion/scoring status contract where feasible.

Acceptance:

-   Browser creates a course, creates a section, links a Page, marks it required, sets sequential completion, previews player, and verifies locked/unlocked behavior.

### Phase 5. Learning Track Builder Productization

Goal: make tracks a program layer over courses, not a duplicate course engine.

Current baseline:

-   `LearningTracks`, `TrackStages`, `TrackSteps`, relationBuilder, sequence policy, learnerPlayer, copy relations, and enrollment tab exist.

Needed improvements:

-   Track header and tabs parallel Course Builder.
-   Outline:
    -   stages;
    -   course-centered TrackSteps;
    -   add existing Course;
    -   set enrollment offset/date and due offset/date;
    -   restrict-after-due-date;
    -   order mode: By days, Sequential, Free.
-   Editing mode:
    -   if active enrollments exist, require explicit warning acknowledgement before structural edits that affect learners.
-   Copy/move/delete:
    -   preserve outline/settings;
    -   do not copy enrollments/reports;
    -   explain learner impact when deleting started/completed tracks.

Generic platform work:

-   Reuse Course Builder primitives rather than a parallel custom component.
-   Add relation-builder "edit structure with warning" mode as generic metadata.

Acceptance:

-   Browser creates/opens a track, adds stage and course, changes order mode, verifies warning when active enrollments exist, and opens learner player.

### Phase 6. Enrollment, Learner Player, And Status Semantics

Goal: connect authoring to real learner workflows and content-type-aware statuses.

Current baseline:

-   Manual enrollment wizard exists through relationBuilder metadata.
-   Learner My Courses/My Tracks visibility and `learnerPlayer` exist.
-   Progress endpoint and parent aggregation exist.

Needed improvements:

-   Enrollment wizard:
    -   entry from course/track detail, library row action, and bulk selection;
    -   Users/Content/Parameters steps;
    -   user picker by name/email;
    -   start date;
    -   due date modes: Use settings, By Date, For Period, No Due Date;
    -   restrict-after-due-date;
    -   Apply to all;
    -   edit/cancel/reset/export semantics where in scope.
-   Learner view:
    -   My Courses / My Tracks / assigned standalone content;
    -   clear status chips;
    -   due date and lock states;
    -   player outline with headings/sections/stages;
    -   complete actions by content type.
-   Status semantics:
    -   Page: Not started / In Progress / Completed based on chapter/read progress.
    -   Link/document-like: Not started / Completed after open.
    -   Course: aggregate required item completion.
    -   Track: aggregate course completion.
    -   Assignment-lite: Not started / Pending Review / Declined / Accepted if kept in this scope.
-   Do not show target object codenames or raw progress object IDs in learner UI.

Generic platform work:

-   Add content-type-specific progress/status descriptors in metadata and server services.
-   Add report status mapping shared by player, lists, and reports.

Acceptance:

-   Browser enrolls learner, opens My Courses/My Tracks, completes a page/link, and sees status/progress update without raw technical labels.

### Phase 7. Trash, Restore, Copy, Move, And Audit

Goal: complete Learning Content lifecycle behavior.

Current baseline:

-   Generic soft delete/restore endpoint and union trash view exist.

Needed improvements:

-   Trash table/card columns:
    -   Title;
    -   Type;
    -   Project/Parent;
    -   Deleted by;
    -   Date Deleted;
    -   Expires;
    -   Restore state;
    -   actions.
-   Restore:
    -   direct restore when parent/project exists;
    -   choose target project/folder when original parent is deleted or missing;
    -   explain non-restorable cases.
-   Delete:
    -   confirm permanent/non-restorable cases;
    -   show learner impact for courses/tracks with active enrollments.
-   Copy/move:
    -   move between projects;
    -   copy course/track outline and settings but not enrollments/progress/reports.
-   Audit:
    -   capture delete/restore/copy/share/star/recent operations in generic ledgers or Object projections.

Generic platform work:

-   Extend generic restore contract with target selection.
-   Add row lifecycle audit facts where currently missing.

Acceptance:

-   Browser deletes and restores standalone content and a course/track outline, including a restore-target path.

### Phase 8. Custom Fields, Columns, And Reports Coupling

Goal: make metadata-defined course fields visible where iSpring users expect them.

Current baseline:

-   Universo Object components are richer than iSpring text-only custom course fields.
-   MUI Data Grid supports column visibility models and column management.

Needed improvements:

-   Application settings:
    -   Course field presets / allowed custom course components;
    -   column presets for Learning Content table;
    -   report filter/column descriptors.
-   Runtime course General tab:
    -   show custom fields in a clean form section.
-   Learning Content table:
    -   column settings can show/hide custom fields.
-   Reports:
    -   custom fields usable as filters and display columns.
-   Keep this generic:
    -   not "LMS custom field engine";
    -   use Object components + metadata-driven table/report descriptors.

Acceptance:

-   Browser adds or uses a configured custom field, shows it in course General, enables it in Learning Content columns, and filters/report-displays it.

### Phase 9. Application-Level Learning Content Settings

Goal: expose safe global controls in the application control panel without forcing JSON editing.

Work:

-   Add/verify a typed Learning Content settings section:
    -   enabled resource types;
    -   deferred resource types;
    -   default completion policy;
    -   default track order mode;
    -   default enrollment due date mode;
    -   player presets;
    -   column presets;
    -   role policy templates.
-   Settings UI must use selects/switches/tables/pickers, not raw JSON.
-   Workspace runtime records can override per-content choices where appropriate.

Acceptance:

-   Admin changes global defaults in application settings and a newly created runtime course/resource uses those defaults.

### Phase 10. Deferred Later Slices

Keep out of the immediate core roadmap unless the user explicitly changes priority:

-   automatic assignment rules;
-   automatic re-enrollments;
-   learner catalog/self-enrollment/approval;
-   full quiz engine beyond quiz-lite;
-   full assignment review workflow if it delays page/course/track foundations;
-   classroom training/session scheduling;
-   SCORM/xAPI import/player/tracking;
-   video/audio/document storage upload and conversion;
-   internal messaging;
-   AI generation.

These are important, but they depend on a coherent content/workbench/player/progress foundation.

## UI Contract Summary For The Follow-Up PLAN

The PLAN must include a UI Contract section covering these surfaces:

-   Learning Content Workbench.
-   Project Create/Edit/Manage Access dialog.
-   Item Share dialog.
-   Standalone Page authoring and preview.
-   Link resource dialog.
-   Course Builder tabs and Outline relation builder.
-   Course Completion settings.
-   Track Builder tabs and Outline relation builder.
-   Enrollment wizard.
-   Learner My Courses/My Tracks and player.
-   Trash and restore target dialog.
-   Column settings/custom fields/report filters.
-   Application Learning Content settings.

For each surface, PLAN should state:

-   which existing app-template primitive is used;
-   visible fields and labels;
-   hidden/system-owned fields;
-   table/card display contract;
-   validation and i18n behavior;
-   responsive proof requirements;
-   E2E evidence path.

## Open Questions Before PLAN

None block PLAN.

Recommended defaults:

-   Ship flat Projects plus filters before adding folder hierarchy.
-   Keep broad file/package import deferred and honest in UI.
-   Keep Assignment-lite as secondary unless page/course/track flow is already stable.
-   Use deterministic server-owned progress/status helpers first, with scripts as extension hooks.
-   Use generic Object components for course custom fields rather than a separate LMS-only custom-field engine.
-   Align iSpring's 255-character project-title behavior only if product parity is more important than existing generic title length; otherwise document the broader Universo limit.

## Sources

-   https://ispringhelpdocs.com/ispring-learn/ispring-lms-10683320.html
-   https://ispringhelpdocs.com/ispring-learn/learning-content-35665427.html
-   https://ispringhelpdocs.com/ispring-learn/projects-35666255.html
-   https://ispringhelpdocs.com/ispring-learn/adding-a-project-35666262.html
-   https://ispringhelpdocs.com/ispring-learn/access-to-content-35666364.html
-   https://ispringhelpdocs.com/ispring-learn/standalone-content-35666278.html
-   https://ispringhelpdocs.com/ispring-learn/creating-a-standalone-content-item-35666351.html
-   https://ispringhelpdocs.com/ispring-learn/actions-with-standalone-content-35666366.html
-   https://ispringhelpdocs.com/ispring-learn/pages-10685013.html
-   https://ispringhelpdocs.com/ispring-learn/creating-a-page-10685014.html
-   https://ispringhelpdocs.com/ispring-learn/adding-elements-to-pages-10685017.html
-   https://ispringhelpdocs.com/ispring-learn/links-10683588.html
-   https://ispringhelpdocs.com/ispring-learn/courses-10683357.html
-   https://ispringhelpdocs.com/ispring-learn/creating-a-course-16187609.html
-   https://ispringhelpdocs.com/ispring-learn/course-outline-10683358.html
-   https://ispringhelpdocs.com/ispring-learn/adding-content-17303894.html
-   https://ispringhelpdocs.com/ispring-learn/course-completion-settings-35665810.html
-   https://ispringhelpdocs.com/ispring-learn/course-completion-order-17302424.html
-   https://ispringhelpdocs.com/ispring-learn/course-completion-condition-17302430.html
-   https://ispringhelpdocs.com/ispring-learn/scoring-a-course-35653408.html
-   https://ispringhelpdocs.com/ispring-learn/enrollments-16187447.html
-   https://ispringhelpdocs.com/ispring-learn/learning-tracks-22611015.html
-   https://ispringhelpdocs.com/ispring-learn/learning-track-outline-22611018.html
-   https://ispringhelpdocs.com/ispring-learn/course-completion-order-within-learning-track-22613656.html
-   https://ispringhelpdocs.com/ispring-learn/editing-a-learning-track-22613645.html
-   https://ispringhelpdocs.com/ispring-learn/actions-with-learning-tracks-22611155.html
-   https://ispringhelpdocs.com/ispring-learn/learning-track-enrollment-48334181.html
-   https://ispringhelpdocs.com/ispring-learn/automatic-assignment-of-learning-track-128353504.html
-   https://ispringhelpdocs.com/ispring-learn/automatic-re-enrollments-22609945.html
-   https://ispringhelpdocs.com/ispring-learn/trash-100867397.html
-   https://ispringhelpdocs.com/ispring-learn/content-statuses-in-reports-10684550.html
-   https://ispringhelpdocs.com/ispring-learn/custom-course-fields-100866604.html
-   https://ispringhelpdocs.com/ispring-learn/catalog-in-the-user-portal-17301982.html
-   https://mui.com/x/react-data-grid/column-visibility/
-   https://mui.com/x/react-data-grid/server-side-data/
-   https://editorjs.io/saving-data/
-   https://editorjs.io/inline-tool-sanitizing/
