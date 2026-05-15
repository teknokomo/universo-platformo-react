---
description: Generic LMS resource model used by the metahub fixture and published applications.
---

# LMS Resource Model

![Resources workspace used by the LMS resource model](../.gitbook/assets/entities/resources-workspace.png)

The LMS fixture models learning content as ordinary Object records, not as a dedicated LMS runtime module.

## Entities

- `LearningResources` stores reusable resource metadata: type, source descriptor, estimated time, language, and launch mode.
- `Courses` groups resources and modules into a product-facing course shell.
- `CourseSections` orders resources and modules inside a course.
- `LearningTracks` and `TrackSteps` define guided sequences and prerequisites.
- Page content remains in Page entities such as `CourseOverview`, `KnowledgeArticle`, and `CertificatePolicy`.

## Resource Source Contract

Each resource uses exactly one source locator:

- `pageCodename` for authored Page entities.
- `url` for URL, video, audio, and embedded content.
- `storageKey` for future stored files.
- `packageDescriptor` or `storageKey` for future SCORM-like packages.

The V1 fixture intentionally does not implement file upload, package extraction, or a SCORM player. Those should be added through generic storage/runtime primitives, not LMS-specific frontend code.

## Runtime Behavior

Published applications render resources through existing dashboard widgets, Page navigation, runtime rows, and scripts.
Progress is stored in Object records and Object-backed ledgers such as `ProgressLedger` and `LearningActivityLedger`.
