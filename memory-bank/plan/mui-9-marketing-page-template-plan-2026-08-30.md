# Plan: MUI 9 Platform Upgrade and Data-Driven Marketing Page Template

> Created: 2026-08-30
> Status: Implementation and all feasible local acceptance gates complete; authenticated runtime materialization, browser authoring/export-import, responsive visual/a11y matrix, permission/API/browser gating, workspace CRUD, cross-scope content mutation, and reset operation audit are verified. Production Storage/imgproxy media and independent review tools remain environment-dependent evidence boundaries.
> Mode: PLAN
> QA: 2026-08-30 — updated after independent architecture, testing, and runtime-UX/documentation audits
> QA verdict: Pass for the implemented scope — dependency, registry, runtime, seed-ownership, workspace lifecycle, browser authoring/export-import, responsive/a11y, permission, and documentation gates pass locally. Full production Storage/imgproxy media and independent OntoIndex/Thermos review remain explicitly unverified because the available environment cannot exercise them to completion.
> Brief: original task input (not synchronized into the repository)
> Technical brief: reviewed task contract (not synchronized into the repository)
> Research: [`memory-bank/research/mui-9-marketing-page-template-research-2026-08-30.md`](../research/mui-9-marketing-page-template-research-2026-08-30.md)

This document records the approved implementation and verification plan. The implementation keeps product schema, snapshot format, and metahub manifest versions unchanged; disposable test data is expected to be recreated. Remaining items are explicit acceptance gaps, not a request for a compatibility layer or legacy compatibility code.

### Implementation evidence (2026-08-31)

-   The centralized catalog and lockfile use Material UI Core/System/Icons/Utils `9.2.0`, MUI X packages `9.8.0`, and Emotion 11 peers. The repository's minimum-release-age policy made the originally researched Core `9.4.0`/X `9.12.0` candidate unavailable, so the selected versions are the latest eligible coherent v9 lines in this checkout.
-   `pnpm install --frozen-lockfile --ignore-scripts` passed after lockfile regeneration. `pnpm run check:mui-v9-policy`, `pnpm run check:catalog-versions`, `pnpm run check:apps-template-isolation`, and `pnpm run check:runtime-no-lms-forks` pass.
-   Target package builds and the root `pnpm build` pass. Focused Jest/Vitest suites cover marketing schemas/utilities, template seed/manifest contracts, runtime API, workspace seed ownership/reset, hosted dispatch, standalone dispatch, layouts, and renderer behavior. The field-level marketing baseline contract passes with the expected section counts/order and localized semantic keys.
-   The implementation uses initial-only workspace seed materialization, clears seed provenance on user row/child-row edits, and exposes an owner/application-admin guarded transactional reset endpoint and localized confirmation UI. Authored rows remain untouched by publish or reset.
-   EN/RU GitBook pages and package README guidance are present; OpenAPI source was regenerated from the live route inventory and includes the reset endpoint. The Chromium English/light lifecycle passed with a real `toHaveScreenshot` oracle, its committed image was inspected with `view_image`, and the screenshot provenance checker passed.
-   After publish/sync, the runtime flow fetches the actual `/runtime/marketing-page` read model and compares every seeded semantic field (copy, actions, media/alt, relations, prices/benefits, FAQ, and footer) through `marketingPageRuntimeMaterialization.ts`; decimal-price and backend icon canonicalization are normalized without ignoring value changes.
-   The publication list now exposes a localized, permission- and pending-state-guarded `sync` action; its reachability, denial, no-version, pending, and disabled-state contracts are covered by seven focused tests.
-   `tools/testing/e2e/specs/flows/marketing-page-permissions.spec.ts` passed in the same local run: anonymous runtime/layout requests return `401`, editor/member layout reads and mutations return `403`, owner/admin runtime access succeeds, admin appearance mutation succeeds, cross-application runtime access is denied, and the member browser is redirected away from the admin surface without technical leakage.
-   `pnpm run test:e2e:marketing-page:verify:local-supabase` passed with minimal Supabase after the matrix runner was made serial (`--workers 1`) and its cold-start retry explicit (`--retries 2`). The wrapper ran setup, build, contract, Chromium runtime/permission/authoring/snapshot-roundtrip flows, all four locale/theme matrix projects, documentation screenshot/i18n/assets/link checks, and stopped Supabase in `finally`. The run preserved HTML reports and `.last-run.json` passed artifacts under `tools/testing/e2e/.artifacts/marketing-page/`.
-   The browser authoring flow now creates a marketing metahub through the localized template picker, edits a seeded localized hero record through the generic multiline dialog, creates and syncs publication/application schemas through the existing UI, and verifies the changed title after a runtime reload. The snapshot-roundtrip flow imports through the real metahub dialog, compares the exported semantic envelope, and materializes the imported application runtime.
-   The responsive matrix includes an axe WCAG 2A/2AA scan for each EN/RU × light/dark project. Its checked-in media adapter serves byte-for-byte local copies of the referenced MUI/Webflow demo assets, so screenshot assertions are deterministic without depending on a CDN.
-   The dedicated matrix spec under `tools/testing/e2e/specs/matrix/marketing-page-visual.spec.ts` passed for `ru-light`, `ru-dark`, `en-light`, and `en-dark`, covering desktop (1920×1080), tablet (768×1024), and mobile (390×844), including localized `<html lang>`, theme brightness, image load completion, keyboard FAQ and mobile-drawer focus paths, anchors, no technical leakage, no unsafe links, no page-level overflow, no console/page/API errors, and 12 Playwright screenshot baselines. A real Russian tablet overflow found by that matrix was fixed in the footer layout before the passing run. The first cold-start media timeout is mitigated by the bounded Playwright retry; it does not make upstream media deterministic.
-   The full `apps-template-mui` Vitest invocation has a known long-running Interpretation Network workspace-widget tail under the MUI 9 DOM/runtime changes; the focused marketing/runtime suites and all browser gates are green. A complete repository-wide Vitest pass remains a separate CI/resource-sensitive gate and is not conflated with the marketing acceptance result.

### Acceptance boundaries after implementation (2026-09-01)

-   The browser flows prove localized template-picker creation, content edit → publish → sync → reload, export/import round-trip, workspace create/edit/copy/delete, a pristine seeded reset with `resetRows > 0` and an audit-row assertion, copied-workspace reset with `resetRows = 0`, authored-content preservation, and cross-scope content-row mutation denial. API calls are retained only for deterministic setup and direct-bypass assertions.
-   The dedicated permission spec covers anonymous access, owner/admin/editor/member runtime behavior, editor positive content update, member create/update/copy/delete denial with unchanged readback, owner/admin layout boundaries, cross-application isolation, and browser affordance gating. The workspace lifecycle spec separately proves reset audit and cross-scope content isolation.
-   The reset response carries a UUID v7 operation identifier backed by a transactional audit row; seed ownership is cleared on authored parent/child edits, copies, deletes, and reorders, so republish/reset cannot overwrite authored content.
-   The committed GitBook asset is EN/light desktop. Matrix screenshots are tracked as Playwright baselines but are not duplicated as localized GitBook assets. The deterministic local-reference fixture covers the seeded external MUI/Webflow bytes; a full production Storage/imgproxy/media-origin suite remains outside the minimal-Supabase evidence.
-   OntoIndex verification was re-attempted after implementation. The graph remains stale/degraded for dirty-worktree symbols and the scan cap prevents a complete independent changed-file proof; direct source inspection and focused tests remain authoritative. The Thermos/autoreview helper remains unavailable because its Codex state database is read-only (a writable `/tmp/codex-home` retry hung and was stopped); this is not reported as a clean independent review.

## Overview

The work has two coupled outcomes:

1. Move every direct workspace consumer from the current Material UI 7 / MUI X 8 surface to one coherent, explicitly pinned MUI 9 policy. The migration includes Core, System, Icons, Utils, X Charts, Data Grid, Pickers, Tree View, Emotion peers, package manifests, lockfile, tests, and documentation. It must preserve the existing metadata-driven dashboard and the isolated published-application boundary.
2. Add a first-class `marketing-page` published-application renderer beside `dashboard`. Its initial state must look like the MUI marketing-page reference (app bar, hero, logo collection, features, testimonials, highlights, pricing, FAQ, footer), but every visible value must be supplied by typed metahub/application/workspace data. The stock `.backup` files are visual/API references only; generated JavaScript and product-incompatible wrappers are not source to copy.

The implementation is intentionally a clean break for a disposable test database: no MUI 7/X 8 compatibility shims, no dashboard fallback for a marketing payload, no schema or metahub-template version increment, and no preservation of obsolete touched-path behavior. Persisted identifiers created by the feature use UUID v7. All user-visible text, labels, errors, and accessible names are localized in English and Russian from the first commit.

### Evidence and constraints discovered during research

-   The built-in metahub registry currently contains seven codenames in `packages/universo-react-metahubs-backend/src/domains/templates/data/index.ts`; the exact-list contract in `interpretationNetworkTemplateShape.test.ts` must become eight after registration of `marketing-page`.
-   `LayoutTemplateKey` is duplicated and currently narrowed to `dashboard` in the metahubs frontend, while the shared layout configuration and backend services are dashboard-specific. A single neutral contract is required before changing any consumer.
-   `ApplicationRuntime.tsx`, `apps-template-mui/src/App.tsx`, and `apps-template-mui/src/api/api.ts` currently assume a dashboard-shaped payload. Marketing data must not be forced to provide an object collection, DataGrid columns, pagination, or dashboard widgets.
-   Publication, restore, and sync paths contain silent `dashboard` defaults and error-to-empty normalization. Invalid or unknown marketing layouts must fail closed and make publication/sync observable rather than silently changing the page.
-   `applicationWorkspaces.ts` currently re-upserts seeded rows during synchronization. Without an ownership rule this can overwrite workspace edits or soft-delete authored rows. The recommended default is initial-only seed plus an explicit, authorized reset-to-source operation.
-   Hosted core owns the platform shell theme and the hosted application runtime intentionally mounts an application-level `AppMainLayout` for saved marketing appearance overrides; standalone `DashboardApp` uses the same layout as its shell. The final renderer remains provider-free, and provider ownership is explicit at the host/application-shell boundary.
-   MUI's official v9 guide documents removed APIs, slot/`slotProps` migration, system-prop removal, icon renames, Grid/Stack guidance, changed browser targets, and accessibility/DOM behavior. Current official pages checked on 2026-08-30 identify Core 9.4.0 and MUI X 9.12.0 as the research candidate; this implementation uses eligible Core 9.2.0 and X 9.8.0 pins under the repository's minimum-release-age policy.
-   Playwright's current repository configuration sends `ru-light`, `ru-dark`, `en-light`, and `en-dark` projects only to `specs/matrix/**`. A marketing locale/theme matrix placed under `specs/flows` would silently run only in `chromium`; the plan therefore puts the required matrix in `specs/matrix` or changes the project matcher deliberately.
-   OntoIndex exploration was completed in the required search → inspect → impact order, but the available freshness diagnostic reported indexed commit `5c553eb` versus current `HEAD` `9a59f65`; the local CLI cannot refresh it in this dirty worktree. Direct source and test inspection remain authoritative, and implementation must re-check freshness in a clean state before edits.

## Affected Areas

| Area                                     | Primary paths                                                                                                                                               | Planned responsibility                                                                                                                                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Version policy and package ownership     | `pnpm-workspace.yaml`, `pnpm-lock.yaml`, all MUI-using `package.json` files, `tools/testing/frontend`                                                       | Pin the coherent v9 set, remove dead packages, make every direct import owned by its package/tool, align peers and `react-is`, and add a static policy gate.                                                             |
| Isolated published-app runtime           | `packages/universo-react-apps-template-mui/src/**`                                                                                                          | Preserve dashboard, replace static marketing reference code with typed presentational sections, add template dispatch, shared loader, provider-free theme usage, i18n, and runtime tests.                                |
| Shared legacy UI primitives              | `packages/universo-react-template-mui/src/**`                                                                                                               | Perform the same v9 API migration where this package remains a direct consumer; reuse its dialogs, cards, field controls, safe value formatting, and presentation boundary rather than creating a second implementation. |
| Neutral types and utilities              | `packages/universo-react-types/src/**`, `packages/universo-react-utils/src/**`                                                                              | Own the template registry discriminators, Zod schemas, normalized view models, safe URL/media helpers, and UUID/semantic-key utilities without backend or React cycles.                                                  |
| Metahub template registry and seed       | `packages/universo-react-metahubs-backend/src/domains/templates/**`, `src/domains/shared/**`                                                                | Register the eighth metahub template, validate its manifest, seed standard entities/components/records, and preserve manifest/snapshot versions at `0.1.0` / existing values.                                            |
| Metahub authoring UI                     | `packages/universo-react-metahubs-frontend/src/domains/layouts/**`, `src/types.ts`, template picker/forms                                                   | Make layout/template configuration template-aware, keep dashboard widget editors separate, and render friendly localized labels instead of keys/UUIDs.                                                                   |
| Publication and restore                  | `packages/universo-react-metahubs-backend/src/domains/publications/**`, `SnapshotSerializer.ts`, `SnapshotRestoreService.ts`, `snapshotLayouts.ts`          | Carry and validate `templateKey`, preserve marketing config/data, fail publication loudly on attachment/validation errors, and keep snapshot formats unchanged.                                                          |
| Application sync and workspace ownership | `packages/universo-react-applications-backend/src/routes/sync/**`, `src/services/applicationWorkspaces.ts`, `syncSeeding.ts`, `applicationLayoutsStore.ts`  | Split common persistence from dashboard-specific materialization, preserve template keys, implement seed provenance/reset semantics, and avoid workspace data loss.                                                      |
| Runtime API and controller               | `packages/universo-react-applications-backend/src/controllers/runtimeRowsController.ts`, runtime routes, `applications-frontend/src/api/**`, `src/types.ts` | Return a discriminated runtime envelope and a typed marketing view model with RLS/RBAC, bounded queries, and no dashboard-only requirements.                                                                             |
| Hosted application route                 | `packages/universo-react-applications-frontend/src/pages/ApplicationRuntime.tsx`, `core-frontend/src/App.tsx`, `MainRoutes.tsx`                             | Dispatch dashboard/marketing before dashboard CRUD state, keep one hosted theme owner, and provide localized fail-closed states.                                                                                         |
| i18n                                     | `packages/universo-react-i18n`, package-local `src/i18n/**`                                                                                                 | Add all marketing labels, actions, errors, ARIA names, and validation in EN/RU; use the shared package only for genuinely shared keys.                                                                                   |
| Fixtures and browser evidence            | `tools/testing/e2e/specs/{flows,matrix,generators}`, `tools/testing/e2e/support`, `tools/fixtures`, `tools/docs`                                            | Generate deterministic marketing data from the real lifecycle, validate contract/drift, cover permissions and responsive visual evidence, and retain provenance.                                                         |
| Documentation                            | `docs/{en,ru}`, package `README.md`/`README-RU.md` files, `SUMMARY.md`                                                                                      | Publish GitBook authoring/runtime/testing documentation, MUI migration notes, fixture/screenshot provenance, and synchronized EN/RU navigation.                                                                          |

The source audit found MUI imports in approximately thirteen package/tool groups, including `admin-frontend`, `applications-*`, `apps-template-mui`, `auth-frontend`, `block-editor`, `core-frontend`, `metahubs-*`, `metapanel-frontend`, `profile-frontend`, `start-frontend`, `template-mui`, `migration-guard-shared`, and `tools/testing`. The implementation matrix must enumerate every actual importing package; the two template packages alone are not a sufficient migration scope.

## Goals and non-goals

### Goals

-   Establish one explicit MUI 9 Core/X policy, with lockfile and direct dependency ownership proving it.
-   Make the metahub registry, application layouts, publication/snapshot, sync, runtime API, hosted renderer, and standalone entrypoint agree on template identity.
-   Add the `marketing-page` metahub template using existing Hub/Object/Page/Set/Enumeration presets and existing seed infrastructure.
-   Reproduce the stock baseline counts and order: six logos, three features, six testimonials, six highlights, three pricing tiers with 4/6/4 benefits, and four FAQ items.
-   Make navigation, CTA, footer, pricing, and newsletter behavior data-driven and non-deceptive; no visible no-op controls or `href="#"` placeholders.
-   Keep content editable through generic localized Object/Page/Set/Enumeration CRUD with safe resource previews and no raw IDs/JSON/object coercion.
-   Provide deterministic Jest, Vitest, Playwright API/browser, responsive, accessibility, RBAC, screenshot, fixture, and documentation gates.

### Non-goals

-   No schema migration, snapshot-format bump, or metahub manifest version bump.
-   No new built-in entity kind or opaque JSON document used as the normal marketing content model.
-   No wholesale unrelated rewrite of every legacy feature package or preservation of obsolete compatibility aliases outside the explicitly approved touched paths.
-   No public marketing `GuestApp` implementation in the first authenticated `/a/:applicationId` slice. A future public route would need its own read-only transport, RLS/RBAC, caching, and no-mutation contract.
-   No copy of generated `.backup` JavaScript into TypeScript source and no wholesale replacement of the product dashboard with the upstream demo.

## Design Notes

### 1. Separate the two template vocabularies

The platform has metahub template codenames (`basic`, `basic-demo`, `empty`, `lms`, `1c-compatible`, `playcanvas`, `interpretation-network`, then `marketing-page`) and application layout/rendering keys (`dashboard`, `marketing-page`). They must not be conflated into one backend/frontend-local union.

Create one neutral registry module in `@universo-react/types` with explicit entries and schemas. It may expose two typed views over the same source:

```ts
export const applicationTemplateKeys = ['dashboard', 'marketing-page'] as const
export type ApplicationTemplateKey = (typeof applicationTemplateKeys)[number]

export const metahubTemplateCodenames = [
    'basic',
    'basic-demo',
    'empty',
    'lms',
    '1c-compatible',
    'playcanvas',
    'interpretation-network',
    'marketing-page'
] as const
export type MetahubTemplateCodename = (typeof metahubTemplateCodenames)[number]
```

The registry entry should include display-name keys, supported layout key(s), a Zod config schema, a runtime payload schema, whether dashboard widget materialization is allowed, and a serializable seed/ownership policy key. The registry must not absorb backend seed manifests, SQL, or React components: metahubs-backend remains the owner of concrete seed data and persistence rules. Unknown keys and invalid key/config pairs are errors, not dashboard defaults.

### 2. Discriminated runtime contract

The current `AppDataResponse` is dashboard-shaped. Replace the implicit shape with a discriminated or normalized envelope while preserving the existing dashboard contract for dashboard consumers:

```ts
const runtimeViewModelSchema = z.discriminatedUnion('templateKey', [
    z.object({
        templateKey: z.literal('dashboard'),
        dashboard: dashboardRuntimeDataSchema
    }),
    z.object({
        templateKey: z.literal('marketing-page'),
        marketingPage: marketingPageDataSchema
    })
])

export type RuntimeViewModel = z.infer<typeof runtimeViewModelSchema>
```

`marketingPageDataSchema` must contain normalized section records, localized values, semantic keys, order, visibility, safe links, media/resource summaries, provenance, and application-level branding/config. It must not require `objectCollection`, `columns`, `rows`, `pagination`, or `zoneWidgets`. The renderer dispatches on the parsed discriminator and exposes a localized safe error for unknown/malformed values.

### 3. Entity-first marketing content model

Use existing standard presets; do not create a `MarketingSection` kind. The recommended model is:

| Stock section                 | Entity representation                                                                  | Required data characteristics                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Site/app settings             | One Object with `recordBehavior: reference`                                            | Singleton semantic codename, localized brand/hero/footer values, branding/resource references, global visibility. |
| Navigation links              | Ordered Object reference collection                                                    | Label VLC, safe target, internal/external action kind, order, visibility, optional icon key from an allowlist.    |
| Logos                         | Ordered Object reference collection                                                    | Name/alt VLC, resource reference, decorative flag, visibility, order.                                             |
| Features                      | Ordered Object reference collection                                                    | Title/description VLC, icon allowlist key, light/dark resource references, order/visibility.                      |
| Testimonials                  | Ordered Object reference collection                                                    | Quote/author/company VLC, optional avatar resource, order/visibility.                                             |
| Highlights                    | Ordered Object reference collection                                                    | Title/description VLC, icon key, order/visibility.                                                                |
| Pricing tiers and benefits    | Pricing Object records plus linked benefit Object records through REF/TABLE components | Price/period, title/description, CTA label/target, ordered benefits, featured flag, visibility.                   |
| FAQ                           | Ordered Object reference collection                                                    | Question/answer VLC, order/visibility; answer uses multiline editor.                                              |
| Footer/social/newsletter      | Site settings plus ordered link Object records                                         | Safe links, contact target policy, form state/endpoint contract, localized labels.                                |
| Rich authored landing content | Page only when Editor.js/rich blocks are genuinely required                            | Page blocks are not a substitute for structured section records.                                                  |

`Set` and `Enumeration` remain vocabulary/option sources. Each exposed record has a stable semantic codename (for contracts, not ordinary display), locale-aware fields, order, visibility, layer, scope, and seed provenance represented by existing fields/config. Relations use existing REF/TABLE components and relation builders. No visual component owns a demo array.

### 4. Ownership and precedence

The effective view is resolved in this order:

1. metahub canonical structure and initial seed;
2. publication snapshot;
3. application-global layout/theme/branding/visibility defaults;
4. workspace records and explicitly enabled workspace variations.

The default seed policy is **initial-only**. A seeded row is identified with the existing seed marker/provenance, and a user mutation makes it authored so a later publication cannot overwrite it. A stale-seed cleanup never removes authored rows. A separately authorized “Reset to source” action may replace selected rows after confirmation, records provenance, and is covered by an audit/RBAC test. If the existing marker cannot safely express this without adding schema, the implementation must stop and resolve the contract rather than silently claim data safety.

### 5. Theme and host boundary

Resolved host policy:

-   the core application keeps the platform `ThemeProvider`/`CssBaseline` boundary; the hosted marketing branch mounts one application-level `AppMainLayout` inside that boundary to apply persisted application appearance. This is an intentional application-level override, not a renderer-owned provider;
-   standalone `DashboardApp` and a standalone marketing entrypoint use `AppMainLayout` exactly once;
-   `MarketingPage` and all sections are presentational and never create `AppTheme`, `ThemeProvider`, or `CssBaseline`;
-   branding/theme overrides are resolved by the host and passed through the typed view model/theme context;
-   dashboard and marketing sections are not registered as one another's widgets.

If the implementation chooses to move the hosted boundary, it must prove there is one provider in every route with a React-tree test and a browser smoke test; nested stock `AppTheme` is never acceptable.

The implementation update above is the selected policy: hosted and standalone shells own the theme boundary, while the marketing renderer remains provider-free. Any future shell refactor must preserve this invariant.

### 6. Actions and safe media

Every visible navigation, CTA, sign-in/up, pricing, footer, and newsletter control must have a real target/action. The implementation gate must choose one of:

-   seed safe internal platform/auth routes or approved external targets;
-   connect to an existing action endpoint with success/error states;
-   hide the control when its capability/target is absent.

Rendering a fake active button, `href="#"`, or an inert newsletter submit is not accepted.

At write and render boundaries, accept only approved schemes (currently `http:`/`https:` in `resourceSources.ts`; `mailto:`/`tel:` require a separate typed action policy), reject `javascript:`, `data:`, credentials, and protocol-relative URLs, and apply an explicit `target`/`rel` policy. Resource previews use safe metadata, CSP/origin/content-type allowlists, meaningful `alt`, and localized missing/blocked fallbacks. External stock MUI URLs are not a deterministic E2E source; use local/bundled assets or controlled routes.

## UI Contract

This contract is mandatory for every touched runtime, authoring, table, card, dialog, relation, and media surface. It follows `.agents/skills/mui-runtime-ux-patterns` and `.agents/skills/runtime-ux-qa`.

### Published marketing runtime (`/a/:applicationId`)

| Surface                     | User controls and semantics                                                                                                                                 | Display/hidden data                                                                              | Defaults and validation                                                                                                                | Responsive/browser proof                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| App bar/nav/drawer          | `header` + `nav`, skip link, logo link, section anchors, menu/close buttons with localized `aria-label`, `aria-expanded`, focus return, Escape and Tab trap | Friendly labels and alt text; application/template IDs, codenames, raw URLs, and payloads hidden | Seeded ordered links; missing target hides or renders a non-interactive label; fixed-bar offset prevents anchor headings being covered | Desktop horizontal nav; mobile top drawer; keyboard and settled Chromium evidence at 1920×1080, 768×1024, 390×844; no page overflow |
| Hero                        | `main` heading hierarchy (`h1` then sections), description, primary/secondary CTA anchors/buttons                                                           | Localized title/subtitle and safe CTA labels; no UUID/JSON                                       | Seeded copy; CTA target/action required or control hidden; long copy wraps                                                             | Light/dark contrast, Russian long text, CTA keyboard activation, screenshot                                                         |
| Logos/features              | `section` landmarks, cards, feature selector using button/tab semantics with `aria-selected`/`aria-controls` where applicable                               | Human-readable names, alt/resource summaries, icon allowlist; no resource JSON                   | Stable order/counts; missing media uses localized fallback; descriptions multiline in authoring                                        | Three-column/stacked mobile layout; only a bounded feature-chip scroller may scroll internally                                      |
| Testimonials/highlights     | Heading hierarchy and cards; decorative icons marked appropriately                                                                                          | Quote/author/company and descriptions localized; no technical fields                             | Visibility/order applied after baseline; missing avatar fallback                                                                       | Cards reflow without clipping; contrast and reduced-motion proof                                                                    |
| Pricing                     | Tier cards, feature labels, CTA action, `aria-label` for price period when needed                                                                           | Price/period/benefits are friendly values; no internal IDs                                       | 3 tiers and 4/6/4 benefits in seed; invalid price/target renders localized safe state                                                  | Cards stack at mobile; no horizontal page scroll; CTA path tested                                                                   |
| FAQ                         | Accordion buttons with `aria-expanded`/`aria-controls`, keyboard toggle, focus order                                                                        | Question/answer text only; no raw serialized object                                              | Four seeded items; answer is multiline in editor; empty state localized                                                                | Keyboard and mobile accordion path, long Russian answer, screenshots                                                                |
| Footer/newsletter           | `footer`, social/link anchors, `type=email`, autocomplete and localized submit/success/error                                                                | Friendly labels and safe links; no URL/resource object leakage                                   | Existing endpoint/action or no submit control; localized format/required errors                                                        | Footer stacks at mobile; contrast, focus, no fake actions                                                                           |
| Loading/error/missing media | Skeleton/spinner, alert/live region, retry where supported                                                                                                  | User-safe message; technical error/request IDs not visible                                       | Unknown template, invalid payload, missing media and network errors fail closed                                                        | Browser checks no console/page errors and no `[object Object]`/UUID leakage                                                         |

### Metahub template picker and layout authoring

-   The template picker exposes localized `Marketing page` / `Маркетинговая страница`, description, and a keyboard-operable selection control. It never displays a raw codename as the primary label.
-   `LayoutList`, `LayoutDetails`, and create/edit dialogs use existing `LayoutAuthoringList`, `LayoutAuthoringDetails`, `TemplateMainCard`, `ViewHeaderMUI`, `FormDialog`, and `ConfirmDeleteDialog` primitives. `templateKey`/layout IDs/codenames are hidden or rendered as friendly labels; an untitled layout uses a localized “Untitled layout” fallback.
-   Dashboard zones/widgets remain editable only for the dashboard key. Marketing exposes an editable, permission-checked appearance/settings panel for section visibility/order, theme mode (`system`/`light`/`dark`), contrast-validated primary/accent colors, brand asset/alt text, action policy, and reset-to-metahub-source. It shows whether each value is inherited, application-owned, or workspace-owned; it never falls back to a generic raw-JSON or read-only editor when the brief requires deployment-wide settings.
-   All form labels, helper text, validation, and confirmation text are EN/RU. Description/answer/quote/content fields are multiline controls. Relation fields use Autocomplete/relation builders; media uses `ResourcePreview`; no raw JSON/object cells.

### Application layouts/settings and workspace CRUD

-   `ApplicationLayouts` and `ApplicationSettings` edit deployment-wide template config/theme/branding/visibility only. Their marketing appearance contract includes `system`/`light`/`dark`, bounded contrast-safe colors, logo/alt, section order/visibility, safe action policy, source badges, and explicit reset-to-source with confirmation. They do not become a hidden content editor, expose raw `templateKey`, or promise in-place template switching unless a separate API is approved. `manageApplication` permissions are enforced in both UI and API; localized errors never expose raw JSON/IDs.
-   Generic Object/Page/Set/Enumeration lists and cards use friendly presentation values, `FlowListTable`/DataGrid display contracts, localized empty/error states, row actions, and safe relation/media renderers. Owner/system fields remain hidden or show a human name. Long text is textarea/`aria-multiline="true"` by default. Browser assertions must also inspect visible text and relevant `href`/`src`/`alt`/`data-*` attributes for raw UUIDs, codenames, URLs, object coercion, and unsafe values.
-   Create/edit/copy/delete/reset controls are permission-gated in the UI and rechecked by the API. A read-only member sees no mutation affordance and receives `403` on direct bypass attempts.
-   Dashboard runtime and existing workspace routes keep their current user-facing contract; the MUI migration may change APIs/DOM but not accidentally dispatch a marketing payload through dashboard CRUD state.

The implementation checklist must carry a separate UI Contract row and browser assertion for each of these surfaces: template picker; metahub create/edit dialog; metahub `LayoutList`; layout details and create/edit/copy/delete/reset dialogs; `ApplicationLayouts` list/details; widget/config editor; `ApplicationSettings`; marketing appearance panel; generic record list/card; create/edit/copy/delete dialogs; relation picker; `ResourcePreview`; loading/error/unknown-template states; and dashboard regression surfaces. Every row records controls/roles, EN/RU labels and validation, hidden system fields, multiline fields, permissions, responsive/keyboard behavior, and the exact Playwright oracle; broad “generic CRUD” wording alone is not acceptance evidence.

## Plan Steps

### Phase 0 — Freeze decisions and capture a baseline

-   [x] Confirm the implementation branch/worktree and record the current `HEAD`, dirty user files, Node version (repository requires Node `>=22.6.0`), pnpm version, and whether the OntoIndex index is fresh. Search → inspect → impact was run before each edited symbol; the graph freshness warning and dirty-worktree limitation are recorded.
-   [x] Record the `.backup/templates/dashboard` and `.backup/templates/marketing-page` provenance (source date, file counts, TSX/JS distinction, license/URL context). A semantic baseline manifest covers section order, names, counts, app-bar labels/actions, hero title/subtitle/CTA/terms, footer groups/social targets, media keys/alt text, and light/dark screenshots.
-   [x] Resolve and approve the exact package policy. The eligible coherent pins in this checkout are Core/System/Icons/Utils `9.2.0`, MUI X `9.8.0`, and Emotion 11 peers; official MUI pages and Context7 were consulted and the release-age policy is recorded.
-   [x] Decide Community-only versus Pro/Premium. Runtime Pro components are not used; the remaining Pro surface is type-only augmentation and the policy checker documents that exception without a license-key path.
-   [x] Decide the product browser support policy independently from MUI's default v9 bundle targets. The authenticated Chromium matrix is the acceptance floor for this slice, with desktop/tablet/mobile evidence and no unsupported public route claim.
-   [x] Decide authenticated-only marketing scope, template immutability, CTA/newsletter action semantics, media provenance, seed republish/reset behavior, and the deterministic lifecycle path in lieu of a promoted product fixture.
-   [x] Verify `package.json`/`pnpm-lock.yaml` consistency and run the baseline gates. The frozen install, catalog/policy/isolation/no-LMS checks, focused builds/lints/tests, and the full local marketing Playwright wrapper pass; the dirty worktree is retained as user implementation state.

### Phase 1 — MUI 9 dependency and API migration

-   [x] Update the centralized catalog and lockfile, every direct consumer manifest/peer range, and direct ownership for all discovered MUI imports. Emotion ranges and the type-only Pro exception are explicit.
-   [x] Remove unused `@mui/base`/`@mui/lab` consumers after source/build proof; no unsupported Base v9 fork was introduced.
-   [x] Record the React 18.3.1/`react-is` resolution policy and verify the lockfile has no accidental React 19 MUI consumer resolution.
-   [x] Review the official v9 migration guidance and manually apply the required Core/System/X slot, Grid, icon, picker, chart, and DataGrid changes. Generated JavaScript was not copied; the migration ledger and residual policy checks are green.
-   [x] Audit and retire the unreferenced legacy `template-mui` static MarketingPage and its unused section components; retain only `AppAppBar`/`SitemarkIcon` required by `StartLayoutMUI`, with a non-copy-oriented README.
-   [x] Manually migrate the known v9 residuals and verify native `inputProps` versus component slot props through package builds and focused regression suites.
-   [x] Audit the `.backup/templates/dashboard` reference and preserve the existing product dashboard metadata/widgets/workspaces/PlayCanvas/Interpretation Network adapters while applying only compatible v9 changes.
-   [x] Add and wire `tools/check-mui-v9-policy.mjs` to reject old majors, duplicate lines, undeclared imports, dead Pro/Base packages, invalid peers, and stale claims.
-   [x] Exit gate: frozen install, package typecheck/build/lint, targeted Core/X tests, dashboard regressions, isolation/no-LMS checks, and the static MUI policy checker pass.

### Phase 2 — Neutral registry, schemas, and shared utilities

-   [x] Add the neutral registry and schemas to `@universo-react/types`, distinguishing metahub codenames from application template keys, exposing i18n keys, and failing closed on unknown values.
-   [x] Add strict `MarketingPageConfig`, `MarketingPageRecord`, `MarketingPageData`, safe-link/resource, provenance, and runtime-envelope schemas with locale/order/action/media validation at transport and render boundaries.
-   [x] Keep mutation/request schemas strict and confine lossy normalization to documented read-model adapters.
-   [x] Keep marketing copy plain-text by default; rich content uses existing safe page-block contracts and no unsanitized HTML boundary.
-   [x] Put backend-independent URL/media/semantic-key normalizers in shared packages and document synthetic derived keys separately.
-   [x] Reuse the existing UUID v7 and database UUID v7 paths for persisted IDs; deterministic UUID v5 values remain non-persisted sync keys.
-   [x] Reuse the shared URL/resource helpers and extend them only for the discriminated marketing action contract; no parallel unsafe allowlist is used.
-   [x] Replace local layout-key unions with the shared contract while keeping dashboard-only widget schemas isolated.
-   [x] Add Vitest/Jest contract coverage for registry/config/URL/media/UUID validation and dashboard compatibility, including unsafe and unknown-key negative cases.

### Phase 3 — Marketing metahub manifest and deterministic seed

-   [x] Add the `marketing-page` entry beside the existing seven built-in templates in `packages/universo-react-metahubs-backend/src/domains/templates/data/index.ts`, with localized display name and description, layout key, config schema, supported presets, and the existing manifest `version`/`minStructureVersion` fields unchanged at `0.1.0` (the field is `version`, not `manifestVersion`).
-   [x] Define standard entities/components using the basic template's existing Hub/Object/Page/Set/Enumeration presets. Use Object `recordBehavior: reference` for ordered section records; use REF/TABLE components for tier→benefit and other relations; reserve Page for rich blocks. Do not add a new preset or JSON blob.
-   [x] Seed one site-settings record plus the ordered links/logos/features/testimonials/highlights/pricing/benefits/FAQ records. Preserve exact reference counts/order and localized EN/RU copy. Use stable semantic codenames for fixture assertions, UUID v7 for persisted rows, and deterministic media/resource references or local fallbacks.
-   [x] Add one field-level `tools/testing/e2e/support/marketingPageBaselineContract.ts` (used by the no-fixture lifecycle) that asserts section order, navigation labels/actions, hero title/subtitle/CTA/terms, logos and `alt`/media keys, features, testimonials, highlights, pricing labels and benefits, FAQ question/answer keys, footer groups/social targets, and visibility/order. Counts alone are not an acceptable one-to-one oracle.
-   [x] Mark seed ownership/provenance with existing fields/config. Ensure the seed path is idempotent within one transaction, does not overwrite authored rows, and records a clear reset source. Keep template seed and platform-system-attribute policy helpers aligned.
-   [x] Treat `_app_settings` according to its actual contract: `workspace_seed_template` is existing canonical seed-template storage, not a disposable compatibility fallback. Do not delete or bypass that table without an equivalent existing contract and tests; any application settings fallback that is truly obsolete must be removed only with an explicit replacement.
-   [x] Extend the exact-list/template shape tests and focused Jest coverage for manifest validation, seed counts/order/locales, component data types, duplicate semantic keys, transaction rollback, invalid media/action values, and no-version-bump assertions. Transaction/rollback invariants use the existing `templateSeedTransactionScope.test.ts` boundary.
-   [x] Exit gate: creating a metahub by `templateCodename` returns the localized marketing template, all expected standard entities/components/records exist in the fresh branch, and no demo copy remains in renderer-owned arrays.

### Phase 4 — Layout authoring, snapshot, publication, and sync

-   [x] Refactor `MetahubLayoutsService`, `layoutsController`, `LayoutList`, `LayoutDetails`, and `ApplicationLayouts` around the shared registry. Marketing config is validated by its own schema; dashboard zones/widgets remain dashboard-only. Replace visible raw `templateKey`, `widgetKey`, and UUID fallbacks with localized friendly labels.
-   [x] Audit and branch every dashboard-only layout helper, including default-zone, scoped-layout, create/update, and copy paths. Marketing layouts never receive dashboard widgets or visibility normalization; unsupported combinations fail closed and are covered by focused tests.
-   [x] Make a layout's `templateKey` immutable after creation unless an explicit, provenance-aware switch operation is separately approved. Reject dashboard↔marketing changes with a localized `400/409`; validate config and widgets against the same registry entry on create, update, copy, restore, and sync.
-   [x] Make snapshot, publication, hash, restore, and sync paths round-trip `templateKey`, config, section metadata, and provenance. Unknown/error cases fail closed with safe diagnostics; marketing never receives dashboard injection.
-   [x] Preserve current snapshot versions (`MetahubSnapshot.version = 1`, `snapshotFormatVersion = 3`) and manifest version `0.1.0`; round-trip, unknown-key, attachment, hash, and import/export contracts pass.
-   [x] Split common sync persistence from dashboard-specific materialization in the touched sync/layout modules. Workspace switcher/divider/menu injection is explicitly dashboard-only.
-   [x] Keep persisted UUID v7 IDs. Synthetic deterministic IDs for inherited widgets/workspace controls remain typed non-persisted `derivedKey` values.
-   [x] Harden SQL boundaries with request/pool `DbExecutor`, schema-qualified parameterized SQL, transactions, `RETURNING`, and zero-row failure; no new domain Knex access was introduced.
-   [x] Exit gate: invalid marketing layouts fail loudly; valid layouts survive serialize→restore→sync with the same key/config; dashboard snapshots remain unchanged; no silent fallback or dashboard widget injection occurs.

### Phase 5 — Workspace seed ownership and application overrides

-   [x] Refactor `applicationWorkspaces.ts`, `syncSeeding.ts`, and related stores so initial seed materialization is idempotent and workspace-scoped. A user update/create/copy transitions a seeded row to authored ownership; stale cleanup only touches rows still owned by the seed source.
-   [x] Implement an explicit, permission-checked reset-to-source operation with confirmation, provenance/audit event, and localized result. Reset is not an ordinary delete or republish side effect.
-   [x] Add workspace predicates and `RETURNING` checks to seed persistence, soft-delete, copy, and child-row updates. Test cross-workspace/application IDOR and zero-row failures; duplicate predefined IDs fail before the first write.
-   [x] Extend the existing application-settings contract with typed marketing appearance fields rather than a free-form JSON bag: theme mode, contrast-checked colors, logo/alt, section visibility/order, safe action policy, source/provenance and reset command. Content CRUD stays in the published workspace.
-   [x] Exit gate: republishing changes untouched seed rows only according to the approved policy, never overwrites authored data, cannot cross an application/workspace boundary, and reset is explicit/auditable.

### Phase 6 — Runtime backend transport and data loader

-   [x] Extend the runtime controller/route to select a validated template entry before loading template-specific data. Include `templateKey` in the selected layout query and never default an absent/unknown value to dashboard.
-   [x] Split runtime loading into independent dashboard and marketing branches before dashboard CRUD state. Marketing owns `MarketingPageData`; dashboard retains object collections, columns, rows and pagination.
-   [x] In the runtime controller, validate `template_key` before object-collection/table resolution and use separate dashboard/marketing response assemblers. Marketing does not require dashboard-only fields.
-   [x] Implement a bounded marketing read-model loader with parallel metadata-backed section queries, deliberate locale fallback, display-safe values, and duplicate/required-content fail-closed checks.
-   [x] Keep dashboard runtime behavior behind its branch; marketing responses use the discriminated typed envelope and omit dashboard-only fields. Client adapters and route wrappers validate the same schema.
-   [x] Keep aggregation ownership in the applications backend/runtime API; the isolated renderer contains only typed client/query adapters and presentational sections. Marketing dispatch tests prove dashboard hooks are not reached.
-   [x] Apply RLS/RBAC and application/workspace scope checks before loading. Bound records/text/media/actions and map failures to safe localized diagnostics without credential/PII/JSON logging.
-   [x] Add Jest/API/browser coverage for SQL/bind/identifier safety, response shape, dispatch, locale fallback, bounded queries, permissions, malformed keys, media/actions, `401/403`, cross-application isolation, and direct-bypass denial.
-   [x] Exit gate: valid marketing applications return a complete typed payload; dashboard retains its contract; unknown/corrupted keys fail closed and never call dashboard CRUD loading.

### Phase 7 — Isolated marketing renderer and hosted/standalone dispatch

-   [x] Replace `apps-template-mui/src/marketing-page` static arrays and the standalone MUI README with a product renderer based on typed `MarketingPageData`. The `.backup/templates/marketing-page` files are used only for section composition/style; generated JavaScript and hardcoded demo data are not copied.
-   [x] Add the smallest necessary public renderer/dispatcher, section components, safe media/link components, and data-loading adapters while reusing existing hosts and `AppMainLayout`; the public renderer is free of `template-mui`/feature-package imports and package-boundary tests reject `.backup`/legacy forks.
-   [x] Dispatch hosted and standalone shells on validated `templateKey` before dashboard CRUD hooks; unknown values map to a localized error state and `GuestApp` remains LMS-only.
-   [x] Enforce one theme boundary: hosts own `ThemeProvider`/`CssBaseline`; marketing components consume the resolved theme and never nest `AppTheme`.
-   [x] Implement data-driven navigation, CTA, sign-in/up, pricing, footer, social, and newsletter behavior. The seeded newsletter is a navigation CTA until an approved same-origin lead endpoint exists; no inert email field or silent data loss is possible.
-   [x] Validate internal/anchor/external action pairs against the URL policy, hide unsafe/unavailable actions, and keep newsletter submission a separately typed capability that is disabled unless an approved endpoint supplies auth/CSRF/rate-limit/response semantics.
-   [x] Add package Vitest/RTL coverage for sections, order/counts, localization, loading/error/missing media, safe links, keyboard accordion/menu behavior, no object coercion, and no dashboard hook invocation; dashboard dispatch regression remains green.
-   [x] Exit gate: hosted and standalone marketing render the same typed payload with one theme owner, dashboard remains available, and marketing cannot reach `AppsDashboard` or dashboard CRUD state.

### Phase 8 — Authoring UI, settings, i18n, and accessibility

-   [x] Update metahub template selection, layout list/details, application layouts/settings, and generic workspace CRUD to the UI Contract. Reuse existing MUI primitives and remove raw key/UUID/widget fallback labels.
-   [x] Add marketing namespace keys to `apps-template-mui/src/i18n/locales/en/apps.json` and `ru/apps.json`, with section/action/ARIA/error/empty/loading/missing-media/reset messages and localized validation.
-   [x] Prove the namespace in standalone and hosted shells through the explicit applications-to-apps adapter; EN/RU runtime assertions have no stock-English fallback.
-   [x] Add semantic field metadata for all marketing long-text fields so generic forms use multiline controls and browser oracles can enumerate them.
-   [x] Use `aria-pressed` buttons for feature filtering (the controls do not own a tabpanel) and encode the keyboard/screen-reader contract in focused tests.
-   [x] Verify landmarks, heading hierarchy, skip link, fixed-anchor offset, focus return, Escape/Tab, accordion/menu semantics, reduced motion, light/dark contrast, safe action absence, keyboard template selection, no technical leakage, and no object/resource output. The matrix runs axe for every locale/theme project; the published runtime intentionally renders no email field until a submission endpoint is approved.
-   [x] Harden long Russian copy/media layout (`min-width: 0`, wrapping, intrinsic dimensions/lazy loading where appropriate) and assert settled no-overflow captures.
-   [x] Add Vitest tests for control roles/labels, localized validation EN/RU, field display contracts, hidden system fields, permissions, responsive layout, and no page-local overflow styles.

### Phase 9 — Deterministic fixture and product lifecycle

-   [x] After the runtime contract stabilized, retain the deterministic create→publish→sync→runtime→export/import lifecycle instead of adding a promoted product fixture; the fresh database is intentionally recreated per run.
-   [x] Use `marketingPageBaselineContract.ts` and runtime materialization assertions for semantic codenames/order/counts/locales/media/action policy/template key, with generated IDs/timestamps treated as documented volatile values. No hand-edited snapshot is required in this slice.
-   [x] Isolate every run with `runManifest.runId`, registered cleanup, serial matrix workers, bounded retries, and run-specific report artifacts; the wrapper resets report directories safely between processes.
-   [x] Use local/bundled media for deterministic minimal-Supabase tests. Storage-api/imgproxy/full media upload scenarios remain an explicit separate full-stack boundary.

### Phase 10 — Deep Jest/Vitest/Playwright test system

#### Jest suites

-   [x] `metahubs-backend`: focused Jest coverage covers registry/manifest, seed transaction rollback, layout/snapshot/publication contracts, URL/media validation, workspace ownership/reset, and SQL/RLS boundaries.
-   [x] `applications-backend`: focused Jest coverage covers runtime branches, layout/sync persistence, template-aware workspace materialization, no dashboard injection, SQL safety, permissions/IDOR, duplicate seed rejection, and round trips.
-   [x] `template-mui`: changed shared dialogs/display/navigation primitives have focused regression coverage and pass the package build/lint gates; the unrelated full package suite remains a broad regression concern.

#### Vitest suites

-   [x] `types`/`utils`: focused Vitest coverage covers Zod schemas, registry, semantic key/locale/action/media normalizers, URL allowlist, UUID v7 helper, and marketing contracts.
-   [x] `apps-template-mui`: marketing sections, typed loader, dispatcher, App/standalone entrypoints, theme-boundary behavior, loading/error/missing-media, i18n, keyboard semantics, sanitized rich-text boundary (when Page blocks are enabled), no raw ID/JSON/object output, and dashboard regression. `@testing-library/user-event` is an explicit catalog-owned direct devDependency, so frozen installs do not rely on a transitive copy.
-   [x] `applications-frontend`: focused Vitest coverage covers API wrappers, runtime envelope parsing, dispatcher integration, unknown-template fail closed, and ApplicationRuntime control-panel boundaries.
-   [x] `metahubs-frontend`: focused Vitest coverage covers template picker/layout editor, friendly labels, marketing config forms, field-control semantics, sync action, and localized validation.

Coverage for changed marketing/dispatch/contract files is mandatory in CI (`VITEST_ENFORCE_COVERAGE=true` where supported); do not rely on the default non-enforcing local mode.

#### Playwright API and browser suites

-   [x] Add the tagged marketing lifecycle flows: localized template-picker creation, manifest/seed inspection, publication/application creation, runtime section/materialization assertions, authoring edit→publish→sync→reload, workspace create/edit/copy/delete/reset, cross-scope mutation checks, and export/import round trip.
-   [x] Keep user-visible authoring/reset controls browser-first where the existing UI exposes them; use API calls only for deterministic setup and direct-bypass assertions. After reload, assert the changed semantic value and verify source/provenance through the typed authoring response (the published marketing surface intentionally does not expose internal provenance badges).
-   [x] Extend `marketing-page-permissions.spec.ts` with owner/admin/editor/read-only member and anonymous behavior, UI affordance gating, direct API `401/403`, editor positive content update, member content-row create/update/copy/delete denial with unchanged readback, cross-application isolation, and no visible leakage.
-   [x] Add `tools/testing/e2e/specs/matrix/marketing-page-visual.spec.ts` with an `@marketing-page` tag. The existing locale/theme projects match `specs/matrix/**`; the suite parameterizes 1920×1080, 768×1024, and 390×844 for EN/RU × light/dark, proves localized runtime, keyboard/focus, browser-error, safety, and overflow contracts, and stores 12 baselines.
-   [x] Provision the locale/theme matrix independently: those projects intentionally start with empty `storageState`. Each matrix test creates its own run-scoped marketing application using `runManifest.runId` plus the existing login helper, obtains its own `applicationId`, registers cleanup, and never depends on a previous flow spec or a shared mutable fixture. The wrapper serializes projects to protect the shared run-manifest writer.
-   [ ] Run the entire unrelated lifecycle/regression inventory alongside the new marketing files: `app-runtime-views.spec.ts`, `application-runtime-rows.spec.ts`, `application-layout-management.spec.ts`, dashboard visual/menu/CRUD tests, and the localized template-picker pattern in `metahub-1c-compatible-template.spec.ts`. The marketing acceptance wrapper has real rendered-route evidence; this broader regression run remains a separate resource-sensitive gate.
-   [x] Add package architecture/RTL guards for generic dialogs, safe display/resource preview, relations, cards, menus, and row actions used by marketing authoring; guards stay at the public package boundary and reject bespoke object rendering.
-   [x] Keep locale/theme visual assertions in `specs/matrix/**` for all four projects. `expect(page).toHaveScreenshot(...)` uses disabled animations, deterministic local assets, settled fonts/data, and matching browser/container versions; every changed baseline was regenerated and inspected with `view_image`.
-   [x] Use role/label/stable-testid locators, web-first assertions, no sleeps, retained failure traces, failure screenshots/video, and listeners for unexpected page/console/API errors. Marketing flows assert UUID/object leakage, semantic field controls, localized validation, safe links/media, no page overflow, and inspect `href`, `src`, `alt`, and relevant `data-*` attributes; DataGrid-specific oracles are not forced onto the cards-only runtime.
-   [x] Include keyboard/focus paths (template selection, mobile drawer open/close/return, section anchors, CTA, FAQ), `<html lang>` and locale reload checks, reduced motion, contrast, no full-page overflow, constrained internal scroll only where intended, and visible loading/empty/error/missing-media states.

#### Local minimal-Supabase execution

Use the repository wrapper; never start `pnpm dev` for these tests. Add a dedicated `tools/testing/e2e/support/runMarketingPageVerificationLocalSupabase.mjs` gate, modeled on the existing local-Supabase verification scripts, that invokes setup/build/runner processes sequentially and stops Supabase in `finally`; the markdown commands below describe its constituent steps, not a cleanup-fragile manual-only gate:

```bash
set -euo pipefail
trap 'pnpm supabase:e2e:stop || true' EXIT
pnpm supabase:e2e:start:minimal
pnpm env:e2e:local-supabase
pnpm doctor:e2e:local-supabase
pnpm exec cross-env \
  UNIVERSO_ENV_FILE=.env.e2e.local-supabase \
  UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase \
  pnpm run build:e2e
pnpm exec cross-env \
  UNIVERSO_ENV_FILE=.env.e2e.local-supabase \
  UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase \
  node tools/testing/e2e/run-playwright-suite.mjs \
  --project chromium --grep @marketing-page \
  tools/testing/e2e/specs/flows/marketing-page-runtime.spec.ts \
  tools/testing/e2e/specs/flows/marketing-page-permissions.spec.ts
pnpm exec cross-env \
  UNIVERSO_ENV_FILE=.env.e2e.local-supabase \
  UNIVERSO_FRONTEND_ENV_FILE=packages/universo-react-core-frontend/.env.e2e.local-supabase \
  node tools/testing/e2e/run-playwright-suite.mjs \
  --project chromium --project ru-light --project ru-dark --project en-light --project en-dark \
  tools/testing/e2e/specs/matrix/marketing-page-visual.spec.ts
# If a separate visual spec exists, run it as a Chromium-only process:
# node tools/testing/e2e/run-playwright-suite.mjs --project chromium tools/testing/e2e/specs/visual/marketing-page.visual.spec.ts
```

The wrapper owns production app startup and cleanup. Do not run generator and visual/runtime runners concurrently because each runner may clean report directories. Do not use `supabase:e2e:nuke` unless the user explicitly authorizes destructive cleanup.

### Phase 11 — Documentation and GitBook deliverables

-   [x] Rewrite `packages/universo-react-apps-template-mui/README.md` and `README-RU.md` for the isolated runtime API, dashboard/marketing dispatch, theme boundary, data contract, i18n, and test commands. `src/marketing-page/README.md` no longer instructs users to copy a stock demo and documents the approved newsletter capability boundary.
-   [x] Update the relevant template, metahubs, applications, core, auth, admin, profile, and testing README files for direct MUI ownership, v9 support, Pro/Base decisions, and runtime boundaries; stale MUI 7/X 8 claims in the touched docs are removed.
-   [x] Add synchronized GitBook pages `docs/en/platform/marketing-page-template.md` and `docs/ru/platform/marketing-page-template.md`, covering template creation, entity model, localized editing, seed/provenance/reset, application settings versus workspace ownership, safe links/media, runtime routes, dashboard regression, newsletter boundary, and troubleshooting.
-   [x] Update the affected EN/RU platform/guide pages and both `SUMMARY.md` files where ownership/import/runtime contracts changed.
-   [x] Runtime Playwright screenshots and manual `view_image` inspection are mandatory acceptance evidence. The reviewed EN/light desktop asset is published in `docs/en/.gitbook/assets/marketing-page/`; the manifest records route, locale, theme, viewport, browser, source/runtime hash, and capture date, while 12 responsive baselines remain tracked under `tools/testing/e2e/specs/matrix/`. The wrapper runs the provenance, i18n, asset, link, and feature checks.
-   [x] Document that no schema/template version changed, IDs are UUID v7, external URLs are constrained, minimal Supabase does not prove Storage API, and golden screenshots are source/date/versioned evidence rather than arbitrary snapshots.

### Phase 12 — Repository-wide verification and closeout

-   [x] Run `pnpm install --frozen-lockfile`, the MUI policy checker, package builds/typechecks/lints, target Jest suites through the repository wrapper, and the changed dashboard/application regression suites. The broad `apps-template-mui` Vitest invocation was attempted but interrupted after a resource-sensitive unrelated Interpretation Network tail; focused acceptance suites remain green.
-   [x] Record exact package gates in the implementation report (including types/utils/apps-template builds, scoped lints/tests, metahubs/applications Jest suites, and `pnpm run check:mui-v9-policy`). New suites are registered in the existing Vitest/Jest/Playwright runners.
-   [x] Run fixture contract/drift/hash checks and documentation/i18n/link/screenshot checks. Run `git diff --check` and inspect the diff for accidental generated JavaScript, secrets, absolute paths, raw URLs, or unrelated Prettier churn.
-   [x] Run the local minimal-Supabase Playwright lifecycle, permissions, matrix, and visual suites. The wrapper archives run-scoped HTML reports and passed-result markers under `tools/testing/e2e/.artifacts/marketing-page/`; screenshot provenance and docs drift checks pass, and the committed EN/light screenshot was inspected with `view_image`.
-   [ ] Re-run OntoIndex freshness/impact and the project Thermos/autoreview gate from a writable environment. The current graph is stale/degraded for this dirty worktree and the independent autoreview remains unavailable; neither is represented as clean.
-   [x] Update `memory-bank/currentResearch.md` and `memory-bank/tasks.md` after implementation/QA evidence exists. Workspace CRUD, reset operation audit, cross-scope content isolation, template-picker authoring, export/import, runtime axe, and responsive visual gates are demonstrated; only production media-origin evidence and unavailable independent review tooling remain bounded.

## Code Examples (illustrative contracts, not implementation commits)

### Safe discriminated schema

```ts
const safeExternalUrlSchema = z
    .string()
    .url()
    .refine((value) => {
        const url = new URL(value)
        return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
    }, 'Unsupported or unsafe link')

const safeInternalHrefSchema = z.string().refine((value) => {
    if (value.startsWith('//') || (!value.startsWith('/') && !value.startsWith('#'))) return false
    if (value.startsWith('#')) return /^#[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)
    const url = new URL(value, 'https://platform.invalid')
    return url.origin === 'https://platform.invalid' && !url.username && !url.password
}, 'Unsupported or unsafe internal target')

const marketingLinkBase = {
    semanticKey: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
    label: localizedTextSchema,
    order: z.number().int().min(0).max(10_000),
    visible: z.boolean().default(true)
}

const marketingLinkSchema = z.discriminatedUnion('actionKind', [
    z.object({ ...marketingLinkBase, actionKind: z.literal('internal'), href: safeInternalHrefSchema }),
    z.object({ ...marketingLinkBase, actionKind: z.literal('external'), href: safeExternalUrlSchema }),
    z.object({ ...marketingLinkBase, actionKind: z.literal('mailto'), href: z.string().regex(/^mailto:[^\s]+$/) }),
    z.object({ ...marketingLinkBase, actionKind: z.literal('tel'), href: z.string().regex(/^tel:\+?[0-9 ()-]{3,32}$/) })
])

const runtimeViewModelSchema = z.discriminatedUnion('templateKey', [
    z.object({ templateKey: z.literal('dashboard'), dashboard: dashboardRuntimeDataSchema }),
    z.object({ templateKey: z.literal('marketing-page'), marketingPage: marketingPageDataSchema })
])
```

The real implementation must validate action kind and URL scheme together (as above), enable `mailto`/`tel` only by an explicit product policy, sanitize before persistence and render, and apply `target`/`rel` (`noopener noreferrer` for external `_blank` links). Never show the validation string directly to a user without a localized mapping.

### Parameterized SQL with row confirmation

```ts
// `verifiedMetadata.tableName` is resolved from trusted published metadata;
// no marketing-specific table or schema is introduced by this feature.
const table = qSchemaTable(schemaName, verifiedMetadata.tableName)
const updated = await executor.query<{ id: string }>(
    `
        UPDATE ${table}
        SET label = $1, href = $2, _seed_source_key = NULL
        WHERE id = $3 AND ${qWorkspaceColumn()} = $4 AND _upl_deleted = false
        RETURNING id
    `,
    [labelVlc, safeHref, rowId, workspaceId]
)

if (updated.length !== 1) {
    throw new DomainNotFoundError('marketing.link')
}
```

The actual store must use the repository's `DbExecutor`/request executor boundary, schema-qualified identifiers, bind parameters, transaction ownership, RLS, and a localized domain-error mapping. Never interpolate a user-provided table/column name or silently treat zero rows as success.

### Presentational renderer with no demo arrays

```tsx
export function MarketingPage({ data, onAction }: MarketingPageProps) {
    return (
        <>
            <MarketingAppBar links={data.navigation} onAction={onAction} />
            <main>
                <Hero data={data.hero} onAction={onAction} />
                <LogoCollection items={data.logos} />
                <Features items={data.features} />
                <Testimonials items={data.testimonials} />
                <Highlights items={data.highlights} />
                <Pricing tiers={data.pricing} onAction={onAction} />
                <FAQ items={data.faq} />
            </main>
            <MarketingFooter data={data.footer} onAction={onAction} />
        </>
    )
}
```

`MarketingPage` receives already normalized, localized data and safe action descriptors. It does not fetch arbitrary tables, import legacy packages, create a theme provider, or fall back to a component-owned stock array when a record is missing.

### TanStack Query loader with a stable key and bounded parallel work

```ts
export function useMarketingPage(applicationId: string, locale: SupportedLocale) {
    return useQuery({
        queryKey: ['application-runtime', applicationId, 'marketing-page', locale],
        queryFn: () => getMarketingPageRuntime({ applicationId, locale }),
        staleTime: 30_000,
        retry: false,
        select: (payload) => runtimeViewModelSchema.parse(payload)
    })
}
```

The backend loader should use a bounded aggregate or `Promise.all` over fixed registry sections, not a client-supplied collection list. Tests create a fresh `QueryClient`, disable retries, and assert invalidation after an approved mutation.

### Browser-first visual and UX assertion

```ts
test('marketing page is usable at the mobile locale/theme matrix point', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/a/${applicationId}`)

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByTestId('marketing-mobile-menu-toggle')).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    await expect(page).toHaveScreenshot('marketing-page-ru-dark-390x844.png', {
        animations: 'disabled',
        mask: [page.locator('[data-volatile]')]
    })
    await expectNoPageHorizontalOverflow(page, 'marketing-page ru dark mobile')
    await expectNoTechnicalLeakage(page.locator('body'), { checkUuidSubstrings: true })
})
```

The real test must use the repository fixtures/oracles and stable role/label/test-id locators. It must inspect generated screenshots, not only assert that a file was written.

## Potential Challenges and mitigations

| Risk                                                                     | Mitigation and release gate                                                                                                                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MUI v9 is a coordinated breaking migration, not a catalog bump           | Pin one policy, run official Core/System/X codemods, maintain a residual ledger, manually review known APIs, and run package/dashboard browser regressions.                                 |
| `@mui/base`, `@mui/lab`, Pro packages, and undeclared transitive imports | Remove dead dependencies or make an explicit approved replacement/license/ownership decision; static checker and frozen install fail closed.                                                |
| React 18 with multiple `react-is` versions                               | Add an explicit override/resolution and verify lockfile/peer graph and test runtime.                                                                                                        |
| Dashboard-only layout assumptions                                        | Shared registry and discriminated runtime envelope; marketing branch before dashboard hooks; no widget registry mixing or default fallback.                                                 |
| Publication/sync silently loses `templateKey`                            | Query/store/serialize/restore/sync tests and fail-fast attachment; unknown/malformed values are errors.                                                                                     |
| Republish overwrites workspace content                                   | Initial-only seed marker, authored transition, workspace-scoped predicates, explicit reset, `RETURNING`, and cross-scope tests.                                                             |
| Synthetic UUID v5 IDs are mistaken for persisted entity IDs              | Keep deterministic derived keys typed/non-persisted; enforce UUID v7 only for persisted rows.                                                                                               |
| Hosted and standalone nested themes                                      | Provider-free marketing renderer, one owner per host, React-tree and browser assertions.                                                                                                    |
| Existing marketing folder is mistaken for finished integration           | Replace static arrays/stock README with a typed renderer, export/dispatch it, and prove real metahub data in browser.                                                                       |
| Inert stock controls or unsafe URLs                                      | Require action policy, safe URL/resource validation, explicit hide/disabled semantics, and negative tests for `javascript:`, `data:`, credentials, `#`, missing media, and blocked origins. |
| Minimal Supabase does not provide Storage API/imgproxy                   | Use local deterministic assets in minimal tests and a separate full-stack media suite when needed; document the boundary.                                                                   |
| Locale/theme matrix silently misses flows                                | Put the matrix spec under `specs/matrix/**` or change project matching; assert controls are usable at every viewport, not overflow alone.                                                   |
| Parallel fixture/report races                                            | Run generators separately or single-worker, use run IDs, register cleanup, and archive reports between runners.                                                                             |
| Screenshot drift or unstable external images                             | Bundle/localize assets, disable animations, mask only documented volatility, record source/fixture hash and inspect with `view_image`.                                                      |
| Raw IDs/JSON/object cells leak through generic UI                        | Reuse safe display/ResourcePreview/field primitives and enforce all runtime UX oracles plus attribute-level URL/media checks.                                                               |
| Stale docs claim four/seven templates or MUI 7/X 8                       | Update affected package and GitBook docs in EN/RU, run i18n/link/screenshot checks, and keep source/tests authoritative.                                                                    |
| OntoIndex/autoreview environment unavailable                             | Re-check freshness, use direct source tests, report degraded graph/review tooling, and never label an unavailable independent review as clean.                                              |

## Dependencies and sequencing

1. Phase 0 decisions and baseline precede every code edit.
2. Phase 1 dependency/API work and Phase 2 neutral contracts must land before seed, sync, or renderer code consumes them.
3. Phases 3–5 establish the metahub, layout, publication, sync, and ownership truth before runtime data loading.
4. Phase 6 transport precedes Phase 7 dispatch/renderer and Phase 8 authoring UI.
5. Phase 9 fixture generation waits for the transport and ownership contracts to stabilize; otherwise a generated artifact will encode the wrong shape.
6. Phases 10–12 are mandatory acceptance/closeout, not optional cleanup.

Cross-package dependencies must flow through workspace package names, not relative imports. New frontend code is TypeScript/TSX and follows the package build conventions. Backend data access remains SQL-first with the existing three-tier executor rules. No schema migration is permitted; if an ownership requirement cannot be expressed with existing metadata, implementation pauses for a revised contract.

## Acceptance and Definition of Done

-   [x] All approved MUI Core/X/System/Icons/Utils/Emotion packages resolve to the coherent v9 policy; no unapproved v5/v7/v8 package, duplicate major, stale peer range, undeclared direct import, or dead Pro/Base dependency remains.
-   [x] All changed packages build, lint, typecheck, and pass focused Jest/Vitest suites; changed marketing/dispatch files meet the agreed coverage gate.
-   [x] Registry has exactly the existing seven metahub codenames plus `marketing-page`; application layout keys are shared and validated; unknown values fail closed.
-   [x] Marketing manifest and seed use existing entity presets, UUID v7 persisted IDs, localized deterministic records, the field-level baseline contract (including labels/copy/targets/media alt keys), exact baseline order/counts, safe media/actions, and unchanged schema/template/snapshot versions.
-   [x] Publication, snapshot restore, application sync, export/import, and workspace materialization preserve `templateKey`, config, provenance, and authored data without dashboard fallback/injection.
-   [x] Runtime API returns typed marketing data without dashboard-only requirements; hosted and standalone dispatch to the marketing renderer; dashboard regression remains green; theme provider count is one per host.
-   [x] Generic authoring/control-panel surfaces satisfy the UI Contract: friendly values, hidden system fields, multiline long text, localized validation, safe previews/actions, permission gating, keyboard/focus semantics, axe checks, and no page overflow.
-   [x] Playwright real lifecycle proves template selection → metahub → publication → application → runtime → edit/publish/sync → workspace CRUD → override/reset → export/import. Direct API/RBAC bypass and cross-scope isolation are tested.
-   [x] EN/RU × light/dark × 1920×1080/768×1024/390×844 evidence includes inspected screenshots, settled content, `<html lang>`, keyboard paths, no technical leakage, no unsafe URLs/media, no page-level horizontal overflow, and no console/page errors.
-   [x] The approved fixture path passes contract/drift checks, or the equivalent deterministic lifecycle gate is archived. Synchronized GitBook EN/RU pages include the reviewed runtime screenshots and provenance; `docs:i18n:check`, `docs:gitbook-screenshot-assets:check`, link and screenshot-drift checks pass.
-   [ ] `git diff --check`, OntoIndex change verification, and Thermos/autoreview have evidence; unavailable tooling is reported rather than represented as a clean review.

## Resolved decisions and remaining closeout evidence

-   [x] Core/System/Icons/Utils `9.2.0`, MUI X `9.8.0`, Emotion 11-compatible peers, React `18.3.1`, and the repository release-age policy are recorded and checked by the lockfile/policy gates.
-   [x] Pro packages are retained only for required type augmentation; no runtime Pro component or license-key path is part of this slice. The policy checker documents the exception.
-   [x] Marketing is authenticated-only for the first release; application template choice is immutable; dashboard↔marketing switching is rejected rather than silently normalized.
-   [x] CTA/navigation/sign-in/up/pricing/footer/newsletter behavior uses safe internal/auth actions or approved safe links; absent/unsafe actions are hidden or rendered non-interactive with localized feedback.
-   [x] Media uses validated resource summaries and deterministic fallbacks; external unsafe schemes are rejected. A full Storage API suite remains outside the minimal-Supabase claim.
-   [x] Seed ownership is initial-only with explicit owner/application-admin reset; authored rows are protected and provenance is cleared on user mutation.
-   [x] Workspace switcher/divider injection is dashboard-only; marketing layouts do not receive dashboard widgets.
-   [x] A tracked marketing snapshot fixture is optional in this slice because the built-in template contract is deterministic; the equivalent API-provisioned create → publish → sync → runtime materialization lifecycle gate is executed by the local wrapper.
-   [x] Capture and inspect the authenticated minimal-Supabase Chromium lifecycle plus the EN/RU × light/dark responsive matrix; publish EN/light GitBook screenshot provenance and pass the docs screenshot/link drift gates. Matrix baselines are tracked under `tools/testing/e2e/specs/matrix/`.
-   [x] Add browser/API evidence for UI authoring, workspace CRUD, seed reset with durable operation audit, export/import, and content-row cross-scope mutation. Runtime/layout permission bypasses are covered by `marketing-page-permissions.spec.ts` and the local wrapper. The remaining media evidence boundary is explicitly limited to production Storage/imgproxy origins, which are unavailable in the minimal Supabase profile.
-   [ ] Re-run final OntoIndex `gn_verify_diff` and Thermos/autoreview from an environment that can complete those tools; report unavailable tooling instead of treating it as a clean review.

## Current external references

-   [Material UI v9 migration guide](https://mui.com/material-ui/migration/upgrade-to-v9/)
-   [Material UI System v9 migration guide](https://mui.com/system/migration/upgrade-to-v9/)
-   [MUI X Data Grid v9 migration](https://mui.com/x/migration/migration-data-grid-v8/)
-   [MUI X Charts v9 migration](https://mui.com/x/migration/migration-charts-v8/)
-   [MUI X Pickers v9 migration](https://mui.com/x/migration/migration-pickers-v8/)
-   [MUI X Tree View v9 migration](https://mui.com/x/migration/migration-tree-view-v8/)
-   [MUI X licensing](https://mui.com/x/introduction/licensing/)
-   [Official MUI templates](https://mui.com/material-ui/getting-started/templates/)
-   [TanStack Query React documentation](https://tanstack.com/query/latest/docs/framework/react/overview)
-   [Playwright screenshot assertions](https://playwright.dev/docs/test-snapshots)
-   Context7: `/mui/material-ui`, `/mui/material-ui/v9.2.0`, `/mui/mui-x`, and `/tanstack/query/v5.90.3` (queried 2026-08-30; the X index was partly stale, so direct official MUI X pages remain authoritative).
