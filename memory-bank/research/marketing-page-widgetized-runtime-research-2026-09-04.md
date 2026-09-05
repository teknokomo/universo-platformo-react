# Research: Widgetized, Entity-Driven Marketing Page Runtime

> Created: 2026-09-04
> Status: Reviewed; implementation PLAN blocked pending the open contract decisions
> Trigger: `RESEARCH` follow-up to the marketing-page widgetization brief and its prior research
> Follow-up plan: `../plan/marketing-page-widgetized-runtime-plan-2026-09-04.md`

## Research Question

Does the 2026-09-04 brief correctly describe the current `marketing-page` implementation, and what architectural, persistence, runtime, security, UX, and verification constraints must be made explicit before planning the transition from a direct section renderer to reusable layout widget instances backed by metahub entities?

This research is deliberately limited to discovery and traceability. No product code, schema, template version, or legacy compatibility layer was changed.

## Source Inventory

### Supplied and repository sources

| Source                                                                                                                                                                                                                                                                                                   | Type                        | Date / Freshness                          | Why It Matters                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Supplied implementation brief (2026-09-04; task-context source, not mirrored in the repository)                                                                                                                                                                                                          | Primary/local source-TZ     | 2026-09-04                                | Supersedes the archived 2026-08-30 brief and sets the clean-break/no-schema-version-bump constraints.                                                                                                                                |
| Supplied technical specification (2026-09-04; task-context source, not mirrored in the repository)                                                                                                                                                                                                       | Primary/local brief         | 2026-09-04                                | Identifies the missing widget path and leaves registry, storage, precedence, scope, public access, and conflict decisions for research/PLAN.                                                                                         |
| `memory-bank/research/mui-9-marketing-page-template-research-2026-08-30.md`                                                                                                                                                                                                                              | Primary/local research      | 2026-08-30; reused with supersession note | Records the former MUI/data-driven implementation and its dashboard-only widget decision; its older legacy `MarketingPage.tsx` reference is stale against the current source and is called out below.                                |
| `memory-bank/plan/mui-9-marketing-page-template-plan-2026-08-30.md`                                                                                                                                                                                                                                      | Primary/local plan/evidence | 2026-08-30/31; prior slice                | Proves the former direct entity-driven runtime and browser lifecycle, not future widget authoring.                                                                                                                                   |
| `docs/en/platform/marketing-page-template.md` and `docs/ru/platform/marketing-page-template.md`                                                                                                                                                                                                          | Primary/local product docs  | Current checkout                          | Describe the direct renderer and the absence of dashboard-widget materialization for marketing; neither documents the future marketing widget contract.                                                                              |
| `.backup/templates/marketing-page`                                                                                                                                                                                                                                                                       | Primary/local provenance    | Repository backup                         | Provides the componentized MUI visual baseline for app bar, hero, logos, features, testimonials, highlights, pricing, FAQ, and footer.                                                                                               |
| `packages/universo-react-apps-template-mui`                                                                                                                                                                                                                                                              | Primary/local source        | Current checkout                          | Owns the isolated published-application runtime and currently renders the typed marketing model directly.                                                                                                                            |
| `packages/universo-react-types`, `packages/universo-react-metahubs-backend`, `packages/universo-react-applications-backend`, and `packages/universo-react-applications-frontend`                                                                                                                         | Primary/local source        | Current checkout                          | Define the type registry, seed, layout service/store, persistence, snapshot/sync, API, authoring, and hosted-runtime boundaries.                                                                                                     |
| `tools/testing/e2e/specs/flows/marketing-page-runtime.spec.ts`, `marketing-page-authoring.spec.ts`, `marketing-page-permissions.spec.ts`, `marketing-page-workspace-management.spec.ts`, `marketing-page-snapshot-roundtrip.spec.ts`, and `tools/testing/e2e/specs/matrix/marketing-page-visual.spec.ts` | Primary/local tests         | Current checkout                          | Cover the former direct runtime lifecycle, entity authoring, permissions, workspace management, snapshot roundtrip, responsive behavior, and accessibility; they do not cover widget-instance authoring or scoped layout resolution. |
| `tools/testing/e2e/support/runMarketingPageVerificationLocalSupabase.mjs`                                                                                                                                                                                                                                | Primary/local test workflow | Current checkout                          | Owns the local-Supabase verification wrapper and its startup/cleanup/lifecycle composition.                                                                                                                                          |

### External and current documentation sources

The three URLs present in the supplied input/brief were opened on 2026-09-04:

| Source                                                 | Type             | Date / Freshness  | Why It Matters                                                                                                                   |
| ------------------------------------------------------ | ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| https://mui.com/material-ui/getting-started/templates/ | Primary/official | Opened 2026-09-04 | Confirms the official template family used as the visual reference; the local backup remains the repository-specific provenance. |
| https://mui.com/material-ui/migration/upgrade-to-v9/   | Primary/official | Opened 2026-09-04 | Provides current MUI v9 migration guidance to check API assumptions against the installed policy.                                |
| https://mui.com/system/migration/upgrade-to-v9/        | Primary/official | Opened 2026-09-04 | Provides current System v9 layout/styling migration guidance.                                                                    |

Additional authoritative sources checked on 2026-09-04:

| Source                                     | Type             | Date / Freshness                                                   | Why It Matters                                                                                        |
| ------------------------------------------ | ---------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| https://mui.com/material-ui/react-grid/    | Primary/official | Opened/searched 2026-09-04                                         | Documents responsive Grid `size` usage and the distinction between layout Grid and data Grid.         |
| https://mui.com/material-ui/react-app-bar/ | Primary/official | Opened/searched 2026-09-04                                         | Documents AppBar roles, responsive navigation examples, and fixed/sticky-toolbar layout implications. |
| https://react.dev/learn/rendering-lists    | Primary/official | Opened/searched 2026-09-04                                         | Requires stable data-derived keys when list items are inserted, deleted, reordered, or repeated.      |
| https://zod.dev/                           | Primary/official | Opened/searched 2026-09-04; Context7 queried official v3/v4 source | Supports the runtime validation review; the repository is pinned to Zod 3-compatible APIs.            |

Context7 was queried for the official MUI package (`/mui/material-ui/v9.2.0`) and React documentation (`/reactjs/react.dev`). The MUI documentation page currently presents v9.4.0, while the reviewed project policy pins MUI Core/System/Icons/Utils to 9.2.0 and MUI X to 9.8.0. This is a documentation-freshness observation, not a version-change recommendation.

### Project methods and delegated review

-   The `research-before-plan`, `mui-runtime-ux-patterns`, `runtime-ux-qa`, `universo-platform-architecture`, `playwright-best-practices`, `vercel-react-best-practices`, `thermos`, and Context7 skills were applied to the source review.
-   Two read-only delegated review passes were used as advisory cross-checks for the brief/source trace and the MUI/React/stack contracts. No durable subagent report artifact exists, so direct source remains the primary evidence and the delegated conclusions are not treated as independently reproducible sources.
-   OntoIndex semantic search, symbol context, and impact checks were run before forming conclusions. The index snapshot was indexed at `2026-09-03T22:09:08.864Z` for commit `efdeab7b6c19078b022b5c16da9f7576e4088173b`; capabilities are degraded and scan caps prevent complete dirty-worktree coverage. The `renderWidget` impact was reported as MEDIUM (23 nodes, six direct callers), so direct source remains authoritative.
-   Thermos/autoreview instructions were reviewed. No clean independent Thermos verdict is claimed because this research introduced no product-code diff and the repository review helper has previously been unavailable in the current read-only state.

## Key Findings

### 1. The central diagnosis in the brief is confirmed

-   **[Fact]** `MarketingPage.tsx` builds a fixed `sectionNodes` map for the eight stock sections (hero, logos, features, testimonials, highlights, pricing, FAQ, and footer) and maps those keys directly to React section components. See [`MarketingPage.tsx`](../../packages/universo-react-apps-template-mui/src/marketing-page/MarketingPage.tsx#L17-L89).
-   **[Fact]** `MarketingRuntimeContent.tsx` fetches the marketing read model and renders `<MarketingPage data={data} ... />`; it does not resolve layout widget instances, widget placement, widget configuration, or widget-level data sources. See [`MarketingRuntimeContent.tsx`](../../packages/universo-react-apps-template-mui/src/marketing-page/MarketingRuntimeContent.tsx#L54-L117).
-   **[Fact]** The backend is entity-driven in the narrower sense: `runtimeMarketingPageController` reads a bounded, known set of standard Object records and maps them to a fixed `MarketingPageData` union. This is not the same as a widgetized layout runtime.
-   **[Fact]** The `marketing-page` seed manifest currently creates the `marketing-main` layout with an empty `layoutZoneWidgets` collection. Its entity definitions cover the section/site/logo/feature/testimonial/highlight/pricing/pricing-benefit/FAQ/navigation/footer records, but do not create marketing widget instances.
-   **[Inference]** The previous 2026-08-30 plan's “dashboard widgets only” rule was a deliberate boundary for the old implementation, not evidence that the new brief is mistaken. The 2026-09-04 brief explicitly retires that assumption.
-   **[Decision]** The implementation must not be “fixed” by inserting marketing keys into the current dashboard registry or by adding marketing branches to the existing dashboard `renderWidget` switch. It needs a template-aware composition boundary that leaves dashboard behavior intact.

### 2. The MUI baseline supports reusable sections, but does not define the platform contract

-   **[Fact]** The local `.backup/templates/marketing-page` source separates the visual page into app-bar, hero, logos, features, testimonials, highlights, pricing, FAQ, and footer components. The official MUI templates page establishes the upstream template family; the local backup is the repository-specific component provenance.
-   **[Inference]** This decomposition is compatible with one renderer per widget type plus a small page-shell composition layer, but it does not by itself determine the platform widget taxonomy.
-   **[Fact]** MUI v9's Grid contract is suited to two-dimensional responsive sections, while Stack is the better primitive for one-dimensional vertical groups. The plan should preserve the existing MUI style and use these primitives instead of introducing a second layout system.
-   **[Fact]** Official AppBar guidance describes the component as a place for branding, screen titles, navigation, and actions, and documents responsive menu/drawer examples.
-   **[Inference]** In this template, app bar/navigation and footer should be treated as shell-level concerns even if the product eventually represents them as configurable widget/shell instances. Their focus order, landmark semantics, mobile drawer behavior, and theme control must remain explicit.
-   **[Fact]** React's stable-key guidance makes persisted widget identity a functional requirement. Reorder, repeated variants, snapshot restore, and scoped overrides cannot use an array index or a generated key on each render.
-   **[Fact]** The repository pins MUI Core/System/Icons/Utils to 9.2.0 and MUI X to 9.8.0 in its workspace catalog. See [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml#L61-L77).
-   **[Recommendation]** Validate Grid `size`, Stack, AppBar, and any MUI X usage against those repository-pinned versions. External documentation is reference material, not the compatibility authority; browser verification must cover the generated layout and page-level overflow.
-   **[Risk]** Current official pages expose newer MUI documentation than the project's pinned 9.2.0 Core/System policy. The implementation must revalidate APIs against the installed versions and must not turn a documentation refresh into an unrequested dependency or schema upgrade.

### 3. The TypeScript/Zod boundary must be explicit

-   **[Fact]** The workspace pins Zod to the 3.x line (`^3.25.76`) and the reviewed packages consume it through the workspace catalog. See [`pnpm-workspace.yaml`](../../pnpm-workspace.yaml#L132-L137) and [`applicationLayouts.ts`](../../packages/universo-react-types/src/common/applicationLayouts.ts#L1-L21).
-   **[Fact]** Context7's official Zod documentation recommends discriminated unions for variant contracts and `safeParse` when untrusted input should produce a structured success/error result. The queried source includes both v3 and v4 documentation, so the project must remain on APIs supported by its pinned Zod 3 line.
-   **[Recommendation]** Make `templateKey` (and, where needed, widget type/key and contract version) the discriminator at every transport, seed, snapshot, store, and runtime boundary. Parse unknown configuration with the selected template's strict Zod schema before persistence or rendering, and map failures to localized user-facing errors rather than exposing raw Zod messages.
-   **[Fact]** Snapshot transport currently accepts open `unknown` records/arrays, while the manifest seed widget schema is explicitly dashboard-only. See [`snapshots.ts`](../../packages/universo-react-types/src/common/snapshots.ts#L24-L45) and [`TemplateManifestValidator.ts`](../../packages/universo-react-metahubs-backend/src/domains/templates/services/TemplateManifestValidator.ts#L43-L66).
-   **[Risk]** The current generic `z.record(z.unknown())` fallback is useful for transport inspection but is not sufficient as the acceptance contract for marketing widgets. Leaving it as the runtime validator would allow wrong-template keys and unsupported fields to survive until a later renderer or sync failure.
-   **[Recommendation]** Treat open `Record<string, unknown>` schemas as transport envelopes only. Imported and persisted widget payloads require discriminated boundary schemas keyed by `templateKey`/`widgetKey`, explicit rejection of unknown placements/configs, and `safeParse` before persistence.

### 4. The existing “widget” stack is dashboard-specific at several independent layers

The gap is broader than a missing component. The following layers currently encode dashboard assumptions:

-   **[Fact]** `applicationLayouts.ts` constrains widget keys and zones to dashboard enums; marketing layout config is parsed separately and is not a widget collection.
-   **[Fact]** `MetahubLayoutsService` has dashboard zone/widget schemas and an `assertDashboardLayoutTemplate` guard. Its create/update/move/assign paths do not accept marketing widget instances.
-   **[Fact]** `applicationLayoutsStore` rejects dashboard widget operations for a marketing template and exposes dashboard-shaped widget object/mutation methods.
-   **[Fact]** `TemplateManifestValidator` and `TemplateSeedExecutor` validate/insert dashboard-shaped zone widgets. After seeding, `TemplateSeedExecutor` can rebuild a dashboard layout config from active widgets, which would corrupt the meaning of a future marketing seed unless it becomes template-aware.
-   **[Fact]** The frontend application-layout branch currently exposes only the marketing appearance panel; dashboard zones and widget authoring controls are rendered in a separate dashboard branch.
-   **[Fact]** The current generic `renderWidget` has multiple dashboard callers and an OntoIndex medium-impact result. It is therefore a risky place for a large marketing switch or broad registry coupling.
-   **[Inference]** “Generic widget system” should mean a neutral metadata/transport and instance contract with template-specific registries and renderers, not that every template shares dashboard zones, widget keys, configuration schemas, or data semantics.
-   **[Recommendation]** Keep the dashboard registry and renderer behavior stable. Add a neutral registry/adapter layer that can expose dashboard and marketing entries, then let each template validate placement, configuration, and data binding through its own adapter.

### 5. Composition authority is currently split between section metadata and layout config

-   **[Fact]** `marketingPageConfig` contains section-centric order/visibility and localized section copies, while the runtime controller also derives section order/visibility from section records when configuration is absent.
-   **[Fact]** The appearance panel edits section order and visibility, not persisted layout widget instances.
-   **[Risk]** If widget instances are added without retiring or demoting those fields, order and visibility will have two competing authorities. A page can render one order while publication, reset, snapshot, or an entity-level override records another.
-   **[Recommendation]** Make the active widget-instance list the only composition authority. Section entities may remain the canonical content records and may carry defaults/metadata, but they must not silently override widget placement. If section-level order/visibility is retained for authoring or migration, define it as an explicit projection/default source with a one-way precedence rule and a fail-closed conflict state.
-   **[Open decision]** The PLAN must choose whether the section appearance config is removed from runtime composition, retained only as a template default, or materialized into widget instances during clean database creation. The clean-break constraint permits the first two options and removes the need for compatibility shims.

#### Platform layer ownership

The project architecture requires the lifecycle owner to be explicit rather than treating all configuration and content as one application-level payload:

| Layer                           | Owns                                                                                                                                                       | Must not silently own                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Metahub                         | Entity-type presets/components, relationships, seeded marketing records, canonical default widget instances, and metahub main/entity layouts.              | Per-deployment branding or day-to-day user content.                                                 |
| Application control panel       | Deployment-wide branding/presentation and explicitly supported application-global or application-entity overrides, with source lineage and conflict state. | Canonical domain definitions or user-authored workspace records.                                    |
| Published application workspace | Runtime records and user-authored content with workspace membership/RLS; generic CRUD should remain usable without raw IDs.                                | Global template composition, unless a separately approved workspace preference/override is defined. |
| Published runtime resolver      | A read-only effective, authorized, published view of the selected layout and records.                                                                      | Authoring or fallback mutation of invalid configuration.                                            |

No new built-in entity kind or custom marketing entity type is required by this research: standard Object records cover marketing collections/settings, while Page remains available for genuinely rich block content. A custom type via the Entity Type Constructor should be considered only if the existing presets demonstrably cannot model a required field/capability.

### 6. Physical tables can be reused only with a precise semantic envelope

-   **[Fact]** `_mhb_widgets` already has physical columns for UUID-v7 row id, layout id, zone, widget key, sort order, JSON config, active state, and a unique active `(layout_id, zone, widget_key, sort_order)` index. See [`systemTableDefinitions.ts`](../../packages/universo-react-metahubs-backend/src/domains/metahubs/services/systemTableDefinitions.ts#L361-L390).
-   **[Fact]** `_app_widgets` has the analogous physical columns plus source/base widget lineage, source/local hashes, and dashboard-specific single-instance/source-base indexes in the schema generator. See [`SchemaGenerator.ts`](../../packages/universo-react-schema-ddl/src/SchemaGenerator.ts#L1141-L1226).
-   **[Fact]** Their validators, indexes, and consumers currently give those columns dashboard semantics. `_app_widgets` single-instance and source-base uniqueness rules may conflict with repeated inherited marketing variants.
-   **[Risk]** Reusing the tables without a semantic identity model would make repeated widgets, copy/reset, entity overrides, snapshot remapping, and conflict detection ambiguous. A row UUID v7 is useful as a database identity, but the runtime also needs a stable instance identity/key for deterministic transport and React rendering.
-   **[Recommendation]** Define a template-neutral persisted envelope before implementation. At minimum it should account for template key, widget type/key, and an explicit contract revision only if it fits the existing persisted envelope; it must not introduce a new schema/version column or persisted revision until the no-version-bump constraint is resolved. The envelope must also account for stable instance identity, placement/region, order, active state, allowlisted data-source/field mapping, presentation configuration, media/action references, and source/provenance. Include every semantic field in the layout hash.
-   **[Fact]** The physical DDL declares UUID-v7 database defaults for both metahub widget ids and application widget ids. This proves the database default boundary, not that every application-owned insert path generates or validates UUID v7; that responsible boundary must be audited and tested explicitly.
-   **[Constraint]** Because the brief forbids a schema-version increase, the PLAN must first prove that the envelope and identity can be represented by existing columns/config/provenance fields without violating unique indexes or source lineage. If that proof fails, the conflict must be reported explicitly; it must not be hidden behind a compatibility payload.
-   **[Risk]** Static inspection found fallback-to-`center` behavior in the sync normalization path. The number of affected call sites and any actual marketing data impact were not executed or independently reproduced in this research. Treat this as a fail-closed test requirement: an unknown marketing placement must produce a localized/configuration error rather than be silently moved.

### 7. Seed, copy, snapshot, restore, and sync are the main integration risks

-   **[Fact]** Metahub copy currently transfers widget rows only for dashboard layouts. Marketing layout copies would otherwise transfer content records without their composition instances.
-   **[Fact]** Snapshot attachment serializes layouts and raw widget rows, but several validators/materializers reject non-dashboard widgets or assume dashboard inheritance; the rejection is visible in [`syncHelpers.ts`](../../packages/universo-react-applications-backend/src/routes/sync/syncHelpers.ts#L815-L830). Snapshot restore deletes existing widgets, overrides, and layouts before inserting snapshot content, then remaps widget rows; see [`SnapshotRestoreService.ts`](../../packages/universo-react-metahubs-backend/src/domains/metahubs/services/SnapshotRestoreService.ts#L1855-L1979).
-   **[Fact]** The restore test fixes the current behavior for an empty `layouts` section: it clears seeded layout/widget tables and inserts no layout/widget rows. See [`SnapshotRestoreService.test.ts`](../../packages/universo-react-metahubs-backend/src/tests/services/SnapshotRestoreService.test.ts#L1574-L1585).
-   **[Risk]** A malformed or incomplete marketing snapshot could therefore result in an empty layout or destructive partial restore. A clean new database does not justify accepting a malformed import; preflight must reject missing/invalid layout sections unless an intentionally empty composition is explicitly requested, before any destructive writes.
-   **[Fact]** Published sync persistence has generic-looking queries but dashboard assumptions in widget persistence and inherited-widget handling; the current source copies source/base lineage and uses application-level preservation rules in [`syncLayoutPersistence.ts`](../../packages/universo-react-applications-backend/src/routes/sync/syncLayoutPersistence.ts#L587-L655). Its change detector is explicitly named `hasDashboardLayoutConfigChanges` and compares dashboard config, with broad controller callers; see [`syncLayoutPersistence.ts`](../../packages/universo-react-applications-backend/src/routes/sync/syncLayoutPersistence.ts#L891-L902) and [`syncController.ts`](../../packages/universo-react-applications-backend/src/controllers/syncController.ts#L650-L705). It must not be applied to marketing layouts.
-   **[Fact]** Workspace runtime widget injection intentionally skips marketing today in [`syncHelpers.ts`](../../packages/universo-react-applications-backend/src/routes/sync/syncHelpers.ts#L720-L738). That isolation should remain: a marketing page must not receive dashboard workspace switchers, dividers, or dashboard fallback widgets.
-   **[Fact]** `TemplateSeedExecutor` is an existing seed/infrastructure Knex boundary. Its current config rebuild at [`TemplateSeedExecutor.ts`](../../packages/universo-react-metahubs-backend/src/domains/templates/services/TemplateSeedExecutor.ts#L374-L395) is not guarded by `templateKey` and calls the dashboard config builder after inserting any seed widget rows; this is a confirmed template-boundary risk that must be split or guarded.
-   **[Recommendation]** Treat seed, copy, snapshot/export/import, restore, publication, application materialization, reset, and workspace sync as one template-aware lifecycle. Every operation needs a marketing branch or a neutral adapter, with explicit provenance, ID remapping, duplicate-instance behavior, conflict policy, and preflight validation.
-   **[Recommendation]** Add a template-aware change detector and hash input. It must include template-specific placement, stable instance identity, contract version, active state, normalized config, data-source mapping, and source lineage; otherwise a semantic marketing edit may not trigger publication or sync.

### 8. Runtime selection and entity-scoped behavior are not yet implemented

-   **[Fact]** The marketing controller currently resolves only the active global application layout and then loads a fixed global set of marketing objects; see [`runtimeMarketingPageController.ts`](../../packages/universo-react-applications-backend/src/controllers/runtimeMarketingPageController.ts#L221-L271). It does not select an entity-scoped marketing layout.
-   **[Fact]** The requested metahub main layout, entity layout, and application layout scopes therefore have no complete precedence/selection path in the current marketing runtime. The existing appearance UI is global and section-oriented.
-   **[Fact]** Hosted application runtime dispatches a marketing page before dashboard CRUD state when the selected template is marketing and the route is the marketing root. The two-step template/data flow is visible in [`ApplicationRuntime.tsx`](../../packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx#L1007-L1053) and [`MarketingRuntimeContent.tsx`](../../packages/universo-react-apps-template-mui/src/marketing-page/MarketingRuntimeContent.tsx#L54-L117). Standalone runtime has a corresponding marketing branch. These provider/isolation boundaries should be preserved.
-   **[Fact]** The current application runtime routes are protected by `ensureAuth`, including the template and marketing endpoints; see [`applicationsRoutes.ts`](../../packages/universo-react-applications-backend/src/routes/applicationsRoutes.ts#L18-L85). The standalone runtime recognizes a GuestApp route, but that does not establish a public marketing data policy.
-   **[Risk]** Hosted dispatch makes separate template and marketing-data requests. This is static call-site evidence only; no race, waterfall, or duplicate-fetch impact was measured in this research. The implementation must test lineage/version consistency and duplicate-fetch behavior. If layout selection or publication changes between requests, the shell and content can come from different effective versions; a single resolved runtime envelope or an explicit version/lineage check is safer.
-   **[Fact]** The generic dashboard runtime controller can resolve a scoped layout by entity id and then read `_app_widgets` as dashboard zones; errors are caught and converted to empty/null dashboard state. If route/template dispatch is wrong, marketing rows could be interpreted as dashboard data or silently disappear.
-   **[Recommendation]** Resolve and validate `templateKey` before any dashboard runtime controller reads layout widgets. For marketing, use a dedicated template-aware runtime resolver with no dashboard fallback and no error-to-empty conversion for invalid marketing configuration.
-   **[Open decision]** Define how a public/root marketing route chooses the applicable entity layout when there is no user-facing entity id, including inheritance, guest access, and the behavior for an entity-specific page link. The current router is authenticated by default, while the brief correctly leaves GuestApp/public access as an unresolved product decision.

### 9. Data binding must remain server-owned, bounded, and metadata-based

-   **[Fact]** Existing runtime data-source utilities support bounded record lists/unions and other server-defined descriptors. They validate sort/filter input and resolve object metadata rather than accepting arbitrary SQL identifiers from the client.
-   **[Recommendation]** Marketing widget configuration should bind to published entity metadata, codenames, stable field keys, and server-owned allowlists. The client must never select a physical table or column, construct SQL, or use an unbounded union. Record limits, relation limits, media origin policy, and workspace/RLS scope belong to the server resolver.
-   **[Fact]** Existing marketing mapping already contains safe action and media/resource concepts, localized values, alt text, and relation handling. Widgetization must reuse those contracts instead of moving URLs, IDs, or raw JSON into user-facing configuration.
-   **[Fact]** The application widget-upsert input accepts `expectedVersion`, but the insert/upsert path itself does not apply it; other widget update paths use different checks. The move flow checks the loaded version in JavaScript, while its batch SQL update has no version predicate, and the controller can expose stale widget-config updates as `404`. See [`applicationLayouts.ts`](../../packages/universo-react-types/src/common/applicationLayouts.ts#L789-L802), [`applicationLayoutsStore.ts`](../../packages/universo-react-applications-backend/src/persistence/applicationLayoutsStore.ts#L716-L766), [`applicationLayoutsStore.ts`](../../packages/universo-react-applications-backend/src/persistence/applicationLayoutsStore.ts#L1016-L1083), and [`applicationLayoutsController.ts`](../../packages/universo-react-applications-backend/src/controllers/applicationLayoutsController.ts#L305-L323).
-   **[Fact]** Metahub widget mutation schemas do not expose a comparable expected-version precondition in [`MetahubLayoutsService.ts`](../../packages/universo-react-metahubs-backend/src/domains/layouts/services/MetahubLayoutsService.ts#L178-L240). This leaves conflict semantics asymmetric across layers.
-   **[Recommendation]** Define conflict semantics per operation. Require SQL version predicates, `RETURNING` where confirmation matters, and a documented 404/409 distinction for stale, missing, forbidden, and invalid-template outcomes. Stale updates must not silently overwrite authored values.
-   **[Recommendation]** Make version checks and `RETURNING`-based mutation confirmation template-neutral and consistent across metahub and application layout mutations. Conflict responses should be distinguishable from not-found, permission, and invalid-template errors.

### 10. Existing browser evidence is valuable but does not cover the new contract

-   **[Fact]** The prior implementation has strong but scoped evidence for the existing direct marketing/entity/publication flows: entity CRUD, publication/sync, import/export, reset semantics, locale/theme/viewport combinations, keyboard behavior, safe actions/media, no raw UUID/object leakage, no horizontal overflow, and accessibility scans. It does not prove widget lifecycle, backend RLS/transaction behavior, or complete import/restore conflict handling.
-   **[Fact]** Current marketing authoring tests edit a standard Object record and appearance settings; they do not create, edit, reorder, duplicate, toggle, or delete marketing layout widget instances.
-   **[Fact]** No existing browser flow proves metahub-main defaults, entity-scoped overrides, application-global overrides, precedence conflicts, widget publication/materialization, or restore of repeated widget variants.
-   **[Recommendation]** Retain the existing direct-runtime regression matrix, then add browser proof for the widget lifecycle: create a fresh metahub/application, author several widget instances including a repeated variant, edit configuration and entity data, reorder/toggle, publish/sync, reload, export/import, apply scoped overrides, and verify EN/RU light/dark responsive rendering with axe and overflow/leakage oracles.
-   **[Recommendation]** Use separate browser flows for authoring, publication/materialization, import/restore, scopes/RBAC, and responsive runtime UX. Assert no raw IDs/JSON/`[object Object]`, localized validation, semantic multiline fields, keyboard completion, and no page-level horizontal overflow at desktop/tablet/mobile viewports.
-   **[Recommendation]** Add direct API tests for 401/403, invalid template/widget/placement, cross-scope access, stale version, duplicate instance, malformed snapshot, missing data source, and publication conflict. Unit tests alone are insufficient for the user-visible composition and selection behavior.
-   **[Fact]** The repository's UX contracts require multiline semantic text controls, localized validation/errors, no raw IDs/JSON/`[object Object]`, accessible controls, reuse of existing dashboard/app primitives where appropriate, and no page-level horizontal overflow. These are acceptance criteria for the new authoring UI, not optional polish.

### 11. Documentation and architecture references have known drift

-   **[Fact]** The EN/RU marketing-page docs and the isolated package README describe direct typed marketing content and state that dashboard widgets are not used by this template; they do not establish that arbitrary marketing widgets are already present. After implementation, they must describe template-specific marketing widgets while preserving the no-dashboard-injection rule and the explicit `MarketingPagePricingBenefit` relation (14 seeded benefit rows in the current model).
-   **[Fact]** The architecture skill and `memory-bank/techContext.md` still describe four metahub templates, while the current source registry includes the newer marketing-page-related template entries. This is documentation drift that should be corrected if the registry or template contract is touched.
-   **[Fact]** The current legacy template package contains only the `start-page` shell primitives and README; the former static `start-page/MarketingPage.tsx` file is absent. The README states that the static demo was removed and that the data-driven published template lives in `apps-template-mui`. This current source supersedes the stale same-path assertion in the 2026-08-30 research artifact.
-   **[Recommendation]** Audit callers of the retained `start-page` shell (`AppAppBar`/`SitemarkIcon`) before implementation, but do not reintroduce the removed page or create a second marketing contract. See [`start-page/README.md`](../../packages/universo-react-template-mui/src/views/start-page/README.md#L1-L9).
-   **[Risk]** The brief marks “Affected Projects” as `n/a`, although the implementation necessarily crosses the isolated app template, shared types, metahub backend, application backend/frontend, and E2E/docs surfaces. This weakens handoff traceability.
-   **[Recommendation]** Keep the neutral persisted/shared contract in `@universo-react/types` and keep rendering/runtime UI inside `apps-template-mui`; do not import the legacy template or feature frontend packages into it. Do not infer that all backend packages are dependency-isolated during the current transition: existing backend transition dependencies remain acceptable when the domain boundary requires them.
-   **[Recommendation]** The PLAN should name the affected package boundaries and assign ownership for the neutral contract, template registry, persistence adapter, runtime resolver, authoring UI, seed, sync, and documentation. It should not broaden into an unrelated rewrite of legacy feature packages.

## Traceability To The Supplied Brief

| Brief requirement or claim                                              | Research evidence                                                                                           | Disposition for PLAN                                                                     |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Replace direct marketing assembly with widget instances                 | Direct `MarketingPage`/`MarketingRuntimeContent` path and empty marketing seed widget list confirm the gap. | Required; design the instance contract first.                                            |
| Use a template-aware registry/renderer without weakening dashboard      | All current layout schemas, stores, services, and authoring APIs are dashboard-specific.                    | Required; use neutral metadata plus template adapters and preserve dashboard behavior.   |
| Keep standard Object/Page entity foundations                            | Current seed and runtime already use standard entity presets and typed Object-derived records.              | Retain; do not introduce a new marketing entity type without a separately approved need. |
| Support metahub main, entity, and application scopes                    | Current marketing controller/UI resolve only global application-level content/layout.                       | Required; define selector, precedence, conflict, and public route semantics.             |
| Reuse entities, localization, relations, media, order, and active state | Existing marketing types/mappers and bounded runtime query already provide most content contracts.          | Reuse and attach them to a widget-owned composition model.                               |
| Publish/materialize/restore/import/export/sync widget layouts           | Existing paths contain dashboard-only guards, skip marketing, or rebuild dashboard config.                  | Required; perform a complete template-aware lifecycle audit.                             |
| No schema/template version bump and no legacy payload compatibility     | Physical tables have reusable columns, but indexes and validators have dashboard semantics.                 | Preserve only after a storage/identity proof; no shims or silent legacy fallback.        |
| Preserve MUI 9 style, i18n, a11y, and responsive behavior               | Official MUI/React guidance and existing browser matrix support this direction.                             | Required; pin to installed project versions and extend the matrix.                       |
| Make every stock section a widget/shell or reusable variant             | Backup template is componentized; platform taxonomy is not yet defined.                                     | Required; decide shell/widget taxonomy and repeatable-instance semantics.                |
| Add tests and browser proof                                             | Current evidence covers the old direct model, not widget authoring and scoped selection.                    | Required; add focused API/store/sync tests and real-browser lifecycle proof.             |

## Conflicts And Uncertainty

1. **Previous plan versus current brief.** The former plan explicitly chose dashboard-only widgets and direct marketing rendering. The new brief intentionally changes that architectural decision; it must be treated as a scope supersession, not as a regression to preserve.
2. **MUI documentation freshness versus dependency policy.** Official documentation currently shows MUI v9.4.0, while this project deliberately pins Core/System/Icons/Utils 9.2.0 and MUI X 9.8.0. Exact installed APIs remain the implementation authority unless a separate upgrade is approved.
3. **Physical storage versus semantic contract.** Existing tables look reusable, but dashboard-specific validation, uniqueness, source lineage, and hash behavior are not proof that arbitrary marketing instances already fit. The no-schema-bump constraint makes this a design gate.
4. **Scope precedence and entity selection.** The brief asks for multiple layout scopes, but no complete marketing selector or public entity-link contract was found. PLAN cannot safely infer the precedence or route behavior.
5. **Guest/public access.** The current application route is authenticated by default even though the standalone runtime recognizes a GuestApp route. The product decision for a public marketing page, and its RLS/data policy, remains open.
6. **Section metadata ownership.** Section records, marketing config, and future widget instances can all express order/visibility. One authority and explicit projections must be chosen.
7. **Runtime transport consistency.** The current hosted path separates template dispatch from marketing data retrieval. The required envelope/version consistency mechanism is not present.
8. **Graph/review completeness.** OntoIndex is stale/degraded and has scan-cap limitations for this dirty checkout. The conclusions were checked against direct source. No independent clean Thermos result is claimed.
9. **Brief traceability.** “Affected Projects: n/a” should be corrected in the next brief revision or plan because the affected package boundaries are known.
10. **Legacy-source drift.** The 2026-08-30 research artifact still describes a removed `start-page/MarketingPage.tsx`, while the current directory README and source contain only start-shell primitives. The current checkout is authoritative for this follow-up; the older artifact should be corrected separately if historical documentation is maintained.

## Project Implications

| Area                           | Affected boundaries                                                                                               | Required constraint                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canonical types and registry   | `packages/universo-react-types`                                                                                   | Define a neutral metadata-only widget envelope and template-specific registry entries. Avoid coupling marketing to dashboard enums or the monolithic dashboard renderer. |
| Metahub authoring and seed     | `packages/universo-react-metahubs-backend`, template seed/manifest/cleanup services                               | Validate, create, copy, move, activate, reset, and inspect marketing widget instances; make seed config generation template-aware.                                       |
| Application layout authoring   | `packages/universo-react-applications-backend`, `packages/universo-react-applications-frontend`                   | Add the marketing layout editor and scoped override behavior with localized validation, stable identities, and no raw technical values.                                  |
| Persistence and hashes         | `_mhb_widgets`, `_app_widgets`, snapshot serializers/restorers, layout hash                                       | Prove reuse of existing physical fields under the no-schema-bump rule; include template, identity, placement, config, active state, and provenance in hashes/remapping.  |
| Publication and sync           | `syncLayoutPersistence`, `syncEngine`, materialization helpers                                                    | Branch away from dashboard-only change detection/injection and preserve conflict/source lineage semantics. Keep workspace dashboard injection out of marketing.          |
| Runtime transport and dispatch | `runtimeMarketingPageController`, hosted `ApplicationRuntime`, standalone `DashboardApp`, runtime rows controller | Resolve template and effective layout safely; prevent dashboard fallback and ensure a consistent published version across shell/content.                                 |
| Data and security              | runtime data-source resolvers, RLS/RBAC, action/media adapters                                                    | Bind only to server-owned published metadata and allowlists; enforce bounded queries, scope, authorization, media policy, and optimistic version conflicts.              |
| UX and verification            | isolated `apps-template-mui`, E2E flows, EN/RU docs                                                               | Preserve the MUI backup visual baseline; prove responsive/a11y/no-leakage/no-overflow behavior and the full widget lifecycle in a fresh database.                        |
| Documentation                  | `docs/en`, `docs/ru`, package README, architecture/tech context                                                   | Replace the “no dashboard widgets” wording with the widgetized contract and update stale template counts/relations.                                                      |

The SQL-first rule remains applicable to domain stores and services: schema-qualified parameterized SQL through `DbExecutor`, request-scoped executors for authenticated RLS flows, and a narrowly documented Knex boundary only for existing infrastructure/DDL/seed/sync responsibilities. `TemplateSeedExecutor` is an existing seed/infrastructure Knex boundary; any template-specific seed logic must remain isolated there and be explicitly classified. Widgetization is not a reason to introduce direct Supabase calls or domain-level Knex usage, and the current domain packages should not be assumed to be fully dependency-isolated during the architectural transition.

## Recommended Decision

Do not start implementation planning until the listed contract decisions are resolved. A decision-focused PLAN may be opened to settle those choices, but the implementation plan remains blocked until the resulting contract is explicit:

1. Use a neutral, metadata-only layout-widget contract with template adapters. Keep dashboard zones, dashboard keys, and dashboard renderer behavior intact; do not make `renderWidget` the shared marketing composition authority. Validate the selected template/widget variant with strict Zod 3-compatible discriminated schemas at each boundary.
2. Make persisted widget instances the single source of page composition. Use standard Object/Page records for content and relations, while treating section order/visibility fields as explicit defaults or projections rather than a second runtime authority.
3. Define stable persisted instance identity, repeatable variants, placement, ordering, active state, allowlisted data mapping, presentation/media/action config, and source/provenance. Add a code-level or transport contract revision only if it fits the existing envelope; do not add a persisted revision field under the no-version-bump constraint. Use UUID v7 only where the responsible insert path explicitly generates or validates it, record whether generation is database- or application-owned, test that boundary, and use stable data-derived React keys.
4. Prove a no-schema-bump storage strategy against existing uniqueness indexes, source lineage, snapshot remapping, copy/reset, and layout hashing. Do not add a legacy payload reader or silently reinterpret malformed dashboard rows as marketing rows.
5. Make seed, authoring, copy, snapshot, restore, publication, application materialization, and sync template-aware. Preflight snapshots before destructive restore, fail closed on invalid placement/template/config, and keep dashboard workspace injection out of marketing.
6. Define effective-layout precedence and entity-scoped/public route selection before adding UI. Resolve `templateKey` before dashboard runtime logic and prefer one consistent runtime envelope or an equivalent lineage/version check.
7. Keep all data access server-owned, bounded, RLS/RBAC-checked, localized, and metadata-based. Enforce expected versions and distinguish conflicts from not-found/forbidden/invalid-config outcomes. Do not expose raw Zod/internal validation messages to users.
8. Keep the existing MUI 9 visual baseline, installed dependency policy, i18n, accessibility, responsive Grid/Stack usage, and isolated `apps-template-mui` boundary. Update documentation and the browser matrix as part of the same implementation scope.

## Open Questions Before PLAN

1. What is the exact taxonomy of marketing shells versus section widgets, and which components can repeat or accept named variants?
2. Where does the neutral registry live, and which template adapter owns validation, placement, data binding, and rendering for each entry?
3. Can the full envelope be represented by existing layout/widget/config/provenance fields without a schema change, including a stable semantic instance key and repeated inherited rows?
4. What is the canonical identity for copy, reorder, snapshot remapping, React keys, and application source lineage: row UUID, semantic instance key, or both?
5. What is the single precedence order among metahub main, entity layout, application-global, application-entity, and workspace/runtime overrides, and how are conflicts shown to an author?
6. How does a public/root marketing URL select an entity-scoped layout, and is GuestApp/public marketing permitted in the first implementation?
7. Is marketing widget data a typed server batch adapter, the existing bounded datasource descriptor, or a constrained combination; which fields/relations/media are allowlisted per widget type?
8. Are section entity order/visibility fields retained as defaults/projections, or removed from effective runtime composition in the clean database?
9. What are the exact copy/reset/publish/sync conflict semantics when an application or entity layout has authored overrides over a changed metahub base?
10. What is the golden fixture/visual contract for the MUI backup, including locale, theme, asset provenance, pricing-benefit relation counts, and the new widget instance ordering?
11. Which navigation, CTA, telephone, email, media-origin, `target`/`rel`, and CSP policies are allowed for entity-configured actions and resources?
12. Which in-scope callers, if any, still use the retained `packages/universo-react-template-mui/src/views/start-page/components` shell, and how should those shell primitives remain isolated while the removed static marketing page is not reintroduced?

## QA Review: 2026-09-04

verdict: pass-with-minor-issues

### Blockers

-   None remain in the research artifact after this QA update. The implementation PLAN remains blocked by the open contract decisions above.

### Major Issues Found And Corrected

-   Replaced the incomplete two-column source inventory with the research-template fields for source type, freshness, and decision relevance.
-   Corrected the visual E2E path and expanded the inventory to include permission, workspace-management, snapshot-roundtrip, and local-Supabase wrapper coverage.
-   Added an explicit metahub/application/workspace/runtime ownership matrix and clarified that no new built-in or custom marketing entity type is required by the current evidence.
-   Added the repository's Zod 3 compatibility constraint, Context7 validation findings, strict discriminated parsing, and localized error handling.
-   Added direct DDL, snapshot/restore, sync, runtime-route, and application-layout source anchors; narrowed claims that were previously broader than their evidence.
-   Corrected the skill name to `vercel-react-best-practices`, qualified delegated reviews as advisory because no durable subagent reports exist, and recorded the OntoIndex snapshot/impact limitation.
-   Removed the ambiguity between “ready for PLAN” and unresolved implementation gates: the document now permits decision-focused planning but blocks implementation planning until the contract is closed.
-   Corrected the stale legacy `start-page/MarketingPage.tsx` assertion by checking the current directory/README, and retained only the shell-caller isolation question; also added action/media/CSP policy coverage.

### Passed Checks

-   The research question, all three user-provided URLs, additional authoritative sources, freshness, facts/inferences, conflicts, project implications, recommended decision, and open questions are present.
-   The central direct-renderer diagnosis is supported by current source, while the prior browser evidence is explicitly scoped to the former implementation.
-   MUI runtime requirements cover semantic HTML, Grid/Stack, stable React keys, i18n, localized validation, accessible controls, no technical leakage, and no page-level horizontal overflow.
-   Architecture requirements cover Object/Page mapping, layer ownership, apps-template isolation, SQL-first `DbExecutor` boundaries, UUID v7, RLS/RBAC, optimistic concurrency, snapshot safety, and dashboard regression protection.
-   The artifact and its cited source files are repository-local and contain no product-code changes.

### Browser Evidence

-   Existing evidence from the prior MUI/data-driven slice covers direct runtime rendering, entity authoring, publication/sync, import/export, reset behavior, locale/theme/viewport combinations, accessibility, keyboard behavior, technical-leakage oracles, and overflow checks.
-   No new browser run was claimed for widget-instance authoring, scoped layout selection, precedence conflicts, or the future widgetized runtime.

### Missing Evidence

-   A future implementation still needs real-browser proof for widget create/edit/reorder/duplicate/toggle/delete, repeated variants, metahub/entity/application scope precedence, publication/materialization, malformed import, stale versions, public/GuestApp policy, and dashboard non-regression.
-   A clean independent Thermos/autoreview result is not available; this document review used the Thermos rubrics as a checklist and reports the limitation rather than a false PASS.

### Required Follow-up

-   Resolve the twelve open contract questions in a decision-focused PLAN, then implement and verify the full lifecycle with focused store/API tests and the repository Playwright wrapper.

## Sources

### Supplied brief and prior research

-   Supplied technical specification (2026-09-04; task-context source, not mirrored in the repository)
-   Supplied implementation brief (2026-09-04; task-context source, not mirrored in the repository)
-   `memory-bank/research/mui-9-marketing-page-template-research-2026-08-30.md`
-   `memory-bank/plan/mui-9-marketing-page-template-plan-2026-08-30.md`
-   `docs/en/platform/marketing-page-template.md`
-   `docs/ru/platform/marketing-page-template.md`
-   `.backup/templates/marketing-page`

### Official documentation and research links

-   [Material UI templates](https://mui.com/material-ui/getting-started/templates/)
-   [Material UI v9 migration](https://mui.com/material-ui/migration/upgrade-to-v9/)
-   [MUI System v9 migration](https://mui.com/system/migration/upgrade-to-v9/)
-   [Material UI Grid](https://mui.com/material-ui/react-grid/)
-   [Material UI App Bar](https://mui.com/material-ui/react-app-bar/)
-   [React: rendering lists and stable keys](https://react.dev/learn/rendering-lists)
-   [Zod](https://zod.dev/)

### Direct source anchors

-   [`MarketingPage.tsx`](../../packages/universo-react-apps-template-mui/src/marketing-page/MarketingPage.tsx#L17-L89)
-   [`MarketingRuntimeContent.tsx`](../../packages/universo-react-apps-template-mui/src/marketing-page/MarketingRuntimeContent.tsx#L54-L117)
-   [`marketingPage.ts`](../../packages/universo-react-types/src/common/marketingPage.ts#L421-L599)
-   [`applicationLayouts.ts`](../../packages/universo-react-types/src/common/applicationLayouts.ts#L25-L86)
-   [`snapshots.ts`](../../packages/universo-react-types/src/common/snapshots.ts#L24-L45)
-   [`marketing-page.template.ts`](../../packages/universo-react-metahubs-backend/src/domains/templates/data/marketing-page.template.ts#L930-L984)
-   [`MetahubLayoutsService.ts`](../../packages/universo-react-metahubs-backend/src/domains/layouts/services/MetahubLayoutsService.ts#L360-L367)
-   [`TemplateManifestValidator.ts`](../../packages/universo-react-metahubs-backend/src/domains/templates/services/TemplateManifestValidator.ts#L43-L66)
-   [`TemplateSeedExecutor.ts`](../../packages/universo-react-metahubs-backend/src/domains/templates/services/TemplateSeedExecutor.ts#L317-L395)
-   [`systemTableDefinitions.ts`](../../packages/universo-react-metahubs-backend/src/domains/metahubs/services/systemTableDefinitions.ts#L361-L420)
-   [`SchemaGenerator.ts`](../../packages/universo-react-schema-ddl/src/SchemaGenerator.ts#L1141-L1226)
-   [`syncHelpers.ts`](../../packages/universo-react-applications-backend/src/routes/sync/syncHelpers.ts#L720-L961)
-   [`syncLayoutPersistence.ts`](../../packages/universo-react-applications-backend/src/routes/sync/syncLayoutPersistence.ts#L587-L655)
-   [`syncController.ts`](../../packages/universo-react-applications-backend/src/controllers/syncController.ts#L650-L705)
-   [`SnapshotRestoreService.ts`](../../packages/universo-react-metahubs-backend/src/domains/metahubs/services/SnapshotRestoreService.ts#L1855-L1979)
-   [`applicationLayoutsStore.ts`](../../packages/universo-react-applications-backend/src/persistence/applicationLayoutsStore.ts#L181-L197)
-   [`applicationLayoutsController.ts`](../../packages/universo-react-applications-backend/src/controllers/applicationLayoutsController.ts#L305-L323)
-   [`ApplicationMarketingAppearancePanel.tsx`](../../packages/universo-react-applications-frontend/src/pages/application-layouts/ApplicationMarketingAppearancePanel.tsx#L56-L70)
-   [`ApplicationLayouts.tsx`](../../packages/universo-react-applications-frontend/src/pages/ApplicationLayouts.tsx#L779-L858)
-   [`applicationsRoutes.ts`](../../packages/universo-react-applications-backend/src/routes/applicationsRoutes.ts#L18-L85)
-   [`runtimeMarketingPageController.ts`](../../packages/universo-react-applications-backend/src/controllers/runtimeMarketingPageController.ts#L221-L602)
-   [`ApplicationRuntime.tsx`](../../packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx#L1007-L1053)
-   [`apps-template-mui/README.md`](../../packages/universo-react-apps-template-mui/README.md#L67-L71)
-   [`start-page/README.md`](../../packages/universo-react-template-mui/src/views/start-page/README.md#L1-L9)
-   [`start-page/AppAppBar.tsx`](../../packages/universo-react-template-mui/src/views/start-page/components/AppAppBar.tsx#L1-L20)
-   [`marketing-page-runtime.spec.ts`](../../tools/testing/e2e/specs/flows/marketing-page-runtime.spec.ts)
-   [`marketing-page-authoring.spec.ts`](../../tools/testing/e2e/specs/flows/marketing-page-authoring.spec.ts)
-   [`marketing-page-permissions.spec.ts`](../../tools/testing/e2e/specs/flows/marketing-page-permissions.spec.ts)
-   [`marketing-page-workspace-management.spec.ts`](../../tools/testing/e2e/specs/flows/marketing-page-workspace-management.spec.ts)
-   [`marketing-page-snapshot-roundtrip.spec.ts`](../../tools/testing/e2e/specs/flows/marketing-page-snapshot-roundtrip.spec.ts)
-   [`marketing-page-visual.spec.ts`](../../tools/testing/e2e/specs/matrix/marketing-page-visual.spec.ts)
-   [`runMarketingPageVerificationLocalSupabase.mjs`](../../tools/testing/e2e/support/runMarketingPageVerificationLocalSupabase.mjs)
