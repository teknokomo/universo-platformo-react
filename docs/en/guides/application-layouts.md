---
description: How application administrators customize metahub-published layouts, create application-owned layouts, and handle layout synchronization.
---

# Application Layouts

Application layouts are runtime copies of layouts published from a metahub plus layouts created directly in an application.
They are managed from the application control panel in Applications -> Layouts.
The control panel now reuses the same shared layout authoring surface as metahub layout details, so widget zones, row actions, and list/card affordances stay aligned between design-time and application-side customization.

![Layout details with widget](../.gitbook/assets/quiz-tutorial/layout-quiz-widget.png)

## Sources

Each layout has a source:

-   Metahub: created during connector schema synchronization from a publication snapshot.
-   Application: created or copied directly inside the application control panel.

The source is shown in both card and list-style views so administrators can distinguish inherited configuration from local application configuration.

## Local Changes

Administrators can:

-   create application-owned global or entity-scoped layouts;
-   create an independent Page/Object layout with a different immutable template;
-   copy a metahub layout into an application-owned layout;
-   make a layout default for its scope;
-   activate or deactivate layouts;
-   deactivate, add, or configure layout widgets.

Deleting a metahub layout in the application does not hard-delete it. The application marks it as excluded, inactive, and non-default so the next synchronization does not silently restore it.
Deleting an application-owned layout uses the standard application soft-delete path.

## Synchronization

When a connector synchronization imports a newer metahub publication:

-   clean metahub layouts are overwritten by the new source content;
-   locally modified metahub layouts are marked as conflict instead of being overwritten;
-   metahub layouts removed from the publication are marked as source removed;
-   application-owned layouts are preserved;
-   source defaults do not replace an application-owned or locally modified default in the same scope.

The default conflict model is fail-closed: it preserves local work and exposes sync state for follow-up resolution.
The connector diff dialog also allows an explicit overwrite policy for administrators who want metahub layout content to replace local metahub-derived customizations during that synchronization.

## Runtime Behavior

Only active layouts and active widgets are used by the application runtime.
Inactive layouts remain available in the control panel and can be reactivated later.

Application Settings derive feature-specific tabs from this active materialized runtime state. For example, the Interpretation Network Matrix tab appears only when an active `interpretationNetworkWorkspace` widget exists, and changes are saved to that widget's config. LMS Learning Content settings are not shown or saved for unrelated application configurations unless the materialized runtime state contains matching LMS configuration.

For a `marketing-page` layout, the immutable template key selects the
marketing renderer and its typed appearance config. Dashboard zones and
widgets are not injected into that layout; section order and visibility are
validated by the marketing contract. Content changes are made through the
published Object records, not through dashboard CRUD controls.

The shared capability registry exposes `languageSwitcher` in the Dashboard
`top` zone and the marketing `marketing-header` zone. Other widgets remain
template-specific and are rejected if a placement targets an unsupported
template or zone.

Runtime selection is target-aware. Hosted and standalone clients request
`/api/v1/applications/:applicationId/runtime/effective-layout` with the global
surface or an authorized Page/Object target. An active scoped default wins over
the active global default for that target. `recordKey` is content-only and does
not change the selected template. Publication identity, lineage, and the
`effectiveHash` are validated server-side before a renderer is chosen.

Hosted links use ordinary query parameters. The standalone entry uses the same
contract inside its hash route, so the language control does not discard a
target or workspace when it changes locale:

```text
/a/<applicationId>?targetKind=object&entityTypeId=<entityTypeId>&locale=ru
/#/a/<applicationId>?targetKind=object&entityTypeId=<entityTypeId>&locale=ru
```

An invalid target selector is rejected before layout resolution. The dedicated
standalone Playwright proof is opt-in and reports
`BLOCKED` when no deployed shell is configured; a skipped standalone test is not
treated as evidence.

## Side Menu Modes

The layout configuration includes side-menu behavior for published applications. Administrators can enable any combination of:

-   Wide menu: the full permanent left navigation.
-   Compact menu: the permanent icon-only navigation with accessible labels.
-   Overlay menu: a drawer opened from the top navigation button.

At least one mode is always stored. The primary mode must be one of the enabled modes. By default all three modes are available, the wide menu is primary, and the runtime remembers the user's last selected mode per application.

Menu widget targets are selected from runtime sections by human-readable labels. During application synchronization they are materialized to UUID-backed section targets, so renaming a metahub or changing its codename must not break the published application menu.

## Related Reading

-   [Entity-Scoped Layouts](entity-scoped-layouts.md)
-   [Applications](../platform/applications.md)
-   [Updating System App Schemas](updating-system-app-schemas.md)
