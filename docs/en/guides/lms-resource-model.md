---
description: Generic LMS resource model used by the metahub fixture and published applications.
---

# LMS Resource Model

![Resources workspace used by the LMS resource model](../.gitbook/assets/entities/resources-workspace.png)

The LMS fixture models learning content as ordinary Object records, not as a dedicated LMS runtime content type.
The Learning Content implementation moves the product model from a content-first surrogate to workspace-authored projects, standalone resources, course items, and track stages.

## Entities

- `ContentProjects` groups workspace-authored content without replacing application workspaces.
- `LearningResources` stores reusable resource metadata: project, type, source descriptor, body blocks, estimated time, language, publication status, and launch mode.
- `Courses` stores a product-facing course shell with project, navigation, completion, status-format, catalog visibility, cover, instructor, and tags.
- `CourseSections` groups course content.
- `CourseItems` orders resource, quiz, assignment, or future training references inside course sections.
- `LearningTracks`, `TrackStages`, and `TrackSteps` define course-centered learning paths.
- `ContentStars`, `RecentContentViews`, `ContentAccessEntries`, and `TrashEntries` support library navigation and collaboration affordances.
- Page content remains in Page entities such as `CourseOverview`, `KnowledgeArticle`, and `CertificatePolicy`.

## Resource Source Contract

Each resource uses exactly one source locator:

- `pageCodename` for authored Page entities.
- `url` for URL, video, audio, and embedded content.
- `storageKey` for future stored files.
- `packageDescriptor` or `storageKey` for future SCORM and xAPI packages.

The V1 fixture intentionally does not implement file upload, package extraction, xAPI launch tracking, or a SCORM player.
SCORM, xAPI, storage-backed video/audio/document/file resources, and office document previews are represented as configured-but-deferred resources.
Published applications show a localized deferred runtime state instead of pretending that the player/import pipeline already exists.
Those capabilities should be added through generic storage/runtime primitives, not LMS-specific frontend code.

## Runtime Behavior

Published applications render resources through existing dashboard widgets, Page navigation, runtime rows, and scripts.
The unified content library uses a generic `records.union` datasource over resources, courses, and tracks.
Trash views use the same datasource shape with `lifecycleState=deleted`.
Progress is stored in Object records and Object-backed ledgers such as `ProgressLedger` and `LearningActivityLedger`.
