# Active Context

> **Last Updated**: 2026-03-03
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Codename Auto-Convert UX Hardening — Completed

**Status**: ✅ Completed
**Date**: 2026-03-03

### Finalized in this pass

1. Extended shared codename sanitization flow so mixed-alphabet auto-conversion can be applied during codename auto-generation from Name (not only on manual codename blur).
2. Propagated settings-aware generation parameters (`allowMixed`, `autoConvertMixedAlphabets`) across all metahubs codename form flows that use auto-fill/sync generation.
3. Renamed and clarified settings text in admin + metahubs locales (EN/RU) so behavior explicitly covers both scenarios: Name-based auto-generation and manual blur normalization.
4. Preserved existing manual Codename field blur conversion behavior while eliminating generation-path inconsistency.

### Verified baseline

- `pnpm --filter @universo/metahubs-frontend lint` -> pass (`0` errors, `149` warnings)
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- `pnpm build` (root) -> pass (`56/56`, `5m23.968s`)

### Active Risk / Follow-up

- No new regressions introduced by this hardening pass.

## Current Focus: QA Debt Eradication — Completed

**Status**: ✅ Completed
**Date**: 2026-03-03

### Finalized in this pass

1. Closed remaining error-level lint blocker in `EnumerationValueList.tsx` by adding missing `editingEntityId` prop typing in `ValueFormFields` props declaration.
2. Added missing MSW handler for `GET /api/v1/metahubs/codename-defaults` in `src/__mocks__/handlers.ts` with a stable codename-default payload to remove noisy unhandled request behavior in frontend tests.
3. Re-verified targeted package quality gates (frontend lint/tests, backend tests, template tests) and confirmed all pass.
4. Re-verified full workspace integration with root `pnpm build` and confirmed green baseline.

### Verified baseline

- `pnpm --filter @universo/metahubs-frontend lint` -> pass (`0` errors, `149` warnings)
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `123` passed, `3` skipped)
- `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests)
- `pnpm build` (root) -> pass (`56/56`, `5m20.626s`)

### Active Risk / Follow-up

- No new regressions introduced by this remediation pass.
- Package-level lint remains error-clean; legacy warning-level debt is unchanged and can be reduced in a dedicated follow-up pass.

## Current Focus: QA Remediation — Root Attribute Codename Flow Hardening — Completed

**Status**: ✅ Completed
**Date**: 2026-03-03

### Finalized in this pass

1. **Root codename pipeline alignment**: `AttributeList.tsx` switched from legacy `sanitizeCodename`/`isValidCodename` to settings-aware `normalizeCodenameForStyle` + `isValidCodenameForStyle` in create/save validation paths.
2. **Global/per-level duplicate source wiring**: root attribute screen now reads `catalogs.attributeCodenameScope`, loads `allAttributeCodenames` in global mode, and passes the effective entity list through `ExistingCodenamesProvider`.
3. **Duplicate-safe save blocking**: root create `canSave` now enforces `!values._hasCodenameDuplicate`, ensuring button disable parity with child/action dialogs.
4. **Lint debt cleanup in touched file**: removed new/pre-existing warning hotspots in `AttributeList.tsx` (unsafe `any` casts and unstable hook dependency expression) while preserving behavior.

### Verified baseline

- `pnpm --filter @universo/metahubs-frontend exec eslint --ext .ts,.tsx src/domains/attributes/ui/AttributeList.tsx` -> pass (0 errors, 0 warnings)
- `pnpm --filter metahubs-backend test -- src/tests/routes/attributesRoutes.test.ts` -> pass (`6/6` tests)
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `123` passed, `3` skipped)
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests)
- `pnpm build` (root) -> pass (`56/56`, `4m46.265s`)

### Active Risk / Follow-up

- No open QA gaps remain in the previously identified root attribute codename scope.

## Current Focus: Codename Bug Fixes + Global Scope + Button Disable — Completed

**Status**: ✅ Completed
**Date**: 2026-03-03

### Finalized in this pass

1. **i18n + original case fix**: `CodenameField.tsx` used wrong i18n key prefix (`metahubs.validation.*` instead of `validation.*`) due to `consolidateMetahubsNamespace()` flattening. Also, `collectAllCodenameValues()` now returns `{original, lower}` pairs — error messages display original-case codename.
2. **Auto-convert mixed alphabets**: Restored by removing explicit `normalizeOnBlur` overrides from all 12 form builders. CodenameField's built-in `settingsBasedNormalize` (which calls `autoConvertMixedAlphabetsByFirstSymbol()` before `normalizeCodenameForStyle()`) was being bypassed.
3. **Disable buttons on duplicate**: Added `onDuplicateStatusChange` callback to `CodenameField` → wired in all 12 form builders via `setValue('_hasCodenameDuplicate', dup)` → added `!values._hasCodenameDuplicate` check to all 15 `canSave` functions.
4. **attributeCodenameScope global mode**: New backend endpoint `GET /attribute-codenames` using `findAllFlat()`. Frontend reads `catalogs.attributeCodenameScope` setting and when 'global', queries all codenames (root + children) for cross-level duplicate checking. Both `AttributeList` and `ChildAttributeList` share this data via `ExistingCodenamesProvider`.

### Verified baseline

- `pnpm build` (root) -> pass (`56/56`).

### Active Risk / Follow-up

- None. QA pass complete — found and fixed 1 bug (missing `allCodenames` cache invalidation in `AttributeList.tsx`) and 3 prettier formatting errors. All verified clean.

## Previous Focus: Admin i18n + Codename Duplicate Check + Element Settings — Completed

**Status**: ✅ Completed
**Date**: 2026-03-03

### Finalized in this pass

1. **Task 1 — "blur" i18n fix**: Replaced incorrect "blur" labels in admin settings with proper EN ("on Field Exit"/"when the field loses focus") and RU ("при выходе из поля"/"при потере фокуса") translations.
2. **Tasks 2+3 — Codename duplicate checking with VLC cross-locale uniqueness**: Built reactive duplicate-checking infrastructure (`ExistingCodenamesContext`, `useCodenameDuplicateCheck`, modified `CodenameField` wrapper) and integrated it across all 9 entity UI components (MetahubList, HubList, CatalogList, EnumerationList, EnumerationValueList, BranchList, ChildAttributeList, AttributeList, AttributeActions). VLC codenames are checked cross-locale — all locale values are collected into a flat set via `collectAllCodenameValues()`.
3. **Task 4 — Element copy/delete settings**: Added `catalogs.allowElementCopy` and `catalogs.allowElementDelete` to `METAHUB_SETTINGS_REGISTRY`, wired i18n (EN+RU), and implemented action filtering in `ElementList.tsx` via `useSettingValue`.
4. **QA cycle**: Comprehensive audit found 2 missed components (AttributeList.tsx and AttributeActions.tsx not integrated with duplicate checking). Fixed immediately.

### Verified baseline

- `pnpm build` (root) -> pass (`56/56`, `6m31s`).

### Active Risk / Follow-up

- Non-critical: `attributeCodenameScope: 'global'` mode not dynamically handled — current implementation checks within the passed entity array (correct for default 'per-level' scope). Enhancement deferred to separate scope.

## Current Focus: Catalog Actions Policy Parity Remediation Completed

**Status**: ✅ Completed
**Date**: 2026-03-02

### Finalized in this pass

1. Closed the remaining QA finding in metahubs frontend by aligning catalog action visibility with settings-based policy gating (`catalogs.allowCopy`, `catalogs.allowDelete`).
2. Applied a minimal frontend-only patch in `CatalogList` so both card and table action menus use filtered descriptors, consistent with existing hubs/enumerations behavior.
3. Kept backend policy enforcement unchanged (no route/service behavior modifications).
4. Re-validated quality gates for this change with strict file lint and full workspace build.

### Verified baseline

- `pnpm --filter @universo/metahubs-frontend exec eslint --max-warnings=0 --ext .ts,.tsx src/domains/catalogs/ui/CatalogList.tsx` -> pass.
- `pnpm build` (root) -> pass (`56/56`, `6m44.189s`).

### Active Risk / Follow-up

- No remaining QA findings in this remediation scope.

## Current Focus: Comprehensive QA Finalization Completed

**Status**: ✅ Completed
**Date**: 2026-03-02

### Finalized in this pass

1. Re-validated clean-database safety chain for admin bootstrap: `admin.locales` and `admin.settings` seed in `CreateAdminSchema1733400000000`, plus additive setting migration `AddCodenameAutoConvertMixedSetting1733500000000`.
2. Completed backend policy/data-operation audit for hubs, catalogs, enumerations, and attributes mutation flows; setting guards (`allowCopy`/`allowDelete` and attribute policy keys) remain enforced server-side.
3. Confirmed hub-scoped delete semantics: unlink from one hub is allowed while entity still has other hub associations; full entity deletion remains blocked by policy and blocker-reference checks.
4. Confirmed frontend policy parity for hubs/enumerations and identified a non-blocking parity debt for catalogs list actions (`CatalogList` currently uses raw `catalogActions` descriptors).
5. Re-ran full workspace baseline: `pnpm build` passes (`56/56`).

### Active Risk / Follow-up

- Open (non-blocking): align `CatalogList` action visibility with settings (`catalogs.allowCopy`, `catalogs.allowDelete`) to remove UX inconsistency.
- Deferred (separate scope): address long-standing Flowise chunk-size and Sass deprecation build warnings.

## Current Focus: Metahub Language/Codename/Attribute Policy Fixes Completed

**Status**: ✅ Completed
**Date**: 2026-03-02

### Finalized in this pass

1. Confirmed and closed requested metahub behavior updates: `general.language` (`system` + dynamic locale options), VLC default locale propagation in create flows, localized codename rendering in attributes tables, attribute copy/delete policy controls, and compact allowed-attribute-types UI.
2. Added a final source-level hardening fix for codename blur handling by wiring style-aware `normalizeOnBlur` into all main `CodenameField` usage points, preventing unintended fallback to legacy kebab normalization in Pascal/VLC scenarios.
3. Added missing settings UX dependency rule: `catalogs.allowDeleteLastDisplayAttribute` is now hidden when `catalogs.allowAttributeDelete` is disabled.

### Verified baseline

- `pnpm --filter @universo/metahubs-frontend lint` -> pass (`0` errors, warnings only).
- `pnpm build` (root) -> pass (`56/56`, `5m0.269s`).

### Active Risk / Follow-up

- Deferred (separate scope): repository-wide legacy warning debt remains outside this focused implementation closure.

## Current Focus: Post-QA Debt Cleanup Completed

**Status**: ✅ Completed
**Date**: 2026-03-02

### Finalized in this pass

1. Closed remaining warning-level lint debt in changed `@universo/metahubs-frontend` files with targeted type/dependency cleanup.
2. Completed strict changed-files verification (`--max-warnings=0`) with zero warnings.
3. Re-ran full workspace validation and confirmed cross-package integrity.

### Verified baseline

- Strict lint across changed `@universo/metahubs-frontend` source files -> pass (`--max-warnings=0`, no warnings).
- `pnpm build` (root) -> pass (`56/56`, `5m28.522s`).

### Active Risk / Follow-up

- Deferred (separate scope): large legacy warning debt remains outside changed-file scope.

## Current Focus: Codename UX/Settings Refinement Completed

**Status**: ✅ Completed
**Date**: 2026-03-02

### Finalized in this pass

1. Completed codename settings parity changes across metahubs + admin for preview behavior, mixed-alphabet auto-conversion setting, and dynamic helper text handling.
2. Closed copy normalization regression for PascalCase (`Покупки (копия)` -> `ПокупкиКопия`) in shared codename normalization utilities.
3. Added and wired `general.codenameAutoConvertMixedAlphabets` end-to-end (types/registry, backend defaults and API response, frontend settings hooks/pages).
4. Fixed verification-time formatting regressions in settings UI wrappers and re-ran lint/test/build successfully.

### Verified baseline

- `pnpm --filter @universo/utils lint` -> pass (0 errors, warnings only).
- `pnpm --filter @universo/template-mui lint` -> pass (0 errors, warnings only).
- `pnpm --filter @universo/types lint` -> pass (0 errors, warnings only).
- `pnpm --filter @universo/metahubs-backend lint` -> pass (0 errors, warnings only).
- `pnpm --filter @universo/metahubs-frontend lint` -> pass (error-level clean, warnings only).
- `pnpm --filter @universo/admin-backend lint` -> pass (0 errors, warnings only).
- `pnpm --filter @universo/admin-frontend lint` -> pass (0 errors, warnings only).
- `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests).
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `123` passed, `3` skipped).
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests).
- `pnpm --filter @universo/utils test` -> pass (`10/10` files, `154/154` tests).
- `pnpm build` (root) -> pass (`56/56`, `5m25.055s`).

### Active Risk / Follow-up

- Deferred (planned): add explicit route tests for new metahub codename defaults payload fields and admin settings new key validation paths.
- Deferred (separate scope): reduce legacy lint warning debt (`no-explicit-any`, hook deps) outside this focused feature scope.

## Current Focus: QA Safety Remediation Hardening Completed

**Status**: ✅ Completed
**Date**: 2026-03-02

### Finalized in this pass

1. Completed backend hardening for catalogs/attributes QA findings (kind guards, restore conflict handling, permanent-delete blockers, `isSingleHub` parity checks).
2. Added race-safety lock handling for global attribute codename scope and covered the lock-failure path in route tests.
3. Fixed strict TypeScript regressions introduced during hardening by narrowing `hubs` and localized `_primary` access in `catalogsRoutes.ts`.
4. Re-verified package and workspace builds after fixes and synchronized Memory Bank closure.

### Verified baseline

- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/catalogsRoutes.test.ts src/tests/routes/attributesRoutes.test.ts` -> pass (`30/30`).
- `pnpm --filter @universo/metahubs-backend lint` -> pass (`0` errors, warnings only).
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `123` passed, `3` skipped).
- `pnpm --filter @universo/metahubs-backend build` -> pass.
- `pnpm build` (root) -> pass (`56/56`, `5m41.147s`).

### Active Risk / Follow-up

- Deferred (separate scope): reduce legacy lint warning debt (`no-explicit-any`, hooks dependency warnings) outside this remediation scope.
- Deferred (planned): add dedicated `@universo/admin-backend` route harness/tests for settings CRUD and permission scenarios.

## Current Focus: VLC UX & Settings Consistency Fixes Completed

**Status**: ✅ Completed
**Date**: 2026-03-02

### Finalized in this pass

1. Completed localized codename UX fixes: locale sync behavior (switch vs add), connector alignment, and localized blur normalization.
2. Extended `useCodenameVlcSync` usage across all relevant metahub entity forms (not only metahub forms).
3. Removed duplicate `common.defaultLocale` setting from metahub registry and added an informational placeholder for empty `Common` tab.
4. Localized `catalogs.allowedAttributeTypes` labels and enforced allowed-type filtering in attribute and child-attribute create dialogs.
5. Resolved new lint/build blockers introduced during this pass (`AttributeList`, `ChildAttributeList`, and typed VLC locale construction in `useCodenameVlcSync`).

### Verified baseline

- `pnpm --filter @universo/template-mui lint` -> pass (`0` errors, warnings only).
- `pnpm --filter @universo/metahubs-frontend lint` -> pass (`0` errors, warnings only).
- `pnpm --filter @universo/types lint` -> pass (`0` errors, warnings only).
- `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests).
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests).
- `pnpm build` (root) -> pass (`56/56` tasks, `4m54.002s`).

### Active Risk / Follow-up

- Deferred (planned): add dedicated route tests for `@universo/admin-backend` settings CRUD once test harness is introduced.
- Deferred (separate scope): reduce legacy lint warning debt (`no-explicit-any`, hooks deps) outside current feature scope.

---

## Current Focus: QA Findings Fix Completed

**Status**: ✅ Completed
**Date**: 2026-03-02

### Finalized in this pass

1. **Admin auth fix**: Replaced admin-only `useAdminMetahubDefaults` (calling `/admin/settings/metahubs` with `ensureGlobalAccess`) with `usePlatformCodenameDefaults` calling a new public endpoint `GET /metahubs/codename-defaults`. Any authenticated user can now access platform-level codename defaults when creating a new metahub.
2. **New backend endpoint**: Added `GET /metahubs/codename-defaults` in `metahubsRoutes.ts` — reuses existing `getGlobalMetahubCodenameConfig()` to return `{ style, alphabet, allowMixed, localizedEnabled }`. Protected only by `ensureAuth` (standard user auth), not admin role.
3. **DEFAULT_CC type completeness**: Added `localizedEnabled: false` to all 6 `DEFAULT_CC` objects (MetahubActions, AttributeActions, BranchActions, HubActions, CatalogActions, EnumerationActions) to satisfy `CodenameConfig` type contract.
4. **Prettier fixes**: Reformatted `DEFAULT_CC` to multiline (Prettier max line length) and fixed `.some()` callback formatting in `useCodenameVlcSync.ts`.
5. **useCodenameVlcSync optimization**: Replaced `codenameVlc` in first `useEffect` dependency array with `codenameVlcRef` to eliminate unnecessary re-render cycle when auto-filling codename values.

### Verified baseline

- `pnpm --filter @universo/template-mui lint` -> pass (0 errors).
- `pnpm --filter @universo/metahubs-frontend lint` -> pass (0 errors).
- `pnpm --filter @universo/metahubs-backend lint` -> pass (0 errors).
- `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests).
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `117` passed, `3` skipped).
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests).
- `pnpm build` (root) -> pass (`56/56` tasks, `5m23.313s`).

### Active Risk / Follow-up

- **Deferred (planned)**: add route tests for admin settings CRUD and permission/error scenarios after introducing a test harness for `@universo/admin-backend`.
- **Deferred (separate scope)**: dependency vulnerability remediation in flowise-related packages (from audit output).

---

## Previous Focus: Settings UX & VLC Fixes Completed

**Status**: ✅ Completed
**Date**: 2026-03-02

### Finalized in this pass

1. **Toggle flickering fix**: Both metahub settings and admin settings now use `queryClient.setQueryData()` with mutation response data before `invalidateQueries()`, preventing stale-data flash after save.
2. **VLC codename auto-generation**: New `useCodenameVlcSync` hook in `@universo/template-mui` syncs the plain codename auto-fill into the VLC `codenameVlc` field when localized codenames are enabled.
3. **VLC language sync**: Same hook also syncs the name field's primary locale switch to the codename field when codename is empty/untouched.
4. **Admin VLC fallback for new metahub**: `useCodenameConfig` now fetches admin-level metahub defaults from `/admin/settings/metahubs` when no `metahubId` is in the URL (new metahub creation), using them as intermediate fallback before hardcoded defaults.
5. **Migration merge**: `codename_localized JSONB` column merged into the main `CreateMetahubsSchema` migration for both `metahubs.metahubs` and `metahubs.metahubs_branches` tables. Legacy `AddCodenameLocalizedColumns` migration file deleted.

### Verified baseline

- `pnpm --filter @universo/template-mui lint` -> pass (warnings only).
- `pnpm --filter @universo/metahubs-frontend lint` -> pass (warnings only).
- `pnpm --filter @universo/admin-backend lint` -> pass (warnings only).
- `pnpm --filter @universo/metahubs-backend lint` -> pass (warnings only).
- `pnpm --filter @universo/template-mui test` -> pass (`10/10` suites, `169/169` tests).
- `pnpm --filter @universo/metahubs-backend test` -> pass (`17/17` suites, `120` total with `3` skipped).
- `pnpm --filter @universo/metahubs-frontend test` -> pass (`22/22` files, `97/97` tests).
- `pnpm build` (root) -> pass (`56/56` tasks, `4m33.455s`).

### Active Risk / Follow-up

- **Deferred (planned)**: add route tests for admin settings CRUD and permission/error scenarios after introducing a test harness for `@universo/admin-backend`.
- **Deferred (separate scope)**: dependency vulnerability remediation in flowise-related packages (from audit output).

---

## Current Focus: QA Risk Closure Completed

**Status**: ✅ Completed
**Date**: 2026-03-02

### Finalized in this pass

1. Backend race/TOCTOU fixes completed for catalogs/hubs/enumerations/attributes routes (conflict-safe create handling and safer hub-association updates).
2. Frontend codename-settings reactivity fixed in memoized callbacks/dependencies for key metahubs entity lists.
3. Post-fix lint/test/build verification completed and memory-bank closure synchronized.

### Verified baseline

- `pnpm --filter @universo/metahubs-backend lint && pnpm --filter @universo/metahubs-frontend lint` -> no error-level diagnostics.
- `pnpm --filter @universo/metahubs-backend test` -> `17/17` suites passed (`120` tests, `3` skipped).
- `pnpm --filter @universo/metahubs-frontend test` -> `22/22` test files passed (`97/97` tests).
- `pnpm build` (root) -> `56/56` tasks successful (`4m35.871s`).

### Active Risk / Follow-up

- **Deferred (planned)**: add route tests for admin settings CRUD and permission/error scenarios after introducing a test harness for `@universo/admin-backend`.
- **Deferred (separate scope)**: dependency vulnerability remediation in flowise-related packages (from audit output).

---

## Previous Focus: QA Hardening Closure Fully Verified

**Status**: ✅ Completed and re-validated
**Date**: 2026-03-02

### Finalized in this session

1. **Delete policy enforcement hardened** — catalog and enumeration delete routes now enforce `allowDelete` in all destructive paths (hub-scoped + permanent where applicable).
2. **Unsupported setting removed** — `enumerations.allowedValueTypes` removed from registry, helper usage, and UI locale exposure to eliminate misleading configuration surface.
3. **Type diagnostics cleaned** — settings typing in frontend/admin pages shifted to local unions; admin frontend `tsconfig` switched to `noEmit` to avoid declaration-output conflicts.
4. **Quality gates rerun complete** — lint, targeted route tests, diagnostics, and full workspace build pass.

### Verified baseline

- `@universo/metahubs-backend`: targeted catalogs/enumerations route suites pass (`29/29` tests).
- `@universo/metahubs-backend`, `@universo/metahubs-frontend`, `@universo/admin-frontend`: quiet lint clean.
- IDE diagnostics scan: no active TypeScript errors in changed packages.
- Full workspace build: `pnpm build` passes (`56/56` tasks).

### Active Risk / Follow-up

- **Deferred (planned)**: add route tests for admin settings CRUD and permission/error scenarios after introducing a test harness for `@universo/admin-backend`.
- **Deferred (separate scope)**: dependency vulnerability remediation in flowise-related packages (from audit output).

---

## Current Focus: Comprehensive QA Remediation Fully Closed

**Status**: ✅ Completed
**Date**: 2026-03-02

### Finalized in this session

1. **Backend integrity fixes completed** — settings upsert now safely revives soft-deleted rows on key conflict paths; branch codename validation is settings-aware; attribute TABLE child copy flow handles global codename uniqueness.
2. **Template package tests stabilized** — `RoleChip` and `createEntityActions` Jest suites aligned to current component/notistack behavior.
3. **Lint debt in active scope cleared** — `@universo/utils` formatting errors auto-fixed, backend touched files auto-formatted, and lint reruns completed without errors.
4. **Validation pipeline closed** — targeted backend tests + full template tests + full workspace build all passed.

### Verified baseline

- `pnpm --filter @universo/template-mui test` -> `10/10` suites, `168/168` tests.
- `pnpm --filter @universo/metahubs-backend test -- src/tests/routes/attributesRoutes.test.ts src/tests/routes/branchesOptions.test.ts` -> `10/10` tests.
- `pnpm --filter @universo/utils lint` -> `0 errors` (warnings only).
- `pnpm --filter @universo/metahubs-backend lint` -> `0 errors` (warnings only).
- `pnpm build` (root) -> `56/56` tasks successful (`4m35.893s`).

### Active Risk / Follow-up

- **Deferred (planned)**: add route tests for admin settings CRUD and permission/error scenarios after introducing a test harness for `@universo/admin-backend`.
- **Deferred (separate scope)**: dependency vulnerability remediation in flowise-related packages (from audit output).

---

## Current Focus: Codename VLC End-to-End Closure Fully Verified

**Status**: ✅ Completed
**Date**: 2026-03-02

### Finalized in this session

1. **Closure checklist completed** — codename VLC parity validation and regression checks finalized across metahubs frontend/backend.
2. **Frontend lint blocker removed** — deleted stray `codenameVlc: null` artifact in `BranchList.tsx` table columns.
3. **Backend compile blockers fixed** — normalized `codenameInput` unknown payload to `Record<string, string | undefined>` before `sanitizeLocalizedInput` in attributes/catalogs/enumerations route helpers.
4. **Root build re-verified** — full workspace build passed after fixes.

### Verified baseline

- `pnpm --filter @universo/metahubs-frontend lint` -> 0 errors (warnings only).
- `pnpm --filter @universo/metahubs-backend lint` + direct eslint autofix -> 0 errors (warnings only).
- `pnpm --filter @universo/metahubs-backend build` -> success.
- `pnpm build` (root) -> `56 successful, 56 total` (`4m56.836s`).

### Active Risk / Follow-up

- **Deferred (planned)**: add route tests for admin settings CRUD and permission/error scenarios after introducing a test harness for `@universo/admin-backend`.
- **Deferred (separate scope)**: dependency vulnerability remediation in flowise-related packages (from audit output).

---

## Previous Focus: Codename Settings Overhaul Complete + QA Fixes Applied (2026-03-01)

**Status**: ✅ 8 phases, ~30 files, build 56/56
**Details**: See progress.md

---

## Current Project State

- **Build**: 56/56 packages passing (`pnpm build`)
- **Active Feature**: Comprehensive QA remediation closure fully verified and completed
- **Key Packages**: admin-backend, admin-frontend, metahubs-backend, metahubs-frontend, universo-template-mui, flowise-core-backend
- **Codename Defaults**: `pascal-case` style, `en-ru` alphabet, mixed alphabets disallowed
- **Admin Settings Seed**: 3 settings in `admin.settings` table (codenameStyle, codenameAlphabet, codenameAllowMixedAlphabets)

## Key Technical Context

- **Circular build dependency**: template-mui builds before metahubs-frontend; solved with `(m: any)` cast in lazy imports
- **CollapsibleSection**: Reusable component in universo-template-mui
- **DDL after transaction**: Knex DDL runs after TypeORM transaction commit to avoid deadlocks
- **ConfirmDialog pattern**: Each page using `useConfirm()` must render its own `<ConfirmDialog />` instance
- **Copy mechanism**: `generateCopyName()` + i18n " (copy N)" suffix + advisory locks
- **Codename validation**: `getCodenameSettings()` batch helper in codenameStyleHelper.ts for parallel style+alphabet queries
- **validateSettingValue**: Shared module at `domains/shared/validateSettingValue.ts`

---

## Immediate Next Steps

1. Implement follow-up test harness and route tests for `@universo/admin-backend`.
2. Run targeted package checks once tests are introduced.
3. Proceed to QA mode for independent validation of this closure state.
