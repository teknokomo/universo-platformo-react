---
description: Step-by-step setup flow for shipping the canonical LMS metahub, publication, linked application, and snapshot fixture.
---

# LMS Setup

This guide describes the supported workflow for the built-in LMS template and its canonical Learning Portal fixture.

## 1. Create Or Regenerate The Canonical Fixture

1. Use the generator spec at `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`.
2. Keep `tools/testing/e2e/support/lmsFixtureContract.ts` as the source of truth for the seeded dataset.
3. Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only through that end-to-end export flow.

## 2. Review The Shipped Seeded Surface

![Seeded LMS runtime dashboard](../.gitbook/assets/quiz-tutorial/runtime-quiz.png)

The canonical fixture ships a bilingual Learning Portal dataset with these entities:

- `Classes`
- `Students`
- `Modules`
- `Quizzes`
- `QuizResponses`
- `ModuleProgress`
- `AccessLinks`
- `Enrollments`

It also ships the LMS enumerations, a curated working runtime menu, workspace-aware seeded rows, and multiple guest-access routes.

## 3. Keep The Product Fixture Contract Stable

The imported LMS layout must stay free of removed global dashboard widgets and removed metahub widget scripts:

- no `moduleViewerWidget`
- no `statsViewerWidget`
- no `qrCodeWidget`
- no `lms-module-viewer` script
- no `lms-stats-viewer` script

Do not hand-edit exported snapshot payloads. Update the generator or fixture contract, then re-export or mechanically rewrite the snapshot with a recomputed `snapshotHash`.

## 4. Publish The Imported Or Generated Metahub

1. Create a publication for the LMS metahub.
2. Add a version.
3. Sync until the publication becomes ready.

## 5. Create The Linked Application

When creating the application, enable `workspacesEnabled` and public runtime access.

After creation, run application schema sync so the linked app can clone the seeded LMS rows into shared workspaces.

## 6. Do Not Manually Rebuild The Demo Rows

The shipped fixture already contains the classes, modules, quizzes, access links, progress rows, and workspace seed data required for the MVP scenario.

If the dataset must change, update the generator and fixture contract first instead of reseeding runtime tables by hand.

## 7. Verify Both Runtime Surfaces

![LMS guest result screen](../.gitbook/assets/quiz-tutorial/runtime-quiz.png)

1. Open `/a/:applicationId` and verify that EN and RU authenticated runtime starts from the `Modules` section, has no duplicate `Workspaces` entry, and every visible menu item either opens a real section or a real route.
2. Open `/public/a/:applicationId/links/:slug` and verify the EN and RU guest-learning flows.

## Related Reading

- [LMS Overview](lms-overview.md)
- [LMS Guest Access](lms-guest-access.md)
- [Quiz Application Tutorial](quiz-application-tutorial.md)
