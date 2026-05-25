# LMS Configuration Notes

This reference applies the architectural rules from `SKILL.md`,
`references/entity-types-mapping.md`, and
`references/configuration-workflow.md` to the LMS configuration
specifically. Use it when work targets Learning Content, Courses,
Learning Tracks, Quizzes, or related LMS surfaces.

## Template And Preset Set

The LMS configuration starts from the `lms` metahub template
(`packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts`).

Active presets in the LMS template are the same five as the `basic`
template:

-   **Hub** — top-level grouping (for example, a `Learning` hub that
    contains LMS domain objects).
-   **Object** — courses, lessons, learning tracks, enrollments,
    submissions, progress records, **and the ledger-style entities**.
-   **Page** — Editor.js-authored content (lesson bodies, course overviews,
    knowledge-base pages).
-   **Set** — global LMS settings (passing thresholds, quiz defaults, retry
    limits where they live in the configuration rather than per
    deployment).
-   **Enumeration** — closed lists (lesson kind, question kind, status
    codes, role enumerations).

The LMS template does **not** include a separate `Ledger` preset. The
register-style behavior is implemented as Object with `config.ledger`
(see next section).

Plus the cross-cutting capabilities:

-   **Attached modules** — for grading logic, validation, derived progress
    numbers, automated transitions.
-   **Workspaces** — for actual courses and student data inside the
    published LMS application.

## Ledger-Style Entities In LMS

The LMS template demonstrates the strengthen-existing-preset rule. Every
ledger-style entity in the LMS is `kind: 'object'` with `config.ledger`:

| LMS entity               | Codename                 | Ledger mode            |
| ------------------------ | ------------------------ | ---------------------- |
| Learning Activity Ledger | `LearningActivityLedger` | `balance`, append-only |
| Enrollment Ledger        | `EnrollmentLedger`       | `balance`, append-only |
| Attendance Ledger        | `AttendanceLedger`       | `balance`, append-only |
| Certificate Ledger       | `CertificateLedger`      | `balance`, append-only |
| Points Ledger            | `PointsLedger`           | `balance`, append-only |
| Notification Ledger      | `NotificationLedger`     | `balance`, append-only |

These all use Object's `posting` and `ledgerSchema` capabilities. They are
not separate `kind: 'ledger'` entities. A brief that proposes a new
LMS-related register should follow the same pattern unless there is a
clear reason to opt the configuration into the future 1C-compatible
template.

## Layer Placement For LMS

| LMS concern                                                      | Layer                     | Rationale                                |
| ---------------------------------------------------------------- | ------------------------- | ---------------------------------------- |
| Course type definitions, lesson type definitions                 | Metahub                   | Ship with every deployment of the LMS    |
| Default quiz question types and their UI                         | Metahub                   | Configuration-wide                       |
| Attached grading modules (default)                               | Metahub                   | Default behavior of the configuration    |
| Default seeded course (used as template / demo)                  | Metahub                   | Ships with the configuration             |
| Ledger-style Object definitions and capabilities                 | Metahub                   | Configuration contract, not runtime data |
| LMS branding (name, logo)                                        | Application control panel | Varies per deployment                    |
| Feature flags (for example, enable/disable AI assist, messaging) | Application control panel | Per-deployment toggle                    |
| Default role on join for this deployment                         | Application control panel | Per-deployment                           |
| Real courses authored by instructors                             | Workspace                 | Created by users                         |
| Real quizzes, lessons, learning tracks created at runtime        | Workspace                 | User-authored content                    |
| Student enrollments, submissions, progress                       | Workspace                 | Runtime data                             |
| Posted ledger facts (rows in `LearningActivityLedger`, etc.)     | Workspace                 | Runtime data                             |

## Reference System

The LMS configuration is benchmarked against [iSpring LMS Learning Content](https://ispringhelpdocs.com/ispring-learn/learning-content-35665427.html).
The benchmark covers Projects, Standalone Content, Courses, Learning
Tracks, and other Learning Content sub-areas.

The benchmark does not extend (in current scope) to:

-   File and SCORM/xAPI import (deferred);
-   AI generation (deferred);
-   Internal messaging (deferred).

A brief that scopes a particular LMS slice should reference iSpring docs
in its **Reference Material** section, not duplicate the iSpring feature
list inline.

## Apply The Anti-Hardcoding Rule

LMS-specific labels, icons, and logic must compose from the generic
primitives in:

-   `packages/apps-template-mui` — dashboards, data grids, cards, form
    dialogs;
-   `packages/universo-template-mui` — shared template components.

LMS naming, copy, and icons live in metadata or i18n resources, not in
widget code. Before proposing an LMS-only widget, verify the existing
widgets cannot be extended.

## Shared Snapshot For End-to-End Validation

The LMS configuration is exported as a Playwright fixture snapshot at
`tools/fixtures/metahubs-lms-app-snapshot.json`. The snapshot is the
end-to-end deliverable that lets the user import the configuration and
compare it against iSpring LMS in a browser.

When a brief proposes Learning Content changes that should be reflected
in the snapshot, the brief must say so explicitly so PLAN can scope the
fixture update.
