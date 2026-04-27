---
description: Product overview of the LMS MVP built on metahubs, applications, and public runtime links.
---

# LMS Overview

The current LMS surface on Universo Platformo is implemented as metahub configuration plus generic application runtime capabilities.
It is not a hardcoded vertical inside `packages/apps-template-mui`, and the shipped demo now comes from a canonical bilingual Orbital Academy fixture.

## What The MVP Covers

- Classes and student directories as ordinary metahub entities.
- Learning modules stored as runtime rows with structured content items.
- Quiz catalogs and quiz-response tracking.
- Workspace-aware collaboration for teachers or operators inside the same application.
- Public access links that let a guest enter a name, open a module or quiz, and submit progress without a registered platform account.
- QR-code rendering in the application shell for direct module or quiz distribution.

## What Stays Out Of Scope For This MVP

- AI tutor and content-generation flows.
- Full reporting and analytics packages.
- Complex grading policies, certificates, or timetable automation.
- Custom LMS-only frontend packages outside the shared MUI app template.

## Core Building Blocks

![LMS application dashboard](../.gitbook/assets/quiz-tutorial/runtime-quiz.png)

1. The `lms` built-in metahub template defines the canonical entity structure: classes, students, modules, quizzes, access links, progress, enrollments, and supporting enumerations.
2. The applications backend exposes workspace management and a public runtime surface for guest access.
3. The shared MUI template provides workspace switching, QR-code rendering, module viewing, and statistics widgets.
4. The committed generator plus snapshot contract ship a richer EN/RU Orbital Academy dataset with multiple classes, modules, quizzes, seeded progress, and two guest-access routes.

## Runtime Model

![LMS guest module runtime](../.gitbook/assets/quiz-tutorial/runtime-quiz.png)

Authenticated users work in the normal application runtime at `/a/:applicationId`.
Guests use the public route `/public/a/:applicationId/links/:slug`, enter a display name, receive a guest session token, and continue without platform login.
When workspaces are enabled, the public runtime resolves data through the workspace owned by the access link or the current guest session instead of falling back to an unrelated active workspace.
The browser client keeps guest-session state in session storage for the current tab or browser session rather than as durable shared-device local storage.

## Verified Browser Surface

The shipped LMS browser suite covers workspace management, public-link negative cases, QR-code distribution, statistics rendering, the EN guest journey, and an RU guest route using localized module, quiz, and access-link copy.

## Related Reading

- [LMS Setup](lms-setup.md)
- [LMS Guest Access](lms-guest-access.md)
- [Workspace Management](workspace-management.md)
- [LMS Entities](../architecture/lms-entities.md)
