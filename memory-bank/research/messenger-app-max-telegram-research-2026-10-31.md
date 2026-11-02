# Research: Messenger Application Template, Catalog Visibility, and MAX/Telegram Bot Bindings

> Created: 2026-10-31
> Status: Reviewed
> Trigger: RESEARCH follow-up over the QA-refined Manager input and brief for Messenger Applications, MAX, and Telegram
> Follow-up plan: ../plan/messenger-app-max-telegram-plan-2026-10-31.md

## Research Question

Does the QA-refined Messenger Application brief describe an implementation-safe third Application template for the current Universo Platformo architecture, and what repository, persistence, public-runtime, discovery, MAX, Telegram, and responsive-UX constraints must be fixed before PLAN?

The research specifically verifies:

-   whether `messenger-app` can be added through the current template registry without hidden Dashboard/Marketing Page fallbacks;
-   which layout CRUD, seed, snapshot, sync, public-runtime, renderer, authoring, OpenAPI, and E2E surfaces must support a third template explicitly;
-   whether `showInAppList` is truly discovery metadata rather than authorization;
-   how bot bindings and their stable `short_id` should fit the Applications control plane without storing messenger secrets or user identity;
-   the current MAX and Telegram Mini App launch, viewport, safe-area, and bridge contracts;
-   which choices remain material PLAN decisions.

This is a RESEARCH-only pass. No product code, schema, migration, fixture, template version, or Manager brief is changed by this artifact.

QA review on 2026-10-31 expanded the source inventory across snapshot/sync, authoring, OpenAPI generation, public guest routes, runtime package isolation, and current MAX/Telegram operational documentation. The review also rechecked repository-pinned MUI 9.2.0 through Context7. OntoIndex remained partially degraded for oversized files, so direct source inspection is authoritative where noted.

## Source Inventory

| Source                                                                                                 | Type                                | Date / Freshness   | Why It Matters                                                                                                              |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Original Messenger Apps stakeholder input (local-only source)                                          | Primary product input               | 2026-10-31         | Original requirements, data-model proposal, UX scenarios, multiple-binding requirement, and MVP scope                       |
| QA-refined Messenger Apps brief (local-only source)                                                    | QA-refined requirements             | 2026-10-31         | Architecture hypothesis and open research questions being validated                                                         |
| `.agents/skills/research-before-plan/SKILL.md`                                                         | Project research skill              | current checkout   | Source-quality and research-artifact workflow                                                                               |
| `.agents/skills/universo-platform-architecture/SKILL.md`                                               | Project architecture skill          | current checkout   | Metahub/Application/Workspace ownership and package boundaries                                                              |
| `.agents/skills/mui-runtime-ux-patterns/SKILL.md`                                                      | Project UI architecture skill       | current checkout   | MUI reuse, localized validation, no raw IDs/JSON, responsive authoring rules                                                |
| `.agents/skills/runtime-ux-qa/SKILL.md`                                                                | Project runtime QA skill            | current checkout   | Browser usability and no-overflow evidence                                                                                  |
| `.agents/skills/playwright-best-practices/SKILL.md`                                                    | Project browser-test skill          | current checkout   | Reliable responsive/public-runtime acceptance coverage                                                                      |
| `.agents/skills/ontoindex-code-intelligence/SKILL.md`                                                  | Code-intelligence skill             | current checkout   | Graph-navigation discipline and source-verification fallback                                                                |
| `packages/universo-react-types/src/common/marketingPagePrimitives.ts`                                  | Source                              | HEAD `c1d0583`     | Current two-value template-key contract                                                                                     |
| `packages/universo-react-types/src/common/applicationTemplates.ts`                                     | Source                              | HEAD `c1d0583`     | Template registry and neutral capabilities/semantic regions                                                                 |
| `packages/universo-react-types/src/common/applicationLayouts.ts`                                       | Source                              | HEAD `c1d0583`     | Template config parser, zones, widget keys, effective-layout transport                                                      |
| `packages/universo-react-types/src/common/layoutWidgetDefinitions.ts`                                  | Source                              | HEAD `c1d0583`     | Canonical widget/zone registry and allowed-template relationships                                                           |
| `packages/universo-react-types/src/common/dashboardWidgetOwnership.ts`                                 | Source                              | HEAD `c1d0583`     | Dashboard-specific ownership and zone assumptions                                                                           |
| `packages/universo-react-types/src/common/publicApplicationRuntime.ts`                                 | Source                              | HEAD `c1d0583`     | Strict anonymous public-runtime discriminated union                                                                         |
| `packages/universo-react-applications-backend/src/persistence/applicationLayoutStoreSupport.ts`        | Source                              | HEAD `c1d0583`     | Application layout persistence validation and template predicates                                                           |
| `packages/universo-react-applications-backend/src/routes/sync/syncLayoutSnapshot.ts`                   | Source                              | HEAD `c1d0583`     | Snapshot zone normalization still encodes a Dashboard-versus-Marketing binary                                               |
| `packages/universo-react-applications-backend/src/routes/sync/syncLayoutPersistence.ts`                | Source                              | HEAD `c1d0583`     | Sync persistence zone normalization still encodes the same binary                                                           |
| `packages/universo-react-applications-backend/src/routes/sync/syncDataLoader.ts`                       | Source                              | HEAD `c1d0583`     | Dashboard-specific sync data/config projection                                                                              |
| `packages/universo-react-applications-backend/src/services/effectiveLayoutResolverCore.ts`             | Source                              | HEAD `c1d0583`     | Effective layout and Dashboard-only runtime-data resolution                                                                 |
| `packages/universo-react-applications-backend/src/controllers/publicApplicationRuntimeController.ts`   | Source                              | HEAD `c1d0583`     | Anonymous template dispatch and public DTO projection                                                                       |
| `packages/universo-react-applications-backend/src/controllers/applicationsController.ts`               | Source                              | HEAD `c1d0583`     | `showAll` privilege gate and Application create/update API contract                                                         |
| `packages/universo-react-applications-backend/src/routes/publicApplicationRuntimeRoutes.ts`            | Source                              | HEAD `c1d0583`     | Published anonymous runtime is GET-only                                                                                     |
| `packages/universo-react-applications-backend/src/routes/publicApplicationsRoutes.ts`                  | Source                              | HEAD `c1d0583`     | Separate guest flows include mutation transports and must not be inherited by Messenger MVP                                 |
| `packages/universo-react-applications-backend/src/persistence/applicationsStore.ts`                    | Source                              | HEAD `c1d0583`     | Application list predicate, explicit projections, create/update/copy                                                        |
| `packages/universo-react-applications-backend/src/platform/systemAppDefinition.ts`                     | Source                              | HEAD `c1d0583`     | Canonical Applications system-app schema and migration registration                                                         |
| `packages/universo-react-applications-backend/src/platform/migrations/*`                               | Source                              | HEAD `c1d0583`     | Existing additive Applications migration pattern                                                                            |
| `packages/universo-react-applications-backend/src/persistence/globalShortLinksStore.ts`                | Source                              | HEAD `c1d0583`     | Existing stable-id/release/unique-scope persistence precedent                                                               |
| `packages/universo-react-applications-backend/src/controllers/globalShortLinksController.ts`           | Source                              | HEAD `c1d0583`     | Application-manager authorization and public target resolution precedent                                                    |
| `packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx`                       | Source                              | HEAD `c1d0583`     | Authenticated/public runtime template selection                                                                             |
| `packages/universo-react-metahubs-backend/src/domains/layouts/services/layoutServiceContracts.ts`      | Source                              | HEAD `c1d0583`     | Metahub layout lookup still enumerates only Dashboard and Marketing Page                                                    |
| `packages/universo-react-metahubs-backend/src/domains/metahubs/services/SnapshotRestoreService.ts`     | Source                              | HEAD `c1d0583`     | Snapshot restore config parsing retains binary template logic                                                               |
| `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/LayoutWidgetEditorDialogs.tsx`       | Source                              | HEAD `c1d0583`     | Authoring fallback selects Marketing defaults for non-Dashboard templates                                                   |
| `packages/universo-react-apps-template-mui/src/api/api.ts`                                             | Source                              | HEAD `c1d0583`     | Dashboard-specific runtime adapter and placement conversion                                                                 |
| `packages/universo-react-apps-template-mui/src/standalone/DashboardApp.tsx`                            | Source                              | HEAD `c1d0583`     | Standalone runtime dispatch and host behavior                                                                               |
| `.agents/skills/mui-runtime-ux-patterns/references/apps-template-isolation.md`                         | Project architecture reference      | current checkout   | Required dependency boundary for `apps-template-mui`                                                                        |
| `packages/universo-react-rest-docs/scripts/generate-openapi-source.js`                                 | Source                              | HEAD `c1d0583`     | Generator that owns template/zone OpenAPI enums; generated YAML is not the source of truth                                  |
| `memory-bank/research/dashboard-complete-entity-backed-widgets-research-2026-10-02.md`                 | Prior repository research           | 2026-10-02         | Registry-driven widget ownership, runtime composition, sync, and fixture baseline                                           |
| `memory-bank/research/consortium-marketing-public-runtime-aliases-research-2026-09-15.md`              | Prior repository research           | 2026-09-15         | Strict anonymous DTOs, aliases, public readiness, and fail-closed public routing                                            |
| `memory-bank/research/interpretation-network-public-runtime-advanced-workspace-research-2026-10-22.md` | Prior repository research           | 2026-10-22         | Current public Dashboard boundary and runtime UX baseline                                                                   |
| <https://dev.max.ru/docs/webapps/introduction>                                                         | Primary MAX documentation           | checked 2026-10-31 | Mini App setup, `startapp`, payload characters/length, start parameter                                                      |
| <https://dev.max.ru/docs/webapps/bridge>                                                               | Primary MAX documentation           | checked 2026-10-31 | MAX Bridge viewport and BackButton capabilities                                                                             |
| <https://dev.max.ru/docs/chatbots/bots-create/create>                                                  | Primary MAX documentation           | checked 2026-10-31 | Bot moderation prerequisite before Mini App settings become available                                                       |
| <https://dev.max.ru/docs/chatbots/bots-create/manage/>                                                 | Primary MAX documentation           | checked 2026-10-31 | Post-moderation bot and Mini App management contract                                                                        |
| <https://dev.max.ru/docs/chatbots/bots-coding/prepare/>                                                | Primary MAX documentation           | checked 2026-10-31 | Current partner-platform eligibility for Russian-resident legal entities, individual entrepreneurs, and self-employed users |
| <https://dev.max.ru/help/deeplinks/>                                                                   | Primary MAX documentation           | checked 2026-10-31 | Distinguishes general bot deep links from Mini App `startapp` links                                                         |
| <https://core.telegram.org/bots/webapps>                                                               | Primary Telegram documentation      | checked 2026-10-31 | Main/Direct Mini Apps, `startapp`, viewport, safe areas, theme, BackButton                                                  |
| <https://core.telegram.org/api/links>                                                                  | Primary Telegram documentation      | checked 2026-10-31 | Main and Direct Mini App deep-link syntax and launch mode                                                                   |
| <https://core.telegram.org/method/messages.requestMainWebView>                                         | Primary Telegram documentation      | checked 2026-10-31 | Main Mini App launch contract                                                                                               |
| <https://core.telegram.org/method/messages.requestAppWebView>                                          | Primary Telegram documentation      | checked 2026-10-31 | Direct Mini App launch contract and `short_name` distinction                                                                |
| Context7 `/mui/material-ui/v9.2.0`                                                                     | Exact-version library documentation | queried 2026-10-31 | Responsive breakpoints and full-screen Dialog patterns for repository-pinned MUI                                            |
| Context7 `/websites/core_telegram_bots_webapps`                                                        | Current primary-derived docs        | queried 2026-10-31 | Independent current documentation retrieval for Telegram Mini Apps                                                          |

OntoIndex semantic search was retried on the current commit and located relevant runtime/list surfaces, but it reported degraded coverage for two oversized files. One impact query for `parseApplicationLayoutConfig` also resolved ambiguously because the graph contains both Function and Const nodes. Direct source inspection is therefore authoritative for the findings below.

Independent read-only subagent reviews were used for the third-template architecture and UX/external-platform boundary. Their completed findings were reconciled against current source before inclusion. A third persistence/security subagent did not reach a terminal result and was closed; no claim below depends on that unfinished review.

## Key Findings

### 1. The brief is directionally correct, but `messenger-app` is a cross-stack third-template migration, not a registry-only addition

The current repository has a useful neutral template registry, but several critical paths still encode a binary Dashboard/Marketing Page world.

-   `marketingPagePrimitives.ts` exposes only `dashboard` and `marketing-page`.
-   `applicationTemplates.ts` has neutral metadata such as `supportsDashboardWidgets`, `seedPolicyKey`, `hostCapabilities`, and semantic regions, but only two registered identities.
-   `applicationLayouts.ts` unions only Dashboard and Marketing widget keys/zones.
-   Most critically, `parseApplicationLayoutConfig()` explicitly parses `marketing-page` and otherwise falls through to Dashboard parsing. Once `messenger-app` becomes a recognized key, that fallback would silently parse Messenger configuration as Dashboard unless the dispatch is made exhaustive.
-   `applicationLayoutStoreSupport.ts` contains a persisted template predicate restricted to `dashboard` and `marketing-page`.
-   `syncLayoutSnapshot.ts` and `syncLayoutPersistence.ts` select Dashboard zones only for `dashboard` and otherwise select Marketing zones. A Messenger `top/center/bottom` layout can therefore fail snapshot/import/sync even after the shared template enum is extended.
-   `layoutServiceContracts.ts` searches only `dashboard` and `marketing-page`; `LayoutWidgetEditorDialogs.tsx` uses Marketing defaults for non-Dashboard templates; `SnapshotRestoreService.ts` also retains Dashboard-versus-everything-else config parsing.
-   Metahub seed/migration paths contain two-template branches. `TemplateSeedMigrator` rejects a recognized non-Dashboard, non-Marketing template; whether it must materialize Messenger is conditional on the PLAN decision for the initial global Messenger layout source because creating a new metahub template is explicitly out of scope.

The implementation must therefore introduce an explicit Messenger config schema/adapter and fail closed for unsupported template identities. A generalized template-adapter dispatch is preferable to adding another chain of `if template === ...` conditions, because the current registry is metadata-driven but runtime/config dispatch is not yet registry-driven.

### 2. Runtime dispatch contains both hard rejection and dangerous silent fallback

The third-template risk is larger than a missing renderer.

-   The anonymous backend/public DTO currently knows only Dashboard and Marketing Page; an unsupported template does not have a public projector.
-   The authenticated `ApplicationRuntime.tsx` selects Marketing explicitly and otherwise falls through to Dashboard behavior.
-   The standalone MUI host has the same binary shape.
-   Public frontend dispatch has the inverse binary assumption in places: Dashboard is explicit and the other existing branch is treated as Marketing.
-   `apps-template-mui/src/api/api.ts` has Dashboard-only effective-layout parsing and Dashboard-zone conversion helpers.

Messenger therefore needs explicit authenticated, anonymous-public, and standalone renderer selection plus a strict public DTO branch. Unsupported template identities must produce a safe unsupported/materialization result, never render as another template.

The stakeholder requirement for a “graceful fallback” should be interpreted narrowly: unknown or unavailable template identities may render a bounded localized unsupported/unavailable state, but they must never inherit Dashboard or Marketing data, widgets, or renderer behavior. The failure mode must remain fail-closed with respect to data exposure.

### 3. The generic snapshot/sync foundation can be reused; the compatibility seams must be explicit

Current snapshot/layout transport already persists arrays of layouts, scoped layouts, widgets, template keys, and lineage in largely generic form. A separate Messenger snapshot format is not justified.

However:

-   these paths eventually depend on the common template/config parser, so the non-Marketing-to-Dashboard fallback must be removed first;
-   snapshot and sync zone normalization must become template-aware instead of treating every non-Dashboard layout as Marketing;
-   the legacy single `snapshot.layoutConfig` compatibility projection remains Dashboard-specific and should stay a Dashboard compatibility surface rather than become the new Messenger transport;
-   runtime widget data is currently resolved only when `templateKey === 'dashboard'`, even though Messenger is intended to reuse selected Dashboard widgets; reusing widget definitions without a capability/allowlist-driven data resolver would produce rendered widgets without the expected runtime data;
-   workspace-switcher injection is Dashboard-specific and must remain excluded from Messenger by explicit policy, not by accidental template mismatch.

PLAN should treat `layouts[]` and existing lineage/sync machinery as the canonical Messenger transport while making data-resolution and host-projection decisions capability-driven.

### 4. Authoring, OpenAPI, and cross-template tests also encode the two-template assumption

The implementation boundary includes tooling and UI contracts that are easy to miss:

-   Application and metahub layout creation dialogs currently hardcode the two template options.
-   Existing controller formatting can label an unknown third template as Dashboard.
-   Layout details derive available zones from the current Dashboard/Marketing sets.
-   The backend metadata endpoint already has a useful registry-driven template enumeration and should become the source for authoring options instead of adding a third UI hardcode.
-   current cross-template E2E contracts are typed/asserted around exactly two templates;
-   the OpenAPI generator source, not only generated YAML, contains the existing template and zone enums and must be updated;
-   the current Application create API does not accept a template key, while low-level layout creation can. PLAN must define who creates or materializes the initial global `messenger-app` layout and when, without introducing a new metahub template.

This is a material addition to the Manager brief's implementation inventory.

### 5. Messenger should reuse Dashboard widget/data infrastructure through explicit capabilities, with its own physical zones

The brief's architectural direction is sound: do not create a configuration-specific renderer fork.

Recommended template contract:

-   identity: `messenger-app`;
-   semantic regions: `header`, `main`, `footer`;
-   physical zones: `top`, `center`, `bottom`;
-   no left/right platform navigation regions;
-   no automatic workspace switcher, application switcher, Admin links, or platform footer;
-   a minimal seed with no demo content;
-   Dashboard-derived widgets admitted only through a Messenger-specific allowlist and template-aware allowed-zone map.

The exact widget allowlist must be frozen in PLAN after widget-by-widget mobile/runtime review. Reusing `supportsDashboardWidgets: true` must not mean that every Dashboard widget becomes available automatically. Every admitted public widget also needs a proven read-only public projection: the current public Dashboard DTO deliberately removes mutation targets such as create/row/restore/workflow/reorder actions. A widget without an equivalent read-only projector is excluded from Messenger MVP even if its visual component is otherwise reusable.

The Messenger host should stay inside the established `apps-template-mui` isolation boundary. Shared contracts may move through stable neutral packages, but the implementation must not make `apps-template-mui` depend on `universo-react-template-mui` or legacy feature frontend packages merely to reuse a widget.

### 6. `showInAppList` is discovery metadata only

The current backend list predicate in `applicationsStore.ts` is effectively:

`showAll OR is_public OR membership`.

The new ordinary-list predicate should be:

`showAll OR membership OR (is_public AND show_in_app_list)`.

It must execute in the server SQL before search, `COUNT(*) OVER()`, limit, and offset so pagination and search totals describe the same visible set. Client-only filtering would break that contract.

The existing controller already constrains `showAll` to superusers or callers with global Applications read access. `showInAppList` therefore does not require a new privileged discovery path; the existing privileged override can remain the administrative escape hatch.

The flag must not be added to:

-   public-runtime readiness;
-   alias resolution;
-   direct `/a/<uuid-or-alias>` access;
-   application RLS authorization;
-   public short-link resolution;
-   membership/join authorization;
-   privileged alias administration surfaces.

An unlisted public application remains public to anyone who knows a valid public address. The UI must say this plainly so operators do not mistake catalog hiding for an ACL.

### 7. `showInAppList` requires both canonical schema metadata and a registered forward migration

Application persistence explicitly enumerates columns in `APPLICATION_SELECT`, `APPLICATION_RETURNING`, create, update, and copy paths. Adding only a database column would produce an incomplete contract.

The field should be modeled as:

`show_in_app_list BOOLEAN NOT NULL DEFAULT true`

and round-trip through:

-   the Applications system-app definition for fresh installs;
-   a registered additive forward migration for existing installations;
-   backend records/projections;
-   create and update APIs;
-   detail/list responses;
-   frontend API/types and creation/settings forms;
-   the explicitly selected copy policy.

The default `true` preserves existing catalog behavior for existing rows. There is no evidence that a new index is required for this low-selectivity boolean in the current dataset/contract; PLAN should add an index only if query plans or expected scale justify it.

One subtle existing behavior must stay visible in PLAN: the normal application list does not currently apply the full anonymous public-runtime readiness classifier. `showInAppList` should not duplicate that complex readiness contract unless product intent changes from “application discovery” to “only runnable published applications”.

### 8. Application copy should preserve `showInAppList`, while bot bindings must not be copied

`showInAppList` is ordinary Application discovery metadata, and the source brief explicitly requires it to round-trip through copy. Current copy behavior already inherits ordinary Application settings such as `isPublic`. The consistent contract is therefore to copy `showInAppList` explicitly with the source Application and cover that behavior in store/service tests.

Bot bindings have a different lifecycle. They represent externally distributed messenger identities and immutable launch identifiers, so they must not be copied automatically. Any future explicit “copy bindings” workflow would need new binding UUIDs, new `short_id` values, and a safe initial lifecycle such as `draft`.

There remains a broader pre-existing discovery/readiness concern: a copied public Application can inherit public/discovery metadata before its runtime is fully synchronized or materialized. That concern should be handled through the platform's copy/readiness contract rather than by making `showInAppList` a one-off exception.

### 9. Bot bindings belong in the Applications control plane as first-class application metadata

The proposed relationship belongs beside application metadata rather than inside a runtime workspace or Entity-backed content model.

The contract should support many bindings per Application and should include:

-   UUID v7 row identity;
-   application reference;
-   platform: `max | telegram`;
-   normalized platform-specific bot identity plus human display name;
-   lifecycle: `draft | active | disabled`;
-   stable opaque `short_id`;
-   definition as an Applications system-app business relation/entity so the generated standard lifecycle/version/actor metadata applies consistently, rather than hand-copying an assumed field set into an unrelated custom table;
-   an irreversible release/tombstone marker, separate from reversible `status = disabled`;
-   optional Telegram launch-mode fields only if Direct Mini Apps are included in this MVP.

The table must not store bot tokens, webhook secrets, messenger-user PII, or messenger session credentials. Domain access should use schema-qualified parameterized SQL through the established `DbExecutor` boundary and the existing application owner/admin management authorization.

The current global short-link subsystem is a useful precedent for scoped authorization, stable public identifiers, release lifecycle, public target resolution, and UUID v7 row IDs. It should not be reused as the bot-binding table: user-facing global short-link slugs and messenger binding attribution have different ownership and lifecycle semantics.

A narrow anonymous resolver may translate an active, unreleased `short_id` into minimal binding context for the Application currently being rendered. The management relation itself should not become an anonymous direct-SELECT surface.

Binding lifecycle and external launch readiness are separate. Per the source TZ, `status = active` may mean that the administrator has manually marked the external bot/Mini App setup as configured and enabled. It must not be presented as verification performed by Telegram, MAX, Bot API, or Universo. Management UI should make that operator-attested/manual status clear unless a later phase adds an explicit verification integration.

### 10. `short_id` must be stable attribution/routing context, not an authentication credential

A conservative shared `short_id` format is a server-generated 128-bit cryptographically random value encoded as unpadded base64url, approximately 22 ASCII characters.

This has useful properties:

-   it uses only URL-safe `A-Z a-z 0-9 _ -` characters;
-   it is far below MAX's documented 512-character Mini App payload limit;
-   it is short enough for messenger links and QR use;
-   it is non-PII and contains no application, user, or bot identifier;
-   collision probability is negligible, while a database uniqueness constraint remains authoritative.

`short_id` is deliberately non-secret. Possession must never grant access beyond the public Application contract.

Because launch links can remain distributed indefinitely, a released or deleted binding must never hand its identifier to another binding. Use a global `UNIQUE(short_id)` constraint across the full historical relation, not a partial active-only uniqueness rule. Reversible suspension belongs in `status = disabled`; irreversible retirement belongs in a separate release/tombstone state such as `released_at` / `released_by`, and released rows should not be reactivated.

The Application foreign key should use `ON DELETE RESTRICT`, not `ON DELETE CASCADE`. Otherwise a physical Application deletion could erase the historical reservation and make permanent non-reuse unenforceable. Application soft deletion should release/tombstone its bot bindings in the same locked transaction pattern used for externally published address-like records, and binding creation should confirm/lock the active parent Application to avoid create-vs-delete races. PLAN must still define what a rare future privileged physical purge means for permanent reservation.

This is a deliberate stronger lifecycle rule than many ordinary relation tables in the repository. `deleteApplicationWithSchema()` already shows the useful precedent: child connectors are soft-deleted and global short links are explicitly released before the Application tombstone. Bot-binding release should be incorporated into that same application-delete transaction rather than left to a database cascade.

### 11. The base public Application address and the messenger launch link are separate contracts

The Application's canonical public URL remains the URL configured as the Web App target where the messenger platform requires one. Messenger launch links are operator-facing links that ask Telegram/MAX to open the associated Mini App with `short_id` in the launch context.

For the MVP:

-   MAX: `https://max.ru/<botName>?startapp=<short_id>`;
-   Telegram Main Mini App: `https://t.me/<bot_username>?startapp=<short_id>`.

The binding identifier should be validated against the Application that is already being rendered. It should not create a competing public routing namespace for Applications.

Missing, unknown, disabled, or deleted binding context should therefore degrade to the base public Application experience. It may suppress attribution or show a bounded operator/debug signal where appropriate, but it must not turn into an authentication failure.

### 12. Telegram Main Mini App is the cleaner MVP; Direct Mini App is a separate binding mode

Current Telegram documentation distinguishes:

-   Main Mini App: `https://t.me/<bot_username>?startapp=<start_parameter>`;
-   Direct Mini App: `https://t.me/<bot_username>/<short_name>?startapp=<start_parameter>`.

Direct Mini Apps require a bot-owned app `short_name` and represent a distinct launch configuration. The original product examples and manual-setup flow are Main Mini App shaped.

Recommended MVP decision: support Telegram Main Mini Apps only. If Direct Mini Apps are required now, add an explicit `launchMode` and platform-specific `appShortName` field rather than overloading bot username or generic JSON metadata.

### 13. MAX and Telegram have materially different viewport/safe-area capabilities

Current MAX documentation confirms:

-   a Mini App launch link of `https://max.ru/<botName>?startapp=<payload>`;
-   Mini App payload up to 512 characters;
-   allowed payload characters `A-Z`, `a-z`, `0-9`, `_`, `-`;
-   `window.WebApp.initDataUnsafe.start_param` and `initData`;
-   `window.WebApp.getViewportSize()`;
-   `window.WebApp.BackButton.show/hide/onClick/offClick`.

The current MAX Bridge documentation did not expose a Telegram-like safe-area inset API. The implementation must not invent one.

Current MAX operational prerequisites also matter for rollout and acceptance: partner-platform access is documented for Russian-resident legal entities, individual entrepreneurs, and self-employed users; a Mini App is configured through a MAX chat-bot; and bot/Mini App management becomes available after bot moderation. These are external platform constraints that must be revalidated near rollout. They are not Universo authorization rules, and a saved binding must not claim external ownership/configuration was verified.

Current Telegram documentation confirms:

-   Main and Direct Mini App `startapp` flows;
-   non-empty `startapp` becomes `start_param` and `tgWebAppStartParam`;
-   `viewportHeight` and `viewportStableHeight`, with explicit guidance to use the stable height for bottom-pinned UI;
-   `safeAreaInset` and `contentSafeAreaInset` plus CSS variables;
-   theme parameters and a BackButton;
-   compact/fullscreen launch modes in the current link/API documentation.

The runtime adapter should therefore use progressive enhancement:

-   ordinary browser: normal responsive web layout using CSS safe-area `env()` where available and a `100dvh` fallback;
-   Telegram: consume documented stable viewport and safe-area signals only when the current client exposes them; the safe-area change signals are version/capability dependent and require feature detection;
-   MAX: consume documented viewport size and BackButton where useful, plus ordinary browser/CSS fallbacks.

Bridge adapters should remain platform-specific: Telegram uses `window.Telegram.WebApp`, MAX uses `window.WebApp`, and capability detection belongs inside those adapters rather than relying on user-agent-only platform detection. The application must still render correctly when neither bridge global exists.

### 14. Do not import Telegram's ordinary bot `/start` 64-character rule into Mini App `startapp`

Current primary Telegram Mini App and deep-link documentation confirms how `startapp` is transported, but this research did not find an explicit Mini App `startapp` maximum length/charset equivalent to the familiar Bot API `/start` deep-link rule.

The 1-64 character rule found in Bot API documentation applies to ordinary bot start deep linking and is not sufficient evidence for a Mini App `startapp` contract.

The proposed 22-character base64url `short_id` is conservative without claiming an undocumented Telegram Mini App limit.

### 15. The anonymous read-only boundary should remain the server-enforced security model

The brief explicitly excludes messenger-user sessions and server validation of Telegram/MAX `initData` from this MVP. That is consistent with the current architecture.

Consequences:

-   no bot token is needed by the Application platform in this phase;
-   `initDataUnsafe` must not become trusted authorization data;
-   Messenger MVP must use only the published anonymous read contract and must not attach existing guest mutation transports for sessions, attempts, answers, or progress merely because other public Application routes exist;
-   every Messenger public DTO/widget projector must remove mutation targets server-side; hiding authenticated controls in the UI is not sufficient;
-   a future authenticated messenger phase must introduce platform-specific server validation and identity/session mapping as a separate security design.

### 16. Runtime UX acceptance must extend the existing project baseline

The prior public-runtime and Dashboard research remains applicable:

-   no raw UUIDs, raw JSON, object cells, internal validation names, or hidden-knowledge workflows in normal UI;
-   real EN/RU strings;
-   reuse existing MUI dialogs/list/table/card primitives;
-   canonical `StandardDialog`/specialized dialog patterns for create/edit flows and the established destructive-confirmation pattern for delete/release actions;
-   keyboard-only create/edit/delete operation, correct focus return, and localized validation states;
-   interactive touch targets of at least 44x44 CSS px for Messenger-facing controls;
-   no page-level horizontal overflow;
-   public runtime must not expose authenticated management controls.

For this feature, browser proof should include at least:

-   1920x1080 desktop ordinary browser fallback;
-   768x1024 tablet;
-   390x844 mobile;
-   a narrow-width check around 320px;
-   long bot usernames/launch links;
-   management dialogs at responsive/full-screen breakpoints with focus return and destructive confirmation;
-   top/center/bottom Messenger composition;
-   list/search pagination with hidden apps;
-   direct public UUID/alias access to an unlisted app;
-   both existing templates plus `messenger-app` dispatch;
-   absence of messenger bridge globals;
-   Telegram/MAX bridge adapter unit or browser stubs for the documented capabilities.

Context7 for the repository-pinned MUI 9.2.0 confirms the existing responsive breakpoint and `useMediaQuery`/full-screen Dialog patterns; those should be reused rather than introducing a one-off mobile dialog system.

## Conflicts And Uncertainty

### The source TZ contains a resolved MVP scope conflict about multiple bot bindings

An earlier section defers a multi-bot registry, while the later confirmed requirement and FR-031 require arbitrary numbers of MAX and Telegram bindings per Application. The QA-refined brief resolves this in favor of multiple bindings.

This research agrees with that resolution because it matches the explicit product confirmation and the proposed operator workflow. PLAN should model cardinality as one Application to many bindings from the start.

### Exact Telegram Mini App `startapp` length and charset are not explicitly documented in the primary sources found

Do not copy the ordinary `/start` 64-character rule into this feature. The recommended 128-bit base64url identifier avoids reliance on an assumed limit.

### Exact Telegram and MAX bot-username validation rules still need platform-specific evidence

The product requires format validation and uniqueness, but one shared generic regex would be brittle. PLAN should either source the current official rules for each platform or apply only minimally proven normalization/character constraints and keep platform-specific validation isolated.

Uniqueness should compare canonicalized bot identities, not display strings. The normalization rule must be defined separately per platform.

### MAX currently has no documented Telegram-like safe-area Bridge API

Use MAX's documented viewport API plus browser/CSS safe-area fallbacks. Treat any later MAX safe-area API as a future enhancement unless current official documentation adds one.

### The exact Messenger widget allowlist remains a PLAN decision

The product input names required widget classes, but each concrete widget still needs a mobile/read-only/runtime-data audit. `supportsDashboardWidgets: true` cannot be the allowlist. Each admitted widget must also have a server-side read-only public projector; visual compatibility alone is insufficient.

### The initial global Messenger layout source is not yet defined

The current Application create API does not choose a template, while low-level layout creation accepts a template key and the global template selector is currently disabled/two-template. PLAN must define the creation/materialization path for the first global `messenger-app` layout. This must be solved as an Application layout/runtime concern; the brief explicitly makes creation of a new metahub template a non-goal.

### Binding lifecycle and external messenger readiness are separate

`draft | active | disabled` is an internal Universo lifecycle. Telegram Main Mini App setup is performed externally through BotFather, while MAX Mini App settings depend on an eligible partner account and a moderated bot. `active` may record the administrator's manual assertion that setup is complete, but PLAN should label this as operator-attested/unverified rather than platform-verified ownership/configuration.

### Hidden-app SEO/global-discovery surfaces are not yet proven as active repository surfaces

FR-020 asks for global search/recommendation/sitemap exclusion and optional `X-Robots-Tag: noindex`. The primary application list is confirmed. PLAN should inventory actual global search, sitemap, recommendation, and public indexing surfaces before changing them.

`noindex` can be useful discovery policy, but it must remain separate from authorization.

### Copy should preserve `showInAppList`; the broader public-copy readiness issue remains

Repository consistency and the source requirement support explicit inheritance of `showInAppList` during Application copy. Bot bindings remain excluded from copy. The remaining uncertainty is broader: a copied public Application can inherit public/discovery metadata before its runtime is fully ready. PLAN should address that through the general copy/readiness contract rather than special-casing the catalog flag.

### Future physical purge needs one permanent-reservation rule

Global historical uniqueness, irreversible release/tombstone state, and `ON DELETE RESTRICT` prevent ordinary reuse. If a future privileged purge is allowed to remove historical binding rows, PLAN must state whether a minimal reservation/tombstone survives that purge so permanent `short_id` non-reuse remains enforceable.

### Audit requirements are not backed by one generic Application mutation-audit subsystem

The source input says changes are audited, while current repository evidence shows subsystem-specific audit patterns rather than one generic Application mutation audit contract. Do not invent a new platform-wide audit system for this MVP. PLAN should reuse a proven application-level contract if one is found or explicitly scope audit work separately.

## Project Implications

### Shared types and template adapters

Likely affected:

-   `packages/universo-react-types/src/common/marketingPagePrimitives.ts`
-   `packages/universo-react-types/src/common/applicationTemplates.ts`
-   `packages/universo-react-types/src/common/applicationLayouts.ts`
-   `packages/universo-react-types/src/common/layoutWidgetDefinitions.ts`
-   `packages/universo-react-types/src/common/dashboardWidgetOwnership.ts`
-   `packages/universo-react-types/src/common/publicApplicationRuntime.ts`

PLAN should define one explicit template adapter/dispatch contract covering config schema, physical zones, widget support, seed policy, runtime-data policy, authenticated renderer, and public projector so future templates do not inherit a binary fallback.

### Metahub layout authoring and seed/materialization

The third template affects template validation, conditional seed execution/migration behavior, layout dialogs/details, zone enumeration, widget placement rules, and cross-template tests. Messenger should reuse generic layout lineage rather than introduce a parallel layout storage format. Creating a new metahub template is explicitly out of scope; PLAN must instead define the initial global Application-layout materialization path.

### Applications backend

Likely affected:

-   application layout persistence and effective-layout runtime data;
-   snapshot/sync zone normalization and template-aware data loading;
-   public-runtime controller/projector;
-   `applicationsStore.ts` projections/list/create/update/copy;
-   `systemAppDefinition.ts` and registered forward migration(s);
-   a new bot-binding store/controller/service surface under the Applications package;
-   public binding-context lookup that can validate attribution without becoming authorization.

All new domain SQL must remain schema-qualified and parameterized through `DbExecutor`.

### Applications frontend and Apps Template MUI

Likely affected:

-   Application creation/settings controls for `showInAppList`;
-   hidden-catalog badge on privileged surfaces;
-   dedicated Bots/Connections management UI;
-   template creation/selection UI;
-   authenticated/public/standalone runtime dispatch;
-   a Messenger host shell and platform bridge adapters;
-   localized empty/error/loading/manual-setup states.

Existing MUI primitives should be reused; raw binding UUIDs and raw JSON metadata stay out of normal UI. `apps-template-mui` must keep its established isolation boundary and must not gain dependencies on `universo-react-template-mui` or legacy feature frontends merely to reuse Messenger widgets.

### OpenAPI, tests, and browser acceptance

The template enum and endpoint contracts must be regenerated/updated. Cross-template E2E must become three-template coverage rather than assert exactly two identities.

Tests should cover:

-   exhaustive template parsing and safe unsupported-template failure;
-   Messenger seed/layout/snapshot/sync round trip;
-   allowed and forbidden Messenger widget/zone combinations;
-   public DTO privacy and read-only behavior, including a proven read-only projector for every allowed Messenger widget;
-   list/search/count visibility predicate;
-   direct public access to hidden apps;
-   bot-binding authorization, uniqueness, lifecycle, non-reuse, and no secret fields;
-   Main Telegram/MAX link generation;
-   missing/unknown/disabled `short_id` fallback;
-   responsive browser and bridge-progressive-enhancement behavior.

## Recommended Decision

1. Add `messenger-app` as a real third Application template identity with an explicit config schema, `top/center/bottom` zones, `header/main/footer` semantics, and exhaustive template dispatch. Remove all “non-Marketing means Dashboard” behavior from affected paths.
2. Evolve the template registry toward an explicit adapter contract for config parsing, allowed zones/widgets, seed policy, runtime data, renderer, and public projection rather than adding another set of binary branches.
3. Reuse generic Dashboard widget/data mechanisms through a curated Messenger allowlist. Every admitted public widget must have a proven read-only projector and compatible runtime-data resolver. Do not expose every Dashboard widget automatically and do not inject Dashboard workspace/platform navigation.
4. Reuse existing generic layout/snapshot/sync lineage through `layouts[]`; keep legacy Dashboard-only snapshot compatibility as Dashboard-only compatibility.
5. Add a strict public Messenger runtime DTO/projector and dedicated read-only Messenger host. Unsupported template identities render a bounded localized unsupported/unavailable state and fail closed instead of inheriting Dashboard or Marketing behavior or data.
6. Persist `show_in_app_list BOOLEAN NOT NULL DEFAULT true` through the Applications system-app definition plus a registered forward migration and all explicit application projections/contracts.
7. Enforce ordinary catalog visibility as `showAll OR membership OR (isPublic AND showInAppList)` in the server list query before search/pagination. Keep the flag out of RLS, public readiness, alias/direct routing, join authorization, and public short-link authorization.
8. Copy `showInAppList` explicitly with ordinary Application metadata. Do not copy bot bindings automatically; any future explicit binding-copy workflow must mint new binding UUIDs and new `short_id` values.
9. Model multiple MAX/Telegram bindings as first-class Applications control-plane metadata with owner/admin management, UUID v7 identity, platform-specific normalized bot identity, `draft/active/disabled` lifecycle, an Applications system-app relation/entity contract with generated lifecycle/version/actor metadata, an irreversible release/tombstone state, and no tokens/secrets/PII.
10. Generate each binding's immutable `short_id` from 128 CSPRNG bits encoded as unpadded base64url (~22 characters). Keep it non-secret and enforce one global historical `UNIQUE(short_id)` across live, disabled, released, and soft-deleted bindings.
11. Use `ON DELETE RESTRICT` for the binding-to-Application foreign key and release/tombstone bindings inside the Application soft-delete transaction. Never intentionally reassign or reactivate a released `short_id`; preserve its historical reservation.
12. Support Telegram Main Mini Apps in the MVP. Treat Direct Mini Apps as a separate launch mode requiring an explicit app `short_name`; add it now only if product explicitly requires Direct links in this phase.
13. Keep the canonical public Universo Application URL separate from Telegram/MAX launch links. `short_id` supplies launch attribution/context and never substitutes for Application access control.
14. Missing, unknown, disabled, or deleted binding context must fall back to the base public Application route rather than deny access.
15. Implement messenger bridge behavior as progressive enhancement with separate platform adapters and capability detection: Telegram stable viewport/safe-area APIs where exposed, MAX `getViewportSize`/BackButton where exposed, CSS/browser fallback everywhere, and ordinary browser rendering always functional.
16. Keep the MVP anonymous and server-enforced read-only through the published anonymous runtime contract. Do not attach existing public guest mutation transports. Messenger `initData` validation, user identity mapping, bot secrets, Bot API automation, and write-capable sessions remain a separate future security phase.
17. Extend UI/E2E gates to real EN/RU, canonical MUI dialog/confirmation patterns, no raw IDs/JSON, keyboard/focus, >=44x44 CSS px Messenger touch targets, 1920x1080 / 768x1024 / 390x844 plus ~320px width, and no page-level horizontal overflow.
18. Keep `messenger-app` an Application layout/runtime template only. Do not create a new metahub template for this feature; PLAN must define the initial global Messenger Application-layout creation/materialization path explicitly.
19. Preserve the `apps-template-mui` dependency-isolation contract. Share neutral contracts through stable packages rather than importing legacy/template feature frontends into the runtime package.
20. Treat MAX partner eligibility/moderation and Telegram/MAX Mini App configuration as external operational prerequisites. Binding `active` may be an administrator's manual “configured” assertion, but must not claim external platform verification of setup or ownership.

## Open Questions Before PLAN

1. **Exact Messenger widget allowlist:** which concrete current Dashboard widget keys satisfy mobile, public read-only, runtime-data, and no-platform-navigation constraints?
2. **Telegram Direct Mini Apps:** is Main Mini App intentionally sufficient for the MVP, or must the schema include `launchMode` plus `appShortName` now?
3. **Bot identity validation:** what exact current Telegram and MAX username normalization/validation rules can be supported from primary documentation?
4. **Initial global Messenger layout:** which Application-layer flow creates/materializes the first global `messenger-app` layout, given that Application creation currently does not select a template and a new metahub template is out of scope?
5. **External launch readiness:** how should management UI label the administrator-attested `active` state so “configured manually” cannot be mistaken for platform verification, and is a separate verification integration in scope later?
6. **Unknown/deleted/disabled binding UX:** should runtime silently ignore the attribution miss, expose a localized non-blocking notice, or record only server-side metrics?
7. **Permanent `short_id` reservation:** should a minimal reservation/tombstone survive any future privileged physical Application purge?
8. **Hidden-app discovery surfaces:** which actual global search, recommendation, sitemap, and indexing surfaces exist and should honor `showInAppList`? Should the public runtime emit `X-Robots-Tag: noindex` for unlisted apps?
9. **Audit reuse:** is there an existing generic Application-level audit contract suitable for catalog-setting and bot-binding mutations, or should audit expansion be separately scoped?

These are bounded PLAN decisions. The repository architecture, MVP public/read-only boundary, list predicate, third-template integration requirement, multiple-binding cardinality, Main Telegram/MAX launch shapes, and conservative `short_id` strategy are sufficiently researched to proceed to PLAN once these choices are frozen.

## Sources

### Local

-   Original Messenger Apps stakeholder input (local-only source; requirements summarized and traced in this research)
-   QA-refined Messenger Apps brief (local-only source; implementation decisions traced in this research and the plan)
-   `.agents/skills/research-before-plan/SKILL.md`
-   `.agents/skills/universo-platform-architecture/SKILL.md`
-   `.agents/skills/mui-runtime-ux-patterns/SKILL.md`
-   `.agents/skills/runtime-ux-qa/SKILL.md`
-   `.agents/skills/playwright-best-practices/SKILL.md`
-   `.agents/skills/ontoindex-code-intelligence/SKILL.md`
-   `packages/universo-react-types/src/common/marketingPagePrimitives.ts`
-   `packages/universo-react-types/src/common/applicationTemplates.ts`
-   `packages/universo-react-types/src/common/applicationLayouts.ts`
-   `packages/universo-react-types/src/common/layoutWidgetDefinitions.ts`
-   `packages/universo-react-types/src/common/dashboardWidgetOwnership.ts`
-   `packages/universo-react-types/src/common/publicApplicationRuntime.ts`
-   `packages/universo-react-applications-backend/src/persistence/applicationLayoutStoreSupport.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncLayoutSnapshot.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncLayoutPersistence.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncDataLoader.ts`
-   `packages/universo-react-applications-backend/src/services/effectiveLayoutResolverCore.ts`
-   `packages/universo-react-applications-backend/src/controllers/publicApplicationRuntimeController.ts`
-   `packages/universo-react-applications-backend/src/controllers/applicationsController.ts`
-   `packages/universo-react-applications-backend/src/routes/publicApplicationRuntimeRoutes.ts`
-   `packages/universo-react-applications-backend/src/routes/publicApplicationsRoutes.ts`
-   `packages/universo-react-applications-backend/src/persistence/applicationsStore.ts`
-   `packages/universo-react-applications-backend/src/platform/systemAppDefinition.ts`
-   `packages/universo-react-applications-backend/src/platform/migrations/`
-   `packages/universo-react-applications-backend/src/persistence/globalShortLinksStore.ts`
-   `packages/universo-react-applications-backend/src/controllers/globalShortLinksController.ts`
-   `packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx`
-   `packages/universo-react-metahubs-backend/src/domains/layouts/services/layoutServiceContracts.ts`
-   `packages/universo-react-metahubs-backend/src/domains/metahubs/services/SnapshotRestoreService.ts`
-   `packages/universo-react-metahubs-frontend/src/domains/layouts/ui/LayoutWidgetEditorDialogs.tsx`
-   `packages/universo-react-apps-template-mui/src/api/api.ts`
-   `packages/universo-react-apps-template-mui/src/standalone/DashboardApp.tsx`
-   `.agents/skills/mui-runtime-ux-patterns/references/apps-template-isolation.md`
-   `packages/universo-react-rest-docs/scripts/generate-openapi-source.js`
-   `memory-bank/research/dashboard-complete-entity-backed-widgets-research-2026-10-02.md`
-   `memory-bank/research/consortium-marketing-public-runtime-aliases-research-2026-09-15.md`
-   `memory-bank/research/interpretation-network-public-runtime-advanced-workspace-research-2026-10-22.md`

### External primary documentation

-   <https://dev.max.ru/docs/webapps/introduction>
-   <https://dev.max.ru/docs/webapps/bridge>
-   <https://dev.max.ru/docs/chatbots/bots-create/create>
-   <https://dev.max.ru/docs/chatbots/bots-create/manage/>
-   <https://dev.max.ru/docs/chatbots/bots-coding/prepare/>
-   <https://dev.max.ru/help/deeplinks/>
-   <https://core.telegram.org/bots/webapps>
-   <https://core.telegram.org/api/bots/webapps>
-   <https://core.telegram.org/api/links>
-   <https://core.telegram.org/method/messages.requestMainWebView>
-   <https://core.telegram.org/method/messages.requestAppWebView>
-   <https://mui.com/material-ui/customization/breakpoints/>
-   <https://mui.com/material-ui/react-dialog/>
-   <https://mui.com/material-ui/react-tabs/>

### Context7

-   `/mui/material-ui/v9.2.0`
-   `/websites/core_telegram_bots_webapps`
