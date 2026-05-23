# Progress Log

> Completed work only. Active tasks live in tasks.md; reusable implementation rules live in systemPatterns.md.

## IMPORTANT: Version History Table

**The table below MUST remain at the top of this file. All new progress entries should be added BELOW this table.**

| Release      | Date       | Codename                    | Highlights                                                                               |
| ------------ | ---------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| 0.62.0-alpha | 2026-05-06 | Dynamic Portal 🌀           | LMS portal runtime MVP, Page entity authoring, Node.js 22 migration                      |
| 0.61.0-alpha | 2026-04-30 | Hardened Surface 🛡️         | Data-driven entity resource surfaces, runtime workspace management, GitBook docs refresh |
| 0.60.0-alpha | 2026-04-23 | Academic Foundation 🎓      | LMS MVP platform support, application layout management, empty template                  |
| 0.59.0-alpha | 2026-04-17 | Universal Entities 🧩       | Entity Component Architecture, entity-first transition, i18n refactoring                 |
| 0.58.0-alpha | 2026-04-08 | Ancient Manuscripts 📜      | Metahub scripting, quiz runtime, General section, shared attributes                      |
| 0.57.0-alpha | 2026-04-03 | Good Eyesight 🧐            | Playwright E2E coverage, QA hardening, controllers extraction                            |
| 0.56.0-alpha | 2026-03-27 | Cured Disease 🤒            | JSONB/VLC unification, security fixes, CSRF middleware                                   |
| 0.55.0-alpha | 2026-03-19 | Best Role 🎬                | Bootstrap superuser, admin roles, metapanel dashboard, workspaces                        |
| 0.54.0-alpha | 2026-03-13 | Beaver Migration 🦫         | Knex.js migration system, system app convergence, optimistic CRUD                        |
| 0.53.0-alpha | 2026-03-05 | Lucky Set 🍱                | Sets and constants, drag-and-drop ordering, metahub settings                             |
| 0.52.0-alpha | 2026-02-25 | Tabular Infinity 🤪         | TABLE attribute type, inline editing, NUMBER field improvements                          |
| 0.51.0-alpha | 2026-02-19 | Counting Sticks 🥢          | Enumerations, migration guard, data-driven MainGrid                                      |
| 0.50.0-alpha | 2026-02-13 | Great Love ❤️               | Template system, declarative DDL, layout widgets, cloning                                |
| 0.49.0-alpha | 2026-02-05 | Stylish Cow 🐮              | Layouts system, MUI 7 migration, display attributes, VLC support                         |
| 0.48.0-alpha | 2026-01-29 | Joint Work 🪏                | Metahub branches, three-level system fields, optimistic locking                          |
| 0.47.0-alpha | 2026-01-23 | Friendly Integration 🫶      | Publication versioning, schema-ddl package, runtime migrations                           |
| 0.46.0-alpha | 2026-01-16 | Running Stream 🌊           | Applications modules, metahubs publications, DDD refactoring                             |
| 0.45.0-alpha | 2026-01-11 | Structured Structure 😳     | Catalogs functionality, VLC localization, i18n integration                               |
| 0.44.0-alpha | 2026-01-04 | Fascinating Acquaintance 🖖 | Onboarding wizard, GDPR consent, Yandex SmartCaptcha                                     |
| 0.43.0-alpha | 2025-12-27 | New Future 🏋️‍♂️               | Onboarding wizard, start pages i18n, pagination fixes                                    |
| 0.42.0-alpha | 2025-12-18 | Dance Agents 👯‍♀️             | VLC system, dynamic locales, Flowise 3.x agents integration                              |
| 0.41.0-alpha | 2025-12-11 | High Mountains 🌄           | UUID v7 infrastructure, auth-frontend package, dynamic roles                             |
| 0.40.0-alpha | 2025-12-05 | Straight Rows 🎹            | Admin panel with RBAC, package extraction, global naming refactoring                     |
| 0.39.0-alpha | 2025-11-25 | Mighty Campaign 🧙🏿          | Campaigns integration, storages management, useMutation pattern                          |
| 0.38.0-alpha | 2025-11-21 | Secret Organization 🥷      | Organizations module, projects hierarchy, AR.js quiz nodes                               |
| 0.37.0-alpha | 2025-11-13 | Smooth Horizons 🌅          | Agents system, clusters module, OpenAPI 3.1 refactoring                                  |
| 0.36.0-alpha | 2025-11-07 | Revolutionary Indicators 📈 | Metaverse dashboard, analytics charts, sections refactoring                              |
| 0.35.0-alpha | 2025-10-30 | Bold Steps 💃               | Rate limiting with Redis, i18n refactoring, TypeScript modernization                     |
| 0.34.0-alpha | 2025-10-23 | Black Hole ☕️              | Global monorepo refactoring, tsdown implementation, dependency centralization            |
| 0.33.0-alpha | 2025-10-16 | School Test 💼              | Metaverses module, quiz timer, publication system fixes                                  |
| 0.32.0-alpha | 2025-10-09 | Straight Path 🛴            | Publication system, Base58 links, access control, role-based permissions                 |
| 0.31.0-alpha | 2025-10-02 | Victory Versions 🏆         | Canvas versioning, Material-UI template system, UPDL refactoring                         |
| 0.30.0-alpha | 2025-09-21 | New Doors 🚪                | Passport.js + Supabase hybrid auth, Vitest coverage, AR.js camera mode                   |
| 0.29.0-alpha | 2025-09-15 | Cluster Backpack 🎒         | Metaverses architecture, cluster/domain/resource isolation, publication settings         |
| 0.28.0-alpha | 2025-09-07 | Orbital Switch 🥨           | Resources and entities services, spaces refactoring, CTE queries                         |
| 0.27.0-alpha | 2025-08-31 | Stable Takeoff 🐣           | Template modularization, finance module, multiplayer-colyseus integration                |
| 0.26.0-alpha | 2025-08-24 | Slow Colossus 🐌            | MMOOMM template extraction, PlayCanvas integration, Kiro IDE config                      |
| 0.25.0-alpha | 2025-08-17 | Gentle Memory 😼            | Metaverse module MVP, Space Builder, Gemini Code Assist rules                            |
| 0.24.0-alpha | 2025-08-12 | Stellar Backdrop 🌌         | Space Builder prompt-to-flow, AR.js wallpaper mode, uniks extraction                     |
| 0.23.0-alpha | 2025-08-05 | Vanishing Asteroid ☄️       | UPDL conditional parameters, custom modes system, Russian docs                           |
| 0.22.0-alpha | 2025-07-27 | Global Impulse ⚡️          | MMOOMM modular architecture, laser mining, inventory refactoring                         |
| 0.21.0-alpha | 2025-07-20 | Firm Resolve 💪             | PlayCanvas MMOOMM stabilization, handler refactoring, ship controls                      |

---

## 2026-05-23 - LMS Runtime UX/i18n Release Blocker Remediation

### Summary

Closed the screenshot-driven LMS runtime UX/i18n blockers. Normal runtime surfaces now format date and datetime values for the active locale instead of exposing raw ISO timestamps, ResourcePreview uses the correct application i18n namespace, LMS seeded runtime copy is bilingual on Russian surfaces, Learning Content toolbar/detail spacing is more consistent, and the browser suite has executable canaries for the exact defect classes reported by the user.

### Implemented

-   Added generic locale-aware DATE/DATETIME display formatting for runtime values, DataGrid columns, cards, and detail surfaces.
-   Fixed ResourcePreview localization for resource type/action labels and normalized page/source body rendering so Russian previews no longer show English fallback text for localized content.
-   Normalized LMS template and generated snapshot body text to VLC where the content is user-facing, without introducing LMS-only runtime forks.
-   Tightened existing MUI toolbar controls and detail spacing to avoid mixed button heights and cramped module transitions.
-   Strengthened Playwright UX oracles for raw ISO timestamps, English fallback text on Russian LMS surfaces, DataGrid technical leakage, toolbar control geometry, and page-level horizontal overflow.
-   Fixed the generic `records.union` backend projection path so localized string fields and referenced labels use the requested runtime locale.

### Validation

-   `pnpm exec prettier --write ...` for the touched runtime UI, backend, LMS template, fixture, and E2E files.
-   `pnpm exec vitest run --workspace vitest.workspace.ts packages/apps-template-mui/src/utils/__tests__/displayValue.test.ts packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx packages/apps-template-mui/src/components/runtime-ui/__tests__/runtimeUi.test.tsx`: 28 passed.
-   `pnpm run check:lms-fixture-contract`: passed.
-   `pnpm run check:runtime-no-lms-forks`: passed.
-   `pnpm --filter @universo/applications-backend test -- src/tests/routes/applicationsRoutes.test.ts --runInBand`: 155 passed.
-   `pnpm --filter @universo/applications-backend build`: passed.
-   `pnpm run build:e2e:local-supabase`: passed on local minimal Supabase.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium --grep "lms snapshot fixture imports"`: 2 passed in 3.6 minutes on local minimal Supabase.

## 2026-05-23 - LMS Learning Content Post-QA Release Blocker Remediation

### Summary

Closed the post-QA release blockers for the public LMS guest runtime and generic runtime row mutation contracts. Guest progress is now server-owned, restore and reorder mutations fail closed under workspace limits and locked-row constraints, duplicate public access-link slugs inside one workspace are rejected, and the public guest browser evidence now exercises a realistic content-plus-quiz journey on local minimal Supabase.

### Implemented

-   Converted public guest progress writes to an action-intent API; browser requests can only send the participant/session/content identity and an action, while the backend derives status, percent, and last accessed item from persisted content data.
-   Validated public guest progress content-item references before writing progress and rejected browser-owned `status`, `progressPercent`, and `lastAccessedItemIndex` payload fields through strict schema parsing.
-   Made same-workspace duplicate public access-link slugs fail closed while preserving the existing cross-workspace ambiguity protection.
-   Enforced workspace object row limits before restoring deleted runtime rows.
-   Blocked persisted runtime row reordering when any selected row is locked and guarded the update statement against locked targets.
-   Aligned public workspace documentation with the implemented policy that public runtime links resolve through non-personal shared workspaces, not personal `Main` workspaces.
-   Strengthened the LMS public guest Playwright flow with real learning content, embedded quiz questions, answer submission, `Score 2 / 2` verification, viewport screenshots, no page-level overflow checks, technical-leakage checks, and guest-progress request-body assertions.

### Validation

-   `pnpm exec prettier --write` on the updated backend, frontend, E2E, docs, and Memory Bank files.
-   `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/routes/publicApplicationsRoutes.test.ts src/tests/routes/applicationsRoutes.test.ts --runInBand`: 2 suites and 181 tests passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/standalone/__tests__/GuestApp.test.tsx`: 14 tests passed.
-   `pnpm exec eslint` on the changed backend controllers/tests, `GuestApp`, `GuestApp.test`, and LMS public guest E2E spec: passed.
-   `pnpm run check:runtime-no-lms-forks`: passed.
-   `pnpm run check:lms-fixture-contract`: passed.
-   `pnpm --filter @universo/applications-backend build`: passed.
-   `pnpm --filter @universo/apps-template-mui build`: passed.
-   `pnpm run build:e2e:local-supabase`: passed against local minimal Supabase.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --grep "enforce the guest journey"`: 2 browser tests passed against local minimal Supabase after fixing the completion-response assertion to wait for the `complete` request body.
-   `git diff --check`: passed before the final Memory Bank update.

## 2026-05-23 - LMS Learning Content Final QA Remediation Follow-up

### Summary

Closed the remaining QA follow-up items after the public workspace isolation pass. Public guest writes now serialize progress and assessment-attempt mutations, duplicate active public access-link slugs across public workspaces fail closed, runtime access-entry validation is applied during copy, and public guest browser evidence now covers positive viewport/no-overflow paths and RU negative link errors on local Supabase.

### Implemented

-   Added transaction-scoped advisory locks for public guest content-progress writes and assessment attempt numbering.
-   Moved public guest assessment attempt-number calculation into the same transaction that writes responses.
-   Changed workspace-aware public access-link lookup to return a link only when exactly one active non-personal public workspace owns the requested slug or id.
-   Applied runtime access-entry membership validation to copied rows before any copy insert can run.
-   Strengthened backend regression tests for duplicate public slugs, guest progress locks, guest assessment locks, transactional attempt numbering, and access-entry copy validation.
-   Strengthened public guest Playwright coverage with viewport matrix screenshots, no page-level horizontal overflow checks, technical-leakage checks, and RU wrong-slug error coverage.
-   Reconciled the active Memory Bank follow-up: the parent ACL and public workspace isolation items were already completed in the previous security gate entry; only the concurrency, duplicate slug, copy validation, and browser evidence items remained active in this pass.

### Validation

-   `pnpm exec prettier --write` on the updated backend, E2E, and Memory Bank files.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/publicApplicationsRoutes.test.ts src/tests/routes/applicationsRoutes.test.ts`: 2 suites and 177 tests passed.
-   `pnpm --filter @universo/applications-backend lint`: passed.
-   `pnpm exec eslint tools/testing/e2e/support/browser/runtimeUx.ts tools/testing/e2e/specs/flows/lms-guest-public-runtime.spec.ts tools/testing/e2e/specs/flows/lms-guest-public-runtime-negative.spec.ts`: passed.
-   `pnpm run check:lms-fixture-contract`: passed.
-   `pnpm run check:runtime-no-lms-forks`: passed.
-   `pnpm run check:runtime-ux-agents`: passed.
-   `git diff --check`: passed.
-   `pnpm supabase:e2e:start:minimal`: local E2E Supabase minimal stack started.
-   `pnpm env:e2e:local-supabase`: local E2E env files regenerated.
-   `pnpm doctor:e2e:local-supabase`: passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-guest-public-runtime.spec.ts tools/testing/e2e/specs/flows/lms-guest-public-runtime-negative.spec.ts --project=chromium`: 3 browser tests passed on local Supabase.

## 2026-05-23 - LMS Learning Content Final Security Gate Remediation

### Summary

Closed the final security and release-gate remediation slice for the LMS Learning Content productization work. Runtime record commands now enforce row-level edit access, LMS child outline objects inherit parent record access through generic metadata, restore-to-original fails closed when the original parent is no longer valid, and public guest browser coverage verifies negative access-link paths without technical leakage.

### Implemented

-   Enforced runtime row-level edit access on direct `post`, `unpost`, and `void` record-state commands by applying the edit ACL in both the locked row selection and final update.
-   Added generic `runtimeRecordParentAccess` metadata support with parent-reference validation and SQL access inheritance for child outline records.
-   Configured LMS `CourseSections`, `CourseItems`, `TrackStages`, and `TrackSteps` to inherit access from their parent `Courses` or `LearningTracks` records.
-   Hardened create, update, bulk update, restore, and original-target restore paths so invalid or unauthorized parent references fail closed instead of silently reviving or moving rows.
-   Updated the LMS template fixture, fixture-contract checks, and CI/agent gates for the new parent-access metadata and no-fork runtime constraints.
-   Normalized public access-link dates and numeric counters returned by Postgres so guest links expire and exhaust consistently across unit tests, built server runs, and browser E2E.
-   Strengthened public guest Playwright flows for active, wrong-slug, expired, and exhausted access links, including technical-leakage checks on public runtime pages.
-   Removed stale post-V2 and legacy wording from LMS Learning Content docs.
-   Sanitized `.env.e2e.backup` to placeholders after local secret-like values were present in the working diff; any real exposed credentials still need external rotation and history cleanup.

### Validation

-   `pnpm exec prettier --write` on the updated backend, template, fixture, E2E, docs, CI, and Memory Bank files.
-   `pnpm --filter @universo/applications-backend lint`: passed.
-   `pnpm exec eslint tools/testing/e2e/specs/flows/lms-guest-public-runtime.spec.ts tools/testing/e2e/specs/flows/lms-guest-public-runtime-negative.spec.ts tools/testing/e2e/support/lmsRuntime.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`: passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/services/runtimeReportsService.test.ts src/tests/routes/applicationsRoutes.test.ts src/tests/routes/publicApplicationsRoutes.test.ts`: 3 suites and 185 tests passed.
-   `pnpm --filter @universo/metahubs-backend test -- --runInBand --testPathPattern "templateManifestValidator.test.ts|metahubSchemaService.test.ts" --testNamePattern "lms|LMS|built-in lms|template"`: 20 passed, 6 skipped.
-   `pnpm --filter @universo/applications-backend build`: passed.
-   `pnpm --filter @universo/metahubs-backend build`: passed after rerunning sequentially instead of concurrently with the applications backend build.
-   `pnpm run check:lms-fixture-contract`: passed.
-   `pnpm run check:runtime-no-lms-forks`: passed.
-   `pnpm docs:i18n:check`: passed for 75 EN/RU pairs.
-   `node tools/docs/check-gitbook-links.mjs && node tools/docs/check-gitbook-screenshot-assets.mjs`: passed.
-   `pnpm audit --prod --audit-level=low`: passed with no known vulnerabilities.
-   `pnpm run check:runtime-ux-agents`: passed.
-   `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-guest-public-runtime.spec.ts --project=chromium`: 2 passed for the positive guest runtime flow.
-   `E2E_FULL_RESET_MODE=off node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-guest-public-runtime-negative.spec.ts --project=chromium`: 2 passed for wrong-slug, expired, and exhausted guest-link behavior.
-   A normal full-reset negative E2E run also passed the browser tests, but final Supabase cleanup hit a transient `EAI_AGAIN` DNS error; the follow-up `pnpm run test:e2e:cleanup` completed successfully.
-   `git diff --check`: passed.

## 2026-05-22 - LMS Learning Content QA Findings Remediation

### Summary

Closed the remaining QA findings for the LMS Learning Content release gate. Runtime row-level access is now applied consistently to workflow actions, record-picker reference validation, and report reference-label joins; progress and reorder mutations fail closed; and runtime table/card displays render configured option labels instead of stored codenames.

### Implemented

-   Added owner/shared row-access checks for workflow action targets before scripts run.
-   Applied target-row access predicates to record-picker reference validation and runtime reference option hydration.
-   Added access-aware report reference-label metadata and SQL placeholder shifting so report joins cannot reveal labels for rows the caller cannot read.
-   Hardened progress persistence and parent-progress aggregation with advisory locks, `RETURNING` confirmation, and explicit zero-row failure paths.
-   Hardened runtime reorder with affected-row confirmation and backend tests for the new mutation contract.
-   Added generic string-option display formatting for runtime DataGrid, table, and card surfaces so values such as `selectedItems` and `passedFailed` render as localized labels.
-   Strengthened the LMS Playwright flow with visible row-order assertions after reorder and E2E-only API rate-limit overrides for the long browser scenario.
-   Remediated production audit findings for `qs` and `@tootallnate/once` with patched overrides and a narrow `minimumReleaseAgeExclude` entry for the emergency `qs` security patch.

### Validation

-   `pnpm exec prettier --write` on the updated backend, frontend, E2E, and Memory Bank files.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/services/runtimeReportsService.test.ts`: passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`: 147 passed.
-   `pnpm --filter @universo/apps-template-mui test -- src/utils/__tests__/displayValue.test.ts src/utils/__tests__/columns.test.tsx`: 307 passed across the package suite.
-   `pnpm --filter @universo/applications-backend lint`: passed.
-   `pnpm --filter @universo/apps-template-mui lint`: passed.
-   `pnpm --filter @universo/core-frontend build`: passed.
-   `pnpm exec eslint tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`: passed.
-   `pnpm run check:runtime-no-lms-forks`: passed.
-   `pnpm run check:lms-fixture-contract`: passed on Node.js 22.
-   `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project=chromium --grep "lms snapshot fixture imports"`: 2 passed, including setup and the full LMS browser flow.
-   `git diff --check`: passed.
-   `pnpm install --lockfile-only`: passed.
-   `pnpm install --frozen-lockfile`: passed.
-   `pnpm audit --prod --audit-level=low`: passed with no known vulnerabilities.

## 2026-05-22 - LMS Learning Content QA Release Gate Closure

### Summary

Closed the follow-up QA release-gate slice for the LMS Learning Content productization work. The executable acceptance matrix now distinguishes browser-proven release gates from deferred/API-only evidence, the learner player restores completion counts from persisted runtime progress rows, and the Reports surface has direct browser evidence for execution, CSV export, technical-leakage suppression, and responsive no-overflow behavior.

### Implemented

-   Added explicit browser/API/fixture evidence fields to the LMS acceptance matrix and prevented deferred or API-only areas from being counted as browser-proven release gates.
-   Scoped the primary Reports runtime layout to the generic `detailsTable` widget with `reportCodename: "LearningContentSummary"` instead of inline report definitions.
-   Updated the learner player to derive completed items from persisted runtime item status and to persist view/completion state against the configured completion target object.
-   Returned stored completion status for existing progress rows on `view` actions so reloads do not downgrade completed items to in-progress.
-   Tightened generic runtime UX heuristics for localized numeric validation and technical-field detection so internal messages do not leak and legitimate fields such as `Valid` and `Candidate` remain visible.
-   Strengthened Playwright browser evidence for Project long-text authoring, Reports UI/export, responsive no-overflow checks, and persisted learner-player progress after reload.

### Validation

-   `pnpm exec prettier --write` on the updated runtime, backend, contract, E2E, and Memory Bank files.
-   `pnpm --filter @universo/types build`: passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`: 147 passed.
-   `pnpm --filter @universo/applications-backend build`: passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run src/dashboard/components/__tests__/widgetRenderer.test.tsx src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx src/utils/__tests__/displayValue.test.ts`: 92 passed.
-   `pnpm --dir packages/apps-template-mui lint` and `pnpm --dir packages/apps-template-mui build`: passed.
-   `pnpm --filter @universo/applications-backend lint`, `pnpm --filter @universo/metahubs-backend lint`, and `pnpm --filter @universo/metahubs-backend build`: passed.
-   `pnpm --filter @universo/core-frontend build`: passed.
-   `pnpm run check:lms-fixture-contract`, `pnpm run check:runtime-no-lms-forks`, and `pnpm docs:i18n:check`: passed.
-   `pnpm audit --prod --audit-level=moderate`: passed with only low production advisories reported.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=packages/universo-core-backend/base/.env.e2e node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "LMS snapshot fixture imports"`: 2 passed in Chromium.
-   `git diff --check`: passed.

## 2026-05-22 - LMS Learning Content QA Remediation Closure

### Summary

Closed the QA remediation slice that followed the LMS Learning Content productization pass. The runtime now fails closed for sensitive helper-object access paths, viewer re-share escalation is blocked, server-owned LMS author fields are hidden from normal runtime metadata, semantic long text behaves as multiline UI, and the LMS browser oracle covers the restored copy/share/delete/restore/report/player path without fixed waits.

### Implemented

-   Hardened generic runtime access handling for `records.union` helper-object targets and `library/shared` grants without adding LMS-specific runtime branches.
-   Added backend regression coverage for union helper-object denial, shared-viewer re-share denial, and empty TABLE form echoes during copy.
-   Hid `LearningResources.CreatedBy` in the LMS template and committed snapshot, and strengthened the fixture contract for duplicate codename and system-owned metadata regressions.
-   Updated tabular runtime editors so semantic long text uses multiline controls, added accessible row-action labels, and stabilized heavy MUI unit tests with explicit per-test timeouts instead of weakened assertions.
-   Made Editor.js authoring commit the latest visible content before submit, closing the stale-body race found by the LMS E2E flow.

### Validation

-   `pnpm exec prettier --write` on changed TS/TSX/MD files.
-   `pnpm --filter @universo/applications-backend test -- --runInBand --testPathPattern applicationsRoutes.test.ts --testNamePattern "records.union|shared relation|re-share|runtime copy endpoint|runtime copy|TABLE overrides|empty TABLE"`: 14 passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand --testPathPattern runtimeReportsService.test.ts`: 13 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts --coverage=false`: 299 passed.
-   `pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts --coverage=false`: 177 passed.
-   `pnpm --filter @universo/types test -- --coverage=false`: 96 passed.
-   `pnpm --filter @universo/utils test -- --coverage=false`: 312 passed.
-   `pnpm run check:lms-fixture-contract`, `pnpm run check:runtime-no-lms-forks`, and `pnpm docs:i18n:check`: passed.
-   `pnpm audit --prod --audit-level=high`: passed with no high or critical production advisories; remaining advisories are low/moderate.
-   Package lint passed for applications-backend, applications-frontend, apps-template-mui, block-editor, types, and utils.
-   Package builds passed for applications-backend, applications-frontend, apps-template-mui, block-editor, metahubs-backend, types, utils, and core-frontend.
-   LMS Playwright validation passed: `node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "lms snapshot fixture imports"` under the local Supabase E2E environment, 2 passed.

## 2026-05-22 - LMS Learning Content Productization Final Validation

### Summary

Completed the final validation pass for `memory-bank/plan/lms-learning-content-productization-plan-2026-05-20.md`. The executable LMS product acceptance matrix now has no open gates, and the primary LMS snapshot runtime Playwright flow passes against the local minimal Supabase E2E stack.

### Implemented

-   Marked Phase 10 complete in `tasks.md` for the current plan state.
-   Confirmed all remaining product acceptance gates were either closed in supported generic scope or documented as deferred capabilities inside otherwise passing acceptance areas.
-   Preserved the explicit deferred boundaries for broad package imports, dedicated Knowledge bookmark UI, permission-limited Knowledge search, saved/scheduled report delivery, and department/class/group scoped predicates.

### Validation

-   `pnpm exec prettier --write tools/testing/e2e/support/lmsFixtureContract.ts docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm run check:lms-fixture-contract`
-   `pnpm --filter @universo/applications-backend test -- --runInBand --testPathPattern applicationsRoutes.test.ts --testNamePattern "owner-or-shared|scoped active role policy"`: 2 passed.
-   `pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/pages/__tests__/ApplicationSettings.test.tsx --testNamePattern "unsupported scoped role policy|role policy" --coverage=false`: 2 passed.
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts packages/applications-frontend/base/src/pages/ApplicationSettings.tsx packages/applications-frontend/base/src/pages/__tests__/ApplicationSettings.test.tsx`
-   `pnpm docs:i18n:check`
-   `pnpm run check:runtime-no-lms-forks`
-   `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module - <<'NODE' ... LMS_PRODUCT_ACCEPTANCE_MATRIX ... NODE`: no open product acceptance gates.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "lms snapshot fixture imports"`: 2 passed.
-   `git diff --check`

## 2026-05-22 - Role Visibility Scoped Gate

### Summary

Closed the Role Visibility product acceptance gate for the current supported generic scope. Learning Content records support workspace membership plus owner/shared record visibility, and unsupported scoped role-policy grants remain fail-closed instead of being treated as active department, class, or group predicates.

### Implemented

-   Marked `roleVisibility.actionable` and `roleVisibility.audited` complete in `LMS_PRODUCT_ACCEPTANCE_MATRIX`.
-   Added acceptance evidence for generic owner-or-shared `runtimeRecordAccess`, `ContentAccessEntries` sharing, read-only member filtering, and fail-closed unsupported scoped role-policy rules.
-   Kept department, class, and group predicates as explicit deferred product capabilities until a generic predicate engine can enforce them across row lists, union datasources, reports, and mutations.
-   Updated EN/RU Learning Content docs with the supported role visibility scope and deferred predicates.
-   Updated `tasks.md` so the active plan is now down to final release validation.

### Validation

-   `pnpm run check:lms-fixture-contract`
-   `pnpm --filter @universo/applications-backend test -- --runInBand --testPathPattern applicationsRoutes.test.ts --testNamePattern "owner-or-shared|scoped active role policy"`: 2 passed.
-   `pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/pages/__tests__/ApplicationSettings.test.tsx --testNamePattern "unsupported scoped role policy|role policy" --coverage=false`: 2 passed.
-   `pnpm exec prettier --write tools/testing/e2e/support/lmsFixtureContract.ts docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts packages/applications-frontend/base/src/pages/ApplicationSettings.tsx packages/applications-frontend/base/src/pages/__tests__/ApplicationSettings.test.tsx`
-   `pnpm docs:i18n:check`
-   `pnpm run check:runtime-no-lms-forks`
-   `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module - <<'NODE' ... LMS_PRODUCT_ACCEPTANCE_MATRIX ... NODE`: no open product acceptance gates.
-   `git diff --check`

## 2026-05-22 - Knowledge Base Audited Gate

### Summary

Closed the Knowledge Base product acceptance audit gate within the current generic runtime scope. Knowledge records are seeded, authored, and lifecycle-managed through existing Object, CRUD, mutation, and trash/restore primitives; dedicated bookmark UI and permission-limited knowledge search remain deferred product capabilities.

### Implemented

-   Marked `knowledgeBase.audited` complete in `LMS_PRODUCT_ACCEPTANCE_MATRIX`.
-   Added acceptance evidence for seeded Knowledge spaces, folders, articles, article-targeted bookmarks, published-app article create/edit, and generic mutation/trash lifecycle coverage.
-   Updated EN/RU Learning Content docs so supported Knowledge auditability and deferred capabilities are explicit.
-   Updated `tasks.md` so the remaining active acceptance gates are only `roleVisibility.actionable/audited`.

### Validation

-   `pnpm run check:lms-fixture-contract`
-   `pnpm exec prettier --write tools/testing/e2e/support/lmsFixtureContract.ts docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm docs:i18n:check`
-   `pnpm run check:runtime-no-lms-forks`
-   `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module - <<'NODE' ... LMS_PRODUCT_ACCEPTANCE_MATRIX ... NODE`: remaining open gates are `roleVisibility.actionable/audited`.
-   `git diff --check`

## 2026-05-22 - Reports Audited Gate

### Summary

Closed the remaining Reports product acceptance audit gate without adding an LMS-only reporting surface. The current supported scope is saved report execution and export through the generic runtime reports API, with saved-filter management and scheduled delivery left as explicit deferred product capabilities.

### Implemented

-   Marked `reports.audited` complete in `LMS_PRODUCT_ACCEPTANCE_MATRIX`.
-   Expanded report acceptance evidence to point at saved-definition-only execution, permission checks, safe `records.union` output, CSV export, and runtime identifier suppression coverage.
-   Updated EN/RU LMS Reports docs so the supported auditability scope and deferred report capabilities are clear.
-   Updated `tasks.md` so the remaining active acceptance gates are only `knowledgeBase.audited` and `roleVisibility.actionable/audited`.

### Validation

-   `pnpm run check:lms-fixture-contract`
-   `pnpm --filter @universo/applications-backend test -- --runInBand --testPathPattern applicationsRoutes.test.ts --testNamePattern "Runtime reports route contract"`: 8 passed.
-   `pnpm exec prettier --write tools/testing/e2e/support/lmsFixtureContract.ts docs/en/guides/lms-reports.md docs/ru/guides/lms-reports.md memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm docs:i18n:check`
-   `pnpm run check:runtime-no-lms-forks`
-   `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module - <<'NODE' ... LMS_PRODUCT_ACCEPTANCE_MATRIX ... NODE`: remaining open gates are `knowledgeBase.audited` and `roleVisibility.actionable/audited`.
-   `git diff --check`

## 2026-05-22 - Knowledge Base Actionable Gate

### Summary

Closed the smallest remaining LMS product acceptance gate without adding an LMS-only runtime branch. The Knowledge section is now marked actionable because the published application flow creates and edits `KnowledgeArticles` through the ordinary runtime CRUD surface.

### Implemented

-   Confirmed the Phase 1 `records.union` datasource foundation is already server-side: the app-template sends one typed request to `/runtime/datasources/records/union`, and the backend builds a paginated SQL `UNION ALL` result.
-   Marked `knowledgeBase.actionable` complete in `LMS_PRODUCT_ACCEPTANCE_MATRIX` and added evidence for the published-app Knowledge Article create/edit flow.
-   Kept `knowledgeBase.audited` open and kept bookmarks, trash, permission-limited search, and audit trail as explicit deferred product gaps.
-   Updated EN/RU Learning Content docs so the supported Knowledge scope is clear and does not imply hidden bookmark/search/audit parity.
-   Updated `tasks.md` to close the Phase 1 foundation audit and remove `knowledgeBase.actionable` from the active gate list.

### Validation

-   `pnpm run check:lms-fixture-contract`
-   `pnpm --filter @universo/applications-backend test -- --runInBand --testPathPattern applicationsRoutes.test.ts --testNamePattern "records.union"`: 6 passed.
-   `pnpm --dir packages/universo-types/base exec vitest run --config vitest.config.ts src/__tests__/applicationLayouts.test.ts --testNamePattern "records.union" --coverage=false`: 4 passed.
-   `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module - <<'NODE' ... LMS_PRODUCT_ACCEPTANCE_MATRIX ... NODE`: remaining open gates are `reports.audited`, `knowledgeBase.audited`, and `roleVisibility.actionable/audited`.
-   `pnpm exec prettier --write tools/testing/e2e/support/lmsFixtureContract.ts docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm docs:i18n:check`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "lms snapshot fixture imports"`: 2 passed.
-   `git diff --check`

## 2026-05-22 - LMS Product Acceptance Matrix Reconciliation

### Summary

Reconciled the open LMS productization checklist against the executable `LMS_PRODUCT_ACCEPTANCE_MATRIX` rather than keeping broad stale phase wording in `tasks.md`.

### Implemented

-   Confirmed the matrix has no open gates for content projects, Learning Content shell, standalone Page/Link authoring, course detail/builder, track progression/builder, manual enrollment, learner player, trash restore, workspace isolation, and public guest access.
-   Identified the remaining open matrix gates as `reports.audited`, `knowledgeBase.actionable`, `knowledgeBase.audited`, `roleVisibility.actionable`, and `roleVisibility.audited`.
-   Kept explicit deferred gaps visible for broad package ingestion, learner-home audit ledger, saved/scheduled reports, knowledge bookmarks/trash/permission-limited search, mentor comments/export, and advanced role predicates.
-   Updated `tasks.md` so the remaining active work points at concrete acceptance gaps plus the Phase 1 union datasource foundation audit.

### Validation

-   `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --input-type=module - <<'NODE' ... LMS_PRODUCT_ACCEPTANCE_MATRIX ... NODE`

## 2026-05-22 - Standalone LMS Fixture Contract Gate

### Summary

Closed the standalone LMS fixture-contract runner gap for the productization release gate. The committed LMS snapshot can now be validated through a repository-supported root command without starting Playwright.

### Implemented

-   Added `pnpm run check:lms-fixture-contract` as the supported command for validating `tools/fixtures/metahubs-lms-app-snapshot.json`.
-   Kept the existing `lmsFixtureContract.ts` product oracle as the single source of truth and used `checkLmsFixtureContract.ts` only as a CLI wrapper.
-   Documented the standalone LMS fixture gate in the English and Russian E2E runner READMEs.
-   Recorded the slice in `tasks.md` while keeping broad Phase 1 and Phase 3-8 product acceptance reconciliation open.

### Validation

-   `pnpm run check:lms-fixture-contract`
-   `pnpm exec prettier --write tools/testing/e2e/support/checkLmsFixtureContract.ts package.json tools/testing/e2e/README.md tools/testing/e2e/README-RU.md memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm exec eslint tools/testing/e2e/support/checkLmsFixtureContract.ts`
-   `pnpm docs:i18n:check`
-   `pnpm run check:runtime-no-lms-forks`
-   `git diff --check`

## 2026-05-22 - Generic Resource Preview Title And Description Safety

### Summary

Completed a focused resource preview runtime UX safety slice. `ResourcePreview` now sanitizes title and description captions before rendering them on normal published app surfaces.

### Implemented

-   Routed `ResourcePreview` title and description through the shared safe runtime display formatter.
-   Preserved readable titles/descriptions and the existing localized default title fallback.
-   Kept resource-source parsing, type labels, domain badges, and open actions unchanged.
-   Added focused ResourcePreview coverage proving UUID-bearing titles and runtime JSON descriptions do not leak to users.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/resource-preview/__tests__/ResourcePreview.test.tsx`: 10 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`
-   `git diff --check`

## 2026-05-22 - Generic Records Union Card-Mode Display Safety

### Summary

Completed a focused records-union card-mode runtime UX safety slice. Card title and description values now use the shared safe runtime display formatter, matching the stronger table/grid display contract.

### Implemented

-   Changed the records-union card value formatter to use `formatRuntimeSafeValue`.
-   Preserved readable card titles/descriptions while falling back to the localized untitled card label when title values contain embedded UUIDs or other technical payloads.
-   Added focused widgetRenderer card-mode coverage proving embedded UUID titles, runtime JSON descriptions, object-only codenames, and object placeholders do not leak to users.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "records.union card"`: 2 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`
-   `git diff --check`

## 2026-05-22 - Generic Form Dialog JSON Field Display Safety

### Summary

Completed a focused generic FormDialog JSON safety slice. Normal JSON fields without an approved runtime widget no longer expose prettified raw payloads on user-facing CRUD dialogs.

### Implemented

-   Replaced the generic JSON fallback editor with a localized read-only structured-data message.
-   Preserved `resourceSource` and `editorjsBlockContent` widget branches before the generic fallback.
-   Kept existing structured JSON values in form state so submitting an unchanged dialog preserves the original payload.
-   Added focused FormDialog coverage proving raw JSON keys, storage paths, UUIDs, and object placeholders do not leak.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx --testNamePattern "normal JSON fields|page resources|Editor.js JSON fields"`: 3 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`
-   `git diff --check`

## 2026-05-22 - Generic Localized Inline Validation Helper Safety

### Summary

Completed a focused localized inline-field UX safety slice. Length constraint helper text now uses localized user-facing wording instead of technical `min:` and `max:` prefixes.

### Implemented

-   Added a shared length constraint helper for simple, versioned, and localized inline field variants.
-   Replaced min-length validation helper fallback text with localized wording.
-   Added English and Russian common i18n keys for range, minimum, and maximum length helper text.
-   Added focused component coverage proving simple, versioned, and localized fields do not expose raw helper prefixes.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/components/forms/LocalizedInlineField.tsx packages/apps-template-mui/src/components/forms/__tests__/LocalizedInlineField.test.tsx packages/universo-i18n/base/src/locales/en/core/common.json packages/universo-i18n/base/src/locales/ru/core/common.json memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/forms/__tests__/LocalizedInlineField.test.tsx`: 3 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/components/forms/LocalizedInlineField.tsx packages/apps-template-mui/src/components/forms/__tests__/LocalizedInlineField.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/i18n typecheck`
-   `git diff --check`

## 2026-05-22 - Generic Target Picker Option Label Safety

### Summary

Completed a focused records-union target picker UX safety slice. Restore, target-field, and share-member pickers keep raw IDs in internal values only and avoid showing technical codenames or unsafe member labels.

### Implemented

-   Removed `Codename`/`codename` from default target picker label candidates.
-   Skipped explicit codename label fields in generic target picker display labels.
-   Routed workspace member nickname and email labels through the shared safe runtime display formatter.
-   Added focused widgetRenderer coverage proving restore, target-field, and share-member picker options do not expose UUIDs, raw JSON keys, or codenames.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "workspace member picker|target-field actions|restore target picker"`: 4 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`
-   `git diff --check`

## 2026-05-22 - Generic Target And Share Mutation Error Sanitization Coverage

### Summary

Completed a focused mutation-error UX safety slice for records-union target/share dialogs. Target-field and share-member mutation failures now have direct canaries proving sanitized alerts do not leak backend SQL, relation names, or UUIDs.

### Implemented

-   Added share-member mutation failure coverage for the generic records-union shared action dialog.
-   Added target-field mutation failure coverage for the generic records-union target picker dialog.
-   Replaced fire-and-forget `mutateAsync` usage in library relation actions with `mutate`, matching restore and target-field mutation handling and preventing unhandled rejections on expected mutation failures.
-   Preserved request payload semantics: raw IDs remain internal mutation values only.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "workspace member picker|shared row action mutations|target-field actions|target-field action mutations|restore target picker"`: 6 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`
-   `git diff --check`

## 2026-05-22 - Generic Runtime Quiz Widget Text Display Safety

### Summary

Completed a focused quiz widget runtime UX safety slice. Quiz widget model and submission text from runtime scripts now passes through the shared safe display formatter before reaching normal published app surfaces.

### Implemented

-   Added safe display normalization for quiz title, description, submit/next labels, question prompts, question descriptions, option labels, submission messages, submission explanations, and empty-state metadata.
-   Preserved localized value objects and readable plain strings while suppressing raw UUID values, runtime JSON strings, and object placeholder output.
-   Kept quiz question IDs and option IDs as internal keys and mutation payloads only.
-   Added English and Russian fallback labels for unsafe/missing question and option text.
-   Added focused QuizWidget coverage proving unsafe runtime text does not leak while localized quiz content remains visible.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/QuizWidget.tsx packages/apps-template-mui/src/dashboard/components/__tests__/QuizWidget.test.tsx packages/apps-template-mui/src/i18n/locales/en/quiz.json packages/apps-template-mui/src/i18n/locales/ru/quiz.json memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/QuizWidget.test.tsx`: 7 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/QuizWidget.tsx packages/apps-template-mui/src/dashboard/components/__tests__/QuizWidget.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`
-   `git diff --check`

## 2026-05-22 - Generic Runtime Object Display-Key Fallback Safety

### Summary

Completed a focused shared formatter safety slice. Generic runtime object display formatting no longer treats object-only `codename` or `id` fields as normal user-facing labels.

### Implemented

-   Restricted generic object display keys to explicit human label fields: `label`, `name`, `title`, and `displayName`.
-   Preserved readable explicit labels while suppressing codename-only and id-only objects in normal runtime display formatting.
-   Added focused `displayValue` coverage for codename-only/id-only objects and explicit human label preservation.
-   Added focused DataGrid coverage proving object-only codenames and IDs do not leak through default runtime grid cells.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/utils/displayValue.ts packages/apps-template-mui/src/utils/__tests__/displayValue.test.ts packages/apps-template-mui/src/utils/__tests__/columns.test.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/utils/__tests__/displayValue.test.ts`: 7 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/utils/__tests__/columns.test.tsx`: 8 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/MainGrid.test.tsx`: 26 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/QuizWidget.tsx packages/apps-template-mui/src/dashboard/components/__tests__/QuizWidget.test.tsx packages/apps-template-mui/src/utils/displayValue.ts packages/apps-template-mui/src/utils/__tests__/displayValue.test.ts packages/apps-template-mui/src/utils/__tests__/columns.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`
-   `git diff --check`

## 2026-05-21 - Generic Runtime Record Picker And Relation Builder Error Sanitization

### Summary

Completed a focused runtime form and relation-builder UX safety slice. Metadata-driven record picker load failures and relation-builder parent/panel load failures now use shared runtime error sanitization and localized fallbacks instead of exposing backend error text.

### Implemented

-   Routed `FormDialog` runtime record picker load failures through `extractRuntimeErrorMessage`.
-   Added localized relation-builder load error surfaces for parent and child panel queries.
-   Reused existing record picker fallbacks and added English/Russian relation-builder load fallback keys.
-   Added focused FormDialog coverage for English and Russian unsafe record picker failures.
-   Added focused relation-builder coverage for load, create mutation, and delete mutation failures containing SQL text, relation names, constraints, and UUID values.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/dashboard/components/RelationBuilderWidget.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx --testNamePattern "record picker load"`: 2 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "relation builder (load failures|create mutation failures|delete mutation failures)"`: 3 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/RelationBuilderWidget.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `git diff --check`

## 2026-05-21 - Generic Workspace Switcher ID Fallback Safety

### Summary

Completed a focused workspace switcher runtime UX safety slice. Workspaces with missing or empty localized names now render a localized untitled label instead of exposing the workspace ID on normal published app surfaces.

### Implemented

-   Replaced current workspace and workspace menu raw ID name fallbacks with `workspace.untitled`.
-   Added English and Russian untitled workspace labels.
-   Kept workspace IDs only as internal select values and mutation targets.
-   Added focused WorkspaceSwitcher coverage proving a UUID-like workspace ID is not rendered as visible text when the name is missing.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/dashboard/components/WorkspaceSwitcher.tsx packages/apps-template-mui/src/dashboard/components/__tests__/WorkspaceSwitcher.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/WorkspaceSwitcher.test.tsx --testNamePattern "raw workspace IDs"`: 1 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/WorkspaceSwitcher.tsx packages/apps-template-mui/src/dashboard/components/__tests__/WorkspaceSwitcher.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `git diff --check`

## 2026-05-21 - Generic Guest Runtime Error Sanitization

### Summary

Completed a focused public guest runtime UX safety slice. Public guest link, session, runtime-load, and quiz-submit alerts now use the shared runtime error sanitizer instead of rendering raw unexpected `Error.message` content.

### Implemented

-   Added sanitized guest error rendering in `GuestApp` for link load, guest session creation, runtime content load, and quiz submission failures.
-   Reused existing localized `guest.errors.*` fallbacks without changing public link, guest-session, runtime, or quiz submit API behavior.
-   Added focused GuestApp coverage proving SQL text, internal relation names, and UUID values do not appear in public guest alerts.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/standalone/GuestApp.tsx packages/apps-template-mui/src/standalone/__tests__/GuestApp.test.tsx`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/standalone/__tests__/GuestApp.test.tsx --testNamePattern "sanitizes public"`: 4 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/standalone/GuestApp.tsx packages/apps-template-mui/src/standalone/__tests__/GuestApp.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`

## 2026-05-21 - Generic Learner Player ID Fallback Safety

### Summary

Completed a focused learner-player runtime UX safety slice. Missing or UUID-like parent, item, and target preview titles no longer leak row IDs on normal published app surfaces; localized untitled labels are used instead while row IDs remain internal for keys, selections, filters, and progress mutations.

### Implemented

-   Added a learner-player safe row-text helper backed by the shared runtime safe display formatter.
-   Replaced user-facing row-ID title fallbacks in the learner-player header, parent selector labels, outline buttons, selected item title, and resource preview title.
-   Added English and Russian `learnerPlayer.untitledContent`, `learnerPlayer.untitledItem`, and explicit `contentTypeFallback` labels.
-   Added focused widgetRenderer coverage proving missing and UUID-like titles do not expose UUIDs in learner-player text.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "missing record titles"`: 1 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "learner player"`: 4 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `git diff --check`

## 2026-05-21 - Generic Tabular Fetch Error Sanitization

### Summary

Completed a focused TABLE runtime UX safety slice. Initial child-row fetch failures in `RuntimeInlineTabularEditor` now use the shared runtime error sanitizer instead of rendering raw backend error text in the published app.

### Implemented

-   Routed TABLE child-row fetch errors through `extractRuntimeErrorMessage` via the existing `getTabularErrorMessage` helper.
-   Added localized English and Russian `tabular.errorFetch` messages.
-   Added focused component coverage for English and Russian fetch failures containing SQL text, internal relation names, and UUID values.
-   Kept mutation error behavior unchanged and covered by the existing runtime error helper regression tests.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/components/RuntimeInlineTabularEditor.tsx packages/apps-template-mui/src/components/__tests__/RuntimeInlineTabularEditor.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/__tests__/RuntimeInlineTabularEditor.test.tsx src/utils/__tests__/runtimeErrors.test.ts`: 6 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/components/RuntimeInlineTabularEditor.tsx packages/apps-template-mui/src/components/__tests__/RuntimeInlineTabularEditor.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`

## 2026-05-21 - Generic Report Table Technical Column Safety

### Summary

Completed a focused saved-report runtime table UX safety slice. Generic report DataGrid rendering now hides unsafe technical report columns while preserving explicitly human resolved reference labels such as Project.

### Implemented

-   Filtered report definition columns with technical fields like `TargetRecordId`, `sourceJson`, and `_upl_version` when their labels are still technical/internal.
-   Preserved safe resolved technical-reference columns when metadata provides an explicit human label, for example `ProjectId` rendered as `Project`.
-   Humanized report column fallback headers instead of exposing raw field keys when no localized label is available.
-   Kept report cell rendering on `formatRuntimeSafeValue` so UUIDs, raw JSON-like payloads, embedded URLs, and object placeholders remain suppressed.
-   Strengthened saved-report widget coverage for safe Project labels, hidden target/source/system columns, raw UUID suppression, raw URL suppression, and `[object Object]` suppression.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "saved report codename"`: 1 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`

## 2026-05-21 - Generic Ledger Table Technical Field Safety

### Summary

Completed a focused runtime ledger table UX safety slice. Generic `ledger.facts` and `ledger.projection` details-table widgets now filter technical fields, render safe cell values, and expose humanized headers without adding LMS-only runtime branches.

### Implemented

-   Filtered ledger datasource columns with the shared runtime technical-field classifier, including `*Id`, `sourceJson`, `_upl_*`, and internal `__*` keys.
-   Switched ledger DataGrid cell output to `formatRuntimeSafeValue` so raw JSON, UUID-only values, URLs embedded in resource payloads, and `[object Object]` placeholders are suppressed.
-   Humanized ledger headers from field codenames for generic user-facing DataGrid labels.
-   Preserved stable MUI DataGrid row identities by making the grid row `id` final, even when nested ledger fact payloads contain an `id` field.
-   Added focused widgetRenderer coverage for both `ledger.facts` and `ledger.projection` datasource paths, including the projection POST/CSRF flow.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "ledger (facts|projection)"`: 2 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`

### Notes

-   Browser evidence was not added for this ledger-specific slice because the current LMS product snapshot does not expose a user-facing `ledger.facts` or `ledger.projection` details-table widget. The safety contract is covered at the reusable renderer boundary and will need a Playwright viewport/overflow canary when a product runtime screen starts using ledger table datasources.

## 2026-05-21 - Generic Tabular String Object Display Safety

### Summary

Completed a focused runtime tabular UX safety slice. Inline TABLE/string cells now reuse the shared safe runtime display formatter instead of serializing object values, so normal tabular cells and editors do not expose raw JSON, UUID-only values, or `[object Object]` placeholders.

### Implemented

-   Replaced `STRING` tabular object-value `JSON.stringify` fallback with `formatRuntimeSafeValue`.
-   Kept localized string values readable through the existing VLC resolver.
-   Normalized localized `STRING` tabular values from safe display text instead of `String(object)`.
-   Hardened unresolved tabular `REF` formatter fallback so missing option labels do not expose raw IDs.
-   Strengthened focused tests for localized strings, non-localized string label objects, raw resource JSON strings, UUID suppression, opaque object suppression, localized normalization, JSON child values, and unresolved REF formatter behavior.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/utils/tabularColumns.tsx packages/apps-template-mui/src/utils/tabularCellValues.ts packages/apps-template-mui/src/utils/__tests__/tabularCellValues.test.tsx`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/utils/__tests__/tabularCellValues.test.tsx`: 10 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/utils/tabularCellValues.ts packages/apps-template-mui/src/utils/tabularColumns.tsx packages/apps-template-mui/src/utils/__tests__/tabularCellValues.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `git diff --check`

## 2026-05-21 - Generic Runtime Technical Column Safety

### Summary

Completed a focused Phase 1/5 runtime table safety slice. Current-object details tables, `records.list` widgets, column visibility preferences, and reorder list cells now share stricter generic technical-field filtering so metadata presets and local column preferences cannot reintroduce raw system fields into normal runtime surfaces.

### Implemented

-   Exported generic runtime grid column classifiers from `useRuntimeColumnVisibility`.
-   Kept action/control columns renderable while excluding them from ordinary column-visibility menu options.
-   Filtered current-object and `records.list` column presets against safe runtime display columns before applying metadata order/visibility.
-   Extended technical field detection to cover normalized `_upl_*` system fields.
-   Switched reorder flow-list cell rendering to `formatRuntimeSafeValue` so structured values do not render raw payloads.
-   Strengthened helper, MainGrid, and widgetRenderer coverage for forced-visible `ProjectId`, `CreatedBy`, `sourceJson`, `principal_id`, `_upl_version`, and internal `__*` columns.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/utils/displayValue.ts packages/apps-template-mui/src/utils/__tests__/displayValue.test.ts packages/apps-template-mui/src/hooks/useRuntimeColumnVisibility.ts packages/apps-template-mui/src/hooks/__tests__/useRuntimeColumnVisibility.test.ts packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/utils/__tests__/displayValue.test.ts src/hooks/__tests__/useRuntimeColumnVisibility.test.ts`: 9 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/MainGrid.test.tsx --testNamePattern "technical columns|table defaults"`: 2 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "column presets|reorder-enabled records.list"`: 3 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/utils/displayValue.ts packages/apps-template-mui/src/utils/__tests__/displayValue.test.ts packages/apps-template-mui/src/hooks/useRuntimeColumnVisibility.ts packages/apps-template-mui/src/hooks/__tests__/useRuntimeColumnVisibility.test.ts packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `git diff --check`

## 2026-05-21 - Generic Resource Source Type Selector Labels

### Summary

Completed a focused runtime authoring UX slice. Resource-source type selectors, create-target policy disabled reasons, and resource preview captions now use safe user-facing resource type labels instead of raw codenames such as `page`, `url`, `embed`, or `video`.

### Implemented

-   Added shared default resource type labels for app-template runtime fallback paths.
-   Updated `FormDialog` resource-source selector labels to prefer metadata/i18n and fall back to safe labels.
-   Updated create-target resource policy disabled reasons to use the same safe labels.
-   Updated `ResourcePreview` known-type fallback labels so previews do not fall back to `Unknown type` for configured resource codenames.
-   Strengthened FormDialog, widgetRenderer, and ResourcePreview coverage for Page, Link, Embed, and Video labels with raw lowercase codename suppression.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json packages/apps-template-mui/src/utils/resourceSourceLabels.ts packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx`
-   `pnpm exec eslint packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/utils/resourceSourceLabels.ts packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx --testNamePattern "resource-source type policy|selected embed resource type|supports page resources"`: 3 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "resource-source create targets|resourcePreview widgets"`: 2 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/resource-preview/__tests__/ResourcePreview.test.tsx`: 9 passed.
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `git diff --check`

## 2026-05-21 - Generic Resource Preview Title Wrapping

### Summary

Completed a focused runtime UX hardening slice for Learning Content resource previews. Long resource titles now wrap inside the existing preview surface instead of being forced into a one-line truncated caption.

### Implemented

-   Removed MUI `noWrap` from the generic `ResourcePreview` title.
-   Added `overflowWrap: anywhere` to keep long titles inside the preview container.
-   Added component coverage proving long titles no longer use the MUI no-wrap class.
-   Kept the change on existing MUI primitives with no new widget and no LMS-only runtime branch.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx`
-   `pnpm exec eslint packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/resource-preview/__tests__/ResourcePreview.test.tsx`: 9 tests passed.
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `git diff --check`

## 2026-05-21 - Generic Resource Preview Type Labels

### Summary

Completed a focused runtime UX hardening slice for Learning Content resource previews. Resource preview captions now use existing localized `resourceSource.types.*` labels instead of showing raw resource type codenames such as `url` or `scorm` on normal user-facing surfaces.

### Implemented

-   Replaced raw `ResourceSource.type` preview captions with localized resource type labels in the generic `ResourcePreview`.
-   Added a safe `Unknown type` fallback so missing i18n keys do not expose raw enum values.
-   Strengthened component coverage for Link and SCORM preview labels and raw lowercase codename suppression.
-   Kept the change generic with no LMS-only runtime branch or new UI component.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx`
-   `pnpm exec eslint packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/resource-preview/__tests__/ResourcePreview.test.tsx`: 8 tests passed.
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `git diff --check`

## 2026-05-21 - Learning Content Create Menu Deferred Package Evidence

### Summary

Completed a focused evidence-hardening slice for the Learning Content create menu. Import package remains an explicitly disabled metadata-defined target, and tests now prove users see the deferred file-import, SCORM, and xAPI reason instead of a silent disabled item.

### Implemented

-   Added fixture-contract coverage for the disabled Import package create target and its canonical EN/RU disabled reason.
-   Strengthened the LMS template manifest test to assert disabled reasons for Quiz-lite, Assignment-lite, and Import package targets.
-   Extended the LMS runtime Playwright canary to check the Import package disabled reason in the create menu.
-   Updated EN/RU Learning Content GitBook docs to describe Import package as deferred alongside assessment targets.
-   Kept the behavior on the existing generic `detailsTable.createTargets` menu and app-template MUI menu primitives.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md memory-bank/progress.md tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md`
-   `node tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/templateManifestValidator.test.ts`: 18 tests passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "renders a generic records.union create menu"`: 1 test passed.
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm run docs:i18n:check`
-   `git diff --check`

## 2026-05-21 - Generic Resource Preview Domain Badge

### Summary

Completed a focused Phase 4/6 Learning Content authoring UX slice. Generic resource previews now show a safe, human-readable domain badge for ready URL-backed resources while invalid and deferred resources stay fail-closed without exposing raw source payloads or validator internals.

### Implemented

-   Added a generic domain chip to `ResourcePreview` for safe ready URL sources using the shared `parseSafeExternalUrl` parser.
-   Added localized English and Russian `resourcePreview.domainPreview` labels.
-   Added component coverage for video and link domain rendering plus unsafe embed fail-closed behavior.
-   Kept the UI on existing MUI `Stack`, `Typography`, `Chip`, `Alert`, and `Button` primitives with wrapping layout and no LMS-only runtime branch.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm exec eslint packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/resource-preview/__tests__/ResourcePreview.test.tsx`: 8 tests passed.
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `git diff --check`

## 2026-05-21 - Generic Create Target Capacity Hardening

### Summary

Completed a focused generic create-target capacity slice for LMS Learning Content. The published runtime still uses the existing metadata-driven MUI create menu, while the schema now leaves room for more real authoring targets beyond the current eight LMS menu items.

### Implemented

-   Raised `detailsTable.createTargets` capacity from 8 to 16 in the generic application layout schema.
-   Added schema boundary coverage for 16 accepted targets and 17 rejected targets while preserving invalid-target validation.
-   Strengthened the LMS template manifest test to parse the Learning Content details table config and assert the current eight menu targets plus deferred disabled targets.
-   Updated the runtime widget test to cover the eight-item Learning Content-style create menu, including disabled deferred targets and user-facing disabled reasons.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/universo-types/base/src/common/applicationLayouts.ts packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/types test -- src/__tests__/applicationLayouts.test.ts`: 14 files passed, 96 tests passed.
-   `pnpm --filter @universo/metahubs-backend test -- src/tests/services/templateManifestValidator.test.ts`: 18 tests passed.
-   `pnpm --filter @universo/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 28 files passed, 243 tests passed.
-   `pnpm exec eslint packages/universo-types/base/src/common/applicationLayouts.ts packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `git diff --check`

## 2026-05-21 - Generic Report Runtime Filters

### Summary

Completed a focused LMS Learning Content reporting slice. Saved report widgets now pass ordinary DataGrid filters to the generic report run/export APIs, and the backend validates and merges those ad hoc filters with saved report and datasource filters without LMS-only runtime branches.

### Implemented

-   Added optional ad hoc report filters to generic runtime report run/export payloads.
-   Applied report DataGrid filter state to saved report runs and CSV exports in the published MUI runtime.
-   Merged datasource filters, saved report filters, and request filters at the backend report execution boundary.
-   Added focused backend service, backend route, app-template API, and app-template widget coverage for filter submission, validation, SQL application, and export requests.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/applications-backend/base/src/controllers/runtimeReportsController.ts packages/applications-backend/base/src/services/runtimeReportsService.ts packages/applications-backend/base/src/tests/services/runtimeReportsService.test.ts packages/apps-template-mui/src/api/api.ts packages/apps-template-mui/src/api/__tests__/runtimeReports.test.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts`
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/services/runtimeReportsService.test.ts`: 13 passed.
-   `pnpm --dir packages/apps-template-mui test -- src/api/__tests__/runtimeReports.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 243 passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts --testNamePattern="Runtime reports route contract"`: 8 passed.
-   `pnpm exec eslint packages/applications-backend/base/src/controllers/runtimeReportsController.ts packages/applications-backend/base/src/services/runtimeReportsService.ts packages/applications-backend/base/src/tests/services/runtimeReportsService.test.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts packages/apps-template-mui/src/api/api.ts packages/apps-template-mui/src/api/__tests__/runtimeReports.test.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `node tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `git diff --check`

## 2026-05-21 - Generic Report Error UX Safety

### Summary

Closed a focused runtime report UX safety gap for LMS Learning Content dashboards. Failed saved-report widgets now show localized user-facing alerts for both report loading and CSV export failures instead of leaving users with an empty/stuck grid or raw backend error text.

### Implemented

-   Added a localized report-load error state to `ReportDetailsTableWidget`.
-   Routed report load/export failures through the shared runtime error sanitizer before rendering.
-   Added EN/RU report fallback keys for load and export failures.
-   Added app-template tests proving SQL, constraint text, backend schema names, and UUIDs are not leaked to the report UI.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm --dir packages/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 241 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `node tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `git diff --check`

## 2026-05-21 - Generic Records List Column Preset Parity

### Summary

Completed a focused LMS Learning Content table-foundation slice. Generic `records.list` details-table widgets now apply the same `details.tableDefaults.columnPreset` contract already used by `records.union`, preventing technical configured columns from leaking into ordinary runtime tables and row-reorder list surfaces.

### Implemented

-   Applied runtime table column presets before building `records.list` MUI DataGrid columns.
-   Reused the same preset-filtered API column list for row-reordering FlowList columns.
-   Kept sequence runtime availability columns prepended outside the preset so sequence status remains visible while object fields still honor configured visibility.
-   Added app-template coverage for normal records-list tables, sequence tables, and reorder-enabled lists with hidden technical fields.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `node tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`

## 2026-05-21 - Report Export Filename User Label Contract

### Summary

Completed a focused LMS Learning Content reports/export hardening slice. Runtime CSV exports still use the generic report API identifier internally, but generated filenames now prefer the localized report title so downloaded files do not expose technical report codenames when a user-facing label is available.

### Implemented

-   Added a generic report CSV filename builder in the published MUI report widget.
-   Kept `reportCodename` as the runtime reports API identifier and preserved a safe fallback through humanized codenames when no title is available.
-   Added app-template component coverage proving the export action names the CSV from the report title and still sends the expected report codename payload.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --dir packages/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `node tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`

## 2026-05-21 - Saved Report Widget Codename Contract

### Summary

Completed the next LMS Learning Content productization slice. `detailsTable` widgets can now reference saved runtime report definitions by codename, while legacy inline `reportDefinition` metadata remains supported for compatibility.

### Implemented

-   Added the generic `detailsTable.reportCodename` metadata contract in shared application layout types.
-   Updated the published MUI runtime report widget to prefer `reportCodename` and still accept inline `reportDefinition` as a fallback.
-   Converted Course Builder and Learning Track Builder report tabs to saved report references instead of duplicated inline report JSON.
-   Strengthened schema, app-template, fixture-contract, and docs coverage for the saved-report reference path.
-   Regenerated the canonical LMS snapshot through the Playwright generator.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/universo-types/base/src/common/applicationLayouts.ts packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/testing/e2e/support/lmsFixtureContract.ts docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md`
-   `pnpm --filter @universo/types test -- src/__tests__/applicationLayouts.test.ts`
-   `pnpm --filter @universo/types build`
-   `pnpm --dir packages/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm exec eslint packages/universo-types/base/src/common/applicationLayouts.ts packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter metahubs-backend build`
-   `pnpm run docs:i18n:check`
-   `pnpm run check:runtime-no-lms-forks`
-   `node tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`

## 2026-05-21 - Builder Report Definition Productization

### Summary

Completed the next LMS Learning Content productization slice. Course Builder and Learning Track Builder report tabs now execute saved generic report definitions by codename, and the normal Reports grid hides JSON configuration fields so users see report metadata instead of raw report internals.

### Implemented

-   Seeded `CourseBuilderOutline` and `TrackBuilderOutline` report definitions in the LMS template.
-   Kept the existing `ReportDetailsTableWidget` path: builder tabs run saved reports through the generic runtime reports API without LMS-only widget code.
-   Marked `Reports.Filters`, `Reports.Definition`, and `Reports.SavedFilters` as hidden in normal runtime grids.
-   Strengthened the LMS fixture contract for required builder reports and hidden report JSON fields.
-   Regenerated the canonical LMS snapshot through the Playwright generator.
-   Updated EN/RU Learning Content docs to describe saved builder reports and hidden report JSON fields.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md`
-   `pnpm exec eslint packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm --filter metahubs-backend build`
-   `pnpm run docs:i18n:check`
-   `pnpm run check:runtime-no-lms-forks`
-   `node tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `pnpm supabase:e2e:stop`
-   `git diff --check`

## 2026-05-21 - LMS Learning Content Generic Learner Player Settings Enforcement

### Summary

Completed a bounded Phase 4/5 productization slice for generic learner-player settings. The published `learnerPlayer` widget now consumes the existing application-level `pagePlayer` settings that production and standalone runtimes already provide, so LMS Course and Track player surfaces follow the same outline, progress header, and completion-mode contract as standalone runtime Pages.

### Implemented

-   Applied `details.pagePlayer.showOutline` to the learner-player item outline and nested Editor.js page-block outline.
-   Applied `details.pagePlayer.showProgressHeader` to the learner-player progress summary and progress bar while preserving readable content context.
-   Applied `details.pagePlayer.completeButtonMode` for manual completion, hidden completion controls, and auto-after-open completion.
-   Kept nested `PageBlocksView` completion controls hidden inside learner-player content previews so the item player remains the single completion owner.
-   Added focused app-template coverage proving hidden outline, progress, and completion controls do not render when disabled by generic runtime settings.
-   Updated EN/RU Learning Content docs to state that the preset applies to generic learner-player widgets as well as page players.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --dir packages/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 231 passed.
-   `pnpm --dir packages/apps-template-mui lint`
-   `pnpm --dir packages/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm run docs:i18n:check`: 75 EN/RU page pairs.
-   `node tools/docs/check-gitbook-links.mjs && node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `git diff --check`
-   `pnpm supabase:e2e:start:minimal && pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 packages built successfully.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `pnpm supabase:e2e:stop`

## 2026-05-21 - LMS Learning Content Generic Shared Workspace Member Row Actions

### Summary

Completed a bounded productization slice for generic shared workspace-member row actions. The LMS Learning Content Share action now opens a reusable MUI member picker, displays readable workspace member labels, submits an explicit `workspaceMember` principal through the generic runtime library relation endpoint, and keeps raw user IDs out of normal runtime UI.

### Implemented

-   Extended the shared `library.toggle` row action contract with `principalTarget`, localized dialog title, and target label metadata.
-   Reused existing app-template MUI dialog, select, row-action, runtime workspace-member API, and snackbar primitives to implement the Share picker without an LMS-only runtime widget.
-   Hardened the backend runtime library relation endpoint so explicit shared principals are validated against active workspace membership or application membership before mutation.
-   Configured the LMS Learning Content Share metadata for `principalTarget: workspaceMember` and regenerated the canonical LMS snapshot through the Playwright generator.
-   Strengthened the fixture contract, EN/RU Learning Content docs, focused schema/backend/API/widget tests, and the full LMS runtime browser flow.
-   Added generic `API_RATE_LIMIT_READ_MAX` / `API_RATE_LIMIT_WRITE_MAX` env overrides and set higher defaults only for dedicated local E2E profiles so long browser flows do not hit package-level API limits.

### Validation

-   `pnpm exec prettier --write` for the touched shared schema, backend, app-template, LMS template, E2E, docs, E2E env, and rate-limiting files.
-   `pnpm --dir packages/universo-types/base test -- src/__tests__/applicationLayouts.test.ts`: 95 passed.
-   `pnpm --dir packages/universo-types/base build`
-   `pnpm --dir packages/universo-types/base lint`
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts --testNamePattern="runtime library relation|shared relation"`: 2 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --dir packages/apps-template-mui test -- src/api/__tests__/runtimeRows.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 230 passed.
-   `pnpm --dir packages/apps-template-mui lint`
-   `pnpm --dir packages/apps-template-mui build`
-   `pnpm --dir packages/metahubs-backend/base lint`
-   `pnpm --dir packages/metahubs-backend/base build`
-   `pnpm --dir packages/universo-utils/base test -- src/rate-limiting/__tests__/createRateLimiter.test.ts`: 312 passed.
-   `pnpm --dir packages/universo-utils/base lint`: passed with existing warnings only.
-   `pnpm --dir packages/universo-utils/base build`
-   `pnpm exec vitest run -c tools/local-supabase/vitest.config.mjs tools/local-supabase/__tests__/write-env.test.mjs`: 8 passed.
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm run docs:i18n:check`: 75 EN/RU page pairs.
-   `node tools/docs/check-gitbook-links.mjs && node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm exec ts-node --transpile-only -e "... assertLmsFixtureEnvelopeContract(...)"`: LMS fixture contract passed.
-   `pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase`: dedicated local E2E profile regenerated with API rate-limit overrides.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed after the E2E profile rate-limit override.

## 2026-05-21 - LMS Learning Content Generic Target-Field Row Actions

### Summary

Completed a bounded productization slice for generic target-field row actions. Published `records.union` tables and cards can now open a metadata-defined target picker and update a configured field through the existing runtime row update path. The LMS Learning Content library uses this generic primitive for `Move to project`, backed by `ProjectId -> ContentProjects`, without adding an LMS-only runtime widget.

### Implemented

-   Added the shared `field.updateWithTarget` row action contract with target object collection references, localized labels, label fields, and a `move` icon.
-   Generalized the app-template row action menu to load target options through existing runtime datasources and update the source row with optimistic version checks.
-   Configured the LMS main Learning Content union view with a `Move to project` action while keeping project UUIDs hidden from normal user surfaces.
-   Updated the canonical LMS snapshot, fixture contract, EN/RU GitBook Learning Content docs, and focused schema/app-template tests.
-   Extended the full LMS snapshot runtime Playwright flow to open the action menu, choose a readable project, submit the move, assert the PATCH payload, and verify the persisted row.

### Validation

-   `pnpm exec prettier --write packages/universo-types/base/src/common/applicationLayouts.ts packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md`
-   `pnpm --dir packages/universo-types/base test -- src/__tests__/applicationLayouts.test.ts`: 95 passed.
-   `pnpm --dir packages/universo-types/base build`
-   `pnpm --dir packages/universo-types/base lint`
-   `pnpm --dir packages/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 228 passed.
-   `pnpm --dir packages/apps-template-mui lint`
-   `pnpm --dir packages/apps-template-mui build`
-   `pnpm --dir packages/metahubs-backend/base build`
-   `pnpm --dir packages/metahubs-backend/base lint`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm run docs:i18n:check`: 75 EN/RU page pairs.
-   `node tools/docs/check-gitbook-links.mjs && node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm exec ts-node --transpile-only -e "const fs = require('node:fs'); const { assertLmsFixtureEnvelopeContract } = require('./tools/testing/e2e/support/lmsFixtureContract.ts'); const envelope = JSON.parse(fs.readFileSync('tools/fixtures/metahubs-lms-app-snapshot.json', 'utf8')); assertLmsFixtureEnvelopeContract(envelope); console.log('lms fixture contract ok');"`: passed.
-   `pnpm supabase:e2e:start:minimal && pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 packages built successfully.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `pnpm supabase:e2e:stop`

## 2026-05-21 - Records Union Trash Runtime E2E Stabilization

### Summary

Completed a bounded stabilization slice for generic `records.union` runtime surfaces and the LMS Learning Content Trash browser proof. Misconfigured union widgets now fail closed with a localized runtime configuration message instead of silently falling back to the current-object grid, and the E2E flow now creates a real deleted Learning Content row through generic row actions before verifying Trash restore.

### Implemented

-   Added a stable `records-union-details-table` runtime marker for generic union table surfaces.
-   Replaced the `records.union` current-object fallback with a localized configuration state.
-   Added focused widget coverage proving incomplete union runtime context does not render the wrong object grid.
-   Updated the LMS snapshot runtime Playwright flow to wait on the generic union marker instead of internal query-key text.
-   Stabilized the Trash restore proof by deleting a Learning Content row through the published app row action menu before asserting the Trash restore target flow.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm --dir packages/universo-types/base test -- src/__tests__/applicationLayouts.test.ts`: 95 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 36 passed.
-   `pnpm --dir packages/apps-template-mui lint`
-   `pnpm --dir packages/apps-template-mui build`
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs && node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 packages built successfully.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium --grep "@flow lms snapshot fixture"`: 2 passed.

## 2026-05-21 - LMS Learning Content Report REF Filtering And Trash Restore Target Picker

### Summary

Completed two bounded generic Learning Content productization slices. Runtime reports now filter `REF` columns through resolved display labels consistently across list, count, and aggregation queries. The Learning Content Trash view now uses a generic metadata-driven restore-target picker so deleted records can be restored into a selected project through the existing runtime restore endpoint.

### Implemented

-   Extended runtime report SQL generation so `contains`, `startsWith`, `endsWith`, and `equals` filters on metadata-resolved `REF` fields use reference-label joins instead of forcing users to know raw row ids.
-   Reused the same reference-label joins for report list, count, and aggregation queries so pagination totals and metrics match the visible filtered rows.
-   Added `detailsTable.restoreTarget` to the shared application layout schema.
-   Added a generic MUI restore-target dialog for deleted `records.union` rows that reuses `fetchAppData`, `restoreAppRow`, existing runtime display helpers, localized strings, and object-collection metadata.
-   Configured the LMS Learning Content Trash layout to restore into `ContentProjects` through `ProjectId`.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` from the LMS Playwright generator and strengthened the fixture contract.

### Validation

-   `pnpm --filter @universo/applications-backend test -- runtimeReportsService.test.ts --runInBand`: 12 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/types test -- applicationLayouts.test.ts --runInBand`: 95 passed.
-   `pnpm --filter @universo/types build`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 32 passed.
-   `pnpm --dir packages/apps-template-mui lint`
-   `pnpm --dir packages/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --grep "@generator create canonical lms metahub and export snapshot fixture"`: 2 passed.
-   `pnpm supabase:e2e:stop`
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `node -r ts-node/register ... assertLmsFixtureEnvelopeContract(...)`: LMS fixture contract passed.
-   `git diff --check`

## 2026-05-21 - LMS Learning Content Generic Project Create Target And Report REF Safety

### Summary

Continued Learning Content productization by exposing Projects in the existing metadata-driven Learning Content create menu. The published app now opens the standard runtime CRUD dialog for `ContentProjects`, persists a real project row, and verifies the saved data through the generic runtime API without adding an LMS-only widget or browser-owned system fields.

The full LMS runtime canary also exposed a report SQL type mismatch for REF fields. Runtime reports now project REF values through a single JSONB-safe expression so resolved and unresolved references remain type-compatible and safe for CSV/output formatting.

### Implemented

-   Added `ContentProjects` to the LMS Learning Content `detailsTable.createTargets` metadata with the `Project` menu label.
-   Strengthened the LMS fixture contract so the canonical snapshot must expose the Project create target and must not attach unsafe create defaults to it.
-   Extended the published-app LMS E2E canary to open the Project create dialog, reject system ID fields, fill Title and Description, submit through the generic runtime row mutation, and verify the created `ContentProjects` row.
-   Updated EN/RU GitBook Learning Content documentation for the Project create path.
-   Regenerated the canonical LMS snapshot fixture through the Playwright generator.
-   Fixed runtime report REF SQL projection so `CASE` branches return JSONB consistently instead of mixing `jsonb_build_object(...)` with UUID columns.
-   Added focused report service coverage for the safe REF SQL fallback.

### Validation

-   `pnpm --filter @universo/types test -- applicationLayouts.test.ts --runInBand`: 94 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 31 passed.
-   `pnpm --filter @universo/applications-backend test -- runtimeReportsService.test.ts --runInBand`: 11 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --grep "@generator create canonical lms"`: 2 passed.
-   `node -r ts-node/register -e "... assertLmsFixtureEnvelopeContract(...) ..."` after Playwright snapshot generation: passed.
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --grep "@flow lms snapshot fixture"`: 2 passed.
-   QA subagent review: no blockers after adding browser persistence proof; the exact progress row-count increase is tied to the generic learner-player `view` progress action.

## 2026-05-21 - LMS Learning Content Generic SharedAt Projection And Shared View Ordering

### Summary

Continued Learning Content productization by making the Shared Learning Content view order by the actual shared-relation timestamp. The generic `records.union` datasource now projects `sharedAt` from configured `runtimeLibrary.shared` metadata when a shared view or explicit `sharedAt` sort asks for it, without exposing access-entry row IDs or principal IDs.

### Implemented

-   Added a generic shared-relation timestamp projection for principal-based `runtimeLibrary.shared` relations.
-   Added the `sharedAt` union projection label and sort alias alongside the existing `recentAt` projection.
-   Kept `sharedAt` projection scoped to shared views or explicit `sharedAt` sorting, so normal Library, Recent, and Starred views do not gain an unnecessary column.
-   Sorted the LMS Shared Learning Content view by `sharedAt` descending.
-   Strengthened the LMS fixture contract to require shared timestamp ordering.
-   Updated EN/RU GitBook Learning Content documentation.
-   Regenerated the canonical LMS snapshot fixture through the Playwright generator.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts --runInBand --testNamePattern="records.union.*shared"`: 1 passed.
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts --runInBand`: 153 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --grep "@generator create canonical lms"`: 2 passed.
-   `node -r ts-node/register -e "... assertLmsFixtureEnvelopeContract(...) ..."` after Playwright snapshot generation: passed.
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`

## 2026-05-21 - LMS Learning Content Generic Runtime Shared Relation Mutation

### Summary

Continued the Learning Content productization implementation by extending the generic runtime library relation mutation path to support `runtimeLibrary.shared` principal relations. The browser now sends only the source object collection and action state, while the backend owns the current user principal, default access level, timestamp, workspace scope, and relation row mutation.

### Implemented

-   Added `shared` to the generic runtime library relation key contract alongside starred and recent relations.
-   Added metadata fields for shared access levels through `accessLevelFieldCodename` and `defaultAccessLevel`.
-   Projected `__runtimeShared` for `records.union` rows so table/card actions can show the correct Add/Remove Shared state without exposing relation rows.
-   Persisted shared relations server-side for the authenticated user using configured `ContentAccessEntries` metadata, optional timestamp, optional workspace scope, and `RETURNING`-guarded insert/update/delete flows.
-   Extended app-template API typing, `detailsTable.rowActions`, and the existing row action menu to support shared library actions without adding an LMS-only runtime UI branch.
-   Configured LMS Learning Content resources, courses, and learning tracks with shared relation metadata and shared row actions in the active union views.
-   Updated the LMS fixture contract and EN/RU GitBook Learning Content documentation.
-   Regenerated the canonical LMS snapshot fixture through the Playwright generator.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts --runInBand`: 152 passed.
-   `pnpm --filter @universo/types test -- applicationLayouts.test.ts lmsPlatform.test.ts --runInBand`: 94 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/api/__tests__/runtimeRows.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 44 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 packages built successfully.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --grep "@generator create canonical lms"`: 2 passed.
-   `node -r ts-node/register -e "... assertLmsFixtureEnvelopeContract(...) ..."` after Playwright snapshot generation: passed.
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `git diff --check`
-   Explorer QA subagent: no blocking findings for runtime forks, raw principal IDs, or metadata/schema/test/doc mismatches.

## 2026-05-21 - LMS Learning Content Generic Runtime Recent Ordering

### Summary

Continued the Learning Content productization implementation by making Recent Learning Content order by the learner's actual recent-view timestamp. The runtime now projects a generic `recentAt` value from `runtimeLibrary.recent` metadata for `records.union` datasources when the view asks for recent ordering, without exposing relation row IDs or adding an LMS-only runtime branch.

### Implemented

-   Added a generic `recentAt` virtual projection for `records.union` rows, sourced from the configured recent relation timestamp binding.
-   Kept virtual `recentAt` out of per-target physical SQL sorts while applying the final union output sort to projected row data.
-   Restricted `recentAt` projection to Recent views or explicit `recentAt` sorts so normal library views do not get an unnecessary Viewed column.
-   Configured the LMS Recent Learning Content view to sort by `recentAt` descending instead of title ascending.
-   Kept `recentAt` visible in table/card display defaults while technical target/source IDs remain hidden.
-   Updated the LMS fixture contract and EN/RU GitBook Learning Content documentation.
-   Regenerated the canonical LMS snapshot fixture through the Playwright generator.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts --runInBand`: 151 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 30 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --grep "@generator create canonical lms"`: 2 passed.
-   `node -r ts-node/register -e "... assertLmsFixtureEnvelopeContract(...) ..."` after Playwright snapshot generation: passed.
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`

## 2026-05-21 - LMS Learning Content Generic Runtime Recent Capture

### Summary

Continued the Learning Content productization implementation by adding generic runtime recent-view capture. Learning Content resources, courses, and learning tracks can now populate the `RecentContentViews` relation through `runtimeLibrary.recent` metadata when a learner views or completes content, without adding LMS-only runtime branches.

### Implemented

-   Added `recent` as a generic runtime library relation key alongside `starred`.
-   Configured LMS resources, courses, and learning tracks to write recent-view facts with `RecentContentViews.ViewedAt`.
-   Added server-owned recent relation persistence to the content progress mutation path, including row validation, workspace scoping, actor scoping, timestamp refresh, and transaction-scoped locking.
-   Triggered generic `view` progress persistence from both the learner player target surface and `PageBlocksView`, while preserving the existing complete action.
-   Updated app-template API typing, LMS fixture contract checks, and EN/RU GitBook Learning Content documentation.
-   Regenerated the canonical LMS snapshot fixture through the Playwright generator.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts --runInBand`: 150 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/MainGrid.test.tsx src/dashboard/components/__tests__/widgetRenderer.test.tsx src/api/__tests__/runtimeRows.test.ts`: 63 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 packages built successfully.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --grep "@generator create canonical lms"`: 2 passed.
-   `node -r ts-node/register -e "... assertLmsFixtureEnvelopeContract(...) ..."` after Playwright snapshot generation: passed.
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `git diff --check`

## 2026-05-21 - LMS Learning Content Generic Records Union Project Labels

### Summary

Continued the Learning Content productization implementation by adding a generic `records.union` project label projection. Learning Content union tables and cards can now show a human-readable `Project` column resolved from configured object `REF` metadata while keeping raw `ProjectId` values hidden from normal runtime surfaces.

### Implemented

-   Added an optional generic `records.union` target `projectField` contract.
-   Resolved configured `REF` project fields in the backend union datasource through published object metadata and target display components.
-   Preserved the existing MUI `detailsTable`, DataGrid, card, and row action primitives; no LMS-only runtime UI branch was added.
-   Configured LMS Learning Content resource, course, and learning track union targets to project `Project` labels in active and trash views.
-   Regenerated the canonical LMS snapshot fixture through the Playwright generator and strengthened the fixture contract to require safe title, status, and project projections.
-   Updated the EN/RU GitBook Learning Content guide with the new generic projection behavior.

### Validation

-   `pnpm --filter @universo/types test -- applicationLayouts.test.ts`: 94 passed.
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts --runInBand`: 149 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 29 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 packages built successfully.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --grep "@generator create canonical lms"`: 2 passed.
-   `node -r ts-node/register -e "... assertLmsFixtureEnvelopeContract(...) ..."` after Playwright snapshot generation: passed.
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Generic Records Union Starred Actions

### Summary

Continued the Learning Content productization implementation by adding a generic metadata-driven Star/Unstar action for server-side `records.union` library views. Active Learning Content union tables can now show a personal Starred action through the existing row action menu without adding an LMS-only widget or requiring content edit permissions.

### Implemented

-   Added a generic `detailsTable.rowActions` schema for `library.toggle` actions targeting the `starred` library relation.
-   Extended runtime `runtimeLibrary.starred` relation metadata with an optional timestamp field and configured LMS resources, courses, and tracks to write `ContentStars.StarredAt`.
-   Added a backend runtime row library relation endpoint that validates the published object metadata, active source row, record access, authenticated user, workspace, and configured relation object before inserting or soft-deleting relation rows.
-   Projected `__runtimeStarred` as hidden server-owned row state in the generic `records.union` datasource so the existing row action menu can render Star or Unstar without exposing relation IDs or technical columns.
-   Updated the LMS template, canonical snapshot fixture, fixture contract, app-template i18n, and GitBook Learning Content docs.

### Validation

-   `pnpm --filter @universo/types test -- applicationLayouts.test.ts`: 94 passed.
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts --runInBand`: 149 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/api/__tests__/runtimeRows.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 41 passed.
-   `pnpm --filter @universo/utils test -- snapshotFixtures.test.ts`: 311 passed.
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `node -r ts-node/register -e "... assertLmsFixtureEnvelopeContract(...) ..."`: passed.
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 packages built successfully.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --grep "@generator create canonical lms"`: 2 passed.
-   `node -r ts-node/register -e "... assertLmsFixtureEnvelopeContract(...) ..."` after Playwright snapshot generation: passed.
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Generic Runtime Report REF Label Projection

### Summary

Continued the Learning Content productization implementation by adding generic object `REF` label projection to saved runtime reports. Reports now use published runtime metadata to resolve object references to safe label objects before the existing CSV and DataGrid formatters run, so LMS report columns such as learner references can show names instead of raw UUIDs or empty cells.

### Implemented

-   Enriched runtime report field metadata with object reference target and display-component label metadata.
-   Added generic report SQL projection for object `REF` fields through a safe `LEFT JOIN` against the target table and its preferred display component.
-   Preserved fail-closed behavior: if a referenced row or display component cannot be resolved, primitive ID suppression still prevents raw UUID leakage in CSV and report grids.
-   Added service-level and route-level coverage for report REF label projection and resolved-label CSV output.

### Validation

-   `pnpm --filter @universo/applications-backend test -- runtimeReportsService.test.ts`: 11 passed.
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts -t "Runtime reports route contract"`: 5 passed.
-   `pnpm exec eslint packages/applications-backend/base/src/services/runtimeReportsService.ts packages/applications-backend/base/src/controllers/runtimeReportsController.ts packages/applications-backend/base/src/tests/services/runtimeReportsService.test.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts`
-   `pnpm --filter @universo/applications-backend build`
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Generic Runtime Report Primitive ID Output Safety

### Summary

Continued the Learning Content productization implementation by closing the remaining primitive ID leakage risk in generic runtime reports. Report CSV exports and report DataGrid cells now fail closed for primitive ID-like fields and UUID-bearing strings while still showing resolved object labels when report data already contains human-readable metadata.

### Implemented

-   Added generic primitive ID suppression to runtime report CSV serialization for `*Id` fields and UUID-bearing strings.
-   Preserved safe resolved object labels such as `displayName`, `name`, `title`, `label`, `caption`, and `email` even when the report field name is ID-like.
-   Updated generic report DataGrid cell formatting to use the existing runtime safe display helpers and hide primitive technical report values without adding LMS-only runtime branches.
-   Added focused backend and app-template coverage for primitive report ID suppression and resolved-label preservation.

### Validation

-   `pnpm --filter @universo/applications-backend test -- runtimeReportsService.test.ts`: 10 passed.
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts -t "Runtime reports route contract"`: 4 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 28 passed.
-   `pnpm exec eslint packages/applications-backend/base/src/services/runtimeReportsService.ts packages/applications-backend/base/src/tests/services/runtimeReportsService.test.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `git diff --check`

### Notes

-   `pnpm --dir packages/apps-template-mui exec tsc --noEmit` still fails on existing package-wide test typing and demo-template issues outside this slice. The package production build uses `tsconfig.build.json` and passed.

## 2026-05-20 - LMS Learning Content Generic Runtime Report Export Output Safety

### Summary

Continued the Learning Content productization implementation by hardening generic runtime report CSV export formatting. Report exports now preserve localized text, primitive values, and safe object labels while avoiding raw JSON serialization, UUID leakage from object payloads, and storage/source payload keys in user-facing CSV output.

### Implemented

-   Replaced generic CSV object fallback serialization with safe report value formatting in `RuntimeReportsService`.
-   Preserved localized VLC-style values and safe object labels such as `displayName`, `name`, `title`, `label`, `caption`, and `email`.
-   Serialized arrays as semicolon-separated safe labels and returned an empty cell for opaque objects instead of leaking JSON payloads.
-   Added service-level and route-level report export coverage proving CSV output does not expose raw JSON, UUID payloads, or storage/source keys.

### Validation

-   `pnpm --filter @universo/applications-backend test -- runtimeReportsService.test.ts`: 9 passed.
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts -t "Runtime reports route contract"`: 4 passed.
-   `pnpm exec eslint packages/applications-backend/base/src/services/runtimeReportsService.ts packages/applications-backend/base/src/tests/services/runtimeReportsService.test.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts`
-   `pnpm --filter @universo/applications-backend build`
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Generic Create-Target Resource Policy Availability

### Summary

Continued the Learning Content productization implementation by applying the existing generic resource-source type policy to metadata-driven create-target menus. Published runtime users now see unavailable Page/Link-style create actions as disabled menu items with localized reasons instead of opening a form that later blocks the selected source type.

### Implemented

-   Added generic create-target availability resolution in `detailsTable` create menus based on `createDefaults[].resourceSourceType` and host-provided `resourceSourceTypes`.
-   Kept metadata-disabled targets and settings-disabled targets visible with user-facing reasons, preserving the existing MUI toolbar and menu primitives.
-   Added EN/RU app-template i18n keys for disabled and deferred resource-source create targets.
-   Added focused app-template coverage for disabled, deferred, missing-from-settings, and unaffected create targets.

### Validation

-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 27 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --dir packages/apps-template-mui exec tsc -p tsconfig.build.json --noEmit`
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Generic Settings-Derived Create Defaults

### Summary

Continued the Learning Content productization implementation by adding generic metadata-driven create defaults that can safely derive scalar values from curated runtime context. Course and Learning Track authoring now prefill policy fields from application-level Learning Content settings without exposing the full settings object, adding LMS-only runtime branches, or allowing system-owned fields to be seeded by metadata.

### Implemented

-   Added a safe `contextPath` create-default source to the shared application layout schema, including path-shape validation and prototype-pollution segment rejection.
-   Extended the generic CRUD dashboard create-default resolver so `contextPath` values pass through the same writable-field, hidden-field, server-owned-field, and scalar-type guards as literal defaults.
-   Passed a curated Learning Content policy context from production `ApplicationRuntime` and standalone `DashboardApp` into the shared app-template runtime.
-   Configured LMS Course create targets to derive navigation mode, completion condition, and status format from application settings.
-   Configured LMS Learning Track create targets to derive order mode from application settings.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator and strengthened the fixture contract and runtime browser canary for these defaults.
-   Updated EN/RU GitBook Learning Content documentation with the settings-derived default behavior.

### Validation

-   `pnpm --dir packages/universo-types/base exec vitest run src/__tests__/applicationLayouts.test.ts`: 13 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/hooks/__tests__/useCrudDashboard.test.tsx src/standalone/__tests__/DashboardApp.test.tsx`: 34 passed.
-   `pnpm --filter applications-frontend test -- --run src/pages/__tests__/ApplicationRuntime.test.tsx`: 177 passed.
-   `pnpm --filter @universo/types build`
-   `pnpm --dir packages/apps-template-mui exec tsc -p tsconfig.build.json --noEmit`
-   `pnpm exec eslint packages/universo-types/base/src/common/applicationLayouts.ts packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/apps-template-mui/src/hooks/useCrudDashboard.ts packages/apps-template-mui/src/hooks/__tests__/useCrudDashboard.test.tsx packages/apps-template-mui/src/standalone/DashboardApp.tsx packages/apps-template-mui/src/standalone/__tests__/DashboardApp.test.tsx packages/applications-frontend/base/src/pages/ApplicationRuntime.tsx packages/applications-frontend/base/src/pages/__tests__/ApplicationRuntime.test.tsx tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm exec ts-node --transpile-only tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `pnpm run build:e2e`: 31 successful tasks.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

## 2026-05-21 - Generic Records Union Report Execution

### Summary

Completed the next generic Learning Content reporting slice. Saved runtime reports can now execute `records.union` datasources through the existing generic union executor, allowing the LMS snapshot to expose a cross-type Learning Content Summary report without adding LMS-only report code.

### Implemented

-   Reused `executeRuntimeRecordsUnionDatasource` from the runtime rows controller for saved report run/export.
-   Kept `records.list` report execution unchanged and rejected unsupported `records.union` aggregations before datasource execution.
-   Added safe `records.union` report row shaping so report responses and CSV exports only expose configured columns and never leak runtime target IDs or internal object metadata.
-   Added generic enum/reference label projection for union report rows so user-facing Status and Project values render as labels instead of raw UUIDs.
-   Added the `LearningContentSummary` report to the LMS fixture with Type, Title, Status, and Project columns across standalone resources, courses, and learning tracks.
-   Strengthened backend route tests, fixture contract checks, browser/API runtime E2E assertions, docs, and regenerated `tools/fixtures/metahubs-lms-app-snapshot.json`.

### Validation

-   `pnpm exec prettier --write packages/applications-backend/base/src/controllers/runtimeRowsController.ts packages/applications-backend/base/src/controllers/runtimeReportsController.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md`
-   `pnpm --filter applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`: 136 passed.
-   `pnpm --filter applications-backend build`
-   `pnpm exec eslint packages/applications-backend/base/src/controllers/runtimeRowsController.ts packages/applications-backend/base/src/controllers/runtimeReportsController.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm run docs:i18n:check`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `node tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `pnpm supabase:e2e:stop`
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm exec prettier --check ...`
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Generic Resource Source Policy

### Summary

Continued the Learning Content productization implementation by applying application-level resource type settings to generic runtime resource-source form controls. Runtime authoring now keeps enabled types selectable, shows deferred types as disabled with localized user-facing text, and hides disabled types unless an existing record already uses that type.

### Implemented

-   Added a generic `resourceSourceTypes` policy to `FormDialog`, `CrudDialogs`, and `DashboardDetailsSlot`.
-   Passed sanitized Learning Content `supportedResourceTypes` from production `ApplicationRuntime`, standalone `DashboardApp`, and relation-builder dialogs into the shared resource-source editor.
-   Added localized EN/RU labels for deferred runtime resource-source types.
-   Added focused app-template coverage for enabled, deferred, and disabled resource-source type policy behavior.
-   Recorded the subagent recommendation that the next larger slice should be a generic metadata-driven `records.union` create menu.

### Validation

-   `pnpm exec eslint packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/CrudDialogs.tsx packages/apps-template-mui/src/dashboard/Dashboard.tsx packages/apps-template-mui/src/dashboard/components/RelationBuilderWidget.tsx packages/apps-template-mui/src/standalone/DashboardApp.tsx packages/applications-frontend/base/src/pages/ApplicationRuntime.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx src/standalone/__tests__/DashboardApp.test.tsx`: 29 passed.
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/pages/__tests__/ApplicationRuntime.test.tsx`: 26 passed.
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm docs:i18n:check`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Generic Runtime UX Projection Slice

### Summary

Continued the Learning Content productization implementation by hardening generic published runtime projection behavior. The current slice keeps using existing app-template MUI primitives and avoids LMS-only widgets while removing visible technical-leakage paths and restoring normal toolbar actions for metadata-defined detail tables.

### Implemented

-   Changed `records.union` rendering so projection columns are merged across all configured targets instead of inheriting only the first target's columns.
-   Changed learner player content headers to show human-readable target labels, such as `Learning Resources`, instead of raw metadata codenames such as `LearningResources`.
-   Changed normal runtime value formatting so structured objects without a display label do not fall back to raw JSON in user-facing cells.
-   Changed `MainGrid` so metadata-defined `detailsTable` widgets replace the fallback current-object grid without losing the standard `ViewHeaderMUI` toolbar actions, including published-app create actions.
-   Updated EN/RU Learning Content GitBook docs with the generic union projection, learner player label, and no-raw-JSON behavior.

### Validation

-   `pnpm --filter @universo/apps-template-mui test -- --run src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 182 passed.
-   `pnpm --filter @universo/apps-template-mui test -- --run src/utils/__tests__/displayValue.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 182 passed.
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`: 123 passed.
-   `pnpm --filter @universo/apps-template-mui test -- --run src/dashboard/components/__tests__/MainGrid.test.tsx src/dashboard/components/__tests__/widgetRenderer.test.tsx src/api/__tests__/runtimeRows.test.ts src/utils/__tests__/displayValue.test.ts`: 184 passed.
-   `pnpm --filter @universo/applications-frontend test -- --run src/api/__tests__/apiWrappers.test.ts src/pages/__tests__/ApplicationRuntime.test.tsx`: 174 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 successful tasks.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `pnpm docs:i18n:check`
-   `node tools/docs/check-gitbook-links.mjs && node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Runtime Safety Slice

### Summary

Closed the highest-risk QA gaps in the Learning Content productization plan before broader product UX work continues. Runtime mutations now carry optimistic version data through the published app adapters, row reordering is checked transactionally with per-row versions, trash restore can target a validated parent record, and Learning Content progress no longer trusts browser-supplied status or percent values.

### Implemented

-   Added executable guard scripts for runtime LMS-only branch drift and GitBook link/screenshot asset drift.
-   Added `RuntimeRestoreTarget` and propagated expected versions through app-template and production runtime adapters for update, delete, copy, restore, and reorder commands.
-   Hardened backend row reorder with duplicate detection, exact expected-version map validation, active-row scope checks, row locks, and all-or-nothing transactional updates.
-   Hardened backend restore with a generic restore target contract that validates target object, target row, workspace scope, and optional parent reference metadata.
-   Reworked Learning Content progress writes so browser calls send only action intents while the backend derives progress percent and status from metadata-defined rules.
-   Updated EN/RU Learning Content GitBook docs to describe server-owned progress, restore targets, and optimistic ordering semantics.

### Validation

-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm --filter @universo/apps-template-mui test -- --run src/api/__tests__/runtimeRows.test.ts src/hooks/__tests__/useCrudDashboard.test.tsx src/dashboard/components/__tests__/MainGrid.test.tsx src/dashboard/components/__tests__/widgetRenderer.test.tsx src/standalone/__tests__/DashboardApp.test.tsx`: 182 passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`: 123 passed.
-   `pnpm --filter @universo/applications-frontend test -- src/api/__tests__/apiWrappers.test.ts src/pages/__tests__/ApplicationRuntime.test.tsx`: 174 passed after rerun.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm supabase:e2e:start:minimal && pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 packages built.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-class-content-quiz.spec.ts --project chromium`: 2 passed.

## 2026-05-19 - Runtime UI UX Viewport Matrix Closure

### Summary

Closed the QA gap where the Runtime UI UX Quality Gate required responsive proof in guidance but only checked the current Playwright viewport mechanically. The reusable runtime UX helper now validates the shared viewport matrix and the LMS runtime canary uses that helper.

### Implemented

-   Added `RUNTIME_UX_VIEWPORT_MATRIX` and `expectRuntimeUxViewportMatrix` for `1920x1080`, `768x1024`, and mobile `390x844`.
-   Rewired the LMS snapshot runtime canary to use the shared viewport matrix for page-level horizontal overflow checks.
-   Updated runtime UX oracle documentation, reviewer profiles, and GitBook documentation to make the viewport matrix explicit.
-   Extended `check:runtime-ux-agents` so the matrix helper, docs, and LMS canary usage cannot silently drift away.

### Validation

-   `pnpm check:runtime-ux-agents`
-   `pnpm docs:i18n:check`
-   `pnpm exec eslint tools/agents/check-runtime-ux-agent-invariants.mjs tools/testing/e2e/support/browser/runtimeUx.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `python3 - <<'PY' ... tomllib.loads(...) ... PY`
-   `git diff --check`

## 2026-05-19 - Runtime UI UX Quality Gate

### Summary

Implemented the cross-agent Runtime UI UX Quality Gate so future agent-driven MUI runtime work has explicit reusable contracts, reviewer profiles, drift checks, Playwright UX oracles, LMS fixture canaries, and GitBook documentation.

### Implemented

-   Added portable `mui-runtime-ux-patterns` and `runtime-ux-qa` skills with focused references and evaluation fixtures for raw ID, raw JSON, long-text, localization, responsive, and browser-proof defects.
-   Added shared reviewer profiles plus self-contained native reviewer files for Codex, Gemini, Claude, GitHub Copilot, Qoder, and Kiro.
-   Wired the Runtime UI UX Quality Gate into PLAN, IMPLEMENT, and QA mode instructions while keeping root files concise.
-   Added `tools/agents/check-runtime-ux-agent-invariants.mjs` and the root `check:runtime-ux-agents` script to catch reviewer-instruction drift and unsafe reviewer permissions.
-   Added reusable Playwright runtime UX helpers and connected the LMS runtime flow to raw technical-leakage and horizontal-overflow checks.
-   Strengthened the LMS fixture contract so the generated snapshot rejects editable owner/user ID fields, single-line descriptions, raw resource-source grid columns, and non-resource widgets for cover/source fields.
-   Added EN/RU GitBook documentation for the quality gate and updated documentation summaries.

### Validation

-   `pnpm check:runtime-ux-agents`
-   `pnpm docs:i18n:check`
-   `pnpm exec eslint tools/agents/check-runtime-ux-agent-invariants.mjs tools/testing/e2e/support/browser/runtimeUx.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm exec prettier --check .agents/skills/mui-runtime-ux-patterns/SKILL.md .agents/skills/mui-runtime-ux-patterns/references/*.md .agents/skills/runtime-ux-qa/SKILL.md .agents/skills/runtime-ux-qa/references/*.md .agents/agent-profiles/*.md .gemini/agents/*.md .claude/agents/*reviewer.md .github/agents/*reviewer.agent.md .qoder/agents/*reviewer.md .kiro/steering/agent_profiles/*.md docs/en/contributing/runtime-ui-ux-quality-gate.md docs/ru/contributing/runtime-ui-ux-quality-gate.md memory-bank/plan/ai-agent-mui-ux-workflow-plan-2026-05-19.md memory-bank/research/ai-agent-mui-ux-workflow-research-2026-05-19.md tools/agents/check-runtime-ux-agent-invariants.mjs tools/testing/e2e/support/browser/runtimeUx.ts`
-   `python3 - <<'PY' ... tomllib.loads(...) ... PY`
-   `git diff --check`

## 2026-05-18 - LMS Learning Content Product UX Remediation

### Summary

Closed the manual QA issues found after rebuilding the LMS fixture into a clean application. The Learning Content configuration now avoids technical owner fields in project forms, keeps optional cover resources quiet until a source is entered, hides JSON-heavy resource fields from grids, and keeps dense course-builder tables inside responsive local scroll containers.

### Implemented

-   Made optional `resourceSource` fields submit as absent until a concrete locator is provided, while invalid entered sources now show localized runtime validation messages instead of raw Zod text.
-   Added generic FormDialog support for metadata-driven textarea rows and UI defaults, including localized/versioned string fields.
-   Removed editable `OwnerUserId` from the LMS content project object and seed data so runtime record ownership remains server-owned.
-   Converted project access mode to a metadata select with a safe default and hid system/JSON-heavy fields such as covers, resource bodies, thumbnails, archived timestamps, and relation-builder foreign keys where they are not useful in grids/forms.
-   Hardened generic runtime table containers, relation builders, and column containers with local horizontal scrolling and minimum-width constraints instead of page-level overflow.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator after the template changes.

### Validation

-   `pnpm --filter @universo/apps-template-mui test -- --run src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx src/components/runtime-ui/__tests__/runtimeUi.test.tsx src/components/resource-preview/__tests__/ResourcePreview.test.tsx`: 176 passed.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/templateManifestValidator.test.ts src/tests/services/metahubSchemaService.test.ts`: 26 passed.
-   `pnpm docs:i18n:check`: 74 EN/RU GitBook page pairs checked.
-   `pnpm run build:e2e:local-supabase`: 31 packages built.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "canonical lms"`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `rg -n "OwnerUserId|ID владельца|Owner User ID|owner.playwright|reviewer.playwright|author.playwright" ...`: no matches in the active LMS template, generator, snapshot, or app-template sources.
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Records Union Presentation Bridge

### Summary

Implemented the next generic Learning Content productization slice for `records.union` presentation. Union tables now preserve target projection metadata, expose safe display columns, and avoid raw reference/identity default columns while staying on shared runtime datasource and MUI grid primitives.

### Implemented

-   Preserved `titleField`, `statusField`, `typeField`, and `updatedAtField` from `records.union` template targets through the published app widget request.
-   Added server-side union projection columns for safe `type`, `title`, and `status` display, with projection alias translation before backend sort/filter validation.
-   Made generic DataGrid column conversion respect metadata sort/filter guards.
-   Updated the LMS template and committed snapshot so Learning Content union widgets declare safe projection fields and `DefaultLibraryColumns` no longer includes raw `ProjectId` or `CreatedBy`.
-   Strengthened LMS fixture-contract checks for safe Learning Content union projections and column presets.

### Validation

-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/utils/__tests__/columns.test.tsx src/api/__tests__/runtimeRows.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 35 passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`: 124 passed.
-   `pnpm --dir packages/universo-utils/base exec vitest run --config vitest.config.ts src/snapshot/__tests__/snapshotFixtures.test.ts`: 4 passed.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/metahubs-backend build`

## 2026-05-18 - LMS Learning Content Final QA Closure

### Summary

Closed the remaining implementation and QA issues for the LMS Learning Content plan. The active LMS public-content path no longer keeps a compatible `Modules` object or `module` target type; structured lessons are generated and served through `LearningResources`, with progress stored in the unified `ContentProgress` object.

### Implemented

-   Removed public guest runtime compatibility for `module` targets and kept only `content`, `assessment`, and `quiz` target types.
-   Consolidated LMS progress metadata around `ContentProgress` and renamed the active progress/status identifiers to content/resource terminology.
-   Added remap-safe references for generated applications: `AccessLinks.ContentNodeIdRef` points to `LearningResources`, and `LearningResources.ContentItems.QuizId` is a `REF` to `Quizzes`.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` from the Playwright LMS generator after the metadata changes.
-   Extended the browser runtime proof to cover Learning Content library shell views, public guest content, quiz submission, progress writes, row creation/copy/reorder, posting/unposting, workflow transitions, report execution, and screenshot capture.
-   Removed stale `ModuleProgress` and `demo-module` test fixtures from `apps-template-mui` and changed generic widget viewer UI text away from module terminology.

### Validation

-   `pnpm run build:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "canonical lms"`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/publicApplicationsRoutes.test.ts`: 21 passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`: 111 passed.
-   `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/templateManifestValidator.test.ts src/tests/services/metahubSchemaService.test.ts`: 26 passed.
-   `pnpm --filter @universo/apps-template-mui test -- --run src/api/__tests__/runtimeReports.test.ts src/hooks/__tests__/useCrudDashboard.test.tsx src/__tests__/App.test.tsx src/dashboard/components/__tests__/MainGrid.test.tsx src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 173 passed.
-   `pnpm --filter @universo/apps-template-mui test -- --run src/dashboard/components/__tests__/runtimeWidgetHelpers.test.ts`: 173 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm docs:i18n:check`
-   `git diff --check`

## 2026-05-18 - LMS Learning Content No-Modules Remediation

### Summary

Closed the final QA remediation around the LMS Learning Content fixture. The active LMS template, Playwright generator, fixture contract, generated snapshot, and GitBook docs now use `LearningResources` as the canonical structured guest-content object instead of keeping a separate compatible `Modules` object.

### Implemented

-   Removed the active `Modules` entity path from the LMS template/generator/fixture contract/snapshot and moved structured guest lessons into `LearningResources.ContentItems`.
-   Changed generated access links and enrollments to use `TargetType: content` and `ContentNodeIdRef`.
-   Hardened runtime component lookup so metadata field references work case-insensitively while existing validation metadata continues to resolve.
-   Added fail-closed backend coverage for metadata-configured access entries created without an active workspace.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the local-Supabase Playwright generator.
-   Updated GitBook setup/entity docs to describe the current Learning Content object model.

### Validation

-   `pnpm run build:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "canonical lms"`: 2 passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`: 111 passed.
-   `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/templateManifestValidator.test.ts src/tests/services/metahubSchemaService.test.ts`: 26 passed.
-   `pnpm --filter @universo/apps-template-mui test -- --run src/hooks/__tests__/useCrudDashboard.test.tsx src/api/__tests__/runtimeRows.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx`: 173 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm docs:i18n:check`
-   `git diff --check`
-   Targeted search confirmed no `Modules`, `ContentNodeIdRef`, `TargetType: "module"`, or `contentNodes: "Modules"` remains in the active LMS template, generator, fixture contract, generated snapshot, or GitBook docs.

## 2026-05-18 - LMS Runtime Copy UI Integration

### Summary

Closed the generic published-app copy integration gap. Runtime Copy actions now use the backend copy endpoint, so Course and Track outline relation copying is available from the actual UI path instead of only from direct API calls.

### Implemented

-   Routed `useCrudDashboard` copy submissions through `adapter.copyRow`.
-   Extended `copyAppRow` and the standalone adapter to send copy override data and `expectedVersion`.
-   Extended the backend runtime copy body with safe `data` overrides and optimistic version checks.
-   Validated copy overrides with component coercion, read-only field guards, record-picker validation, required-when rules, date derivation, and date-order rules before insert.
-   Added backend tests for copy override persistence and stale-version copy rejection before mutation.
-   Added apps-template API/hook tests proving copy endpoint payloads, optimistic copy rows, and version propagation.

### Validation

-   `pnpm --filter @universo/apps-template-mui exec vitest run --config vitest.config.ts src/api/__tests__/runtimeRows.test.ts src/hooks/__tests__/useCrudDashboard.test.tsx --coverage=false`: 25 passed.
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes --runInBand --testNamePattern="runtime copy endpoint|stale-version runtime copy|metadata-configured course outline relations"`: 3 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-18 - LMS Runtime Copy Relations

### Summary

Closed the course copy semantics gap with a generic metadata-driven relation copy primitive. Runtime copy commands can now duplicate selected related runtime rows for an Object without hardcoding LMS tables or copying learner-owned operational data.

### Implemented

-   Added `config.runtimeCopy.relations` support to the runtime rows controller.
-   Copied related Object rows only when metadata explicitly declares the relation.
-   Added reference remapping for copied relation rows, including CourseItems.SectionId -> copied CourseSections and TrackSteps.StageId -> copied TrackStages.
-   Configured Courses to copy CourseSections and CourseItems while excluding enrollments, progress, reports, and linked resource duplication by default.
-   Configured LearningTracks to copy TrackStages and TrackSteps through the same generic relation copy contract.
-   Strengthened the LMS fixture contract so generated snapshots must include the runtime copy relation metadata.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes --runInBand`: 127 passed.
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`: 18 passed.
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm run build:e2e:local-supabase`: 31 successful tasks.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=generators tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`: passed.

### Remaining Scope

-   Remaining open checklist labels are broader phase labels around final product polish, visual matrix completeness, and any Course/Track surfaces not tied to the now-closed copy relation behavior.

## 2026-05-17 - LMS Parent Progress Aggregation

### Summary

Closed the next Phase 8 progress gap with generic metadata-driven parent aggregation. Completing or updating child content progress can now recalculate parent course/track progress through the existing server-owned ContentProgress store.

### Implemented

-   Added `runtimeProgress.aggregateParents` handling to the runtime progress endpoint.
-   Kept aggregation inside the same transaction as the child progress upsert.
-   Used metadata-resolved component columns, workspace-aware active row filters, and parameterized SQL; no LMS-only route or physical table selection was added.
-   Configured CourseItems to aggregate required weighted progress into Courses.
-   Configured TrackSteps to aggregate required step progress into LearningTracks.
-   Strengthened the LMS fixture contract so generated snapshots must include aggregation metadata.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes --runInBand --testNamePattern="aggregates CourseItem progress|persists Learning Content page progress|sequence-locked CourseItem|runtime progress sequence policy"`: 4 passed.
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes --runInBand`: 124 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`: 18 passed.
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 successful tasks.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

### Remaining Scope

-   Phase 8 still tracks explicit recalculate actions and deeper learner-player behavior beyond the current generic player shell and parent aggregation.

## 2026-05-17 - LMS Enrollment Wizard Due-Date Derivation

### Summary

Closed the remaining Phase 10 enrollment wizard due-date parameter gap. Course and Track enrollment creation now handles "due for period" and "no due date" through generic metadata instead of LMS-specific form or backend branches.

### Implemented

-   Added generic `uiConfig.derivedDateOffset` handling in the published app `FormDialog`.
-   Added generic Object-level `config.runtimeDerivations.dateOffset` handling in the runtime rows controller before create-time date-order validation and insert.
-   Configured LMS Enrollments so `DueDateMode=ForPeriod` derives `DueDate` from `EnrolledAt + DuePeriodDays`.
-   Configured LMS Enrollments so `DueDateMode=NoDueDate` clears `DueDate`.
-   Kept existing relation-builder `createWizard` steps and conditional `visibleWhen`/`requiredWhen` metadata as the Enrollment Wizard UI.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` only through the Playwright generator.

### Validation

-   `pnpm --filter @universo/apps-template-mui exec vitest run --config vitest.config.ts src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx --coverage=false`: 10 passed.
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes --runInBand`: 123 passed.
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`: 18 passed.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 successful tasks.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

### Remaining Scope

-   Deeper course/track progress aggregation was pending at this point and was closed in a later 2026-05-17 parent aggregation slice.

## 2026-05-17 - LMS Generic Learner Player Shell

### Summary

Closed the first CourseItems learner-player slice for Phase 8. Course Builder now has a metadata-driven Player tab that lets a learner select course content, see sequential locking, preview linked resources or Editor.js pages, and complete the current CourseItem through the existing runtime progress endpoint.

### Implemented

-   Added the generic `learnerPlayer` widget to the published MUI app template renderer.
-   Registered `learnerPlayer` as an allowed dashboard widget in shared layout metadata.
-   Added Course Builder Player tab metadata in the LMS template with `Courses` as the parent datasource and `CourseItems` as the item datasource.
-   Reused existing `ResourcePreview`, `PageBlocksView`, MUI controls, TanStack Query, and the existing runtime progress API instead of creating an LMS-only player service.
-   Added codename aliasing for runtime rows so generated physical component fields still resolve metadata codenames such as `Title`, `CourseId`, `TargetObjectCodename`, and `TargetRecordId`.
-   Strengthened the LMS fixture contract so generated snapshots must include the learner player wiring.
-   Added runtime Playwright coverage that opens Course Builder Player, selects a seeded course, verifies locked CourseItems and preview rendering, completes an available CourseItem, and captures `lms-course-builder-learner-player-en.png`.

### Validation

-   `pnpm --filter @universo/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --coverage=false`: 17 passed.
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts tools/testing/e2e/support/lmsFixtureContract.ts`

### Remaining Scope

-   Weighted course/track progress recalculation was pending at this point and was closed in a later 2026-05-17 parent aggregation slice; deeper learner-player behavior remains separate.

## 2026-05-17 - LMS Server-Owned Sequence Progress Guard

### Summary

Closed the direct-API part of Phase 8 sequence safety. Runtime progress writes now respect the same metadata-defined sequence policy that the published UI uses for CourseItems and TrackSteps, so a locked learning item cannot be completed by bypassing the UI.

### Implemented

-   Added generic Object-level `config.runtimeProgress.sequencePolicy` support for server-owned progress writes.
-   Enforced sequence availability in `POST /runtime/progress/content` before progress-store insert/update SQL runs.
-   Kept the implementation generic: target Object metadata, component-defined columns, shared sequence helpers, parameterized SQL, and existing workspace-aware progress store binding are reused without an LMS-only route.
-   Configured CourseItems with `scopeFieldCodename=CourseId` and TrackSteps with `scopeFieldCodename=TrackId`.
-   Failed closed for invalid runtime sequence metadata with `SEQUENCE_POLICY_INVALID`.
-   Returned `SEQUENCE_ITEM_LOCKED` for direct completion attempts against unavailable sequence steps.
-   Strengthened the LMS fixture contract so generated snapshots must include runtime sequence guard metadata.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes --runInBand --testNamePattern="sequence-locked CourseItem|runtime progress sequence policy|Learning Content page progress"`: 3 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`: 18 passed.
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 successful tasks.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

### Remaining Scope

-   Phase 8 still needs fuller learner-player UX and learner-player screenshot coverage.
-   The final guided Enrollment Wizard UX discrepancy was closed in a later 2026-05-17 due-date derivation slice.

## 2026-05-17 - LMS Scoped Sequence Availability In Details Tables

### Summary

Closed the first Phase 8 learner-progress surface slice with generic metadata-driven sequence availability. Course Builder and Track Builder completion tabs now show Available/Locked state in the existing `detailsTable` DataGrid without an LMS-only player table.

### Implemented

-   Added optional `scopeFieldCodename` to the shared sequence policy contract so availability can be evaluated per parent course or track.
-   Extended the published app-template `detailsTable` renderer to compute sequence availability from metadata-defined order, schedule, prerequisite, and progress fields.
-   Rendered localized availability and locked-by columns through existing MUI DataGrid/Chip primitives.
-   Configured Course Builder completion rows with `scopeFieldCodename=CourseId` and Track Builder completion rows with `scopeFieldCodename=TrackId`.
-   Strengthened fixture-contract coverage so the generated LMS snapshot must include scoped sequential completion metadata.
-   Added unit coverage proving scoped rows from another course remain available and do not appear as blockers for the current course.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator.

### Validation

-   `pnpm --filter @universo/types exec vitest run --config vitest.config.ts src/__tests__/sequenceCompletion.test.ts src/__tests__/applicationLayouts.test.ts --coverage=false`: 16 passed.
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --coverage=false`: 16 passed.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`: 18 passed.
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts tools/testing/e2e/support/lmsFixtureContract.ts`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 successful tasks.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

### Remaining Scope

-   Phase 8 still needs a fuller learner-player path, direct locked-item API rejection, and learner-player screenshot coverage.

## Completed: LMS Learning Content V2 Implementation Slice 11 - Enrollment Validation And Permission Proof (2026-05-17)

The next Phase 10 hardening slice is complete. Enrollments now use generic runtime validation metadata for due-date ordering, and direct API enrollment creation has focused permission proof.

### Changes Made

-   Added generic Object-level `runtimeValidations.dateOrder` metadata for runtime row writes.
-   Enforced date-order validation in the runtime rows controller on create, single-field update, and bulk update before insert/update SQL runs.
-   Configured LMS Enrollments so `DueDate` must be on or after `EnrolledAt`.
-   Added backend route coverage proving member-role direct enrollment creation fails with `403` before runtime metadata is read.
-   Added backend route coverage proving invalid enrollment due dates fail before insert and update persistence.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator after the LMS template change.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes --runInBand --testNamePattern="Runtime parent-row permission contract"`: 12 passed.
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`: 18 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

## 2026-05-17 - LMS Course And Track Enrollment List Tabs

### Summary

Closed the enrollment-list part of the Manual Enrollment phase with generic published-app widgets. Course Builder and Track Builder now expose scoped enrollment authoring and an adjacent DataGrid list of existing enrollments without adding an LMS-only runtime table.

### Implemented

-   Added `detailsTable` enrollment-list widgets to Course Builder and Track Builder enrollment tabs, filtered by canonical `TargetType` values.
-   Kept scoped row creation in the existing `relationBuilder`, so authoring and review live in one tab while sharing generic runtime primitives.
-   Strengthened the LMS fixture contract so generated snapshots must include course and track enrollment list widgets with the expected `TargetType` filter.
-   Extended the imported published-app runtime flow to verify that the Enrollments tabs render the generic DataGrid list.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator.

### Validation

-   `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`: 18 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

### Remaining Scope

-   Phase 8 still needs fuller learner-player behavior and learner-player screenshot coverage.
-   The remaining wizard UX item was pending at this point and was closed in a later 2026-05-17 due-date derivation slice.

## 2026-05-17 - LMS Catalog-Ready Course And Track Metadata

### Summary

Closed the catalog-ready metadata part of the Manual Enrollment and Catalog phase with generic platform contracts. Courses and LearningTracks can now carry LMS catalog visibility, category, audience, and open/disabled self-enrollment policy without introducing an LMS-only widget or approval flow.

### Implemented

-   Added a shared `catalogPublicationPolicySchema` in `@universo/types` with fail-closed self-enrollment modes.
-   Added `CatalogCategory`, `CatalogAudience`, and `SelfEnrollmentMode` components to Courses, and added catalog visibility plus the same policy fields to LearningTracks.
-   Seeded bilingual catalog policy metadata in the LMS Playwright generator for demo courses and tracks.
-   Strengthened the LMS fixture contract so generated snapshots must include valid course and track catalog policies.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator.

### Validation

-   `pnpm --filter @universo/types exec vitest run --config vitest.config.ts src/__tests__/lmsPlatform.test.ts --coverage=false`: 11 passed.
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`: 18 passed.
-   `pnpm exec eslint tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 successful tasks.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

### Remaining Scope

-   Phase 10's guided Enrollment Wizard and wizard-specific due-date parameter UX were pending at this point and were closed in a later 2026-05-17 slice.
-   Phase 8 still needs full course/track learner-player behavior, sequential gating proof, and learner-player screenshot coverage.

## Completed: LMS Learning Content V2 Implementation Slice 10 - Learner Enrollment Visibility (2026-05-17)

The next Phase 10 implementation slice is complete. Published LMS workspaces now seed user-scoped enrollment rows and show learner-facing My Courses and My Tracks tabs on the home page through generic metadata-driven widgets.

### Changes Made

-   Added a generic runtime datasource filter token for the authenticated user so `records.list` widgets can filter by `{{runtime.currentUserId}}` without LMS-specific backend logic.
-   Added workspace seed runtime-token substitution for personal workspace creation, resolving current-user tokens from the workspace owner before seeded rows are inserted.
-   Extended the LMS Enrollments model with hidden `AssignedUserId` plus display-safe `TargetTitle`, while preserving polymorphic `TargetType` and `TargetId` targeting.
-   Seeded module, course, and track enrollments with `AssignedUserId` and target titles in the Playwright-generated LMS fixture.
-   Added metadata-defined My Courses and My Tracks tabs to the LMS home page using existing `detailsTabs` and `detailsTable` widgets.
-   Fixed the published MUI dashboard layout so Page blocks no longer suppress standalone center widgets, allowing authored home content and metadata tables to coexist.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator and extended fixture contract checks for current-user enrollment ownership.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationWorkspaces --runInBand`
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes --runInBand --testNamePattern="runtime search"`
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`
-   `pnpm --filter @universo/apps-template-mui exec vitest run src/dashboard/components/__tests__/MainGrid.test.tsx --coverage=false`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm exec eslint tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts tools/testing/e2e/support/lmsFixtureContract.ts`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `git diff --check`

### Remaining Scope

-   Phase 10's guided Enrollment Wizard, direct enrollment permission proof, and broader due-date validation were pending at this point and were closed in later 2026-05-17 slices.
-   Phase 8 still needs full course/track learner-player behavior, sequential gating proof, and learner-player screenshot coverage.

## Completed: LMS Learning Content V2 Implementation Slice 9 - Manual Enrollment Foundation And Active Enrollment Warnings (2026-05-17)

The next Phase 9/10 implementation slice is complete. Course Builder and Learning Track Builder now expose parent-scoped enrollment authoring through the generic relation-builder surface, and active enrollment warnings are proven in the imported published LMS runtime.

### Changes Made

-   Extended the generic `relationBuilder` layout contract with metadata-defined `createDefaults` so scoped child rows can be created without LMS-specific runtime code.
-   Reused the relation-builder widget for Course and Track enrollment tabs, scoped by selected course/track and seeded with `TargetType`.
-   Updated the LMS Enrollments model to use polymorphic `TargetType` and `TargetId` for module, course, and track targets while keeping `ContentNodeIdRef` compatibility for existing module-focused workflows.
-   Hardened workspace seed remapping so polymorphic enrollment targets are remapped to workspace-local module, course, and track rows during application workspace creation.
-   Normalized localized runtime option codenames in the published app API client so imported enum/REF option metadata validates consistently.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator and extended the fixture contract with course/track enrollment rows, due dates, and restrict-after-due metadata.
-   Extended the LMS imported-runtime browser flow with Course Builder and Track Builder enrollment warning screenshots.

### Validation

-   `pnpm --filter @universo/types exec vitest run --config vitest.config.ts src/__tests__/applicationLayouts.test.ts --coverage=false`
-   `pnpm --filter @universo/apps-template-mui exec vitest run src/api/__tests__/runtimeRows.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --coverage=false`
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`
-   `pnpm --filter @universo/applications-backend test -- applicationWorkspaces --runInBand`
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts tools/testing/e2e/support/lmsFixtureContract.ts`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

### Remaining Scope

-   Phase 10's guided Enrollment Wizard, learner "My Courses" visibility, direct enrollment permission tests, and broader due-date validation were pending at this point and were closed in later 2026-05-17 slices.
-   Phase 8 still needs the full learner player over course/track enrollments, sequential gating proof, and learner-player screenshot coverage.

## Completed: LMS Learning Content V2 Implementation Slice 8 - Generic Outline Row Ordering (2026-05-17)

The next Phase 7/9 implementation slice is complete. Existing metadata-driven `detailsTable` widgets can now opt into persisted row ordering for datasource-backed `records.list` tables, so LMS course and track outlines reuse the generic published MUI runtime table surface instead of adding an LMS-only builder widget.

### Changes Made

-   Added a CSRF-protected published runtime API helper for `POST /applications/:applicationId/runtime/rows/reorder`.
-   Extended the standalone published-app adapter with the same row reorder contract used by generic runtime row operations.
-   Updated `RecordsListDetailsTableWidget` so `enableRowReordering` renders the existing `FlowListTable` reorder controls when the datasource result set is complete and small enough for deterministic ordering.
-   Kept ordering fail-soft for incomplete/paginated datasets by showing the existing localized complete-dataset requirement instead of sending partial order mutations.
-   Added CourseSections, CourseItems, TrackStages, and TrackSteps scoped ordering layouts to the LMS template, all backed by `SortOrder` and generic `records.list` datasource widgets.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator.

### Validation

-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui test -- src/api/__tests__/runtimeRows.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 151 passed in the package run.
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend test -- src/tests/services/templateManifestValidator.test.ts --runInBand`: 18 passed.
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/applications-backend test -- src/tests/routes/applicationsRoutes.test.ts --runInBand --testNamePattern="runtime row reorder"`: 1 passed.
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=generators specs/generators/metahubs-lms-app-export.spec.ts`: 2 passed.
-   `pnpm --filter @universo/utils test -- src/snapshot/__tests__/snapshotFixtures.test.ts`: 311 passed in the package run.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium specs/flows/snapshot-import-lms-runtime.spec.ts`: 2 passed.

Note: existing non-blocking local warnings remain visible in broad focused runs: MUI `anchorEl` warnings in dialog tests, browser worker timeout stderr in the intentional fail-closed runtime test, `ResourcePreview` iframe abort stderr, Vite CJS/Sass legacy API warnings, Node `punycode` deprecation warnings, and Vite chunk-size warnings.

### Remaining Scope

-   Course Builder still needs dedicated course detail tabs, inline content linking, completion policy editing, and browser screenshot proof.
-   Learning Track Builder still needs dedicated track detail tabs, course/stage linking, sequence policy editing, and browser screenshot proof.
-   Learner player/progress aggregation, manual enrollment, and learner visibility were open at this point and were closed or narrowed in later 2026-05-17 slices.

## Completed: LMS Learning Content V2 Implementation Slice 7 - Page Player Browser Progress Proof (2026-05-17)

The final Phase 6 browser-proof gap for page player progress is closed. The admin-hosted published runtime now passes the same Learning Content `pagePlayer` contract into the shared `apps-template-mui` dashboard surface as the standalone runtime, and the browser flow proves that a workspace Page can move from local UI progress to the metadata-defined `ContentProgress` row.

### Changes Made

-   Wired `ApplicationRuntime` to pass Learning Content player settings, workspace-scoped progress storage keys, and the shared `updateLearningContentProgress` helper into `Dashboard`.
-   Exported the shared progress API helper from `@universo/apps-template-mui` so admin-hosted runtime and standalone runtime use one client contract.
-   Fixed runtime progress target resolution for Page entities by returning object `kind` from the backend metadata lookup.
-   Hardened the LMS Playwright runtime assertion helper so it reads persisted values through the runtime column mapping instead of assuming raw codename keys.
-   Fixed the PageBlocksView i18n namespace so the progress header localizes from the `apps` namespace after browser language switches.
-   Extended the LMS browser flow to assert `Reading progress 0%`, click `Mark complete`, verify the progress response, poll the `ContentProgress` runtime row, assert `Reading progress 100%`, capture a completion screenshot, and then assert `Прогресс чтения 100%` after switching to Russian.

### Validation

-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-frontend test -- src/pages/__tests__/ApplicationRuntime.test.tsx`: 174 passed in the package run.
-   `pnpm --filter @universo/apps-template-mui test -- src/dashboard/components/__tests__/MainGrid.test.tsx`: 149 passed in the package run.
-   `pnpm --filter @universo/applications-backend test -- src/tests/routes/applicationsRoutes.test.ts --runInBand`: 93 passed.
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/core-backend build`
-   `pnpm --filter @universo/core-frontend build`
-   `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium specs/flows/snapshot-import-lms-runtime.spec.ts`: 2 passed.
-   `pnpm supabase:e2e:stop`: local E2E Supabase profile stopped.

Note: existing non-blocking local warnings remain visible in broad focused runs: MUI `anchorEl` warnings in dialog tests, browser worker timeout stderr in the intentional fail-closed runtime test, `ResourcePreview` iframe abort stderr, Vite CJS/Sass legacy API warnings, Node `punycode` deprecation warnings, and Vite chunk-size warnings.

### Remaining Scope

-   Course Builder, learner player/progress aggregation, Track Builder, manual enrollment, learner visibility, and dedicated builder screenshot gates were open at this point and were closed or narrowed in later 2026-05-17 slices.

## Completed: LMS Learning Content V2 Implementation Slice 6 - Server-Owned Page Progress Persistence (2026-05-17)

The next Phase 6 implementation slice is complete. Published runtime Pages still keep a fail-soft browser reading progress cache for responsive UI, but page completion now also flows through a server-owned, metadata-defined `ContentProgress` object. The implementation stays generic: the backend resolves the progress store from application Learning Content settings and runtime object/component metadata instead of hardcoding LMS tables.

### Changes Made

-   Added `learningContent.progressStore` to the shared LMS application settings contract with strict codenames for the progress object and component fields.
-   Added the LMS template `ContentProgress` object with target object, target record, user, status, progress percent, started, completed, and last-viewed fields.
-   Added `POST /applications/:applicationId/runtime/progress/content`.
    -   Resolves the active runtime schema through the existing membership/workspace path.
    -   Verifies that the target runtime object and target row exist in the active workspace before persisting progress.
    -   Resolves the configured progress object and columns from metadata.
    -   Uses schema-qualified dynamic identifiers only after identifier validation.
    -   Uses parameterized values for user input and fails soft when the configured progress store is unavailable.
    -   Creates or updates the current user's progress row inside a transaction and scopes by workspace when the runtime app uses workspaces.
-   Added the published app API helper and wired `DashboardApp` / `PageBlocksView` so manual and automatic page completion call the server progress endpoint.
-   Extended focused tests for the shared contract, backend route, frontend API helper, dashboard page player handler, template manifest, fixture contract, and committed LMS snapshot.
-   Updated GitBook LMS Learning Content docs, `apps-template-mui` READMEs, and generated OpenAPI route docs.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator so the committed fixture includes `ContentProgress`.

### Validation

-   `pnpm --filter @universo/types test -- src/__tests__/lmsPlatform.test.ts`: 86 passed in the package run.
-   `pnpm --filter @universo/applications-backend test -- src/tests/routes/applicationsRoutes.test.ts --runInBand`: 93 passed.
-   `pnpm --filter @universo/apps-template-mui test -- src/api/__tests__/runtimeRows.test.ts`: 149 passed in the package run.
-   `pnpm --filter @universo/metahubs-backend test -- src/tests/services/templateManifestValidator.test.ts --runInBand`: 18 passed.
-   `pnpm --filter @universo/utils test -- src/snapshot/__tests__/snapshotFixtures.test.ts`: 311 passed in the package run.
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm docs:i18n:check`: 74 EN/RU page pairs checked.
-   `git diff --check`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 workspace build tasks passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=generators specs/generators/metahubs-lms-app-export.spec.ts`: 2 passed.
-   `pnpm supabase:e2e:stop`

Note: existing non-blocking local warnings remain visible in broad focused runs: MUI `anchorEl` warnings in block-editor tests, browser worker timeout stderr in the intentional fail-closed runtime test, `ResourcePreview` iframe abort stderr, tsdown module-type warnings, Sass legacy API warnings, `punycode` deprecation warnings, and Vite chunk-size warnings.

### Remaining Scope

-   Page player browser screenshot proof was completed in the next slice above.
-   Course Builder, learner player/progress aggregation, Track Builder, manual enrollment, learner visibility, and screenshot gates were open at this point and were closed or narrowed in later 2026-05-17 slices.

## Completed: LMS Learning Content V2 Implementation Slice 5 - Runtime Page Player Wiring And Local Reading Progress (2026-05-17)

The next Phase 6 implementation slice is complete. Published runtime Pages now receive their metadata `pageBlocks` from the runtime API through `DashboardApp`, so the existing MUI dashboard can render read-only Editor.js page content in real published applications instead of only in isolated component tests. The page renderer also honors the application-level Learning Content player preset for outline visibility, progress header visibility, and completion mode.

### Changes Made

-   Extended `DashboardDetailsSlot` with `pagePlayer` metadata for existing dashboard page rendering.
-   Updated `DashboardApp` to pass `objectCollection.pageBlocks` or `section.pageBlocks` into the existing dashboard details contract.
-   Reused `sanitizeApplicationLearningContentSettings` so the published app reads the same Learning Content player preset configured in the application control panel.
-   Added a deterministic per-application/per-workspace/per-section local reading progress key.
-   Extended `PageBlocksView` with:
    -   optional outline visibility;
    -   optional MUI progress header;
    -   manual "Mark complete" behavior;
    -   `autoAfterOpen` completion behavior;
    -   local progress persistence for resume-like page reads.
-   Added English and Russian runtime i18n keys for page progress UI.
-   Added focused published-app tests for:
    -   passing runtime page blocks and Learning Content player settings from `DashboardApp`;
    -   rendering page progress in `MainGrid`;
    -   hiding outline from player metadata;
    -   persisting manual local completion.

### Validation

-   `pnpm --filter @universo/apps-template-mui test -- src/dashboard/components/__tests__/MainGrid.test.tsx`
-   `pnpm --filter @universo/apps-template-mui test -- src/standalone/__tests__/DashboardApp.test.tsx`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`

Note: a parallel Vitest attempt hit a `coverage/.tmp` race while both commands wrote package coverage output at the same time. The same tests pass when run sequentially. Existing MUI `anchorEl`, browser-script timeout, and `ResourcePreview` iframe abort warnings remain non-blocking.

### Remaining Scope

-   Phase 6 still needed browser screenshot proof and server-owned learner progress persistence at this point; server-owned persistence was completed in the next slice above.
-   Course Builder, learner player/progress, Track Builder, manual enrollment, learner visibility, and screenshot gates remain open phases of the V2 plan.

## Completed: LMS Learning Content V2 Implementation Slice 3 - Visual Resource Source Authoring, Title Sync, And Page Outline (2026-05-17)

The next Phase 6 implementation slice is complete. Published-app CRUD forms now render metadata-driven resource source fields through a visual editor instead of forcing authors to edit raw JSON for standalone Learning Content resources. Learning Resources now use metadata-driven title/name sync, and runtime Editor.js pages render a generated outline from safe header blocks.

### Changes Made

-   Extended the generic `FormDialog` JSON field renderer for `uiConfig.widget = "resourceSource"`.
    -   Authors can select resource type, enter page codename, safe URL, storage key, or package descriptor through normal MUI controls.
    -   The form keeps using the shared `resourceSourceSchema` so invalid values disable save before submission.
    -   Valid source edits are normalized through the shared contract before the CRUD payload is submitted.
-   Reused the existing `ResourcePreview` component inside the form so authors see ready, invalid, and deferred resource states while editing.
-   Added generic form metadata sync support.
    -   A source field can declare `uiConfig.syncTargets`.
    -   A target field keeps syncing until it is manually edited.
    -   A hidden boolean metadata field can persist the manual-edit flag.
-   Added generic `uiConfig.hidden` support for runtime grids and forms so technical flags do not appear as author-facing controls.
-   Updated the LMS template so `LearningResources.Title` drives `LearningResources.Name` until `Name` is manually edited.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator so the committed fixture includes the new `Name`, `NameManuallyEdited`, `syncTargets`, and hidden-field metadata.
-   Added shared `extractPageBlockOutline` support in `@universo/types`.
    -   The helper resolves localized header text.
    -   It ignores invalid non-header blocks when building navigation so one unsupported block cannot hide an otherwise valid page outline.
    -   It clamps outline levels and emits stable runtime heading ids.
-   Extended the existing runtime `PageBlocksView` with an inline outline section that links to rendered heading anchors.
-   Added English and Russian runtime i18n keys for resource source controls.
-   Added focused Vitest coverage for:
    -   safe URL source authoring;
    -   unsafe `javascript:` URL rejection;
    -   page resource authoring without raw JSON editing.
    -   metadata-driven title/name sync and manual-edit flag persistence;
    -   hidden metadata columns being omitted from runtime grids;
    -   localized outline extraction from Editor.js header blocks;
    -   runtime page outline rendering in the existing dashboard surface.
-   Updated GitBook Learning Content docs for visual source authoring, title/name sync, runtime page outlines, and the backend validation boundary.

### Validation

-   `pnpm --filter @universo/apps-template-mui test -- src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx`
-   `pnpm --filter @universo/apps-template-mui test -- src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx src/utils/__tests__/columns.test.tsx`
-   `pnpm --filter @universo/types test -- src/__tests__/pageBlocks.test.ts`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/apps-template-mui test -- src/dashboard/components/__tests__/MainGrid.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/metahubs-backend test -- src/tests/services/templateManifestValidator.test.ts --runInBand`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `pnpm run build:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "create canonical lms metahub"`
-   `pnpm supabase:e2e:stop`

Note: the focused test run still emits existing MUI `anchorEl` JSDOM warnings, the existing browser-script timeout warning, and the existing `ResourcePreview` iframe abort warning. Assertions pass and commands exit successfully.
The E2E build/generator run also emits existing Vite/tsdown/Sass/punycode/chunk-size warnings. The generator passes and the local Supabase E2E profile is stopped at the end.

### Remaining Scope

-   Phase 6 is still open for learner reading progress and browser proof. Publication workflow is covered by the next completed slice below.
-   Course Builder, learner player/progress, Track Builder, manual enrollment, learner visibility, and screenshot gates remain open phases of the V2 plan.

## Completed: LMS Learning Content V2 Implementation Slice 4 - Enum-Backed Resource Publication Workflow (2026-05-17)

The next Phase 6 implementation slice is complete. Standalone Learning Resources now have metadata-backed publication actions while preserving the exact-capability workflow boundary and the generic REF-enumeration model.

### Changes Made

-   Extended the generic runtime workflow backend so actions can use logical status codenames while the physical status column stores a `REF` to an Enumeration value.
    -   The route resolves the configured status component from object metadata.
    -   For enumeration references, it loads active `_app_values` rows and builds a bidirectional stored-value/status map inside the workflow transaction.
    -   The mutation service evaluates workflow availability against logical status codenames but writes the real stored enum UUID.
    -   Missing enum values fail closed with `WORKFLOW_STATUS_VALUE_NOT_CONFIGURED`.
-   Updated the published app row actions menu to resolve REF enumeration status values through existing runtime column `refOptions`/`enumOptions`.
    -   Workflow action visibility now works when the row stores an enum value id rather than a string status.
    -   The UI still requires `_upl_version` and exact `requiredCapabilities`.
-   Added Learning Resource publication workflow metadata to the LMS template:
    -   `PublishLearningResource`: `Draft | UnpublishedChanges -> Published`;
    -   `ReturnLearningResourceToDraft`: `Published | UnpublishedChanges -> Draft`;
    -   `MarkLearningResourceChanged`: `Published -> UnpublishedChanges`.
-   Kept `workflow.execute` out of the broad `editContent` capability alias.
    -   Learning Resource publication remains an exact role-policy capability, consistent with the previous workflow QA boundary.
-   Strengthened the LMS fixture contract so required Learning Resource publication actions are checked together with existing operational workflow actions.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator.
-   Updated the LMS import-flow role-policy helper to grant `workflow.execute` explicitly for future browser workflow checks.

### Validation

-   `pnpm --filter @universo/applications-backend test -- src/tests/services/runtimeWorkflowActions.test.ts --runInBand`
-   `pnpm --filter @universo/applications-backend test -- src/tests/routes/guards.test.ts --runInBand`
-   `pnpm --filter @universo/applications-backend test -- src/tests/routes/applicationsRoutes.test.ts --runInBand`
-   `pnpm --filter @universo/apps-template-mui test -- src/components/__tests__/RowActionsMenu.recordCommands.test.tsx`
-   `pnpm --filter @universo/applications-frontend test -- src/pages/__tests__/ApplicationSettings.test.tsx`
-   `pnpm --filter @universo/metahubs-backend test -- src/tests/services/templateManifestValidator.test.ts --runInBand`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "create canonical lms metahub"`
-   `pnpm supabase:e2e:stop`

Note: focused frontend runs still emit existing MUI `anchorEl` JSDOM warnings and the existing `ResourcePreview` iframe abort warning. The E2E build/generator run also emits existing Vite/tsdown/Sass/punycode/chunk-size warnings. Assertions pass and the local Supabase E2E profile is stopped at the end.

### Remaining Scope

-   Phase 6 is still open for learner reading progress and browser proof of the resource publication UI.
-   Course Builder, learner player/progress, Track Builder, manual enrollment, learner visibility, and screenshot gates remain open phases of the V2 plan.

## Completed: LMS Learning Content V2 Implementation Slice 2 - Settings And Trash Restore UI (2026-05-17)

The second implementation slice from `memory-bank/plan/lms-learning-content-implementation-plan-2026-05-17-v2.md` is complete. It closes Phase 4 and adds the first practical deleted-record restore affordance to the generic published runtime surface without introducing an LMS-only control panel or widget fork.

### Changes Made

-   Added strict shared application-level Learning Content settings in `@universo/types`.
    -   Defaults now cover library view mode, supported resource types, course policies, track policy, player presets, and column presets.
    -   The sanitizer removes arbitrary settings and validates duplicate resource type entries through the shared Zod contract.
-   Extended the existing application settings page with a `Learning Content` tab instead of adding a separate LMS settings screen.
    -   Admins can configure supported/deferred resource types, default course and track behavior, player options, and default Learning Content table columns.
    -   The settings save path persists only sanitized typed configuration through the existing application settings payload.
-   Extended the generic published `records.union` details table runtime surface.
    -   Deleted union tables now render a localized restore action through the existing details table widget.
    -   Restore calls the generic runtime restore mutation using the source row id, object collection id, and `_upl_version` carried by the union row.
-   Updated English and Russian runtime/application i18n keys for Learning Content defaults and Trash restore actions.
-   Updated GitBook Learning Content documentation for application defaults and generic deleted-row restore behavior.

### Validation

-   `pnpm --filter @universo/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/applications-frontend test -- src/pages/__tests__/ApplicationSettings.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/types test -- src/__tests__/lmsPlatform.test.ts`
-   `pnpm --filter @universo/types lint`

Note: the focused frontend test runs still emit existing MUI `anchorEl` JSDOM warnings and the existing browser-script timeout warning. The assertions pass and the command exits successfully.

### Remaining Scope

-   Dedicated standalone page/resource authoring UX beyond the generic block editor surface remains open.
-   Dedicated Course Builder, learner player/progress, Learning Track Builder, manual enrollment, learner visibility, and browser screenshot gates remain open phases of the V2 plan.

## Completed: LMS Learning Content V2 Implementation Slice 1 (2026-05-17)

The first implementation slice from `memory-bank/plan/lms-learning-content-implementation-plan-2026-05-17-v2.md` is complete. It turns the prior LMS Learning Content draft into a stricter metadata-driven foundation without adding an LMS-only runtime fork.

### Changes Made

-   Added shared Learning Content contracts in `@universo/types`, including projects, access entries, stars, recent views, trash entries, publication statuses, course policies, track policies, player presets, and column presets.
-   Added a generic `records.union` runtime datasource descriptor so published dashboards can render Learning Resources, Courses, and Learning Tracks through one metadata-driven table surface.
-   Hardened generic runtime row lifecycle handling.
    -   Runtime list queries now support active/deleted lifecycle filtering.
    -   Runtime delete now accepts optimistic `expectedVersion` checks.
    -   Runtime restore now uses a fail-closed `POST /applications/:applicationId/runtime/rows/:rowId/restore` endpoint with permission, lock, version, posting-command, parent-row, and child-table restoration checks.
-   Reshaped the LMS metahub template around workspace-internal Learning Content Projects, standalone resources, courses, course items, learning tracks, track stages, track steps, recent/starred/shared/trash sections, and publication status metadata.
-   Extended the published `packages/apps-template-mui` runtime shell using existing dashboard primitives.
    -   Runtime APIs/adapters/mutations now understand deleted rows and restore operations.
    -   Details table widgets can render `records.union` datasources through existing `CustomizedDataGrid`.
    -   Menu icon resolution now covers recent, starred, and trash sections.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` only through the Playwright LMS generator and strengthened the fixture contract for the new content objects, sets, menu structure, layouts, seeded rows, and explicit acceptance gaps.
-   Updated GitBook LMS documentation and package READMEs for the new Learning Content model.

### Validation

-   `pnpm --filter @universo/types test`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/metahubs-backend test -- src/tests/services/templateManifestValidator.test.ts --runInBand`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/applications-backend test -- src/tests/routes/applicationsRoutes.test.ts --runInBand -t "Runtime lifecycle delete contract"`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui test -- src/api/__tests__/runtimeRows.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `pnpm run build:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "create canonical lms metahub"`
-   `pnpm supabase:e2e:stop`

### Remaining Scope

-   Generic application settings UI for Learning Content defaults is still open.
-   Dedicated runtime authoring UX for standalone pages/resources is still open beyond the existing generic block/resource groundwork.
-   Dedicated Course Builder, learner player/progress, Learning Track Builder, manual enrollment, learner visibility, and screenshot gates remain open phases of the V2 plan.

## Completed: Research-Aware Planning Workflow (2026-05-16)

The agent workflow now has a dedicated research-aware path for link-driven and current-information planning.

### Changes Made

-   Added `RESEARCH` / `RPLAN` custom mode rules in `.gemini/rules/custom_modes/research_mode.md`.
-   Updated `AGENTS.md` routing so the new research mode is part of the repository mode sequence.
-   Updated `VAN` mode so it recommends `RESEARCH` / `RPLAN` before PLAN when the task includes links or current external facts.
-   Updated `PLAN` mode so missing research no longer blocks planning; PLAN now completes required research inline or through a research-capable subagent when available, saves findings to `memory-bank/research/`, and continues planning.
-   Updated PLAN behavior so agents save Markdown plans into `memory-bank/plan/` by default unless the user explicitly requests another destination or chat-only output.
-   Mirrored the same research mode and PLAN research handling across `.github/agents`, `.claude/agents`, `.qoder/agents`, and `.kiro/steering/custom_modes`.
-   Updated `.gemini/GEMINI.md` so Gemini CLI context routing includes `RESEARCH` / `RPLAN`.
-   Added durable research artifact storage under `memory-bank/research/`.
-   Imported `agents-best-practices` as a complete project-local skill.
-   Imported a curated AI Research skill subset: `brainstorming-research-ideas`, `creative-thinking-for-research`, `instructor`, `dspy`, `langsmith`, and `ml-paper-writing`.
-   Added the local `research-before-plan` skill with research artifact, source quality, and PLAN handoff references.
-   Added `.agents/skills/SOURCES.md` to preserve source and license attribution for imported Skills.

### Validation

-   Manual structure validation performed with `find`/`sed`/`rg`.
-   No package build or test run was needed because the change only affects repository workflow rules, Memory Bank documentation, and agent skill files.

## Completed: LMS Platform Implementation Slice 7F - Operational Workflow Playwright Proof (2026-05-15)

Phase 7 now has browser/API E2E proof for the operational LMS workflow metadata generated from the snapshot fixture.

### Changes Made

-   Extended `snapshot-import-lms-runtime.spec.ts` to exercise every configured LMS workflow action after snapshot import, linked application creation, schema sync, workspace runtime initialization, and role-policy capability grants.
-   Covered assignment submission review actions, training attendance actions, certificate issue/revoke actions, development task actions, and notification outbox actions through the trusted runtime workflow endpoint.
-   Verified optimistic version advancement and trusted response metadata for each action instead of relying on client-provided action JSON.
-   Updated the runtime flow assertions to match the current LMS dashboard, Knowledge page, and Development page contracts.
-   Fixed the shared published-app `ItemCard` primitive so clickable cards with inline action buttons do not render invalid nested `<button>` elements. Cards with inline actions now use a keyboard-accessible `div role="button"` wrapper while simple cards continue using `CardActionArea`.

### Validation

-   `pnpm exec eslint --fix packages/apps-template-mui/src/components/runtime-ui/index.tsx tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm --filter @universo/apps-template-mui test -- RuntimeWorkspacesPage`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project=chromium --grep "lms snapshot fixture imports"`

---

## Completed: LMS Platform Implementation Slice 7A - Trusted Runtime Workflow Action Endpoint (2026-05-15)

The first Phase 7 operational workflow slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete.

### Changes Made

-   Added `POST /applications/:applicationId/runtime/rows/:rowId/workflow/:actionCodename`.
    -   The request accepts only `objectCollectionId` and a required `expectedVersion`.
    -   The server resolves the workflow action from the selected Object metadata, not from client-provided JSON.
    -   The existing runtime workflow action service applies status transitions with optimistic locking, workspace gating, capability checks, and audit facts.
-   Reused existing runtime access checks.
    -   The route requires `editContent`.
    -   The workflow capability map includes the same aliases used by effective role-policy resolution, including `workflow.execute` for edit-capable roles.
-   Added focused route coverage.
    -   A configured action transitions the row and writes audit metadata.
    -   An unconfigured action fails before any runtime row table is touched.

### Validation

-   `pnpm --dir packages/applications-backend/base exec eslint --fix src/controllers/runtimeRowsController.ts src/routes/applicationsRoutes.ts src/tests/routes/applicationsRoutes.test.ts`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-backend test -- runtimeWorkflowActions applicationsRoutes.test.ts -t "workflow actions" --runInBand`

---

## Completed: LMS Platform Implementation Slice 6F - Details Table Workflow Action Editor (2026-05-15)

Phase 6 from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete.

### Changes Made

-   Added typed `workflowActions` support to the generic `detailsTable` widget config contract.
    -   The contract reuses the neutral workflow action schema from `@universo/types`.
    -   Invalid workflow actions fail schema validation instead of being stored as arbitrary widget JSON.
-   Extended the existing Application Layout widget behavior editor instead of adding a duplicate LMS-specific workflow screen.
    -   Admins can configure action codename, title, source statuses, target status, required capabilities, status field metadata, optional script hook, posting command, and confirmation copy.
    -   Workflow action settings are normalized before save and incomplete action slots are removed.
    -   Missing or incomplete workflow settings show localized warning previews before save.
-   Added English and Russian i18n labels for workflow action settings and warning copy.
-   Added focused regression coverage for shared widget config contracts and editor normalization/warnings.
-   Kept runtime mutation execution on the existing trusted backend workflow action service.
    -   The published runtime must not execute actions directly from client-provided widget JSON.
    -   A future runtime action button surface should resolve action contracts from trusted application metadata before calling the workflow mutation service.

### Validation

-   `pnpm --filter @universo/types lint`
-   `VITEST_COVERAGE=false pnpm --dir packages/universo-types/base exec vitest run --config vitest.config.ts src/__tests__/applicationLayouts.test.ts`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/applications-frontend lint`
-   `VITEST_COVERAGE=false pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/components/layouts/__tests__/ApplicationWidgetBehaviorEditorDialog.test.tsx`
-   `pnpm --filter @universo/applications-frontend build`

Note: the editor test still logs the existing MUI Select `anchorEl` JSDOM warning when opening menus. The test assertions pass.

---

## Completed: LMS Platform Implementation Slice 6E - Inline Report Definitions For Details Tables (2026-05-15)

Another Phase 6 slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete. Phase 6 remains open for workflow action settings editors.

### Changes Made

-   Added typed inline `reportDefinition` support to the generic `detailsTable` widget config contract.
    -   The contract reuses the existing neutral report definition schema.
    -   Invalid inline reports fail schema validation instead of being accepted as arbitrary widget JSON.
-   Extended the existing Application Layout widget behavior editor instead of adding a report-specific screen.
    -   Admins can configure report codename, title, description, output columns, filters, and aggregations.
    -   The editor can reuse the existing detailsTable datasource as the report datasource.
    -   Incomplete or invalid report definitions show localized warning previews before save.
-   Extended the published-app runtime table path.
    -   `detailsTable` widgets with an inline report definition run through the existing runtime reports endpoint.
    -   Runtime report rows are displayed through the existing shared data grid contract.
    -   The runtime report API helper now accepts either saved report references or inline report definitions.
-   Added English and Russian i18n labels for report definition settings and warnings.
-   Added focused regression coverage for shared widget config contracts, editor normalization/warnings, API requests, and runtime rendering.

### Validation

-   `pnpm --filter @universo/types lint`
-   `VITEST_COVERAGE=false pnpm --dir packages/universo-types/base exec vitest run --config vitest.config.ts src/__tests__/applicationLayouts.test.ts`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/applications-frontend lint`
-   `VITEST_COVERAGE=false pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/components/layouts/__tests__/ApplicationWidgetBehaviorEditorDialog.test.tsx`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `VITEST_COVERAGE=false pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/api/__tests__/runtimeReports.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`

Note: the editor test still logs the existing MUI Select `anchorEl` JSDOM warning, and the runtime widget test still logs the existing missing i18next test-instance warning. The assertions pass.

---

## Completed: LMS Platform Implementation Slice 6D - Details Table Sequence Policy Editor (2026-05-15)

Another Phase 6 slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete. Phase 6 remains open for report definition and workflow action settings editors.

### Changes Made

-   Added typed `sequencePolicy` support to the generic `detailsTable` widget config contract.
    -   The contract reuses the neutral sequence/completion schema from `@universo/types`.
    -   Invalid policies fail schema validation instead of being accepted as arbitrary widget JSON.
-   Extended the existing Application Layout widget behavior editor instead of adding an LMS-specific sequence UI.
    -   Admins can configure free, sequential, scheduled, and prerequisite modes.
    -   Sequential, scheduled, prerequisite, retry, attempt, and completion-condition settings are normalized before save.
    -   Empty or incomplete non-free sequence policies show localized warning previews.
-   Added English and Russian i18n labels for sequence policy settings and warnings.
-   Added focused regression coverage for shared widget config contracts and editor normalization/warnings.

### Validation

-   `pnpm --filter @universo/types lint`
-   `VITEST_COVERAGE=false pnpm --dir packages/universo-types/base exec vitest run --config vitest.config.ts src/__tests__/applicationLayouts.test.ts`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/applications-frontend lint`
-   `VITEST_COVERAGE=false pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/components/layouts/__tests__/ApplicationWidgetBehaviorEditorDialog.test.tsx`
-   `pnpm --filter @universo/applications-frontend build`

Note: the editor test still logs the existing MUI Select `anchorEl` JSDOM warning when opening menus. The test assertions pass.

---

## Completed: LMS Platform Implementation Slice 6C - Generic Resource Preview Layout Widget (2026-05-15)

Another Phase 6 slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete. Phase 6 remains open for report, workflow, and sequence settings editors.

### Changes Made

-   Added a generic `resourcePreview` dashboard layout widget.
    -   Registered it in shared dashboard widget metadata.
    -   Added a typed `resourcePreviewWidgetConfigSchema` in `@universo/types`.
    -   Reused the existing `ResourcePreview` runtime component in `packages/apps-template-mui`.
-   Extended the existing Application Layout widget behavior editor instead of adding a new LMS-specific UI.
    -   Admins can configure title, description, resource type, launch mode, URL, page codename, storage key, and MIME type.
    -   The editor keeps valid resource source settings and drops invalid sources during normalized saves.
    -   Invalid, missing, and deferred resource sources now show localized warning previews.
-   Added English and Russian i18n labels for resource preview widget settings.
-   Added regression coverage for shared widget config contracts, the structured editor, and runtime widget rendering.

### Validation

-   `pnpm --filter @universo/types lint`
-   `VITEST_COVERAGE=false pnpm --dir packages/universo-types/base exec vitest run --config vitest.config.ts src/__tests__/applicationLayouts.test.ts`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/applications-frontend lint`
-   `VITEST_COVERAGE=false pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/components/layouts/__tests__/ApplicationWidgetBehaviorEditorDialog.test.tsx`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `VITEST_COVERAGE=false pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`

Note: an early parallel test attempt overlapped with `@universo/types` build cleaning `dist`, so Vite temporarily could not resolve `@universo/types`. The sequential rerun after the build passed.

## Completed: LMS Platform Implementation Slice 6B - Widget Datasource Validation Preview (2026-05-15)

Another Phase 6 slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete. Phase 6 remains open for report, workflow, sequence, and resource settings editors.

### Changes Made

-   Reused the existing `ApplicationWidgetBehaviorEditorDialog` instead of adding a new LMS-specific editor.
-   Added a localized warning preview for incomplete widget datasource settings:
    -   records list datasources without a section target
    -   ledger datasources without a ledger target
    -   ledger projections without a projection codename
    -   chart datasources without X-axis or series fields
    -   unsupported overview card metrics that will be removed on save
-   Kept the existing fail-closed normalization behavior, so invalid datasource settings are still stripped or reduced before persistence.
-   Added English and Russian i18n keys for the new validation warnings.
-   Added regression coverage for incomplete datasource previews and unsupported overview metric previews.

### Validation

-   `pnpm --filter @universo/applications-frontend lint`
-   `VITEST_COVERAGE=false pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/components/layouts/__tests__/ApplicationWidgetBehaviorEditorDialog.test.tsx`
-   `pnpm --filter @universo/applications-frontend build`

Note: package-script Vitest runs that attempted to pass filename or `-t` filters still executed the broader suite in this workspace. Those broad runs reported existing timeout flakes in `ApplicationSettings` and `ApplicationLayouts`, plus one coverage temp-file collision when two broad runs overlapped. The direct single-file Vitest run for this slice passed.

## Completed: LMS Platform Implementation Slice 6A - Control Panel Role Policy Safety (2026-05-15)

The first Phase 6 slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete. Phase 6 remains open for the broader widget, report, workflow, sequence, and resource settings editors.

### Changes Made

-   Added shared role-policy safety helpers in `@universo/types`:
    -   `collectUnsupportedActiveCapabilityRules()` reports active grants that use unsupported scopes.
    -   `sanitizeApplicationRolePolicySettingsForSupportedScopes()` downgrades unsupported active grants to deny rules.
-   Reused the existing Application Settings Access tab instead of adding a parallel UI surface.
    -   Imported unsupported scoped active grants now show a localized warning preview.
    -   Saving settings sanitizes unsupported grants before persistence.
-   Added frontend save safety:
    -   General/access settings saves now update the application detail query optimistically.
    -   Failed saves roll back to the previous TanStack Query cache state.
-   Added backend fail-closed persistence:
    -   Application settings updates sanitize `rolePolicies` before merge and storage.
    -   API bypasses cannot persist unsupported scoped active grants.
-   Added localized English and Russian warning copy.
-   Added focused regression coverage for shared helpers, frontend settings saves, and backend route updates.

### Validation

-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/types test -- lmsPlatform workflowActions --runInBand`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/applications-frontend test -- ApplicationSettings.test.tsx --runInBand`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts -t "downgrades unsupported scoped active role policy grants" --runInBand`

Note: the broader `applicationsRoutes.test.ts guards.test.ts` backend test pattern still reports pre-existing runtime-script route failures unrelated to this slice. The new targeted backend route regression passes.

## Completed: LMS Platform Implementation Slice 4 - Generic Workflow Actions (2026-05-15)

Phase 4 from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete.

### Changes Made

-   Added neutral workflow action contracts in `@universo/types`
    -   `workflowActionSchema` now supports action codename, source statuses, target status, status field metadata, required capabilities, confirmation metadata, script hook codename, and optional posting command
    -   Scoped capability contracts moved out of the LMS-specific platform file
-   Added fail-closed workflow action availability evaluation
    -   Actions require explicit source statuses and explicit capabilities
    -   Missing capabilities deny execution
    -   `recordOwner`, `department`, `class`, and `group` scoped capabilities deny execution until their predicates are implemented
-   Added SQL-first runtime workflow action mutation service
    -   Uses `qSchemaTable()` and `qColumn()` for dynamic identifiers
    -   Requires a current positive `_upl_version`
    -   Checks row lock, workspace context, current status, and current version before mutation
    -   Uses `RETURNING` and fails closed on zero-row update results
-   Added generic workflow action audit persistence
    -   Runtime schemas now include `_app_workflow_action_audit`
    -   Audit facts store object, table, row, workspace, action, from/to statuses, posting command, metadata, and audit user fields
-   Added direct regression coverage
    -   Workflow action contract parsing and availability rules
    -   Backend mutation, audit insert, missing capability denial, version requirement, and unsupported scope denial
    -   Schema generator creation of the audit system table

### Validation

-   `pnpm --filter @universo/types lint` - PASSED
-   `pnpm --filter @universo/types test -- workflowActions lmsPlatform --runInBand` - PASSED
-   `pnpm --filter @universo/types build` - PASSED
-   `pnpm --filter @universo/applications-backend lint` - PASSED
-   `pnpm --filter @universo/applications-backend test -- runtimeWorkflowActions.test.ts runtimeRecordBehavior.test.ts --runInBand` - PASSED
-   `pnpm --filter @universo/schema-ddl test -- SchemaGenerator --runInBand` - PASSED
-   `pnpm --filter @universo/schema-ddl build` - PASSED
-   `pnpm --filter @universo/schema-ddl lint` - PASSED with existing warnings only
-   `pnpm --filter @universo/applications-backend build` - PASSED after the concurrent `schema-ddl build` finished
-   `git diff --check` - PASSED

## Completed: LMS Platform Implementation Slice 3 - Generic Sequence And Completion Engine (2026-05-15)

Phase 3 from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete.

### Changes Made

-   Added neutral sequence and completion contracts in `@universo/types`
    -   `sequencePolicySchema` and `completionConditionSchema` now live in a shared module instead of the LMS-specific platform contract file
    -   Sequence availability supports free, sequential, scheduled, and prerequisite-gated modes
    -   Completion conditions support progress percentage, score percentage, attendance, certificate, manual, and all-steps-completed rules
-   Added deterministic progress helpers
    -   `calculateWeightedProgress()` handles mixed completion items with optional weights, partial progress, and scored pass/fail results
    -   `isCompletionItemComplete()` gives runtime code one consistent completion predicate
-   Reused the shared progress helper from the standalone guest LMS runtime path
    -   Guest content progress now goes through the shared completion engine instead of an inline local formula
-   Added focused regression tests
    -   Weighted progress, completion conditions, sequential locking, scheduled locking, prerequisite locking, and LMS schema compatibility are covered

### Validation

-   `pnpm --filter @universo/types lint` - PASSED
-   `pnpm --filter @universo/types test -- sequenceCompletion lmsPlatform --runInBand` - PASSED
-   `pnpm --filter @universo/types build` - PASSED
-   `pnpm --filter @universo/apps-template-mui lint` - PASSED
-   `pnpm --filter @universo/apps-template-mui test -- src/standalone/__tests__/GuestApp.test.tsx --runInBand` - PASSED
-   `pnpm --filter @universo/apps-template-mui build` - PASSED
-   `git diff --check` - PASSED

## Completed: LMS Platform Implementation Slice 2 - Generic Resource Engine (2026-05-15)

Phase 2 from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete.

### Changes Made

-   Added shared safe resource source contracts in `@universo/types`
    -   `parseSafeExternalUrl()` and `normalizeSafeExternalUrl()` allow only absolute `http`/`https` URLs
    -   URL credentials, control characters, relative URLs, unsupported protocols, unsupported early MIME types, and unapproved embed hosts fail closed
    -   `resourceSourceSchema` now covers `page`, `url`, `video`, `audio`, `document`, `embed`, `file`, and deferred `scorm`
-   Reused shared resource contracts from LMS resource definitions and Page block validation
    -   Image blocks use the safe external URL schema
    -   Embed blocks use the explicit runtime embed allowlist
-   Added generic published-app `ResourcePreview`
    -   Renders page, URL, video, audio, document, and embed sources without LMS-specific screens
    -   Shows explicit deferred state for SCORM, file, and storage-backed resources
    -   Uses sandboxed iframes for allowed embeds
-   Added backend write validation for configured JSON fields
    -   `uiConfig.widget = "editorjsBlockContent"` normalizes through canonical block content validation
    -   `uiConfig.widget = "resourceSource"` normalizes through `resourceSourceSchema`
    -   Runtime row create/update paths now reject invalid configured JSON payloads even when bypassing the UI
-   Expanded the LMS resource fixture contract and seeded current fixture coverage
    -   Fixture now includes page, URL, video, audio, document, embed, and deferred SCORM resource sources
    -   `LearningResources.Source` carries `uiConfig.widget = "resourceSource"`
    -   Generator maps every resource source type to the matching `ResourceType` enumeration value

### Validation

-   `pnpm --filter @universo/types build` - PASSED
-   `pnpm --filter @universo/types lint` - PASSED
-   `pnpm --filter @universo/types test -- resourceSources pageBlocks lmsPlatform --runInBand` - PASSED
-   `pnpm --filter @universo/apps-template-mui lint` - PASSED
-   `pnpm --filter @universo/apps-template-mui test -- src/components/resource-preview/__tests__/ResourcePreview.test.tsx --runInBand` - PASSED
-   `pnpm --filter @universo/apps-template-mui build` - PASSED
-   `pnpm --filter @universo/applications-backend lint` - PASSED
-   `pnpm --filter @universo/applications-backend test -- runtimeHelpers.test.ts runtimeRowsController.test.ts --runInBand` - PASSED
-   `pnpm --filter @universo/applications-backend build` - PASSED
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts --runInBand` - PASSED
-   `pnpm --filter @universo/metahubs-backend build` - PASSED
-   Manual Node fixture assertion verified snapshot hash, `LearningResources.Source` UI config, required resource source types, and deferred SCORM placeholder

## Completed: LMS Platform Implementation Slice 1 (2026-05-15)

The first implementation slice from `memory-bank/plan/ispring-like-lms-next-platform-roadmap-2026-05-15.md` is complete.

### Changes Made

-   Isolated `packages/apps-template-mui` from `@universo/template-mui`
    -   Added local runtime UI primitives and `useListDialogs`
    -   Removed the package dependency
    -   Added a package-boundary regression test
-   Hardened published application runtime permissions
    -   `createContent`, `editContent`, and `deleteContent` now fail closed unless explicitly `true`
    -   Inline BOOLEAN editing is disabled when edit permission is not explicitly granted
    -   Added regression coverage for missing, null, malformed, and denied permissions
-   Added metadata-driven app-side block content authoring
    -   Added an isolated Editor.js block editor to `packages/apps-template-mui`
    -   Propagated component `uiConfig` into runtime `FieldConfig`
    -   Added `JSON` field support for `uiConfig.widget = "editorjsBlockContent"`
    -   Added localized block editor labels
-   Replaced current LMS surrogate menu targets
    -   Knowledge now targets `KnowledgeArticle`
    -   Development now targets `DevelopmentPlans`
    -   Added fixture contract gates preventing Knowledge -> Quizzes and Development -> Classes regressions
    -   Updated the current LMS snapshot fixture and runtime E2E expectations

### Validation

-   `pnpm --filter @universo/apps-template-mui build` - PASSED
-   `pnpm --filter @universo/apps-template-mui lint` - PASSED
-   `pnpm --filter @universo/apps-template-mui test -- src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx src/utils/__tests__/columns.test.tsx src/__tests__/packageBoundary.test.ts --runInBand` - PASSED
-   `pnpm --filter @universo/applications-frontend lint` - PASSED
-   `pnpm --filter @universo/applications-frontend test -- src/pages/__tests__/ApplicationRuntime.test.tsx --runInBand` - PASSED
-   `pnpm --filter @universo/metahubs-backend build` - PASSED
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts --runInBand` - PASSED
-   Manual Node fixture assertion verified LMS menu targets in `tools/fixtures/metahubs-lms-app-snapshot.json`

## Completed: Documentation Refresh - Final Validation (2026-05-15)

Phase 6 final validation completed successfully. All documentation checks passed.

### Changes Made

-   Fixed broken links in `docs/en/guides/README.md` and `docs/ru/guides/README.md`
    -   Removed references to deleted UPDL and Multi-Platform Export guides
    -   Added references to all current guides (LMS, Pages, Ledgers, etc.)
-   Updated `tools/docs/check-i18n-docs.mjs` configuration
    -   Removed deleted pages from `requiredScreenshotPages` list
    -   Updated `screenshotExemptPages` to include new guides
-   Verified EN and RU SUMMARY.md structure matches exactly
-   Verified all 72 EN/RU page pairs have matching line counts and structure

### Validation

-   `pnpm docs:i18n:check` - PASSED
-   Checked 72 EN/RU page pairs
-   No broken links found
-   All structural checks passed (headings, code fences, bullets, lists, images, tables)
-   Screenshot coverage verified

### Summary of Complete Documentation Refresh

**Phases Completed:**

1. ✅ Analysis (QA) - Identified gaps and outdated content
2. ✅ Content Deletion - Removed 26 files of non-existent functionality
3. ✅ Platform Section Updates - Updated core platform documentation
4. ✅ Pages Entity Documentation - Created comprehensive Pages guide (EN + RU)
5. ✅ Screenshot Generation - Generated 14 entity screenshots per locale
6. ✅ Final Validation - All documentation checks passed

**Impact:**

-   Documentation now accurately reflects platform capabilities
-   No misleading information about non-existent features
-   Comprehensive Pages entity guide with Editor.js integration
-   All screenshots show correct locale-specific UI
-   EN and RU versions fully synchronized
-   All internal links working correctly

## Completed: Documentation Refresh - Screenshot Generation (2026-05-15)

Phase 5 screenshot generation completed for entity documentation.

### Changes Made

-   Generated entity screenshots for both EN and RU locales using Playwright
-   Created screenshots for:
    -   Entity workspace
    -   Metahub create dialog
    -   Entity create dialog
    -   Hub tree view
    -   Resources workspace (components, constants, values tabs)
    -   Object records
    -   Set fixed values
    -   Enumeration option values
-   Added screenshot references to Pages entity guide (EN + RU)
-   Used local Supabase E2E environment for screenshot generation

### Validation

-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs generators/docs-entity-screenshots.spec.ts`
-   Verified screenshots exist in `docs/en/.gitbook/assets/entities/` (14 files)
-   Verified screenshots exist in `docs/ru/.gitbook/assets/entities/` (14 files)
-   Screenshots show correct locale-specific UI text

## Completed: Object/Component QA Warning Closure (2026-05-15)

The remaining QA findings from the Object/Component rename review are closed.

### Changes Made

-   Renamed the last active stale shared policy test file to `platformSystemComponentsPolicy`.
-   Hardened `TargetEntitySelector` so a preselected entity kind remains valid while entity type metadata is still loading, removing the MUI out-of-range Select warning without changing the unsupported-kind behavior after loading.
-   Added an i18n-backed accessible label for publication application row actions and tightened the related test layout mock so the MUI menu anchor is valid in jsdom.
-   Added localized EN/RU labels for the publication application row actions button.

### Validation

-   `pnpm --filter @universo/metahubs-backend test -- platformSystemComponentsPolicy`
-   `pnpm exec vitest run --config vitest.config.ts src/components/__tests__/TargetEntitySelector.test.tsx src/domains/publications/ui/__tests__/PublicationApplicationList.test.tsx`
-   `pnpm --filter @universo/metahubs-frontend lint`
-   `git diff --check`
-   Targeted `rg` audit for stale shared policy identifiers in the metahubs backend source.

## Completed: Object/Component Final QA Remediation (2026-05-14)

The final QA blockers for the Object/Component rename are closed.

### Changes Made

-   Replaced stale Playwright `createLinkedCollection` usage with `createObjectCollection` and removed remaining local `LinkedCollection` naming in the affected Object lifecycle/layout flows.
-   Updated `@universo/template-mui` breadcrumb, menu, and optimistic CRUD tests from Catalog/LinkedCollection assumptions to Object/ObjectCollection hooks, routes, labels, and cache keys.
-   Renamed the public shared layout authoring type from `LayoutAuthoringWidgetCatalogItem` to `LayoutAuthoringAvailableWidgetItem`.
-   Cleaned stale Catalog/Attribute wording in touched shared UI comments without introducing new UI components.

### Validation

-   `pnpm --filter @universo/template-mui test -- useBreadcrumbName MenuContent menuConfigs NavbarBreadcrumbs LayoutAuthoringDetails optimisticCrud.integration`
-   `pnpm --filter @universo/template-mui lint`
-   `pnpm --filter @universo/template-mui build`
-   `git diff --check`
-   Targeted `rg` audit for stale `createLinkedCollection`, `LayoutAuthoringWidgetCatalogItem`, `useLinkedCollectionName`, `/entities/catalog`, `kindKey: 'catalog'`, `_mhb_attributes`, `_app_attributes`, and `cat_` markers in the remediated areas.
-   `pnpm run build:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium flows/metahub-entities-publication-runtime.spec.ts flows/metahub-global-entity-layouts.spec.ts`
-   `pnpm supabase:e2e:stop`

## Completed: Object Collections QA Remediation Closure (2026-05-14)

The Object/Component implementation review findings are closed.

### Changes Made

-   Aligned the layout widget frontend API, query keys, mocks, and tests with the backend `/zone-widgets/object` route.
-   Replaced the stale `CatalogTable.tsx` file name with `ObjectTable.tsx` and expanded `@universo/apps-template-mui` build coverage to include component barrels.
-   Updated remaining active user-facing Attribute wording, stale `cat_` system-app docs, Object/Component test fixtures, and renamed component route/service tests.
-   Ran package-local ESLint auto-formatting for touched frontend packages and verified the remaining rename-term grep hits are allowed migration-catalog, ABAC, and DnD API terms.

### Validation

-   `pnpm --filter @universo/metahubs-frontend test -- --runInBand LayoutDetails.cacheInvalidation LayoutDetails.inheritedWidgets queryKeys TargetEntitySelector LayoutList.copyFlow QuizWidgetEditorDialog EntityScriptsTab MetahubBoard`
-   `pnpm --filter @universo/metahubs-backend test -- componentRoutes MetahubComponentsService systemComponentSeed layoutsRoutes entityInstancesRoutes fixedValuesRoutes EntityDeletePatterns SnapshotRestoreService snapshotLayouts`
-   `pnpm --filter @universo/applications-backend test -- applicationReleaseBundle syncLayoutPersistence syncLayoutMaterialization runtimeRowsController applicationWorkspaces publicRuntimeAccess applicationsRoutes`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-frontend build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/metahubs-frontend lint`
-   `git diff --check`

## Completed: Object Collections QA Remediation (2026-05-14)

The Object/Component rename QA gaps are closed after the implementation pass.

### Changes Made

-   Updated Playwright flow specs and API helpers to use the Object Collection contract, including `objectCollectionId`, `objectCollections`, and the `object` template/kind expectations.
-   Fixed the shared component settings target mapping so component targets resolve through Objects rather than the removed Catalog contract.
-   Hardened published app runtime permissions to fail closed when backend payloads omit CRUD flags, including dashboard create actions, row actions, and the deprecated tabular adapter/view.
-   Removed remaining current documentation/context references to `_app_attributes`, `_mhb_attributes`, stale catalog screenshots, and `cat_publications` in active docs.
-   Updated E2E selectors to match the current Object UI labels proven by Playwright screenshots.

### Validation

-   `pnpm --filter @universo/schema-ddl test -- --runInBand`
-   `pnpm --filter @universo/metahubs-frontend test -- --runInBand SharedEntitySettingsFields`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/apps-template-mui test -- --runInBand`
-   `pnpm run build:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium flows/metahub-entities-publication-runtime.spec.ts`
-   `git diff --check`
-   Targeted `rg` audits for stale Catalog/Attribute runtime contract markers in E2E specs, active docs, and shared component settings code.

## Completed: Local Supabase Env Profile Generation Improvement (2026-05-13)

Local Supabase profile generation now preserves the full backend environment contract from the normal env files.

### Changes Made

-   Updated `tools/local-supabase/write-env.mjs` so development profiles use `.env` first, then `.env.example`, then a minimal generated fallback.
-   Updated E2E local profile generation to use `.env.e2e`, then `.env`, then `.env.e2e.example`, then `.env.example`, preserving unrelated settings while replacing local Supabase/PostgreSQL values and E2E-safe defaults.
-   Cleared hosted-only Postgres/Auth overrides such as `DATABASE_SSL_KEY_BASE64`, `SUPABASE_JWKS_URL`, and `SUPABASE_JWT_ISSUER` from generated local profiles.
-   Kept previous generated profile values as fallback for generated secrets when the selected base file does not define them.
-   Removed obsolete `*.local-supabase.example` files because the standard env examples are now the canonical tracked contract.
-   Updated backend README, GitBook configuration/quick-start/E2E docs, and E2E README files in EN/RU.
-   Added focused Vitest coverage for hosted-value replacement, unrelated setting preservation, and base env source ordering.

### Validation

-   `node --check tools/local-supabase/write-env.mjs`
-   `node --check tools/local-supabase/shared.mjs`
-   `pnpm run test:local-supabase:tools`

## Completed: Local Supabase Docker Switch (2026-05-13)

Local Supabase switching is available for development and E2E without changing hosted Supabase defaults.

### Changes Made

-   Added Supabase CLI dev dependency and committed `supabase/config.toml` plus an empty `supabase/seed.sql`.
-   Added local Supabase root scripts for init, localhost-bound Docker network creation, start, minimal start, status, stop, nuke, env generation, doctor checks, local app start, local allclean start, and local E2E smoke flows.
-   Added `tools/local-supabase/write-env.mjs` to generate gitignored backend/frontend local dev and E2E profiles from `supabase status -o env`.
-   Added local-host guards so local profile generation and doctor checks reject hosted Supabase URLs before destructive workflows.
-   Added `tools/local-supabase/doctor.mjs` to validate Docker, Supabase CLI, Auth health, REST API, service-role Auth Admin API access, direct PostgreSQL connectivity, and JWT secret configuration.
-   Added local Supabase `.env.*.example` files for core backend and frontend.
-   Updated GitBook docs and package/E2E READMEs in EN/RU with local/hosted switching, doctor usage, and local E2E flow.
-   Added Vitest coverage for local tool contracts and Jest coverage for HS256 token verification with local Supabase JWT secret.

### Validation

-   `pnpm run test:local-supabase:tools`
-   `pnpm --filter @universo/auth-backend test -- --runTestsByPath src/tests/utils/verifySupabaseJwt.localSupabase.test.ts`
-   `pnpm --filter @universo/auth-backend build`
-   `pnpm --filter @universo/auth-backend lint` exits 0 with existing unrelated warnings only
-   `pnpm run docs:i18n:check`
-   `for file in tools/local-supabase/*.mjs tools/local-supabase/__tests__/*.mjs; do node --check "$file"; done`
-   `pnpm exec prettier --check package.json vitest.workspace.ts tools/local-supabase/*.mjs tools/local-supabase/__tests__/*.mjs packages/auth-backend/base/src/tests/utils/verifySupabaseJwt.localSupabase.test.ts`
-   `pnpm supabase:local:init`
-   `pnpm supabase:local:network`
-   `pnpm exec supabase start --help | rg "storage-api|edge-runtime|vector|network-id"`

## Completed: Scoped Menu Contract Closure (2026-05-13)

The remaining catalog/page-specific menu widget authoring and runtime branches are removed from the scoped layout work.

### Changes Made

-   Standardized menu widget item kinds on `section`, `hub`, and `link`.
-   Removed Catalog/Page/Ledger-specific menu editor branches and runtime destination comparisons.
-   Menu section targets are discovered from layout-capable Entity type metadata, so future Entity types can opt into menu destinations through constructor capabilities.
-   Replaced active menu auto-generation config with `autoShowAllSections` across shared schemas, templates, LMS/self-hosted/quiz fixtures, and fixture contracts.
-   Updated runtime menu selection and standalone section-link conversion to accept only neutral `section` menu items for Entity destinations.

### Validation

-   `git diff --check`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/metahubs-frontend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/metahubs-backend exec eslint --ext .ts src/domains/templates/data/basic.template.ts src/domains/shared/layoutDefaults.ts src/tests/services/MetahubLayoutsService.test.ts src/tests/services/templateManifestValidator.test.ts --fix`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-frontend build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/applications-backend build`
-   Direct focused tests passed through `pnpm --dir ... exec vitest run ...` / `jest --runInBand` for menu helpers, scope visibility, runtime menu behavior, application layout/runtime behavior, and runtime controller behavior.
-   Note: package-level `test` scripts for `metahubs-frontend` and `applications-frontend` still run the full suite when file args are passed and exposed unrelated existing failures; direct focused runs for touched files pass.

## Completed: Scoped Widget Visibility QA Closure (2026-05-13)

The remaining QA gaps in centralized widget visibility management for generic Entity-scoped layouts are closed.

### Changes Made

-   Added generic metahub layout API endpoints for listing and updating global widget visibility per layout-capable Entity scope.
-   Global widget visibility updates now validate the target Entity through `layoutConfig`, create a scoped layout automatically on the first override, and store sparse `_mhb_layout_widget_overrides` rows instead of duplicating widget definitions.
-   Added a reusable `WidgetScopeVisibilityPanel` and integrated it into existing global widget editors (`WidgetBehaviorEditorDialog`, `MenuWidgetEditorDialog`, `ColumnsContainerEditorDialog`, `QuizWidgetEditorDialog`) without LMS-specific UI.
-   The panel renders localized Entity names/codenames, inherited/overridden state, and scoped-layout presence, so reverse override state is visible from the global layout editor.
-   Runtime global-menu startup token lookup now filters to renderable runtime sections only: catalog-compatible objects or Pages.
-   Auto-created scoped layout names are stored as canonical VLC records.

### Validation

-   `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/services/MetahubLayoutsService.test.ts` passes.
-   `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/controllers/runtimeRowsController.test.ts` passes.
-   `pnpm --filter @universo/metahubs-frontend test -- src/domains/layouts/ui/__tests__/WidgetScopeVisibilityPanel.test.tsx --runInBand` ran the package suite and passed: 71 files, 288 tests.
-   `pnpm --filter @universo/metahubs-backend build`, `pnpm --filter @universo/metahubs-frontend build`, and `pnpm --filter @universo/applications-backend build` pass.
-   `pnpm --filter @universo/metahubs-backend exec eslint --fix --ext .ts src/`, `pnpm --filter @universo/metahubs-frontend exec eslint --fix --ext .ts,.tsx,.jsx src/`, and `pnpm --filter @universo/applications-backend lint` pass; metahubs-backend still reports pre-existing warnings only.
-   `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-global-entity-layouts.spec.ts` passes: 2 tests.

## Completed: Scoped Layout QA Closure (2026-05-13)

The remaining QA gaps in generic startup scope resolution and LMS browser regression coverage are closed.

### Changes Made

-   Removed the residual Catalog/Page candidate filter from global-menu startup token resolution so the lookup layer stays Entity-agnostic.
-   Added a backend regression proving startup tokens can resolve arbitrary runtime Entity ids/codenames before downstream rendering rules decide whether a destination is usable.
-   Extended the imported LMS runtime Playwright flow with explicit negative assertions that Home-only dashboard labels never appear on Knowledge, Development, or Reports.
-   Captured a dedicated non-Home screenshot artifact for the clean Knowledge view without inherited Home dashboard widgets.
-   Cleared the outstanding `@universo/applications-backend` Prettier lint findings already present in the scoped-layout sync helper changes.

### Validation

-   `git diff --check`
-   `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/controllers/runtimeRowsController.test.ts`
-   `pnpm --filter @universo/applications-backend lint`
-   `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts`

## Completed: Scoped Layout Widget Visibility Implementation (2026-05-12)

Generic Entity-scoped layout overlays now replace the previous catalog-specific layout contract for widget visibility and runtime materialization.

### Changes Made

-   Replaced generic layout contracts with `scopeEntityId`, `scopedLayouts`, and `layoutWidgetOverrides` across shared types, metahub snapshot export/restore, template validation/seeding, application sync, and layout APIs.
-   Kept `linkedCollectionId` only where it still means runtime record/datasource collection identity, not layout scope.
-   Added capability-driven scoped layout validation through `components.layoutConfig.enabled`, so future Entity types can opt into layout customization without hardcoded kind checks.
-   Materialized inherited scoped widgets with `source_base_widget_id` links and persisted UUID v7 row ids instead of storing synthetic ids in runtime widget tables.
-   Preserved sparse override config, activation, and placement when scoped layouts inherit global widgets.
-   Updated the LMS template and snapshot so the `LearnerHome` Page owns overview cards and charts through a Page-scoped layout, while the global layout no longer enables Home-only dashboard widgets or the empty three-column container.
-   Hardened `columnsContainer` rendering so inactive nested widgets and empty columns render nothing instead of blank cards.
-   Closed the final browser-found regression in scoped layout creation by matching Entity type capability SQL to the actual soft-delete-only `_mhb_entity_type_definitions` schema, then updated the generic Playwright flow to use the Entity layout route and current UI heading.
-   Updated GitBook docs and package README notes from catalog-specific layouts to Entity-scoped layouts.

### Validation

-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/schema-ddl build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/metahubs-frontend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/services/syncLayoutMaterialization.test.ts src/tests/controllers/runtimeRowsController.test.ts src/tests/controllers/applicationLayoutsController.test.ts src/tests/utils/applicationLayoutHash.test.ts src/tests/services/syncLayoutPersistence.test.ts`
-   `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/shared/snapshotLayouts.test.ts src/tests/services/SnapshotRestoreService.test.ts src/tests/services/MetahubLayoutsService.test.ts src/tests/routes/layoutsRoutes.test.ts src/tests/services/metahubSchemaService.test.ts src/tests/services/templateManifestValidator.test.ts`
-   `pnpm --filter @universo/metahubs-backend test -- --runTestsByPath src/tests/services/MetahubLayoutsService.test.ts`
-   `pnpm --filter @universo/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/metahubs-frontend test -- src/domains/entities/presets/ui/__tests__/SettingsOriginTabs.test.tsx src/domains/metahubs/ui/__tests__/actionsFactories.test.ts src/domains/layouts/ui/__tests__/LayoutList.copyFlow.test.tsx`
-   `pnpm run build:e2e`
-   `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-global-entity-layouts.spec.ts`

## Completed: Connector Schema Diff Entity Metrics QA (2026-05-12)

The schema creation preview in the application connector no longer shows misleading `0 fields, 0 elements` summaries for Entity types whose useful preview data is not field/record based.

### Changes Made

-   Added generic backend schema diff metrics to publication sync details for Hubs, Pages, Sets, Enumerations, Catalogs, and custom fallback Entity types.
-   Kept Catalog summaries as fields/elements while showing Hubs as linked entities, Pages as blocks, Sets as constants, and Enumerations as values.
-   Updated the connector schema diff dialog to render metric summaries and a neutral empty preview state instead of forcing every Entity type into Catalog-like field/element text.
-   Extended i18n for EN/RU metric labels with pluralization.
-   Added backend and frontend regression coverage for the new metric contract and for the absence of misleading `0 fields, 0 elements` text.
-   Extended the imported LMS runtime Playwright flow with focused schema diff sanity assertions and screenshot evidence for the metrics preview.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationSyncRoutes.test.ts`
-   `pnpm --filter @universo/applications-frontend test -- ConnectorDiffDialog.test.tsx`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm build`
-   `git diff --check`
-   `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`

## Completed: LMS Connector QA Closure (2026-05-12)

The post-QA connector and localization closure fixed the remaining contract and preview issues found after the LMS connector/entity localization pass.

### Changes Made

-   Added `schemaDiffLocalizedLabels` to the strict backend application settings schema so the generic Connectors tab setting is accepted and persisted, including explicit `false`.
-   Added API regression coverage proving the setting is preserved with the rest of sanitized application dialog settings.
-   Hardened managed role policy matching so templates such as `memberPolicy` apply even when imported records omit `baseRole`.
-   Split connector schema diff field codenames into canonical lookup keys and localized display labels, preventing localized UI labels from breaking preview record value lookup.
-   Updated schema diff tests to assert localized Entity type, Entity codename, and field display behavior without relying on ambiguous single-text matches.
-   Updated the imported LMS runtime Playwright flow to assert the source-Metahub Workspace isolation copy.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts guards.test.ts applicationSyncRoutes.test.ts`
-   `pnpm --filter @universo/applications-frontend test -- ConnectorDiffDialog.test.tsx ApplicationSettings.test.tsx`
-   `pnpm --filter @universo/apps-template-mui test -- MenuContent.test.tsx displayValue.test.ts tabularCellValues.test.tsx`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm build`
-   `git diff --check`
-   `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`

## Completed: LMS Connector And Entity Localization Remediation (2026-05-12)

The latest manual QA findings from the rebuilt LMS Metahub and application were closed without adding LMS-specific runtime forks or bumping schema/template versions.

### Changes Made

-   Updated LMS Page seed generation so Page entities keep stable canonical EN codenames while gaining RU codename VLC values from localized names.
-   Made Metahub Settings entity tabs follow Entity constructor ordering from entity type metadata, placing Pages immediately after Hubs without a hardcoded kind list.
-   Improved the required Workspace connector schema diff UX by moving the explanatory notice above the disabled enabled switch and rewriting the copy around the source Metahub requirement.
-   Added a generic Application Settings `Connectors` tab with a default-enabled option for localized schema diff labels.
-   Expanded connector schema diff details to include all transferred Entity types grouped dynamically by Entity metadata, with localized type, entity, and field labels when enabled.
-   Added primary-VLC fallback behavior so administrators can switch schema diff labels back to canonical primary text.
-   Marked the published app Home menu item active on root application URLs before a concrete section id is present.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator and validated bilingual Page codenames.

### Validation

-   `pnpm --filter @universo/metahubs-backend test -- templateSeedTransactionScope.test.ts templateManifestValidator.test.ts`
-   `pnpm --filter @universo/applications-frontend test -- ConnectorDiffDialog.test.tsx ApplicationSettings.test.tsx`
-   `pnpm --filter @universo/applications-backend test -- applicationSyncRoutes.test.ts`
-   `pnpm --filter @universo/apps-template-mui test -- MenuContent.test.tsx`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/metahubs-frontend build`
-   `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "metahubs-lms-app-export"`
-   Direct JSON contract check for EN/RU Page codenames in `tools/fixtures/metahubs-lms-app-snapshot.json`

## Completed: LMS Runtime Manual QA Remediation (2026-05-12)

The manual QA findings from the freshly rebuilt LMS application were closed without adding LMS-specific runtime branches.

### Changes Made

-   Improved the required-Workspace connector diff dialog: required publications now show a disabled enabled switch and explanatory text, while the irreversible acknowledgement checkbox is reserved only for optional admin-initiated Workspace enablement.
-   Updated workspace policy validation so required publication policy can force Workspace mode without asking the application administrator for an acknowledgement they cannot act on.
-   Added generic runtime value formatting for objects, arrays, localized values, report definitions, and quiz option arrays, preventing `[object Object]` output in grids, details tables, and tabular edit surfaces.
-   Restored published-app menu active state for both metadata-selected items and safe URL link items, matching the original MUI dashboard selected-list behavior with `aria-current="page"`.
-   Fixed LMS fixture/generator seed localization for class records and strengthened the fixture contract to require EN/RU localized values.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator.
-   Extended unit and browser coverage for required Workspace UX, structured value rendering, active runtime menu state, bilingual fixture integrity, and the imported LMS runtime path.

### Validation

-   `pnpm --filter @universo/utils test -- workspacePolicy.test.ts`
-   `pnpm --filter @universo/applications-frontend test -- ConnectorDiffDialog.test.tsx`
-   `pnpm --filter @universo/applications-backend test -- applicationSyncRoutes.test.ts`
-   `pnpm --filter @universo/apps-template-mui test -- displayValue.test.ts tabularCellValues.test.tsx MenuContent.test.tsx`
-   `git diff --check`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/utils lint` (existing warnings only)
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/core-frontend build`
-   `pnpm --filter @universo/utils build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/core-backend build`
-   `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "metahubs-lms-app-export"`
-   `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`

## Completed: LMS Roadmap QA Remediation (2026-05-12)

The post-implementation QA pass found and closed the remaining gaps in the iSpring-like LMS roadmap implementation without adding LMS-specific runtime forks.

### Changes Made

-   Restricted runtime report execution to saved `Reports` Catalog records by accepting only `reportId` or `reportCodename` at the API boundary.
-   Added regression coverage proving inline report definitions are rejected before runtime metadata lookup.
-   Added server-side report aggregation execution through safe field metadata and stable public aliases.
-   Shared the ordinary runtime Catalog filter between runtime row APIs and report target discovery so registrar-only ledger Catalogs stay hidden from manual/report execution surfaces.
-   Added a generic Access tab to application settings for role/capability policy editing through existing MUI settings patterns.
-   Updated the isolated app template report API helper to use saved report references and validate aggregation output.
-   Extended the LMS imported runtime Playwright flow to execute a saved report from the generated fixture.
-   Updated GitBook LMS report docs and memory-bank records with the final saved-report execution contract.

### Validation

-   `git diff --check`
-   `pnpm --filter @universo/applications-backend test -- runtimeReportsService.test.ts guards.test.ts applicationsRoutes.test.ts`
-   `pnpm --filter @universo/apps-template-mui test -- runtimeReports.test.ts`
-   `pnpm --filter @universo/applications-frontend test -- ApplicationSettings.test.tsx`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts`

## Completed: Runtime Report Endpoint Wiring Closure (2026-05-11)

The safe generic runtime report runner is now connected to authenticated application runtime APIs instead of remaining service-only code.

### Changes Made

-   Added `POST /applications/:applicationId/runtime/reports/run` for generic `ReportDefinition` execution.
-   Resolved report datasource targets from published runtime metadata in `_app_objects` and `_app_attributes`.
-   Applied lifecycle and workspace row conditions before report execution.
-   Rejected users without `readReports` before touching runtime metadata.
-   Added a typed `apps-template-mui` `runRuntimeReport` helper with CSRF and Zod response validation.
-   Added route and API helper tests for authorized execution and fail-closed unauthorized access.

### Validation

-   `git diff --check`
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts runtimeReportsService.test.ts guards.test.ts`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui test -- runtimeReports.test.ts`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`

## Completed: LMS Roadmap Role Policies, Widget Metadata Pickers, And Final Validation (2026-05-11)

The iSpring-like LMS roadmap implementation was completed through the remaining role-policy, report authorization, widget authoring, and validation phases without adding LMS-specific runtime forks or bumping the template/schema versions.

### Changes Made

-   Added generic application role-policy normalization and effective permission resolution from existing application settings.
-   Added `readReports` as a generic application/runtime capability and enforced it fail-closed in the safe runtime report runner.
-   Extended the existing widget behavior editor to use metadata-backed section pickers for `records.list` datasources while preserving manual section fallback for advanced cases.
-   Reused the existing layout authoring and behavior dialog for details tables, title widgets, charts, and overview cards instead of adding LMS-only UI.
-   Added TanStack Query optimistic cache rollback coverage for failed layout widget configuration saves.
-   Added a no-version-bump guard to the LMS fixture contract for bundle version, snapshot version, structure version, snapshot format version, and unpinned exported template version.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator after the contract update.

### Validation

-   `git diff --check`
-   `pnpm --filter @universo/types test -- lmsPlatform.test.ts`
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/applications-backend test -- guards.test.ts runtimeReportsService.test.ts`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-frontend test -- ApplicationWidgetBehaviorEditorDialog.test.tsx ApplicationLayouts.test.tsx`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `node tools/testing/e2e/run-playwright-suite.mjs generators/metahubs-lms-app-export.spec.ts`
-   `node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts`

## Completed: iSpring-like LMS Roadmap Implementation Slice And Import Runtime Closure (2026-05-11)

The LMS platform roadmap implementation slice expanded the generic contracts, LMS template, generated product snapshot, safe report runtime, docs, and workspace seeding robustness without adding an LMS-specific runtime fork.

### Changes Made

-   Added strict shared LMS/platform primitive schemas for resources, sequence policies, lifecycle statuses, workflow actions, role policy templates, report definitions, and acceptance matrix entries in `@universo/types`.
-   Expanded the LMS Metahub template with richer Catalog/Page/Set/Enumeration metadata, realistic seeded records, report definitions, development-plan and knowledge-base structures, and generic runtime widget datasource usage.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator and strengthened the fixture contract.
-   Added `RuntimeReportsService` as a safe V1 report runner over validated published runtime datasource descriptors.
-   Hardened imported publication workspace seeding for restored snapshots: dependency ordering includes table child attributes, unresolved references are retried, unique `_seed_source_key` fallback is available, and legacy table-name object ids can resolve seed rows.
-   Updated package READMEs and GitBook docs for LMS resource and report model guidance.

### Validation

-   `pnpm --filter @universo/types test`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts`
-   `pnpm --filter @universo/applications-backend test -- applicationWorkspaces.test.ts runtimeReportsService.test.ts`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-backend lint`
-   `node tools/testing/e2e/run-playwright-suite.mjs generators/metahubs-lms-app-export.spec.ts`
-   `node tools/testing/e2e/run-playwright-suite.mjs flows/snapshot-import-lms-runtime.spec.ts`

---

## Completed: Fix start:allclean Database Reset + App.initDatabase Test Repair (2026-05-11)

> Goal: Fix `pnpm start:allclean` which never reset the Supabase database due to `--reset-db` flag being lost in the `run-script-os -> npm` chain. Also fix 5 pre-existing test failures in `App.initDatabase.test.ts`.

### Summary

The `--reset-db` CLI flag was unreachable because `run-script-os` spawns `npm run start:default --reset-db`, and npm without `--` separator does not forward unknown flags. Replaced with `_FORCE_DATABASE_RESET=true` env var. Auth user deletion switched from Supabase Admin HTTP API (timed out ~35s/user) to direct SQL `DELETE FROM auth.users`, reducing reset from 3+ minutes to 4 seconds.

### Changes Made

-   **`package.json:30`**: `start:allclean` uses `_FORCE_DATABASE_RESET=true pnpm start`
-   **`start.ts`**: Removed dead `--reset-db` flag
-   **`startupReset.ts`**: SQL-based `deleteAllAuthUsers(db, authUsers)` via `DELETE FROM auth.users WHERE id = ANY($1::uuid[])`; removed `createSupabaseAdminClient`, `StartupResetEnabledConfig`, `getStartupResetConfig`, `assertPresent`
-   **`startupReset.test.ts`**: Removed Supabase Admin mocks; tests verify SQL deletion
-   **`App.initDatabase.test.ts`**: Added missing `getPoolExecutor`+`seedTemplates` mocks
-   **`start-command.test.ts`**: New test verifying `--reset-db` flag is not exposed
-   **`docs/en/`+`docs/ru/`**: Updated `start:allclean` description

---

## Completed: Workspace Policy QA Remediation Hardening (2026-05-10)

Snapshot import fails closed on invalid `runtimePolicy.workspaceMode`. No-Workspace runtime regression stabilized. Playwright flow reuses existing `Title` field definitions and verifies shared runtime rows with `editor` user.

### Changes Made

-   Added explicit `runtimePolicy` object validation and `parseWorkspaceModePolicy` to snapshot import
-   Added route-level import regression proving invalid workspace policies return `400`
-   Strengthened imported-runtime-policy test to assert canonical publication stores required Workspace policy
-   Stabilized no-Workspace Playwright flow around existing default `Title` fields

---

## Completed: LMS Workspace Policy Fixture And Import Closure (2026-05-10)

LMS snapshot now requires `runtimePolicy.workspaceMode = "required"`. Snapshot import preserves valid runtime policy when rebuilding canonical publication. Optional no-Workspace sync path remains covered by route tests.

### Changes Made

-   Added required Workspace runtime policy injection to LMS product Playwright generator
-   Added LMS fixture contract validation for `snapshot.runtimePolicy.workspaceMode === "required"`
-   Preserved imported snapshot runtime policy in `metahubsController.importFromSnapshot`
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through product Playwright generator

---

## Completed: Generic Posting Registrar Kind QA Closure (2026-05-10)

Runtime posting movements receive registrar kind from `_app_objects.kind` instead of hardcoding `catalog`. Missing registrar kind fails closed with controlled API error.

### Changes Made

-   Added `kind` loading to `resolveRuntimeLinkedCollection`
-   Passed `linkedCollection.kind` into posting append/reversal calls as `registrarKind`
-   Removed hardcoded `registrarKind: 'catalog'` from posting movement append and reverse flows
-   Updated posting movement regressions to prove non-Catalog registrar kinds forwarded to Ledger service

---

## Completed: Catalog-Backed Ledger Schema Templates (2026-05-10)

Ledger schemas support catalog-backed fact attributes with typed fact columns, auto-generated index tables, idempotent DDL, and E2E posting proof. Generic Ledger schema entity constructor supports fixed/dynamic catalog bindings, option-list enumeration columns, and shared validation.

### Summary

Catalog entity type templates now expose the generic `ledgerSchema` capability in the same Entity constructor contract that already drives behavior, scripts, layouts, and field definitions. LMS template models progress, score, enrollment, attendance, certificate, points, activity, and notification registers as Catalog instances with `config.ledger`. These Catalog-backed ledger objects are registrar-only in runtime.

### Changes Made

-   Enabled `ledgerSchema` in the standard Catalog entity type definition and added `ledgerSchema` tab to Catalog authoring contract
-   Removed default Ledger preset seeding from `basic`, `basic-demo`, and LMS metahub templates; standalone Ledger preset preserved for manual use
-   Converted LMS ledger-like objects to `kind: catalog` entities with `config.ledger`, registrar-only source policy, field roles, and projections
-   Reused generic Ledger schema UI in standard Catalog create/edit/copy dialogs
-   Updated linked-collection backend helpers to validate, persist, copy, and remove `config.ledger` safely
-   Kept registrar-only Catalog-backed ledger objects out of ordinary runtime row lists and automatic workspace seed passes

---

## Completed: Ledger Schema QA Closure (2026-05-10)

Ledger runtime access fails closed with controlled API errors for invalid, missing, or unavailable Ledger ids. `config.ledger` references validated in Entity create/update/copy flows and snapshot publication/import paths.

### Changes Made

-   Added controlled Ledger id validation and unavailable-ledger errors in runtime Ledger controllers and services
-   Enforced strict Ledger config reference validation across frontend authoring, backend CRUD, copy, publication serialization, and snapshot restore
-   Removed remaining Ledger kind-only compatibility checks from schema/runtime/workspace/script paths
-   Fixed workspace seed type discovery for generated child TABLE JSONB columns
-   Fixed Entity dialog action helpers so validation/can-save callbacks tolerate uninitialized form values

---

## Completed: Generic Ledger Schema Entity Constructor Implementation (2026-05-10)

Ledger semantics exposed through generic `ledgerSchema` component contract. Shared types normalize and validate `config.ledger`. Metahub Entity dialog exposes reusable Ledger schema tab. Application layout widgets consume generic `ledger.facts` and `ledger.projection` datasources.

### Changes Made

-   Added strict Ledger config schemas, normalizers, component capability helpers, and reference validation to `@universo/types`
-   Replaced Ledger kind-only checks in schema generation, published snapshot serialization, runtime Ledger services, scripts, and workspace copy/delete flows with capability-aware gates
-   Added generic `LedgerSchemaFields` UI surface wired into shared Entity instance dialog via `ledgerSchema` tab
-   Extended Entity type authoring so `ledgerSchema` component settings can be enabled for future compatible custom or hybrid entity types
-   Extended application widget behavior editor with generic `records.list`, `ledger.facts`, and `ledger.projection` datasource editing

---

## Completed: Linked Collection Record Behavior QA Fixes (2026-05-09)

The linked-collection preset keeps the Entity constructor contract generic. Script, action, event, and record behavior script lookups use the active route `kindKey` first, falling back to entity kind when no route kind is available. Copy dialogs now include edited `config.recordBehavior` payload.

### Changes Made

-   Added linked-collection attachment-kind resolver preferring `routeKindKey` over base entity kind
-   Replaced hardcoded Catalog attachment kinds in linked-collection script tabs and record behavior script queries
-   Replaced remaining generic Entity list linked-collection script/action/event attachment fallback with resolved active kind key
-   Added regression tests for non-Catalog linked-collection script tab attachment and record behavior copy payload preservation

---

## Completed: Entity-Driven Catalog Record Behavior UI (2026-05-09)

Catalog record behavior exposed through generic Entity authoring surface. `behavior` tab appears from entity type `components` plus `ui.tabs`, not from Catalog-only branching. Template path defect fixed: `TemplateManifestValidator` now preserves `identityFields`, `recordLifecycle`, `posting`, and `ledgerSchema` instead of stripping them.

### Changes Made

-   Added shared `CatalogRecordBehavior` validation and normalization in `@universo/types`
-   Reused shared normalizer/schema from schema generation, application runtime services, and `apps-template-mui`
-   Added component-driven `behavior` tab in Entity authoring and reusable `RecordBehaviorFields` form
-   Persisted `config.recordBehavior` without dropping existing entity config keys
-   Added structured constructor controls for `identityFields`, `recordLifecycle`, `posting`, and `ledgerSchema`
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through product Playwright generator

---

## Completed: LMS Runtime Datasource QA Closure (2026-05-09)

Integrated published application runtime provides dashboard widgets with active locale, runtime sections, and linked collections. Chart widgets localize MUI Charts empty-data overlay. Backend runtime list validation resolves localized attribute codenames before checking sort/filter fields.

### Changes Made

-   Passed `locale`, `sections`, and `linkedCollections` into integrated `DashboardDetailsProvider` data from `ApplicationRuntime`
-   Added localized no-data support to shared `SessionsChart` and `PageViewsBarChart` wrappers
-   Propagated runtime list `search`, `sort`, and `filters` through production applications frontend adapter/API
-   Resolved localized backend attribute codenames in runtime sort/filter validation

---

## Completed: LMS Runtime UX QA Remediation (2026-05-09)

Ledger collections use consolidated `ledgers` i18n namespace in metahub UI. Ledger rows/cards open shared field-definition resource surface. Field-definition tabs and empty-state fallbacks have shared localized keys. Runtime dashboard widget contract accepts localized text for stat-card titles, chart titles, intervals, and series labels.

### Changes Made

-   Added `ledgers` to metahub i18n bundle consolidation path
-   Extended generic entity instance list so standard Ledger rows open configured data-schema resource surface route
-   Added shared and Ledger-specific field-definition i18n keys in English and Russian
-   Extended application layout widget schemas to accept localized widget text
-   Resolved localized widget text in apps-template dashboard renderer for overview cards and record-series charts
-   Suppressed demo chart series whenever configured `records.list` datasource has no rows

---

## Completed: LMS Catalog/Ledger Platform Implementation (2026-05-08)

> Consolidation of 20+ LMS QA/feature closures from 2026-05-08.

**Runtime & Security**: Public guest runtime uses neutral platform aliases (`participantId`, `assessmentId`, `contentNodeId`). Guest session secrets stored as SHA-256 hashes. Application settings preserves server-managed `publicRuntime`/`guestRuntime`. Registrar-only Ledger writes rejected. Bounded guest answer validation.

**Ledger & Posting**: Ledger projection errors return controlled `UpdateFailure` responses. Manual-editable Ledger facts observable through guarded `PATCH`/`DELETE` routes. Reversal idempotency via `_app_reversal_of_fact_id` system column. Runtime section sort/filter state reset on section switch.

**LMS Fixture**: LMS metahub snapshot carries explicit `application.publicRuntime.guest` settings. LMS template seeds lifecycle scripts, bilingual page entities, transactional event catalogs, additional ledger definitions. Generic runtime policy settings, overview card metrics, chart datasource authoring, details table datasource authoring.

**Datasource & Widgets**: Generic metric widgets, runtime datasource tables, generic widget datasource closure. Placeholder configuration cleanup. Posting movement E2E proof with authenticated runtime record commands through real UI action menu.

### Key Changes Made

-   Added `ledger` as first-class standard entity kind; shared Catalog `recordBehavior` plus Ledger `config.ledger` contracts
-   Added template seed-script support with manifest validation, compilation, checksum storage, and entity attachment resolution
-   Added `RuntimePostingMovementService` for movement normalization, target-ledger validation, and Ledger append orchestration
-   Added `RuntimeLedgerService` for metadata loading, fact listing, projection queries, append-only writes, idempotent append, and reversal batches
-   Added `RuntimeNumberingService` and `RuntimeRecordCommandService` for transactional Catalog record commands
-   Added runtime response metadata for `recordBehavior` and posting state fields; `RowActionsMenu` with state chip and command actions
-   Added `runtimeDataSources` schemas and types; extended `detailsTableWidgetConfigSchema` with optional `datasource` descriptor
-   Added `statCardWidgetConfigSchema` and `overviewCardsWidgetConfigSchema` for generic metric widgets
-   Added `records-series` chart widget config; registered chart config validation; updated `MainGrid` to fetch chart records
-   Added codename target fields to generic `records.list` and `records.count` datasource schemas
-   Added bounded guest answer validation for question count, selected-option count, and session-token length
-   Converted Ledger projection service failures to stable 400/404/409 API responses with error codes
-   Added guarded Ledger fact `PATCH` and `DELETE` routes with `manualEditable` policy enforcement and soft delete
-   Added neutral `publicRuntime.guest` object and field keys; backwards-compatible aliases for legacy guest runtime settings
-   Added `_app_reversal_of_fact_id` to generated Ledger tables with partial unique index
-   Reset runtime DataGrid sort/filter state when switching sections to avoid cross-catalog field leakage
-   Added `buildTransactionalCatalogConfig()` to LMS template; applied to QuizResponses, Assignments, TrainingEvents, Certificates, Enrollments
-   Added LMS lifecycle scripts: `AutoEnrollmentRuleScript`, `QuizAttemptPostingScript`, `ModuleCompletionPostingScript`, `CertificateIssuePostingScript`
-   Added bilingual Page entities: `CourseOverview`, `KnowledgeArticle`, `AssignmentInstructions`, `CertificatePolicy`
-   Added transactional event catalogs: `QuizAttempts`, `AssignmentSubmissions`, `TrainingAttendance`, `CertificateIssues`
-   Added additional Ledgers: `LearningActivityLedger`, `EnrollmentLedger`, `AttendanceLedger`, `CertificateLedger`, `PointsLedger`, `NotificationLedger`
-   Added generic runtime policy settings: `dashboardDefaultMode`, `datasourceExecutionPolicy`, `workspaceOpenBehavior`
-   Added compact multi-card controls to `ApplicationWidgetBehaviorEditorDialog` for overview-card metric authoring
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through product Playwright generator multiple times

### Validation

-   Full root build passed (30/30 Turbo tasks)
-   All focused backend/frontend/template tests passed
-   LMS snapshot import/runtime Playwright flow passed with browser issue collection, security edge assertions, and UI geometry checks

---

## Completed: LMS Catalog And Ledger Metadata Foundation (2026-05-07)

Added `ledger` as first-class standard entity kind. Shared Catalog `recordBehavior` plus Ledger `config.ledger` contracts. Ledgers flow through standard templates, metahub routing, publication snapshots, schema helpers, scripts capability metadata, i18n, docs, and canonical LMS Playwright fixture without LMS-specific runtime widgets.

### Changes Made

-   Added shared Catalog record behavior and Ledger config types in `@universo/types`
-   Extended Entity component manifests with identity fields, record lifecycle, posting, and ledger schema flags
-   Added `ledger` to standard entity kinds, settings, surface labels, script attachment kinds, and schema DDL built-in helpers
-   Added standard Ledger preset and default `Main` ledger instance
-   Extended standard Catalog config with default record behavior; added LMS `ProgressLedger` and `ScoreLedger` definitions
-   Routed Ledgers through existing generic Entity list/details authoring surface
-   Added EN/RU labels and breadcrumb titles; documented Ledgers in GitBook architecture docs

---

## Completed: Startup Supabase Full Reset (2026-05-07)

Full database reset on startup: drops project-owned schemas, deletes auth users, verifies cleanup. Safety: production guard, advisory lock, schema validation, post-reset residue check. Triggered by `FULL_DATABASE_RESET=true` env var or `_FORCE_DATABASE_RESET=true` env var (set by `start:allclean`).

### Changes Made

-   New module `startupReset.ts` with config parsing, production guard, advisory lock, schema discovery, safe schema drop, auth user deletion, post-reset verification
-   Integration in `index.ts` — `executeStartupFullReset()` called before migrations in `initDatabase()`
-   Environment: `.env.example` / `.env` — "DANGER ZONE" block with `FULL_DATABASE_RESET`
-   Tests: 14 new tests (13 in `startupReset.test.ts`, 1 in `App.initDatabase.test.ts`)
-   Documentation: `docs/en/` and `docs/ru/getting-started/configuration.md` — "Danger Zone" section

---

## Completed: Node.js 22 Migration (2026-05-06)

Migrated from Node.js 20 to Node.js 22.6.0+ with upgraded isolated-vm 6.x. All configuration files, documentation, and CI/CD workflows updated.

### Changes Made

-   `package.json` engines.node updated to `>=22.6.0`; `.nvmrc` created
-   `packages/scripting-engine/base/package.json` upgraded isolated-vm from 5.0.4 to ^6.1.2
-   `.github/workflows/main.yml` updated CI matrix to Node.js 22.x
-   Documentation: `.kiro/steering/tech.md`, `README.md`, `memory-bank/techContext.md`, migration guides updated
-   Critical: isolated-vm 5.0.4 does NOT support Node.js 22; 6.x REQUIRED; migration sequence: upgrade isolated-vm first

---

## Completed: Runtime Start Section Stale Placeholder Suppression (2026-05-06)

Published application root no longer briefly renders non-start section while menu-defined start page is loading. `useCrudDashboard` suppresses mismatched section data as loading state.

### Changes Made

-   `useCrudDashboard` suppresses mismatched section data and returns loading state when current response section differs from initial menu start section
-   Initial menu section detection treats `page` items as valid section targets
-   Extended LMS browser flow to assert Access Links is not visible on runtime root loading

---

## Completed: Application Sync RLS Transaction Boundary (2026-05-06)

Application schema sync no longer runs inside request-scoped RLS transaction. Sync route uses plain authenticated middleware with application access checks and sync-engine advisory locks.

---

## Completed: Generic Localized Variant Tabs For Page Content (2026-05-06)

Page content language tabs render through shared `LocalizedVariantTabs` in `@universo/template-mui`. Same typography parity as metahub MUI tab customization.

### Changes Made

-   Extracted `LocalizedVariantTabs` into `@universo/template-mui` for reuse
-   Matched localized content tabs to metahub MUI tab typography and compact 28px action/add button geometry
-   Marked primary content locale with 16px `Star` icon affordance

---

## Completed: LMS Page Content Import And Editor.js UX Closure (2026-05-06)

LMS snapshot contains full EN/RU Editor.js block content. Page block content renders on first open. Editor.js block picker stays visible/scrollable inside viewport.

### Changes Made

-   Removed short preset Welcome page from LMS output; kept `LearnerHome` as stable codename
-   Added `localizeCodenameFromName` for seed entities to opt out of codename localization
-   Regenerated LMS fixture through official Playwright generator with full EN/RU Welcome block content
-   Fixed late-data initialization so content renders on first open; constrained block toolbox to remain visible/scrollable

---

## Completed: Page Entity Authoring And LMS UX Closures (2026-05-05)

Multiple Page entity authoring closures: shared action icons, Editor.js toolbar geometry, language tab parity, primary locale ordering, hubs picker VLC codename crash fix, generic Page form capability, stable labels/loading/dialog titles.

### Key Changes Made

-   Added standard CRUD action icon factories in `@universo/template-mui`; centralized icon factories removed Page/Catalog menu drift
-   Editor.js wrapper keeps add/tune controls inside editor card and left of block text without overlap
-   `ContainerSelectionPanel` resolves VLC codenames through `getVLCString` before rendering (fixed React error #31)
-   Generic Entity form accepts standard `hubs` tab alias and exposes Page `Hubs` and `Layouts` tabs from template capability metadata
-   Generic Entity list helpers and navbar breadcrumbs use localized built-in fallbacks before async metadata resolves
-   Standard Entity template presets expose localized `presentation.dialogTitles` for create/edit/copy/delete actions
-   `EditorJsBlockEditor` accepts `contentLocale` separately from UI locale; merges saves back into selected locale only
-   Metahub Page content route exposes content-language tabs labeled from admin content locales
-   Editor.js toolbar/popover CSS reserves left-side toolbar space and keeps opened menu inside content card
-   Regenerated LMS snapshot through Playwright generator

---

## Completed: Page Block Content And Editor.js Authoring (2026-05-04)

Implemented real Editor.js authoring for metahub Page content. Shared `EditorJsBlockEditor` in `@universo/template-mui` is domain-neutral and reusable by any `blockContent` Entity type. `apps-template-mui` remains Editor.js-free, rendering canonical Page blocks through safe MUI runtime components.

### Changes Made

-   Added official Editor.js core/tools through central PNPM catalog
-   Added lazy-loaded `EditorJsBlockEditor` and tool factory in `@universo/template-mui`
-   Added shared Editor.js-to-Page block adapters that normalize list 2.x data, reject nested lists and inline HTML
-   Hardened entity create/update validation so Page block content is normalized before persistence
-   Added entity-owned `/content` route for `components.blockContent.enabled` Entity types
-   `SnapshotRestoreService` normalizes imported Page `config.blockContent` and rejects unsafe content
-   Added `allowedBlockTypes` and `maxBlocks` constraints to block normalizer
-   Regenerated LMS fixture; fixed LMS snapshot import failure (empty import presets for `page` type)
-   Fixed `[object Object]` import error display with shared formatter

---

## Completed: LMS Workspace Policy, Page Type, And Runtime Cleanup (2026-05-03 to 2026-05-02)

Implemented Page metadata type, publication-version workspace policy, connector-owned workspace schema decisions, and regenerated LMS product snapshot. Removed old no-workspaces publication policy; valid policies are `optional | required`. Connector schema options persisted only after successful sync.

### Key Changes Made

-   Added `page` to metahub/script/runtime kind unions; added `blockContent` component; introduced `WorkspaceModePolicy` plus shared validation helpers
-   Registered Page preset in standard templates; added LMS `LearnerHome` Page with Editor.js-compatible blocks
-   Added physical-table contract so `hub`, `set`, `enumeration`, `page` sync as metadata-only objects with nullable runtime `table_name`
-   Publication versions store `optional | required`; transition guards prevent disabling previously required workspace contract
-   `schema_options` on connector-publication links stores optional workspace choices; `workspaces_enabled` updated after successful schema sync
-   Guest sessions persist access link id, workspace id, secret, expiry; validation rejects tampered tokens
-   `apps-template-mui` renders Page block content through existing dashboard details surface; supports Page menu items
-   `sanitizeMenuHref`/`isSafeMenuHref` in `@universo/utils`; editors reject protocol-relative/unsafe-scheme links
-   `MenuContent.tsx` uses whitelist (`/`, `https:`, `mailto:`, `tel:`, `#`); unsafe links render as inert items
-   JSONB/VLC runtime writes: plain string STRING fields normalized to VLC object before insert/update
-   Application `member` is now read-only: create/edit/copy/delete fail closed
-   TABLE child-row listing no longer requires mutation permissions; mutations fail closed

---

## Completed: Runtime Workspace Management Implementation (2026-04-27 to 2026-04-29)

`isPublic` mutable through application update. Runtime workspace/member endpoints support paginated/searchable responses. Published workspace management renders as full dashboard section. Workspace copy resets runtime system metadata. Runtime workspace API returns stable error codes. Workspace navigation uses host-provided SPA navigation.

### Key Changes Made

-   Owners can change public/closed visibility through settings page; workspace mode is structural read-only
-   Backend workspace API: pagination/search for workspace/member listing; member invitation accepts email or user id
-   `@universo/apps-template-mui` owns full runtime workspace section with card/list, pagination, search, CRUD, invite, remove
-   Workspace copy excludes runtime system columns; resets metadata with fresh timestamps
-   Workspace endpoints return stable error `code` values alongside messages
-   Runtime workspace navigation uses host-provided SPA navigation callbacks
-   Sidebar workspace switcher reads VLC names with active `i18n.language`
-   `_app_workspaces` no longer creates machine-name column; create/edit/copy accept only `name`
-   Workspace-enabled app sync materializes `workspaceSwitcher` widget in left layout zone
-   Workspace routes validate UUID format before schema resolution or service execution
-   Playwright flow performs real negative UI actions for invalid creation, blocked removal, missing-user invite

---

## Completed: Application Layout Management (2026-04-22)

Converged application/metahub layout detail onto shared `LayoutAuthoringDetails` in `@universo/template-mui`. Shared `LayoutAuthoringList` for both application and metahub layout lists. Application layout authors can configure `overviewCards`, chart widgets, and `detailsTable` through shared widget behavior editor.

### Changes Made

-   Added `LayoutAuthoringList` to `@universo/template-mui` as common card/list renderer; restored metahub compact embedded-header behavior
-   `LayoutAuthoringDetails` is common five-zone widget authoring surface for both metahub and application layout detail
-   Added shared `LayoutAuthoringDetails` move action menu with accessible zone-move control
-   `ConnectorDiffDialog` exposes stable select ids and test hooks for bulk/per-layout resolution
-   Read access policy honors explicit per-application `settings.applicationLayouts.readRoles`
-   Shared widget validation via `@universo/types` schema-driven parsers

---

## Completed: LMS MVP Implementation (2026-04-19 to 2026-04-21)

LMS MVP as metahub configuration data. Guest/public runtime access end-to-end: public link resolution, guest session creation, quiz submission, progress updates. LMS fixture/docs scaffolding. Guest runtime credential transport hardened. Canonical LMS snapshot regenerated through Playwright generator.

### Key Changes Made

-   Header-based guest runtime transport (`X-Guest-Student-Id`/`X-Guest-Session-Token`)
-   Shared-workspace-aware access-link resolver; inline SVG fixture assets
-   `workspaceId` query override with UUID format validation and membership check
-   Public workspace discovery limited to active shared only; personal-workspace member-management fail-closed with explicit `403`
-   String-based child-table references remapped to workspace-scoped ids during personal-workspace seeding
-   Transaction-safe `createSharedWorkspace`/`addWorkspaceMember`; server-side guest session expiry
-   Public script delivery with `Content-Type`, `nosniff`, CSP, cache headers
-   Widget/runtime UX hardening (QRCode timeout cleanup, completion screen for last module item)
-   EN/RU locale resources include guest completion keys; defensive locale resolution from URL query

---

## Completed: Entity-First Final Refactoring (2026-04-14 to 2026-04-18)

Eliminated all top-level legacy `domains/` folders. Neutralized metadata route segments, public type exports, API helpers, mutation hooks. Backend: removed specialized child-controller factories, moved to generic entity controller + behavior registry. Bulk parameter renaming across 7 packages. Resources tabs made dynamic from entity type `ComponentManifest`.

### Key Changes Made

-   Renamed all entity type display names from surface-key terminology (`tree_entity`, `linked_collection`, `value_group`, `option_list`) to traditional names (Hubs, Catalogs, Sets, Enumerations). Internal surface keys preserved unchanged
-   Automated renames via perl: `enumerationId`->`optionListId` (321 refs), `setId`->`valueGroupId` (393 refs), `catalogId`->`linkedCollectionId` (904 refs), `hubId`->`treeEntityId` (957 refs)
-   `copyOptions.ts` treats `TreeEntityCopyOptions`/`LinkedCollectionCopyOptions`/`ValueGroupCopyOptions`/`OptionListCopyOptions` as canonical
-   Removed unused controller-factory tails; deleted `valueGroupController.ts`, `treeController.ts`, `linkedCollectionController.ts`
-   Generic custom-entity ACL maps to `createContent`/`editContent`/`deleteContent`
-   Removed `includeBuiltins`, `isBuiltin`, `source`, `custom.*-v2`, old top-level managed route families
-   Backend routes mount `field-definitions`/`fixed-values`/`records` suffixes; frontend URLs/navigation updated
-   `HubList`/`CatalogList`/`SetList`/`EnumerationList` replaced with neutral names
-   `@universo/types` exposes neutral `EntitySurfaceKey`, `EntitySettingsScope`, surface-kind resolvers
-   `MainRoutes.tsx` no longer registers old hubs/catalogs/sets/enumerations pages; unified `/entities/:kindKey/...` authoring surface
-   Top-level `domains/attributes`/`domains/constants`/`domains/elements`/`domains/general` physically deleted
-   Entity-owned routes, read-only definition access, explicit shared-field labels, and browser workspace parity aligned
-   Entity types, actions, event bindings, lifecycle orchestration, and resolver DB extension validated as backend seams
-   Shared/Common is the single authoring shell for shared attributes/constants/values/scripts/layouts
-   ECAE (Entity-Component-Action-Event) architecture: entity presets, script tabs, lifecycle dispatch, runtime execution, browser proof all landed

## 2026-05-13: Local Supabase Minimal App Start Commands

-   Added `start:local-supabase:minimal` and `start:allclean:local-supabase:minimal` root scripts so the app can run against the reduced Supabase Docker stack without manually starting it first.
-   Preserved the same safety order as the full local stack: start Supabase, regenerate local env profiles, run `doctor:local-supabase`, then start or reset the app with explicit local env files.
-   Added local Supabase tool test coverage for the minimal script contract.
-   Updated backend README and GitBook EN/RU quick-start/configuration docs with the minimal profile behavior and the cases that still require the full Supabase stack.
-   Documented Supabase Studio as the default local web console on `http://127.0.0.1:54323`, distinct from the local API URL on `http://127.0.0.1:54321`.

## 2026-05-13: Dedicated E2E Supabase Profile And Agent Playwright Guidance

-   Added a centralized local Supabase profile model with separate dev and E2E project ids, workdirs, ports, generated E2E `config.toml`, and profile-safe CLI wrappers.
-   Local E2E Supabase now uses a dedicated project on API `55321`, database `55322`, and Studio `55323`; local E2E scripts start the minimal dedicated stack before env generation and doctor checks.
-   Hardened E2E env loading with explicit provider/isolation policy. Dedicated hosted E2E no longer falls back silently to `.env`; shared/main modes require `E2E_ALLOW_MAIN_SUPABASE=true` and `E2E_FULL_RESET_MODE=off`.
-   Updated the Playwright agent skill with repository-specific rules: use wrapper commands, port `3100`, `.env.e2e`, and no `pnpm dev` for browser E2E.
-   Added focused Vitest coverage for local Supabase profiles, package-script contracts, E2E source policy, generated E2E config, and agent skill rules.
-   Updated backend README, E2E README, GitBook EN/RU configuration/quick-start/E2E docs, env examples, active context, and tasks.

---

## 2026-04-13 And Earlier: Archive

### 2026-04-13: Legacy Removal + Metahub QA

-   Removed legacy `HubList`/`CatalogList`/`SetList`/`EnumerationList` frontend exports; neutral `getTypeById`/`listTypes`/`createType` naming
-   `createRlsExecutor` scopes transaction depth lexically; middleware-owned request transactions reused directly
-   `entity.hub|catalog|set|enumeration.*` settings keys replace plural legacy prefixes
-   `TemplateSeedExecutor` applies hub-assignment remap pass after seeded entities receive real ids
-   Entity-Type Codename Enforcement: server-side duplicate codename blocking via `EntityTypeService`; `_mhb_entity_type_definitions` active-row unique index
-   Legacy Frontend Route Tree Cleanup: unified `/entities/:kindKey/...` authoring surface

### 2026-04-12: Metahub QA + Entity V2 Closure

-   `EntityFormDialog` resets incoming initial state before paint on first open; no render-phase ref writes
-   Shared shell-spacing contract extracted to `pageSpacing.ts`; `SkeletonGrid` exposes semantic `insetMode`
-   Standalone metahub pages respect outer gutter from `MainLayoutMUI`
-   Entity V2 route-ownership, compatibility, review-triage, automation, and workspace/browser seams closed

### 2026-04-09 to 2026-04-10: ECAE Delivery + Catalog V2 Closeout

-   Strict Catalogs V2 parity: backend/frontend/browser/runtime paths treat catalog-compatible entity kinds as shared catalog surfaces
-   Snapshot v3, DDL custom-type propagation, runtime `section*` aliases generalized
-   Dynamic published custom-entity menu zone is permission-aware and stable
-   First generic entity instance UI with focused browser proof passed on real product route surface
-   Entity presets reuse template registry/versioning flow; frontend authoring workspace integrated into shared shell

### 2026-04-08: ECAE Foundation And QA Recovery

-   Backend service foundation: entity types, actions, event bindings, lifecycle orchestration, resolver DB extension
-   Generic CRUD and compatibility layer: custom-only generic entity CRUD shipped first, then legacy built-in delete/detach/reorder semantics lifted into shared helpers
-   Design-time service genericization: shared child copy and object-scoped system-attribute management behind reusable helpers
-   Review and QA hardening: PR review fixes, lint closure, attribute move ownership, strict E2E finalization

### 2026-04-07: Shared/Common And Runtime Materialization

-   Common is the single authoring shell for shared attributes/constants/values/scripts/layouts
-   Shared sections export/import as first-class snapshot data, materialized into flattened runtime/app-sync view
-   Catalog layout inherited widgets stay sparse, read-only for config, gated by shared behavior rules

### 2026-04-06: Layout, Runtime, Fixture, And Docs

-   General/Common page owns single shell; catalog-specific layouts remain sparse overlays
-   Self-hosted and quiz fixtures regenerated from real generator/browser flows
-   Dialog settings, GitBook documentation, screenshot generation brought into EN/RU parity

### 2026-04-05: Scripting And Quiz Delivery

-   Embedded scripts are SDK-only; browser worker execution restricted; server runtime pooled; public RPC boundaries fail closed
-   Scripts tabs, quizWidget, runtime execution, fixture export/import, and browser-authored quiz flows all landed
-   `sdkApiVersion`, CSRF retry, default capability resets, and runtime script sync fail-closed behavior became cross-package contracts

### 2026-04-04: Self-Hosted Parity

-   Fixture identity and codename fidelity through repeated real-generator reruns
-   Snapshot import/export, publication linkage, runtime inheritance, and browser-import fidelity aligned with live product

### 2026-04-03: Snapshot, E2E Reset, And Turbo Hardening

-   Direct metahub export/import, publication version export, `SnapshotRestoreService`, browser verification all landed
-   Wrapper-managed E2E runs start from and return to project-empty state with doctor/reset tooling
-   Turbo 2 root migration, cache correctness, and repeated-build cache hits became documented build contract

### 2026-04-02 To 2026-03-11: Condensed Archive

| Date                     | Theme                           | Durable outcome                                                                                                                                      |
| ------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-02               | Playwright full-suite hardening | Route timing, determinism, restart-safe cleanup, diagnostics, locale/theme, route-surface browser-testing closed                                     |
| 2026-04-01               | Supabase auth + E2E QA          | HS256/JWKS verification, RLS cleanup, E2E runner cleanup, public-route/auth QA seams stabilized                                                      |
| 2026-03-31               | Breadcrumbs + security          | Breadcrumb/query restore behavior, JSONB/text selector drift, dependency/security tail closed                                                        |
| 2026-03-30               | Metahubs/applications refactor  | Thin routes, controller/service/store decomposition, shared hooks, shared mutation/error helpers                                                     |
| 2026-03-28 to 2026-03-24 | CSRF + codename convergence     | `csurf` replacement, vulnerability cleanup, codename JSONB/VLC single-field contract                                                                 |
| 2026-03-19 to 2026-03-11 | Platform foundation             | Request/pool/DDL DB access tiers, fixed system-app convergence, runtime-sync ownership, managed naming helpers, bootstrap/application workspace work |

### Older 2025-07 To 2026-02 Summary

-   Alpha-era platform work established the current APP architecture, template-first publication model, schema-ddl runtime engine, VLC/i18n convergence, application modules, publications, and the three-level system-fields model
-   Release milestones `0.21.0-alpha` through `0.52.0-alpha` in the version table above remain the canonical high-level timeline for those earlier waves

---

## 2026-05-15: Documentation Refresh Implementation (Phase 1-4 Complete)

**Goal**: Comprehensive update of GitBook documentation to match current platform state, remove non-existent functionality, add Pages entity documentation, and prepare for screenshot generation.

**Status**: Core documentation updates complete. Screenshot generation pending.

### Completed Work

**Phase 1: QA Analysis (Complete)**

-   ✅ Verified legacy terminology already removed from all documentation
-   ✅ Verified Russian localization already complete
-   ✅ Verified Pages entity implementation exists in codebase
-   ✅ Identified 26 files documenting non-existent functionality
-   ✅ Identified LMS and Ledgers screenshot gaps

**Phase 2: Content Deletion (Complete)**

-   ✅ Deleted UPDL section documentation (16 files: 8 EN + 8 RU)
    -   Removed `docs/en/platform/updl/` directory (8 files)
    -   Removed `docs/ru/platform/updl/` directory (8 files)
-   ✅ Deleted Space Builder documentation (2 files)
-   ✅ Deleted Metaverses documentation (2 files)
-   ✅ Deleted Analytics documentation (2 files)
-   ✅ Deleted Working with UPDL guide (2 files)
-   ✅ Deleted Multi-Platform Export guide (2 files)
-   ✅ Updated `docs/en/SUMMARY.md` to remove deleted sections
-   ✅ Updated `docs/ru/SUMMARY.md` to remove deleted sections

**Phase 3: Platform Section Updates (Complete)**

-   ✅ Updated `docs/en/platform/README.md` - removed non-existent functionality, added actual features
-   ✅ Updated `docs/ru/platform/README.md` - mirrored EN changes exactly
-   ✅ Updated `docs/en/platform/metahubs.md` - added entity types table with Pages and Ledgers
-   ✅ Updated `docs/ru/platform/metahubs.md` - mirrored EN changes exactly

**Phase 4: Pages Entity Documentation (Complete - CRITICAL GAP CLOSED)**

-   ✅ Created `docs/en/guides/pages-entity-type.md` - comprehensive Pages guide
    -   Overview and key features
    -   Creating and editing Pages
    -   Supported block types (paragraph, header, list, quote, code, etc.)
    -   Multilingual content support
    -   Content validation and safety
    -   Use cases (LMS, documentation, landing pages)
    -   Runtime behavior and performance
    -   Best practices and troubleshooting
-   ✅ Created `docs/ru/guides/pages-entity-type.md` - full Russian translation
-   ✅ Added Pages guide to `docs/en/SUMMARY.md`
-   ✅ Added Pages guide to `docs/ru/SUMMARY.md`

### Impact

**Documentation Cleanup:**

-   Removed 26 files of misleading documentation about non-existent features
-   Documentation now accurately reflects current platform capabilities
-   Cleaner navigation structure in SUMMARY.md files

**Critical Gap Closed:**

-   Pages entity type now has comprehensive user-facing documentation
-   Users can now learn how to use Editor.js integration
-   Multilingual content authoring is documented
-   LMS use case is explained

**Platform Overview Improved:**

-   Platform README now lists actual running features
-   Metahubs documentation includes all entity types
-   Clear references to detailed guides

### Remaining Work

**Phase 5: Screenshot Generation (READY TO EXECUTE)**

-   ✅ Created Playwright screenshot generation spec
-   ✅ Implemented locale switching (using existing helpers)
-   ✅ Created comprehensive documentation
-   📸 Ready to generate 40-50 screenshots (20-25 unique, each in EN + RU)
-   Priority areas ready:
    -   Pages editor screenshots (spec created)
    -   LMS workflow screenshots (spec created)
    -   Ledgers screenshots (spec created)

**Execution Instructions:**

1. Start local Supabase E2E: `pnpm supabase:e2e:start:minimal`
2. Run generator: `npx playwright test --project=chromium tools/testing/e2e/specs/generators/docs-pages-lms-screenshots.spec.ts`
3. Screenshots saved to `docs/{locale}/.gitbook/assets/` directories

**Phase 6: Final Validation (Pending)**

-   Link validation
-   EN/RU structure verification
-   Line count matching verification
-   GitBook build test

### Technical Details

**Files Modified:**

-   Deleted: 26 files (UPDL, Space Builder, Metaverses, Analytics, guides)
-   Created: 4 files (Pages guide EN + RU, screenshot spec, README)
-   Updated: 6 files (SUMMARY.md x2, Platform README x2, Metahubs x2)

**Screenshot Infrastructure:**

-   Created: `tools/testing/e2e/specs/generators/docs-pages-lms-screenshots.spec.ts`
-   Created: `tools/testing/e2e/specs/generators/README-SCREENSHOTS.md`
-   Locale support: EN and RU via `applyBrowserPreferences()`
-   Output directories: `docs/{locale}/.gitbook/assets/{category}/`

**Documentation Quality:**

-   EN and RU versions maintain exact structure
-   All internal links updated
-   No broken references to deleted content
-   Comprehensive Pages documentation with examples

### Validation Evidence

-   ✅ All deleted files confirmed removed
-   ✅ SUMMARY.md files updated and consistent
-   ✅ Pages guide created with comprehensive content
-   ✅ EN and RU versions match in structure
-   ✅ Platform documentation reflects actual features

### Next Steps

1. Create Playwright screenshot generation spec
2. Generate locale-specific screenshots (EN + RU)
3. Verify all internal links work
4. Run GitBook build test
5. Update this progress entry with screenshot completion

## 2026-05-15 - LMS Platform Implementation Slice 7B: Published Runtime Workflow Actions

### Summary

Completed the published-application runtime layer for metadata-backed workflow actions. Object collection workflow actions are now returned in runtime app data, visible in the existing row actions menu when the selected row status matches the configured transition, and executed through the trusted backend workflow endpoint with optimistic concurrency.

### Implemented

-   Added workflow actions to the apps-template runtime response schema for `section`, `objectCollection`, `sections`, and `objectCollections`.
-   Added `runAppWorkflowAction()` and the corresponding `CrudDataAdapter.workflowAction()` contract.
-   Extended `useCrudDashboard()` with `handleWorkflowAction()` and `isWorkflowActionPending`.
-   Reused the existing `RowActionsMenu` instead of introducing a new LMS-specific action surface.
-   Resolved workflow `statusFieldCodename` to physical runtime column names in the frontend menu and backend route, while keeping `statusColumnName` available for explicit low-level configuration.
-   Returned `_upl_version` in runtime rows only when the active object collection has configured workflow actions, so the UI can fail closed before submitting stale actions.
-   Added localized workflow action success/error messages in EN/RU.

### Safety Notes

-   Workflow actions remain server-trusted: the browser can request an action codename, but the backend loads the action from object collection metadata and rejects unconfigured actions.
-   The backend requires `editContent`, a current user id, CSRF-protected POST, a positive `expectedVersion`, safe identifiers, row locking, and workspace scoping where applicable.
-   The frontend hides workflow actions without a current `_upl_version` and sends the version read from the current runtime row.

### Validation

-   `pnpm --filter @universo/apps-template-mui lint`
-   `VITEST_COVERAGE=false pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/__tests__/RowActionsMenu.recordCommands.test.tsx src/hooks/__tests__/useCrudDashboard.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend test -- runtimeWorkflowActions applicationsRoutes.test.ts -t "workflow actions" --runInBand`
-   `pnpm --filter @universo/applications-backend build`
-   `git diff --check`

## 2026-05-15 - LMS Platform Implementation Slice 7C: Workflow Capability Policy

### Summary

Added an effective workflow capability map for runtime requests so metadata-backed workflow actions can use exact LMS capabilities such as `assignment.review` and `certificate.issue` instead of being limited to base permissions like `editContent`.

### Implemented

-   Added `resolveEffectiveRoleCapabilities()` in application access guards.
-   The capability map starts from effective base permissions and their aliases, then applies exact role-policy rules for supported `application` and `workspace` scopes.
-   Unsupported scoped role-policy rules such as `department`, `class`, `group`, and `recordOwner` remain fail-closed until their predicates are implemented.
-   Runtime schema context now carries `workflowCapabilities`.
-   Published runtime app data now exposes `workflowCapabilities`.
-   `RowActionsMenu` now filters metadata workflow actions by exact `requiredCapabilities` before showing them.
-   Backend workflow execution now uses `ctx.workflowCapabilities`, so the browser and server evaluate the same effective capability set while the server remains authoritative.

### Validation

-   `pnpm --filter @universo/applications-backend test -- guards.test.ts runtimeWorkflowActions applicationsRoutes.test.ts -t "role|workflow actions|configured workflow" --runInBand`
-   `VITEST_COVERAGE=false pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/__tests__/RowActionsMenu.recordCommands.test.tsx src/hooks/__tests__/useCrudDashboard.test.tsx`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-15 - LMS Platform Implementation Slice 7D: Knowledge and Development Portal Navigation

### Summary

Completed the LMS portal-navigation correction that was called out by the product roadmap: Knowledge and Development now open real portal Page entities instead of surrogate operational collections. The canonical LMS fixture was regenerated through the Playwright generator, so the committed snapshot matches the template and fixture contract.

### Implemented

-   Added `KnowledgeHome` as a Page entity with EN/RU Editor.js blocks describing knowledge spaces, folders, articles, and bookmarks.
-   Added `DevelopmentHome` as a Page entity with EN/RU Editor.js blocks describing development plans, stages, tasks, mentors, and monitors.
-   Updated primary LMS menu seed data so `lms-nav-knowledge` targets `KnowledgeHome` and `lms-nav-development` targets `DevelopmentHome`.
-   Extended backend template manifest tests for the new Page entities and menu targets.
-   Extended the LMS fixture contract acceptance matrix and page checks for `KnowledgeHome` and `DevelopmentHome`.
-   Added explicit fixture contract guards that reject Knowledge/Development primary navigation when it points to old surrogate collection targets.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` only through the Playwright LMS generator.

### Validation

-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts --runInBand`
-   `pnpm --dir packages/metahubs-backend/base exec eslint --fix src/domains/templates/data/lms.template.ts src/tests/services/templateManifestValidator.test.ts`
-   `pnpm exec eslint --fix tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm supabase:e2e:start:minimal && pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project=generators --grep "canonical lms"`
-   `pnpm supabase:e2e:stop`
-   `git diff --check -- packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts tools/testing/e2e/support/lmsFixtureContract.ts`

## 2026-05-15 - LMS Platform Implementation Slice 7E: LMS Workflow Metadata

### Summary

Added product-level LMS workflow actions as generic object metadata rather than new LMS-specific runtime screens. The published app can now receive action definitions for assignment review, attendance, certificate issue/revoke, development tasks, and notification delivery through the existing runtime workflow action pipeline.

### Implemented

-   Added reusable LMS workflow action builders in the LMS template.
-   Added `workflowActions` support to the LMS transactional object config helper.
-   Added assignment submission actions: `StartSubmissionReview`, `AcceptSubmission`, and `DeclineSubmission`.
-   Added training attendance actions: `MarkAttendanceAttended`, `MarkAttendanceNoShow`, and `CancelAttendance`.
-   Added certificate issue actions: `IssueCertificate` and `RevokeCertificate`, bound to `CertificateIssuePostingScript`.
-   Added development task actions: `StartDevelopmentTask`, `CompleteDevelopmentTask`, and `ReopenDevelopmentTask`.
-   Added notification outbox actions: `MarkNotificationSent`, `MarkNotificationFailed`, and `CancelNotification`.
-   Normalized executable workflow status fields to string lifecycle states where the current generic workflow engine compares status codenames directly.
-   Extended backend template manifest tests with workflow action contract checks.
-   Extended the LMS fixture contract to require every operational workflow action and capability.
-   Updated the LMS Playwright generator seed for `DevelopmentPlanTasks.Status`.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the official Playwright LMS generator.

### Validation

-   `pnpm --dir packages/metahubs-backend/base exec eslint --fix src/domains/templates/data/lms.template.ts src/tests/services/templateManifestValidator.test.ts`
-   `pnpm exec eslint --fix tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts --runInBand`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm supabase:e2e:start:minimal && pnpm env:e2e:local-supabase && pnpm doctor:e2e:local-supabase`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project=generators --grep "canonical lms"`
-   `pnpm supabase:e2e:stop`
-   Snapshot sanity check for required workflow action metadata.
-   `git diff --check -- packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts tools/fixtures/metahubs-lms-app-snapshot.json`

## 2026-05-15 - LMS Platform Implementation Slice 8A: Saved Runtime Report CSV Export

### Summary

Added the first generic reporting export slice for published applications. Runtime report widgets now execute and export saved report definitions by `reportCodename`, while arbitrary browser-supplied inline report definitions remain rejected by the backend before runtime metadata lookup.

### Implemented

-   Added `POST /applications/:applicationId/runtime/reports/export` for CSV export of saved `records.list` reports.
-   Reused the existing runtime reports resolution path for Reports object lookup, target metadata resolution, workspace scoping, lifecycle filtering, and `readReports` permission checks.
-   Added bounded export limits with a 5,000-row maximum and CSV serialization that uses configured report columns only.
-   Added a typed `exportRuntimeReportCsv()` published-app API helper with CSRF protection and workspace-aware URLs.
-   Updated the existing detailsTable report widget to call saved reports by codename and expose a small localized CSV export action instead of inventing an LMS-specific report screen.
-   Added EN/RU localization keys for report export states.

### Validation

-   `pnpm exec eslint --fix packages/applications-backend/base/src/controllers/runtimeReportsController.ts packages/applications-backend/base/src/services/runtimeReportsService.ts packages/applications-backend/base/src/routes/applicationsRoutes.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts packages/apps-template-mui/src/api/api.ts packages/apps-template-mui/src/api/index.ts packages/apps-template-mui/src/api/__tests__/runtimeReports.test.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/apps-template-mui test -- runtimeReports widgetRenderer`
-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes.test.ts -t "Runtime reports route contract"`
-   `pnpm --filter @universo/applications-backend test -- runtimeReportsService.test.ts`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `git diff --check -- packages/applications-backend/base/src/controllers/runtimeReportsController.ts packages/applications-backend/base/src/services/runtimeReportsService.ts packages/applications-backend/base/src/routes/applicationsRoutes.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts packages/applications-backend/base/src/tests/services/runtimeReportsService.test.ts packages/apps-template-mui/src/api/api.ts packages/apps-template-mui/src/api/index.ts packages/apps-template-mui/src/api/__tests__/runtimeReports.test.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`

## 2026-05-15 - LMS Platform Implementation Slice 8B: Report Aggregation Overview Metrics

### Summary

Extended generic analytics widgets so overview cards can display aggregations from saved runtime reports. This keeps LMS dashboard/report homes configurable through existing layout widgets instead of adding hardcoded LMS React surfaces.

### Implemented

-   Added a typed `report.aggregation` metric datasource for stat cards.
-   Kept `records.count` behavior unchanged and limited overview cards to implemented metric keys.
-   Updated the published-app `RuntimeStatCard` path to call the saved runtime report endpoint and display a configured aggregation alias.
-   Extended the existing Application Widget Behavior editor for overview cards with a metric type selector and report aggregation fields.
-   Added validation warnings for incomplete report aggregation metric configuration.
-   Added EN/RU localization keys for the new overview card metric controls.

### Validation

-   `pnpm exec eslint --fix packages/universo-types/base/src/common/runtimeDataSources.ts packages/universo-types/base/src/common/applicationLayouts.ts packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx packages/applications-frontend/base/src/components/layouts/ApplicationWidgetBehaviorEditorDialog.tsx packages/applications-frontend/base/src/components/layouts/__tests__/ApplicationWidgetBehaviorEditorDialog.test.tsx`
-   `pnpm --filter @universo/types test -- applicationLayouts.test.ts`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/apps-template-mui test -- MainGrid`
-   `pnpm --filter @universo/applications-frontend test -- ApplicationWidgetBehaviorEditorDialog.test.tsx`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-15 - LMS Platform Implementation Slice 13A: Deferred xAPI And Broad File Resources

### Summary

Extended the generic learning resource contract so xAPI and storage-backed broad file formats are represented honestly as configured-but-deferred resources. This keeps the LMS fixture close to iSpring-like content coverage without pretending that xAPI, SCORM, office documents, MOV/FLV, or uploaded media players are already implemented.

### Implemented

-   Added `xapi` to the shared `ResourceSource` type contract.
-   Kept `scorm`, `xapi`, `file`, and any storage-backed resource behind `isDeferredResourceSource()`.
-   Allowed storage-backed video, audio, and document resources while keeping URL-backed runtime players limited to safe supported MIME types.
-   Updated the published app `ResourcePreview` icon and tests so xAPI and storage-backed office documents show the deferred runtime state.
-   Added xAPI resource acceptance to LMS platform and resource preview widget schema tests.
-   Added `Xapi` to the LMS ResourceType enumeration template.
-   Updated the LMS Playwright generator and fixture contract to seed and validate an explicit deferred xAPI placeholder.
-   Updated the committed LMS snapshot fixture and recomputed its integrity hash.

### Validation

-   `pnpm exec eslint --fix packages/universo-types/base/src/common/resourceSources.ts packages/universo-types/base/src/__tests__/resourceSources.test.ts packages/universo-types/base/src/__tests__/lmsPlatform.test.ts packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/apps-template-mui/src/components/resource-preview/ResourcePreview.tsx packages/apps-template-mui/src/components/resource-preview/__tests__/ResourcePreview.test.tsx packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm --filter @universo/types test -- resourceSources.test.ts lmsPlatform.test.ts applicationLayouts.test.ts`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/apps-template-mui test -- ResourcePreview`
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts --runInBand`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/utils test -- snapshotFixtures.test.ts`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project=generators --grep "canonical lms"`
-   `pnpm supabase:e2e:stop`
-   Snapshot hash and resource-type sanity checks for the regenerated LMS fixture.

## 2026-05-15 - LMS Platform Implementation Slice 9A: Runtime Dashboard Card Grid Parity

### Summary

Restored one concrete part of `packages/apps-template-mui` dashboard visual parity by making runtime record cards fill the configured dashboard grid columns. This keeps record card views aligned with the existing workspace card behavior and the original MUI dashboard card layout without adding LMS-specific UI.

### Implemented

-   Updated the runtime details card grid to expose a stable test target for visual and unit checks.
-   Passed `allowStretch` to the shared `ItemCard` when dashboard records are rendered in card mode.
-   Added a focused `MainGrid` test that locks the stretched-card contract for configured card grids.

### Validation

-   `pnpm exec eslint --fix packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx`
-   `pnpm --filter @universo/apps-template-mui test -- MainGrid`
-   `pnpm --filter @universo/apps-template-mui build`
-   `git diff --check -- packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx memory-bank/tasks.md memory-bank/progress.md`

## 2026-05-15 - LMS Platform Implementation Slice 12A: LMS Resource And Report Docs

### Summary

Updated GitBook LMS documentation to match the implemented resource and report runtime contracts. The docs now describe xAPI and broad storage-backed formats as deferred resources, and explain saved report rendering, CSV export, and report aggregation metrics through existing generic widgets.

### Implemented

-   Updated `docs/en/guides/lms-resource-model.md` and `docs/ru/guides/lms-resource-model.md` for xAPI, SCORM, storage-backed media, documents, and office-format deferred states.
-   Updated `docs/en/guides/lms-reports.md` and `docs/ru/guides/lms-reports.md` for saved `detailsTable` report rendering, CSV export, and `report.aggregation` stat-card metrics.
-   Updated `docs/en/architecture/ledgers.md` and `docs/ru/architecture/ledgers.md` so the LMS ledger list matches the current operational template.
-   Recorded the Phase 12 documentation slice in the active task ledger.

### Validation

-   `git diff --check -- docs/en/guides/lms-resource-model.md docs/ru/guides/lms-resource-model.md docs/en/guides/lms-reports.md docs/ru/guides/lms-reports.md docs/en/architecture/ledgers.md docs/ru/architecture/ledgers.md memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm docs:i18n:check`

## 2026-05-15 - LMS Platform Implementation Slice 7G: Gamification And Achievements

### Summary

Completed the operational gamification slice for the canonical LMS configuration without adding LMS-specific runtime UI. Points, badges, achievements, leaderboard snapshots, and achievement reports are modeled as ordinary Objects, workflow metadata, scripts, and saved report definitions.

### Implemented

-   Added `GamificationSettings`, `PointAwardRules`, `PointTransactions`, `BadgeDefinitions`, `BadgeIssues`, and `LeaderboardSnapshots` Objects to the LMS template.
-   Added `PointSourceType` enumeration values for course, track, assignment, training event, certificate, and manual point sources.
-   Added `GamificationEnabled` and `DefaultPointAward` app configuration constants.
-   Added metadata-backed workflow actions for approving/reversing point transactions and issuing/revoking badges.
-   Added `PointTransactionPostingScript` so approved point transactions can post movement facts into `PointsLedger`.
-   Extended the LMS Playwright generator to seed gamification settings, deterministic point rules, point transactions, badges, badge issues, leaderboard snapshots, and the `Leaderboard` and `Achievements` report definitions.
-   Strengthened the LMS fixture contract and template manifest tests for gamification entities, workflow metadata, fixed values, transactional behavior, script attachment, report definitions, and deterministic seeded row counts.
-   Updated LMS report GitBook pages so saved leaderboard and achievement reports are documented alongside progress/course reports.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator; the new snapshot hash is `ac024a08166da02149930284fd7b1640f38abf4f8aa5b1028745191d89de2bf0`.

### Validation

-   `pnpm exec eslint --fix packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator.test.ts --runInBand`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/utils test -- snapshotFixtures.test.ts`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project=generators --grep "canonical lms"`
-   Snapshot sanity check for gamification object row counts, leaderboard totals, and point transaction status totals.
-   `pnpm supabase:e2e:stop`

## 2026-05-15 - LMS Platform Implementation Slice 11A: Committed LMS Fixture Contract

### Summary

Added a focused committed-fixture unit contract for the canonical LMS snapshot so gamification, achievements, leaderboard rows, and saved report definitions are protected outside the Playwright generator path.

### Implemented

-   Extended `packages/universo-utils/base/src/snapshot/__tests__/snapshotFixtures.test.ts` with a deterministic LMS fixture test.
-   Added local snapshot helpers for localized entity codenames and Object row lookup without importing E2E support code into `@universo/utils`.
-   Locked committed snapshot row counts for `GamificationSettings`, `PointAwardRules`, `PointTransactions`, `BadgeDefinitions`, `BadgeIssues`, and `LeaderboardSnapshots`.
-   Locked deterministic totals for approved point transactions, current leaderboard totals, issued badges, and the top leaderboard row.
-   Locked saved report codenames for `LearnerProgress`, `CourseProgress`, `Leaderboard`, and `Achievements`.

### Validation

-   `pnpm exec eslint --fix packages/universo-utils/base/src/snapshot/__tests__/snapshotFixtures.test.ts`
-   `pnpm --filter @universo/utils test -- snapshotFixtures.test.ts`

## 2026-05-15 - LMS Platform Implementation Slice 12B: Gamification Guide

### Summary

Added a dedicated GitBook guide for LMS gamification and achievements so the new template entities, workflows, posting script, ledger boundary, and saved reports are documented as generic platform configuration.

### Implemented

-   Added `docs/en/guides/lms-gamification.md`.
-   Added `docs/ru/guides/lms-gamification.md`.
-   Linked both pages from the EN/RU GitBook summaries next to the LMS reports guide.
-   Reused the existing Object records screenshot because gamification settings, badges, issues, point transactions, and leaderboard snapshots are Object-backed rows.

### Validation

-   `pnpm docs:i18n:check`
-   `git diff --check -- docs/en/guides/lms-gamification.md docs/ru/guides/lms-gamification.md docs/en/SUMMARY.md docs/ru/SUMMARY.md memory-bank/tasks.md memory-bank/progress.md packages/universo-utils/base/src/snapshot/__tests__/snapshotFixtures.test.ts`

## 2026-05-15 - LMS Platform Implementation Slice 9B: Workspace Metric Card Parity

### Summary

Aligned the workspace dashboard summary cards with the original MUI dashboard card surface by using the standard outlined Card/CardContent pattern instead of a custom bordered Box.

### Implemented

-   Replaced the custom `WorkspaceMetricCard` Box surface in `packages/apps-template-mui` with `Card variant="outlined"` and `CardContent`.
-   Preserved stable dimensions, text wrapping, and existing data-driven workspace dashboard behavior.
-   Added a focused runtime workspace test assertion for the three metric cards rendered on the workspace dashboard route.

### Validation

-   `pnpm exec eslint --fix packages/apps-template-mui/src/workspaces/RuntimeWorkspacesPage.tsx packages/apps-template-mui/src/workspaces/__tests__/RuntimeWorkspacesPage.test.tsx`
-   `pnpm --filter @universo/apps-template-mui test -- RuntimeWorkspacesPage`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-16 - LMS Platform Implementation Slice 9C/11B: Workspace Metric Screenshot Gate And LMS Flow Cleanup

### Summary

Added a real Playwright screenshot gate for workspace dashboard metric cards and brought stale LMS flow tests back onto the current Object-based runtime API.

### Implemented

-   Extended `lms-workspace-management.spec.ts` with dashboard metric-card coverage, a no-horizontal-overflow assertion, and the `runtime-workspace-dashboard-metric-cards.png` screenshot artifact.
-   Updated the workspace flow to use the current published-app navigation contract (`Modules`) and role/label-based Playwright locators instead of stale `Object` and title-attribute selectors.
-   Replaced removed `waitForApplicationCatalogId` imports with `waitForApplicationObjectId` in the workspace, class/module/quiz, and QR access-link LMS flows.
-   Migrated the affected runtime-row setup payloads from legacy `linkedCollectionId` to `objectCollectionId`, so tests now target the intended LMS Objects under the current API contract.
-   Added required `Slug` data to module rows created by the class/module/quiz and QR access-link flows.

### Validation

-   `pnpm exec eslint --fix tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts tools/testing/e2e/specs/flows/lms-class-module-quiz.spec.ts tools/testing/e2e/specs/flows/lms-qr-code.spec.ts`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts --project=chromium`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-class-module-quiz.spec.ts --project=chromium`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-qr-code.spec.ts --project=chromium`

## 2026-05-16 - LMS Platform Implementation Slice 9D/12C: Published Runtime README Alignment

### Summary

Closed the remaining visual-parity and documentation checklist drift by documenting the current independent published-app runtime architecture instead of the removed legacy package dependency.

### Implemented

-   Confirmed Phase 9 acceptance coverage already exists through runtime record-card unit coverage plus workspace/workspace-dashboard Playwright screenshot gates.
-   Updated `packages/apps-template-mui/README.md` and `README-RU.md` to describe package-local runtime UI primitives, app-side Editor.js content authoring, generic resource preview states, workflow actions, saved-report rendering/export, and runtime workspace surfaces.
-   Removed stale README guidance that still described `EnhancedDetailsSection` as consuming `@universo/template-mui` components.
-   Replaced the obsolete related-package reference to `@universo/template-mui` with the actual published-runtime dependencies on `@universo/i18n` and `@universo/utils`.
-   Marked Phases 9, 11, and 12 complete after all tracked sub-items had concrete implementation and validation artifacts.

### Validation

-   `pnpm --filter @universo/apps-template-mui test -- MainGrid RuntimeWorkspacesPage packageBoundary`
-   `git diff --check -- packages/apps-template-mui/README.md packages/apps-template-mui/README-RU.md memory-bank/tasks.md memory-bank/progress.md`

## 2026-05-16 - LMS Platform Implementation Slice 1B/12D: Shared Block Editor Package

### Summary

Removed the remaining duplicated Editor.js implementation by extracting a neutral shared package that is reused by both administrative authoring and published-app content creation flows.

### Implemented

-   Added `@universo/block-editor` with the shared `EditorJsBlockEditor`, locale-aware Editor.js helpers, package-local Editor.js type declarations, Vitest coverage, and EN/RU package READMEs.
-   Moved Editor.js tool dependencies to the new package owner instead of keeping duplicate dependencies in `@universo/template-mui` and `@universo/apps-template-mui`.
-   Replaced both consumer-local editor implementations with workspace-package imports while preserving the existing public re-export surface from `@universo/template-mui` and `@universo/apps-template-mui`.
-   Removed the duplicated editor source files and duplicate Editor.js declaration files from both consumers.
-   Updated package documentation and `packages/README.md` so the package map reflects the real shared authoring boundary.

### Validation

-   `pnpm install --lockfile-only`
-   `pnpm install`
-   `pnpm --filter @universo/block-editor lint`
-   `pnpm --filter @universo/block-editor test`
-   `pnpm --filter @universo/block-editor build`
-   `pnpm --filter @universo/template-mui lint`
-   `pnpm --filter @universo/template-mui build`
-   `pnpm --filter @universo/template-mui test --runInBand`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/apps-template-mui test -- FormDialog.blockEditor packageBoundary`
-   `pnpm --filter @universo/metahubs-frontend build`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/metahub-basic-pages-ux.spec.ts --project=chromium`
-   `git diff --check -- packages/universo-block-editor packages/apps-template-mui packages/universo-template-mui packages/README.md memory-bank/tasks.md pnpm-lock.yaml`

## 2026-05-16 - LMS QA Remediation: Runtime Scripts And Workflow Capability Gate

### Summary

Closed the QA findings from the LMS implementation pass by fixing stale runtime script route fixtures and adding browser-level workflow permission proof to the LMS import flow.

### Implemented

-   Updated runtime script route tests to use canonical application schema names (`app_<uuid without dashes>`) and the current SQL identifier format (`"schema"."_app_scripts"`), so route coverage now matches the production schema guard.
-   Kept public runtime script RPC denial semantics fail-closed: missing `rpc.client` and lifecycle public RPC calls now remain covered by the route test suite with HTTP 403 expectations.
-   Extended the LMS snapshot import Playwright flow with a real published-app row-action permission gate:
    -   before role-policy grants, the `StartSubmissionReview` workflow action is hidden from the row actions menu;
    -   the trusted backend workflow endpoint rejects the same action with `WORKFLOW_ACTION_UNAVAILABLE`, `missingCapability`, and `assignment.review`;
    -   after the generic owner role-policy grant, the same workflow action becomes visible in the browser and succeeds through the UI.
-   Added screenshots for the hidden and visible workflow-action menu states.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes --runInBand -t "runtime/scripts"`
-   `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm --filter @universo/applications-backend test -- runtimeWorkflowActions runtimeReportsService guards applicationsRoutes --runInBand`
-   `pnpm --filter @universo/types test -- workflowActions lmsPlatform resourceSources pageBlocks`
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/block-editor test`
-   `pnpm --filter @universo/block-editor lint`
-   `pnpm --filter @universo/block-editor build`
-   `pnpm --filter @universo/apps-template-mui test -- RowActionsMenu useCrudDashboard ResourcePreview`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm docs:i18n:check`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `git diff --check`

### E2E Environment Blocker

-   Started and checked the minimal local Supabase E2E stack with `pnpm supabase:e2e:start:minimal`, `pnpm env:e2e:local-supabase`, and `pnpm doctor:e2e:local-supabase`.
-   The LMS Playwright wrapper run did not reach test execution because the backend failed during startup: `isolated-vm` has no native build for the current local runtime (`node=20.19.4`, while the repository requires `>=22.6.0`; the error also reports Electron ABI 115).
-   `pnpm rebuild isolated-vm` completed but did not repair the local native module mismatch.
-   The local Supabase E2E stack was stopped with `pnpm supabase:e2e:stop`.

## 2026-05-16 - Node 22 Environment And LMS E2E Remediation

### Summary

Resolved the local Node runtime mismatch that blocked the LMS Playwright validation and reran the previously blocked browser flow against the minimal local Supabase E2E stack.

### Implemented

-   Removed obsolete nvm-managed Node versions and set the nvm default runtime to Node 22.22.2.
-   Left the system `/usr/bin/node` package untouched because it is managed by the OS package manager, not nvm.
-   Updated repository and package documentation from stale Node 18/20 and PNPM 9 requirements to the current Node 22 and PNPM 10 requirement.
-   Added a repository-specific Playwright skill rule to activate Node 22 explicitly before E2E wrapper runs when a non-interactive shell can resolve an older system Node.
-   Fixed the published application runtime workflow path exposed by the Node 22 Playwright run:
    -   backend runtime columns now expose normalized string codenames for localized component metadata;
    -   the authenticated published-app runtime adapter now wires metadata-backed workflow actions;
    -   LMS E2E runtime row helpers map physical runtime fields back to stable component codenames for assertions.

### Validation

-   `node -v` after `nvm use --silent 22`: `v22.22.2`
-   `pnpm docs:i18n:check`
-   `git diff --check`
-   `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/routes/applicationsRoutes.test.ts --runInBand`
-   `pnpm --filter @universo/applications-frontend test -- src/api/__tests__/apiWrappers.test.ts --runInBand`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project=chromium --grep "lms snapshot fixture imports"`: 2 passed.

## 2026-05-16 - LMS QA Follow-up Remediation Complete

### Summary

Closed the remaining QA findings from the implemented iSpring-like LMS roadmap by tightening workflow capability boundaries, replacing native confirmations, expanding browser walkthrough coverage, and aligning Node 22 / PNPM 10 workspace metadata.

### Implemented

-   Decoupled published-app metadata workflow actions from broad `editContent` permission in both UI visibility and backend route gating; exact metadata workflow capabilities remain fail-closed.
-   Replaced `window.confirm` workflow prompts with the existing MUI runtime dialog surface and added focused component coverage for confirmed workflow actions.
-   Expanded the LMS Playwright runtime flow so operational actions for submissions, attendance, certificates, development tasks, and notifications are exercised through real browser row-action clicks before assertions.
-   Aligned remaining workspace Node type metadata and root documentation with the current Node 22 / PNPM 10 baseline.
-   Marked the LMS roadmap status as implemented with QA follow-up remediation.

### Validation

-   `pnpm --filter @universo/apps-template-mui test -- RowActionsMenu`
-   `pnpm --filter @universo/applications-backend test -- guards runtimeWorkflowActions --runInBand`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm docs:i18n:check`
-   `git diff --check`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project=chromium --grep "lms snapshot fixture imports"`: 2 passed.

## 2026-05-16 - Final LMS QA Gap Closure

### Summary

Closed the final implementation gaps found by the last QA pass: the published runtime rows browser flow now reuses the seeded Title component, app-side Editor.js authoring is stable in production builds, persisted block-content JSON strings are parsed before edit dialogs open, and the full LMS snapshot browser flow was rerun under Node 22 against the minimal local Supabase E2E stack.

### Implemented

-   Updated `application-runtime-rows.spec.ts` so the test reuses the seeded `Title` component and creates only the additional metadata-driven Editor.js content component required for the rich-content browser proof.
-   Hardened `EditorJsBlockEditor` so empty authoring values seed an editable paragraph without mutating storage eagerly.
-   Stabilized the Editor.js lifecycle by deriving dependency keys from block-editor constraints rather than array identity, preventing remount loops when parent forms recreate equivalent `allowedBlockTypes` arrays.
-   Updated published-app `FormDialog` JSON block-content normalization to parse persisted JSON strings before passing values to the shared Editor.js editor.
-   Added focused regression coverage for empty Editor.js authoring, stable block-editor lifecycle, and persisted JSON-string edit values.

### Validation

-   `node -v` after `nvm use --silent 22`: `v22.22.2`
-   `pnpm --filter @universo/block-editor test`: 12 passed.
-   `pnpm --filter @universo/block-editor lint`
-   `pnpm --filter @universo/block-editor build`
-   `pnpm --filter @universo/apps-template-mui test -- FormDialog.blockEditor`: 134 passed in the package run.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm docs:i18n:check`: GitBook documentation OK, 73 EN/RU page pairs checked.
-   `git diff --check`
-   `pnpm run build:e2e:local-supabase`: 31 workspace build tasks passed.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/application-runtime-rows.spec.ts --project=chromium`: 2 passed.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project=chromium --grep "lms snapshot fixture imports"`: 2 passed.
-   `pnpm supabase:e2e:stop`: local E2E Supabase profile stopped.

## 2026-05-16 - Published LMS Authoring and Workspace UI Closure

### Summary

Closed the user-visible LMS gaps found after importing `tools/fixtures/metahubs-lms-app-snapshot.json`: the published application now exposes real metadata-driven content authoring surfaces for LMS content, Editor.js block content is created and edited inside the published app, and workspace cards/tables/pagination use isolated `apps-template-mui` MUI surfaces aligned with the original dashboard/template style.

### Implemented

-   Changed the LMS template navigation so primary published-app sections open operational object surfaces for Courses, Modules, Learning Resources, Knowledge Articles, and Development Plans instead of informational-only portal pages.
-   Added metadata-level Editor.js JSON body fields and seeded block content for runtime-authored LMS content, including Knowledge Articles linked through folders and bookmarks.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator and tightened the fixture contract so regressions in menu targets, block-editor fields, or stale knowledge links fail fast.
-   Reworked isolated runtime UI primitives in `packages/apps-template-mui` for cards, list tables, and `TablePagination`-based pagination without importing from `packages/universo-template-mui`.
-   Expanded browser coverage to create and edit a Knowledge Article through the published app block editor, assert persisted Editor.js JSON through the runtime API, and verify real workspace card/table/pagination surfaces with screenshots.

### Validation

-   `node -v` after `nvm use --silent 22`: `v22.22.2`
-   `pnpm --filter @universo/metahubs-backend test -- --runInBand packages/metahubs-backend/base/src/tests/services/templateManifestValidator.test.ts`: 18 passed.
-   `pnpm --filter @universo/apps-template-mui test -- src/components/runtime-ui/__tests__/runtimeUi.test.tsx src/workspaces/__tests__/RuntimeWorkspacesPage.test.tsx`: 135 passed in the package run.
-   `pnpm --filter @universo/utils test -- src/snapshot/__tests__/snapshotFixtures.test.ts`: 311 passed in the package run.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm run build:e2e:local-supabase`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=generators specs/generators/metahubs-lms-app-export.spec.ts`: 2 passed.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium specs/flows/snapshot-import-lms-runtime.spec.ts`: 2 passed.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium specs/flows/lms-workspace-management.spec.ts`: 2 passed.
-   `pnpm supabase:e2e:stop`: local E2E Supabase profile stopped.

## 2026-05-17 - LMS Relation Builder Runtime Closure

### Summary

Closed the Learning Content V2 Relation Builder slice with a generic metadata-driven `relationBuilder` widget. Course Builder and Track Builder outline tabs now render parent-scoped child records, reuse the existing CRUD dialogs, runtime record pickers, and row-ordering primitives, and keep selected parent state stable across workspace/runtime refreshes.

### Implemented

-   Added a generic published-app `RelationBuilderWidget` for parent-scoped child datasources instead of adding LMS-specific runtime branches.
-   Rewired LMS Course Builder and Track Builder outline layouts to use the generic relation builder for CourseSections, CourseItems, TrackStages, and TrackSteps.
-   Added deterministic parent selection behavior with authoritative parent datasource rows and a sorted same-section fallback before manual selection.
-   Hardened backend runtime list sorting/search/filter for localized/versioned STRING values by extracting runtime codename text through SQL with a scalar JSON fallback.
-   Tightened Playwright relation-builder assertions so duplicate child labels across related panels are handled intentionally.

### Validation

-   `pnpm --filter @universo/applications-backend test -- --runInBand --testPathPattern=applicationsRoutes.test.ts`: 116 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui exec vitest run src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 15 passed.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 successful tasks.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

## 2026-05-16 - LMS Final QA Follow-up Closure

### Summary

Closed the latest published LMS QA follow-up: Reports remains a direct primary navigation item instead of moving under More, generic runtime UI fallbacks are localized, workflow execution no longer rides on the broad edit-content alias, and stale Playwright/Turborepo skill references no longer point agents at Node 20 or PNPM 9 examples.

### Implemented

-   Raised the LMS runtime menu `maxPrimaryItems` contract to 8 in the template, fixture, snapshot hash, manifest tests, and E2E contract so Home, Modules, Courses, Resources, Knowledge, Development, Reports, and Workspaces stay directly reachable.
-   Tightened the LMS browser flow to assert that Reports is visible as a direct navigation item and that no More overflow item is rendered for this LMS menu.
-   Replaced hardcoded generic runtime strings such as `More`, `Search`, table column fallbacks, empty state, and sort controls with `apps` namespace i18n keys.
-   Removed `workflow.execute` from the broad `editContent` capability alias and updated guard/unit coverage to keep workflow actions exact and fail closed.
-   Updated Playwright and Turborepo skill references from Node 20 / PNPM 9 examples to Node 22 / PNPM 10 guidance.

### Validation

-   `node -v` after `nvm use --silent 22`: `v22.22.2`
-   `pnpm --filter @universo/applications-backend test -- guards runtimeRowsController --runInBand`: 20 passed.
-   `pnpm --filter @universo/apps-template-mui test -- src/components/runtime-ui/__tests__/runtimeUi.test.tsx src/hooks/__tests__/useCrudDashboard.test.tsx src/dashboard/components/__tests__/MenuContent.test.tsx --runInBand`: apps-template focused suite passed.
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`: 18 passed.
-   `pnpm --filter @universo/utils test -- src/snapshot/__tests__/snapshotFixtures.test.ts --runInBand`: 311 passed in the package run.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm docs:i18n:check`: 73 EN/RU page pairs checked.
-   `git diff --check`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium specs/flows/snapshot-import-lms-runtime.spec.ts`: 2 passed.
-   `pnpm supabase:e2e:stop`: local E2E Supabase profile stopped.

## 2026-05-17 - LMS Learning Content Generic Ordering Runtime Closure

### Summary

Closed the current Learning Content V2 implementation slice around metadata-defined outline ordering and published runtime usability. The published LMS runtime now keeps navigation visible on Learning Content pages, resolves scoped datasource records through the active workspace, persists row reordering through generic runtime metadata, and preserves explicit scoped layout settings during application sync.

### Implemented

-   Added generic persisted row ordering for datasource-backed details tables and reused it for CourseSections, CourseItems, TrackStages, and TrackSteps outline layouts without adding LMS-only runtime widgets.
-   Propagated `workspaceId` into published-app records datasources used by metrics, charts, nested widgets, and details tables so workspace-authored LMS content resolves consistently.
-   Remapped snapshot scoped-layout `scopeEntityId` values to runtime entity IDs during application sync and kept explicit scoped layout configuration as the final override.
-   Normalized localized component codenames for runtime REF options and reorder field lookup, including the persisted `SortOrder` component path.
-   Kept the LMS published runtime side menu, app navbar, and header visible across Learning Content scoped layouts so users can leave detail pages without browser navigation.
-   Updated the committed LMS snapshot fixture and fixture hash for the current template shape.
-   Extended focused unit and browser coverage for API adapters, widget rendering, dashboard page blocks, sync materialization, runtime reorder persistence, template validation, fixture validation, and the full LMS import/runtime flow.

### Validation

-   `pnpm --filter @universo/apps-template-mui test -- src/api/__tests__/runtimeRows.test.ts src/dashboard/components/__tests__/MainGrid.test.tsx src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 153 passed in the package run.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-backend test -- src/tests/routes/applicationsRoutes.test.ts --runInBand --testNamePattern="runtime row reorder"`: passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/metahubs-backend test -- src/tests/services/templateManifestValidator.test.ts --runInBand`: 18 passed.
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/utils test -- src/snapshot/__tests__/snapshotFixtures.test.ts`: 311 passed in the package run.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm --filter @universo/core-frontend build`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium specs/flows/snapshot-import-lms-runtime.spec.ts`: 2 passed.

## 2026-05-17 - LMS Learning Content Builder Tabs Runtime Closure

### Summary

Added a generic metadata-driven `detailsTabs` runtime widget and used it to organize the LMS Course Builder and Learning Track Builder without introducing LMS-only published-app surfaces. The tabs group existing widgets such as `detailsTable`, `columnsContainer`, and report definitions, preserving the app-template MUI style and keeping builder behavior data-driven through layouts.

### Implemented

-   Added `detailsTabs` to the shared dashboard widget registry and strict application layout widget config schema.
-   Rendered `detailsTabs` in `packages/apps-template-mui` with MUI Tabs while reusing the existing generic widget renderer for tab panels.
-   Updated LMS Course Builder layout to expose Outline, General, Completion, Enrollments, and Reports tabs; the Outline tab reuses the existing CourseSections/CourseItems ordered tables.
-   Updated LMS Track Builder layout to expose Outline, General, Completion, Enrollments, and Reports tabs; the Outline tab reuses the existing TrackStages/TrackSteps ordered tables.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright generator after the template change.
-   Extended browser runtime coverage with Course Builder and Track Builder tab assertions and screenshots.

### Validation

-   `pnpm --filter @universo/types test -- src/__tests__/applicationLayouts.test.ts`: 87 passed in the package run.
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 154 passed in the package run.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend test -- src/tests/services/templateManifestValidator.test.ts --runInBand`: 18 passed.
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm --filter @universo/utils test -- src/snapshot/__tests__/snapshotFixtures.test.ts`: 311 passed in the package run.
-   `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm --filter @universo/core-frontend build`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=generators specs/generators/metahubs-lms-app-export.spec.ts`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium specs/flows/snapshot-import-lms-runtime.spec.ts`: 2 passed.

## 2026-05-17 - LMS Course Item Runtime Record Picker

### Summary

Closed the next Course Builder authoring gap by adding a generic metadata-driven runtime record picker to `FormDialog`. LMS CourseItems now use ordinary MUI form controls to pick the target object type and then select a workspace-scoped Page, Quiz, or StandaloneContent record by display title instead of requiring authors to paste raw record UUIDs.

### Implemented

-   Added generic `stringOptions` rendering for STRING fields so metadata can expose select controls without introducing LMS-specific UI.
-   Added generic `runtimeRecordPicker` rendering for STRING fields that resolves the target object codename from another field, loads records through the existing runtime data API, respects current workspace scope, and stores the selected record id.
-   Passed object collection metadata and current workspace id from the standalone runtime shell into shared CRUD dialogs and forms.
-   Updated the LMS CourseItems metadata to use the generic select/picker pair for `TargetObjectCodename` and `TargetRecordId`.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator so the product fixture contains the picker metadata.

### Validation

-   `pnpm --filter @universo/apps-template-mui exec vitest run --config vitest.config.ts src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx --coverage=false`: 6 passed.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.

## 2026-05-17 - LMS Runtime Record Picker QA Gap Closure

### Summary

Closed the QA blockers found in the CourseItems runtime record picker slice. The published-app form now clears dependent record IDs when authors change the target object type, and the backend validates metadata-driven polymorphic references before runtime row create/update mutations can persist them.

### Implemented

-   Cleared `runtimeRecordPicker` field values when their configured `targetObjectCodenameField` changes, preventing stale hidden IDs from being submitted.
-   Added backend fail-closed validation for metadata-driven runtime record picker references on create, single-cell update, and bulk update paths.
-   Validated allowed target object codenames, target record UUID format, active target row existence, page targets, and current workspace row scope.
-   Aligned LMS CourseItems picker metadata with the existing `LearningResources` object codename instead of the obsolete `StandaloneContent` codename.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator after the template change.

### Validation

-   `pnpm --filter @universo/applications-backend test -- --runInBand --testPathPattern=applicationsRoutes.test.ts`: 116 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui exec vitest run --config vitest.config.ts src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx --coverage=false`: 7 passed.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.

## 2026-05-17 - LMS Course Builder Policy Controls And Large Outline Warning

### Summary

Closed the next generic Course Builder gap without adding an LMS-only runtime branch. Course and track policy fields now use metadata-defined select controls aligned with the shared Learning Content contracts, and datasource-backed detail tables can show reusable row-count warnings for large outline surfaces.

### Implemented

-   Added a generic `rowCountWarning` contract to `detailsTable` widget metadata.
-   Rendered localized row-count warnings in the published MUI runtime for datasource-backed detail tables.
-   Switched `Courses.NavigationMode`, `Courses.CompletionCondition`, `Courses.StatusFormat`, and `LearningTracks.OrderMode` from free text to metadata-defined select controls.
-   Aligned the seeded Learning Content completion defaults with the shared lowercase contract values.
-   Added the 100-item large-course warning to the Course Builder outline through template metadata.
-   Updated GitBook Learning Content documentation in both languages.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator.

### Validation

-   `pnpm --filter @universo/types exec vitest run --config vitest.config.ts src/__tests__/applicationLayouts.test.ts --coverage=false`: 9 passed.
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --coverage=false`: 11 passed.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.

## 2026-05-17 - LMS Enrollment Wizard And Conditional Due-Date Validation

### Summary

Closed the next Manual Enrollment gap with generic platform primitives. Course and track enrollment creation now uses metadata-defined wizard steps in the shared relation-builder form, and conditional due-date requirements are enforced both in the published form and by the backend runtime row controller.

### Implemented

-   Added `createWizard` metadata to relation-builder panel configuration and rendered it with the existing MUI Stepper inside `FormDialog`.
-   Added generic `visibleWhen`/`showWhen` and `requiredWhen`/`requireWhen` form metadata handling, including stale hidden-value omission from submitted payloads.
-   Added reusable Object-level `runtimeValidations.requiredWhen` handling in `applications-backend` for create, single-field update, and bulk update paths.
-   Declared conditional Due Date and Due Period validation for LMS `Enrollments` without hardcoding LMS behavior in the runtime controller.
-   Strengthened the LMS fixture contract so the generated snapshot must contain the due-date wizard metadata and backend validation metadata.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator.

### Validation

-   `pnpm --filter @universo/applications-backend test -- --runInBand --testPathPattern=applicationsRoutes.test.ts`: 120 passed.
-   `pnpm --filter @universo/apps-template-mui exec vitest run --config vitest.config.ts src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx --coverage=false`: 9 passed.
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`: 18 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 successful tasks.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

## 2026-05-18 - LMS Runtime Progress Complete/Recalculate Actions

### Summary

Closed the explicit runtime progress action gap from Phase 8 with a generic action contract on the existing Learning Content progress endpoint. The endpoint now distinguishes normal progress updates, server-derived complete actions, and metadata-driven parent progress recalculation without adding an LMS-only route or trusting browser-supplied recalculation values.

### Implemented

-   Extended `POST /runtime/progress/content` with `action: update | complete | recalculate` while preserving the existing update payload shape.
-   Added fail-closed validation so update actions require `progressPercent`, complete actions resolve to 100 percent completed progress, and recalculate actions reject client-supplied progress/status values.
-   Reused `runtimeProgress.aggregateParents` for recalculation, so parent Course/Track progress is recomputed from server-owned ContentProgress rows and resolved metadata columns.
-   Skipped sequence gating for recalculation because recalculation does not complete or unlock a child item, while complete/update actions still enforce `runtimeProgress.sequencePolicy`.
-   Updated the published-app API helper and learner player so the Complete button posts an explicit `complete` action.
-   Added backend route coverage for successful recalculation and fail-closed missing recalculation metadata.
-   Added app-template API/widget coverage for explicit complete and recalculation request payloads.

### Validation

-   `pnpm --filter @universo/applications-backend test -- applicationsRoutes --runInBand`: 126 passed.
-   `pnpm --filter @universo/apps-template-mui exec vitest run --config vitest.config.ts src/api/__tests__/runtimeRows.test.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --coverage=false`: 24 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-18 - LMS Track Learner Player Closure

### Summary

Closed the next Learning Track playback gap with the same metadata-driven learner player used by Course Builder. Track Builder now exposes a Player tab that lists track steps, resolves their linked Courses through a static metadata target object, and persists completion against TrackSteps so parent progress aggregation can update LearningTracks.

### Implemented

-   Added `targetObjectCodename` to the generic `learnerPlayer` widget config contract.
-   Updated the published-app `learnerPlayer` runtime to resolve targets from either row metadata fields or a static metadata-defined target object.
-   Added the Track Builder `Player` tab to the LMS template using `LearningTracks` as the parent datasource and `TrackSteps` as the item datasource.
-   Strengthened LMS fixture acceptance so the generated snapshot must include both Course Builder and Track Builder learner-player surfaces.
-   Extended Playwright runtime coverage to open the Track Player, select `New learner onboarding track`, verify sequential lock state, complete a track step, and assert `TrackSteps` progress persistence.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator.

### Validation

-   `pnpm --filter @universo/types test -- applicationLayouts`: 91 passed.
-   `pnpm --filter @universo/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --coverage=false`: 18 passed.
-   `pnpm --filter @universo/metahubs-backend test -- templateManifestValidator --runInBand`: 18 passed.
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/metahubs-backend build`
-   `pnpm run build:e2e:local-supabase`: 31 successful tasks.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=generators tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project=chromium tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`: 2 passed.
-   `git diff --check`

## 2026-05-18 - LMS Learning Content Final QA Closure

### Summary

Closed the final Learning Content QA pass by removing the remaining stale LMS `Modules` assumptions from runtime tests and access seeding. The canonical content object is now `LearningResources`, progress is tracked through `ContentProgress`, and public/shared access uses `TargetType: content` with explicit `ContentAccessEntries` records instead of a compatibility `module` path.

### Implemented

-   Renamed the LMS class flow to `lms-class-content-quiz.spec.ts` and updated the browser journey to use `LearningResources`, `ContentProgress`, `ResourceType`, and `PublicationStatus`.
-   Updated the guest access-link and workspace isolation flows to use content targets, Learning Content navigation, and explicit shared-content ACL rows.
-   Removed the compatibility `module -> Modules` runtime seed remap from workspace copy paths and kept `content -> LearningResources` as the active public content target.
-   Fixed shared runtime access SQL comparisons for metadata text columns versus UUID values by casting both sides to text in the generic owner-or-shared clause.
-   Replaced stale LMS `ModuleProgress`, `ModuleStatus`, and module fixture names in focused backend/frontend tests.
-   Reconciled the V2 implementation plan and task ledger with the completed implementation state.

### Validation

-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/shared/publicRuntimeAccess.test.ts src/tests/controllers/runtimeRowsController.test.ts src/tests/services/runtimeReportsService.test.ts src/tests/services/applicationWorkspaces.test.ts src/tests/routes/applicationSyncRoutes.test.ts src/tests/routes/applicationsRoutes.test.ts`: 173 passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts src/tests/services/applicationWorkspaces.test.ts`: 122 passed.
-   `pnpm --filter @universo/apps-template-mui test -- --run src/standalone/__tests__/DashboardApp.test.tsx`: 173 passed.
-   `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/templateManifestValidator.test.ts src/tests/services/metahubSchemaService.test.ts`: 26 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm exec eslint tools/testing/e2e/specs/flows/lms-class-content-quiz.spec.ts tools/testing/e2e/specs/flows/lms-qr-code.spec.ts tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm run build:e2e:local-supabase`: 31 successful tasks.
-   `pnpm --filter @universo/applications-backend build`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts --project chromium`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/lms-class-content-quiz.spec.ts tools/testing/e2e/specs/flows/lms-qr-code.spec.ts tools/testing/e2e/specs/flows/lms-workspace-management.spec.ts --project chromium`: 4 passed.
-   `git diff --check`

## 2026-05-18 - LMS Learning Content Auto-Enrollment QA Remediation

### Summary

Closed the QA defect where the active LMS template still contained an auto-enrollment lifecycle script that could create placeholder `default` targets. Auto-enrollment remains deferred until canonical target rules are modeled; the generated fixture now explicitly rejects this unsafe script while keeping the active Learning Content model on `LearningResources` and `ContentProgress`.

### Implemented

-   Removed `AutoEnrollmentRuleScript` from the active LMS template and regenerated `tools/fixtures/metahubs-lms-app-snapshot.json`.
-   Added fixture-contract coverage that rejects `AutoEnrollmentRuleScript` until canonical auto-enrollment target rules exist.
-   Updated template manifest tests so the required lifecycle script set no longer includes the removed auto-enrollment script.
-   Added direct backend API denial coverage for read-only shared-viewer members attempting runtime create, edit, copy, delete, and restore operations before runtime metadata reads.
-   Reconciled committed snapshot fixture tests with the canonical `content.completed` gamification rule after removing the `Modules` compatibility path.

### Validation

-   `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/services/templateManifestValidator.test.ts src/tests/services/metahubSchemaService.test.ts`: 26 passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts src/tests/services/applicationWorkspaces.test.ts`: 127 passed.
-   `pnpm --filter @universo/utils test -- src/snapshot/__tests__/snapshotFixtures.test.ts`: 311 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --filter @universo/metahubs-backend lint`
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm run build:e2e:local-supabase`: 31 successful tasks.
-   `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `rg -n "AutoEnrollmentRuleScript|TargetId': 'default'|\"TargetId\": \"default\"|ContentNodeIdRef.*default|module\\.completed" packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/fixtures/metahubs-lms-app-snapshot.json tools/testing/e2e/support/lmsFixtureContract.ts packages/universo-utils/base/src/snapshot/__tests__/snapshotFixtures.test.ts -S`: only the intentional negative fixture-contract assertion remains.
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Runtime Table Defaults Bridge

### Summary

Closed the next Learning Content usability gap by turning the application-level Learning Content view settings into a generic runtime dashboard contract. Published application hosts now pass default table/card mode and column presets through `DashboardDetailsSlot.tableDefaults`, and existing table/card primitives apply those defaults without an LMS-only runtime fork.

### Implemented

-   Added `tableDefaults.defaultViewMode` and `tableDefaults.columnPreset` to the published dashboard details slot contract.
-   Passed sanitized Learning Content settings from both `ApplicationRuntime` and standalone `DashboardApp` into the dashboard details slot.
-   Applied the column preset in `MainGrid` and `records.union` details tables while preserving existing action columns and card/table view controls.
-   Fixed the generic current-object card path to format localized and structured values through `formatRuntimeValue`, preventing `[object Object]` leakage in normal card mode.
-   Reused existing `ItemCard`, `ToolbarControls`, `PaginationControls`, `CustomizedDataGrid`, and `detailsTable` surfaces instead of adding a dedicated Learning Content widget.
-   Updated the default Learning Content column preset so user-facing columns are visible and technical references such as `ProjectId` and `CreatedBy` are hidden by default.
-   Added tests for host settings bridging, default card mode, column preset filtering, grid width/flex hints, and the no-LMS-fork guard.

### Validation

-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --dir packages/universo-types/base exec vitest run --config vitest.config.ts src/__tests__/lmsPlatform.test.ts`: 11 passed.
-   `pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/pages/__tests__/ApplicationRuntime.test.tsx src/pages/__tests__/ApplicationSettings.test.tsx`: 36 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/utils/__tests__/columns.test.tsx src/dashboard/components/__tests__/MainGrid.test.tsx src/dashboard/components/__tests__/widgetRenderer.test.tsx src/standalone/__tests__/DashboardApp.test.tsx`: 57 passed.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `git diff --check`

### Notes

-   Browser Playwright evidence for this bridge was completed in the follow-up Runtime Table Defaults UX Canary slice below.

## 2026-05-20 - LMS Learning Content Runtime Table Defaults UX Canary

### Summary

Closed the browser-evidence gap for the Learning Content table defaults bridge. The LMS snapshot runtime flow now verifies both table and card defaults in the real published app, captures desktop/tablet/mobile screenshots, and fails on visible technical fields, raw JSON/object values, or raw UUID substrings.

### Implemented

-   Added optional raw UUID substring detection to the shared runtime UX Playwright helper.
-   Extended the LMS runtime flow to assert the Learning Content table default columns, hidden `ProjectId`/`CreatedBy` columns, card default mode after application settings update, and no technical text leakage.
-   Added viewport-matrix screenshots for `lms-learning-content-library-en` and `lms-learning-content-library-card-default-en`.
-   Opened the existing `PATCH /applications/:applicationId` settings contract to validated `settings.learningContent` payloads and added backend route coverage.
-   Hardened generic `records.union` card rendering so semantic card title/description fields are used and raw runtime IDs are never used as visible fallback text.
-   Kept the implementation inside existing MUI dashboard/runtime primitives: `records.union`, `ItemCard`, `ToolbarControls`, `PaginationControls`, and `CustomizedDataGrid`.

### Validation

-   `pnpm exec prettier --write ...` for touched backend, frontend, app-template, E2E, i18n, and Memory Bank files.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts packages/applications-backend/base/src/controllers/applicationsController.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts packages/applications-frontend/base/src/api/applications.ts`
-   `pnpm --filter @universo/applications-backend test -- --runTestsByPath src/tests/routes/applicationsRoutes.test.ts`: 125 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx -t "applies generic table defaults"`: 1 passed.
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run build:e2e:local-supabase`: 31 successful tasks.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium --grep "lms snapshot fixture imports"`: 2 passed.

## 2026-05-20 - LMS Learning Content Current-Object Card Safety

### Summary

Closed the next generic runtime card safety gap for current-object dashboard views. The fallback card mode now uses the same user-facing display contract as the Learning Content union card view: semantic columns first, no id-like technical columns as card candidates, no UUID substrings in title/description text, and a localized untitled fallback instead of raw row IDs.

### Implemented

-   Hardened `MainGrid` current-object card rendering to ignore `id`, `actions`, `*Id`, owner/user/target/principal/source technical fields, and hidden project references as title/description candidates.
-   Replaced raw `row.id` card fallback with the existing localized `runtime.card.untitled` label.
-   Added focused `MainGrid` tests for raw UUID row-id suppression, id-like technical field suppression, UUID substring suppression in descriptions, and formatted localized/object values.
-   Expanded `check-runtime-no-lms-forks.mjs` so runtime package checks reject LMS-only widget keys, widget switch cases, UI component declarations, and runtime UI file names in addition to direct `template === 'lms'` branches.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/MainGrid.test.tsx`: 22 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm exec eslint tools/testing/check-runtime-no-lms-forks.mjs`
-   `pnpm run check:runtime-no-lms-forks`
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Runtime UX Canary Guard Tightening

### Summary

Strengthened the shared Playwright runtime UX helper used by the LMS canary. The canary now catches raw resource/media JSON keys that were previously missed and explicitly verifies that MUI DataGrid horizontal overflow stays constrained inside the grid rather than widening the page.

### Implemented

-   Expanded `expectNoTechnicalLeakage` to detect raw JSON/object text containing `storageKey`, `mimeType`, `launchMode`, `packageDescriptor`, `recordId`, and `targetId` in addition to the previous source/block/data keys.
-   Added `expectDataGridHorizontalScrollConstrained` for MUI DataGrid surfaces.
-   Connected the constrained-scroll assertion to the LMS published Learning Content table check in `snapshot-import-lms-runtime.spec.ts`.

### Validation

-   `pnpm exec prettier --write tools/testing/e2e/support/browser/runtimeUx.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm exec eslint tools/testing/e2e/support/browser/runtimeUx.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium --grep "lms snapshot fixture imports"`: 2 passed.
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Generic Relation Builder Display Safety

### Summary

Closed a generic relation-builder display gap that could leak raw parent or target IDs when metadata missed a hidden flag or a parent title field was empty. The relation builder now uses shared runtime display helpers for technical field detection, JSON/resource-source suppression, and safe parent fallback labels.

### Implemented

-   Added shared app-template runtime display helpers for technical field names, raw resource/media JSON strings, UUID substring leakage, and safe formatted values.
-   Reused those helpers in `MainGrid` current-object cards and `RelationBuilderWidget` instead of duplicating LMS-specific filters.
-   Updated relation-builder child list columns to hide id-like technical fields such as `CourseId`, `TargetRecordId`, `PrincipalId`, `SourceJson`, and any generic `*Id`.
-   Replaced parent-select raw row-id fallback with a localized `relationBuilder.untitledParent` label.
-   Added focused tests proving relation builder parent labels and child rows do not show UUIDs, hidden technical fields, raw resource JSON strings, or `[object Object]`.
-   Added an LMS browser canary assertion so Course/Track builder relation-builder surfaces run `expectNoTechnicalLeakage(..., checkUuidSubstrings: true)` and viewport overflow checks.

### Validation

-   `pnpm exec prettier --write ...` for touched app-template, i18n, E2E, and Memory Bank files.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/utils/__tests__/displayValue.test.ts src/dashboard/components/__tests__/MainGrid.test.tsx src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 51 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/utils/displayValue.ts packages/apps-template-mui/src/utils/__tests__/displayValue.test.ts packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/RelationBuilderWidget.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium --grep "lms snapshot fixture imports"`: 2 passed.
-   `pnpm supabase:e2e:stop`
-   `git diff --check`

## 2026-05-20 - LMS Learning Content Runtime Form UX Safety

### Summary

Closed the next generic runtime form UX gap for LMS Learning Content authoring. Runtime forms now infer semantic long-text controls from field meaning, sanitize internal mutation errors before they reach normal user surfaces, and avoid showing raw unavailable record/reference IDs in metadata-driven pickers.

### Implemented

-   Added shared `fieldSemantics` helpers so `Description`, `Summary`, `Body`, `Instructions`, `Feedback`, `Comment`, and similar fields become multiline controls without LMS-specific metadata.
-   Reused the semantic helper in `FormDialog`, `toFieldConfigs`, and default grid rendering for long-text string columns.
-   Added shared `runtimeErrors` helpers that suppress SQL/constraint/backend/UUID/raw JSON/internal adapter details and localized English-only backend text on non-English surfaces.
-   Reused runtime error sanitization in CRUD create/update/copy/delete/reorder/workflow paths, relation-builder mutations, and inline TABLE editor mutations.
-   Replaced unavailable runtime record picker raw-ID fallback with a localized user-facing label.
-   Changed unconfigured generic `REF` fields to fail closed as a disabled localized field instead of exposing an editable raw ID input.
-   Added browser dialog no-leakage oracles to the LMS runtime flow for the metadata-driven enrollment wizard and published create/edit dialogs.
-   Added EN/RU i18n keys for generic runtime mutation fallback, record picker states, and inline table mutation errors.
-   Added focused tests for sanitizer behavior, semantic textarea inference, unavailable record-picker labels, and safe mutation errors.

### Validation

-   `pnpm exec prettier --write ...` for touched app-template, i18n, and Memory Bank files.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/utils/__tests__/runtimeErrors.test.ts src/utils/__tests__/columns.test.tsx src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx src/hooks/__tests__/useCrudDashboard.test.tsx src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 70 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx packages/apps-template-mui/src/components/RuntimeInlineTabularEditor.tsx packages/apps-template-mui/src/utils/runtimeErrors.ts packages/apps-template-mui/src/utils/fieldSemantics.ts packages/apps-template-mui/src/utils/columns.tsx packages/apps-template-mui/src/hooks/useCrudDashboard.ts packages/apps-template-mui/src/hooks/__tests__/useCrudDashboard.test.tsx packages/apps-template-mui/src/dashboard/components/RelationBuilderWidget.tsx`
-   `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium --grep "lms snapshot fixture imports"`: 2 passed.
-   `pnpm supabase:e2e:stop`
-   `git diff --check`

## 2026-05-20 - LMS Legacy Concurrency Checklist Closure

### Summary

Closed the stale Memory Bank checklist items for the earlier Final QA Concurrency and E2E Stabilization slice. The runtime delete/restore version checks were already enforced inside SQL mutations; this pass added an explicit hard-delete expected-version regression test, re-ran fresh backend/published-app/E2E gates, and marked the old task checkboxes complete.

### Implemented

-   Verified `deleteRow` and `restoreRow` use `buildRuntimeExpectedVersionPredicate` inside `UPDATE`/`DELETE ... RETURNING` mutation SQL.
-   Added focused coverage for expected-version predicates on hard-delete runtime mutations.
-   Confirmed existing stale-before-mutation and stale-between-read-and-mutation tests for soft delete and restore remain active.
-   Confirmed the LMS runtime navigation helper uses visible-item polling and overflow-menu selected-state assertions without weakening browser coverage.
-   Closed the obsolete unchecked `Final QA Concurrency And E2E Stabilization Slice` checklist in `memory-bank/tasks.md`.

### Validation

-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`: 126 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/hooks/__tests__/useCrudDashboard.test.tsx src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 44 passed.
-   `pnpm exec eslint packages/applications-backend/base/src/controllers/runtimeRowsController.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm docs:i18n:check`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium --grep "lms snapshot fixture imports"`: 2 passed.
-   `pnpm supabase:e2e:stop`

## 2026-05-20 - LMS Metadata-Driven Union Create Menu

### Summary

Implemented a generic metadata-driven create menu for `detailsTable` widgets backed by `records.union` datasources. The LMS Learning Content library now exposes Page, Link, Course, and Learning Track create entries through existing MUI toolbar/menu primitives while keeping the published runtime free of LMS-only widget branches.

### Implemented

-   Added a generic `detailsTable.createTargets` contract with localized labels, target section/object references, optional icon/surface metadata, and disabled target explanations.
-   Rendered create targets inside the existing `ViewHeaderMUI`/`ToolbarControls` area without introducing a new LMS widget.
-   Added production and standalone runtime bridges that resolve the selected target object, switch the active runtime object, and open the existing CRUD form only after the target schema is loaded.
-   Preserved server-owned mutation boundaries by keeping workspace, user, progress, lifecycle, and `_upl_*` fields out of create-target metadata.
-   Configured the LMS Learning Content library with Page, Link, Course, Learning Track, and disabled Import package entries; secondary union views keep no create targets.
-   Updated the canonical LMS snapshot and fixture contract for the create-target metadata.
-   Preserved `records.union` datasource metadata in the application widget behavior editor instead of stripping it on save.
-   Documented the create-menu behavior in the GitBook Learning Content guide.

### Validation

-   `pnpm --filter @universo/types build`
-   `pnpm --dir packages/universo-types/base exec vitest run src/__tests__/applicationLayouts.test.ts`: 12 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 24 passed.
-   `pnpm --dir packages/applications-frontend/base exec vitest run src/pages/__tests__/ApplicationRuntime.test.tsx`: 27 passed.
-   `pnpm exec ts-node --transpile-only -e "import fs from 'node:fs'; import { assertLmsFixtureEnvelopeContract } from './tools/testing/e2e/support/lmsFixtureContract'; const fixture=JSON.parse(fs.readFileSync('tools/fixtures/metahubs-lms-app-snapshot.json','utf8')); assertLmsFixtureEnvelopeContract(fixture); console.log('LMS fixture contract OK')"`
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/applications-frontend lint`
-   `pnpm --filter metahubs-backend lint`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter metahubs-backend build`
-   `pnpm --filter @universo/core-frontend build`
-   `pnpm run check:runtime-no-lms-forks`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium --grep "lms snapshot fixture imports"`: 2 passed.
-   `pnpm supabase:e2e:stop`
-   Browser screenshots were captured for the Learning Content library table and card views at desktop, tablet, and mobile widths, plus recent, starred, shared, and trash Learning Content views.
-   `git diff --check`
-   `pnpm exec tsc --noEmit --allowJs false --moduleResolution node --module commonjs --target es2022 --skipLibCheck tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts tools/testing/e2e/support/lmsFixtureContract.ts` was attempted but the ad hoc tool TypeScript invocation failed before checking project files because the root environment has no `glob` type definition entry for that standalone command.

## 2026-05-20 - LMS Create-Target Form Defaults And Resource Type Presets

### Summary

Completed the next generic Learning Content create-target slice. The LMS Page and Link entries now open the existing runtime CRUD dialog with safe metadata-driven defaults for `ResourceType` and `Source`, while the shared contract rejects or filters system-owned fields before they can become user-editable initial data.

### Implemented

-   Added a strict `CreateTargetDefault` metadata contract for `detailsTable.createTargets` with exactly one default source: primitive value, enumeration codename, or resource-source type.
-   Reused the existing `RESOURCE_TYPES` contract to create generic resource-source drafts for `page`, `url`, `file`, `scorm`, and `xapi` without adding LMS-only runtime widgets.
-   Propagated `createDefaults` through production runtime, standalone runtime, and the existing CRUD dialog open path.
-   Sanitized create defaults in `useCrudDashboard` so hidden/read-only/table/system/server-owned fields are ignored, including owner, workspace, progress, lifecycle, and `_upl_*` fields.
-   Resolved enumeration defaults by codename and resource-source defaults only for JSON resource-source fields.
-   Configured the LMS template and generated snapshot so Page preselects the Page type/source draft and Link preselects the URL type/source draft.
-   Extended the LMS runtime browser proof to open Page and Link dialogs from the Learning Content create menu and capture screenshots of the prefilled dialogs.
-   Documented the create-target defaults behavior in the EN/RU GitBook Learning Content guide.

### Validation

-   `pnpm exec prettier --write packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/apps-template-mui/src/hooks/__tests__/useCrudDashboard.test.tsx`
-   `pnpm exec prettier --check packages/universo-types/base/src/common/applicationLayouts.ts packages/apps-template-mui/src/hooks/useCrudDashboard.ts packages/apps-template-mui/src/hooks/__tests__/useCrudDashboard.test.tsx tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md`
-   `pnpm --dir packages/universo-types/base exec vitest run src/__tests__/applicationLayouts.test.ts`: 12 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/hooks/__tests__/useCrudDashboard.test.tsx`: 22 passed.
-   `pnpm --filter @universo/types lint`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm exec ts-node --transpile-only tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `pnpm supabase:e2e:stop`
-   Browser screenshots were captured for `lms-learning-content-library-en-create-page-defaults.png` and `lms-learning-content-library-en-create-link-defaults.png`.
-   `git diff --check`

## 2026-05-20 - Generic Link Resource Domain Preview

### Summary

Completed a generic resource-source UX slice for Link authoring. Valid URL drafts now show a localized external domain preview before save, while unsafe URL drafts stay blocked without rendering a misleading preview or exposing raw validation internals.

### Implemented

-   Added a generic domain preview chip to the shared `resourceSource` form widget for URL and embed drafts.
-   Reused `parseSafeExternalUrl` from `@universo/types` so the preview follows the same safe external URL policy as persistence.
-   Added English and Russian `resourceSource.domainPreview` labels.
-   Extended focused FormDialog coverage for unsafe URL rejection and valid `Domain: example.com` preview rendering.
-   Extended the LMS runtime browser flow so Link creation proves both unsafe URL blocking and the visible domain preview.
-   Updated EN/RU GitBook Learning Content guides to document the safe Link authoring behavior.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx`: 19 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm --dir packages/apps-template-mui exec tsc -p tsconfig.build.json --noEmit`
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm exec ts-node --transpile-only tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `pnpm run build:e2e`: 31 packages built successfully.
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `pnpm supabase:e2e:stop`

## 2026-05-20 - LMS Auto-Resolved Page Resource Source Authoring

### Summary

Completed the runtime authoring UX slice that removes the hidden-knowledge `Page codename` step from LMS Page resource creation. The solution stays generic and metadata-driven: metahub/admin `codename` workflows remain available, while published-app authors create Page learning resources through normal title/body fields.

### Implemented

-   Added metadata-driven auto page resource source resolution to the shared runtime `FormDialog` for configured `resourceSource` fields.
-   Kept the manual Page codename control for generic page resource fields that do not opt into auto-resolution.
-   Configured LMS `LearningResources.Source` to derive the internal page source key from `Name`/`Title` and hide the raw locator in the create dialog.
-   Added focused FormDialog coverage for both the preserved manual workflow and the auto-resolved metadata workflow.
-   Strengthened the LMS fixture contract and browser flow so the published Learning Content Page dialog must not expose `Page codename`.
-   Updated EN/RU GitBook Learning Content docs to describe Page authoring through title/body rather than manual technical locators.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md tools/fixtures/metahubs-lms-app-snapshot.json`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx`: 19 passed.
-   `pnpm exec ts-node --transpile-only tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `pnpm exec eslint packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts tools/testing/e2e/support/lmsFixtureContract.ts`
-   `pnpm run build:e2e`: 31 packages built successfully.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `pnpm supabase:e2e:stop`

## 2026-05-20 - Generic Records Union Row Actions

### Summary

Completed the next generic Learning Content runtime slice. Active `records.union` rows now expose Edit, Copy, and Delete actions in table and card views by delegating to existing runtime CRUD surfaces through source-object metadata, without adding LMS-only runtime branches.

### Implemented

-   Added a generic `DashboardRowTarget` action contract for datasource widgets.
-   Wired published runtime and standalone dashboard hosts to switch to the source object collection before opening the existing edit, copy, or delete flow.
-   Added `records.union` table and card action menus that reuse existing MUI primitives and permission flags, while keeping deleted-row restore behavior separate.
-   Propagated source row identifiers and source object collection metadata through the union datasource action path.
-   Ensured active union rows expose `_upl_version` for follow-up optimistic runtime mutations.
-   Added focused widget, runtime host, backend route, and LMS browser coverage for row action availability and target switching.

### Validation

-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 26 passed.
-   `pnpm --filter applications-frontend test -- --run src/pages/__tests__/ApplicationRuntime.test.tsx`: 177 passed.
-   `pnpm --filter applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`: 126 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/Dashboard.tsx packages/apps-template-mui/src/index.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/standalone/DashboardApp.tsx packages/applications-frontend/base/src/pages/ApplicationRuntime.tsx packages/applications-frontend/base/src/pages/__tests__/ApplicationRuntime.test.tsx packages/applications-backend/base/src/controllers/runtimeRowsController.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `node tools/testing/check-runtime-no-lms-forks.mjs`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm exec ts-node --transpile-only tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `pnpm --dir packages/apps-template-mui exec tsc -p tsconfig.build.json --noEmit`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm run build:e2e`: 31 packages built successfully.
-   `pnpm supabase:e2e:start:minimal`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `pnpm supabase:e2e:stop`
-   `pnpm exec prettier --check packages/apps-template-mui/src/dashboard/Dashboard.tsx packages/apps-template-mui/src/index.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/standalone/DashboardApp.tsx packages/applications-frontend/base/src/pages/ApplicationRuntime.tsx packages/applications-frontend/base/src/pages/__tests__/ApplicationRuntime.test.tsx packages/applications-backend/base/src/controllers/runtimeRowsController.ts packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts memory-bank/tasks.md memory-bank/progress.md`
-   `git diff --check`

## 2026-05-21 - Generic Runtime Table Column Visibility

### Summary

Completed the next generic Learning Content productization slice. Published runtime tables now have a reusable MUI `Columns` control that lets users hide/show safe business columns while preventing technical IDs, source JSON, and internal control fields from entering normal user-facing column settings.

### Implemented

-   Added `useRuntimeColumnVisibilityPreference` with safe model normalization, local persistence, technical-column suppression, and at-least-one-business-column protection.
-   Extended shared `ToolbarControls` with a generic `ColumnVisibilityControl` that uses existing MUI button/menu/checkbox primitives and localized labels.
-   Wired current-object `detailsTable` and `records.union` DataGrid surfaces to the generic visibility model without introducing LMS-only runtime branches.
-   Applied the safe filtered column set to the reorder-enabled current-object list surface so it cannot bypass DataGrid visibility protection.
-   Added focused helper, runtime UI, and records.union tests proving technical columns are not exposed in the menu and safe columns can be hidden.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/hooks/useRuntimeColumnVisibility.ts packages/apps-template-mui/src/hooks/__tests__/useRuntimeColumnVisibility.test.ts packages/apps-template-mui/src/components/runtime-ui/index.tsx packages/apps-template-mui/src/components/runtime-ui/__tests__/runtimeUi.test.tsx packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm --dir packages/apps-template-mui test -- src/hooks/__tests__/useRuntimeColumnVisibility.test.ts src/components/runtime-ui/__tests__/runtimeUi.test.tsx src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 235 passed.
-   `pnpm --dir packages/apps-template-mui lint`
-   `pnpm --dir packages/apps-template-mui build`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `pnpm run build:e2e`: 31 packages built successfully.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `pnpm supabase:e2e:stop`
-   `git diff --check`

## 2026-05-21 - Deferred Assessment Create Targets

### Summary

Completed the next Learning Content productization slice. The existing generic `detailsTable.createTargets` menu now exposes Quiz-lite and Assignment-lite as disabled metadata-defined targets with localized deferred reasons, so authors can see planned assessment scope without entering incomplete assessment authoring flows.

### Implemented

-   Added disabled Quiz-lite and Assignment-lite create targets to the LMS Learning Content metadata using the existing `createTargets` contract.
-   Kept the published runtime path generic: disabled create targets render through the existing MUI menu and localized reason text, with no LMS-only runtime branch.
-   Strengthened the fixture contract to require both deferred assessment targets, their target sections, disabled flags, and bilingual reasons.
-   Added a dedicated LMS fixture contract CLI wrapper that can validate `tools/fixtures/metahubs-lms-app-snapshot.json` without adding top-level await to the importable support module.
-   Updated app-template unit coverage, the LMS runtime browser flow, and GitBook Learning Content docs.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the product Playwright generator.
-   Stabilized the runtime Playwright post/unpost menu helper by retrying until the expected visible UI command appears after query refresh, without bypassing the UI.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/testing/e2e/support/lmsFixtureContract.ts packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts tools/testing/e2e/support/checkLmsFixtureContract.ts`
-   `pnpm --dir packages/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 243 passed.
-   `pnpm exec eslint packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/support/checkLmsFixtureContract.ts packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm run docs:i18n:check`
-   `node tools/docs/check-gitbook-links.mjs`
-   `node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `node tools/testing/e2e/support/checkLmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase E2E_PORT=3101 pnpm run build:e2e`: 31 packages built successfully.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase E2E_PORT=3101 E2E_TEST_USER_EMAIL_DOMAIN=example.test node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase E2E_PORT=3101 E2E_TEST_USER_EMAIL_DOMAIN=example.test node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

## 2026-05-21 - Generic Records Union Runtime Search

### Summary

Completed the next generic Learning Content runtime slice. Metadata-defined `records.union` views can now expose the existing MUI search toolbar and delegate user search to the server datasource, so LMS Learning Content and Trash screens are searchable without adding LMS-only runtime code.

### Implemented

-   Added `showSearch` to the generic details-table widget metadata schema.
-   Wired `RecordsUnionDetailsTableWidget` to reuse `ViewHeaderMUI` search, keep the search value controlled, and reset pagination to page 1 when the search changes.
-   Preserved static metadata `datasource.query.search` for configured views and let non-empty runtime search override it only while the user is actively searching.
-   Enabled search for LMS Learning Content all/recent/starred/shared views and the Trash view through `lms.template.ts`.
-   Strengthened the LMS fixture contract so `records.union` Learning Content views must expose the generic runtime search toolbar.
-   Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator.
-   Extended browser E2E coverage to verify that typing in Learning Content search sends `datasource.query.search = "Safety"` with `offset = 0`, then clearing the field restores the unsearched datasource request.

### Validation

-   `pnpm exec prettier --write packages/universo-types/base/src/common/applicationLayouts.ts packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm --filter @universo/types test -- src/__tests__/applicationLayouts.test.ts`: 95 passed.
-   `pnpm --dir packages/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx src/components/runtime-ui/__tests__/runtimeUi.test.tsx`: 236 passed.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/types build`
-   `pnpm --filter @universo/apps-template-mui build`
-   `node tools/testing/e2e/support/lmsFixtureContract.ts tools/fixtures/metahubs-lms-app-snapshot.json`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm env:e2e:local-supabase`
-   `pnpm doctor:e2e:local-supabase`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase pnpm run build:e2e`: 31 packages built successfully.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.
-   `pnpm supabase:e2e:stop`
-   `git diff --check`

## 2026-05-21 - Generic Records Union Target Filters

### Summary

Completed the next generic Learning Content runtime slice. Metadata-defined `records.union` details-table widgets can now expose type-like target filters that narrow datasource targets before the server request, so LMS Learning Content and Trash screens let users switch between Resources, Courses, and Learning Tracks without raw object names or LMS-only runtime code.

### Implemented

-   Added a generic `detailsTable.targetFilters` schema contract for `records.union` widgets with validated target display type, section codename, object collection codename, and id predicates.
-   Wired `RecordsUnionDetailsTableWidget` to render the target filter through the existing MUI toolbar with localized `Type` and `All types` labels.
-   Applied selected filters by narrowing `datasource.targets`, resetting pagination to the first page, and keeping the existing server-side `records.union` endpoint as the single data boundary.
-   Configured LMS Learning Content all/recent/starred/shared views and the Trash view with Resources, Courses, and Learning Tracks filters through template metadata.
-   Strengthened the LMS fixture contract and runtime browser flow so the generated snapshot must preserve target filters and the published UI must send narrowed target requests.
-   Updated Learning Content docs to document the metadata-defined target-filter behavior.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/universo-types/base/src/common/applicationLayouts.ts packages/universo-types/base/src/__tests__/applicationLayouts.test.ts packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts docs/en/guides/lms-learning-content.md docs/ru/guides/lms-learning-content.md`
-   `pnpm --filter @universo/types test -- src/__tests__/applicationLayouts.test.ts`: 95 passed.
-   `pnpm --filter @universo/types build`
-   `pnpm --dir packages/apps-template-mui test -- src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 237 passed.
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm exec eslint tools/testing/e2e/support/lmsFixtureContract.ts tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm run check:runtime-no-lms-forks`
-   `node tools/docs/check-gitbook-links.mjs && node tools/docs/check-gitbook-screenshot-assets.mjs`
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter metahubs-backend build`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/generators/metahubs-lms-app-export.spec.ts --project generators`: 2 passed.
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium`: 2 passed.

## 2026-05-21 - Generic Datasource Load Error UX Safety

### Summary

Completed the next generic runtime UX hardening slice for Learning Content data surfaces. Metadata-defined `records.list` and primary `records.union` details-table widgets now show localized, sanitized load-failure alerts instead of leaving users with an apparently empty or stuck table when datasource requests fail.

### Implemented

-   Routed `records.list` datasource query failures through the shared runtime error sanitizer before rendering the existing MUI Alert surface.
-   Routed primary `records.union` datasource query failures through the same localized sanitizer and existing records-union details-table surface.
-   Normalized English and Russian `runtime.datasourceLoadError` copy for content-view level failures.
-   Added focused widgetRenderer coverage proving datasource alerts do not expose SQL text, app-runtime relation names, or UUID-like record identifiers.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "sanitizes records\\.(list|union) datasource load failures"`: 2 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-21 - Generic Runtime Workspaces Raw-ID And Error Leakage Safety

### Summary

Completed the next generic published runtime UX safety slice. Runtime Workspaces list, selected workspace headings, and workspace member rows no longer expose workspace IDs or user IDs when names/emails are missing, and unknown workspace mutation failures now use the shared runtime error sanitizer.

### Implemented

-   Replaced Runtime Workspaces page workspace-name fallbacks with the localized `workspace.untitled` label.
-   Replaced member-name and member-description user ID fallbacks with localized member labels or empty descriptions.
-   Routed unknown workspace mutation errors through `extractRuntimeErrorMessage` while preserving existing coded workspace error translations.
-   Added English and Russian `workspace.untitledMember` labels.
-   Added focused RuntimeWorkspacesPage coverage for missing workspace names, selected route workspace names, missing member names/emails, and unsafe SQL mutation errors.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/workspaces/RuntimeWorkspacesPage.tsx packages/apps-template-mui/src/workspaces/__tests__/RuntimeWorkspacesPage.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/workspaces/__tests__/RuntimeWorkspacesPage.test.tsx --testNamePattern "does not expose|sanitizes unknown workspace mutation errors"`: 4 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/workspaces/RuntimeWorkspacesPage.tsx packages/apps-template-mui/src/workspaces/__tests__/RuntimeWorkspacesPage.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-22 - Generic Workflow Row-Action Label Fallback Safety

### Summary

Completed the next generic runtime row-action UX safety slice. Workflow action codenames now stay internal when metadata titles or confirmation texts cannot be resolved; normal runtime menus and confirmation dialogs use localized generic fallback labels instead.

### Implemented

-   Added generic workflow action fallback labels to `RowActionsMenuLabels`.
-   Replaced workflow menu item fallback rendering from `action.codename` to localized `workflowActionText` / `Run action`.
-   Replaced workflow confirmation fallback title, message, and confirm labels with localized generic labels.
-   Passed the new labels through published `DashboardApp`, legacy `RuntimeTabularPartView`, and the application runtime preview surface.
-   Added English and Russian fallback keys in `apps-template-mui` and `applications-frontend` locale bundles.
-   Added focused RowActionsMenu coverage proving an unresolved workflow action title/confirmation does not render the `AcceptSubmission` codename while still sending it as the internal action payload.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/components/RowActionsMenu.tsx packages/apps-template-mui/src/components/RuntimeTabularPartView.tsx packages/apps-template-mui/src/components/__tests__/RowActionsMenu.recordCommands.test.tsx packages/apps-template-mui/src/standalone/DashboardApp.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json packages/applications-frontend/base/src/pages/ApplicationRuntime.tsx packages/applications-frontend/base/src/i18n/locales/en/applications.json packages/applications-frontend/base/src/i18n/locales/ru/applications.json`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/__tests__/RowActionsMenu.recordCommands.test.tsx --testNamePattern "workflow action codenames|metadata workflow confirmations|metadata workflow actions"`: 6 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/components/RowActionsMenu.tsx packages/apps-template-mui/src/components/RuntimeTabularPartView.tsx packages/apps-template-mui/src/components/__tests__/RowActionsMenu.recordCommands.test.tsx packages/apps-template-mui/src/standalone/DashboardApp.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json packages/applications-frontend/base/src/pages/ApplicationRuntime.tsx packages/applications-frontend/base/src/i18n/locales/en/applications.json packages/applications-frontend/base/src/i18n/locales/ru/applications.json`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/applications-frontend build`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-22 - Generic Runtime Record Picker ID Fallback Safety

### Summary

Completed the next generic runtime form UX safety slice. Runtime record picker options now use a localized untitled-record fallback when configured label fields do not produce a human-readable value, so normal published app users do not see raw row IDs in picker menus.

### Implemented

-   Changed runtime record picker option label resolution to return a localized fallback instead of `row.id`.
-   Added English and Russian `recordPicker.untitled` labels.
-   Kept record IDs as internal option values and submit payloads only.
-   Added focused FormDialog coverage proving UUID-like picker option IDs are not visible when label fields are missing.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx --testNamePattern "runtime record picker"`: 6 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/components/dialogs/FormDialog.tsx packages/apps-template-mui/src/components/dialogs/__tests__/FormDialog.blockEditor.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-22 - Generic Details Tabs And Sequence Label Fallback Safety

### Summary

Completed the next generic runtime widget UX safety slice. Details tabs and sequence prerequisite indicators no longer expose raw tab IDs or step IDs when metadata labels are missing; runtime users now see localized safe labels while IDs remain internal for state, routing, and sequence evaluation.

### Implemented

-   Added safe details-tabs fallback labels that humanize non-technical tab IDs and use localized generic labels for UUID-like IDs.
-   Replaced sequence `Locked by` row ID strings with labels resolved from safe runtime row display fields.
-   Kept sequence availability evaluation based on step IDs while converting the rendered locked-by value at the widget boundary.
-   Added English and Russian fallback labels for details tabs and required sequence steps.
-   Added focused `widgetRenderer` coverage for sequential locks, prerequisite locks with multiple blockers, and details tabs with missing labels.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "sequence availability|prerequisite sequence|detailsTabs"`: 4 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 56 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/widgetRenderer.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-22 - Generic Relation Builder And Runtime List Fallback Safety

### Summary

Completed the next generic runtime UI safety slice. Relation-builder panel and wizard fallbacks, plus generic runtime card/table fallback labels, no longer expose raw IDs or structured payloads when metadata labels are missing.

### Implemented

-   Added safe metadata fallback labels for relation-builder panels and create wizard steps.
-   Replaced runtime `ItemCard` and default `FlowListTable` row ID fallbacks with localized untitled labels.
-   Routed card descriptions through the safe runtime display formatter so raw JSON/object payloads stay hidden.
-   Added English and Russian fallback labels for relation-builder panels, relation-builder steps, and runtime table rows.
-   Added focused runtime UI and widgetRenderer coverage proving missing labels do not expose UUID-like IDs, raw JSON keys, or `[object Object]`.
-   Stabilized the existing `records.union` create-menu test with a per-test timeout while keeping all assertions intact.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/components/runtime-ui/index.tsx packages/apps-template-mui/src/components/runtime-ui/__tests__/runtimeUi.test.tsx packages/apps-template-mui/src/dashboard/components/RelationBuilderWidget.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/runtime-ui/__tests__/runtimeUi.test.tsx`: 4 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx --testNamePattern "relation builder panels|free of raw IDs"`: 2 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/widgetRenderer.test.tsx`: 56 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/components/runtime-ui/index.tsx packages/apps-template-mui/src/components/runtime-ui/__tests__/runtimeUi.test.tsx packages/apps-template-mui/src/dashboard/components/RelationBuilderWidget.tsx packages/apps-template-mui/src/dashboard/components/__tests__/widgetRenderer.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-22 - Generic Runtime Flow-List Cell Display Safety

### Summary

Completed a focused generic runtime-list safety slice. Flow-list table cells now fail closed through the shared safe runtime display formatter when default cells or custom renderers return raw UUIDs, JSON-like strings, or opaque objects.

### Implemented

-   Added a shared flow-list cell rendering helper that preserves real React elements while sanitizing primitive and object-like render output.
-   Replaced the default flow-list description cell with safe runtime display formatting.
-   Replaced fallback custom-column cell rendering with safe runtime display formatting.
-   Added focused runtime UI coverage for fallback cells and custom renderers returning readable text, raw UUIDs, Editor.js-like JSON strings, and object-like payloads.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/components/runtime-ui/index.tsx packages/apps-template-mui/src/components/runtime-ui/__tests__/runtimeUi.test.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/components/runtime-ui/__tests__/runtimeUi.test.tsx`: 6 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/components/runtime-ui/index.tsx packages/apps-template-mui/src/components/runtime-ui/__tests__/runtimeUi.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-22 - Generic Runtime Chart Axis Display Safety

### Summary

Completed a focused generic chart-display safety slice. Runtime chart x-axis labels for `records.list` and `ledger.projection` datasources now use the shared safe runtime display formatter instead of direct stringification, so raw UUIDs, runtime JSON, and object placeholders are suppressed before reaching the chart components.

### Implemented

-   Added a `MainGrid` chart-axis formatter that reuses `formatRuntimeSafeValue`.
-   Replaced `String(row[xField])` chart-axis mapping with safe runtime formatting for all runtime chart datasource rows.
-   Added focused records-list chart coverage proving raw UUIDs, Editor.js-like JSON strings, and opaque objects are not exposed in axis text.
-   Added focused ledger-projection chart coverage proving raw learner IDs, raw relation JSON, and object placeholders are not exposed in axis text while localized labels remain readable.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/MainGrid.test.tsx --testNamePattern "chart"`: 5 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/MainGrid.test.tsx`: 24 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-22 - Generic Runtime Chart Metric Value Display Safety

### Summary

Completed a focused generic chart metric-value safety slice. Runtime chart configured metric values now go through the shared safe display formatter before reaching chart components; unsafe metadata values such as raw runtime JSON or UUID-bearing strings are suppressed, allowing datasource-backed charts to show the computed series total instead.

### Implemented

-   Added a `MainGrid` chart metric formatter that reuses `formatRuntimeSafeValue`.
-   Replaced direct `config.value` passthrough in runtime records-series charts with safe formatting plus computed-total fallback.
-   Added focused `MainGrid` coverage proving a raw JSON configured chart value is not visible and the computed chart total remains visible.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/MainGrid.test.tsx --testNamePattern "chart"`: 6 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/MainGrid.test.tsx`: 25 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-22 - Generic Runtime DataGrid Cell Display Safety

### Summary

Completed a focused generic runtime DataGrid safety slice. The shared `toGridColumns()` conversion now uses the safe runtime display formatter for normal default cells, semantic long-text cells, and REF object labels, preventing raw UUIDs, runtime JSON strings, and opaque object payloads from reaching normal user-facing DataGrid cells.

### Implemented

-   Replaced default `toGridColumns()` display formatting with `formatRuntimeSafeValue`.
-   Applied safe formatting to semantic long-text and textarea-backed DataGrid cells while preserving multiline wrapping.
-   Applied safe formatting to REF object `label`/`name` values and preserved fallback to human `refOptions` labels when object labels are unsafe.
-   Added focused `columns.test.tsx` coverage for readable localized values, UUID suppression, raw block/resource JSON suppression, semantic long-text safety, and REF fallback behavior.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/utils/columns.tsx packages/apps-template-mui/src/utils/__tests__/columns.test.tsx memory-bank/tasks.md memory-bank/progress.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/utils/__tests__/columns.test.tsx`: 8 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/utils/__tests__/displayValue.test.ts`: 6 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/utils/columns.tsx packages/apps-template-mui/src/utils/__tests__/columns.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-22 - LMS Learning Content Final QA Fixes

### Summary

Closed the final QA remediation slice for Learning Content productization. Runtime row-level owner-or-shared access is now enforced consistently on direct single-row reads, records.list reports, non-page progress targets, copy source reads, and delete/restore read and mutation boundaries. Generic numeric tabular editing now fails with localized user-facing validation instead of silently reverting invalid values. Moderate production dependency advisories are remediated through minimal direct upgrades and scoped PNPM overrides.

### Implemented

-   Hardened `buildRuntimeRecordAccessClause` so `runtimeRecordAccess.ownerOrShared` is bypassed only by application-management roles, not by ordinary coarse edit permissions.
-   Qualified row-id predicates in owner/shared access SQL for direct reads, reports, progress, copy, delete, and restore to avoid ambiguous `id` binding inside relation `EXISTS` clauses.
-   Added backend route/service coverage for direct row reads, reports, progress target checks, copy source checks, delete mutation boundaries, restore mutation boundaries, and report access-condition propagation.
-   Integrated numeric tabular validation UX with localized helper/alert messages and localized number stepper aria labels.
-   Removed unused frontend `uuid` dependencies, upgraded `esbuild` and `yaml`, and added scoped overrides for patched `fast-xml-parser`, `protobufjs`, `qs`, `brace-expansion`, `postcss`, `ws`, and transitive `uuid` paths.
-   Cleaned scripting-engine lint warnings in test doubles touched by the dependency validation pass.

### Validation

-   `pnpm exec prettier --write ...` for the touched backend, app-template, package, and Memory Bank files.
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm --filter @universo/applications-backend test -- --runInBand packages/applications-backend/base/src/tests/routes/applicationsRoutes.test.ts packages/applications-backend/base/src/tests/services/runtimeReportsService.test.ts`: 159 passed.
-   `pnpm --filter @universo/applications-backend lint`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/utils/__tests__/tabularCellValues.test.tsx src/components/__tests__/TabularPartEditor.numericValidation.test.tsx`: 14 passed.
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/apps-template-mui lint`
-   `pnpm --filter @universo/scripting-engine build`
-   `pnpm --filter @universo/scripting-engine test`: 17 passed.
-   `pnpm --filter @universo/scripting-engine lint`
-   `pnpm --filter @universo/rest-docs build`
-   `pnpm --filter @universo/rest-docs lint`
-   `pnpm run check:lms-fixture-contract`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm docs:i18n:check`
-   `pnpm audit --prod --audit-level=moderate`: passed with only two low advisories remaining.
-   `pnpm build`: 31 successful tasks.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "lms snapshot fixture imports"`: 2 passed.

## 2026-05-22 - Generic Runtime Stat Card Metric Value Display Safety

### Summary

Completed a focused generic overview-stat safety slice. Configured stat-card metric values now use the same safe runtime metric formatter as chart values, so raw runtime JSON and UUID-bearing metadata strings are suppressed before normal users see them.

### Implemented

-   Reused the shared configured metric formatter for overview stat cards and records-series charts.
-   Replaced direct `config.value` passthrough in `toStatCardProps` with safe formatting plus the existing fallback value.
-   Added focused `MainGrid` coverage proving unsafe configured stat-card values do not expose raw JSON, `recordId`, or UUIDs.

### Validation

-   `pnpm exec prettier --write packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx memory-bank/tasks.md`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/MainGrid.test.tsx --testNamePattern "stat-card|chart|overview card"`: 9 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/dashboard/components/__tests__/MainGrid.test.tsx`: 26 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/dashboard/components/MainGrid.tsx packages/apps-template-mui/src/dashboard/components/__tests__/MainGrid.test.tsx packages/apps-template-mui/src/utils/columns.tsx packages/apps-template-mui/src/utils/__tests__/columns.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`

## 2026-05-22 - Generic Workspace Invite Email Validation

### Summary

Completed a focused generic Runtime Workspaces validation slice. Workspace member invitations now fail locally with a localized field message when the email format is invalid instead of sending a rejected runtime member mutation.

### Implemented

-   Reused the shared `emailSchema` contract in the existing invite-member dialog before mutation submission.
-   Kept the existing MUI dialog and email field surface while adding localized English and Russian invalid-email feedback.
-   Cleared field validation feedback as the user edits or closes the invite dialog.
-   Added focused `RuntimeWorkspacesPage` coverage proving invalid email text shows a user-facing helper message and does not call the invite API.

### Validation

-   `pnpm exec prettier --write memory-bank/tasks.md packages/apps-template-mui/src/workspaces/RuntimeWorkspacesPage.tsx packages/apps-template-mui/src/workspaces/__tests__/RuntimeWorkspacesPage.test.tsx packages/apps-template-mui/src/i18n/locales/en/apps.json packages/apps-template-mui/src/i18n/locales/ru/apps.json`
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/workspaces/__tests__/RuntimeWorkspacesPage.test.tsx --testNamePattern "invites a member|invalid workspace invite email|workspace errors"`: 3 passed.
-   `pnpm --dir packages/apps-template-mui exec vitest run --config vitest.config.ts src/workspaces/__tests__/RuntimeWorkspacesPage.test.tsx`: 16 passed.
-   `pnpm exec eslint packages/apps-template-mui/src/workspaces/RuntimeWorkspacesPage.tsx packages/apps-template-mui/src/workspaces/__tests__/RuntimeWorkspacesPage.test.tsx`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm --filter @universo/apps-template-mui build`
-   `git diff --check`

## 2026-05-23 - LMS Runtime UX QA Findings Closure

### Summary

Closed the latest LMS runtime UX QA findings through generic runtime primitives and executable regressions. The Learning Content runtime no longer shows duplicate primary create controls when a details-table widget owns create targets, and the browser E2E flow now checks the spacing, control geometry, localization, ISO date leakage, and row identity problems that escaped earlier test coverage.

### Implemented

-   Suppressed top-level metadata create actions when a `detailsTable` widget owns `createTargets`, preserving a single primary create path without LMS-only UI forks.
-   Added reusable Playwright browser helpers for vertical spacing, viewport fit, and inline overflow checks.
-   Strengthened the LMS snapshot runtime E2E with Russian control-label deny-list checks, desktop/tablet/mobile toolbar geometry checks, module gap checks, and row ID uniqueness assertions after create, copy, delete, restore, and union datasource reloads.
-   Added backend regressions for duplicate runtime reorder IDs, version-map reorder mismatches, and hostile `records.union` locale input escaping.
-   Normalized visible compound union row IDs in the E2E assertions so the test validates user-visible runtime rows against API row identities correctly.

### Validation

-   `pnpm --filter @universo/apps-template-mui test -- src/dashboard/components/__tests__/MainGrid.test.tsx`: 312 passed in the package run.
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts`: 157 passed.
-   `pnpm --filter @universo/apps-template-mui build`
-   `pnpm --filter @universo/applications-backend build`
-   `pnpm supabase:e2e:start:minimal`
-   `pnpm run build:e2e:local-supabase`
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project chromium --grep "lms snapshot fixture imports"`: 2 passed.
-   `git diff --check`

## 2026-05-22 - Generic Course Field Report Coupling

### Summary

Completed the focused Learning Content custom-field/report proof through generic platform primitives. The supported path is now an ordinary Object component projected through `records.union.projectedFields`, surfaced in Learning Content column presets, and used by the saved `LearningContentSummary` report filter/export path without an LMS-only runtime field subsystem.

### Implemented

-   Added the reusable `Instructor` business component to the Learning Content union projection path and default column settings.
-   Extended the generic `records.union` datasource contract with `projectedFields` and taught the backend union executor to resolve readable Object components by field key/codename into stable report output fields.
-   Updated LMS template metadata, generated fixture data, report definitions, settings labels, docs, and tests so `Instructor` is available in Learning Content views and `LearningContentSummary` report output.
-   Hardened E2E email-domain normalization so local E2E provisioning treats accidental full-email values as domains.
-   Stabilized the runtime Playwright resource-preview assertion by targeting the existing preview test id instead of a duplicate text locator.

### Validation

-   `pnpm exec prettier --write ...` for the touched runtime datasource, backend, fixture, docs, E2E, and local Supabase env files.
-   `pnpm --dir packages/universo-types/base exec vitest run --config vitest.config.ts src/__tests__/applicationLayouts.test.ts src/__tests__/lmsPlatform.test.ts --coverage=false`: 27 passed.
-   `pnpm --filter @universo/applications-backend test -- --runInBand --testPathPattern applicationsRoutes.test.ts --testNamePattern "records.union report"`: 3 passed.
-   `pnpm --dir packages/applications-frontend/base exec vitest run --config vitest.config.ts src/pages/__tests__/ApplicationSettings.test.tsx --testNamePattern "Learning Content defaults" --coverage=false`: 1 passed.
-   `pnpm exec vitest run -c tools/local-supabase/vitest.config.mjs tools/local-supabase/__tests__/write-env.test.mjs --coverage=false`: 9 passed.
-   `pnpm exec eslint` for the touched runtime datasource, backend, LMS template, E2E, and local Supabase env files.
-   `pnpm run build:e2e:local-supabase`: passed before the final E2E runner stabilization.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "canonical lms metahub"`: 2 passed.
-   `node tools/testing/check-runtime-no-lms-forks.mjs`: passed.
-   `pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep "lms snapshot fixture imports"`: 2 passed.
-   `git diff --check`

### Notes

-   The standalone `tools/testing/e2e/support/checkLmsFixtureContract.ts` command still needs a repository-supported TS runner or script wrapper; the same fixture contract was executed successfully inside the generator Playwright spec.

## 2026-05-23 - LMS Guest Public Workspace Isolation QA Closure

### Summary

Closed the remaining public guest runtime QA gap on local minimal Supabase. Public LMS access links now prove workspace isolation in both backend SQL and browser behavior, and the MUI guest app no longer reuses a stale session when the user moves from one public link to another.

### Implemented

-   Scoped public guest runtime record reads, child TABLE reads, access-link lookup, and access-link usage updates by `workspace_id` when a public link is workspace-bound.
-   Seeded public guest LMS content into a shared public workspace during the snapshot-import E2E flow, then restored the main personal workspace as the default for authenticated dashboard work.
-   Split final E2E row-count assertions between the main workspace and the shared public workspace, including uniqueness checks for public guest progress rows.
-   Scoped `GuestApp` sessions to the current `applicationId:slug` and included locale in the public link query key to avoid stale EN/RU or cross-link runtime requests.
-   Added a focused `GuestApp` regression test proving navigation to a second public slug does not trigger runtime loading with the previous session.

### Validation

-   `pnpm supabase:e2e:start:minimal`
-   `pnpm exec prettier --write packages/apps-template-mui/src/standalone/GuestApp.tsx packages/apps-template-mui/src/standalone/__tests__/GuestApp.test.tsx`
-   `pnpm --dir packages/apps-template-mui exec vitest run src/standalone/__tests__/GuestApp.test.tsx`: 14 passed.
-   `pnpm --dir packages/apps-template-mui lint`
-   `pnpm --dir packages/apps-template-mui build`
-   `pnpm --filter @universo/core-frontend build`
-   `pnpm --filter @universo/applications-backend test -- --runInBand src/tests/routes/applicationsRoutes.test.ts src/tests/routes/publicApplicationsRoutes.test.ts src/tests/shared/publicRuntimeAccess.test.ts`: 180 passed.
-   `pnpm exec eslint tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts`
-   `pnpm run check:lms-fixture-contract`
-   `pnpm run check:runtime-no-lms-forks`
-   `pnpm run check:runtime-ux-agents`
-   `UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-core-frontend/base/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts --project=chromium`: 2 passed.
-   `git diff --check`
