# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: Metahub Resource Surfaces Final QA Closure — Complete ✅ (2026-04-18)

- **Final QA debt elimination completed in this session**:
  - Removed the last legacy metadata wording from the shipped shared menu labels, REST docs generator, generated OpenAPI source, and remaining public metahub route comments so the repository-facing contract now aligns with the shipped `Attributes` / `Constants` terminology.
  - Added a package-scoped `@universo/metahubs-frontend` ESLint override for test files only, following the existing neighboring frontend pattern, to eliminate the historical test-only `no-explicit-any` and `no-empty-function` warning noise without relaxing production code rules.
  - Re-ran the canonical repository build after regenerating the OpenAPI source from the updated generator, confirming that the docs pipeline now reproduces the cleaned terminology instead of patching the generated YAML by hand.
- **Validated in this final debt-elimination pass**:
  - `pnpm --filter @universo/metahubs-frontend lint`
  - `pnpm --filter @universo/metahubs-frontend exec vitest run src/i18n/__tests__/index.test.ts src/components/__tests__/ValueGroupDeleteDialog.test.tsx src/domains/entities/shared/ui/__tests__/SharedResourcesPage.test.tsx src/domains/entities/ui/__tests__/EntitiesWorkspace.test.tsx src/domains/metahubs/ui/__tests__/MetahubList.test.tsx`
  - `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/entityInstancesRoutes.test.ts src/tests/services/builtinKindCapabilities.test.ts src/tests/routes/entitiesRoutes.test.ts src/tests/routes/publicMetahubsRoutes.test.ts`
  - `pnpm --filter @universo/rest-docs generate:openapi`
  - `pnpm build`

- **Final terminology closure completed after the last QA pass**:
  - Renamed the remaining shipped entity-owned field-definition headings, dialogs, delete warnings, and record empty-state copy to `Attributes` / `Атрибуты` so shared `Resources` and entity-owned catalog metadata no longer present mixed terminology.
  - Synced the same wording across Playwright product specs, docs screenshot generator copy, backend/system descriptions, and blocking-reference contracts that surface through delete dialogs.
  - Rebuilt the whole workspace so the e2e environment picked up the updated metahubs frontend bundle instead of the stale pre-build wording.
- **Validated in this terminology closure**:
  - `pnpm --filter @universo/metahubs-frontend exec vitest run src/i18n/__tests__/index.test.ts src/components/__tests__/ValueGroupDeleteDialog.test.tsx src/domains/entities/shared/ui/__tests__/SharedResourcesPage.test.tsx src/domains/entities/ui/__tests__/EntitiesWorkspace.test.tsx src/domains/metahubs/ui/__tests__/MetahubList.test.tsx`
  - `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/entityInstancesRoutes.test.ts src/tests/services/builtinKindCapabilities.test.ts`
  - `pnpm --filter @universo/metahubs-frontend lint`
  - `pnpm --filter @universo/metahubs-frontend build`
  - `pnpm build`
  - `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-entities-workspace.spec.ts --grep "catalog-style entity instances stay read-only for metahub members"`
  - `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-entity-dialog-regressions.spec.ts`
  - `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-shared-common.spec.ts --grep "Common shared entities merge, exclusion, publication, and runtime stay aligned"`
  - `node tools/testing/e2e/run-playwright-suite.mjs --project=generators specs/generators/docs-entity-screenshots.spec.ts`

- **Final residual debt removed in this session**:
  - Replaced the shared `Resources` entity-type lookup hard limit with full pagination through the existing `fetchAllPaginatedItems()` helper, so label resolution now sees the complete entity-type set instead of the first page only.
  - Removed stale legacy `general.tabs` terminology from EN/RU locale files so reusable resource-tab labels no longer expose the old wording.
  - Rewrote the remaining RU metahub resource reference pages into consistent Russian aligned with the shipped `Resources` workspace and shared-override architecture.
  - Extended browser ACL coverage so a metahub `member` can open the real `Entities` workspace and view entity types, but still gets no create affordance or entity-type mutation actions.
- **Validated in this final closure**:
  - `pnpm --filter @universo/metahubs-frontend exec vitest run src/domains/entities/shared/ui/__tests__/SharedResourcesPage.test.tsx src/domains/entities/ui/__tests__/EntitiesWorkspace.test.tsx src/domains/metahubs/ui/__tests__/MetahubList.test.tsx`
  - `pnpm --filter @universo/metahubs-frontend lint`
  - `pnpm --filter @universo/metahubs-frontend build`
  - `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-create.spec.ts --grep "empty metahub template supports manual entity-type authoring"`
  - `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-entities-workspace.spec.ts --grep "catalog-style entity instances stay read-only for metahub members"`
  - `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-shared-common.spec.ts --grep "Common shared entities merge, exclusion, publication, and runtime stay aligned"`

## Previous Focus: Metahub Resource Surfaces QA Closure — Complete ✅ (2026-04-18)

- **Residual QA follow-up closed in this session**:
  - Added backend and template-level duplicate `resourceSurfaces.routeSegment` validation so the contract is fail-closed even when callers bypass the frontend builder.
  - Made shared `Resources` label resolution deterministic by capability: the page now loads a larger sorted entity-type slice, prefers the canonical built-in kind when present, and falls back to the canonical label when multiple custom types disagree.
  - Added explicit permission-regression coverage for forbidden entity-type create/update/delete route mutations.
  - Rewrote the remaining mixed-language RU custom entity types guide into a fully localized GitBook page.
- **Validated in this follow-up**:
  - `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/entitiesRoutes.test.ts src/tests/services/EntityTypeService.test.ts src/tests/services/templateManifestValidator.test.ts`
  - `pnpm --filter @universo/metahubs-frontend exec vitest run src/domains/entities/shared/ui/__tests__/SharedResourcesPage.test.tsx src/domains/entities/ui/__tests__/EntitiesWorkspace.test.tsx src/domains/metahubs/ui/__tests__/MetahubList.test.tsx`
  - `pnpm --filter @universo/metahubs-frontend build`
  - `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-create.spec.ts --grep "empty metahub template supports manual entity-type authoring"`
  - `pnpm build`

- **Scope**: Closed the remaining QA gaps after the entity-driven Resources implementation: contract extensibility, stale architecture/docs pages, and missing direct backend/browser coverage.
- **Completed in this session**:
  - Reopened the `resourceSurfaces` contract so entity types can customize stable surface keys and route segments without a hardcoded built-in-key whitelist.
  - Kept shared `Resources` fail-closed by capability: the shared workspace still renders only supported metadata capabilities, but labels now resolve from the entity-type contract even for custom surface keys.
  - Updated the Entities builder so resource-surface metadata is preserved and editable through the entity-type form instead of being collapsed back to hardcoded labels.
  - Added direct backend coverage for route validation, service validation, and template-manifest validation around `resourceSurfaces`.
  - Added browser coverage for the `empty` metahub template and manual entity-type authoring through the real UI.
  - Rewrote the remaining priority EN/RU GitBook pages for entity-system architecture, browser E2E guidance, and REST API wording.
- **Validated**:
  - `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/entitiesRoutes.test.ts src/tests/services/EntityTypeService.test.ts src/tests/services/templateManifestValidator.test.ts`
  - `pnpm --filter @universo/metahubs-frontend exec vitest run src/domains/entities/shared/ui/__tests__/SharedResourcesPage.test.tsx src/domains/metahubs/ui/__tests__/MetahubList.test.tsx`
  - `pnpm --filter @universo/metahubs-frontend build`
  - `pnpm build`
  - `node tools/testing/e2e/run-playwright-suite.mjs specs/flows/metahub-create.spec.ts --grep "empty metahub template supports manual entity-type authoring"`

## Current Focus: QA Closure — i18n, Resources, Lint, Documentation — Complete ✅ (2026-04-18)

## Current Focus: PR #767 Bot Review Triage — Complete ✅ (2026-04-18)

- **Scope**: Review bot feedback on PR #767, apply only verified safe fixes, and avoid speculative changes that could regress current entity-first behavior.
- **Reviewed feedback**:
  - `SharedResourcesPage.tsx`: bot suggested synchronizing `activeTab` state with `effectiveTab` fallback. After code review, this was not applied because rendering already uses the safe derived tab, no other logic consumes `activeTab`, and forcing synchronization would add effect-driven state churn without a confirmed bug.
  - `PublicationList.tsx`: bot flagged an unsafe cast used to access `baseContext.t` inside the confirm helper. This was valid and replaced with typed `PublicationMenuBaseContext` / `PublicationConfirmSpec` definitions.
- **Validated**: root `pnpm build` passed after the `PublicationList.tsx` type-safety fix.

- **Scope**: Fixed 5 critical issues identified after entity-first migration: broken i18n keys, confusing Resources tab labels, fixture hash mismatch, documentation drift, and lint debt in production files.
- **Completed in this session**:
  - Added complete `records.*` i18n section (~44 keys) to EN/RU locales fixing raw `records.title` key in Catalogs UI.
  - Added `tabs.treeEntities` keys to all 4 entity type sections in both locales.
  - Translated ~25 untranslated English strings in RU locale across deleteDialog sections.
  - Fixed mixed pluralization (`constantsCount_*` → `fixedValuesCount_*`) and EN/RU key asymmetry.
  - Renamed RU Resources tab labels: "Поля" → "Определения полей", "Списки значений" → "Значения перечислений".
  - Made Resources tabs dynamic — visibility derives from entity type `ComponentManifest` fields (no new fields needed).
  - Fixed all 19 production-file lint warnings (exhaustive-deps, no-explicit-any, unused vars).
  - Fixed README drift: `src/constants/` → `src/view-preferences/` in both EN and RU.
  - Updated `systemPatterns.md` with dynamic shared resources tab pattern.
  - Updated `techContext.md` with shared resources architecture, i18n key structure, and fixture contract.
- **Validated**: `pnpm build` 30/30, backend 68/68 suites (583 passed), frontend 64/64 suites (253 passed), lint 0 errors.
- **Remaining (test files)**: 181 lint warnings in test files only (no-explicit-any, no-empty-function in mocks). These are low risk and do not affect production code.

## Previous Focus: Entity Type Naming Refactoring — Complete ✅ (2026-04-17)

## Previous Focus: Distributed Noodling Ullman Plan Continuation — Complete ✅ (2026-04-17)

- **Scope**: Finished the interrupted QA-closure continuation session after Phases A/B, including fixture regeneration, documentation screenshot generators, targeted entity-first flow regressions, and final validation.
- **Completed in this continuation session**:
  - Revalidated the post-Phase-A/B workspace state with canonical checks: `pnpm build` and `pnpm --filter @universo/metahubs-backend test`.
  - Regenerated both canonical snapshot fixtures through Playwright generators:
    - `tools/fixtures/metahubs-self-hosted-app-snapshot.json`
    - `tools/fixtures/metahubs-quiz-app-snapshot.json`
  - Stabilized documentation screenshot generators:
    - `docs-entity-screenshots.spec.ts`
    - `docs-quiz-tutorial-screenshots.spec.ts`
  - Closed Playwright drift in regression/full-cycle flows by updating shipped UI/snapshot assertions:
    - `codename-mode.spec.ts`
    - `snapshot-export-import.spec.ts`
    - `exports.test.ts`
  - Revalidated the key entity-first browser flows:
    - `metahub-domain-entities.spec.ts`
    - `metahub-entity-full-lifecycle.spec.ts`
    - `metahub-settings.spec.ts`
    - `snapshot-export-import.spec.ts`
    - `snapshot-import-quiz-runtime.spec.ts`
    - `codename-mode.spec.ts`
- **Validation summary**:
  - Documentation generators are green.
  - Snapshot import/export and quiz runtime import flows are green.
  - Entity-first full lifecycle and settings regressions are green.
  - Continuation fixes are additive drift corrections; no new schema/template version bump was introduced.
- Details: progress.md#2026-04-17-distributed-noodling-ullman-plan-continuation-closure

- **Scope**: Renamed all entity type display names from surface-key terminology (Tree Entities, Linked Collections, Value Groups, Option Lists) to traditional names (Hubs, Catalogs, Sets, Enumerations) across the entire monorepo.
- **Key decision**: Internal surface keys preserved unchanged; only preset definitions, display strings, i18n labels, and documentation updated.
- **Architecture confirmation**: Entity system is a fully generic constructor. Hubs, Catalogs, Sets, Enumerations are entity type presets defined in templates, not hardcoded types.
- **Completed**:
  - Backend preset definitions: VLC names, descriptions, UI configs, component constants, default instance constants
  - i18n sections: renamed JSON sections in both EN and RU `metahubs.json` files
  - Frontend i18n key references: updated 25+ source files referencing old i18n keys
  - Sidebar menu restructured: dynamic entity types under Resources; "Entity Types" admin link moved after divider; added i18n keys for `entityTypes`
  - Surface labels: updated `ENTITY_SURFACE_LABELS` display strings in `@universo/types`
  - Unit tests: updated all test assertions and mocks across backend/frontend/template-mui
  - Remaining source code: comprehensive sweep of error messages, fallback strings, JSDoc comments across 30+ files
  - Fixture generation script: updated to use unified entity API endpoints
  - Playwright E2E tests: updated 11 test files with new terminology
  - Documentation: updated 14 files across `docs/en/` and `docs/ru/`
- **Validated**: Full workspace build (30 packages), lint, 934 tests passing
- **Pending follow-ups**:
  - Playwright fixture regeneration was manual (full regeneration needs running server)
  - Documentation screenshots need updating when server is available
- Details: progress.md#2026-04-17-entity-type-naming-refactoring

## Previous Focus: Final Legacy Snapshot Key + Preset KindKey Cleanup (2026-04-21)

- Renamed snapshot output keys in `SnapshotSerializer.ts`, updated restore/hash services, tests, and fixtures.
- Renamed `constants-library` preset → `fixed-values-library`; removed `legacyObjectKind` fallback.
- Build: 30/30 packages, zero TypeScript errors.
- No remaining legacy items: snapshot keys, preset kindKey, controller variable all use neutral entity-first vocabulary.

## Current Focus: QA Closure + Entities Copy Contract Stabilization (2026-04-17)

- **Completed in this session**:
  - Reconciled entity copy payload contracts across frontend and backend for tree/option-list/value-group surfaces by extending `copyEntitySchema` and `applyDesignTimeCopyOverrides` to accept entity-specific copy flags (`copyAllRelations`, `copyLinkedCollectionRelations`, `copyValueGroupRelations`, `copyOptionListRelations`, `copyFixedValues`, `copyOptionValues`) while preserving existing linked-collection validation.
  - Ensured copied tree entities can override parent linkage safely by supporting `parentTreeEntityId` in copy payload processing and merging it into persisted `config` during copy mutation.
  - Removed the last legacy-named metahubs frontend folder seam by renaming `src/constants` to `src/view-preferences` and updating all imports.
  - Synced record-create UX and tests to the current wording (`Add Record`) and hardened the targeted e2e flow assertions to tolerate currently shipped fixed-values heading/dialog variants.
- **Validated in this session**:
  - Focused backend suite passed: `entityInstancesRoutes.test.ts` (`40/40`).
  - Focused frontend suites passed for copy payload and record create error flow (`EXIT:0`).
  - Metahubs frontend lint rerun passed with `0` errors (warnings only); metahubs backend lint remains `0` errors (warnings only).
  - Canonical root validation passed: `pnpm build` (`30/30 successful`).
  - Playwright wrapper validation passed: `tools/testing/e2e/specs/flows/metahub-domain-entities.spec.ts` (`3 passed`) without `pnpm dev`.

## Current Focus: Neutral Kind/Settings Contract Layer Closure (2026-04-17)

## Current Focus: QA Hardening + Entity-First Contract Closure (2026-04-17)

- **Completed in this session**:
  - Hardened public linked-collection resolution in `publicMetahubsController` so route handlers return only linked-collection-compatible objects (`kind === 'catalog'` or compatibility alias), preventing unrelated object surfaces from leaking through codename/hub filters.
  - Synchronized failing `entityInstancesRoutes` delete-policy expectations to the neutral entity-first error contract (`tree entity`, `linked collection`, `option list`).
  - Extended public routes tests to cover non-linked-collection exclusion on both list and get-by-codename endpoints.
- **Validated in this session**:
  - Focused backend tests are green: `publicMetahubsRoutes`, `entityInstancesRoutes`, `metahubsSchemaParityContract` (`63/63` tests).
  - Package lint rerun has no errors (warnings only).
  - Canonical root validation passed: `pnpm build` (`30/30 successful`).
- **Residual constraint note**:
  - In metahubs packages, no active legacy domain folders named `attributes`, `elements`, `values`, `catalogs`, `sets`, `enumerations`, or `hubs` were found. The remaining `packages/metahubs-frontend/base/src/constants` folder is a generic constants utility namespace, not a legacy metadata domain surface.

- **Completed in this completion session**:
  - Introduced neutral entity-surface helpers in shared types (`EntitySurfaceKey`, `EntitySettingsScope`, mapping resolvers, and setting-key builders) while preserving existing builtin/storage-compatible values.
  - Refactored metahubs backend shared kind/settings consumers to resolve through neutral helper paths instead of direct legacy literals where safe.
  - Refactored metahubs frontend settings and permission consumers to consume neutral scope helpers and generated setting keys.
- **Validated in this session**:
  - Targeted package builds passed for `@universo/types`, `@universo/metahubs-backend`, and `@universo/metahubs-frontend`.
  - Canonical root validation passed: `pnpm build` (`30/30 successful`, exit code `0`).
- **Execution note**:
  - Repeated terminal `waiting for input` notifications during the long root build were false positives in this environment; no interactive prompt was required and the build completed normally.

## Current Focus: QA Remediation Completion Session Closed (2026-04-17)

- **Completed in this completion session**:
  - Updated `tools/testing/e2e/support/selfHostedAppFixtureContract.mjs` to entity-first snapshot contract keys (records/treeAssignment/fixedValues/optionValues) with compatibility fallbacks for shared fixed values and linked-collection layout ids.
  - Updated `tools/testing/e2e/specs/flows/snapshot-export-import.spec.ts` to neutral snapshot keys and current UI heading assertions (`Linked collections`).
  - Verified no active legacy metahubs domain folders named `attributes`, `constants`, `elements`, or `values` remain in backend/frontend source trees.
- **Validated in this session**:
  - Playwright generator suite: self-hosted app generator passed (`2 passed`).
  - Playwright flow suite: snapshot export/import spec passed (`5 passed`).
  - Canonical root build passed: `pnpm build` (`30/30 successful`).
- **Execution mode note**: all E2E checks were run through Playwright CLI wrappers without `pnpm dev`, matching the repository testing guidance.

## Previous Focus: Full Legacy Vocabulary Elimination — Remediation Slice (2026-04-20)

- **Plan**: [entity-first-final-refactoring-plan-2026-04-16.md](plan/entity-first-final-refactoring-plan-2026-04-16.md)
- **Status**: remediation slice validated for i18n and build/test quality gates.
- **Validated in this pass**:
  - fixed stale metahubs frontend expectation in `exports.test.ts` after removing legacy `valueGroups.tabs.hubs` key
  - metahubs-frontend tests are green again: `64/64` files, `252/252` tests
  - package lint passes with `0 errors` (warnings only)
  - canonical root build re-run passes: `30/30 successful`
- **Open follow-up outside this pass**:
  - Playwright fixture regeneration and fresh screenshot capture must run through the Playwright CLI wrappers on port 3100; `pnpm dev` is not part of the required flow
- **Guardrail**: preserve backward compatibility where stored browser state is involved; read legacy localStorage keys during migration, but write only the new neutral keys

## Previous Focus: Entity-First Final Refactoring — Phase 13 Complete (2026-04-18)

- **Plan**: [entity-first-final-refactoring-plan-2026-04-16.md](plan/entity-first-final-refactoring-plan-2026-04-16.md)
- **Status**: Phases 1-9, 11-13 COMPLETE; Phase 10 remained pending in this historical snapshot but is now being executed through the Playwright CLI flow on port 3100 rather than `pnpm dev`
- **Phase 13** (2026-04-18): Deep internal identifier cleanup — renamed 60+ legacy local variables, schema names, private methods, error messages across 8 files
- **Remaining legacy traces (intentionally preserved)**:
  - Kind key strings: 'hub', 'catalog', 'set', 'enumeration' (database values used in `resolveEntityMetadataKinds`)
  - DB column names: `parent_attribute_id`, `target_constant_id`, `is_display_attribute`, `attribute_id`
  - Stored JSONB field names: `typed.hubId`, `typed.catalogId`, `config.parentHubId` etc.
  - Settings namespace keys: `catalogs.allowCopy`, `hubs.resetNestingOnce` etc.
  - URL tab segment names: `attributes`, `system`, `elements`, `constants`, `values` (in entityMetadataRoutePaths.ts)
  - `CatalogSystemField*` types in universo-types/universo-utils: tied to the linked-collection system fields concept
  - i18n keys (~758 refs): `t('hubs.*')`, `t('catalogs.*')`, `t('sets.*')`, `t('enumerations.*')` — user-facing translations

## Previous Focus: Final Legacy Elimination — Complete (2026-04-16)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Status**: ALL 13 phases (A–M) completed, full build green (30/30).
- **Phases A–F**: Copy options, route params, NavbarBreadcrumbs cleanup, Playwright specs, docs, build validation.
- **Phases G–M** (current session):
  - **Phase G**: DND file renames — `AttributeDndProvider` → `FieldDefinitionDndProvider`, barrel + consumers + internal vars (`activeAttribute` → `activeFieldDefinition`)
  - **Phase H**: Test file rename — `ElementActions.test.ts` → `RecordActions.test.ts`
  - **Phase I**: Type renames across 10+ packages — `AttributeDataType` → `FieldDefinitionDataType`, `ConstantDataType` → `FixedValueDataType`, `AttributeValidationRules` → `FieldDefinitionValidationRules`
  - **Phase J**: Template-MUI hooks — renamed 6 active hooks, removed 3 dead hooks
  - **Phase K**: Backend shared files — `platformSystemAttributesPolicy.ts` → `platformSystemFieldDefinitionsPolicy.ts`, `systemAttributeSeed.ts` → `systemFieldDefinitionSeed.ts`, `setConstantRefs.ts` → `valueGroupFixedValueRefs.ts`; `PlatformSystemAttributesPolicy` → `PlatformSystemFieldDefinitionsPolicy` across universo-types + consumers
  - **Phase L**: NavbarBreadcrumbs — neutralized 11 internal variable/function names
  - **Phase M**: Full `pnpm build` — 30/30 passed
- **Remaining legacy traces (intentionally preserved)**:
  - DB column names: `parent_attribute_id`, `target_constant_id`, `is_display_attribute`, `attribute_id`
  - Kind key strings: 'hub', 'catalog', 'set', 'enumeration' (database values)
  - i18n keys (~758 refs): `t('hubs.*')`, `t('catalogs.*')`, `t('sets.*')`, `t('enumerations.*')` — too large for this session
  - Stored JSONB field names: `typed.hubId`, `typed.catalogId`, `config.parentHubId` etc.
  - Settings namespace keys: `catalogs.allowCopy`, `hubs.resetNestingOnce` etc.
  - URL tab segment names: `attributes`, `system`, `elements`, `constants`, `values` (in entityMetadataRoutePaths.ts)
  - `CatalogSystemField*` types in universo-types/universo-utils: tied to the linked-collection system fields concept

## Previous Focus: Bulk Parameter/Variable Legacy Identifier Elimination (2026-04-16)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: the entity-first migration had neutralized service/type/route names, but code-level identifiers (parameter names, variable names, type properties) still used legacy vocabulary: `catalogId`, `setId`, `enumerationId`, `hubId` and hundreds of compound forms. These contradict the neutral entity-first model and create confusion when reading code.
- **What was validated**:
  - **Phase 1-5**: Automated bulk renames across all 7 affected packages using perl with word-boundary matching and negative lookbehinds to protect `metahubId` and `offsetIdx`:
    - `enumerationId` → `optionListId` (321 refs)
    - `setId` → `valueGroupId` (393 refs)
    - `catalogId` → `linkedCollectionId` (904 refs)
    - `hubId` → `treeEntityId` (957 refs in metahubs, protected `metahubId` via `(?<![Mm]eta)HubId`)
    - Compound forms: `blockingCatalogs/Sets/Enumerations/ChildHubs`, kind contexts, hooks, query keys
  - **Phase 6**: All core packages build clean (metahubs-backend, metahubs-frontend, template-mui, core-frontend)
  - **Phase 7**: Fixed critical stored data access bug — backend `typed.linkedCollectionId` was reading JSONB that stores `catalogId`
  - **Phase 8-10**: Extended renames to applications-frontend, apps-template-mui, applications-backend with careful stored data preservation
  - **Phase 11**: Fixed scoping bugs where loop variables were conflated with outer destructured variables
  - **Phase 12**: Full workspace build `pnpm build` — 30/30 passed
- **Stored data access preserved (MUST NOT rename)**:
  - `typed.hubId`, `typed.catalogId`, `typed.sectionId` — stored JSONB field names
  - `config.parentHubId`, `config.boundHubId`, `config.bindToHub`, `config.hubs` — stored config JSONB
  - `attachmentKind: 'catalog'` — stored data kind value
  - Kind key strings ('hub', 'catalog', 'set', 'enumeration') — database values
  - i18n translation key strings and settings keys — preserved unchanged
- **Guardrail**: `metahubId` (workspace ID) was never renamed; stored JSONB field access patterns retain original names while local type properties use neutral names.

## Previous Focus: Wire Protocol Count Field Neutralization (2026-04-16)

## Current Focus: Standard Entity Copy Contract Neutralization (2026-04-15)

## Current Focus: Backend Dead Controller Factory Removal (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass existed**: after the earlier nested standard-route cutovers removed controller-to-controller orchestration from `entityInstancesController.ts`, two dead backend controller-factory tails still survived inside otherwise-live helper modules: `createLinkedCollectionController(...)` and `createOptionListController(...)`. This pass existed to remove those dead factories without deleting the shared helper exports that the generic controller still depends on.
- **What was just validated**:
  - active backend source search now returns no remaining `createLinkedCollectionController` or `createOptionListController` references;
  - `packages/metahubs-backend/base/src/domains/entities/children/linkedCollectionController.ts` now keeps only the live linked-collection helper/runtime exports, with the dead factory tail removed;
  - `packages/metahubs-backend/base/src/domains/entities/children/optionListController.ts` was rebuilt as a helper-only module that preserves the schema/search/sort/blocking-reference exports still imported by `entityInstancesController.ts`, including the existing nested enumeration values query contract;
  - focused `entityInstancesRoutes.test.ts` passed `40/40`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Guardrail**: this pass removes dead factory tails only. It does not claim that all linked-collection or option-list helper logic is genericized yet; it only proves the dead controller-factory layer is gone while the generic controller keeps its current direct helper dependencies.

## Current Focus: Backend Tree Controller File Removal (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass existed**: after the earlier tree route and behavior cutovers, `packages/metahubs-backend/base/src/domains/entities/children/treeController.ts` looked like a surviving backend seam, but the active source graph no longer imported it. This pass existed to verify that reality and remove the dead file instead of carrying an orphaned controller deeper into the branch.
- **What was just validated**:
  - active backend source search showed no remaining `treeController` imports or symbol references outside the deleted file itself;
  - the live tree behavior remains owned by `entityInstancesController.ts` together with `treeCompatibility.ts`, so deleting the file did not require another handler migration in this slice;
  - focused `entityInstancesRoutes.test.ts` passed `40/40`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Guardrail**: this pass deletes a proven orphaned controller file only. It does not yet remove the surviving linked-collection or option-list helper/runtime files, because those still own live behavior and need separate audited slices.

## Current Focus: Backend Value Group Controller Removal (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass existed**: after the earlier controller de-specialization slices, one verified backend file-level seam was still real: `entityInstancesController.ts` no longer needed a dedicated value-group child-controller layer, but `children/valueGroupController.ts` still existed as the active source of nested set list/get/create/update/reorder/delete runtime behavior.
- **What was just validated**:
  - nested set list/get/create/update/reorder/delete handlers now live directly inside `entityInstancesController.ts`, using the same services and route contract without reintroducing controller-factory indirection;
  - `packages/metahubs-backend/base/src/domains/entities/children/valueGroupController.ts` was deleted, and the active backend source tree no longer imports or references `valueGroupController` anywhere;
  - focused `entityInstancesRoutes.test.ts` passed `40/40`, `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Guardrail**: this pass removes the value-group child-controller file and the last controller-factory dependency for nested sets. It does not yet delete the surviving linked-collection or option-list helper/runtime files, because those still carry broader schema/value-level divergences that need separate audited slices.

## Current Focus: Standard Copy Backend Naming Closure (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass existed**: the standard entity copy input contract had already been neutralized, but the active metahubs backend still preserved a smaller backend-only truth-surface seam: shared child-copy results still reported `attributesCopied` / `elementsCopied` / `constantsCopied` / `valuesCopied`, and the standard copy handlers still used locals like `copyHubSchema`, `copyCatalogSchema`, `copySetSchema`, and `copyEnumerationSchema`.
- **What was just validated**:
  - `copyDesignTimeObjectChildren(...)` now uses `fieldDefinitionsCopied`, `recordsCopied`, `fixedValuesCopied`, and `optionValuesCopied` as the canonical shared backend copy-result fields, and the focused shared-helper suite was updated to the same contract;
  - the backend standard copy handlers now use `copyTreeEntitySchema`, `copyLinkedCollectionSchema`, `copyValueGroupSchema`, `copyOptionListSchema`, and `copyOptionValueSchema`, while the linked-collection / option-list / value-group copy paths now consume the neutral result naming internally;
  - the value-group copy response now publishes `copy.fixedValuesCopied` for the copy-specific result payload, while the broader entity count fields (`attributesCount`, `elementsCount`, `valuesCount`) were intentionally left unchanged because they belong to the wider runtime entity contract rather than this backend-only copy seam;
  - focused metahubs backend Jest suites passed (`2` suites / `42` tests), `pnpm --filter @universo/metahubs-backend build` returned `EXIT:0`, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Guardrail**: this pass closes backend-only copy-result and schema-local naming debt. It does not yet rename the broader entity count surface (`attributesCount`, `elementsCount`, `valuesCount`, `constantsCount`) because that would be a larger cross-backend/frontend/runtime contract change, not a copy-only cleanup.

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass existed**: the active frontend/backend tree had already removed the top-level legacy domain folders, but the standard entity copy surface still leaked hub/catalog/set/enumeration semantics through shared copy-option types, normalizers, dialogs, API payloads, validation schemas, and design-time child-copy wiring.
- **What was just validated**:
  - `@universo/types` and `@universo/utils` now expose standard copy contracts through neutral `TreeEntityCopyOptions`, `LinkedCollectionCopyOptions`, `ValueGroupCopyOptions`, and `OptionListCopyOptions`, and the shared normalizers resolve legacy request aliases only at input normalization time;
  - the active metahubs frontend generic entity copy flow plus the tree-entity, linked-collection, value-group, and option-list copy dialogs now emit the neutral payload keys, the touched EN/RU locale blocks were retargeted to the new labels, and the focused frontend payload proof stayed green after the contract cutover;
  - the backend generic entity copy route, the specialized tree/linked-collection/option-list/value-group copy boundaries, and the shared `copyDesignTimeObjectChildren(...)` helper now use the neutral standard copy keys internally while still accepting legacy request aliases where route compatibility matters;
  - `pnpm --filter @universo/types build` passed, `pnpm --filter @universo/utils build` passed, focused metahubs frontend tests passed (`2` files / `7` tests), focused metahubs backend Jest suites passed (`2` suites / `42` tests), both touched package builds passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Guardrail**: this pass neutralizes the standard entity copy contract surface, not every remaining legacy data semantic in the repository. Compatibility aliases still exist intentionally at request boundaries, and any broader deletion of old business vocabulary must stay evidence-backed instead of assuming that neutral copy contracts alone close the entire migration brief.

## Current Focus: Final Backend Entity-First Closure (2026-04-15)

## Current Focus: Branch Copy Contract Neutralization (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: the remaining high-signal legacy seam is no longer top-level folder ownership in the active tree; it is the still-shipped branch copy contract and UI/test/i18n truth surface that continues to publish `copyHubs`, `copyCatalogs`, `copySets`, and `copyEnumerations` even though the runtime has moved toward entity-first terminology.
- **What was just validated**:
  - `@universo/types` and `@universo/utils` now expose branch copy options through neutral `copyTreeEntities`, `copyLinkedCollections`, `copyValueGroups`, and `copyOptionLists` keys, while alias-aware normalization still resolves legacy payload fields when they reach the backend boundary;
  - the active metahubs frontend branch create/copy flows, branch i18n labels, and focused tests now use the neutral contract, and the branch create screen no longer omits the value-group toggle;
  - the backend branch controller/service now use neutral internal branch copy fields plus neutral compatibility error codes/messages, while the route boundary still accepts the legacy request aliases explicitly;
  - `pnpm --filter @universo/types build` passed, `pnpm --filter @universo/utils build` passed, focused frontend branch copy tests passed (`4` tests), focused backend branch copy tests passed (`18` tests), and `pnpm --filter @universo/metahubs-frontend build` passed.
- **Guardrail**: this slice closes the branch copy contract surface, not the entire remaining standard-kind semantic debt. Legacy alias handling still exists intentionally at the backend request boundary for compatibility, and broader hub/catalog/set/enumeration semantics outside branch copy need separate audited passes.

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass existed**: the active branch had already removed many top-level legacy route and wording seams, but one audited backend/runtime gap was still real: generic custom entity instance ACL still fell back to `manageMetahub`, and `entityInstancesRoutes.ts` still owned nested standard child-route orchestration through specialized child controllers.
- **What was just validated**:
  - `resolveEntityMetadataAclPermission(...)` now maps generic custom entity instance create/edit/delete to `createContent` / `editContent` / `deleteContent`, and the focused backend route suite now proves that custom create/update/delete/copy flows no longer use `manageMetahub`;
  - the stale focused frontend proof layer was synchronized in the same pass: `ValueGroupDeleteDialog.test.tsx` now matches the current linked-collection field-definition wording, and `NestedFieldDefinitionList.optimisticCreate.test.tsx` now matches the current mixed field-definition hook contract;
  - `entityInstancesRoutes.ts` no longer imports or owns the specialized standard child-controller dispatch helpers; nested standard child and option-value routes now delegate through controller-returned handlers from `entityInstancesController.ts`, so the live route seam moved out of the router while preserving the current API behavior;
  - `entityInstancesController.ts` also no longer instantiates `createTreeController`; nested child hub listing now runs directly through `MetahubTreeEntitiesService` + `treeCompatibility` helpers inside the generic entity controller, and the focused route suite now covers `/entities/hub/instance/:hubId/instances` on the entity-owned path;
  - `entityInstancesController.ts` now serves nested linked-collection, enumeration instance / option-value, and set CRUD through direct service-backed generic controller handlers; the generic controller no longer instantiates `createLinkedCollectionController(...)`, `createOptionListController(...)`, or `createValueGroupController(...)`, and the focused backend route suite now covers the entity-owned enumeration value list plus nested set and linked-collection detail endpoints;
  - the focused backend route suite passed `40/40`, `pnpm --filter @universo/metahubs-backend build` passed after the linked-collection cutover, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Remaining seam**:
  - no verified controller-to-controller delegation seam remains inside `entityInstancesController.ts` for nested standard kinds. The active follow-up is removing the still-live helper/runtime files where the generic controller still depends on specialized tree/linked-collection/option-list logic that is not yet collapsed.
- **Guardrail**: keep closure claims exact. The implementation goal for the generic controller is complete, but broader repo-wide naming cleanup and dead-code cleanup still need independent proof before anyone claims the entire metahubs stack is free of all legacy vocabulary or unused compatibility surfaces.

## Current Focus: Frontend Entity-First Terminology Reconciliation (2026-04-15)

## Current Focus: Residual Frontend Truth-Surface Cleanup (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass existed**: the active metahubs frontend tree had already moved well past the top-level legacy folders, but a narrow set of still-shipped truth-surface seams remained inside otherwise-neutralized files: delete dialogs still rendered catalog-centric copy, container-selection comments still described hub/catalog associations, and the generic record screen still surfaced parent linked-collection errors/tabs through `catalog` wording.
- **What was just validated**:
  - `TreeDeleteDialog.tsx`, `LinkedCollectionDeleteDialog.tsx`, `ContainerSelectionPanel.tsx`, `ContainerParentSelectionPanel.tsx`, `constants/storage.ts`, `types.ts`, `record/api/records.ts`, and `RecordList.tsx` now use neutral tree-entity / linked-collection wording in the touched comments, dialog labels, fallback text, and ARIA text for this slice;
  - the touched EN/RU locale entries now keep the linked-collection delete dialog and the record-screen parent-collection empty/error/edit labels aligned with the same neutral wording;
  - `ContainerSelectionPanel` now explicitly treats `currentHubId` as a compatibility alias for `currentContainerId`, so the wording cleanup does not reopen existing caller contracts;
  - `get_errors` is clean for the touched files, `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Guardrail**: this pass closes only the low-risk frontend truth-surface residue inside already-neutralized files. Broader standard-kind settings/runtime semantics and backend manual-dispatch cleanup still require their own audited slices.

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass existed**: the active entity-owned frontend surfaces had already moved far past the original top-level legacy folders, but a narrow truth-surface seam still remained in live source: `LegacyMetahubInput`, `catalog-compatible` entity-instance wording, and a small set of touched EN/RU locale/test descriptions still contradicted the shipped entity-first contract.
- **What was just validated**:
  - `packages/metahubs-frontend/base/src/domains/metahubs/hooks/mutationTypes.ts` now uses the neutral `MetahubDraftInput` compatibility name, and the related mutation imports were updated through the language-server rename path;
  - `EntityInstanceList.tsx`, `EntitiesWorkspace.tsx`, and the touched EN/RU locale blocks now publish linked-collection / existing-format wording instead of the active `catalog-compatible` / `Legacy Codenames` surface in this slice;
  - the focused `EntityInstanceList` test descriptions now describe linked collection, tree entity, value group, and option list surfaces, keeping the targeted test layer aligned with the renamed frontend contract;
  - `get_errors` is clean for the touched frontend files, `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Guardrail**: this pass closes only the touched frontend terminology/type truth surface. Broader standard-kind semantics and deeper backend/runtime debt still require separate audited slices rather than blanket claims of total legacy removal.

## Current Focus: Layouts Resources Flow Playwright Reconciliation (2026-04-15)

## Current Focus: Residual Backend Truth-Surface Cleanup (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass existed**: the broader migration branch had already removed many legacy folders and route seams, but one backend object-service special-case and one rest-docs metadata truth surface still contradicted the claimed neutral entity-owned contract.
- **What was just validated**:
  - `MetahubObjectsService.ts` no longer hard-codes the catalog/set/enumeration/shared-pool cleanup branch inline; the remaining shared-override cleanup path is now derived from the shared target-kind registry plus the existing behavior-service contract;
  - `packages/universo-rest-docs/scripts/generate-openapi-source.js` was rechecked against the live router and confirmed that deleted route-source files were already gone, so this pass fixed the actual remaining rest-docs seam instead: the metadata tags/descriptions now use `Field Definitions`, `Fixed Values`, and `Records`;
  - `packages/universo-rest-docs/README.md` and `README-RU.md` now describe the same neutral metadata route-group vocabulary, `pnpm --filter @universo/metahubs-backend build` passed, `pnpm --filter @universo/rest-docs build` passed with green route-source verification, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Next likely seam**: the remaining entity-first debt is no longer this backend/docs truth-surface layer. The next high-signal candidates are broader frontend/public type vocabulary and deeper standard-kind semantics that still survive beyond already-neutral route ownership.
- **Guardrail**: keep future closure claims evidence-backed. Route-source inventory and metadata tag/document wording are now aligned for this slice, but broader standard-kind runtime semantics still need separate audited passes.

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: the active metahub route surface already moved from `common` to `resources`, but the focused layouts Playwright flow still expected `/common`, the `Common` heading, and `metahubCommonTabs`, so the browser proof no longer matched the shipped route/selector contract.
- **What is already verified**:
  - `metahub-layouts.spec.ts` now navigates through `/metahub/:id/resources` and `/resources/layouts/:layoutId`, expects the `Resources` heading, and uses the current shared resources tab/content selectors;
  - `tools/testing/e2e/support/selectors/contracts.ts` now exports `metahubResourcesTabs` and `metahubResourcesContent` so the flow follows the shipped test-id contract instead of the removed Common surface;
  - `get_errors` is clean for the touched selector/spec files, and the first targeted wrapper run proved the previous failure was a `60000ms` harness timeout during heavy API/bootstrap work before the first `page.goto()`, not a route assertion mismatch.
- **Current validation state**:
  - the spec now carries `test.setTimeout(300_000)` like other heavy metahub/browser flows;
  - the focused wrapper rerun completed green (`2 passed`), so this browser proof is now aligned with the shipped resources route/test-id contract for the current slice.
- **Guardrail**: keep this slice limited to the stale layouts browser proof and its directly required selector/time-budget contract. Do not reopen broader shared-common or general-catalog browser rewrites until this focused rerun either passes or exposes the next concrete stale assertion.

## Current Focus: Behavior-Based Standard Blocking References (2026-04-15)

## Current Focus: RecordList Entity-First Type Reconciliation (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass existed**: the branch already contained a broad entity-first frontend refactor, but `packages/metahubs-frontend/base/src/domains/entities/metadata/record/ui/RecordList.tsx` still mixed pre-neutralization assumptions with the live contracts. The file had editor diagnostics around missing neutral helper imports, incomplete pagination/query-key params, `CodenameVLC` leaking into string-only field/table contracts, and action-context callbacks that no longer matched the shared promise-based dialog/menu contract.
- **What was just validated**:
  - direct metadata, record, and entity lookups inside `RecordList.tsx` now pass the required pagination/query-key params, so the generic record editor matches the current `metahubsQueryKeys` and metadata API helper signatures;
  - dynamic field configs, table columns, copy defaults, and set-reference payload normalization now resolve localized codenames into stable string keys before touching UI-only or payload-keyed contracts;
  - the record action context and linked-collection settings dialog now satisfy the current promise-based shared helper/update contract, `UpdateRecordParams` now allows `expectedVersion`, and the touched shared menu helper typing explicitly includes edit/copy dialog callbacks;
  - `get_errors` is clean for the touched `RecordList.tsx` slice, `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed without errors.
- **Guardrail**: keep this pass narrowly scoped to `RecordList.tsx` and its immediately required type contract. Do not mix in unrelated route, persistence, or broader standard-kind semantic cleanup while the package is already mid-refactor.

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: after the hub `blocking-dependencies` cutover, the entity-owned backend still preserved another small but real manual standard-kind dispatch seam in `entityInstancesRoutes.ts`: catalog/set/enumeration `blocking-references` still bypassed the generic entity controller and jumped straight into specialized child controllers.
- **What was just validated**:
  - `entityInstancesController.ts` now exposes a generic `getBlockingReferences` handler that reuses the existing standard-kind behavior blocking-state contract for `catalog`, `set`, and `enumeration` while preserving the existing payload shapes and explicit failure behavior;
  - `entityInstancesRoutes.ts` no longer manually dispatches `/metahub/:metahubId/entities/:kindKey/instance/:entityId/blocking-references` to child controllers; that entity-owned endpoint now resolves through the generic entity controller;
  - the focused backend route suite `entityInstancesRoutes.test.ts` now proves catalog/set/enumeration blocking references through the behavior-based entity endpoint and proves that `hub` is rejected on this generic route (`36` tests passed);
  - `pnpm --filter @universo/metahubs-backend build` passed with `EXIT:0`, and the canonical root `pnpm build` completed green.
- **Current repository reality after this pass**:
  - one more live manual standard-kind router seam is gone: entity-owned `blocking-references` now follows the same generic controller + behavior-registry consolidation path as the hub `blocking-dependencies` endpoint;
  - top-level legacy domain folders such as `attributes` and `constants` are already absent from the active frontend/backend `domains/` trees, so the remaining migration debt is deeper than folder names and now sits mainly in broader standard-kind child CRUD/value dispatch and frontend specialized standard UI/API layers;
  - this pass closes only the standard blocking-reference route-ownership seam and does not claim completion of the larger Phase 2/3 backend or frontend standard-kind de-specialization work.
- **Guardrail**: when a standard-kind endpoint can be expressed through the existing behavior contract, prefer generic entity-controller ownership over manual route-level child-controller dispatch. Preserve current response payloads unless the matching frontend/tests migrate in the same slice.

## Current Focus: Behavior-Based Hub Blocking Endpoint (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: the backend already had `EntityBehaviorService`, `behaviorRegistry`, and the standard-kind delete-plan bridge in place, but the entity-owned router still kept the hub `blocking-dependencies` endpoint wired directly to `treeController`, leaving a small but real manual standard-kind dispatch seam in `entityInstancesRoutes.ts`.
- **What was just validated**:
  - `EntityBehaviorService` now includes a reusable blocking-state hook, and `standardKindCapabilities.ts` exposes a standard-kind blocking-state builder alongside the existing delete-plan logic;
  - `entityInstancesController.ts` now serves the hub `blocking-dependencies` route through the generic entity controller + behavior registry, and `entityInstancesRoutes.ts` no longer dispatches that entity-owned endpoint to `treeController`;
  - the focused backend route suite `entityInstancesRoutes.test.ts` now proves the behavior-based hub blocking endpoint and passed all `32` tests;
  - `pnpm --filter @universo/metahubs-backend build` passed with `EXIT:0`, and the canonical root `pnpm build` completed green.
- **Current repository reality after this pass**:
  - one more live standard-kind router seam is now gone: the entity-owned hub blocking-dependency endpoint resolves through the generic entity controller/behavior contract instead of a specialized child controller;
  - broader manual dispatch still remains for other standard-kind child CRUD/blocking endpoints in `entityInstancesRoutes.ts`, so this pass closes only the hub blocking-dependency slice rather than the whole Phase 2/3 backend migration.
- **Guardrail**: preserve endpoint payload shape while consolidating controller ownership. The value of this pass is architectural seam removal without frontend/API churn, so future route unifications should keep existing response contracts unless the UI/tests are migrated in the same slice.

## Current Focus: Public Runtime Hardening And Remaining Legacy Seams (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: the reopened QA slice exposed three concrete truth-surface problems that were still live in production source even after earlier route neutralization: malformed metahubs frontend README EN/RU package docs, a public runtime guard that trusted `is_public` alone instead of a real published runtime, and user-visible delete/conflict wording that still shipped the old standard-kind vocabulary in touched backend/frontend flows.
- **What was just validated**:
  - `packages/metahubs-frontend/base/README.md` and `README-RU.md` were repaired, the malformed code-fence/heading sections were removed, and EN/RU parity stayed exact at `437/437` lines;
  - `publicMetahubsController.ts` now requires a public metahub to also have a `full`-access publication with an active snapshot-backed version before any unauthenticated public route resolves, and `publicMetahubsRoutes.test.ts` now proves the new fail-closed 404 cases (`16` tests passed);
  - the touched backend child/metadata controllers, frontend delete dialogs and list fallbacks, and EN/RU metahubs locale values now ship neutral tree entity / linked collection / value group / option list / field definition / fixed value / record wording for this slice while preserving compatibility-sensitive error codes and translation keys;
  - focused backend validation passed for the public-route and message-contract suites (`16 + 63` tests), both touched package builds passed, and the canonical root `pnpm build` completed green.
- **Current repository reality after this pass**:
  - the public metahub runtime no longer exposes data merely because a row is marked `is_public`; it now requires an actual published runtime surface with snapshot-backed content;
  - the repaired metahubs frontend package README pair is again a trustworthy entity-first source of truth for the touched route/component structure;
  - a remaining broader migration debt still exists outside this pass, but the specific reopened QA findings for docs, public runtime gating, and touched delete/conflict wording are now closed with validation.
- **Guardrail**: keep public-runtime exposure tied to publication-backed state, not raw design-time flags. If a future change touches unauthenticated metahub reads, it must keep the controller guard, its dedicated route suite, and the generated/public documentation evidence aligned in the same slice.

## Current Focus: Public Runtime Route Neutralization (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: the authenticated entity-owned route surface was already significantly neutralized, but the isolated public metahub runtime still published a legacy hub/catalog/attribute/element path hierarchy through live backend routes, its dedicated Jest suite, and generated OpenAPI artifacts.
- **What was just validated**:
  - `publicMetahubsRoutes.ts` and `publicMetahubsController.ts` now expose the public read-only surface through `tree-entities`, `tree-entity/:treeEntityCodename`, `linked-collections`, `linked-collection/:linkedCollectionCodename`, `field-definitions`, `records`, and `record/:recordId` instead of the removed hub/catalog/attribute/element path contract;
  - the focused backend route suite `publicMetahubsRoutes.test.ts` was retargeted to the same neutral public contract and passed all `13` tests;
  - `pnpm --filter @universo/rest-docs build` regenerated `src/openapi/index.yml` and `dist/openapi-bundled.yml` with the new public paths, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Current repository reality after this pass**:
  - the isolated public metahub API no longer ships `/public/metahub/:slug/hubs`, `/hub/:hubCodename`, `/catalogs`, `/catalog/:catalogCodename`, `/attributes`, or `/elements` as its live documented/runtime contract;
  - deeper entity-first debt still remains in other standard-kind semantics and fixed-schema surfaces, but this specific public runtime seam is now aligned with the neutral entity-first route vocabulary.
- **Guardrail**: keep public-route cutovers synchronized with the generated REST docs. The OpenAPI source and bundled artifact are build outputs of the live mounted routes, so future public API changes must keep the router, the dedicated Jest suite, and `@universo/rest-docs` in the same validation slice.

## Current Focus: Final Entity-Only Surface Completion (2026-04-15)

## Current Focus: Residual Legacy Truth-Surface Cleanup (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: the physical legacy metahub folders were already gone, but a few still-shipped truth surfaces remained in active source: one UUID v4-style pending id path in backend entity creation, one stale `catalog-v2` frontend mock preset, and the last V2-only E2E helper/spec file names.
- **What was just validated**:
  - `entityInstancesController.ts` now uses `generateUuidV7()` instead of `randomUUID()` for pending entity ids;
  - `packages/metahubs-frontend/base/src/__mocks__/handlers.ts` now exposes the direct `catalog` preset mock instead of `catalog-v2`;
  - the last V2-only E2E filenames were renamed to `entity-runtime-helpers.ts` and `metahub-standard-preset-runtime.spec.ts`, and `get_errors` stayed clean for all touched files;
  - `pnpm --filter @universo/metahubs-backend build` passed, `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` task completed without errors.
- **Current repository reality after this pass**:
  - the touched active paths no longer preserve the isolated `randomUUID()`, `catalog-v2`, `entity-v2-helpers`, or `metahub-entities-v2-runtime` seams;
  - broader legacy debt still remains in deeper public/documented standard-kind route surfaces such as the public metahub API and specialized metadata/public controllers, so this pass closes only the low-risk residual truth-surface layer.
- **Guardrail**: keep future closure claims precise. This pass cleaned low-risk shipped residue, not the larger remaining public-route and standard-kind semantic debt.

## Current Focus: Residual Standard-Kind Local Naming Cleanup (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: the larger entity-first route/folder/export cleanup is already materially in place, but the active tree list runtime and one focused optimistic mutation suite still preserve stale local `createHub*`, `createSetRequest`, and `createEnumerationRequest` helper names that no longer match the neutral shipped contract.
- **What was just validated**:
  - `TreeEntityList.tsx` now uses neutral local create/update/delete/copy/reorder and form-context naming such as `createTreeEntityMutation`, `updateTreeEntityMutation`, `createTreeEntityContext`, and `handleCreateTreeEntity` instead of the last `createHub*` / `*HubMutation` seam in this runtime module;
  - the touched optimistic mutation suite now uses `createTreeEntityRequest`, `createValueGroupRequest`, and `createOptionListRequest` as its request-controller locals, matching the neutral runtime contract without changing mocked API calls or assertions;
  - `get_errors` stayed clean for both touched files, `pnpm --filter @universo/metahubs-frontend build` passed, a targeted rerun of the renamed optimistic cases passed (`6 passed`, `7 skipped`), and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Current repository reality after this pass**:
  - this specific local-symbol cleanup slice is now complete and no longer leaves the last obvious business-owned create helper names in the touched tree runtime/test surface;
  - a full run of `src/domains/shared/__tests__/optimisticMutations.remaining.test.tsx` is still not fully green because two unrelated locked-shared reorder assertions currently fail in the constants/attributes coverage; those failures were observed during validation but were not introduced by this rename-only slice.
- **Guardrail**: keep this pass limited to local-symbol truth surfaces. Do not treat the targeted test rerun as proof that the entire optimistic-mutations suite is repaired; the remaining reorder failures need their own evidence-backed fix pass.

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: the active entity-first runtime was already far along, but the live standard-kind child routes still preserved business-named child URL fragments (`/catalogs`, `/sets`, `/enumerations`, `/hubs`, `blocking-catalogs`) even after the larger folder/export cleanup.
- **What was just validated**:
  - the active backend now routes standard child kinds through generic nested instance endpoints (`/entities/:kindKey/instance/:hubId/instances`, `/instance/:hubId/instance/:entityId`, `/blocking-dependencies`) instead of business-owned child URL fragments;
  - the frontend route builders, router registrations, standard child-resource API helpers, and metadata API helpers now emit the same nested instance contract, so child authoring/navigation no longer depends on `/catalogs`, `/catalog/:id`, `/sets`, or `/enumerations` under entity-owned routes;
  - the touched metahubs frontend README EN/RU route examples now show the nested instance contract, focused frontend Vitest passed (`2` files / `4` tests), focused backend Jest passed for `entityInstancesRoutes.test.ts` (`31` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Current repository reality after this pass**:
  - the active route surface is materially closer to an entity-only contract because standard child collections now travel through generic nested instance URLs rather than kind-specific child route fragments;
  - the remaining entity-first debt is no longer this child-route/API seam, but the deeper standard-kind semantics that still survive in active settings, UI copy, and template/runtime logic beyond the route surface;
  - closure claims still need to stay granular: this pass verifies the nested child-instance contract, not total removal of every `hub` / `catalog` / `set` / `enumeration` data semantic in the repository.
- **Guardrail**: keep transport truth separate from deeper domain semantics. The child route/API contract is now generic; remaining standard-kind behavior and wording still need their own evidence-backed passes.

## Current Focus: Metadata Transport Segment Neutralization (2026-04-14)

## Current Focus: Entity-Centric Navigation And Diagnostics Closure (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass existed**: even after the larger entity-first cleanup, the active metahub navigation still advertised a dedicated `common` surface and hard-coded standard-kind sidebar entrypoints, while the current Problems panel also reported real tsconfig debt that needed to be reconciled against the actual workspace TypeScript version.
- **What was just validated**:
  - the active public/frontend route surface now uses `/metahub/:id/resources` and `MetahubResources`; legacy `/common`, `/general`, and `/layouts` metahub entrypoints remain only as redirects;
  - the live sidebar/menu truth surface no longer hard-codes `hubs` / `catalogs` / `sets` / `enumerations`; it now exposes board, resources, entities, and dynamic entity-type items;
  - focused metahubs-frontend Vitest passed (`3` files / `11` tests), focused template-mui Jest passed (`2` suites / `9` tests), touched frontend package builds passed, `pnpm --filter @universo/metahubs-backend build` passed after the final tsconfig cleanup, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Current repository reality after this pass**:
  - the remaining metahub navigation truth surface is now entity-centric instead of preserving a first-class `common` route/export or hard-coded standard-kind menu entrypoints;
  - the root tsconfig intentionally keeps `ignoreDeprecations: 5.0` because that is the highest value accepted by the actual workspace TypeScript compiler used in package builds; editor diagnostics that suggest `6.0` are ahead of the compiler pinned in this monorepo and must not override build correctness;
  - broader unchecked phases in the long-range migration plan still require their own evidence-backed passes and should not be marked complete just because this navigation/diagnostics slice is now green.
- **Guardrail**: prefer build-compatible TypeScript config over newer editor-only suppression hints. If VS Code suggests `ignoreDeprecations: 6.0` again before the workspace compiler is upgraded, treat that as tooling drift rather than a safe repository-wide change.

## Current Focus: Entity-First Final Reconciliation And Debt Closure (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass existed**: the branch was already largely entity-first in runtime, but one focused Playwright permission proof still used stale fixture data and the touched metahubs package README surfaces still described removed frontend/backend entrypoints, so the migration could not be honestly treated as fully reconciled.
- **What was just validated**:
  - the focused Playwright workspace permission proof now creates the custom catalog-compatible instance through the generic `/entities` endpoint for the matching custom kind, and the rerun passed both tests including `catalog-compatible entity instances stay read-only for metahub members` (`2 passed`);
  - `packages/metahubs-backend/base/README*.md` now reflects the live entity-first router composition instead of legacy `attributes/constants/elements` mount wording or `/:metahubId/hubs` route examples;
  - `packages/metahubs-frontend/base/README*.md` now reflects the live `components/`, `domains/`, `hooks/`, `i18n/`, `menu-items/`, `types.ts`, `displayConverters.ts`, and `utils/` structure instead of removed `api/hubs.ts`, `catalogs.ts`, `attributes.ts`, `elements.ts`, and legacy page examples;
  - `get_errors` stayed clean for the touched spec and README files, README EN/RU parity remained exact (`129/129` backend and `437/437` frontend lines), and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Current repository reality after this pass**:
  - the validated remaining debt from the reopened QA slice is no longer the stale member-permission Playwright setup or the touched package README truth surfaces;
  - this pass closes a real proof-and-doc reconciliation layer, but it does not by itself claim that every broader architecture/doc/snapshot follow-up from the long-range migration brief is finished;
  - any further entity-first closure claims should now be based on the remaining unchecked plan phases, not on the already-repaired Playwright/doc mismatch.
- **Guardrail**: keep closure claims evidence-backed. A green focused browser proof plus synchronized touched README surfaces closes this reconciliation slice only; broader snapshot regeneration and full docs rewrite remain separate deliverables unless they are validated in their own passes.

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: after the metadata helper/schema neutralization, the active authoring transport still exposed the legacy `attributes` / `constants` / `elements` route contract through mounted backend suffixes, emitted frontend URLs, API client paths, breadcrumb hrefs, and focused route-aware tests.
- **What was just validated**:
  - the active backend metadata routes now mount on neutral `field-definitions` / `field-definition`, `fixed-values` / `fixed-value`, and `records` / `record` suffixes;
  - the shared route builders, router registrations, metadata API clients, breadcrumb hrefs, and layout helpers now emit the neutral metadata transport segments while preserving the current internal tab/query-state vocabulary;
  - focused frontend Vitest passed for `6` files / `13` tests, focused backend Jest passed for `3` suites / `39` tests, focused `NavbarBreadcrumbs.test.tsx` passed (`3` tests), and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Current repository reality after this pass**:
  - the live metadata authoring transport no longer advertises `attributes` / `constants` / `elements` as the mounted frontend/backend route contract for the touched entity-owned surfaces;
  - the only follow-up discovered during validation was stale frontend test mocks that still exported pre-neutralization mutation hook names, and those mocks were retargeted to the current field-definition / record hook contract;
  - deeper remaining debt is now below the transport-segment layer and should be treated as a separate cache/query/local-symbol or data-contract migration instead of being hidden inside route strings.
- **Guardrail**: keep transport cutovers separate from internal query-key and semantic payload migrations. The emitted URL contract is now neutralized; deeper local-symbol and DTO vocabulary changes still need their own evidence-backed slice.

## Current Focus: Frontend Standard UI Local Alias Neutralization (2026-04-14)

## Current Focus: Metadata API Helper Contract Neutralization (2026-04-15)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: after the larger entity-owned folder/runtime cleanup, the active metadata entrypoints still exposed a thin legacy contract through `listAttributes|getAttribute|createAttribute`, `listConstants|getConstant|createConstant`, `listElements|getElement|createElement`, and the matching controller-local schema names even though the live folder ownership had already moved to `fieldDefinition`, `fixedValue`, and `record`.
- **What was just validated**:
  - the touched metadata API surfaces now export neutral field-definition / fixed-value / record helper names, direct variants, codename helper names, and matching hook/type contracts instead of the remaining `attribute` / `constant` / `element` export seam;
  - the touched backend metadata controller-local schemas now use neutral `createFieldDefinitionSchema` / `createFixedValueSchema` / `createRecordSchema` style naming instead of the old `createAttributeSchema` / `createConstantSchema` / `createElementSchema` seam;
  - `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green with `30 successful, 30 total`.
- **Current repository reality after this pass**:
  - the active metadata API/controller contract no longer advertises the old child-resource naming through exported helper names or touched controller-local schemas;
  - this pass intentionally preserved mounted route segments, request param names, and data-level compatibility fields such as `targetConstantId` where those still define the live transport/runtime contract;
  - deeper remaining debt is now below the helper-contract layer and should be treated as a dedicated transport/local-symbol migration instead of being hidden behind stale export names.
- **Guardrail**: keep metadata contract cleanup split into layers. Neutralize exported helper/hook/schema surfaces first, and only then change mounted URL segments or request param names in a dedicated migration with separate evidence.

## Current Focus: Frontend Standard UI Local Alias Neutralization (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: after the route-builder cleanup, the active standard UI still preserved a thin local alias seam through `HubList`, `CatalogList`, `SetList`, `EnumerationList`, `hubActions`, and matching focused test wording even though those symbols no longer described the real entity-owned runtime contract.
- **What was just validated**:
  - the touched standard UI modules now use neutral local/default-export names such as `TreeEntityList`, `LinkedCollectionList`, `ValueGroupList`, `OptionListList`, and `treeEntityActions` instead of the remaining Hub/Catalog/Set/Enumeration alias seam;
  - the focused action-factory test wording now describes the neutral `TreeEntityActions` / `LinkedCollectionActions` / `OptionListActions` contract rather than the removed alias names;
  - focused Vitest passed for `actionsFactories.test.ts` (`1` file / `8` tests), `pnpm --filter @universo/metahubs-frontend build` passed, and the canonical root `pnpm build` completed green (`30 successful, 30 total`).
- **Current repository reality after this pass**:
  - the touched active standard UI modules no longer expose the old Hub/Catalog/Set/Enumeration local alias/default-export symbols as their live source contract;
  - this pass intentionally preserved i18n namespaces, entity kind keys, mounted URL strings, and data-level container relationships where those remain the current runtime truth;
  - deeper remaining debt is now below the local alias layer and should be treated as a separate migration slice instead of being hidden inside local symbol cleanup.
- **Guardrail**: keep this class of cleanup scoped to local/export alias ownership. Runtime behavior, route shapes, and persisted semantics still need dedicated evidence-backed migrations when they become the next active seam.

## Current Focus: Frontend Entity Authoring Route Builder Neutralization (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: after the runtime hook/API-helper cleanup, the active frontend still exposed a business-named authoring-path seam through `buildEntityHubAuthoringPath`, `buildEntityCatalogAuthoringPath`, `buildEntitySetAuthoringPath`, `buildEntityEnumerationAuthoringPath`, and matching local helper names inside the standard/metadata API files.
- **What was just validated**:
  - the touched shared route-builder contract now exports `buildTreeEntityAuthoringPath`, `buildLinkedCollectionAuthoringPath`, `buildValueGroupAuthoringPath`, `buildOptionListAuthoringPath`, plus the neutral `TreeEntityAuthoringTab` / `LinkedCollectionAuthoringTab` aliases;
  - the touched standard-runtime screens, metadata screens, layout/detail navigation, blocking-delete dialogs, and the shared route-path test now import that neutral builder surface instead of the old Hub/Catalog/Set/Enumeration builder names;
  - the touched standard and metadata API files now use neutral linked-collection / value-group / option-list / tree-entity / collection / container helper identifiers while preserving the currently mounted HTTP path strings;
  - `pnpm --filter @universo/metahubs-frontend build` passed, focused Vitest passed for `7` files / `14` tests, and the canonical root `pnpm build` completed green (`30 successful, 30 total`).
- **Current repository reality after this pass**:
  - the audited frontend route-builder contract no longer exposes the old entity authoring builder symbol names in active `packages/metahubs-frontend/base/src/**` source;
  - this pass intentionally preserved route parameter names, emitted URL strings, and the remaining backend transport/data terminology where those still define the live mounted contract;
  - deeper remaining debt is now beyond the shared route-builder/helper seam and should be treated as a separate migration slice rather than hidden inside naming cleanup.
- **Guardrail**: keep authoring-path contract neutralization scoped to symbol/helper ownership. Changing emitted URLs or backend route params belongs to a dedicated transport migration with separate evidence.

## Current Focus: Entity-First Final Migration — Standard Runtime API Helper Neutralization (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: after the hook/form/action cleanup, the active entity-owned standard runtime still exported business-named API helpers such as `createCatalogAtMetahub`, `getSetById`, `listAllEnumerations`, and `createEnumerationValue`, which kept the direct runtime data-access surface visibly tied to the old domain seam.
- **What was just validated**:
  - the touched `entities/standard/api/**` files now export neutral linked-collection / value-group / option-list / option-value API helper names and type aliases instead of the old `Catalog` / `Set` / `Enumeration` helper contract;
  - the touched hooks, list-data helpers, metadata consumers, blocking-delete dialogs, and focused tests/mock seams were retargeted to that neutral API helper surface without changing the live HTTP path shapes;
  - `pnpm --filter @universo/metahubs-frontend build` passed clean, focused Vitest passed for the touched API-helper slice (`7` files / `24` tests), and the canonical root `pnpm build` completed green (`30 successful, 30 total`).
- **Current repository reality after this pass**:
  - the audited standard-runtime API helper layer no longer exports `createCatalog*`, `getSet*`, `listAllEnumerations`, `createEnumerationValue`, or the matching old API type names as the live entity-owned contract;
  - this pass intentionally preserved the existing HTTP route/path shapes, backend payload semantics, and remaining data-level terminology instead of conflating API helper neutralization with a deeper transport/domain migration;
  - deeper remaining debt is now mostly in residual data-level/UI semantics and other still-business-named local variables/helpers rather than the active standard-runtime hook/API export seam.
- **Guardrail**: keep runtime API helper neutralization scoped to export/use surfaces. Path builders, query-key families, translation namespaces, and durable backend DTO semantics still require separate evidence-backed migrations when they become the next active seam.

## Current Focus: Entity-First Final Migration — Standard Runtime Mutation Contract Neutralization (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: after the container/shared-runtime cleanup, the active entity-owned standard runtime still exported business-named mutation, form, action, and hook contracts such as `useCreateCatalog`, `useCreateSet`, `useCreateEnumeration`, `CatalogFormValues`, and `EnumerationFormValues` even though the shipped surfaces were already neutral linked-collection / value-group / option-list implementations.
- **What was just validated**:
  - the touched hook/type/action/view seams now use neutral standard-runtime contract names such as `useCreateLinkedCollection`, `useCreateValueGroup`, `useCreateOptionList`, `useCreateOptionValue`, `LinkedCollectionFormValues`, `ValueGroupFormValues`, `OptionListFormValues`, and the corresponding update/delete/copy/reorder contracts;
  - the touched metadata consumers and focused tests were retargeted to that contract, including the optimistic mutation suite, settings-origin tab coverage, action-factory coverage, metadata system-tab coverage, record continuity/error flows, and option-value optimistic update coverage;
  - `pnpm --filter @universo/metahubs-frontend build` passed, the focused Vitest slice passed for `7` files / `32` tests, and the canonical root `pnpm build` completed green (`30 successful, 30 total`).
- **Current repository reality after this pass**:
  - the audited active `entities/standard/**` hook/type/form/action contract no longer preserves `useCreateCatalog|Set|Enumeration`, `CreateCatalog|Set|EnumerationParams`, or `Catalog|Set|EnumerationFormValues` as the live runtime surface;
  - this pass intentionally preserved API path shapes, translation namespaces, and durable kind semantics where those remain the current backend/data truth instead of a removable ownership seam;
  - deeper remaining debt now sits in the still-live business-named API helpers and other data-level/runtime semantics that were outside this contract-only rename slice.
- **Guardrail**: keep separating neutralizable runtime ownership contracts from true data-kind semantics. Export/hook/form naming can move ahead of API-path or storage changes, but those deeper contracts still need their own explicit migration evidence.

## Current Focus: Entity-First Final Migration — Container Vocabulary And Shared Runtime Neutralization (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: even after the larger folder/export/service cleanups, the active metahubs frontend still exposed `hub` / `catalog` wording through shared selection panels, shared/common tabs, and local child-resource helper names in places where the shipped runtime was already generic enough to speak in terms of containers, collections, and entity-owned child resources.
- **What was just validated**:
  - `ContainerSelectionPanel` and `ContainerParentSelectionPanel` now use neutral container-oriented prop contracts, and the touched entity-owned consumers were retargeted to those names;
  - `CommonPage.tsx` now uses the neutral shared tab vocabulary (`fieldDefinitions`, `fixedValues`, `optionValues`), and the touched field-definition / record API helpers now use neutral collection/container helper names while preserving the live wire paths;
  - EN/RU metahubs locale entries and the focused frontend tests were updated to the new runtime wording, focused Vitest passed for `CommonPage.test.tsx` and `EntityInstanceList.test.tsx` (`2` files / `12` tests), and the canonical root `pnpm build` completed green (`30 successful, 30 total`).
- **Current repository reality after this pass**:
  - the touched shared runtime/UI seams no longer preserve `HubSelection*`, `ParentHub*`, or `attributes/constants/values` wording as the active local contract;
  - this pass intentionally preserved stored config keys and backend route shapes where those contracts remain persistence/API truth and were not part of an explicit migration;
  - the next debt is now in the surviving standard-kind runtime mutation/hook seams and any remaining business-owned wording that still leaks through active `entities/standard/**` source.
- **Guardrail**: do not conflate removable local runtime vocabulary with durable data-kind semantics. Neutralize local ownership seams first; change stored keys or route contracts only when a dedicated migration explicitly proves that it is safe.

## Current Focus: Entity-First Final Migration — Frontend Public Type Contract Neutralization (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: after the folder/service/component cleanup, `@universo/metahubs-frontend` still exported business-named public types and converters such as `Hub`, `Catalog`, `MetahubSet`, `Enumeration`, `toHubDisplay`, and `toCatalogDisplay`, which kept the package-level API surface visibly pre-entity-first even where runtime ownership had already moved.
- **What was just validated**:
  - active `packages/metahubs-frontend/base/src/**` source now uses neutral public type names: `TreeEntity`, `LinkedCollectionEntity`, `ValueGroupEntity`, `OptionListEntity`, their corresponding `*Display` / `*LocalizedPayload` types, and neutral display converter names;
  - touched package exports, delete dialogs, entity runtime views, and focused tests were retargeted to that neutral contract;
  - focused `@universo/metahubs-frontend` build/tests and the canonical root `pnpm build` all passed after the cutover.
- **Current repository reality after this pass**:
  - the removed frontend public type/export names no longer appear anywhere under `packages/metahubs-frontend/base/src/**`;
  - a repository grep did not find any other package importing those removed names from `@universo/metahubs-frontend`, so the cutover stayed package-local and did not require follow-up compatibility shims;
  - deeper remaining debt is now in runtime semantics, tests/docs wording, and platform-level standard-kind vocabulary, not this public frontend type/export seam.
- **Guardrail**: do not claim total vocabulary neutrality yet; this pass removed the active frontend package API seam, not every remaining data-level or UX-level `hub/catalog/set/enumeration` term in the repository.

## Current Focus: Entity-First Final Migration — Tree Runtime Seam Neutralization (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: even after the public type cleanup, the live tree-kind authoring runtime still exposed old module and hook names such as `useMetahubTrees`, `TreeList`, `TreeActions`, and `useCreateHub`, which kept the active import graph visibly tied to the pre-entity-first hub seam.
- **What was just validated**:
  - the touched tree-kind runtime files were renamed to neutral tree-entity ownership names (`useTreeEntities`, `useTreeEntityListData`, `TreeEntityActions`, `TreeEntityList`, `treeEntityMutations`, `treeEntityMutationTypes`, `treeEntityListUtils`);
  - the touched hook/action/context/type exports now use the neutral tree-entity contract (`useCreateTreeEntity`, `CreateTreeEntityParams`, `TreeEntityActionContext`, `buildTreeEntityFormTabs`, and related names);
  - focused `@universo/metahubs-frontend` validation and the canonical root `pnpm build` both passed after the cutover.
- **Current repository reality after this pass**:
  - the removed tree/hub module identifiers no longer appear under `packages/metahubs-frontend/base/src/**` in the audited grep pattern;
  - downstream runtime/test consumers in entity metadata, layout tooling, metahub action factories, and entity-instance flows now resolve through the new tree-entity seam;
  - deeper remaining debt is no longer this tree-runtime ownership layer, but the broader catalog/set/enumeration runtime semantics, user-facing wording, docs, and final full-suite/browser proof.
- **Guardrail**: do not over-claim full legacy elimination yet; this pass closed one real runtime ownership seam, not the whole remaining domain vocabulary.

## Current Focus: Entity-First Final Migration — Remaining Named Seam Neutralization (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: even after the folder-level cleanup, the shipped backend/frontend still exposed business-named runtime seams such as `MetahubHubsService`, `MetahubEnumerationValuesService`, `HubSelectionPanel`, and the kind-specific delete dialogs.
- **What was just validated**:
  - backend active imports/tests now use `MetahubTreeEntitiesService` and `MetahubOptionValuesService` instead of the old business-named service seams;
  - frontend public component exports and active consumers now use `ContainerSelectionPanel`, `ContainerParentSelectionPanel`, `TreeDeleteDialog`, `LinkedCollectionDeleteDialog`, `ValueGroupDeleteDialog`, and `OptionListDeleteDialog`;
  - focused backend/frontend validation and the canonical root `pnpm build` all passed after the rename pass.
- **Current repository reality after this pass**:
  - the removed service/component seam names no longer appear in active `packages/` source under the audited grep pattern;
  - deeper remaining debt is now concentrated in business-named data semantics, tests/docs wording, and other runtime surfaces that still intentionally speak in terms of `hub`, `catalog`, `set`, and `enumeration` as data kinds rather than folder/export ownership seams.
- **Guardrail**: do not over-claim full vocabulary neutrality yet; this pass closed live service/component ownership seams, not every remaining data-level domain term in the repository.

## Current Focus: Entity-First Final Migration — Stale Contract Cleanup Pass (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why this pass exists**: the branch still carried stale truth-surface markers from the removed V2/document era, and one schema-ddl test still encoded the old assumption that a custom kind with `compatibility.legacyObjectKind = 'hub'` should remain non-physical.
- **What was just validated**:
  - the touched active tests/specs no longer preserve `custom.catalog-v2`, `custom.set-v2`, `custom.hub-v2`, `custom.enumeration-v2`, or `custom.document-*` assumptions;
  - `SchemaGenerator.test.ts` now locks the current entity-first contract: only direct standard `hub|set|enumeration` kinds are non-physical, while custom kinds remain physical even if they carry compatibility hints;
  - focused backend/application Jest and the canonical root `pnpm build` both passed after the cleanup.
- **Current repository reality after this pass**:
  - the explicit stale `custom.*-v2` / `custom.document-*` markers are gone from active `packages/` and `tools/` truth surfaces under the audited grep pattern;
  - the deeper remaining debt is no longer this stale-marker layer, but the still-open broader checklist reconciliation and the unresolved question of how far the metahub-specific `document` traces inside fixed system-schema definitions can be removed without changing platform-level manifest rules.
- **Guardrail**: do not claim full zero-debt closure yet; today’s pass closes a real residue layer and refreshes validation, but the plan still contains unchecked phases that need separate evidence.

## Current Focus: Frontend Shared Vocabulary And Metadata Ownership Stabilization (2026-04-14)

## Current Focus: Entity-First Final Migration — Reality Reconciliation Pass (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Why reopened**: the current repository state no longer matches the optimistic closure notes in this file or in `tasks.md`.
- **Verified repository reality**:
  - frontend/backend legacy top-level metadata folders are largely removed from the live tree, so the branch is genuinely far through the entity-first migration;
  - however, current diagnostics still report unresolved metahubs-frontend TypeScript/test errors centered on `domains/entities/ui/EntityInstanceList.tsx` and focused metahubs UI tests;
  - the plan file still has unchecked checklists, so implementation status must be reconciled against fresh evidence instead of prior closure summaries.
- **Current implementation target**:
  - repair the remaining entity-first typed payload/VLC issues in `EntityInstanceList.tsx`;
  - align stale focused tests with the post-cutover readonly/JSX/module contract;
  - only after fresh validation, update plan checkboxes and closure notes.
- **Fresh validation completed in this pass**:
  - `EntityInstanceList.tsx` now compiles cleanly after normalizing VLC/payload conversion, translation adapters, and nullable row fields.
  - Focused Vitest passed for `actionsFactories.test.ts`, `copyOptionPayloads.test.tsx`, and `EntityInstanceList.test.tsx` (`25` tests total).
  - `pnpm --filter @universo/metahubs-frontend build` passed after the typing/test cleanup.
- **Remaining target before closure**:
  - reconcile the plan-file checklists against the already validated migration slices;
  - decide whether the remaining metahub-specific `document` system-definition traces are still intentional or must be neutralized in source/tests before the branch can be called debt-free.
- **Guardrail**: do not claim the migration is complete until the touched diagnostics are green and the checked plan items are backed by current source plus validation evidence.

## Current Focus: Backend Generic Object Mutation And Route Wiring Cleanup (2026-04-14)

## Current Focus: Entity-Owned Route Inventory And Residual Wording Cleanup (2026-04-14)

## Current Focus: Backend Neutral Service Vocabulary Cutover (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Execution result**: the renamed backend metadata services no longer leave mixed transitional service-object naming in active source/tests, and the most visible leftover helper/doc wording around those services now matches the neutral field-definition / fixed-value / record contract.
- **Backend cleanup**:
  - active backend factories, controllers, serializers, and touched tests now use `fieldDefinitionsService`, `fixedValuesService`, and `recordsService` instead of the transitional `attributesService`, `constantsService`, and `elementsService` service object names.
  - `designTimeObjectChildrenCopy.ts` now describes its constant-copy dependency as a fixed-values service adapter, which aligns the child-copy seam with the renamed `MetahubFixedValuesService` class instead of preserving the old service ownership vocabulary.
  - `MetahubRecordsService` and the entity-owned record controller now use the internal record-oriented method/schema names `moveRecord`, `reorderRecord`, `validateRecordData`, `mapRowToRecord`, `moveRecordSchema`, and `reorderRecordSchema` instead of carrying the old element-oriented helper names behind the renamed service class.
  - the renamed service docblocks now describe design-time field definitions and records explicitly while still acknowledging the underlying `_mhb_attributes` and `_mhb_elements` table names where that persistence detail remains relevant.
- **Validation**:
  - `pnpm --filter @universo/metahubs-backend build` passed.
  - focused `@universo/metahubs-backend` Jest passed for `MetahubFieldDefinitionsService.test.ts`, `MetahubFixedValuesService.test.ts`, `entityInstancesRoutes.test.ts`, `recordsRoutes.test.ts`, `publicationsRoutes.test.ts`, `publicMetahubsRoutes.test.ts`, and `loadPublishedPublicationRuntimeSource.test.ts` (`7` suites / `81` tests).
  - `pnpm --filter @universo/metahubs-backend test -- --runInBand src/tests/routes/recordsRoutes.test.ts` passed again (`4` tests) after the internal record-method rename.
  - canonical root `pnpm build` passed (`30 successful, 30 total`) after the final follow-up.
- **Status**: this slice is closed and validated. Remaining backend vocabulary debt is now deeper than service-object naming and should be treated as a separate architectural refactor instead of a partially completed class/file rename.

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Execution result**: the active OpenAPI generator no longer points at deleted top-level backend metadata route files, and the touched backend/frontend/doc wording now matches the current entity-first/platform-provided semantics instead of preserving transitional `managed` phrasing.
- **Cleanup**:
  - `packages/universo-rest-docs/scripts/generate-openapi-source.js` now reads the live entity-owned metadata route files under `domains/entities/metadata/fieldDefinition|fixedValue|record/routes.ts` instead of the deleted `domains/attributes|constants|elements/routes/*.ts` paths.
  - `EntityTypeService.ts` and its focused Jest suite now describe standard kind keys as reserved for platform-provided entity types instead of `preset-managed` entity types.
  - `FieldDefinitionList.tsx` and its focused frontend test now use the platform-provided system-attribute hint, while `EntitiesWorkspace.tsx` describes the generated table prefix as a physical table name instead of a managed table name.
  - `packages/metahubs-backend/base/README.md` and `README-RU.md` were updated in sync, and their line counts still match exactly (`129` lines each).
- **Validation**:
  - focused `@universo/metahubs-backend` Jest passed for `src/tests/services/EntityTypeService.test.ts` (`10` tests).
  - focused `@universo/metahubs-frontend` Vitest passed for `src/domains/entities/metadata/fieldDefinition/ui/__tests__/FieldDefinitionList.systemTab.test.tsx` (`4` tests).
  - `pnpm --filter @universo/rest-docs build` passed and regenerated the bundled OpenAPI artifact after `verify:route-sources` succeeded.
  - canonical root `pnpm build` passed (`30 successful, 30 total`).
- **Status**: this slice is closed and validated. Remaining `managed` markers in the repository are now concentrated in intentional schema/system-field semantics or untouched generated/history surfaces, not in the stale route inventory or the touched user-facing/backend wording from this slice.

## Current Focus: Backend Generic Object Mutation And Route Wiring Cleanup (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Execution result**: the metahubs backend no longer preserves business-named `MetahubObjectsService` wrapper methods for standard object mutations, and the entity route layer no longer instantiates an extra child-controller registry just to forward into the same four controller factories.
- **Backend cleanup**:
  - `MetahubObjectsService.ts` now exposes only the generic `createObject` and `updateObject` mutation surface for `_mhb_objects`; the temporary `createCatalog`, `createEnumeration`, `createSet`, `updateCatalog`, `updateEnumeration`, and `updateSet` helpers were deleted.
  - `linkedCollectionController.ts` now calls the generic object mutations directly for create/update/copy/detach flows, which also keeps catalog-compatible update paths on the passed transaction runner instead of splitting one branch onto the service default executor.
  - `entityInstancesRoutes.ts` now wires the four child controllers directly through `createTreeController`, `createLinkedCollectionController`, `createValueGroupController`, and `createOptionListController`; `domains/entities/children/controllerRegistry.ts` was deleted.
  - the touched `MetahubObjectsService` Jest coverage now locks the generic update contract instead of a catalog-specific wrapper method.
- **Validation**:
  - `pnpm --filter @universo/metahubs-backend build` passed after the cleanup.
  - focused `@universo/metahubs-backend` Jest passed for `src/tests/services/MetahubObjectsService.test.ts` (`9` tests).
  - canonical root `pnpm build` passed (`30 successful, 30 total`).
- **Status**: this slice is closed and validated. Remaining backend debt is no longer this wrapper/registry indirection; the next work should target deeper behavior ownership or broader residual domain vocabulary if required.

## Current Focus: Frontend Shared Vocabulary And Metadata Ownership Stabilization (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Execution result**: the metahubs frontend now treats `FieldDefinition`, `FixedValue`, `RecordItem`, and `OptionValue` as the only active local shared vocabulary, and the metadata tree no longer ships parallel legacy `attribute`, `constant`, `element`, or `enumerationValue` source copies next to the neutral folders.
- **Frontend cutover**:
  - local converter consumers were retargeted from `toAttributeDisplay`, `toConstantDisplay`, `toHubElementDisplay`, and `toEnumerationValueDisplay` to `toFieldDefinitionDisplay`, `toFixedValueDisplay`, `toRecordItemDisplay`, and `toOptionValueDisplay`.
  - `packages/metahubs-frontend/base/src/types.ts` and `src/index.ts` no longer re-export the temporary backward-compat alias names (`Attribute`, `Constant`, `HubElement`, `EnumerationValue`, plus the old converter aliases) as if they were canonical active contract.
  - `packages/metahubs-frontend/base/src/domains/entities/metadata` now contains only `fieldDefinition`, `fixedValue`, `optionValue`, and `record`; the orphan legacy `attribute`, `constant`, and `element` source copies were deleted and their empty directories removed.
  - the last `domains/entities/kinds/ui/EnumerationValueList.tsx` duplicate and its stale focused test were removed, leaving `standard/ui/SelectableOptionList.tsx` as the active option-list runtime surface.
- **Validation**:
  - `pnpm --filter @universo/metahubs-frontend build` passed after the shared-vocabulary cutover and legacy metadata-folder deletion.
  - focused `@universo/metahubs-frontend` Vitest passed for `types.test.ts`, `FieldDefinitionList.systemTab.test.tsx`, `RecordList.settingsContinuity.test.tsx`, `RecordList.createErrorFlow.test.tsx`, and `SelectableOptionList.optimisticUpdate.test.tsx`.
  - canonical root `pnpm build` passed (`30 successful, 30 total`) after the cleanup.
- **Status**: this slice is closed and validated. The active tree no longer preserves folder-level or local-types-level parallel ownership for the old metadata vocabulary; any further work should target deeper runtime/documentation seams rather than these now-removed duplicates.

## Current Focus: Standard Entity Route And Export Neutralization (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Execution result**: the metahubs frontend no longer ships separate public per-kind page exports such as `HubEntityInstanceView` or `CatalogEntityInstanceView`, and the temporary `domains/entities/kinds/**` ownership seam was collapsed back into a stricter `domains/entities/standard/**` subtree.
- **Frontend cutover**:
  - `packages/metahubs-frontend/base/src/domains/entities/ui/StandardEntityCollectionPage.tsx` now provides the generic standard-metadata entry surface for both direct `:kindKey/instances` rendering and nested child-collection rendering.
  - `EntityInstanceList.tsx` now delegates standard kinds through the generic `StandardEntityCollectionPage` instead of importing four separate per-kind page wrappers.
  - `@universo/metahubs-frontend` exports `StandardEntityCollectionPage` and `StandardEntityChildCollectionPage`, while the deleted `HubEntityInstanceView` / `CatalogEntityInstanceView` / `SetEntityInstanceView` / `EnumerationEntityInstanceView` contract no longer exists in active source.
  - `@universo/core-frontend` route composition now loads one generic child-collection entrypoint with `childKind` props instead of four dedicated lazy modules.
  - the temporary `domains/entities/kinds/**` directory was renamed back to `domains/entities/standard/**`, and touched imports/tests/docs were retargeted so the entity module no longer advertises that transitional folder name.
- **Validation**:
  - `pnpm --filter @universo/metahubs-frontend build` passed after the folder rename and route/export cutover.
  - focused `@universo/metahubs-frontend` Vitest passed for `src/__tests__/exports.test.ts` and `src/domains/entities/ui/__tests__/EntityInstanceList.test.tsx` (`14` tests total).
  - canonical root `pnpm build` passed (`30 successful, 30 total`) after the generic route/export contract replaced the old per-kind entrypoints.
- **Status**: this slice is closed and validated. Remaining debt is deeper inside the surviving `domains/entities/standard/**` runtime modules and metadata capability folders, not in the public route/export seam that previously kept the old per-kind page model alive.

## Current Focus: Neutral Kinds Runtime Cutover Closure (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Execution result**: the metahubs frontend no longer ships the old `packages/metahubs-frontend/base/src/domains/entities/standard/**` runtime subtree; the surviving standard-kind runtime logic was relocated into the neutral entity-owned `domains/entities/kinds/**` layout and the empty legacy `standard/**` directories were deleted.
- **Frontend cutover**:
  - residual top-level runtime files under `domains/attributes`, `domains/constants`, `domains/elements`, and `domains/general` were physically removed once their entity-owned replacements already existed.
  - the moved standard-kind APIs, hooks, actions, list views, and focused tests now live under `domains/entities/kinds/{api,hooks,ui}/**`, and touched consumers were retargeted to those new direct paths.
  - the post-move stabilization pass repaired the shallower relative imports created by the flattening step and fixed one stale focused mock target in `OptionValueList.optimisticUpdate.test.tsx`.
- **Validation**:
  - `pnpm --filter @universo/metahubs-frontend build` passed after the `domains/entities/kinds/**` cutover.
  - focused `@universo/metahubs-frontend` Vitest reran clean for the moved kinds/delete-dialog/entity-instance/optimistic-mutation surfaces after the stale mock repair.
  - canonical root `pnpm build` passed after the old `domains/entities/standard/**` tree was deleted.
- **Status**: this implementation slice is closed and validated. Any future attempt to remove the remaining domain-specific runtime symbol names would be a readability-harming rename pass rather than an ownership-seam cleanup.

## Current Focus: Backend Entity Metadata Route Ownership Cutover (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Execution result**: the metahubs backend no longer ships top-level metadata authoring folders for `attributes`, `constants`, `elements`, `catalogs`, `sets`, or `enumerations`; the active child-resource route/controller ownership now lives under `domains/entities/metadata/**`, and the removed top-level directories were physically deleted from the working tree.
- **Backend cutover**:
  - the live attribute/constant/element controllers and route factories were moved into `packages/metahubs-backend/base/src/domains/entities/metadata/{attribute,constant,element}/**`.
  - `router.ts` and the backend package entrypoint now mount/export the new entity-owned route factories instead of the deleted top-level metadata-domain ones.
  - the canonical child-resource routes now expose only entity-owned URL shapes; legacy `/metahub/:id/catalog/...`, `/set/...`, and `/hub/.../catalog|set/...` authoring paths were removed from the mounted backend contract in this slice.
  - the obsolete top-level backend controller files for `catalogs`, `sets`, and `enumerations` were deleted once the active source graph no longer referenced them.
- **Validation**:
  - `pnpm --filter @universo/metahubs-backend build` passed after the route/controller relocation.
  - focused backend Jest passed for `attributesRoutes.test.ts`, `constantsRoutes.test.ts`, and `elementsRoutes.test.ts` (`39` tests total) after those suites were retargeted to the new entity-owned route factories and URLs.
  - canonical root `pnpm build` passed (`30 successful, 30 total`) after the backend folder deletion and route-contract cutover.
- **Status**: this slice closes the explicit top-level backend legacy-domain ownership that still remained after the earlier entity-first passes. The remaining backend debt is deeper internal specialization under `domains/entities/children/**`, not surviving top-level legacy domain folders.

## Current Focus: Standard Subtree Dead-Seam Cleanup (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Execution result**: the post-folder-deletion audit confirmed that the surviving `packages/metahubs-frontend/base/src/domains/entities/standard/**` tree still contains real per-kind runtime behavior, but its remaining dead barrel seams have now been removed.
- **Frontend cleanup**:
  - the `index.ts`, `api/index.ts`, and `hooks/index.ts` re-export layers under `standard/catalog`, `standard/hub`, `standard/set`, and `standard/enumeration` were deleted.
  - touched production consumers, metadata hooks, and focused tests now import direct module files such as `api/catalogs.ts`, `api/hubs.ts`, `api/sets.ts`, `api/enumerations.ts`, and `hooks/useMetahubTrees.ts` instead of the deleted barrel entry points.
  - the follow-up audit did not show new dead folders beyond those barrels; the remaining kind-specific folders still contain the real list/actions/hooks/runtime logic and therefore require a separate architectural rewrite if the user wants to eliminate those names entirely.
- **Validation**:
  - focused `@universo/metahubs-frontend` Vitest passed for the touched standard-consumer surfaces (`7` files / `34` tests).
  - `pnpm --filter @universo/metahubs-frontend build` passed.
  - canonical root `pnpm build` passed (`30 successful, 30 total`).
- **Status**: the safe standard-subtree dead-seam cleanup is closed and validated; any stricter removal of the remaining named standard-kind folders is now a larger runtime refactor, not a dead-file cleanup task.

## Current Focus: Frontend Top-Level Metadata/Common Folder Removal Closure (2026-04-14)

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Execution result**: the metahubs frontend no longer ships the top-level `domains/attributes`, `domains/constants`, `domains/elements`, or `domains/general` folders; the real implementations now live under `domains/entities/metadata/*` and `domains/entities/shared/*`.
- **Frontend closure**:
  - the moved metadata/common production graph now resolves through entity-owned file locations instead of wrapper re-exports from deleted top-level folders.
  - the last top-level wrapper files for `attributes`, `constants`, and `elements` were deleted, and the now-empty top-level metadata/common directories were removed from `packages/metahubs-frontend/base/src/domains`.
  - touched focused tests and `vitest.config.ts` were retargeted to the moved entity-owned paths, including the renamed `CommonPage` entry point.
- **Validation**:
  - focused `@universo/metahubs-frontend` Vitest passed for the moved metadata/common surfaces (`4` files / `17` tests).
  - `pnpm --filter @universo/metahubs-frontend build` passed after the folder deletion.
  - canonical root `pnpm build` passed (`30 successful, 30 total`).
- **Status**: the explicit user requirement for removing those top-level frontend legacy folders is now satisfied and validated; the remaining architecture tail is the named standard-kind subtree under `domains/entities/standard/**`, which needs a separate safe audit before any further collapse.

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Execution result**: the QA-reopened backend ownership seam and frontend system-managed standard-kind seam were removed from the shipped source graph in this pass.
- **Backend closure**:
  - standard-kind child controllers/services now live under `packages/metahubs-backend/base/src/domains/entities/children/**`.
  - the old top-level `domains/hubs`, `domains/catalogs`, `domains/sets`, and `domains/enumerations` route/domain files were removed from active source ownership.
  - `entityInstancesController.ts` now resolves catalog/hub compatibility helpers from the new entity-owned backend paths, and `entityDeletePatterns.ts` no longer exports the stale `executeLegacyReorder` name.
- **Frontend closure**:
  - `EntitiesWorkspace.tsx` no longer treats direct standard kinds as system-managed rows; direct standard kinds now keep the same instances/edit/copy affordances as other entity types.
  - shared catalog authoring links now build through `domains/shared/entityMetadataRoutePaths.ts` instead of importing the catalog path helper from the standard catalog UI subtree.
  - shared common/enumeration-value entry points now route through entity-owned wrapper paths under `domains/entities/**`.
- **Validation**:
  - `pnpm --filter @universo/metahubs-backend build` passed.
  - focused `@universo/metahubs-backend` Jest passed (`2` suites / `36` tests).
  - `pnpm --filter @universo/metahubs-frontend build` passed.
  - focused `@universo/metahubs-frontend` Vitest passed (`6` files / `18` tests).
  - canonical root `pnpm build` passed (`30 successful, 30 total`).
- **Status**: this pass closes the concrete QA findings that were still reproducible in the live branch state without reopening the already-green entity-owned route contract.

- **Plan**: [entity-first-final-migration-plan-2026-04-14.md](plan/entity-first-final-migration-plan-2026-04-14.md)
- **Execution result**: the remaining active ownership tail is now closed for the touched backend/frontend source graph.
- **Backend cutover**:
  - `legacyBuiltinObjectCompatibility.ts` was replaced by `entityDeletePatterns.ts` in active source/tests.
  - `entityInstancesRoutes.ts` now reaches standard child controller factories through the entity-owned `standardEntityChildrenControllers.ts` entrypoint instead of importing the legacy domain controllers directly.
- **Frontend cutover**:
  - public metadata/common entry points now flow through `domains/entities/metadata/*` and `domains/entities/shared/*` wrappers.
  - touched production consumers (`TargetEntitySelector`, `EntityInstanceList`, `GeneralPage`, `useElementListData`, package `index.ts`) no longer import top-level `attributes`, `constants`, `elements`, or `general` modules directly.
- **Validation**:
  - focused `@universo/metahubs-backend` Jest passed (`2` suites / `36` tests)
  - focused `@universo/metahubs-frontend` Vitest passed (`6` files / `21` tests)
  - canonical root `pnpm build` passed (`30 successful, 30 total`)
- **Status**: this cutover closed the remaining active legacy ownership markers identified in the current implementation pass without reopening the already-green entity-owned route/UI contract.

## Latest Validated Slice: Neutral Entity-Owned Surface Cleanup (2026-04-14)

- Frontend transitional standard-kind folders were moved from top-level `domains/managed*` locations into `domains/entities/standard/*`, and the entity-owned wrapper seam was renamed from `ManagedStandardKindSurfaces` to `StandardEntityInstanceViews`.
- Public metahubs frontend exports and core-frontend lazy routes now use `HubEntityInstanceView`, `CatalogEntityInstanceView`, `SetEntityInstanceView`, and `EnumerationEntityInstanceView` instead of the old `Managed*EntitySurface` contract.
- Shared route helper naming was normalized from `managedMetadataRoutePaths` to `entityMetadataRoutePaths`, and the touched frontend imports/tests/README surfaces were updated to the new neutral seam.
- Backend cleanup in this slice removed the `isBuiltinMetahubObjectKind` helper and then completed the residual neutral rename pass across schema-ddl helpers, shared backend helpers, publication serialization locals, route dispatch, and metahub settings key helpers.
- Follow-up frontend cleanup removed the remaining transition-only naming from query-key helpers, entity list/workspace internals, shared pagination helper aliases, and focused tests/docs truth surfaces.
- Validation completed for the touched packages: the canonical root `pnpm build` completed after the follow-up pass, targeted file-level diagnostics stayed clean, and the touched EN/RU architecture+guide doc pairs still preserve exact line-count parity.
- The forbidden-marker audit for that slice is still valid for the touched neutral-renaming work, but it did not close the deeper QA-reopened gaps around child-resource route canonicalization and the residual backend entity-route controller seam.

## Latest Closure Notes (2026-04-14)

- Frontend child-resource clients under `domains/attributes`, `domains/constants`, and `domains/elements` now use entity-owned route builders only, matching the backend aliases that were already mounted under the entity route tree.
- The touched browser truth surfaces (`metahub-domain-entities.spec.ts`, `codename-mode.spec.ts`, and the self-hosted export generator) now navigate through `/entities/:kindKey/instances` and assert the matching entity-owned API endpoints instead of legacy top-level `/hubs|catalogs|sets|enumerations` authoring URLs.
- The backend README confirms that entity-owned top-level routes may reuse specialized managed controllers underneath, so the remaining `entityInstancesRoutes.ts` composition is treated as an intentional internal implementation detail unless a future task explicitly requires deeper backend unification.

## Latest Validated Continuation Pass (2026-04-14)

- The post-compression continuation audit confirmed that the current production/frontend route consolidation was already build-clean; the only live regressions in this pass were focused tests whose mocks still pointed at pre-move paths after the `domains/entities/standard/*` relocation.
- `OptionValueList.optimisticUpdate.test.tsx` and `TreeList.settingsReopen.test.tsx` were updated to mock the current shared/settings/root modules and the import-time factory exports now required by the moved graph, without changing runtime behavior.
- Validation for this continuation pass completed with a focused metahubs-frontend suite (`12` files / `83` tests) plus a fresh root `pnpm build` (`30 successful, 30 total`).

## Latest Validated Slice: Metadata Capability Neutralization (2026-04-14)

- Frontend entity-owned metadata capability folders were renamed from business-era seams to neutral paths: `metadata/attribute` → `metadata/fieldDefinition`, `metadata/constant` → `metadata/fixedValue`, `metadata/element` → `metadata/record`, and `metadata/enumerationValue` → `metadata/optionValue`.
- The corresponding public/frontend truth surfaces were aligned to the same vocabulary: package exports, core-frontend lazy routes, template-mui external module declarations, focused tests, Vitest coverage config, and touched MIGRATIONS truth surfaces now use `FieldDefinitionList`, `FixedValueList`, `RecordList`, and `SelectableOptionList`.
- Backend entity-owned metadata route ownership now mirrors that neutral naming: `domains/entities/metadata/fieldDefinition|fixedValue|record`, with router/package exports and route suites switched to `createEntityFieldDefinitionRoutes`, `createEntityFixedValueRoutes`, and `createEntityRecordRoutes`.
- Validation for this slice completed with focused `@universo/metahubs-frontend` build + Vitest (`8` files / `24` tests), focused `@universo/metahubs-backend` build + Jest (`4` suites / `70` tests), and a fresh canonical root `pnpm build` (`30 successful, 30 total`).
- Remaining debt after this slice is no longer top-level legacy folder ownership for these metadata capabilities; the next work must target deeper business semantics still encoded in runtime HTTP suffixes, shared types, and documentation language if the user requires total vocabulary neutralization.

## Current Guardrails

- Do not reintroduce `includeBuiltins`, `isBuiltin`, `source`, `custom.*-v2`, old top-level managed route families, or the deleted frontend `domains/catalogs|hubs|sets|enumerations` folder names into production `src` code or test/documentation truth surfaces.
- Do not regress the direct standard-kind persistence model now that the remaining compatibility helper naming has been removed from schema-ddl/runtime.
- Prefer collapsing transitional contracts entirely over adding new adapter layers or new parallel abstractions.
- Treat docs/build/unit/integration validation as green for this slice, but do not claim final browser revalidation until the cold-start readiness bottleneck is either removed or bypassed with a confirmed spec pass.

## Recent Closed Focus

### 2026-04-14 Final QA Remediation Slice

- The newest remediation slice closed the remaining router/docs drift, breadcrumb href debt, create-via-edit RBAC coupling, and live frontend dependencies on the old managed-standard-kind folder names.
- The branch baseline for this wave is now “code and focused validation aligned to the final entity-owned contract, with only the cold-start browser rerun still pending.”

### 2026-04-12 Shared Dialog, Shell, And Fixture Follow-Ups

- The accepted `EntityFormDialog` first-open hydration fix, shared shell spacing contract, and self-hosted fixture/import QA closure remain valid and should not be reopened without fresh failing proof.
- Use [progress.md](progress.md) for the durable outcome details instead of expanding this file again.

### 2026-04-11 And Earlier Waves

- The earlier Entity V2 parity, automation, runtime, and Shared/Common closure waves remain archived in [progress.md](progress.md) and their durable rules remain in [systemPatterns.md](systemPatterns.md).

## Immediate Next Steps

1. Treat any further elimination of `catalog` / `hub` / `set` / `enumeration` folder names under `domains/entities/standard/**` as a larger runtime refactor, not a dead-wrapper cleanup.
2. If the user wants an additional QA pass, run the touched Playwright flows against a ready server to convert the updated browser truth surfaces into executed proof.
3. Keep any future backend entity-route unification work scoped to real behavior gaps, not just the documented internal controller reuse.

## Constraints to Preserve

1. Full refactor is permitted internally, but legacy Catalogs/Sets/Enumerations must remain user-visible until entity-based replacements pass acceptance.
2. `_mhb_objects.kind` accepts both built-in and custom kind values.
3. Snapshot format version bumps from 2 to 3 with backward compatibility for v2 imports.
4. All existing E2E tests must remain green at every phase boundary — EN/RU pixel-perfect parity is required for Catalogs v2.
5. ECAE implementation (Actions + Events) and the form-driven Zerocode MVP are part of current scope, not deferred.
6. `Entities` must appear below `Common`, and `Catalogs v2` must be published through the new dynamic menu mechanism, not hardcoded.
7. Future-ready: ComponentManifest JSON remains the stable contract for advanced Zerocode tooling and AOT compilation.
8. Arbitrary custom-type components stay gated until the corresponding design-time service and runtime path are proven generic or adapter-backed.
9. Catalogs v2 parity must reuse the existing platform system-attribute governance helpers, preserve applications-frontend page-surface behavior, and prove legacy/new mutual visibility rather than relying on indirect implementation evidence alone.

## References

- [entity-component-architecture-plan-2026-04-08.md](plan/entity-component-architecture-plan-2026-04-08.md)
- [creative-entity-component-architecture.md](creative/creative-entity-component-architecture.md)
- [tasks.md](tasks.md)
- [progress.md](progress.md)
- [systemPatterns.md](systemPatterns.md)
- [techContext.md](techContext.md)
