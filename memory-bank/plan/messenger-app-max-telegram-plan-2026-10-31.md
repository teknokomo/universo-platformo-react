# Messenger App Template, Catalog Visibility, and MAX/Telegram Bot Bindings — Implementation Plan

**Date:** 2026-10-31

**Status:** Implemented; repository-local verification complete, external Telegram/MAX client acceptance incomplete

**Complexity:** High / cross-cutting

**Mode:** Implementation plan and QA closeout

## Overview

Implement a stable MVP for public read-only applications opened inside MAX and Telegram Mini App webviews by adding a third application layout/runtime template, `messenger-app`, while separating public access from catalog discovery and adding a safe manual registry of messenger bot bindings.

The implementation must be a clean-break extension of the current architecture:

-   no legacy compatibility code;
-   no backfill for old test data;
-   no schema-version or metahub-template-version increment;
-   no new metahub template;
-   no bot tokens or messenger-user credentials stored by this feature;
-   no write-capable public Messenger runtime in the MVP;
-   no silent `dashboard <-> marketing-page` fallback for a third template;
-   all user-facing text is localized EN/RU immediately;
-   all new persisted row IDs use UUID v7;
-   published runtime UI remains isolated in `packages/universo-react-apps-template-mui`.

The source brief, QA-refined research, current code inspection, independent subagent reviews, official Telegram/MAX documentation, and current Context7 guidance were used as planning inputs.

QA on 2026-10-31 also resolved several traceability gaps in the earlier draft:

-   the latest clean-database/no-legacy instruction overrides older brief/research compatibility recommendations;
-   every **Must** requirement remains an acceptance requirement unless this plan explicitly records a superseding product decision;
-   FR-006 widget classes are implementation obligations, not optional allowlist suggestions;
-   mutation audit, canonical fixture coverage, and real Telegram/MAX manual acceptance remain part of the MVP evidence;
-   new UI and cache abstractions are avoided where the repository already has canonical registries, dialogs, query keys, and runtime primitives.

## Planning Inputs

-   Original Messenger Apps stakeholder input (local-only source; requirements are summarized and traced in the research and this plan)
-   QA-refined Messenger Apps brief (local-only source; decisions are traced in the research and this plan)
-   [Research](../research/messenger-app-max-telegram-research-2026-10-31.md)

External references rechecked on 2026-10-31:

-   Telegram Mini Apps: https://core.telegram.org/bots/webapps
-   Telegram bot username rules: https://core.telegram.org/bots/features
-   MAX Mini Apps: https://dev.max.ru/docs/webapps/introduction/
-   MAX Bridge: https://dev.max.ru/docs/webapps/bridge/
-   MAX bot creation/username requirements: https://dev.max.ru/docs/chatbots/bots-create/create

Context7 rechecked against repository-compatible versions:

-   TanStack Query v5.90.3 documentation: stable query-key families and `invalidateQueries` after mutations.
-   MUI v9.2.0 documentation: responsive `Dialog fullScreen` with `useMediaQuery`, accessible form labeling, helper text.
-   Playwright v1.58.2 documentation: viewport control, web-first screenshot assertions, focus assertions, tracing.

Repository catalog versions currently include React 18.3.1, MUI 9.2.0, Vitest ^4.1.6, Playwright ^1.58.2, TanStack Query ^5.62.13, and Zod 3.25.76. New dependencies are not required for this MVP.

## Architecture Decisions to Freeze Before IMPLEMENT

### 1. `messenger-app` is an Application Layout template, not an Application row type

Do **not** add `templateKey` to `applications.obj_applications` or to `POST /applications`.

Current architecture already makes `templateKey` a layout concern. `createApplicationLayout()` accepts it, validates it, and automatically makes the first active layout in a scope the default.

MVP creation flow therefore is:

1. Create the Application using the existing Application flow.
2. Materialize/synchronize the Application schema as today.
3. Open Application Layouts.
4. Create the first global layout with template `messenger-app`.
5. Because it is the first active global layout, existing layout persistence makes it default.
6. Seed the minimal Messenger composition for that layout.

This avoids inventing deferred bootstrap state inside Application settings and keeps layout ownership consistent.

The Application create dialog **does** gain `showInAppList`; the Layout create dialog gains `messenger-app`.

### 2. The third template must remove all binary fallbacks

Any implementation shaped like these examples must be replaced:

```ts
templateKey === 'dashboard' ? dashboardValue : marketingValue
```

```ts
if (templateKey === 'marketing-page') {
    return marketingRuntime
}
return dashboardRuntime
```

Every template-dispatch boundary must become exhaustive and fail closed:

```ts
function assertNever(value: never): never {
    throw new Error(`Unsupported application template: ${String(value)}`)
}

export function renderTemplate(templateKey: ApplicationTemplateKey) {
    switch (templateKey) {
        case 'dashboard':
            return renderDashboard()
        case 'marketing-page':
            return renderMarketingPage()
        case 'messenger-app':
            return renderMessengerApp()
        default:
            return assertNever(templateKey)
    }
}
```

Extend the existing `APPLICATION_TEMPLATE_REGISTRY`, layout-zone metadata, and `layoutWidgetDefinitions` contracts. If a small typed adapter map is needed for config parsing/runtime projection, keep it adjacent to these canonical registries rather than creating a second parallel template registry.

### 3. Messenger zones use template-qualified identity

The product names are `top / center / bottom`, but the codebase contains template-neutral lookup paths. To avoid collisions with Dashboard zone names, the implementation should make `(templateKey, zone)` the authoritative lookup key everywhere.

The canonical metadata already supports this identity through `LayoutZoneDefinition.templateKey`, `LAYOUT_ZONE_DEFINITIONS`, and `getLayoutZoneDefinition(zone, templateKey)`. Extend those existing definitions for Messenger. Do not introduce a separate Messenger zone resolver or globally unique renamed product zones such as `messenger-main`. User-facing names remain `top / center / bottom`.

### 4. MVP Messenger widget support is curated and server-proven

`supportsDashboardWidgets: true` is a capability hint, not permission to use every Dashboard widget.

Each Messenger-allowed widget must pass all four gates:

1. mobile/read-only UX is suitable;
2. placement policy explicitly includes `messenger-app`;
3. public runtime has an anonymous-safe server projector/data resolver;
4. no mutation capability or authenticated-only control leaks through the public DTO.

FR-006 marks the following classes as **Must** for the MVP:

-   overview cards;
-   record list/table;
-   record details;
-   tabs;
-   resource preview;
-   columns container;
-   chart;
-   relation builder, rendered as a read-only relationship viewer in the public Messenger runtime.

For every required class, reuse an existing anonymous-safe projector/data resolver where one exists; otherwise add the smallest server-side read-only projector needed for that class. If any required class cannot meet the public-projector gate safely, the Messenger MVP is **not accepted** until the implementation is fixed or the product requirement is explicitly changed. Do not silently drop a Must widget from the allowlist.

Platform navigation widgets, workspace switchers, admin controls, authoring controls, and mutation widgets are explicitly excluded.

Authenticated member reads and anonymous public reads are separate runtime contracts. An authenticated Application member must receive source-bound widget data through the ordinary request-scoped runtime resolver with that member's identity and read permissions; membership does not grant editing rights. Anonymous requests continue through the dedicated allowlisted public projector. Catalog visibility is discovery policy and must not determine either runtime's authorization. Test both paths with the same source-bound Messenger layout so a public projector cannot mask a broken authenticated path.

### 5. Telegram MVP supports Main Mini Apps only

Canonical Telegram launch link:

```text
https://t.me/<bot_username>?startapp=<short_id>
```

Direct Mini Apps (`/<app_short_name>?startapp=`) are a later extension. Do not add `appShortName` or a launch-mode abstraction to the MVP schema.

### 6. Bot bindings are first-class Applications control-plane data

Use a dedicated relation such as:

```text
applications.rel_application_bot_bindings
```

Do not store bindings in Application `settings`, runtime workspace content, layout JSON, or Entity records.

Recommended logical fields:

-   `id uuid` — UUID v7 primary key;
-   `application_id uuid`;
-   `platform text` — `max | telegram`;
-   `bot_username text` — normalized canonical username;
-   `display_name text null`;
-   `status text` — `draft | active | disabled`;
-   `short_id text` — immutable opaque launch-attribution ID;
-   `released_at timestamptz null`;
-   `released_by uuid null`;
-   standard project lifecycle/version/actor columns required by the Applications system-app pattern.

Define the binding as an Applications system-app business relation/entity in `src/platform/systemAppDefinition.ts` so the generated lifecycle/version/actor contract is authoritative. Do not hand-maintain a divergent ad-hoc metadata shape.

No token, webhook secret, `initData`, messenger-user PII, access credential, or session credential belongs in this relation.

### 7. Binding deletion is irreversible release, not physical deletion

`disabled` is reversible.

Release/removal is irreversible:

-   set lifecycle/tombstone metadata;
-   keep `short_id` stored permanently;
-   never reuse a released `short_id`;
-   released bindings cannot return to active status.

Use a global historical `UNIQUE(short_id)`, not an active-only partial unique index.

Enforce the canonical bot identity as `UNIQUE(application_id, platform, bot_username)` across retained rows. `disabled` is the reversible state; irreversible release retires that binding identity for that Application. This directly satisfies FR-031 and avoids duplicate historical bindings that differ only by tombstone state.

The Application FK should use `ON DELETE RESTRICT`; Application deletion must release active bindings in the same Application deletion transaction before the Application tombstone.

No ordinary product path may physically purge released binding rows. If a future privileged physical-purge tool is introduced, it must preserve the global `short_id` reservation (for example through a retained tombstone/reservation record) and requires a separate design review.

### 8. `short_id` is attribution, never authorization

Generate 128 random bits on the server and encode with unpadded base64url (22 characters).

Illustrative implementation:

```ts
import { randomBytes } from 'node:crypto'

export const createMessengerBindingShortId = (): string => randomBytes(16).toString('base64url')
```

The database uniqueness constraint is authoritative. Creation should retry a very small bounded number of times only on the specific unique-key conflict.

Never generate `short_id` optimistically in the browser.

Unknown, disabled, or released `short_id` removes attribution only. It must not deny access to an otherwise public Application.

### 9. Visibility semantics are independent of public access

Truth table:

| Caller/application state                 | Visible in normal catalog | Direct public runtime               |
| ---------------------------------------- | ------------------------- | ----------------------------------- |
| Member, any `isPublic` / `showInAppList` | Yes                       | According to existing authorization |
| Non-member, public + listed              | Yes                       | Yes                                 |
| Non-member, public + unlisted            | No                        | Yes                                 |
| Non-member, closed + listed flag         | No                        | No                                  |
| Privileged existing `showAll` caller     | Yes                       | According to existing authorization |

Canonical normal list predicate:

```sql
WHERE
    $showAll = true
    OR membership.user_id IS NOT NULL
    OR (a.is_public = true AND a.show_in_app_list = true)
```

The exact SQL should reuse the current parameterization and membership joins; the predicate must be applied before `COUNT(*) OVER()`, search pagination, limit, and offset.

`showInAppList` must never be added to:

-   public runtime readiness;
-   alias resolution;
-   join authorization;
-   RLS authorization;
-   public short-link/address resolution.

### 10. Clean database policy supersedes the older forward-migration recommendation

The QA-refined brief still mentions an additive forward migration for old installations. The latest user instruction explicitly removes that requirement.

For this work:

-   update the canonical Applications system-app definition;
-   update the canonical fresh-schema DDL/baseline migration source;
-   register any schema-definition components required for a **fresh** database to build correctly;
-   do **not** add a compatibility/backfill migration solely for existing installations;
-   do **not** increment the platform schema version;
-   do **not** increment a metahub template version.

Tests start from a newly created local database.

The clean-break rule applies specifically to legacy compatibility projections/shims. It does **not** mean deleting current concepts that merely share the name `layoutConfig`; the generic entity capability and active renderer configuration remain valid where they are part of the current architecture.

## Affected Areas

### Shared types and template metadata

-   `packages/universo-react-types/src/common/marketingPagePrimitives.ts`
-   `packages/universo-react-types/src/common/applicationTemplates.ts`
-   `packages/universo-react-types/src/common/applicationLayouts.ts`
-   `packages/universo-react-types/src/common/layoutWidgetDefinitions.ts`
-   `packages/universo-react-types/src/common/dashboardWidgetOwnership.ts`
-   `packages/universo-react-types/src/common/dashboardWidgetPolicyHelpers.ts`
-   `packages/universo-react-types/src/common/publicApplicationRuntime.ts`
-   associated tests and package README

### Applications backend / control plane

-   `packages/universo-react-applications-backend/src/platform/systemAppDefinition.ts`
-   canonical Applications baseline/fresh-schema SQL source
-   `packages/universo-react-applications-backend/src/persistence/applicationsStore.ts`
-   new focused bot-binding store/service modules
-   `packages/universo-react-applications-backend/src/controllers/applicationsController.ts`
-   application routes for binding CRUD
-   `packages/universo-react-applications-backend/src/persistence/applicationLayoutStoreSupport.ts`
-   `packages/universo-react-applications-backend/src/persistence/applicationLayoutsStore.ts`
-   `packages/universo-react-applications-backend/src/persistence/applicationLayoutSyncStore.ts`
-   `packages/universo-react-applications-backend/src/services/effectiveLayoutResolverCore.ts`
-   `packages/universo-react-applications-backend/src/services/effectiveLayoutProjection.ts`
-   `packages/universo-react-applications-backend/src/controllers/publicApplicationRuntimeController.ts`
-   new narrow public Messenger projector/resolver
-   sync/materialization/snapshot paths listed below

### Metahub layout authoring/snapshot paths

-   `packages/universo-react-metahubs-backend/src/domains/layouts/services/layoutServiceContracts.ts`
-   `packages/universo-react-metahubs-backend/src/domains/layouts/services/layoutCrudService.ts`
-   `packages/universo-react-metahubs-backend/src/domains/layouts/services/layoutServiceBase.ts`
-   `packages/universo-react-metahubs-backend/src/domains/layouts/services/copyMetahubLayoutPreparation.ts`
-   `packages/universo-react-metahubs-backend/src/domains/shared/snapshotLayouts.ts`
-   `packages/universo-react-metahubs-backend/src/domains/metahubs/services/SnapshotRestoreService.ts`
-   matching frontend layout authoring files in `packages/universo-react-metahubs-frontend`

### Application sync/materialization

-   `packages/universo-react-applications-backend/src/routes/sync/syncLayoutSnapshot.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncLayoutPersistence.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncLayoutMaterialization.ts`
-   `packages/universo-react-applications-backend/src/routes/sync/syncDataLoader.ts`
-   related snapshot validation/hash tests

### Applications frontend

-   `packages/universo-react-applications-frontend/src/api/applications.ts`
-   `packages/universo-react-applications-frontend/src/api/queryKeys.ts`
-   `packages/universo-react-applications-frontend/src/types.ts`
-   `packages/universo-react-applications-frontend/src/pages/ApplicationList.tsx`
-   `packages/universo-react-applications-frontend/src/pages/ApplicationSettings.tsx`
-   `packages/universo-react-applications-frontend/src/pages/application-settings/SettingsPanels.tsx`
-   Application layout authoring controller/dialog/support files
-   `packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx`
-   EN/RU package-local i18n resources

### Published runtime

-   `packages/universo-react-apps-template-mui/src/public-runtime/`
-   `packages/universo-react-apps-template-mui/src/standalone/DashboardApp.tsx`
-   new Messenger runtime/bridge adapter modules
-   package-boundary tests
-   package README

### Shared i18n

-   `packages/universo-react-i18n` for truly shared template/zone labels only
-   feature-specific strings remain with their owning package
-   `tools/check-i18n-coverage.mjs`

### API documentation

-   `packages/universo-react-rest-docs/scripts/generate-openapi-source.js`
-   generated OpenAPI outputs

Do not hand-edit generated OpenAPI without updating the generator/source.

### E2E and docs

-   `tools/testing/e2e/specs/flows/cross-template-standalone-runtime.spec.ts`
-   `tools/testing/e2e/specs/flows/cross-template-scoped-layout.spec.ts`
-   `tools/testing/e2e/specs/flows/cross-template-runtime.spec.ts`
-   new Messenger focused flow(s)
-   `tools/testing/e2e/support/browser/runtimeUx.ts`
-   reproducible docs screenshot generator based on existing generator/manifest/provenance patterns
-   `docs/en/SUMMARY.md`
-   `docs/ru/SUMMARY.md`
-   new bilingual Messenger template guide
-   existing Applications/public-runtime docs
-   relevant package READMEs

## UI Contract

### Application creation / settings

Controls:

-   existing public/closed access control;
-   `Show in application list` checkbox/switch;
-   when `isPublic=false`, keep the stored preference but disable or hide the discovery control with localized helper text.

Display:

-   privileged lists show a localized `Hidden from catalog` badge when `showInAppList=false`;
-   ordinary non-members never see the hidden Application in catalog list/search results.

Hidden/system-owned:

-   UUIDs;
-   internal schema names;
-   `short_id` generation controls;
-   raw JSON.

Validation:

-   localized frontend hints plus authoritative server validation;
-   no raw Zod or SQL error text shown to users.

### Bot bindings surface

Use existing MUI settings/list/dialog primitives.

List columns/cards:

-   platform;
-   bot username;
-   optional display name;
-   operator-declared status;
-   created/updated date;
-   canonical public Web App URL;
-   generated messenger launch link;
-   actions.

Actions:

-   add;
-   edit display name / status where permitted;
-   copy Web App URL;
-   copy launch link;
-   disable / re-enable;
-   irreversible release/remove with canonical destructive-confirmation pattern.

Do not show row UUID or internal Application UUID as the primary interaction target.

Responsive:

-   normal dialog on desktop;
-   reuse `StandardDialog` and its shared `useDialogPresentation` behavior on narrow screens. If QA proves that true MUI `fullScreen` presentation is required, add that capability once to the shared `StandardDialog`/dialog-presentation layer and reuse it; do not bypass the shared dialog with a Messenger-only raw `Dialog`;
-   long bot names and URLs wrap or use a dedicated copyable field without document-level overflow;
-   interactive targets should be at least 44x44 CSS px in Messenger-facing UI.

### Messenger public runtime

Structure:

-   top: app title/logo and optional language control;
-   center: content;
-   bottom: optional read-only navigation/actions;
-   no platform sidebar, workspace switcher, app switcher, admin links, or platform footer.

States:

-   loading;
-   empty;
-   unavailable/unsupported widget;
-   bounded error;
-   normal read-only content.

Localization:

-   EN/RU parity from day one;
-   bridge-unavailable and public-runtime error states localized.

Responsive acceptance:

-   1920x1080 ordinary browser;
-   768x1024 tablet;
-   390x844 mobile;
-   ~320px narrow mobile;
-   `100dvh` browser fallback;
-   CSS safe-area `env()` fallback;
-   Telegram documented viewport/safe-area capability enhancement;
-   MAX documented viewport capability enhancement;
-   no page-level horizontal overflow.

## Plan Steps

## QA Requirements Traceability

The implementation phases below cover the source requirements as follows:

-   **FR-001…FR-009 (Messenger template Must):** Phases 1-3 and 9 implement the third template, registry/schema entry, `supportsDashboardWidgets: true`, semantic/physical zones, curated Must widgets, localized authoring labels, seed composition, and shell-free runtime. Phases 13-15 provide unit, integration, browser, and screenshot evidence.
-   **FR-013…FR-019 (catalog visibility Must):** Phases 4-5 and 10 implement persisted `showInAppList`, create/settings UX, member/privileged visibility, direct-link independence, and the hidden-catalog badge. Phases 13-15 cover truth-table, concurrency, API, and E2E behavior.
-   **FR-023…FR-032 (bot-binding Must):** Phases 6-8 and 10 implement multiple MAX/Telegram bindings, platform-specific validation, canonical/public links, copyable instructions, lifecycle/status, immutable `short_id`, uniqueness, no-secret policy, and owner/admin management. Phases 13-15A cover persistence, security, concurrency, browser UX, and real-messenger acceptance.
-   **FR-035…FR-037 (public runtime Must):** Phases 8-9 and 11 implement anonymous direct/bot access, server-enforced read-only projection, EN/RU loading/empty/error states, and removal of platform-management navigation from the Messenger runtime. Phases 13-15A prove those boundaries.
-   **Should requirements:** FR-010 is covered by responsive/safe-area/overflow gates; FR-011 inherits MUI light/dark theme while messenger `themeParams` stays future work; FR-020 is handled only on discovery/indexing surfaces proven to exist; FR-021 preserves the stored visibility preference across public/closed transitions; FR-038 uses an existing non-PII telemetry sink when available or is explicitly recorded as deferred Should scope.
-   **Could requirements:** FR-012 is included as optional bridge Back/close progressive enhancement; FR-022 bulk catalog-visibility management is deferred; FR-033 automatic Bot API setup is deferred; FR-034 QR/test-open convenience is deferred; FR-039 server `initData` validation and messenger identity/session mapping are deferred.

### Implementation reconciliation (2026-10-31)

-   The default layout uses the shared header at the top and a localized Overview tab in the center, with the existing generated `menuWidget` nested in that tab and an empty bottom region. This supplies FR-008's entity overview through safe navigation: only published Pages and Objects explicitly marked for primary navigation are listed; workspace/admin destinations, raw identifiers, records, demo data, and implicit source bindings are excluded. The same canonical seed is used by metahub defaults and by the first global Application layout transaction. Generic `overviewCards` and `detailsTable` sources require real bindings under the existing placement policy, and a new Metahub has no domain source to bind. Record-backed widgets become available after their sources are configured; the seed does not fabricate records or invalid bindings.
-   FR-008's “entity list/overview” is implemented as a list of navigable published entities in the default Overview. It does not mean a list of entity records: record rows require an explicit source and access policy. This preserves the requested useful first screen while keeping fresh applications free of synthetic content and workspace leakage.
-   FR-038 is explicitly deferred as a **Should** requirement. A codebase search found no product telemetry sink suitable for a non-PII launch-source event. The runtime reads only the opaque `start_param` hint and can resolve it against an active binding for the Application already being rendered; the hint never authorizes access. The runtime does not trust `initDataUnsafe`, read messenger identity, or persist source metrics.

### Implementation reconciliation update (2026-11-01)

-   The seeded generated menu is an existing runtime primitive, restricted to the Messenger Overview placement and projected through the anonymous-safe Messenger allowlist. Its public DTO contains display labels and semantic codenames only; it carries no links, workspace routes, physical widget IDs, or record data. The menu renderer uses the full generated list in Messenger while preserving the existing Dashboard behavior.
-   PostgreSQL role coverage now also exercises each inactive membership marker (`_upl_archived`, `_upl_deleted`, `_app_archived`, `_app_deleted`) for both owner and admin rows. Each archived/deleted membership must lose binding and audit reads, updates, and inserts under `authenticated` RLS.

### FR-001…FR-039 implementation traceability (2026-11-01)

| FR     | Disposition                      | Implementation and evidence                                                                                                                                                                                                                                                       |
| ------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-001 | PASS                             | `packages/universo-react-types/src/common/marketingPagePrimitives.ts`, `applicationTemplates.ts`; `messengerAppLayout.test.ts`.                                                                                                                                                   |
| FR-002 | PASS                             | Canonical registry sets `supportsDashboardWidgets`; `dashboardWidgetRegistry.test.ts`.                                                                                                                                                                                            |
| FR-003 | PASS                             | `messengerAppPrimitives.ts`, template-aware zone registry; `applicationLayouts.test.ts`, fixture contract.                                                                                                                                                                        |
| FR-004 | PASS                             | `PublicMessengerRuntime.tsx` and `MessengerRuntimeShell.tsx`; public runtime component and Playwright tests.                                                                                                                                                                      |
| FR-005 | PASS                             | `layoutPlacementSupport.ts`, `messengerAppLayoutSeed.test.ts`; canonical fixture contract.                                                                                                                                                                                        |
| FR-006 | PASS                             | Curated template/widget registry and allowlisted public DTO in `publicMessengerRuntime.ts`; type, projector, fixture, and runtime tests.                                                                                                                                          |
| FR-007 | PASS                             | Shared EN/RU template labels and layout creation/filter metadata; Applications and Metahubs layout tests.                                                                                                                                                                         |
| FR-008 | PASS                             | Generated entity navigation is nested in Overview; `messengerAppLayoutSeed.test.ts`, generated fixture contract, public runtime test. No demo records or implicit data bindings are seeded.                                                                                       |
| FR-009 | PASS (QA remediation 2026-11-01) | `effectiveLayoutResolverCore.ts` uses the authenticated request-scoped runtime resolver for Messenger members; backend regression and member Playwright flow assert source-backed data and no missing-source state. Anonymous reads remain on the separate allowlisted projector. |
| FR-010 | PASS                             | Responsive Messenger shell and bounded mobile layouts; 320/390/768/1920 Playwright assertions and inspected browser screenshots.                                                                                                                                                  |
| FR-011 | PASS                             | Messenger inherits the existing MUI theme; runtime component and browser coverage exercise theme behavior. Messenger-provided `themeParams` remains deferred.                                                                                                                     |
| FR-012 | PASS                             | Optional Back/close bridge capability in `MessengerRuntimeShell.tsx`; bridge adapter and shell tests.                                                                                                                                                                             |
| FR-013 | PASS                             | Canonical fresh Applications definition and `show_in_app_list` persistence; migration and application visibility tests.                                                                                                                                                           |
| FR-014 | PASS                             | Create/settings checkbox in `ApplicationActions.tsx`; `CatalogVisibilitySetting.test.tsx` and management browser flow.                                                                                                                                                            |
| FR-015 | PASS                             | Control is disabled with localized explanation for closed applications; frontend test coverage.                                                                                                                                                                                   |
| FR-016 | PASS                             | `listApplications()` filters non-members before totals/pagination; `applicationsShowInAppList.integration.test.ts` and application-list tests.                                                                                                                                    |
| FR-017 | PASS                             | Membership and authorized `showAll` visibility; PostgreSQL integration truth table and management browser flow.                                                                                                                                                                   |
| FR-018 | PASS                             | Direct public Application and alias routes are independent of discovery; alias/runtime integration and public browser flow.                                                                                                                                                       |
| FR-019 | PASS                             | Hidden catalog badge in `ApplicationList.tsx`; ApplicationList test and management browser flow.                                                                                                                                                                                  |
| FR-020 | COVERED WHERE APPLICABLE         | `showInAppList` is enforced by the existing public Application catalog query. Repository search found no separate global application search, recommendation, sitemap, or centralized `X-Robots-Tag` surface to change; no new indexing subsystem was added.                       |
| FR-021 | PASS                             | `isPublic` and `showInAppList` mutations are independent; persistence tests verify stored preference survives access-mode transitions.                                                                                                                                            |
| FR-022 | DEFERRED (COULD)                 | Bulk catalog visibility management is listed in Explicitly Deferred; no bulk UI/API is required for this MVP.                                                                                                                                                                     |
| FR-023 | PASS                             | Existing Application settings surface exposes Messenger bindings to owner/admin roles; component and management browser tests.                                                                                                                                                    |
| FR-024 | PASS                             | `MessengerBindingFormDialog.tsx`, shared validators, and strict backend schema; frontend/backend validation suites.                                                                                                                                                               |
| FR-025 | PASS                             | Canonical public alias and platform-specific launch URL generation in `messengerBindingsPanelSupport.ts`; management Playwright verifies exact URL shapes.                                                                                                                        |
| FR-026 | PASS (QA remediation 2026-11-01) | Database-owned create/release functions generate UUID v7 IDs and CSPRNG short IDs; authenticated direct writes and audit insertion are revoked. PostgreSQL access tests cover direct-write denial and lifecycle invariants.                                                       |
| FR-027 | PASS                             | Copyable links and localized setup instructions in the binding panel; management browser flow.                                                                                                                                                                                    |
| FR-028 | PASS                             | Binding card shows platform, username, status, link, date, and permitted actions; component and Playwright coverage.                                                                                                                                                              |
| FR-029 | PASS (QA remediation 2026-11-01) | A single database-owned release function performs the complete tombstone, version, actor, and audit transition; direct authenticated UPDATE is revoked and PostgreSQL tests reject partial/repeated release and post-release mutation.                                            |
| FR-030 | PASS                             | No bot-token column, DTO, or client input/output; migration contract and strict request/response tests.                                                                                                                                                                           |
| FR-031 | PASS                             | Multiple bindings per Application with historical canonical-identity uniqueness; PostgreSQL uniqueness/concurrency integration tests.                                                                                                                                             |
| FR-032 | PASS                             | Separate MAX/Telegram username canonicalization and validation; shared validator and backend identity tests.                                                                                                                                                                      |
| FR-033 | DEFERRED (COULD)                 | External Bot API setup is explicitly deferred; the product never stores a bot token.                                                                                                                                                                                              |
| FR-034 | DEFERRED (COULD)                 | QR/test-open convenience is explicitly deferred; generated links remain copyable.                                                                                                                                                                                                 |
| FR-035 | PASS                             | Anonymous direct and bot-attribution runtime paths; public runtime/PostgreSQL tests and Playwright. Real clients remain an external acceptance gate.                                                                                                                              |
| FR-036 | PASS                             | Server-side public projector is read-only; DTO, route-denial, component, and anonymous Playwright tests.                                                                                                                                                                          |
| FR-037 | PASS                             | Loading, empty, error, and validation text is localized in EN/RU; locale coverage and browser assertions.                                                                                                                                                                         |
| FR-038 | DEFERRED (SHOULD)                | No suitable existing non-PII telemetry sink was found. Launch hints remain non-authoritative and no messenger identity or raw `initData` is logged or persisted.                                                                                                                  |
| FR-039 | DEFERRED (COULD)                 | Server-side `initData` validation and messenger identity/session mapping remain explicitly deferred; MVP does not trust bridge identity for authorization.                                                                                                                        |

The 2026-11-01 QA revalidation initially reproduced a raw-SQL placeholder issue during fresh migration and an audit-shape failure during browser binding creation. The JSONB key checks now use `jsonb_exists`, and every bot-binding audit write explicitly stores `NULL` in catalog-only fields. The final minimal-Supabase gate is the acceptance evidence for FR-009, FR-026, FR-029, and their phases. FR-020 is implemented for the existing catalog surface; no additional indexing surface was found. FR-022, FR-033, FR-034, FR-038, and FR-039 remain deferred at their stated Should/Could levels. Phase 15A real Telegram/MAX client acceptance remains INCOMPLETE until actual clients are exercised; bridge stubs are not counted as that acceptance.

### Phase 0 — Freeze clean-break invariants and guard the worktree

-   [x] Preserve unrelated pre-existing dirty changes; never reset or mass-format unrelated files.
-   [x] Record current root version, schema version, and metahub template versions before implementation.
-   [x] Confirm the fresh-database contract and explicitly reject compatibility/backfill migration work for this feature.
-   [x] Build and keep a traceability checklist for FR-001…FR-039, mapping every Must requirement to implementation phase, automated test, and acceptance evidence. A Must may only disappear through an explicit superseding product decision recorded in this plan.
-   [x] Keep all dependency versions in `pnpm-workspace.yaml`; do not add package-local version drift.
-   [x] During implementation, use OntoIndex impact before editing existing functions/classes/methods and `gn_verify_diff` before final closeout where available.

Acceptance:

-   no version bump;
-   no legacy adapter/backfill;
-   no unrelated checkout cleanup.

### Phase 1 — Make application-template dispatch genuinely three-way

-   [x] Add `messenger-app` to the shared template-key schema/registry.
-   [x] Set the canonical Messenger registry entry to `supportsDashboardWidgets: true` while enforcing the narrower Messenger allowlist through `supportedTemplates` / `allowedZonesByTemplate` and public-projector safety.
-   [x] Add explicit Messenger template config schema and parser.
-   [x] Extend the existing `APPLICATION_TEMPLATE_REGISTRY`, layout-zone metadata, and `layoutWidgetDefinitions`; do not create a parallel template/widget registry for Messenger.
-   [x] Replace binary fallback logic in shared layout parsing with exhaustive adapter dispatch.
-   [x] Extend widget ownership/policy metadata to understand `messenger-app`.
-   [x] Make template+zone metadata lookup explicit so `top/center/bottom` cannot collide with Dashboard semantics.
-   [x] QA remediation: replace authenticated/public frontend template fallbacks with explicit exhaustive dispatch for `dashboard`, `marketing-page`, and `messenger-app`; unknown templates fail closed. Runtime and parser/controller tests cover supported and invalid values.
-   [x] QA remediation: prove unknown template values fail closed across both authenticated and public runtime entry points.

Primary regression targets:

-   shared type parsing;
-   layout config encode/decode;
-   widget placement;
-   template labels;
-   unsupported-template behavior.

### Phase 2 — Define Messenger zones, seed composition, and curated widgets

-   [x] Register semantic regions `header/main/footer` mapped to physical `top/center/bottom`.
-   [x] Define a minimal renderer config with no demo-only data.
-   [x] Seed the first Messenger layout with:
    -   top: title/header shell;
    -   center: the localized `detailsTabs` Overview shell containing the existing generated entity-navigation menu;
    -   bottom: empty optional action region.
-   The generated Overview menu lists only published Pages and Objects explicitly marked for primary navigation. It is not a record table and must not add workspace/admin destinations, raw IDs, fake rows, or implicit source bindings.
-   Do not seed `overviewCards` or `detailsTable` placements without source bindings. The generic widget policy requires those bindings, and a new Metahub has no domain source to bind. Do not invent a demo source or synthetic records to populate the first screen.
-   [x] Audit each TZ-required widget class against anonymous public projectors.
-   [x] Deliver all FR-006 Must classes: overview cards, record list/table, record details, tabs, resource preview, read-only relation viewer, columns container, and chart. Reuse an existing anonymous-safe projector where possible; otherwise add the smallest bounded read-only projector needed for that class.
-   [x] Add only projector-proven widgets to `supportedTemplates: ['messenger-app']`; if any required FR-006 class cannot be made safe, treat the MVP as blocked rather than silently dropping the requirement.
-   [x] Ensure forbidden Dashboard/platform widgets fail placement validation for Messenger.

Do not create a separate metahub template.

### Phase 3 — Repair authoring, copy, snapshot, sync, and materialization paths

-   [x] Add Messenger to Application and Metahub layout creation/filter metadata.
-   [x] Keep `ApplicationLayoutCreate.templateKey` as the source of truth.
-   [x] Refactor Metahub creation/placement validators that currently search only Dashboard/Marketing.
-   [x] Refactor `prepareRendererConfig()` and snapshot restore branches to use template adapters, never “non-Dashboard means Marketing”.
-   [x] Make sync snapshot normalization template-aware.
-   [x] Remove the obsolete single-snapshot `snapshot.layoutConfig` compatibility projection from the touched snapshot/export/import/hash/sync path where it exists only for backward compatibility. The fresh-database product path must use canonical `layouts[]` / `widgets[]` for Dashboard, Marketing Page, and Messenger alike.
-   [x] Do **not** remove the current generic `layoutConfig` entity capability or active renderer configuration merely because it shares the same name; only eliminate the legacy duplicate snapshot compatibility surface after tracing its callers/tests.
-   [x] Extend application layout predicate/storage guards to accept Messenger explicitly.
-   [x] Preserve Messenger through copy, hash, import/export, restore, publication, sync, and materialization.
-   [x] Ensure workspace-switcher/system-navigation seeding remains Dashboard-only.
-   [x] Reuse the existing shared `layoutWidgetMetadataResponseSchema` / template metadata envelope. Bring the Applications layout-metadata endpoint/frontend parser up to that existing contract (including template/zone metadata) instead of creating a Messenger- or Applications-specific metadata DTO.
-   [x] Remove/avoid frontend hardcoded template-zone mirrors where the same information can come from the canonical shared metadata; do not add a third manually maintained `LAYOUT_ZONES_BY_TEMPLATE` branch for Messenger.
-   [x] QA remediation: make nested `parentInstanceKey` / `slotKey` authoring work for Messenger. Existing Metahub placement controls support create/edit/reorder/save round-trips and are covered by focused authoring tests.

Mandatory round-trip:

```text
create messenger layout
-> add allowed widgets
-> copy
-> snapshot/export
-> restore/import
-> sync/materialize
-> effective resolve
-> authenticated runtime
-> standalone runtime
-> public runtime
```

### Phase 4 — Add `showInAppList` to the canonical fresh schema

-   [x] Add `show_in_app_list boolean NOT NULL DEFAULT true` to the Applications system-app definition and canonical fresh-schema DDL.
-   [x] Add it to Application persistence records and explicit SELECT/RETURNING lists.
-   [x] Add it to create, detail, list, update, and copy contracts.
-   [x] Default to `true` when omitted.
-   [x] Copy preserves the source Application's stored value unless explicitly changed by the supported copy API.
-   [x] Do not couple it to `isPublic` mutation; closing/reopening an Application preserves the stored discovery preference.
-   [x] Reuse the existing Application `_upl_version` / `expectedVersion` optimistic-concurrency contract for edits that change `showInAppList`; stale writes must fail as a version conflict rather than silently overwrite a newer setting.
-   [x] Record every successful `showInAppList` change in the authoritative Application audit mechanism if one exists. If no reusable generic Application mutation-audit contract exists, add a narrow feature-scoped immutable audit record for this setting only; do not introduce a platform-wide audit subsystem.
-   [x] Do not add a low-selectivity boolean index unless an actual EXPLAIN/query-scale check justifies it.

Example safe persistence shape:

```sql
INSERT INTO applications.obj_applications (
    id,
    name,
    description,
    is_public,
    show_in_app_list,
    workspaces_enabled,
    schema_name,
    _upl_created_by,
    _upl_updated_by
)
VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8, $8)
RETURNING ...;
```

### Phase 5 — Correct catalog filtering at the server boundary

-   [x] Change `listApplications()` so membership and existing privileged `showAll` remain visible.
-   [x] For non-members, public Applications appear only when `show_in_app_list=true`.
-   [x] Apply the predicate before search totals, pagination, `LIMIT`, and `OFFSET`.
-   [x] Keep `canJoin` and public runtime authorization dependent on `isPublic`, not discovery.
-   [x] Inventory actual global search/recommendation/sitemap surfaces before changing any of them.
-   [x] Implement FR-020 only for surfaces that really exist.
-   [x] If public indexing headers are already centrally controlled, add a narrow `noindex` policy for unlisted public Apps; do not create a new SEO subsystem for the MVP.

### Phase 6 — Implement bot-binding persistence and lifecycle

-   [x] Add the bot-binding relation to the canonical Applications schema path for fresh databases and declare it in `applicationsSystemAppDefinition` as first-class Applications business metadata so standard lifecycle/version/actor columns are generated consistently.
-   [x] QA remediation: enforce UUID v7 for binding and control-audit IDs at the database boundary; direct authenticated INSERT is revoked and negative PostgreSQL coverage verifies the invariant.
-   [x] Use a CHECK/validated domain contract for platform and status.
-   [x] Add two intentionally different uniqueness contracts:
    -   a historical `UNIQUE(application_id, platform, bot_username)` on the normalized canonical identity across retained rows, satisfying FR-031. Use reversible `disabled` when an operator may later reconnect; irreversible release retires that binding identity for the Application;
    -   a global historical `UNIQUE(short_id)` across released/tombstoned rows as well, so an externally distributed launch identifier can never be reassigned.
-   [x] Normalize username before duplicate checks.
-   [x] Telegram validation: store without leading `@`; accept 5-32 Latin letters/digits/underscore case-insensitively. Ordinary BotFather-created usernames end in `bot`, but Telegram also documents collectible bot usernames without that suffix, so treat a missing suffix as a localized warning/attestation rather than rejecting an otherwise valid existing bot.
-   [x] MAX validation: isolate current MAX rules in a platform adapter; current official docs specify no `@`, 11-60 chars, lowercase first character, Latin letters/digits/underscore, and `bot`/`_bot` ending. Keep this validator independent because MAX policy may evolve.
-   [x] Store the canonical username and optional display name separately.
-   [x] QA remediation: make `short_id` creation exclusively server/database-owned with CSPRNG generation; direct authenticated table INSERT is revoked and covered by database tests.
-   [x] Make `short_id` immutable after create.
-   [x] QA remediation: make the first release transition atomically complete and irreversible at the database boundary; PostgreSQL tests reject partial/repeated release and post-release mutation.
-   [x] Use `ON DELETE RESTRICT` for the binding-to-Application FK; no ordinary product path physically deletes released binding rows.
-   [x] Add parent-row locking/revalidation so binding create cannot race Application deletion.
-   [x] Extend Application deletion transaction to release bindings before Application tombstone.
-   [x] Application copy never copies bot bindings.

Illustrative Zod boundary:

```ts
const bindingPlatformSchema = z.enum(['max', 'telegram'])
const bindingStatusSchema = z.enum(['draft', 'active', 'disabled'])

const createBindingSchema = z
    .object({
        platform: bindingPlatformSchema,
        botUsername: z.string().trim().min(1).max(64),
        displayName: safeOperatorLabelSchema.optional()
    })
    .strict()
```

Platform-specific canonicalization/validation runs after the generic transport schema.

`safeOperatorLabelSchema` delegates to the shared application bot binding contract. The 120-character limit counts Unicode code points (so a supplementary character counts once), and decimal digits use Unicode `Decimal_Number` semantics. The PostgreSQL check uses the same Unicode digit and whitespace classes under the explicit `und-x-icu` collation; it is a best-effort content guard, not a complete PII detector.

### Phase 7 — Add binding APIs with strict ownership and no secret surface

Recommended routes:

```text
GET    /applications/:applicationId/bot-bindings
POST   /applications/:applicationId/bot-bindings
PATCH  /applications/:applicationId/bot-bindings/:bindingId
DELETE /applications/:applicationId/bot-bindings/:bindingId
```

DELETE means irreversible release/tombstone, not physical deletion.

-   [x] Reuse existing Application owner/admin management authorization.
-   [x] Use request-scoped `DbExecutor` for authenticated RLS flows.
-   [x] Keep SQL schema-qualified and parameterized.
-   [x] Return `RETURNING` rows where mutation confirmation matters.
-   [x] Fail closed on zero-row update/delete/release.
-   [x] Keep `expectedVersion` mandatory for every binding lifecycle mutation, including the database write boundary; authenticated table DML is revoked and mutation functions enforce expected versions.
-   [x] Do not accept unknown fields because request schemas are strict.
-   [x] Explicitly reject secret-looking fields such as token/webhook/initData if they appear in input rather than silently persisting them.
-   [x] API responses expose only the data needed for management UI.
-   [x] Require create/update/status/release mutations and their audit evidence to cross one atomic server-owned database boundary; direct authenticated audit INSERT and actor spoofing paths are revoked, and audit-write failure rolls back the mutation.
-   [x] Treat optional `displayName` as a short operator label; shared Zod and database constraints reject common contact/credential patterns without echoing submitted values in validation errors. This is best-effort content validation and is documented as such.
-   [x] Count Unicode decimal digits consistently in Zod and PostgreSQL using an explicit ICU collation; enforce the 120-character limit in Unicode code points, including supplementary characters, and keep the browser input limit consistent.
-   [x] Do not include the last editor identity in bot-binding optimistic-conflict details; map a concurrent parent Application deletion to the same safe HTTP 404 from update and release.
-   [x] Add a separate narrow anonymous resolver for launch attribution; do not expose the management relation through anonymous SELECT.

### Phase 8 — Build launch-link and bridge adapters

-   [x] Keep base public Application URL and messenger launch link as distinct fields.
-   [x] Generate Telegram Main Mini App links from normalized username + server-issued `short_id`.
-   [x] Generate MAX links from normalized username + `short_id`.
-   [x] Parse messenger launch context into a bounded neutral structure such as:

```ts
type MessengerLaunchContext =
    | { platform: 'telegram'; shortId: string | null }
    | { platform: 'max'; shortId: string | null }
    | { platform: 'browser'; shortId: null }
```

-   [x] Do not trust Telegram/MAX `initDataUnsafe` for authorization.
-   [x] In MVP, use start context only for non-secret attribution/routing hints.
-   [x] Resolve `short_id` against the Application already being rendered.
-   [x] Unknown/disabled/released IDs fall back to the ordinary public Application runtime.
-   [x] Feature-detect bridge globals; user-agent detection is not the authority.
-   [x] Keep Telegram and MAX adapters separate.
-   [x] Inherit the ordinary MUI light/dark theme as the MVP visual source of truth. Messenger `themeParams` may enhance the theme later but must not become a prerequisite for correct rendering in this phase.
-   [x] Where the documented bridge exposes it, add optional Back/close integration as progressive enhancement without making navigation depend on the messenger bridge. Browser fallback must keep normal web navigation usable.
-   [x] Cover FR-038 with a bounded non-PII launch-source metric (`telegram` / `max` / browser or equivalent) only through an existing project telemetry/metrics sink if one is already available. Do not create a new analytics subsystem for this MVP; if no reusable sink exists, record FR-038 as an explicit deferred Should requirement rather than logging messenger-user data or raw `initData`.

Browser fallback must work with neither bridge installed.

### Phase 9 — Add explicit authenticated, standalone, and public Messenger runtime

-   [x] Add a thin Messenger runtime shell in `apps-template-mui` that reuses existing published read-only widget/rendering primitives; do not fork/copy the Dashboard runtime into a second parallel implementation.
-   [x] Reuse the existing common `RuntimeWidgetRenderer`/`renderWidget()` path for the FR-006 widget classes; do not introduce `MessengerWidgetRegistry` or `MessengerWidgetRenderer` duplicates.
-   [x] Resolve the Messenger authenticated runtime entry: the effective-layout backend path now provides the required widget runtime data consumed by the shared renderer; a focused backend regression and authenticated-member browser acceptance cover the path.
-   [x] Complete host/effective-layout dispatch for `messenger-app`; remove the Dashboard-only runtime-data gate while preserving the shared fetch/query/loading/error pipeline.
-   [x] Extend `publicApplicationRuntimeSchema` discriminated union with a strict Messenger variant.
-   [x] Add a server-side Messenger projector that emits only bounded read-only DTOs.
-   [x] Replace implicit/binary template boundaries with exhaustive typed switches/maps using existing template/capability registries, including authenticated runtime-data projection and frontend dispatch; no parallel central template framework was introduced.
-   [x] Ensure public Messenger runtime contains no mutation endpoints/targets, authenticated control URLs, internal IDs, or raw persistence objects.
-   [x] Keep the published package isolation guard passing.

Example discriminated DTO direction:

```ts
const publicMessengerRuntimeSchema = z
    .object({
        templateKey: z.literal('messenger-app'),
        application: publicApplicationSummarySchema,
        layout: publicMessengerLayoutSchema,
        launch: publicMessengerLaunchContextSchema
    })
    .strict()
```

### Phase 10 — Implement authoring UI with TanStack Query

-   [x] Add `showInAppList` to frontend Application types/create/update/copy payloads.
-   [x] Separate runtime access (`isPublic`) from catalog visibility in create/settings UI.
-   [x] Add localized explanatory copy that catalog hiding is not access control.
-   [x] Add hidden-catalog badge on privileged surfaces.
-   [x] Add `messenger-app` to layout create/filter UI and localized labels.
-   [x] Add the Bots/Connections settings surface.
-   [x] Beside the copyable URLs, show short localized manual-setup guidance: Telegram Main Mini App/menu button or `web_app` link uses the canonical public Web App URL; MAX Mini App settings use the same canonical public URL. Do not imply that Universo configured or verified the external bot.
-   [x] Reuse existing Application settings/tab/list primitives. Add `showInAppList` through the existing Application `EntityFormDialog`/settings flow, use `StandardDialog` for bot-binding create/edit, the existing destructive-confirmation pattern (`ConfirmDeleteDialog` or the current shared equivalent) for irreversible release, and existing table/card primitives for the list. Do not create a Messenger-specific dialog framework.
-   [x] Extend the existing centralized `applicationsQueryKeys` hierarchy instead of creating a parallel query-key root:

```ts
botBindings: (applicationId: string) =>
    [...applicationsQueryKeys.detail(applicationId), 'bot-bindings'] as const,
botBindingDetail: (applicationId: string, bindingId: string) =>
    [...applicationsQueryKeys.botBindings(applicationId), 'detail', bindingId] as const
```

-   [x] Mutations invalidate the affected binding list and any Application detail/list queries whose visible metadata changed.
-   [x] Await invalidations in `onSuccess` when the UI should remain pending until the cache is coherent.

Example:

```ts
const mutation = useMutation({
    mutationFn: createApplicationBotBinding,
    onSuccess: async (_binding, variables) => {
        await Promise.all([
            queryClient.invalidateQueries({
                queryKey: applicationsQueryKeys.botBindings(variables.applicationId)
            }),
            queryClient.invalidateQueries({
                queryKey: applicationsQueryKeys.detail(variables.applicationId)
            })
        ])
    }
})
```

No client-generated `short_id`, no raw IDs as normal UX controls, and no raw JSON editor for bindings.

### Phase 11 — Internationalization

-   [x] Put Application settings/binding-management text in Applications frontend locale files.
-   [x] Put public Messenger runtime and bridge/fallback text in apps-template-mui locale ownership.
-   [x] Put truly shared template/zone labels in `packages/universo-react-i18n`.
-   [x] Add EN/RU parity checks and coverage-gate updates.
-   [x] Ensure validation/error messages are localized before display.

### Phase 12 — OpenAPI and developer contracts

-   [x] Update source generator for `templateKey` enums and Messenger DTOs.
-   [x] Document `showInAppList` create/update/copy semantics.
-   [x] Document binding CRUD, status semantics, irreversible release, and no-token policy.
-   [x] Regenerate OpenAPI.
-   [x] Add generated-output drift check.

### Phase 13 — Deep automated tests

#### Shared types / Vitest

-   [x] third template parses successfully;
-   [x] unknown template fails closed;
-   [x] Messenger config round-trips;
-   [x] zone lookup is template-aware;
-   [x] every FR-006 Must widget class has an explicit Messenger definition/adapter and passes its read-only public-projector contract;
-   [x] allowed widgets accepted;
-   [x] forbidden widgets rejected;
-   [x] public Messenger DTO is strict and bounded;
-   [x] `short_id` format helpers validated where shared.

#### Applications backend / Jest

-   [x] full catalog visibility truth table;
-   [x] list count/search/pagination use the same server-side visibility predicate;
-   [x] create/update/copy round-trip `showInAppList`;
-   [x] `isPublic` transitions preserve discovery preference;
-   [x] stale `showInAppList` updates fail through the existing Application `expectedVersion` conflict contract;
-   [x] successful `showInAppList` mutations create the required immutable audit evidence; audit-write failure aborts the mutation;
-   [x] binding create/list/update/disable/reactivate/release;
-   [x] released binding cannot reactivate;
-   [x] stale binding PATCH/release requests fail through `_upl_version` / `expectedVersion` rather than overwriting concurrent changes;
-   [x] binding mutation permissions;
-   [x] binding create/update/status/release produces immutable audit evidence transactionally; audit-write failure aborts the mutation;
-   [x] cross-Application isolation;
-   [x] duplicate canonical bot identity protection;
-   [x] server-generated short ID uniqueness/retry;
-   [x] short ID immutable after create;
-   [x] released short ID remains reserved;
-   [x] secret-looking fields rejected/not returned;
-   [x] Application copy excludes bindings;
-   [x] Application deletion releases bindings transactionally;
-   [x] zero-row mutations fail closed;
-   [x] public anonymous resolver returns minimal context only;
-   [x] unknown/disabled/released attribution falls back safely.

#### Real PostgreSQL integration

-   [x] canonical fresh schema creates the new column/relation/constraints correctly;
-   [x] historical `UNIQUE(application_id, platform, bot_username)` and global historical `UNIQUE(short_id)` behave correctly, including concurrent creation;
-   [x] binding FK is `ON DELETE RESTRICT` and released rows retain their permanent `short_id` reservation;
-   [x] Application-delete vs binding-create race cannot orphan/reassign external identifiers;
-   [x] public visibility predicate produces correct totals;
-   [x] RLS/authorization boundaries match existing Applications patterns.

#### Applications frontend / Vitest

-   [x] access and discovery controls are independent;
-   [x] closed Application disables/hides discovery control without destroying its value;
-   [x] hidden badge behavior;
-   [x] binding form platform-specific validation;
-   [x] responsive Dialog behavior;
-   [x] query-key and invalidation behavior;
-   [x] no optimistic short-ID generation;
-   [x] EN/RU text parity;
-   [x] no raw UUID/internal JSON normal workflow.

#### apps-template-mui / Vitest

-   [x] Messenger top/center/bottom shell;
-   [x] browser fallback with no bridge;
-   [x] Telegram adapter capability detection;
-   [x] MAX adapter capability detection;
-   [x] ordinary MUI light/dark theme works with no messenger theme payload;
-   [x] bridge Back/close capability is optional and browser fallback remains navigable when absent;
-   [x] loading/empty/error states;
-   [x] loading/empty/error states contain no platform-management/admin links and expose no internal route knowledge;
-   [x] read-only controls only;
-   [x] package isolation guard;
-   [x] unsupported widget/runtime state is safe and localized.

### Phase 14 — Fresh minimal-Supabase Playwright E2E

Use the repository local E2E workflow only:

```text
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
UNIVERSO_ENV_FILE=.env.e2e.local-supabase \
UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase \
pnpm run build:e2e
UNIVERSO_ENV_FILE=.env.e2e.local-supabase \
UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase \
node tools/testing/e2e/run-playwright-suite.mjs <messenger-focused-spec> --project chromium
pnpm supabase:e2e:stop
```

Do not use `pnpm dev`.

Start from a fresh disposable DB. Add a canonical generated fixture at `tools/fixtures/metahubs-messenger-app-snapshot.json` and a focused generator + contract + drift gate following the existing 73rd Meridian / Interpretation Network / MMOOMM fixture patterns. The generator must create the fixture from the real product flow on the fresh database; the committed fixture must not be hand-authored as a substitute for that flow.

Add a focused repository script/wrapper for the Messenger verification gate if it removes repeated environment setup, following existing `run*VerificationLocalSupabase.mjs` patterns. The gate must run generator -> fixture contract -> drift check -> imported/runtime acceptance.

Required end-to-end journeys:

1. create Application -> schema ready -> create global Messenger layout -> seed/author widgets -> runtime;
2. create listed public Application -> visible to ordinary non-member;
3. change to unlisted public -> absent from catalog/search but direct alias/UUID runtime still works;
4. member still sees unlisted Application;
   4a. open the member Application by selecting its visible catalog item rather than manually entering its URL;
5. privileged `showAll` caller sees it with hidden badge;
6. closed + `showInAppList=true` does not leak to non-members;
7. create multiple Telegram and MAX bindings;
8. copy links and verify exact safe link shape;
9. disable/release binding and verify attribution fallback;
10. copy Application and verify bindings are absent while `showInAppList` is preserved;
11. Messenger layout copy/snapshot/restore/sync/materialize round-trip;
12. existing Dashboard and Marketing Page still dispatch correctly;
13. import the canonical Messenger fixture and prove its public/authenticated runtime contract;
    13a. assert that a signed-in non-member receives `403` from the protected runtime-data endpoint, then verify that the public Application still follows the safe anonymous fallback without member identity or management data;
    13b. attach authenticated/public responsive screenshots to the Playwright report, assert visible Russian runtime navigation, and close all test contexts even if one close operation fails;
14. verify light/dark theme behavior and bridge-absent browser navigation;
15. unknown template fails closed rather than rendering the wrong template.

### Phase 15 — Screenshot and hands-on runtime UX QA

Capture reproducible screenshots with manifest/provenance, following existing docs screenshot generator patterns.

Viewport matrix:

-   1920x1080;
-   768x1024;
-   390x844;
-   320-ish narrow mobile.

Evidence must include:

-   Application creation/settings visibility controls;
-   hidden-catalog badge;
-   Bot bindings list;
-   add/edit/release responsive dialogs;
-   long bot names and long generated links;
-   Messenger public runtime top/center/bottom;
-   loading, empty, and bounded error state;
-   EN and RU captures for key docs/user flows;
-   ordinary browser fallback;
-   Telegram bridge stub;
-   MAX bridge stub.

Assertions:

-   no page-level horizontal overflow;
-   no clipped primary controls;
-   keyboard-only create/edit/release path works;
-   focus returns after dialog close;
-   focus assertions use Playwright web-first locators;
-   no raw UUID, raw JSON, `[object Object]`, untranslated internal error codes, or hidden-knowledge workflow;
-   touch targets are usable at mobile size;
-   screenshots are manually inspected before declaring UX PASS.

Record traces/screenshots for failing runs; do not mark screenshot generation itself as visual approval.

### Phase 15A — Real Telegram/MAX manual acceptance

Automated bridge stubs prove deterministic browser behavior but do not replace the source-TZ manual messenger acceptance.

-   [ ] Configure one Telegram test bot externally as a Main Mini App using the generated canonical public Web App URL; do not add/store its bot token in Universo.
-   [ ] Open the generated `https://t.me/<bot_username>?startapp=<short_id>` flow in an actual Telegram client and verify the public Messenger runtime opens without a Universo authenticated session.
-   [ ] Configure one eligible/moderated MAX test bot externally using the same canonical public Web App URL; do not add/store platform secrets in Universo.
-   [ ] Open the generated `https://max.ru/<bot_username>?startapp=<short_id>` flow in an actual MAX client and verify the runtime opens.
-   [ ] In both clients, verify an unlisted public Application remains directly reachable while absent from the ordinary Universo catalog.
-   [ ] Record bounded evidence (screenshots/device/client version and tested link shape) without storing bot tokens, messenger-user PII, or raw `initData`.

If external Telegram/MAX test accounts or an eligible MAX bot are unavailable at release time, record this gate as **INCOMPLETE**. Browser bridge stubs and unit tests must not be promoted to a manual-messenger PASS.

### Phase 16 — Documentation and READMEs

Add:

-   `docs/en/platform/messenger-app-template.md`
-   `docs/ru/platform/messenger-app-template.md`

Update:

-   `docs/en/SUMMARY.md`
-   `docs/ru/SUMMARY.md`
-   existing Applications documentation;
-   existing public applications/aliases documentation;
-   Application layouts guide;
-   browser E2E guide if new canonical Messenger commands/evidence layout are added.

Document:

-   what Messenger App is;
-   how to create the Messenger layout;
-   public vs catalog-visible semantics with truth table;
-   manual Telegram Main Mini App setup;
-   manual MAX Mini App setup;
-   multiple bindings;
-   status is operator-attested, not externally verified;
-   optimistic concurrency/version conflict behavior for management edits;
-   feature audit behavior for visibility and bot-binding mutations;
-   no token storage;
-   `short_id` is attribution, not authentication;
-   read-only anonymous MVP;
-   browser fallback and supported bridge enhancements;
-   FR-038 launch-source metric behavior, including the explicit deferred state when no existing telemetry sink is available;
-   testing/evidence workflow.

Document the canonical Messenger fixture/generator/contract/drift workflow alongside the existing browser E2E documentation when the new gate is added.

Update relevant package READMEs:

-   `packages/universo-react-types/README.md`;
-   `packages/universo-react-applications-backend/README.md`;
-   `packages/universo-react-applications-frontend/README.md`;
-   `packages/universo-react-apps-template-mui/README.md`;
-   additional package README only if its public contract actually changes.

Update root README/README-RU only if Messenger App becomes a top-level advertised platform capability in the same delivery.

### Phase 17 — Final verification and review gates

-   [x] focused package Jest/Vitest suites;
-   [x] Real PostgreSQL integration security gate: fail-closed tests reject unauthorized direct binding/audit INSERT/UPDATE, fabricated IDs/actors, partial release, stale version, and post-release mutation. Final integration suite: 11 suites / 53 tests.
-   [x] relevant package lint;
-   [x] relevant package builds/typechecks;
-   [x] root build when needed to prove cross-package propagation;
-   [x] i18n coverage;
-   [x] apps-template isolation;
-   [x] OpenAPI generation/drift;
-   [x] docs/GitBook parity/drift;
-   [x] FR-001…FR-039 traceability checklist complete; FR-009, FR-026, and FR-029 were reimplemented and verified by the final authenticated-runtime and database-security gates.
-   [x] canonical Messenger fixture generator + fixture contract + drift gate;
-   [x] Fresh minimal-Supabase Playwright acceptance proves both anonymous and authenticated-member Messenger runtime paths; management flow passed 2/2 and public/authenticated runtime flow passed 2/2.
-   [x] Final desktop English and mobile Russian Playwright baselines were visually inspected after the authenticated-runtime and retry-oracle fixes.
-   [ ] Actual Telegram test-bot acceptance remains INCOMPLETE; no eligible external client/bot was exercised.
-   [x] MAX client acceptance status explicitly recorded as INCOMPLETE because no eligible external client/bot was exercised (this is not a real-client PASS);
-   [x] `git diff --check`;
-   [x] OntoIndex `gn_verify_diff`;
-   [x] Scoped Thermos/security review after the remediation reported PASS with no actionable findings; it is bounded reviewer evidence, not a substitute for the unavailable broad Autoreview.
-   [ ] Autoreview final review unavailable: `BUNDLE_TOO_LARGE` on the broad dirty worktree; no Autoreview PASS is claimed.

Any unavailable tool must be recorded as unavailable/incomplete, never converted into PASS.

### Resolved QA finding — authenticated Messenger runtime regression (2026-11-01)

The browser symptom is deterministic: the same published Messenger Application renders its data anonymously, while an authenticated member is routed through the protected runtime and receives repeated required-source-unavailable states. This is an implementation defect, not an intended architecture decision. The original plan explicitly required a complete authenticated Messenger path and exhaustive three-template dispatch.

The following remediation is complete; the final fresh-profile gate now passes both authenticated and anonymous runtime flows:

1. Replace the Dashboard-only runtime-data condition in `packages/universo-react-applications-backend/src/services/effectiveLayoutResolverCore.ts` with an explicit template policy/exhaustive dispatch that resolves widget runtime data for authenticated `messenger-app` layouts. Keep Marketing Page behavior explicit rather than relying on a fallback.
2. Add a backend regression test around `resolveEffectiveLayoutForRequestWithRuntimeData()` using a real `messenger-app` layout with required source-bound widgets. Assert that the resolver is called with authenticated identity/permissions and that the projected placements contain the expected `runtimeData`.
3. Add a real authenticated-member Playwright journey to the Messenger verification gate. Import/create the canonical fixture, authenticate a normal member, open `/a/<application-ref>`, assert the Messenger shell and real fixture content, assert that no required-source-unavailable/runtime-load error is shown, and capture console/page errors.
4. Run that authenticated journey at desktop/tablet/mobile widths (at least 1920x1080, 768x1024, and 390x844), include an RU pass, and apply the existing no-technical-leakage, DataGrid leakage/overflow, and page-horizontal-overflow oracles.
5. Extend catalog browser acceptance so an unlisted public Application is absent for a non-member, still visible to a member, and opens the working authenticated Messenger runtime; keep direct anonymous alias access working independently of catalog visibility.
6. Make public and authenticated template selection compiler-exhaustive for `dashboard`, `marketing-page`, and `messenger-app`, with an `assertNever`/equivalent fail-closed branch so a future template cannot silently fall through to Dashboard or Marketing Page.
7. Reconcile Messenger bridge ownership with `packages/universo-react-apps-template-mui/README.md`: either move official Telegram/MAX bridge script loading to the host/bootstrap boundary as documented, or deliberately update the architecture contract and documentation. Do not leave presentation-shell behavior and package documentation contradictory.
8. Remove direct `authenticated` INSERT/UPDATE privileges and write-capable RLS paths for `rel_application_bot_bindings` and its control-audit relation. Route all binding mutations through one server-owned atomic database boundary (for example a narrow RPC / `SECURITY DEFINER` function or an equivalent server-only path) that re-checks owner/admin authorization, owns actor fields, enforces `expectedVersion`, and writes the matching audit record transactionally.
9. Enforce UUID v7 as a database invariant for binding and control-audit primary IDs, not only as an application default. Reject caller-supplied non-v7 IDs and keep `short_id` generation server-owned with the existing global uniqueness/reservation contract.
10. Enforce a canonical complete release transition at the database boundary. A first release mutation must atomically establish the full irreversible release/tombstone state, version increment, actor attribution, and audit evidence; partial release and fabricated audit rows must fail closed. Add negative PostgreSQL tests for partial release, actor spoofing, direct audit insertion, stale version, reactivation/reassignment, and mutation after release.
11. Bring Messenger nested authoring in line with the runtime model: remove Dashboard-only handling of nested placements in Metahub authoring where Messenger supports `parentInstanceKey` / `slotKey`, then cover create/edit/reorder/save round-trips with focused tests.
12. Focused Jest/Vitest, corrected PostgreSQL security integration, the fresh minimal-Supabase Messenger verification wrapper, and authenticated/anonymous screenshots were rerun. Scoped Thermos review passed. Autoreview could not process the dirty worktree bundle (`BUNDLE_TOO_LARGE`) and remains explicitly unavailable; it is not reported as PASS.

## Potential Challenges and Mitigations

### Hidden binary assumptions

Risk: a third template silently renders or serializes as Dashboard or Marketing Page.

Mitigation: exhaustive adapter dispatch and cross-template tests across shared types, authoring, copy, snapshot, sync, authenticated runtime, standalone runtime, and public runtime.

### Widget list wider than public data safety

Risk: a visually reusable Dashboard widget exposes authenticated/mutation behavior.

Mitigation: Messenger allowlist requires a server-side anonymous projector per widget. Every FR-006 Must class must receive a safe read-only projector/adapter; if one cannot be implemented safely, the MVP remains blocked until the implementation or explicit product scope changes. Never satisfy the requirement with a mutation-capable or fake control.

### Discovery flag mistaken for ACL

Risk: users think “hidden from catalog” makes a public App private.

Mitigation: independent backend semantics, explicit helper text, truth-table tests, direct-link E2E proof.

### External messenger policy drift

Risk: MAX/Telegram username/bridge/link rules change.

Mitigation: platform-specific adapters and validators; links generated from a small isolated contract; official docs rechecked near release.

### Permanent external links

Risk: released `short_id` gets reassigned and an old distributed link points at a different binding.

Mitigation: irreversible tombstone/release plus historical global uniqueness.

### Fresh DB vs old brief migration language

Risk: implementation adds unnecessary migration/backfill complexity.

Mitigation: latest user instruction is authoritative: canonical fresh-schema changes only, no compatibility migration, no version bump.

### UI duplication

Risk: bespoke Messenger settings/components drift from existing MUI patterns.

Mitigation: reuse existing Application settings/list/dialog primitives; published runtime reuses apps-template-mui primitives and stays within its package boundary.

## MVP Acceptance Criteria

-   [x] `messenger-app` is a true third layout/runtime template with exhaustive authenticated/public dispatch and fail-closed unknown-template handling.
-   [x] Layout editor can create/filter/localize Messenger layouts.
-   [x] First global Messenger layout can become the default through normal layout CRUD.
-   [x] Messenger runtime has top/center/bottom composition and no platform chrome.
-   [x] Anonymous Messenger runtime is server-enforced read-only.
-   [x] All FR-006 Must widget classes are available through safe read-only Messenger adapters/projectors; forbidden platform/admin widgets remain rejected.
-   [x] `showInAppList` defaults to true and round-trips through create/read/update/copy.
-   [x] Binding management uses optimistic concurrency at every write boundary; direct authenticated table mutation is denied.
-   [x] Binding lifecycle mutations create immutable audit evidence transactionally at the only permitted write boundary; direct authenticated binding/audit writes are denied.
-   [x] Public unlisted App is absent from ordinary catalog/search but still opens through direct public UUID/alias.
-   [x] Members and existing privileged `showAll` users retain visibility.
-   [x] Multiple MAX and Telegram bindings are supported per Application.
-   [x] Telegram MVP uses Main Mini App links.
-   [x] No bot token/secret/initData/PII is stored.
-   [x] `short_id` and persisted binding/audit IDs are server-owned and DB-enforced; tests reject caller-supplied lifecycle IDs/actors.
-   [x] Binding release is irreversible and canonical at the database boundary; partial release and post-release mutation are rejected.
-   [x] Application copy preserves `showInAppList` but does not copy bindings.
-   [x] Existing Dashboard and Marketing Page behavior remains valid on a fresh DB.
-   [x] The obsolete single-snapshot legacy `layoutConfig` compatibility projection is absent from the touched fresh-database snapshot/sync path; canonical `layouts[]` / `widgets[]` is used across all three templates.
-   [x] EN/RU UI and GitBook documentation are complete.
-   [x] Canonical `tools/fixtures/metahubs-messenger-app-snapshot.json` is generated through the real flow and passes contract/drift/import-runtime gates.
-   [x] Jest/Vitest/PostgreSQL/Playwright coverage passes for repository-local acceptance, including authenticated runtime and fail-closed PostgreSQL security tests.
-   [x] Real screenshots are generated and manually inspected at desktop/tablet/mobile/narrow-mobile widths.
-   [ ] Actual Telegram/MAX test-bot acceptance remains INCOMPLETE pending eligible external clients; automated bridge stubs and browser flows do not count as manual platform acceptance.
-   [x] No page-level horizontal overflow, raw IDs/JSON, unlocalized validation, or wrong-template fallback is observed.
-   [x] No schema or metahub-template version increase was introduced. The root package in this worktree is already `0.88.0-alpha` versus `0.86.0-alpha` at `HEAD`; this existing diff is not represented as an unchanged root version.

## Explicitly Deferred

-   Telegram Direct Mini Apps and `appShortName`;
-   bot token storage;
-   automatic Telegram/MAX Bot API setup;
-   webhook management;
-   external bot ownership/configuration verification;
-   server validation of Telegram/MAX `initData`;
-   messenger-user login/session mapping;
-   write-capable Messenger runtime;
-   QR generation;
-   bulk catalog-visibility management (FR-022);
-   analytics beyond non-secret launch attribution;
-   a new metahub template;
-   broad platform-wide audit redesign.

## Discussion Points

1. The plan intentionally corrects one source-TZ UX assumption: `messenger-app` is chosen when creating an Application **layout**, not as a persisted type on the Application row. This matches the existing architecture and avoids a new deferred bootstrap state.
2. FR-006 marks the named widget classes as Must. The security gate therefore requires implementing an anonymous-safe read-only projector/adapter for each required class; silently narrowing the list is not an acceptable implementation shortcut.
3. Telegram Direct Mini Apps are intentionally deferred; Main Mini Apps cover the requested `?startapp=<short_id>` workflow without extra binding fields.
4. The older brief's forward-migration recommendation is superseded by the latest clean-database instruction. No compatibility migration/version bump is planned.

## Implementation closeout — 2026-11-01

-   Automated implementation phases and the documentation phase are complete. The acceptance checklist remains incomplete for actual Telegram/MAX client evidence, and the final Autoreview gate is unavailable (`BUNDLE_TOO_LARGE`); neither is reported as PASS.
-   The final resumed `pnpm test:e2e:messenger-app:verify:local-supabase` gate exited 0 under Node 22.22.2. Workspace build passed 36/36 tasks; fixture drift, generator 2/2, fixture contract 15/15, management browser flow 2/2, runtime UX oracle 9/9, and authenticated/public Messenger runtime Playwright 2/2 passed. PostgreSQL integration passed 11 suites / 53 tests. The run also passed shared types (3 files / 21 tests), shared utils (1 / 2), Applications Frontend (7 / 82), apps-template MUI (8 / 53), Applications Backend Jest (14 suites / 152 tests), Metahubs Backend (2), and Metahubs Frontend (1 file / 3 tests).
-   Final closeout checks passed for Applications Backend lint (0 errors, 17 warnings in unrelated existing tests), apps-template lint, scoped Prettier, and `git diff --check`. The earlier i18n, 116 EN/RU GitBook page-pair, screenshot asset, package-isolation, and REST OpenAPI checks remain recorded above. The final desktop English and mobile Russian Playwright screenshot baselines were visually inspected; the desktop viewport is 1920x1080 and the narrow Russian capture has readable wrapping without visible clipping.
-   The dedicated minimal E2E Supabase profile was stopped by the verification wrapper. No production system was tested. The worktree root package reports `0.88.0-alpha` versus `0.86.0-alpha` at `HEAD`; this version diff was present before this final QA continuation and was preserved, so root-version immutability against `HEAD` is not claimed. No schema or metahub-template version increase was introduced. The scoped Thermos/security reviewer reported PASS with no actionable findings. OntoIndex is current for committed `HEAD` but dirty without a working-tree overlay, so it provides no graph PASS for this later test-only decomposition; direct source review is authoritative. The final `.agents/skills/autoreview/scripts/autoreview --mode local --timeout 120` returned `UNAVAILABLE/BUNDLE_TOO_LARGE` and is not reported as a pass. Real Telegram/MAX client acceptance remains incomplete pending eligible external clients; no production system was exercised.

### Final resumed verification addendum — 2026-11-01

-   The retry browser regression was made deterministic by recording the trusted click timestamp synchronously and comparing it to the Playwright route-observation time. It allows exactly one post-click retry request, rejects background retries, and validates the actual browser response status/body. Earlier failures in this continuation were test-oracle timing/race defects; the corrected flow passed the canonical gate.
-   The anonymous runtime desktop viewport is 1920x1080. Screenshot assertions now compare the English desktop and Russian mobile rendering to committed Playwright baselines with bounded visual tolerance. Both images were opened and inspected after capture.
-   The server request-claims integration helper now checks that `current_user` and `session_user` match the configured backend test database login before applying request claims; tests that simulate the PostgREST `authenticated`/`anon` roles continue to do so through the explicit database-role helper.
-   OntoIndex impact for the newly untracked test helper reported `not-in-index`; its graph reflects committed `HEAD` only, while the dirty worktree has no source overlay. Direct diff/source inspection and tests were used; complete graph-backed impact is not claimed. Autoreview again returned `UNAVAILABLE/BUNDLE_TOO_LARGE`.
-   The dedicated E2E Supabase profile is stopped. The regular local Supabase stack remained running and untouched. No files were staged or committed; the existing dirty worktree was preserved. No production or real MAX/Telegram client was tested.
