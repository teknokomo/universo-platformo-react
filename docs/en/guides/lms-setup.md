---
description: Step-by-step setup flow for shipping the canonical LMS metahub, publication, linked application, and snapshot fixture.
---

# LMS Setup

This guide describes the supported workflow for the built-in LMS template and its canonical Orbital Academy fixture.

## 1. Create Or Regenerate The Canonical Fixture

1. Use the generator spec at `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`.
2. Keep `tools/testing/e2e/support/lmsFixtureContract.ts` as the source of truth for the seeded dataset.
3. Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only through that end-to-end export flow.

## 2. Review The Shipped Seeded Surface

The canonical fixture ships a bilingual Orbital Academy dataset with these entities:

- `Classes`
- `Students`
- `Modules`
- `Quizzes`
- `QuizResponses`
- `ModuleProgress`
- `AccessLinks`
- `Enrollments`

It also ships the LMS enumerations, the default dashboard widgets, and multiple guest-access routes.

## 3. Keep The Widget Script Contract Stable

The imported LMS layout expects these canonical metahub widget scripts:

- `lms-module-viewer`
- `lms-stats-viewer`

Do not hand-edit exported snapshot script payloads; update the generator and contract, then re-export.

## 4. Publish The Imported Or Generated Metahub

1. Create a publication for the LMS metahub.
2. Add a version.
3. Sync until the publication becomes ready.

## 5. Create The Linked Application

When creating the application, enable `workspacesEnabled` and public runtime access.

After creation, run application schema sync so the linked app can clone the seeded LMS rows into shared workspaces.

## 6. Do Not Manually Rebuild The Demo Rows

The shipped fixture already contains the classes, modules, quizzes, access links, progress rows, and widget content required for the demo.

If the dataset must change, update the generator and fixture contract first instead of reseeding runtime tables by hand.

## 7. Verify Both Runtime Surfaces

1. Open `/a/:applicationId` and verify the authenticated EN and RU dashboard widgets.
2. Open `/public/a/:applicationId/links/:slug` and verify the EN and RU guest-learning flows.

## Related Reading

- [LMS Overview](lms-overview.md)
- [LMS Guest Access](lms-guest-access.md)
- [Quiz Application Tutorial](quiz-application-tutorial.md)
