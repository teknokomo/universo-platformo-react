---
description: Create, publish, configure, and verify the widgetized data-driven MUI 9 marketing page application template.
---

# Marketing Page Template

The `marketing-page` template is the published-application landing page built with the isolated `@universo-react/apps-template-mui` package and MUI 9. It keeps the visual composition of the official MUI marketing-page example while reading content from metahub entities through persisted, template-aware widget instances.

![Published marketing-page runtime from the seeded metahub](../.gitbook/assets/marketing-page/marketing-page-runtime-en-light.png)

## Create the metahub

1. Open **Metahubs → Create**.
2. Select **Marketing page** in the localized template picker.
3. Keep the standard Hub, Object, Page, Set, and Enumeration presets enabled.
4. Create the metahub, publish a version, and create an application from that publication.

The template manifest and snapshot versions remain unchanged. The built-in seed
is an initial demo only; editors can replace records through the normal Object authoring surface.

## Seeded entity model and widget composition

The template uses standard Object entities rather than a marketing-specific entity kind:

| Object                    | Content                                                    |
| ------------------------- | ---------------------------------------------------------- |
| MarketingPageSection      | Localized copy for widget headings and descriptions        |
| MarketingPageSiteSettings | Singleton brand, footer, newsletter, and legal copy        |
| MarketingPageHero         | Repeatable localized Hero copy and lead actions            |
| MarketingPageLogo         | Six ordered customer logos and accessible alternative text |
| MarketingPageFeature      | Three features, icons, descriptions, and previews          |
| MarketingPageTestimonial  | Six localized quotes, authors, occupations, and avatars    |
| MarketingPageHighlight    | Six localized highlights and icons                         |
| MarketingPagePricing      | Three tiers with 4/6/4 benefits and safe CTA targets       |
| MarketingPageFaq          | Four localized question/answer records                     |
| MarketingPageNavigation   | Ordered navigation targets                                 |
| MarketingPageFooterLink   | Grouped footer, legal, and social links                    |

Long descriptions, quotes, answers, and footer copy are multiline fields in the authoring UI. Internal UUIDs, component columns, and semantic codenames are not shown as ordinary display values.

The fresh `marketing-page` seed creates independent header capabilities for the
brand, navigation, authentication, language, and color-mode controls, alongside
the content widgets in the three template-specific zones. The widget instance
list is the only source of top-level composition: its `zone`, `sortOrder`,
`isActive`, and header Start/End placement control the rendered result.
Navigation remains repeatable; the other header capabilities are singletons.

The `marketing-header` zone owns one semantic header shell and one responsive
mobile Drawer. Header child widgets render their content inside the shell and
do not create their own fixed bars or Drawers. The same language and color-mode
capabilities can be placed in the Dashboard top zone through the shared registry.

The header zone exposes **Settings** in both metahub and application authoring.
Its first setting is **Header behavior**: **Fixed on screen** keeps the measured
header visible over the original MUI composition while content scrolls behind it,
while **Scrolls with page** leaves the header in normal document flow. Scoped
layouts store sparse overrides, so resetting the setting reveals the current
source value.

Each widget has a strict built-in Object source. The collection variant selects
its matching source (`MarketingPageLogo`, `MarketingPageFeature`,
`MarketingPageTestimonial`, `MarketingPageHighlight`, or `MarketingPageFaq`),
while localized headings use the related `MarketingPageSection` copy source.
The same typed widget configuration is editable from the metahub layout and,
after publication, from the application layout override. The application
override is scoped to appearance and widget presentation; published Object
records remain the content authority.

Registered repeatable dashboard and marketing widgets are instance types, so
the same repeatable key may be added or duplicated any number of times in a
metahub or application layout. Dashboard shell keys such as `appNavbar` and
`header` are single-instance placements and are rejected when already present.
Each placement is stored as its own row with a server-generated UUID v7;
marketing placements also have their own unique `instanceKey`. Deleting one
placement leaves sibling instances and their content records intact.

Adding a Hero automatically creates a fresh Entity record and binds the new
placement in the same transaction. Duplicating a bound Hero automatically
clones the source record into a fresh record in the same compatible Object, so
the copy can be edited independently without another setup dialog. The advanced
source settings remain available when intentional reuse is wanted: an author
can bind an existing compatible record or provision a separate compatible
Object model. Reusing one record displays a shared-source notice because edits
affect every bound Hero. Copying a whole marketing layout still makes binding
ownership explicit: **Reuse the same Hero records** deliberately shares content
between layouts, while **Skip bound Hero placements** copies the other widgets
and leaves those placements out. Deleting a bound record is rejected until its
placement is rebound or removed.

## Edit and republish Entity content

1. In the metahub, open the `MarketingPageHero` Object and its **Records** view.
2. Edit an existing record or use the normal record create/copy actions. Record
   fields own the localized Hero title, accent, description, and actions; a
   widget placement stores only its presentation and Entity binding.
3. In the metahub layout, add or duplicate a Hero placement. The normal flow
   creates an independent record automatically. Use **Hero content → Advanced
   source settings** only when you want to select an existing compatible
   record/Object or provision a separate compatible Object model. Selecting a
   record already in use intentionally shares content and shows a usage notice.
4. Save the record and layout, then publish a new ready version of the
   metahub publication.
5. In the already linked application, open **Connectors**, synchronize the
   published schema/content, and refresh the application runtime to verify the
   new values. Do not create another application for an update.
6. To discard application-only presentation changes, reset that layout/widget
   override to its source. This reset does not change Entity records. To revert
   canonical content, edit or restore the source record, publish another ready
   version, synchronize the same application, and refresh it.

## Runtime and application settings

The application layout carries the immutable `marketing-page` template key and a typed appearance configuration:

-   system, light, or dark theme mode;
-   optional primary and accent hex colors;
-   optional brand logo media (configured through the `marketing.brand` widget as a brand name and/or decorative logo URL, rendered in the header and footer);
-   email/telephone action policy and external-link target policy.

Application layout settings change presentation only. Content remains owned by
the published Object records, and marketing widget instances are materialized
as template-aware application rows rather than dashboard widgets. Unknown
keys, invalid source/variant combinations, unsafe URLs, and malformed media
fail closed instead of falling back to the dashboard.

The hosted route selects the template before initializing dashboard CRUD state.
The application runtime owns an application-level `AppMainLayout` so the saved appearance overrides are applied;
the renderer itself does not create another theme provider. The standalone shell owns the equivalent provider for direct template previews.

An entity-scoped application layout can independently select the Dashboard
template for a Page/Object target even when the global layout is
`marketing-page`. The target-aware effective-layout response is resolved before
the host chooses a renderer; a missing or invalid scoped composition is a typed
error and never silently falls back to the marketing global layout.

## Actions and media

Actions are typed as internal paths, named anchors, external HTTP(S) URLs, email, or telephone actions. Placeholder `#`, `javascript:`, `data:`, protocol-relative, credential-bearing, and arbitrary endpoint values are rejected.
External new-tab links receive `noopener noreferrer`. Missing or blocked media renders a localized fallback instead of exposing a raw URL or object value.

The seeded newsletter uses the existing sign-up action. It does not create a
new lead-storage API: the published runtime renders a navigation CTA and no
email field until a host supplies an approved same-origin submission
capability. This prevents a user-entered address from being silently dropped
or placed in the URL/history.

## Verification

Use the deterministic lifecycle and browser checks described in [Browser E2E Testing](../guides/browser-e2e-testing.md): create the metahub, publish and sync an application, open the runtime, edit a seeded Object, and verify the changed localized value after reload.
The marketing matrix belongs under `specs/matrix/**` so the repository's EN/RU and light/dark projects execute it.

At minimum, verify:

-   the thirteen seeded widget placements, their zones/order/active state, and baseline counts (6 logos, 3 features, 6 testimonials, 6 highlights, 3 pricing tiers with 4/6/4 benefits, and 4 FAQ items);
-   keyboard navigation, accordion semantics, localized labels, and `<html lang>`;
-   light/dark and Russian long-copy rendering at desktop, tablet, and mobile widths;
-   no page-level horizontal overflow, raw UUID/JSON/object leakage, unsafe links, or console/page errors;
-   publication/snapshot restore and application sync preserve `templateKey` and appearance config.

The minimal Supabase profile verifies SQL/RLS and the safe handling of the seeded URL media references. The MUI/Webflow assets are external network resources, so visual runs still require network availability;
deterministic local/Storage media and Storage API/imgproxy behavior require the separate full-stack media suite.

## Published row cap

Every marketing object is capped at 1000 active rows (`PUBLIC_MARKETING_ROW_LIMIT`) because the anonymous public runtime fails closed above the limit. Seeding and runtime create/copy/restore reject the write with `MARKETING_ROW_LIMIT_REACHED` once the object reaches the cap, so an authenticated author cannot break the published page for every visitor.
