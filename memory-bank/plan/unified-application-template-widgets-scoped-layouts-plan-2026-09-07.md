# Plan: Unified Application Template Widgets and Entity-Scoped Layout Selection

> Status: Implemented locally; final closeout evidence is recorded below
> Created: 2026-09-07
> Mode: PLAN -> IMPLEMENT
> Product-code changes: implemented in the current worktree
> QA status: previous storage, runtime-routing, lock, and UI-contract blockers
> were remediated; external standalone browser evidence remains environment-bound
> Primary brief: external MANAGER brief `unified-application-template-widgets-and-scoped-layouts-spec-2026-09-07.md` (not synchronized with the repository)
> Input: external MANAGER task input `2026-09-07-unified-template-widgets-scoped-layouts.md` (not synchronized with the repository)
> Research: `memory-bank/research/unified-application-template-widgets-scoped-layouts-research-2026-09-07.md`

## Overview

Implement a clean, target-aware layout contract for the Dashboard and
`marketing-page` templates. Extend the existing serializable widget/layout
definitions and template registries with shared capability metadata, semantic
placement, lifecycle, and lineage without forcing the two templates through one
renderer. Do not introduce a second registry or a parallel authoring model.

The implementation must resolve the effective layout before choosing a shell
or renderer. A metahub/application global Dashboard may therefore have a
Page/Object entity-scoped `marketing-page` composition, and the inverse must
also work. The same resolution policy must be used by metahub authoring,
application control-panel authoring, publication/snapshot materialization,
hosted runtime, and authenticated standalone runtime.

This is a clean break. The test database may be recreated, obsolete readers
and compatibility shims must not be retained, and the schema, snapshot, and
metahub-template versions must not be increased. Existing marketing lifecycle
coverage is reused and extended; it is not replaced by a second parallel
runtime.

## QA disposition and traceability

This plan was reviewed against the brief, the original input, the research
artifact, current source, current package boundaries, Context7 documentation,
official MUI/TanStack Query/Playwright guidance, and read-only Subagent reviews.
The review found a sound high-level direction but several implementation
blockers. The plan is updated in this file; product code and test data were not
changed.

| Requirement from input/brief/research                                                 | Plan coverage and implementation gate                                                                                                                                                          |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One neutral contract, separate Dashboard/marketing renderers                          | Extend `LAYOUT_WIDGET_DEFINITIONS`, `LAYOUT_ZONE_DEFINITIONS`, `APPLICATION_TEMPLATE_REGISTRY`, and existing template types; keep adapters separate (Phases 1, 4, 5)                           |
| Shared versus template-only widgets, including `languageSwitcher`                     | Reuse the existing runtime `LanguageSwitcher`, define one host capability contract, and cover authoring plus both adapters; product may explicitly reject this capability at Phase 0 (Phase 5) |
| Common semantic zones without renaming physical storage silently                      | Metadata-only semantic mapping to existing physical zones; unknown zones fail closed and no new persisted zone is invented (Phases 1, 4)                                                       |
| Dashboard `top`/`bottom` loss                                                         | Trace SQL → response schema → `Dashboard` props → existing shell/main stack → browser DOM, with an explicit owner table and no `left` fallback (Phases 4, 8)                                   |
| Metahub and application global/entity scopes                                          | Separate authoring and runtime contracts, Page/Object target matrix, server-side authorization and materialization lineage (Phases 2, 3, 6, 8)                                                 |
| Cross-template entity selection without incompatible inheritance                      | Self-contained independent selected layout, validated using existing fields/config; no application `base_layout_id` is assumed (Phases 0, 2, 3)                                                |
| Seed/copy/publication/snapshot/restore/materialization/sync/reset/conflict/RBAC       | Full-graph preflight, atomic write/rollback, explicit UUID/remap rules, publication identity, direct API negatives, and two-session database tests (Phases 3, 8)                               |
| Fail-closed behavior and UUID v7                                                      | No silent filtering/remapping; validate every ingress and allocate fresh physical UUID v7 values for new rows (Phases 2, 3, 8)                                                                 |
| No schema/template version bump, no obsolete compatibility code, no GuestApp contract | Decision gate and final closeout explicitly verify these constraints; old in-repo targetless callers/routes are removed atomically (Phases 0, 4, 10)                                           |
| Existing MUI look-and-feel, package isolation, i18n and documentation                 | Reuse actual authoring/runtime primitives, keep `apps-template-mui` isolated, centralize common copy, and update EN/RU GitBook docs after evidence (Phases 5, 6, 7, 9)                         |

No new browser or product test evidence exists at PLAN/QA time. Existing
marketing-page evidence does not close the new cross-template matrix. Any
future PASS claim must name the exact spec, command, locale/theme/viewport,
fixture, and screenshot/trace artifact.

## Scope and non-goals

### In scope

-   One neutral, typed widget/layout envelope and capability view derived from
    the existing registries.
-   Explicit semantic-region to template-specific physical-zone mapping.
-   Target-first effective-layout resolution for global, Page, and Object targets.
-   Independent cross-template entity layouts plus existing same-template sparse
    overlays as separate modes.
-   Metahub global/entity authoring and application global/entity authoring.
-   Dashboard `top` and `bottom` transport and rendering.
-   One proposed `languageSwitcher` capability implemented by both hosts under
    the same locale, action, focus, and labeling contract after Phase 0 approval.
-   Hosted and authenticated standalone runtime parity.
-   Strict validation, typed fail-closed errors, authorization, publication
    visibility, optimistic concurrency, and UUID v7 lineage.
-   Jest, Vitest, real-database integration tests, Playwright flows, responsive
    screenshots, accessibility checks, and GitBook documentation.

### Explicit non-goals

-   No new built-in entity kind. Use the existing Hub/Object/Page/Set/
    Enumeration foundations.
-   No universal React renderer. Dashboard and marketing renderers remain
    separate adapters with shared contracts.
-   No public or anonymous GuestApp marketing contract in this slice. It remains
    `DEFERRED` until a separate transport, authorization, cache, and browser
    acceptance is specified.
-   No visual redesign of the official MUI Dashboard or marketing baseline.
    Reuse `.backup/templates` as provenance and preserve the isolated
    `packages/universo-react-apps-template-mui` boundary.
-   No new database migration, schema-version increase, snapshot-version
    increase, or metahub-template-version increase.
-   No client-controlled table, column, schema, or physical-source selector.
-   No targetless runtime-template fallback that can render a stale global
    template for an entity-targeted request.

## Recommended decisions to approve before implementation

These decisions turn the research handoff into an implementation contract.
They should be confirmed in discussion before Phase 1 code is started.

1.  **Effective precedence**

        - The normalized runtime target is `targetKind = null` for global,
          `page` for a Page entity type, or `object` for an Object entity type.
        - `entityTypeId` and `entityTypeCodename` are mutually exclusive.
        - `recordKey` selects content only; it never selects a layout.
        - In metahub authoring, an active entity-scoped default wins over the active
          global default for the same entity type.
        - In application runtime, an active application entity-scoped default wins
          over the active application global default. The application runtime never
          queries the metahub as a hidden fallback.
        - `workspaceId` is an authorization/content context in this MVP, not a
          second layout scope. Its visibility is checked server-side and it is
          present in the request/cache identity when response data depends on it.
        - Publication/snapshot materialization must contain every application
          candidate needed by runtime. Missing or stale materialization is a typed
          conflict, not a fallback.
        - The fixed source chain is metahub canonical layout -> published
          publication/version snapshot -> application materialization -> runtime
          application entity/global selection. The metahub layout is provenance
          after publication, not a hidden runtime candidate.

2.  **Cross-template composition**

    -   Same-template entity layouts may remain sparse overlays with inherited
        widgets and `source_base_widget_id` lineage.
    -   A scoped layout whose template differs from its global/base template is an
        independent, self-contained composition. It has no incompatible inherited
        widgets and no fabricated `source_base_widget_id`.
    -   `source_layout_id` may retain provenance to the selected metahub layout;
        it is not a hidden runtime fallback or an overlay base.
    -   The current application DDL is authoritative: `_app_layouts` has no
        `base_layout_id` column and `_app_widgets` has no separate semantic
        instance-identity column. The existing metahub `base_layout_id` remains
        a canonical authoring/snapshot lineage field, but the application
        materialization contract must not pretend that a physical application
        base FK exists.
    -   Store `compositionMode: "overlay" | "independent"` only in the
        validated existing layout configuration envelope if the current
        snapshot/materialization parser can round-trip it without a version
        change. Same-template overlay lineage is proven by the existing
        `source_layout_id`/`source_base_widget_id` graph; an independent layout
        is self-contained, has `source_base_widget_id = NULL`, and may retain
        `source_layout_id` solely as provenance. If this cannot be proven in the
        Phase 0 round-trip, update the existing snapshot-v1 serializer and
        validator so `baseLayoutId` is required for `overlay` and explicitly
        `null` for `independent`; do not increment the snapshot version. The
        application materializer then consumes the same v1 envelope without
        adding an application base column. Never add a hidden column, silently
        drop rows, or claim overlay semantics without the graph proof.
    -   Use the existing layout/widget/config/lineage fields. Missing base rows,
        mismatched template lineage, or an ambiguous source graph produce
        `LAYOUT_PERSISTED_INVALID` (409); they are never silently skipped.
    -   The implementation must first verify the current DDL nullability and
        materialization assumptions. If independent rows cannot be represented
        without a schema change, stop at the decision gate instead of inventing a
        silent compatibility mode.

3.  **Semantic regions and physical mappings**

    Use a small logical vocabulary and keep physical storage names explicit:

    | Semantic region | Dashboard physical zone | Marketing physical zone |
    | --------------- | ----------------------- | ----------------------- |
    | `header`        | `top`                   | `marketing-header`      |
    | `main`          | `center`                | `marketing-main`        |
    | `footer`        | `bottom`                | `marketing-footer`      |
    | `sidebar`       | `left`                  | unsupported in the MVP  |
    | `auxiliary`     | `right`                 | unsupported in the MVP  |

    The registry must validate the mapping; no layer may silently treat an
    unknown zone as `left`, `center`, or another valid zone.

4.  **Shared widget policy**

    Ratify current marketing repeatability metadata as the MVP default: every
    registered marketing instance remains repeatable unless its manifest says
    otherwise. Physical rows still receive unique UUID v7 IDs and marketing
    instances retain distinct semantic `instanceKey` values.

    Make `languageSwitcher` the first proposed shared capability in this MVP,
    pending the Phase 0 product decision. It is registered for Dashboard `top`
    and marketing `header`, and both adapters must provide locale state, a
    locale-change action, keyboard/focus behavior, accessible labeling, and
    theme-safe presentation. If the capability is approved but either host
    cannot satisfy that contract, creation/validation fails with
    `LAYOUT_CAPABILITY_UNSUPPORTED`; the widget is never silently dropped or
    conditionally omitted. If the capability is rejected, remove it from the
    acceptance matrix with an explicit reason. A common string key alone is
    not sufficient.
    Dashboard data widgets and marketing content widgets remain
    template-specific until a later capability review.

5.  **Runtime API contract**

    Replace the targetless bootstrap contract with one target-aware effective
    layout read model. All in-repository callers move atomically; no legacy
    endpoint is kept as a fallback source. The concrete route is
    `GET /:applicationId/runtime/effective-layout` under the existing
    applications route registration. `/runtime/marketing-page` remains a
    content-hydration endpoint and `/runtime` remains a data endpoint; neither
    is allowed to make an independent template decision.

    The response must include `sourceKind` as lineage (`metahub` or
    `application`), the immutable publication identity when the selected row is
    publication-backed, and the application materialization hash. A
    materialized application runtime may legitimately contain a metahub-source
    row; `sourceKind` is not a permission or executor selection. The current
    canonical names are `publicationId`, `publicationVersionId`, and
    `snapshotHash`; do not invent `releaseId`, a new publication column, or a
    new version. A runtime response is valid only when publication identity,
    source lineage, target, and effective hash are mutually consistent.
    Publication-backed rows require a non-null exact snapshot identity;
    explicitly application-owned rows may return `publicationIdentity: null`
    and must not be mixed with stale publication rows.

    The normalized request identity is:

    ```ts
    export type RuntimeTargetInput =
        | {
              applicationId: string
              targetKind: null
              entityTypeId?: never
              entityTypeCodename?: never
              workspaceId?: string
              locale: string
              themeVariant?: 'light' | 'dark' | 'system'
          }
        | {
              applicationId: string
              targetKind: 'page'
              entityTypeId: string
              entityTypeCodename?: never
              workspaceId?: string
              locale: string
              themeVariant?: 'light' | 'dark' | 'system'
          }
        | {
              applicationId: string
              targetKind: 'page'
              entityTypeId?: never
              entityTypeCodename: string
              workspaceId?: string
              locale: string
              themeVariant?: 'light' | 'dark' | 'system'
          }
        | {
              applicationId: string
              targetKind: 'object'
              entityTypeId: string
              entityTypeCodename?: never
              workspaceId?: string
              locale: string
              themeVariant?: 'light' | 'dark' | 'system'
          }
        | {
              applicationId: string
              targetKind: 'object'
              entityTypeId?: never
              entityTypeCodename: string
              workspaceId?: string
              locale: string
              themeVariant?: 'light' | 'dark' | 'system'
          }
    ```

    `recordKey` is a content-hydration input, not part of the layout selector.
    The effective-layout request therefore excludes it from every variant. The
    existing marketing content request may continue to carry a separately
    validated `recordKey` where its content contract requires one; it must not
    alter the effective-layout query key or renderer choice. Runtime validation
    must enforce the five-way layout contract, valid UUID v7 where an ID is
    accepted, and no unknown input fields.

6.  **Stable error contract**

    Use stable public codes and localized presentation:

    | Condition                                                                                         | HTTP status | Public code                     |
    | ------------------------------------------------------------------------------------------------- | ----------: | ------------------------------- |
    | malformed query/body, unknown fields, duplicate selectors                                         |         400 | `LAYOUT_REQUEST_INVALID`        |
    | unknown widget/zone/config in a submitted mutation                                                |         400 | `LAYOUT_PAYLOAD_INVALID`        |
    | unsupported widget capability or semantic placement in a submitted mutation                       |         400 | `LAYOUT_CAPABILITY_UNSUPPORTED` |
    | missing authentication                                                                            |         401 | `UNAUTHORIZED`                  |
    | forbidden application/entity/workspace/record                                                     |         403 | `LAYOUT_TARGET_FORBIDDEN`       |
    | absent Page/Object target or target-kind mismatch                                                 |         404 | `LAYOUT_TARGET_NOT_FOUND`       |
    | duplicate/ambiguous/missing required default                                                      |         409 | `LAYOUT_DEFAULT_INVALID`        |
    | unknown widget/zone/config in persisted data, missing base, stale lineage, or invalid publication |         409 | `LAYOUT_PERSISTED_INVALID`      |
    | stale version, duplicate semantic identity, or concurrent mutation                                |         409 | `LAYOUT_CONFLICT`               |
    | database/runtime read failure                                                                     |         503 | `LAYOUT_RUNTIME_QUERY_FAILED`   |

    These names are the proposed stable public contract. Phase 0 must approve
    them; after approval they are immutable for this slice. Every controller,
    API schema, localized error map, Jest test, and Playwright oracle must
    change together; existing marketing-specific aliases are removed in the
    clean break. Stored corruption must never become an empty successful
    response.

## Ownership and package boundaries

| Boundary                                | Responsibility                                                                                                                  | Must not own                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `@universo-react/types`                 | serializable template/widget/region/target/result types, discriminated unions, UUID/lineage field types                         | React rendering, database queries, user-facing copy                          |
| `@universo-react/utils`                 | genuinely shared pure normalization, canonical runtime query identity, UUID v7 helpers, stable envelope validation/hash helpers | feature-specific SQL or renderer behavior                                    |
| `@universo-react/i18n`                  | shared EN/RU language-switcher, region/state/error keys when truly common                                                       | unregistered feature namespaces or raw internal labels                       |
| `@universo-react/metahubs-backend`      | canonical template registry, seed, metahub layout rules, publication/snapshot source validation                                 | application runtime fallback                                                 |
| `@universo-react/metahubs-frontend`     | metahub layout list/detail authoring and localized scope/template UX                                                            | runtime renderer or client-side authorization                                |
| `@universo-react/applications-backend`  | application layout stores, materialization, effective resolver, runtime API, publication visibility, RLS/RBAC                   | direct Supabase client calls or client-supplied physical identifiers         |
| `@universo-react/applications-frontend` | control-panel authoring, target-aware API hooks, query keys, invalidation, error UX                                             | independent renderer implementation                                          |
| `@universo-react/apps-template-mui`     | published MUI shells, Dashboard/marketing adapters, runtime loading/error states, standalone host                               | imports from `template-mui`, `metahubs-frontend`, or `applications-frontend` |
| `docs/` and package READMEs             | approved contract, operational commands, screenshots/provenance, EN/RU parity                                                   | claims not backed by executable evidence                                     |

The existing `apps-template-mui` package-boundary test and
`check:apps-template-isolation` remain mandatory. Shared UI behavior may be
shared through a stable neutral package only; duplicating a small template
adapter is preferable to reintroducing a legacy package dependency.

## Affected areas and likely files

### Contract and validation

-   `packages/universo-react-types/src/common/layoutWidgetDefinitions.ts`
-   `packages/universo-react-types/src/common/applicationLayouts.ts`
-   `packages/universo-react-types/src/common/applicationTemplates.ts`
-   `packages/universo-react-types/src/common/metahubs.ts`
-   `packages/universo-react-types/src/common/marketingPage.ts`
-   `packages/universo-react-types/src/index.ts`
-   shared validation/hash/UUID modules in `packages/universo-react-utils/src/`
-   `packages/universo-react-applications-backend/src/shared/`
-   `packages/universo-react-schema-ddl/src/SchemaGenerator.ts` for read-only
    nullability/publication verification; do not add a migration or version bump

### Metahub seed, snapshot, and authoring

-   `packages/universo-react-metahubs-backend/src/domains/templates/data/`
-   `packages/universo-react-metahubs-backend/src/domains/templates/services/`
-   `packages/universo-react-metahubs-backend/src/domains/layouts/services/MetahubLayoutsService.ts`
-   `packages/universo-react-metahubs-backend/src/domains/shared/snapshotLayouts.ts`
-   `packages/universo-react-metahubs-backend/src/domains/publications/services/SnapshotSerializer.ts`
-   `packages/universo-react-metahubs-backend/src/domains/publications/services/marketingSnapshotValidation.ts`
-   `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/LayoutList.tsx`
-   `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/LayoutDetails.tsx`
-   `packages/universo-react-metahubs-frontend/src/domains/layouts/hooks/mutations.ts`

### Application persistence, resolver, and runtime

-   `packages/universo-react-applications-backend/src/persistence/applicationLayoutsStore.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncHelpers.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncLayoutPersistence.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncDataLoader.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncEngine.ts`
-   `packages/universo-react-applications-backend/src/services/` for the new
    effective resolver
-   `packages/universo-react-applications-backend/src/controllers/runtimeRowsController.ts`
-   `packages/universo-react-applications-backend/src/controllers/runtimeMarketingPageController.ts`
-   `packages/universo-react-applications-backend/src/controllers/applicationLayoutsController.ts`
-   `packages/universo-react-applications-backend/src/routes/applicationsRoutes.ts`
-   `packages/universo-react-applications-backend/src/shared/runtimeHelpers.ts`
-   `packages/universo-react-applications-backend/src/services/publishedApplicationRuntimeSnapshot.ts`
-   `packages/universo-react-applications-backend/src/utils/applicationLayoutHash.ts`

### Control panel and published runtime

-   `packages/universo-react-applications-frontend/src/pages/ApplicationLayouts.tsx`
-   `packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx`
-   `packages/universo-react-applications-frontend/src/pages/application-layouts/ApplicationLayoutListDialogs.tsx`
-   `packages/universo-react-applications-frontend/src/pages/application-layouts/ApplicationLayoutListMenu.tsx`
-   `packages/universo-react-applications-frontend/src/components/ApplicationMarketingAppearancePanel.tsx`
-   `packages/universo-react-applications-frontend/src/api/queryKeys.ts`
-   `packages/universo-react-applications-frontend/src/api/`
-   `packages/universo-react-apps-template-mui/src/api/api.ts`
-   `packages/universo-react-apps-template-mui/src/standalone/DashboardApp.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/Dashboard.tsx`
-   `packages/universo-react-apps-template-mui/src/dashboard/components/widgetRenderer.tsx`
-   `packages/universo-react-apps-template-mui/src/marketing-page/MarketingRuntimeContent.tsx`
-   `packages/universo-react-apps-template-mui/src/marketing-page/MarketingWidgetRenderer.tsx`
-   `packages/universo-react-apps-template-mui/src/components/LanguageSwitcher.tsx`
-   `tools/testing/e2e/support/browser/runtimeUx.ts`
-   `tools/testing/e2e/runApplicationLayoutsConcurrencyLocalSupabase.mjs`
-   `tools/testing/e2e/runCrossTemplateVerificationLocalSupabase.mjs`
-   `tools/testing/e2e/runCrossTemplateStandalone.mjs`
-   `tools/testing/e2e/runCrossTemplateVisualLocalSupabase.mjs`
-   root `package.json` scripts for the focused wrappers and static gate

## Runtime UI UX Contract

This contract is a release gate for every authoring and runtime surface.

### Authoring surfaces

-   Show localized human names for template, scope, entity type, source, and
    state. Never show UUIDs, `instanceKey`, hashes, source IDs, physical table
    names, raw widget keys, or JSON in normal lists/cards/dialogs.
-   The create flow must ask whether the layout is global or entity-scoped,
    show only authorized Page/Object choices, and explain whether the selected
    composition is inherited same-template overlay or independent cross-template.
-   Template identity is immutable after creation. A user selects the template
    while creating a new independent scoped layout; editing an existing layout
    must not pretend that changing its template is a safe mutation.
-   Use existing layout list/detail/card/dialog/row-action primitives. Support
    add, configure, duplicate, reorder, activate/deactivate, reset, exclude,
    and delete with localized confirmation and conflict recovery.
-   Render localized state chips or descriptions for global, scoped, inherited,
    independent, overridden, excluded, inactive, source-updated, missing-base,
    forbidden, invalid, and stale/conflict states.
-   Long descriptions, summaries, notes, content, and instructions use
    multiline controls. Resource/media fields use a human label/preview and a
    quiet optional-empty state.
-   Human-readable reference labels are used in controls; raw IDs remain
    read-only or hidden and are never an editable workflow requirement.

### Published runtime

-   Resolve target, scope, layout, template, lineage, and precedence before
    shell/renderer initialization.
-   Dashboard and marketing use separate adapters while sharing only the
    validated neutral envelope and compatible capabilities.
-   Use semantic `header/banner`, named `nav`, one clear `main`, and
    `contentinfo/footer` landmarks. Repeated navigation/footer landmarks must
    have meaningful accessible names.
-   Fixed AppBars account for their flow offset with the existing MUI pattern;
    mobile Drawer/menu controls expose `aria-expanded` and `aria-controls`,
    close on Escape where appropriate, and return focus to the trigger.
-   Every state has localized loading, optional-empty, invalid, forbidden,
    target-missing, and retry behavior. Raw Zod, SQL, API, object, ID, and
    internal error text is forbidden in normal UI.
-   External URLs, anchors, email/telephone actions, and media use existing safe
    normalization. No `javascript:`, placeholder `#`, credential-bearing URL,
    raw URL dump, or unsafe media fallback.
-   There is no document-level horizontal overflow at
    `1920x1080`, `768x1024`, or `390x844`. Internal DataGrid scrolling is
    allowed only inside its own bounded container.

### Per-surface UI contract and browser oracle

Every surface named below must have a focused component test and a browser
oracle where it is user-visible. The generic rules above are not a substitute
for these surface-specific assertions.

| Surface                                      | Required controls and display                                                                                      | Hidden technical data                                      | Required oracle                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Metahub `LayoutList`                         | localized scope/template filter, source/state chips, create-independent action, human entity names                 | UUIDs, hashes, physical zones/table names, raw widget keys | role/name selection, authorized choices, empty/loading/error states, no leakage                                         |
| Metahub `LayoutDetails`                      | typed widget editor, semantic zone headings, add/configure/duplicate/reorder/activate/reset                        | raw config JSON, source IDs, instance keys                 | keyboard reorder fallback, multiline controls, resource empty state, localized validation, conflict recovery            |
| Application `ApplicationLayouts`             | global/entity scope readback, immutable template label, explicit independent-create action, source lineage state   | application/layout/widget IDs and hashes                   | create/readback after sync, inherited/independent/conflict states, mutation invalidation                                |
| `ApplicationLayoutListDialogs` create/edit   | localized name/description, explicit global/entity mode, authorized Page/Object picker, immutable template on edit | API/Zod text, IDs, payload JSON                            | real invalid submission, `aria-invalid`, EN/RU copy, multiline description, dialog focus/Escape/return                  |
| `ApplicationLayoutListMenu` and `useConfirm` | copy/reset/exclude/delete actions with consequence text and pending state                                          | IDs, payload JSON, internal error text                     | destructive confirmation, focus return, conflict/retry, no accidental action on Escape                                  |
| `ApplicationMarketingAppearancePanel`        | existing theme/color/action/reset controls remain consistent with layout selection                                 | raw config, IDs, internal error text                       | settings/reset state, localized validation, no layout/template drift                                                    |
| Metahub conflict/config dialogs              | existing widget config and conflict editors with human metadata fallbacks                                          | raw widget key, variant, UUID attribution                  | unknown metadata/conflict state has localized generic copy and no technical leakage                                     |
| Hosted `ApplicationRuntime`                  | target-aware loading/error/retry and selected shell                                                                | response envelope, target IDs, hashes                      | network target identity before renderer, target switch isolation, landmarks, no overflow                                |
| Standalone `DashboardApp`                    | the same target-aware shell contract through the standalone host                                                   | response envelope, target IDs, hashes                      | provisioned standalone run, target switch, locale/theme, error and responsive assertions                                |
| Dashboard adapter                            | five physical zones and logical region labels, existing table/card/menu/action primitives                          | raw widget key/config and UUID-only labels                 | top/bottom visible in the existing shell/main stack, valid mapping, unknown-zone fail-closed, bounded grid/table scroll |
| Marketing adapter                            | header/main/footer semantics, existing marketing composition, shared capability slots                              | instance keys, source IDs, raw records/object text         | selected scoped template, working language switcher, safe actions/media; unsupported capability fails the MVP           |
| Shared `languageSwitcher`                    | accessible locale control, current locale, keyboard and focus behavior                                             | locale codes only as hidden state, no internal keys        | both adapters, EN/RU change, `aria` contract, focus return, theme behavior                                              |

Delete, reset, exclude, and destructive copy flows must reuse the repository's
existing dialog/form/confirmation primitives (`EntityFormDialog`,
`ConfirmDeleteDialog`, `FormDialog`, or the established package-local
equivalent) instead of introducing a new generic dialog. The current
application create/edit surface is a real plain-MUI `Dialog`, so either migrate
it to an existing compatible primitive or explicitly bring it to the same
accessible contract. The contract includes an accessible title, localized
consequence text, standard footer spacing, no hidden technical fields,
disabled pending state, Escape behavior, and focus return. Add a dedicated
browser oracle for these actions.

For any DataGrid or table surface, assert both that the document/body width
does not exceed the viewport and that any permitted horizontal scrolling is
confined to the named bounded grid container. A page-level overflow pass alone
is insufficient.

### Existing runtime zone ownership

The response shape alone is not acceptance evidence. The implementation must
document and test this concrete ownership map against the current
`apps-template-mui` components:

| Physical zone | Existing runtime owner                                                                           | Required change                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `left`        | `SideMenu`/`SideMenuMobile`                                                                      | Preserve current widget renderer and menu behavior                                                                                                                                                                            |
| `top`         | existing `runtime-main-content`/`Header` area and the existing Dashboard `LanguageSwitcher` host | Add a typed top-widget collection to the existing `Dashboard` props; render it in the current main stack without creating a second shell/header. A persisted language-switcher instance must not duplicate the shell control. |
| `center`      | `MainGrid`                                                                                       | Preserve current cards/tables/widgets and data hydration                                                                                                                                                                      |
| `right`       | `SideMenuRight`/`SideMenuMobileRight`                                                            | Preserve current bounded side panel behavior                                                                                                                                                                                  |
| `bottom`      | existing `runtime-main-content`/main stack after `MainGrid`                                      | Add a typed bottom-widget collection to the existing `Dashboard` props; use the existing widget renderer and no new user-facing layout primitive                                                                              |

`AppNavbar` and `Header` already render the isolated package's
`components/LanguageSwitcher.tsx`. Marketing must reuse that same component
through the existing `marketing-page/components/AppAppBar.tsx` action area (a
small action-slot extension is allowed); do not create another switcher or
import authoring UI into `apps-template-mui`. The fixed AppBar/Toolbar offset
must remain consistent with the existing MUI shell.

The current authoring table is `FlowListTable`, not MUI DataGrid. Use the
existing `expectDataGridHorizontalScrollConstrained` only for actual DataGrid
surfaces. Add one shared `expectTableHorizontalScrollConstrained` oracle for
the named `FlowListTable` container if no existing table oracle covers it. It
must allow internal table scrolling while failing document-level overflow.

## Implementation and verification steps

### Phase 0 — Baseline, decision gate, and impact inventory

1. Record the worktree state and confirm that the plan task will not touch the
   pre-existing user changes or external MANAGER product artifacts.
2. Re-read the brief, input, research artifact, package READMEs, current
   application/entity layout guides, and MUI provenance files.
3. Verify the exact current DDL and DTO contract before designing a new field:
   `_app_layouts` currently has `scope_entity_id`, `source_layout_id`, source
   hashes, and sync-state fields but no `base_layout_id`; `_app_widgets`
   currently has source lineage fields but no semantic-instance column. Confirm
   the canonical snapshot envelope, nullability, and whether
   `compositionMode` can round-trip through seed → publish → snapshot → restore
   → materialize using only existing columns/config. The existing snapshot-v1
   envelope must encode `baseLayoutId: <UUID v7>` for same-template overlays
   and `baseLayoutId: null` for independent layouts; this is a contract
   correction within the current version, not a version bump. The metahub
   `base_layout_id` must not be copied into an application DTO unless its
   lineage meaning is proven.
4. Run OntoIndex freshness/search/context/impact checks. Because the worktree
   is dirty and the graph is indexed at HEAD, treat direct source inspection
   as authoritative for changed files and record the degraded evidence limit.
5. Run `node tools/lint-db-access.mjs` and inspect route-level auth,
   Origin, and CSRF middleware before finalizing the controller contract.
   Record separately whether authenticated HTTP requests without an `Origin`
   are allowed, how cookie-authenticated cross-origin requests are rejected,
   and how the plain-auth/internal sync boundary differs from the
   request-scoped applications route. Do not infer HTTP Origin safety from the
   WebSocket upgrade policy.
6. Approve all six decisions above, especially precedence, independent
   composition, the conditional languageSwitcher capability, standalone
   acceptance, publication visibility, and the exact public error codes.
   Phases 1–10 are blocked until each decision has an explicit accepted or
   rejected outcome; a rejected outcome that changes storage, versioning,
   GuestApp scope, or cache ownership returns to the brief.

**Exit criteria**

-   No implementation begins while a decision would require a hidden fallback,
    a schema/version bump, or a client-selected physical source.
-   The exact resolver input/output, error codes, source chain, and test matrix
    are accepted.

### Phase 1 — Existing registry extension, neutral contract, and strict boundaries

1. Extend the existing neutral definitions in
   `layoutWidgetDefinitions.ts`, `metahubs.ts`, `marketingPage.ts`,
   `applicationTemplates.ts`, and `applicationLayouts.ts`. In particular,
   reuse `LAYOUT_WIDGET_DEFINITIONS`, `LAYOUT_ZONE_DEFINITIONS`,
   `APPLICATION_TEMPLATE_REGISTRY`, and the existing widget-key/zone schemas;
   do not create a second registry, parallel capability manifest, or duplicate
   widget union. Keep physical zone unions complete: Dashboard
   `left/top/right/bottom/center`; marketing
   `marketing-header/marketing-main/marketing-footer`.
2. Add serializable types for target identity, scope, lineage, precedence,
   semantic region, capability requirements, effective widgets, and typed
   failures.
3. Keep configuration schemas in the appropriate validation boundary
   (`@universo-react/utils` when genuinely shared; otherwise the owning
   backend/template package). Add the missing strict `uuidV7Schema` wrapper
   around the existing UUID-v7 helper instead of assuming that a generic
   `.uuid()` schema is sufficient. Use strict parsing and exhaustive narrowing.

Example shape:

```ts
export type LayoutRuntimeErrorCode =
    | 'LAYOUT_REQUEST_INVALID'
    | 'LAYOUT_PAYLOAD_INVALID'
    | 'LAYOUT_CAPABILITY_UNSUPPORTED'
    | 'UNAUTHORIZED'
    | 'LAYOUT_TARGET_FORBIDDEN'
    | 'LAYOUT_TARGET_NOT_FOUND'
    | 'LAYOUT_DEFAULT_INVALID'
    | 'LAYOUT_PERSISTED_INVALID'
    | 'LAYOUT_CONFLICT'
    | 'LAYOUT_RUNTIME_QUERY_FAILED'

export type EffectiveLayoutResult =
    | {
          status: 'ok'
          target: RuntimeTarget
          scope: 'global' | 'entity'
          layout: {
              id: string
              templateKey: 'dashboard' | 'marketing-page'
              sourceKind: 'metahub' | 'application'
              sourceLayoutId: string | null
              compositionMode: 'overlay' | 'independent'
          }
          widgets: readonly EffectiveWidget[]
          precedence: readonly ('published-publication' | 'application-entity' | 'application-global' | 'metahub-provenance')[]
          publicationIdentity: {
              publicationId: string
              publicationVersionId: string
              snapshotHash: string
          } | null
          effectiveHash: string
      }
    | {
          status: 'failed'
          error: {
              code: LayoutRuntimeErrorCode
              httpStatus: 400 | 403 | 404 | 409 | 503
          }
      }
```

```ts
const runtimeCommon = {
    applicationId: uuidV7Schema,
    workspaceId: uuidV7Schema.optional(),
    locale: localeSchema,
    themeVariant: z.enum(['light', 'dark', 'system']).optional()
}

const RuntimeTargetSchema = z.union([
    z
        .object({
            ...runtimeCommon,
            targetKind: z.null(),
            entityTypeId: z.never().optional(),
            entityTypeCodename: z.never().optional()
        })
        .strict(),
    z
        .object({
            ...runtimeCommon,
            targetKind: z.literal('page'),
            entityTypeId: uuidV7Schema,
            entityTypeCodename: z.never().optional()
        })
        .strict(),
    z
        .object({
            ...runtimeCommon,
            targetKind: z.literal('page'),
            entityTypeId: z.never().optional(),
            entityTypeCodename: codenameSchema
        })
        .strict(),
    z
        .object({
            ...runtimeCommon,
            targetKind: z.literal('object'),
            entityTypeId: uuidV7Schema,
            entityTypeCodename: z.never().optional()
        })
        .strict(),
    z
        .object({
            ...runtimeCommon,
            targetKind: z.literal('object'),
            entityTypeId: z.never().optional(),
            entityTypeCodename: codenameSchema
        })
        .strict()
])

const parsed = RuntimeTargetSchema.safeParse(input)
if (!parsed.success) {
    return failWithPublicCode('LAYOUT_REQUEST_INVALID')
}
```

Export the schema and inferred type from the owning contract module. Aggregate
Zod issue paths for logs/tests without exposing the raw issue text. Request
parsing maps to `LAYOUT_REQUEST_INVALID`; mutation payload parsing is a
separate schema/boundary and maps unknown widget/zone/config submissions to
`LAYOUT_PAYLOAD_INVALID`. Do not expose internal Zod/SQL/object text to the
user; map public codes to registered EN/RU copy.

**Tests**

-   `packages/universo-react-types/src/__tests__/` for exhaustive type/zone/
    capability contracts.
-   `packages/universo-react-utils/src/**/__tests__/` for strict parsing,
    canonical target normalization, UUID v7 validation, stable hashing, and
    safe URL/media behavior.
-   Negative tests for unknown keys, mixed-template envelopes, duplicate
    selectors, unknown zones, unknown widgets, invalid IDs, and unsupported
    capability requirements.

**Exit criteria**

-   One source of truth defines every logical/physical mapping and widget
    capability.
-   Unknown or mixed data cannot pass a boundary by being coerced to a valid
    default.

### Phase 2 — Server-owned effective-layout resolver

1. Create a small service in `applications-backend` with two explicit entry
   points over one pure selection/validation core:
   `resolveEffectiveLayoutForRequest(requestExecutor, authContext, target)` for
   authenticated HTTP/preview reads, and
   `resolvePublishedLayoutForMaterialization(trustedExecutor, publicationContext)`
   for publication/snapshot/restore work. The first must use the existing
   request-scoped executor and application/workspace authorization; the second
   must receive an explicit ownership/publication context inside a trusted
   transaction and must never rely on a caller's HTTP RLS state. A pool
   executor is not a substitute for request authorization.
2. Resolve the target entity type and optional record/workspace visibility
   server-side. Permit Page and Object targets through the same policy, with
   an explicit lookup predicate `kind IN ('page', 'object')`. Reject a
   target-kind/entity-kind mismatch as `LAYOUT_TARGET_NOT_FOUND` (404), reject
   an ambiguous persisted selector as `LAYOUT_DEFAULT_INVALID` (409), and do
   not infer a Page from an Object codename or vice versa.
3. Apply the fixed source chain and precedence:

    | Stage | Source and rule                                                                                                 |
    | ----- | --------------------------------------------------------------------------------------------------------------- |
    | 1     | Metahub canonical layout is authoring/provenance only.                                                          |
    | 2     | Published publication/version snapshot is the immutable visibility boundary; drafts are excluded.               |
    | 3     | Application materialization contains the runtime candidates and lineage/hash copied from that snapshot.         |
    | 4     | For an entity target, application entity-scoped default wins; otherwise application global default is selected. |
    | 5     | Workspace/record data is authorized content only; it never supplies a layout fallback.                          |

    Do not use `recordKey` as a layout selector and do not query the metahub as
    a hidden application fallback. Missing or stale application materialization
    is a typed conflict, not a fallback. Publication-backed runtime candidates
    must carry the exact `publicationId`, `publicationVersionId`, and non-null
    `snapshotHash` that was materialized; explicitly application-owned
    candidates may have a null publication identity.

4. Validate the selected layout and every widget before returning it:
   template, composition mode, physical zone, capability, active state,
   source lineage, publication state, and configuration. Join the application's
   `last_synced_publication_version_id` with the installed publication metadata
   (`publicationId`, `publicationVersionId`, `snapshotHash`) and require each
   publication-backed selected row's `source_snapshot_hash` to agree with that
   installed hash. Explicitly application-owned rows may have a null
   publication identity, but must have `source_kind = 'application'` and no
   stale publication lineage. If the current metadata is absent, malformed, or
   inconsistent, return `LAYOUT_PERSISTED_INVALID` rather than mixing rows
   from different publications. Do not add publication columns to
   `_app_layouts` as a shortcut.
5. Return target identity, scope, selected layout, template, lineage,
   `sourceKind`, immutable `publicationIdentity`, materialization hash,
   precedence, effective widgets, and `effectiveHash`.

The mounted HTTP endpoint must reject a missing request session/context before
any application, workspace, entity, or record lookup. It must not use the
generic runtime helper's base-executor fallback. Internal publication and
materialization callers use the separate trusted entry point with explicit
ownership and publication context.

Example service boundary:

```ts
export async function resolveEffectiveLayoutForRequest(
    executor: DbExecutor,
    authContext: AuthenticatedApplicationContext,
    target: RuntimeTargetInput
): Promise<EffectiveLayoutResult> {
    const normalized = normalizeRuntimeTarget(target)
    const authorizedTarget = await resolveAuthorizedRuntimeTarget(executor, authContext, normalized)
    const candidates = await loadPublishedLayoutCandidates(executor, authorizedTarget)
    const selected = selectEffectiveCandidate(candidates, authorizedTarget)
    if (!selected) return failWithPublicCode('LAYOUT_DEFAULT_INVALID')

    const validated = validateMaterializedComposition(selected)
    if (!validated.ok) return failWithPublicCode(validated.code)

    return {
        status: 'ok',
        target: authorizedTarget,
        scope: selected.scopeKind,
        layout: selected.layout,
        widgets: validated.widgets,
        precedence: selected.precedence,
        publicationIdentity: selected.publicationIdentity,
        effectiveHash: hashEffectiveComposition(validated.widgets, selected.layout)
    }
}
```

All SQL remains schema-qualified and parameterized through a store. Dynamic
identifiers use the existing `qSchema`/`qTable`/`qColumn` helpers. The
resolver does not accept table names, column names, or schema names from the
request.

**Tests**

-   New `packages/universo-react-applications-backend/src/tests/services/effectiveLayoutResolver.test.ts`.
-   Page/Object/global matrix, same-template overlay, independent cross-template
    layout, deterministic fallback, ambiguous default, missing base, invalid
    lineage, invalid zone/widget, unauthorized target, missing target, draft
    publication, workspace visibility, and record-content-only behavior.
-   Assert `kind IN ('page', 'object')`, target-kind mismatch, ID/codename XOR,
    separate content-only `recordKey` handling, exact 400/403/404/409/503 public codes,
    `sourceKind`, publication identity, source lineage, selected precedence,
    materialization hash, and `effectiveHash`.
-   Assert exact response identity and `effectiveHash`, not just `templateKey`.

**Exit criteria**

-   Both hosted and standalone callers can consume the same server-owned result.
-   No runtime path chooses a renderer before this resolver returns.

### Phase 3 — Storage, copy, publication, snapshot, and materialization

1. Refactor metahub creation/validation and application persistence to permit
   an explicitly independent entity-scoped template while preserving
   immutable template identity per layout.
2. Keep same-template sparse overlay behavior separate from independent
   cross-template compositions. Never merge Dashboard physical zones with
   marketing zones by position.
3. In `syncHelpers.ts` and `syncLayoutPersistence.ts`, replace silent
   `continue` behavior for missing base/scope rows with a preflight failure.
   Validate the full graph before writing and wrap materialization in the
   existing transaction boundary so any error rolls back the whole operation.
   Move domain sync persistence off `getApplicationSyncKnex()`/`trx.raw` into
   explicit store modules using the repository's `DbExecutor` transaction
   boundary (pool executor only for the trusted publication context). Keep raw
   Knex confined to an explicitly documented infrastructure/DDL boundary and
   add a direct SQL contract test for schema qualification, `$1` bindings,
   `RETURNING`, and zero-row failure.
4. Remove `stableMaterializedWidgetId` and every other hash-derived physical
   ID path. Validate UUID v7 for explicit layout/widget/source/snapshot IDs at
   every ingress (authoring, sync, import, restore, copy, and materialization);
   database defaults alone are not sufficient. Apply this identity matrix:

    | Operation                                                            | Physical UUID/instance identity                                                                                                           | Lineage rule                                                                                                    |
    | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
    | In-place edit, reorder, activate/deactivate, reset, or same-row sync | Preserve the existing physical row UUID and semantic `instanceKey` for the same logical instance.                                         | Keep existing provenance and same-template base lineage.                                                        |
    | Duplicate/copy/import/restore into new rows or another application   | Allocate fresh server/database UUID v7 values, a fresh duplicate `instanceKey`, and an explicit old-to-new remap.                         | Preserve `source_layout_id`/`source_widget_id` provenance where valid; never turn provenance into inheritance.  |
    | Application materialization                                          | Allocate fresh UUID v7 rows for new materialized rows; preserve an existing physical UUID only for an explicitly matched same-row update. | `source_base_widget_id` is set only for real same-template inheritance; independent rows always keep it `NULL`. |
    | Same-store snapshot/roundtrip                                        | Preserve UUID/`instanceKey` only when the snapshot represents the same logical instance.                                                  | A restored new logical instance follows the duplicate/import rule.                                              |

    Every operation keeps an explicit old-to-new map. No physical identity is
    derived from a hash, and a semantic `instanceKey` is never used as a
    database primary key.

5. Verify publication reads from one immutable published snapshot/version
   identity. Draft, inactive, conflicted, or deleted layouts/widgets must not
   enter runtime responses. If the
   current publication path reads related rows separately, add a transaction
   or locked/hash-consistent read without adding a schema version. Validate
   snapshot graphs in two passes (index all layouts before resolving base
   references), require `is_active` and the exact publication/version/hash
   predicate in every reader, and reject an orphan or partial graph instead of
   filtering it out.
6. Retain existing optimistic version and replace the currently divergent
   advisory-lock domains with one documented transaction-wide protocol. The
   proposed MVP order is an application-level advisory lock first, then
   `scope -> layout -> widget/semantic instance`; all authoring, sync,
   publication/materialization writers that can touch the same application
   must use the same namespace and order. Do not claim that the current
   scope-only UI lock and application-wide sync lock are already equivalent;
   either unify them or block the gate. Apply the protocol to duplicate,
   default-selection, reorder, reset, and materialization operations; do not
   acquire a lower-level lock before a higher-level lock.
   Convert stale versions, duplicate semantic identity, duplicate defaults,
   and lineage conflicts into the exact `LAYOUT_CONFLICT` or
   `LAYOUT_DEFAULT_INVALID` 409 code.
   Because no application semantic-instance column or new index is allowed in
   this slice, every writer must perform the duplicate `instanceKey` check
   inside this common application lock and transaction; sync/import/restore
   cannot bypass it. The integration test must demonstrate that two database
   connections cannot create the same active semantic instance concurrently.

Example mutation pattern:

```ts
await executor.transaction(async (tx) => {
    await lockApplicationLayoutApplication(tx, applicationId)
    await lockApplicationLayoutScope(tx, applicationId, scopeEntityId)
    const current = await getLayoutVersion(tx, layoutId)
    assertExpectedVersion(current.version, expectedVersion)

    const remap = new Map<string, string>()
    const compositionMode = validatedLayout.compositionMode
    for (const sourceWidget of validatedWidgets) {
        const newWidgetId = await allocateUuidV7(tx)
        remap.set(sourceWidget.id, newWidgetId)
        await insertWidget(tx, {
            id: newWidgetId,
            layoutId,
            sourceWidgetId: sourceWidget.sourceWidgetId,
            sourceBaseWidgetId: compositionMode === 'overlay' ? remap.get(sourceWidget.sourceBaseWidgetId ?? '') ?? null : null,
            config: sourceWidget.config
        })
    }
    await touchLayoutWithReturning(tx, layoutId, expectedVersion)
})
```

The example is illustrative: the actual store must use the repository's
`DbExecutor` transaction API, explicit columns, bind parameters, and
`RETURNING`, and must fail closed on zero-row mutations.

**Tests**

-   Extend `syncLayoutMaterialization.test.ts` and `syncLayoutPersistence.test.ts`.
-   Extend `applicationLayoutsStore.test.ts` for independent scope, lineage,
    copy/remap, operation-by-operation UUID/`instanceKey` identity, stale
    version, duplicate default, lock ordering, and rollback.
-   Extend publication/snapshot validators and roundtrip tests.
-   Update the existing snapshot-v1 serializer/validator tests so overlay rows
    require a UUID-v7 `baseLayoutId`, independent rows require explicit null,
    and layout ordering does not affect reference validation (index first,
    resolve second). No snapshot-version increment or legacy compatibility
    branch is allowed.
-   Add real local-Postgres/Supabase integration coverage at
    `packages/universo-react-applications-backend/src/tests/integration/applicationLayoutsConcurrency.test.ts`
    for parallel create/duplicate/reorder/default selection, authoring versus
    sync/materialization, publication read versus materialization write,
    separate database connections, deadlock timeout, exact 409 conflict codes,
    and rollback. Run it through the dedicated minimal-Supabase wrapper
    described in Phase 8; a mocked executor is not sufficient evidence for the
    concurrency claim.

**Exit criteria**

-   A cross-template scoped composition survives seed -> publish -> sync ->
    materialize -> runtime without inherited incompatible widgets.
-   A missing base, malformed row, or publication inconsistency produces a typed
    failure and leaves no partial write.
-   Every new physical ID is UUID v7; no physical ID is derived from a hash.

### Phase 4 — Runtime transport and renderer dispatch

1. Remove the targetless `runtime/template` route, response schema, client
   fetcher, and stale query keys after a repository-wide caller/test inventory.
   Replace the call in the hosted
   `packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx`
   and standalone
   `packages/universo-react-apps-template-mui/src/standalone/DashboardApp.tsx`
   with `runtime/effective-layout`. This is an intentional clean break for the
   disposable test database: update all in-repository consumers atomically and
   do not add a compatibility alias or a second targetless cache namespace.
2. Ensure target query parameters are available before the first renderer
   decision, including Page targets (not only Object targets). Keep content
   hydration independent: `/runtime/marketing-page` may receive a separate
   content target/`recordKey`, but it must consume the already selected
   template/layout rather than selecting one itself. The backend content
   controller may call the same server-owned resolver for consistency or
   consume a server-validated effective-layout identity, but it must not keep a
   second global/scoped layout-selection algorithm or return a competing
   template identity.

    | Host/route                                           | Layout target input                                                                                 | Renderer decision                                                                         |
    | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
    | Hosted `ApplicationRuntime.tsx` root/marketing route | normalized global/Page/Object selector derived from the route and server-authorized entity metadata | effective-layout response chooses Dashboard or marketing adapter before content hydration |
    | Hosted workspace/entity route                        | same selector; `workspaceId` is auth/content context, not a hidden layout scope                     | selected application entity layout or explicit global default                             |
    | Standalone `DashboardApp.tsx` root/workspace route   | same target-aware request and query key as hosted runtime                                           | same adapter selection; no targetless 60-second bootstrap cache                           |
    | Content hydration                                    | separate validated `recordKey`/content context when supported                                       | never changes template or layout                                                          |

3. Make `runtimeRowsController.ts` transport all five Dashboard zones:
   `left`, `top`, `right`, `bottom`, `center`. Update API schemas and
   Dashboard adapters in the same change. Extend the existing `ZoneWidgets`
   and `Dashboard` props, `MainGrid`, `SideMenu`, `SideMenuRight`, and current
   `widgetRenderer` path only as required by the ownership table above; do not
   introduce a second dashboard shell. Unknown persisted zones must fail before
   the current `else -> left` normalization can run.
4. Use the manifest mapping to produce Dashboard and marketing adapter
   inputs. Unknown persisted zones/widgets and query failures produce typed
   `LAYOUT_PERSISTED_INVALID` (409) or `LAYOUT_RUNTIME_QUERY_FAILED` (503)
   responses; they must not be filtered, remapped, or replaced by empty data.
   Remove or demote the current `_app_settings`/boolean section fallback from
   the layout decision path; persisted widget composition is authoritative in
   this clean break. Remove warning-only widget-load continuation and the
   current unknown-zone-to-`left` branch.
5. Keep marketing content hydration separate from layout resolution. The
   selected layout decides the shell/template and widget composition; records
   remain workspace/content data. The runtime effective-layout response is the
   sole renderer-selection authority for both hosted and standalone paths.
6. Use allowlisted columns and bounded payloads. Do not log raw config, PII,
   credentials, request cookies, or user-supplied JSON.

**Tests**

-   Extend `runtimeRowsController.test.ts` and
    `runtimeMarketingPageController.test.ts`.
-   Remove/update the targetless `runtimeTemplateResponseSchema` and
    `fetchRuntimeTemplate` tests, and add the effective-layout API schema/query
    tests. Extend `src/api/__tests__/runtimeRows.test.ts` and add
    `src/dashboard/__tests__/Dashboard.crossTemplate.test.tsx`.
-   Add hosted and standalone component tests proving that a target change
    changes the request before the renderer changes.

**Exit criteria**

-   Dashboard top/bottom and marketing header/main/footer are visible in the
    appropriate adapter.
-   Global Dashboard + Page-scoped marketing and the inverse dispatch correctly
    in hosted and standalone paths.
-   Invalid persisted data never renders a misleading empty dashboard/marketing
    shell.

### Phase 5 — Shared-capability widgets and isolated MUI adapters

1. Extend the existing registry definitions with a capability view rather than
   creating a parallel manifest. A capability includes allowed templates,
   logical regions, physical mappings, configuration schema, data-binding role,
   required host services, repeatability, and accessibility contract. Existing
   `LAYOUT_WIDGET_DEFINITIONS`, `LAYOUT_ZONE_DEFINITIONS`, and
   `APPLICATION_TEMPLATE_REGISTRY` remain the source of truth.
2. Implement the approved `languageSwitcher` capability through the existing
   `apps-template-mui/src/components/LanguageSwitcher.tsx`. Dashboard continues
   to host it through the existing `AppNavbar`/`Header` action areas; marketing
   extends the existing `marketing-page/components/AppAppBar.tsx` action area
   to accept the same control. Do not create a second switcher or a new global
   toolbar. The adapters must use the same locale state/action contract and
   localized labels. If the Phase 0 decision rejects this capability, remove
   its acceptance cells and document the explicit exclusion; if approved, an
   unsupported host is a typed validation failure, not an optional omission.
3. Keep `detailsTable`, `relationBuilder`, `columnsContainer`, cards,
   menus, and row actions on existing `apps-template-mui` primitives where
   their capabilities are compatible. Do not add a one-off fork in a marketing
   renderer merely to display an incompatible Dashboard widget.
4. Use stable persisted widget IDs or semantic instance keys for React keys.
   Never use array indexes or random IDs during render.
5. Keep `apps-template-mui` imports free of the legacy template and feature
   packages. The package-boundary tests must continue to pass.

**Tests**

-   New `packages/universo-react-apps-template-mui/src/components/__tests__/LanguageSwitcher.crossTemplate.test.tsx`.
-   Reuse the existing package-boundary/isolation checks. Do not add a generic
    cross-package primitive-identity gate: `template-mui` authoring primitives
    and `apps-template-mui` runtime primitives intentionally live in different
    boundaries. If a new static check is needed, narrow it to concrete forbidden
    imports, duplicate primitives inside one package, or a known legacy fork;
    it must not require importing authoring UI into `apps-template-mui`.
-   Render the same language-switch capability in both adapters and verify
    keyboard, locale, focus, and theme behavior.

**Exit criteria**

-   The registry can reject unsupported placement with the exact localized
    `LAYOUT_CAPABILITY_UNSUPPORTED` error.
-   The language switcher works in both templates under the same contract; any
    inability to do so fails the MVP gate rather than creating a silent
    template-specific omission.

### Phase 6 — Metahub and application authoring UX

1. Extend `LayoutList` and `LayoutDetails` to show localized scope/template
   choices, independent versus inherited state, source/conflict state, and
   recovery actions. Reuse the existing route/prop scope context and existing
   human-readable entity selectors; do not invent a second layout workbench.
2. In the existing application create/edit dialog, add an explicit global vs
   entity-scoped mode and a human-readable authorized Page/Object picker. The
   picker has loading, empty, forbidden, and target-not-found states and never
   requires a UUID/codename entry. The template selector is available only for
   the explicit create-independent-scoped-layout operation; an existing
   layout's immutable template must not appear editable.
3. Reuse the existing layout authoring detail/list, item card, flow table,
   dialog, and row-action primitives. Do not expose internal layout IDs,
   physical zones, hashes, instance keys, or raw widget configs in normal
   UI.
4. Add localized validation for missing target, unsupported template/widget,
   invalid lineage, stale version, unauthorized scope, and publication
   conflict. Replace visible raw `widgetKey`, variant, UUID attribution,
   `Error.message`, and `String(error)` fallbacks in the existing
   `LayoutDetails`, `MarketingWidgetConfigDialog`, `ConflictResolutionDialog`,
   and `LayoutList` paths with localized generic metadata/error copy.
   Define blank-name behavior explicitly: either reject it with localized
   inline `aria-invalid` validation, or document the intentional auto-name
   behavior in the UI contract; never silently replace user input without an
   asserted contract.
5. Ensure dialogs have stable accessible names, keyboard reorder/fallback
   actions, predictable focus return, and no render-phase mutation under
   React StrictMode.
6. After mutations, await targeted query invalidation before showing success.

**Tests**

-   New focused `LayoutList.crossTemplate.test.tsx` and
    `LayoutDetails.crossTemplate.test.tsx` (or the package's existing test
    locations if its convention differs).
-   Extend `ApplicationLayouts.test.tsx`, mutation/query-key tests, and
    metahub layout component tests.
-   Extend the real create/edit `ApplicationLayoutListDialogs` tests, the
    `ApplicationLayoutListMenu`/`useConfirm` destructive flows, and the
    `ApplicationMarketingAppearancePanel` contract. Browser coverage must
    trigger invalid submissions in both EN and RU, assert visible localized
    copy plus `aria-invalid`, assert focus return, and call
    `expectNoTechnicalLeakage` with `checkUuidSubstrings: true` plus forbidden
    widget/variant/source patterns. Mocked renderer dispatch alone is not
    evidence for the actual `MarketingRuntimeContent` boundary.

**Exit criteria**

-   A normal user can create a Page/Object independent template without knowing
    UUIDs, codenames, hashes, or storage names.
-   The control panel readback proves the selected scope/template and source
    state after publication/sync.

### Phase 7 — Query identity, cache invalidation, and i18n

1. Extract one pure canonical target/key helper into
   `@universo-react/utils`, shared by hosted and standalone consumers.
   Normalize equivalent IDs/codenames, locale, workspace, and theme before key
   construction. `applications-frontend` and
   `apps-template-mui` may each wrap that neutral value in their local React
   Query key factory, but `apps-template-mui` must not import
   `applications-frontend`.
2. Use two explicit cache identities. The `effective-layout` key contains only
   inputs that can change layout selection/authorization (application, target
   selector, target kind, workspace when layout visibility depends on it, and
   any locale/theme input actually used by the envelope). The marketing/content
   key contains the separately validated `recordKey`, locale, workspace, and
   content inputs. Never put `recordKey` into the layout key merely because the
   content query uses it, and never use `['runtime-template', applicationId]`
   for a target-aware request.
3. Return and assert `effectiveHash` as a freshness token. Invalidate the
   targeted runtime prefix and related authoring queries after a mutation, and
   await invalidation before success.
4. Keep query key construction in the existing
   `applicationsQueryKeys`/apps-template API boundaries; both wrappers must
   use the same neutral canonical input and must not create a competing
   targetless cache namespace. Invalidation adapters remain local to each
   host's `QueryClient`.
5. Add all new shared labels, region names, state names, and public error
   messages to `@universo-react/i18n` with EN/RU parity. Feature-only copy
   remains registered by the owning package.

Example key:

```ts
// @universo-react/utils: pure value only; no React Query or package imports.
export const canonicalRuntimeTargetKey = (input: RuntimeTargetInput) =>
    ['applications', input.applicationId, 'runtime', 'effective-layout', normalizeRuntimeTarget(input)] as const
```

**Tests**

-   Extend `applications-frontend/src/api/__tests__/queryKeys.test.ts`.
-   Extend `ApplicationRuntime.test.tsx` and
    `apps-template-mui/src/standalone/__tests__/DashboardApp.test.tsx`.
-   Add network assertions proving application A/B, target A/B, locale,
    workspace, content `recordKey`, and theme do not share an incorrect
    response; assert that changing only `recordKey` does not refetch the
    effective layout.
-   Run EN/RU missing-key and documentation i18n checks.

**Exit criteria**

-   A target switch in one browser session cannot reuse a stale global renderer
    or another application's response.
-   No raw translation key or internal validation message is visible.

### Phase 8 — Full test and browser evidence system

#### Jest backend contract

Run the custom backend Jest wrapper through package scripts. Cover:

-   `@universo-react/applications-backend`
    -   `runtimeRowsController.test.ts`
    -   `runtimeMarketingPageController.test.ts`
    -   `applicationLayoutsController.test.ts`
    -   `applicationLayoutsStore.test.ts`
    -   `syncLayoutMaterialization.test.ts`
    -   `syncLayoutPersistence.test.ts`
    -   new `effectiveLayoutResolver.test.ts`
    -   new `integration/applicationLayoutsConcurrency.test.ts`
-   `@universo-react/metahubs-backend`
    -   `MetahubLayoutsService.test.ts`
    -   snapshot/publication/template-validator tests

Assertions must cover SQL bind parameters and schema qualification indirectly
through store tests, `RETURNING`/zero-row failures, RLS/RBAC/API bypasses,
CSRF/Origin policy where the route contract applies, publication visibility,
typed 400/401/403/404/409/503 responses, rollback, UUID v7, and lineage.

The security/API fixture matrix is mandatory: user A as owner/manager, user B as
member/read-only, a global-admin case, a second application, forbidden Page/Object entity types,
forbidden workspace and record contexts, direct HTTP calls that bypass the UI,
missing Origin, mismatched Origin, invalid CSRF, draft publication, and
cross-application IDs. Each negative case must assert the exact public status
and code without revealing whether an unauthorized target exists.
Add direct tests for the sync/publication trusted-executor boundary, active and
immutable publication predicates, two-pass snapshot reference validation,
explicit v4 rejection, duplicate semantic instance races, and the current
WebSocket Origin policy (missing, mismatched, and wildcard Origin). These are
separate from ordinary HTTP CORS/CSRF assertions.

#### Vitest frontend and runtime contract

Run focused Vitest suites for:

-   `@universo-react/types` contract/zone/capability tests.
-   `@universo-react/utils` target normalization, UUID v7, validation, hash,
    and URL/media tests.
-   `@universo-react/applications-frontend`
    `ApplicationLayouts.test.tsx`, `ApplicationRuntime.test.tsx`,
    `queryKeys.test.ts`, and mutation/cache tests.
-   `@universo-react/metahubs-frontend`
    `LayoutList.crossTemplate.test.tsx`,
    `LayoutDetails.crossTemplate.test.tsx`, existing inherited/copy/cache tests.
-   `@universo-react/apps-template-mui`
    API/runtime, Dashboard adapter, languageSwitcher, marketing adapter,
    standalone `DashboardApp`, and existing marketing lifecycle tests.

No test should assert only a low-level function while a browser-visible
contract remains untested. Unit/component tests are necessary, but browser
proof is authoritative for dispatch, UX, focus, leakage, and overflow.

#### Playwright browser matrix

Add or extend:

-   `tools/testing/e2e/specs/flows/application-layout-cross-template.spec.ts`
-   `tools/testing/e2e/specs/flows/application-layout-cross-template-permissions.spec.ts`
-   `tools/testing/e2e/specs/flows/cross-template-runtime.spec.ts`
-   `tools/testing/e2e/specs/flows/cross-template-standalone-runtime.spec.ts`
-   `tools/testing/e2e/specs/flows/metahub-layouts.spec.ts`
-   `tools/testing/e2e/specs/flows/metahub-global-entity-layouts.spec.ts`
-   `tools/testing/e2e/specs/flows/application-layout-management.spec.ts`
-   `tools/testing/e2e/specs/flows/marketing-page-snapshot-roundtrip.spec.ts`
-   `tools/testing/e2e/specs/matrix/marketing-page-visual.spec.ts`
-   `tools/testing/e2e/support/browser/runtimeUx.ts`

Required browser cells:

| Cell                                                    | Evidence                                                                                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Metahub global Dashboard + Page-scoped marketing        | Page target renders marketing regions; sibling/global target remains Dashboard                                   |
| Metahub global Dashboard + Object-scoped marketing      | Object target renders marketing; absent scope falls back deterministically                                       |
| Metahub global marketing + Page/Object-scoped Dashboard | Dashboard shell and all valid zones render                                                                       |
| Application global/entity materialization               | Control-panel readback, DB lineage readback, and hosted runtime agree                                            |
| Hosted target switch                                    | Network request changes before renderer; no targetless 60-second reuse                                           |
| Standalone target switch                                | Same target-aware response and UX contract; unavailable shell is recorded as `BLOCKED`, never accepted as a skip |
| Page/Object visibility and permissions                  | UI and direct API/RBAC/CSRF negatives both fail closed                                                           |
| Snapshot/publication/restore/sync                       | Independent composition, UUID remap, semantic instance identity, publication hash                                |
| Dashboard top/bottom                                    | Valid rows survive SQL, API schema, adapter, and visible renderer                                                |
| Invalid stored state                                    | 409/503 localized error; no empty successful fallback or partial write                                           |
| languageSwitcher                                        | Dashboard and marketing capability/locale/focus behavior; unsupported placement fails the MVP                    |
| Responsive UX                                           | EN/RU, light/dark where relevant, 1920x1080, 768x1024, 390x844                                                   |

Each row above is a family of cells, not one aggregate PASS. The evidence
manifest must enumerate at least surface × target kind × host × locale × theme
× viewport where applicable. In particular, visual claims must list the exact
four projects (`en-light`, `en-dark`, `ru-light`, `ru-dark`) and the three
viewport captures for each declared surface; authoring dialogs, Dashboard
top/bottom, target switching, conflict/invalid states, and standalone BLOCKED
state cannot be inferred from the existing marketing screenshot count.

Use the existing Playwright wrapper and fixtures:

-   `test`/`expect` from `tools/testing/e2e/fixtures/test`.
-   role/name and stable `data-testid` locators; no CSS implementation
    selectors unless the surface has no user-facing semantic alternative.
-   awaited web-first assertions and `expect.poll` for asynchronous provisioning.
-   Reuse the helpers that actually exist in `runtimeUx.ts`:
    `expectNoTechnicalLeakage`, `expectSemanticFieldControls`,
    `expectLocalizedValidation`, `expectNoPageHorizontalOverflow`,
    `expectNoDataGridTechnicalLeakage`, and
    `expectDataGridHorizontalScrollConstrained`. For authoring's
    `FlowListTable`, add one focused `expectTableHorizontalScrollConstrained`
    helper only if no existing table oracle is found. Landmarks, focus return,
    destructive confirmation, and localized validation must be asserted with
    accessible roles/states in the relevant spec; a helper may be extracted
    only after a second surface needs the same assertion. Every leakage call
    for authoring/runtime surfaces must explicitly set
    `checkUuidSubstrings: true` and forbidden widget/variant/source patterns.
-   `@axe-core/playwright` for landmarks and relevant WCAG checks. Invalid
    submissions must actually be triggered in both locales; assert the visible
    localized message and `aria-invalid`, then use the leakage helper to prove
    that internal validation text is absent.
-   fresh isolated test data and run-manifest cleanup; no test ordering dependency.

At plan-authoring time the new cross-template specs and root wrapper scripts did
not exist. The implementation below now provides the hosted cross-template spec
and its minimal-Supabase wrapper; the standalone browser wrapper remains
environment-bound because no separate authenticated standalone deployment is
configured in this checkout. The E2E runner starts the built
application itself. Do not use `pnpm dev` for this proof. For local SQL/RLS
proof, use the minimal E2E Supabase profile:

```bash
pnpm test:e2e:cross-template:verify:local-supabase
```

The dedicated root wrapper
`tools/testing/e2e/support/runCrossTemplateVerificationLocalSupabase.mjs` owns the
minimal-Supabase lifecycle in `try/finally`: invoke
`supabase:e2e:start:minimal`, `env:e2e:local-supabase`, `doctor:e2e:local-supabase`,
`build:e2e`, run the functional cross-template specs with the supported
repository runner, and always invoke `supabase:e2e:stop`. It must leave a run
manifest/report even after a test failure. The standalone acceptance has a separate wrapper
`pnpm test:e2e:cross-template:standalone`; it must fail with a recorded
`BLOCKED` result when the authenticated standalone shell is unavailable, not
convert the test to a conditional skip.

Run visual projects with `--project ru-light`, `--project ru-dark`,
`--project en-light`, and `--project en-dark`, with `--workers 1` for
deterministic screenshot generation, and run
`pnpm docs:marketing-page:screenshot:check` after capture. The wrapper must
cover every required flow, not only one positional spec path.

The implementation validates optimistic concurrency through the direct
application/metahub store and route suites and the publication/sync regression
coverage. A separate real-database concurrency wrapper is not present in this
checkout; this is an explicit evidence boundary rather than a hidden PASS.
The visual wrapper owns the local-Supabase lifecycle for the browser captures.

Screenshots are evidence, not decoration:

1. capture only after the settled state is asserted;
2. name artifacts by surface, target, locale, theme, and viewport;
3. inspect generated PNGs with the image viewer;
4. update baselines only after an explicit visual review;
5. update screenshot provenance and run the existing
   `docs:marketing-page:screenshot:check`/GitBook asset checks;
6. keep traces on first retry/failure and preserve the HTML report.

If no authenticated standalone shell can be provisioned, the result is
`BLOCKED`, not `PASS`, and the release decision must name the missing external
environment. The current conditional standalone skip is not acceptance
evidence. GuestApp remains `DEFERRED`.

**Exit criteria**

-   All non-deferred cells have executable tests and recorded results.
-   No required standalone cell is hidden by an unconditional skip.
-   Screenshots and traces were inspected, and visual claims match artifacts.

### Phase 9 — Documentation and GitBook maintenance

Update only after the implementation contract and browser evidence stabilize:

-   `packages/universo-react-apps-template-mui/README.md`
    -   complete Dashboard zone list;
    -   isolated adapter/capability boundary;
    -   target-aware runtime bootstrap;
    -   shared widget rules and standalone prerequisites.
-   `docs/en/guides/application-layouts.md`
-   `docs/en/guides/entity-scoped-layouts.md`
-   `docs/en/platform/marketing-page-template.md`
-   matching `docs/ru/guides/*.md` and
    `docs/ru/platform/marketing-page-template.md`
-   `docs/en/SUMMARY.md`, `docs/ru/SUMMARY.md`, and relevant section READMEs
    when a new guide or page is added.
-   `tools/testing/e2e/README.md` and `README-RU.md` for the exact local
    minimal-Supabase/browser/screenshot workflow.

Documentation must describe:

-   precedence and independent-versus-overlay behavior;
-   Page/Object target support and recordKey semantics;
-   template/region/widget capability mapping;
-   authoring states and conflict recovery;
-   hosted/standalone requirements and GuestApp deferral;
-   no schema/template version bump and no legacy compatibility promise;
-   exact test commands and screenshot provenance.

Run EN/RU i18n, GitBook link, screenshot-asset, and relevant docs checks.

**Exit criteria**

-   EN/RU docs agree with the executable contract and current screenshot
    evidence.
-   No guide describes same-template-only behavior or four Dashboard zones.

### Phase 10 — Final verification and review gate

Run, in dependency order:

```bash
pnpm --filter @universo-react/types lint
pnpm --filter @universo-react/utils lint
pnpm --filter @universo-react/i18n lint
pnpm --filter @universo-react/i18n typecheck
pnpm --filter @universo-react/applications-backend lint
pnpm --filter @universo-react/applications-frontend lint
pnpm --filter @universo-react/metahubs-backend lint
pnpm --filter @universo-react/metahubs-frontend lint
pnpm --filter @universo-react/apps-template-mui lint
pnpm --filter @universo-react/types build
pnpm --filter @universo-react/utils build
pnpm --filter @universo-react/applications-backend build
pnpm --filter @universo-react/applications-frontend build
pnpm --filter @universo-react/metahubs-backend build
pnpm --filter @universo-react/metahubs-frontend build
pnpm --filter @universo-react/apps-template-mui build
pnpm build
pnpm check:apps-template-isolation
pnpm check:runtime-no-lms-forks
pnpm check:mui-v9-policy
pnpm check:zod-resolution
node tools/lint-db-access.mjs
pnpm docs:i18n:check
pnpm docs:gitbook-screenshot-assets:check
pnpm docs:marketing-page:screenshot:check
node tools/docs/check-gitbook-links.mjs
git diff --check
pnpm ontoindex:changes
```

The actual focused Jest/Vitest/Playwright commands from Phase 8 must pass
before the full build is treated as meaningful. Run the required project-local
autoreview/Thermos gate after implementation changes; a tool initialization
failure is reported as unavailable evidence, never as a clean verdict.

The closeout must explicitly report:

-   schema/snapshot/metahub-template versions unchanged;
-   no legacy compatibility layer added;
-   no unexpected files or package-boundary violations;
-   all browser cells and screenshot artifacts;
-   standalone `PASS`, `BLOCKED`, or separately approved `DEFERRED`;
-   UUID v7, SQL/RLS/RBAC, Origin/CSRF, publication, cache, and lineage gates;
-   documentation and EN/RU parity checks.

## Test matrix and evidence contract

The research matrix remains the oracle source, but the implementation handoff
uses these status rules:

-   `PASS`: executable test ran and all user-visible/API/database assertions
    passed.
-   `PARTIAL`: existing evidence covers a neighboring same-template path but
    not the new cross-template contract; it cannot close the task.
-   `BLOCKED`: required environment, especially authenticated standalone, was
    unavailable. It cannot be reported as acceptance.
-   `DEFERRED`: explicitly outside this slice, currently only anonymous/public
    GuestApp behavior.
-   `FAIL`: a defect or contract mismatch was reproduced.

Each acceptance cell must record the test file, command, environment,
application/target fixture identifiers in private test artifacts only,
response status/code, screenshot/trace paths where applicable, and a
human-readable conclusion. Do not put UUIDs or tokens into user-facing
screenshots, logs, docs, or final reports.

## Potential challenges and mitigations

| Risk                                                        | Mitigation                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Multiple runtime paths make inconsistent template decisions | one server-owned resolver and one effective-layout response before renderer dispatch                          |
| Cross-template layout is accidentally treated as an overlay | independent composition mode, null inherited-base lineage, strict validator, no physical-zone merge           |
| Dashboard `top`/`bottom` disappear in one layer             | contract tests at SQL, API parsing, adapter, and visible renderer boundaries                                  |
| Missing/corrupt rows render as an empty success             | typed 409/503, transaction preflight, no warning-only fallback                                                |
| Draft data leaks into runtime                               | published publication/version identity and regression tests for draft exclusion                               |
| Application-only duplicate checks race                      | existing lock/version boundary, deterministic lock order, real local-Postgres concurrency tests, typed 409    |
| Hash IDs are mistaken for stable physical identity          | fresh UUID v7 allocation plus explicit old-to-new remap and semantic `instanceKey` assertions                 |
| Target cache is stale for up to 60 seconds                  | normalized target-aware key, response identity, effectiveHash, awaited targeted invalidation                  |
| UI exposes hidden technical knowledge                       | localized human labels, existing primitives, runtime UX leakage oracle                                        |
| A shared widget leaks incompatible shell behavior           | existing registry capability view and per-template adapters, with explicit capability rejection               |
| Standalone proof is silently skipped                        | provisioned authenticated shell prerequisite and BLOCKED status when absent                                   |
| Docs and visuals drift from behavior                        | screenshots generated from the real runtime, inspected, provenance checked, EN/RU docs updated after evidence |
| Dirty graph gives false impact confidence                   | direct source remains authoritative; rerun OntoIndex after implementation on the final diff                   |

## Dependencies and prerequisites

-   Node.js >= 22.6 and the repository's pinned PNPM/catalog versions.
-   `@universo-react/types`, `@universo-react/utils`, and
    `@universo-react/i18n` remain the shared contract/i18n boundaries.
-   Existing request-scoped `DbExecutor`, RLS, SQL helper, UUID v7, optimistic
    version, and lock utilities are reused.
-   The local E2E Supabase minimal stack and its generated environment files are
    available.
-   The E2E runner can build/start the application without `pnpm dev`.
-   An authenticated standalone shell/API proxy is supplied for the required
    standalone browser cells, or the gate is explicitly reported BLOCKED.
-   No credentials, production data, or user-owned unrelated changes are
    required.

## Open decisions that must be resolved in discussion

The recommended defaults above are actionable, but these choices still need
an explicit product/architecture confirmation:

1. Is `workspaceId` strictly content/authorization context for this MVP, as
   proposed, or should workspace-specific layout scope be added later?
2. Does the proposed clean-break representation pass the current DDL and
   snapshot-v1 round-trip: metahub/snapshot `baseLayoutId` required for
   overlays and explicit `null` for independent layouts, while application
   rows use existing lineage/config fields and no `base_layout_id` column?
3. Is authenticated standalone shell provisioning available in CI/local E2E?
4. Does the product approve the deterministic `languageSwitcher` capability as
   the first shared widget? A negative answer returns to the brief; it does not
   authorize a silent marketing omission or an optional compatibility path.
5. Can runtime enforce the existing `publicationId`,
   `publicationVersionId`, `last_synced_publication_version_id`, and
   `snapshotHash`/`source_snapshot_hash` invariant without adding a version or
   publication column?
6. Are the proposed public error-code names acceptable, or should they be
   consolidated before implementation?

If any answer requires a schema or version change, public GuestApp behavior,
or a second renderer/cache contract, return to the brief rather than silently
expanding this plan.

## Verification command reference

The following commands are planned commands, not executed in PLAN mode:

```bash
# Focused backend Jest
pnpm --filter @universo-react/applications-backend test -- src/tests/services/effectiveLayoutResolver.test.ts src/tests/controllers/runtimeRowsController.test.ts src/tests/controllers/runtimeMarketingPageController.test.ts --runInBand
pnpm --filter @universo-react/metahubs-backend test -- src/tests/services/MetahubLayoutsService.test.ts --runInBand

# Focused Vitest; pass exact files to the package's existing test wrapper
pnpm --filter @universo-react/types test -- src/__tests__/layoutWidgetDefinitions.test.ts src/__tests__/runtimeTarget.test.ts
pnpm --filter @universo-react/utils test -- src/runtime/__tests__/runtimeTarget.test.ts src/validation/__tests__/validation.test.ts src/uuid/__tests__/index.test.ts
pnpm --filter @universo-react/applications-frontend test -- src/pages/__tests__/ApplicationLayouts.test.tsx src/pages/__tests__/ApplicationRuntime.test.tsx src/api/__tests__/queryKeys.test.ts
pnpm --filter @universo-react/metahubs-frontend test -- src/domains/layouts/ui/LayoutList.crossTemplate.test.tsx src/domains/layouts/ui/LayoutDetails.crossTemplate.test.tsx
pnpm --filter @universo-react/apps-template-mui test -- src/api/__tests__/runtimeRows.test.ts src/dashboard/__tests__/Dashboard.crossTemplate.test.tsx src/components/__tests__/LanguageSwitcher.crossTemplate.test.tsx src/standalone/__tests__/DashboardApp.test.tsx

# Local minimal Supabase and real browser proof; wrappers own start/stop in finally
pnpm test:e2e:cross-template:verify:local-supabase
pnpm test:e2e:cross-template:standalone
pnpm test:e2e:cross-template:visual:local-supabase
pnpm test:e2e:application-layout-concurrency:local-supabase

# Existing/extended marketing and visual proof
pnpm test:e2e:marketing-page:verify:local-supabase

# Package and repository gates
pnpm build
pnpm check:apps-template-isolation
pnpm check:runtime-no-lms-forks
pnpm check:mui-v9-policy
pnpm check:zod-resolution
pnpm docs:i18n:check
pnpm docs:gitbook-screenshot-assets:check
pnpm docs:marketing-page:screenshot:check
node tools/docs/check-gitbook-links.mjs
pnpm ontoindex:changes
```

If a package's test wrapper rejects multiple file arguments, invoke its
documented equivalent with the same exact focused files; do not replace a
focused test with an unbounded resource-heavy run without recording the
reason.

## Sources and research links

### Local sources

-   External MANAGER brief `unified-application-template-widgets-and-scoped-layouts-spec-2026-09-07.md`
-   External MANAGER task input `2026-09-07-unified-template-widgets-scoped-layouts.md`
-   `memory-bank/research/unified-application-template-widgets-scoped-layouts-research-2026-09-07.md`
-   `packages/universo-react-apps-template-mui/README.md`
-   `docs/en/guides/application-layouts.md`
-   `docs/en/guides/entity-scoped-layouts.md`
-   `docs/en/platform/marketing-page-template.md`
-   matching `docs/ru/` guides
-   `.backup/templates/dashboard`
-   `.backup/templates/marketing-page`

### Official external sources

-   [MUI templates](https://mui.com/material-ui/getting-started/templates/)
-   [MUI v9 upgrade](https://mui.com/material-ui/migration/upgrade-to-v9/)
-   [MUI App Bar](https://mui.com/material-ui/react-app-bar/)
-   [MUI Drawer](https://mui.com/material-ui/react-drawer/)
-   [MUI Grid](https://mui.com/material-ui/react-grid/)
-   [MUI Stack](https://mui.com/material-ui/react-stack/)
-   [WAI-ARIA landmarks](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/)
-   [React stable list keys](https://react.dev/learn/rendering-lists)
-   [TypeScript narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
-   [Zod API](https://zod.dev/api)
-   [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
-   [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
-   [Playwright best practices](https://playwright.dev/docs/best-practices)
-   [Playwright assertions](https://playwright.dev/docs/test-assertions)
-   [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)
-   [TanStack Query query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)
-   [TanStack Query invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation)

### Context7 checks

-   `/mui/material-ui/v9.2.0`
-   `/tanstack/query/v5.90.3`
-   `/microsoft/playwright/v1.58.2`
-   `/colinhacks/zod/v3.24.2`
-   `/colinhacks/zod/v4.0.1`

The current catalog/lockfile remains the compatibility baseline. These
documentation lookups do not authorize a dependency upgrade.

## Plan review record

-   Read and applied `.gemini/rules/custom_modes/plan_mode.md`.
-   Applied `research-before-plan`, `universo-platform-architecture`,
    `mui-runtime-ux-patterns`, `runtime-ux-qa`, `playwright-best-practices`,
    `ontoindex-code-intelligence`, `zod`, and `vitest` guidance.
-   Used direct source inspection for the brief, research artifact, package
    scripts, runtime controllers, sync/materialization, authoring components,
    query keys, E2E runner, and runtime UX helpers.
-   Queried Context7 for MUI 9.2, TanStack Query 5.90, Playwright 1.58, and
    both project-compatible Zod 3.24 and current Zod 4 guidance; the example
    uses the pinned Zod 3 `z.object(...).strict()` API.
-   Used OntoIndex search, context, and impact. The indexed commit matched
    `HEAD`, but the worktree was dirty, embeddings were unavailable, and some
    files exceeded the scan cap; direct source remains authoritative.
-   Requested architecture, Runtime UI UX, correctness/security, and
    test-oracle Subagent reviews. An initial test-oracle worker was interrupted
    after an extended non-returning run; a later independent test-oracle review
    returned successfully. The final read-only QA pass also used separate UX,
    test-oracle, and codebase-explorer reviews. Their findings were incorporated:
    per-surface browser oracles, source-chain/publication identity,
    UUID/lineage operation rules, exact errors, security fixtures, cache-helper
    ownership, runnable local-Supabase wrappers, and mandatory visual/static
    gates.
-   QA follow-up on 2026-09-07 used six read-only Subagent reviews against the
    brief, input, research, plan, current DDL/snapshot/sync paths, runtime
    hosts, authoring dialogs, and browser oracles. The decisive findings were
    incorporated here: no application `base_layout_id`, snapshot-v1 nullable
    independent representation, exact publication metadata invariant,
    request-versus-trusted resolver boundaries, unified lock protocol,
    removal of hash-derived physical IDs, existing-registry reuse, actual
    Dashboard zone owners, real dialog/table oracles, and explicit visual
    evidence accounting.
-   Historical QA record: at plan-QA time the cross-template specs/wrappers
    were planned artifacts rather than executable evidence. The implementation
    gate was subsequently reopened by the IMPLEMENT continuation, and the
    verified results are recorded in the closeout appendix below.
-   Local document validation after the QA edits passed: Prettier reported no
    formatting differences and `git diff --check` reported no whitespace
    errors for the plan artifact.

The original plan and QA record are retained above for traceability. The
implementation closeout below supersedes the historical draft disposition.

## Implementation closeout (2026-09-08)

The planned architecture is implemented in the current worktree without a
schema, snapshot, or metahub-template version increase and without retaining
the removed targetless runtime-template route.

-   The server-owned target-aware effective-layout contract now resolves the
    authorized Page/Object/global target before renderer selection, validates
    publication lineage and hashes, and fails closed on stale or ambiguous
    state. SQL-first stores preserve UUID v7 identities, optimistic versions,
    deterministic locks, and atomic mutation boundaries.
-   The shared widget/zone registry is exported from `@universo-react/types`.
    Dashboard and marketing keep separate renderers while reusing the isolated
    apps-template `LanguageSwitcher` and existing MUI primitives. Dashboard
    top/bottom/center/left/right transport is typed; active shell controls have
    one responsive owner for language and color mode.
-   Normal visible application navigation now carries the target selector to
    the effective-layout request. The browser flow proves that a marketing
    global layout can navigate to an entity-scoped Dashboard layout with a
    real table and shared language widget.
-   Focused tests passed: applications-backend 4 suites / 215 tests;
    metahubs-backend 3 suites / 71 tests; applications-frontend 2 files / 49
    tests; apps-template-mui Dashboard 2 files / 22 tests; types 36 tests; and
    utils 3 files / 17 tests. The final cross-template wrapper passed setup and
    runtime flow, 2/2, on minimal local Supabase after a full workspace build.
-   The latest browser evidence is under
    `tools/testing/e2e/.artifacts/cross-template/2026-09-08T03-38-54-281Z/`.
    Inspected captures cover Marketing desktop, RU mobile, tablet, scoped
    Dashboard desktop, and scoped Dashboard RU mobile; assertions cover
    keyboard language-menu operation, one visible color control, localized
    target navigation, no UUID/internal-widget leakage, and no page-level
    horizontal overflow.
-   Package lint, static isolation/runtime guards, SQL-access lint, GitBook
    EN/RU parity, screenshot-asset checks, local-link checks, Prettier, and
    `git diff --check` are part of the closeout. The standalone browser cell is
    not claimed as PASS because no authenticated standalone deployment is
    configured locally; standalone component coverage remains available.
-   OntoIndex remains dirty-worktree/stale-index evidence and direct source is
    authoritative for changed symbols. The Thermos/autoreview helper was
    attempted but the environment-owned `/home/vladimir/.codex/state_5.sqlite`
    is read-only; no automated clean-review verdict is claimed.

This closeout is the implementation evidence for discussion and review. It
does not claim external CI or a separately provisioned standalone browser
environment that was not available in this workspace.
