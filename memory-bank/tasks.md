# Tasks

> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## Current Task Ledger (Canonical)

## Active Session: 2026-04-06 Final QA Debt Closure For Runtime Sync Coverage And Docs
- [x] Harden the browser runtime worker contract so client script execution fails closed on hangs.
	- Note: `browserScriptRuntime` now enforces a bounded Worker execution timeout with cleanup, and focused `@universo/apps-template-mui` runtime Vitest passed (`7/7`) including the new hanging-worker regression.
- [x] Tighten `_app_scripts` scoped-index repair so legacy or malformed unique indexes are replaced only when the exact required scope definition is missing.
	- Note: Sync persistence now validates the full scoped unique-index shape, and focused `syncScriptPersistence.test.ts` passed (`8/8`) with both malformed-legacy and already-correct index branches covered.
- [x] Align scripting-related coverage gates with the shipped QA expectations.
	- Note: The touched apps-template, applications-frontend, auth-frontend, and scripting-engine Vitest configs now enable coverage by default with one shared opt-out/threshold contract, and focused package suites completed green under the updated configs.
- [x] Finish the remaining Russian GitBook localization polish in the touched scripting/tutorial pages.
	- Note: The touched EN/RU scripting and quiz tutorial pages now reflect the Worker-timeout fail-closed contract, the remaining mixed-language RU phrases were removed, and EN/RU line parity stayed exact (`97/97`, `89/89`).
- [x] Re-run focused validation, the canonical root build, and then sync memory-bank closure state.
	- Note: Focused apps-template, applications-backend, applications-frontend, auth-frontend, scripting-engine, and metahubs-frontend suites all passed under the final configs, the touched bilingual docs kept exact line parity (`97/97`, `89/89`), and the canonical root `pnpm build` finished green with `30 successful`, `14 cached`, and `2m54.285s`.

## Active Session: 2026-04-06 Final QA Remediation For Publication Versions And Docs Polish
- [x] Fix the publication versions page crash that blocks the browser-authoring quiz flow.
	- Note: `PublicationVersionList` now guards the settings-dialog render behind loaded `publicationData`, so the versions route no longer crashes while the publication-details query is still pending.
- [x] Add focused regression coverage for the publication versions/settings seam and the admin dialog settings frontend surface.
	- Note: Added `PublicationVersionList.test.tsx` for the async publication-details seam and `AdminSettings.test.tsx` for the shipped admin General-tab save flow; both targeted Vitest runs finished green, with the metahubs run executed under `VITEST_COVERAGE=false` to avoid an unrelated coverage-writer temp-file failure.
- [x] Clean the remaining mixed-language wording from the touched Russian GitBook pages.
	- Note: Rewrote the remaining mixed EN/RU prose in the touched Russian quiz/metahub/application pages while preserving the existing structure, links, and screenshot asset references.
- [x] Re-run focused validation, rerun the targeted Playwright quiz flows, and then sync memory-bank closure state.
	- Note: Targeted admin/metahubs Vitest passed, the browser-authoring/runtime/generator Playwright reruns each completed with exit code `0`, `pnpm run test:e2e:cleanup && pnpm run test:e2e:doctor -- --assert-empty` finished clean, and the canonical root `pnpm build` ended green with `30 successful`, `21 cached`, and `2m50.684s`.

## Active Session: 2026-04-06 QA Remediation For Dialog Settings And GitBook Coverage
- [x] Repair the red application-settings frontend regression coverage.
	- Note: The focused `ApplicationSettings` suite now asserts the shipped General/Limits contract through stable selectors and current limits-copy, and the targeted Vitest run finished green (`3/3`).
- [x] Repair the red application copy slug-regression tests.
	- Note: The copy-route tests now assert the actual persisted insert order where `settings` is stored before `slug`, and the targeted Jest route suite finished green (`51/51`).
- [x] Clean the remaining English fragments from the touched Russian GitBook pages.
	- Note: The touched RU scripting/metahubs/applications/quiz tutorial pages were rewritten to remove the mixed-language prose while keeping the EN/RU page pairs structurally aligned around the shipped feature contract.
- [x] Re-run focused validation for the remediated seams and then sync memory-bank closure state.
	- Note: Focused frontend/backend regression suites passed, and the canonical root `pnpm build` finished green with `30 successful`, `30 cached`, and `287ms`.

## Active Session: 2026-04-06 Admin And Application Dialog Settings Plus GitBook Coverage
- [x] Add admin-level dialog settings storage and UI.
	- Note: The admin settings surface now has a persisted General tab for dialog size preset, fullscreen availability, resize availability, and close behavior, backed by the admin settings backend contract.
- [x] Apply admin dialog settings across admin-facing dialog surfaces.
	- Note: Admin dialog presentation now flows through the shared provider seam on `/admin`, and the direct admin dialogs were migrated onto the shared presentation contract.
- [x] Add persisted application-level dialog settings and expose them in Application Settings.
	- Note: Application settings now persist dialog presentation under `applications.cat_applications.settings`, and the General tab saves real backend state instead of placeholder copy.
- [x] Apply application dialog settings to application control-panel dialogs.
	- Note: The application control-panel route now has its own dialog settings provider, and connector delete behavior follows the saved application-level presentation contract.
- [x] Expand GitBook docs for scripts, settings, and the new quiz-application tutorial.
	- Note: Rewrote the EN/RU scripting, metahubs, and applications pages; added new EN/RU admin and quiz-tutorial pages; updated both `SUMMARY.md` files; and kept the touched EN/RU page pairs in structural parity.
- [x] Generate Playwright screenshots for the quiz-application tutorial.
	- Note: Added the reproducible generator `tools/testing/e2e/specs/generators/docs-quiz-tutorial-screenshots.spec.ts`, which now writes `metahub-scripts.png`, `layout-quiz-widget.png`, `application-settings-general.png`, and `runtime-quiz.png` into `docs/assets/quiz-tutorial/`.
- [x] Validate the touched seams and sync memory-bank closure state.
	- Note: Docs diagnostics stayed clean, the focused package builds and `pnpm run build:e2e` passed during generator stabilization, the final tutorial screenshot generator passed with `2 passed`, and the canonical root `pnpm build` finished green with `30 successful`, `17 cached`, and `3m15.638s`.

## Active Session: 2026-04-06 Dialog Header Polish And Quiz Script Discoverability
- [x] Tighten the shared dialog header action spacing and localize the header icon tooltips.
	- Note: The shared dialog presentation seam now removes the extra title-wrapper right padding, keeps the header action group tighter to the right edge, and receives localized tooltip/aria labels through the metahub dialog settings bridge.
- [x] Rename the metahub common setting copy for dialog close behavior to the requested popup-type wording.
	- Note: The settings UI now shows `Popup window type` / `Тип всплывающих окон` with `Modal windows` / `Модальные окна` and `Non-modal windows` / `Немодальные окна`, while the stored values remain `strict-modal` and `backdrop-close`.
- [x] Verify and document where the quiz script is edited in the current UI contract.
	- Note: The committed quiz fixture stores `quiz-widget` as a metahub-level script (`attachedToKind = metahub`, `attachedToId = null`), and the metahub edit dialog now opens the Scripts tab in that same scope so imported quiz scripts appear in the UI again.
- [x] Revalidate the touched seams and sync memory-bank closure state.
	- Note: Focused `@universo/template-mui` Jest passed (`6/6`), focused `@universo/metahubs-frontend` Vitest passed (`6/6`), and the final root `pnpm build` verification finished green (`30 successful`, `30 cached`, `286ms`).

## Active Session: 2026-04-05 Dialog UX And Centered Quiz Layout Refresh
- [x] Update the shared dialog presentation seam for the requested modal UX corrections.
	- Note: The shared dialog presentation seam now keeps the requested fullscreen control alignment, strict-modal attention feedback, and reliable resize cursor/user-select cleanup.
- [x] Add regression coverage for the touched dialog behavior.
	- Note: Focused shared dialog coverage now locks fullscreen/reset controls, strict-modal outside-click attention feedback, and resize lifecycle cleanup.
- [x] Redesign the quiz metahub layout contract around a centered quiz-only runtime.
	- Note: The canonical quiz contract now removes the legacy left menu, center details table/title, and right-side widget placement so `quizWidget` renders as a standalone center-zone widget.
- [x] Update the quiz generator/browser-authoring/runtime source flows and regenerate the committed fixture through the real Playwright export path.
	- Note: `tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts` and `tools/testing/e2e/support/quizFixtureContract.ts` remain the source of truth, and the committed quiz fixture was regenerated from that real generator path.
- [x] Revalidate the touched seams and finish with the canonical root build, then sync memory-bank closure state.
	- Note: Focused dialog and apps-template tests passed, `pnpm run build:e2e` passed, the quiz generator passed (`2 passed`), the targeted quiz Playwright rerun passed (`4 passed`, including setup + the 3 targeted flows), and the final root `pnpm build` finished green (`30 successful`, `30 cached`, `599ms`).

## Active Session: 2026-04-05 Frontend Test Warning Remediation
- [x] Replace the brittle MUI Select opening pattern in scripting-related frontend tests so the suites stop emitting invalid `anchorEl` warnings.
	- Note: The fix stayed test-only. The affected jsdom suites now provide a stable non-zero element geometry mock instead of touching production dialog or select code.
- [x] Re-run the focused frontend validation for the touched scripting/dialog suites and confirm the warning is gone without regressing behavior.
	- Note: Focused `@universo/metahubs-frontend` scripting/layout dialog tests passed (`9/9`), the warning string `anchorEl` no longer appeared in the captured test log, and package lint no longer had error-level failures on the touched scope.
- [x] Sync memory-bank closure state for this remediation after validation passes.
	- Note: The final root `pnpm build` finished green (`30 successful`, `27 cached`, `56.386s`), so this residual QA debt is now fully closed.

## Active Session: 2026-04-05 Metahub Dialog Settings And Scripts Tab Responsiveness
- [x] Fix the noisy Turbo warning for `@universo/extension-sdk` build outputs without changing the package's source-first build contract.
	- Note: The package currently runs `tsc --noEmit`, so the root `turbo.json` output expectation must be overridden at the package level instead of forcing a fake `dist/` artifact.
- [x] Add shared metahub settings for global dialog behavior.
	- Note: Ship a global settings contract for dialog size preset (`small` / `medium` / `large`), fullscreen toggle availability, resize availability, and close behavior (`strict modal` vs `outside click closes`). The settings page should expose these through the existing registry-driven UI and use sensible defaults.
- [x] Apply the dialog settings to the shared metahub authoring form surface.
	- Note: The current `EntityFormDialog` behavior becomes the explicit `small` preset. Add the `medium` default and `large` preset, fullscreen expand/collapse, resize persistence in browser localStorage, and fail-closed backdrop handling when strict modal mode is enabled.
- [x] Rework the Scripts tab so narrow dialogs and mobile layouts never gain a page-level horizontal scrollbar.
	- Note: Keep horizontal scrolling isolated to the code editor only. If necessary, collapse or overlay the left attached-scripts list on narrow widths instead of shrinking the whole tab into double-scroll behavior.
- [x] Add regression coverage that detects dialog overflow and settings behavior before merge.
	- Note: The previous tests validated CRUD behavior only; they did not assert geometry in a real browser. Add focused unit coverage for dialog/settings logic and browser-level Playwright assertions for narrow dialog layouts and the new settings flow.
- [x] Revalidate the touched packages and finish with the canonical root build, then sync memory-bank closure state.
	- Note: Validation should include focused frontend/backend tests for the touched seams, the targeted Playwright flows, and final root `pnpm build`.

## Active Session: 2026-04-05 Quiz Snapshot Fixture Export And Verification
- [x] Repair snapshot import so exported metahub scripts are restored into live metahub state before publication reserialization.
	- Note: `SnapshotRestoreService` now restores `_mhb_scripts` with attachment remapping and script cleanup, metahub export augments snapshot scripts with `sourceCode`, and focused backend Jest coverage for restore + export stayed green.
- [x] Create a persistent exported metahub snapshot fixture for the fully functional quiz scenario.
	- Note: Added `tools/testing/e2e/support/quizFixtureContract.ts`, the generator `tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts`, and the committed artifact `tools/fixtures/metahubs-quiz-app-snapshot.json` generated through the real export pipeline.
- [x] Add durable validation that the quiz fixture imports, publishes, and produces a working application runtime.
	- Note: `tools/testing/e2e/specs/flows/snapshot-import-quiz-runtime.spec.ts` now proves browser-UI import, restored design-time metahub scripts, application creation from the imported publication, and the full EN/RU quiz runtime contract: 10 questions, 4 answers each, +1 only for correct answers, final score summary, and restart/back navigation.
- [x] Revalidate the fixture pipeline end to end and sync memory-bank closure state.
	- Note: Focused metahubs-backend Jest stayed green, the quiz generator passed (`2 passed`) and wrote the committed fixture, the import/runtime Playwright flow passed (`2 passed`), and the final root `pnpm build` finished green.

## Active Session: 2026-04-05 Scripting QA Gap Closure And Final Plan Completion
- [x] Close the remaining proof and plan-alignment debt for scripting hardening.
	- Note: Added reproducible `@universo/scripting-engine` benchmark proof (`coldStartMs 7.13`, `meanMs 1.596`, `p95Ms 2.127`), explicit isolated-vm startup compatibility validation, and legacy `snapshot.scripts` regression coverage.
- [x] Extend the product E2E coverage from runtime-only proof to the missing authoring/publication/application acceptance seam.
	- Note: Added browser authoring for `quizWidget` `scriptCodename`, shipped the real browser-authored flow from metahub authoring through runtime smoke verification, fixed the shared auth `419` retry defect, and removed the temporary manual-capability workaround by restoring widget default capabilities for untouched draft role switches.
- [x] Revalidate the touched scripting wave end to end and then sync memory-bank closure state.
	- Note: Focused `@universo/auth-frontend` Vitest, focused `EntityScriptsTab` regression coverage, the browser-authored Playwright flow (`2 passed`), and the final root `pnpm build` (`30 successful`, `27 cached`, `3m54.625s`) all finished green.

## Active Session: 2026-04-05 Scripting Full Plan Completion Follow-up
- [x] Expand `@universo/extension-sdk` to the full planned modular SDK surface without regressing the current root import contract.
	- Note: Close the verified plan gap by adding the missing modular source files (`types`, `decorators`, `ExtensionScript`, `registry`, `widget`, `apis/*`), exposing `AtServerAndClient`, and keeping the existing root `@universo/extension-sdk` authoring import stable for current scripts/tests.
- [x] Add the remaining missing scripting regression coverage for authoring/service/frontend CRUD seams.
	- Note: Cover the still-missing update/delete/scope-conflict service branches and the scripts-tab update/delete UI flow so the current QA debt is removed where it was actually observed.
- [x] Align the scripting plan and SDK documentation with the fully shipped contract.
	- Note: Update the plan status/checklists plus EN/RU package READMEs together, keeping multilingual docs line-parity intact and reflecting the completed SDK surface instead of the earlier reduced subset.
- [x] Revalidate the touched scripting wave end-to-end and then sync memory-bank closure status.
	- Note: Finish with focused package tests/builds plus the canonical root `pnpm build`, then update `activeContext.md` and `progress.md` with the final closure result.
	- Note: README line parity matched (`30/30`), focused scripting tests passed across `@universo/scripting-engine`, `@universo/applications-backend`, `@universo/metahubs-backend`, and `@universo/metahubs-frontend`, and the final root `pnpm build` finished green with `30/30` successful tasks.

## Active Session: 2026-04-05 Scripting QA Remediation And Plan Completion
- [x] Tighten the runtime script RPC boundary so direct HTTP calls stay inside the documented fail-closed contract.
	- Note: `RuntimeScriptsService.callServerMethod(...)` and the runtime controller now fail closed at the real backend seam: direct `/applications/:applicationId/runtime/scripts/:scriptId/call` access rejects scripts without `rpc.client`, rejects lifecycle handlers on the public RPC surface, and preserves the existing member-access behavior for valid runtime calls.
- [x] Harden runtime script sync and compatibility enforcement.
	- Note: `_app_scripts` sync now aborts on bootstrap/table-availability defects instead of silently skipping published scripts, and shared `sdkApiVersion` helpers now enforce the supported `1.0.0` contract across compiler, authoring, sync normalization, and runtime loading.
- [x] Add the missing hardening regression coverage.
	- Note: Direct `/call` abuse, runtime service capability boundaries, sync bootstrap failure behavior, compiler SDK mismatch handling, and metahub authoring SDK mismatch handling now have focused regressions that fail loudly.
- [x] Close the remaining plan-completion documentation and status gaps.
	- Note: The touched EN/RU scripting docs, package READMEs, and memory-bank status files now reflect the fail-closed public RPC boundary, the `_app_scripts` sync contract, and the enforced SDK compatibility rules.
- [x] Revalidate the entire scripting wave and finish with canonical repository validation.
	- Note: Changed-file lint, focused package tests, the targeted Playwright runtime scripting quiz flow (`2 passed`), touched package builds, and the final root `pnpm build` all finished green; memory-bank active/progress/systemPatterns/techContext/currentResearch now match the shipped contract.

## Active Session: 2026-04-05 Quiz Runtime Bilingual Acceptance Flow
- [x] Close the remaining acceptance-test gap for the published Space Quiz runtime flow.
	- Note: The target is a Playwright CLI flow that proves real metahub authoring, script attachment, publication, application runtime rendering, English/Russian copy integrity, score semantics for correct vs incorrect answers, and final navigation affordances without broad template churn.
	- Note: The targeted wrapper-based Playwright flow now proves the real `/a/...` application surface in English and Russian, including score changes, final summary, restart/back navigation, and no raw quiz i18n key leakage.
- [x] Add only the minimum product-surface change required for the requested acceptance coverage.
	- Note: If the runtime widget still lacks backward navigation across quiz questions, implement it in the shared `QuizWidget` seam instead of forking the template or adding test-only behavior.
	- Note: `QuizWidget` now exposes `Previous question` during the flow and `Back to questions` from the completion screen via the shared widget/i18n seam only.
- [x] Revalidate the touched quiz/runtime surfaces with focused tests plus the relevant Playwright/browser validation.
	- Note: Finish with the canonical root validation only if touched-package validation stays green and the acceptance flow passes on the real `/a/...` runtime surface.
	- Note: Focused widget/runtime tests passed, the targeted Playwright quiz flow passed with `2 passed`, and the canonical root `pnpm build` completed successfully.

## Active Session: 2026-04-05 Metahub Scripting Completion Remediation
- [x] Close the compiler/client-bundle secrecy gap for mixed client/server scripts.
	- Note: `@universo/scripting-engine` now rejects cross-target shared top-level runtime bindings, and focused compiler/runtime regressions lock the new boundary.
- [x] Replace the technical two-question widget starter with the promised Space Quiz starter contract.
	- Note: The starter source now ships a bilingual 10-question Space Quiz with 4 answers each, difficulty/explanation metadata, locale-aware loading, and server-only scoring data without a template-version bump.
- [x] Finish the planned QuizWidget UX instead of the current bulk-submit demo flow.
	- Note: `QuizWidget` now runs as a sequential single-question flow with progress/score state, explanation feedback, locale-aware payloads, auto-advance after correct answers, and a dedicated `quiz` i18n namespace.
- [x] Update regression coverage and browser proof for the final scripting/quiz contract.
	- Note: Focused compiler, widget, browser-runtime, authoring, and targeted Playwright coverage now fail loudly on the secrecy boundary and the final `/a/...` Space Quiz behavior.
- [x] Revalidate touched packages and finish with the canonical root build, then sync memory-bank progress.
	- Note: Changed-file lint finished without errors, focused package suites passed, `pnpm run build:e2e` passed, the targeted Playwright runtime scripting quiz flow passed, and the final root `pnpm build` finished green (`30/30`).

## Active Session: 2026-04-05 Metahub Scripting Verification Closure Reopen
- [x] Add direct sync persistence coverage for `_app_scripts` publication/runtime synchronization.
	- Note: `syncScriptPersistence.test.ts` now proves `persistPublishedScripts()` and `hasPublishedScriptsChanges()` directly, including scoped index repair, update vs insert behavior, and prune-on-shrink handling.
- [x] Add explicit runtime scripts route proof for the list surface.
	- Note: `applicationsRoutes.test.ts` now covers `GET /applications/:applicationId/runtime/scripts`, including attachment filtering and bundle stripping.
- [x] Prove runtime copy lifecycle parity at the HTTP CRUD seam.
	- Note: The route regression now proves `beforeCopy` stays transactional and `afterCopy` dispatches only after commit with the copied row payload.
- [x] Add a browser-level scripting publication-to-runtime proof for `quizWidget`.
	- Note: The Playwright flow now proves the full real browser chain: runtime script list + client bundle fetch, Worker execution, CSRF-aware `submit()` POST, server runtime execution, and the final `Score: 2 / 2` UI result on `/a/...`.
- [x] Revalidate the touched scripting packages and then rerun the canonical root build.
	- Note: Focused apps-template and scripting-engine tests/builds passed, the E2E-environment build passed, the targeted Playwright flow passed, and the canonical root `pnpm build` finished green with `30/30` successful tasks.

## 2026-04-05 Scripting Closure History (Condensed)
- [x] Security/runtime hardening closure completed.
	- Note: SDK-only compiler imports, restricted browser Worker execution, strict-mode-safe isolate bootstrap, and direct route/runtime security proof are already implemented. Details live in `progress.md` under the 2026-04-05 scripting entries.
- [x] Final lifecycle parity and authoring closure completed.
	- Note: Runtime CRUD plus Record API parity, hard-delete `afterDelete`, CodeMirror authoring refinements, and QuizWidget runtime/unit coverage are already in place.
- [x] Capability model, client-bundle contract, and documentation closure completed.
	- Note: Shared capability normalization, cacheable client-bundle delivery, isolate-pool/circuit-breaker runtime behavior, package READMEs, and EN/RU docs are already shipped.
- [x] Earlier QA remediation and plan-phase implementation completed.
	- Note: Unsafe execution seams were replaced, the public runtime `RecordAPI` was finished, design-time authorization and scoped codename identity were tightened, and the original plan phases were implemented end-to-end before this verification-only reopen.

## Planned: Metahub Scripting/Extension System (GDExtension-analog)
- [x] QA remediation pass superseded the earlier closure notes and is now finished with validated runtime/security/contract fixes.
	- Note: The original 2026-04-05 completion entry remains below as historical implementation context; the validated remediation closure above is now the current source of truth for feature completeness.

- [x] QA analysis of plan
	- Note: Initial pass identified editor, decorator, CRUD hook, UI-pattern, and data-model issues; final pass added completeness refinements for generic attachment targets, public scripting API shape, and future source kinds.
- [x] Plan corrections applied
	- Note: Monaco→CodeMirror 6, decorators→no-op, CRUD hooks Step 3.6, SDK constraints, Scripts tab, defer ScriptedWidgetHost, codename types documented, generic `attached_to_kind`/`attached_to_id`, `module_role`, `source_kind`, public `RecordAPI`/`MetadataAPI` contract, manifest-declared capabilities, and ScriptHealthMonitor circuit breaker.
	- Note: Status updated on 2026-04-05. User approval was already given; implementation is now active.

### Implementation Execution Order (2026-04-05)
- [x] Sync memory-bank state and replace the old "awaiting approval" status with the active implementation ledger.
	- Note: `activeContext.md` was also normalized so implementation state, constraints, and next steps stay current.
- [x] Phase 1: SDK + Engine Foundation (`@universo/extension-sdk`, `@universo/scripting-engine`, shared script types, compiler/runtime contracts, schema-ddl/runtime table support, i18n seeds)
	- Note: Complete. Shared script types, compiler/runtime contracts, the safe non-`isolated-vm` host abstraction, and supporting runtime table contracts are implemented and package-validated.
- [x] Phase 2: Metahub Integration (design-time scripts metadata, metahub CRUD/API surfaces, `_mhb_scripts`, structure versioning, snapshot serialization, script editor UI with CodeMirror 6, Scripts tab in existing dialogs)
	- Note: Complete. Backend design-time integration plus the reusable CodeMirror-based Scripts tab are implemented for metahub, catalog, hub, set, enumeration, and attribute edit dialogs. The optional dedicated full-page editor route was not required for the approved runtime/widget scope and remains deferred.
- [x] Phase 3: Runtime Integration (`_app_scripts`, publication/runtime sync, script execution/RPC routes, client bundle delivery, runtime lifecycle interception around row create/update/delete/copy)
	- Note: Complete. `_app_scripts`, publication/runtime sync persistence, runtime execution/RPC routes, and fail-closed lifecycle interception are implemented and package-validated.
- [x] Phase 4: Quiz Widget (`quizWidget` type registration, widget renderer integration, runtime component, client/server script bridge, sample quiz template content)
	- Note: Complete. `quizWidget` is registered in shared widget contracts, rendered through the existing apps-template widget renderer, backed by the runtime script bridge, and supported by widget-specific starter source plus EN/RU UI text.
- [x] Phase 5: Hardening & Documentation (focused tests, package validation, root build, memory-bank progress update, EN/RU docs where touched)
	- Note: Complete. Focused validation passed across the touched package wave, the `runtimeRowsController` parse regression and follow-up strict typing issues were fixed, and the canonical root `pnpm build` finished green (`30/30`, `28 cached`).
	- Note: Full plan with code examples at `memory-bank/plan/metahub-scripting-extension-system-plan-2026-04-05.md`
	- Note: Creative design archive at `memory-bank/creative/creative-metahub-scripting-extension-system.md`

### Remaining Execution Slice (Current Session)
- [x] Build and wire the reusable Scripts tab/editor into existing metahub entity dialogs.
	- Note: The current implementation reuses `EntityFormDialog`/`TabConfig`, ships a shared scripts API client, and surfaces CodeMirror authoring for metahub, catalog, hub, set, enumeration, and attribute edit dialogs.
- [x] Register and render `quizWidget` through the existing dashboard/widget contracts.
	- Note: Complete. The widget is registered in shared metahub types, rendered in apps-template-mui, and receives runtime application/catalog context from `ApplicationRuntime.tsx`.
- [x] Connect the runtime widget/client bridge to the new applications-backend scripts routes.
	- Note: Complete. The browser runtime helper executes widget client bundles, proxies server methods through runtime script call routes, and is covered by a focused unit test.
- [x] Run focused package validation plus canonical root `pnpm build`, then sync progress.md / activeContext.md.
	- Note: Complete. Final closure also required fixing the backend parser regression in `runtimeRowsController.ts`, strict VLC typing in script persistence/services, and strict QuizWidget normalization typing before the final green root build.

## Active Session: 2026-04-04 Self-Hosted Fixture And Header Geometry Revalidation
- [x] Repair the self-hosted fixture contract so imported catalog labels match the expected Sets / Enumerations naming on a fresh browser import.
	- Note: Fix the canonical Playwright generator source of truth first, then regenerate `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the real generator instead of hand-editing the exported artifact.
- [x] Remove the shared header gutter drift that became visible after the layout-details back button was removed and normalize runtime toolbar edge spacing.
	- Note: Keep the fix in the shared `ViewHeader` / runtime action contract so both the layout details page and published `/a/...` header recover their standard left/right alignment.
- [x] Normalize runtime header control heights so search and view-toggle controls match the Create action.
	- Note: The current regression is caused by shared 40px controls next to a small Create button rendered outside `ToolbarControls`.
- [x] Add geometry-focused regression coverage for the affected layout-details and published-runtime flows.
	- Note: Existing tests already prove functionality, but they do not assert title/control edge alignment or height parity, which is why this regression passed previously.
- [x] Regenerate the committed self-hosted fixture and revalidate the touched flows plus the canonical root build.
	- Note: Validation must cover the real generator path, the affected Playwright flows, and the final root `pnpm build`.
	- Current status: complete; the fixture contract now exports the canonical Enumerations and Sets labels through the generator path, `ViewHeader` no longer applies negative gutter offsets, the runtime Create button and shared controls now share the same 40px height contract, geometry assertions were added to the affected Playwright flows, the real generator reran and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`, the targeted browser flows passed, and the canonical root `pnpm build` finished green.

## Active Session: 2026-04-04 QA Remediation Closure

- [x] Re-run focused lint/test validation on the touched self-hosted parity packages and isolate only the currently reproducible issues.
	- Note: Use the latest branch state rather than the earlier QA snapshot so fixes target real remaining debt only.
- [x] Fix every confirmed residual issue without widening scope beyond the self-hosted parity wave.
	- Note: Prioritize lint/formatting debt in touched files and any test gaps or regressions that still reproduce.
- [x] Revalidate the touched packages and finish with the canonical root `pnpm build`.
- [x] Update memory-bank active/progress state to reflect the final remediation result.
	- Note: Focused lint now ends with 0 errors for `@universo/utils`, `@universo/template-mui`, `@universo/metahubs-frontend`, `@universo/metahubs-backend`, and `@universo/apps-template-mui`; the only non-format residual defect was a duplicate `EnumerationValueOption` type declaration in `ElementList.tsx`; canonical root `pnpm build` finished green with `28/28` successful tasks.

- [x] Close the post-import self-hosted schema-diff, runtime inheritance, UI polish, and fixture-fidelity regression wave from 2026-04-04
	- Note: This pass is limited to the newly verified defects after the user imported the committed self-hosted fixture, linked an application, created schema, changed only catalog/layout runtime settings, published a new version, and observed connector/runtime regressions in real browser verification.
	- Implementation order for the current session:
		- [x] Fix the imported-snapshot ID drift so later live publications keep stable executable entity/field identity and layout-only publications do not produce full destructive application diffs.
		- [x] Redesign catalog runtime settings so local overrides are opt-in and global layout settings remain inherited by default.
		- [x] Remove the layout-settings back button, rename the unclear surface labels, and normalize the published runtime spacing/control-height polish.
		- [x] Repair the self-hosted generator/fixture contract so default Main entities and section/category naming match the live clean-metahub behavior.
		- [x] Regenerate the committed self-hosted fixture through the real generator and revalidate the touched flows.
	- Required outcomes:
		- [x] Imported metahubs/publications must not persist a raw imported snapshot as the active publication baseline when the live branch has already remapped object IDs during restore.
		- [x] A layout-only or catalog-runtime-only publication change must not surface as full-table destructive schema recreation in the linked application connector.
		- [x] Catalog-local runtime settings must inherit global layout settings until the user explicitly enables local overrides.
		- [x] Layout/runtime authoring UI must remove the clipped back button, use clearer create/edit/copy wording, and keep the published runtime controls visually aligned.
		- [x] The committed self-hosted fixture must export the corrected localized Main codename/section contract and stay aligned with the real import/generator path.
	- Validation target: focused backend/frontend/unit tests, targeted self-hosted generator/import validation, and the canonical root `pnpm build`.
	- Current status: complete; imported publication baselines now serialize from the restored live branch instead of the raw imported payload, catalog runtime config now keeps inheritance sparse unless `useLayoutOverrides` is explicitly enabled, the layout/runtime polish fixes are shipped, the self-hosted contract now canonicalizes localized Main codenames and section naming, the missing browser-safe `@universo/utils` export for `sanitizeCatalogRuntimeViewConfig` was fixed at the shared package boundary, the real Playwright generator reran and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`, the targeted browser import flow passed on the regenerated fixture, `pnpm run build:e2e` finished green (`28/28`), and the final root `pnpm build` also finished green (`28/28`).

- [x] Close the fresh-import self-hosted codename and section-name regressions from the 2026-04-04 user verification pass
	- Note: This pass is limited to the newly verified defects after another full rebuild, empty database reset, and fresh import of `tools/fixtures/metahubs-self-hosted-app-snapshot.json`: the imported metahub codename still gains noisy suffixes and loses the Russian locale variant, one repeated section still appears as a standalone `Enumeration Values` catalog, the auto-created default `Main` entities still persist type-suffixed English codenames (`MainHub`, `MainCatalog`, `MainSet`, `MainEnumeration`), and the committed self-hosted fixture must be regenerated from the corrected generator contract.
	- Implementation order for the current session:
		- [x] Replace noisy imported metahub codename generation with canonical localized EN/RU codename derivation from the imported metahub name while keeping collision handling deterministic.
		- [x] Fix template-seeded default `Main` entity codename generation so the primary English codename is derived from the localized entity name instead of the raw template key suffix.
		- [x] Remove the extra standalone `Enumeration Values` self-hosted top-level catalog contract and fail closed if the committed fixture drifts back.
		- [x] Regenerate `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the corrected Playwright generator and revalidate the touched flows.
	- Required outcomes:
		- [x] Imported self-hosted metahubs must use stable canonical metahub codenames derived from the localized metahub name, with both English and Russian codename locales and no timestamp/random noise on the normal path.
		- [x] Auto-created default `Main` entities must no longer store `MainHub` / `MainCatalog` / `MainSet` / `MainEnumeration` as the primary English codename when the localized entity name is already `Main`.
		- [x] The self-hosted fixture/generator contract must no longer create or tolerate a standalone `Enumeration Values` section.
		- [x] The committed self-hosted fixture must be regenerated from the corrected generator contract and stay aligned with the import/browser validation path.
	- Validation target: focused backend template/import tests, targeted self-hosted generator/import validation, regenerated fixture sanity checks, and the canonical root `pnpm build`.
	- Current status: complete; imported metahub codenames are now derived from the localized imported metahub name with deterministic localized imported suffixes only on real collisions, template seed execution and migration now normalize the primary English codename from localized `Main` names instead of raw `MainHub`/`MainCatalog` keys, the self-hosted contract rejects the deprecated standalone `Enumeration Values` catalog plus legacy type-suffixed `Main*` codenames, the real Playwright generator reran and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json` with 11 canonical sections, the regenerated fixture no longer contains the legacy markers, the targeted browser import flow passed, and the final root `pnpm build` finished green.

- [x] Close the fresh-import self-hosted publication/settings fixture regressions from the 2026-04-04 user verification pass
	- Note: This pass is limited to the newly verified defects after a clean rebuild, empty database, and fresh import from `tools/fixtures/metahubs-self-hosted-app-snapshot.json`: publication settings open with an empty name, publication breadcrumbs can degrade to `[object Object]`, application settings render an extra application-name subtitle, the exported self-hosted metahub codename still carries run/import noise and lacks a Russian locale variant, and the exported default layout still contains duplicate left-side menu widgets.
	- Implementation order for the current session:
		- [x] Separate publication breadcrumb cache from publication detail cache and restore stable settings hydration.
		- [x] Remove the extra application-settings subtitle from the frontend settings page.
		- [x] Canonicalize the self-hosted metahub codename with stable EN/RU localized values.
		- [x] Make the self-hosted generator/update flow keep exactly one canonical left menu widget.
		- [x] Regenerate `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the corrected Playwright generator and revalidate the touched flows.
	- Required outcomes:
		- [x] Publication settings must show the existing localized publication name after a fresh self-hosted fixture import.
		- [x] Publication breadcrumbs must never render `[object Object]` after repeated navigation into publication inner routes.
		- [x] Application settings must render only the main page title without an extra duplicated application-name subtitle.
		- [x] The committed self-hosted fixture must export a stable canonical metahub codename with a Russian localized codename variant.
		- [x] The committed self-hosted fixture must contain exactly one canonical `Catalogs` menu widget in the default layout, without the duplicate `Main` menu.
		- [x] Revalidate with focused tests/checks, regenerate the committed fixture through the Playwright generator, and finish with the required targeted validations.
	- Validation target: focused frontend tests for publication/application surfaces, targeted generator/fixture assertions, regenerated fixture sanity checks, and any required package/build validation for touched files.
	- Current status: complete; publication breadcrumb/detail queries now use separate cache keys so settings hydration no longer leaks object/string payloads, the application settings subtitle is gone, the self-hosted live generator now creates a valid CodenameVLC while the committed fixture canonicalizes EN/RU codename locales, the regenerated fixture contains exactly one canonical `menuWidget`, targeted frontend tests passed, `pnpm run build:e2e` stayed green, the Playwright generator rerun passed and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`, the targeted browser import flow passed on the regenerated fixture, and the final root `pnpm build` finished green.

- [x] Close the post-QA self-hosted regressions and publication UX defects from the 2026-04-04 audit
	- Note: This pass is limited to the concrete defects still confirmed after the last QA verdict and the user follow-up: the committed self-hosted fixture hash is invalid, catalog runtime defaults do not inherit layout settings correctly, publication settings/edit dialogs regress on localized values, publication version creation shows branch labels as `[object Object]`, and auto-created Main entities still miss Russian codename locales.
	- Note: An additional validation blocker surfaced during the required Playwright import rerun: Node-side ESM consumers could not resolve `dayjs` plugin/locale imports from `@universo/utils` dist. This was fixed in the shared `formatDate` utility with explicit `.js` Day.js ESM specifiers before the browser flow was revalidated.
	- Implementation order for the current session:
		- [x] Repair the fixture hash contract and regenerate the committed snapshot.
		- [x] Restore catalog runtime inheritance semantics without regressing explicit overrides.
		- [x] Fix publication settings/edit hydration and normalize publication branch labels.
		- [x] Seed localized default codenames for auto-created Main entities.
		- [x] Revalidate with focused tests, browser import flow, and root build.
	- Required outcomes:
		- [x] Repair the self-hosted fixture/generator hash contract so the committed `metahubs-self-hosted-app-snapshot.json` imports successfully through the real browser flow.
		- [x] Fix catalog runtime config resolution so layout-level defaults remain inherited unless a catalog explicitly overrides them.
		- [x] Fix the publication settings/edit surface so existing localized names/descriptions load correctly instead of opening empty.
		- [x] Fix publication version creation so the selected branch label renders localized text instead of `[object Object]`.
		- [x] Ensure automatically created default `Main` entities seed Russian codename locales alongside English ones where the product already seeds EN/RU names.
		- [x] Revalidate with focused tests, the relevant snapshot-import Playwright flow, and a canonical root `pnpm build`.
	- Validation target: focused frontend/backend/unit tests, targeted self-hosted snapshot import E2E, and canonical root `pnpm build`.
	- Current status: complete; the self-hosted canonicalizer now recomputes `snapshotHash` after canonical mutations and the committed fixture was rehashed to a validator-clean `0904ee61b0db8b1c541c9a8b2008d7af35a9c5768f497cf89586af83346b1d7c`, catalog runtime layout inheritance now preserves layout defaults unless catalog overrides are explicit, `EntityFormDialog` now hydrates async extra values until the user edits them, publication branch labels normalize VLC codenames to strings, template-seeded default Main entities now derive Russian codename locales from localized names, the Day.js ESM import blocker in `@universo/utils` was fixed, targeted package tests passed, the real browser import flow passed, and the final root `pnpm build` completed successfully.

- [x] Close the last self-hosted documentation drift from the 2026-04-04 QA audit
	- Note: The runtime/code path is already validated green; this pass is limited to the remaining stale README references that still mention the old self-model screenshots directory instead of the canonical self-hosted screenshots contract.
	- Required outcomes:
		- [x] Update both EN/RU E2E READMEs to point to the canonical self-hosted screenshots directory naming.
		- [x] Recheck the active tooling/docs surface for remaining stale screenshot-path references after the edit.
		- [x] Update memory-bank active/progress state so the final parity closure no longer carries even low-severity documentation debt.
	- Validation target: targeted workspace grep checks for the stale screenshot-path string after the doc edit.
	- Current status: complete; both E2E READMEs now point to the canonical self-hosted screenshots directory naming, the stale `test-results/self-model` path is gone from the active tooling/docs surface, and the memory-bank status now reflects a fully closed parity wave with no remaining low-severity documentation drift.

- [x] Close the final QA-confirmed parity gaps from the 2026-04-04 self-hosted audit
	- Note: This pass is limited to the concrete defects confirmed after the previous completion claim. Keep the validated runtime work intact while closing the remaining security, fixture-quality, naming-cleanup, migration-evidence, and route-test gaps.
	- Required outcomes:
		- [x] Tighten metahub snapshot export authorization so the frontend and backend require an explicit management-level permission instead of bare membership access, and add direct forbidden-path regression coverage.
		- [x] Replace the remaining technical/mixed-language self-hosted fixture copy with clean product-grade EN/RU names and descriptions, then regenerate the committed fixture artifact from the corrected generator contract.
		- [x] Remove the last legacy `self-model` fixture codename/reference that still survives in self-hosted consumer E2E coverage.
		- [x] Add backend route-level regression coverage for catalog `runtimeConfig` create/update/copy persistence so the shared contract is proved through HTTP behavior rather than only implementation reads.
		- [x] Close the migration-parity evidence gap by validating and documenting the shipped self-hosted migrations surface in a way that matches the real implementation instead of leaving the plan overstated.
		- [x] Revalidate with focused tests for touched backend/frontend/generator surfaces and finish with a canonical root `pnpm build`.
	- Validation target: focused Jest/Vitest suites, targeted self-hosted generator validation, regenerated fixture sanity checks, and the canonical root `pnpm build`.
	- Current status: complete; metahub export now requires `manageMetahub` end-to-end with direct `403` backend coverage, the self-hosted contract/fixture copy was rewritten and the committed snapshot was regenerated from the corrected canonicalizer, the last consumer-side `self-model` codename was removed, catalog `runtimeConfig` HTTP coverage now spans create/update/copy, migration parity is now documented as a shipped UI surface rather than an implied fixture section, and the final root `pnpm build` finished green (`28/28`).


- [x] Close the remaining QA-confirmed self-hosted fixture fidelity gaps
	- Note: This pass is limited to the concrete defects confirmed by the 2026-04-04 QA audit after the previous "complete" status: the committed self-hosted snapshot is still an e2e-stamped artifact, the generator/CLI contract is not yet canonicalized, and regression coverage remains too weak to fail loudly on fixture drift.
	- Note: Final consumer validation also exposed one remaining downstream blocker after import: application runtime sync still fails for the canonical self-hosted fixture during the connector-driven schema creation flow, so this pass must close that applications-backend compatibility gap before the task can be marked complete.
	- Required outcomes:
		- [x] Canonicalize the generated/exported self-hosted snapshot identity so the committed fixture uses stable product metadata instead of run-specific e2e names/codenames.
		- [x] Rename and configure the canonical default dashboard layout instead of leaving the exported fixture on the seeded `Main` layout or creating an unused duplicate layout.
		- [x] Strengthen generator and consumer assertions so stale self-model artifacts, weak localization, incomplete section descriptions, and incomplete settings baseline regressions fail closed.
		- [x] Align the manual creation utility with the canonical generator contract so both produce the same self-hosted structure, layout naming, localization quality, and seeded settings data.
		- [x] Regenerate `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the corrected generator contract and revalidate all consuming flows.
		- [x] Make applications runtime sync preserve canonical enum-value codename payloads from imported snapshots so connector-driven schema creation no longer fails after self-hosted fixture import.
		- [x] Update memory-bank status/progress so completion claims match the real artifact contract after validation.
	- Validation target: focused generator/consumer checks, targeted lint for touched files, targeted self-hosted Playwright generator rerun, and canonical root `pnpm build`.
	- Current status: complete; the canonical generator/CLI/layout contract was repaired, the committed self-hosted fixture was regenerated from the real generator, applications runtime sync now normalizes imported enum-value codenames as canonical VLC payloads and ships through the rebuilt package dist, focused applications-backend seeding coverage passed, both self-hosted fixture-consuming Playwright flows passed, and the canonical root `pnpm build` finished green (`28/28`).

- [x] Close the remaining QA and plan-completion gaps for the metahub self-hosted parity wave
	- Note: This implementation pass is limited to the concrete defects and incompletions confirmed by the 2026-04-04 QA audit after the nominal parity-wave completion. Keep legacy working behavior intact while removing the verified technical debt.
	- Required outcomes:
		- [x] Disable persisted runtime row reordering whenever the frontend cannot guarantee a complete dataset order, and keep the UI honest about local-search / partial-data constraints.
		- [x] Prevent direct page-surface create activation when a catalog disables the create action via `runtimeConfig.showCreateButton`.
		- [x] Expose the direct metahub export action in the metahub frontend so the shipped UI matches the supported backend surface.
		- [x] Repair the stale applications-frontend test mock and clear the relevant lint / formatting debt introduced in touched files.
		- [x] Update the parity plan/docs/memory-bank status so they reflect the completed implementation rather than a draft with open checklist items.
		- [x] Revalidate with focused package tests/lint, required targeted checks, and a final root `pnpm build`.
	- Validation target: targeted Vitest/Jest suites for touched packages, package lint for changed packages, and canonical root `pnpm build`.
	- Current status: complete; runtime reorder now fails closed on partial/local-search datasets with explicit user messaging, hidden-create page routing is blocked, direct metahub export is exposed as a per-entity action, the stale applications-frontend mock and touched-file formatting debt were repaired, and validation finished green including targeted Vitest runs, lint for touched frontend packages, and a final root `pnpm build` (`28/28`).


- [x] Close the final QA remediation gaps for the metahub self-hosted parity wave
	- Note: This follow-up is limited to the concrete defects confirmed by the 2026-04-04 QA pass after the nominal parity-wave completion. Do not widen scope beyond the verified gaps in fixture fidelity, localization quality, regression-proofing, and their documentation/memory trail.
	- Required outcomes:
		- [x] Fix the English metahubs locale regression so newly added catalog runtime/layout keys are truly English in the EN bundle and remain aligned with RU.
		- [x] Strengthen generator/export regression coverage so the self-hosted fixture contract asserts its real identity and catches stale self-model artifacts.
		- [x] Regenerate or otherwise replace `tools/fixtures/metahubs-self-hosted-app-snapshot.json` with the actual self-hosted V2 artifact produced by the current generator contract, including the removal of the standalone `Attributes` catalog.
		- [x] Update any touched EN/RU documentation and memory-bank status files so they describe the real delivered fixture/i18n state rather than the previously assumed one.
		- [x] Revalidate with focused package tests/checks, the generator flow if available, and a final root `pnpm build`.
	- Validation target: targeted metahubs-frontend tests, targeted generator validation, artifact sanity checks, and canonical root `pnpm build`.
	- Current status: complete; the EN locale bundle and regression assertions were corrected, the self-hosted generator/export contract now fails closed against stale self-model assumptions, the committed fixture was regenerated through the real generator after fixing the `Settings` seed payload key mismatch (`Key`/`Value`/`Category`), and the validation stack finished green including the final root `pnpm build` (`28/28`).



- [x] Implement the metahub self-hosted parity wave
	- Note: Execute the approved plan in `memory-bank/plan/metahub-self-hosted-app-parity-plan-2026-04-04.md` end-to-end without widening scope beyond the defined parity wave. Preserve working legacy functionality while delivering the new self-hosted metahub MVP path.
	- Current implementation pass (2026-04-04 QA closure + completion):
		- [x] Fix the confirmed QA blockers in runtime CRUD and validation: parent create/copy permission gates, the `runtimeRowsController` root-build TypeScript error, and direct regression coverage for create/copy/reorder permissions.
		- [x] Finish Phase 6 by wiring standalone runtime page surfaces through the existing shared form/page/tabular primitives and locking the behavior with focused tests.
		- [x] Finish Phase 7 by exposing migration-control parity in the self-hosted app flow with the existing application migration page/guard patterns and navigation affordances.
		- [x] Finish Phase 8 by replacing the transitional self-model fixture/generator naming and dependent flows with the localized V2 artifact contract.
		- [x] Finish Phase 9 by closing the remaining snapshot/export/import fixture UX and regression gaps for the renamed self-hosted artifact contract.
		- [x] Finish Phase 10 with focused unit/integration/Playwright/generator validation plus a green root `pnpm build`.
		- [x] Finish Phase 11 with EN/RU tooling/docs updates for the delivered self-hosted fixture and flow behavior.
	- Required outcomes:
		- [x] Phase 0: capture baseline screenshots/current runtime evidence and keep the section-by-section parity evidence in the validation/docs trail.
		- [x] Phase 1: introduce shared typed runtime/editing config contracts and make metahubs + applications-backend + apps-template consume the same schema/defaulting helpers.
		- [x] Phase 2: add per-catalog layout/runtime/edit-surface authoring controls in existing metahub dialogs.
		- [x] Phase 3: add multiline attribute authoring/runtime behavior using the existing `uiConfig.widget` seam.
		- [x] Phase 4: refactor apps-template runtime to stay DataGrid-first while supporting toolbar, quick filter, card/list, row height, and per-catalog overrides.
		- [x] Phase 5: implement persisted row-reordering rules and fail-closed gating.
		- [x] Phase 6: add page-surface editing and child-relation runtime surfaces using shared form/page primitives.
		- [x] Phase 7: add migration-control parity for the self-hosted metahub app using existing migration routes/patterns.
		- [x] Phase 8: replace the self-model fixture/generator with the localized product-faithful V2 artifact and rename all dependent flows.
		- [x] Phase 9: complete snapshot/export/import UX and regression coverage for new config fields.
		- [x] Phase 10: add/extend unit, integration, Playwright, generator, and fresh-import validation coverage; pass targeted checks and root `pnpm build`.
		- [x] Phase 11: update package READMEs and GitBook docs in EN/RU for the delivered behavior.
	- Validation target: targeted tests during each phase, final root `pnpm build`, targeted Playwright coverage, generator rerun, and fresh hosted E2E import/export verification.
	- Current status: complete; the shared runtime-config contract survives authoring/backend/runtime/export/import, standalone runtime now respects authored page surfaces, application self-hosted navigation exposes migrations parity, the V2 self-hosted fixture/generator contract replaced the transitional self-model artifact naming, focused tests/load checks passed, the shared browser export drift in `@universo/utils` was fixed at the source, and the final root `pnpm build` finished green (`28/28`).

- [x] Plan the next metahub self-hosting parity wave
	- Note: The previous snapshot/runtime wave delivered import/export and layout-level runtime settings, but did not reach catalog-level parity, attribute presentation parity, page-surface editing, or a production-credible self-model fixture. This planning task must define the next implementation wave without writing production code yet.
	- Required outcomes:
		- [x] Audit the remaining gap between the original metahub-self-hosting brief and the current implementation in `main`.
		- [x] Produce a new detailed plan in `memory-bank/plan/metahub-self-hosted-app-parity-plan-2026-04-04.md` covering metadata contracts, runtime refactor, self-model V2, tests, and docs.
		- [x] Explicitly fix the previous planning mistakes in the new plan: layout-global settings instead of catalog-specific settings, alternate runtime table degradation, local-only reorder semantics, and the weak self-model fixture structure.
		- [x] Run a QA-oriented architecture review on the new plan against the real codebase, reusable UI/runtime seams, and relevant MUI DataGrid guidance.
		- [x] Refine the plan so it reuses existing tabbed dialogs, attribute `uiConfig` seams, and current runtime primitives instead of introducing unnecessary nested settings DSLs or parallel CRUD surfaces.
		- [x] Add the missing cross-package runtime schema unification and migration-control parity work so the plan does not leave hidden sync drift or a migrations-section parity hole.
		- [x] Keep the new plan aligned with current package boundaries, modern shared-package usage, i18n-first text handling, UUID v7, and the no-legacy-removal constraint while awaiting final user approval.
	- Current status: complete; the approved plan is now the implementation source of truth for the active wave.
	- Validation target: codebase inspection, package README review, targeted external documentation lookup, and a discussion-ready plan file only.

- [x] Address validated PR #747 review findings without widening scope
	- Note: Evaluate every bot comment from PR #747 against the current branch state, fix only the findings that are technically correct and safe, and explicitly avoid speculative architecture changes that would widen the feature surface.
	- Required outcomes:
		- [x] Confirm which review comments still correspond to live defects in the current worktree after the post-PR edits.
		- [x] Fix the confirmed correctness issues in backend/frontend/tests with minimal changes and no unrelated refactors.
		- [x] Check external documentation where it materially helps validate the proposed fix or reject a bot suggestion.
		- [x] Revalidate the touched surfaces with focused checks/tests and leave the branch ready for a follow-up commit.
	- Validation target: diagnostics for touched files, focused tests/builds for touched packages, and a canonical root build.
	- Outcome: fixed the live mid-file import, the `React.ChangeEvent` namespace issue, the ineffective snapshot prototype-pollution test, the SnapshotRestoreService codename logging output, the imported-metahub codename collision risk, and the `MainGrid` FlowListTable `renderCell` API placeholder; explicitly did not widen scope into server-side runtime search or persisted row-order storage because those review comments were product/architecture suggestions rather than safe correctness fixes. The branch is validated locally and ready for commit/push if requested.

- [x] Close the verified snapshot/runtime follow-up gaps from 2026-04-04
	- Note: This wave reopens only the residual defects confirmed by direct verification after the previous implementation pass. Do not touch unrelated working-tree changes.
	- Required outcomes:
		- [x] Make `importFromSnapshot` cleanup-safe for the two early post-create failure branches (`Failed to create metahub branch`, `Branch schema not found`) instead of returning before compensation.
		- [x] Replace the runtime view smoke test with a deterministic `/a/...` flow that provisions a real application, asserts enhanced runtime controls, and proves the FlowListTable path is active when row reordering is enabled.
		- [x] Persist enhanced runtime layout settings into the self-model generator contract and regenerate `tools/fixtures/self-model-metahub-snapshot.json` from the corrected order of operations.
		- [x] Fix the manual self-model utility CSRF endpoint and refresh generator documentation so the described scope matches the real 13-section fixture.
	- Validation target: focused metahubs-backend tests, apps-template/runtime browser flow validation, targeted self-model generator rerun when available, and the canonical root `pnpm build`.
	- Outcome: early import branch/schema failures now reuse the rollback cleanup path, `app-runtime-views.spec.ts` exercises the real `/a/${applicationId}` route with card/search/list assertions, the self-model generator reran successfully and regenerated the fixture with enhanced runtime layout fields, the manual utility now uses `/api/v1/auth/csrf`, the generator docs describe the 13-section scope, and the validation stack passed (`metahubsRoutes.test.ts`, targeted runtime Playwright flow, targeted generator run, root `pnpm build`).


- [x] Implement QA closure for snapshot import cleanup, runtime list consistency, and self-model scope
	- Note: Keep scope limited to the six validated QA items from the current implementation pass. Do not revert unrelated worktree changes.
	- Required outcomes:
		- [x] Make metahub snapshot import cleanup-safe on restore/publication failure, including explicit cleanup-failure reporting.
		- [x] Add backend tests for import rollback and cleanup-failure paths.
		- [x] Fix apps-template runtime filtered-view pagination/search consistency in MainGrid.
		- [x] Finish the enableRowReordering runtime path with FlowListTable integration and LayoutDetails wiring without regressing the DataGrid path.
		- [x] Expand the self-model generator/fixture contract from the current 9-catalog shape to the planned 13-section scope and update dependent assertions/docs if needed.
		- [x] Clean remaining diagnostics/editorial issues in snapshotArchive.test.ts and SnapshotRestoreService.test.ts, then revalidate with focused tests and a full root pnpm build.
	- Validation target: focused Jest/Vitest runs for touched backend/frontend/utils areas, then full root `pnpm build`.
	- Outcome: metahub import now fails closed with explicit rollback vs cleanup-failure responses, MainGrid uses local filtered totals and FlowListTable reorder mode when configured, LayoutDetails exposes the now-real reorder toggle again, the self-model generator and CLI create the planned 13 sections via real hub/set/enumeration endpoints and regenerated `tools/fixtures/self-model-metahub-snapshot.json`, the two QA-flagged test files are diagnostics-clean, focused tests passed, and the root `pnpm build` finished green (`28/28`).

- [x] QA remediation follow-up for snapshot/runtime settings hardening
	- Note: Reopen the completed snapshot wave only for validated post-QA implementation gaps. Keep the fix scope limited to concrete defects: snapshot transport type contract drift, runtime view-settings contract drift, RBAC/import test gaps, and repository cleanup artifacts.
	- Required outcomes:
		- [x] Align `buildSnapshotEnvelope()` input typing with the stricter snapshot transport schema and remove the confirmed editor/TypeScript contract drift.
		- [x] Resolve the `enableRowReordering` contract debt consistently across apps-template-mui runtime, layout settings UI, and documentation without introducing a noop feature seam.
		- [x] Add backend tests that prove publication version import behavior and permission-path expectations more directly.
		- [x] Remove accidental repository-root artifact files left outside the project contract.
		- [x] Revalidate with focused package tests/checks and a full root `pnpm build`.
	- Validation target: strict package-level TypeScript validation for touched code where relevant, focused Jest/Vitest runs for touched backend/utils areas, then full root `pnpm build`.
	- Outcome: tightened snapshot envelope typing in `@universo/utils` and backend export callsites, removed the stale `enableRowReordering` config seam from runtime/docs/i18n, added publication-version import happy-path assertions, deleted accidental root artifacts, and finished with green focused tests plus a green root `pnpm build` (`28/28`).

- [x] Fix snapshot import UX, backend compatibility, and remaining E2E failures
	- Note: Closed the snapshot-import follow-up wave by fixing the import-created publication/version linkage, aligning the import dialog with the shared modal contract, and stabilizing the remaining full-suite regressions.
	- Required outcomes:
		- [x] Import dialog copy is renamed from snapshot wording to configuration wording, including RU text for the no-file-selected state.
		- [x] Import dialog matches the shared modal style contract and does not render the extra horizontal divider lines.
		- [x] `tools/fixtures/self-model-metahub-snapshot.json` imports successfully through the real browser UI.
		- [x] Connector-driven schema creation for an application linked to the imported self-model metahub no longer fails on `GET /api/v1/application/:id/diff`.
		- [x] E2E covers the imported-self-model -> connector -> create schema path.
		- [x] Residual full-suite failures are fixed and `pnpm run test:e2e:full` completes green.
		- [x] Wrapper-managed E2E runs stop the owned server and release port `3100` after completion.
	- Validation target: focused Playwright CLI reruns for the touched flows, then full `pnpm run test:e2e:full`, plus an explicit post-run port-availability check.
	- Outcome: full root `pnpm build` passed; targeted metahubs import tests, connector/snapshot/admin/visual Playwright reruns passed; final `pnpm run test:e2e:full` finished green; post-run `lsof -iTCP:3100 -sTCP:LISTEN` showed no listener.

- [x] E2E Supabase full reset and teardown hardening
	- Note: Replaced manifest-only cleanup as the primary isolation boundary with a guarded full project reset for the dedicated hosted E2E Supabase. Scope now covers application-owned fixed schemas, dynamic `app_*` / `mhb_*` schemas, `upl_migrations`, Supabase auth users, runner orchestration, diagnostics, and EN/RU docs.
	- Validation:
		- [x] Added a safe `full reset` backend helper with dry-run/report support and strict E2E-only guardrails.
		- [x] Derived resettable fixed schemas from registered system app definitions while keeping infrastructure schema `public` intact and self-healed.
		- [x] Integrated reset before suite startup and after server shutdown in the Playwright runner.
		- [x] Kept manifest cleanup as a narrow recovery/helper path, not the primary isolation strategy.
		- [x] Added doctor/report tooling to verify leftover schemas/users after teardown.
		- [x] Updated English and Russian E2E documentation with the new reset contract and safety rules.
		- [x] Validated via full `pnpm build`, full `pnpm run test:e2e:full`, explicit post-run cleanup verification, and a green smoke rerun proving automatic runner-finalize reset.
	- Outcome: full `test:e2e:full` completed and exposed 5 pre-existing spec failures outside the reset scope (`app-runtime-views`, `profile-update`, `snapshot-export-import`, visual metahub dialog). After the run, `test:e2e:cleanup` + `test:e2e:doctor -- --assert-empty` confirmed zero project-owned schemas/auth users/artifacts; after the runner process-group fix, `test:e2e:smoke` passed `11/11` and automatic `runner-finalize` left the database empty without manual intervention.

- [x] Address validated PR #745 review findings in admin locale, instance, and role codename flows.
	- Note: Implemented the confirmed fixes only: locale typing now preserves a trailing separator, instance inline edits keep untouched locales, and role codename validation now honors runtime `metahubs` settings on backend routes while preserving legacy slug compatibility. Validation passed via focused Jest, package builds, and full `pnpm build`.

- [x] Add Package Configuration for `core-frontend` to include `.env*` files in build inputs, closing the .env cache-invalidation gap.
	- Note: `core-frontend` is the only package that reads `.env` via `dotenv` at Vite build time. Without explicit `.env*` inputs, changing a `.env` value would not invalidate the cached build.

- [x] Metahub Self-Hosted App & Snapshot Export/Import — ALL PHASES COMPLETE
	- Plan: `memory-bank/plan/metahub-self-hosted-app-and-snapshot-export-plan-2026-04-03.md`
	- QA v2 deep-dive found 3 critical + 4 high + 4 medium issues; all 11 corrections applied to plan v3
	- Phases 1–8 ALL COMPLETE — backend, frontend, apps-template-mui, layout config UI, self-model, tests, docs
	- Full build passing: 28 successful, 0 failed; snapshot tests: 15/15 passing; unit tests: 274/274
	- QA Post-Implementation Fixes (2026-04-03):
		- [x] H1: E2E tampered hash test now uses 64-char fake hash to test integrity, not Zod length
		- [x] H2: Removed noop `enableRowReordering` toggle from LayoutDetails View Settings (Zod schema field kept for future DnD)
		- [x] M3: Added per-entity field count (200) and element count (10,000) validation to `validateSnapshotEnvelope`
		- [x] M4: File input in ImportSnapshotDialog now resets on close via `useRef`
	- Self-Model E2E (2026-04-03):
		- [x] Created `self-model-metahub-export.spec.ts` — creates 9 catalogs with 27 attributes, publication, version, screenshots, exports to fixture
		- [x] Fixed codename JSONB/VLC format in all E2E specs (createMetahub, catalogs, attributes, publication, version)
		- [x] Fixture saved: `tools/fixtures/self-model-metahub-snapshot.json` (62 KB, 13 entities)
		- [x] 3 screenshots in `test-results/self-model/`
	- Remaining QA Findings (2026-04-03):
		- [x] F2: Import endpoint VLC format fix — replaced `buildLocalizedContent` with `ensureVLC` in `importFromSnapshot`
		- [x] F1: E2E toolbar dropdown selector fixed — `toolbar-primary-action-menu-trigger` (matches actual data-testid)
	- QA v3 Hardening Fixes (2026-04-03):
		- [x] C1: Fixed VLC format incompatibility — import now uses `ensureVLC()` instead of `buildLocalizedContent()` for name/description/publication
		- [x] H1+H2: Added `log.warn()` for unmapped hub references and silent cross-reference nullification in SnapshotRestoreService
		- [x] H3: `defaultLayoutId` confirmed as false positive — snapshot is self-consistent with original IDs
		- [x] H4: `enableRowReordering` intentionally kept as future DnD placeholder (previous QA decision)
		- [x] M1: Tightened Zod snapshot schema — explicit optional fields for known snapshot structure, passthrough kept for forward compatibility
		- [x] M2: Server-side `Content-Length` check added as defense-in-depth in import route (Express body parser also enforces global limit)
		- [x] L1: i18n keys confirmed already present (`export.exportVersion`, `export.exportMetahub` etc.)
		- [x] C2: Added 7 unit tests for import/export routes (401, 400, hash mismatch, 201 happy path, export 401/404/400)
		- [x] M5: Created SnapshotRestoreService.test.ts with 6 unit tests (entities, hub remap, constants, layouts, orphan skip, empty snapshot)
		- [x] M3: Fixed E2E snapshot spec — selector mismatch + import response ID extraction
	- Full build: 28/28 passing; metahubs-backend: 47 suites, 421 tests; utils: 274 tests
	- Generators Architecture (2026-04-03):
		- [x] Created `specs/generators/` folder and moved `self-model-metahub-export.spec.ts` from `specs/flows/`
		- [x] Added `generators` project to `playwright.config.mjs` (dedicated `testMatch`, isolated from `chromium` via `testIgnore`)
		- [x] Updated `package.json`: `test:e2e:full` explicitly lists non-generator projects; added `test:e2e:generators` script
		- [x] Documented Snapshot Generators section in both E2E READMEs (EN + RU, 331/331 lines parity)

## Current Wave Notes — 2026-04-03
- The repository currently runs the root build through Turbo, but `turbo.json` still uses the legacy `pipeline` key and explicitly disables cache for `build`, so Turbo acts mostly as an orchestrator instead of a cache accelerator.
- The installed Turbo version is `1.10.16`, while the current stable line is `2.9.3`; the migration must therefore cover both behavior and configuration format changes.
- The package inventory confirms one special-case override is needed for `packages/apps-template-mui`, whose `build` script is `tsc --noEmit` and should not inherit artifact outputs from the root build task.
- CI currently caches PNPM dependencies but does not expose any `TURBO_*` remote-cache environment, so remote cache support can be wired safely through optional GitHub secrets without forcing it on contributors.
- The migration must keep full-build safety first: no pre-release Turbo flags, no speculative package-level overrides, and no weakening of environment correctness just to chase cache hits.
## Current Wave Notes — 2026-04-02
- User-provided screenshots show remaining oversized side gutters on metahub settings and metahub layout details after a clean rebuild.
- The first confirmed offender is `packages/metahubs-frontend/base/src/domains/layouts/ui/LayoutDetails.tsx`, which still wraps header and content in ad hoc horizontal padding instead of the shared contract.
- The final root cause was split between one local layout-details wrapper and the shared tab-bar contract: settings content already widened via `PAGE_CONTENT_GUTTER_MX`, but `PAGE_TAB_BAR_SX` still left tab rows 16px narrower than the content below.
- The follow-up closure updated the shared tab-bar contract, fixed the admin test to use the real instance settings route, and revalidated with `pnpm run build:e2e`, targeted Playwright flows, and a full `pnpm build`.
- The layouts detail page needed one extra follow-up: the shared MUI surfaces theme applies `padding: 16px` to every `MuiCard`, so `LayoutDetails` still rendered 16px narrower than the already-correct layouts list until the page locally zeroed card `p` and `gap`.
## Recently Completed Work (Compact)
## Unified Page Padding Remediation — 2026-04-02
> Status: COMPLETE — the shared page-spacing contract is now the canonical non-list layout rule.
- [x] Added `PAGE_CONTENT_GUTTER_MX` and `PAGE_TAB_BAR_SX` to `@universo/template-mui`.
- [x] Migrated the known drifted pages in admin, applications, and metahubs frontends.
- [x] Removed ad hoc tab/content padding that made settings and migration pages narrower than their sibling screens.
- [x] Captured before/after screenshots for visual verification.
- [x] Revalidated via full build and the latest green E2E suite.
## Manual Playwright Artifact Capture Documentation — 2026-04-02
> Status: COMPLETE — screenshot/video capture is documented and mirrored in both E2E READMEs.
- [x] Documented manual screenshot capture and artifact locations in `tools/testing/e2e/README.md`.
- [x] Mirrored the same content in `tools/testing/e2e/README-RU.md`.
- [x] Recorded a real `.webm` demo artifact for manual review.
- [x] Rechecked README parity after the update.
## E2E Guard Loading-Shell Flake Fix — 2026-04-02
> Status: COMPLETE — direct navigation to `/metahubs` no longer flakes on the transient migration-guard shell.
- [x] Isolated the real failure from noisy cleanup logs.
- [x] Reused the existing guarded-route wait pattern instead of introducing a new timing hack.
- [x] Patched both affected specs that asserted the final heading too early.
- [x] Revalidated with a targeted Playwright rerun.
## E2E Hardening Follow-up Closure — 2026-04-02
> Status: COMPLETE — the final helper and backend timing races are closed; the browser suite is green.
- [x] Moved publication/application metadata creation for combined bootstrap into a committed pool transaction visible to DDL callbacks.
- [x] Reused committed compensation cleanup so rollback paths no longer depend on uncommitted request state.
- [x] Updated publication route tests for the committed metadata transaction and RLS reapplication path.
- [x] Replaced the last fragile publication persistence poll with response-id-based or persisted-state confirmation.
- [x] Hardened the remaining metahub create flow against optimistic `waitForResponse(...)` races.
- [x] Fixed admin access smoke locator ambiguity and the constant-edit dialog regression discovered by the full rerun.
- [x] Extended matrix coverage to Russian and dark-theme authenticated surfaces.
- [x] Revalidated publication variants, restart-safe behavior, diagnostics, codename UX, metahub create options, limits info-state, and workspace isolation.
- [x] Reran the full E2E suite to a green state.
## Extended Playwright Coverage, Restart-Safe Validation, And Diagnostics — 2026-04-02
> Status: COMPLETE — the acceptance surface now covers more real product behavior without introducing test-only UI.
- [x] Added locale/theme matrix coverage for Russian and dark mode.
- [x] Added restart-safe fresh-db validation with sequential starts.
- [x] Added bounded browser diagnostics for long-lived dialogs.
- [x] Added browser coverage for publication variants, metahub create options, codename autofill/reset, and dialog regressions.
- [x] Added application limits pre-schema info-state and workspace-isolation browser coverage.
- [x] Refreshed docs and memory-bank state to the validated inventory.
## Playwright Route-Surface Completion — 2026-04-02
> Status: COMPLETE — the planned board, connector, runtime, and route-surface coverage is complete.
- [x] Covered the remaining application/admin/metahub routes through existing UI surfaces.
- [x] Stabilized linked-application setup without masking real errors.
- [x] Added board-level coverage for backend-driven counters.
- [x] Added connector, migration-history, and runtime-row browser scenarios.
- [x] Refreshed route-inventory documentation after the validation pass.
## Full Business Scenario Playwright Coverage — 2026-04-01
> Status: COMPLETE — the browser-testing foundation now covers the planned scenario matrix.
- [x] Closed the flaky metahub list/browser contract after create-copy-delete.
- [x] Expanded helpers and manifest tracking for admin, locales, publications, applications, and cleanup.
- [x] Added admin smoke/RBAC/global-user coverage.
- [x] Added metahub/application board, members, access, connectors, runtime rows, settings, publication, and chained-flow coverage.
- [x] Added the publishable-key alias needed for modern Supabase configuration compatibility.
- [x] Updated README and docs to the expanded workflow.
## Supabase JWT/JWKS Compatibility Remediation — 2026-04-01
> Status: COMPLETE — backend auth and RLS now support both legacy HS256 and modern Supabase JWKS projects.
- [x] Replaced symmetric-only verification with dual-mode JWT verification.
- [x] Updated startup validation to accept JWKS-backed projects.
- [x] Preserved backward compatibility for existing secret-based environments.
- [x] Fixed the `ensureAuthWithRls` aborted-request lifecycle race.
- [x] Updated docs and env examples for the new contract.
- [x] Revalidated with focused tests, build, and browser suites.
## E2E Browser Testing QA Remediation — 2026-03-31
> Status: COMPLETE — the browser-testing stack is now cleanup-safe, portable, and validated end-to-end.
- [x] Made cleanup retain recovery state on partial teardown.
- [x] Separated backend-only env loading from frontend e2e overrides.
- [x] Pinned runner/runtime behavior for safer repeated execution.
- [x] Switched the default e2e persona to a least-privilege role where possible.
- [x] Added reviewed visual baselines and an explicit snapshot-update workflow.
- [x] Closed the remaining QA debt in docs and memory-bank state.
## QA Audit Remediation: Test Coverage & TypeORM Cleanup — 2026-04-03
> Status: COMPLETE — route coverage gaps and residual TypeORM comments were closed.
- [x] Added admin-backend route tests for settings, instances, locales/public locales, and roles.
- [x] Added metahubs-backend public route coverage for the public metahub hierarchy.
- [x] Removed residual TypeORM comments from touched source files.
- [x] Revalidated admin-backend, metahubs-backend, and the root build.
## Deep Domain Error Cleanup & Hardening — 2026-04-03
> Status: COMPLETE — remaining domain-error, response-shape, and cleanup debt is closed.
- [x] Converted remaining generic service errors to typed domain errors.
- [x] Unified handler response details at the root error payload level.
- [x] Removed duplicate error guards and stale helper code.
- [x] Updated affected route/service/helper tests to the canonical contract.
- [x] Revalidated with build, Jest, and Vitest.
## Late-March Technical Closure Summary — 2026-03-31 To 2026-03-24
## Late-March Technical Closure Summary — 2026-03-31 To 2026-03-24
> Status: COMPLETE — detailed implementation logs from the late-March closures were moved to progress.md.
### QA And Refactoring
- [x] Closed the comprehensive QA fix wave across bugs, architecture debt, public routes, and dead code.
- [x] Finished the metahubs/applications 9-phase refactor and the related follow-up QA passes.
- [x] Added direct coverage for shared abstractions such as `createMetahubHandler`, `useListDialogs`, and error guards.
- [x] Details: progress.md#2026-04-01-comprehensive-qa-fix--all-16-issues-resolved
- [x] Details: progress.md#2026-03-30-metahubs--applications-refactoring--all-9-phases-complete
### Security And Dependency Hardening
- [x] Replaced deprecated `csurf` with the local CSRF middleware.
- [x] Closed the late-March dependency/CVE hardening waves.
- [x] Reduced dead dependency and override noise in the workspace.
- [x] Details: progress.md#2026-03-28-comprehensive-cleanup--csurf-replacement
- [x] Details: progress.md#2026-03-27-security-vulnerability-fixes-3-cves
### Codename JSONB Closure
- [x] Closed the codename JSONB/VLC convergence across fixed schemas, runtime metadata, backend routes, and touched frontend flows.
- [x] Fixed template seeding, copy flows, and admin role codename editing to obey the same canonical contract.
- [x] Details: progress.md#2026-03-24-codename-jsonb-final-contract-closure
- [x] Details: progress.md#2026-03-25-admin-role-codename-vlc-enablement
### Admin, Start, And Application Workspaces
- [x] Closed bootstrap-superuser startup and follow-up QA hardening.
- [x] Closed application workspaces/public-access follow-through around limits, breadcrumbs, seed propagation, and access rules.
- [x] Details: progress.md#2026-03-19-bootstrap-superuser-startup-closure
- [x] Details: progress.md#2026-03-19-application-workspaces-ux-breadcrumbs-seed-data-and-limits-closure
## Historical Archive — 2026-03-17 To 2026-03-11
> Status: ARCHIVED — durable detail for the older March closures now lives only in progress.md; keep this file focused on active and recent work.
