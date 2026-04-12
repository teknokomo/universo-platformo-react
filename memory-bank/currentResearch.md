# Current Research

## 2026-04-12: Metahub QA gap closure

- Research outcome implemented: the remaining QA debt after the visual spacing acceptance passes was structural, not visual-only. The accepted inset depended on duplicated metahub route detection across shared shell components, metahub loading states still used an implicit numeric override pattern, and the tree lacked real proof for browser geometry plus negative-path generic-entity ACL behavior.
- Implemented fix set: `pageSpacing.ts` now centralizes the route-aware metahub shell helpers consumed by `MainLayoutMUI` and `Header`; `SkeletonGrid` now exposes semantic `insetMode='page' | 'content'` plus the stable `skeleton-grid` selector; the affected metahub routes now use `insetMode='content'`; focused `entityInstancesRoutes` ACL tests now prove `403` denial behavior for generic delete and catalog-compatible create; and the new authenticated Playwright flow `metahub-shell-spacing.spec.ts` proves breadcrumb/header/loading-skeleton alignment on `/metahubs` during a delayed loading state.
- Closure validation: `pnpm --filter @universo/template-mui build` passed, `pnpm --filter @universo/template-mui test` passed (`23/23`), `pnpm --filter @universo/metahubs-frontend build` passed, `pnpm run build:e2e` passed, the targeted Chromium shell-spacing flow passed (`2 passed` including auth setup), and the canonical root `pnpm build` completed green.
- Wider `entityInstancesRoutes` permanent-delete policy failures remain an older branch baseline and were not changed in this session; no open research thread remains for the metahub QA-gap closure itself.

## 2026-04-12: Metahub gutter narrowing follow-up

- Research outcome implemented: removing the old content bleed offsets fixed the original mismatch, but the resulting metahub page inset was still wider than the acceptance screenshots because breadcrumbs remained tied to the shared shell gutter.
- Implemented fix set: `MainLayoutMUI` now applies a narrower route-aware gutter for `/metahubs` and `/metahub/*`, and `MetahubBoard` dropped its remaining extra header padding so metahub breadcrumbs, headers, content, and pagination all align to the same smaller inset.
- Closure validation: `pnpm --filter @universo/template-mui build` passed, `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for this metahub gutter follow-up.

## 2026-04-12: Metahub page horizontal spacing fix

- Research outcome implemented: the spacing issue was not isolated to one list page. The same standalone page-shell drift existed across both legacy and entity-based metahub pages because the main layout already provided a gutter while the page content still applied older negative bleed offsets.
- Implemented fix set: the old horizontal bleed offsets were removed from metahub card/table/banner/pagination wrappers and from the Common/Settings/Migrations/Layout page shells, so headers and the content below now align to the same left/right gutter.
- Closure validation: `pnpm --filter @universo/metahubs-frontend build` completed green, diagnostics stayed clean, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for this metahub spacing seam.

## 2026-04-12: Entity V2 post-rebuild regression fix

- Research outcome implemented: the fresh-import defects were two narrow shipped-surface seams, not a wider entity-definition data-loss problem. The first-open blank fields came from shared dialog state timing, and the missing Hub V2 / Set V2 / Enumeration V2 rows came from an over-narrow compatibility read scope.
- Implemented fix set: `EntityFormDialog` now renders fresh initial localized values on the first open, and `resolveRequestedLegacyCompatibleKinds(...)` now validates the requested compatible kind and widens read scopes back to the full compatible union for hub/set/enumeration list surfaces.
- Closure validation: focused backend route regressions passed (`39/39`), focused shared dialog coverage passed (`9/9`), focused compatibility-helper coverage passed (`2/2`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for this post-rebuild regression seam.

## 2026-04-12: Self-hosted fixture QA closure

- Research outcome implemented: the last real QA findings on the current tree were no longer preset manifests or compatibility ACLs; they were a stale committed self-hosted fixture and a browser import flow that still validated only counts/layout structure.
- Implemented fix set: the supported self-hosted generator regenerated the committed snapshot, and the browser import flow now re-exports the imported metahub and validates `assertSelfHostedAppEnvelopeContract(...)` with an explicit stabilization timeout so imported `entityTypeDefinitions` drift fails in the browser.
- Closure validation: direct contract check returned `fixture-contract:ok`, `pnpm run build:e2e` passed, the supported self-hosted generator/export flow passed (`2 passed`), the targeted Chromium self-hosted import flow passed (`2 passed`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for this self-hosted fixture/import seam.

## 2026-04-12: Entity V2 QA completion follow-up

- Research outcome implemented: the last real implementation gap after the QA pass was not ACL/runtime parity anymore; it was preset manifest drift. Hub V2 and Enumeration V2 still inherited legacy-disabled component maps even though the approved plan promised V2-only automation uplift.
- Implemented fix set: Hub V2 now explicitly enables scripting/actions/events, Enumeration V2 now explicitly enables actions/events on top of inherited scripting, direct preset-manifest coverage now asserts the upgraded component set, and the self-hosted fixture contract plus committed snapshot were regenerated through the supported generator path to lock the exported definitions.
- Closure validation: focused `templateManifestValidator` coverage passed (`8/8`), the supported self-hosted generator/export flow passed (`1 passed`, `5.3m`), the edited EN/RU custom-entity guides remain line-count aligned (`72/72`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for this preset-uplift seam.

## 2026-04-12: Entity V2 QA closure completion

- Research outcome implemented: the last real blocker after the deeper QA review was a low-level SQL seam, not a controller-level permission bug. Delete blocker services still filtered exact built-in `set` / `enumeration` target kinds even though compatible Set V2 / Enumeration V2 rows persisted custom target kinds.
- Implemented fix set: low-level blocker services now accept compatible target-kind arrays, the generic entity delete plan plus the legacy set/enumeration/constant delete paths now pass those arrays consistently, focused service regressions lock the `ANY($n::text[])` SQL contract, and the Chromium legacy-compatible V2 flow now proves blocked delete when a catalog attribute still references a compatible Set V2.
- Closure validation: focused metahubs-backend route/service coverage passed (`87/87`), `pnpm run build:e2e` completed green (`30 successful`, `30 total`), the targeted Chromium legacy-compatible V2 suite passed (`7 passed`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for this blocker-service seam.

## 2026-04-11: Entity V2 completion remediation closure

- Research outcome implemented: the remaining live browser defects were the delegated Set V2 direct-constants `kindKey` gap, the delegated Enumeration V2 detail/value `kindKey` gap, a backend direct-enumeration update seam that still hardcoded the built-in `enumeration` kind, and a stale snapshot round-trip browser timeout after the self-hosted fixture expanded.
- Implemented fix set: direct Set/Enumeration leaf flows now propagate `kindKey` through frontend APIs/hooks/query keys and UI invalidation, backend direct enumeration PATCH now updates through the stored compatible custom kind, the targeted legacy-compatible V2 Playwright proof now matches response pathnames instead of raw URLs, the supported self-hosted generator regenerated the committed fixture, and the snapshot import browser proof now has an explicit larger timeout budget for the expanded contract.
- Closure validation: targeted Chromium legacy-compatible V2 flows passed (`3 passed`), the self-hosted generator passed (`2 passed`), the full snapshot export/import suite passed (`5 passed`), `pnpm docs:i18n:check` passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for the Entity V2 completion remediation seam.

## 2026-04-11: PR #757 review comment QA triage

- Review outcome implemented: the PR bot comments reduced to one real backend lifecycle issue plus a batch of indentation-only comments.
- Confirmed real issue: generic custom-entity create dispatched `beforeCreate` with a preallocated UUID that was not guaranteed to become the persisted `_mhb_objects.id`, so future lifecycle scripts could observe a mismatched object id across `beforeCreate` and `afterCreate`.
- Implemented fix: `MetahubObjectsService.createObject(...)` now accepts an optional explicit id, and the generic create controller passes its preallocated pending UUID into persistence so create-time lifecycle events remain self-consistent.
- Rejected comments: the indentation warnings were not applied because neighboring metahubs-backend controllers/services already use the same indentation style and the bot cited a non-existent `.gemini/styleguide.md` file rather than an actually present repository contract.
- Closure validation: focused metahubs-backend tests passed (`34/34`) and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for the PR #757 review-triage seam.

## 2026-04-11: Entities automation closure remediation

- Research outcome implemented: the remaining QA-closure work narrowed to three real seams only: generic create still needed to use the lifecycle boundary, the automation ACL suspicion needed verification against the actual mounted surface instead of a speculative permission patch, and the EN/RU operator docs still under-described the real authoring workflow.
- Implemented fix set: generic custom-entity create now routes through `EntityMutationService` with a result-resolved committed object id, focused `EntityAutomationTab` coverage is green, catalog-compatible routes were verified to short-circuit into `CatalogList` before the generic automation tabs mount, and EN/RU docs now ship save-first `Scripts -> Actions -> Events` guidance plus stable copied visual assets.
- Build-only follow-up: `pnpm run build:e2e` surfaced a missing `DbExecutor` type import in `EntityActionExecutionService`; fixing that import was required before the final green validation result.
- Closure validation: focused metahubs backend coverage passed (`27/27`), focused metahubs frontend automation coverage passed (`12/12`), `pnpm docs:i18n:check` passed, `pnpm run build:e2e` completed green, the targeted Chromium automation flow passed (`2 passed`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for the entities automation closure seam.

## 2026-04-11: Post-rebuild Entities workspace QA closure

- Research outcome implemented: the residual defects reported after a clean rebuild/reset/import were real shipped-surface mismatches rather than stale local state. The honest remaining scope was limited to `EntitiesWorkspace` polish, shared menu target resolution, product-string pluralization, and supported fixture regeneration.
- Implemented fix set: removed obsolete Entities page copy, tightened banner side spacing, restored built-in Documents localization through the consolidated namespace path, switched the toolbar CTA to the shared `Create` label, resolved menu edit/delete targets through the live entity-type map, pluralized `Catalogs V2` / `Каталоги V2` across user-facing seams, and regenerated the self-hosted snapshot through the Playwright generator path.
- Closure validation: focused metahubs backend coverage passed (`24/24`), focused metahubs frontend coverage passed (`22/22`), `pnpm run build:e2e` passed, the supported self-hosted generator rerun passed, the focused Chromium entities workspace flow passed (`4 passed`), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for the post-rebuild Entities workspace QA seam.

## 2026-04-10: ECAE residual QA hardening closure

- Research outcome implemented: repository evidence confirmed that Phase 5 remains future-only, so the honest remaining scope was limited to residual hardening on the shipped strict-parity surface rather than hidden unfinished visual-builder work.
- Implemented fix set: generic entity copy now retries `idx_mhb_objects_kind_codename_active` races like the legacy copy controllers, focused frontend coverage now locks fail-closed catalog-compatible copy/delete visibility while settings permissions are still loading, and Playwright now proves invited metahub members can open catalog-compatible instances read-only.
- Closure validation: focused metahubs backend route coverage passed (`20/20`), focused metahubs frontend `EntityInstanceList` coverage passed (`9/9`), the targeted member ACL browser rerun passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for the residual QA hardening seam or for the Phase 5 scope question in this session.

## 2026-04-09: ECAE Phase 3.6-4 closure

- Research outcome implemented: the remaining builder/browser gap was real checkbox semantics in `EntitiesWorkspace`, not a test bug; after that repair the honest Phase 3.8 closure was focused compatibility proof plus Phase 4 docs rather than widening into a new speculative surface.
- Implemented fix: `EntitiesWorkspace` now uses actual checkbox controls for structured builder toggles, focused backend proofs now cover legacy snapshot restore without v3-only entity metadata sections and legacy catalog-wrapper parity against object-scoped system-attribute reads, and EN/RU architecture/guide/API docs plus summaries are synced.
- Closure validation: focused frontend regressions passed (`5/5`), `@universo/metahubs-frontend` build passed, focused workspace and publication/runtime Playwright flows passed (`2/2` each), focused backend suites passed (`27/27`), the repository-standard docs i18n check passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for the Phase 3.6-4 closure seam.

## 2026-04-09: ECAE Phase 2.9 browser validation closure

- Research outcome implemented: the correct Phase 2.9 scope was the already shipped entity-type authoring surface, not a speculative Phase 3 runtime UI. The validation target was therefore `EntitiesWorkspace`, the preset-backed create dialog, backend persistence, RU parity, and a pixel-proof dialog snapshot.
- Implemented fix: added focused Playwright backend helpers plus a shipped-surface flow spec, added a dedicated visual spec for the create dialog, fixed the blank `Name` column in `EntitiesWorkspace` list mode via `row.name || row.kindKey`, and stabilized the visual proof by capturing the preset selector after blur.
- Closure validation: the focused flow passed, the refreshed visual baseline passed on rerun, and the canonical root `pnpm build` completed successfully.
- No open research thread remains for the Phase 2.9 browser-validation seam.

## 2026-04-09: ECAE Phase 2.7b reusable entity presets closure

- Research outcome implemented: the safe reusable-preset seam was already present in the metahub template registry. The missing pieces were typed registry/API exposure for `definition_type='entity_type_preset'`, builtin preset manifests, and frontend create-flow consumption.
- Implemented fix: shared template DTOs/routes now expose `definitionType` plus `activeVersionManifest`, builtin entity presets are validated and seeded through the existing template seeder/migration path, and `EntitiesWorkspace` create mode now reuses the templates hooks/selector seam to prefill entity-type form state from preset manifests.
- Additional closure fix: the canonical root `pnpm build` initially failed on `@universo/core-frontend` V8 heap exhaustion under Turbo, so the package build script now runs Vite with `NODE_OPTIONS='--max-old-space-size=8192'` to keep root validation reproducible.
- Closure validation: focused metahubs backend/frontend checks passed, `@universo/core-frontend` build passed with the heap guard, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for the Phase 2.7b reusable-entity-preset seam.

## 2026-04-08: ECAE Phase 2.5c design-time service genericization closure

- Research outcome implemented: the honest safe Phase 2.5c slice was not broad layout-service genericization. The real reusable seam was an object-scoped system-attribute adapter plus one shared design-time child-copy helper that both legacy built-in copy routes and generic custom-entity copy can reuse.
- Implemented fix: `MetahubAttributesService` now exposes object-scoped system-attribute aliases while preserving catalog wrappers, `copyDesignTimeObjectChildren(...)` centralizes attribute/element/constant/value copy behavior plus optional system-attribute reseeding, legacy catalog/set/enumeration copy controllers now use that helper internally, and generic custom-entity copy derives child-copy breadth from enabled components.
- Closure validation: focused backend regressions passed (`82/82`), `@universo/metahubs-backend` lint returned to the existing warning-only backlog (`0 errors`), `@universo/metahubs-backend` build passed, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for the Phase 2.5c design-time genericization seam.

## 2026-04-08: ECAE Phase 2.5 generic entity CRUD backend closure

- Research outcome implemented: the generic object-layer seam was viable, but only as a coexistence-first slice. Built-in catalogs/sets/enumerations still carry extra policy/copy/runtime behavior, so the safe first cut was a custom-only generic route surface rather than a wholesale legacy-route replacement.
- Implemented fix: `MetahubObjectsService` now supports generic kind strings and optional transaction runners on the mutation helpers used by generic CRUD, while the new entity-instance controllers/routes expose custom-only list/create/get/update/delete/restore/permanent/copy/reorder flows and route update/delete/copy/restore through `EntityMutationService`.
- Closure validation: focused generic route tests passed (`9/9`), the combined ECAE regression suite passed (`33/33`), `@universo/utils` build passed, `@universo/metahubs-backend` build passed, touched-file lint had `0 errors` (warning backlog only), and the canonical root `pnpm build` completed green after clearing an unrelated generated `applications-backend/base/dist` cleanup blocker.
- No open research thread remains for the Phase 2.5 generic entity CRUD backend seam.

## 2026-04-08: ECAE Phase 2.4 resolver DB extension closure

- Research outcome implemented: the shared entity-type resolver is no longer registry-only. It now understands the hybrid model where built-ins come from code and custom kinds come from metahub data definitions.
- Implemented fix: `EntityTypeResolver` now resolves built-ins first, falls through to `EntityTypeService.resolveType(...)` for custom DB-backed kinds when metahub context exists, and caches repeated custom-kind lookups per resolver instance.
- Closure validation: focused resolver tests passed (`5/5`), the combined ECAE service+route+resolver regression suite passed (`24/24`), `@universo/metahubs-backend` build passed, touched-file lint was clean, and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for the Phase 2.4 resolver DB extension seam.

## 2026-04-08: ECAE Phase 2.3 backend route surface closure

- Research outcome implemented: the new ECAE backend foundation is no longer service-only. The metahubs backend now exposes custom entity types, object-owned actions, and object-owned event bindings through the normal route/controller/auth/rate-limit stack.
- Implemented fix: added entity-type, action, and event-binding controllers/routes, registered them in the metahubs domain router, and kept route handlers thin so validation/business rules stay in the Phase 2.2 services.
- Closure validation: the new focused route suite passed (`8/8`), the combined ECAE service+route regression suite passed (`19/19`), `@universo/metahubs-backend` build passed, package lint finished with `0 errors` (warning backlog only), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for the Phase 2.3 backend route surface seam.

## 2026-04-08: ECAE Phase 2.2 backend service foundation closure

- Research outcome implemented: the first focused Phase 2.2 service run did not reveal domain-logic breakage; it exposed two narrower seams instead: test fixtures used non-canonical schema names, and the new services still had build-only typing gaps around optimistic locking and post-commit dispatch.
- Implemented fix: the focused backend tests now use canonical metahub schema names, `ActionService` uses the shared codename text helper for conflict checks, shared optimistic-lock typing now includes `entity_type` / `action` / `event_binding`, and `EntityMutationService` now performs `after*` dispatch explicitly after the transaction instead of storing a callback closure.
- Closure validation: focused entity/action/event/lifecycle service tests passed (`11/11`), `@universo/utils` build passed, `@universo/metahubs-backend` build passed, package lint finished with `0 errors` (warning backlog only), and the canonical root `pnpm build` completed green (`30 successful`, `30 total`).
- No open research thread remains for the Phase 2.2 backend service foundation seam.

## 2026-04-08: Post-QA lint closure for the Shared/Common wave

- Research outcome implemented: after the earlier product/security remediations were closed, the only remaining QA blocker was red package lint in the touched Shared/Common backend/frontend files.
- Confirmed root cause: the release gate was the error-level Prettier/ESLint drift in the touched metahubs files. The broader warning-only backlog was real but was not the blocker that kept this implementation wave open.
- Implemented fix: root-level Prettier on the confirmed blocker files plus package `eslint --fix` restored green lint exits for both metahubs packages.
- Closure validation: `@universo/metahubs-backend` lint passed, `@universo/metahubs-frontend` lint passed, focused backend routes passed (`35/35`), focused frontend tests passed (`18/18`), and root `pnpm build` passed (`30 successful`, `30 total`, `EXIT:0`).
- No open research thread remains for the lint-closure seam.

## 2026-04-08: Attribute move ownership remediation closure

- Research outcome implemented: the only blocking post-QA defect left in the Shared/Common wave was a fail-open attribute move seam. The route accepted a routed catalog id plus an arbitrary attribute id, and the service loaded the current row by bare id even though the request was scoped to a specific catalog.
- Implemented fix: the attribute move controller now returns `404` unless the loaded attribute belongs to the routed catalog, and `MetahubAttributesService.moveAttribute(...)` now requires `id + object_id + active row` on the initial fetch and the follow-up re-reads.
- Closure validation: focused attributes routes passed (`22/22`), neighboring constants routes passed (`11/11`), neighboring enumerations routes passed (`17/17`), the canonical Shared/Common Chromium wrapper flow passed (`4 passed`, `4.2m`), and root `pnpm build` remained green (`30 successful`, `27 cached`).
- No open research thread remains for the attribute move ownership seam.

## 2026-04-08: Strict E2E runner finalization cleanup closure

- Research outcome implemented: the remaining post-QA cleanup issue was infrastructure noise, not residual state. Under strict `runner-finalize` full reset, route-level manifest cleanup was redundant and only triggered false publication/application delete failures plus savepoint/RLS error logs before the already successful authoritative reset.
- Confirmed root cause: the Common/shared Chromium wrapper flow was functionally green after the settled-response Playwright fix, but `run-playwright-suite.mjs` still executed `cleanupE2eRun()` first and therefore hit backend delete-route savepoint noise that the subsequent full reset then cleaned anyway.
- Implemented fix: strict finalization now skips route-level manifest/API cleanup entirely and relies on the post-stop full reset as the only teardown authority in that mode; non-strict/manual flows keep the old manifest-cleanup path.
- Closure validation: the focused Shared/Common Chromium wrapper run now ends cleanly (`4 passed`, `3.9m`) with only server shutdown plus `[e2e-full-reset] Completed reset for runner-finalize`, and the canonical root `pnpm build` remained green (`30 successful`, `30 cached`).
- No open research thread remains for the strict finalization cleanup seam.

## 2026-04-08: Shared/Common QA closure sync

- Research outcome: the final QA follow-up did not uncover additional product-code gaps in the Shared/Common, imported connector, or runtime page-surface waves. The only remaining issue was stale closure state in memory-bank.
- Revalidated current-tree evidence: root `pnpm build` passed, focused metahubs/applications frontend/backend suites passed, and the proof screenshots for Common toolbar alignment, RU Shared badge/list state, and runtime page-surface create state are still present in `test-results/`.
- Verified tooling nuance: backend package `test` scripts run through `tools/testing/backend/run-jest.cjs` and accept positional test paths; the Vitest-style `--run` flag is invalid for those package scripts.
- No open research thread remains for this wave.

## 2026-04-08: Imported connector schema-sync duplicate seams closed

- Research outcome implemented: the imported self-hosted connector failure was a two-step application-runtime identifier reuse problem, not raw fixture corruption. The first live 500 came from repeated shared field ids across multiple target entities in `_app_attributes`; after that fix landed, the remaining live 500 came from repeated shared enumeration value ids across multiple target enumeration objects in `_app_values` seeding.
- Confirmed narrowing: the committed raw fixture and the direct runtime-materialized fixture bundle were clean under the new executable-payload checks. The remaining collisions only surfaced on the imported publication runtime path that applications-backend consumes for diff/sync.
- Implemented fix: `resolveExecutablePayloadEntities(...)` now scopes repeated shared field ids per target entity, and the normalized publication runtime source now scopes repeated shared enumeration value ids per target enumeration object while rewriting predefined catalog-element REF payloads to the scoped ids.
- Validation: focused `applicationReleaseBundle.test.ts` passed (`14 / 14`), the imported snapshot connector Chromium flow passed (`2 passed`, `1.3m`), and the canonical root `pnpm build` completed green after rebuilding `@universo/applications-backend`.
- No open research thread remains for the connector schema-sync duplicate seam.

## 2026-04-07: Remaining shared/Common QA contract gap remediation

- Research outcome implemented: the last open QA findings were real contract mismatches, not missing compilation/tests. Shared exclusion checkboxes still wrote override rows before the parent dialog was saved, legacy `global` metahub scripts could fail when the UI resubmitted the normalized `library` role, and `GET /shared-containers` still created virtual containers from a nominally read-only route.
- Implemented fix: `SharedEntitySettingsFields` now stores exclusion state locally and shared attribute/constant/value save handlers sync only the changed exclusion flags after successful save; `MetahubScriptsService` now preserves legacy `global` rows when the unchanged metahub scope is resubmitted as normalized `library`; `GET /shared-containers` now lists existing pools only, while Common/shared authoring explicitly calls `POST /shared-containers/ensure` when it needs concrete ids.
- Closure validation: focused metahubs-frontend regressions passed (`4 files / 19 tests`), focused metahubs-backend regressions passed (`3 suites / 27 tests`), and the canonical root `pnpm build` completed green (`30 successful`, `26 cached`, `58.468s`).
- No open research thread remains for this remediation batch.

## 2026-04-07: Residual QA closure for shared/Common docs, route coverage, and runner cleanup

- Research outcome implemented: the remaining post-QA gaps were narrow and verified. The public REST API docs still described the wrong scripts detail path/method, shared entity override routing still lacked direct controller-level `400/403` coverage, and the Common/shared Chromium flow still ended with runner-level manifest cleanup failure even though the browser scenarios were green.
- Implemented fix: EN/RU `rest-api.md` now mirror the live `GET/PATCH/DELETE /metahub/{metahubId}/script/{scriptId}` router contract, `sharedEntityOverridesRoutes.test.ts` now locks the missing invalid-input and forbidden-access seams, and `e2eCleanup.mjs` now treats orphan-discovery list calls as best-effort when the manifest already contains explicit resource ids.
- Closure validation: focused metahubs-backend route tests passed (`12/12`), the EN/RU API reference pair stayed line-for-line aligned (`48/48`), the Common/shared Chromium flow passed twice (`4 passed`, `3.7m`) without leaving the run manifest behind, `pnpm docs:i18n:check` stayed green, and the canonical root `pnpm build` completed green (`30 successful`, `27 cached`, `22.196s`).
- No open research thread remains for this residual-gap closure batch.

## 2026-04-07: Shared Common fail-closed closure remediation

- Research outcome implemented: the reopened QA seams were real and narrow. The Common/shared scripting UI already constrained authoring correctly, but the backend still allowed illegal `general` or `library` scope transitions, the browser flow lacked the negative dependency scenarios, and the touched EN/RU docs did not yet describe the operator-facing fail-closed rules explicitly.
- Implemented fix: `MetahubScriptsService` now enforces the `general/library` contract fail closed on create/update while preserving unchanged legacy out-of-scope rows, `EntityScriptsTab` prefers structured backend conflict messages, and the Common/shared Chromium flow now covers delete-in-use, codename-rename conflict, and circular `@shared/*` failures.
- Closure validation: focused metahubs-backend service tests passed (`16/16`), focused metahubs-frontend scripts-tab tests passed (`10/10`), `metahub-shared-common.spec.ts` passed in Chromium (`4 passed`, `4.0m`), `pnpm run docs:i18n:check` completed without errors, and the canonical root `pnpm build` completed green (`30 successful`, `25 cached`, `1m12.288s`).
- No open research thread remains for this remediation wave.

## 2026-04-07: Shared Common final closure

- Research outcome implemented: the last closure defects were request-scoped shared override mutation/savepoint coupling, publication-backed application-sync hash mismatch after shared runtime materialization, and stale browser expectations in the final Common/shared Playwright file.
- Implemented fix: `SharedEntityOverridesService` now reuses explicit request/parent runners, publication-backed runtime sync now hashes the materialized runtime snapshot that applications actually consume, and the Chromium browser flow now asserts the real disabled Library role, async exclusion mutation, runtime create response, and quiz completion UI contracts.
- Closure validation: focused shared override service tests passed (`3/3`), focused runtime-source tests passed (`4/4`), `pnpm run build:e2e` passed, `metahub-shared-common.spec.ts` passed (`3 passed`, `3.3m`), and the canonical root `pnpm build` completed green (`30 successful`, `25 cached`, `1m39.093s`).
- No open research thread remains for the shared Common closure.

## 2026-04-07: Widget shared-behavior closure for inherited catalog widgets

- Research outcome implemented: the remaining Phase 6 defect was not just missing button hiding. Global widgets had no consistent `sharedBehavior` editor path, inherited widget UI still allowed forbidden drag/toggle actions, and backend resolver/mutation seams still trusted sparse overrides that should have been locked by the base widget.
- Implemented fix: global layout widget editors now persist `sharedBehavior` through menu/columns/quiz editors plus a generic behavior-only dialog; `LayoutDetails` gates inherited drag/toggle/exclude affordances through base-widget `sharedBehavior`; `MetahubLayoutsService` now ignores stale forbidden overrides, reuses `is_deleted_override` for inherited exclusion, and rejects forbidden inherited move/toggle/exclude writes fail closed.
- Closure validation: focused metahubs frontend inherited-widget tests passed (`2/2`), focused metahubs-backend `MetahubLayoutsService` tests passed (`11/11`), `@universo/metahubs-frontend` and `@universo/metahubs-backend` built successfully, and the canonical root `pnpm build` finished green (`30 successful`, `0 cached`, `3m46.335s`).
- No open research thread remains for the widget shared-behavior wave.

## 2026-04-07: Layout-owned catalog behavior contract closure

- Research outcome implemented: the reopened QA defect was a contract split, not a runtime-resolution bug. Applications runtime already resolved behavior from layout `catalogBehavior`, but metahubs catalog authoring/API/tests still carried legacy `runtimeConfig`.
- Implemented fix: metahubs frontend removed `runtimeConfig` from catalog form defaults, payload serializers, and shared catalog types; metahubs backend catalog controller now rejects `runtimeConfig`, strips stale persisted `config.runtimeConfig` on update/copy, and no longer returns it; touched regressions now enforce layout-owned behavior and mock reorder enablement through `_app_layouts.config.catalogBehavior`.
- Closure validation: focused metahubs frontend/backend/applications backend suites passed, touched-file ESLint recheck had no error-level failures, and the canonical root `pnpm build` finished green (`30 successful`, `28 cached`, `1m8s`).
- No open research thread remains for this remediation wave.

## 2026-04-07: Snapshot hash integrity and catalog layout docs closure

- Research outcome implemented: the reopened QA defect was a real integrity gap, not a false positive. The shared canonical publication snapshot hash/checksum path had not kept up with the current export surface.
- Confirmed root cause: `normalizePublicationSnapshotForHash(...)` omitted `scripts`, `catalogLayouts`, and `catalogLayoutWidgetOverrides`, even though those sections already participate in snapshot export/import and application release lineage.
- Implemented fix: the shared normalizer now includes those sections with deterministic ordering, focused `@universo/utils` regressions fail closed on hash drift and envelope tampering across the newly covered sections, and the EN/RU catalog-layout docs now describe inherited widgets as placement/visibility overlays with base-layout config inheritance.
- Closure validation: focused snapshot/hash tests passed (`22/22`), `pnpm --filter @universo/utils build` completed green, and the canonical root `pnpm build` finished green.
- No open research thread remains for this remediation wave.

## 2026-04-07: Self-hosted fixture regeneration and current structure baseline closure

- Research outcome implemented: the remaining self-hosted generator failure was split across two seams, not one export bug. The generator spec still expected `showDetailsTitle: false` to persist in Settings layout config, while the live contract keeps that behavior as a widget override.
- Confirmed root cause: current public structure version `0.1.0` still mapped numeric version `1` to `SYSTEM_TABLES_V1`, so freshly created branch schemas omitted `_mhb_scripts` and publication creation failed during the generator flow.
- Implemented fix: the generator assertion now follows sparse persisted layout semantics, and `SYSTEM_TABLE_VERSIONS` maps version `1` to `SYSTEM_TABLES`, restoring `_mhb_scripts` to fresh current-version branch schemas.
- Closure validation: the browser self-hosted generator passed (`2 passed`, `4.7m`), the browser snapshot import/export flow passed (`5 passed`, `1.9m`), focused `systemTableDefinitions` backend tests passed (`27/27`), and the canonical root `pnpm build` finished green.
- No open research thread remains for this fixture/baseline wave.

## 2026-04-06: Catalog layout QA remediation closure

- Research outcome implemented: the remaining QA defects were real contract mismatches, not just copy or CSS polish. Catalog runtime behavior still resolved partly from legacy catalog settings, catalog layouts still stored copied widget-visibility booleans, and the catalog dialog still exposed a fallback-runtime form.
- Implemented runtime contract: `catalogRuntimeConfig.ts` and `runtimeRowsController.ts` now resolve active catalog behavior only from layout config, with the global layout acting as the default baseline until a catalog-specific layout exists.
- Implemented storage/materialization split: design-time catalog layouts now strip dashboard widget-visibility booleans from stored config, while application sync reconstructs those booleans from effective widgets when publishing runtime `_app_layouts` rows.
- Implemented UI closure: the catalog tab now ships as `Layouts` / `Макеты`, the redundant embedded heading and fallback form are removed, embedded layout content no longer renders extra shell gutters, and the shared header now provides adaptive search in the embedded dialog-width layout manager.
- Closure validation: focused utils/frontend/backend/shared-header tests passed, `pnpm run build:e2e` completed green (`30 successful`), `metahub-general-catalog-layouts.spec.ts` passed (`2 passed`, `1.8m`), and the canonical root `pnpm build` remained green.
- No open research thread remains for this remediation wave.

## 2026-04-06: Inherited catalog widgets closure

- Research outcome implemented: the remaining reopened defect was narrow and contract-level, not a broader failure of the General/catalog-layout architecture.
- Implemented backend fix: catalog-layout widget payloads now expose `isInherited`, and inherited widgets fail closed on config edit, deletion, and direct reassignment while still supporting move/toggle through sparse override rows.
- Implemented runtime fix: snapshot export and application sync now ignore inherited override config so inherited widgets always materialize with base widget config instead of freezing stale catalog-specific config.
- Implemented UI proof: the shared layout editor now renders inherited badges and hides edit/remove affordances for inherited rows while preserving drag and active-state toggles.
- Closure validation: focused metahubs-backend service tests passed (`7/7`), focused metahubs-frontend layout tests passed (`4 tests total`), focused applications-backend sync tests passed (`2/2`), `pnpm run build:e2e` completed green, `metahub-general-catalog-layouts.spec.ts` passed (`2 passed`, `1.8m`), and the canonical root `pnpm build` remained green.
- No open research thread remains for this defect.

## 2026-04-06: Metahub General section plan final contract clarification

- Research outcome: the revised plan still had one residual ambiguity after the second QA pass. It correctly moved create/edit/copy behavior to the catalog-layout level, but it did not yet specify where that behavior should live in the contract/schema.
- Verified type boundary: `DashboardLayoutConfig` only models dashboard presentation/layout fields, so it should not absorb create/edit/copy or catalog behavior settings.
- Verified reuse seam: the existing `CatalogRuntimeViewConfig` already defines the relevant catalog runtime behavior fields and enums (`showCreateButton`, `searchMode`, `createSurface`, `editSurface`, `copySurface`).
- Planning conclusion applied: the plan now treats those fields as a catalog-layout-level nested behavior block inside the existing layout `config` JSONB, reusing the established catalog runtime setting shape/enums instead of introducing a new standalone schema family.
- Final refinement applied: runtime behavior resolution is now explicit for the no-layout case as well. The selected catalog layout behavior config wins when present; otherwise runtime falls back to the existing catalog runtimeConfig behavior subset. The first catalog layout seeds its behavior config from the current catalog settings when present.
- Resulting contract split: dashboard presentation stays in `DashboardLayoutConfig`; catalog-specific runtime behavior that is not part of dashboard layout becomes part of the selected catalog layout's nested behavior config.
- No open research thread remains for this plan QA pass; the next action is user approval or implementation.

## 2026-04-05: Frontend test warning remediation closure

- Research outcome implemented: the remaining QA debt was not a product bug. The noisy MUI `anchorEl` warning came from jsdom layout validation for `Popover`/`Select` anchors inside scripting-related frontend tests.
- Implemented fix: the affected metahubs frontend tests now provide a stable non-zero `HTMLElement.prototype.getBoundingClientRect` mock while keeping the existing `user.click(...)` interaction path intact.
- Validation result: focused `@universo/metahubs-frontend` dialog/script tests passed (`9/9`), the warning string `anchorEl` no longer appeared in the captured test log, package lint no longer had error-level failures on the touched scope, and the final root `pnpm build` finished green.
- No open research thread remains for this remediation.

## 2026-04-05: Metahub dialog settings and Scripts-tab responsiveness closure

- Research outcome implemented: the narrow-dialog Scripts-tab regression was not a CRUD bug; the real failure was container-width geometry plus missing real-browser overflow assertions.
- Implemented fix: metahub dialog behavior is now driven by shared settings and one template-mui presentation seam with preset sizing, fullscreen toggle, resize persistence, reset-to-default, and strict-modal close handling.
- Implemented responsive fix: `EntityScriptsTab` now switches by `ResizeObserver` container width, collapses the attached-scripts list on narrow dialogs, and keeps horizontal overflow inside the editor shell only.
- Closure validation: focused template-mui dialog tests passed, focused metahubs-frontend Scripts-tab tests passed, targeted Playwright dialog/settings flows passed, and the final root `pnpm build` finished green.
- No open research thread remains for this wave.

## 2026-04-05: Quiz snapshot fixture export/import closure

- Research outcome implemented: the newly requested durable quiz fixture could not safely ship on top of the existing import path because metahub export already serialized `snapshot.scripts`, but `SnapshotRestoreService` did not restore `_mhb_scripts` at all.
- Implemented fix: metahub export now augments `snapshot.scripts` with live `sourceCode`, and snapshot restore now recreates `_mhb_scripts` with attachment-id remapping for entity- and attribute-scoped scripts.
- Implemented durable fixture contract: `tools/testing/e2e/support/quizFixtureContract.ts` now owns the canonical quiz metahub identity, bilingual 10-question content, canonical widget script source, and fail-closed snapshot assertions.
- Implemented durable proof: the generator `tools/testing/e2e/specs/generators/metahubs-quiz-app-export.spec.ts` rewrites `tools/fixtures/metahubs-quiz-app-snapshot.json`, and `tools/testing/e2e/specs/flows/snapshot-import-quiz-runtime.spec.ts` proves browser import, restored design-time script state, application creation from the imported publication, and the full EN/RU runtime quiz contract.
- Closure validation: focused metahubs-backend Jest passed, `pnpm run build:e2e` passed, the quiz generator passed with `2 passed`, the quiz import/runtime flow passed with `2 passed`, and the final root `pnpm build` finished green.
- No open research thread remains for the 2026-04-05 quiz snapshot fixture wave.

## 2026-04-05: Scripting QA gap closure and final plan completion

- Research outcome implemented: the previously identified scripting QA gaps are fully closed, and the final plan-completion wave is now the durable state for the 2026-04-05 scripting track.
- Implemented proof: `@universo/scripting-engine` now carries reproducible benchmark evidence with recorded `coldStartMs 7.13`, `meanMs 1.596`, and `p95Ms 2.127`.
- Implemented compatibility hardening: core-backend startup now validates `isolated-vm` / `--no-node-snapshot` compatibility explicitly, and legacy publication snapshots missing `snapshot.scripts` stay supported through direct regression coverage.
- Implemented product proof: browser authoring now exposes `quizWidget` `scriptCodename`, the real browser-authored Playwright flow covers authoring -> publication -> application -> runtime smoke, the shared auth `419` retry defect is fixed, and untouched draft role switches now reapply widget defaults so `rpc.client` remains present.
- Closure validation: focused auth-frontend Vitest passed, focused metahubs-frontend `EntityScriptsTab` coverage passed, the browser-authored Playwright flow passed with `2 passed`, and the final root `pnpm build` finished green with `30 successful`, `27 cached`, and `3m54.625s`.
- No open research thread remains for the 2026-04-05 scripting wave.

## 2026-04-05: Scripting hardening closure follow-up

- Research outcome implemented: the compiler was still acting like a general esbuild entrypoint. Embedded script compilation now enforces an explicit SDK-only boundary by rejecting unsupported static imports plus `require()`, dynamic `import()`, and `import.meta` before bundling.
- Research outcome implemented: browser client scripts were still inheriting too much of the ambient Worker environment. The worker runtime now keeps its bridge internals on private host aliases and disables ambient network, nested-worker, storage, and dynamic-code globals before loading the client bundle.
- Hidden defect found and fixed during the same pass: the isolated-vm bootstrap source used strict-mode-invalid `const eval = undefined` code. Runtime tests now parse generated bootstrap source so the same issue fails loudly.
- No open research thread remains for this scripting hardening closure wave.

## 2026-04-06: Codename JSONB/VLC contract re-audit

- Research outcome: the live source contract now persists codename through one `codename` JSONB/VLC field across the touched metahubs/admin flows; the older mixed-storage notes below are historical, not current-state guidance.
- Verified settings seam: `general.codenameLocalizedEnabled` still exists in admin/metahub settings, route helpers, and template-seed config, but it only controls how many locale entries survive into the persisted VLC payload. When false, `enforceSingleLocaleCodename(...)` keeps only the primary locale instead of flattening codename to plain text or reviving `codename_localized` / `presentation.codename`.
- Verified runtime seam: runtime/application code may still extract primary codename text at request or executable boundaries, but that is a boundary conversion only; it is not a second persisted storage contract.
- Workspace audit result: no source file under `packages/**/base/src` still persists `codename_localized` or `presentation.codename`, and no workspace artifact named `admin-role-codename-localized-contract-20260323.json` exists.
- No open research thread remains for this audit.

## 2026-04-04: Self-hosted post-import schema diff and runtime inheritance regression wave

- Research outcome implemented: the connector destructive-diff bug was caused by identity drift, not by harmless UI-only diff rendering. `@universo/schema-ddl/calculateSchemaDiff(...)` matches physical entities and fields by `entity.id` / `field.id`, not by codename.
- Confirmed-and-fixed root cause: `metahubsController.importFromSnapshot` restored the imported snapshot into a fresh branch through `SnapshotRestoreService`, which remapped entity/attribute/layout IDs to new runtime rows, but originally created the initial publication version from the raw imported snapshot payload instead of serializing the restored live branch. The imported publication baseline now serializes from the restored live branch, keeping executable identity aligned with later publications.
- Confirmed-and-fixed runtime-config seam: eager normalization of sparse catalog runtime config erased the distinction between inheritance and authored catalog overrides. The shared contract now keeps runtime config sparse, introduces explicit `useLayoutOverrides`, and applies layout-like catalog overrides only when that seam is actually enabled.
- Closure validation: focused shared/backend/frontend tests passed, the missing browser-safe `sanitizeCatalogRuntimeViewConfig` export was fixed in `@universo/utils`, `pnpm run build:e2e` finished green (`28/28`), the real Playwright self-hosted generator reran and rewrote the committed fixture, the targeted browser import flow passed on the regenerated snapshot, and the canonical root `pnpm build` finished green (`28/28`).
- No open research thread remains for this regression wave.

## 2026-03-23: Unified codename JSONB architecture revalidation

- Historical note: this section captured the pre-convergence migration gap when the branch still carried mixed codename storage seams.
- Outcome preserved for traceability: it established the approved target of one `codename JSONB` VLC field plus primary-text machine semantics.
- Current truth: the live source has since converged on that storage contract for the touched design-time/admin paths; see the 2026-04-06 re-audit above for the current-state summary.
- Closure update 2026-03-24: the touched backend/frontend request-contract slice is now implemented and validated; no open research thread remains for this specific codename payload seam.

## 2026-03-17: Admin roles / metapanel live-architecture revalidation

- Research outcome: the corrected admin-roles/metapanel plan still had hidden integration gaps against the live repository architecture, mainly around root routing, onboarding completion timing, permission refresh ownership, menu section filtering, and dashboard stats contracts.
- Confirmed root cause: the current app does not use TanStack Query for permission state; `AbilityContextProvider` owns `/auth/permissions` loading and exposes `refreshAbility()`, so query invalidation alone cannot refresh role-driven routing/menu state.
- Confirmed root cause: `OnboardingWizard` currently calls `completeOnboarding()` before the completion screen is shown, which means a `CompletionStep` CTA must first move the authoritative completion mutation out of the wizard instead of calling it a second time.
- Confirmed root cause: the current root route `/` bypasses the main shell and always enters the start flow for authenticated users, so `RegisteredUserGuard` alone cannot redirect post-onboarding users into Metapanel; a dedicated `/start` route plus root resolver is required.
- Confirmed root cause: shell menu rendering is split between `rootMenuItems`, a separate MetaHubs section, and an Admin section derived from `isSuperuser || hasAnyGlobalRole`; filtering only `rootMenuItems` would leave visible sections that the role UX intends to hide.
- Confirmed root cause: Metapanel currently points at a global-users-specific stats endpoint, while the desired cards aggregate multiple domains; this should be promoted to a dedicated admin dashboard stats contract shared with AdminBoard.
- Planning fix applied: the implementation plan is now v3 and explicitly adds `/start` topology, `AbilityContext` refresh, section-aware menu gating, injected privileged system-role provisioning, and a dedicated admin dashboard stats contract.
- No open research thread remains before implementation approval; the next action is user approval or another targeted plan QA pass.

## 2026-03-17: Configurable platform runtime `_upl_*` columns

- Research outcome implemented: the remaining bug was below the metahub/publication layer. Catalog snapshots already preserved disabled `upl.*` states, but runtime application business-table generation still created configurable `_upl_archived*` / `_upl_deleted*` columns unconditionally.
- Confirmed root cause: `@universo/schema-ddl` consumed only `config.systemFields.lifecycleContract`, while applications runtime CRUD/sync helpers still hardcoded `_upl_deleted` predicates and updates for dynamic business tables.
- Implemented fix: one shared `@universo/utils` helper now derives platform archive/delete families from `config.systemFields.fields`, schema-ddl consumes that helper for conditional runtime DDL, and applications-backend consumes the same helper for active-row and soft-delete SQL.
- Regression result: shared utils tests, schema-ddl generator tests, and applications runtime route tests all passed after the fix, and the final root build is green.
- No open research thread remains for this runtime `_upl_*` contract issue.

## 2026-03-17: Catalog tab mixing and basic template layout defaults

- Research outcome implemented: the tab-mixing defect was a scoped-list UX issue, not a backend data-integrity bug. `AttributeList` was using the shared paginated hook with previous-query placeholder reuse enabled while switching between two different scopes inside the same component instance.
- Implemented fix: the scoped attributes view now opts out of `keepPreviousData` on query-key changes and resets page/expanded TABLE state on tab switches so old rows cannot linger in the new scope.
- Research outcome implemented: the unwanted default center-zone columns container came directly from the built-in `basic` template seed data, not from a migration or runtime repair path.
- Implemented fix: the built-in base template now seeds `appNavbar` in the top zone and only `detailsTable` in the center zone for new metahubs; no template version bump or legacy branch was required because the target environment recreates the database from scratch.
- No open research thread remains for this wave.

## 2026-03-17: Disabled system attributes still created runtime `_app_*` columns

- Research outcome implemented: the bug was not in publication snapshot generation and not in schema-ddl itself. Publication snapshots already carried `systemFields.lifecycleContract`, and schema-ddl already omitted `_app_*` lifecycle columns when that contract disabled them.
- Confirmed root cause: the application release-bundle executable payload builder reconstructed entities directly from `snapshot.entities`, which do not carry the top-level publication `systemFields` data. That dropped `config.systemFields.lifecycleContract` before schema generation and caused runtime tables to fall back to default lifecycle columns.
- Implemented fix: `createApplicationReleaseBundle(...)` now hydrates snapshot-level `systemFields` back into each executable entity config before creating the executable payload schema snapshot.
- Regression result: release-bundle tests now assert payload hydration from publication `systemFields`, and application sync route tests now prove the generated schema payload contains the disabled lifecycle contract during publication-driven schema creation.
- No open research thread remains for this runtime lifecycle propagation issue.

## 2026-03-17: Application connector snapshot-hash mismatch

- Research outcome implemented: connector schema creation failed because the publication-side hash producer and the application-side hash verifier were normalizing different snapshot payloads.
- Confirmed root cause: `SnapshotSerializer.normalizeSnapshotForHash(...)` includes `systemFields` and omits absent optional keys, but `normalizePublicationSnapshotForHash(...)` had drifted by omitting `systemFields` and coercing absent optional publication/layout keys to `null`.
- Implemented fix: the applications-backend publication normalization now includes `systemFields` per entity and as normalized top-level metadata before computing the canonical release-bundle snapshot hash, and it preserves serializer-compatible omission semantics for optional keys.
- Regression result: direct release-bundle tests now cover publication snapshots with disabled lifecycle-related `systemFields` and the real layout/widget omitted-key shape that reproduced the runtime mismatch on compiled `dist`.
- No open research thread remains for this connector snapshot-hash issue.

## 2026-03-16: Platform system attributes governance closure

- Research outcome implemented: platform `_upl_*` catalog system attributes no longer depend only on metahub configuration; a global admin policy now decides whether they are configurable, always created, or forced back to platform defaults.
- Confirmed architectural seam: metahubs frontend should not fetch admin settings directly for this feature; the correct contract is backend policy resolution plus list-response `meta` for catalog System views.
- Confirmed UX/root-cause findings: the empty platform action menu was caused by `canDisable: false` in the shared registry, and the row-jump bug was caused by optimistic `moveToFront: true` rather than backend `sort_order` rewrites.
- Routing result implemented: catalog System uses dedicated `/system` routes for both global and hub-scoped catalog views, while legacy `?tab=system` URLs are redirected from the attribute view.
- No open research thread remains for this platform-governance wave.

## 2026-03-16: Metahub catalog system attributes and runtime lifecycle contract planning

- Code audit result: configurable catalog system attributes cannot be implemented safely as a metahub-only change because `_app_*` lifecycle fields are still hardcoded in runtime schema generation and assumed directly in application sync/CRUD routes.
- The critical propagation seam is the publication snapshot pipeline: catalog-level system-field metadata must be serialized explicitly and then resolved into a compact runtime lifecycle contract during publication/app sync.
- The safest scope cut for wave 1 is to make lifecycle families (`published`, `archived`, `deleted` and their `_at` / `_by` companions) configurable while leaving `_app_owner_id`, `_app_access_level`, and baseline `_upl_*` audit infrastructure fixed.
- Recommended runtime rule: derive the lifecycle contract once during publication/app sync and persist it with application sync or release metadata; runtime requests should consume that contract instead of probing live schema shape or hardcoding `_app_deleted` assumptions.
- Template/base seeding and manual catalog creation must share one idempotent `ensureCatalogSystemAttributes(...)` path so default rows cannot drift between builtin templates and interactive creation.
- Frontend planning result: add a dedicated `System` tab, standardize catalog tab order to `Attributes -> System -> Elements -> Settings`, keep `Settings` visible from every catalog sub-view, and expose toggle-only controls for system rows with localized labels and type badges.
- External references used in the planning pass: Context7 Knex guidance, MUI Tabs guidance, TanStack Query invalidation/query-key guidance, PostgreSQL ALTER TABLE behavior, and UP-test Supabase live schema inspection.
- Open decision for implementation review: whether design-time persistence should extend the existing catalog-attribute entity with `isSystem/systemKey/isEnabled` metadata or use a small dedicated side-table if the current schema shape proves too rigid.
- QA refinement conclusion: for this repository, wave 1 should extend `_mhb_attributes` directly rather than introduce a separate side-table, because template seeding, template migration, cleanup, snapshot serialization, and optimistic attribute CRUD already converge on `_mhb_attributes`.
- QA refinement conclusion: any richer system-field registry must reuse `@universo/utils/database/systemFields.ts` as the canonical low-level field-name source and must not duplicate raw `_app_*` / `_upl_*` string constants in a second independent catalog.
- QA refinement conclusion: backend service-level guards are required for reorder/move operations on system rows; UI-only restrictions are not sufficient because attribute ordering and transfer operations already exist in `MetahubAttributesService`.
- QA refinement conclusion: because metahub attribute routes, metahub element validation, snapshot serialization, and runtime application metadata all currently consume generic attribute collections, the implementation must exclude system rows from ordinary attribute/business-field flows by default and serialize them through a dedicated lifecycle metadata channel.

## 2026-03-13: Optional global migration catalog true final closure

- Research outcome implemented: the last remaining gap was not runtime correctness but artifact completeness. `application_release_bundle` now embeds deterministic executable payloads for both baseline and incremental execution instead of checksum-only descriptors.
- The executable payload contract is intentionally deterministic: bundle artifact `schemaSnapshot.generatedAt` is bound to `manifest.generatedAt`, which keeps checksum validation stable across export and import.
- Bundle apply now consumes the embedded artifact payloads on the real execution paths and rejects corrupted payload/checksum combinations before any schema existence checks, diff calculation, or DDL execution begin.
- Validation for this closure wave is complete: `@universo/applications-backend` tests passed (80/80), package lint is green, and the final root `pnpm build` completed green (`27/27`, `2m38.453s`).
- No open research thread remains for this architecture wave.

## 2026-03-13: Optional global migration catalog closure

- Research outcome implemented: the remaining QA gaps were operational closure issues, not missing core architecture.
- `@universo/applications-backend` now exposes a real application release-bundle workflow: publication-backed export emits the canonical `application_release_bundle` contract, and bundle apply reuses the existing schema sync engine instead of creating a second install path.
- Successful publication sync and bundle apply now both persist `installed_release_metadata` through the central `applications.cat_applications` sync-state seam, keeping release/install state out of per-app runtime schemas.
- The last touched raw global-catalog env parser in migrations-platform CLI now uses the shared `@universo/utils` helper, aligning the touched startup/runtime/CLI paths on one parsing contract.
- Mirrored EN/RU operator docs now describe disabled-vs-enabled catalog behavior, release bundles, recovery guidance, and the env flag.
- Validation for this closure wave is complete: utils tests 189, core-backend tests 17, applications-backend release-bundle tests 12 with lint green, migrations-platform tests 49 with lint green, final root `pnpm build` green (`27/27`, `2m37.175s`).
- No open research thread remains for this architecture wave.

## 2026-03-13: QA blocker closure wave

## 2026-03-13: Optional global migration catalog architecture audit

- Code audit: `@universo/core-backend` startup still always calls `syncRegisteredPlatformDefinitionsToCatalog(...)`, so global catalog bootstrap remains in the critical startup path.
- Code audit: runtime application/metahub migrations already write local history into `_app_migrations` / `_mhb_migrations`, but `MigrationManager`, `SystemTableMigrator`, and `MetahubSchemaService` also hard-call `mirrorToGlobalCatalog(...)`, which currently auto-creates `upl_migrations` through `PlatformMigrationCatalog.ensureStorage()`.
- Code audit: fixed system-app schema generation uses `SchemaGenerator.generateFullSchema(...)` directly and does not record local baseline rows, which is why fixed-schema `_app_migrations` tables remain empty in the live database.
- Context7 findings: Knex treats seeds as repeatable data loaders and keeps schema history in migrations; Prisma baselining uses a full `0_init` baseline plus incremental pending migrations, which matches the target direction for exported/file-backed apps.
- Supabase UP-test read-only inspection: `upl_migrations` currently holds 20 `migration_runs`, 215 `definition_registry` rows, 215 `definition_revisions`, 215 `definition_exports`, 215 `definition_drafts`, and 430 `approval_events`; fixed `applications._app_migrations` and `metahubs._app_migrations` exist but have zero rows.
- Planning implication: local per-schema migration history should remain canonical, while the global catalog should become optional observability/export infrastructure behind a feature flag and explicit capability checks.
- Open research thread: implementation must safely degrade CLI/doctor/export commands that currently assume `PlatformMigrationCatalog.isStorageReady()` or definition-registry tables.
- QA refinement finding: the earlier master-plan wording that expected `definition_registry` population on every fresh bootstrap is too strict for the intended architecture and must be replaced with an explicit two-mode acceptance contract.
- QA refinement finding: enabled-mode global audit should remain fail-closed and same-transaction with local history/schema-state persistence; disabled mode may no-op safely, but enabled mode must not silently degrade.
- QA refinement finding: file-bundle release/install metadata should reuse the existing central application sync-state surface in `applications.cat_applications` before any new metadata store is introduced.
- QA refinement finding: the env/config layer should follow the repository’s established small helper pattern in `@universo/utils` first, rather than introducing a broader shared capability abstraction prematurely.

## 2026-03-13: Optional global migration catalog implementation closure

- Research outcome implemented: the repository now supports explicit catalog-enabled and catalog-disabled modes without treating the full global definition registry as a mandatory cold-start dependency.
- `@universo/migrations-platform` now uses `PlatformMigrationKernelCatalog` in disabled mode, preserving `upl_migrations.migration_runs` while keeping definition-registry lifecycle storage behind the feature flag.
- Runtime application/metahub migration writes now preserve local canonical history even when global catalog mirroring is disabled, and enabled mode remains fail-closed by keeping explicit capability checks.
- Fixed system-app schema generation now records deterministic local baseline rows and backfills missing `_app_migrations` baseline history when a schema already exists.
- Central application release/install metadata now reuses `applications.cat_applications.installed_release_metadata`, keeping sync/install state in one canonical persistence surface.
- Validation for this wave is complete: `@universo/schema-ddl` tests green, `@universo/migrations-catalog` tests 36/36 green, `@universo/migrations-platform` tests 101/101 green, and final root `pnpm build` green (`27/27`, `2m41.284s`).
- No open research thread remains for this architecture wave.

## 2026-03-13: QA blocker closure wave

- Research outcome implemented: the still-live blockers were narrow package-level correctness/tooling issues, not missing architecture from the completed system-app program.
- The failing `@universo/migrations-core` validation case was caused by a malformed test owner id; the fix preserved strict managed owner-id validation by correcting the test input to a canonical UUID.
- `@universo/migrations-core` lint now ignores committed/generated `src/**/*.d.ts`, `@universo/schema-ddl` no longer has error-level lint failures, and `@universo/core-backend` again exposes a package-level lint script with warning-only output on the touched surface.
- Validation for this closure wave is complete: `@universo/migrations-core` tests 58/58 + lint green, `@universo/schema-ddl` tests green with warning-only lint, `@universo/core-backend` tests 16/16 with warning-only lint, final root `pnpm build` green (`27/27`, `2m27.925s`).
- No open research thread remains for this blocker-closure wave.

## 2026-03-13: Final QA closure gap audit

- Research outcome implemented: the remaining repository-side gaps were narrow contract and proof issues, not missing architectural waves.
- Profile and admin fixed-system-app manifests now keep string validation limits aligned with their backing `VARCHAR(50)` columns, and shared migrations-platform tests assert that manifest `maxLength` never exceeds declared `VARCHAR(N)` lengths.
- `@universo/applications-backend` now has direct persistence-level regression coverage for `copyApplicationWithOptions(...)`, so copy safety no longer depends only on route-level mocks.
- The core-backend acceptance regression now captures both halves of the final contract: application-like fixed-schema fresh bootstrap and publication-created application runtime sync composition.
- The docs tree now contains mirrored English/Russian architecture docs for fixed system-app convergence, with verified line parity across the touched doc pairs.
- Validation for this closure wave is complete: profile Jest 5/5, admin Jest 3/3, applications persistence Jest 12/12, migrations-platform Jest 35/35, core-backend acceptance Jest 2/2, error-free lint for applications-backend and migrations-platform, warning-only touched lint elsewhere, final root `pnpm build` green (`27/27`, `2m37.515s`).
- No open research thread remains for this final QA closure wave.

## 2026-03-13: QA closure completion revalidation

- Research outcome implemented: four real residual defects remained after the earlier green state, and all were operational contract issues rather than broad architectural failures.
- `@universo/migrations-platform` now records export lifecycle rows for bundle-oriented catalog exports, so CLI export and doctor observe the same active published revision state.
- `@universo/migrations-catalog` and `@universo/migrations-platform` now use stable artifact-equivalence checks, so dependency-only changes are no longer skipped behind checksum-only no-op detection.
- `@universo/utils` now exposes a browser-specific env entry whose precedence is `__UNIVERSO_PUBLIC_ENV__` → `import.meta.env` → `process.env` → browser origin, and `@universo/store` mirrors `import.meta.env` fallback support.
- `@universo/migrations-core` now rejects malformed managed owner ids instead of silently normalizing them into potentially colliding schema-name inputs.
- Validation for this closure wave is complete: `@universo/migrations-catalog` tests 28/28, `@universo/migrations-platform` regressions 64/64, `@universo/utils` env tests 5/5, `@universo/migrations-core` identifiers 8/8, touched-surface lint green, final root `pnpm build` green (`27/27`, `2m39.834s`).
- No open research thread remains for this QA closure completion wave.

## 2026-03-13: QA plan completion revalidation

- Research outcome implemented: the suspected metahubs naming/parity mismatch was not real on the live branch; the parity contract already expects the converged `cat_*` / `doc_*` fixed-schema naming.
- `@universo/migrations-platform` doctor lifecycle checks now treat any export recorded for the active published revision as healthy, while operational sync/export flows still keep explicit export targets.
- Shared backend Jest mapping now resolves `@universo/database`, which restores package-local execution of the metahubs parity contract suite.
- A new core-backend router-level regression now covers publication-created application bootstrap through the composed runtime-sync seam.
- Validation for this closure wave is complete: touched focused Jest suites are green, touched-package lint is green, and final root `pnpm build` is green (`27/27`, `2m39.643s`).
- No open research thread remains for this QA completion wave.

## 2026-03-13: Definition lifecycle closure audit

- Research outcome implemented: the remaining gap was operational, not storage-level — lifecycle tables and helpers already existed, but live imports still bypassed them.
- `@universo/migrations-catalog` now routes active imports through draft creation, review request, and publication, while preserving published lifecycle provenance on unchanged revisions.
- `@universo/migrations-platform` no-op and doctor checks now require published lifecycle provenance in addition to registry checksum/export parity, so pre-fix catalog rows are repaired once.
- Validation for this closure wave is complete: `@universo/migrations-catalog` tests 34/34, `@universo/migrations-platform` tests 98/98, package lint green, final root `pnpm build` green (`27/27`, `2m51.177s`).
- No open research thread remains for this lifecycle closure wave.

## 2026-03-12: Ownership seam and live-start bootstrap investigation

- Research outcome implemented: the publication-derived runtime sync seam now stops at `loadPublishedPublicationRuntimeSource(...)` in `@universo/metahubs-backend`, while `@universo/applications-backend` owns the final sync-context adapter.
- Reproduced and fixed package-level Jest forwarding drift by moving touched backend packages to the shared `tools/testing/backend/run-jest.cjs` wrapper.
- Live startup investigation proved that the remaining bootstrap failures were phase-ordering defects, not only SQL idempotency defects: `OptimizeRlsPolicies1800000000200` and `SeedBuiltinMetahubTemplates1800000000250` both needed `post_schema_generation` registration.
- Live validation now reaches a serving server: after bootstrap, `node ./run start` listens on port 3000 and returns `HTTP/1.1 200 OK` for the root route.
- No open research thread remains for this closure wave; future work should treat live startup smoke as mandatory whenever platform migration phases or fixed-schema bootstrap sequencing change.

## 2026-03-11: System-app unification completion planning audit

- Codebase audit result: the loader/CLI/registry foundation exists, but the completion program still lacks a rich system-app contract, unified schema-target handling across fixed + runtime schemas, runtime application-sync ownership separation, and the deep acceptance test matrix.
- Context7 PostgreSQL 17 guidance confirmed that `SECURITY DEFINER` functions must set a trusted `search_path` explicitly with `pg_temp` last, and should revoke default `PUBLIC` execute privileges before selective grants.
- Context7 TanStack Query guidance confirmed the repository should keep creating a fresh `QueryClient` per test, disable retries in tests, and prefer explicit query-key invalidation patterns.
- Supabase UP-test (`osnvhnawsmyfduygsajj`) currently shows live drift: `profiles` schema exists with zero tables, `public.profiles` still exists, and all `upl_migrations.definition_*` tables are present but empty.
- Supabase UP-test operational defaults observed during planning: transaction pooler on port `6543`, `search_path = "$user", public`, `statement_timeout = 2min`, `lock_timeout = 0`.
- The failed live SQL probe against `upl_migrations.migration_runs.created_at` confirmed that operational tooling must use the real catalog timestamp columns (`_upl_created_at`, `_upl_updated_at`) instead of assuming generic names.
- QA refinement after the first draft of the master plan: exact Metahub schema parity must stay explicit, requirement traceability must remain inside the plan, and future-facing abstractions such as managed custom schemas / rich artifact catalogs must not delay the current parity milestone unless they solve a concrete present-tense requirement.
- Existing frontend reuse patterns confirmed during the QA pass: `MigrationGuardShell`, `ApplicationMigrationGuard`, `MetahubMigrationGuard`, `ConnectorDiffDialog`, `EntityFormDialog`, `DynamicEntityFormDialog`, `CrudDialogs`, `RowActionsMenu`, `useCrudDashboard`, `createEntityActions`, `createMemberActions`, and existing optimistic/query invalidation helpers should be treated as the default UI/CRUD surface.

## 2026-03-07: Optimistic create UX redesign audit

- Existing optimistic create/copy behavior is intentionally immediate in cache **and** immediate in presentation: `ItemCard`, `FlowListTable`, and `CustomizedDataGrid` all react to `__pending` right away instead of deferring visual feedback until user interaction.
- The current shared model has no dedicated concept of “optimistically created but visually normal until touched”; that distinction will need to be introduced at the helper/renderer level without changing backend schemas.
- Metahubs and Applications optimistic create hooks still contain temporary `sortOrder ?? 999` placeholders, while many list renderers still display `sortOrder ?? 0`; this combination is the strongest current explanation for the observed temporary `999` / `0` ordinal artifacts.
- `ElementList` still awaits `createElementMutation.mutateAsync(...)`, confirming that at least one create dialog remains blocking after the earlier fire-and-forget pass.
- `MetahubList` and `ApplicationList` table name cells use direct `Link` rendering, so pending entities in those views do not inherit the shared pending-navigation guard behavior.

## 2026-03-04: Codename QA closure follow-up

- Research outcome implemented: codename retry policy standardized across backend domains using shared constants.
- Added direct unit coverage for codename validation/sanitization (`@universo/utils`) and retry candidate generation (`metahubs-backend` helper).
- No unresolved blocker from this research thread remains.

## 2026-02-10: Application Runtime 404 on Checkbox Update

- Root cause: runtime update requests did not include `catalogId`, so backend defaulted to the first catalog by codename and returned 404 (row not found) for other catalogs.
- Fix: include `catalogId` in runtime cell update payloads to target the correct runtime table.

## 2026-02-03: Display Attribute UX Fixes

- No new external research required; changes were internal UX and default-value adjustments.

## RLS QueryRunner freeze investigation (2026-01-11)

### Observations
- UI can appear to “freeze” after create operations until server restart; server logs show repeated RLS middleware activity (QueryRunner create/connect).

### Code audit (createQueryRunner call sites)
- `@universo/auth-backend`: `ensureAuthWithRls` creates a per-request QueryRunner and releases it on response completion.
- `@universo/auth-backend`: `permissionService` creates a QueryRunner only when one is not provided; releases it in `finally`.
- `@universo/core-backend`: export/import uses QueryRunner with explicit connect + transaction and releases in `finally`.

### Current hypothesis
- The freeze is likely caused by pooled connection contention (too many concurrent requests each holding a per-request QueryRunner) or an edge-case where cleanup/release does not run.
- The middleware cleanup is now guarded to run once per request to reduce cleanup races.

---

## schema-ddl cleanup follow-up (2026-01-19)

### Notes
- Parameterized statement_timeout in `@universo/schema-ddl` locking helper to avoid raw interpolation
- Removed deprecated static wrapper methods in `SchemaGenerator` and `MigrationManager`
- Updated tests to use naming utilities directly

---

## Database pool monitoring (2026-01-31)

### Notes
- Supabase Pool Size observed at 15 connections for the project tier.
- Knex + TypeORM pool budgets aligned to 8 + 7 (total 15).
- Error logging now includes pool state metrics to diagnose exhaustion events.