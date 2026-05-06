# LMS Page Type, Workspace Policy, and Enterprise LMS Roadmap

Date: 2026-05-03
Status: Implemented
Mode: PLAN
Complexity: Level 4

Implementation note: the roadmap was implemented on 2026-05-03. The resulting code adds the standard `page` metadata type, publication-version workspace policies, connector-owned workspace schema decisions, Page runtime rendering, refreshed LMS fixture generation, and EN/RU documentation updates.

## Objective

Evolve the current entity-first LMS template into a working enterprise LMS configuration comparable in structure to iSpring Learn, while preserving the platform architecture:

- Metahub defines the base metadata model, runtime layout, scripts, and publication-version policy.
- Application administration configures connector-level runtime schema installation and common settings.
- Published application workspaces hold final workspace-specific settings and data.
- LMS behavior is delivered through generic entity types, runtime views, scripts, and template configuration, not through hardcoded LMS-only widgets.

The final implementation should produce a new Playwright-generated product snapshot:

`tools/fixtures/metahubs-lms-app-snapshot.json`

The snapshot must create a metahub that can be imported, published, connected to an application, installed as an application schema, and used as a real LMS-like runtime.

## Current Baseline

The latest codebase already contains several important cleanups:

- Legacy LMS-specific widgets were removed from the LMS template and fixture contract.
- The current LMS runtime uses generic widgets such as `menuWidget`, `detailsTitle`, `detailsTable`, `columnsContainer`, and shared runtime entity views.
- `menuWidget` supports curated menu behavior: `maxPrimaryItems`, overflow label, `startPage`, and workspace placement.
- Standard entity type presets currently cover `hub`, `catalog`, `set`, and `enumeration`.
- Metahub template create options are now represented by generic `presetToggles`, not the older fixed `createHub/createCatalog/createSet/createEnumeration` flags.
- Application creation still exposes `workspacesEnabled`, which is no longer the right architectural layer for this decision.
- Publication versions do not yet carry an explicit runtime workspace policy in the snapshot.
- `packages/apps-template-mui` mostly follows the original MUI dashboard shell, but newer runtime pages and cards need stricter parity with `.backup/templates/dashboard`.
- The current LMS product fixture is still too module-centric and does not yet model pages, knowledge base content, development plans, supervisor views, reports, or realistic learning workflows deeply enough.
- `packages/apps-template-mui` already has reusable primitives from `@universo/template-mui`: `ItemCard`, `FlowListTable`, `ToolbarControls`, and `ViewHeaderMUI`. New runtime wrappers should be introduced only when these existing pieces cannot be composed cleanly.
- `quizWidget` still exists for the separate quiz product path. The LMS product snapshot should not use it unless it is first refactored into a generic script-backed runtime widget contract.

## QA Clarifications Applied

The initial draft treated Page too much like a physical runtime table. The corrected architecture is:

- Page is a metadata object type first.
- A Page object stores its own block content in `_mhb_objects.config.blockContent`.
- Page does not enable `records` or `physicalTable` by default.
- Catalogs remain the record-heavy type. If a future Catalog needs page-like content, it should reuse the generic `blockContent` capability on attributes or runtime behavior instead of making Page a physical table by default.

A second QA pass found an important runtime DDL contract issue. The current schema DDL layer skips physical table creation only for `hub`, `set`, and `enumeration`. A new `page` kind with `physicalTable: false` would otherwise fall through to the default table naming path and create an unwanted `obj_*` runtime table. The implementation must add one explicit runtime physical-table contract and use it everywhere.

Required contract:

- Add a derived `physicalTableEnabled` flag, or an equivalent clearly named field, to the executable runtime entity definition produced from publication snapshots.
- Resolve the flag from the entity type's `components.physicalTable` and from standard-kind defaults.
- Default `hub`, `set`, `enumeration`, and `page` to `false`.
- Default `catalog` and custom record-bearing kinds to `true` unless their type definition explicitly disables `physicalTable`.
- Replace hardcoded checks such as `isNonPhysicalStandardEntity(entity)` in runtime DDL/diff/snapshot code with one helper such as `hasPhysicalRuntimeTable(entity)`.
- Keep nonphysical objects in runtime metadata tables such as `_app_objects`, but store `table_name = NULL` for them and never create their main table, tabular child tables, workspace columns, seed-record rows, or physical foreign keys.
- Extend runtime kind normalization and export/import loading so `page` and future safe custom metadata kinds survive metahub snapshot, schema sync, `_app_objects`, release bundle, and app export round trips.

The initial draft also left connector schema-option storage open. The corrected target is:

- Store schema installation options on `applications.rel_connector_publications.schema_options`.
- Keep `applications.cat_applications.workspaces_enabled` as installed runtime state only.
- Resolve effective workspace mode before sync diff/DDL, but persist `workspaces_enabled` only with a successful schema sync.

The implementation must reuse existing UI/data-fetching patterns:

- frontend data loading through TanStack Query v5 keys and invalidation helpers,
- dialogs through existing shared dialog/list patterns,
- runtime cards/tables through `ItemCard`, `FlowListTable`, `ToolbarControls`, `ViewHeaderMUI`, and existing dashboard shell components,
- MUI v7 `Grid` with `size={{ xs, sm, md, lg }}` where Grid is needed.

## Reference Product Findings

iSpring Learn documentation shows these high-value patterns to model generically:

- Separate user portal and admin portal concepts.
- Configurable user portal menu with a small primary menu and overflow behavior.
- Learning content organized into courses, lessons, assignments, learning tracks, trainings, and content items.
- Knowledge base with spaces, folders, articles/pages, bookmarks, recent content, and permissions.
- User management with departments, groups, roles, supervisors, learners, and access rules.
- Enrollment/progress tracking with not started, in progress, completed, failed, overdue, and certificate states.
- Reports and dashboards as summary metrics plus filterable tables.
- Development plans and supervisor dashboards for team-level learning oversight.

These concepts should be expressed as metahub metadata, scripts, runtime view configuration, and workspace settings. They should not become package-level LMS-specific UI branches unless the abstraction is reusable.

## Core Architecture Decisions

### 1. Add a Standard `page` Metadata Type

Add `page` as a first-class standard entity type preset, alongside `hub`, `catalog`, `set`, and `enumeration`.

Purpose:

- Represent structured content pages, knowledge articles, landing pages, policy pages, and course content pages.
- Store ordered content blocks, including Editor.js-compatible blocks.
- Stay simpler than Catalogs: Pages focus on one metadata object with block content and light metadata, while Catalogs remain better for record-heavy, relational, and operational entities.
- Avoid creating runtime tables for Page objects by default.

Recommended model:

```ts
export const PAGE_ENTITY_TYPE_KEY = 'page' as const

export const PAGE_DEFAULT_BLOCK_PROFILE = {
  defaultFormat: 'editorjs',
  supportedFormats: ['editorjs'],
  maxBlocks: 500,
  allowedBlockTypes: [
    'paragraph',
    'header',
    'list',
    'quote',
    'table',
    'image',
    'embed',
    'delimiter'
  ]
} as const
```

Add a generic entity component for block content:

```ts
export const ENTITY_COMPONENT_KEYS = {
  // existing keys...
  blockContent: 'blockContent'
} as const

export interface BlockContentComponentConfig {
  enabled: boolean
  storage: 'objectConfig' | 'recordJsonb'
  defaultFormat: 'editorjs'
  supportedFormats: readonly string[]
  allowedBlockTypes: readonly string[]
  maxBlocks: number
}
```

Recommended Page component manifest:

```ts
export const PAGE_TYPE_COMPONENTS: ComponentManifest = {
  dataSchema: false,
  records: false,
  treeAssignment: { enabled: true, isSingleHub: false, isRequiredHub: false },
  optionValues: false,
  fixedValues: false,
  hierarchy: false,
  nestedCollections: false,
  relations: false,
  actions: { enabled: true },
  events: { enabled: true },
  scripting: { enabled: true },
  blockContent: {
    enabled: true,
    storage: 'objectConfig',
    defaultFormat: 'editorjs',
    supportedFormats: ['editorjs'],
    allowedBlockTypes: ['paragraph', 'header', 'list', 'quote', 'table', 'image', 'embed', 'delimiter'],
    maxBlocks: 500
  },
  layoutConfig: { enabled: true },
  runtimeBehavior: { enabled: true },
  physicalTable: false
}
```

`blockContent.storage = 'objectConfig'` means the block payload belongs to the Page object stored in `_mhb_objects.config.blockContent`, not to a generated runtime table.

If adding a component key is too invasive during implementation, use a transitional `runtimeBehavior.blockContent` config, but the target state should be a reusable `blockContent` component.

### 2. Use Editor.js as a Storage Format, Not a Platform Dependency

Editor.js output should be accepted as one supported block format, not hardcoded as the only possible content model.

The persisted shape should be validated server-side:

```ts
import { z } from 'zod'

export const editorJsOutputSchema = z.object({
  time: z.number().int().nonnegative().optional(),
  version: z.string().max(32).optional(),
  blocks: z.array(
    z.object({
      id: z.string().min(1).max(64).optional(),
      type: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
      data: z.record(z.unknown())
    }).strict()
  ).max(500)
}).strict()
```

Security requirements:

- Reject unknown block types unless the page block profile explicitly allows them.
- Validate and sanitize block data on the backend.
- Render blocks read-only in runtime with escaped text and safe media handling.
- Do not store raw HTML from Editor.js blocks unless a sanitizer and allowlist are in place.
- Use Editor.js as an authoring component only where editing is needed. Runtime rendering should use platform read-only React components, not a live Editor.js instance.
- If Editor.js is mounted in an authoring tab, initialize it lazily, configure explicit tools, use `readOnly` where applicable, call `save()` for JSON output, and call `destroy()` on unmount.

### 3. Add Publication-Version Workspace Policy

The workspace decision belongs to the publication version snapshot because it is a runtime contract of the metahub version.

Use short policy names:

```ts
export const WORKSPACE_MODE_POLICIES = ['optional', 'required', 'disabled'] as const
export type WorkspaceModePolicy = (typeof WORKSPACE_MODE_POLICIES)[number]

export interface MetahubRuntimePolicySnapshot {
  workspaceMode: WorkspaceModePolicy
}
```

User-facing labels:

- Optional: application schema can be installed with or without workspaces.
- Required: application schema must use workspaces.
- Disabled: application schema must not use workspaces for this version.

Snapshot shape:

```json
{
  "runtimePolicy": {
    "workspaceMode": "optional"
  }
}
```

Do not increase the metahub template version or snapshot format version for this change unless implementation discovers a hard technical blocker. The test database will be rebuilt, so baseline definitions can be refactored without compatibility migrations.

### 4. Make `required` Workspace Mode Irreversible

Publication-version rules:

- Missing policy in old snapshots is treated as `optional`.
- `disabled` can later move to `optional` or `required`.
- `optional` can later move to `required`.
- Once a publication has a version with `workspaceMode: 'required'`, later versions in that publication cannot change it to `optional` or `disabled`.
- The first selection of `required` must show an explicit irreversible-action warning.

Application/schema rules:

- Application creation should no longer ask whether workspaces are enabled.
- Connector/schema creation or schema sync should apply the metahub version policy.
- If an application schema was already installed with workspaces enabled, later syncs cannot disable workspaces.
- If an application schema was installed without workspaces, a later sync may enable workspaces when the new publication version or connector choice allows it. This action must warn that it cannot be undone.

Centralize the rule in a shared helper:

```ts
export interface ResolveWorkspaceModeInput {
  policy: WorkspaceModePolicy
  requested: boolean | null
  applicationAlreadyEnabled: boolean
  schemaAlreadyInstalled: boolean
  acknowledgementReceived: boolean
}

export function resolveWorkspaceModeDecision(input: ResolveWorkspaceModeInput): boolean {
  if (input.applicationAlreadyEnabled) {
    if (input.requested === false || input.policy === 'disabled') {
      throw new Error('Workspace mode cannot be disabled after it has been enabled.')
    }
    return true
  }

  if (input.policy === 'required') {
    if (input.schemaAlreadyInstalled && !input.acknowledgementReceived) {
      throw new Error('Enabling workspace mode for an installed schema requires acknowledgement.')
    }
    return true
  }

  if (input.policy === 'disabled') {
    if (input.requested === true) {
      throw new Error('This publication version does not allow workspaces.')
    }
    return false
  }

  if (input.requested === true && input.schemaAlreadyInstalled && !input.acknowledgementReceived) {
    throw new Error('Enabling workspace mode for an installed schema requires acknowledgement.')
  }

  return input.requested === true
}
```

The production implementation should use typed domain errors instead of generic `Error`.

### 5. Move Workspace Choice to Connector Schema Installation

Target flow:

1. User creates an application shell. No workspace checkbox is shown.
2. User creates or opens a connector.
3. User links a metahub publication/version to the connector.
4. The schema creation dialog reads `snapshot.runtimePolicy.workspaceMode`.
5. The dialog either:
   - offers a workspace toggle when policy is `optional`,
   - locks workspaces on when policy is `required`,
   - locks workspaces off when policy is `disabled`.
6. Sync stores the resolved workspace state on the application runtime schema state.

Recommended storage model:

- Keep `applications.cat_applications.workspaces_enabled` as the installed runtime state.
- Treat it as unresolved before the first successful schema sync.
- Store connector schema options on the connector-publication binding because the choice is tied to the selected publication source:

`applications.rel_connector_publications.schema_options JSONB NOT NULL DEFAULT '{}'::jsonb`

```ts
export interface ConnectorSchemaOptions {
  workspaceModeRequested: 'enabled' | 'disabled' | null
  acknowledgedIrreversibleWorkspaceEnablementAt?: string
}
```

Update the applications baseline migration and `systemAppDefinition.ts` directly. Do not add compatibility migration/version churn for this clean database rebuild.

### 6. Define Settings Precedence Explicitly

Runtime settings must resolve in one direction:

1. Metahub snapshot defaults.
2. Publication-version runtime policy.
3. Connector-publication schema options.
4. Application administration settings.
5. Workspace settings inside the published application.

Workspace settings may override runtime labels, visibility, limits, and defaults inside that workspace. They must not override the structural workspace mode once the application schema has been installed.

### 7. Preserve MUI Template Parity

Runtime application screens should continue to look like the original MUI dashboard template in `.backup/templates/dashboard`:

- Keep the original shell proportions, spacing, white cards, and grid rhythm.
- Use the shared MUI dashboard components or extract common runtime wrappers from them.
- Avoid nested cards and decorative page sections.
- Ensure long text cannot overflow cards, buttons, table cells, or side panels.
- Use screenshots from Playwright as the source of truth, not assumptions.

Reuse first:

- `Dashboard`
- `MainGrid`
- `ItemCard`
- `FlowListTable`
- `ToolbarControls`
- `ViewHeaderMUI`
- existing side menu and navbar widgets

Candidate reusable primitives in `packages/apps-template-mui` only if the existing pieces cannot be composed cleanly:

- `RuntimeSectionShell`
- `RuntimeCardGrid`
- `RuntimeEntityCard`
- `RuntimeDataToolbar`
- `RuntimePageRenderer`

These should be generic and reusable for LMS, knowledge base, reports, and non-LMS applications.

## Implementation Phases

### Phase 0. Inventory and UI Baseline

Files to inspect before coding:

- `packages/metahubs-backend/base/src/domains/templates/data/basic.template.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/basic-demo.template.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/lms.template.ts`
- `packages/metahubs-backend/base/src/domains/templates/data/standardEntityTypeDefinitions.ts`
- `packages/metahubs-backend/base/src/domains/publications/publicationsController.ts`
- `packages/metahubs-frontend/base/src/features/publications/PublicationVersionList.tsx`
- `packages/applications-backend/base/src/domains/applications/applicationsController.ts`
- `packages/applications-backend/base/src/domains/applications/syncController.ts`
- `packages/applications-frontend/base/src/features/applications/ApplicationList.tsx`
- `packages/apps-template-mui/src/dashboard/Dashboard.tsx`
- `packages/apps-template-mui/src/dashboard/runtime/RuntimeWorkspacesPage.tsx`
- `tools/testing/e2e/support/lmsFixtureContract.ts`
- `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`

Baseline tasks:

- Capture current application UI screenshots through the Playwright CLI flow on port `3100`.
- Compare current runtime cards and workspace page layout with `.backup/templates/dashboard`.
- Identify every UI path that still exposes application-level `workspacesEnabled`.
- Identify current connector schema settings storage and sync lifecycle.

### Phase 1. Shared Types and Policy Helpers

Packages:

- `packages/universo-types`
- `packages/universo-utils`
- backend packages that validate payloads
- frontend packages that render policy controls

Tasks:

1. Add shared `WorkspaceModePolicy` types.
2. Add runtime policy snapshot type.
3. Add a single resolver for publication/application workspace decisions.
4. Add typed domain errors for:
   - policy downgrade after required mode,
   - enabling workspaces without acknowledgement,
   - requesting workspaces when policy is disabled,
   - disabling workspaces after application schema has workspaces enabled.
5. Add unit tests for all policy transitions.

Acceptance checks:

- Policy logic is tested independently from controllers.
- Frontend and backend use the same literal values: `optional`, `required`, `disabled`.
- Missing policy resolves as `optional` for imported old snapshots.

### Phase 2. Page Metadata Type and Block Content Component

Packages:

- `packages/universo-types`
- `packages/metahubs-backend`
- `packages/metahubs-frontend`
- `packages/schema-ddl`
- `packages/applications-backend`
- `packages/apps-template-mui`
- `packages/universo-i18n`

Tasks:

1. Add `blockContent` as a generic component capability.
2. Add a standard `page` entity type definition.
3. Add the `page` preset to `builtinEntityTypePresets`.
4. Add the executable runtime physical-table contract for entity definitions.
5. Update schema DDL generation, migration diffing, schema snapshot generation, metadata sync, workspace column handling, seed flows, and FK generation to call one `hasPhysicalRuntimeTable(entity)` helper.
6. Extend runtime entity-kind normalization/loading to preserve `page` and future safe custom metadata kinds instead of dropping them during app sync/export.
7. Include `page` by default in:
   - Basic template,
   - Basic Demo template,
   - LMS template,
   - LMS Playwright product generator.
8. Add frontend resource labels and i18n keys for Pages in English and Russian.
9. Extend the existing entity instance tab system with a supported `content` tab for entity types that enable `blockContent`.
10. Add backend validation for Editor.js-compatible block output.
11. Add runtime read-only rendering for Page blocks in `apps-template-mui`.
12. Update `TemplateManifestValidator`, `ComponentManifest`, `COMPONENT_DEPENDENCIES`, builder defaults, and all standard component manifests so `blockContent` is explicit everywhere.
13. Update `EntityInstanceListContent` and the existing `EntityFormDialog` tab flow instead of introducing a separate Page-only editor shell.

Page object config shape:

```ts
export interface PageObjectConfig {
  blockContent: {
    format: 'editorjs'
    data: EditorJsOutputData
  }
  runtime?: {
    routeSegment?: string
    menuVisibility?: 'visible' | 'hidden'
  }
}
```

SQL safety requirement for block storage on metadata objects:

```ts
const objectsTable = qSchemaTable(branchSchemaName, '_mhb_objects')
const rows = await executor.query<{ id: string }>(
  `
    UPDATE ${objectsTable}
    SET config = jsonb_set(
          COALESCE(config, '{}'::jsonb),
          '{blockContent}',
          $2::jsonb,
          true
        ),
        _upl_updated_at = NOW(),
        _upl_updated_by = $3
    WHERE id = $1
      AND kind = 'page'
      AND _upl_deleted = false
      AND _mhb_deleted = false
    RETURNING id
  `,
  [pageId, JSON.stringify(validatedBlockContent), userId]
)

if (rows.length === 0) {
  throw new NotFoundError('Page was not found.')
}
```

Acceptance checks:

- A new metahub created from Basic includes Page by default.
- A new metahub created from Basic Demo includes Page examples.
- The LMS template includes Pages and sample page content.
- Page content validation rejects oversized or unknown block payloads.
- Runtime Page rendering escapes unsafe text and does not execute arbitrary HTML.
- Page objects are included in snapshots through `_mhb_objects.config`, not through a generated `pag_*` table by default.
- Schema generation for Page creates `_app_objects` metadata only and does not create an `obj_*`, `pag_*`, tabular child, workspace, seed-record, or FK table path.
- Page metadata survives app schema sync, release bundle generation, export, and reimport.

### Phase 3. Publication Version Runtime Policy

Packages:

- `packages/metahubs-backend`
- `packages/metahubs-frontend`
- `packages/universo-types`
- `packages/universo-i18n`

Tasks:

1. Extend publication version create payload with `runtimePolicy.workspaceMode`.
2. Add `runtimePolicy.requiredWorkspaceModeAcknowledged` or an equivalent acknowledgement flag when `workspaceMode` is `required`.
3. Add a policy selector to the create-version dialog.
4. Show an irreversible warning when `required` is selected for the first time.
5. Persist the policy into `snapshot_json.runtimePolicy`.
6. Include the policy in snapshot hash calculation.
7. Validate downgrade rules against earlier publication versions.
8. Preserve policy through import/export.

Controller behavior:

```ts
const requestedPolicy = parseWorkspaceModePolicy(req.body.runtimePolicy?.workspaceMode)
const previousPolicyState = await publicationStore.getWorkspacePolicyState(executor, publicationId)

assertPublicationWorkspacePolicyTransition({
  previousRequired: previousPolicyState.hasRequiredVersion,
  requested: requestedPolicy,
  acknowledgementReceived: parsed.data.runtimePolicy?.requiredWorkspaceModeAcknowledged === true
})

const snapshot = await snapshotSerializer.serializeMetahub({
  metahubId,
  branchId,
  runtimePolicy: {
    workspaceMode: requestedPolicy
  }
})
```

Acceptance checks:

- New publication version snapshots contain `runtimePolicy.workspaceMode`.
- Required mode cannot be downgraded in later versions.
- Optional and disabled versions can later move to required.
- The UI clearly shows why required mode is locked after it has been used.

### Phase 4. Connector-Level Schema Workspace Decision

Packages:

- `packages/applications-backend`
- `packages/applications-frontend`
- `packages/metahubs-backend` where linked-app creation currently passes workspace flags
- `packages/universo-i18n`

Tasks:

1. Remove workspace mode controls from generic application creation.
2. Remove workspace mode controls from publication-linked application creation.
3. Add `schema_options` to `applications.rel_connector_publications` and the application system app definition.
4. When a publication version is selected, load `snapshot.runtimePolicy.workspaceMode`.
5. Render schema-install controls based on policy:
   - `optional`: selectable on/off,
   - `required`: locked on,
   - `disabled`: locked off.
6. Require acknowledgement when enabling workspaces for an already installed non-workspace schema.
7. Resolve effective workspace mode before diff, schema snapshot generation, DDL, and runtime sync.
8. Pass an in-memory `applicationForSync` with the effective `workspacesEnabled` value into `syncApplicationSchemaFromSource`.
9. Extend `persistApplicationSchemaSyncState` or the equivalent successful-sync persistence path with `workspacesEnabled`.
10. Persist `workspaces_enabled` only as part of successful sync-state persistence, not before the sync starts.
11. Backfill existing runtime rows into a default workspace when a previously non-workspace schema is upgraded.
12. Fail closed when the requested connector option conflicts with publication policy or existing application state.

Sync decision example:

```ts
const effectiveWorkspacesEnabled = resolveWorkspaceModeDecision({
  policy: publicationSnapshot.runtimePolicy?.workspaceMode ?? 'optional',
  requested: connectorSchemaOptions.workspaceModeRequested === null
    ? null
    : connectorSchemaOptions.workspaceModeRequested === 'enabled',
  applicationAlreadyEnabled: application.workspacesEnabled,
  schemaAlreadyInstalled: Boolean(application.schemaName),
  acknowledgementReceived: Boolean(connectorSchemaOptions.acknowledgedIrreversibleWorkspaceEnablementAt)
})

const applicationForSync = {
  ...application,
  workspacesEnabled: effectiveWorkspacesEnabled
}

const result = await syncApplicationSchemaFromSource({
  application: applicationForSync,
  exec,
  userId,
  confirmDestructive,
  connectorId: connector.id,
  source,
  layoutResolutionPolicy: parsed.data.layoutResolutionPolicy
})
```

Mutation safety example:

```ts
const updated = await trx.query<{ id: string }>(
  `
    UPDATE ${qSchemaTable(systemSchema, 'cat_applications')}
    SET workspaces_enabled = TRUE,
        _upl_updated_at = NOW(),
        _upl_updated_by = $2,
        _upl_version = COALESCE(_upl_version, 1) + 1
    WHERE id = $1
      AND workspaces_enabled = FALSE
      AND _upl_deleted = false
      AND _app_deleted = false
    RETURNING id
  `,
  [applicationId, actorUserId]
)

if (updated.length !== 1) {
  throw new ConflictError('Workspace mode was not enabled.')
}
```

Upgrade backfill requirement:

```ts
await ensureApplicationRuntimeWorkspaceSchema(trxExecutor, {
  schemaName,
  applicationId,
  entities,
  actorUserId,
  ensurePublicSharedWorkspace: application.isPublic,
  seedPublicSharedWorkspace: true
})

await backfillWorkspaceIdForExistingRuntimeRows(trxExecutor, {
  schemaName,
  targetWorkspaceId: defaultWorkspaceId,
  entityTables: workspaceScopedTables,
  actorUserId
})
```

Acceptance checks:

- Application creation no longer asks for workspaces.
- Connector/schema installation applies publication policy.
- Optional policy lets the user choose at schema installation.
- Required policy locks workspaces on.
- Disabled policy locks workspaces off.
- Installed workspace-enabled applications cannot be downgraded.

### Phase 5. Runtime MUI Template Parity

Packages:

- `packages/apps-template-mui`
- possibly `packages/universo-template-mui`

Tasks:

1. Compare current runtime pages with `.backup/templates/dashboard`.
2. Reuse `Dashboard`, `MainGrid`, `ItemCard`, `FlowListTable`, `ToolbarControls`, and `ViewHeaderMUI` before extracting any new runtime layout primitive.
3. Rework workspace cards and entity cards to match original dashboard card rhythm.
4. Ensure cards remain white, compact, and grid-aligned.
5. Fix overflow in cards, toolbar controls, tables, and navigation items.
6. Keep demo-only chart cards disabled unless explicitly configured by the metahub snapshot.
7. Add Playwright screenshot checks for desktop and mobile.

Grid target:

```tsx
<Grid container spacing={2} columns={12}>
  {items.map((item) => (
    <Grid key={item.id} size={{ xs: 12, sm: 6, lg: 4 }}>
      <RuntimeEntityCard item={item} />
    </Grid>
  ))}
</Grid>
```

Card text safety:

```tsx
<Typography
  variant="subtitle1"
  sx={{
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  }}
>
  {title}
</Typography>
```

Acceptance checks:

- Runtime workspace page visually matches the MUI dashboard style.
- No new UI elements overflow their cards at mobile or desktop widths.
- Screenshots are reviewed before accepting the phase.

### Phase 6. Generic Runtime Views for LMS-Like Features

Packages:

- `packages/apps-template-mui`
- `packages/metahubs-backend`
- `packages/metahubs-frontend`
- `packages/universo-types`

Tasks:

1. Extend generic table/card widgets instead of adding LMS-specific widgets.
2. Extend existing `detailsTable` and runtime entity view config before adding any new widget key.
3. Add runtime view config for:
   - card list,
   - table list,
   - detail page,
   - page content renderer,
   - summary metric strip,
   - filtered saved view.
4. Allow scripts to provide derived fields such as progress, due state, certificate status, and recommended next action.
5. Support workspace overrides for runtime labels, filters, default views, and visibility where the policy enables workspaces.
6. Treat the existing `quizWidget` as out of scope for the LMS fixture unless it is generalized into a script-backed runtime widget that is not quiz-specific.

Example generic view config:

```ts
export interface RuntimeCollectionViewConfig {
  mode: 'table' | 'cards'
  titleField: string
  subtitleField?: string
  badgeField?: string
  progressField?: string
  defaultSort?: Array<{ field: string; direction: 'asc' | 'desc' }>
  filters?: RuntimeFilterConfig[]
}
```

Acceptance checks:

- LMS course cards, knowledge pages, reports, and enrollment lists use generic runtime views.
- No package-level `if (template === 'lms')` branches are introduced.
- The same generic view config can render non-LMS entities.

### Phase 7. Enterprise LMS Product Model

Update the LMS template and product generator to model a real learning platform.

Recommended metadata structure:

Hubs:

- Learning Portal
- Administration
- Knowledge Base
- Development

Pages:

- Learner Home
- Course Overview
- Knowledge Article
- News Article
- Training Policy
- Help / FAQ

Use Page objects for designed, configuration-level pages and seeded sample pages. Use Catalogs with a JSON/block-content attribute for high-volume runtime-authored articles if the application needs many learner-created or administrator-created content records.

Catalogs:

- LearnerProfiles
- Departments
- Groups
- Roles
- Courses
- CourseModules
- LearningTracks
- TrackSteps
- Assignments
- Enrollments
- ProgressEvents
- Quizzes
- QuizQuestions
- QuizResponses
- Certificates
- CertificateTemplates
- KnowledgeSpaces
- KnowledgeArticles
- NewsPosts
- DevelopmentPlans
- DevelopmentPlanItems
- ReportPresets
- Notifications
- AccessLinks

Sets:

- LearningSettings
- PortalNavigationSettings
- CertificateVariables
- NotificationTemplates
- ReportFilters
- WorkspaceDefaults

Enumerations:

- CourseStatus
- ContentType
- EnrollmentStatus
- CompletionStatus
- QuestionType
- TrackStepRule
- Visibility
- UserRole
- NotificationChannel
- DevelopmentPlanStatus

Scripts:

- Calculate enrollment progress.
- Mark overdue assignments.
- Assign courses by department/group.
- Generate certificate eligibility.
- Aggregate report metrics.
- Resolve portal navigation per workspace.
- Validate public access links.

Script safety pattern:

```ts
export default defineScript({
  key: 'learning.calculateEnrollmentProgress',
  version: 1,
  permissions: ['records:read', 'records:update'],
  async run(ctx, input) {
    const enrollment = await ctx.records.get('Enrollments', input.enrollmentId)

    if (!enrollment) {
      return { status: 'skipped', reason: 'not_found' }
    }

    const moduleProgress = await ctx.records.find('ModuleProgress', {
      enrollmentId: enrollment.id
    })

    const completed = moduleProgress.filter((item) => item.status === 'completed').length
    const total = Math.max(moduleProgress.length, 1)

    return {
      status: 'ok',
      patch: {
        progressPercent: Math.round((completed / total) * 100),
        completionStatus: completed === total ? 'completed' : 'in_progress'
      }
    }
  }
})
```

Acceptance checks:

- The product snapshot contains realistic LMS sample data.
- Learner-facing navigation opens useful pages and records.
- Admin-facing lists contain meaningful catalogs, filters, and statuses.
- Workspace-specific settings affect runtime behavior where expected.
- The template remains generic at the package level.

### Phase 8. Product Playwright Generator and Fixture

Files:

- `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`
- `tools/testing/e2e/support/lmsFixtureContract.ts`
- `tools/fixtures/metahubs-lms-app-snapshot.json`

Tasks:

1. Update the generator to create the new Page type and Page seed data.
2. Add publication-version `runtimePolicy.workspaceMode`.
3. Generate LMS data through UI/API paths that mirror real product usage.
4. Replace outdated module-only and demo-space fixture content with serious LMS content.
5. Recompute snapshot hash through the existing generator flow.
6. Extend fixture contract assertions.

Contract assertions:

- Snapshot includes `page` preset/type.
- Snapshot includes `runtimePolicy.workspaceMode`.
- Snapshot contains no removed LMS widget keys.
- Snapshot uses generic runtime widgets/views.
- Snapshot has realistic catalogs, pages, sets, enumerations, and scripts.
- Page blocks validate as Editor.js-compatible data.
- Menu starts on a meaningful learner page or dashboard.
- Fixture hash matches generated content.

Acceptance checks:

- The fixture can import into a clean database.
- A publication and application can be created from it.
- Connector schema installation respects workspace policy.
- Runtime application opens without broken menu items or empty primary views.

### Phase 9. Test Plan

Backend Jest tests:

- Page preset registration and template defaults.
- Block content validation and sanitization.
- Page object config persistence through `_mhb_objects.config.blockContent`.
- Page snapshot deserialization sets the runtime physical-table contract to disabled by default.
- Schema DDL generation keeps Page as `_app_objects` metadata and does not create a physical table.
- Page metadata survives application schema sync, release bundle export, and clean-database import.
- Nonphysical entities are excluded from workspace column backfills, seed-record flows, physical-table diffs, and FK creation.
- Basic, Basic Demo, and LMS template seed generation.
- Publication-version workspace policy serialization and hashing.
- Required-policy downgrade rejection.
- Connector schema workspace decision resolver.
- `rel_connector_publications.schema_options` validation and persistence.
- Application sync irreversible workspace enablement.
- Existing runtime row backfill when upgrading a non-workspace schema to workspace mode.
- SQL store mutations using `RETURNING` and fail-closed zero-row handling.

Frontend Vitest tests:

- Publication version policy selector states and warnings.
- Application creation without workspace controls.
- Connector schema dialog optional/required/disabled states.
- Page editor save validation feedback.
- Runtime Page renderer escaping unsafe content.
- Runtime card grid overflow behavior with long labels.
- i18n coverage for English and Russian keys.
- TanStack Query key/invalidation coverage for new publication-policy and connector-schema queries.

Playwright tests:

- Generate LMS fixture on port `3100`.
- Import fixture into a clean test database.
- Create metahub, publication, version, application, connector, and schema.
- Verify optional workspace policy can install both with and without workspaces.
- Verify required workspace policy locks schema installation on.
- Verify disabled workspace policy locks schema installation off.
- Verify non-workspace application can be upgraded to workspace mode with acknowledgement.
- Verify workspace-enabled application cannot be downgraded.
- Capture desktop and mobile screenshots for:
  - metahub entity list with Page,
  - publication version policy dialog,
  - connector schema settings,
  - learner home,
  - course catalog,
  - course detail,
  - knowledge article page,
  - reports table,
  - workspace management page.

Validation commands:

```bash
pnpm --filter @universo/types test
pnpm --filter @universo/utils test
pnpm --filter @universo/schema-ddl test
pnpm --filter @universo/metahubs-backend test
pnpm --filter @universo/metahubs-frontend test
pnpm --filter @universo/applications-backend test
pnpm --filter @universo/applications-frontend test
pnpm --filter @universo/apps-template-mui test
pnpm --filter @universo/metahubs-backend build
pnpm --filter @universo/applications-backend build
pnpm --filter @universo/apps-template-mui build
```

Run the root build only as the final cross-package validation step:

```bash
pnpm build
```

Do not run `pnpm dev` automatically.

### Phase 10. Documentation and Memory Bank Updates

Docs to update in GitBook format:

- `docs/en/architecture/lms-entities.md`
- `docs/ru/architecture/lms-entities.md`
- `docs/en/guides/lms-overview.md`
- `docs/ru/guides/lms-overview.md`
- `docs/en/guides/lms-setup.md`
- `docs/ru/guides/lms-setup.md`
- `docs/en/guides/workspace-management.md`
- `docs/ru/guides/workspace-management.md`
- `docs/en/guides/creating-application.md`
- `docs/ru/guides/creating-application.md`
- `docs/en/guides/publishing-content.md`
- `docs/ru/guides/publishing-content.md`
- `docs/en/guides/app-template-views.md`
- `docs/ru/guides/app-template-views.md`
- `docs/en/SUMMARY.md`
- `docs/ru/SUMMARY.md`

Package READMEs to update:

- `packages/metahubs-backend/base/README.md`
- `packages/metahubs-frontend/base/README.md`
- `packages/applications-backend/base/README.md`
- `packages/applications-frontend/base/README.md`
- `packages/apps-template-mui/README.md`
- `packages/universo-template-mui/base/README.md` if shared MUI primitives move there.

Memory bank updates after implementation:

- `memory-bank/activeContext.md`
- `memory-bank/progress.md`
- `memory-bank/tasks.md`
- `memory-bank/rls-integration-pattern.md` if SQL/runtime schema access patterns change.

All memory-bank updates must be written in English.

## Detailed File-Level Work Map

### `packages/universo-types`

- Add `WorkspaceModePolicy`.
- Add runtime policy snapshot interfaces.
- Add `blockContent` component types.
- Add Page entity type keys and reusable block-content contracts.
- Add an executable runtime entity physical-table contract field or helper type so metadata-only kinds are not inferred from string literals.
- Extend `ComponentManifest`, component dependency validation, and tests so every standard type explicitly sets `blockContent`.
- Export all new types from package entry points.

### `packages/universo-utils`

- Add workspace policy resolver.
- Add parse/assert helpers for policy transitions.
- Add Editor.js output validation helpers if they are not backend-specific.
- Keep helpers framework-neutral.

### `packages/metahubs-backend`

- Register Page preset.
- Add Page to Basic, Basic Demo, and LMS template defaults.
- Store Page blocks on metadata object config, not in a default Page runtime table.
- Add runtime policy to publication version creation.
- Include runtime policy in snapshot serialization and hashing.
- Deserialize publication snapshots into executable entity definitions with explicit physical-table flags derived from component manifests.
- Enforce publication policy transition rules.
- Update import/export and product fixture validation.
- Keep all SQL schema-qualified and parameterized.

### `packages/schema-ddl`

- Add `hasPhysicalRuntimeTable(entity)` or equivalent as the single runtime DDL predicate.
- Register `page` as a standard metadata-only kind without making every unknown kind nonphysical.
- Update `SchemaGenerator`, schema snapshot generation, diff/migration planning, FK generation, tabular table handling, and system metadata sync to respect the physical-table contract.
- Store `NULL` table names for nonphysical runtime objects in `_app_objects`.
- Add tests proving Page produces metadata only and no fallback `obj_*` table.

### `packages/metahubs-frontend`

- Add Page preset labels and create-option UI.
- Add Page content support through the existing entity instance dialog/tab flow.
- Add publication version workspace policy selector.
- Add irreversible warnings.
- Remove stale UI assumptions about fixed standard preset keys.

### `packages/applications-backend`

- Remove application-create workspace decision.
- Add `rel_connector_publications.schema_options`.
- Apply publication-version workspace policy during sync.
- Preserve `page` and safe custom metadata kinds in runtime entity kind normalization, schema sync, release bundle generation, app export, and clean import.
- Skip seed-record, workspace-column, backfill, and FK paths for nonphysical runtime objects.
- Support additive workspace enablement for already installed non-workspace schemas.
- Backfill existing runtime rows into a default workspace when enabling workspace mode on an existing schema.
- Block downgrade for workspace-enabled schemas.
- Add focused store and controller tests.

### `packages/applications-frontend`

- Remove workspace checkbox from application creation flows.
- Add connector schema settings UI.
- Fetch publication version policy before schema install/update.
- Add warnings and disabled states based on policy.
- Update i18n.

### `packages/apps-template-mui`

- Add generic Page renderer.
- Improve runtime card and workspace page layout to match the original MUI template.
- Extend generic table/card/detail views for LMS needs.
- Keep LMS behavior data-driven through snapshot config.

### `tools/testing/e2e`

- Update LMS product generator.
- Extend LMS fixture contract.
- Add screenshot coverage for generated runtime.
- Keep generated snapshot hash reproducible.

## Risks and Mitigations

Risk: Page becomes a CMS-only feature or a hidden Catalog clone.
Mitigation: implement Page as a standard metadata object type with `blockContent` stored in object config and no default physical table.

Risk: Workspace policy is split between publication, connector, and application state.
Mitigation: centralize resolution rules, store requested schema options on `rel_connector_publications.schema_options`, and keep application `workspaces_enabled` as installed runtime state only.

Risk: Workspace enablement is persisted before schema sync succeeds.
Mitigation: resolve effective mode before diff/DDL, use it in memory during sync, and persist `workspaces_enabled` only with successful sync state.

Risk: Existing rows become invisible after enabling workspace mode.
Mitigation: backfill existing runtime rows into a default/shared workspace during the upgrade path.

Risk: Required workspace mode is accidentally downgraded.
Mitigation: enforce the rule in backend stores/controllers and test both publication and application paths.

Risk: Editor.js payload introduces XSS or unbounded JSON.
Mitigation: validate block count, block type, field sizes, and render read-only output through safe components.

Risk: LMS functionality becomes hardcoded.
Mitigation: use generic Pages, Catalogs, Sets, Enumerations, runtime views, scripts, and workspace settings. Add tests that reject removed LMS-only widget keys.

Risk: UI drifts away from the MUI template.
Mitigation: use Playwright screenshots and compare with `.backup/templates/dashboard` before accepting runtime UI work.

## Definition of Done

- Basic and Basic Demo templates include Page by default.
- LMS template includes Page metadata objects, block content, realistic LMS entities, scripts, and runtime views.
- Publication versions include `runtimePolicy.workspaceMode` in snapshots.
- Workspace policy transition rules are enforced.
- Application creation no longer owns workspace mode.
- Connector schema installation owns the workspace choice when policy allows it.
- Connector-publication schema options are stored and validated.
- Existing runtime rows are preserved when workspace mode is enabled on an existing schema.
- Runtime app UI follows the original MUI dashboard style and has no visible overflow.
- The generated LMS fixture imports into a clean database and produces a working application.
- Jest, Vitest, and Playwright coverage exists for new backend, frontend, runtime, and fixture behavior.
- GitBook docs, package READMEs, and memory-bank files are updated.

## Proposed Execution Order

1. Implement shared types and policy resolver.
2. Add Page type and block-content validation.
3. Add Page to Basic and Basic Demo templates.
4. Add publication-version runtime policy.
5. Add connector-publication schema options.
6. Move workspace decision to connector schema installation and successful sync-state persistence.
7. Add workspace upgrade backfill for existing runtime rows.
8. Add runtime Page rendering and MUI layout parity fixes.
9. Expand generic runtime views.
10. Rebuild the LMS product model and scripts.
11. Regenerate the LMS Playwright fixture.
12. Add full Jest, Vitest, and Playwright coverage.
13. Update GitBook docs, READMEs, and memory bank.

This order keeps platform contracts stable before the LMS fixture is rebuilt and prevents the product generator from depending on temporary UI/API behavior.
