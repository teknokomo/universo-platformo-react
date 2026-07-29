# Plan: Interpretation Network Single System Structure And Workspace Templates

> Created: 2026-07-20
> Status: Draft for review
> Mode: PLAN
> Research: `../research/interpretation-network-single-structure-and-templates-research-2026-07-19.md`

## Overview

Implement an optional Interpretation Network `singleSystem` mode where the published application's `Structures` section opens the Matrix directly instead of a list of named Structures. Add a workspace-authorized workflow to save the active Structure as a reusable `TableTemplate`, optionally including cell-attached Materials, and to create new Structures from templates in multi-structure mode.

The implementation must stay template-first, preserve the MUI dashboard style in `packages/universo-react-apps-template-mui`, avoid legacy compatibility shims, avoid schema/template version increments, and prove the behavior through unit, service, component, Playwright, fixture, documentation, and browser-screenshot checks.

## Planning Inputs And Tooling Notes

-   The 2026-07-19 research artifact is fresh enough for this PLAN and records the direct codebase analysis, architecture decisions, and source inventory.
-   The mode is planned as widget configuration, not a workspace setting.
-   Subagent reviews were used for backend/settings seams, runtime UX/routing seams, and test/docs coverage.
-   Project-local Skills used for this plan:
    -   `research-before-plan`;
    -   `universo-platform-architecture`;
    -   `mui-runtime-ux-patterns`;
    -   `runtime-ux-qa`;
    -   `playwright-best-practices`;
    -   `nodejs-backend-patterns`;
    -   `context7:context7-mcp` skill instructions.
-   Context7 was requested by the user and the skill was loaded, but no callable Context7 query tool was available in this runtime after tool discovery. Current external-source refresh should be retried during IMPLEMENT/QA if the tool becomes available.
-   The web-search tool was invoked for official TanStack Query, Playwright, MUI, React Router, and PostgreSQL documentation. The implementation should rely on primary docs only:
    -   `https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation`
    -   `https://playwright.dev/docs/best-practices`
    -   `https://playwright.dev/docs/screenshots`
    -   `https://mui.com/material-ui/react-dialog/`
    -   `https://mui.com/material-ui/react-use-media-query/`
    -   `https://reactrouter.com/6.30.4/hooks/use-navigate`
    -   `https://www.postgresql.org/docs/current/explicit-locking.html`
    -   `https://www.postgresql.org/docs/current/functions-admin.html`
    -   `https://www.postgresql.org/docs/current/ddl-rowsecurity.html`
-   QA review on 2026-07-20 found no architecture blockers. The plan was tightened around existing UI primitive reuse, runtime/workspace route placement, backend negative tests, log hygiene, lifecycle-after-commit proof, and existing Playwright UX oracle helpers.

## Locked Product Decisions For This Plan

-   Use `structureMode: 'multiple' | 'singleSystem'`; default is `multiple`.
-   Store the canonical value in the metahub widget config and materialize it to the application. Allow application-level override/reset. Do not allow workspace override.
-   The metahub configuration surface must expose the mode in a normal user-visible Metahub Settings path, not only in a deep widget editor, unless product explicitly approves the widget editor as the Settings surface for this widget and QA records that exception.
-   Keep the current Interpretation Network Object-backed model: `Structure`, `Interpretation`, `Material`, and `TableTemplate`. Do not add a platform entity kind.
-   In `singleSystem`, a hidden server-owned Structure still has valid internal data:
    -   hidden `SystemKey`, for example `primary`;
    -   non-empty localized technical Structure name;
    -   non-empty localized canonical Interpretation title;
    -   root Matrix row.
-   Hide the internal Structure name, title, Back action, list, filter, and create action from normal single-mode runtime UI.
-   Switching an existing workspace from `multiple` to `singleSystem` must be deterministic. If active non-system Structures already exist, the implementation must not silently hide or orphan them. The default plan decision is to block/save with a localized administrative warning until the user/admin resolves or archives the extra Structures, unless product approves an explicit adoption/archive rule before IMPLEMENT.
-   Use an idempotent backend aggregate command to ensure the system Structure. Do not use the current client-side three-step `createStructureWithRootMatrix` helper for this invariant.
-   Keep template rows workspace-local in this slice.
-   Save template can be available in both modes when the user has sufficient rights.
-   Create Structure from template is multi-mode only. Do not apply or replace the single system Matrix from a template in this slice.
-   Template copy allowlist:
    -   copy Matrix hierarchy, display labels, values, style fields, row/column keys by equivalence class, ordering, and other agreed Matrix presentation data;
    -   optionally copy Material Title, Description, Editor.js Body, and destination cell attachment;
    -   exclude Relation rows, external blob/file duplication, and unrelated linked records.
-   The implementation must define a concrete field-by-field Matrix copy table before coding the copy service:
    -   remap: runtime row ids, `CellId`, `ParentCellId`, row/column equivalence keys;
    -   copy as-is only for explicit presentation/content fields such as localized labels, values, style and ordering fields;
    -   clear: `MaterialRef` when Materials are excluded or unavailable by policy;
    -   reject/fail closed: unknown identity/reference fields not listed in the allowlist.
-   Persist template material provenance explicitly, for example through `TableTemplate.MaterialPolicy` (`structureOnly` / `withMaterials`) plus any required audit/provenance metadata. Do not infer the user's choice only from whether template Materials happen to exist.
-   Use existing `createContent`, `editContent`, and `deleteContent` permissions for phase 1 unless product explicitly requests a separate template capability. Direct API denial remains mandatory.
-   Keep generated fixtures generated by Playwright. Do not hand-edit `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`.
-   Keep the fixture free of runtime-authored `Structure`, `Interpretation`, `Relation`, `Material`, and `TableTemplate` rows. The runtime ensure command creates the system aggregate after import/workspace entry.
-   Do not increase schema version or metahub template version. The test database will be recreated.

## Affected Areas

### Shared contracts

-   `packages/universo-react-types/src/common/interpretationNetworkLayout.ts`
-   `packages/universo-react-types/src/common/unifiedSettings.ts`
-   `packages/universo-react-types/src/common/roles.ts` only if a new capability is later approved
-   `packages/universo-react-utils` only for neutral reusable helpers that are not runtime-template-specific
-   package-level tests for strict config parsing/defaults

### Metahub template and authoring

-   `packages/universo-react-metahubs-backend/src/domains/templates/data/interpretation-network.template.ts`
-   `packages/universo-react-metahubs-backend/src/domains/templates/data/interpretation-network.stage2.ts`
-   `packages/universo-react-metahubs-backend/src/domains/templates/data/index.ts`
-   `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/InterpretationNetworkWorkspaceWidgetEditorDialog.tsx`
-   `packages/universo-react-metahubs-frontend/src/domains/settings/ui/SettingsPage.tsx`
-   metahub template/schema tests and EN/RU i18n

### Application settings and sync

-   `packages/universo-react-applications-frontend/src/pages/ApplicationSettings.tsx`
-   `packages/universo-react-applications-frontend/src/pages/ApplicationLayouts.tsx`
-   `packages/universo-react-applications-frontend/src/pages/application-settings/MatrixSettingsPanel.tsx`
-   `packages/universo-react-applications-frontend/src/pages/__tests__/ApplicationSettings.test.tsx`
-   Application layout/editor tests
-   `packages/universo-react-metahubs-backend/src/domains/publications/services/SnapshotSerializer.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncHelpers.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncLayoutPersistence.ts`

### Backend runtime commands

-   `packages/universo-react-applications-backend/src/routes/applicationsRoutes.ts`
-   new controller, for example `packages/universo-react-applications-backend/src/controllers/runtimeInterpretationNetworkController.ts`
-   new service/store boundary, for example:
    -   `packages/universo-react-applications-backend/src/services/interpretationNetwork/runtimeInterpretationNetworkMetadata.ts`
    -   `packages/universo-react-applications-backend/src/services/interpretationNetwork/runtimeInterpretationNetworkSystemStructure.ts`
    -   `packages/universo-react-applications-backend/src/services/interpretationNetwork/runtimeInterpretationNetworkTemplates.ts`
    -   `packages/universo-react-applications-backend/src/services/interpretationNetwork/runtimeInterpretationNetworkMatrixRemap.ts`
-   existing helper references:
    -   `packages/universo-react-applications-backend/src/shared/runtimeHelpers.ts`
    -   `packages/universo-react-applications-backend/src/controllers/runtimeRowsController.ts`
    -   `packages/universo-react-applications-backend/src/controllers/runtimeChildRowsController.ts`
    -   `packages/universo-react-applications-backend/src/routes/guards.ts`
    -   `packages/universo-react-applications-backend/src/services/applicationWorkspaces.ts`

### Published runtime MUI

-   `packages/universo-react-apps-template-mui/src/dashboard/components/InterpretationNetworkWorkspaceWidget.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/model.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/structureActions.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/workspace/WorkspaceShell.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/workspace/StructurePane.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/workspace/useStructureRoute.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/workspace/useMatrixRouteSelectionSync.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/workspace/useInterpretationNetworkWorkspaceState.ts`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/workspace/workspaceRuntime.ts`
-   `packages/universo-react-apps-template-mui/src/api/api.ts`
-   `packages/universo-react-apps-template-mui/src/i18n/locales/{en,ru}/interpretationNetwork.json`

### Tests, fixture, and docs

-   `tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts`
-   `tools/testing/e2e/support/interpretationNetworkFixtureContract.ts`
-   `tools/testing/e2e/support/checkInterpretationNetworkFixtureDrift.ts`
-   `tools/testing/e2e/specs/flows/interpretation-network-app-imported-snapshot.spec.ts`
-   new focused Playwright specs for single-mode and template flows
-   `tools/fixtures/metahubs-interpretation-network-app-snapshot.json`
-   `docs/en/architecture/interpretation-network-data-model.md`
-   `docs/ru/architecture/interpretation-network-data-model.md`
-   `docs/en/guides/interpretation-network.md`
-   `docs/ru/guides/interpretation-network.md`
-   `packages/universo-react-apps-template-mui/README.md`
-   `packages/universo-react-apps-template-mui/README-RU.md`
-   `packages/universo-react-applications-frontend/README.md`
-   `packages/universo-react-applications-frontend/README-RU.md`
-   `packages/universo-react-metahubs-backend/README.md`
-   `packages/universo-react-metahubs-backend/README-RU.md`

## Architecture Contract

### Layer ownership

| Concern                                   | Owner                     | Planned storage / behavior                                                                |
| ----------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| Default Interpretation Network mode       | Metahub widget config     | Source default in template/layout config.                                                 |
| Deployed Interpretation Network mode      | Application control panel | Materialized widget config override/reset.                                                |
| Per-workspace single/multiple switch      | Not in scope              | Explicitly disallowed to avoid contradictory navigation/lifecycle inside one application. |
| Structures, Interpretations, Matrix cells | Workspace                 | Runtime user/system content protected by workspace RLS.                                   |
| TableTemplates and template Materials     | Workspace                 | Local reusable content, not application-wide sharing.                                     |
| System Structure identity                 | Workspace runtime data    | Hidden server-owned `SystemKey`, not user-facing title/ID.                                |

### Data aggregate invariants

-   `multiple` mode:
    -   current list/detail model remains unchanged;
    -   Structures are named by users;
    -   creating from template creates a new Structure.
-   `singleSystem` mode:
    -   exactly one server-owned system Structure exists per compatible workspace once the user opens the `Structures` section;
    -   the aggregate includes Structure, canonical Interpretation, and root Matrix cell;
    -   the user never has to name or select the system Structure;
    -   rename/delete/create Structure actions are hidden or denied when they would violate the single-system invariant;
    -   duplicate system aggregates fail closed with an administrative error.
-   Template save:
    -   source Structure remains unchanged;
    -   template receives a fresh identity graph;
    -   no raw source `CellId`, Matrix row id, or Material row id survives the copy boundary.
-   Template instantiate:
    -   destination Structure/Interpretation/Matrix rows receive fresh identities;
    -   `ParentCellId`, row keys, column keys, and Material references are remapped consistently;
    -   operation is atomic and rolls back on validation, authorization, or RLS failure.
-   Application re-sync:
    -   inherited application widgets receive refreshed metahub defaults, including `structureMode`;
    -   explicit application overrides are preserved;
    -   reset uses the refreshed materialized default;
    -   workspace-authored Structures, TableTemplates, Materials, and template Materials are never overwritten or deleted by metadata sync.

### Backend API contract

Use a dedicated Interpretation Network route/controller/service family instead of expanding `runtimeRowsController.ts`.

Proposed route shape, adjusted during implementation to match the existing application runtime/workspace route family and current `workspaceId` propagation. Do not create a parallel namespace that bypasses the existing runtime context helpers:

-   `POST /applications/:applicationId/runtime/interpretation-network/system-structure/ensure`
-   `GET /applications/:applicationId/runtime/interpretation-network/templates`
-   `GET /applications/:applicationId/runtime/interpretation-network/templates/:templateId`
-   `POST /applications/:applicationId/runtime/interpretation-network/templates`
-   `POST /applications/:applicationId/runtime/interpretation-network/templates/:templateId/instantiate`

Rules:

-   Resolve workspace context through existing runtime helpers and request-scoped executor paths.
-   Resolve physical schema/table/column names from trusted application runtime metadata. Never accept physical table or column names from the browser.
-   Validate request bodies with strict schemas that reject unknown keys.
-   Reject any client-supplied schema name, table name, column name, object collection id, component field name, or physical metadata name for aggregate commands. The browser may pass only logical command inputs such as template name, description, copy mode, source row id, expected version, and selected template id.
-   Use schema-qualified, parameterized SQL.
-   Use UUID v7 for all new persisted ids and Matrix `CellId` values.
-   Use `RETURNING` for inserts/updates where row confirmation matters.
-   Use row locks and/or transaction-scoped advisory locks for first-entry ensure and clone commands. Prefer deterministic 32-bit advisory-lock key pairs derived in application code, or a database-side hash function only after verifying support in the target PostgreSQL/Supabase version.
-   Dispatch lifecycle events only after commit, following existing runtime mutation patterns.
-   Do not log request bodies, Editor.js bodies, material text, raw row payloads, or broad id lists from aggregate commands. Logs may include safe correlation context and machine-readable error codes only.

### Runtime query and route contract

-   Add typed `apps-template-mui` API functions and query keys:
    -   `systemAggregate(applicationId, workspaceId, widgetId)`
    -   `structures(...)`
    -   `templates(...)`
    -   `templateDetail(templateId)`
    -   `matrixRows(structureId)`
    -   `materials(structureId)`
-   Do not load every `TemplateMatrix` row eagerly in the workspace shell. Load template details on demand.
-   In `singleSystem`, canonical user-facing URL is:
    -   `/a/:applicationId/:structureSection`
    -   optional focus remains `?matrixCell=<cellId>`
-   In `singleSystem`, an accidental `/a/:applicationId/:structureSection/:structureId` should be repaired with history replace when it points to the system Structure, or rejected/not-found when it points to a non-system Structure.
-   In `multiple`, keep the current list/detail route contract.

## UI Contract

### Metahub widget/configuration settings

-   Add a localized mode control in the Interpretation Network widget editor and aggregated Metahub Settings.
-   Before adding UI, inspect and reuse the current widget editor / Settings composition. If aggregated Metahub Settings cannot host this widget-level setting cleanly, document and test the existing equivalent configuration surface instead of adding a parallel settings page.
-   If the existing aggregated Metahub Settings composition cannot host this widget-level setting cleanly, stop for product decision instead of silently shipping widget-editor-only behavior. The final accepted implementation must have an explicit, discoverable metahub configuration path for this setting.
-   Recommended control: `RadioGroup` or segmented MUI control with:
    -   “Multiple structures”;
    -   “One system structure”.
-   Default shown value is `multiple`.
-   Help text explains that single mode opens Matrix directly and hides the Structure list/name.
-   Unsupported templates or widgets without compatible Interpretation Network metadata must not show this control.
-   Validation messages must be localized in EN/RU.
-   No raw JSON, widget id, internal component codename, or `SystemKey` should be shown.

### Application Settings / control panel

-   Add the same localized mode control in `MatrixSettingsPanel`.
-   Preserve current materialized-widget override semantics:
    -   inherited value visible;
    -   explicit override saved;
    -   reset returns to materialized metahub value;
    -   divergent active widgets produce the existing conflict/warning behavior.
-   Update parser/equality/normalizer/whitelist paths so `structureMode` is not silently dropped.
-   Save invalidates/refetches the same query families that currently keep application settings fresh.
-   No workspace-level override control is added.

### Published runtime single mode

-   Clicking `Structures` opens the Matrix directly.
-   Hide:
    -   Structure list;
    -   filter/search for Structures;
    -   Structure creation button;
    -   selected Structure title;
    -   Back-to-list control;
    -   edit/delete menu for the system Structure.
-   Keep Matrix controls that still apply:
    -   view mode;
    -   cell selection;
    -   Materials panel;
    -   Matrix editing for users with existing edit permissions;
    -   save current Structure as template where authorized.
-   Provide localized loading state while the system aggregate is being ensured.
-   Provide localized fail-closed error state for duplicate/malformed aggregate, with administrative guidance.
-   Do not show a raw UUID, `primary`, `SystemKey`, internal Structure title, raw JSON, or `[object Object]`.
-   Preserve keyboard path and focus restoration.
-   Prove no page-level horizontal overflow at `1920×1080`, `768×1024`, and `390×844`.

### Save-template dialog

-   Reuse existing `apps-template-mui` dialog primitives first, especially `packages/universo-react-apps-template-mui/src/components/dialogs/FormDialog.tsx`, `CrudDialogs`, and existing `Dialog`/`DialogActions` spacing patterns. Add Interpretation Network-specific wrappers only when these primitives cannot express the required radio/progress/policy content.
-   Required localized Template Name.
-   Optional multiline Description.
-   Explicit `RadioGroup`:
    -   Structure only;
    -   Structure and cell Materials.
-   Explain in visible text, wired through `aria-describedby` where applicable, that Relations and external files/blobs are excluded in this implementation slice.
-   Disable duplicate submit while pending.
-   Show progress and localized success/error messages for large matrices.
-   Trap focus, support Escape/Cancel, and restore focus to the trigger.
-   Use responsive full-screen dialog on mobile when appropriate.
-   No raw row ids, Matrix cell UUIDs, internal codenames, or raw Editor.js JSON on normal surfaces.

### Create-from-template dialog

-   Multi-mode only.
-   Template picker displays localized template names, not IDs.
-   Destination Structure Name is required.
-   Destination Description is optional and multiline.
-   Dialog indicates whether the selected template contains copied Materials, based on template metadata/provenance.
-   Dialog explanatory text must be visible and accessible through `aria-describedby` where applicable, because the material-copy policy can affect sensitive or stale content.
-   Duplicate-submit protection, localized validation, focus behavior, and responsive behavior match the save dialog.
-   In single mode, do not show this action. A future “apply template to system Matrix” flow needs a separate product contract.

### Permissions UX

-   Users without effective rights do not see save/instantiate actions.
-   Direct API calls still return `403` or an equivalent fail-closed response.
-   UI hiding is not the security boundary.
-   Permission errors are localized and do not mention raw internal policy keys unless the surface is administrative/debug-only.

## Implementation Plan Steps

### Phase 0: Baseline, impact analysis, and contracts

-   [ ] 0.1. Confirm current dirty worktree and preserve unrelated files (`AGENTS.md`, `CLAUDE.md`, prior research artifacts).
-   [ ] 0.2. Read relevant package READMEs before editing each package.
-   [ ] 0.3. Before modifying any function/class/method, run OntoIndex impact/safe-edit analysis for that symbol and report direct callers, affected process groups, and risk.
-   [ ] 0.4. Retry Context7 documentation lookup for React Router, MUI Dialog/useMediaQuery, TanStack Query invalidation, Playwright screenshots/best practices, and PostgreSQL advisory locks/RLS if the tool is available.
-   [ ] 0.5. Keep PLAN decisions as implementation comments only where they clarify invariants; avoid broad explanatory comments in product code.
-   [ ] 0.6. Create a short implementation checklist issue or local task note only if the implementation spans multiple commits; otherwise keep this plan as the source of truth.

### Phase 1: Shared typed config and metadata

-   [ ] 1.1. Add `InterpretationNetworkStructureMode = 'multiple' | 'singleSystem'` in `packages/universo-react-types/src/common/interpretationNetworkLayout.ts`.
-   [ ] 1.2. Extend `interpretationNetworkWorkspaceWidgetConfigSchema` with optional `structureMode`, normalized to `multiple`.
-   [ ] 1.3. Add exported helpers for parsing/defaulting the widget config so metahub, application, and runtime code do not drift.
-   [ ] 1.4. Update `packages/universo-react-apps-template-mui/src/dashboard/components/interpretation-network/model.ts` with the same enum/default via shared type import or an isolated mirror backed by shared constants.
-   [ ] 1.5. Confirm no addition to `WORKSPACE_OVERRIDABLE_SETTING_KEYS` or workspace settings schema.
-   [ ] 1.6. Add hidden Structure component metadata such as `SystemKey` in `interpretation-network.stage2.ts`.
-   [ ] 1.7. Keep `Structure.Name` required for normal multi-mode data integrity; use server-owned localized technical values for the system Structure.
-   [ ] 1.8. Do not bump `interpretationNetworkTemplate.version` or platform schema versions.
-   [ ] 1.9. Add tests for:
    -   accepted enum values;
    -   unknown value rejection/default handling;
    -   strict unknown-key behavior;
    -   default `multiple`;
    -   no workspace override registration.

### Phase 2: Metahub settings UI and publication materialization

-   [ ] 2.1. Update `InterpretationNetworkWorkspaceWidgetEditorDialog.tsx` to show the localized mode control.
-   [ ] 2.2. Inspect and reuse the current Metahub Settings/widget editor primitives so the same widget setting appears there without inventing a parallel settings surface.
-   [ ] 2.3. Add EN/RU keys in metahub i18n namespaces.
-   [ ] 2.4. Add tests for metahub widget editor save/cancel/default/validation behavior.
-   [ ] 2.5. Verify `SnapshotSerializer` includes the new widget config value through existing layout/widget serialization.
-   [ ] 2.6. Add or update snapshot/materialization tests so the setting survives publish/create application.
-   [ ] 2.6a. Add application re-sync tests:
    -   inherited application updates from changed metahub `structureMode`;
    -   explicit application override remains unchanged;
    -   reset returns to the refreshed materialized default;
    -   workspace-authored Structures/TableTemplates/Materials survive untouched.
-   [ ] 2.7. Add a negative test that unsupported built-in templates do not expose the Interpretation Network-specific control.

### Phase 3: Application Settings override/reset flow

-   [ ] 3.1. Extend `InterpretationNetworkMatrixSettings` in `ApplicationSettings.tsx`.
-   [ ] 3.2. Update `parseMatrixSettings`.
-   [ ] 3.3. Add `structureMode` to `INTERPRETATION_NETWORK_WORKSPACE_CONFIG_KEYS`.
-   [ ] 3.4. Update `areMatrixSettingsEqual`.
-   [ ] 3.5. Update `normalizeMatrixSettingsForSave`.
-   [ ] 3.6. Update batch-save payload building and optimistic version checks.
-   [ ] 3.7. Update TanStack Query invalidation/refetch paths after save/reset.
-   [ ] 3.8. Update `MatrixSettingsPanel.tsx` with the localized mode control and help text.
-   [ ] 3.9. Update `ApplicationLayouts.tsx` if it embeds the same Matrix settings editor in widget layout editing.
-   [ ] 3.10. Add EN/RU keys in application frontend i18n.
-   [ ] 3.11. Add tests for:
    -   inherited value display;
    -   explicit override save;
    -   reset to materialized default;
    -   divergent-widget warning;
    -   unknown key filtering;
    -   application query invalidation;
    -   unsupported template absence.

### Phase 4: Backend aggregate command service

-   [ ] 4.1. Create a dedicated controller/service/store boundary for Interpretation Network runtime aggregate commands.
-   [ ] 4.2. Register routes in `applicationsRoutes.ts` under the existing authenticated application runtime/workspace route family and preserve current `workspaceId` propagation.
-   [ ] 4.3. Reuse existing runtime context resolution:
    -   request-scoped executor;
    -   application membership;
    -   current workspace;
    -   RLS workspace context;
    -   application settings/materialized widget config.
-   [ ] 4.4. Implement trusted metadata resolution:
    -   find compatible Interpretation Network widget;
    -   resolve `Structure`, `Interpretation`, `Material`, `TableTemplate`;
    -   resolve TABLE components and physical names from metadata only.
-   [ ] 4.4a. Add strict command schemas that reject unknown keys and reject browser-supplied schema/table/column names, object collection ids, component field names, and physical metadata names.
-   [ ] 4.5. Implement `ensureSingleSystemStructure`:
    -   require effective `structureMode === 'singleSystem'`;
    -   authorize by legitimate runtime workspace read access plus effective single-mode config;
    -   serialize the first-entry critical section with transaction-scoped lock;
    -   find exactly one active row with hidden `SystemKey = 'primary'`;
    -   create Structure, canonical Interpretation, and root Matrix cell if none exists;
    -   return the aggregate ids needed by the runtime, not a user-facing Structure title;
    -   fail closed on duplicates or malformed aggregate.
-   [ ] 4.6. Implement `saveStructureAsTemplate`:
    -   require `createContent` and `editContent` plus source access;
    -   lock source Structure/Interpretation and Matrix child rows;
    -   validate optimistic source version;
    -   validate every Material copied by `MaterialRef` or `CellId` belongs to the active workspace/source Matrix and is readable through the request-scoped/RLS executor;
    -   fail closed on broken, cross-workspace, or unauthorized Material references unless product approves a documented omit policy;
    -   create `TableTemplate`;
    -   copy `TemplateMatrix` rows with fresh UUID v7 `CellId`;
    -   remap `ParentCellId`, row keys, column keys, and sort order;
    -   when Materials are included, create fresh template Material rows and set template Matrix `MaterialRef` to the new row ids;
    -   when Materials are excluded, clear all template `MaterialRef` values.
-   [ ] 4.7. Implement `instantiateTemplate`:
    -   require multi-mode effective config;
    -   require `createContent` and `editContent`;
    -   require read access to the template;
    -   validate template Materials through the same workspace/RLS boundary before cloning;
    -   create destination Structure and canonical Interpretation;
    -   copy `TemplateMatrix` to destination Matrix with fresh UUID v7 `CellId`;
    -   remap hierarchy, row/column equivalence keys, ordering, styles, labels, and allowed Matrix fields;
    -   copy Materials only when they exist in the template and are allowed by the template's saved material policy;
    -   return new Structure id and route target.
-   [ ] 4.8. Add delete/rename protections for system aggregate while single mode is active, either in aggregate routes or existing generic runtime mutation guard paths.
-   [ ] 4.9. Clarify template edit/rename/delete lifecycle. Either keep it out of this slice explicitly, or protect it through existing generic runtime permissions plus the same workspace/RLS and system-template safeguards.
-   [ ] 4.9a. Document in code-facing docs why phase 1 uses existing `createContent`/`editContent` instead of a new template-specific capability, and list the product trigger for adding a dedicated permission later.
-   [ ] 4.10. Ensure all aggregate commands use one transaction and rollback on any partial failure.
-   [ ] 4.11. Dispatch lifecycle/mutation events only after commit and never dispatch success events for rolled-back commands.
-   [ ] 4.12. Add localized machine-readable error codes for UI mapping.
-   [ ] 4.13. Add log hygiene for aggregate errors: no request bodies, row payloads, Editor.js bodies, material text, or broad raw id lists in normal logs.

### Phase 5: Runtime MUI data hooks, routing, and screen behavior

-   [ ] 5.1. Add API functions in `packages/universo-react-apps-template-mui/src/api/api.ts` or a local Interpretation Network API module.
-   [ ] 5.2. Add typed query keys and mutation helpers in the runtime Interpretation Network folder.
-   [ ] 5.3. Update `InterpretationNetworkWorkspaceWidget.tsx` to derive effective `structureMode` from normalized config.
-   [ ] 5.4. In `singleSystem`, call the ensure command before rendering Matrix and cache the returned aggregate.
-   [ ] 5.5. Avoid loading Structure list for normal single-mode entry unless needed for diagnostics.
-   [ ] 5.6. Update `useStructureRoute.ts` for ID-free canonical route and history replacement.
-   [ ] 5.7. Update `useMatrixRouteSelectionSync` so `?matrixCell=` survives direct entry, refresh, and back/forward.
-   [ ] 5.8. Update `WorkspaceShell` to hide title/back/actions in single mode.
-   [ ] 5.9. Update `StructurePane` to branch between:
    -   multi-mode list/filter/create/detail;
    -   single-mode direct Matrix shell.
-   [ ] 5.10. Add Save Template dialog and Create From Template dialog using existing local MUI patterns.
-   [ ] 5.11. Add i18n keys in `packages/universo-react-apps-template-mui/src/i18n/locales/{en,ru}/interpretationNetwork.json`.
-   [ ] 5.12. Add mutation invalidation so save/instantiate refreshes:
    -   templates list;
    -   destination Structure list in multi mode;
    -   Matrix rows;
    -   Materials where needed.
-   [ ] 5.13. Preserve package isolation: no imports from `universo-react-template-mui`, metahubs frontend, applications frontend, admin frontend, profile frontend, or start frontend.

### Phase 6: Unit, service, and component tests

-   [ ] 6.1. `@universo-react/types` tests:
    -   enum defaults;
    -   strict config parsing;
    -   invalid values;
    -   no workspace override key.
-   [ ] 6.2. Metahub backend tests:
    -   hidden `SystemKey` component exists on Structure;
    -   no template/schema version bump, including exact `interpretationNetworkTemplate.version`;
    -   TableTemplate/TemplateMatrix metadata remains compatible;
    -   registry includes exact built-in codenames `basic`, `basic-demo`, `empty`, `lms`, `1c-compatible`, `playcanvas`, `interpretation-network`.
-   [ ] 6.3. Application backend service tests:
    -   ensure creates one aggregate from zero rows;
    -   ensure returns existing aggregate;
    -   concurrent ensure produces exactly one aggregate;
    -   duplicate system rows fail closed;
    -   missing root Matrix fails closed or repairs only when explicitly safe;
    -   read-only workspace member can open single Matrix through ensure without gaining generic Structure/TableTemplate/Material create permission;
    -   switching a workspace with existing non-system Structures to `singleSystem` is blocked or follows the product-approved adoption/archive rule;
    -   save template denied for insufficient rights;
    -   instantiate denied for insufficient rights;
    -   physical schema/table/column names, object collection ids, component field names, or metadata physical names supplied by the client are rejected;
    -   cross-workspace template id is denied;
    -   broken/cross-workspace/unauthorized Material references are denied or handled exactly by the documented omit policy;
    -   stale optimistic version fails;
    -   injected failure rolls back Structure/Interpretation/Matrix/Material/template rows;
    -   lifecycle/mutation events fire only after commit and do not fire on rollback;
    -   aggregate errors do not log request bodies, Editor.js bodies, material text, row payloads, or broad raw id lists.
-   [ ] 6.4. Matrix remap tests:
    -   Structure to TableTemplate remaps `CellId`;
    -   Structure to TableTemplate remaps `ParentCellId`;
    -   Structure to TableTemplate remaps row/column key equivalence classes;
    -   Structure to TableTemplate clears Material refs when excluded;
    -   Structure to TableTemplate copies fresh Materials when included;
    -   TableTemplate to Structure repeats the same identity guarantees;
    -   source rows remain unchanged.
    -   a field-by-field allowlist test proves that unknown identity/reference fields are not copied accidentally.
-   [ ] 6.5. Application frontend Vitest/component tests:
    -   Application Settings parser/normalizer/whitelist/equality;
    -   UI labels EN/RU;
    -   reset/inheritance/conflict behavior;
    -   Application Layouts widget editor behavior.
-   [ ] 6.6. Apps-template MUI component tests:
    -   single mode hides list/header/back/create/edit/delete Structure actions;
    -   Matrix renders after mocked ensure;
    -   route repair uses replace;
    -   save-template dialog semantics;
    -   create-from-template dialog only appears in multi mode;
    -   material-copy policy text is visible and accessible from the dialog description;
    -   no raw IDs/JSON/object cells in tested surfaces.

### Phase 7: Playwright, local Supabase, screenshots, and fixture

-   [ ] 7.1. Start local E2E Supabase minimal for full browser proof:
    -   `pnpm supabase:e2e:start:minimal`
    -   `pnpm run build:e2e:local-supabase`
-   [ ] 7.2. Update the product generator `tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts` so the canonical Interpretation Network metahub explicitly sets `singleSystem`.
-   [ ] 7.3. Regenerate `tools/fixtures/metahubs-interpretation-network-app-snapshot.json` through Playwright only.
-   [ ] 7.4. Extend `interpretationNetworkFixtureContract.ts`:
    -   assert `structureMode: 'singleSystem'`;
    -   assert unchanged schema/template versions, including exact Interpretation Network template version fields;
    -   assert zero runtime-authored Structure/Interpretation/Relation/Material/TableTemplate rows;
    -   assert exact built-in template registry coverage.
-   [ ] 7.5. Extend fixture drift checks so manually edited JSON or missing normalized values fail.
-   [ ] 7.6. Add focused single-mode Playwright flow:
    -   import generated snapshot;
    -   create/open application workspace;
    -   click `Structures`;
    -   assert Matrix appears directly;
    -   assert no list/header/back/system name/raw UUID;
    -   assert canonical ID-free route;
    -   assert refresh/back/forward behavior;
    -   assert `?matrixCell=` focus survives.
-   [ ] 7.7. Add focused template Playwright flow:
    -   create/edit Matrix with representative hierarchy/style/content;
    -   save as template structure-only;
    -   switch the same application/workspace to multi mode through the application override when instantiating a template that was saved in single mode, so workspace-local template ownership remains valid;
    -   instantiate template;
    -   assert Matrix data exists and Materials are absent;
    -   save as template with Materials;
    -   instantiate template;
    -   assert Materials exist and source/template remain unchanged.
-   [ ] 7.8. Add focused permission Playwright flow:
    -   editor sees save/instantiate actions;
    -   member/read-only user does not;
    -   direct API attempt returns `403`;
    -   cross-workspace guessed ids are denied.
-   [ ] 7.9. Keep the current imported-snapshot flow as a multi-mode regression for list/header/back behavior, rather than expanding it into one very large proof.
-   [ ] 7.10. Add one unrelated-template browser absence canary; do not create full browser flows for all seven templates.
-   [ ] 7.11. Add screenshots and UX assertions:
    -   `interpretation-network-single-system-matrix-desktop`;
    -   `interpretation-network-single-system-matrix-tablet`;
    -   `interpretation-network-single-system-matrix-mobile`;
    -   `interpretation-network-save-template-dialog-mobile`;
    -   `interpretation-network-template-instantiation-result`.
-   [ ] 7.12. Use role/label/test-id locators and web-first assertions. Reuse existing runtime UX oracle helpers where applicable: `expectNoTechnicalLeakage`, `expectSemanticFieldControls`, `expectLocalizedValidation`, `expectNoPageHorizontalOverflow`, and `expectRuntimeUxViewportMatrix`. Do not use `pnpm dev`.
-   [ ] 7.13. Add keyboard-path proof: tab from the `Structures` navigation into Matrix toolbar/cells, open the Materials panel/dialog, close it, and verify focus restoration.
-   [ ] 7.14. Run local Supabase stop/cleanup only through supported E2E scripts, not destructive manual database commands.

### Phase 8: Documentation and README updates

-   [ ] 8.1. Update `docs/en/architecture/interpretation-network-data-model.md`.
-   [ ] 8.2. Update `docs/ru/architecture/interpretation-network-data-model.md`.
-   [ ] 8.3. Update `docs/en/guides/interpretation-network.md`.
-   [ ] 8.4. Update `docs/ru/guides/interpretation-network.md`.
-   [ ] 8.5. Update `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` only if new pages are added. For existing page edits, keep paths stable.
-   [ ] 8.6. Update `packages/universo-react-apps-template-mui/README.md` and `README-RU.md` to describe conditional single/multi Structure behavior and package isolation.
-   [ ] 8.7. Update `packages/universo-react-applications-frontend/README.md` and `README-RU.md` for Application Settings override/reset behavior.
-   [ ] 8.8. Update `packages/universo-react-metahubs-backend/README.md` and `README-RU.md` if template metadata/system identity behavior is documented there.
-   [ ] 8.9. Document:
    -   single vs multi mode;
    -   no workspace override;
    -   workspace-local templates;
    -   role requirements;
    -   why existing create/edit permissions are used in phase 1 and when a dedicated template capability would be introduced;
    -   copy allowlist;
    -   excluded Relations/files;
    -   fixture generation path;
    -   local Supabase verification commands.
-   [ ] 8.10. Keep GitBook docs bilingual and structurally aligned.
-   [ ] 8.11. Do not reference screenshot assets from docs unless they are generated by the planned Playwright/documentation workflow and covered by screenshot-asset checks.

### Phase 9: Verification, closeout, and review

-   [ ] 9.1. Run focused unit/service/component tests:

```bash
pnpm --filter @universo-react/types test
pnpm --filter @universo-react/metahubs-backend test
pnpm --filter @universo-react/applications-backend test
pnpm --filter @universo-react/metahubs-frontend test
pnpm --filter @universo-react/applications-frontend test
pnpm --filter @universo-react/apps-template-mui test
```

-   [ ] 9.2. Run fixture and local Supabase proof:

```bash
pnpm run check:interpretation-network-fixture-contract
pnpm run check:interpretation-network-fixture-drift
pnpm run test:e2e:interpretation-network-fixture-gate:local-supabase
pnpm run test:e2e:interpretation-network:verify:local-supabase
```

-   [ ] 9.3. Add new package scripts for focused template/direct-mode flows if needed, then include them in the local Supabase verification wrapper.
-   [ ] 9.4. Run docs checks:

```bash
pnpm run docs:i18n:check
pnpm run docs:gitbook-screenshot-assets:check
```

-   [ ] 9.5. Run isolation and anti-fork checks:

```bash
pnpm run check:runtime-no-lms-forks
```

-   [ ] 9.6. Run formatting/lint/build in proportion to changed packages, then full root build before merge when feasible:

```bash
git diff --check
pnpm build
```

-   [ ] 9.7. Run OntoIndex changed-scope verification before commit:

```bash
ontoindex detect-changes --repo universo-platformo-react
```

-   [ ] 9.8. Apply Thermos/autoreview quality gate after code changes.
-   [ ] 9.9. Update `memory-bank/tasks.md` or `memory-bank/progress.md` only after implementation/verification, not during this planning-only step.

## Code Examples For The Implementation

These snippets define the intended shape and safety level. They are examples for implementation, not product-code changes made by this PLAN.

### Shared widget config enum

```ts
export const interpretationNetworkStructureModes = ['multiple', 'singleSystem'] as const

export type InterpretationNetworkStructureMode = (typeof interpretationNetworkStructureModes)[number]

export const interpretationNetworkWorkspaceWidgetConfigSchema = z
    .object({
        // Existing keys stay here.
        structureMode: z.enum(interpretationNetworkStructureModes).optional()
    })
    .strict()

export const normalizeInterpretationNetworkWidgetConfig = (value: unknown): InterpretationNetworkWorkspaceWidgetConfig => {
    const parsed = interpretationNetworkWorkspaceWidgetConfigSchema.safeParse(value)
    const config = parsed.success ? parsed.data : {}

    return {
        ...config,
        structureMode: config.structureMode ?? 'multiple'
    }
}
```

### Application Settings whitelist guard

```ts
const INTERPRETATION_NETWORK_WORKSPACE_CONFIG_KEYS = ['splitPane', 'matrixView', 'structureMode'] as const

const normalizeMatrixSettingsForSave = (settings: InterpretationNetworkMatrixSettings): InterpretationNetworkWorkspaceWidgetConfig => ({
    ...existingNormalizedFields(settings),
    structureMode: settings.structureMode ?? 'multiple'
})
```

### Backend aggregate transaction skeleton

```ts
export async function ensureSingleSystemStructure(ctx: RuntimeInterpretationNetworkContext): Promise<SystemStructureResult> {
    if (ctx.config.structureMode !== 'singleSystem') {
        throw new RuntimeCommandError('interpretationNetwork.singleModeRequired')
    }

    return ctx.manager.transaction(async (tx) => {
        await lockInterpretationNetworkAggregate(tx, {
            applicationId: ctx.applicationId,
            workspaceId: ctx.workspaceId,
            structureObjectId: ctx.metadata.structure.objectId
        })

        const existing = await findSystemStructures(tx, ctx)

        if (existing.length > 1) {
            throw new RuntimeCommandError('interpretationNetwork.duplicateSystemStructure')
        }

        if (existing.length === 1) {
            return ensureCanonicalInterpretationAndRoot(tx, ctx, existing[0])
        }

        const structureId = await insertStructure(tx, ctx, {
            id: await generateUuidV7(tx),
            systemKey: 'primary',
            name: {
                en: 'Main structure',
                ru: 'Основная структура'
            }
        })

        return createCanonicalInterpretationWithRoot(tx, ctx, structureId)
    })
}
```

### Safe SQL boundary

```ts
const table = qSchemaTable(ctx.schemaName, ctx.metadata.structure.tableName)

const result = await tx.query<{ id: string }>(
    `
    INSERT INTO ${table} (id, ${qColumn(systemKeyColumn)}, ${qColumn(nameColumn)})
    VALUES ($1, $2, $3)
    RETURNING id
  `,
    [structureId, 'primary', localizedName]
)

if (result.rows.length !== 1) {
    throw new RuntimeCommandError('interpretationNetwork.structureCreateFailed')
}
```

### Matrix remap algorithm

```ts
type CellCopyMode = 'structureToTemplate' | 'templateToStructure'

function remapMatrixCells(sourceCells: MatrixCell[], mode: CellCopyMode): RemapResult {
    const cellIdBySource = new Map<string, string>()
    const rowKeyBySource = new Map<string, string>()
    const colKeyBySource = new Map<string, string>()

    for (const cell of sourceCells) {
        cellIdBySource.set(cell.cellId, generateUuidV7())
        if (cell.rowKey) rowKeyBySource.set(cell.rowKey, rowKeyBySource.get(cell.rowKey) ?? generateUuidV7())
        if (cell.colKey) colKeyBySource.set(cell.colKey, colKeyBySource.get(cell.colKey) ?? generateUuidV7())
    }

    return {
        cells: sourceCells.map((cell) => ({
            ...copyAllowedMatrixFields(cell),
            id: generateUuidV7(),
            cellId: requireMapped(cellIdBySource, cell.cellId),
            parentCellId: cell.parentCellId ? requireMapped(cellIdBySource, cell.parentCellId) : null,
            rowKey: cell.rowKey ? requireMapped(rowKeyBySource, cell.rowKey) : null,
            colKey: cell.colKey ? requireMapped(colKeyBySource, cell.colKey) : null,
            materialRef: null
        }))
    }
}
```

### Runtime query invalidation after template instantiation

```ts
const instantiateTemplate = useMutation({
    mutationFn: api.instantiateInterpretationNetworkTemplate,
    onSuccess: async (result) => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: interpretationNetworkKeys.structures(workspaceId) }),
            queryClient.invalidateQueries({ queryKey: interpretationNetworkKeys.matrix(result.structureId) }),
            queryClient.invalidateQueries({ queryKey: interpretationNetworkKeys.materials(result.structureId) })
        ])

        navigate(buildStructureRoute(result.structureId))
    }
})
```

### Playwright user-visible oracle

```ts
await page.getByRole('link', { name: /structures|структуры/i }).click()
await expect(page.getByRole('heading', { name: /matrix|матрица/i })).toBeVisible()
await expect(page.getByRole('button', { name: /back|назад/i })).toHaveCount(0)
await expect(page.getByText(/[0-9a-f]{8}-[0-9a-f]{4}/i)).toHaveCount(0)
await expectNoPageHorizontalOverflow(page, 'single-system-matrix')
await page.screenshot({ path: screenshotPath('interpretation-network-single-system-matrix-desktop.png'), fullPage: true })
```

## Testing Matrix

| Layer                        | Required proof                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Shared types                 | Strict enum, defaulting, invalid value behavior, no workspace override.                        |
| Metahub backend              | Hidden system component metadata, no version bump, template registry coverage.                 |
| Metahub frontend             | Widget editor and Settings round trip, localized labels, unsupported absence.                  |
| Publication/application sync | Widget config materializes, application override/reset persists, conflicts remain visible.     |
| Backend service              | Atomic ensure, template save, template instantiate, remap, permissions, rollback, concurrency. |
| Runtime component            | Single-mode branch hides list/title/back, dialogs behave semantically, no technical leakage.   |
| Playwright                   | Direct Matrix entry, route repair, template flows, permission flow, responsive screenshots.    |
| Fixture                      | Generator-only JSON, semantic contract, drift check, no runtime rows, exact template registry. |
| Docs                         | EN/RU GitBook and README mirrors match actual behavior and role/material limits.               |

## Potential Challenges And Mitigations

-   **Challenge:** Application Settings has a hard widget-config whitelist.
    -   **Mitigation:** Add tests that fail if `structureMode` is saved in UI but omitted from the persisted payload.
-   **Challenge:** Current frontend Structure creation is non-atomic.
    -   **Mitigation:** Use backend aggregate commands for system ensure and template copy; keep the old helper only for ordinary multi-mode creation until it is replaced.
-   **Challenge:** Single mode conflicts with creating new Structures from templates.
    -   **Mitigation:** Save templates in single mode if authorized, but instantiate only in multi mode. Do not silently overwrite the system Matrix.
-   **Challenge:** `Structure.Name` is required but the user must not name the system Structure.
    -   **Mitigation:** Store a valid server-owned localized technical name and hide it in single-mode UI.
-   **Challenge:** Matrix cells have graph identities that cannot be copied verbatim.
    -   **Mitigation:** Build explicit remap utilities and test both copy boundaries.
-   **Challenge:** Materials may contain external references in Editor.js Body.
    -   **Mitigation:** Copy stored Body content as authored content references, but do not clone binary resources/files or credentials. Document the limit.
-   **Challenge:** RLS and guessed cross-workspace ids can create false positives in UI-only tests.
    -   **Mitigation:** Add direct service/route tests and Playwright direct API denial checks.
-   **Challenge:** Full browser coverage for all seven templates would be slow and low-value.
    -   **Mitigation:** Use registry/unit coverage for all templates, full browser canary for Interpretation Network, and one unrelated-template absence canary.
-   **Challenge:** `apps-template-mui` isolation can be broken by convenient imports from legacy packages.
    -   **Mitigation:** Keep duplicated local UI primitives where needed and run `check:runtime-no-lms-forks`.
-   **Challenge:** Context7 may remain unavailable.
    -   **Mitigation:** Use primary official web documentation and record provenance; retry Context7 during QA if tool access returns.

## Dependencies

-   Existing local Supabase E2E tooling must be available for the final proof.
-   Node 22 must be active for E2E/build commands.
-   Product approval is needed if any of these decisions change:
    -   template application/replacement inside single mode;
    -   cross-workspace/application template sharing;
    -   copying Relations or binary assets;
    -   a new dedicated permission/capability beyond existing content create/edit/delete.

## Open Questions For Approval

The plan proceeds with the recommended decisions from research. Confirm before IMPLEMENT if any answer should change:

1. Single mode supports saving templates but not creating a new Structure from a template. Is that accepted for this slice?
2. Material copy includes stored Material Title, Description, and Editor.js Body, but not external file/blob cloning. Is that accepted?
3. Relations are excluded from phase-1 template copy. Is that accepted?
4. The canonical generator sets inherited metahub `singleSystem`; multi-mode regression uses a separate override/test setup. Is that accepted?
