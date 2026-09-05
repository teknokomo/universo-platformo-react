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

The template manifest and snapshot versions remain unchanged. The built-in seed is an initial demo only; editors can replace records through the normal Object authoring surface.

## Seeded entity model and widget composition

The template uses standard Object entities rather than a marketing-specific entity kind:

| Object                    | Content                                                    |
| ------------------------- | ---------------------------------------------------------- |
| MarketingPageSection      | Localized copy for widget headings and descriptions        |
| MarketingPageSiteSettings | Singleton brand, hero, footer, newsletter, and legal copy  |
| MarketingPageLogo         | Six ordered customer logos and accessible alternative text |
| MarketingPageFeature      | Three features, icons, descriptions, and previews          |
| MarketingPageTestimonial  | Six localized quotes, authors, occupations, and avatars    |
| MarketingPageHighlight    | Six localized highlights and icons                         |
| MarketingPagePricing      | Three tiers with 4/6/4 benefits and safe CTA targets       |
| MarketingPageFaq          | Four localized question/answer records                     |
| MarketingPageNavigation   | Ordered navigation targets                                 |
| MarketingPageFooterLink   | Grouped footer, legal, and social links                    |

Long descriptions, quotes, answers, and footer copy are multiline fields in the authoring UI. Internal UUIDs, component columns, and semantic codenames are not shown as ordinary display values.

The fresh `marketing-page` seed creates nine active widget instances in three
template-specific zones: `marketing.navigation` in the header,
`marketing.hero`, five `marketing.collection` instances (`logos`, `features`,
`testimonials`, `highlights`, and `faq`), and `marketing.pricing` in the main
zone, plus `marketing.footer` in the footer zone. The widget instance list is
the only source of top-level composition: its `zone`, `sortOrder`, and
`isActive` values control placement, order, and visibility. Collection records
retain their own item order and visibility.

Each widget has a strict built-in Object source. The collection variant selects
its matching source (`MarketingPageLogo`, `MarketingPageFeature`,
`MarketingPageTestimonial`, `MarketingPageHighlight`, or `MarketingPageFaq`),
while localized headings use the related `MarketingPageSection` copy source.
The same typed widget configuration is editable from the metahub layout and,
after publication, from the application layout override. The application
override is scoped to appearance and widget presentation; published Object
records remain the content authority.

Every registered dashboard and marketing widget is an instance type rather
than a singleton. The same widget key may therefore be added or duplicated any
number of times in a metahub or application layout. Each placement is stored
as its own row with a server-generated UUID v7; marketing placements also have
their own unique `instanceKey`. Deleting one placement leaves sibling
instances and their content records intact.

## Runtime and application settings

The application layout carries the immutable `marketing-page` template key and a typed appearance configuration:

-   system, light, or dark theme mode;
-   optional primary and accent hex colors;
-   optional brand logo media;
-   email/telephone action policy and external-link target policy.

Application layout settings change presentation only. Content remains owned by
the published Object records, and marketing widget instances are materialized
as template-aware application rows rather than dashboard widgets. Unknown
keys, invalid source/variant combinations, unsafe URLs, and malformed media
fail closed instead of falling back to the dashboard.

The hosted route selects the template before initializing dashboard CRUD state. The application runtime owns an application-level `AppMainLayout` so the saved appearance overrides are applied; the renderer itself does not create another theme provider. The standalone shell owns the equivalent provider for direct template previews.

## Actions and media

Actions are typed as internal paths, named anchors, external HTTP(S) URLs, email, or telephone actions. Placeholder `#`, `javascript:`, `data:`, protocol-relative, credential-bearing, and arbitrary endpoint values are rejected. External new-tab links receive `noopener noreferrer`. Missing or blocked media renders a localized fallback instead of exposing a raw URL or object value.

The seeded newsletter uses the existing sign-up action. It does not create a
new lead-storage API: the published runtime renders a navigation CTA and no
email field until a host supplies an approved same-origin submission
capability. This prevents a user-entered address from being silently dropped
or placed in the URL/history.

## Verification

Use the deterministic lifecycle and browser checks described in [Browser E2E Testing](../guides/browser-e2e-testing.md): create the metahub, publish and sync an application, open the runtime, edit a seeded Object, and verify the changed localized value after reload.
The marketing matrix belongs under `specs/matrix/**` so the repository's EN/RU and light/dark projects execute it.

At minimum, verify:

-   the nine seeded widget instances, their zones/order/active state, and baseline counts (6 logos, 3 features, 6 testimonials, 6 highlights, 3 pricing tiers with 4/6/4 benefits, and 4 FAQ items);
-   keyboard navigation, accordion semantics, localized labels, and `<html lang>`;
-   light/dark and Russian long-copy rendering at desktop, tablet, and mobile widths;
-   no page-level horizontal overflow, raw UUID/JSON/object leakage, unsafe links, or console/page errors;
-   publication/snapshot restore and application sync preserve `templateKey` and appearance config.

The minimal Supabase profile verifies SQL/RLS and the safe handling of the seeded URL media references. The MUI/Webflow assets are external network resources, so visual runs still require network availability; deterministic local/Storage media and Storage API/imgproxy behavior require the separate full-stack media suite.
