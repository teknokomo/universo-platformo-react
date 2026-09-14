# Research: Composable Marketing Header Widgets and Generic Layout-Zone Settings

> Created: 2026-09-12
> Status: QA-reviewed and corrected
> Trigger: RESEARCH request for the marketing-header widget-zone settings brief
> Brief requirements: captured in this research document
> Source task: original user requirements summarized in the Research Question and Scope below
> Follow-up plan: not created in RESEARCH mode; expected `../plan/marketing-header-widget-zone-settings-plan-2026-09-12.md`

## Research Question

How should Universo refactor the MUI `marketing-page` header so `marketing-header` becomes one real compositional layout zone made from independent persisted widgets, while also introducing the first generic typed layout-zone setting for fixed-versus-in-flow header behavior without adding a database/schema/snapshot/metahub-template version bump or a marketing-only settings subsystem?

The research must also establish how the new zone setting participates in the existing metahub → snapshot → application materialization → synchronization → effective-layout lifecycle, how same-template inheritance/reset must work, how the runtime should preserve the MUI 9 visual/mobile/accessibility contract, and which existing tests must change because they currently encode the old multi-AppBar workaround.

## Scope And Method

-   Reviewed the supplied MANAGER brief and source task.
-   Re-read the three directly related research artifacts and the current implementation closeout record.
-   Inspected the current neutral widget/zone registry, application layout contracts, metahub layout inheritance, application persistence/sync/hash code, hosted runtime adapter, marketing renderer, shared authoring primitive, and the named unit/E2E suites.
-   Used the project skills `research-before-plan`, `universo-platform-architecture`, `mui-runtime-ux-patterns`, `runtime-ux-qa`, `zod`, and `playwright-best-practices`, plus the Context7 workflow required by the brief.
-   Queried Context7 against exact Material UI `/mui/material-ui/v9.2.0` documentation for fixed AppBar behavior and Modal/temporary-overlay keyboard/focus behavior, and against Zod `/colinhacks/zod/v3.24.2` for strict-object behavior.
-   Performed current web checks against official MUI, MDN, React, Zod and WAI-ARIA APG documentation, including CSS `scroll-padding-block-start` for fixed-header anchor compensation.
-   Used OntoIndex as advisory navigation for the layout/runtime area; direct current source and tests are authoritative for repository-specific conclusions in this QA pass.
-   Incorporated three independent read-only subagent passes covering runtime/header decomposition, persistence/synchronization/inheritance, and verification/UX/test contracts.

No product code, database migration, template version, or manager brief was changed by this RESEARCH pass.

## QA Review Result

**Verdict: pass with required corrections, all incorporated below.** The core direction of the original RESEARCH matches the brief and the project's current MUI/React/Zod/layout architecture, but QA found two contract blockers and several major precision/test gaps that had to be corrected before PLAN:

1. Snapshot/storage representation is now unambiguous: existing serialized layout `config` remains the physical wire carrier for reserved neutral metadata, while decoded API/effective contracts may expose typed `zoneSettings`. PLAN must not create a second parallel snapshot representation by accident.
2. Application synchronization must atomically persist the latest source zone-settings baseline on source updates even when `keep_local` preserves the local sparse override; hashes alone cannot make later reset reveal the latest source state.
3. A dedicated zone-setting mutation/reset is required. The existing whole marketing appearance-config reset must not silently acquire different semantics.
4. One canonical neutral layout-envelope codec must replace the current duplicated composition strip/reattach logic before adding more neutral metadata.
5. Header logical placement remains a required typed end-to-end capability, but its physical encoding is a PLAN decision; the authoring UI must provide a localized keyboard-accessible way to move a persisted widget between logical start/end groups.
6. The semantic header contract is exactly one accessible `banner` owner. MUI `AppBar` defaults to `component="header"`, so an outer `<header>` plus a default AppBar would create duplicate banner landmarks.
7. Browser acceptance was strengthened for real language/theme interaction, accessibility-tree uniqueness on mobile, measured fixed-header geometry, anchor/skip-link compensation, open-Drawer Axe coverage, and current application/metahub permission behavior.

No new browser run was performed by this document-only QA pass; these browser checks are PLAN/implementation acceptance requirements rather than claims of current behavior.

## Source Inventory

| Source                                                                                                                               | Type                                | Date / Freshness     | Why It Matters                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Current requirements captured in this research document                                                                             | Current project brief               | 2026-09-12           | Normative scope, clean-break constraints, UI contract, lifecycle and acceptance requirements                                         |
| Original user requirements summarized in this research document                                                                     | Original task input                 | 2026-09-12           | User intent: make the marketing top bar a composable zone and add fixed/scrolling zone behavior                                      |
| `mui-9-marketing-page-template-research-2026-08-30.md`                                                                               | Prior repository research           | Rechecked 2026-09-12 | MUI 9 visual provenance, package boundaries, runtime/template ownership                                                              |
| `marketing-page-widgetized-runtime-research-2026-09-04.md`                                                                           | Prior repository research           | Rechecked 2026-09-12 | Marketing widgetization decisions and historical gaps                                                                                |
| `unified-application-template-widgets-scoped-layouts-research-2026-09-07.md`                                                         | Prior repository research           | Rechecked 2026-09-12 | Neutral registry, effective-layout, scoped/independent composition and lifecycle contracts                                           |
| `../../packages/universo-react-types/src/common/layoutWidgetDefinitions.ts`                                                          | Direct source                       | Current HEAD         | Canonical widget/zone registry; `LayoutZoneDefinition` currently has no settings capability                                          |
| `../../packages/universo-react-types/src/common/applicationLayouts.ts`                                                               | Direct source                       | Current HEAD         | Strict serialized/effective layout contracts, composition lineage, widget validation                                                 |
| `../../packages/universo-react-applications-backend/src/persistence/applicationLayoutStoreSupport.ts`                                | Direct source                       | Current HEAD         | Existing neutral extraction/recomposition precedent for `compositionMode` and `baseLayoutId` inside JSONB                            |
| `../../packages/universo-react-applications-backend/src/persistence/applicationLayoutsStore.ts`                                      | Direct source                       | Current HEAD         | Current marketing config reset behavior and optimistic-concurrency contract                                                          |
| `../../packages/universo-react-applications-backend/src/persistence/applicationLayoutSyncStore.ts`                                   | Direct source                       | Current HEAD         | Whole-layout source/local hash conflict model and `keep_local`/`overwrite_local`/`copy_source_as_application`/`skip_source` behavior |
| `../../packages/universo-react-applications-backend/src/utils/applicationLayoutHash.ts`                                              | Direct source                       | Current HEAD         | Current semantic hash includes the entire exposed layout config                                                                      |
| `../../packages/universo-react-applications-backend/src/services/effectiveLayoutResolver.ts`                                         | Direct source                       | Current HEAD         | Independently strips composition metadata today; confirms need for one canonical neutral codec                                       |
| `../../packages/universo-react-applications-backend/src/controllers/applicationLayoutsController.ts`                                 | Direct source                       | Current HEAD         | Application layout read/write RBAC and existing layout-version/OCC HTTP behavior                                                     |
| `../../packages/universo-react-metahubs-backend/src/domains/layouts/services/MetahubLayoutsService.ts`                               | Direct source                       | Current HEAD         | Scoped layout creation currently copies base config; widget overrides already demonstrate sparse inheritance/reset semantics         |
| `../../packages/universo-react-metahubs-backend/src/domains/shared/snapshotLayouts.ts`                                               | Direct source                       | Current HEAD         | Snapshot currently transports each layout's existing `config` object and separate composition fields                                 |
| `../../packages/universo-react-utils/src/validation/marketingSnapshot.ts`                                                            | Direct source                       | Current HEAD         | Snapshot preflight validates layout config as a record before destructive restore/materialization paths                              |
| `../../packages/universo-react-applications-frontend/src/pages/application-runtime/runtimeLayout.ts`                                 | Direct source                       | Current HEAD         | `toMarketingLayoutWidgets()` currently drops widget `config`, so neutral placement metadata would be lost                            |
| `../../packages/universo-react-types/src/common/marketingPage.ts`                                                                    | Direct source                       | Current HEAD         | Strict `marketingPageConfigSchema` and current marketing renderer configuration boundary                                             |
| `../../packages/universo-react-apps-template-mui/src/marketing-page/MarketingPage.tsx`                                               | Direct source                       | Current HEAD         | Old header ownership workaround: shell owner, forced fixed navigation, repeated AppBar stack arithmetic, shared-layout side channel  |
| `../../packages/universo-react-apps-template-mui/src/marketing-page/components/AppAppBar.tsx`                                        | Direct source                       | Current HEAD         | Current composite responsibilities: brand, nav, auth, language, color mode, mobile trigger/Drawer/focus ownership                    |
| Installed `@mui/material@9.2.0` `AppBar/AppBar.mjs`                                                                                  | Direct dependency source            | Current checkout     | MUI AppBar defaults its root to `component="header"`; duplicate wrapper landmarks must be avoided                                    |
| Shared `LanguageSwitcher` / `ColorModeIconDropdown` and application theme owner                                                      | Direct source                       | Current HEAD         | Existing reusable controls and app-level theme ownership support independent persisted header widgets                                |
| `../../packages/universo-react-template-mui/src/components/layouts/LayoutAuthoringDetails.tsx`                                       | Direct source                       | Current HEAD         | Shared zone authoring surface has zone cards but no zone-level Settings action                                                       |
| `MarketingPage.test.tsx`, `cross-template-runtime.spec.ts`, layout/sync/snapshot/permissions suites named by the brief               | Direct tests                        | Current checkout     | Existing legacy multi-AppBar assumptions plus lifecycle, permissions, snapshot, sync and responsive oracles to extend                |
| Context7 `/mui/material-ui/v9.2.0` → App Bar docs                                                                                    | Primary version-pinned library docs | Checked 2026-09-12   | Fixed AppBar is removed from normal flow and needs an explicit offset/spacer strategy                                                |
| Context7 `/mui/material-ui/v9.2.0` → Modal/App Bar docs                                                                              | Primary version-pinned library docs | Checked 2026-09-12   | Fixed AppBar offset and modal focus/Escape behavior                                                                                  |
| Context7 `/colinhacks/zod/v3.24.2`                                                                                                   | Primary version-pinned library docs | Checked 2026-09-12   | `.strict()` rejects unknown keys; neutral metadata must be extracted before strict renderer parsing                                  |
| [MUI App Bar](https://mui.com/material-ui/react-app-bar/)                                                                            | Primary official docs               | Checked 2026-09-12   | Public documentation for fixed positioning and offset behavior                                                                       |
| [MUI Stack](https://mui.com/material-ui/react-stack/) and [MUI Flexbox](https://mui.com/system/flexbox/)                             | Primary official docs               | Checked 2026-09-12   | Responsive one-dimensional composition and flex alignment                                                                            |
| [MUI Modal](https://mui.com/material-ui/react-modal/)                                                                                | Primary official docs               | Checked 2026-09-12   | Focus management behavior used by modal/Drawer-style overlays                                                                        |
| [MDN CSS `position`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position)                                 | Primary browser-platform docs       | Checked 2026-09-12   | Confirms fixed positioned elements leave normal flow                                                                                 |
| [MDN Resize Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Resize_Observer_API)                                      | Primary browser-platform docs       | Checked 2026-09-12   | Standard primitive for reacting to rendered element size changes                                                                     |
| [MDN `scroll-padding-block-start`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-padding-block-start) | Primary browser-platform docs       | Checked 2026-09-12   | Lets a scroll container exclude a fixed-toolbar occlusion region when bringing targets into view                                     |
| [React: Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)                                  | Primary framework docs              | Checked 2026-09-12   | Supports one owner for coordinated shell state such as one mobile Drawer                                                             |
| [Zod documentation](https://v3.zod.dev/)                                                                                             | Primary library docs                | Checked 2026-09-12   | Confirms strict-object unknown-key rejection                                                                                         |
| [WAI-ARIA APG Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)                                         | Primary accessibility guidance      | Checked 2026-09-12   | Top-level banner guidance and distinguishable naming for repeated navigation landmarks                                               |

## Key Findings

### 1. `marketing-header` is persisted as a zone, but `marketing.navigation` still owns the real shell

-   **[Fact]** `MarketingPage.tsx` groups widgets into `marketing-header`, `marketing-main`, and `marketing-footer`, but then finds the first `marketing.navigation` instance and makes it the shell owner for the independently persisted `languageSwitcher`.
-   **[Fact]** Every navigation instance is forced to `navigationPosition: 'fixed'`; repeated instances get synthetic stack indices and hard-coded height/gap arithmetic.
-   **[Fact]** `AppAppBar.tsx` still owns brand rendering, navigation links, sign-in/sign-up actions, the language switcher, the color-mode control, mobile menu button, one Drawer per navigation instance, Drawer state, Escape close through MUI, and explicit focus return to the menu trigger.
-   **[Inference]** Splitting only the JSX while retaining `marketing.navigation` as the persisted owner of brand/auth/theme/mobile behavior would preserve the same architectural coupling under different component names.
-   **[Recommendation]** Move AppBar/header/container/mobile-shell ownership to the `marketing-header` zone renderer. Persist functional content as independent widget instances and keep mobile menu coordination as a shell affordance rather than a placeable widget.

### 2. The clean atomic header taxonomy is five functional widgets plus one shell-only mobile affordance

The smallest clean split supported by current responsibilities and the brief is:

| Persisted capability                      | Recommended widget                 | Cardinality in `marketing-page` header | Responsibility                                                            |
| ----------------------------------------- | ---------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| Brand / home identity                     | `marketing.brand`                  | Single                                 | Logo/name/home action from marketing site settings                        |
| Navigation links                          | `marketing.navigation`             | Repeatable                             | One named navigation landmark per instance                                |
| Authentication actions                    | `marketing.auth`                   | Single                                 | Sign-in/sign-up actions only                                              |
| Locale control                            | existing shared `languageSwitcher` | Single                                 | Existing runtime locale/i18n behavior                                     |
| Color scheme control                      | new shared `colorModeSwitcher`     | Single                                 | Existing `ColorModeIconDropdown` / MUI `useColorScheme` behavior          |
| Mobile menu trigger + Drawer coordination | zone shell, not persisted          | Exactly one surface                    | Responsive projection, open/close state, focus return, Drawer aggregation |

-   **[Fact]** `LanguageSwitcher` is already generic and can render independently of marketing navigation.
-   **[Fact]** `ColorModeIconDropdown` is already a reusable shared-theme control under the existing app-level ThemeProvider; a nested marketing ThemeProvider is unnecessary.
-   **[Fact]** The canonical registry currently treats only `languageSwitcher` as cross-template shared; theme/color-mode is still shell-owned.
-   **[Recommendation]** Make the color-mode control a real shared persisted widget capability for Dashboard `top` and marketing `marketing-header`, then remove shell-specific duplicates from both templates as part of the same clean break.
-   **[Recommendation]** Preserve repeatable navigation because multiple separately named navigation groups are semantically valid; brand/auth/language/theme should remain singleton capabilities.

### 3. The current registry is the right authority, but it lacks zone-setting and template-aware cardinality metadata

-   **[Fact]** `LayoutZoneDefinition` currently contains only `key`, `templateKey`, `semanticRegion`, `labelKey`, and `defaultLabel`.
-   **[Fact]** `LayoutWidgetDefinition.multiInstance` is one global boolean even when a shared widget supports multiple templates.
-   **[Fact]** Zone/widget definitions are also serialized through strict Zod metadata response schemas, so the registry is API metadata rather than an in-process-only object graph.
-   **[Recommendation]** Extend the existing canonical registry; do not create a marketing settings registry. A zone definition should expose serializable setting descriptors/defaults (`key`, kind/options, default, localization keys and capability flags), beginning with `marketing-header.position = 'fixed' | 'flow'`, default `fixed`.
-   **[Recommendation]** Keep executable Zod schema instances out of serialized registry metadata. Build/select strict validators centrally at the neutral layout boundary from the supported descriptors.
-   **[Recommendation]** If shared widget cardinality differs by template in the future, make cardinality template-aware rather than adding runtime exceptions.
-   **[Recommendation]** Unknown template/zone/setting/value combinations must fail closed at the neutral boundary, just as invalid widget/template/zone placement does today.

### 4. Zone settings must be neutral layout metadata, separate from template renderer config

-   **[Fact]** `parseApplicationLayoutConfig('marketing-page', ...)` delegates to strict `marketingPageConfigSchema`; a bare `config.zoneSettings` field would be rejected.
-   **[Fact]** `applicationLayoutStoreSupport.ts` already demonstrates the correct architectural pattern: composition metadata is physically co-located in the existing JSONB but stripped before template-specific config parsing and reattached at the neutral layout boundary.
-   **[Fact]** `syncHelpers.ts` has its own composition strip/reattach helpers and `effectiveLayoutResolver.ts` manually removes the same fields. Neutral layout-envelope decoding is therefore duplicated across current boundaries.
-   **[Fact]** Marketing appearance authoring also strict-parses `layout.config`; leaking generic zone metadata into the renderer config would make valid layouts appear invalid.
-   **[Physical/wire contract]** Existing layout `config` remains the one physical JSONB/snapshot carrier. Reserved neutral metadata is encoded inside that existing object so the no-version-bump requirement does not create a parallel second wire format. Existing snapshot-level `compositionMode/baseLayoutId` fields may remain where they are until PLAN explicitly elects an atomic clean-break normalization.
-   **[Decoded contract]** After neutral-envelope decode, TypeScript/API/effective models may expose renderer-only `config` plus typed `zoneSettings`, source-baseline/provenance state and composition information as first-class fields. Renderer-specific parsers must see only renderer config.
-   **[Recommendation]** Replace the duplicated composition strip/merge logic with one canonical neutral layout-envelope codec shared by application storage, sync materialization, effective resolution and snapshot encode/decode/preflight as appropriate. The exact reserved JSON key is a PLAN detail.

Conceptual logical contract:

```ts
type LayoutZoneSettings = {
    'marketing-header'?: {
        position?: 'fixed' | 'flow'
    }
}

type NeutralLayoutEnvelope = {
    config: Record<string, unknown> // template renderer config only
    zoneSettings: LayoutZoneSettings
    compositionMode: 'overlay' | 'independent'
    baseLayoutId: string | null
}
```

This is the **decoded logical model**, not a second snapshot/storage shape. The important invariant is that neutral metadata is decoded before strict template parsing and validated against the canonical zone registry.

### 5. Same-template zone-setting inheritance must be sparse; copying base config is insufficient

-   **[Fact]** Current metahub same-template scoped layout creation copies the base layout config into the scoped row.
-   **[Fact]** Current widget inheritance does something stronger: base widget state is resolved with sparse `_mhb_layout_widget_overrides`, and reset deletes the override so the current base value becomes visible again.
-   **[Inference]** Copying a nested `zoneSettings` object into a scoped layout would freeze the inherited value and prevent later base updates from propagating. A shallow object merge would also replace an entire nested zone-settings object instead of merging individual setting keys.
-   **[Fact]** `MetahubLayoutsService` shallow-copies/merges renderer config and then strict-parses marketing config. Neutral zone metadata therefore has to be extracted before that merge/parser boundary.
-   **[Recommendation]** Zone settings should follow widget-override semantics even if they remain physically stored in the layout JSONB: overlay layouts persist only local per-zone/per-setting overrides; effective resolution is `registry default → base effective value → overlay override`; reset removes the local key.
-   **[Recommendation]** Keep existing renderer-config copy/merge semantics independent unless PLAN finds a reason to change them; the new sparse inheritance contract is specifically for neutral zone settings.
-   **[Recommendation]** Independent/global layouts do not inherit a base layout. For snapshot determinism, explicitly serialize the current owned/default value for supported settings instead of relying indefinitely on a future registry default.

### 6. Application sync needs a source baseline for zone settings; current layout reset cannot satisfy the brief

-   **[Fact]** Application widget rows have `source_config`; application layout rows do not have an equivalent source-config baseline.
-   **[Fact]** `resetApplicationLayoutConfig()` currently resets marketing config to parsed template defaults (`{}`), then hashes that result. It does not restore the latest source value.
-   **[Fact]** On `keep_local`, `syncApplicationLayouts()` updates source snapshot/content hashes while leaving the local config unchanged. The new upstream value itself is not retained in the application layout row.
-   **[Consequence]** The brief's required sequence `source=in-flow → local=fixed → upstream change → keep-local → reset → latest inherited source` cannot be implemented correctly for zone settings with the current row semantics.
-   **[Recommendation]** Store a source-zone-settings baseline alongside the application-local sparse zone overrides inside the reserved neutral JSONB metadata for metahub-derived layouts. Conceptually:

```ts
type ApplicationNeutralLayoutMetadata = {
    sourceZoneSettings?: LayoutZoneSettings
    zoneSettings?: LayoutZoneSettings // application-local sparse overrides
}
```

-   **[Recommendation]** Effective application value is `source baseline → local override`, with registry default applied when the source does not explicitly own a value. Every accepted source update must atomically persist the latest neutral source baseline together with the existing source hash/state transition. `keep_local` updates that baseline while preserving the local override; `overwrite_local` updates the baseline and clears the override.
-   **[Recommendation]** Add a dedicated scoped zone-setting mutation/reset that removes only the targeted sparse application override and immediately reveals the current source baseline. Reuse the existing layout `_upl_version`/OCC boundary. Do not silently change the semantics of the existing whole-layout marketing appearance-config reset endpoint.
-   **[Recommendation]** Keep the existing whole-layout conflict model in the first implementation. Setting-level three-way merge would add complexity without being required by the brief.

### 7. Semantic hashing must use effective zone settings, not internal source bookkeeping

-   **[Fact]** `normalizeApplicationLayoutForHash()` currently hashes the full exposed `layout.config` object.
-   **[Inference]** If `sourceZoneSettings` bookkeeping is included directly in the semantic local hash, a `keep_local` sync that only updates the source baseline could incorrectly make the local layout look newly modified.
-   **[Recommendation]** Distinguish storage representation from semantic projection. Storage may contain reserved neutral provenance/baseline metadata; the layout semantic hash should project renderer config plus effective semantic zone settings and the semantic composition already covered by the current model. Exclude `sourceZoneSettings`, reserved-envelope bookkeeping and provenance fields from the local semantic payload.
-   **[Recommendation]** Source content hashes should be computed from the source's semantic zone settings. After a reset that removes the local override, the local semantic hash should be able to converge to the source content hash.

### 8. Snapshot/export/import can support the feature without a version bump, but the strict contract must be extended atomically

-   **[Fact]** Snapshot layout transport already carries layout config generically and restore/materialization already reconstruct layouts and widgets from that contract.
-   **[Fact]** `applicationLayoutContractSchema` is strict; an unmodeled top-level `zoneSettings` field would be rejected.
-   **[Compatibility assessment]** The brief's no-version-bump constraint is feasible because existing snapshot layout `config` can remain the physical carrier, but this still requires an atomic contract change across neutral encode/decode, preflight validation, restore/materialization, application decoding and tests.
-   **[Recommendation]** Do not add a parallel top-level snapshot `zoneSettings` representation in this slice. Keep reserved neutral metadata inside existing serialized layout `config`; decode it into typed first-class neutral fields after the canonical codec runs. Snapshot preflight must validate malformed/unsupported reserved metadata fail-closed before destructive import/restore/materialization writes.
-   **[Recommendation]** Snapshot acceptance must set a non-default marketing-header value before export and prove `export → import → linked application → effective layout → real runtime geometry`.
-   **[Current-code correction]** An older 2026-09-07 research detail said scoped materialization could silently skip a missing base. Current materialization now fails closed for a missing base and current source is authoritative. The new PLAN must preserve that fail-closed behavior.

### 9. Header logical start/end placement must be typed, authorable and survive the hosted runtime adapter

-   **[Fact]** `toMarketingLayoutWidgets()` currently strips widget `config`, retaining only identity, key, zone, instance key, order and active state.
-   **[Consequence]** Any header-group placement stored in widget config would currently disappear before `apps-template-mui` renders it.
-   **[Requirement]** The renderer contract needs a typed logical `start | end` placement invariant for widgets in zones that support grouping, with registry defaults and explicit transport through effective layout and the hosted adapter.
-   **[PLAN decision]** Physical persistence remains open: a first-class neutral placement field/capability is the cleaner architectural candidate; a typed widget-config representation is possible only if every adapter preserves it. Whichever representation is selected must participate consistently in snapshot, inheritance/override, reset and semantic hashing. Do not treat placement as a free field outside those lifecycles.
-   **[Authoring requirement]** `LayoutAuthoringDetails` must expose a localized keyboard-accessible user action for changing logical placement, either through explicit Start/End subgroups/drop targets or through one widget-instance setting. Raw enum tokens are not user-facing. Browser acceptance must prove `start → end → reload → runtime placement`.
-   **[Recommendation]** Default header groups should be: brand/navigation → `start`; auth/language/color-mode → `end`. Persisted `sortOrder` remains authoritative inside each group.
-   **[Recommendation]** Do not use raw left/right CSS coordinates because RTL-capable logical layout should remain possible and responsive projection needs semantic groups rather than absolute positioning.

### 10. One zone shell should own exactly one AppBar/banner and one mobile Drawer

-   **[Fact, Context7/MUI]** A fixed AppBar is removed from document flow and MUI explicitly requires an offset/spacer strategy to prevent content being hidden beneath it.
-   **[Fact, dependency source]** MUI 9.2.0 `AppBar` defaults its root to `component="header"`, so wrapping a default AppBar in another semantic `<header>` would create two banner landmarks.
-   **[Fact, WAI]** APG treats the page-level header/banner as a primary landmark; repeated navigation regions should have meaningful distinguishable labels when their content/purpose differs.
-   **[Fact]** Current repeated navigation instances create multiple fixed AppBars and one Drawer/menu trigger per navigation instance. Existing tests intentionally encode this old behavior.
-   **[Recommendation]** Render exactly one semantic `banner` owner: either the zone-owned MUI AppBar itself is the `header`, or an outer `<header>` owns the landmark and the AppBar is rendered as a non-landmark element. Child brand/auth/language/theme widgets are ordinary header content; each navigation widget renders a separate named `<nav>` landmark inside that shell. Browser oracle: accessible `banner` count is exactly one.
-   **[Recommendation]** Render exactly one mobile menu trigger and one temporary Drawer owned by the header shell. The Drawer projects navigation instances and auth actions in deterministic persisted order. Brand remains in the compact header; language and color-mode controls may remain compact trailing controls. Each persisted instance must have exactly one accessible/interactable projection at a given viewport, even if hidden branches remain mounted in the DOM.
-   **[Recommendation]** Registry/mobile-projection rules must fail closed for a header capability that is permitted in `marketing-header` but has no defined compact/Drawer projection; the mobile renderer must never silently drop an allowed persisted widget.
-   **[Recommendation]** Preserve the current MUI visual baseline: `Container maxWidth="lg"`, blurred/bordered translucent toolbar treatment, theme-aware colors, and the existing frame offset concept. Remove per-navigation AppBar stacking and height constants.

### 11. Fixed-header geometry should be derived from the real rendered zone, including frame offset

-   **[Fact, MDN]** `position: fixed` removes an element from normal flow.
-   **[Fact, MDN]** `ResizeObserver` is a standard browser primitive for observing changes to an element's rendered content/border-box size; it does not by itself observe every change in viewport position/top offset.
-   **[Fact, MDN]** `scroll-padding-block-start` lets a scroll container reserve an obscured block-start region when scrolling targets into view, including fixed toolbars.
-   **[Fact]** Current marketing geometry assumes each navigation bar has a fixed constant height and computes top padding from navigation instance count.
-   **[Recommendation]** Measure rendered header size and compute top/frame offset as separate inputs. Derive one effective fixed-header occlusion value from the actual zone bottom relative to the viewport, including the template frame/28px visual offset where applicable, and recompute when either size or containing-block/frame position changes.
-   **[Recommendation]** Browser acceptance must verify the actual fixed containing block inside the application shell; CSS transformed/filter/etc. ancestors can alter fixed-position containing-block behavior, so CSS declaration alone is not evidence of viewport behavior.
-   **[Recommendation]** Fixed mode maps to one fixed zone shell plus a zone-owned content spacer/offset. Flow mode maps to normal document flow (`static`/ordinary layout) and must remove the fixed spacer entirely.
-   **[Recommendation]** Expose the measured fixed occlusion through a CSS custom property or equivalent shared runtime value. Apply it primarily as scroll-container `scroll-padding-block-start` for fragment/anchor/skip scrolling; per-target `scroll-margin-block-start` may supplement this when useful. Flow mode contributes no fixed-header scroll padding.
-   **[Recommendation]** Browser acceptance should assert concrete geometry: in fixed mode, after `scrollY > 0` the banner top remains stable and main/anchor targets remain below measured occlusion; in flow mode, after sufficient scroll the banner leaves the viewport and no fixed spacer remains. Reorder/disable/locale/wrapping changes must trigger recalculation at `1920×1080`, `768×1024`, and `390×844`.

### 12. `sharedLayoutWidgets` is a second composition authority and should disappear for marketing

-   **[Fact]** Marketing runtime currently receives marketing widgets and `sharedLayoutWidgets` through separate paths, then performs shell-presence checks to decide whether to inject `LanguageSwitcher`.
-   **[Recommendation]** Normalize shared and marketing-specific placements into one effective renderer-ready composition before entering `MarketingPage`. Persisted composition should be the only authority for whether language/theme controls exist.
-   **[Recommendation]** Keep template adapters separate; unification here means one neutral effective placement contract, not one monolithic Dashboard/marketing renderer.

### 13. The shared Zone Settings authoring primitive belongs in `LayoutAuthoringDetails`

-   **[Fact]** `LayoutAuthoringDetails` already renders the canonical zone cards and widget actions for both metahub and application authoring, but `LayoutAuthoringZone` has no zone-level settings action.
-   **[Recommendation]** Extend that shared primitive with zone settings metadata/state/actions and a shared localized settings dialog/panel. Do not add a marketing-only appearance panel for the new behavior.
-   **[Recommendation]** The first setting uses a user-facing RadioGroup: `Fixed on screen` / `Scrolls with page`, with effective value plus inherited/overridden state where applicable. Technical enum names, raw JSON, UUIDs and CSS values stay hidden.
-   **[Recommendation]** Reuse the existing layout version as the optimistic-concurrency boundary. Application owner/admin remain the default mutation roles; editor/member direct mutation remains forbidden/current admin-route policy unless separately configured for reads. Metahub non-managers may see disabled/read-only effective settings where the existing layout route is accessible. Do not introduce a new application-admin read-only surface merely for this setting. Stale version remains `409`, forbidden mutation remains `403`, and cross-application/cross-scope lookup must fail closed.
-   **[Package-boundary requirement]** Shared control-plane authoring may extend `@universo-react/template-mui`, but the isolated `@universo-react/apps-template-mui` runtime must continue to use local runtime primitives and must not import the control-plane package.

### 14. Current tests encode both useful contracts and legacy behavior that must be replaced

-   **[Fact]** `MarketingPage.test.tsx` and `cross-template-runtime.spec.ts` currently prove the repeated-navigation workaround: multiple fixed AppBars/Drawers and shell-owned language injection.
-   **[Recommendation]** Replace those assertions with a generic zone oracle: exactly one accessible banner owner, supported active header widget composition, authorable start/end order, one mobile Drawer, no overlapping fixed layers, correct measured content offset. Unsupported mobile projections fail closed.
-   **[Recommendation]** Extend existing lifecycle/sync/snapshot/effective-layout suites rather than creating a marketing-only harness.
-   **[Recommendation]** At least one component/integration test must render the real shared `LayoutAuthoringDetails` instead of mocking it, so a future marketing-specific settings fork cannot pass unnoticed.
-   **[Recommendation]** Browser tests must use the actual independent controls: operate language by accessible role/name and assert localized visible content plus `html[lang]`; operate color mode and assert the actual MUI scheme/presentation. An inactive/absent persisted widget must yield zero accessible controls for that capability.
-   **[Recommendation]** Mobile assertions target the accessibility tree rather than raw DOM count: one visible trigger, one active Drawer projection, one accessible/interactable projection per persisted auth/language/theme instance, Escape close, `aria-expanded`/`aria-controls`, and focus return. Run Axe for at least a fixed desktop state and an open mobile Drawer state.
-   **[Recommendation]** Test skip-to-content as a real keyboard flow (`Tab → skip link → Enter → visible/unobscured main target → continued keyboard navigation`), leaving the exact focus implementation to PLAN/implementation.
-   **[Recommendation]** Preserve the established browser viewports `1920×1080`, `768×1024`, and `390×844`, EN/RU, keyboard operation, no raw ID/JSON leakage, localized validation, and no page-level horizontal overflow.

## Recommended Runtime Composition Contract

The research recommends the following renderer model for the first implementation:

```text
marketing-header zone shell
└─ one visual AppBar/header container
   └─ toolbar/flex row
      ├─ start group (persisted order)
      │  ├─ marketing.brand
      │  └─ marketing.navigation [0..n]
      ├─ flexible spacer
      └─ end group (persisted order)
         ├─ marketing.auth
         ├─ languageSwitcher
         └─ colorModeSwitcher

mobile projection
└─ same shell, one compact toolbar
   ├─ brand
   ├─ compact language/theme controls when active
   └─ one shell-owned menu trigger
      └─ one Drawer
         ├─ projected navigation groups in persisted order
         └─ projected auth actions
```

Repeated navigation widgets remain separate navigation landmarks and require distinguishable accessible names. The menu trigger and Drawer are responsive shell mechanics, not persisted widget instances.

## Recommended Neutral Zone-Settings Resolution

The logical resolution model should be explicit before implementation:

```text
registry default
    ↓
metahub global/independent owned value
    ↓
metahub same-template sparse overlay override
    ↓ publication/snapshot
application source baseline
    ↓
application-local sparse override
    ↓
effective zone settings delivered to runtime
```

Reset semantics follow the same graph upward: remove the local override and reveal the current inherited value. An independent layout has no base lineage; it owns or explicitly serializes its setting value.

## Synchronization Semantics Recommended For The First Slice

Keep synchronization at the current whole-layout conflict granularity and define zone-setting behavior inside each existing resolution:

| Situation                    | Recommended zone-setting result                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Clean source update          | Replace source baseline; no local override; effective value becomes new source value                         |
| `keep_local`                 | Update source baseline, retain local sparse override; effective value remains local                          |
| `overwrite_local`            | Update source baseline and clear local override; effective value becomes source                              |
| `copy_source_as_application` | Preserve linked local-modified layout and create the current source as an application-owned independent copy |
| `skip_source`                | Preserve current local state and unresolved source-updated state under existing rules                        |
| Reset after `keep_local`     | Remove local override; reveal the latest stored source baseline                                              |

One semantic edge case remains: if source later changes to the exact value already held by the local override, PLAN must choose whether to auto-converge/clear the redundant override or preserve the existing whole-layout conflict workflow. Auto-convergence is cleaner but is not necessary for the first implementation if it would complicate synchronization.

## Project Implications

| Area                       | Main affected boundaries                                                         | Required direction                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Neutral contracts/registry | `@universo-react/types` layout/widget definitions and application layout schemas | Add serializable zone-setting descriptors/defaults and typed decoded contracts; validate centrally and fail closed |
| JSONB storage adapter      | applications backend layout store support; metahub layout service                | One canonical neutral envelope codec; existing `config` remains physical carrier; renderer config stays clean      |
| Metahub inheritance        | `MetahubLayoutsService`                                                          | Extract neutral metadata before strict renderer merge/parse; sparse per-setting overrides                          |
| Snapshot/publication       | snapshot serializer/preflight/restore/materialization                            | Preserve one existing `config` wire carrier; validate reserved metadata fail closed; no version bump               |
| Application sync           | sync store/persistence/hash                                                      | Atomically retain latest source baseline + local sparse override; hash effective semantics, not provenance         |
| Authoring                  | shared `LayoutAuthoringDetails`, application layouts, metahub layout details     | One localized Zone Settings surface plus accessible logical-placement authoring; preserve current RBAC surfaces    |
| Hosted runtime adapter     | applications frontend runtime layout projection                                  | Carry the selected typed placement representation and all renderer-required neutral fields explicitly              |
| Marketing renderer         | `MarketingPage`, `MarketingWidgetRenderer`, `AppAppBar` replacement/refactor     | One zone-owned AppBar/banner, atomic widgets, one mobile Drawer, dynamic geometry                                  |
| Dashboard shared controls  | Dashboard runtime/renderers                                                      | Render shared language/color-mode capabilities as real persisted controls; remove shell duplication                |
| Tests                      | named unit/E2E suites in the brief                                               | Replace legacy multi-AppBar assertions and extend lifecycle/snapshot/sync/permissions/UX coverage                  |
| Documentation              | EN/RU marketing-page, application-layout guides, package README                  | Replace shell-injected language/theme wording with persisted composition and zone-settings behavior                |

## Verification Matrix For PLAN

| Layer                       | Required evidence                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Types/registry              | Serializable setting descriptors/defaults; wrong template/zone/setting/value fails closed; no Zod instances in metadata       |
| Neutral envelope codec      | One encode/decode implementation is used across storage/sync/effective/snapshot boundaries; renderer config stays clean       |
| Metahub overlays            | `default → inherited base → sparse override → reset`; neutral metadata extracted before renderer strict parse                 |
| Snapshot preflight          | Malformed/unsupported reserved metadata aborts import/restore/materialization before destructive writes                       |
| Snapshot roundtrip          | Non-default `flow` survives existing-`config` wire roundtrip and lineage; independent/overlay layouts remain distinct         |
| Application materialization | Source baseline established from snapshot; malformed/missing base still fails closed                                          |
| Application sync            | `keep_local` atomically updates source baseline while preserving override; all existing resolutions + reset after update      |
| Zone-setting reset          | Dedicated reset removes only the target sparse override, preserves renderer appearance config, and reuses layout OCC          |
| Hashing                     | Storage provenance/source baseline does not create false local changes; effective zone-setting changes do alter semantic hash |
| Shared authoring            | Real `LayoutAuthoringDetails` open/save/reset; EN/RU; inherited/custom state; accessible start↔end action survives reload     |
| Header desktop runtime      | Exactly one accessible banner owner; atomic header controls; deterministic group order; repeated nav landmarks are named      |
| Header fixed geometry       | Stable banner top after scroll; measured occlusion/scroll padding; anchors and main stay visible after wrap/locale changes    |
| Header flow geometry        | Header exits viewport after sufficient scroll; no fixed spacer or fixed-header scroll padding remains                         |
| Mobile runtime              | One trigger/Drawer; one accessible projection per persisted instance; Escape/focus/ARIA; unsupported projection fails closed  |
| Shared controls             | Real language interaction updates locale/`html[lang]`/content; real color-mode interaction updates MUI scheme                 |
| Skip link / a11y            | Keyboard skip flow lands on visible main content; Axe includes fixed desktop and open mobile Drawer states                    |
| Permissions/OCC             | Application owner/admin mutate; editor/member follow current deny/redirect policy; metahub read-only where route allows       |
| Runtime UX                  | 1920×1080, 768×1024, 390×844; EN/RU; light/dark; keyboard; no raw IDs/JSON/internal validation; no page overflow              |
| Architecture                | No `sharedLayoutWidgets` side channel; no marketing-only settings fork; `apps-template-mui` runtime isolation remains green   |

Existing suites to extend include:

-   `packages/universo-react-types` application-layout/registry tests;
-   `packages/universo-react-applications-backend/src/tests/services/effectiveLayoutResolver.test.ts`;
-   `packages/universo-react-applications-backend/src/tests/services/syncLayoutMaterialization.test.ts`;
-   `packages/universo-react-applications-backend/src/tests/services/syncLayoutPersistence.test.ts`;
-   `tools/testing/e2e/specs/flows/cross-template-runtime.spec.ts`;
-   `tools/testing/e2e/specs/flows/marketing-page-widget-lifecycle.spec.ts`;
-   `tools/testing/e2e/specs/flows/marketing-page-snapshot-roundtrip.spec.ts`;
-   `tools/testing/e2e/specs/flows/application-layout-management.spec.ts`;
-   `tools/testing/e2e/specs/flows/marketing-page-permissions.spec.ts`;
-   `tools/testing/e2e/specs/flows/metahub-global-entity-layouts.spec.ts`;
-   a focused shared Zone Settings component/integration test using the real `LayoutAuthoringDetails`.

## Conflicts And Uncertainty

1. **Current whole-layout reset is a different operation.** Application marketing appearance-config reset currently restores template defaults. The new Zone Settings flow needs a dedicated scoped reset that removes one sparse override and reveals its current source/inherited baseline; the existing general reset should keep its present meaning unless a separate clean-break decision changes it intentionally.
2. **Current scoped metahub config is copy-based.** That is acceptable for existing renderer config behavior but is not sufficient for inherited zone settings. Zone setting resolution must be sparse even if renderer-config inheritance remains unchanged in this slice.
3. **The wire principle is fixed; the reserved key is not.** Existing serialized/storage `config` remains the physical carrier for reserved neutral metadata and must be decoded before strict renderer parsing. PLAN still chooses the exact key/name and whether existing composition metadata is atomically normalized into the same section.
4. **Whole-layout conflict versus semantic convergence.** A source change can converge to the local override value. PLAN must decide whether to auto-clear a redundant override or retain current coarse conflict semantics.
5. **Widget taxonomy is a recommendation, not yet a persisted contract.** The evidence strongly favors `brand`, repeatable `navigation`, `auth`, shared language, and shared color mode. PLAN should ratify names/cardinality before implementation.
6. **Template-aware cardinality may be needed.** The current single `multiInstance` flag can become too coarse as shared widgets expand to multiple templates.
7. **Logical placement encoding remains a PLAN decision.** `start | end` is a required typed behavior and must be authorable, but PLAN must choose a first-class neutral field/capability or a typed widget-config representation and then carry that choice through snapshot/inheritance/reset/hash/runtime adapters.
8. **Mobile projection policy remains bounded.** Language/color-mode may stay compact or project into the Drawer, but each persisted instance needs one accessible active projection and every allowed header capability needs a defined mobile behavior.
9. **OntoIndex was advisory.** Direct current source and tests are authoritative for the repository facts in this QA pass.
10. **No new browser run was performed in RESEARCH mode.** The geometry/mobile/authoring matrices above are required future evidence, not claims of current acceptance.

### Prior Research Drift

-   The 2026-09-04 finding that marketing lacked persisted widgetized runtime composition is historical; the current code already has that lifecycle and this research addresses the remaining composite-header special cases.
-   The 2026-09-07 note that scoped materialization could silently skip a missing base is superseded by current fail-closed materialization. PLAN must follow current source rather than carrying that older behavior forward.

## Recommended Decision

Proceed to PLAN with the brief intact, but make the following architecture decisions explicit at the start of the plan:

1. **One generic zone-settings system.** Extend the canonical layout-zone registry with typed setting capabilities/defaults. `marketing-header.position = fixed | flow` is the first consumer. Unknown settings fail closed.
2. **One canonical neutral codec, one existing wire carrier.** Keep reserved neutral metadata inside the existing serialized/storage `config`, decode it before strict template parsing, and expose typed neutral fields in decoded/effective contracts. Do not add a second top-level snapshot representation or a new table/column.
3. **Sparse inheritance.** Same-template overlays store only local zone-setting overrides. Effective resolution is registry default → base → scoped override. Reset deletes the override. Independent layouts explicitly own/serialize their setting.
4. **Application source baseline is sync state, not just hash state.** Metahub-derived application layouts store the latest source zone-settings baseline separately from application-local sparse overrides; source sync updates that baseline atomically even under `keep_local`.
5. **Effective semantic hash.** Hash the effective zone settings, not internal source-baseline bookkeeping.
6. **Atomic persisted header capabilities.** Use `marketing.brand`, repeatable `marketing.navigation`, `marketing.auth`, shared `languageSwitcher`, and shared `colorModeSwitcher`. The menu trigger/Drawer remain shell-owned responsive mechanics.
7. **One semantic header shell.** `marketing-header` owns exactly one accessible banner owner, fixed/flow behavior, dynamic measured occlusion/scroll padding, and one mobile Drawer. Child widgets do not own page positioning.
8. **Typed logical placement invariant, encoding decided in PLAN.** Require `start | end`, localized keyboard-accessible authoring and deterministic ordering, then choose one physical representation and carry it through all lifecycle contracts.
9. **Single composition authority.** Remove marketing `sharedLayoutWidgets` shell-injection checks. The effective persisted widget list is the sole authority for visible controls.
10. **Dedicated Zone Settings mutation/reset on shared authoring.** Add Zone Settings to `LayoutAuthoringDetails`, reuse layout RBAC/versioning, and reset only the target sparse override rather than repurposing whole appearance-config reset.
11. **Browser acceptance follows actual interaction/accessibility.** Prove language/theme via controls, one accessible mobile projection per instance, open-Drawer a11y, real skip-link flow, and fixed/flow geometry from measured runtime positions.

This direction satisfies the user's clean-break/no-version-bump constraint while also creating a general zone-settings foundation that can later be enabled on other zones without redesigning the storage or authoring model.

## Open Questions Before PLAN

1. What exact reserved JSONB metadata shape/name should encode neutral layout metadata, and should the clean-break refactor move current application `compositionMode/baseLayoutId` into the same section immediately while preserving existing snapshot top-level composition fields atomically?
2. When an upstream source value converges to an existing application-local override, should sync automatically clear the redundant override or preserve the current whole-layout conflict workflow until the user resolves it?
3. Should shared widget cardinality become template-aware in this implementation or only when a concrete shared widget needs different cardinality across Dashboard and marketing?
4. Which physical representation should carry typed logical placement: a first-class neutral placement field/capability or typed widget config with explicit adapter transport?
5. Should mobile language and color-mode controls stay in the compact toolbar (recommended) or project into the Drawer; whichever choice PLAN makes must preserve exactly one accessible active projection per persisted instance.

None of these questions requires changing the brief or adding a schema/version bump. They are bounded implementation-contract decisions for PLAN.

## Sources

-   [Material UI App Bar](https://mui.com/material-ui/react-app-bar/)
-   [Material UI v9.2.0 App Bar source documentation](https://github.com/mui/material-ui/blob/v9.2.0/docs/data/material/components/app-bar/app-bar.md)
-   [Material UI Stack](https://mui.com/material-ui/react-stack/)
-   [Material UI Flexbox](https://mui.com/system/flexbox/)
-   [Material UI v9.2.0 Flexbox source documentation](https://github.com/mui/material-ui/blob/v9.2.0/docs/data/system/flexbox/flexbox.md)
-   [Material UI Drawer](https://mui.com/material-ui/react-drawer/)
-   [Material UI v9.2.0 Drawer source documentation](https://github.com/mui/material-ui/blob/v9.2.0/docs/data/material/components/drawers/drawers.md)
-   [Material UI Modal](https://mui.com/material-ui/react-modal/)
-   [MDN CSS `position`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position)
-   [MDN Resize Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Resize_Observer_API)
-   [MDN `scroll-padding-block-start`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-padding-block-start)
-   [React: Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)
-   [Zod v3 documentation](https://v3.zod.dev/)
-   [Zod v3.24.2 source documentation](https://github.com/colinhacks/zod/blob/v3.24.2/README.md)
-   [WAI-ARIA APG Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
