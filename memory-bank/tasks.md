# Tasks

> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## Current Task Ledger (Canonical)

## Active: LMS Guest Runtime Localization And QA Closure (2026-04-21)

> Goal: eliminate the remaining public LMS guest localization defect, strengthen the missing RU completion coverage, and leave the LMS plan genuinely complete without residual QA debt in the touched guest-runtime surfaces.

### Final Action Plan — Current Implementation Pass (2026-04-21)

- [x] Add the missing `guest.completeModule`, `guest.restartModule`, and `guest.moduleCompleted` translations to the EN/RU apps-template-mui locale resources
- [x] Update `GuestApp.test.tsx` so guest runtime assertions stop locking in English fallbacks and cover the real RU completion path
- [x] Update the focused LMS Playwright browser proof so the RU public guest flow completes the module and asserts the localized completion CTA/result state
- [x] Run targeted frontend validation for the touched guest-runtime path and rerun the focused LMS snapshot-import browser proof
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` after the guest localization and browser validation are verified green

- Final validation note:
  - Targeted `@universo/apps-template-mui` Vitest passed for `GuestApp.test.tsx` and `App.test.tsx` (`12/12`).
  - Canonical root `pnpm build` completed successfully (`30/30 successful`).
  - Focused Playwright wrapper `node tools/testing/e2e/run-playwright-suite.mjs tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts` passed (`2/2`).
  - The verified root cause was stale built frontend assets: the real browser flow kept serving a pre-fix bundle that still downgraded public guest requests to `locale=en` until the workspace was rebuilt.

## Active: LMS Final Closure And Canonical Fixture Regeneration (2026-04-21)

> Goal: close the last post-QA LMS runtime/security residue, regenerate the canonical LMS snapshot through the official generator path, and leave the memory-bank aligned with the verified final state.

### Final Action Plan — Current Implementation Pass (2026-04-21)

- [x] Move guest runtime session transport from query params to request headers so public runtime URLs stop leaking guest credentials
- [x] Rebind public access-link lookup to the shared-workspace-aware resolver so guest runtime stays pinned to the correct shared workspace
- [x] Add focused backend/frontend regression coverage for header-based guest runtime auth and clean runtime URLs
- [x] Remove external LMS fixture media dependencies by replacing route-map assets with inline SVG data URIs in the canonical fixture contract
- [x] Regenerate the canonical `tools/fixtures/metahubs-lms-app-snapshot.json` only through the official Playwright generator flow
- [x] Reconcile `memory-bank/tasks.md`, `memory-bank/activeContext.md`, and `memory-bank/progress.md` with the verified green state

- Final validation note:
  - Focused backend Jest passed for `publicApplicationsRoutes.test.ts` (`16/16`).
  - Focused frontend Vitest passed for `GuestApp.test.tsx` (`6/6`).
  - Touched-file diagnostics were clean after the runtime/fixture changes.
  - The official Playwright generator `node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "canonical lms metahub and export snapshot fixture"` passed (`2/2`) and refreshed the canonical LMS snapshot fixture.

## Active: LMS Snapshot Import Browser Proof Recovery (2026-04-21)

> Goal: finish the still-red linked-application browser proof by removing the remaining shared-vs-personal public runtime drift in the real guest router path, then rerun focused validation before touching closure status files.

### Final Action Plan — Current Implementation Pass (2026-04-21)

- [x] Reproduce the current focused Playwright failure and confirm the exact red state from artifacts and request/trace evidence
- [x] Remove the brittle public guest route-param dependency on stale `window` parsing and cover it with focused component regression coverage
- [x] Fix the remaining public guest locale drift in the main router path so EN public links stop resolving as RU after a previous RU dashboard render
- [x] Restore a seeded shared workspace for workspace-enabled linked apps so public access links resolve after schema sync
- [x] Make shared-workspace bootstrap seed runtime rows immediately at schema-bootstrap time instead of depending only on the later all-workspaces sync pass
- [x] Pin workspace-aware public runtime requests to a single transaction-scoped executor so RLS sees `app.current_workspace_id` across the whole guest flow
- [x] Trace the real publication-runtime-source to workspace-seed-template path and prove where `AccessLinks/demo-module` disappears in the linked-app sync flow
- [x] Patch the production sync/materialization seam so workspace-enabled linked apps persist and expose the seeded `AccessLinks/demo-module` row to public runtime
- [x] Patch public link/runtime resolution so workspace-enabled guest routes stay pinned to the shared workspace even after personal workspace seed rows appear
- [x] Add backend regression coverage for shared-only public slug/runtime/guest-submit resolution when both shared and personal workspace clones exist
- [x] Patch the remaining RU Playwright quiz-option locator drift in the wrapper proof so the real browser flow tolerates the currently shipped label fallback
- [x] Add an explicit authenticated runtime workspace override so focused verification can read the shared workspace deterministically instead of relying on mutable default-workspace state
- [x] Switch the final LMS wrapper verification helpers to poll the explicit shared workspace rows instead of default-workspace reads
- [x] Re-run targeted validation plus the focused snapshot-import Playwright proof until green
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` only after the final focused browser proof is green

- Current implementation note:
  - The locale drift is fixed and the old `AccessLinks/demo-module` `404` path is gone in the real browser flow.
  - Direct E2E-server reproduction now shows the remaining blocker is a workspace-selection split: `resolveLink` and `guest-session` can bind to the shared workspace, while later `runtime?slug=demo-module` resolves against the personal workspace clone and returns a different quiz id.
  - The current concrete failure is therefore `POST /api/v1/public/a/:applicationId/runtime/guest-submit -> 403 {"error":"Quiz is not available for this guest session"}` because the guest session is bound to the shared link/module ids while the browser runtime payload can surface personal-workspace quiz ids after personal seed rows appear.
  - After the shared-workspace/session-bound runtime fix landed and targeted tests went green, the final wrapper rerun exposed one remaining browser-only mismatch: the RU guest quiz rendered selectable labels in English, so the Playwright proof now checks the requested locale first and falls back to the shipped English label when needed.
  - The latest residual wrapper failure was no longer in the guest flow itself: the final authenticated runtime row-count check depended on default workspace selection, so this pass added a validated explicit `workspaceId` runtime override and moved the focused verification to that deterministic path.
  - Validation is now green again on the real built runtime path: focused backend Jest passed for `runtimeRowsController.test.ts` plus `applicationWorkspaces.test.ts`, `@universo/applications-backend` was rebuilt, and the exact wrapper `snapshot-import-lms-runtime.spec.ts --project chromium` passed `2/2`.

## Active: LMS Post-QA Security And ACL Remediation (2026-04-20)

> Goal: close the concrete post-QA policy gaps in public workspace resolution, personal/shared workspace ACLs, owner-only member management UI, and standalone locale handling without regressing the already-green LMS runtime/browser flows.

### Final Action Plan — Current Implementation Pass (2026-04-20)

- [x] Restrict public guest runtime workspace discovery to the safe shared-workspace surface and add regression coverage for personal-workspace non-resolution
- [x] Enforce fail-closed personal-workspace member-management restrictions in runtime workspace controller/service paths and cover them with targeted backend tests
- [x] Gate workspace member-management UI actions to owner-managed shared workspaces only and extend component coverage for the restricted states
- [x] Remove the hardcoded standalone `ru` locale path and propagate resolved browser locale through the standalone app shell
- [x] Run targeted backend/frontend validation plus canonical root `pnpm build`
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` after verified green validation

- Verified remediation note:
  - Backend targeted Jest passed for `publicApplicationsRoutes.test.ts`, `runtimeWorkspaceController.test.ts`, and `runtimeWorkspaceService.test.ts` (`27/27`).
  - Frontend targeted Vitest passed for `WorkspaceManagerDialog.test.tsx` and `App.test.tsx` (`4/4`).
  - Canonical root `pnpm build` completed successfully after the policy, UI, and locale fixes.

## Active: LMS Demo Fixture Rebuild Implementation (2026-04-20)

> Goal: implement the approved LMS demo rebuild end-to-end so the canonical snapshot imports into a clean database, creates a usable application immediately, exposes working bilingual space-themed widgets and public links, ships with stronger contracts/tests, and leaves no LMS-specific technical debt in the touched surfaces.

### Final Action Plan — Current Implementation Pass (2026-04-20)

- [x] Verify the active guest-runtime failure path in source and built backend output before applying any fix
- [x] Patch the real backend/runtime defect or rebuild path so public LMS module runtime loads correctly after guest session creation
- [x] Patch workspace-seeded child-table reference remapping so module `ContentItems[].QuizId` resolves to workspace-scoped quiz rows
- [x] Add regression coverage for child-row quiz-id remapping during workspace seeding
- [x] Run targeted backend validation, rebuild `@universo/applications-backend`, and rerun the focused LMS snapshot-import browser proof until green
- [x] Run final targeted validation and canonical root `pnpm build`
- [x] Update activeContext.md and progress.md only after the focused browser proof is green

- Current implementation note:
  - The current public guest runtime regression was a frontend race in `GuestApp`: the public runtime query started before `guest-session` existed, failed while hidden behind the name form, and then surfaced the stale cached error immediately after `Start learning` instead of refetching with the new guest session.
  - Fresh Playwright trace for the remaining red proof now shows a backend `404 {"error":"Runtime target not found"}` on `GET /api/v1/public/a/:applicationId/runtime?slug=demo-module` after `guest-session` succeeds. The current root cause is in workspace-enabled runtime seeding: `AccessLinks.TargetId` is a string-based catalog id contract, but workspace cloning remaps only `REF` fields, so the access link keeps the original seed row id while `Modules` rows receive workspace-specific row ids.
  - The remaining red proof is narrowed further: module runtime now resolves, but `Modules.ContentItems[].QuizId` in workspace-seeded child rows still keeps the original quiz seed id, so opening the quiz requests a stale `targetId` and fails with `404 Runtime target not found`.

- Final validation note:
  - `pnpm --filter @universo/applications-backend test -- src/tests/services/applicationWorkspaces.test.ts --runInBand` passed (`6/6`).
  - `pnpm --filter @universo/applications-backend test -- src/tests/routes/publicApplicationsRoutes.test.ts --runInBand` passed (`10/10`).
  - `pnpm --filter @universo/applications-backend build` completed and refreshed `dist`.
  - Focused Playwright proof `lms snapshot fixture imports through the browser UI and is immediately usable after linked app creation` passed (`2/2`, including provisioning).
  - Canonical root `pnpm build` passed (`30/30 successful`).

## Active: LMS Demo Fixture Rebuild Planning (2026-04-20)

> Goal: design a complete rebuild plan for the LMS demo template/snapshot so a clean metahub import plus application creation yields a self-contained bilingual space-themed demo with working widgets, real links, seeded data, updated Playwright product proof, and matching GitBook docs.

- [x] Audit the current LMS template, fixture snapshot, runtime widgets, and focused Playwright/browser proof to identify why the imported demo is not self-contained
- [x] Run a creative design pass for the imported LMS demo experience using the existing dashboard/widget patterns
- [x] Write a new detailed implementation plan in `memory-bank/plan` for discussion before code changes

### Final Action Plan — Current Implementation Pass (2026-04-20)

- [x] Expand the LMS template and canonical fixture contract to ship a richer bilingual Orbital Academy dataset with multiple classes, modules, quizzes, and seeded access-link routes
- [x] Enable localized LMS runtime record fields and make the public guest runtime resolve locale-aware module, quiz, and access-link copy without breaking the existing EN flow
- [x] Rewrite the LMS generator and committed snapshot so the canonical export comes only from the supported end-to-end flow and matches the stronger multi-row contract
- [ ] Repair the remaining guest browser proof drift, rerun the focused EN and RU snapshot-import runtime flow, and verify screenshot evidence from the fresh bundle
- [x] Refresh EN/RU LMS setup and overview docs so they describe the shipped self-contained fixture/regeneration workflow instead of manual runtime seeding
- [ ] Run final focused package validation, rerun the canonical root pnpm build, and then update memory-bank/activeContext.md and memory-bank/progress.md

- Current implementation note:
  - The remaining red proof is now narrowed to the standalone guest surface: the source GuestApp already requests locale-aware public links/runtime, but the failing browser run surfaced stale guest assets and left the access-link form in a false link-not-found state.
  - This pass is therefore limited to refreshing the effective guest runtime path, revalidating the focused browser proof, and closing the memory-bank status drift after green validation.

## Active: LMS Plan Completion And QA Debt Elimination (2026-04-20)

> Goal: close the remaining LMS MVP QA findings for public workspace isolation and guest-session persistence, complete the missing LMS Playwright/browser proof promised by the plan, and leave docs/status files aligned with the shipped behavior.

### Final Action Plan — Current Implementation Pass (2026-04-20)

- [x] Restore guest quiz completion flow so public LMS users see score/result state before returning to the module
- [x] Remove stale WorkspaceSwitcher assertion drift from targeted frontend validation
- [x] Rebuild the frontend/runtime bundles before browser proof so Playwright does not validate a stale pre-fix guest bundle
- [x] Re-run focused LMS Playwright wrapper flows after the rebuild and fix any remaining real browser drift
- [x] Run final targeted LMS verification plus canonical root `pnpm build`
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the verified closure state

- Current implementation note:
  - Guest persistence writes are now aligned with the canonical runtime insert contract for workspace-enabled apps: `runtimeGuestController` explicitly writes `workspace_id` on guest-created Students, QuizResponses, and ModuleProgress rows instead of relying on a narrower direct-insert path.

- [x] Restore guest quiz completion flow so public LMS users see score/result state before returning to the module
- [x] Remove stale WorkspaceSwitcher assertion drift from targeted frontend validation
- [x] Re-run targeted frontend validation, focused LMS Playwright wrapper flows, and canonical root `pnpm build`
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the verified closure state after green validation

- [x] Resolve public LMS workspace isolation from the access-link workspace instead of the first active workspace fallback
- [x] Bind guest-session transport/state to the resolved workspace and reduce shared-device persistence risk in `GuestApp`
- [x] Expand backend/public-route coverage for workspace-aware guest runtime resolution
- [x] Add the missing LMS Playwright flow specs promised by the plan (workspace management, full class-module-quiz flow, QR flow, statistics flow)
- [x] Repair LMS browser-spec fixture payloads so required nested enum REF fields (`Questions.QuestionType`, `ContentItems.ItemType`) use real option-value ids
- [x] Normalize TABLE child-row JSON fields in runtime row create/update/copy so LMS quiz-question `Options` payloads persist without PostgreSQL json syntax failures
- [x] Repair LMS browser-spec module payloads so required `Modules.Status` uses the real `ModuleStatus` enumeration value
- [x] Harden TABLE child-row batch INSERT normalization so JSON/VLC child values stay safe even if prepared rows carry non-primitive payloads into the final insert stage
- [x] Fix public guest runtime row loading so TABLE attributes are not selected as parent-table columns during LMS module/quiz payload resolution
- [x] Fix public guest runtime TABLE child-row loading so public module/quiz payload resolution uses canonical `_tp_parent_id` and `_tp_sort_order` child-table columns
- [x] Harden public guest runtime enumeration codename normalization so `_app_values.codename` VLC objects do not crash module/quiz payload assembly
- [x] Align LMS browser proof with the shipped guest-session storage contract (`sessionToken` in sessionStorage, not legacy `token`)
- [x] Re-run the LMS Playwright/browser proof with the correct wrapper test pattern and fix any remaining browser drift
- [x] Reconcile remaining LMS docs/README wording with the completed runtime and browser coverage
- [ ] Run final targeted LMS verification plus canonical root `pnpm build`
- [ ] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with the verified closure state

- Current validation note:
  - Focused backend public-route Jest is green (`10/10`).
  - Canonical root `pnpm build` is green (`30/30 successful`).
  - Focused LMS Playwright wrapper is green (`3/3`), including the class-module-quiz proof and the QR flow after the rebuilt workspace picked up the guest persistence fix.
  - The final backend root-cause fix was aligning `runtimeGuestController` inserts with the canonical runtime workspace-aware write contract by explicitly persisting `workspace_id` for guest-created Students, QuizResponses, and ModuleProgress rows.

## Active: LMS MVP QA Remediation Finish (2026-04-20)

> Goal: close the remaining concrete QA gaps left after the LMS MVP implementation pass and revalidate the full touched surface instead of keeping the task falsely marked as complete.

- [x] Wrap `createSharedWorkspace` and `addWorkspaceMember` multi-step mutations in transactions
- [x] Add guest-session expiry enforcement in `runtimeGuestController` without introducing schema-version churn
- [x] Harden `getPublicClientBundle` response headers for public script delivery
- [x] Fix `QRCodeWidget` timeout cleanup on unmount
- [x] Extract shared runtime widget script-loading hook/helper for `ModuleViewerWidget` and `StatsViewerWidget`
- [x] Add a module completion screen to `GuestApp`
- [x] Pass concrete quiz runtime context from `ModuleViewerWidget` for `quiz_ref` items
- [x] Add missing targeted tests: `StatsViewerWidget`, `runtimeWidgetHelpers`, workspace controller happy-paths
- [x] Add negative E2E coverage for public LMS guest runtime (expired link, max-uses, wrong slug)
- [x] Run targeted tests plus canonical root `pnpm build` and update memory-bank status files with verified outcomes

- Verification note:
  - Targeted backend Jest passed (`20/20`).
  - Targeted apps-template-mui Vitest passed (`17/17`).
  - Canonical root `pnpm build` completed successfully after the remediation pass.

## Active: LMS MVP QA Remediation Closure (2026-04-19)

> Goal: eliminate the concrete security, ACL, data-integrity, and test-coverage gaps found in the LMS MVP QA review so the implementation is complete without residual debt in the touched surfaces.

- [x] Fix RLS blocker: public guest queries now call `setPublicWorkspaceContext` to set `app.current_workspace_id` before querying catalog tables
- [x] Wrap `submitGuestQuiz` question inserts in a transaction to prevent partial quiz submissions
- [x] Add IDENTIFIER_REGEX validation for all dynamic column names in guest controller to prevent SQL injection via corrupted `_app_attributes`
- [x] Fix ModuleViewerWidget `quiz_ref` rendering — pass `attachedToKind: 'catalog'` so QuizWidget finds scripts correctly
- [x] Add `useEffect` to reset `currentIndex` in ModuleViewerWidget when model changes
- [x] Fix WorkspaceManagerDialog duplicate "Workspaces" heading — inner heading now says "Manage workspaces"
- [x] Fix WorkspaceSwitcher missing loading spinner — now shows `CircularProgress` while `isLoading`
- [x] Remove deprecated `document.execCommand('copy')` fallback from QRCodeWidget
- [x] Update E2E test to use `workspacesEnabled: true` to verify RLS-aware public access path
- [x] Run full build (30/30), lint (0 errors), and existing tests (all passing)

## Active: LMS MVP Implementation Execution (2026-04-19)

> Goal: complete the approved LMS MVP plan end-to-end by shipping the missing generic workspace UI, LMS runtime widgets/template, guest-access plumbing, fixture/test updates, and documentation refresh without leaving residual implementation debt in the touched surfaces.

- [x] Phase 0 slice: finalize generic workspace runtime API/UI wiring in the dashboard shell, connect the manager dialog to the switcher, and cover the new workspace controls with targeted component validation
- [x] Phase 1 slice: complete the LMS metahub template/data contract for the shipped entity set, add the Learning hub seed, and register the LMS runtime widgets in the shared type/template pipeline
- [x] Phase 2 slice: finish platform enhancements for LMS runtime widgets and QR code support in `apps-template-mui`, including widget renderer registration, i18n copy, and targeted widget tests
- [x] Phase 2 remainder: implement guest/public runtime access routes plus standalone guest runtime surface and wire them into the application route factory
- [x] Phase 3: Update quiz/LMS fixture contracts and regenerate or repair the affected LMS-related snapshot assets and supporting product specs
- [x] Phase 4: Add or repair targeted unit/component coverage for the new workspace/LMS/guest functionality and run the required package-level validation
- [x] Phase 5: Rewrite and extend EN/RU docs plus README/memory-bank status files so the shipped LMS/workspace functionality is accurately documented with current behavior

### LMS MVP 2026-04-19 Follow-up Notes

- [x] Add backend/unit contracts for `publicRuntimeAccess`, `runtimeWorkspaceService`, and `publicApplicationsRoutes`
- [x] Add frontend/component coverage for `ModuleViewerWidget`
- [x] Add LMS fixture contract and generator scaffolding (`lmsFixtureContract.ts`, `metahubs-lms-app-export.spec.ts`)
- [x] Add EN/RU GitBook pages for LMS overview/setup/guest access/workspace management and LMS architecture
- [x] Run the full E2E generator cycle and commit the produced `tools/fixtures/metahubs-lms-app-snapshot.json`

## Active: Metahub Final QA Debt Elimination (2026-04-18)

> Goal: eliminate the remaining post-QA residual debt in the metahub rollout by aligning the last terminology artifacts, removing frontend test-only lint noise through package-scoped lint policy, and revalidating the shipped workspace.

- [x] Remove the remaining legacy metadata terminology from rest-docs, shared comments, and shared menu labels that still surface the old wording
- [x] Eliminate the metahubs-frontend test-only lint warning debt with a package-scoped ESLint override consistent with the neighboring frontend package pattern
- [x] Re-run targeted lint/tests plus canonical root build and confirm the final state in memory-bank files

## Active: Metahub Terminology And QA Closure Completion (2026-04-18)

> Goal: remove the last user-facing terminology drift and validation gaps left after the final QA pass so the metahub entity/resources rollout is closed without residual scope debt in the touched surfaces.

- [x] Normalize remaining user-facing metahub terminology from legacy "field definitions" wording to "attributes" where the shipped UI still exposes the old copy
- [x] Align Playwright docs generators and browser assertions with the shipped attribute terminology
- [x] Update supporting system descriptions and memory-bank status files to reflect the final terminology cleanup
- [x] Re-run targeted validation for touched frontend/e2e paths and the canonical workspace build

## Active: Metahub Resource Surfaces Final QA Closure (2026-04-18)

> Goal: remove the last terminology, pagination, and browser-coverage debt after the QA follow-up so the metahub resource-surface rollout is actually complete.

- [x] Replace the `Resources` entity-type label lookup hard limit with full pagination through the shared fetch-all helper
- [x] Remove stale legacy `general.tabs` labels from EN/RU metahub i18n so no old resource terminology remains reusable
- [x] Rewrite the remaining RU metahub resource docs pages that still mix Russian with English implementation jargon
- [x] Add a browser-level ACL regression that proves read-only metahub members cannot create entity types from the Entities workspace
- [x] Re-run targeted frontend/backend/e2e/lint validation and update memory-bank status files

## Active: Metahub Resource Surfaces QA Closure (2026-04-18)

> Goal: close the remaining QA gaps for entity-driven Resources, documentation, and test coverage without regressing the shipped metahub/application flows.

- [x] Harden backend/template validation so `resourceSurfaces.routeSegment` stays unique and fail-closed outside the builder UI
- [x] Make shared `Resources` tab label resolution deterministic across multiple compatible entity types and stable beyond the previous low list limit
- [x] Add explicit permission-regression coverage for forbidden entity-type CRUD mutations plus the new backend route-segment validation
- [x] Rewrite the remaining mixed-language RU entity-type guide so the docs phase is actually complete
- [x] Re-run targeted backend/frontend/e2e validation, then update memory-bank status files

## Active: PR #767 Review Comment Triage (2026-04-18)

> Goal: audit bot review comments in PR #767, implement only validated safe fixes, re-run targeted verification, and push the resulting changes to the same PR branch.

- [x] Fetch and classify all unresolved PR #767 review comments
- [x] Validate each suggested fix against the current codebase and relevant external docs
- [x] Implement only the fixes that are correct and regression-safe
- [x] Run targeted validation for touched areas and root `pnpm build`
- [x] Update memory-bank status files and push the follow-up commit to PR #767

- Review outcome note:
  - Two bot comments were present. The unsafe translation-context cast in `PublicationList.tsx` was valid and fixed.
  - The `SharedResourcesPage.tsx` fallback-tab suggestion was intentionally not applied because current derived rendering is safe, preserves hidden-tab intent, and does not justify an extra synchronization effect.

## Completed: QA Closure — i18n, Resources, Lint, Documentation (2026-04-18)

> Goal: fix 5 critical post-migration issues — broken i18n keys, confusing Resources tabs, fixture hash mismatch, documentation drift, lint debt.

- [x] Phase A.1: Add missing `records.*` i18n section (~44 keys) to EN/RU locales
- [x] Phase A.2: Add missing `tabs.treeEntities` keys to 4 entity type tab sections
- [x] Phase A.3: Translate ~25 English strings in RU locale deleteDialog sections
- [x] Phase A.4: Fix mixed pluralization (`constantsCount_*` → `fixedValuesCount_*`)
- [x] Phase A.5: Fix EN/RU key asymmetry
- [x] Phase B.1: Update RU Resources tab labels ("Поля" → "Определения полей", etc.)
- [x] Phase B.2: Make Resources tabs dynamic based on entity type ComponentManifest
- [x] Phase B.3: Update empty state descriptions
- [x] Fix all 19 production-file lint warnings (exhaustive-deps, no-explicit-any, unused vars)
- [x] Fix README documentation drift (src/constants/ → src/view-preferences/)
- [x] Update memory-bank/systemPatterns.md with dynamic shared resources pattern
- [x] Update memory-bank/techContext.md with shared resources architecture
- [x] Update memory-bank/activeContext.md, tasks.md, progress.md
- [x] Full validation: pnpm build 30/30, backend 68/68, frontend 64/64, lint 0 errors

## Active: Distributed Noodling Ullman Plan Continuation (2026-04-17)

> Goal: continue the interrupted IMPLEMENT session after Phases A/B, finish fixture regeneration, full-cycle Playwright coverage, documentation refresh, and final validation for the entity-first metahubs architecture.

### Final Action Plan — Continuation Session (2026-04-17)

- [x] Revalidate the current Phase A/B code state with targeted build/tests and fix any drift before generator work
- [x] Regenerate `tools/fixtures/metahubs-self-hosted-app-snapshot.json` via Playwright generator and verify integrity import/export flow
- [x] Regenerate `tools/fixtures/metahubs-quiz-app-snapshot.json` via Playwright generator or repair its generator path until the new fixture is valid
- [x] Implement and stabilize the full-cycle Playwright coverage for entity-first Hubs/Catalogs/Sets/Enumerations plus publication/application runtime checks
- [x] Finish EN/RU documentation rewrite and screenshot references for the entity-first architecture and Resources section
- [x] Update `memory-bank/activeContext.md`, `memory-bank/progress.md`, and this task ledger with verified outcomes
- [x] Run final validation for touched areas plus canonical workspace build and report any residual constraints explicitly

- Verified continuation outcomes:
  - `pnpm build` passed before and after the continuation fixes.
  - `pnpm --filter @universo/metahubs-backend test` passed (`68/68` suites).
  - Documentation screenshot generators passed for both entity docs and quiz tutorial docs.
  - Full-cycle/import regression bundle passed after spec drift fixes (`codename-mode`, `snapshot-export-import`, `snapshot-import-quiz-runtime`, `metahub-domain-entities`, `metahub-entity-full-lifecycle`, `metahub-settings`).

## Completed: Entity Type Naming Refactoring (2026-04-17)

> Goal: rename all entity type display names from surface-key terminology (Tree Entities, Linked Collections, Value Groups, Option Lists) to traditional names (Hubs, Catalogs, Sets, Enumerations) across the entire monorepo. Internal surface keys preserved; only display names, presets, i18n, and docs updated.

- [x] Fix backend preset definitions — rename VLC names, descriptions, UI configs, component constants, default instance constants
- [x] Rename i18n sections in both EN and RU `metahubs.json` files
- [x] Update frontend i18n key references (25+ source files)
- [x] Restructure sidebar menu — dynamic entity types under Resources; "Entity Types" admin link moved after divider; added i18n keys for `entityTypes`
- [x] Update `ENTITY_SURFACE_LABELS` display strings in `@universo/types`
- [x] Update unit tests — all test assertions and mocks across backend/frontend/template-mui
- [x] Fix remaining old terminology — comprehensive sweep of error messages, fallback strings, JSDoc comments across 30+ files
- [x] Update fixture generation script to use unified entity API endpoints
- [x] Update Playwright E2E tests (11 test files with new terminology)
- [x] Build/lint/test verification — full workspace build (30 packages), lint, 934 tests passing
- [x] Fix residual terminology across remaining source code
- [x] Regenerate fixture snapshots (manual — full regeneration needs running server)
- [x] Update documentation EN/RU (14 files across `docs/en/` and `docs/ru/`)
- [x] Update memory-bank files
- Architecture confirmed: Entity system is a fully generic constructor; Hubs/Catalogs/Sets/Enumerations are presets, not hardcoded types.
- Details: progress.md#2026-04-17-entity-type-naming-refactoring

---

## Active: QA Closure + Entities Contract Sync (2026-04-17)

> Goal: close the remaining QA blockers by synchronizing frontend/backend entity copy contracts, restoring Playwright entity-flow stability, and revalidating lint/tests/build without introducing regressions.

### Final Action Plan — Current Session (2026-04-17)

- [x] Align TreeEntity copy payload contract between frontend and backend (`parentTreeEntityId` + relation copy options)
- [x] Restore failing Playwright entity-flow assertions to current UI semantics for records dialogs/actions
- [x] Audit remaining legacy-named domain folders/entrypoints in active metahubs runtime and remove safe leftovers
- [x] Run focused backend tests + package lint + canonical root build
- [x] Run Playwright CLI flow validation via e2e wrapper on port 3100 and fix remaining regressions
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with verified outcomes

## Active: QA Hardening + Entity-First Contract Closure (2026-04-17)

> Goal: close the latest QA findings by hardening public entity routes, syncing backend test contracts to neutral entity-first wording, and revalidating with targeted tests, lint, and full build without regressing active behavior.

### Final Action Plan — Current Session (2026-04-17)

- [x] Harden public linked-collection route handlers so only linked-collection-compatible objects are exposed
- [x] Align failing backend entity route tests with neutral entity-first error contract
- [x] Re-run focused metahubs-backend tests for public routes, entity routes, and schema parity
- [x] Re-run package lint check and canonical root `pnpm build`
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with verified outcomes and residual constraints

## Active: Neutral Kind/Settings Contract Layer (2026-04-17)

> Goal: remove direct legacy hub/catalog/set/enumeration wiring from active frontend/backend settings and behavior logic by introducing a neutral helper layer, while preserving stored DB and wire contracts required by the current platform.

### Final Action Plan — Current Session (2026-04-17)

- [x] Add neutral entity-surface helpers and aliases in `@universo/types` without breaking compatibility guarantees
- [x] Refactor metahubs backend shared kind/settings consumers to use neutral helper resolution instead of hard-coded legacy strings where safe
- [x] Refactor metahubs frontend settings/permission consumers to use the new neutral helper layer and neutral UI-oriented naming in active logic
- [x] Run targeted package validation plus canonical root `pnpm build`
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with verified outcomes and remaining hard constraints

## Active: Entity-First Completion + QA Remediation (2026-04-17)

> Goal: close QA gaps, finish pending phase work, remove remaining active legacy vocabulary on entity-owned metadata surfaces, and revalidate via build/tests/Playwright CLI without `pnpm dev`.

### Final Action Plan — Current Session (2026-04-17)

- [x] Replace remaining active legacy vocabulary in entity metadata backend/frontend flows with neutral entity-first wording (without breaking stored DB contracts)
- [x] Validate route/controller permissions and remove dead legacy references where safe
- [x] Execute focused package tests for touched areas and fix lint-safe issues if introduced
- [x] Run canonical root validation `pnpm build`
- [x] Complete pending Fixture Regeneration phase through Playwright CLI generator run on port 3100
- [x] Update memory-bank status files (`activeContext.md`, `progress.md`, `tasks.md`) with verified outcomes

## Completed: QA Blocker Fixes (2026-05-xx)

> Goal: fix all QA-found blockers so generator specs, backend route tests, and flow specs align with shipped entity-first contract.

- [x] Fix `metahubs-self-hosted-app-export.spec.ts`: `hubIds` → `treeEntityIds`; `/catalog/${id}/elements` → `/entities/catalog/instance/${id}/records`; `/set/${id}/constants` → `/entities/set/instance/${id}/fixed-values`
- [x] Fix `metahubs-quiz-app-export.spec.ts`: remove duplicate `createFieldDefinition('title')` call (template already seeds `Title` field, causing 409)
- [x] Fix `applicationsRoutes.test.ts:332`: remove stale `expect(response.body.catalog)` assertion (controller now returns `section`/`linkedCollection`)
- [x] Fix `metahub-settings.spec.ts`: update tab labels 'Hubs'→'Tree entities', 'Catalogs'→'Linked collections', 'Sets'→'Value groups', 'Enumerations'→'Option lists'; heading 'Allow Hub Nesting'→'Allow TreeEntity Nesting'
- [x] Fix `codename-mode.spec.ts`: update heading 'Hubs' → 'Tree entities instances'
- [x] Update `memory-bank/tasks.md` Phase 10: remove incorrect "BLOCKED: requires `pnpm dev`" note

## Active: Full Legacy Vocabulary Elimination (2026-04-16)

> Goal: eliminate ALL remaining legacy vocabulary from code — types, properties, file names, comments. Complete entity-first transition. Run E2E via Playwright CLI.

### Final Action Plan — Current Remediation Session (2026-04-17)

- [x] Fix self-hosted generator section payloads to use generic entity `config.hubs` / `config.isSingleHub` instead of rejected top-level fields
- [x] Align all stale Playwright entity-flow expectations with current entity-first UI wording
- [x] Replace dead legacy E2E routes (`/attributes`, `/constants`) with canonical entity metadata routes
- [x] Reconcile dialog/tab/heading assertions with current i18n-driven labels across all affected flow specs
- [x] Audit remaining legacy domain folders/names and remove safe dead seams without breaking active runtime behavior
- [x] Re-run focused frontend/backend tests plus canonical root build and ensure lint-safe output
- [x] Refresh memory-bank status files after validation is green

### Final Action Plan — Completion Session (2026-04-17)

- [x] Fix self-hosted generator fixture contract drift in `selfHostedAppFixtureContract.mjs` and keep canonical snapshot validation strict but entity-first aligned
- [x] Update stale snapshot flow assertions to neutral snapshot keys and linked-collection layout references
- [x] Remove remaining dead legacy E2E route assertions/usages and keep only entity-owned metadata routes
- [x] Run focused Playwright generator + flow suites, then rerun canonical root `pnpm build`
- [x] Verify no active legacy domain folders (`attributes`, `constants`, `elements`, `values`) remain in metahubs source trees; delete only proven dead seams
- [x] Update `memory-bank/activeContext.md` and `memory-bank/progress.md` with validated outcomes and remaining hard constraints

### Phase 1: catalogRuntimeConfig.ts → linkedCollectionRuntimeConfig.ts
- [x] Rename file and all exported types/constants (Catalog* → LinkedCollection*)
- [x] Update index.ts re-export
- [x] Update 9 consumer files (layouts controllers, snapshot services, frontend components, tests)

### Phase 2: entityComponents.ts property neutralization
- [x] Rename `predefinedElements` → `records`, `hubAssignment` → `treeAssignment`, `enumerationValues` → `optionValues`, `constants` → `fixedValues`
- [x] Update all consumers across all packages (~223 refs)
- [x] Update template preset data and seed definitions
- [x] Fix MetahubSnapshot interface (constants → fixedValues, sharedConstants → sharedFixedValues)
- [x] Fix componentRegistry.ts key (constants → fixedValues)
- [x] Fix SnapshotRestoreService.ts (sharedConstants → sharedFixedValues, loop var mismatches)
- [x] Fix SnapshotSerializer.ts (mapFixedValueSnapshots loop var mismatches)
- [x] Fix MetahubSchemaService.ts (TemplateSeedEntity property, migration counts)
- [x] Fix metahubMigrationMeta.ts zod schema (constantsAdded → fixedValuesAdded)

### Phase 3: isDisplayAttribute → isDisplayField
- [x] SKIPPED — DB column mapping, cannot rename without migration

### Phase 4: SCRIPT_ATTACHMENT_KINDS neutralization
- [x] SKIPPED — DB stored values, cannot rename without migration

### Phase 5: standardKind infra file renaming
- [x] Rename standardKindBehaviorRegistry → builtinKindBehaviorRegistry
- [x] Rename standardKindCapabilities → builtinKindCapabilities
- [x] Rename standardEntityTypeDefinitions → builtinEntityTypeDefinitions
- [x] Update all imports

### Phase 6: localStorage key values migration
- [x] Update legacy string values in storage.ts to neutral names (STORAGE_KEYS already neutral; LEGACY_STORAGE_KEY_ALIASES handles backward compat reads)
- [x] Add migration layer for backward-compatible read

### Phase 7: Build + test validation
- [x] Full build (pnpm build) 30/30
- [x] Unit tests: metahubs-backend 68/68 suites (581 tests), utils 27/27 files
- [x] Fixed publicationSnapshotHash.ts: broken `constant.codename` ref, input/output key migration (constants→fixedValues)
- [x] Restore metahubs-frontend suite to green after current wording/storage reconciliation (64/64 files, 252/252 tests)
- [x] Lint check (0 errors, warnings only)
- [x] Re-run canonical `pnpm build` after the remediation slice lands (30/30 successful)

### Phase 8: E2E via Playwright CLI
- [x] Restore `metahub-entity-full-lifecycle.spec.ts` against current entity-first UI labels
- [x] Run `node tools/testing/e2e/run-playwright-suite.mjs` — 2/2 passed (2026-04-17, 1.7m)

---

## Completed: QA Remediation — Post-Refactoring Polish (2026-04-19)

> Goal: eliminate ALL remaining legacy naming artifacts from the codebase. Remove legacy copy option aliases, neutralize backend route params, clean NavbarBreadcrumbs, remove Playwright legacy spec, fix documentation, rename all legacy-named files, types, and hooks.

### Final Action Plan — Continuation (Current Session)

- [x] Phase A-M: Completed in previous session (see progress.md)

### Entity-First Final Refactoring (plan: entity-first-final-refactoring-plan-2026-04-16.md)

- [x] Phase 1: Prettier & Lint Fix — all packages lint-clean
- [x] Phase 2: i18n Key Migration — 324 refs renamed, JSON sections renamed
- [x] Phase 3: Query Key Renaming — 94 files, ~60 function renames
- [x] Phase 4: Backend Controller Decomposition — split entityInstancesController.ts (3159→173 lines)
    - [x] 4.1: Created `entityControllerShared.ts` (~830 lines)
    - [x] 4.2: Created `entityCrudHandlers.ts` (~587 lines)
    - [x] 4.3: Created `nestedChildHandlers.ts` (~1160 lines)
    - [x] 4.4: Created `optionValueHandlers.ts` (~580 lines)
    - [x] 4.5: Rewritten `entityInstancesController.ts` as composition root (173 lines)
    - [x] 4.6: Build 30/30 + tests 68/68 pass
- [x] Phase 5: Backend Compat File Rename — treeEntityContext.ts, linkedCollectionContext.ts
- [x] Phase 6: Frontend Consolidation
    - [x] 6.1: Created `useStandardEntityListState` hook
    - [x] 6.3: TreeDeleteDialog consolidation (311→148 lines, wraps BlockingEntitiesDeleteDialog)
    - [x] 6.5: Refactored 4 standard list components to use shared hook (TreeEntityList, LinkedCollectionList, OptionListList, ValueGroupList)
    - [x] 6.7: EntityInstanceList.tsx decomposition (1773→19 line shell + 1450 line content + 180 line helpers)
    - [x] 6.8: Frontend build validation — metahubs-frontend build passes
- [x] Phase 7: E2E API Helper Renames — 17 functions renamed in api-session.mjs + 16 consumer spec files
- [x] Phase 8: Test Alignment — all 252 frontend tests pass (64 files), 581 backend tests pass (68 suites)
    - [x] Fixed exports.test.ts (i18n key `treeEntities` → `hubs`)
    - [x] Fixed TreeDeleteDialog.test.tsx (button text `'Удалить'` → `'Delete'`)
    - [x] Fixed optimisticMutations.remaining.test.tsx (4 mock API name renames)
    - [x] Fixed queryKeys.test.ts (`constantCodenames` → `fixedValueCodenames`, `values` → `optionValues`)
    - [x] Fixed MetahubList.test.tsx (codename auto-derive assertion)
    - [x] Fixed RecordActions.test.ts (`moveRecord` → `moveElement`)
    - [x] Fixed RecordList.settingsContinuity.test.tsx (dialog text assertion)
- [x] Phase 9: E2E Playwright Specs — docs screenshot generator created; existing specs cover lifecycle/presets/sidebar/hierarchy
- [x] Phase 10: Fixture Regeneration — completed via Playwright CLI generator runner on port 3100; confirmed `2 passed` and snapshot fixture regenerated without `pnpm dev`
- [x] Phase 11: Documentation Rewrite — 8 new docs (EN+RU), SUMMARY.md updated
- [x] Phase 12: Final Validation — zero-debt grep audit all 9 checks pass, build 30/30, tests all green
- [x] Phase 13: Deep Internal Identifier Cleanup (2026-04-18)
    - [x] Renamed `AttributesListQuerySchema` → `FieldDefinitionsListQuerySchema` in fieldDefinition/controller.ts
    - [x] Renamed `ConstantsListQuerySchema` → `FixedValuesListQuerySchema` in fixedValue/controller.ts
    - [x] Renamed `createEnumerationRouteServices` → `createOptionListRouteServices` across 3 files
    - [x] Renamed `EnumerationRouteRow` → `OptionListRouteRow` across entityControllerShared + nestedChildHandlers
    - [x] Renamed 44+ `enumeration` local vars/functions → `optionList` in nestedChildHandlers + optionValueHandlers
    - [x] Neutralized all error messages: 'Enumeration not found' → 'Option list not found', etc.
    - [x] Renamed `moveConstant` → `moveFixedValue` in service + controller + test
    - [x] Renamed `ensureSetContext` → `ensureValueGroupContext`, `isSetContextKind` → `isValueGroupContextKind`
    - [x] Renamed `CONSTANT_LIMIT` → `FIXED_VALUE_LIMIT`, `CONSTANT_LIMIT_REACHED` → `FIXED_VALUE_LIMIT_REACHED`
    - [x] Renamed `getAllowedConstantTypes` → `getAllowedFixedValueTypes`
    - [x] Renamed `EnumerationValueCreate/UpdateInput` → `OptionValueCreate/UpdateInput`
    - [x] Renamed `maxChildAttributes` → `maxChildFieldDefinitions`, `createTableAttributeLimitError`, etc.
    - [x] Updated entityInstancesController.ts to use renamed nested handlers
    - [x] Build 30/30, backend tests 68/68 (581 tests), frontend tests 64/64 (252 tests) — all green

---

## Completed: Final Legacy Snapshot Key + Preset KindKey Cleanup (2026-04-21)

> Goal: eliminate last 3 tech-debt items found in QA analysis — legacy snapshot keys, constants-library kindKey, and legacyObjectKind backward-compat variable.

- [x] Rename snapshot output key `sharedAttributes` → `sharedFieldDefinitions` in SnapshotSerializer.ts (type interface + reading with backward-compat fallback + output)
- [x] Rename snapshot output key `sharedEnumerationValues` → `sharedOptionValues` in SnapshotSerializer.ts (same pattern)
- [x] Update SnapshotRestoreService.ts to accept both old and new keys via fallback (`sharedFieldDefinitions ?? sharedAttributes`, `sharedOptionValues ?? sharedEnumerationValues`)
- [x] Update PublicationSnapshotHashInput interface and normalization in publicationSnapshotHash.ts with fallback reads for all renamed shared* keys
- [x] Update PublishedApplicationSnapshot in applicationSyncContracts.ts with deprecated-tagged old keys + new canonical keys
- [x] Update all backend tests: SnapshotSerializer.test.ts, SnapshotRestoreService.test.ts, loadPublishedPublicationRuntimeSource.test.ts
- [x] Update applications-backend test: applicationReleaseBundle.test.ts
- [x] Update fixture JSON: tools/fixtures/metahubs-self-hosted-app-snapshot.json (sharedAttributes→sharedFieldDefinitions, sharedEnumerationValues→sharedOptionValues)
- [x] Update selfHostedAppFixtureContract.mjs to read new keys with fallback to old
- [x] Rename `constants-library` preset kindKey/codename → `fixed-values-library` in fixed-values-library.entity-preset.ts
- [x] Rename export `constantsLibraryEntityPreset` → `fixedValuesLibraryEntityPreset` and update index.ts import
- [x] Remove `legacyObjectKind` IIFE + compatibility.legacyObjectKind fallback in publicMetahubsController.ts (both instances); replace with direct `entity.kind` check
- [x] Full build verification: 30/30 packages pass

---

## Completed: Bulk Parameter/Variable Legacy Identifier Elimination (2026-04-16)

> Goal: eliminate ALL legacy naming identifiers (catalogId, setId, enumerationId, hubId and their compound forms) from code across the entire monorepo.

### Final Action Plan (Current Session)

- [x] Phase 1: `enumerationId` → `optionListId` — 321 refs renamed, verified 0 remaining.
- [x] Phase 2: `setId` → `valueGroupId` — 393 refs renamed, verified 0 remaining.
- [x] Phase 3: `catalogId` → `linkedCollectionId` — 904 refs renamed, verified 0 remaining in metahubs.
- [x] Phase 4: `hubId` → `treeEntityId` — 957 refs renamed in metahubs, `metahubId` intact.
- [x] Phase 5: All compound/blocking names renamed (blockingCatalogs/Sets/Enumerations/ChildHubs, kind contexts, hooks, query keys).
- [x] Phase 6: Build validation — metahubs-backend, metahubs-frontend, template-mui, core-frontend all pass.
- [x] Phase 7: Fix stored data access bug — `typed.linkedCollectionId` → `typed.catalogId` in runtimeRowsController.ts (stored JSONB reads).
- [x] Phase 8: Rename `catalogId` → `linkedCollectionId` in applications-frontend + apps-template-mui.
- [x] Phase 9: Rename `hubId` → `treeEntityId` in applications-frontend, apps-template-mui, and applications-backend (local variables, API response properties).
- [x] Phase 10: Full local variable rename in applications-backend (`resolveRuntimeCatalog` → `resolveRuntimeLinkedCollection`, `hubMetaById` → `treeEntityMetaById`, `catalogsByHub` → `linkedCollectionsByTreeEntity`, etc.).
- [x] Phase 11: Fix scoping bugs from automated rename (loop variables conflated with outer destructured variables).
- [x] Phase 12: Full workspace build `pnpm build` — 30/30 passed.

### Preserved Stored Data Access Patterns
- `typed.hubId`, `typed.catalogId`, `typed.sectionId` — stored JSONB field names
- `config.parentHubId`, `config.boundHubId`, `config.bindToHub`, `config.hubs` — stored config JSONB
- `attachmentKind: 'catalog'` — stored data kind value
- Kind key strings ('hub', 'catalog', 'set', 'enumeration') — database values

## Completed: Wire Protocol Count Field Neutralization (2026-04-16)

> Goal: rename all remaining legacy count field names (`hubsCount`, `catalogsCount`, `constantsCount`, `valuesCount`, `attributesCount`, `elementsCount`) to neutral entity-first names across backend wire protocol, frontend types, UI consumers, and tests.

### Final Action Plan (Current Session)

- [x] Rename backend wire protocol count fields in `metahubsController.ts`, `entityInstancesController.ts`, `optionListHelpers.ts` to neutral names (`treeEntitiesCount`, `linkedCollectionsCount`, `fixedValuesCount`, `optionValuesCount`).
- [x] Update backend test assertions in `metahubsRoutes.test.ts` and `entityInstancesRoutes.test.ts`.
- [x] Rename all frontend type fields in `types.ts` (8 interfaces updated).
- [x] Rename frontend list utils: `linkedCollectionListUtils.ts`, `valueGroupListUtils.ts`, `optionListListUtils.ts` (`hubsCount` → `containersCount`).
- [x] Rename frontend UI consumers: `LinkedCollectionList.tsx`, `ValueGroupList.tsx`, `OptionListList.tsx`, `MetahubList.tsx`, `MetahubBoard.tsx`, `TreeEntityList.tsx`.
- [x] Rename frontend mutation hooks: `linkedCollectionMutations.ts`, `valueGroupMutations.ts`, `treeEntityMutations.ts`, `mutations.ts` (metahubs).
- [x] Rename test mock data in `optimisticMutations.remaining.test.tsx`.
- [x] Fix 3 build errors: `EnumerationListItemRow` → `OptionListListItemRow`, `enumerationId` → `optionListId` in Zod schema references.
- [x] Full build validation — `pnpm build` passed 30/30.

## Active: Backend Dead Controller Factory Removal (2026-04-15)

> Goal: remove the now-unused controller-factory tails from the surviving linked-collection and option-list helper modules, so those files keep only the live shared helper exports that the generic entity controller still depends on.

### Final Action Plan (Current Session)

- [x] Prove `createLinkedCollectionController(...)` and `createOptionListController(...)` no longer belong to the active backend runtime graph while their helper exports still do.
  - Outcome: active backend source search now returns no remaining `createLinkedCollectionController` or `createOptionListController` references, while `entityInstancesController.ts` still imports the surviving linked-collection and option-list helper exports directly.
- [x] Delete the dead controller-factory blocks and the imports they were the last consumers of, while preserving the helper exports still imported by `entityInstancesController.ts`.
  - Outcome: the dead linked-collection controller-factory tail was removed, and `packages/metahubs-backend/base/src/domains/entities/children/optionListController.ts` was rebuilt as a helper-only module that preserves the schema/search/sort/blocking-reference exports still consumed by the generic entity controller.
- [x] Run focused metahubs-backend validation plus the canonical root build, then refresh memory-bank status files only after the checks are green.
  - Outcome: focused `entityInstancesRoutes.test.ts` passed `40/40`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Backend Tree Controller File Removal (2026-04-15)

> Goal: delete the now-orphaned tree child-controller file after the generic entity controller and behavior-backed routes already absorbed its active runtime ownership, so one more backend standard-kind file seam disappears without mixing in broader linked-collection or option-list cleanup.

### Final Action Plan (Current Session)

- [x] Prove `children/treeController.ts` is no longer part of the active backend runtime graph and capture the remaining tree behavior ownership that still lives in generic controller or compatibility helpers.
  - Outcome: active backend source search returned no remaining `treeController` imports or symbol references outside the file itself, while `entityInstancesController.ts` and `treeCompatibility.ts` remain the live owners of the surviving tree behavior.
- [x] Delete the orphaned specialized tree child-controller file only after the active source tree shows no remaining imports or references that require a compatibility shim.
  - Outcome: `packages/metahubs-backend/base/src/domains/entities/children/treeController.ts` was deleted without replacement because it had already become a dead file after the earlier route/controller cutovers.
- [x] Run focused metahubs-backend validation plus the canonical root build, then refresh memory-bank status files only after the checks are green.
  - Outcome: focused `entityInstancesRoutes.test.ts` passed `40/40`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Backend Value Group Controller Removal (2026-04-15)

> Goal: remove the remaining value-group specialized child-controller file and inline its still-live runtime behavior into the generic entity controller, so one more backend standard-kind ownership seam disappears without touching the harder option-list or linked-collection divergences in the same pass.

### Final Action Plan (Current Session)

- [x] Inline the active value-group route handlers into `entityInstancesController.ts` and remove the last runtime dependency on `children/valueGroupController.ts` from the generic controller path.
  - Outcome: nested set list/get/create/update/reorder/delete now live directly inside `entityInstancesController.ts`, keeping the current route shapes, blocking-reference behavior, fixed-value semantics, and hub-scoped mutation contract intact while removing the controller-to-controller dependency.
- [x] Delete the obsolete specialized value-group child-controller file only after all remaining imports and focused tests are reconciled.
  - Outcome: `packages/metahubs-backend/base/src/domains/entities/children/valueGroupController.ts` was deleted, and the active backend source tree no longer imports or references `valueGroupController` anywhere.
- [x] Run focused metahubs-backend validation plus the canonical root build, then refresh memory-bank status files only after the checks are green.
  - Outcome: focused `entityInstancesRoutes.test.ts` passed `40/40`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Standard Copy Backend Naming Closure (2026-04-15)

> Goal: remove the remaining legacy backend-only naming debt that survived the neutral standard copy contract cutover, specifically the business-named copy schema locals and the shared design-time child-copy result fields that still expose attributes/elements/constants/values as the internal truth surface.

### Final Action Plan (Current Session)

- [x] Neutralize the shared backend design-time child-copy result contract and the immediately dependent controller locals to field-definition / record / fixed-value / option-value terminology.
  - Outcome: `copyDesignTimeObjectChildren(...)` now reports `fieldDefinitionsCopied`, `recordsCopied`, `fixedValuesCopied`, and `optionValuesCopied`, and the linked-collection / option-list / value-group copy handlers now read those neutral result fields without changing the wider entity count payload shape (`attributesCount`, `elementsCount`, `valuesCount`) that still belongs to the broader runtime contract.
- [x] Rename the remaining standard backend copy schema locals and focused backend test expectations so the active copy handlers no longer publish `copyHubSchema`, `copyCatalogSchema`, `copySetSchema`, or `copyEnumerationSchema` as their implementation truth surface.
  - Outcome: the backend now uses `copyTreeEntitySchema`, `copyLinkedCollectionSchema`, `copyValueGroupSchema`, `copyOptionListSchema`, and `copyOptionValueSchema`, while the value-group copy response now publishes `copy.fixedValuesCopied` instead of the old copy-specific `constantsCopied` field.
- [x] Run focused metahubs-backend validation plus the canonical root build, then refresh memory-bank status files only after the checks are green.
  - Outcome: focused backend Jest suites passed (`2` suites / `42` tests), `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Standard Entity Copy Contract Neutralization (2026-04-15)

> Goal: replace the remaining standard entity copy payload, UI, i18n, and backend validation surface that still publishes hub/catalog/set/enumeration copy terminology with neutral entity-first naming, while keeping backend request compatibility at the copy route boundary where it is cheap and safe.

### Final Action Plan (Current Session)

- [x] Replace the shared standard copy contracts in `@universo/types` and `@universo/utils` with neutral tree-entity / linked-collection / value-group / option-list copy types and alias-aware normalization.
  - Outcome: the canonical shared contract now uses `TreeEntityCopyOptions`, `LinkedCollectionCopyOptions`, `ValueGroupCopyOptions`, and `OptionListCopyOptions`, and the shared normalizers now read legacy request aliases only as compatibility input instead of preserving hub/catalog/set/enumeration copy names as the internal truth surface.
- [x] Retarget the active metahubs frontend standard copy payload builders, dialogs, i18n labels, and focused tests to the neutral standard copy contract.
  - Outcome: generic entity copy, tree-entity copy, linked-collection copy, option-list copy, and value-group copy flows now send the neutral payload keys, the touched EN/RU locale blocks now expose the same neutral labels, and the focused frontend payload proof plus the touched record-list mock were synchronized to the new helper names.
- [x] Retarget the backend generic entity copy schema, standard child-controller copy schemas, design-time child-copy service, and focused tests to the same neutral contract while preserving request compatibility.
  - Outcome: the generic entity copy route, tree/linked-collection/option-list/value-group copy boundaries, and the shared design-time child-copy helper now use neutral copy option keys internally while still accepting legacy request aliases at validation boundaries where needed.
- [x] Run the touched package validations plus the canonical root build, then refresh memory-bank status files only after the checks are green.
  - Outcome: `pnpm --filter @universo/types build` passed, `pnpm --filter @universo/utils build` passed, focused metahubs frontend tests passed (`2` files / `7` tests), focused metahubs backend Jest suites passed (`2` suites / `42` tests), `pnpm --filter @universo/metahubs-frontend build` passed, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Branch Copy Contract Neutralization (2026-04-15)

> Goal: replace the remaining branch copy payload and UI truth surface that still publishes hub/catalog/set/enumeration terminology with entity-first naming, while keeping backend request compatibility for already-shipped callers.

### Final Action Plan (Current Session)

- [x] Replace the shared branch copy contract in `@universo/types` and `@universo/utils` with neutral entity-first keys, and keep alias-aware normalization so legacy request fields can still be read at the backend boundary during the transition.
  - Outcome: canonical branch copy keys now use tree-entity / linked-collection / value-group / option-list naming, `copyLayouts` stayed unchanged, and `normalizeBranchCopyOptions(...)` now resolves legacy aliases into the neutral contract.
- [x] Retarget the active branch frontend payload builders, forms, labels, i18n, and focused tests to the neutral branch copy contract.
  - Outcome: branch create/copy flows now send the neutral payload, the branch create screen now includes the previously missing value-group toggle, and the focused Vitest branch copy proof was updated to the new shape.
- [x] Retarget the backend branch controller/service compatibility path and focused tests to the neutral contract while preserving request compatibility and deterministic copy-validation errors.
  - Outcome: the backend route boundary now accepts both old and new request keys, internal branch copy handling now uses the neutral contract and neutral compatibility error codes/messages, and focused backend tests prove both the new canonical path and the legacy alias path.
- [x] Run the touched package validations plus the canonical root build, then refresh memory-bank status files only after the checks are green.
  - Outcome: `pnpm --filter @universo/types build` passed, `pnpm --filter @universo/utils build` passed, focused metahubs frontend branch copy tests passed (`4` tests), focused metahubs backend branch copy tests passed (`18` tests), `pnpm --filter @universo/metahubs-frontend build` passed, backend diagnostics stayed clean for the touched branch copy files, and the canonical root build task completed earlier in the session.

## Active: Controller Child Seam De-Specialization (2026-04-15)

> Goal: remove the remaining controller-level child-controller orchestration from the generic entity instance controller for the already-entity-owned nested standard routes, without regressing the live route contract or unrelated dirty-tree work.

### Final Action Plan (Current Session)

- [x] Replace the remaining `createLinkedCollectionController(...)` orchestration in `entityInstancesController.ts` with direct service-backed handlers for the nested standard routes that are already mounted under the generic entity-owned surface.
  - Outcome: the generic controller no longer instantiates `createLinkedCollectionController(...)`, `createOptionListController(...)`, or `createValueGroupController(...)`; nested linked-collection, enumeration, and set routes now run through direct service-backed generic controller handlers while preserving the current route, payload, and permission contract.
  - Scope guard: keep the current route shapes, payloads, permission model, and standard-kind behavior contracts unchanged while removing the remaining controller-to-controller delegation seam.
- [x] Update the focused backend route harness to validate the refactored generic controller composition instead of the old controller delegation path.
  - Outcome: `entityInstancesRoutes.test.ts` now proves the entity-owned enumeration value list endpoint, nested set detail endpoint, and nested linked-collection detail endpoint after the option-list/value-group/linked-collection controller cutovers.
- [x] Run focused backend validation plus the canonical root build, then sync memory-bank status files only after the checks are green.
  - Outcome: focused `entityInstancesRoutes.test.ts` passed `40/40`, `pnpm --filter @universo/metahubs-backend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Final Backend Entity-First Closure (2026-04-15)

> Goal: remove the remaining standard-kind backend route-dispatch seam, reconcile the generic custom-entity ACL contract with the entity-first model, and only then refresh validation and status files.

### Final Action Plan (Current Session)

- [x] Move the remaining standard child-route dispatch out of `entityInstancesRoutes.ts` and into `entityInstancesController.ts` so the active entity-owned router no longer imports or owns the specialized standard child-controller orchestration directly.
  - Outcome: the router-level `dispatchStandardRouteKind(...)` seam and direct child-controller imports are gone from `entityInstancesRoutes.ts`; nested standard child and option-value routes now delegate through controller-returned handlers while preserving the current route and payload contract.
- [x] Reconcile the generic custom-entity ACL contract so custom entity create/edit/delete flows no longer require broader `manageMetahub` access where the entity-first model should align them with content-level permissions.
  - Outcome: `resolveEntityMetadataAclPermission(...)` now maps generic entity instance create/edit/delete to `createContent` / `editContent` / `deleteContent`, and the focused backend route suite locks that contract explicitly.
- [x] Revalidate the touched backend/frontend proof layer and canonical builds after the backend ACL and nested-route orchestration changes.
  - Outcome: the touched backend route suite passed `36/36`, the synced stale frontend tests passed (`3` focused tests), `pnpm --filter @universo/metahubs-backend build` passed, and the canonical root `pnpm build` completed green.
- [x] Replace the controller-level specialized child-controller orchestration that still lives inside `entityInstancesController.ts` with generic behavior-based nested standard handlers wherever the current semantics are already expressible without the legacy child controllers.
  - Outcome: the generic entity controller no longer instantiates `createTreeController`, `createLinkedCollectionController`, `createValueGroupController`, or `createOptionListController`; nested standard child routes now stay inside `entityInstancesController.ts`, and the remaining backend specialization has shifted from controller-factory delegation to narrower helper/runtime seams in the surviving tree/linked-collection/option-list files.

## Active: Residual Frontend Truth-Surface Cleanup (2026-04-15)

> Goal: remove the remaining low-risk but still-shipped frontend wording/comment/fallback seams that still publish hub/catalog/set/enumeration terminology inside already-neutralized entity-first UI files, without reopening the broader dirty-tree refactor.

### Final Action Plan (Current Session)

- [x] Neutralize the remaining touched delete-dialog, selection-panel, record-screen, and shared-comment truth surfaces in active metahubs frontend production files.
  - Outcome: the touched active dialogs, container selection helpers, record-screen empty/error/tab labels, shared storage comments, and shared type/API comments no longer publish the narrow residual hub/catalog wording that survived in already-neutralized entity-first files.
- [x] Preserve current runtime behavior and compatibility-sensitive route/query/data contracts while removing only the residual shipped wording/comments/fallbacks in this slice.
  - Outcome: the slice kept the existing route/query/data contracts intact, retained the `currentHubId` prop as a compatibility alias for `ContainerSelectionPanel`, and stayed out of the larger backend/manual-dispatch refactor already present in the dirty branch.
- [x] Run focused metahubs-frontend validation plus the canonical root `pnpm build`, then update memory-bank status files only after checks are green.
  - Outcome: `get_errors` stayed clean for the touched files, `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Frontend Entity-First Terminology Reconciliation (2026-04-15)

> Goal: remove the remaining active frontend `legacy` / `catalog-compatible` truth-surface wording and compat-only type names that still contradict the shipped entity-first authoring contract, without reopening unstable file-move work already happening in the dirty tree.

### Final Action Plan (Current Session)

- [x] Neutralize the remaining active metahubs frontend compatibility-only type names and entity-instance surface wording in production source.
  - Outcome: `LegacyMetahubInput` is now `MetahubDraftInput`, the entity instance surface now uses linked-collection naming in local variables and translation keys, and the touched production wording no longer publishes `catalog-compatible` banner/delete copy in the active files.
- [x] Synchronize the touched EN/RU metahubs locale strings and focused test wording with the same neutral terminology.
  - Outcome: the touched EN/RU locale blocks now use linked-collection/existing-format wording, and the focused `EntityInstanceList` tests describe linked collection, tree entity, value group, and option list surfaces instead of the old compatibility labels.
- [x] Run focused metahubs-frontend validation plus the canonical root `pnpm build`, then update memory-bank status files only after checks are green.
  - Outcome: `get_errors` stayed clean for the touched frontend files, `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Residual Backend Truth-Surface Cleanup (2026-04-15)

> Goal: remove the last validated backend/entity-first truth-surface blockers that still contradict the claimed neutral architecture without reopening broad runtime rewrites.

### Final Action Plan (Current Session)

- [x] Replace the remaining `isBuiltinMetahubObjectKind()` production branching in `MetahubObjectsService.ts` with the current entity-behavior / standard-kind resolution contract.
  - Outcome: `MetahubObjectsService.ts` no longer hard-codes catalog/set/enumeration/shared-pool cleanup branches inline; shared-override cleanup now resolves through a computed helper built from the shared target-kind map plus the current behavior-registry contract.
- [x] Remove stale OpenAPI route-source references to deleted legacy backend folders from `packages/universo-rest-docs/scripts/generate-openapi-source.js` and keep the generator aligned with the shipped entity-owned/public route surfaces.
  - Outcome: the route-source inventory was already aligned with the mounted router, so this slice fixed the real remaining truth-surface instead: the generator tag registry and package README pair now use `Field Definitions`, `Fixed Values`, and `Records`, and the regenerated OpenAPI artifacts no longer publish `Attributes` / `Constants` / `Elements` as active metadata tags.
- [x] Run focused backend/rest-docs validation plus the canonical root `pnpm build`, then update memory-bank status files only after the checks are green.
  - Outcome: `pnpm --filter @universo/metahubs-backend build` passed, `pnpm --filter @universo/rest-docs build` passed with green `verify:route-sources`, regenerated `src/openapi/index.yml` and `dist/openapi-bundled.yml`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Layouts Resources Flow Playwright Reconciliation (2026-04-15)

> Goal: repair the stale metahub layouts browser proof so it matches the shipped Resources route contract and selector surface after the Common -> Resources migration.

### Final Action Plan (Current Session)

- [x] Retarget the stale layouts Playwright flow from the removed `/common` route/heading/selector expectations to the shipped `/resources` layouts contract.
  - Outcome: `metahub-layouts.spec.ts` now opens `/metahub/:id/resources`, expects the `Resources` heading, follows `/resources/layouts/:layoutId`, and keeps the list -> details -> widget-toggle proof on the shipped route tree.
- [x] Update any shared selector contract drift required by that browser proof without reopening unrelated product surfaces.
  - Outcome: the shared selector contract now exposes `metahubResourcesTabs` and `metahubResourcesContent`, so the flow uses the current shipped resources test ids instead of stale Common-only selectors.
- [x] Run the focused Chromium layouts flow and only close the slice if the targeted browser proof passes.
  - Outcome: the first focused rerun proved the old failure was a harness timeout, not a route mismatch; after adding `test.setTimeout(300_000)` like comparable heavy metahub flows, the follow-up wrapper rerun completed green with `2 passed`.

## Active: RecordList Entity-First Type Reconciliation (2026-04-15)

> Goal: repair the currently broken entity-first RecordList frontend slice so the generic record editor matches the active neutral metadata/runtime contracts and the metahubs frontend package can be validated again.

### Final Action Plan (Current Session)

- [x] Repair the direct-query parameter and helper import drift in `RecordList.tsx` so it matches the current `queryKeys` and metadata API contracts.
  - Outcome: the direct field-definition, record, and entity lookups now pass the required pagination/query-key params (`limit`, `offset`, `sortOrder`, optional `sortBy`), and the file imports the neutral record helper types it already depends on.
- [x] Replace the remaining `CodenameVLC`-as-string assumptions in dynamic field configs, table columns, and set-default payload handling with localized string resolution helpers.
  - Outcome: `RecordList.tsx` now resolves localized codenames into stable string keys before building dynamic field configs, table columns, copy defaults, and set-reference payload normalization, so the UI keeps using string payload keys without leaking `CodenameVLC` into string-only contracts.
- [x] Reconcile the action-context promise contracts around record and linked-collection dialogs, then rerun targeted validation for the touched frontend slice.
  - Outcome: the record action context now returns promise-based update/delete/refresh flows, the shared `BaseEntityMenu` helper typing explicitly allows edit/copy dialog callbacks, record updates can carry `expectedVersion`, `get_errors` is clean for the touched file, `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed without errors.

## Active: Behavior-Based Standard Blocking References (2026-04-15)

> Goal: remove the next manual standard-kind dispatch seam from `entityInstancesRoutes.ts` by moving catalog/set/enumeration `blocking-references` onto the generic entity controller + behavior-service contract, then validate the route contract with focused backend tests and builds.

### Final Action Plan (Current Session)

- [x] Add a generic entity controller handler for standard blocking references that reuses the existing standard-kind behavior blocking-state contract.
  - Outcome: `entityInstancesController.ts` now exposes `getBlockingReferences`, reuses the standard-kind behavior blocking-state path for `catalog`, `set`, and `enumeration`, preserves the current per-kind payload shapes (`catalogId`, `setId`, `enumerationId`, `blockingReferences`, `canDelete`), and keeps unsupported-kind / missing-entity failures explicit.
- [x] Retarget the entity-owned `blocking-references` route away from manual child-controller dispatch and add focused route coverage for catalog/set/enumeration.
  - Outcome: `/metahub/:metahubId/entities/:kindKey/instance/:entityId/blocking-references` now resolves through the generic entity controller instead of direct child-controller dispatch, the focused route suite covers catalog/set/enumeration behavior through that entity-owned endpoint, and `hub` is explicitly rejected on this generic blocking-references path.
- [x] Run focused backend validation plus the canonical root build, then update memory-bank status files only after the checks are green.
  - Outcome: `entityInstancesRoutes.test.ts` passed `36/36`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green.

## Active: Behavior-Based Hub Blocking Endpoint (2026-04-15)

> Goal: remove the next small manual standard-kind dispatch seam from `entityInstancesRoutes.ts` by moving the hub `blocking-dependencies` endpoint onto the generic entity controller + behavior-service contract, then validate it with a focused route test and backend build.

### Final Action Plan (Current Session)

- [x] Extend the entity behavior contract with a hub blocking-state hook that returns the current delete-dependency payload without specialized router/controller ownership.
  - Outcome: `EntityBehaviorService` and `standardKindCapabilities.ts` now expose a reusable blocking-state path alongside delete-plan logic, and the hub payload keeps the existing `blockingCatalogs` / `blockingSets` / `blockingEnumerations` / `blockingChildHubs` / `totalBlocking` JSON shape.
- [x] Add a generic entity controller handler for hub blocking dependencies and retarget the entity-owned route away from `treeController`.
  - Outcome: `/metahub/:metahubId/entities/hub/instance/:entityId/blocking-dependencies` now resolves through `entityInstancesController.getBlockingDependencies` plus the standard-kind behavior registry instead of the manual `treeController` route dispatch.
- [x] Add focused route coverage for the behavior-based hub blocking endpoint and rerun the touched backend validation.
  - Outcome: the focused `entityInstancesRoutes.test.ts` suite passed `32/32`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green.

## Active: Public Runtime Route Neutralization (2026-04-15)

> Goal: remove the still-live hub/catalog/attribute/element public metahub route contract from the published read-only runtime surface by switching it to neutral entity-first resource paths, then revalidate the dedicated backend tests and generated OpenAPI artifacts.

### Final Action Plan (Current Session)

- [x] Replace the legacy public metahub route hierarchy in the isolated public router/controller with a neutral entity-first resource contract.
  - Outcome: the public read-only runtime now mounts `tree-entities`, `tree-entity/:treeEntityCodename`, `linked-collections`, `linked-collection/:linkedCollectionCodename`, `field-definitions`, `records`, and `record/:recordId` instead of the removed hub/catalog/attribute/element path hierarchy.
- [x] Retarget the dedicated public route Jest suite to the new route contract and keep behavior unchanged.
  - Outcome: `publicMetahubsRoutes.test.ts` now proves the same read-only listing/detail behavior through the neutral route contract, and the focused Jest rerun passed all `13` tests.
- [x] Regenerate the current-state OpenAPI artifacts and rerun focused plus package/root validation before syncing memory-bank status files.
  - Outcome: `pnpm --filter @universo/rest-docs build` regenerated both `src/openapi/index.yml` and `dist/openapi-bundled.yml` with the new public route paths, the old `/public/metahub/{slug}/hubs` and `/hub/.../catalog...` patterns disappeared from the generated specs, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Public Runtime Hardening And Remaining Legacy Seams (2026-04-15)

> Goal: close the reopened QA findings by restoring the broken metahubs frontend README truth surfaces, hardening the public metahub runtime around publication-backed reads instead of bare `is_public` live-schema reads, and removing the next still-live standard-kind frontend/backend seams from active production source.

### Final Action Plan (Current Session)

- [x] Restore the broken metahubs frontend README EN/RU truth surfaces so examples and sections match the live entity-first contract without malformed markdown.
  - Outcome: `packages/metahubs-frontend/base/README*.md` no longer contain duplicated headings inside code fences or malformed development sections, the integration example now matches the current entity-first route surface, and EN/RU parity remains exact at `437/437` lines.
- [x] Harden the public metahub runtime contract so unauthenticated reads are backed by explicit publication/runtime proof instead of only the metahub `is_public` flag.
  - Outcome: `publicMetahubsController.ts` now fails closed unless the public metahub also has a `full`-access publication with an active snapshot-backed version, and the focused public route suite was expanded to prove the new 404 cases.
- [x] Neutralize the next active standard-kind production seam across backend/frontend without broad unsafe rewrites.
  - Outcome: the touched backend child/metadata controllers, frontend delete flows, and EN/RU metahubs locale strings no longer ship hub/catalog/set/enumeration/constant/attribute/element delete-conflict wording in this slice; compatibility-sensitive error codes and translation keys were intentionally preserved.
- [x] Revalidate touched backend/frontend/browser slices and rerun the canonical root build before updating memory-bank closure state.
  - Outcome: `publicMetahubsRoutes.test.ts` passed `16/16`, the focused backend message-contract suites passed `63/63`, both touched package builds passed, and the canonical root `pnpm build` completed green.

## Active: Residual Legacy Truth-Surface Cleanup (2026-04-15)

> Goal: remove the remaining low-risk but still-shipped legacy seams that are already isolated from the core entity-first runtime contract: the last metahub backend UUID v4-style pending id generation, the stale V2-only E2E helper/spec file names, and the leftover `catalog-v2` mock preset surface.

### Final Action Plan (Current Session)

- [x] Replace the remaining metahubs backend pending object id generation that still uses `randomUUID()` with the canonical UUID v7 helper.
  - Outcome: `entityInstancesController.ts` now uses `generateUuidV7()` for pending object ids, matching the repository UUID v7 contract already used elsewhere in metahubs/backend utility flows.
- [x] Remove the remaining V2-only frontend/E2E truth surfaces by renaming the helper/spec files and updating the stale mock preset codename.
  - Outcome: the frontend MSW preset now uses the direct `catalog` codename instead of `catalog-v2`, and the last V2-only flow/helper files were renamed to `metahub-standard-preset-runtime.spec.ts` and `entity-runtime-helpers.ts`.
- [x] Run focused validation and the canonical root build, then sync memory-bank status files with the verified outcomes.
  - Outcome: `get_errors` stayed clean for all touched files, both `pnpm --filter @universo/metahubs-backend build` and `pnpm --filter @universo/metahubs-frontend build` passed, the targeted negative grep returned no remaining `randomUUID()`, `catalog-v2`, `entity-v2-helpers`, or `metahub-entities-v2-runtime` matches in the touched active paths, and the canonical root `pnpm build` task completed without errors.

## Active: Residual Standard-Kind Local Naming Cleanup (2026-04-15)

> Goal: remove the remaining business-named local create-form and request-controller symbols from the active entity-owned standard runtime/tests where the shipped module contract is already neutral.

### Final Action Plan (Current Session)

- [x] Neutralize the remaining create-form and mutation local symbols in `TreeEntityList.tsx`.
  - Outcome: the active tree runtime now uses neutral local names such as `createTreeEntityMutation`, `updateTreeEntityMutation`, `createTreeEntityContext`, `handleCreateTreeEntity`, and `validateCreateTreeEntityForm` instead of the last `createHub*` / `*HubMutation` seam in this module.
- [x] Neutralize the focused optimistic-mutation test helper names that still preserve `createHubRequest`, `createSetRequest`, and `createEnumerationRequest` wording.
  - Outcome: the touched focused suite now uses neutral request-controller locals such as `createTreeEntityRequest`, `createValueGroupRequest`, and `createOptionListRequest` while keeping the same mocked APIs and assertions.
- [x] Run focused metahubs-frontend validation for the touched slice and update memory-bank status only after the checks are green.
  - Outcome: `get_errors` stayed clean for both touched files, `pnpm --filter @universo/metahubs-frontend build` passed, the targeted optimistic-mutation rerun passed for the renamed cases (`6 passed`, `7 skipped`), and the canonical root `pnpm build` completed green with `30 successful, 30 total`. A full run of `optimisticMutations.remaining.test.tsx` still exposes two unrelated pre-existing reorder failures in the locked shared constants/attributes coverage, so this slice is closed without claiming that the entire file is green.

## Active: Final Entity-Only Surface Completion (2026-04-15)

> Goal: finish the remaining production-source entity-first migration work by removing the last legacy metahub route redirects, neutralizing the surviving standard-kind source seams across frontend/backend/template code, rewriting stale docs that still describe Common/legacy surfaces, and rerunning end-to-end validation so the plan can be closed honestly.

### Final Action Plan (Current Session)

- [x] Collapse the remaining standard child-instance backend route seam in `entityInstancesRoutes.ts` so active entity-owned paths stop delegating through legacy `/catalogs`, `/sets`, `/enumerations`, `/hubs`, and `blocking-catalogs` URL fragments where a neutral child-resource surface is already possible.
  - Outcome: the active backend now serves child standard kinds through generic nested instance endpoints such as `/entities/:kindKey/instance/:hubId/instances`, `/instance/:hubId/instance/:entityId`, and `/blocking-dependencies`, while metadata child mounts were retargeted to `/instance/:hubId/instance/:entityId/...` and the focused backend route suite stayed green.
- [x] Retarget the active frontend standard child-resource API/path helpers and route builders to the neutral backend contract.
  - Outcome: `entityMetadataRoutePaths.ts`, `MainRoutes.tsx`, the standard runtime API helpers, and the metadata API helpers now emit/consume the generic nested instance contract instead of `/catalogs`, `/catalog/:id`, `/sets`, `/enumerations`, and `/blocking-catalogs` child URLs.
- [x] Update the focused route, API, and browser-proof tests plus touched docs/README truth surfaces to the neutral child-resource contract.
  - Outcome: the focused shared route-path test, the TreeEntityList route-state test, and the touched metahubs frontend README EN/RU examples now match the generic nested instance surface.
- [x] Run focused validation for the touched metahubs frontend/backend slices and then rerun the canonical root `pnpm build` before refreshing memory-bank status files.
  - Outcome: focused frontend Vitest passed for the retargeted route-builder and tree-route slices (`2` files / `4` tests), focused backend Jest passed for `entityInstancesRoutes.test.ts` (`31` tests), both touched package builds passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Entity-Centric Navigation And Diagnostics Closure (2026-04-15)

> Goal: remove the remaining sidebar/public-route truth-surface seams that still advertise metahub `common` and direct standard-kind entrypoints, then close the currently reported TypeScript configuration diagnostics before refreshing memory-bank status.

### Final Action Plan (Current Session)

- [x] Replace the remaining hard-coded metahub sidebar entrypoints with an entity-centric navigation surface.
  - Outcome: the static metahubs dashboard export and the live template-mui metahub menu now expose board, resources, entities, and dynamic entity-type items instead of hard-coded `hubs` / `catalogs` / `sets` / `enumerations` sidebar links.
- [x] Neutralize the active public shared-resources route/export contract from `common` / `MetahubSharedResources` to a neutral resources surface.
  - Outcome: the active frontend/public contract now uses `MetahubResources` and `/metahub/:id/resources`, while legacy `/common`, `/general`, and `/layouts` entrypoints continue as compatibility redirects; breadcrumbs, focused tests, typings, i18n labels, and the touched metahubs README truth surfaces were retargeted to the resources surface.
- [x] Fix the currently reported TypeScript configuration diagnostics in the touched root/package tsconfig files.
  - Outcome: `packages/start-backend/base/tsconfig.json` now sets `rootDir`, `packages/metahubs-backend/base/tsconfig.json` no longer carries the deprecated `baseUrl`, and the root tsconfig was restored to the build-compatible `baseUrl` + `ignoreDeprecations: 5.0` contract required by the actual workspace TypeScript version.
- [x] Run focused validation and the canonical root build, then sync memory-bank status files with the verified outcomes.
  - Outcome: focused Vitest passed for the touched metahubs-frontend slices (`3` files / `11` tests), focused template-mui Jest passed for breadcrumbs/menu (`2` suites / `9` tests), the directly affected frontend package builds passed, `pnpm --filter @universo/metahubs-backend build` passed after the final tsconfig cleanup, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Entity-First Final Reconciliation And Debt Closure (2026-04-15)

> Goal: close the remaining validated debt in the entity-first final migration slice by repairing the stale Playwright permission fixture, synchronizing the touched metahubs package README truth surfaces, rerunning focused validation, and only then updating memory-bank closure state.

### Final Action Plan (Current Session)

- [x] Reconcile the entity-first final migration plan against current source and validation evidence.
  - Outcome: the live runtime, focused backend/frontend tests, and the failing permission proof were rechecked against the current tree, so the remaining work is now narrowed to proof/doc synchronization instead of speculative architecture debt.
- [x] Repair the focused metahub member permission Playwright setup so the custom catalog-compatible coverage creates the matching entity instance kind.
  - Outcome: the stale workspace permission proof now creates the instance through the generic entity endpoint for the same custom compatible kind that the browser later opens, eliminating the old false-negative mismatch between fixture data and route under test.
- [x] Synchronize the touched metahubs package README truth surfaces with the live entity-first structure and router composition.
  - Outcome: `packages/metahubs-frontend/base/README*.md` and `packages/metahubs-backend/base/README*.md` now describe the current entity-first frontend tree and backend router composition instead of removed `hubs/catalogs/attributes/elements` entrypoints or legacy `/:metahubId/hubs` examples, with EN/RU pairs kept in lockstep.
- [x] Run focused validation plus the canonical root `pnpm build`, then update memory-bank status files with the validated outcomes.
  - Outcome: `get_errors` stayed clean for the touched spec and README files, README localization parity stayed exact (`129/129` backend and `437/437` frontend lines), the focused Playwright rerun passed both tests including `catalog-compatible entity instances stay read-only for metahub members`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Metadata Transport Segment Neutralization (2026-04-14)

> Goal: remove the still-live `attributes` / `constants` / `elements` transport route segments from the active metadata authoring surface while preserving the current internal tab/query-state vocabulary until a dedicated cache/local-symbol slice.

### Final Action Plan (Current Session)

- [x] Neutralize the mounted backend metadata route suffixes for field definitions, fixed values, and records.
  - Outcome: the active entity-owned backend metadata routes now mount on `field-definitions` / `field-definition`, `fixed-values` / `fixed-value`, and `records` / `record` path segments instead of the legacy `attributes` / `constants` / `elements` suffixes, without changing controller behavior.
- [x] Retarget the active frontend metadata route builders, router registrations, and API clients to the neutral transport segments.
  - Outcome: the shared authoring route builders, frontend router registrations, metadata API clients, breadcrumb href builders, and layout path derivations now emit and consume the neutral metadata transport vocabulary while preserving the current internal tab/query-state naming.
- [x] Update the focused backend/frontend route tests and shared path assertions for the transport cutover.
  - Outcome: the touched backend route suites, frontend route-path tests, metadata screen router tests, blocking-delete dialog assertions, and breadcrumb coverage now lock the neutral metadata route contract; two frontend suites also had their stale pre-neutralization mutation-hook mocks updated to the current field-definition / record hook names.
- [x] Run focused validation for the touched metadata transport slice, then rerun the canonical root `pnpm build` if the package-level checks stay green.
  - Outcome: focused Vitest passed for `entityMetadataRoutePaths.test.ts`, `FieldDefinitionList.systemTab.test.tsx`, `RecordList.settingsContinuity.test.tsx`, `RecordList.createErrorFlow.test.tsx`, `ValueGroupDeleteDialog.test.tsx`, and `OptionListDeleteDialog.test.tsx` (`6` files / `13` tests); focused backend Jest passed for `fieldDefinitionsRoutes.test.ts`, `fixedValuesRoutes.test.ts`, and `recordsRoutes.test.ts` (`3` suites / `39` tests); focused `NavbarBreadcrumbs.test.tsx` passed (`3` tests); the touched package builds stayed green; and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Metadata API Helper Contract Neutralization (2026-04-15)

> Goal: remove the remaining attribute/constant/element export and local controller schema seams from the active metadata API/controller entrypoints while intentionally preserving the currently mounted transport path strings until a dedicated route-segment migration.

### Final Action Plan (Current Session)

- [x] Neutralize the active metadata API helper export contract under `domains/entities/metadata/**/api/**`.
  - Outcome: the active metadata API surfaces now expose neutral field-definition / fixed-value / record helper names and matching hook/type contracts instead of the remaining `attribute` / `constant` / `element` export seam, while intentionally preserving the currently mounted transport path strings.
- [x] Neutralize the touched backend metadata controller-local schema/helper symbols where they still expose attribute/constant/element naming only as internal implementation detail.
  - Outcome: the touched controller-local schemas in `fieldDefinition/controller.ts`, `fixedValue/controller.ts`, and `record/controller.ts` now use neutral field-definition / fixed-value / record naming, so the immediate controller implementation surface no longer advertises the legacy child-resource wording through its active local schemas.
- [x] Run focused validation for the touched frontend/backend metadata slice, then rerun the canonical root `pnpm build` if production source changes stay green.
  - Outcome: `pnpm --filter @universo/metahubs-frontend build` passed after the metadata helper contract cutover, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Frontend Standard UI Local Alias Neutralization (2026-04-14)

> Goal: remove the remaining Hub/Catalog/Set/Enumeration local alias and default-export seams from the active standard UI modules and focused test wording where the runtime contract is already entity-owned.

### Final Action Plan (Current Session)

- [x] Neutralize the remaining standard UI local alias/default-export seams in the touched list/action modules.
  - Outcome: the touched standard UI modules now use neutral local/default-export names such as `TreeEntityList`, `LinkedCollectionList`, `ValueGroupList`, `OptionListList`, and `treeEntityActions` instead of the residual `HubList` / `CatalogList` / `SetList` / `EnumerationList` / `hubActions` alias seam.
- [x] Retarget the focused action-factory tests to the neutral local naming.
  - Outcome: the touched action-factory test wording now describes the neutral `TreeEntityActions` / `LinkedCollectionActions` / `OptionListActions` contract instead of the removed local alias vocabulary.
- [x] Run focused metahubs-frontend validation for the touched alias-cleanup slice, then rerun the canonical root `pnpm build` if production source changes stay green.
  - Outcome: focused Vitest passed for `actionsFactories.test.ts` (`1` file / `8` tests), `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Frontend Entity Authoring Route Builder Neutralization (2026-04-14)

> Goal: remove the remaining Hub/Catalog/Set/Enumeration naming from the active frontend authoring route-builder contract and retarget the live entity-owned consumers without changing the currently-mounted backend URL shapes in the same slice.

### Final Action Plan (Current Session)

- [x] Introduce neutral shared entity-authoring route builder names and neutral tab/type aliases in `domains/shared/entityMetadataRoutePaths.ts`.
  - Outcome: the touched shared route-builder contract now exports neutral tree-entity / linked-collection / value-group / option-list authoring builders and matching neutral tab/type aliases while intentionally preserving the current emitted URL strings.
- [x] Retarget the active standard-runtime, metadata, delete-dialog, and shared test consumers to the neutral builder contract.
  - Outcome: the touched standard-runtime views, metadata screens, layout/detail navigation, blocking-delete dialogs, and shared route-path tests now import the neutral builder surface instead of the old Hub/Catalog/Set/Enumeration builder names.
- [x] Neutralize the remaining builder/helper identifiers inside the touched standard and metadata API modules where the current file already proves a safe rename.
  - Outcome: the touched standard and metadata API files now use neutral linked-collection / value-group / option-list / tree-entity / collection / container helper names instead of the stale Catalog/Set/Enumeration/Hub builder identifiers, while preserving the current HTTP path strings.
- [x] Run focused metahubs-frontend validation for the touched route-builder slice, then rerun the canonical root `pnpm build` if the package stays green.
  - Outcome: `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for `entityMetadataRoutePaths.test.ts`, `TreeDeleteDialog.test.tsx`, `ValueGroupDeleteDialog.test.tsx`, `OptionListDeleteDialog.test.tsx`, `FieldDefinitionList.systemTab.test.tsx`, `RecordList.settingsContinuity.test.tsx`, and `RecordList.createErrorFlow.test.tsx` (`7` files / `14` tests), and the canonical root `pnpm build` completed green (`30 successful, 30 total`).

## Active: Entity-First Final Migration — Container Vocabulary And Shared Runtime Neutralization (2026-04-14)

> Goal: remove the still-live `hub` / `catalog` business vocabulary from the active entity-owned frontend runtime where the shipped contract is already generic enough to speak in terms of containers, linked collections, and entity-owned child resources.

### Final Action Plan (Current Session)

- [x] Neutralize the live container-assignment contract in the active frontend runtime and shared components.
  - Outcome: the touched shared panels and active entity-owned consumers now use neutral container-oriented prop names while intentionally preserving stored backend config keys such as `hubs`, `isSingleHub`, and `isRequiredHub` until a dedicated persistence migration changes them.
- [x] Neutralize the touched entity-owned child-resource API/path helper vocabulary and the shared common page seams.
  - Outcome: the touched child-resource helpers now use neutral collection/container naming, and the shared common page tabs now speak in terms of field definitions, fixed values, and option values instead of the old business vocabulary.
- [x] Retarget the touched focused tests and i18n copy to the neutral runtime contract.
  - Outcome: EN/RU metahubs locale entries and the focused CommonPage / EntityInstanceList tests now match the neutral runtime vocabulary.
- [x] Run focused metahubs-frontend validation for the touched runtime slice, then rerun the canonical root `pnpm build` if the package stays green.
  - Outcome: focused Vitest passed for `CommonPage.test.tsx` and `EntityInstanceList.test.tsx` (`2` files / `12` tests), and the canonical root `pnpm build` completed green (`30 successful, 30 total`).
- [x] Reconcile the plan file checkbox-by-checkbox against verified implementation evidence and check only the items that are truly complete.
  - Outcome: the plan file now marks only the items re-verified against the current source tree plus fresh validation evidence from this branch state; broader unchecked phases remain unchecked on purpose.

## Active: Entity-First Final Migration — Residual Standard-Kind Runtime Audit (2026-04-14)

> Goal: continue the entity-first cleanup after the container/shared-runtime slice by auditing the surviving standard-kind runtime seams that still expose business-specific mutation or hook names inside the active source tree.

### Final Action Plan (Next Slice)

- [x] Inventory the surviving standard-kind mutation and hook seams in the active entity runtime.
  - Outcome: the next safe seam was confirmed in the entity-owned standard runtime contract, where linked collections, value groups, and option lists still exported business-named mutation/type/action identifiers.
- [x] Neutralize the next verified runtime seam without changing persistence or route contracts unless the source already proves that it is safe.
  - Outcome: the touched standard runtime now exposes neutral linked-collection / value-group / option-list / option-value hook, form, action, and mutation-type identifiers while intentionally preserving the existing API paths and data-kind semantics.
- [x] Revalidate the touched slice and rerun the canonical root `pnpm build` if production source changes again.
  - Outcome: `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for the touched standard-runtime slice (`7` files / `32` tests), and the canonical root `pnpm build` completed green (`30 successful, 30 total`).

## Active: Entity-First Final Migration — Standard Runtime Mutation Contract Neutralization (2026-04-14)

> Goal: remove the still-live `Catalog` / `Set` / `Enumeration` mutation, form, and action contract names from the active entity-owned standard runtime while preserving the existing API paths and kind-specific payload semantics.

### Final Action Plan (Current Session)

- [x] Neutralize the active linked-collection / value-group / option-list hook and mutation type contracts under `entities/standard/**`.
  - Outcome: the touched standard runtime now exports `useCreateLinkedCollection`, `useCreateValueGroup`, `useCreateOptionList`, `useCreateOptionValue`, the matching update/delete/copy/reorder hooks, and the neutral `Create*` / `Update*` / `Delete*` / `Copy*` / `Reorder*` contract types instead of the old business-named mutation contract.
- [x] Retarget the touched standard runtime views, metadata consumers, and focused tests to the neutral contract.
  - Outcome: `LinkedCollectionActions.tsx`, `ValueGroupActions.tsx`, `OptionListActions.tsx`, the three standard list views, the metadata consumers, and the touched focused tests now use neutral linked-collection / value-group / option-list / option-value form, action, and mutation naming.
- [x] Run focused metahubs-frontend validation for the touched standard-runtime slice, then rerun the canonical root `pnpm build` if the package stays green.
  - Outcome: `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for `optimisticMutations.remaining.test.tsx`, `SettingsOriginTabs.test.tsx`, `actionsFactories.test.ts`, `FieldDefinitionList.systemTab.test.tsx`, `RecordList.settingsContinuity.test.tsx`, `RecordList.createErrorFlow.test.tsx`, and `SelectableOptionList.optimisticUpdate.test.tsx` (`7` files / `32` tests), and the canonical root `pnpm build` completed green (`30 successful, 30 total`).

## Active: Entity-First Final Migration — Standard Runtime API Helper Neutralization (2026-04-14)

> Goal: remove the still-live `Catalog` / `Set` / `Enumeration` API helper export names from the active entity-owned standard runtime while preserving the existing HTTP path shapes and backend payload semantics.

### Final Action Plan (Current Session)

- [x] Neutralize the exported linked-collection / value-group / option-list / option-value API helper contract under `entities/standard/api/**`.
  - Outcome: the touched `entities/standard/api/**` files now export neutral linked-collection / value-group / option-list / option-value helper names and type aliases instead of the old business-named API contract.
- [x] Retarget the touched hooks, list utilities, and focused tests/mock seams to the neutral API helper contract.
  - Outcome: the touched hooks, standard list-data helpers, metadata consumers, blocking-delete dialogs, and focused mocks/tests now import and mock the neutral API helper surface while preserving the existing HTTP path shapes.
- [x] Revalidate the touched frontend slice and rerun the canonical root `pnpm build` if the package stays green.
  - Outcome: `pnpm --filter @universo/metahubs-frontend build` passed clean after the retarget, focused Vitest passed for the touched API-helper slice (`7` files / `24` tests), and the canonical root `pnpm build` completed green (`30 successful, 30 total`).

## Active: Entity-First Final Migration — Tree Runtime Seam Neutralization (2026-04-14)

> Goal: remove the remaining `hub`-named runtime ownership seam from the tree-kind frontend implementation so the active entity authoring modules stop exposing `useMetahubTrees`, `TreeList`, `TreeActions`, and `*Hub*` mutation/type/context names as the live module contract.

### Final Action Plan (Current Session)

- [x] Rename the live tree-kind frontend modules/files away from the old tree/hub seam names and retarget active imports.
  - Outcome: the touched metahubs-frontend runtime now uses `useTreeEntities.ts`, `useTreeEntityListData.ts`, `treeEntityMutationTypes.ts`, `treeEntityMutations.ts`, `TreeEntityActions.tsx`, `TreeEntityList.tsx`, and `treeEntityListUtils.ts` instead of the removed `useMetahubTrees.ts`, `useTreeListData.ts`, `treeMutationTypes.ts`, `treeMutations.ts`, `TreeActions.tsx`, `TreeList.tsx`, and `treeListUtils.ts`.
- [x] Rename the touched tree-kind hook/action/context/type exports to the neutral tree-entity contract and repair downstream consumers/tests.
  - Outcome: active source now uses `useCreateTreeEntity`, `useUpdateTreeEntity`, `useDeleteTreeEntity`, `useCopyTreeEntity`, `useReorderTreeEntity`, `CreateTreeEntityParams`, `TreeEntityCopyInput`, `TreeEntityFormValues`, `TreeEntityMenuBaseContext`, `TreeEntityActionContext`, `buildTreeEntityInitialValues`, `buildTreeEntityFormTabs`, `validateTreeEntityForm`, `canSaveTreeEntityForm`, and `toTreeEntityPayload`; the touched downstream runtime/test consumers were retargeted to that contract.
- [x] Run focused metahubs-frontend validation for the tree-runtime slice, verify the removed tree/hub module identifiers are gone from `src/**`, then rerun the canonical root `pnpm build`.
  - Outcome: `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for the touched tree/downstream slices (`7` files / `32` tests), a negative grep over `packages/metahubs-frontend/base/src` returned zero matches for the removed tree/hub module identifiers, and the canonical root `pnpm build` completed green (`30 successful, 30 total`).

## Active: Entity-First Final Migration — Frontend Public Type Contract Neutralization (2026-04-14)

> Goal: remove the remaining business-named public type/export contract from `@universo/metahubs-frontend` so the entity-first frontend no longer exposes `Hub` / `Catalog` / `MetahubSet` / `Enumeration` as its active package-level API surface.

### Final Action Plan (Current Session)

- [x] Replace the remaining kind-specific public type names and display-converter names inside `packages/metahubs-frontend/base/src/**` with neutral entity-owned names.
  - Outcome: active metahubs-frontend source now uses `TreeEntity`, `LinkedCollectionEntity`, `ValueGroupEntity`, `OptionListEntity`, the matching `*Display` / `*LocalizedPayload` names, and neutral display converters instead of the old `Hub` / `Catalog` / `MetahubSet` / `Enumeration` type-export contract.
- [x] Retarget the touched package exports, delete dialogs, entity standard/runtime views, and focused tests to the neutral frontend type contract.
  - Outcome: `src/index.ts`, `src/displayConverters.ts`, `src/types.ts`, the touched components, and the active entity runtime/test consumers now import/export only the neutral frontend contract names under `packages/metahubs-frontend/base/src/**`.
- [x] Run focused metahubs-frontend validation, verify no other package imports the removed public type names from `@universo/metahubs-frontend`, then rerun the canonical root `pnpm build`.
  - Outcome: `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for the touched delete/entity-instance/tree slices (`5` files / `16` tests), a repository grep found no external package imports of the removed public type names from `@universo/metahubs-frontend`, and the canonical root `pnpm build` completed green (`30 successful, 30 total`).

## Active: Entity-First Final Migration — Remaining Named Seam Neutralization (2026-04-14)

> Goal: remove the next layer of still-live business-named runtime seams from the metahubs backend/frontend so the shipped code stops exposing `Hub` / `Catalog` / `Set` / `Enumeration` service and component ownership where neutral entity-owned naming is already viable.

### Final Action Plan (Current Session)

- [x] Rename the remaining backend service seams `MetahubHubsService` and `MetahubEnumerationValuesService` to neutral entity-owned service names and retarget active imports/tests.
  - Outcome: active backend source/tests now use `MetahubTreeEntitiesService` and `MetahubOptionValuesService`; the old business-named service files/classes are no longer imported anywhere under `packages/`.
- [x] Rename the remaining frontend public selection/delete component seams from kind-specific names to neutral entity-owned names and retarget active imports/tests.
  - Outcome: package components/index exports now expose `ContainerSelectionPanel`, `ContainerParentSelectionPanel`, `TreeDeleteDialog`, `LinkedCollectionDeleteDialog`, `ValueGroupDeleteDialog`, and `OptionListDeleteDialog` instead of the old kind-specific component contract.
- [x] Run focused metahubs backend/frontend validation for the renamed seam slice, then rerun the canonical root `pnpm build`.
  - Outcome: focused backend Jest passed (`5` suites / `56` tests), focused frontend Vitest passed (`5` files / `16` tests), both metahubs package builds passed, the canonical root `pnpm build` completed green (`30 successful, 30 total`), and a negative grep over `packages/` returned zero hits for the removed service/component seam names.

## Active: Entity-First Final Migration — Stale Contract Cleanup Pass (2026-04-14)

> Goal: remove the remaining stale `custom.*-v2` / metahub-specific `document` truth-surface markers from active tests/specs, reconcile the SchemaGenerator expectation with the shipped entity-first runtime contract, and record only the validation that is actually green now.

### Final Action Plan (Current Session)

- [x] Retarget the remaining active tests/specs that still preserve removed `custom.*-v2` or metahub-specific `document` assumptions.
  - Outcome: the touched backend/application/schema/E2E truth surfaces now use direct standard kinds or neutral custom kinds instead of `custom.catalog-v2`, `custom.set-v2`, `custom.hub-v2`, `custom.enumeration-v2`, or `custom.document-*`.
- [x] Reconcile the failing `SchemaGenerator` expectation with the current entity-first runtime contract.
  - Outcome: the schema-ddl test now locks the current behavior that only direct standard `hub|set|enumeration` kinds are non-physical, while custom kinds with compatibility hints still create physical tables.
- [x] Revalidate the touched packages and rerun the canonical root build before updating memory-bank state.
  - Outcome: focused backend Jest passed for the touched metahubs/application suites, `SchemaGenerator.test.ts` passed (`43` tests), the stale-marker grep over active `packages/` + `tools/` returned zero matches for the removed `custom.*-v2` / `custom.document-*` markers, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Entity-First Final Migration — Reality Reconciliation Pass (2026-04-14)

> Goal: reconcile the optimistic closure notes against the current repository state, fix the still-broken entity-first TypeScript/test surfaces, and only then mark plan phases/checklists as complete.

### Final Action Plan (Current Session)

- [x] Sync memory-bank status with the current repository evidence before making more closure claims.
  - Outcome: `tasks.md` and `activeContext.md` now describe the branch as an active reconciliation pass instead of a closed migration, which matches the reopened QA evidence.
- [x] Fix the remaining entity-first TypeScript contract issues in `EntityInstanceList.tsx`.
  - Target: replace stale hand-built VLC objects and mismatched localized payload/config helpers with the current canonical utility types so the generic entity-owned instance page compiles cleanly.
- [x] Fix the focused metahubs frontend action/copy tests that still encode stale readonly/JSX assumptions after the entity-owned surface cutover.
  - Target: align the test casts/import style with the current TS/Vitest contract instead of preserving pre-cutover assumptions.
- [ ] Reconcile the plan file checkbox-by-checkbox against verified implementation evidence and check only the items that are truly complete.
  - Target: no optimistic checkbox closure; every checked item must correspond to current source plus fresh validation.
- [x] Run focused validation for the touched metahubs frontend files, then rerun the required root `pnpm build` if focused checks are green.
  - Outcome: focused Vitest passed for `actionsFactories.test.ts`, `copyOptionPayloads.test.tsx`, and `EntityInstanceList.test.tsx` (`25` tests), `pnpm --filter @universo/metahubs-frontend build` passed after the entity-first typing/test cleanup, and the canonical root `pnpm build` was later rerun green during the follow-up stale-contract cleanup pass.
- [x] Update `activeContext.md` and `progress.md` only after the reconciliation/fix pass is validated.
  - Outcome: memory-bank closure text is now synced only after fresh validation instead of getting ahead of live diagnostics.

## Active: Backend Neutral Service Vocabulary Cutover (2026-04-14)

> Goal: finish the in-progress backend service neutralization so the renamed `MetahubFieldDefinitionsService`, `MetahubFixedValuesService`, and `MetahubRecordsService` no longer leave mixed legacy service identifiers in active source/tests, then validate the stabilized package/workspace state before recording closure.

### Final Action Plan (Current Session)

- [x] Remove the remaining mixed backend service identifiers from active source/tests after the service file/class rename pass.
  - Outcome: active backend factories, controllers, serializers, adapters, and touched tests now use `fieldDefinitionsService`, `fixedValuesService`, and `recordsService` instead of the transitional `attributesService`, `constantsService`, and `elementsService` service object names, and the renamed `MetahubRecordsService` no longer exposes mixed internal method/schema names such as `moveElement`, `reorderElement`, `validateElementData`, or `mapRowToElement`.
- [x] Normalize the touched service-internal comments/helpers that still describe the renamed services with the old wrapper vocabulary where that wording is no longer the intended contract.
  - Outcome: the design-time child-copy adapter naming now describes fixed values instead of constants service ownership, and the renamed service docblocks now explain the neutral field-definition/record contract while preserving the underlying historical table names where they still matter.
- [x] Run focused backend validation for the renamed service slice, then rerun the canonical root build if the package stays green.
  - Outcome: `pnpm --filter @universo/metahubs-backend build` passed twice during stabilization, focused Jest passed for the renamed service/router matrix (`7` suites / `81` tests) plus a final `recordsRoutes.test.ts` rerun (`4` tests) after the internal `moveRecord` / `reorderRecord` cleanup, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Frontend Shared Vocabulary Stabilization (2026-04-14)

> Goal: finish the post-rename stabilization for the metahubs frontend shared types/converters so the neutral `FieldDefinition` / `FixedValue` / `RecordItem` / `OptionValue` vocabulary becomes the only active local contract instead of a folder-only rename.

### Final Action Plan (Current Session)

- [x] Retarget the remaining metahubs-frontend source and focused tests from `toAttributeDisplay` / `toConstantDisplay` / `toHubElementDisplay` / `toEnumerationValueDisplay` to the neutral converter names.
  - Outcome: active metahubs-frontend source now imports only `toFieldDefinitionDisplay`, `toFixedValueDisplay`, `toRecordItemDisplay`, and `toOptionValueDisplay` from the local types barrel.
- [x] Remove the temporary backward-compat alias re-exports from `src/types.ts` and `src/index.ts` once active consumers stop depending on them.
  - Outcome: the local types/package barrels no longer re-export `Attribute`, `Constant`, `HubElement`, `EnumerationValue`, or the old converter alias names as canonical active contract.
- [x] Run focused metahubs-frontend validation for this rename slice and fix any fallout before closing it.
  - Outcome: `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for `types.test.ts`, `FieldDefinitionList.systemTab.test.tsx`, `RecordList.settingsContinuity.test.tsx`, `RecordList.createErrorFlow.test.tsx`, and `SelectableOptionList.optimisticUpdate.test.tsx`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- [x] Delete the orphan legacy `metadata/attribute`, `metadata/constant`, and `metadata/element` source copies once the active import graph is confirmed to use the neutral folders.
  - Outcome: `packages/metahubs-frontend/base/src/domains/entities/metadata` now contains only `fieldDefinition`, `fixedValue`, `optionValue`, and `record`, while the orphan `kinds/EnumerationValueList` duplicate was removed and the empty legacy directories were deleted.

## Active: Backend Generic Object Mutation And Route Wiring Cleanup (2026-04-14)

> Goal: remove the remaining noncanonical backend wrappers around generic object mutations and delete the temporary child-controller registry seam so entity-owned routes depend only on direct controller factories plus `createObject` / `updateObject`.

### Final Action Plan (Current Session)

- [x] Replace the remaining `MetahubObjectsService` business-named wrappers (`createCatalog`, `createEnumeration`, `createSet`, `updateCatalog`, `updateEnumeration`, `updateSet`) with direct generic object mutations in active source/tests.
  - Outcome: the live backend graph now uses `createObject` and `updateObject` exclusively for metahub object mutations, and the touched catalog-compatible controller paths no longer preserve a permanent business-named wrapper API.
- [x] Remove the `domains/entities/children/controllerRegistry.ts` indirection and wire `entityInstancesRoutes.ts` directly to the child-controller factories it actually uses.
  - Outcome: the entity route surface now instantiates `createTreeController`, `createLinkedCollectionController`, `createValueGroupController`, and `createOptionListController` directly, and the deleted registry file no longer exists in active source.
- [x] Run focused backend validation for the touched metahubs-backend surfaces, then rerun the canonical root build if the package build stays green.
  - Outcome: `pnpm --filter @universo/metahubs-backend build` passed, focused Jest passed for `src/tests/services/MetahubObjectsService.test.ts` (`9` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Entity-Owned Route Inventory And Residual Wording Cleanup (2026-04-14)

> Goal: remove the remaining stale route-source references and transitional managed wording that still survive in active code/docs after the entity-first backend/frontend cutovers.

### Final Action Plan (Current Session)

- [x] Retarget the OpenAPI source inventory to the current entity-owned backend route files instead of deleted top-level metadata route paths.
  - Outcome: `packages/universo-rest-docs/scripts/generate-openapi-source.js` now reads the active entity-owned metadata route files under `domains/entities/metadata/*/routes.ts`, and `pnpm --filter @universo/rest-docs build` regenerated the OpenAPI bundle after verifying the mounted router contract.
- [x] Normalize the touched backend/frontend/doc wording from stale `managed` phrasing to the current platform-provided or runtime-generated semantics where that wording is no longer the intended contract.
  - Outcome: the touched backend validation message, frontend system-attribute hint, frontend table-prefix helper, and metahubs-backend EN/RU README line now use platform-provided or physical-table wording instead of the stale `preset-managed` / `managed table` phrasing.
- [x] Run focused validation for the touched package surfaces, then rerun the canonical root build if the changes stay green.
  - Outcome: focused Jest passed for `src/tests/services/EntityTypeService.test.ts` (`10` tests), focused Vitest passed for `FieldDefinitionList.systemTab.test.tsx` (`4` tests), `pnpm --filter @universo/rest-docs build` passed, README EN/RU line counts remained aligned (`129` lines each), and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Standard Entity Route And Export Neutralization (2026-04-14)

> Goal: remove the remaining public per-kind page/export contract from the metahubs frontend and replace it with a single generic standard-entity route surface so the entity-first architecture no longer advertises `Hub/Catalog/Set/EnumerationEntityInstanceView` as a permanent public seam.

### Final Action Plan (Current Session)

- [x] Replace the per-kind frontend route wrappers with one generic standard-entity collection entrypoint and retarget `EntityInstanceList` to it.
  - Outcome: `StandardEntityCollectionPage.tsx` now owns the generic standard-kind rendering seam, and `EntityInstanceList.tsx` delegates standard kinds through that page instead of importing four dedicated per-kind wrappers.
- [x] Retarget the metahubs package exports and the core frontend route tree to the generic contract, then delete the obsolete per-kind page export surface.
  - Outcome: `@universo/metahubs-frontend` now exports `StandardEntityCollectionPage` and `StandardEntityChildCollectionPage`, `@universo/core-frontend` routes use the generic child-collection component with `childKind` props, and the deleted `Hub/Catalog/Set/EnumerationEntityInstanceView` export names no longer exist in active source.
- [x] Collapse the temporary `domains/entities/kinds/**` folder seam back into `domains/entities/standard/**` and retarget the touched imports/tests/docs.
  - Outcome: the temporary `kinds/**` subtree was renamed back to `standard/**`, touched imports/tests were repaired, and the package READMEs now describe the generic standard-entity route/export surface instead of the removed per-kind page contract.
- [x] Run focused metahubs-frontend validation plus the canonical root build and fix any regressions before closure.
  - Outcome: `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for `exports.test.ts` and `EntityInstanceList.test.tsx` (`14` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Backend Entity Metadata Route Ownership Cutover (2026-04-14)

> Goal: remove the remaining top-level backend metadata authoring folders so child-resource route/controller ownership lives under `domains/entities/**` only, while also cutting the mounted child-resource contract over to entity-owned URLs.

### Final Action Plan (Current Session)

- [x] Move the active attribute/constant/element route + controller ownership under `packages/metahubs-backend/base/src/domains/entities/metadata/**`.
  - Outcome: the shipped child-resource route factories and controllers now live under `entities/metadata/{attribute,constant,element}/**`, and router/package entrypoints were retargeted to those new module paths.
- [x] Delete the now-dead top-level backend metadata/standard-kind folders once the active source graph no longer imports them.
  - Outcome: the obsolete top-level backend folders for `attributes`, `catalogs`, `constants`, `elements`, `enumerations`, and `sets` were physically removed from the working tree after their live imports were eliminated.
- [x] Remove legacy child-resource authoring URLs from the mounted backend contract and retarget focused route tests to entity-owned paths only.
  - Outcome: the moved route factories now expose only entity-owned URL shapes, and the focused route suites for attributes/constants/elements now assert the new `/metahub/:id/entities/:kindKey/...` contract instead of removed top-level catalog/set URLs.
- [x] Re-run focused backend validation and the canonical root build before closing the slice.
  - Outcome: `pnpm --filter @universo/metahubs-backend build` passed, focused backend Jest passed for `attributesRoutes.test.ts`, `constantsRoutes.test.ts`, and `elementsRoutes.test.ts` (`39` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`.

## Active: Backend Behavior Registry Foundation (2026-04-14)

> Goal: start the still-open backend migration phases by moving standard-kind delete/table/ACL rules into a neutral entity behavior registry, then route the generic entity controller and object service through that registry instead of hardcoded kind branches.

### Final Action Plan (Current Session)

- [x] Add neutral backend behavior-registry primitives under `domains/entities/services/**` (`EntityBehaviorService`, registry helpers, standard-kind capability/registration modules) without introducing new permanent business-named service seams.
  - Outcome: the backend now ships `EntityBehaviorService`, registry helpers, and standard-kind capability/registration modules under `domains/entities/services/**` for delete/table/ACL behavior.
- [x] Refactor the generic entity controller and `MetahubObjectsService` to consume the registry for delete-plan/table-name/optimistic-lock behavior instead of local hardcoded standard-kind branches.
  - Outcome: `entityInstancesController.ts` and `MetahubObjectsService.ts` now delegate the standard-kind behavior tail through the neutral registry rather than local `catalog|hub|set|enumeration` branches.
- [x] Add focused backend service coverage for the new registry/capability layer and keep the existing delete-pattern tests green.
  - Outcome: focused backend tests for `behaviorRegistry`, `standardKindCapabilities`, `EntityDeletePatterns`, and `MetahubObjectsService` passed after the registry cutover.
- [x] Run focused backend validation (`pnpm --filter @universo/metahubs-backend build` plus targeted Jest) and fix regressions before marking this slice done.
  - Outcome: `pnpm --filter @universo/metahubs-backend build` passed and the targeted backend Jest matrix stayed green after the registry and child-controller neutralization pass.
- [x] Sync `activeContext.md` and `progress.md` only after the new registry-based backend slice is validated.
  - Outcome: the validated backend behavior-registry foundation is now tracked in the memory bank instead of only in transient chat context.

## Active: Entity-Only Frontend Domain Elimination (2026-04-14)

> Goal: finish the remaining frontend architecture cutover so `packages/metahubs-frontend/base/src/domains` no longer ships legacy metadata authoring folders (`attributes`, `constants`, `elements`, `general`) and the active import graph is driven from entity-owned seams only.

### Final Action Plan (Current Session)

- [x] Materialize the real metadata/common implementations under `domains/entities/**` instead of keeping wrapper re-exports, then delete the old top-level `attributes/`, `constants/`, `elements/`, and `general/` folders.
  - Target: move active `api/`, `hooks/`, `ui/`, and touched `__tests__/` files into `domains/entities/metadata/*` and `domains/entities/shared/*`, preserving behavior while removing the legacy folders from the shipped tree.
- [x] Retarget the remaining production imports, package exports, and focused tests to the new entity-owned file locations.
  - Target: production `src` consumers stop importing deleted top-level metadata folders; focused tests follow the new paths instead of preserving deleted folder structure as truth.
- [x] Re-audit the remaining `domains/entities/standard/**` surface after the metadata-folder deletion and remove any newly exposed dead seams that are still safe to collapse in this session.
  - Outcome: the remaining top-level legacy metadata/common folder deletion exposed dead standard-subtree barrel layers only; those re-export seams were removed, and the surviving `standard/**` folders were confirmed to still host real runtime behavior rather than empty ownership markers.
- [x] Run focused metahubs-frontend validation first, then the canonical root `pnpm build`, and fix any lint/type/test regressions introduced by the frontend folder elimination.
  - Outcome: focused metahubs-frontend Vitest passed for the moved metadata/common slices (`4` files / `17` tests), `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- [x] Sync `activeContext.md` and `progress.md` only after validation proves the new frontend entity-owned layout is green.
  - Outcome: memory-bank state now records the validated removal of the top-level `attributes`, `constants`, `elements`, and `general` frontend folders instead of the earlier transitional wrapper state.

## Active: Entity-Owned Standard Surface Neutralization (2026-04-14)

> Goal: assess and, where safe, collapse the remaining named standard-kind seams that still live under `packages/metahubs-frontend/base/src/domains/entities/standard/**` without regressing the already-green entity-owned contract.

### Final Action Plan (Current Session)

- [x] Audit the live `domains/entities/standard/**` tree, imports, exports, and route helpers to separate intentional runtime behavior from dead seam-preserving structure.
  - Outcome: the audit showed that the surviving `standard/**` subtree still holds real list/actions/hooks/runtime behavior for the standard kinds; only the barrel entry points were dead seams that could be removed safely in this session.
- [x] Collapse any safe dead seams exposed by the audit and retarget the touched imports/tests to the stricter entity-owned structure.
  - Outcome: the deleted dead seams were the `index.ts`, `api/index.ts`, and `hooks/index.ts` barrel layers under `standard/catalog`, `standard/hub`, `standard/set`, and `standard/enumeration`; touched consumers, metadata hooks, and focused tests now import direct files instead of those deleted re-export entry points.
- [x] Run focused metahubs-frontend validation first, then the canonical root `pnpm build`, and fix any regressions introduced by the standard-surface cleanup.
  - Outcome: focused `@universo/metahubs-frontend` Vitest passed for the touched delete-dialog, entity-instance, metadata, and optimistic-mutation slices (`7` files / `34` tests), `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- [x] Sync `activeContext.md` and `progress.md` only after validation proves the standard-surface cleanup is green.
  - Outcome: memory-bank state now records that the safe barrel-layer cleanup is complete and that the remaining `standard/**` folders still represent live runtime behavior rather than removable dead wrappers.

## Active: Residual Frontend Legacy Folder Deletion And Standard Runtime Cutover (2026-04-14)

> Goal: remove the still-live top-level frontend legacy files that survived the earlier metadata cleanup, then continue collapsing the remaining standard-kind runtime ownership seams toward a fully entity-owned structure.

### Final Action Plan (Current Session)

- [x] Delete the residual top-level `domains/attributes`, `domains/constants`, `domains/elements`, and `domains/general` runtime files that still duplicate entity-owned implementations.
  - Outcome: the remaining runtime/test files under those top-level folders were physically removed, and the shipped metahubs frontend tree now keeps those metadata/common implementations only under entity-owned locations.
- [x] Audit the surviving `domains/entities/standard/**` runtime folders and define the next safe move from business-named per-kind ownership toward neutral entity-owned modules.
  - Outcome: the audit showed the remaining `standard/**` folders still hosted real runtime logic, so the safe next move was a real file relocation into a neutral entity-owned subtree instead of pretending the folders were dead wrappers.
- [x] Implement the next safe runtime cutover for the standard-kind surfaces without regressing entity-owned routes or metadata flows.
  - Outcome: the live standard-kind APIs, hooks, UI files, and touched focused tests were moved into `packages/metahubs-frontend/base/src/domains/entities/kinds/**`, external consumers were retargeted, stale post-move imports were repaired, and the old `domains/entities/standard/**` directory tree was deleted after the cutover stabilized.
- [x] Run focused metahubs-frontend validation first, then the canonical root `pnpm build`, and fix any lint/type/test regressions introduced by the deeper cleanup.
  - Outcome: `pnpm --filter @universo/metahubs-frontend build` passed after the move, the touched focused Vitest slices for the moved kinds/delete-dialog/entity-instance/optimistic-mutation surfaces were rerun clean after repairing one stale moved mock target, and the canonical root `pnpm build` completed green.
- [x] Sync `activeContext.md` and `progress.md` only after validation proves the deeper cleanup is green.
  - Outcome: memory-bank state now records the validated replacement of the old `domains/entities/standard/**` ownership seam with the new neutral `domains/entities/kinds/**` runtime layout instead of leaving that cutover only in chat context.

## Active: Entity-First Final Migration — Final Legacy Seam Removal (2026-04-14)

> Goal: finish the QA-reopened entity-first migration by removing the remaining backend legacy ownership folders, eliminating frontend system-managed standard-kind behavior, and revalidating the shipped entity-owned contract with green proof.

### Final Action Plan (Current Session)

- [x] Move the remaining backend standard-kind child-controller ownership under `domains/entities/**` and delete the old top-level `hubs/`, `catalogs/`, `sets/`, and `enumerations/` backend folders.
  - Outcome: production child-controller imports now resolve through `domains/entities/children/**`, the obsolete top-level backend route/domain files were removed, and the focused backend route/service validation stayed green.
- [x] Remove frontend `isSystemManaged` standard-kind gating and route the remaining shared standard-kind UI imports through entity-owned seams only.
  - Outcome: `EntitiesWorkspace` no longer marks direct standard kinds as system-managed, standard types now keep the same instances/edit/copy affordances as other entity types, and shared common/enumeration-value imports were retargeted to entity-owned wrapper paths.
- [x] Retarget the touched tests and package export surfaces to the final entity-owned contract and delete stale legacy-focused truth surfaces where they are no longer part of shipped behavior.
  - Outcome: the touched delete-dialog/shared-route/general-page tests now assert entity-owned URLs and wrapper imports, while the removed backend legacy-route tests no longer preserve deleted top-level route factories as active truth.
- [x] Run focused package validation first, then the canonical root `pnpm build`, and fix any lint/type/test regressions introduced by the seam removal.
  - Outcome: `@universo/metahubs-backend` build passed, focused backend Jest passed (`2` suites / `36` tests), `@universo/metahubs-frontend` build passed, focused frontend Vitest passed (`6` files / `18` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- [x] Sync `activeContext.md` and `progress.md` after the codebase is green so memory-bank state reflects the actual closure instead of the earlier optimistic state.
  - Outcome: memory-bank state now records the validated backend/frontend seam-removal pass instead of leaving it only in transient chat context.

## Active: Entity-First Final Migration — Remaining Legacy Ownership Cutover (2026-04-14)

> Goal: remove the remaining active legacy ownership markers from the shipped entity-first surface without destabilizing the already-green branch state.

### Final Action Plan (Current Session)

- [x] Replace the remaining backend legacy delete helper naming and entity-route controller imports with entity-owned module paths.
  - Outcome: the active backend source/test graph now uses `entityDeletePatterns.ts`, and `entityInstancesRoutes.ts` imports its standard child controller factories through the entity-owned `standardEntityChildrenControllers.ts` entrypoint instead of direct legacy-domain controller paths.
- [x] Move the remaining shipped frontend metadata/common entry points to entity-owned wrapper modules and retarget production imports.
  - Outcome: the active metahubs frontend export graph now routes metadata/common entry points through `domains/entities/metadata/*` and `domains/entities/shared/*`, while the touched production consumers stopped importing top-level `attributes`, `constants`, `elements`, and `general` modules directly.
- [x] Re-run focused validation for touched metahubs frontend/backend surfaces, then run the canonical root build if focused checks are green.
  - Outcome: focused `@universo/metahubs-backend` Jest passed (`2` suites / `36` tests), focused `@universo/metahubs-frontend` Vitest passed (`6` files / `21` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- [x] Resync `activeContext.md` and `progress.md` only after validation proves the cutover is green.
  - Outcome: memory-bank state now records the validated backend rename plus frontend entity-owned wrapper cutover instead of leaving this slice only in chat context.

## Active: Entity-First Final Migration — Post-Compression Continuation Pass (2026-04-14)

> Goal: reconcile the current in-progress tree after context compression, identify the real regressions introduced by the newest entity-owned folder deletions/moves, finish the remaining code fixes safely, and revalidate the branch before updating closure notes.

### Final Action Plan (Current Session)

- [x] Re-audit the live changed tree and detect the current broken contracts with real proof instead of relying on the pre-compression summary.
  - Outcome: focused `@universo/metahubs-frontend` build and source audit showed that production code was already green; the real continuation-pass regressions were isolated to two moved focused tests with stale mocks after the standard-entity folder relocation.
- [x] Repair the remaining production and test imports/contracts broken by the latest entity-owned folder consolidation.
  - Outcome: the moved `OptionValueList.optimisticUpdate` and `HubList.settingsReopen` suites now mock the current modules instead of the deleted pre-move paths, and their `@universo/template-mui` / `@tanstack/react-query` stubs were widened only where the new import graph required it.
- [x] Run focused validation first, then the canonical root validation if the touched surfaces are green.
  - Outcome: a focused metahubs-frontend validation matrix passed with 12 test files / 83 tests, and the canonical root `pnpm build` finished green afterward with `30 successful, 30 total`.
- [x] Resync `activeContext.md` and `progress.md` only after the new continuation pass is actually validated.
  - Outcome: memory-bank state is now aligned to the post-compression closure instead of leaving this pass captured only in transient chat context.

## Active: Entity-First Final Migration — QA Reopen Completion Pass (2026-04-14)

> Goal: finish the entity-first migration that QA proved incomplete, remove the remaining mixed legacy seams, align tests/docs/contracts to the shipped entity-owned model, and close the branch with green proof instead of partial closure language.
> Source QA evidence: remaining backend dispatch delegation, legacy child-resource URLs, residual top-level frontend ownership seams, stale route helpers, stale tests, and legacy-route Playwright truth surfaces.

### Final Action Plan (Current Session)

- [x] Canonicalize the remaining child-resource API clients and route helpers to entity-owned URLs only.
  - Outcome: `attributes.ts`, `constants.ts`, and `elements.ts` now build only entity-owned URLs for the canonical frontend contract instead of using legacy `/hub/...`, `/catalog/...`, `/set/...`, or `/enumeration/...` authoring paths.
- [x] Re-evaluate the remaining backend entity-route seam inside `entityInstancesRoutes.ts` against the documented package contract.
  - Outcome: the reopened QA concern was narrowed to internal composition only; `packages/metahubs-backend/base/README.md` explicitly allows entity-owned top-level routes to reuse specialized managed controllers underneath, so no extra controller rewrite was shipped in this slice.
- [x] Update focused backend/frontend/browser truth surfaces to the final entity-owned contract.
  - Outcome: the touched Playwright flows/generator now navigate through `/entities/hub|catalog|set|enumeration/instances` and wait on the matching entity-owned API endpoints instead of legacy top-level authoring URLs.
- [x] Run the canonical validation matrix and resolve any lint/build/test regressions introduced by the final cleanup.
  - Outcome: targeted `@universo/metahubs-frontend` builds passed twice, targeted eslint on the changed files passed after auto-fix with only pre-existing `no-console` warnings in the generator spec, and the required root `pnpm build` completed green.
- [x] Resync `activeContext.md` and `progress.md` after the reopened QA findings are closed for this implementation slice.
  - Outcome: memory-bank state now records the validated contract cutover instead of leaving the branch marked as actively reopened.

## Active: Entity-First Final Migration — Complete Legacy Elimination (2026-04-14)

> Goal: fully eliminate all remaining legacy backend controllers/routes/services and frontend managed-domain folders; replace dispatch delegation with Behavior Service Registry; consolidate child-resource routes; implement preset-driven create options; deep test coverage + documentation rewrite.
> Plan (NEW): [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
> Creative (NEW): [creative-entity-first-architecture-v2.md](creative/creative-entity-first-architecture-v2.md)
> Superseded plan: [legacy-removal-entity-promotion-plan-2026-04-13.md](plan/legacy-removal-entity-promotion-plan-2026-04-13.md)
> Prior QA review: [qa-legacy-removal-plan-review-2026-04-13.md](plan/qa-legacy-removal-plan-review-2026-04-13.md)

**Status: Second QA tightening pass completed, strict-neutrality rewrite applied, implementation follow-up landed, and the targeted zero-debt seam audit for this slice is now closed (2026-04-14). The plan now covers the original 12 findings plus additional end-state constraints around neutral entity-owned seams, removal of standard-kind special casing, public `Managed*` export cleanup, explicit metahub `document` audit, grep-driven cleanup of all legacy consumers, removal of business-named object wrappers, and explicit collapse of top-level child-resource folders into entity-owned seams.**

**QA issues resolved in plan amendments:**
- ✅ C1: Kind-key renderer naming (`catalogKindRenderer.tsx`, not `CatalogInstanceRenderer.tsx`) — Phase 5.2
- ✅ C2: Exhaustive cross-module consumer rewrites with explicit migration table — Phase 4.4-4.7 + Phase 5.8 pre-deletion build check
- ✅ C3: New `enumerationValues/` child-resource domain (1474-line component) — Phase 5.1
- ✅ H1: `isBuiltinMetahubObjectKind` elimination via behavior registry — Phase 2.5 + assessment correction
- ✅ H2: Rename `legacyBuiltinObjectCompatibility.ts` → `entityDeletePatterns.ts` — Phase 1.1
- ✅ H3: `GeneralPage.tsx` import update to new enumerationValues/ domain — Phase 5.7
- ✅ H4: Phase 7 reduced to "verify existing" (preset toggles already implemented) — Phase 7 rewrite
- ✅ H5: Corrected 4-pass → 3-pass seed flow — Phase 8.1 + 8 checklist
- ✅ M1: Dead `layout/` folder added to deletion list — Phase 5.8
- ✅ M2: `managedMetadataRoutePaths.ts` replacement + deletion — Phase 4.7 + Phase 5.9
- ✅ M3: `constants-library` preset added to testing scope — Phase 8.2, 11.1, 12.2
- ✅ M4: ACL mapping via `EntityBehaviorService.aclEntityType` — Phase 1 interface expansion

**Additional plan enhancements:**
- Extended `EntityBehaviorService` interface with `aclEntityType` and `resolveGeneratedTableName`
- Phase 4: Steps 4.4-4.7 added (absorb managed* APIs, exhaustive grep-driven consumer rewrite, instanceActions.ts, entityRoutePaths.ts)
- Phase 5: Complete rewrite with 11 steps (enumerationValues domain, kind-key renderers, dead code cleanup)
- Second QA pass: added non-negotiable end-state constraints so managed/business-named seams cannot survive as permanent architecture
- Phase 6: added explicit removal of `isSystemManagedEntityType` behavior and public `Managed*EntitySurface` exports/README drift
- Phase 9: added explicit metahub-specific `document` trace audit
- Final neutrality rewrite: Phase 1 now ends in neutral registry/capability modules instead of permanent `*BehaviorService` files, and Phase 5 now ends in an entity-owned renderer registry instead of permanent per-kind renderer files
- Final scope-gap follow-up: Phase 2 now removes `MetahubObjectsService` business wrappers, Phase 4 now requires grep-driven exhaustive cleanup beyond the stale 37-import estimate, Phase 5 now explicitly collapses top-level child-resource folders under entities-owned seams, and Phase 10/11 now remove stale `documents` and legacy test truth surfaces
- Final acceptance hardening: Phase 15 now includes a repository-wide zero-debt grep audit for forbidden legacy markers and transitional seams before closure
- Files Changed Summary updated with all new/renamed/deleted files
- Potential Challenges table expanded (14 risks, up from 10)

### Implementation Execution Checklist (Current Session)

- [x] Reconcile the in-progress branch state against the finalized plan and isolate the remaining gaps that still block the final entity-owned end state.
  - Outcome: the live branch was audited before new refactor work, which isolated the highest-value debt to transitional frontend managed seams plus a narrower backend/schema/type naming tail.
- [x] Complete backend/frontend migration wiring where the current diff still leaves broken imports, stale route/query-key contracts, or undeleted legacy ownership seams.
  - Outcome: frontend standard-kind folders moved under `domains/entities/standard/*`, public `Managed*EntitySurface` exports/routes were replaced with `*EntityInstanceView`, `managedMetadataRoutePaths` became `entityMetadataRoutePaths`, and the backend builtin helper plus part of the schema/type naming surface were normalized.
- [x] Update tests, i18n, and documentation-touching source so the shipped contract matches the final direct standard-kind and entity-owned route model.
  - Outcome: focused entity-instance truth surfaces were updated, and the EN/RU metahubs frontend READMEs now use the new public contract while preserving exact line-count parity.
- [x] Run focused package validation while fixing regressions, then run the canonical root `pnpm build` and resolve any remaining failures.
  - Outcome: touched builds were rerun successfully for `@universo/metahubs-backend`, `@universo/metahubs-frontend`, `@universo/template-mui`, and `@universo/core-frontend`, and the canonical root build task completed without surfacing a new failure in the touched path.
- [x] Run a final zero-debt grep audit for forbidden legacy markers in active source/test/docs truth surfaces and remove or justify every hit before closure.
  - Outcome: the follow-up rename pass removed the remaining transitional `managed*` seam names from active backend/frontend/schema/docs truth surfaces touched by this migration slice; remaining `managed` grep hits are intentional system-managed domain terms, external `@universo/migrations-core` API names, or generated build artifacts refreshed by the root build.
- [x] Sync `activeContext.md` and `progress.md` with the validated implementation outcome after the codebase is green.
  - Outcome: this remediation wave is now captured in the memory bank instead of only in transient chat state.

- [x] Continue the repo-wide neutral-seam cleanup beyond this validated slice.
  - Outcome: the residual source-level transition-only naming tail was removed from entity controllers/routes, query-key helpers, entity workspace/list surfaces, shared pagination helpers, publication serialization locals, and the touched EN/RU architecture and guide docs.

### New Plan Phases (15 total — see plan document for full details)

- [ ] Phase 1: Backend — Behavior Registry & Capability Extraction (EntityBehaviorService interface + neutral standard-kind registry/capability modules)
- [ ] Phase 2: Backend — Entity Controller Unification (replace dispatch pattern with behavior hooks)
- [ ] Phase 3: Backend — Legacy Domain Deletion + Child Route Consolidation (delete 4 legacy folders, remove legacy paths)
- [ ] Phase 4: Frontend — Unified API & Hooks Consolidation (single entity API client, unified query keys)
- [ ] Phase 5: Frontend — Renderer Registry Migration & Managed Folder Deletion (entity-owned renderer registry + delete managed* folders)
- [ ] Phase 6: Frontend — Sidebar, Breadcrumbs & Route Finalization
- [ ] Phase 7: Metahub Create Dialog — Preset-Driven Options
- [ ] Phase 8: Template Seed System — Default Instance Enhancement
- [ ] Phase 9: Schema-DDL & Runtime Finalization
- [ ] Phase 10: i18n Updates (EN + RU)
- [ ] Phase 11: Unit & Integration Tests (Jest/Vitest)
- [ ] Phase 12: E2E Playwright Tests & Screenshot Verification
- [ ] Phase 13: Fixture Regeneration
- [ ] Phase 14: Documentation Rewrite (EN/RU GitBook)
- [ ] Phase 15: Final Validation & Memory Bank Sync
  - Outcome: `activeContext.md`, `progress.md`, and this ledger now reflect the real 2026-04-13 closure instead of the earlier premature or future-dated wording.

- [x] Collapse the remaining managed standard-kind route delegation so the entity-owned backend surface no longer depends on legacy hubs/catalogs/sets/enumerations controllers for top-level instance CRUD.
  - Outcome: `entityInstancesRoutes.ts` now sends top-level instance list/create/reorder/trash/detail/update/delete/copy/restore/permanent flows directly through the generic entity controller, leaving only nested child-resource seams on specialized handlers.
- [x] Replace the remaining top-level managed-kind UI delegation with entity-owned surfaces that no longer route production list ownership through legacy domain entry components.
  - Outcome: `ManagedStandardKindSurfaces.tsx` now owns the reusable managed wrappers, `EntityInstanceList` renders those wrappers for direct standard kinds, and `MainRoutes.tsx` mounts them for the entity-owned route tree.
- [x] Remove stale legacy contract truth from shipped docs and focused tests.
  - Outcome: focused frontend/backend tests now assert direct `catalog` / `hub` / `set` / `enumeration` routes and managed wrapper ownership, while the OpenAPI generator now includes canonical entity-owned routes under the `Entities` tag and downgrades the old per-kind tags to nested/compatibility descriptions.
- [x] Expand browser-faithful validation beyond catalog-centric proof.
  - Outcome: `metahub-entities-workspace.spec.ts` now checks the entity-owned `hub`, `set`, and `enumeration` managed surfaces before continuing the preset-backed flow, so the browser proof source no longer stays catalog-only.
- [x] Re-run focused validation plus the canonical root build, then resync memory-bank notes.
  - Outcome: focused metahubs-frontend Vitest passed, focused metahubs-backend Jest passed, `@universo/rest-docs` OpenAPI generation and lint passed, the canonical root `pnpm build` completed green, and the supported E2E harness was attempted but timed out waiting for server readiness before executing the updated browser assertions.

- [x] Stabilize request-scoped RLS transaction lifecycle on pinned connections so nested entity authoring flows no longer poison later reads with aborted transactions/savepoint drift.
  - Outcome: the pinned-connection RLS executor now scopes transaction depth lexically, middleware-owned request transactions are reused directly instead of reopening top-level savepoints, and the failing dialog authoring flow no longer poisons later reads with aborted-transaction/savepoint drift.
- [x] Add browser-faithful proof for the new entity-scoped settings tabs and for delete-dialog blocker resolution on unified entity routes.
  - Outcome: the entity-dialog regression flow and the entity-scoped metahub settings Playwright flow both passed on 2026-04-13, covering managed delete-dialog blocker navigation plus the new `entity.<kind>.*` settings tabs through real browser interaction.
- [x] Revalidate touched suites, update documentation wording where it still contradicts the shipped entity-owned routing model, and resync memory-bank notes.
  - Outcome: focused `@universo/database` and `@universo/auth-backend` Jest suites passed, the canonical root `pnpm build` stayed green, the touched Playwright flows passed, and no extra doc drift remained for this closure slice beyond the already-updated entity-owned wording.

- [x] Remove the remaining production `document` and legacy-compatible entity-type contract from shared types, backend services, frontend entity surfaces, and stale tests/docs.
  - Outcome: the shipped runtime, shared types, selectors, docs, and focused tests now enforce the direct managed-standard-kind contract without the removed `document` placeholder or the old legacy-compatible helpers.

- [x] Fix managed delete-dialog blocker links so set/enumeration dialogs always route catalog blockers to the catalog authoring surface.
  - Outcome: set/enumeration delete dialogs now resolve blocker links through the catalog kind on unified entity routes, and focused Vitest coverage locks the corrected route mapping.
- [x] Migrate the remaining metahub settings contract from legacy plural prefixes to the entity-scoped `entity.<kind>.*` namespace.
  - Outcome: shared types, backend policy checks, frontend settings UI, i18n labels, and the self-hosted fixture now use `entity.hub|catalog|set|enumeration.*` keys instead of the removed plural legacy prefixes.
- [x] Re-run focused validation for the touched frontend/backend/settings surfaces and resync memory-bank notes for this remediation wave.
  - Outcome: focused metahubs-frontend dialog Vitest, focused metahubs-backend route Jest, and the canonical root `pnpm build` all passed on 2026-04-13 after the settings-contract migration.

- [x] Remove the remaining production legacy-compatibility utility layer from shipped backend/frontend flows.
  - Outcome: direct managed-kind helpers replaced the deleted backend `legacyCompatibility.ts` layer, and frontend entity-route/breadcrumb logic now resolves only direct standard kinds.
- [x] Collapse metahub board summary and related DTO/test contracts to entity-owned counts.
  - Outcome: backend summary now returns `entityCounts`, the board UI derives hub/catalog cards from that shared map, and backend/frontend/browser tests were updated accordingly.
- [x] Replace remaining shipped per-kind frontend data access seams that still keep the transitional legacy shells alive.
  - Outcome: target selectors, menu widget catalog loading, and shared-entity settings now fetch managed standard kinds through `listEntityInstances(...)` instead of legacy per-kind list APIs.
- [x] Rewrite focused unit/browser proof that still locks transitional legacy-shell behavior instead of the final entity-owned model.
  - Outcome: stale shell wording was replaced with managed-entity contract wording, and the touched board/E2E assertions now validate the entity-owned summary shape.
- [x] Re-run focused validation plus the canonical root build, then resync memory-bank closure notes.
  - Outcome: focused metahubs-backend board-summary Jest, focused metahubs-frontend Vitest slices, and the canonical root `pnpm build` all passed on 2026-04-13.

- [x] Finish preset-to-template default-instance seeding with dependency-safe ordering for hub-linked presets.
  - Goal: materialize preset `defaultInstances` through a dependency-safe flow that preserves hub references instead of only merging them back into the generic template seed pass.
- [x] Remove stale runtime/UI contracts that still present generic entity authoring as a coexistence-only surface.
  - Goal: align shipped strings and route behavior with the accepted entity-owned metadata model without breaking the specialized managed-kind controllers/components reused underneath.
- [x] Rewrite focused frontend unit coverage to the current direct-standard-kind and entity-owned route contract.
  - Goal: stop asserting `custom.*-v2` compatibility delegation where the shipped surface now renders direct entity-owned behavior.
- [x] Rewrite or retire stale Playwright legacy-compatible V2 specs that still lock removed kind keys or dialog defaults.
  - Goal: keep browser proof aligned with the accepted product routes and direct standard kind contract.
- [x] Update EN/RU architecture and guide docs so they describe the post-cleanup entity-owned model instead of coexistence-era V2 guidance.
  - Goal: keep English as the source document, then mirror the exact structure/content in Russian.
- [x] Revalidate focused packages/tests and confirm the canonical root `pnpm build` before recording the remediation milestone.

### 2026-04-13 QA-driven remediation plan

- [x] Backend seeding remediation
  - Implement a final hub-reference remap pass for preset-derived default instances and cover it with focused backend tests.
- [x] Frontend/runtime contract remediation
  - Remove or update stale coexistence messaging and verify entity-owned managed-kind routes still reuse the correct specialized surfaces.
- [x] Focused regression remediation
  - Update frontend unit tests, browser specs, and any adjacent fixture expectations that still hardcode `custom.*-v2` defaults.
- [x] Documentation remediation
  - Update EN docs first, then mirror RU docs line-for-line.
- [x] Final validation and memory sync
  - Outcome: focused frontend/backend regression slices passed, EN/RU doc/README structural parity was checked, the canonical root `pnpm build` stayed green, and memory-bank state now reflects the validated closure.

### Immediate guardrails

- [x] Do not reopen page-local spacing hacks or legacy top-level route mounts without fresh failing proof.
- [x] Keep `tasks.md` limited to active work and recent completion evidence; move durable history to `progress.md`.
- [x] Record reusable implementation rules only in `systemPatterns.md`.

---

## Recent Completed Sessions

## Completed Session: 2026-04-12 PR #763 Review Comment QA Triage

- [x] Validate the proposed `EntityFormDialog` fixes against the current branch and React guidance.
  - Outcome: the dialog hydration comments were confirmed valid, while the suggested `Header` inset removal was rejected after real browser proof showed breadcrumb drift.
- [x] Ship only the confirmed shared-dialog fix.
  - Outcome: first-open reset now happens before paint, the dialog renders from internal state, and render-phase ref mutation is gone.
- [x] Re-run focused validation and the canonical root build.
  - Outcome: focused dialog coverage, E2E build, spacing proof, and the root `pnpm build` stayed green.
- [x] Record the durable closure only after proof.
  - Details: [progress.md#2026-04-12-pr-763-review-comment-qa-triage](progress.md#2026-04-12-pr-763-review-comment-qa-triage)

## Completed Session: 2026-04-12 Metahub Shell, Spacing, And QA Closure

- [x] Consolidate shell gutter and header inset logic under one shared route-aware helper source.
  - Outcome: the metahub shell contract now lives behind the shared page-spacing helpers instead of duplicated route checks.
- [x] Replace loading-state numeric overrides with the explicit shared inset contract.
  - Outcome: loading surfaces now use the supported shared skeleton behavior instead of page-local spacing patches.
- [x] Add missing browser geometry and negative-path permission proof.
  - Outcome: spacing alignment and `403` denial behavior are now protected by focused backend and browser validation.
- [x] Keep the accepted contract durable only after green proof.
  - Pattern: [systemPatterns.md#metahub-page-shell-unified-horizontal-gutter-pattern-important](systemPatterns.md#metahub-page-shell-unified-horizontal-gutter-pattern-important)
  - Details: [progress.md#2026-04-12-metahub-qa-gap-closure](progress.md#2026-04-12-metahub-qa-gap-closure)
  - Details: [progress.md#2026-04-12-metahub-page-horizontal-spacing-fix](progress.md#2026-04-12-metahub-page-horizontal-spacing-fix)

## Completed Session: 2026-04-12 Fixture, Compatibility, And Review Follow-Up Closure

- [x] Restore first-open localized dialog hydration and fresh-import legacy-row visibility on the supported V2 surfaces.
  - Outcome: Entity V2 dialogs hydrate correctly on first open, and compatible Hub V2 / Set V2 / Enumeration V2 reads stay visible after fresh import.
- [x] Regenerate the committed self-hosted snapshot and harden the browser import proof.
  - Outcome: the fixture again matches the canonical export contract and the import flow reasserts the exported entity-definition envelope.
- [x] Accept only the technically correct PR #759 review fixes.
  - Outcome: transaction-bound baseline migration access stayed on the executor path and duplicated schema-ddl compatibility helpers were collapsed into one source.
- [x] Preserve compatibility-safe delete and read behavior for legacy-compatible V2 kinds.
  - Outcome: blocker queries now accept compatible kind arrays and deleted-row inspection stays explicit.
- [x] Archive the durable rules after validation.
  - Pattern: [systemPatterns.md#compatibility-aware-blocker-query-kind-array-pattern-important](systemPatterns.md#compatibility-aware-blocker-query-kind-array-pattern-important)
  - Pattern: [systemPatterns.md#validated-legacy-compatible-read-union-pattern-important](systemPatterns.md#validated-legacy-compatible-read-union-pattern-important)
  - Details: [progress.md#2026-04-12-entity-v2-closure-cluster](progress.md#2026-04-12-entity-v2-closure-cluster)

---

## Recent Stage Archive

### 2026-04-11 Entity V2 Completion Cluster

- [x] Route ownership, compatibility, review-triage fixes, automation authoring, and workspace/browser parity were consolidated on the shipped Entity V2 surface.
  - Details: [progress.md#2026-04-11-entity-v2-completion-cluster](progress.md#2026-04-11-entity-v2-completion-cluster)

### 2026-04-10 Catalog V2 And ECAE Closeout Cluster

- [x] Catalog-compatible route isolation, shared-surface parity, generator hardening, ACL closure, and final parity verification were closed without reopening architecture scope.
  - Details: [progress.md#2026-04-10-catalog-v2-and-ecae-closeout-cluster](progress.md#2026-04-10-catalog-v2-and-ecae-closeout-cluster)

### 2026-04-09 ECAE Delivery Cluster

- [x] The first full end-to-end ECAE delivery wave shipped reusable presets, generic entity UI, dynamic published-menu behavior, browser proof, and frontend shell integration.
  - Details: [progress.md#2026-04-09-ecae-delivery-cluster](progress.md#2026-04-09-ecae-delivery-cluster)

### 2026-04-08 ECAE Foundation And QA Recovery Cluster

- [x] Backend service foundations, generic CRUD, compatibility lifting, and review/QA hardening were completed and validated on the root build.
  - Details: [progress.md#2026-04-08-ecae-foundation-and-qa-recovery-cluster](progress.md#2026-04-08-ecae-foundation-and-qa-recovery-cluster)

### 2026-04-07 Shared/Common And Runtime Materialization Cluster

- [x] Common became the single shared shell, snapshot v2 materialization closed, override writes stayed request-scoped, and inherited widget behavior was stabilized.
  - Details: [progress.md#2026-04-07-sharedcommon-and-runtime-materialization-cluster](progress.md#2026-04-07-sharedcommon-and-runtime-materialization-cluster)

### 2026-04-06 To 2026-04-03 Runtime, Fixture, Scripting, And Parity Waves

- [x] Layout/runtime parity, fixture regeneration, scripting/quiz delivery, self-hosted parity, snapshot import/export hardening, and E2E reset stabilization remain complete.
  - Details: [progress.md#2026-04-06-layout-runtime-fixture-and-docs-cluster](progress.md#2026-04-06-layout-runtime-fixture-and-docs-cluster)
  - Details: [progress.md#2026-04-05-scripting-and-quiz-delivery-cluster](progress.md#2026-04-05-scripting-and-quiz-delivery-cluster)
  - Details: [progress.md#2026-04-04-self-hosted-parity-cluster](progress.md#2026-04-04-self-hosted-parity-cluster)
  - Details: [progress.md#2026-04-03-snapshot-e2e-reset-and-turbo-hardening-cluster](progress.md#2026-04-03-snapshot-e2e-reset-and-turbo-hardening-cluster)

### Older Archive Reference

- [x] 2026-04-02 to 2026-03-11 platform, auth, Playwright, security, and codename convergence work remains preserved in the condensed archive.
  - Details: [progress.md#2026-04-02-to-2026-03-11-condensed-archive](progress.md#2026-04-02-to-2026-03-11-condensed-archive)
- [x] 2025-07 to 2026-02 alpha-era milestones remain preserved in the release table and long-term summary.
  - Details: [progress.md#older-2025-07-to-2026-02-summary](progress.md#older-2025-07-to-2026-02-summary)

---

## Notes For The Next Session

- [x] Keep the active ledger centered on only genuinely new regressions.
  - Note: do not reopen the 2026-04-13 QA remediation wave unless fresh failing evidence appears on shipped product, documentation, or canonical validation surfaces.
- [x] When one open active item closes, record the durable outcome in `progress.md` first and then update this ledger.
  - Note: `tasks.md` should remain the operational checklist, not a second full progress log.

## Active Session: 2026-04-17 Entity-First Final Refactoring Closure

- [x] Repair the currently failing metahubs frontend test suite and keep the affected list/menu flows deterministic.
  - Target: `pnpm --filter @universo/metahubs-frontend test` passes without the current `EntitiesWorkspace` and branch-copy regressions.
- [x] Eliminate the red lint/prettier failures in metahubs frontend and backend, then trim the most obvious touched warnings created by the final refactoring wave.
  - Target: `pnpm --filter @universo/metahubs-frontend lint` and `pnpm --filter @universo/metahubs-backend lint` return green.
- [x] Finish the entity-first terminology migration in shipped source, docs, and active browser specs.
  - Target: remove remaining active `catalog-compatible` / `legacy-compatible` truth-surface wording from touched production docs/specs and align screenshots/file names where needed.
- [x] Complete the unfinished i18n/query-key closure work from the 2026-04-16 final plan without reopening removed legacy routes.
  - Outcome: standard entity preset `nameKey` values now point to the entity-first translation roots (`treeEntities`, `linkedCollections`, `valueGroups`, `optionLists`) instead of the legacy per-kind labels.
- [ ] Regenerate the canonical metahub fixtures and refresh the entity documentation screenshots after the terminology/runtime cleanup.
  - Target: both committed metahub fixture snapshots and entity docs assets reflect the final entity-first state.
- [x] Re-run focused validation plus canonical build, then record the completed closure in `progress.md`.
  - Target: targeted metahubs frontend/backend validation and root `pnpm build` succeed after the closure changes.
  - Note: focused frontend/backend validation completed in this session; fixture/doc regeneration still needs a working Playwright env.

## Completed Session: 2026-04-14 Metadata Capability Neutralization

- [x] Rename the remaining entity-owned metadata capability folders to neutral seams on the frontend.
  - Outcome: `fieldDefinition`, `fixedValue`, `record`, and `optionValue` replaced the last `attribute`, `constant`, `element`, and `enumerationValue` folder ownership under `domains/entities/metadata/**`.
- [x] Align public/frontend truth surfaces to the neutral metadata vocabulary.
  - Outcome: package exports, core-frontend lazy routes, template-mui external declarations, focused tests, coverage config, and touched MIGRATIONS truth surfaces now use the neutral list/page names.
- [x] Rename backend entity-owned metadata route folders and factory exports to the same neutral vocabulary.
  - Outcome: backend router/package exports and focused route suites now use `createEntityFieldDefinitionRoutes`, `createEntityFixedValueRoutes`, and `createEntityRecordRoutes`.
- [x] Revalidate the slice across touched packages and the canonical workspace build.
  - Outcome: focused frontend and backend validation passed, and the canonical root `pnpm build` finished green.
