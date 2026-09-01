# Data-driven marketing page renderer

`marketing-page` is the isolated published-application renderer for Universo
Platformo. It is not a copyable MUI demo: the renderer receives the validated
`MarketingPageData` view model produced by the runtime API and renders the
content supplied by the application's metahub/workspace records.

## Usage

The application shell owns `AppMainLayout`, `ThemeProvider`, locale selection,
and TanStack Query. The runtime template is selected from the published
application layout returned by the API. Pass the normal runtime props to the
public apps-template entry point; do not add a template prop, import section
files from another package, or import code from `.backup`:

```tsx
<DashboardApp applicationId={applicationId} locale={locale} apiBaseUrl={apiBaseUrl} />
```

For a custom host, normalize the validated runtime envelope and render the
provider-free component:

```tsx
<MarketingPage data={marketingPageData} onAction={handleAction} onLeadSubmit={handleLeadSubmit} />
```

`onLeadSubmit` is an optional capability for hosts that expose an approved,
same-origin lead endpoint with authentication, CSRF protection, rate limits,
and an explicit response contract. The published `DashboardApp` and hosted
application runtime intentionally do not provide this callback: the seeded
newsletter is a navigation CTA, so no email field is rendered and no email is
silently discarded.

All links and media are validated at the API boundary and checked again by the
renderer. Content is edited through the standard localized Object/Page/Set/
Enumeration authoring controls; no demo arrays are hardcoded in this package.

## Reference

The upstream MUI marketing-page files in `.backup/templates/marketing-page`
are retained only as a visual/reference source for the seeded baseline. The
product runtime is pinned to the repository's MUI 9 catalog and its own
localized, data-driven contracts.
