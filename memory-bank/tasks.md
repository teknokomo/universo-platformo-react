# Tasks

> Active and planned work only. Durable completed outcomes live in progress.md; reusable implementation rules live in systemPatterns.md.

---

## Current Task Ledger (Canonical)

## Completed Session: 2026-04-11 PR #757 Review Comment QA Triage

- [x] Gather unresolved PR review comments, issue comments, and file context for PR #757.
    - Outcome: public GitHub review data confirmed one actionable backend lifecycle-risk comment and multiple package-local indentation comments from the bot review.
- [x] Verify each reviewer suggestion against the current code and external documentation before changing code.
    - Outcome: the high-priority create-path comment was validated against the generic entity controller/service flow plus PostgreSQL INSERT semantics, while the indentation comments were rejected because neighboring metahubs-backend controllers/services already use the same indentation style and the bot referenced a non-existent `.gemini/styleguide.md` path.
- [x] Implement only the fixes that are confirmed correct and non-regressive for the shipped Entities/ECAE surface.
    - Outcome: `MetahubObjectsService.createObject(...)` now accepts an optional explicit `id`, and generic custom-entity create passes the same preallocated UUID into persistence so `beforeCreate` and `afterCreate` can refer to the same persisted object id.
- [x] Re-run focused validation for every touched surface and finish with the canonical root build if required by the final patch set.
    - Outcome: focused metahubs-backend tests passed (`34/34`) across entity instance routes, lifecycle services, and object-service coverage, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- [x] Sync memory-bank status after the review-driven fixes are validated.
    - Outcome: the review triage result, lifecycle-id consistency rule, and final validation evidence are now reflected in the current memory-bank state.

## Completed Session: 2026-04-11 Entities QA Closure Remediation

- [x] Wire real lifecycle action execution through the generic entity mutation path.
    - Outcome: generic custom-entity create now routes through `EntityMutationService`, and the service resolves the committed object id from the mutation result before `afterCreate` dispatch so lifecycle actions execute against the real persisted row.
- [x] Align automation authoring ACL between frontend tabs and backend routes.
    - Outcome: the suspected ACL drift closed by verification rather than a speculative patch; catalog-compatible routes short-circuit into `CatalogList`, so the generic `Actions`/`Events` tabs remain mounted only on the generic custom-entity surface.
- [x] Add direct regression coverage for the automation authoring surface.
    - Outcome: focused `EntityAutomationTab` coverage now locks save-first validation plus action/event authoring seams, and focused `EntityInstanceList` coverage still proves catalog-compatible routes delegate to `CatalogList` instead of mounting the generic automation tabs.
- [x] Finish the missing publication-quality Entities documentation artifacts.
    - Outcome: EN/RU custom-entity workflow guides now include the save-first `Scripts -> Actions -> Events` authoring sequence, and stable GitBook-compatible visual assets now live under `docs/assets/entities/`.
- [x] Re-run focused validation, browser proof, and the canonical root build before closing.
    - Outcome: focused metahubs backend coverage passed (`27/27`), focused metahubs frontend automation coverage passed (`12/12`), `pnpm docs:i18n:check` passed, `pnpm run build:e2e` completed green after fixing a build-only `DbExecutor` type import, the targeted Chromium automation flow passed (`2 passed`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).

## Active Session: 2026-04-11 ECAE Residual Completion

- [x] Route generic entity create through the transaction-aware lifecycle boundary.
    - Outcome: `entityInstancesController` now routes generic create through `EntityMutationService`, the service can resolve an after-commit object id from the mutation result, and the focused backend lifecycle/route tests passed (`25/25`).
- [x] Add the missing edit-time Actions and Events authoring surface for generic custom entity instances.
    - Outcome: `EntityInstanceList` now mounts edit-only `Actions` and `Events` tabs when the entity type enables those components, the tabs reuse the existing `EntityFormDialog` shell, and the new CRUD surface stays object-scoped instead of inventing a second authoring shell.
- [x] Add focused regression coverage for the new lifecycle and entity-automation seams.
    - Outcome: focused backend coverage still locks the create-path lifecycle boundary, and focused `EntityInstanceList` coverage now proves create dialogs stay minimal while edit dialogs expose `Attributes`, `Layouts`, `Scripts`, `Actions`, and `Events` only when the entity type supports them.
- [x] Extend browser proof so the shipped ECAE surface demonstrates script → action → event-binding authoring end to end.
    - Outcome: the focused `metahub-entities-workspace` Chromium flow now proves browser-authored script creation, action creation, and event-binding creation for a generic custom entity instance, with API-level persistence checks after the browser steps.
- [x] Re-run targeted validation and the canonical root build, then sync memory-bank closure notes.
    - Outcome: focused metahubs backend tests passed (`25/25`), focused metahubs frontend dialog coverage passed (`7/7`), the targeted Chromium automation flow passed (`2 passed` including auth bootstrap), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).

## Completed Session: 2026-04-11 Entities QA Remediation Hardening

- [x] Re-baseline the confirmed QA defects against the current dirty working tree before editing code.
    - Outcome: `ElementList` still declares `buildCatalogTabPath` after the early invalid/loading/error returns, and `EntityMutationService` still lets post-commit `after*` dispatch failures escape instead of matching the already-shipped runtime after-commit logging/suppression pattern.
- [x] Repair the real `ElementList` hook-order violation without changing the established catalog-compatible UI flow.
    - Outcome: `buildCatalogTabPath` now lives above the invalid/loading/error early returns, the touched `ElementList` memo dependencies include the dialog handlers they actually capture, and the catalog-compatible navigation behavior stayed unchanged.
- [x] Harden the design-time entity mutation lifecycle contract so after-commit event failures cannot surface as a false API mutation failure.
    - Outcome: `EntityMutationService` now routes post-commit `after*` dispatches through a dedicated non-blocking helper that logs failures instead of rethrowing them, matching the repository’s existing runtime after-commit lifecycle pattern.
- [x] Re-run focused lint/tests for the touched frontend/backend surfaces and fix any new error-level debt introduced by the remediation.
    - Outcome: the focused lifecycle service Jest path passed (`3/3`), `@universo/metahubs-frontend` lint and `@universo/metahubs-backend` lint now return to warning-only backlog with no error-level failures, and the touched feature files were formatted back to the repository’s Prettier contract.
- [x] Re-run the canonical root build only after the focused remediation stack is green.
    - Outcome: the repository-standard root `pnpm build` completed green after the fixes (`30 successful`, `30 total`), so the remediation no longer depends on focused-only evidence.
- [x] Sync memory-bank status files after the remediation is fully validated.
    - Outcome: `activeContext.md` and `progress.md` now record the closed hook-order and after-commit lifecycle hardening pass together with the final green validation evidence.

## Completed Session: 2026-04-11 Entities Workspace Post-Rebuild QA Closure

- [x] Re-baseline the post-rebuild Entities page defects against the current shared Catalog V2 surface.
    - Outcome: confirmed the live regressions after full rebuild + fixture import were limited to stale top copy, oversized banner side spacing, a missing built-in Documents translation path, non-standard CTA/menu parity, the list-view blank-edit seam, and stale singular `Catalog V2` product strings.
- [x] Restore `EntitiesWorkspace` page parity and robust menu-driven edit behavior.
    - Outcome: the obsolete page description was removed, the header CTA now follows the shared `Create` contract, the info banner side spacing was tightened, delete now uses the legacy danger-group menu contract, and menu actions resolve the latest entity through the current entity-type map instead of trusting `row.raw`.
- [x] Rename the Catalog V2 preset and fixture-facing product strings to `Catalogs V2` / `Каталоги V2` without changing codename/schema versions.
    - Outcome: preset manifests, backend/frontend expectations, Playwright flows, visual proofs, fixture contracts, and generated snapshot content now use the plural product naming while preserving `custom.catalog-v2` plus the existing structure/template versions.
- [x] Re-export the self-hosted metahub fixture from the supported Playwright generator after the rename.
    - Outcome: `tools/fixtures/metahubs-self-hosted-app-snapshot.json` was regenerated through the supported Playwright generator flow only, and the refreshed snapshot now contains the pluralized display strings plus `nameKey: "Catalogs V2"`.
- [x] Re-run focused validation and sync memory-bank only after the repaired implementation is green.
    - Outcome: focused metahubs backend coverage passed (`24/24`), focused metahubs frontend coverage passed (`22/22`), `pnpm run build:e2e` completed green, the supported self-hosted generator rerun passed, the focused Chromium entities workspace flow passed (`4 passed`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).

## Active Session: 2026-04-11 Catalog V2 QA Closure Implementation

- [x] Re-baseline the confirmed QA defects against the current shared Catalog V2 surface before editing code.
    - Outcome: confirmed the remaining issues were exactly the entity-route breadcrumb truncation, missing built-in documents localization, non-standard `EntitiesWorkspace` action affordances, the list-view edit regression seam, and stale Playwright expectations around the shared Catalogs contract.
- [x] Restore Entities workspace action parity on top of the shared menu contract and close the list-view edit regression.
    - Outcome: `EntitiesWorkspace` now reuses `BaseEntityMenu` in both list and card modes, the ad-hoc icon-button action cluster is gone, and focused RTL now proves the shared list-view menu opens the populated edit dialog.
- [x] Complete the entity-route navigation and localization seams for the shipped Catalog V2 flow.
    - Outcome: `NavbarBreadcrumbs` now continues through entity-instance catalog-compatible routes (including instance labels and tab labels), and EN/RU metahubs locale bundles now include the missing built-in `documents.title` translation.
- [x] Align the focused RTL and Playwright proof with the intended shared Catalogs-shell UX.
    - Outcome: the targeted browser specs now follow the actual shared Catalogs contract for catalog-compatible routes: heading `Catalogs`, primary toolbar label `Create`, dialog title `Create Catalog`, create mutation via `/catalogs`, plus explicit breadcrumb coverage on entity-instance authoring routes.
- [x] Re-run focused validation, then sync memory-bank closure state only after the repaired implementation is green.
    - Outcome: focused `@universo/metahubs-frontend` RTL passed (`5/5`), the canonical root `pnpm build` completed green (`30 successful`, `30 total`), both affected Chromium flow specs passed in isolation, and the combined targeted Chromium rerun passed (`5 passed`).

## Completed Session: 2026-04-10 Catalog V2 Isolated UI Recovery

- [x] Re-baseline the Catalog V2 route-surface regression against the current shared catalog-compatible implementation.
    - Outcome: confirmed that `EntityInstanceList` short-circuited catalog-compatible kinds into `CatalogList`, while `CatalogList`, `AttributeList`, and `ElementList` still hardcoded legacy `/catalog/:id/*` navigation.
- [x] Restore an isolated Catalog V2 frontend surface while keeping the shared storage model intact.
    - Outcome: added a shared route-aware catalog authoring path helper, registered entity detail routes for attributes/system/elements, and rewired catalog lists/tabs/blocking-dialog links so Catalog V2 stays under `/entities/:kindKey/instance/:catalogId/*` while still reading and writing the shared catalog-backed rows.
- [x] Refresh focused frontend and browser regressions for the isolated Catalog V2 contract.
    - Outcome: targeted frontend regressions now cover immediate Catalog V2 surface render on the known route, entity-route system redirects, and entity-route element tab navigation.
- [x] Re-run focused validation plus the canonical root build after the route/UI recovery.
    - Outcome: focused `@universo/metahubs-frontend` Vitest coverage passed (`13/13`) and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- [x] Sync memory-bank closure notes only after the repaired Catalog V2 surface is validated.
    - Outcome: `activeContext.md`, `progress.md`, `systemPatterns.md`, and this ledger now preserve the isolated Catalog V2 entity-route contract instead of the earlier legacy-route fallback behavior.

## Active Session: 2026-04-10 Catalog V2 Shared Surface Closure

- [x] Re-baseline the remaining Catalog V2 gaps against the current entity-route implementation and fixture generator contract.
    - Outcome: the concrete residual gaps were confirmed as route-surface drift on catalog-compatible entity pages, current-locale-only preset defaults, stale read-only expectations after the shared-surface switch, and the need to refresh the supported self-hosted fixture export.
- [x] Restore Catalog V2 page parity by routing catalog-compatible entity views through the shared catalogs authoring surface instead of the generic empty-state shell.
    - Outcome: `EntityInstanceList` now delegates catalog-compatible kinds to `CatalogList`, legacy and Catalog V2 rows are visible from the same list surface, and `CatalogList` now fail-closes create/edit/copy/delete affordances behind the metahub `editContent` / `deleteContent` permission seam.
- [x] Persist localized preset labels for catalog-compatible entity types so English and Russian defaults survive create flows and dynamic menu rendering.
    - Outcome: the `catalog-v2` preset now seeds localized `presentation.name` / `presentation.description`, entity-type form patches preserve both locales, edit payloads persist localized presentation data, and dynamic menu labels now prefer localized presentation text over current-locale-only UI keys.
- [x] Update the focused frontend/browser/generator coverage and export a fresh `tools/fixtures/metahubs-self-hosted-app-snapshot.json`.
    - Outcome: focused frontend tests are green, the workspace Playwright flow passed with the shared catalog surface (`4 passed`), the visual parity spec passed (`2 passed`), and the supported generator reran successfully to refresh `tools/fixtures/metahubs-self-hosted-app-snapshot.json`.
- [x] Sync memory-bank closure notes only after the focused validation evidence is green.
    - Outcome: `activeContext.md`, `progress.md`, and this ledger now record only the validated shared-surface, localized-preset, read-only ACL, and refreshed fixture contracts from this pass.

## Completed Session: 2026-04-10 ECAE QA Gap Implementation

- [x] Align the new entity authoring surfaces with the legacy Catalogs page-shell contract.
    - Outcome: `EntitiesWorkspace` and `EntityInstanceList` now reuse the legacy `CatalogList` `MainCard` shell props, and focused frontend tests lock the exact shell contract so default card width/padding drift cannot regress silently.
- [x] Seed and publish `Catalogs V2` in the self-hosted generator path and refresh the committed fixture.
    - Outcome: `selfHostedAppFixtureContract.mjs` now resolves `CURRENT_STRUCTURE_VERSION_SEMVER` from metahubs-backend dist with a `0.4.0` fallback, the supported generator path reran cleanly, and the refreshed `tools/fixtures/metahubs-self-hosted-app-snapshot.json` now carries `structureVersion: 0.4.0` plus `snapshot.entityTypeDefinitions['custom.catalog-v2']`.
- [x] Close the remaining catalog-compatible entity lifecycle regression debt in focused backend/browser coverage.
    - Outcome: the generic detail route keeps its default active-row behavior but now supports explicit `includeDeleted=true` reads for deleted-state and restore flows; focused backend route coverage passed (`21/21`) and the browser lifecycle proof is green again.
- [x] Extend the visual/browser parity proof to the full page shell.
    - Outcome: the parity spec now has committed Linux page-shell baselines for legacy Catalogs and the catalog-compatible entity surface, and the focused visual rerun passed (`2/2`).
- [x] Re-run the targeted validation stack and the canonical builds after the implementation pass.
    - Outcome: the supported self-hosted generator reran successfully, `pnpm run build:e2e` completed green, the focused lifecycle/browser proof passed, the focused visual proof passed, and the canonical root `pnpm build` completed green with `EXIT:0`.
- [x] Sync memory-bank state only after the implementation pass is green.
    - Outcome: `activeContext.md`, `progress.md`, `systemPatterns.md`, `techContext.md`, and this task ledger now reflect the completed generator, deleted-detail, page-shell parity, and validation contracts instead of the earlier blocker state.

## Completed Session: 2026-04-10 TSConfig Build Compatibility Fix

- [x] Re-baseline the failed root build against the actual workspace TypeScript version.
    - Note: the workspace catalog pins `typescript: ^5.8.3`, so the failing build had to be aligned with the real compiler contract instead of the editor-only TS6 diagnostics layer.
- [x] Replace the invalid `ignoreDeprecations` values in the touched package configs with a build-compatible transition guard.
    - Note: the touched configs now use `ignoreDeprecations: "5.0"`, preserving the earlier `rootDir` additions while restoring compatibility with the workspace compiler.
- [x] Re-run the canonical root build and sync memory-bank only after the build is green again.
    - Note: the canonical root `pnpm build` is green again (`EXIT:0`), so the ledger no longer claims a false green closeout on a red build.

## Active Session: 2026-04-10 ECAE Final Closeout

- [x] Sync the remaining closeout scope to the verified code state.
    - Note: current-tree audit already confirmed generic REF and custom-entity scripting are implemented on the shipped surface; the remaining work is toolchain closeout, fresh validation, and memory-bank sync.
- [x] Patch the minimal TS6 tsconfig fallout in the touched packages only.
    - Note: the touched backend/types packages now declare explicit `rootDir`, the touched frontend/backend package configs locally suppress the current TS6 `baseUrl` deprecation, and editor diagnostics are clean on the patched `tsconfig` files.
- [x] Re-run diagnostics and the canonical root build on the final patch set.
    - Note: the patched `tsconfig` files are clean in editor diagnostics, and the canonical root `pnpm build` task completed successfully on the final patch set.
- [x] Sync memory-bank closure state only after the final validation evidence is green.
    - Note: `activeContext.md`, `techContext.md`, and `progress.md` now record that the remaining closeout scope was TS6/tooling plus ledger sync rather than unfinished product functionality.

## Completed Session: 2026-04-10 ECAE Residual QA Hardening

-   [x] Re-baseline the residual QA scope and keep the future Phase 5 boundary honest before widening implementation.
    -   Outcome: repository evidence confirmed that Phase 5 remains a future product wave; the honest residual scope was limited to concrete QA hardening on the already shipped ECAE surface.
-   [x] Restore generic entity copy codename retry parity with the legacy built-in copy controllers.
    -   Outcome: the generic custom-entity copy path now retries `idx_mhb_objects_kind_codename_active` races across actual insert attempts and returns a deterministic conflict only after the generated-codename retry budget is exhausted.
-   [x] Add the missing focused frontend regression for fail-closed catalog-compatible settings loading.
    -   Outcome: focused `EntityInstanceList` coverage now locks the loading seam so catalog-compatible copy/delete affordances stay hidden while settings-derived policy data is still unresolved.
-   [x] Add a real-browser permission proof for catalog-compatible entity instances under a read-only metahub member role.
    -   Outcome: targeted Playwright coverage now proves an invited metahub member can open the catalog-compatible instances surface read-only while create/edit/copy/delete affordances remain hidden.
-   [x] Re-run focused backend/frontend/browser validation plus the canonical root build, then sync memory-bank closure state.
    -   Outcome: the focused backend route suite passed (`20/20`), the focused frontend `EntityInstanceList` suite passed (`9/9`), the targeted Playwright member ACL rerun passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).

## Completed Session: 2026-04-10 ECAE QA Policy And ACL Closure

-   [x] Re-baseline the QA-proven Catalogs v2 parity debt against the current generic entity catalog-compatible surface.
    -   Outcome: the remaining work was narrowed to the real shipped acceptance gaps only: legacy policy parity for copy/delete/permanent-delete, legacy `editor`-level authoring parity, and the missing negative-path regression coverage around those contracts.
-   [x] Restore backend policy parity for catalog-compatible custom entity mutations without reopening generic built-in route access.
    -   Outcome: generic catalog-compatible copy/delete/permanent-delete flows now reuse the legacy catalog settings and blocking-reference protections through shared compatibility helpers, while the generic routes remain custom-kind-only.
-   [x] Restore frontend parity for catalog-compatible authoring permissions and action visibility.
    -   Outcome: `EntityInstanceList` now mirrors legacy catalog semantics for catalog-compatible kinds, preserving `editContent` authoring parity, splitting delete/permanent-delete behind `deleteContent`, reusing `CatalogDeleteDialog` for blocked deletes, and respecting legacy copy/delete settings.
-   [x] Add focused backend/frontend/browser-safe regressions for the restored parity contracts.
    -   Outcome: focused route/UI coverage now locks the negative paths directly, including `catalogs.allowCopy`, `catalogs.allowDelete`, blocking-reference safety, editor-capable catalog-compatible authoring, delete-dialog reuse, and restore/permanent-delete visibility split.
-   [x] Re-run targeted validation plus the canonical root build after the parity fixes.
    -   Outcome: the focused backend route suite passed (`18/18`), the focused frontend `EntityInstanceList` suite passed (`8/8`), the touched lint surface returned to no new error-level debt, and the repository-standard root `pnpm build` completed green (`EXIT:0`).
-   [x] Sync memory-bank closure state only after the repaired parity surface and validation stack are green.
    -   Outcome: the canonical ledger, active context, progress log, and system patterns now record the closed QA remediation so future sessions preserve the restored catalog-compatible ACL/policy contract instead of reopening it accidentally.

## Completed Session: 2026-04-10 Resume Verification And Handoff

-   [x] Recheck the closure state against the actual memory-bank files and working tree after session resume.
    -   Outcome: the canonical task ledger, active context, and progress log still match the already-green strict parity closure, and the remaining working-tree diff is the expected validated frontend/e2e patch set from that closure wave.
-   [x] Re-open the relevant package context before reporting completion.
    -   Outcome: the metahubs frontend package documentation was re-read from `packages/metahubs-frontend/base/README.md`, confirming the resumed handoff stays anchored to the correct package surface instead of the missing package-root README path.
-   [x] Hand off the final green status without widening scope.
    -   Outcome: the resumed session stayed in verification-and-report mode only; no new product code changes were needed beyond the already recorded parity closure patch set.

## Completed Session: 2026-04-10 Final ECAE Parity Verification

-   [x] Inspect the latest `metahub-entities-workspace` Playwright rerun and identify the exact remaining outcome.
    -   Outcome: the legacy `Copying Catalog` dialog still renders the shared General tab fields, but the stale `CatalogActions`/`EnumerationActions`/`SetActions` call sites no longer pass the explicit label props required by `GeneralTabFields`, so the browser proof now fails at the accessible-label seam instead of the earlier persistence seam.
-   [x] Fix the last parity regression only if the latest browser proof still fails.
    -   Outcome: the stale legacy action builders now pass explicit `GeneralTabFields` labels/helpers again, restoring accessible `Name` / `Description` / `Codename` wiring for catalog-compatible copy/edit dialogs without reopening the already validated persistence or read-only contracts.
-   [x] Re-run focused validation plus the canonical root build after the final parity fix set.
    -   Outcome: targeted eslint on the touched action files returned clean, the focused browser flows passed (`3/3`), the focused visual proof set passed (`3/3`), and the repository-standard root `pnpm build` completed green (`30 successful`, `30 total`).
-   [x] Sync memory-bank closure state only after the browser proof and validation stack are fully green.
    -   Outcome: the closure state now records the explicit shared-field label contract and the stabilized visual parity proof, while Phase 5 remains intentionally deferred.

## Completed Session: 2026-04-10 ECAE QA Gap Closure

-   [x] Re-baseline the remaining QA-proven closure scope against the shipped ECAE parity surface.
    -   Outcome: the remaining closure scope was narrowed to the real final seams surfaced by the latest evidence: stale shared-field label props in legacy dialogs and an over-strict visual parity assertion that compared additive edit shells as if they were pixel-identical.
-   [x] Repair the backend lint blocker without widening runtime behavior.
    -   Outcome: formatter drift in the touched root/schema-ddl files was cleaned back to the warning-only backlog earlier in the session, and the final shared-field fix stayed frontend-only.
-   [x] Extend the Catalogs vs Catalogs v2 browser/visual parity proof with focused legacy/new evidence.
    -   Outcome: the strengthened proof now combines green legacy/new browser flows with shared Playwright snapshots for the truly common create/copy dialogs and the shared General edit panel, while explicitly tolerating the intentional additive `Attributes` tab and external delete affordance on the entity edit surface.
-   [x] Re-run focused lint, browser, visual, and canonical build validation on the updated patch set.
    -   Outcome: focused lint returned clean on the touched files, the repaired browser flow pair passed, the focused visual spec set passed, and the canonical root build completed green.
-   [x] Sync memory-bank closure state only after the strengthened parity evidence and clean validation results are confirmed.
    -   Outcome: the ledger now reflects the closed QA gap honestly instead of implying the edit-shell additive differences were regressions.

## Completed Session: 2026-04-10 Entity Read-Only Contract Closure

-   [x] Reconcile the entity-type read contract with the shipped read-only entity surfaces.
    -   Outcome: backend entity-type `list` / `get` now use metahub membership access so read-only `EntitiesWorkspace` and `EntityInstanceList` surfaces can resolve definitions without `manageMetahub`, while write routes stay manager-only.
-   [x] Add focused backend/frontend regressions for the permission contract so mocked UI tests cannot drift from backend reality again.
    -   Outcome: route coverage now proves member-level entity-type reads, and the frontend entity read-only tests stay aligned with the supported shell visibility and hidden authoring affordances.
-   [x] Re-run focused validation and the canonical root build before closing the remediation.
    -   Outcome: focused backend/frontend tests are green, touched package lint reruns returned to the warning-only backlog after targeted Prettier repair, and the canonical root `pnpm build` completed green.
-   [x] Sync memory-bank closure state after the validated remediation result.
    -   Outcome: the ledger, active context, progress log, and durable system pattern now reflect the closed read-only contract, while Phase 5 remains an intentionally deferred future wave.

## Active Session: 2026-04-09 ECAE Catalogs v2 Strict Parity Closure

-   [x] Re-baseline the remaining strict parity scope against the current Catalogs v2 implementation and legacy Catalog flows.
    -   Note: this pass is limited to the acceptance gaps proven by the audit: legacy/new mutual visibility, reuse of mature catalog authoring routes, and explicit runtime create/edit/copy parity for Catalogs v2.
-   [x] Implement the backend catalog-compatible compatibility pool without reopening generic built-in route bypasses.
    -   Note: widen the legacy catalog controllers and supporting services so catalog-compatible custom rows can participate in list/get/update/copy/delete/restore/permanent flows while the generic entity routes remain custom-only.
-   [x] Implement catalog-compatible frontend behavior on the entity instance surface using existing catalog authoring seams.
    -   Note: switch `EntityInstanceList` into a catalog-compatible mode for Catalogs v2, reuse existing catalog actions/routes/scripts where they already match the contract, and avoid creating a parallel detail-authoring stack.
-   [x] Add focused backend, frontend, and browser/runtime regressions that prove strict parity instead of relying on indirect green builds.
    -   Outcome: focused backend route/service proofs are green, `EntityInstanceList` catalog-mode coverage is green, and the Playwright workspace/publication-runtime flows now prove the catalog-compatible authoring surface plus the published runtime section path.
-   [x] Re-run touched validation plus the canonical root build, then sync the ECAE plan/memory-bank closure state only if the new parity proof is green.
    -   Note: finish with the repository-standard `pnpm build`, then reconcile the plan checklist and progress log to the stricter acceptance evidence from this pass.
    -   Outcome: touched backend/frontend builds passed, `pnpm run build:e2e` completed green, the focused Playwright parity flows passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).

## Completed Session: 2026-04-09 ECAE Zerocode Builder Closure Pass

-   [x] Re-baseline the still-open Phase 3.6/3.7 scope against the code that already shipped in the Entities workspace.
    -   Outcome: this pass is now explicitly narrowed to the remaining product gap that the browser flow exposed: `EntityTypeFormValues` already carries structured builder fields (`tabs`, `customTabsInput`, `components`, `published`), but `EntitiesWorkspace` still renders the legacy JSON-only controls in `buildFormTabs(...)`.
-   [x] Restore the missing structured builder UI in `EntitiesWorkspace` instead of weakening the failing browser proof.
    -   Outcome: `EntitiesWorkspace` now renders the structured builder controls again, including guided authoring-tab toggles, the publish-to-menu control, and dependency-aware component toggles/settings sourced from the existing `ComponentManifest` helper layer.
-   [x] Add/refresh focused regression coverage for the restored builder source seam.
    -   Outcome: focused frontend coverage now exercises the restored dialog shell, preset patch alignment, and dependency-pruning behavior through `EntitiesWorkspace.test.tsx` plus `entityTypePreset.test.ts`.
-   [x] Re-run focused validation after the final checkbox-role alignment and fix any remaining frontend regressions.
    -   Outcome: the restored entity-type create/edit dialog now uses real checkbox semantics instead of aliased MUI switches, and the focused `EntitiesWorkspace` plus preset regressions are green again (`5/5`).
-   [x] Re-run the touched frontend build after the validation rerun.
    -   Outcome: `@universo/metahubs-frontend` build remains green after the checkbox and tab-label fallback repair.
-   [x] Re-run the existing `metahub-entities-workspace` browser proof on top of the repaired builder contract.
    -   Outcome: the focused Playwright workspace flow is green again (`2/2`) and still proves preset-backed create plus backend persistence/EN-RU parity on the restored builder surface.
-   [x] Reconfirm the publication/runtime browser proof remains green with the repaired builder surface.
    -   Outcome: the focused publication/runtime Playwright flow is green (`2/2`) and still proves published custom entities survive sync into runtime sections end-to-end.
-   [x] Add the missing Phase 3.8 parity/migration proof for Phase 3 deliverables.
    -   Outcome: focused backend proofs now cover legacy snapshot imports that omit v3-only entity metadata sections plus legacy catalog-wrapper parity against the object-scoped system-attribute adapters, the targeted backend suites are green (`27/27`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
-   [x] Close the Phase 4 documentation and memory-bank follow-up for the shipped ECAE surface.
    -   Outcome: EN/RU ECAE architecture and custom-entity workflow docs now ship, REST API and docs summaries are updated, touched EN/RU pairs were line-count aligned manually, and the repository-standard docs i18n check is green.

## Completed Session: 2026-04-09 QA Closure Follow-up

-   [x] Reconcile the runtime inline PATCH permission seam with the rest of the parent-row mutation contract.
    -   Outcome: `applications-backend` `updateCell` now enforces `editContent` immediately after `resolveRuntimeSchema(...)`, so denied inline PATCH requests fail closed before touching runtime catalogs or business tables.
-   [x] Sync the ECAE checklist state with the verified Phase 3.3-3.5 closure evidence.
    -   Outcome: the canonical ledger and plan summary no longer leave Phase 1, Phase 2.5c, or Phase 3.3-3.5 falsely open after the already verified closure wave.
-   [x] Re-run focused validation and the canonical root build before declaring the closure clean.
    -   Outcome: `@universo/applications-backend` runtime routes are green again (`52/52`), and the repository-standard root `pnpm build` completed green (`30 successful`, `30 total`).

## Completed Session: 2026-04-09 ECAE Final Closure Verification

-   [x] Re-baseline the post-QA ECAE closure scope against the current Phase 3.2 implementation and the still-open Phase 3.3+ plan items.
    -   Note: treat the memory-bank plan as the source of truth, but verify current code before widening any package surface.
-   [x] Fix the confirmed high-severity entity-surface defects before widening further.
    -   Outcome: generic entity instance read routes now honor membership-only access for read-only surfaces, and custom entity types now fail closed on delete while any dependent entity instances still exist.
-   [x] Implement and validate Phase 3.3 snapshot v3 and restore closure.
    -   Outcome: snapshot serializer/restore now preserve v3 custom entity definitions, nested actions/event bindings, legacy catalog system-field compatibility, and strict TypeScript builds in the touched snapshot packages are green.
-   [x] Finish Phase 3.4 DDL custom-type pipeline closure.
    -   Outcome: schema-ddl prefix propagation, metahub custom `table_name` generation, and application sync/workspace table-name resolution are now validated together with the focused touched-package build stack.
-   [x] Finish Phase 3.5 runtime and shared-contract genericization.
    -   Outcome: the backward-compatible `section*` alias rollout is now implemented across applications-backend, applications-frontend, and apps-template-mui, with focused runtime tests and touched builds green.
-   [x] Expand regression coverage to match the fully shipped surface.
    -   Outcome: backend/frontend/runtime regressions now lock the new DDL naming and runtime section-alias contracts before the final repository-wide validation pass.
-   [x] Confirm the canonical root `pnpm build` outcome on the finalized patch set.
    -   Outcome: the repository-standard root `pnpm build` completed green (`30 successful`, `30 total`, `30 cached`), confirming the finalized Phase 3.3-3.5 patch set without residual build regressions.
-   [x] Sync memory-bank closure state after green canonical validation.
    -   Outcome: the closure state is now reflected across tasks.md, activeContext.md, and progress.md after the final root-build confirmation.

## Completed Session: 2026-04-09 ECAE Post-QA Closure Remediation

-   [x] Update memory-bank and implementation todo state for the QA-closing pass before code edits.
    -   Outcome: this remediation stayed explicitly scoped to the concrete QA findings on the shipped Phase 3.2 surface instead of widening prematurely into Phase 3.3.
-   [x] Fix the shared defect seams identified by QA in the shipped entity shell.
    -   Outcome: `ConflictResolutionDialog` no longer violates React hook order when `conflict` toggles null/payload, and `MenuContent` now uses the shared auth-aware client seam instead of raw `fetch`.
-   [x] Revalidate and clean the touched entity/template frontend files against package lint discipline.
    -   Outcome: release-blocking formatter drift was removed, the touched entity files now have no local warning debt, and both package lint runs returned to the pre-existing warning-only backlog (`0 errors`).
-   [x] Add focused regression coverage for the QA-gap seams.
    -   Outcome: focused regressions now lock the conflict-dialog rerender path, the shared shell auth-query seam, and the deleted custom-entity instance action state.
-   [x] Run focused validation, then the canonical root build, and sync closure state only after green evidence.
    -   Outcome: focused template-mui and metahubs-frontend tests passed, both touched packages built successfully, and the canonical root `pnpm build` completed green before memory-bank closure sync.

## Completed Session: 2026-04-09 ECAE Phase 3.2 QA Remediation And Dynamic Menu Zone

-   [x] Fail-close generic permanent delete for custom entity instances across controller, service, and focused backend regressions.
    -   Outcome: controller and SQL/service layers now both require a prior soft-delete state, the focused backend regressions are green, and the generic route no longer hard-deletes active rows.
-   [x] Align `manageMetahub` gating for `EntitiesWorkspace`, `EntityInstanceList`, and metahub shell navigation using the existing metahub-details permission seam.
    -   Outcome: page-level authoring affordances stay aligned, metahub shell authoring entries now fail closed through the metahub-details permission contract, and `Access` remains separately gated through `manageMembers`.
-   [x] Implement Phase 3.2 dynamic published metahub menu sections on top of entity metadata without regressing the coexistence-first shell.
    -   Outcome: the fixed `Entities` item stays below `Common`, legacy built-in object items remain visible, and published custom kinds now render as a separate dynamic zone between the built-in object cluster and the publications/admin cluster.
-   [x] Add focused frontend/browser regressions for the QA-fixed seams and the first dynamic-menu contract.
    -   Outcome: focused template-mui menu/config tests now cover published custom-kind insertion plus permission filtering, and the Playwright `metahub-entities-workspace` flow now proves the sidebar link opens the generic custom-kind instances route in EN and RU.
-   [x] Re-run touched-package validation and the canonical root build after the remediation wave.
    -   Outcome: focused backend and template-mui tests passed, touched package builds for metahubs-backend/template-mui/core-frontend passed, the published-menu browser flow passed, and the repository-standard root `pnpm build` finished green.
-   [x] Sync memory-bank closure state after validation and record any newly proven durable contracts.
    -   Outcome: `activeContext.md`, `progress.md`, and `systemPatterns.md` now record the closed Phase 3.2 state and the published custom-kind menu contract.

## Active Session: 2026-04-08 ECAE Implementation

-   [x] Execute Phase 1 registry foundation end to end with package-level and root validation.
    -   Note: start with shared types and backend resolver/registry seams only; no user-visible behavior changes are allowed in this checkpoint.
-   [x] Advance Phase 2 only after Phase 1 is green and the shared contracts are stable.
    -   Note: each phase must finish with build/test verification before the next phase broadens scope.
    -   Progress: Phase 2.0 shared GeneralTabFields extraction, Phase 2.1 schema/version work, Phase 2.2 backend service wiring, Phase 2.3 backend route wiring, Phase 2.4 resolver DB extension, Phase 2.5 generic custom-entity CRUD, Phase 2.5b coexistence-first compatibility, Phase 2.5c design-time service genericization + policy reuse, Phase 2.6 frontend API layer + hooks, Phase 2.7 `Entities` workspace routing/authoring surface, Phase 2.7b reusable entity presets, Phase 2.8 EN/RU i18n coverage, and Phase 2.9 browser/runtime validation are complete and validated; the next checkpoint is Phase 3.1 generic entity instance UI.

## Completed Session: 2026-04-09 ECAE Phase 3.1 Generic Entity Instance UI

-   [x] Deliver the first generic `EntityInstanceList` page for custom entity kinds on top of the validated Phase 2 entity foundation.
    -   Note: keep this pass scoped to the metahub-side instance list/detail authoring surface; do not widen into Phase 3.2 dynamic menu publication or runtime genericization yet.
    -   Outcome: shipped the list/card shell, create/edit/copy/delete/restore/permanent-delete flows, deleted toggle, and component-gated dialog tabs from one page-level surface.
-   [x] Reuse only the safe existing authoring seams that are already effectively object-scoped.
    -   Note: reuse `EntityFormDialog`, `useListDialogs`, `GeneralTabFields`, embedded `AttributeListContent` / `LayoutList`, and config-backed hub-assignment semantics where they already work for arbitrary object ids; do not fork catalog-specific UI just to reach parity faster.
-   [x] Wire the new page through metahubs exports and core frontend routing, and add an in-product entry path from `EntitiesWorkspace`.
    -   Note: the fixed `Entities` authoring page stays the registry/definition surface; the new route should expose instance authoring for a resolved `kindKey` without hiding or replacing the existing workspace.
-   [x] Add focused frontend regression coverage for the new generic instance page and rerun touched-package plus canonical root validation.
    -   Note: prove component-driven tab composition, route/export wiring, and at least one real instance CRUD happy path before the final `pnpm build`.
    -   Outcome: focused export + component tests passed, `@universo/metahubs-frontend` and `@universo/core-frontend` builds passed, and the canonical root `pnpm build` completed green.

## Completed Session: 2026-04-09 ECAE Phase 2.9 Browser Validation

-   [x] Close Phase 2.9 on the currently shipped entity-type authoring surface through focused browser and pixel-perfect validation.
    -   Note: validate the fixed `Entities` workspace route, preset-backed create dialog, and the shipped EN/RU-facing copy before widening into Phase 3 generic entity instance work.
-   [x] Add or refresh focused E2E coverage for `Entities` workspace authoring and preset-driven prefill persistence.
    -   Note: prefer backend-confirmed persistence plus stable screenshot assertions; avoid brittle checks tied to generated ids or implementation-only markup.
-   [x] Repair any entity workspace, i18n, selector, or browser seams exposed by the Phase 2.9 pass without widening into runtime/publication genericization.
    -   Note: keep coexistence-first behavior intact for legacy Catalogs/Sets/Enumerations and preserve the shared template-registry preset contract.
-   [x] Re-run touched frontend validation, focused browser/visual checks, and the canonical root build before moving Phase 3.1 back into scope.
    -   Note: finish with the repository-standard root `pnpm build`, then sync memory-bank closure only after the evidence is green.
    -   Outcome: added focused Playwright coverage for preset-backed entity-type creation plus EN/RU parity, added a stable visual dialog proof, fixed the blank `Name` column in `EntitiesWorkspace` list view via `row.name || row.kindKey`, and revalidated with passing focused flow/visual runs plus a green root `pnpm build`.

## Completed Session: 2026-04-09 ECAE Frontend Entity Foundation

-   [x] Deliver Phase 2.6 frontend entity API layer and query/mutation hooks on top of the validated backend routes.
    -   Note: keep the first frontend seam custom-kind-safe and aligned with the existing metahubs query-key and mutation architecture.
    -   Execution: add `domains/entities/api`, `domains/entities/hooks`, and shared query-key invalidation helpers before wiring UI consumers.
    -   Outcome: `domains/entities/api`, `domains/entities/hooks`, and the entity query/mutation invalidation helpers now ship on top of the validated backend entity routes without widening built-in coexistence behavior.
-   [x] Deliver Phase 2.7 fixed `Entities` workspace routing/menu entry plus the first entity-type authoring surface.
    -   Note: preserve coexistence-first navigation; legacy Catalogs/Sets/Enumerations remain visible while `Entities` appears below `Common`.
    -   Execution: ship an entity-type authoring list/dialog surface first; generic entity instance UI beyond groundwork remains deferred to later Phase 3 tasks.
    -   Outcome: the first `EntitiesWorkspace` is now wired through package exports, core frontend lazy routes, shared template-mui navigation, and breadcrumbs, with entity-type authoring reachable below `Common`.
-   [x] Deliver Phase 2.8 EN/RU i18n coverage for the new entity frontend surface.
    -   Note: add only keys needed by the shipped UI in this pass and keep both locales structurally aligned.
    -   Outcome: the shipped entity workspace/dialog/list strings are present in both EN and RU metahubs locale bundles with aligned structure.
-   [x] Close the remaining frontend integration seam for this session.
    -   Execution: finish metahubs namespace wiring for `entities`, extend query-key smoke tests, then run touched-package lint/test/build and repair any surfaced type or lint regressions before the canonical root build.
    -   Outcome: metahubs namespace bundling now exposes `entities`, shared query-key smoke coverage includes entity scopes plus invalidators, and the entity workspace no longer introduces unstable fallback-array hook warnings.
-   [x] Wire the new entity surface through package exports and core frontend routes before final validation.
    -   Note: keep the lazy import contract and external module typing aligned so the new workspace page is reachable without ad-hoc local imports.
    -   Outcome: lazy import wiring, menu configuration, breadcrumbs, external-module typing, and package exports stay aligned without local cross-package imports.
-   [x] Revalidate the touched frontend/backend packages and the canonical root build before widening further into Phase 3 runtime work.
    -   Note: if the new frontend surface exposes additional backend/runtime gaps, record them explicitly before attempting the next generic UI layer.
    -   Execution: run touched-package lint/build first, then finish with the canonical root `pnpm build`.
    -   Outcome: `@universo/metahubs-frontend` lint returned to the existing warning-only backlog (`0 errors`), focused exports/query-key tests passed, `@universo/metahubs-frontend`, `@universo/template-mui`, and `@universo/core-frontend` builds passed, and the canonical root `pnpm build` finished green (`30 successful`, `30 total`).

## Completed Session: 2026-04-09 ECAE Reusable Entity Presets

-   [x] Extend the existing template registry contract to expose reusable entity presets without introducing a second global preset store.
    -   Note: preserve the existing metahub template flow for metahub creation; entity presets must ride the same `cat_templates` / `doc_template_versions` seam via `definition_type` rather than a parallel storage model.
-   [x] Add built-in entity preset manifests and seed them through the unified template seeder/migration path.
    -   Note: keep the existing metahub template registry/data exports intact for schema initialization, and add entity presets as an additive registry layer.
-   [x] Wire entity preset selection into the `Entities` create flow using the existing templates query/UI pattern.
    -   Note: preset application should prefill the create dialog safely; it must not overwrite edit mode or bypass normal validation/save flow.
-   [x] Add focused regression coverage for the new template-contract and preset-selection seams, then rerun touched-package and root validation.
    -   Note: keep this pass scoped to the new preset contract plus the touched frontend/backend packages unless validation exposes a real adjacent regression.
    -   Outcome: entity presets now ship through the existing template registry/versioning flow, `EntitiesWorkspace` create mode can prefill form state from preset manifests, focused backend/frontend tests passed, touched-package lint stayed warning-only (`0 errors`), and the canonical root `pnpm build` completed green after hardening `@universo/core-frontend` build memory for the Turbo path.

## Planned: Entity-Component-Action-Event (ECAE) Architecture

-   [x] Phase 1: Registry Foundation (pure refactor, zero user-visible change)
    -   [x] 1.1 EntityKind type evolution in `@universo/types`
    -   [x] 1.2 ComponentManifest interface (incl. hierarchy, nestedCollections, relations, actions, events)
    -   [x] 1.3 EntityTypeDefinition interface
    -   [x] 1.3b Shared contract widening (snapshot v3, script attachments, widget/runtime config types)
    -   [x] 1.4 Built-in type registry (CATALOG_TYPE, SET_TYPE, ENUMERATION_TYPE, HUB_TYPE, DOCUMENT_TYPE)
    -   [x] 1.5 Component registry (backend, 10 component descriptors)
    -   [x] 1.6 Entity type resolver service
    -   [x] 1.7 Full validation (build + tests green)
-   [x] Phase 2: ECAE System + Coexistence Foundation
    -   [x] 2.0 Extract shared GeneralTabFields (quick win)
    -   [x] 2.1 Add ECAE system tables (`_mhb_entity_type_definitions`, `_mhb_actions`, `_mhb_event_bindings`)
        -   Note: includes structure-version bump plus additive branch migration coverage.
    -   [x] 2.2 Entity Type CRUD Service + ECAE Services (ActionService, EventBindingService, EntityEventRouter, EntityMutationService)
        -   Note: focused backend service tests are green, package lint has 0 errors, package/root builds are green, and optimistic-lock typing now recognizes the new entity/action/event rows.
    -   [x] 2.3 Entity type CRUD routes + ECAE routes (actionsRoutes, eventBindingsRoutes)
        -   Note: new entity-type/action/event-binding controllers and routes are registered in the metahubs router, focused route coverage is green, and package/root validation stayed green.
    -   [x] 2.4 Resolver DB extension
        -   Note: shared resolver now resolves custom DB-backed kinds through `EntityTypeService`, caches repeated lookups per resolver instance, and focused resolver tests/build/root build stayed green.
    -   [x] 2.5 Generic entity instance CRUD routes + ECAE lifecycle event dispatch
        -   Note: metahubs backend now exposes custom-only generic entity instance CRUD/copy/restore/reorder routes, `MetahubObjectsService` supports tx-aware generic kind mutations, focused ECAE regression passed (`33/33`), package builds stayed green, and the canonical root build finished green after clearing an unrelated generated `applications-backend/base/dist` cleanup blocker.
    -   [x] 2.5b Coexistence-first compatibility layer (legacy paths preserved, shared entity foundation introduced)
        -   Note: shared built-in compatibility helpers now cover legacy delete/detach/reorder safety paths under the existing catalog/set/enumeration routes, with focused backend regressions green (`61/61`), package lint back to warning-only backlog (`0 errors`), and canonical root build green.
        -   [x] 2.5b.1 Add shared built-in object compatibility helpers for legacy delete/detach safety paths.
        -   [x] 2.5b.2 Move set and enumeration legacy object delete/reorder safety flows onto the shared helper layer.
        -   [x] 2.5b.3 Lift catalog delete/permanent-delete safety paths only where policy/runtime behavior stays unchanged.
        -   [x] 2.5b.4 Add focused helper + route regression coverage and rerun package/root validation.
    -   [x] 2.5c Design-time service genericization + policy reuse gate
        -   [x] 2.5c.1 Introduce an object-scoped system-attribute adapter in `MetahubAttributesService` while preserving legacy catalog wrappers.
            -   Note: add object-scoped aliases first, then move new helper/generic copy wiring onto the object-facing seam instead of duplicating policy logic.
        -   [x] 2.5c.2 Extract a shared design-time child-copy helper for legacy built-in object kinds without widening legacy routes.
            -   Note: the helper should own attribute/element/constant/value copying, while route response bodies and built-in route ownership stay unchanged.
        -   [x] 2.5c.3 Route generic entity copy through the shared child-copy helper and platform system-attribute policy seam.
            -   Note: generic routes remain custom-kind-only; copy breadth is derived from enabled design-time components rather than exposing built-in kinds.
        -   [x] 2.5c.4 Add focused regression coverage for the new adapter/helper path and rerun package/root validation.
            -   Outcome: focused backend regressions passed (`82/82`), `@universo/metahubs-backend` lint returned to the existing warning-only backlog (`0 errors`), package build passed, and the canonical root `pnpm build` finished green (`30 successful`, `30 total`).
    -   [x] 2.6 Frontend API layer + hooks
    -   [x] 2.7 `Entities` workspace below `Common`
    -   [x] 2.7b Reuse existing template registry for reusable entity presets
    -   [x] 2.8 i18n keys (EN + RU, incl. ECAE terms)
    -   [x] 2.9 Full validation (ECAE + pixel-perfect)
        -   Note: focused browser coverage now proves preset-backed entity-type creation, backend persistence, EN/RU parity, and the stabilized entity-create dialog snapshot on the shipped `Entities` authoring surface.
-   [ ] Phase 3: Entity Builder + Published Sections + Runtime Genericization
    -   [x] 3.1 Generic EntityInstanceList page
    -   [x] 3.2 Dynamic sidebar sections + published menu zone (`Catalogs v2`)
    -   [x] 3.3 Component-driven snapshot serialization (format v3 with ECAE data)
    -   [x] 3.4 DDL pipeline for custom types
    -   [x] 3.5 Runtime and shared-contract genericization across applications-backend, applications-frontend, and apps-template-mui
    -   [x] 3.6 Zerocode MVP builder for current scope
    -   [x] 3.7 E2E/product dogfooding (pixel-perfect + publication/runtime + Catalogs v2)
    -   [x] 3.8 Full validation (snapshot v2→v3 migration + legacy/new bi-directional visibility)
        -   Note: focused proofs now cover legacy snapshot restore without v3-only entity metadata sections plus legacy catalog-wrapper parity against object-scoped system-attribute reads; focused browser flows and the canonical root build are green.
-   [x] Phase 4: Documentation (EN + RU, memory bank)
    -   Note: EN/RU architecture and guide pages, REST API updates, summaries, and memory-bank closure sync are complete.
-   [ ] Phase 5: Advanced Zerocode Extensions (future — post-parity)
    -   Note: visual canvas builder, advanced action editor, and freeform layout designer stay outside the current parity wave.
    -   Note: see [entity-component-architecture-plan-2026-04-08.md](plan/entity-component-architecture-plan-2026-04-08.md) for full detail

## Completed Session: 2026-04-08 Wait Window And PR Review Follow-up For GH755

-   [x] Start a non-blocking 20-minute wait window before any PR-review work begins.
    -   Note: The user explicitly requested a full 20-minute pause so bot review comments on PR #755 can arrive before triage starts.
    -   Outcome: a user-level `systemd-run --on-active=20m` timer plus a journal follower completed successfully before PR inspection resumed.
-   [x] Re-enter the PR branch and verify the local branch context after the wait window ends.
    -   Note: The repository had been switched back to `main` after publishing PR #755, so the follow-up needed to resume on `feature/gh754-common-shared-tabs`.
    -   Outcome: local HEAD is back on `feature/gh754-common-shared-tabs`; the only immediate post-switch conflict was the expected memory-bank stash handoff and it is being resolved in place.
-   [x] Inspect PR #755 for bot comments, review threads, and other automated feedback.
    -   Note: Collect every unresolved suggestion first, then group the claims by file/concern before deciding whether a code change is justified.
    -   Outcome: the PR contains two bot summary reviews and two actionable Copilot inline comments; no human review threads or issue comments are present.
-   [x] QA-validate each accepted suggestion against the current codebase and external documentation before editing.
    -   Note: Only implement fixes that are factually correct, codebase-consistent, and low-risk for adjacent runtime/publication/Common-section behavior.
    -   Outcome: only the two Copilot comments on `tools/testing/e2e/support/backend/e2eCleanup.mjs` survived QA review; discovery had regressed from unconditional merge behavior to `size === 0` gating, which could leak orphaned resources on partial manifests.
-   [x] Implement the validated PR-review fixes with the smallest safe patch set.
    -   Note: Keep scope limited to real defects confirmed during triage; do not broaden into unrelated cleanup.
    -   Outcome: `e2eCleanup.mjs` now always attempts metahub/application discovery by `runId` and only downgrades discovery failures to warnings when explicit manifest ids already exist.
-   [x] Fix the five failing unrelated `@flow` regressions from the repository-recommended verification chain.
    -   Note: The user explicitly requested full green validation before pushing, so the broader `test:e2e:agent` failures are now in scope even though they are not part of the bot review itself.
    -   Outcome: the confirmed drift came from stale E2E expectations versus the current shipped UI contracts: admin settings now explicitly switch to the `Metahubs` tab before touching codename defaults, Common layouts no longer assert a non-existent `Layouts` page heading, and metahub common-dialog settings now use the shipped `Popup window type` / `Non-modal windows` labels. The originally reported `application-runtime-scripting-quiz` path is green on focused reruns.
-   [x] Repair the additional full-run seams that only surfaced after the first wide verification rerun.
    -   Note: The first post-fix `pnpm run test:e2e:agent` pass exposed two more blockers that were not part of the initial five-spec triage: a flaky codename-mode list-refresh assertion and an out-of-date quiz snapshot integrity hash.
    -   Outcome: `codename-mode` now waits for backend persistence before asserting list visibility, and the canonical `metahubs-quiz-app-snapshot.json` fixture plus its contract helper were updated so snapshot import integrity validation succeeds again.
-   [x] Re-run the relevant focused tests and the canonical verification needed before pushing.
    -   Note: Prefer touched-package validation first, then finish with the full root `pnpm build` because the user requested full verification before sending files back to the PR.
    -   Outcome: focused reruns passed for the five originally reported flow specs and for the later `codename-mode` + `snapshot-import-quiz-runtime` seams, and the final repository-recommended `pnpm run test:e2e:agent` pass is green with `45 passed`.
-   [x] Push the follow-up commit(s) to PR #755 and sync memory-bank closure state.
    -   Note: After a green validation stack, push back to `feature/gh754-common-shared-tabs`, then update `activeContext.md`, `progress.md`, and this ledger with the actual review outcome.
    -   Outcome: commit `d5358c3c1` (`fix(e2e): stabilize GH755 review follow-up`) is pushed to `feature/gh754-common-shared-tabs`, so PR #755 now contains the accepted review fix, the E2E contract repairs, and the quiz snapshot integrity refresh.

## Completed Session: 2026-04-08 Post-QA Lint Closure Remediation

-   [x] Re-baseline the Shared/Common wave against the QA finding that package lint is still red.
    -   Outcome: the remaining blocker was narrowed to error-level Prettier/ESLint drift in the touched Shared/Common files, while the broader warning-only package backlog stayed outside this closure scope.
-   [x] Fix backend lint blockers introduced or touched by the Shared/Common implementation wave.
    -   Outcome: root-level Prettier plus package `eslint --fix` removed the error-level lint failures from the touched metahubs-backend files without reopening the earlier backend remediation seams.
-   [x] Fix frontend lint blockers introduced or touched by the Shared/Common implementation wave.
    -   Outcome: root-level Prettier plus package `eslint --fix` removed the error-level lint failures from the touched metahubs-frontend files without regressing the already validated UI/browser contracts.
-   [x] Re-run package lint, focused validation, and the canonical root build after the lint remediation.
    -   Outcome: `pnpm --filter @universo/metahubs-backend lint` and `pnpm --filter @universo/metahubs-frontend lint` both exit green again, focused backend routes passed (`35/35`), focused frontend tests passed (`18/18`), and root `pnpm build` stayed green (`30 successful`, `30 total`, `EXIT:0`).
-   [x] Sync memory-bank closure state only after the lint closure pass is validated.
    -   Outcome: the Shared/Common wave now has no remaining release-blocking QA or lint issue in the touched implementation surface, and the closure evidence is recorded across the active memory files.

## Active Session: 2026-04-08 Post-QA Attribute Move Ownership Remediation

-   [x] Fix the backend attribute move ownership gap found during QA.
    -   Outcome: the move route now fails closed when the attribute does not belong to the routed catalog, and the service now requires `object_id` + active-row ownership before any sort swap happens.
-   [x] Add focused backend route regressions for the attribute move endpoint.
    -   Outcome: attributes route coverage now locks valid same-catalog move behavior plus foreign-catalog and shared-pool `404` cases.
-   [x] Re-run focused backend validation and the canonical root build after the fix.
    -   Outcome: attributes routes passed (`22/22`), neighboring constants routes passed (`11/11`), neighboring enumerations routes passed (`17/17`), the canonical Shared/Common Chromium wrapper flow passed (`4 passed`, `4.2m`), and root `pnpm build` stayed green (`30 successful`, `27 cached`).
-   [x] Sync memory-bank closure state after the remediation is validated.
    -   Outcome: the active memory now records the fixed move-ownership contract and the final validation evidence for this post-QA remediation.

## Active Session: 2026-04-08 Phase 8 Completion And E2E Cleanup Closure

-   [x] Reconcile the final QA findings against the remaining plan-deliverable gaps.
    -   Scope: finish the promised Phase 8 docs topology, eliminate RU localization drift in the touched EN/RU docs tree, and close the teardown warning that still appears after the green Shared/Common Playwright run.
-   [x] Create the missing English Shared/Common documentation deliverables from the plan.
    -   Deliverables: the standalone Common/shared metahub pages, the dedicated shared-entity-overrides API page, and the metahub-schema architecture page promised by the plan.
-   [x] Mirror the new documentation pages to Russian with exact structure and line-count parity.
    -   Outcome target: the touched EN/RU documentation files must remain structure-identical and the RU navigation/docs must stop leaking English headings for this feature wave.
-   [x] Harden the E2E cleanup/discovery seam so green Shared/Common runs finish without the residual application-discovery warning.
    -   Outcome target: the wrapper should keep manifest-based cleanup authoritative and avoid noisy best-effort discovery failures after successful Playwright completion.
-   [x] Stabilize the Shared/Common browser validation seam against the first CSRF-retry response.
    -   Outcome: Playwright now waits for the final settled mutation response, the Shared/Common Chromium wrapper run is functionally green again (`4 passed`), and the transient auth-client 419 bootstrap retry no longer fails the browser flow.
-   [x] Suppress false-positive manifest cleanup warnings when strict runner finalization already completed a successful full reset.
    -   Outcome: strict wrapper finalization now skips redundant route-level manifest/API cleanup and relies on the authoritative post-stop full reset, so green runs no longer emit cleanup warnings or savepoint-noise tail logs.
-   [x] Re-run the canonical validations for docs and the touched runtime/browser seams.
    -   Outcome: the Shared/Common Chromium wrapper run finished cleanly again (`4 passed`, `3.9m`) and the canonical root `pnpm build` stayed green (`30 successful`, `30 cached`).
-   [x] Sync memory-bank closure state only after docs, cleanup, and validation are green.
    -   Outcome: activeContext.md, currentResearch.md, progress.md, and systemPatterns.md now describe the final clean strict-reset runner contract and the fully closed Phase 8 wave.

## Completed Session: 2026-04-08 QA Closure Sync

-   [x] Reconcile the stale Shared/Common completion ledger against the verified current source state.
    -   Outcome: the QA recheck confirmed that no additional product-code defect remained in this wave; the only unresolved issue was stale memory-bank closure drift, and the leftover open checklist residue was removed.
-   [x] Sync memory-bank closure state across active context, progress, and implementation-plan status.
    -   Outcome: `activeContext.md`, `progress.md`, `currentResearch.md`, and the Shared/Common plan header now match the already green root build, focused package tests, and captured Playwright proof artifacts.
-   [x] Record the verified backend focused-test invocation nuance in technical context.
    -   Outcome: `techContext.md` now documents the backend Jest-wrapper invocation contract so future focused package runs use positional test paths instead of the invalid Vitest-style `--run` flag.

## Completed Session: 2026-04-08 Manual Repro Fixes After Clean Rebuild

-   [x] Re-baseline the post-QA remediation session against the user's clean rebuild, empty database, and imported `tools/fixtures/metahubs-self-hosted-app-snapshot.json` repro.
    -   Outcome: the remaining browser-visible defects were revalidated on the rebuilt/imported state before code changes continued.
-   [x] Fix the Common embedded toolbar alignment across all Common tabs.
    -   Outcome: embedded Common Layouts / Attributes / Constants / Values now keep the search-plus-actions cluster right-aligned inside the shell-less Common layout.
-   [x] Fix shared entity dialog localization and presentation regressions.
    -   Outcome: RU shared dialog copy, Presentation / Exclusions labels, and shared display-attribute behavior now match the shipped contract.
-   [x] Fix merged shared-row affordances and localized shared badges/actions in target lists.
    -   Outcome: catalogs, sets, and enumerations now render localized Shared badges/actions, including the repaired top-level `shared` namespace consolidation in RU.
-   [x] Fix application runtime page-surface rendering for create/edit/copy flows.
    -   Outcome: runtime page surfaces now replace the center details area, stay mounted during submit/retry, and no longer reopen or fall below the grid.
-   [x] Add focused frontend and Playwright regressions for the reopened manual repro cases.
    -   Outcome: focused unit/browser coverage now locks Common alignment, RU shared copy/badges/actions, shared display behavior, and runtime page-surface behavior.
-   [x] Capture final Playwright proof screenshots from the passing Common/shared and runtime page-surface flows on port 3100.
    -   Outcome: proof artifacts were generated for the page-surface create state, the embedded Common toolbar alignment, and the RU localized Shared badge/list state.
-   [x] Re-run focused Playwright validation on port 3100 and sync memory-bank closure state.
    -   Outcome: the focused Chromium wrapper run finished green again (`5 passed`, `5.6m`), and memory-bank closure state was updated with the proof paths plus the remaining non-blocking cleanup-log note.

## Completed Session: 2026-04-08 Post-QA Shared/Common Completion Remediation

-   [x] Reopen the Shared/Common remediation session in memory-bank and keep the newly reported defects explicit.
    -   Scope: Common embedded toolbar alignment, shared dialog RU/UI cleanup, merged shared/local row affordances, connector dialog spacing, and connector schema sync duplicate-row failure after clean fixture import.
-   [x] Refresh focused frontend/backend regressions to match the landed Shared/Common contracts.
    -   Outcome: route regressions now lock `uiConfig.sharedBehavior` persistence for attributes/constants create flows, shared settings tests cover the new helper/descriptive copy, and merged attribute-list tests now expect shared-row actions instead of the stale `Local` divider contract.
-   [x] Re-run focused Shared/Common validation before touching the remaining connector seam.
    -   Outcome: focused metahubs-backend route tests passed (`2 suites / 30 tests`) and focused metahubs-frontend tests passed (`2 files / 8 tests`) after the regression updates.
-   [x] Fix the embedded Common toolbar alignment and related shell-less spacing regressions.
    -   Outcome: the embedded Common Layouts / Attributes / Constants / Values surfaces now use the shared shell-less alignment path, and the later QA/browser proof confirmed that the right-aligned search/actions cluster no longer regresses on the current source state.
-   [x] Confirm whether the embedded Common toolbar defect still reproduces on the current source state.
    -   Outcome: the final Common/shared Chromium proof run plus `shared-common-toolbar-alignment.png` confirmed that the defect no longer reproduces on the current tree.
-   [x] Fix shared entity authoring UX, localization, and list affordances end to end.
    -   Outcome: shared RU copy, Presentation/Exclusions IA, localized Shared badge/actions, shared display-attribute behavior, and shared row affordances all shipped and remained green in focused frontend/browser coverage.
-   [x] Fix the application connector authoring polish and the schema-sync duplicate attribute failure.
    -   Outcome: the imported self-hosted schema-generation seam stayed green after deterministic shared field/value id scoping, and the stale checklist item no longer mapped to a reproducible product-code defect during QA closure sync.
-   [x] Prove the imported connector failure root cause before patching the runtime payload layer.
    -   Outcome: the live imported-snapshot Playwright flow fails on `_app_attributes` global `id` upsert collisions because the same shared publication field id is materialized into multiple target entities; the earlier entity-scoped duplicate probes were too narrow.
-   [x] Scope repeated publication field ids per executable entity in applications-backend.
    -   Outcome: `resolveExecutablePayloadEntities(...)` now remaps repeated shared field ids deterministically per target entity, keeping `_app_attributes.id` globally unique without mutating the design-time/publication snapshot contract.
-   [x] Scope repeated shared enumeration value ids per runtime target object in applications-backend.
    -   Outcome: the normalized publication runtime source now remaps repeated shared enumeration value ids per target enumeration object and rewrites predefined catalog-element REF payloads to those scoped ids before `_app_values` sync runs.
-   [x] Revalidate the connector seam end to end after the runtime id-scoping fixes.
    -   Outcome: focused `applicationReleaseBundle.test.ts` passed (`14 / 14`), the imported snapshot connector Chromium flow passed (`2 passed`, `1.3m`), and the canonical root `pnpm build` completed green after rebuilding `@universo/applications-backend`.
-   [x] Reproduce the remaining connector duplicate failure from the imported self-hosted snapshot path.
    -   Outcome: the live imported flow was reproduced twice; the first failure exposed repeated shared field ids, and the second narrowed the remaining issue to repeated shared enumeration value ids in the normalized runtime snapshot after the field-id fix landed.
-   [x] Add focused browser and unit/backend regression coverage for the reopened defects.
    -   Outcome: focused metahubs/applications frontend/backend suites plus the shipped Common/shared and imported-connector browser coverage remained green on the current source state.
-   [x] Run focused validation plus the canonical root build, then sync memory-bank closure state.
    -   Outcome: root `pnpm build`, focused metahubs/backend/frontend checks, focused applications/backend/frontend checks, and the retained Playwright proof artifacts were all revalidated before the stale ledger state was closed.

## Completed Session: 2026-04-07 Shared/Common UI And Exclusions Contract Remediation

-   [x] Reopen the Shared/Common remediation session in memory-bank and keep the new scope explicit.
    -   Outcome: `tasks.md` and `activeContext.md` were reopened from the stale completed state so the post-import Common UI regressions and shared-dialog redesign stayed visible until the final validation pass.
-   [x] Move shared behavior controls out of the dedicated Shared tab and introduce a dedicated Exclusions tab across shared entity dialogs.
    -   Outcome: Shared attributes/constants/values now keep behavior controls under `Presentation`, expose a dedicated `Exclusions` tab, and ship the missing EN/RU tab/panel strings without falling back to English labels.
-   [x] Rebuild the exclusions UI around the existing assignment-panel pattern and keep exclusion writes on dialog save.
    -   Outcome: `SharedEntitySettingsFields` now uses the reusable `EntitySelectionPanel` flow, keeps `_sharedExcludedTargetIds` in local dialog state, and updates focused tests plus the Common/shared Playwright flow to the save-on-dialog contract.
-   [x] Fix the embedded Common list chrome regressions for Layouts, Attributes, Constants, and Values.
    -   Outcome: `ViewHeader` gained `controlsAlign`, embedded Common lists now right-align the search/action cluster, and the shared list surfaces use content offset guards instead of leaking standalone negative-margin layout into the Common shell.
-   [x] Repair the remaining generator/browser contract drift for shared containers and exclusions.
    -   Outcome: The self-hosted generator now ensures shared containers through the explicit write route, the Common/shared browser flow asserts exclusion persistence only after dialog save, and the refreshed self-hosted fixture was regenerated through the green generator spec.
-   [x] Run focused validation plus the canonical root build, then sync closure state across memory-bank.
    -   Outcome: Focused metahubs-frontend regressions passed (`2 files / 5 tests`), `metahub-shared-common.spec.ts` passed in Chromium (`4 passed`, `4.1m`), `metahubs-self-hosted-app-export.spec.ts` passed in the generators project (`2 passed`, `4.9m`), and the canonical root `pnpm build` completed green (`30 successful`, `22 cached`, `3m7.785s`).

## Completed Session: 2026-04-07 Shared/Common QA Remediation For Remaining Contract Gaps

-   [x] Fix shared entity exclusions so dialog changes follow the enclosing save/cancel lifecycle.
    -   Outcome: `SharedEntitySettingsFields` now keeps exclusion toggles in local form state and the attribute/constant/value save handlers sync only the changed exclusion overrides after a successful entity save.
-   [x] Preserve legacy metahub `global` scripts when editing from the current scripts UI.
    -   Outcome: `MetahubScriptsService.updateScript(...)` now preserves unchanged legacy `global` rows when the UI round-trips the normalized `library` role on the same metahub scope.
-   [x] Remove the writeful GET contract from shared container resolution.
    -   Outcome: `GET /shared-containers` is now read-only and Common/shared authoring explicitly creates missing shared pools through `POST /shared-containers/ensure`.
-   [x] Add focused regression coverage for the repaired shared settings, scripts, and shared container flows.
    -   Outcome: New shared-exclusion helper tests plus updated shared-settings/backend route-service regressions now lock the repaired contracts.
-   [x] Re-run focused validation and the canonical root build, then sync memory-bank closure state.
    -   Outcome: Focused metahubs-frontend regressions passed (`4 files / 19 tests`), focused metahubs-backend regressions passed (`3 suites / 27 tests`), and the canonical root `pnpm build` completed green (`30 successful`, `26 cached`, `58.468s`).

## Completed Session: 2026-04-07 QA Closure For Shared/Common Residual Gaps

-   [x] Align the EN/RU REST API reference with the live scripts detail routes and methods.
    -   Outcome: The mirrored EN/RU REST API pages now document the live `GET/PATCH/DELETE /metahub/{metahubId}/script/{scriptId}` surface instead of the stale plural-path `PUT` contract.
-   [x] Add route-level regressions for shared entity override endpoints.
    -   Outcome: New focused `sharedEntityOverridesRoutes.test.ts` coverage now locks the missing `400` invalid-query/input seams, the guarded `403` write seam, and baseline happy-path container/list/delete routing (`12/12` green together with neighboring scripts routes).
-   [x] Investigate and, if safe, eliminate the Playwright shared/Common cleanup noise found after the green browser run.
    -   Outcome: The E2E manifest cleanup now treats search-based orphan discovery as best-effort when the manifest already contains explicit application/metahub ids, so the runner no longer leaves `.artifacts/run-manifest.json` behind or emits `Manifest cleanup warning` after the green Common/shared Chromium flow.
-   [x] Re-run focused validation and the canonical root build after the residual-gap fixes.
    -   Outcome: Focused metahubs-backend route tests passed, the Common/shared Chromium flow passed twice (`4 passed`, `3.7m`), EN/RU API docs kept exact line parity, `pnpm docs:i18n:check` stayed green, and the canonical root `pnpm build` completed green (`30 successful`, `27 cached`, `22.196s`).
-   [x] Sync memory-bank closure state only after code, docs, and verification are green.
    -   Outcome: Active memory-bank files now reflect the closed residual-gap pass and the final validation evidence.

## Completed Session: 2026-04-07 QA Remediation For Remaining Shared Scripts Closure Gaps

-   [x] Enforce the backend `general/library` scope contract fail closed for create and update paths.
    -   Outcome: `MetahubScriptsService` now rejects `general` scripts outside the `library` role, rejects new out-of-scope `library` authoring, and preserves unchanged legacy out-of-scope rows instead of silently drifting them into a new invalid state.
-   [x] Add focused backend regressions for invalid `general` or `library` attachment combinations.
    -   Outcome: `MetahubScriptsService.test.ts` now locks invalid create/update combinations plus the legacy `global` update-compatibility seam (`16/16` green in the focused suite).
-   [x] Extend Playwright shared-script coverage with the missing negative Common/library scenarios.
    -   Outcome: `metahub-shared-common.spec.ts` now proves delete-in-use, codename-rename conflict, and circular `@shared/*` fail-closed behavior through the shipped Chromium browser flow (`4 passed`, `4.0m`).
-   [x] Close the remaining docs completeness gap in the current EN/RU docs structure.
    -   Outcome: The shipped EN/RU guides, architecture notes, and REST API references now document the fail-closed Common/library operator rules in the existing docs structure, and the edited EN/RU pairs kept mirrored structure/content.
-   [x] Run focused validation plus the canonical root build, then sync memory-bank closure state.
    -   Outcome: Focused metahubs backend/frontend regressions passed (`16/16`, `10/10`), `docs:i18n:check` passed, and the canonical root `pnpm build` completed green (`30 successful`, `25 cached`, `1m12.288s`).

## Completed Session: 2026-04-07 Final Closure For Shared Entities And Scripts

-   [x] Reconcile the final QA findings against the current shared entities/scripts implementation and close the real code gaps first.
    -   Outcome: Common scripts now resolve metahub manage permission before authoring, the deny/loading states are localized in EN/RU, and the negative-permission regression remains green.
-   [x] Add the missing focused regression coverage for the remaining shared entities/scripts closure seams.
    -   Outcome: Focused regressions now lock VLC-safe shared target label rendering, explicit-runner shared override writes under request-scoped RLS, and materialized-runtime snapshot hashing for publication-backed application sync.
-   [x] Add real Playwright coverage for shared entities and shared scripts, then regenerate and revalidate the affected fixture artifacts.
    -   Outcome: `metahub-shared-common.spec.ts` now proves Common shared entity merge/exclusion/publication/runtime plus shared-library authoring/import/publish/runtime in Chromium (`3 passed`), and the earlier fixture regeneration/application-sync proof remains the canonical shared-data artifact validation path.
-   [x] Update EN/RU docs and API/architecture references so the shipped Common/shared-entity and `general/library` scripting model is fully documented.
    -   Outcome: The bilingual docs/API/architecture surfaces were updated during the earlier closure batches and remain the shipped reference set for the completed Common/shared-entity and `general/library` contracts.
-   [x] Run focused validation plus the canonical root build, then sync memory-bank closure state only after everything is green.
    -   Outcome: Focused shared override/runtime-source service tests passed, `pnpm run build:e2e` passed, `metahub-shared-common.spec.ts` passed (`3 passed`, `3.3m`), and the canonical root `pnpm build` completed green (`30 successful`, `25 cached`, `1m39.093s`).

### Final Closure Micro-Batch

-   [x] Remove the nested shared-override transaction seam from request-scoped/Common override writes and keep parent transaction runners threaded through merged-order callers.
    -   Outcome: `SharedEntityOverridesService.upsertOverride(...)` now accepts an explicit runner, request-scoped controller writes reuse the request executor, parent merged-order callers pass `tx`, and focused service coverage proves the explicit-runner path does not reopen `exec.transaction()`.
-   [x] Re-run and stabilize `tools/testing/e2e/specs/flows/metahub-shared-common.spec.ts` against the real async checkbox/runtime success UI.
    -   Outcome: The browser flow now aligns with the real disabled Library role UI, async exclusion mutation behavior, materialized runtime snapshot hash contract, runtime create response, and quiz completion screen.
-   [x] If the focused browser flow is green, finish the remaining root-build and memory-bank closure updates.
    -   Outcome: The final root build and closure-memory sync were completed after the focused browser proof turned green.

## Completed Session: 2026-04-07 QA Closure For Remaining Shared Entities And Scripts Phases

-   [x] Reconcile the shared-entities ledger with the verified repository state before further edits.
    -   Outcome: The ledger now matches the real repository state: backend merged reads and Common/shared CRUD are marked complete, while the remaining open work is narrowed to frontend merged-row UX, publication/snapshot/runtime seams, widget gating, E2E, and docs.
-   [x] Finish the frontend merged shared/local list contract for attributes, constants, and enumeration values.
    -   Outcome: Attributes, constants, and enumeration values now use the merged `includeShared=true` read path end to end, render shared-row visual treatment plus read-only action gating, and keep optimistic reorder payloads aligned with merged-order semantics.
-   [x] Close the remaining shared-scripts publication/runtime seam.
    -   Outcome: Publication now preloads active shared libraries once, validates nested `@shared/*` dependencies in topological order before compiling consumers, keeps shared-library rows validation-only, and adds focused backend coverage for deterministic ordering plus circular-dependency failure.
-   [x] Implement shared-entity snapshot and application-sync support.
    -   Outcome: Snapshot export/import now preserves shared attrs/constants/values plus override rows in snapshot v2, publication/runtime schema generation materializes those shared sections through the existing flattened runtime path, and focused serializer/restore coverage plus package/root builds are green.
-   [x] Implement widget shared-behavior gating for inherited catalog-layout widgets.
    -   Outcome: Global layout widget editors now expose `sharedBehavior` for menu/columns/quiz plus a generic behavior-only dialog for other widgets, inherited catalog widgets reuse `_mhb_catalog_widget_overrides.is_deleted_override` for exclusions, and frontend/backend gating now fail closed on forbidden exclude/deactivate/reorder mutations.
-   [x] Add real Playwright coverage and fixture updates for shared entities and shared scripts.
    -   Outcome: Focused browser coverage now proves the shipped Common/shared entity and shared-library flows end to end, while the regenerated snapshot/self-hosted fixture proofs from the earlier closure batches remain green.
-   [x] Update bilingual docs and API/architecture references for the shipped shared-entity and `general/library` scripting model.
    -   Outcome: EN/RU docs plus API/architecture references now reflect the shipped Common/shared-entity and `general/library` behavior with mirrored structure and no stale pre-shared terminology.
-   [x] Re-run focused validation plus the canonical root build, then sync memory-bank closure state.
    -   Outcome: Focused metahubs-frontend shared-list regressions stayed green (`3 files / 15 tests`), `@universo/metahubs-frontend` built successfully, and the canonical root `pnpm build` finished green (`30 successful`, `20 cached`, `3m3.393s`) before the memory-bank closeout.

## Active: Shared/Global Entities & Enhanced Scripting (Plan Phase — QA-revised)

> Plan ref: [shared-entities-and-scripts-plan-2026-04-07.md](plan/shared-entities-and-scripts-plan-2026-04-07.md)
> Creative ref: [creative-shared-entities-architecture.md](../creative/creative-shared-entities-architecture.md)
> QA revision: 2026-04-07 — 17 corrections applied (see plan revision log)

Implementation note: execute phases in order, but land shared script type/normalization seams together with Phase 1 because `@universo/types`, compiler, backend validation, and frontend script UI share the same exported contracts.

### Phase 1: Foundation — Types, Schema, Backend Core

-   [x] 1.1 Add shared types to `@universo/types` (SharedObjectKind, SharedBehavior, script enums)
-   [x] 1.2 Add `_mhb_shared_entity_overrides` table to systemTableDefinitions.ts
    -   Note: `_mhb_shared_entity_overrides` is now registered in the metahub system-table definitions together with the unique active-row index and target/entity lookup indexes required for sparse shared override rows.
-   [x] 1.3 Create SharedContainerService (virtual container object management + anti-leak filtering across lists/selectors/counts)
    -   Note: `SharedContainerService` now lazily resolves/creates shared virtual container objects with advisory locking, exposes shared container lookup endpoints, and the generic metahub object service hides virtual containers from ordinary list/count flows.
-   [x] 1.4 Create SharedEntityOverridesService (CRUD + sharedBehavior backend enforcement + cleanup on both soft- and hard-delete)
    -   Note: `SharedEntityOverridesService` now enforces `sharedBehavior` fail-closed server-side and cleans override rows during shared entity deletion plus target-object soft/hard delete flows.
-   [x] 1.5 Create sharedEntityOverridesController (REST API endpoints)
    -   Note: Shared override routes are mounted under the metahubs router for override list/patch/delete plus shared container resolution.
-   [x] 1.6 Create merged entity list helpers (override-aware, mixed unlocked ordering, inactive-state support)
    -   Note: `mergedSharedEntityList.ts` plus `findAllMerged(...)` / merged reorder helpers are now wired for attributes, constants, and enumeration values with focused backend regressions.
-   [x] 1.7 Unit tests for Phase 1
    -   Note: Focused backend regressions now cover shared container creation/reuse, shared override enforcement, system-table registration, and virtual-container anti-leak filtering.

### Phase 2: Frontend — GeneralPage Tabs & Shared Entity CRUD

-   [x] 2.1 Add i18n keys (en + ru) for shared entity UIs
    -   Outcome: Shared entity/script deny, loading, Shared-tab, Common, and library-role guidance strings are localized in EN/RU and exercised by focused regressions/browser flows.
-   [x] 2.2 Extract shell-less content from AttributeList, SetList, EnumerationValueList
    -   Note: Current batch focuses on shared-container client resolution plus `renderPageShell` / settings-tab extraction so Common can embed shared Attributes / Constants / Values without duplicating list logic.
-   [x] 2.3 Extend GeneralPage with 5 tabs
    -   Note: Wire the new tabs only through reusable content layers backed by shared container ids; avoid a second page-shell/component stack.
-   [x] 2.4 ExclusionPanel component in shared entity dialogs
    -   Note: Current implementation batch adds reusable shared override client hooks plus one shared settings panel for behavior toggles and per-target exclusions across Common Attributes / Constants / Values.
    -   Outcome: `SharedEntitySettingsFields` now serves as the shared exclusion/settings surface instead of a separate `ExclusionPanel` component.
-   [x] 2.5 SharedBehavior settings (3 toggles: canDeactivate, canExclude, positionLocked) in shared entity dialogs
    -   Note: Values need a small backend/API contract extension because `presentation.sharedBehavior` is not yet accepted or returned by the enumeration value controller/service seam.
-   [x] 2.6 Frontend unit tests for Phase 2
    -   Outcome: Focused `GeneralPage`, `SharedEntitySettingsFields`, and related shared dialog regressions are in place; any remaining coverage gaps now belong to Phase 3 merge rendering and later E2E work.

#### Current Phase 2 Micro-Batch

-   [x] Finish EnumerationValueList shared dialog wiring (Shared tab + `presentation.sharedBehavior` payload path)
    -   Outcome: Common Values dialogs now expose the reusable Shared tab, preserve `presentation` through edit/copy defaults, and send `presentation.sharedBehavior` through create/update/copy payloads.
-   [x] Finish AttributeList / AttributeActions shared dialog wiring (create, edit, copy)
    -   Outcome: Shared attributes now reuse the same Shared tab across Common create flow plus attribute edit/copy dialogs, all backed by the shared override client and `uiConfig.sharedBehavior` storage.
-   [x] Add focused regressions for shared dialog controls and Common shared-mode props
    -   Outcome: `GeneralPage.test.tsx` now locks `sharedEntityMode` propagation and `SharedEntitySettingsFields.test.tsx` covers both shared-behavior toggles and exclusion mutations.
-   [x] Re-run targeted metahubs-frontend validation for the Phase 2 seam
    -   Outcome: Focused metahubs-frontend (`4 files / 6 tests`), focused metahubs-backend enumeration tests (`2 files / 20 tests`), and the canonical root `pnpm build` all passed on 2026-04-07.

### Phase 3: Visual Merge in Target Object Lists

-   [x] 3.1 Backend merged entity API (includeShared=true query param + server-side sharedBehavior enforcement)
    -   Note: Shared/local merged reads, merged reorder planning, and fail-closed sharedBehavior enforcement are now wired for attributes, constants, and enumeration values.
-   [x] 3.2 Frontend visual rendering (SharedEntityBadge styled Box, background tint, divider, DnD constraints)
    -   Note: Target-object lists now render merged shared rows with shared badges, divider/tint treatment, and row-level DnD/action constraints instead of a separate UI stack.
-   [x] 3.3 Widget inheritance enhanced styling — use existing `is_deleted_override` for widget exclusion, consistent badge style
    -   Outcome: Inherited catalog widgets now reuse `is_deleted_override` for exclusion, render consistent shared/inherited visual treatment, and stay gated by the sharedBehavior fail-closed contract in both UI and backend services.
-   [x] 3.4 Frontend/backend tests for Phase 3
    -   Note: Focused backend merge-helper coverage plus focused metahubs-frontend shared-list regressions now lock the Phase 3 contract.

#### Current Phase 3 Micro-Batch

-   [x] Implement backend merged read-path helpers for attributes, constants, and enumeration values
    -   Note: Added a shared merge helper, read-only shared container lookup, merged list reads for attributes/constants/values, merged reorder payload support, and focused backend route/helper tests.
-   [x] Repair the merged shared-order backend typing contract before closure validation
    -   Outcome: The shared merged-order seam now uses typed mapper outputs and a business-scope-specific attribute merged read path, so `planMergedSharedEntityOrder(...)` no longer receives `unknown` ids/sort orders or incompatible item unions.
-   [x] Extend list controllers and frontend API clients with `includeShared=true`
    -   Outcome: Existing list endpoints and query clients now support merged shared/local mode without introducing a second read API surface.
-   [x] Add row-level merge UX hooks in shared list tables
    -   Outcome: Shared rows now expose consistent tinting, badges, divider treatment, inactive/excluded rendering, and row-level drag constraints through reusable table hooks.
-   [x] Patch list actions and optimistic reorder flows for merged shared rows
    -   Outcome: Shared rows now suppress destructive/local-only actions and send `mergedOrderIds` through the merged reorder mutations with optimistic cache updates aligned to merged query keys.
-   [x] Wire merged data and action gating into AttributeList, ConstantList, and EnumerationValueList
    -   Outcome: The three target-object list surfaces now render shared rows as read-only authoring entries while preserving existing local CRUD/DnD behavior for local rows.
-   [x] Run focused Phase 3 validation and the canonical root build
    -   Outcome: The frontend shared-list regressions stayed green, `@universo/metahubs-frontend` built successfully, and the canonical root `pnpm build` completed green after the backend typing fix.

### Phase 4: Shared Scripts — Library Role & @shared/ Import

-   [x] 4.1 Replace `global` role with `library`, define `general/library` scope contract, add capability/default normalization, null-attachment handling, and `SharedLibraryScript`
    -   Note: `@universo/types`, `@universo/extension-sdk`, backend script validation/controller normalization, frontend `EntityScriptsTab`, and publication-aware script serialization now share one `general/library` contract with fail-closed `global -> library` normalization.
-   [x] 4.2 Scripting engine: esbuild @shared/ import resolver + compiler validation that libraries stay pure/non-executable
    -   Note: compiler tests now cover pure library compilation, `@shared/*` bundling, decorator/runtime-context rejection, and circular dependency detection.
-   [x] 4.3 Publication pipeline: dependency graph, cycle detection, and topological compilation order for shared libraries
    -   Note: `MetahubScriptsService.listPublishedScripts()` now preloads active `general/library` sources once, validates them in topological order, recompiles only consumer scripts that import `@shared/*`, and fails closed on circular publication-time library graphs.
-   [x] 4.4 GeneralPage Scripts tab with `EntityScriptsTab` (library role only) + dependency-aware delete/rename guard
    -   Note: `GeneralPage` now embeds `EntityScriptsTab` in `attachedToKind='general'` mode, locale strings include the library-role guidance, and the existing backend `MetahubScriptsService` dependency guards continue to block unsafe shared-library delete/codename-change operations.
-   [x] 4.5 Compiler/runtime/E2E tests for shared scripts, nested imports, codename rename safety, cross-metahub isolation, and no-regression across existing scopes
    -   Outcome: Focused compiler/backend publication-order coverage, shared-library runtime/no-regression checks, and the final Chromium Common/shared Playwright file now keep the shipped `general/library` scripting contract green.

### Phase 5: Snapshot, Publication & Application Sync

-   [x] 5.1 Snapshot export: add sharedAttributes/sharedConstants/sharedValues/sharedEntityOverrides sections
-   [x] 5.2 Snapshot import: restore shared entities + virtual containers
-   [x] 5.3 Hash normalization for new snapshot sections
-   [x] 5.3b Snapshot format version bump + backward-compatible import handling
-   [x] 5.4 Application sync: flatten shared attrs into `_app_attributes`, values into `_app_values`, and shared constants into the existing snapshot `constants` plus `setConstantRef` runtime path (still no `_app_constants` table)
-   [x] 5.5 Integration tests for snapshot/sync
    -   Outcome: Shared snapshot/application-sync coverage is closed through focused serializer/runtime-source regressions plus the browser snapshot/self-hosted/import flows exercised in the earlier closure batches.

#### Current Phase 5 Micro-Batch

-   [x] Materialize shared snapshot sections for publication/runtime deserialization and application sync.
    -   Outcome: Publication runtime loading plus publication-controller schema generation now flatten shared attrs/constants/values through `SnapshotSerializer.materializeSharedEntitiesForRuntime(...)` before DDL/runtime sync uses the snapshot.
-   [x] Restore shared containers, shared entities, and remapped shared overrides during snapshot import.
    -   Outcome: `SnapshotRestoreService` now recreates the three virtual shared containers, restores shared attrs/constants/values into them, and remaps `_mhb_shared_entity_overrides` rows to the restored target/shared entity ids.
-   [x] Thread shared services into snapshot export and canonical re-serialization call sites.
    -   Outcome: Metahub export/import-publication canonicalization and publication version creation now pass shared-container and shared-override services into `SnapshotSerializer`, so shared sections are emitted in snapshot v2 exports instead of being silently omitted.
-   [x] Run focused snapshot serializer/restore validation, metahubs-backend build, and the canonical root build.
    -   Outcome: Focused `SnapshotSerializer` + `SnapshotRestoreService` suites passed (`12 / 12`), `@universo/types` was rebuilt to refresh the snapshot-format contract for downstream package builds, `@universo/metahubs-backend` built successfully, and the canonical root `pnpm build` completed green (`30 successful`, `0 cached`, `4m3.658s`).

### Phase 6: Widget Shared Behavior in Catalog Layouts

-   [x] 6.1 SharedBehavior settings in global layout editor (canDeactivate, canExclude, positionLocked)
-   [x] 6.2 Widget exclusion via existing `is_deleted_override` with `sharedBehavior.canExclude` gating
-   [x] 6.3 Backend enforcement: reject override mutations when sharedBehavior forbids them
-   [x] 6.4 Widget behavior tests

#### Current Phase 6 Micro-Batch

-   [x] Wire widget sharedBehavior editing into the base layout widget editor.
    -   Outcome: `MenuWidgetEditorDialog`, `ColumnsContainerEditorDialog`, and `QuizWidgetEditorDialog` now surface the shared three-toggle contract for global/base layouts, and `WidgetBehaviorEditorDialog` covers widgets without specialized config editors.
-   [x] Enforce widget sharedBehavior in inherited catalog-layout widget mutations.
    -   Outcome: `LayoutDetails` now gates inherited drag/toggle/exclude affordances through `sharedBehavior`, while `MetahubLayoutsService` ignores stale forbidden overrides and rejects forbidden deactivate/reorder/exclude writes server-side.
-   [x] Add focused backend/frontend regressions for inherited widget gating and shared visual state.
    -   Outcome: Focused layout UI/service regressions now cover locked inherited controls, allowed exclusion, stale-override suppression, and backend fail-closed messages for position/deactivation/exclusion locks.
-   [x] Run focused validation for the widget seam, then rerun the canonical root build.
    -   Outcome: Focused metahubs frontend/backend layout tests passed, `@universo/metahubs-frontend` and `@universo/metahubs-backend` builds passed, and the canonical root `pnpm build` completed green (`30 successful`, `0 cached`, `3m46.335s`).

### Phase 7: E2E Playwright Testing

-   [x] 7.1 Shared entities E2E flow (create, visual merge, exclusions, publish)
    -   Outcome: `metahub-shared-common.spec.ts` now proves Common shared entity authoring, merged target visibility, exclusion, publication, sync, and runtime create behavior.
-   [x] 7.2 Shared scripts E2E flow (create library, import, publish, runtime)
    -   Outcome: The same Chromium flow now proves shared-library authoring, runtime consumer publication, and successful runtime quiz execution.
-   [x] 7.3 Fixture regeneration with shared entities
    -   Outcome: The fixture regeneration/snapshot import proofs from the earlier closure batches remain the canonical validation path for shared-data artifacts.
-   [x] 7.4 Existing script functionality verification
    -   Outcome: Existing scripting scopes remained covered by the focused compiler/backend/browser regression matrix during the closure wave.

### Phase 8: Documentation

-   [x] 8.1 User documentation (GitBook en + ru)
    -   Outcome: EN/RU user docs now describe the shipped Common/shared-entity authoring and runtime behavior.
-   [x] 8.2 API reference documentation
    -   Outcome: The touched API references were aligned with the shared entity override and scripting contracts during the earlier closure batches.
-   [x] 8.3 Architecture documentation update
    -   Outcome: Architecture docs and memory-bank references now describe the shipped shared snapshot/runtime materialization and Common/shared flows.
-   [x] 8.4 Script scopes documentation (general/library vs metahub vs object-attached)
    -   Outcome: The `general/library` scope is documented as the import-only shared-library seam distinct from metahub and object-attached executable scripts.

## Completed Session: 2026-04-07 PR Review Triage For GH753

-   [x] Collect all bot review threads from PR #753 and validate each claim against the current code/docs contract.
    -   Note: Rejected speculative follow-ups like new query params or caching because the review evidence only justified low-risk correctness/docs fixes plus a safe query consolidation.
    -   Outcome: Confirmed four valid seams: malformed catalog-layout guide frontmatter, stale Common/General terminology across user docs, file/component naming drift around `GeneralPage`, and duplicated metahub object count queries that also skipped the branch active-row predicate.
-   [x] Implement only the safe, codebase-consistent fixes that survive QA review.
    -   Note: Keep the patch set minimal and scoped to the verified review findings on docs, naming, and the backend count seam.
    -   Outcome: EN/RU docs now use the shipped Common terminology and current layout-owned behavior contract, `GeneralPage.tsx` now exports `GeneralPage`, and metahub summaries now use one filtered aggregate count query with `_upl_deleted = false AND _mhb_deleted = false` instead of two per-branch count scans.
-   [x] Re-run focused validation plus the canonical root build after the accepted fixes.
    -   Note: End with `pnpm build` from the repository root because the user explicitly requested full verification before pushing.
    -   Outcome: Targeted `@universo/metahubs-frontend` tests (`exports.test.ts`, `GeneralPage.test.tsx`) passed, targeted `@universo/metahubs-backend` `metahubsRoutes.test.ts` passed (`51/51`, `4 skipped`), manual EN/RU doc line-count parity matched on every edited pair, and the canonical root `pnpm build` completed green (`30 successful`, `25 cached`, `1m28s`).
-   [x] Update PR #753 with the validated follow-up commit(s) from `feature/gh752-general-catalog-layouts`.
    -   Note: A full `@universo/metahubs-frontend` package test attempt surfaced unrelated pre-existing failures in `MetahubMigrations.test.tsx` due an incomplete `@universo/template-mui` mock (`PAGE_CONTENT_GUTTER_MX` missing); keep that debt out of this PR-review patch set.
    -   Outcome: Follow-up commits `c54537683` and the final memory-bank sync were pushed from `feature/gh752-general-catalog-layouts` into PR #753.

## Completed Session: 2026-04-07 QA Remediation For Layout-Owned Catalog Behavior Contract

-   [x] Remove the stale catalog runtimeConfig authoring contract from metahubs frontend forms, payloads, and shared types.
    -   Note: Catalog CRUD/UI should stop treating runtimeConfig as a source of truth now that runtime behavior is owned by the selected layout or the global layout baseline.
    -   Outcome: Metahubs frontend catalog create/edit/copy flows and shared catalog types no longer serialize or expose legacy `runtimeConfig`.
-   [x] Align metahubs backend catalog CRUD so catalog runtimeConfig is no longer accepted, persisted, or returned as part of the catalog API contract.
    -   Note: Keep the fix scoped to the catalog controller/API seam and avoid reintroducing a runtime fallback that would split behavior ownership again.
    -   Outcome: Catalog controller schemas/responses dropped `runtimeConfig`, and update/copy flows now explicitly strip stale persisted `config.runtimeConfig` state.
-   [x] Rewrite the affected regression suites to the layout-owned behavior contract.
    -   Note: Update backend/frontend/runtime tests that still assert runtimeConfig persistence or mock reorder capability through catalog object config.
    -   Outcome: Focused frontend/backend/runtime regressions now reject legacy `runtimeConfig` contract usage and source reorder capability from layout `catalogBehavior`.
-   [x] Run focused validation plus the canonical root build after the contract cleanup.
    -   Note: Validation must cover the touched frontend/backend/runtime seams first and end with `pnpm build` from the repository root.
    -   Outcome: Focused `@universo/metahubs-frontend`, `@universo/metahubs-backend`, and `@universo/applications-backend` regressions all passed, touched-file ESLint recheck had `0` errors, and the canonical root `pnpm build` finished green (`30 successful`, `28 cached`, `1m8.073s`).
-   [x] Sync memory-bank closure state only after the implementation and validation evidence are green.
    -   Note: Update `activeContext.md` and `progress.md` after the code and verification prove the reopened QA seam is closed.
    -   Outcome: `activeContext.md`, `currentResearch.md`, `progress.md`, `systemPatterns.md`, and `techContext.md` now reflect the closed layout-owned catalog behavior remediation state and final validation evidence.

## Completed Session: 2026-04-07 QA Remediation For Snapshot Hash Integrity And Catalog Layout Contract

-   [x] Extend the canonical publication snapshot hash/checksum path so every exported design-time snapshot section participates in integrity validation.
    -   Note: Cover the current serializer/export surface, including scripts, catalog layouts, and catalog layout widget overrides, so snapshot import validation and application release checksums stop missing real changes.
    -   Outcome: `normalizePublicationSnapshotForHash(...)` now includes `scripts`, `catalogLayouts`, and `catalogLayoutWidgetOverrides`, so both snapshot envelope integrity checks and application release checksums react to those exported sections.
-   [x] Add focused regression coverage for the repaired snapshot hash path.
    -   Note: Lock both normalization and envelope validation with explicit tests that fail when scripts or catalog layout sections drift without changing the hash.
    -   Outcome: Focused `@universo/utils` tests now fail closed when scripts or catalog overlay sections change without changing the hash and when tampered envelopes try to reuse the old digest.
-   [x] Align the catalog-layout documentation with the shipped inherited-widget contract.
    -   Note: The docs must stop promising inherited widget config overrides if the real product deliberately keeps inherited widget config read-only and materialized from the base layout.
    -   Outcome: EN/RU `catalog-layouts` guides now describe inherited widgets as visibility/placement overlays only and explicitly state that inherited config stays sourced from the base layout.
-   [x] Re-run focused validation plus the canonical root build after the fixes.
    -   Note: Validation must cover touched utils/backend seams first and end with `pnpm build` from the repository root.
    -   Outcome: Focused `@universo/utils` snapshot/hash tests passed (`22/22`), `pnpm --filter @universo/utils build` passed, and the canonical root `pnpm build` completed green.
-   [x] Sync memory-bank closure state once code, docs, and validation are green.
    -   Note: Update `activeContext.md` and `progress.md` only after the implementation and verification evidence is complete.
    -   Outcome: `tasks.md`, `activeContext.md`, `progress.md`, `currentResearch.md`, `systemPatterns.md`, and `techContext.md` now reflect the closed snapshot-integrity remediation state.

## Completed Session: 2026-04-07 QA Remediation Implementation For Runtime Surfaces, Shared Layout UI, Counts, And Version Semantics

-   [x] Fix runtime page-surface behavior for create/edit/copy and clear stale page-surface state when switching or reopening catalogs.
    -   Note: Resolve the real state/navigation contract in the runtime flow, including the reported `?surface=page&mode=...` residue and the previously confirmed reorder-persistence regression, without preserving legacy compatibility paths the user no longer needs.
    -   Outcome: Runtime page surfaces now resolve from the active layout contract, stale surface/query residue is cleared on reopen/navigation, and the related reorder persistence seam was aligned with the clean current-state model.
-   [x] Fix the connector metahub-picker dialog presentation defects.
    -   Note: Remove the extra divider/line artifacts and restore correct bottom/right padding and shared dialog spacing so the picker matches the current dialog presentation system.
    -   Outcome: The connector metahub picker now follows the current shared dialog spacing contract without the extra divider artifacts and clipped right/bottom padding.
-   [x] Restore Common/Layout toolbar alignment and the global page-gutter contract.
    -   Note: Bring Common/Layout controls back to the same right-aligned behavior as Hubs and remove the oversized lateral gutters that appeared across the affected pages.
    -   Outcome: Common -> Layouts now uses the same right-aligned header behavior as the other list surfaces, and the oversized lateral gutter regression was removed.
-   [x] Fix incorrect metahub hub counts and revalidate the list/query contract.
    -   Note: The metahub list must show the real related hubs count instead of `0`; cover the backend/frontend seam that derives the count.
    -   Outcome: The metahub list/query seam now returns and renders the real related hubs count instead of the stale zero-value fallback.
-   [x] Reset migration/version display to `0.1.0` where required and verify the surviving meaning of the `Structure` version surface after the recent refactors.
    -   Note: Keep the fix scoped to the real shipped contract instead of layering more compatibility formatting onto the current UI.
    -   Outcome: The shipped version/migration surfaces were reduced back to the surviving `0.1.0` contract where required, while keeping the remaining Structure meaning tied to the real current code path instead of legacy formatting.
-   [x] Regenerate the self-hosted metahub fixture with the Settings catalog configured for page surfaces and verify the import/runtime flow.
    -   Note: Update `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the real generation path after the runtime/layout fixes are in place.
    -   Outcome: The sparse Settings-layout generator assertion now matches the persisted contract, the current `0.1.0` branch-schema baseline again includes `_mhb_scripts`, the browser self-hosted generator passed (`2 passed`, `4.7m`), and the committed fixture was rewritten with `snapshot.versionEnvelope.structureVersion = 0.1.0`.
-   [x] Run focused validation, then the canonical root build, and only after green results sync `activeContext.md` / `progress.md` closure state.
    -   Note: Validation must cover the touched runtime, layout, dialog, count, fixture, and version seams rather than relying only on static inspection.
    -   Outcome: Focused `systemTableDefinitions` backend coverage passed (`27/27`), `snapshot-export-import.spec.ts` passed (`5 passed`, `1.9m`), and the canonical root `pnpm build` completed green.

## Active Session: 2026-04-06 QA Regression Sweep For Catalog Dialogs, Common Layout Header, And Codename Contract Cleanup

-   [x] Restore the shared catalog dialog initial-values contract so catalog edit/copy dialogs and catalog settings overlays from attributes/elements routes can open without runtime ReferenceErrors.
    -   Note: Repair the exported helper seam in `CatalogActions.tsx`, verify every importer (`CatalogActions` itself, `AttributeList`, `ElementList`), and fail closed with focused regression coverage.
    -   Outcome: `CatalogActions.tsx` now exports the shared initial-values, copy, and validation helpers expected by catalog edit/copy actions and nested catalog Settings entrypoints from attributes/elements routes.
-   [x] Re-align the Common -> Layouts toolbar/search header with the standard list-page layout while preserving the compact adaptive header only for true dialog-width embedded catalog layout managers.
    -   Note: The Common page should no longer inherit the forced compact embedded-toolbar mode that was introduced for the catalog edit dialog.
    -   Outcome: `LayoutList.tsx` now separates `compactHeader` from generic embedded rendering, and `GeneralPage` forces the standard full-width Common -> Layouts header while true dialog-width catalog layout managers keep the compact adaptive variant.
-   [x] Add focused automated regressions plus browser coverage for the reported breakages.
    -   Note: Cover catalog action build-props/export seams, Common/Layouts header mode selection, catalog edit/copy browser flows, and the attributes/elements Settings continuity path that opens the parent catalog dialog.
    -   Outcome: Focused frontend regressions, expanded Playwright Settings continuity checks, and a backend `MetahubObjectsService` regression now fail closed on the shared dialog/helper seam and the undefined JSON update binding that only surfaced after the browser crash was removed.
-   [x] Audit the current codename storage contract and clean stale documentation/memory references that still imply legacy non-VLC codename storage.
    -   Note: Verify the single JSONB/VLC codename contract in code first, then update docs/memory-bank/repo memory only where the older model is still described.
    -   Outcome: Re-audit confirmed the repository still persists codename through one JSONB/VLC `codename` field; `general.codenameLocalizedEnabled` only trims non-primary locale variants via `enforceSingleLocaleCodename(...)`, stale current-research/docs wording was corrected, and no workspace artifact named `admin-role-codename-localized-contract-20260323.json` exists.

## Active Session: 2026-04-06 VLC Snapshot Contract And Browser-Faithful Fixture Regeneration

-   [x] Patch the metahub snapshot contract to preserve VLC codename payloads for entities, constants, enumeration values, and scripts.
    -   Note: Update snapshot-local/shared types, serializer/export, restore/import, and hash normalization so export/import round-trips keep bilingual codename state instead of flattening to primary-text strings.
    -   Outcome: Snapshot-local codename-aware types, serializer/export, restore/import, and hash normalization now preserve VLC payloads across the metahub snapshot path instead of flattening them to strings.
-   [x] Adapt downstream runtime and sync consumers to accept VLC snapshot codename payloads while still flattening only at executable/runtime boundaries.
    -   Note: Cover release-bundle materialization, set-constant enrichment, sync previews, runtime script persistence, and any other touched string-only consumer so object codename input never degrades into `[object Object]` or equivalent corruption.
    -   Outcome: Runtime sync/materialization, script persistence, set-constant refs, and preview consumers now accept VLC snapshot input while preserving string-only executable/runtime boundaries.
-   [x] Update focused snapshot/runtime regression tests to fail closed on legacy string-only codename assumptions.
    -   Note: Lock serializer, restore/import, hash, runtime-materialization, and script-persistence seams before moving on to fixture regeneration.
    -   Outcome: Focused metahubs-backend, applications-backend, and universo-utils regressions now assert VLC snapshot preservation and runtime flattening at the intended boundaries.
-   [x] Rework the committed fixture generators so durable metahub/application fixtures are authored through the real browser flow wherever the repository already has a shipped authoring path.
    -   Note: Reuse existing browser-authoring helpers/spec patterns instead of hand-rolling a second authoring model, and keep any remaining API helpers limited to non-authoring bootstrap seams only when no shipped UI path exists.
    -   Outcome: The quiz and self-hosted generator specs now validate and persist the raw exported envelope from the browser-driven authoring flow instead of canonicalizing codename state after export.
-   [x] Fix the committed fixture contracts so they assert the real VLC snapshot/export shape instead of backfilling missing localized codename state after export.
    -   Note: Remove drift-masking canonicalization for quiz/self-hosted fixtures and keep contract assertions aligned with the new snapshot structure.
    -   Outcome: The quiz and self-hosted fixture contracts now fail closed on missing localized codename objects instead of masking export drift after the fact.
-   [x] Fix the remaining field-level attribute codename read seam so snapshot export receives localized codename objects for fields as well as entities/scripts/constants/enumeration values.
    -   Note: The live quiz generator had isolated the last defect to the metahub attribute read pipeline, where field `codename` was still flattened before snapshot serialization.
    -   Outcome: Snapshot export now uses a dedicated snapshot-oriented attribute read path that preserves localized field codename objects without widening the default UI/API string contract.
-   [x] Regenerate the committed quiz fixture from the corrected browser/export path.
    -   Note: The final JSON must reflect the live snapshot/export contract directly, including preserved localized codename payloads.
    -   Outcome: The browser-authored quiz generator passed after the attribute-read fix and rewrote `tools/fixtures/metahubs-quiz-app-snapshot.json` from the raw exported envelope.
-   [x] Regenerate the committed self-hosted fixture from the corrected browser/export path.
    -   Note: Preserve the existing functional coverage of the self-hosted flow while removing codename-localization drift and contract masking.
    -   Outcome: The self-hosted generator now passes under the stricter raw contract and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`, including the catalog-layout override expectations.
-   [x] Re-run focused backend/frontend/generator/import validation plus the canonical root build.
    -   Note: Validation must cover snapshot serializer/restore behavior, touched generator/fixture flows, snapshot import runtime proof, and final `pnpm build` from the repository root.
    -   Outcome: Focused metahubs-backend (`14/14`) and universo-utils (`17/17`) suites passed, the browser `snapshot-export-import.spec.ts` flow passed (`5 passed`, `2.0m`) after aligning the Settings catalog layout assertion with sparse widget-override semantics, and the canonical root `pnpm build` completed green (`30 successful`, `30 cached`).
-   [x] Sync memory-bank closure state after code, fixtures, and validation are green.
    -   Note: Update `activeContext.md`, `progress.md`, and this ledger only after the VLC snapshot contract and regenerated fixtures are fully validated.
    -   Outcome: `tasks.md`, `activeContext.md`, and `progress.md` now reflect the completed VLC snapshot/export closure state and the final validation evidence.

## Completed Session: 2026-04-06 QA Remediation For Snapshot Export And Layout Cache Consistency

-   [x] Reopen the General/catalog-layout closure state and align memory-bank status with the new QA remediation scope.
    -   Note: The earlier closeout is no longer fully truthful while snapshot export and cross-layout cache invalidation still carry confirmed QA debt.
    -   Outcome: `tasks.md` and `activeContext.md` now truthfully reflect that the feature is temporarily reopened for two narrow QA remediation seams.
-   [x] Harden the publication snapshot layout contract so layout export/import stays internally consistent and does not drop required authoring state.
    -   Note: Fix `attachLayoutsToSnapshot()` and the related restore/validation coverage so inactive catalog/global layouts and layout-linked override rows round-trip safely without orphaned references.
    -   Outcome: Snapshot export now serializes the full design-time global/catalog layout set, filters override rows to exported catalog layouts, and adds direct backend regression coverage for inactive-layout round-tripping.
-   [x] Repair cross-layout React Query invalidation so catalog layouts refresh after base global layout mutations within one SPA session.
    -   Note: Keep the fix scoped to the layouts domain, avoid broad cache churn where unnecessary, and add a focused regression that covers inherited catalog views after editing the base layout.
    -   Outcome: Global-layout config/widget mutations now invalidate the full layouts root in both detail-view and shared mutation paths, and focused frontend coverage locks the cache invalidation contract.
-   [x] Re-run focused backend/frontend/runtime validation plus the canonical root build, then sync `activeContext.md`, `progress.md`, and the final task closure state.
    -   Note: Validation must cover snapshot/layout backend seams, layout frontend regressions, runtime layout behavior tests, and `pnpm build` from the repository root.
    -   Outcome: Focused metahubs-backend (`18/18`), metahubs-frontend (`10/10`), applications-backend (`2/2`), applications-frontend (`11/11`), and apps-template-mui (`5/5`) suites passed; targeted Playwright flows for `metahub-general-catalog-layouts.spec.ts` and `snapshot-export-import.spec.ts` also passed; touched-file diagnostics stayed clean; and the canonical root `pnpm build` completed green with `30 successful`, `28 cached`, and `1m9.26s`.

## Completed Session: 2026-04-06 Catalog Layout QA Remediation And UI Finalization

-   [x] Remove the legacy catalog fallback-behavior model so catalog runtime behavior is driven only by the selected layout or the shared global layout baseline.
    -   Note: The user explicitly does not want to preserve legacy compatibility for old test data. The new clean-db contract should be: global layout works by default, and catalog-specific behavior/layout appears only after creating a catalog layout.
    -   Outcome: Catalog runtime behavior resolution no longer falls back to catalog object `runtimeConfig`; the selected layout owns behavior, while the global layout remains the default baseline until a catalog-specific layout exists.
-   [x] Rename the catalog tab and clean the embedded catalog-layout surface copy.
    -   Note: The tab must use the plural wording (`Layouts` / `Макеты`), the redundant in-body heading must disappear, and the surrounding helper copy must match the no-fallback product contract.
    -   Outcome: The catalog tab now ships as `Layouts` / `Макеты`, the embedded redundant title is removed, and the helper copy now describes the layout-only contract instead of legacy fallback behavior.
-   [x] Rework the embedded catalog layout toolbar to the requested adaptive single-row behavior.
    -   Note: Search, view-toggle, and create must stay on one line while width permits, shrink the search field first, and then switch to the mobile-style icon-triggered full-width search overlay when the minimum width is exceeded.
    -   Outcome: Embedded layout headers now use the shared adaptive-search `ViewHeader` contract with a single-row toolbar that collapses into icon-triggered search when dialog width is constrained.
-   [x] Remove the extra left/right content gutters in the catalog layout tab and make the card grid stretch correctly.
    -   Note: Embedded layout content inside the catalog dialog should use the full available width, and the grid must collapse to one full-width card before leaving a large empty right column.
    -   Outcome: Embedded catalog layout content now renders without the standalone page shell/gutters, and the layout card grid uses `auto-fit` behavior so lone cards stretch to the available width.
-   [x] Reconcile the catalog layout editor/runtime contract with the imported self-hosted fixture and finish any missing implementation from the prior QA pass.
    -   Note: Verify that imported Settings-catalog layouts behave correctly, layout creation/copy/delete remain safe, and the catalog runtime create/edit/copy surfaces still resolve from layout-owned behavior settings.
    -   Outcome: Catalog layout creation/storage now keeps sparse config semantics, published runtime materialization reconstructs widget-visibility booleans from effective widgets, and the imported Settings catalog path follows the same layout-owned runtime behavior contract.
-   [x] Expand and rerun focused automated validation plus real-browser Playwright coverage for the updated catalog layouts flow.
    -   Note: Validation must include touched frontend/backend/runtime tests, the imported self-hosted snapshot path, and the targeted catalog-layout browser scenarios.
    -   Outcome: Focused utils/frontend/backend/shared-header tests passed, `pnpm run build:e2e` completed green (`30 successful`), `metahub-general-catalog-layouts.spec.ts` passed (`2 passed`, `1.8m`), and the canonical root `pnpm build` stayed green (`30 successful`).

## Completed Session: 2026-04-06 Self-Hosted Connector Sync Hang Investigation

-   [x] Reproduce and isolate the remaining imported self-hosted snapshot connector sync timeout.
    -   Note: The browser artifact already proves the POST `/api/v1/application/:id/sync` is sent and the UI enters `Syncing...`, so the focus is the backend sync pipeline for the imported self-hosted fixture.
    -   Outcome: The targeted repro plus temporary step logging proved the backend sync path was not hanging; runtime sync finished in a few seconds and the failure was caused by the Playwright test exhausting the default 60-second budget before it reached `Create Schema`.
-   [x] Identify and fix the backend step that stalls during initial schema creation for the imported self-hosted snapshot.
    -   Note: Narrow the issue inside `runPublishedApplicationRuntimeSync(...)` and keep the fix scoped to the real blocker instead of changing the connector UI or Playwright wait conditions.
    -   Outcome: No backend stall existed. The temporary `SchemaSyncDebug` instrumentation was removed after verification, and the real fix was to give the imported snapshot connector flow an explicit `test.setTimeout(180_000)` budget that matches the cost of metahub import plus application schema creation.
-   [x] Re-run the targeted connector/schema verification and only then sync memory-bank closure state.
    -   Note: Finish with the failing connector flow, any relevant focused validation, and then update `activeContext.md` / `progress.md` with the final result.
    -   Outcome: The targeted imported connector flow passed (`2 passed`, `1.3m` including setup), the full fixture import verification trio passed (`8 passed`, `5.6m`), and the canonical root `pnpm build` remained green after the timeout fix and backend cleanup.

## Completed Session: 2026-04-06 Common Section, Dialog Tabs, And Fixture Regeneration Follow-up

-   [x] Rename the General section to the requested Common/Common-like product wording across UI copy, routes/menu labels, and any code-level entity names that still encode the wrong term.
    -   Note: Fix both locales and verify why the current UI surfaced English text in a Russian session instead of the expected localized copy.
    -   Outcome: The metahub section now uses `Common` / `Общие` across menu, breadcrumbs, page header, selectors, and `/common` routes, while the missing `general` i18n block was added back into the metahubs namespace registration so Russian sessions no longer fall back to English defaults.
-   [x] Repair the Common/layouts authoring surface regressions in dialogs and new-layout defaults.
    -   Note: New metahub layouts created manually must start with empty zones, the language badge in the create-layout dialog must stop clipping at the top-right corner, and focused tests must explain why the previous coverage missed both issues.
    -   Outcome: Manually created layouts now start empty instead of seeding dashboard widgets, the localized-field language badge no longer clips in layout dialogs, and focused regressions cover both the empty-layout contract and the field-badge rendering seam.
-   [x] Reconcile entity settings dialogs so every edit entrypoint exposes the same tab contract, including Scripts where supported and the modern catalog Layout tab everywhere.
    -   Note: Audit both list-origin and in-entity Settings entrypoints, fix missing Scripts/Layout tabs, and add regressions for the mismatched dialog variants.
    -   Outcome: Settings-origin entity dialogs now pass the same action context as list-origin dialogs, so Scripts and the modern catalog Layout tab render consistently across all relevant edit entrypoints.
-   [x] Make the catalog Layout tab toolbar adaptive inside edit dialogs.
    -   Note: When the search/view/create controls do not fit the dialog width, the behavior must collapse to the same compact/mobile pattern already used on responsive list surfaces.
    -   Outcome: Embedded layout list headers now wrap controls in dialog-width contexts instead of overflowing the toolbar row, so the catalog layout create action remains reachable at normal desktop dialog widths.
-   [x] Refresh the Playwright authoring/generator sources and regenerate the committed metahub/application fixtures.
    -   Note: Update both exported fixtures under `tools/fixtures`, ensure the self-hosted/metahub fixture demonstrates a catalog-specific layout override on the Settings catalog, regenerate the quiz fixture from the corrected flow, and prove both imports still work.
    -   Outcome: Generator sources were updated, both committed fixtures were regenerated, and the self-hosted fixture now includes a dedicated Settings catalog layout override that demonstrates catalog-specific runtime presentation changes after import/publication/application creation.
-   [x] Re-run focused package validation, full browser verification, fixture import proof, and then sync memory-bank closure state.
    -   Note: Finish with the relevant Vitest/Jest/Playwright/generator/import checks plus the canonical root `pnpm build`, then update memory-bank status files with the final closure evidence.
    -   Outcome: Focused frontend/backend checks passed, layout/browser flows passed, generator specs passed, the fixture import verification trio passed (`8 passed`, `5.6m`), and the canonical root `pnpm build` completed green.

## Completed Session: 2026-04-06 Final QA Closure For General Page Single-Shell Contract

-   [x] Extract a shell-less layouts content layer so the General page stops nesting a full standalone Layouts page inside its own header/tab shell.
    -   Note: Keep the public `LayoutList` route contract intact for standalone usage, but let `GeneralPage` reuse the same list logic without rendering a second `MainCard`/`ViewHeader` page shell.
    -   Outcome: `LayoutList.tsx` now exports `LayoutListContent` for shell-less reuse, while the default `LayoutList` component remains the standalone page wrapper for the public route contract.
-   [x] Add focused regression coverage for the General page shell contract.
    -   Note: Lock the `GeneralPage` tab/header surface and the shell-less layouts reuse path so future General tabs cannot silently reintroduce nested page chrome.
    -   Outcome: `GeneralPage.test.tsx` now proves the General header/tab shell is rendered once, `LayoutListContent` is embedded with `renderPageShell={false}`, and the standalone `LayoutList` wrapper is not mounted inside General.
-   [x] Re-run the touched frontend validation plus browser/build proof.
    -   Note: Validation must include the new focused metahubs-frontend regression, the existing layout regressions, the real Playwright General/catalog-layout flows, and the canonical root `pnpm build`.
    -   Outcome: Focused metahubs-frontend Vitest passed (`7/7`), the real Playwright flows passed (`3 passed`, `2.3m`), targeted ESLint on the changed frontend files passed clean after final formatting, and the canonical root `pnpm build` completed green after the refactor.
-   [x] Sync memory-bank closure state only after the refactor and validation are green.
    -   Note: Update `activeContext.md` and `progress.md` so the closure status matches the final QA-correct state.
    -   Outcome: `tasks.md`, `activeContext.md`, `progress.md`, `systemPatterns.md`, and `techContext.md` now reflect the final single-shell General page contract and closure evidence.

## Completed Session: 2026-04-06 Post-QA Completion For General Section + Catalog Layouts

-   [x] Fix runtime root-layout selection so startup catalog resolution never derives from a catalog-scoped layout when no catalog is explicitly requested.
    -   Note: Preserve the existing catalog-specific fallback for explicit catalog runtime requests; add direct regression coverage for the root/startup path.
    -   Outcome: Runtime startup menu binding is now resolved from the global default/active layout only, so implicit root catalog selection cannot drift to a catalog-scoped runtime layout.
-   [x] Align layout authoring permissions with the existing metahub management model on the frontend.
    -   Note: Gate create/manage actions in `LayoutList` and catalog-behavior editing in `LayoutDetails` so the UI matches the backend `manageMetahub` contract instead of relying on 403 responses.
    -   Outcome: Read-only users can still inspect layout detail screens, but create/copy/edit/delete/default/toggle/add-widget and catalog behavior mutations are now hidden or disabled unless `permissions.manageMetahub` is true.
-   [x] Expand regression coverage for the post-QA fixes.
    -   Note: Add focused tests for runtime startup layout selection and the new frontend permission-gating behavior while preserving the already-green copy/inheritance/runtime suites.
    -   Outcome: Added a focused applications-backend runtime-controller regression plus new metahubs-frontend read-only layout tests without regressing the existing inherited-widget and copy-flow coverage.
-   [x] Complete Phase 9 documentation exactly as planned in both locales.
    -   Note: Add dedicated EN/RU guide pages for General Section and Catalog Layouts, update both `SUMMARY.md` files, and keep EN/RU structure aligned.
    -   Outcome: Added new EN/RU guide pages, updated guide navigation and summaries, and replaced the stale `Layouts` navigation wording with `General -> Layouts` in the touched authoring guides while preserving EN/RU line parity.
-   [x] Re-run targeted validation plus the canonical root build, then sync memory-bank closure state.
    -   Note: Finish with focused package tests/builds first, then `pnpm build`, and only after green validation update `activeContext.md` and `progress.md`.
    -   Outcome: Focused applications-backend and metahubs-frontend regressions passed, the first root build attempt failed only on a transient `@universo/core-frontend` Vite OOM, and the canonical full root build completed green after rerunning with a larger Node heap budget.

## Completed Session: 2026-04-06 Reopened QA Fix For Inherited Catalog Widgets

-   [x] Reopen the General/catalog-layout closure state and realign memory-bank status with the current QA finding.
    -   Note: The feature was intentionally reopened until the inherited-widget read-only contract and validation evidence were truthful again.
    -   Outcome: `tasks.md` and `activeContext.md` no longer claimed full closure while inherited catalog widgets still exposed invalid config editing.
-   [x] Fail closed on backend config edits for inherited catalog widgets while preserving move/toggle support.
    -   Note: The sparse overlay model must keep inherited widget config sourced from the base global widget.
    -   Outcome: `MetahubLayoutsService` now rejects inherited widget config edits, removal, and direct reassignment while keeping move/toggle semantics on sparse override rows.
-   [x] Expose inherited-widget metadata to the frontend and gate edit/remove affordances in the catalog layout editor.
    -   Note: The UI must distinguish inherited vs catalog-owned widgets without regressing global-layout editing or catalog behavior settings.
    -   Outcome: The shared catalog layout editor now receives `isInherited`, renders an inherited badge, preserves drag/toggle, and hides edit/remove actions for inherited rows.
-   [x] Add focused regression coverage for the inherited-widget read-only contract and rerun the feature validation stack.
    -   Note: Validation must include touched backend/frontend suites, the feature Playwright/browser flow, and the canonical root build.
    -   Outcome: Focused metahubs-backend, metahubs-frontend, and applications-backend suites passed; `pnpm run build:e2e` completed green; `metahub-general-catalog-layouts.spec.ts` passed (`2 passed`, `1.8m`); and the canonical root `pnpm build` remained green.
-   [x] Sync final memory-bank closure state only after the inherited-widget contract and validation evidence are green again.
    -   Note: Close the feature only after code, tests, browser proof, and memory-bank state all agree.
    -   Outcome: `tasks.md`, `activeContext.md`, `progress.md`, `systemPatterns.md`, `techContext.md`, and `currentResearch.md` now reflect the final validated closure state.

## Active Session: 2026-04-06 QA Remediation For General Section + Catalog-Specific Layouts

-   [x] Repair catalog-layout copy so scope, base-layout inheritance, sparse overrides, and catalog-owned widgets survive copy flows without leaking into the global-layout scope.
    -   Note: Fix both the backend copy contract and the frontend scope propagation, then add direct regression coverage for catalog-scoped copy.
    -   Outcome: The backend copy controller now preserves `catalog_id`, `base_layout_id`, catalog-owned widgets, and inherited sparse overrides across copy flows, including the deactivate-all path for inherited base widgets.
-   [x] Restore true base-layout inheritance for newly created catalog layouts instead of seeding dashboard defaults that overwrite authored global layout config.
    -   Note: The first catalog layout must start from the selected global base layout config plus seeded catalog behavior config only; do not regress existing global-layout creation semantics.
    -   Outcome: Catalog layout creation now validates the target catalog object and inherits the selected global base layout config, while the frontend create payload sends only the sparse catalog behavior seed instead of full dashboard defaults.
-   [x] Re-harden sparse overlay semantics so reorder/toggle operations persist only the intended deltas and do not freeze inherited widget config unnecessarily.
    -   Note: Non-overridden global widget config must keep flowing into catalog layouts after reorder/add/remove operations.
    -   Outcome: Sparse inherited overrides now persist only zone/order/config/activity deltas, and empty override rows are soft-deleted so future global widget config changes continue to flow into catalog layouts.
-   [x] Tighten catalog-layout data integrity validation so catalog-scoped layouts can only target real catalog objects.
    -   Note: Keep existing RBAC behavior unchanged while preventing invalid object references from being persisted as catalog layouts.
    -   Outcome: Catalog-scoped layouts now fail closed unless `catalog_id` targets a real catalog object in `_mhb_objects`, preventing invalid metahub object references from being stored as catalog layouts.
-   [x] Add focused backend/frontend/runtime regressions for the remediation seam, rerun targeted validation plus the canonical root build, and then sync memory-bank closure state.
    -   Note: Validation must include the touched Jest/Vitest suites, the General/catalog-layout Playwright/browser flow, and final `pnpm build`.
    -   Outcome: Focused backend Jest, focused frontend Vitest, touched-file ESLint, the real General/catalog-layout Playwright flow, and the canonical root `pnpm build` all passed after the remediation patch set.

## Active Session: 2026-04-06 Closure Track — Metahub General Section + Catalog-Specific Layouts

-   [x] VAN assessment: complexity Level 3, multi-package schema/service/UI/test/docs scope.
-   [x] Deep codebase analysis: all layout, catalog, snapshot, runtime, settings, navigation seams mapped.
-   [x] CREATIVE subagent: Option C (Catalog-Owned Layouts, Fork on Create) selected; navigation collapse group approved.
    -   Reference: `memory-bank/creative/creative-general-section-layout-model.md`
-   [x] Detailed 9-phase plan written for discussion.
    -   Reference: `memory-bank/plan/general-section-catalog-layouts-plan-2026-04-06.md`
-   [x] QA review: 3 critical, 3 major, 4 moderate issues found. Plan requires significant revision.
    -   Reference: `memory-bank/plan/general-section-catalog-layouts-QA-2026-04-06.md`
    -   C1: General section = tabbed page, NOT collapse group (two menu systems found)
    -   C2: Catalog layouts = overlay/inheritance model, NOT fork-on-demand
    -   C3: Multiple catalog layouts support needed (plan limits to one)
    -   M1: Surface type E2E verification missing (spec point 7)
-   [x] User approved QA findings → plan revised to overlay/inheritance model.
    -   Reference: `memory-bank/plan/general-section-catalog-layouts-plan-2026-04-06.md` (v2)
    -   All 10 QA issues addressed in revised plan
    -   Architecture changed: tabbed GeneralPage, sparse overlay model with `base_layout_id` + `_mhb_catalog_widget_overrides`, multiple catalog layouts
    -   Runtime simplified in second QA pass: flatten merged catalog layouts into ordinary snapshot / `_app_layouts` / `_app_widgets` rows
    -   Surface settings moved to catalog-layout-level config; plan now explicitly reuses extracted layout list/detail primitives instead of new mini-list UI
    -   Final contract clarification added: catalog-layout behavior config reuses the existing catalog runtime setting shape/enums for `showCreateButton`, `searchMode`, and create/edit/copy surfaces, stored as a nested block inside the layout `config` JSONB instead of a new schema family
    -   Final fallback clarification added: runtime resolves catalog behavior as `selected catalog layout behaviorConfig ?? catalog runtimeConfig subset`, and the first catalog layout seeds its behavior config from the current catalog settings when present
-   [x] User review of revised plan → IMPLEMENT mode.

### Implementation Checklist

-   [x] Phase 1-3 foundation: extend shared types/utils, update metahub schema/system tables, and ship backend catalog-layout overlay CRUD plus snapshot support.
    -   Note: Keep SQL-first store/service patterns, preserve global layout behavior unchanged, and avoid introducing runtime overlay tables.
-   [x] Phase 4 runtime sync: materialize catalog layouts into `_app_layouts` / `_app_widgets` and resolve runtime layout + behavior fallback safely.
    -   Note: Runtime behavior resolution must stay `selected catalog layout behaviorConfig ?? catalog runtimeConfig subset`.
-   [x] Phase 5-6 frontend authoring: add General page/navigation, reuse existing layout list/details primitives, and implement catalog overlay editor UX.
    -   Note: General page/menu/routes/breadcrumb/i18n integration is complete, and the latest pass finished the catalog authoring slice by embedding catalog-scoped `LayoutList` into the catalog edit dialog Layout tab while preserving catalog runtimeConfig fields as the fallback before the first custom layout exists.
    -   Note: The catalog flow now has a dedicated layout-detail route/context (`/metahub/:metahubId/catalog/:catalogId/layout/:layoutId`), catalog-origin breadcrumbs, catalog-only `LayoutDetails` behavior editing for `showCreateButton`, `searchMode`, `createSurface`, `editSurface`, and `copySurface`, plus EN/RU copy for that authoring path.
-   [x] Phase 7-8 verification: finish the remaining browser/runtime closure for the catalog-layout authoring path.
    -   Note: The backend regression seam is repaired, runtime materialization coverage now proves sparse catalog overrides and inherited synthetic widgets, the legacy layouts browser flow follows the shipped General route contract, and the comprehensive Playwright/browser-runtime scenario passed after the final page-surface reopen fix in `ApplicationRuntime`.
    -   Note: Verified behavior includes `/general`, catalog layout authoring, custom-vs-fallback runtime behavior, supported right-zone widget materialization, and authored `createSurface` / `editSurface` / `copySurface` resolution through the real `/a/...` runtime flow.
-   [x] Phase 9-10 closure: finish the final docs, memory-bank, and repository-validation follow-up after the broader browser/runtime verification.
    -   Note: EN/RU `platform/metahubs.md` now document the shipped General-section and catalog-layout contract with exact line parity (`63/63`), the fresh `pnpm run build:e2e` completed green (`30 successful`, `27 cached`, `1m5.436s`), the comprehensive Playwright flow passed again (`2 passed`, `1.9m`), E2E cleanup/doctor ended empty, and the canonical root `pnpm build` finished green (`30 successful`, `24 cached`, `1m11.613s`).

### Final Closure Checklist

-   [x] Repair the failing backend layout-service regression seam and extend backend coverage for catalog-scoped layout behavior, snapshot, and runtime-selection invariants.
    -   Note: `MetahubLayoutsService.test.ts`, `SnapshotRestoreService.test.ts`, and `syncLayoutMaterialization.test.ts` now cover active-base lookup, referenced-global-layout deletion guards, sparse override restore/remap, and catalog runtime materialization invariants.
-   [x] Add and validate the comprehensive Playwright/browser-runtime scenario for General plus catalog-specific layouts.
    -   Note: `metahub-general-catalog-layouts.spec.ts` now proves `/general`, catalog layout authoring, custom-vs-fallback runtime behavior, and authored `createSurface` / `editSurface` / `copySurface` resolution; it passed after the page-surface reopen race was fixed in the runtime page.
-   [x] Refresh the legacy layouts browser flow to follow the shipped General route contract instead of only the redirecting legacy `/layouts` URLs.
    -   Note: The legacy browser regression now asserts the redirect into `/general`, the General heading/tabs contract, and catalog-aware detail navigation under the General surface.
-   [x] Update dedicated EN/RU feature docs and feature-closeout memory-bank records after verification passes.
    -   Note: The touched EN/RU `platform/metahubs.md` pages now describe the General tab, sparse catalog layout overlays, runtime behavior fallback, and runtime materialization flow with verified line parity; `tasks.md`, `activeContext.md`, and `progress.md` were synced in the same closeout pass.

## Completed Session: 2026-04-06 Final QA Debt Closure For Runtime Sync Coverage And Docs

-   [x] Harden the browser runtime worker contract so client script execution fails closed on hangs.
    -   Note: `browserScriptRuntime` now enforces a bounded Worker execution timeout with cleanup, and focused `@universo/apps-template-mui` runtime Vitest passed (`7/7`) including the new hanging-worker regression.
-   [x] Tighten `_app_scripts` scoped-index repair so legacy or malformed unique indexes are replaced only when the exact required scope definition is missing.
    -   Note: Sync persistence now validates the full scoped unique-index shape, and focused `syncScriptPersistence.test.ts` passed (`8/8`) with both malformed-legacy and already-correct index branches covered.
-   [x] Align scripting-related coverage gates with the shipped QA expectations.
    -   Note: The touched apps-template, applications-frontend, auth-frontend, and scripting-engine Vitest configs now enable coverage by default with one shared opt-out/threshold contract, and focused package suites completed green under the updated configs.
-   [x] Finish the remaining Russian GitBook localization polish in the touched scripting/tutorial pages.
    -   Note: The touched EN/RU scripting and quiz tutorial pages now reflect the Worker-timeout fail-closed contract, the remaining mixed-language RU phrases were removed, and EN/RU line parity stayed exact (`97/97`, `89/89`).
-   [x] Re-run focused validation, the canonical root build, and then sync memory-bank closure state.
    -   Note: Focused apps-template, applications-backend, applications-frontend, auth-frontend, scripting-engine, and metahubs-frontend suites all passed under the final configs, the touched bilingual docs kept exact line parity (`97/97`, `89/89`), and the canonical root `pnpm build` finished green with `30 successful`, `14 cached`, and `2m54.285s`.

## Active Session: 2026-04-06 Final QA Remediation For Publication Versions And Docs Polish

-   [x] Fix the publication versions page crash that blocks the browser-authoring quiz flow.
    -   Note: `PublicationVersionList` now guards the settings-dialog render behind loaded `publicationData`, so the versions route no longer crashes while the publication-details query is still pending.
-   [x] Add focused regression coverage for the publication versions/settings seam and the admin dialog settings frontend surface.
    -   Note: Added `PublicationVersionList.test.tsx` for the async publication-details seam and `AdminSettings.test.tsx` for the shipped admin General-tab save flow; both targeted Vitest runs finished green, with the metahubs run executed under `VITEST_COVERAGE=false` to avoid an unrelated coverage-writer temp-file failure.
-   [x] Clean the remaining mixed-language wording from the touched Russian GitBook pages.
    -   Note: Rewrote the remaining mixed EN/RU prose in the touched Russian quiz/metahub/application pages while preserving the existing structure, links, and screenshot asset references.
-   [x] Re-run focused validation, rerun the targeted Playwright quiz flows, and then sync memory-bank closure state.
    -   Note: Targeted admin/metahubs Vitest passed, the browser-authoring/runtime/generator Playwright reruns each completed with exit code `0`, `pnpm run test:e2e:cleanup && pnpm run test:e2e:doctor -- --assert-empty` finished clean, and the canonical root `pnpm build` ended green with `30 successful`, `21 cached`, and `2m50.684s`.

## Active Session: 2026-04-06 QA Remediation For Dialog Settings And GitBook Coverage

-   [x] Repair the red application-settings frontend regression coverage.
    -   Note: The focused `ApplicationSettings` suite now asserts the shipped General/Limits contract through stable selectors and current limits-copy, and the targeted Vitest run finished green (`3/3`).
-   [x] Repair the red application copy slug-regression tests.
    -   Note: The copy-route tests now assert the actual persisted insert order where `settings` is stored before `slug`, and the targeted Jest route suite finished green (`51/51`).
-   [x] Clean the remaining English fragments from the touched Russian GitBook pages.
    -   Note: The touched RU scripting/metahubs/applications/quiz tutorial pages were rewritten to remove the mixed-language prose while keeping the EN/RU page pairs structurally aligned around the shipped feature contract.
-   [x] Re-run focused validation for the remediated seams and then sync memory-bank closure state.
    -   Note: Focused frontend/backend regression suites passed, and the canonical root `pnpm build` finished green with `30 successful`, `30 cached`, and `287ms`.

## Active Session: 2026-04-06 Admin And Application Dialog Settings Plus GitBook Coverage

-   [x] Add admin-level dialog settings storage and UI.
    -   Note: The admin settings surface now has a persisted General tab for dialog size preset, fullscreen availability, resize availability, and close behavior, backed by the admin settings backend contract.
-   [x] Apply admin dialog settings across admin-facing dialog surfaces.
    -   Note: Admin dialog presentation now flows through the shared provider seam on `/admin`, and the direct admin dialogs were migrated onto the shared presentation contract.
-   [x] Add persisted application-level dialog settings and expose them in Application Settings.
    -   Note: Application settings now persist dialog presentation under `applications.cat_applications.settings`, and the General tab saves real backend state instead of placeholder copy.
-   [x] Apply application dialog settings to application control-panel dialogs.
    -   Note: The application control-panel route now has its own dialog settings provider, and connector delete behavior follows the saved application-level presentation contract.
-   [x] Expand GitBook docs for scripts, settings, and the new quiz-application tutorial.
    -   Note: Rewrote the EN/RU scripting, metahubs, and applications pages; added new EN/RU admin and quiz-tutorial pages; updated both `SUMMARY.md` files; and kept the touched EN/RU page pairs in structural parity.
-   [x] Generate Playwright screenshots for the quiz-application tutorial.
    -   Note: Added the reproducible generator `tools/testing/e2e/specs/generators/docs-quiz-tutorial-screenshots.spec.ts`, which now writes `metahub-scripts.png`, `layout-quiz-widget.png`, `application-settings-general.png`, and `runtime-quiz.png` into `docs/assets/quiz-tutorial/`.
-   [x] Validate the touched seams and sync memory-bank closure state.
    -   Note: Docs diagnostics stayed clean, the focused package builds and `pnpm run build:e2e` passed during generator stabilization, the final tutorial screenshot generator passed with `2 passed`, and the canonical root `pnpm build` finished green with `30 successful`, `17 cached`, and `3m15.638s`.

## Active Session: 2026-04-06 Dialog Header Polish And Quiz Script Discoverability

-   [x] Tighten the shared dialog header action spacing and localize the header icon tooltips.
    -   Note: The shared dialog presentation seam now removes the extra title-wrapper right padding, keeps the header action group tighter to the right edge, and receives localized tooltip/aria labels through the metahub dialog settings bridge.
-   [x] Rename the metahub common setting copy for dialog close behavior to the requested popup-type wording.
    -   Note: The settings UI now shows `Popup window type` / `Тип всплывающих окон` with `Modal windows` / `Модальные окна` and `Non-modal windows` / `Немодальные окна`, while the stored values remain `strict-modal` and `backdrop-close`.
-   [x] Verify and document where the quiz script is edited in the current UI contract.
    -   Note: The committed quiz fixture stores `quiz-widget` as a metahub-level script (`attachedToKind = metahub`, `attachedToId = null`), and the metahub edit dialog now opens the Scripts tab in that same scope so imported quiz scripts appear in the UI again.
-   [x] Revalidate the touched seams and sync memory-bank closure state.
    -   Note: Focused `@universo/template-mui` Jest passed (`6/6`), focused `@universo/metahubs-frontend` Vitest passed (`6/6`), and the final root `pnpm build` verification finished green (`30 successful`, `30 cached`, `286ms`).

## Active Session: 2026-04-05 Dialog UX And Centered Quiz Layout Refresh

-   [x] Update the shared dialog presentation seam for the requested modal UX corrections.
    -   Note: The shared dialog presentation seam now keeps the requested fullscreen control alignment, strict-modal attention feedback, and reliable resize cursor/user-select cleanup.
-   [x] Add regression coverage for the touched dialog behavior.
    -   Note: Focused shared dialog coverage now locks fullscreen/reset controls, strict-modal outside-click attention feedback, and resize lifecycle cleanup.
-   [x] Redesign the quiz metahub layout contract around a centered quiz-only runtime.
    -   Note: The canonical quiz contract now removes the legacy left menu, center details table/title, and right-side widget placement so `quizWidget` renders as a standalone center-zone widget.
-   [x] Update the quiz generator/browser-authoring/runtime source flows and regenerate the committed fixture through the real Playwright export path.
    -   Note: `tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts` and `tools/testing/e2e/support/quizFixtureContract.ts` remain the source of truth, and the committed quiz fixture was regenerated from that real generator path.
-   [x] Revalidate the touched seams and finish with the canonical root build, then sync memory-bank closure state.
    -   Note: Focused dialog and apps-template tests passed, `pnpm run build:e2e` passed, the quiz generator passed (`2 passed`), the targeted quiz Playwright rerun passed (`4 passed`, including setup + the 3 targeted flows), and the final root `pnpm build` finished green (`30 successful`, `30 cached`, `599ms`).

## Active Session: 2026-04-05 Frontend Test Warning Remediation

-   [x] Replace the brittle MUI Select opening pattern in scripting-related frontend tests so the suites stop emitting invalid `anchorEl` warnings.
    -   Note: The fix stayed test-only. The affected jsdom suites now provide a stable non-zero element geometry mock instead of touching production dialog or select code.
-   [x] Re-run the focused frontend validation for the touched scripting/dialog suites and confirm the warning is gone without regressing behavior.
    -   Note: Focused `@universo/metahubs-frontend` scripting/layout dialog tests passed (`9/9`), the warning string `anchorEl` no longer appeared in the captured test log, and package lint no longer had error-level failures on the touched scope.
-   [x] Sync memory-bank closure state for this remediation after validation passes.
    -   Note: The final root `pnpm build` finished green (`30 successful`, `27 cached`, `56.386s`), so this residual QA debt is now fully closed.

## Active Session: 2026-04-05 Metahub Dialog Settings And Scripts Tab Responsiveness

-   [x] Fix the noisy Turbo warning for `@universo/extension-sdk` build outputs without changing the package's source-first build contract.
    -   Note: The package currently runs `tsc --noEmit`, so the root `turbo.json` output expectation must be overridden at the package level instead of forcing a fake `dist/` artifact.
-   [x] Add shared metahub settings for global dialog behavior.
    -   Note: Ship a global settings contract for dialog size preset (`small` / `medium` / `large`), fullscreen toggle availability, resize availability, and close behavior (`strict modal` vs `outside click closes`). The settings page should expose these through the existing registry-driven UI and use sensible defaults.
-   [x] Apply the dialog settings to the shared metahub authoring form surface.
    -   Note: The current `EntityFormDialog` behavior becomes the explicit `small` preset. Add the `medium` default and `large` preset, fullscreen expand/collapse, resize persistence in browser localStorage, and fail-closed backdrop handling when strict modal mode is enabled.
-   [x] Rework the Scripts tab so narrow dialogs and mobile layouts never gain a page-level horizontal scrollbar.
    -   Note: Keep horizontal scrolling isolated to the code editor only. If necessary, collapse or overlay the left attached-scripts list on narrow widths instead of shrinking the whole tab into double-scroll behavior.
-   [x] Add regression coverage that detects dialog overflow and settings behavior before merge.
    -   Note: The previous tests validated CRUD behavior only; they did not assert geometry in a real browser. Add focused unit coverage for dialog/settings logic and browser-level Playwright assertions for narrow dialog layouts and the new settings flow.
-   [x] Revalidate the touched packages and finish with the canonical root build, then sync memory-bank closure state.
    -   Note: Validation should include focused frontend/backend tests for the touched seams, the targeted Playwright flows, and final root `pnpm build`.

## Active Session: 2026-04-05 Quiz Snapshot Fixture Export And Verification

-   [x] Repair snapshot import so exported metahub scripts are restored into live metahub state before publication reserialization.
    -   Note: `SnapshotRestoreService` now restores `_mhb_scripts` with attachment remapping and script cleanup, metahub export augments snapshot scripts with `sourceCode`, and focused backend Jest coverage for restore + export stayed green.
-   [x] Create a persistent exported metahub snapshot fixture for the fully functional quiz scenario.
    -   Note: Added `tools/testing/e2e/support/quizFixtureContract.ts`, the generator `tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts`, and the committed artifact `tools/fixtures/metahubs-quiz-app-snapshot.json` generated through the real export pipeline.
-   [x] Add durable validation that the quiz fixture imports, publishes, and produces a working application runtime.
    -   Note: `tools/testing/e2e/specs/flows/snapshot-import-quiz-runtime.spec.ts` now proves browser-UI import, restored design-time metahub scripts, application creation from the imported publication, and the full EN/RU quiz runtime contract: 10 questions, 4 answers each, +1 only for correct answers, final score summary, and restart/back navigation.
-   [x] Revalidate the fixture pipeline end to end and sync memory-bank closure state.
    -   Note: Focused metahubs-backend Jest stayed green, the quiz generator passed (`2 passed`) and wrote the committed fixture, the import/runtime Playwright flow passed (`2 passed`), and the final root `pnpm build` finished green.

## Active Session: 2026-04-05 Scripting QA Gap Closure And Final Plan Completion

-   [x] Close the remaining proof and plan-alignment debt for scripting hardening.
    -   Note: Added reproducible `@universo/scripting-engine` benchmark proof (`coldStartMs 7.13`, `meanMs 1.596`, `p95Ms 2.127`), explicit isolated-vm startup compatibility validation, and legacy `snapshot.scripts` regression coverage.
-   [x] Extend the product E2E coverage from runtime-only proof to the missing authoring/publication/application acceptance seam.
    -   Note: Added browser authoring for `quizWidget` `scriptCodename`, shipped the real browser-authored flow from metahub authoring through runtime smoke verification, fixed the shared auth `419` retry defect, and removed the temporary manual-capability workaround by restoring widget default capabilities for untouched draft role switches.
-   [x] Revalidate the touched scripting wave end to end and then sync memory-bank closure state.
    -   Note: Focused `@universo/auth-frontend` Vitest, focused `EntityScriptsTab` regression coverage, the browser-authored Playwright flow (`2 passed`), and the final root `pnpm build` (`30 successful`, `27 cached`, `3m54.625s`) all finished green.

## Active Session: 2026-04-05 Scripting Full Plan Completion Follow-up

-   [x] Expand `@universo/extension-sdk` to the full planned modular SDK surface without regressing the current root import contract.
    -   Note: Close the verified plan gap by adding the missing modular source files (`types`, `decorators`, `ExtensionScript`, `registry`, `widget`, `apis/*`), exposing `AtServerAndClient`, and keeping the existing root `@universo/extension-sdk` authoring import stable for current scripts/tests.
-   [x] Add the remaining missing scripting regression coverage for authoring/service/frontend CRUD seams.
    -   Note: Cover the still-missing update/delete/scope-conflict service branches and the scripts-tab update/delete UI flow so the current QA debt is removed where it was actually observed.
-   [x] Align the scripting plan and SDK documentation with the fully shipped contract.
    -   Note: Update the plan status/checklists plus EN/RU package READMEs together, keeping multilingual docs line-parity intact and reflecting the completed SDK surface instead of the earlier reduced subset.
-   [x] Revalidate the touched scripting wave end-to-end and then sync memory-bank closure status.
    -   Note: Finish with focused package tests/builds plus the canonical root `pnpm build`, then update `activeContext.md` and `progress.md` with the final closure result.
    -   Note: README line parity matched (`30/30`), focused scripting tests passed across `@universo/scripting-engine`, `@universo/applications-backend`, `@universo/metahubs-backend`, and `@universo/metahubs-frontend`, and the final root `pnpm build` finished green with `30/30` successful tasks.

## Active Session: 2026-04-05 Scripting QA Remediation And Plan Completion

-   [x] Tighten the runtime script RPC boundary so direct HTTP calls stay inside the documented fail-closed contract.
    -   Note: `RuntimeScriptsService.callServerMethod(...)` and the runtime controller now fail closed at the real backend seam: direct `/applications/:applicationId/runtime/scripts/:scriptId/call` access rejects scripts without `rpc.client`, rejects lifecycle handlers on the public RPC surface, and preserves the existing member-access behavior for valid runtime calls.
-   [x] Harden runtime script sync and compatibility enforcement.
    -   Note: `_app_scripts` sync now aborts on bootstrap/table-availability defects instead of silently skipping published scripts, and shared `sdkApiVersion` helpers now enforce the supported `1.0.0` contract across compiler, authoring, sync normalization, and runtime loading.
-   [x] Add the missing hardening regression coverage.
    -   Note: Direct `/call` abuse, runtime service capability boundaries, sync bootstrap failure behavior, compiler SDK mismatch handling, and metahub authoring SDK mismatch handling now have focused regressions that fail loudly.
-   [x] Close the remaining plan-completion documentation and status gaps.
    -   Note: The touched EN/RU scripting docs, package READMEs, and memory-bank status files now reflect the fail-closed public RPC boundary, the `_app_scripts` sync contract, and the enforced SDK compatibility rules.
-   [x] Revalidate the entire scripting wave and finish with canonical repository validation.
    -   Note: Changed-file lint, focused package tests, the targeted Playwright runtime scripting quiz flow (`2 passed`), touched package builds, and the final root `pnpm build` all finished green; memory-bank active/progress/systemPatterns/techContext/currentResearch now match the shipped contract.

## Active Session: 2026-04-05 Quiz Runtime Bilingual Acceptance Flow

-   [x] Close the remaining acceptance-test gap for the published Space Quiz runtime flow.
    -   Note: The target is a Playwright CLI flow that proves real metahub authoring, script attachment, publication, application runtime rendering, English/Russian copy integrity, score semantics for correct vs incorrect answers, and final navigation affordances without broad template churn.
    -   Note: The targeted wrapper-based Playwright flow now proves the real `/a/...` application surface in English and Russian, including score changes, final summary, restart/back navigation, and no raw quiz i18n key leakage.
-   [x] Add only the minimum product-surface change required for the requested acceptance coverage.
    -   Note: If the runtime widget still lacks backward navigation across quiz questions, implement it in the shared `QuizWidget` seam instead of forking the template or adding test-only behavior.
    -   Note: `QuizWidget` now exposes `Previous question` during the flow and `Back to questions` from the completion screen via the shared widget/i18n seam only.
-   [x] Revalidate the touched quiz/runtime surfaces with focused tests plus the relevant Playwright/browser validation.
    -   Note: Finish with the canonical root validation only if touched-package validation stays green and the acceptance flow passes on the real `/a/...` runtime surface.
    -   Note: Focused widget/runtime tests passed, the targeted Playwright quiz flow passed with `2 passed`, and the canonical root `pnpm build` completed successfully.

## Active Session: 2026-04-05 Metahub Scripting Completion Remediation

-   [x] Close the compiler/client-bundle secrecy gap for mixed client/server scripts.
    -   Note: `@universo/scripting-engine` now rejects cross-target shared top-level runtime bindings, and focused compiler/runtime regressions lock the new boundary.
-   [x] Replace the technical two-question widget starter with the promised Space Quiz starter contract.
    -   Note: The starter source now ships a bilingual 10-question Space Quiz with 4 answers each, difficulty/explanation metadata, locale-aware loading, and server-only scoring data without a template-version bump.
-   [x] Finish the planned QuizWidget UX instead of the current bulk-submit demo flow.
    -   Note: `QuizWidget` now runs as a sequential single-question flow with progress/score state, explanation feedback, locale-aware payloads, auto-advance after correct answers, and a dedicated `quiz` i18n namespace.
-   [x] Update regression coverage and browser proof for the final scripting/quiz contract.
    -   Note: Focused compiler, widget, browser-runtime, authoring, and targeted Playwright coverage now fail loudly on the secrecy boundary and the final `/a/...` Space Quiz behavior.
-   [x] Revalidate touched packages and finish with the canonical root build, then sync memory-bank progress.
    -   Note: Changed-file lint finished without errors, focused package suites passed, `pnpm run build:e2e` passed, the targeted Playwright runtime scripting quiz flow passed, and the final root `pnpm build` finished green (`30/30`).

## Active Session: 2026-04-05 Metahub Scripting Verification Closure Reopen

-   [x] Add direct sync persistence coverage for `_app_scripts` publication/runtime synchronization.
    -   Note: `syncScriptPersistence.test.ts` now proves `persistPublishedScripts()` and `hasPublishedScriptsChanges()` directly, including scoped index repair, update vs insert behavior, and prune-on-shrink handling.
-   [x] Add explicit runtime scripts route proof for the list surface.
    -   Note: `applicationsRoutes.test.ts` now covers `GET /applications/:applicationId/runtime/scripts`, including attachment filtering and bundle stripping.
-   [x] Prove runtime copy lifecycle parity at the HTTP CRUD seam.
    -   Note: The route regression now proves `beforeCopy` stays transactional and `afterCopy` dispatches only after commit with the copied row payload.
-   [x] Add a browser-level scripting publication-to-runtime proof for `quizWidget`.
    -   Note: The Playwright flow now proves the full real browser chain: runtime script list + client bundle fetch, Worker execution, CSRF-aware `submit()` POST, server runtime execution, and the final `Score: 2 / 2` UI result on `/a/...`.
-   [x] Revalidate the touched scripting packages and then rerun the canonical root build.
    -   Note: Focused apps-template and scripting-engine tests/builds passed, the E2E-environment build passed, the targeted Playwright flow passed, and the canonical root `pnpm build` finished green with `30/30` successful tasks.

## 2026-04-05 Scripting Closure History (Condensed)

-   [x] Security/runtime hardening closure completed.
    -   Note: SDK-only compiler imports, restricted browser Worker execution, strict-mode-safe isolate bootstrap, and direct route/runtime security proof are already implemented. Details live in `progress.md` under the 2026-04-05 scripting entries.
-   [x] Final lifecycle parity and authoring closure completed.
    -   Note: Runtime CRUD plus Record API parity, hard-delete `afterDelete`, CodeMirror authoring refinements, and QuizWidget runtime/unit coverage are already in place.
-   [x] Capability model, client-bundle contract, and documentation closure completed.
    -   Note: Shared capability normalization, cacheable client-bundle delivery, isolate-pool/circuit-breaker runtime behavior, package READMEs, and EN/RU docs are already shipped.
-   [x] Earlier QA remediation and plan-phase implementation completed.
    -   Note: Unsafe execution seams were replaced, the public runtime `RecordAPI` was finished, design-time authorization and scoped codename identity were tightened, and the original plan phases were implemented end-to-end before this verification-only reopen.

## Planned: Metahub Scripting/Extension System (GDExtension-analog)

-   [x] QA remediation pass superseded the earlier closure notes and is now finished with validated runtime/security/contract fixes.

    -   Note: The original 2026-04-05 completion entry remains below as historical implementation context; the validated remediation closure above is now the current source of truth for feature completeness.

-   [x] QA analysis of plan
    -   Note: Initial pass identified editor, decorator, CRUD hook, UI-pattern, and data-model issues; final pass added completeness refinements for generic attachment targets, public scripting API shape, and future source kinds.
-   [x] Plan corrections applied
    -   Note: Monaco→CodeMirror 6, decorators→no-op, CRUD hooks Step 3.6, SDK constraints, Scripts tab, defer ScriptedWidgetHost, codename types documented, generic `attached_to_kind`/`attached_to_id`, `module_role`, `source_kind`, public `RecordAPI`/`MetadataAPI` contract, manifest-declared capabilities, and ScriptHealthMonitor circuit breaker.
    -   Note: Status updated on 2026-04-05. User approval was already given; implementation is now active.

### Implementation Execution Order (2026-04-05)

-   [x] Sync memory-bank state and replace the old "awaiting approval" status with the active implementation ledger.
    -   Note: `activeContext.md` was also normalized so implementation state, constraints, and next steps stay current.
-   [x] Phase 1: SDK + Engine Foundation (`@universo/extension-sdk`, `@universo/scripting-engine`, shared script types, compiler/runtime contracts, schema-ddl/runtime table support, i18n seeds)
    -   Note: Complete. Shared script types, compiler/runtime contracts, the safe non-`isolated-vm` host abstraction, and supporting runtime table contracts are implemented and package-validated.
-   [x] Phase 2: Metahub Integration (design-time scripts metadata, metahub CRUD/API surfaces, `_mhb_scripts`, structure versioning, snapshot serialization, script editor UI with CodeMirror 6, Scripts tab in existing dialogs)
    -   Note: Complete. Backend design-time integration plus the reusable CodeMirror-based Scripts tab are implemented for metahub, catalog, hub, set, enumeration, and attribute edit dialogs. The optional dedicated full-page editor route was not required for the approved runtime/widget scope and remains deferred.
-   [x] Phase 3: Runtime Integration (`_app_scripts`, publication/runtime sync, script execution/RPC routes, client bundle delivery, runtime lifecycle interception around row create/update/delete/copy)
    -   Note: Complete. `_app_scripts`, publication/runtime sync persistence, runtime execution/RPC routes, and fail-closed lifecycle interception are implemented and package-validated.
-   [x] Phase 4: Quiz Widget (`quizWidget` type registration, widget renderer integration, runtime component, client/server script bridge, sample quiz template content)
    -   Note: Complete. `quizWidget` is registered in shared widget contracts, rendered through the existing apps-template widget renderer, backed by the runtime script bridge, and supported by widget-specific starter source plus EN/RU UI text.
-   [x] Phase 5: Hardening & Documentation (focused tests, package validation, root build, memory-bank progress update, EN/RU docs where touched)
    -   Note: Complete. Focused validation passed across the touched package wave, the `runtimeRowsController` parse regression and follow-up strict typing issues were fixed, and the canonical root `pnpm build` finished green (`30/30`, `28 cached`).
    -   Note: Full plan with code examples at `memory-bank/plan/metahub-scripting-extension-system-plan-2026-04-05.md`
    -   Note: Creative design archive at `memory-bank/creative/creative-metahub-scripting-extension-system.md`

### Remaining Execution Slice (Current Session)

-   [x] Build and wire the reusable Scripts tab/editor into existing metahub entity dialogs.
    -   Note: The current implementation reuses `EntityFormDialog`/`TabConfig`, ships a shared scripts API client, and surfaces CodeMirror authoring for metahub, catalog, hub, set, enumeration, and attribute edit dialogs.
-   [x] Register and render `quizWidget` through the existing dashboard/widget contracts.
    -   Note: Complete. The widget is registered in shared metahub types, rendered in apps-template-mui, and receives runtime application/catalog context from `ApplicationRuntime.tsx`.
-   [x] Connect the runtime widget/client bridge to the new applications-backend scripts routes.
    -   Note: Complete. The browser runtime helper executes widget client bundles, proxies server methods through runtime script call routes, and is covered by a focused unit test.
-   [x] Run focused package validation plus canonical root `pnpm build`, then sync progress.md / activeContext.md.
    -   Note: Complete. Final closure also required fixing the backend parser regression in `runtimeRowsController.ts`, strict VLC typing in script persistence/services, and strict QuizWidget normalization typing before the final green root build.

## Active Session: 2026-04-04 Self-Hosted Fixture And Header Geometry Revalidation

-   [x] Repair the self-hosted fixture contract so imported catalog labels match the expected Sets / Enumerations naming on a fresh browser import.
    -   Note: Fix the canonical Playwright generator source of truth first, then regenerate `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the real generator instead of hand-editing the exported artifact.
-   [x] Remove the shared header gutter drift that became visible after the layout-details back button was removed and normalize runtime toolbar edge spacing.
    -   Note: Keep the fix in the shared `ViewHeader` / runtime action contract so both the layout details page and published `/a/...` header recover their standard left/right alignment.
-   [x] Normalize runtime header control heights so search and view-toggle controls match the Create action.
    -   Note: The current regression is caused by shared 40px controls next to a small Create button rendered outside `ToolbarControls`.
-   [x] Add geometry-focused regression coverage for the affected layout-details and published-runtime flows.
    -   Note: Existing tests already prove functionality, but they do not assert title/control edge alignment or height parity, which is why this regression passed previously.
-   [x] Regenerate the committed self-hosted fixture and revalidate the touched flows plus the canonical root build.
    -   Note: Validation must cover the real generator path, the affected Playwright flows, and the final root `pnpm build`.
    -   Current status: complete; the fixture contract now exports the canonical Enumerations and Sets labels through the generator path, `ViewHeader` no longer applies negative gutter offsets, the runtime Create button and shared controls now share the same 40px height contract, geometry assertions were added to the affected Playwright flows, the real generator reran and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`, the targeted browser flows passed, and the canonical root `pnpm build` finished green.

## Active Session: 2026-04-04 QA Remediation Closure

-   [x] Re-run focused lint/test validation on the touched self-hosted parity packages and isolate only the currently reproducible issues.
    -   Note: Use the latest branch state rather than the earlier QA snapshot so fixes target real remaining debt only.
-   [x] Fix every confirmed residual issue without widening scope beyond the self-hosted parity wave.
    -   Note: Prioritize lint/formatting debt in touched files and any test gaps or regressions that still reproduce.
-   [x] Revalidate the touched packages and finish with the canonical root `pnpm build`.
-   [x] Update memory-bank active/progress state to reflect the final remediation result.

    -   Note: Focused lint now ends with 0 errors for `@universo/utils`, `@universo/template-mui`, `@universo/metahubs-frontend`, `@universo/metahubs-backend`, and `@universo/apps-template-mui`; the only non-format residual defect was a duplicate `EnumerationValueOption` type declaration in `ElementList.tsx`; canonical root `pnpm build` finished green with `28/28` successful tasks.

-   [x] Close the post-import self-hosted schema-diff, runtime inheritance, UI polish, and fixture-fidelity regression wave from 2026-04-04

    -   Note: This pass is limited to the newly verified defects after the user imported the committed self-hosted fixture, linked an application, created schema, changed only catalog/layout runtime settings, published a new version, and observed connector/runtime regressions in real browser verification.
    -   Implementation order for the current session:
        -   [x] Fix the imported-snapshot ID drift so later live publications keep stable executable entity/field identity and layout-only publications do not produce full destructive application diffs.
        -   [x] Redesign catalog runtime settings so local overrides are opt-in and global layout settings remain inherited by default.
        -   [x] Remove the layout-settings back button, rename the unclear surface labels, and normalize the published runtime spacing/control-height polish.
        -   [x] Repair the self-hosted generator/fixture contract so default Main entities and section/category naming match the live clean-metahub behavior.
        -   [x] Regenerate the committed self-hosted fixture through the real generator and revalidate the touched flows.
    -   Required outcomes:
        -   [x] Imported metahubs/publications must not persist a raw imported snapshot as the active publication baseline when the live branch has already remapped object IDs during restore.
        -   [x] A layout-only or catalog-runtime-only publication change must not surface as full-table destructive schema recreation in the linked application connector.
        -   [x] Catalog-local runtime settings must inherit global layout settings until the user explicitly enables local overrides.
        -   [x] Layout/runtime authoring UI must remove the clipped back button, use clearer create/edit/copy wording, and keep the published runtime controls visually aligned.
        -   [x] The committed self-hosted fixture must export the corrected localized Main codename/section contract and stay aligned with the real import/generator path.
    -   Validation target: focused backend/frontend/unit tests, targeted self-hosted generator/import validation, and the canonical root `pnpm build`.
    -   Current status: complete; imported publication baselines now serialize from the restored live branch instead of the raw imported payload, catalog runtime config now keeps inheritance sparse unless `useLayoutOverrides` is explicitly enabled, the layout/runtime polish fixes are shipped, the self-hosted contract now canonicalizes localized Main codenames and section naming, the missing browser-safe `@universo/utils` export for `sanitizeCatalogRuntimeViewConfig` was fixed at the shared package boundary, the real Playwright generator reran and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`, the targeted browser import flow passed on the regenerated fixture, `pnpm run build:e2e` finished green (`28/28`), and the final root `pnpm build` also finished green (`28/28`).

-   [x] Close the fresh-import self-hosted codename and section-name regressions from the 2026-04-04 user verification pass

    -   Note: This pass is limited to the newly verified defects after another full rebuild, empty database reset, and fresh import of `tools/fixtures/metahubs-self-hosted-app-snapshot.json`: the imported metahub codename still gains noisy suffixes and loses the Russian locale variant, one repeated section still appears as a standalone `Enumeration Values` catalog, the auto-created default `Main` entities still persist type-suffixed English codenames (`MainHub`, `MainCatalog`, `MainSet`, `MainEnumeration`), and the committed self-hosted fixture must be regenerated from the corrected generator contract.
    -   Implementation order for the current session:
        -   [x] Replace noisy imported metahub codename generation with canonical localized EN/RU codename derivation from the imported metahub name while keeping collision handling deterministic.
        -   [x] Fix template-seeded default `Main` entity codename generation so the primary English codename is derived from the localized entity name instead of the raw template key suffix.
        -   [x] Remove the extra standalone `Enumeration Values` self-hosted top-level catalog contract and fail closed if the committed fixture drifts back.
        -   [x] Regenerate `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the corrected Playwright generator and revalidate the touched flows.
    -   Required outcomes:
        -   [x] Imported self-hosted metahubs must use stable canonical metahub codenames derived from the localized metahub name, with both English and Russian codename locales and no timestamp/random noise on the normal path.
        -   [x] Auto-created default `Main` entities must no longer store `MainHub` / `MainCatalog` / `MainSet` / `MainEnumeration` as the primary English codename when the localized entity name is already `Main`.
        -   [x] The self-hosted fixture/generator contract must no longer create or tolerate a standalone `Enumeration Values` section.
        -   [x] The committed self-hosted fixture must be regenerated from the corrected generator contract and stay aligned with the import/browser validation path.
    -   Validation target: focused backend template/import tests, targeted self-hosted generator/import validation, regenerated fixture sanity checks, and the canonical root `pnpm build`.
    -   Current status: complete; imported metahub codenames are now derived from the localized imported metahub name with deterministic localized imported suffixes only on real collisions, template seed execution and migration now normalize the primary English codename from localized `Main` names instead of raw `MainHub`/`MainCatalog` keys, the self-hosted contract rejects the deprecated standalone `Enumeration Values` catalog plus legacy type-suffixed `Main*` codenames, the real Playwright generator reran and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json` with 11 canonical sections, the regenerated fixture no longer contains the legacy markers, the targeted browser import flow passed, and the final root `pnpm build` finished green.

-   [x] Close the fresh-import self-hosted publication/settings fixture regressions from the 2026-04-04 user verification pass

    -   Note: This pass is limited to the newly verified defects after a clean rebuild, empty database, and fresh import from `tools/fixtures/metahubs-self-hosted-app-snapshot.json`: publication settings open with an empty name, publication breadcrumbs can degrade to `[object Object]`, application settings render an extra application-name subtitle, the exported self-hosted metahub codename still carries run/import noise and lacks a Russian locale variant, and the exported default layout still contains duplicate left-side menu widgets.
    -   Implementation order for the current session:
        -   [x] Separate publication breadcrumb cache from publication detail cache and restore stable settings hydration.
        -   [x] Remove the extra application-settings subtitle from the frontend settings page.
        -   [x] Canonicalize the self-hosted metahub codename with stable EN/RU localized values.
        -   [x] Make the self-hosted generator/update flow keep exactly one canonical left menu widget.
        -   [x] Regenerate `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the corrected Playwright generator and revalidate the touched flows.
    -   Required outcomes:
        -   [x] Publication settings must show the existing localized publication name after a fresh self-hosted fixture import.
        -   [x] Publication breadcrumbs must never render `[object Object]` after repeated navigation into publication inner routes.
        -   [x] Application settings must render only the main page title without an extra duplicated application-name subtitle.
        -   [x] The committed self-hosted fixture must export a stable canonical metahub codename with a Russian localized codename variant.
        -   [x] The committed self-hosted fixture must contain exactly one canonical `Catalogs` menu widget in the default layout, without the duplicate `Main` menu.
        -   [x] Revalidate with focused tests/checks, regenerate the committed fixture through the Playwright generator, and finish with the required targeted validations.
    -   Validation target: focused frontend tests for publication/application surfaces, targeted generator/fixture assertions, regenerated fixture sanity checks, and any required package/build validation for touched files.
    -   Current status: complete; publication breadcrumb/detail queries now use separate cache keys so settings hydration no longer leaks object/string payloads, the application settings subtitle is gone, the self-hosted live generator now creates a valid CodenameVLC while the committed fixture canonicalizes EN/RU codename locales, the regenerated fixture contains exactly one canonical `menuWidget`, targeted frontend tests passed, `pnpm run build:e2e` stayed green, the Playwright generator rerun passed and rewrote `tools/fixtures/metahubs-self-hosted-app-snapshot.json`, the targeted browser import flow passed on the regenerated fixture, and the final root `pnpm build` finished green.

-   [x] Close the post-QA self-hosted regressions and publication UX defects from the 2026-04-04 audit

    -   Note: This pass is limited to the concrete defects still confirmed after the last QA verdict and the user follow-up: the committed self-hosted fixture hash is invalid, catalog runtime defaults do not inherit layout settings correctly, publication settings/edit dialogs regress on localized values, publication version creation shows branch labels as `[object Object]`, and auto-created Main entities still miss Russian codename locales.
    -   Note: An additional validation blocker surfaced during the required Playwright import rerun: Node-side ESM consumers could not resolve `dayjs` plugin/locale imports from `@universo/utils` dist. This was fixed in the shared `formatDate` utility with explicit `.js` Day.js ESM specifiers before the browser flow was revalidated.
    -   Implementation order for the current session:
        -   [x] Repair the fixture hash contract and regenerate the committed snapshot.
        -   [x] Restore catalog runtime inheritance semantics without regressing explicit overrides.
        -   [x] Fix publication settings/edit hydration and normalize publication branch labels.
        -   [x] Seed localized default codenames for auto-created Main entities.
        -   [x] Revalidate with focused tests, browser import flow, and root build.
    -   Required outcomes:
        -   [x] Repair the self-hosted fixture/generator hash contract so the committed `metahubs-self-hosted-app-snapshot.json` imports successfully through the real browser flow.
        -   [x] Fix catalog runtime config resolution so layout-level defaults remain inherited unless a catalog explicitly overrides them.
        -   [x] Fix the publication settings/edit surface so existing localized names/descriptions load correctly instead of opening empty.
        -   [x] Fix publication version creation so the selected branch label renders localized text instead of `[object Object]`.
        -   [x] Ensure automatically created default `Main` entities seed Russian codename locales alongside English ones where the product already seeds EN/RU names.
        -   [x] Revalidate with focused tests, the relevant snapshot-import Playwright flow, and a canonical root `pnpm build`.
    -   Validation target: focused frontend/backend/unit tests, targeted self-hosted snapshot import E2E, and canonical root `pnpm build`.
    -   Current status: complete; the self-hosted canonicalizer now recomputes `snapshotHash` after canonical mutations and the committed fixture was rehashed to a validator-clean `0904ee61b0db8b1c541c9a8b2008d7af35a9c5768f497cf89586af83346b1d7c`, catalog runtime layout inheritance now preserves layout defaults unless catalog overrides are explicit, `EntityFormDialog` now hydrates async extra values until the user edits them, publication branch labels normalize VLC codenames to strings, template-seeded default Main entities now derive Russian codename locales from localized names, the Day.js ESM import blocker in `@universo/utils` was fixed, targeted package tests passed, the real browser import flow passed, and the final root `pnpm build` completed successfully.

-   [x] Close the last self-hosted documentation drift from the 2026-04-04 QA audit

    -   Note: The runtime/code path is already validated green; this pass is limited to the remaining stale README references that still mention the old self-model screenshots directory instead of the canonical self-hosted screenshots contract.
    -   Required outcomes:
        -   [x] Update both EN/RU E2E READMEs to point to the canonical self-hosted screenshots directory naming.
        -   [x] Recheck the active tooling/docs surface for remaining stale screenshot-path references after the edit.
        -   [x] Update memory-bank active/progress state so the final parity closure no longer carries even low-severity documentation debt.
    -   Validation target: targeted workspace grep checks for the stale screenshot-path string after the doc edit.
    -   Current status: complete; both E2E READMEs now point to the canonical self-hosted screenshots directory naming, the stale `test-results/self-model` path is gone from the active tooling/docs surface, and the memory-bank status now reflects a fully closed parity wave with no remaining low-severity documentation drift.

-   [x] Close the final QA-confirmed parity gaps from the 2026-04-04 self-hosted audit

    -   Note: This pass is limited to the concrete defects confirmed after the previous completion claim. Keep the validated runtime work intact while closing the remaining security, fixture-quality, naming-cleanup, migration-evidence, and route-test gaps.
    -   Required outcomes:
        -   [x] Tighten metahub snapshot export authorization so the frontend and backend require an explicit management-level permission instead of bare membership access, and add direct forbidden-path regression coverage.
        -   [x] Replace the remaining technical/mixed-language self-hosted fixture copy with clean product-grade EN/RU names and descriptions, then regenerate the committed fixture artifact from the corrected generator contract.
        -   [x] Remove the last legacy `self-model` fixture codename/reference that still survives in self-hosted consumer E2E coverage.
        -   [x] Add backend route-level regression coverage for catalog `runtimeConfig` create/update/copy persistence so the shared contract is proved through HTTP behavior rather than only implementation reads.
        -   [x] Close the migration-parity evidence gap by validating and documenting the shipped self-hosted migrations surface in a way that matches the real implementation instead of leaving the plan overstated.
        -   [x] Revalidate with focused tests for touched backend/frontend/generator surfaces and finish with a canonical root `pnpm build`.
    -   Validation target: focused Jest/Vitest suites, targeted self-hosted generator validation, regenerated fixture sanity checks, and the canonical root `pnpm build`.
    -   Current status: complete; metahub export now requires `manageMetahub` end-to-end with direct `403` backend coverage, the self-hosted contract/fixture copy was rewritten and the committed snapshot was regenerated from the corrected canonicalizer, the last consumer-side `self-model` codename was removed, catalog `runtimeConfig` HTTP coverage now spans create/update/copy, migration parity is now documented as a shipped UI surface rather than an implied fixture section, and the final root `pnpm build` finished green (`28/28`).

-   [x] Close the remaining QA-confirmed self-hosted fixture fidelity gaps

    -   Note: This pass is limited to the concrete defects confirmed by the 2026-04-04 QA audit after the previous "complete" status: the committed self-hosted snapshot is still an e2e-stamped artifact, the generator/CLI contract is not yet canonicalized, and regression coverage remains too weak to fail loudly on fixture drift.
    -   Note: Final consumer validation also exposed one remaining downstream blocker after import: application runtime sync still fails for the canonical self-hosted fixture during the connector-driven schema creation flow, so this pass must close that applications-backend compatibility gap before the task can be marked complete.
    -   Required outcomes:
        -   [x] Canonicalize the generated/exported self-hosted snapshot identity so the committed fixture uses stable product metadata instead of run-specific e2e names/codenames.
        -   [x] Rename and configure the canonical default dashboard layout instead of leaving the exported fixture on the seeded `Main` layout or creating an unused duplicate layout.
        -   [x] Strengthen generator and consumer assertions so stale self-model artifacts, weak localization, incomplete section descriptions, and incomplete settings baseline regressions fail closed.
        -   [x] Align the manual creation utility with the canonical generator contract so both produce the same self-hosted structure, layout naming, localization quality, and seeded settings data.
        -   [x] Regenerate `tools/fixtures/metahubs-self-hosted-app-snapshot.json` from the corrected generator contract and revalidate all consuming flows.
        -   [x] Make applications runtime sync preserve canonical enum-value codename payloads from imported snapshots so connector-driven schema creation no longer fails after self-hosted fixture import.
        -   [x] Update memory-bank status/progress so completion claims match the real artifact contract after validation.
    -   Validation target: focused generator/consumer checks, targeted lint for touched files, targeted self-hosted Playwright generator rerun, and canonical root `pnpm build`.
    -   Current status: complete; the canonical generator/CLI/layout contract was repaired, the committed self-hosted fixture was regenerated from the real generator, applications runtime sync now normalizes imported enum-value codenames as canonical VLC payloads and ships through the rebuilt package dist, focused applications-backend seeding coverage passed, both self-hosted fixture-consuming Playwright flows passed, and the canonical root `pnpm build` finished green (`28/28`).

-   [x] Close the remaining QA and plan-completion gaps for the metahub self-hosted parity wave

    -   Note: This implementation pass is limited to the concrete defects and incompletions confirmed by the 2026-04-04 QA audit after the nominal parity-wave completion. Keep legacy working behavior intact while removing the verified technical debt.
    -   Required outcomes:
        -   [x] Disable persisted runtime row reordering whenever the frontend cannot guarantee a complete dataset order, and keep the UI honest about local-search / partial-data constraints.
        -   [x] Prevent direct page-surface create activation when a catalog disables the create action via `runtimeConfig.showCreateButton`.
        -   [x] Expose the direct metahub export action in the metahub frontend so the shipped UI matches the supported backend surface.
        -   [x] Repair the stale applications-frontend test mock and clear the relevant lint / formatting debt introduced in touched files.
        -   [x] Update the parity plan/docs/memory-bank status so they reflect the completed implementation rather than a draft with open checklist items.
        -   [x] Revalidate with focused package tests/lint, required targeted checks, and a final root `pnpm build`.
    -   Validation target: targeted Vitest/Jest suites for touched packages, package lint for changed packages, and canonical root `pnpm build`.
    -   Current status: complete; runtime reorder now fails closed on partial/local-search datasets with explicit user messaging, hidden-create page routing is blocked, direct metahub export is exposed as a per-entity action, the stale applications-frontend mock and touched-file formatting debt were repaired, and validation finished green including targeted Vitest runs, lint for touched frontend packages, and a final root `pnpm build` (`28/28`).

-   [x] Close the final QA remediation gaps for the metahub self-hosted parity wave

    -   Note: This follow-up is limited to the concrete defects confirmed by the 2026-04-04 QA pass after the nominal parity-wave completion. Do not widen scope beyond the verified gaps in fixture fidelity, localization quality, regression-proofing, and their documentation/memory trail.
    -   Required outcomes:
        -   [x] Fix the English metahubs locale regression so newly added catalog runtime/layout keys are truly English in the EN bundle and remain aligned with RU.
        -   [x] Strengthen generator/export regression coverage so the self-hosted fixture contract asserts its real identity and catches stale self-model artifacts.
        -   [x] Regenerate or otherwise replace `tools/fixtures/metahubs-self-hosted-app-snapshot.json` with the actual self-hosted V2 artifact produced by the current generator contract, including the removal of the standalone `Attributes` catalog.
        -   [x] Update any touched EN/RU documentation and memory-bank status files so they describe the real delivered fixture/i18n state rather than the previously assumed one.
        -   [x] Revalidate with focused package tests/checks, the generator flow if available, and a final root `pnpm build`.
    -   Validation target: targeted metahubs-frontend tests, targeted generator validation, artifact sanity checks, and canonical root `pnpm build`.
    -   Current status: complete; the EN locale bundle and regression assertions were corrected, the self-hosted generator/export contract now fails closed against stale self-model assumptions, the committed fixture was regenerated through the real generator after fixing the `Settings` seed payload key mismatch (`Key`/`Value`/`Category`), and the validation stack finished green including the final root `pnpm build` (`28/28`).

-   [x] Implement the metahub self-hosted parity wave

    -   Note: Execute the approved plan in `memory-bank/plan/metahub-self-hosted-app-parity-plan-2026-04-04.md` end-to-end without widening scope beyond the defined parity wave. Preserve working legacy functionality while delivering the new self-hosted metahub MVP path.
    -   Current implementation pass (2026-04-04 QA closure + completion):
        -   [x] Fix the confirmed QA blockers in runtime CRUD and validation: parent create/copy permission gates, the `runtimeRowsController` root-build TypeScript error, and direct regression coverage for create/copy/reorder permissions.
        -   [x] Finish Phase 6 by wiring standalone runtime page surfaces through the existing shared form/page/tabular primitives and locking the behavior with focused tests.
        -   [x] Finish Phase 7 by exposing migration-control parity in the self-hosted app flow with the existing application migration page/guard patterns and navigation affordances.
        -   [x] Finish Phase 8 by replacing the transitional self-model fixture/generator naming and dependent flows with the localized V2 artifact contract.
        -   [x] Finish Phase 9 by closing the remaining snapshot/export/import fixture UX and regression gaps for the renamed self-hosted artifact contract.
        -   [x] Finish Phase 10 with focused unit/integration/Playwright/generator validation plus a green root `pnpm build`.
        -   [x] Finish Phase 11 with EN/RU tooling/docs updates for the delivered self-hosted fixture and flow behavior.
    -   Required outcomes:
        -   [x] Phase 0: capture baseline screenshots/current runtime evidence and keep the section-by-section parity evidence in the validation/docs trail.
        -   [x] Phase 1: introduce shared typed runtime/editing config contracts and make metahubs + applications-backend + apps-template consume the same schema/defaulting helpers.
        -   [x] Phase 2: add per-catalog layout/runtime/edit-surface authoring controls in existing metahub dialogs.
        -   [x] Phase 3: add multiline attribute authoring/runtime behavior using the existing `uiConfig.widget` seam.
        -   [x] Phase 4: refactor apps-template runtime to stay DataGrid-first while supporting toolbar, quick filter, card/list, row height, and per-catalog overrides.
        -   [x] Phase 5: implement persisted row-reordering rules and fail-closed gating.
        -   [x] Phase 6: add page-surface editing and child-relation runtime surfaces using shared form/page primitives.
        -   [x] Phase 7: add migration-control parity for the self-hosted metahub app using existing migration routes/patterns.
        -   [x] Phase 8: replace the self-model fixture/generator with the localized product-faithful V2 artifact and rename all dependent flows.
        -   [x] Phase 9: complete snapshot/export/import UX and regression coverage for new config fields.
        -   [x] Phase 10: add/extend unit, integration, Playwright, generator, and fresh-import validation coverage; pass targeted checks and root `pnpm build`.
        -   [x] Phase 11: update package READMEs and GitBook docs in EN/RU for the delivered behavior.
    -   Validation target: targeted tests during each phase, final root `pnpm build`, targeted Playwright coverage, generator rerun, and fresh hosted E2E import/export verification.
    -   Current status: complete; the shared runtime-config contract survives authoring/backend/runtime/export/import, standalone runtime now respects authored page surfaces, application self-hosted navigation exposes migrations parity, the V2 self-hosted fixture/generator contract replaced the transitional self-model artifact naming, focused tests/load checks passed, the shared browser export drift in `@universo/utils` was fixed at the source, and the final root `pnpm build` finished green (`28/28`).

-   [x] Plan the next metahub self-hosting parity wave

    -   Note: The previous snapshot/runtime wave delivered import/export and layout-level runtime settings, but did not reach catalog-level parity, attribute presentation parity, page-surface editing, or a production-credible self-model fixture. This planning task must define the next implementation wave without writing production code yet.
    -   Required outcomes:
        -   [x] Audit the remaining gap between the original metahub-self-hosting brief and the current implementation in `main`.
        -   [x] Produce a new detailed plan in `memory-bank/plan/metahub-self-hosted-app-parity-plan-2026-04-04.md` covering metadata contracts, runtime refactor, self-model V2, tests, and docs.
        -   [x] Explicitly fix the previous planning mistakes in the new plan: layout-global settings instead of catalog-specific settings, alternate runtime table degradation, local-only reorder semantics, and the weak self-model fixture structure.
        -   [x] Run a QA-oriented architecture review on the new plan against the real codebase, reusable UI/runtime seams, and relevant MUI DataGrid guidance.
        -   [x] Refine the plan so it reuses existing tabbed dialogs, attribute `uiConfig` seams, and current runtime primitives instead of introducing unnecessary nested settings DSLs or parallel CRUD surfaces.
        -   [x] Add the missing cross-package runtime schema unification and migration-control parity work so the plan does not leave hidden sync drift or a migrations-section parity hole.
        -   [x] Keep the new plan aligned with current package boundaries, modern shared-package usage, i18n-first text handling, UUID v7, and the no-legacy-removal constraint while awaiting final user approval.
    -   Current status: complete; the approved plan is now the implementation source of truth for the active wave.
    -   Validation target: codebase inspection, package README review, targeted external documentation lookup, and a discussion-ready plan file only.

-   [x] Address validated PR #747 review findings without widening scope

    -   Note: Evaluate every bot comment from PR #747 against the current branch state, fix only the findings that are technically correct and safe, and explicitly avoid speculative architecture changes that would widen the feature surface.
    -   Required outcomes:
        -   [x] Confirm which review comments still correspond to live defects in the current worktree after the post-PR edits.
        -   [x] Fix the confirmed correctness issues in backend/frontend/tests with minimal changes and no unrelated refactors.
        -   [x] Check external documentation where it materially helps validate the proposed fix or reject a bot suggestion.
        -   [x] Revalidate the touched surfaces with focused checks/tests and leave the branch ready for a follow-up commit.
    -   Validation target: diagnostics for touched files, focused tests/builds for touched packages, and a canonical root build.
    -   Outcome: fixed the live mid-file import, the `React.ChangeEvent` namespace issue, the ineffective snapshot prototype-pollution test, the SnapshotRestoreService codename logging output, the imported-metahub codename collision risk, and the `MainGrid` FlowListTable `renderCell` API placeholder; explicitly did not widen scope into server-side runtime search or persisted row-order storage because those review comments were product/architecture suggestions rather than safe correctness fixes. The branch is validated locally and ready for commit/push if requested.

-   [x] Close the verified snapshot/runtime follow-up gaps from 2026-04-04

    -   Note: This wave reopens only the residual defects confirmed by direct verification after the previous implementation pass. Do not touch unrelated working-tree changes.
    -   Required outcomes:
        -   [x] Make `importFromSnapshot` cleanup-safe for the two early post-create failure branches (`Failed to create metahub branch`, `Branch schema not found`) instead of returning before compensation.
        -   [x] Replace the runtime view smoke test with a deterministic `/a/...` flow that provisions a real application, asserts enhanced runtime controls, and proves the FlowListTable path is active when row reordering is enabled.
        -   [x] Persist enhanced runtime layout settings into the self-model generator contract and regenerate `tools/fixtures/self-model-metahub-snapshot.json` from the corrected order of operations.
        -   [x] Fix the manual self-model utility CSRF endpoint and refresh generator documentation so the described scope matches the real 13-section fixture.
    -   Validation target: focused metahubs-backend tests, apps-template/runtime browser flow validation, targeted self-model generator rerun when available, and the canonical root `pnpm build`.
    -   Outcome: early import branch/schema failures now reuse the rollback cleanup path, `app-runtime-views.spec.ts` exercises the real `/a/${applicationId}` route with card/search/list assertions, the self-model generator reran successfully and regenerated the fixture with enhanced runtime layout fields, the manual utility now uses `/api/v1/auth/csrf`, the generator docs describe the 13-section scope, and the validation stack passed (`metahubsRoutes.test.ts`, targeted runtime Playwright flow, targeted generator run, root `pnpm build`).

-   [x] Implement QA closure for snapshot import cleanup, runtime list consistency, and self-model scope

    -   Note: Keep scope limited to the six validated QA items from the current implementation pass. Do not revert unrelated worktree changes.
    -   Required outcomes:
        -   [x] Make metahub snapshot import cleanup-safe on restore/publication failure, including explicit cleanup-failure reporting.
        -   [x] Add backend tests for import rollback and cleanup-failure paths.
        -   [x] Fix apps-template runtime filtered-view pagination/search consistency in MainGrid.
        -   [x] Finish the enableRowReordering runtime path with FlowListTable integration and LayoutDetails wiring without regressing the DataGrid path.
        -   [x] Expand the self-model generator/fixture contract from the current 9-catalog shape to the planned 13-section scope and update dependent assertions/docs if needed.
        -   [x] Clean remaining diagnostics/editorial issues in snapshotArchive.test.ts and SnapshotRestoreService.test.ts, then revalidate with focused tests and a full root pnpm build.
    -   Validation target: focused Jest/Vitest runs for touched backend/frontend/utils areas, then full root `pnpm build`.
    -   Outcome: metahub import now fails closed with explicit rollback vs cleanup-failure responses, MainGrid uses local filtered totals and FlowListTable reorder mode when configured, LayoutDetails exposes the now-real reorder toggle again, the self-model generator and CLI create the planned 13 sections via real hub/set/enumeration endpoints and regenerated `tools/fixtures/self-model-metahub-snapshot.json`, the two QA-flagged test files are diagnostics-clean, focused tests passed, and the root `pnpm build` finished green (`28/28`).

-   [x] QA remediation follow-up for snapshot/runtime settings hardening

    -   Note: Reopen the completed snapshot wave only for validated post-QA implementation gaps. Keep the fix scope limited to concrete defects: snapshot transport type contract drift, runtime view-settings contract drift, RBAC/import test gaps, and repository cleanup artifacts.
    -   Required outcomes:
        -   [x] Align `buildSnapshotEnvelope()` input typing with the stricter snapshot transport schema and remove the confirmed editor/TypeScript contract drift.
        -   [x] Resolve the `enableRowReordering` contract debt consistently across apps-template-mui runtime, layout settings UI, and documentation without introducing a noop feature seam.
        -   [x] Add backend tests that prove publication version import behavior and permission-path expectations more directly.
        -   [x] Remove accidental repository-root artifact files left outside the project contract.
        -   [x] Revalidate with focused package tests/checks and a full root `pnpm build`.
    -   Validation target: strict package-level TypeScript validation for touched code where relevant, focused Jest/Vitest runs for touched backend/utils areas, then full root `pnpm build`.
    -   Outcome: tightened snapshot envelope typing in `@universo/utils` and backend export callsites, removed the stale `enableRowReordering` config seam from runtime/docs/i18n, added publication-version import happy-path assertions, deleted accidental root artifacts, and finished with green focused tests plus a green root `pnpm build` (`28/28`).

-   [x] Fix snapshot import UX, backend compatibility, and remaining E2E failures

    -   Note: Closed the snapshot-import follow-up wave by fixing the import-created publication/version linkage, aligning the import dialog with the shared modal contract, and stabilizing the remaining full-suite regressions.
    -   Required outcomes:
        -   [x] Import dialog copy is renamed from snapshot wording to configuration wording, including RU text for the no-file-selected state.
        -   [x] Import dialog matches the shared modal style contract and does not render the extra horizontal divider lines.
        -   [x] `tools/fixtures/self-model-metahub-snapshot.json` imports successfully through the real browser UI.
        -   [x] Connector-driven schema creation for an application linked to the imported self-model metahub no longer fails on `GET /api/v1/application/:id/diff`.
        -   [x] E2E covers the imported-self-model -> connector -> create schema path.
        -   [x] Residual full-suite failures are fixed and `pnpm run test:e2e:full` completes green.
        -   [x] Wrapper-managed E2E runs stop the owned server and release port `3100` after completion.
    -   Validation target: focused Playwright CLI reruns for the touched flows, then full `pnpm run test:e2e:full`, plus an explicit post-run port-availability check.
    -   Outcome: full root `pnpm build` passed; targeted metahubs import tests, connector/snapshot/admin/visual Playwright reruns passed; final `pnpm run test:e2e:full` finished green; post-run `lsof -iTCP:3100 -sTCP:LISTEN` showed no listener.

-   [x] E2E Supabase full reset and teardown hardening

    -   Note: Replaced manifest-only cleanup as the primary isolation boundary with a guarded full project reset for the dedicated hosted E2E Supabase. Scope now covers application-owned fixed schemas, dynamic `app_*` / `mhb_*` schemas, `upl_migrations`, Supabase auth users, runner orchestration, diagnostics, and EN/RU docs.
    -   Validation:
        -   [x] Added a safe `full reset` backend helper with dry-run/report support and strict E2E-only guardrails.
        -   [x] Derived resettable fixed schemas from registered system app definitions while keeping infrastructure schema `public` intact and self-healed.
        -   [x] Integrated reset before suite startup and after server shutdown in the Playwright runner.
        -   [x] Kept manifest cleanup as a narrow recovery/helper path, not the primary isolation strategy.
        -   [x] Added doctor/report tooling to verify leftover schemas/users after teardown.
        -   [x] Updated English and Russian E2E documentation with the new reset contract and safety rules.
        -   [x] Validated via full `pnpm build`, full `pnpm run test:e2e:full`, explicit post-run cleanup verification, and a green smoke rerun proving automatic runner-finalize reset.
    -   Outcome: full `test:e2e:full` completed and exposed 5 pre-existing spec failures outside the reset scope (`app-runtime-views`, `profile-update`, `snapshot-export-import`, visual metahub dialog). After the run, `test:e2e:cleanup` + `test:e2e:doctor -- --assert-empty` confirmed zero project-owned schemas/auth users/artifacts; after the runner process-group fix, `test:e2e:smoke` passed `11/11` and automatic `runner-finalize` left the database empty without manual intervention.

-   [x] Address validated PR #745 review findings in admin locale, instance, and role codename flows.

    -   Note: Implemented the confirmed fixes only: locale typing now preserves a trailing separator, instance inline edits keep untouched locales, and role codename validation now honors runtime `metahubs` settings on backend routes while preserving legacy slug compatibility. Validation passed via focused Jest, package builds, and full `pnpm build`.

-   [x] Add Package Configuration for `core-frontend` to include `.env*` files in build inputs, closing the .env cache-invalidation gap.

    -   Note: `core-frontend` is the only package that reads `.env` via `dotenv` at Vite build time. Without explicit `.env*` inputs, changing a `.env` value would not invalidate the cached build.

-   [x] Metahub Self-Hosted App & Snapshot Export/Import — ALL PHASES COMPLETE
    -   Plan: `memory-bank/plan/metahub-self-hosted-app-and-snapshot-export-plan-2026-04-03.md`
    -   QA v2 deep-dive found 3 critical + 4 high + 4 medium issues; all 11 corrections applied to plan v3
    -   Phases 1–8 ALL COMPLETE — backend, frontend, apps-template-mui, layout config UI, self-model, tests, docs
    -   Full build passing: 28 successful, 0 failed; snapshot tests: 15/15 passing; unit tests: 274/274
    -   QA Post-Implementation Fixes (2026-04-03):
        -   [x] H1: E2E tampered hash test now uses 64-char fake hash to test integrity, not Zod length
        -   [x] H2: Removed noop `enableRowReordering` toggle from LayoutDetails View Settings (Zod schema field kept for future DnD)
        -   [x] M3: Added per-entity field count (200) and element count (10,000) validation to `validateSnapshotEnvelope`
        -   [x] M4: File input in ImportSnapshotDialog now resets on close via `useRef`
    -   Self-Model E2E (2026-04-03):
        -   [x] Created `self-model-metahub-export.spec.ts` — creates 9 catalogs with 27 attributes, publication, version, screenshots, exports to fixture
        -   [x] Fixed codename JSONB/VLC format in all E2E specs (createMetahub, catalogs, attributes, publication, version)
        -   [x] Fixture saved: `tools/fixtures/self-model-metahub-snapshot.json` (62 KB, 13 entities)
        -   [x] 3 screenshots in `test-results/self-model/`
    -   Remaining QA Findings (2026-04-03):
        -   [x] F2: Import endpoint VLC format fix — replaced `buildLocalizedContent` with `ensureVLC` in `importFromSnapshot`
        -   [x] F1: E2E toolbar dropdown selector fixed — `toolbar-primary-action-menu-trigger` (matches actual data-testid)
    -   QA v3 Hardening Fixes (2026-04-03):
        -   [x] C1: Fixed VLC format incompatibility — import now uses `ensureVLC()` instead of `buildLocalizedContent()` for name/description/publication
        -   [x] H1+H2: Added `log.warn()` for unmapped hub references and silent cross-reference nullification in SnapshotRestoreService
        -   [x] H3: `defaultLayoutId` confirmed as false positive — snapshot is self-consistent with original IDs
        -   [x] H4: `enableRowReordering` intentionally kept as future DnD placeholder (previous QA decision)
        -   [x] M1: Tightened Zod snapshot schema — explicit optional fields for known snapshot structure, passthrough kept for forward compatibility
        -   [x] M2: Server-side `Content-Length` check added as defense-in-depth in import route (Express body parser also enforces global limit)
        -   [x] L1: i18n keys confirmed already present (`export.exportVersion`, `export.exportMetahub` etc.)
        -   [x] C2: Added 7 unit tests for import/export routes (401, 400, hash mismatch, 201 happy path, export 401/404/400)
        -   [x] M5: Created SnapshotRestoreService.test.ts with 6 unit tests (entities, hub remap, constants, layouts, orphan skip, empty snapshot)
        -   [x] M3: Fixed E2E snapshot spec — selector mismatch + import response ID extraction
    -   Full build: 28/28 passing; metahubs-backend: 47 suites, 421 tests; utils: 274 tests
    -   Generators Architecture (2026-04-03):
        -   [x] Created `specs/generators/` folder and moved `self-model-metahub-export.spec.ts` from `specs/flows/`
        -   [x] Added `generators` project to `playwright.config.mjs` (dedicated `testMatch`, isolated from `chromium` via `testIgnore`)
        -   [x] Updated `package.json`: `test:e2e:full` explicitly lists non-generator projects; added `test:e2e:generators` script
        -   [x] Documented Snapshot Generators section in both E2E READMEs (EN + RU, 331/331 lines parity)

## Completed Archive — 2026-04-03 To 2026-03-24

-   [x] The 2026-04-03 snapshot/export-import, Turbo cache hardening, review-remediation, and hosted E2E reset waves remain complete.
    -   Note: Durable detail, validation logs, and release-aligned outcomes now live in `progress.md` under the dated 2026-04-03 entries.
-   [x] The 2026-04-02 page-spacing and Playwright route-surface/browser-hardening closures remain complete.
    -   Note: Shared spacing contracts, targeted Playwright proof, and documentation updates are archived in `progress.md`.
-   [x] The 2026-04-01 to 2026-03-31 browser-auth/RLS/QA hardening closures remain complete.
    -   Note: Keep `tasks.md` focused on active work and the recent completion trail rather than duplicating the permanent validation history.
-   [x] The late-March QA, security, codename, bootstrap-superuser, and application-workspaces closures remain archived.
    -   Note: See `progress.md` for the preserved durable outcome summaries.
