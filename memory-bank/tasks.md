# Tasks

> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## Current Task Ledger (Canonical)

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
	- Current status: complete; the fixture contract now exports `Enumerations` / `Перечисления` and `Sets` / `Наборы` through the canonical generator path, `ViewHeader` no longer applies negative gutter offsets, the runtime Create button and shared controls now share the same 40px height contract, geometry assertions were added to the affected Playwright flows, the real generator reran and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`, the targeted browser flows passed, and the canonical root `pnpm build` finished green.


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
	- Note: This pass is limited to the newly verified defects after another full rebuild, empty database reset, and fresh import of `tools/fixtures/metahubs-self-hosted-app-snapshot.json`: the imported metahub codename still gains noisy suffixes and loses the Russian locale variant, one repeated section still appears as `Enumeration Values` / `Значения перечислений`, the auto-created default `Main` entities still persist type-suffixed English codenames (`MainHub`, `MainCatalog`, `MainSet`, `MainEnumeration`), and the committed self-hosted fixture must be regenerated from the corrected generator contract.
	- Implementation order for the current session:
		- [x] Replace noisy imported metahub codename generation with canonical localized EN/RU codename derivation from the imported metahub name while keeping collision handling deterministic.
		- [x] Fix template-seeded default `Main` entity codename generation so the primary English codename is derived from the localized entity name instead of the raw template key suffix.
		- [x] Remove the extra `Enumeration Values` / `Значения перечислений` self-hosted top-level catalog contract and fail closed if the committed fixture drifts back.
		- [x] Regenerate `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the corrected Playwright generator and revalidate the touched flows.
	- Required outcomes:
		- [x] Imported self-hosted metahubs must use stable canonical metahub codenames derived from the localized metahub name, with both English and Russian codename locales and no timestamp/random noise on the normal path.
		- [x] Auto-created default `Main` entities must no longer store `MainHub` / `MainCatalog` / `MainSet` / `MainEnumeration` as the primary English codename when the localized entity name is already `Main`.
		- [x] The self-hosted fixture/generator contract must no longer create or tolerate a standalone `Enumeration Values` / `Значения перечислений` section.
		- [x] The committed self-hosted fixture must be regenerated from the corrected generator contract and stay aligned with the import/browser validation path.
	- Validation target: focused backend template/import tests, targeted self-hosted generator/import validation, regenerated fixture sanity checks, and the canonical root `pnpm build`.
	- Current status: complete; imported metahub codenames are now derived from the localized imported metahub name with deterministic `Imported` / `Импорт` suffixes only on real collisions, template seed execution and migration now normalize the primary English codename from localized `Main` names instead of raw `MainHub`/`MainCatalog` keys, the self-hosted contract rejects the deprecated standalone `Enumeration Values` catalog plus legacy type-suffixed `Main*` codenames, the real Playwright generator reran and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json` with 11 canonical sections, the regenerated fixture no longer contains the legacy markers, the targeted browser import flow passed, and the final root `pnpm build` finished green.

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
		- [x] The committed self-hosted fixture must contain exactly one canonical menu widget in the default layout (`Catalogs` / `Каталоги`), without the duplicate `Main` / `Основное` menu.
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
		- [x] Ensure automatically created default `Main`/`Основной` entities seed Russian codename locales alongside English ones where the product already seeds EN/RU names.
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

> Status: ARCHIVED AS RECENT HISTORY — keep these closures discoverable while avoiding verbose notes in the active ledger.

### Platform System Attributes And Snapshot Integrity — 2026-03-17

- [x] Added platform-governed `_upl_*` catalog system attributes through one shared backend policy seam.
- [x] Routed catalog system views through dedicated `/system` pages.
- [x] Hydrated publication `systemFields` back into executable release-bundle payloads.
- [x] Kept publication snapshot hashing parity-safe across producer and consumer packages.
- [x] Disabled stale placeholder reuse on scoped tab switches.

### Admin Roles / Metapanel Revalidation — 2026-03-17

- [x] Confirmed `AbilityContext.refreshAbility()` as the real role-refresh contract.
- [x] Confirmed onboarding completion must move to the final CTA.
- [x] Confirmed `/start` plus a root resolver are both required in the live routing topology.
- [x] Confirmed menu filtering must operate at section level, not only on `rootMenuItems`.
- [x] Promoted metapanel/admin stats to a dedicated shared dashboard contract.

### Start System App Hardening — 2026-03-16 To 2026-03-15

- [x] Kept generated-table-dependent support migrations in `post_schema_generation`.
- [x] Fixed clean-bootstrap ordering for start-system support migrations.
- [x] Converged the start/onboarding system app onto the application-like fixed-schema model.
- [x] Closed branding/env cleanup tied to the start-system wave.
- [x] Revalidated startup behavior on a fresh environment.

### Unified Database Access Standardization — 2026-03-14

- [x] Standardized backend DB access around Tier 1 request-scoped executors, Tier 2 pool executors, and Tier 3 explicit DDL boundaries.
- [x] Added `tools/lint-db-access.mjs` as the enforcement gate.
- [x] Moved raw Knex access behind dedicated DDL boundaries where required.
- [x] Hardened identifier handling and optimistic-lock helpers.
- [x] Synced docs and memory-bank notes to the SQL-first contract.

### Optional Global Catalog And Definition Lifecycle — 2026-03-13

- [x] Supported catalog-enabled and catalog-disabled modes without forcing full registry bootstrap on every startup.
- [x] Kept local `_app_migrations` / `_mhb_migrations` history canonical.
- [x] Recorded deterministic fixed-system baselines and safe backfill behavior.
- [x] Routed active imports through the real draft-review-publish lifecycle.
- [x] Treated active published revision exports as healthy in doctor checks.
- [x] Recorded bundle-style exports in the same lifecycle ledger.
- [x] Made no-op detection dependency-aware, not checksum-only.
- [x] Restored browser env precedence and managed owner-id validation contracts.

### Metahub QA And Repeated-Start Stability — 2026-03-13

- [x] Fixed shared-table sorting/filtering regressions.
- [x] Restored active-row filtering across touched metahub runtime reads and stats paths.
- [x] Revalidated repeated-start behavior for fixed-system snapshots.
- [x] Closed final delete-cascade and soft-delete parity defects.
- [x] Kept focused validation green after each reopen closure.

### System-App Structural Convergence — 2026-03-12

- [x] Converged admin, profile, metahubs, and applications fixed schemas onto the application-like contract.
- [x] Moved fixed-system business-table creation to definition-driven schema generation.
- [x] Removed the legacy applications reconcile migration from the active manifest path.
- [x] Added shared active-row and soft-delete helper contracts.
- [x] Targeted converged `cat_*`, `cfg_*`, `doc_*`, and `rel_*` tables in touched persistence helpers.

### Frontend Acceptance Coverage Burst — 2026-03-12

- [x] Added page-level CRUD acceptance coverage for applications, metahubs, connectors, and publication-linked flows.
- [x] Added sync-dialog and migration-guard acceptance coverage.
- [x] Added runtime-shell acceptance coverage for `ApplicationRuntime`.
- [x] Revalidated touched frontend packages and the root build.
- [x] Kept publication-to-application and control-panel navigation flows under direct coverage.

### Metadata, Compiler, And Bootstrap Foundation — 2026-03-12

- [x] Added fixed-system metadata bootstrap observability and CLI entry points.
- [x] Added doctor/startup fail-fast gates for incomplete metadata and leftover legacy table names.
- [x] Added forward-only reconciliation bridges for legacy fixed schemas.
- [x] Preserved explicit object/attribute metadata through compiler artifacts.
- [x] Revalidated touched backend/platform packages and the root build.

### Registry, Naming, And Runtime Ownership Foundation — 2026-03-11

- [x] Moved application runtime sync ownership into `@universo/applications-backend`.
- [x] Kept metahubs limited to publication runtime-source loading.
- [x] Replaced local branch/runtime naming with shared migrations-core helpers.
- [x] Strengthened bootstrap and doctor visibility around registry/export contracts.
- [x] Added deep acceptance proof for registry lifecycle and publication-driven runtime sync.
