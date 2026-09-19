# Research: Consortium Marketing Product, Anonymous Public Runtime, and Application Aliases

> Created: 2026-09-15
> Status: QA-reviewed and corrected
> Trigger: the 2026-09-15 Consortium marketing public runtime aliases source task and its reviewed implementation brief (both maintained outside the repository).
> Follow-up plan: `memory-bank/plan/consortium-marketing-public-runtime-aliases-plan-2026-09-15.md`

## Research Question

How should Universo Platformo implement the approved Consortium 73rd Meridian marketing configuration, a separately configurable central marketing image, anonymous read access to genuinely public applications, and superadmin-managed multi-alias application routing without preserving the current single-`slug` legacy contract, weakening authenticated runtime authorization, or creating product-specific forks in the MUI application template?

The research also resolves the two architecture questions left open by the brief: how to represent development/funding stages without pretending they are SaaS prices, and whether the centralized Slugs page should be scoped to an Instance in the data model.

## Scope And Method

-   Re-read the source MANAGER input, the reviewed implementation brief, the complete `.backup/Лендинг-для-Консорциума.md` draft, and the directly related marketing/layout research artifacts.
-   Rechecked the current marketing widget contracts, Hero/media ownership, fixture-generation precedent, authenticated/public routing boundaries, public-runtime helpers, workspace DDL/services, effective-layout resolver, application slug consumers, global RBAC/bootstrap, and Instance administration shell against the current checkout.
-   Applied the project skills `research-before-plan`, `universo-platform-architecture`, `mui-runtime-ux-patterns`, `runtime-ux-qa`, `nodejs-backend-patterns`, and `playwright-best-practices` as review constraints.
-   Queried Context7 against Material UI 9.2.0 for Tabs/dialog/accessibility and `slots`/`slotProps` guidance and against React Router v6 documentation for dynamic/wildcard routing and replacement navigation semantics.
-   Refreshed primary web evidence for React Router security advisories/policy, PostgreSQL partial uniqueness, OWASP authorization/open-redirect guidance, and RFC 9110 redirect semantics.
-   Used OntoIndex for advisory semantic navigation; its returned graph evidence was marked degraded, so direct current source remains authoritative for repository-specific conclusions.
-   Launched independent read-only subagent reviews for public runtime/security, aliases/RBAC/admin, and marketing widget/fixture concerns; accepted findings are incorporated only where they agree with direct source evidence.

No product code, database migration, template version, or MANAGER brief was changed by this RESEARCH QA pass.

## QA Review Result

**Verdict: pass with required corrections, all incorporated below.** The original RESEARCH direction matches the brief and the project's current MUI/React/Express/PostgreSQL architecture, but QA found several material precision gaps:

1. The existing `is_default_workspace` field is **not** an application/public default. It belongs to `_app_workspace_user_roles` and is unique per `user_id`, so anonymous runtime must not reuse it. This research now requires an explicit workspace-level, server-owned public-entry designation when workspaces are enabled.
2. Public workspace context is transaction-sensitive. The pool `DbExecutor` acquires a connection per query, while `set_config('app.current_workspace_id', ..., true)` is transaction-local. All workspace-bound anonymous reads therefore have to run inside one `DbExecutor.transaction(...)` after the workspace context is selected and bound on that transaction executor.
3. The baseline bootstrap contains `Registered`, `User`, and root `Superuser`, but no canonical non-root `Superadmin`. Because system-role assignments are already protected from non-Superuser mutation, the clean bootstrap should add an explicit protected Superadmin role/capability grant instead of leaving the requirement dependent on an ad hoc custom role.
4. A mutable primary alias must not be advertised with a permanent redirect by default. RFC 9110 distinguishes 307 temporary from 308 permanent and makes 308 heuristically cacheable; canonical secondary aliases should use SPA history replacement or a server-owned temporary redirect unless future policy makes the mapping intentionally permanent and defines cache invalidation.
5. The React Router dependency finding remains valid but is now scoped more precisely: GHSA-2j2x-hqr9-3h42 explicitly exempts Declarative `BrowserRouter` applications from its React Router path, while the repository still forces an affected `@remix-run/router` 1.23.2 and `react-router-dom` 6.30.4 is affected by the later GHSA-jjmj-jmhj-qwj2. The upgrade is a prerequisite dependency-security cleanup before adding new redirect behavior, not proof that the current `/a` route is already exploitable through the first advisory.
6. The new alias capability must participate in the Admin-shell entry predicate, not only endpoint authorization. `admin.has_admin_permission()` currently recognizes wildcard or read access to `roles`, `instances`, or `users`; an otherwise correctly permissioned Superadmin could be denied the shell unless the bootstrap grants an existing qualifying permission or the predicate is extended deliberately.
7. Public readiness must not reuse the generic active-row helper as the whole lifecycle predicate. `activeAppRowCondition()` checks soft-deletion flags but not `_upl_archived` / `_app_archived`; the anonymous resolver needs an explicit public/published/not-archived/runtime-ready contract.
8. Backend and frontend capability names need one typed mapping. `ApplicationAlias` is not yet in the shared CASL `Subjects` union or `ABILITY_MODULE_TO_SUBJECT`, so those contracts must be extended together with the backend permission subject.
9. Alias reservation semantics must survive application lifecycle operations. Soft deletion only disables routability; physical purge must have explicit privileged alias-release semantics rather than freeing reserved names accidentally through a generic cascading delete.
10. Static marketing-widget ownership must be implemented in generic authoring as well as schema/runtime code. `MarketingWidgetConfigDialog.tsx` currently assumes an entity source for configurable widgets and disables Save when that source is missing, so `entity | static | none` must drive this dialog and hide entity-source controls for static/none widgets.
11. Removing Hero media ownership is an end-to-end contract removal: template components/seeds, runtime record schema, normalization/types, materialization, renderer ownership, and tests must all stop carrying `HeroLightPreview` / `HeroDarkPreview` after the split.
12. Fixture validation and product proof are separate gates. Adding the Consortium JSON to `snapshotFixtures.test.ts` proves envelope/import validity only; a Consortium-specific generator/contract/E2E path must separately prove publication/materialization/runtime and export/import round-trip behavior.
13. A frontend route resolver alone cannot make the existing runtime anonymous. The current apps-template API client builds authenticated `/applications/:id/runtime/*` URLs and runtime components can forward client `workspaceId`; public rendering therefore needs a distinct anonymous runtime page/client/API adapter that consumes only server-selected public context.
14. Public readiness needs a server-side state policy, not the frontend's broad “initialized schema” set. The current UI treats `maintenance` and `error` as initialized states, but those are not acceptable anonymous-public states. The public contract should serve only a coherent installed release/materialization and fail closed during draft/pending/maintenance/error conditions.
15. Public effective-layout output needs a redacted projection. The authenticated `EffectiveLayoutSuccess` includes source lineage, snapshot/content/materialization hashes, publication identity, and precedence metadata that the public renderer does not need and that this research already forbids exposing.

No new browser run was performed in this document-only QA pass. The browser matrix below is required implementation evidence, not a claim about current acceptance.

## Source Inventory

### Local authoritative sources

-   The 2026-09-15 Consortium marketing public runtime aliases source task with the user constraints (maintained outside the repository).
-   The 2026-09-15 reviewed implementation brief for the same feature (maintained outside the repository).
-   `.backup/Лендинг-для-Консорциума.md` — proposed Consortium landing copy derived from the investment memorandum; useful as a content draft, but not a substitute for a versioned authoritative memorandum.
-   `.backup/templates` — checked-in original MUI template provenance.
-   `memory-bank/research/mui-9-marketing-page-template-research-2026-08-30.md` — MUI 9/template baseline.
-   `memory-bank/research/marketing-page-widgetized-runtime-research-2026-09-04.md` — widgetized marketing runtime/data ownership.
-   `memory-bank/research/unified-application-template-widgets-scoped-layouts-research-2026-09-07.md` — effective layout, scoped composition, fail-closed runtime rules.
-   `memory-bank/research/marketing-header-widget-zone-settings-research-2026-09-12.md` — generic zone/widget authoring and MUI runtime UX rules.
-   `packages/universo-react-types/src/common/marketingPage.ts` — marketing widget registry, source contracts, widget config schemas, marketing records.
-   `packages/universo-react-types/src/common/resourceSources.ts` — safe external resource URL and `ResourceSource` contracts.
-   `packages/universo-react-apps-template-mui/src/marketing-page/components/Hero.tsx` — current MUI-derived Hero media geometry and ownership.
-   `packages/universo-react-apps-template-mui/src/marketing-page/components/MarketingPrimitives.tsx` — safe marketing media rendering and URL/action validation.
-   `packages/universo-react-template-mui/src/components/layouts/MarketingWidgetConfigDialog.tsx` — shared marketing widget authoring dialog, which currently assumes entity-backed sources and therefore must participate in the static-widget ownership refactor.
-   `packages/universo-react-applications-backend/src/controllers/runtimeMarketingPageController.ts` — current runtime assumption that every non-auth marketing widget has an entity-backed source.
-   `packages/universo-react-core-frontend/src/routes/MainRoutes.tsx` — authenticated `/a/:applicationId/*` route and distinct guest runtime tree.
-   `packages/universo-react-applications-backend/src/routes/applicationsRoutes.ts` — authenticated application/runtime router.
-   `packages/universo-react-applications-backend/src/routes/publicApplicationsRoutes.ts` — existing guest/access-link public router.
-   `packages/universo-react-applications-backend/src/shared/publicRuntimeAccess.ts` — reusable public application/schema/workspace safety helpers.
-   `packages/universo-react-applications-backend/src/ddl/applicationWorkspacesSchema.ts` and `packages/universo-react-applications-backend/src/services/applicationWorkspaces.ts` — current workspace persistence and proof that `is_default_workspace` is a per-user membership preference, not a public application default.
-   `packages/universo-react-database/src/knexExecutor.ts` — pool executor acquires connections per query; transaction executor pins all queries to one transaction/connection, which is required for transaction-local public workspace context.
-   `packages/universo-react-applications-backend/src/services/effectiveLayoutResolver.ts` — authenticated effective-layout resolver and workspace authorization seam.
-   `packages/universo-react-apps-template-mui/src/api/client.ts`, `packages/universo-react-apps-template-mui/src/marketing-page/api/api.ts`, and the hosted application runtime composition — current authenticated runtime URL construction and client workspace propagation, proving that anonymous public rendering needs its own client/adapter rather than only a route-entry switch.
-   `packages/universo-react-applications-backend/src/platform/migrations/1800000000000-CreateApplicationsSchema.sql.ts` — current application table, single `slug`, lifecycle flags, and partial indexes.
-   `packages/universo-react-applications-backend/src/persistence/applicationsStore.ts`, `packages/universo-react-applications-backend/src/platform/systemAppDefinition.ts`, `packages/universo-react-applications-backend/src/routes/sync/syncDataLoader.ts`, and `packages/universo-react-metahubs-backend/src/domains/publications/helpers/createLinkedApplication.ts` — hidden single-slug consumers and release/sync identity coupling.
-   `packages/universo-react-admin-backend/src/guards/ensureGlobalAccess.ts` and `packages/universo-react-auth-backend/src/guards/createAccessGuards.ts` — global permission model, root Superuser bypass, and legacy global-admin behavior.
-   `packages/universo-react-admin-backend/src/services/globalAccessService.ts`, `packages/universo-react-admin-backend/src/platform/migrations/index.ts`, and `packages/universo-react-admin-frontend/src/hooks/useGlobalRole.ts` — protected system-role mutation rules, current bootstrap role set, and proof that the legacy `useIsSuperadmin()` hook currently identifies root Superuser rather than a distinct Superadmin capability.
-   `packages/universo-react-types/src/abilities/index.ts` — shared CASL subjects/module mapping, which currently has no `ApplicationAlias` subject.
-   `packages/universo-react-types/src/abilities/index.ts` and `packages/universo-react-admin-backend/src/platform/migrations/index.ts` — permission subjects and current bootstrap role/permission state.
-   `packages/universo-react-applications-frontend/src/pages/ApplicationActions.tsx`, `packages/universo-react-applications-frontend/src/types.ts`, and `packages/universo-react-applications-frontend/src/api/applications.ts` — edit/copy tab composition plus the remaining legacy slug fields in shared frontend contracts; the current edit form itself no longer exposes slug.
-   `packages/universo-react-admin-frontend/src/pages/LocalesList.tsx`, `packages/universo-react-template-mui/src/navigation/menuConfigs.ts`, and `packages/universo-react-core-frontend/src/routes/MainRoutes.tsx` — Instance admin-shell/list-page precedent.
-   `tools/testing/e2e/specs/generators/metahubs-interpretation-network-app-export.spec.ts` and `packages/universo-react-utils/src/snapshot/__tests__/snapshotFixtures.test.ts` — canonical product fixture generation/validation precedent.

### External primary sources

-   MUI free templates: https://mui.com/material-ui/getting-started/templates/
-   MUI marketing-page live template: https://mui.com/material-ui/getting-started/templates/marketing-page/
-   MUI Tabs: https://mui.com/material-ui/react-tabs/
-   MUI Dialog: https://mui.com/material-ui/react-dialog/
-   MUI v9 migration: https://mui.com/material-ui/migration/upgrade-to-v9/
-   PostgreSQL 18 unique indexes: https://www.postgresql.org/docs/18/indexes-unique.html
-   PostgreSQL 18 partial indexes: https://www.postgresql.org/docs/18/indexes-partial.html
-   OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
-   OWASP Unvalidated Redirects and Forwards Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
-   React Router security policy: https://github.com/remix-run/react-router/blob/main/SECURITY.md
-   React Router advisory CVE-2026-40181 / GHSA-2j2x-hqr9-3h42: https://github.com/advisories/GHSA-2j2x-hqr9-3h42
-   React Router advisory CVE-2026-53668 / GHSA-jjmj-jmhj-qwj2: https://github.com/advisories/GHSA-jjmj-jmhj-qwj2
-   RFC 9110 HTTP Semantics, 307/308 redirect semantics: https://www.rfc-editor.org/rfc/rfc9110.html#name-redirection-3xx

### Context7 and code-intelligence evidence

-   Context7 `/mui/material-ui/v9.2.0` confirmed the MUI 9.2 tab accessibility/keyboard model and current `slots` / `slotProps` dialog/component customization direction.
-   Context7 React Router v6 documentation confirmed dynamic segment, wildcard, nested route, `Navigate`, and `useNavigate(..., { replace: true })` behavior relevant to application-reference routing and canonical-address replacement.
-   OntoIndex semantic exploration located the same effective-layout, public-runtime, application-slug, and Instance-navigation boundaries. The index reported degraded coverage for two oversized files, so direct source inspection is authoritative for the conclusions below.
-   Three independent read-only QA subagents completed focused reviews of public runtime/security, aliases/RBAC/admin, and marketing widget/fixture behavior. Their accepted findings were cross-checked against current repository source and are reflected in the QA Review Result and corrected findings below.

## Key Findings

### 1. The Consortium must be a product configuration of the generic marketing template

The built-in `marketing-page` template must remain reusable. The Consortium content belongs in a separate product snapshot produced through the real authoring/export path, preferably `tools/fixtures/metahubs-73rd-meridian-app-snapshot.json`.

The canonical generator precedent is `metahubs-interpretation-network-app-export.spec.ts`: create a real Metahub from a built-in template, configure it through authoring APIs, export it, canonicalize product metadata through supported snapshot helpers, validate a product-specific fixture contract, then write the committed JSON. The Consortium fixture should follow the same pattern and join `snapshotFixtures.test.ts`.

The committed fixture must therefore be generated, not maintained as hand-edited hashed JSON. Keep two verification layers distinct:

-   fixture-envelope gate — register `metahubs-73rd-meridian-app-snapshot.json` in the shared snapshot-fixture validation list so `validateSnapshotEnvelope()` proves the committed file remains structurally importable;
-   product-behavior gate — add a Consortium-specific generator/contract/E2E flow that proves import → publication → linked application → synchronization/readiness → runtime → export/import round trip and verifies characteristic Consortium content rather than only generic marketing behavior.

`marketing-page-snapshot-roundtrip.spec.ts` remains a useful generic marketing precedent, but it does not by itself prove the committed Consortium product fixture because it works from a freshly created generic marketing Metahub.

The landing draft correctly removes the MUI SaaS fiction: fake customer logos, testimonials, product pricing, and generic product claims cannot survive into the Consortium fixture. The only intentionally retained MUI media is the temporary central `dashboard.jpg` placeholder requested by the user.

### 2. Funding stages should use the existing generic collection model, not `marketing.pricing`

The current pricing record is semantically a product-price contract. Pre-seed and Seed are project-development/funding stages with ranges such as `30–90m RUB` and `150–500m RUB`; forcing them into numeric `Price` fields would produce a false model.

For the first Consortium fixture, the cleanest generic representation is the existing `marketing.collection` capability with the `highlights` presentation/data shape: each stage is a normal textual card with a stage title and factual localized description containing the approved funding range, purpose, and stage wording. The Consortium layout should omit the `marketing.pricing` widget entirely.

This keeps ordinary pricing pages valid and avoids adding a product-specific `MarketingPageFundingStage` entity. A future generic roadmap/stages widget is justified only when the platform needs structured stage dates, ranges, currencies, or progression semantics across multiple products.

### 3. The central image needs a first-class static-config widget capability

`marketing.hero` currently owns its media through `MarketingPageSiteSettings` (`heroLightPreview` / `heroDarkPreview`) and `Hero.tsx`. Its styled media box is a visible part of the original MUI composition: full width, large breakpoint-dependent heights, outline, border, shadow, overflow clipping, spacing, and responsive placement.

The shared marketing widget config currently requires `source: marketingWidgetSourceSchema`, and `runtimeMarketingPageController.ts` special-cases only `marketing.auth` as source-less. Consequently, making the new image widget merely `source?: ...` would weaken validation for all entity-backed widgets.

The recommended generic contract is an explicit widget data-ownership mode in registry/config validation and generic authoring, conceptually:

-   `entity` — existing brand/navigation/hero/collection/pricing/footer data binding; `source` is required;
-   `static` — settings-owned data such as the new image widget; no fake Object source is allowed;
-   `none` — control-only widgets such as auth.

The first static image config should accept an external-image `ResourceSource` constrained to the existing safe URL form (`type: 'url'`, inline rendering), plus accessible media semantics. The authoring UI shows localized guidance first, then the URL control and preview/error state. It must reuse `resourceSourceSchema`, `MarketingMediaView`, and the existing `http/https`, no-credentials, safe-media rules.

`MarketingWidgetConfigDialog.tsx` is part of this contract, not an incidental UI detail. It currently reads/builds/saves an entity `source`, renders the Content source controls, and treats that source as required for configurable widgets. The ownership mode must make those branches exhaustive: `entity` renders and validates the existing datasource controls; `static` renders only the typed widget settings such as image source/alt semantics; `none` renders only control settings. Save enablement and localized validation follow the same ownership decision so a static widget never needs a fake Object binding.

After the split, remove `heroLightPreview` / `heroDarkPreview` from the Hero/site-settings ownership path. This removal must cover the marketing template component definitions and seed rows, `marketingSiteSettingsRecordSchema`, normalization/types/materialization adapters, Hero rendering, authoring expectations, and tests that currently treat Site Settings as the media owner. There should be one media owner. The first Consortium fixture deliberately stores `https://mui.com/static/screenshots/material-ui/getting-started/templates/dashboard.jpg` in that dedicated widget until the user replaces it through Layout settings.

Browser visual proof must compare the new two-widget composition against the current MUI-derived Hero geometry at desktop, tablet, and mobile widths; a unit test cannot prove this refactor preserved the page composition.

### 4. `/a/:applicationId/*` is authenticated today; public guest links are a different product contract

`MainRoutes.tsx` creates the normal application runtime with `AuthGuard`, then `ApplicationGuard` and `ApplicationMigrationGuard`. The normal backend application router begins with `router.use(ensureAuth)`.

The existing public router under `/public/a/:applicationId/links/:slug`, guest sessions, guest runtime, guest progress/submission, and public module loading is an access-link/content contract. Application URL aliases must not be merged with this namespace or reuse guest-session semantics.

The platform already has useful security building blocks in `publicRuntimeAccess.ts`: active-row resolution, `is_public` enforcement, safe schema identifiers, public workspace context, and explicit rejection of personal workspaces. These should be reused as primitives, not treated as a complete public-application renderer. Its current external responses distinguish malformed `400`, missing `404`, private `403`, invalid-schema `400`, and workspace failures, so the helper must not be mounted unchanged as the new application-ref resolver. The new boundary owns the non-enumerating error projection and complete readiness policy. In addition, its workspace binding depends on transaction-local PostgreSQL state and is not safe to copy as a sequence of unrelated pool-level queries.

### 5. Public application runtime needs a separate anonymous published-read boundary

The new public runtime is an authorization path without authentication, not an unauthenticated version of the entire current application API. OWASP's authorization guidance supports deny-by-default and authorization checks on every request while still allowing intentionally public resources.

The recommended server pipeline is:

`application UUID/alias → resolve routing state → verify public/readiness state → resolve server-owned public workspace → resolve effective published layout → execute only allowlisted renderer reads → return renderer-ready DTO`.

Anonymous readiness must require all of the following before any published payload is returned:

-   application exists and is not soft-deleted;
-   application is not platform/application archived;
-   `_app_published = true`;
-   `is_public = true`;
-   schema/runtime synchronization is in a ready state;
-   installed publication/materialization and requested effective layout are valid;
-   a valid public workspace can be selected when workspaces are enabled.

Do not implement that list as `activeAppRowCondition()` plus `is_public`. The shared helper currently covers `_upl_deleted = false AND _app_deleted = false` only; application rows also carry archive flags. The anonymous resolver needs its own explicit lifecycle/readiness predicate so archived applications cannot become publicly renderable through a helper whose name sounds broader than its actual SQL.

The schema-status part of readiness should be explicit and server-owned. The current `ApplicationSettings` helper considers `synced`, `outdated`, `update_available`, `maintenance`, and `error` to mean that some runtime schema exists; that is a UI existence heuristic, not a public authorization policy. For the public-read contract, treat `draft`, `pending`, `maintenance`, and `error` as unavailable. `synced` is eligible. `outdated` and `update_available` may remain eligible only when the resolver proves a previously installed release/materialization is complete and internally valid and serves that installed release rather than partially mixing it with newer source state. If that proof is absent, fail closed. This preserves an already-published stable version while refusing transitional or failed synchronization states.

Unknown, malformed, private, deleted, archived, unpublished, and runtime-unready application references should collapse to one externally indistinguishable `not publicly available` / 404-style outcome. Internal logs may retain the reason. This prevents the public resolver from becoming a private-application existence oracle.

The public DTO must exclude owners, memberships, privileged application settings, physical schema names, connector administration, source-layout lineage, server secrets, write capabilities, and internal hashes that the renderer does not need. The public boundary also owns error normalization: malformed/unknown/private/deleted/archived/unpublished/unready references all produce the same external unavailable outcome even if internal helpers preserve more precise reasons for logs and diagnostics.

### 6. Effective layout needs a shared core plus authenticated/public adapters

`resolveEffectiveLayoutForRequest()` currently requires `EffectiveLayoutAuthContext.userId` and resolves workspace permissions from membership. It intentionally returns `UNAUTHORIZED` without a user.

Anonymous rendering must not fabricate a user or synthetic membership. PLAN should separate the canonical target/materialization/layout selection core from access-context adapters:

-   authenticated adapter — current user/role/membership workspace semantics;
-   public adapter — prevalidated public application plus server-selected non-personal public workspace.

The public request must not accept arbitrary `workspaceId` as authority. QA confirmed that the existing `is_default_workspace` column is on `_app_workspace_user_roles`, where uniqueness is scoped to `user_id`; it is a user's default membership preference and cannot represent an anonymous application-wide public workspace.

For this clean-break feature, add an explicit workspace-level, server-owned public-entry designation (conceptually `is_public_runtime_default` or an equivalently typed field) on non-personal workspaces. Enforce at most one active public-entry workspace per application schema with a database invariant and reject a public application as unready when workspaces are enabled but no valid public-entry workspace exists. Do not infer public authority from creation order, an arbitrary codename, the first eligible workspace, or the count of otherwise accessible workspaces.

The public workspace selection and every RLS/workspace-dependent renderer read must also share one transaction executor. `createKnexExecutor()` uses a pool connection per standalone query, while `set_config('app.current_workspace_id', ..., true)` is local to the current transaction. The safe public adapter therefore opens `DbExecutor.transaction(...)`, validates/binds the selected public workspace on that transaction executor, resolves the effective layout, performs allowlisted renderer reads, and completes the response from that same transaction scope. Existing `runtimeGuestController.withPublicRuntimeContext()` is a useful transaction-wrapping precedent; the new published-read boundary must not assume a pool-level `set_config` survives into later queries.

The shared effective-layout core may select and validate the same canonical layout, but the public adapter must project a separate allowlisted DTO. Do not serialize the current authenticated `EffectiveLayoutSuccess` unchanged: it includes `sourceKind`, source layout identity, snapshot/content/local/materialization hashes, publication identity, and precedence metadata. Keep only template/layout/widget data and other fields the public renderer actually requires.

### 7. `/a/:applicationRef/*` needs one deterministic frontend entry resolver

The browser route must support both UUID and alias without creating two competing wildcard routes. A small route-entry resolver outside `AuthGuard` should classify/resolve `applicationRef` and then choose one of two product paths:

-   ready public application → a dedicated anonymous runtime composition using a public API client/adapter;
-   non-public application with an authenticated session → existing authenticated guard/runtime path.

For an anonymous visitor, a private/unknown/unready reference receives the same public-unavailable outcome instead of being redirected to login in a way that confirms the resource exists. Authentication remains the normal route for a logged-in user opening a private UUID/application reference.

This cannot be implemented by rendering the existing `ApplicationRuntime` after the route decision. The current apps-template client constructs `/applications/:id/runtime/*` URLs that are behind `ensureAuth`, and current runtime composition can forward a query-supplied `workspaceId`. Add an explicit anonymous runtime API namespace/client whose bootstrap resolves UUID/alias, readiness, public workspace, effective layout, and renderer data on the server. The anonymous client does not send workspace authority; it consumes the server-selected public-entry context. Reuse presentation components below that boundary where their props are already renderer-safe.

The stable UUID URL remains a technical address and is not automatically canonicalized to a primary alias in this slice.

### 8. The old `obj_applications.slug` should be deleted, not preserved

The current single slug is deeper than the edit form. It appears in the base schema/index, system app definition, application persistence, create/update/copy flows, searches, linked-publication application creation, frontend types/API projections, test cleanup/manifests, and sync/release identity (`applicationKey: application.slug ?? application.id`).

The user explicitly authorized a clean break with a disposable database. Therefore the correct target is:

-   remove `obj_applications.slug` from the current base schema;
-   delete `findApplicationBySlug()` and generic application slug create/update/copy support;
-   remove linked-publication `pub-<applicationId>` slug generation;
-   change release/sync/export identity to immutable application UUID;
-   update affected fixtures/tests/types rather than adding a compatibility reader or fallback.

One earlier subagent suggested retaining the old slug because it is embedded in release identity. That recommendation conflicts with the source requirement and is rejected. The embedding is evidence for the migration inventory, not a reason to preserve legacy behavior.

### 9. Use a normalized alias registry with application-level routing policy

Application aliases are mutable routing names, not application identity. A clean base model should use a dedicated alias table owned by `applications`, with UUID v7 row identity, `application_id`, normalized `alias`, `is_primary`, lifecycle metadata, and normal audit fields. The application's alias-routing mode is an application-level policy (`direct` / `canonical`) managed only by the dedicated alias service; it can be a typed application column or an equivalently strict one-to-one policy record, but it must not be an arbitrary client redirect destination.

Database invariants should include:

-   global uniqueness of a non-released normalized alias in the `/a/:alias` namespace;
-   at most one non-released primary alias per application via a partial unique index;
-   foreign-key ownership by application;
-   transactional primary changes with per-application serialization;
-   canonical mode with one or more aliases has exactly one primary as a service invariant, with the database enforcing the at-most-one half and uniqueness conflicts.

PostgreSQL's unique/partial-index semantics fit these invariants directly. Application archival/deletion should disable routing through the join/readiness predicate but leave alias rows reserved. Reuse happens only through an explicit privileged alias release/delete action.

That reservation rule also needs an explicit physical-purge contract. An alias belongs to one application regardless of whether that application is currently routable. If the platform later physically removes an application row, that purge must either be forbidden while reserved aliases exist or be an explicit privileged operation whose documented effect includes releasing/removing those aliases. A generic foreign-key cascade must not become an accidental alias-reuse mechanism.

### 10. Alias normalization should be strict and shared

Use one shared normalizer/validator before lookup and collision checks. For the first contract, prefer a conservative URL-safe ASCII grammar: lowercase letters, digits, and internal hyphens; 1–63 characters; alphanumeric first/last character. Normalize trim/case once, reject non-ASCII instead of silently transliterating it, reject UUID-shaped values, `/`, `\\`, `%`, control characters, malformed encodings, and registered platform route words.

The alias table stores only the canonical normalized value; uniqueness is enforced on that value. Reserved route words should come from one platform-owned registry shared by validation and routing rather than duplicated frontend lists.

This intentionally leaves localized/Unicode aliases for a later contract where normalization, confusables, IDNA-like concerns, and SEO policy can be designed explicitly.

### 11. Canonical alias redirect must be server-owned and same-origin

OWASP recommends avoiding user-controlled redirect destinations and using server-side mappings when redirects are needed. Therefore secondary aliases in canonical mode should resolve their destination entirely from database state:

`/a/<secondary>/<remaining-path>?<query>` → `/a/<stored-primary>/<remaining-path>?<query>`.

No API or persistence field should accept a redirect URL, scheme, host, or arbitrary target. Preserve the runtime subpath and query as structured URL parts, not textual substitution over the original URL.

In the SPA boundary, the public resolver can return a typed canonical-relative-path outcome and the route entry performs history replacement (`Navigate`/`navigate(..., { replace: true })`). If a deployment later handles the top-level route server-side, use a server-owned temporary same-origin redirect such as 307 while the primary alias remains mutable. RFC 9110 defines 307 as temporary and 308 as permanent and notes that 308 is heuristically cacheable, so a permanent redirect would be the wrong default for a mapping that an administrator may change. The security invariant is server ownership of the relative destination, not a client-provided URL.

### 12. Alias authorization needs a dedicated global capability

Root `Superuser` and global `superadmin` are not the same concept. `createEnsureGlobalAccess()` already provides the desired root behavior: `isSuperuser()` bypasses permission checks; every other administrative user needs an explicit database permission.

Do not use application owner/admin membership, `ensureApplicationAccess()`, legacy `supermoderator` fallbacks, application `accessType`, or the misleading frontend `useIsSuperadmin()` naming as the security boundary.

Introduce a dedicated permission subject/module, conceptually `applicationAliases → ApplicationAlias`, with normal CRUD actions. Grant it only to the intended non-root Superadmin role; root Superuser keeps its standard bypass. Frontend navigation/tab visibility checks the same capability, but backend permission checks remain authoritative.

The current base admin migration and package README confirm `Registered`, `User`, and root `Superuser` as system roles but contain no canonical non-root `Superadmin` seed. The clean bootstrap should therefore add a protected `Superadmin` system role with `is_superuser = false`, grant it the dedicated alias capability and whatever ordinary admin-shell permissions it needs, and keep root `Superuser` as the independent bypass. `globalAccessService.ts` already prevents non-Superusers from assigning/removing protected `is_system` roles, which is a suitable protection boundary for this requirement. Generic role editors must not be able to grant the reserved alias-management capability to arbitrary custom roles if the product contract remains literally “Superadmin only.”

There is one additional bootstrap coupling: `createEnsureGlobalAccess()` first calls `canAccessAdmin()`, which delegates to `admin.has_admin_permission()`, before it checks the requested module/action. The current SQL treats wildcard access or `roles` / `instances` / `users` read access as the Admin-shell entry predicate. PLAN must either add the reserved alias module to that predicate deliberately or grant the protected Superadmin role an existing qualifying shell permission; otherwise a role could possess `applicationAliases:*` yet fail before the endpoint-specific check runs.

The shared frontend ability contract must also add `ApplicationAlias` to `Subjects` and map the database module name to it in `ABILITY_MODULE_TO_SUBJECT`. Use `useAdminPermission(...)` or the equivalent shared ability path for menu/tab visibility. Do not introduce a second codename-based `superadmin` frontend check, and do not reuse ordinary `Application` / `manageApplication` authority for alias administration.

### 13. `Administration → Instance → Slugs` is a deployment-global admin surface

Direct source inspection found no `instance_id` / `instanceId` ownership relation on applications or aliases. `obj_applications` has no Instance foreign key. The existing Instance shell already hosts global surfaces such as Locales whose frontend/backend stores do not scope rows by the route's `instanceId`.

Therefore the brief's requested menu placement is valid, but it must not invent an application-to-instance model:

-   add **Slugs** below **Languages/Locales** in `/admin/instance/:instanceId/...` for navigation consistency;
-   treat `instanceId` as current admin-shell/breadcrumb context only;
-   alias APIs and uniqueness remain deployment-global;
-   do not add `instance_id` to aliases or make uniqueness `(instance_id, alias)`.

### 14. The two alias UIs should share one service, not duplicate application form state

`ApplicationActions.tsx` currently builds General and Parameters tabs. The current `ApplicationFormValues` no longer contains `slug`; the legacy field survives instead in shared frontend application types/API payloads and backend persistence/search/release consumers. Addresses should be an edit-only third tab, physically omitted for users without the alias capability. It should use dedicated alias queries/mutations rather than `ApplicationFormValues` or the generic application save action.

The centralized Slugs page should reuse the `LocalesList.tsx` page composition (`ViewHeader`, `ToolbarControls`, `FlowListTable`, query/mutation states) while using `StandardDialog`/the canonical dialog shell for add/edit and the shared confirmation primitive for delete/release. Do not copy the older ad hoc `LocaleDialog` footer just because Locales is the visual page precedent.

Human-facing selectors show localized application names plus a meaningful human disambiguator when names collide. UUID remains the internal value; the Addresses tab may separately display `/a/<uuid>` as a clearly labeled copyable technical address.

### 15. Browser acceptance must prove both security and UX

PLAN should include one explicit matrix covering:

-   anonymous `/a/<uuid>` public success and private/unknown/unready indistinguishability;
-   primary alias, secondary direct alias, and secondary canonical redirect with preserved subpath/query;
-   public application reads without exposing authenticated management endpoints;
-   the anonymous page uses only the dedicated public client/API namespace; authenticated `/applications/:id/runtime/*` calls are absent from an anonymous browser trace and client `workspaceId` cannot select public data;
-   Superadmin alias CRUD/set-primary/mode changes;
-   root Superuser bypass;
-   another admin/supermoderator/application owner unable to see the controls and receiving server-side 403 on direct management calls;
-   a protected Superadmin can enter the Admin shell and reach Slugs through the same `ApplicationAlias` ability used by the API, while a custom role editor cannot self-grant that reserved capability;
-   duplicate/reserved/UUID-shaped/malformed alias errors in EN and RU without SQL/Zod/internal-token leakage;
-   image settings URL validation, preview/load error, persistence, publication, and runtime rendering;
-   public effective-layout/bootstrap responses contain no source layout IDs, schema names, snapshot/content/materialization hashes, publication lineage, membership/owner data, or mutation capability metadata;
-   Consortium fixture content present and MUI fake-company/testimonial/pricing copy absent;
-   1920×1080, 768×1024, and 390×844 with no page-level horizontal overflow;
-   keyboard/focus behavior for tabs, dialogs, selectors, set-primary, and delete confirmation.

MUI documentation confirms the expected Tabs ARIA linkage/keyboard behavior. The project's existing shared dialog/list primitives should remain the implementation baseline.

### 16. React Router is a security prerequisite for this feature

The workspace currently pins/overrides:

-   `react-router` 6.30.4;
-   `react-router-dom` 6.30.4;
-   `@remix-run/router` 1.23.2.

The repository comment says 6.30.4 was selected to fix GHSA-2j2x-hqr9-3h42, but the same workspace forces `@remix-run/router` 1.23.2 while that advisory marks `<1.23.3` affected. That advisory explicitly says its React Router issue does not affect Declarative `BrowserRouter`, and the core frontend currently does use `BrowserRouter`; this QA therefore does not claim the present `/a` route is exploitable through that first advisory. A later 2026 advisory, GHSA-jjmj-jmhj-qwj2 / CVE-2026-53668, marks `react-router-dom` `6.30.2` through `6.30.5` affected and `6.30.6` patched. React Router's current security policy also says only 7.x and 8.x receive security updates; 6.x and below are unsupported.

Because this feature deliberately adds alias resolution and redirect behavior, implementation should first remove the known vulnerable dependency lock rather than expanding that surface. A separate preliminary dependency/security step should at minimum move the existing v6 line to the patched 6.30.6 pair and remove/update the forced vulnerable `@remix-run/router` override, with lockfile verification. Migration to a currently supported React Router major should be tracked separately unless compatibility analysis shows it can be safely included without obscuring this feature.

## Conflicts And Uncertainty

### Content provenance remains the only material research blocker

`.backup/Лендинг-для-Консорциума.md` was inspected and is a useful approved-style draft, but the repository does not contain a versioned investment memorandum that can be identified as the authoritative revision for public claims. The draft itself repeatedly attributes funding, geography, technology, and operating-model statements to the memorandum without embedding source revision metadata.

Therefore RESEARCH can lock the landing structure and safe editorial rule, but it cannot independently certify the public truth of funding ranges, infrastructure/geography claims, named partners, contacts, team statements, or CTA destinations. PLAN/implementation should treat the selected memorandum revision as an input/provenance gate and omit unsupported statements rather than turning the draft into authority by repetition.

### English product copy is not yet provenance-locked

Platform chrome, settings, help, validation, and errors must have real EN/RU resources regardless of product-content approval. The Consortium product records, however, should publish only locale text approved for that product. A faithful EN translation may be prepared from the authoritative Russian text, but it should not introduce additional facts and should be explicitly accepted before the public fixture is treated as final. Missing EN content must never fall back to MUI demo copy.

### Public workspace selection is no longer an open research question

QA inspection of the workspace DDL and service code resolved the ambiguity: the only current `is_default_workspace` flag is per-user membership state and must not be reused for anonymous rendering. PLAN should implement the explicit workspace-level public-entry designation described in Finding 6 and fail closed when workspaces are enabled but that designation is absent, duplicated, inactive, deleted, or personal.

### MUI documentation version drift is non-blocking

The public MUI site now displays newer 9.x documentation, while the repository is pinned to Material UI 9.2.0. Context7 v9.2.0 was used for version-specific API guidance. Public MUI pages are used for design/accessibility principles and the original template shape, not as proof that every latest-site API exists in 9.2.0.

## Project Implications

1. This is one coordinated clean-break feature, but it contains four independently testable slices: product fixture/content, static marketing image capability, anonymous published-read runtime, and alias administration/routing.
2. No Metahub template version or platform structure version bump is justified solely to preserve the disposable test database; edit the current baseline contracts and regenerate the fixture.
3. `packages/universo-react-apps-template-mui` remains the renderer/template owner. It should not import control-plane packages to implement the image widget or public runtime.
4. Public runtime reuses canonical renderer/layout logic through a new access adapter; it must not fork the marketing renderer or remount authenticated mutation APIs anonymously.
5. Alias routing identity must be separated from release/application identity. UUID is the stable internal identity; aliases are mutable global routing records.
6. The Slugs page is global despite living under the Instance shell. Adding a fake Instance relation would be a new domain model with no evidence in the current platform.
7. Public workspace authorization needs an explicit workspace-level public-entry marker and one transaction-pinned executor for selection, `set_config`, layout resolution, and published renderer reads; the existing per-user default flag is not reusable.
8. Alias RBAC needs three aligned layers: protected Superadmin bootstrap, Admin-shell entry permission, and shared backend/frontend `ApplicationAlias` capability mapping. A route guard or hidden menu alone is insufficient.
9. Public readiness uses explicit delete/archive/public/published/runtime predicates; the generic active-row helper is only one part of that decision.
10. Alias reservation survives soft deletion and archival; any future physical purge needs explicit release semantics so database cascades cannot silently make a name claimable.
11. The Router dependency remediation is a prerequisite/gate because this feature adds new redirect behavior while the workspace contains dependencies covered by current advisories; advisory applicability must remain evidence-based rather than overstated.
12. Mutable canonical aliases use SPA history replacement or a temporary server redirect by default; permanent redirect semantics require a future explicit immutability/cache policy.
13. Static-widget ownership must be one cross-layer contract spanning registry/Zod, generic `MarketingWidgetConfigDialog`, persistence/materialization, and runtime; removing Hero media ownership must remove the old schema/seed/test path completely.
14. Consortium fixture acceptance has two explicit gates: shared envelope/import validation and a product-specific generated publication/runtime/round-trip proof.
15. Public frontend delivery needs a dedicated anonymous page/client/API adapter; the route resolver must not drop an anonymous visitor into the current authenticated runtime client, and visitor `workspaceId` is never an authorization input.
16. Public readiness is a server-side state machine over lifecycle/publication/schema/materialization state. Transitional/failed states fail closed; `outdated`/`update_available` are usable only when a coherent previously installed release is explicitly proven and served.
17. Public effective-layout/bootstrap DTOs are explicit allowlists and redact authenticated lineage/hash/internal identity fields.
18. Product content provenance must be captured beside the fixture generator/contract so future regeneration cannot silently reintroduce unapproved claims or MUI demo content.

## Recommended Decision

Proceed to PLAN with the following decisions treated as fixed unless new source evidence contradicts them:

1. Generate `metahubs-73rd-meridian-app-snapshot.json` from the generic `marketing-page` template through real authoring/export APIs and a product-specific contract; never hand-maintain its hash-bearing body. Register it for shared envelope validation and add a separate Consortium product E2E proving publication/materialization/runtime plus export/import round trip.
2. Keep the MUI `dashboard.jpg` URL only as the explicit temporary central-image placeholder requested by the user; remove all other unrelated MUI demo companies, testimonials, avatars, pricing, and copy from the Consortium fixture.
3. Represent Pre-seed/Seed/Growth as normal textual `marketing.collection` cards using the existing generic highlights-style shape; do not abuse `marketing.pricing`.
4. Add a generic static-config marketing image widget with explicit widget data-ownership mode that drives registry/Zod, `MarketingWidgetConfigDialog`, persistence/materialization, and runtime; use safe URL-backed `ResourceSource`, localized authoring guidance, accessibility semantics, and preserved Hero visual geometry. Remove Hero's old media ownership from template seed/schema/types/tests as well as rendering.
5. Add an anonymous published-read runtime boundary, dedicated public frontend/API client adapter, and redacted public effective-layout projection. Keep guest access links and authenticated management/mutation routes separate, and never reuse client `workspaceId` as public authority.
6. Resolve `/a/:applicationRef/*` as UUID or alias before selecting public versus authenticated runtime. Anonymous unavailable states are non-enumerating.
7. Delete the old single application `slug` contract and convert all internal identity consumers to application UUID. Do not add compatibility shims.
8. Add a global normalized alias registry plus application-level `direct | canonical` routing policy, database uniqueness/primary invariants, transactional primary changes, explicit release semantics, and server-derived same-origin canonical destinations.
9. Use a dedicated shared `applicationAliases → ApplicationAlias` capability, add a protected non-root `Superadmin` system role that owns it, and make the Admin-shell entry predicate admit that role/capability intentionally; preserve the root Superuser bypass through the existing `isSuperuser()` path.
10. Place Addresses after Parameters in Edit Application and Slugs below Locales in the Instance admin shell; alias data/API scope remains deployment-global and has no `instance_id`.
11. When workspaces are enabled, require one explicit active non-personal public-entry workspace and perform workspace binding plus all anonymous published reads inside one transaction-pinned executor; never reuse the per-user `is_default_workspace` flag.
12. Use history replacement or a temporary same-origin redirect for mutable secondary-to-primary alias canonicalization; do not default to permanent 301/308 semantics.
13. Treat application archive/publication/readiness as explicit public-runtime predicates instead of relying on the generic soft-delete active-row helper.
14. Define public schema readiness explicitly: `draft`, `pending`, `maintenance`, and `error` are unavailable; `synced` is eligible; `outdated`/`update_available` require a proven coherent previously installed release/materialization or fail closed.
15. Preserve alias reservations across archive/soft-delete and make any future physical purge an explicit privileged alias-release lifecycle operation.
16. Patch the React Router v6 line to a non-vulnerable lock before alias implementation and track migration to a currently supported Router major separately.
17. Gate final public Consortium claims and EN content on an explicitly identified authoritative memorandum/content revision.

## Open Questions Before PLAN

Only two content-approval questions remain; the routing/alias/workspace architecture is sufficiently resolved for PLAN:

1. Which exact investment-memorandum/content revision is the authoritative source for the first public fixture, including funding ranges, geography/infrastructure claims, team/partner statements, contacts, and CTA destinations?
2. Which EN Consortium translations are approved for the first public fixture? UI/chrome EN/RU is mandatory regardless, but product facts should not be machine-expanded into new claims.

Everything else that was open in the brief is resolved here: funding stages use the generic collection path, Slugs is deployment-global under the Instance shell, single slug is removed, alias authorization is a dedicated protected Superadmin capability, public workspace selection uses an explicit workspace-level designation, and the public runtime uses a transaction-scoped read-only adapter rather than guest/authenticated-route reuse.

## Sources

### Repository and project research

-   The 2026-09-15 Consortium marketing public runtime aliases source task (maintained outside the repository).
-   The 2026-09-15 reviewed implementation brief for the same feature (maintained outside the repository).
-   `.backup/Лендинг-для-Консорциума.md`
-   `memory-bank/research/mui-9-marketing-page-template-research-2026-08-30.md`
-   `memory-bank/research/marketing-page-widgetized-runtime-research-2026-09-04.md`
-   `memory-bank/research/unified-application-template-widgets-scoped-layouts-research-2026-09-07.md`
-   `memory-bank/research/marketing-header-widget-zone-settings-research-2026-09-12.md`
-   Source files listed in the Source Inventory above.

### External documentation

-   https://mui.com/material-ui/getting-started/templates/
-   https://mui.com/material-ui/getting-started/templates/marketing-page/
-   https://mui.com/material-ui/react-tabs/
-   https://mui.com/material-ui/react-dialog/
-   https://mui.com/material-ui/migration/upgrade-to-v9/
-   https://www.postgresql.org/docs/18/indexes-unique.html
-   https://www.postgresql.org/docs/18/indexes-partial.html
-   https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
-   https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html
-   https://github.com/remix-run/react-router/blob/main/SECURITY.md
-   https://github.com/advisories/GHSA-2j2x-hqr9-3h42
-   https://github.com/advisories/GHSA-jjmj-jmhj-qwj2
-   https://www.rfc-editor.org/rfc/rfc9110.html#name-redirection-3xx
