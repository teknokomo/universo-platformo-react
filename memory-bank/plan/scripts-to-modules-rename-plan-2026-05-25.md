# Modules To Modules Rename Plan

> Date: 2026-05-25
> Brief: private Manager brief
> Research artifact: none. This plan is based on local repository inventory; no unstable external dependency or current API decision is required.

## Overview

Rename the metahub cross-cutting TypeScript attachment capability from
Modules/Modules to Modules/Module authoring across product, code, database
system tables, API routes, UI, i18n, fixtures, tests, and GitBook docs.

This is a fresh-database rename. Do not preserve `/modules` aliases, old table
names, legacy DTO names, or compatibility shims. Keep the existing execution
semantics, isolated-vm runtime behavior, SDK API version `1.0.0`, attachment
model, and module role model unless a rename directly forces a type or file
boundary change.

## Loaded Context

-   Project mode: `.gemini/rules/custom_modes/plan_mode.md`.
-   Architecture skill: `.agents/skills/universo-platform-architecture`.
-   UI skills: `.agents/skills/mui-runtime-ux-patterns`,
    `.agents/skills/runtime-ux-qa`.
-   Playwright skill: `.agents/skills/playwright-best-practices`.
-   Steering docs: `.kiro/steering/i18n-docs.md`,
    `.kiro/steering/recommendations.md`.
-   Memory Bank: `tasks.md`, `activeContext.md`, `systemPatterns.md`,
    `techContext.md`.

## Local Inventory Findings

Real rename targets:

-   `packages/universo-react-types/base/src/common/entityCapabilities.ts` currently
    exposes the capability key `modules`; fresh metadata, templates, fixtures,
    and UI capability toggles must move to `modules`.
-   `packages/universo-react-types/base/src/common/modules.ts` is the shared type source
    for attachment kinds, module roles, source kinds, capabilities, lifecycle
    events, manifests, compilation inputs, and DTOs.
-   Design-time backend is under
    `packages/universo-react-metahubs-backend/base/src/domains/modules/**` and stores rows in
    `_mhb_modules`.
-   Runtime/application backend owns
    `runtimeModulesController.ts`, `runtimeModulesService.ts`, and
    `syncModulePersistence.ts`, with runtime rows in `_app_modules`.
-   Runtime widget/layout configuration and application control-panel code use
    fields such as `moduleCodename` and runtime helper params such as `moduleId`;
    these are public-ish configuration contracts and must become
    `moduleCodename` / `moduleId`.
-   Shared configuration DTOs also carry these names in `recordBehavior`,
    `workflowActions`, `applicationLayouts`, `metahubs`, and `extension-sdk`
    context/widget types.
-   Schema generation and branch system table definitions live in
    `packages/universo-react-schema-ddl/base/src/**` and
    `packages/universo-react-metahubs-backend/base/src/domains/metahubs/services/systemTableDefinitions.ts`.
-   UI authoring lives in
    `packages/universo-react-metahubs-frontend/base/src/domains/modules/**`, especially
    `EntityModulesTab`.
-   Shared resources show a `modules` tab in `SharedResourcesPage`.
-   Runtime widgets use module discovery/client bundles in
    `packages/universo-react-apps-template-mui/src/dashboard/components/runtimeWidgetHelpers.ts`,
    `QuizWidget.tsx`, and browser runtime files.
-   `packages/universo-react-modules-engine/base` is an entire package and package name.
-   `@universo-react/extension-sdk` exposes user-facing base classes named
    `ExtensionModule` and `SharedLibraryModule`.
-   Fixtures and snapshot contracts contain `snapshot.modules`, `sourceCode`,
    `serverBundle`, `clientBundle`, `attachedToKind`, `moduleRole`, and
    source-code classes ending in `Module`.
-   Entity action contracts currently use `actionType: 'module'`,
    `moduleId`, `_mhb_actions.module_id`, and `idx_mhb_actions_module_id`; these
    are action-level attachment points from the brief and must become module
    contracts.
-   Template seed contracts currently use `TemplateSeedScript`,
    `MetahubTemplateSeed.modules`, validator `seedScriptSchema`, executor
    `createScripts`, and seed-time compilation through `compileModuleSource`.
-   GitBook docs include `modules.md`, `module-scopes.md`,
    `shared-modules.md`, `metahub-modules.md`, and
    `architecture/modules-system.md`.
-   Docs screenshot generators encode old labels, test ids such as
    `entity-modules-layout`, API routes, and output filenames such as
    `metahub-modules.png`.
-   REST docs currently document `/metahub/{metahubId}/modules` and
    `/metahub/{metahubId}/module/{moduleId}`, plus runtime routes under
    `/applications/{applicationId}/runtime/modules/{moduleId}/...`.

Non-target or allowlisted uses:

-   `package.json` `modules` blocks and ordinary shell/automation "modules".
-   Supabase/local-start "modules" wording where it means CLI modules, not the
    metahub capability.
-   `run-module-os` dependency.
-   Historical Memory Bank completed work can remain historical unless a current
    rule or active doc is used as implementation guidance.
-   `moduleRole` values already use the desired module vocabulary and should not
    be renamed away.
-   Browser/platform terms are not part of the metahub capability rename:
    HTML `<module>` / `<noscript>`, CSP `module-src`, `javascript:` security
    tests, JavaScript/TypeScript language names, and package manager `modules`
    are allowlisted.
-   Existing decorator names (`@AtServer`, `@AtClient`, `@OnEvent`,
    `@AtServerAndClient`) describe execution/event targets and are not old
    "Module" vocabulary.

## Architecture Decisions

-   Capability name becomes `modules` at the platform contract level.
-   Entity capability key changes from `modules` to `modules` in manifests,
    templates, fixtures, validators, and UI capability toggles. This is a fresh
    metadata contract change with no dual-read fallback.
-   User-facing labels become `Modules` / `Модули`.
-   Design-time table becomes `_mhb_modules`; runtime table becomes
    `_app_modules`.
-   API routes become:
    -   `GET/POST /metahub/:metahubId/modules`
    -   `GET/PATCH/DELETE /metahub/:metahubId/module/:moduleId`
    -   `GET /applications/:applicationId/runtime/modules`
    -   `GET /applications/:applicationId/runtime/modules/:moduleId/client`
    -   `POST /applications/:applicationId/runtime/modules/:moduleId/call`
    -   `GET /public/a/:applicationId/runtime/modules`
    -   `GET /public/a/:applicationId/runtime/modules/:moduleId/client`
-   Shared resource tab key becomes `modules`, with i18n key
    `general.tabs.modules`.
-   Domain folder names become `modules` where they refer to this capability.
-   Type names use `Module*`, for example `ModuleAttachmentKind`,
    `ModuleManifest`, `MetahubModuleDefinition`, `ApplicationModuleDefinition`.
-   Existing `moduleRole` database column and DTO property stay `moduleRole`;
    it is already the correct vocabulary.
-   Entity actions rename from module actions to module actions:
    `actionType: 'module'` -> `actionType: 'module'`, `moduleId` -> `moduleId`,
    and `_mhb_actions.module_id` -> `_mhb_actions.module_id`.
-   Widget/layout config renames `moduleCodename` to `moduleCodename`.
-   Decorators such as `@AtServer`, `@AtClient`, `@OnEvent`, and
    `@AtServerAndClient` are not renamed; they model execution target, not the
    old Module term.
-   `@shared/<codename>` import specifier remains unless a separate public SDK
    import redesign is approved. It describes shared-library import location and
    avoids unnecessary authored-code churn in this rename.
-   The old `modules` capability key is not allowlisted in active metadata,
    templates, fixtures, or user-facing docs.

## Affected Areas

-   `@universo-react/types`: rename shared module contract and exports.
-   `@universo-react/modules-engine`: rename package to `@universo-react/modules-engine`
    because it owns multiple module definitions and runtime bundles.
-   `@universo-react/extension-sdk`: keep package name if the team wants the broader
    extension concept, but rename classes to `ExtensionModule` and
    `SharedLibraryModule`, plus context/widget field names that expose
    `moduleId` / `moduleCodename`.
-   `metahubs-backend`: design-time module CRUD, snapshot serialize/restore,
    template manifest validation, template seed executor, capability registry,
    action service/execution references.
-   `applications-backend`: runtime module list/bundle RPC, sync persistence,
    public routes, runtime row lifecycle/posting/action execution consumers.
-   `applications-frontend`: layout/widget behavior editor config fields such as
    `moduleCodename`.
-   `schema-ddl`: runtime `_app_modules` system table and indexes.
-   `metahubs-frontend`: module authoring tab, resources tab, automation action
    selector labels, i18n.
-   `apps-template-mui`: runtime module selection and client bundle loading.
-   `universo-utils`: snapshot hash/archive serializers.
-   `universo-rest-docs`: generated and committed OpenAPI/reference docs.
-   `universo-core-backend`, package dependencies, TypeScript path mappings, and
    backend Jest mapper that currently reference `@universo-react/modules-engine`.
-   `apps-template-mui` test dependency boundary: its browser runtime tests import
    the engine and should declare an explicit devDependency on the renamed engine
    package.
-   `.kiro/steering` and current Memory Bank context docs where they describe the
    current platform capability, while historical completed Memory Bank entries
    remain historical.
-   Fixtures and generators under `tools/fixtures` and `tools/testing/e2e`.
-   Docs screenshot generators under `tools/testing/e2e/specs/generators`.
-   GitBook docs under `docs/en` and `docs/ru`, plus docs checker inventories.
-   Package READMEs for affected packages.

## UI Contract

Global UI rules:

-   Keep the existing `EntityModulesTab` layout and rename it in place to
    `EntityModulesTab`; do not introduce a new editor component unless an
    existing extracted primitive cannot cover the current behavior.
-   Keep existing MUI `List`, `ListItemButton`, `FormControl`, `Select`,
    checkbox, dialog, toolbar, alert, and ResizeObserver patterns.
-   Keep runtime widget loading through existing `apps-template-mui`
    dashboard/helper patterns and rename helper contracts in place.
-   Normal user surfaces must not show raw editable/user-facing `*Id` values,
    UUID-only labels, owner/user/reference ids, internal field names, route names,
    schema/table names, checksums, bundle payloads, raw manifests, raw JSON, or
    `[object Object]`.
-   All visible strings must use EN/RU i18n. Fallback strings may remain as
    development defaults in code, but localized runtime QA must prove they are not
    visible as untranslated old "Modules" labels.
-   Validation and error states must be localized and user-facing for form
    required fields, duplicate codename, invalid source, compile/source failures,
    action-scope failures, save-before-attach state, backend/API errors, and
    runtime load failures. Raw Zod/internal/backend exception text must not leak
    to normal UI.
-   Semantic long text (`description`, source code, compile/runtime error detail,
    help text, notes, docs alt text where user-facing) must be multiline or wrap
    safely without page-level overflow. Long list/card labels truncate or wrap
    inside stable containers.

UI Contract by surface:

-   `SharedResourcesPage` Modules tab:

    -   Control: existing Resources tabs with tab value `modules`.
    -   Display: tab label `Modules` / `Модули`; no raw table names, route names,
        or UUID-only values.
    -   Hidden/system fields: module ids, bundle/checksum/manifest internals.
    -   Responsive proof: desktop/tablet/mobile tabs remain reachable without
        page-level horizontal overflow; any inner tab scroller is constrained.

-   Entity/metahub/component `EntityModulesTab`:

    -   Control: reuse the current attached-code list plus editor layout, renamed
        in place.
    -   Display: list rows show localized name/codename, role badge, active state,
        and human scope label; never raw `moduleId`, `metahubId`, `entityId`,
        `attachedToId`, or manifest JSON.
    -   Defaults: unsaved anchors show the save-first alert and hide create/update
        controls that cannot work yet.
    -   Validation: missing name/codename/source, duplicate codename, invalid
        source, disallowed capability, invalid shared-library dependency, and
        compile failures use localized messages.
    -   Keyboard proof: user can focus list, create a new module, edit fields,
        save, select another module, and delete using visible controls.

-   Module editor/create/edit form:

    -   Controls: localized VLC/codename inputs, multiline description, module role
        select, source kind select, capability checkboxes, active switch, and
        multiline/code source editor.
    -   Hidden/system fields: ids, sdk manifest JSON, server/client bundles,
        checksum, version/deletion flags.
    -   Display: role/source/capability labels use `modules.*` keys and do not use
        old module wording.

-   Automation/action selector:

    -   Control: existing action list/editor; `actionType='module'` option points
        to a module selected by visible name/codename.
    -   Display: action rows show action name plus selected module label; never
        `moduleId` or UUID-only values.
    -   Validation: module actions require a selected active module; builtin
        actions must not carry `moduleId`; errors are localized.

-   Runtime widget module load/error states:

    -   Control: existing apps-template widget helper/rendering path.
    -   Display: localized concise loading/error/empty states; internal route,
        schema, table, bundle, checksum, manifest, and raw exception details stay
        hidden from normal users.
    -   Recovery: show retry/reload action only when backed by an existing widget
        primitive and user-facing wording.

-   Docs screenshots:
    -   Capture the true browser UI after rename; filenames, alt text, manifest
        entries, and provenance use module terminology.
    -   Static docs checks reject stale screenshots or visible old "Modules" /
        "Скрипты" labels on the renamed surfaces.

Required Playwright UX oracles:

-   Use user-facing locators and visible labels/codenames, not raw ids.
-   Prove keyboard path for create/edit/select/delete where the workflow is
    interactive.
-   Assert no old visible labels: `Modules`, `Module`, `Modules`, `Скрипты`,
    `Скрипт`, `скрипт`, `скрипты` on module surfaces.
-   Assert no raw UUIDs, raw JSON/object cells, route names, schema/table names,
    internal/Zod messages, bundle/checksum/manifest text, or page-level horizontal
    overflow at desktop/tablet/mobile widths.
-   If any table/DataGrid is involved, page-level overflow is forbidden and grid
    scrolling must stay inside the constrained grid container.

## Implementation Plan

-   [ ] Phase 0: Freeze scope and vocabulary.

    -   Use final canonical names: Modules, Module, module, modules, Модули,
        Модуль.
    -   Use package rename choice: `@universo-react/modules-engine`.
    -   Use SDK class rename: `ExtensionModule` and `SharedLibraryModule`,
        with no compatibility exports.
    -   Keep `moduleRole`, role values, decorators, and `@shared/*`.
    -   Rename capability key `modules` -> `modules`.
    -   Rename action contract `module` action -> `module` action,
        `moduleId` -> `moduleId`.
    -   Rename widget/layout config `moduleCodename` -> `moduleCodename`.

-   [ ] Phase 1: Add a mechanical rename map and guardrails.

    -   Create a temporary implementation checklist with exact old/new symbol,
        table, route, i18n, and file path mappings.
    -   Add a static audit command or test that detects forbidden capability
        leftovers after implementation, while allowlisting `package.json` modules,
        shell modules, run-module-os, and historical Memory Bank.
    -   Make the audit fail on `_mhb_modules`, `_app_modules`, `/modules`,
        `/module/`, `EntityModulesTab`, `ScriptManifest`, `ModuleAttachmentKind`,
        active metadata key `modules`, action value `actionType: 'module'`,
        `moduleId`, `module_id`, user-facing `Modules`, and `Скрипты` in active
        surfaces.
    -   Add a focused allowlist for non-capability terms: `package.json` `modules`,
        shell/CLI modules, `run-module-os`, HTML `<module>` / `<noscript>`, CSP
        `module-src`, `javascript:` security tests, JavaScript/TypeScript language
        names, and historical Memory Bank archive content.

-   [ ] Phase 2: Rename shared type contract first.

    -   Rename entity capability key in
        `packages/universo-react-types/base/src/common/entityCapabilities.ts` from
        `modules` to `modules`, including dependency declarations such as
        `posting -> modules`.
    -   Update capability manifests, validators, tests, and template data that
        currently use `capabilities.modules`.
    -   Update public template seed types in `common/metahubs.ts`:
        `TemplateSeedScript` -> `TemplateSeedModule`,
        `MetahubTemplateSeed.modules` -> `MetahubTemplateSeed.modules`.
    -   Rename shared config fields in `recordBehavior.ts`, `workflowActions.ts`,
        `applicationLayouts.ts`, and `metahubs.ts` from `moduleCodename`/`moduleId`
        to `moduleCodename`/`moduleId` where they refer to attached metahub
        modules.
    -   Move `packages/universo-react-types/base/src/common/modules.ts` to
        `modules.ts`.
    -   Rename exported constants/types/functions to module terminology:
        `MODULE_ATTACHMENT_KINDS`, `ModuleAttachmentKind`, `ModuleManifest`,
        `ModuleCapability`, `normalizeModuleAttachmentKind`,
        `normalizeModuleRole`, `resolveModuleSdkApiVersion`, etc.
    -   Keep value names such as `moduleRole`, `module`, `lifecycle`, `widget`,
        and `library`.
    -   Update `packages/universo-react-types/base/src/index.ts` exports and tests.

-   [ ] Phase 3: Rename engine and SDK boundaries.

    -   Rename package folder `packages/universo-react-modules-engine` to
        `packages/universo-react-modules-engine`.
    -   Rename package name `@universo-react/modules-engine` to
        `@universo-react/modules-engine` and update all workspace imports, Jest module
        mapping, package dependencies, docs, and build modules.
    -   Update `universo-core-backend` startup dependency/import for isolated-vm
        availability checks, all package `tsconfig` path mappings, and
        `tools/testing/backend/jest.base.config.cjs`.
    -   Add/update explicit package dependency declarations for every direct engine
        import, including `apps-template-mui` test imports as a devDependency.
    -   Rename internal file/symbol wording in compiler/runtime tests where it
        refers to authored modules.
    -   In `@universo-react/extension-sdk`, rename `ExtensionModule` to
        `ExtensionModule` and `SharedLibraryModule` to `SharedLibraryModule`.
    -   In `@universo-react/extension-sdk`, rename exposed context/widget fields
        `moduleId` and `moduleCodename` to `moduleId` and `moduleCodename`.
    -   Update generated/source authored examples in fixtures and Playwright tests.

-   [ ] Phase 4: Rename design-time metahub backend.

    -   Move `domains/modules` to `domains/modules`.
    -   Rename controller, routes, service, store, tests, and exported symbols:
        `createModulesRoutes`, `createModulesController`,
        `MetahubModulesService`, `modulesStore`.
    -   Change route surface to `/modules` and `/module/:moduleId` only.
    -   Change store table constant to `_mhb_modules`.
    -   Keep SQL parameterization and `qSchemaTable`/`queryOneOrThrow` patterns.
    -   Update action execution references from module ids to module ids:
        `_mhb_actions.module_id`, DTO `moduleId`, action value `module`, and
        validation messages such as "Module actions require a moduleId".
    -   Update `ActionService`, `actionsController`, `EntityActionExecutionService`,
        serializer/restore action mappings, and route tests together so action
        creation, update, snapshot export/import, and execution share one contract.
    -   Rename `moduleCodename`/`moduleId` references in action/widget contexts to
        `moduleCodename`/`moduleId` where they represent attached module
        selection.
    -   Preserve the existing fail-closed validation pattern: module actions require
        an existing active module; builtin actions must not reference `moduleId`.

-   [ ] Phase 5: Rename system tables and DDL.

    -   Update design-time system table definition from `_mhb_modules` to
        `_mhb_modules`.
    -   Update runtime schema generation from `_app_modules` to `_app_modules`.
    -   Rename indexes, constraints, and FK columns:
        `idx_mhb_modules_*`, `idx_app_modules_*`, `module_id` where currently
        `module_id` references the old table.
    -   Update `_mhb_actions` table definitions and indexes from `module_id` to
        `module_id`, referencing `_mhb_modules`.
    -   Update `capabilityRegistry.ts`: capability registry key `modules` ->
        `modules`, table references `_mhb_modules` -> `_mhb_modules`, and posting
        dependencies/tables to the renamed module capability/table.
    -   Do not create migration aliases or old-name repair logic.
    -   Update tests in `systemTableDefinitions.test.ts`,
        `SchemaGenerator.test.ts`, and `systemTables.test.ts`.

-   [ ] Phase 6: Rename application runtime and sync path.

    -   Rename `runtimeModulesController.ts` to `runtimeModulesController.ts`,
        `runtimeModulesService.ts` to `runtimeModulesService.ts`, and
        `syncModulePersistence.ts` to `syncModulePersistence.ts`.
    -   Update application route paths and public runtime routes to modules,
        including list/client-bundle/server-call route params from `moduleId` to
        `moduleId`.
    -   Split and verify both authenticated routes
        `/applications/:applicationId/runtime/modules...` and public guest routes
        `/public/a/:applicationId/runtime/modules` and
        `/public/a/:applicationId/runtime/modules/:moduleId/client`.
    -   Rename public controller methods such as `listPublicScripts` to module
        naming and update matching route tests.
    -   Update `runtimeRowsController` lifecycle/posting dispatch integration to
        use the renamed runtime module service.
    -   Update `applicationSyncContracts.ts`: `SnapshotScriptDefinition` and
        `PublishedApplicationSnapshot.modules` become module contracts.
    -   Update sync materialization and release bundle contracts from
        `snapshot.modules` to `snapshot.modules`.
    -   Keep fail-closed behavior when `_app_modules` bootstrap/persistence fails.
    -   Rename response fields and tests to module terminology.

-   [ ] Phase 7: Rename snapshots, fixtures, and template seed data.

    -   Change snapshot contract from `modules` to `modules`.
    -   Change template seed contract from `seed.modules` to `seed.modules`.
    -   Update template manifest validation and seed execution:
        `seedScriptSchema` -> `seedModuleSchema`, `createScripts` ->
        `createModules`, seed-time compilation via renamed module engine API, and
        inserts into `_mhb_modules`.
    -   Update `publicationSnapshotHash`, `snapshotArchive`, serializer/restore,
        self-hosted/quiz/LMS fixture contracts, and committed JSON snapshots.
    -   Update fixture contract validators and generator specs, not only generated
        JSON files (`quizFixtureContract`, `lmsFixtureContract`,
        `selfHostedAppFixtureContract`, quiz/LMS/self-hosted generators).
    -   Update snapshot action references from `actionType: 'module'`/`moduleId`
        to `actionType: 'module'`/`moduleId`.
    -   Update capability manifests in fixtures from `modules` to `modules`.
    -   Update widget/layout config references from `moduleCodename` to
        `moduleCodename`.
    -   Regenerate fixtures through supported Playwright generators where contract
        files own fixture hashes.
    -   Update LMS posting module source classes and imports to
        `ExtensionModule`.

-   [ ] Phase 8: Rename frontend authoring surfaces.

    -   Move `domains/modules` to `domains/modules`.
    -   Rename `modulesApi` to `modulesApi`, `EntityModulesTab` to
        `EntityModulesTab`, and `scriptEditor` to `moduleEditor`.
    -   Update Resources tab value and entity UI tab id from `modules` to
        `modules`, including mocks, `ui.tabs`, requested-tab guards, and test ids.
    -   Update entity capability UI from `capabilities.modules` and visible
        "Modules" labels to `capabilities.modules` and "Modules".
    -   Update automation/action selectors from "module" labels to "module"
        labels where user-facing and API-owned.
    -   Rename internal action type value `module` to `module` and API payload
        `moduleId` to `moduleId` because fresh DB compatibility is not required.
    -   Update application layout/widget behavior editor config:
        `moduleCodename` -> `moduleCodename`, visible labels, tests, and runtime
        widget helper expectations.
    -   Preserve existing MUI primitives and responsive layout behavior.

-   [ ] Phase 9: Rename i18n resources.

    -   Rename `modules.*` key roots to `modules.*` in package i18n.
    -   Update EN/RU text in `metahubs.json`, `applications.json`, `apps.json`,
        `quiz.json`, and package-local namespaces.
    -   Audit by visible text, not only key roots. Update old wording in other
        subtrees such as layout quiz editor `noScripts`, entity capability
        `modules`, automation action copy, and runtime `loadScriptsError`.
    -   Update central `packages/universo-react-i18n` only if this capability has keys
        there after a fresh search.
    -   Add tests/audit ensuring EN/RU parity and no old visible text on module
        surfaces.

-   [ ] Phase 10: Rename docs and GitBook navigation.

    -   Rename docs pages:
        `api-reference/modules.md` to `api-reference/modules.md`,
        `guides/metahub-modules.md` to `guides/metahub-modules.md`,
        `architecture/modules-system.md` to `architecture/modules-system.md`,
        `platform/metahubs/modules.md` to `platform/metahubs/modules.md`,
        `module-scopes.md` to `module-scopes.md`,
        `shared-modules.md` to `shared-modules.md`.
    -   Update `docs/en/SUMMARY.md`, `docs/ru/SUMMARY.md`, cross-links, image
        filenames/alt text, and `tools/docs/check-i18n-docs.mjs`.
    -   Perform a secondary GitBook sweep for overview, architecture, LMS,
        browser-E2E, setup, README, and platform pages in both EN/RU, not only the
        renamed pages.
    -   Explicitly include non-renamed active guides/pages that reference the old
        contract: `guides/quiz-application-tutorial.md`, `guides/general-section.md`,
        `guides/custom-entity-types.md`, `guides/transactional-objects.md`,
        `guides/snapshot-export-import.md`, `guides/ledgers.md`,
        `platform/applications.md`, LMS guides, and entity architecture pages.
    -   Update docs screenshot generator code, test ids, labels, route assertions,
        and output filenames (`metahub-modules.png` -> module equivalent).
    -   Keep EN as source and RU with identical structure/line-count parity per
        `.kiro/steering/i18n-docs.md`.
    -   Add a short package README note in affected packages that "Modules" are
        metahub-attached TypeScript extension code and link to the architecture
        skill by path.
    -   Update `.kiro/steering/product.md`, `.kiro/steering/structure.md`, and
        current Memory Bank guidance where they describe the current capability.
        Do not rewrite historical completion logs except where a current guardrail
        would otherwise mislead implementation.

-   [ ] Phase 11: Update OpenAPI/rest-docs generation.

    -   Update generated OpenAPI source inventory and route descriptions so only
        `/modules`, `/module/{moduleId}`, and
        `/runtime/modules/{moduleId}/...` appear for this capability.
    -   Rename OpenAPI tags/operation IDs/path parameters from Modules/moduleId to
        Modules/moduleId.
    -   Update generator inputs before generated YAML:
        `packages/universo-react-rest-docs/modules/generate-openapi-source.js` route
        source inventory, tag names/descriptions, operation IDs, and path parameter
        names.
    -   Update `packages/universo-react-rest-docs/API_ENDPOINTS.md`,
        `ARCHITECTURE.md`, `src/openapi/index.yml`, and generator tests if present.
    -   Regenerate or manually update generated docs according to the package's
        existing workflow.

-   [ ] Phase 12: Deep test suite updates.

    -   Jest/backend:
        -   metahubs module routes/service/store;
        -   application runtime modules service;
        -   sync module persistence fail-closed behavior;
        -   schema/table generation;
        -   action CRUD/execution with `actionType: 'module'` and `module_id`;
        -   snapshot serialize/restore/hash.
    -   Vitest/frontend/types/engine:
        -   `EntityTypeCapabilities.modules` and posting dependency coverage;
        -   `@universo-react/types` module normalization;
        -   module engine compiler/runtime;
        -   extension SDK exports;
        -   `EntityModulesTab`;
        -   `SharedResourcesPage` modules tab;
        -   runtime widget module helper;
        -   browser module runtime.
    -   Playwright:
        -   browser-authored quiz/module flow;
        -   shared Resources Modules flow;
        -   shared-library dependency and circular-dependency flows formerly covered
            by `metahub-shared-common.spec.ts`;
        -   entity workspace attached Modules tab;
        -   entity action module binding and posting transition execution;
        -   snapshot import quiz runtime;
        -   LMS snapshot import/runtime posting module smoke.
        -   docs screenshot generator flow with renamed labels, test ids, API routes,
            and output filenames.
    -   Rename Playwright spec filenames, test titles, helper names such as
        `listMetahubModules`, expected URL assertions, and RU assertions such as
        `Скрипты`.
    -   Visual/browser evidence:
        -   screenshots for EN/RU Resources Modules tab;
        -   entity-attached Modules tab;
        -   published runtime widget using a client-capable module;
        -   desktop/tablet/mobile no-overflow proof.

-   [ ] Phase 13: Local Supabase E2E validation.

    -   Use Node 22 in the shell before E2E commands.
    -   Start local minimal Supabase only for the E2E validation pass:
        `pnpm supabase:e2e:start:minimal`.
    -   Use the Playwright wrapper on `http://127.0.0.1:3100`; do not use
        `pnpm dev`.
    -   Run targeted module flows first, then smoke/flow suites needed by the
        touched fixtures.
    -   Stop/clean the E2E stack through the repository-supported commands after
        the run.

-   [ ] Phase 14: Final audits and build validation.
    -   Run static rename audit.
    -   Run docs i18n/GitBook checks.
    -   Run package-level lint/tests for touched packages.
    -   Run root `pnpm build` after focused checks.
    -   If root build is too expensive for the current environment, record the
        exact focused commands that passed and the missing validation.

## Safe Code Examples

### Parameterized Design-Time Store

```ts
const TABLE = '_mhb_modules'
const ACTIVE_CLAUSE = '_upl_deleted = false AND _mhb_deleted = false'

export async function findStoredMetahubModuleByScope(
    executor: SqlQueryable,
    schemaName: string,
    scope: StoredMetahubModuleScope
): Promise<StoredMetahubModuleRow | null> {
    const qt = qSchemaTable(schemaName, TABLE)

    return queryOne<StoredMetahubModuleRow>(
        executor,
        `SELECT * FROM ${qt}
     WHERE ${codenamePrimaryTextSql('codename')} = $1
       AND attached_to_kind = $2
       AND (($3::uuid IS NULL AND attached_to_id IS NULL) OR attached_to_id = $3)
       AND module_role = $4
       AND ${ACTIVE_CLAUSE}
     LIMIT 1`,
        [scope.codename, scope.attachedToKind, scope.attachedToId, scope.moduleRole]
    )
}
```

### Fail-Closed Runtime Table Check

```ts
const result = (await executor.query('SELECT to_regclass($1) AS table_name', [`${schemaName}._app_modules`])) as Array<{
    table_name: string | null
}>

if (!result[0]?.table_name) {
    throw new Error(`Runtime modules table is missing for application schema ${schemaName}`)
}
```

### UI Key Shape

```tsx
<Alert severity='info'>{t('modules.saveEntityFirst', 'Save this entity first, then modules can be attached from this tab.')}</Alert>
```

## Potential Challenges

-   Generated fixture bundles contain compiled class names and source snippets.
    Prefer regenerating through existing generators over hand-editing massive JSON
    blocks.
-   The `modules` entity capability key is embedded deeply in templates,
    validators, fixtures, UI capability toggles, and docs. Missing it would leave
    a mixed old/new metadata contract even if routes and tables were renamed.
-   Action-level attachment is not just UI wording: it has persisted
    `actionType`, `moduleId`, and `_mhb_actions.module_id` contracts that must be
    renamed together with snapshot restore/serialize logic.
-   Widget/layout behavior config carries `moduleCodename`; missing it would keep
    old terminology in published app configuration even if the runtime routes are
    renamed.
-   Renaming package `@universo-react/modules-engine` requires Jest module mapper,
    TypeScript path mappings, package dependency, and docs updates in one
    commit-sized slice.
-   `moduleRole` should not be over-renamed; it is already correct and is part of
    the role contract.
-   `modules` in `package.json` must not be touched by rename audits.
-   Public SDK class rename breaks authored examples by design. All committed
    fixtures and docs must be regenerated/updated together.
-   Existing Memory Bank history contains many old terms. Do not rewrite history
    broadly; update current context/system patterns only where needed after
    implementation.
-   Browser screenshots are necessary for UI confidence because the existing
    module tab has compact/responsive behavior tied to container geometry.
-   OpenAPI generated operation IDs and path parameter names can preserve stale
    `Scripts_*`/`moduleId` names even after route code is renamed; include them in
    the audit.

## Dependencies

-   Local Node must resolve to Node 22 before Playwright/E2E validation.
-   Local minimal Supabase is required for the requested E2E proof phase.
-   Fixture regeneration depends on existing Playwright generator ownership.
-   Root build should be run after focused checks because package renames affect
    workspace dependency resolution.

## Done Criteria

-   Active code has no forbidden metahub capability references to Modules/Modules
    outside explicit allowlists.
-   Active metadata, templates, and fixtures use capability key `modules`, not
    `modules`.
-   Fresh design-time schemas create `_mhb_modules`; fresh runtime schemas create
    `_app_modules`.
-   Fresh action rows use `actionType='module'` and `_mhb_actions.module_id`.
-   Fresh fixtures/snapshots use `modules`, module routes, `moduleId`, and
    `ExtensionModule`.
-   UI shows Modules/Модули everywhere on the capability surfaces.
-   REST/OpenAPI/GitBook docs document module endpoints only.
-   Focused Jest, Vitest, Playwright, docs checks, static audit, and root build
    pass or have explicit blocker notes.
