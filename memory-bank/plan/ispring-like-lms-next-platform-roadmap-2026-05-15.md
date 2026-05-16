# iSpring-like LMS Platform Roadmap

Date: 2026-05-15
Mode: PLAN
Status: Implemented with QA follow-up remediation

## Goal

Move the current LMS metahub demo from a mostly seeded configuration into a genuinely usable iSpring-like LMS application generated from `tools/fixtures/metahubs-lms-app-snapshot.json`.

The target result is still architecture-first:

- metahubs define base metadata, default logic, demo content, scripts, and layouts;
- applications define global runtime settings, role policies, menus, dashboards, report definitions, and app-wide defaults;
- workspaces define local operational settings and user-created content;
- LMS behavior must be expressed through generic platform primitives instead of a hardcoded LMS runtime module.

The final acceptance artifact is a regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` produced by Playwright generators, not hand-edited JSON.

## Research Inputs

### External LMS Features

iSpring LMS documentation shows the feature set that should guide parity:

- content formats: SCORM 1.2/2004, video, audio, documents, PowerPoint, courses, assignments, pages, and web links;
- courses: sections, mixed content items, due dates, order, completion conditions, certificates, enrollments, and reports;
- user portal navigation: configurable quick-access menu, maximum six visible modules, configurable start page, and role-based preview;
- assignments: freeform learner submissions, instructor review, grading, acceptance, decline, and resubmission;
- knowledge base: spaces, folders, articles, downloadable documents, permission-limited search, bookmarks, analytics, and trash;
- development plans: mentee dashboards, stages, checklist tasks, mentors, task monitors, comments, status changes, and export;
- course progress: type-specific contribution rules by item status, with learning track progress derived from course progress;
- certificates: validity, expiration, renewal, re-enrollment, filters, export, email, and scheduled reports;
- gamification and achievements: points, badges, leaderboards, manual point adjustments, and user achievement views.

Comparable LMS systems confirm the same core primitives:

- Moodle emphasizes activity completion, automatic/manual completion criteria, teacher overrides, and activity reports.
- Canvas emphasizes module-based course flow, ordered module items, prerequisites, requirements, due dates, publishing, and item reordering.

### Current Platform Baseline

The platform already contains important building blocks:

- standard entity kinds: `hub`, `page`, `object`, `set`, `enumeration`, `ledger`;
- runtime Object CRUD with create, update, copy, delete, reorder, and record commands;
- application role policies with content permissions;
- workspaces and workspace-required runtime policy;
- app sync/materialization and scoped layouts;
- Object-backed posting/unposting/voiding and ledger movements;
- reports runner with saved report definitions;
- script attachment and restricted runtime script capabilities;
- metahub Page authoring with Editor.js in `packages/universo-template-mui`;
- published app Page rendering in `packages/apps-template-mui`;
- LMS template entities for courses, modules, tracks, assignments, training events, certificates, reports, knowledge base, development plans, notifications, enrollments, progress, and ledgers.

### Confirmed Gaps

1. Published apps can create/edit generic Object records, but they cannot author rich Editor.js content inside the app.
2. `packages/apps-template-mui` renders page blocks but does not include an Editor.js authoring surface.
3. Runtime JSON fields are edited as raw JSON text, so authored lessons, articles, and instructions are not viable for normal admins.
4. LMS resource source types exist in shared contracts, but runtime preview/player behavior is incomplete and the fixture seeds only a narrow page/video subset.
5. Sequence and completion contracts exist, but enforcement is not yet a generic runtime engine.
6. Workflow/status/action contracts exist, but assignment grading, attendance marking, certificate issuing, and review inboxes are not fully operational flows.
7. The LMS menu still uses surrogate routes: Knowledge points to `Quizzes`, Development points to `Classes`.
8. Assignment, training, certificate, and notification entities exist, but the snapshot generator does not yet seed and prove enough realistic rows.
9. Reports are operational at the backend level, but report homes, saved filters, exports, scheduled reports, and persona-specific report UX need more work.
10. Some application UI still drifts from the original `packages/apps-template-mui` dashboard style and should be re-aligned with `.backup/templates/dashboard`.
11. `packages/apps-template-mui` still imports shared UI utilities from `@universo/template-mui`, which conflicts with the long-term boundary where published apps must be independent from the old Universo template package.
12. The current `quizWidget` is a specialized LMS-shaped widget. It should either become a generic script-driven assessment widget or stay explicitly quarantined while no new LMS-specific widgets are added.
13. The roadmap must explicitly keep full messenger/chat, SCORM/xAPI package runtime, broad file upload/storage, and office-document conversion as late phases. Early phases may only add safe metadata shells and placeholders for these capabilities.
14. Published runtime permissions must be fail-closed everywhere. The current app wrapper must not treat missing `permissions` as create/edit/delete access.
15. Role policy scopes exist in shared contracts, but only `application` and `workspace` scopes are currently actionable. LMS-grade supervisor, department, class, group, and record-owner access needs a generic scoped capability engine.
16. Resource URLs currently need stronger shared validation than a generic URL parser: `http`/`https` only, no credentials, explicit embed policy, and shared schema reuse across resource contracts and block content.
17. New shared packages must follow workspace package rules from the repository, including package-name imports, TypeScript/TSX sources, dual CJS/ESM build outputs, and clean exports.
18. Gamification and achievements are not yet modeled as a real generic points/badges/leaderboard flow, even though they are part of iSpring-like parity and should reuse Objects, Ledgers, reports, and scoped capabilities.

## Architectural Decisions

### Keep LMS as Configuration

Do not add `lms-*` hardcoded runtime screens unless they are generic surfaces configured by metadata. For example:

- create a generic resource preview widget, not an LMS course player widget;
- extend generic overview/table/card widgets before adding a new widget type;
- express course modules, assignments, certificates, events, and development tasks as Objects with components, statuses, scripts, and report definitions;
- use scripts for domain-specific actions where the platform only needs a generic hook.

### Use Object as the Main Business Metadata Type

Continue using Object as the universal business metadata type. It already covers the combined role of 1C catalogs, documents, and registers through:

- components;
- record behavior;
- lifecycle/status settings;
- posting configuration;
- ledger movements;
- scripts;
- workspace-scoped rows.

Add new platform behavior to Object only when it is generic: workflow actions, sequence policies, authoring field widgets, resource previews, and report projections.

### Remove Published App Dependency on the Old Template Package

Before adding more published-app features, break the current dependency from `packages/apps-template-mui` to `@universo/template-mui`.

Required actions:

- inventory all imports from `@universo/template-mui` inside `packages/apps-template-mui`;
- move app-runtime primitives such as view headers, toolbar controls, item cards, list tables, pagination controls, and view preferences into `packages/apps-template-mui` or a neutral shared UI package;
- avoid importing `packages/universo-template-mui` from `packages/apps-template-mui`;
- add a boundary test or lint script that fails if `packages/apps-template-mui/src` imports `@universo/template-mui`;
- keep `packages/applications-frontend` free to use admin/metapanel components from `@universo/template-mui` until those are migrated separately.

This is not only a cleanup task. It protects the future replacement of `packages/universo-template-mui` by `packages/apps-template-mui`.

### Extract Editor.js into a Shared Content Package

Preferred direction:

- create a new shared package, for example `@universo/block-editor` or `@universo/content-blocks`;
- keep canonical block schemas, normalization, and safe storage validation in `@universo/types`;
- move reusable Editor.js UI integration, Editor.js tool loading, localized editor helpers, and renderer helpers from `packages/universo-template-mui` into the new package;
- consume it from both `packages/universo-template-mui` and `packages/apps-template-mui`;
- keep package boundaries clean because `packages/universo-template-mui` is expected to be replaced by `packages/apps-template-mui` later.

Fallback for a smaller first slice:

- copy the current `EditorJsBlockEditor` implementation into `packages/apps-template-mui`;
- immediately wrap it behind an internal API compatible with the future shared package;
- schedule extraction before expanding content authoring.

The shared package is the better option because it prevents another copy/paste fork of a security-sensitive editor integration. The package must depend on `@universo/types`, not redefine block content schemas.

Repository package requirements:

- use the full workspace package name in all cross-package imports;
- write the package in TypeScript/TSX;
- provide CJS and ESM builds into `dist/`;
- publish correct `main`, `module`, `types`, and `exports` entries;
- keep UI text externalized through `@universo/i18n`;
- do not duplicate canonical block schemas outside `@universo/types`.

### Runtime Content Model

Do not treat metahub Pages as the only content authoring target.

Recommended split:

- metahub Pages remain portal/static application pages seeded from the template;
- runtime-created educational content is stored as Object records with JSON block-content fields, such as Learning Resources, Knowledge Articles, Assignment Instructions, or Course Lessons;
- app-level portal page overrides can be added later using the same editor, but they should be stored as application/runtime overrides, not by mutating the source metahub defaults;
- workspace-created content stays workspace-scoped unless explicitly promoted to app-level content.

This keeps the platform close to the 1C configuration/application split: configuration defines metadata and defaults; the running application owns operational data.

### No Legacy Compatibility Debt

The LMS fixture and test databases can be recreated from scratch. Therefore:

- do not preserve old LMS seed shapes when they conflict with the target architecture;
- do not bump schema or metahub template versions only to protect disposable test data;
- do not add migrations for obsolete fixture-only structures unless production runtime tables require them;
- regenerate product snapshots through Playwright generators after metadata changes.

### Extend Existing UI Before Creating New UI

Prefer existing app-control and runtime UI surfaces:

- extend `ApplicationMenuWidgetEditorDialog` for menu and start-page settings;
- extend existing layout/widget behavior dialogs for datasource, chart, overview-card, and columns-container settings;
- extend `FormDialog` and its `renderField` override for specialized field widgets;
- extend generic runtime table/card/detail widgets before adding a new widget key;
- add a new widget only when the behavior is generic and cannot be represented by the existing widgets.

### Security Defaults and Scoped Capabilities

The platform must fail closed when a permission payload is missing, malformed, or not yet supported.

Required rules:

- published runtime UI can show create, edit, delete, inline edit, and workflow actions only when the resolved permission is explicitly `true`;
- backend mutations remain the source of truth and must reject every unsupported capability scope;
- unsupported role-policy scopes must not silently widen access;
- scoped permissions must become a generic engine before LMS supervisor and department features are accepted.

The scoped capability engine should support:

- `application`;
- `workspace`;
- `recordOwner`;
- `department`;
- `class`;
- `group`.

Each scope needs query predicates, workflow-action predicates, report predicates, and tests that prove both allowed and denied access.

## Phased Plan

### Phase 0. Baseline Audit and Acceptance Matrix

1. Re-read the existing LMS plans and mark which items are now implemented.
2. Build a current capability matrix against iSpring, Moodle, and Canvas primitives:
   - content;
   - courses/modules;
   - tracks/sequences;
   - assignments;
   - events/attendance;
   - certificates;
   - reports;
   - knowledge base;
   - development plans;
   - notifications;
   - roles;
   - workspaces;
   - authoring.
3. Update `tools/testing/e2e/support/lmsFixtureContract.ts` so it can distinguish "entity exists" from "flow works".
4. Define phase gates in the matrix:
   - `seeded`;
   - `visible`;
   - `actionable`;
   - `audited`;
   - `workspace-isolated`;
   - `covered-by-e2e`.

Acceptance:

- a human-readable matrix exists in `memory-bank` and test fixtures;
- current failures are explicit and actionable;
- no fixture JSON is edited by hand.

### Phase 0.5. Published App Package Boundary Cleanup

1. Remove direct runtime imports from `@universo/template-mui` inside `packages/apps-template-mui`.
2. Move or duplicate the minimum app-runtime UI primitives into `packages/apps-template-mui` first:
   - `ViewHeaderMUI`;
   - `ToolbarControls`;
   - `ItemCard`;
   - `FlowListTable`;
   - `PaginationControls`;
   - `useViewPreference`;
   - related lightweight types used only by the published app runtime.
3. If a primitive is also useful outside published apps, create a neutral shared UI package instead of depending on the old template package.
4. Keep admin/metapanel screens in `packages/applications-frontend` unchanged unless the implementation slice already touches them.
5. Add a dependency boundary check, for example a small `rg`-based script or ESLint restriction, that fails on `@universo/template-mui` imports from `packages/apps-template-mui/src`.

Acceptance:

- `packages/apps-template-mui/src` has no imports from `@universo/template-mui`;
- `packages/apps-template-mui/package.json` no longer depends on `@universo/template-mui`;
- app runtime screens still match the existing MUI dashboard style;
- workspace, table, card, and menu screenshots show no UI regression.

### Phase 0.6. Fail-Closed Runtime Permissions and Scoped Capability Baseline

1. Align runtime permission defaults across `packages/applications-frontend`, `packages/apps-template-mui`, and `packages/applications-backend`.
2. In the published runtime wrapper, treat `permissions.createContent`, `permissions.editContent`, `permissions.deleteContent`, and `permissions.readReports` as allowed only when the value is explicitly `true`.
3. Disable inline cell editing, row actions, create/copy/delete actions, and workflow buttons unless the corresponding permission is explicitly allowed.
4. Add a shared helper for resolving runtime permissions from untrusted API payloads.
5. Keep backend checks as the source of truth and make frontend permissions only a UX filter.
6. Add a scoped capability resolver that can parse every declared scope but executes only implemented scopes.
7. Fail closed for unsupported scoped rules until the matching predicate is implemented.
8. Add minimal implemented support for `application` and `workspace` scopes as the baseline.
9. Define the implementation contract for `recordOwner`, `department`, `class`, and `group` before supervisor/persona work begins.

Acceptance:

- missing, `null`, or malformed permissions do not show create/edit/delete UI;
- inline BOOLEAN editing is disabled without explicit `editContent`;
- backend mutation routes still reject denied users even if the UI is bypassed;
- unsupported scoped rules do not grant access;
- tests cover owner/admin/editor/member and malformed permission payloads;
- the capability matrix marks every scope as `implemented`, `deferred-fail-closed`, or `not-supported`.

### Phase 1. App-Side Rich Content Authoring

1. Create or extract the shared block editor package without moving canonical schemas out of `@universo/types`.
2. Build the shared package with repository-compliant CJS and ESM outputs, `dist/`, package exports, and package-name workspace imports.
3. Add a generic JSON field UI profile for block content.
4. Preserve the safe block schema and strict validation already used by metahub Pages.
5. Extend `packages/apps-template-mui/src/components/dialogs/FormDialog.tsx` so `FieldConfig` can carry sanitized `uiConfig`.
6. Extend `packages/apps-template-mui/src/utils/columns.tsx` so `toFieldConfigs()` keeps safe `uiConfig` for all top-level and TABLE child fields.
7. Extend `FormDialog` through its existing `renderField` override or a built-in JSON widget branch.
8. Add backend-side write validation for JSON fields that declare `uiConfig.widget = editorjsBlockContent`, using `normalizePageBlockContentForStorage()` and component-level `allowedBlockTypes` / `maxBlocks`.
9. Add a concrete LMS metadata field for authored content, for example `LearningResources.BlockContent` or a generic `ContentPages.BlockContent` Object, rather than storing authored lesson text only inside `LearningResources.Source`.
10. Keep `Source` as a locator/launch descriptor and `BlockContent` as the editable lesson/article content payload.
11. Add localized UI strings to `packages/universo-i18n` and app package locales.
12. Support both dialog and page edit surfaces for long content.
13. Add read-only preview rendering for block-content JSON inside record detail views.

Illustrative schema:

```ts
import { z } from 'zod'
import { SUPPORTED_PAGE_BLOCK_TYPES } from '@universo/types'

const blockTypeSchema = z.enum(SUPPORTED_PAGE_BLOCK_TYPES)

export const blockContentFieldUiConfigSchema = z
  .object({
    widget: z.literal('editorjsBlockContent'),
    allowedBlockTypes: z.array(blockTypeSchema).default(['paragraph', 'header', 'list', 'quote', 'table', 'embed', 'image', 'delimiter']),
    maxBlocks: z.number().int().positive().max(500).default(120),
    readOnlyPreview: z.boolean().default(true)
  })
  .strict()
```

Illustrative field config shape:

```ts
export interface FieldConfig {
  id: string
  label: string
  type: FieldType
  uiConfig?: Record<string, unknown>
}
```

Illustrative form integration:

```tsx
const renderRuntimeField = ({ field, value, onChange, disabled, locale }: RuntimeFieldRenderParams) => {
  const config = blockContentFieldUiConfigSchema.safeParse(field.uiConfig)

  if (field.type !== 'JSON' || !config.success) {
    return undefined
  }

  return (
    <BlockContentEditor
      value={normalizePageBlockContentForStorage(value, config.data)}
      locale={locale}
      allowedBlockTypes={config.data.allowedBlockTypes}
      maxBlocks={config.data.maxBlocks}
      readOnly={disabled}
      onChange={onChange}
    />
  )
}
```

Acceptance:

- app admins can create a Learning Resource with rich block content without raw JSON;
- app admins can edit Knowledge Article content inside the published app;
- metahub Page authoring still works;
- app runtime still does not import from `packages/universo-template-mui`;
- JSON block-content fields are normalized on both client and server before persistence;
- tests cover normalization, validation, i18n, create, edit, reload, and preview;
- the new block editor package follows repository package conventions and does not introduce cross-package relative imports.

### Phase 2. Generic Resource Engine

1. Promote current resource contracts into operational runtime behavior:
   - `page`;
   - `url`;
   - `video`;
   - `audio`;
   - `document`;
   - `embed`;
   - `file`;
   - `scorm` as a deferred adapter placeholder only.
2. Add a generic Resource Preview component in `packages/apps-template-mui`.
3. Move safe external URL validation into shared contracts and reuse it from `resourceSourceSchema`, thumbnail/resource preview config, and block-content validation.
4. Add safe URL, MIME, and embed validation in backend stores/services.
5. Allow only `http` and `https` resource URLs in early phases, reject credentials in URLs, and define an explicit embed allowlist/sandbox policy before rendering embeds.
6. Add a resource opening event that can update progress through scripts or a generic event ledger.
7. Seed realistic resources in the LMS generator:
   - Editor.js lesson;
   - web link;
   - video URL;
   - audio example;
   - document link;
   - embedded resource;
   - SCORM placeholder marked unsupported/deferred.
8. Do not implement full file upload/storage, document conversion, SCORM player, xAPI/LRS integration, or office-format parsing in this phase.

Secure URL validation example:

```ts
const allowedProtocols = new Set(['https:', 'http:'])

export function parseSafeExternalUrl(input: string): URL {
  const url = new URL(input)

  if (!allowedProtocols.has(url.protocol)) {
    throw new ValidationError('Unsupported URL protocol')
  }

  if (url.username || url.password) {
    throw new ValidationError('Credentials in URLs are not allowed')
  }

  return url
}
```

Acceptance:

- resource records can be created in the app;
- resource previews are generic and not LMS-specific;
- unsupported formats fail closed with clear localized messages;
- fixture contract checks multiple resource source types;
- full SCORM/xAPI/file-upload support remains explicitly deferred and is not disguised as working functionality;
- unsafe protocols, URLs with credentials, unsupported MIME types, and unapproved embeds are rejected by shared schemas and backend validation.

### Phase 3. Course Builder and Sequence Engine

1. Keep Courses, Course Sections, Modules, Learning Tracks, and Track Steps as Objects.
2. Improve runtime editing for TABLE/child records and related record pickers so admins can assemble courses without raw IDs.
3. Implement a generic sequence policy engine for ordered content:
   - free order;
   - sequential order;
   - scheduled availability;
   - prerequisite-based availability;
   - due dates;
   - completion conditions.
4. Use the existing script system for domain-specific scoring or ledger movements.
5. Add progress recalculation helpers based on resource type and status.

Generic progress calculation example:

```ts
export function calculateWeightedProgress(items: CompletionItem[]): number {
  if (items.length === 0) return 0

  const itemWeight = 100 / items.length
  const total = items.reduce((sum, item) => {
    if (item.status === 'completed' || item.status === 'accepted') {
      return sum + itemWeight
    }

    if (item.status === 'inProgress' && typeof item.progressPercent === 'number') {
      return sum + itemWeight * Math.max(0, Math.min(100, item.progressPercent)) / 100
    }

    if ((item.status === 'passed' || item.status === 'failed') && typeof item.scorePercent === 'number') {
      return sum + itemWeight * Math.max(0, Math.min(100, item.scorePercent)) / 100
    }

    return sum
  }, 0)

  return Math.round(total * 100) / 100
}
```

Acceptance:

- learners cannot open locked sequential items;
- admins can reorder modules and track steps;
- progress changes are deterministic and tested;
- reports and learner dashboard use the same progress source.

### Phase 4. Generic Workflow Actions

1. Add metadata-backed workflow actions to Object runtime:
   - action codename;
   - from statuses;
   - target status;
   - required capability;
   - optional confirmation;
   - optional script hook;
   - optional posting command.
2. Reuse this engine for:
   - assignment submit/review/accept/decline/resubmit;
   - training attendance mark/no-show;
   - certificate issue/revoke/renew;
   - development task verify/reopen/complete.
3. Render available actions as row/detail action buttons based on role policy, workspace, and current row status.
4. Persist action audit facts.
5. Evaluate scoped capabilities through the generic capability engine before rendering or executing actions.

Safe mutation pattern:

```ts
export async function applyWorkflowAction(executor: DbExecutor, params: ApplyWorkflowActionParams): Promise<void> {
  const tableName = qSchemaTable(params.schemaName, params.tableName)
  const idColumn = qColumn('id')
  const statusColumn = qColumn(params.statusColumnName)
  const deletedColumn = qColumn('_upl_deleted')
  const appDeletedColumn = qColumn('_app_deleted')
  const versionColumn = qColumn('_upl_version')
  const updatedAtColumn = qColumn('_upl_updated_at')
  const updatedByColumn = qColumn('_upl_updated_by')
  const workspaceColumn = qColumn('workspace_id')
  const workspaceClause = params.hasWorkspaceColumn ? `AND ${workspaceColumn} = $5` : ''
  const workspaceParams = params.hasWorkspaceColumn ? [params.workspaceId] : []
  const expectedVersionParam = params.hasWorkspaceColumn ? 6 : 5

  if (params.hasWorkspaceColumn && !params.workspaceId) {
    throw new NotFoundOrConflictError('Workspace-scoped action requires a workspace context')
  }

  if (!Number.isInteger(params.expectedVersion) || params.expectedVersion <= 0) {
    throw new NotFoundOrConflictError('Workflow action requires a current row version')
  }

  const rows = await executor.query<{ id: string }>(
    `
      UPDATE ${tableName}
         SET ${statusColumn} = $3,
             ${updatedAtColumn} = now(),
             ${updatedByColumn} = $4,
             ${versionColumn} = COALESCE(${versionColumn}, 1) + 1
       WHERE ${idColumn} = $1
         AND ${statusColumn} = ANY($2::text[])
         AND ${deletedColumn} = false
         AND ${appDeletedColumn} = false
         ${workspaceClause}
         AND COALESCE(${versionColumn}, 1) = $${expectedVersionParam}
       RETURNING ${idColumn}
    `,
    [
      params.rowId,
      params.allowedFromStatuses,
      params.targetStatus,
      params.userId,
      ...workspaceParams,
      params.expectedVersion
    ]
  )

  if (rows.length !== 1) {
    throw new NotFoundOrConflictError('Workflow action is not available for this row')
  }
}
```

Acceptance:

- actions fail closed on stale status, missing permission, or wrong workspace;
- actions require the current `_upl_version` and fail closed when it is missing or stale;
- dynamic identifiers are limited to schema/table/column helpers and never interpolated from unchecked strings;
- assignment review and certificate issue are operational in app runtime;
- mutation contracts have direct tests, not only route mocks;
- supervisor, department, class, group, and record-owner workflow rules fail closed until their predicates are implemented and tested.

Implementation note, 2026-05-15:

- Completed the generic runtime transport and published-app row menu surface for workflow actions.
- Runtime app data now exposes object collection `workflowActions`; rows include `_upl_version` when workflow actions exist.
- `statusFieldCodename` resolves to runtime column names on both the backend route and frontend availability check.
- Runtime app data now exposes effective `workflowCapabilities`; row actions are filtered by exact `requiredCapabilities` and backend execution uses the same server-resolved capability map.
- Remaining Phase 4 work: detail-page action buttons, richer role-policy scoped predicates beyond application/workspace, and operational LMS flows such as assignment review and certificate issue.

### Phase 5. Persona Portal Pages and Navigation

1. Replace surrogate LMS menu entries with real portal pages:
   - `LearnerHome`;
   - `TrainingHome`;
   - `KnowledgeHome`;
   - `DevelopmentHome`;
   - `AssignmentsHome`;
   - `CertificatesHome`;
   - `ReportsHome`;
   - `AuthoringHome`;
   - `ReviewerInbox`;
   - `SupervisorHome`.
2. Keep quick-access menu rules compatible with iSpring: maximum six primary items and overflow menu.
3. Add role-aware previews in the application control panel.
4. Keep pages metadata-driven with generic widgets and data sources.
5. Use scoped layouts for persona pages instead of custom LMS screens.

Acceptance:

- Knowledge no longer routes to Quizzes;
- Development no longer routes to Classes;
- fixture contracts explicitly fail if Knowledge or Development routes to surrogate operational collections;
- menus differ correctly for learner, instructor, reviewer, supervisor, and admin policies;
- Playwright screenshots prove desktop and mobile layouts.

### Phase 6. Application Control Panel Enhancements

1. Extend existing metadata-backed editors where they already exist:
   - navigation menu and start page;
   - role policies;
   - dashboard widget data sources;
   - report definitions;
   - workflow actions;
   - sequence policies;
   - resource display settings;
   - content authoring permissions.
2. Use `ApplicationMenuWidgetEditorDialog` for menu/start-page work instead of creating a second menu editor.
3. Use existing layout/widget behavior dialogs for datasource, chart, overview-card, and columns-container settings before adding new dialogs.
4. Use TanStack Query optimistic updates with rollback for safe UX.
5. Keep global settings app-scoped and workspace settings workspace-scoped.
6. Add validation previews before saving config JSON.
7. Expose scoped role policies only through validated editors that show which scopes are implemented and which scopes are deferred/fail-closed.

Optimistic update pattern:

```ts
const updateSettings = useMutation({
  mutationFn: saveApplicationSettings,
  onMutate: async (next) => {
    await queryClient.cancelQueries({ queryKey: ['application-settings', applicationId] })
    const previous = queryClient.getQueryData<ApplicationSettings>(['application-settings', applicationId])
    queryClient.setQueryData(['application-settings', applicationId], next)
    return { previous }
  },
  onError: (_error, _next, context) => {
    if (context?.previous) {
      queryClient.setQueryData(['application-settings', applicationId], context.previous)
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['application-settings', applicationId] })
  }
})
```

Acceptance:

- admins can configure LMS-like portal behavior without editing JSON;
- invalid config is rejected before backend persistence;
- existing app-control UI patterns are reused and extended instead of duplicated;
- settings changes are visible after reload and after app sync;
- permission editors cannot save unsupported scoped rules as active grants.

### Phase 7. Operational LMS Modules

Implement each LMS capability as a real scenario with records, actions, reports, and screenshots.

1. Assignments:
   - assignment creation;
   - learner submission;
   - reviewer inbox;
   - grade/comment/file metadata;
   - accept/decline/resubmit.
2. Training events:
   - event schedule;
   - enrollment;
   - attendance marking;
   - no-show handling;
   - event completion facts.
3. Certificates:
   - certificate template record;
   - issue/revoke/renew workflow;
   - expiration and expiring window;
   - re-enrollment hint;
   - certificate reports.
4. Knowledge base:
   - spaces;
   - folders;
   - articles with Editor.js content;
   - bookmarks;
   - permission-limited search;
   - recent items.
5. Development plans:
   - plan templates;
   - employee plan;
   - stages;
   - tasks;
   - mentors;
   - monitors;
   - comments;
   - status changes;
   - export/report.
6. Achievements and gamification:
   - app/workspace-level gamification settings;
   - point award rules for course, track, assignment, event, and manual adjustments;
   - immutable points ledger facts and leaderboard projections;
   - badge definitions and badge issue/revoke workflow;
   - user achievement page that combines rank, points, badges, and certificates;
   - admin/manual point adjustment actions with audit and rollback.
7. Notifications:
   - internal outbox first;
   - rule preview;
   - event-generated notification records;
   - email/external channels later;
   - private/group messenger later.

Acceptance:

- every module has at least one end-to-end Playwright flow;
- every module has at least one report or dashboard projection;
- all row changes are workspace-isolated;
- achievements show deterministic points, badges, leaderboard rank, and certificates from seeded rows;
- notification records are generated for assignment/development/certificate flows.

### Phase 8. Reports, Analytics, and Export

1. Expand the generic report runner:
   - filters;
   - saved views;
   - role-scoped access;
   - server-side sort and pagination;
   - CSV export;
   - XLSX export later;
   - scheduled report definitions as deferred outbox jobs.
2. Build report homes from generic widgets:
   - learner progress;
   - course progress;
   - learning track progress;
   - assignment review;
   - event attendance;
   - certificate validity;
   - knowledge analytics;
   - development plan progress.
3. Keep report definitions in metahub/app config, not hardcoded React branches.

Acceptance:

- report outputs match deterministic fixture rows;
- export endpoints are covered by API tests;
- report access respects role policy and workspace scope.

### Phase 9. Apps Template MUI Parity

1. Compare current runtime screens with `.backup/templates/dashboard`.
2. Reuse or extract original dashboard components where the style drifted.
3. Fix workspace cards and grids to match the original dashboard density, white card style, spacing, and responsive behavior.
4. Remove or data-drive remaining demo-only dashboard widgets.
5. Convert the existing `quizWidget` into a generic script-driven assessment widget, or document it as a temporary exception and prevent new LMS-specific widget keys.
6. Keep UI text fully localized.
7. Run screenshot checks for:
   - app dashboard;
   - workspace list;
   - record list;
   - record detail;
   - content editor;
   - LMS home pages.

Acceptance:

- no visible demo data remains unless seeded as real records;
- workspace screens look native to the template;
- no new LMS-only widget key is introduced without a generic platform justification;
- screenshots are reviewed before accepting the phase.

### Phase 10. LMS Fixture Generator and Snapshot

1. Expand `tools/testing/e2e/specs/generators/metahubs-lms-app-export.spec.ts`.
2. Seed realistic records for all required modules:
   - resources of several source types;
   - courses with sections;
   - tracks with sequence policies;
   - assignments and submissions;
   - training events and attendance;
   - certificates and issues;
   - gamification settings, point ledger rows, badge rules, badge issues, and leaderboard fixtures;
   - knowledge spaces/folders/articles/bookmarks;
   - development plans/stages/tasks/comments;
   - notification rules and outbox records;
   - reports and report saved views.
3. Replace static-only fixture contract checks with flow-aware checks.
4. Regenerate `tools/fixtures/metahubs-lms-app-snapshot.json` only through Playwright.

Acceptance:

- new snapshot imports into a fresh database;
- generated app has no broken menu target;
- generated app has no surrogate Knowledge or Development menu target;
- app starts from a useful LMS home page;
- every primary LMS area has meaningful rows and actions.

### Phase 11. Test Strategy

Unit and contract tests:

- block content normalization and validation;
- `apps-template-mui` package-boundary check forbids imports from `@universo/template-mui`;
- safe URL parsing;
- shared resource source schema rejects unsafe protocols, URL credentials, unsupported MIME types, and unapproved embeds;
- sequence availability rules;
- progress calculation;
- workflow transition resolution;
- role policy permission mapping;
- fail-closed runtime permission defaults for missing, `null`, and malformed API payloads;
- scoped capability resolution for `application`, `workspace`, and deferred unsupported scopes;
- report definition parsing;
- gamification rule parsing and points ledger projection;
- SQL store mutation contracts.

Vitest/Jest integration tests:

- runtime Object CRUD with JSON block-content field;
- workflow action backend routes;
- report runner filters and aggregations;
- achievements and leaderboard report projections;
- workspace isolation;
- permission-gated create, edit, delete, inline edit, report, and workflow action access;
- supervisor/department/class/group/record-owner rules deny access until implemented predicates are active;
- app sync/materialization.

Playwright generator tests:

- regenerate LMS fixture;
- assert fixture contract;
- import snapshot into a fresh app;
- screenshot persona pages;
- screenshot content editor;
- run assignment review flow;
- run training attendance flow;
- run certificate issue flow;
- run achievements, points, badge, and leaderboard flow;
- run knowledge article authoring flow;
- run development plan task status flow;
- verify Knowledge and Development menu entries open real portal pages, not surrogate collections;
- verify denied users cannot access hidden actions through direct API calls;
- verify no console errors and no layout overflow.

E2E environment:

- use dedicated E2E Supabase minimal stack;
- do not run `pnpm dev`;
- let Playwright runner own its test servers;
- use deterministic UUID v7 helpers and deterministic fixture names.

Release gates:

- no schema or metahub template version bump is introduced only for disposable LMS fixture/test data;
- no hand-edited `tools/fixtures/metahubs-lms-app-snapshot.json`;
- no raw JSON authoring path remains as the only way to create LMS content in the published app;
- no new LMS-specific React screen or widget is accepted unless the generic primitive cannot cover the workflow;
- no missing frontend permission payload can expose mutation controls;
- no unsupported scoped role-policy rule can grant access;
- no surrogate Knowledge/Development navigation remains in the LMS fixture contract.

Implementation note, 2026-05-15:

- Completed the current Phase 5/10 portal-navigation slice.
- Added real `KnowledgeHome` and `DevelopmentHome` Page entities to the LMS template.
- Repointed the primary Knowledge and Development menu entries to those portal pages.
- Extended the LMS fixture contract so surrogate Knowledge/Development targets are rejected.
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator against dedicated local Supabase minimal.

Implementation note, 2026-05-15:

- Completed the current Phase 7/10 workflow-metadata slice.
- Added LMS workflow actions as generic Object metadata for assignment review, training attendance, certificate issue/revoke, development tasks, and notification outbox operations.
- Extended the backend template manifest test and LMS fixture contract to require these workflow actions, status transitions, capabilities, and certificate posting script binding.
- Regenerated `tools/fixtures/metahubs-lms-app-snapshot.json` through the Playwright LMS generator against dedicated local Supabase minimal.
- Remaining Phase 7 work: add Playwright runtime flows that create rows in a published app and execute each operational workflow through the existing row actions/runtime API path.

### Phase 12. Documentation

Update documentation after implementation, not before:

- package READMEs for `metahubs-backend`, `applications-backend`, `applications-frontend`, `apps-template-mui`, and the new block editor package;
- root `docs/` GitBook pages for:
  - LMS configuration;
  - runtime content authoring;
  - resources;
  - workflows;
  - sequence policies;
  - achievements and gamification;
  - reports;
  - workspaces;
  - app control panel settings;
  - permission defaults and scoped role policies;
  - resource URL/embed safety;
  - testing and fixture generation.

Documentation rules:

- memory-bank and docs content must be English;
- UI strings must be localized through i18n keys;
- screenshots must come from Playwright, not manual captures.

### Phase 13. Deferred Advanced Formats and Messenger

This phase is intentionally last because the first usable LMS should be based on Editor.js content, safe resource previews, workflows, reports, and workspaces.

1. File upload and storage:
   - storage provider abstraction;
   - size limits;
   - MIME allowlists;
   - virus/malware scanning hook;
   - resumable upload only after basic storage is stable;
   - direct object storage access must never bypass runtime permissions.
2. Broad file formats:
   - SCORM 1.2;
   - SCORM 2004;
   - xAPI/Tin Can and LRS integration;
   - video/audio upload and streaming;
   - PDF/Office preview or conversion;
   - package manifest parsing;
   - content launch sandboxing.
3. Messaging:
   - internal private chats;
   - group chats;
   - limited/open messaging modes;
   - unread counters;
   - notification bundling;
   - email delivery.
4. These capabilities must use the same Object/workflow/report/notification primitives where possible and add dedicated infrastructure only where platform primitives are insufficient.

Acceptance:

- unsupported advanced formats remain honest placeholders before this phase;
- existing resource metadata is forward-compatible with storage/package descriptors;
- messenger settings do not ship before access rules, audit, retention, and notification behavior are defined.

## Implementation Order Recommendation

The practical order should be:

1. Phase 0.5, because the app template boundary must be clean before adding more published-app features.
2. Phase 0.6, because authoring and workflow UI must not be built on permissive frontend defaults or unsupported role scopes.
3. Phase 1, because app-side content authoring unlocks real LMS content.
4. Phase 2, because course content needs resource previews, while broad formats remain placeholders.
5. Phase 5, because current menu surrogates are visible quality issues.
6. Phase 10 seed expansion for resources, knowledge, and authoring.
7. Phase 3 sequence engine.
8. Phase 4 workflow actions.
9. Phase 7 operational modules.
10. Phase 8 reports/export.
11. Phase 9 full UI parity pass.
12. Phase 11/12 final test and docs hardening after each implemented slice, with a larger final sweep at the end.
13. Phase 13 only after the core LMS works without fake format/messenger claims.

This order produces visible, testable value early and avoids building reports or certificates on top of incomplete content/progress data.

## Risks and Mitigations

### Risk: Editor.js Package Coupling

Mitigation:

- extract the editor into a neutral shared package;
- forbid imports from `packages/universo-template-mui` into `packages/apps-template-mui`;
- keep renderer/editor UI helpers in the shared package and canonical block schemas in `@universo/types`;
- add a package-boundary test.

### Risk: JSON Config Sprawl

Mitigation:

- every new config shape gets a Zod schema;
- runtime accepts only parsed/normalized config;
- app control panel uses metadata-backed editors instead of raw JSON.

### Risk: LMS Hardcoding

Mitigation:

- each new runtime feature must name the generic primitive it improves;
- LMS template consumes the primitive through metadata;
- tests assert generic widget/data-source behavior, not only LMS labels.

### Risk: Unproven Seed Data

Mitigation:

- fixture contract must assert flows and row state changes;
- each primary area must have Playwright proof;
- screenshots must be reviewed for real UI quality.

### Risk: Unsafe Mutations

Mitigation:

- all domain SQL goes through `DbExecutor.query`;
- dynamic identifiers use `qSchema`, `qTable`, `qSchemaTable`, and `qColumn`;
- UPDATE/DELETE use `RETURNING`;
- zero-row mutations fail closed;
- workspace and role checks happen before mutation and inside the SQL predicate where relevant.

### Risk: Permission Drift Between Frontend and Backend

Mitigation:

- frontend permissions are only a UX filter and never the authority;
- missing or malformed permission payloads resolve to denied permissions;
- backend routes keep explicit permission checks for every mutation and report access;
- tests cover direct API bypass attempts for denied users.

### Risk: Unsupported Scoped Rules Widen Access

Mitigation:

- parse every declared scope through a single capability resolver;
- execute only scopes with implemented predicates;
- mark deferred scopes as fail-closed in the capability matrix;
- block app-control saves that try to activate unsupported scoped grants.

### Risk: Resource URL and Embed Injection

Mitigation:

- use shared safe URL schemas for resource sources, thumbnails, previews, and block embeds;
- allow only `http` and `https` URLs in early phases;
- reject credentials in URLs;
- require explicit embed allowlists and sandbox attributes before rendering embeds.

### Risk: Premature Advanced Format Claims

Mitigation:

- resource metadata can mention `scorm`, `file`, `document`, `audio`, and `video`, but unsupported launch modes must fail closed;
- product fixture must label unsupported resources as placeholders;
- no SCORM/xAPI/messenger UI should appear usable until Phase 13 behavior is implemented and tested.

## Definition of Done

The roadmap is complete when:

- app administrators can create and edit LMS content inside the published app;
- learners can consume content, complete modules, submit assignments, attend events, earn certificates, and see progress;
- learners can see achievements, points, badges, and leaderboard rank when gamification is enabled;
- instructors/reviewers/supervisors can act from role-specific pages;
- frontend and backend runtime permissions fail closed and cannot expose mutation controls from missing permission payloads;
- scoped role policies are either implemented with query/action/report predicates or explicitly fail closed;
- admins can configure menus, role policies, reports, workflow actions, and sequence policies without raw JSON;
- knowledge base and development plans are functional, not only seeded;
- reports are meaningful and exportable;
- workspace isolation is proven;
- MUI template style is consistent with the original dashboard;
- `packages/apps-template-mui` no longer imports `@universo/template-mui`;
- `Knowledge` and `Development` navigation opens real portal pages instead of surrogate operational collections;
- shared resource schemas reject unsafe URLs, credentialed URLs, unsupported MIME types, and unapproved embeds;
- advanced SCORM/xAPI/file/messenger capabilities are either fully implemented in the late phase or clearly hidden/marked unsupported;
- no schema/template version bump is required for the rebuilt LMS fixture;
- `tools/fixtures/metahubs-lms-app-snapshot.json` is regenerated by Playwright and imports cleanly into a fresh database;
- unit, integration, and Playwright tests cover the critical contracts;
- README and GitBook documentation are updated.
