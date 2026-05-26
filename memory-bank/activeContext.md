# Active Context

> Current-focus memory only. Completed implementation detail belongs in progress.md; active and follow-up checklists belong in tasks.md.

---

## Current Focus: Memory Bank Compression (2026-05-23)

-   Running comprehensive MB compression to optimize file sizes and information density.
-   Archiving older tasks and detailed implementation progress into the historical log (`progress.md`).
-   Updating the GitHub releases version history table to include `0.63.0-alpha` and `0.64.0-alpha`.
-   Following the structured sequential phase checklist defined in `tasks.md` and custom modes.
-   Validating cross-references, file structure, and factual freshness.
-   Post-compression: perform the 12-point self-validation rubric scoring to ensure target ranges are met without over-compression.
-   Ensure that `activeContext.md` contains at least 120 lines to satisfy its 80% upper bound rule.
-   Current constraints dictate that all historical implementation summaries (anything > 1 week old) be moved completely to `progress.md`.

## Recent Focus: Packages Naming Convention Rollout (Complete)

-   Renamed all 32 active workspace packages to the canonical
    `packages/universo-react-<name>/` directory convention and
    `@universo-react/<name>` package-name convention.
-   Flattened legacy `universo-*` names during the rename; no
    `universo-react-universo-*` package names, legacy aliases, compatibility
    re-exports, npm publish aliases, or symlinks were introduced.
-   Updated active imports, package manifests, root scripts, Turbo/Vitest/Jest/
    Playwright tooling, CI instructions, agent guidance, GitBook docs, package
    READMEs, steering docs, and Memory Bank references to the new scope.
-   Published the convention in `.kiro/steering/structure.md` and
    `memory-bank/techContext.md`.
-   Added fail-closed guards for package naming, stale package base paths,
    `apps-template-mui` isolation, React bundle loading, and workspace
    dependency graph drift.
-   QA closure hardened the package naming guard so active docs/tooling/guidance
    now fail closed on double-prefix references, stale removed package examples,
    and generic active package layout text.
-   The main CI workflow now runs package naming and apps-template isolation
    guards alongside the existing flattened-layout and DB access checks.
-   `tools/lint-db-access.mjs` Tier 3 exclusion paths were synchronized with the
    renamed `packages/universo-react-*` directories and now passes with zero
    violations.
-   No database schema version or metahub template version was bumped; the LMS
    snapshot hash was refreshed from the canonical snapshot content only.
-   Verification included frozen install, full build, lint, Vitest, backend Jest
    matrix, docs checks, local minimal Supabase build, and Playwright smoke.

## Recent Focus: 1C-Compatible Metahub Template Implementation (Complete)

-   Added an opt-in `1C-Compatible` metahub template with codename
    `1c-compatible`; `DEFAULT_TEMPLATE_CODENAME` remains `basic`.
-   Added reusable typed Entity Type Constructor behavior contracts in
    `@universo-react/types` for `singleValue`, `catalogBehavior`,
    `documentBehavior`, `documentPosting`, `journalBehavior`,
    `registerBehavior`, `accountChartBehavior`, `dynamicCharacteristic`, and
    `calculationTypeGraph`.
-   Registered the full 12-preset catalog as explicit manifests. The core
    materialized template seeds are top-level Constant, existing Enumeration,
    Catalog, Document, Document Journal, Information Register, and Accumulation
    Register; accounting/calculation manifests remain preview and
    non-materializable until their engines, UI, storage, and tests are complete.
-   Kept the architecture metadata-driven: the new presets use specialized
    typed config sections instead of extending `ObjectRecordBehavior` as the
    primary model and instead of adding 1C-only runtime branches.
-   Extended template manifest validation so typed behavior configs are checked
    on both preset-level `entityType.config` and `defaultInstances[].config`,
    and behavior cross-references are validated against the enabled template
    seed graph after preset toggles are applied.
-   Added a generic `systemTemplatePreset` marker for template-managed entity
    types and protected those rows from structural update/delete while blocking
    user-authored custom types from claiming the marker.
-   Corrected top-level Constant capabilities so constants do not inherit
    object/document lifecycle, hierarchy, posting, modules, or records behavior.
-   Added fail-closed unit coverage for config normalization, strict unknown
    keys, behavior/reference validation, preset registration, default-instance
    config validation, protected template-managed types, preview
    non-materialization, preset-toggle dangling references, and built-in
    template compatibility.
-   Updated the existing template selector with localized EN/RU preview status
    and non-affiliation copy for `1C-Compatible`, reusing current MUI
    primitives.
-   Added GitBook EN/RU documentation and a clean-room/non-affiliation docs
    checker. The docs explicitly state that the template is not an official 1C
    product, certification, endorsement, partnership, or copied asset/import.
-   Added local minimal Supabase Playwright coverage tagged `@1c-compatible`
    and `@runtime-ux-canary`; the flow verifies template registration, default
    `basic` behavior, RU template selection, keyboard creation, viewport/no
    overflow checks, seeded 1C kind keys, and runtime UX leakage guardrails
    without using `pnpm dev`.
-   Validation passed: focused type tests/build, metahubs backend focused tests
    and build, metahubs frontend lint/build, GitBook checks, clean-room docs
    check, full E2E build on local minimal Supabase, and Playwright
    `@1c-compatible|@runtime-ux-canary` run.
-   Post-QA verification also passed focused package lint for `types`,
    `metahubs-backend`, and `metahubs-frontend`; local minimal Supabase was
    stopped after the Playwright run.
-   Security QA closure reserved all registered platform preset `kindKey`
    values from custom Entity Type Constructor creation, including 1C-like keys
    such as `document`, `catalog`, and register kinds.
-   Template-managed object-like preset kinds now reuse generic Object metadata
    policies and nested route handlers only when the row is a registered
    preset-managed type; spoofed markers and non-template-managed rows do not
    receive standard Object behavior.
-   Preset sync fails closed if an existing non-template-managed row already
    owns a platform preset `kindKey`, preventing silent overwrite of legacy or
    custom entity type rows.
-   Nested Object-compatible creation now requires `createContent`, matching
    generic entity creation role semantics.
-   Security QA verification passed focused backend Jest/build/lint, types
    test/build/lint, metahubs frontend build/lint, docs checks, local minimal
    Supabase doctor/build, and Playwright `@1c-compatible|@runtime-ux-canary`;
    local minimal Supabase was stopped after the run.
-   Route isolation closure now forces specialized object-compatible nested
    route kinds into the effective query/body contract, so `document`,
    `catalog`, and register-like route surfaces cannot be widened through
    conflicting `kindKey` query/body input.
-   Runtime UX evidence now opens the created 1C-compatible metahub entity type
    workspace in RU, checks localized preset labels/no technical leakage/no
    overflow, and keyboard-navigates from the Catalog entity type action menu
    to its instances page.
-   Final closure verification passed the focused backend metadata/schema route
    matrix with 138 tests, package lint/build checks, docs guard, full local
    minimal Supabase `build:e2e:local-supabase`, and Playwright
    `@1c-compatible|@runtime-ux-canary`; local minimal Supabase was stopped
    after the run.
-   Requisites runtime QA closure removed PostgreSQL/storage and raw data-type
    codes from normal requisite/component surfaces and fixed `oneCCompatible`
    i18n namespace registration so RU pages no longer fall back to English.
-   Direct 1C-compatible route regression coverage now includes access denial,
    deterministic create collisions, route-owned kind overrides, and stored-kind
    mismatch rejection across read/write/delete/copy/restore paths.
-   The direct top-level hub listing route now uses `MetahubTreeEntitiesService`
    instead of generic object CRUD, keeping the normal hub page free of
    background 400 responses during browser runtime checks.
-   Latest verification passed focused backend Jest with 59 tests, focused
    frontend Vitest with 5 tests, metahubs frontend/backend lint, docs checks,
    full local minimal Supabase E2E build, and Playwright `@1c-compatible` with
    4/4 tests passing.

## Recent Focus: Scripts To Modules Rename (Complete)

-   Renamed the attached TypeScript-code capability from Scripts/Scripting to Modules across shared contracts, backend routes/stores, frontend authoring UI, runtime widget execution, SDK names, fixtures, E2E specs, and GitBook docs.
-   Fresh-database rename only: no `/scripts` aliases, compatibility shims, schema/template version bump, or legacy migration path.
-   Canonical contracts now use `modules`, `_mhb_modules`, `_app_modules`, `/modules`, `/module/:moduleId`, `/runtime/modules`, `moduleId`, `moduleCodename`, `ModuleRole`, and `@universo-react/modules-engine`.
-   LMS template and fixture posting handlers now use `*PostingModule` codenames/classes and refreshed snapshot hash.
-   Browser QA evidence for authoring and runtime module surfaces was captured through local minimal Supabase Playwright flows.
-   Allowed residual `script` terms are limited to HTML/security contexts, package manager `scripts`, shell/E2E scripts, external TypeScript/node APIs such as `ts.ScriptTarget`, `node:vm Script`, and isolated-vm `compileScript`.
-   Details: progress.md#2026-05-25

## Recent Focus: Flatten Base Directory Layout (Complete)

-   Removed the unused package-root `base` layer from active workspace packages.
-   Active React package roots now use `packages/universo-react-<name>/package.json`; `pnpm-workspace.yaml` uses `packages/*`.
-   Updated workspace, Turbo/package export, local Supabase, E2E runner, OpenAPI/docs tooling, agent, Kiro, GitBook, and package README references to the flat layout.
-   Added `tools/check-no-package-base-paths.mjs` and root `check:no-package-base-paths` to fail closed on stale active package-base paths and layout guidance.
-   Verified the final closure with Prettier, stale-path check, package directory inventory, full build, full lint, full Vitest workspace run, and local minimal Supabase Playwright smoke.
-   Agents still must not run `pnpm dev`; Playwright evidence uses the repository E2E runner on `http://127.0.0.1:3100`.

## Recent Focus: 1C-Compatible Runtime UX QA Closure (Complete)

-   The opt-in `1c-compatible` template no longer shows duplicate preview labeling in the template selector.
-   Russian template copy now uses the requested non-affiliation wording and removes the old optional-template sentence.
-   Preset display names are neutral metadata-object names such as Constants, Catalogs, Documents, Document Journals, and Registers; the old compatibility prefix is not used for entity type names.
-   Generic entity-instance collection pages now use metadata-driven presentation names, action labels, and create-dialog titles, so template-managed/custom surfaces do not leak raw `ui.nameKey`, `entity-owned`, or `Создать сущность` copy.
-   The Entity Type Constructor exposes user-facing behavior profiles that populate capabilities and typed configs for constants, catalogs, documents, journals, and register-style presets without manual JSON-only setup.
-   Verification passed with focused unit tests, backend tests, docs checks, frontend/backend lint/build, full local minimal Supabase E2E build, and Playwright `@1c-compatible|@runtime-ux-canary`; local minimal Supabase was stopped after the run.

## Recent Focus: 1C-Compatible Constructor UX And Lifecycle QA Closure (Complete)

-   Entity Type Constructor list and card surfaces now use reusable behavior
    profile metadata for user-facing capabilities and no longer show raw
    `kindKey`, behavior keys, or mixed localized copy on normal user surfaces.
-   Template-managed 1C-compatible settings now expose requisites/register
    terminology through seeded settings and localized labels instead of generic
    component wording where the metadata object expects requisites.
-   Shared resources for 1C-compatible metahubs use the common requisites
    surface and no longer expose the generic unavailable-container message.
-   The 1C-compatible Playwright canary now covers the full browser path:
    template selection, viewport-safe listbox/dialog rendering, created entity
    type workspace, instance pages, resources/settings, the default hub
    instances 400-regression guard, and create/edit/copy/delete lifecycle for
    Constant, Catalog, Document, Document Journal, Information Register, and
    Accumulation Register.
-   The latest 1C-compatible full preset QA remediation ships all 12 preset
    kinds from the template manifest, seeds system components for every
    object-like 1C-compatible kind, enforces route-kind isolation across
    component/requisite handlers, and localizes requisite/register-field
    lifecycle terminology. Verification passed with Prettier, focused
    backend/frontend/types tests, backend/frontend lint/build, docs guard,
    full local minimal Supabase `build:e2e`, Playwright `@1c-compatible` 4/4,
    and the local Supabase profile stopped after the run.
-   The latest runtime QA remediation keeps 1C-compatible container/subsystem
    columns hidden until the corresponding capability is enabled, exposes local
    requisites through dedicated `/requisites` pages with an accessible Open
    Requisites action, renames shared resources to Requisites, and registers
    distinct sidebar icons for the new preset kinds.
-   The latest QA findings closure enforces 1C-compatible constant lifecycle
    policy, rejects mismatched specialized requisite routes, fixes copied
    requisite deletion cleanup, removes dynamic dialog `key` spread warnings,
    and strengthens Playwright coverage for real UI metahub creation, exact
    preset drift, responsive picker, keyboard edit access, and requisite
    lifecycle flows.
-   Verification passed with Prettier, focused frontend/backend tests, frontend
    and backend/template-mui lint/build checks, docs checks, full local minimal
    Supabase E2E build, and Playwright `@1c-compatible` with 4/4 tests passing;
    local minimal Supabase was stopped after the run.

## Recent Focus: Object Collections And Components Rename (Complete)

-   Replaced Catalogs/Attributes with Objects/Components across UI and metadata.
-   Internal surface/helper name is `objectCollection`, persisted kind key is `object`.
-   System metadata tables updated to `_mhb_components` and `_app_components`.
-   Runtime physical table names come from constructor capabilities (`obj_` prefix).
-   Recommended vocabulary: user-facing `Objects` / `Объекты`.
-   Details: progress.md#2026-05-14

## Recent Focus: Local Supabase Env Profile Generation (Complete)

-   Local Supabase env generation derives backend profiles from normal env source order.
-   Development source order: `packages/universo-react-core-backend/.env`, `.env.example`, minimal fallback.
-   E2E source order: `.env.e2e`, `.env`, `.env.e2e.example`, `.env.example`, fallback.
-   Preserves unrelated application settings, replaces only connection values and safe missing defaults.
-   README and GitBook docs describe preserved-settings workflow, hosted/local switching, and local E2E stack.
-   Details: progress.md#2026-05-13

## Recent Focus: Scoped Menu Contract & Layouts QA Closure (Complete)

-   Menu widget authoring uses neutral `section`, `hub`, and `link` item kinds.
-   Entity section targets discovered from layout-capable Entity type metadata.
-   Shared schemas, templates, and fixtures use `autoShowAllSections`.
-   Global layout widgets expose generic per-Entity visibility controls for every layout-capable scope.
-   Generic layout scope contracts use `scopeEntityId`, public contracts use `scopedLayouts` and `layoutWidgetOverrides`.
-   Metahub layout creation validates scoped targets through Entity component capability metadata.
-   Runtime layout selection resolves preferred Entity scope from application navigation.
-   Details: progress.md#2026-05-13 and progress.md#2026-05-12

## Current Guardrails

-   **E2E Testing Boundaries**: Browser E2E must use the dedicated E2E boundary: hosted dedicated `.env.e2e.local` / `.env.e2e` by default, or the dedicated local Supabase profile on ports `55321/55322/55323` when local mode is explicitly requested.
-   **Agent Restrictions**: Agents must not use `pnpm dev` or port `3000` for Playwright E2E. The repository E2E runner owns startup on `http://127.0.0.1:3100`.
-   **Main Supabase Testing**: Shared/main Supabase E2E mode is only for manual debugging and must require `E2E_ALLOW_MAIN_SUPABASE=true` plus `E2E_FULL_RESET_MODE=off`.
-   **Local Supabase Scripts**: Local Supabase app-start scripts have two supported profiles: full stack (`start:local-supabase`) and minimal stack (`start:local-supabase:minimal`). Both must keep `doctor:local-supabase` before app startup/reset and must pass explicit `.env.local-supabase` profiles.
-   **Local URL Distinction**: Local Supabase docs must distinguish Supabase Studio (`http://127.0.0.1:54323`) from the local API URL (`http://127.0.0.1:54321`).
-   **Legacy Avoidance**: Do not reintroduce `includeBuiltins`, `isBuiltin`, `source`, `custom.*-v2`, old top-level managed route families, or deleted frontend `domains/catalogs|hubs|sets|enumerations` folder names.
-   **Runtime Workspaces**: Runtime workspace management stays on isolated `apps-template-mui` card/list patterns.
-   **Public Exposure**: Keep public-runtime exposure tied to publication-backed state, not raw design-time flags.
-   **Form Hydration**: Keep the `EntityFormDialog` first-open state hydration pattern intact (no render-phase ref writes).
-   **Fixtures Maintenance**: Future fixture changes must be regenerated through documented Playwright generator specs.

## Constraints to Preserve

1. **Canonical Terminology**: Fresh Object/Component terminology is canonical: standard built-in kind key `object`, standard component resource route segment `components`, and standard capability manifest key `capabilities`.
2. **Entity Kinds Validation**: `_mhb_objects.kind` accepts built-in and custom kind values; custom entity kinds may define their own table prefixes through the entity constructor metadata.
3. **Snapshot Versions**: Snapshot schema/template version numbers were intentionally not bumped for this fresh-database migration.
4. **Compatibility Limits**: Existing old test databases are disposable; do not add compatibility shims for old Object/Component fixtures unless a future migration request explicitly requires them.
5. **Testing Integrity**: All existing E2E tests must remain green at every phase boundary. No exceptions.

## Stored Data Access Notes

These names are still allowed when they are domain concepts rather than the renamed entity type:

-   `config.parentHubId`, `config.boundHubId`, `config.hubs` — hub/tree configuration JSONB.
-   `set`, `enumeration`, `page`, `ledger` — separate standard entity kind keys.
-   `catalog` in optional global migration catalog docs/package names may remain only where it refers to the migration registry package, not the Object entity type.

## References

-   [tasks.md](tasks.md)
-   [progress.md](progress.md)
-   [systemPatterns.md](systemPatterns.md)
-   [techContext.md](techContext.md)
