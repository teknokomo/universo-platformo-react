---
description: Workspace-authored Learning Content model for the LMS metahub template.
---

# LMS Learning Content

![Resources workspace used by Learning Content](../.gitbook/assets/entities/resources-workspace.png)

Learning Content is the product surface that turns the generic LMS template into an iSpring-like workspace authoring environment.
It is still metadata-driven: the metahub defines Objects, Sets, Enumerations, layouts, and defaults; the published application owns day-to-day content work inside each workspace.

## Scope

The current implementation covers the first content-authoring slice:

- `ContentProjects` group learning material inside a workspace.
- `LearningResources` stores standalone Pages and Links, with `Body` authored as Editor.js block JSON.
- `Courses` are course shells with sections and canonical `CourseItems`.
- `LearningTracks` are course-centered tracks with `TrackStages` and `TrackSteps`.
- `ContentStars`, `RecentContentViews`, `ContentAccessEntries`, and `TrashEntries` model the library affordances used by Recent, Starred, Shared with me, and Trash.
- `ContentProgress` stores server-owned learner progress for metadata-defined page/resource completion.
- Runtime delete/restore stays generic and uses optimistic `_upl_version` checks.

Broad file import, SCORM/xAPI launch tracking, office conversion, internal messages, and AI generation remain deferred.

## Workspace Boundary

Projects are not platform workspaces and are not metahubs.
They are ordinary runtime Object rows scoped to the current application workspace.
Users with enough workspace permissions can create, edit, copy, delete, and restore Learning Content records through the published app.

## Published UI

The LMS template uses the existing `packages/apps-template-mui` dashboard primitives:

- the normal sidebar menu;
- `detailsTable`;
- `relationBuilder`;
- `columnsContainer`;
- controlled MUI Data Grid column visibility;
- metadata-defined row actions;
- existing CRUD dialogs, Editor.js fields, and visual resource source fields.

The unified Learning Content view is powered by a generic `records.union` datasource that combines resources, courses, and learning tracks without adding an LMS-only widget.
Course Builder and Track Builder are scoped layouts that use the generic `relationBuilder` widget to keep `CourseSections`, `CourseItems`, `TrackStages`, and `TrackSteps` scoped to the selected parent record while reusing the existing CRUD dialogs, pickers, and row ordering primitives.
Course and track policy fields use metadata-defined select controls backed by the shared Learning Content contracts instead of free-text values.
The generic `detailsTable` widget can also show metadata-defined row-count warnings; the course outline uses that contract at 100 items so large courses are visible before publication.

## Authoring Resources

`LearningResources.Body` uses the shared Editor.js block editor instead of raw JSON.
`LearningResources.Source` uses the generic `resourceSource` form widget, so authors can configure page, link, embed, video, audio, document, package, and deferred file sources through normal controls.
The form shows the existing `ResourcePreview` component while editing, and invalid source values keep the save action disabled.
The backend still validates block content and resource sources before persistence, so the visual editor is a usability layer rather than the only safety boundary.
`LearningResources.Title` also drives `LearningResources.Name` through generic form metadata until the author edits the name directly.
A hidden manual-edit flag persists that choice, and hidden metadata fields stay out of runtime tables and forms.
Published runtime pages derive an inline outline from Editor.js header blocks through the shared page-block contract.
The outline resolves localized titles, links to stable heading anchors, and ignores invalid non-header blocks while preserving the backend validation boundary for saved content.
The published dashboard now receives runtime Page `pageBlocks` directly from the application API, so metadata Pages render through the same MUI dashboard surface as object lists.
The page player honors the application-level Learning Content player preset for outline visibility, progress header visibility, and completion mode.
Current reading progress still keeps a fail-soft browser cache scoped by application, workspace, and page section, but completion is also sent to the backend.
The backend resolves the metadata-defined `learningContent.progressStore` contract, writes the current user into `ContentProgress`, and scopes the row to the active workspace when the runtime application uses workspaces.

## Application Settings

Application-level Learning Content defaults are configured in the existing application settings page, not in a separate LMS-only control panel.
The `Learning Content` tab stores a strict typed settings block with:

- the default library view mode;
- enabled and deferred resource types;
- default course navigation, completion condition, and status format;
- default track order policy;
- player outline and progress presets;
- the metadata-defined progress store used by the published page player;
- the default visible columns for Learning Content tables.

Unsupported or unknown settings are removed before save, and duplicate resource type settings are rejected by the shared contract.

## Data Integrity

Runtime trash uses the platform lifecycle contract:

- active lists read `_upl_deleted = false`;
- trash lists read deleted rows through `lifecycleState=deleted`;
- restore requires `editContent`;
- restore fails closed on locked rows, missing rows, unsupported hard-delete objects, and mismatched `_upl_version`.
- deleted `records.union` tables render a generic restore action through the existing details table widget, using the source row id and object collection id carried by the union datasource.

## Fixture Contract

The canonical snapshot must be regenerated only through `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`.
`tools/testing/e2e/support/lmsFixtureContract.ts` verifies that the fixture includes Learning Content entities, seeded rows, and acceptance areas.

## Related Reading

- [LMS Overview](lms-overview.md)
- [LMS Resource Model](lms-resource-model.md)
- [LMS Setup](lms-setup.md)
- [Application Template View Settings](app-template-views.md)
