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

- Metahub: created during connector schema synchronization from a publication snapshot.
- Application: created or copied directly inside the application control panel.

The source is shown in both card and list-style views so administrators can distinguish inherited configuration from local application configuration.

## Local Changes

Administrators can:

- create application-owned global or entity-scoped layouts;
- copy a metahub layout into an application-owned layout;
- make a layout default for its scope;
- activate or deactivate layouts;
- deactivate, add, or configure layout widgets.

Deleting a metahub layout in the application does not hard-delete it. The application marks it as excluded, inactive, and non-default so the next synchronization does not silently restore it.
Deleting an application-owned layout uses the standard application soft-delete path.

## Synchronization

When a connector synchronization imports a newer metahub publication:

- clean metahub layouts are overwritten by the new source content;
- locally modified metahub layouts are marked as conflict instead of being overwritten;
- metahub layouts removed from the publication are marked as source removed;
- application-owned layouts are preserved;
- source defaults do not replace an application-owned or locally modified default in the same scope.

The default conflict model is fail-closed: it preserves local work and exposes sync state for follow-up resolution.
The connector diff dialog also allows an explicit overwrite policy for administrators who want metahub layout content to replace local metahub-derived customizations during that synchronization.

## Runtime Behavior

Only active layouts and active widgets are used by the application runtime.
Inactive layouts remain available in the control panel and can be reactivated later.

## Related Reading

- [Entity-Scoped Layouts](entity-scoped-layouts.md)
- [Applications](../platform/applications.md)
- [Updating System App Schemas](updating-system-app-schemas.md)
