---
description: Create, publish, configure, and verify the Entity-backed MUI 9 Marketing Page application template.
---

# Marketing Page Template

The <code>marketing-page</code> template is the published-application landing page rendered by the isolated <code>@universo-react/apps-template-mui</code> package. It keeps the MUI 9 reference composition while resolving editorial content from metahub Entity records through registered widget bindings.

![Published marketing-page runtime from the seeded metahub](../.gitbook/assets/marketing-page/marketing-page-runtime-en-light.png)

## Create the metahub

1. Open **Metahubs → Create**.
2. Select **Marketing page** in the localized template picker.
3. Keep the standard Hub, Object, Page, Set, and Enumeration presets enabled.
4. Create the metahub, publish a ready version, and create an application from that publication.

The seed is a starting point. Replace or extend its records through the ordinary Entity and layout authoring surfaces. There is no Marketing-specific Entity kind.

## Ownership and seeded Entity model

The Metahub owns canonical content, widget placements, and their source bindings. Application layouts can customize only registered presentation and placement state for inherited source-managed widgets. The published runtime receives a validated read projection.

| Object                                   | Content                                                                           |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| <code>MarketingPageSiteSettings</code>   | Shared brand identity, brand media, and footer/newsletter/legal copy              |
| <code>MarketingPageSection</code>        | Localized title and description for a section                                     |
| <code>MarketingPageHero</code>           | Localized Hero copy, labels, and typed actions                                    |
| <code>MarketingPageImage</code>          | ResourceSource media, localized alternative text, decorative flag, and dimensions |
| <code>MarketingPageNavigation</code>     | Ordered navigation label and destination records                                  |
| <code>MarketingPageLogo</code>           | Logo media, localized alternative text, order, and visibility                     |
| <code>MarketingPageFeature</code>        | Feature title, description, icon, preview media, order, and visibility            |
| <code>MarketingPageTestimonial</code>    | Localized quote, author details, avatar/logo media, order, and visibility         |
| <code>MarketingPageHighlight</code>      | Localized highlight text, icon/media, order, and visibility                       |
| <code>MarketingPagePricing</code>        | Localized plan details, price, CTA, order, and visibility                         |
| <code>MarketingPagePricingBenefit</code> | Localized benefit and a REF to its pricing tier                                   |
| <code>MarketingPageFaq</code>            | Localized question and answer, order, and visibility                              |
| <code>MarketingPageFooterLink</code>     | Grouped footer link labels, destinations, order, and visibility                   |

Localized values stay in localized Entity Components. Semantic identity, ordering, and visibility also belong to Entity records. The normal authoring UI shows localized labels and fields; UUIDs, raw binding JSON, and physical Component columns are not ordinary display values.

## Fresh layout: 14 placements

A new Marketing Page layout has 14 persisted placements across its three zones. Eleven are Entity-backed. The authentication, language, and color-mode placements are host capabilities and have no editorial binding.

| Zone                          | Placement                                        | Source                                                                                                   |
| ----------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| <code>marketing-header</code> | <code>marketing.brand</code>                     | <code>MarketingPageSiteSettings</code> semantic record                                                   |
| <code>marketing-header</code> | <code>marketing.navigation</code>                | Ordered <code>MarketingPageNavigation</code> record set                                                  |
| <code>marketing-header</code> | <code>marketing.auth</code>                      | Host authentication actions                                                                              |
| <code>marketing-header</code> | <code>languageSwitcher</code>                    | Host locale control                                                                                      |
| <code>marketing-header</code> | <code>colorModeSwitcher</code>                   | Host theme control                                                                                       |
| <code>marketing-main</code>   | <code>marketing.hero</code>                      | One <code>MarketingPageHero</code> semantic record                                                       |
| <code>marketing-main</code>   | <code>marketing.image</code>                     | One <code>MarketingPageImage</code> semantic record                                                      |
| <code>marketing-main</code>   | <code>marketing.collection</code> — logos        | Section record plus <code>MarketingPageLogo</code> record set                                            |
| <code>marketing-main</code>   | <code>marketing.collection</code> — features     | Section record plus <code>MarketingPageFeature</code> record set                                         |
| <code>marketing-main</code>   | <code>marketing.collection</code> — testimonials | Section record plus <code>MarketingPageTestimonial</code> record set                                     |
| <code>marketing-main</code>   | <code>marketing.collection</code> — highlights   | Section record plus <code>MarketingPageHighlight</code> record set                                       |
| <code>marketing-main</code>   | <code>marketing.pricing</code>                   | Section record, <code>MarketingPagePricing</code> record set, and related benefits                       |
| <code>marketing-main</code>   | <code>marketing.collection</code> — FAQ          | Section record plus <code>MarketingPageFaq</code> record set                                             |
| <code>marketing-footer</code> | <code>marketing.footer</code>                    | Shared <code>MarketingPageSiteSettings</code> record and <code>MarketingPageFooterLink</code> record set |

The <code>marketing-header</code> zone renders one responsive header shell and one mobile Drawer. Child header placements render within that shell rather than creating additional fixed bars or Drawers. Zone order, active state, and Start/End placement determine the composed result.

The header zone exposes **Settings** in both Metahub and Application authoring. **Header behavior** supports a fixed-on-screen mode, where content scrolls behind the measured header, and normal page flow. A scoped layout stores only its local override; resetting the zone setting reveals the current inherited value. The shared language and color-mode controls can also appear in the Dashboard top zone.

## Safe source selection and content rules

The registry supports three bounded selectors:

-   <code>semantic-key</code> chooses one record by a registered semantic Component and key.
-   <code>record-set</code> chooses one compatible Entity source; its records are ordered and filtered for visibility through registered Components.
-   <code>relation-set</code> chooses child records through a registered REF relationship to a parent slot.

Current Marketing slots select one source target each. They do not accept SQL, arbitrary filters, physical table or column names, row UUIDs, or client-authored Component projections. The server derives and validates the projection from the widget definition. Human-readable localized names are shown in the authoring controls.

The registry owns order and visibility. <code>SortOrder</code> and <code>IsVisible</code> Components control authored row order and visibility. A widget's <code>maxItems</code> setting may display fewer rows, but cannot raise the registry's hard resolver limit.

Pricing benefits are related to tiers by the <code>TierRef</code> REF Component, which stores the tier record identity. The resolver follows the REF; <code>TierKey</code> is not used as a second relationship or fallback.

The built-in demo seeds six logos, three features, six testimonials, six highlights, three pricing tiers with 4/6/4 benefits, and four FAQ records. One default Hero and one default Image record are seeded, and the registered content slots can support additional records.

## Add, edit, and duplicate in Metahub

The registry defines which operations each placement supports.

-   **Hero and Image:** Add creates or selects one compatible content record. Duplicate copies the bound record and creates the new placement in one backend transaction, so edits can be independent and a failed placement cannot leave an orphan copy.
-   **Navigation, collections, Pricing, and Footer:** Add selects the compatible source for each required slot. Duplicate shares the existing source bindings; it does not copy collection rows, tiers, benefits, or footer links.
-   **Separate source model:** After selecting a compatible source for a slot, an author can create a new empty Object model with the registered Components. Existing records are not copied; a relation slot targets the selected parent Object. Add records through the normal Entity record editor.
-   **Brand:** The seeded singleton record is edited through its allowed content controls; its placement is not duplicated.
-   **Host capabilities:** Authentication has no Entity content. Language and color-mode controls follow their shared-widget registry capabilities.
-   **Content records:** Edit individual rows, ordering, visibility, and REF values through the ordinary Entity record list and editor. Semantic-record binding dialogs may also offer the registered create/edit action for a single selected record.

For Pricing, <code>section</code> provides heading copy, <code>tiers</code> selects the plan source, and <code>benefits</code> is a <code>relation-set</code> whose parent is <code>tiers</code>. Changing a parent source requires the benefit source to remain compatible before the layout can be saved.

Layout, binding, and Entity record permissions are checked on the server. UI visibility alone does not grant access. Binding changes are validated against the current registry and layout version. Removing a placement does not delete its Entity records, and a live-bound record cannot be deleted or have protected semantic identity changed until the binding is safely changed.

All authoring labels, source/record names, field validation, empty/loading states, conflicts, and permission errors are localized in English and Russian. Localized Component fields preserve their existing locale rules; any required locales come from the registered slot policy.

Before publication, import, restore, activation, or synchronization, Marketing snapshot validation checks selected record values against the registered Component contract. Required localized fields must contain English and Russian text, media and actions must use their registered safe formats, and relation-set child records must point to the selected parent records.

## Edit and republish content

For a content update in an existing application:

1. Save the Entity record and any Metahub layout change.
2. Publish a new ready version of the Metahub publication.
3. In the already linked application, synchronize the connector so it imports the new published schema/content and source layout.
4. Refresh the application runtime and verify the selected locale.

The Application layout editor exposes Reset to source for a customized widget when its source baseline is available. This restores the current source presentation and placement state without changing Entity content or the inherited binding. The header zone setting has its own reset control. To revert canonical content, edit or restore the source record, publish a ready version, synchronize the same application, and refresh it. Do not create another linked application just to receive an update.

## Application and runtime boundary

Application layouts may change registered appearance fields and permitted active/order/placement state for inherited widgets. They do not own Marketing Entity content or source bindings. Add and Duplicate are hidden for source-managed Marketing placements, and the API rejects attempts to add or duplicate them without a trusted Metahub binding. Ordinary renderer-config updates cannot replace a binding.

Scoped Marketing overlays inherit the binding from their base placement; snapshot and authoring boundaries reject overlay binding changes. If a source layout with required Entity bindings is removed, copying it as an application layout is unavailable. Keeping local changes retains lineage but deactivates the layout and tombstones its dependent widgets atomically; skipping the removal explicitly preserves the current application state.

Authenticated runtime resolves records under the authorized application/workspace scope. Public runtime uses a separate loader for ready published data. Both use the shared selector rules and strict Marketing DTO validation. The public DTO contains only allowlisted localized content and safe media projections; it excludes physical record/Component identities, binding envelopes, table metadata, and arbitrary Entity data. The isolated MUI renderer receives the validated <code>data.records</code> model and does not query persistence.

The typed <code>marketing-page</code> appearance config supports system/light/dark mode, optional primary/accent colors, and action/link policy. Brand name and media come from the bound <code>MarketingPageSiteSettings</code> Entity record. The hosted application shell selects the renderer before Dashboard CRUD initialization, owns <code>AppMainLayout</code> and the theme provider, and applies appearance policy. The Marketing Page renderer stays presentational and isolated from backend, authoring, and database packages; the standalone preview shell owns its equivalent provider.

An entity-scoped Application layout can select the Dashboard template for a Page/Object target even when the global layout uses <code>marketing-page</code>. The target-aware effective layout is resolved before renderer selection. A missing or invalid scoped composition returns a typed error instead of silently falling back to the global Marketing layout.

## Actions and media

Actions are typed as internal paths, named anchors, external HTTP(S) URLs, email, or telephone actions. Placeholder <code>#</code>, <code>javascript:</code>, <code>data:</code>, protocol-relative, credential-bearing, and arbitrary endpoint values are rejected. External new-tab links receive <code>noopener noreferrer</code>.

Image and other media content is stored in Entity ResourceSource Components. The runtime resolves media into an allowlisted projection; anonymous public output requires a publishable URL and does not expose storage locators. Missing or blocked media renders a localized fallback rather than a raw URL or object value.

For `MarketingPageImage`, localized alternative text is required in English and Russian when `Decorative` is false. Decorative images may leave alternative text empty; the authoring form, record API, binding validation, and snapshot import enforce the same rule.

The seeded newsletter uses an existing sign-up action. It does not create a lead-storage API or collect an address unless the host supplies an approved submission capability.

## Verification

The canonical unit gate covers the shared contract, Metahub authoring, persistence/runtime, and isolated renderer:

```bash
pnpm run test:marketing-widget-unit-gate
pnpm check:apps-template-isolation
pnpm run test:e2e:marketing-page:verify:local-supabase
pnpm run docs:marketing-page:verify:local-supabase
```

Use the lifecycle and browser scenarios in the [Browser E2E Testing](../guides/browser-e2e-testing.md) guide. Local Supabase commands exercise the seed, authoring, publication/synchronization, and runtime. <code>pnpm docs:marketing-page:screenshot:check</code> checks screenshot provenance and metadata.

## Published row cap

Each marketing Object has a 1,000-active-row public limit (<code>PUBLIC_MARKETING_ROW_LIMIT</code>). The public runtime fails closed above it, and seed or runtime create/copy/restore operations reject writes at the limit with <code>MARKETING_ROW_LIMIT_REACHED</code>. Per-binding limits also come from the registry and cannot be raised by <code>maxItems</code>.
