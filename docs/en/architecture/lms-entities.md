---
description: Canonical entity model for the LMS metahub template and runtime guest-access flows.
---

# LMS Entities

The LMS template is intentionally entity-first.
All primary LMS concepts are represented as ordinary metahub entities.

## Core Catalogs

| Entity | Purpose |
| --- | --- |
| `Classes` | Student groups or cohorts |
| `Students` | Registered learners and guest learners |
| `Modules` | Learning content and structured content items |
| `Quizzes` | Quiz definitions with question tables |
| `QuizResponses` | Per-question response persistence |
| `ModuleProgress` | Per-student module progress |
| `AccessLinks` | Guest-access routing records |
| `Enrollments` | Class-student-module bridge |

## Supporting Enumerations

| Enumeration | Purpose |
| --- | --- |
| `ModuleStatus` | draft / published / archived |
| `EnrollmentStatus` | invited / active / completed / dropped |
| `QuestionType` | single choice / multiple choice |
| `ContentType` | text / image / video URL / quiz reference |

## Important Modeling Decisions

- Quiz options are stored in a JSON field inside each question row.
- `TABLE` fields are used for module content items and quiz questions.
- Access links are ordinary runtime rows rather than a separate routing subsystem.
- Guest sessions create student rows in the same application schema so progress and quiz statistics remain queryable together.

## Widget Layer

The LMS layout uses generic widgets:

- `moduleViewerWidget`
- `statsViewerWidget`
- `qrCodeWidget`

The platform packages provide the rendering infrastructure; the LMS-specific meaning comes from metahub configuration and runtime data.
