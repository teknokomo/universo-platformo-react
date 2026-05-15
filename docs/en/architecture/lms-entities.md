---
description: Canonical entity model for the LMS metahub template and runtime guest-access flows.
---

# LMS Entities

The LMS template is intentionally entity-first.
All primary LMS concepts are represented as ordinary metahub entities.

## Core Objects

| Entity           | Purpose                                                                            |
| ---------------- | ---------------------------------------------------------------------------------- |
| `LearnerHome`    | Non-physical Page with Editor.js-compatible blocks for the learner landing surface |
| `Classes`        | Student groups or cohorts                                                          |
| `Students`       | Registered learners and guest learners                                             |
| `Modules`        | Learning content and structured content items                                      |
| `Quizzes`        | Quiz definitions with question tables                                              |
| `QuizResponses`  | Per-question response persistence                                                  |
| `ModuleProgress` | Per-student module progress                                                        |
| `AccessLinks`    | Guest-access routing records                                                       |
| `Enrollments`    | Class-student-module bridge                                                        |

## Operational Ledgers

| Ledger           | Purpose                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `ProgressLedger` | Append-oriented learning progress movements keyed by learner, module, workspace, and attempt    |
| `ScoreLedger`    | Append-oriented quiz and assessment score movements with score, max score, and percent measures |

## Supporting Enumerations

| Enumeration        | Purpose                                   |
| ------------------ | ----------------------------------------- |
| `ModuleStatus`     | draft / published / archived              |
| `EnrollmentStatus` | invited / active / completed / dropped    |
| `QuestionType`     | single choice / multiple choice           |
| `ContentType`      | text / image / video URL / quiz reference |

## Important Modeling Decisions

-   Quiz options are stored in a JSON field inside each question row.
-   `TABLE` fields are used for module content items and quiz questions.
-   `LearnerHome` is a Page, not a physical runtime table. Its content is carried by metadata blocks and rendered by the shared dashboard details surface.
-   `ProgressLedger` and `ScoreLedger` are standard Ledger entities, not LMS-specific services. They use the shared Ledger configuration block for dimensions, resources, measures, period fields, and projections.
-   Transactional LMS objects use the shared Object `behavior` tab for numbering, effective dates, lifecycle states, posting targets, and posting scripts. The LMS fixture stores these settings in `config.recordBehavior`.
-   Access links are ordinary runtime rows rather than a separate routing subsystem.
-   Guest sessions create student rows in the same application schema so progress and quiz statistics remain queryable together.

## Page Content Authoring

Page content is edited in the metahub on the entity-owned content route:
`/metahub/:metahubId/entities/:kindKey/instance/:entityId/content`.

The authoring surface uses the official Editor.js core and tools through the shared `@universo/template-mui` editor adapter.
The backend does not persist raw Editor.js `OutputData`; it normalizes supported blocks into the canonical Page block schema and rejects unsafe text, unsupported blocks, and unsafe URLs before persistence.
Published applications do not bundle Editor.js for rendering.
`packages/apps-template-mui` renders the canonical Page blocks through the existing runtime dashboard components.

## Widget Layer

The LMS layout uses the same generic dashboard widgets as other published applications:

-   `menuWidget` with curated primary items, optional overflow, and a `startPage` pointing at `LearnerHome`.
-   `appNavbar`, `header`, `detailsTitle`, and `detailsTable` for the runtime shell and data surfaces.
-   `columnsContainer` when a layout needs composed dashboard content while preserving nested widget configuration.

The platform still supports script-backed widgets and QR widgets as generic capabilities, but the LMS fixture does not bind global module/statistics/QR widgets into the default application layout.
LMS-specific behavior comes from metahub configuration, entity data, scripts attached to the relevant metadata surface, and public runtime links.
