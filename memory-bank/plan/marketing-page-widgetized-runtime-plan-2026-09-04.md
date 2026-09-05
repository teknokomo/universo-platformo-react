# Plan: Widgetized, Entity-Driven Marketing Page Runtime

> Created: 2026-09-04
> Status: Implemented; final verification recorded below
> Mode: PLAN
> Brief: Supplied technical specification (2026-09-04; task-context source, not mirrored in the repository)
> Input: Supplied implementation brief (2026-09-04; task-context source, not mirrored in the repository)
> Research: [`marketing-page-widgetized-runtime-research-2026-09-04.md`](../research/marketing-page-widgetized-runtime-research-2026-09-04.md)
> Previous implementation: [`mui-9-marketing-page-template-plan-2026-08-30.md`](mui-9-marketing-page-template-plan-2026-08-30.md)

This is the implementation and verification record for a decision-focused plan. It is a clean-break change for a disposable test database: it does not preserve the direct marketing renderer as a second runtime authority, does not add a schema or metahub-template version, and does not introduce a legacy payload reader. The original plan was prepared without product edits; the implementation and evidence updates below were added after that planning gate.

## Overview

The current `marketing-page` published runtime is data-driven only at the content level. `MarketingPage.tsx` still builds a fixed eight-section map and `MarketingRuntimeContent.tsx` loads one dedicated marketing read model; the seeded `marketing-main` layout has no widget assignments. The required change is to make the page composition itself a template-aware list of persisted widget instances.

The implementation will:

-   keep the MUI 9 visual baseline from `.backup/templates/marketing-page`;
-   represent navigation, hero, logos, features, testimonials, highlights, pricing, FAQ, and footer as layout widget or shell instances;
-   use one reusable collection widget with variants for the uniform collection sections, allowing repeated instances with different settings;
-   source content, localization, relations, media, and actions from standard metahub entity types and published application/workspace records;
-   support metahub main/entity layouts and application global/entity overrides with explicit precedence and provenance;
-   materialize, publish, restore, import/export, synchronize, and render the same typed contract without routing marketing through dashboard CRUD state;
-   enforce SQL-first access, RLS/RBAC, UUID v7, optimistic concurrency, strict Zod validation, bounded server-owned data sources, and localized safe failures;
-   deliver a deep Jest/Vitest/Playwright test system, inspected responsive screenshots, updated package READMEs, and synchronized GitBook documentation.

Implementation starts only after the contract gates in Phase 0 are accepted. The rest of the plan is concrete enough for discussion and intentionally identifies the recommended decisions instead of leaving architecture to emerge during coding.

## Research and external guidance used

The plan was prepared after reading the supplied brief, the fresh repository research artifact, the prior MUI plan, relevant Memory Bank context, source READMEs, current package scripts, tests, seed manifests, DDL, runtime controllers, and E2E configuration. The following project skills were applied: `research-before-plan`, `universo-platform-architecture`, `mui-runtime-ux-patterns`, `runtime-ux-qa`, `playwright-best-practices`, `vitest`, `nodejs-best-practices`, `nodejs-backend-patterns`, `typescript-advanced-types`, `zod`, `turborepo`, `thermos`, and `autoreview`. The local `vercel-react-best-practices` skill was not available in this checkout; React performance decisions were checked against the installed package contracts, repository patterns, and official documentation instead of claiming that unavailable skill.

Context7 was queried on 2026-09-04 for the official MUI v9.2.0 documentation (`/mui/material-ui/v9.2.0`), TanStack Query v5 documentation (`/tanstack/query/v5.90.3`), and Playwright v1.58.2 documentation (`/microsoft/playwright/v1.58.2`). The workspace policy remains authoritative: MUI Core/System/Icons/Utils `9.2.0`, MUI X `9.8.0`, TanStack Query `^5.62.13`, Zod `^3.25.76`, and Playwright `^1.58.2`.

Additional official sources checked during planning:

-   [MUI templates](https://mui.com/material-ui/getting-started/templates/) and [MUI v9 migration](https://mui.com/material-ui/migration/upgrade-to-v9/) for the visual/API baseline;
-   [MUI Grid](https://mui.com/material-ui/react-grid/) and [MUI App Bar](https://mui.com/material-ui/react-app-bar/) for responsive layout and navigation semantics;
-   [MUI Modal](https://mui.com/material-ui/react-modal/) and [MUI Drawer API](https://mui.com/material-ui/api/drawer/) for focus containment, accessible naming, and temporary-drawer behavior;
-   [React stable keys](https://react.dev/learn/rendering-lists) for persisted/repeated widget identity;
-   [TanStack Query query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [render optimizations](https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations), and [targeted invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation) for cache correctness and render cost;
-   [Playwright projects](https://playwright.dev/docs/test-projects), [fixtures](https://playwright.dev/docs/test-fixtures), and [TestInfo attachments](https://playwright.dev/docs/api/class-testinfo) for project dependencies, isolation, deterministic browser setup, and durable screenshot evidence;
-   [Zod](https://zod.dev/) for strict boundary parsing and safe failure handling.

The OntoIndex exploration followed the required search → inspect → impact order before source edits. The indexed snapshot is dated 2026-09-03 and is degraded for the dirty worktree. `materializeSnapshotLayoutsAndWidgets` was reported as LOW risk with 13 impacted nodes across sync flows; the prior research also recorded a MEDIUM impact for the shared dashboard `renderWidget` surface. These graph results were used as pre-edit blast-radius evidence; the final diff verification must still be interpreted with the dirty-worktree/index freshness limitation recorded at closeout.

Two read-only Subagent reviews were completed during QA: one architecture/source explorer and one plan UX reviewer. Their findings were cross-checked against direct source and integrated below (outer `layoutZoneWidgets` stability, entity-type scope identity, override/hash/UUID/materialization invariants, package isolation, surface-level UI contracts, safe display, i18n parity, and screenshot provenance). Their output remains advisory; direct source and the project skills remain the acceptance authority. A clean independent Thermos/autoreview verdict was not claimed because no product-code diff exists and the current review environment has previously prevented the helper from completing.

## Recommended contract decisions

These decisions close the research questions for the purpose of this plan. They are the first approval gate; a reviewer may change them before implementation, but the implementation must not silently choose a different contract later.

### 1. Widget taxonomy

Use a small marketing-specific registry rather than adding marketing keys to the dashboard registry or adding a marketing branch to the shared dashboard `renderWidget` switch:

| Widget key             | Role                                                                             |                                        Repeatable | Seeded source model                                                     |
| ---------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------: | ----------------------------------------------------------------------- |
| `marketing.navigation` | App bar, brand, navigation links, responsive drawer, primary actions             |                                                No | `MarketingPageNavigation`, site settings, safe action/resource metadata |
| `marketing.hero`       | Hero copy, media, CTA/action pair                                                |                                                No | `MarketingPageSection`, site settings, resource source                  |
| `marketing.collection` | Reusable collection renderer                                                     |                                               Yes | Variant-specific standard Object records                                |
| `marketing.pricing`    | Pricing tiers and relation-backed benefits                                       | Yes, if product needs more than one pricing block | `MarketingPagePricing` and `MarketingPagePricingBenefit` relation       |
| `marketing.footer`     | Footer groups, legal/social links, newsletter capability if explicitly available |                                                No | `MarketingPageFooterLink`, site settings, safe action metadata          |

`marketing.collection` has a strict `variant` union: `logos`, `features`, `testimonials`, `highlights`, and `faq`. A collection instance has its own `instanceKey`, source mapping, presentation settings, active state, and position. The initial seed creates one instance for each stock section, but the runtime does not assume eight sections or a fixed order. A second features, testimonials, FAQ, or other collection instance is valid when its source and configuration are valid.

The host owns only the page container, theme boundary, error state, and ordered composition loop. It does not contain a fixed `sectionNodes` object. Navigation and footer remain shell-aware widgets because their landmark, focus, drawer, anchor, and action semantics differ from an ordinary card collection; they are still persisted and resolved as widget instances.

No new built-in entity preset is needed. Standard Hub/Object/Page/Set/Enumeration foundations remain the content model. `Page` is reserved for future genuinely rich content and is not used as an opaque JSON replacement for the initial widget contract.

### 2. Neutral contract and template adapters

`@universo-react/types` owns only serializable, template-neutral metadata and strict marketing schemas. It must not import React, SQL, backend services, or `.backup` code. The isolated `@universo-react/apps-template-mui` package owns the marketing renderer registry and adapters. Metahub and applications backends own seed, persistence, publication, and server data resolution. The shared registry describes capabilities; it does not contain React components or SQL.

The existing dashboard vocabulary remains valid behind a dashboard adapter. A neutral layout API may expose `placement`, `widgetKey`, and `instanceKey`, while the dashboard adapter maps `placement` to `left|top|right|bottom|center` and the marketing adapter maps it to the marketing regions below. There must be no global union that makes marketing depend on dashboard keys.

### 3. Placement and physical storage without a schema/version bump

Reuse `_mhb_layouts`, `_mhb_widgets`, `_mhb_layout_widget_overrides`, `_app_layouts`, and `_app_widgets` only after the storage gate proves the clean contract against their indexes and lineage fields. Do not add a column, schema migration, snapshot version, or metahub manifest version.

The recommended physical mapping is:

| Logical marketing placement | Stored `zone` value | Meaning                    |
| --------------------------- | ------------------- | -------------------------- |
| Header                      | `marketing-header`  | Navigation shell           |
| Main                        | `marketing-main`    | Hero, collections, pricing |
| Footer                      | `marketing-footer`  | Footer shell               |

All values fit the existing `zone` length of 20. The field becomes an opaque persisted placement interpreted by the selected template adapter; dashboard code continues to accept only its existing zone set. The application and metahub type layers must stop typing every widget as `DASHBOARD_LAYOUT_ZONES` and instead validate the selected template's placement.

The stable `instanceKey` is stored inside the existing JSON `config` envelope because no column may be added. It is required for marketing widgets, immutable after creation, never displayed as a technical label, and remains stable through reorder, copy, snapshot remapping, and React rendering. Seeded instances use deterministic semantic keys such as `hero`, `logos`, and `faq`; author-created instances use a server-generated UUID v7 value validated by the shared UUID-v7 schema. The database row `id` remains the UUID v7 persistence identity and source-lineage anchor. The semantic hash includes template/scope/name/config semantics and each widget's placement, order, key, `instanceKey`, active state, and effective normalized config (including source binding when it is part of that config). Physical row IDs, source/base lineage IDs, baseline `sourceConfig`, timestamps, and mutable version counters are deliberately excluded because materialization/remapping changes them without changing the effective layout contract.

The storage phase must verify and, on a fresh database, regenerate dashboard/marketing indexes from code. The old dashboard-only single-instance predicate must not reject repeatable `marketing.collection` instances. Existing old databases are out of scope; no compatibility branch may be added to make their rows appear valid.

`layoutZoneWidgets` remains the single outer seed/snapshot field for the existing `metahub-template/v1` and snapshot-bundle contracts, including the non-marketing templates. Its element type becomes a neutral template-discriminated widget envelope; the marketing adapter owns its placement/configuration semantics. Do not add a parallel `layoutWidgets` field or a reader for both names, and do not call this boundary preservation a marketing legacy payload reader. An internal neutral collection may be named differently only behind a one-way typed mapper. Dashboard and marketing round-trip tests must prove that this stable outer contract does not force dashboard semantics onto marketing data.

### 4. Composition authority and scope precedence

The active widget-instance list is the only authority for top-level composition, placement, order, and section visibility. Existing `sectionOrder` and `sectionVisibility` fields are removed from the effective marketing composition and from the persisted/runtime acceptance contract in the clean break. A top-level `sectionCopies` map must not remain as a second renderer input; localized copy that survives belongs to entity-backed content or to a validated widget payload. If a content record retains `SortOrder` or `IsVisible`, those fields describe items within a collection or content metadata; they do not hide or move a top-level widget. The seed config may retain only genuine page appearance settings such as theme mode or approved colors, not a second section layout.

Resolve the effective layout with this precedence:

1. metahub global/main layout is the canonical base;
2. metahub entity-scoped sparse overrides apply only when the runtime target identifies the matching layout-capable entity type;
3. application global layout overrides the metahub effective base for the deployment;
4. application entity-scoped override applies when the same layout-capable entity type is selected;
5. workspace records supply content values and collection rows under workspace/RLS scope, but do not alter composition;
6. a publication snapshot is the immutable materialized deployment artifact carrying the resolved source and lineage, not an additional semantic override layer.

Merges are keyed by `instanceKey`. Application rows are materialized overlays linked through `sourceLayoutId`; the resolver follows that lineage and folds each semantic layer once instead of rendering a full application copy and its metahub base twice. An application override may change approved config, active state, and order; changing widget key, variant, placement region, or source requires an explicit supported operation and validation. Duplicate keys, conflicting inherited deletes, mismatched source lineage, or an entity target that cannot be resolved cause a typed conflict/invalid-layout result. The resolver never picks the first arbitrary entity layout.

The initial public contract remains authenticated `/a/:applicationId`. The root route uses the global layout. An entity layout is used only from an existing or explicitly added typed entity-type target/preview context; the target is identified by stable semantic route data, then resolved server-side. `GuestApp`/anonymous public marketing is a separate future policy and is not smuggled into this implementation.

#### Scope identity and layer ownership

The existing `scope_entity_id` in `_mhb_layouts` and `_app_layouts` identifies a layout-capable entity-type object/definition (`_mhb_objects` or `_app_objects`), not an individual content record. The existing scope-list endpoints and `is_default` selection semantics must remain the source of truth for that identity. Multiple active layouts for one entity type are selected only through an explicit authoring/preview choice or the validated default; the runtime must reject an ambiguous/no-default state and must never choose an arbitrary first row.

A runtime target may carry an optional `recordKey` for selecting the content/workspace record whose values are displayed, but `recordKey` never selects a record-specific layout. Record-specific layouts are out of scope and must not be introduced through a query parameter, JSON config, or hidden fallback; they would require a separate approved storage and authorization contract.

Layer ownership is explicit:

| Layer                     | Owns                                                                                                                                  | Must not silently own                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Metahub                   | Entity definitions/components, relations, seeded/default marketing records, canonical widget instances, and main/entity-type layouts. | Deployment-specific branding or ordinary day-to-day workspace CRUD.       |
| Application control panel | Deployment branding/presentation and approved application-global/entity-type layout overrides with source lineage/conflict state.     | Canonical entity definitions or ordinary workspace content.               |
| Published workspace       | Ordinary content records and user-authored values under membership/RLS.                                                               | Global composition or record-specific layout selection.                   |
| Runtime resolver          | Read-only, authorized effective layout plus bounded content envelope.                                                                 | Authoring, repair, silent fallback, or mutation of invalid configuration. |

### 5. Server-owned data binding

Widget configuration references only server-allowlisted entity codenames and logical field aliases. The built-in pricing adapter owns the pricing-benefit relation; there is no arbitrary client-provided `relationCodename`. Configuration never contains a physical table name, arbitrary SQL, an unbounded `records.union`, or client-selected columns that bypass metadata. The server resolves metadata to quoted identifiers and applies application/workspace/RLS scope, per-widget field allowlists, row limits, relation limits, media-origin policy, and locale fallback.

The existing bounded datasource descriptors may be reused only through a marketing adapter with a per-widget allowlist. A generic descriptor is not itself permission to read any object. Widget-specific schemas must reject unknown source roles, fields, variants, placements, action kinds, resource sources, and config keys before persistence or rendering.

### 6. Runtime envelope and query contract

Prefer one typed runtime request that resolves the template, effective layout, layout hash/lineage, and widget data together. The implemented integration keeps the existing split only as a dispatch-only `runtime/template` bootstrap: it selects the renderer branch and does not supply marketing content or authoritative appearance. The `runtime/marketing-page` response is the sole validated marketing envelope and owns the selected layout identity/hash; the client never merges the two payloads. If the bootstrap is later expanded to carry runtime data, it must adopt the same immutable identity/hash and mismatch rejection rule rather than becoming a second authority.

The envelope is discriminated by `templateKey` and contains no dashboard-only fields in the marketing branch. Its marketing payload carries the selected publication/release identity, effective layout/content hash, and source lineage needed to prove what was published. Invalid or unknown marketing data returns a typed error state; it does not become an empty page or dashboard response.

The runtime API uses the existing project error middleware with a stable public mapping: `400` for malformed request shape, `401` for unauthenticated access, `403` for an authenticated request outside the application/entity/workspace scope, `404` for an authorization-safe missing application or selected entity/content target, `409` for stale versions, ambiguous layout/default selection, or source-lineage conflicts, `413` for a configured data/payload limit, and `422` for a semantically invalid template, widget, placement, source, action, or resource. If the repository's established mapper combines `400` and `422`, retain that convention but preserve typed machine-readable codes and the same fail-closed distinctions. Mutating browser requests must continue through the existing CSRF/origin protections and `fetchWithCsrf` path; direct API tests must prove those protections rather than relying on UI gating.

The resolver has an explicit completeness policy: an inactive widget or an explicitly allowed empty collection may render its designed empty state, but a missing mandatory seeded source, required relation, duplicate/missing expected instance, or malformed effective layout returns a typed `MARKETING_RUNTIME_INCOMPLETE`/invalid-layout error. It must never silently omit a required widget, return a partially plausible page, or repair configuration during a read.

## Contract examples

The following snippets are illustrative plan-level contracts. They show the intended safety properties and are not implementation commits.

### Strict widget schema

```ts
const marketingPlacementSchema = z.enum(['marketing-header', 'marketing-main', 'marketing-footer'])
const instanceKeySchema = z.union([
    z
        .string()
        .min(1)
        .max(120)
        .regex(/^[a-z][a-z0-9._:-]*$/),
    uuidV7StringSchema
])

const sourceBindingSchema = z
    .object({
        entityCodename: z.enum([
            'MarketingPageSection',
            'MarketingPageSiteSettings',
            'MarketingPageLogo',
            'MarketingPageFeature',
            'MarketingPageTestimonial',
            'MarketingPageHighlight',
            'MarketingPagePricing',
            'MarketingPagePricingBenefit',
            'MarketingPageFaq',
            'MarketingPageNavigation',
            'MarketingPageFooterLink'
        ]),
        entityKind: z.literal('object'),
        recordKey: z.string().min(1).max(128).optional(),
        fieldMap: z.record(z.string().min(1).max(128), z.string().min(1).max(128)).default({})
    })
    .strict()

const collectionConfigSchema = z
    .object({
        variant: z.enum(['logos', 'features', 'testimonials', 'highlights', 'faq']),
        source: sourceBindingSchema,
        presentation: collectionPresentationSchema
    })
    .strict()

const marketingWidgetInstanceSchema = z.discriminatedUnion('widgetKey', [
    z
        .object({
            widgetKey: z.literal('marketing.navigation'),
            instanceKey: instanceKeySchema,
            placement: z.literal('marketing-header'),
            sortOrder: z.number().int().min(0).max(10000),
            isActive: z.boolean(),
            config: navigationConfigSchema
        })
        .strict(),
    z
        .object({
            widgetKey: z.literal('marketing.collection'),
            instanceKey: instanceKeySchema,
            placement: z.literal('marketing-main'),
            sortOrder: z.number().int().min(0).max(10000),
            isActive: z.boolean(),
            config: collectionConfigSchema
        })
        .strict(),
    z
        .object({
            widgetKey: z.literal('marketing.pricing'),
            instanceKey: instanceKeySchema,
            placement: z.literal('marketing-main'),
            sortOrder: z.number().int().min(0).max(10000),
            isActive: z.boolean(),
            config: pricingConfigSchema
        })
        .strict()
])
```

The abbreviated example omits only the analogous `marketing.hero` and `marketing.footer` branches for readability; the production discriminated union must cover all five registry definitions and the seed must parse exhaustively against it. The registry, schema, seed, and renderer key sets must have a type-level equality test so a missing branch cannot silently become an unknown/empty widget. Authoring adapters resolve selected entity/source/field options from authorized metadata and localized display labels; users do not type codenames or physical field names as a prerequisite for a valid workflow.

The actual schemas must use repository-compatible Zod 3 APIs, not `any`. `uuidV7StringSchema` and `collectionPresentationSchema` are strict shared contracts, not unchecked casts or open records. A server-generated author key may use the UUID v7 branch; seeded keys use readable semantic values such as `hero` and `faq`. The server still validates each source binding against the selected widget/variant allowlist before persistence.

### Template-aware renderer boundary

```tsx
function MarketingWidget({ widget, data }: MarketingWidgetProps) {
    const definition = marketingWidgetDefinitions[widget.widgetKey]
    if (!definition) return <LocalizedRuntimeError code='MARKETING_WIDGET_UNSUPPORTED' />

    const parsed = definition.configSchema.safeParse(widget.config)
    if (!parsed.success) return <LocalizedRuntimeError code='MARKETING_WIDGET_INVALID' />

    return definition.render({ widget, config: parsed.data, data })
}

function MarketingPage({ layout, data }: MarketingPageProps) {
    return (
        <MarketingPageShell>
            {layout.widgets
                .filter((widget) => widget.isActive)
                .map((widget) => (
                    <MarketingWidget key={widget.instanceKey} widget={widget} data={data} />
                ))}
        </MarketingPageShell>
    )
}
```

The production version must type the definition map with `satisfies`, narrow unknown data before use, and keep the provider/theme boundary in the host. The render loop must not contain a fixed section array, index-based React keys, or dashboard CRUD hooks.

### SQL-first optimistic mutation

```ts
const table = qSchemaTable(schemaName, '_app_widgets')
const rows = await executor.query<WidgetRow>(
    `UPDATE ${table}
     SET config = $1::jsonb,
         _upl_updated_at = NOW(),
         _upl_updated_by = $2,
         _upl_version = _upl_version + 1
     WHERE id = $3
       AND layout_id = $4
       AND _upl_version = $5
       AND _upl_deleted = false
       AND _app_deleted = false
     RETURNING *`,
    [JSON.stringify(validatedConfig), userId, widgetId, layoutId, expectedVersion]
)

if (!rows[0]) throw new Error('APPLICATION_LAYOUT_WIDGET_VERSION_CONFLICT_OR_NOT_FOUND')
```

The implementation must distinguish not-found/forbidden from stale-version conflict after an authorization-safe existence check, use request-scoped `DbExecutor` for authenticated RLS flows, keep identifiers schema-qualified and quoted, and avoid domain imports of Knex or direct Supabase calls. Move/reorder operations must update affected rows transactionally, use an order-collision-safe temporary phase or equivalent, require a version policy, and return confirmed rows.

### TanStack Query key

```ts
type MarketingRuntimeTarget = {
    entityTypeCodename: string
    /** Content selection only; never a record-specific layout selector. */
    recordKey?: string | null
}

const marketingRuntimeQueryKey = [
    'marketing-runtime',
    apiBaseUrl,
    applicationId,
    target?.entityTypeCodename ?? 'global',
    target?.recordKey ?? null,
    workspaceId ?? null,
    locale
] as const

const runtimeQuery = useQuery({
    queryKey: marketingRuntimeQueryKey,
    queryFn: () => fetchMarketingRuntime({ apiBaseUrl, applicationId, target, workspaceId, locale }),
    select: (envelope) => (envelope.templateKey === 'marketing-page' ? envelope.marketingPage : null)
})
```

Every variable used by the query function must be represented in the key; an explicitly selected preview release identity must be added too if the fetch contract accepts one. The server-selected publication identity is response evidence, not a client cache input unless it is passed into the request. Mutations invalidate the affected application/target prefix after a confirmed response and await the targeted invalidation where the UI depends on fresh data. A single envelope request avoids a layout/data waterfall; `select` and structural sharing are used only where they measurably reduce rerenders without hiding stale data.

## Affected areas

| Boundary                             | Primary paths                                                                                                                                                                                                      | Planned responsibility                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contracts                     | `packages/universo-react-types/src/common/marketingPage.ts`, `applicationLayouts.ts`, `runtimeDataSources.ts`, related exports/tests                                                                               | Neutral template discriminators, strict widget/layout/runtime schemas, semantic instance identity, placements, source bindings, typed errors, and hashes. Remove dashboard-only typing from the generic boundary without adding a compatibility alias.                                                                        |
| Shared utilities                     | `packages/universo-react-utils/src/**`                                                                                                                                                                             | Reuse or add generic UUID v7, locale, safe action/resource, stable-key, canonicalization, and hash helpers. No React/backend dependency cycle.                                                                                                                                                                                |
| Marketing seed and template registry | `packages/universo-react-metahubs-backend/src/domains/templates/**`, `src/domains/metahubs/services/TemplateManifestValidator.ts`, `TemplateSeedExecutor.ts`, `marketing-page.template.ts`, cleanup/manifest tests | Register the template-aware widget seed contract, populate the initial widget instances, keep `version: 0.1.0` and schema versions unchanged, and make seed rollback/idempotence template-aware.                                                                                                                              |
| Metahub layout persistence           | `packages/universo-react-metahubs-backend/src/domains/metahubs/services/MetahubLayoutsService.ts`, controllers/stores, `systemTableDefinitions.ts`, layout/widget tests                                            | Author global/entity layouts and sparse widget overrides, validate marketing placements/configs, enforce identity/order/version rules, and preserve dashboard behavior through its adapter.                                                                                                                                   |
| Application layout persistence       | `packages/universo-react-schema-ddl/src/SchemaGenerator.ts`, `packages/universo-react-applications-backend/src/persistence/applicationLayoutsStore.ts`, controllers/tests                                          | Reuse physical tables with template-aware validation/index predicates, source/base lineage, copy/reset, `RETURNING`, expected-version checks, and no dashboard predicate on marketing layouts.                                                                                                                                |
| Publication/snapshot/restore         | `packages/universo-react-metahubs-backend/src/domains/publications/**`, `SnapshotSerializer.ts`, `SnapshotRestoreService.ts`, `snapshotLayouts.ts` and tests                                                       | Serialize and preflight widget instances, allocate fresh UUID-v7 row IDs at restore while remapping source references, retain instance keys/lineage, reject malformed data before destructive writes, and preserve unchanged snapshot/template versions.                                                                      |
| Application sync/materialization     | `packages/universo-react-applications-backend/src/routes/sync/**`, `syncHelpers.ts`, `syncEngine.ts`, `syncLayoutPersistence.ts`, `applicationWorkspaces.ts`                                                       | Materialize marketing layouts through an adapter, remove marketing skips/dashboard injection, merge source updates with authored overrides, detect hashes, and fail closed on invalid placement/config/conflict.                                                                                                              |
| Runtime API/data resolver            | `runtimeMarketingPageController.ts`, `runtimeRowsController.ts`, runtime routes/shared helpers, API schemas                                                                                                        | Resolve template and effective layout first, load only allowlisted metadata-backed data with RLS/RBAC and limits, return one discriminated envelope, and map failures to safe localized codes.                                                                                                                                |
| Hosted/isolated runtime              | `packages/universo-react-apps-template-mui/src/marketing-page/**`, `ApplicationRuntime.tsx`, relevant app APIs/entrypoints                                                                                         | Replace fixed `sectionNodes`/direct-only assembly with the template adapter and widget registry, use one theme owner, preserve the dashboard branch, and add TanStack Query adapters. The template bootstrap is dispatch-only; the marketing endpoint is authoritative. No imports from legacy feature packages or `.backup`. |
| Authoring UI                         | `packages/universo-react-metahubs-frontend/src/domains/layouts/**`, application layout/settings surfaces in `packages/universo-react-applications-frontend/**`, existing generic CRUD/relation/resource controls   | Add global/entity marketing layout authoring, application overrides, friendly labels, duplicate/reorder/toggle/reset/conflict controls, and localized strict forms using existing MUI primitives.                                                                                                                             |
| Localization                         | `packages/universo-react-i18n/**`, package-local app/template locale adapters                                                                                                                                      | Add EN/RU labels, empty/loading/error/conflict/validation/ARIA/action/resource strings before UI implementation; no raw keys or Zod messages.                                                                                                                                                                                 |
| Tests and fixtures                   | `packages/**/__tests__`, `tools/testing/e2e/specs/{flows,matrix,generators}`, `tools/testing/e2e/support`, contract/provenance helpers                                                                             | Build Jest/Vitest/Playwright coverage around real lifecycle data, user-visible locators, RBAC/direct bypass, screenshots, accessibility, leakage, and responsive evidence.                                                                                                                                                    |
| Documentation                        | package `README.md`/`README-RU.md`, `docs/en`, `docs/ru`, `SUMMARY.md`, docs checks                                                                                                                                | Document the widget taxonomy, entity mapping, scopes/precedence, authoring, publication/sync, security, test commands, screenshot provenance, and clean-break/version policy in GitBook format.                                                                                                                               |

Do not expand this change into an unrelated rewrite of all legacy feature packages. Reuse existing dashboard/control-panel primitives where their ownership is correct: the control-plane authoring surfaces may import the established `@universo-react/template-mui` primitives, while the published renderer must remain isolated in `apps-template-mui` and must not import that package or legacy feature packages. Within the isolated runtime, use its existing package-local components and direct MUI imports; do not add a cross-boundary dependency or a new shared UI package merely to deduplicate JSX. Existing transitional backend dependency edges must be handled pragmatically rather than falsely claiming the monorepo is already cycle-free.

## Plan steps

### Phase 0 — Baseline, impact, and contract freeze

-   [ ] Record the current dirty worktree and preserve unrelated changes in `AGENTS.md`, `CLAUDE.md`, and the existing Memory Bank research update. Confirm this plan is the only new planning artifact.
-   [ ] Re-read the supplied brief, fresh research, `tasks.md`, `activeContext.md`, `techContext.md`, `systemPatterns.md`, package READMEs, prior MUI plan, current seed manifest, DDL, layout services/stores, runtime controllers, frontend layout surfaces, and current E2E wrapper/config.
-   [ ] Audit callers of the retained `packages/universo-react-template-mui/src/views/start-page/components` shell (`AppAppBar`/`SitemarkIcon`). Keep those primitives only where an in-scope caller already needs them; do not reintroduce the removed static `start-page/MarketingPage.tsx` or turn the shell into a second marketing contract.
-   [ ] Refresh OntoIndex freshness for the current commit. Run semantic search for the marketing runtime/layout flow, inspect the resolved symbols, and run impact before any source symbol is edited. Treat HIGH/CRITICAL warnings as a stop-and-review gate; record the degraded-index limitation if it remains.
-   [ ] Capture a baseline of focused package builds, typechecks, lints, Jest/Vitest suites, the existing marketing contract checker, and the existing local-Supabase marketing E2E gate. Do not run `pnpm dev`; use the repository E2E wrapper when browser evidence is needed.
-   [ ] Confirm the final taxonomy above, the three marketing placements, the instance-key identity rule, the scope precedence, authenticated-only first release, section-field demotion/removal, action/media policy, and the one-envelope preference. Record changes in the plan before coding.
-   [ ] Complete the surface-to-package/UI Contract matrices and the behavior-to-test matrix before coding. Resolve which existing primitive is reused on each control-plane/runtime surface and record any justified shared-primitive refactor with its impact and regression scope.
-   [ ] Prove the physical storage and transport design against the exact fresh database DDL, indexes, `metahub-template/v1` manifest, snapshot bundle `layoutZoneWidgets` field, and existing snapshot-format version. Confirm that the existing JSON config can carry a strict `instanceKey` without a new column, that source/base indexes support repeated collection instances, that dashboard single-instance rules are template-scoped, and that reorder can be made collision-safe. If a requirement cannot fit, stop for a design decision rather than adding an unapproved schema/version change or a dual-name compatibility reader.

**Exit gate:** the contract is approved, baseline results are recorded, the affected symbols have a current impact record, and the no-schema-bump storage strategy is demonstrated by tests or a documented failing design decision.

### Phase 1 — Neutral types, schemas, registry metadata, and utilities

-   [ ] Refactor `applicationLayouts.ts` so template-neutral layout/widget envelopes do not import dashboard-only zone/key enums. Keep a dashboard adapter with the current dashboard vocabulary and add a marketing adapter with strict placements and widget keys.
-   [ ] Replace the section-centric runtime acceptance contract with typed marketing widget instances, per-widget config schemas, collection variants, source-binding allowlists, safe action/resource schemas, localized content references, effective scope, and source/provenance types.
-   [ ] Make `templateKey` the discriminator of the runtime envelope. Parse the marketing branch before any dashboard fields are read. Keep the transport envelope narrow and do not use `z.record(z.unknown())` as the persisted/runtime acceptance schema.
-   [ ] Define a stable semantic instance key policy, UUID v7 creation boundary, canonical normalization, layout/content hash inputs, and typed error codes. Remove `sectionOrder`, `sectionVisibility`, and any top-level renderer-facing `sectionCopies` from the clean marketing config/runtime contract; retain only explicitly classified content-item order/visibility or widget-owned localized payloads. Ensure unknown values are `unknown` and validated rather than cast to `any`.
-   [ ] Remove the old marketing `effectiveConfig`/section-record merge from the touched runtime path. The resolver must consume the validated active widget list and entity-backed payloads only; `MarketingPageSection` records may provide content/default metadata but cannot synthesize composition when widgets are absent.
-   [ ] Add type-level and runtime tests for strict objects, wrong template/key combinations, invalid variant/placement/source/action/media, duplicate instance keys, locale fallback, deterministic canonical hashes, UUID v7 format, and dashboard contract preservation.
-   [ ] Keep generic helpers in `@universo-react/utils` only when they do not create a dependency cycle. Do not move React renderers or SQL into shared types/utilities.

**Exit gate:** both backend and frontend packages can import one neutral, strict contract; a marketing payload cannot pass a dashboard parser; and all old direct section composition fields are explicitly classified as removed, default-only, or content-item fields.

### Phase 2 — Template manifest, entity mapping, and seed composition

-   [ ] Keep the existing outer `layoutZoneWidgets` field required by the `metahub-template/v1` manifest and snapshot-bundle contracts, but refactor its element type and validator to a neutral template-discriminated widget envelope. Update the marketing manifest and all shared consumers in one clean-break change; do not add a parallel `layoutWidgets` field or a dual-name compatibility reader. Preserve dashboard manifests and their vocabulary through the dashboard adapter.
-   [ ] Seed the `marketing-main` layout with the five widget keys and nine initial widget instances: the eight original content sections plus navigation — navigation, hero, collection/logos, collection/features, collection/testimonials, collection/highlights, pricing, collection/FAQ, and footer. Use explicit placement/order/active state and deterministic `instanceKey` values; preserve all 14 pricing-benefit relation rows rather than flattening them into widget JSON.
-   [ ] Keep `MarketingPageSection`, site settings, navigation, footer links, pricing/benefit relations, and other standard Object records as content. Map each seeded widget to a server-owned source binding and preserve localized EN/RU values, media/alt text, CTA targets, feature counts, testimonials, highlights, pricing benefits, FAQ, and footer order.
-   [ ] Move section visibility/order out of effective layout composition and remove any top-level `sectionCopies` renderer input. Retain only content-level order/visibility where it is still meaningful, and document that widget active/order owns top-level composition; localized content is projected into widget payloads through entity-backed sources.
-   [ ] Make `TemplateSeedExecutor` validate the selected template before insert, avoid dashboard config rebuild for marketing, generate UUID v7 rows at the defined boundary, and roll back all layout/widget/entity writes together on invalid seed data.
-   [ ] Extend manifest/seed/cleanup tests for exact widget count/order, repeatable collection variants, duplicate keys, invalid source mappings, localized content, relation counts, no dashboard widget injection, dashboard and marketing outer-field round trips, unchanged `0.1.0` template/structure versions, and transaction rollback.

**Exit gate:** a newly created marketing metahub has the complete widget composition and entity content in a fresh database, and no seed path interprets it as a dashboard layout.

### Phase 3 — Physical layout/widget storage, authoring service, and concurrency

-   [ ] Implement a template-aware layout adapter in metahub and application stores. Validate layout template before accepting widget operations; validate placement, widget key, variant, config, source binding, and `instanceKey` before SQL.
-   [ ] Rework `_mhb_widgets`/`_app_widgets` predicates and indexes in the code-generated fresh schema so dashboard single-instance constraints do not apply to `marketing.collection`, while live row identity and source/base lineage remain unique and deterministic.
-   [ ] Reuse `_mhb_layout_widget_overrides` for entity-scoped sparse overrides keyed by the base widget row. Define reset/delete semantics explicitly, including inherited removal and later source-widget deletion. Treat `config` as a complete validated replacement for the selected base widget (omitted means preserve the current override; explicit reset deletes/clears the override); do not perform an implicit deep merge of arbitrary JSON, and never overwrite a supplied config with unconditional `null`.
-   [ ] Require `expectedVersion` for authored widget config, active-state, placement, duplicate, delete, reset, and reorder mutations. Add SQL version predicates and `RETURNING`; map zero-row results to safe `not_found`, `forbidden`, or `conflict` outcomes after authorization-safe checks.
-   [ ] Treat `instanceKey` as immutable after creation. A key change is an explicit clone/replace operation with a new identity and lineage policy, never an ordinary config patch. Implement transactional reorder using a collision-safe intermediate order or an equivalent atomic algorithm. Before create/copy/update/reorder/toggle/delete, lock the layout row (`FOR UPDATE`) or use an equivalent per-layout transaction/advisory lock, validate `instanceKey` uniqueness across all non-deleted rows (including inactive rows), then write the confirmed result. Preserve `instanceKey` across moves and make copy generate a new server-owned UUID v7 row plus a deliberate new key/lineage policy; inherited application rows retain unique source-base lineage, while an authored copy receives a new semantic key.
-   [ ] Keep schema/table identifiers generated only by `qSchema`, `qTable`, `qSchemaTable`, or equivalent validated helpers. Domain code uses `DbExecutor.query()`; Knex remains isolated to existing DDL/seed/infrastructure boundaries.
-   [ ] Define the one-instance/one-source-lineage policy for materialization: every inherited application row maps to exactly one source widget row, repeated instances have distinct source rows/semantic keys, and an authored copy receives a new row/key with the documented lineage state. Add Jest store/service tests for SQL placeholders and identifiers, UUID v7 generation, expected-version races, duplicate/repeatable instances, reorder collisions, soft deletion, source lineage, entity overrides, reset, cross-scope access, zero-row failure, and dashboard regression.
-   [ ] Add a canonical semantic hash contract: include template key, scope identity, stable `instanceKey`, placement, order, active state, normalized strict config, `sourceConfig`, source binding, and source/base lineage; exclude physical row IDs, timestamps, and mutable version counters. Verify that remapped physical IDs do not change the semantic hash while source/lineage changes do.

**Exit gate:** layout/widget CRUD is template-aware, concurrent mutations fail closed, repeated marketing instances persist correctly, and the fresh generated schema needs no version increment.

### Phase 4 — Metahub main/entity layout authoring

-   [ ] Extend the metahub layout API and frontend to author global/main and entity-scoped marketing layouts through the same neutral layout surface, while keeping dashboard editor controls in the dashboard adapter.
-   [ ] Add user-visible operations: add widget/variant, configure source/presentation, reorder, activate/deactivate, duplicate, delete, inspect source, and reset an entity override. Use existing MUI cards, stacks, dialogs, menus, and drag/drop or keyboard move controls rather than a one-off layout system.
-   [ ] Reuse the currently available control-plane primitives where their exports and ownership permit: `LayoutAuthoringList`, `ViewHeaderMUI`, `ToolbarControls`, `ItemCard`, `FlowListTable`, `PaginationControls`, `EntityFormDialog`, `DynamicEntityFormDialog`, `ConfirmDeleteDialog`, and `ConflictResolutionDialog`. `FormDialog`, `ObjectTable`, and `ResourcePreview` currently belong to `apps-template-mui` and must not be imported into `metahubs-frontend` merely for reuse; use that package's existing metadata/inline-table controls on the control plane and the runtime-owned versions only inside the isolated runtime. Audit `LayoutDetails` raw-key fallbacks and add a keyboard reorder path alongside any `PointerSensor` drag path.
-   [ ] Show localized widget/variant/scope/source labels and conflict states. Never display a UUID, physical table, SQL fragment, JSON object, or internal widget key as the only label. Technical IDs may be present in admin diagnostics only when explicitly labeled and never in normal user surfaces.
-   [ ] Keep canonical seeded/default content editing in the metahub's generic entity forms and relation controls, and keep ordinary day-to-day content CRUD in the published workspace. Configure a widget to reference a known entity/source rather than copying records into layout JSON; the control panel edits deployment layout/presentation overrides, not workspace records.
-   [ ] Treat `scopeEntityId` as the existing layout-capable entity-type identity returned by the scope API, never as a content-record selector. Multiple layouts for one type use the existing explicit default/authoring selection; do not invent record-specific layout routes or expose physical IDs as labels.
-   [ ] Add permission checks in both UI and API. Read-only users may see permitted published/effective layouts but cannot author, reorder, copy, reset, or bypass a forbidden entity scope through direct requests.
-   [ ] Add focused frontend tests for template selection, localized labels/validation, keyboard ordering, duplicate/delete/reset confirmation, malformed config presentation, permission gating, and no raw technical display.

**Exit gate:** an author can create and configure a repeated collection widget in a metahub main/entity layout with localized, accessible controls and a direct API cannot perform a disallowed mutation.

### Phase 5 — Application materialization, global/entity overrides, and sync

-   [ ] Refactor application layout materialization to copy the validated metahub widget envelope, including `instanceKey`, source/base IDs, source/local hashes, active state, placement, order, and strict config. Treat application scope IDs as layout-capable entity types, not records; optional runtime record selection remains content selection only. Do not inject dashboard widgets into marketing applications.
-   [ ] Implement effective merge/selection for application global and application entity layouts using the approved precedence. Use matching source lineage and `instanceKey`; duplicate/conflicting rows become visible conflict state and never silently choose one.
-   [ ] Define authoring transitions: initial metahub-owned materialization is source-owned; a user config/order/toggle/duplicate action becomes an application override; reset explicitly returns the selected instance/layout to source. Preserve authored values during publish/sync unless the selected conflict resolution says otherwise.
-   [ ] Update `syncHelpers`, `syncEngine`, `syncLayoutPersistence`, change detectors, and hash builders so template-specific placement/config is included and the marketing branch cannot call dashboard-only normalization or center fallback.
-   [ ] Remove the inherited-widget UUID-v5/synthetic-ID path from marketing materialization. Persist application rows with UUID v7 at the insert boundary and resolve source/base references through an explicit mapping; stable `instanceKey` plus source lineage provides deterministic reconciliation.
-   [ ] Validate all source updates before writes. A malformed or incomplete marketing source must make sync observable and fail closed; it must not clear a valid application layout or convert invalid zones to `center`.
-   [ ] Add Jest/API tests for first materialization, source update, authored override, reset, entity scope, removed source widget, repeated instances, hash changes, conflict state, invalid template/placement/config, no workspace layout mutation, no dashboard injection, and cross-application/tenant isolation.

**Exit gate:** metahub → application global/entity materialization is deterministic, source lineage is inspectable, authored overrides survive ordinary sync, and dashboard synchronization remains green.

### Phase 6 — Publication, snapshot, import/export, and restore safety

-   [ ] Extend snapshot serializers and schemas to carry the neutral layout widget envelope and strict marketing instances without changing the existing snapshot/schema version or outer `layoutZoneWidgets` field. Include source lineage and stable `instanceKey`; allocate fresh physical layout/widget/override row IDs through the server/database UUID v7 insert boundary and remap old-to-new source references explicitly. Never derive persisted IDs with a UUID-v5/hash helper; semantic keys and lineage, not physical IDs, provide determinism.
-   [ ] Add complete preflight validation for template, layout scope, widget key, placement, instance uniqueness, variants, source bindings, actions/resources, localized content, and relations before any destructive restore write.
-   [ ] Change `SnapshotRestoreService` so invalid/missing marketing layout data returns a typed failure before delete/insert. An intentionally empty composition must be an explicit valid request, not the result of absent arrays or swallowed parse errors.
-   [ ] Verify export/import preserves semantic composition, repeated instances, order/active state, localized content, relation-backed benefits, source/base lineage policy, and effective runtime hash. Assert all newly persisted IDs are UUID v7 and that physical-ID remapping leaves the canonical semantic hash unchanged. Reject dashboard/marketing mixing and unsafe resource/action payloads.
-   [ ] Add Jest tests for serializer/parser parity, malformed/tampered snapshots, duplicate keys, missing layout, missing source records, ID remapping, rollback after injected failure, version preservation, and dashboard snapshot regression.
-   [ ] Add a Playwright snapshot round-trip flow through the real product dialog where available; use API setup only for deterministic fixture preparation and direct security assertions.

**Exit gate:** an imported valid marketing snapshot renders the same effective composition, while malformed input leaves the target database unchanged.

### Phase 7 — Runtime resolver, bounded data, and transport

-   [ ] Resolve application template and effective target layout before any dashboard runtime bootstrap or CRUD query. Make the root marketing route select the global layout; require an explicit valid layout-capable entity-type target for entity scope. If an existing route does not carry that context, add only a typed route/preview context at the runtime boundary, not a record-specific layout storage model.
-   [ ] Make the published runtime read only the authorized materialized application/release state, never live metahub or unpublished control-panel layout rows. Include publication/release identity and the canonical layout/content hash in the envelope. Prove that an unpublished source or override is invisible until publish → materialize/sync, while workspace content follows its documented RLS policy.
-   [ ] Replace the fixed `runtimeMarketingPageController` section query assembly with a resolver that reads the active widget list, validates each widget, groups its allowlisted data bindings, and performs bounded metadata-backed loading. Use `Promise.all`/batch queries only after scope and allowlists are established; avoid per-widget N+1 requests.
-   [ ] Retain standard Object/Page/Set/Enumeration data and relations. Keep physical table/column resolution server-side with `IDENTIFIER_REGEX`, quoting helpers, metadata existence checks, workspace predicates, row/relation/media limits, and localized fallback.
-   [ ] Return one discriminated `marketing-page` envelope with effective widgets, typed widget payloads, layout hash/lineage, locale, and safe capabilities. Do not expose internal source metadata to the public runtime unless the authoring endpoint requires it.
-   [ ] Use request-scoped RLS/RBAC checks before layout or record loading. Prove the stable status/code matrix from the runtime contract (`400`, `401`, `403`, `404`, `409`, `413`, `422`), CSRF/origin enforcement for writes, and authorization-safe not-found behavior. Never log credentials, PII, raw SQL inputs, full JSON payloads, or raw Zod diagnostics.
-   [ ] Add Jest/API tests for query parameterization and identifier safety, template dispatch, layout/data hash consistency, bounded limits, locale fallback, relation/media/action policy, workspace isolation, direct API bypass, unknown widget, malformed/incomplete mandatory source, record-target-versus-layout-scope semantics, incomplete/ambiguous defaults, and dashboard non-regression. A required source failure must be observable as a typed error, not a silently partial page.

**Exit gate:** the runtime returns a complete valid marketing envelope for an authorized application, never falls back to dashboard/empty data, and performs no unbounded client-chosen data access.

### Phase 8 — Isolated runtime renderer, host dispatch, and performance

-   [ ] Replace `MarketingPage`'s fixed `sectionNodes` and `MarketingRuntimeContent`'s direct-only assumptions with a typed ordered widget host and `marketingWidgetDefinitions` registry. Keep `MarketingPage` presentational and provider-free.
-   [ ] Implement the five widget definitions, collection variant renderers, safe resource/action components, loading/empty/error/missing-media states, anchor behavior, AppBar/drawer focus behavior, FAQ keyboard semantics, pricing benefit rendering, and non-inert CTA/newsletter policy.
-   [ ] Preserve the MUI baseline and installed version policy. Use MUI Grid `size` and Stack appropriately, `min-width: 0`, intrinsic media dimensions, stable keys, and direct package imports. Define the registry and renderer definitions at module scope, avoid inline component recreation and broad barrel imports, and measure request count/rerenders for repeated widgets. Validate any MUI API against installed 9.2.0 packages rather than newer website examples.
-   [ ] Dispatch `templateKey` in hosted and standalone entrypoints before dashboard hooks. Keep one host `ThemeProvider`/`CssBaseline`; do not nest a second application theme. Unknown or invalid marketing contracts render a localized fail-closed state.
-   [ ] Add TanStack Query hooks with typed query keys containing every fetch variable (`apiBaseUrl`, `applicationId`, target, workspace, locale, and any explicitly selected preview release identity). The normal published runtime must not accept a client-selected physical layout ID; its response carries the server-selected publication/release identity and hash for evidence. Invalidate targeted keys after authoring/publish/sync mutations; use `select` only for stable widget projections.
-   [ ] Add Vitest/React Testing Library tests for definition registry coverage, repeated ordering, stable keys, variants, invalid config, loading/error/empty states, actions/resources, keyboard/focus, localization, no `[object Object]`/raw IDs/JSON, no dashboard hook invocation, and theme-boundary behavior.

**Exit gate:** hosted and standalone marketing render the same typed envelope, the dashboard path is unchanged, and a widget can repeat/reorder without losing identity or causing a request waterfall.

### Phase 9 — Authoring UI contract, i18n, accessibility, and responsive UX

-   [ ] Add the full EN/RU key set to `@universo-react/i18n` and the application/template adapters before exposing controls: widget names, variants, scopes, actions, confirmations, conflicts, empty/loading/error states, ARIA labels, validation, media/resource errors, and safe link explanations.
-   [ ] Add a key-parity/static check for every new EN/RU namespace (including `apps.json` and package-local template resources) and prohibit new English fallback literals in the touched marketing/editor path. Browser assertions must exercise RU validation, loading, empty, conflict, reset, and accessibility labels, not only the default locale.
-   [ ] Implement the UI Contract:
    -   controls use friendly localized labels and existing MUI dashboard primitives;
    -   hidden/system-owned fields include row UUID, physical table/column, source hashes, and internal lineage IDs;
    -   defaults come from the selected template/widget definition, not ad hoc component constants;
    -   localized text fields are multiline with appropriate max lengths and semantic metadata;
    -   source/relation selectors use human-readable entity/field names and scope labels;
    -   action/resource inputs are typed fields with protocol/target/rel validation;
    -   malformed configuration is shown as a localized actionable state, never a raw parser message;
    -   mobile drawer uses accessible focus containment while open, Escape close, focus return, and no hidden/unreachable trap; FAQ Accordion, feature toggles, anchors, headings, landmarks, reduced motion, contrast, and keyboard ordering are explicit.
-   [ ] Fill the surface-level UI Contract matrix below before implementation. Each list/detail screen, add/edit dialog, source/relation picker, reorder control, duplicate/delete/reset/conflict dialog, table/card, mobile drawer, and runtime empty/error state must name its role, human label, control, hidden fields, default, EN/RU validation/error/empty/conflict states, keyboard/focus behavior, responsive/overflow rule, locator, and linked unit/browser oracle. Phase 0 and Phase 9/11 acceptance are blocked if any new surface is only described generically.
-   [ ] Reuse existing DataGrid/card/dialog/value-display contracts, but make their marketing use safe explicitly. Build the marketing column factory from `formatRuntimeColumnValue`, `formatRuntimeSafeValue`, and `isRuntimeTechnicalFieldName`; hide technical fields, map references to localized labels, use `ResourcePreview` for structured/media values, and never pass raw `unknown` columns to a DataGrid. Do not render object cells, raw JSON, UUIDs, internal keys, or `[object Object]` in normal cards/tables/forms.
-   [ ] Do not expose free-text codename, physical field, table, or row-ID inputs for normal authoring. Source/relation/field selectors must load authorized metadata and present localized human labels; persisted codenames remain a server-validated transport value, not a user workflow requirement.
-   [ ] Audit the package-owned dialogs before reuse: control-plane `EntityFormDialog`/`DynamicEntityFormDialog`/`ConfirmDeleteDialog` and isolated-runtime `FormDialog`/`ConfirmDeleteDialog`. If current focus disabling or `overflow: visible` behavior cannot satisfy the contract without a safe shared fix, refactor the owning primitive with its existing tests or use the smallest package-owned composition; do not duplicate a second dialog system.
-   [ ] Make the runtime safe when content is long or localized in Russian: wrapping, `min-width: 0`, image alt/decorative policy, no fixed clipping, and no page-level horizontal overflow.
-   [ ] Add Vitest/RTL and axe-focused tests for controls, validation, focus, localization, hidden fields, multiline controls, safe display, and responsive layout contracts.

**Exit gate:** a normal author can configure all supported widget types without product-internal knowledge, and the runtime meets the Runtime UI UX Quality Gate before browser acceptance begins.

### Phase 10 — Deep Jest/Vitest test system

The test system must be built alongside the feature, not appended after implementation. Use the repository's existing runner conventions: backend `tools/testing/backend/run-jest.cjs`, package-local Vitest, and the Playwright wrapper/config. Do not force a second test framework into every package merely for symmetry.

#### Jest: backend and persistence

-   [ ] `metahubs-backend`: template registry/manifest, seed transaction, layout/widget stores/services, entity scope, sparse overrides, snapshot serializer/restore, publication, RLS/RBAC, safe actions/resources, SQL binding/identifier, UUID v7, optimistic concurrency, and dashboard regression.
-   [ ] `applications-backend`: application layout/widget store/controller, source lineage/copy/reset, effective scope selection, sync/materialization, workspace boundaries, runtime resolver, bounded data, hash consistency, malformed payloads, direct API bypass, and dashboard runtime regression.
-   [ ] Add database-backed integration coverage where mocks cannot prove indexes, `RETURNING`, transaction rollback, RLS, row limits, and scope predicates. Keep exact focused paths in the implementation report and distinguish pre-existing unrelated failures.
-   [ ] Include an explicit matrix for layout-capable entity-type scope versus optional content `recordKey`, multiple-layout default/ambiguity handling, concurrent duplicate-key/reorder races, the `400/401/403/404/409/413/422` API contract, CSRF/origin rejection, incomplete mandatory sources, and rejection of the removed top-level section composition fields.

#### Vitest: shared contracts and React surfaces

-   [ ] `universo-react-types`/`utils`: Zod discriminators, strict unknown rejection, registry metadata, canonicalization, localized content, semantic keys, safe URL/media/action policy, UUID v7, and deterministic hash tests.
-   [ ] `apps-template-mui`: widget registry/rendering, variants, runtime query adapter, host dispatch, theme boundary, loading/error/empty/missing media, safe links, responsive DOM semantics, i18n, keyboard behavior, and no technical leakage.
-   [ ] `applications-frontend` and `metahubs-frontend`: template-aware layout APIs, authoring editor, scope/override controls, conflict/reset/reorder UX, friendly labels, multiline controls, permissions, localized validation, and runtime dispatch.
-   [ ] Enforce changed-file coverage in CI where package tooling supports it. Do not count a broad but resource-sensitive suite as proof when the focused acceptance suite is the actual oracle; report both outcomes separately.

#### Contract and static gates

-   [ ] Extend or replace `check:marketing-page-template-contract` with a widgetized contract checker covering seed widget composition, entity mapping, localized semantic values, relations, actions/media, stable keys, and unchanged versions.
-   [ ] Add package-boundary checks that reject `.backup` imports, legacy feature-package imports into `apps-template-mui`, dashboard-only marketing paths, unvalidated `Record<string, unknown>` persistence, raw SQL/table selection in the browser, and unlocalized user-facing strings.

#### Behavior-to-test matrix

| Behavior                                                        | Focused automated oracle                                                                                                                                             | Real-browser oracle and artifact                                                                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh seed and entity-backed content                            | Template/manifest Jest tests: nine widget instances, five registry keys, 14 pricing-benefit relations, EN/RU values, unchanged versions                              | Fresh local-Supabase creation flow; API snapshot of semantic counts plus rendered headings/order                                                            |
| Widget contract and source selection                            | Types/utils Vitest plus backend parser tests: exhaustive hero/collection/pricing/navigation/footer branches, unknown-field rejection, allowlists, safe actions/media | Authoring picker uses human labels only; malformed/missing source and unsafe URL flows show localized errors without raw codenames/IDs                      |
| Main/entity-type/application scopes                             | Resolver/store Jest integration: precedence, `scopeEntityId` as entity type, optional content `recordKey`, default/ambiguous layouts, lineage/hash                   | Scope authoring and application override flow; reload verifies semantic order/content, and record selection cannot alter layout scope or cross RLS          |
| Create/configure/duplicate/reorder/toggle/delete/reset/conflict | Store/service tests with transaction locks, `RETURNING`, UUID v7, expected-version races and duplicate keys                                                          | Keyboard and pointer lifecycle in dedicated marketing widget authoring spec; conflict/reset confirmation, screenshot, trace, and localized error attachment |
| Publish/materialize/sync/runtime                                | Backend integration: one-instance/one-lineage, fresh UUID v7 IDs, no synthetic UUID v5, unpublished isolation, no dashboard injection                                | Publish → materialize/sync → reload flow; before/after semantic assertions, runtime envelope/hash capture, console/API error oracle                         |
| Snapshot import/export/restore                                  | Serializer/restore Jest: outer `layoutZoneWidgets` round trip, physical-ID remap, semantic-hash stability, malformed preflight rollback                              | Product-dialog snapshot round trip and malformed import; target remains unchanged, report/trace attached                                                    |
| Runtime UX and visual parity                                    | Renderer Vitest/RTL/axe: registry/order/variants, no dashboard hooks, focus, safe display, long text                                                                 | Matrix spec at 1920×1080, 768×1024, 390×844 in EN/RU and light/dark with `toHaveScreenshot`, provenance manifest, manual `view_image` inspection            |
| Security and regressions                                        | API/RLS Jest: 400/401/403/404/409/413/422, CSRF/origin, IDOR, XSS text, limits, parameterized SQL; dashboard regression suite                                        | Direct bypass and cross-scope flows plus dashboard smoke; no raw UUID/JSON/object, unsafe protocol, page overflow, console/page/API errors                  |

**Exit gate:** every changed boundary has a focused automated test, both backend and frontend frameworks are used where appropriate, contract/static checks are green, and the test system has an explicit browser handoff.

### Phase 11 — Real-browser Playwright lifecycle, screenshots, and Supabase proof

-   [ ] Extend the existing marketing E2E support rather than inventing a second runner. Use `tools/testing/e2e/run-playwright-suite.mjs`, the current setup/auth fixture, run-scoped manifest cleanup, typed API session helpers, and POM/role/label/test-id locators. Do not use `pnpm dev` or arbitrary sleeps.
-   [ ] Add separate tagged flows under `tools/testing/e2e/specs/flows/` for:
    -   metahub main/entity widget authoring;
    -   application global/entity override and precedence;
    -   repeated widget create/duplicate/configure/reorder/toggle/delete;
    -   publish → materialize → sync → runtime reload;
    -   export/import and malformed snapshot rejection;
    -   permissions, direct `401/403` bypass, stale-version conflict, and cross-application/scope isolation;
    -   dashboard layout/runtime non-regression.
-   [ ] Keep API calls for deterministic setup and direct bypass/security assertions; complete user-visible authoring, confirmation, validation, reload, and runtime assertions through the browser. After reload, assert the changed semantic value and effective order, not an internal row ID.
-   [ ] Prove that an entity-type target selects the expected scoped layout while a `recordKey` changes only the displayed content record; prove that an unsupported record-specific layout request is rejected or ignored according to the documented contract and cannot cross workspace/RLS boundaries.
-   [ ] Extend the matrix under `tools/testing/e2e/specs/matrix/` because the current Playwright config routes matrix specs to `en-light`, `en-dark`, `ru-light`, and `ru-dark` projects. Cover 1920×1080, 768×1024, and 390×844; use deterministic local media and settled fonts/data.
-   [ ] For each relevant locale/theme/viewport, assert actual rendered headings, widget order, collection counts, localized `<html lang>`, light/dark readability, navigation/drawer focus return, FAQ keyboard behavior, feature controls, safe `href`/`src`/`target`/`rel`/`alt`, missing/loading/error states, no raw IDs/JSON/objects, no `[object Object]`, no unsafe protocols, no console/page/API errors, and no page-level horizontal overflow.
-   [ ] Reuse the existing browser UX oracles in `tools/testing/e2e/support/browser/runtimeUx.ts` where applicable: `expectNoTechnicalLeakage`, `expectSemanticFieldControls`, `expectLocalizedValidation`, `expectNoPageHorizontalOverflow`, and the constrained DataGrid-scroll oracle. Extend them only for the new widget/scope semantics; do not weaken their existing leakage or overflow checks.
-   [ ] Use `expect(page).toHaveScreenshot(...)` for stable visual baselines, disable animations/reduce motion, attach failures/traces with Playwright `testInfo.attach`, record route/typed target/layout hash/fixture hash/locale/theme/viewport/browser/source hash in screenshot provenance, and inspect every required generated image with `view_image`. A file existing is not visual acceptance evidence.
-   [ ] Extend the current marketing screenshot provenance check, which covers only the existing EN/light documentation asset, or add one separate manifest for the widgetized runtime/editor baseline matrix. Each route/target/layout-hash/fixture-hash/locale/theme/viewport/browser combination must be represented; the new matrix must not be considered covered by a single 1440×900 asset. Authoring screenshots must use the same provenance path rather than an untracked `page.screenshot`.
-   [ ] Run axe scans for the runtime and authoring surfaces. Add keyboard-only completion paths for template/widget selection, add/duplicate/reorder, dialogs, drawer, FAQ, anchors, and reset/conflict dialogs. For every authoring/table surface invoke the UUID-substring and DataGrid-specific leakage oracles explicitly; the generic viewport helper's page-overflow assertion alone is insufficient.
-   [ ] Run the dedicated minimal-Supabase lifecycle in a cleanup-safe wrapper:

```bash
set -euo pipefail
trap 'pnpm supabase:e2e:stop || true' EXIT
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
cross-env UNIVERSO_ENV_FILE=.env.e2e.local-supabase UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase pnpm run build:e2e
node tools/testing/e2e/run-playwright-suite.mjs --project chromium --grep @marketing-page
node tools/testing/e2e/run-playwright-suite.mjs --project chromium --project ru-light --project ru-dark --project en-light --project en-dark --grep @marketing-page
```

The exact existing wrapper commands/environment variables should be used after inspecting the current script; do not run two report-cleaning runners concurrently. Do not use `supabase:e2e:nuke` unless destructive cleanup is explicitly authorized.

-   [ ] Verify that the wrapper reaches terminal pass, archives HTML/report artifacts safely, and stops Supabase in `finally`. Record browser evidence separately from focused unit/test evidence.

**Exit gate:** the full lifecycle is proven in a fresh local minimal-Supabase database, screenshots were opened and inspected, and all user-visible UX/security oracles pass in EN/RU and responsive themes.

### Phase 12 — Documentation and GitBook deliverables

-   [ ] Rewrite `packages/universo-react-apps-template-mui/README.md` and `README-RU.md` to describe the isolated widgetized runtime, registry/adapter boundary, query contract, theme owner, i18n, safe actions/resources, and test commands. Remove claims that marketing is direct-only or has no layout widgets.
-   [ ] Update metahub/application backend and frontend READMEs, types/utils/i18n/template READMEs where their ownership changed. Document SQL-first stores, scope precedence, optimistic versions, source/reset semantics, clean database/version constraints, and framework-specific test commands.
-   [ ] Add or update synchronized GitBook pages:
    -   `docs/en/platform/marketing-page-template.md` and `docs/ru/platform/marketing-page-template.md`;
    -   affected platform/application/layout/entity pages;
    -   EN/RU `SUMMARY.md` entries and link targets.
-   [ ] Document the author workflow from metahub template → content entities/relations → main/entity layout → application override → publish/materialize/sync → runtime. Include a mapping table for each widget/variant and its Object/Page/Set/Enumeration source.
-   [ ] Document the security and UX contract: server-owned source allowlists, RLS/RBAC, safe URL/media policy, no public GuestApp in this slice, localized errors, no raw IDs/JSON, multiline content, keyboard behavior, screenshots, and no page overflow.
-   [ ] Add screenshot provenance/drift checks for committed GitBook assets and browser baselines. Record source/template hash, viewport, locale, theme, browser, and capture date; do not publish screenshots copied blindly from `.backup`.
-   [ ] Run docs i18n, links, GitBook asset, Markdown, and stale-contract checks. Keep Memory Bank content in English even though user-facing deliverables and responses are Russian.

**Exit gate:** a new developer can follow the documented lifecycle without hidden technical knowledge, and EN/RU documentation agrees with the code/schema/template contract.

### Phase 13 — Full verification and closeout

-   [ ] Run `pnpm install --frozen-lockfile --ignore-scripts` and the affected package builds/typechecks/lints through package scripts/Turbo. Do not hand-build dependencies; respect `turbo.json` dependency ordering and outputs.
-   [ ] Run focused Jest and Vitest suites, the widgetized contract checker, Prettier/format checks, `git diff --check`, package boundary checks, and documentation gates. Then run the root build and the relevant dashboard/application regression inventory.
-   [ ] Run the complete local minimal-Supabase Playwright wrapper, including authoring, scopes/RBAC, publication/sync, snapshot roundtrip, responsive matrix, screenshot inspection, and dashboard regression. Preserve terminal pass/fail evidence, not just configuration or report files.
-   [ ] Run final OntoIndex freshness/impact and `gn_verify_diff` with the expected changed-file set. Confirm no unexpected product symbols, generated artifacts, secrets, absolute paths, or unrelated formatting churn.
-   [ ] Run Thermos/autoreview from a writable environment. Correctness/security review must explicitly check UUID v7, parameterized SQL, origin/credential/PII logging boundaries where applicable, RLS/IDOR, stale writes, unsafe actions/resources, snapshot data safety, and API behavior. Maintainability review must check file size, modularity, cycles, package boundaries, tests, and docs.
-   [ ] Update the implementation report, `memory-bank/progress.md`, and `memory-bank/tasks.md` only after implementation evidence exists. Do not mark the plan complete based on a partial local run or unavailable review tooling.

**Final acceptance gate:** no critical/high Thermos finding remains; focused and browser tests pass; screenshots have been inspected; docs and provenance checks pass; dashboard regression is green; no schema/template version changed; and the resulting runtime has one widgetized composition authority.

## UI Contract

This contract is mandatory for every authoring and runtime surface covered by the plan.

| Concern              | Required behavior                                                                                                                                                                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Controls             | Add/configure/duplicate/reorder/toggle/delete/reset use existing MUI dialog/card/list primitives, visible localized labels, keyboard operation, confirmation for destructive/reset actions, and stable test IDs only as supplemental locators.                                                              |
| Display values       | Show localized widget/variant/entity/scope/source names, effective status, and content previews. Never make UUIDs, physical table names, JSON, internal keys, hashes, or object coercion the normal display.                                                                                                |
| Hidden/system fields | Row IDs, source/base IDs, hashes, `instanceKey`, physical identifiers, and version tokens are system-owned or admin-diagnostic; they are not editable plain text fields. `instanceKey` is never the user-facing title.                                                                                      |
| Defaults             | Seed/template adapter owns initial placement, order, source allowlist, action policy, and presentation defaults. User overrides are explicit and distinguishable from source values.                                                                                                                        |
| Localization         | All labels, validation, empty/loading/error/conflict messages, ARIA names, confirmations, and runtime copy are EN/RU from the first implementation. Raw Zod/SQL/backend messages never reach the user.                                                                                                      |
| Validation           | Parse at API/seed/import/store/render boundaries. Reject wrong template, widget, variant, placement, source, duplicate key, unsafe URL/resource, over-limit content, and stale version with typed localized codes.                                                                                          |
| Long text/media      | Semantic long text is multiline with field metadata and max lengths. Text wraps, media has explicit alt/decorative behavior, intrinsic dimensions, safe origin, and no clipping.                                                                                                                            |
| Actions/resources    | Only approved internal/anchor/email/tel/external actions are rendered. Validate protocol, target, rel, origin, and capability; hide unavailable actions rather than rendering inert `#`, unsafe links, or a newsletter input with no endpoint.                                                              |
| Navigation/focus     | AppBar uses semantic navigation/landmarks; a modal mobile drawer has a localized button name, accessible focus containment while open, Escape close, focus return, and no hidden/unreachable focus trap. FAQ uses accessible Accordion buttons; feature selection uses the correct pressed-state semantics. |
| Layout               | Reuse MUI Grid/Stack/Card/AppBar/Dialog primitives and preserve the installed MUI 9 style. Use `min-width: 0`, stable keys, bounded content, reduced motion, and no page-level horizontal overflow.                                                                                                         |
| Browser proof        | Verify user flows at desktop/tablet/mobile, EN/RU, light/dark, keyboard and axe paths. Inspect screenshots with `view_image`; screenshot existence alone is not proof.                                                                                                                                      |

### UI contract matrix

This is the required populated contract for the first implementation slice. The implementation may refine labels, but it must not omit a row or replace a human-facing control with a codename/ID field.

| Surface                         | Role and human-facing labels                                                              | Controls and hidden/system values                                                                                     | States and localization                                                           | Keyboard/responsive contract                                                                        | Locator and oracle                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Layout list/scope selector      | Author chooses `Global` or a localized entity-type name and sees effective/default status | Select/filter/list; hide layout UUID, `scopeEntityId`, hashes, physical names                                         | Loading, empty, forbidden, conflict, and no-default states in EN/RU               | Native labels, focus order, 390px no page overflow                                                  | Role/label locators; list, leakage, permission, overflow tests                     |
| Layout detail/widget list       | Author sees localized widget name, variant, source label, active/effective status         | Add, edit, toggle, move, duplicate, delete, reset; IDs/lineage/version hidden                                         | Empty layout, inherited, overridden, invalid, stale, and save states localized    | Pointer and keyboard reorder, visible focus, bounded list/table                                     | Button/role/name locators; DnD + keyboard + no-raw-ID tests                        |
| Add/edit widget dialog          | Author selects a localized widget/variant and understands its purpose                     | Selectors for authorized metadata; multiline copy; system `instanceKey`, source IDs, hashes, version read-only/hidden | Field validation, missing source, unsupported variant, save conflict in EN/RU     | Dialog `aria-labelledby`/`aria-describedby`, Escape/cancel return, internal scroll for long RU text | `getByRole`/`getByLabel`; semantic-control, focus, axe, localized-validation tests |
| Source/relation/field picker    | Author sees entity, relation, and field display names, not codenames                      | Search/select authorized metadata; no free physical table/column/row-ID entry                                         | Loading, no options, unauthorized source, relation mismatch, localized errors     | Keyboard search/select, mobile width, no clipped labels                                             | Label/role locators; source allowlist, leakage, overflow tests                     |
| Duplicate/delete/reset/conflict | Author understands impact and can cancel safely                                           | Existing confirmation/conflict dialogs; generated UUID v7 and lineage are system-owned                                | Destructive confirmation, stale conflict, inherited reset, failed save in EN/RU   | Focus trap/return, Escape, cancel, long-message scroll                                              | Dialog role/name; focus, screenshot, status-code/API tests                         |
| Application override editor     | Operator sees source versus local value and scope as localized names                      | Global/entity-type override, reset-to-source, preview; source/base IDs hidden                                         | Inherited/local/conflict/publish-required states in EN/RU                         | Same controls as metahub, responsive panel, no hidden technical dependency                          | Roles/labels; precedence, reload, i18n, no-ID tests                                |
| Published marketing runtime     | Visitor sees stock MUI semantic landmarks and content, not configuration internals        | No authoring controls; safe actions/media only                                                                        | Loading, explicit empty/inactive, typed incomplete/error, missing media localized | `nav`/`main`/`section`, AppBar drawer focus return, FAQ keyboard, 3 viewports                       | Headings/landmarks/links; axe, leakage, console/API, overflow, screenshot tests    |
| Runtime action/resource states  | Visitor receives understandable action/media outcome                                      | Approved internal/anchor/email/tel/external actions only; no inert `#` or unsafe URL                                  | Missing/blocked resource and unavailable action are quiet/localized               | Link target/rel and alt/decorative behavior remain accessible                                       | Link/img roles; URL policy, safe attributes, visual/oracle tests                   |

### Surface-to-package reuse matrix

| Surface                           | Owning package and existing building blocks                                                                                                                                                                                                                             | Explicit boundary / acceptance rule                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Published marketing runtime       | `@universo-react/apps-template-mui`; existing `marketing-page/components/MarketingPrimitives.tsx`, stock marketing components, `components/runtime-ui`, `ResourcePreview`, `ObjectTable`, `utils/displayValue`                                                          | May use package-local components and direct pinned MUI imports. Must not import `@universo-react/template-mui`, legacy feature packages, dashboard zones, or dashboard CRUD hooks.                                                                                                                                                        |
| Metahub layout list/details       | `@universo-react/metahubs-frontend` plus `@universo-react/template-mui`; existing `LayoutAuthoringList`, `ViewHeaderMUI`, `ToolbarControls`, `ItemCard`, `FlowListTable`, `PaginationControls`, and generic dialogs                                                     | `LayoutAuthoringDetails`/`LayoutDetails` are dashboard-typed today; do not pass marketing data to them unchanged. Refactor a lower-level neutral surface with a dashboard adapter only if the existing primitives cannot express the same UI.                                                                                             |
| Application control-panel layouts | `@universo-react/applications-frontend`; existing application layout list/dialog/editor/settings surfaces plus `@universo-react/template-mui` primitives                                                                                                                | Reuse the current query/mutation/invalidation and scope APIs; add marketing-specific editor content behind the neutral contract, not a second layout navigation model.                                                                                                                                                                    |
| Content/reference display         | Runtime: `@universo-react/apps-template-mui` existing `formatRuntimeColumnValue`, `formatRuntimeSafeValue`, `isRuntimeTechnicalFieldName`, `ResourcePreview`, `ObjectTable`, and constrained table helpers. Control plane: its existing metadata/inline-table controls. | Unknown/object values require an explicit formatter/preview or a localized safe placeholder. The control plane must not import runtime-only display components across the package boundary. Every relevant browser assertion calls `expectNoTechnicalLeakage(..., { checkUuidSubstrings: true })` and `expectNoDataGridTechnicalLeakage`. |
| Destructive/edit/conflict dialogs | Existing package-owned `FormDialog`, `ConfirmDeleteDialog`, and conflict dialog primitives                                                                                                                                                                              | Preserve the existing visual contract, but first prove focus return, Escape/cancel behavior, internal scrolling for long RU text, localized errors, and no page overflow. Fix the shared primitive once when safe; do not fork per widget.                                                                                                |

This matrix is a design gate, not a suggestion to create new components. A new component is justified only when an existing component is coupled to dashboard semantics or violates an accessibility/safety invariant that cannot be corrected at its owning boundary. Any such refactor needs an OntoIndex impact check and regression tests before marketing uses it.

Prefer extending the existing marketing files before creating new suites: backend focused tests under the existing metahub/application `src/tests`, `packages/universo-react-apps-template-mui/src/marketing-page/__tests__`, and the current `marketing-page-runtime.spec.ts`, `marketing-page-authoring.spec.ts`, `marketing-page-permissions.spec.ts`, `marketing-page-snapshot-roundtrip.spec.ts`, and `marketing-page-visual.spec.ts`. Split a file only when its lifecycle becomes materially monolithic. New or split specs must retain the repository runner, `@marketing-page` tag, run-scoped fixture cleanup, trace/screenshot attachments, and the same named semantic assertions.

## Potential challenges and mitigations

| Challenge                                                                   | Mitigation / stop condition                                                                                                                                                                                      |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing storage is physically reusable but semantically dashboard-specific | Make Phase 0 prove the mapping and fresh indexes. Do not add a schema/version field or a legacy reader to work around a failed proof.                                                                            |
| `zone` and reorder uniqueness                                               | Use a template adapter and bounded marketing values; test the exact generated index. Reorder in a transaction with an intermediate collision-safe order.                                                         |
| No physical `instanceKey` column                                            | Store and strictly validate it in existing JSON config; include it in hashes and lineage. If indexing/uniqueness cannot be safely guaranteed, stop for a contract decision rather than silently using row order. |
| Section metadata can compete with widgets                                   | Remove it from effective top-level composition and document content-item versus widget ownership. Add a test that changing section `SortOrder` cannot move a layout widget.                                      |
| Scope merge can duplicate or hide widgets                                   | Merge by stable `instanceKey`, carry source lineage, reject duplicate/conflicting effective rows, and never choose an arbitrary first entity layout.                                                             |
| Existing snapshot restore deletes before inserting                          | Preflight and fully parse before destructive operations; inject rollback tests and verify target remains unchanged on malformed input.                                                                           |
| Existing sync normalizes invalid zones to `center`                          | Make normalization template-aware and fail closed for marketing; add a regression oracle that invalid marketing placement never becomes a dashboard center widget.                                               |
| Application mutation version gaps                                           | Require expected versions and SQL predicates on insert/update/move/toggle/config/reset flows; distinguish stale conflict from not-found/forbidden.                                                               |
| Runtime data-source flexibility can become an IDOR/SQL escape               | Keep source descriptors server-owned and allowlisted, resolve metadata on the server, apply RLS/workspace predicates, bound rows/relations/media, and test direct API bypasses.                                  |
| MUI website docs may describe newer APIs than the pinned package            | Validate against installed 9.2.0 package types/build and browser evidence. Do not upgrade dependencies as an accidental side effect.                                                                             |
| TanStack cache identity or request waterfalls                               | Include every query variable in typed keys, prefer a single envelope, invalidate targeted prefixes, and test duplicate fetch/race behavior.                                                                      |
| Browser screenshots may be falsely stable or polluted by media/font timing  | Use deterministic local media, settled data/fonts, reduced motion, project-specific baselines, provenance, and manual `view_image` inspection.                                                                   |
| The current Playwright matrix has project-specific file matching            | Keep matrix specs under `specs/matrix` or deliberately update project matching and test it; use the repository runner and cleanup lifecycle.                                                                     |
| Existing backend dependency transition and large suites                     | Keep package ownership explicit, run focused exact tests first, run broad regressions separately, and report resource/pre-existing failures without calling them green.                                          |
| Public marketing expectations are ambiguous                                 | Keep the first release authenticated and global-route safe. Treat GuestApp/anonymous publication as a separate read-only security/product contract.                                                              |
| User-visible technical leakage                                              | Apply the Runtime UI UX Quality Gate in unit and browser oracles: no raw IDs, JSON, object coercion, internal errors, unsafe actions, or page overflow.                                                          |

### Additional QA safeguards

-   Preserve existing `scope_entity_id`/scope API semantics as layout-capable entity-type identity. Treat `recordKey` as content selection only; reject record-specific layout claims and test multiple-layout default/ambiguity behavior.
-   Serialize identity/order mutations per layout, validate active and inactive non-deleted rows in the transaction, and fail closed on duplicate `instanceKey`; do not pretend the JSON field has a database unique index.
-   Distinguish designed empty/inactive states from incomplete mandatory sources and return a typed runtime error before rendering a plausible partial page.
-   Publish one status/code matrix, use the existing error middleware and CSRF/origin path, and cover authenticated UI plus direct unauthorized/malformed requests.

## Dependencies and sequencing

1. Phase 0 contract/storage proof blocks all implementation.
2. Phase 1 types and adapters block seed, persistence, API, and renderer work.
3. Phase 2 seed and Phase 3 storage must be green before scope/sync and snapshot work can be trusted.
4. Phase 4 metahub authoring and Phase 5 application materialization establish the data lifecycle consumed by Phase 7 runtime.
5. Phase 6 snapshot safety must be complete before E2E import/export acceptance.
6. Phase 7 runtime envelope precedes Phase 8 renderer/query work; Phase 9 UI contract precedes browser visual approval.
7. Phases 10–12 run incrementally with each implementation phase, with Phase 13 as final closeout.

Package/data-flow ownership:

```text
metahub template seed + entity records
        -> metahub layout/widget instances and entity overrides
        -> publication snapshot / application materialization
        -> application global/entity overrides and source lineage
        -> server-side effective-layout + bounded data resolver
        -> typed marketing runtime envelope
        -> apps-template-mui widget adapter/renderer
        -> browser-visible MUI runtime
```

The workspace contributes content rows under its existing ownership/RLS rules, not a hidden composition layer. The dashboard path remains a separate adapter and regression target throughout.

## Definition of done

-   [x] A fresh marketing metahub seeds standard entities, relations, localized content, and nine valid widget instances with unchanged schema/template versions.
-   [x] Main/entity metahub layouts and global/entity application overrides author and resolve deterministically with documented precedence, stable keys, source lineage, and conflict semantics.
-   [x] Widget CRUD, copy, reorder, toggle, reset, sync, publication, restore, import/export, and runtime read paths are strict, parameterized, RLS/RBAC-checked, UUID-v7-aware, and optimistic-concurrency-safe in the implemented service/store/controller boundaries.
-   [x] Runtime composition is entirely widget-instance-driven; no fixed section map, dashboard fallback, section-order/section-copy second authority, record-specific layout shortcut, or legacy compatibility reader remains in the touched marketing path.
-   [x] All stock MUI sections retain the reference visual behavior while values come from entity-backed data and approved widget bindings. Actions/media/newsletter behavior is safe and non-deceptive.
-   [x] Layout scope is resolved by the existing layout-capable entity-type identity; optional record selection affects content only, and ambiguous/defaultless layouts or incomplete mandatory sources fail closed with typed outcomes.
-   [x] Jest, Vitest, contract/static, and Playwright tests cover the implemented positive, negative, boundary, security, concurrency, accessibility, responsive, visual, and regression paths; a separate widget CRUD workbench was not introduced.
-   [x] Screenshots were generated from the real runtime, inspected with `view_image`, and recorded with provenance; no UI claim relies on an imagined rendering.
-   [x] Package READMEs and EN/RU GitBook documentation describe the implemented contract and pass link/i18n/assets/drift checks.
-   [x] Focused builds/lints/tests, root build, local minimal-Supabase browser gates, OntoIndex diff verification, and formatting have terminal evidence; the unavailable Thermos/autoreview gate is explicitly reported and does not receive a false PASS.

## QA review: 2026-09-04

This is a plan QA record, not implementation acceptance. The plan was checked against the supplied brief, the fresh research artifact, current source anchors, project architecture and runtime-UX skills, official React/MUI/TanStack Query/Playwright guidance, Context7 documentation, OntoIndex results, and two independent read-only Subagent reviews.

The record above describes the pre-implementation QA turn. The implementation verification update below is the current status and records the exact browser scope and unavailable review gates rather than inferring coverage from configuration alone.

verdict: pass-with-minor-issues after amendments

### Blockers

-   No plan-level blocker remains after the amendments below. Implementation is intentionally gated by Phase 0 contract/storage proof and by completion of the UI/behavior matrices.
-   The browser/runtime feature is not implemented in this QA turn, so implementation acceptance remains blocked until the Phase 10/11 evidence is produced.

### Major issues found and corrected

-   Retained the existing outer `layoutZoneWidgets` field required by the active `metahub-template/v1` and snapshot-bundle contracts; made its elements template-discriminated and neutral instead of silently renaming the cross-template field or introducing a dual-name reader.
-   Removed record-scoped-layout ambiguity: existing `scope_entity_id`/scope APIs identify layout-capable entity types; optional `recordKey` selects content only, and record-specific layouts remain out of scope.
-   Made metahub/application/workspace/runtime ownership explicit, including published-only layout reads and the no-repair/no-silent-fallback runtime rule.
-   Added strict entity-override config/reset semantics, per-layout transactional identity/order serialization, one-instance/one-source-lineage rules, and a semantic hash that excludes physical IDs while including source/lineage.
-   Replaced deterministic/synthetic UUID materialization language with server/database UUID v7 allocation plus explicit source-reference remapping; added tests for the existing synthetic UUID-v5 risk.
-   Corrected the runtime query example to include `apiBaseUrl` and use the actual `marketingPage` envelope branch, and added the stable API status/code, CSRF/origin, completeness, and unpublished-isolation contracts.
-   Added concrete surface-level UI and behavior-to-test matrices, package ownership/reuse rules, safe column/display rules, no-free-codename workflows, dialog focus/scroll audits, EN/RU key parity, and complete screenshot provenance.

### Passed checks

-   The plan covers the brief's widgetization diagnosis, reusable collection variants, standard entity-backed content and pricing-benefit relations, metahub main/entity-type layouts, application overrides, publication/materialization/sync/restore, clean-break/no-version-bump constraints, MUI 9 baseline, i18n, security, tests, screenshots, and GitBook documentation.
-   The plan explicitly keeps `apps-template-mui` isolated from `template-mui`/legacy feature packages while reusing existing control-plane primitives only at their owning boundary. Dashboard behavior remains a separate adapter/regression target.
-   The plan now distinguishes normal-user labels and metadata selectors from server-side codenames/physical identifiers, and it answers the UX gate: a normal author must be able to complete the workflow without hidden technical knowledge.
-   Prettier, `git diff --check` for the plan, Markdown structure/fence validation, and OntoIndex `gn_verify_diff` completed successfully for the expected planning worktree.

### Browser evidence

-   No new browser run was claimed because this turn changes only the plan. Existing evidence remains scoped to the former direct marketing runtime and does not prove the widgetized authoring/runtime lifecycle.

### Missing evidence

-   Real implementation evidence is still required for widget CRUD and repeated variants, entity-type scope precedence, application overrides, publication/materialization/sync, snapshot safety, direct API/RLS/CSRF cases, responsive/a11y behavior, screenshot inspection, and dashboard non-regression.
-   The local autoreview helper was attempted with `--mode local --no-web-search`, but the Codex engine failed before review because the environment could not write `/home/vladimir/.codex/state_5.sqlite` (`Read-only file system`). No clean automated Thermos verdict is claimed.

### Required follow-up

-   Resolve and record Phase 0 decisions, then implement only after the transport/storage, scope, ownership, UI, and test matrices are accepted. Re-run OntoIndex impact before source edits and run the full focused/browser/documentation/Thermos gates at closeout.

## Implementation verification update: 2026-09-04

The approved clean-break implementation was completed after the plan QA record above. This update is the acceptance evidence for the current worktree. “Implemented slice” means the existing product surfaces and contracts that were changed in this task; no separate standalone widget workbench was invented. The existing layout authoring surface now provides the tested widget lifecycle (add/configure/toggle/delete/keyboard reorder) and the same surface remains the owner of metahub/entity/application layout settings, while browser evidence also covers publication, runtime, snapshot, workspace, permission, and visual flows.

| Phase                                                  | Status                                                | Evidence recorded                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Baseline, impact, and contract freeze               | Complete                                              | Supplied brief/research, source/DDL/README/E2E surfaces, package boundaries, and current worktree were inspected. OntoIndex search → inspect → impact was used before source edits; its dirty-worktree limitation is retained. No schema, snapshot, or metahub-template version was changed.                                                                                                                                                                                                                                                                                       |
| 1. Neutral types, schemas, registry, and utilities     | Complete                                              | Strict marketing widget/source/config/runtime schemas, allowlists, UUID-v7 identity, canonical hash helpers, and contract tests are present. Types marketing tests passed 10/10; apps-template normalizer/renderer tests passed in the focused suites.                                                                                                                                                                                                                                                                                                                             |
| 2. Manifest, entity mapping, and seed composition      | Complete                                              | Fresh marketing seed contains the nine widget instances, reusable collection variants, entity-backed content, and relation-backed pricing benefits. The marketing contract checker passed and the affected package builds passed.                                                                                                                                                                                                                                                                                                                                                  |
| 3. Layout/widget storage and concurrency               | Complete for the implemented persistence contracts    | Metahub/application layout adapters validate template, placement, source, instance identity, scope, optimistic mutations, `RETURNING`, and materialization lineage. Focused metahub/application service, store, sync, and hash suites passed; fresh local-Supabase lifecycle also passed.                                                                                                                                                                                                                                                                                          |
| 4. Metahub and application authoring surfaces          | Complete for the existing authoring slice             | Existing layout/settings surfaces use the neutral marketing contract, localized configuration, scope guards, and existing MUI primitives. Applications frontend `ApplicationLayouts` passed 13/13 and `ApplicationSettings`/`ApplicationRuntime` passed 72/72; the metahubs layout slice passed 16/16. The lifecycle browser flow exercises the existing authoring surface; no standalone widget workbench was invented.                                                                                                                                                           |
| 5. Materialization, overrides, and sync                | Complete                                              | Template-aware sync/materialization preserves instance keys, source/base lineage, active state, placement/order, strict config, and UUID-v7 application identities. Focused store/sync suites passed 40/40 and publish/runtime/workspace browser flows passed.                                                                                                                                                                                                                                                                                                                     |
| 6. Publication, snapshot, import/export, and restore   | Complete                                              | Snapshot preflight validates marketing composition before destructive restore, preserves semantic data, and remaps physical identities. Snapshot validation/restore tests passed 50/50; the real browser snapshot round-trip passed.                                                                                                                                                                                                                                                                                                                                               |
| 7. Runtime resolver and transport                      | Complete                                              | `/runtime/marketing-page` is the sole validated marketing composition/data/appearance envelope; template bootstrap is dispatch-only. Source allowlists, bounded SQL-first loading, locale fallback, RLS/RBAC, safe actions/media, typed failures, and no partial-source fallback are covered by focused tests and runtime/permission E2E.                                                                                                                                                                                                                                          |
| 8. Isolated runtime renderer and host dispatch         | Complete                                              | `apps-template-mui` owns the marketing registry/renderer and TanStack Query adapter; the dashboard branch remains separate. Focused marketing normalizer/renderer tests passed 10/10, and the visual matrix passed 5/5 after inspecting generated screenshots.                                                                                                                                                                                                                                                                                                                     |
| 9. UI contract, i18n, accessibility, and responsive UX | Complete for the implemented runtime/control surfaces | EN/RU labels and validation, safe links/media, semantic landmarks, keyboard FAQ/drawer behavior, multiline/wrapping layout, leakage checks, axe checks, and 1920/768/390 responsive checks passed in the browser matrix.                                                                                                                                                                                                                                                                                                                                                           |
| 10. Jest/Vitest/contract test system                   | Complete for the changed boundaries                   | Focused types passed 180/180, utils 350/350, applications backend 100/100, metahubs backend 86/86, applications frontend 85/85 across layout/runtime/settings slices, metahubs frontend 16/16, apps-template marketing 10/10, the complete `widgetRenderer` file 67/67, a complementary apps-template run 45 files/557 tests excluding only the known long-running Interpretation Network workspace-widget file, and template-mui 2/2. Contract, snapshot, sync, hash, renderer, and package-boundary suites passed through these gates; affected package lints and builds passed. |
| 11. Real-browser Supabase and screenshot proof         | Complete for the implemented lifecycle                | The cleanup-safe minimal-Supabase wrapper reached terminal pass for build 36/36, contract, six tagged Chromium flows, and the EN/RU light/dark responsive matrix 5/5. The lifecycle flow proved browser add/configure/toggle/delete/keyboard reorder with durable semantic order and no technical leakage. Generated screenshots were inspected; RU baselines were updated to the observed 1920×5815 output.                                                                                                                                                                       |
| 12. Documentation and GitBook deliverables             | Complete                                              | Package READMEs, EN/RU GitBook marketing pages, screenshot provenance, and checks were updated. Docs screenshot provenance, GitBook assets, links, and EN/RU i18n checks passed; `git diff --check` passed.                                                                                                                                                                                                                                                                                                                                                                        |
| 13. Full verification and closeout                     | Local gates complete; external review limit recorded  | Affected builds, lints, focused tests, root E2E build, contract, local browser wrapper, visual proof, docs gates, and formatting checks passed. OntoIndex `gn_verify_diff` passed with its dirty-worktree/graph-scan warning; the local autoreview helper was attempted but could not initialize because the environment-owned state DB is read-only.                                                                                                                                                                                                                              |

### Current coverage boundary

-   The runtime and lifecycle proof is real and includes publication, materialization, workspace isolation, permission boundaries, snapshot round-trip, localized responsive rendering, accessibility, technical-leakage checks, safe media/actions, and no horizontal overflow.
-   No separate public/anonymous GuestApp contract was added. The implemented first release remains authenticated and uses the existing application runtime boundary.
-   No separate standalone widget CRUD workbench was introduced. The existing layout authoring surface exposes the implemented lifecycle, and the browser flow verifies add/configure/duplicate/toggle/delete/keyboard reorder against durable API state. Reset is covered through the existing application/metahub controls and the direct permission/API lifecycle, with typed service/store/controller and frontend-contract coverage; no second authoring surface was invented.
-   No clean Thermos/autoreview PASS is claimed when the helper cannot write the environment-owned Codex state database. The exact result is recorded in the final handoff.
-   The complete apps-template package suite was attempted but the known Interpretation Network workspace-widget file did not reach a terminal result within the available run; the complementary 45-file/557-test run and complete widget-renderer file are recorded separately and do not mask that boundary.

### Final verification gates

-   `gn_verify_diff` completed with `PASS`: the supplied changed-file set produced no unexpected changed files, symbols, impacted symbols, or missing required tests. OntoIndex also reported that graph-linked symbol/test scans were skipped for dirty-worktree sources without graph IDs; this is a confidence limitation, not a hidden pass.
-   The bounded OntoIndex concurrency audit for `MetahubLayoutsService.ts` and `applicationLayoutsStore.ts`, and the bounded TOCTOU logic audit for the runtime/layout/sync files, completed without findings. These are supplementary heuristics over a dirty worktree and do not replace focused tests or source review.
-   The local autoreview/Thermos helper was run with `--mode local --no-web-search` and exited before producing a review because it could not write `/home/vladimir/.codex/state_5.sqlite` (`Read-only file system`, `failed to initialize in-process app-server client`). No product finding was emitted and no clean automated review verdict is claimed.

## Implementation closeout update: 2026-09-05

The continuation QA pass closed the remaining implementation checklist items without changing the schema, database, or metahub-template versions. The runtime controller now has direct regression coverage for entity-type-scoped marketing layout precedence: a requested scoped active default is selected over the global default, its widget composition is loaded by the scoped layout id, and its version/hash metadata is returned. The test passes together with the complete changed applications-backend slice.

### Additional observed evidence

-   Applications-backend changed suites: 7 suites / 125 tests passed, including the scoped marketing runtime controller test, layout copy/CAS, sync materialization/persistence, runtime helper, and layout hash boundaries.
-   Metahubs-backend changed suites: 6 suites / 95 tests passed outside the sandbox listener restriction; the HTTP route suite was rerun with the required local listener permission and passed. Expected warning/error logs are test fixtures and do not expose request secrets.
-   Frontend/runtime focused suites passed: apps-template marketing 2 files / 10 tests, applications-frontend 3 files / 65 tests, metahubs-frontend 6 files / 16 tests, template-mui 3 files / 5 tests, types 180 tests, and utils 350 tests.
-   `pnpm run test:e2e:marketing-page:verify:local-supabase` reached terminal exit 0 in the latest full run: minimal Supabase lifecycle, 36/36 production build, contract gate, Chromium flows, visual matrix 5/5, docs i18n/assets/links/provenance. Latest Chromium and matrix `.last-run.json` files both report `passed`; authoring/runtime screenshots were inspected with `view_image`.
-   Static and contract gates passed: MUI policy, catalog versions, apps-template isolation, no-LMS fork guard, marketing template baseline, OpenAPI route-source/generation/lint, Prettier, and `git diff --check`. `gn_verify_diff` returned `PASS` for the complete current dirty-worktree allowlist with no unexpected files, symbols, impacts, or missing tests.
-   The selected Codex autoreview engine was attempted with `.agents/skills/autoreview/scripts/autoreview --mode local --no-web-search` outside the sandbox. It exited before producing a structured review because the environment-owned Codex state database is read-only. This is an external review-tool availability limit, not a product PASS or a product finding.

### Final implementation boundary

The browser proof covers the complete supported marketing authoring/publish/materialize/runtime lifecycle, widget add/configure/duplicate/toggle/delete/reorder behavior, RBAC/workspace isolation, snapshot round-trip, localized responsive/a11y behavior, safe action/media handling, explicit error/retry states, and no technical leakage or page overflow. Scoped marketing precedence is additionally covered at the runtime controller contract boundary; the existing generic global/entity-scoped browser flow covers the shared layout-scope UI and materialization path. No separate marketing-only workbench or legacy compatibility layer was introduced.

## QA remediation verification update: 2026-09-05

The post-QA implementation continuation closed the remaining fresh-metahub authoring findings from the supplied browser evidence. Marketing seed source identities now remain stable across locales while their presentation names stay localized. The template manifest description is user-facing and no longer exposes MUI, entity-data, or implementation terminology. The shared `@universo-react/types` registry now owns widget and zone metadata for both metahub and application layout editors, including canonical EN/RU label keys and default labels. A direct route contract test covers `/zone-widgets/object`, and semantic translation tests cover all marketing zones and widget labels.

The Russian browser lifecycle now creates a fresh marketing metahub, opens every seeded marketing widget editor, verifies the published source selector and localized labels, checks the absence of unavailable-source warnings, raw technical identifiers, and horizontal overflow, and verifies reload persistence. The application layout flow verifies the same localized zone/widget contract after publication and materialization. The real browser screenshots for the metahub source dialog, application layout, and published runtime were inspected after the run.

Final verification evidence:

-   `pnpm run test:e2e:marketing-page:verify:local-supabase` exited 0 with the minimal Supabase lifecycle, 36/36 workspace build, marketing template contract, Chromium flow suite with one intentional standalone skip, visual matrix 5/5, and docs/provenance checks.
-   The metahub layouts route suite passed 9/9 with the canonical widget/zone metadata assertion. Affected package lint/build, Prettier, `git diff --check`, apps-template isolation, no-LMS-fork, marketing baseline, GitBook EN/RU, screenshot assets, and provenance checks passed.
-   OntoIndex `gn_verify_diff` returned `PASS` for the complete dirty-worktree allowlist with no unexpected files, symbols, impacts, or missing tests. The autoreview helper was attempted but could not initialize the read-only environment-owned Codex state database; this remains an external review-tool limitation, not a product finding or a clean autoreview verdict.
-   The database schema, migrations, UUID v7 policy, and marketing metahub-template version (`0.1.0`) remain unchanged. No legacy compatibility reader or duplicate UI workbench was added.

## Unlimited widget-instance implementation update: 2026-09-05

The final implementation continuation closed the remaining authoring defect:
the same registered widget can now be added or duplicated without a per-key
limit in every supported metahub and application layout. The change applies to
dashboard and `marketing-page` widgets through the shared registry and existing
layout authoring primitives; it does not introduce a second editor surface.

-   Registry and validation no longer treat a widget key as a singleton. Marketing `instanceKey` values remain unique per placement and are regenerated on copy; row IDs are server-owned UUID v7 values.
-   Metahub and application stores always insert a new placement, retain route/layout/template/placement validation, and preserve authorization, optimistic concurrency, inheritance, source-lineage, and fail-closed malformed-config rules.
-   Seed migration no longer soft-deletes sibling rows with the same key. Application materialization preserves every distinct base placement. The dashboard renderer maps all repeated widget rows, and PlayCanvas realtime selection rejects ambiguous id-less requests.
-   Focused backend/frontend/Vitest suites and the real minimal-Supabase Playwright lifecycle passed. The full wrapper exited 0: 36/36 workspace build, template contract, Chromium flows, visual matrix 5/5, screenshot/provenance checks, and GitBook EN/RU/link/asset gates.
-   Final `git diff --check`, Prettier, and OntoIndex `gn_verify_diff` passed. The autoreview helper was attempted but could not initialize because the environment-owned Codex state database is read-only; this remains an external tooling limitation, not a product verdict.

This update does not change database schema/migrations, UUID policy, or the
marketing template version (`0.1.0`), and it intentionally keeps the clean-break
policy without legacy readers or compatibility shims.
