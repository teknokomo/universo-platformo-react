# LMS Learning Content iSpring Research

Date: 2026-05-17
Mode: RESEARCH artifact, reviewed after the original brief was restated
Decision supported: implementation planning for an iSpring-like Learning Content subsystem in Universo Platformo.

## Research Question

How should Universo Platformo model and implement an iSpring-like Learning Content subsystem while preserving the platform architecture:

- Metahub defines base metadata, default layouts, seed content, scripts, and reusable logic.
- Application settings define global runtime defaults, menus, role policies, and behavior.
- Workspace runtime owns operational content creation, editing, copying, deletion, enrollment, and progress.
- Generic Entity types, Objects, Sets, Enumerations, Pages, Hubs, and scripts must carry the behavior without adding a hardcoded LMS runtime fork.

## Source Inventory

Access date for external sources: 2026-05-17.

Official iSpring documentation:

- Learning Content: https://ispringhelpdocs.com/ispring-learn/learning-content-35665427.html
- Adding a Project: https://ispringhelpdocs.com/ispring-learn/adding-a-project-35666262.html
- Projects: https://ispringhelpdocs.com/ispring-learn/projects-35666255.html
- Adding Content to a Project: https://ispringhelpdocs.com/ispring-learn/adding-content-to-a-project-35666679.html
- Access to Content: https://ispringhelpdocs.com/ispring-learn/access-to-content-35666364.html
- Standalone Content: https://ispringhelpdocs.com/ispring-learn/standalone-content-35666278.html
- Creating a Standalone Content Item: https://ispringhelpdocs.com/ispring-learn/creating-a-standalone-content-item-35666351.html
- Actions With Standalone Content: https://ispringhelpdocs.com/ispring-learn/actions-with-standalone-content-35666366.html
- Pages: https://ispringhelpdocs.com/ispring-learn/pages-10685013.html
- Creating a Page: https://ispringhelpdocs.com/ispring-learn/creating-a-page-10685014.html
- Adding Elements to Pages: https://ispringhelpdocs.com/ispring-learn/adding-elements-to-pages-10685017.html
- Links: https://ispringhelpdocs.com/ispring-learn/links-10683588.html
- Creating a Quiz: https://ispringhelpdocs.com/ispring-learn/creating-a-quiz-54759487.html
- Assignments: https://ispringhelpdocs.com/ispring-learn/assignments-10683776.html
- Courses: https://ispringhelpdocs.com/ispring-learn/courses-10683357.html
- Creating a Course: https://ispringhelpdocs.com/ispring-learn/creating-a-course-16187609.html
- Course Outline: https://ispringhelpdocs.com/ispring-learn/course-outline-10683358.html
- Adding Sections: https://ispringhelpdocs.com/ispring-learn/adding-sections-17303892.html
- Adding Content: https://ispringhelpdocs.com/ispring-learn/adding-content-17303894.html
- Adding a Training to a Course: https://ispringhelpdocs.com/ispring-learn/adding-a-training-to-a-course-35665328.html
- Course Completion Settings: https://ispringhelpdocs.com/ispring-learn/course-completion-settings-35665810.html
- Course Completion Order: https://ispringhelpdocs.com/ispring-learn/course-completion-order-17302424.html
- Course Completion Condition: https://ispringhelpdocs.com/ispring-learn/course-completion-condition-17302430.html
- Scoring a Course: https://ispringhelpdocs.com/ispring-learn/scoring-a-course-35653408.html
- Learning Tracks: https://ispringhelpdocs.com/ispring-learn/learning-tracks-22611015.html
- Learning Track Outline: https://ispringhelpdocs.com/ispring-learn/learning-track-outline-22611018.html
- Editing a Learning Track: https://ispringhelpdocs.com/ispring-learn/editing-a-learning-track-22613645.html
- Learning Track Enrollment: https://ispringhelpdocs.com/ispring-learn/learning-track-enrollment-48334181.html
- Course Completion Order within Learning Track: https://ispringhelpdocs.com/ispring-learn/course-completion-order-within-learning-track-22613656.html
- Automatic Assignment of Learning Track: https://ispringhelpdocs.com/ispring-learn/automatic-assignment-of-learning-track-128353504.html
- Automatic Re-enrollments: https://ispringhelpdocs.com/ispring-learn/automatic-re-enrollments-22609945.html
- Copying Courses: https://ispringhelpdocs.com/ispring-learn/copying-courses-28053102.html
- Actions with Learning Tracks: https://ispringhelpdocs.com/ispring-learn/actions-with-learning-tracks-22611155.html
- Custom Course Fields: https://ispringhelpdocs.com/ispring-learn/custom-course-fields-100866604.html
- Content Statuses in Reports: https://ispringhelpdocs.com/ispring-learn/content-statuses-in-reports-10684550.html
- Course Catalog in the User Portal: https://ispringhelpdocs.com/ispring-learn/catalog-in-the-user-portal-17301982.html
- Trash: https://ispringhelpdocs.com/ispring-learn/trash-100867397.html

Local project sources:

- `.backup/Разработка-LMS-Функционал-Learning-Content.md`
- `.backup/Learning-Content-для-LMS-конфигурации-Universo-Platformo.md`
- `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md`
- `memory-bank/tasks.md`
- `memory-bank/activeContext.md`
- `docs/en/guides/lms-overview.md`
- `docs/en/guides/lms-resource-model.md`
- `packages/apps-template-mui/README.md`
- `packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts`
- `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
- `tools/testing/e2e/support/lmsFixtureContract.ts`

Current library references through Context7:

- Material UI v7.3.2, MUI X Data Grid v8.11.0, TanStack Query v5.90.3, Editor.js.

### Source Quality Table

| Source group | Quality | Freshness / stability | Research use |
| --- | --- | --- | --- |
| Official iSpring Learning Content documentation | Primary | Current product docs, pages range from older stable track docs to 2025-2026 updates | Defines external LMS parity target and UI workflows |
| Official iSpring LMS overview | Primary | Current page, copyright 2026 | Confirms broad format support that must be deferred in Universo V1 |
| Official iSpring report/status pages | Primary | Current docs, detailed per-content status semantics | Confirms that progress/status behavior must be content-type-specific |
| Local backup research docs | Internal secondary | Useful but partly speculative | Used to validate or reject prior architecture recommendations |
| Current repository Memory Bank and package docs | Internal primary for repo state | Same-day local context | Defines what is already implemented and what must not be re-planned as new |
| MUI Dashboard template docs | External primary for UI template lineage | Current public template page | Confirms the original dense dashboard/table/card visual language |
| Editor.js docs | External primary for editor behavior | Stable docs, last-edit dates older but API concepts stable | Confirms block tools, JSON output, and sanitizer requirements |

## Original Brief Scope And Verified Claims

The original brief asks to improve a semi-finished LMS configuration generated from `tools/fixtures/metahubs-lms-app-snapshot.json`, with iSpring LMS as the product reference. The brief has several non-negotiable repository constraints:

1. Learning Content should be the first major focus because it is the root data and UX layer for later LMS areas.
2. The implementation must preserve Universo's architecture: Metahub -> Application settings -> Workspace runtime.
3. Workspaces stay the main operational boundary; iSpring-style Projects are a Learning Content concept inside a Workspace.
4. Core logic should use the existing universal Entity type set: Hubs, Pages, Objects with Components, Sets, Enumerations, ledgers, and attached TypeScript scripts.
5. The published application should use `packages/apps-template-mui` and the original MUI dashboard style, not a new LMS-only frontend.
6. Existing generic table/card widgets and runtime UI should be extended before adding new widget types.
7. Broad file import/player support, SCORM/xAPI, internal messages, and AI generation are late phases.
8. The final artifact must be a Playwright-generated LMS snapshot, not hand-edited JSON.
9. Legacy preservation is not required for disposable test data; schema/template versions should not be bumped just for the LMS rebuild.

The research confirms the first claim: iSpring Learning Content is the correct foundation. The iSpring docs explicitly place all learning content in Projects and expose Projects, standalone content, courses, learning tracks, enrollments, reports/statuses, and Trash from this area.

## Important Fact / Inference Split

Facts from iSpring documentation:

- Learning Content stores all content in Projects.
- Projects group courses, quizzes, and learning tracks around a subject or learner group.
- Project/content access supports view/edit collaboration.
- Standalone content can be created outside courses.
- Pages can be created in a project or inside a course.
- Courses use Course -> Section -> Content item structure.
- Course completion settings cover navigation order, completion condition, and status format.
- Learning tracks support by-days, sequential, and free course order.
- Enrollments use multi-step selection of content, users, and parameters.
- Trash keeps restorable learning content for 30 days and preserves settings/data.
- Status semantics differ by content type.

Repository-specific inferences:

- iSpring Projects should map to workspace-scoped `ContentProjects` Objects, not Workspaces or Hubs.
- User-authored learning pages should map to `LearningResources` Objects with block content, while metahub `Page` entities should remain portal/static application pages.
- Course content items require a polymorphic relation model, most likely `CourseItems`, rather than overloading old module rows.
- Track behavior should build on course/progress primitives, not duplicate the course implementation.
- Trash, sharing, stars, recent views, sequence builders, and learner players should be generic runtime primitives configured by metadata.

## Key iSpring Findings

### Learning Content Home

iSpring Learning Content is a project-based authoring library. The root screen provides fast author slices: Recent, Starred, and Shared with me. The documented UI shows a project list, a selected project table, Create and Upload actions, and unified rows with Title, Type, Status, Enrollments, and Created by.

The original screenshot evidence matters for UI parity: the screen is not a marketing-style learning portal. It is a dense operational table/list workspace with left navigation, project context, row metadata, search, and compact actions. Direct screenshot reference: https://ispringhelpdocs.com/ispring-learn/files/35665427/54761045/1/1653661460000/image2022-5-27_17-24-20.png

### Projects

Projects are collaborative content containers, not the same concept as Universo Workspaces. A project has a title with a 255-character limit, owner/account-owner access by default, and invited team members with Can view or Can edit access. Projects contain courses, learning tracks, pages, assignments, links, uploaded standalone content, and shared access rules.

Important implementation implication: in Universo, a project should be a workspace-owned Object record such as `ContentProjects`, not a Hub or Workspace replacement.

Per-content sharing is also separate from project membership. iSpring allows inviting team members to a content item with Can view or Can edit permissions. Shared content appears in Shared with me and can be found through a shared-with-collaborators filter.

### Standalone Content

Standalone content can be created or uploaded separately from a course and assigned directly. iSpring lists pages, online quizzes, links, assignments, iSpring-authored packages, videos, audio, SCORM packages, PDF, PowerPoint, Word, Excel, SWF, and external courses. Standalone content can use automatic enrollment rules.

For the first Universo Learning Content slice, broad upload/import/player features should remain explicit deferred resource states. Editor.js page resources, safe links, safe embeds, and safe URL-backed previews are the correct early working set.

Standalone content actions include edit title/description, preview, replace for some package/content types, download for some file types, and delete to Trash. Replacement has version/history implications; for V1, store future-compatible version metadata but avoid claiming real replacement/player support before storage and import pipelines exist.

### Pages

iSpring Pages are long-form learning articles with illustrations, quotes, videos, and interactive assignments authored directly in the LMS. They are not just static website pages. They have authoring and learner/player surfaces, and the screenshot shows reading progress and a chapter-like navigation rail.

Universo should keep metahub `Page` entities for portal/static application pages, while workspace-authored learning pages should be `LearningResources` Object records with block-content fields.

Page creation is available both in a project and inside a course. The page title initially drives the page name, but manual page-name edits break that automatic sync. Page elements can be moved, changed to another block type, duplicated, deleted, and configured through a settings sidebar for margins, background, tables, flashcards, notes, dividers, and formatting. This maps well to Editor.js block operations plus a constrained block-settings model.

Direct screenshot reference for the page learner/preview surface: https://ispringhelpdocs.com/ispring-learn/files/10685013/141567695/1/1768730034000/image-2026-1-18_12-53-52.png

Editor.js source implications:

- Editor.js is block-style and stores output as JSON with `time`, `blocks`, and `version`.
- Block `type` names come from the configured tools, so Universo must normalize tool names before persistence.
- Editor.js provides sanitizer support, but backend validation must still be the source of truth for stored block content.
- The existing `@universo/block-editor` package should remain the integration point; the LMS should not add a second editor integration.

### Links

Links are content items that can be added inside a course. The documented flow creates a title plus URL and then manages the link like other course content.

Universo can map this to `LearningResources` with `ResourceType = Url` and a safe source descriptor validated through shared URL rules.

### Online Quizzes

Quizzes can be standalone or part of a course. Draft and unpublished-change states matter in the authoring UI. This reinforces the need for generic draft/published state support for authored content items.

### Assignments

Assignments are freeform learner tasks. The learner submits work, and the instructor reviews, grades, accepts, or declines it. This is a real lifecycle workflow, not just a text field.

The existing Universo workflow-action groundwork is relevant, but Learning Content V1 can keep assignments as a narrow demo workflow if full review UX would block the core page/course work.

### Courses

Courses are composite content containers. A course is created inside a project, then filled with sections and content items. iSpring recommends up to 100 content items per course for performance. Course content can include pages, quizzes, assignments, links, uploaded materials, and trainings. Course editing includes tabs such as Outline, General, Notifications, Availability, Completion, Enrollments, Reports, Reviews, and overflow actions.

Universo needs a real generic sequence/detail authoring surface, not only flat Object CRUD rows.

The course model is explicitly Course -> Section -> Content item. A course may also be a flat row of content items without sections. The learner view and administrator outline are separate surfaces over the same structure.

### Course Sections And Content Items

Sections have a title limit of 255 characters and a description. Authors can rename, remove, and reorder sections. Course content items can be edited, viewed, moved, deleted, and for some types downloaded/replaced.

The data model should separate:

- `Courses` as the course shell.
- `CourseSections` as optional grouping and ordering containers.
- `CourseItems` as ordered polymorphic references to resources, quizzes, assignments, trainings, or future content types.

### Course Completion

iSpring course completion is controlled by three settings:

- Navigation: free or restricted/sequential.
- Completion condition: all content/trainings or selected required items.
- Status format: complete/incomplete or passed/failed with score.

Sequential mode unlocks required items one by one. Optional items can remain available depending on the selected condition. Video completion uses a concrete threshold in the docs: 95% viewed. Scoring only becomes available when required rated items exist, and course score is calculated from selected rated items.

Universo should use generic sequence/completion contracts plus server-side scripts/services to enforce these rules.

### Trainings In Courses

Trainings can be embedded in courses but must already exist. A training can be added once per course. Visibility in the picker depends on creator, managed departments, and training permissions. Training completion interacts with course completion, sequence rules, and reports.

For the near plan, trainings should remain a modeled content item type with explicit deferred or limited workflow unless the core content builder needs one seeded example.

### Enrollments

Enrollments are multi-entry workflows from the content list, content detail page, context menu, or user page. The wizard has user/content/parameter stages. Parameters include start date and due date modes: use content settings, by date, for a period, or no due date. There is also a restrict-after-due-date behavior.

In Universo, enrollment is operational workspace data. It belongs in Objects and ledgers, created through a generic wizard/surface configured by metadata.

Direct screenshot reference for the Enrollments tab surface: https://ispringhelpdocs.com/ispring-learn/files/16187447/141559838/1/1761136747000/image-2025-10-22_15-39-6.png

### Automatic Enrollments And Re-Enrollments

Automatic enrollment rules apply to future group/department members. Existing members are not retroactively enrolled. Deleting a group or department rule does not remove current enrollments.

Automatic re-enrollment is course-specific. It can occur after completion or before certificate expiration, starts a new statistics cycle, and does not work for courses inside learning tracks.

These rules should be planned after manual enrollment and progress are stable.

### Learning Tracks

Learning tracks group courses into larger programs and can include stages. Stages contain courses or tracks can be a continual course list. Authors can edit structure, stages, courses, due dates, and course completion order, with warnings that changes affect enrolled learners. Track order modes include day-based, sequential, and free behavior. Copy/move/delete behavior is explicit: copying preserves outline and settings but not enrollments/reports; deleting a started/completed track leaves child courses in learners' lists.

Universo should model tracks as Objects over courses and progress, not as a second course implementation.

Track course order modes are important for V1 design even if only one mode ships first: by days gives every course its own enrollment date and due date, sequential unlocks each course after the previous course completes, and free makes every course available when the track is assigned.

### Custom Course Fields

iSpring supports global text-only custom course fields. Account administrators define fields; course authors fill values on course General. These fields appear as Learning Content columns and report filters/columns.

Universo already has richer component metadata. The equivalent should be an application/control-panel path for adding course components and exposing selected components in runtime DataGrid column visibility and report definitions.

The comparable UI requirement is not "text fields only"; Universo should support metadata-defined course components while keeping column visibility and report-filter wiring as the parity target.

### Learner Catalog

iSpring's learner portal has a course catalog where learners browse categories, sort courses, add courses to My Courses, request approval when needed, and unenroll with constraints. This belongs after the authoring-centered Learning Content foundation, but the content model should already expose catalog/category flags so the later learner portal does not need schema churn.

### Trash

Trash is a 30-day soft-delete area. It preserves settings and data, shows Deleted by and Date Deleted, supports restoring standalone items, course/project content, courses, and tracks, and rejects some non-restorable cases such as linked copies and external course tracking data.

Universo needs a generic runtime soft-delete/trash primitive rather than LMS-only deletion logic.

## Backup Document Assessment

The two backup documents are useful as domain analysis, and most major product claims align with iSpring docs: project-based storage, standalone content, courses with sections/items, course completion, custom fields, trash, enrollments, tracks, and re-enrollment limits.

However, some recommendations are architecture proposals rather than iSpring facts:

- Editor.js is a Universo implementation choice, not an iSpring documentation claim.
- 1C-style posting/register terminology is a good platform analogy, but it must map to current Object, ledger, workflow, and script primitives.
- MUI DataGrid, Stepper, Dialog, and specific React component designs are implementation choices.
- The backup docs can understate current implementation progress because `tasks.md` and `progress.md` show many generic LMS primitives already completed in May 2026.

Additional corrections for PLAN:

- The backup language sometimes describes iSpring Projects like isolated workspaces. This must be rejected for Universo: Workspaces are already the main operational container; Projects are content containers inside Workspaces.
- The backup suggests maximizing Editor.js plugin breadth early. This should be narrowed: only safe blocks and validated resource embeds should be supported first. Broad multimedia/file support belongs to deferred format phases.
- The backup treats registries/posting as a direct design model. The safer mapping is: Objects + workflow actions + ledgers + server-side scripts. The word "posting" may stay as an analogy, but implementation must follow current generic Object/ledger contracts.
- The backup describes Course/Track UI in terms of concrete MUI controls. The correct architectural framing is metadata-driven generic detail tabs and sequence builders using MUI components, not LMS-specific screens.

## Current Universo Baseline

The current project already has:

- `@universo/apps-template-mui` as an independent MUI v7 published-app runtime with generic CRUD, workflow actions, block-content authoring, resource preview, saved reports, workspaces, and dashboard widgets.
- Shared resource source validation in `@universo/types`.
- Existing LMS template Objects for Learning Resources, Courses, Course Sections, Learning Tracks, Track Steps, Assignments, Reports, knowledge/development/gamification entities, and ledgers.
- A Playwright LMS product generator at `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`.
- A committed snapshot contract at `tools/testing/e2e/support/lmsFixtureContract.ts`.
- Previous roadmap implementation evidence that broad platform groundwork is in place:
  - app-side rich block-content authoring has groundwork through the shared block editor;
  - safe resource source validation and `ResourcePreview` exist;
  - generic sequence/completion helpers exist;
  - generic workflow actions and fail-closed role-policy filtering exist;
  - reports/export and dashboard visual parity work has already been implemented;
  - the LMS fixture already includes deferred resource states.

Main gap: the current LMS fixture has pieces of a Learning Content system, but it does not yet feel like a working iSpring-like content library with Projects, unified content list, Course Builder, Track Builder, Trash, and learner/player flows. PLAN should therefore avoid re-planning already-completed platform groundwork and focus on product coherence plus missing generic runtime surfaces.

## Project Implications

1. Treat Learning Content as the next product slice. It is the foundation for assignments, reports, certificates, notifications, gamification, and later AI/import formats.
2. Add platform primitives only when generic:
   - runtime record soft delete/trash,
   - polymorphic record references,
   - metadata-driven detail pages/tabs,
   - sequence builder and learner player,
   - union/saved-view datasources,
   - role-scoped record actions.
3. Do not add an LMS-only React app, route family, widget family, or server service unless the generic platform primitive cannot express the behavior.
4. Keep Workspaces as the main operational boundary. ContentProjects live inside Workspaces.
5. Keep broad formats, SCORM/xAPI, file upload/import, internal messaging, and AI generation as explicit late phases.

## UI Workflow Inventory For PLAN

The implementation plan should preserve these user-facing workflows from iSpring while adapting them to Universo metadata:

1. Learning Content home:
   - open Learning Content from app navigation;
   - switch between Recent, Starred, Shared with me, Projects, Trash;
   - search and filter;
   - create new content;
   - see type, status, enrollment, creator, and sharing indicators.
2. Project management:
   - create/edit project;
   - invite collaborators;
   - assign Can view / Can edit;
   - move/copy/delete content inside the project;
   - restore deleted content where allowed.
3. Standalone content:
   - create Page, Link, Quiz-lite, Assignment-lite where enabled;
   - preview;
   - share;
   - add to course;
   - delete to Trash.
4. Page authoring:
   - create in project or course;
   - edit block content;
   - reorder/change/duplicate/delete blocks;
   - open settings sidebar;
   - preview and publish;
   - show learner reading progress.
5. Course authoring:
   - create course in project;
   - edit General metadata;
   - build Outline with sections and content items;
   - configure navigation/completion/status format;
   - enroll users;
   - view reports/statuses.
6. Track authoring:
   - create track in project;
   - add stages and courses;
   - choose by-days, sequential, or free order;
   - configure per-course enrollment/due dates;
   - enroll users and view progress.
7. Learner runtime:
   - see assigned content in My Courses or catalog-like view;
   - open player;
   - navigate allowed items;
   - complete pages/links;
   - see course/track progress.

## Handoff Constraints For PLAN

- PLAN must treat already-completed generic infrastructure as baseline, not as new work.
- PLAN should prioritize product surfaces and fixture proof: Projects, unified content table, page authoring, Course Builder, Track Builder, learner player, and Trash.
- PLAN should explicitly defer:
  - SCORM/xAPI runtime tracking;
  - broad upload/import/conversion;
  - full internal messaging;
  - AI generation;
  - full training/session scheduling;
  - advanced quiz authoring beyond quiz-lite if it would delay Learning Content foundations.
- PLAN should include tests and screenshots as acceptance, not optional hardening.
- PLAN should keep `tools/fixtures/metahubs-lms-app-snapshot.json` generated through Playwright only.

## Recommended Decision

Proceed with a new Learning Content implementation plan centered on:

- `ContentProjects` and project access inside Workspace runtime.
- Unified project content library with Recent, Starred, Shared with me, and Trash.
- Editor.js/block-content learning resources as workspace-authored Object records.
- Course Builder with sections, polymorphic course items, completion settings, and learner preview.
- Learning Track Builder as a sequence over courses.
- Manual enrollment and basic progress first.
- Playwright-generated canonical LMS snapshot proving the product flow.

## Open Questions

1. Should the first implementation include a real assignment review workflow, or keep assignments as seeded but secondary while page/course/track authoring lands?
2. Should folders inside projects ship in the same slice as projects, or should flat projects plus filters ship first?
3. Which URL-backed video/audio/document previews should be considered truly supported in the current runtime?
4. Should course completion recalculation first be implemented as deterministic server service logic with script hooks, or as a fully script-owned rule from the beginning?
5. How should linked copies be represented generically: live reference, immutable snapshot, or versioned reference?

None of these block PLAN. The recommended defaults are:

- include assignment-lite as a seeded/reviewable workflow only after page/course basics are stable;
- ship flat projects first unless implementation review shows folder support is already cheap;
- treat URL-backed link/page/embed as supported first, and keep storage-backed video/audio/document as deferred unless runtime proof exists;
- start with deterministic server helpers plus script hooks, then move variable rules into scripts after tests are stable;
- represent linked copies as explicit versioned references later, not in the first Learning Content slice.
