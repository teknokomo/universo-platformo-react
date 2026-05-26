# 1C-Compatible Metahub Template Plan

Date: 2026-05-26

Research artifact: [memory-bank/research/1c-compatible-metahub-template-research-2026-05-26.md](../research/1c-compatible-metahub-template-research-2026-05-26.md)

## Overview

Build an opt-in `1C-Compatible` metahub template that ships a complete preset catalog for 1C:Enterprise-like metadata objects while keeping the default `basic`, `basic-demo`, `empty`, and `lms` templates unchanged.

The implementation should introduce typed specialized behavior for the 1C-compatible preset family through the Entity Type Constructor, while keeping the behavior generic enough to be reused by future non-1C templates. New behavior should be expressed as typed preset configuration and generic services before introducing physical schema changes.

The user-facing template name is `1C-Compatible`. UI and documentation must not claim official 1C certification, endorsement, partnership, or logo rights, and must not import or copy 1C code, configurations, database layouts, or UI assets.

## Decisions

-   Use `1C-Compatible` as the template display name and `1c-compatible` as the codename.
-   Keep `DEFAULT_TEMPLATE_CODENAME = 'basic'`; the new template is opt-in.
-   Do not bump existing metahub structure/template versions for `basic`, `basic-demo`, `empty`, or `lms`.
-   Add all 12 target preset names to the product roadmap and docs. Only mark a preset runtime-ready after the matching behavior, validation, DDL/runtime storage, UI, and tests are implemented.
-   Prefer typed behavior configs in `@universo-react/types` over UI-only flags.
-   Add typed specialized behavior configs such as `catalogBehavior`, `documentBehavior`, `registerBehavior`, `journalBehavior`, `accountChartBehavior`, `dynamicCharacteristic`, and `calculationTypeGraph` as reusable Entity Type Constructor capabilities/config sections, not as hardcoded 1C-only runtime branches.
-   Deliver a top-level Constant preset for `1C-Compatible` through a first-class `singleValue` contract:
    -   constants must not appear to users as children of Sets in the `1C-Compatible` template;
    -   Set/fixedValues reuse is allowed only as an internal implementation detail if it does not leak into the user model;
    -   add dedicated DDL/storage through `@universo-react/schema-ddl` when the single-value/periodic constant contract cannot be represented cleanly by existing storage.
-   Phase 2+ must include a full top-level Constant design-time and published-runtime editor before Constant is marked runtime-ready. Reusing Set/fixedValues is an implementation detail only; the user-facing model must not present Constants as children of Sets in the `1C-Compatible` template.
-   Use both declarative movement mapping and module hooks for posting:
    -   declarative mapping for common register movements;
    -   `onPosting` modules for complex domain logic;
    -   both executed inside one transaction with idempotency and rollback.
-   Use synchronous posting-time projection tables for strict accumulation/accounting balances. Materialized views may be added later only for non-critical reporting.
-   Implement Document Journal first through the existing `records.union` runtime datasource plus journal presentation metadata. Persisted SQL views can be added later through a dedicated `@universo-react/schema-ddl` boundary if performance requires it.
-   Keep published runtime UI in `packages/universo-react-apps-template-mui`; do not import legacy feature packages into it.

## Target Preset Catalog

| Preset                        | Initial implementation strategy                                                                                                            | Readiness target                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Constant                      | Top-level preset with a typed `singleValue` contract and editor.                                                                           | Core catalog; runtime-ready after Phases 2-7 and 11.                 |
| Enumeration                   | Reuse existing `enumeration` preset with 1C template presentation.                                                                         | Core catalog; runtime-ready after Phases 2, 6, 11.                   |
| Catalog                       | Object-compatible capabilities plus typed `catalogBehavior`: identity fields, hierarchy, owner subordination, predefined rows.             | Core catalog; runtime-ready after Phases 2, 6-7, 11.                 |
| Document                      | Object-compatible capabilities plus typed `documentBehavior` and `documentPosting`: numbering, effective date, lifecycle, posting actions. | Core catalog; runtime-ready after Phases 2-4, 6-7, 11.               |
| Document Journal              | Typed `journalBehavior` over multiple Document presets, initially backed by `records.union` runtime datasource when sufficient.            | Core catalog; runtime-ready after Phases 2, 5-7, 11.                 |
| Information Register          | Register-compatible capabilities plus typed `registerBehavior` with facts mode, periodicity, dimensions, resources, registrar rules.       | Core catalog; runtime-ready after Phases 2-7 and 11.                 |
| Accumulation Register         | Register-compatible capabilities plus typed `registerBehavior` with balance mode, movement direction, totals/projections.                  | Core catalog; runtime-ready after Phases 2-7 and 11.                 |
| Chart of Accounts             | Object-compatible capabilities plus typed `accountChartBehavior`, account flags, and sub-conto metadata.                                   | Accounting catalog; runtime-ready after Phase 8 and matching tests.  |
| Chart of Characteristic Types | Object-compatible capabilities plus typed `dynamicCharacteristic` value governance.                                                        | Accounting catalog; runtime-ready after Phase 8 and matching tests.  |
| Accounting Register           | Register-compatible capabilities plus typed accounting `registerBehavior`: debit/credit account linkage and sub-conto analytics.           | Accounting catalog; runtime-ready after Phase 8 and matching tests.  |
| Chart of Calculation Types    | Object-compatible capabilities plus typed `calculationTypeGraph` dependency semantics.                                                     | Calculation catalog; runtime-ready after Phase 9 and matching tests. |
| Calculation Register          | Register-compatible capabilities plus typed calculation `registerBehavior`: action/base periods, schedules, recalculation.                 | Calculation catalog; runtime-ready after Phase 9 and matching tests. |

## Affected Areas

-   `packages/universo-react-types/src/common/`
    -   behavior/config contracts, capability dependencies, runtime metadata types, workflow action contracts.
-   `packages/universo-react-utils/src/`
    -   shared validation/normalization helpers if behavior config logic is cross-package.
-   `packages/universo-react-schema-ddl/src/`
    -   runtime DDL generation for single-value storage only if needed, journal views if later persisted, register projections, and system columns where required.
-   `packages/universo-react-metahubs-backend/src/domains/templates/data/`
    -   new `1c-compatible` template manifest and preset manifests.
-   `packages/universo-react-metahubs-backend/src/domains/templates/services/`
    -   manifest validation, seed execution, template version/hash behavior tests.
-   `packages/universo-react-metahubs-backend/src/domains/metahubs/services/`
    -   entity type sync, schema materialization, preset default instance creation.
-   `packages/universo-react-applications-backend/src/`
    -   runtime posting, register movement, projection, and journal/read-model services.
-   `packages/universo-react-metahubs-frontend/src/domains/templates/`
    -   template picker/preset picker UX, TanStack Query invalidation, i18n.
-   `packages/universo-react-metahubs-frontend/src/domains/entities/`
    -   Entity Type Constructor guided forms for catalog/document/register/chart behavior.
-   `packages/universo-react-template-mui/src/`
    -   metahub shell/menu grouping and icon registry where needed.
-   `packages/universo-react-apps-template-mui/src/`
    -   generic runtime views/widgets for journals, registers, posting actions, and DataGrid display contracts.
-   `packages/universo-react-i18n/`
    -   shared EN/RU keys where text is shared across packages.
-   `docs/en/**` and `docs/ru/**`
    -   GitBook product and technical documentation with screenshot assets.
-   `tools/testing/e2e/**` and `tools/fixtures/**`
    -   Playwright flows, screenshot generators, fixture contracts, local Supabase E2E support.

## Architecture Notes

### Layer Ownership

| Layer                     | Owns                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Metahub                   | template manifest, entity type presets, behavior configs, default layouts, modules, seed metadata, preset docs. |
| Application control panel | deployed-instance tuning: enabled workspaces, global defaults, publishing/sync state, access policies.          |
| Workspace runtime         | end-user records: catalog entries, documents, register facts/movements, posting commands, journals, reports.    |

### Preset Representation

Specialized presets should remain `entity-type-preset/v1` manifests with custom `kindKey` values such as `catalog`, `document`, `information-register`, and `accumulation-register`. They must be authored through the same Entity Type Constructor model available to future non-1C templates. Presets should compose capabilities plus typed specialized behavior:

-   Catalog: `dataSchema`, `records`, `identityFields`, `hierarchy`, `nestedCollections`, `relations`, `layoutConfig`, `runtimeBehavior`, plus `catalogBehavior`.
-   Document: Catalog-like data capabilities plus `recordLifecycle`, `posting`, `modules`, plus `documentBehavior` / `documentPosting`.
-   Registers: `dataSchema`, `records`, `ledgerSchema`, `posting`, `runtimeBehavior`, plus `registerBehavior`; concrete DDL/storage is generated through `@universo-react/schema-ddl`.
-   Charts: Object-like capabilities plus typed behavior configs.

Only add a new capability when the current capability set cannot express the storage/runtime contract. Likely candidates are:

-   `singleValue` for top-level constants.
-   `virtualCollection` for document journals if `records.union` plus presentation metadata cannot carry enough journal semantics.
-   `dynamicCharacteristic` for typed EAV-style values.

### Behavior Config Contracts

Add versioned, typed configs near existing `recordBehavior.ts` and `ledgers.ts`. These configs are specialized, but must be generic platform features usable outside the 1C-compatible template.

```ts
export type CatalogHierarchyMode = 'none' | 'groups-and-items' | 'items-only'

export interface CatalogBehaviorConfig {
    kind: 'catalog'
    code: {
        enabled: boolean
        autoNumbering: boolean
        unique: boolean
        periodicity?: 'none' | 'year' | 'quarter' | 'month' | 'day'
    }
    hierarchy: {
        mode: CatalogHierarchyMode
        ownerSubordination: boolean
    }
    predefinedRows?: Array<{
        codename: string
        presentation: string
    }>
}

export interface DocumentPostingConfig {
    kind: 'document'
    movements: Array<{
        targetRegisterCodename: string
        sourceTableCodename?: string
        directionFieldCodename?: string
        dimensionMappings: Record<string, string>
        resourceMappings: Record<string, string>
    }>
    moduleCodename?: string
    repostPolicy: 'replace-existing-batch' | 'reject-posted'
}
```

Validation should fail closed if a target register, module, source table, field mapping, or projection target cannot be resolved.

### Safe SQL Pattern

Domain services must use request-scoped or service-scoped `DbExecutor` according to the three-tier rule. Dynamic identifiers must be quoted through shared helpers.
Mutations that confirm row state, including posting, unposting, reposting, voiding, projection updates, and movement cleanup, must use `RETURNING` where row confirmation matters and fail closed when zero rows are affected.
Runtime posting, unposting, reposting, journal reads, and register reads are workspace runtime flows and must use Tier 1 request-scoped executors when RLS/auth applies. Tier 2 is allowed only for bootstrap, admin, public non-RLS, or template seed paths. Sort and filter fields must resolve from journal/register metadata through an allowlist to `qColumn(...)`; never concatenate client-provided field names, table names, or sort directions.

```ts
export async function listJournalRows(
    executor: DbExecutor,
    schemaName: string,
    journal: ResolvedJournalDefinition,
    params: JournalQueryParams
): Promise<JournalRow[]> {
    const branches = journal.sources.map((source, index) => {
        const table = qSchemaTable(schemaName, source.physicalTableName)
        return `
      SELECT
        $${index + 1}::text AS document_kind,
        id,
        ${qColumn(source.numberColumn)} AS number,
        ${qColumn(source.dateColumn)} AS record_date,
        ${qColumn(source.stateColumn)} AS state
      FROM ${table}
      WHERE workspace_id = $${journal.sources.length + 1}
    `
    })

    const allowedSortColumns = {
        date: 'record_date',
        number: 'number',
        state: 'state'
    } as const
    const sortKey = params.sort?.field ?? 'date'
    const sortColumn = allowedSortColumns[sortKey] ?? allowedSortColumns.date
    const sortDirection = params.sort?.direction === 'asc' ? 'ASC' : 'DESC'
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200)
    const offset = Math.max(params.offset ?? 0, 0)

    const sql = `
    SELECT *
    FROM (${branches.join('\nUNION ALL\n')}) AS journal_rows
    ORDER BY ${qColumn(sortColumn)} ${sortDirection}, ${qColumn('number')} ASC
    LIMIT $${journal.sources.length + 2}
    OFFSET $${journal.sources.length + 3}
  `

    return executor.query(sql, [...journal.sources.map((source) => source.kindCodename), params.workspaceId, limit, offset])
}
```

`id` and other transport identifiers may be selected for route internals, row actions, and mutation targets, but normal API display payloads and UI cells must expose stable user labels instead of UUID-only values.

### TanStack Query Pattern

Use structured query keys with all scope inputs and invalidate specific affected lists/details after mutations.

```ts
const createEntityTypeMutation = useMutation({
    mutationFn: createEntityTypeFromPreset,
    onSuccess: (_result, variables) => {
        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.entityTypes(variables.metahubId)
        })
        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.templatesList('entity_type_preset')
        })
    }
})
```

Runtime list keys must include application, workspace, collection/register/journal, filters, sort, page, and search to prevent stale cross-workspace data.

## UI Contract

### Template And Preset Picker

-   Run a primitive inventory before changing UI: inspect existing selectors, dialogs, cards, DataGrid wrappers, action toolbars, dashboard widgets, and runtime row-action primitives in `metahubs-frontend`, `template-mui`, and `apps-template-mui`.
-   Replace plain long `Select` flows with searchable grouped picker/dialog only when existing primitives cannot support the list length and metadata.
-   Show template/preset category, readiness status, short description, and non-affiliation wording where `1C-Compatible` is visible.
-   The template picker must show concise non-affiliation wording at the first user-facing `1C-Compatible` selection point.
-   Keep `basic` selected by default unless the user intentionally chooses `1C-Compatible`.
-   All UI text must be localized in EN/RU; no internal fallback keys on localized surfaces.

### Entity Type Constructor

-   Catalog, Document, Register, Chart, Journal, and Constant presets must have guided forms for normal setup.
-   Advanced JSON may remain only behind an explicit expert/admin/debug affordance. Normal creation/editing must not show or require JSON editors by default.
-   Reference fields must show display labels, not UUIDs or raw codenames as the only label.
-   Reference/select/chip surfaces must include user labels plus secondary context where useful. This includes target ledgers/registers, modules, source tabular parts, component mappings, charts, characteristic types, projections, journal source documents, and workspaces.
-   Empty optional resource/source/reference fields must not produce validation errors unless the selected mode makes them required.
-   Long semantic fields use multiline controls by default.
-   Validation messages must be localized and user-facing; raw Zod/internal validation messages must never appear on localized surfaces.

### Published Runtime

-   Runtime screens must use `@universo-react/apps-template-mui` primitives.
-   Normal tables/cards/dialogs must not show raw UUIDs, raw JSON, `[object Object]`, or internal field names.
-   Register movement rows must show registrar label, period/date, dimensions, resources, direction/status, and source line labels.
-   Document Journal must expose common user columns: document type label, number, date, presentation, status, posted state.
-   System-owned fields such as posting batch id, movement idempotency keys, raw registrar id, source JSON, and internal table names are hidden unless an admin/debug view explicitly opts in.
-   DataGrid page containers must not create page-level horizontal overflow. A grid viewport may scroll horizontally only inside the table boundary when columns exceed available width.
-   Desktop, tablet, and mobile screenshots must prove no page-level horizontal overflow.
-   Keyboard path must cover template selection, preset selection, save, runtime row actions, and posting commands.

### UI Contract Matrix

Each implementation PR must expand this matrix into an owner/evidence checklist with exact component names from the Phase 0 primitive inventory. Any new constructor/runtime panel must include a justification proving it is generic, metadata-driven, and not hardcoded to `1c-compatible`.

| Surface                                 | Reuse first                                                                                                                                    | Required user-facing behavior                                                                                                                                                                              | Required evidence                                                       | Owner/evidence path                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| Template picker                         | Existing `TemplateSelector`, MUI Dialog/Autocomplete/List primitives.                                                                          | Search/group templates, show `1C-Compatible` status and non-affiliation copy, keep `basic` default, no raw template ids.                                                                                   | EN/RU screenshots, keyboard select, no overflow.                        | Assign in implementation checklist. |
| Template/preset cards and previews      | Existing MUI Card/ListItem/Chip primitives.                                                                                                    | Show display name, category, runtime readiness, preview/disabled state, and non-affiliation copy where applicable; never use raw kindKey as primary title.                                                 | EN/RU screenshots and locator assertions for preview/disabled states.   | Assign in implementation checklist. |
| Metahub shell/menu grouping             | Existing `template-mui` menu and sidebar primitives.                                                                                           | Group 1C-compatible entity types without overwhelming the menu; labels are localized and user-facing; no route ids or kindKeys as primary labels.                                                          | Desktop/tablet/mobile navigation screenshots and no overflow.           | Assign in implementation checklist. |
| Entity preset picker                    | Existing preset selector, MUI Dialog/Autocomplete/List primitives.                                                                             | Group by reference, transaction, register, chart, preview; show preset names/descriptions/status, not kindKey as the primary label.                                                                        | Desktop/tablet/mobile screenshots, keyboard path.                       | Assign in implementation checklist. |
| Constructor capability editor           | Existing `EntitiesWorkspace`, capability sections, `RecordBehaviorFields`, `LedgerSchemaFields`, and shared field primitives where applicable. | Guided specialized behavior panels write typed reusable configs; no normal JSON editing; optional fields validate only when required by selected mode.                                                     | Vitest form mapping and Playwright create/edit flows.                   | Assign in implementation checklist. |
| Constant constructor panel              | Exact existing resource/form primitives selected in Phase 0, extended for `singleValue` only when justified.                                   | Top-level Constants are not shown as children of Sets in the 1C template; fields include label, data type, value, optional period/scope where supported.                                                   | Create/edit/copy/delete design-time screenshots and no raw storage ids. | Assign in implementation checklist. |
| Constant runtime editor dialog          | Existing runtime FormDialog/row-action primitives.                                                                                             | Users can create/read/edit/copy/delete constant values without seeing Set/fixedValues internals; semantic comments/descriptions are multiline; validation is localized.                                    | Runtime CRUD screenshots, EN/RU validation, no raw ids.                 | Assign in implementation checklist. |
| Constant runtime history DataGrid       | Existing runtime DataGrid primitives.                                                                                                          | Period/scope/value columns render formatted scalar labels; technical storage ids and implementation tables are hidden.                                                                                     | Runtime history screenshot and technical leakage assertions.            | Assign in implementation checklist. |
| Catalog constructor panel               | Existing capability sections plus typed `catalogBehavior` panel.                                                                               | Configures code/name, hierarchy, owner/subordination, predefined rows, tabular parts without JSON editing.                                                                                                 | Vitest mapping tests and browser create/edit screenshots.               | Assign in implementation checklist. |
| Catalog runtime list DataGrid           | Existing runtime CRUD DataGrid and row actions.                                                                                                | Code/name/hierarchy/owner display labels; predefined rows distinguishable without technical ids; object-valued references use display adapters with fallback labels.                                       | CRUD list screenshots and runtime UX helpers.                           | Assign in implementation checklist. |
| Catalog create/edit dialog              | Existing FormDialog and field primitives.                                                                                                      | Code/name and owner/reference fields use labels/Autocomplete; descriptions/comments/notes are multiline; hidden technical fields remain hidden.                                                            | Dialog screenshots, keyboard path, localized validation.                | Assign in implementation checklist. |
| Document constructor panel              | Existing capability sections, module pickers, plus typed `documentBehavior` / `documentPosting` panel.                                         | Configures number/date/lifecycle/posting mappings and modules using labels, not raw codenames.                                                                                                             | Vitest mapping tests, validation screenshots.                           | Assign in implementation checklist. |
| Document list DataGrid                  | Existing runtime CRUD DataGrid and row actions.                                                                                                | Number/date/status/posting state visible; document presentation shown; raw movement/register internals hidden.                                                                                             | List screenshots and API-to-UI consistency checks.                      | Assign in implementation checklist. |
| Document edit dialog                    | Existing FormDialog, tab primitives, and constrained tabular editor/DataGrid.                                                                  | Header fields use labels; line items use constrained tabular editor; long text is multiline; posting validation is localized.                                                                              | Create/edit/copy/delete screenshots and localized validation.           | Assign in implementation checklist. |
| Document posting toolbar                | Existing workflow action/row-action primitives.                                                                                                | Post/unpost/repost/void actions are enabled/disabled with localized reasons; keyboard usable; failures localized.                                                                                          | Keyboard-only posting flow and validation-state screenshots.            | Assign in implementation checklist. |
| Information Register constructor panel  | Existing `LedgerSchemaFields` plus typed `registerBehavior` panel.                                                                             | Configures facts mode, dimensions/resources/periodicity/registrar policy.                                                                                                                                  | Vitest mapping tests and validation screenshots.                        | Assign in implementation checklist. |
| Accumulation Register constructor panel | Existing `LedgerSchemaFields` plus typed `registerBehavior` panel.                                                                             | Configures balance mode, movement direction, resources, projections, idempotency.                                                                                                                          | Vitest mapping tests and validation screenshots.                        | Assign in implementation checklist. |
| Register movement DataGrid              | Existing generic DataGrid and ledger datasource adapters.                                                                                      | Registrar label, period/date, dimensions, resources, direction/status, and source-line labels render as formatted scalar text/chips; missing labels have explicit fallback text; raw movement JSON hidden. | Posting movement screenshots, constrained grid scroll check.            | Assign in implementation checklist. |
| Register projection DataGrid            | Existing generic DataGrid and ledger projection datasource.                                                                                    | Projection totals and filters render with labels and formatted values; client filter/sort maps through metadata allowlists.                                                                                | UI adapter tests and screenshots with constrained grid scroll.          | Assign in implementation checklist. |
| Document Journal DataGrid               | Existing `records.union` datasource and generic table/card widgets before new virtual collection.                                              | Common columns: document type, number, date, presentation, status, posted state; no physical table names.                                                                                                  | Mixed-source journal screenshot and no technical leakage assertions.    | Assign in implementation checklist. |
| Dashboard/runtime widgets               | Existing `apps-template-mui` dashboard/widget primitives.                                                                                      | Register/journal widgets are metadata-driven and reusable outside the 1C template; no one-off 1C widget fork unless audited and justified.                                                                 | Browser assertions proving generic runtime surface usage.               | Assign in implementation checklist. |
| Preview accounting panels               | Existing constructor/readiness/disabled-state primitives.                                                                                      | If visible before runtime-ready, panels are read-only/disabled with localized preview status and no publish/schema materialization path.                                                                   | Screenshot/locator assertions for disabled state.                       | Assign in implementation checklist. |
| Preview calculation panels              | Existing constructor/readiness/disabled-state primitives.                                                                                      | If visible before runtime-ready, panels are read-only/disabled with localized preview status and no publish/schema materialization path.                                                                   | Screenshot/locator assertions for disabled state.                       | Assign in implementation checklist. |

### Plan UX Reviewer Checklist

-   [ ] No normal user workflow requires raw IDs or hidden technical knowledge.
-   [ ] No normal table/card renders raw JSON, object cells, or UUID-only labels.
-   [ ] Long text fields are multiline.
-   [ ] Localized screens do not show raw validation/internal English fallbacks.
-   [ ] Existing MUI dashboard/app-template primitives are reused first.
-   [ ] `apps-template-mui` remains isolated from legacy feature packages.
-   [ ] Browser evidence is planned for desktop, tablet, and mobile.
-   [ ] Per-surface UI contract rows are satisfied before implementation starts.
-   [ ] Owner/evidence for each UI contract row is assigned in the implementation checklist before coding starts.

## Plan Steps

### Phase 0: Scope Lock And Baseline Audit

-   [ ] Reconfirm the exact first release scope:
    -   runtime-ready: Constant, Enumeration, Catalog, Document, Document Journal, Information Register, Accumulation Register;
    -   preview/roadmap: Chart of Accounts, Chart of Characteristic Types, Accounting Register, Chart of Calculation Types, Calculation Register.
-   [ ] Treat the runtime-ready label as an end-of-phase acceptance state, not as something achieved by manifest registration alone.
-   [ ] Add a short architecture decision note in the spec describing why typed specialized behaviors compose existing platform capabilities rather than replacing the base type system. Existing Object/Ledger internals may be reused only as compatibility substrate; they are not the user-facing behavior model for the `1C-Compatible` template.
-   [ ] Add a constructor-extension decision note: every 1C-compatible preset must be implemented as reusable Entity Type Constructor functionality, with no 1C-specific runtime hardcode.
-   [ ] Inventory current template registry, preset registry, manifest validator, schema DDL, runtime posting endpoints, and constructor guided fields.
-   [ ] Inventory existing MUI/runtime primitives and document which primitive each planned screen/dialog/table will reuse; justify any new component before implementation.
-   [ ] Record the non-affiliation wording policy for `1C-Compatible` UI/docs.
-   [ ] Verify no implementation path needs a metahub structure version bump.

### Phase 1: Shared Types And Validation Foundation

-   [ ] Add typed reusable behavior contracts in `@universo-react/types`:
    -   `singleValue`;
    -   `catalogBehavior`;
    -   `documentBehavior` / `documentPosting`;
    -   `journalBehavior`;
    -   `registerBehavior`;
    -   `accountChartBehavior`;
    -   `dynamicCharacteristic`;
    -   `calculationTypeGraph`.
-   [ ] Ensure these behavior contracts are exposed through the Entity Type Constructor as reusable capabilities/config sections rather than template-specific hardcode.
-   [ ] Extend capability dependency validation only where required; avoid new capability keys for behavior that can live in `config`.
-   [ ] Add shared normalization/validation helpers in `@universo-react/utils` if multiple packages need the same config checks.
-   [ ] Add reference validation for behavior configs:
    -   target registers;
    -   target modules;
    -   source tabular parts;
    -   field mappings;
    -   chart/register links;
    -   projection definitions.
-   [ ] Add unit tests for positive and negative config contracts in `@universo-react/types`.
-   [ ] Negative behavior contract tests must fail closed for:
    -   missing target register/module/source table/field mapping/chart/projection;
    -   version mismatch;
    -   unknown behavior kind;
    -   preview preset materialization attempts;
    -   generic validators branching on `1c-compatible` instead of validating reusable behavior contracts.

### Phase 2: Backend Template And Manifest Support

-   [ ] Create `packages/universo-react-metahubs-backend/src/domains/templates/data/1c-compatible.template.ts`.
-   [ ] Create preset manifest files only for runtime-ready presets that have implemented behavior, validation, UI, and tests.
-   [ ] Keep unsupported advanced presets as docs/roadmap descriptors unless preview/disabled metadata is implemented and enforced outside the runtime materialization path.
-   [ ] Register the template and implemented runtime-ready presets in `builtinTemplates` and `builtinEntityTypePresets`.
-   [ ] If preview/disabled presets are visible anywhere in product UI, validators/routes/schema sync must block runtime creation, publishing, and schema materialization for them.
-   [ ] Extend `TemplateManifestValidator` for the new typed config fields and preview/readiness metadata.
-   [ ] Extend template seed checks so `1c-compatible` validates without changing `basic`, `basic-demo`, `empty`, or `lms`.
-   [ ] Decide and implement Constant modeling:
    -   preferred first step: top-level Constant preset using a typed `singleValue` contract;
    -   reuse existing fixed value storage only if it can remain an invisible implementation detail;
    -   add `singleValue` capability and new runtime DDL when needed for isolated constants, periodic history, or runtime editing.
    -   include full design-time and published-runtime create/read/edit/copy/delete editor behavior before marking Constant runtime-ready.
-   [ ] Generalize Object-like system component seeding from hardcoded `kind === 'object'` to capability/config checks where needed.
-   [ ] Add backend tests:
    -   `templateManifestValidator.test.ts`;
    -   `builtinTemplateSeedMigration.test.ts`;
    -   `templatesStore.test.ts`;
    -   `templatesRoutes.test.ts`.
-   [ ] Add manifest/export/import tests proving built-in 1C-compatible profiles and user-created constructor profiles use the same reusable behavior contract path with no branch on `1c-compatible`.

### Phase 3: Runtime Schema DDL And Register Storage

-   [ ] Extend `@universo-react/schema-ddl` for any new physical structures:
    -   single-value constants;
    -   register movement direction/source-line uniqueness;
    -   posting batch and idempotency keys if existing system columns are insufficient;
    -   synchronous projection/totals tables for accumulation balances.
-   [ ] Keep DDL isolated behind schema-ddl or explicit package-local DDL boundaries.
-   [ ] Use schema-qualified generated SQL and deterministic table/column names.
-   [ ] Add DDL tests:
    -   `SchemaGenerator.test.ts`;
    -   snapshots;
    -   diffs;
    -   executable apply-to-real-Postgres tests;
    -   introspection checks for constraints, indexes, FKs, idempotency keys, uniqueness, and RLS-relevant columns;
    -   no regressions for Object/Ledger/LMS schemas.
        Intentional DDL snapshot changes must name the changed snapshot files and explain the runtime compatibility impact in the PR.

### Phase 4: Posting And Register Services

-   [ ] Implement a generic runtime posting service in the applications backend:
    -   post;
    -   unpost;
    -   repost;
    -   void if supported by `documentBehavior`;
    -   idempotent movement generation;
    -   rollback on any movement/projection failure.
-   [ ] Resolve declarative movement mappings from metadata and execute optional `onPosting` modules inside the same transaction.
-   [ ] Enforce register-line uniqueness by registrar, posting batch, source table, and source line.
-   [ ] Maintain accumulation projections synchronously at posting time for strict balances.
-   [ ] Use `RETURNING` for posting/unposting/reposting mutations where row confirmation matters and fail closed on zero-row updates/deletes.
-   [ ] Use Tier 1 request-scoped executors for runtime posting, unposting, reposting, register reads, and journal reads when RLS/auth applies.
-   [ ] Verify posting/register invariants:
    -   one movement batch per successful post/repost;
    -   repeated repost does not duplicate movements;
    -   projection totals equal the sum of register movements;
    -   unpost removes or reverses exactly the previous batch according to policy;
    -   failed posting leaves document state, movements, and projections unchanged;
    -   Document Journal posted state matches document detail/list state.
-   [ ] Add route/controller tests proving:
    -   direct API cannot forge hidden movement fields;
    -   unpost reverses or deletes movement batches according to policy;
    -   repost is idempotent;
    -   failed posting leaves no partial movements/projections;
    -   request-scoped executor paths are used where RLS/auth applies.
-   [ ] Add service/store-level integration tests against real Postgres/local Supabase for post/unpost/repost rollback and projection arithmetic; route mocks are not enough for this consistency boundary.

### Phase 5: Document Journal And Runtime Read Models

-   [ ] Start Document Journal from the existing `records.union` runtime datasource and extend its generic presentation metadata only where required.
-   [ ] Add metadata for journal presentation:
    -   source document types;
    -   common display columns;
    -   filters;
    -   sort;
    -   workspace scope.
-   [ ] Add a new `virtualCollection` capability only if `records.union` cannot support the required journal semantics after targeted extension.
-   [ ] Implement parameterized UNION read service using `DbExecutor.query()` and safe identifier quoting.
-   [ ] Add pagination, search, filter, and sort support without leaking physical table names; sort/filter fields must be resolved through metadata allowlists and safe `qColumn(...)` mappings.
-   [ ] Add tests for cross-document journals:
    -   mixed source documents;
    -   workspace isolation;
    -   stable sort;
    -   no raw IDs/JSON in API display payloads;
    -   rendered journal/register DataGrid cells exclude UUID-only labels, raw JSON fragments, `[object Object]`, internal table names, and internal field names.

### Phase 6: Frontend Template Picker And Constructor UX

-   [ ] Complete the UI primitive audit from Phase 0 and record which existing component each UI surface will reuse.
-   [ ] Upgrade `TemplateSelector` when needed to a searchable grouped picker/dialog while preserving the current small-list path.
-   [ ] Add template and preset category/readiness display with EN/RU i18n.
-   [ ] Ensure create-metahub flow sends the selected `templateId` correctly and default remains `basic`.
-   [ ] Add guided Entity Type Constructor panels:
    -   Constant;
    -   Catalog;
    -   Document and posting;
    -   Information Register;
    -   Accumulation Register;
    -   Document Journal;
    -   accounting/chart preview panels where applicable.
-   [ ] Harden `LedgerSchemaFields` and similar controls so selected chips show labels, not raw codenames.
-   [ ] Harden all constructor reference/select/chip surfaces for display labels and secondary context: ledgers/registers, modules, source tables, components, charts, characteristic types, projections, journal sources, and workspaces.
-   [ ] Update TanStack Query invalidation for:
    -   template list/detail;
    -   preset list/detail;
    -   entity type list/detail;
    -   runtime metadata publish/sync.
-   [ ] Add Vitest coverage for form mapping, validation, i18n labels, query keys, and mutation invalidation.

### Phase 7: Published Runtime UI

-   [ ] Reuse existing `apps-template-mui` runtime CRUD/DataGrid/FormDialog/row-action/dashboard primitives first.
-   [ ] Add generic runtime widgets/views in `apps-template-mui` only after the primitive audit proves existing primitives cannot express the view:
    -   register list/projection table;
    -   document journal table;
    -   posting action toolbar;
    -   constant editor if exposed at runtime.
-   [ ] Extend column/display helpers for registrar labels, movement directions, posting status, register projections, and journal source labels.
-   [ ] Ensure runtime mutation query keys include all scopes: application, workspace, collection/register/journal, filter, sort, search, and pagination.
-   [ ] Add Vitest coverage for display value guards and runtime UI adapters.
-   [ ] Keep all new runtime strings localized through package or shared i18n bundles.
-   [ ] Add assertions that register/journal screens render through generic runtime surfaces/row actions rather than one-off tables.
-   [ ] Add UI adapter/DataGrid column tests for journal rows and register rows, proving rendered text excludes raw IDs, JSON/object text, and internal table/field names.

### Phase 8: Accounting Layer

-   [ ] Implement Chart of Accounts as a hierarchical Object preset with:
    -   account code/name identity;
    -   predefined/user accounts;
    -   off-balance, quantity, currency, and active/passive flags;
    -   sub-conto settings linked to Chart of Characteristic Types.
-   [ ] Implement Chart of Characteristic Types with typed dynamic value definitions and optional value catalogs.
-   [ ] Implement Accounting Register on top of strengthened ledger semantics:
    -   debit/credit account fields;
    -   correspondence mode;
    -   sub-conto analytics resolved from account metadata;
    -   quantitative/currency resources;
    -   posting projection consistency.
-   [ ] Mark accounting presets runtime-ready only after `accountChartBehavior`, `dynamicCharacteristic`, accounting `registerBehavior` panels, validators, DDL, and runtime services are implemented; do not squeeze accounting into generic Ledger UI as a user-facing shortcut.
-   [ ] Add backend, DDL, constructor, runtime, and E2E tests before marking accounting presets runtime-ready.

### Phase 9: Calculation Layer

-   [ ] Implement Chart of Calculation Types with dependency graph validation:
    -   base calculation types;
    -   displacement relationships;
    -   leading calculation types.
-   [ ] Implement Calculation Register semantics:
    -   action period;
    -   base period;
    -   schedule binding;
    -   recalculation records;
    -   displacement and dependency evaluation.
-   [ ] Mark calculation presets runtime-ready only after `calculationTypeGraph`, calculation `registerBehavior` panels, validators, DDL, and runtime services are implemented; preview panels remain non-materializable until then.
-   [ ] Add interval algebra tests and browser flows before marking calculation presets runtime-ready.

### Phase 10: Fixture, Snapshot, And Import/Export Contracts

-   [ ] Create `tools/testing/e2e/support/oneCCompatibleFixtureContract.ts`.
-   [ ] Create `tools/testing/e2e/support/checkOneCCompatibleFixtureContract.ts`.
-   [ ] Add `tools/fixtures/metahubs-1c-compatible-app-snapshot.json` generated through Playwright, not hand edited.
-   [ ] Add a root `check:1c-compatible-fixture-contract` script mirroring `check:lms-fixture-contract`.
-   [ ] Assert:
    -   envelope kind/hash/version;
    -   required preset/entity codenames;
    -   no imported 1C config/code/table-layout payloads;
    -   Catalog identity defaults;
    -   Document numbering/date/posting metadata;
    -   valid register configs;
    -   preview presets are explicit and not accidentally runtime-ready;
    -   hidden/server-owned IDs are not exposed in normal UI metadata;
    -   reference fields have display-label metadata;
    -   semantic descriptions/comments/notes are multiline;
    -   resource, media, block-content, module-source, and movement-source fields cannot fall back to raw JSON/object renderers;
    -   preview presets are non-materializable.
-   [ ] Add CI guard similar to the LMS fixture contract once stable.

### Phase 11: Playwright And Browser Evidence

-   [ ] Use local minimal Supabase for E2E:

```bash
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
pnpm run build:e2e:local-supabase
```

-   [ ] Add `tools/testing/e2e/specs/flows/metahub-1c-compatible-template.spec.ts`.
-   [ ] Cover:
    -   create metahub with `1C-Compatible`;
    -   template picker visible at desktop/tablet/mobile;
    -   preset picker grouped and searchable;
    -   create Catalog, Document, Information Register, Accumulation Register without editing JSON;
    -   publish/sync minimal runtime;
    -   create, edit, copy, and delete catalog rows or explicitly document unsupported lifecycle paths;
    -   create, edit, copy, and delete top-level Constant values in design-time and runtime before Constant is marked runtime-ready;
    -   create, edit, copy, delete/void, post, unpost, and repost documents or explicitly document unsupported lifecycle paths;
    -   verify register movement/projection;
    -   verify Document Journal.
-   [ ] Verify posting state through both backend/API state and visible UI after post, unpost, repost, and failure rollback.
-   [ ] Capture screenshots at:
    -   `1920x1080`;
    -   `768x1024`;
    -   `390x844`.
-   [ ] Assert:
    -   no page horizontal overflow;
    -   no visible UUID-only labels;
    -   no `[object Object]`;
    -   no raw JSON fragments in normal tables/cards;
    -   no untranslated validation/internal keys;
    -   no raw Zod/internal validation messages;
    -   keyboard path works for picker, constructor, save, runtime row actions, and posting.
-   [ ] Use existing runtime UX helpers:
    -   `expectRuntimeUxViewportMatrix`;
    -   `expectNoTechnicalLeakage`;
    -   `expectNoDataGridTechnicalLeakage`;
    -   `expectSemanticFieldControls`;
    -   `expectLocalizedValidation`;
    -   `expectDataGridHorizontalScrollConstrained`.
-   [ ] Add negative/canary tests or fixtures proving raw UUIDs, raw JSON/object cells, single-line semantic long text, untranslated validation, and one-off runtime table regressions fail.
-   [ ] Add fixtures/canaries for media, resource source, block content, module-source payloads, and movement-source payloads rendered in DataGrid/cards/dialogs.
-   [ ] Put the canaries in `tools/testing/e2e/specs/flows/metahub-1c-compatible-template.spec.ts` under `@1c-compatible` and optionally `@runtime-ux-canary`; Phase 13 must run both tags.
-   [ ] Tag every focused Playwright test in this suite with `@1c-compatible` so the planned grep command runs the intended coverage.
-   [ ] Include EN and RU validation flows.
-   [ ] Include RU screenshots for every critical picker, constructor, posting, journal, register, and Constant runtime flow.
-   [ ] Use role, label, visible text, and stable test-id locators where needed; avoid CSS-only locators for user workflows.
-   [ ] Pair API assertions with visible browser evidence for the same state.
-   [ ] Assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth` at each viewport, allowing horizontal scroll only inside constrained DataGrid regions.
-   [ ] Use `tools/testing/e2e/run-playwright-suite.mjs`; do not use `pnpm dev`.
-   [ ] Before running Playwright wrappers in a non-interactive shell, verify Node 22:

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use --silent 22; node -v
```

-   [ ] Local Supabase is required for the consistency gate because posting/register/projection behavior must be verified against an isolated real Postgres runtime. Hosted Supabase smoke may still be used for broader environment coverage.
-   [ ] For local Supabase focused runs, use the env wrapper:

```bash
pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --grep "@1c-compatible|@runtime-ux-canary"
```

### Phase 12: Documentation

-   [ ] Add GitBook pages under `docs/en/**` and `docs/ru/**`:
    -   template overview;
    -   preset catalog;
    -   clean-room and non-affiliation note;
    -   creating a `1C-Compatible` metahub;
    -   Catalog/Document/Register workflows;
    -   posting model;
    -   accounting/calculation preview status if not runtime-ready.
-   [ ] Add screenshot generators and assets under `docs/{en,ru}/.gitbook/assets/...` where documentation policy requires screenshots.
-   [ ] Add and run a docs screenshot generator, for example:

```bash
pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --project generators --grep "@docs-1c-compatible"
```

-   [ ] Keep EN/RU docs structurally aligned.
-   [ ] Add a docs clean-room/non-affiliation check for `docs/en/**` and `docs/ru/**` that rejects unsupported claims of certification, partnership, official logo/asset usage, copied 1C configuration payloads, and copied 1C database/table-layout payloads.
-   [ ] Run:

```bash
pnpm docs:i18n:check
pnpm docs:gitbook-screenshot-assets:check
node tools/docs/check-gitbook-links.mjs
```

### Phase 13: Verification Matrix And CI

-   [ ] Type/package tests:

```bash
pnpm --filter @universo-react/types test
pnpm --filter @universo-react/utils test
```

-   [ ] Backend/template tests:

```bash
pnpm --filter @universo-react/metahubs-backend test -- --runTestsByPath src/tests/services/templateManifestValidator.test.ts
pnpm --filter @universo-react/metahubs-backend test
pnpm --filter @universo-react/applications-backend test
pnpm doctor:e2e:local-supabase
pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase pnpm --filter @universo-react/applications-backend test -- --runInBand --testPathPattern "real-db|posting|register|projection"
```

-   [ ] Schema/migration tests:

```bash
pnpm --filter @universo-react/schema-ddl test
pnpm --filter @universo-react/migrations-platform test
pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase pnpm --filter @universo-react/schema-ddl test -- --runInBand --testPathPattern "real-postgres|introspection"
```

-   [ ] Frontend/runtime tests:

```bash
pnpm test:vitest
pnpm --filter @universo-react/metahubs-frontend lint
pnpm --filter @universo-react/apps-template-mui lint
pnpm run check:apps-template-isolation
```

-   [ ] E2E:

```bash
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
pnpm run build:e2e:local-supabase
pnpm exec cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase node tools/testing/e2e/run-playwright-suite.mjs --grep "@1c-compatible|@runtime-ux-canary"
pnpm test:e2e:visual
```

-   [ ] Fixture contract:

```bash
pnpm run check:1c-compatible-fixture-contract
```

-   [ ] Docs:

```bash
pnpm docs:i18n:check
pnpm docs:gitbook-screenshot-assets:check
node tools/docs/check-gitbook-links.mjs
node tools/docs/check-1c-compatible-clean-room.mjs
```

-   [ ] Final workspace validation:

```bash
pnpm build
```

Add low-cost CI guards for type/template/schema tests and the fixture contract. For runtime-ready presets, the local-Supabase Playwright `@1c-compatible|@runtime-ux-canary` flow and real-DB backend integration gate are required before merge/release. Manual-only verification is allowed only for preview accounting/calculation surfaces that remain non-materializable.

## Potential Challenges

-   Full 12-preset parity is broad. Accounting and calculation presets should not be marked runtime-ready until engines and tests exist.
-   Constant storage may require new runtime DDL. Keep it isolated and tested; do not overload Set-only storage if it creates confusing UX.
-   Posting is a transactional consistency boundary. A workflow button without idempotent movement/projection logic is insufficient.
-   Document Journal UNION reads can become expensive. Start with safe virtual reads, then add persisted views/projections only with measured need.
-   New capabilities may force validator/types/schema-ddl/UI updates. Prefer typed configs first.
-   Template seeding may create DB versions by checksum even without manifest version bumps. Tests should document and verify the expected behavior.
-   `kindKey` is currently a route/menu/query scope. Do not expose it as the primary user label.
-   `1C-Compatible` wording requires discipline. Avoid certification/partnership/logo claims unless separately granted.

## Open Questions For Approval

-   Should preview presets be visible in the first `1C-Compatible` template UI, or hidden until their runtime implementation is complete?
-   Should accumulation projections be strictly synchronous from the start, accepting posting-time cost, or should the first version allow an eventually consistent projection mode for reports?
