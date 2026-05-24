---
description: Workspace-authored Learning Content model for the LMS metahub template.
---

# LMS Learning Content

![Resources workspace used by Learning Content](../.gitbook/assets/entities/resources-workspace.png)

Learning Content is the product surface that turns the generic LMS template into an iSpring-like workspace authoring environment.
It is still metadata-driven: the metahub defines Objects, Sets, Enumerations, layouts, and defaults; the published application owns day-to-day content work inside each workspace.

## Scope

The current implementation covers the first content-authoring slice:

-   `ContentProjects` group learning material inside a workspace.
-   `LearningResources` stores standalone Pages and Links, with `Body` authored as Editor.js block JSON.
-   `Courses` are course shells with sections and canonical `CourseItems`.
-   `LearningTracks` are course-centered tracks with `TrackStages` and `TrackSteps`.
-   `ContentStars`, `RecentContentViews`, `ContentAccessEntries`, and `TrashEntries` model the library affordances used by Recent, Starred, Shared with me, and Trash.
-   `ContentProgress` stores server-owned learner progress for metadata-defined page/resource completion.
-   Runtime delete/restore stays generic and uses optimistic `_upl_version` checks.

Broad file import, SCORM/xAPI launch tracking, office conversion, internal messages, and AI generation remain deferred.

## Workspace Boundary

Projects are not platform workspaces and are not metahubs.
They are ordinary runtime Object rows scoped to the current application workspace.
Users with enough workspace permissions can create, edit, copy, delete, and restore Learning Content records through the published app.

## Published UI

The LMS template uses the existing `packages/apps-template-mui` dashboard primitives:

-   the normal sidebar menu;
-   `detailsTable`;
-   `relationBuilder`;
-   `columnsContainer`;
-   controlled MUI Data Grid column visibility;
-   metadata-defined row actions;
-   existing CRUD dialogs, Editor.js fields, and visual resource source fields.

The unified Learning Content view is powered by a generic `records.union` datasource that combines resources, courses, and learning tracks without adding an LMS-only widget.
The union table merges projection columns from all configured targets so a course-only, track-only, or resource-only display field is not lost just because another target is listed first.
The same projection layer resolves configured project references into readable `Project` labels, while raw `ProjectId` values remain hidden from normal table and card surfaces.
The table toolbar also uses metadata-defined target filters, so users can narrow the same union view to resources, courses, or learning tracks without seeing internal target codenames.
Saved Learning Content reports can reuse the same generic `records.union` datasource.
The fixture includes `LearningContentSummary`, which lists Type, Title, Status, Instructor, and Project across resources, courses, and tracks while normalizing reference values to display labels before report output or CSV export.
The same report exposes the ordinary `Instructor` Object component as a safe business field through `records.union.projectedFields`, so an application-level Learning Content column preset and a records-union report filter/export path can reuse configured metadata without adding a published-app custom-field fork.
Course Builder and Learning Track Builder report tabs execute saved generic report definitions through `detailsTable.reportCodename`, so their report widgets run through the same runtime reports API as the main Reports section instead of relying on unsaved inline-only definitions.
The underlying `Reports` object keeps JSON configuration fields such as filters, definitions, and saved filters hidden from normal grids; users see report names and categories, not raw report JSON.
Active union views expose Starred, Shared, and target-field row actions through generic `detailsTable.rowActions` metadata, so users can add resources, courses, and tracks to personal library views, share content with a workspace member, or move content to another project without opening the full edit form.
The Shared action is server-owned: the browser sends only the target row, desired state, and, when configured, the selected workspace member; the backend validates membership and resolves the default access level, timestamp, and configured `ContentAccessEntries` relation from `runtimeLibrary.shared`.
Shared views use the same configured relation timestamp through the generic `sharedAt` projection, so content most recently added to the current user's shared library appears first without exposing access-entry row IDs or principal IDs.
Recent views use the same generic runtime library metadata: opening or completing metadata-defined content records touches the configured `RecentContentViews.ViewedAt` relation, so the Recent section is fed by real runtime activity instead of only seeded rows and sorts newest views first through the generic `recentAt` projection.
The same `detailsTable` metadata can expose a generic create menu for union views.
The main Learning Content library uses it for Project, Page, Link, Course, and Learning Track entries; the runtime resolves the selected target object and opens the existing CRUD form only after that target schema is loaded.
Quiz-lite, Assignment-lite, and Import package are shown in the same create menu as disabled metadata-defined targets with localized deferred reasons, so authors can see the planned Learning Content scope without being sent into incomplete assessment, file-import, SCORM, or xAPI workflows.
Project creation opens the ordinary `ContentProjects` CRUD dialog without LMS-only runtime code, so authors can create workspace-scoped project containers from the same library surface where they create content.
Page and Link targets use typed `createDefaults` metadata to preselect only safe writable form fields: the `ResourceType` enumeration value and the visual `resourceSource` draft type.
Course and Learning Track targets use the same generic `createDefaults` contract with safe `contextPath` sources, so application-level Learning Content settings prefill navigation, completion, status, and track-order fields without exposing the full settings object to the form.
For Page resources, the `resourceSource` metadata derives the internal page source key from the authored title/name, so authors work with normal title and block content fields instead of a technical page codename.
The runtime ignores create defaults for workspace, owner, user, lifecycle, progress, `_upl_*`, hidden, read-only, table, or missing fields before the form receives initial data.
Course Builder and Track Builder are scoped layouts that use the generic `relationBuilder` widget to keep `CourseSections`, `CourseItems`, `TrackStages`, and `TrackSteps` scoped to the selected parent record while reusing the existing CRUD dialogs, pickers, and row ordering primitives.
Course and track policy fields use metadata-defined select controls backed by the shared Learning Content contracts instead of free-text values.
The generic `detailsTable` widget can also show metadata-defined row-count warnings; the course outline uses that contract at 100 items so large courses are visible before publication.

The Knowledge section uses the same published application runtime primitives as Learning Content.
Authors can create and edit `KnowledgeArticles` with a folder picker, title, and Editor.js body through the ordinary CRUD dialog, and the browser flow verifies the saved row through the application API.
The fixture contract also validates seeded Knowledge spaces, folders, articles, and article-targeted bookmarks, while the generic runtime mutation and Learning Content trash/restore contracts provide the current auditable lifecycle boundary for authored knowledge records.
Dedicated bookmark UI and permission-limited knowledge search remain explicit deferred product capabilities rather than hidden partial features.

## Authoring Resources

`LearningResources.Body` uses the shared Editor.js block editor instead of raw JSON.
`LearningResources.Source` uses the generic `resourceSource` form widget, so authors can configure page, link, embed, video, audio, document, package, and deferred file sources through normal controls.
For link sources, the same widget shows the validated external domain before save, so authors can catch wrong or unsafe URLs without inspecting raw source data.
The form shows the existing `ResourcePreview` component while editing, and invalid source values keep the save action disabled.
The backend still validates block content and resource sources before persistence, so the visual editor is a usability layer rather than the only safety boundary.
`LearningResources.Title` also drives `LearningResources.Name` through generic form metadata until the author edits the name directly.
A hidden manual-edit flag persists that choice, and hidden metadata fields stay out of runtime tables and forms.
Published runtime pages derive an inline outline from Editor.js header blocks through the shared page-block contract.
The outline resolves localized titles, links to stable heading anchors, and ignores invalid non-header blocks while preserving the backend validation boundary for saved content.
The published dashboard now receives runtime Page `pageBlocks` directly from the application API, so metadata Pages render through the same MUI dashboard surface as object lists.
The page player and generic learner-player widgets honor the application-level Learning Content player preset for outline visibility, progress header visibility, and completion mode.
Learner player headers resolve target object codenames to readable labels such as `Learning Resources` instead of showing internal metadata names.
Current reading progress still keeps a fail-soft browser cache scoped by application, workspace, and page section, but completion is also sent to the backend.
The backend resolves the metadata-defined `learningContent.progressStore` contract, writes the current user into `ContentProgress`, and scopes the row to the active workspace when the runtime application uses workspaces.

## Application Settings

Application-level Learning Content defaults are configured in the existing application settings page, not in a separate LMS-only control panel.
The `Learning Content` tab stores a strict typed settings block with:

-   the default library view mode;
-   enabled and deferred resource types;
-   default course navigation, completion condition, and status format;
-   default track order policy;
-   player outline and progress presets;
-   the metadata-defined progress store used by the published page player;
-   the default visible columns for Learning Content tables.

Unsupported or unknown settings are removed before save, and duplicate resource type settings are rejected by the shared contract.
Only a curated subset of these settings is passed into runtime create defaults; metadata still owns which fields can be prefilled.
Visible Learning Content columns can include normal Object components projected by `records.union.projectedFields`, such as `Instructor`; those fields remain defined in metahub metadata and are filtered/exported through generic records-union report contracts.

The current role visibility scope is deliberately generic and fail-closed.
Learning Content resources, courses, and tracks use `runtimeRecordAccess.mode = ownerOrShared`, so read-only members see records they own or records shared with them through `ContentAccessEntries`.
Application role-policy settings support active `application` and `workspace` scopes only; unsupported `recordOwner`, `department`, `class`, and `group` allow rules are downgraded before save and ignored by runtime permission resolution.
Department, class, and group predicates remain deferred until the platform has a generic predicate engine that can enforce them consistently across tables, union datasources, reports, and mutations.

## Data Integrity

Runtime trash uses the platform lifecycle contract:

-   active lists read `_upl_deleted = false`;
-   trash lists read deleted rows through `lifecycleState=deleted`;
-   restore requires `editContent`;
-   restore fails closed on locked rows, missing rows, unsupported hard-delete objects, invalid restore targets, and mismatched `_upl_version`.
-   restore can optionally target a valid workspace-scoped parent record when the original project or parent container is no longer usable.
-   deleted `records.union` tables render a generic restore action through the existing details table widget, using the source row id and object collection id carried by the union datasource.

Runtime mutations use optimistic version checks at the API boundary.
Published app adapters pass `_upl_version` for update, delete, copy, restore, and row ordering commands.
Row ordering sends an expected-version map for every row in the ordered set, and the backend validates the whole set inside one transaction before changing sort order.
Stale, duplicate, missing, cross-workspace, or incomplete reorder requests fail as one command instead of partially updating the outline.

Learning Content progress is server-owned.
The browser sends only an action intent such as `view`, `complete`, or `recalculate` with the target content reference.
It cannot set `progressPercent` or `status` directly; the backend derives those values from metadata-defined progress, completion, sequencing, and aggregation rules.

Normal runtime cells do not fall back to raw JSON for structured values without a display label.
Such fields should be hidden, represented by explicit display metadata, or rendered by a dedicated preview component.

## Fixture Contract

The canonical snapshot must be regenerated only through `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`.
`tools/testing/e2e/support/lmsFixtureContract.ts` verifies that the fixture includes Learning Content entities, seeded rows, and acceptance areas.

## User Guide Link

For day-to-day work inside the published LMS application, use the [Learning Content Library](../lms/learning-content-library.md).

## Related Reading

-   [LMS Overview](lms-overview.md)
-   [LMS Resource Model](lms-resource-model.md)
-   [LMS Setup](lms-setup.md)
-   [Application Template View Settings](app-template-views.md)
