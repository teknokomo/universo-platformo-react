# Plan: Consortium Marketing Product, Anonymous Public Runtime, and Application Aliases

> Status: QA-reviewed revised draft for discussion
> Created: 2026-09-15
> Mode: PLAN
> Product-code changes: none in this plan pass
> Primary input: the 2026-09-15 Consortium marketing public runtime aliases source task (maintained outside the repository).
> Primary brief: the 2026-09-15 reviewed implementation brief for the same feature (maintained outside the repository).
> Research: `memory-bank/research/consortium-marketing-public-runtime-aliases-research-2026-09-15.md`
> Content draft: `.backup/Лендинг-для-Консорциума.md`

## Overview

Implement one coordinated clean-break feature with four independently testable product slices:

1. a dedicated **73rd Meridian Consortium** product snapshot generated from the generic `marketing-page` metahub template;
2. a generic **static marketing image widget** that owns the central Hero media through typed widget configuration;
3. a secure **anonymous published-read runtime** for applications explicitly marked public;
4. a deployment-global **application alias registry** with capability-based administration, root `Superuser` access by default, and direct/canonical routing modes.

The implementation must keep the built-in `marketing-page` template reusable. Consortium facts belong in a generated product fixture, not in the generic seed. Application UUID v7 remains the immutable internal identity; aliases are mutable routing names only. Public rendering is a dedicated authorization boundary with an allowlisted response model, not an unauthenticated mounting of the current authenticated application API.

This is a clean break. The disposable test database will be recreated. Remove the old application `slug` contract and all of its consumers instead of maintaining compatibility readers or migrations. Modify the current baseline schema/runtime DDL definitions directly where needed; do not increase the metahub template version, snapshot version, or an application/metahub schema version solely for this work.

The plan preserves the current package boundaries:

-   control-plane management stays in `applications-*` / `admin-*` packages;
-   generic UI primitives stay in `@universo-react/template-mui`;
-   common ability/types/resource contracts stay in `@universo-react/types` and generic helpers in `@universo-react/utils`;
-   common EN/RU UI strings belong in `@universo-react/i18n` when reused across feature packages;
-   published runtime presentation stays isolated in `@universo-react/apps-template-mui` and must not import control-plane feature packages;
-   data access remains SQL-first through `DbExecutor`, with raw Knex limited to existing DDL infrastructure boundaries.

## Planning evidence and fixed decisions

The plan uses the QA-reviewed RESEARCH artifact as its architectural baseline and rechecked current source before decomposition. Current source confirms:

-   `createAppRuntimeRoute(...)` is mounted under `AuthGuard`, while `createPublicApplicationsRoutes(...)` exposes only guest/access-link semantics;
-   the normal applications backend router starts with `router.use(ensureAuth)`;
-   `publicRuntimeAccess.ts` exposes useful low-level public/read helpers but currently leaks different 400/403/404 reasons and binds transaction-local workspace state without owning a full transaction;
-   `obj_applications.slug` is present in baseline DDL, system app metadata, persistence, create/update/copy, release/sync identity, frontend/API types, fixtures, and E2E cleanup bookkeeping;
-   `MarketingWidgetConfigDialog` assumes every configurable marketing content widget has an entity `source`; `marketing.auth` is the current special source-less case;
-   Hero media is still owned by `MarketingPageSiteSettings.HeroLightPreview/HeroDarkPreview` and normalized/rendered from that record;
-   the current workspace-wide default flag is a **per-user membership** flag, not an application-level public workspace designation;
-   `createEnsureGlobalAccess()` checks `canAccessAdmin()` before the requested module/action, and `admin.has_admin_permission()` currently admits wildcard or read access to `roles`, `instances`, or `users`;
-   the clean bootstrap has `Registered`, `User`, and root `Superuser` system roles; there is no need to create another role for alias management;
-   role permissions are already data-driven and rendered through the shared permission matrix, but system-role permissions are currently immutable in the generic role editor;
-   MUI v9.2.0 Context7 guidance supports the existing `StandardDialog`/Tabs/table composition and `slots`/`slotProps` direction;
-   React Router v6 supports `Navigate`/`useNavigate(..., { replace: true })` for same-origin SPA canonicalization, while the repository currently pins a v6 line that should be patched before alias routing is expanded.
-   Current external verification on 2026-09-15 shows `react-router`/`react-router-dom` **6.30.6** as the current v6 release, fixing the July 2026 v6 open-redirect/XSS advisory affecting `react-router-dom <=6.30.5`; `@remix-run/router` **1.23.4** is the current patched package line. This is a **derived security prerequisite**, not a product requirement from the source TZ: patch the existing v6 dependency before expanding alias routing, while keeping the supported-major migration as a separate follow-up because React Router's security policy now marks v6 unsupported.

The following research decisions are treated as fixed unless implementation discovers contradictory source evidence:

-   Consortium funding stages use `marketing.collection` with the `highlights` variant; `marketing.pricing` is omitted.
-   The first central image uses the existing MUI `dashboard.jpg` URL as an editable placeholder; image upload/crop/processing/generation is out of scope.
-   Public application routing resolves UUID or alias before deciding anonymous versus authenticated runtime.
-   Anonymous unavailable states collapse to one non-enumerating 404-style response.
-   Client-supplied `workspaceId` is never public authorization input.
-   A public workspace-enabled application requires an explicit active non-personal public-entry workspace.
-   Alias routing is deployment-global and has no `instance_id` ownership.
-   Mutable canonical alias changes use SPA history replacement or a temporary same-origin redirect; permanent 301/308 is not the default.
-   The stable UUID technical address remains valid and is not auto-canonicalized.
-   Alias reservation survives application archive/soft-delete until an explicit privileged alias release.

### QA overrides to earlier brief/research decisions

The latest product direction supersedes two conclusions in the earlier brief/research artifacts and is authoritative for implementation. Older `superadmin` and separate-approved-EN-source statements remain historical research context only; implementation follows the overrides below whenever those documents disagree:

-   **Do not create a `Superadmin` role.** Alias administration is authorized by the dedicated global `applicationAliases -> ApplicationAlias` permission. Root `Superuser` can manage aliases immediately through the existing `isSuperuser()` bypass. The permission remains a normal assignable RBAC subject so an authorized administrator can later grant it to existing default roles or custom roles without code or schema changes.
-   **The Russian landing draft is the working product-copy source.** Build the first English Consortium copy as a faithful translation of `.backup/Лендинг-для-Консорциума.md`, preserving factual meaning and numeric values and adding no new claims. A separate pre-existing EN source is not a prerequisite.

Granting or revoking permissions is itself a privileged RBAC mutation. The role editor must enforce a server-side **delegation ceiling**: root `Superuser` may grant any non-root permission, while a non-Superuser role administrator may grant only permissions already contained in their own effective privilege envelope and may never create/set `isSuperuser`, grant unrestricted `*:*` beyond that envelope, or use conditions/fields to create a backend/frontend authorization mismatch. Because no non-Superuser role receives `applicationAliases` at bootstrap, root `Superuser` is initially the only alias administrator; later delegation can use the same generic RBAC model without a new role or schema.

## Scope

### In scope

-   React Router v6 security patch within the centralized dependency catalog/override model.
-   Removal of legacy application `slug` from the clean baseline and all runtime/release/test consumers.
-   Global application alias table, normalization, routing policy, service, API, RBAC, and UI.
-   Dedicated assignable `ApplicationAlias` permission subject, root `Superuser` default access, and protected permission-grant governance for default/custom roles.
-   Public-entry workspace designation and its database invariant.
-   Anonymous public application bootstrap/read boundary with transaction-pinned workspace context and redacted renderer DTOs.
-   One frontend `/a/:applicationRef/*` entry resolver supporting UUID and alias.
-   Generic marketing widget ownership modes and a static image widget.
-   Full removal of the old Hero light/dark preview ownership path.
-   Generated Consortium snapshot and product-specific fixture/runtime contract.
-   EN/RU UI/chrome/validation/help strings.
-   Jest, Vitest/RTL, PostgreSQL integration, and Playwright browser/security/visual coverage.
-   README updates plus EN/RU GitBook documentation under `docs/`.

### Explicit non-goals

-   No compatibility layer for `obj_applications.slug` or old application-slug API payloads.
-   No alias namespace per Instance and no `instance_id` on aliases.
-   No Unicode/localized aliases in this slice.
-   No user-controlled redirect host/scheme/destination.
-   No image upload, cropper, media processing, or AI image generation.
-   No public mutation API for normal application runtime commands.
-   No merge of application aliases with LMS/access-link slugs or guest-session semantics.
-   No application-alias expansion into existing realtime/WebSocket protocols in this slice; those transports keep their current stable application identifiers, origin checks and authorization contracts until a separate reviewed protocol explicitly adds aliases.
-   Do not remove or reinterpret the existing guest/access-link route `/public/a/:applicationId/links/:slug`; that `:slug` is a content access-link identifier and is unrelated to the removed `obj_applications.slug` field.
-   No synthetic public user or synthetic application membership.
-   No generic exposure of authenticated `EffectiveLayoutSuccess` to anonymous visitors.
-   No application/metahub template version bump and no snapshot envelope version bump.
-   No React Router major migration inside this feature unless the security patch proves incompatible; supported-major migration remains a separately tracked task.

## Affected areas

### Shared contracts and utilities

-   `packages/universo-react-types/src/abilities/index.ts`
-   `packages/universo-react-types/src/common/marketingPage.ts`
-   `packages/universo-react-types/src/common/applicationLayouts.ts`
-   `packages/universo-react-types/src/common/resourceSources.ts` (reuse, not duplicate)
-   `packages/universo-react-utils/src/validation/marketingSnapshot.ts`
-   a shared alias normalizer/validator in `@universo-react/types` and/or `@universo-react/utils`, with one canonical implementation
-   shared EN/RU keys in `packages/universo-react-i18n` when wording is consumed by more than one feature surface

### Applications backend

-   baseline application DDL and system definition
-   `applicationsStore.ts` / controller payloads and search
-   release/sync identity and publication-created application projections
-   application runtime schema workspace DDL
-   effective-layout resolver split into shared selection core plus authenticated/public adapters
-   new application-alias store/service/routes
-   new anonymous public application bootstrap/read routes
-   public renderer projection/redaction
-   focused Jest and PostgreSQL integration tests

### Admin backend/frontend

-   admin-entry predicate, assignable permission schema and privileged grant/revoke governance
-   existing RoleEdit/PermissionMatrix reuse for default/custom role permissions
-   `ApplicationAlias` CASL subject/module mapping
-   Instance-shell navigation/guard integration for the deployment-global Slugs page
-   Instance navigation, route and breadcrumb integration
-   EN/RU admin translations

### Applications frontend / shared MUI shell

-   Edit Application `Addresses / Адреса` tab, edit-only and capability-gated
-   application-domain ownership of the centralized Slugs page component plus alias API/query hooks, mounted by core under the Admin/Instance shell
-   dedicated alias queries/mutations instead of application form state
-   `/a/:applicationRef/*` public/authenticated route-entry resolution
-   `getInstanceMenuItems`, `MenuContent`, breadcrumbs and capability visibility
-   shared table/dialog/confirmation primitives

### Marketing authoring/runtime

-   `MARKETING_WIDGET_REGISTRY` ownership metadata
-   generic `MarketingWidgetConfigDialog`
-   template manifest validation and snapshot validation
-   `marketing.image` config/materialization/runtime rendering
-   Hero/site-settings media removal
-   isolated `apps-template-mui` renderer and normalization tests

### Fixtures, E2E and docs

-   `tools/fixtures/metahubs-73rd-meridian-app-snapshot.json`
-   generator based on the existing Interpretation Network authoring/export pattern
-   shared snapshot fixture contract registration
-   product-specific Consortium fixture/runtime/round-trip contract
-   public-runtime/alias/RBAC/marketing Playwright suites
-   focused local-Supabase verification wrapper
-   package READMEs and root `docs/en/**`, `docs/ru/**`, both GitBook `SUMMARY.md` indexes

## Data model and API decisions

### 1. Alias registry

Use a dedicated application-owned table in the clean applications baseline, conceptually:

```sql
CREATE TABLE applications.obj_application_aliases (
    id UUID PRIMARY KEY,
    application_id UUID NOT NULL,
    alias VARCHAR(63) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    released_at TIMESTAMPTZ NULL,
    created_by UUID NULL,
    _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
    _app_deleted BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT fk_application_alias_application
        FOREIGN KEY (application_id)
        REFERENCES applications.obj_applications(id)
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_application_alias_reserved_name
ON applications.obj_application_aliases (alias)
WHERE released_at IS NULL;

CREATE UNIQUE INDEX uq_application_alias_one_primary
ON applications.obj_application_aliases (application_id)
WHERE is_primary = true
  AND released_at IS NULL
  AND _upl_deleted = false
  AND _app_deleted = false;
```

Requirements:

-   service-generated row IDs are UUID v7;
-   store only canonical normalized aliases;
-   `released_at IS NULL` alone defines whether a name is reserved for uniqueness; `_upl_deleted` / `_app_deleted` may disable routing/list visibility but must not make an unreleased name claimable;
-   a released alias can never remain primary: enforce `released_at IS NULL OR is_primary = false` as a database CHECK (or an equivalent baseline constraint) and clear `is_primary` in the same transaction that sets `released_at`;
-   `ON DELETE RESTRICT` prevents future hard purge from silently freeing aliases;
-   canonical mode with aliases requires exactly one primary as a service invariant;
-   database unique indexes remain the final collision arbiter under concurrency;
-   changing primary/mode, releasing the current primary, and any soft-delete/archive transition that can affect routability are atomic and serialized per application with a row lock or existing PostgreSQL advisory-lock helper; a mutation must either select a replacement primary/change policy in the same transaction or fail closed before the invariant is broken;
-   releasing an alias is an explicit privileged lifecycle operation, not a side effect of application deletion.

Application routing policy is a typed `direct | canonical` application-level field/policy record. It stores policy only; it never stores a destination URL.

For the clean baseline, prefer an explicit typed application column such as
`alias_routing_mode VARCHAR(...) NOT NULL DEFAULT 'direct'` with a CHECK
constraint over hiding routing policy inside generic JSON settings. The value is
part of application routing semantics, while individual alias rows remain a
separate resource.

### 2. Alias normalization

Create one shared contract used by API validation, route resolution and UI prevalidation:

```ts
const APPLICATION_ALIAS_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function normalizeApplicationAlias(input: string): string {
    const alias = input.trim().toLowerCase()
    if (!APPLICATION_ALIAS_RE.test(alias)) throw new ApplicationAliasValidationError('format')
    if (looksLikeUuid(alias)) throw new ApplicationAliasValidationError('uuid')
    if (RESERVED_APPLICATION_ALIASES.has(alias)) throw new ApplicationAliasValidationError('reserved')
    return alias
}
```

The real implementation must additionally reject slash/backslash, percent escapes, controls, malformed decoding and non-ASCII input before lookup. Reserved route words live in one platform-owned registry shared by router and validation; frontend help may mirror the server result but is not authoritative.

### 3. Public workspace designation

Extend the application runtime workspace table with an explicit workspace-owned public-entry flag, e.g. `is_public_entry BOOLEAN NOT NULL DEFAULT false`. Do **not** reuse `_app_workspace_user_roles.is_default_workspace`.

Add a partial unique index that permits at most one active public-entry workspace per application runtime schema and require the designated workspace to be active, non-personal and unowned by a personal user. The service rejects attempts to mark personal/inactive/deleted workspaces and clears/sets the marker transactionally.

When workspaces are enabled, anonymous rendering fails closed unless exactly one valid designated public-entry workspace can be resolved. The public request never selects a workspace.

### 4. Anonymous published-read boundary

Add a dedicated public route namespace under the existing `/api/v1/public/...` composition, separate from guest/access-link routes. One bootstrap call should resolve the address and return enough renderer-safe data to avoid a client waterfall where practical.

Conceptual service shape:

```ts
return db.transaction(async (trx) => {
    const route = await resolveApplicationRef(trx, applicationRef)
    const app = await requirePublicReadyApplication(trx, route.applicationId)
    const workspace = await resolveServerOwnedPublicWorkspace(trx, app)

    await bindPublicWorkspaceContext(trx, app.schemaName, workspace?.id ?? null)

    const effectiveLayout = await resolvePublicEffectiveLayout({
        executor: trx,
        application: app,
        workspace
    })
    const rendererData = await loadAllowlistedPublishedRendererData({
        executor: trx,
        application: app,
        workspace,
        effectiveLayout
    })

    return projectPublicRuntimeDto({ route, effectiveLayout, rendererData })
})
```

The same transaction executor owns public workspace selection, `set_config(..., true)`, effective-layout selection and every workspace/RLS-dependent renderer query.

Externally, malformed/unknown/private/deleted/archived/unpublished/unready references all map to one 404-style `PUBLIC_APPLICATION_NOT_AVAILABLE`. Internal logs may retain a structured reason without logging secrets/PII.

Public readiness is explicit:

-   active and not soft-deleted;
-   not archived;
-   `is_public = true`;
-   `_app_published = true`;
-   schema/materialization/layout are internally coherent;
-   `synced` is eligible;
-   `draft`, `pending`, `maintenance`, `error` are unavailable;
-   `outdated` / `update_available` are eligible only when a coherent previously installed release/materialization is explicitly proven and the resolver serves that installed state without mixing newer source state;
-   required public workspace is valid.

### 5. Public DTO allowlist

Define a dedicated shared public runtime response schema. Include only fields required by the published renderer, such as resolved application reference metadata safe for display/routing, template key, semantic layout/widget config, localized renderer content, safe resource sources and optional canonical-route information.

Prefer returning the complete renderer payload needed for the initial public
route in this bootstrap. If a template needs follow-up reads after bootstrap,
those reads must use a dedicated allowlisted public runtime transport under the
same public authorization/readiness boundary. They must repeat server-owned
public-workspace selection and transaction-local RLS binding for that request,
must apply the same generic unavailable/error and cache policy, and must never
fall through to the authenticated `/applications/:id/runtime/*` endpoints.
This is required for the current marketing renderer in particular: today
`MarketingRuntimeContent` performs a second authenticated
`/applications/:id/runtime/marketing-page` request, so the anonymous adapter
must either receive the complete marketing payload from bootstrap or use an
explicitly injected public fetcher/transport rather than reusing that
authenticated request path.

Explicitly exclude:

-   memberships, role assignments and owner user IDs;
-   schema names and physical table/column identifiers;
-   connector administration and credentials;
-   source layout IDs and publication lineage IDs;
-   snapshot/content/materialization hashes;
-   internal precedence/source-kind diagnostics;
-   mutation capability maps;
-   client-selectable workspace identity used as authorization.

Write an allowlist serializer/schema rather than serializing the authenticated `EffectiveLayoutSuccess` and deleting fields afterward.

### 6. Frontend route resolution

Use one deterministic route entry for `/a/:applicationRef/*` outside `AuthGuard`:

1. call the anonymous public resolver/bootstrap without credentials being required;
2. if the application is publicly ready, render the dedicated anonymous runtime adapter;
3. if the public resolver returns the generic unavailable result and an authenticated session exists, run a **separate authenticated application-ref resolver** under normal membership/global authorization, then enter the existing `ApplicationGuard` + migration/runtime path; never smuggle a private UUID or existence signal out of the public resolver for this fallback;
4. if unavailable and anonymous, show the same public-unavailable page rather than redirecting to login based on resource existence.

Alias routing behavior:

-   UUID ref: keep the technical UUID URL valid;
-   primary alias: render directly;
-   secondary alias in `direct` mode: render directly at that alias;
-   secondary alias in `canonical` mode: server supplies only the primary alias token; frontend constructs the same-origin relative path and uses history replacement, preserving remaining path and query;
-   never accept a destination URL, protocol or host from a client/API payload.

The anonymous runtime adapter gets its own API client functions and TanStack Query keys. It must never call authenticated `/applications/:id/runtime/*` endpoints and must never send `workspaceId` as public authority.

## UI Contract

### Edit Application → Addresses / Адреса

**User role:** root `Superuser` initially; later any global role that has the required `ApplicationAlias` read/mutation permissions. Application ownership by itself grants no alias-management access.

**Placement:** edit-only third tab after General and Parameters. Create/copy dialogs do not show it because aliases are managed only after a persisted application exists.

**Data:** dedicated TanStack Query alias list/policy query keyed by application UUID internally; mutations invalidate alias detail/list/router caches deterministically.

**Dialog transaction/footer semantics:** the Addresses tab owns independent alias
mutations and must never imply that alias changes are waiting for the outer
Application Save button. Extend the shared `EntityFormDialog`/`TabConfig` with a
generic per-tab action mode (for example `form | independent`). On an
`independent` tab, the outer entity Save/Delete actions are hidden and the
footer exposes only a localized Close action. General/Parameters continue to
use the normal application Save/Delete contract. Switching tabs does not roll
back already completed alias mutations. Closing Addresses never submits the
application form. Add shared primitive tests for tab switch, Escape/Close,
focus restoration and dirty application-form state. Unsaved General/Parameters
values remain in form memory while visiting Addresses. If Close/Escape/backdrop
would dismiss a dirty application form, use a generic dirty/discard contract
added to `EntityFormDialog` in this slice: retain the initial form snapshot,
derive `isDirty`, route every dismissal through one `requestClose` path, and
reuse the shared confirmation primitive before discarding. The current shared
dialog does not already provide this full contract. On confirmation,
cancelling returns to the dialog, while confirming discards only unsaved
application-form values and **never rolls back alias mutations that already
completed independently**.

**Visible controls:**

-   technical UUID address as a clearly labeled copyable read-only address;
-   alias list using human-readable address strings;
-   routing policy control whose stored values remain `direct | canonical`, while visible EN/RU labels explain the user behavior (for example “Open at every address” / “Redirect secondary addresses to the primary address”) instead of exposing internal enum codenames as unexplained product terminology;
-   create alias action;
-   set-primary action;
-   edit/rename if the product semantics allow rename as release+claim in one atomic service operation;
-   explicit release confirmation.

**Hidden/system-owned:** alias row UUID, application UUID in selectors, audit metadata, normalized internal timestamps.

The UUID inside the explicitly labeled `Technical address / Технический адрес`
control is the one intentional raw-ID exception. UUIDs remain forbidden in
ordinary row labels, selectors, breadcrumbs, validation/errors and descriptive
copy.

**Validation:** user-facing localized format/reserved/conflict messages; no raw Zod, SQL constraint, UUID, or internal permission token in errors.

**Responsive:** dialog content stacks on narrow screens; alias strings wrap or ellipsize with accessible full-value copy; no page-level horizontal scroll.

### Add/Edit Alias dialog

**Primitive:** `StandardDialog`; shared by Addresses and the central Slugs
page. The central page additionally supplies the application selector when
creating an alias; Addresses already has application context.

**Fields:** normalized alias text; read-only preview of the resulting relative
address; optional `Make primary` choice on create only when semantically valid.
Editing an alias is implemented as one atomic server rename/claim operation so
there is never a visible release-then-reclaim race.

**Defaults:** alias empty on create; current normalized alias on edit. Primary
state is not silently changed by rename.

**Validation:** localized format, reserved-name and conflict messages. A valid
URL whose remote image/address target is currently unavailable is not a concept
for alias validation; only the platform alias contract is checked. Save is
disabled only for incomplete/known-invalid input or an in-flight mutation.

**Mutation result:** successful create/edit invalidates the canonical shared
alias list, per-application alias list, application routing policy and any
public route-resolution cache keyed by the affected alias/application. On
failure, keep the dialog open and focus/associate the localized error with the
field.

### Set Primary confirmation

**Primitive:** shared confirmation dialog. This is a deliberate confirmation
because changing primary changes the canonical destination of secondary
aliases. Show the human-readable old/new address and the affected application's
localized name; never show row UUIDs.

**Mutation:** one transactional backend operation. Success updates all alias
lists/policy views and canonical route resolution before the confirmation closes.

### Release Alias confirmation

**Primitive:** shared destructive confirmation dialog. Explain that the address
stops routing when the release transaction commits and the released name then
becomes eligible for a future claim by another application. This is distinct
from ordinary soft-delete/archive behavior, which may disable routing while
keeping an unreleased name reserved. A primary alias cannot be released if that
would violate canonical-mode invariants; the UI surfaces the localized domain
reason and tells the user to choose a new primary or change routing mode first.

### Application selector for central Slugs administration

**Visible label:** localized application name, with a semantic secondary label
`<Metahub name> / <Publication name>` when disambiguation is needed. Do not use
UUID or schema name as a normal secondary label. If those parent labels are not
available from the existing applications read model, extend the admin-safe
selector projection explicitly rather than leaking internal identifiers.

**Behavior:** searchable, keyboard-operable, loading/empty/error states, no
free-text application ID entry. The selected option's UUID remains an internal
value only.

### Administration → Instance → Slugs

**User role:** root `Superuser` initially; later any global role whose `ApplicationAlias` permissions cover the requested read/mutation action.

**Placement:** below Languages/Locales in the Instance navigation. `instanceId` is shell/breadcrumb context only; rows are deployment-global.

**Page composition:** follow `LocalesList.tsx` for visual structure (`ViewHeader`, `ToolbarControls`, `FlowListTable`, `StandardDialog`) and reuse `RolesList.tsx` plus shared `usePaginated`, `useDebouncedSearch`, and `PaginationControls` for the deployment-global potentially unbounded dataset. Do not copy ad hoc locale dialog internals or pretend that `LocalesList` itself provides pagination.

**Columns:** alias/address, localized application display name plus meaningful disambiguator, primary state, routing behavior, lifecycle/status/actions. Internal UUIDs are never normal business labels.

**Application picker:** searchable human application name; duplicate names get a meaningful secondary descriptor. UUID is only the internal option value.

**Capability behavior:** menu item, route and actions use the shared `ApplicationAlias` ability. Backend permission remains authoritative; a direct URL/API call without the capability returns 403.

**Scope explanation:** because this page lives under an Instance shell while the alias namespace is deployment-global, `ViewHeader` help/description explicitly states in EN/RU that these addresses apply to the whole deployment and are not owned by the selected Instance. Browser coverage opens the page through two Instance contexts and proves the same global dataset is shown.

**Table behavior:** server-side search covers the human address plus safe human application/metahub/publication labels, with explicit loading/error/empty states. Row actions reuse the existing `BaseEntityMenu`/shared action-menu pattern for Rename, Set primary and Release; state columns use localized text/Chips rather than raw enum values.

### Marketing image widget settings

**User role:** normal metahub/application layout author with the existing layout-management permission for that surface.

**Widget:** generic static-config `marketing.image` in `marketing-main`.

**Persisted settings shape:** reuse `marketingMediaSchema` rather than defining
a parallel image shape: `kind`, typed `resource`/`ResourceSource`, localized
`alt`, `decorative`, and optional dimensions. Constrain this widget's first
version with a widget-level refinement to a `ResourceSource` with `type: 'url'`
and `launchMode: 'inline'`. Reuse `safeExternalUrlSchema` for canonical parsing,
then add a widget/publish refinement that requires HTTPS for publishable remote
media. If the existing development URL policy needs clear-text HTTP for local
authoring, allow only an explicit loopback development exception
(`localhost`/`127.0.0.1`/`[::1]`) rather than arbitrary production HTTP. Empty/
incomplete media may exist only in local dialog draft; never serialize a fake
`{ type: 'url', url: '' }` value or save an active image widget without a valid
media payload.

**Author guidance:** reuse the existing `MarketingWidgetConfigDialog` /
`StandardDialog` surface and add a localized informational block that recommends
a wide image, preferably **16:9**, around **1600×900 or larger**, WebP/JPEG/PNG,
an optimized file size, and a publicly reachable HTTPS URL. This remains
guidance for the URL-only MVP and does not introduce upload/media-library
behavior.

**Visible fields:**

-   localized informational guidance describing recommended image aspect/quality and that the current MVP uses an external image URL;
-   URL field backed by `resourceSourceSchema` with `{ type: 'url', url, launchMode: 'inline' }`;
-   `Decorative image` switch and, only when non-decorative, localized alt-text
    editors using the normal locale authoring contract;
-   preview and localized load/error state.

**Validation:** absolute safe external URL, no credentials, max URL length
inherited from `safeExternalUrlSchema`, HTTPS for publishable remote media, and
only the explicitly supported loopback HTTP development exception if required;
no raw internal messages.

**Preview behavior:** a syntactically valid safe URL may still be saved when
the remote preview fails to load; preview failure is a localized non-blocking
warning because transient remote availability is not a stable authoring
validation rule. Missing required alt for a non-decorative image remains a
blocking validation error.

**Network boundary:** the URL-only image setting is a browser-rendered media
reference. The authoring/backend path must not fetch, proxy, HEAD-probe, resize,
inspect, or otherwise dereference an arbitrary author-supplied image URL on the
server. Preview/runtime loading stays client-side through the existing safe
media renderer; this avoids turning image configuration into an SSRF surface.

**Runtime:** reuse `MarketingMediaView` and safe external URL behavior, including `referrerPolicy='no-referrer'` where applicable. Preserve the reference MUI Hero image geometry at 1920, 768 and 390 widths.

### Anonymous public runtime

**User role:** anonymous visitor.

**Locale bootstrap:** reuse/extend the existing anonymous locale resolver: an
explicit `?locale=` choice wins, then persisted `i18nextLng`, browser languages,
document language and finally English. Resolve locale before the first content
request, include it in the TanStack Query identity and synchronize `<html lang>`
so RU does not flash EN while the authenticated profile is unavailable. Extend
the existing `resolvePublicGuestRuntimeLocale()` utility with the published
content-locale allowlist instead of implementing another locale-selection
algorithm.

**Visible states:**

-   loading: neutral shell/skeleton with no private-resource metadata;
-   public page: normal published application;
-   canonicalizing: history replacement occurs without rendering an intermediate
    private/not-found/login state;
-   unavailable: one localized `Application is not publicly available`/404-style
    page for unknown/private/deleted/archived/unpublished/unready references,
    with the same Home and optional Sign in actions in every such case;
-   transient network/server failure: localized retry state distinct from the
    resource-unavailable 404, because retrying an infrastructure failure does not
    reveal whether a private application exists.

No automatic login redirect is based on public resource existence. An explicit
Sign in action is user-initiated and is rendered consistently for the generic
unavailable state.

Reuse the existing shared error/alert/page-state primitives where they satisfy
this contract; add only the thin public-runtime state adapter and localized
copy needed to distinguish unavailable from retryable network failure. Do not
create a parallel design system or bespoke landing error framework.

**Security UX:** no management controls, workspace picker used as authorization, raw IDs, schema names, hashes, JSON, or internal error codes.

**Accessibility/responsive:** preserve marketing template landmark/focus behavior, EN/RU content/chrome, keyboard operation and no page-level overflow at the required viewport matrix.

## Step-by-step implementation plan

### Phase 0 — Preflight, provenance and dependency gate

-   [ ] Re-run focused source inventory before edits and use OntoIndex impact analysis for every function/class/method that will be changed, especially route creation, effective-layout resolution, workspace binding, application create/update/copy and admin permission functions.
-   [ ] Record the exact hash/revision of `.backup/Лендинг-для-Консорциума.md` as the working RU product-copy source for this fixture. If an authoritative memorandum revision is available during implementation, record it as supporting provenance for the claims it verifies; do not make fixture mechanics depend on an unrelated missing document.
-   [ ] Generate the EN product copy from that Russian draft and review it for semantic/factual parity: preserve names, funding ranges, periods and qualifiers; do not add claims that are absent from RU. Product facts must never fall back to MUI demo text.
-   [ ] Classify CTA/contact fields before generation. Real approved destinations are emitted; placeholders such as `info@...`, `Telegram: ...` and `VK: ...` are omitted/disabled and never turned into clickable fake links.
-   [ ] Patch centralized Router dependencies first: move `react-router` and `react-router-dom` v6 to `6.30.6` (or a later compatible v6 patch if one exists at implementation time), remove the forced `@remix-run/router@1.23.2` override when possible and verify the resolved lock uses at least patched `1.23.4`; do not import `@remix-run/router` directly. Regenerate the lockfile through pnpm, then run focused router/type/build tests.
-   [ ] Preserve the existing MUI 9.2.0 and TanStack Query catalog model in `pnpm-workspace.yaml`; do not add package-local version pins.
-   [ ] Add plan-time/implementation-time checks proving `apps-template-mui` isolation remains intact.

**Exit gate:** dependency graph is patched and reproducible; content provenance inputs are explicitly classified as approved, omitted, or pending.

### Phase 1 — Shared identity, alias and widget contracts

-   [ ] Add `ApplicationAlias` to `Subjects`, `applicationAliases -> ApplicationAlias` to `ABILITY_MODULE_TO_SUBJECT`, and the corresponding permission-subject schema/tests.
-   [ ] Add the canonical alias grammar, UUID-shaped rejection and centralized reserved words to shared types/utils; add exhaustive normalization tests including casing, length boundaries, Unicode, controls, encoded delimiters and reserved routes.
-   [ ] Add typed `ApplicationAliasRoutingMode = 'direct' | 'canonical'` and public route-resolution DTO types.
-   [ ] Extend `MarketingWidgetRegistryEntry` with an explicit ownership discriminator such as `dataOwnership: 'entity' | 'static' | 'none'`.
-   [ ] Register `marketing.image` as repeatable/static in `marketing-main`; keep entity-backed widgets strict and `marketing.auth` as `none`.
-   [ ] Make widget config schemas discriminated/exhaustive so `entity` requires `source`, `static` rejects entity source and accepts typed settings, and `none` rejects both unless explicitly defined.
-   [ ] Add contract tests proving every marketing registry key has one ownership mode and that unknown/static/entity combinations fail closed.

**Exit gate:** all later layers consume one typed alias contract and one typed marketing ownership model.

### Phase 2 — Clean application schema and alias persistence

-   [ ] Remove `slug` from `applications.obj_applications` baseline DDL, its indexes and application system definition.
-   [ ] Remove `slug` from application persistence records, search, create/update/copy inputs/responses, `findApplicationBySlug()`, frontend application API/shared types, linked-publication creation, fixtures and E2E bookkeeping.
-   [ ] Remove frontend shell consumers of the old application slug explicitly, including the `NavbarBreadcrumbs` fallback and `ApplicationDisplay`/menu DTO fields. If an application name is unavailable, show a localized neutral `Application / Приложение` label rather than UUID or removed slug. Preserve guest access-link `:slug` routes because they are a different domain contract.
-   [ ] Change release/sync/application-key construction from `application.slug ?? application.id` to immutable application UUID and add regression tests proving aliases never influence release identity.
-   [ ] Add `obj_application_aliases` plus an explicit constrained application `alias_routing_mode` column to the current clean baseline using the repository's canonical UUID v7 generation path, parameterized SQL stores and `RETURNING`/zero-row fail-closed mutations.
-   [ ] Add global **unreleased-name reservation** uniqueness (`released_at IS NULL`, independent of soft-delete flags) plus partial one-primary-per-application indexes; use `ON DELETE RESTRICT` for application ownership.
-   [ ] Implement store/service APIs for list/create/update-or-rename/release/set-primary/set-policy/resolve-ref with normalized inputs only.
-   [ ] Serialize primary changes per application inside one transaction; let unique indexes arbitrate races and map constraint conflicts to stable domain errors.
-   [ ] Keep aliases reserved across archive/soft-delete; test that application lifecycle changes disable routing without freeing alias claims.
-   [ ] Add real PostgreSQL concurrency tests for duplicate claims and competing primary changes.

**Exit gate:** the clean database has no application `slug`; UUID is the only internal application identity and aliases are a separate constrained routing resource.

### Phase 3 — Capability-based alias RBAC and management API

-   [ ] Add `applicationAliases` to the normal assignable permission-subject contracts in shared types, admin request validation and the existing `PermissionMatrix`; map it to CASL subject `ApplicationAlias`. Add localized EN/RU subject/help text instead of creating a role-specific switch.
-   [ ] Seed **no new alias-management role and no non-Superuser alias grant**. Keep root `Superuser` access through the existing `isSuperuser()` bypass, so the initial installation meets the requirement without another system role.
-   [ ] Deliberately extend `ADMIN_PERMISSION_SUBJECTS` and database `admin.has_admin_permission()` so `applicationAliases:read` or wildcard permission can enter the Admin shell and reach Slugs. A delegated role with only alias capability must not need an unrelated `roles`, `instances` or `users` permission.
-   [ ] Make `applicationAliases` assignable to both editable custom roles and the default non-Superuser system roles. Reuse the existing RoleEdit/PermissionMatrix surface: permit root `Superuser` to change the **permissions only** of `Registered`/`User` while preserving their codename, `is_system`, `is_superuser`, deletion and lifecycle protections; keep the `Superuser` system role immutable.
-   [ ] Harden role create/copy/update with one centralized server-side delegation guard evaluated inside the same transaction as the permission replacement. Root `Superuser` may grant any non-root permission; a non-Superuser actor may grant only permissions already inside their own effective privilege envelope, may not create/set `isSuperuser`, and may not manufacture `*:*` or broader wildcard coverage. Apply the same rule to `applicationAliases` so `roles:create/update` alone cannot self-escalate.
-   [ ] For the first `applicationAliases` contract, reject permission `conditions` / field restrictions unless backend `admin.has_permission()` is extended to enforce exactly the same semantics as CASL. Prefer simple subject/action CRUD grants in this slice so frontend and backend cannot disagree about authorization.
-   [ ] Serialize each role permission-set replacement (`SELECT ... FOR UPDATE` or the repository's advisory-lock pattern) before delegation validation + soft-delete/insert replacement, so concurrent role editors cannot merge or overwrite privilege sets unpredictably.
-   [ ] Keep alias persistence/service/management routes in `@universo-react/applications-backend`, which already owns the application schema and depends on the admin permission helpers. Protect each authenticated alias-management action with root `Superuser` bypass or `hasSubjectPermission(..., 'applicationAliases', action)`; do not authorize by application owner/admin membership. `admin-backend` owns permission metadata, shell admission and role-grant governance, not application alias storage.
-   [ ] Add direct tests for root Superuser CRUD, delegated custom-role CRUD when the exact capability is granted, delegated default-role access after a Superuser grant, the same roles without capability returning 403, application owner/admin denial without capability, admin-shell entry from `applicationAliases:read`, privilege-envelope delegation, blocked self-grant/wildcard/isSuperuser escalation through create/copy/update, and concurrent role-permission edits.

**Exit gate:** alias management has one backend-authoritative capability model shared by admin shell and API.

### Phase 4 — Public workspace and readiness state machine

-   [ ] Extend `_app_workspaces` runtime DDL with the public-entry designation and partial uniqueness invariant; keep the per-user `_app_workspace_user_roles.is_default_workspace` semantics unchanged.
-   [ ] Add service-level mark/unmark/validate operations that reject personal/inactive/deleted workspaces and perform updates transactionally.
-   [ ] Define a pure readiness classifier over application lifecycle, `is_public`, publication state, schema status, installed materialization/release and layout validity.
-   [ ] Implement `synced` eligibility and explicit fail-closed behavior for `draft|pending|maintenance|error`.
-   [ ] For `outdated|update_available`, require a proved coherent installed release/materialization identity and ensure all reads resolve against that installed state; otherwise return unavailable.
-   [ ] Add table-driven Jest tests covering every status/lifecycle combination and regression tests ensuring `activeAppRowCondition()` alone cannot authorize public runtime.

**Exit gate:** public eligibility is a documented server state machine, not an incidental frontend/runtime heuristic.

### Phase 5 — Transaction-pinned anonymous published-read service

-   [ ] Extract the canonical effective-layout selection logic into a shared core that accepts an already-authorized execution context; retain authenticated membership/workspace behavior in an authenticated adapter.
-   [ ] Add a public adapter that receives a prevalidated public application plus server-selected public-entry workspace and never fabricates a user/membership.
-   [ ] Start one `DbExecutor.transaction(...)` before workspace resolution/binding and use that exact executor for `set_config`, effective layout and renderer reads.
-   [ ] Refactor reusable low-level helpers from `publicRuntimeAccess.ts` so they return typed results/errors without directly writing 400/403/404 responses; existing guest behavior may adapt its own external errors separately.
-   [ ] Add an anonymous public bootstrap route that resolves UUID/alias, applies readiness, selects public workspace, resolves effective layout and loads only allowlisted renderer data.
-   [ ] Define the anonymous renderer transport contract for every read required after bootstrap. Prefer a self-contained bootstrap for the first marketing-page slice; where a follow-up read is unavoidable, expose a dedicated allowlisted public read endpoint/service that re-enters the same readiness + server-owned workspace + transaction-pinned RLS boundary for that request. Do not proxy or internally forward to authenticated runtime handlers.
-   [ ] Keep the public bootstrap authorization-independent from ambient login cookies: an authenticated browser receives the same public resolver result as an anonymous browser for the same ref. Private fallback is a separate authenticated request/path, never a privilege-aware branch inside the public endpoint.
-   [ ] Mount the anonymous bootstrap and any public follow-up reads behind the existing applications read-rate limiter (or an equivalent shared limiter). Parse `applicationRef` through one bounded discriminator before database access: accept only a canonical UUID or an alias within the 1–63 ASCII contract, reject malformed/overlong/encoded-delimiter input without attempting SQL lookup, and bound all other public query/path parameters. Keep unavailable responses status/body-contract equivalent across unknown/private/unready causes.
-   [ ] Set an explicit conservative cache policy on the mutable public bootstrap/resolution response (`Cache-Control: no-store` for this slice) so a later Public → Closed/readiness change is not defeated by browser/proxy reuse of a previously public JSON response. Revisit shared/CDN caching only with versioned immutable publication keys and an explicit invalidation contract.
-   [ ] Treat application schema/workspace identifiers used by public reads as server-owned database values only and pass dynamic identifiers through the repository's `qSchema`/`qTable`/`qColumn` helpers; no request text becomes a SQL identifier.
-   [ ] Build an explicit public response serializer/Zod schema from allowed fields; never serialize authenticated effective-layout objects and redact afterward.
-   [ ] Normalize all public-unavailable causes to one external 404-style response and structured internal reason.
-   [ ] Add tests proving no schema name, source IDs, hashes, publication lineage, memberships, owner data or write capabilities escape.
-   [ ] Add same-transaction tests proving `set_config('app.current_workspace_id', ..., true)` and subsequent RLS-bound reads use the same transaction executor.

**Exit gate:** an anonymous request can render only a deliberately public, ready, published application through a minimal read model.

### Phase 6 — Frontend `/a/:applicationRef/*` resolver and isolated anonymous client

-   [ ] Patch `createAppRuntimeRoute` / core route composition to introduce one public-aware application-ref entry outside `AuthGuard` without competing wildcard routes.
-   [ ] Keep `/a/:applicationId/admin/*` as an authenticated **UUID-only** management surface. The public `:applicationRef` resolver hands a resolved UUID to the existing authenticated runtime only after a separate authenticated authorization resolution; an alias string is never passed to `ApplicationGuard` as if it were an application UUID.
-   [ ] Add an explicit route-precedence regression proving `/a/<uuid>/admin/*` always selects the authenticated management branch and is never captured by the public `/a/:applicationRef/*` entry. Alias URLs may use `admin` as an ordinary runtime subpath only where they do not match the UUID-only management route.
-   [ ] Keep the existing `/public/a/:applicationId/links/:slug` guest/access-link frontend/backend flow separate and unchanged except for mechanical type cleanup required by removing the old application-level slug.
-   [ ] Create dedicated anonymous runtime API functions/query keys that call only the public bootstrap/read namespace.
-   [ ] Refactor the marketing runtime host boundary so public rendering cannot silently reuse `MarketingRuntimeContent`'s current authenticated `fetchMarketingPageRuntime()` path. Prefer transport injection/preloaded renderer data at the host boundary so `apps-template-mui` remains endpoint-agnostic; keep the authenticated host on the existing authenticated transport and pass the anonymous host only public bootstrap/read transport.
-   [ ] Keep authenticated runtime routing behind current Auth/Application/Migration guards for private applications and authenticated management.
-   [ ] Preserve remaining subpath and query when canonicalizing a secondary alias; construct the destination from validated server alias token plus current relative route state only.
-   [ ] Use `Navigate`/`useNavigate(..., { replace: true })` for mutable SPA canonicalization; if a server redirect path is later needed, use a server-owned relative 307.
-   [ ] Ensure anonymous code never forwards `workspaceId` and never calls authenticated `/applications/:id/runtime/*` endpoints.
-   [ ] Add component/network tests for UUID, primary alias, direct secondary alias, canonical secondary alias, logged-in private fallback and anonymous unavailable state.

**Exit gate:** `/a/<uuid-or-alias>` resolves deterministically without leaking private application existence or mixing public/authenticated clients.

### Phase 7 — Alias administration UI with TanStack Query

-   [ ] Make the application domain the single frontend owner of alias transport/cache state **and** the centralized Slugs page component: add/export `applicationAliasesApi.ts`, canonical alias query keys, reusable hooks and the page from `@universo-react/applications-frontend`; mount that page through the core Admin/Instance route shell. `admin-frontend` supplies existing role/admin utilities only; do not create a second alias API/cache/page implementation there.
-   [ ] Reuse the existing `@universo-react/store` `useHasGlobalAccess().ability` contract inside Applications-owned Addresses/Slugs components. Keep admin-frontend `useAdminPermission` as the adapter for admin/core-shell menu, route, or action integration where that package already owns the surface. Do **not** introduce an `applications-frontend -> admin-frontend` dependency solely for alias authorization, and do not create a second global-ability hook or permission context. Extend the shared subject typing/mapping for `ApplicationAlias` once.
-   [ ] Define canonical query families for `lists`, `byApplication(applicationId)`, `policy(applicationId)` and route-resolution data, with one invalidation helper used by create/rename/release/set-primary/set-policy mutations across both surfaces.
-   [ ] Add edit-only Addresses tab to `ApplicationActions.tsx` after Parameters. Fetch/manage aliases independently from `ApplicationFormValues` and generic application save.
-   [ ] Extend shared `EntityFormDialog`/`TabConfig` with the generic independent-tab footer contract defined in the UI Contract so Addresses has Close-only outer actions and its CRUD dialogs own their mutations. Add the missing generic dirty-form contract at the same shared layer: initial snapshot + `isDirty`, one `requestClose` path for Close/Escape/backdrop, and the shared discard confirmation before unsaved form values are dropped.
-   [ ] Add the Slugs page under `/admin/instance/:instanceId/slugs`, plus lazy route, menu item below Locales, breadcrumb, permission-gated navigation and direct route guard.
-   [ ] Reuse `ViewHeader`, `ToolbarControls`, `FlowListTable`, `StandardDialog` and the shared destructive confirmation primitive.
-   [ ] Gate both UI surfaces with the shared ability check for `ApplicationAlias` (and keep `useAdminPermission` as the admin-facing adapter where appropriate); do not use `useIsSuperadmin()` or application ownership as the permission source.
-   [ ] Reuse localized accessibility contracts instead of literal English defaults: add/extend generic `tabsAriaLabel` only where shared `EntityFormDialog` lacks one, pass a localized `tableAriaLabel` to the Slugs table, label copy/edit/set-primary/release controls, and verify nested dialog focus returns to the invoking control. While reusing `ViewHeader`, replace its current hard-coded mobile-search `Open search` accessible name with a localized shared label contract on these surfaces; cover the existing literal `Back`/`Edit` labels too if those controls are rendered here.
-   [ ] Add EN/RU strings for titles, help, policy modes, validation, conflict/release/primary states and unavailable errors in the correct common/feature namespaces.
-   [ ] Add Vitest/RTL/Jest tests for permission visibility, edit-only tab behavior, dirty-form discard semantics, query invalidation, human-readable selectors, localized validation/ARIA, keyboard/focus, long alias rendering and no raw UUID/JSON leakage outside the explicitly labeled technical-address control.

**Exit gate:** root `Superuser` and any role explicitly granted the required `ApplicationAlias` action can operate on the same alias resource from both UI surfaces; roles without that capability and application owners/admins without it cannot discover privileged controls or mutate through the API.

### Phase 8 — Generic static marketing image widget and Hero ownership cleanup

-   [ ] Add `marketing.image` config schema by reusing existing `marketingMediaSchema` (`kind + resource + localized alt + decorative + optional dimensions`) inside static widget settings, with a widget-level refinement that requires `resource.type === 'url'`, `launchMode === 'inline'`, and HTTPS for publishable remote media. Reuse shared URL parsing and, only if the current development contract needs it, permit a narrowly scoped loopback HTTP authoring exception; do not accept arbitrary remote HTTP, file/media-library/stored-resource variants, or a second parallel media model.
-   [ ] Refactor `MarketingWidgetConfigDialog` around the registry ownership discriminator:
    -   `entity`: current entity datasource selector + entity settings;
    -   `static`: typed settings only, no fake entity source;
    -   `none`: control settings only.
-   [ ] Add localized image guidance, URL field, preview/load failure and alt/decorative semantics using existing MUI/StandardDialog primitives and existing localized-inline-field behavior. An incomplete media value may exist only as local dialog draft; saving an active image widget requires a valid URL plus valid decorative/alt semantics.
-   [ ] Move every shared `layouts.marketing.widget.*` label/help/validation string needed by both metahub and application layout authoring to one EN/RU common namespace in `@universo-react/i18n`; remove new duplicate feature-local definitions rather than allowing the two authoring surfaces to drift.
-   [ ] Materialize/transport static widget config through metahub layout → publication snapshot → application layout without inventing an Object entity.
-   [ ] Add renderer/normalizer support in isolated `apps-template-mui`; reuse `MarketingMediaView`, safe URL parsing and `referrerPolicy='no-referrer'` behavior.
-   [ ] Keep arbitrary configured image URLs out of backend network sinks: saving, validating, previewing and publishing this URL-only widget must not cause a server-side fetch/proxy/HEAD request. Add a focused regression test around the authoring/publication boundary so later media work cannot silently introduce SSRF-prone URL dereferencing.
-   [ ] Add negative schema/authoring coverage proving `marketing.image` rejects `file`, `storageKey`, media-library/stored-resource variants, every non-URL `ResourceSource`, and arbitrary clear-text remote HTTP in publishable configuration; the first-version editor exposes no upload/file/media-library or separate dark-image picker.
-   [ ] Remove `HeroLightPreview` / `HeroDarkPreview` components, seed values, source-field mappings, site-settings schemas, normalization/materialization branches, Hero renderer media, tests and fixture expectations.
-   [ ] Keep Hero copy/actions entity-backed while the new image widget becomes the single media owner.
-   [ ] Move the existing Hero image-frame presentation contract (height, margins, border/outline, shadow, clipping, dark-mode treatment) into the generic image-widget presentation instead of losing it with the Hero media fields.
-   [ ] Make main-zone separator/composition behavior registry/presentation-driven so splitting `hero -> image` does not cause the existing automatic `Divider` orchestration to insert a visual separator that was absent in the original MUI Hero. Do not hardcode a one-off `if nextWidget === marketing.image` branch.
-   [ ] Preserve the original MUI image frame geometry/spacing/background ownership through composition, including desktop/tablet/mobile browser screenshots.

**Exit gate:** central media has one generic static widget owner and no parallel Hero preview path remains.

### Phase 9 — Generate the 73rd Meridian Consortium product fixture

-   [ ] Add a product-specific approval/provenance manifest beside the generator/contract. Record the `.backup/Лендинг-для-Консорциума.md` hash/revision as the working RU source, any supporting authoritative memorandum revision available for claim verification, EN translation-review status, CTA/contact destinations, media source/rights, and the temporary MUI `dashboard.jpg` exception. Do not confuse this editorial provenance with the existing technical `marketingProvenance` lineage fields.
-   [ ] Add one content-definition module for the generator. RU copy comes from the landing draft; EN copy is a faithful translation of the same records, with review/tests ensuring equivalent factual meaning and no added claims.
-   [ ] Resolve editorial alternatives deterministically in that content definition. Use the draft's investment-oriented Hero headline `73-й Меридиан — новый индустриально-логистический коридор Север–Юг` as the first fixture headline and translate that same selected record into EN; keep the alternative `Создаём цифровой каркас новой Евразии` as source/editorial material rather than emitting two competing Hero headlines.
-   [ ] Start from the built-in `marketing-page` template and author through real APIs, following the Interpretation Network generator pattern rather than manually editing a hash-bearing JSON snapshot.
-   [ ] Remove MUI demo companies/logos/testimonials/pricing/fake SaaS copy from the product configuration.
-   [ ] Map the draft explicitly to generic records/widgets and stable navigation anchors: Hero → Partner ecosystem → Areas of activity → Expert vision → Why 73rd Meridian → Pre-seed/Seed/Growth → FAQ → Contacts. Reuse existing generic collection/card/content shapes; do not create Consortium-specific React components.
-   [ ] Generate navigation only for populated, stable sections. The draft mentions `Команда / Team` in its suggested menu but contains no team section; omit that navigation item in the first fixture instead of inventing team content or a dead anchor. Add a product contract asserting that every emitted internal navigation anchor resolves to a rendered section.
-   [ ] Generalize the marketing anchor safety contract for repeatable widget instances before emitting product navigation. Rendered repeated widgets already use `marketingSectionId(<kind>, instanceKey)`, while the current `isSafeSectionHash()` accepts only fixed canonical anchors. Derive/validate navigation anchors against the actual active rendered widget section IDs (or an equivalent typed registry projection) so repeated sections remain addressable without accepting arbitrary hashes. Reuse this generic contract for desktop and drawer navigation; do not special-case Consortium anchor strings.
-   [ ] Replace customer-logo semantics with the draft's partner-ecosystem **categories** rather than invented customers/logos. Replace testimonials with neutral `Expert vision` editorial cards and no fabricated people, avatars, positions, personal quotations, or organizations. Represent Pre-seed/Seed/Growth as `marketing.collection` highlights.
-   [ ] Omit `marketing.pricing` from the Consortium layout.
-   [ ] Do not publish draft contact placeholders (`info@...`, `Telegram: ...`, `VK: ...`) or empty CTA destinations as functional links. Omit/disable those actions until a real destination is recorded in provenance.
-   [ ] Add the new `marketing.image` widget with the existing MUI `https://mui.com/static/screenshots/material-ui/getting-started/templates/dashboard.jpg` URL as the requested temporary editable placeholder.
-   [ ] Export/canonicalize the snapshot and commit `tools/fixtures/metahubs-73rd-meridian-app-snapshot.json`.
-   [ ] Register the file in shared `snapshotFixtures.test.ts` envelope validation.
-   [ ] Add a product-specific contract asserting characteristic Consortium content, absence of MUI demo content, correct marketing composition, placeholder image config, publication/application materialization and export/import round-trip equivalence.
-   [ ] Keep the existing generic `marketing-page-snapshot-roundtrip` assertions generic and MUI-baseline-oriented; Consortium-specific absence/presence assertions belong in the new product contract/E2E instead of weakening the reusable template oracle.

**Exit gate:** fixture is reproducible from authoring APIs, RU/EN product records are traceable to one Russian source draft with translation parity, placeholders do not become fake public contacts, and the product-specific test proves behavior rather than only envelope validity.

### Phase 10 — Deep verification system

#### Jest backend/control-plane

-   [ ] Application alias store/service: normalization boundary, CRUD/release, primary, policy, UUID v7, constraint mapping, archive reservation, no legacy slug.
-   [ ] PostgreSQL integration: global alias collision, unreleased-name reservation surviving soft-delete/archive, primary partial index, concurrent claim/set-primary, explicit release/reclaim, FK/purge restriction.
-   [ ] Alias RBAC: root Superuser bypass; custom/default role allow after explicit `applicationAliases` grant; equivalent role deny without the capability; application owner/admin deny without it; admin-shell predicate; direct 403; privilege-envelope delegation; blocked self-grant/wildcard/isSuperuser escalation through create/copy/update.
-   [ ] Public readiness truth table and non-enumerating error mapping.
-   [ ] Transaction-pinned public workspace/RLS behavior.
-   [ ] Public DTO allowlist and no internal metadata leakage.
-   [ ] Public bootstrap cache-policy test proving mutable availability/readiness responses are emitted with `Cache-Control: no-store` and cannot be satisfied from an intermediary cache contract defined by this application.
-   [ ] Effective-layout authenticated/public adapter parity over the same canonical selection core.
-   [ ] Metahub template manifest/static-widget/snapshot materialization tests.

#### Vitest/RTL and shared MUI Jest

-   [ ] Shared types alias/ownership schemas.
-   [ ] Applications/Admin frontend query hooks, tab/menu capability visibility, dialogs and localized validation.
-   [ ] `MarketingWidgetConfigDialog` exhaustive entity/static/none ownership behavior.
-   [ ] `apps-template-mui` image normalization/renderer/loading/error/accessibility behavior.
-   [ ] Core route-entry resolver and canonical history replacement.
-   [ ] Route-precedence tests for `/a/<uuid>/admin/*` versus the public ref wildcard, including direct navigation and refresh, so the management surface can never lose `AuthGuard` because of route composition changes.
-   [ ] Explicit network-client tests proving anonymous adapter never constructs authenticated runtime URLs or `workspaceId` authority.
-   [ ] Public follow-up read tests (when any exist) proving each read independently re-applies public readiness, server-selected public workspace, transaction-local RLS binding, allowlisted serialization, generic unavailable mapping and `Cache-Control: no-store`; a Public → Closed/readiness change after bootstrap must make the next public read fail closed.
-   [ ] Marketing navigation contract tests proving canonical and repeated-instance section hashes are accepted only when they correspond to active rendered marketing widgets; unknown/arbitrary hashes still fail closed.

#### Playwright on minimal local Supabase

Use the repository wrapper and the dedicated E2E app at `http://127.0.0.1:3100`; do not run `pnpm dev`.

-   [ ] Add a focused verification wrapper that starts `pnpm supabase:e2e:start:minimal`, prepares `.env.e2e.local-supabase`, runs doctor/build/targeted suites, collects artifacts and stops Supabase in `finally`.
-   [ ] Anonymous clean browser context with no authenticated `storageState`: public UUID succeeds without auth cookies/local storage and locale bootstrap does not flash the wrong language.
-   [ ] Private/unknown/deleted/archived/unpublished/unready/malformed refs have the same status/page contract and do not redirect in a resource-enumerating way.
-   [ ] Alias matrix: primary, direct secondary, canonical secondary, path/query preservation, mutable primary, reserved/duplicate/UUID-shaped validation.
-   [ ] Browser network oracle: anonymous page issues no authenticated `/applications/:id/runtime/*` request and no visitor workspace selector can change public data.
-   [ ] RBAC matrix: root Superuser CRUD/set-primary/policy; a custom role and a default non-Superuser role with the exact capability succeed; the same roles without it plus application owner/admin fail with hidden controls and direct API 403.
-   [ ] Verify `applicationAliases:read` admits a delegated role to the Admin shell, existing RoleEdit/PermissionMatrix can represent the permission, root Superuser can grant it to eligible default/custom roles, and a non-Superuser role editor can delegate only permissions already inside their own effective privilege envelope rather than self-escalating through create/copy/update paths.
-   [ ] Image authoring: open layout settings, inspect guidance, replace URL, verify localized validation/preview/error/persistence/publication/runtime rendering.
-   [ ] Image network-safety regression: configure a syntactically valid external URL and prove the authoring/backend publication flow does not dereference it server-side; the browser runtime/preview remains the only media loader for this MVP.
-   [ ] Consortium generated fixture: import → publish → linked application → sync/readiness → anonymous runtime → export/import round trip.
-   [ ] Assert MUI fake companies/testimonials/pricing are absent from Consortium runtime.
-   [ ] Assert every emitted Consortium internal navigation link targets a real rendered section and that the unpopulated `Team / Команда` item is absent.
-   [ ] Anonymous public runtime visual matrix: EN/RU × light/dark × `1920x1080`, `768x1024`, `390x844`, using full-page plus focused Hero/image-band screenshots, Axe, keyboard, technical-leakage and overflow oracles.
-   [ ] Addresses visual matrix: EN/RU desktop/tablet/mobile (`1920x1080`, `768x1024`, `390x844`), covering list, add/edit dialog, set-primary confirmation, release confirmation, empty/loading/error/validation states and Close-only outer footer semantics.
-   [ ] Slugs visual matrix: EN/RU at desktop/tablet/mobile (`1920x1080`, `768x1024`, `390x844`), proving canonical `FlowListTable` appearance, constrained local table overflow where needed, no page-level overflow, long aliases, human application disambiguators and hidden denied-capability route/menu.
-   [ ] Marketing image authoring visual matrix in **both** metahub and application Layout settings: EN/RU desktop/mobile, including URL, decorative/non-decorative alt semantics, preview failure, localized validation and persisted reload.
-   [ ] Use semantic locators and real keyboard flows for tabs, dialogs, application selector, set-primary and release confirmation.
-   [ ] Exercise every Consortium header/drawer internal navigation item by keyboard and click; verify it reaches the intended rendered section, repeated-instance anchors work, the mobile drawer closes, and no dead/unsafe hash survives validation.
-   [ ] Run axe checks on the new admin dialogs/pages and anonymous landing surface.
-   [ ] Assert no page-level horizontal overflow and no raw UUID/JSON/internal tokens in normal user-facing text, with one narrow oracle exception for the explicitly labeled read-only `Technical address / Технический адрес` value and its copy action.
-   [ ] Dirty-form regression: edit General/Parameters, visit Addresses, perform an alias mutation, then Close/Escape; verify discard confirmation protects the unsaved application form while the already completed alias mutation remains persisted.
-   [ ] Instance-shell scope regression: open the Slugs page from two Instance contexts and verify the same deployment-global alias dataset plus localized global-scope explanation.
-   [ ] Capture reviewable screenshots for Addresses tab, Slugs page, image settings and anonymous Consortium page at the required viewports/locales.
-   [ ] Inspect the actual screenshot artifacts with an image viewer before acceptance; screenshot generation alone is not visual proof.

#### Suggested focused commands after implementation

```bash
pnpm --filter @universo-react/types test
pnpm --filter @universo-react/utils test
pnpm --filter @universo-react/applications-backend test
pnpm --filter @universo-react/admin-backend test
pnpm --filter @universo-react/template-mui test
pnpm --filter @universo-react/applications-frontend test
pnpm --filter @universo-react/admin-frontend test
pnpm --filter @universo-react/apps-template-mui test
pnpm --filter @universo-react/metahubs-backend test
pnpm run check:snapshot-fixtures-contract
pnpm run check:apps-template-isolation
```

For browser acceptance, prefer a dedicated new wrapper analogous to `test:e2e:marketing-page:verify:local-supabase` so startup/reset/build/artifact/cleanup semantics remain centralized. Direct `pnpm exec playwright test` is debug-only because it bypasses the repository reset contract.

**Exit gate:** focused unit/integration suites and the browser/security/visual matrix pass with inspected artifacts; no acceptance claim is based on unit tests alone.

### Phase 11 — Documentation and package contracts

-   [ ] Update `packages/universo-react-applications-backend/README.md` and RU counterpart with public published-read boundary, public workspace rule, alias identity separation and security contract.
-   [ ] Update `packages/universo-react-applications-frontend/README.md` / RU with Addresses, public route resolution and TanStack Query ownership.
-   [ ] Update `packages/universo-react-admin-backend/README.md` / RU and `admin-frontend` README with capability-based alias administration, root-Superuser initial access, privilege-envelope delegation, default/custom-role behavior and the Slugs page.
-   [ ] Update `packages/universo-react-metahubs-backend/README.md` with static marketing widget ownership and generated Consortium fixture workflow.
-   [ ] Update `packages/universo-react-apps-template-mui/README.md` with anonymous renderer/client boundary and `marketing.image` behavior, preserving package-isolation language.
-   [ ] Update `packages/universo-react-template-mui/README.md` only for reusable authoring/navigation primitives actually added or extended.
-   [ ] Add paired EN/RU GitBook pages under `docs/en/` and `docs/ru/` covering:
    -   public vs closed applications and anonymous published runtime;
    -   application addresses/aliases and direct/canonical behavior;
    -   capability-based Slugs administration;
    -   marketing central image settings;
    -   generating/importing the 73rd Meridian product fixture where appropriate for contributors.
-   [ ] Register pages in both `docs/en/SUMMARY.md` and `docs/ru/SUMMARY.md` and maintain parity/local link checks.
-   [ ] Update the existing paired `docs/en/platform/marketing-page-template.md` / `docs/ru/platform/marketing-page-template.md` because the current documentation says marketing widgets use Object sources; document the new `entity | static | none` ownership contract and `marketing.image` specifically.
-   [ ] Update the existing paired `docs/en/platform/applications.md` / `docs/ru/platform/applications.md` with Public application behavior, technical UUID address and Addresses tab.
-   [ ] Update the existing paired `docs/en/platform/admin.md` / `docs/ru/platform/admin.md` with root Superuser initial access, assignable `ApplicationAlias` permissions, safe grant governance and centralized Slugs management.
-   [ ] Update OpenAPI/REST documentation/contracts for alias administration and anonymous public runtime endpoints, including the single public-unavailable outcome and dedicated authenticated admin errors.
-   [ ] Add screenshot provenance/asset checks if the new GitBook pages embed browser screenshots, following existing LMS/Interpretation Network patterns.

**Exit gate:** README responsibilities match code ownership, GitBook EN/RU content is navigable and screenshots are tied to real tested UI.

### Phase 12 — Final engineering QA and closeout

-   [ ] Run affected package lint/build/type checks and Prettier on changed files.
-   [ ] Run `git diff --check`.
-   [ ] Run OntoIndex `gn_verify_diff` / detect-changes and confirm expected blast radius only.
-   [ ] Run the project Thermos/autoreview quality gate over the complete implementation diff; fix CRITICAL/HIGH findings before considering the feature ready.
-   [ ] Re-run focused tests after review fixes and re-run the browser suite if user-visible or routing/security behavior changed.
-   [ ] Confirm no application `slug` fallback, Hero preview owner, MUI demo Consortium content, duplicate alias validator, unauthenticated authenticated-runtime API call, or package-isolation violation remains.
-   [ ] Confirm no metahub template/snapshot/application schema version field was incremented solely for this feature.

## Performance and security notes

### Query shape

-   Alias resolution is a single indexed lookup on normalized active alias plus one application join/readiness query; do not scan applications or aliases in memory.
-   Keep the public bootstrap bounded and prefer one server composition pass over multiple browser waterfalls for layout and marketing landing data.
-   Reuse canonical effective-layout selection and renderer loaders rather than duplicating a second marketing data engine.
-   TanStack Query cache keys must include only semantic request identity; anonymous cache identity must not accept arbitrary workspace IDs.

### Concurrency

Use both service serialization and database constraints:

```ts
await executor.transaction(async (trx) => {
    await lockApplicationAliasGraph(trx, applicationId)
    const alias = await requireOwnedActiveAlias(trx, applicationId, aliasId)
    await clearPrimaryAlias(trx, applicationId)
    await setPrimaryAlias(trx, alias.id)
    await validateCanonicalPolicyInvariant(trx, applicationId)
})
```

The lock avoids avoidable write races; the partial unique index remains authoritative if concurrent transactions still collide.

### Redirect safety

Return only client-needed routing metadata, not a redirect URL or hidden resolved
application identity. The server may use application UUID internally while
building the bootstrap, but an alias request does not need that UUID merely to
canonicalize:

```ts
type PublicRouteInstruction = { behavior: 'render' } | { behavior: 'canonicalize'; primaryAlias: string }
```

Frontend code constructs only `/a/${validatedPrimaryAlias}${remainingPath}${search}`. No client-supplied scheme, host, absolute URL or `next=` parameter participates.

### Error safety

Map internal domain reasons to one public outcome:

```ts
try {
    return await resolvePublishedApplication(input)
} catch (error) {
    logPublicRuntimeDecision(error) // structured internal reason, no secrets/PII
    throw new PublicApplicationUnavailableError() // stable external 404
}
```

Admin endpoints may expose stable localized validation/conflict codes because they are authenticated and permission checked, but should still never return raw SQL constraint text.

## Potential challenges and mitigations

### `slug` removal has a wide blast radius

The legacy field participates in release identity and many tests. Treat removal as one atomic identity refactor: baseline DDL → stores/controllers → publication linking → release/sync → frontend types → fixtures/E2E cleanup. A temporary fallback would defeat the clean-break requirement and can hide missed consumers.

### Public effective layout currently assumes authenticated membership

Do not add nullable `userId` branches throughout the existing resolver. Separate authorization adapters from the canonical selection core so authenticated and public flows share deterministic layout logic while keeping different authorization and DTO contracts.

### Transaction-local workspace state can silently fail across pool connections

Every anonymous workspace-bound read must occur in the same `DbExecutor.transaction` callback after `set_config(..., true)`. Add a test that would fail if a helper accidentally obtains a fresh executor.

### Alias permissions must stay capability-based without privilege escalation

Do not rely on `superadmin`/`supermoderator` codenames or `useIsSuperadmin()`. Map the dedicated capability through CASL and use the shared permission checks. Root `Superuser` is the initial operator through the existing bypass, while the permission can later be granted to any eligible default/custom role. A non-Superuser role editor may delegate only permissions already in their own effective privilege envelope, so generic role-edit access cannot bootstrap broader alias or root privileges.

### Static marketing widget crosses several validators

Ownership must be registry-driven across shared schemas, generic authoring, snapshot validation/materialization and runtime. Avoid making `source` globally optional; that would weaken every entity-backed marketing widget.

### Content provenance must not turn placeholders or translations into new claims

Use `.backup/Лендинг-для-Консорциума.md` as the working RU source for the first product fixture and derive EN from it faithfully. Record the RU file revision/hash and translation-review status. If stronger source documents are available, attach them as supporting provenance for individual claims; do not invent missing contacts, CTA destinations, partners, endorsements, or extra facts merely to fill the original MUI sections.

## Acceptance criteria

The feature is ready for IMPLEMENT closeout only when all of the following are true:

-   [ ] Fresh database bootstrap contains no application `slug` column/index/contract and all internal release identity is UUID-based.
-   [ ] Alias registry enforces normalized global unreleased-name uniqueness even across application/alias soft-delete, one active primary max, explicit release and no cascade-based reuse.
-   [ ] A released alias is never primary, and canonical-mode release/primary/policy transitions preserve exactly one active primary whenever aliases remain.
-   [ ] Root `Superuser` can manage aliases immediately; any eligible default/custom role can do so only after the required `ApplicationAlias` action is explicitly granted; roles and application owners without that capability are denied in both UI and API.
-   [ ] Anonymous public runtime renders public ready applications without authentication and exposes no authenticated-management surface or internal DTO metadata.
-   [ ] Anonymous bootstrap and every required follow-up renderer read use only the dedicated public transport, re-check public readiness, use the server-selected public workspace/RLS transaction boundary, and never call authenticated `/applications/:id/runtime/*` endpoints.
-   [ ] Anonymous private/unknown/unready references are externally indistinguishable.
-   [ ] Public workspace selection is server-owned, explicit, non-personal and transaction-pinned.
-   [ ] UUID, primary/direct secondary/canonical secondary routes all behave according to policy and preserve path/query safely.
-   [ ] `marketing.image` is a first-class static widget and old Hero light/dark preview ownership is completely removed.
-   [ ] Consortium snapshot is generated through real authoring/export APIs, keeps only the requested temporary MUI central image URL, and contains no fake MUI SaaS/testimonial/pricing content.
-   [ ] Consortium RU copy is traceable to the recorded landing-draft revision/hash, EN is a faithful factual translation, and placeholder contacts/CTA destinations are omitted or disabled rather than published as fake links.
-   [ ] EN/RU UI strings and ARIA labels are complete; validation is user-facing; no raw IDs/JSON/internal errors leak to normal surfaces except the intentionally labeled read-only technical UUID address.
-   [ ] Browser evidence at 1920×1080, 768×1024 and 390×844 proves no page-level overflow, keyboard/focus accessibility and preserved MUI marketing geometry.
-   [ ] Jest/Vitest/RTL, real PostgreSQL integration, Playwright/security/visual suites, package checks, docs checks, OntoIndex diff verification and Thermos/autoreview all pass for the final diff.
-   [ ] Relevant README and paired GitBook documentation are updated and linked.
-   [ ] No legacy compatibility code or version bump was introduced for the disposable-database migration strategy.

## Open publication inputs

No separate EN source is required: generate the English version from the Russian landing draft and verify semantic/factual parity.

The only optional publication-hardening inputs are stronger source provenance for individual claims and real contact/CTA destinations when they become available. Their absence does not block generating/testing the Consortium fixture from the supplied draft; fields that still contain placeholders or lack a real destination are omitted/disabled.

## Recommended implementation order

1. Phase 0 dependency/provenance gate.
2. Phase 1 shared contracts.
3. Phases 2–3 alias schema + RBAC.
4. Phases 4–6 public workspace/readiness/runtime/router.
5. Phase 7 alias UI.
6. Phase 8 static image widget + Hero cleanup.
7. Phase 9 Consortium fixture generation.
8. Phase 10 deep tests/browser evidence.
9. Phase 11 docs.
10. Phase 12 final QA/autoreview.

This ordering keeps each UI surface behind a stable backend permission/data contract and makes public runtime security testable before product fixture publication.
