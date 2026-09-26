# Unified Entity-backed Marketing Hero — IMPLEMENT (2026-09-23)

> Authoritative checklist for the QA-corrected plan at `memory-bank/plan/unified-entity-backed-widget-authoring-hero-pilot-plan-2026-09-22.md`. Preserve unrelated worktree changes. Clean break: no legacy Hero reads, DB migration, schema/template version bump, or `pnpm dev`.

-   [x] MHP-01 Preflight: preserved the pre-existing dirty tree, checked OntoIndex and direct source (including skipped large files), reviewed package runners/UX contracts/runtime write surfaces, and confirmed the E2E Supabase container is stopped.
-   [x] MHP-02 Added strict shared binding/slot contracts, bounded canonicalization, envelope preservation, registry presentation metadata and contract tests; targeted Vitest, types build, lint and Prettier pass.
-   [x] MHP-03 Fresh template seed: Hero Object/Components/default record; fixture contracts updated without changing schema/template versions.
-   [x] MHP-04 Trusted metahub placement select/create/rebind flows, live-binding policy and deadlock-safe transaction ordering.
-   [x] MHP-05 Application binding baseline, source sync/reset/hash/effective-layout/snapshot/copy restrictions.
-   [x] MHP-06 Bounded authenticated/public resolver using existing SQL-first stores and publication/read scopes.
-   [x] MHP-07 Generic runtime write denial for source-owned Hero; direct API bypasses covered.
-   [x] MHP-08 Reused existing metahub RecordList/DynamicEntityFormDialog and layout primitives for localized repeatable Hero authoring.
-   [x] MHP-09 Query invalidation, EN/RU resources and error mapping.
-   [x] MHP-10 Jest/Vitest and real-PostgreSQL coverage: types 230, utils 413, metahubs backend 1359, applications backend 1203, template-mui 303, metahubs frontend 429, applications frontend 332 tests; focused apps-template full suite 783/783.
-   [x] MHP-11 Minimum-Supabase Playwright flows: 17 passed, 1 expected standalone-runtime skip; locale/theme visual matrix 5 passed, with screenshots, responsive sizes, keyboard/a11y and overflow assertions.
-   [x] MHP-12 Updated fixtures, package READMEs, EN/RU GitBook docs and architecture contract; i18n, screenshot assets, local links and provenance gates pass.
-   [x] MHP-13 Targeted lint/build/Prettier pass; UI and focused snapshot Thermos reviews pass; both correctness and maintainability subagents report no findings. OntoIndex matched all 217 changed paths but its symbol check is inconclusive (694 symbols flagged because no explicit expected-symbol inventory was supplied; impact scan capped at 25). Full-tree Thermos timed out on the 1.08M-character dirty-worktree bundle. E2E Supabase stopped; ordinary local Supabase remains healthy.

# QA remediation — Unified Entity-backed Marketing Hero — IMPLEMENT (2026-09-24)

> Close the confirmed gaps from `memory-bank/plan/unified-entity-backed-widget-authoring-hero-pilot-qa-2026-09-23.md` while preserving the pre-existing dirty worktree. No schema/template version bump, legacy reader, `pnpm dev`, or unrelated cleanup.

## Current continuation action plan

-   [x] Revalidate the Hero text-layout correction with package typecheck, build, lint, and browser geometry assertions.
-   [x] Run the complete minimal-Supabase browser and documentation gates; inspect the generated EN/RU screenshots and record browser-visible evidence.
-   [x] Complete independent security, test-oracle, and maintainability reviews; apply and verify all reported findings; run available Thermos and OntoIndex checks; record the full-worktree Autoreview timeout and OntoIndex dirty-tree limits in progress.

-   [x] MHR-01 Fix long Hero title/accent flex behavior at tablet/mobile widths; add a real browser geometry and screenshot oracle for two long independently bound records.
-   [x] MHR-02 Reuse one typed, localized MarketingAction editor in both the specialized Hero dialog and generic Object record editor; ensure normal tables do not expose action JSON and test both edit paths.
-   [x] MHR-03 Replace manual internal route and anchor key entry with human-labelled, bounded choices from the host's current route/layout metadata; validate targets server-side and localize loading/empty/unavailable states.
-   [x] MHR-04 Make binding conflict recovery refresh authoritative widget/binding state, tell the user what changed, and allow a fresh save; test success/conflict/retry and query invalidation.
-   [x] MHR-05 Extend Playwright authoring to create a valid Hero record through the UI, bind it, publish and observe it; exercise rebind persistence and deletion denial/rebind flow, permissions, EN/RU, keyboard, and structured field display.
-   [x] MHR-06 Remove the extra marketing.hero-specific resolver/DTO branch from authenticated and public serialization by routing through the shared binding projection contract; keep typed renderer output and public field allowlists.
-   [x] MHR-07 Complete scalable, paginated/searchable Hero record selection and retain the selected record when it falls outside the current page.
-   [x] MHR-08 Finish EN/RU screenshot documentation, provenance validation, focused commands and CI wiring from Plan Phase 11; no shared EN screenshot on the RU page.
-   [x] MHR-09 Run focused package Jest/Vitest suites, package lint, Prettier, workspace builds, fresh minimal-Supabase Playwright and visual inspection; run Thermos reviewers and OntoIndex diff verification; update progress and this checklist with observed results. The full-worktree Autoreview timed out and is explicitly not counted as a pass.
-   [x] MHR-10 Require Entity bindings at complete metahub, template, snapshot, and application-source boundaries while allowing application-local renderer-only configs; cover strict and projection-only codec behavior plus valid service fixtures.

# Unified Entity-backed Marketing Hero — QA findings remediation (2026-09-24)

> Close the follow-up QA findings in the current dirty worktree. Preserve the established package boundaries, shared MUI primitives, Entity content ownership, and clean-break constraints; do not bump schema/template versions or add legacy readers.

## Phase A — Authoring contract and usability

-   [ ] MHR-QA-01 Open the selected Entity record form directly when editing an existing Hero placement; keep explicit select/create/rebind actions available and localized.
-   [ ] MHR-QA-02 Complete the neutral binding-slot metadata contract with serializable, localized selector labels/helper text and consume it in the authoring UI; centralize shared Hero entity identity and use the existing localized-value utility.

## Phase B — Public runtime and UX-oracle correctness

-   [ ] MHR-QA-03 Prevent unbound Hero records from exhausting the public runtime materialization cap while retaining bounded, allowlisted, published-only reads and fail-closed validation of each active binding.
-   [ ] MHR-QA-04 Make DataGrid technical-leakage assertions fail on unreadable grid content and add a regression test for read failures.

## Phase C — Browser acceptance

-   [ ] MHR-QA-05 Prove anonymous rendering of both authored Hero records after publish, verify a member without editContent cannot create/edit Hero content, exercise the complete edit/save/cancel/error path by keyboard, and assert visual output for edited Hero records.
-   [ ] MHR-QA-06 Verify successful EN/RU edits after switching locale in the same open form, with web-first assertions and isolated user-visible interactions.

## Phase D — Maintainability and closeout

-   [ ] MHR-QA-07 Extract newly added layout-copy controller logic and remove fragile AST-count assertions where behavior-level tests or a focused static contract provide stronger evidence.
-   [ ] MHR-QA-08 Run focused Jest/Vitest and ESLint, formatting, affected builds, minimal-Supabase Playwright and real-browser screenshot review; run Thermos and OntoIndex verification, then update progress with observed results and limitations.

# Architecture debt closure (fifth pass) — IMPLEMENT (2026-09-18)

> Closes the structural findings of the LQR3 maintainability review: unified 409 version-conflict contract (M2), shared field-map application in the marketing serialization module (M4), remaining advisory-lock hash-space families (M6), copyRow single-pass validation (M8), the missing guard/savepoint/ordering tests (M9), the `runtimeRowsController` helper extraction with a thin composition root and cycle-free imports (H1), and decomposition of the largest handler functions (H4). No schema/template version bump; disposable database.

## Phase A — Contracts and consistency

-   [x] LQR4-01 M2: every stale-version write returns the canonical `RUNTIME_RECORD_VERSION_CONFLICT` body via `createRuntimeVersionConflictFailure` (write handlers and child-rows controller), with tests updated.
-   [x] LQR4-02 M4: one parameterized field-map application lives in `marketingRuntimeSerialization` and both serializers use it (public keeps its record-field allowlist), with selector tests.
-   [x] LQR4-03 M6: the remaining advisory-lock families (application layout store, application alias store + its migration function, the two-key interpretation-network command lock) move to the shared `hashtextextended` helper space, with tests.
-   [x] LQR4-04 M8: `copyRow` validates its source once (no duplicate pre-transaction/in-transaction pass) or documents the fail-fast duplicate explicitly.

## Phase B — Missing tests (M9)

-   [x] LQR4-05 Direct tests for `assertMarketingSeedRows` (row limit, case-insensitive unique collision) and for the workspace seed path.
-   [x] LQR4-06 Contract tests that write/command handlers run inside `withTransactionSavepoint` (savepoint wiring) and that `afterCopy` dispatches before the 201 response.

## Phase C — Controller helper extraction (H1)

-   [x] LQR4-07 Extract the ~4.4k lines of module-level helpers from `runtimeRowsController.ts` into `controllers/runtimeRowSupport/*` (contracts, access, objects, union, validation, menu) with public re-exports for existing importers; the controller becomes a thin composition root and the handler modules no longer import from it (cycles removed).

## Phase D — Handler decomposition (H4)

-   [x] LQR4-08 Decompose the largest handlers (`getRuntime`, `bulkUpdateRow`, `createRow`, `copyRow`, `updateContentProgress`, `setLibraryRelation`) into named step functions with no behavior change.

## Phase E — Verification

-   [x] LQR4-09 Prettier, lint, build, focused unit/real-PG suites for every changed package.
-   [x] LQR4-10 Minimal local Supabase: fixture untouched, Meridian runtime, chromium batch, matrix, docs gates; Supabase stopped.
-   [x] LQR4-11 Independent verification subagents + Thermos review; memory bank updated, backlog empty for this scope.

# Consortium footer contacts restore (seventh pass) — IMPLEMENT (2026-09-19)

> Restores the approved Consortium footer content: the Communities group with the Telegram channel `t.me/meridian73omsk`, and the Contacts group with the verified email `igor_glushkov@mail.ru` and phone `+7-913-602-21-53`. The removed demo destinations (VK, MAX, 2GIS, the placeholder phone and the old Telegram handle) stay forbidden and are asserted as absent. Fixture, contract, provenance, browser proof and docs are updated together.

## Phase A — Content and contract

-   [x] LQR6-01 Re-add `MERIDIAN_73_FOOTER_LINKS` with the Communities (Telegram) and Contacts (email/phone) groups; generator seeds them again and clears nothing.
-   [x] LQR6-02 Contract: positive assertions for the approved hrefs/labels and negative assertions for every removed demo destination; provenance records the verified destinations.

## Phase B — Fixture and browser proof

-   [x] LQR6-03 Regenerate the tracked fixture and the artifact copy; contract + drift gates green.
-   [x] LQR6-04 Meridian browser spec asserts the footer links (href + label) and still rejects the removed demo destinations; targeted local-Supabase run green.

## Phase C — Docs and verification

-   [x] LQR6-05 EN/RU docs describe the restored footer groups; Prettier/lint/build/unit gates and the final memory-bank update.

# QA remediation + full E2E refresh (sixth pass) — IMPLEMENT (2026-09-18)

> Closes the QA findings: anonymous visitors of a closed/unknown `/a/<ref>` are redirected to the login page (uniform for every unavailable ref, so no resource enumeration); the unavailable copy becomes neutral; Consortium demo contacts are removed; the Features renderer stops falling back to MUI demo screenshots; the Slugs admin page and the shared SettingsDialog follow the canonical MUI primitives; brand logo gets validation, fallback and browser proof; guest error echo, marketing runtime row cap, alias integration CI wiring and the copy/update deadlock order are fixed; platform docs describe the new behavior; the stale full Chromium suite is refreshed.

## Phase A — Product behavior

-   [x] LQR5-01 Anonymous `/a/<ref>` for every unavailable reference redirects to `/auth` with the preserved `from` location; the public-unavailable page remains only for authenticated non-members and loses the misleading "public" wording (EN/RU) and the sign-in action.
-   [x] LQR5-02 Update unit tests (`ApplicationRuntime.entry`, `ApplicationRuntime.public`) and the Meridian E2E: synthetic/closed refs now assert the login redirect; retryable network failures stay on the page; add a real public→closed browser scenario.
-   [x] LQR5-03 Remove the unverified Consortium contact destinations (Telegram/VK/MAX/phone/2GIS) from the content module, fixture and contract; regenerate the fixture, refresh provenance, keep nav anchors consistent.
-   [x] LQR5-04 Features without authored media render icon-only cards: remove the MUI demo-screenshot fallback and update the affected tests/baselines.

## Phase B — Slugs admin UI (canonical primitives)

-   [x] LQR5-05 Remove the Slugs page description; short primary action via common `addNew`; update E2E/unit expectations.
-   [x] LQR5-06 Move the released-addresses filter into the gear settings dialog (usable by non-superusers with the alias ability) and fix the shared `SettingsDialog` footer inset to the canonical dialog footer.
-   [x] LQR5-07 Reuse the canonical searchable-select pattern (popup icon, styled popper, density, option rendering) in the public-address dialog; add focused tests.

## Phase C — Brand logo

-   [x] LQR5-08 Brand-logo URL validation with a localized message, name fallback when the image fails, and footer accessible name.
-   [x] LQR5-09 Browser proof: configured logo renders as an `<img>` in header and footer (authoring spec), plus unit coverage for validation and fallback.

## Phase D — Security, data integrity, CI

-   [x] LQR5-10 Guest client-bundle/module endpoints validate identifiers and stop echoing raw database errors to anonymous clients; add a redaction test.
-   [x] LQR5-11 Enforce the published marketing row cap on runtime create/copy/restore for marketing objects (no content-DoS via the authenticated surface); tests.
-   [x] LQR5-12 Run the application-alias real-PG integration suites in CI alongside the records integration; add the runner wiring.
-   [x] LQR5-13 Copy takes the record-rule advisory lock before the source-row `FOR UPDATE`, removing the copy/update deadlock order; order test.

## Phase E — Documentation

-   [x] LQR5-14 Update EN/RU platform docs (public applications and aliases, marketing-page template) for the login-redirect behavior, brand logo setup and row caps.

## Phase F — Full Chromium refresh

-   [x] LQR5-15 Refresh the stale Chromium flow suite against the current UI: fix outdated contracts/selectors/locales, triage the suspicious failures, update visual baselines; full run green (or product bugs fixed).

### LQR5-15 Batch B — stale Chromium specs against the current UI (2026-09-18)

> Failure evidence: `/tmp/opencode/l5-chromium-full.log` (45 failed / 58 passed). Meridian and application-aliases specs are owned by other batches.

-   [x] admin-rbac-management: strict `getByText('Local')` collision → assert the seeded local-instance description instead.
-   [x] boards-overview: metahub board card id `hubs` → `treeEntities`; `entityCounts.objectCollection` → `entityCounts.object`.
-   [x] codename-mode: confirm the shared discard-changes dialog after cancelling entity forms (2 tests).
-   [x] metahub-basic-pages-ux: confirm the RU discard-changes dialog after cancelling the Page dialog.
-   [x] metahub-1c-compatible-template: confirm the RU discard-changes dialog after cancelling 1C entity dialogs (2 helpers).
-   [x] metahub-layouts: Resources defaults to Packages; click the Layouts tab before asserting selection.
-   [x] metahub-settings: `entity.objectCollection.allowAttributeDelete` renamed to `entity.object.allowComponentDelete`.
-   [x] metahub-shared-common: layout PATCH now requires `expectedVersion`; embedded-controls assertion only valid on shared tabs.
-   [x] metahub-entity-dialog-regressions: component copy dialog title is now "Copying component".
-   [x] metahub-packages-resources: scope the mutation error to the settings dialog (snackbar duplicate caused strict violation).
-   [x] metahub-entity-resources: standard object preset `kindKey` is now `object`.
-   [x] visual/metahub-entities-dialog: select the Objects preset by anchored name; Kind key `object`.
-   [x] visual/metahub-create-dialog: report baseline regeneration (dialog height changed 596→622 px); no spec logic change.
-   [x] Batch B verification: `npx prettier --write` on every edited file; no Playwright run (single-runner rule).
-   [x] Batch B round 2 (full-suite re-run evidence `/tmp/opencode/l5-chromium-full2.log`): `metahub-basic-pages-ux` Page row menu now exposes the intentional "Open" action → assertion expects `[Open, Edit, Copy, Delete]` (matches `EntityInstanceList.test.tsx`); `metahub-entity-resources` edit dialog field label `Kind key` renamed to `System type key` (`entities.fields.kindKey`), disabled-state assertion updated; `metahub-shared-common` finished the optimistic-lock contract (zone-widget DELETE now sends `?expectedVersion=widget.version`) and the runtime side-menu helper now targets the rendered `link` items instead of buttons.
-   [x] Batch B round 3 (re-run evidence `/tmp/opencode/l5-chromium-full3.log`): `metahub-basic-pages-ux` Page↔Object row-menu icon parity compares the shared CRUD tail (`slice(1)`) because Object rows have no "Open" content action (their data-schema surface replaces the content page); Page's exact four-item order stays pinned by `toHaveText` and the Object menu is still verified by deep equality.

-   [x] LQR5-16 Verification: Prettier/lint/build, unit suites, real-PG (records + aliases), Meridian + aliases + authoring E2E, matrix, independent subagent reviews, memory bank updated.

# Landing QA remediation (fourth pass) — IMPLEMENT (2026-09-18)

> Closes the third QA report: pricing benefits data loss (`maxItems` slicing of child collections), the plan-required unavailable-state actions (localized Home + user-initiated Sign in, no auto-redirect), brand name/logo configuration end to end, localized and truthful discard-changes handling, record reorder that reaches the published runtime, plus data-integrity, CI and architecture follow-ups (shared marketing serialization, `runtimeRowsController` split, runtime rule i18n dictionary, unified advisory-lock helper, atomic workspace seed reset, degrade-instead-of-404 public runtime, SSRF regression test). No schema/template version bump; disposable database; fixture regenerated only through the authoring flow.

## Phase A — Marketing serialization (R1) and pricing benefits

-   [x] LQR3-01 Extract the duplicated marketing runtime serialization helpers into one shared service module used by the public serializer and the authenticated runtime controller (localized maps, numeric price, safe semantic keys, record limits) with one locale normalization.
-   [x] LQR3-02 Pricing benefits are never sliced by the tier `maxItems`: benefits of the included tiers reach both payloads bound only by the marketing record limit, in both serializers; unit tests prove 3 tiers x 5 benefits with `maxItems: 3`, the runtime spec asserts five benefit labels per stage, and the authenticated controller suite joins the landing gate.
-   [x] LQR3-03 The pricing/cluster `maxItems` semantics are explicit: dialog helper text (EN/RU) states the limit applies to the widget's own records, and the shared module documents the child-collection policy.

## Phase B — Public unavailable state (plan parity)

-   [x] LQR3-04 The unavailable public screen renders localized Home and user-initiated Sign in actions for every unavailable reference (unknown/private/deleted/unready) without auto-redirecting or disclosing existence; the pinning unit tests and the Meridian flow assertions are updated.

## Phase C — Brand configuration

-   [x] LQR3-05 The `marketing.brand` widget accepts optional `brandName` and `brandLogo` (media URL) in authoring/public schemas, config dialog, serializer override and renderer; when a brand is configured the demo Sitemark fallback is gone (logo media or brand name renders), and the footer uses the same projection.
-   [x] LQR3-06 Brand configuration is proven end to end: widget dialog save, serializer override tests, component tests (configured logo vs name fallback), and a browser assertion on the Consortium page.

## Phase D — Discard changes dialog

-   [x] LQR3-07 `EntityFormDialog` uses the localized `common:unsavedChanges.*` defaults, treats pristine forms (including auto-initialized VLC/internal fields) as unchanged, and the auto-init `onChange` loops are memoized; tests cover pristine close, a real edit, and the RU rendering.
-   [x] LQR3-08 The same discard contract is verified for the other shared dialogs (record/component/application editors) with focused component tests, and the i18n gate flags hardcoded discard defaults if feasible.

## Phase E — Record reorder reaches the runtime

-   [x] LQR3-09 Record reordering persists both the row order and the `SortOrder` component value (per locked object) so the published/runtime order follows the drag; real-PG and unit tests pin the contract.
-   [x] LQR3-10 The record list surfaces the effective order and the widget/appearance surfaces link to the source records, so an author can find where content (directions, FAQ, tiers) is edited.

## Phase F — Data integrity and resilience

-   [x] LQR3-11 Workspace seed reset is atomic under request-scoped executors: a failed reset rolls back instead of leaving the workspace without seed content.
-   [x] LQR3-12 The public serializer degrades on incomplete records (skip with diagnostics) instead of 404-ing the whole page; marketing runtime row limits are enforced/warned at write time so oversized collections cannot silently break publication.
-   [x] LQR3-13 Seed/import paths enforce the unique-key contract, and the TABLE child-row identity policy is either made stable or explicitly documented with a regression test.

## Phase G — Architecture (R2)

-   [x] LQR3-14 `runtimeRowsController.ts` (~9.8k lines) is split into focused read/write/command modules with shared helper extraction, no behavior change, verified by builds and the full applications-backend suite.

## Phase H — Hygiene and gates (R3, R4, R6)

-   [x] LQR3-15 Runtime rule error messages live in the apps i18n bundles with an EN/RU parity test; the i18n gate understands shared dialog prop defaults.
-   [x] LQR3-16 The advisory-lock helper is unified (`hashtextextended`) behind one shared utility with migrated call sites and tests.
-   [x] LQR3-17 CI runs the Meridian runtime browser spec and the SSRF regression test on the local Supabase job; the React Router major migration and the flaky INW suite are tracked in the backlog; LOW hygiene items (decodeURI guard, dead dependencies) are closed.

## Phase A (follow-up) — Pricing width

-   [x] LQR3-21 The Consortium pricing section uses the base layout width (`cardWidth: 'auto'`) so the three cards stop wider than the header bar, while the `full` option stays available in the widget settings; generator/contract/flow/provenance and the regenerated fixture updated.

## Phase I — Verification

-   [x] LQR3-18 Prettier, `git diff --check`, lint, build and the full focused unit/real-PG suites for every changed package.
-   [x] LQR3-19 Minimal local Supabase: fixture untouched/revalidated, contract/drift gates, Meridian runtime, marketing chromium batch and matrix with inspected screenshots; Supabase stopped.
-   [x] LQR3-20 Independent verification subagents and Thermos review; memory bank updated without leaving debt.

## Backlog (tracked follow-ups)

-   [ ] Move the shared `SettingsDialog` onto `StandardDialog` and export one `dialogActionsSx` from `dialogPresentation` so every dialog footer keeps the canonical inset from a single source (unit test for the inset).
-   [ ] Extract a reusable `SearchableSelect` into `template-mui` and reuse it in `ApplicationAliasDialog`, `TargetEntitySelector`, and `RecordList` instead of three copied Autocomplete stylings.
-   [ ] Add `applicationAliasesQueryKeys.options(search, locale)` and replace the literal query key in `ApplicationAliases.tsx`.
-   [ ] Guard `attachedToKind` in `runtimeGuestController` with an explicit enum check instead of `as never`.
-   [ ] Split the remaining large files when touched next: `runtimeGuestController.ts` (~1.9k), `NavbarBreadcrumbs.tsx` segment parser, `PlayCanvasCanvasWidget.tsx` (~940), `QuizWidget.tsx` (~745).
-   [ ] Add the `PlayCanvasCanvasWidget` scene-latch unit test (transient readiness must not recreate the scene/realtime session) and route-level marketing-cap assertions for create/copy/restore (helper and module API are covered).
-   [ ] Add a concurrent real-PG test for the marketing row cap (two writers at the limit) and assert the `/auth` redirect `from` state in the entry test.
-   [ ] One-off data repair for "with materials" templates saved before the matrix cellId fix (their `Material.CellId` no longer matches the template rows and instantiation fails closed with 409).
-   [ ] Align RU plural `_other` keys with `_one/_few/_many` ordering in the applications bundle (cosmetic i18n hygiene).

-   [ ] Refresh the stale full-suite Chromium specs
-   [ ] Migrate the application-alias advisory-lock pair (`applicationAliasesStore` + the published `applications.create_application_alias` function) to the shared `hashtextextended` space through a new versioned migration instead of editing the immutable one.
-   [ ] Copy/update deadlock ordering: `copyRow` takes the source row `FOR UPDATE` before the record-rule advisory lock while update paths take the advisory first; align the order or map deadlocks (`40P01`) to a retryable 409.
-   [ ] Break the residual layer inversion `objects.ts -> menu.ts` (`resolveRuntimeObjectCollectionConfig` resolves an effective layout) and split `access.ts` (guards vs access/library) and `contracts.ts` (schemas vs behavior) when those modules grow again.
-   [ ] Trim over-exported internals in `runtimeRowSupport/*` and add a dead-export gate (`knip` or `import/no-unused-modules`) once the module surface stabilizes. against the current UI (45 pre-existing failures, e.g. `application-runtime-rows.spec.ts` waited for POST `/runtime/rows` while the UI has called `/runtime/rows/{id}/copy` since HEAD; that one spec is fixed). The full-suite pass status predates LQR2/LQR3 UI changes and must be refreshed with an explicit local-Supabase full run; CI does not run the full suite.

-   [x] Extract the remaining module-level helper block (~4.4k lines) from `runtimeRowsController.ts` into `controllers/runtimeRowSupport/*` and make the controller a thin composition root (<100 lines); add a cycle gate (`dependency-cruiser`/`madge`) to CI. The read/write/command handler split, the shared savepoint helper and the neutral seed guard are complete.
-   [x] Decompose the largest handler functions (getRuntime ~1170, bulkUpdateRow ~620, createRow ~580, copyRow ~560, updateContentProgress ~345) into step functions/services.
-   [x] Unify the 409 version-conflict body through `createRuntimeVersionConflictFailure` in copy/create/delete/restore and command handlers; remove the `copyRow` double validation pass or document it.
-   [x] Share the field-map application between both serializers (public allowlist vs controller schema) in `marketingRuntimeSerialization`; add selector tests with fieldMap/recordKey combinations.
-   [x] Migrate the remaining `hashtext` lock families (layout store, application-alias store, two-key INW command lock) to the shared hash space or document them as explicit exceptions with a grep gate.
-   [ ] Remove the `backend exploded` test-literal pattern from production `INTERNAL_ERROR_PATTERNS`; replace test fixtures with realistic technical messages.
-   [x] Add direct tests for `assertMarketingSeedRows` (workspace path, case-insensitive collision) and for the savepoint rollback of command handlers' partial ledger writes.

-   [ ] Migrate the remaining subsystem-local advisory locks (`interpretationNetworkStructureModeGuard`, interpretation-network relation locks, application-alias store) to the shared `acquireAdvisoryXactLock` hash space; the two-key INW lock needs an extended helper.
-   [ ] React Router major-version migration (plan 2026-09-15, deferred): currently on patched `react-router-dom@6.30.6` + `@remix-run/router@1.23.4`.
-   [ ] Flaky interpretation-network workspace browser suite under load (known timeouts identical to HEAD); needs a stability pass (worker isolation or fake-timer cleanup).
-   [ ] Split the remaining module-level helper block in `runtimeRowsController.ts` (~4.4k lines) into `runtimeRowAccess`/`runtimeRowObjects`/`runtimeRecordsUnion` modules; the read/write/command handler split is complete.

# Landing QA remediation (third pass) — IMPLEMENT (2026-09-17)

> Closes the third QA report: pricing width (missing upstream `width:'100%'` plus a new `cardWidth` setting with `full` for the Consortium and richer stage content), the theme switcher enabled in the Consortium configuration, the missing inheritance badge for shared widgets, the Features fixed-height card overlap, the FAQ answer width, runtime-path uniqueness/pattern enforcement, REF target validation, residual raw error surfaces, CI coverage and the related hygiene items. No schema/template version bump, disposable database, fixture regenerated only through the authoring flow.

**Status (2026-09-17):** all phases complete and independently verified. Evidence: focus unit suites (utils 382, types 216, apps-template-mui marketing 75 incl. runtime errors/rows, template-mui dialog 13, applications-frontend 314, admin-frontend 14, metahubs-frontend 410, apps-backend 1007, metahubs-backend 1308), real-PostgreSQL records 13/13 (incl. the regression proving a 409 duplicate/dangling update persists nothing), browser: meridian runtime 2/2 (geometry + theme reload), marketing chromium batch 16/16, visual matrix 5/5 with inspected refreshed baselines, docs provenance/i18n/assets/links green with a refreshed EN screenshot asset. Independent subagents found and the round closed: a HIGH badge false-positive (`null` lineage vs `undefined`), a CRITICAL partial-commit in design-time updates (request-scoped executor reuses the middleware transaction), runtime `restore` bypassing unique rules, module Record API bypassing rules, non-UUID REF 500s, legacy dangling REFs blocking unrelated edits, and a lock-key mismatch between REST and module writers. Residual architectural follow-ups (recorded, not silently dropped): split `runtimeRowsController.ts` (≈9.8k lines) into read/write/command handlers, deduplicate the marketing runtime serialization helpers between `publicMarketingRuntime.ts` and `runtimeMarketingPageController.ts`, move the runtime rule message dictionary into the apps i18n bundles, and unify the advisory-lock hash function with the newer `hashtextextended` call sites.

## Phase A — Renderer geometry and pricing width

-   [x] LQR2-01 Features fixed-height overlap fixed (`flexShrink: 0` instead of `minHeight: 0`) with a browser geometry oracle (no content clipping, no overlap, real scroll).
-   [x] LQR2-02 Pricing/Highlights/Testimonials grids fill the section width (restore upstream `width:'100%'`) and the pricing widget gains `cardWidth: 'auto' | 'full'` end to end (authoring/public schemas, types, normalize, renderer, dialog, i18n, backend serializer) with unit tests and a browser grid-fill oracle.
-   [x] LQR2-03 FAQ answers use the full accordion width (root cause: upstream `maxWidth: { md: '70%' }`) with a width oracle.

## Phase B — Consortium content and configuration

-   [x] LQR2-04 The Consortium pricing config sets `cardWidth: 'full'`, keeps uniform cards and expands the stage content (up to five benefits and longer descriptions) with contract/flow assertions.
-   [x] LQR2-05 The theme switcher is enabled in the Consortium configuration (generator, fixture contract, flow spec, regenerated fixture) and the anonymous page proves the theme switch; auth stays disabled.

## Phase C — Layout provenance

-   [x] LQR2-06 The inheritance badge is rendered for every inherited widget on metahub-derived layouts (shared switchers and dashboard widgets included) instead of the marketing-key allowlist, with component tests.

## Phase D — Data and authorization hardening

-   [x] LQR2-07 Application runtime write paths enforce the component `pattern` and `unique` rules (create/update/copy) with localized feedback, so an authoring role cannot break the published page.
-   [x] LQR2-08 Design-time REF values are validated against live target records on create/update, closing the reference-to-nowhere path.
-   [x] LQR2-09 Copy suffixing respects component `maxLength`, update ordering is unified (version conflict first), and the records integration suite is strengthened (service soft-delete path, production-like partial index, concurrency case).

## Phase E — Localized errors and hygiene

-   [x] LQR2-10 The remaining raw `extractAxiosError(...).message` surfaces use the localized helper (admin access pages, entity automation/modules tabs, migration hooks/guard).
-   [x] LQR2-11 Marketing serializers normalize the numeric price text at the boundary (`1.00` → `1`) while the renderer keeps locale formatting; header widget configs get a precise schema with tests; the i18n gate refuses empty key sets.

## Phase F — Gates and CI

-   [x] LQR2-12 Browser geometry helpers (`expectGridFillsContainer`, `expectNoContentClipping`, anti-overlap, answer width) wired into the Consortium runtime spec; refreshed baselines inspected.
-   [x] LQR2-13 CI runs the applications-backend marketing suites, the template-mui dialog tests, the layout-provenance tests and the real-PostgreSQL records suite on the local Supabase job; the unit gate is renamed to reflect its scope.

## Phase G — Verification

-   [x] LQR2-14 Prettier, `git diff --check`, lint and the full focused unit/real-PG suites for every changed package.
-   [x] LQR2-15 Minimal local Supabase: rebuild, regenerate the fixture, pass the contract/drift/runtime gates and the browser suites with inspected screenshots; stop Supabase.
-   [x] LQR2-16 Independent verification subagents (geometry/UX, provenance, data/security) and memory-bank update without leaving debt.

# Landing QA remediation (second pass) — IMPLEMENT (2026-09-17)

> Closes the findings of the comprehensive QA over the Consortium landing: data-integrity guards for referenced records and semantic keys, numeric pricing rendering, Russian stage names, layout-driven header widgets on the anonymous public runtime (language switcher on, auth/theme off via `isActive`), the features fixed-height setting enabled for the Consortium, the contacts block restructure (communities + contacts), localized error messages without server internals, CI/real-PG/Playwright coverage, and the P2 hygiene items. No schema/template version bump, disposable test database, fixture regenerated only through the real authoring/export flow.

## Phase A — Data integrity and content (P0)

-   [x] LQR-01 Deletes are guarded on both sides: a scoped `SELECT` + inline soft delete (`object_id` predicate) replaces the generic helper, and `assertElementNotReferenced` fail-closes with `RECORD_REFERENCED` for root and TABLE-child REF references (JSONB array guard, self-reference excluded). Unit tests cover the scoped predicate and the guard; a real-PostgreSQL suite (6/6) proves the tier-with-benefits lock, the TABLE-child case with a `null` table value, and the self-reference case. The generic `mhbSoftDelete` scope parameter was reverted after review because it broke tables without `object_id` (`_mhb_shared_entity_overrides`).
-   [x] LQR-02 Semantic keys are unique per object: `keyComponent` in the marketing template publishes `validationRules.unique` plus the canonical semantic-key pattern, `assertUniqueComponentValues` runs inside the serialized transaction (advisory lock shared with create/delete, conflict detection first), and the copy flow re-suffixes taken keys via `suggestUniqueComponentValue`. The template baseline contract now asserts the unique rule for all ten key components. Duplicate `SectionKey` can no longer make the public page 404.
-   [x] LQR-03 Prices render without fake precision: `formatMarketingPrice` formats the canonical NUMERIC shape through `Intl.NumberFormat` per locale and keeps authored text untouched; the Consortium tiers show `1/2/3 этап`, the template shows `0/15/30`, and the browser spec asserts the tier price/period text with no `1.00` anywhere.
-   [x] LQR-04 Stage names are localized (RU «Предпосевная», «Посевная», «Масштабирование»; EN unchanged), the fixture was regenerated through the authoring flow and the contract/runtime specs assert the localized titles.

## Phase B — Layout-driven header widgets on the public runtime (P0)

-   [x] LQR-05 The anonymous runtime now receives layout-driven `headerWidgets` (brand/navigation/auth + language/color-mode switchers) with `isActive`, resolved instance keys and schema-level uniqueness; inactive rows are skipped explicitly, the public page feeds them to the marketing header (falling back to data widgets for legacy payloads), and unit tests cover the active/disabled projection plus the hero/image refine regression.
-   [x] LQR-06 The generator authors the Consortium from the `marketing-page` template and then explicitly disables `marketing.auth` via `isActive` while keeping `languageSwitcher` enabled; the fixture contract asserts the states. (Superseded by LQR2-05: the color-mode switcher is enabled again and now proves the anonymous theme switch.)
-   [x] LQR-07 The anonymous runtime exposes the language switcher: the browser spec clicks it, verifies the `?locale=ru` URL and the Russian hero, and asserts that the disabled auth/theme widgets are absent on every locale and viewport.

## Phase C — Areas and contacts (P1)

-   [x] LQR-08 The Consortium enables `fixedItemsHeight` (asserted by the contract and the runtime payload) and the card list scrolls inside the template-height area; the generic template keeps its media-based geometry.
-   [x] LQR-09 Contacts are restructured as «Наши сообщества» (Telegram, VK, Max) and «Наши контакты» (demo phone with `tel:`, demo Omsk address linking to the Omsk map); footer groups are visible on mobile (previously `display: none` on xs), labels/groups are asserted in EN and RU, and the provenance manifest documents the approved demo values.

## Phase D — Localized error messages (P1)

-   [x] LQR-10 `resolveApiErrorMessage` never surfaces server payloads: axios errors always yield the localized fallback (English texts, legacy codes and Postgres internals cannot leak), plain frontend `Error` messages are preserved, and the member/record hooks map `RECORD_REFERENCED`/`RECORD_KEY_DUPLICATE` to dedicated localized messages. 26 utils tests document the contract.

## Phase E — Tests and CI (P1)

-   [x] LQR-11 `MetahubRecordsService.integration.test.ts` covers the record-integrity guards against real PostgreSQL (hermetic schema, TRUNCATE per test, 6/6) and is wired through the new `test:records-integration` package script with README instructions; the anonymous public runtime remains covered by the browser gate on the real database.
-   [x] LQR-12 Playwright gaps closed: RU unavailable alert + retry absence, all footer labels/groups, tier price/period text, the strengthened `layout-runtime-settings-panel` oracle (was a conditional no-op), the matrix browser-issue collector documented for the expected `204` probe abort, and the focused unit gate `test:marketing-runtime-gate` (i18n self-test + utils + types + marketing renderer + notification/layout keys + records service) wired into CI.
-   [x] LQR-13 The i18n gate is robust and testable: pure helpers live in `tools/lib/i18n-keys.mjs`, static template-literal callsites are scanned, duplicate keys compare through `JSON.parse` (escapes collide), the dead `keepRawLocales` option is gone, and `tools/check-i18n-coverage.test.mjs` (5 cases) covers the scanner. Widget-dialog labels are asserted in both authoring bundles.

## Phase F — Hygiene (P2)

-   [x] LQR-14 Hygiene: the triple `variant → record kind` map is now `MARKETING_COLLECTION_VARIANT_RECORD_KINDS`, the public marketing field allowlist has a drift guard against the authoring source fields, and `/a/...` public addresses are built by the shared `publicApplicationAddress` helpers (two duplicated `addressFor` copies removed).
-   [x] LQR-15 The provenance manifest documents the approved demo contacts, the MUI demo fallback, the header-widget `isActive` plan, the uniform pricing stages and the fixed-height areas; README/README-RU of the metahubs backend describe the integration test prerequisite.

## Phase G — Verification and closeout

-   [x] LQR-16 Prettier, `git diff --check`, lint (9 packages) and the focused suites are green after all review fixes.
-   [x] LQR-17 The generated fixture was refreshed twice (content and component validation rules) and the contract + drift + template-baseline gates pass; `build:e2e` succeeded and browser evidence on the final build is green: meridian runtime 2/2 (payload settings, language switch, live RU switch, disabled widgets, prices, contacts, RU unavailable), app-runtime-views 4/4, marketing matrix 5/5; Supabase stopped.
-   [x] LQR-18 Two Thermos subagent reviews over the remediation scope; all accepted findings fixed (CRITICAL `mhbSoftDelete` regression, TABLE-child REF robustness, advisory lock + conflict-first ordering in `update`, hero/image refine misplacement, header-row filtering, price regex tightening, debug logs removed, baseline `unique` assertion, integration script) and the rejected ones documented with rationale (monolith splits, DTO naming parity, enterprise sizing).

# Landing content & localization remediation — IMPLEMENT (2026-09-17)

> Closes the five user-reported defects confirmed by the QA pass over the rebuilt Consortium landing: notification localization, Investment section built on the MUI Pricing block, one-word navigation label, Areas (features) layout/settings/demo media, and Contacts content. No legacy compatibility code, no schema/metahub-template version bump, disposable test database, fixture regenerated only through the real authoring/export flow.

## Phase A — Localization (why notifications leaked English)

-   [x] LCR-01 Notifications localized end to end: the missing success/error keys were added to the EN/RU bundles (`createSuccess/createError/updateSuccess/updateError/copyInProgress`, `connectors.createSuccess/updateSuccess/deleteSuccess/copyInProgress`, `publications.applications.createSuccess/createError`, version mutations, …), the connector sync snackbars now reuse the existing `connectors.sync.success/error/confirmDestructive` keys, every error snackbar goes through the new shared `resolveApiErrorMessage` (server payload message or localized fallback, never raw `transport text`), the dropped root `table` keys are restored in the metahubs namespace consolidation, and duplicated/unplaced keys were removed so only the runtime-resolvable locations remain.
-   [x] LCR-02 The new `pnpm check:i18n-coverage` gate (`tools/check-i18n-coverage.mjs`) models the real consolidation exactly (subtree spread, merged vs replaced root keys, shared `common`/`header`/`spaces` fallback namespaces, explicit `namespace:key` references, `keyPrefix`/`useCommonTranslations` prefixes, multiline `t`/`tc`/`tl` callsites, plural-suffixed entries, duplicate JSON key detection), enforces EN/RU parity ignoring plural suffixes, and is wired into CI (`pnpm check:i18n-coverage`, `.github/workflows/main.yml`). Green targets: applications-frontend 932, apps-template-mui 657, metahubs-frontend 1922 literal keys — the stricter model also surfaced and closed 100+ pre-existing unresolved keys (member/generic/entity/component/publication/module screens, `metahubs:errors.*` root errors, apps `colorMode`/`workspace`/`app.*` keys) and the dead `recordKey` labels were removed.
-   [x] LCR-03 New focused real-bundle tests `notificationMessages.test.ts` in both packages assert the fixed RU/EN notification texts (including the corrected Russian grammar of publication messages) and the consolidated `table.*` labels; member validation is asserted against the shared `common` bundle that the member hooks actually use; English-default pinning assertions in the mutation suites were updated; utils received 9 `resolveApiErrorMessage` tests (including legacy-code suppression); `useCreatePublicationApplication` gained success/error coverage.

## Phase B — Investment section on the Pricing block

-   [x] LCR-04 `marketing.pricing` now supports `cardStyle: 'featured' | 'uniform'` in both the authoring and public schemas; `Pricing` honours uniform cards (no featured gradient, no badge path, equal `sm:6` cards), `showBenefits` is a live setting that hides the benefit list, the dead `badge` field and the hardcoded `$` price prefix were removed, and tier descriptions (record `Subheader`) render under the price. Component tests cover featured/uniform/description/benefits and the public serializer test proves the settings reach the anonymous DTO.
-   [x] LCR-05 `MarketingWidgetConfigDialog` exposes the pricing `cardStyle` select and the features-only `showItemDescriptions`/`fixedItemsHeight` switches with variant gating; EN/RU labels (5 keys) exist in all four authoring bundles; dialog tests cover saving uniform mode and hiding the features controls for other variants.
-   [x] LCR-06 The three single-card highlights widgets are replaced by one `marketing.pricing` widget (`cardStyle: 'uniform'`, `maxItems: 3`) fed by three `MarketingPagePricing` rows and eleven relation-linked `MarketingPagePricingBenefit` rows (financing in the tier description, horizon/mandates in the benefits); the `Investment` anchor points at `#pricing`; the generator authoring flow, fixture contract and flow spec were inverted, the committed fixture was regenerated through the real authoring/export flow and the contract + drift + runtime gates pass.

## Phase C — Navigation label and Areas (features)

-   [x] LCR-07 The navigation label is one word (RU «Преимущества» / EN «Highlights»); the fixture row and the data-driven assertions were regenerated.
-   [x] LCR-08 `Features` renders the original MUI template demo screenshots when a feature has no authored media (decorative, light/dark aware), supports titles-only and fixed-height scroll modes, and the config flows through normalize/renderer/types; component tests cover the demo fallback, authored-media priority, titles-only and scroll constraints.
-   [x] LCR-09 `marketing.collection` gained `showItemDescriptions` (default true) and `fixedItemsHeight` (default false) in the authoring and public schemas with variant-gated dialog controls and EN/RU labels; schema defaults keep existing persisted configs valid.
-   [x] LCR-10 The five activity descriptions were shortened in both locales (94–108 characters, down from ~140–170), the contract exact-text checks follow the content module and the regenerated fixture keeps the drift gate green.

## Phase D — Contacts block

-   [x] LCR-11 Contacts content is authored: six `MarketingPageFooterLink` rows for the `contacts` group (email/Telegram/VK demo destinations) and the `sections` group (anchor links); the “footer links must be absent” contract rule was replaced by exact key/label/group/href assertions and the fixture was regenerated.
-   [x] LCR-12 The anonymous runtime spec asserts every footer link by exact href and the first localized label, the strengthened spec also asserts the served widget configs (`cardStyle`, `showBenefits`, features settings) and the demo feature image, and the existing no-leakage/no-overflow oracles still run over the footer.

## Phase E — Verification and closeout

-   [x] LCR-13 Prettier and `git diff --check` are clean; lint is green for applications-frontend, metahubs-frontend, apps-template-mui, template-mui, types, utils, i18n, applications-backend and migration-guard-shared; unit suites: applications-frontend 310/310, metahubs-frontend 409/409, types 207/207, template-mui 294/294, utils error-handler suite 28/28, apps-template-mui 753 passed + 15 known load-sensitive `InterpretationNetworkWorkspaceWidget` timeouts (pre-existing, identical on HEAD).
-   [x] LCR-14 The fixture was regenerated through the generator spec on the minimal local Supabase profile; the full gate (generator → contract → drift → runtime spec) passed; the marketing-page visual baseline was legitimately refreshed after inspecting the diff (no hardcoded currency, tier description added) and re-checked green; browser evidence on the final build: meridian runtime 2/2 (payload + demo image + footer assertions), marketing-page-runtime 2/2, INW smoke 2/2, application-aliases 2/2, app-runtime-views 4/4, marketing-page authoring + widget lifecycle 4/4; Supabase stopped. A corrupted auth database left by an interrupted integration attempt was recovered by nuking and recreating the disposable E2E profile.
-   [x] LCR-15 Two verification subagents (localization, marketing content/render) and two Thermos review subagents (correctness/security, maintainability) reviewed the scoped change. Accepted and fixed: the i18n gate namespace/override/keyPrefix/multiline/`tc`/`tl`/duplicate-key holes plus the surfaced missing keys, legacy error codes no longer surfacing as user text, the migration-guard and metahubs member error paths now use `resolveApiErrorMessage`, the members test now asserts the real shared bundle, dead `recordKey` labels removed, duplicate `darkMedia` whitelist entry removed, stable React keys for pricing benefits, benefit→tier linkage/order asserted in the fixture contract, and a focused `useCreatePublicationApplication` test added. Rejected as pre-existing/out-of-scope with rationale: monolith splits and shared mock factories (no behavior risk), hardcoded `enterprise` sizing (parity with the reference MUI template), and the strict persisted-schema rollback note (documented here instead of adding tolerant parsing).
-   [x] LCR-16 `progress.md` updated with the final evidence; all verification/review subagents are completed; the worktree was not committed (the user has not requested a commit).

# Consortium Marketing + Public Runtime + Application Aliases — QA REMEDIATION, THIRD PASS (2026-09-16)

> This checklist closes every confirmed finding of the final QA pass (4 independent reviews). No legacy compatibility code, no schema/template version bumps, disposable test database.

-   [x] QAR2-01 (HIGH) Fix the dropped Consortium `Investment` anchor: every rendered section id is now registered as its own alias key in `buildSectionAnchors`, so `<section>-<instanceKey>` anchors resolve for repeated widgets. Covered by the extended `MarketingPage` anchor unit test and a new browser step asserting that all six Consortium navigation anchors resolve to rendered sections (desktop/tablet/mobile screenshots inspected).
-   [x] QAR2-02 (HIGH) CI now runs only the committed-fixture contract check; the drift check stays inside the local-Supabase gate that generates the artifact first (the artifact path is gitignored and cannot exist on a clean checkout).
-   [x] QAR2-03 (MEDIUM) Removed the duplicate anonymous bootstrap request: the public runtime page reuses the route entry's shared query result (`refetchOnMount: false`), proven by a new component test that fails if a second fetch happens.
-   [x] QAR2-04 (MEDIUM) Split the admin shell predicate from the RLS predicate: `admin.has_admin_permission` restored to its original subject set (management-table policies), new `admin.has_admin_shell_permission` (alias-aware, `manage`-aware, execute grants) used only for Admin-shell admission in `globalAccessService.canAccessAdmin`; migration test updated and the split proven against a real PostgreSQL database (strict=false, shell=true for an alias-read-only actor).
-   [x] QAR2-05 (MEDIUM) Delegation ceiling now covers role assignment: new `assertRoleAssignmentWithinCeiling` (shared pure policy module, no circular imports) is enforced in `grantRole`/`setUserRoles` for human actors while system bootstrap (no actor) follows the existing skip rule; 6 new unit tests plus updated service/route suites are green.
-   [x] QAR2-06 (MEDIUM) Real-PostgreSQL authorization coverage added (`applicationAliasesAuthorization.integration.test.ts`): actor binding rejection, create capability rejection, capability-granted creation, makePrimary without/with update capability, and the strict-vs-shell predicate split — 4/4 on the freshly recreated local database (12/12 together with the invariant suite).
-   [x] QAR2-07 (LOW) Public media resources now reject remote plain-HTTP at the schema level (loopback preserved) with types tests; public widget instance keys are deterministically re-keyed on collision (unit test); text-only logo entries support actions.
-   [x] QAR2-08 (LOW) Technical-address copy uses dedicated stable-link wording (EN/RU keys + tests); `common.unsavedChanges.description` is entity-neutral; the misleading Addresses panel test replaced by the real visible-technical-address contract; dead import removed; smoke navigation locator kept strict; alias functions received consistent EXECUTE grants; SQLSTATE 3F000/42703 covered; the admin alias resolver gained a Retry action.
-   [x] QAR2-09 (LOW) Evidence gaps closed: released-alias filter exercised in the browser, picker disambiguator extracted into a pure helper with tests, image dialog invalid-URL/required-alt tests added, the Meridian anonymous landing page asserted at 1920/768/390 with inspected screenshots, and `app-runtime-views` regained its runtime view-settings contract through a new records.union dashboard test (toggle, search, card view, row creation).
-   [x] QAR2-10 Re-ran focused suites and full gates: applications-backend 986/986 and 12/12 real-PostgreSQL integration tests, types 207/207, template-mui 292/292, applications-frontend 306/306, apps-template-mui 691/691, core routes 10/10; browser on the minimal local Supabase: `application-aliases` 2/2 (incl. released filter), `snapshot-import-73rd-meridian-public-runtime` 2/2 (nav anchors, funding stages, viewport matrix), `interpretation-network-app-smoke` 2/2, `marketing-page-runtime` 2/2, `app-runtime-views` 4/4 (incl. new union test); `pnpm build:e2e` 36/36; fixture contract check, Prettier, `git diff --check`, and package lint green. Screenshot inspection also caught and fixed a real defect: recordKey-filtered collection items (Consortium funding stages) did not resolve in the public runtime because the serializer keyed records by a missing `codename` column instead of their own `*Key` component.

# Consortium Marketing + Public Runtime + Application Aliases — QA REMEDIATION (2026-09-16)

> This checklist closes the confirmed findings of the second QA pass over the dirty implementation. No legacy compatibility code, no schema/template version bumps, disposable test database.

-   [x] QAR-01 (CRITICAL) Restore the authenticated runtime path for closed applications: `/a/:applicationRef/*` must resolve the reference before auth, render the anonymous public runtime for ready public applications, and for the generic unavailable outcome with an authenticated session enter the existing `ApplicationGuard -> ApplicationMigrationGuard -> ApplicationRuntime` path via a separate authenticated ref-resolver; anonymous visitors keep the non-enumerating unavailable page. Implemented as `ApplicationRuntimeEntry` in `apps-frontend` (public bootstrap decision, authenticated alias resolver, guards with `applicationIdOverride`), mounted by `MainRoutes`; unit coverage `ApplicationRuntime.entry.test.tsx` 6/6. Browser proof: the previously red `interpretation-network-app-smoke` (private application) is green and shows the authenticated workspace.
-   [x] QAR-02 (HIGH) Restore marketing navigation/section anchoring: preserve safe semantic widget instance keys in the public DTO (UUID-shaped identities still fall back to synthetic keys) and generalize the anchor contract (`MarketingSectionAnchors` with alias resolution) so emitted navigation anchors resolve to rendered section ids (`#logos`/`logoCollection`, repeated instances, auth and public runtime). Covered by `MarketingPage` anchor test, serializer instance-key test, and the green `marketing-page-runtime` spec asserting `#hero`, `#logoCollection`, … `#footer`.
-   [x] QAR-03 (HIGH) Render the approved Consortium partner categories: logo records may be text-only (media optional in both record schemas), both materializers keep them, normalization/`LogoCollection` render the localized label; covered by serializer + component tests and the text-only partner contract.
-   [x] QAR-04 (HIGH) Replace the `ConfirmDialog` single-renderer ownership hack: one authoritative mount in `MainLayoutMUI`, redundant page-level mounts removed (8 pages), ownership guard deleted, new `ConfirmDialog.test.tsx` covers accessible dialog + resolve/cancel + absence of resize/fullscreen controls.
-   [x] QAR-05 (MEDIUM) Re-enable the existing marketing-page runtime E2E: the spec now designates a public-entry workspace through the supported API, uses the current section anchors, and the refreshed visual baseline (reviewed via image viewer) matches the restored navigation rendering.
-   [x] QAR-06 (MEDIUM) Align alias release authorization with the database policy: the RLS UPDATE backstop accepts update/delete/manage for the delete-authorized soft release while the API controller still maps rename/setPrimary to `update` and release to `delete`.
-   [x] QAR-07 (MEDIUM) Added real-PostgreSQL integration coverage `applicationAliasesIntegration.test.ts` (8/8 against the minimal local Supabase database): global unreleased-name uniqueness, reclaim only after release, reservation across soft-delete, reserved/UUID/malformed rejects, one active primary, released-never-primary, `ON DELETE RESTRICT`, concurrent claim and concurrent competing-primary arbitration through the unique indexes.
-   [x] QAR-08 (MEDIUM) Slugs application picker disambiguator: options now carry the localized description as a human-readable secondary label, shown only when display names collide.
-   [x] QAR-09 (MEDIUM) Released aliases reachable in the Slugs page through a localized `Show released addresses` switch wired to `includeReleased` with page reset and i18n parity coverage.
-   [x] QAR-10 (MEDIUM) The Addresses tab now shows the labeled read-only `Technical address` value together with its copy action; the alias E2E asserts the UUID inside that explicitly labeled control instead of forbidding it.
-   [x] QAR-11 (MEDIUM) Damaged/unready public runtime states collapse into the single unavailable outcome: unknown-schema/table/column SQL states and the final DTO parse are mapped to the non-enumerating 404 with a dedicated route test.
-   [x] QAR-12 (LOW) Locale whitelist for the public runtime (`?locale=` unsupported values fall back to English), protocol-based plain-HTTP media checks, alias-mutation invalidation of cached authenticated runtime references, image i18n drift parity test (RU drift aligned), Meridian fixture gates wired into CI, and dead-code removal (`insertApplicationAlias`, unused query keys, unreachable `APPLICATION_ALIAS_PRIMARY_REQUIRED` branches).
-   [x] QAR-13 Re-run focused unit/integration/browser suites, Prettier/lint/build, update progress evidence. Green: applications-backend 992 (with 8 integration skips without a DB; 8/8 with the local database), applications-frontend 302, template-mui 290, apps-template-mui 691, metahubs-frontend 403, core-frontend route/parity suites, types 206; browser: `application-aliases` 2/2, `snapshot-import-73rd-meridian-public-runtime` 2/2, `interpretation-network-app-smoke` 2/2, `marketing-page-runtime` 2/2, `app-runtime-views` 3/3, `cross-template-runtime` 2/2; full `pnpm build:e2e` 36/36; Prettier/`git diff --check`/lint green.

# Consortium Marketing + Public Runtime + Application Aliases — IMPLEMENT (2026-09-15)

> This is the authoritative checklist for the current implementation. It follows the approved brief, research, and final QA-reviewed plan. The database is disposable for this change: remove the legacy application-level slug contract cleanly, do not add compatibility shims, and do not bump the schema or metahub-template version.

-   [x] CMPRA-01 Re-baseline the worktree, dependency state, content provenance, package READMEs, implementation/UI/security/Playwright skills, and OntoIndex impact for every existing symbol changed. Re-baselined against the brief, research, plan and package READMEs; runtime-ux-qa and thermos skills loaded; four independent read-only review subagents (alias RBAC/security, anonymous public runtime, marketing widget/fixture, runtime UX) completed over the dirty implementation.
-   [x] CMPRA-02 Patch the React Router v6 dependency pair to the approved fixed line and verify the lockfile/overrides contain no vulnerable stale router pin. `react-router`/`react-router-dom` resolve to 6.30.6 via `pnpm-workspace.yaml` overrides and the forced `@remix-run/router@1.23.2` override is gone: the lockfile pins `@remix-run/router@1.23.4`.
-   [x] CMPRA-03 Add shared typed alias, public-runtime, permission, and marketing static-widget contracts with strict normalization/validation and focused tests. `packages/universo-react-types` tests 206/206 and `@universo-react/utils` 372/372 pass, including `applicationAliases` grammar/reserved-words and marketing ownership-discriminator contracts.
-   [x] CMPRA-04 Replace the legacy application slug persistence with the dedicated alias registry, routing policy, release/canonical invariants, UUID v7 IDs, RBAC capability, management API, and database-backed tests. `applications-backend` 982/982 tests pass; grep confirms no remaining application-level slug consumers in backend/frontend persistence, system definitions, sync identity, or frontend types.
-   [x] CMPRA-05 Add the server-owned public runtime workspace designation and transaction-pinned anonymous published-read boundary with non-enumerating availability behavior and conservative caching. Public readiness classifier + single unavailable outcome verified by tests; `Cache-Control: no-store` asserted in route tests; transaction-pinned RLS covered by same-transaction tests. QA additions: route-schema `safeParse` and unsafe-physical-table failures now collapse into the shared unavailable outcome (no 503 channel), the published-row limit fails closed instead of silently truncating, and the public bootstrap uses its own stricter `applications-public-runtime` rate limiter.
-   [x] CMPRA-06 Update frontend route precedence and public runtime transport so `/a/:applicationRef/*` resolves UUID/alias before auth, keeps `/a/:applicationId/admin/*` authenticated UUID-only, and never calls authenticated runtime endpoints anonymously. Route-precedence regression tests and anonymous-client network tests pass in applications-frontend (296/296) and core MainRoutes tests; browser network oracle in the 73rd Meridian spec proves no cookies/Authorization and only `/public/applications/:ref/runtime` calls.
-   [x] CMPRA-07 Add the application Addresses tab and Instance Slugs administration page with capability-driven access, shared MUI primitives, TanStack Query, EN/RU i18n, responsive/a11y behavior, and focused UI tests. applications-frontend 296/296; metahubs i18n gained the six missing `layouts.marketing.widget.image*` keys (blocker fix). QA additions: application selector options now expose the `{id, name}` contract instead of leaking the internal `nameValue` store shape (empty option labels fixed), locale-aware application names for the Slugs table (`?locale=`), and copy-feedback keys moved from `aliases.actions.*` to the existing `aliases.dialog.*` keys so the snackbar no longer renders a raw i18n key.
-   [x] CMPRA-08 Implement the first-class static `marketing.image` widget, explicit widget ownership modes, URL/HTTPS validation, Hero media ownership cleanup, and MUI-compatible responsive rendering with tests. Marketing renderer/normalizer/dialog suites pass (apps-template 690/690 outside the pre-existing flaky InterpretationNetwork suite; template-mui 289/289). QA additions: public boundary re-applies HTTPS/loopback for remote media (defense-in-depth), and the image dialog shows a URL-specific localized invalid-URL message instead of the generic one.
-   [x] CMPRA-09 Generate and commit the 73rd Meridian product snapshot through the real authoring/export flow, using `.backup/Лендинг-для-Консорциума.md` as the Russian source, a faithful English translation, and the temporary MUI dashboard image URL only for the central image. `check:73rd-meridian-fixture-contract` and `check:73rd-meridian-fixture-drift` pass against the committed fixture and a freshly generated snapshot.
-   [x] CMPRA-10 Add deep Jest/Vitest/PostgreSQL/Playwright/security/visual coverage for aliases, anonymous public runtime, route precedence, EN/RU, 1920×1080/768×1024/390×844, keyboard/focus, no overflow, and technical-leakage checks; inspect screenshots. Browser evidence on the minimal local Supabase stack: `application-aliases.spec.ts` 2/2 (EN/RU pass, viewport matrix 1920/768/390, keyboard alias creation via the application picker, set-primary and release confirmations, dirty-form discard regression, two-application deployment-global proof, technical-leakage oracles) and `snapshot-import-73rd-meridian-public-runtime.spec.ts` 2/2 (anonymous UUID/direct/canonical alias runtime plus new negative step proving localized non-retrying unavailable states and the distinct retryable network-failure state). Failure screenshots inspected via image viewer during debugging. Remaining known gap: the standalone marketing-page visual matrix projects were not rerun in this pass; the pre-existing load-sensitive `InterpretationNetworkWorkspaceWidget` suite still times out under load and was verified to fail identically on committed HEAD via a separate worktree.
-   [x] CMPRA-11 Update affected package READMEs and GitBook-style `docs/` documentation, including alias lifecycle, public runtime trust boundaries, marketing image authoring, and fixture provenance. Paired EN/RU GitBook pages (`public-applications-and-aliases`), updated summaries, provenance manifest, and package READMEs are present in the worktree.
-   [x] CMPRA-12 Run Prettier, `git diff --check`, affected lint/type/build/test suites, minimal-local-Supabase E2E, OntoIndex changed-scope verification, Thermos/autoreview, reconcile all findings, update progress evidence, and leave no unresolved product task. Prettier/`git diff --check`/lint pass for the changed surface; focused Jest/Vitest suites green; two browser suites green on the minimal local Supabase profile (Supabase left running for the user's next step and can be stopped with `pnpm supabase:e2e:stop`). QA additionally fixed three cross-cutting shared-primitive defects found during browser QA: (1) anonymous guest endpoints broke when the capability-gated alias router mounted `use(ensureAuth)` before the public guest router — fixed by mount-order plus a new composition test; (2) `ConfirmDialog` rendered into the static `#portal` div, which MUI marks `aria-hidden` while another modal is open, making confirmations invisible to assistive tech and duplicated by page-level mounts — fixed by MUI-default portal plus a single-renderer ownership guard and removal of the now-unused `#portal` element; (3) the workspace carried two notistack majors (`^2.0.4` in core-frontend vs catalog `^3.0.1` everywhere else), silently breaking every snackbar — unified on notistack 3.0.2 through the catalog with a regenerated lockfile. OntoIndex `gn_verify_diff` and the Thermos/autoreview bundle were not rerun in this pass (known oversized-diff limitations documented in earlier evidence); direct source review plus the focused/browser suites above stand in as the reconciliation evidence.

## QA verification evidence (2026-09-16 QA/IMPLEMENT pass)

-   Browser: `application-aliases.spec.ts` and `snapshot-import-73rd-meridian-public-runtime.spec.ts` both pass 2/2 on `pnpm supabase:e2e:start:minimal` with the canonical wrapper; the anonymous runtime requests carry no cookies/Authorization; unavailable states render the localized non-retrying alert and keep the URL.
-   Suites: applications-backend 982/982, applications-frontend 296/296, template-mui 289/289, apps-template-mui 690/690 (excluding the documented pre-existing flaky INW file), admin-backend 152/154 (2 env skips), metahubs-backend 1292/1297 (5 env skips), metahubs-frontend 403/403, admin-frontend 14/14, types 206/206, utils 372/372.
-   Fixture gates: `check:73rd-meridian-fixture-contract` and `check:73rd-meridian-fixture-drift` pass for both the committed fixture and a freshly generated snapshot.
-   Cross-cutting fixes verified by tests: alias option projection `{id, name}` (+ UUID v7 fail-closed route test), route-composition guest-availability test, public-runtime safeParse/unavailable mapping test, HTTP-media fail-closed serialization test, metahubs EN/RU image i18n keys, ConfirmDialog ownership guard (template-mui 289/289 incl. nested-dialog tests), single notistack 3.0.2 lockfile.

# Marketing header QA defect remediation — IMPLEMENT (2026-09-13)

> This is the authoritative checklist for the current continuation. It closes the user-reported localization, dialog-spacing, and marketing-header visual regressions on top of the existing dirty implementation. Preserve unrelated worktree changes, keep the clean-break architecture, use shared primitives, and do not change schema or metahub-template versions.

-   [x] MHWQA-20260913-01 Re-baseline the current implementation against the brief, research, plan, package READMEs, MUI/runtime UX and Playwright skills; record the shared i18n and dialog contracts and inspect the original backup template.
-   [x] MHWQA-20260913-02 Move genuinely shared layout-authoring labels and setting options into the centralized `@universo-react/i18n` common namespace with EN/RU parity; consume them from metahub and application layout screens and add real-resource parity tests.
-   [x] MHWQA-20260913-03 Replace the zone-settings dialog's ad hoc action footer with the existing `StandardDialog` contract (or its centralized equivalent), preserving presentation, focus, busy, read-only, reset, and optimistic-concurrency behavior; add spacing and accessibility assertions.
-   [x] MHWQA-20260913-04 Restore the original MUI marketing-page visual contract while retaining the widgetized header: fixed mode uses the frame offset plus the original 28px visual margin, reserves the complete occlusion, preserves the original translucent toolbar/background continuity, and flow mode remains normal document flow.
-   [x] MHWQA-20260913-05 Strengthen component and Playwright browser oracles for EN/RU metahub and application authoring, dialog spacing, fixed/flow header behavior, background continuity, scroll ownership, responsive overflow, keyboard/focus, and console/page/network errors; inspect generated screenshots.
-   [x] MHWQA-20260913-06 Run Prettier, diff checks, affected lint/type/build, focused Jest/Vitest and relevant backend regression tests; run the minimal-local-Supabase Playwright verification where available and stop its dedicated services cleanly. All affected checks passed; the canonical wrapper passed the flow and visual matrix gates and stopped its dedicated Supabase profile cleanly.
-   [x] MHWQA-20260913-07 Run OntoIndex changed-scope verification and the Thermos/autoreview gate where available, reconcile the subagent findings, update truthful documentation/task/progress evidence, and leave no unresolved defect or unverified claim. `gn_verify_diff` passed for the complete dirty-worktree allowlist; the ship-readiness audit requested manual review because `MetahubLayoutsService` has high graph impact, which was covered by direct source review and focused/backend/browser evidence. Autoreview was attempted again but the generated 419,497-character bundle exceeded the review model context window; no automated clean verdict is claimed.

# Marketing-page runtime top-bar regression — IMPLEMENT (2026-09-10)

> This is the authoritative checklist for the current regression fix. Restore the original MUI marketing-page geometry and sticky behavior while preserving the verified multi-instance widget contract. Do not add a new layout primitive, legacy compatibility layer, schema change, or template-version bump.

-   [x] MPR-20260910-00 Re-baseline the current dirty worktree, read the marketing-page package README and relevant UI/Playwright skill references, inspect `.backup/templates/marketing-page`, and record the exact source of the top gap/scroll regression. The regression was the previous `static` AppBar plus compensating header padding; the original demo uses a fixed AppBar with `calc(var(--template-frame-height, 0px) + 28px)`.
-   [x] MPR-20260910-01 Restore the top-bar/background geometry and scroll ownership from the original demo using the existing MUI primitives; all active Navigation instances now use fixed AppBars with deterministic stack offsets, while the page reserves the complete stack height and the background begins at the viewport edge.
-   [x] MPR-20260910-02 Add focused component/regression tests for initial geometry, fixed repeated navigation instances, unique accessibility identity, and responsive mobile behavior. Component coverage now asserts fixed positioning for every active instance, explicit future-policy support, unique landmarks/drawers, keyboard activation, and focus restoration.
-   [x] MPR-20260910-03 Add or strengthen Playwright browser oracles for desktop/tablet/mobile: no top gap above the page background, every navigation bar remains visible at the intended scroll position, content scrolls behind the fixed stack, no horizontal overflow, no console/page/network errors, and screenshots inspected from the real runtime. The cross-template flow records all-fixed positions, non-overlap, `heroTop=0`, stable stack coordinates after scroll, single/repeated gradient ownership, overflow, issue monitoring, responsive checks, and initial/post-scroll screenshots.
-   [x] MPR-20260910-04 Run Prettier, diff checks, affected lint/type/build, focused Vitest/Jest, the local minimal-Supabase Playwright wrapper, inspect screenshots, run OntoIndex changed-scope verification and the Thermos/autoreview gate where available, then update `activeContext.md` and `progress.md` with truthful evidence. Focused Vitest passed 15/15, package lint/typecheck passed, local cross-template E2E passed 4/4 after the full build, Supabase stopped cleanly, final OntoIndex verification passed for the complete 195-file allowlist, and the autoreview helper timed out at 600 seconds without a structured verdict.

# Unified Template Widgets and Scoped Layouts — Post-QA Implementation (2026-09-09, current IMPLEMENT)

> This is the authoritative checklist for the current remediation pass. It fixes the confirmed repeated-widget overlay, authoritative-composition, lineage, concurrency, validation, logging, and evidence gaps without retaining legacy behavior, changing the database/schema/template versions, or widening package boundaries.

-   [x] ULTW-POSTQA-00 Re-read IMPLEMENT, MUI runtime UX, Runtime UX QA, Playwright, Thermos, security, Node.js, architecture, and OntoIndex instructions; inspect the dirty worktree and package READMEs; record that direct source remains authoritative because the graph is indexed at committed HEAD.
-   [x] ULTW-POSTQA-01 Make repeatable marketing navigation instances occupy distinct vertical flow positions, reserve their layout height, use unique accessible navigation labels/Drawer identities, and preserve responsive behavior without introducing a new widget primitive.
-   [x] ULTW-POSTQA-02 Make Dashboard persisted widget composition authoritative: remove competing visibility fallbacks from the render decision, explicitly enforce singleton `appNavbar`/`header` placement at every mutation/copy/sync boundary, and keep repeatable `menuWidget` behavior intact.
-   [x] ULTW-POSTQA-03 Correct application-owned versus inherited widget lineage display and preserve `instanceKey` through the frontend neutral layout reference contract; add EN/RU component/API regression coverage.
-   [x] ULTW-POSTQA-04 Make metahub layout copy and default-widget initialization atomic and race-safe with source/layout locks, positive version checks, fail-closed `RETURNING` behavior, and two-session-capable service/store tests without schema changes.
-   [x] ULTW-POSTQA-05 Harden layout mutation envelopes with strict Zod validation, redact snapshot/config/error logging, and verify role/CSRF/origin/ID-isolation behavior remains unchanged.
-   [x] ULTW-POSTQA-06 Add browser and component oracles for repeated marketing/dashboard widgets: visible count, non-overlap/order, semantic landmarks, keyboard/focus, EN/RU, 1920/768/390 viewports, no overflow/leakage, and console/pageerror/requestfailed monitoring.
-   [x] ULTW-POSTQA-07 Update truthful EN/RU package README, GitBook/runtime documentation, task/progress evidence, and screenshots only after behavior is verified; retain the explicit standalone BLOCKED boundary where no authenticated shell exists.
-   [x] ULTW-POSTQA-08 Run Prettier, diff checks, affected lint/type/build, focused Vitest/Jest, relevant full suites, local minimal-Supabase Playwright wrappers with inspected screenshots, fixture/docs gates, OntoIndex changed-scope verification, and Thermos/autoreview; close only verified findings. The autoreview helper reached its 10-minute limit without a structured report, and the independent review agents were unavailable after the external usage limit; no clean external verdict is claimed.

# Unified Template Widgets and Scoped Layouts — Final QA Remediation (2026-09-09, current IMPLEMENT)

> This is the authoritative checklist for the current implementation pass. It closes the latest QA findings without preserving legacy behavior, without a schema or metahub-template version bump, and without weakening the existing SQL-first/RLS, UUID v7, i18n, or runtime UX contracts.

-   [x] Re-baseline the current dirty worktree, read the approved brief/research/plan and package READMEs, refresh OntoIndex search/inspect/impact evidence, and record the exact implementation boundary. OntoIndex is based on committed `f11c1a68` and warns about dirty/untracked source; direct source inspection remains authoritative.
-   [x] Keep request-scoped RLS execution for user-facing application/layout/runtime flows; run long-running schema sync/diff/release operations in an explicitly trusted pool transaction only after `ensureApplicationAccess` authorization, avoiding the request-transaction/DDL lock inversion; add executor and authorization regression coverage.
-   [x] Remove the reachable legacy runtime layout-selection algorithm and route renderer, CRUD behavior, and target-aware runtime configuration through one canonical resolver core.
-   [x] Add and use a trusted materialization resolver for publication/snapshot/sync so request runtime and materialization share target, template, composition, lineage, and fail-closed rules.
-   [x] Harden snapshot validation against foreign base-widget references and malformed/coerced dashboard fields; preserve atomic rollback and add negative data-integrity tests.
-   [x] Enforce UUID v7 at metahub layout/widget ingress and centralize canonical runtime-target normalization/cache identity without introducing a new package or legacy shim.
-   [x] Complete the effective-layout OpenAPI contract and preserve stable backend error codes through hosted and standalone localized UI states.
-   [x] Align layout authoring dialogs and UX oracles with existing MUI primitives: positive EN/RU validation, aria-invalid/error association, keyboard/focus/pending behavior, semantic displays, and bounded responsive layout.
-   [x] Add browser proof for metahub global/Page/Object layout lifecycle and strengthen the standalone wrapper/spec so missing standalone deployment remains an explicit BLOCKED result rather than acceptance evidence.
-   [x] Stabilize reproducible Vitest/Jest failures and add PostgreSQL-backed local-Supabase coverage for the canonical resolver, snapshot lineage, malformed persisted rows, and deletion/copy semantics. Broad apps-template Vitest remains resource-sensitive, while all relevant filtered suites pass.
-   [x] Update truthful docs/task/progress evidence, run Prettier, diff/lint/type/build/static/documentation gates, focused and full relevant tests, local minimal-Supabase Playwright wrappers with inspected screenshots, OntoIndex changed-scope verification, and the Thermos/autoreview gate where the environment permits. Autoreview was attempted for 20 minutes but timed out without a structured report; no clean external verdict is claimed.

# Unified Template Widgets and Scoped Layouts — QA Remediation (2026-09-08, current IMPLEMENT)

> This is the authoritative checklist for the current implementation pass. It addresses the live marketing-layout authoring crash and the remaining QA findings. Preserve unrelated dirty-worktree changes; do not add a schema or metahub-template version bump and do not reintroduce legacy authoring behavior.

-   [x] Establish the current source/build baseline, read the brief/research/plan, refresh OntoIndex impact evidence, and record the exact implementation boundary.
-   [x] Restore the complete template-aware layout-widget API contract with runtime validation and regression coverage for incomplete/malformed responses.
-   [x] Correct independent scoped-layout copy, cross-template shared-widget metadata/copy validation, and add focused service/controller tests.
-   [x] Replace reachable snapshot/rematerialization UUID v5 identity generation with fresh UUID v7 allocation and explicit source-to-new remapping tests.
-   [x] Make application layout/widget deletion and source removal atomically tombstone dependent rows, define safe restore/resync semantics, and add persistence/integration coverage.
-   [x] Harden layout controller path/query validation, eliminate independent legacy layout authority, and complete direct authorization/CSRF/Origin regression coverage without weakening existing access controls.
-   [x] Add a real PostgreSQL two-session application-layout concurrency regression where the existing E2E/database harness supports it; the local minimal-Supabase gate passed with one committed writer and one expected conflict.
-   [x] Update current Playwright coverage for metahub marketing authoring, dashboard/marketing inverse scopes, copy/delete/reload, console errors, responsive/a11y/overflow and screenshot evidence using the local minimal Supabase wrapper.
-   [x] Run focused tests, package lint/typecheck/build, Prettier, static/documentation gates, OntoIndex changed-scope verification, and the Thermos/autoreview gate; the autoreview helper was attempted but produced no report before the environment-limited timeout, so no clean external verdict is claimed.

# Unified Template Widgets and Scoped Layouts — QA Remediation Implementation (2026-09-08)

> This checklist is authoritative for the current IMPLEMENT continuation. It closes the blockers found in the latest QA pass without preserving legacy behavior, without a schema or metahub-template version bump, and without overwriting unrelated dirty-worktree changes.

-   [x] Re-baseline the dirty worktree, read the approved brief/research/plan, refresh OntoIndex context, and record implementation boundaries.
-   [x] Replace sync publication persistence's domain-level Knex mutations with the project's `DbExecutor`/store boundary while preserving atomicity, parameterized SQL, fail-closed `RETURNING`, and existing authorization.
-   [x] Correct application materialization identity mapping: allocate fresh UUID v7 physical layout/widget IDs, retain explicit source lineage, remap parent/base references, and preserve same-source resync updates.
-   [x] Exclude inactive/draft widgets from effective runtime resolution and enforce target/entity authorization through existing workspace/RLS/RBAC primitives without existence leaks.
-   [x] Unify authoring and publication lock/version/hash ordering, including widget-version checks and parent freshness updates; add a real concurrency regression where the harness supports it.
-   [x] Harden no-data-loss deletion/tombstone behavior, UUID v7 ingress contracts, technical-field display filtering, and existing MUI focus/ARIA contracts using current primitives.
-   [x] Complete supported non-skipped browser coverage for dashboard/marketing, global/entity-scoped Page/Object targets, inverse template combinations, authoring validation/delete/copy flows, roles/CSRF, cache isolation, responsive/a11y/visual states, and concurrency evidence. The separately deployed standalone runtime remains an explicit BLOCKED environment gate when its authenticated shell variables are absent.
-   [x] Run focused Jest/Vitest suites, package lint/typecheck/build, Prettier and diff checks, static/documentation gates, and the local-minimal-Supabase Playwright wrappers; inspect screenshots and clean E2E resources.
-   [x] Run OntoIndex changed-scope verification and the Thermos/autoreview gate where the environment permits; update implementation evidence, `progress.md`, and this checklist with truthful results and no unchecked product task. OntoIndex passes with the complete dirty-worktree allowlist; autoreview produced no report after ten minutes and was interrupted, so no clean verdict is claimed.

# Unlimited Layout Widget Instances — Implementation (2026-09-05)

> This checklist is authoritative for the current IMPLEMENT continuation. It removes artificial singleton limits so every registered widget can be added as a new instance any number of times in metahub and application layouts, without a schema or template-version bump.

-   [x] Re-baseline the current dirty worktree and inspect/impact every availability, duplicate, persistence, and materialization boundary before editing.
-   [x] Remove singleton filtering and conflict/upsert behavior from metahub and application authoring while preserving validation, authorization, optimistic concurrency, and UUID v7 identity.
-   [x] Align the shared widget registry and generic layout authoring primitives with the unlimited-instance contract for dashboard and marketing layouts.
-   [x] Verify SQL/storage and publication/application materialization preserve distinct rows and identifiers for repeated widget instances.
-   [x] Add or update focused frontend, backend, service, and persistence regression tests for repeated creation, copy, delete, and reload behavior.
-   [x] Extend the real Playwright lifecycle with repeated widget creation in metahub and application layouts, including dashboard and marketing coverage where the existing harness supports it.
-   [x] Update relevant EN/RU documentation, run Prettier, lint/build, focused tests, local-minimal-Supabase browser verification, OntoIndex diff checks, and the Thermos/autoreview gate where the environment permits. The autoreview helper was attempted but blocked by the read-only environment-owned state database.
-   [x] Update progress and mark every task complete with evidence or an explicit environment limitation.

# Marketing Page Widgetized Runtime — QA Findings Remediation (2026-09-05)

> This checklist is authoritative for the current IMPLEMENT pass. It fixes the confirmed Russian authoring, widget-label, template-description, metadata-registry, and browser-oracle defects without legacy compatibility, database/schema migrations, or a metahub-template version bump.

-   [x] Re-baseline the current dirty worktree and run OntoIndex search/inspect/impact for the source-seed, application-registry, layout-label, and affected test symbols before editing.
-   [x] Make built-in marketing source identities locale-stable at the seed and authoring boundaries; keep localized names for display and add direct RU/EN contract tests for every seeded source variant.
-   [x] Make application widget metadata canonical and complete: return localized label keys/default labels for marketing and dashboard definitions, avoid optional silent `Widget` fallbacks, and add an API contract test.
-   [x] Add missing EN/RU marketing-zone translations and a required-key parity/semantic localization test; replace the technical marketing template-picker description with concise user-facing copy.
-   [x] Correct component tests to model the production API contract and add coverage for RU source selection, unavailable-source prevention, widget labels, zone labels, and template description.
-   [x] Extend the repository Playwright lifecycle on minimal local Supabase with a real RU metahub/application authoring path, source-selector assertions, localized labels, screenshots, keyboard/overflow/technical-leakage checks, and reload persistence.
-   [x] Run focused Jest/Vitest suites, package lint/build, Prettier, `git diff --check`, static/contract/isolation guards, local-Supabase Playwright verification with inspected screenshots, and the Thermos/autoreview gate where the environment permits.
-   [x] Update `memory-bank/progress.md`, the implementation plan evidence, and relevant EN/RU package/GitBook documentation only with verified results; confirm every task in this checklist is checked or has an explicit environment limitation.

# Marketing Page Widgetized Runtime Post-QA Remediation (2026-09-05)

> This checklist is authoritative for the current IMPLEMENT continuation. It closes the latest QA findings without preserving legacy compatibility and without changing database/schema/template versions. Existing completed checklists below are historical evidence and remain unchanged.

-   [x] Re-baseline the dirty worktree, run OntoIndex impact checks for edited symbols, and document the current implementation boundaries before editing.
-   [x] Serialize application and metahub scoped-layout/default mutations, map unique conflicts to typed 409 responses, and add store/service concurrency regression tests without adding schema migrations.
-   [x] Make singleton upsert semantics explicit and fail closed on malformed persisted layout/widget placement, source bindings, incomplete composition, and ambiguous `recordKey` behavior.
-   [x] Keep the public runtime envelope minimal where possible, preserve required React identity internally, and verify no user-facing source/provenance IDs are rendered.
-   [x] Complete direct API/RBAC/CSRF/cross-application tests for metahub and application widget mutations, including no-change-after-denial assertions.
-   [x] Improve authoring UX with picker-based or clearly bounded record selection, server-owned authored identity, complete EN/RU keys, unique drag announcements, and standard confirmation focus behavior.
-   [x] Make runtime query retries status-aware and add direct `MarketingRuntimeContent`/renderer/error/loading/cache-key tests.
-   [x] Decompose the largest newly-expanded marketing/runtime boundaries into focused store/resolver/mapper/UI modules while preserving canonical MUI primitives and package isolation.
-   [x] Extend Playwright coverage for precedence, stale two-session conflicts, reset/copy/delete, malformed snapshot rejection, authoring responsive/a11y/error states, standalone runtime, and exact response contracts; harden manifest/API-context cleanup. The standalone spec is intentionally opt-in because this repository's hosted wrapper owns the application shell and no separate deployed shell is configured locally.
-   [x] Run Prettier, `git diff --check`, affected lint/build, focused Jest/Vitest suites, minimal local-Supabase Playwright flows with inspected screenshots, docs/contract gates, and OntoIndex diff verification; update progress and leave no unchecked task without an evidence-based reason. Autoreview was attempted but could not initialize its read-only Codex state database.

# Marketing Page Widgetized Runtime QA Remediation (2026-09-05)

> This checklist is authoritative for the current IMPLEMENT pass. It addresses every actionable QA finding from the widgetized marketing-page review while preserving the clean-break policy, UUID v7 identity, SQL-first executor boundary, and unchanged database/schema/template versions.

-   [x] Establish the implementation baseline, preserve unrelated worktree changes, and record the current source/graph limitations.
-   [x] Replace interpolated runtime workspace literals with parameterized SQL fragments and keep identifier quoting restricted to validated identifiers.
-   [x] Enforce optimistic version checks at every layout/widget/override mutation boundary, including batch, move, toggle, delete, reset, and visibility paths; add fail-closed `RETURNING` coverage.
-   [x] Make publication sync and layout authoring use one concurrency contract and add a deterministic race/regression test for stale sync writes.
-   [x] Harden copy, seed cleanup, snapshot, dispatcher, UUID/query boundary, runtime identity, and error/logging contracts without a schema or template-version bump.
-   [x] Make all repeatable marketing renderers instance-aware and complete the typed registry/renderer contract without introducing legacy or feature-package dependencies.
-   [x] Complete widget authoring operations required by the plan, including duplicate/reset semantics, localized labels, accessible widget identity, dialog focus behavior, and localized constraints.
-   [x] Extend the real Playwright lifecycle with repeated variants, widget duplicate/reset/conflict, composition publish-to-runtime, scope precedence contract coverage, empty/error states, focus/axe, semantic locators, and responsive evidence.
-   [x] Review touched module boundaries: the new renderer, snapshot validator, and widget-config dialog are isolated; existing large services retain their established public boundaries and received focused regression coverage.
-   [x] Update implementation plan, progress, package/GitBook documentation, and provenance so all completed phases and remaining environment limitations are truthful and traceable.
-   [x] Run Prettier, `git diff --check`, affected lint/build, Jest/Vitest suites, minimal local-Supabase Playwright wrapper with inspected screenshots, docs/contract gates, and OntoIndex diff check. Autoreview was attempted but the selected Codex engine was unavailable; no false clean verdict is claimed.

# MUI 9 Platform Upgrade and Data-Driven Marketing Page Template (2026-08-30)

## Marketing page QA remediation implementation (2026-09-04)

> This checklist is authoritative for the current IMPLEMENT pass. It closes the verified QA findings for the widgetized marketing-page runtime without preserving legacy compatibility and without changing the database schema or metahub-template version.

-   [x] Align the strict widget contract, test fixtures, and optional mutation arguments; affected applications/metahubs frontend regression slices are green.
-   [x] Create one fail-closed marketing layout validation boundary and apply it before publication, sync, and destructive snapshot restore; define explicit empty-composition semantics.
-   [x] Harden sync/restore identity and duplicate handling: validate UUID v7 IDs, reject silently filtered rows and duplicate overrides, and preserve atomic rollback semantics.
-   [x] Complete target-aware runtime transport and routing for entity-type/record layouts, including scope precedence and authorization tests.
-   [x] Add browser-proven widget lifecycle authoring for the existing metahub/entity/application layout surface using existing MUI primitives and localized user-facing locators.
-   [x] Close authoring UX and accessibility gaps: keyboard drag/reorder, accessible icon labels, confirmation dialogs, pending/error/retry states, and technical-label fallbacks.
-   [x] Complete optimistic-concurrency and copy/delete/duplicate integration coverage without adding a schema version or database migration.
-   [x] Synchronize OpenAPI/README/GitBook contracts and record the final verification evidence.
-   [x] Run formatting, scoped lint/build, focused and relevant full tests, the minimal-local-Supabase Playwright wrapper, screenshot inspection, and OntoIndex diff verification; record the unavailable Thermos/autoreview gate without a false PASS.

> Implementation rule: do not mark a task complete while any directly relevant test, browser flow, or fail-closed invariant remains red or unproven.

## QA remediation implementation (2026-08-31)

> This execution checklist is authoritative for the current IMPLEMENT pass. It closes the acceptance defects found by the QA review without changing the schema or metahub-template version.

-   [x] Restore marketing application routing so landing content and workspace/application subroutes are independently reachable in hosted and standalone shells.
-   [x] Enforce workspace RBAC server-side and in the UI, seed every newly-created workspace atomically, and add negative/positive role tests.
-   [x] Implement complete workspace copy/archive handling for parent and child tables with explicit lifecycle, owner, audit, and identifier remapping rules.
-   [x] Align marketing data ownership with the metahub→publication→application→workspace model, add persisted site settings, and make query/cache keys workspace-aware.
-   [x] Replace raw marketing media URL fields with the canonical typed resource-source contract, preserve storage/file resources, and remove production hotlink-only assumptions.
-   [x] Finish MUI 9 slot API migration, tighten version/policy checks, and pass strict typechecking for every changed frontend package.
-   [x] Complete runtime UX/a11y semantics, i18n, browser lifecycle coverage, changed-file coverage gates, docs, and final verification.

> Status: implementation and all feasible local acceptance gates complete; workspace CRUD, cross-scope content mutation, and reset operation audit are proven through focused tests and the minimal-Supabase browser lifecycle. Production Storage/imgproxy media and independent review tools remain environment-dependent evidence boundaries.
> Source plan: `memory-bank/plan/mui-9-marketing-page-template-plan-2026-08-30.md`
> Scope: clean-break implementation for the disposable test database; no schema, snapshot, or metahub-template version bump.

## Continuation remediation (2026-09-01)

-   [x] Replace dashboard workspace-switcher fixtures with valid UUID v7 values and retain the raw-ID leakage assertion.
-   [x] Remove the navigation-only lead callback from hosted and standalone marketing runtime dispatch; render CTA links when no approved lead endpoint exists.
-   [x] Reject duplicate predefined element IDs before any seed write and preserve persisted legal-link ordering during normalization.
-   [x] Add browser proof for a pristine seeded workspace reset (`resetRows > 0`) and direct member content-mutation denial with a no-change readback.
-   [x] Re-run the complete local minimal-Supabase wrapper after the continuation edits, then refresh plan/progress evidence and run final static/documentation gates.

## Contract

-   Upgrade every direct MUI consumer to the approved coherent MUI 9/Core-X policy, with direct dependency ownership, lockfile proof, and no generated `.backup` JavaScript copied into source.
-   Add the data-driven `marketing-page` metahub/application template beside the existing dashboard without weakening dashboard contracts or routing marketing data through dashboard hooks.
-   Keep the entity-first model (Hub/Object/Page/Set/Enumeration), initial seed ownership and explicit reset semantics, UUID v7 persisted identifiers, SQL-first `DbExecutor` access, EN/RU i18n, and the isolated `apps-template-mui` boundary.
-   Require focused Jest/Vitest tests, real browser Playwright proof on minimal local Supabase, inspected screenshots, documentation checks, and Thermos/autoreview evidence before completion.

## Checklist

### Phase 0 — Preconditions and decisions

-   [x] Record branch/worktree/runtime/tool versions, dirty-file provenance, baseline package/build/test/checker results, and the OntoIndex stale-index warning.
-   [x] Resolve exact MUI/Core-X/Lab/Emotion, React/react-is, Pro-license, browser-floor, authenticated-route, actions/media, seed ownership, fixture, and screenshot policies.
-   [x] Capture `.backup/templates` provenance and a field-level marketing baseline contract (sections, counts, labels, copy, actions, media/alt, order, light/dark).

### Phase 1 — MUI 9 dependency and API migration

-   [x] Update centralized catalog, lockfile, every direct consumer manifest/peer, direct testing dependencies, and stale MUI documentation.
-   [x] Run the approved Core/System/X migration work, manually migrate residual APIs, remove unused Base dependencies, retain only type-only Pro augmentation, and preserve product dashboard behavior.
-   [x] Add and wire the MUI policy checker; pass frozen install, package builds, focused lints/tests, dashboard regression coverage, isolation guards, and residual scans.

### Phase 2 — Shared contracts and utilities

-   [x] Add the neutral metahub/application registry, strict Zod schemas, discriminated runtime envelope, safe-link/media/action contracts, and provenance/semantic-key types to shared packages.
-   [x] Reuse existing URL/media, UUID v7, and safe-display helpers; add focused contract tests and keep backend/React dependency cycles out of the shared contracts.

### Phase 3 — Marketing metahub and seed

-   [x] Register the eighth metahub template with unchanged `version`/`minStructureVersion` and existing basic presets.
-   [x] Seed localized, ordered Object records and relations for the stock sections, with deterministic media, semantic keys, transaction rollback, and initial-only ownership.
-   [x] Extend registry/manifest/seed shape and transaction tests, including invalid values and no-version-bump assertions.

### Phase 4 — Layout/publication/sync

-   [x] Make layout services/controllers, snapshot serialization/restore, publication, hash/import/export, and sync template-aware; remove dashboard defaults/injection and fail closed on unknown keys.
-   [x] Keep `templateKey` immutable unless separately approved, preserve UUID/SQL/RLS contracts, and cover dashboard and marketing core round trips.

### Phase 5 — Workspace/application settings

-   [x] Implement initial-only seeded ownership, authored transitions, scoped cleanup, permission-checked reset-to-source, and focused `RETURNING`/IDOR tests.
-   [x] Extend typed application settings for marketing appearance/theme/branding/section/action/provenance fields with `manageApplication` enforcement.

### Phase 6 — Runtime transport

-   [x] Add backend marketing read-model aggregation with bounded metadata-backed queries, locale fallback, RLS/RBAC, safe error mapping, and no arbitrary client table access.
-   [x] Split runtime bootstrap into independent dashboard/marketing branches before dashboard CRUD hooks; keep strict dashboard fields and omit them from marketing responses.

### Phase 7 — Renderer and host dispatch

-   [x] Replace static marketing demo arrays with typed presentational sections, export and dispatch `marketing-page` in hosted/standalone shells, and keep one theme boundary.
-   [x] Implement safe data-driven actions, media/error states, i18n, package isolation, and regression tests without adding a newsletter backend or legacy fork.

### Phase 8 — Authoring UI and accessibility

-   [x] Complete the browser-proven UI Contract across template picker, layout/content authoring, generic CRUD, relations, media, workspace lifecycle, and export/import. The marketing flow covers workspace create/edit/copy/delete/reset, localized content edit/publish/sync/reload, safe media, and export/import with the existing primitives.
-   [x] Add EN/RU keys, localized runtime labels/errors, multiline metadata, keyboard/focus semantics, safe display, no-overflow safeguards, and browser axe coverage for the marketing runtime matrix.

### Phase 9 — Fixtures and Phase 10 test system

-   [x] Build the deterministic equivalent lifecycle gate with run isolation, a field-level semantic contract, and documented local/full media boundaries; a promoted product fixture is intentionally not required in this slice. The runtime flow compares the materialized read model with every seeded semantic field, and the matrix wrapper runs serially (`--workers 1`) with bounded retries.
-   [x] Add focused Jest/Vitest/RTL tests and Playwright runtime/RBAC/matrix/visual tests; provision matrix applications independently and archive reports/screenshots safely. The broad apps-template suite remains resource-sensitive and was not used as the marketing acceptance oracle; focused acceptance suites and the full marketing wrapper are green.

### Phase 11 — Documentation and Phase 12 closeout

-   [x] Update package READMEs, EN/RU GitBook pages/SUMMARY, reviewed runtime screenshots/assets/provenance/drift checks, and migration notes.
-   [ ] Run the final independent review gates from an environment where OntoIndex and Thermos/autoreview can complete. All feasible local implementation, API, browser, visual, accessibility, and documentation gates are complete; the remaining unchecked state is an infrastructure/tooling limitation, not an unimplemented product path.

### Implementation evidence (2026-09-01)

-   `pnpm run test:e2e:marketing-page:verify:local-supabase` exited 0 after the workspace lifecycle hardening: minimal Supabase doctor/start/stop, 36/36 production build, contract, setup plus five Chromium marketing flow tests (6 tests total, including workspace CRUD, cross-scope mutation, and reset with UUID v7 `operationId`), four locale/theme matrix projects plus setup, screenshot provenance, i18n, GitBook asset, and link checks all passed.
-   Workspace reset now records a transactional `_app_workspace_operation_audit` row and returns a validated UUID v7 `operationId`; unknown database errors fail closed, while not-found/reference failures map to typed localized responses. No schema, snapshot, or metahub-template version was bumped.
-   Workspace copy preserves the stable seed key but transfers ownership to authored content; parent/child soft-delete and reorder paths clear seed ownership. Focused applications-backend suites pass `119/119`; apps-template workspace/API suites pass `30/30` plus marketing renderer/normalization `13/13`; applications-frontend runtime/layout suites pass `52/52`.
-   Static MUI/catalog/isolation/no-LMS/marketing-contract checks, scoped package builds/lints, Prettier, `git diff --check`, and all documentation gates pass. Real EN/light desktop, RU/light tablet, and EN/dark mobile screenshots were inspected with `view_image` and show no page-level overflow or visible technical leakage.
-   Follow-up package verification after the MUI 9 test-contract cleanup passed: `applications-frontend` 31 files/242 tests, `metahubs-frontend` 85 files/396 tests, `apps-template-mui` typecheck, the isolated MUI multiline-textarea regression, and the marketing/backend targeted suites. The test now asserts the MUI 9 semantic textarea contract instead of removed internal CSS class names.
-   The broad `apps-template-mui` Vitest command was interrupted after a resource-sensitive Interpretation Network tail (including known loopback `EPERM` attempts and React act warnings) without a terminal summary. A complementary run excluding only `InterpretationNetworkWorkspaceWidget.test.tsx` passed 45 files/557 tests, and the complete `widgetRenderer.test.tsx` passed 67/67; these results are not conflated with the still-unresolved heavy file. Production Storage/imgproxy media remains outside the minimal-Supabase proof. OntoIndex reports a stale/degraded index, and Thermos/autoreview could not complete in the read-only Codex state environment.

## Implementation notes

-   Product code changes must stay within the approved plan and preserve unrelated dirty user files.
-   Every task is announced before work, verified with the narrowest relevant gate, and marked complete only after evidence is recorded below.

## Evidence log (2026-08-31)

-   `pnpm install --frozen-lockfile --ignore-scripts` passed; `check:mui-v9-policy`, `check:catalog-versions`, `check:apps-template-isolation`, and `check:runtime-no-lms-forks` passed.
-   Root `pnpm build` and the E2E production build passed for all 36 workspace projects. Focused marketing schema, utility, controller, seed/manifest, layout, runtime, renderer, and UI tests passed. The full `apps-template-mui` Vitest invocation has a known long-running Interpretation Network workspace-widget tail under the MUI 9 DOM/runtime changes; it is tracked separately from the green focused suites and browser wrapper.
-   `pnpm run check:marketing-page-template-contract` passed with the exact stock section order/counts, localized content, media/action metadata, footer/social targets, and unchanged template/snapshot versions.
-   After publish/sync, `marketingPageRuntimeMaterialization.ts` compares the actual runtime read model with seed copy, actions, media/alt, relations, prices/benefits, FAQ, and footer; decimal-price storage formatting and backend icon canonicalization are normalized explicitly.
-   Publication list sync is a localized production action guarded by manage permission, active version, pending state, and disabled-state handling; seven focused tests cover the action contract.
-   `pnpm run test:e2e:marketing-page:verify:local-supabase` exited 0: minimal Supabase doctor, 36/36 E2E build, contract, Chromium runtime/permission/authoring/snapshot-roundtrip flows (`5 passed`), EN/RU × light/dark responsive/a11y matrix (`5 passed`), screenshot provenance, EN/RU i18n (113 pairs), GitBook assets, and link checks all passed; Supabase stopped in `finally`.
-   The matrix passed at 1920×1080, 768×1024, and 390×844 with keyboard FAQ interaction, mobile drawer Escape/focus return, anchors, no unsafe links, no technical leakage, no page overflow, and no console/page/API errors. EN/light desktop and mobile screenshots were inspected with `view_image`; 12 Playwright baselines are tracked.
-   Remaining acceptance boundaries: a separate full-stack Storage/imgproxy media suite, the broad unrelated repository regression inventory, and independent review tooling. Workspace CRUD, appearance reset audit, content-row cross-scope mutation, template-picker/content edit→publish→sync→reload, export/import, responsive screenshots, and browser axe scans are covered by the passing wrapper; deterministic local-reference media is documented as a minimal-profile boundary.
-   OntoIndex remains stale/degraded for the dirty worktree and the scan cap prevents a complete independent changed-file proof; direct impact/source checks and focused tests remain authoritative. The Thermos/autoreview helper could not complete because the Codex state database is read-only; a writable temporary-home retry hung and was stopped, so no clean independent autoreview claim is made.

---

# PlayCanvas Editor Assets Pipeline + MMOOMM Script Assets — Complete ✅ (2026-08-25 → 2026-08-29)

> Archived completion summary. Full plan: `plan/playcanvas-editor-assets-and-mmoomm-script-assets-plan-2026-08-25.md`; research: `research/playcanvas-editor-assets-and-mmoomm-script-assets-research-2026-08-25.md`; detailed evidence: `progress.md` August 26–29 entries.

## Preserved contract

-   [x] Clean-break implementation on disposable test DB; no legacy asset/runtime fallback, no schema/template-version bump, UUID v7 for persisted identities, EN/RU UI, Chromium browser proof.
-   [x] Keep Editor vendor protocol compatibility in Universo-owned backend/bridge layers; strict auth, CSRF, Origin, RBAC/IDOR, bounded payloads, safe paths, and redacted logging.
-   [x] Keep PlayCanvas runtime engine 2.21.4 staged through the import-map/prebuild flow; Editor package remains independently pinned to its upstream-compatible engine line.

## Asset / realtime pipeline outcome

-   [x] Added Editor compatibility asset create/read/delete routes, fail-closed unsupported mutations, folder `virtual_path`, stable numeric Editor document ids, UUID v7 row ids, MIME/extension allowlists, ETag/checksum handling, and upstream `{id}` create response.
-   [x] Added realtime `fs` delete + `pipeline` script-attribute handlers, scoped dynamic asset grants, messenger socket registry, bounded ShareDB handshake buffering, and prototype-pollution-safe JSON0 paths.
-   [x] URL bridge preserves `Request` method/body/headers/abort signal, injects pre-warmed CSRF, rewrites only supported asset routes, and rejects unknown paths without leaking credentials or absolute storage paths.
-   [x] File operations validate project/root/provider/path ownership, reject traversal and symlink escape, use checksum/version preconditions, atomic no-clobber rename semantics, and rollback physical artifacts after failed DB work.
-   [x] Production shell CORS regression closed: generated local profile emits strict localhost + 127.0.0.1 origins; doctor rejects missing/wildcard/incomplete CORS; missing hashed assets return 404 instead of SPA HTML.

## Script assets / publication / MMOOMM outcome

-   [x] `compileScriptAssetEsm` supports isolated ESM compilation and metahub `@shared/<codename>` libraries while rejecting relative/absolute filesystem imports.
-   [x] Runtime loader fetches data URL, verifies SHA-256 against `artifactHash`, blob-imports/registers scripts, attaches them to target entities, and records `scriptsLoaded` as `true|none|failed`.
-   [x] Publication mirrors Editor scripts into `_mhb_playcanvas_script_assets`, compiles generated artifacts under advisory locking, ignores stale artifacts, and emits canonical manifest `scripts[]`.
-   [x] Gameplay logic moved from the generic widget into Editor-authored `flight-control.mjs`, `follow-camera.mjs`, `remote-ships.mjs` plus shared `flight-math.ts`; widget retains generic engine/realtime/HUD/bridge orchestration.
-   [x] Canonical MMOOMM fixture is generated through real Editor authoring, validates script assets/bindings/generated artifacts, and passes imported-runtime plus movement/camera parity checks.
-   [x] Runtime script startup waits for realtime authorization and published script-artifact readiness; optimistic-version semantics are consistent across PlayCanvas upserts.
-   [x] Snapshot scene/asset/source/generated-artifact refs validate local provider, project namespace, root and traversal even when files are absent; runtime-manifest canonicalization/checksum logic is shared.

## UI / maintainability / QA outcome

-   [x] Merged module authoring into `MetahubModulesSurface` / single Shared Modules surface; EN/RU labels and multiline content behavior are covered.
-   [x] Browser asset flow covers Folder/CSS/CubeMap/HTML/JSON/Material/Script/Shader/Text, nested folders, editing, 1920/768/390, RU/light/dark, keyboard/accessibility, leakage/overflow/error oracles.
-   [x] Copied source owners are demoted to admins while copier remains sole owner; browser tests cover create/read/rename/delete/file RBAC, cross-project IDOR and unauthorized realtime mutation.
-   [x] Project persistence, compatibility routes, and realtime runtime were split into focused modules; `PlayCanvasCanvasWidget.tsx` reduced to 888 lines; topology guards and public-contract JSDoc added.
-   [x] Full workspace build passed 36/36; editor-backend, metahubs-backend, modules-engine, apps-template, metahubs-frontend, Editor artifact, fixture/docs/drift, lint/Prettier and OntoIndex gates passed in final closure.
-   [x] Autoreview infrastructure was unavailable because environment-owned Codex state was read-only; no product finding was emitted and no clean automated verdict was claimed.

## Key decisions retained

-   Create route deliberately returns upstream `{id}`; folder document ids derive from stable project/path keys while persisted row PKs remain UUID v7.
-   Generated artifact reuse is checksum-aware and publication-lock guarded; runtime manifest selection must not consume stale artifacts.
-   Asset deletion/rename must preserve rollback safety and process-local realtime grant cleanup; DELETE payloads remain bounded, strict and unique.
-   Request-scoped RLS responses commit before exposing response bodies; ShareDB seed operations serialize per backend/document.
-   Fixture/script sources remain single-source-of-truth inputs to generators; do not restore built-in runtime fallback copies.

## Retained implementation details

-   Asset allowlists are enforced at shared types/Zod, MIME mapping, extension mapping, and backend service validation layers.
-   Editor mapper rows preserve real `path[]`, numeric `uniqueId`, creation time and folder semantics expected by the upstream UI.
-   Dynamic realtime grants are scoped by metahub/project; deleted asset ids are evicted from the process-local grant registry.
-   Messenger events preserve `asset.new`, `asset.delete`, and `scriptAttrsFinished:<guid>` compatibility semantics.
-   Folder ids derive from the deterministic `folder:<projectId>:<path>` document-key namespace; row ids remain UUID v7.
-   Script rows mirrored from Editor persistence use deterministic Editor-facing ids while persistent generated-artifact identities stay server-owned.
-   Import-map staging uses the workspace PlayCanvas runtime artifact and a version-marker cache; staged engine output remains generated/ignored.
-   `app.__universoHost` exposes the frozen generic host commands used by authored scripts and is removed during runtime cleanup.
-   Manifest script selection lets authored assets override built-ins by script name only during the migration path; production fallback sources were removed.
-   Generated-artifact compilation resolves shared libraries through `MetahubModulesService.listSharedLibraryCompilationInputs` and persists canonical manifest scripts.
-   `MetahubModulesSurface` remains the merged authoring boundary; do not restore the removed duplicate runtime-modules tab.
-   Browser compatibility tests must use public Editor actions rather than mutating internal Editor state to manufacture asset changes.
-   Cross-platform traversal checks normalize both POSIX and Windows-style separators before storage/package-artifact access.
-   CORS diagnostics must exercise real browser-origin requests; headerless curl is insufficient evidence for production static assets.
-   ShareDB static/dynamic asset seeding remains serialized per backend/document to avoid duplicate remote-document creation races.
-   Compatibility failures return sanitized domain errors and must not reveal PlayCanvas project/document identifiers to unauthorized clients.
-   Copied metahub membership normalization preserves one owner (the copier) and demotes copied source owners to admins.
-   Multi-worker realtime ownership has explicit single-worker/missing-worker/distinct-worker topology guards.
-   Final PlayCanvas asset/runtime closure intentionally kept schema and metahub-template versions unchanged because the affected storage contract required no DDL.

# Marketing-page widgetized runtime implementation (2026-09-04)

> This checklist is the active execution list for the approved widgetized marketing-page plan. It is a clean-break implementation for the disposable test database: no legacy marketing renderer, schema version bump, or metahub-template version bump.

-   [x] Phase 0: establish implementation baseline, package contracts, OntoIndex freshness, and UI/test acceptance gates.
-   [x] Phase 1: define neutral template-aware widget contracts, strict Zod schemas, registry, UUID-v7/semantic-key helpers, and contract tests.
-   [x] Phase 2: align marketing template manifest/seed data and fresh-schema storage/index constraints without version changes.
-   [x] Phase 3: implement template-aware metahub/application layout persistence, authoring operations, concurrency, lineage, hashes, and snapshot round trips.
-   [x] Phase 4: implement publication/materialization and application settings ownership/precedence for marketing layouts and content.
-   [x] Phase 5: implement the typed marketing runtime read model, safe source binding, locale fallback, RLS/RBAC, and fail-closed errors.
-   [x] Phase 6: replace the fixed marketing renderer with the isolated widget registry/composition runtime and safe generic primitives.
-   [x] Phase 7: implement/align metahub and application layout authoring UI, dialogs, source pickers, i18n, accessibility, and responsive contracts for the existing authoring/runtime surfaces.
-   [x] Phase 8: migrate and expand Jest/Vitest unit/integration coverage for contracts, stores, services, routes, sync, publication, and renderer.
-   [x] Phase 9: add and run Playwright lifecycle/RBAC/visual/accessibility tests on minimal local Supabase; inspect screenshots and provenance.
-   [x] Phase 10: update package READMEs, root docs/GitBook pages, test/runbook documentation, and drift/link checks.
-   [x] Phase 11: run package lint/build/format and focused/full regression gates; fix all actionable failures.
-   [x] Phase 12: perform OntoIndex diff/impact verification, Subagent reviews, Thermos/autoreview, and final closeout evidence, with unavailable review tooling explicitly reported.

Evidence (2026-09-04): the marketing verification wrapper passed the 36/36 E2E build, contract check, six Chromium lifecycle flows, and the EN/RU light/dark responsive visual matrix (5/5). Focused Jest/Vitest suites, affected package builds/lints, screenshot inspection, provenance, GitBook assets/links/i18n, and `git diff --check` passed. The browser suite covers the implemented product surfaces; it does not claim a separate widget CRUD workbench that was not introduced. OntoIndex `gn_verify_diff` passed with its dirty-worktree graph-scan warning. The local Thermos/autoreview helper exited before review because `/home/vladimir/.codex/state_5.sqlite` was read-only; no false PASS is claimed. Full evidence is recorded in the implementation plan's final verification update.

# Unified Application Template Widgets and Scoped Layouts — IMPLEMENT (2026-09-07)

> This is the authoritative checklist for the current IMPLEMENT pass. It follows
> `memory-bank/plan/unified-application-template-widgets-scoped-layouts-plan-2026-09-07.md`.
> The implementation is a clean break for the disposable test database: no
> schema, snapshot, or metahub-template version bump and no legacy compatibility
> route. Existing unrelated checklists below are preserved.

## Phase 0 — Baseline and contract closure

-   [x] ULTW-00 Record the dirty-worktree boundary, package READMEs, plan/research/brief inputs, and current graph/index state.
-   [x] ULTW-01 Verify the current DDL and snapshot-v1 representation; decide and test overlay versus independent cross-template composition without adding columns or versions.
-   [x] ULTW-02 Fix or remove all targetless runtime callers and write the accepted target-aware API, publication, authorization, lock, and failure contracts.

## Phase 1 — Shared contracts and registries

-   [x] ULTW-03 Extend the existing widget/zone/template registries and strict shared target/layout/runtime schemas; enforce UUID v7 at every new identity boundary.
-   [x] ULTW-04 Add canonical semantic-zone mapping and shared-capability metadata without introducing a second manifest or apps-template dependency on legacy UI packages.

## Phase 2 — Effective-layout resolution and persistence

-   [x] ULTW-05 Implement request-scoped and trusted materialization effective-layout resolvers with Page/Object lookup, precedence, publication lineage, RLS/RBAC, and fail-closed typed errors.
-   [x] ULTW-06 Make application and metahub layout mutations, copy/reset/delete, publication, snapshot restore, and sync use validated SQL-first stores, RETURNING checks, one lock order, and atomic rollback.
-   [x] ULTW-07 Remove hash-derived materialized identities and silent filtering/fallbacks; validate full layout/widget graphs, active publication identity, semantic uniqueness, and independent compositions.

## Phase 3 — Runtime transport and adapters

-   [x] ULTW-08 Replace `/runtime/template` with the target-aware effective-layout route and migrate hosted/standalone query keys and request construction atomically.
-   [x] ULTW-09 Transport all Dashboard zones and marketing zones through typed adapters; reject unknown placements and keep content/data hydration separate from layout selection.
-   [x] ULTW-10 Reuse the existing isolated apps-template LanguageSwitcher and MUI primitives in both adapters, with localized labels, keyboard/focus behavior, loading/error states, and no visible technical metadata.

## Phase 4 — Authoring UX and cache identity

-   [x] ULTW-11 Update metahub and application layout authoring for global/entity scope and cross-template selection using existing dialogs, tables, drag/reorder, picker, confirmation, and optimistic-concurrency primitives.
-   [x] ULTW-12 Make query/cache identity include the normalized target, workspace, locale, theme, and effective hash where applicable; invalidate related queries after every mutation.

## Phase 5 — Tests, browser evidence, and documentation

-   [x] ULTW-13 Add direct Jest backend tests for schemas, stores, resolver precedence, publication/snapshot/materialization, locks, RLS/RBAC/CSRF, and malformed persisted data.
-   [x] ULTW-14 Add Vitest/RTL tests for registries, adapters, API contracts, query keys, i18n, loading/error/empty states, and user-facing UX oracles.
-   [x] ULTW-15 Add Playwright wrappers/specs on minimal local Supabase for metahub, application, hosted runtime, standalone runtime where configured, two-session conflicts, responsive/i18n/theme screenshots, accessibility, and no-overflow/no-leakage checks.
-   [x] ULTW-16 Update package READMEs and EN/RU GitBook documentation with only verified contracts, commands, screenshots, and limitations; keep documentation parity and link checks green.

## Phase 6 — Closeout

-   [x] ULTW-17 Run Prettier, `git diff --check`, affected lint/build/tests, full required workspace gates, minimal-Supabase lifecycle with clean stop, screenshot inspection, and OntoIndex change verification.
-   [x] ULTW-18 Run the Thermos/autoreview gate; fix all actionable CRITICAL/HIGH or maintainability blockers, update `activeContext.md` and `progress.md`, and record any environment-only limitation explicitly.

## Progress notes

-   All code comments and durable `memory-bank` content remain English per repository instructions.
-   Product changes must stay within the plan and preserve unrelated dirty files.

## Initial implementation evidence before QA remediation (2026-09-08)

-   Target-aware effective-layout routing, shared widget/zone metadata, scoped Dashboard/marketing selection, UUID v7 identity, strict validation, and SQL-first concurrency boundaries are implemented without a schema, snapshot, or metahub-template version bump.
-   Focused verification passed: applications-backend 4 suites / 215 tests; metahubs-backend 3 suites / 71 tests; applications-frontend 49 tests; apps-template-mui Dashboard 22 tests; types 36 tests; and utils 17 tests.
-   `pnpm test:e2e:cross-template:verify:local-supabase` passed 2/2 after a full workspace build. Fresh screenshots cover marketing desktop, RU mobile, tablet, scoped Dashboard desktop, and scoped Dashboard RU mobile. The flow proves visible navigation into the scoped entity layout, shared language widget, keyboard menu operation, no technical leakage, and no page-level overflow.
-   Lint/static/docs gates passed after fixing EN/RU line parity and the stale Russian documentation term. The standalone browser environment and the environment-owned Thermos/autoreview state database remain explicit limitations; no false PASS is recorded for either.

# Unified Application Template Widgets and Scoped Layouts — QA remediation IMPLEMENT (2026-09-08)

> This is the authoritative checklist for the follow-up IMPLEMENT pass after
> the comprehensive QA review. It closes confirmed defects and evidence gaps
> without retaining legacy compatibility, changing the database/schema/template
> versions, or widening the apps-template dependency boundary.

## Phase 0 — QA baseline and safe execution

-   [x] QA-ULTW-00 Re-read the IMPLEMENT/runtime/Playwright/Thermos/OntoIndex gates, record the existing dirty-worktree boundary, and run impact checks for every edited symbol before changes. The graph is current only for committed `f11c1a6`, has no embeddings, and is authoritative only for pre-existing symbols; dirty source remains the source of truth.
-   [x] QA-ULTW-01 Reproduce the hosted RU scoped-runtime defect, standalone hash-locale defect, standalone target-routing defect, mobile marketing accessibility defects, and backend tombstone invariant before fixing them. The prior local-Supabase run and source inspection reproduced the English RU scoped Dashboard screenshot; direct source checks confirmed the other defects. The broad apps-template worker/open-handle concern was separately isolated to the pre-existing Interpretation Network test baseline recorded below.

## Phase 1 — Locale and target-routing correctness

-   [x] QA-ULTW-02 Synchronize hosted runtime locale with the URL/query and TanStack Query identity; make language changes update the active route and refetch localized content for global and entity-scoped Dashboard/marketing layouts. `runtimeLocale`, `useSyncExternalStore`, and the runtime query identity now share one URL-backed locale contract.
-   [x] QA-ULTW-03 Make standalone locale parsing hash-route aware and make standalone section links carry a validated target kind/id so Page and Object layouts resolve independently. `standaloneRouting`/`standaloneTargets` now preserve hash query state and validate UUID v7 target selectors.
-   [x] QA-ULTW-04 Add direct regression coverage for locale changes, hash routes, target-aware links, query/cache identity, and reload persistence in EN/RU. Focused App, DashboardApp, runtime-locale, API, and hosted-runtime suites cover these paths.

## Phase 2 — Accessible, reusable runtime navigation

-   [x] QA-ULTW-05 Fix the marketing mobile navigation with one interactive element per item, explicit navigation landmark, `aria-expanded`/`aria-controls`, stable drawer identity, and verified focus return while preserving existing MUI primitives. Repeated navigation widgets receive unique drawer identities and the shared LanguageSwitcher has one deterministic shell owner.
-   [x] QA-ULTW-06 Add component-level UX assertions for keyboard navigation, accessible names, focus restoration, localized labels, semantic long-text/technical-leakage oracles where applicable, and all supported viewport sizes. AppAppBar/MarketingPage tests and the browser runtime oracle cover keyboard, localization, leakage, and overflow behavior.

## Phase 3 — Backend lifecycle and security hardening

-   [x] QA-ULTW-07 Make application-owned layout deletion explicitly deactivate and un-default tombstoned rows; add RETURNING/fail-closed store and service regression coverage. The store now confirms the tombstone invariant and the concurrent stale-delete test proves only one mutation wins.
-   [x] QA-ULTW-08 Add real route/composition and local-Supabase authorization coverage for cross-application IDOR, role denial, CSRF/origin behavior, and no-change-after-denial; keep SQL parameterized and request-scoped. Auth middleware, request-scoped executors, application-access guards, resolver role checks, parameterized SQL, route tests, and the local-Supabase flow cover the implemented runtime boundary.
-   [x] QA-ULTW-09 Add deterministic concurrency coverage for layout/widget mutations and verify no duplicate active identities, lost updates, or partial copy/delete state. Independent executor tests cover advisory-lock serialization and version-guarded tombstones; the effective-layout transaction re-reads identities/versions, while the content endpoint uses the expected layout hash handshake and fails closed on a torn two-request read.

## Phase 4 — Test infrastructure and browser evidence

-   [x] QA-ULTW-10 Fix the unrelated pre-existing apps-template Vitest baseline at its ownership boundary; keep parallel execution deterministic and preserve the real test semantics. The stale structure-create and matrix-move mocks now exercise the aggregate response contracts, and the cell-create mutation regression that blocked the deep hierarchy/menu-cell flows is fixed. The full serial package run passes 54 files/732 tests. The focused widget file passes 68/68, and the imported-snapshot child-cell browser flow passes 2/2 after the fixture was regenerated through the product generator. No unified-layout product code depends on the mocks.
-   [x] QA-ULTW-11 Expand the cross-template Playwright flow with semantic locators, real keyboard paths, axe checks, localized validation, technical-leakage/data-grid oracles, `1920x1080`/tablet/mobile matrix, Page/Object precedence, and failure artifact preservation. The latest minimal-Supabase run passed 4/4 and preserved inspected screenshots, including both Page/Object precedence directions, scoped marketing, Dashboard, and RU mobile navigation.
-   [x] QA-ULTW-12 Add a dedicated standalone verification wrapper that records an explicit BLOCKED result and exits non-zero when no configured standalone shell exists; when configured, exercise real target/locale navigation and screenshots without `pnpm dev`. The wrapper is fail-closed and records `BLOCKED`; this checkout has no configured authenticated standalone shell, so no false browser PASS is claimed.

## Phase 5 — Maintainability, documentation, and closeout

-   [x] QA-ULTW-13 Decompose or isolate any newly touched >1000-line boundary required by Thermos while preserving package isolation and public contracts; do not introduce duplicate in-package abstractions. The new effective-layout and application-widget support boundaries are split; remaining large legacy boundaries were not expanded by this pass.
-   [x] QA-ULTW-14 Update EN/RU package README/GitBook/runbook documentation only with verified behavior, commands, screenshots, and explicit environment limitations. EN/RU parity and screenshot-asset checks pass.
-   [x] QA-ULTW-15 Run Prettier, `git diff --check`, affected/full builds, Jest/Vitest, static/docs/isolation gates, minimal-local-Supabase Playwright with inspected screenshots, and OntoIndex diff verification; fix all actionable findings and record unavailable external review tooling explicitly. The current feature gates pass, the full serial apps-template suite is 54 files/732 tests, package lint/build/Prettier are clean, the Interpretation Network fixture contract and drift gates pass, the focused imported-snapshot browser flow passes 2/2 with an inspected Russian screenshot, standalone is explicitly `BLOCKED`, and Thermos/autoreview did not return a clean verdict because of environment state/usage limits.

### QA-ULTW-10 boundary note

The Interpretation Network baseline is now aligned at its ownership boundary: the strict response schema remains unchanged, while the test supplies the current aggregate API response. The focused widget/layout test, hosted runtime flow, and root build remain green. The standalone browser acceptance gate is still explicitly BLOCKED in this checkout because no authenticated standalone shell and required target/template environment variables are configured.

# Marketing Header Widget Zone Settings — IMPLEMENT (2026-09-12)

> This checklist is the authoritative execution list for the approved
> `marketing-header-widget-zone-settings` plan. It is a clean-break change for
> the disposable test database: no legacy compatibility path, no schema,
> snapshot, or metahub-template version bump, and no dependency from
> `apps-template-mui` into legacy UI packages.

## Phase 0 — Baseline and impact

-   [x] MHW-00 Re-read the brief, research, approved plan, package READMEs and implementation-mode instructions; record dirty-file boundaries.
-   [x] MHW-01 Check OntoIndex freshness and run impact analysis before editing shared contracts, stores, services, authoring components and runtime shells.
-   [x] MHW-02 Capture focused baseline tests and identify obsolete multi-AppBar/Drawer and `sharedLayoutWidgets` assertions to replace.

## Phase 1 — Shared neutral contracts and registry

-   [x] MHW-10 Implement the strict neutral layout/widget envelope codec in the surviving shared types package.
-   [x] MHW-11 Extend serializable zone-setting metadata and typed header placement/cardinality registry contracts without executable validators in API metadata.
-   [x] MHW-12 Add contract tests for round-trip, fail-closed validation, renderer metadata stripping, defaults, placement and cardinality.

## Phase 2 — Metahub lifecycle and APIs

-   [x] MHW-20 Normalize metahub layout composition/zone metadata through the codec and implement sparse inheritance/reset.
-   [x] MHW-21 Add generic metahub zone-setting update/reset mutations using the existing transaction, lock order and OCC boundary.
-   [x] MHW-22 Make all existing metahub layout/widget config writers preserve system-owned neutral metadata and reject direct `__layout` injection.
-   [x] MHW-23 Update seed, copy, snapshot, restore and preflight tests without changing versions.

## Phase 3 — Application lifecycle, sync and hashing

-   [x] MHW-30 Add application zone-setting update/reset mutations with existing RBAC, transaction, lock and OCC contracts.
-   [x] MHW-31 Persist source zone-setting baselines and implement all sync resolutions plus targeted reset semantics.
-   [x] MHW-32 Refactor application config writers, reset paths, effective resolution and semantic hashing to preserve/exclude neutral metadata correctly.
-   [x] MHW-33 Add backend Jest/integration/concurrency coverage for all source, local, reset, hash and permission paths.

## Phase 4 — Typed placement and shared authoring UI

-   [x] MHW-40 Transport typed Start/End placement through move, inheritance, copy, snapshot, sync, reset, hash and hosted runtime adapters.
-   [x] MHW-41 Extend the real `LayoutAuthoringDetails` with metadata-driven zone-heading actions, reused move menu, shared Zone Settings dialog presentation, read-only/conflict states and EN/RU i18n.
-   [x] MHW-42 Wire application/metahub APIs, TanStack Query optimistic updates, localized errors and integration tests.

## Phase 5 — Runtime decomposition

-   [x] MHW-50 Replace marketing per-navigation shell ownership with one header shell/banner/Drawer and atomic persisted controls, preserving MUI style and package isolation.
-   [x] MHW-51 Add measured fixed/flow geometry, frame offset and skip/anchor accessibility behavior.
-   [x] MHW-52 Convert Dashboard language/theme controls to persisted singleton widgets without duplicate shell ownership.
-   [x] MHW-53 Replace obsolete runtime/component tests and add focused UX coverage for one banner, one Drawer, projections and geometry.

## Phase 6 — Browser, documentation and closeout

-   [x] MHW-60 Extend the existing Playwright suites and canonical local-Supabase wrapper; cover lifecycle, snapshot, sync, permissions, concurrency, keyboard, a11y, responsive geometry and real controls.
-   [x] MHW-61 Run and inspect the required visual screenshot matrix and traces; preserve evidence under existing artifact conventions.
-   [x] MHW-62 Update affected READMEs and paired EN/RU GitBook documentation.
-   [x] MHW-63 Run focused/full tests, lint, builds, Prettier, docs checks, package-boundary guards, OntoIndex diff verification and Thermos/ autoreview; fix all actionable findings.
-   [x] MHW-64 Update `progress.md` with verified implementation evidence and mark this checklist complete only after every applicable gate passes.

## Verification evidence

-   The marketing header now uses one MUI AppBar/banner and one responsive Drawer. Brand, navigation, authentication, language, and color-mode projections are rendered from the persisted zone composition; Dashboard language and color-mode controls use the shared registry.
-   The `marketing-header` zone supports the typed `fixed`/`flow` setting with sparse inheritance and reset. Neutral layout metadata is validated at shared, metahub, application, snapshot, sync, and runtime boundaries; renderer-only metadata is stripped before user-facing payloads.
-   Focused verification passed: apps-template 31/31, applications frontend 15/15, metahubs frontend 5/5, applications backend 318/318, metahubs backend 101/101, types 46/46, and utils 17/17. Package lint, builds, Prettier, isolation and runtime UX guards also passed.
-   The canonical Chromium lifecycle gate passed 13 flow tests with one intentional standalone skip. The visual matrix passed 5/5 after deterministic top scrolling and refreshed baselines; inspected screenshots show the single header shell and real controls at desktop, tablet, and mobile sizes.
-   Marketing template contract, GitBook provenance, EN/RU parity, screenshot assets, local links, and the minimal-Supabase cleanup gate passed. No schema, migration, snapshot, UUID policy, or metahub-template version was changed, and no legacy compatibility path was retained.
-   OntoIndex `gn_verify_diff` returned `PASS` for the complete dirty-worktree allowlist with no unexpected files, symbols, impacts, or missing tests. The Thermos subagent review completed earlier and its actionable findings were fixed. The final local autoreview retries produced no structured result: Codex failed after repeated strict-JSON stream disconnects, and Claude reported an unavailable API connection. No clean external autoreview verdict is claimed.

# Marketing Header Widget Zone Settings — QA REMEDIATION (2026-09-12)

> This follow-up checklist records the implementation work required after the
> QA pass found incomplete browser acceptance evidence. It keeps the clean-break
> contract: no legacy compatibility path, schema/version bump, or template
> version bump.

## Browser acceptance gaps

-   [x] MHW-QA-01 Add API-session helpers and direct browser/API assertions for application and metahub zone-setting update/reset, including owner/admin success, editor/member `403`, cross-scope `404`, stale OCC `409`, and no-change-after-denial.
-   [x] MHW-QA-02 Extend the authoring flow through the real shared Zone Settings dialog in EN and RU. Cover inherited/customized labels, read-only state, keyboard operation, save, cancel, reset, localized errors, and reload.
-   [x] MHW-QA-03 Add real runtime `flow` geometry proof at desktop, tablet and mobile sizes: header leaves the viewport after scroll and no fixed spacer or scroll-padding residue remains. Keep equivalent fixed geometry proof.
-   [x] MHW-QA-04 Complete the metahub sparse inheritance chain: global/base setting, entity overlay inheritance, local fixed override, reset, and a later base change becoming visible after reset.
-   [x] MHW-QA-05 Complete the application source lifecycle: non-default flow snapshot export/import, linked application effective layout, source flow to local fixed, upstream update, `keep_local`, `copy_source_as_application`, targeted reset, and current source baseline visibility.
-   [x] MHW-QA-06 Prove Start/End placement through authoring, reload, snapshot, application sync and runtime projection, including deterministic widget identity and UUID v7 uniqueness after copy/duplicate/delete paths.
-   [x] MHW-QA-07 Run and inspect the final EN/RU light/dark desktop/tablet/mobile screenshot matrix plus axe for fixed desktop and open mobile Drawer.

## Regression and closeout

-   [x] MHW-QA-08 Resolve the reproducible apps-template Dashboard test failure at its ownership boundary and rerun the package suite; separately resolve or document the FormDialog timeout only if it remains reproducible after isolated reruns.
-   [x] MHW-QA-09 Run the canonical minimal-Supabase marketing verification, focused Jest/Vitest suites, package lint/build, Prettier, docs checks, `git diff --check`, OntoIndex diff verification, and Thermos/autoreview.
-   [x] MHW-QA-10 Synchronize the plan Acceptance Checklist and this task list with fresh evidence; update `progress.md` and README/GitBook text only after the corresponding acceptance item is actually proven.

## QA verification evidence (2026-09-13)

-   MHW-QA-01 is closed by the real permissions flow and backend/API assertions: owner/admin writes and resets succeeded; editor/member writes were denied with `403`; cross-scope access returned `404`; stale optimistic updates returned `409`; denied requests left the persisted state unchanged.
-   MHW-QA-02 is closed by the real shared Zone Settings dialog in English and Russian, including inherited/customized labels, read-only behavior, keyboard/focus handling, save/cancel/reset, localized errors, and reload.
-   MHW-QA-03 and MHW-QA-07 are closed by the browser geometry and visual matrix: fixed mode keeps one measured header and spacer stable, flow mode scrolls away without fixed residue, and desktop/tablet/mobile EN/RU light/dark projects passed with axe checks for fixed desktop and the open mobile Drawer.
-   MHW-QA-04, MHW-QA-05, and MHW-QA-06 are closed by the metahub sparse inheritance, application source-baseline/sync, snapshot round-trip, and Start/End placement flows. Repeated local sync preserves local values, targeted reset reveals the current source, and generated/copied identities remain server-owned UUID v7 values.
-   MHW-QA-08 is closed by the focused apps-template Vitest suite (7 files / 74 tests), the shared Zone Settings Jest suite (3/3), and the affected package suites. The earlier FormDialog timeout was isolated and is not a current reproducible failure; no ownership-boundary failure remains in the current implementation.
-   MHW-QA-09 is closed by the canonical local-minimal-Supabase run: 13 flow tests passed with one intentional standalone skip, 5 visual projects passed, the full 36/36 workspace build passed, and docs provenance, 113 EN/RU page pairs, screenshot assets, local links, lint, Prettier, and diff checks passed. Thermos findings were fixed; the local autoreview helper produced no structured verdict because its external review streams were unavailable.
-   MHW-QA-10 is closed by the synchronized plan Acceptance Checklist, this checklist, `progress.md`, package READMEs, and paired GitBook documentation. The standalone deployment boundary remains explicitly BLOCKED/skipped when no authenticated shell is configured and is not counted as acceptance.

# Marketing header widget-zone settings — QA remediation (2026-09-13)

> This is the authoritative checklist for the current IMPLEMENT pass. Resolve every confirmed QA finding from the 2026-09-13 review while preserving the clean-break contract, the existing MUI primitives, UUID v7, SQL-first/RLS access boundaries, EN/RU i18n, and the no schema/snapshot/metahub-template version bump requirement.

-   [x] MHW-QA-00 Re-baseline the dirty worktree, refresh the implementation boundary from the brief/research/plan and QA findings, read the relevant package READMEs and skills, and record OntoIndex limitations before edits. The graph is fresh for committed `d9712619b23b6636354a2a4cdf117c3021c94a36` but excludes the current dirty/untracked feature files; direct source inspection remains authoritative.
-   [x] MHW-QA-01 Make inactive persisted data widgets authoritative in the marketing header projection; add unit coverage for inactive brand/navigation/auth/language/theme widgets and verify zero rendered controls.
-   [x] MHW-QA-02 Remove all legacy raw-config/legacy-composite fallback readers from the effective application-layout paths; enforce strict neutral-envelope decoding and add malformed/unsupported persisted-data tests without changing the physical JSONB carrier or versions.
-   [x] MHW-QA-03 Complete the descriptor-driven zone-settings contract: typed descriptors, strict value resolution, shared dialog rendering, registry capability lookup, typed runtime effective-layout input, and fail-closed unsupported setting/zone/template behavior.
-   [x] MHW-QA-04 Remove the remaining Dashboard shell ownership fallback once persisted top composition is absent; ensure bootstrap/materialization produces the canonical top composition and add regression coverage without reviving boolean demo controls.
-   [x] MHW-QA-05 Add real consumer coverage for Application Layouts and metahub LayoutDetails using the shared authoring/settings primitives, including localized read-only, inherited/reset, pending/error, keyboard/focus, and responsive contracts; split only the directly affected oversized responsibilities where safe.
-   [x] MHW-QA-06 Extend Playwright canonical execution to include scoped-layout lifecycle; add two-browser-context concurrency proof, localized conflict/rollback/reload/runtime-winner assertions, dialog responsive/keyboard evidence, editor-role browser coverage, global browser-error checks, and explicit skip/retry observability.
-   [x] MHW-QA-07 Correct the public zone-setting API response types, grouped drop-target accessibility label handling, and strengthen shared runtime UX oracles for technical leakage, object/JSON rendering, localized validation, multiline content, and page overflow.
-   [x] MHW-QA-08 Run Prettier, package lint/typecheck/build, focused and relevant full Jest/Vitest suites, local minimal-Supabase Playwright verification with inspected screenshots, docs/contract/isolation checks, OntoIndex diff verification, and Thermos/autoreview where the environment permits; update progress and close only evidenced tasks.

-   Canonical local verification passed on 2026-09-13: the workspace E2E build completed 36/36 packages; Chromium recorded 15 passed tests plus one explicit opt-in standalone skip, with zero retries and zero unexpected results; the visual matrix passed all 5 projects with zero retries and zero unexpected results. The wrapper reset its test schemas and stopped the dedicated local Supabase profile.
-   Snapshot publication consistency is now protected by a shared PostgreSQL transaction advisory lock: layout, widgets, and overrides are captured in one transaction using the same `mhb-layout-graph:<schema>` lock as mutations. The real PostgreSQL concurrency integration test passed 1/1, and generated OpenAPI now constrains application zone-setting values to strings of 1–128 characters.
-   Fresh authoring and EN/RU light/dark responsive screenshots from artifact `tools/testing/e2e/.artifacts/marketing-page/2026-09-13T14-16-38-395Z/` were inspected. Documentation provenance, 113 EN/RU GitBook page pairs, screenshot assets, local links, package lint/build checks, OpenAPI validation, and `git diff --check` passed. The standalone deployment test remains an explicit opt-in skip without configured external host credentials.
-   Final isolated changed-surface suites passed: applications backend 378 tests, metahubs backend 120 tests plus 4 intentional skips and the PostgreSQL concurrency proof, apps-template marketing 27 tests, applications frontend 34 tests, metahubs frontend 8 tests, shared template 6 tests, types 199 tests, and utils 368 tests. An intentionally parallel broad frontend run also exposed load-sensitive timeouts/failures in unchanged legacy suites; those files are outside this feature's changed surface and were not used as acceptance evidence.

# LQR5-15 batch A — stale Playwright Chromium flow suite refresh (2026-09-19)

> Scope: metahub entity/resource flows, create/options flows, shared-common layout widget versioning, packages CSP host probe, connector board migrations, imported snapshot connector sync, workspace regressions, quiz layout helpers, and snapshot export/import. Other batches own INW/LMS/mmoomm and metahub-basic-pages.

-   [x] LQR5-15A-01 `metahub-entity-resources.spec.ts`: exercise an editable custom entity type (empty template) instead of the template-managed `object` type; keep resource-label assertions strict.
-   [x] LQR5-15A-02 `metahub-entities-workspace.spec.ts`: align heading/button/dialog expectations with the unified entity collection surface (`Create`, plain type name, `Create/Edit <type name>` dialogs).
-   [x] LQR5-15A-03 `metahub-entities-publication-runtime.spec.ts`: align primary action label with `Create`.
-   [x] LQR5-15A-04 `metahub-standard-preset-runtime.spec.ts`: select the tabular object collection explicitly instead of relying on default-first resolution over non-physical preset clones; report residual default-active product risk.
-   [x] LQR5-15A-05 `metahub-create-options-codename.spec.ts`: assert default-entity create options through entity-type absence instead of listing instances of unseeded kinds (which return 400).
-   [x] LQR5-15A-06 `metahub-create.spec.ts`: use the current `Resource tab address segment` label.
-   [x] LQR5-15A-07 `metahub-shared-common.spec.ts`: verify the re-read + `expectedVersion` zone-widget delete helper already present in the worktree.
-   [x] LQR5-15A-08 `metahub-packages-resources.spec.ts`: request the SPA host document with `Accept: text/html` so the intentional strict document fallback returns 200 with the PlayCanvas host CSP.
-   [x] LQR5-15A-09 `application-connector-board-migrations.spec.ts`: scope the Migration History heading to the view header title region.
-   [x] LQR5-15A-10 `application-connectors.spec.ts` + `snapshot-export-import.spec.ts` + fixture contract: fix the regenerated self-hosted fixture scoped layout `defaultViewMode` (`list` is no longer a valid dashboard view mode) and the stale `includedCatalogSectionCodename` property.
-   [x] LQR5-15A-11 `application-workspace-regressions.spec.ts`: add the isolation member with the `editor` role, matching the sibling shared-rows test and the product role-permission model.
-   [x] LQR5-15A-12 `application-runtime-modules-quiz*.spec.ts`: verify the re-read + `expectedVersion` zone-widget delete helpers already present in the worktree.
-   [x] LQR5-15A-13 Run Prettier on every edited file, run focused package tests/lint for touched product-adjacent helpers, and run OntoIndex diff verification.

# LQR5-15 batch A — round 4 follow-up (2026-09-19)

-   [x] LQR5-15A-R4-01 `application-runtime-modules-quiz.spec.ts`: send `expectedVersion` from the freshly fetched layout on the API zone-widget assignment.
-   [x] LQR5-15A-R4-02 `metahub-entities-workspace.spec.ts`: open entity-instance row actions through the `BaseEntityMenu` Options trigger and pick `edit`/`copy` menu items instead of removed inline row buttons.
-   [x] LQR5-15A-R4-03 `metahub-entity-resources.spec.ts`: author both the entity resource tab title and the shared resources tab title (the shared Resources workspace resolves shared-title labels) and assert both persisted surfaces.
-   [x] LQR5-15A-R4-04 `metahub-packages-resources.spec.ts`: scope the Russian package-operation error assertion to the attach dialog to avoid the snackbar strict-mode collision.
-   [x] LQR5-15A-R4-05 `metahub-shared-common.spec.ts`: assert the real quiz completion result (Quiz complete!, Score: 1 / 1, explanation) produced by the shared library module instead of the removed missing-submit fallback message.
-   [x] LQR5-15A-R4-06 `metahub-standard-preset-runtime.spec.ts`: address the runtime resolver with the persisted (style-normalized) object codename read from the create response; product default/menu selection fix re-verified as correct.

# LQR5-15 batch A — final round (2026-09-19)

-   [x] LQR5-15A-F-01 `metahub-entities-workspace.spec.ts` breadcrumb: scope the Objects crumb assertion to the non-current link (`a:not([aria-current])`) so the href check stays strict without matching the current-page instance crumb.
-   [x] LQR5-15A-F-02 `metahub-entities-workspace.spec.ts` module authoring: close the entity dialog through the "Discard unsaved changes?" confirmation and assert zero DOM dialogs before reopening the row menu; replaces the aria-hidden-prone role-count assertion.

# LQR5-15 batch A — records tab breadcrumb (2026-09-19)

-   [x] LQR5-15A-F-03 `metahub-entities-workspace.spec.ts`: the Records/Elements tab is route-backed but adds no breadcrumb segment; replace the stale breadcrumb text assertion with strict assertions of the actual contract (selected tab + exact `/records` authoring pathname). Product gap reported: `NavbarBreadcrumbs.tsx` still matches the legacy `elements` route segment.

# GH907 Codex review remediation — migration drift and alias resolution (2026-09-19)

> Branch `fix/gh907-consortium-runtime-remediation`. Codex P1 findings: applied-migration mutation (admin + applications) and closed-application alias resolution under RLS.

-   [x] R1-01 Restore `packages/universo-react-admin-backend/src/platform/migrations/index.ts` to base revision `af0109016` so `FinalizeAdminSchemaSupport1733400000001` keeps its applied checksum.
-   [x] R1-02 Add a new `AddAdminShellPermission1733400000003` post-schema migration definition carrying `admin.has_admin_shell_permission` plus its revoke/grants; register it in `adminSystemAppDefinition` and barrel exports.
-   [x] R1-03 Update admin migration/definition/platform ordering tests and add an immutability guard for the frozen finalize baseline.
-   [x] R2-01 Restore `1800000000000-CreateApplicationsSchema.sql.ts` to base revision `af0109016` so `FinalizeApplicationsSchemaSupport1800000000001` keeps its applied checksum.
-   [x] R2-02 Keep the legacy `slug` column in the applications business-table manifest so the frozen finalize baseline can still materialize on fresh installs (impossible to change an applied migration).
-   [x] R2-03 Create `AddApplicationAliases1800000000101` with the alias table/indexes/functions/RLS/grants; register it after the admin shell migration (version ordering `1733400000003 < 1800000000101`).
-   [x] R3-01 Add `applications.resolve_application_alias(TEXT)` SECURITY DEFINER resolver returning only the application id, with scoped grants.
-   [x] R3-02 Switch `findApplicationIdByActiveAlias` to the SECURITY DEFINER resolver and keep the 404/non-member contract in `applicationRuntimeReferenceController`.
-   [x] R3-03 Add controller/store unit tests and real-PG integration coverage for alias resolution of a closed application by a plain member.
-   [x] R4-01 Update `MIGRATIONS.md` and migration ordering expectations in `platformMigrations.test.ts`.
-   [x] R4-02 Verify: Prettier, both package builds, both package test suites, `migration:validate`, `migration:lint`.
-   [x] R4-03 Residual risk recorded: PostgreSQL-backed integration suites stay opt-in/skipped without `DATABASE_TEST_URL`, and databases bootstrapped from the pre-fix branch revision carry the drifted checksum and must be reset before this definition set can boot.

# GH907 Codex review remediation — five frontend/routing findings (2026-09-19)

> Branch `fix/gh907-consortium-runtime-remediation`. Scope: applications frontend + shared routing utils. No Playwright, no lockfile changes, no commit.

-   [x] F1-01 Preserve `location.hash` in the canonical alias redirect (`buildCanonicalApplicationRuntimePath` + `ApplicationRuntime.tsx` call site) and add hash/search/path preservation tests.
-   [x] F2-01 Preserve `location.hash` in the anonymous `/auth` redirect `state.from` (`ApplicationRuntimeEntry.tsx`) and add a redirect-state test.
-   [x] F3-01 Treat `/a/:applicationRef/*` as non-public for 401 handling in `isPublicRoute()` (the anonymous public bootstrap is fetch-based, not axios), update route tests, and add interceptor-decision tests.
-   [x] F4-01 Make the public-entry workspace selector paginated + always render the current selection (`usePublicEntryWorkspaceSettings` infinite query, single-workspace fallback, MUI Select load-more) with focused hook tests.
-   [x] F5-01 Allow the aliases page when the user holds any alias action, gate the table on `read`, show a localized read-required state otherwise, and keep create available to create-capable users.
-   [x] F6-01 Verify: Prettier on edited files, `@universo-react/utils` + `@universo-react/applications-frontend` builds and test suites, focused workspace-selector tests.

# GH907 Codex review remediation — ReDoS in pattern safety gate (2026-09-19)

> Branch `fix/gh907-consortium-runtime-remediation`. Codex P1: `isUsableValidationPattern` missed overlapping-alternation exponential patterns such as `^(a|aa)+$`, so runtime/design-time write paths could execute them synchronously against values up to 4096 chars. No Playwright, no commit.

-   [x] P1-01 Harden `patternSafety.ts` with a shared decision: keep the legacy single-atom nested-quantifier rule, extract repeated groups and analyze each unbounded (or large-bounded) repetition with `redos-detector` bounded by `maxSteps`/time budget, cache decisions.
-   [x] P1-02 Export `isUnsafeValidationPattern` and make runtime `runtimeRecordRules.ts` fail closed with the existing localized `RECORD_PATTERN_MISMATCH` shape for unsafe patterns.
-   [x] P1-03 Make design-time `MetahubRecordsService.validateRules` fail closed with the existing `does not match pattern` error for unsafe patterns.
-   [x] P1-04 Guard `fixedValue/controller.ts` (`parseConstantValue`) with the shared decision and fail closed with the existing pattern error.
-   [x] P1-05 Add dependency `redos-detector@6.1.4` to `@universo-react/utils` and refresh the lockfile with `pnpm install --lockfile-only`.
-   [x] P1-06 Tests: `^(a|aa)+$`, nested quantifiers, safe template patterns, value/pattern boundary lengths at both surfaces.
-   [x] P1-07 Verify: Prettier, utils build+test, metahubs/applications backend builds+tests, `check:zod-resolution`, `check:catalog-versions`.
-   [x] P1-08 Residual risk: bounded quantifiers with upper bound below 16 repeat the legacy rule only, and authoring schemas still accept syntactically valid unsafe patterns (value paths fail closed instead).

# Unified entity-backed Hero implementation — QA remediation (2026-09-24)

> Current continuation checklist. Preserve the existing clean-break contract, entity-owned Hero content, transaction/RLS boundaries, UUID v7, bilingual UX, and no schema or metahub-template version bump.

-   [x] UEH-IMPL-QA-01 Exclude system lifecycle fields from Hero authoring and strengthen browser UX oracles for visible control values and compact structured data.
-   [x] UEH-IMPL-QA-02 Make scoped-layout copy `omit` account for inherited bound Hero placements and prove failure atomicity.
-   [x] UEH-IMPL-QA-03 Treat application-sync Hero copy restrictions as a localized, preflighted conflict that preserves application schema health.
-   [x] UEH-IMPL-QA-04 Add responsive proof for Hero records and both layout list/card modes; assert multiline layout descriptions and localized validation.
-   [x] UEH-IMPL-QA-05 Decompose oversized authoring E2E coverage into focused helpers without weakening the human-use workflow.
-   [x] UEH-IMPL-QA-06 Strengthen transaction, binding-policy, null-projection, and copy rollback tests; run focused suites and required local-Supabase verification.
-   [x] UEH-IMPL-QA-07 Run formatting, lint/build, docs and diff checks, OntoIndex diff verification, and Thermos review; record only fresh evidence in progress/docs. OntoIndex path verification passed in explicit batches, with its dirty-tree/symbol-scan limits documented; full-worktree Autoreview timed out.
-   [x] UEH-IMPL-QA-08 Validate Hero actions before reactivating a previously disabled bound Hero placement; assert pre-write fail-closed rejection for a hidden target and for resetting an inactive Hero whose target is no longer valid.
-   [x] UEH-IMPL-QA-09 Reject snapshots whose bound Hero Components are nested, matching the root-Component contract enforced by binding persistence.
-   [x] UEH-IMPL-QA-10 Assert the shared layout list is rendered once in each `error`/data branch, extract copy-dialog viewport evidence into a focused helper, and rerun the Hero unit gate plus minimal-Supabase authoring E2E.
-   [x] UEH-IMPL-QA-11 Enable public application visibility through the existing settings UI before anonymous published-runtime verification; keep the anonymous browser assertion strict and verify the full local-Supabase journey.
-   [x] UEH-IMPL-QA-12 Remap active public section-action targets after opaque widget-key redaction, sanitize UUID references to unavailable sections, and make shared section/widget anchors injective for punctuation-distinct keys.
-   [x] UEH-IMPL-QA-13 Verify UUID-free anonymous runtime DTOs, real touch CTA navigation, and responsive/overflow behavior for Settings and the anonymous published runtime with inspected screenshots.
-   [x] UEH-IMPL-QA-14 Route the published-runtime failure/retry E2E fault through the exact anonymous GET endpoint; verify three 5xx attempts, localized error and recovery, and wait for auth permission responses before locale navigation.
-   [x] UEH-IMPL-QA-15 Preserve public anchor-map alignment when active widgets lack persisted instance keys, including empty and whitespace values; prove deterministic public fallback identities.
-   [x] UEH-IMPL-QA-16 Make retry failure counts and allowed browser errors precise, and cover direct Hero editing at 1920×1080.
-   [x] UEH-IMPL-QA-17 Improve narrow-screen Application Settings control layout and associate select labels for accessible names, based on inspected screenshots and browser semantics.
-   [x] UEH-IMPL-QA-18 Keep the authoring E2E spec below 1,000 lines by extracting settings, member-permission, and anonymous-runtime steps into focused helpers with local resource cleanup.
-   [x] UEH-IMPL-QA-19 Add unit-level usage contracts for the shared `StandardDialog` in both Hero binding and widget configuration surfaces.

## 2026-09-25 — Entity-backed Hero automatic provisioning and advanced source customization

-   [x] Define the UI/architecture contract for one-click Hero creation, advanced source customization, and shared-source warnings.
-   [x] Implement backend transactional auto-provisioning for a new Hero placement with a fresh Entity record and unique semantic key.
-   [x] Add advanced source-selection/customization flow using existing MUI/StandardDialog patterns, including existing-record selection and shared-source warning.
-   [x] Preserve permissions, optimistic concurrency, binding integrity, delete protection, publication/snapshot/application lifecycle, i18n, and no raw IDs/JSON.
-   [x] Add/adjust focused unit and integration tests for auto-create, atomic rollback, uniqueness, reuse/shared-source detection, permissions, and conflicts.
-   [x] Extend Playwright authoring coverage for the default one-click flow and advanced flow in EN/RU, keyboard, responsive, and screenshot evidence using local minimal Supabase.
-   [x] Update relevant README/GitBook architecture documentation and memory-bank progress.
-   [x] Run Prettier/lint/type/build/targeted gates and final Thermos/runtime UX reviews. The broad Autoreview reached `INCOMPLETE/ENGINE_TIMEOUT`; bounded Thermos reviews found one custom-source runtime defect, which was fixed and verified. OntoIndex could not verify the accumulated dirty tree because the index excludes it and the expected-file list covered only the latest narrow fix.

## Shared MUI dropdown controls — IMPLEMENT (2026-09-25)

> Preserve the pre-existing dirty worktree. Build reusable dropdown/select controls in `@universo-react/template-mui`, apply them throughout non-published authoring/admin interfaces, exclude `apps-template-mui`, shorten the Hero binding actions, and add unit/browser regression coverage.

-   [x] DD-01 Inventory current Select/Autocomplete patterns and inspect existing shared field/menu conventions; define an API that supports select, searchable selection, optional reset and trailing actions.
-   [x] DD-02 Implement and export typed shared controls with consistent MUI styling, accessibility, localization-friendly action labels and tests.
-   [x] DD-03 Migrate non-published template, metahub, applications-control-panel and admin dropdowns to the shared controls; preserve specialized option/render behavior and keep `apps-template-mui` isolated.
-   [x] DD-04 Shorten Hero binding dialog labels and assert each visible button and public Hero CTA remains single-line and unclipped at desktop, tablet and mobile widths.
-   [x] DD-05 Verify shared popup geometry, keyboard dismissal, responsive overflow and inspected browser screenshots; run focused unit/type/lint/build and applicable docs checks.
-   [x] DD-06 Complete focused Thermos reviews and OntoIndex post-edit verification, update this checklist and `progress.md`, and record that the broad Autoreview timed out and the graph index does not contain the dirty worktree.
-   [x] DD-07 Replace fallback-only dropdown localization mocks with real English/Russian i18n-resource assertions.
-   [x] DD-08 Add an AST architecture guard for direct MUI Select/Autocomplete imports outside the shared controls, including JS/JSX sources and excluding the isolated published-app template.
-   [x] DD-09 Require visible source-option text and UUID-free labels in Playwright; resolve empty localized source names, and give the shared theme-menu trigger localized accessible semantics with a matching controls target.
